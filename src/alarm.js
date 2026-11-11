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
  // Generator-backed panel (site option, NFPA 72-2025 only): the generator carries the panel from DI.GEN_START_S
  // after the loss of utility power to DI.GEN_RUN_S (24 h, no fuel model: SIMPLIFICATION). The battery holds meanwhile.
  const genOn = DI.panelGen(W) && !W.power && S.genT >= 0 && S.t - S.genT > DI.GEN_START_S && S.t - S.genT <= DI.GEN_RUN_S;
  for (const p of panels) {
    // H = hours of standby the fitted battery gives on the site's standby basis (DI.panelH). The charger restores a
    // full discharge in DI.RECHARGE_H (48 h) [CODE], so it charges at H / 48 per hour; a failed charger or a
    // disconnected battery does not charge. A disconnected battery carries nothing: the panel dies with the AC.
    const H = DI.panelH(W, p);
    if (p.p.battH === undefined || p.p.battH > H) p.p.battH = H;
    // (the settle of a load is not game time: it neither charges nor drains the battery, see Sim.restore)
    if (S.settling) { /* hold */ } else if (W.power) { if (!p.p.chgFail && !p.p.battDisc) p.p.battH = Math.min(H, p.p.battH + dt / 3600 * H / DI.RECHARGE_H); }
    else if (!genOn && !p.p.battDisc) p.p.battH = Math.max(0, p.p.battH - dt / 3600);
    p.p.onGen = genOn;
    p.p.alive = W.power || genOn || (!p.p.battDisc && p.p.battH > 0);
    // deadT: when the panel died. The supervising station learns of it one supervision interval later (DI.commDelay).
    if (p.p.alive) { if (p.p.deadT !== undefined) delete p.p.deadT; } else if (!(p.p.deadT >= 0)) p.p.deadT = S.t;
  }
  // lost = the supervising station reports the loss of the panel itself (the panel can no longer send anything).
  // dark = the signal belongs to a dead panel: nothing is displayed, sounded or transmitted.
  // mon  = wired to a live panel: it will be transmitted.  delay = seconds the transmission is held back (AC failure,
  //        a failed DACT channel; Infinity = it cannot be sent at all).
  // tx   = the supervising station has it: monitored, and the delay has run since the signal first appeared.
  // reg  = the signal's key in the registry (DI.SIG_FIXED / DI.SIG_CLASS). add() takes that key, never a class: the
  //        class is read here, in one place, with DI.inClass.
  // fd   = an alarm signal of the kind that is sent on to the fire department (DI.SIG_FD). Alert, Action and a
  //        latched P are never fd, whatever class the owner elects for them.
  // cut  = the panel is alive and annunciates the signal, but its path to the supervising station is down: both
  //        DACT channels have failed, so the panel cannot send anything, alarms included. Nothing is transmitted and
  //        the fire department is not dispatched from it. What the station itself reports (lost) is never cut.
  // had  = the supervising station already had this signal before the path went down: nothing is owed for it.
  // q    = the signal's entry in the DACT queue (S.dq, DI.dactStep), where it has one: a signal that came due while
  //        both channels were down. Until that entry is SENT the station does not have the signal (tx false) and
  //        nothing is dispatched from it. Only add() and the dispatch block read it: release, the annunciator
  //        classes, the notification rule and the hooks never do.
  // After a load, S.sigSeen holds the first-seen time of every signal that was active when the game was saved, so
  // a delay clock carries across save and load and nothing is announced twice. It is used once and dropped.
  const dact = DI.commPath(W) === 'dact', chUp = (pn) => (Array.isArray(pn.p.chan) ? (pn.p.chan[0] ? 1 : 0) + (pn.p.chan[1] ? 1 : 0) : 2), pathDown = (pn) => dact && chUp(pn) === 0;
  const add = (key, regKey, text, part, lost, delay) => {
    const pn = part ? (part.type === 'panel' ? part : W.panelOf(part.id)) : null, type = DI.inClass(W, regKey);
    const prev = old.get(key) || (S.sigSeen && S.sigSeen.get(key)), dark = !lost && !!pn && !pn.p.alive, t0 = prev ? prev.t0 : S.t, dl = delay || 0, mon = !!lost || !!(pn && pn.p.alive), cut = !lost && mon && pathDown(pn);
    const q = !lost && mon && S.dq.length ? ((prev && prev.q) || DI.dactFind(S, pn.id, key, t0)) : null;
    const o = { key, reg: regKey, fd: !!DI.SIG_FD[regKey], type, text, part: part ? part.id : 0, mon, lost: !!lost, dark, cut, t0, delay: dl, tx: mon && !cut && (!q || q.state === 'SENT') && S.t - t0 >= dl,
      test: prev ? prev.test : S.procs.length > 0 || S.t < (S.testUntil || 0), had: !!(prev && (prev.had || prev.tx)) };
    if (q) o.q = q;
    sig.set(key, o);
    if (dl > 0 && o.tx && prev && !prev.tx && !q) S.say('Supervising station notified: ' + text, 'warn');
    if (!prev && pn && !dark) pn.p.silenced = false;          // a new signal resounds a silenced panel
    if (!prev) {
      // single-channel failover: with one of the two DACT channels down every signal goes on the other one at once
      const one = dact && !!pn && mon && !lost && !dl && chUp(pn) === 1 ? '  [sent on channel ' + (pn.p.chan[0] ? 1 : 2) + ']' : '';
      DI.bus.emit('signal', o); S.say(type + ': ' + text + (o.test ? '  [system on test: monitoring company notified]' : cut ? '  [both DACT channels down: not transmitted]' : o.mon ? one : dark ? '  [panel dead: not displayed, not transmitted]' : '  [local only - not wired to a panel]'), type === 'ALARM' ? 'bad' : 'warn');
      // the operator log gets one entry per new alarm signal: DI.recoveryScore times "water stopped" from it
      if (type === 'ALARM' && !o.test && !dark && !S.settling) S.act('alarm', o.part);
    }
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
      for (let i = 1; i <= p.p.lvl; i++) { add('v' + p.id + '.' + i, DI.ASD_STAGES[i - 1][0], 'VESDA ' + DI.VESDA_N[i] + ' - ' + rn, p); if (i < p.p.lvl) sig.get('v' + p.id + '.' + i).sup = true; }
      p.p.rel = p.p.lvl >= DI.FIRE1;
    } else {
      if (p.p.lvl >= 1) add('s' + p.id, 'spot', 'SMOKE DETECTION - ' + rn, p);
      p.p.rel = p.p.lvl >= 1 && DI.canRelease(W, p);
    }
  }
  // manual release stations: a wired device on the releasing panel. Operated, it is an alarm and the manual
  // input of every preaction valve on that panel that protects the room it is in (handled per valve below).
  // The point label follows the type the station has on its zone (FA Lead): MANUAL PULL where it is typed DETECTION,
  // MANUAL RELEASE where it is the Manual Release zone. Class and dispatch are the same for both.
  for (const p of W.byType('mstn')) if (p.p.on) {
    const room = W.room(p.x, p.y), z = DI.stationZone(S, p);
    add('mn' + p.id, 'manual', z ? (DI.stationType(W, z) === 'MANUAL RELEASE' ? 'MANUAL RELEASE, ZONE ' : 'MANUAL PULL, ZONE ') + DI.sysName(S, z.id) : 'MANUAL PULL - ' + (room ? room.name : 'outdoors') + ' (no preaction zone)', p);
  }
  // system valves: waterflow, air, release solenoid
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = S.sysd.info.get(id); if (!v) continue;
    const nm = DI.sysName(S, id);
    if (s.alarm) add('wf' + id, 'waterflow', 'WATERFLOW - ' + nm, v);
    if (v.type !== 'wetv') {
      if (s.lowAir && s.state === 'dry') add('la' + id, 'lowAir', 'LOW AIR - ' + nm + ' (' + DI.fmt(s.P) + ' psi)', v);
      if (s.state === 'dry' && s.P > v.p.hiAir) add('ha' + id, 'highAir', 'HIGH AIR - ' + nm + ' (' + DI.fmt(s.P) + ' psi)', v);
      // Loss of supply air: every air / N2 source on the zone's tubing is unpowered or faulted. A trouble of its
      // own beside the pressure supervisory (TRBL, PRACTICE: equipment trouble). Shutting the zone's own supply
      // valve is a deliberate isolation and does not raise it (it shows as an impairment tag, DI.impairments);
      // nor does a 24 h air test.
      if (inf.src.length && !S.procs.some((q) => q.kind === 'leak' && q.id === id) && inf.src.every((sid) => { const c = W.parts.get(sid); return !c || c.p.fault || !S.powered(c); }))
        add('sa' + id, 'supplyAir', 'LOSS OF SUPPLY AIR - ' + nm + ' (compressor / N2 source unavailable)', v);
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
      if (rs.sol) add('rl' + id, 'release', 'RELEASE CIRCUIT ACTIVE - ' + nm, v);
      if (v.p.pull || rs.mrz) add('ms' + id, rs.mrz ? 'mrz' : 'manual', rs.mrz ? 'MANUAL RELEASE, ZONE ' + nm + ' (BYPASSES P)' : 'MANUAL PULL, ZONE ' + nm + ' (DETECTION)', v);
      // A latched P is a release input whose signal class has not been elected: OPEN by default, alarm or
      // trouble if the engineer elects it, never supervisory. Same signal on both trims (PSL-REL and PA-REL).
      if (v.p.pLatch) { const cls = DI.inClass(W, 'pLatch'); add('pl' + id, 'pLatch', (cls === 'OPEN' ? DI.OPEN_LABEL + ': ' : '') + 'P LATCHED (' + DI.trimOf(v).sensor + ') - ' + nm, v); }
      // In a contract the Manual Release zone bypass is never a free setting: it shows as an impairment.
      if (S.contract && DI.stationType(W, v) === 'MANUAL RELEASE') add('im' + id, 'impair', 'IMPAIRMENT - Manual Release zone bypasses P (' + nm + ')', v);
    }
  }
  for (const p of W.parts.values()) {
    const q = p.p;
    if (p.type === 'gate' && q.open < 0.8) add('tm' + p.id, 'tamper', 'VALVE TAMPER - control valve #' + p.id + (q.open < 0.02 ? ' CLOSED' : ' off normal'), p);
    else if (p.type === 'epump' || p.type === 'dpump') {
      const nm = (p.type === 'dpump' ? 'DIESEL' : 'ELECTRIC') + ' FIRE PUMP #' + p.id;
      if (q.spd > 0.5) add('pr' + p.id, 'pumpRun', nm + ' RUNNING', p);
      if (q.mode !== 'auto') add('pm' + p.id, 'pumpMode', nm + ' CONTROLLER NOT IN AUTO', p);
      if (p.type === 'epump' && !S.powered(p)) add('pp' + p.id, 'pumpPower', nm + ' LOSS OF POWER', p);
      if (p.type === 'dpump') { if (q.failed) add('pf' + p.id, 'pumpFail', nm + ' FAILED TO START', p); if (q.fuel < 0.667) add('fu' + p.id, 'pumpFuel', nm + ' LOW FUEL (below 2/3)', p); if (q.batt < 0.5) add('pb' + p.id, 'pumpBatt', nm + ' BATTERY FAILURE', p); }
    } else if (p.type === 'tank' && q.gal < 0.9 * q.cap) add('tl' + p.id, 'tankLow', 'FIRE WATER TANK LOW LEVEL (' + DI.fmt(100 * q.gal / q.cap) + '%)', p);
    else if (p.type === 'panel') {
      if (q.alive) {
        // All show at the panel at once (inside the 200 s ceiling, DI.TROUBLE_PANEL_S). The AC failure is
        // transmitted only after the site's delay (DI.acDelay, 60 to 180 min): power back inside it, nothing is
        // sent. Low battery is the listed voltage setpoint (DI.LOWBATT_V, the same thing as DI.lowBattH hours left)
        // and is transmitted at once (ASSUMED). A charger failure is a trouble [CODE]; a disconnected battery is
        // modelled as a trouble [PRACTICE, not code]. Neither is an input of D or P.
        if (!W.power) add('ac' + p.id, 'acFail', q.onGen ? 'PANEL AC FAIL - on the standby generator (battery held at ' + DI.fmt(q.battH, 1) + ' h)' : 'PANEL AC FAIL - on standby battery (' + DI.fmt(q.battH, 1) + ' h)', p, false, DI.acDelay(W));
        if (!q.battDisc && q.battH <= DI.lowBattH(DI.panelH(W, p))) add('lb' + p.id, 'lowBatt', 'LOW BATTERY - panel #' + p.id + ' (' + DI.LOWBATT_V + ' V listed setpoint, ASSUMED)' + (W.power ? (q.chgFail ? ' (not charging)' : ' (charging)') : ''), p);
        if (q.chgFail) add('cf' + p.id, 'chgFail', 'CHARGER FAILURE - panel #' + p.id + ' (battery not charging)', p);
        if (q.battDisc) add('bd' + p.id, 'battDisc', 'BATTERY DISCONNECTED - panel #' + p.id, p);
        // DACT path only: the two channels (q.chan, 1 = up). One channel down: a trouble at the panel at once, sent on
        // the other channel within 4 minutes (DI.DACT_CHAN_S) [CODE]. Both down: the panel cannot send, so the trouble
        // stays at the panel (delay Infinity) and the supervising station reports a missed test one test interval
        // after the second channel failed (q.chanT; DI.commDelay, the 6 h interval: that annunciation time is ASSUMED).
        // Once a signal has been tried for DI.DACT_TOTAL_S (10 attempts) the panel raises the failure indication at
        // the premises [CODE], and it stays until a channel is back. The queue itself is DI.dactStep.
        const down = DI.commPath(W) === 'dact' && Array.isArray(q.chan) ? (q.chan[0] ? 0 : 1) + (q.chan[1] ? 0 : 1) : 0;
        if (down < 2) { if (q.chanT !== undefined) delete q.chanT; } else if (!(q.chanT >= 0)) q.chanT = S.t;
        if (down === 1) add('dc' + p.id, 'dactChan', 'DACT CHANNEL FAILED - panel #' + p.id + ' (trouble sent on the other channel within ' + DI.delayText(DI.DACT_CHAN_S) + ')', p, false, DI.DACT_CHAN_S);
        else if (down === 2) {
          add('dc' + p.id, 'dactChan', 'DACT CHANNELS FAILED - panel #' + p.id + ' (both channels down: the panel cannot send)', p, false, Infinity);
          const held = S.dq.filter((e) => e.panel === p.id && !e.comm && (e.state === 'RETRY' || e.state === 'HELD') && S.t - e.tq >= DI.DACT_TOTAL_S - 1e-6).length;
          if (held) add('dx' + p.id, 'dactFail', 'DACT TRANSMISSION FAILED - panel #' + p.id + ' (' + DI.DACT_TRIES + ' attempts over ' + DI.DACT_TOTAL_S / 60 + ' min; ' + held + ' signal(s) ' + (DI.dactHold(W) ? 'held' : 'not sent') + ')', p, false, Infinity);
          if (S.t - q.chanT >= DI.commDelay(W)) add('pc' + p.id, 'lostComm', 'LOSS OF COMMUNICATION - panel #' + p.id + ' (both DACT channels down; the supervising station reports a missed test)', p, true);
        }
      }
      // The dead panel itself shows and sends nothing. The supervising station annunciates the loss of the path
      // only after its supervision interval (DI.commDelay: 60 min on a single IP path): this signal is that event.
      else if (S.t - q.deadT >= DI.commDelay(W)) add('pd' + p.id, 'lostComm', 'LOSS OF COMMUNICATION - panel #' + p.id + ' (no signal, supervising station reports trouble)', p, true);
    }
  }
  if (panels.length) for (const room of W.rooms) if (room.temp < 40 && room.type !== 'gen') add('lt' + room.id, 'lowTemp', 'LOW TEMPERATURE - ' + room.name + ' (' + DI.fmt(room.temp) + ' F)', panels[0]);
  S.sig = sig; if (S.sigSeen) S.sigSeen = null;
  // A silenced trouble sounds again by itself after DI.TROUBLE_RESOUND_S (24 h; the code says 24 h or less) while a
  // trouble of that panel is still active. A cleared trouble does not resound; a new signal and a panel reset clear
  // the silence as they always did.
  for (const p of panels) {
    const q = p.p; if (!q.silenced || q.alive === false || !(S.t - q.silT >= DI.TROUBLE_RESOUND_S - 1e-6)) continue;
    let trb = false;
    for (const o of sig.values()) { if (o.type !== 'TRBL' || o.sup || o.dark || o.lost) continue; const d = W.parts.get(o.part), own = d ? (d.type === 'panel' ? d : W.panelOf(d.id)) : null; if (own === p) { trb = true; break; } }
    if (trb) { q.silenced = false; delete q.silT; S.say('Silenced trouble resounded at panel #' + p.id + ' (every 24 h or less, ' + DI.ref72(W).silenceTrouble + ')', 'warn'); }
  }
  // DACT queue: attempts, the held queue and the sends after a channel is back. `late` = an alarm of the dispatch
  // list was sent late on this tick.
  const late = DI.dactStep(S);
  // Fire department: only an alarm signal of the dispatch list (o.fd, DI.SIG_FD). A supervisory or trouble signal goes
  // to the supervising station only, and so does Alert, Action or a latched P that the owner has elected ALARM: they
  // sound the panel and never call the fire department by themselves. A panel whose path is down (o.cut) sends
  // nothing, so its alarms dispatch nobody: the late passer-by call below is all that is left. A signal that was
  // queued in the outage dispatches when its entry is sent, not before, and a held alarm dispatches when it is sent
  // even if it has cleared since: the station cannot know that (NEEDS PE REVIEW).
  const fd = S.fd; let monAlarm = false;
  for (const o of sig.values()) if (o.fd && o.type === 'ALARM' && o.mon && !o.cut && (!o.q || o.q.state === 'SENT') && !o.sup && !o.test) monAlarm = true;
  const live = S.live || (S.drill && !S.drill.done);        // while the site is under construction nothing is transmitted
  const mayCall = live && fd.called < 0 && (S.fires.length || !S.fd.log || S.t - S.fd.log.t > 1800);
  if (mayCall && late) { fd.called = S.t; fd.log = { t: S.t, auto: true, late: true }; S.say('Alarm transmitted (late, held during the DACT outage). Fire department dispatched.', 'warn'); }
  else if (mayCall && (monAlarm || (S.fires.length && S.fires.some((k) => S.fq[k] > 300) && S.t - S.fireT0 > 900))) {
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

// The preaction zone a manual station belongs to: the first preaction valve on its panel that protects its room.
DI.stationZone = function (S, p) {
  const W = S.W, pn = W.panelOf(p.id), r = W.roomAt[W.k(p.x, p.y)]; if (!pn || !r) return null;
  for (const [id, inf] of S.sysd.info) if (inf.type === 'prev' && inf.rooms.has(r) && W.panelOf(id) === pn) return W.parts.get(id);
  return null;
};

// ---------- DACT queue (FA Lead, Cycle 6). S.dq holds one entry for every signal that came due while both channels
// of its panel were down: { id, panel, key, reg, cls, fd, test, text, t0, tq, tClr, state, sentT, n }.
//   t0    the original event time: it never changes, and it is what the late send reports
//   tq    when the attempts started (the event, or the end of its transmission delay, or the start of the outage)
//   tClr  when the signal cleared at the panel, if it did before the entry was sent
//   state RETRY   inside the 10 attempts of 90 s (n = the attempt number) [CODE bounds, count ASSUMED]
//         HELD    the attempts are spent (900 s): the panel shows the failure indication (dx, DI.alarmStep)
//         SENT    sent after a channel came back, at sentT
//         DROPPED never sent: hold is off, or the panel died (a dead panel holds nothing)
// With exactly one channel down nothing is queued: every signal goes on the other channel at once.
// On restore, with hold ON (site setting, default; PRACTICE, NEEDS PE REVIEW: the code is silent on holding), every
// RETRY or HELD entry is sent in priority order: alarm, then supervisory (OPEN sorts with it), then trouble
// (DI.ref72(W).priority), ties by event time, one send per DI.DACT_SEND_S; last of all the communications-failure
// trouble and its restoral. With hold OFF only the entries still inside their attempts are sent; the rest are DROPPED.
// SIMPLIFICATION: attempts are counted from the signal's first sight, not a modem model.
// Nothing here is an input of D or P, and no hook, notification rule or release reads the queue.
DI.dactFind = (S, panelId, key, t0) => S.dq.find((e) => e.panel === panelId && e.key === key && e.t0 === t0 && e.tClr === undefined && !e.comm) || null;
DI.hhmm = (t) => DI.clock(t).slice(0, -3);
DI.dactLabel = (e) => (e.state === 'RETRY' ? 'RETRYING ' + e.n + ' of ' + DI.DACT_TRIES : e.state === 'HELD' ? 'HELD, COMM FAILURE' : e.state === 'SENT' ? 'SENT ' + DI.hhmm(e.sentT) + ' (late)' : e.why === 'dead' ? 'NOT SENT (panel dead)' : 'NOT SENT (hold off)');
DI.DQ_KEEP = 40;                         // finished entries kept for the station queue display
DI.dactStep = function (S) {
  const W = S.W, Q = S.dq; if (S.settling) return false;
  const dact = DI.commPath(W) === 'dact', panels = W.byType('panel'), isDown = (pn) => dact && Array.isArray(pn.p.chan) && !pn.p.chan[0] && !pn.p.chan[1];
  const open = (e) => e.state === 'RETRY' || e.state === 'HELD';
  let late = false;
  // dnT = when this outage began (both channels down on a live panel). chanT is the same moment as DI.alarmStep
  // records it: a save from before Cycle 6 carries only that one, and the queue is made again from it.
  for (const pn of panels) { if (pn.p.alive === false) { delete pn.p.dnT; delete pn.p.dqNext; } else if (isDown(pn) && !(pn.p.dnT >= 0)) pn.p.dnT = pn.p.chanT >= 0 ? pn.p.chanT : S.t; }
  // new entries: a cut signal that is due, that the station does not already have, of a live monitored panel.
  // The communications-failure signals themselves are sent last, as one entry made at restore.
  const live = new Set();
  for (const o of S.sig.values()) {
    if (o.q) { live.add(o.q); continue; }
    if (!o.cut || o.had || o.sup || o.reg === 'dactChan' || o.reg === 'dactFail' || !(S.t - o.t0 >= o.delay)) continue;
    const d = W.parts.get(o.part), pn = d ? (d.type === 'panel' ? d : W.panelOf(d.id)) : null; if (!pn) continue;
    const e = { id: ++S.dqSeq, panel: pn.id, key: o.key, reg: o.reg, cls: o.type, fd: !!o.fd && o.type === 'ALARM', test: !!o.test, text: o.text, t0: o.t0,
      tq: Math.max(o.t0 + o.delay, pn.p.dnT >= 0 ? pn.p.dnT : o.t0), state: 'RETRY', n: 1 };
    Q.push(e); o.q = e; live.add(e);
  }
  for (const e of Q) {
    if (!e.comm && e.tClr === undefined && !live.has(e)) e.tClr = S.t;         // the signal has cleared at the panel
    if (!open(e)) continue;
    const pn = W.parts.get(e.panel);
    if (!pn || pn.p.alive === false) { e.state = 'DROPPED'; e.why = 'dead'; continue; }
    if (e.state === 'RETRY' && isDown(pn)) { const age = S.t - e.tq + 1e-6; e.n = Math.min(DI.DACT_TRIES, 1 + Math.floor(age / DI.DACT_ATTEMPT_S)); if (age >= DI.DACT_TOTAL_S) e.state = 'HELD'; }
  }
  const rank = (e) => (e.comm ? 3 : e.cls === 'ALARM' ? 0 : e.cls === 'TRBL' ? 2 : 1), ev = (e) => 'event ' + DI.hhmm(e.t0) + (e.tClr !== undefined ? ', cleared ' + DI.hhmm(e.tClr) + ' before sending' : '');
  for (const pn of panels) {
    const q = pn.p; if (q.alive === false || isDown(pn)) continue;
    if (q.dnT >= 0) {            // a channel is back
      const hold = DI.dactHold(W); let n = 0;
      for (const e of Q) if (e.panel === pn.id && open(e) && !e.comm) {
        if (!hold && (e.state === 'HELD' || e.tClr !== undefined)) { e.state = 'DROPPED'; e.why = 'hold'; S.say('NOT SENT (hold off): ' + e.text + ' (' + ev(e) + ')', 'warn'); } else n++;
      }
      Q.push({ id: ++S.dqSeq, panel: pn.id, key: 'dc' + pn.id, reg: 'dactChan', cls: 'TRBL', fd: false, test: false, comm: true, text: 'DACT COMMUNICATIONS FAILURE - panel #' + pn.id + ', and its restoral', t0: q.dnT, tq: q.dnT, tClr: S.t, state: 'HELD', n: DI.DACT_TRIES });
      S.say('DACT channel restored at panel #' + pn.id + ': ' + n + ' queued signal(s) to send in priority order (alarm, supervisory, trouble), then the communications-failure trouble and its restoral.', 'warn');
      delete q.dnT; q.dqNext = S.t;
    }
    while (q.dqNext >= 0) {
      const pend = Q.filter((e) => e.panel === pn.id && open(e)); if (!pend.length) { delete q.dqNext; break; }
      if (q.dqNext > S.t + 1e-9) break;
      pend.sort((a, b) => rank(a) - rank(b) || a.t0 - b.t0 || a.id - b.id);
      const e = pend[0]; e.state = 'SENT'; e.sentT = q.dqNext; q.dqNext += DI.DACT_SEND_S;
      S.say('SENT ' + DI.hhmm(e.sentT) + ' (late): ' + e.text + ' (' + ev(e) + ')', 'warn');
      for (const o of S.sig.values()) if (o.q === e) o.tx = o.mon && !o.cut && S.t - o.t0 >= o.delay;       // the station has it from this tick
      if (e.fd && !e.test) late = true;
    }
  }
  // keep every open entry and the last DI.DQ_KEEP finished ones
  let done = 0; for (const e of Q) if (!open(e)) done++;
  for (let i = 0; done > DI.DQ_KEEP && i < Q.length;) { if (open(Q[i]) || live.has(Q[i])) i++; else { Q.splice(i, 1); done--; } }
  return late;
};
// The supervising-station queue as rows for the annunciator: every entry, oldest first. Pure.
DI.stationQueue = function (S) {
  return (S.dq || []).map((e) => ({ id: e.id, panel: e.panel, text: e.text, cls: e.cls, state: e.state, label: DI.dactLabel(e), t0: e.t0, sentT: e.sentT, tClr: e.tClr }));
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
// Silence: acknowledges the signals at the panel. Nothing is reset and nothing clears; a new signal resounds, and a
// trouble that is still active resounds by itself after DI.TROUBLE_RESOUND_S (pn.p.silT = when it was silenced).
DI.silence = function (S, panelId) {
  const pn = S.W.parts.get(panelId); if (!pn || pn.type !== 'panel') return 'No panel.';
  if (pn.p.alive === false) return DI.PANEL_DEAD_MSG;
  pn.p.silenced = true; pn.p.silT = S.t; S.act('silence', panelId); S.say('Panel silenced. Signals stay on the annunciator until they clear. An active trouble sounds again after ' + DI.delayText(DI.TROUBLE_RESOUND_S) + '.', '');
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
// purpose, and one for each whose AVC bypass is open (the air maintenance device is not regulating). Display only:
// nothing here is added to S.sig, transmitted or sounded, and it shows with a dead panel. The low-air and high-air
// supervisories stay pressure signals: they come in only when the gauge actually moves. Whether a bypass valve has
// a supervisory switch is not code-required (PRACTICE, ASSUMED): it is a tag here, and it holds the return step.
DI.impairments = function (S) {
  const W = S.W, out = [];
  for (const [id] of S.ss) {
    const v = W.parts.get(id), inf = S.sysd.info.get(id);
    if (!v || v.type === 'wetv' || !inf || !inf.src.length) continue;
    if (!v.p.airValve && !S.procs.some((q) => q.kind === 'leak' && q.id === id))
      out.push({ key: 'air-isolated:' + id, id, text: 'IMPAIRMENT: Air / N2 supply isolated to ' + DI.sysName(S, id) + '. The zone cannot hold or refill air and will drift to low air. Restore the supply.' });
    if (DI.avcBypassed(v))
      out.push({ key: 'avc-bypass:' + id, id, text: 'IMPAIRMENT: AVC bypass open on ' + DI.sysName(S, id) + '. The air maintenance device is not regulating: pressure will climb toward the compressor cut-out. Close the bypass.' });
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
  ['restore-air', 'Restore air / N₂ and confirm it holds above low air'], ['reset-trim', 'Reset the trim (electric / pneumatic only)'], ['reset-panel', 'Panel reset #2: clear the pressure-loss (P) latch and troubles; panel reads normal.'],
  ['open-valve', 'Slowly open the control valve fully; confirm no flow, panel normal, supervision restored.']];
// Step 14, the main drain test, exists in the scored drill incident only (Fire Tutor): DI.recoveryScore appends it
// when it is called with `from` (the drill call). Practice and every other call keep the thirteen steps, and the
// main drain test is a tip there. Running it after a control valve is reopened is company practice; the code-required
// test at that point is the valve status test (DI.REF25). DI.MDT_LINE is the Tutor's instruction, word for word.
DI.RECOVERY_DRAIN = ['drain-test', 'Main drain test: record static and residual pressure, then close the drain slowly'];
DI.MDT_LINE = 'Main drain test: with the control valve fully open, open the main drain fully, record static and residual pressure, then close it slowly. A big drop compared to the last test means a valve may be partly closed.';
DI.MDT_FOLLOW = 'A big drop compared to the last test means a valve may be partly closed. Check that the valves are fully open.';
// Recovery rating of the scored incident (contract 5), on "water stopped": the time from the alarm to the control
// valve closed, plus every step in order (Fire Tutor). 3 stars within 120 s, 2 within 240 s, 1 for any complete
// in-order recovery. ASSUMED, to be tuned in play test, informational: contract stars do not read it. The operator's
// own step time and the air refill are reported beside it and never rated.
DI.RECOVERY_TIERS = [{ stars: 3, s: 120 }, { stars: 2, s: 240 }];
// 0 = not complete or not in order; else 3 or 2 stars by "water stopped", else 1. Its own report line.
DI.recoveryTier = function (r) {
  if (!r || !r.complete || !r.inOrder) return 0;
  if (r.waterStopped !== null && r.waterStopped !== undefined) for (const q of DI.RECOVERY_TIERS) if (r.waterStopped <= q.s) return q.stars;
  return 1;
};
// The Tutor's instruction is shown once in a drill, when the control valve of the scored incident is back open
// (step 13 done): a banner and a log line. Called where `open-valve` is logged (Sim.controllers).
DI.drillDrainPrompt = function (S, gateId) {
  const d = S.drill; if (!d || d.done || d.mdt || !(d.t0 >= 0)) return false;
  const a = S.acts.find((q) => q.kind === 'incident' && q.t >= d.t0); if (!a) return false;
  const g = DI.ctrlValve(S.W, a.id); if (!g || g.id !== gateId) return false;
  const r = DI.recoveryScore(S, a.id, d.t0), st = r && r.steps.find((x) => x.kind === 'open-valve'); if (!st || st.na || !st.done) return false;
  d.mdt = true; S.say('Step 14. ' + DI.MDT_LINE, 'warn'); DI.bus.emit('banner', DI.MDT_LINE); return true;
};
// Score the latest incident on system `id`, or the first one at or after sim time `from`.
// time   = first step to last, the whole recovery (null while incomplete).
// refill = the part of it the zone spent closed up and filling, with nothing left for the operator to do: from the
//          later of the last supply-open, the drain-close and (after a trip) the riser reset, up to restore-air.
//          0 when there is no air step. It is compressor time, judged on its own against DI.refillLimit.
// opTime = time - refill: the operator's own steps, an info stat.
// waterStopped = seconds from the alarm to the control valve closed (step 3): the alarm is the earliest `alarm`
//          entry of the operator log between the incident's start and that step, or the incident's own start where
//          no alarm signal rang (a broken head on a double-interlock zone never trips). null until step 3 is done.
// With `from` (the scored drill incident) the list has a fourteenth step, the main drain test: done by a
// `main-drain-test` entry on this zone, started at or after the control valve was back open, with both readings.
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
  const opn = gate && svc ? late('open-valve', gate.id, svc.t, (q) => !(q.flow > 1)) : null, rows = from !== undefined ? DI.RECOVERY.concat([DI.RECOVERY_DRAIN]) : DI.RECOVERY;
  const steps = rows.map(([kind, label]) => {
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
    else if (kind === 'open-valve') { na = !gate; a = opn; }
    else if (kind === 'drain-test') { const ref = gate ? opn : svc; a = ref && late('main-drain-test', id, ref.t, (q) => isFinite(q.stat) && isFinite(q.resid) && q.ts >= ref.t); }
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
  const cv = steps.find((st) => st.kind === 'close-valve'), al = cv && cv.t !== null ? win.find((q) => q.kind === 'alarm' && q.t >= t0 && q.t <= cv.t) : null;
  return { id, t0, why: A[i0].why, steps, done, total: steps.length, complete, inOrder, tripped, det, closed: !!svc,
    time, refill, air: !!air, opTime: time !== null ? Math.max(0, time - refill) : null, waterStopped: cv && cv.t !== null ? Math.max(0, cv.t - (al ? al.t : t0)) : null };
};
