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
    props: { drain: 0, itc: 0, wfL: false } },      // wfL: the waterflow alarm is latched at the panel (cleared by a panel reset)
  dryv: { name: 'Dry Pipe Valve', cat: 'system', cost: 14500, ports: 2, key: '2',
    desc: 'Pipe holds air; a differential clapper holds water back. Sprinkler opens, air drops, valve trips. For spaces that freeze.',
    props: { drain: 0, itc: 0, sdrain: 0, qod: false, tripped: false, airSet: 40, hiAir: 50, loAir: 30, airValve: 1, avc: 1, avcBy: 0, avcTamper: 0, wfL: false } },     // avc: an air maintenance device (AVC) is fitted, 0 = compressor direct; avcBy: its bypass is open; avcTamper: an optional tamper switch on the bypass (PRACTICE)
  prev: { name: 'Preaction Valve', cat: 'system', cost: 24000, ports: 2, key: '3',
    desc: 'Deluge valve + closed sprinklers + detection. Double interlock: detection (Fire 1 or the manual station) AND P (pipe pressure below the P trip setpoint) must both happen before water enters.',
    props: { drain: 0, itc: 0, sdrain: 0, tripped: false, trim: 'el-el', airSet: 40, hiAir: 50, loAir: 30, pTrip: 20, pLatch: false, mech: false, airValve: 1, avc: 1, avcBy: 0, avcTamper: 0, wfL: false, pull: false, sol: false, solOut: false, mrzL: false } },   // mrzL: Manual Release zone release latched; avc / avcBy / avcTamper: the AVC, its bypass and the optional bypass tamper switch; wfL: waterflow latched at the panel
  comp: { name: 'Air Compressor', cat: 'air', cost: 3400, ports: 0, key: 'A',
    desc: 'Riser-mounted compressor + air maintenance device. Must restore normal air pressure within 30 minutes.',
    props: { scfm: 5, on: false, runSec: 0, starts: 0, fault: false, cutOut: 0, maxPsi: 0, relief: 0 } },      // cutOut: psi, 0 = none; a sizing input only on a compressor direct to the system (DI.sizingP). maxPsi / relief: rated max discharge and relief setpoint, psi, 0 = not modeled / none: the ceiling of an open AVC bypass (DI.bypassTarget)
  n2: { name: 'Nitrogen Generator', cat: 'air', cost: 29000, ports: 0, key: 'N',
    desc: 'Membrane generator: 98%+ nitrogen as supervisory gas. Starves the oxygen corrosion that eats dry and preaction pipe.',
    props: { scfm: 2.5, on: false, runSec: 0, starts: 0, fault: false } },
  panel: { name: 'Releasing Panel (FACP)', cat: 'alarm', cost: 18000, ports: 0, key: 'P',
    desc: 'Listed releasing fire alarm panel. Wire detection, manual stations, switches and solenoids to it. Standby battery sized for the site’s standby basis.',
    props: { silenced: false, chan: [1, 1], ah: 26, iStby: 0.5, iAlarm: 2, chgFail: false, battDisc: false, chgA: 0, nacOn: 0, nacAwg: 14, nacFt: 200, nacN: 8, nacCd: 75, nacV: 0 } },     // chan: the two DACT channels, 1 = up (DACT path only). ah: battery pick; iStby / iAlarm: loads in A (ASSUMED, listing values); chgFail / battDisc: sandbox faults; chgA: charger amperes, 0 = matched to the battery (ASSUMED). nac*: the one notification circuit of the voltage-drop check (DI.nacCalc), default off: gauge, one-way length in ft, appliance count, candela, start voltage (0 = not given)
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
// Not in the table: FAAST and TITANUS (see README).
// VEA (Cycle 7, FA Lead) is a Fire 1-only model: one stage, picked from three discrete settings.
//   VESDA-E VEA, Fire 1 = 0.5 (High) / 1.23 (Enhanced) / 2.5 (Standard) %/ft (Xtralis Doc. 36348_03) [HB]. The Gamewell
//   sheet 9021-61037 prints Enhanced as 1.3 (4.0 %/m): a source mismatch, shown as a note beside the pick, never a
//   fourth choice and never merged with 1.23. Alert, Action and Fire 2 values are NOT FOUND: the model has no such
//   stage and nothing is printed for them. Default pick (Cycle 8, FA Lead): 0.5 in a telecom room where NFPA 76
//   applies (DI.n76Applies), 1.23 in every other room, whatever the site flag (DI.veaDefault). UL Product iQ stays
//   "not checked".
DI.ASD_SRC = '[HB, datasheet; UL Product iQ not checked]';
DI.ASD_STAGES = [['alert', 'Alert'], ['action', 'Action'], ['fire1', 'Fire 1'], ['fire2', 'Fire 2']];
DI.ASD_MODELS = {
  VEP: { label: 'VESDA-E VEP', models: 'VEP-A00-1P-UL, VEP-A00-P-UL, VEP-A10-P-UL', doc: 'Xtralis Doc. 36106_07, Part AD36106-007, July 2025, p. 2', src: 'xtralis.com/file/12015',
    range: { alert: [0.0015, 0.614], action: [0.0015, 0.614], fire1: [0.0030, 0.614], fire2: [0.0061, 6.575] } },
  VEU: { label: 'VESDA-E VEU', models: 'VEU-A00-UL, VEU-A10-UL', doc: 'Xtralis Doc. 36107_05, Part AD36107-005, November 2024, p. 2', src: 'xtralis.com/file/12017',
    range: { alert: [0.0003, 0.614], action: [0.0003, 0.614], fire1: [0.0003, 0.614], fire2: [0.0003, 6.575] } },
  VEA: { label: 'VESDA-E VEA', models: '', doc: 'Xtralis Doc. 36348_03', src: '', fire1Only: true, pick: [0.5, 1.23, 2.5], pickName: ['High', 'Enhanced', 'Standard'], primary: 1.23, oem: 1.3,
    oemNote: 'Source mismatch: the Gamewell sheet 9021-61037 prints the Enhanced setting as 1.3 %/ft (4.0 %/m). The Xtralis sheet (Doc. 36348_03) prints 1.23 and is the one used; 1.3 is not a setting here. [HB]',
    range: {} },
};
DI.ASD_DEFAULT = 'VEP';
// the source record of the VEA figures, kept for the manual's source note (the model itself is DI.ASD_MODELS.VEA)
DI.ASD_RECORDED = { VEA: { label: 'VESDA-E VEA', doc: 'Xtralis Doc. 36348_03', fire1: [0.5, 1.23, 2.5], primary: 1.23, oem: 1.3,
  note: 'VESDA-E VEA source record: Fire 1 settings 0.5 (High) / 1.23 (Enhanced) / 2.5 (Standard) %/ft (Xtralis Doc. 36348_03, primary). The Gamewell sheet 9021-61037 prints Enhanced as 1.3 (4.0 %/m), a source mismatch kept as a note only. Alert, Action and Fire 2 values are not published in the sheets pulled, so the model is Fire 1 only.' } };
// site setting W.cfg.asdModel: the key if it is in the table, else the default (an old save has no key)
DI.asdModel = (W) => { const k = W && W.cfg ? W.cfg.asdModel : undefined; return typeof k === 'string' && Object.prototype.hasOwnProperty.call(DI.ASD_MODELS, k) ? k : DI.ASD_DEFAULT; };
// the four [min, max] pairs of the site's model, in DI.detThr order (null = no listed range printed for that stage: VEA)
DI.asdRange = (W) => { const r = DI.ASD_MODELS[DI.asdModel(W)].range; return DI.ASD_STAGES.map(([k]) => r[k] || null); };
// VEA: a Fire 1-only detector. Its one threshold is W.cfg.detThr[2] where thresholds are stored, else the default pick.
// A stored value that is not one of the three settings is kept as it is and fails plan review (never clamped).
DI.isVea = (W) => DI.asdModel(W) === 'VEA';
// NFPA 76 applies by room (FA Lead, Cycle 8): only a room of type `tel` (Telecom / MMR) can be an NFPA 76 space, and a
// hall never is. The room's own `n76` (true / false) decides where it is set; absent, the room follows the site
// flag W.cfg.nfpa76Adopted, which is now only the default for telecom rooms. Which rooms count as NFPA 76 telecom
// is a judgment call: PRACTICE, NEEDS PE REVIEW.
DI.n76Applies = (W, room) => !!room && room.type === 'tel' && (room.n76 !== undefined ? room.n76 === true : !!(W && W.cfg && W.cfg.nfpa76Adopted));
DI.VEA_TEL = 0.5;                         // the VEA default in an NFPA 76 telecom room (the High setting)
DI.veaDefault = (W, room) => (DI.n76Applies(W, room) ? DI.VEA_TEL : DI.ASD_MODELS.VEA.primary);
// the site pick: the stored Fire 1 where thresholds are stored, else null
DI.veaSitePick = (W) => { const t = W && W.cfg ? W.cfg.detThr : null; return Array.isArray(t) && t.length === 4 && typeof t[2] === 'number' ? t[2] : null; };
// The Fire 1 a VEA detector in `room` reads: the room's own pick (room.f1, one of the three listed settings), else the
// site pick where one is stored, else the default by room (0.5 in an NFPA 76 telecom room, 1.23 anywhere else). VEA
// only: no other detector model has a per-room threshold. With no room given it is the site value.
DI.veaFire1At = (W, room) => { const s = DI.veaSitePick(W); return room && typeof room.f1 === 'number' ? room.f1 : s !== null ? s : DI.veaDefault(W, room); };
DI.veaFire1 = (W) => DI.veaFire1At(W, null);
// where that number comes from, for the inspector
DI.veaFire1Src = (W, room) => (room && typeof room.f1 === 'number' ? 'room pick' : DI.veaSitePick(W) !== null ? 'site pick' : DI.n76Applies(W, room) ? 'default in an NFPA 76 telecom room' : 'default');
DI.VEA_NA = 'not published for this model';

// Site / project settings with a default (W.cfg, saved with the world). All ASSUMED and tunable.
//   spotThr  spot detector alarm threshold, %/ft (example value)
//   fitPct   fittings allowance on pipe volume, %       trimGal  valve trim volume, gal per system valve
//   insurer  'none' | 'FM' (FM adds the 30 s delivery limit at any volume; NEEDS PE REVIEW)
DI.CFG_DEFAULT = { spotThr: 1.3, fitPct: 5, trimGal: 2, insurer: 'none' };
// Other settings read with a default when absent (an old save loads unchanged): dactHold (DI.dactHold, true), standby
// (DI.standbyKey, 'nfpa5'), panelGen (DI.panelGen, false), refillSeq (DI.refillSeq, gas.js, false).
// Cycle 8: ownerRefill (DI.ownerRefill, none) and nec (DI.nec, '2023').
DI.cfgNum = (W, key, lo) => { const v = W && W.cfg ? W.cfg[key] : undefined; return typeof v === 'number' && isFinite(v) && v >= (lo || 0) ? v : DI.CFG_DEFAULT[key]; };
DI.spotThr = (W) => { const v = DI.cfgNum(W, 'spotThr'); return v > 0 ? v : DI.CFG_DEFAULT.spotThr; };
DI.insurer = (W) => (W && W.cfg && W.cfg.insurer === 'FM' ? 'FM' : 'none');

// Signal classes (W.cfg.sigClass). Alert and Action are pre-alarm: supervisory by default, alarm if the
// engineer elects it. A latched P is a release input whose class has not been elected: OPEN by default,
// ALARM or TRBL if elected, and never SUPV (supervisory is blocked for it). All ASSUMED, NEEDS PE REVIEW.
// Fixed classes, no setting (DI.SIG_FIXED): Fire 1, Fire 2, manual station, Manual Release zone, release circuit,
// waterflow and a spot detector ALARM; low and high air, valve tamper, the optional AVC bypass tamper and a contract impairment SUPV; panel AC, low
// battery, loss of communication, a failed DACT channel, a failed DACT transmission, a charger failure, a
// disconnected battery and loss of supply air TRBL. Loss of supply air is TRBL
// [PRACTICE] (FA Lead, 2026-11-10 3:01 PM PT): a compressor or N2 power or controller fault is equipment trouble,
// its own signal; the pressure drop it causes is still reported by the separate low-air supervisory.
// The fire pump, tank and low-temperature signals keep the classes they always had (PRACTICE, not in the FA Lead's
// table: ASSUMED).
// The registry is the whole list: every signal the game raises has a key here or in DI.SIG_CLASS. DI.inClass is
// the one reader of a class. add(...) in DI.alarmStep takes the registry key, never a class, and the
// cause-and-effect matrix and the signal schedule (cause.js) read the same keys.
DI.SIG_FIXED = { fire1: 'ALARM', fire2: 'ALARM', manual: 'ALARM', mrz: 'ALARM', release: 'ALARM', waterflow: 'ALARM', lowAir: 'SUPV', highAir: 'SUPV', tamper: 'SUPV', avcTamper: 'SUPV',
  supplyAir: 'TRBL', acFail: 'TRBL', lowBatt: 'TRBL', lostComm: 'TRBL', impair: 'SUPV', dactFail: 'TRBL', chgFail: 'TRBL', battDisc: 'TRBL',
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
DI.AVC_TAMPER_TAG = 'PRACTICE (no code requirement verified for the air bypass)';
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
    avcTamper: { label: 'AVC bypass tamper switch (optional, per zone)', tag: DI.AVC_TAMPER_TAG + '; ' + stn },
    lostComm: { label: 'Loss of communication (panel dead, or a missed DACT test)', tag: ours },
    dactChan: { label: 'DACT channel failed', tag: ours },
    dactFail: { label: 'DACT transmission failed (after the maximum attempts)', tag: '[CODE: failure indication at the premises after the maximum attempts]' },
    chgFail: { label: 'Panel battery charger failure', tag: 'Class [CODE 10.6.10.6.1 to .2]; ' + stn },
    battDisc: { label: 'Panel battery disconnected', tag: '[PRACTICE, not code]; ' + stn },
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
// Standby battery (FA Lead, Cycle 6). The standby basis is a site setting (W.cfg.standby, read with DI.standbyKey):
// hours of standby plus minutes of alarm. Only a releasing panel exists in the game, so three rows are selectable;
// the other three are reference rows, shown in the standby dialog and the manual, never selectable and never modelled.
//   nfpa5    24 h + 5 min: the building-FACU rule (CODE, NFPA 72 10.6.7.2.2) used for a releasing panel [PRACTICE]. Default.
//   owner10  24 h + 10 min [OWNER]
//   fm90     90 h + 10 min [OWNER/insurer, FM DS 5-40 2.3.4, Sep 2007 edition, may not be current]: an election of
//            its own, never automatic on insurer = FM (the default 26 Ah battery fails it)
DI.STANDBY = [
  { key: 'nfpa5', label: 'Releasing panel, NFPA 72', hours: 24, alarmMin: 5, sel: true, tag: '[CODE NFPA 72 §10.6.7.2.2, the building-FACU rule, used for a releasing panel: PRACTICE]' },
  { key: 'owner10', label: 'Releasing panel, owner row', hours: 24, alarmMin: 10, sel: true, tag: '[OWNER]' },
  { key: 'fm90', label: 'Releasing panel, FM-insured', hours: 90, alarmMin: 10, sel: true, tag: '[OWNER/insurer, FM DS 5-40 §2.3.4, Sep 2007 edition, may not be current; releasing panel only]' },
  { key: 'facu', label: 'Building FACU', hours: 24, alarmMin: 5, sel: false, tag: '[CODE NFPA 72 §10.6.7.2.2]; reference only, not modelled' },
  { key: 'evacs', label: 'EVACS FACU', hours: 24, alarmMin: 15, sel: false, tag: '[CODE NFPA 72 §10.6.7.2]; reference only, not modelled' },
  { key: 'ess', label: 'Li-ion ESS panel', hours: 24, alarmMin: 120, sel: false, tag: '[NFPA 855 §4.8.3, upper bound; NFPA 855-2026 HOLD]; reference only, not modelled' },
];
DI.STANDBY_DEFAULT = 'nfpa5';
DI.standbyKey = (W) => { const k = W && W.cfg ? W.cfg.standby : undefined, r = DI.STANDBY.find((q) => q.key === k); return r && r.sel ? k : DI.STANDBY_DEFAULT; };
DI.standbyRow = (W) => DI.STANDBY.find((q) => q.key === DI.standbyKey(W));
// Sizing factor on the calculated capacity, by NFPA 72 edition (DI.ed72, never the NFPA 13 edition) [CODE]:
// 2019 x1.20 (10.6.7.2.1.1); 2022 and 2025 x1.25 (10.6.7.2.14).
DI.STBY_FACTOR = { 2019: 1.20, 2022: 1.25, 2025: 1.25 };
DI.STBY_THIN = 0.20;                      // PRACTICE screen, NEEDS PE REVIEW: a margin under 20 % is THIN
DI.BATT_AH = [7, 12, 18, 26, 33, 55, 65, 100];        // ASSUMED battery picks, Ah. The pick is free (SIMPLIFICATION)
// Charger (FA Lead, Cycle 7). No charger ampere rating is in NFPA 72 §10.6.10 in any edition: the picks are listing
// values, ASSUMED. chgA = 0 is "matched to the battery" (ASSUMED): no charger finding, recharge at H / 48.
// DI.chargerAh: the Ah a charger restores inside the 48 h recharge window = amperes x 48 (ASSUMED: no taper, no
// efficiency loss). A battery above that is a review FAIL: the 48 h never stretches for a bigger battery.
// Costs are ASSUMED and never read by a goal: the default panel (26 Ah, matched charger) costs what it always did.
DI.CHG_A = [0, 1, 2, 3, 4, 6, 10];
DI.BATT_COST_PER_AH = 12;
DI.CHG_COST = { 0: 0, 1: 150, 2: 220, 3: 290, 4: 360, 6: 480, 10: 700 };
DI.chargerAh = (panel) => { const a = panel && panel.p ? panel.p.chgA : 0; return a > 0 ? a * DI.RECHARGE_H : Infinity; };
DI.PANEL_LOADS = { ah: 26, iStby: 0.5, iAlarm: 2 };   // ASSUMED defaults (listing values): battery Ah, standby A, alarm A
// Generator-backed panel (site setting W.cfg.panelGen, optional, default battery only): batteries for 4 h and the
// generator covers 24 h. 2025 only (NFPA 72-2025 10.6.7.3.1(2)); under 2019 / 2022 the setting is ignored with a note.
DI.GEN_BATT_H = 4;
DI.GEN_RUN_S = 86400;                     // SIMPLIFICATION: the generator runs exactly 24 h, no fuel model
DI.GEN_START_S = 10;
DI.panelGen = (W) => !!(W && W.cfg && W.cfg.panelGen === true) && DI.ed72(W) === 2025;
// The standby calculation of one panel. Pure.
//   h      hours of standby the battery must carry (4 with the generator option)
//   req    Ah required = (standby A x h + alarm A x alarm min / 60) x factor
//   margin ah / req - 1;  below = the pick is under req (review FAIL);  thin = not below, margin under 20 % (warning)
DI.standbyCalc = function (W, panel) {
  const row = DI.standbyRow(W), ed = DI.ed72(W), factor = DI.STBY_FACTOR[ed] || 1.25, gen = DI.panelGen(W), q = (panel && panel.p) || {}, L = DI.PANEL_LOADS;
  const ah = q.ah > 0 ? q.ah : L.ah, iStby = q.iStby > 0 ? q.iStby : L.iStby, iAlarm = q.iAlarm > 0 ? q.iAlarm : L.iAlarm, h = gen ? DI.GEN_BATT_H : row.hours;
  const req = (iStby * h + iAlarm * row.alarmMin / 60) * factor, margin = ah / req - 1, below = ah < req;
  return { key: row.key, row, ed, factor, gen, h, ah, iStby, iAlarm, alarmMin: row.alarmMin, req, margin, below, thin: !below && margin < DI.STBY_THIN,
    basis: h + ' h + ' + row.alarmMin + ' min, x' + factor.toFixed(2) + (gen ? ', generator-backed' : '') };
};
// Hours of standby the fitted battery gives in the game: the basis hours, less in proportion where the pick is
// under the requirement. A larger battery is not credited with more hours (SIMPLIFICATION).
DI.panelH = function (W, panel) { const c = DI.standbyCalc(W, panel); return c.h * Math.min(1, c.ah / c.req); };
// Recharge [CODE NFPA 72 10.6.10.3.2, identical in 2019 / 2022 / 2025]: within 48 h after one full discharge. The charge
// rate is capacity / 48, or slower where the fitted charger is too small for the battery (DI.chargeRate).
DI.RECHARGE_H = 48;
// hours of standby restored per hour on AC: the slower of H / 48 and what the charger's amperes give (chgA / ah x H).
// A larger charger never charges faster than H / 48 (SIMPLIFICATION).
DI.chargeRate = function (panel, H) { const q = (panel && panel.p) || {}, ah = q.ah > 0 ? q.ah : DI.PANEL_LOADS.ah; return q.chgA > 0 ? Math.min(H / DI.RECHARGE_H, q.chgA / ah * H) : H / DI.RECHARGE_H; };
// ---------- NAC voltage drop at the last appliance (FA Lead, Cycle 8): a plan-review check only. One DC notification
// appliance circuit per panel, Class B, end-line-loaded (every appliance taken at the far end: the conservative screen),
// default OFF. It raises no signal, has no matrix row, and is not an input of detection, of the pressure latch, of
// the valve release, of either hook or of the standby battery calculation (the panel's alarm load stays a listing
// pick: SIMPLIFICATION). Point-to-point, Class A, module voltage adjustment and sync-module loss are not modelled.
//   DI.NAC_OHM    ohm per 1000 ft, NFPA 70-2023 Ch. 9 Table 8, 75 C, uncoated stranded copper [CODE NEC 2023]. NEC 2026
//                 Table 8 is on hold: on a NEC 2026 site (W.cfg.nec) the 2023 ohms are shown as ASSUMED / VERIFY,
//                 never as 2026 code.
//   DI.NAC_VMIN   16 V, the appliance minimum input voltage (A.18.3.7 [HB]; ASSUMED, confirm on the listing)
//   DI.NAC_V_END  20.4 V, the start voltage when none is given: end of discharge on a 24 V system (ASSUMED)
//   DI.NAC_THIN   a margin under 20 percent above the minimum is THIN, a warning (company rule: PRACTICE)
//   DI.NAC_CD     appliance current in A at the minimum voltage, per candela: ASSUMED listing values, round numbers
//                 that are NOT from a listing
//   DI.NAC_VSTART start voltages offered: 0 = not given (ASSUMED 20.4 V); the others are panel or module start
//                 terminal voltages (CUSTV / CMSTV) the player says the data sheet gives (ASSUMED picks)
// Basis by NFPA 72 edition: DI.ref72(W).nacVd ([CODE] in 2025 only; the same method is PRACTICE on 2019 and 2022) and
// .nacDoc (NAC voltage-drop calculations are a required documentation item, all three editions [CODE]).
DI.NAC_OHM = { 18: 7.95, 16: 4.99, 14: 3.14, 12: 1.98 };
DI.NAC_AWG = [18, 16, 14, 12];
DI.NAC_VMIN = 16; DI.NAC_V_END = 20.4; DI.NAC_THIN = 0.20;
DI.NAC_CD = { 15: 0.10, 30: 0.15, 75: 0.20, 95: 0.25 };
DI.NAC_CDS = [15, 30, 75, 95];
DI.NAC_VSTART = [0, 21.0, 22.0, 23.0, 24.0];
DI.NAC_N_MAX = 40; DI.NAC_FT_MIN = 10; DI.NAC_FT_MAX = 1000; DI.NAC_FT_STEP = 10;
DI.NAC_TITLE = 'Notification circuit (NAC), Class B, end-line-loaded';
DI.NAC_WIRE = 'NFPA 70-2023 Ch. 9 Table 8, 75 C, uncoated stranded copper [CODE NEC 2023]';
DI.NAC_WIRE_2026 = '2023 Table 8 ohms: ASSUMED / VERIFY (NEC 2026 Table 8 is on hold), never 2026 code';
DI.NAC_CA_HOLD = 'NAC voltage drop is on hold on a Canadian build: CAN/ULC-S524 and CEC Section 32 are not held. CA-2019 is the NFPA 72-2019 label only.';
// NEC edition of the site (W.cfg.nec: stored only when '2026'; an old save has no key and reads '2023')
DI.NEC = ['2023', '2026'];
DI.nec = (W) => (W && W.cfg && W.cfg.nec === '2026' ? '2026' : '2023');
// The calculation. Pure. Both conductors are counted through the length (out and back): the Table 8 value itself
// is used as printed (NFPA 72-2025 §18.3.7.3).
//   on            the check is switched on for this panel (off: nothing is evaluated and no finding is raised)
//   hold          a Canadian build: not evaluated
//   iEach, iTot   A per appliance at the minimum voltage, and for the circuit
//   R             ohm of the circuit; drop = iTot x R; vEol = vStart - drop, the voltage at the last appliance
//   margin        (vEol - 16) / 16;  below = vEol under 16 V (FAIL);  thin = not below, margin under 20 % (warning)
//   startAssumed  no start voltage given: 20.4 V is used and the verdict is a warning at best
//   maxFt         the longest one-way length that still passes with these picks
//   sev           'fail' | 'warn' | 'info': the worst of the three
DI.nacCalc = function (W, panel) {
  const q = (panel && panel.p) || {}, hold = DI.setJuris(W).country !== 'US', R72 = DI.ref72(W);
  const awg = DI.NAC_OHM[q.nacAwg] ? q.nacAwg : 14, ft = q.nacFt > 0 ? q.nacFt : 200, n = q.nacN > 0 ? q.nacN : 8, cd = DI.NAC_CD[q.nacCd] ? q.nacCd : 75;
  const ohm = DI.NAC_OHM[awg], perFt = 2 * ohm / 1000, iEach = DI.NAC_CD[cd], iTot = n * iEach, R = ft * perFt;
  const startAssumed = !(q.nacV > 0), vStart = startAssumed ? DI.NAC_V_END : q.nacV, drop = iTot * R, vEol = vStart - drop;
  const margin = (vEol - DI.NAC_VMIN) / DI.NAC_VMIN, below = vEol < DI.NAC_VMIN - 1e-9, thin = !below && margin < DI.NAC_THIN - 1e-12, maxFt = (vStart - DI.NAC_VMIN) / (iTot * perFt);
  return { on: q.nacOn === 1, hold, awg, ft, n, cd, ohm, iEach, iTot, R, vStart, startAssumed, drop, vEol, margin, below, thin, maxFt, vMin: DI.NAC_VMIN,
    sev: below ? 'fail' : thin || startAssumed ? 'warn' : 'info', nec: DI.nec(W), wire: DI.nec(W) === '2026' ? DI.NAC_WIRE_2026 : DI.NAC_WIRE, basis: R72.nacVd, doc: R72.nacDoc };
};
// the longest passing one-way length as it is shown: rounded down, so the number shown does pass
DI.nacMaxFt = (c) => (isFinite(c.maxFt) && c.maxFt > 0 ? (Math.floor(c.maxFt * 10 + 1e-6) / 10).toFixed(1) : '0.0');
// The verdict as words: which of the three applied.
DI.nacVerdict = function (c) {
  const out = [];
  if (c.below) out.push('FAIL: below the appliance listed minimum of ' + c.vMin + ' V');
  if (c.thin) out.push('THIN: margin ' + DI.fmt(c.margin * 100, 1) + ' %, under ' + DI.NAC_THIN * 100 + ' % above the ' + c.vMin + ' V minimum (PRACTICE, NEEDS PE REVIEW)');
  if (c.startAssumed) out.push('the start voltage is ASSUMED (' + DI.NAC_V_END + ' V, end of discharge): a warning, not a failure');
  return out.length ? out.join('; ') : 'passes: margin ' + DI.fmt(c.margin * 100, 1) + ' % above the ' + c.vMin + ' V minimum';
};
// The plan-review finding of one panel: null (off), or { sev, text, ref }. One finding per panel.
DI.nacFinding = function (W, panel) {
  const c = DI.nacCalc(W, panel); if (!c.on) return null;
  const who = 'Panel #' + panel.id + ' NAC (Class B, end-line-loaded): ';
  if (c.hold) return { sev: 'info', text: who + DI.NAC_CA_HOLD, ref: 'Not evaluated (on hold)' };
  const text = who + c.n + ' x ' + c.cd + ' cd at ' + c.iEach.toFixed(2) + ' A = ' + c.iTot.toFixed(2) + ' A, ' + c.ft + ' ft one-way of ' + c.awg + ' AWG (' + c.ohm + ' ohm per 1000 ft, both conductors counted: ' + c.R.toFixed(3) + ' ohm), start ' + c.vStart.toFixed(1) + ' V' + (c.startAssumed ? ' (ASSUMED)' : ' (given)') +
    ': drop ' + c.drop.toFixed(2) + ' V, ' + c.vEol.toFixed(2) + ' V at the last appliance. ' + DI.nacVerdict(c).replace(/^./, (x) => x.toUpperCase()) + '. ' +
    (c.below ? 'Shorten the run, use a larger wire or split the circuit: the longest one-way length that passes is ' + DI.nacMaxFt(c) + ' ft. ' : '') +
    (c.startAssumed ? 'Give the start terminal voltage of the panel or module from its data sheet. ' : '') +
    (c.sev === 'info' ? 'This line is the NAC voltage drop calculation of the documentation list (' + c.doc + ' [CODE]). ' : '') +
    'Appliance current and the ' + c.vMin + ' V minimum are ASSUMED listing values: confirm on the listing. Wire: ' + c.wire + '.';
  return { sev: c.sev, text, ref: c.basis + '; ' + c.doc };
};

// Low battery: the code states no low-battery threshold (NOT FOUND in 2019, 2022 or 2025). It requires the voltage to be
// monitored and a trouble on failure. The trouble here is the listing's low-voltage setpoint: 20.4 V on a 24 V system,
// ASSUMED [PRACTICE]. Voltage is a straight line from the end of discharge (19.8 V) to float (27.0 V), both ASSUMED
// (SIMPLIFICATION), so 20.4 V is 1/12 of the capacity left, whatever the capacity.
DI.PANEL_STANDBY_H = 24;                  // the default basis (nfpa5) in hours
DI.LOWBATT_V = 20.4; DI.BATT_V_END = 19.8; DI.BATT_V_FLOAT = 27.0;
DI.PANEL_LOWBATT_FRAC = 1 / 12;           // = (20.4 - 19.8) / (27.0 - 19.8)
DI.battV = (battH, H) => DI.BATT_V_END + (DI.BATT_V_FLOAT - DI.BATT_V_END) * DI.clamp(H > 0 ? battH / H : 0, 0, 1);
DI.lowBattH = (H) => (H > 0 ? H : DI.PANEL_STANDBY_H) * DI.PANEL_LOWBATT_FRAC;      // hours of standby left at the setpoint
DI.LOWBATT_NOTE = 'the listed low-battery voltage setpoint, ' + DI.LOWBATT_V + ' V on a 24 V system (OWNER/listing, ASSUMED, NEEDS PE REVIEW)';
// Trouble signals appear at the panel within 200 s. The game shows them at once, which is inside the ceiling.
DI.TROUBLE_PANEL_S = 200;
// A silenced trouble sounds again by itself every 24 h or less [CODE, DI.ref72(W).silenceTrouble]. The game uses
// exactly 24 h (ASSUMED).
DI.TROUBLE_RESOUND_S = 86400;
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
// DACT transmission attempts [CODE]: 5 to 10 attempts, each 90 s or less; after the maximum, a failure indication at
// the premises (DI.ref72(W).dactTry). The game makes 10 attempts (the count is ASSUMED inside the CODE bound) of 90 s,
// 900 s in all (the annex figure for all attempts in 2022 / 2025). DI.DACT_SEND_S: seconds between two sends when a
// channel is back, one handshake each (ASSUMED).
DI.DACT_TRIES = 10; DI.DACT_ATTEMPT_S = 90; DI.DACT_TOTAL_S = DI.DACT_TRIES * DI.DACT_ATTEMPT_S; DI.DACT_SEND_S = 10;
// Hold and send after a communications failure (site setting W.cfg.dactHold, default ON, stored only when false).
// The code is silent on holding (NOT FOUND in 2019, 2022 or 2025): PRACTICE, manufacturer behaviour, NEEDS PE REVIEW.
DI.dactHold = (W) => !(W && W.cfg && W.cfg.dactHold === false);
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
// AVC (air maintenance device) and its bypass. With the bypass open the AVC does not regulate and the zone drifts to
// what the compressor can deliver (DI.bypassTarget, FP Lead, Cycle 7): its cut-out where one is set, else its rated
// max discharge or its relief setpoint, whichever is lower. Where the compressor is not modeled (no maxPsi) the
// figure below is used: 60 psi, ASSUMED. Never the zone's 40 psi test pressure.
DI.AVC_BYPASS_PSI = 60;
DI.avcFitted = (v) => v.p.avc !== 0;                       // an old save has no prop: fitted
DI.avcBypassed = (v) => DI.avcFitted(v) && !!v.p.avcBy;   // fitted, and not regulating
// the optional tamper switch on the bypass reads "open": fitted (v.p.avcTamper === 1) and the bypass is open
DI.bypassTamper = (v) => v.p.avcTamper === 1 && DI.avcBypassed(v);
DI.AVC_NOTE = 'The bypass is normally closed. Leaving it open is a classic way to get high air or over-pressure.';
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
DI.COMP_MAXPSI = [0, 60, 100, 125, 175];   // ASSUMED choices for the rated max discharge, psi (0 = not modeled: DI.AVC_BYPASS_PSI is used)
DI.COMP_RELIEF = [0, 60, 75, 100, 125];    // ASSUMED choices for the relief valve setpoint, psi (0 = none). Two plan-review warnings read it (DI.compWarnings, gas.js; FP Lead, Cycle 8, PRACTICE)
// Owner or insurer refill target (site setting W.cfg.ownerRefill, minutes; absent = none; FP Lead, Cycle 8). Judged the
// way the code check is: the largest zone alone, from 0 psig (DI.airSizing(...).tAlone; that method is ASSUMED,
// "unless the owner defines it differently"). Over the target and inside the code limit it is a plan-review WARNING
// tagged owner/insurer criterion, never a code failure (the warning tier is PRACTICE). The picks are ASSUMED.
DI.OWNER_REFILL = [0, 10, 15, 20, 25];
DI.ownerRefill = (W) => { const m = W && W.cfg ? W.cfg.ownerRefill : undefined; return typeof m === 'number' && isFinite(m) && m > 0 ? m : 0; };
DI.N2_SCFM = [1, 2.5, 5];
DI.SPK_K = 5.6;                     // standard spray sprinkler K-factor (gpm/psi^0.5)
DI.TAMPER_SW_COST = 600;            // ASSUMED: a supervisory (tamper) switch fitted to a control valve that has none
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
  // a control valve with no supervisory switch fitted (sw === 0) costs the switch less (ASSUMED)
  if (type === 'gate' && props && props.sw === 0) return d.cost - DI.TAMPER_SW_COST;
  // panel: the battery by Ah against the default pick, plus the charger by its amperes (both ASSUMED)
  if (type === 'panel' && props) return d.cost + Math.round(((props.ah > 0 ? props.ah : DI.PANEL_LOADS.ah) - DI.PANEL_LOADS.ah) * DI.BATT_COST_PER_AH) + (DI.CHG_COST[props.chgA] || 0);
  return d.cost;
};

// Fire pump curve (NFPA 20 shape): churn 120% of rated head, 100% at rated flow, 65% at 150% flow.
// H = Hr * (1.2 - 0.2 * (Q/Qr)^2.495) * speed^2
DI.PUMP_EXP = Math.log(2.75) / Math.log(1.5);
DI.pumpHead = (p, q, spd) => {
  const s = spd === undefined ? 1 : spd;
  return p.psi * s * s * (1.2 - 0.2 * Math.pow(Math.max(q, 0) / (p.gpm * Math.max(s, 0.05)), DI.PUMP_EXP));
};
