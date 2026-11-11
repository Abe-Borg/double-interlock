// Commissioning / ITM test procedures. Each one drives the real simulation and reads the real gauges.
var DI = globalThis.DI || (globalThis.DI = {});

// 24 h air test, dry and double interlock (FP Lead): 40 psi air held 24 h; a loss over 1.5 psi must be
// corrected. Same values in every edition; the section is DI.juris.ref.airTest (verified: 2019 §28.2.2.1, 2022 and
// 2025 §29.2.2.1).
// Test pressure: the NFPA text names 40 psi. The game tests at the greater of 40 psi or the zone's normal
// pressure (DI.airTestPsi): company practice, NEEDS PE REVIEW (FP Lead). A normal below 40 still tests at 40. The
// pass line is a loss of 1.5 psi or less at every test pressure (DI.airTestEnd): 38.5 psi at 40.
// After the test the supply is restored and the zone is returned to its normal set point. Where the pipe is left
// more than 1 psi above normal (a normal below the test pressure) the operator bleeds it at the trim: s.ret, a
// practice step (the operator ends it with Finish, DI.returnFinish in gas.js, which logs return-normal and files a
// practice `return` result). A zone left below normal refills by itself and then waits for Finish too. The 1.5 psi pass line is an absolute value at every test pressure (VERIFIED):
// it is never scaled with the test pressure.
//   psi     the 40 psi baseline      endMin  lowest passing end reading at 40  drop  allowed loss (report line)
//   tol     ASSUMED: the clock starts once the zone is within this of the test pressure (the gauge reads 40.0).
//           It is small on purpose: "end reading at least 38.5" equals "loss of 1.5 or less" only from a 40.0
//           start, and a 0.1 psi shortfall at the start would be the whole pass margin of a just-repaired zone.
//   chargeMax  ASSUMED: seconds allowed to reach the test pressure before the test fails
// Simplification: the game charges the zone to the test pressure itself; a real test is charged and held by the contractor.
DI.AIR_TEST = { psi: 40, endMin: 38.5, drop: 1.5, tol: 0.005, chargeMax: 1800 };
DI.airTestPsi = (v) => Math.max(DI.AIR_TEST.psi, v.p.airSet);
DI.airTestEnd = (v) => DI.airTestPsi(v) - DI.AIR_TEST.drop;

DI.startTest = function (S, kind, id) {
  const W = S.W, v = W.parts.get(id), s = S.ss.get(id);
  if (S.procs.some((p) => p.id === id)) return 'A test is already running on this equipment.';
  const pr = { kind, id, t0: S.t, stage: 0, ts: S.t, pts: [] };
  if (kind === 'trip') {
    if (!s || s.state !== 'dry' || !s.set) return 'Valve must be set and pressurized before a trip test.';
    if (v.type === 'prev' && v.p.pLatch) return 'P is latched. The timed test starts from normal air with P clear: reset ' + (v.p.trim === 'el-pn' ? 'the actuator at the trim' : 'the releasing panel') + ' first.';
    if (v.type === 'prev') {       // the test operates detection through the panel; P comes from the open inspector's test
      const pn = W.panelOf(id); if (!pn || pn.p.alive === false) return 'Wire the valve to a live releasing panel first. The trip test operates detection through it.';
      v.p.sol = true; pr.rel = true;
    }
    v.p.itc = 1;
    s.openT = S.t; s.waterT = -1; s.tripT = -1; S.say('Full-flow trip test started on ' + DI.sysName(S, id) + ': inspector’s test open' + (pr.rel ? ', detection operated' : ''), '');
  } else if (kind === 'itc') {
    if (!s || s.state !== 'wet') return 'System must be full of water.';
    v.p.itc = 1; s.flowT = 0; s.alarmT = -1; S.say('Inspector’s test opened on ' + DI.sysName(S, id), '');
  } else if (kind === 'drain') {
    pr.stat = S.pin(id); v.p.drain = 1; S.say('Main drain test: static ' + DI.fmt(pr.stat) + ' psi, drain opening', '');
  } else if (kind === 'pump') {
    const h = W.byType('testhdr')[0]; if (!h) return 'No test header to flow through.';
    pr.hdr = h.id; pr.others = [];
    for (const o of W.parts.values()) if ((o.type === 'epump' || o.type === 'dpump') && o.id !== id) { pr.others.push([o.id, o.p.mode]); o.p.mode = 'off'; }
    pr.mode0 = v.p.mode; v.p.mode = 'hand'; h.p.open = 0; S.say('Pump flow test started: churn, 100%, 150%', '');
  } else if (kind === 'leak') {
    const A = DI.AIR_TEST;
    if (!s || s.state !== 'dry' || !s.set) return 'System must be pressurized first.';
    const T = pr.psi = DI.airTestPsi(v);        // the greater of 40 psi or normal, fixed for the whole test
    if (s.P > T + 0.5) return 'Test pressure is ' + T + ' psi. This zone is at ' + DI.fmt(s.P, 1) + ' psi: bleed it at the trim first.';
    if (s.P < T - A.tol) {       // stage 0: the supply stays open and the regulator holds the test pressure (DI.airTarget)
      if (!v.p.airValve) return 'The air / N2 supply to this zone is isolated. Restore it so the zone can be charged to ' + T + ' psi.';
      S.say('24-hour air test: charging from ' + DI.fmt(s.P, 1) + ' psi to the ' + T + ' psi test pressure', '');
    } else DI.airTestHold(S, pr, v, s);
  } else if (kind === 'run') {
    pr.mode0 = v.p.mode; v.p.mode = 'hand'; pr.need = v.type === 'dpump' ? 1800 : 600; S.say('No-flow (churn) run started: ' + pr.need / 60 + ' minutes', '');
  } else return 'Unknown test.';
  S.procs.push(pr); S.testUntil = S.t + 1e9; S.touch(); return '';
};

// the 24 h clock starts: record the start reading and isolate the supply
DI.airTestHold = function (S, pr, v, s) {
  pr.stage = 1; pr.ts = S.t; pr.p0 = s.P; v.p.airValve = 0; s.av = 0;
  S.say('24-hour air test started at ' + DI.fmt(s.P, 1) + ' psi (air supply isolated)', '');
};

DI.testStep = function (S, dt) {
  const W = S.W;
  for (let i = S.procs.length - 1; i >= 0; i--) {
    const pr = S.procs[i], v = W.parts.get(pr.id), s = S.ss.get(pr.id), el = S.t - pr.t0;
    let res = null;
    if (!v) { S.procs.splice(i, 1); continue; }
    if (pr.kind === 'trip') {
      if (s.waterT > 0 || el > 240) {
        // measured delivery against every limit that applies on this site; the most stringent one governs
        const tw = s.waterT > 0 ? s.waterT - pr.t0 : -1, tt = s.tripT > 0 ? s.tripT - pr.t0 : -1, dl = DI.deliveryLimits(S, pr.id, tw);
        const lines = ['Zone volume: ' + DI.fmt(dl.zone) + ' gal (pipe ' + DI.fmt(dl.pipe) + ')',
          tt > 0 ? 'Valve tripped: ' + DI.fmt(tt, 1) + ' s' : 'Valve DID NOT TRIP in 240 s',
          tw > 0 ? 'Water at inspector’s test: ' + DI.fmt(tw, 1) + ' s' : 'No water at the inspector’s test',
          dl.nfpa.rule, dl.fm.rule,
          dl.governing === null ? 'Governing: no time limit applies' : 'Governing: ' + dl.by + ' ' + dl.governing + ' s' + (dl.margin !== null ? ', margin ' + (dl.margin >= 0 ? '+' : '−') + DI.fmt(Math.abs(dl.margin), 1) + ' s' : '')];
        if (dl.nfpa.limit !== null) { const hz = DI.sysHazard(W, S.sysd.info.get(pr.id)); lines.push('Calc / table alternative: ' + DI.HAZ[hz].name + ' ' + DI.DELIVERY.table[hz] + ' s, not modelled [' + DI.juris.ref.table + ']'); }
        res = { pass: tw > 0 && (dl.governing === null || tw <= dl.governing), title: 'Full-flow trip test', lines, gov: 5, val: tw, trip: tt,
          zone: dl.zone, pipe: dl.pipe, governing: dl.governing, by: dl.by, margin: dl.margin, nfpa: dl.nfpa.limit, fm: dl.fm.limit };
        v.p.itc = 0; S.touch();
      }
    } else if (pr.kind === 'itc') {
      if (s.alarm || el > 300) {
        res = { pass: s.alarm && el <= 90, title: 'Inspector’s test (waterflow alarm)', val: s.alarm ? el : -1, lines: [
          s.alarm ? 'Waterflow alarm: ' + DI.fmt(el, 0) + ' s after opening' : 'NO ALARM in 5 minutes', 'Limit: 90 s at the panel (NFPA 72), 5 min local (NFPA 13)',
          W.panelOf(pr.id) ? 'Signal received at the releasing panel' : 'Switch is NOT wired to a panel: local only'] };
        v.p.itc = 0; S.touch();
      }
    } else if (pr.kind === 'drain') {
      if (pr.stage === 0 && el > 25) { pr.resid = S.pin(pr.id); pr.q = S.G.emit.filter((e) => (e.kind === 'drain' || e.kind === 'mdrain') && e.k === W.k(v.x, v.y)).reduce((a, e) => a + e.link.q, 0); v.p.drain = 0; S.touch(); pr.stage = 1; pr.ts = S.t; }
      else if (pr.stage === 1 && S.t - pr.ts > 8) {
        // The rule is the code's: a 10 percent drop in full flow pressure against the acceptance test or earlier tests
        // means find the cause and correct it if necessary (DI.REF25.passLine, VERIFIED). It is a trigger to investigate,
        // not an automatic fail: such a result keeps pass:false (DI.dropFollowed reads it) and carries invest:true, so
        // the badge and the log read INVESTIGATE. "Full flow pressure" is the code term for the residual reading.
        // The operator log gets the test with both readings: step 14 of the scored drill recovery reads it.
        // Cycle 7: the entry also carries the prior residual (base, absent when there was none) and the drop as a
        // fraction. With no baseline the reading is recorded as the baseline and nothing is scored. A drop over 10
        // percent adds the Tutor's hint; whether it was investigated is read by the drill report (DI.dropFollowed).
        const base = v.p.drainBase; const drop = base ? (base - pr.resid) / base : 0, big = DI.mdtBig(drop);
        res = { pass: !big, title: 'Main drain test', val: pr.resid, drop, lines: ['Static: ' + DI.fmt(pr.stat) + ' psi', 'Full-flow (residual): ' + DI.fmt(pr.resid) + ' psi at about ' + DI.fmt(pr.q) + ' gpm',
          base ? 'Previous full flow pressure: ' + DI.fmt(base) + ' psi (' + (big ? 'DOWN ' + DI.fmt(drop * 100) + '%' : 'within 10 percent') + ')' : DI.MDT_BASELINE + ' [' + DI.REF25.passRule + ']'] };
        if (base) res.lines.push(DI.REF25.passLine);
        if (big) { res.invest = true; res.lines.push(DI.mdtHint(drop)); }
        if (!base || !big) v.p.drainBase = pr.resid;
        S.act('main-drain-test', pr.id, Object.assign({ stat: pr.stat, resid: pr.resid, q: pr.q, pass: res.pass, ts: pr.t0, drop }, base ? { base } : null));
      }
    } else if (pr.kind === 'pump') {
      const h = W.parts.get(pr.hdr), q = S.flowOf(pr.id), tgt = [0, 1, 1.5][pr.stage] * v.p.gpm, st = S.t - pr.ts;
      if (!h) res = { pass: false, title: 'Pump flow test', lines: ['Test header was removed.'] };
      else if (pr.stage === 4) { if (st > 6) res = pr.res; }
      else {
        if (pr.stage > 0) h.p.open = DI.clamp(h.p.open + (tgt - q) / v.p.gpm * dt * 1.2, 0, 12);
        const settled = pr.stage === 0 ? st > 14 && v.p.spd > 0.99 : (Math.abs(q - tgt) < 0.015 * v.p.gpm && st > 8) || st > 45;
        if (v.p.failed || (st > 30 && v.p.spd < 0.5)) res = { pass: false, title: 'Pump flow test', lines: ['Pump did not run: ' + (v.type === 'dpump' ? 'check fuel and batteries' : 'no power at the controller')] };
        else if (settled) {
          pr.pts.push({ q, ps: S.pin(pr.id), pd: S.pout(pr.id) }); pr.stage++; pr.ts = S.t;
          if (pr.stage === 3) {
            const [a, b, c] = pr.pts, net = (p) => p.pd - p.ps, R = v.p.psi;
            const ok1 = net(a) <= 1.4 * R + 0.5, ok2 = b.q >= 0.98 * v.p.gpm && net(b) >= 0.95 * R, ok3 = c.q >= 0.98 * 1.5 * v.p.gpm && net(c) >= 0.95 * 0.65 * R, ok4 = c.ps >= -3;
            const row = (n, p, lim) => n + ': ' + DI.fmt(p.q) + ' gpm, suction ' + DI.fmt(p.ps) + ', discharge ' + DI.fmt(p.pd) + ', net ' + DI.fmt(net(p)) + ' psi ' + lim;
            res = { pass: ok1 && ok2 && ok3 && ok4, title: 'Fire pump flow test (' + v.p.gpm + ' gpm @ ' + R + ' psi)', pts: pr.pts, lines: [
              row('Churn', a, '(max ' + DI.fmt(1.4 * R) + ')'), row('100%', b, '(min ' + DI.fmt(0.95 * R) + ')'), row('150%', c, '(min ' + DI.fmt(0.95 * 0.65 * R) + ')'),
              !ok2 || !ok3 ? 'Could not reach the required flow/pressure: the suction supply or piping is the limit.' : ok4 ? 'Suction stayed positive at 150%.' : 'SUCTION WENT NEGATIVE at 150%: supply cannot feed this pump.'] };
          }
        }
        if (res && pr.stage !== 4) { h.p.open = 0; pr.res = res; res = null; pr.stage = 4; pr.ts = S.t; }      // close the hose valves first, then stop
      }
      if (res) { if (h) h.p.open = 0; v.p.mode = pr.mode0; v.p.on = false; for (const [oid, m] of pr.others) { const o = W.parts.get(oid); if (o) o.p.mode = m; } }
    } else if (pr.kind === 'leak') {
      const A = DI.AIR_TEST, T = pr.psi || DI.airTestPsi(v), endMin = T - A.drop;
      // above the 40 psi the code names, the report says whose rule the test pressure is
      const basis = T > A.psi ? ['Tested at the zone’s normal pressure, the greater of ' + A.psi + ' psi or normal: company practice, NEEDS PE REVIEW'] : [];
      if (pr.stage === 0) {
        if (s.state === 'dry' && s.P >= T - A.tol) DI.airTestHold(S, pr, v, s);
        else if (el > A.chargeMax || s.state !== 'dry') res = { pass: false, title: '24-hour air leakage test', val: -1, end: s.P, say: 1, psi: T, lines: ['Test pressure: ' + T + ' psi',
          'Could not reach ' + T + ' psi in ' + A.chargeMax / 60 + ' min: the supply is too small or the leaks are too big.', 'Reached: ' + DI.fmt(s.P, 1) + ' psi'] };
      } else if (S.t - pr.ts >= 86400 || s.state !== 'dry') {
        const loss = pr.p0 - s.P; v.p.airValve = 1; s.av = 1;
        // the report is about air only: test pressure, start, end and the pass line. A latched release input
        // is a panel matter and goes to the panel event log, not here. The test never sets or clears it.
        res = { pass: s.state === 'dry' && s.P >= endMin, title: '24-hour air leakage test', val: loss, end: s.P, say: 1, gov: 2, psi: T, lines: ['Test pressure: ' + T + ' psi',
          'Start: ' + DI.fmt(pr.p0, 1) + ' psi, end: ' + DI.fmt(s.P, 1) + ' psi',
          'Pass: end reading at least ' + endMin + ' psi (loss of ' + A.drop + ' psi or less in 24 h) [' + DI.setJuris(W).ref.airTest + ']',
          'Drop: ' + DI.fmt(loss, 2) + ' psi in 24 h'].concat(basis) };
      }
    } else if (pr.kind === 'run') {
      if (v.p.failed || (el > 40 && v.p.spd < 0.5)) res = { pass: false, title: 'Weekly churn run', lines: ['Pump failed to start.'] };
      else if (v.p.ranFor >= pr.need) res = { pass: true, title: (v.type === 'dpump' ? 'Diesel' : 'Electric') + ' pump churn run', lines: ['Ran ' + pr.need / 60 + ' min at churn: suction ' + DI.fmt(S.pin(pr.id)) + ' psi, discharge ' + DI.fmt(S.pout(pr.id)) + ' psi', v.type === 'dpump' ? 'Fuel remaining: ' + DI.fmt(v.p.fuel * 100) + '%' : 'Motor ran normally'] };
      if (res) { v.p.mode = pr.mode0; v.p.on = false; v.p.lastTest = S.t; }
    }
    if (res && pr.kind === 'leak' && s && s.state === 'dry' && s.P > v.p.airSet + 1) { s.ret = true; DI.rtClear(s); }      // left above normal: the return-to-normal step, with a clean slate
    if (res) {
      res.kind = pr.kind; res.id = pr.id; res.t = S.t; res.name = s ? DI.sysName(S, pr.id) : DI.PARTS[v.type].name + ' #' + v.id;
      S.results.push(res); S.procs.splice(i, 1); S.testUntil = S.procs.length ? S.t + 1e9 : S.t + 90; if (pr.kind === 'pump' || pr.kind === 'run') S.lastTestT = S.t;
      S.say(res.title + ': ' + DI.resBadge(res) + ' - ' + res.lines[res.say !== undefined ? res.say : res.lines.length > 2 ? 2 : 0], res.pass ? 'good' : res.invest ? 'warn' : 'bad'); DI.bus.emit('result', res);
    }
  }
};
DI.lastResult = (S, kind, id) => { for (let i = S.results.length - 1; i >= 0; i--) { const r = S.results[i]; if (r.kind === kind && (id === undefined || r.id === id)) return r; } return null; };
