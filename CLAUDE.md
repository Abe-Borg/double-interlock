# Double Interlock: notes for working on this code

A browser sim game about data center fire protection. Vanilla JS, no build step, no dependencies.
Read README.md first for what the game is.

## Run and test

- Open `index.html` (loads `src/*.js` as plain scripts, works from `file://`).
- `node build-standalone.js` regenerates `double-interlock.html`. Do this after any change in `src/`.
- Run all of these before calling a change done:
  `node test/solver.test.js && node test/graph.test.js && node test/sim.test.js && node test/proc.test.js && node test/campaign.test.js`
- `node test/ui.play.js out.png` plays contract 1 with real mouse events (Playwright). It has caught
  bugs the headless tests cannot (state created by incremental building).
- `node test/shot.js <scenario|menu> out.png "<js>"` loads the page, optionally runs JS, screenshots.

## Architecture

Everything hangs off one global, `DI`. Each file starts with
`var DI = globalThis.DI || (globalThis.DI = {});` so the engine files also load under Node with `require`.
Load order is the script order in `index.html`.

Engine (no DOM, testable in Node): core, data, world, solver, systems, graph, links, gas, fire, alarm,
sim, calc, review, proc, scen, scen1-3. Front end: manual, audio, glyphs, render, inspect, ui, input, main.

- `DI.World` is the map. Any topology change must bump `W.ver`; `Sim.step` then calls `sync()`.
- `DI.Sim` owns dynamic state. `S.ss` is per system valve: `state` is `dry | filling | wet`.
  Changing a drain, test valve or anything that adds or removes an outlet needs `S.touch()` (graph rebuild).
- Tick order in `Sim.step`: fire -> alarm -> gasPre (trip logic) -> controllers -> build/refresh graph ->
  solve -> readback -> account -> gasPost (fill) -> fireWater -> test procedures.
- The solver sees a reduced graph. Untripped dry systems are not in it at all; their pressure is `s.P`.
- Units everywhere: psi gauge, gpm, gallons, feet, seconds. One tile = 10 ft. Gas is `G = P_abs * V`.

## Conventions

- Scenario = entry in `DI.SCEN` with `build(W)`, `goals[{t, ok(S), hint}]`, `drill{steps, judge}`.
  Goals are pure predicates on live state; use the helpers in `DI.G`.
- Every contract must stay winnable. If you change costs, hydraulics, fire or timing, rerun
  `test/campaign.test.js`: it plays each contract with the layouts in `test/bot.js` and an operator bot.
  Add a layout there for any new contract.
- Plan review findings carry a code reference. Keep references to NFPA 13-2025 at section level unless
  the exact paragraph has been verified.
- Player-facing numbers come from the tables in `core.js` and `data.js`; do not hard-code them elsewhere.
- UI text: plain, specific, no exclamation marks. Explain the why in one sentence.

## Pitfalls already hit

- Coarse time steps: anything with a pressure switch (jockey, compressor) overshoots on a large `dt`
  unless it is clamped the way a regulator would. Long skips set `S.coarse` and freeze hydraulics.
- `findSystems` assigns tiles to the first valve that reaches them. Adjacent mains join automatically,
  so two systems side by side need a capped joint (`W.cut`) or a wall between them.
- When piping is added to a live system, `sync()` rescales gas at constant pressure. Never scale by a
  ratio of volumes: a new valve starts with zero volume.
- Fire department dispatch is suppressed outside drills and sandbox (`S.live`) and while a test runs.
- The inspector panel rebuilds only when its signature changes and acts on mousedown, because the DOM
  is replaced under the cursor.
- Files written through a quoted heredoc contain literal `’` escapes; match on those when patching.
