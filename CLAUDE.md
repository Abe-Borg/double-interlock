# Double Interlock: notes for working on this code

A browser sim game about data center fire protection. Vanilla JS, no build step, no dependencies.
Read README.md first for what the game is.

## Run and test

- Open `index.html` (loads `src/*.js` as plain scripts, works from `file://`).
- `node build-standalone.js` regenerates `double-interlock.html`. Do this after any change in `src/`.
- Run all of these before calling a change done (`npm test` is the same line):
  `node test/solver.test.js && node test/graph.test.js && node test/sim.test.js && node test/proc.test.js && node test/campaign.test.js && node test/puzzle.test.js`
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
- `node test/ui.c6.js out.png` runs the Cycle 6 UI checks (Playwright): drain coaching and the Return to normal
  result, the AVC row / bypass / pick, the Site rows (hold and send, standby, generator, air refill order), the
  supervising station queue, the matrix footnote, the panel's battery rows and faults, the standby reference
  dialog, the practice reopen banner, the main drain tip and drill step 14. It saves one screenshot per new panel
  beside `out.png`. Run it after a change to `ui.js`, `inspect.js`, `cause.js`, the DACT queue, the battery or
  the return-to-normal logic.
- `node test/ui.c7.js out.png` runs the Cycle 7 UI checks (Playwright): the Finish return to normal button in
  every mode, its refusal and clean pass, the compressor picks and the AVC bypass tamper switch, the Site dialog
  (per-zone note, air refill order, the VEA model and its Fire 1 pick), the Refrigerated Space room toggle, the
  charger pick, RESTORAL and HAZARD CASE in the station queue, the main drain hint and "Check the valves
  upstream", and the drill report lines. Run it after a change to `ui.js`, `inspect.js`, `scen.js` (the report),
  the DACT queue, the return-to-normal logic or the detector model.
- `node test/ui.c8.js out.png` runs the Cycle 8 UI checks (Playwright): the NAC block on the panel (off by
  default, the FAIL and THIN cases, labels by edition, NEC 2026, the Canadian hold), the Site rows (NEC edition,
  owner / insurer refill target), the drill report (code check above measured, the shared note, the realism and
  other-drains lines), the neutral refill rows, Finish pressed three times, the compressor relief warnings, the
  Refrigerated Space and Telecom / MMR rooms with NFPA 76 by room, the latch label on the signal schedule, the
  station queue footnote on a 2019 site, INVESTIGATE, step 14 as company practice, and an old save with the NFPA
  76 flag on. Run it after a change to `ui.js`, `inspect.js`, `scen.js`, `review.js`, the NAC calculation, the
  NFPA 76 room logic or `World.fromJSON`.
- `node test/ui.puz.js out.png` runs the field call checks (Playwright): the menu and its lock order, the briefing, a
  hint, a repair with the Main tool and the flow test, the diagnosis, the scorecard and the three drawn fixes, Turn end
  for end, the Cap tool on a test blank, save / reload in a call, and the drill commissioning record. Run it after a
  change to `puz*.js`, `puzui.js`, `ui.js`, `inspect.js` or `main.js`.
- `sim.test.js` (A112) checks that `double-interlock.html` is what `build-standalone.js` makes from `src/` as it
  stands: build first, then test.
- `package.json` provides tests and desktop builds. Playwright and the Tauri CLI are development-only
  dependencies. The browser game has no runtime dependencies and must keep loading from `file://`.
  `npm run build` stages the self-contained HTML for Tauri. See `docs/windows-desktop.md` for native builds
  and releases. Run `npm run test:desktop` after desktop integration changes.
- `node review/truth-table-check.js` prints the release truth table against the engine, row by row.
- `node test/shot.js <scenario|menu> out.png "<js>"` loads the page, optionally runs JS, screenshots.

## Architecture

Everything hangs off one global, `DI`. Each file starts with
`var DI = globalThis.DI || (globalThis.DI = {});` so the engine files also load under Node with `require`.
Load order is the script order in `index.html`.

Engine (no DOM, testable in Node): core, juris, data, world, solver, systems, graph, links, gas, fire,
alarm, cause, sim, calc, review, proc, scen, scen1-3, puz, puz1-2. Front end: manual, audio, glyphs, render, inspect, ui,
puzui, input, main.

- `DI.World` is the map. Any topology change must bump `W.ver`; `Sim.step` then calls `sync()`.
- `DI.Sim` owns dynamic state. `S.ss` is per system valve: `state` is `dry | filling | wet`.
  Changing a drain, test valve or anything that adds or removes an outlet needs `S.touch()` (graph rebuild).
- Tick order in `Sim.step`: fire -> alarm -> gasPre (trip logic) -> controllers -> build/refresh graph ->
  solve -> readback -> account -> gasPost (fill) -> fireWater -> test procedures.
- The solver sees a reduced graph. Untripped dry systems are not in it at all; their pressure is `s.P`.
- Units everywhere: psi gauge, gpm, gallons, feet, seconds. One tile = 10 ft. Gas is `G = P_abs * V`.
- `W.cfg` holds the site / project settings and is saved with the world: `edition`, `ed72`, `nfpa76Adopted`,
  `pipeCut`, `detThr`, `spotThr`, `asdModel`, `sigClass`, `fitPct`, `trimGal`, `insurer`,
  `manualReleaseBypassP`, `commPath`, `acDelayMin`, `hvacHook`, `epoHook`, since Cycle 6 `dactHold` (stored
  only when false), `standby` (only when not `nfpa5`) and `panelGen` (only when true), and since Cycle 7
  `refillSeq` (only when true), and since Cycle 8 `ownerRefill` (minutes, only when a target is set) and `nec`
  (only when `'2026'`). `nfpa76Adopted` is now only the default for telecom rooms (`DI.n76Applies`).
  `refrigerated` is gone: `World.fromJSON` deletes it and leaves a note in
  `W.notes`, which `Sim.restore` logs once. Read them
  through the helpers (`DI.setJuris`, `DI.ed72`, `DI.ref72`, `DI.pipeCut`, `DI.detThr`, `DI.spotThr`,
  `DI.asdModel`, `DI.asdRange`, `DI.sigClass`, `DI.inClass`, `DI.cfgNum`, `DI.insurer`, `DI.commPath`,
  `DI.commDelay`, `DI.acDelay`, `DI.hvacHook`, `DI.epoHook`, `DI.dactHold`, `DI.standbyKey`, `DI.panelGen`,
  `DI.refillSeq`, `DI.isVea`, `DI.veaFire1`, `DI.veaFire1At`, `DI.n76Applies`, `DI.ownerRefill`, `DI.nec`), which supply the defaults: nothing is written into `W.cfg` until a setting is
  changed. A settings change must bump `W.ver`. An old save may still carry `n76AlarmStage`, or `hvacHook`
  `'crah'` / `'damper'` (read as the Fire 1 trigger).
  `DI.juris` is the active edition row; `Sim.sync()` and `DI.review()` refresh it from the world.
- `W.power` (utility power) is saved with the world too (`toJSON` / `fromJSON`; a save without the field reads
  on). Plant props added in Cycle 5: a compressor's `cutOut` (psi, 0 = none, a sizing input only) and a panel's
  `chan` (the two DACT channels, `[1, 1]` = both up; `chanT` is when the second one failed). `DI.migratePart`
  fills them on an old save, and `World.addPart` gives every panel its own `chan` array. Cycle 6 props, migrated
  the same way: a dry or preaction valve's `avc` (1 = an AVC is fitted, 0 = compressor direct) and `avcBy` (its
  bypass is open); a panel's `ah`, `iStby`, `iAlarm` (battery pick and ASSUMED loads), `chgFail`, `battDisc`, and
  the clocks `silT` (when it was silenced), `dnT` (when both DACT channels went down) and `dqNext` (next late send).
  Cycle 7 props, migrated the same way: every system valve's `wfL` (the waterflow alarm is latched at the panel);
  a dry or preaction valve's `avcTamper` (1 = the optional bypass tamper switch is fitted); a compressor's `maxPsi`
  and `relief` (0 = not modeled / none); a panel's `chgA` (charger amperes, 0 = matched to the battery). A room of
  type `cold` (named Refrigerated Space since Cycle 8; the type id is unchanged) may carry `below5` (true only;
  `toJSON` / `fromJSON` keep it). Cycle 8 props, migrated the same way: a panel's `nacOn` (0 = the NAC check is
  off, the default), `nacAwg`, `nacFt`, `nacN`, `nacCd`, `nacV` (0 = start voltage not given). A room of type
  `tel` may carry `n76` (true / false; absent = the site setting), and any room `f1` (the VEA Fire 1 pick of that
  room); `fromJSON` keeps both. `World.toJSON` writes `v: DI.SAVE_V` (8): `fromJSON` runs the NFPA 76 migration
  only on a save without it (the flag on: `DI.N76_MIGRATED` in `W.notes`, and on a VEA site with no stored pick
  0.5 is written as the site pick, `DI.N76_PICK_KEPT`).
- The front end writes `W.cfg` in one place only, `ui.siteSet`, and it refuses outside the sandbox: in a
  contract the Site dialog is read-only. A contract fixes settings with an optional `cfg` object on the
  scenario, merged by `DI.buildScenario(sc)` (which `startScenario`, the tests and the campaign all use).
  `S.contract` is true outside the sandbox; `S.live` is true in it.
- `S.acts` is the operator log (`S.act(kind, id)`): incident, head-open, det-latch, trip, zone-filled,
  silence, find-head, close-valve, isolate-air, supply-open, drain, drain-zero, drain-close, replace-head,
  reset-valve, restore-air, reset-trim, reset-panel (`det: true` when D or the zone was latched),
  in-service, open-valve, reopen-warn (`items`), reopen-flood (`gpm`), return-normal (`err`, and since Cycle 7
  `errs` = the error list, `aborted` when the valve tripped), since Cycle 6 alarm (one per new ALARM-class signal,
  the device as `id`), return-coach and main-drain-test (`stat`, `resid`, `q`, `pass`, `ts` = when the test started,
  and since Cycle 7 `drop` and, where there was a baseline, `base`), and since Cycle 7 restoral (the panel as `id`,
  `key`, `cls`), return-early (a refused Finish, `miss`, and since Cycle 8 `n` = the press number and `newErr`) and drop-check; since Cycle 8 return-normal also carries `presses`. Most entries are edge-detected in `gasPre` and `controllers`, so they are recorded
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
  Cycle 6: `had` (the station already had it before the path went down) and `q` (its entry in the DACT queue
  `S.dq`, where it has one). A signal with an entry is `tx` only once that entry is `SENT`. Cycle 7: `hold` on a
  waterflow signal kept by the panel latch alone (the flow is over): it starts no dispatch.
- `S.dq` is the DACT queue (`DI.dactStep`, called at the end of `alarmStep`): one entry per signal that came due
  with both channels down, `state` RETRY / HELD / SENT / DROPPED, `t0` the original event time (never changed),
  `tq` when the attempts started. Cycle 7 fields: `kind` ('rest' = a restoral entry; absent = a signal), `rs` (a
  restoral is owed after a late send), `rsT` (when it was sent), `why` on a DROPPED entry ('hold' or 'dead').
  `DI.restoralStep(S, old)`, called by `alarmStep` right after `S.sig` is replaced, logs live restorals and queues
  the 'rest' entries. `DI.stationQueue(S)` is its read-only view for the annunciator. Only `add()`
  and the dispatch block read `o.q`: release, the notification rule, the matrix and the hooks never read the
  queue (A80 counts the reads).
- `Sim.dump` saves `sig` (`t0`, `tx`, `test`, `had` per active signal) plus `dq`, `dqSeq` and `genT` (the outage clock the
  standby generator is timed from), and `Sim.restore`
  puts them back after its settle (`DI.dactStep` makes no entries and no `alarm` act is logged while
  `S.settling`), so delay clocks carry across a load and nothing is announced twice. `restore` calls `commission`,
  which steps the sim on a clock that starts at 0 and rebuilds `S.sig`: anything time-based must be restored
  after it. That settle is not game time: `S.settling` holds every panel battery so a nearly flat one cannot die
  inside it and drop its latches. Signals that only reappear once the clock is right find their old entry in
  `S.sigSeen`, which `alarmStep` drops after its first run. A save with no `sig` loads as it always did.
- `Sim.step` splits a step longer than `DI.RET_SUBSTEP` while `DI.retDrainOpen(S)` (a system drain letting air out of
  a zone in the return-to-normal step). The split sits before `this.t += dt` and the `coarse` return, and the
  pieces add up to `dt` exactly. Do not widen `retDrainOpen` to the main drain or to a pipe already at 0 psi: a
  multi-year skip with a drain left open would then run in 0.1 s pieces.
- `DI.Sim.prototype.warp(sec, maxMs, until)` and `DI.skip(sec, until)` take an optional stop predicate (the
  "Skip the refill" button). It is the same time-skip as the clock menu.

## Field calls (puzzles)

- `DI.PUZ` (puz.js) is the list; the calls are in puz1.js (1-4) and puz2.js (5-8). A call is `{ id: 'pN', n, name,
  kind, question, learn, w, h, parts, variants }`; a variant is `{ key, name, money, symptom, records, build(W, b),
  setup(S), area, hints: [[text, x, y] x 3], diag: { q, opts: [[text, ok, why]] }, goals, prove(S), cheap, maint,
  live?, impPar?, cfg? }`. `cheap` / `maint` are `{ t, steps, edit(W, b)?, op(S)?, lesson }`: `edit` changes the
  layout (the comparison applies it to a copy of the starting layout), `op` operates the live plant (tests only).
  `prove(S)` is what a player does to demonstrate the fix (run the flow test, the main drain test, thirty quiet
  minutes): the tests run it on the broken start and after each fix. `records` may be a function of the start state.
- `DI.puzScenario(id, vi)` turns a variant into an ordinary scenario object (`puzzle: true`, no drill, goals plus a
  diagnosis goal appended), so `DI.buildScenario`, the toolbar and the Site gate (read-only: `S.contract`) apply as in a
  contract. `DI.puzBuild` = build + `DI.puzInit`. Every variant must stay solvable with the default site settings, and
  each one must be broken at the start: `test/puzzle.test.js` plays all of them. Add a variant there by adding it to
  the list; the test picks it up.
- `S.puz` is the running call's state: `w0` (the starting layout as JSON), `rec`, `hints`, `diag`, `imp` (seconds out of
  service), `futile` / `resets` (panel resets made while `live(S)` held), `flags`. It is saved by main.js beside the world
  and the sim (`vi`, `puz` in the save record), never in `Sim.dump`; keys starting with `_` are caches and are not
  saved. `DI.puzTick` (the scenario's `tick`, called by the frame loop and the tests) runs the out-of-service clock.
  Panel resets are counted when they are made: `DI.panelReset` emits `panelReset` on the bus and puz.js judges it against
  `live(S)` at once (the frame loop does not tick while paused). The quiet-operation clock (`DI.quietFor`, scen.js) reads
  `S.lastAuto` and each fire pump's `lastRun`: `Sim.dump` saves `lastAuto` and `Sim.restore` puts both back after its
  settle, which stops every pump.
- Edits (`DI.puzDiff`) compare the layout with `w0`, one per changed thing: a pipe tile, a cap edge, a tubing tile, a
  part (added, removed, replaced, turned, or a key of `DI.PUZ_KEYS` changed), a wire (by tile positions). A tile with a
  part in either layout is judged as a part only. Operation (a valve position, a pump mode, resets, tests) is never an
  edit: keep operational props out of `DI.PUZ_KEYS`.
- "The station got it" is the `signal` bus event of a new waterflow signal that was transmitted at once
  (`DI.puzActive` is the running call's sim; `startScenario` clears it for a contract). A waterflow still latched from an
  earlier flow is not a new signal: reset the panel before the inspector's test.
- Scoring (`DI.puzScore`): stars = fix + (edits <= par and cost within `DI.PUZ_COST_SLACK` of the cheap fix) +
  (diagnosis first try, at most one hint, `imp` <= par, no futile reset). Par edits and cost come from the cheap fix.
  These numbers are game values, not code values.
- Two engine additions came with the calls: a control valve may carry `sw: 0` (no tamper switch fitted: no `tm`
  signal, costs `DI.TAMPER_SW_COST` less; `undefined` = fitted, as before), and `DI.gaugeText` shows a pressure below
  a full vacuum as -14.7 (full vacuum) in the pump test report, the pump inspector and the pipe tooltip (display only:
  the solver has no cavitation). The inspector's "Turn end for end" reverses an inline part (not a system valve) in
  place, free, as an undoable edit.
- Drills keep a commissioning record: `DI.startDrill(S, d, goals0)` stores the goals as they stood at the start
  (`DI.goalState`), and `main.js` reads `S.drill.goals0` instead of the live goals while a drill exists, so a passed
  drill is judged on what was proved before it. The campaign test checks the record holds every goal.

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
  Step 14, the main drain test (`DI.RECOVERY_DRAIN`, Fire Tutor), is appended by `DI.recoveryScore` only when it
  is called with `from` (the drill call): done by a `main-drain-test` act started at or after the control valve
  was back open, with both readings; a 10 percent drop adds a prompt, it never fails the step. The inspector
  checklist stays 13 numbered rows and shows "Drill step 14" as its own row in the scored incident. Cycle 8 (Fire
  Tutor correction): the step 14 label (`DI.RECOVERY_DRAIN[1]`) is the Tutor's, word for word: the main drain test
  there is company practice, and what NFPA 25 requires after a reopen is the valve status test. `DI.MDT_LINE`
  starts with "Company practice.", keeps the Tutor's procedure sentence, and its last sentence is ASSUMED wording:
  do not reword the first two parts. The NFPA 25 cites are `DI.REF25` (`passLine` is the Tutor's sentence, word
  for word); the code term is "full flow pressure". The phrase the Tutor withdrew (the 10 percent as a loose
  shop saying) must not come back anywhere in `src/`, README.md or this file (A115 greps for it).
- Head replacement on a dry or preaction system goes through `DI.headSafe`: control valve closed, air / N2
  supply isolated, pipe water-free at `DI.SAFE_PSI` or less. "Drain closed" is not a condition.
- Air out an open drain is air. The system drain is a water emitter only while water is at it
  (`DI.dryLim`); nothing may count air as gpm, gallons or waterflow.
- A latched P is never signalled as supervisory: its class is `DI.sigClass(W, 'pLatch')`, one of OPEN
  (default, "release input, class not elected"), ALARM or TRBL. Alert and Action are SUPV or ALARM.
- One registry for every signal: fixed classes live in `DI.SIG_FIXED` (28 keys since Cycle 7: `avcTamper`), elected ones in
  `DI.SIG_CLASS`. `add(key, regKey, ...)` in `alarmStep` takes the registry key, never a class, and reads the
  class in one place with `DI.inClass`; A44 fails a literal class. A new signal needs a key in the registry and
  a row in `DI.SIG_META` (label and tag for the signal schedule).
- Fire-department dispatch reads the registry, not the class: only a key in `DI.SIG_FD` (fire1, fire2, manual,
  mrz, waterflow, spot) dispatches. Alert, Action and a latched P never dispatch by themselves, even elected
  ALARM, and the release circuit (`rl`) is an output. Supervisory and trouble go to the supervising station
  only. `DI.signalSchedule(W)` is generated from the same registry; its dialog text lives in `cause.js`
  (`DI.SCHED_*`), never in `ui.js`.
- Loss of supply air is TRBL (PRACTICE, FA Lead): do not make it supervisory. The
  cause-and-effect matrix (21 rows since Cycle 7: the optional AVC bypass tamper) is design intent: no cell and no
  column shows live DACT state, and its last note is `DI.CE_DACT_NOTE`: the FA Lead's two sentences, then the
  Cycle 7 restore order and the hazard case (A80 pins the whole text). It is generated from `DI.ceEval` (classes from `DI.inClass`, the release from
  `DI.relState` on the zone's real trim and bypass); if the matrix and the engine or the fixture disagree, fix
  the engine or ask: do not hand-edit the table. Table text comes from `DI.ceMatrix` only, never from `ui.js`.
  `DI.panelHolds` is the one copy of "what a dead panel holds" outside the engine, and A42 / A43 guard it.
- Hooks (`hvacHook`, `epoHook`) are hook only, never automatic: displayed in the matrix, and the engine never
  reads them. Only `cause.js`, `ui.js` (Site dialog, `siteSet`), `manual.js` and the tests may name them.
  `hvacHook` is the trigger stage (`none | fire1 | fire2 | waterflow`), never Alert or Action; with `fire1`
  the manual station, Fire 2 and waterflow trip it too; with `fire2` it trips on `x.fire2` on any row, release
  or not, and a release alone never trips it (the rule reads the input, never a row key). EPO is on the waterflow row only, never a release or
  valve-open row, default OFF. Both are read from the row's input vector in `DI.ceEval`, not its outcome.
- DACT: `DI.DACT_CHAN_S` (240 s) is the channel-failure rule and `DI.COMM_PATH.dact.delay` (21,600 s) the test
  interval; both are CODE values. The 6 h annunciation of a missed test is ASSUMED. Failing a channel is a
  sandbox-only fault and never an input of D or P. Both channels down: nothing from that panel is transmitted or
  dispatched and no outside path is invented. `DI.DACT_TRIES` (10, the count ASSUMED) x `DI.DACT_ATTEMPT_S` (90 s,
  CODE bound) = 900 s, then the `dactFail` trouble (`dx<id>`) at the premises until a channel is back. One channel
  down queues nothing.
- DACT restore (FA Lead, Cycle 7). A signal that is still a condition at the panel is ALWAYS re-sent, hold ON and
  hold OFF alike, with its original `t0`. Hold and send is NOT in the code: a setting (`W.cfg.dactHold`, default
  on), shown without a code cite; it decides only what happens to a signal that restored inside the outage: ON
  sends it late and then its restoral, OFF drops it (`why: 'hold'`, no restoral). Never test `e.state === 'HELD'`
  in the hold-OFF branch (A93). Order, one send per `DI.DACT_SEND_S`: unsent originals ALARM, SUPV, TRBL, then OPEN
  (rank 3: OPEN is not a 10.7 class; the Cycle 6 rule "OPEN sorts with SUPV" is withdrawn), then the restorals in
  the same order, then the communications-failure entry (rank 4). A late alarm dispatches when it is sent, even if
  it cleared; a restoral dispatches nothing and is never dropped under hold OFF. The one path that still loses a
  live alarm is the panel dying with the entry queued (`why: 'dead'`): it is labeled `DI.DACT_HAZARD_LABEL` and
  carries `DI.DACT_HAZARD`, the FA Lead's text word for word (`DI.dactHazard(W)` swaps in the 2019 section
  numbers). Nothing models the station's 6 h test. Restoral citations are `DI.ref72(W).restoral` / `.retransmit`
  / `.stnVerify` (§26.2.5.1, §26.2.1.2, §26.2.2): [CODE], VERIFIED for 2019, 2022 and 2025 since Cycle 8, so no
  log line carries a tag (`DI.restoralTag` is a no-op) and no 2019 or CA-2019 text may say VERIFY or that the text
  is missing. §26.2.1.4 is 2022 and 2025 only, unmodelled, and never shown on a 2019 build. CA-2019 is the NFPA
  72-2019 label only: `DI.CA_STATION_NOTE` (ULC S561 is on hold) goes wherever the station text prints on a
  Canadian row (`DI.stationNote(W)`, the footnote of the station queue), and nothing presents the station rule as
  Canadian code.
- Waterflow latches at the panel until a panel reset (`v.p.wfL`). Its label is `DI.ref72(W).latch` (FA Lead,
  Cycle 8): "PRACTICE with code support (§10.11.6, §23.8.2.2 [indirect], §10.18.1.2; 2019: §10.18.1.1.2), NEEDS PE
  REVIEW". §23.8.2.2 is indirect support and is never quoted as a latch rule; no NFPA 72 sentence says fire alarms
  latch until manual reset. Use the key, never a retyped label. The switch itself (`s.alarm`, `proc.js`, the gong) is unchanged and nothing but `alarmStep` and
  `DI.panelReset` reads the latch. A dead or missing panel holds none; a flow raised on test does not latch; a
  signal held by the latch alone (`o.hold`) starts no dispatch. Never feed it to D, P or `DI.relState`.
- A silenced trouble resounds after `DI.TROUBLE_RESOUND_S` (86,400 s) while a trouble of that panel is active.
- Panel battery (FA Lead): the standby basis is `DI.STANDBY` (three selectable rows, three reference rows that
  are never selectable or modelled); `DI.standbyCalc` is the one calculation (review, inspector, Site dialog),
  with the factor from `DI.STBY_FACTOR[DI.ed72(W)]`, never the NFPA 13 edition. `fm90` is an election of its
  own and must never follow `insurer === 'FM'` (the default 26 Ah battery fails it). `DI.panelH` is the hours
  in the sim; the charge rate is `H / DI.RECHARGE_H` (48 h, CODE). Low battery is `DI.LOWBATT_V` (20.4 V,
  ASSUMED), the same thing as `DI.lowBattH(H)`. `chgFail` and `battDisc` are troubles and never inputs of D
  or P. No reference build may gain a battery finding (A76).
- Charger (FA Lead, Cycle 7): the battery pick stays free. `chgA` (panel prop, `DI.CHG_A`, ASSUMED listing values)
  = 0 is "matched to the battery": no finding, recharge at `H / 48`. `DI.chargerAh` = amperes x 48 h (ASSUMED, no
  taper); a battery above it is a review FAIL. The 48 h window is never stretched for a bigger battery, and a
  larger charger never charges faster than `H / 48` (`DI.chargeRate`). Charger amperes and battery cost are
  ASSUMED and never [CODE]; the default panel costs what it always did, and no goal reads a cost.
- The AVC is its own device: "in auto" = `v.p.airValve` open AND `DI.avcBypassed(v)` false. An open bypass
  drifts the zone to `DI.bypassTarget`: per compressor its cut-out, else the lower of its rated max discharge and
  its relief setpoint (`DI.compLimit`), with `DI.AVC_BYPASS_PSI` (60 psi, ASSUMED) where the compressor is not
  modeled; never the zone's test pressure. HIGH AIR comes in through the existing supervisory. The bypass is an
  impairment tag; it is a signal (`avcT<id>`, SUPV) only where the optional tamper switch is fitted
  (`v.p.avcTamper === 1`, default 0). That switch is labelled `DI.AVC_TAMPER_TAG` everywhere and is never
  presented as a code requirement or fed to D or P. With `avc === 0` the game still holds the zone at normal
  (SIMPLIFICATION).
- An isolated air / N2 supply is an impairment tag (`DI.impairments`), not a signal: it must not reach `S.sig`
  or any `SS_*` column (the truth-table runner shuts `airValve` to make low air). Low air stays a pure
  pressure signal.
- Reopen gate: it refuses only during the scored incident of a running drill. Do not widen that to trip tests,
  sandbox incidents or an incident from before the drill. In practice the valve opens with the warning, and if
  water then leaves through an open head the log explains it once (`s.floodW`, the `reopen-flood` entry).
- Sequential refill (`W.cfg.refillSeq`, default off, PRACTICE): a source serves one calling zone at a time, the
  largest `DI.zoneVolume` first, ties by the lowest zone ID (`head` in `DI.gasPre`). The parallel path must stay
  as it was, and the code check (`DI.airSizing`) never changes with the toggle. `DI.seqLine(S, id, sec)` carries
  the FP Lead's PASS sentence word for word.
- Refill: `DI.REFILL_LIMIT` is 1,800 s in every edition. `DI.REFILL_LIMIT_COLD`, 3,600 s, applies per zone
  (Cycle 7): only where every room the zone protects is a `cold` room with `below5 === true` (`DI.refrigerated(W,
  inf)`; the "every room" reading is ASSUMED, NEEDS PE REVIEW). Read the limit with `DI.refillLimit(W, inf)` and
  the sizing minutes with `DI.sizingMinutes(W, inf)`, never the constants and never without the zone where one
  exists. No contract uses the room type. The code check is `DI.airSizing`: the largest zone on
  the supply filled alone from 0 psig (`tAlone`); `below` (under the bare minimum) is a review FAIL and `tight`
  (under the x1.25 margin, ASSUMED, NEEDS PE REVIEW) a warning. The sizing pressure is `DI.sizingP`: normal
  where an AVC regulates (the default); on a compressor direct to the system (`avc === 0`) normal or a cut-out
  if higher, and there a cut-out above high air is a review FAIL (ASSUMED). The normal-minus-3.2 "set" point is
  never a sizing basis. No reference build may gain a sizing fail or warning (A59, A76).
- The measured clock is informational. No goal, review fail or drill result may be keyed to it, to
  `s.fillTime` (last refill) or to `s.fill1` (first fill; the one exception is the existing dock goal of
  contract 2): zones on a shared compressor fill at the same time here (`DI.PARALLEL_SPLIT`), so reference
  builds run over on commissioning. Clock and report text never say FAIL. Cycle 8 (FP Lead): a measured time is
  never compared with the limit as if it were the code check. The inspector rows (`DI.refillText`) read
  "<m> min (measured, informational)" with a neutral class at any length: no limit, no OK, no amber
  (`DI.refillState(...).over` still computes; no UI may read it). The drill report prints two labeled lines, the
  code check on top: `DI.codeCheckLine(S, id)` (the largest zone alone from 0 psig against the limit; "Passes." or
  "Fails: ..."; its flag is `!az.below`) and `DI.measuredLine(S, id, sec)` (informational; it must never contain
  "limit", "OK" or "over"), then `DI.seqLine`, and `DI.sharedLine` where zones share the supply. The sentences are
  the Fire Tutor's, the order and the labels the FP Lead's. `DI.refillLine` and `DI.sharedNote` are gone.
- Owner / insurer refill target (`W.cfg.ownerRefill`, `DI.ownerRefill(W)`, picks `DI.OWNER_REFILL`, FP Lead, Cycle
  8): judged like the code check, on `az.tAlone` (method ASSUMED). Over the target with the code check passing is
  one review WARNING that starts "Owner/insurer criterion:", never a fail; over the code limit it stays the code
  FAIL with no second finding; a target at or above the zone's limit raises nothing. `DI.ownerLine` is its drill
  report line. No goal, clock or measured line reads it.
- Compressor relief warnings (`DI.compWarnings`, FP Lead, Cycle 8; PRACTICE checks on ASSUMED picks): relief at or
  below the cut-out, or at or below the high air of a zone the compressor feeds; and relief above the rated max
  discharge. Warnings only, never a fail, and they never read or write a gas rate. `DI.compLimit` and
  `DI.bypassTarget` do not change with them: a cut-out still rules over a lower relief.
- The contract 5 recovery rating (`DI.recoveryTier`, `DI.RECOVERY_TIERS`: 60 s / 150 s, ASSUMED) reads
  `waterStopped` (the alarm to the control valve closed) plus complete and in order, never `refill` or `opTime`,
  and is a report line only: contract stars (`main.js`) do not read it.
- Drill report (`DI.drillRecovery`, Fire Tutor): `r.opTime = time - refill - mdtTime`, and the report prints
  "Operator steps took: N s" and "Main drain test took: N s" as two lines, never one sum. Water is two lines too
  (`DI.galLines`: `DI.headGal`, `DI.drainGal`), never a total; `S.stats.gallons` itself is unchanged. Head water
  is what is left after the two drain tallies of `Sim.account`: `mdGal` (a main drain, a wet riser's included) and
  `otGal` (system drain, inspector's test, test header: its own third line, only when there is some; its wording
  is the Tutor's since Cycle 8). A new
  emitter kind has to be put in one of the three, or it reads as head discharge. The code-check line and the
  shared-compressor note (`DI.sharedLine`) print whenever the zone has an air supply, an unfinished recovery
  included, and build their section from `DI.refillRef`; the measured line needs a measured refill. Under
  `DI.RECOVERY_TIP` the report adds `DI.RISER_NOTE` when water was stopped in under `DI.RISER_NOTE_S` (30 s).
  Return-to-normal errors (`DI.drillReturnLines`) and the main drain follow-up
  (`DI.drillDrainLines`) are informational lines `[false, text, true]`: no goal, star or review finding may read
  them until the scoring has settled for a cycle.
- Main drain follow-up: a drop over `DI.MDT_DROP` against a baseline never fails step 14 (`DI.mdtBig`: strictly
  more than 10 percent). It is a trigger to investigate, not an automatic fail (NFPA 25, Fire Tutor correction,
  Cycle 8): the result keeps `pass: false` (`DI.dropFollowed` reads it) and carries `invest: true`, and the badge
  and the log read INVESTIGATE (`DI.resBadge`), never FAIL. Its reference line is `DI.REF25.passLine`.
  `DI.mdtHint(drop)` and `DI.MDT_SKIPPED` are the Tutor's words: do not reword them. "Investigated" is `DI.dropFollowed`: a `drop-check`
  act, an `open-valve` act on a control valve of the supply path (`DI.supplyValves`), or a later passing test.
  With no baseline nothing is scored. There is no timed nag.
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
  at test pressure (charge stage, `DI.airTarget`) and never sets or clears P. The 1.5 psi pass line is absolute
  at every test pressure: never scale it. Afterwards `s.ret` is the "return to normal set point" step
  (`DI.returnStep`, modes bleed / refill / confirm / ready): bleed at the trim (`DI.bleedToNormal`, which touches
  gas only, never a valve or a drain, and is never an error) or refill.
- The return step ends only with the Finish button (`DI.returnFinish`, FP Lead, Cycle 7). Nothing may end it by
  itself: `DI.returnReady` only drives a hint. Finish is accepted when every condition of `DI.returnGate` holds:
  in band, above low air, not above high air, above P with margin AND `pLatch` reset, supply open AND AVC bypass
  closed, no tamper on the control valve, no air test running, every drain closed. Otherwise the press is refused
  and answered with what was missing, every time. Cycle 8 (FP Lead, PRACTICE): a refusal is a new `finish-early`
  error only when its blocker set (`G.miss`, compared as strings) holds a blocker that was not in the last
  refused set (`s.rtLast`): the same set again, or a set that only shrank, adds none (that reading is ASSUMED).
  `s.rtLast` is reset when the gate comes true (`DI.returnWatch`) and by `DI.rtClear`, so a blocker that returns
  afterwards counts. `s.rtPress` counts every refused press and is reported as information (`DI.rtPressLine`),
  never as errors. Both are in `DI.SS_KEYS`. The one other way out
  is a trip (`DI.returnAbort`, the `water-flow` error).
- Drains in that step (FP Lead): never hard-block, model the consequence. `DI.returnWatch` coaches once per
  opening (`DI.RT_COACH`, word for word) and scores one error per event in `s.rtErr` (`finish-early`,
  `main-drain-flow`, `low-air`, `p-latch`, `water-flow`; one low-pressure episode is one entry, raised by
  `DI.RT_RANK`, never doubled). A drain opened and closed with no consequence is coaching only, also while the
  pressure passes through the band. Scoring is independent of the time step: it reads `s.rtMin`, the lowest
  pressure of the tick (from `s.rtP0`), interpolates the crossing, and relies on the sub-step in `Sim.step`. It
  runs only while `s.ret` is true and never during the settle of a load. The Tests-button main drain test is
  never an error. The main drain emitter stays on the supply side (`sys: 0`) and must never enter the gas
  balance. The result is a practice `return` result on the valve: no goal and no contract star may read it.
- Return-step text (Fire Tutor): the names in `DI.RT_RANK` are internal and must never reach the player: the
  result, the log, the inspector and the drill report print `DI.rtLine` / `DI.rtName` only (A100 greps for the
  tags). Every sentence is the Tutor's, word for word, since Cycle 8: `DI.RT_TEXT['p-latch']`,
  `DI.RT_TEXT['water-flow']`, `DI.RT_TEXT['main-drain-flow']`, `DI.RT_CLEAN`, `DI.RT_EARLY` (Finish too early) and
  `DI.RT_LOW_DRAIN` (low air with a drain open). The one exception is `DI.RT_LOW_NODRAIN` (low air with no drain
  open): ASSUMED wording. A low-air entry records `drain` and `iso` at the crossing; `DI.rtLine` picks the
  sentence from them and appends `DI.RT_ISO` when the supply was isolated.
- The aspirating listed ranges are per model and per stage (`DI.ASD_MODELS`, datasheet values): show
  `DI.ASD_SRC` beside every range. Thresholds are never clamped, rounded or moved to fit. NFPA 76 is two
  ceilings: Alert 0.2 and Fire 1 (the first alarm stage) 1.0 %/ft, PRACTICE, NEEDS PE REVIEW
  (`DI.n76Flags`, `DI.n76Note`). `DI.n76Check` only reads: nothing may write a threshold from them, and
  there is no stage election, OPEN chip or CONFLICT flag. The 1.0 %/ft figure is VERIFIED (`DI.N76_TAG`); mapping
  it to Fire 1 stays PRACTICE, NEEDS PE REVIEW.
- NFPA 76 applies by room (FA Lead, Cycle 8). Only a room of type `tel` (Telecom / MMR) can be an NFPA 76 space;
  a hall never is. `DI.n76Applies(W, room)` = the room's own `n76` where set, else the site flag
  `W.cfg.nfpa76Adopted`, which is only the default for telecom rooms. The ceilings are checked in
  `DI.n76Rooms(W)` (an NFPA 76 room that holds a `vesda` part), one finding per ceiling per room, each naming the
  room; with no such room the note and the check say so (`DI.N76_NO_ROOM`). Which rooms count is PRACTICE, NEEDS PE
  REVIEW. Do not bring back a site-wide reading: it pushed 0.5 %/ft onto halls. The room type is changed in the
  Sandbox only (hall to telecom and back), and no contract uses it.
- VEA (`DI.ASD_MODELS.VEA`, Cycle 7) is a Fire 1-only model: `range` is empty, `DI.asdRange` gives null per stage,
  and the detection loop reads `DI.asdThr(W, room)` = `[Infinity, Infinity, fire1, Infinity]`, so only the FIRE 1
  row is ever raised and `p.p.rel = p.p.lvl >= DI.FIRE1` is untouched. Since Cycle 8 its Fire 1 is per room,
  `DI.veaFire1At(W, room)`: the room's own pick (`room.f1`), else the site pick (`W.cfg.detThr[2]` where
  thresholds are stored), else the default by room: 0.5 where `DI.n76Applies`, 1.23 anywhere else, whatever the
  site flag. `DI.veaFire1(W)` is the site value (no room). The detection loop passes the room for VEA only; VEP,
  VEU and the spot detector read the site thresholds in every room and have no per-room pick. A stored value that
  is not 0.5 / 1.23 / 2.5 is kept and fails review (never clamped); the Gamewell 1.3 is a note, never a setting.
  Print nothing for its Alert, Action or Fire 2 (`DI.VEA_NA`). `DI.detThr` sits in the pinned first 30 lines of
  `alarm.js`: do not edit it for this, use `DI.asdThr`. `DI.ASD_RECORDED.VEA` is only the manual's source note.
- NAC voltage drop (`DI.nacCalc`, `DI.nacFinding`, `data.js`; FA Lead, Cycle 8) is a plan-review check only: one
  DC circuit per panel, Class B, end-line-loaded, default off (`nacOn`). `R = 2 x ft x ohm / 1000`: both
  conductors are counted through the length and the Table 8 value (`DI.NAC_OHM`, NFPA 70-2023 Ch. 9 Table 8, [CODE
  NEC 2023]) is never doubled. FAIL below `DI.NAC_VMIN` (16 V, ASSUMED); WARN when the margin is under
  `DI.NAC_THIN` (20 %, PRACTICE) or the start voltage is ASSUMED (`DI.NAC_V_END`, 20.4 V); a clean pass is one
  `info` line. Appliance currents (`DI.NAC_CD`) are ASSUMED listing values, never [CODE]. The basis label is
  `DI.ref72(W).nacVd`: [CODE] in 2025 only, PRACTICE on 2019 and 2022; `.nacDoc` is §7.2.1(8). On a Canadian row
  it is not evaluated (`DI.NAC_CA_HOLD`). `W.cfg.nec` `'2026'` shows the 2023 ohms as ASSUMED / VERIFY and never
  names 2026 as the source. It must never raise a signal, gain a registry key or a matrix row, or feed D, P, the
  release, a hook or `DI.standbyCalc` (A121 greps the functions): keep those identifiers out of them.
- No elevator recall, shunt-trip, waterflow or door device ever feeds the DI release (FA Lead, joint ruling
  8cb97c21, PRACTICE). Release stays (D: Fire 1 OR a DETECTION-typed manual station) AND P, plus the locked
  Manual Release zone path. Such devices are fire alarm outputs and monitor points only; a lobby smoke detector
  that shares a zone with hall detection is still not D; a shunt trip is not an EPO hook. None exists in the game
  yet. A131 guards it: the allow-list of registry keys that may be release inputs (`fire1`, `manual`, `mrz`) is
  in the test, so a new input has to be added there on purpose.
- Water delivery is judged on full zone volume (`DI.zoneVolume`: pipe + fittings % + trim gal), never on
  `inf.vol` alone. Dry: 60 s timed test above 500 gal, 750 gal with a QOD. Double interlock: above
  500 gal, and a QOD does not extend it. FM (insurer setting, default none) adds 30 s at any volume; the
  most stringent limit governs. Use `DI.deliveryRule` / `DI.deliveryLimits`; the numbers live in
  `DI.DELIVERY` and the citations in `DI.juris.ref` (`timedTest`, `noQod`, `qod`, `table`, `di`).
- Label a value the Leads did not fix as ASSUMED in the UI and manual and keep it tunable. Label an open
  engineering choice NEEDS PE REVIEW, and a section number or value not yet checked against the edition
  VERIFY. The register of all three is in README.md and the manual's Site page.
- `test/sim.test.js` holds the acceptance checks for all of the above plus static greps on `src/`. Two of them
  pin sources by hash (A67, A92): the first 30 lines of `alarm.js` (the D logic) and `DI.relState`. Do not edit
  either, not even a comment. Another pins the number of `pLatch = false` writes in `src/` at five.

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

- In a field call the report opens from the slow loop as soon as every goal is met, also while paused: it replaces
  whatever dialog is open (the Diagnose dialog, when the diagnosis is the last goal). A test must wait for it, not
  close the dialog after the right pick.
- Field call setups run the sim (a baseline test, the night's event, three resets) before `DI.puzInit` takes `t0`: a
  goal that needs a fresh result reads `DI.PZ.since`, and the setup's log lines are replayed into the event log by
  `startScenario`.

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
- `DI.recoveryScore(S, id, from)` with any `from` is the drill form and has 14 steps; without it, 13. A test
  that uses `from` only to pick an earlier incident reads 14 too.
- A panel's `battH` is only clamped when the battery pick or the standby basis changes (it then charges at the
  48 h rate): a test that needs a full 90 h battery sets `battH` itself.
- DACT attempt boundaries are exact to the second. A test that reads them must step onto `t0 + n * 90` exactly
  (`r.S.step(Math.min(1, T - r.S.t))`), not in whole seconds from an unaligned `t0`.
- The system drain passes through the normal band on its way down: with everything else ready that is a
  `drain-open` entry first, which the same opening then raises to `low-air` and `p-latch`. Count entries, and
  read `why`, after the event is over.
- The browser rig's zone is bigger than the Node rig's: the system drain needs a few seconds to reach P there.
  Step until `pLatch`, not for a fixed time.
- Main drain water counts in `S.stats.gallons`; `S.stats.mdGal` is that part of it. The contract 5 drill's
  "no water on the IT load" mark subtracts it, or the reference operator's step 14 would fail the drill.
- Signals that first appear while a test procedure runs are flagged `test` and never dispatch. The reference
  operator runs the main drain test once, on the scored incident's zone, and only in a drill.
- One static check greps `src/` and this file for the word that says a closed-head trip puts water on the floor,
  after stripping the known identifiers (`floodW`, `floodK`, `FLOOD_BANNER`, `reopen-flood`). A new identifier
  that contains it has to be added to the test's list, and new text (here too) must not use it.
- A waterflow signal now outlives its flow: a test that asserts `!S.sig.has('wf' + id)` after the flow stops must
  first reset the panel (or check `o.hold`). `test/bot.js` resets the panel once nothing is under recovery.
- Every cleared signal the station had now logs a `RESTORAL to station` line and a `restoral` act: count log
  lines and acts by kind, never by total.
- `DI.returnStep` text and the step's life changed in Cycle 7: after a bleed or refill a test must call
  `DI.returnFinish` to end the step, and a refused press adds an error. `DI.returnWatch` takes `(S, id, v, s, pl0,
  dt)`.
- Two inspector rows start with "Charger": the pick label and the status row, which is `Charger check`. The NAC
  block has the same trap: the pick label starts with "Start voltage at the panel", the status row is
  `Start voltage used`.
- The c5 reference fills from 0 psig measure a little under `tAlone` (the sizing uses the zone volume with
  fittings and trim, and the clock stops at the "set" point): compare with a tolerance, not for equality.
- A117 pins the sha16 of the plan review of every contract (as built, after the bot, after the settle), taken at
  the Cycle 7 head: a change that alters review text or order on a reference build has to update those pins on
  purpose. Add a finding type so that it stays silent on the defaults.
- `sim.test.js` must not load `manual.js` in its own process (the static block reads the source only while
  `DI.MANUAL` is undefined). The Cycle 8 block reads the evaluated manual from a child process (`manual8`).
- A test that plays an old save has to `delete jw.v`, or the NFPA 76 migration does not run. A room of type `tel`
  is named "Telecom / MMR (NFPA 76 space)" by default: a test that greps findings for "NFPA 76" should name the
  room (the tests use "MMR 1"), or a coverage finding matches.
- A refused Finish no longer adds an error on every press: count `s.rtPress` for presses and `s.rtErr` for
  errors. The gate reads flags, so a test can set `drain`, `avcBy` or `pLatch` and press without stepping; the
  reset of `s.rtLast` needs one step with the gate true.
- `TT.runRow(DI, row, opts)` takes `opts.room` and `opts.cfg` for the runner's own rig (a telecom room, a VEA
  site); the fixture is not involved. On VEA the smoke level is taken from the room's Fire 1.
- `DI.nacCalc(...).maxFt` is the exact length; the number shown (`DI.nacMaxFt`) is rounded down so that it
  passes. `below` and `thin` carry a rounding allowance, as `DI.mdtBig` does for the 10 percent.
- `World.fromJSON` migrates old saves (`DI.migratePart`): it drops `mode`, loads the el-el preset where
  setpoints are missing and flags the valve so `Sim.restore` re-pressurizes it. Extend that function
  when part props change.
