// node test/proc.test.js - commissioning procedures
for (const f of ['core', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'sim', 'calc', 'review', 'proc']) require('../src/' + f + '.js');
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
  DI.startTest(S, 'drain', v.id); S.warp(60); r = DI.lastResult(S, 'drain');
  ok('main drain test records static/residual', r && r.pass && r.val > 20 && r.val < 80, r && r.lines.join(' | '));
  DI.startTest(S, 'trip', v.id); S.warp(260); r = DI.lastResult(S, 'trip');
  ok('trip test passes', r && r.pass, r && r.lines.join(' | '));
  const s = S.ss.get(v.id);
  ok('reset refused while system is full', DI.resetValve(S, v.id) !== '', DI.resetValve(S, v.id));
  v.p.sdrain = 1; S.touch(); S.warp(600);
  ok('system drains through the valve seat until supply is shut', s.state !== 'dry');
}
console.log(fail ? fail + ' FAILED' : 'all procedure tests passed'); process.exit(fail ? 1 : 0);
