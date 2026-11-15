# Emberfall — tests

How the entry was verified, and what each check proves. Run from the entry
directory with the Node 22 binary at `~/workspace/makefun/node22/bin/node`.

## World logic (node, no DOM)

`node /tmp/test-world.mjs` imports `game/src/world.js`, `autopilot.js` and
`shots.js` and simulates the four screenshot scenes plus a full game:

- play scene (seed 7): 26+ seconds of strong play, score 5,950, wave 3,
  3 hearts, still playing. Proves the loop runs, the pilot scores, and the
  player survives the early waves.
- determinism: the same seed stages the same play scene twice, and the
  snapshots match byte for byte. Proves `?seed=N` replays the same game.
- end scene (seed 7): the weak pilot dies on wave 4, score 10,565, game over.
  Proves losing is reachable and the end screen has a real score.
- win scene (seed 7): the strong pilot beats the herald, score 2,100,
  victory. Proves winning is reachable and the win screen is real.
- title scene: attract mode idles with 6 wandering wisps, no deaths.
- full game (seed 11): the strong pilot wins all 10 waves in 8,696 steps
  (~145 s), score 180,860. Proves the whole game is winnable by competent
  play, so the win condition is not decorative.

All six checks passed on 2026-11-16, after the spawn-group and speed tuning.

## Syntax

`node --check` on every `game/src/*.js` file: all pass. `main.ts` and
`serve.ts` type-check by running: `node main.ts` and `node serve.ts` start
cleanly (see below).

## Browser playtest (real Chromium, headless)

`node tools/shots.mjs http://localhost:8903` serves `game/` with `serve.ts`
and captures the four screenshots in headless Chromium (playwright-core,
Chromium Headless Shell). Each shot waits for `window.__shotReady`, so the
frame is the staged scene, not a half-painted page. All four reported
`ready`, no page errors, no console errors:

- 1-start.jpg — title screen, EMBERFALL, instructions, wandering wisps.
- 2-play.jpg — wave 3, score 5,950, COMBO x7 (32), 3 hearts, NOVA stock,
  enemies converging, kindling and shield pickups visible.
- 3-end.jpg — THE FLAME DIES, score 10,565, wave 4, restart prompt.
- 4-win.jpg — DAWN BREAKS, score 2,100, +2000 herald-kill text, restart.

Each file was read back from disk and inspected visually (dimensions
1280x720, all under the 256 KiB cap). The shots are real renders of the
game's own code in a browser, never edited or composited.

## Entrypoint determinism

`main.ts` was run twice into two output directories; the trees were compared
with `diff -r` and are byte-identical, including `dossier.json`. The grader
runs the program twice and requires the same bytes; this is that check, run
locally.

## Bugs found and fixed during testing

- `render.js` drew enemies with `def.color` where `def` was the enemy
  itself, not its kind definition: `addColorStop` threw on `undefined` and
  no screenshot ever became ready (each waited the full 60 s timeout).
  Fixed by reading the colour from `ENEMY[enemy.kind]`.
- `main.js` passed a random generator object to `createWorld(seed)`, so the
  browser always played seed 0 and `?seed=N` did nothing. Fixed by passing
  the seed number itself.
- The first play scene landed in a wave breather with an empty field and a
  wave banner over the action. Fixed by staging the play scene until the
  field holds 7+ live enemies, 3 of them close to the keeper, with no
  banner up.
- The field ran dry mid-wave because the pilot killed faster than single
  spawns arrived. Fixed by dealing each wave in groups (1 in wave 1, up to
  4 in the late waves) and a shorter spawn interval.
