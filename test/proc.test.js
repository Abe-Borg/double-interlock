// node test/proc.test.js - commissioning procedures
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'cause', 'sim', 'calc', 'review', 'proc']) require('../src/' + f + '.js');
const DI = globalThis.DI; let fail = 0;
const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
const hline = (W, x0, x1, y, size) => { for (let x = x0; x <= x1; x++) W.setPipe(x, y, size, 0); };
{
  const W = new DI.World(40, 14);
  W.addPart('tank', 1, 6, 0); hline(W, 2, 4, 6, 8);
  const ep = W.addPart('epump', 5, 6, 0, { gpm: 1000, psi: 100, start: 95 }); hline(W, 6, 14, 6, 8);
  W.setPipe(4, 5, 3, 0); W.setPipe(4, 4, 3, 0); W.addPart('jockey', 5, 4, 0, { psi: 115, start: 105, stop: 115 }); W.setPipe(6, 4, 3, 0); W.setPipe(6, 5, 3, 0);
  W.addPart('testhdr', 15, 6, 0);
  const S = new DI.Sim(W); S.commission();
  ok('pump test starts', DI.startTest(S, 'pump', ep.id) === '');
  S.warp(400); const r = DI.lastResult(S, 'pump');
  ok('pump test completes and passes', r && r.pass, r ? r.lines.join(' | ') : 'no result');
  ok('pump restored to auto and stopped', ep.p.mode === 'auto' && ep.p.spd < 0.05);
}
{
  const W = new DI.World(40, 14); W.addRoom('dock', 20, 2, 12, 8);
  W.addPart('city', 1, 6, 0, { stat: 80, resid: 60, flow: 1200 }); hline(W, 2, 13, 6, 6);
  const v = W.addPart('dryv', 14, 6, 0); hline(W, 15, 19, 6, 6);
  for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true);
  for (let y = 2; y <= 9; y++) for (let x = 21; x <= 31; x++) W.setPipe(x, y, 1, 1, true);
  W.addPart('comp', 14, 4, 0); W.setAir(14, 5, 1);
  const S = new DI.Sim(W); S.commission();
  DI.startTest(S, 'leak', v.id); S.warp(86500); let r = DI.lastResult(S, 'leak');
  ok('24 h air test passes on new pipe', r && r.pass, r && r.lines[1]);
  ok('24 h air test report: test pressure, start and end, the pass line with the edition section, the drop', r.lines.length === 4 && r.lines[0] === 'Test pressure: 40 psi' && r.lines[1] === 'Start: 40.0 psi, end: 39.1 psi' &&
    r.lines[2] === 'Pass: end reading at least 38.5 psi (loss of 1.5 psi or less in 24 h) [NFPA 13-2025 §29.2.2.1]' && r.lines[3] === 'Drop: 0.94 psi in 24 h' && r.end >= DI.AIR_TEST.endMin && r.val <= DI.AIR_TEST.drop, r.lines.join(' | '));
  ok('24 h air test constants: 40 psi, end reading 38.5 psi or more, the clock starts at 40.0 on the gauge (0.005 psi), 30 min to charge', DI.AIR_TEST.psi === 40 && DI.AIR_TEST.endMin === 38.5 && DI.AIR_TEST.drop === 1.5 && DI.AIR_TEST.tol === 0.005 && DI.AIR_TEST.chargeMax === 1800);
  ok('24 h air test pressure: at a 40 psi normal it is the 40 psi baseline (the greater of 40 psi or normal), pass line 38.5', DI.airTestPsi(v) === DI.AIR_TEST.psi && DI.airTestEnd(v) === DI.AIR_TEST.endMin && v.p.airSet === 40 && r.psi === 40 && DI.airTestPsi({ p: { airSet: 50 } }) === 50 && DI.airTestPsi({ p: { airSet: 30 } }) === 40);
  DI.startTest(S, 'drain', v.id); S.warp(60); r = DI.lastResult(S, 'drain');
  ok('main drain test records static/residual', r && r.pass && r.val > 20 && r.val < 80, r && r.lines.join(' | '));
  DI.startTest(S, 'trip', v.id); S.warp(260); r = DI.lastResult(S, 'trip');
  ok('trip test passes', r && r.pass, r && r.lines.join(' | '));
  ok('trip test report: zone volume beside pipe volume, NFPA and FM lines, governing limit', /^Zone volume: \d+ gal \(pipe \d+\)$/.test(r.lines[0]) && r.zone > r.pipe && r.lines[3] === 'NFPA 13: no timed test (500 gal or less) [NFPA 13-2025 §8.2.4.2.1]' && r.lines[4] === 'FM: not applied' && r.lines[r.gov] === 'Governing: no time limit applies' && r.governing === null);
  const s = S.ss.get(v.id);
  ok('reset refused while system is full', DI.resetValve(S, v.id) !== '', DI.resetValve(S, v.id));
  v.p.sdrain = 1; S.touch(); S.warp(600);
  ok('system drains through the valve seat until supply is shut', s.state !== 'dry');
}
console.log(fail ? fail + ' FAILED' : 'all procedure tests passed'); process.exit(fail ? 1 : 0);
