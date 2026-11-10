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
| 2 | Cold Dock | Dry pipe system for an unheated dock | Differential valve and trip point, +30% area, no gridding, 500/750 gal of zone volume and 60 s, 30-minute compressor, restoring after a trip |
| 3 | Churn | Tank, electric fire pump, jockey pump | Pump curve (churn, 100%, 150%), tank duration, NFPA 20 pressure settings, flow test |
| 4 | Lights Out | Diesel pump, FDC | Second driver, lead/lag staggering, fuel and batteries, weekly run, supervisory signals |
| 5 | Double Interlock | Preaction for a 48,000 sq ft data hall | The two interlocks (detection AND P), aspirating stages, zone volume and the 500 gal tip-over (pass the 60 s timed test or rezone), the eight-step recovery in order, why a latched P is reset only after the air is back |
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
  release = (Fire 1 detection OR the manual station, typed DETECTION) AND P. D is a level check (at or
  above Fire 1). P is pipe pressure below the valve's P trip setpoint, from any opening big enough to
  beat the compressor (sprinkler, inspector's test, broken pipe), and it latches until a manual reset.
  Low and high air are supervisory only. A separate mechanical emergency release at the trim opens the
  valve by hand, outside the panel logic. The solenoid is energize-to-release, so a dead panel never
  releases water. The release model follows the fire alarm lead's truth table
  (`fixtures/di-release-truth-table.csv`, rows R01 to R17), which the tests read directly:

  | Trim | P sensed by | Solenoid energized on | Valve opens on | P is reset |
  |---|---|---|---|---|
  | Electric / electric | pressure switch PSL-REL, latched in the panel | D AND P | D AND P | at the releasing panel |
  | Electric / pneumatic | pneumatic actuator PA-REL, at the valve | D alone | D AND P | at the actuator, at the trim |

  A panel reset clears the panel's latches and then reads every input again, so a live input comes
  straight back. A reset while the pipe is still below P trip latches P again. A tripped valve is reset
  by hand at the riser: a panel reset never closes it, and the riser reset never clears P.
- **Water delivery.** Zone volume = pipe + a fittings allowance + the valve trim. NFPA 13 size
  exemptions are judged on it: a dry system needs the 60 s timed trip test above 500 gal (750 gal with
  a quick-opening device); a double-interlock system above 500 gal, and a quick-opening device does not
  extend that. Where the site insurer is FM, dry and double-interlock systems must deliver in 30 s at
  any volume. The most stringent limit governs, and the trip-test report shows the NFPA limit, the FM
  limit, the governing one and the margin in seconds, with pipe-only gallons beside zone gallons.
- **Fire.** t-squared growth, Alpert ceiling-jet temperature and velocity, RTI link heating (the DETACT
  method) to decide which sprinklers open and when. Water at or above design density knocks the fire
  down; less only slows it. Loss is counted in fire, water and smoke dollars.
- **The rest.** Freezing of water-filled pipe in unheated rooms, oxygen corrosion and pinhole leaks,
  utility outages and generator transfer, diesel fuel and batteries, the fire department and the FDC,
  aspirating detection stages (Alert and Action pre-alarm, Fire 1 releases, Fire 2 escalation only;
  every stage crossed is logged in order), spot detectors (alarm only in white space, detection leg in
  an electrical / UPS room), wired manual release stations, panel Silence and Reset, a recovery log that
  scores the eight restore steps in order, pipe breaks, and a technician you can send while a fire is
  still smouldering.

Simplified on purpose: one sprinkler per 10 ft tile, fittings as a flat 30% equivalent length,
elevation ignored except tank level, single-storey buildings, no hangers or seismic bracing, smoke as
one number per room, corrosion as one number per system. The in-game manual has a page on this.

## Company rules and site settings

The sim obeys a set of company locks. They are not options.

- **Systems:** wet, dry and double-interlock preaction only. Single- and non-interlock preaction are
  mentioned in the manual for comparison and cannot be built.
- **Release:** `(Fire 1 detection OR manual station typed DETECTION) AND P`. Only Fire 1 releases.
  Alert never arms a release and Fire 2 never releases by itself. Low air is never a release input.
  A latched P is never reported as supervisory.
- **Panel failure never releases water.** The panel runs on a 24 h standby battery, reports trouble,
  and a dead panel leaves the solenoid shut. Recovery is the mechanical emergency release by a person.
- **Hazen-Williams C = 100 everywhere:** wet, dry, preaction, interior, yard and underground. Nitrogen
  earns no C-factor credit. A greyed comparison line in the manual and the Site menu quotes the NFPA
  table value; it never touches a calculation.

The **Site** button on the top bar holds the project settings, saved with each map. **In a contract
the dialog is read-only:** the basis of design is fixed by the AHJ, the owner and the insurer. The
settings can be changed in the Sandbox. A contract can fix its own settings through an optional `cfg`
object on the scenario; none does yet, so every contract is winnable with the defaults below.

| Setting | Choices | Default |
|---|---|---|
| Enforced NFPA 13 edition (US) | 2019, 2022, 2025 | 2025 |
| Pipe size cut: largest size on threaded Sch 40 | 1½, 2, 2½, 3 or 4 in. That size and smaller is threaded Sch 40, every larger size roll-grooved Sch 10, main or branch alike | 2 in. (ASSUMED) |
| Fittings allowance on pipe volume | 0 to 50 % | 5 % (ASSUMED) |
| Trim volume per system valve | 0 to 50 gal | 2 gal (ASSUMED) |
| Insurer | none / FM. FM adds the 30 s water-delivery limit at any volume for dry and double interlock (FM DS 5-32) | none |
| Aspirating detection thresholds | four values: Alert, Action, Fire 1, Fire 2. Fire 1 and Fire 2 must sit inside the detector's listed window (0.01 to 5.0 %/ft, ASSUMED placeholder) | 0.03 / 0.06 / 0.12 / 1.2 %/ft (example values) |
| Spot detector alarm threshold | a value inside the listed window 0.5 to 4.0 %/ft (example data) | 1.3 %/ft (ASSUMED) |
| NFPA 76 adopted on this site | no / yes; when yes, plan review fails an Alert above 0.2 or a Fire 1 above 1.0 %/ft, and a preset sets both | no |
| Signal class: aspirating Alert, Action | supervisory / alarm | supervisory (ASSUMED) |
| Signal class: latched P (release input) | not elected (OPEN) / alarm / trouble. Supervisory is blocked | not elected (ASSUMED) |
| Manual Release zone bypasses P | off / on. In a contract an ON bypass is an impairment: a supervisory on the panel and a tag on the valve | off |

The edition changes the citations in plan review and on the trip-test report and shows an "Edition
delta vs 2025" line. Pass and fail do not differ by edition in this version. Water-delivery citations:
2019 §8.2.3.2 / §8.2.3.3 / §8.2.3.4 and Table 8.2.3.6.1; 2025 §8.2.4 and Table 8.2.4.3.2; the
double-interlock exemption is §8.3.2.3.1.1 in both. The 2022 numbers are marked VERIFY. A Canada row
(NFPA 13-2019) exists as hidden data only and is never offered in the menu.

Signals on the annunciator: ALARM, then OPEN (a release input whose class is not elected: the latched
P), then SUPERVISORY, then TROUBLE. Fixed classes: Fire 1, Fire 2, manual station and waterflow are
alarm; low and high air are supervisory; panel AC, battery and a dead panel are trouble.

Each preaction valve carries its own setpoints, loaded from a **maker trim** preset in the valve's
inspector: electric / electric (P sensed by a PSL-REL pressure switch) or electric / pneumatic (P sensed
by a PA-REL pneumatic actuator). The order is always high-air supervisory > normal > low-air
supervisory > P trip, and plan review fails any other order. Dry valves carry their own high-air and
low-air setpoints too.

Two labels are used in the UI and the manual:

- **ASSUMED**: a value the company has not fixed. It is a tunable default, not a rule. Currently:
  preaction setpoints 50 / 40 / 30 / 20 psi (high / normal / low / P trip), a 5 psi minimum margin
  between low air and P trip, the pipe size cut (2 in.) and equal cost per schedule, the fittings
  allowance (5 %) and trim volume (2 gal) in zone volume, the detection example thresholds (0.03 /
  0.06 / 0.12 / 1.2), the spot detector threshold (1.3) inside its 0.5 to 4.0 example window, the
  aspirating Fire 1 / Fire 2 listed window (0.01 to 5.0, a placeholder for the maker's listing), the
  NFPA 76 preset's Action example (0.6), the Alert / Action signal class (supervisory), the banner
  priority of an OPEN item (shown only when nothing else is present), the 24 h panel battery, a dead
  panel reported as a monitored trouble, the contract 5 recovery time bonus target (660 s), and
  Canada = NFPA 13-2019 via NBC 2020 / BCBC 2024 (verify before ship).
- **NEEDS PE REVIEW**: a choice an engineer of record has to make. Currently: the Manual Release zone
  that bypasses P (owner/insurer exception, OFF by default; it applies to the electric / electric trim
  only and shows as an impairment in a contract), the signal classes (Alert and Action, supervisory by
  default; a latched P, class not elected with supervisory blocked), the FM 30 s water-delivery limit
  at any volume (FM DS 5-32), and the lithium-ion / ESS room density and approach (the battery room is
  a placeholder).
- **VERIFY**: a section number or value to check against the edition before it goes into game text.
  Currently: the NFPA 13-2022 section numbers for water delivery and the double-interlock clauses, the
  paragraph numbers inside NFPA 13-2025 §8.2.4, and the section and values of the 24 h air leakage
  test (about 40 psi, 1.5 psi in 24 h).

Simplifications in the release logic: the P sensor goes live the first time a valve is set, so a new
valve does not latch P during its first air-up; after a mechanical emergency release with every
sprinkler closed the trapped air is not vented, so the pipe sits pressurized with no flow; the panel
battery is a flat 24 h of standby plus alarm; a dead panel shows as a monitored trouble (the
supervising station sees the loss of signal); notification appliances are not modelled. In water
delivery: only the timed trip test decides pass or fail (the calculation / table route is named on the
report and not modelled); the inspector's test connection is always present, so the 750 gal
trip-test-connection trigger for double interlock is not modelled; FM is the 30 s limit only.

### Recovery after an incident (contract 5)

An incident on a preaction system starts with an operated head, a latched P or a trip. The recovery is
scored on eight steps, in this order: silence the panel, find the operated head (select it on the
map), close the control valve, open the system drain, replace the head with a matching one, restore
air or nitrogen, reset the trim (the actuator on an electric / pneumatic trim), reset the panel. A
step that does not apply counts as done (no operated head after a trip test; no actuator to reset on
an electric / electric trim). A panel or trim reset counts only once the air is back: an earlier one
latches P again and scores nothing. Contract 5 has a goal for it after the trip tests, and its drill
report shows the steps, the order and a time bonus line (660 s target, informational). The drill has
no hard timer: the false alarm arrives after the 30-minute air-restore window, and an unfinished
recovery still floods the hall.

## Code basis

Rules and numbers follow **NFPA 13** in the edition chosen under Site (default **2025**), with NFPA 20,
NFPA 25 and NFPA 72 for pumps, testing and signals, and the company rules above where they are stricter.
Section references in the game are given at chapter or section level. The edition table in
`src/juris.js` holds the section numbers that differ between 2019, 2022 and 2025 (system area limit,
dry water delivery, double-interlock delivery) and the water-delivery numbers; do not add others without
verifying them. The 2019 and 2025 delivery references are as given by the fire protection lead; the
2022 ones are marked VERIFY. FM references are to FM DS 5-32 as given by the lead. Checked against
published summaries of the 2025 edition while building: the section 8.2 rewrite (gridded dry systems
prohibited in 8.2.1, water delivery in 8.2.4) and the system area limits in 4.4.1. The long-standing
values (500 / 750 gal, 60 s, +30% area, 7 psi supervisory, 30-minute air, 1.5 psi in 24 h, pump curve
limits, NFPA 20 A.14.2.6 pressure settings, 90 s waterflow) are from the author's knowledge of those
standards and were not re-read from the 2025 text. Pipe inside diameters are the Schedule 10 and
Schedule 40 values of the steel pipe dimensions table (ASME B36.10M); 12 in. Schedule 10 is OD 12.750,
wall 0.180, ID 12.390 in. (above-ground headers only; underground and yard pipe is not modelled). Data hall
hazard classification and the battery room are owner- and NFPA 855-driven in real life and are
placeholders here. **Verify anything against the adopted edition before using it on a project.** This is
a trainer, not a calculation tool for a submittal.

## Files

```
double-interlock.html   the game, one file (built)
index.html              the game, loading src/
build-standalone.js     inlines src/ into double-interlock.html
fixtures/
  di-release-truth-table.csv   the fire alarm lead's release truth table, rows R01 to R17 (read by the tests)
review/
  truth-table-check.js         prints the truth table against the engine, row by row
src/
  core.js       constants, units, pipe table by schedule, pipe size cut, C factor, hazard and room tables
  juris.js      enforced-edition table (US 2019 / 2022 / 2025, hidden Canada row), water-delivery numbers, detection presets
  data.js       part catalogue, costs, pump curve, maker trim presets, listed detector windows, signal classes, setting defaults
  world.js      the tile map: pipes, sprinklers, parts, tubing, wires, capped joints, site settings, save migration
  solver.js     global gradient network solver with node capacitance
  systems.js    which pipe belongs to which riser; volumes, remote sprinkler, loops; zone volume and delivery limits
  graph.js      tile map -> reduced hydraulic network
  links.js      how each part appears to the solver; pressure read-back
  gas.js        supervisory gas, P sensor, release state (D, P, solenoid), trip logic, mechanical release, system fill, riser and trim reset
  fire.js       fire growth, sprinkler activation, pipe breaks, water and smoke damage, freeze, corrosion
  alarm.js      detection stages, signals and classes, manual stations, panel reset and silence, recovery score, fire department, technician
  sim.js        tick loop, pump controllers, tank, commissioning, fast-forward, save/load
  calc.js       density/area hydraulic calculation
  review.js     plan review rules
  proc.js       test procedures (trip, inspector's, main drain, pump, air, churn)
  scen*.js      scenario toolkit and the seven contracts + sandbox
  manual.js     the in-game field manual
  glyphs.js render.js input.js inspect.js ui.js audio.js main.js style.css   the front end
test/
  solver.test.js  graph.test.js  sim.test.js  proc.test.js   engine tests against hand calcs
  truth-table.js              runs the truth-table fixture against the engine (used by sim.test.js and review/)
  campaign.test.js  bot.js    plays every contract headlessly with a reference solution and an operator
  ui.play.js  ui.c2.js  shot.js   browser tests (Playwright): a full contract by mouse and keyboard, and the Cycle 2 UI checks
```

About 3,300 lines of vanilla JavaScript, no dependencies, no assets. Sound is generated.

## Tests

```
node test/solver.test.js      # pump points, parallel split, check valves, bleed-down
node test/graph.test.js       # tile map against a hand Hazen-Williams calculation
node test/sim.test.js         # wet / dry / double interlock / pump behaviour end to end, plus the
                              # company-lock acceptance checks (A1 onward), the release truth table
                              # read from fixtures/ (A19) and static source greps
node test/proc.test.js        # commissioning procedures
node test/campaign.test.js    # all seven contracts: goals met, drill passed, cost reported; then an
                              # informational what-if with the insurer set to FM (not counted)
node review/truth-table-check.js   # the truth table against the engine, one line per row
node test/ui.play.js out.png  # needs Playwright: plays contract 1 with real input events
node test/ui.c2.js out.png    # needs Playwright: Site gate and round-trip, P latch and both reset
                              # paths, dead panel, stage order, mechanical release, impairment tag
```

`test/bot.js` holds a working layout for every contract. Those are spoilers.

## Ideas not built

Elevation and multi-storey risers, looped yard mains with hydrants as a scored objective, a first-person riser room for the trim-level procedures, hot-aisle
containment as an obstruction rule, and exporting a calc sheet.

Planned for later cycles: a contract that pairs a dead panel with the mechanical emergency release,
the calculation / table route for water delivery, underground and yard pipe material, the rest of the FM
overlay (density / area, hose and duration; hazard classes by insurer with lithium-ion rooms as an ESS
off-ramp), a contract that sets the insurer to FM, a cause-and-effect view per preaction zone, NAC
modelling, battery basis and supervising-station behaviour, and real Canada edition rules once verified.
