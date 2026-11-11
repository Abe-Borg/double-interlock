# Double Interlock: notes for working on this code

A browser sim game about data center fire protection. Vanilla JS, no build step, no dependencies.
Read README.md first for what the game is.

## Run and test

- Open `index.html` (loads `src/*.js` as plain scripts, works from `file://`).
- `node build-standalone.js` regenerates `double-interlock.html`. Do this after any change in `src/`.
- Run all of these before calling a change done (`npm test` is the same line):
  `node test/solver.test.js && node test/graph.test.js && node test/sim.test.js && node test/proc.test.js && node test/campaign.test.js`
- `node test/ui.play.js out.png` plays contract 1 with real mouse events (Playwright). It has caught
  bugs the headless tests cannot (state created by incremental building).
- `node test/ui.c2.js out.png` runs the Cycle 2 UI checks (Playwright): the Site gate, both P reset paths,
  dead panel, stage order, mechanical release, impairment tag. Run it after any change to `ui.js`,
  `inspect.js` or the release logic. `STANDALONE=1` in front of any browser test uses the built file.
- `node test/ui.c3.js out.png` runs the Cycle 3 UI checks (Playwright): the Manual Release zone path, a dead
  panel, the head gate, the recovery checklist and the reopen gate, the 24 h air test, loss of supply air and
  the water-filled zone, the detector model and the NFPA 76 ceilings. Run it after the same kinds of change.
- `node test/ui.c4.js out.png` runs the Cycle 4 UI checks (Playwright): the cause-and-effect matrix, the NFPA 76
  check, the refill clock and "Skip the refill", the reopen gate in both modes, the impairment tag and the
  supervising-station timing. Run it after a change to `cause.js`, `ui.js`, `inspect.js` or the alarm timing.
- `node test/ui.c5.js out.png` runs the Cycle 5 UI checks (Playwright): the hook triggers and the NFPA 72 edition
  row, the signal schedule dialog, the DACT channel fault, the sizing fail and the two fill rows, the recovery
  wording and the practice reopen note, the return-to-normal step, and save / load with utility power off. Run
  it after the same kinds of change, and after a change to `Sim.dump` / `Sim.restore` or `World.toJSON`.
- `package.json` exists for the scripts only (`npm test`, `npm run test:ui`). `npm install` is needed only for
  the browser tests: Playwright is the single devDependency. The game has no runtime dependencies and must
  keep loading from `file://`.
- `node review/truth-table-check.js` prints the release truth table against the engine, row by row.
- `node test/shot.js <scenario|menu> out.png "<js>"` loads the page, optionally runs JS, screenshots.

## Architecture

Everything hangs off one global, `DI`. Each file starts with
`var DI = globalThis.DI || (globalThis.DI = {});` so the engine files also load under Node with `require`.
Load order is the script order in `index.html`.

Engine (no DOM, testable in Node): core, juris, data, world, solver, systems, graph, links, gas, fire,
alarm, cause, sim, calc, review, proc, scen, scen1-3. Front end: manual, audio, glyphs, render, inspect, ui, input, main.

- `DI.World` is the map. Any topology change must bump `W.ver`; `Sim.step` then calls `sync()`.
- `DI.Sim` owns dynamic state. `S.ss` is per system valve: `state` is `dry | filling | wet`.
  Changing a drain, test valve or anything that adds or removes an outlet needs `S.touch()` (graph rebuild).
- Tick order in `Sim.step`: fire -> alarm -> gasPre (trip logic) -> controllers -> build/refresh graph ->
  solve -> readback -> account -> gasPost (fill) -> fireWater -> test procedures.
- The solver sees a reduced graph. Untripped dry systems are not in it at all; their pressure is `s.P`.
- Units everywhere: psi gauge, gpm, gallons, feet, seconds. One tile = 10 ft. Gas is `G = P_abs * V`.
- `W.cfg` holds the site / project settings and is saved with the world: `edition`, `ed72`, `nfpa76Adopted`,
  `pipeCut`, `detThr`, `spotThr`, `asdModel`, `sigClass`, `fitPct`, `trimGal`, `insurer`,
  `manualReleaseBypassP`, `commPath`, `acDelayMin`, `hvacHook`, `epoHook`. Read them through the helpers
  (`DI.setJuris`, `DI.ed72`, `DI.ref72`, `DI.pipeCut`, `DI.detThr`, `DI.spotThr`, `DI.asdModel`, `DI.asdRange`,
  `DI.sigClass`, `DI.inClass`, `DI.cfgNum`, `DI.insurer`, `DI.commPath`, `DI.commDelay`, `DI.acDelay`,
  `DI.hvacHook`, `DI.epoHook`), which supply the defaults: nothing is written into `W.cfg` until a setting is
  changed. A settings change must bump `W.ver`. An old save may still carry `n76AlarmStage`, or `hvacHook`
  `'crah'` / `'damper'` (read as the Fire 1 trigger).
  `DI.juris` is the active edition row; `Sim.sync()` and `DI.review()` refresh it from the world.
- `W.power` (utility power) is saved with the world too (`toJSON` / `fromJSON`; a save without the field reads
  on). Plant props added in Cycle 5: a compressor's `cutOut` (psi, 0 = none, a sizing input only) and a panel's
  `chan` (the two DACT channels, `[1, 1]` = both up; `chanT` is when the second one failed). `DI.migratePart`
  fills them on an old save, and `World.addPart` gives every panel its own `chan` array.
- The front end writes `W.cfg` in one place only, `ui.siteSet`, and it refuses outside the sandbox: in a
  contract the Site dialog is read-only. A contract fixes settings with an optional `cfg` object on the
  scenario, merged by `DI.buildScenario(sc)` (which `startScenario`, the tests and the campaign all use).
  `S.contract` is true outside the sandbox; `S.live` is true in it.
- `S.acts` is the operator log (`S.act(kind, id)`): incident, head-open, det-latch, trip, zone-filled,
  silence, find-head, close-valve, isolate-air, supply-open, drain, drain-zero, drain-close, replace-head,
  reset-valve, restore-air, reset-trim, reset-panel (`det: true` when D or the zone was latched),
  in-service, open-valve, reopen-warn (`items`), reopen-flood, return-normal. Most entries are edge-detected in `gasPre` and `controllers`, so they are recorded
  whoever acted (UI, bot or test). `DI.recoveryScore` reads it. It is capped at `DI.ACTS_MAX`; `DI.trimActs`
  drops closed history first and never the opening `incident` entry of an open incident.
- A control valve is operated through `DI.setGate(S, id, want)` (inspector button, reference bot). It holds
  the reopen gate, and only a reopening that went through it logs `open-valve`. Setting `p.target` directly
  is test scaffolding and bypasses the gate. The gate refuses in one place only, the scored incident of a
  running drill (`DI.drillIncidentOpen`); anywhere else it opens, logs the warning and a `reopen-warn` act
  with `DI.openItems`.
- `S.sig` entries carry `mon` (wired to a live panel), `delay` and `tx` (the supervising station has it:
  `mon` and the delay has run; a delay of `Infinity` can never be sent), `reg` (the registry key), `fd`
  (an alarm of the fire-department dispatch list) and `cut` (the panel is alive but both its DACT channels are
  down: annunciated, never transmitted, and no dispatch from it). "Seen by the station" is `o.mon && o.tx`.
  `DI.impairments(S)` is a separate, display-only list (riser tags): it is never added to `S.sig`.
- `Sim.dump` saves `sig` (`t0`, `tx`, `test` per active signal) and `Sim.restore` puts them back after its
  settle, so delay clocks carry across a load and nothing is announced twice. `restore` calls `commission`,
  which steps the sim on a clock that starts at 0 and rebuilds `S.sig`: anything time-based must be restored
  after it. That settle is not game time: `S.settling` holds every panel battery so a nearly flat one cannot die
  inside it and drop its latches. Signals that only reappear once the clock is right find their old entry in
  `S.sigSeen`, which `alarmStep` drops after its first run. A save with no `sig` loads as it always did.
- `DI.Sim.prototype.warp(sec, maxMs, until)` and `DI.skip(sec, until)` take an optional stop predicate (the
  "Skip the refill" button). It is the same time-skip as the clock menu.

## Company locks (do not relax these without a Lead decision)

- Wet, dry and double-interlock preaction only. There is no release mode on `prev`.
- Preaction trip (`gas.js`), read through `DI.relState(W, v)`:
  `release = (D AND P) OR (Bypass9c AND ManualReleaseZone AND trim is el-el)`, with `D = sol OR pull` and
  `P = pLatch`. `sol` = D latched by the panel (Fire 1 or higher, a level check; it is not the solenoid
  output), `pull` = the manual station typed DETECTION (a wired `mstn` device, or the sandbox shortcut
  button), `pLatch` = pipe pressure fell below `pTrip`. `mrzL` = the Manual Release zone's own latch: set
  only by a station typed MANUAL RELEASE (flag ON on el-el), never part of D, forced false everywhere else,
  cleared by a panel reset. `solOut` is the energized solenoid: the release on el-el, `D` alone on el-pn.
  Low and high air (`loAir`, `hiAir`) are supervisory only and must never feed the trip logic.
- Fixtures in `fixtures/` are copied verbatim from the Lead who owns them and are never edited or reformatted
  here. `test/truth-table.js` pins the sha16 of the truth table; to take a new Lead file, copy it byte for
  byte and update the pin in the same commit. If the engine and a fixture disagree, stop and ask: do not
  change the file. The test reads the file (FA Lead, R01 to R17) and checks it against its own release
  formula at load, so never copy its rows into a test.
- Reset model: `pLatch` clears only in `DI.panelReset` on an el-el trim and in `DI.resetTrimP` on an
  el-pn trim, plus one case that is not a reset: an el-el valve whose panel is dead holds no latch (it
  lives in panel memory) and reads P again when power returns. `DI.resetValve` (the riser reset) closes
  the clapper and `mech` and never clears it; it works with the system drain open and leaves the drain as
  it is. A panel reset never closes a tripped valve. The P sensor is live from the first time a valve is
  set (`s.armed`), so an early reset relatches while the pipe is below `pTrip`.
- A dead panel (`pn.p.alive === false`) cannot be reset or silenced: `DI.panelReset` and `DI.silence` return
  `DI.PANEL_DEAD_MSG`, change nothing and log nothing. Its own signals carry `dark` (not listed, not
  sounded); the supervising station's `lost` signal is listed on its own line.
- One recovery sequence, `DI.RECOVERY` (13 steps), in the FP Lead's physical order. After a trip the riser
  reset comes before the air, with the drain still open; the drain is closed afterwards. Only the c5 drill
  incident is scored (`DI.drillRecovery`); every other recovery is practice and no goal may read the score.
- Head replacement on a dry or preaction system goes through `DI.headSafe`: control valve closed, air / N2
  supply isolated, pipe water-free at `DI.SAFE_PSI` or less. "Drain closed" is not a condition.
- Air out an open drain is air. The system drain is a water emitter only while water is at it
  (`DI.dryLim`); nothing may count air as gpm, gallons or waterflow.
- A latched P is never signalled as supervisory: its class is `DI.sigClass(W, 'pLatch')`, one of OPEN
  (default, "release input, class not elected"), ALARM or TRBL. Alert and Action are SUPV or ALARM.
- One registry for every signal: fixed classes live in `DI.SIG_FIXED` (24 keys), elected ones in
  `DI.SIG_CLASS`. `add(key, regKey, ...)` in `alarmStep` takes the registry key, never a class, and reads the
  class in one place with `DI.inClass`; A44 fails a literal class. A new signal needs a key in the registry and
  a row in `DI.SIG_META` (label and tag for the signal schedule).
- Fire-department dispatch reads the registry, not the class: only a key in `DI.SIG_FD` (fire1, fire2, manual,
  mrz, waterflow, spot) dispatches. Alert, Action and a latched P never dispatch by themselves, even elected
  ALARM, and the release circuit (`rl`) is an output. Supervisory and trouble go to the supervising station
  only. `DI.signalSchedule(W)` is generated from the same registry; its dialog text lives in `cause.js`
  (`DI.SCHED_*`), never in `ui.js`.
- Loss of supply air is TRBL (PRACTICE, FA Lead): do not make it supervisory. The
  cause-and-effect matrix is generated from `DI.ceEval` (classes from `DI.inClass`, the release from
  `DI.relState` on the zone's real trim and bypass); if the matrix and the engine or the fixture disagree, fix
  the engine or ask: do not hand-edit the table. Table text comes from `DI.ceMatrix` only, never from `ui.js`.
  `DI.panelHolds` is the one copy of "what a dead panel holds" outside the engine, and A42 / A43 guard it.
- Hooks (`hvacHook`, `epoHook`) are hook only, never automatic: displayed in the matrix, and the engine never
  reads them. Only `cause.js`, `ui.js` (Site dialog, `siteSet`), `manual.js` and the tests may name them.
  `hvacHook` is the trigger stage (`none | fire1 | fire2 | waterflow`), never Alert or Action; with `fire1`
  the manual station, Fire 2 and waterflow trip it too. EPO is on the waterflow row only, never a release or
  valve-open row, default OFF. Both are read from the row's input vector in `DI.ceEval`, not its outcome.
- DACT: `DI.DACT_CHAN_S` (240 s) is the channel-failure rule and `DI.COMM_PATH.dact.delay` (21,600 s) the test
  interval; both are CODE values. The 6 h annunciation of a missed test is ASSUMED. Failing a channel is a
  sandbox-only fault and never an input of D or P.
- An isolated air / N2 supply is an impairment tag (`DI.impairments`), not a signal: it must not reach `S.sig`
  or any `SS_*` column (the truth-table runner shuts `airValve` to make low air). Low air stays a pure
  pressure signal.
- Reopen gate: it refuses only during the scored incident of a running drill. Do not widen that to trip tests,
  sandbox incidents or an incident from before the drill. In practice the valve opens with the warning, and if
  water then leaves through an open head the log explains it once (`s.floodW`, the `reopen-flood` entry).
- Refill: `DI.REFILL_LIMIT` is 1,800 s in every edition. The code check is `DI.airSizing`: the largest zone on
  the supply filled alone from 0 psig (`tAlone`); `below` (under the bare minimum) is a review FAIL and `tight`
  (under the x1.25 margin, ASSUMED, NEEDS PE REVIEW) a warning. The sizing pressure is `DI.sizingP`: normal, or
  a compressor cut-out if higher; the normal-minus-3.2 "set" point is never a sizing basis. No reference build
  may gain a sizing fail or warning (A59).
- The measured clock is informational. No goal, review fail or drill result may be keyed to it, to
  `s.fillTime` (last refill) or to `s.fill1` (first fill; the one exception is the existing dock goal of
  contract 2): zones on a shared compressor fill at the same time here (`DI.PARALLEL_SPLIT`), so reference
  builds run over on commissioning. Clock and report text never say FAIL (`DI.refillText`, `DI.refillLine`).
- The contract 5 recovery rating (`DI.recoveryTier`, `DI.RECOVERY_TIERS`: 180 s / 300 s, ASSUMED) reads
  `opTime` (operator steps), never `refill`, and is a report line only: contract stars (`main.js`) do not
  read it.
- Supervising-station timing follows NFPA 72. Its citations are `DI.REF72`, keyed by the NFPA 72 edition, which
  is its own site setting (`W.cfg.ed72`; `DI.ed72(W)` / `DI.ref72(W)`; Auto follows the NFPA 13 row; a Canadian
  row ignores it). `DI.JURIS` rows carry no `ref72`. Timing:
  a dead panel is annunciated after `DI.commDelay(W)` (the `pd` signal is that event, text unchanged), an AC
  failure is at the panel at once and transmitted after `DI.acDelay(W)`, and low battery is a listed setpoint
  (`DI.PANEL_LOWBATT_FRAC`), not a code threshold: never write "2 h" in UI text. The status bar reads PANEL
  DEAD from the panel, not from the station line.
- `mech` (mechanical emergency release at the trim) trips the valve directly, outside the panel logic.
- Only `DI.FIRE1` releases. Alert never arms; Fire 2 is never read as a release input.
- Panel failure never releases water: no code path may set `sol`, `pull` or `mech` from `W.power`. A
  missing or dead panel forces `sol` and `pull` false in `alarmStep`.
- Hazen-Williams C is `DI.pipeC()` = 100 for every pipe. No nitrogen credit, no indoor / outdoor split.
- Per-valve setpoints come from the maker trim presets in `DI.TRIMS`. Order: `hiAir > airSet > loAir >
  pTrip`; review fails any other order.
- The 24 h air test is held at the greater of 40 psi or the zone's normal (`DI.airTestPsi`; company practice,
  NEEDS PE REVIEW), pass at a loss of `DI.AIR_TEST.drop` or less (`DI.airTestEnd`: 38.5 psi at 40). It starts
  at test pressure (charge stage, `DI.airTarget`) and never sets or clears P. Afterwards `s.ret` is the
  "return to normal set point" step (`DI.returnStep`): bleed at the trim (`DI.bleedToNormal`, which touches gas
  only, never a valve or a drain) or refill, then every condition in `gasPre` must hold. Practice only.
- The aspirating listed ranges are per model and per stage (`DI.ASD_MODELS`, datasheet values): show
  `DI.ASD_SRC` beside every range. Thresholds are never clamped, rounded or moved to fit. NFPA 76, where
  adopted, is two ceilings: Alert 0.2 and Fire 1 (the first alarm stage) 1.0 %/ft, PRACTICE, NEEDS PE REVIEW
  (`DI.n76Flags`, `DI.n76Note`). `DI.n76Check` only reads: nothing may write a threshold from them, and
  there is no stage election, OPEN chip or CONFLICT flag. VEA is recorded in `DI.ASD_RECORDED`, not a model.
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
  detection trips the valve and fills the pipe (a discharge if a head is open, a water-filled zone if every
  head is closed) unless it restores the air and then resets P for that trim (`test/bot.js` does). A trip test on `prev` sets `sol` directly and needs a live wired panel, or `alarmStep` drops it
  out again; it is refused while P is latched, because the timed test starts from normal air.
- After a riser reset the pipe is empty, so P is (or goes) latched until the air is back. Code that
  resets a tripped preaction valve must follow with the panel or trim reset once the valve is set.
- A test or bot that calls `DI.replaceSprinklers` on a `prev` or `dryv` must first close the control valve,
  set `airValve = 0` and let the pipe reach 0 psi, or it gets the `headSafe` message back. Tests that only
  need the head gone set `W.spk[k] = 1; S.spkVer++` (the `fixHead` helper).
- The recovery score reads an incident from its `incident` entry to `in-service` for what it involved and
  for steps 1 to 10; the closing steps may follow. Without that bound a later false alarm rewrites an old
  score.
- `drain-zero` is logged by `gasPre` one tick after the conditions hold. A bot that resets the valve on its
  own reading of the gauge gets ahead of the log and scores out of order: wait for `s.dz`.
- The 24 h air test has a charge stage (`stage === 0`) that counts as busy in `warp`; the hold stage does
  not. `warp(86500)` covers a test that needs no charge; add `DI.AIR_TEST.chargeMax` when it may.
- With `W.power = false` every dry and preaction zone raises `sa<id>` (loss of supply air) as well as the
  panel's `ac<id>`. Count signals by key, not by number of TRBL rows.
- An aspirating detector raises one signal per stage reached (`v<id>.<stage>`); the stages below the
  highest carry `sup` (superseded) and must be skipped wherever active signals are counted.
- After one open head trips a dry or preaction system, dead-end branches trap air and the system stays
  `filling`, short of `wet`. Do not wait for `wet` in a test or a goal.
- The toolbar is two rows in the sandbox and contract 7. `ui.fitPanels` keeps the inspector above it; a
  Playwright click on an inspector button still needs the button scrolled into view first.
- Two fills of the same zone from 0 psig by the same compressor take exactly the same time: a test that needs
  `s.fill1` and `s.fillTime` to differ must change something between them (A60 changes the compressor).
- The reference build of contract 5 has its largest zone still filling at the end of `sol.settle`: warp
  further before reading `s.fill1` or a finished fill row.
- The supervising station knows of a dead panel only `DI.commDelay(W)` after death: a test that reads
  `pd<id>` or a `lost` signal must first `S.warp(DI.commDelay(W) + 60)`. An `ac<id>` signal has `tx` false
  for `DI.acDelay(W)`. Advance time with `S.warp`, never by waiting.
- The truth-table runner (`test/truth-table.js`) holds the row's inputs through a time-skip on the rows that
  are not on AC and reads `SS_Trouble` after it. Its rig compressor has a generator-backed feed (`emerg`), so
  the Power column changes the panel's power only: without that, R12 carries a supply-air trouble at 60 s.
- A gate test that needs a refusal must mark a drill as running before the incident starts
  (`S.drill = { t0: S.t, done: false }`; in the browser add one spent step and a long `len`, or the drill
  runner trips over it during a skip).
- The refill clock also runs on a zone that lost its air without tripping (`s.rfill`): `s.set` stays true
  there, so do not use `!s.set` alone to mean "filling". Use `DI.refilling(S, id)`.
- In the contract 5 drill the false alarm comes at 2,100 s. A compressor slow enough to keep the incident zone
  below P trip until then changes the incident (3 scfm does; the slow-compressor test uses 3.8 scfm).
- Bleeding a zone through the 2 in. system drain drops about 2 psi per 0.1 s: a test must step at 0.02 s to
  stop at a pressure, and a player cannot. That is why the post-test step has `DI.bleedToNormal`.
- `World.fromJSON` migrates old saves (`DI.migratePart`): it drops `mode`, loads the el-el preset where
  setpoints are missing and flags the valve so `Sim.restore` re-pressurizes it. Extend that function
  when part props change.
