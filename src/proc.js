// Commissioning / ITM test procedures. Each one drives the real simulation and reads the real gauges.
var DI = globalThis.DI || (globalThis.DI = {});

DI.startTest = function (S, kind, id) {
  const W = S.W, v = W.parts.get(id), s = S.ss.get(id);
  if (S.procs.some((p) => p.id === id)) return 'A test is already running on this equipment.';
  const pr = { kind, id, t0: S.t, stage: 0, ts: S.t, pts: [] };
  if (kind === 'trip') {
    if (!s || s.state !== 'dry' || !s.set) return 'Valve must be set and pressurized before a trip test.';
    v.p.itc = 1; if (v.type === 'prev') { v.p.sol = true; pr.rel = true; }
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
    if (!s || s.state !== 'dry' || !s.set) return 'System must be pressurized first.';
    pr.p0 = s.P; v.p.airValve = 0; S.say('24-hour air test started at ' + DI.fmt(s.P, 1) + ' psi (air supply isolated)', '');
  } else if (kind === 'run') {
    pr.mode0 = v.p.mode; v.p.mode = 'hand'; pr.need = v.type === 'dpump' ? 1800 : 600; S.say('No-flow (churn) run started: ' + pr.need / 60 + ' minutes', '');
  } else return 'Unknown test.';
  S.procs.push(pr); S.testUntil = S.t + 1e9; S.touch(); return '';
};

DI.testStep = function (S, dt) {
  const W = S.W;
  for (let i = S.procs.length - 1; i >= 0; i--) {
    const pr = S.procs[i], v = W.parts.get(pr.id), s = S.ss.get(pr.id), el = S.t - pr.t0;
    let res = null;
    if (!v) { S.procs.splice(i, 1); continue; }
    if (pr.kind === 'trip') {
      const inf = S.sysd.info.get(pr.id), lim = v.type === 'dryv' && v.p.qod ? 750 : 500, exempt = inf.vol <= lim;
      if (s.waterT > 0 || el > 240) {
        const tw = s.waterT > 0 ? s.waterT - pr.t0 : -1, tt = s.tripT > 0 ? s.tripT - pr.t0 : -1;
        res = { pass: tw > 0 && (exempt || tw <= 60), title: 'Full-flow trip test', lines: [
          'System volume: ' + DI.fmt(inf.vol) + ' gal',
          tt > 0 ? 'Valve tripped: ' + DI.fmt(tt, 1) + ' s' : 'Valve DID NOT TRIP in 240 s',
          tw > 0 ? 'Water at inspector’s test: ' + DI.fmt(tw, 1) + ' s' : 'No water at the inspector’s test',
          exempt ? 'Limit: none (' + lim + ' gal or less)' : 'Limit: 60 s (system over ' + lim + ' gal)'], val: tw, trip: tt };
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
        const base = v.p.drainBase; const drop = base ? (base - pr.resid) / base : 0;
        res = { pass: !(drop > 0.1), title: 'Main drain test', val: pr.resid, lines: ['Static: ' + DI.fmt(pr.stat) + ' psi', 'Residual: ' + DI.fmt(pr.resid) + ' psi at about ' + DI.fmt(pr.q) + ' gpm',
          base ? 'Previous residual: ' + DI.fmt(base) + ' psi (' + (drop > 0.1 ? 'DOWN ' + DI.fmt(drop * 100) + '% - find the closed valve or obstruction' : 'within 10%') + ')' : 'Recorded as the baseline for future tests'] };
        if (!base || drop <= 0.1) v.p.drainBase = pr.resid;
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
      if (el >= 86400 || s.state !== 'dry') {
        const loss = pr.p0 - s.P; v.p.airValve = 1;
        res = { pass: s.state === 'dry' && loss <= 1.5, title: '24-hour air leakage test', val: loss, lines: ['Start: ' + DI.fmt(pr.p0, 1) + ' psi, end: ' + DI.fmt(s.P, 1) + ' psi', 'Loss: ' + DI.fmt(loss, 2) + ' psi in 24 h (limit 1.5 psi)'] };
      }
    } else if (pr.kind === 'run') {
      if (v.p.failed || (el > 40 && v.p.spd < 0.5)) res = { pass: false, title: 'Weekly churn run', lines: ['Pump failed to start.'] };
      else if (v.p.ranFor >= pr.need) res = { pass: true, title: (v.type === 'dpump' ? 'Diesel' : 'Electric') + ' pump churn run', lines: ['Ran ' + pr.need / 60 + ' min at churn: suction ' + DI.fmt(S.pin(pr.id)) + ' psi, discharge ' + DI.fmt(S.pout(pr.id)) + ' psi', v.type === 'dpump' ? 'Fuel remaining: ' + DI.fmt(v.p.fuel * 100) + '%' : 'Motor ran normally'] };
      if (res) { v.p.mode = pr.mode0; v.p.on = false; v.p.lastTest = S.t; }
    }
    if (res) {
      res.kind = pr.kind; res.id = pr.id; res.t = S.t; res.name = s ? DI.sysName(S, pr.id) : DI.PARTS[v.type].name + ' #' + v.id;
      S.results.push(res); S.procs.splice(i, 1); S.testUntil = S.procs.length ? S.t + 1e9 : S.t + 90; if (pr.kind === 'pump' || pr.kind === 'run') S.lastTestT = S.t;
      S.say(res.title + ': ' + (res.pass ? 'PASS' : 'FAIL') + ' - ' + res.lines[res.lines.length > 2 ? 2 : 0], res.pass ? 'good' : 'bad'); DI.bus.emit('result', res);
    }
  }
};
DI.lastResult = (S, kind, id) => { for (let i = S.results.length - 1; i >= 0; i--) { const r = S.results[i]; if (r.kind === kind && (id === undefined || r.id === id)) return r; } return null; };
