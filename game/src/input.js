// Emberfall — keyboard and mouse.
// One file, one job: read the player's hands and hand the world two things —
// a movement direction and the actions that happened since the last frame.
// The game never reads a key directly; it reads this module's answer.

/** Action bits handed to the loop each frame. */
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOVA = 4;
export const ACTION_MUTE = 8;

/** Keys that move the keeper, and the keys that confirm, pause or bomb. */
const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
const CONFIRM_KEYS = new Set(['Space', 'Enter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const NOVA_KEYS = new Set(['KeyB', 'ShiftLeft', 'ShiftRight']);
const MUTE_KEYS = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let firing = false;
  let aimX = 0;
  let aimY = 0;

  function onKeyDown(event) {
    if (MOVE_KEYS[event.code] || CONFIRM_KEYS.has(event.code) || PAUSE_KEYS.has(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM_KEYS.has(event.code)) queued |= ACTION_CONFIRM;
    else if (PAUSE_KEYS.has(event.code)) queued |= ACTION_PAUSE;
    else if (NOVA_KEYS.has(event.code)) queued |= ACTION_NOVA;
    else if (MUTE_KEYS.has(event.code)) queued |= ACTION_MUTE;
    if (event.code === 'Space') firing = true;
  }

  function onKeyUp(event) {
    held.delete(event.code);
    if (event.code === 'Space') firing = false;
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    aimX = event.clientX - rect.left;
    aimY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      firing = true;
      queued |= ACTION_CONFIRM;
    } else if (event.button === 2) {
      queued |= ACTION_NOVA;
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) firing = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onBlur() {
    held.clear();
    firing = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    /** The movement direction this frame, normalised, or [0, 0]. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return [0, 0];
      const length = Math.hypot(x, y);
      return [x / length, y / length];
    },
    /** The aim point in canvas pixels, as the mouse last reported it. */
    aim() {
      return [aimX, aimY];
    },
    /** Whether the fire button (mouse or Space) is held right now. */
    isFiring() {
      return firing;
    },
    /** The actions queued since the last call; each is reported once. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
