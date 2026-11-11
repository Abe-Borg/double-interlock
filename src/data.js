// Part catalogue. ports: 2 = inline (in on W, out on E at rot 0), 'o' = single outlet (E),
// 'i' = single inlet (W), 0 = no pipe connection.
var DI = globalThis.DI || (globalThis.DI = {});

DI.PARTS = {
  city: { name: 'City Main Tap', cat: 'supply', cost: 8000, ports: 'o', key: 'C',
    desc: 'Connection to the public main. Its hydrant flow test (static / residual @ flow) defines everything it can give you.',
    props: { stat: 62, resid: 45, flow: 1000 } },
  tank: { name: 'Fire Water Tank', cat: 'supply', cost: 185000, ports: 'o', key: 'T',
    desc: 'Dedicated storage. Size it for sprinkler demand + hose stream for the full duration. Gives almost no pressure on its own.',
    props: { cap: 240000, gal: 240000, ht: 32, fill: 150 } },
  epump: { name: 'Electric Fire Pump', cat: 'supply', cost: 98000, ports: 2, key: 'E',
    desc: 'Motor-driven horizontal split-case pump with a listed controller. Starts on pressure drop. Useless without power.',
    props: { gpm: 1500, psi: 125, start: 105, on: false, auto: true, mode: 'auto', emerg: false, spd: 0, lockout: false, ranFor: 0 } },
  dpump: { name: 'Diesel Fire Pump', cat: 'supply', cost: 165000, ports: 2, key: 'D',
    desc: 'Engine-driven pump: independent of the grid. Needs fuel (1 gal/hp + 5% + 5%), two battery sets, and a weekly 30-minute run.',
    props: { gpm: 1500, psi: 125, start: 95, on: false, auto: true, mode: 'auto', fuel: 1, batt: 1, spd: 0, crank: 0, lockout: false, ranFor: 0, lastRun: 0 } },
  jockey: { name: 'Jockey Pump', cat: 'supply', cost: 9500, ports: 2, key: 'J',
    desc: 'Pressure-maintenance pump. Makes up small leakage so the fire pump only starts for real demand.',
    props: { gpm: 15, psi: 135, start: 115, stop: 125, on: false, auto: true, starts: 0 } },
  bfp: { name: 'Backflow Preventer', cat: 'supply', cost: 14000, ports: 2, key: 'B',
    desc: 'Double check assembly. Protects the public water supply; costs you several psi at flow.', props: {} },
  gate: { name: 'Control Valve + Tamper', cat: 'valve', cost: 2400, ports: 2, key: 'V',
    desc: 'Indicating control valve (OS&Y / butterfly) with a supervisory switch. A closed valve is the #1 cause of sprinkler failure.',
    props: { open: 1, target: 1, sealed: false } },
  check: { name: 'Check Valve', cat: 'valve', cost: 3200, ports: 2, key: 'K',
    desc: 'One-way flow. Keeps pump pressure in, keeps FDC water from running backwards.', props: {} },
  fdc: { name: 'Fire Dept. Connection', cat: 'supply', cost: 4500, ports: 'o', key: 'F',
    desc: 'Lets the responding engine company pump into your system (about 150 psi). Needs its own check valve.', props: { active: false } },
  testhdr: { name: 'Pump Test Header', cat: 'supply', cost: 6500, ports: 'i', key: 'H',
    desc: 'Hose valves outside the pump house for acceptance and annual flow tests (churn, 100%, 150%).', props: { open: 0 } },
  wetv: { name: 'Wet Riser (Alarm Check)', cat: 'system', cost: 6500, ports: 2, key: '1',
    desc: 'Pipe is full of water all the time. Fastest, simplest, most reliable. Cannot freeze; one broken sprinkler = water now.',
    props: { drain: 0, itc: 0 } },
  dryv: { name: 'Dry Pipe Valve', cat: 'system', cost: 14500, ports: 2, key: '2',
    desc: 'Pipe holds air; a differential clapper holds water back. Sprinkler opens, air drops, valve trips. For spaces that freeze.',
    props: { drain: 0, itc: 0, sdrain: 0, qod: false, tripped: false, airSet: 40, hiAir: 50, loAir: 30, airValve: 1 } },
  prev: { name: 'Preaction Valve', cat: 'system', cost: 24000, ports: 2, key: '3',
    desc: 'Deluge valve + closed sprinklers + detection. Double interlock: detection (Fire 1 or the manual station) AND P (pipe pressure below the P trip setpoint) must both happen before water enters.',
    props: { drain: 0, itc: 0, sdrain: 0, tripped: false, trim: 'el-el', airSet: 40, hiAir: 50, loAir: 30, pTrip: 20, pLatch: false, mech: false, airValve: 1, pull: false, sol: false, solOut: false, mrzL: false } },   // mrzL: Manual Release zone release latched
  comp: { name: 'Air Compressor', cat: 'air', cost: 3400, ports: 0, key: 'A',
    desc: 'Riser-mounted compressor + air maintenance device. Must restore normal air pressure within 30 minutes.',
    props: { scfm: 5, on: false, runSec: 0, starts: 0, fault: false, cutOut: 0 } },      // cutOut: psi, 0 = none; a sizing input only (DI.sizingP)
  n2: { name: 'Nitrogen Generator', cat: 'air', cost: 29000, ports: 0, key: 'N',
    desc: 'Membrane generator: 98%+ nitrogen as supervisory gas. Starves the oxygen corrosion that eats dry and preaction pipe.',
    props: { scfm: 2.5, on: false, runSec: 0, starts: 0, fault: false } },
  panel: { name: 'Releasing Panel (FACP)', cat: 'alarm', cost: 18000, ports: 0, key: 'P',
    desc: 'Listed releasing fire alarm panel. Wire detection, manual stations, switches and solenoids to it. 24 h standby battery.', props: { silenced: false, chan: [1, 1] } },     // chan: the two DACT channels, 1 = up (used on the DACT path only)
  vesda: { name: 'Aspirating Smoke Detector', cat: 'alarm', cost: 14000, ports: 0, key: 'S',
    desc: 'Air-sampling very-early-warning detection in four stages. Alert is supervisory, Action is a pre-alarm, Fire 1 is the detection leg of a release, Fire 2 is escalation only.',
    props: { lvl: 0, obs: 0 } },
  smoke: { name: 'Spot Smoke Detection', cat: 'alarm', cost: 4200, ports: 0, key: 'O',
    desc: 'Listed ceiling spot detector. In an electrical / UPS room one detector in alarm is the detection leg of a release. In white space it only raises the alarm.', props: { lvl: 0, obs: 0 } },
  mstn: { name: 'Manual Release Station', cat: 'alarm', cost: 900, ports: 0, key: 'M',
    desc: 'Manual station wired to the releasing panel. Typed DETECTION: operating it is the detection leg for every preaction valve that protects the room it is in, and water still needs P.', props: { on: false } },
};

// Listed sensitivity ranges, %/ft obscuration.
//   smoke: 0.5 to 4.0 is the FA Lead's example window for a spot photoelectric detector (example data, not cited).
DI.LISTED = { smoke: { min: 0.5, max: 4.0 } };
// Aspirating detector: the listing bounds every threshold per stage, per model. The ranges below are read from
// the maker's own datasheets (FA Lead pull, 2026-11-10); the UL Product iQ listing itself was not readable, so
// every range is shown with DI.ASD_SRC. Each range is [min, max] inclusive, in the stage order of DI.detThr
// (Alert, Action, Fire 1, Fire 2). The sheets print setting ranges only, no default thresholds: the example
// defaults (DI.VESDA_T) are owner-set values inside the range, ASSUMED and NEEDS PE REVIEW.
// Recorded, not merged: the 2020 Honeywell VEP sheet (VESDA-E-VEP V.02, 04/20) prints the same metric ranges
// with different imperial figures (0.0016 to 0.625 Alert / Action, 0.0031 to 0.625 Fire 1, 0.0063 to 6.25
// Fire 2). The July 2025 UL 268 7th Ed. sheet governs for the US models.
// Not in the table: FAAST and TITANUS (see README), and VEA, which is recorded here and not modelled:
//   VESDA-E VEA, Enhanced Fire 1 = 1.23 %/ft (Xtralis Doc. 36348_03, primary). The Gamewell sheet prints 1.3: an OEM
//   variant, kept as a note only. Discrete Fire 1 settings 0.5 / 1.23 / 2.5 %/ft; Alert and Action are not printed.
//   It is not a model because the engine assumes four stages (DI.detThr, the level loop in DI.alarmStep): VEA would
//   need stages marked unavailable and a Fire 2 value that the sheets pulled do not give. It waits for a datasheet
//   pull of its Fire 2 behaviour (FA Lead). UL Product iQ stays "not checked".
DI.ASD_SRC = '[HB, datasheet; UL Product iQ not checked]';
DI.ASD_STAGES = [['alert', 'Alert'], ['action', 'Action'], ['fire1', 'Fire 1'], ['fire2', 'Fire 2']];
DI.ASD_MODELS = {
  VEP: { label: 'VESDA-E VEP', models: 'VEP-A00-1P-UL, VEP-A00-P-UL, VEP-A10-P-UL', doc: 'Xtralis Doc. 36106_07, Part AD36106-007, July 2025, p. 2', src: 'xtralis.com/file/12015',
    range: { alert: [0.0015, 0.614], action: [0.0015, 0.614], fire1: [0.0030, 0.614], fire2: [0.0061, 6.575] } },
  VEU: { label: 'VESDA-E VEU', models: 'VEU-A00-UL, VEU-A10-UL', doc: 'Xtralis Doc. 36107_05, Part AD36107-005, November 2024, p. 2', src: 'xtralis.com/file/12017',
    range: { alert: [0.0003, 0.614], action: [0.0003, 0.614], fire1: [0.0003, 0.614], fire2: [0.0003, 6.575] } },
};
DI.ASD_DEFAULT = 'VEP';
// recorded, not modelled (shown in the manual; never offered as a model)
DI.ASD_RECORDED = { VEA: { label: 'VESDA-E VEA', doc: 'Xtralis Doc. 36348_03', fire1: [0.5, 1.23, 2.5], primary: 1.23, oem: 1.3,
  note: 'VESDA-E VEA, recorded and not modelled: Enhanced Fire 1 = 1.23 %/ft (Xtralis Doc. 36348_03, primary). The Gamewell sheet prints 1.3, an OEM variant, kept as a note only. Discrete Fire 1 settings 0.5 / 1.23 / 2.5 %/ft; Alert and Action are not printed and no Fire 2 value was pulled, so it cannot be a four-stage model yet.' } };
// site setting W.cfg.asdModel: the key if it is in the table, else the default (an old save has no key)
DI.asdModel = (W) => { const k = W && W.cfg ? W.cfg.asdModel : undefined; return typeof k === 'string' && Object.prototype.hasOwnProperty.call(DI.ASD_MODELS, k) ? k : DI.ASD_DEFAULT; };
// the four [min, max] pairs of the site's model, in DI.detThr order
DI.asdRange = (W) => { const r = DI.ASD_MODELS[DI.asdModel(W)].range; return DI.ASD_STAGES.map(([k]) => r[k]); };

// Site / project settings with a default (W.cfg, saved with the world). All ASSUMED and tunable.
//   spotThr  spot detector alarm threshold, %/ft (example value)
//   fitPct   fittings allowance on pipe volume, %       trimGal  valve trim volume, gal per system valve
//   insurer  'none' | 'FM' (FM adds the 30 s delivery limit at any volume; NEEDS PE REVIEW)
DI.CFG_DEFAULT = { spotThr: 1.3, fitPct: 5, trimGal: 2, insurer: 'none' };
DI.cfgNum = (W, key, lo) => { const v = W && W.cfg ? W.cfg[key] : undefined; return typeof v === 'number' && isFinite(v) && v >= (lo || 0) ? v : DI.CFG_DEFAULT[key]; };
DI.spotThr = (W) => { const v = DI.cfgNum(W, 'spotThr'); return v > 0 ? v : DI.CFG_DEFAULT.spotThr; };
DI.insurer = (W) => (W && W.cfg && W.cfg.insurer === 'FM' ? 'FM' : 'none');

// Signal classes (W.cfg.sigClass). Alert and Action are pre-alarm: supervisory by default, alarm if the
// engineer elects it. A latched P is a release input whose class has not been elected: OPEN by default,
// ALARM or TRBL if elected, and never SUPV (supervisory is blocked for it). All ASSUMED, NEEDS PE REVIEW.
// Fixed classes, no setting (DI.SIG_FIXED): Fire 1, Fire 2, manual station, Manual Release zone, release circuit,
// waterflow and a spot detector ALARM; low and high air, valve tamper and a contract impairment SUPV; panel AC, low
// battery, loss of communication, a failed DACT channel and loss of supply air TRBL. Loss of supply air is TRBL
// [PRACTICE] (FA Lead, 2026-11-10 3:01 PM PT): a compressor or N2 power or controller fault is equipment trouble,
// its own signal; the pressure drop it causes is still reported by the separate low-air supervisory.
// The fire pump, tank and low-temperature signals keep the classes they always had (PRACTICE, not in the FA Lead's
// table: ASSUMED).
// The registry is the whole list: every signal the game raises has a key here or in DI.SIG_CLASS. DI.inClass is
// the one reader of a class. add(...) in DI.alarmStep takes the registry key, never a class, and the
// cause-and-effect matrix and the signal schedule (cause.js) read the same keys.
DI.SIG_FIXED = { fire1: 'ALARM', fire2: 'ALARM', manual: 'ALARM', mrz: 'ALARM', release: 'ALARM', waterflow: 'ALARM', lowAir: 'SUPV', highAir: 'SUPV', tamper: 'SUPV',
  supplyAir: 'TRBL', acFail: 'TRBL', lowBatt: 'TRBL', lostComm: 'TRBL', impair: 'SUPV',
  spot: 'ALARM', pumpRun: 'SUPV', pumpMode: 'SUPV', pumpPower: 'SUPV', pumpFail: 'TRBL', pumpFuel: 'SUPV', pumpBatt: 'TRBL', tankLow: 'SUPV', lowTemp: 'SUPV', dactChan: 'TRBL' };
// Fire-department dispatch (FA Lead signal schedule). Alarm signals go to the fire department [CODE, section not
// pulled]: the keys below. Everything else goes to the supervising station only [PRACTICE]: every supervisory and
// trouble signal, the pre-alarm stages (Alert, Action) and a latched P even where the owner elects them ALARM, and
// the release circuit, which is an output of the panel and not an input.
DI.SIG_FD = { fire1: 1, fire2: 1, manual: 1, mrz: 1, waterflow: 1, spot: 1 };
DI.SIG_CLASS = { alert: ['SUPV', 'ALARM'], action: ['SUPV', 'ALARM'], pLatch: ['OPEN', 'ALARM', 'TRBL'] };
DI.SIG_DEFAULT = { alert: 'SUPV', action: 'SUPV', pLatch: 'OPEN' };
DI.sigClass = (W, key) => { const c = W && W.cfg && W.cfg.sigClass, v = c ? c[key] : undefined; return DI.SIG_CLASS[key].includes(v) ? v : DI.SIG_DEFAULT[key]; };
DI.inClass = (W, key) => (Object.prototype.hasOwnProperty.call(DI.SIG_CLASS, key) ? DI.sigClass(W, key) : DI.SIG_FIXED[key]);
// The signal schedule (DI.signalSchedule, cause.js): label and tag of every registry key, in the FA Lead's table
// order (the first thirteen), then the keys the Lead's table does not list. The tag is the Lead's wording where
// the table has the row; the rest are marked as ours.
(function () {
  const stn = 'station only [PRACTICE]', ours = 'PRACTICE / not in FA Lead table (ASSUMED)';
  DI.SIG_META = {
    fire1: { label: 'Fire 1 (detection, D)', tag: '[CODE, alarm signals go to the communications center; section not pulled]' },
    fire2: { label: 'Fire 2 (escalation)', tag: '[CODE, alarm signals go to the communications center; section not pulled]' },
    manual: { label: 'Manual station (typed DETECTION)', tag: '[CODE, alarm signals go to the communications center; section not pulled]' },
    waterflow: { label: 'Waterflow', tag: '[CODE, alarm signals go to the communications center; section not pulled]' },
    tamper: { label: 'Control valve tamper', tag: 'Class [CODE]; ' + stn },
    lowAir: { label: 'Low air', tag: 'Class [CODE], section not pulled; ' + stn },
    highAir: { label: 'High air', tag: 'Class [CODE], section not pulled; ' + stn },
    supplyAir: { label: 'Loss of supply air (compressor / N2 source)', tag: '[PRACTICE, per FP Lead’s call]' },
    lowBatt: { label: 'Panel low battery', tag: 'Class [PRACTICE]; no voltage threshold in held Ch.10; ' + stn },
    acFail: { label: 'Panel AC failure', tag: 'Class [CODE 10.6.9.1.1]; ' + stn },
    alert: { label: 'Aspirating Alert (pre-alarm)', tag: '[OWNER]' },
    action: { label: 'Aspirating Action (pre-alarm)', tag: '[OWNER]' },
    pLatch: { label: 'P latched (release input)', tag: 'Class OPEN (R04, R17)' },
    mrz: { label: 'Manual Release zone (9(c) bypass)', tag: ours },
    spot: { label: 'Spot smoke detector', tag: ours },
    release: { label: 'Release circuit active (a panel output)', tag: ours },
    impair: { label: 'Impairment: Manual Release zone bypass (contract)', tag: ours },
    lostComm: { label: 'Loss of communication (panel dead, or a missed DACT test)', tag: ours },
    dactChan: { label: 'DACT channel failed', tag: ours },
    pumpRun: { label: 'Fire pump running', tag: ours },
    pumpMode: { label: 'Fire pump controller not in auto', tag: ours },
    pumpPower: { label: 'Electric fire pump loss of power', tag: ours },
    pumpFail: { label: 'Diesel fire pump failed to start', tag: ours },
    pumpFuel: { label: 'Diesel fire pump low fuel', tag: ours },
    pumpBatt: { label: 'Diesel fire pump battery failure', tag: ours },
    tankLow: { label: 'Fire water tank low level', tag: ours },
    lowTemp: { label: 'Low room temperature', tag: ours },
  };
})();
// annunciator order and labels
DI.SIG_ORDER = { ALARM: 0, OPEN: 1, SUPV: 2, TRBL: 3 };
DI.OPEN_LABEL = 'RELEASE INPUT - CLASS NOT ELECTED';

// ---------- releasing panel power and the supervising station (NFPA 72 Ch. 10 and Ch. 26; citations in DI.REF72, read with DI.ref72(W))
// Standby battery: a flat 24 h of standby plus alarm (Simplification).
// Low battery: the code states no low-battery threshold. It requires the voltage to be monitored and a trouble on
// failure; the 24 h standby sets capacity, not the trouble setpoint. The trouble here is the listed manufacturer's
// low-battery voltage setpoint, represented as 1/12 of battery capacity left: [OWNER/listing], ASSUMED, NEEDS PE REVIEW.
DI.PANEL_STANDBY_H = 24;
DI.PANEL_LOWBATT_FRAC = 1 / 12;
DI.lowBattH = () => DI.PANEL_STANDBY_H * DI.PANEL_LOWBATT_FRAC;      // hours of standby left at the setpoint
DI.LOWBATT_NOTE = 'the listed manufacturer low-battery voltage setpoint, represented as 1/12 of battery capacity left (OWNER/listing, ASSUMED, NEEDS PE REVIEW)';
// Trouble signals appear at the panel within 200 s. The game shows them at once, which is inside the ceiling.
DI.TROUBLE_PANEL_S = 200;
// AC failure is transmitted to the supervising station after a delay: 60 to 180 min, OWNER / AHJ (site setting
// W.cfg.acDelayMin, default 60). If power returns inside the delay nothing is transmitted.
DI.AC_DELAY_MIN = [60, 90, 120, 150, 180];
DI.acDelay = (W) => { const m = W && W.cfg ? W.cfg.acDelayMin : undefined; return (typeof m === 'number' && m >= 60 && m <= 180 ? m : 60) * 60; };
// Path to the supervising station (site setting W.cfg.commPath, OWNER): how long after a panel dies the station
// annunciates the loss of communication. ip: a single performance-based path, 60 min (IP as the default is
// PRACTICE). multi: multiple paths, 6 h (2025 has no annunciation time for a failed path: ASSUMED). dact: the 6 h
// test-signal interval, used as the delay because the annunciation time of a missed test is not in held text
// (ASSUMED); the missed test itself is a trouble [CODE].
// ref = the key into DI.ref72(W). Two-way RF is not modelled.
// DACT channel failure [CODE]: "the failure of either channel shall send a trouble signal on the other channel
// within 4 minutes" (2019 §26.6.4.1.4(B)(3); 2022 and 2025 §26.6.4.2.4.2(3)). DI.DACT_CHAN_S is that time. The two
// channels are panel props (chan: [1, 1], 1 = up) and matter on the DACT path only; failing one is a sandbox fault.
DI.DACT_CHAN_S = 240;
DI.COMM_PATH = {
  ip: { label: 'Single path (IP, performance-based)', short: 'IP path', delay: 3600, ref: 'ipFail' },
  multi: { label: 'Multiple paths', short: 'multiple paths', delay: 21600, ref: 'multiFail' },
  dact: { label: 'DACT (dial-up)', short: 'DACT', delay: 21600, ref: 'dactMissed' },
};
DI.COMM_DEFAULT = 'ip';
DI.commPath = (W) => { const k = W && W.cfg ? W.cfg.commPath : undefined; return typeof k === 'string' && Object.prototype.hasOwnProperty.call(DI.COMM_PATH, k) ? k : DI.COMM_DEFAULT; };
DI.commDelay = (W) => DI.COMM_PATH[DI.commPath(W)].delay;
// minutes or hours, the way a delay is written in the UI
DI.delayText = (sec) => (sec % 3600 === 0 && sec > 3600 ? sec / 3600 + ' h' : Math.round(sec / 60) + ' min');

// Maker trim presets for the double-interlock preaction valve. All values ASSUMED, tunable per valve.
// Order is always high-air supervisory > normal > low-air supervisory > P trip.
DI.TRIMS = {
  'el-el': { name: 'Electric / electric', sensor: 'PSL-REL', airSet: 40, hiAir: 50, loAir: 30, pTrip: 20 },   // P sensed by a pressure switch
  'el-pn': { name: 'Electric / pneumatic', sensor: 'PA-REL', airSet: 40, hiAir: 50, loAir: 30, pTrip: 20 },    // P sensed by a pneumatic actuator
};
DI.P_MARGIN = 5;                    // ASSUMED: minimum psi between the low-air setpoint and P trip
DI.trimOf = (v) => DI.TRIMS[v.p.trim] || DI.TRIMS['el-el'];
DI.loadTrim = function (v, key) {   // load a maker preset onto a preaction valve
  const t = DI.TRIMS[key]; if (!t) return;
  v.p.trim = key; v.p.airSet = t.airSet; v.p.hiAir = t.hiAir; v.p.loAir = t.loAir; v.p.pTrip = t.pTrip;
};

DI.CATS = [
  { id: 'pipe', name: 'Piping' }, { id: 'supply', name: 'Water Supply' }, { id: 'valve', name: 'Valves' },
  { id: 'system', name: 'System Risers' }, { id: 'air', name: 'Air & N₂' }, { id: 'alarm', name: 'Detection & Alarm' },
];

DI.PUMP_GPM = [500, 750, 1000, 1500, 2000, 2500];
DI.PUMP_PSI = [80, 100, 125, 150, 175];
DI.COMP_SCFM = [2, 5, 10, 20];
DI.COMP_CUTOUT = [0, 45, 50, 55, 60];   // ASSUMED choices for the compressor cut-out pressure, psi (0 = none). Sizing input only: see DI.sizingP
DI.N2_SCFM = [1, 2.5, 5];
DI.SPK_K = 5.6;                     // standard spray sprinkler K-factor (gpm/psi^0.5)
DI.SPK_COST = 140;                  // $ per sprinkler tile (head + branch pipe is priced separately)

DI.pumpHp = (p) => Math.ceil((p.gpm * 1.5 * p.psi * 0.65) / (1714 * 0.7) / 5) * 5;   // driver sized for 150% point
DI.pumpCost = (type, p) => {
  const base = type === 'dpump' ? 78000 : 42000;
  return Math.round((base + DI.pumpHp(p) * (type === 'dpump' ? 520 : 330)) / 500) * 500;
};
DI.fuelCap = (p) => Math.ceil(DI.pumpHp(p) * 1.1);          // NFPA 20: 1 gal/hp + 5% expansion + 5% sump
DI.partCost = (type, props) => {
  const d = DI.PARTS[type];
  if (type === 'epump' || type === 'dpump') return DI.pumpCost(type, props || d.props) + (props && props.emerg ? 38000 : 0);
  if (type === 'tank') return Math.round(40000 + (props ? props.cap : d.props.cap) * 0.6);
  if (type === 'comp') return 1800 + (props ? props.scfm : 5) * 320;
  if (type === 'n2') return 19000 + (props ? props.scfm : 2.5) * 4000;
  if (type === 'dryv') return d.cost + (props && props.qod ? 2800 : 0);
  return d.cost;
};

// Fire pump curve (NFPA 20 shape): churn 120% of rated head, 100% at rated flow, 65% at 150% flow.
// H = Hr * (1.2 - 0.2 * (Q/Qr)^2.495) * speed^2
DI.PUMP_EXP = Math.log(2.75) / Math.log(1.5);
DI.pumpHead = (p, q, spd) => {
  const s = spd === undefined ? 1 : spd;
  return p.psi * s * s * (1.2 - 0.2 * Math.pow(Math.max(q, 0) / (p.gpm * Math.max(s, 0.05)), DI.PUMP_EXP));
};
