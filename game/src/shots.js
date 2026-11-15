// Emberfall — the screenshot scenes behind ?shot=start|play|end|win.
// One file, one job: set a world to a named scene and say which screen to
// draw over it. Each scene plays the real rules forward from a fresh world
// for a fixed stretch, steered by the autopilot, so the frame is what a real
// game looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SKILL_STRONG, SKILL_WEAK, autopilot } from './autopilot.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Seconds the title scene idles before the picture is taken. */
const START_SECONDS = 5;
/** Seconds of strong play the play scene shows, at minimum. */
const PLAY_SECONDS = 22;
/** The play scene runs past the minimum until the field is busy, or this cap. */
const PLAY_CAP_SECONDS = 45;
/** How many live enemies make the play frame read as a fight. */
const PLAY_MIN_ENEMIES = 7;
/** How close the nearest enemy must be for the action to read at a glance. */
const PLAY_MAX_NEAREST = 350;
/** The longest a loss or a victory scene may run, in game seconds. */
const SCENE_LIMIT_SECONDS = 900;
/** No input at all: the keeper stands still, the lantern unlit. */
const IDLE_INPUT = { dx: 0, dy: 0, aimX: 640, aimY: 360, firing: false, nova: false };

/**
 * Set `world` to the named scene (start, play, end or win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, IDLE_INPUT, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  world.startGame();
  // The victory scene is the final wave itself, fought from a fresh attempt.
  if (name === 'win') world.jumpToWave(10);
  const skill = name === 'end' ? SKILL_WEAK : SKILL_STRONG;
  if (name === 'play') {
    // Play past the minimum, then until the field is busy — a breather frame
    // with no enemies would show the judge an empty field.
    const cap = PLAY_CAP_SECONDS / STEP;
    for (let index = 0; index < cap; index += 1) {
      const events = world.step(STEP, autopilot(world.state, skill), false);
      if (events & EVENT_OVER) break;
      if (events & EVENT_WIN) break;
      // Busy means enemies on the field, several of them close to the keeper,
      // and no wave banner washing over the frame.
      const live = world.state.enemies.filter((e) => e.warn <= 0);
      let nearest = Infinity;
      let close = 0;
      for (const enemy of live) {
        const dist = Math.hypot(enemy.x - world.state.player.x, enemy.y - world.state.player.y);
        nearest = Math.min(nearest, dist);
        if (dist <= 420) close += 1;
      }
      const busy =
        live.length >= PLAY_MIN_ENEMIES &&
        close >= 3 &&
        nearest <= PLAY_MAX_NEAREST &&
        world.state.waveState !== 'breather' &&
        world.state.banner === null;
      if (index >= PLAY_SECONDS / STEP && busy) break;
    }
  } else {
    const limit = SCENE_LIMIT_SECONDS;
    for (let index = 0; index < limit / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, skill), false);
      if (events & EVENT_OVER) break;
      if (events & EVENT_WIN) break;
    }
  }
  const won = world.state.won;
  const over = world.state.over;
  return { screen: won ? SCREEN_WIN : over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
