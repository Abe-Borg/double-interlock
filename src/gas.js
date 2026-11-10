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

// ---------- preaction release state (FA Lead truth table, fixtures/di-release-truth-table.csv)
// The panel manual station is typed DETECTION and sits inside D. Only where the project flag is ON and the
// trim is electric / electric is it typed MANUAL RELEASE (footnote 9(c), NEEDS PE REVIEW): then it is the
// Manual Release zone, a separate release path that is not detection and bypasses P.
DI.stationType = (W, v) => (v.p.trim === 'el-el' && W.cfg && W.cfg.manualReleaseBypassP ? 'MANUAL RELEASE' : 'DETECTION');
//   Release = (D AND P) OR (Bypass9c AND ManualReleaseZone), the second term on electric / electric only.
//   D    = Fire 1 latched by the panel (v.p.sol) OR the manual station typed DETECTION (v.p.pull).
//          The Manual Release zone is never in D.
//   P    = pipe pressure fell below P trip and latched (v.p.pLatch)
//   mrz  = the Manual Release zone has latched its own release (v.p.mrzL). It stays latched after the station
//          is reset, until a panel reset.
//   sol  = the energized solenoid.  El/El: the release.  El/Pn: D alone, because P is the pneumatic actuator
//          at the valve and not a panel input.
//   open = the release, on both trims. The mechanical release is separate.
DI.relState = function (W, v) {
  const q = v.p, mrz = !!q.mrzL && DI.stationType(W, v) === 'MANUAL RELEASE';
  const D = !!q.sol || !!q.pull, P = !!q.pLatch, open = (D && P) || mrz;
  return { D, P, mrz, sol: q.trim === 'el-pn' ? D : open, open };
};
// which release path is acting, for the inspector and the manual: [text, class]
DI.relPath = function (W, v) {
  const rs = DI.relState(W, v);
  if (rs.mrz) return ['Manual Release zone RELEASING - without P', 'bad'];
  if (DI.stationType(W, v) === 'MANUAL RELEASE') return ['Manual Release zone BYPASS ARMED (9(c), NEEDS PE REVIEW)', 'warn'];
  return ['(D AND P)  armed', 'good'];
};
DI.SAFE_PSI = 0.5;                      // ASSUMED: "about 0 psi" on the system gauge, near gauge resolution
// water left in a pipe that counts as drained (the same threshold the riser reset uses)
DI.dryLim = (V) => 0.2 + 0.01 * V;
// maintenance regulator target: normal pressure, raised to the test pressure while a 24 h air test is charging
DI.airCharging = (S, id) => S.procs.length > 0 && S.procs.some((q) => q.kind === 'leak' && q.id === id && q.stage === 0);
DI.airTarget = (S, id, v) => (DI.airCharging(S, id) ? Math.max(v.p.airSet, DI.AIR_TEST.psi) : v.p.airSet);
DI.setSolOut = function (S, id, v) {
  const on = DI.relState(S.W, v).sol;
  if (on && !v.p.solOut) S.say('Releasing panel energized the solenoid on ' + DI.sysName(S, id) + (v.p.trim === 'el-pn' ? ' (electric leg). Water still needs P at the pneumatic actuator.' : '.'), 'bad');
  v.p.solOut = on;
};
// An incident on a preaction system starts with an operated head, a latched P or a trip, and stays open
// until the system is back in service. The recovery score (DI.recoveryScore) reads the log between them.
DI.incident = function (S, id, s, why) {
  if (s.inc) return; s.inc = true; s.airLost = true;
  const q = S.W.parts.get(id).p; S.act('incident', id, { why, det: !!(q.sol || q.pull || q.mrzL) });     // det: D or the zone was already latched
};


DI.gasPre = function (S, dt) {
  const W = S.W, info = S.sysd.info;
  // 1. who is calling for gas? (pressure switch with 3 psi dead band)
  const callers = new Map();
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = info.get(id);
    if (!v || v.type === 'wetv' || s.state === 'wet' || inf.vol <= 0) { s.call = false; continue; }
    // a zone being charged for the 24 h air test is held at the test pressure, with no dead band
    const chg = DI.airCharging(S, id), tgt = s.tgt = chg ? DI.airTarget(S, id, v) : v.p.airSet;
    if (chg) s.call = s.P < tgt; else if (s.P >= tgt) s.call = false; else if (s.P < tgt - 3) s.call = true;
    if (!v.p.airValve) s.call = false;
    if (s.call) for (const sid of inf.src) {
      const src = W.parts.get(sid);
      if (src.type === 'comp' && inf.hasN2 && s.P > v.p.airSet - 8) continue;   // compressor only does the bulk fill
      callers.set(sid, (callers.get(sid) || 0) + 1);
    }
  }
  for (const p of W.parts.values()) if (p.type === 'comp' || p.type === 'n2') {
    const on = (callers.get(p.id) || 0) > 0 && S.powered(p) && !p.p.fault;
    if (on && !p.p.on) p.p.starts++;
    p.p.on = on; if (on) p.p.runSec += dt;
  }
  // 2. per-system gas balance and trip logic
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = info.get(id); if (!v || inf.vol <= 0) continue;
    const V = inf.vol;
    if (s.spkVer !== S.spkVer || s.ver !== S.ver) { s.openK = inf.tiles.filter((k) => W.spk[k] >= 2); s.spkVer = S.spkVer; s.ver = S.ver; }
    const pre = v.type === 'prev'; let dark = false;
    if (pre) {
      // recovery log: edge-detect what the operator did, whoever did it (UI, bot or test)
      const nOpen = s.openK.length; if (nOpen > (s.nOpen || 0)) { DI.incident(S, id, s, 'head'); S.act('head-open', id); } s.nOpen = nOpen;
      if (!!v.p.sdrain !== !!s.sdr) { s.sdr = !!v.p.sdrain; S.act(s.sdr ? 'drain' : 'drain-close', id); s.dz = false; }
      // "confirm 0 psi and no water" is automatic (Simplification): logged once per drain opening
      if (s.sdr && !s.dz && s.state !== 'wet' && s.P <= DI.SAFE_PSI && s.wat <= DI.dryLim(V)) {
        s.dz = true; S.act('drain-zero', id);
        if (s.inc) S.say(DI.sysName(S, id) + ': drain open, gauge at 0 psi, no water in the pipe.', 'good');
      }
      const av = v.p.airValve ? 1 : 0; if (s.av === undefined) s.av = av;
      if (av !== s.av) { s.av = av; if (!S.procs.some((q) => q.kind === 'leak' && q.id === id)) S.act(av ? 'supply-open' : 'isolate-air', id); }
      const det = !!(v.p.sol || v.p.pull || v.p.mrzL); if (det && !s.det) { s.dT = S.t; S.act('det-latch', id); } s.det = det;
      // An electric / electric trim keeps the P latch in panel memory. A dead panel holds nothing (ASSUMED
      // simplification): the latch is lost, and when power returns the panel reads PSL-REL again, so P comes
      // back on that tick if the pipe is still low. Power coming back is not a release; the inputs are.
      const pn = W.panelOf(id); dark = v.p.trim === 'el-el' && !!pn && pn.p.alive === false;
      if (dark) { v.p.pLatch = false; s.pDark = true; }
      else if (s.pDark) {
        s.pDark = false; const back = s.state === 'dry' && !!s.armed && s.P < v.p.pTrip;
        S.say('Panel power restored: inputs re-read. P ' + (back ? 'returns (pipe still below P trip)' : 'is clear') + ' on ' + DI.sysName(S, id) + '.', back ? 'warn' : '');
      }
      if (s.state !== 'dry' || s.P < v.p.loAir) s.airLost = true;
      else if (s.airLost && s.set && s.P >= v.p.airSet - 3.2 && !nOpen && !v.p.sdrain && !v.p.itc && (v.p.airValve || !inf.src.length)) { s.airLost = false; S.act('restore-air', id); }   // normal pressure, supply open, every opening shut
      if (s.inc && s.state === 'dry' && s.set && !v.p.pLatch && !nOpen && !s.airLost) { s.inc = false; S.act('in-service', id); }
      DI.setSolOut(S, id, v);
    }
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
    const gOut = out * DI.SCFM * dt, room = Math.max(0, (v.type === 'wetv' ? 0 : (s.tgt || v.p.airSet) + DI.ATM) * Vg - s.G + gOut);
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
    s.lowAir = s.set && s.P < v.p.loAir;         // supervisory only: follows live pressure, never a release input
    if (s.state !== 'dry') continue;
    // P sensor (PSL-REL switch or PA-REL actuator): a pure threshold on pipe pressure. No outlet-type test and
    // no rate term: a sprinkler, an open inspector's test and a broken pipe all look the same to it, and a
    // slow leak the compressor holds never reaches the setpoint. It latches until a manual reset: the panel
    // on an electric / electric trim, the actuator at the trim on electric / pneumatic. The sensor is live
    // from the first time the valve is set (commissioning), so after a riser reset the empty pipe reads low
    // and an early reset latches straight back.
    if (pre) {
      if (s.set) s.armed = true;
      if (!dark && s.armed && !v.p.pLatch && s.P < v.p.pTrip) {
        v.p.pLatch = true; v.p.pT = S.t; DI.incident(S, id, s, 'P');
        S.say(DI.sysName(S, id) + ': P latched (' + DI.fmt(s.P, 1) + ' psi, ' + DI.trimOf(v).sensor + '). It stays latched until ' + DI.pResetText(v) + '.', 'warn');
      }
      DI.setSolOut(S, id, v);
    }
    // Mechanical emergency release at the trim: a person opens the valve directly, outside the panel
    // logic. No detection and no P involved, and it works with a dead panel. Water then flows only
    // where a sprinkler is open. Simplification: with every head closed the trapped air is not vented.
    let why = pre && v.p.mech ? 'mechanical emergency release at the trim' : '', zf = '';
    if (!why) {
      if (!s.set) {
        if (s.fillT0 < 0 && s.gasIn > 0) s.fillT0 = S.t;
        if (s.P >= v.p.airSet - 3.2) { s.set = true; s.ref = s.P; if (s.fillT0 >= 0) s.fillTime = S.t - s.fillT0; S.say(DI.sysName(S, id) + ' is pressurized and in service (' + DI.fmt(s.P) + ' psi)' + (pre && v.p.pLatch ? '. P is still latched: reset ' + (v.p.trim === 'el-pn' ? 'the actuator at the trim' : 'the releasing panel') + '.' : ''), pre && v.p.pLatch ? 'warn' : 'good'); }
        continue;
      }
      // trip logic, evaluated only while the valve is set and pressurized
      const ps = S.pin(id);
      s.ref = s.P > s.ref ? s.P : s.ref + (s.P - s.ref) * Math.min(1, dt / 120);
      if (v.type === 'dryv') {
        if (s.P < ps / DI.DRY_RATIO) why = 'air fell below the trip point (' + DI.fmt(ps / DI.DRY_RATIO, 1) + ' psi)';
        else if (v.p.qod && s.ref - s.P > 2.5) why = 'accelerator sensed the pressure drop';
        zf = 'low-air';
      } else {
        // Preaction is double interlock only:  trip := (D AND P) OR the Manual Release zone (9(c) flag, El/El).
        const rs = DI.relState(W, v);
        if (rs.mrz) { why = 'Manual Release zone (bypasses P)'; zf = 'manual-release'; }       // per-project flag, default OFF, NEEDS PE REVIEW
        else if (rs.open) { why = 'detection (or manual detection station) AND P (pipe pressure below ' + v.p.pTrip + ' psi)'; zf = v.p.pT >= s.dT ? 'false-alarm' : 'low-air'; }   // low-air: P was latched before D
      }
    }
    if (why) {
      s.state = 'filling'; s.tripT = S.t; s.set = false; v.p.tripped = true; S.dirty = true;
      if (pre) DI.incident(S, id, s, 'trip');
      S.act('trip', id);
      // A trip with every outlet closed and no fire fills the pipe and discharges nothing: a water-filled
      // zone. It is reported once water has entered (DI.gasPost), unless a head opens first.
      s.zf = zf && !s.openK.length && !v.p.itc && !S.fires.length && !S.leaks.some((l) => l.sys === id) && !S.procs.some((q) => q.kind === 'trip' && q.id === id) ? zf : '';
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
      // the system drain is a water outlet only while water is at it: the graph follows this flag
      const dw = s.wat > DI.dryLim(V); if (dw !== s.dw) { s.dw = dw; if (v.type !== 'wetv' && v.p.sdrain) S.dirty = true; }
      if (s.zf) {
        if ((s.openK && s.openK.length) || S.leaks.some((l) => l.sys === id)) s.zf = '';          // an outlet opened: this is a discharge
        else if (dw) {
          S.act('zone-filled', id, { why: s.zf });
          for (let i = S.acts.length - 1; i >= 0; i--) if (S.acts[i].kind === 'incident' && S.acts[i].id === id) { S.acts[i].why = 'fill'; break; }
          S.say(DI.sysName(S, id) + ' is water-filled: no head is open, so nothing discharges. ' + (s.zf === 'manual-release' ? 'The Manual Release zone let the water in without P; it is not a discharge.' : 'This is an unattended low-air failure, not a discharge.') +
            ' Drain it, reset it, check for freeze and corrosion exposure, and fix the air supply.', 'bad');
          s.zf = '';
        }
      }
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
    // (air pressure alone behind a tripped clapper is not waterflow: there must be water in the pipe or moving)
    else s.alarm = s.state !== 'dry' && po > 4 && (s.wat > DI.dryLim(V) || Math.abs(qIn) > 1 || qOut > 1);
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
  if (v.type === 'prev' && (v.p.sol || v.p.pull || v.p.mrzL)) return 'Detection is still active (solenoid, manual station or Manual Release zone). Reset the releasing panel first.';
  if (s.openK && s.openK.length) return 'Replace the ' + s.openK.length + ' operated sprinkler(s) first.';
  s.state = 'dry'; s.wat = 0; s.G = DI.ATM * inf.vol; s.o2g = 0.209 * s.G; s.P = 0; s.set = false; s.fillT0 = -1; s.fillTime = -1;
  s.tripT = -1; s.openT = -1; s.waterT = -1; s.moist = 1; s.zf = ''; v.p.tripped = false; v.p.itc = 0; S.dirty = true;
  // The riser reset closes the clapper and the mechanical emergency release. It never clears P: that is
  // the releasing panel on an electric / electric trim and the actuator at the trim on electric / pneumatic.
  // The clapper is reset with the system drain still open (FP Lead): the drain is left as the operator has
  // it and is closed as its own step afterwards. Air cannot build until it is closed.
  if (v.type === 'prev') v.p.mech = false;
  S.act('reset-valve', id);
  S.say(DI.sysName(S, id) + ' clapper reset. ' + (v.p.sdrain ? 'Close the system drain, then restore the air.' : v.p.airValve ? 'Re-pressurizing.' : 'Restore the air / N2 supply to refill.') + (v.type === 'prev' ? ' P stays latched until the air is back and ' + DI.pResetText(v) + '.' : ''), 'good');
  return '';
};

// How a latched P is cleared on this valve's trim (the only path that exists for it).
DI.pResetText = (v) => (v.p.trim === 'el-pn' ? 'the actuator is reset at the trim' : 'the releasing panel is reset');
// Electric / pneumatic trim: P is the pneumatic actuator at the valve. A panel reset cannot clear it.
// Restore the air, then reset the actuator here. If the pipe is still below P trip it latches again.
DI.resetTrimP = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id);
  if (!v || v.type !== 'prev') return 'Only a preaction valve has a P sensor to reset.';
  if (v.p.trim !== 'el-pn') return 'On an electric / electric trim P is latched in the releasing panel. Reset the panel.';
  const low = s && s.state === 'dry' && s.armed && s.P < v.p.pTrip;
  v.p.pLatch = false; S.act('reset-trim', id);
  S.say(DI.sysName(S, id) + ': pneumatic actuator reset at the trim.' + (low ? ' The pipe is still below P trip, so it latches again.' : ''), low ? 'warn' : 'good');
  return '';
};

DI.sysName = function (S, id) {
  const v = S.W.parts.get(id), inf = S.sysd.info.get(id);
  const kind = { wetv: 'Wet system', dryv: 'Dry system', prev: 'Preaction system' }[v.type];
  let where = '';
  if (inf && inf.rooms.size) where = ' - ' + [...inf.rooms].map((r) => S.W.rooms[r - 1].name).slice(0, 2).join(' + ');
  return kind + ' #' + id + where;
};
