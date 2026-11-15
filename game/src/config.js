// Emberfall — tuning, palette and wave table.
// One file, one job: every number the game balances on lives here, so tuning
// never means hunting through logic. Nothing in here runs; world.js reads it.

/** Logical playfield, in pixels. The canvas scales this to the window. */
export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, seconds. The loop runs the world in these slices. */
export const STEP = 1 / 60;

/** How many waves stand between the keeper and dawn. */
export const WAVE_COUNT = 10;

/** localStorage key for the best score. */
export const BEST_KEY = 'emberfall.best';

/** The palette: one night, one fire. Every draw call takes its colours here. */
export const PALETTE = {
  night: '#0d0b1e',
  nightDeep: '#070614',
  ember: '#ff8c2f',
  gold: '#ffc93c',
  flame: '#ff5a3c',
  ash: '#8a8fa3',
  ashDim: '#555a6e',
  wisp: '#b48cff',
  dasher: '#ff6ad5',
  splitter: '#3fd2c0',
  spitter: '#a8e063',
  herald: '#ff3b5c',
  heart: '#ff4d6d',
  shield: '#5ac8ff',
  kindling: '#ffd166',
  text: '#f5efe0',
  textDim: '#b9b3c7',
};

/** The player: a small ember-keeper with a lantern glow. */
export const PLAYER = {
  radius: 14,
  speed: 330,
  fireInterval: 0.13,
  bulletSpeed: 660,
  bulletRadius: 4,
  maxHearts: 3,
  /** Seconds of mercy after a hit, during which nothing can hurt the player. */
  mercyTime: 1.4,
  /** Radius of the lantern glow drawn around the player. */
  glowRadius: 90,
};

/** Enemy kinds. speed is the drift speed; lungeSpeed is the dasher's burst. */
export const ENEMY = {
  wisp: { radius: 13, speed: 88, hp: 1, score: 50, color: PALETTE.wisp },
  dasher: { radius: 11, speed: 115, lungeSpeed: 360, lungeEvery: 2.4, hp: 1, score: 75, color: PALETTE.dasher },
  splitter: { radius: 20, speed: 56, hp: 3, score: 150, color: PALETTE.splitter },
  spitter: { radius: 14, speed: 72, hp: 2, score: 100, color: PALETTE.spitter, shotEvery: 2.3, boltSpeed: 185 },
  herald: { radius: 44, speed: 34, hp: 42, score: 2000, color: PALETTE.herald, burstEvery: 3.1, spawnEvery: 6.0 },
};

/** Enemy bolts (spitter shots and the herald's radial bursts). */
export const BOLT = { radius: 6, speed: 185 };

/** Pickups dropped by burning enemies. chance is per kill, rolled once. */
export const PICKUP = {
  kindling: { chance: 0.55, radius: 8, score: 10, life: 9 },
  heart: { chance: 0.035, radius: 11, life: 12 },
  shield: { chance: 0.05, radius: 11, life: 10, duration: 8 },
  rapid: { chance: 0.06, radius: 11, life: 10, duration: 8 },
  nova: { chance: 0.045, radius: 11, life: 10 },
};

/** Combo: kills chained inside the window raise the multiplier, one step per 5. */
export const COMBO = { window: 2.5, perStep: 5, max: 8 };

/** Nova bomb: stock at the start, and the waves that grant one more. */
export const NOVA = { startStock: 1, grantWaves: [4, 7, 10], damage: 5 };

/** Seconds of calm between waves, and the warning ring before a spawn. */
export const WAVE = { breather: 2.6, spawnWarn: 0.55, spawnInterval: 0.7 };

/**
 * The wave table. Each wave lists how many of each kind arrive; the spawner
 * deals them out one at a time from the field's edges. Wave 10 is the herald
 * alone, with wisps trickling in behind it.
 */
export const WAVES = [
  { wisp: 8, dasher: 0, splitter: 0, spitter: 0, herald: 0 },
  { wisp: 12, dasher: 3, splitter: 0, spitter: 0, herald: 0 },
  { wisp: 12, dasher: 5, splitter: 2, spitter: 0, herald: 0 },
  { wisp: 14, dasher: 6, splitter: 3, spitter: 2, herald: 0 },
  { wisp: 16, dasher: 8, splitter: 4, spitter: 3, herald: 0 },
  { wisp: 18, dasher: 9, splitter: 5, spitter: 4, herald: 0 },
  { wisp: 18, dasher: 11, splitter: 6, spitter: 5, herald: 0 },
  { wisp: 20, dasher: 12, splitter: 7, spitter: 6, herald: 0 },
  { wisp: 22, dasher: 14, splitter: 8, spitter: 7, herald: 0 },
  { wisp: 0, dasher: 0, splitter: 0, spitter: 0, herald: 1 },
];

/** Particle and feedback tuning. */
export const FX = {
  emberCount: 70,
  burstParticles: 16,
  hitShake: 7,
  deathShake: 14,
  novaFlash: 0.5,
  floatTextLife: 0.9,
};
