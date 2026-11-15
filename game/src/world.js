// Emberfall — the world: state, waves, and the rules.
// One file, one job: everything that happens in the field lives here — the
// keeper, the ash-wisps, bullets and bolts, pickups, the combo, the waves and
// the score. It knows nothing of the canvas, the keyboard or sound; it takes
// an input, advances one fixed step, and reports what happened as event bits
// for main.js to announce and play.

import {
  BOLT,
  COMBO,
  ENEMY,
  FIELD,
  FX,
  NOVA,
  PALETTE,
  PICKUP,
  PLAYER,
  WAVE,
  WAVE_COUNT,
  WAVES,
} from './config.js';
import { createRandom } from './random.js';

/** Event bits step() returns; main.js turns them into sound and announcements. */
export const EVENT_SHOT = 1;
export const EVENT_BURN = 2;
export const EVENT_HURT = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_WAVE = 32;
export const EVENT_PICKUP = 64;
export const EVENT_POWER = 128;
export const EVENT_HEART = 256;
export const EVENT_NOVA = 512;

/** Flavour lines for the wave banners. */
const WAVE_LINES = [
  'They come for the light',
  'The dark sends runners',
  'Something splits in the ash',
  'The spitters find their range',
  'The field grows crowded',
  'Hold the lantern high',
  'The night is hungry',
  'Almost dawn — almost',
  'The last of the swarm',
  'THE ASHEN HERALD',
];

/** How far outside the field an enemy appears, in pixels. */
const SPAWN_MARGIN = 34;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(seed) {
  const random = createRandom(seed);
  let state = null;

  /** A fresh enemy of `kind` at the field's edge, announced by a warning ring. */
  function spawnEnemy(kind) {
    const edge = random.int(0, 3);
    let x;
    let y;
    if (edge === 0) {
      x = random.range(0, FIELD.width);
      y = -SPAWN_MARGIN;
    } else if (edge === 1) {
      x = FIELD.width + SPAWN_MARGIN;
      y = random.range(0, FIELD.height);
    } else if (edge === 2) {
      x = random.range(0, FIELD.width);
      y = FIELD.height + SPAWN_MARGIN;
    } else {
      x = -SPAWN_MARGIN;
      y = random.range(0, FIELD.height);
    }
    const def = ENEMY[kind];
    return {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      speed: def.speed * random.range(0.9, 1.1),
      warn: WAVE.spawnWarn,
      age: 0,
      lungeTimer: random.range(1.2, 2.4),
      lunging: 0,
      shotTimer: random.range(1.4, 2.4),
      burstTimer: 2.0,
      spawnTimer: 4.0,
      seed: random.next(),
    };
  }

  /** A burst of glowing particles at a point. */
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.angle();
      const magnitude = random.range(speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * magnitude,
        vy: Math.sin(angle) * magnitude,
        life: random.range(0.35, 0.8),
        maxLife: 0.8,
        size: random.range(2, 5),
        color,
      });
    }
  }

  /** Floating score text that rises and fades. */
  function floatText(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: FX.floatTextLife, maxLife: FX.floatTextLife });
  }

  /** The current score multiplier from the kill chain. */
  function multiplier() {
    return Math.min(1 + Math.floor(state.comboChain / COMBO.perStep), COMBO.max);
  }

  /** Roll the drop table for a burned enemy; at most one pickup falls. */
  function maybeDrop(x, y) {
    const roll = random.next();
    let acc = 0;
    for (const kind of ['heart', 'shield', 'rapid', 'nova', 'kindling']) {
      acc += PICKUP[kind].chance;
      if (roll < acc) {
        if (kind === 'heart' && state.player.hearts >= PLAYER.maxHearts) return;
        state.pickups.push({
          kind,
          x,
          y,
          vx: random.range(-30, 30),
          vy: random.range(-30, 30),
          life: PICKUP[kind].life,
          seed: random.next(),
        });
        return;
      }
    }
  }

  /** Burn one enemy: score, combo, drops, particles, and splitter children. */
  function killEnemy(enemy, index) {
    const def = ENEMY[enemy.kind];
    const mult = multiplier();
    const gained = def.score * mult;
    state.score += gained;
    state.comboChain += 1;
    state.comboTimer = COMBO.window;
    floatText(enemy.x, enemy.y - enemy.radius, `+${gained}`, mult > 1 ? PALETTE.gold : PALETTE.text);
    burst(enemy.x, enemy.y, def.color, FX.burstParticles, 220);
    burst(enemy.x, enemy.y, PALETTE.ember, 8, 140);
    maybeDrop(enemy.x, enemy.y);
    state.enemies.splice(index, 1);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const child = spawnEnemy('wisp');
        child.x = enemy.x + random.range(-24, 24);
        child.y = enemy.y + random.range(-24, 24);
        child.warn = 0;
        state.enemies.push(child);
      }
    }
  }

  /** Hurt the player once: a heart, mercy time, the combo dies, the field shakes. */
  function hurtPlayer() {
    const player = state.player;
    if (player.mercy > 0 || player.shieldUntil > state.time) return 0;
    player.hearts -= 1;
    player.mercy = PLAYER.mercyTime;
    state.comboChain = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, FX.hitShake);
    burst(player.x, player.y, PALETTE.flame, 18, 260);
    if (player.hearts <= 0) return EVENT_HURT | EVENT_OVER;
    return EVENT_HURT;
  }

  /** Begin a wave: queue its roster, show the banner, grant a nova when due. */
  function startWave(number) {
    state.wave = number;
    state.spawnQueue = [];
    const table = WAVES[number - 1];
    for (const kind of ['wisp', 'dasher', 'splitter', 'spitter', 'herald']) {
      for (let i = 0; i < table[kind]; i += 1) state.spawnQueue.push(kind);
    }
    // Shuffle the queue so the wave arrives mixed, not kind by kind.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    state.spawnTimer = 0.4;
    state.waveState = 'spawning';
    state.banner = {
      title: number === WAVE_COUNT ? 'THE ASHEN HERALD' : `WAVE ${number}`,
      sub: WAVE_LINES[number - 1],
      timer: 2.2,
      max: 2.2,
    };
    if (NOVA.grantWaves.includes(number)) state.novaStock += 1;
  }

  /** A fresh state: the field, the keeper in the middle, wave one about to start. */
  function freshState() {
    return {
      time: 0,
      mode: 'attract',
      player: {
        x: FIELD.width / 2,
        y: FIELD.height / 2,
        hearts: PLAYER.maxHearts,
        mercy: 0,
        shieldUntil: 0,
        rapidUntil: 0,
        fireCooldown: 0,
        aimAngle: -Math.PI / 2,
      },
      enemies: [],
      bullets: [],
      bolts: [],
      pickups: [],
      particles: [],
      texts: [],
      embers: [],
      spawnQueue: [],
      spawnTimer: 0,
      wave: 0,
      waveState: 'idle',
      waveTimer: 0,
      score: 0,
      comboChain: 0,
      comboTimer: 0,
      novaStock: NOVA.startStock,
      shake: 0,
      flash: 0,
      banner: null,
      over: false,
      won: false,
    };
  }

  /** Ambient embers that always drift up through the night. */
  function seedEmbers() {
    for (let i = 0; i < FX.emberCount; i += 1) {
      state.embers.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, FIELD.height),
        vx: random.range(-6, 6),
        vy: random.range(-26, -8),
        size: random.range(1, 3.2),
        alpha: random.range(0.25, 0.8),
        phase: random.range(0, Math.PI * 2),
      });
    }
  }

  /** A few wisps wandering the title screen, harmless, for the backdrop. */
  function seedAttractWisps() {
    for (let i = 0; i < 6; i += 1) {
      const wisp = spawnEnemy('wisp');
      wisp.x = random.range(80, FIELD.width - 80);
      wisp.y = random.range(80, FIELD.height - 80);
      wisp.warn = 0;
      wisp.speed = random.range(18, 34);
      state.enemies.push(wisp);
    }
  }

  function reset() {
    state = freshState();
    seedEmbers();
    seedAttractWisps();
  }

  reset();

  return {
    get state() {
      return state;
    },
    reset,

    /** Start a real game from the title screen. */
    startGame() {
      state = freshState();
      seedEmbers();
      state.mode = 'play';
      startWave(1);
    },

    /**
     * Jump a fresh game straight to a wave, for the victory screenshot: the
     * final wave fought from a full-hearted attempt, the way a player who
     * reached it would face it.
     */
    jumpToWave(number) {
      state.enemies = [];
      state.bullets = [];
      state.bolts = [];
      state.pickups = [];
      state.spawnQueue = [];
      state.waveState = 'idle';
      startWave(number);
    },

    /**
     * Advance the world one fixed step.
     * input: { dx, dy, aimX, aimY, firing, nova } in field coordinates.
     * attract: true on the title screen — the field idles, nothing can die.
     * Returns the event bits of what happened this step.
     */
    step(dt, input, attract) {
      let events = 0;
      state.time += dt;

      // The night itself: embers drift up and flicker, in every mode.
      for (const ember of state.embers) {
        ember.x += ember.vx * dt;
        ember.y += ember.vy * dt;
        ember.phase += dt * 2;
        if (ember.y < -4) {
          ember.y = FIELD.height + 4;
          ember.x = random.range(0, FIELD.width);
        }
        if (ember.x < -4) ember.x = FIELD.width + 4;
        if (ember.x > FIELD.width + 4) ember.x = -4;
      }
      for (const particle of state.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 1 - 2.4 * dt;
        particle.vy *= 1 - 2.4 * dt;
        particle.life -= dt;
      }
      state.particles = state.particles.filter((p) => p.life > 0);
      for (const text of state.texts) {
        text.y -= 34 * dt;
        text.life -= dt;
      }
      state.texts = state.texts.filter((t) => t.life > 0);
      if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);
      if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
      if (state.banner) {
        state.banner.timer -= dt;
        if (state.banner.timer <= 0) state.banner = null;
      }

      if (attract) {
        // Title screen: wisps wander in slow circles, nothing chases, nothing dies.
        for (const enemy of state.enemies) {
          enemy.age += dt;
          enemy.x += Math.cos(enemy.age * 0.7 + enemy.seed * 6) * enemy.speed * dt;
          enemy.y += Math.sin(enemy.age * 0.5 + enemy.seed * 6) * enemy.speed * dt * 0.6;
          if (enemy.x < 30) enemy.x = 30;
          if (enemy.x > FIELD.width - 30) enemy.x = FIELD.width - 30;
          if (enemy.y < 30) enemy.y = 30;
          if (enemy.y > FIELD.height - 30) enemy.y = FIELD.height - 30;
        }
        return events;
      }

      if (state.over || state.won) return events;

      const player = state.player;

      // Timers: mercy, combo, shield and rapid-fire all count down.
      if (player.mercy > 0) player.mercy -= dt;
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.comboChain = 0;
      }

      // The nova bomb: everything burning on the field takes the blast.
      if (input.nova && state.novaStock > 0) {
        state.novaStock -= 1;
        state.flash = FX.novaFlash;
        state.shake = Math.max(state.shake, FX.deathShake);
        state.bolts = [];
        for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
          const enemy = state.enemies[i];
          enemy.hp -= NOVA.damage;
          burst(enemy.x, enemy.y, PALETTE.gold, 10, 200);
          if (enemy.hp <= 0) killEnemy(enemy, i);
        }
        events |= EVENT_NOVA;
      }

      // Move the keeper and aim the lantern where the mouse points.
      player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + input.dx * PLAYER.speed * dt));
      player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + input.dy * PLAYER.speed * dt));
      player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

      // Fire: hold to shoot, faster while rapid-fire burns.
      player.fireCooldown -= dt;
      if (input.firing && player.fireCooldown <= 0) {
        const interval = player.rapidUntil > state.time ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval;
        player.fireCooldown = interval;
        const angle = player.aimAngle + random.range(-0.02, 0.02);
        state.bullets.push({
          x: player.x + Math.cos(angle) * (PLAYER.radius + 6),
          y: player.y + Math.sin(angle) * (PLAYER.radius + 6),
          vx: Math.cos(angle) * PLAYER.bulletSpeed,
          vy: Math.sin(angle) * PLAYER.bulletSpeed,
          life: 1.1,
        });
        events |= EVENT_SHOT;
      }

      // Deal out the wave's roster in small groups, so the field stays busy:
      // one at a time in wave one, up to four at a time in the late waves.
      if (state.waveState === 'spawning') {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
          const group = Math.min(1 + Math.floor((state.wave - 1) / 2), 4, state.spawnQueue.length);
          for (let i = 0; i < group; i += 1) state.enemies.push(spawnEnemy(state.spawnQueue.shift()));
          state.spawnTimer = WAVE.spawnInterval * random.range(0.75, 1.25);
        }
        if (state.spawnQueue.length === 0) state.waveState = 'fighting';
      }

      // Bullets fly straight and die off the field.
      for (const bullet of state.bullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
      }
      state.bullets = state.bullets.filter(
        (b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20,
      );

      // Enemy bolts drift and die off the field.
      for (const bolt of state.bolts) {
        bolt.x += bolt.vx * dt;
        bolt.y += bolt.vy * dt;
        bolt.life -= dt;
      }
      state.bolts = state.bolts.filter(
        (b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20,
      );

      // Pickups drift, bob, and fade out.
      for (const pickup of state.pickups) {
        pickup.x += pickup.vx * dt;
        pickup.y += pickup.vy * dt;
        pickup.vx *= 1 - 2 * dt;
        pickup.vy *= 1 - 2 * dt;
        pickup.life -= dt;
      }
      state.pickups = state.pickups.filter((p) => p.life > 0);

      // Enemies act: each kind has its own way of hunting the lantern.
      for (const enemy of state.enemies) {
        enemy.age += dt;
        if (enemy.warn > 0) {
          enemy.warn -= dt;
          continue;
        }
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const nx = dx / dist;
        const ny = dy / dist;
        if (enemy.kind === 'wisp' || enemy.kind === 'splitter') {
          enemy.vx = nx * enemy.speed;
          enemy.vy = ny * enemy.speed;
        } else if (enemy.kind === 'dasher') {
          enemy.lungeTimer -= dt;
          if (enemy.lunging > 0) {
            enemy.lunging -= dt;
          } else if (enemy.lungeTimer <= 0 && dist < 420) {
            enemy.vx = nx * ENEMY.dasher.lungeSpeed;
            enemy.vy = ny * ENEMY.dasher.lungeSpeed;
            enemy.lunging = 0.35;
            enemy.lungeTimer = ENEMY.dasher.lungeEvery * random.range(0.85, 1.2);
          } else {
            enemy.vx = nx * enemy.speed;
            enemy.vy = ny * enemy.speed;
          }
        } else if (enemy.kind === 'spitter') {
          // Keeps a firing distance: closes in when far, backs off when close.
          const want = dist > 300 ? 1 : dist < 210 ? -1 : 0;
          enemy.vx = nx * enemy.speed * want;
          enemy.vy = ny * enemy.speed * want;
          enemy.shotTimer -= dt;
          if (enemy.shotTimer <= 0 && dist < 560) {
            enemy.shotTimer = ENEMY.spitter.shotEvery * random.range(0.9, 1.15);
            state.bolts.push({
              x: enemy.x + nx * (enemy.radius + 8),
              y: enemy.y + ny * (enemy.radius + 8),
              vx: nx * ENEMY.spitter.boltSpeed,
              vy: ny * ENEMY.spitter.boltSpeed,
              life: 4,
            });
          }
        } else if (enemy.kind === 'herald') {
          enemy.vx = nx * enemy.speed;
          enemy.vy = ny * enemy.speed;
          enemy.burstTimer -= dt;
          if (enemy.burstTimer <= 0) {
            enemy.burstTimer = ENEMY.herald.burstEvery;
            for (let i = 0; i < 10; i += 1) {
              const angle = (i / 10) * Math.PI * 2 + enemy.seed;
              state.bolts.push({
                x: enemy.x + Math.cos(angle) * (enemy.radius + 10),
                y: enemy.y + Math.sin(angle) * (enemy.radius + 10),
                vx: Math.cos(angle) * BOLT.speed,
                vy: Math.sin(angle) * BOLT.speed,
                life: 5,
              });
            }
          }
          enemy.spawnTimer -= dt;
          if (enemy.spawnTimer <= 0) {
            enemy.spawnTimer = ENEMY.herald.spawnEvery;
            for (let i = 0; i < 2; i += 1) {
              const child = spawnEnemy('wisp');
              child.x = enemy.x + random.range(-50, 50);
              child.y = enemy.y + random.range(-50, 50);
              child.warn = 0.3;
              state.enemies.push(child);
            }
          }
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
      }

      // Enemies keep a little room from each other instead of stacking.
      for (let i = 0; i < state.enemies.length; i += 1) {
        for (let j = i + 1; j < state.enemies.length; j += 1) {
          const a = state.enemies[i];
          const b = state.enemies[j];
          if (a.warn > 0 || b.warn > 0) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const min = a.radius + b.radius;
          if (dist > 0 && dist < min) {
            const push = (min - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }

      // Bullets meet enemies.
      for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = state.bullets[i];
        let spent = false;
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          if (enemy.warn > 0) continue;
          if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.radius + 4) {
            enemy.hp -= 1;
            burst(bullet.x, bullet.y, PALETTE.gold, 4, 120);
            if (enemy.hp <= 0) {
              killEnemy(enemy, j);
              events |= EVENT_BURN;
            }
            spent = true;
            break;
          }
        }
        if (spent) state.bullets.splice(i, 1);
      }

      // Enemies meet the keeper: a shield burns them instead of hurting the keeper.
      const shielded = player.shieldUntil > state.time;
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = state.enemies[j];
        if (enemy.warn > 0) continue;
        if (distance(enemy.x, enemy.y, player.x, player.y) < enemy.radius + PLAYER.radius - 2) {
          if (shielded) {
            enemy.hp -= 1;
            burst(enemy.x, enemy.y, PALETTE.shield, 8, 180);
            if (enemy.hp <= 0) {
              killEnemy(enemy, j);
              events |= EVENT_BURN;
            }
          } else {
            events |= hurtPlayer();
            if (events & EVENT_OVER) break;
          }
        }
      }

      // Bolts meet the keeper.
      if (!(events & EVENT_OVER)) {
        for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
          const bolt = state.bolts[i];
          if (distance(bolt.x, bolt.y, player.x, player.y) < BOLT.radius + PLAYER.radius - 2) {
            state.bolts.splice(i, 1);
            if (shielded) {
              burst(bolt.x, bolt.y, PALETTE.shield, 6, 150);
            } else {
              events |= hurtPlayer();
              if (events & EVENT_OVER) break;
            }
          }
        }
      }

      // Pickups meet the keeper.
      for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
        const pickup = state.pickups[i];
        if (distance(pickup.x, pickup.y, player.x, player.y) < PICKUP[pickup.kind].radius + PLAYER.radius + 4) {
          state.pickups.splice(i, 1);
          if (pickup.kind === 'kindling') {
            const mult = multiplier();
            const gained = PICKUP.kindling.score * mult;
            state.score += gained;
            state.comboChain += 1;
            state.comboTimer = COMBO.window;
            floatText(pickup.x, pickup.y - 12, `+${gained}`, PALETTE.kindling);
            events |= EVENT_PICKUP;
          } else if (pickup.kind === 'heart') {
            player.hearts = Math.min(PLAYER.maxHearts, player.hearts + 1);
            floatText(pickup.x, pickup.y - 12, '+1 ♥', PALETTE.heart);
            events |= EVENT_HEART;
          } else if (pickup.kind === 'shield') {
            player.shieldUntil = state.time + PICKUP.shield.duration;
            floatText(pickup.x, pickup.y - 12, 'SHIELD', PALETTE.shield);
            events |= EVENT_POWER;
          } else if (pickup.kind === 'rapid') {
            player.rapidUntil = state.time + PICKUP.rapid.duration;
            floatText(pickup.x, pickup.y - 12, 'RAPID FIRE', PALETTE.gold);
            events |= EVENT_POWER;
          } else if (pickup.kind === 'nova') {
            state.novaStock += 1;
            floatText(pickup.x, pickup.y - 12, 'NOVA +1', PALETTE.flame);
            events |= EVENT_POWER;
          }
        }
      }

      if (events & EVENT_OVER) {
        state.over = true;
        state.shake = Math.max(state.shake, FX.deathShake);
        burst(player.x, player.y, PALETTE.flame, 30, 320);
        return events;
      }

      // The wave is done when the roster is dealt and the field is empty.
      if (state.waveState === 'fighting' && state.enemies.length === 0) {
        if (state.wave >= WAVE_COUNT) {
          state.won = true;
          return events | EVENT_WIN;
        }
        state.waveState = 'breather';
        state.waveTimer = WAVE.breather;
        events |= EVENT_WAVE;
      }
      if (state.waveState === 'breather') {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) startWave(state.wave + 1);
      }

      return events;
    },
  };
}
