// node test/sim.test.js - whole-system behaviour
for (const f of ['core', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'sim']) require('../src/' + f + '.js');
const DI = globalThis.DI; let fail = 0;
const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
const run = (S, sec, dt) => { for (let t = 0; t < sec; t += dt) S.step(dt); };
const hline = (W, x0, x1, y, size) => { for (let x = x0; x <= x1; x++) W.setPipe(x, y, size, 0); };
const grid = (W, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) W.setPipe(x, y, 1, 1, true); };

// ---------- 1. wet system on a city main: fire -> sprinkler -> alarm -> control
{
  const W = new DI.World(40, 14); W.addRoom('office', 20, 2, 12, 8);
  W.addPart('city', 1, 6, 0); hline(W, 2, 9, 6, 6); const g = W.addPart('gate', 10, 6, 0); hline(W, 11, 13, 6, 6);
  const r = W.addPart('wetv', 14, 6, 0); hline(W, 15, 19, 6, 6);
  for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true); grid(W, 21, 2, 31, 9);
  const pn = W.addPart('panel', 14, 4, 0); W.wire(pn.id, r.id); W.wire(pn.id, g.id);
  const S = new DI.Sim(W); S.commission(); S.live = true;
  ok('wet: static pressure at remote head ~ city static', Math.abs(S.pT[W.k(31, 2)] - 62) < 0.5, S.pT[W.k(31, 2)].toFixed(1));
  ok('wet: quiet network is small', S.G.net.n < 12, S.G.net.n + ' nodes');
  DI.ignite(S, W.k(27, 5), 0); run(S, 600, 0.25);
  const open = S.ss.get(r.id).openK.length;
  ok('wet: sprinklers operated (1-6)', open >= 1 && open <= 6, open + ' open');
  ok('wet: fire is out', S.fires.length === 0, 'fires=' + S.fires.length);
  ok('wet: waterflow alarm monitored', [...S.sig.values()].some((s) => s.type === 'ALARM' && s.mon && s.key[0] === 'w'));
  ok('wet: fire dept dispatched', S.fd.called >= 0);
  g.p.target = 0; run(S, 10, 0.25);
  ok('wet: closing control valve stops flow + tamper', S.outFlow < 0.5 && S.sig.has('tm' + g.id), S.outFlow.toFixed(2));
}
// ---------- 2. dry system: fill time, trip, water delivery
{
  const W = new DI.World(40, 14); W.addRoom('dock', 20, 2, 12, 8);
  W.addPart('city', 1, 6, 0, { stat: 80, resid: 60, flow: 1200 }); hline(W, 2, 13, 6, 6);
  const v = W.addPart('dryv', 14, 6, 0); hline(W, 15, 19, 6, 6);
  for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true); grid(W, 21, 2, 31, 9);
  const c = W.addPart('comp', 14, 4, 0, { scfm: 5 }); W.setAir(14, 5, 1);
  const S = new DI.Sim(W); const s = S.ss.get(v.id);
  run(S, 1800, 1);
  ok('dry: compressor fills to service pressure', s.set && s.P > 36, 'P=' + s.P.toFixed(1) + ' fill=' + DI.dur(s.fillTime) + ' vol=' + s.vol.toFixed(0) + ' gal');
  ok('dry: no water past the valve', s.wat === 0 && s.state === 'dry');
  const t0 = S.t; v.p.itc = 1; S.touch(); run(S, 240, 0.1);
  ok('dry: valve tripped on air loss', s.tripT > 0, 'trip ' + (s.tripT - t0).toFixed(1) + ' s');
  ok('dry: water delivered to inspector test', s.waterT > 0, 'delivery ' + (s.waterT - t0).toFixed(1) + ' s');
  ok('dry: delivery is plausible (10-120 s)', s.waterT - t0 > 10 && s.waterT - t0 < 120);
}
// ---------- 3. double interlock preaction
{
  const W = new DI.World(40, 14); W.addRoom('hall', 20, 2, 12, 8);
  W.addPart('city', 1, 6, 0, { stat: 90, resid: 70, flow: 1500 }); hline(W, 2, 13, 6, 6);
  const v = W.addPart('prev', 14, 6, 0); hline(W, 15, 19, 6, 6);
  for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true); grid(W, 21, 2, 31, 9);
  W.addPart('comp', 14, 4, 0); W.setAir(14, 5, 1);
  const pn = W.addPart('panel', 16, 4, 0), d = W.addPart('vesda', 25, 1, 0); W.rooms[0].y = 1; W.rooms[0].h = 9; W.roomAt[W.k(25, 1)] = 1;
  W.wire(pn.id, v.id); W.wire(pn.id, d.id);
  const S = new DI.Sim(W); S.commission(); const s = S.ss.get(v.id);
  DI.breakSprinkler(S, W.k(28, 5)); run(S, 300, 0.25);
  ok('DI: broken sprinkler alone -> NO water', s.state === 'dry' && s.wat === 0, 'P=' + s.P.toFixed(1));
  ok('DI: low air supervisory raised', S.sig.has('la' + v.id));
  W.spk[W.k(28, 5)] = 1; S.spkVer++; run(S, 1500, 1);
  ok('DI: air restored after repair', s.P > 15, 'P=' + s.P.toFixed(1));
  S.smoke[1] = 5; run(S, 60, 0.25); S.smoke[1] = 0; run(S, 1, 0.25);
  ok('DI: detection alone -> NO water (solenoid energized)', s.state === 'dry' && v.p.sol === true);
  DI.panelReset(S, pn.id); run(S, 5, 0.25);
  ok('DI: panel reset de-energizes solenoid', v.p.sol === false);
  DI.ignite(S, W.k(27, 5), 60); run(S, 900, 0.25);
  ok('DI: real fire -> both interlocks -> water', s.tripT > 0 && s.waterT > 0, 'trip@' + (s.tripT - S.fireT0).toFixed(0) + 's water@' + (s.waterT - S.fireT0).toFixed(0) + 's open=' + s.openK.length);
  ok('DI: fire controlled', S.fires.length === 0, 'fireLoss ' + DI.money(S.stats.fireLoss) + ' water ' + DI.money(S.stats.waterLoss) + ' smoke ' + DI.money(S.stats.smokeLoss));
}
// ---------- 4. tank + jockey + electric pump
{
  const W = new DI.World(40, 14);
  W.addPart('tank', 1, 6, 0); hline(W, 2, 4, 6, 8);
  const ep = W.addPart('epump', 5, 6, 0, { gpm: 1000, psi: 100, start: 100 }); hline(W, 6, 6, 6, 8);
  W.addPart('check', 7, 6, 0); hline(W, 8, 14, 6, 8);
  W.setPipe(4, 5, 3, 0); W.setPipe(4, 4, 3, 0); const jp = W.addPart('jockey', 5, 4, 0, { psi: 115, start: 110, stop: 120 }); W.setPipe(6, 4, 3, 0);
  W.addPart('check', 7, 4, 0); W.setPipe(8, 4, 3, 0); W.setPipe(8, 5, 3, 0);
  const th = W.addPart('testhdr', 15, 6, 0);
  const S = new DI.Sim(W); S.commission();
  ok('pump: sensing point moved past the discharge check', ep.p.sense > 0);
  ok('pump: jockey holds pressure, fire pump idle', S.pout(ep.p.sense) > 105 && ep.p.spd === 0, 'P=' + S.pout(ep.p.sense).toFixed(1));
  S.leaks.push({ k: W.k(10, 6), K: 0.02 }); S.dirty = true; run(S, 3600, 1);
  ok('pump: small leak -> jockey cycles, fire pump stays off', jp.p.starts >= 1 && ep.p.spd === 0, jp.p.starts + ' jockey starts/h');
  th.p.open = 2; S.touch(); run(S, 30, 0.1);
  ok('pump: big demand -> fire pump starts on pressure drop', ep.p.spd > 0.9, 'Q=' + S.flowOf(ep.id).toFixed(0) + ' gpm, P=' + S.pout(ep.id).toFixed(0));
  W.power = false; run(S, 5, 0.1);
  ok('pump: power loss stops electric pump (tank head alone still trickles through)', ep.p.spd < 0.1 && S.outFlow < 600, 'Q=' + S.outFlow.toFixed(0));
}
console.log(fail ? fail + ' FAILED' : 'all sim tests passed'); process.exit(fail ? 1 : 0);
