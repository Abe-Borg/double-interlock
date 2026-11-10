// node test/sim.test.js - whole-system behaviour
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3']) require('../src/' + f + '.js');
require('./bot.js');
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
  ok('DI: P stays latched after the repair, and is annunciated', v.p.pLatch === true && S.sig.has('pl' + v.id));
  DI.panelReset(S, pn.id); run(S, 2, 0.25);
  ok('DI: panel reset unlatches P', v.p.pLatch === false && !S.sig.has('pl' + v.id));
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
// ====================== Cycle 1 acceptance (A1-A19: release logic, detection, hydraulics, company locks)
{
  const fs = require('fs'), path = require('path');
  // a double-interlock rig: city main -> preaction valve -> one room of sprinklers, compressor, panel, one detector
  const rig = (o = {}) => {
    const W = new DI.World(40, 14); W.addRoom(o.room || 'hall', 20, 1, 12, 9);
    W.addPart('city', 1, 6, 0, { stat: 90, resid: 70, flow: 1500 }); hline(W, 2, 13, 6, 6);
    const v = W.addPart('prev', 14, 6, 0, o.props); hline(W, 15, 19, 6, 6);
    for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true); grid(W, 21, 2, 31, 9);
    W.addPart('comp', 14, 4, 0, { scfm: o.scfm || 5 }); W.setAir(14, 5, 1);
    const pn = W.addPart('panel', 16, 4, 0), d = W.addPart(o.det || 'vesda', 25, 1, 0);
    W.wire(pn.id, v.id); W.wire(pn.id, d.id);
    const S = new DI.Sim(W); S.commission();
    return { W, S, v, s: S.ss.get(v.id), pn, d, head: W.k(28, 5) };
  };
  const smoke = (S, lvl, sec) => { for (let t = 0; t < (sec || 10); t += 0.25) { S.smoke[1] = lvl; S.step(0.25); } };   // hold a smoke reading
  const breakHead = (r) => { DI.breakSprinkler(r.S, r.head); run(r.S, 300, 0.25); };                                   // P latches well inside 300 s
  const fails = (S, word) => DI.review(S).filter((f) => f.sev === 'fail' && f.text.includes(word));
  const spkFlow = (S) => S.G.emit.filter((e) => e.kind === 'spk' && e.link.q > 0.5);

  // A1 setpoint order
  {
    const q = DI.PARTS.prev.props, t = DI.TRIMS['el-el'];
    ok('A1 defaults are 50 / 40 / 30 / 20 psi on the part and on both maker trims', [q.hiAir, q.airSet, q.loAir, q.pTrip].join() === '50,40,30,20' && Object.values(DI.TRIMS).every((m) => [m.hiAir, m.airSet, m.loAir, m.pTrip].join() === '50,40,30,20'));
    ok('A1 high > normal > low >= P trip + margin', q.hiAir > q.airSet && q.airSet > q.loAir && q.loAir >= q.pTrip + DI.P_MARGIN && t.sensor === 'PSL-REL' && DI.TRIMS['el-pn'].sensor === 'PA-REL');
    const r = rig();
    ok('A1 review accepts the default order', fails(r.S, 'out of order').length === 0);
    r.v.p.loAir = 15; ok('A1 review fails an inverted order', fails(r.S, 'out of order').length === 1);
    r.v.p.loAir = 22; ok('A1 review warns when low air is inside the P margin', DI.review(r.S).some((f) => f.sev === 'warn' && f.text.includes('above P trip')) && fails(r.S, 'out of order').length === 0);
  }
  // A2 slow leak the compressor holds: no low air, no P, and Fire 1 alone releases nothing
  {
    const r = rig(); r.s.holes = 50; run(r.S, 3600, 1);
    ok('A2 slow leak: pressure holds, no low air, no P', r.s.P > 35 && !r.s.lowAir && r.v.p.pLatch === false, 'P=' + r.s.P.toFixed(1));
    smoke(r.S, 0.2, 30);
    ok('A2 slow leak + Fire 1: solenoid on, valve stays shut', r.d.p.lvl === 3 && r.v.p.sol === true && r.s.state === 'dry' && r.s.wat === 0);
  }
  // A3 low air is supervisory only
  {
    const r = rig({ scfm: 0.5 }); r.s.holes = 35; r.S.warp(8 * 3600);
    ok('A3 weak compressor: pressure settles between P trip and low air', r.s.P > 20 && r.s.P < 30, 'P=' + r.s.P.toFixed(1));
    ok('A3 LOW AIR supervisory raised, P not latched', r.s.lowAir && r.S.sig.has('la' + r.v.id) && r.S.sig.get('la' + r.v.id).type === 'SUPV' && r.v.p.pLatch === false);
    smoke(r.S, 0.2, 30);
    ok('A3 low air + Fire 1: valve stays shut', r.v.p.sol === true && r.s.state === 'dry' && r.s.wat === 0);
  }
  // A4 pipe break + Fire 1 releases
  {
    const r = rig(); ok('A4 pipe-break incident breaks a main of the hall system', DI.X.pipeBreak('hall')(r.S) === true);
    const lk = r.S.leaks[0];
    ok('A4 break is K 9 with a 0.6 in2 gas opening on that system', lk.K === 9 && lk.a === 0.6 && lk.sys === r.v.id && !r.W.pk[lk.k]);
    run(r.S, 120, 0.25);
    ok('A4 pipe break alone: P latched, no water', r.v.p.pLatch === true && r.s.state === 'dry' && r.S.outFlow < 0.5, 'P=' + r.s.P.toFixed(1));
    smoke(r.S, 0.2, 5); run(r.S, 90, 0.25);
    ok('A4 pipe break + Fire 1: valve trips and the break flows', r.s.tripT > 0 && r.S.outFlow > 20, 'Q=' + r.S.outFlow.toFixed(0) + ' gpm');
  }
  // A5 P latches until a manual reset
  {
    const r = rig(); breakHead(r);
    ok('A5 broken head latches P', r.v.p.pLatch === true && r.s.state === 'dry');
    r.W.spk[r.head] = 1; r.S.spkVer++; run(r.S, 1500, 1);
    ok('A5 air restored, P still latched and annunciated', r.s.P > r.v.p.pTrip && r.v.p.pLatch === true && r.S.sig.has('pl' + r.v.id) && r.S.sig.get('pl' + r.v.id).text.includes('P LATCHED (PSL-REL)'), 'P=' + r.s.P.toFixed(1));
    const r2 = rig(); breakHead(r2); r2.W.spk[r2.head] = 1; r2.S.spkVer++; run(r2.S, 1500, 1);
    smoke(r2.S, 0.2, 10);
    ok('A5 latched P + detection releases (impaired interlock)', r2.s.tripT > 0 && r2.s.state !== 'dry');
    DI.panelReset(r.S, r.pn.id); run(r.S, 2, 0.25);
    ok('A5 panel reset unlatches P', r.v.p.pLatch === false && !r.S.sig.has('pl' + r.v.id));
    smoke(r.S, 0.2, 30);
    ok('A5 after the reset, detection alone releases nothing', r.v.p.sol === true && r.s.state === 'dry' && r.s.wat === 0);
    const r3 = rig(); breakHead(r3); DI.panelReset(r3.S, r3.pn.id); run(r3.S, 2, 0.25);
    ok('A5 a reset while the pipe is still below P trip latches again', r3.v.p.pLatch === true);
  }
  // A6 high air follows live pressure
  {
    const r = rig(), V = r.S.sysd.info.get(r.v.id).vol;
    r.s.G = (55 + DI.ATM) * V; run(r.S, 2, 0.25);
    ok('A6 pressure above high air raises HIGH AIR supervisory', r.S.sig.has('ha' + r.v.id) && r.S.sig.get('ha' + r.v.id).type === 'SUPV', 'P=' + r.s.P.toFixed(1));
    r.s.G = (40 + DI.ATM) * V; run(r.S, 2, 0.25);
    ok('A6 HIGH AIR clears when pressure falls', !r.S.sig.has('ha' + r.v.id) && r.v.p.pLatch === false);
    r.v.p.hiAir = 35; run(r.S, 2, 0.25); ok('A6 the setpoint is per valve', r.S.sig.has('ha' + r.v.id));
  }
  // A7 Alert never arms (and Action is a pre-alarm only)
  {
    const r = rig(); smoke(r.S, 0.04, 30);
    ok('A7 Alert: level 1, supervisory, solenoid off', r.d.p.lvl === 1 && r.S.sig.get('v' + r.d.id).type === 'SUPV' && r.v.p.sol === false);
    breakHead(r); smoke(r.S, 0.04, 30);
    ok('A7 Alert + latched P: still no release', r.v.p.pLatch === true && r.v.p.sol === false && r.s.state === 'dry' && r.s.wat === 0);
    const r2 = rig(); r2.S.live = true; breakHead(r2); smoke(r2.S, 0.07, 30);
    ok('A7 Action: level 2, supervisory, no release, no dispatch', r2.d.p.lvl === 2 && r2.S.sig.get('v' + r2.d.id).type === 'SUPV' && r2.v.p.sol === false && r2.s.state === 'dry' && r2.S.fd.called < 0);
  }
  // A8 Fire 2 never releases without P
  {
    const r = rig(); smoke(r.S, 5, 60);
    ok('A8 Fire 2 without P: level 4, valve shut, no water', r.d.p.lvl === 4 && r.s.state === 'dry' && r.s.wat === 0 && r.S.outFlow < 0.5);
  }
  // A9 manual station typed DETECTION, and the bypass flag
  {
    const r = rig(); r.v.p.pull = true; run(r.S, 60, 0.25);
    ok('A9 manual station with full air: no release', r.s.state === 'dry' && r.s.wat === 0 && r.S.sig.has('ms' + r.v.id) && r.W.cfg.manualReleaseBypassP === undefined);
    breakHead(r);
    ok('A9 manual station + P: releases', r.s.tripT > 0);
    const b1 = rig(); b1.W.cfg.manualReleaseBypassP = true; b1.v.p.pull = true; run(b1.S, 5, 0.25);
    ok('A9 bypass ON + el-el trim: releases without P', b1.s.tripT > 0 && b1.v.p.pLatch === false);
    ok('A9 review warns while the bypass is ON', DI.review(b1.S).some((f) => f.sev === 'warn' && f.text.includes('NEEDS PE REVIEW')));
    const b2 = rig(); DI.loadTrim(b2.v, 'el-pn'); b2.W.cfg.manualReleaseBypassP = true; b2.v.p.pull = true; run(b2.S, 60, 0.25);
    ok('A9 bypass ON + el-pn trim: still needs P', b2.s.state === 'dry' && b2.s.wat === 0);
    breakHead(b2); ok('A9 el-pn trim: station + P releases', b2.s.tripT > 0);
  }
  // A10 mechanical emergency release at the trim
  {
    const r = rig(); r.v.p.mech = true; run(r.S, 180, 0.25);
    ok('A10 mechanical release, heads closed: valve trips, nothing flows', r.s.tripT > 0 && spkFlow(r.S).length === 0 && r.S.outFlow < 0.5 && r.S.stats.waterLoss === 0, 'state=' + r.s.state + ' Q=' + r.S.outFlow.toFixed(2));
    const r2 = rig(); DI.breakSprinkler(r2.S, r2.head); r2.v.p.mech = true; run(r2.S, 180, 0.25);
    ok('A10 mechanical release, one broken head: exactly one sprinkler flows', r2.s.tripT > 0 && spkFlow(r2.S).length === 1 && spkFlow(r2.S)[0].link.q > 10, spkFlow(r2.S).map((e) => e.link.q.toFixed(0) + ' gpm').join());
    r.s.wat = 0; r.s.flow = 0;        // as if the control valve were shut and the system drained
    ok('A10 valve reset closes the emergency release', DI.resetValve(r.S, r.v.id) === '' && r.v.p.mech === false && r.v.p.pLatch === false);
  }
  // A11 dead panel leaves the valve shut; recovery is the mechanical release
  {
    const r = rig(); r.W.power = false; r.S.warp(3600);
    const ac = r.S.sig.get('ac' + r.pn.id);
    ok('A11 AC fail: trouble, monitored, on standby battery', !!ac && ac.type === 'TRBL' && ac.mon && ac.text.includes('PANEL AC FAIL') && r.pn.p.alive === true);
    r.S.warp(24 * 3600);
    ok('A11 after 24 h the panel is dead and the valve is shut', r.pn.p.alive === false && r.S.sig.get('ac' + r.pn.id).text.includes('PANEL DEAD') && r.s.state === 'dry');
    breakHead(r); smoke(r.S, 0.2, 30);
    ok('A11 dead panel + Fire 1 + P: still shut, solenoid off', r.v.p.pLatch === true && r.v.p.sol === false && r.s.state === 'dry' && r.s.wat === 0);
    r.v.p.pull = true; run(r.S, 5, 0.25); ok('A11 dead panel: manual station does nothing', r.v.p.pull === false && r.s.state === 'dry');
    r.v.p.mech = true; run(r.S, 5, 0.25); ok('A11 mechanical emergency release still trips it', r.s.tripT > 0);
  }
  // A12 no automatic release on power loss (or on power coming back)
  {
    const r = rig(); smoke(r.S, 0.2, 10); ok('A12 Fire 1 latched the solenoid', r.v.p.sol === true);
    r.W.power = false; r.S.warp(26 * 3600);
    ok('A12 power off 26 h: solenoid dropped out, valve shut', r.v.p.sol === false && r.s.state === 'dry' && r.s.wat === 0);
    breakHead(r); r.W.power = true; run(r.S, 30, 0.25);
    ok('A12 power back with P latched and no live detection: still shut', r.pn.p.alive === true && r.v.p.pLatch === true && r.v.p.sol === false && r.s.state === 'dry');
  }
  // A13 spot detectors: alarm only in white space, detection leg in an electrical room
  {
    const r = rig({ det: 'smoke' }); breakHead(r); smoke(r.S, 2, 30);
    ok('A13 hall, spot only: alarm, no solenoid, no release even with P', r.S.sig.get('s' + r.d.id).type === 'ALARM' && r.v.p.pLatch === true && r.v.p.sol === false && r.s.state === 'dry');
    ok('A13 review fails a hall with only spot detection', fails(r.S, 'aspirating').length === 1);
    const e = rig({ det: 'smoke', room: 'elec' }); smoke(e.S, 2, 30);
    ok('A13 electrical room, one spot detector: detection leg on, no water yet', e.v.p.sol === true && e.s.state === 'dry');
    ok('A13 review accepts one spot detector in an electrical room', fails(e.S, 'releasing detection').length === 0);
    breakHead(e); ok('A13 electrical room: one spot detector + P trips', e.s.tripT > 0);
  }
  // A14 thresholds and the NFPA 76 preset
  {
    const r = rig();
    ok('A14 example thresholds pass review', fails(r.S, 'strictly increasing').length === 0 && DI.detThr(r.W).join() === '0.03,0.06,0.12,1.2');
    r.W.cfg.detThr = [0.03, 0.2, 0.12, 1.2]; ok('A14 non-increasing thresholds fail review', fails(r.S, 'strictly increasing').length === 1);
    r.W.cfg.detThr = [0.03, 0.06, 0.12, 1.2];
    ok('A14 NFPA 76 preset refused where not adopted', DI.applyDetPreset(r.W, 'nfpa76') !== '' && DI.detThr(r.W)[0] === 0.03 && DI.juris.nfpa76Adopted === false);
    r.W.cfg.nfpa76Adopted = true;
    ok('A14 NFPA 76 preset applies where adopted: Alert 0.2, Fire 1 1.0', DI.applyDetPreset(r.W, 'nfpa76') === '' && DI.detThr(r.W).join() === '0.2,0.6,1,1.2' && fails(r.S, 'strictly increasing').length === 0);
    smoke(r.S, 0.5, 10); ok('A14 thresholds are live: 0.5 is only Alert under the preset', r.d.p.lvl === 1 && r.v.p.sol === false);
    DI.setJuris(new DI.World(4, 4));
  }
  // A15 single- and non-interlock are gone; old saves migrate
  {
    ok('A15 preaction has no release mode', !('mode' in DI.PARTS.prev.props) && !('mode' in rig().v.p));
    const r = rig(), j = JSON.parse(JSON.stringify(r.W.toJSON())), old = j.parts.find((p) => p.type === 'prev');
    old.p.mode = 'single'; old.p.airSet = 20; delete old.p.hiAir; delete old.p.loAir; delete old.p.pTrip; delete old.p.trim; delete old.p.pLatch; delete old.p.mech;
    const q = DI.World.fromJSON(j).byType('prev')[0].p;
    ok('A15 a saved single-interlock valve loads as double interlock with preset setpoints', !('mode' in q) && [q.hiAir, q.airSet, q.loAir, q.pTrip].join() === '50,40,30,20' && q.trim === 'el-el' && q.pLatch === false && q.mech === false);
  }
  // A16 C = 100 on every segment
  {
    let n = 0, bad = 0;
    for (const sc of DI.SCEN) { const W = new DI.World(sc.w, sc.h); sc.build(W); const S = new DI.Sim(W); if (DI.BOT[sc.id]) DI.botBuild(S, sc.id); for (let k = 0; k < W.pd.length; k++) if (W.pd[k]) { n++; if (DI.pipeC(W, k) !== 100) bad++; } }
    ok('A16 C = 100 on every pipe tile of every scenario map', n > 3000 && bad === 0 && DI.HW_C === 100, n + ' tiles');
    // identical runs: wet in a room, wet outdoors, dry, dry with nitrogen tubed in -> identical pipe resistance
    const mk = (type, room, n2) => {
      const W = new DI.World(40, 10); if (room) W.addRoom('stor', 12, 2, 20, 6);
      W.addPart('city', 1, 5, 0, { stat: 80, resid: 60, flow: 1000 }); for (let x = 2; x < 10; x++) W.setPipe(x, 5, 6, 0);
      const v = W.addPart(type, 10, 5, 0); for (let x = 11; x < 20; x++) W.setPipe(x, 5, 6, 0); for (let x = 20; x < 28; x++) W.setPipe(x, 5, 1, 1, true);
      if (n2) { W.addPart('n2', 10, 3, 0); W.setAir(10, 4, 1); }
      W.spk[W.k(27, 5)] = 2;
      const S = { W, ss: new Map(), pT: new Float32Array(W.w * W.h), pP: new Map(), leaks: [] }; S.sysd = DI.findSystems(W); S.ss.set(v.id, { state: 'wet', wat: 0, P: 0 });
      const G = DI.buildGraph(W, S); let r = 0; for (const l of G.net.links) if (l.r !== undefined && !l.tag) r += l.r;
      return { r, n2: S.sysd.info.get(v.id).hasN2 };
    };
    const a = mk('wetv', true), b = mk('wetv', false), c = mk('dryv', false), d = mk('dryv', false, true), e = mk('prev', true, true);
    const hand = (DI.hw(100, 4.26) * 170 + DI.hw(100, 1.38) * 75) * DI.FIT;       // 8 + 9 tiles of 4 in. Sch 10 main (pipe to pipe 170 ft), 7.5 tiles of 1-1/4 in. branch
    ok('A16 identical runs give identical friction: wet indoors = wet outdoors = dry = dry on nitrogen', d.n2 === true && [b, c, d, e].every((x) => Math.abs(x.r - a.r) < 1e-15), a.r.toExponential(4));
    ok('A16 and it is the C = 100 hand value', Math.abs(a.r - hand) / hand < 1e-9, hand.toExponential(4));
  }
  // A17 pipe schedule
  {
    const today = [1.049, 1.38, 1.61, 2.067, 2.635, 3.26, 4.26, 6.357, 8.249, 10.37, 12.39];
    const W = new DI.World(30, 6); DI.PIPES.forEach((p, i) => { W.setPipe(i, 1, i, 0); W.setPipe(i, 3, i, 1); });
    const ids = (y) => DI.PIPES.map((p, i) => DI.pipeAt(W, W.k(i, y)).id);
    ok('A17 default policy: every size keeps today\'s inside diameter, main or branch', ids(1).join() === today.join() && ids(3).join() === today.join() && DI.PIPES.map((p) => p.id).join() === today.join() && DI.pipePolicy(W) === 'assumed');
    ok('A17 default policy: Sch 40 through 2 in., Sch 10 above', DI.PIPES.map((p, i) => DI.pipeAt(W, W.k(i, 1)).sch).join() === '40,40,40,40,10,10,10,10,10,10,10');
    W.cfg.pipePolicy = 'lock';
    ok('A17 lock policy: 2 in. main is 2.157 (Sch 10), 2 in. branch is 2.067 (Sch 40)', DI.pipeAt(W, W.k(3, 1)).id === 2.157 && DI.pipeAt(W, W.k(3, 1)).sch === 10 && DI.pipeAt(W, W.k(3, 3)).id === 2.067 && DI.pipeAt(W, W.k(3, 3)).sch === 40);
    ok('A17 lock policy: branch lines are Sch 40 at every size, mains under 2 in. stay Sch 40', DI.PIPES.every((p, i) => DI.pipeAt(W, W.k(i, 3)).id === p.id40) && DI.PIPES.every((p, i) => DI.pipeAt(W, W.k(i, 1)).id === (i < 3 ? p.id40 : p.id10)));
    ok('A17 volume follows the diameter', DI.PIPES.every((p, i) => { const q = DI.pipeAt(W, W.k(i, 1)); return Math.abs(q.gal - 0.0408 * q.id * q.id) < 1e-12; }) && Math.abs(DI.pipeAt(W, W.k(3, 1)).gal - 0.0408 * 2.157 * 2.157) < 1e-12);
    const V = new DI.World(30, 6); V.addPart('city', 1, 2, 0); const rv = V.addPart('wetv', 2, 2, 0); for (let x = 3; x < 13; x++) V.setPipe(x, 2, 3, 0);     // 100 ft of 2 in. main
    const S = new DI.Sim(V), v0 = S.sysd.info.get(rv.id).vol; V.cfg.pipePolicy = 'lock'; V.ver++; S.sync(); const v1 = S.sysd.info.get(rv.id).vol;
    ok('A17 system volume follows the policy: 100 ft of 2 in. main', Math.abs(v0 - 0.0408 * 2.067 * 2.067 * 100) < 1e-3 && Math.abs(v1 - 0.0408 * 2.157 * 2.157 * 100) < 1e-3, v0.toFixed(2) + ' -> ' + v1.toFixed(2) + ' gal');
  }
  // A18 enforced edition is a site setting; Canada is a hidden data row
  {
    const r = rig(), key = (rv) => rv.map((f) => f.sev + '|' + f.text).join('\n'), refs = (rv) => rv.map((f) => f.ref).join('\n');
    const base = DI.review(r.S);
    ok('A18 default edition is US-2025 with no delta', DI.EDITION_DEFAULT === 'US-2025' && DI.juris.nfpa13 === 2025 && DI.juris.delta.length === 0 && refs(base).includes('NFPA 13-2025'));
    let same = true, cited = true, delta = true;
    for (const ed of ['US-2019', 'US-2022']) { r.W.cfg.edition = ed; const rv = DI.review(r.S), yr = DI.JURIS[ed].nfpa13; same = same && key(rv) === key(base); cited = cited && refs(rv).includes('NFPA 13-' + yr) && !refs(rv).includes('NFPA 13-2025'); delta = delta && DI.juris.delta.length > 0; }
    ok('A18 2019 / 2022 change the citations and show a delta, not pass/fail', same && cited && delta);
    ok('A18 Canada is not offered in the menu', DI.editionChoices().join() === 'US-2019,US-2022,US-2025' && DI.JURIS['CA-2019'].hidden === true);
    const W2 = DI.World.fromJSON(JSON.parse(JSON.stringify(r.W.toJSON())));
    ok('A18 the setting is saved with the world', W2.cfg.edition === 'US-2022' && DI.setJuris(W2).nfpa13 === 2022);
    DI.setJuris(new DI.World(4, 4));
  }
  // trip test needs a live panel (the test operates detection through it)
  {
    const r = rig(); r.W.unwire(r.v.id);
    ok('trip test is refused on a preaction valve with no panel', DI.startTest(r.S, 'trip', r.v.id).includes('panel'));
  }
  // static checks on the sources
  {
    const dir = path.join(__dirname, '..', 'src'), src = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8'), ideas = readme.slice(readme.indexOf('## Ideas not built'));
    const none = (name, text, re) => { const m = text.match(re); ok('static: no ' + name, !m, m ? m[0] : undefined); };
    none('single / non release modes in src', src, /'single'|'non'/);
    none('C = 120 or 140 selection in src', src, /\? 120 :|120 : 140/);
    none('"C = 120" in src', src, /C = 120/); none('"C = 120" in README', readme, /C = 120/);
    none('global +/-10 psi air window', src, /airSet - 10|airSet \+ 10/);
    none('cross-zone text in src', src, /cross-zone/i);
    none('Fire 2 used as a release level', src, /lvl >= 4/);
    none('deluge / water mist / clean agent under README "Ideas not built"', ideas, /clean agent|water mist|deluge/i);
  }
}
console.log(fail ? fail + ' FAILED' : 'all sim tests passed'); process.exit(fail ? 1 : 0);
