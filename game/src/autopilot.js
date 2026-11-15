// Emberfall — the autopilot: a stand-in player for the screenshots.
// One file, one job: look at the world and decide what a player would do —
// where to move, where to aim, when to shoot, when to bomb. The screenshots
// are staged by playing the real rules forward with this pilot, so every
// frame is a moment a real game could reach. Two skills: a strong pilot that
// survives, and a weak one that gets caught out, like a hurried player.

/** The strong pilot: wide eyes, steady aim, bombs when surrounded. */
export const SKILL_STRONG = { fleeRadius: 200, aimError: 0.02, useNova: true, alwaysFire: true };
/** The weak pilot: narrow eyes, wild aim, never bombs. */
export const SKILL_WEAK = { fleeRadius: 70, aimError: 0.35, useNova: false, alwaysFire: false };

/**
 * Decide one step of play. Returns the same input shape the world takes:
 * { dx, dy, aimX, aimY, firing, nova }.
 */
export function autopilot(state, skill) {
  const player = state.player;
  const live = state.enemies.filter((e) => e.warn <= 0);

  // The nearest threat, and the nearest spitter or herald worth shooting first.
  let nearest = null;
  let nearestDist = Infinity;
  let target = null;
  let targetDist = Infinity;
  for (const enemy of live) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
    const priority = enemy.kind === 'spitter' || enemy.kind === 'herald' ? 0 : 1;
    const score = dist + priority * 500;
    if (score < targetDist) {
      targetDist = score;
      target = enemy;
    }
  }

  // Move: flee the nearest threat inside the flee radius; otherwise kite the
  // target at shooting range, or chase kindling when the field is quiet.
  let dx = 0;
  let dy = 0;
  if (nearest && nearestDist < skill.fleeRadius) {
    const away = Math.atan2(player.y - nearest.y, player.x - nearest.x);
    dx = Math.cos(away);
    dy = Math.sin(away);
  } else if (target) {
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    if (dist > 300) {
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    } else if (dist < 190) {
      dx = -Math.cos(angle);
      dy = -Math.sin(angle);
    } else {
      // Strafe sideways at range, so the pilot does not stand still.
      dx = -Math.sin(angle) * (Math.sin(state.time * 0.9) > 0 ? 1 : -1);
      dy = Math.cos(angle) * (Math.sin(state.time * 0.9) > 0 ? 1 : -1);
    }
  } else {
    // Nothing to fight: drift toward the nearest kindling.
    let kindling = null;
    let kindlingDist = Infinity;
    for (const pickup of state.pickups) {
      if (pickup.kind !== 'kindling') continue;
      const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      if (dist < kindlingDist) {
        kindlingDist = dist;
        kindling = pickup;
      }
    }
    if (kindling) {
      const angle = Math.atan2(kindling.y - player.y, kindling.x - player.x);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    }
  }

  // The field's edges are a trap: steer back toward the middle near them.
  if (player.x < 110) dx += 0.8;
  if (player.x > 1170) dx -= 0.8;
  if (player.y < 110) dy += 0.8;
  if (player.y > 610) dy -= 0.8;
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }

  // Aim: the target, with a steady wobble for the weak pilot.
  let aimX = player.x;
  let aimY = player.y - 100;
  if (target) {
    const wobble = Math.sin(state.time * 7 + target.seed * 20) * skill.aimError;
    const angle = Math.atan2(target.y - player.y, target.x - player.x) + wobble;
    aimX = player.x + Math.cos(angle) * 200;
    aimY = player.y + Math.sin(angle) * 200;
  }

  // Fire: the strong pilot always; the weak one only in bursts.
  const firing = skill.alwaysFire ? target !== null : target !== null && Math.sin(state.time * 5) > -0.2;

  // Bomb: the strong pilot clears the field when surrounded.
  let nova = false;
  if (skill.useNova && state.novaStock > 0) {
    let close = 0;
    for (const enemy of live) {
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 190) close += 1;
    }
    nova = close >= 5;
  }

  return { dx, dy, aimX, aimY, firing, nova };
}
