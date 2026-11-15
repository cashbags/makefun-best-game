// Emberfall — boot and the one loop.
// One file, one job: start the world, read the input every frame, advance the
// world in fixed 1/60 s steps, and paint what is there. The game moves between
// five screens: title, play, paused, game over and victory. Sounds and screen
// reader announcements follow the events the world reports each step.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE } from './input.js';
import {
  createWorld,
  EVENT_BURN,
  EVENT_HEART,
  EVENT_HURT,
  EVENT_NOVA,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_POWER,
  EVENT_SHOT,
  EVENT_WAVE,
  EVENT_WIN,
} from './world.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (a private window): the best then lasts one visit.
  }
}

/** Play the sounds for one step's events, and nothing else. */
function playEvents(events) {
  if (events & EVENT_SHOT) audio.shoot();
  if (events & EVENT_BURN) audio.burn();
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_POWER) audio.pickup();
  if (events & EVENT_HEART) audio.heart();
  if (events & EVENT_NOVA) audio.nova();
  if (events & EVENT_WAVE) audio.wave();
  if (events & EVENT_HURT) audio.hurt();
  if (events & EVENT_WIN) audio.win();
  if (events & EVENT_OVER) audio.lose();
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audioUnlock = () => audio.unlock();
  window.addEventListener('pointerdown', audioUnlock, { once: true });
  window.addEventListener('keydown', audioUnlock, { once: true });

  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  /** Screen readers (and anyone watching the page's text) hear the changes. */
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.startGame();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three hearts. Survive ten waves until dawn.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      won
        ? `Dawn breaks. You win. Score ${world.state.score}. Best ${best}.`
        : `Game over. Score ${world.state.score}. Best ${best}.`,
    );
  }

  /** Aim in field coordinates: the mouse reports CSS pixels on the canvas. */
  function aimInField() {
    const rect = canvas.getBoundingClientRect();
    const [x, y] = input.aim();
    return [x * (FIELD.width / rect.width), y * (FIELD.height / rect.height)];
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dx: 0, dy: 0, aimX: 640, aimY: 360, firing: false, nova: false }, true);
      return;
    }
    const [dx, dy] = input.direction();
    const [aimX, aimY] = aimInField();
    const events = world.step(
      STEP,
      { dx, dy, aimX, aimY, firing: input.isFiring(), nova: false },
      false,
    );
    playEvents(events);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_HURT) {
      announce(
        world.state.player.hearts === 1
          ? 'Hit. One heart left.'
          : `Hit. ${world.state.player.hearts} hearts left.`,
      );
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_NOVA && screen === SCREEN_PLAY) {
      // The nova is spent inside the next step, so it fires exactly once.
      const [dx, dy] = input.direction();
      const [aimX, aimY] = aimInField();
      const events = world.step(0, { dx, dy, aimX, aimY, firing: input.isFiring(), nova: true }, false);
      playEvents(events);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting wisps feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
