// Detection, the releasing panel, supervisory / alarm / trouble signals and the fire department.
// A device only reaches the panel (and the outside world) if the player wired it there.
var DI = globalThis.DI || (globalThis.DI = {});

// Aspirating detection stages. Thresholds are example values (smoke units ~ %/ft obscuration) and are a
// site setting (W.cfg.detThr); these are the defaults.
//   Alert  = pre-alarm, never arms a release. Signal class is a site setting (DI.sigClass), supervisory by default.
//   Action = pre-alarm annunciation: no release. Signal class is a site setting, supervisory by default.
//   Fire 1 = alarm, and the detection leg (D) of the double interlock. D is a level check: level >= Fire 1.
//   Fire 2 = escalation only. It is never read as a release input by itself. A reading that jumps straight
//            to Fire 2 is at or above Fire 1, so it is D, and every stage it crossed is annunciated in order.
DI.VESDA_T = [0.03, 0.06, 0.12, 1.2];
DI.VESDA_N = ['', 'ALERT', 'ACTION', 'FIRE 1', 'FIRE 2'];
DI.FIRE1 = 3;                             // the stage that releases
// Spot detector alarm threshold: site setting W.cfg.spotThr, read with DI.spotThr(W) (example value 1.3 %/ft,
// inside the listed window DI.LISTED.smoke). One listed detector in alarm is enough where the room type
// allows release (DI.ROOMS[..].spotRelease); no two-detector confirmation is modelled.
DI.detThr = (W) => (W && W.cfg && Array.isArray(W.cfg.detThr) && W.cfg.detThr.length === 4 ? W.cfg.detThr : DI.VESDA_T);
// can this detector act as the detection leg of a release where it sits?
DI.canRelease = function (W, d) {
  if (d.type === 'vesda') return true;
  const room = d.type === 'smoke' ? W.room(d.x, d.y) : null;
  return !!(room && DI.ROOMS[room.type].spotRelease);
};
// Apply a detection preset to the site thresholds. Returns '' or the reason it was refused.
DI.applyDetPreset = function (W, key) {
  const pr = DI.PRESETS[key]; if (!pr) return 'Unknown preset.';
  if (key === 'nfpa76' && !DI.setJuris(W).nfpa76Adopted) return 'NFPA 76 is not adopted on this site.';
  const t = DI.detThr(W).slice();
  t[0] = pr.alert; t[2] = pr.fire1;
  if (!(t[1] > t[0] && t[1] < t[2])) t[1] = pr.action;        // ASSUMED example; Action otherwise stays at the site value
  W.cfg.detThr = t; W.ver++;                                  // Fire 2 stays at the site value
  return '';
};
DI.FD_TRAVEL = 420;                       // seconds from dispatch to water on the FDC

DI.alarmStep = function (S, dt) {
  const W = S.W, old = S.sig, sig = new Map();
  const panels = W.byType('panel');
  for (const p of panels) {
    if (p.p.battH === undefined) p.p.battH = 24;
    if (W.power) p.p.battH = Math.min(24, p.p.battH + dt / 3600 * 0.5); else p.p.battH = Math.max(0, p.p.battH - dt / 3600);
    p.p.alive = W.power || p.p.battH > 0;
  }
  // lost = the supervising station reports the loss of the panel itself (the panel can no longer send anything)
  const add = (key, type, text, part, lost) => {
    const pn = part ? (part.type === 'panel' ? part : W.panelOf(part.id)) : null;
    const prev = old.get(key);
    const o = { key, type, text, part: part ? part.id : 0, mon: !!lost || !!(pn && pn.p.alive), lost: !!lost, t0: prev ? prev.t0 : S.t, test: prev ? prev.test : S.procs.length > 0 || S.t < (S.testUntil || 0) };
    sig.set(key, o);
    if (!prev && pn) pn.p.silenced = false;          // a new signal resounds a silenced panel
    if (!prev) { DI.bus.emit('signal', o); S.say(type + ': ' + text + (o.test ? '  [system on test: monitoring company notified]' : o.mon ? '' : '  [local only - not wired to a panel]'), type === 'ALARM' ? 'bad' : 'warn'); }
  };
  // detection
  for (const p of W.parts.values()) {
    if (p.type !== 'vesda' && p.type !== 'smoke') continue;
    const room = W.room(p.x, p.y), L = room ? S.smoke[room.id] : 0, T = p.type === 'vesda' ? DI.detThr(W) : [DI.spotThr(W)];
    let lvl = 0; while (lvl < T.length && L >= T[lvl]) lvl++;
    p.p.obs = L; if (lvl > p.p.lvl) p.p.lvl = lvl; p.p.live = lvl;
    const dpn = W.panelOf(p.id); if (dpn && !dpn.p.alive) p.p.lvl = lvl;      // a dead panel holds no latches: only a live reading counts when it comes back
    const rn = room ? room.name : 'outdoors';
    if (p.type === 'vesda') {
      // One row per stage reached, raised in order, so a jump past several thresholds in one tick still
      // records Alert, Action, Fire 1 and Fire 2 one after the other at the same sim time. The detector
      // reports one status: its highest stage. The rows below it stay on the annunciator as the record of
      // the crossing (sup = superseded) and are not active signals at the panel or the supervising station.
      for (let i = 1; i <= p.p.lvl; i++) { add('v' + p.id + '.' + i, i >= DI.FIRE1 ? 'ALARM' : DI.sigClass(W, i === 1 ? 'alert' : 'action'), 'VESDA ' + DI.VESDA_N[i] + ' - ' + rn, p); if (i < p.p.lvl) sig.get('v' + p.id + '.' + i).sup = true; }
      p.p.rel = p.p.lvl >= DI.FIRE1;
    } else {
      if (p.p.lvl >= 1) add('s' + p.id, 'ALARM', 'SMOKE DETECTION - ' + rn, p);
      p.p.rel = p.p.lvl >= 1 && DI.canRelease(W, p);
    }
  }
  // manual release stations: a wired device on the releasing panel. Operated, it is an alarm and the manual
  // input of every preaction valve on that panel that protects the room it is in (handled per valve below).
  for (const p of W.byType('mstn')) if (p.p.on) { const room = W.room(p.x, p.y); add('mn' + p.id, 'ALARM', 'MANUAL STATION OPERATED - ' + (room ? room.name : 'outdoors'), p); }
  // system valves: waterflow, air, release solenoid
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = S.sysd.info.get(id); if (!v) continue;
    const nm = DI.sysName(S, id);
    if (s.alarm) add('wf' + id, 'ALARM', 'WATERFLOW - ' + nm, v);
    if (v.type !== 'wetv') {
      if (s.lowAir && s.state === 'dry') add('la' + id, 'SUPV', 'LOW AIR - ' + nm + ' (' + DI.fmt(s.P) + ' psi)', v);
      if (s.state === 'dry' && s.P > v.p.hiAir) add('ha' + id, 'SUPV', 'HIGH AIR - ' + nm + ' (' + DI.fmt(s.P) + ' psi)', v);
    }
    if (v.type === 'prev') {
      const pn = W.panelOf(id);
      // Panel failure never releases water. The solenoid is energize-to-release: with no panel, or a
      // panel that has exhausted its standby battery, the detection leg drops out and stays out.
      // Recovery is the mechanical emergency release at the trim, by a person.
      // v.p.sol is D latched by the panel (not the solenoid output: that is v.p.solOut, see DI.relState).
      if (!pn || !pn.p.alive) { v.p.sol = false; v.p.pull = false; }
      else for (const w of W.wires) {      // any one releasing-capable detector in the zone is the D leg
        if (w[0] !== pn.id) continue; const d = W.parts.get(w[1]); if (!d) continue;
        const r = W.roomAt[W.k(d.x, d.y)]; if (!r || !inf.rooms.has(r)) continue;
        if (d.p.rel) { if (!v.p.sol) S.say('Releasing panel latched detection (D) for ' + nm + '. Water still needs P.', 'bad'); v.p.sol = true; }
        if (d.type === 'mstn' && d.p.on) v.p.pull = true;
      }
      const rs = DI.relState(W, v);
      if (rs.sol) add('rl' + id, 'ALARM', 'RELEASE CIRCUIT ACTIVE - ' + nm, v);
      if (v.p.pull) add('ms' + id, 'ALARM', (rs.mrz ? 'MANUAL RELEASE ZONE (BYPASSES P)' : 'MANUAL STATION (DETECTION)') + ' - ' + nm, v);
      // A latched P is a release input whose signal class has not been elected: OPEN by default, alarm or
      // trouble if the engineer elects it, never supervisory. Same signal on both trims (PSL-REL and PA-REL).
      if (v.p.pLatch) { const cls = DI.sigClass(W, 'pLatch'); add('pl' + id, cls, (cls === 'OPEN' ? DI.OPEN_LABEL + ': ' : '') + 'P LATCHED (' + DI.trimOf(v).sensor + ') - ' + nm, v); }
      // In a contract the Manual Release zone bypass is never a free setting: it shows as an impairment.
      if (S.contract && DI.stationType(W, v) === 'MANUAL RELEASE') add('im' + id, 'SUPV', 'IMPAIRMENT - Manual Release zone bypasses P (' + nm + ')', v);
    }
  }
  for (const p of W.parts.values()) {
    const q = p.p;
    if (p.type === 'gate' && q.open < 0.8) add('tm' + p.id, 'SUPV', 'VALVE TAMPER - control valve #' + p.id + (q.open < 0.02 ? ' CLOSED' : ' off normal'), p);
    else if (p.type === 'epump' || p.type === 'dpump') {
      const nm = (p.type === 'dpump' ? 'DIESEL' : 'ELECTRIC') + ' FIRE PUMP #' + p.id;
      if (q.spd > 0.5) add('pr' + p.id, 'SUPV', nm + ' RUNNING', p);
      if (q.mode !== 'auto') add('pm' + p.id, 'SUPV', nm + ' CONTROLLER NOT IN AUTO', p);
      if (p.type === 'epump' && !S.powered(p)) add('pp' + p.id, 'SUPV', nm + ' LOSS OF POWER', p);
      if (p.type === 'dpump') { if (q.failed) add('pf' + p.id, 'TRBL', nm + ' FAILED TO START', p); if (q.fuel < 0.667) add('fu' + p.id, 'SUPV', nm + ' LOW FUEL (below 2/3)', p); if (q.batt < 0.5) add('pb' + p.id, 'TRBL', nm + ' BATTERY FAILURE', p); }
    } else if (p.type === 'tank' && q.gal < 0.9 * q.cap) add('tl' + p.id, 'SUPV', 'FIRE WATER TANK LOW LEVEL (' + DI.fmt(100 * q.gal / q.cap) + '%)', p);
    else if (p.type === 'panel' && !W.power) {       // 24 h standby plus alarm is a simplification
      if (q.alive) add('ac' + p.id, 'TRBL', 'PANEL AC FAIL - on standby battery (' + DI.fmt(q.battH, 1) + ' h)', p);
      // ASSUMED simplification: the supervising station sees the loss of a dead panel and reports trouble
      else add('pd' + p.id, 'TRBL', 'PANEL DEAD - battery exhausted (supervising station reports loss of signal)', p, true);
    }
  }
  if (panels.length) for (const room of W.rooms) if (room.temp < 40 && room.type !== 'gen') add('lt' + room.id, 'SUPV', 'LOW TEMPERATURE - ' + room.name + ' (' + DI.fmt(room.temp) + ' F)', panels[0]);
  S.sig = sig;
  // fire department
  const fd = S.fd; let monAlarm = false;
  for (const o of sig.values()) if (o.type === 'ALARM' && o.mon && !o.sup && !o.test) monAlarm = true;
  const live = S.live || (S.drill && !S.drill.done);        // while the site is under construction nothing is transmitted
  if (live && fd.called < 0 && (S.fires.length || !S.fd.log || S.t - S.fd.log.t > 1800) && (monAlarm || (S.fires.length && S.fires.some((k) => S.fq[k] > 300) && S.t - S.fireT0 > 900))) {
    fd.called = S.t; fd.log = { t: S.t, auto: monAlarm }; S.say(monAlarm ? 'Alarm transmitted. Fire department dispatched.' : 'A passer-by called 911. Fire department dispatched (late).', 'warn');
  }
  if (fd.called >= 0 && fd.onScene < 0 && S.t - fd.called > DI.FD_TRAVEL) {
    fd.onScene = S.t; const fdc = W.byType('fdc');
    for (const f of fdc) f.p.active = true;
    S.say('Fire department on scene' + (fdc.length ? ', pumping the FDC at 150 psi.' : '. No FDC to connect to.'), 'warn');
  }
  if (fd.onScene >= 0 && !S.fires.length && (S.outFlow || 0) < 1 && S.t - Math.max(S.fireOutT || 0, fd.onScene) > 300) {
    for (const f of W.byType('fdc')) f.p.active = false; fd.called = -1; fd.onScene = -1; S.say('Fire department has cleared the scene.', '');
  }
  // dispatched technician
  if (S.tech && S.t >= S.tech.at) {
    const r = S.tech.room; S.tech = null; let inc = 0, flam = 0;
    for (const k of S.fires) if (W.roomAt[k] === r) { if (S.fi[k] > 0) inc++; else flam++; }
    if (flam) S.say('Technician reports OPEN FLAME and is evacuating.', 'bad');
    else if (inc) { for (const k of S.fires) if (W.roomAt[k] === r) { S.fi[k] = 0; S.fq[k] = 0; } S.fires = S.fires.filter((k) => W.roomAt[k] !== r); S.fireOutT = S.t;
      S.say('Technician found an overheating power supply and pulled it. No flame, no discharge.', 'good'); DI.bus.emit('fireout'); }
    else S.say('Technician found nothing abnormal.', '');
  }
};

DI.sendTech = function (S, roomId) { if (S.tech) return 'A technician is already on the way.'; S.tech = { room: roomId, at: S.t + 75 }; S.say('Technician dispatched to ' + S.W.rooms[roomId - 1].name + ' (about 75 s).', ''); return ''; };

// Panel reset: clears the panel's own latches, then the next tick re-reads every input, so a live input
// comes straight back. On an electric / electric trim P is a panel latch (PSL-REL) and clears here; if the
// pipe is still below P trip it latches again at once. On an electric / pneumatic trim P sits at the
// actuator and a panel reset cannot clear it (DI.resetTrimP). A panel reset never closes a tripped valve.
DI.panelReset = function (S, panelId) {
  const W = S.W, pn = W.parts.get(panelId); let held = 0, atTrim = 0;
  for (const w of W.wires) {
    if (w[0] !== panelId) continue; const d = W.parts.get(w[1]); if (!d) continue;
    if (d.type === 'vesda' || d.type === 'smoke') { if ((d.p.live || 0) >= (d.type === 'vesda' ? DI.FIRE1 : 1)) held++; d.p.lvl = d.p.live || 0; d.p.rel = false; }
    if (d.type === 'mstn' && d.p.on) held++;
    if (d.type === 'prev') {
      d.p.sol = false; d.p.pull = false;
      if (d.p.trim === 'el-el') d.p.pLatch = false; else if (d.p.pLatch) atTrim++;
      S.act('reset-panel', d.id);
    }
  }
  if (pn) pn.p.silenced = false;
  S.say((held ? 'Panel reset, but ' + held + ' detector(s) or manual station(s) are still in alarm.' : 'Panel reset.' + (atTrim ? '' : ' Normal.')) +
    (atTrim ? ' P is still latched at the actuator of ' + atTrim + ' electric / pneumatic valve(s): reset it at the trim.' : ''), held || atTrim ? 'warn' : 'good');
};
// Silence: acknowledges the signals at the panel. Nothing is reset and nothing clears; a new signal resounds.
DI.silence = function (S, panelId) {
  const pn = S.W.parts.get(panelId); if (!pn || pn.type !== 'panel') return 'No panel.';
  pn.p.silenced = true; S.act('silence', panelId); S.say('Panel silenced. Signals stay on the annunciator until they clear.', '');
  return '';
};
// The operator has found an operated or broken head (selecting its tile in the UI).
DI.findHead = function (S, k) {
  const sid = S.sysd.tileSys[k]; if (!(S.W.spk[k] >= 2) || !sid) return false;
  if (!S.acts.some((a) => a.kind === 'find-head' && a.k === k && S.t - a.t < 5)) S.act('find-head', sid, { k });
  return true;
};

// ---------- recovery score (Fire Tutor): the eight steps after an incident on a preaction system, in order.
// A step that does not apply counts as done: no operated head, no panel, no control valve, or an electric /
// electric trim (P is reset at the panel there, so there is no actuator to reset at the trim).
// A panel or trim reset counts only once the air is back: an earlier one relatches P and scores nothing.
DI.RECOVERY = [['silence', 'Silence the panel'], ['find-head', 'Find the operated head'], ['close-valve', 'Close the control valve'], ['drain', 'Open the system drain'],
  ['replace-head', 'Replace the head with a matching one'], ['restore-air', 'Restore air / nitrogen'], ['reset-trim', 'Reset the actuator at the trim'], ['reset-panel', 'Reset the panel']];
DI.RECOVERY_TARGET = 660;      // ASSUMED: time bonus target for contract 5, seconds from the incident to the last step
// Score the latest incident on system `id`, or the first one at or after sim time `from`.
DI.recoveryScore = function (S, id, from) {
  const W = S.W, v = W.parts.get(id), A = S.acts; if (!v || v.type !== 'prev') return null;
  const isInc = (a) => a.kind === 'incident' && a.id === id; let i0 = -1;
  if (from !== undefined) i0 = A.findIndex((a) => isInc(a) && a.t >= from); else for (let i = A.length - 1; i >= 0; i--) if (isInc(A[i])) { i0 = i; break; }
  if (i0 < 0) return null;
  let i1 = A.length; for (let i = i0 + 1; i < A.length; i++) if (isInc(A[i])) { i1 = i; break; }
  const win = A.slice(i0, i1), t0 = A[i0].t, pn = W.panelOf(id), gate = DI.ctrlValve(W, id);
  const first = (kind, pid, after) => win.find((a) => a.kind === kind && a.id === pid && (after === undefined || a.t >= after));
  const heads = win.some((a) => a.kind === 'head-open' && a.id === id), air = first('restore-air', id);
  const steps = DI.RECOVERY.map(([kind, label]) => {
    let na = false, a = null;
    if (kind === 'silence') { na = !pn; a = pn && first(kind, pn.id); }
    else if (kind === 'find-head' || kind === 'replace-head') { na = !heads; a = first(kind, id); }
    else if (kind === 'close-valve') { na = !gate; a = gate && first(kind, gate.id); }
    else if (kind === 'reset-trim') { na = v.p.trim !== 'el-pn'; a = air && first(kind, id, air.t); }
    else if (kind === 'reset-panel') { na = !pn; a = air && first(kind, id, air.t); }
    else a = first(kind, id);
    return { kind, label, na, done: na || !!a, t: !na && a ? a.t : null };
  });
  let inOrder = true, last = -Infinity;
  for (const st of steps) if (st.t !== null) { if (st.t < last) inOrder = false; last = Math.max(last, st.t); }
  const done = steps.filter((st) => st.done).length, complete = done === steps.length;
  return { id, t0, why: A[i0].why, steps, done, total: steps.length, complete, inOrder, closed: win.some((a) => a.kind === 'in-service' && a.id === id),
    time: complete ? Math.max(t0, last) - t0 : null };
};
