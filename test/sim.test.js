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
// ====================== Cycle 1 acceptance (A1-A18: release logic, detection, hydraulics, company locks), then Cycle 2 (A19 onward)
{
  const fs = require('fs'), path = require('path');
  // a double-interlock rig: city main -> preaction valve -> one room of sprinklers, compressor, panel, one detector
  const rig = (o = {}) => {
    const W = new DI.World(40, 14); W.addRoom(o.room || 'hall', 20, 1, 12, 9);
    W.addPart('city', 1, 6, 0, { stat: 90, resid: 70, flow: 1500 }); hline(W, 2, 13, 6, 6);
    let g = null; if (o.gate) { W.erasePipe(10, 6); g = W.addPart('gate', 10, 6, 0); }                 // optional control valve upstream
    const v = W.addPart('prev', 14, 6, 0, o.props); hline(W, 15, 19, 6, 6);
    for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true); grid(W, 21, 2, 31, 9);
    W.addPart('comp', 14, 4, 0, { scfm: o.scfm || 5 }); W.setAir(14, 5, 1);
    const pn = W.addPart('panel', 16, 4, 0), d = W.addPart(o.det || 'vesda', 25, 1, 0), stn = o.stn ? W.addPart('mstn', 27, 1, 0) : null;   // optional manual station in the room
    W.wire(pn.id, v.id); W.wire(pn.id, d.id); if (g) W.wire(pn.id, g.id); if (stn) W.wire(pn.id, stn.id);
    const S = new DI.Sim(W); S.commission();
    return { W, S, v, s: S.ss.get(v.id), pn, d, g, stn, head: W.k(28, 5) };
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
    ok('A7 Alert: level 1, supervisory, solenoid off', r.d.p.lvl === 1 && r.S.sig.get('v' + r.d.id + '.1').type === 'SUPV' && !r.S.sig.has('v' + r.d.id + '.2') && r.v.p.sol === false);
    breakHead(r); smoke(r.S, 0.04, 30);
    ok('A7 Alert + latched P: still no release', r.v.p.pLatch === true && r.v.p.sol === false && r.s.state === 'dry' && r.s.wat === 0);
    const r2 = rig(); r2.S.live = true; breakHead(r2); smoke(r2.S, 0.07, 30);
    ok('A7 Action: level 2, supervisory, no release, no dispatch', r2.d.p.lvl === 2 && r2.S.sig.get('v' + r2.d.id + '.2').type === 'SUPV' && r2.v.p.sol === false && r2.s.state === 'dry' && r2.S.fd.called < 0);
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
    ok('A11 after 24 h the panel is dead and the valve is shut', r.pn.p.alive === false && r.S.sig.get('pd' + r.pn.id).text.includes('PANEL DEAD') && !r.S.sig.has('ac' + r.pn.id) && r.s.state === 'dry');
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
    ok('A17 default cut: every size keeps today\'s inside diameter, main or branch', ids(1).join() === today.join() && ids(3).join() === today.join() && DI.PIPES.map((p) => p.id).join() === today.join() && DI.pipeCut(W) === 3 && DI.PIPES[DI.pipeCut(W)].n === '2"');
    ok('A17 default cut: Sch 40 through 2 in., Sch 10 above', DI.PIPES.map((p, i) => DI.pipeAt(W, W.k(i, 1)).sch).join() === '40,40,40,40,10,10,10,10,10,10,10');
    ok('A17 cut 2 in.: 2 in. is 2.067 (Sch 40) and 2½ in. is 2.635 (Sch 10), main and branch alike', [1, 3].every((y) => DI.pipeAt(W, W.k(3, y)).id === 2.067 && DI.pipeAt(W, W.k(3, y)).sch === 40 && DI.pipeAt(W, W.k(4, y)).id === 2.635 && DI.pipeAt(W, W.k(4, y)).sch === 10));
    W.cfg.pipeCut = 5;
    ok('A17 cut 3 in.: 3 in. is 3.068 (Sch 40), 4 in. stays Sch 10, role does not matter', [1, 3].every((y) => DI.pipeAt(W, W.k(5, y)).id === 3.068 && DI.pipeAt(W, W.k(5, y)).sch === 40 && DI.pipeAt(W, W.k(4, y)).sch === 40 && DI.pipeAt(W, W.k(6, y)).sch === 10));
    ok('A17 volume follows the diameter', DI.PIPES.every((p, i) => { const q = DI.pipeAt(W, W.k(i, 1)); return Math.abs(q.gal - 0.0408 * q.id * q.id) < 1e-12; }) && Math.abs(DI.pipeAt(W, W.k(5, 1)).gal - 0.0408 * 3.068 * 3.068) < 1e-12);
    W.cfg.pipeCut = 99; ok('A17 a cut outside the offered sizes falls back to the default', DI.pipeCut(W) === 3 && DI.PIPE_CUTS.map((i) => DI.PIPES[i].n).join() === '1½",2",2½",3",4"');
    const V = new DI.World(30, 6); V.addPart('city', 1, 2, 0); const rv = V.addPart('wetv', 2, 2, 0); for (let x = 3; x < 13; x++) V.setPipe(x, 2, 5, 0);     // 100 ft of 3 in. main
    const S = new DI.Sim(V), v0 = S.sysd.info.get(rv.id).vol; V.cfg.pipeCut = 5; V.ver++; S.sync(); const v1 = S.sysd.info.get(rv.id).vol;
    ok('A17 system volume follows the cut: 100 ft of 3 in. main', Math.abs(v0 - 0.0408 * 3.26 * 3.26 * 100) < 1e-3 && Math.abs(v1 - 0.0408 * 3.068 * 3.068 * 100) < 1e-3, v0.toFixed(2) + ' -> ' + v1.toFixed(2) + ' gal');
    const old = JSON.parse(JSON.stringify(V.toJSON())); old.cfg = { pipePolicy: 'lock' }; const V2 = DI.World.fromJSON(old);
    ok('A17 pipePolicy in an old save is ignored: default cut, 3 in. back to Sch 10', !('pipePolicy' in V2.cfg) && DI.pipeCut(V2) === 3 && DI.pipeAt(V2, V2.k(3, 2)).id === 3.26 && typeof DI.pipePolicy === 'undefined' && typeof DI.PIPE_POLICY === 'undefined');
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
  // a broken pipe follows the tile, not the valve id it was broken under
  {
    const r = rig(); DI.X.pipeBreak('hall')(r.S); run(r.S, 60, 0.25);
    r.W.removePart(r.v.id); const v2 = r.W.addPart('prev', 14, 6, 0); r.W.wire(r.pn.id, v2.id); run(r.S, 900, 1);
    const s2 = r.S.ss.get(v2.id);
    ok('pipe break still vents after the valve is replaced: the new system cannot pressurize', r.S.leaks[0].sys === v2.id && s2.P < 5 && !s2.set, 'P=' + s2.P.toFixed(1));
    smoke(r.S, 0.2, 10); ok('and an unset valve does not release on detection', s2.state === 'dry' && s2.wat === 0);
  }
  // trip test needs a live panel (the test operates detection through it)
  {
    const r = rig(); r.W.unwire(r.v.id);
    ok('trip test is refused on a preaction valve with no panel', DI.startTest(r.S, 'trip', r.v.id).includes('panel'));
  }
  // ====================== Cycle 2 acceptance (A19 onward: truth table, signal classes, resets, thresholds, delivery, c5)
  const fixHead = (r) => { r.W.spk[r.head] = 1; r.S.spkVer++; };                    // head replaced by hand
  const c5 = DI.SCEN.find((q) => q.id === 'c5');
  // A19 release truth table: the FA Lead's fixture, read from the CSV as it stands (do not copy rows in here)
  {
    const TT = require('./truth-table.js'), res = TT.run(DI);
    ok('A19 fixture fixtures/di-release-truth-table.csv has rows R01 to R17 and the checked columns', res.length >= 17 && ['R01', 'R17'].every((n) => res.some((r) => r.row === n)) && TT.CHECKED.every((k) => k in res[0].want) && 'LocalNAC' in res[0].want);
    for (const r of res) ok('A19 ' + r.row + ' ' + r.trim + ': ' + TT.CHECKED.map((k) => k + ' ' + r.got[k]).join(', '), r.ok, r.ok ? undefined : 'fixture wants ' + r.diff.map((k) => k + ' ' + r.want[k]).join(', '));
    const off = TT.runRow(DI, Object.assign({}, res.find((r) => r.row === 'R14').want, { Bypass9c: '0' }));
    ok('A19 R14 with the bypass flag OFF: the Manual Release zone releases nothing', off.got.Solenoid === '0' && off.got.ValveOpen === '0' && off.got.D === '0');
  }
  // A20 signal classes
  {
    const r = rig(); breakHead(r); fixHead(r); run(r.S, 5, 0.25);
    const pl = () => r.S.sig.get('pl' + r.v.id);
    ok('A20 a latched P is class OPEN by default: release input, class not elected', pl().type === 'OPEN' && pl().text.startsWith('RELEASE INPUT - CLASS NOT ELECTED: P LATCHED (PSL-REL)') && DI.sigClass(r.W, 'pLatch') === 'OPEN');
    ok('A20 the P latch is in the panel event log', r.S.log.some((l) => l.text.startsWith('OPEN: RELEASE INPUT - CLASS NOT ELECTED: P LATCHED')));
    r.W.cfg.sigClass = { pLatch: 'SUPV' }; run(r.S, 1, 0.25);
    ok('A20 SUPV for a latched P is refused by DI.sigClass and failed by review', DI.sigClass(r.W, 'pLatch') === 'OPEN' && pl().type === 'OPEN' && fails(r.S, 'Supervisory is blocked').length === 1);
    let elect = true; for (const c of ['ALARM', 'TRBL']) { r.W.cfg.sigClass = { pLatch: c }; run(r.S, 1, 0.25); elect = elect && pl().type === c && DI.sigClass(r.W, 'pLatch') === c && fails(r.S, 'Signal class').length === 0 && !pl().text.includes('NOT ELECTED'); }
    ok('A20 ALARM and TRBL are accepted for a latched P', elect);
    const e = rig({ props: { trim: 'el-pn' } }); breakHead(e); fixHead(e); run(e.S, 5, 0.25);
    ok('A20 the same OPEN signal is raised on El/Pn (PA-REL)', e.S.sig.get('pl' + e.v.id).type === 'OPEN' && e.S.sig.get('pl' + e.v.id).text.includes('P LATCHED (PA-REL)'));
    const a = rig(); smoke(a.S, 0.07, 10);
    const st = (i) => a.S.sig.get('v' + a.d.id + '.' + i);
    ok('A20 Alert and Action are supervisory by default', st(1).type === 'SUPV' && st(2).type === 'SUPV' && DI.sigClass(a.W, 'alert') === 'SUPV' && DI.sigClass(a.W, 'action') === 'SUPV');
    a.W.cfg.sigClass = { alert: 'ALARM', action: 'ALARM' }; run(a.S, 1, 0.25);
    ok('A20 Alert and Action follow their config, and still release nothing', st(1).type === 'ALARM' && st(2).type === 'ALARM' && a.v.p.sol === false && fails(a.S, 'Signal class').length === 0);
    a.W.cfg.sigClass = { alert: 'TRBL' }; ok('A20 any other class for Alert falls back to supervisory and fails review', DI.sigClass(a.W, 'alert') === 'SUPV' && fails(a.S, 'Signal class of the alert stage').length === 1);
    const V = a.S.sysd.info.get(a.v.id).vol; a.W.cfg.sigClass = { alert: 'ALARM', action: 'ALARM', pLatch: 'ALARM' }; a.s.G = (55 + DI.ATM) * V; run(a.S, 2, 0.25);
    const lo = rig({ scfm: 0.5 }); lo.W.cfg.sigClass = { alert: 'ALARM', action: 'ALARM', pLatch: 'ALARM' }; lo.s.holes = 35; lo.S.warp(8 * 3600);
    ok('A20 low and high air stay supervisory whatever is elected', a.S.sig.get('ha' + a.v.id).type === 'SUPV' && lo.S.sig.get('la' + lo.v.id).type === 'SUPV');
  }
  // A21 reset model: panel reset, trim reset, riser reset
  {
    const a = rig(); breakHead(a); fixHead(a); DI.panelReset(a.S, a.pn.id); run(a.S, 2, 0.25);
    ok('A21 El/El: a panel reset while the pipe is still below P trip latches again', a.v.p.pLatch === true && a.s.P < a.v.p.pTrip, 'P=' + a.s.P.toFixed(1));
    run(a.S, 1500, 1); DI.panelReset(a.S, a.pn.id); run(a.S, 30, 0.25);
    ok('A21 El/El: with the pipe above P trip a panel reset clears P and it stays clear', a.v.p.pLatch === false && a.s.P > a.v.p.pTrip && !a.S.sig.has('pl' + a.v.id));
    ok('A21 El/El: a trim reset is refused and names the panel', DI.resetTrimP(a.S, a.v.id) === 'On an electric / electric trim P is latched in the releasing panel. Reset the panel.');
    const b = rig({ props: { trim: 'el-pn' } }); breakHead(b); fixHead(b); run(b.S, 1500, 1); DI.panelReset(b.S, b.pn.id); run(b.S, 5, 0.25);
    ok('A21 El/Pn: a panel reset does not clear P, even with the air back', b.v.p.pLatch === true && b.s.P > b.v.p.pTrip && b.S.log.some((l) => l.text.includes('reset it at the trim')));
    ok('A21 El/Pn: the trim reset clears P and it stays clear', DI.resetTrimP(b.S, b.v.id) === '' && (run(b.S, 30, 0.25), b.v.p.pLatch === false));
    const c = rig({ props: { trim: 'el-pn' } }); breakHead(c); fixHead(c);
    ok('A21 El/Pn: a trim reset while the pipe is still low latches again', DI.resetTrimP(c.S, c.v.id) === '' && c.v.p.pLatch === false && (run(c.S, 2, 0.25), c.v.p.pLatch === true));
    const d = rig(); breakHead(d); fixHead(d); run(d.S, 1500, 1); smoke(d.S, 0.2, 10); d.S.smoke[1] = 0; run(d.S, 30, 0.25);
    const tripped = d.s.state !== 'dry' && d.v.p.tripped; DI.panelReset(d.S, d.pn.id); run(d.S, 5, 0.25);
    ok('A21 a panel reset never closes a tripped valve', tripped && d.s.state !== 'dry' && d.v.p.tripped === true && d.v.p.sol === false);
    let riser = true, early = true, late = true;
    for (const trim of ['el-el', 'el-pn']) {
      const e = rig({ props: { trim } }); e.v.p.mech = true; run(e.S, 5, 0.25); e.v.p.pLatch = true; e.s.wat = 0; e.s.flow = 0;      // tripped, then drained with the supply shut
      riser = riser && DI.resetValve(e.S, e.v.id) === '' && e.v.p.pLatch === true && e.v.p.mech === false && e.s.state === 'dry';
      const reset = () => (trim === 'el-el' ? DI.panelReset(e.S, e.pn.id) : DI.resetTrimP(e.S, e.v.id));
      reset(); run(e.S, 2, 0.25); early = early && e.v.p.pLatch === true && !e.s.set;           // empty pipe after the riser reset: the sensor reads low
      run(e.S, 1800, 1); late = late && e.s.set && e.v.p.pLatch === true; reset(); run(e.S, 30, 0.25); late = late && e.v.p.pLatch === false && e.s.state === 'dry';
    }
    ok('A21 a riser reset never clears P on either trim (it closes the clapper and the emergency release)', riser);
    ok('A21 after a riser reset an early reset latches straight back on both trims', early);
    ok('A21 once the air is back the reset for that trim clears P and the valve is in service', late);
    const n = new DI.World(40, 14); n.addRoom('hall', 20, 1, 12, 9); n.addPart('city', 1, 6, 0, { stat: 90, resid: 70, flow: 1500 }); hline(n, 2, 13, 6, 6);
    const nv = n.addPart('prev', 14, 6, 0); hline(n, 15, 19, 6, 6); for (let y = 2; y <= 9; y++) n.setPipe(20, y, 4, 0, true); grid(n, 21, 2, 31, 9); n.addPart('comp', 14, 4, 0); n.setAir(14, 5, 1);
    const nS = new DI.Sim(n); run(nS, 1800, 1);
    ok('A21 a new valve does not latch P during its first air-up (the sensor is live from the first set)', nS.ss.get(nv.id).set && nv.p.pLatch === false && nS.ss.get(nv.id).armed === true);
    ok('A21 review tells an unwired El/El valve where its P latch lives', DI.review(nS).some((f) => f.sev === 'fail' && f.text.includes('P is latched in the panel; wire the valve to a panel to reset it.')));
    ok('A21 the P latch message names only the reset path of the trim', a.S.log.some((l) => /P latched .*PSL-REL.* until the releasing panel is reset\.$/.test(l.text)) && b.S.log.some((l) => /P latched .*PA-REL.* until the actuator is reset at the trim\.$/.test(l.text))
      && !a.S.log.some((l) => l.text.includes('at the trim')) && !c.S.log.some((l) => /P latched.*panel/.test(l.text)));
    const t = rig(); breakHead(t); fixHead(t); run(t.S, 1500, 1);
    ok('A21 a timed trip test is refused while P is latched', DI.startTest(t.S, 'trip', t.v.id).startsWith('P is latched.'));
  }
  // A22 detection thresholds: listed windows, strict order, NFPA 76
  {
    const r = rig(), out = (S) => fails(S, 'outside the listed window');
    ok('A22 example thresholds and the spot default sit inside the listed windows', out(r.S).length === 0 && DI.spotThr(r.W) === 1.3 && DI.LISTED.smoke.min === 0.5 && DI.LISTED.smoke.max === 4.0 && DI.LISTED.vesda.assumed === true);
    r.W.cfg.detThr = [0.03, 0.06, 50, 60];
    ok('A22 Fire 1 = 50 is outside the aspirating window and fails, citing the listing', out(r.S).some((f) => f.text.includes('Fire 1 threshold 50') && f.ref.includes('NFPA 72 Ch. 14')) && out(r.S).some((f) => f.text.includes('Fire 2 threshold 60')));
    r.W.cfg.detThr = [0.03, 0.06, 0.12, 6]; ok('A22 Fire 2 alone outside the window fails', out(r.S).length === 1 && out(r.S)[0].text.includes('Fire 2'));
    delete r.W.cfg.detThr; r.W.cfg.spotThr = 9; ok('A22 a spot threshold of 9 fails', out(r.S).length === 1 && out(r.S)[0].text.includes('Spot detector alarm threshold 9'));
    r.W.cfg.spotThr = 1.3; ok('A22 a spot threshold of 1.3 passes', out(r.S).length === 0);
    r.W.cfg.nfpa76Adopted = true; ok('A22 NFPA 76 adopted: the example values pass', fails(r.S, 'NFPA 76 is adopted').length === 0);
    r.W.cfg.detThr = [0.3, 0.6, 2.0, 3.0];
    ok('A22 NFPA 76 adopted with Fire 1 = 2.0 fails (and Alert 0.3 with it)', fails(r.S, 'NFPA 76 is adopted').length === 2 && fails(r.S, 'Fire 1 must be 1 %/ft or less').length === 1);
    ok('A22 the NFPA 76 preset passes', DI.applyDetPreset(r.W, 'nfpa76') === '' && fails(r.S, 'NFPA 76 is adopted').length === 0 && fails(r.S, 'strictly increasing').length === 0);
    r.W.cfg.nfpa76Adopted = false; ok('A22 where NFPA 76 is not adopted its limits are not applied', fails(r.S, 'NFPA 76 is adopted').length === 0);
    const e = rig({ det: 'smoke', room: 'elec' }); e.W.cfg.spotThr = 3; smoke(e.S, 2, 10);
    ok('A22 the spot threshold is live: 2.0 does not alarm at a setting of 3', e.d.p.lvl === 0 && e.v.p.sol === false); e.W.cfg.spotThr = 1.3; smoke(e.S, 2, 5); ok('A22 and it alarms at 1.3', e.d.p.lvl === 1 && e.v.p.sol === true);
    DI.setJuris(new DI.World(4, 4));
  }
  // A23 zone volume and the NFPA / FM delivery limits
  {
    const W = new DI.World(4, 4), near = (a, b) => Math.abs(a - b) < 1e-9, R = DI.deliveryRule;
    ok('A23 480 gal of pipe is a 506.0 gal zone (5 % fittings + 2 gal trim, ASSUMED defaults)', near(DI.zoneVolume(W, { vol: 480 }), 506) && DI.cfgNum(W, 'fitPct') === 5 && DI.cfgNum(W, 'trimGal') === 2);
    const z0 = DI.zoneVolume(W, { vol: 460 }); W.cfg.fitPct = 10; W.cfg.trimGal = 5; const z1 = DI.zoneVolume(W, { vol: 460 });
    ok('A23 fittings 10 % and trim 5 gal move the zone volume and the exemption', near(DI.zoneVolume(W, { vol: 480 }), 533) && near(z0, 485) && near(z1, 511) && R('prev', false, z0, 'none').nfpa.limit === null && R('prev', false, z1, 'none').nfpa.limit === 60);
    ok('A23 DI: a 500.0 gal zone is exempt and 500.1 is not', R('prev', false, 500, 'none').nfpa.limit === null && R('prev', false, 500, 'none').governing === null && R('prev', false, 500.1, 'none').nfpa.limit === 60 && R('prev', false, 500.1, 'none').by === 'NFPA');
    ok('A23 DI: a quick-opening device does not change the result', [500, 500.1, 700, 750.1].every((z) => R('prev', true, z, 'none').nfpa.limit === R('prev', false, z, 'none').nfpa.limit) && R('prev', true, 700, 'none').nfpa.limit === 60);
    ok('A23 dry: exempt at 500 gal without a QOD and at 750 gal with one', R('dryv', false, 500, 'none').nfpa.limit === null && R('dryv', false, 500.1, 'none').nfpa.limit === 60 && R('dryv', true, 750, 'none').nfpa.limit === null && R('dryv', true, 750.1, 'none').nfpa.limit === 60);
    ok('A23 wet: no delivery limit and no delivery line', R('wetv', false, 900, 'FM').governing === null && R('wetv', false, 900, 'FM').nfpa.rule === '' && R('wetv', false, 900, 'FM').fm.limit === null);
    const f = R('prev', false, 400, 'FM'), g = R('prev', false, 520, 'FM'), h = R('dryv', true, 600, 'FM');
    ok('A23 FM: a 400 gal DI zone is still limited to 30 s', f.nfpa.limit === null && f.fm.limit === 30 && f.governing === 30 && f.by === 'FM' && f.fm.rule === 'FM: 30 s (any volume, DS 5-32, NEEDS PE REVIEW)');
    ok('A23 FM: the smaller limit governs, for dry and DI alike', g.nfpa.limit === 60 && g.governing === 30 && g.by === 'FM' && h.governing === 30 && R('prev', false, 520, 'none').governing === 60 && R('prev', false, 520, 'none').fm.rule === 'FM: not applied');
    const r = rig(); r.W.cfg.insurer = 'FM';
    const m = DI.deliveryLimits(r.S, r.v.id, 37), u = DI.deliveryLimits(r.S, r.v.id);
    ok('A23 margin = governing - measured, null when nothing was measured', m.governing === 30 && m.margin === -7 && u.margin === null && near(m.zone, m.pipe * 1.05 + 2) && DI.insurer(r.W) === 'FM');
    ok('A23 review shows an FM row as information, not a failure', DI.review(r.S).some((q) => q.sev === 'info' && q.text.includes('insurer is FM') && q.ref.includes('FM DS 5-32')) && fails(r.S, 'FM').length === 0);
    r.W.cfg.insurer = 'Lloyds'; ok('A23 any other insurer value means none', DI.insurer(r.W) === 'none' && DI.deliveryLimits(r.S, r.v.id).governing === null);
  }
  // A24 delivery citations are keyed by edition
  {
    const J = DI.JURIS, a = J['US-2019'].ref, b = J['US-2025'].ref, c = J['US-2022'].ref, set = (ed) => { const W = new DI.World(4, 4); W.cfg.edition = ed; DI.setJuris(W); };
    ok('A24 2019 cites §8.2.3.2, §8.2.3.3, §8.2.3.4 and Table 8.2.3.6.1', a.timedTest.endsWith('2019 §8.2.3.2') && a.noQod.endsWith('§8.2.3.3') && a.qod.endsWith('§8.2.3.4') && a.table.endsWith('Table 8.2.3.6.1'));
    ok('A24 2025 cites §8.2.4 and Table 8.2.4.3.2', b.timedTest.endsWith('2025 §8.2.4') && b.noQod.endsWith('§8.2.4') && b.qod.endsWith('§8.2.4') && b.table.endsWith('Table 8.2.4.3.2'));
    ok('A24 the DI exemption is §8.3.2.3.1.1 in 2019 and 2025, QOD help §8.3.2.3.2', a.di.endsWith('2019 §8.3.2.3.1.1') && b.di.endsWith('2025 §8.3.2.3.1.1') && a.diQod.endsWith('§8.3.2.3.2') && b.diQod.endsWith('§8.3.2.3.2'));
    ok('A24 every 2022 delivery reference is marked VERIFY', ['delivery', 'timedTest', 'noQod', 'qod', 'table', 'di', 'diQod'].every((k) => c[k].includes('2022') && c[k].includes('VERIFY')) && J['US-2022'].delta.join(' ').includes('VERIFY'));
    set('US-2019'); const d19 = [DI.deliveryRule('dryv', false, 600, 'none').nfpa.ref, DI.deliveryRule('dryv', false, 400, 'none').nfpa.ref, DI.deliveryRule('dryv', true, 600, 'none').nfpa.ref, DI.deliveryRule('prev', false, 600, 'none').nfpa.rule];
    set('US-2025'); const d25 = DI.deliveryRule('dryv', false, 600, 'none').nfpa.rule;
    ok('A24 the rule follows the site edition', d19[0] === 'NFPA 13-2019 §8.2.3.2' && d19[1] === 'NFPA 13-2019 §8.2.3.3' && d19[2] === 'NFPA 13-2019 §8.2.3.4' && d19[3] === 'NFPA 13: 60 s (over 500 gal) [NFPA 13-2019 §8.3.2.3.1.1]' && d25 === 'NFPA 13: 60 s (over 500 gal) [NFPA 13-2025 §8.2.4]');
    DI.setJuris(new DI.World(4, 4));
  }
  // A25 contract 5 as a lesson: the deliberate tip-over, the recovery score, the air test report
  {
    const { S } = DI.buildScenario(c5), sol = DI.botBuild(S, 'c5'); S.warp(sol.settle);
    for (const [kind, id] of sol.tests) { DI.startTest(S, kind, id); S.warp(420); sol.after(S, kind, id); }
    const trips = S.results.filter((r) => r.kind === 'trip'), big = trips.find((r) => r.pipe > 490), rv = DI.review(S);
    ok('A25 c5: the 498 gal zone reports zone 525 gal (pipe 498), over 500', !!big && big.lines[0] === 'Zone volume: 525 gal (pipe 498)' && big.zone > 500 && big.pipe < 500 && big.nfpa === 60, big && big.lines[0]);
    ok('A25 c5: it passes by the 60 s timed test at about 55.5 s', big.pass && Math.abs(big.val - 55.5) < 1.5 && big.governing === 60 && big.by === 'NFPA' && Math.abs(big.margin - (60 - big.val)) < 1e-9, big.val.toFixed(1) + ' s');
    ok('A25 c5: the report marks the governing line and names the table route as not modelled', big.lines[big.gov].startsWith('Governing: NFPA 60 s, margin +') && big.lines.some((l) => l.startsWith('Calc / table alternative: Ordinary Hazard Group 1 50 s, not modelled')) && big.lines.includes('FM: not applied'));
    ok('A25 c5: review warns on that zone and on no other', rv.filter((f) => f.sev === 'warn' && f.text.includes('is over 500 gal')).length === 1 && rv.some((f) => f.text.includes('zone volume 525 gal (pipe 498)') && f.text.includes('or rezone')) && !rv.some((f) => f.sev === 'fail'));
    const fm = DI.deliveryRule('prev', false, big.zone, 'FM');
    ok('A25 c5: with FM set the same zone passes NFPA 13 and fails FM', big.val <= fm.nfpa.limit && big.val > fm.fm.limit && fm.by === 'FM' && fm.governing - big.val < 0);
    const sc = [...S.sysd.info.keys()].map((id) => DI.recoveryScore(S, id));
    ok('A25 c5: the reference bot recovers every valve 8 of 8 steps, in order', sc.length === 3 && sc.every((q) => q && q.done === 8 && q.total === 8 && q.complete && q.inOrder && q.closed && q.time > 0), sc.map((q) => q && q.done + '/' + q.total + (q.inOrder ? ' in order' : ' out of order')).join(', '));
    ok('A25 c5: all seven goals are met with default settings, the recovery goal among them', DI.botCheck(S, c5).every(Boolean) && c5.goals.length === 7 && c5.goals.some((q) => q.t.startsWith('Recovery done in order')));
    ok('A25 c5: the drill has no hard timer and the false alarm comes after the 30 min air-restore window', c5.drill.steps().some((st) => st[0] === 2100 && /dust/.test(st[2])) && c5.drill.len === 5600 && DI.RECOVERY_TARGET === 660);
    const S2 = new DI.Sim(DI.World.fromJSON(JSON.parse(JSON.stringify(S.W.toJSON())))); S2.restore(JSON.parse(JSON.stringify(S.dump())));
    ok('A25 the recovery log is saved with the game', [...S2.sysd.info.keys()].every((id) => { const q = DI.recoveryScore(S2, id); return q && q.complete && q.inOrder; }));
    // one run that passes NFPA 13 at 60 s and fails FM at 30 s: valve A with enough fittings allowance to pass 500 gal
    const F = DI.buildScenario(c5, { insurer: 'FM', fitPct: 40 }), fsol = DI.botBuild(F.S, 'c5'); F.S.warp(fsol.settle);
    const [kind, id] = fsol.tests[0]; DI.startTest(F.S, kind, id); F.S.warp(420); const fr = DI.lastResult(F.S, 'trip', id);
    ok('A25 FM: a 37 s zone passes NFPA 60 s and fails FM 30 s on the same run', !!fr && !fr.pass && fr.zone > 500 && fr.nfpa === 60 && fr.fm === 30 && fr.val > 30 && fr.val < 60 && fr.by === 'FM' && fr.governing === 30 && fr.margin < 0, fr && fr.lines.slice(2).join(' | '));
    ok('A25 FM: the report highlights the governing line', fr.lines[fr.gov].startsWith('Governing: FM 30 s, margin −') && fr.lines.some((l) => l.startsWith('NFPA 13: 60 s (over 500 gal)')) && fr.lines.includes('FM: 30 s (any volume, DS 5-32, NEEDS PE REVIEW)'));
    const r = rig(); DI.startTest(r.S, 'leak', r.v.id); r.S.warp(86500); const lk = DI.lastResult(r.S, 'leak', r.v.id);
    ok('A25 24 h air test report: start, end, drop and allowed loss, and no mention of P', lk.lines.length === 2 && /^Start: [\d.]+ psi, end: [\d.]+ psi$/.test(lk.lines[0]) && /^Drop: [\d.]+ psi in 24 h, allowed 1\.5 psi$/.test(lk.lines[1]) && !/\bP\b|latch/i.test(lk.title + lk.lines.join(' ')), lk.lines.join(' | '));
  }
  // A26 recovery score: order, the early reset, the El/Pn trim step
  {
    const start = (o) => { const r = rig(Object.assign({ gate: true }, o)); DI.breakSprinkler(r.S, r.head); run(r.S, 60, 0.25); return r; };
    const shut = (r) => { r.g.p.target = 0; run(r.S, 6, 0.25); }, drain = (r, on) => { r.v.p.sdrain = on; r.S.touch(); run(r.S, 2, 0.25); };
    const air = (r) => { r.g.p.target = 1; run(r.S, 1800, 1); }, score = (r) => DI.recoveryScore(r.S, r.v.id);
    const a = start(); ok('A26 a broken head opens an incident and P latches without a trip', a.v.p.pLatch === true && a.s.state === 'dry' && score(a).why === 'head' && score(a).done < 8);
    DI.silence(a.S, a.pn.id); ok('A26 find-head counts only on an operated head', DI.findHead(a.S, a.head) === true && DI.findHead(a.S, a.head - 1) === false);
    shut(a); drain(a, 1); ok('A26 replacing the head is logged', DI.replaceSprinklers(a.S, a.v.id) === ''); drain(a, 0);
    DI.panelReset(a.S, a.pn.id); run(a.S, 2, 0.25);
    ok('A26 a reset before the air is back latches P again and scores nothing', a.v.p.pLatch === true && !score(a).steps.find((q) => q.kind === 'reset-panel').done && !score(a).complete);
    air(a); ok('A26 air restored, P still latched: not yet in service', a.v.p.pLatch === true && score(a).steps.find((q) => q.kind === 'restore-air').done && !score(a).closed);
    DI.panelReset(a.S, a.pn.id); run(a.S, 2, 0.25); const sa = score(a);
    ok('A26 El/El in order: 8 of 8 (no actuator to reset at the trim), in order, back in service', sa.done === 8 && sa.complete && sa.inOrder && sa.closed && sa.time > 0 && sa.steps.find((q) => q.kind === 'reset-trim').na && a.v.p.pLatch === false, sa.steps.map((q) => q.kind + (q.na ? ' n/a' : '@' + Math.round(q.t))).join(' '));
    ok('A26 silence is acknowledged at the panel and a new signal resounds it', a.pn.p.silenced === false && a.S.log.some((l) => l.text.startsWith('Panel silenced')));
    const b = start(); DI.replaceSprinklers(b.S, b.v.id); DI.findHead(b.S, b.head); shut(b); drain(b, 1); drain(b, 0); DI.silence(b.S, b.pn.id); air(b); DI.panelReset(b.S, b.pn.id); run(b.S, 2, 0.25);
    ok('A26 the same steps done out of order do not score as a clean recovery', score(b).complete === false || score(b).inOrder === false, score(b).done + '/8 ' + score(b).inOrder);
    const c = start({ props: { trim: 'el-pn' } }); DI.silence(c.S, c.pn.id); DI.findHead(c.S, c.head); shut(c); drain(c, 1); DI.replaceSprinklers(c.S, c.v.id); drain(c, 0); air(c);
    DI.panelReset(c.S, c.pn.id); run(c.S, 2, 0.25);
    ok('A26 El/Pn: without the trim reset the recovery is 7 of 8 and P is still latched', score(c).done === 7 && c.v.p.pLatch === true && !score(c).steps.find((q) => q.kind === 'reset-trim').na);
    DI.resetTrimP(c.S, c.v.id); run(c.S, 2, 0.25); ok('A26 El/Pn: trim reset after the panel reset is complete but out of order', score(c).complete && !score(c).inOrder && c.v.p.pLatch === false);
    const d = start({ props: { trim: 'el-pn' } }); DI.silence(d.S, d.pn.id); DI.findHead(d.S, d.head); shut(d); drain(d, 1); DI.replaceSprinklers(d.S, d.v.id); drain(d, 0); air(d);
    DI.resetTrimP(d.S, d.v.id); run(d.S, 1, 0.25); DI.panelReset(d.S, d.pn.id); run(d.S, 2, 0.25);
    ok('A26 El/Pn: restore air, reset the trim, reset the panel is 8 of 8 in order', score(d).done === 8 && score(d).complete && score(d).inOrder && score(d).closed);
    DI.breakSprinkler(d.S, d.head); run(d.S, 5, 0.25); ok('A26 a new incident starts a new score', score(d).done < 8 && DI.recoveryScore(d.S, d.v.id, 0).complete);
  }
  // A27 site gate: contract settings and the Manual Release zone bypass as an impairment
  {
    const r = rig(); r.W.cfg.manualReleaseBypassP = true; run(r.S, 2, 0.25);
    ok('A27 sandbox / free build: the bypass is a plain setting, no impairment signal', !r.S.sig.has('im' + r.v.id) && !r.S.contract && DI.stationType(r.W, r.v) === 'MANUAL RELEASE');
    const C = DI.buildScenario(c5, { manualReleaseBypassP: true }); DI.botBuild(C.S, 'c5'); run(C.S, 2, 0.25);
    const vs = C.W.byType('prev'), im = vs.map((v) => C.S.sig.get('im' + v.id));
    ok('A27 a contract built with the bypass on raises a supervisory impairment on every El/El valve', C.S.contract === true && vs.length === 3 && im.every((o) => o && o.type === 'SUPV' && o.text.startsWith('IMPAIRMENT - Manual Release zone bypasses P (Preaction system #')) && C.S.log.some((l) => l.text.startsWith('SUPV: IMPAIRMENT')));
    DI.loadTrim(vs[0], 'el-pn'); C.W.ver++; run(C.S, 2, 0.25);
    ok('A27 no impairment on an El/Pn valve: the bypass does not apply there', !C.S.sig.has('im' + vs[0].id) && C.S.sig.has('im' + vs[1].id));
    ok('A27 review keeps its NEEDS PE REVIEW warning in a contract', DI.review(C.S).some((f) => f.sev === 'warn' && f.text.includes('NEEDS PE REVIEW') && f.text.includes('Manual Release zone')));
    const fake = { w: 20, h: 10, money: 5, build() {}, cfg: { insurer: 'FM', fitPct: 8 } }, B = DI.buildScenario(fake);
    ok('A27 sc.cfg is merged into the site settings when a contract is built', B.W.cfg.insurer === 'FM' && B.W.cfg.fitPct === 8 && B.S.contract === true && B.W.money === 5 && fake.cfg.insurer === 'FM');
    ok('A27 no contract fixes a site setting this cycle: every one is winnable with the defaults', DI.SCEN.every((q) => !q.cfg) && Object.keys(DI.buildScenario(c5).W.cfg).length === 0);
  }
  // A28 manual release station: a wired device inside D
  {
    const r = rig({ stn: true }); r.stn.p.on = true; run(r.S, 60, 0.25);
    ok('A28 station operated with full air: alarm, D, no release', r.S.sig.get('mn' + r.stn.id).type === 'ALARM' && r.S.sig.get('ms' + r.v.id).text.startsWith('MANUAL STATION (DETECTION)') && r.v.p.pull === true && DI.relState(r.W, r.v).D && r.v.p.solOut === false && r.s.state === 'dry');
    DI.panelReset(r.S, r.pn.id); const dropped = r.v.p.pull === false; run(r.S, 1, 0.25);
    ok('A28 a panel reset re-reads the station: still operated, so D comes straight back', dropped && r.v.p.pull === true && r.S.log.some((l) => l.text.includes('manual station(s) are still in alarm')));
    breakHead(r); ok('A28 station + P releases', r.s.tripT > 0 && r.v.p.solOut === true);
    const u = rig({ stn: true }); u.W.unwire(u.stn.id); u.stn.p.on = true; breakHead(u);
    ok('A28 an unwired station is local only and releases nothing', u.v.p.pull === false && u.s.state === 'dry' && u.S.sig.get('mn' + u.stn.id).mon === false && DI.review(u.S).some((f) => f.text.includes('Manual release station') && f.text.includes('not wired')));
    const o = rig({ stn: true }); o.W.partAt[o.W.k(o.stn.x, o.stn.y)] = 0; o.stn.x = 5; o.stn.y = 1; o.W.partAt[o.W.k(5, 1)] = o.stn.id; o.W.ver++; o.stn.p.on = true; breakHead(o);
    ok('A28 a station outside the protected room raises the alarm and releases nothing', o.v.p.pull === false && o.s.state === 'dry' && o.S.sig.has('mn' + o.stn.id) && DI.review(o.S).some((f) => f.sev === 'warn' && f.text.includes('not in a room protected by a preaction valve')));
    const d = rig({ stn: true }); d.W.power = false; d.pn.p.battH = 0; d.stn.p.on = true; breakHead(d);
    ok('A28 dead panel + manual pull + P never releases', d.pn.p.alive === false && d.v.p.pull === false && d.v.p.solOut === false && d.s.state === 'dry' && d.v.p.pLatch === true);
    const m = rig({ stn: true }); m.W.cfg.manualReleaseBypassP = true; m.stn.p.on = true; run(m.S, 5, 0.25);
    ok('A28 with the bypass ON on El/El the station is typed MANUAL RELEASE and releases without P', m.s.tripT > 0 && m.v.p.pLatch === false && m.S.sig.get('ms' + m.v.id).text.startsWith('MANUAL RELEASE ZONE (BYPASSES P)') && DI.relState(m.W, m.v).D === false);
    ok('A28 contract 5 offers the station', c5.parts.includes('mstn') && DI.PARTS.mstn.cat === 'alarm');
  }
  // A29 solenoid output by trim (C2-2)
  {
    const a = rig(); smoke(a.S, 0.2, 10);
    ok('A29 El/El: Fire 1 alone latches D and leaves the solenoid de-energized', a.v.p.sol === true && a.v.p.solOut === false && !a.S.sig.has('rl' + a.v.id) && a.S.sig.get('v' + a.d.id + '.3').type === 'ALARM');
    const b = rig({ props: { trim: 'el-pn' } }); smoke(b.S, 0.2, 10);
    ok('A29 El/Pn: Fire 1 alone energizes the solenoid, and the valve still needs P', b.v.p.solOut === true && b.S.sig.get('rl' + b.v.id).type === 'ALARM' && b.s.state === 'dry');
    breakHead(a); ok('A29 El/El: D AND P energizes the solenoid and opens the valve', a.v.p.solOut === true && a.s.tripT > 0 && a.S.sig.has('rl' + a.v.id));
    a.W.power = false; a.pn.p.battH = 0; run(a.S, 1, 0.25); ok('A29 a dead panel drops the solenoid output', a.v.p.solOut === false && a.v.p.sol === false);
  }
  // A30 play-test findings (Addendum A)
  {
    const r = rig(); breakHead(r); const n0 = r.S.log.length; r.S.smoke[1] = 5; r.S.step(0.25); r.S.smoke[1] = 5; r.S.step(0.25);
    const L = r.S.log.slice(n0), at = (w) => L.findIndex((l) => l.text.includes(w)), order = ['VESDA ALERT', 'VESDA ACTION', 'VESDA FIRE 1', 'VESDA FIRE 2', 'latched detection (D)', 'energized the solenoid', 'TRIPPED'].map(at);
    ok('A30 a jump straight to Fire 2 logs Alert, Action, Fire 1, Fire 2 in order, before any release entry', order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), order.join());
    ok('A30 the four stage entries carry the same sim time', new Set(order.slice(0, 4).map((i) => L[i].t)).size === 1);
    const rows = [1, 2, 3, 4].map((i) => r.S.sig.get('v' + r.d.id + '.' + i));
    ok('A30 the annunciator holds every stage crossed; only the highest is an active signal', rows.every(Boolean) && new Set(rows.map((o) => o.t0)).size === 1 && rows.slice(0, 3).every((o) => o.sup === true) && !rows[3].sup && rows[3].type === 'ALARM' && [...r.S.sig.keys()].filter((k) => k[0] === 'v').join() === rows.map((o) => o.key).join());
    const W = new DI.World(40, 14); W.addRoom('office', 20, 2, 12, 8); W.addPart('city', 1, 6, 0); hline(W, 2, 13, 6, 6); const wv = W.addPart('wetv', 14, 6, 0); hline(W, 15, 19, 6, 6); W.setPipe(20, 6, 6, 0, true);
    const S = new DI.Sim(W); S.commission(); S.rv = DI.review(S); const c = DI.hydCalc(S, wv.id);
    ok('A30 one head in an uncovered room: the hydraulic calc is never an unqualified PASS', c.ok && c.pass && c.covOk === false && c.verdict === 'PASS (hydraulics only); coverage FAIL, see plan review' && fails(S, 'tiles have no sprinkler').length === 1, c.verdict);
    for (let y = 2; y <= 9; y++) W.setPipe(20, y, 6, 0, true);                // a main up the room, so every branch line reaches the riser
    for (let y = 2; y <= 9; y++) for (let x = 21; x <= 31; x++) W.setPipe(x, y, 3, 1, true); S.sync(); const c2 = DI.hydCalc(S, wv.id);
    ok('A30 with the room covered and every head on the riser the verdict is the plain hydraulic result', fails(S, 'not connected to any system riser').length === 0 && fails(S, 'tiles have no sprinkler').length === 0 && c2.covOk === true && (c2.verdict === 'PASS' || c2.verdict === 'FAIL') && c2.verdict === (c2.pass ? 'PASS' : 'FAIL'));
    // a head on every tile, but one of them capped off from every riser: review reports it, so the calc must qualify too
    W.setCut(30, 4, false, 1); W.setCut(31, 4, false, 1); S.sync(); const c3 = DI.hydCalc(S, wv.id);
    ok('A30 a sprinkler connected to no riser is a coverage failure for the calc verdict as well', S.sysd.tileSys[W.k(31, 4)] === 0 && fails(S, 'not connected to any system riser').length === 1 && fails(S, 'tiles have no sprinkler').length === 0 && c2.verdict === 'PASS' && c3.pass && c3.covOk === false && c3.verdict === 'PASS (hydraulics only); coverage FAIL, see plan review', 'before: ' + c2.verdict + ', after: ' + c3.verdict);
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
    none('role-based pipe policy in src (only the save migration may name it)', src.replace('delete W.cfg.pipePolicy', ''), /pipePolicy|PIPE_POLICY/);
    none('fixed spot threshold table in src', src, /SPOT_T\b/);
    ok('static: the riser reset never writes pLatch', !/pLatch\s*=/.test(DI.resetValve.toString()) && /mech = false/.test(DI.resetValve.toString()));
    ok('static: pLatch is cleared only by the panel reset (El/El), the trim reset (El/Pn), commissioning and save migration', (src.match(/pLatch = false/g) || []).length === 4 && /trim === 'el-el'\) d\.p\.pLatch = false/.test(DI.panelReset.toString()) && /pLatch = false/.test(DI.resetTrimP.toString()));
    ok('static: supervisory is not an allowed class for a latched P', !DI.SIG_CLASS.pLatch.includes('SUPV') && DI.SIG_DEFAULT.pLatch === 'OPEN');
  }
}
console.log(fail ? fail + ' FAILED' : 'all sim tests passed'); process.exit(fail ? 1 : 0);
