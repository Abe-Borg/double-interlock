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
| 5 | Double Interlock | Preaction for a 48,000 sq ft data hall | The two interlocks (detection AND P), aspirating stages, system sizing, why a latched P must be reset |
| 6 | Rust Never Sleeps | Nitrogen retrofit on a corroded system | Oxygen corrosion, air test, fill-and-purge to 98%, and why nitrogen earns no pipe-size credit (C stays 100) |
| 7 | Hyperscale | A whole campus from a bare site | Choosing systems per space, one supply for the worst demand, a valve gallery, running a bad night |
| - | Sandbox | Anything | Unlimited budget, an Incident menu (power, weather, false smoke, pipe break), fires on demand, skip ahead five years |

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
  fill time, leak-down, the low-air and high-air supervisory switches, the dry valve trip point, the
  preaction P trip point, accelerator action, water transit to the open sprinkler and nitrogen purity
  all come from that bookkeeping.
- **Valve logic.** Differential dry valve (about 5.5 : 1). Preaction is double interlock only:
  release = (Fire 1 detection OR the panel manual station, typed DETECTION) AND P. P is pipe pressure
  below the valve's P trip setpoint, from any opening big enough to beat the compressor (sprinkler,
  inspector's test, broken pipe), and it latches until a manual reset. Low and high air are supervisory
  only. A separate mechanical emergency release at the trim opens the valve by hand, outside the panel
  logic. The solenoid is energize-to-release, so a dead panel never releases water.
- **Fire.** t-squared growth, Alpert ceiling-jet temperature and velocity, RTI link heating (the DETACT
  method) to decide which sprinklers open and when. Water at or above design density knocks the fire
  down; less only slows it. Loss is counted in fire, water and smoke dollars.
- **The rest.** Freezing of water-filled pipe in unheated rooms, oxygen corrosion and pinhole leaks,
  utility outages and generator transfer, diesel fuel and batteries, the fire department and the FDC,
  aspirating detection stages (Alert supervisory, Action pre-alarm, Fire 1 releases, Fire 2 escalation
  only), spot detectors (alarm only in white space, detection leg in an electrical / UPS room), pipe
  breaks, and a technician you can send while a fire is still smouldering.

Simplified on purpose: one sprinkler per 10 ft tile, fittings as a flat 30% equivalent length,
elevation ignored except tank level, single-storey buildings, no hangers or seismic bracing, smoke as
one number per room, corrosion as one number per system. The in-game manual has a page on this.

## Company rules and site settings

The sim obeys a set of company locks. They are not options.

- **Systems:** wet, dry and double-interlock preaction only. Single- and non-interlock preaction are
  mentioned in the manual for comparison and cannot be built.
- **Release:** `(Fire 1 detection OR manual station typed DETECTION) AND P`. Only Fire 1 releases.
  Alert never arms a release and Fire 2 never releases by itself. Low air is never a release input.
- **Panel failure never releases water.** The panel runs on a 24 h standby battery, reports trouble,
  and a dead panel leaves the solenoid shut. Recovery is the mechanical emergency release by a person.
- **Hazen-Williams C = 100 everywhere:** wet, dry, preaction, interior, yard and underground. Nitrogen
  earns no C-factor credit. A greyed comparison line in the manual and the Site menu quotes the NFPA
  table value; it never touches a calculation.

The **Site** button on the top bar holds the project settings, saved with each map:

| Setting | Choices | Default |
|---|---|---|
| Enforced NFPA 13 edition (US) | 2019, 2022, 2025 | 2025 |
| Pipe schedule policy | ASSUMED default (2 in. and smaller threaded Sch 40, 2½ in. and larger roll-grooved Sch 10), or the company lock text (mains and cross-mains 2 in. and larger Sch 10, branch lines Sch 40 at every size) | ASSUMED default |
| Aspirating detection thresholds | four values: Alert, Action, Fire 1, Fire 2 | 0.03 / 0.06 / 0.12 / 1.2 %/ft (example values) |
| NFPA 76 adopted on this site | no / yes; when yes, a preset holds Alert at 0.2 and Fire 1 at 1.0 %/ft | no |
| Manual Release zone bypasses P | off / on | off |

The edition changes the citations in plan review and shows an "Edition delta vs 2025" line there. Pass
and fail do not differ by edition in this version. A Canada row (NFPA 13-2019) exists as hidden data
only and is never offered in the menu.

Each preaction valve carries its own setpoints, loaded from a **maker trim** preset in the valve's
inspector: electric / electric (P sensed by a PSL-REL pressure switch) or electric / pneumatic (P sensed
by a PA-REL pneumatic actuator). The order is always high-air supervisory > normal > low-air
supervisory > P trip, and plan review fails any other order. Dry valves carry their own high-air and
low-air setpoints too.

Two labels are used in the UI and the manual:

- **ASSUMED**: a value the company has not fixed. It is a tunable default, not a rule. Currently:
  preaction setpoints 50 / 40 / 30 / 20 psi (high / normal / low / P trip), a 5 psi minimum margin
  between low air and P trip, the default pipe schedule policy and equal cost per schedule, the
  detection example thresholds (0.03 / 0.06 / 0.12 / 1.2) and the spot detector threshold (1.3), the
  NFPA 76 preset's Action example (0.6), the 24 h panel battery, and Canada = NFPA 13-2019 via NBC 2020 /
  BCBC 2024 (verify before ship).
- **NEEDS PE REVIEW**: a choice an engineer of record has to make. Currently: the Manual Release zone
  that bypasses P (owner/insurer exception, OFF by default; it applies to the electric / electric trim
  only), the signal class of the Action stage and of the latched-P annunciation (both supervisory
  here), and the lithium-ion / ESS room density and approach (the battery room is a placeholder).

Simplifications in the release logic: a panel reset or a valve reset clears a latched P on both trims;
after a mechanical emergency release with every sprinkler closed the trapped air is not vented, so the
pipe sits pressurized with no flow; the panel battery is a flat 24 h of standby plus alarm.

## Code basis

Rules and numbers follow **NFPA 13** in the edition chosen under Site (default **2025**), with NFPA 20,
NFPA 25 and NFPA 72 for pumps, testing and signals, and the company rules above where they are stricter.
Section references in the game are given at chapter or section level. The edition table in
`src/juris.js` holds the section numbers that differ between 2019, 2022 and 2025 (system area limit,
dry water delivery, double-interlock delivery); do not add others without verifying them. Checked against
published summaries of the 2025 edition while building: the section 8.2 rewrite (gridded dry systems
prohibited in 8.2.1, water delivery in 8.2.4) and the system area limits in 4.4.1. The long-standing
values (500 / 750 gal, 60 s, +30% area, 7 psi supervisory, 30-minute air, 1.5 psi in 24 h, pump curve
limits, NFPA 20 A.14.2.6 pressure settings, 90 s waterflow) are from the author's knowledge of those
standards and were not re-read from the 2025 text. Pipe inside diameters are the Schedule 10 and
Schedule 40 values of the steel pipe dimensions table (ASME B36.10M); the 12 in. Schedule 10 value is
the thin-wall one the game has always used and is marked for verification in `src/core.js`. Data hall
hazard classification and the battery room are owner- and NFPA 855-driven in real life and are
placeholders here. **Verify anything against the adopted edition before using it on a project.** This is
a trainer, not a calculation tool for a submittal.

## Files

```
double-interlock.html   the game, one file (built)
index.html              the game, loading src/
build-standalone.js     inlines src/ into double-interlock.html
src/
  core.js       constants, units, pipe table by schedule, C factor, hazard and room tables
  juris.js      enforced-edition table (US 2019 / 2022 / 2025, hidden Canada row), detection presets
  data.js       part catalogue, costs, pump curve, maker trim presets
  world.js      the tile map: pipes, sprinklers, parts, tubing, wires, capped joints, site settings, save migration
  solver.js     global gradient network solver with node capacitance
  systems.js    which pipe belongs to which riser; volumes, remote sprinkler, loops
  graph.js      tile map -> reduced hydraulic network
  links.js      how each part appears to the solver; pressure read-back
  gas.js        supervisory gas, P latch and trip logic, mechanical release, system fill, valve reset
  fire.js       fire growth, sprinkler activation, pipe breaks, water and smoke damage, freeze, corrosion
  alarm.js      detection stages, signals, panel and solenoid logic, fire department, technician
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

About 2,900 lines of vanilla JavaScript, no dependencies, no assets. Sound is generated.

## Tests

```
node test/solver.test.js      # pump points, parallel split, check valves, bleed-down
node test/graph.test.js       # tile map against a hand Hazen-Williams calculation
node test/sim.test.js         # wet / dry / double interlock / pump behaviour end to end, plus the
                              # company-lock acceptance checks (A1 onward) and static source greps
node test/proc.test.js        # commissioning procedures
node test/campaign.test.js    # all seven contracts: goals met, drill passed, cost reported
node test/ui.play.js out.png  # needs Playwright: plays contract 1 with real input events
```

`test/bot.js` holds a working layout for every contract. Those are spoilers.

## Ideas not built

Elevation and multi-storey risers, looped yard mains with hydrants as a scored objective, a first-person riser room for the trim-level procedures, hot-aisle
containment as an obstruction rule, and exporting a calc sheet.

Planned for later cycles: hazard classes by insurer (NFPA 13 OH1 floor, FM DS 5-32 / 2-0 when the insurer
is FM) with lithium-ion rooms as an ESS off-ramp, the FM 30 s delivery overlay next to the NFPA 13 clock
on full zone volume, battery basis and supervising-station behaviour, signal classes and NAC modelling
when fire alarm is phased in, and real Canada edition rules once verified.
