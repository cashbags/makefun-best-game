# Emberfall — checks

## Local checks (2026-11-16)

- [x] World simulation: 6/6 scenarios pass (`/tmp/test-world.mjs`) — play,
      determinism, end, win, title, full-game win.
- [x] Syntax: `node --check` passes on all 9 `game/src/*.js` files.
- [x] Screenshots: 4 real browser captures, all `ready`, no page errors,
      all 1280x720, all under 256 KiB (43,345 / 23,220 / 37,413 / 41,672 B).
- [x] Entrypoint: `main.ts` runs twice, outputs byte-identical
      (`diff -r` clean), `dossier.json` written.
- [x] No network: every reference in `game/` is a local file or a `data:`
      URI; the game loads no library, no font, no sound file, no image.
- [x] Kit check: `node cli/makefun.mjs check --kit . --repo <repo>
      --transcripts transcripts.tar.gz` — see the kit check output for the
      final count (run after bundling).

## Gate limits (from the kit)

- game/: 10 files, well under the 993-file / 48 MiB caps; index.html under
  1 MiB.
- screenshots/: 4 files, each under 256 KiB; long side 1280, short side 720.
- dossier.json: written by the vendored `buildDossier`, under 1.5 MiB.
- LICENSE: MIT at the repository root.
- Repository: created 2026-11-15T20:07:27Z, after the competition opened
  (2026-11-15T18:00:00Z), public under cashbags.
