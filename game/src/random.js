// Emberfall — the seeded dice.
// One file, one job: every random choice in the game flows through one of these
// functions, so ?seed=N replays the same field, the same spawns and the same
// drops, and two runs with one seed are the same game.

/**
 * A mulberry32 generator: small, fast, and deterministic for a 32-bit seed.
 * The state advances on every call, so the order of calls is the game.
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** Next integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return this.next() < p;
    },
    /** One element of an array, uniformly. */
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
    /** A random angle in radians. */
    angle() {
      return this.next() * Math.PI * 2;
    },
  };
}
