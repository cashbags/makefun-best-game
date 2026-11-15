// Emberfall — the painter.
// One file, one job: turn a world state into a picture on the canvas. It never
// changes the world; it reads the state and draws the night, the keeper, the
// ash-wisps, the sparks, the HUD and the screens, in that order, every frame.

import { BOLT, ENEMY, FIELD, PALETTE, PICKUP, PLAYER } from './config.js';

/** The four screens the game can show. */
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Font stacks: system faces only, so the game needs no font files. */
const FONT_TITLE = '800 92px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_BANNER = '800 54px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_HUD = '700 22px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_BODY = '500 20px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_SMALL = '600 15px system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  /** The canvas is FIELD pixels inside; the page scales it to the window. */
  function resize() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = FIELD.width;
    canvas.height = FIELD.height;
    canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  /** A soft radial glow, drawn with a gradient that costs one fill. */
  function glow(x, y, radius, color, alpha) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.nightDeep);
    gradient.addColorStop(1, PALETTE.night);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // The ground: faint ash dunes, drawn as two soft arcs.
    ctx.strokeStyle = 'rgba(138,143,163,0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(FIELD.width * 0.3, FIELD.height + 90, 620, 150, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(FIELD.width * 0.85, FIELD.height + 130, 520, 170, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Drifting embers, flickering as they rise.
    for (const ember of state.embers) {
      const flicker = 0.6 + 0.4 * Math.sin(ember.phase);
      ctx.globalAlpha = ember.alpha * flicker;
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(state.time * 3 + pickup.seed * 9) * 3;
      const blink = pickup.life < 3 ? (Math.sin(state.time * 12) > 0 ? 1 : 0.35) : 1;
      ctx.globalAlpha = blink;
      const y = pickup.y + bob;
      if (pickup.kind === 'kindling') {
        glow(pickup.x, y, 22, PALETTE.kindling, 0.5);
        ctx.fillStyle = PALETTE.kindling;
        ctx.beginPath();
        ctx.arc(pickup.x, y, PICKUP.kindling.radius - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a4d00';
        ctx.beginPath();
        ctx.arc(pickup.x - 2, y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (pickup.kind === 'heart') {
        glow(pickup.x, y, 26, PALETTE.heart, 0.55);
        ctx.fillStyle = PALETTE.heart;
        ctx.font = '20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', pickup.x, y + 1);
      } else if (pickup.kind === 'shield') {
        glow(pickup.x, y, 26, PALETTE.shield, 0.55);
        ctx.strokeStyle = PALETTE.shield;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pickup.x, y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pickup.x, y, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pickup.kind === 'rapid') {
        glow(pickup.x, y, 26, PALETTE.gold, 0.55);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(pickup.x, y - 10);
        ctx.lineTo(pickup.x + 6, y + 2);
        ctx.lineTo(pickup.x + 1, y + 2);
        ctx.lineTo(pickup.x + 4, y + 10);
        ctx.lineTo(pickup.x - 6, y - 2);
        ctx.lineTo(pickup.x - 1, y - 2);
        ctx.closePath();
        ctx.fill();
      } else if (pickup.kind === 'nova') {
        glow(pickup.x, y, 30, PALETTE.flame, 0.7);
        ctx.fillStyle = PALETTE.flame;
        ctx.beginPath();
        ctx.arc(pickup.x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(pickup.x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemy(enemy, time) {
    const wobble = Math.sin(time * 3 + enemy.seed * 10) * 0.12;
    if (enemy.warn > 0) {
      // The spawn warning: a pulsing ring where the enemy is about to arrive.
      const pulse = 0.5 + 0.5 * Math.sin(time * 14);
      ctx.globalAlpha = 0.35 + 0.45 * pulse;
      ctx.strokeStyle = enemy.kind === 'herald' ? PALETTE.herald : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 8 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    const def = ENEMY[enemy.kind];
    glow(enemy.x, enemy.y, enemy.radius * 2.4, def.color, 0.35);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    if (enemy.kind === 'wisp') {
      // A drifting wisp: a soft body with a trailing tail.
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(enemy.x - Math.cos(enemy.age) * 6, enemy.y + enemy.radius * 0.9, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (enemy.kind === 'dasher') {
      // A dart: a triangle pointing where it moves.
      const angle = Math.atan2(enemy.vy, enemy.vx);
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 6, 0);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius * 0.4, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (enemy.kind === 'splitter') {
      // A cracked orb: two halves with a glowing seam.
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(13,11,30,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(enemy.x - enemy.radius * 0.7, enemy.y - enemy.radius * 0.5);
      ctx.lineTo(enemy.x + enemy.radius * 0.6, enemy.y + enemy.radius * 0.7);
      ctx.stroke();
    } else if (enemy.kind === 'spitter') {
      // A spitter: a ringed orb with a dark mouth.
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(13,11,30,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (enemy.kind === 'herald') {
      // The herald: a great crowned ember, pulsing with the wave's anger.
      const pulse = 1 + 0.06 * Math.sin(time * 4);
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + wobble;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (enemy.radius + 2), Math.sin(angle) * (enemy.radius + 2));
        ctx.lineTo(Math.cos(angle) * (enemy.radius + 14), Math.sin(angle) * (enemy.radius + 14));
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Wounds: a dark notch per lost hit point, so damage reads at a glance.
    if (enemy.maxHp > 1) {
      ctx.fillStyle = 'rgba(13,11,30,0.75)';
      for (let i = 0; i < enemy.maxHp - enemy.hp; i += 1) {
        ctx.beginPath();
        ctx.arc(enemy.x - enemy.radius * 0.5 + i * 7, enemy.y - enemy.radius - 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (state.over) return;
    const flicker = player.mercy > 0 && Math.sin(state.time * 24) > 0;
    ctx.globalAlpha = flicker ? 0.35 : 1;
    // The lantern glow.
    glow(player.x, player.y, PLAYER.glowRadius, PALETTE.ember, 0.28);
    // The shield ring, when it burns.
    if (player.shieldUntil > state.time) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = flicker ? 0.35 : 1;
    }
    // The keeper: a bright core, an ember ring, and a barrel aimed at the mouse.
    const angle = player.aimAngle;
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(angle) * 10, player.y + Math.sin(angle) * 10);
    ctx.lineTo(player.x + Math.cos(angle) * 24, player.y + Math.sin(angle) * 24);
    ctx.stroke();
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBulletsAndBolts(state) {
    for (const bullet of state.bullets) {
      glow(bullet.x, bullet.y, 12, PALETTE.gold, 0.7);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const bolt of state.bolts) {
      glow(bolt.x, bolt.y, 14, PALETTE.spitter, 0.6);
      ctx.fillStyle = PALETTE.spitter;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, BOLT.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const text of state.texts) {
      ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
  }

  /** The top bar: hearts, wave, score, combo, best and nova stock. */
  function drawHud(state, best) {
    ctx.textBaseline = 'middle';
    // Hearts, top left.
    ctx.font = '24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < PLAYER.maxHearts; i += 1) {
      ctx.fillStyle = i < state.player.hearts ? PALETTE.heart : 'rgba(138,143,163,0.35)';
      ctx.fillText('♥', 24 + i * 30, 30);
    }
    // Wave and score, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_HUD;
    ctx.fillText(`WAVE ${Math.max(1, state.wave)} / 10`, FIELD.width / 2, 26);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(`${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 56);
    // Combo, under the score when it burns.
    const mult = Math.min(1 + Math.floor(state.comboChain / 5), 8);
    if (state.comboChain >= 3) {
      ctx.fillStyle = mult >= 4 ? PALETTE.flame : PALETTE.gold;
      ctx.font = FONT_HUD;
      ctx.fillText(`COMBO x${mult}  (${state.comboChain})`, FIELD.width / 2, 88);
      // The combo window, draining.
      ctx.fillStyle = 'rgba(138,143,163,0.4)';
      ctx.fillRect(FIELD.width / 2 - 60, 100, 120, 5);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(FIELD.width / 2 - 60, 100, 120 * Math.max(0, state.comboTimer / 2.5), 5);
    }
    // Best and nova stock, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = FONT_SMALL;
    ctx.fillText(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}`, FIELD.width - 24, 24);
    ctx.fillStyle = state.novaStock > 0 ? PALETTE.flame : PALETTE.ashDim;
    ctx.font = FONT_HUD;
    ctx.fillText(`NOVA ${'●'.repeat(state.novaStock)}${'○'.repeat(Math.max(0, 3 - state.novaStock))}  [B]`, FIELD.width - 24, 52);
    // Active timers: shield and rapid-fire, under the hearts.
    ctx.textAlign = 'left';
    ctx.font = FONT_SMALL;
    let line = 60;
    if (state.player.shieldUntil > state.time) {
      ctx.fillStyle = PALETTE.shield;
      ctx.fillText(`SHIELD ${Math.ceil(state.player.shieldUntil - state.time)}s`, 24, line);
      line += 20;
    }
    if (state.player.rapidUntil > state.time) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`RAPID ${Math.ceil(state.player.rapidUntil - state.time)}s`, 24, line);
    }
    // The herald's health bar, bottom centre, only while it lives.
    const herald = state.enemies.find((e) => e.kind === 'herald' && e.warn <= 0);
    if (herald) {
      const width = 420;
      const x = FIELD.width / 2 - width / 2;
      const y = FIELD.height - 44;
      ctx.fillStyle = 'rgba(13,11,30,0.7)';
      ctx.fillRect(x - 6, y - 6, width + 12, 26);
      ctx.fillStyle = 'rgba(138,143,163,0.4)';
      ctx.fillRect(x, y, width, 14);
      ctx.fillStyle = PALETTE.herald;
      ctx.fillRect(x, y, width * Math.max(0, herald.hp / herald.maxHp), 14);
      ctx.fillStyle = PALETTE.text;
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'center';
      ctx.fillText('THE ASHEN HERALD', FIELD.width / 2, y - 16);
    }
  }

  function drawBanner(state) {
    if (!state.banner) return;
    const alpha = Math.min(1, state.banner.timer / 0.6, (state.banner.max - state.banner.timer) / 0.25 + 0.4);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_BANNER;
    ctx.fillText(state.banner.title, FIELD.width / 2, FIELD.height * 0.32);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = FONT_BODY;
    ctx.fillText(state.banner.sub, FIELD.width / 2, FIELD.height * 0.32 + 44);
    ctx.globalAlpha = 1;
  }

  function drawTitle(state, best) {
    // The title screen: the field idles behind a dark veil, the name burns.
    ctx.fillStyle = 'rgba(7,6,20,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ember;
    ctx.font = FONT_TITLE;
    ctx.fillText('EMBERFALL', FIELD.width / 2, FIELD.height * 0.3);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillText('The last lantern in an ashen field', FIELD.width / 2, FIELD.height * 0.3 + 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_BODY;
    ctx.fillText('Burn the ash-wisps. Gather the kindling. Survive 10 waves until dawn.', FIELD.width / 2, FIELD.height * 0.46);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = FONT_BODY;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Click / Space — shoot', FIELD.width / 2, FIELD.height * 0.52);
    ctx.fillText('B — nova bomb      P — pause      M — mute', FIELD.width / 2, FIELD.height * 0.57);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = FONT_HUD;
      ctx.fillText(`BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, FIELD.height * 0.65);
    }
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText('Press SPACE or click to begin', FIELD.width / 2, FIELD.height * 0.74);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(7,6,20,0.65)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_BANNER;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height * 0.42);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = FONT_BODY;
    ctx.fillText('Press P or Space to keep playing', FIELD.width / 2, FIELD.height * 0.42 + 48);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(7,6,20,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.flame;
    ctx.font = FONT_TITLE;
    ctx.fillText('THE FLAME DIES', FIELD.width / 2, FIELD.height * 0.32);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = FONT_BODY;
    ctx.fillText(`The ash-wisps take the field on wave ${state.wave}.`, FIELD.width / 2, FIELD.height * 0.32 + 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_HUD;
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, FIELD.height * 0.48);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, FIELD.height * 0.48 + 36);
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText('Press ENTER to rekindle the lantern', FIELD.width / 2, FIELD.height * 0.66);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, best) {
    // Dawn breaks: a gold wash over the field, the night letting go.
    const dawn = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    dawn.addColorStop(0, 'rgba(255,201,60,0.28)');
    dawn.addColorStop(1, 'rgba(255,90,60,0.12)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = FONT_TITLE;
    ctx.fillText('DAWN BREAKS', FIELD.width / 2, FIELD.height * 0.32);
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_BODY;
    ctx.fillText('Ten waves burned down. The herald is ash. The lantern kept its light.', FIELD.width / 2, FIELD.height * 0.32 + 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_HUD;
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, FIELD.height * 0.48);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, FIELD.height * 0.48 + 36);
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText('Press ENTER to play again', FIELD.width / 2, FIELD.height * 0.66);
    ctx.globalAlpha = 1;
  }

  return {
    /**
     * Paint one frame: the night, the pickups, the enemies, the keeper, the
     * sparks, the HUD, then the screen on top. `screen` is one of the
     * SCREEN_* constants; `best` is the saved best score.
     */
    draw(state, screen, best) {
      ctx.save();
      if (state.shake > 0.5) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawBackground(state);
      drawPickups(state);
      for (const enemy of state.enemies) drawEnemy(enemy, state.time);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawPlayer(state);
      drawBulletsAndBolts(state);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
      if (screen === SCREEN_PLAY) drawBanner(state);
      ctx.restore();
      // The nova flash washes the whole frame white-gold for a beat.
      if (state.flash > 0) {
        ctx.globalAlpha = Math.min(0.55, state.flash * 1.4);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
        ctx.globalAlpha = 1;
      }
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);
    },
  };
}
