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
| 5 | Double Interlock | Preaction for a 48,000 sq ft data hall | The two interlocks (detection AND P), aspirating stages, zone volume and the 500 gal tip-over (pass the 60 s timed test or rezone), the thirteen-step recovery in order, why a latched P is reset only after the air is back, why the control valve is reopened last |
| 6 | Rust Never Sleeps | Nitrogen retrofit on a corroded system | Oxygen corrosion, the 24 h air test (40 psi, end reading 38.5 psi or more) and how a failed one can leave P latched, fill-and-purge to 98%, and why nitrogen earns no pipe-size credit (C stays 100) |
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
  all come from that bookkeeping. Air out an open drain is air: it shows as falling pipe pressure and
  compressor run time, never as water flow or gallons. The waterflow alarm needs water, not air
  pressure behind a tripped clapper. Each zone has its own air / N₂ supply isolation, and losing every
  source on a zone (power or a failed unit) is its own trouble, LOSS OF SUPPLY AIR, beside the low-air
  supervisory. A shut supply valve is an impairment, shown as a tag (an amber IMPAIRMENT TAGS strip and a
  line on the valve), not as a signal: low air still comes in only when the gauge actually falls.
- **Air refill.** Every dry and preaction valve has a **Refill clock** against the 30-minute limit
  (first gas into the closed-up zone to normal pressure: OK or FAIL), an **Air supply sizing** row, and
  a **Skip the refill** button that skips ahead until the zone is back at normal (2 h at most). Plan
  review warns when the compressor is below `scfm_min = V_ft3 x (P_normal / 14.7) / 30` on the largest
  zone it serves, or below a x1.25 margin. The lesson is that recovery time is mostly compressor time.
- **Valve logic.** Differential dry valve (about 5.5 : 1). Preaction is double interlock only:
  release = (D AND P) OR (bypass 9(c) AND Manual Release zone), where D = Fire 1 detection OR the
  manual station typed DETECTION. D is a level check (at or above Fire 1). P is pipe pressure below the
  valve's P trip setpoint, from any opening big enough to beat the compressor (sprinkler, inspector's
  test, broken pipe) or a slow leak nobody attended to, and it latches until a manual reset. The second
  path exists only where the project flag is ON on an electric / electric trim: the Manual Release zone
  is not detection, never latches D, and latches its own release until the panel is reset. The valve's
  inspector names the acting path in a **Release path** row (`(D AND P) armed`, `Manual Release zone
  BYPASS ARMED`, `Manual Release zone RELEASING - without P`). Low and high air are supervisory only.
  A separate mechanical emergency release at the trim opens the valve by hand, outside the panel logic.
  The solenoid is energize-to-release, so a dead panel never releases water. The release model follows
  the fire alarm lead's truth table (`fixtures/di-release-truth-table.csv`, rows R01 to R17). That file
  is the lead's, copied byte for byte and pinned by hash; the tests read it directly and check it
  against its own release formula before playing a row:

  | Trim | P sensed by | Solenoid energized on | Valve opens on | P is reset |
  |---|---|---|---|---|
  | Electric / electric | pressure switch PSL-REL, latched in the panel | D AND P | D AND P | at the releasing panel |
  | Electric / pneumatic | pneumatic actuator PA-REL, at the valve | D alone | D AND P | at the actuator, at the trim |

  A panel reset clears the panel's latches and then reads every input again, so a live input comes
  straight back. A reset while the pipe is still below P trip latches P again. A tripped valve is reset
  by hand at the riser: a panel reset never closes it, and the riser reset never clears P. The riser
  reset is done with the system drain still open and leaves the drain as it is.
- **A dead panel.** On AC failure the panel shows the trouble at once and runs on its battery. The
  supervising station is told only after the AC-fail delay (60 to 180 min, a site setting; power back
  sooner and nothing is sent). LOW BATTERY comes in at the battery's listed low-voltage setpoint
  (shown as 1/12 of capacity left), then the panel dies. Dead means dark: no display, no LEDs, nothing
  to silence or reset (the buttons are disabled and say why). The status bar reads PANEL DEAD at once.
  The supervising station's loss-of-communication line appears only after its supervision interval
  (60 min on a single IP path), and the valve rows the panel feeds read `not displayed: panel dead`.
  On an electric / electric trim the P latch lives in the panel, so it is lost with the panel and read
  again when power returns: P comes back if the pipe is still low. Power coming back is not a release;
  the inputs are.
- **A water-filled zone.** With P left latched, one detection event trips the valve and fills the
  pipe. If a head is open it discharges. If every head is closed nothing discharges: the zone is
  water-filled, which is logged as an unattended low-air failure, not a discharge, and has to be
  drained and reset.
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
  an electrical / UPS room), wired manual release stations, panel Silence and Reset, a read-only
  cause-and-effect matrix per preaction zone, a recovery log that
  tracks the thirteen restore steps in order, a head-replacement gate and a control-valve reopen gate,
  pipe breaks, a sound cue per signal class, and a technician you can send while a fire is still
  smouldering.

Simplified on purpose: one sprinkler per 10 ft tile, fittings as a flat 30% equivalent length,
elevation ignored except tank level, single-storey buildings, no hangers or seismic bracing, smoke as
one number per room, corrosion as one number per system. The in-game manual has a page on this.

## Company rules and site settings

The sim obeys a set of company locks. They are not options.

- **Systems:** wet, dry and double-interlock preaction only. Single- and non-interlock preaction are
  mentioned in the manual for comparison and cannot be built.
- **Release:** `(D AND P) OR (Bypass9c AND ManualReleaseZone)`, with `D = Fire 1 detection OR manual
  station typed DETECTION` and the second term on an electric / electric trim only (OFF by default,
  NEEDS PE REVIEW). Only Fire 1 releases. Alert never arms a release and Fire 2 never releases by
  itself. Low air is never a release input. A latched P is never reported as supervisory.
- **Panel failure never releases water.** The panel runs on a 24 h standby battery, reports trouble,
  and a dead panel leaves the solenoid shut. Recovery is the mechanical emergency release by a person.
- **Fixtures belong to the Lead who owns them.** `fixtures/di-release-truth-table.csv` is copied
  verbatim and never edited or reformatted in this repository. `test/truth-table.js` pins the sha256 of
  the raw bytes (first 16 hex, `cb3462b268359c6e`); a new Lead file is copied byte for byte and the pin
  is updated in the same commit. If the engine and the fixture disagree, the file is not what changes.
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
| Aspirating detector model | VESDA-E VEP / VESDA-E VEU. Sets the listed range of every stage. Changing it never changes a threshold | VEP |
| Aspirating detection thresholds | four values: Alert, Action, Fire 1, Fire 2. Each must sit inside its own listed range for the model, and they must run strictly increasing. A value outside the range is kept as typed, shown red and failed by plan review: nothing is clamped | 0.03 / 0.06 / 0.12 / 1.2 %/ft (owner-set example values: ASSUMED, NEEDS PE REVIEW) |
| Spot detector alarm threshold | a value inside the listed window 0.5 to 4.0 %/ft (example data) | 1.3 %/ft (ASSUMED) |
| NFPA 76 adopted on this site | no / yes; when yes, two ceilings are checked: Alert 0.2 %/ft or less, and Fire 1 (the first alarm stage) 1.0 %/ft or less. PRACTICE, NEEDS PE REVIEW | no |
| Signal class: aspirating Alert, Action | supervisory / alarm | supervisory (ASSUMED) |
| Signal class: latched P (release input) | not elected (OPEN) / alarm / trouble. Supervisory is blocked | not elected (ASSUMED) |
| Manual Release zone bypasses P | off / on. In a contract an ON bypass is an impairment: a supervisory on the panel and a tag on the valve | off |
| Supervising-station path (OWNER) | single IP path (a dead panel is annunciated after 60 min) / multiple paths (6 h) / DACT (6 h, its test interval: ASSUMED) | single IP path (PRACTICE) |
| AC-fail transmission delay (OWNER / AHJ) | 60, 90, 120, 150 or 180 min before an AC failure is sent to the supervising station | 60 min |
| HVAC shutdown / damper hook (OWNER, NEEDS PE REVIEW) | none / CRAH or AHU shutdown / damper. Shown in the cause-and-effect matrix only | none |
| EPO / power isolation hook (OWNER, NEEDS PE REVIEW) | off / on (an NEC 645, FM DS 5-32 election). Shown in the cause-and-effect matrix only | off |

The edition changes the citations in plan review and on the test reports and shows an "Edition
delta vs 2025" line. Pass and fail do not differ by edition in this version. NFPA 13-2022 keeps the
2019 numbering for delivery; the renumber to §8.2.4 is 2025. Citations per edition (fire protection
lead; a 2022 key carried from 2019 is shown with `(ASSUMED, VERIFY)` in the game):

| Reference | 2025 | 2022 | 2019 |
|---|---|---|---|
| 60 s timed trip test | §8.2.4.2 | §8.2.3.2 (ASSUMED, VERIFY) | §8.2.3.2 |
| 500 gal, no quick-opening device | §8.2.4.2.1 | §8.2.3.3 (ASSUMED, VERIFY) | §8.2.3.3 |
| 750 gal with a quick-opening device | §8.2.4.2.2 | §8.2.3.4 (ASSUMED, VERIFY) | §8.2.3.4 |
| Listed calculation route | §8.2.4.3.1 | §8.2.3.5 to .6 (ASSUMED, VERIFY) | §8.2.3.5 to .6 (VERIFY) |
| Delivery table by hazard | Table 8.2.4.3.2 | Table 8.2.3.6.1 (verified) | Table 8.2.3.6.1 |
| Manifold (information only) | §8.2.4.4 | §8.2.3.7 (verified) | not given |
| Other listed times (information only) | §8.2.4.5 | §8.2.3.8 (ASSUMED, VERIFY) | not given |
| Double-interlock exemption | §8.3.2.3.1.1 | §8.3.2.3.1.1 to .4 (verified) | §8.3.2.3.1.1 |
| QOD on double interlock | §8.3.2.3.2 | §8.3.2.3.2 (verified) | §8.3.2.3.2 |
| 24 h air test | §29.2.2.1 (verified) | §29.2.2.1 (verified) | §28.2.2.1 (verified) |
| Air supply restores normal pressure in 30 min | §8.2.7.3 | §8.2.6.3.2 | §8.2.6.3.2 |
| The same, N₂-only source | not pulled | §8.2.6.8.4 | §8.2.6.8.4 |

A Canada row (NFPA 13-2019) exists as hidden data only and is never offered in the menu.

**24 h air test** (dry and double interlock, the same values in every edition): 40 psi air held 24 h,
and a loss over 1.5 psi must be corrected. Pass is an end reading of 38.5 psi or more. The test starts
at test pressure: a zone sitting lower is charged to 40 psi first (the game does this, a simplification)
and a zone above 40.5 psi is refused until it is bled down. If the zone cannot reach 40 psi in 30 min
the test fails. The report gives the test pressure, the start and end readings, the pass line with the
section of the enforced edition, and the drop. It never mentions P: a test that leaks below P trip
leaves P latched (that is PSL-REL doing its job), and the panel event log says so. After the test the
supply is restored. Where the zone's normal pressure is 40 psi nothing more is needed; where it is lower
the pipe is left high and the valve shows a practice step, "return to normal pressure": bleed at the
system drain or at the trim, close up, and confirm the pipe sits above low air.

**Air refill.** The air supply must restore normal pressure within 30 minutes (sections in the table
above). The valve's Refill clock measures it. Compressor sizing follows from the volume:
`scfm_min = V_ft3 x (P_normal / 14.7) / 30` on the largest zone a source serves, plus a x1.25 margin
(ASSUMED practice). A 525 gal zone (70.2 ft³) at 40 psi needs about 6.4 scfm, about 8 with the margin.
Plan review warns below the minimum and below the margin and never fails on it: the game calls a zone
back at normal 3.2 psi under its setpoint, so the measured clock is the authority. One compressor
serving several zones refills them all at once here, so commissioning fills on a shared compressor can
read over 30 min (contract 5's reference build: 30.3 and 35.6 min on one 10 scfm unit). Nothing but
contract 2's existing dock goal reads a fill time. The 60-minute limit for refrigerated spaces below 5 °F
is not modelled, and the 2025 acceptance wording (§29.2.3.2.4.1) is from a search, not verbatim: VERIFY.

**Aspirating detector models.** Each listing bounds every threshold per stage, per model. The ranges
are read from the maker's own datasheets, labelled **[HB, datasheet; UL Product iQ not checked]**
wherever they are shown: the UL Product iQ listing itself could not be read.

| Model | Alert | Action | Fire 1 | Fire 2 | Datasheet |
|---|---|---|---|---|---|
| VESDA-E VEP (VEP-A00-1P-UL, VEP-A00-P-UL, VEP-A10-P-UL), default | 0.0015 to 0.614 | 0.0015 to 0.614 | 0.0030 to 0.614 | 0.0061 to 6.575 | Xtralis Doc. 36106_07, Part AD36106-007, July 2025, p. 2 |
| VESDA-E VEU (VEU-A00-UL, VEU-A10-UL) | 0.0003 to 0.614 | 0.0003 to 0.614 | 0.0003 to 0.614 | 0.0003 to 6.575 | Xtralis Doc. 36107_05, Part AD36107-005, November 2024, p. 2 |

Units are %/ft obscuration. The datasheets print setting ranges, not default thresholds, so the four
example values stay owner-set, ASSUMED and NEEDS PE REVIEW. Recorded, not modelled: VESDA-E VEA. Its
Enhanced Fire 1 is 1.23 %/ft (Xtralis Doc. 36348_03, primary); the Gamewell sheet prints 1.3, an OEM
variant kept as a note only. It has discrete Fire 1 settings of 0.5 / 1.23 / 2.5 %/ft and no printed
Alert or Action, and no Fire 2 value was pulled, so it cannot be a four-stage model yet. Not offered
either: FAAST LT-200 and FLEX (no UL 268 or FM listing on the sheets), TITANUS PRO·SENS and FAAST XM /
XS (conflicting or non-current sheets).

**NFPA 76 where adopted.** Two plain ceilings (NFPA 76-2024 §8.5.3.1.2.5): Alert 0.2 %/ft or less,
and the 1.0 %/ft alarm ceiling applied to Fire 1, the first alarm stage. Action stays pre-alarm and
Fire 2 has no NFPA 76 limit (PRACTICE, NEEDS PE REVIEW). There is no conflict with the listing: the
listed Fire 1 maximum (0.614 %/ft on both models) is tighter, so the listing binds first, and the Site
dialog and plan review say so in one note. Plan review fails an Alert above 0.2 or a Fire 1 above 1.0.
"Check against NFPA 76" in the Site dialog reads the thresholds against the two ceilings and writes
nothing. An old save that still carries the retired alarm-stage election loads, and the key is ignored.

Signals on the annunciator: ALARM, then OPEN (a release input whose class is not elected: the latched
P), then SUPERVISORY, then TROUBLE, each with its own sound. Fixed classes (one registry,
`DI.SIG_FIXED`, read by the alarm code and by the cause-and-effect matrix): Fire 1, Fire 2, manual
station, release circuit and waterflow are alarm; low and high air and valve tamper are supervisory;
panel AC failure, low battery, loss of communication with a dead panel and loss of supply air are
trouble. Loss of supply air is equipment trouble, its own signal (PRACTICE, settled by the fire alarm
lead); the pressure drop it causes is still reported by the low-air supervisory.

**Cause-and-effect matrix.** Each preaction valve, and the releasing panel for each zone wired to it,
opens a read-only matrix for that zone. Columns: Input, Tag, SignalClass, PanelAnnunciation,
SS_Transmit, LocalNAC, Solenoid, HVAC_Hook, EPO_Hook. Rows: Alert, Action, Fire 1, Fire 2, the manual
station, the Manual Release zone, P, the release (on AC, on battery, with the panel dead), waterflow,
tamper, low and high air, loss of supply air, AC failure, low battery and loss of communication. The
table is generated from the engine (`DI.ceEval`: classes from the registry, the release from
`DI.relState` on the zone's own trim and bypass setting), and the tests hold all 17 rows of the truth
table as matrix = fixture = engine. Rows active on the zone are marked ACTIVE NOW. LocalNAC is a rule
read from the class (alarm only), not a circuit. The two hook columns show an output contact where the
owner has elected one in the Site dialog; they are hooks only, and the game never shuts down a fan, a
damper or power. Which rows carry a hook is ASSUMED, NEEDS PE REVIEW. Not in the matrix: elevator
recall, door release, compressor control, battery sizing and notification circuits.

**Supervising-station timing (NFPA 72).** The NFPA 72 edition follows the site's NFPA 13 edition
(ASSUMED). A trouble shows at the panel within 200 s (§10.15.1; the game shows it at once). An AC
failure is transmitted after 60 to 180 min (§10.6.9.3; a site setting, default 60). A dead panel is
annunciated by the supervising station after its supervision interval, by path:

| Path | Delay | 2019 / 2022 | 2025 |
|---|---|---|---|
| Single IP path (default, PRACTICE) | 60 min | §26.6.3.3(2) | §26.6.3.3.2(2) (annunciated per §10.15) |
| Multiple paths | 6 h | §26.6.3.4(2) | §26.6.3.4(1): only the 6 h supervision interval was found, VERIFY |
| DACT | 6 h, the test interval (ASSUMED, VERIFY) | 2019 §26.6.4.1.5(6), §26.6.4.2.2(H); 2022 §26.6.4.2.5(6), §26.6.4.3.2.8 | §26.6.4.2.5(6), §26.6.4.3.2.8 |

Low battery has no code threshold (§10.6.9.1; §10.6.10.6 is charger failure): the trouble is the
listed manufacturer's low-voltage setpoint, represented as 1/12 of battery capacity left.

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
  0.06 / 0.12 / 1.2, owner-set inside the model's listed range), the spot detector threshold (1.3)
  inside its 0.5 to 4.0 example window, the Alert / Action signal class
  (supervisory), the banner priority of an OPEN item (shown only when nothing else is present), the
  24 h panel battery, the low-battery setpoint as 1/12 of battery capacity left (the listed voltage
  setpoint, OWNER/listing) and low battery being transmitted at once, the NFPA 72 edition following
  the NFPA 13 site edition, the DACT delay (its 6 h test interval) and the 6 h on multiple paths in
  2025, the x1.25 compressor sizing margin, which matrix rows carry the HVAC and EPO hooks, the
  electric / electric P latch being lost with panel power and read again on restore, 0.5 psi as "about
  0 psi" before a head is replaced (the gate itself is confirmed by the fire protection lead; the
  value is assumed), the automatic "confirm 0 psi and no water" step, the 24 h air test starting once
  the gauge reads 40.0 (0.005 psi) with 30 min allowed to charge, the game charging the zone itself,
  the operator log size (600 entries), the sound pattern per signal class, the contract 5 recovery
  time bonus target (300 s of operator-step time), the 2022 delivery sections still carried from 2019,
  and Canada = NFPA 13-2019 via NBC 2020 / BCBC 2024 (verify before ship).
- **NEEDS PE REVIEW**: a choice an engineer of record has to make. Currently: the Manual Release zone
  that bypasses P (owner/insurer exception, OFF by default; it applies to the electric / electric trim
  only, is a separate latched release path and not detection, and shows as an impairment in a
  contract), the signal classes (Alert and Action, supervisory by default; a latched P, class not
  elected with supervisory blocked), the FM 30 s water-delivery limit at any volume (FM DS 5-32), the
  aspirating default thresholds (owner-set inside the model range; the datasheets print none), the
  NFPA 76 ceilings applied to Alert and to Fire 1 with Action as pre-alarm (PRACTICE), the HVAC and
  EPO hooks (the election, the rows they appear on, the NEC 645 / FM DS 5-32 interface), the
  low-battery setpoint (a listed manufacturer value), the AC-fail transmission delay and the
  supervising-station path type, and the lithium-ion / ESS room density and approach (the battery room
  is a placeholder). Settled and off this list: loss of supply air is trouble (PRACTICE).
- **VERIFY**: a section number or value to check against the edition before it goes into game text.
  Currently: the NFPA 13-2022 delivery numbers carried from 2019 (§8.2.3.2, §8.2.3.3, §8.2.3.4,
  §8.2.3.5 to .6, §8.2.3.8), the 2019 calculation-route paragraphs, the 2025 acceptance wording for
  the refill time (§29.2.3.2.4.1) and the 2025 N₂-only refill subsection, the NFPA 72-2025 annunciation
  time on multiple paths and the deadline for a missed DACT test, and the aspirating ranges against the
  UL Product iQ listing (not checked; no access is to be bought for it).

Simplifications in the release logic: the P sensor goes live the first time a valve is set, so a new
valve does not latch P during its first air-up; after a mechanical emergency release with every
sprinkler closed the trapped air is not vented, so the pipe sits pressurized with no flow; the panel
battery is a flat 24 h of standby plus alarm; a dead panel's P latch is lost and read again, not
stored; a compressor's own low-air alarm on a separate supply is not modelled; notification appliances
are not modelled. On the fire alarm side: the cause-and-effect matrix covers preaction zones only;
LocalNAC is a rule from the signal class, not a circuit; hooks are display-only and never act; the
panel shows power troubles at once (inside the 200 s ceiling); the supervising station learns of a dead
panel after one fixed supervision interval; AC-fail transmission uses a fixed delay, not a random one;
the impairment strip is a tag, not a signal. In the air supply: the refill clock runs from the first
gas into the closed-up zone; the operator-step score leaves out the interval the zone is closed up and
filling; zones on one compressor refill at the same time, so shared refills run longer than the sizing
check implies; the sizing check adds up a zone's sources, a nitrogen generator included; the "return to
normal" step after an air test is practice only. In testing and
recovery: the 24 h air test is charged to 40 psi by the game; the "confirm 0 psi and no water" step
is automatic when the conditions hold; only the system (low-point) drain is scored and the
supply-side main drain is optional; a zone with no upstream control valve skips the water-isolation
test before a head is replaced; only the control valve nearest upstream is checked on reopening. In water
delivery: only the timed trip test decides pass or fail (the calculation / table route is named on the
report and not modelled); the inspector's test connection is always present, so the 750 gal
trip-test-connection trigger for double interlock is not modelled; FM is the 30 s limit only.

### Recovery after an incident

An incident on a preaction system starts with an operated head, a latched P or a trip. There is one
recovery sequence of thirteen steps, in the physical order. It is generic practice (NFPA 25 and maker
IOMs, confirmed by the fire protection lead); the valve maker's IOM governs the specifics.

| # | Step | Does not apply when |
|---|---|---|
| 1 | Silence the panel | no panel, or the panel is dead |
| 2 | Find the operated head (select it on the map) | no head opened |
| 3 | Close the zone control valve (supervisory) | no control valve upstream |
| 4 | Isolate the air / N₂ supply to the zone | no air or N₂ source |
| 5 | Open the drain; confirm 0 psi and no water (automatic at 0.5 psi or less with the pipe empty) | never |
| 6 | Panel reset #1: clear D, solenoid off | detection never latched, or no live panel |
| 7 | Replace the head: same type, K, temperature, response | no head opened |
| 8 | Reset the valve (clapper) at the riser, drain still open | the valve did not trip |
| 9 | Close the drain | never |
| 10 | Restore air / N₂ and confirm it holds above low air | never |
| 11 | Reset the trim | electric / electric trim |
| 12 | Panel reset #2: clear P and troubles | no live panel |
| 13 | Slowly open the control valve fully; confirm no flow, all normal | no control valve upstream |

A step that does not apply counts as done. Two panel resets, for two reasons: #1 so detection drops
out and the clapper can be reset (the riser reset is refused while D is latched), #2 after the air is
back, which is what clears P; an earlier one latches P again and scores nothing. After a trip the
clapper is reset before the air is restored, with the drain still open, and the drain is closed
afterwards: air restored first is not held.

Two gates enforce the parts that are physical:

- **Replacing a head** on a dry or preaction system needs the control valve closed, the air / N₂
  supply isolated, and the pipe water-free at about 0 psi. The drain may be open or closed. Each
  missing condition has its own message.
- **Reopening the control valve** is refused in one place only: the scored incident of a running
  drill, until the zone will hold (D and the solenoid reset, the clapper reset, P clear, and the pipe
  air above low air). Opened earlier, the valve trips again. Anywhere else (a practice recovery after
  a trip test, the Sandbox, an incident from before the drill) the valve opens, and a warning lists
  what is still open, each item naming the zone: a head not replaced, D still latched, the riser valve
  still tripped, air below low air, P still latched, the drain open, the air supply isolated, a dead
  panel. The same list is on the valve's recovery checklist, and a `reopen-warn` entry goes in the
  operator log. A dead panel is a warning, never a refusal: it cannot release anything.

Only the broken-sprinkler incident in the contract 5 drill is scored: 13 of 13 in order earns the
star. The time bonus reads operator-step time only, against a 300 s target (ASSUMED, informational).
The air refill is compressor time and has its own informational line against the 30-minute limit
("Air refill: 12.2 min, limit 30 min: OK", or FAIL), with the total beside it. Neither line can fail
the drill. Every other
recovery, after a trip test or in the Sandbox, is practice: the valve's inspector shows a **Recovery
checklist (PRACTICE)** with each step done, pending or not applicable, and no goal reads it. The drill
has no hard timer: the false alarm arrives after the 30-minute air-restore window. If P is still
latched then, the valve trips and the pipe fills; with the head replaced nothing discharges and the
report adds a water-filled-zone line.

The reference operator in `test/bot.js` does the drill recovery 13 of 13 in order in about 755 s. Its
own steps take about 23 s; the other 732 s is one 10 SCFM compressor bringing a 364 gal zone back from
0 psi to normal. That is realistic, and it is the lesson: recovery time is mostly compressor time.

## Code basis

Rules and numbers follow **NFPA 13** in the edition chosen under Site (default **2025**), with NFPA 20,
NFPA 25 and NFPA 72 for pumps, testing and signals, and the company rules above where they are stricter.
Section references in the game are given at chapter or section level. The edition table in
`src/juris.js` holds the section numbers that differ between 2019, 2022 and 2025 (system area limit,
dry water delivery, double-interlock delivery, the 24 h air test) and the water-delivery numbers; do
not add others without verifying them. The delivery and air-test references are as given by the fire
protection lead from the NFPA LiNK notes: 2025 is held, 2022 is verified where the table above says so
and otherwise carried from 2019 and marked (ASSUMED, VERIFY), and the air-test and 30-minute refill
sections are verified in all three editions. The air-test values (40 psi, 1.5 psi, 24 h) are the
lead's and are the same in every edition. The NFPA 72 timing sections (supervising-station paths,
AC-fail delay, trouble at the panel, battery monitoring) are from the fire alarm lead's pull and live
in the same table as `ref72`. Aspirating detector ranges are from the maker's datasheets (document numbers above),
not from the UL listing itself. FM references are to FM DS 5-32 as given by the lead. Checked against
published summaries of the 2025 edition while building: the section 8.2 rewrite (gridded dry systems
prohibited in 8.2.1, water delivery in 8.2.4) and the system area limits in 4.4.1. The long-standing
values (500 / 750 gal, 60 s, +30% area, 7 psi supervisory, 30-minute air, pump curve
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
package.json            npm scripts for the tests; Playwright is the only devDependency (browser tests only)
fixtures/
  di-release-truth-table.csv   the fire alarm lead's release truth table, rows R01 to R17: copied verbatim, pinned by sha16, never edited here
review/
  truth-table-check.js         prints the truth table against the engine, row by row
src/
  core.js       constants, units, pipe table by schedule, pipe size cut, C factor, hazard and room tables
  juris.js      enforced-edition table (US 2019 / 2022 / 2025, hidden Canada row), delivery, air-test and refill citations, NFPA 72 timing citations, water-delivery numbers, NFPA 76 ceilings
  data.js       part catalogue, costs, pump curve, maker trim presets, aspirating detector models and their listed ranges, signal class registry, panel power and supervising-station tables, setting defaults
  world.js      the tile map: pipes, sprinklers, parts, tubing, wires, capped joints, site settings, save migration
  solver.js     global gradient network solver with node capacitance
  systems.js    which pipe belongs to which riser; volumes, remote sprinkler, loops; zone volume and delivery limits
  graph.js      tile map -> reduced hydraulic network
  links.js      how each part appears to the solver; pressure read-back
  gas.js        supervisory gas, P sensor, release state (D, P, Manual Release zone, solenoid), trip logic, water-filled zone, mechanical release, system fill, refill clock and compressor sizing, riser and trim reset
  fire.js       fire growth, sprinkler activation, pipe breaks, head-replacement gate, water and smoke damage, freeze, corrosion
  alarm.js      detection stages, listed-range and NFPA 76 checks, signals with their transmission delays, manual stations, dead panel, impairment tags, panel reset and silence, recovery score, fire department, technician
  cause.js      the cause-and-effect matrix of a preaction zone, generated from the class registry and the release state; hook elections
  sim.js        tick loop, pump controllers, control-valve reopen gate, operator log, tank, commissioning, fast-forward, save/load
  calc.js       density/area hydraulic calculation
  review.js     plan review rules
  proc.js       test procedures (trip, inspector's, main drain, pump, air, churn)
  scen*.js      scenario toolkit and the seven contracts + sandbox
  manual.js     the in-game field manual
  glyphs.js render.js input.js inspect.js ui.js audio.js main.js style.css   the front end
test/
  solver.test.js  graph.test.js  sim.test.js  proc.test.js   engine tests against hand calcs
  truth-table.js              pins and self-checks the truth-table fixture, then runs it against the engine (used by sim.test.js and review/)
  campaign.test.js  bot.js    plays every contract headlessly with a reference solution and an operator
  ui.play.js  ui.c2.js  ui.c3.js  ui.c4.js  shot.js   browser tests (Playwright): a full contract by mouse and keyboard, and the Cycle 2, 3 and 4 UI checks
```

About 4,100 lines of vanilla JavaScript, no runtime dependencies, no assets. Sound is generated.

## Tests

```
node test/solver.test.js      # pump points, parallel split, check valves, bleed-down
node test/graph.test.js       # tile map against a hand Hazen-Williams calculation
node test/sim.test.js         # wet / dry / double interlock / pump behaviour end to end, plus the
                              # company-lock acceptance checks (A1 onward), the release truth table
                              # read from fixtures/ (A19), the Cycle 3 checks (A31 onward: fixture pin,
                              # Manual Release zone, dead panel, air test, drain and air, recovery,
                              # supply air, citations, detector ranges), the Cycle 4 checks (A42 onward:
                              # matrix = fixture = engine, NFPA 76 ceilings, refill clock and sizing,
                              # reopen gate scope, impairment tag, edition keys, return to normal,
                              # supervising-station timing) and static greps
node test/proc.test.js        # commissioning procedures
node test/campaign.test.js    # all seven contracts: goals met, drill passed, cost reported; then an
                              # informational what-if with the insurer set to FM (not counted)
node review/truth-table-check.js   # the truth table against the engine, one line per row
node test/ui.play.js out.png  # needs Playwright: plays contract 1 with real input events
node test/ui.c2.js out.png    # needs Playwright: Site gate and round-trip, P latch and both reset
                              # paths, dead panel, stage order, mechanical release, impairment tag
node test/ui.c3.js out.png    # needs Playwright: Manual Release zone path, dead panel, head gate,
                              # recovery checklist and reopen gate, 24 h air test, supply air and the
                              # water-filled zone, detector model and the NFPA 76 ceilings
node test/ui.c4.js out.png    # needs Playwright: cause-and-effect matrix, NFPA 76 check, refill clock
                              # and skip, the reopen gate in both modes, impairment tag, station timing
```

`npm test` runs the five engine suites and `npm run test:ui` the four browser tests. `npm install`
is needed only for the browser tests (it fetches Playwright); the game itself has no dependencies and
still runs from `file://`.

`test/bot.js` holds a working layout for every contract. Those are spoilers.

## Ideas not built

Elevation and multi-storey risers, looped yard mains with hydrants as a scored objective, a first-person riser room for the trim-level procedures, hot-aisle
containment as an obstruction rule, and exporting a calc sheet.

Planned for later cycles: a contract that pairs a dead panel with the mechanical emergency release
(the dead-panel behaviour it needs is in), the calculation / table route for water delivery,
underground and yard pipe material, the rest of the FM overlay (density / area, hose and duration;
hazard classes by insurer with lithium-ion rooms as an ESS off-ramp), a contract that sets the insurer
to FM, the rest of the fire alarm phase-in after the cause-and-effect matrix (the signal schedule and
the supervising-station view, then battery and standby with charger failure, then notification
circuits, when the LocalNAC column becomes a simulated output), matrices for dry and wet valves, a DACT
channel-failure model and two-way radio paths, a drill that fails a compressor and fills a zone on the
clock, a plan-review finding for missing supply-air supervision, a compressor's own low-air alarm on
a separate supply, refrigerated spaces (the 60-minute refill) with a freezer room type and sequential
refill on a shared compressor, more aspirating models (VEA once its Fire 2 behaviour is pulled from a
datasheet; TITANUS and FAAST once consistent current sheets are held) and a UL Product iQ check of
every listing, and real Canada edition rules once verified.
