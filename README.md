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

### Windows desktop app

Download **Double-Interlock-1.0.0-windows-x64-setup.exe** from
[GitHub Releases](https://github.com/Abe-Borg/double-interlock/releases/latest) and run it.
Supports Windows 10/11 on 64-bit Intel/AMD PCs. Setup installs for your account without administrator
rights and adds a Start menu shortcut. If Microsoft Edge WebView2 is missing, setup installs it
(internet required for that step). After installation, the game runs offline.

The desktop app uses **Tauri 2 + WebView2**: a small native shell around the same canvas simulation,
using Windows' Chromium-based engine with hardware acceleration. The simulation keeps its existing
per-frame work budget. It does not bundle Electron or require Node.js on your PC.

Choose **Check for updates** on the contracts menu. It checks the latest stable GitHub release and
offers its Windows installer. Close the game and run the downloaded installer to upgrade; saved
progress stays in the app's WebView2 profile. Browser saves are separate. Update checks happen only
when requested. The installer is unsigned, so Windows may show a SmartScreen prompt.

See [desktop development and releases](docs/windows-desktop.md) for building and releasing.

### Browser / portable HTML

Double-click **`double-interlock.html`** (Chrome or Edge). One self-contained file, no install, no
server, no network. Progress saves in the browser.

- `double-interlock.html` is the whole game in one file. Send it to anyone.
- `index.html` is the same game loading the readable sources from `src/`. It also runs from `file://`.
- After editing anything in `src/`, rebuild the single file with `node build-standalone.js`.

Mouse and keyboard, desktop. The workspace adapts to the window, with a fitted site view, equipment category tabs, and an inspector that opens when you select a device. Press `F` for Focus view and `Home` to fit the whole site. A 1600 x 900 window or larger shows more detail.

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
| 5 | Double Interlock | Preaction for a 48,000 sq ft data hall | The two interlocks (detection AND P), aspirating stages, zone volume and the 500 gal tip-over (pass the 60 s timed test or rezone), the thirteen-step recovery in order (fourteen in the drill, which ends with the main drain test) and stopping the water fast, why a latched P is reset only after the air is back, why the control valve is reopened last |
| 6 | Rust Never Sleeps | Nitrogen retrofit on a corroded system | Oxygen corrosion, the 24 h air test (40 psi, end reading 38.5 psi or more) and how a failed one can leave P latched, fill-and-purge to 98%, and why nitrogen earns no pipe-size credit (C stays 100) |
| 7 | Hyperscale | A whole campus from a bare site | Choosing systems per space, one supply for the worst demand, a valve gallery, running a bad night |
| - | Sandbox | Anything | Unlimited budget, an Incident menu (power, weather, false smoke, pipe break), fires on demand, skip ahead five years |

Contracts unlock in order ("Unlock all" is on the menu). Stars: finish, finish under par cost, finish the
drill under half the allowed loss.

**The commissioning record survives the drill.** When the acceptance drill starts, the game records which goals
were met. During the drill, and in the drill report, the goals read that record instead of the live plant, so what
was proved before the fire stays proved: Churn's thirty quiet minutes do not un-happen because the fire pump ran in
the fire, and a passing calc or refill is not lost because a head is open. The report says how many goals the record
holds. (Before this, a passed drill on Churn, Cold Dock, Double Interlock or Hyperscale could end as "goals
incomplete".) Churn's thirty quiet minutes are also timed from the last moment a fire pump ran, so a pump that ran
for half an hour and was then stopped by hand no longer counts as a quiet half hour.

## Field calls (find the fault)

Small puzzles on an installation that already exists, on the same live simulation as the contracts. Each call gives
you a symptom, the records, a small repair budget and **one central question**. Find the fault, fix it with the
fewest edits, prove it with the right test, and answer the question with **Diagnose** on the top bar. They are on the
contracts menu under FIELD CALLS and unlock in order, independently of the contracts.

| # | Call | Starts as | The question | Variants |
|---|---|---|---|---|
| 1 | The Narrow Neck | Inherited installation | Where is the water being choked? | A 2 in. tile on the pump discharge (the flow test stalls); a 3 in. tile on the suction of a stronger pump (suction goes negative); a 1½ in. tile on the riser feed past the test header tee (the pump tests fine, the building calc fails) |
| 2 | Facing the Wrong Way | Nearly finished plant | Why can the pump not draw water from a full tank? | The pump set end for end; a test blank left at the pump inlet after the hydrostatic test; a test blank at the tank nozzle that starves both pumps (two symptoms, one cause) |
| 3 | The Last Row | Nearly finished plant | Where is the remote branch line cut off? | A cap on the joint to the north-east line; one tile laid north-south in an east-west line; a cap on the cross main that cuts off the whole last row |
| 4 | Pressure Without Supply | Records-only investigation | Can this system actually deliver water, and if not, what stops it? | A shut yard valve with no tamper switch; the same valve left 10 percent open after a repair; a shut fire pump suction valve hidden by the jockey pump |
| 5 | The Empty Test Header | Inherited installation | Why does the flow test record almost no flow through a healthy pump? | The header piped from the suction; the header piped off the 2 in. jockey line; a shut, unsupervised valve on the test line (call 4 again). The pump must stay |
| 6 | The Alarm That Never Left | Records-only investigation | Why did the waterflow alarm never reach the supervising station? | The flow switch not wired; both DACT lines down after a renovation; the flow switch not wired while a DACT trouble on the panel is a red herring |
| 7 | The Pump That Won't Sleep | Active incident | Why does a small leak keep waking the fire pump? | Jockey settings below the fire pump start; the jockey check valve in backwards; a test blank in the jockey suction plus a 5 psi start / stop band (two faults) |
| 8 | Reset, Reset, Reset | Active incident | What keeps bringing the indication back? | The air supply left isolated after a head change (P relatches); a manual station left operated; the system drain left open after a trip test |

- **Hints** come one at a time: the system to look at, a measurement to take, then the fault. The camera goes to each.
- **Scoring:** one star for the fix (every goal, the diagnosis included); one for the fewest edits at no more than
  the cheapest fix costs (within 10 percent, a game value); one for the diagnosis right the first time, at most one
  hint, no more time out of service than par (30 min of game time by default, a game value; pausing is free) and, on
  call 8, no panel reset made while the cause was still live (the recovery order).
- **An edit** is a change to the layout against the starting state: a pipe tile, a cap, a tile of tubing, a part
  added, removed, replaced or turned end for end, a wire, or a design setting on a part. Operating the plant (a
  valve, a pump's mode, a reset, a test) is never an edit.
- **Variants** move the fault, the supply, the layout or what else is going on; the later ones combine ideas from
  earlier calls. Switching variant starts it fresh. The menu card shows the stars of each variant.
- **Afterwards** the report compares three fixes side by side: yours, the cheapest one and an easily maintained one
  (a supervised valve where one was missing, isolation valves on a jockey pump, a gridded wet system), each drawn
  with its edits ringed and its cost, with what it teaches.

Two small additions came with the calls and work everywhere: **Turn end for end** (select an inline part: a check
valve, a pump, a backflow preventer or a control valve) reverses it in place, free; and a control valve can have
**no tamper switch fitted** (an old sealed yard valve, `sw: 0`): closing it signals nothing until a switch is fitted
($600, ASSUMED) and wired. A cap is now drawn where a pipe meets a part too, and a pump suction gauge shows a starved
suction as -14.7 (full vacuum) rather than a number no gauge can read (the network solver has no cavitation).

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
| `F` | Toggle Focus view to expand the play area; the system monitor stays available |
| `Home` | Fit the entire site into the available play area |
| `Ctrl+Z` | Undo |
| Right-drag, `WASD`, wheel | Pan and zoom |
| `G` / `M` / `Del` | Goals / field manual / remove the selected part |
| `H` | Hide or restore the whole interface |

Equipment is grouped into category tabs along the bottom. Click the system monitor to expand signals and the event log; a new alarm opens it automatically. Select a part or floor tile to open its inspector, and close it with × when finished. The Fit site and + / − controls sit above the equipment dock. Visual effects respect your system’s reduced-motion preference.

Rules of the grid: one tile is 10 ft and one sprinkler tile protects 100 sq ft. Mains join everything
they touch. Branch lines join only end to end and to a main beside them, and never through a wall.
Pipes cannot cross, so plan the trunk first. Pipe colour is its contents: blue water (brighter is higher
pressure), sand compressed air, teal nitrogen. White dashes are flow. Hover any pipe for psi, gpm, ft/s.

The detailed view adds 5 ft visual guides inside the 10 ft construction cells; the Grid button toggles
those guides. Building still snaps to 10 ft, so pipe lengths, costs and sprinkler coverage remain consistent.
Click the campus minimap to navigate, or focus it and use the arrow keys. The field note explains the
selected equipment and opens the relevant manual chapter. Dimensional rooms, illuminated racks,
metal pipe fittings and active fire/water effects make the live system easier to read. Reduced-motion
preferences freeze decorative animation while the simulation continues normally.

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
- **Air refill.** The code check is the **Air supply sizing** row: the largest zone on a supply,
  filled alone from 0 psig with the full capacity, must reach its restore pressure in 30 minutes. Plan
  review **fails** a supply below `scfm_min = V_ft3 x (P / 14.7) / 30` on that zone and warns below a
  x1.25 margin. Every dry and preaction valve also shows two measured, informational readings,
  **First fill (commissioning)** and **Last refill** (first gas into the closed-up zone to normal
  pressure; they never read FAIL), and a **Skip the refill** button that skips ahead until the zone is
  back at normal (2 h at most). The lesson is that recovery time is mostly compressor time.
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
  sooner and nothing is sent). On battery it still alarms and releases. LOW BATTERY comes in at the
  battery's listed low-voltage setpoint (20.4 V on a 24 V system, ASSUMED), then the panel dies. A
  failed charger and a disconnected battery are troubles of their own. Dead means dark: no display, no LEDs, nothing
  to silence or reset (the buttons are disabled and say why). The status bar reads PANEL DEAD at once.
  The supervising station's loss-of-communication line appears only after its supervision interval
  (60 min on a single IP path), and the valve rows the panel feeds read `not displayed: panel dead`.
  On an electric / electric trim the P latch lives in the panel, so it is lost with the panel and read
  again when power returns: P comes back if the pipe is still low. Power coming back is not a release;
  the inputs are.
- **A DACT outage.** On the DACT path, with both channels down nothing from the panel reaches the
  supervising station, alarms included, and nothing is dispatched from it. The panel tries each signal
  10 times, 90 s each, then shows DACT TRANSMISSION FAILED. When a channel is back every signal that is
  still active is sent, with its original event time: alarm, supervisory, trouble, then a class not
  elected (a latched P, OPEN), then the restorals. The annunciator's **Supervising station queue** shows
  the live state: RETRYING 3 of 10, then HELD, COMM FAILURE, then SENT hh:mm (late), with RESTORAL hh:mm
  once its restoral has gone. Hold and send is a site setting (on by default): off, it drops only what
  has restored. If the panel dies with signals queued none of them is sent: the queue marks it NOT SENT
  (panel dead): HAZARD CASE.
- **Waterflow stays until the panel is reset.** A waterflow alarm latches at the panel (listed-panel
  practice, NEEDS PE REVIEW): when the flow stops the signal reads "latched: reset the panel". A reset
  with water still flowing says "still in alarm".
- **Drains and the AVC.** The main drain is on the supply side of the clapper: open, it flows supply
  water and never bleeds system air. The system drain is downstream: it bleeds air fast and coarse
  (about 17 psi a second), so it overshoots through low air into P. The AVC (air maintenance device)
  is a device of its own with a bypass: bypass open, nothing regulates and the zone climbs to the
  compressor cut-out (or 60 psi) and into HIGH AIR.
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
- **Panel failure never releases water.** The panel runs on its standby battery (24 h + 5 min of alarm
  on the default basis), reports trouble, and a dead panel leaves the solenoid shut. Recovery is the
  mechanical emergency release by a person. Release = (D AND P) does not depend on the DACT, the
  battery, the charger or any drain.
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
| Enforced NFPA 72 edition (US) | Auto (follows NFPA 13), 2019, 2022, 2025. Its own setting because adoption is by the AHJ and can differ from NFPA 13 (PRACTICE). It changes the fire alarm citations only | Auto |
| Pipe size cut: largest size on threaded Sch 40 | 1½, 2, 2½, 3 or 4 in. That size and smaller is threaded Sch 40, every larger size roll-grooved Sch 10, main or branch alike | 2 in. (ASSUMED) |
| Fittings allowance on pipe volume | 0 to 50 % | 5 % (ASSUMED) |
| Trim volume per system valve | 0 to 50 gal | 2 gal (ASSUMED) |
| Insurer | none / FM. FM adds the 30 s water-delivery limit at any volume for dry and double interlock (FM DS 5-32) | none |
| Aspirating detector model | VESDA-E VEP / VESDA-E VEU. Sets the listed range of every stage. Changing it never changes a threshold | VEP |
| Aspirating detection thresholds | four values: Alert, Action, Fire 1, Fire 2. Each must sit inside its own listed range for the model, and they must run strictly increasing. A value outside the range is kept as typed, shown red and failed by plan review: nothing is clamped | 0.03 / 0.06 / 0.12 / 1.2 %/ft (owner-set example values: ASSUMED, NEEDS PE REVIEW) |
| Spot detector alarm threshold | a value inside the listed window 0.5 to 4.0 %/ft (example data) | 1.3 %/ft (ASSUMED) |
| NFPA 76 adopted on this site (the default for telecom rooms) | no / yes. NFPA 76 applies by room: only a Telecom / MMR room can be an NFPA 76 space, this setting is its default and the room can override it. Where it applies, two ceilings are checked against the aspirating detector in that room: Alert 0.2 %/ft or less, and Fire 1 (the first alarm stage) 1.0 %/ft or less. PRACTICE, NEEDS PE REVIEW | no |
| NEC edition (NAC wire resistance) | 2023 / 2026. Only the NAC voltage-drop check reads it. On 2026 the 2023 Table 8 ohms are shown as ASSUMED / VERIFY (NEC 2026 Table 8 is on hold), never as 2026 code | 2023 |
| Owner / insurer refill target | none / 10 / 15 / 20 / 25 min (ASSUMED picks). Judged like the code check, on the largest zone alone from 0 psig (method ASSUMED). Over the target and inside the code limit is a plan review warning tagged owner/insurer criterion, never a code failure | none |
| Signal class: aspirating Alert, Action | supervisory / alarm | supervisory (ASSUMED) |
| Signal class: latched P (release input) | not elected (OPEN) / alarm / trouble. Supervisory is blocked | not elected (ASSUMED) |
| Manual Release zone bypasses P | off / on. In a contract an ON bypass is an impairment: a supervisory on the panel and a tag on the valve | off |
| Supervising-station path (OWNER) | single IP path (a dead panel is annunciated after 60 min) / multiple paths (6 h) / DACT (6 h, its test interval: ASSUMED). On the DACT path a failed channel is a trouble sent on the other channel within 4 min | single IP path (PRACTICE) |
| DACT: hold and send after a communications failure (PRACTICE, NEEDS PE REVIEW; shown on the DACT path only) | on / off. A signal that is still active is always re-sent when a channel is back. On: a signal that restored inside the outage is sent late too, with its restoral. Off: drops what has restored. The code is silent on holding | on |
| Standby basis of the releasing panel (OWNER / insurer) | 24 h + 5 min (the building-FACU rule used for a releasing panel, PRACTICE) / 24 h + 10 min (owner) / 90 h + 10 min (FM DS 5-40, 2007 edition). FM is its own election, never automatic with the insurer setting | 24 h + 5 min |
| Generator-backed panel (NFPA 72-2025 only) | battery only / generator-backed (batteries for 4 h, the generator covers 24 h). Ignored with a note under 2019 and 2022 | battery only |
| Air refill order (PRACTICE) | all zones at once / largest zone first. Largest first: a shared compressor serves one calling zone at a time, the largest zone volume first, ties by the lowest zone number. The code check (the largest zone alone in 30 min) does not change | all zones at once |
| Aspirating detector model | VESDA-E VEP / VEU (four stages, a listed range each) / VEA (Fire 1 only: pick 0.5, 1.23 or 2.5 %/ft) | VEP |
| AC-fail transmission delay (OWNER / AHJ) | 60, 90, 120, 150 or 180 min before an AC failure is sent to the supervising station | 60 min |
| HVAC shutdown / damper hook: trigger (OWNER, NEEDS PE REVIEW) | none / Fire 1 / Fire 2 / waterflow. Never Alert or Action. With Fire 1, Fire 2, the manual station and waterflow trip it too. With Fire 2 it trips on every row where Fire 2 = 1, release or not; a release alone does not trip it. Shown in the cause-and-effect matrix only | none |
| EPO / power isolation hook (OWNER, NEEDS PE REVIEW) | off / on (an NEC 645, FM DS 5-32 election). On the waterflow row only, never on the release command. Shown in the cause-and-effect matrix only | off |

Some settings sit on the plant, not on the site. A compressor's **cut-out pressure** (none / 45 / 50 /
55 / 60 psi, ASSUMED) is in the compressor's inspector: it is a sizing input only on a compressor
direct to the system. Beside it are the **rated max discharge** (not modeled / 60 / 100 / 125 / 175 psi)
and the **relief valve setpoint** (none / 60 / 75 / 100 / 125 psi), both ASSUMED picks: they are the
ceiling of an open AVC bypass. A dry or preaction valve has its **AVC bypass** toggle, the optional
**AVC bypass tamper switch** (off by default; PRACTICE, no code requirement verified for the air
bypass) and, in the Sandbox, the **Air maintenance device** pick (AVC fitted, the default, or none:
compressor direct). The releasing panel has its **battery** pick (7 to 100 Ah, ASSUMED picks, 26 Ah by
default; the pick is free), its **charger** pick (matched to the battery, the default, or 1 / 2 / 3 /
4 / 6 / 10 A: ASSUMED listing values) and, in the Sandbox, **Fail charger** and **Disconnect battery**,
and on the DACT path the **Fail DACT channel** buttons. A **Refrigerated Space** room has its
**Held below 5 F** toggle (Sandbox): that is where the 60 min refill limit is set. Since Cycle 8 the
panel also has the **NAC voltage-drop check** (off by default), a compressor shows a **Relief check**
row, and a data hall can be made a **Telecom / MMR** room on the room itself (Sandbox), with its
**NFPA 76 applies here** pick and, on a VEA site, a per-room Fire 1 pick. The Site dialog gains the
**NEC edition** row and the **Owner / insurer refill target** row. See "Cycle 8" below.

The edition changes the citations in plan review and on the test reports and shows an "Edition
delta vs 2025" line. Pass and fail do not differ by edition in this version. NFPA 13-2022 keeps the
2019 numbering for delivery; the renumber to §8.2.4 is 2025. Citations per edition (fire protection
lead; the 2022 delivery keys were verified in Cycle 5 and carry no mark any more):

| Reference | 2025 | 2022 | 2019 |
|---|---|---|---|
| 60 s timed trip test | §8.2.4.2 | §8.2.3.2 (verified) | §8.2.3.2 |
| 500 gal, no quick-opening device | §8.2.4.2.1 | §8.2.3.3 (verified) | §8.2.3.3 |
| 750 gal with a quick-opening device | §8.2.4.2.2 | §8.2.3.4 (verified) | §8.2.3.4 |
| Listed calculation route | §8.2.4.3.1 | §8.2.3.5 to .6 (verified) | §8.2.3.5 to .6 (VERIFY) |
| Delivery table by hazard | Table 8.2.4.3.2 | Table 8.2.3.6.1 (verified) | Table 8.2.3.6.1 |
| Manifold (information only) | §8.2.4.4 | §8.2.3.7 (verified) | not given |
| Other listed times (information only) | §8.2.4.5 | §8.2.3.8 (verified) | not given |
| Double-interlock exemption | §8.3.2.3.1.1 | §8.3.2.3.1.1 to .4 (verified) | §8.3.2.3.1.1 |
| QOD on double interlock | §8.3.2.3.2 | §8.3.2.3.2 (verified) | §8.3.2.3.2 |
| 24 h air test | §29.2.2.1 (verified) | §29.2.2.1 (verified) | §28.2.2.1 (verified) |
| Air supply restores normal pressure in 30 min | §8.2.7.3 | §8.2.6.3.2 | §8.2.6.3.2 |
| The same, N₂-only source | §8.2.7.3: 2025 has no separate N₂-only clause, §8.2.7.6 has none (verified) | §8.2.6.8.4 (verified) | §8.2.6.8.4 (verified) |
| Annex: one compressor serving several systems is sized on the single largest | A.8.2.7.3 (also a shared N₂ source) | A.8.2.6.3.2 | A.8.2.6.3.2 |
| 60 min for refrigerated spaces below 5 °F (per zone, set on a freezer room; verified) | §8.2.7.4, every source | §8.2.6.3.3; N₂-only §8.2.6.8.5 | §8.2.6.3.3; N₂-only §8.2.6.8.5 |

A Canada row (NFPA 13-2019) exists as hidden data only and is never offered in the menu.

**24 h air test** (dry and double interlock, the same values in every edition): 40 psi air held 24 h,
and a loss over 1.5 psi must be corrected. The NFPA text names 40 psi; the game tests at the **greater
of 40 psi or the zone's normal pressure** (company practice, NEEDS PE REVIEW), so a zone with a 50 psi
normal is tested at 50 and a normal below 40 still tests at 40. Pass is a loss of 1.5 psi or less, an
absolute value at every test pressure (verified): an end reading of 38.5 psi or more at 40, 48.5 or
more at 50. The test starts at test pressure: a zone
sitting lower is charged first (the game does this, a simplification) and a zone more than 0.5 psi
above it is refused until it is bled at the trim. If the zone cannot reach test pressure in 30 min the
test fails. The report gives the test pressure, the start and end readings, the pass line with the
section of the enforced edition, and the drop. It never mentions P: a test that leaks below P trip
leaves P latched (that is PSL-REL doing its job), and the panel event log says so.

After the test the supply is restored and the zone goes back to its **normal set point**. Where the
pipe is left more than 1 psi above normal (a normal below 40 psi) the valve shows the step "return to
normal set point": bleed at the **trim air / test bleed** (the "Bleed to normal at the trim" button),
not at the main drain, and never by opening the control valve. A zone found below normal reads
"refill" and the open supply brings it up.

**The Finish button** (FP Lead, Cycle 7; PRACTICE). The step ends only when the operator presses
**Finish return to normal** on the valve. Nothing ends it by itself: when every condition holds the
row reads "All conditions met. Press Finish return to normal." and waits. Pressed too early the press
is refused, every time, and names what was missing. Since Cycle 8 (FP Lead, PRACTICE) a refusal counts
as **one error for each unchanged set of blockers**: pressing again with the same things missing, or
with fewer, adds no error; a blocker that was not in the last refusal does, and so does one that comes
back after the zone was ready. The raw number of presses is shown beside the errors as information:
"Finish was pressed 3 time(s) before the zone was ready; counted as 1 error(s), one for each new set of
blockers (informational)."

**Drains during the return to normal** (FP Lead ruling; company practice, ASSUMED: NFPA 13 prescribes
no bleed point). Nothing is hard-blocked: the consequence is modelled, coaching comes first, and only
real consequences are scored.

- The **main drain** is on the supply side of the clapper. It never bleeds system air. Opened with the
  control valve open it is a main drain flow test: supply water flows, supply pressure drops, and the
  system gauge stays put.
- The **system drain** is downstream of the clapper. It bleeds air fast and coarse, so it overshoots.
- Opening either one, in the step, logs one line of coaching: "Use the trim air bleed to trim down to
  normal. Drains dump air too fast or flow supply water." Closed again before anything comes of it,
  that is all, also while the pressure is passing through the normal band.
- A real consequence is **one scored error per event**: pressure below low air (the low-air
  supervisory comes in); pressure down to P, which latches it (the most severe while the valve holds);
  supply water out of the main drain; a Finish pressed too early; or the valve tripping (water flow,
  which ends the step). One low-pressure episode is one event: its entry is raised to the worst thing
  that came of it and never doubled. The Tests-button main drain test is deliberate and is never an
  error. The trim bleed is never an error.
- **The score does not depend on game speed.** It reads the lowest pressure of each step, the event
  time is interpolated to the crossing, and while a system drain is letting air out of a zone in the
  step every longer step is split into 0.1 s pieces (ASSUMED; a simplification). Opening a system drain
  in the step also ends a running time-skip.
- The **Finish gate** is all of: pressure in the normal band, above low air and not above high air,
  above the P set point by the 5 psi margin (ASSUMED); **the P latch reset** (at the releasing panel on
  electric / electric, at the trim on electric / pneumatic); the air supply open **and the AVC bypass
  closed**; no tamper on the zone's control valve; every drain closed. An overshoot that latched P is
  not put right by refilling into the band: P has to be reset. The valve's row lists what is still to do.
- On Finish the valve files a **Return to normal** result with one line per error in plain language
  (no internal tags), or the clean-pass sentence: "Clean return to normal. Air held above low air, both
  panel resets were done in order, drains were closed, the control valve is fully open, and supervision
  is back to normal." A drill report lists the same lines. It is practice: never a contract goal, never
  a contract star.

**AVC and its bypass.** The AVC (air maintenance device) and the air supply valve are two devices
(verified: 2019 §8.2.6.6.1 / §8.2.6.6.3.1; 2025 §8.2.8.1 and §8.2.9.3, the supply-side shutoff is not
the AMD). "AVC in auto" is the supply valve open and the bypass closed. With the bypass open the zone
drifts to **what the compressor can deliver** (fire protection lead, Cycle 7; ASSUMED): its cut-out
where one is set, else its rated max discharge or its relief setpoint, whichever is lower, and 60 psi
where the compressor is not modeled (ASSUMED). It is never the zone's 40 psi test pressure. That is past
the default 50 psi high air, so HIGH AIR comes in through the existing supervisory and is the main
signal. The bypass is normally closed: leaving it open is a classic way to get high air or
over-pressure. The open bypass is an impairment tag on the riser and the annunciator, and it holds the
return step. A **tamper switch on the bypass** is optional, per zone and off by default: fitted, an open
bypass is also a supervisory signal at the panel and a row in the matrix. It is labelled PRACTICE (no
code requirement verified for the air bypass) and is never a release input. Afterwards the trim bleed brings the
zone back down. A valve can also be set to "none (compressor direct)" in the Sandbox, the
small-compressor case (2019 §8.2.6.6.2 / 2025 §8.2.8.2); the game still holds such a zone at normal
(SIMPLIFICATION).

**Air refill.** The air supply must restore normal pressure within 30 minutes, per system (sections
in the table above). The **code check** is the largest single zone on the supply, filled **alone**
with the full capacity from 0 psig to its restore pressure, in 30 minutes or less (the Annex sizes one
compressor serving several systems on the single largest system). Sizing follows from the volume:
`scfm_min = V_ft3 x (P / 14.7) / 30`. **With an AVC regulating, P is the zone's normal set point**
(FP Lead, Cycle 6): the compressor cut-out does not enter the sizing. Only on a compressor direct to
the system (no AVC) is P the normal or the cut-out if that is higher, and there a cut-out above the
zone's high-air supervisory is a plan review **fail** (ASSUMED practice, NEEDS PE REVIEW). With an AVC
and a cut-out above high air there is no finding. It is an ideal-gas screen, not a quoted NFPA
equation. A 525 gal zone
(70.2 ft³) at 40 psi needs about 6.4 scfm, about 8 with the x1.25 margin; 10 scfm fills it alone in
about 19 minutes. Below the bare minimum plan review **fails** the design; between the minimum and
the x1.25 margin it warns (the margin is ASSUMED practice, NEEDS PE REVIEW, not an NFPA factor). No
reference build of the campaign fails or warns.

The valve's two fill rows are **measured and informational**: the first fill of the zone
(commissioning) and the last refill. One compressor serving several zones fills them all at the same
time here (`SIMPLIFICATION: parallel split; real ECS per-riser AVC/restrictors feed concurrently`), so
fills on a shared compressor can read over 30 min while the code check passes (contract 5's reference
build: 30.3 and 35.6 min on one 10 scfm unit, 19.1 min for the largest zone alone). Since Cycle 8 (FP
Lead) a measured time is never compared with the limit as if it were the code check: each row reads
"35.6 min (measured, informational)", with no limit, no verdict and no colour at any length, and the
code check is the **Air supply sizing** row under them. Some owners or FM jobs set a tighter refill
time: check the project basis of design, and set it as the **owner / insurer refill target** (Cycle 8
below). A zone that lost its air without
tripping starts an informational timer at the low-air crossing. Nothing but contract 2's existing dock
goal reads a fill time. Refrigerated spaces maintained below 5 °F get 60 minutes instead of 30
(verified), and since Cycle 7 that is **per zone**: a zone gets 60 minutes only when every room it
protects is a **Refrigerated Space** room with "held below 5 F" set (the "every room" reading
is ASSUMED, NEEDS PE REVIEW and AHJ). The room type alone never qualifies: a cooled space that is not
held below 5 °F (a 35 °F dock, for example), a zone that also covers any other room, and every zone of
a typical data center stay at 30. It moves that zone's clock, sizing minimum
(it halves) and review text together. The old site-wide flag is gone: a save that had it set loads with
every zone at 30 minutes and one log line saying so. The 2025 acceptance wording (§29.2.3.2.4.1) is
from a search, not verbatim: VERIFY.

**Air refill order** (site setting, PRACTICE, off by default). Off, every zone on a shared compressor
fills at the same time. On, **largest zone first**: one calling zone at a time, the largest zone volume
first, ties by the lowest zone number. The code check is unchanged: the largest zone alone from 0 psig
at full capacity in 30 minutes or less. When the sequence totals more than that and every zone alone
is inside it, the report says: "PASS: each zone restores in 30 min or less when filled alone (largest
X min). The sequential campus refill total of Y min is informational and not a code limit." No owner
target for the total is modelled.

**Aspirating detector models.** Each listing bounds every threshold per stage, per model. The ranges
are read from the maker's own datasheets, labelled **[HB, datasheet; UL Product iQ not checked]**
wherever they are shown: the UL Product iQ listing itself could not be read.

| Model | Alert | Action | Fire 1 | Fire 2 | Datasheet |
|---|---|---|---|---|---|
| VESDA-E VEP (VEP-A00-1P-UL, VEP-A00-P-UL, VEP-A10-P-UL), default | 0.0015 to 0.614 | 0.0015 to 0.614 | 0.0030 to 0.614 | 0.0061 to 6.575 | Xtralis Doc. 36106_07, Part AD36106-007, July 2025, p. 2 |
| VESDA-E VEU (VEU-A00-UL, VEU-A10-UL) | 0.0003 to 0.614 | 0.0003 to 0.614 | 0.0003 to 0.614 | 0.0003 to 6.575 | Xtralis Doc. 36107_05, Part AD36107-005, November 2024, p. 2 |

Units are %/ft obscuration. The datasheets print setting ranges, not default thresholds, so the four
example values stay owner-set, ASSUMED and NEEDS PE REVIEW.

**VESDA-E VEA is a Fire 1-only model** (Cycle 7, fire alarm lead). It has one stage: pick 0.5 (High),
1.23 (Enhanced) or 2.5 (Standard) %/ft (Xtralis Doc. 36348_03); any other stored value fails plan
review. The default is by room since Cycle 8: 0.5 in a telecom room where NFPA 76 applies and 1.23 in
every other room, whatever the site setting, and a room can carry its own pick, on this model only
(which rooms count as NFPA 76 telecom: PRACTICE, NEEDS PE REVIEW). The Gamewell sheet 9021-61037 prints Enhanced as 1.3
(4.0 %/m): a source mismatch shown as a note, never a setting. Alert, Action and Fire 2 values are not
published for the model, so they do not exist for it: no such signal is ever raised, and the Fire 2
HVAC hook and those matrix rows read "not available". The release function is untouched: D is still
"level at or above Fire 1". Not offered: FAAST LT-200 and FLEX (no UL 268 or FM listing on the sheets), TITANUS PRO·SENS and FAAST XM /
XS (conflicting or non-current sheets).

**NFPA 76, by room.** It applies in a Telecom / MMR room (the site setting is the default for telecom
rooms; see "Cycle 8" below), and is checked where an aspirating detector sits in such a room. Two
plain ceilings (NFPA 76-2024 §8.5.3.1.2.5): Alert 0.2 %/ft or less,
and the 1.0 %/ft alarm ceiling applied to Fire 1, the first alarm stage. The 1.0 %/ft figure is
verified (fire alarm lead, Cycle 7): NFPA 76-2024 §8.5.3.1.2.5, Alarm condition, air-sampling, "3.2
percent per meter (1.0 percent per foot) obscuration (effective sensitivity at each port)"; the same
figure is in NFPA 76-2020. Applying that Alarm condition to Fire 1, on a VEA detector too, is PRACTICE,
NEEDS PE REVIEW. Action stays pre-alarm and Fire 2 has no NFPA 76 limit. On VEP and VEU there is no
conflict with the listing: the listed Fire 1 maximum (0.614 %/ft on both) is tighter, so the listing
binds first, and the Site dialog and plan review say so in one note. On VEA the ceiling does bind: 0.5
meets it, 1.23 and 2.5 are above it and are flagged. Plan review fails an Alert above 0.2 or a Fire 1 above 1.0.
"Check against NFPA 76" in the Site dialog reads the thresholds against the two ceilings and writes
nothing. An old save that still carries the retired alarm-stage election loads, and the key is ignored.

Signals on the annunciator: ALARM, then OPEN (a release input whose class is not elected: the latched
P), then SUPERVISORY, then TROUBLE, each with its own sound. Every signal the game raises comes from
one registry (`DI.SIG_FIXED` and the three elected classes, read by the alarm code, the
cause-and-effect matrix and the signal schedule): Fire 1, Fire 2, manual station, Manual Release
zone, release circuit, waterflow and a spot detector are alarm; low and high air, valve tamper, the
fire pump, tank and low-temperature signals are supervisory or trouble as they always were; panel AC
failure, low battery, a charger failure, a disconnected battery, loss of communication, a failed DACT
channel, a failed DACT transmission and loss of supply air are trouble; the optional AVC bypass tamper
switch is supervisory (28 fixed keys and 3 elected ones). Loss of supply air is equipment trouble, its own signal (PRACTICE, settled by the fire alarm
lead); the pressure drop it causes is still reported by the low-air supervisory.

**Signal schedule: who is told.** Alarm signals (Fire 1, Fire 2, manual station, waterflow, and here
also the Manual Release zone and a spot detector) go to the fire department; supervisory and trouble
signals go to the supervising station only (PRACTICE). Alert and Action are pre-alarm, an owner
election, usually supervisory: they never call the fire department by themselves, even where they are
elected alarm. A latched P is OPEN and is not dispatched by itself, and the release circuit is an
output, not an input. Dispatch reads the registry (`DI.SIG_FD`), not the class. The **Signal
schedule** button in the Site dialog and at the top of every cause-and-effect matrix opens the
read-only table, generated from the registry: signal, class, to the supervising station, fire
department, and the fire alarm lead's tag. Signals the lead's table does not list are marked
"PRACTICE / not in FA Lead table (ASSUMED)"; the three Cycle 6 troubles (DACT transmission failed,
charger failure, battery disconnected) carry the lead's own tags. A manual station's point label
follows its type on the zone: "MANUAL PULL, ZONE x" where it is typed DETECTION and "MANUAL RELEASE,
ZONE x" where it is the Manual Release zone. Both are alarms and dispatch the same way (PRACTICE); only
the label and the logic differ (the pull joins D and still needs P; the zone releases without P).

**Cause-and-effect matrix.** Each preaction valve, and the releasing panel for each zone wired to it,
opens a read-only matrix for that zone. Columns: Input, Tag, SignalClass, PanelAnnunciation,
SS_Transmit, LocalNAC, Solenoid, HVAC_Hook, EPO_Hook. Rows: Alert, Action, Fire 1, Fire 2, the manual
station, the Manual Release zone, P, the release (on AC, on battery, with the panel dead), waterflow,
tamper, low and high air, the optional AVC bypass tamper switch, loss of supply air, AC failure, low
battery, charger failure, loss of communication and a failed DACT channel (21 rows; the tamper row is
greyed where the switch is not fitted, the last off the DACT path; on a VEA detector the Alert, Action
and Fire 2 rows read "not available"). SS_Transmit also says whether the
fire department is dispatched. The
table is generated from the engine (`DI.ceEval`: classes from the registry, the release from
`DI.relState` on the zone's own trim and bypass setting), and the tests hold all 17 rows of the truth
table as matrix = fixture = engine. Rows active on the zone are marked ACTIVE NOW. LocalNAC is a rule
read from the class (alarm only), not a circuit. The two hook columns show an output contact where the
owner has elected one in the Site dialog; they are hooks only, and the game never shuts down a fan, a
damper or power (OWNER, NEEDS PE REVIEW). **HVAC**: the setting is the trigger stage: none (default),
Fire 1, Fire 2 or waterflow, and never Alert or Action. With Fire 1 elected, Fire 2, the manual station
and waterflow trip it too, so the release rows show it (PRACTICE); with Fire 2 elected it trips on
every row where Fire 2 = 1, release or not, and a release alone (Fire 1 and P, or the Manual Release
zone) does not trip it. The rule reads the Fire 2 input, not a row, and a tripped cell names the input
that tripped it. **EPO**, where elected (NEC 645, FM DS 5-32), is triggered by waterflow, not by the
release command: the waterflow row only, never a release or valve-open row. Waterflow proves water is
in the system and, on an electric / pneumatic trim, is the only way the panel knows the valve opened.
A Cycle 4 save that stored a CRAH or damper election reads as the Fire 1 trigger. Duct-detector
shutdown (IMC) is a separate device outside the matrix. Not in the matrix either: elevator recall, door
release, compressor control, notification circuits, the battery standby calculation (the panel and
plan review carry it), a disconnected battery, and the live state of the DACT queue. The matrix is
design intent; its last footnote is the fire alarm lead's, word for word: "With both DACT channels
failed, signals are not transmitted until a channel restores. Panel shows comm-failure trouble. See
Cycle 6 Q2."


**Supervising-station timing (NFPA 72).** NFPA 72 has its own edition setting (Auto follows the
site's NFPA 13 edition): adoption is by the AHJ and the two can differ (PRACTICE). A trouble shows at
the panel within 200 s (§10.15.1; the game shows it at once). An AC failure is a trouble (§10.6.9.1.1)
and is transmitted after 60 to 180 min (§10.6.9.3; a site setting, default 60). A dead panel is
annunciated by the supervising station after its supervision interval, by path:

| Path | Delay | 2019 | 2022 | 2025 |
|---|---|---|---|---|
| Single IP path (default, PRACTICE) | 60 min | §26.6.3.3(2) | §26.6.3.3(2) | §26.6.3.3.2(2) (verbatim; annunciated per §10.15) |
| Multiple paths | 6 h | §26.6.3.4(2) | §26.6.3.4(2) | ASSUMED 6 h: §26.6.3.4(1) is a supervision interval, and no annunciation time was found in 2025 |
| DACT: a missed test (a trouble, CODE; the 6 h annunciation time is ASSUMED) | 6 h, the test interval | §26.6.4.2.2(H); interval §26.6.4.1.5(6) | §26.6.4.3.2.8; interval §26.6.4.2.5(6) | §26.6.4.3.2.8; interval §26.6.4.2.5(6) |
| DACT: one channel failed, trouble on the other channel (CODE) | 4 min | §26.6.4.1.4(B)(3) | §26.6.4.2.4.2(3) | §26.6.4.2.4.2(3) |

**DACT channels.** On the DACT path the panel has two channels. With one down the panel shows a
trouble at once and the supervising station has it 4 minutes later, on the other channel; every other
signal goes on the surviving channel at once and the log names the channel. A channel is failed from
the panel's inspector, in the Sandbox only. It is never an input of D or P. Two-way radio paths are
not modelled.

**Both DACT channels down** (fire alarm lead, Cycle 6). Nothing from that panel reaches the station,
alarms included; nothing is dispatched from it; no outside path is invented. Display, annunciation,
the notification rule, the hooks and the release are untouched.

- **Attempts** [CODE]: 5 to 10 attempts, each 90 s or less (2019 §26.6.4.1.3(B)-(D); 2022 and 2025
  §26.6.4.2.3.2-.4; the 2022 / 2025 annex table gives 900 s for all attempts). The game makes 10 (the
  count is ASSUMED) of 90 s. After 900 s the panel raises **DACT TRANSMISSION FAILED**, the failure
  indication at the premises, and it stays until a channel is back. The station reports a missed test
  after the 6 h interval (ASSUMED).
- **When a channel is back** every signal that is still a condition at the panel is sent, with its
  **original event time**, 10 s apart (ASSUMED): fire alarm, then supervisory, then trouble [CODE:
  §10.7.2, §10.7.7], then a class that is not elected. OPEN is not a 10.7 class (a latched P on an
  electric / electric trim is the unelected class), so it goes last and never dispatches; where it sits
  is PRACTICE / OWNER, NEEDS PE REVIEW (the alternative is to leave it out of the queue). Then the
  restorals, in the same order, then the communications-failure trouble and its restoral.
- **Hold and send** is not in the code (not found in 2019, 2022 or 2025): it is manufacturer behaviour,
  PRACTICE, NEEDS PE REVIEW, so it is a site setting, **on by default**. It decides only what happens to
  a signal that **restored inside the outage**. On: it is sent late, and its restoral follows. An alarm
  sent late still dispatches the fire department: a fire alarm signal received by the station is
  retransmitted at once (NFPA 72 §26.2.1.2 [CODE], the same section in 2019, 2022 and 2025), and
  verification (§26.2.2) is not a late-signal or no-dispatch path. **Off:
  drops what has restored; a live signal is always re-sent.** A dropped signal was never sent, so it
  has no restoral.
- **Restorals.** When a signal the station has is no longer a condition at the panel, the panel
  reports its restoral (NFPA 72 §26.2.5.1 [CODE], verified in 2019, 2022 and 2025: since Cycle 8 the
  2019 text is held, so no edition shows a mark on the line). §26.2.1.4 (subsequent signals) is 2022
  and 2025 only, is not modelled and is never shown on a 2019 site. The hidden Canadian row is the
  NFPA 72-2019 label only: CAN/ULC-S561 is not held (on hold), and the station rule is never shown as
  Canadian code. With the path up it is one log line ("RESTORAL to station"). A signal the
  station already holds that clears in a later outage gets a restoral entry in the queue, and that is
  never dropped under hold OFF (PRACTICE, NEEDS PE REVIEW). A fire alarm restores when the panel is
  reset or the device is restored by hand. A restoral dispatches nothing.
- **Waterflow latches at the panel until reset** (label since Cycle 8: PRACTICE with code support,
  NEEDS PE REVIEW: NFPA 72 §10.11.6, §23.8.2.2 [indirect] and §10.18.1.2, which is §10.18.1.1.2 in
  2019. §23.8.2.2 is about combined subsystems sharing equipment and is indirect support, never quoted
  as a rule that alarms hold until reset; no NFPA 72 sentence says fire alarms latch until manual
  reset, and §10.14.2 covers supervisory latching only). Detectors, manual stations and the release latches already held; waterflow
  was the one fire alarm that followed the live reading. A reset with water still flowing says "still
  in alarm"; after the flow has stopped it clears. A dead panel holds no latch. A flow raised on test
  does not latch (a simplification), and a latched alarm whose flow is over starts no new dispatch.
- **The hazard case.** The one path that still loses a live alarm is the panel dying with the signal
  queued. The queue row reads **NOT SENT (panel dead): HAZARD CASE** and carries the text: "No alarm
  reaches the supervising station from this panel and nothing is dispatched from its signals. The
  station can learn the premises is down only from its own missed 6 h test, which it treats as a
  trouble (NFPA 72 §26.6.4.2.5(6), §26.6.4.3.2.8; the annunciation time is ASSUMED). The passer-by 911
  call in this game is not an NFPA 72 path." (A 2019 site gets the 2019 section numbers.) The 6 h test
  itself is not modelled.
- **Live state** is on the annunciator, under the signals: the **Supervising station queue** reads
  "RETRYING 3 of 10", "HELD, COMM FAILURE", "SENT hh:mm (late)" (with ", RESTORAL hh:mm" once its
  restoral has gone), "NOT SENT (hold off)" or "NOT SENT (panel dead): HAZARD CASE", and the
  signal's own row carries the same label. The log gets the late-send and restoral lines.
- **A silenced trouble** sounds again by itself every 24 h or less while it is still active (§10.15.9.1;
  §10.15.10.7 for a Ch. 26 premises unit). The game uses exactly 24 h. A cleared trouble does not
  resound.

**Battery and standby** (fire alarm lead; NFPA 72 §10.6.7.2 where adopted, AHJ to confirm). Required
Ah = (standby A x hours + alarm A x alarm minutes / 60) x a sizing factor. The factor follows the
**NFPA 72 edition**, never the NFPA 13 edition: x1.20 in 2019 (§10.6.7.2.1.1), x1.25 in 2022 and 2025
(§10.6.7.2.14).

| Basis | Standby + alarm | Tag | In the game |
|---|---|---|---|
| Releasing panel, NFPA 72 | 24 h + 5 min | CODE §10.6.7.2.2 (the building-FACU rule) used for a releasing panel: PRACTICE | selectable, default |
| Releasing panel, owner row | 24 h + 10 min | OWNER | selectable |
| Releasing panel, FM-insured | 90 h + 10 min | OWNER / insurer, FM DS 5-40 §2.3.4, Sep 2007 edition, may not be current | selectable |
| Building FACU | 24 h + 5 min | CODE §10.6.7.2.2 | reference only |
| EVACS FACU | 24 h + 15 min | CODE | reference only |
| Li-ion ESS panel | 24 h + 2 h | NFPA 855 §4.8.3, upper bound; 855-2026 HOLD | reference only |

With the ASSUMED loads (0.5 A standby, 2.0 A alarm) the default basis needs 15.21 Ah in 2025 and
14.60 Ah in 2019, so the default 26 Ah battery passes with 71 % margin. The FM row needs 56.67 Ah: the
default battery fails it until a 65 Ah pick, which is why FM is an election of its own and never
automatic with the insurer setting. Plan review **fails** a battery below the requirement and warns
**THIN** under a 20 % margin (PRACTICE, NEEDS PE REVIEW). In the sim the battery gives the basis hours
(less in proportion where the pick is short), the charger restores a full discharge within 48 h
(§10.6.10.3.2) [CODE], and LOW BATTERY comes in at 20.4 V on a 24 V system (the listed setpoint,
ASSUMED: the code states no voltage), which is 1/12 of the hours left on the game's straight-line
voltage curve (19.8 V at the end of discharge, 27.0 V on float). **Charger failure** is a trouble at
the panel and at the station [CODE] (§10.6.10.6.1 to .2) and the battery stops charging; **battery
disconnected** is modelled as a trouble (PRACTICE, not code) and the panel dies the moment AC is lost.
**Generator-backed** (2025 only, §10.6.7.3.1(2); optional): batteries for 4 h, the generator covers
24 h. **Charger** (Cycle 7): the recharge window is 48 h for every battery size (§10.6.10.3.2,
identical in 2019, 2022 and 2025), so a bigger battery needs a bigger charger. The charger is a pick on
the panel, in amperes; the values are listing values, ASSUMED, because no charger ampere rating is in
§10.6.10. A charger restores amperes x 48 h (ASSUMED: no taper), and plan review fails a battery its
charger cannot restore in 48 h; the window never stretches. "Matched to the battery" is the default and
raises no finding. An undersized charger also recharges slower in the game. Battery and charger cost
are ASSUMED. 2022 and 2025 require listed or component-recognized rechargeable batteries (§10.6.10.1.3). The
"restore a failed charger before half the battery is used" rule is for supervising-station equipment
only and is not modelled. The **Standby reference** dialog (Site dialog and the panel) lists the six
rows.

**Save and load.** Utility power is saved with the world. So is the first-seen time of every active
signal, so a delay that was running at the save (AC failure, a failed DACT channel) carries across a
load, nothing is announced twice and a silenced panel stays silenced. The settle a load runs is not
game time, so it does not drain a panel battery. The DACT queue is saved too (attempts, states and
original event times), as are the silence clock, the pending return-to-normal step with its error
list, and the AVC props. Saves from before Cycle 5 load as they did: power on, no stored clocks. A
Cycle 5 save loads with hold ON, the 24 h + 5 min standby basis, an AVC on every dry and preaction
valve with its bypass closed and a 26 Ah panel; one made in a DACT outage gets its queue made again
from the saved signals, RETRY or HELD by age.

Low battery has no code threshold (§10.6.9.1; §10.6.10.6 is charger failure): the trouble is the
listed manufacturer's low-voltage setpoint, 20.4 V on a 24 V system (ASSUMED).

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
  panel loads (0.5 A standby, 2.0 A alarm), the 26 Ah default battery and the Ah picks, the low-battery
  setpoint of 20.4 V with 27.0 V float, 19.8 V end of discharge and the straight-line curve between
  them (the listed setpoint is OWNER/listing) and low battery being transmitted at once, the
  annunciation time of a missed DACT test (its 6 h test interval) and the 6 h on multiple paths in
  NFPA 72-2025, the DACT retry count (10; the 5 to 10 bound and the 90 s are CODE) and the 10 s between
  two sends on restore, the trouble resound at exactly 24 h, the x1.25 compressor sizing margin, the
  compressor cut-out (none by default; 45 to 60 psi choices), the compressor's rated max discharge and
  relief setpoint picks and the AVC bypass target of 60 psi where the compressor is not modeled, the
  reading that a refused Finish whose blocker set only shrank adds no error, the 0.1 s sub-step while
  a return-step system drain is open, the wording of the low-air text for an episode with no drain
  open and of the last sentence of the step 14 banner (the Tutor gave every other return-to-normal
  sentence), the charger picks, "matched to the battery", the
  amperes x 48 h rule with no taper and the battery and charger cost, the Refrigerated Space and
  Telecom / MMR contents values, the migration of a save with the old refrigerated flag back to 30 min,
  the NAC check's 16 V appliance minimum, its 20.4 V start when none is given, its appliance currents
  per candela (0.10 / 0.15 / 0.20 / 0.25 A at 15 / 30 / 75 / 95 cd: round numbers, not from a listing),
  its start-voltage picks and its 40-appliance cap, the owner / insurer refill picks (10 / 15 / 20 /
  25 min) and judging that target on the largest zone alone, reading "AVC high" in the relief warning
  as the high-air setpoint of a zone the compressor feeds,
  the classes and station-only routing of the signals outside the fire alarm lead's schedule, the
  electric / electric P latch being lost with panel power and read again on restore, 0.5 psi as "about
  0 psi" before a head is replaced (the gate itself is confirmed by the fire protection lead; the
  value is assumed), the automatic "confirm 0 psi and no water" step, the 24 h air test starting once
  the gauge reads 40.0 (0.005 psi) with 30 min allowed to charge, the game charging the zone itself,
  the operator log size (600 entries), the sound pattern per signal class, the contract 5 recovery
  rating tiers (3 stars when the water is stopped within 60 s of the alarm, 2 within 150 s; play
  test), the 5 psi margin
  above the P release set point on the return-to-normal step, and Canada = NFPA 13-2019 via NBC 2020 /
  BCBC 2024 (verify before ship).
- **NEEDS PE REVIEW**: a choice an engineer of record has to make. Currently: the Manual Release zone
  that bypasses P (owner/insurer exception, OFF by default; it applies to the electric / electric trim
  only, is a separate latched release path and not detection, and shows as an impairment in a
  contract), the signal classes (Alert and Action, supervisory by default; a latched P, class not
  elected with supervisory blocked), the FM 30 s water-delivery limit at any volume (FM DS 5-32), the
  aspirating default thresholds (owner-set inside the model range; the datasheets print none), the
  NFPA 76 ceilings applied to Alert and to Fire 1 with Action as pre-alarm (PRACTICE), the HVAC and
  EPO hooks (the election, the trigger stage, the NEC 645 / FM DS 5-32 interface), DACT hold and send
  itself (no code basis) and "a live signal is always re-sent", the count of 10 attempts, where OPEN
  sits in the restore order (last), never dropping a restoral under hold OFF, latching waterflow until
  a panel reset (PRACTICE with code support), the optional AVC bypass tamper
  switch, the per-zone "every room is a freezer held below 5 F" reading of the 60 min limit, sequential
  refill as an owner practice, mapping the NFPA 76 Alarm condition to VEA Fire 1 and which rooms count
  as NFPA 76 telecom, the NAC check (the 16 V minimum, the ASSUMED 20.4 V start, the ASSUMED currents,
  the 20 percent THIN margin as a company rule, the method on 2019 and 2022 sites, and the 2023 Table 8
  ohms on a NEC 2026 site), the owner target method, the two compressor relief warnings, step 14 as
  company practice, the scoring of the main drain 10 percent drop, the FM 90 h + 10 min standby row
  (2007 edition), the 10 min owner row, the generator-backed 4 h case and the THIN screen under 20 %,
  a compressor cut-out above high air as a fail where there is no AVC,
  the 24 h air test pressure at the greater of 40 psi or normal (company practice), the x1.25 sizing
  margin and the ideal-gas sizing screen, the
  low-battery setpoint (a listed manufacturer value), the AC-fail transmission delay and the
  supervising-station path type, and the lithium-ion / ESS room density and approach (the battery room
  is a placeholder). Settled and off this list: loss of supply air is trouble (PRACTICE).
- **VERIFY**: a section number or value to check against the edition before it goes into game text.
  Currently: the 2019 calculation-route paragraphs, the 2025 acceptance wording for the refill time
  (§29.2.3.2.4.1, from a search, not verbatim), the body text of the NFPA 25-2020 valve status test
  (only the table row is held), and the aspirating ranges against the UL Product iQ listing (not
  checked; no access is to be bought for it). On hold: NEC 2026 Chapter 9 Table 8 (a NEC 2026 site
  shows the 2023 ohms as ASSUMED / VERIFY), and CAN/ULC-S561, CAN/ULC-S524 and CEC Section 32 (the NAC
  check is not evaluated on a Canadian build). Verified in Cycle 8 and off this list: NFPA 72-2019
  §26.2.1.2, §26.2.2 and §26.2.5.1 (the 2019 text is held and matches 2022 and 2025 for these duties),
  §10.11.6 and §10.18.1.2 (2019 §10.18.1.1.2) on resetting alarm signals, §7.2.1(8) (NAC calculations
  are a documentation item) in all three editions, NFPA 72-2025 §18.3.7.1 to §18.3.7.6 and NFPA 70-2023
  Chapter 9 Table 8. Verified in
  Cycle 7: the NFPA 76 alarm figure of 1.0 %/ft (NFPA 76-2024 §8.5.3.1.2.5, Alarm condition,
  air-sampling; the same in 2020; applying it to Fire 1 stays PRACTICE), and NFPA 72-2022 / 2025
  §26.2.1.2 and §26.2.5.1. Verified in Cycle 6 and off this list: the NFPA 25 main
  drain test (2023 and 2026 §13.2.2, pass rule §13.2.2.3; 2020 §13.2.3, §13.2.3.3) and the valve status
  test after a reopen (2023 and 2026 §13.3.3.4); the 60 min refrigerated sections; the 2025 N₂-only
  reading (no separate clause: §8.2.7.3 and §8.2.7.4 apply); the 1.5 psi air-test pass line as an
  absolute value; the AVC as a device of its own; the NFPA 72 charger rules, standby factor and DACT
  attempt rule. Not found in any NFPA 72 edition held, so listed or ASSUMED: a low-battery voltage,
  battery-disconnect supervision, a charger ampere rating, hold and send, and a general rule that a
  fire alarm latches until a manual reset. Verified in Cycle 5 and off this list: the NFPA 13-2022 delivery sections
  (§8.2.3.2, §8.2.3.3, §8.2.3.4, §8.2.3.5 to .6, §8.2.3.8), the N₂-only refill sections of 2019 and 2022
  and NFPA 72-2025 §26.6.3.3.2(2). Moved to ASSUMED until pulled: the NFPA 72-2025 annunciation time on multiple paths and the annunciation time of a missed DACT test.

Simplifications in the release logic: the P sensor goes live the first time a valve is set, so a new
valve does not latch P during its first air-up; after a mechanical emergency release with every
sprinkler closed the trapped air is not vented, so the pipe sits pressurized with no flow; a dead
panel's P latch is lost and read again, not
stored; a compressor's own low-air alarm on a separate supply is not modelled; notification appliances
are not modelled. On the fire alarm side: the cause-and-effect matrix covers preaction zones only;
LocalNAC is a rule from the signal class, not a circuit; hooks are display-only and never act; the
panel shows power troubles at once (inside the 200 s ceiling); the supervising station learns of a dead
panel after one fixed supervision interval; AC-fail transmission uses a fixed delay, not a random one;
the impairment strip is a tag, not a signal; the signal schedule covers the registry's signals, and
Alert, Action and P classes are owner elections that never dispatch the fire department by themselves;
a DACT channel failure is a Sandbox-only fault, and a missed DACT test is annunciated after the ASSUMED
6 h; DACT attempts are counted from the signal's first sight, not a modem model, and the sends on
restore are 10 s apart; hold-and-send keeps a live signal and drops only what has restored, a restoral
is always sent, the station is a queue and not a receiver model, and the 6 h missed test is text only;
waterflow latches until a panel reset (practice), as detectors, stations and the release latches
already did; VEA is a Fire 1-only model; the matrix is design intent, and live state is shown only in
the station queue and the log; the battery has a straight-line voltage curve, one load per panel and a free Ah pick, a
larger battery is not credited with more hours, the charger is amperes x 48 h with no taper and its
cost is ASSUMED, the generator runs exactly 24 h with no fuel model,
and only the releasing panel is a panel in the game. In the air supply: parallel split refill (`SIMPLIFICATION: parallel split; real ECS per-riser
AVC/restrictors feed concurrently`): the measured clock is informational and runs from the first gas
into the closed-up zone, and the code check is the largest zone alone from 0 psig; the operator-step
score leaves out the interval the zone is closed up and filling; the AVC and its bypass are two flags,
and an open bypass drifts the zone to the compressor's cut-out, or to its max discharge or relief,
whichever is lower, else 60 psi, which is not a compressor switch model, and the bypass tamper switch
is optional practice; a zone with no AVC is still held at normal; the sizing check adds up a zone's
sources, a nitrogen generator included; the 60 min refill limit applies per zone only where every room
is a freezer held below 5 F, and the room's own temperature is not held there; sequential refill is a
toggle and informational beyond the per-zone check; the return to normal is ended only by Finish, its
scoring reads the minimum pressure and the step is split into 0.1 s sub-steps while a system drain is
open; the trim bleed still snaps to normal while the system drain runs the real pressure physics, and
its scoring is a practice result, never a contract goal or star. In testing and
recovery: the 24 h air test is charged to its test pressure by the game; the recovery rating is
informational and separate from contract stars; the main drain test after reopening is step 14 in the
contract 5 drill and a tip everywhere else; the "confirm 0 psi and no water" step
is automatic when the conditions hold; only the system (low-point) drain is scored and the
supply-side main drain is optional; a zone with no upstream control valve skips the water-isolation
test before a head is replaced; only the control valve nearest upstream is checked on reopening. In water
delivery: only the timed trip test decides pass or fail (the calculation / table route is named on the
report and not modelled); the inspector's test connection is always present, so the 750 gal
trip-test-connection trigger for double interlock is not modelled (on double interlock 750 gal is that
trigger, not a maximum volume: the only size exemption is 500 gal, with or without a quick-opening
device); FM is the 30 s limit only.

### Cycle 8: label corrections, NAC voltage drop, the two-number refill report

Cycle 8 changes no release logic. `DI.relState`, the D block at the top of `alarm.js`, `DI.FIRE1` and
the truth-table fixture are byte-identical to Cycle 7, and the review of every contract is unchanged.

**Label corrections.** NFPA 72-2019 and the hidden CA-2019 row drop VERIFY on the station-side cites
(§26.2.1.2, §26.2.2, §26.2.5.1): the 2019 text is held and matches 2022 and 2025. The waterflow latch
is labelled PRACTICE with code support, NEEDS PE REVIEW. The NFPA 25 10 percent text is a trigger to
investigate, not an automatic fail: a main drain test with a drop over 10 percent reads INVESTIGATE.
Step 14 is labelled company practice. The cold room type is named Refrigerated Space, because a cold
dock counts only if it is held below 5 °F. Details are in the sections above and under "Recovery after
an incident".

**NAC voltage drop at the last appliance** (fire alarm lead; a plan review check only). One DC
notification appliance circuit per releasing panel, Class B, end-line-loaded (every appliance taken at
the far end of the run), **off by default**. Switch it on at the panel and pick the wire gauge (18 /
16 / 14 / 12 AWG), the routed one-way length (10 to 1000 ft), the number of appliances (1 to 40), their
candela (15 / 30 / 75 / 95) and the start voltage (21 / 22 / 23 / 24 V from the panel or module data
sheet, or not given).

```
total current       = appliances x current of one at its minimum voltage
circuit resistance  = 2 x one-way length x ohm per 1000 ft / 1000     (both conductors counted)
V at last appliance = start voltage - total current x circuit resistance
margin              = (V at last appliance - 16 V) / 16 V
```

| Item | Value | Label |
|---|---|---|
| Wire resistance, ohm per 1000 ft | 18 AWG 7.95, 16 AWG 4.99, 14 AWG 3.14, 12 AWG 1.98 | NFPA 70-2023 Ch. 9 Table 8, 75 C, uncoated stranded copper [CODE NEC 2023]. On a NEC 2026 site: ASSUMED / VERIFY, never 2026 code |
| Appliance minimum voltage | 16 V | A.18.3.7 [HB]; ASSUMED, confirm on the listing |
| Appliance current at the minimum voltage | 0.10 / 0.15 / 0.20 / 0.25 A at 15 / 30 / 75 / 95 cd | ASSUMED listing values: round numbers, not from a listing |
| Start voltage when none is given | 20.4 V (end of discharge on a 24 V system) | ASSUMED |
| THIN margin | under 20 percent above the minimum | company rule: PRACTICE, NEEDS PE REVIEW |

Verdicts, one finding per panel, the worst of: **FAIL** below the appliance listed minimum; **warning,
THIN**, when the margin is under 20 percent; **warning, not a fail**, when the start voltage is
ASSUMED. A clean pass is one information line: it is the NAC voltage drop calculation the
documentation list asks for (NFPA 72 §7.2.1(8) [CODE], 2019, 2022 and 2025). Worked example: 7
appliances of 75 cd on 600 ft of 12 AWG from 20.4 V draw 1.4 A through 2.376 ohm, drop 3.33 V and
leave 17.07 V, a margin of 6.7 percent: no fail, a THIN warning, and the longest passing length is
793.6 ft. With 14 appliances on 14 AWG the same run leaves 9.85 V: FAIL.

Basis by NFPA 72 edition: 2025 is NFPA 72-2025 §18.3.7.1 to §18.3.7.6 [CODE]; on 2022 and 2019 sites
the same method is PRACTICE (2022 §18.3.7 ends at §18.3.7.2; 2019 has no §18.3.7). On the hidden
Canadian row the check is not evaluated: CAN/ULC-S524 and CEC Section 32 are not held. It raises no
signal, has no matrix row, and is no input of detection, P, the release, the hooks or the standby
battery calculation. Not modelled: point-to-point, Class A, module voltage adjustment, sync-module
loss, speaker circuits (Cycle 9) and the NAC alarm current in the battery calculation.

**The two-number refill report**, **Finish once per unchanged blocker set** and the **Tutor's
sentences** are described under "Recovery after an incident" and "The Finish button" above.

**Compressor relief warnings** (FP Lead; PRACTICE checks on ASSUMED picks, never a fail). Plan review
and the compressor's **Relief check** row warn when the relief setpoint is at or below the cut-out, or
at or below the high-air setpoint of a zone the compressor feeds (the relief will lift during normal
operation), and when the relief is above the rated max discharge. The drift of an open AVC bypass is
unchanged: a cut-out still rules over a lower relief, and the first warning flags that configuration.

**Owner / insurer refill target** (FP Lead). An optional site setting, 10 / 15 / 20 / 25 min. It is
judged the way the code check is: the largest zone alone, from 0 psig (method ASSUMED, unless the owner
defines it differently). A fill longer than the target and inside the code limit is a plan review
warning that starts "Owner/insurer criterion:" and says it is a warning, not a code failure. Over the
code limit (30 min, or 60 where the zone qualifies) it stays the code FAIL, with no second finding. The
drill report adds "Owner/insurer target: 15 min. Met." or "Not met", and with a target set the valve shows
an **Owner / insurer refill target** row under the sizing row.

**Telecom is a room type; NFPA 76 applies by room** (fire alarm lead). Only a **Telecom / MMR (NFPA
76 space)** room can be an NFPA 76 space; a data hall never is. The site setting is now only the
default for telecom rooms, and each telecom room can override it ("NFPA 76 applies here"). Which rooms
count as NFPA 76 telecom is PRACTICE, NEEDS PE REVIEW. The two ceilings are checked in every NFPA 76
room that holds an aspirating detector, and each finding names the room. On a **VEA** detector, and
only there, Fire 1 is read per room: the room's own pick, else the site pick, else 0.5 %/ft in an NFPA
76 telecom room and 1.23 %/ft in every other room. The site setting no longer pushes 0.5 onto the
halls. Migration: a save from before Cycle 8 with the site setting on keeps its sensitivity (on a VEA
site with no stored pick, 0.5 is written as the site pick) and says once: "NFPA 76 now applies by room.
This save has no telecom room, so no room is checked until you set one (room type Telecom / MMR, or
NFPA 76 applies here)." No contract uses the room type.

**No recall, shunt, waterflow or door device feeds the release** (fire alarm lead, joint ruling
8cb97c21, PRACTICE). Elevator recall, shunt trip, door hold-open and locked-door devices are fire alarm
outputs and monitor points only; a shunt trip is not an EPO hook. None exists in the game yet, and an
acceptance check guards the rule for when one does.

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
| 12 | Panel reset #2: clear the pressure-loss (P) latch and troubles; panel reads normal | no live panel |
| 13 | Slowly open the control valve fully; confirm no flow, panel normal, supervision restored | no control valve upstream |

A step that does not apply counts as done. Two panel resets, for two reasons: #1 so detection drops
out and the clapper can be reset (the riser reset is refused while D is latched), #2 after the air is
back, which is what clears P; an earlier one latches P again and scores nothing. Silence is not
reset: it acknowledges the sound and clears nothing. After a trip the
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
  operator log. A dead panel is a warning, never a refusal: it cannot release anything. In practice
  the mistake is allowed to happen: if a head is still open and the valve is still tripped or P is
  latched, water goes out through that head. A banner then says so (Fire Tutor, word for word:
  "PRACTICE: You reopened the control valve with a head still open. Water flowed out of that head.
  Close the valve and finish the recovery in order."; it goes away after 7 s or with a click), and the
  log gives the full explanation once per reopening: the flow in gpm, which steps were skipped (replace
  the head, reset the valve at the riser, panel reset #2 and P, whichever applied) and the correct
  order. The scored drill incident keeps its hard stop.

Only the broken-sprinkler incident in the contract 5 drill is scored, and there the list has a
**step 14, the main drain test** (Fire Tutor): 14 of 14 in order earns the star. Its label is the
Tutor's (Cycle 8): "Main drain test (company practice). NFPA 25 requires a valve status test after a
control valve is reopened (2023 13.3.3.4)." The banner and the log read: "Company practice. Main drain
test: with the control valve fully open, open the main drain fully, record static and residual
pressure, then close it slowly. A 10 percent drop in full flow pressure against the last test means
find the cause (NFPA 25)." (the last sentence is ASSUMED wording). The
step counts when the test is run from the valve's Tests button after the control valve is back open,
with both readings recorded. A drop of more than 10 percent against the last test does not fail the
step and is not an automatic fail: it is a trigger to investigate (Fire Tutor correction, Cycle 8).
The result reads **INVESTIGATE** instead of FAIL, cites the rule ("NFPA 25-2023 §13.2.2.3 (2020
§13.2.3.3): a 10 percent drop in full flow pressure vs the acceptance test or earlier tests means find
the cause and correct it if necessary.") and says, in the Tutor's words: "Full flow pressure is X
percent lower than the last test. NFPA 25 says find the cause. A partly closed valve is the usual one.
Check the zone control valve and the supply valves upstream (riser control valve, PIV, backflow
preventer valves)." The trigger is strictly more than 10 percent. **Check the valves upstream** on the valve reports
every control valve on the supply path and logs the check. In a drill, a drop over 10 percent that is
followed by none of that check, a supply-path control valve reopened, or a later passing test is one
informational error line, "10% drop not investigated" (PRACTICE scoring). With no earlier test the
reading is recorded as the baseline and nothing is scored. If the test is skipped after the valve was
reopened the report says: "Main drain test not done. After any control valve is closed and reopened,
run one to prove the valve is fully open." There is no timed nag. The banner and the log give the instruction when the valve is
back open, and the valve shows a "Drill step 14" row under the thirteen. The pass rule on the test
report is the code's (NFPA 25-2023 §13.2.2.3; 2020 §13.2.3.3: a 10 percent reduction in **full flow
pressure** against the previous tests means find the cause). What the code requires after a control
valve is closed and reopened is the **valve status test** (2023 and 2026 §13.3.3.4); running the main
drain test at that point is company practice, and static-then-full-flow, close slowly, compare with the
last test is ASSUMED teaching practice.

The **recovery rating** reads **water stopped**: the time from the alarm to the control valve closed
(step 3), plus every step in order. Three stars within 60 s, two within 150 s, one for any complete
in-order recovery (ASSUMED, play test; informational one more cycle, and separate from the contract's
stars). The report adds the Tutor's tip: "In a real building, getting to the riser takes minutes. Know
where each zone's control valve is before an event." When water was stopped in under 30 s it adds, on
its own line: "Your time assumes you were standing at the riser." The alarm is the first alarm signal after the incident opens, or the incident itself where
none rings (a broken head on a double-interlock zone never trips). The times are reported on their own
lines and never summed: "Operator steps took: 23 s" is the recovery itself, "Main drain test took:
34 s" is step 14. The water is two lines too, never a total: "Discharged through the open head: 121
gal" and "Main drain test: 156 gal (to drain, not to the floor)". Water out of a system drain, an
inspector's test or the pump test header is neither: when there is some it gets a line of its own, in
the Tutor's words: "Other drains and test connections (system drain, inspector's test): 5 gal, to
drain, not to the floor." The **air refill is two numbers on two labeled lines** (Cycle 8: FP Lead for
the order and labels, Fire Tutor for the sentences), and only the first is ever compared with the
limit. On top, because it decides pass or fail: "Code check: largest zone alone, from 0 psig: 19.1 min.
Limit 30 min (NFPA 13). Passes." with the section of the edition in force (2019 and 2022 §8.2.6.3.2;
2025 §8.2.7.3); where the compressor is too small it ends "Fails: the compressor is too small for this
zone. Size it to refill the largest zone to normal pressure in 30 min." (the failure itself is the plan
review finding). Under it: "Air refill this drill, measured: 12.2 min (zones refilled at the same time,
from partly full). Informational." That line never carries a limit, "OK" or "over". Whenever zones share
a compressor the report adds: "Note: 3 zones share this compressor. It is sized for the largest zone,
not for all zones at once." With sequential refill on and the total over the limit, the FP Lead's PASS
sentence follows the measured line. No line can fail the drill. Every other
recovery, after a trip test or in the Sandbox, is practice: the valve's inspector shows a **Recovery
checklist (PRACTICE)** with each of the thirteen steps done, pending or not applicable, the main drain
test as a tip, and no goal reads it. The drill
has no hard timer: the false alarm arrives after the 30-minute air-restore window. If P is still
latched then, the valve trips and the pipe fills; with the head replaced nothing discharges and the
report adds a water-filled-zone line.

The reference operator in `test/bot.js` does the drill recovery 14 of 14 in order in about 790 s, with
the water stopped 4 s after the incident (three stars). Its own steps take 23 s and the main drain test
34 s, each on its own line; the other 732 s is one 10 SCFM compressor bringing a 364 gal zone back
from 0 psi to normal. That is realistic, and it is the lesson: recovery time is mostly compressor time.

## Code basis

Rules and numbers follow **NFPA 13** in the edition chosen under Site (default **2025**), with NFPA 20,
NFPA 25 and NFPA 72 for pumps, testing and signals, and the company rules above where they are stricter.
Section references in the game are given at chapter or section level. The edition table in
`src/juris.js` holds the section numbers that differ between 2019, 2022 and 2025 (system area limit,
dry water delivery, double-interlock delivery, the 24 h air test) and the water-delivery numbers; do
not add others without verifying them. The delivery and air-test references are as given by the fire
protection lead from the NFPA LiNK notes: 2025 is held, the 2022 delivery sections are verified
(Cycle 5), and the air-test and 30-minute refill sections are verified in all three editions. The
air-test values (40 psi, 1.5 psi, 24 h) are the lead's and are the same in every edition; testing above
40 psi where the normal pressure is higher is company practice (NEEDS PE REVIEW). The NFPA 72 sections
(supervising-station paths, DACT test interval, missed test and channel failure, AC-fail delay and
class, trouble at the panel, battery monitoring, and since Cycle 6 the DACT attempts, signal priority,
the trouble resound, standby capacity and its sizing factor, and the charger rules) are from the fire
alarm lead's pulls and live in `DI.REF72` in the same file, keyed by the NFPA 72 edition (2019, 2022,
2025), which is its own site setting. The NFPA 25 references for the main drain test and the valve
status test are the fire protection lead's and live in `DI.REF25`. Aspirating detector ranges are from the maker's datasheets (document numbers above),
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
package.json            npm scripts; Playwright for browser tests and the Tauri CLI for desktop builds
fixtures/
  di-release-truth-table.csv   the fire alarm lead's release truth table, rows R01 to R17: copied verbatim, pinned by sha16, never edited here
review/
  truth-table-check.js         prints the truth table against the engine, row by row
src/
  core.js       constants, units, pipe table by schedule, pipe size cut, C factor, hazard and room tables (the Refrigerated Space and Telecom / MMR room types included)
  juris.js      enforced-edition table (US 2019 / 2022 / 2025, hidden Canada row), delivery, air-test and refill citations, NFPA 72 citations by NFPA 72 edition (its own site setting), NFPA 25 main drain and valve status references, water-delivery numbers, NFPA 76 ceilings
  data.js       part catalogue, costs, pump curve, maker trim presets, aspirating detector models and their listed ranges, signal registry (classes, fire-department dispatch list, schedule tags), panel power, the standby table and calculation, supervising-station and DACT tables (attempts, hold and send), the AVC helpers, setting defaults
  world.js      the tile map: pipes, sprinklers, parts, tubing, wires, capped joints, site settings, save migration
  solver.js     global gradient network solver with node capacitance
  systems.js    which pipe belongs to which riser; volumes, remote sprinkler, loops; the control valves on a supply path; zone volume and delivery limits
  graph.js      tile map -> reduced hydraulic network
  links.js      how each part appears to the solver; pressure read-back
  gas.js        supervisory gas, P sensor, release state (D, P, Manual Release zone, solenoid), trip logic, water-filled zone, mechanical release, system fill, air supply sizing (the code check), the informational fill readings, the AVC bypass, the return to normal set point with its drain coaching, scored events (on the minimum pressure of each step), the Finish gate and button, the per-zone refill limit, sequential refill, riser and trim reset
  fire.js       fire growth, sprinkler activation, pipe breaks, head-replacement gate, water and smoke damage, freeze, corrosion
  alarm.js      detection stages, listed-range and NFPA 76 checks, signals with their transmission delays, panel battery and charger, DACT channels and the DACT queue (attempts, hold and send, restore order with OPEN last, restorals, the hazard case), the waterflow latch, the VEA Fire 1-only detection, the trouble resound, manual stations, dead panel, impairment tags, panel reset and silence, recovery score (water stopped, step 14) and rating, fire-department dispatch, technician
  cause.js      the cause-and-effect matrix of a preaction zone, the signal schedule and the standby reference table, generated from the class registry and the release state; hook elections and triggers
  sim.js        tick loop, pump controllers, control-valve reopen gate, operator log, tank, commissioning, fast-forward, save/load
  calc.js       density/area hydraulic calculation
  review.js     plan review rules
  proc.js       test procedures (trip, inspector's, main drain with its baseline and drop, pump, air, churn)
  scen*.js      scenario toolkit (the drill report lines: tiers, time and gallon lines, main drain follow-up, return-to-normal errors, shared-compressor note; the commissioning record a drill keeps) and the seven contracts + sandbox
  puz.js        field calls: variants as scenarios, the edit count against the starting layout, hints, diagnosis, the out-of-service clock and resets made while the cause was live, the scorecard, the cheap and maintained fixes
  puz1.js puz2.js   the eight field calls, each with two or three variants
  manual.js     the in-game field manual
  glyphs.js render.js input.js inspect.js ui.js puzui.js audio.js main.js style.css   the front end (puzui.js: the field call menu, briefing, hints, diagnosis, report and comparison)
test/
  solver.test.js  graph.test.js  sim.test.js  proc.test.js   engine tests against hand calcs
  truth-table.js              pins and self-checks the truth-table fixture, then runs it against the engine (used by sim.test.js and review/)
  campaign.test.js  bot.js    plays every contract headlessly with a reference solution and an operator
  puzzle.test.js              plays every field call variant: broken at the start, both fixes solve it, edits and diagnosis counted
  ui.play.js  ui.c2.js  ui.c3.js  ui.c4.js  ui.c5.js  ui.c6.js  ui.c7.js  ui.c8.js  ui.puz.js  shot.js   browser tests (Playwright): a full contract by mouse and keyboard, the Cycle 2, 3, 4, 5, 6, 7 and 8 UI checks and the field calls
```

About 6,800 lines of vanilla JavaScript, no runtime dependencies, no assets. Sound is generated.

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
                              # supervising-station timing), the Cycle 5 checks (A54 onward: signal
                              # registry and fire-department dispatch, signal schedule, hook triggers,
                              # DACT channel trouble, NFPA 72 edition, air supply code check and the two
                              # fill readings, return to normal set point, recovery rating, practice
                              # reopen note, save / load of power and delay clocks, El/Pn dead panel,
                              # the locks), the Cycle 6 checks (A68 onward: drain realism and the
                              # return-to-normal gate, the AVC and sizing on normal, DACT retries, hold
                              # and send and the restore order, the 24 h resound, the standby
                              # calculation, recharge, low battery and charger, the Fire 2 HVAC input
                              # rule, manual pull and release labels, water stopped and step 14, the
                              # Tutor wording, the refrigerated limit, persistence, the locks), the
                              # Cycle 7 checks (A93 onward: hold OFF keeps a live alarm, the restore
                              # order with OPEN last, the waterflow latch, restorals and the hazard
                              # case, the Finish gate and its dt-independent scoring, the drill report
                              # error lines, the AVC drift ceiling and the bypass tamper, the per-zone
                              # refrigerated limit, sequential refill, the main drain follow-up, the
                              # tiers and report lines, the VEA Fire 1 pick, the charger, persistence,
                              # the locks and the standalone build), the Cycle 8 checks (A113 onward:
                              # the 2019 and CA-2019 station labels, the latch label, the 10 percent
                              # rule and INVESTIGATE, step 14 and the room name, the NAC voltage drop
                              # with hand-calculated anchors, verdicts, labels by edition and its
                              # isolation from release and standby, the two-number refill report,
                              # Finish once per blocker set, the compressor relief and owner target
                              # warnings, the Tutor sentences, the telecom room type, NFPA 76 by room
                              # with its migration and the release lock, the guard that no recall,
                              # shunt, waterflow or door device feeds the release, persistence, docs)
                              # and static greps
node test/proc.test.js        # commissioning procedures
node test/campaign.test.js    # all seven contracts: goals met, drill passed, cost reported, the
                              # commissioning record kept through the drill; then an informational
                              # what-if with the insurer set to FM (not counted)
node test/puzzle.test.js      # every field call variant: the fault is real after the player's proving
                              # steps, the cheap and the maintained fix both meet every goal, their edit
                              # counts match the comparison, a wrong diagnosis is counted and the right
                              # one accepted, the edit rules (a valve in a pipe run is one edit, a valve
                              # position is none), save / load of the call's state
node review/truth-table-check.js   # the truth table against the engine, one line per row
node test/ui.play.js out.png  # needs Playwright: plays contract 1 with real input events
node test/ui.c2.js out.png    # needs Playwright: Site gate and round-trip, P latch and both reset
                              # paths, dead panel, stage order, mechanical release, impairment tag
node test/ui.c3.js out.png    # needs Playwright: Manual Release zone path, dead panel, head gate,
                              # recovery checklist and reopen gate, 24 h air test, supply air and the
                              # water-filled zone, detector model and the NFPA 76 ceilings
node test/ui.c4.js out.png    # needs Playwright: cause-and-effect matrix, NFPA 76 check, refill clock
                              # and skip, the reopen gate in both modes, impairment tag, station timing
node test/ui.c5.js out.png    # needs Playwright: hook triggers and the NFPA 72 edition row, the signal
                              # schedule, the DACT channel fault, the sizing fail and the two fill rows,
                              # recovery wording and the practice reopen note, return to normal set
                              # point, save / load with utility power off
node test/ui.c6.js out.png    # needs Playwright: drain coaching and the Return to normal result, the
                              # AVC row, bypass and pick, the Site rows (hold and send, standby basis,
                              # generator, air refill order), the supervising station queue, the
                              # matrix footnote, the panel's battery rows and faults, the standby
                              # reference dialog, the practice reopen banner, the main drain tip and
                              # drill step 14. Saves out.png plus one screenshot per new panel
                              # (out-valve.png, -site.png, -standby.png, -queue.png, -panel.png, -banner.png)
node test/ui.c7.js out.png    # needs Playwright: the Finish return to normal button in every mode, its
                              # refusal and clean pass, the compressor picks and the AVC bypass tamper
                              # switch, the Site dialog (per-zone note, air refill order, the VEA model
                              # and its Fire 1 pick), the Refrigerated Space room toggle, the charger
                              # pick and its FAIL text, RESTORAL and HAZARD CASE in the station queue,
                              # the main drain hint and "Check the valves upstream", and the drill
                              # report lines. Saves out.png plus out-finish.png, -avc.png, -site.png,
                              # -room.png, -charger.png, -queue.png, -report.png
node test/ui.c8.js out.png    # needs Playwright: the NAC block on the panel (off by default, the FAIL
                              # and THIN cases, labels by edition, NEC 2026, the Canadian hold), the
                              # Site rows (NEC edition, owner / insurer refill target), the drill
                              # report (code check above measured, the shared note, the realism and
                              # other-drains lines), the neutral refill rows, Finish pressed three
                              # times, the compressor relief warnings, the Refrigerated Space and
                              # Telecom / MMR rooms with NFPA 76 by room, the latch label on the signal
                              # schedule, the station queue footnote on a 2019 site, INVESTIGATE, step
                              # 14 as company practice, and an old save with the NFPA 76 flag on.
                              # Saves out.png plus out-nac.png, -site.png, -report.png, -finish.png,
                              # -comp.png, -room.png, -sched.png, -drain.png
node test/ui.puz.js out.png   # needs Playwright: the field calls by mouse: the menu and its lock order,
                              # the briefing, a hint that moves the camera, the flow test before and
                              # after a repair drawn with the Main tool, a wrong then a right diagnosis,
                              # the scorecard and the three drawn fixes, Turn end for end, the Cap tool
                              # on a test blank, save and reload in a call, Unlock all, and the drill
                              # commissioning record. Saves out-menu.png, -brief.png, -diagnose.png,
                              # -report.png, -blank.png
```

`npm test` runs the six engine suites and `npm run test:ui` the nine browser tests. `sim.test.js`
also checks that `double-interlock.html` is what `build-standalone.js` makes from `src/` as it stands,
so run `node build-standalone.js` after any change in `src/` and before the tests. Put
`STANDALONE=1` in front of a browser test to run it against the built `double-interlock.html`. `npm install`
is needed only for the browser tests (it fetches Playwright); the game itself has no dependencies and
still runs from `file://`.

`test/bot.js` holds a working layout for every contract, and every field call carries its own cheap and
maintained fix in `src/puz1.js` / `src/puz2.js`. Those are spoilers.

## Ideas not built

Elevation and multi-storey risers, looped yard mains with hydrants as a scored objective, a first-person riser room for the trim-level procedures, hot-aisle
containment as an obstruction rule, and exporting a calc sheet.

Planned for later cycles: a contract that pairs a dead panel with the mechanical emergency release
(the dead-panel behaviour it needs is in), the calculation / table route for water delivery,
underground and yard pipe material, the rest of the FM overlay (density / area, hose and duration;
hazard classes by insurer with lithium-ion rooms as an ESS off-ramp), a contract that sets the insurer
to FM, the rest of the fire alarm phase-in (notification circuits, when the LocalNAC column becomes a
simulated output; a modelled building FACU, EVACS or ESS panel; a live-status column on the matrix),
matrices for dry and wet valves, two-way radio paths, a configurable DACT retry count, a model of the
supervising station's 6 h DACT test and its missed-test annunciation, speaker circuit loss (Cycle 9: it
reuses the Table 8 wire layer of the NAC check), NAC point-to-point and Class A, the NAC alarm current
in the standby battery calculation, elevator recall and door-lock interfaces (monitor points and
outputs only: they never feed the release), the supervising-station charger rule, a
compressor pressure-switch model, a drill that fails a compressor and fills a zone on the clock, a
plan-review finding for missing supply-air supervision, a compressor's own low-air alarm on a separate
supply, a contract that uses the freezer or the telecom room type, an owner target for the sequential
refill total (a warning, NEEDS PE REVIEW), a bonus contract star (the Cycle 9 question: the Fire Tutor
proposes zero return-to-normal errors and water stopped within 60 s, the FP Lead the error list only
and never time; never a gate, the base contract unchanged), a per-room Fire 1 for VEP, VEU or spot
detectors, more aspirating models (Alert, Action and Fire 2 for VEA once a
datasheet gives them; TITANUS and FAAST once consistent current sheets are held) and a UL Product iQ check of
every listing, and real Canada edition rules once verified.
