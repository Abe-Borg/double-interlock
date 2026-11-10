// DOUBLE INTERLOCK - core namespace, constants, helpers.
// Units everywhere: psi (gauge), gpm, gallons, feet, seconds. One map tile = 10 ft.
var DI = globalThis.DI || (globalThis.DI = {});

DI.TILE_FT = 10;
DI.ATM = 14.7;            // psia
DI.PSI_FT = 0.433;        // psi per ft of water column
DI.DX = [0, 1, 0, -1];    // dir 0=N 1=E 2=S 3=W
DI.DY = [-1, 0, 1, 0];
DI.OPP = [2, 3, 0, 1];

DI.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
DI.lerp = (a, b, t) => a + (b - a) * t;
DI.fmt = (v, d = 0) => (isFinite(v) ? v.toFixed(d) : '--');
DI.money = (v) => (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US');
DI.clock = (s) => {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return (d ? 'D' + (d + 1) + ' ' : '') + p(h) + ':' + p(m) + ':' + p(x);
};
DI.dur = (s) => (s < 90 ? DI.fmt(s, s < 10 ? 1 : 0) + ' s' : s < 5400 ? DI.fmt(s / 60, 1) + ' min' : DI.fmt(s / 3600, 1) + ' h');

DI.rng = function (seed) {           // mulberry32
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// tiny event bus
DI.bus = {
  h: {},
  on(ev, fn) { (this.h[ev] || (this.h[ev] = [])).push(fn); },
  emit(ev, a, b, c) { const l = this.h[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c); },
};

// Pipe table, split by schedule. id40 / id10 = inside diameter (in) of Schedule 40 / Schedule 10 steel pipe
// (steel pipe dimensions table in the NFPA 13 annex / ASME B36.10M), cost = $ per 10-ft tile installed.
// ASSUMED: cost is the same for both schedules of a size.
// 12 in. Sch 10 is OD 12.750, wall 0.180, ID 12.390 (FP Lead): above-ground headers only. Underground and
// yard pipe would be its own material (ductile iron, PVC / HDPE), still C = 100, and is not modelled.
DI.PIPES = [
  { n: '1"', id40: 1.049, id10: 1.097, cost: 90 },
  { n: '1¼"', id40: 1.38, id10: 1.442, cost: 110 },
  { n: '1½"', id40: 1.61, id10: 1.682, cost: 130 },
  { n: '2"', id40: 2.067, id10: 2.157, cost: 170 },
  { n: '2½"', id40: 2.469, id10: 2.635, cost: 230 },
  { n: '3"', id40: 3.068, id10: 3.26, cost: 290 },
  { n: '4"', id40: 4.026, id10: 4.26, cost: 400 },
  { n: '6"', id40: 6.065, id10: 6.357, cost: 640 },
  { n: '8"', id40: 7.981, id10: 8.249, cost: 900 },
  { n: '10"', id40: 10.02, id10: 10.37, cost: 1250 },
  { n: '12"', id40: 11.938, id10: 12.39, cost: 1600 },
];
// Pipe size cut (project setting W.cfg.pipeCut, ASSUMED default 2 in.): the largest size on threaded Sch 40.
// That size and smaller are threaded Sch 40; every larger size is roll-grooved Sch 10, main or branch alike.
DI.PIPE_CUT_DEFAULT = 3;               // index into DI.PIPES: 2 in.
DI.PIPE_CUTS = [2, 3, 4, 5, 6];        // sizes the Site menu offers as the cut: 1½ in. to 4 in.
DI.PIPES.forEach((p, i) => {
  const mk = (id, sch) => ({ n: p.n, id, gal: 0.0408 * id * id, cost: p.cost, sch });   // gal/ft = 0.0408 d^2
  p.s40 = mk(p.id40, 40); p.s10 = mk(p.id10, 10);
  const d = i <= DI.PIPE_CUT_DEFAULT ? p.s40 : p.s10; p.id = d.id; p.gal = d.gal;       // default-cut values
});
DI.pipeCut = (W) => { const c = W && W.cfg ? W.cfg.pipeCut : undefined; return DI.PIPE_CUTS.includes(c) ? c : DI.PIPE_CUT_DEFAULT; };
// schedule of size index i for a given cut
DI.pipeSch = (cut, i) => (i <= cut ? 40 : 10);
// the pipe on tile k: { n, id, gal, cost, sch }. Every engine and UI reader goes through this.
DI.pipeAt = (W, k) => { const i = W.pd[k] - 1, p = DI.PIPES[i]; return DI.pipeSch(DI.pipeCut(W), i) === 40 ? p.s40 : p.s10; };

// Hazen-Williams: friction loss in psi per foot at 1 gpm (multiply by Q^1.85).
// p = 4.52 Q^1.85 / (C^1.85 d^4.87)   (NFPA 13)
DI.hw = (C, d) => 4.52 / (Math.pow(C, 1.85) * Math.pow(d, 4.87));
// Company rule: C = 100 for all sprinkler pipe: wet, dry, preaction, interior, yard and underground.
// Nitrogen earns no C-factor credit. Any other C shown in the UI is a comparison label only.
DI.HW_C = 100;
DI.pipeC = () => DI.HW_C;

// Hazard table: required density (gpm/ft2), design area (ft2), hose (gpm), duration (min),
// fire growth alpha (kW/s2). Single-point density/area values (NFPA 13 Ch. 19; the enforced edition
// is a site setting, see juris.js).
DI.HAZ = {
  LH: { name: 'Light Hazard', dens: 0.10, area: 1500, hose: 100, dur: 30, alpha: 0.0029, cap: 1500 },
  OH1: { name: 'Ordinary Hazard Group 1', dens: 0.15, area: 1500, hose: 250, dur: 60, alpha: 0.0117, cap: 4000 },
  OH2: { name: 'Ordinary Hazard Group 2', dens: 0.20, area: 1500, hose: 250, dur: 60, alpha: 0.0117, cap: 6000 },
  EH1: { name: 'Extra Hazard Group 1', dens: 0.30, area: 2500, hose: 500, dur: 90, alpha: 0.0469, cap: 12000 },
};

// Room types. val = $ of contents per tile, wetDmg = fraction of val ruined when soaked,
// smokeDmg = sensitivity to smoke, cond = conditioned (heated) space, spotRelease = one listed spot
// smoke detector in alarm is the detection leg of a preaction release (support rooms only; white space
// needs aspirating detection, and the battery room stays alarm-only until the Li-ion cycle).
DI.ROOMS = {
  office: { name: 'Office / Admin', haz: 'LH', val: 6e3, wetDmg: 0.25, smokeDmg: 0.1, cond: true, col: '#263445', ceil: 10 },
  hall: { name: 'Data Hall', haz: 'OH1', val: 9e5, wetDmg: 0.8, smokeDmg: 1.0, cond: true, col: '#1d2f3a', ceil: 16 },
  elec: { name: 'Electrical / UPS Room', haz: 'OH1', val: 4e5, wetDmg: 0.9, smokeDmg: 0.6, cond: true, col: '#2f2a3d', ceil: 14, spotRelease: true },
  batt: { name: 'Battery Room', haz: 'OH2', val: 3e5, wetDmg: 0.5, smokeDmg: 0.5, cond: true, col: '#3a2a2f', ceil: 14 },
  dock: { name: 'Loading Dock', haz: 'OH2', val: 1.5e4, wetDmg: 0.1, smokeDmg: 0.05, cond: false, col: '#2e3328', ceil: 18 },
  stor: { name: 'Storage / Staging', haz: 'OH2', val: 3e4, wetDmg: 0.3, smokeDmg: 0.1, cond: true, col: '#33301f', ceil: 16 },
  riser: { name: 'Riser Room', haz: 'OH1', val: 2e3, wetDmg: 0.02, smokeDmg: 0.02, cond: true, col: '#22303a', ceil: 12 },
  pump: { name: 'Fire Pump House', haz: 'OH1', val: 4e3, wetDmg: 0.02, smokeDmg: 0.02, cond: true, col: '#242f2c', ceil: 14 },
  corr: { name: 'Valve Gallery', haz: 'OH1', val: 2e3, wetDmg: 0.02, smokeDmg: 0.02, cond: true, col: '#1b2631', ceil: 12 },
  gen: { name: 'Generator Yard', haz: 'EH1', val: 8e4, wetDmg: 0.05, smokeDmg: 0.02, cond: false, col: '#30291f', ceil: 20, open: true },
};
