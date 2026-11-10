# DOUBLE INTERLOCK

*A fire protection sim for hyperscale data centers.*

You design, build, commission and then operate the fire protection plant of a data center campus:
wet, dry and double-interlock preaction systems, air compressors and nitrogen generators, tanks,
electric and diesel fire pumps, jockey pumps, detection and the releasing panel. Nothing is scripted.
The hydraulics are solved live on the pipe you drew, supervisory air leaks and is made up, pumps follow
their curves, and a valve trips when the physics says it trips. Get the design wrong and the acceptance
drill shows you how, at 2 a.m., in an ice storm.

It is a game first: build, test, survive, three stars. What it teaches is real and transferable.

## Run it

Double-click **`double-interlock.html`** (Chrome or Edge). One self-contained file, no install, no
server, no network. Progress saves in the browser.

- `double-interlock.html` is the whole game in one file. Send it to anyone.
- `index.html` is the same game loading the readable sources from `src/`. It also runs from `file://`.
- After editing anything in `src/`, rebuild the single file with `node build-standalone.js`.

Mouse and keyboard, desktop. A 1600 x 900 window or larger is comfortable.

## The loop

Every contract is the same three steps.

1. **Build.** Lay mains, drag out sprinkler branch lines, place valves, pumps, compressors, detection,
   wire the panel. The plant is live while you build: pipe fills, air builds, gauges move.
2. **Prove.** Run the same tests a commissioning agent runs: plan review, hydraulic calc, inspector's
   test, main drain test, full-flow trip test, 24-hour air test, three-point pump flow test, churn run.
3. **Survive.** The acceptance drill throws incidents at what you built, in real time, while you operate
   it: read the annunciator, close and reopen valves, drain and reset, replace sprinklers, send a tech.

| # | Contract | You build | What it teaches |
|---|---|---|---|
| 1 | Wet Behind the Ears | Wet system on a city main | Riser anatomy, Q = K sqrt(P), density/area, flow alarm, main drain |
| 2 | Cold Dock | Dry pipe system for an unheated dock | Differential valve and trip point, +30% area, no gridding, 500/750 gal and 60 s, 30-minute compressor, restoring after a trip |
| 3 | Churn | Tank, electric fire pump, jockey pump | Pump curve (churn, 100%, 150%), tank duration, NFPA 20 pressure settings, flow test |
| 4 | Lights Out | Diesel pump, FDC | Second driver, lead/lag staggering, fuel and batteries, weekly run, supervisory signals |
| 5 | Double Interlock | Preaction for a 48,000 sq ft data hall | The two interlocks, VESDA stages, system sizing, why an impaired interlock matters |
| 6 | Rust Never Sleeps | Nitrogen retrofit on a corroded system | Oxygen corrosion, air test, fill-and-purge to 98%, C = 120 on nitrogen |
| 7 | Hyperscale | A whole campus from a bare site | Choosing systems per space, one supply for the worst demand, a valve gallery, running a bad night |
| - | Sandbox | Anything | Unlimited budget, an Incident menu, fires on demand, skip ahead five years |

Contracts unlock in order ("Unlock all" is on the menu). Stars: finish, finish under par cost, finish the
drill under half the allowed loss.

## Controls

| Key | Does |
|---|---|
| `Q` | Select and operate (click any part, pipe or room) |
| `1` | Main pipe: drag. Drag over existing pipe to resize it |
| `2` | Sprinkler branch lines: drag a rectangle. `R` flips the line direction |
| `3` | Add or remove a single sprinkler on a pipe |
| `4` | Air / nitrogen tubing |
| `5` | Wiring: click the panel, then each device. Right-click a device to unwire |
| `6` | Cap: stop two neighbouring pipes from joining. Click a joint, or drag along a row or column |
| `X` | Erase (drag). Full refund |
| `[` `]` | Pipe size |
| `R` | Rotate the part being placed |
| `Space` | Pause. Speeds 1x / 4x / 20x / 120x and a Skip menu (10 min to 5 years) are on the top bar |
| `Ctrl+Z` | Undo |
| Right-drag, `WASD`, wheel | Pan and zoom |
| `G` / `M` / `Del` | Goals / field manual / remove the selected part |

Rules of the grid: one tile is 10 ft and one sprinkler tile protects 100 sq ft. Mains join everything
they touch. Branch lines join only end to end and to a main beside them, and never through a wall.
Pipes cannot cross, so plan the trunk first. Pipe colour is its contents: blue water (brighter is higher
pressure), sand compressed air, teal nitrogen. White dashes are flow. Hover any pipe for psi, gpm, ft/s.

## What is simulated

- **Hydraulics.** A network solver using Todini's global gradient algorithm (the method in EPANET) on
  the graph extracted from your tiles: Hazen-Williams friction, NFPA 20 shaped pump curves, check valves,
  backflow preventers, orifice outlets (sprinklers, drains, test header, leaks). Loops work. A node
  capacitance term makes trapped pressure, jockey cycling and system filling fall out of one equation.
  Dead-end pipe with no outlet is pruned and runs are merged, so a full campus solves as about 60 nodes.
- **Supervisory gas.** Each dry or preaction system is an ideal-gas volume with an oxygen tally. Compressor
  fill time, leak-down, the low-air switch, the dry valve trip point, accelerator action, water transit
  to the open sprinkler and nitrogen purity all come from that bookkeeping.
- **Valve logic.** Differential dry valve (about 5.5 : 1), single / double / non-interlock preaction,
  energize-to-open solenoid from a releasing panel with standby battery, manual release, latched alarms.
- **Fire.** t-squared growth, Alpert ceiling-jet temperature and velocity, RTI link heating (the DETACT
  method) to decide which sprinklers open and when. Water at or above design density knocks the fire
  down; less only slows it. Loss is counted in fire, water and smoke dollars.
- **The rest.** Freezing of water-filled pipe in unheated rooms, oxygen corrosion and pinhole leaks,
  utility outages and generator transfer, diesel fuel and batteries, the fire department and the FDC,
  aspirating detection stages, and a technician you can send while a fire is still smouldering.

Simplified on purpose: one sprinkler per 10 ft tile, fittings as a flat 30% equivalent length,
elevation ignored except tank level, single-storey buildings, no hangers or seismic bracing, smoke as
one number per room, corrosion as one number per system. The in-game manual has a page on this.

## Code basis

Rules and numbers follow **NFPA 13-2025**, with NFPA 20, NFPA 25 and NFPA 72 for pumps, testing and
signals. Section references in the game are given at chapter or section level. Checked against published
summaries of the 2025 edition while building: the section 8.2 rewrite (gridded dry systems prohibited in
8.2.1, water delivery in 8.2.4), C = 120 for nitrogen extended to VCI and vacuum systems (Table
28.3.4.8.1), and the system area limits in 4.4.1. The long-standing values (500 / 750 gal, 60 s, +30%
area, 7 psi supervisory, 30-minute air, 1.5 psi in 24 h, pump curve limits, NFPA 20 A.14.2.6 pressure
settings, 90 s waterflow) are from the author's knowledge of those standards and were not re-read from
the 2025 text. Data hall hazard classification and the battery room are owner- and NFPA 855-driven in
real life and are placeholders here. **Verify anything against the adopted edition before using it on a
project.** This is a trainer, not a calculation tool for a submittal.

## Files

```
double-interlock.html   the game, one file (built)
index.html              the game, loading src/
build-standalone.js     inlines src/ into double-interlock.html
src/
  core.js       constants, units, pipe table, hazard and room tables
  data.js       part catalogue, costs, pump curve
  world.js      the tile map: pipes, sprinklers, parts, tubing, wires, capped joints
  solver.js     global gradient network solver with node capacitance
  systems.js    which pipe belongs to which riser; volumes, remote sprinkler, loops
  graph.js      tile map -> reduced hydraulic network
  links.js      how each part appears to the solver; pressure read-back
  gas.js        supervisory gas, trip logic, system fill, valve reset
  fire.js       fire growth, sprinkler activation, water and smoke damage, freeze, corrosion
  alarm.js      detection, signals, release logic, fire department, technician
  sim.js        tick loop, pump controllers, tank, commissioning, fast-forward, save/load
  calc.js       density/area hydraulic calculation
  review.js     plan review rules
  proc.js       test procedures (trip, inspector's, main drain, pump, air, churn)
  scen*.js      scenario toolkit and the seven contracts + sandbox
  manual.js     the in-game field manual
  glyphs.js render.js input.js inspect.js ui.js audio.js main.js style.css   the front end
test/
  solver.test.js  graph.test.js  sim.test.js  proc.test.js   engine tests against hand calcs
  campaign.test.js  bot.js    plays every contract headlessly with a reference solution and an operator
  ui.play.js  shot.js         browser tests (Playwright): a full contract by mouse and keyboard
```

About 2,700 lines of vanilla JavaScript, no dependencies, no assets. Sound is generated.

## Tests

```
node test/solver.test.js      # pump points, parallel split, check valves, bleed-down
node test/graph.test.js       # tile map against a hand Hazen-Williams calculation
node test/sim.test.js         # wet / dry / double interlock / pump behaviour end to end
node test/proc.test.js        # commissioning procedures
node test/campaign.test.js    # all seven contracts: goals met, drill passed, cost reported
node test/ui.play.js out.png  # needs Playwright: plays contract 1 with real input events
```

`test/bot.js` holds a working layout for every contract. Those are spoilers.

## Ideas not built

Elevation and multi-storey risers, deluge and water mist, clean agent rooms, looped yard mains with
hydrants as a scored objective, a first-person riser room for the trim-level procedures, hot-aisle
containment as an obstruction rule, and exporting a calc sheet.
