// Detection, the releasing panel, supervisory / alarm / trouble signals and the fire department.
// A device only reaches the panel (and the outside world) if the player wired it there.
var DI = globalThis.DI || (globalThis.DI = {});

// Aspirating detection stages. The four thresholds (%/ft obscuration) are a site setting (W.cfg.detThr); these
// defaults are owner-set example values inside the listed range of the detector model (DI.asdRange), ASSUMED and
// NEEDS PE REVIEW: the datasheets print setting ranges, not defaults.
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
// a listed bound as the datasheet prints it (0.0030, not 0.003)
DI.asdFmt = (x) => (typeof x === 'number' && x > 0 && x < 0.01 ? x.toFixed(4) : String(x));
// One range finding per aspirating stage that sits outside the listed range of the site's detector model.
DI.asdFindings = function (W) {
  const t = DI.detThr(W), R = DI.asdRange(W), M = DI.ASD_MODELS[DI.asdModel(W)], f = DI.asdFmt, out = [];
  DI.ASD_STAGES.forEach(([, name], i) => { if (!(t[i] >= R[i][0] && t[i] <= R[i][1])) out.push({ stage: i, text: 'Aspirating ' + name + ' threshold ' + t[i] + ' %/ft is outside the listed range of the ' + M.label + ' (' + f(R[i][0]) + ' to ' + f(R[i][1]) + ' %/ft) ' + DI.ASD_SRC + '.', ref: M.doc + '; NFPA 72 Ch. 14 (ITM)' }); });
  return out;
};
// NFPA 76, where the site has adopted it: plain ceilings. Alert at 0.2 %/ft or less, and the alarm ceiling of
// 1.0 %/ft applied to Fire 1, the first alarm stage (FA Lead). Action stays pre-alarm and Fire 2 has no NFPA 76
// limit. PRACTICE, NEEDS PE REVIEW. Nothing is elected and nothing is written: the ceilings only check.
DI.N76_REF = 'NFPA 76-2024 §8.5.3.1.2.5';
// The NFPA 76 findings for this site: [{ code, sev, text }], empty unless NFPA 76 is adopted and a ceiling is exceeded. Pure.
DI.n76Flags = function (W) {
  if (!(W && W.cfg && W.cfg.nfpa76Adopted)) return [];
  const P = DI.PRESETS.nfpa76, t = DI.detThr(W), out = [];
  if (t[0] > P.alert) out.push({ code: 'N76_ALERT_OVER', sev: 'fail', text: 'NFPA 76 is adopted on this site: Alert must be ' + P.alert + ' %/ft or less (it is ' + t[0] + ').' });
  if (t[2] > P.alarm) out.push({ code: 'N76_ALARM_OVER', sev: 'fail', text: 'NFPA 76 is adopted on this site: Fire 1, the first alarm stage, must be ' + P.alarm.toFixed(1) + ' %/ft or less (it is ' + t[2] + '). PRACTICE, NEEDS PE REVIEW.' });
  return out;
};
// The note shown where NFPA 76 is adopted and the listing of the site's detector model is the tighter limit on
// Fire 1 (true of both models in the table), so the NFPA 76 alarm ceiling can never bind. '' otherwise.
DI.n76Note = function (W) {
  if (!(W && W.cfg && W.cfg.nfpa76Adopted)) return '';
  const P = DI.PRESETS.nfpa76, M = DI.ASD_MODELS[DI.asdModel(W)], max = M.range.fire1[1];
  return max < P.alarm ? 'NFPA 76 ceilings: Alert ' + P.alert + ', Fire 1 ' + P.alarm.toFixed(1) + ' %/ft. The ' + M.label + ' listing (Fire 1 maximum ' + DI.asdFmt(max) + ') is tighter, so the listing binds first. [PRACTICE, NEEDS PE REVIEW].' : '';
};
// "Check against NFPA 76": reads the site thresholds against the two ceilings and says so. It writes nothing.
DI.n76Check = function (W) {
  if (!(W && W.cfg && W.cfg.nfpa76Adopted)) return 'NFPA 76 is not adopted on this site.';
  const P = DI.PRESETS.nfpa76, t = DI.detThr(W), yn = (ok) => (ok ? 'yes' : 'no');
  return 'NFPA 76 check: Alert ' + t[0] + ' (meets ' + P.alert + ': ' + yn(t[0] <= P.alert) + '), Fire 1 ' + t[2] + ' (meets ' + P.alarm.toFixed(1) + ': ' + yn(t[2] <= P.alarm) + ').';
};
DI.PANEL_DEAD_MSG = 'The panel is dead: no power, no display. Nothing can be reset or silenced. Restore power, or use the mechanical emergency release at the trim.';
DI.FD_TRAVEL = 420;                       // seconds from dispatch to water on the FDC

DI.alarmStep = function (S, dt) {
  const W = S.W, old = S.sig, sig = new Map();
  const panels = W.byType('panel');
  const H = DI.PANEL_STANDBY_H;
  for (const p of panels) {
    if (p.p.battH === undefined) p.p.battH = H;
    if (W.power) p.p.battH = Math.min(H, p.p.battH + dt / 3600 * 0.5); else p.p.battH = Math.max(0, p.p.battH - dt / 3600);
    p.p.alive = W.power || p.p.battH > 0;
    // deadT: when the panel died. The supervising station learns of it one supervision interval later (DI.commDelay).
    if (p.p.alive) { if (p.p.deadT !== undefined) delete p.p.deadT; } else if (!(p.p.deadT >= 0)) p.p.deadT = S.t;
  }
  // lost = the supervising station reports the loss of the panel itself (the panel can no longer send anything).
  // dark = the signal belongs to a dead panel: nothing is displayed, sounded or transmitted.
  // mon  = wired to a live panel: it will be transmitted.  delay = seconds the transmission is held back (AC failure).
  // tx   = the supervising station has it: monitored, and the delay has run since the signal first appeared.
  const add = (key, type, text, part, lost, delay) => {
    const pn = part ? (part.type === 'panel' ? part : W.panelOf(part.id)) : null;
    const prev = old.get(key), dark = !lost && !!pn && !pn.p.alive, t0 = prev ? prev.t0 : S.t, dl = delay || 0, mon = !!lost || !!(pn && pn.p.alive);
    const o = { key, type, text, part: part ? part.id : 0, mon, lost: !!lost, dark, t0, delay: dl, tx: mon && S.t - t0 >= dl, test: prev ? prev.test : S.procs.length > 0 || S.t < (S.testUntil || 0) };
    sig.set(key, o);
    if (dl > 0 && o.tx && prev && !prev.tx) S.say('Supervising station notified: ' + text, 'warn');
    if (!prev && pn && !dark) pn.p.silenced = false;          // a new signal resounds a silenced panel
    if (!prev) { DI.bus.emit('signal', o); S.say(type + ': ' + text + (o.test ? '  [system on test: monitoring company notified]' : o.mon ? '' : dark ? '  [panel dead: not displayed, not transmitted]' : '  [local only - not wired to a panel]'), type === 'ALARM' ? 'bad' : 'warn'); }
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
      for (let i = 1; i <= p.p.lvl; i++) { add('v' + p.id + '.' + i, DI.inClass(W, DI.ASD_STAGES[i - 1][0]), 'VESDA ' + DI.VESDA_N[i] + ' - ' + rn, p); if (i < p.p.lvl) sig.get('v' + p.id + '.' + i).sup = true; }
      p.p.rel = p.p.lvl >= DI.FIRE1;
    } else {
      if (p.p.lvl >= 1) add('s' + p.id, 'ALARM', 'SMOKE DETECTION - ' + rn, p);
      p.p.rel = p.p.lvl >= 1 && DI.canRelease(W, p);
    }
  }
  // manual release stations: a wired device on the releasing panel. Operated, it is an alarm and the manual
  // input of every preaction valve on that panel that protects the room it is in (handled per valve below).
  for (const p of W.byType('mstn')) if (p.p.on) { const room = W.room(p.x, p.y); add('mn' + p.id, DI.inClass(W, 'manual'), 'MANUAL STATION OPERATED - ' + (room ? room.name : 'outdoors'), p); }
  // system valves: waterflow, air, release solenoid
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = S.sysd.info.get(id); if (!v) continue;
    const nm = DI.sysName(S, id);
    if (s.alarm) add('wf' + id, DI.inClass(W, 'waterflow'), 'WATERFLOW - ' + nm, v);
    if (v.type !== 'wetv') {
      if (s.lowAir && s.state === 'dry') add('la' + id, DI.inClass(W, 'lowAir'), 'LOW AIR - ' + nm + ' (' + DI.fmt(s.P) + ' psi)', v);
      if (s.state === 'dry' && s.P > v.p.hiAir) add('ha' + id, DI.inClass(W, 'highAir'), 'HIGH AIR - ' + nm + ' (' + DI.fmt(s.P) + ' psi)', v);
      // Loss of supply air: every air / N2 source on the zone's tubing is unpowered or faulted. A trouble of its
      // own beside the pressure supervisory (TRBL, PRACTICE: equipment trouble). Shutting the zone's own supply
      // valve is a deliberate isolation and does not raise it (it shows as an impairment tag, DI.impairments);
      // nor does a 24 h air test.
      if (inf.src.length && !S.procs.some((q) => q.kind === 'leak' && q.id === id) && inf.src.every((sid) => { const c = W.parts.get(sid); return !c || c.p.fault || !S.powered(c); }))
        add('sa' + id, DI.inClass(W, 'supplyAir'), 'LOSS OF SUPPLY AIR - ' + nm + ' (compressor / N2 source unavailable)', v);
    }
    if (v.type === 'prev') {
      const pn = W.panelOf(id);
      // Panel failure never releases water. The solenoid is energize-to-release: with no panel, or a
      // panel that has exhausted its standby battery, the detection leg drops out and stays out.
      // Recovery is the mechanical emergency release at the trim, by a person.
      // v.p.sol is D latched by the panel (not the solenoid output: that is v.p.solOut, see DI.relState).
      // The Manual Release zone (v.p.mrzL) exists only where the 9(c) flag is ON on an electric / electric trim:
      // anywhere else it is forced off every tick. It is a panel latch too, so a dead panel holds none.
      const mr = DI.stationType(W, v) === 'MANUAL RELEASE';
      if (!pn || !pn.p.alive) { v.p.sol = false; v.p.pull = false; v.p.mrzL = false; }
      else {
        if (!mr) v.p.mrzL = false;
        for (const w of W.wires) {      // any one releasing-capable detector in the zone is the D leg
          if (w[0] !== pn.id) continue; const d = W.parts.get(w[1]); if (!d) continue;
          const r = W.roomAt[W.k(d.x, d.y)]; if (!r || !inf.rooms.has(r)) continue;
          if (d.p.rel) { if (!v.p.sol) S.say('Releasing panel latched detection (D) for ' + nm + '. Water still needs P.', 'bad'); v.p.sol = true; }
          // a station typed DETECTION latches D; typed MANUAL RELEASE it latches the zone's own release, never D
          if (d.type === 'mstn' && d.p.on) { if (mr) { if (!v.p.mrzL) S.say('Manual Release zone operated for ' + nm + ': it releases without P (9(c) bypass, NEEDS PE REVIEW).', 'bad'); v.p.mrzL = true; } else v.p.pull = true; }
        }
      }
      const rs = DI.relState(W, v);
      if (rs.sol) add('rl' + id, DI.inClass(W, 'release'), 'RELEASE CIRCUIT ACTIVE - ' + nm, v);
      if (v.p.pull || rs.mrz) add('ms' + id, DI.inClass(W, rs.mrz ? 'mrz' : 'manual'), (rs.mrz ? 'MANUAL RELEASE ZONE (BYPASSES P)' : 'MANUAL STATION (DETECTION)') + ' - ' + nm, v);
      // A latched P is a release input whose signal class has not been elected: OPEN by default, alarm or
      // trouble if the engineer elects it, never supervisory. Same signal on both trims (PSL-REL and PA-REL).
      if (v.p.pLatch) { const cls = DI.inClass(W, 'pLatch'); add('pl' + id, cls, (cls === 'OPEN' ? DI.OPEN_LABEL + ': ' : '') + 'P LATCHED (' + DI.trimOf(v).sensor + ') - ' + nm, v); }
      // In a contract the Manual Release zone bypass is never a free setting: it shows as an impairment.
      if (S.contract && DI.stationType(W, v) === 'MANUAL RELEASE') add('im' + id, DI.inClass(W, 'impair'), 'IMPAIRMENT - Manual Release zone bypasses P (' + nm + ')', v);
    }
  }
  for (const p of W.parts.values()) {
    const q = p.p;
    if (p.type === 'gate' && q.open < 0.8) add('tm' + p.id, DI.inClass(W, 'tamper'), 'VALVE TAMPER - control valve #' + p.id + (q.open < 0.02 ? ' CLOSED' : ' off normal'), p);
    else if (p.type === 'epump' || p.type === 'dpump') {
      const nm = (p.type === 'dpump' ? 'DIESEL' : 'ELECTRIC') + ' FIRE PUMP #' + p.id;
      if (q.spd > 0.5) add('pr' + p.id, 'SUPV', nm + ' RUNNING', p);
      if (q.mode !== 'auto') add('pm' + p.id, 'SUPV', nm + ' CONTROLLER NOT IN AUTO', p);
      if (p.type === 'epump' && !S.powered(p)) add('pp' + p.id, 'SUPV', nm + ' LOSS OF POWER', p);
      if (p.type === 'dpump') { if (q.failed) add('pf' + p.id, 'TRBL', nm + ' FAILED TO START', p); if (q.fuel < 0.667) add('fu' + p.id, 'SUPV', nm + ' LOW FUEL (below 2/3)', p); if (q.batt < 0.5) add('pb' + p.id, 'TRBL', nm + ' BATTERY FAILURE', p); }
    } else if (p.type === 'tank' && q.gal < 0.9 * q.cap) add('tl' + p.id, 'SUPV', 'FIRE WATER TANK LOW LEVEL (' + DI.fmt(100 * q.gal / q.cap) + '%)', p);
    else if (p.type === 'panel') {       // 24 h standby plus alarm is a simplification
      if (q.alive) {
        // Both show at the panel at once (inside the 200 s ceiling, DI.TROUBLE_PANEL_S). The AC failure is
        // transmitted only after the site's delay (DI.acDelay, 60 to 180 min): power back inside it, nothing is
        // sent. Low battery is the listed voltage setpoint (DI.lowBattH) and is transmitted at once (ASSUMED).
        if (!W.power) add('ac' + p.id, DI.inClass(W, 'acFail'), 'PANEL AC FAIL - on standby battery (' + DI.fmt(q.battH, 1) + ' h)', p, false, DI.acDelay(W));
        if (q.battH <= DI.lowBattH()) add('lb' + p.id, DI.inClass(W, 'lowBatt'), 'LOW BATTERY - panel #' + p.id + ' (battery below its listed low-voltage setpoint)' + (W.power ? ' (charging)' : ''), p);
      }
      // The dead panel itself shows and sends nothing. The supervising station annunciates the loss of the path
      // only after its supervision interval (DI.commDelay: 60 min on a single IP path): this signal is that event.
      else if (S.t - q.deadT >= DI.commDelay(W)) add('pd' + p.id, DI.inClass(W, 'lostComm'), 'LOSS OF COMMUNICATION - panel #' + p.id + ' (no signal, supervising station reports trouble)', p, true);
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
// It also clears the Manual Release zone latch; a station that is still operated latches it again.
// A dead panel cannot be reset or silenced: the message comes back, nothing changes and nothing is logged.
DI.panelReset = function (S, panelId) {
  const W = S.W, pn = W.parts.get(panelId); let held = 0, atTrim = 0;
  if (pn && pn.p.alive === false) return DI.PANEL_DEAD_MSG;
  for (const w of W.wires) {
    if (w[0] !== panelId) continue; const d = W.parts.get(w[1]); if (!d) continue;
    if (d.type === 'vesda' || d.type === 'smoke') { if ((d.p.live || 0) >= (d.type === 'vesda' ? DI.FIRE1 : 1)) held++; d.p.lvl = d.p.live || 0; d.p.rel = false; }
    if (d.type === 'mstn' && d.p.on) held++;
    if (d.type === 'prev') {
      const det = !!(d.p.sol || d.p.pull || d.p.mrzL);            // reset #1 of a recovery: D or the zone was latched
      d.p.sol = false; d.p.pull = false; d.p.mrzL = false;
      if (d.p.trim === 'el-el') d.p.pLatch = false; else if (d.p.pLatch) atTrim++;
      S.act('reset-panel', d.id, det ? { det: true } : null);
    }
  }
  if (pn) pn.p.silenced = false;
  S.say((held ? 'Panel reset, but ' + held + ' detector(s) or manual station(s) are still in alarm.' : 'Panel reset.' + (atTrim ? '' : ' Normal.')) +
    (atTrim ? ' P is still latched at the actuator of ' + atTrim + ' electric / pneumatic valve(s): reset it at the trim.' : ''), held || atTrim ? 'warn' : 'good');
  return '';
};
// Silence: acknowledges the signals at the panel. Nothing is reset and nothing clears; a new signal resounds.
DI.silence = function (S, panelId) {
  const pn = S.W.parts.get(panelId); if (!pn || pn.type !== 'panel') return 'No panel.';
  if (pn.p.alive === false) return DI.PANEL_DEAD_MSG;
  pn.p.silenced = true; S.act('silence', panelId); S.say('Panel silenced. Signals stay on the annunciator until they clear.', '');
  return '';
};
// Is this signal silenced? Only by the panel that owns it: silencing one panel never quiets another panel's
// signals, and a signal that reaches no panel (local only) cannot be silenced at all.
DI.sigSilenced = function (W, o) {
  const p = W.parts.get(o.part), pn = p ? (p.type === 'panel' ? p : W.panelOf(p.id)) : null;
  return !!(pn && pn.p.silenced);
};
// Impairment tags: things a person has tagged at the riser, not signals. One entry for each dry or preaction
// valve with an air / N2 source whose own supply valve is shut, except while a 24 h air test isolates it on
// purpose. Display only: nothing here is added to S.sig, transmitted or sounded, and it shows with a dead panel.
// The low-air supervisory stays a pressure signal: it comes in only when the gauge actually falls.
DI.impairments = function (S) {
  const W = S.W, out = [];
  for (const [id] of S.ss) {
    const v = W.parts.get(id), inf = S.sysd.info.get(id);
    if (!v || v.type === 'wetv' || !inf || !inf.src.length || v.p.airValve) continue;
    if (S.procs.some((q) => q.kind === 'leak' && q.id === id)) continue;
    out.push({ key: 'air-isolated:' + id, id, text: 'IMPAIRMENT - Air / N2 supply isolated: ' + DI.sysName(S, id) + '. The zone cannot hold or refill air. Restore the supply.' });
  }
  return out;
};
// The operator has found an operated or broken head (selecting its tile in the UI).
DI.findHead = function (S, k) {
  const sid = S.sysd.tileSys[k]; if (!(S.W.spk[k] >= 2) || !sid) return false;
  if (!S.acts.some((a) => a.kind === 'find-head' && a.k === k && S.t - a.t < 5)) S.act('find-head', sid, { k });
  return true;
};

// ---------- recovery score: the thirteen steps after an incident on a preaction system, in the physical order
// the FP Lead confirmed as generic practice (the maker's IOM governs specifics), with the Fire Tutor's visible
// first panel reset. A step that does not apply counts as done. Each row: [kind, label].
//   6  panel reset #1 is a reset made while D or the Manual Release zone was latched (the riser reset is
//      refused until it drops out). Not applicable when nothing was latched in this incident.
//   8  the riser reset applies only when the valve tripped, and comes while the drain is still open.
//   9  the scored drain close is the one after the confirmed drain (step 5).
//   10 air is restored when the gauge is back at normal with the supply open and every opening shut; the
//      step is timed from the moment the supply was reopened, so reopening it too early scores out of order.
//   11, 12 count only once the air is back: an earlier reset latches P again and scores nothing.
//   13 the control valve is reopened through the reopen gate (DI.setGate), with the valve back in service.
// A panel step is not applicable with no panel, or while the panel is dead now.
DI.RECOVERY = [['silence', 'Silence the panel'], ['find-head', 'Find the operated head'], ['close-valve', 'Close the zone control valve (supervisory)'],
  ['isolate-air', 'Isolate the air / N₂ supply'], ['drain-zero', 'Open the drain; confirm 0 psi and no water'], ['reset-panel-1', 'Panel reset #1: clear D, solenoid off'],
  ['replace-head', 'Replace the head: same type, K, temperature, response'], ['reset-valve', 'Reset the DI valve (clapper) at the riser, drain still open'], ['drain-close', 'Close the drain(s)'],
  ['restore-air', 'Restore air / N₂ and confirm it holds above low air'], ['reset-trim', 'Reset the trim (electric / pneumatic only)'], ['reset-panel', 'Panel reset #2: clear P and troubles'],
  ['open-valve', 'Slowly open the control valve fully; confirm no flow, all normal']];
DI.RECOVERY_TARGET = 300;      // ASSUMED: time bonus target for contract 5, seconds of operator-step time (total time less the air refill)
// Score the latest incident on system `id`, or the first one at or after sim time `from`.
// time   = first step to last, the whole recovery (null while incomplete).
// refill = the part of it the zone spent closed up and filling, with nothing left for the operator to do: from the
//          later of the last supply-open, the drain-close and (after a trip) the riser reset, up to restore-air.
//          0 when there is no air step. It is compressor time, judged on its own against DI.REFILL_LIMIT.
// opTime = time - refill: the operator's own steps. The contract 5 bonus reads this, never the refill.
DI.recoveryScore = function (S, id, from) {
  const W = S.W, v = W.parts.get(id), A = S.acts; if (!v || v.type !== 'prev') return null;
  const isInc = (a) => a.kind === 'incident' && a.id === id; let i0 = -1;
  if (from !== undefined) i0 = A.findIndex((a) => isInc(a) && a.t >= from); else for (let i = A.length - 1; i >= 0; i--) if (isInc(A[i])) { i0 = i; break; }
  if (i0 < 0) return null;
  let i1 = A.length; for (let i = i0 + 1; i < A.length; i++) if (isInc(A[i])) { i1 = i; break; }
  const win = A.slice(i0, i1), t0 = A[i0].t, pn = W.panelOf(id), live = !!pn && pn.p.alive !== false, gate = DI.ctrlValve(W, id), inf = S.sysd.info.get(id);
  // The incident proper runs from its opening entry to "in service". What it involved (a head, a trip, a
  // latched D) and steps 1 to 10 are read from that part only, so a later false alarm on a zone that is already
  // back does not rewrite the score. The closing steps (trim, panel reset #2, control valve) may follow it.
  const iSvc = win.findIndex((a) => a.kind === 'in-service' && a.id === id), core = iSvc >= 0 ? win.slice(0, iSvc + 1) : win, svc = iSvc >= 0 ? win[iSvc] : null;
  const find = (list, kind, pid, after, test) => list.find((a) => a.kind === kind && a.id === pid && (after === undefined || a.t >= after) && (!test || test(a)));
  const first = (kind, pid, after, test) => find(core, kind, pid, after, test), late = (kind, pid, after, test) => find(win, kind, pid, after, test);
  const has = (kind) => core.some((a) => a.kind === kind && a.id === id);
  const heads = has('head-open'), tripped = has('trip'), det = !!A[i0].det || has('det-latch');
  const iso = first('isolate-air', id), dz = first('drain-zero', id), air = first('restore-air', id);
  const steps = DI.RECOVERY.map(([kind, label]) => {
    let na = false, a = null, t;
    if (kind === 'silence') { na = !live; a = pn && first(kind, pn.id); }
    else if (kind === 'find-head' || kind === 'replace-head') { na = !heads; a = first(kind, id); }
    else if (kind === 'close-valve') { na = !gate; a = gate && first(kind, gate.id); }
    else if (kind === 'isolate-air') { na = !inf || !inf.src.length; a = iso; }
    else if (kind === 'drain-zero') a = dz;
    else if (kind === 'reset-panel-1') { na = !det || !live; a = first('reset-panel', id, undefined, (q) => q.det); }
    else if (kind === 'reset-valve') { na = !tripped; a = first(kind, id); }
    else if (kind === 'drain-close') a = dz && first(kind, id, dz.t);
    else if (kind === 'restore-air') { a = air; const so = air && iso && first('supply-open', id, iso.t); if (so) t = Math.min(so.t, air.t); }
    else if (kind === 'reset-trim') { na = v.p.trim !== 'el-pn'; a = air && late(kind, id, air.t); }
    else if (kind === 'reset-panel') { na = !live; a = air && late(kind, id, air.t); }
    else if (kind === 'open-valve') { na = !gate; a = gate && svc && late(kind, gate.id, svc.t, (q) => !(q.flow > 1)); }
    return { kind, label, na, done: na || !!a, t: !na && a ? (t !== undefined ? t : a.t) : null };
  });
  let inOrder = true, last = -Infinity;
  for (const st of steps) if (st.t !== null) { if (st.t < last) inOrder = false; last = Math.max(last, st.t); }
  const done = steps.filter((st) => st.done).length, complete = done === steps.length;
  let refill = 0;
  if (air) {
    const lastOf = (kind) => { let r = null; for (const q of core) if (q.kind === kind && q.id === id && q.t <= air.t) r = q; return r; };
    const from = [lastOf('supply-open'), lastOf('drain-close'), tripped ? lastOf('reset-valve') : null].filter(Boolean).map((q) => q.t);
    if (from.length) refill = Math.max(0, air.t - Math.max(...from));
  }
  const time = complete ? Math.max(t0, last) - t0 : null;
  return { id, t0, why: A[i0].why, steps, done, total: steps.length, complete, inOrder, tripped, det, closed: !!svc,
    time, refill, air: !!air, opTime: time !== null ? Math.max(0, time - refill) : null };
};
