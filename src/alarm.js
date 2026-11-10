// Detection, the releasing panel, supervisory / alarm / trouble signals and the fire department.
// A device only reaches the panel (and the outside world) if the player wired it there.
var DI = globalThis.DI || (globalThis.DI = {});

// Aspirating detection stages. Thresholds are example values (smoke units ~ %/ft obscuration) and are a
// site setting (W.cfg.detThr); these are the defaults.
//   Alert  = supervisory only, never arms a release.
//   Action = pre-alarm annunciation: no release, no dispatch (signal class NEEDS PE REVIEW; supervisory here).
//   Fire 1 = alarm, and the detection leg (D) of the double interlock.
//   Fire 2 = escalation only. It is never read as a release input. Stage levels latch upward, so a
//            reading that jumps straight to Fire 2 has already crossed Fire 1.
DI.VESDA_T = [0.03, 0.06, 0.12, 1.2];
DI.VESDA_N = ['', 'ALERT', 'ACTION', 'FIRE 1', 'FIRE 2'];
DI.FIRE1 = 3;                             // the stage that releases
// Spot detector alarm threshold (example value). One listed detector in alarm is enough where the room
// type allows release (DI.ROOMS[..].spotRelease); no two-detector confirmation is modelled.
DI.SPOT_T = [1.3];
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
  const add = (key, type, text, part) => {
    const pn = part ? (part.type === 'panel' ? part : W.panelOf(part.id)) : null;
    const prev = old.get(key);
    const o = { key, type, text, part: part ? part.id : 0, mon: !!(pn && pn.p.alive), t0: prev ? prev.t0 : S.t, test: prev ? prev.test : S.procs.length > 0 || S.t < (S.testUntil || 0) };
    sig.set(key, o);
    if (!prev) { DI.bus.emit('signal', o); S.say(type + ': ' + text + (o.test ? '  [system on test: monitoring company notified]' : o.mon ? '' : '  [local only - not wired to a panel]'), type === 'ALARM' ? 'bad' : 'warn'); }
  };
  // detection
  for (const p of W.parts.values()) {
    if (p.type !== 'vesda' && p.type !== 'smoke') continue;
    const room = W.room(p.x, p.y), L = room ? S.smoke[room.id] : 0, T = p.type === 'vesda' ? DI.detThr(W) : DI.SPOT_T;
    let lvl = 0; while (lvl < T.length && L >= T[lvl]) lvl++;
    p.p.obs = L; if (lvl > p.p.lvl) p.p.lvl = lvl; p.p.live = lvl;
    const dpn = W.panelOf(p.id); if (dpn && !dpn.p.alive) p.p.lvl = lvl;      // a dead panel holds no latches: only a live reading counts when it comes back
    const rn = room ? room.name : 'outdoors';
    if (p.type === 'vesda') {
      if (p.p.lvl >= 1) add('v' + p.id, p.p.lvl >= DI.FIRE1 ? 'ALARM' : 'SUPV', 'VESDA ' + DI.VESDA_N[p.p.lvl] + ' - ' + rn, p);
      p.p.rel = p.p.lvl >= DI.FIRE1;
    } else {
      if (p.p.lvl >= 1) add('s' + p.id, 'ALARM', 'SMOKE DETECTION - ' + rn, p);
      p.p.rel = p.p.lvl >= 1 && DI.canRelease(W, p);
    }
  }
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
      if (!pn || !pn.p.alive) { v.p.sol = false; v.p.pull = false; }
      else for (const w of W.wires) {      // any one releasing-capable detector in the zone is the D leg
        if (w[0] !== pn.id) continue; const d = W.parts.get(w[1]);
        if (d && d.p.rel) { const r = W.roomAt[W.k(d.x, d.y)]; if (r && inf.rooms.has(r)) { if (!v.p.sol) S.say('Releasing panel energized the solenoid on ' + nm + ' (detection leg). Water still needs P.', 'bad'); v.p.sol = true; } }
      }
      if (v.p.sol) add('rl' + id, 'ALARM', 'RELEASE CIRCUIT ACTIVE - ' + nm, v);
      if (v.p.pull) add('ms' + id, 'ALARM', 'MANUAL STATION (DETECTION) - ' + nm, v);
      // latched P is annunciated until someone resets it (signal class NEEDS PE REVIEW; supervisory here)
      if (v.p.pLatch) add('pl' + id, 'SUPV', 'P LATCHED (' + DI.trimOf(v).sensor + ') - ' + nm, v);
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
    else if (p.type === 'panel' && !W.power) add('ac' + p.id, 'TRBL', q.alive ? 'PANEL AC FAIL - on standby battery (' + DI.fmt(q.battH, 1) + ' h)' : 'PANEL DEAD - battery exhausted', p);   // 24 h standby plus alarm is a simplification
  }
  if (panels.length) for (const room of W.rooms) if (room.temp < 40 && room.type !== 'gen') add('lt' + room.id, 'SUPV', 'LOW TEMPERATURE - ' + room.name + ' (' + DI.fmt(room.temp) + ' F)', panels[0]);
  S.sig = sig;
  // fire department
  const fd = S.fd; let monAlarm = false;
  for (const o of sig.values()) if (o.type === 'ALARM' && o.mon && !o.test) monAlarm = true;
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

DI.panelReset = function (S, panelId) {
  const W = S.W; let held = 0;
  for (const w of W.wires) {
    if (w[0] !== panelId) continue; const d = W.parts.get(w[1]); if (!d) continue;
    if (d.type === 'vesda' || d.type === 'smoke') { if ((d.p.live || 0) >= (d.type === 'vesda' ? DI.FIRE1 : 1)) held++; d.p.lvl = d.p.live || 0; d.p.rel = false; }
    // Manual reset: detection leg drops out and P unlatches. If the pipe is still below the P trip
    // setpoint it latches again on the next tick. Simplification: both trims clear on a panel reset.
    if (d.type === 'prev') { d.p.sol = false; d.p.pull = false; d.p.pLatch = false; }
  }
  S.say(held ? 'Panel reset, but ' + held + ' detector(s) are still in alarm.' : 'Panel reset. Normal.', held ? 'warn' : 'good');
};
