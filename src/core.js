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

// Pipe table. id = inside diameter (in), gal = gallons per foot, cost = $ per 10-ft tile installed.
// Sch 40 through 2 in., Sch 10 above (typical grooved/welded sprinkler pipe).
DI.PIPES = [
  { n: '1"', id: 1.049, cost: 90 },
  { n: '1¼"', id: 1.38, cost: 110 },
  { n: '1½"', id: 1.61, cost: 130 },
  { n: '2"', id: 2.067, cost: 170 },
  { n: '2½"', id: 2.635, cost: 230 },
  { n: '3"', id: 3.26, cost: 290 },
  { n: '4"', id: 4.26, cost: 400 },
  { n: '6"', id: 6.357, cost: 640 },
  { n: '8"', id: 8.249, cost: 900 },
  { n: '10"', id: 10.37, cost: 1250 },
  { n: '12"', id: 12.39, cost: 1600 },
];
DI.PIPES.forEach((p) => { p.gal = 0.0408 * p.id * p.id; });   // gal/ft = 0.0408 d^2

// Hazen-Williams: friction loss in psi per foot at 1 gpm (multiply by Q^1.85).
// p = 4.52 Q^1.85 / (C^1.85 d^4.87)   (NFPA 13)
DI.hw = (C, d) => 4.52 / (Math.pow(C, 1.85) * Math.pow(d, 4.87));

// Hazard table: required density (gpm/ft2), design area (ft2), hose (gpm), duration (min),
// fire growth alpha (kW/s2). Single-point density/area values (NFPA 13-2025 Ch. 19).
DI.HAZ = {
  LH: { name: 'Light Hazard', dens: 0.10, area: 1500, hose: 100, dur: 30, alpha: 0.0029, cap: 1500 },
  OH1: { name: 'Ordinary Hazard Group 1', dens: 0.15, area: 1500, hose: 250, dur: 60, alpha: 0.0117, cap: 4000 },
  OH2: { name: 'Ordinary Hazard Group 2', dens: 0.20, area: 1500, hose: 250, dur: 60, alpha: 0.0117, cap: 6000 },
  EH1: { name: 'Extra Hazard Group 1', dens: 0.30, area: 2500, hose: 500, dur: 90, alpha: 0.0469, cap: 12000 },
};

// Room types. val = $ of contents per tile, wetDmg = fraction of val ruined when soaked,
// smokeDmg = sensitivity to smoke, cond = conditioned (heated) space.
DI.ROOMS = {
  office: { name: 'Office / Admin', haz: 'LH', val: 6e3, wetDmg: 0.25, smokeDmg: 0.1, cond: true, col: '#263445', ceil: 10 },
  hall: { name: 'Data Hall', haz: 'OH1', val: 9e5, wetDmg: 0.8, smokeDmg: 1.0, cond: true, col: '#1d2f3a', ceil: 16 },
  elec: { name: 'Electrical / UPS Room', haz: 'OH1', val: 4e5, wetDmg: 0.9, smokeDmg: 0.6, cond: true, col: '#2f2a3d', ceil: 14 },
  batt: { name: 'Battery Room', haz: 'OH2', val: 3e5, wetDmg: 0.5, smokeDmg: 0.5, cond: true, col: '#3a2a2f', ceil: 14 },
  dock: { name: 'Loading Dock', haz: 'OH2', val: 1.5e4, wetDmg: 0.1, smokeDmg: 0.05, cond: false, col: '#2e3328', ceil: 18 },
  stor: { name: 'Storage / Staging', haz: 'OH2', val: 3e4, wetDmg: 0.3, smokeDmg: 0.1, cond: true, col: '#33301f', ceil: 16 },
  riser: { name: 'Riser Room', haz: 'OH1', val: 2e3, wetDmg: 0.02, smokeDmg: 0.02, cond: true, col: '#22303a', ceil: 12 },
  pump: { name: 'Fire Pump House', haz: 'OH1', val: 4e3, wetDmg: 0.02, smokeDmg: 0.02, cond: true, col: '#242f2c', ceil: 14 },
  corr: { name: 'Valve Gallery', haz: 'OH1', val: 2e3, wetDmg: 0.02, smokeDmg: 0.02, cond: true, col: '#1b2631', ceil: 12 },
  gen: { name: 'Generator Yard', haz: 'EH1', val: 8e4, wetDmg: 0.05, smokeDmg: 0.02, cond: false, col: '#30291f', ceil: 20, open: true },
};
