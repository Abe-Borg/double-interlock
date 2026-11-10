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
- `node test/ui.c2.js out.png` runs the Cycle 2 UI checks (Playwright): the Site gate, both P reset paths,
  dead panel, stage order, mechanical release, impairment tag. Run it after any change to `ui.js`,
  `inspect.js` or the release logic. `STANDALONE=1` in front of either browser test uses the built file.
- `node review/truth-table-check.js` prints the release truth table against the engine, row by row.
- `node test/shot.js <scenario|menu> out.png "<js>"` loads the page, optionally runs JS, screenshots.

## Architecture

Everything hangs off one global, `DI`. Each file starts with
`var DI = globalThis.DI || (globalThis.DI = {});` so the engine files also load under Node with `require`.
Load order is the script order in `index.html`.

Engine (no DOM, testable in Node): core, juris, data, world, solver, systems, graph, links, gas, fire,
alarm, sim, calc, review, proc, scen, scen1-3. Front end: manual, audio, glyphs, render, inspect, ui, input, main.

- `DI.World` is the map. Any topology change must bump `W.ver`; `Sim.step` then calls `sync()`.
- `DI.Sim` owns dynamic state. `S.ss` is per system valve: `state` is `dry | filling | wet`.
  Changing a drain, test valve or anything that adds or removes an outlet needs `S.touch()` (graph rebuild).
- Tick order in `Sim.step`: fire -> alarm -> gasPre (trip logic) -> controllers -> build/refresh graph ->
  solve -> readback -> account -> gasPost (fill) -> fireWater -> test procedures.
- The solver sees a reduced graph. Untripped dry systems are not in it at all; their pressure is `s.P`.
- Units everywhere: psi gauge, gpm, gallons, feet, seconds. One tile = 10 ft. Gas is `G = P_abs * V`.
- `W.cfg` holds the site / project settings and is saved with the world: `edition`, `nfpa76Adopted`,
  `pipeCut`, `detThr`, `spotThr`, `sigClass`, `fitPct`, `trimGal`, `insurer`, `manualReleaseBypassP`.
  Read them through the helpers (`DI.setJuris`, `DI.pipeCut`, `DI.detThr`, `DI.spotThr`, `DI.sigClass`,
  `DI.cfgNum`, `DI.insurer`), which supply the defaults. A settings change must bump `W.ver`.
  `DI.juris` is the active edition row; `Sim.sync()` and `DI.review()` refresh it from the world.
- The front end writes `W.cfg` in one place only, `ui.siteSet`, and it refuses outside the sandbox: in a
  contract the Site dialog is read-only. A contract fixes settings with an optional `cfg` object on the
  scenario, merged by `DI.buildScenario(sc)` (which `startScenario`, the tests and the campaign all use).
  `S.contract` is true outside the sandbox; `S.live` is true in it.
- `S.acts` is the operator log (`S.act(kind, id)`): incidents, silence, find-head, close-valve, drain,
  replace-head, restore-air, reset-trim, reset-panel. Most entries are edge-detected in `gasPre` and
  `controllers`, so they are recorded whoever acted (UI, bot or test). `DI.recoveryScore` reads it.

## Company locks (do not relax these without a Lead decision)

- Wet, dry and double-interlock preaction only. There is no release mode on `prev`.
- Preaction trip (`gas.js`): `(sol OR pull) AND pLatch`, read through `DI.relState(W, v)`. `sol` = D
  latched by the panel (Fire 1 or higher, a level check; it is not the solenoid output), `pull` = the
  manual station typed DETECTION (a wired `mstn` device, or the sandbox shortcut button), `pLatch` = pipe
  pressure fell below `pTrip`. `solOut` is the energized solenoid: `D AND P` on el-el, `D` alone on
  el-pn. The source of truth is `fixtures/di-release-truth-table.csv` (FA Lead, R01 to R17): the test
  reads the file, so never copy its rows into a test. Low and high air (`loAir`, `hiAir`) are
  supervisory only and must never feed the trip logic.
- Reset model: `pLatch` clears only in `DI.panelReset` on an el-el trim and in `DI.resetTrimP` on an
  el-pn trim. `DI.resetValve` (the riser reset) closes the clapper and `mech` and never clears it. A
  panel reset never closes a tripped valve. The P sensor is live from the first time a valve is set
  (`s.armed`), so an early reset relatches while the pipe is below `pTrip`.
- A latched P is never signalled as supervisory: its class is `DI.sigClass(W, 'pLatch')`, one of OPEN
  (default, "release input, class not elected"), ALARM or TRBL. Alert and Action are SUPV or ALARM.
- `mech` (mechanical emergency release at the trim) trips the valve directly, outside the panel logic.
- Only `DI.FIRE1` releases. Alert never arms; Fire 2 is never read as a release input.
- Panel failure never releases water: no code path may set `sol`, `pull` or `mech` from `W.power`. A
  missing or dead panel forces `sol` and `pull` false in `alarmStep`.
- Hazen-Williams C is `DI.pipeC()` = 100 for every pipe. No nitrogen credit, no indoor / outdoor split.
- Per-valve setpoints come from the maker trim presets in `DI.TRIMS`. Order: `hiAir > airSet > loAir >
  pTrip`; review fails any other order.
- Water delivery is judged on full zone volume (`DI.zoneVolume`: pipe + fittings % + trim gal), never on
  `inf.vol` alone. Dry: 60 s timed test above 500 gal, 750 gal with a QOD. Double interlock: above
  500 gal, and a QOD does not extend it. FM (insurer setting, default none) adds 30 s at any volume; the
  most stringent limit governs. Use `DI.deliveryRule` / `DI.deliveryLimits`; the numbers live in
  `DI.DELIVERY` and the citations in `DI.juris.ref` (`timedTest`, `noQod`, `qod`, `table`, `di`).
- Label a value the Leads did not fix as ASSUMED in the UI and manual and keep it tunable. Label an open
  engineering choice NEEDS PE REVIEW, and a section number or value not yet checked against the edition
  VERIFY. The register of all three is in README.md and the manual's Site page.
- `test/sim.test.js` holds the acceptance checks for all of the above plus static greps on `src/`.

## Conventions

- Scenario = entry in `DI.SCEN` with `build(W)`, `goals[{t, ok(S), hint}]`, `drill{steps, judge}`.
  Goals are pure predicates on live state; use the helpers in `DI.G`.
- Every contract must stay winnable with the default site settings. If you change costs, hydraulics,
  fire, timing or the release / reset logic, rerun `test/campaign.test.js`: it plays each contract with
  the layouts in `test/bot.js` and an operator bot that restores systems in the scored recovery order.
  Add a layout there for any new contract. The FM what-if at the end of its output is informational.
- Plan review findings carry a code reference built with `DI.ref13()` or `DI.juris.ref.*`, so they follow
  the site's enforced edition (2019 / 2022 / 2025). Keep references at section level unless the exact
  paragraph has been verified, and add edition-specific section numbers only to the table in `juris.js`.
- Player-facing numbers come from the tables in `core.js`, `juris.js` and `data.js`; do not hard-code them
  elsewhere. Read a tile's pipe (inside diameter, volume, cost, schedule) with `DI.pipeAt(W, k)`, never
  `DI.PIPES[..].id` directly: the schedule depends on the project's size cut (`W.cfg.pipeCut`).
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
- After any repair on a preaction system P is still latched. A scenario, bot or test that then raises
  detection floods the system unless it restores the air and then resets P for that trim (`test/bot.js`
  does). A trip test on `prev` sets `sol` directly and needs a live wired panel, or `alarmStep` drops it
  out again; it is refused while P is latched, because the timed test starts from normal air.
- After a riser reset the pipe is empty, so P is (or goes) latched until the air is back. Code that
  resets a tripped preaction valve must follow with the panel or trim reset once the valve is set.
- An aspirating detector raises one signal per stage reached (`v<id>.<stage>`); the stages below the
  highest carry `sup` (superseded) and must be skipped wherever active signals are counted.
- After one open head trips a dry or preaction system, dead-end branches trap air and the system stays
  `filling`, short of `wet`. Do not wait for `wet` in a test or a goal.
- The toolbar is two rows in the sandbox and contract 7. `ui.fitPanels` keeps the inspector above it; a
  Playwright click on an inspector button still needs the button scrolled into view first.
- `World.fromJSON` migrates old saves (`DI.migratePart`): it drops `mode`, loads the el-el preset where
  setpoints are missing and flags the valve so `Sim.restore` re-pressurizes it. Extend that function
  when part props change.
