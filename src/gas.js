// Supervisory gas + system fill model for wet / dry / preaction systems.
// Gas is tracked as G = P_abs * V (psi*gal, isothermal ideal gas) with a separate O2 tally,
// so compressor fill time, leak-down, trip point, water transit and nitrogen purity all
// come out of the same bookkeeping rather than being scripted.
var DI = globalThis.DI || (globalThis.DI = {});

DI.SCFM = DI.ATM * 7.4805 / 60;        // psi*gal per second for 1 standard cubic foot / minute
DI.A_SPK = 0.147;                      // effective orifice area of an open 1/2" sprinkler, in^2
// gas flow through an orifice to atmosphere, SCFM (choked above ~13 psig)
DI.gasFlow = function (a, pg) {
  if (pg <= 0 || a <= 0) return 0;
  const pa = pg + DI.ATM, r = DI.ATM / pa, x = (r - 0.528) / 0.472;
  return 18.15 * a * pa * (r <= 0.528 ? 1 : Math.sqrt(Math.max(0, 1 - x * x)));
};
DI.N2_O2 = 0.015;                      // oxygen fraction leaving a 98.5% nitrogen generator
DI.DRY_RATIO = 5.5;                    // differential dry pipe valve: trips near P_water / 5.5

DI.gasPre = function (S, dt) {
  const W = S.W, info = S.sysd.info;
  // 1. who is calling for gas? (pressure switch with 3 psi dead band)
  const callers = new Map();
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = info.get(id);
    if (!v || v.type === 'wetv' || s.state === 'wet' || inf.vol <= 0) { s.call = false; continue; }
    if (s.P >= v.p.airSet) s.call = false; else if (s.P < v.p.airSet - 3) s.call = true;
    if (!v.p.airValve) s.call = false;
    if (s.call) for (const sid of inf.src) {
      const src = W.parts.get(sid);
      if (src.type === 'comp' && inf.hasN2 && s.P > v.p.airSet - 8) continue;   // compressor only does the bulk fill
      callers.set(sid, (callers.get(sid) || 0) + 1);
    }
  }
  for (const p of W.parts.values()) if (p.type === 'comp' || p.type === 'n2') {
    const on = (callers.get(p.id) || 0) > 0 && S.powered(p);
    if (on && !p.p.on) p.p.starts++;
    p.p.on = on; if (on) p.p.runSec += dt;
  }
  // 2. per-system gas balance and trip logic
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = info.get(id); if (!v || inf.vol <= 0) continue;
    const V = inf.vol;
    if (s.spkVer !== S.spkVer || s.ver !== S.ver) { s.openK = inf.tiles.filter((k) => W.spk[k] >= 2); s.spkVer = S.spkVer; s.ver = S.ver; }
    if (s.state === 'wet') continue;
    const Vg = Math.max(V - s.wat, 0.02 * V), frac = s.wat / V;
    let inAir = 0, inN2 = 0;
    if (s.call) for (const sid of inf.src) {
      const src = W.parts.get(sid); if (!src.p.on) continue;
      if (src.type === 'comp' && inf.hasN2 && s.P > v.p.airSet - 8) continue;
      const f = src.p.scfm / callers.get(sid);
      if (src.type === 'n2') inN2 += f; else inAir += f;
    }
    // outlets that are still passing gas (water has not reached them yet)
    let big = 0;
    for (const k of s.openK) if (s.state === 'dry' || frac < S.sysd.reach(id, k)) big += DI.A_SPK;
    if (v.p.itc && inf.remote >= 0 && (s.state === 'dry' || frac < S.sysd.reach(id, inf.remote))) big += DI.A_SPK;
    if (v.type !== 'wetv' && v.p.sdrain) big += 1.5 * v.p.sdrain;
    let small = v.type === 'wetv' ? 0.05 : V * 6e-9 * (1 + 2 * s.corr) + (s.holes || 0) * 2e-5;
    for (const lk of S.leaks) if (lk.sys === id) small += lk.a || 0;
    const purge = v.type !== 'wetv' && v.p.vent && v.p.airValve && inf.hasN2 && s.P > 5 && s.o2g / s.G > 0.0195 ? 6e-5 : 0;
    const out = DI.gasFlow(big + small + purge, s.P);
    const x = DI.clamp(s.o2g / s.G, 0, 0.209);
    // the air maintenance device is a regulator: it never fills past the set pressure
    const gOut = out * DI.SCFM * dt, room = Math.max(0, (v.type === 'wetv' ? 0 : v.p.airSet + DI.ATM) * Vg - s.G + gOut);
    const gInRaw = (inAir + inN2) * DI.SCFM * dt, gIn = Math.min(gInRaw, room), o2in = gInRaw > 0 ? (inAir * 0.209 + inN2 * DI.N2_O2) / (inAir + inN2) : 0;
    if (gInRaw > gIn) for (const sid of inf.src) { const src = W.parts.get(sid); if (src.p.on) src.p.runSec -= dt * (1 - gIn / gInRaw) / Math.max(1, callers.get(sid) || 1); }
    s.o2g += gIn * o2in - gOut * x;
    s.G += gIn - gOut;
    if (s.G < DI.ATM * Vg) { s.o2g += (DI.ATM * Vg - s.G) * 0.209; s.G = DI.ATM * Vg; }   // air drawn back in
    s.o2g = DI.clamp(s.o2g, 0, 0.209 * s.G);
    s.P = s.G / Vg - DI.ATM;
    s.gasOut = out; s.gasIn = inAir + inN2;
    if (big > 0 && s.openT < 0) s.openT = S.t;
    if (v.type === 'wetv') continue;
    s.lowAir = s.set && s.P < v.p.airSet - 10;
    if (s.state !== 'dry') continue;
    if (!s.set) {
      if (s.fillT0 < 0 && s.gasIn > 0) s.fillT0 = S.t;
      if (s.P >= v.p.airSet - 3.2) { s.set = true; s.ref = s.P; if (s.fillT0 >= 0) s.fillTime = S.t - s.fillT0; S.say(DI.sysName(S, id) + ' is pressurized and in service (' + DI.fmt(s.P) + ' psi)', 'good'); }
      continue;
    }
    // trip logic
    const ps = S.pin(id); let why = '';
    s.ref = s.P > s.ref ? s.P : s.ref + (s.P - s.ref) * Math.min(1, dt / 120);
    if (v.type === 'dryv') {
      if (s.P < ps / DI.DRY_RATIO) why = 'air fell below the trip point (' + DI.fmt(ps / DI.DRY_RATIO, 1) + ' psi)';
      else if (v.p.qod && s.ref - s.P > 2.5) why = 'accelerator sensed the pressure drop';
    } else {
      const low = s.P < Math.max(5, 0.45 * v.p.airSet), sol = !!v.p.sol;
      if (v.p.pull) why = 'manual emergency release';
      else if (v.p.mode === 'single' && sol) why = 'detection released the solenoid';
      else if (v.p.mode === 'non' && (sol || low)) why = sol ? 'detection released the solenoid' : 'loss of air';
      else if (v.p.mode === 'double' && sol && low) why = 'detection AND loss of air: both interlocks satisfied';
    }
    if (why) {
      s.state = 'filling'; s.tripT = S.t; s.set = false; v.p.tripped = true; S.dirty = true;
      S.say(DI.sysName(S, id) + ' TRIPPED: ' + why, 'bad'); DI.bus.emit('trip', id);
    }
  }
};

DI.gasPost = function (S, dt) {
  const W = S.W, G = S.G, net = G.net;
  const outBy = new Map();
  for (const e of G.emit) if (e.sys) outBy.set(e.sys, (outBy.get(e.sys) || 0) + e.link.q);
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = S.sysd.info.get(id); if (!v || inf.vol <= 0) { s.flow = 0; continue; }
    const V = inf.vol, l = G.partLink.get(id), qIn = l && l.open ? l.q : 0, qOut = outBy.get(id) || 0;
    s.flow = qIn; s.qOut = qOut;
    const nd = G.partNode.get(id), po = nd && nd[1] >= 0 ? net.P[nd[1]] : 0;
    if (s.state === 'filling') {
      s.wat += (qIn - qOut) * dt / 60;
      const dr = v.type === 'wetv' ? v.p.drain : v.p.sdrain;
      if (dr && po < 1.5) s.wat -= 45 * dr * dt / 60;                       // gravity drain once pressure is gone
      s.wat = DI.clamp(s.wat, 0, V);
      const Vg = Math.max(V - s.wat, 0.02 * V), pn = Math.max(s.G, DI.ATM * Vg) / Vg - DI.ATM;
      const nodes = G.sysNodes.get(id);
      if (nodes && nodes.length) { let avg = 0; for (const i of nodes) avg += net.P[i]; avg /= nodes.length; const d = pn - avg; for (const i of nodes) net.pPrev[i] = Math.max(0, net.pPrev[i] + d); }
      s.P = pn;
      if (qOut > 1 && s.waterT < 0) s.waterT = S.t;
      // water front reaching another open outlet changes the network
      let nr = 0; const fr = s.wat / V;
      for (const k of s.openK || []) if (fr >= S.sysd.reach(id, k)) nr++;
      if (v.p.itc && inf.remote >= 0 && fr >= S.sysd.reach(id, inf.remote)) nr++;
      for (const lk of S.leaks) if (lk.sys === id && fr >= S.sysd.reach(id, lk.k)) nr++;
      if (nr !== s.nReach) { s.nReach = nr; S.dirty = true; }
      if (s.wat >= 0.985 * V) { s.state = 'wet'; s.wat = V; S.dirty = true; if (v.type !== 'wetv') s.moist = 1; }
    } else if (s.state === 'wet') {
      s.P = po;
      if (qOut > 1 && s.waterT < 0) s.waterT = S.t;
      if (qOut - qIn > 1 && po < 1.5) { s.state = 'filling'; s.wat = 0.984 * V; s.G = DI.ATM * 0.02 * V; s.o2g = 0.209 * s.G; S.dirty = true; }
    }
    // waterflow alarm: vane switch with ~30 s retard on wet risers, pressure switch on dry / preaction
    if (v.type === 'wetv') { s.flowT = Math.abs(qIn) > 8 ? s.flowT + dt : Math.max(0, s.flowT - 2 * dt); s.alarm = s.flowT >= 30; }
    else s.alarm = s.state !== 'dry' && po > 4;
    if (s.alarm && !(s.alarmT >= 0)) s.alarmT = S.t; else if (!s.alarm) s.alarmT = -1;
  }
};

// Player actions on a tripped / drained valve
DI.resetValve = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id), inf = S.sysd.info.get(id);
  if (!v || v.type === 'wetv') return 'Wet risers have nothing to reset.';
  if (s.state === 'dry') return 'Valve is already set.';
  if (s.wat > 0.01 * inf.vol + 0.2) return 'System still holds ' + DI.fmt(s.wat) + ' gal. Close the control valve and open the system drain first.';
  if (Math.abs(s.flow) > 1) return 'Water is still flowing through the valve. Close the control valve first.';
  if (v.type === 'prev' && (v.p.sol || v.p.pull)) return 'Release is still active. Reset the releasing panel / manual pull first.';
  if (s.openK && s.openK.length) return 'Replace the ' + s.openK.length + ' operated sprinkler(s) first.';
  s.state = 'dry'; s.wat = 0; s.G = DI.ATM * inf.vol; s.o2g = 0.209 * s.G; s.P = 0; s.set = false; s.fillT0 = -1; s.fillTime = -1;
  s.tripT = -1; s.openT = -1; s.waterT = -1; s.moist = 1; v.p.tripped = false; v.p.sdrain = 0; v.p.itc = 0; S.dirty = true;
  S.say(DI.sysName(S, id) + ' clapper reset. Re-pressurizing.', 'good');
  return '';
};

DI.sysName = function (S, id) {
  const v = S.W.parts.get(id), inf = S.sysd.info.get(id);
  const kind = { wetv: 'Wet system', dryv: 'Dry system', prev: 'Preaction system' }[v.type];
  let where = '';
  if (inf && inf.rooms.size) where = ' - ' + [...inf.rooms].map((r) => S.W.rooms[r - 1].name).slice(0, 2).join(' + ');
  return kind + ' #' + id + where;
};
