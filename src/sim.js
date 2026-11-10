// Simulation core: owns dynamic state, steps hydraulics, pump controllers and the tank.
// Order each tick: fire -> alarm/release -> valve trip logic -> controllers -> solve -> accounting.
var DI = globalThis.DI || (globalThis.DI = {});

DI.Sim = class {
  constructor(W) {
    const n = W.w * W.h;
    this.W = W; this.t = 0; this.ver = -1; this.dirty = true;
    this.ss = new Map();                    // per system-valve state
    this.pT = new Float32Array(n);          // pressure memory per tile (psi)
    this.pP = new Map();                    // pressure memory per part [in, out]
    this.leaks = [];                        // { k, K, air } pipe breaks / pinholes
    this.sig = new Map();                   // active signals
    this.log = [];
    this.fd = { called: -1, onScene: -1 };  // fire department
    this.stats = { fireLoss: 0, waterLoss: 0, smokeLoss: 0, gallons: 0 };
    this.procs = []; this.results = [];     // running test procedures / finished test reports
    this.genT = -1;                         // standby generator: time utility was lost
    DI.fireInit(this);
    this.sync();
  }
  say(text, cls) { this.log.push({ t: this.t, text, cls: cls || '' }); if (this.log.length > 200) this.log.shift(); DI.bus.emit('log', text, cls); }
  // re-discover systems after any map edit; keep state of valves that still exist
  sync() {
    const W = this.W;
    this.sysd = DI.findSystems(W);
    for (const [id, inf] of this.sysd.info) {
      let s = this.ss.get(id);
      if (!s) {
        s = { state: inf.type === 'wetv' ? 'filling' : 'dry', wat: 0, G: DI.ATM * Math.max(inf.vol, 1), o2g: 0.209 * DI.ATM * Math.max(inf.vol, 1),
          P: 0, set: false, tripT: -1, openT: -1, waterT: -1, fillT0: -1, fillTime: -1, ref: 0, corr: 0, moist: 0.1, vol: inf.vol, flowT: 0, alarm: false, lowAir: false };
        this.ss.set(id, s);
      } else if (Math.abs(s.vol - inf.vol) > 0.01) {       // piping changed: new pipe arrives at the system's present condition
        if (s.state === 'wet') s.wat = inf.vol;
        else {
          const x = s.G > 0 ? s.o2g / s.G : 0.209; s.wat = Math.min(s.wat, inf.vol);
          s.G = (Math.max(s.P, 0) + DI.ATM) * Math.max(inf.vol - s.wat, 0.02 * inf.vol, 1e-3); s.o2g = x * s.G;
        }
        s.vol = inf.vol;
      }
    }
    for (const id of [...this.ss.keys()]) if (!this.sysd.info.has(id)) this.ss.delete(id);
    this.leaks = this.leaks.filter((l) => W.pd[l.k]);
    // NFPA 20: the pressure sensing line connects downstream of the pump discharge check valve.
    // If the player put a check valve on the pipe run leaving a pump, sense on its outlet.
    for (const p of W.parts.values()) {
      if (p.type !== 'epump' && p.type !== 'dpump' && p.type !== 'jockey') continue;
      p.p.sense = 0; let d = W.ports(p).o, x = p.x, y = p.y;
      for (let i = 0; i < 12; i++) {
        if (!W.linked(x, y, d)) break;
        x += DI.DX[d]; y += DI.DY[d];
        const o = W.at(x, y);
        if (o) { if (o.type === 'check' && W.ports(o).i === DI.OPP[d]) p.p.sense = o.id; break; }
        let nd = -1, cnt = 0;
        for (let e = 0; e < 4; e++) if (e !== DI.OPP[d] && W.linked(x, y, e)) { nd = e; cnt++; }
        if (cnt !== 1) break; d = nd;
      }
    }
    this.ver = W.ver; this.dirty = true;
  }
  powered(p) {         // is electric power available to this part right now?
    if (this.W.power) return true;
    return !!(p && p.p.emerg) && this.genT >= 0 && this.t - this.genT > 10;
  }
  step(dt) {
    const W = this.W;
    if (this.ver !== W.ver) this.sync();
    this.t += dt;
    if (!W.power && this.genT < 0) this.genT = this.t; else if (W.power) this.genT = -1;
    DI.fireStep(this, dt);
    DI.alarmStep(this, dt);
    DI.gasPre(this, dt);
    if (this.coarse) return;          // long fast-forward: hydraulics are at rest, only gas / weather / corrosion evolve
    this.controllers(dt);
    if (this.dirty || !this.G) { this.G = DI.buildGraph(W, this); this.dirty = false; }
    else DI.updateLinks(W, this, this.G);
    DI.solve(this.G.net, dt);
    DI.readback(W, this, this.G);
    this.account(dt);
    DI.gasPost(this, dt);
    DI.fireWater(this, dt);
    if (this.procs.length) DI.testStep(this, dt);
  }
  controllers(dt) {
    const W = this.W;
    for (const p of W.parts.values()) {
      const q = p.p, mem = this.pP.get(q.sense || p.id), ps = mem ? mem[1] : 0;
      if (p.type === 'epump' || p.type === 'dpump') {
        const diesel = p.type === 'dpump';
        if (q.mode === 'auto' && !q.on && ps < q.start && this.t > 2) { q.on = true; q.crank = 0; q.failed = false; this.lastAuto = this.t; q.autoStarts = (q.autoStarts || 0) + 1; this.say((diesel ? 'Diesel' : 'Electric') + ' fire pump start demand at ' + DI.fmt(ps) + ' psi', 'warn'); }
        if (q.mode === 'hand' && !q.on) { q.on = true; q.crank = 0; q.failed = false; }
        if (q.mode === 'off' && q.on) q.on = false;
        let run = false;
        if (q.on) {
          if (diesel) {
            if (q.fuel <= 0) { if (!q.failed) this.say('Diesel pump out of fuel', 'bad'); q.failed = true; }
            else if (q.spd > 0.05) run = true;
            else if (q.batt < 0.25) { if (!q.failed) this.say('Diesel pump FAILED TO START: batteries dead', 'bad'); q.failed = true; }
            else { q.crank += dt; if (q.crank > 6) run = true; }
          } else run = this.powered(p);
        }
        const rate = diesel ? 0.25 : 0.7;
        q.spd = DI.clamp(q.spd + (run ? rate : -0.5) * dt, 0, 1);
        if (q.spd > 0.5) { q.ranFor += dt; q.lastRun = this.t; if (diesel) q.fuel = Math.max(0, q.fuel - (DI.pumpHp(q) * 0.125 / 3600 / DI.fuelCap(q)) * dt); }
        else if (!q.on) q.ranFor = 0;
        if (q.on && q.mode === 'auto' && q.autoStop && q.ranFor > 600 && ps > q.start + 15) { q.on = false; this.say('Fire pump auto-stopped after minimum run', ''); }
      } else if (p.type === 'jockey') {
        const pw = this.powered(p);
        if (!q.on && q.auto && pw && ps < q.start) { q.on = true; q.starts++; q.lastStart = this.t; }
        else if (q.on && (ps >= q.stop || !pw || !q.auto)) q.on = false;
      } else if (p.type === 'gate') {
        if (q.open !== q.target) q.open = q.target > q.open ? Math.min(q.target, q.open + dt / 4) : Math.max(q.target, q.open - dt / 4);
      } else if (p.type === 'tank') {
        if (q.gal < q.cap && q.fill > 0) q.gal = Math.min(q.cap, q.gal + q.fill * dt / 60);
      }
    }
  }
  // volumes: tank draw-down, water discharged
  account(dt) {
    const G = this.G, W = this.W;
    for (const [id] of G.fixNode) {
      const p = W.parts.get(id), l = G.partLink.get(id);
      if (p && p.type === 'tank' && l) p.p.gal = Math.max(0, p.p.gal - l.q * dt / 60);
    }
    let out = 0;
    for (const e of G.emit) out += e.link.q;
    this.outFlow = out; this.stats.gallons += out * dt / 60;
  }
  // convenience readers for UI / tests
  touch() { this.dirty = true; }
  flowOf(id) { const l = this.G && this.G.partLink.get(id); return l ? l.q : 0; }
  pin(id) { const m = this.pP.get(id); return m ? m[0] : 0; }
  pout(id) { const m = this.pP.get(id); return m ? m[1] : 0; }
  sysP(id) { const s = this.ss.get(id); if (!s) return 0; return s.state === 'dry' ? s.P : this.pout(id); }
};

// Bring every system to its normal standby condition (water in wet pipe, air on dry pipe,
// mains pressurized). Used when a scenario starts with existing plant, and by "Commission".
DI.Sim.prototype.commission = function (keep) {
  const W = this.W;
  if (this.ver !== W.ver) this.sync();
  if (!keep) for (const [id, s] of this.ss) {
    const v = W.parts.get(id), inf = this.sysd.info.get(id), V = Math.max(inf.vol, 1);
    if (v.type === 'wetv') { s.state = 'wet'; s.wat = inf.vol; s.G = 0; }
    else if (!v.p.tripped && inf.src.length) {
      s.state = 'dry'; s.wat = 0; s.G = (v.p.airSet + DI.ATM) * V; s.o2g = (inf.hasN2 ? DI.N2_O2 : 0.209) * s.G; s.P = v.p.airSet; s.set = true; s.ref = s.P; s.fillTime = -1;
    }
  }
  this.dirty = true;
  const pumps = [...W.parts.values()].filter((p) => p.type === 'epump' || p.type === 'dpump');
  const saved = pumps.map((p) => p.p.mode);
  const quiet = this.quiet; this.quiet = true;
  pumps.forEach((p) => { p.p.mode = 'off'; p.p.on = false; });
  for (let i = 0; i < 40; i++) this.step(0.5);
  if (!W.byType('jockey').length && pumps.length) { pumps[0].p.mode = 'hand'; for (let i = 0; i < 24; i++) this.step(0.5); pumps[0].p.mode = 'off'; for (let i = 0; i < 10; i++) this.step(0.5); }
  pumps.forEach((p, i) => { p.p.mode = saved[i]; p.p.on = false; p.p.spd = 0; p.p.ranFor = 0; });
  for (let i = 0; i < 10; i++) this.step(0.5);
  this.quiet = quiet; this.log.length = 0; this.stats.gallons = 0; this.lastAuto = 0;
  if (keep !== undefined && keep !== false) { this.t = keep; return; }
  this.t = 0;
  for (const s of this.ss.values()) { s.openT = -1; s.waterT = -1; s.tripT = -1; s.flowT = 0; }
  for (const p of W.parts.values()) { if (p.p.starts !== undefined) p.p.starts = 0; if (p.p.runSec !== undefined) p.p.runSec = 0; if (p.p.autoStarts) p.p.autoStarts = 0; }
};

// Fast-forward: big steps while nothing is flowing, fine steps when something is.
DI.Sim.prototype.warp = function (sec, maxMs) {
  const end = this.t + sec, t0 = Date.now();
  while (this.t < end) {
    let busy = this.outFlow > 0.5 || this.fires.length > 0 || this.procs.some((p) => p.kind !== 'leak');
    if (!busy) for (const s of this.ss.values()) if (s.state === 'filling' || (s.openK && s.openK.length)) { busy = true; break; }
    if (!busy) for (const p of this.W.parts.values()) if ((p.type === 'epump' || p.type === 'dpump') && p.p.spd > 0 && p.p.spd < 1) { busy = true; break; }
    const idle = sec > 40 * 86400 ? 3600 : sec > 2 * 86400 ? 600 : 20;
    this.coarse = !busy && idle > 30 && !!this.G;
    this.step(Math.min(busy ? 0.25 : idle, end - this.t)); this.coarse = false;
    if (!busy && maxMs && Date.now() - t0 > maxMs) break;
    if (busy && maxMs && Date.now() - t0 > maxMs) break;
  }
  return end - this.t;      // seconds still to go (0 when done)
};

// Save / load of the dynamic state that matters (pressures re-settle on load).
DI.SS_KEYS = ['state', 'wat', 'G', 'o2g', 'P', 'set', 'corr', 'holes', 'moist', 'fillTime', 'fillT0', 'n2T', 'vol', 'ref'];
DI.Sim.prototype.dump = function () {
  const ss = []; for (const [id, s] of this.ss) { const o = {}; for (const k of DI.SS_KEYS) o[k] = s[k]; ss.push([id, o]); }
  return { t: this.t, ss, results: this.results.slice(-60), leaks: this.leaks, editT: this.editT || 0, lastTestT: this.lastTestT || 0, burn: null };
};
DI.Sim.prototype.restore = function (j) {
  for (const [id, o] of j.ss) { const s = this.ss.get(id); if (s) Object.assign(s, o); }
  this.results = j.results || []; this.leaks = j.leaks || []; this.dirty = true;
  this.commission(j.t || 0.001); this.editT = j.editT || 0; this.lastTestT = j.lastTestT || 0; this.lastAuto = 0;
};
