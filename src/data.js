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
    props: { drain: 0, itc: 0, sdrain: 0, tripped: false, trim: 'el-el', airSet: 40, hiAir: 50, loAir: 30, pTrip: 20, pLatch: false, mech: false, airValve: 1, pull: false, sol: false, solOut: false } },
  comp: { name: 'Air Compressor', cat: 'air', cost: 3400, ports: 0, key: 'A',
    desc: 'Riser-mounted compressor + air maintenance device. Must restore normal air pressure within 30 minutes.',
    props: { scfm: 5, on: false, runSec: 0, starts: 0 } },
  n2: { name: 'Nitrogen Generator', cat: 'air', cost: 29000, ports: 0, key: 'N',
    desc: 'Membrane generator: 98%+ nitrogen as supervisory gas. Starves the oxygen corrosion that eats dry and preaction pipe.',
    props: { scfm: 2.5, on: false, runSec: 0, starts: 0 } },
  panel: { name: 'Releasing Panel (FACP)', cat: 'alarm', cost: 18000, ports: 0, key: 'P',
    desc: 'Listed releasing fire alarm panel. Wire detection, manual stations, switches and solenoids to it. 24 h standby battery.', props: { silenced: false } },
  vesda: { name: 'Aspirating Smoke Detector', cat: 'alarm', cost: 14000, ports: 0, key: 'S',
    desc: 'Air-sampling very-early-warning detection in four stages. Alert is supervisory, Action is a pre-alarm, Fire 1 is the detection leg of a release, Fire 2 is escalation only.',
    props: { lvl: 0, obs: 0 } },
  smoke: { name: 'Spot Smoke Detection', cat: 'alarm', cost: 4200, ports: 0, key: 'O',
    desc: 'Listed ceiling spot detector. In an electrical / UPS room one detector in alarm is the detection leg of a release. In white space it only raises the alarm.', props: { lvl: 0, obs: 0 } },
  mstn: { name: 'Manual Release Station', cat: 'alarm', cost: 900, ports: 0, key: 'M',
    desc: 'Manual station wired to the releasing panel. Typed DETECTION: operating it is the detection leg for every preaction valve that protects the room it is in, and water still needs P.', props: { on: false } },
};

// Listed sensitivity window of each detector model, %/ft obscuration. Fire 1 and Fire 2 (aspirating) and the
// spot alarm threshold must sit inside the window of the device (plan review fails anything outside).
//   smoke: 0.5 to 4.0 is the FA Lead's example window for a spot photoelectric detector (example data, not cited).
//   vesda: ASSUMED placeholder 0.01 to 5.0 until the maker's listing for the aspirating detector is given.
DI.LISTED = { vesda: { min: 0.01, max: 5.0, assumed: true }, smoke: { min: 0.5, max: 4.0 } };

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
// Fixed classes, no setting: Fire 1, Fire 2, manual station and waterflow ALARM; low and high air SUPV;
// panel and battery TRBL.
DI.SIG_CLASS = { alert: ['SUPV', 'ALARM'], action: ['SUPV', 'ALARM'], pLatch: ['OPEN', 'ALARM', 'TRBL'] };
DI.SIG_DEFAULT = { alert: 'SUPV', action: 'SUPV', pLatch: 'OPEN' };
DI.sigClass = (W, key) => { const c = W && W.cfg && W.cfg.sigClass, v = c ? c[key] : undefined; return DI.SIG_CLASS[key].includes(v) ? v : DI.SIG_DEFAULT[key]; };
// annunciator order and labels
DI.SIG_ORDER = { ALARM: 0, OPEN: 1, SUPV: 2, TRBL: 3 };
DI.OPEN_LABEL = 'RELEASE INPUT - CLASS NOT ELECTED';

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
