// Simulation core: owns dynamic state, steps hydraulics, pump controllers and the tank.
// Order each tick: fire -> alarm/release -> valve trip logic -> controllers -> solve -> accounting.
var DI = globalThis.DI || (globalThis.DI = {});

DI.ACTS_MAX = 600;                        // ASSUMED: size of the operator log (S.acts), in memory and in a save
// Trim the operator log to DI.ACTS_MAX. Closed history goes first: everything before the earliest incident that
// is still open. The opening `incident` entry of an open incident is never dropped, so its score stays readable.
DI.trimActs = function (S) {
  const A = S.acts; let over = A.length - DI.ACTS_MAX; if (over <= 0) return;
  const keep = new Set();
  for (const [id, s] of S.ss) if (s.inc) for (let i = A.length - 1; i >= 0; i--) if (A[i].kind === 'incident' && A[i].id === id) { keep.add(A[i]); break; }
  let cut = A.findIndex((a) => keep.has(a)); if (cut < 0) cut = A.length;
  const n = Math.min(over, cut); if (n > 0) { A.splice(0, n); over -= n; }
  for (let i = 0; i < A.length && over > 0;) { if (keep.has(A[i])) i++; else { A.splice(i, 1); over--; } }
};

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
    this.acts = [];                         // operator / recovery log: { t, kind, id }, read by DI.recoveryScore
    this.dq = []; this.dqSeq = 0;           // DACT queue: signals that came due with both channels down (DI.dactStep)
    this.genT = -1;                         // standby generator: time utility was lost
    DI.fireInit(this);
    this.sync();
  }
  act(kind, id, x) { this.acts.push(Object.assign({ t: this.t, kind, id }, x || {})); if (this.acts.length > DI.ACTS_MAX) DI.trimActs(this); }
  say(text, cls) { this.log.push({ t: this.t, text, cls: cls || '' }); if (this.log.length > 200) this.log.shift(); DI.bus.emit('log', text, cls); }
  // re-discover systems after any map edit; keep state of valves that still exist
  sync() {
    const W = this.W;
    DI.setJuris(W);                       // site settings travel with the world
    this.sysd = DI.findSystems(W);
    for (const [id, inf] of this.sysd.info) {
      let s = this.ss.get(id);
      if (!s) {
        s = { state: inf.type === 'wetv' ? 'filling' : 'dry', wat: 0, G: DI.ATM * Math.max(inf.vol, 1), o2g: 0.209 * DI.ATM * Math.max(inf.vol, 1),
          P: 0, set: false, tripT: -1, openT: -1, waterT: -1, fillT0: -1, fillTime: -1, fill1: -1, ref: 0, corr: 0, moist: 0.1, vol: inf.vol, flowT: 0, alarm: false, lowAir: false };
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
    for (const l of this.leaks) l.sys = this.sysd.tileSys[l.k] || 0;      // a break belongs to whichever system its tile is on now
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
        const was = q.open;
        if (q.open !== q.target) q.open = q.target > q.open ? Math.min(q.target, q.open + dt / 4) : Math.max(q.target, q.open - dt / 4);
        if (was > 0.02 && q.open <= 0.02) this.act('close-valve', p.id);
        // back in service: logged only for a reopening that went through the reopen gate (DI.setGate)
        if (was < 0.99 && q.open >= 0.99 && q.viaGate) { q.viaGate = false; this.act('open-valve', p.id, { flow: Math.max(0, ...DI.gateValves(this, p.id).map(([, , s]) => Math.abs(s.flow || 0))) }); DI.drillDrainPrompt(this, p.id); }
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
    // mdGal: the part of it that left through a main drain (a main drain test). It goes to the drain, not onto the floor.
    let out = 0, md = 0;
    for (const e of G.emit) { out += e.link.q; if (e.kind === 'mdrain') md += e.link.q; }
    this.outFlow = out; this.stats.gallons += out * dt / 60; if (md > 0) this.stats.mdGal = (this.stats.mdGal || 0) + md * dt / 60;
  }
  // convenience readers for UI / tests
  touch() { this.dirty = true; }
  flowOf(id) { const l = this.G && this.G.partLink.get(id); return l ? l.q : 0; }
  pin(id) { const m = this.pP.get(id); return m ? m[0] : 0; }
  pout(id) { const m = this.pP.get(id); return m ? m[1] : 0; }
  sysP(id) { const s = this.ss.get(id); if (!s) return 0; return s.state === 'dry' ? s.P : this.pout(id); }
};

// ---------- reopening a zone control valve (FP Lead: generic practice, the maker's IOM governs specifics)
// Dry and preaction valves whose nearest upstream control valve is this gate: [id, valve, state].
// Simplification: only the control valve nearest upstream is gated; wet systems are not gated.
DI.gateValves = function (S, gateId) {
  const o = []; for (const [id, s] of S.ss) { const v = S.W.parts.get(id); if (!v || v.type === 'wetv') continue; const g = DI.ctrlValve(S.W, id); if (g && g.id === gateId) o.push([id, v, s]); }
  return o;
};
// The reopen gate refuses in one place only: the scored incident of a running drill (Fire Tutor). That is the
// first `incident` entry at or after the drill started, the same one DI.drillRecovery scores, on zone `id`,
// until its control valve has been reopened through the gate. Nothing else counts: not a trip test, not a
// sandbox incident, not an incident from before the drill.
DI.drillIncidentOpen = function (S, id, gateId) {
  const d = S.drill; if (!d || d.done || !(d.t0 >= 0)) return false;
  const A = S.acts, i0 = A.findIndex((a) => a.kind === 'incident' && a.t >= d.t0); if (i0 < 0 || A[i0].id !== id) return false;
  for (let i = i0 + 1; i < A.length; i++) if (A[i].kind === 'open-valve' && A[i].id === gateId) return false;
  return true;
};
// What is still open on zone `id`, as short phrases that name the zone. Listed in the reopen warning and in the
// recovery checklist. An open head and an open drain are listed too, though they never refuse a reopening.
DI.openItems = function (S, id) {
  const W = S.W, v = W.parts.get(id), s = S.ss.get(id), inf = S.sysd.info.get(id), o = []; if (!v || !s || v.type === 'wetv') return o;
  const nm = DI.sysName(S, id), pre = v.type === 'prev', pn = pre ? W.panelOf(id) : null;
  if (s.openK && s.openK.length) o.push('head not replaced in ' + nm);
  if (pre && (v.p.sol || v.p.pull || v.p.mrzL)) o.push('D / the solenoid is still latched on ' + nm + ' (panel not reset)');
  if (s.state !== 'dry' || (pre && v.p.mech)) o.push('the riser valve of ' + nm + ' is still tripped');
  else if (s.P < v.p.loAir) o.push('air in ' + nm + ' is ' + DI.fmt(s.P, 1) + ' psi, below low air (' + v.p.loAir + ' psi)');
  if (pre && v.p.pLatch) o.push('P is still latched on ' + nm);
  if (v.p.sdrain || v.p.drain) o.push('the drain of ' + nm + ' is still open');
  if (inf && inf.src.length && !v.p.airValve) o.push('the air / N2 supply to ' + nm + ' is still isolated');
  if (pn && pn.p.alive === false) o.push('the releasing panel of ' + nm + ' is dead');
  return o;
};
// Why one zone is not ready to take water again: '' or { msg, soft }. A zone goes back in service only when
// (a) the panel is reset with the solenoid de-energized (D, the Manual Release zone and P all clear) and the
// clapper is reset, and (b) the pipe air is above low air. Otherwise opening the valve re-trips it.
// soft: a dead panel cannot release anything, so it is a warning and never a refusal.
DI.zoneReady = function (S, id) {
  const W = S.W, v = W.parts.get(id), s = S.ss.get(id), pre = v.type === 'prev', pn = pre ? W.panelOf(id) : null;
  if (pre && (v.p.sol || v.p.pull || v.p.mrzL)) return { msg: 'Reset the panel first: D / the solenoid is still latched.' };
  if (s.state !== 'dry' || (pre && v.p.mech)) return { msg: 'Reset the riser valve first: it is still tripped.' };
  if (s.P < v.p.loAir) return { msg: 'Restore air first: ' + DI.fmt(s.P, 1) + ' psi is below low air (' + v.p.loAir + ' psi).' };
  if (pre && v.p.pLatch) return { msg: v.p.trim === 'el-pn' ? 'Reset the actuator at the trim: P is still latched.' : 'Reset the panel: P is still latched.' };
  if (pn && pn.p.alive === false) return { msg: 'The releasing panel is dead: this zone has no automatic release until power is back.', soft: true };
  return null;
};
// What reopening this control valve would meet: { msg, items, refuse }.
//   refuse  a zone behind it is the scored incident of a running drill and is not ready (hard reason): msg is why.
//   items   everything still open on the zones behind it (DI.openItems). Outside the scored incident the valve
//           opens anyway and the items are the warning.
//   msg     the refusal, else the first reason a zone is not ready, else ''.
DI.reopenCheck = function (S, gateId) {
  let warn = null, refuse = null; const items = [];
  for (const [id] of DI.gateValves(S, gateId)) {
    const r = DI.zoneReady(S, id); items.push(...DI.openItems(S, id)); if (!r) continue;
    if (!refuse && !r.soft && DI.drillIncidentOpen(S, id, gateId)) refuse = r;
    if (!warn) warn = r;
  }
  return { msg: refuse ? refuse.msg : warn ? warn.msg : '', items, refuse: !!refuse };
};
DI.reopenGate = (S, gateId) => DI.reopenCheck(S, gateId).msg;
DI.reopenWarn = (gateId, items) => 'Control valve #' + gateId + ' reopened with items still open: ' + items.join('; ') + '.';
// Operate a control valve (the inspector button and the reference operator use this). Closing is always
// allowed. Opening is refused only during the scored incident of a running drill, while the zone behind it is
// not ready. Anywhere else it opens, and what is still open is logged as a warning and as a `reopen-warn`
// entry in the operator log. Returns '' or the reason it was refused.
DI.setGate = function (S, id, want) {
  const g = S.W.parts.get(id); if (!g || g.type !== 'gate') return 'No control valve.';
  if (!(want > 0.5)) { g.p.target = 0; g.p.viaGate = false; for (const [, , s] of DI.gateValves(S, id)) { delete s.floodW; delete s.floodK; } return ''; }
  const r = DI.reopenCheck(S, id);
  if (r.refuse) return r.msg;
  if (r.items.length) {
    S.say(DI.reopenWarn(id, r.items), 'bad'); S.act('reopen-warn', id, { items: r.items.slice() });
    // practice: the valve opens anyway. A zone behind it with an open head, a tripped riser or a latched P is watched
    // (s.floodW), and DI.gasPost explains in the log if water then leaves through the head.
    // s.floodK records what was skipped at the reopen: 1 a head still open, 2 the riser valve still tripped, 4 P still latched
    for (const [, v, s] of DI.gateValves(S, id)) if ((s.openK && s.openK.length) || s.state !== 'dry' || (v.type === 'prev' && (v.p.mech || v.p.pLatch))) {
      s.floodW = S.t; s.floodK = (s.openK && s.openK.length ? 1 : 0) | (s.state !== 'dry' || (v.type === 'prev' && v.p.mech) ? 2 : 0) | (v.type === 'prev' && v.p.pLatch ? 4 : 0);
    }
  }
  g.p.target = 1; g.p.viaGate = true; return '';
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
      s.state = 'dry'; s.wat = 0; s.G = (v.p.airSet + DI.ATM) * V; s.o2g = (inf.hasN2 ? DI.N2_O2 : 0.209) * s.G; s.P = v.p.airSet; s.set = true; s.ref = s.P; s.fillTime = -1; s.fill1 = -1;
      if (v.type === 'prev') v.p.pLatch = false;
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
// until: optional predicate checked before every step; the skip ends as soon as it is true (0 seconds left).
DI.Sim.prototype.warp = function (sec, maxMs, until) {
  const end = this.t + sec, t0 = Date.now();
  while (this.t < end) {
    if (until && until()) return 0;
    let busy = this.outFlow > 0.5 || this.fires.length > 0 || this.procs.some((p) => p.kind !== 'leak' || p.stage === 0);      // a 24 h air test is quiet once it is charged
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
// sig: the first-seen time of every active signal (t0), whether the supervising station has it (tx) and whether it
// came in on test. Without it every delay clock (AC failure, a failed DACT channel) would restart at a load.
// dq, dqSeq: the DACT queue, so a save made in an outage keeps its attempts, states and original event times. A save
// from before Cycle 6 has none: the entries are made again from `sig` on the first step, RETRY or HELD by age.
// genT: when utility power was lost. The standby generator (generator-backed pumps, and the generator-backed panel,
// which it carries for DI.GEN_RUN_S) is timed from it, so it has to survive a load: the settle would otherwise leave
// it near 0 and a save made late in the game would find the generator's 24 h already spent.
DI.SS_KEYS = ['state', 'wat', 'G', 'o2g', 'P', 'set', 'corr', 'holes', 'moist', 'fillTime', 'fillT0', 'fill1', 'n2T', 'vol', 'ref', 'armed', 'inc', 'airLost', 'nOpen', 'sdr', 'dz', 'av', 'det', 'dT', 'pDark', 'zf', 'rfill', 'ret', 'floodW', 'floodK', 'rtErr', 'rtEv', 'rtDr'];
DI.Sim.prototype.dump = function () {
  const ss = []; for (const [id, s] of this.ss) { const o = {}; for (const k of DI.SS_KEYS) o[k] = s[k]; ss.push([id, o]); }
  return { t: this.t, ss, results: this.results.slice(-60), acts: this.acts.slice(), leaks: this.leaks, editT: this.editT || 0, lastTestT: this.lastTestT || 0, burn: null,
    sig: [...this.sig].map(([k, o]) => [k, { t0: o.t0, tx: o.tx, test: o.test, had: o.had }]), dq: this.dq.map((e) => Object.assign({}, e)), dqSeq: this.dqSeq, genT: this.genT };
};
DI.Sim.prototype.restore = function (j) {
  for (const [id, o] of j.ss) { const s = this.ss.get(id); if (s) for (const k of Object.keys(o)) if (o[k] !== undefined) s[k] = o[k]; }
  this.acts = j.acts || [];
  // a save from before the maker-trim setpoints: bring a set system up to its new normal pressure so the
  // migrated valve does not come back sitting on its P trip point
  for (const [id, s] of this.ss) {
    const v = this.W.parts.get(id); if (!v || !v.p.repress) continue; delete v.p.repress;
    if (s.state !== 'dry' || !s.set || s.P >= v.p.airSet) continue;
    const x = s.G > 0 ? s.o2g / s.G : 0.209; s.G = (v.p.airSet + DI.ATM) * Math.max(this.sysd.info.get(id).vol, 1); s.o2g = x * s.G; s.P = v.p.airSet; s.ref = s.P;
  }
  this.results = j.results || []; this.leaks = j.leaks || []; this.dirty = true;
  // The settle below runs the alarm step on a clock that starts at 0, so it would re-raise every signal with a new
  // first-seen time and re-sound a silenced panel. A save that carries `sig` puts both back afterwards: a signal
  // that was active at the save keeps its t0 / tx / test, and one that only comes back once the clock is right (the
  // station's loss-of-communication line) finds them in S.sigSeen at the first step. An older save has no `sig`
  // and loads as it always did.
  // The settle is not game time, so it must not run a panel's battery down (S.settling): with utility power off
  // and seconds of standby left, the panel would die inside the settle and drop every latch it holds.
  const panels = j.sig ? this.W.byType('panel').map((p) => [p, p.p.silenced]) : [];
  this.settling = true; this.commission(j.t || 0.001); this.settling = false; this.editT = j.editT || 0; this.lastTestT = j.lastTestT || 0; this.lastAuto = 0;
  this.dq = Array.isArray(j.dq) ? j.dq.map((e) => Object.assign({}, e)) : []; this.dqSeq = j.dqSeq || 0;       // after the settle, which makes no entries (DI.dactStep)
  // The outage clock, after the settle (which restarts it near 0). A save from before it was stored, made with the
  // power off, reads as an outage that began just long enough ago for the generator to be running.
  this.genT = this.W.power ? -1 : j.genT >= 0 ? j.genT : Math.max(0, this.t - DI.GEN_START_S - 1);
  if (j.sig) {
    this.sigSeen = new Map(j.sig);
    for (const [k, o] of this.sig) { const q = this.sigSeen.get(k); if (q) { o.t0 = q.t0; o.tx = !!q.tx; o.test = !!q.test; o.had = !!q.had; } }
    for (const [p, sil] of panels) p.p.silenced = !!sil;
  }
};
