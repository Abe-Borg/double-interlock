// node test/sim.test.js - whole-system behaviour
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'cause', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3']) require('../src/' + f + '.js');
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
    const b0 = rig(); b0.W.cfg.manualReleaseBypassP = true; b0.v.p.pull = true; run(b0.S, 60, 0.25);
    ok('A9 bypass ON + el-el trim: a DETECTION latch (pull) is still D and still needs P', b0.s.state === 'dry' && DI.relState(b0.W, b0.v).D === true && !DI.relState(b0.W, b0.v).mrz);
    const b1 = rig(); b1.W.cfg.manualReleaseBypassP = true; b1.v.p.mrzL = true; run(b1.S, 5, 0.25);       // the zone latch (C3-1), not pull
    ok('A9 bypass ON + el-el trim: the Manual Release zone releases without P', b1.s.tripT > 0 && b1.v.p.pLatch === false && DI.relState(b1.W, b1.v).D === false);
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
    r.s.wat = 0; r.s.flow = 0; r.v.p.sdrain = 1;        // as if the control valve were shut and the system drained, drain still open
    ok('A10 valve reset closes the emergency release, with the drain open, and leaves the drain as it was', DI.resetValve(r.S, r.v.id) === '' && r.v.p.mech === false && r.v.p.pLatch === false && r.v.p.sdrain === 1);
    r.v.p.sdrain = 0;
  }
  // A11 dead panel leaves the valve shut; recovery is the mechanical release
  {
    const r = rig(); r.W.power = false; run(r.S, 5, 0.25);
    const ac = () => r.S.sig.get('ac' + r.pn.id), ac0 = ac();
    ok('A11 AC fail: trouble at the panel at once, monitored, on standby battery, not yet transmitted', !!ac0 && ac0.type === 'TRBL' && ac0.mon && ac0.tx === false && ac0.delay === DI.acDelay(r.W) && ac0.text.includes('PANEL AC FAIL') && r.pn.p.alive === true);
    r.S.warp(DI.acDelay(r.W));
    ok('A11 after the AC-fail delay the supervising station has it', ac().mon && ac().tx === true && r.S.log.some((l) => l.text.startsWith('Supervising station notified: PANEL AC FAIL')));
    r.S.warp(24 * 3600 - DI.acDelay(r.W));
    ok('A11 after 24 h the panel is dead and the valve is shut; the supervising station does not know yet', r.pn.p.alive === false && !r.S.sig.has('pd' + r.pn.id) && !r.S.sig.has('ac' + r.pn.id) && r.s.state === 'dry');
    r.S.warp(DI.commDelay(r.W) + 60);
    ok('A11 one supervision interval later the station reports the loss of communication', r.S.sig.get('pd' + r.pn.id).text.startsWith('LOSS OF COMMUNICATION - panel #' + r.pn.id) && r.S.sig.get('pd' + r.pn.id).lost === true && r.s.state === 'dry');
    breakHead(r); smoke(r.S, 0.2, 30);
    ok('A11 dead panel + Fire 1 + P: still shut, solenoid off, and the El/El P latch is gone with the panel', r.s.P < r.v.p.pTrip && r.v.p.pLatch === false && r.v.p.sol === false && r.s.state === 'dry' && r.s.wat === 0);
    const n0 = r.S.acts.length, sil0 = r.pn.p.silenced;
    ok('A11 a dead panel cannot be reset or silenced: the message comes back and nothing changes', DI.panelReset(r.S, r.pn.id) === DI.PANEL_DEAD_MSG && DI.silence(r.S, r.pn.id) === DI.PANEL_DEAD_MSG && r.S.acts.length === n0 && r.pn.p.silenced === sil0 && DI.PANEL_DEAD_MSG.startsWith('The panel is dead: no power, no display.'));
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
  // A14 thresholds and the NFPA 76 check (the check writes nothing: see A45)
  {
    const r = rig();
    ok('A14 example thresholds pass review', fails(r.S, 'strictly increasing').length === 0 && DI.detThr(r.W).join() === '0.03,0.06,0.12,1.2');
    r.W.cfg.detThr = [0.03, 0.2, 0.12, 1.2]; ok('A14 non-increasing thresholds fail review', fails(r.S, 'strictly increasing').length === 1);
    r.W.cfg.detThr = [0.03, 0.06, 0.12, 1.2];
    ok('A14 the NFPA 76 check says so where NFPA 76 is not adopted', DI.n76Check(r.W) === 'NFPA 76 is not adopted on this site.' && DI.detThr(r.W)[0] === 0.03 && DI.juris.nfpa76Adopted === false);
    r.W.cfg.nfpa76Adopted = true; const before = JSON.stringify(r.W.cfg), chk = DI.n76Check(r.W);
    ok('A14 adopted: the check reads Alert and Fire 1 against the two ceilings and changes no setting', chk === 'NFPA 76 check: Alert 0.03 (meets 0.2: yes), Fire 1 0.12 (meets 1.0: yes).' && JSON.stringify(r.W.cfg) === before && DI.detThr(r.W).join() === '0.03,0.06,0.12,1.2', chk);
    r.W.cfg.detThr = [0.3, 0.4, 0.5, 1.2];
    ok('A14 the check reports a ceiling that is not met, and still writes nothing', DI.n76Check(r.W) === 'NFPA 76 check: Alert 0.3 (meets 0.2: no), Fire 1 0.5 (meets 1.0: yes).' && r.W.cfg.detThr.join() === '0.3,0.4,0.5,1.2');
    r.W.cfg.detThr = [0.03, 0.06, 0.12, 1]; smoke(r.S, 1.1, 10); ok('A14 thresholds are live: 1.1 is Fire 2 at a Fire 2 setting of 1.0', r.d.p.lvl === 4 && r.v.p.sol === true);
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
    const r = rig(), out = (S) => fails(S, 'outside the listed'), VEP = DI.ASD_MODELS.VEP, n76 = (S) => DI.review(S).filter((f) => f.ref.startsWith('NFPA 76-2024'));
    ok('A22 example thresholds and the spot default sit inside the listed ranges', out(r.S).length === 0 && DI.spotThr(r.W) === 1.3 && DI.LISTED.smoke.min === 0.5 && DI.LISTED.smoke.max === 4.0 && DI.LISTED.vesda === undefined && DI.asdModel(r.W) === 'VEP');
    ok('A22 the VEP range table: Alert and Action 0.0015 to 0.614, Fire 1 0.0030 to 0.614, Fire 2 0.0061 to 6.575', JSON.stringify(VEP.range) === '{"alert":[0.0015,0.614],"action":[0.0015,0.614],"fire1":[0.003,0.614],"fire2":[0.0061,6.575]}' && VEP.doc.startsWith('Xtralis Doc. 36106_07'));
    r.W.cfg.detThr = [0.03, 0.06, 50, 60];
    ok('A22 Fire 1 = 50 is outside the VEP range and fails, citing the datasheet and the listing chapter', out(r.S).some((f) => f.text.includes('Fire 1 threshold 50 %/ft is outside the listed range of the VESDA-E VEP (0.0030 to 0.614 %/ft)') && f.ref.includes('Xtralis Doc. 36106_07') && f.ref.includes('NFPA 72 Ch. 14')) && out(r.S).some((f) => f.text.includes('Fire 2 threshold 60')));
    r.W.cfg.detThr = [0.03, 0.06, 0.12, 7]; ok('A22 Fire 2 alone outside the range fails', out(r.S).length === 1 && out(r.S)[0].text.includes('Fire 2'));
    delete r.W.cfg.detThr; r.W.cfg.spotThr = 9; ok('A22 a spot threshold of 9 fails', out(r.S).length === 1 && out(r.S)[0].text.includes('Spot detector alarm threshold 9'));
    r.W.cfg.spotThr = 1.3; ok('A22 a spot threshold of 1.3 passes', out(r.S).length === 0);
    r.W.cfg.nfpa76Adopted = true;
    ok('A22 NFPA 76 adopted: the example values raise no finding; the listing note is one ok line, not a flag', n76(r.S).length === 1 && n76(r.S)[0].sev === 'ok' && n76(r.S)[0].text.startsWith('NFPA 76 ceilings: Alert 0.2, Fire 1 1.0 %/ft.') && DI.n76Flags(r.W).length === 0);
    r.W.cfg.detThr = [0.3, 0.6, 2.0, 3.0];
    ok('A22 Alert 0.3 fails NFPA 76; Fire 1 = 2.0 fails the VEP range and the NFPA 76 ceiling on the first alarm stage', fails(r.S, 'NFPA 76 is adopted').length === 2 && fails(r.S, 'Alert must be 0.2 %/ft or less (it is 0.3)').length === 1 && out(r.S).some((f) => f.text.includes('Fire 1 threshold 2 %/ft')) && fails(r.S, 'Fire 1, the first alarm stage, must be 1.0 %/ft or less (it is 2)').length === 1 && n76(r.S).some((f) => f.sev === 'fail' && f.ref.includes('N76_ALARM_OVER')));
    delete r.W.cfg.detThr;
    r.W.cfg.nfpa76Adopted = false; ok('A22 where NFPA 76 is not adopted its limits are not applied and neither a flag nor the note is shown', fails(r.S, 'NFPA 76 is adopted').length === 0 && n76(r.S).length === 0 && DI.n76Flags(r.W).length === 0 && DI.n76Note(r.W) === '');
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
    // (also A38) the C3-7 table, key by key. `undefined` = the key is not given for that edition.
    const J = DI.JURIS, set = (ed) => { const W = new DI.World(4, 4); W.cfg.edition = ed; DI.setJuris(W); }, AV = ' (ASSUMED, VERIFY)';
    const T = {            // key: [2025, 2022, 2019]
      timedTest: ['§8.2.4.2', '§8.2.3.2' + AV, '§8.2.3.2'], noQod: ['§8.2.4.2.1', '§8.2.3.3' + AV, '§8.2.3.3'], qod: ['§8.2.4.2.2', '§8.2.3.4' + AV, '§8.2.3.4'],
      calc: ['§8.2.4.3.1', '§8.2.3.5 to .6' + AV, '§8.2.3.5 to .6 (VERIFY)'], table: ['Table 8.2.4.3.2', 'Table 8.2.3.6.1', 'Table 8.2.3.6.1'],
      manifold: ['§8.2.4.4', '§8.2.3.7', undefined], otherTimes: ['§8.2.4.5', '§8.2.3.8' + AV, undefined],
      di: ['§8.3.2.3.1.1', '§8.3.2.3.1.1 to .4', '§8.3.2.3.1.1'], diQod: ['§8.3.2.3.2', '§8.3.2.3.2', '§8.3.2.3.2'], delivery: ['§8.2.4', '§8.2.3', '§8.2.3'],
      airTest: ['§29.2.2.1', '§29.2.2.1', '§28.2.2.1'], refill: ['§8.2.7.3', '§8.2.6.3.2', '§8.2.6.3.2'], refillN2: [undefined, '§8.2.6.8.4', '§8.2.6.8.4'] };
    const yrs = [2025, 2022, 2019], bad = [];
    for (const [k, row] of Object.entries(T)) row.forEach((tail, i) => { const got = J['US-' + yrs[i]].ref[k], want = tail === undefined ? undefined : 'NFPA 13-' + yrs[i] + ' ' + tail; if (got !== want) bad.push(yrs[i] + ' ' + k + ': ' + got); });
    ok('A24 / A38 delivery and air-test citations match the FP Lead table, key by key, in 2025, 2022 and 2019', bad.length === 0, bad.join('; ') || undefined);
    const c = J['US-2022'].ref, assumed22 = ['timedTest', 'noQod', 'qod', 'calc', 'otherTimes'], held22 = ['table', 'manifold', 'di', 'diQod', 'delivery', 'airTest', 'refill', 'refillN2'];
    ok('A24 / A38 every 2022 key the Lead marked ASSUMED carries (ASSUMED, VERIFY), and no held key does', assumed22.every((k) => c[k].endsWith(AV)) && held22.every((k) => !/ASSUMED|VERIFY/.test(c[k])) && J['US-2022'].verify === true && J['US-2022'].delta.join(' ').includes('2022 keeps the 2019 numbering'));
    ok('A24 / A38 2025 is held throughout; the 2019 delta names the air-test section against 2025', Object.values(J['US-2025'].ref).every((x) => !/ASSUMED|VERIFY/.test(x)) && J['US-2025'].delta.length === 0 && J['US-2019'].delta.join(' ').includes('§28.2.2.1 (2025: §29.2.2.1)'));
    set('US-2019'); const d19 = [DI.deliveryRule('dryv', false, 600, 'none').nfpa.ref, DI.deliveryRule('dryv', false, 400, 'none').nfpa.ref, DI.deliveryRule('dryv', true, 600, 'none').nfpa.ref, DI.deliveryRule('prev', false, 600, 'none').nfpa.rule];
    set('US-2022'); const d22 = [DI.deliveryRule('dryv', false, 600, 'none').nfpa.ref, DI.deliveryRule('prev', false, 600, 'none').nfpa.ref];
    set('US-2025'); const d25 = [DI.deliveryRule('dryv', false, 600, 'none').nfpa.rule, DI.deliveryRule('dryv', false, 400, 'none').nfpa.ref, DI.deliveryRule('dryv', true, 600, 'none').nfpa.ref];
    ok('A24 / A38 the rule follows the site edition', d19[0] === 'NFPA 13-2019 §8.2.3.2' && d19[1] === 'NFPA 13-2019 §8.2.3.3' && d19[2] === 'NFPA 13-2019 §8.2.3.4' && d19[3] === 'NFPA 13: 60 s (over 500 gal) [NFPA 13-2019 §8.3.2.3.1.1]' &&
      d22[0] === 'NFPA 13-2022 §8.2.3.2 (ASSUMED, VERIFY)' && d22[1] === 'NFPA 13-2022 §8.3.2.3.1.1 to .4' && d25[0] === 'NFPA 13: 60 s (over 500 gal) [NFPA 13-2025 §8.2.4.2]' && d25[1] === 'NFPA 13-2025 §8.2.4.2.1' && d25[2] === 'NFPA 13-2025 §8.2.4.2.2');
    DI.setJuris(new DI.World(4, 4));
  }
  // A25 contract 5 as a lesson: the deliberate tip-over, the recovery score, the air test report
  const c5run = {};          // kept for A46 and A47: the reference build, its fills and its drill
  {
    const { S } = DI.buildScenario(c5), sol = DI.botBuild(S, 'c5'); S.warp(sol.settle);
    c5run.fills = [...S.sysd.info.keys()].map((id) => ({ id, row: DI.refillText(S, id), st: DI.refillState(S, id), size: DI.airSizing(S, id) }));
    for (const [kind, id] of sol.tests) { DI.startTest(S, kind, id); S.warp(420); sol.after(S, kind, id); }
    const trips = S.results.filter((r) => r.kind === 'trip'), big = trips.find((r) => r.pipe > 490), rv = DI.review(S);
    ok('A25 c5: the 498 gal zone reports zone 525 gal (pipe 498), over 500', !!big && big.lines[0] === 'Zone volume: 525 gal (pipe 498)' && big.zone > 500 && big.pipe < 500 && big.nfpa === 60, big && big.lines[0]);
    ok('A25 c5: it passes by the 60 s timed test at about 55.5 s', big.pass && Math.abs(big.val - 55.5) < 1.5 && big.governing === 60 && big.by === 'NFPA' && Math.abs(big.margin - (60 - big.val)) < 1e-9, big.val.toFixed(1) + ' s');
    ok('A25 c5: the report marks the governing line and names the table route as not modelled', big.lines[big.gov].startsWith('Governing: NFPA 60 s, margin +') && big.lines.some((l) => l.startsWith('Calc / table alternative: Ordinary Hazard Group 1 50 s, not modelled')) && big.lines.includes('FM: not applied'));
    ok('A25 c5: review warns on that zone and on no other', rv.filter((f) => f.sev === 'warn' && f.text.includes('is over 500 gal')).length === 1 && rv.some((f) => f.text.includes('zone volume 525 gal (pipe 498)') && f.text.includes('or rezone')) && !rv.some((f) => f.sev === 'fail'));
    const fm = DI.deliveryRule('prev', false, big.zone, 'FM');
    ok('A25 c5: with FM set the same zone passes NFPA 13 and fails FM', big.val <= fm.nfpa.limit && big.val > fm.fm.limit && fm.by === 'FM' && fm.governing - big.val < 0);
    const sc = [...S.sysd.info.keys()].map((id) => DI.recoveryScore(S, id));
    ok('A25 c5: after the trip tests the reference operator has put every valve back 13 of 13, in order (practice: no goal reads it)', sc.length === 3 && sc.every((q) => q && q.done === 13 && q.total === 13 && q.complete && q.inOrder && q.closed && q.tripped && q.time > 0), sc.map((q) => q && q.done + '/' + q.total + (q.inOrder ? ' in order' : ' out of order')).join(', '));
    c5run.practice = sc; c5run.rows = [...S.sysd.info.keys()].map((id) => DI.refillText(S, id)); c5run.goals = DI.botCheck(S, c5); c5run.rvFails = DI.review(S).filter((f) => f.sev === 'fail').length;
    ok('A25 c5: all six goals are met with default settings, and none of them reads the recovery score', DI.botCheck(S, c5).every(Boolean) && c5.goals.length === 6 && !c5.goals.some((q) => /recover/i.test(q.t)) && typeof DI.G.recovered === 'undefined');
    ok('A25 c5: the drill has no hard timer and the false alarm comes after the 30 min air-restore window', c5.drill.steps().some((st) => st[0] === 2100 && /dust/.test(st[2])) && c5.drill.len === 5600 && DI.RECOVERY_TARGET === 300);
    const S2 = new DI.Sim(DI.World.fromJSON(JSON.parse(JSON.stringify(S.W.toJSON())))); S2.restore(JSON.parse(JSON.stringify(S.dump())));
    ok('A25 the recovery log is saved with the game', [...S2.sysd.info.keys()].every((id) => { const q = DI.recoveryScore(S2, id); return q && q.complete && q.inOrder; }) && S2.acts.length === S.acts.length);
    // the drill's broken-sprinkler incident is the only scored recovery
    DI.startDrill(S, c5.drill); let guard = 0; while (!S.drill.done && guard++ < 400000) { S.step(S.fires.length || S.outFlow > 1 ? 0.25 : 1); DI.drillStep(S); sol.ops(S); }
    const dr = S.drill.result, inc = S.acts.find((q) => q.kind === 'incident' && q.t >= S.drill.t0), ds = DI.recoveryScore(S, inc.id, S.drill.t0), nas = ds.steps.filter((q) => q.na).map((q) => q.kind).join();
    ok('A25 c5 drill: the broken-sprinkler incident is 13 of 13 in order (never tripped, D never latched, El/El: steps 6, 8 and 11 do not apply)', dr.pass && ds.done === 13 && ds.complete && ds.inOrder && !ds.tripped && !ds.det && nas === 'reset-panel-1,reset-valve,reset-trim' && ds.why === 'head', ds.steps.map((q) => q.kind + (q.na ? ' n/a' : '@' + Math.round(q.t - S.drill.t0))).join(' '));
    Object.assign(c5run, { S, dr, ds, inc });
    ok('A25 c5 drill report: the 13-step line with its star, the operator-step bonus met, the refill line OK, the total, no water-filled line and no gate', dr.lines.some((l) => l === '★ Recovery after the broken sprinkler: 13 of 13 steps, in order') && dr.lines.some((l) => /^★ Time bonus: operator steps took [\d.]+ s, target 5\.0 min \(ASSUMED, informational\)$/.test(l)) &&
      dr.lines.some((l) => /^★ Air refill: [\d.]+ min, limit 30 min \[NFPA 13-2025 §8\.2\.7\.3\]: OK$/.test(l)) && dr.lines.some((l) => /^• Total recovery [\d.]+ min, mostly the compressor$/.test(l)) && !dr.lines.some((l) => l.includes('Water-filled zone')) && dr.lines.filter((l) => l[0] === '✗').length === 0, dr.lines.join(' | '));
    // one run that passes NFPA 13 at 60 s and fails FM at 30 s: valve A with enough fittings allowance to pass 500 gal
    const F = DI.buildScenario(c5, { insurer: 'FM', fitPct: 40 }), fsol = DI.botBuild(F.S, 'c5'); F.S.warp(fsol.settle);
    const [kind, id] = fsol.tests[0]; DI.startTest(F.S, kind, id); F.S.warp(420); const fr = DI.lastResult(F.S, 'trip', id);
    ok('A25 FM: a 37 s zone passes NFPA 60 s and fails FM 30 s on the same run', !!fr && !fr.pass && fr.zone > 500 && fr.nfpa === 60 && fr.fm === 30 && fr.val > 30 && fr.val < 60 && fr.by === 'FM' && fr.governing === 30 && fr.margin < 0, fr && fr.lines.slice(2).join(' | '));
    ok('A25 FM: the report highlights the governing line', fr.lines[fr.gov].startsWith('Governing: FM 30 s, margin −') && fr.lines.some((l) => l.startsWith('NFPA 13: 60 s (over 500 gal)')) && fr.lines.includes('FM: 30 s (any volume, DS 5-32, NEEDS PE REVIEW)'));
    const r = rig(); DI.startTest(r.S, 'leak', r.v.id); r.S.warp(86500); const lk = DI.lastResult(r.S, 'leak', r.v.id);
    ok('A25 24 h air test report: test pressure, start and end, the pass line, the drop, and no mention of P', lk.lines.length === 4 && lk.lines[0] === 'Test pressure: 40 psi' && /^Start: [\d.]+ psi, end: [\d.]+ psi$/.test(lk.lines[1]) && lk.lines[2] === 'Pass: end reading at least 38.5 psi (loss of 1.5 psi or less in 24 h) [NFPA 13-2025 §29.2.2.1]' && /^Drop: [\d.]+ psi in 24 h$/.test(lk.lines[3]) && !/\bP\b|latch/i.test(lk.title + lk.lines.join(' ')), lk.lines.join(' | '));
  }
  // A26 recovery score (13 steps): order, the head gate, the early reset, the El/Pn trim step. Untripped incidents here; tripped ones are A36.
  const R = {
    start: (o) => { const r = rig(Object.assign({ gate: true }, o)); DI.breakSprinkler(r.S, r.head); run(r.S, 60, 0.25); return r; },
    shut: (r) => { const m = DI.setGate(r.S, r.g.id, 0); run(r.S, 6, 0.25); return m; },
    iso: (r, on) => { r.v.p.airValve = on ? 0 : 1; run(r.S, 1, 0.25); },                        // isolate (1) or restore (0) the air supply
    drain: (r, on) => { r.v.p.sdrain = on; r.S.touch(); run(r.S, 2, 0.25); },
    zero: (r) => { let n = 0; while (!r.s.dz && n++ < 20000) r.S.step(0.25); return !!r.s.dz; },   // wait for the confirmed drain: 0 psi and no water
    air: (r) => run(r.S, 1800, 1),
    reopen: (r) => { const m = DI.setGate(r.S, r.g.id, 1); run(r.S, 6, 0.25); return m; },
    score: (r) => DI.recoveryScore(r.S, r.v.id),
    step: (r, kind) => DI.recoveryScore(r.S, r.v.id).steps.find((q) => q.kind === kind),
    show: (q) => q.steps.map((x) => x.kind + (x.na ? ' n/a' : x.t === null ? ' -' : '@' + Math.round(x.t))).join(' '),
  };
  {
    const a = R.start(); ok('A26 a broken head opens an incident and P latches without a trip', a.v.p.pLatch === true && a.s.state === 'dry' && R.score(a).why === 'head' && R.score(a).done < 13 && R.score(a).total === 13 && DI.RECOVERY.length === 13);
    DI.silence(a.S, a.pn.id); ok('A26 find-head counts only on an operated head', DI.findHead(a.S, a.head) === true && DI.findHead(a.S, a.head - 1) === false);
    R.shut(a); R.iso(a, 1); R.drain(a, 1);
    ok('A26 the drain is confirmed at 0 psi with no water, and replacing the head is logged with the drain still open', R.zero(a) && DI.replaceSprinklers(a.S, a.v.id) === '' && a.v.p.sdrain === 1 && R.step(a, 'replace-head').done);
    R.drain(a, 0); R.iso(a, 0);
    DI.panelReset(a.S, a.pn.id); run(a.S, 2, 0.25);
    ok('A26 a reset before the air is back latches P again and scores nothing', a.v.p.pLatch === true && !R.step(a, 'reset-panel').done && !R.score(a).complete);
    R.air(a); ok('A26 air restored, P still latched: not yet in service', a.v.p.pLatch === true && R.step(a, 'restore-air').done && !R.score(a).closed);
    DI.panelReset(a.S, a.pn.id); run(a.S, 2, 0.25);
    ok('A26 panel reset #2 clears P and the valve is in service, but the recovery is not complete until the control valve is reopened', a.v.p.pLatch === false && R.score(a).closed && R.score(a).done === 12 && !R.score(a).complete && !R.step(a, 'open-valve').done && R.score(a).time === null);
    const m = R.reopen(a), sa = R.score(a), na = sa.steps.filter((q) => q.na).map((q) => q.kind).join();
    ok('A26 El/El in order: 13 of 13, in order, back in service (never tripped, D never latched, no actuator: steps 6, 8, 11 do not apply)', m === '' && sa.done === 13 && sa.complete && sa.inOrder && sa.closed && sa.time > 0 && na === 'reset-panel-1,reset-valve,reset-trim' && a.g.p.open > 0.99, R.show(sa));
    {  // silence belongs to one panel: a second panel's signals stay audible, and its new alarm is not muted by the first
      const m2 = rig({ gate: true }), p2 = m2.W.addPart('panel', 18, 4, 0); m2.W.wire(p2.id, m2.g.id); breakHead(m2);
      DI.silence(m2.S, m2.pn.id); m2.g.p.target = 0; run(m2.S, 6, 0.25);
      const pl = m2.S.sig.get('pl' + m2.v.id), tm = m2.S.sig.get('tm' + m2.g.id);
      ok('A26 silencing one panel does not silence a signal on another panel', !!pl && !!tm && m2.pn.p.silenced === true && DI.sigSilenced(m2.W, pl) === true && DI.sigSilenced(m2.W, tm) === false && !p2.p.silenced);
      m2.W.unwire(m2.g.id); run(m2.S, 1, 0.25); ok('A26 a signal that reaches no panel cannot be silenced', DI.sigSilenced(m2.W, m2.S.sig.get('tm' + m2.g.id)) === false && m2.S.sig.get('tm' + m2.g.id).mon === false);
    }
    ok('A26 silence is acknowledged at the panel and a new signal resounds it', a.pn.p.silenced === false && a.S.log.some((l) => l.text.startsWith('Panel silenced')));
    // the same work with the drain closed before the head is replaced (backward) and the silence last
    const b = R.start(); DI.findHead(b.S, b.head); R.shut(b); R.iso(b, 1); R.drain(b, 1); R.zero(b); R.drain(b, 0); DI.replaceSprinklers(b.S, b.v.id); DI.silence(b.S, b.pn.id); R.iso(b, 0); R.air(b); DI.panelReset(b.S, b.pn.id); run(b.S, 2, 0.25); R.reopen(b);
    ok('A26 the same steps done out of order are complete and do not score as a clean recovery', R.score(b).complete === true && R.score(b).inOrder === false && R.step(b, 'drain-close').t < R.step(b, 'replace-head').t, R.show(R.score(b)));
    const c = R.start({ props: { trim: 'el-pn' } }); DI.silence(c.S, c.pn.id); DI.findHead(c.S, c.head); R.shut(c); R.iso(c, 1); R.drain(c, 1); R.zero(c); DI.replaceSprinklers(c.S, c.v.id); R.drain(c, 0); R.iso(c, 0); R.air(c);
    DI.panelReset(c.S, c.pn.id); run(c.S, 2, 0.25);
    ok('A26 El/Pn: without the trim reset the recovery is 11 of 13, P is still latched and the reopen check names the trim (practice: it would warn, not refuse)', R.score(c).done === 11 && c.v.p.pLatch === true && !R.step(c, 'reset-trim').na && !R.step(c, 'reset-trim').done && DI.reopenGate(c.S, c.g.id) === 'Reset the actuator at the trim: P is still latched.' && DI.reopenCheck(c.S, c.g.id).refuse === false && c.g.p.target === 0);
    DI.resetTrimP(c.S, c.v.id); run(c.S, 2, 0.25); const mc = R.reopen(c);
    ok('A26 El/Pn: trim reset after the panel reset is complete but out of order', mc === '' && R.score(c).complete && !R.score(c).inOrder && c.v.p.pLatch === false, R.show(R.score(c)));
    const d = R.start({ props: { trim: 'el-pn' } }); DI.silence(d.S, d.pn.id); DI.findHead(d.S, d.head); R.shut(d); R.iso(d, 1); R.drain(d, 1); R.zero(d); DI.replaceSprinklers(d.S, d.v.id); R.drain(d, 0); R.iso(d, 0); R.air(d);
    DI.resetTrimP(d.S, d.v.id); run(d.S, 1, 0.25); DI.panelReset(d.S, d.pn.id); run(d.S, 2, 0.25); R.reopen(d);
    ok('A26 El/Pn: restore air, reset the trim, reset the panel, reopen the valve is 13 of 13 in order', R.score(d).done === 13 && R.score(d).complete && R.score(d).inOrder && R.score(d).closed && R.step(d, 'reset-valve').na && R.step(d, 'reset-panel-1').na, R.show(R.score(d)));
    DI.breakSprinkler(d.S, d.head); run(d.S, 5, 0.25); ok('A26 a new incident starts a new score', R.score(d).done < 13 && DI.recoveryScore(d.S, d.v.id, 0).complete);
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
    ok('A28 dead panel + manual pull + P never releases (the El/El P latch is not held by a dead panel)', d.pn.p.alive === false && d.v.p.pull === false && d.v.p.solOut === false && d.s.state === 'dry' && d.s.P < d.v.p.pTrip && d.v.p.pLatch === false);
    d.stn.p.on = false; d.W.power = true; run(d.S, 0.25, 0.25);
    ok('A28 power back: the panel reads PSL-REL again and P returns within one tick; no station, so nothing releases', d.pn.p.alive === true && d.v.p.pLatch === true && d.s.state === 'dry' && d.S.log.some((l) => l.text.startsWith('Panel power restored: inputs re-read. P returns (pipe still below P trip)')));
    const m = rig({ stn: true }); m.W.cfg.manualReleaseBypassP = true; m.stn.p.on = true; run(m.S, 5, 0.25);
    ok('A28 with the bypass ON on El/El the station is typed MANUAL RELEASE and releases without P', m.s.tripT > 0 && m.v.p.pLatch === false && m.v.p.mrzL === true && m.v.p.pull === false && m.S.sig.get('ms' + m.v.id).text.startsWith('MANUAL RELEASE ZONE (BYPASSES P)') && DI.relState(m.W, m.v).D === false);
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
  // ====================== Cycle 3 acceptance (A31 onward: fixture pin, Manual Release zone, dead panel, air test, drain and air,
  // 13-step recovery, supply air and the water-filled zone, citations, bundle, ASD ranges and NFPA 76 flags, reopen gate)
  const os = require('os'), TT = require('./truth-table.js');
  const tmpFix = (edit) => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'di-fix-')), 'tt.csv'); fs.writeFileSync(f, edit(fs.readFileSync(TT.FILE))); return f; };
  const throws = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };
  // A31 fixture: pinned, self-checked
  {
    ok('A31 the fixture is the FA Lead\'s file: sha16 cb3462b268359c6e over the raw bytes, 18 lines, LF endings', TT.sha16(TT.FILE) === 'cb3462b268359c6e' && TT.FIXTURE_SHA16 === 'cb3462b268359c6e' && TT.checkFixture() === TT.FIXTURE_SHA16 && fs.readFileSync(TT.FILE).length === 2429 && !fs.readFileSync(TT.FILE).includes(13) && fs.readFileSync(TT.FILE, 'utf8').split('\n').length === 19);
    const txt = (b) => b.toString('utf8'), cell = tmpFix((b) => txt(b).replace('R01,El/El,0,0,0', 'R01,El/El,0,0,1')), note = tmpFix((b) => txt(b).replace('Normal. No release.', 'Normal, no release.')), crlf = tmpFix((b) => txt(b).replace(/\n/g, '\r\n'));
    const names = (m) => m.includes('cb3462b268359c6e') && /sha16 [0-9a-f]{16}, pinned cb3462b268359c6e/.test(m);
    ok('A31 one changed cell, one changed note character or CRLF line endings fail the pin, naming both hashes', [cell, note, crlf].every((f) => names(throws(() => TT.readRows(f)))) && throws(() => TT.run(DI, cell)).includes('pinned'), throws(() => TT.readRows(note)).slice(0, 90));
    const f2 = tmpFix((b) => txt(b).replace('R08,El/El,1,1,', 'R08,El/El,0,1,')), vo = tmpFix((b) => txt(b).replace('R02,El/El,1,0,0,0,0,0,0,AC,0,1,0,0,', 'R02,El/El,1,0,0,0,0,0,0,AC,0,1,0,1,'));
    ok('A31 Fire2 = 1 with Fire1 = 0 fails at load, even with the pin set aside', throws(() => TT.readRows(f2, { pin: null })).includes('R08: Fire2 = 1 with Fire1 = 0'));
    ok('A31 a ValveOpen that breaks the release formula fails at load', /R02: ValveOpen = 1 but \(D AND P\) OR \(Bypass9c AND ManualReleaseZone AND El\/El\) = 0/.test(throws(() => TT.readRows(vo, { pin: null }))));
    const sol = tmpFix((b) => txt(b).replace('R15,El/Pn,1,0,0,0,0,0,0,AC,0,1,1,0,', 'R15,El/Pn,1,0,0,0,0,0,0,AC,0,1,0,0,')), mz = tmpFix((b) => txt(b).replace('R14,El/El,0,0,0,1,0,0,0,AC,1,0,1,1,', 'R14,El/El,0,0,0,1,0,0,0,AC,0,0,1,1,'));
    ok('A31 a solenoid that is not D on El/Pn, and a Manual Release zone that releases with the bypass OFF, fail at load', throws(() => TT.readRows(sol, { pin: null })).includes('R15: Solenoid = 0 but D = 1 on El/Pn') && throws(() => TT.readRows(mz, { pin: null })).includes('R14: ManualReleaseZone = 1 with Bypass9c = 0 expects a release'));
    const rows = TT.readRows(), res = rows.map((r) => TT.runRow(DI, r)), by = (n) => rows.find((r) => r.Row === n);
    ok('A31 17 of 17 rows match the engine, with R08 at Fire1 = 1 and R14 at D = 0 in the file', rows.length === 17 && res.every((r) => r.ok) && by('R08').Fire1 === '1' && by('R08').Fire2 === '1' && by('R14').D === '0' && by('R14').ValveOpen === '1', res.filter((r) => !r.ok).map((r) => r.row).join() || undefined);
    const r14 = res.find((r) => r.row === 'R14');
    ok('A31 R14 releases through the zone latch, not through D', r14.mrzL === true && r14.pull === false && r14.got.D === '0');
  }
  // A32 Manual Release zone: its own latched release path
  {
    const m = rig({ stn: true }); m.W.cfg.manualReleaseBypassP = true; run(m.S, 1, 0.25);
    ok('A32 bypass ON, station idle: the release path reads BYPASS ARMED', DI.relPath(m.W, m.v).join('|') === 'Manual Release zone BYPASS ARMED (9(c), NEEDS PE REVIEW)|warn' && m.v.p.mrzL === false);
    m.stn.p.on = true; run(m.S, 5, 0.25); const rs = DI.relState(m.W, m.v);
    ok('A32 the station typed MANUAL RELEASE sets the zone latch, opens the valve with P normal, and D stays false (R14)', m.v.p.mrzL === true && m.v.p.pull === false && m.v.p.sol === false && rs.mrz && !rs.D && !rs.P && rs.open && rs.sol && m.s.tripT > 0 && m.v.p.pLatch === false && m.v.p.solOut === true);
    ok('A32 while it releases the path row reads RELEASING - without P', DI.relPath(m.W, m.v).join('|') === 'Manual Release zone RELEASING - without P|bad');
    m.stn.p.on = false; run(m.S, 30, 0.25);
    ok('A32 resetting the station alone leaves the zone and its release latched', m.v.p.mrzL === true && DI.relState(m.W, m.v).open === true && m.v.p.solOut === true && m.S.sig.has('ms' + m.v.id));
    ok('A32 the riser reset is refused while the zone is latched', (m.s.wat = 0, m.s.flow = 0, DI.resetValve(m.S, m.v.id)).startsWith('Detection is still active'));
    DI.panelReset(m.S, m.pn.id); const cleared = m.v.p.mrzL === false; run(m.S, 1, 0.25);
    ok('A32 a panel reset clears the zone latch, and it stays clear with the station reset', cleared && m.v.p.mrzL === false && !DI.relState(m.W, m.v).open && m.S.acts.some((a) => a.kind === 'reset-panel' && a.id === m.v.id && a.det === true));
    m.stn.p.on = true; run(m.S, 1, 0.25); DI.panelReset(m.S, m.pn.id); const c2 = m.v.p.mrzL === false; run(m.S, 0.25, 0.25);
    ok('A32 a station that is still operated relatches the zone on the next tick', c2 && m.v.p.mrzL === true);
    const off = rig({ stn: true }); off.stn.p.on = true; off.v.p.mrzL = true; run(off.S, 1, 0.25);
    ok('A32 flag OFF: the station is DETECTION (pull), and a zone latch is forced clear', off.v.p.mrzL === false && off.v.p.pull === true && off.s.state === 'dry' && DI.relPath(off.W, off.v)[0] === '(D AND P)  armed');
    const pn = rig({ stn: true, props: { trim: 'el-pn' } }); pn.W.cfg.manualReleaseBypassP = true; pn.stn.p.on = true; pn.v.p.mrzL = true; run(pn.S, 30, 0.25);
    ok('A32 El/Pn with the flag ON: no zone, the station is DETECTION and still needs P', pn.v.p.mrzL === false && pn.v.p.pull === true && pn.s.state === 'dry' && DI.stationType(pn.W, pn.v) === 'DETECTION');
    const dd = rig({ stn: true }); dd.W.cfg.manualReleaseBypassP = true; dd.W.power = false; dd.pn.p.battH = 0; dd.stn.p.on = true; dd.v.p.mrzL = true; run(dd.S, 30, 0.25);
    ok('A32 a dead panel never sets or holds the zone latch', dd.pn.p.alive === false && dd.v.p.mrzL === false && dd.s.state === 'dry' && dd.v.p.solOut === false);
    const old = JSON.parse(JSON.stringify(m.W.toJSON())); delete old.parts.find((q) => q.type === 'prev').p.mrzL;
    ok('A32 an old save without the zone latch loads with it clear', DI.World.fromJSON(old).byType('prev')[0].p.mrzL === false && DI.PARTS.prev.props.mrzL === false);
  }
  // A33 dead panel: trouble first, dark, unresettable; the El/El P latch lives in panel memory
  {
    const r = rig(); r.W.power = false; r.S.warp(3600); const T = (k) => r.S.sig.get(k + r.pn.id);
    ok('A33 AC fail is a monitored trouble; no low battery at 23 h', T('ac') && T('ac').type === 'TRBL' && T('ac').mon && !T('lb') && DI.PANEL_LOWBATT_FRAC === 1 / 12 && DI.PANEL_STANDBY_H === 24);
    r.S.warp(21.2 * 3600);
    ok('A33 at about 22 h of 24 h LOW BATTERY is raised, monitored, while the panel is still alive', r.pn.p.alive === true && r.pn.p.battH < 2 && r.pn.p.battH > 1.5 && T('lb') && T('lb').type === 'TRBL' && T('lb').mon && T('lb').text.startsWith('LOW BATTERY - panel #') && !!T('ac') && !T('pd'), 'battery ' + r.pn.p.battH.toFixed(2) + ' h');
    const lbT = T('lb').t0; r.S.warp(2 * 3600 + DI.commDelay(r.W));
    ok('A33 at death the supervising station reports loss of communication, later than both troubles', r.pn.p.alive === false && T('pd') && T('pd').lost && T('pd').mon && T('pd').type === 'TRBL' && T('pd').text === 'LOSS OF COMMUNICATION - panel #' + r.pn.id + ' (no signal, supervising station reports trouble)' && !T('ac') && !T('lb') && T('pd').t0 > lbT);
    const n0 = r.S.acts.length, st0 = JSON.stringify([r.v.p, r.pn.p, r.d.p]);
    ok('A33 reset and silence on a dead panel return the message, change no state and log nothing', DI.panelReset(r.S, r.pn.id) === DI.PANEL_DEAD_MSG && DI.silence(r.S, r.pn.id) === DI.PANEL_DEAD_MSG && r.S.acts.length === n0 && JSON.stringify([r.v.p, r.pn.p, r.d.p]) === st0);
    breakHead(r); const sg = r.S.sig.get('la' + r.v.id);
    ok('A33 El/El: P is not latched while the panel is dead and the pipe falls; the dead panel\'s own signals are dark', r.s.P < r.v.p.pTrip && r.v.p.pLatch === false && !r.S.sig.has('pl' + r.v.id) && !!sg && sg.dark === true && sg.mon === false);
    fixHead(r); r.W.power = true; r.S.step(0.25);
    ok('A33 power restored with the pipe still low: P returns within one tick, and it is logged', r.pn.p.alive === true && r.v.p.pLatch === true && r.S.log.filter((l) => l.text.startsWith('Panel power restored: inputs re-read. P returns (pipe still below P trip)')).length === 1 && r.s.state === 'dry');
    const c = rig(); c.W.power = false; c.pn.p.battH = 0; run(c.S, 5, 0.25); c.W.power = true; run(c.S, 5, 0.25);
    ok('A33 power restored with the pipe above P trip: P stays clear', c.pn.p.alive === true && c.v.p.pLatch === false && c.s.P > c.v.p.pTrip && c.S.log.filter((l) => l.text.startsWith('Panel power restored: inputs re-read. P is clear')).length === 1);
    const e = rig({ props: { trim: 'el-pn' } }); e.W.power = false; e.pn.p.battH = 0; breakHead(e);
    ok('A33 El/Pn: P is the actuator at the valve and latches with the panel dead', e.pn.p.alive === false && e.v.p.pLatch === true && e.s.state === 'dry' && e.v.p.solOut === false);
    const f = rig(); breakHead(f); fixHead(f); f.W.power = false; f.pn.p.battH = 0; smoke(f.S, 0.2, 30);
    ok('A33 dead panel, live Fire 1 reading, pipe low: nothing releases', f.s.state === 'dry' && f.v.p.sol === false && f.v.p.pLatch === false);
    f.W.power = true; smoke(f.S, 0.2, 2);
    ok('A33 power back with Fire 1 still read and the pipe still low: D and P are both true again and the valve trips (the inputs release, not the power)', f.v.p.sol === true && f.v.p.pLatch === true && f.s.tripT > 0 && !/W\.power/.test(DI.gasPre.toString()));
  }
  // A34 24 h air test: 40 psi, end reading 38.5 psi or more
  {
    const leak = (r, x) => { const V = r.S.sysd.info.get(r.v.id).vol; r.S.leaks.push({ k: r.head, K: 0, a: x * V, sys: r.v.id }); };     // a gas-only leak, in2 per gallon of pipe
    const setP = (r, p) => { const V = r.S.sysd.info.get(r.v.id).vol; r.s.G = (p + DI.ATM) * V; run(r.S, 0.25, 0.25); };
    const a = rig(); a.v.p.airValve = 0; setP(a, 37.9); a.v.p.airValve = 1;
    ok('A34 a zone at 37.9 psi starts in the charge stage, supply open', DI.startTest(a.S, 'leak', a.v.id) === '' && a.S.procs[0].stage === 0 && a.v.p.airValve === 1 && Math.abs(a.s.P - 37.9) < 0.05 && DI.airTarget(a.S, a.v.id, a.v) === 40);
    const tA = a.S.t; let n = 0; while (a.S.procs.length && a.S.procs[0].stage === 0 && n++ < 8000) a.S.step(0.25);
    ok('A34 the clock starts only at test pressure: the zone is charged to 40.0 first, then the supply is isolated', a.S.procs[0].stage === 1 && DI.fmt(a.S.procs[0].p0, 1) === '40.0' && Math.abs(a.S.procs[0].p0 - 40) <= DI.AIR_TEST.tol && a.v.p.airValve === 0 && a.S.t < DI.AIR_TEST.chargeMax, 'p0 ' + a.S.procs[0].p0.toFixed(2) + ' after ' + Math.round(a.S.t) + ' s');
    a.S.warp(86500); const ra = DI.lastResult(a.S, 'leak', a.v.id);
    ok('A34 it then holds 24 h and passes on sound pipe, and the supply is restored', ra.pass && ra.end >= 38.5 && /^Start: 40\.0 psi, end: 39\.\d psi$/.test(ra.lines[1]) && a.v.p.airValve === 1 && !a.S.acts.some((q) => q.t > tA && (q.kind === 'isolate-air' || q.kind === 'supply-open')));
    const b = rig(); setP(b, 45);
    ok('A34 a zone above 40.5 psi is refused', DI.startTest(b.S, 'leak', b.v.id) === 'Test pressure is 40 psi. This zone is at 45.0 psi: lower the normal pressure or bleed it at the drain first.' && b.S.procs.length === 0);
    const c = rig(); c.s.holes = 500; setP(c, 37); DI.startTest(c.S, 'leak', c.v.id); c.S.warp(2000); const rc = DI.lastResult(c.S, 'leak', c.v.id);
    ok('A34 a zone that cannot reach 40 psi in 1,800 s fails with the charge message', !!rc && !rc.pass && rc.lines[1] === 'Could not reach 40 psi in 30 min: the supply is too small or the leaks are too big.' && c.S.procs.length === 0 && rc.end < 39.9, rc && rc.lines.join(' | '));
    const g1 = rig(); leak(g1, 3.0e-9); DI.startTest(g1.S, 'leak', g1.v.id); g1.S.warp(86500); const r1 = DI.lastResult(g1.S, 'leak', g1.v.id);
    const g2 = rig(); leak(g2, 4.3e-9); DI.startTest(g2.S, 'leak', g2.v.id); g2.S.warp(86500); const r2 = DI.lastResult(g2.S, 'leak', g2.v.id);
    ok('A34 golden values: a 24 h run ending at 38.6 psi passes and one ending at 38.4 psi fails', r1.pass && r1.lines[1] === 'Start: 40.0 psi, end: 38.6 psi' && !r2.pass && r2.lines[1] === 'Start: 40.0 psi, end: 38.4 psi' && r1.end >= 38.5 && r2.end < 38.5 && g2.s.state === 'dry', r1.end.toFixed(3) + ' / ' + r2.end.toFixed(3));
    ok('A34 the report: test pressure, start and end, the pass line with the 2025 section, the drop; no mention of P', r2.lines.length === 4 && r2.lines[0] === 'Test pressure: 40 psi' && r2.lines[2] === 'Pass: end reading at least 38.5 psi (loss of 1.5 psi or less in 24 h) [NFPA 13-2025 §29.2.2.1]' && r2.lines[3] === 'Drop: 1.60 psi in 24 h' && !/\bP\b|latch/i.test(r2.title + r2.lines.join(' ')), r2.lines.join(' | '));
    const refs = ['US-2022', 'US-2019'].map((ed) => { const q = rig(); q.W.cfg.edition = ed; DI.startTest(q.S, 'leak', q.v.id); q.S.warp(86500); return DI.lastResult(q.S, 'leak', q.v.id).lines[2]; });
    ok('A34 the cited section follows the edition: 2022 §29.2.2.1 and 2019 §28.2.2.1, both verified (no ASSUMED mark)', refs[0].endsWith('[NFPA 13-2022 §29.2.2.1]') && refs[1].endsWith('[NFPA 13-2019 §28.2.2.1]'), refs.join(' | '));
    DI.setJuris(new DI.World(4, 4));
    const off = rig(); off.v.p.airValve = 0; setP(off, 37);
    ok('A34 a zone below test pressure with its supply isolated is refused (it cannot be charged)', DI.startTest(off.S, 'leak', off.v.id).startsWith('The air / N2 supply to this zone is isolated.'));
    // contract 6: the baseline test fails and leaves P latched; repair, air, panel reset, re-test
    const c6 = DI.SCEN.find((q) => q.id === 'c6'), C = DI.buildScenario(c6), sol = DI.botBuild(C.S, 'c6'), v6 = C.W.byType('prev')[0]; C.S.warp(120);
    DI.startTest(C.S, 'leak', v6.id); C.S.warp(86500 + DI.AIR_TEST.chargeMax); const base = DI.lastResult(C.S, 'leak', v6.id);
    ok('A34 c6 baseline: FAIL with an end reading below 20 psi, and P is latched (PSL-REL tripped; the test never touches it)', !!base && !base.pass && base.end < 20 && v6.p.pLatch === true && !/\bP\b|latch/i.test(base.lines.join(' ')) && C.S.log.some((l) => /P latched .* until the releasing panel is reset/.test(l.text)), base && base.lines[1]);
    sol.after(C.S, 'leak', v6.id); const again = DI.lastResult(C.S, 'leak', v6.id);
    ok('A34 c6 after the repair, the air back and a panel reset: P is clear and the re-test passes', again !== base && again.pass && again.end >= 38.5 && v6.p.pLatch === false && C.S.ss.get(v6.id).set, again.lines[1]);
    ok('A34 c6 says so in its lesson and its goal hint', c6.learn.some((l) => l.startsWith('A failed air test can leave P latched')) && c6.goals.some((q) => q.hint.includes('A failed test can leave P latched: after the repair, restore the air and reset the panel')));
  }
  // A35 drain and air: air out a drain is air; the head gate; the riser reset with the drain open
  {
    const r = rig({ gate: true }), comp = r.W.byType('comp')[0], V = r.S.sysd.info.get(r.v.id).vol, lim = DI.dryLim(V);
    r.v.p.mech = true; run(r.S, 60, 0.25); const wat0 = r.s.wat;
    ok('A35 head gate, tripped and full of water: control valve first', wat0 > 20 && DI.headSafe(r.S, r.v.id) === 'Close the control valve first.');
    r.g.p.target = 0; run(r.S, 8, 0.25);
    ok('A35 head gate: then the air / N2 supply', DI.headSafe(r.S, r.v.id) === 'Isolate the air / N2 supply first.');
    r.v.p.airValve = 0; run(r.S, 1, 0.25);
    ok('A35 head gate: then the water', DI.headSafe(r.S, r.v.id) === 'The pipe still holds ' + DI.fmt(r.s.wat) + ' gal of water. Open the drain.' && r.s.wat > lim);
    r.v.p.airValve = 1; r.v.p.sdrain = 1; r.S.touch(); let n = 0; while (r.s.wat > 0 && n++ < 20000) r.S.step(0.25); run(r.S, 60, 0.25);
    ok('A35 compressor running, tripped system drained, drain open: no drain emitter, qOut 0, no gallons counted', r.s.wat === 0 && r.s.state === 'filling' && r.s.qOut === 0 && !r.S.G.emit.some((e) => e.kind === 'drain') && r.S.outFlow === 0 && comp.p.on === true && r.s.gasOut > 0, 'P ' + r.s.P.toFixed(2) + ' psi, compressor ' + (comp.p.on ? 'on' : 'off'));
    const run0 = comp.p.runSec; run(r.S, 20, 0.25);
    ok('A35 the open drain shows as falling pipe pressure and compressor run time, never as gpm', r.s.P <= DI.SAFE_PSI && comp.p.runSec > run0 + 15 && r.s.gasIn > 0 && r.S.stats.gallons === (run(r.S, 5, 0.25), r.S.stats.gallons));
    r.v.p.sdrain = 0; r.S.touch(); run(r.S, 200, 0.25);
    ok('A35 air pressure alone behind a tripped clapper is not waterflow', r.s.state === 'filling' && r.s.P > 4 && r.s.wat === 0 && r.s.alarm === false && !r.S.sig.has('wf' + r.v.id) && r.s.qOut === 0, 'P ' + r.s.P.toFixed(1) + ' psi');
    ok('A35 head gate: pipe water-free but still holding pressure', DI.headSafe(r.S, r.v.id) === 'Isolate the air / N2 supply first.' && (r.v.p.airValve = 0, run(r.S, 1, 0.25), DI.headSafe(r.S, r.v.id)) === 'The pipe still holds ' + DI.fmt(r.s.P, 1) + ' psi. Open the system drain and wait for the gauge to read 0.');
    r.v.p.sdrain = 1; r.S.touch(); run(r.S, 60, 0.25);
    ok('A35 with the supply isolated and the drain open the gauge reaches 0.5 psi or less, and the gate is satisfied with the drain open', r.s.P <= DI.SAFE_PSI && DI.SAFE_PSI === 0.5 && DI.headSafe(r.S, r.v.id) === '' && r.S.acts.some((a) => a.kind === 'drain-zero' && a.id === r.v.id));
    r.v.p.sdrain = 0; r.S.touch(); run(r.S, 5, 0.25);
    ok('A35 and it stays satisfied with the drain closed: "drain closed" is not a condition either way', DI.headSafe(r.S, r.v.id) === '');
    r.v.p.sdrain = 1; r.S.touch(); run(r.S, 2, 0.25); r.v.p.sol = true;
    ok('A35 the riser reset still refuses while D is latched', DI.resetValve(r.S, r.v.id).startsWith('Detection is still active') && r.s.state !== 'dry');
    r.v.p.sol = false; r.v.p.pLatch = true;
    ok('A35 the riser reset succeeds with the drain open and does not close it', DI.resetValve(r.S, r.v.id) === '' && r.s.state === 'dry' && r.v.p.sdrain === 1 && r.v.p.mech === false && r.S.acts.some((a) => a.kind === 'reset-valve' && a.id === r.v.id));
    r.v.p.airValve = 1; run(r.S, 900, 1);
    ok('A35 with the drain left open the air cannot build and restore-air is not logged', r.s.P < 2 && !r.s.set && !r.S.acts.some((a) => a.kind === 'restore-air' && a.t > 1));
    r.v.p.sdrain = 0; r.S.touch(); run(r.S, 1500, 1);
    ok('A35 once the drain is closed the air returns and restore-air is logged', r.s.set && r.s.P > 36 && r.S.acts.filter((a) => a.kind === 'restore-air' && a.t > 1).length === 1);
    const w = new DI.World(40, 14); w.addRoom('office', 20, 2, 12, 8); w.addPart('city', 1, 6, 0); hline(w, 2, 13, 6, 6); const wv = w.addPart('wetv', 14, 6, 0); hline(w, 15, 19, 6, 6); for (let y = 2; y <= 9; y++) w.setPipe(20, y, 4, 0, true); grid(w, 21, 2, 31, 9);
    const wS = new DI.Sim(w); wS.commission(); DI.breakSprinkler(wS, w.k(28, 5)); run(wS, 20, 0.25);
    ok('A35 a wet riser keeps its own flow check', DI.replaceSprinklers(wS, wv.id) === 'Water is still flowing. Close the control valve first.');
    const ng = rig(); DI.breakSprinkler(ng.S, ng.head); run(ng.S, 120, 0.25); ng.v.p.airValve = 0; run(ng.S, 60, 0.25);
    ok('A35 with no control valve upstream the water-isolation test is waived (simplification)', DI.ctrlValve(ng.W, ng.v.id) === null && DI.headSafe(ng.S, ng.v.id) === '' && DI.replaceSprinklers(ng.S, ng.v.id) === '');
    const j = JSON.parse(JSON.stringify(r.W.toJSON())); for (const q of j.parts) { delete q.p.mrzL; delete q.p.fault; delete q.p.viaGate; delete q.p.pT; } delete j.cfg.asdModel;
    const d = JSON.parse(JSON.stringify(r.S.dump())); for (const [, o] of d.ss) for (const k of ['dz', 'av', 'det', 'dT', 'pDark', 'zf']) delete o[k];
    const W2 = DI.World.fromJSON(j), S2 = new DI.Sim(W2); S2.restore(d); run(S2, 5, 0.25);
    ok('A35 an old save loads: missing props take their defaults and the sim runs', W2.byType('prev')[0].p.mrzL === false && W2.byType('comp')[0].p.fault === false && DI.asdModel(W2) === 'VEP' && S2.ss.get(r.v.id).state === 'dry' && S2.acts.length === r.S.acts.length);
  }
  // A36 recovery, tripped valves: the riser reset comes before the air, with the drain still open
  {
    const trip = (o) => { const r = R.start(o); smoke(r.S, 0.2, 10); r.S.smoke[1] = 0; run(r.S, 30, 0.25); return r; };                    // broken head, then Fire 1: D AND P
    const safe = (r) => { DI.silence(r.S, r.pn.id); DI.findHead(r.S, r.head); R.shut(r); R.iso(r, 1); R.drain(r, 1); return R.zero(r); };   // steps 1 to 5
    const finish = (r) => { R.air(r); if (r.v.p.trim === 'el-pn') { DI.resetTrimP(r.S, r.v.id); run(r.S, 1, 0.25); } DI.panelReset(r.S, r.pn.id); run(r.S, 2, 0.25); return R.reopen(r); };
    const a = trip({ props: { trim: 'el-pn' } });
    ok('A36 El/Pn: a broken head plus Fire 1 trips the valve and it discharges', a.s.state !== 'dry' && a.s.tripT > 0 && a.v.p.sol === true && a.v.p.pLatch === true && R.score(a).why === 'head');
    const z = safe(a); const early = DI.resetValve(a.S, a.v.id);
    DI.panelReset(a.S, a.pn.id); run(a.S, 1, 0.25); const rep = DI.replaceSprinklers(a.S, a.v.id); run(a.S, 1, 0.25);
    const rst = DI.resetValve(a.S, a.v.id), drainOpen = a.v.p.sdrain === 1; run(a.S, 1, 0.25); R.drain(a, 0); R.iso(a, 0); const mg = finish(a), sa = R.score(a);
    ok('A36 El/Pn tripped: drained to zero, and the riser reset is refused until panel reset #1 clears D', z && early.startsWith('Detection is still active') && rep === '' && rst === '' && drainOpen);
    ok('A36 El/Pn tripped: 13 of 13 in order, the riser reset with the drain still open and before the air', mg === '' && sa.done === 13 && sa.complete && sa.inOrder && sa.closed && sa.tripped && sa.det && sa.steps.every((q) => !q.na) && R.step(a, 'reset-valve').t <= R.step(a, 'drain-close').t && R.step(a, 'drain-close').t <= R.step(a, 'restore-air').t && a.s.set && !a.v.p.pLatch && a.g.p.open > 0.99, R.show(sa));
    const b = trip(); safe(b); DI.panelReset(b.S, b.pn.id); run(b.S, 1, 0.25); DI.replaceSprinklers(b.S, b.v.id); run(b.S, 1, 0.25); DI.resetValve(b.S, b.v.id); run(b.S, 1, 0.25); R.drain(b, 0); R.iso(b, 0); const mb = finish(b), sb = R.score(b);
    ok('A36 El/El tripped: 13 of 13 in order, with step 11 (trim) not applicable', mb === '' && sb.done === 13 && sb.complete && sb.inOrder && sb.steps.filter((q) => q.na).map((q) => q.kind).join() === 'reset-trim', R.show(sb));
    // air before the riser reset: the code does not block it, the model cannot hold the air, and it scores out of order
    const c = trip(); safe(c); DI.panelReset(c.S, c.pn.id); run(c.S, 1, 0.25); DI.replaceSprinklers(c.S, c.v.id); R.iso(c, 0); run(c.S, 120, 1); const held = c.s.P;
    DI.resetValve(c.S, c.v.id); run(c.S, 1, 0.25); R.drain(c, 0); const mc = finish(c), scc = R.score(c);
    ok('A36 restoring the air before the riser reset is not blocked, holds no air, and is scored out of order', held < 2 && mc === '' && scc.complete && !scc.inOrder && R.step(c, 'restore-air').t < R.step(c, 'reset-valve').t, R.show(scc));
    const d = trip(); safe(d); DI.panelReset(d.S, d.pn.id); run(d.S, 1, 0.25); DI.replaceSprinklers(d.S, d.v.id); R.drain(d, 0); DI.resetValve(d.S, d.v.id); run(d.S, 1, 0.25); R.iso(d, 0); const md = finish(d), sd = R.score(d);
    ok('A36 closing the drain before the riser reset is scored out of order', md === '' && sd.complete && !sd.inOrder && R.step(d, 'drain-close').t < R.step(d, 'reset-valve').t, R.show(sd));
    const e = trip(); safe(e); DI.panelReset(e.S, e.pn.id); run(e.S, 1, 0.25); DI.replaceSprinklers(e.S, e.v.id); run(e.S, 1, 0.25); DI.resetValve(e.S, e.v.id); run(e.S, 1, 0.25); R.drain(e, 0); R.iso(e, 0);
    run(e.S, 60, 1); DI.panelReset(e.S, e.pn.id); run(e.S, 2, 0.25);
    ok('A36 a panel reset before the air is back scores nothing for step 12', e.v.p.pLatch === true && !R.step(e, 'reset-panel').done && R.step(e, 'reset-panel-1').done);
    R.air(e); DI.panelReset(e.S, e.pn.id); run(e.S, 2, 0.25);
    ok('A36 leaving the control valve shut leaves the recovery incomplete: 12 of 13', R.score(e).closed && R.score(e).done === 12 && !R.score(e).complete && R.score(e).steps.filter((q) => !q.done).map((q) => q.kind).join() === 'open-valve' && e.g.p.open < 0.02);
    e.W.power = false; e.pn.p.battH = 0; run(e.S, 1, 0.25); const dead = R.score(e).steps.filter((q) => q.na).map((q) => q.kind).join();
    e.W.power = true; run(e.S, 1, 0.25);
    ok('A36 steps that need a live panel are not applicable while the panel is dead now, and apply again when it is back', dead === 'silence,reset-panel-1,reset-trim,reset-panel' && R.score(e).steps.filter((q) => q.na).map((q) => q.kind).join() === 'reset-trim');
    const u = R.start(); smoke(u.S, 0.04, 5); u.S.smoke[1] = 0;
    ok('A36 an untripped El/El incident marks step 8 not applicable, and step 6 too when D was never latched', R.step(u, 'reset-valve').na && R.step(u, 'reset-panel-1').na && !R.score(u).tripped && !R.score(u).det && u.s.state === 'dry');
    const c5g = DI.SCEN.find((q) => q.id === 'c5').goals;
    ok('A36 contract 5 has six goals and none gates on a recovery', c5g.length === 6 && c5g.every((q) => !/Recovery done in order/.test(q.t)));
  }
  // A37 loss of supply air; the water-filled zone
  {
    const r = rig(), comp = r.W.byType('comp')[0]; r.s.holes = 400; r.W.power = false; run(r.S, 600, 1);
    const sa = r.S.sig.get('sa' + r.v.id), la = r.S.sig.get('la' + r.v.id);
    ok('A37 the only compressor unpowered: LOSS OF SUPPLY AIR is a trouble of its own, beside the LOW AIR supervisory', !!sa && sa.type === 'TRBL' && sa.mon && sa.text.startsWith('LOSS OF SUPPLY AIR - Preaction system #') && sa.text.endsWith('(compressor / N2 source unavailable)') && !!la && la.type === 'SUPV' && r.s.state === 'dry' && comp.p.on === false, 'P ' + r.s.P.toFixed(1));
    const f = rig(), fc = f.W.byType('comp')[0]; fc.p.fault = true; f.s.holes = 400; run(f.S, 600, 1);
    ok('A37 a faulted compressor raises it with the power on, and does not run', f.W.power === true && f.S.sig.has('sa' + f.v.id) && fc.p.on === false && fc.p.runSec === 0 && f.s.P < 38 && DI.PARTS.comp.props.fault === false && DI.PARTS.n2.props.fault === false);
    fc.p.fault = false; run(f.S, 2, 0.25); ok('A37 it clears when the source is back', !f.S.sig.has('sa' + f.v.id) && fc.p.on === true);
    const i = rig(); i.v.p.airValve = 0; i.s.holes = 400; run(i.S, 600, 1);
    ok('A37 shutting the zone\'s own supply valve is a deliberate isolation: low air, no loss-of-supply trouble', !i.S.sig.has('sa' + i.v.id) && i.S.sig.has('la' + i.v.id));
    const t = rig(); t.W.power = false; DI.startTest(t.S, 'leak', t.v.id); run(t.S, 10, 0.25);
    ok('A37 it is not raised while a 24 h air test runs on the zone', t.S.procs.length === 1 && !t.S.sig.has('sa' + t.v.id));
    // P latched by a slow leak, then Fire 1 with every head closed: the pipe fills and nothing discharges
    const z = rig(); z.v.p.airValve = 0; z.s.holes = 400; let n = 0; while (!z.v.p.pLatch && n++ < 40000) z.S.step(1);
    const g0 = z.S.stats.gallons, loss0 = z.S.stats.waterLoss; z.S.drill = { g0: 123, done: true }; smoke(z.S, 0.2, 5); z.S.smoke[1] = 0; run(z.S, 120, 0.25);
    const zf = z.S.acts.filter((a) => a.kind === 'zone-filled');
    ok('A37 latched P from a slow leak plus Fire 1, heads closed: the valve trips, the pipe fills, and it is logged as a water-filled zone (low-air)', z.s.state !== 'dry' && z.s.wat > DI.dryLim(z.s.vol) && zf.length === 1 && zf[0].why === 'low-air' && zf[0].id === z.v.id && z.v.p.pT < z.s.dT && DI.recoveryScore(z.S, z.v.id).why === 'fill');
    ok('A37 nothing discharges: no gallons, no water loss, the drill mark untouched', z.S.stats.gallons === g0 && z.S.stats.waterLoss === loss0 && z.S.outFlow === 0 && z.S.drill.g0 === 123 && z.s.openK.length === 0);
    ok('A37 the log says water-filled, an unattended low-air failure, not a discharge', z.S.log.some((l) => l.cls === 'bad' && l.text.includes('is water-filled: no head is open, so nothing discharges. This is an unattended low-air failure, not a discharge. Drain it, reset it, check for freeze and corrosion exposure, and fix the air supply.')));
    const h = rig(); breakHead(h); const hg = h.S.stats.gallons; smoke(h.S, 0.2, 5); run(h.S, 120, 0.25);
    ok('A37 the same trip with one head broken discharges and is not a water-filled zone', h.s.state !== 'dry' && h.S.stats.gallons > hg + 5 && !h.S.acts.some((a) => a.kind === 'zone-filled'));
    const p = rig(); DI.startTest(p.S, 'trip', p.v.id); p.S.warp(420);
    ok('A37 a trip test never logs a water-filled zone', DI.lastResult(p.S, 'trip', p.v.id) !== null && p.s.state !== 'dry' && !p.S.acts.some((a) => a.kind === 'zone-filled'));
    const fa = rig(); smoke(fa.S, 0.2, 5); fa.S.smoke[1] = 0; fa.v.p.airValve = 0; fa.s.holes = 400; n = 0; while (fa.s.state === 'dry' && n++ < 40000) fa.S.step(1); run(fa.S, 120, 0.25);
    ok('A37 D left latched first, then the air lost: also a water-filled zone, tagged false-alarm', fa.S.acts.filter((a) => a.kind === 'zone-filled').map((a) => a.why).join() === 'false-alarm');
    // the drill report line
    const D2 = rig(); D2.S.drill = { t0: 0 }; D2.S.acts.push({ t: 5, kind: 'incident', id: D2.v.id, why: 'fill' }, { t: 6, kind: 'zone-filled', id: D2.v.id, why: 'low-air' });
    const lines = DI.drillRecovery(D2.S, 'the broken sprinkler');
    ok('A37 the drill report adds one informational water-filled line for a low-air fill, and none otherwise', lines.length === 3 && lines[2][0] === false && lines[2][2] === true && lines[2][1] === 'Water-filled zone: ' + DI.sysName(D2.S, D2.v.id) + ' filled because P was left latched (unattended low-air failure), no discharge' && (D2.S.acts[D2.S.acts.length - 1].why = 'false-alarm', DI.drillRecovery(D2.S, 'x').length === 2));
  }
  // A39 bundle: the operator log cap, DI.juris isolation, package.json, tones
  {
    const r = rig(); DI.breakSprinkler(r.S, r.head); run(r.S, 30, 0.25); fixHead(r); run(r.S, 1, 0.25); r.s.inc = false;            // incident 1, closed by hand for the test
    for (let i = 0; i < 250; i++) r.S.act('find-head', r.v.id, { k: i });
    DI.breakSprinkler(r.S, r.head); run(r.S, 30, 0.25); fixHead(r); run(r.S, 1, 0.25); r.s.inc = false; for (let i = 0; i < 250; i++) r.S.act('find-head', r.v.id, { k: i });      // incident 2, closed
    DI.breakSprinkler(r.S, r.head); run(r.S, 30, 0.25); const open = r.S.acts.filter((a) => a.kind === 'incident').pop();   // incident 3, still open
    for (let i = 0; i < 700; i++) r.S.act('find-head', r.v.id, { k: i });
    ok('A39 three incidents were logged, 700 entries after the last', r.S.acts.filter((a) => a.kind === 'incident').length >= 1 && open.t > 60 && r.s.inc === true);
    ok('A39 the operator log is capped at 600, in memory and in a save', DI.ACTS_MAX === 600 && r.S.acts.length === 600 && r.S.dump().acts.length === r.S.acts.length);
    ok('A39 trimming drops closed history first and never the opening entry of an open incident', r.s.inc === true && r.S.acts.includes(open) && r.S.acts[0] === open && r.S.acts.filter((a) => a.kind === 'incident').length === 1 && DI.recoveryScore(r.S, r.v.id).t0 === open.t);
    // DI.juris is one global: two worlds in one process must each cite their own edition
    const a = rig(), b = rig(); a.W.cfg.edition = 'US-2019';
    const cites = (rv, yr) => rv.some((f) => f.ref.includes('NFPA 13-' + yr)) && !rv.some((f) => /NFPA 13-\d{4}/.test(f.ref) && !f.ref.includes('NFPA 13-' + yr));
    DI.setJuris(a.W); const rb = DI.review(b.S), j1 = DI.juris.nfpa13; DI.setJuris(a.W); const la = DI.deliveryLimits(a.S, a.v.id), lb = DI.deliveryLimits(b.S, b.v.id), j2 = DI.juris.nfpa13;
    const ra = DI.review(a.S); DI.setJuris(a.W); DI.startTest(b.S, 'leak', b.v.id); DI.setJuris(a.W); b.S.warp(86500); DI.startTest(a.S, 'leak', a.v.id); DI.setJuris(b.W); a.S.warp(86500);
    ok('A39 DI.juris isolation: review and delivery limits cite their own world, whatever setJuris ran last', cites(ra, 2019) && cites(rb, 2025) && j1 === 2025 && j2 === 2025 && la.nfpa.ref === 'NFPA 13-2019 §8.3.2.3.1.1' && lb.nfpa.ref === 'NFPA 13-2025 §8.3.2.3.1.1');
    ok('A39 DI.juris isolation: a test report cites the edition of the world it ran in', DI.lastResult(a.S, 'leak', a.v.id).lines[2].includes('NFPA 13-2019 §28.2.2.1') && DI.lastResult(b.S, 'leak', b.v.id).lines[2].includes('NFPA 13-2025 §29.2.2.1'));
    DI.setJuris(a.W); DI.review(b.S); ok('A39 DI.juris after DI.review(2025 world) is the 2025 row although the last setJuris was for 2019', DI.juris.nfpa13 === 2025 && DI.juris === DI.JURIS['US-2025']);
    DI.setJuris(new DI.World(4, 4));
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    ok('A39 package.json: private, test and test:ui scripts, playwright as the only devDependency, no runtime dependencies', pkg.private === true && Object.keys(pkg.devDependencies).join() === 'playwright' && !('dependencies' in pkg) && pkg.scripts.test.includes('test/campaign.test.js') && pkg.scripts['test:ui'].includes('test/ui.c3.js') && pkg.scripts['test:ui'].includes('test/ui.c4.js'));
    const au = fs.readFileSync(path.join(__dirname, '..', 'src', 'audio.js'), 'utf8');
    ok('A39 tones: audio.js has its own branch for ALARM, OPEN, TRBL and SUPV', ['ALARM', 'OPEN', 'TRBL', 'SUPV'].every((c) => new RegExp("=== '" + c + "'").test(au)) && /o\.lost|o\.dark/.test(au));
  }
  // A40 aspirating detector: per-model listed ranges, no clamp (the NFPA 76 ceilings are A45)
  {
    const rng = (k) => DI.ASD_STAGES.map(([s]) => DI.ASD_MODELS[k].range[s].join('-')).join(' ');
    ok('A40 the range table is the datasheet table: VEP and VEU, four stages each', Object.keys(DI.ASD_MODELS).join() === 'VEP,VEU' && rng('VEP') === '0.0015-0.614 0.0015-0.614 0.003-0.614 0.0061-6.575' && rng('VEU') === '0.0003-0.614 0.0003-0.614 0.0003-0.614 0.0003-6.575' && DI.ASD_DEFAULT === 'VEP');
    ok('A40 each model carries its document number and the source label', DI.ASD_MODELS.VEP.doc === 'Xtralis Doc. 36106_07, Part AD36106-007, July 2025, p. 2' && DI.ASD_MODELS.VEU.doc === 'Xtralis Doc. 36107_05, Part AD36107-005, November 2024, p. 2' && DI.ASD_SRC === '[HB, datasheet; UL Product iQ not checked]' && DI.ASD_MODELS.VEP.label === 'VESDA-E VEP');
    const r = rig(), W = r.W, set = (t, m) => { W.cfg.detThr = t; if (m) W.cfg.asdModel = m; else delete W.cfg.asdModel; }, F = () => DI.asdFindings(W), bad = (t, m) => (set(t, m), F().map((f) => f.stage).join());
    const old = DI.World.fromJSON(JSON.parse(JSON.stringify(W.toJSON())));
    ok('A40 a new world and an old save without the key read VEP; an unknown value reads VEP', DI.asdModel(W) === 'VEP' && !('asdModel' in old.cfg) && DI.asdModel(old) === 'VEP' && (W.cfg.asdModel = 'XYZ', DI.asdModel(W)) === 'VEP' && (W.cfg.asdModel = 'toString', DI.asdModel(W)) === 'VEP' && (W.cfg.asdModel = 'VEU', DI.asdModel(W)) === 'VEU' && DI.asdRange(W)[0][0] === 0.0003);
    const D0 = [0.03, 0.06, 0.12, 1.2];
    ok('A40 the example defaults sit inside the range on VEP and on VEU', bad(D0) === '' && bad(D0, 'VEU') === '' && fails(r.S, 'outside the listed range').length === 0);
    ok('A40 Alert 0.0010 fails on VEP (min 0.0015) and passes on VEU', bad([0.001, 0.06, 0.12, 1.2]) === '0' && bad([0.001, 0.06, 0.12, 1.2], 'VEU') === '');
    ok('A40 Fire 1 0.0020 fails on VEP (min 0.0030) and passes on VEU', bad([0.0005, 0.001, 0.002, 1.2], 'VEU') === '' && bad([0.0016, 0.0018, 0.002, 1.2]) === '2');
    ok('A40 Action 0.7, Fire 1 0.7 and Alert 0.7 fail on both models (max 0.614)', ['VEP', 'VEU'].every((m) => bad([0.03, 0.7, 0.12, 1.2], m) === '1' && bad([0.03, 0.06, 0.7, 1.2], m) === '2' && bad([0.7, 0.06, 0.12, 1.2], m) === '0'));
    ok('A40 Fire 2 7.0 fails on both; 6.0 and 0.5 pass on both; 0.005 fails on VEP (min 0.0061) and passes on VEU', ['VEP', 'VEU'].every((m) => bad([0.03, 0.06, 0.12, 7], m) === '3' && bad([0.03, 0.06, 0.12, 6], m) === '' && bad([0.03, 0.06, 0.12, 0.5], m) === '') && bad([0.001, 0.002, 0.003, 0.005], 'VEU') === '' && bad([0.0015, 0.002, 0.003, 0.005]) === '3');
    set([0.03, 0.06, 0.7, 1.2]); const f1 = fails(r.S, 'outside the listed range')[0];
    ok('A40 a failure names the stage, the model and its range, with the source label, and cites the datasheet', f1.text === 'Aspirating Fire 1 threshold 0.7 %/ft is outside the listed range of the VESDA-E VEP (0.0030 to 0.614 %/ft) [HB, datasheet; UL Product iQ not checked].' && f1.ref === 'Xtralis Doc. 36106_07, Part AD36106-007, July 2025, p. 2; NFPA 72 Ch. 14 (ITM)');
    set([0.03, 0.12, 0.12, 1.2]); const eq = fails(r.S, 'strictly increasing').length === 1 && F().length === 0; set([0.07, 0.06, 0.12, 1.2]);
    ok('A40 strict order inside the bounds: Action equal to Fire 1 fails the order check with both in range, and Alert above Action fails', eq && fails(r.S, 'strictly increasing').length === 1 && F().length === 0);
    set([0.0005, 0.06, 0.12, 1.2], 'VEU'); const veu = F().length; W.cfg.asdModel = 'VEP';
    ok('A40 no clamp: switching VEU to VEP leaves Alert 0.0005 as typed and adds the VEP range fail', veu === 0 && W.cfg.detThr[0] === 0.0005 && F().length === 1 && F()[0].text.includes('Alert threshold 0.0005 %/ft is outside the listed range of the VESDA-E VEP (0.0015 to 0.614 %/ft)'));
    DI.setJuris(new DI.World(4, 4));
  }
  // (A41, the reopen gate, is rewritten as A48 below: it now refuses only in the scored incident of a running drill)
  // ====================== Cycle 4 acceptance (A42 onward: cause-and-effect matrix, NFPA 76 ceilings, refill clock and
  // compressor sizing, reopen gate scope, impairment tag, edition keys, return to normal, supervising-station timing)
  const rowsTT = TT.readRows(), resTT = rowsTT.map((row) => TT.runRow(DI, row)), ttRow = (n) => resTT.find((q) => q.row === n);
  // a dry pipe rig: city main -> dry valve -> one unheated room, compressor, panel
  const dryRig = () => {
    const W = new DI.World(40, 14); W.addRoom('dock', 20, 2, 12, 8); W.addPart('city', 1, 6, 0, { stat: 80, resid: 60, flow: 1200 }); hline(W, 2, 13, 6, 6);
    const v = W.addPart('dryv', 14, 6, 0); hline(W, 15, 19, 6, 6); for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true); grid(W, 21, 2, 31, 9);
    W.addPart('comp', 14, 4, 0); W.setAir(14, 5, 1); const pn = W.addPart('panel', 16, 4, 0); W.wire(pn.id, v.id);
    const S = new DI.Sim(W); S.commission(); return { W, S, v, s: S.ss.get(v.id), pn };
  };
  // A42 matrix = fixture = engine, for every row of the fixture (the rows are read from the file, never copied in here)
  {
    const on = (row, k) => row[k] === '1', b = (x) => (x ? '1' : '0'), bad = [], classes = {};
    rowsTT.forEach((row, i) => {
      const r = resTT[i], { W, v } = r.rig;
      const vec = { fire1: on(row, 'Fire1'), fire2: on(row, 'Fire2'), manual: on(row, 'Manual'), mrz: on(row, 'ManualReleaseZone'), p: on(row, 'P'), lowAir: on(row, 'LowAir_SUP'), highAir: on(row, 'HighAir_SUP'), power: row.Power };
      const e = DI.ceEval(W, v, vec);
      const ce = { D: b(e.D), Solenoid: b(e.sol), ValveOpen: b(e.open), SS_Alarm: e.ss.ALARM ? '1' : e.ss.OPEN ? 'OPEN' : '0', SS_Supervisory: b(e.ss.SUPV), SS_Trouble: b(e.ss.TRBL) };
      for (const k of TT.CHECKED) {
        if (ce[k] !== String(row[k]).toUpperCase()) bad.push(row.Row + ' ' + k + ': matrix ' + ce[k] + ', fixture ' + row[k]);
        if (ce[k] !== r.got[k]) bad.push(row.Row + ' ' + k + ': matrix ' + ce[k] + ', engine ' + r.got[k]);
      }
      // LocalNAC is a rule, not a simulated output: an alarm-class signal annunciated at a live panel. It is held against
      // the fixture cell, against the rule itself, and against the same rule read from the engine's own signals.
      if (b(e.nac) !== row.LocalNAC) bad.push(row.Row + ' LocalNAC: matrix ' + b(e.nac) + ', fixture ' + row.LocalNAC);
      if (e.nac !== (e.signals.some((q) => q.class === 'ALARM') && row.Power !== 'Dead')) bad.push(row.Row + ' LocalNAC: not class ALARM and panel alive');
      if (e.nac !== r.sigs.some((q) => q.class === 'ALARM' && !q.dark && !q.lost && q.mon)) bad.push(row.Row + ' LocalNAC: matrix and engine signals disagree');
      // per signal: the same set of signals, each with the same class, the same annunciation and the same transmission
      const want = new Map(e.signals.map((q) => [q.key, q])), seen = new Set();
      for (const q of r.sigs) {
        const m = q.ce ? want.get(q.ce) : null; if (!m) { bad.push(row.Row + ': engine signal ' + q.key + ' has no matrix signal'); continue; }
        seen.add(q.ce);
        if (m.class !== q.class) bad.push(row.Row + ' ' + q.key + ': class ' + m.class + ', engine ' + q.class);
        if (m.annunciated !== (!q.dark && !q.lost)) bad.push(row.Row + ' ' + q.key + ': annunciated ' + m.annunciated + ', engine dark ' + q.dark);
        if (m.transmit !== (q.mon && q.tx)) bad.push(row.Row + ' ' + q.key + ': transmit ' + m.transmit + ', engine mon ' + q.mon + ' tx ' + q.tx);
      }
      for (const m of e.signals) if (!seen.has(m.key)) bad.push(row.Row + ': matrix signal ' + m.key + ' is not raised by the engine');
      classes[row.Row] = e.signals.map((q) => q.key + ':' + q.class).join();
    });
    ok('A42 all 17 fixture rows: matrix = fixture = engine on D, Solenoid, ValveOpen, SS_Alarm, SS_Supervisory, SS_Trouble and LocalNAC, and signal by signal on class, annunciation and transmission', rowsTT.length === 17 && resTT.every((q) => q.ok) && bad.length === 0, bad.join('; ') || undefined);
    ok('A42 R04 and R17: P alone is one OPEN signal on both trims, never supervisory, and it sounds no NAC', classes.R04 === 'pLatch:OPEN' && classes.R17 === 'pLatch:OPEN' && ttRow('R04').got.SS_Alarm === 'OPEN' && ttRow('R17').got.SS_Supervisory === '0');
    ok('A42 R12 and R13 are read through the time-skip: AC failure and loss of communication reach the station as trouble', ttRow('R12').skipped === 3660 && ttRow('R13').skipped === 3660 && classes.R12.includes('acFail:TRBL') && classes.R13.split(',').sort().join() === 'fire1:ALARM,lostComm:TRBL', classes.R12 + ' | ' + classes.R13);
    const H = DI.panelHolds;
    ok('A42 one rule for what a panel holds: alive holds everything; dead holds no D, no zone latch, and P only at the pneumatic actuator; with no panel the P sensor still latches', JSON.stringify(H('el-el', true, true)) === '{"sol":true,"pull":true,"mrzL":true,"pLatch":true}' && JSON.stringify(H('el-el', false, true)) === '{"sol":false,"pull":false,"mrzL":false,"pLatch":false}' && H('el-pn', false, true).pLatch === true && H('el-pn', false, true).sol === false && H('el-el', false, false).pLatch === true);
    ok('A42 the matrix reads the release from DI.relState and the classes from DI.inClass, with no table of its own', /DI\.relState\(W, probe\)/.test(DI.ceEval.toString()) && /DI\.inClass\(W, key\)/.test(DI.ceEval.toString()) && !/'ALARM'|'SUPV'|'TRBL'/.test(DI.ceEval.toString().replace(/q\.class === 'ALARM'/g, '').replace(/ss = \{[^}]*\}/, '')));
  }
  // A43 matrix rows the fixture does not have, driven on a rig and held against the engine only
  {
    const live = new Set(), M = (r) => DI.ceMatrix(r.S, r.v.id), rowOf = (r, k) => M(r).rows.find((q) => q.key === k);
    // the row is ACTIVE NOW and reads the same class, annunciation and transmission as the engine signal `sig`
    const agree = (r, rowKey, sig) => { const o = r.S.sig.get(sig), q = rowOf(r, rowKey); if (q && q.live) live.add(rowKey); return !!o && !!q && q.live && q.class === o.type && q.annunciated === (!o.dark && !o.lost) && q.transmit === o.mon; };
    const a = rig({ gate: true }); smoke(a.S, 0.04, 5);
    const al = agree(a, 'alert', 'v' + a.d.id + '.1') && rowOf(a, 'alert').class === 'SUPV' && rowOf(a, 'alert').cells[2] === 'SUPV (pre-alarm, [OWNER])' && !rowOf(a, 'alert').nac && !rowOf(a, 'alert').sol;
    smoke(a.S, 0.07, 5);
    ok('A43 Alert and Action: supervisory by default, pre-alarm, no NAC and no solenoid; an Alert the detector has passed is no longer active', al && agree(a, 'action', 'v' + a.d.id + '.2') && rowOf(a, 'action').class === 'SUPV' && !rowOf(a, 'alert').live && !rowOf(a, 'action').nac);
    a.W.cfg.sigClass = { alert: 'ALARM', action: 'ALARM' }; run(a.S, 1, 0.25);
    ok('A43 Alert and Action are alarm when the owner elects it, and still energize nothing', agree(a, 'action', 'v' + a.d.id + '.2') && rowOf(a, 'action').class === 'ALARM' && rowOf(a, 'alert').class === 'ALARM' && rowOf(a, 'action').nac && !rowOf(a, 'action').sol && a.v.p.sol === false);
    const f = rig(); smoke(f.S, 0.2, 5); const f1 = agree(f, 'fire1', 'v' + f.d.id + '.3') && !rowOf(f, 'fire1').sol && rowOf(f, 'fire1').nac; smoke(f.S, 5, 3);
    ok('A43 Fire 1 and Fire 2 are alarm; at Fire 2 the Fire 1 row stays active (D is a level check) and neither energizes the El/El solenoid without P', f1 && agree(f, 'fire2', 'v' + f.d.id + '.4') && rowOf(f, 'fire1').live && !rowOf(f, 'fire2').sol && !rowOf(f, 'fire2').open);
    const m = rig({ stn: true }); m.stn.p.on = true; run(m.S, 2, 0.25);
    ok('A43 manual station typed DETECTION: alarm, inside D; the Manual Release zone row is greyed with the bypass OFF', agree(m, 'manual', 'ms' + m.v.id) && rowOf(m, 'manual').class === 'ALARM' && rowOf(m, 'mrz').applies === false && rowOf(m, 'mrz').cells[2] === 'not on this site: bypass OFF' && !rowOf(m, 'mrz').live);
    const z = rig({ stn: true }); z.W.cfg.manualReleaseBypassP = true; z.stn.p.on = true; run(z.S, 2, 0.25);
    ok('A43 with the 9(c) bypass ON on El/El the Manual Release zone row applies, is alarm, energizes the solenoid and opens the valve without P; the DETECTION row is greyed', agree(z, 'mrz', 'ms' + z.v.id) && rowOf(z, 'mrz').sol && rowOf(z, 'mrz').open && rowOf(z, 'mrz').cells[6] === 'yes: ENERGIZED, valve opens' && rowOf(z, 'manual').applies === false && rowOf(z, 'manual').cells[2].startsWith('not on this site: bypass ON'));
    const zp = rig({ stn: true, props: { trim: 'el-pn' } }); zp.W.cfg.manualReleaseBypassP = true; run(zp.S, 1, 0.25);
    ok('A43 on El/Pn the bypass does not apply: the zone row is greyed and says why, and Fire 1 energizes the solenoid with the valve still shut', rowOf(zp, 'mrz').applies === false && rowOf(zp, 'mrz').cells[2].startsWith('not on this site: electric / pneumatic trim') && rowOf(zp, 'fire1').sol && !rowOf(zp, 'fire1').open && rowOf(zp, 'fire1').cells[6] === 'yes: ENERGIZED; valve opens only with P' && M(zp).notes[0].includes('ENERGIZED on D; water also needs P at the actuator'));
    const p = rig(); breakHead(p); const lo = agree(p, 'lowAir', 'la' + p.v.id) && rowOf(p, 'lowAir').class === 'SUPV' && !rowOf(p, 'lowAir').sol; fixHead(p); run(p.S, 5, 0.25);
    const pOpen = agree(p, 'p', 'pl' + p.v.id) && rowOf(p, 'p').class === 'OPEN' && rowOf(p, 'p').cells[2] === 'OPEN - class not elected, never supervisory' && !rowOf(p, 'p').nac && !rowOf(p, 'p').sol;
    let elect = DI.inClass(p.W, 'pLatch') === 'OPEN'; for (const c of ['ALARM', 'TRBL']) { p.W.cfg.sigClass = { pLatch: c }; run(p.S, 1, 0.25); elect = elect && DI.inClass(p.W, 'pLatch') === c && agree(p, 'p', 'pl' + p.v.id) && rowOf(p, 'p').class === c && rowOf(p, 'p').nac === (c === 'ALARM'); }
    p.W.cfg.sigClass = { pLatch: 'SUPV' }; run(p.S, 1, 0.25);
    ok('A43 P: OPEN by default, ALARM or TRBL when elected, and never SUPV even if the setting is forced; low air is supervisory and no release input', lo && pOpen && elect && DI.inClass(p.W, 'pLatch') === 'OPEN' && rowOf(p, 'p').class === 'OPEN' && p.S.sig.get('pl' + p.v.id).type === 'OPEN');
    const h = rig(); h.s.G = (55 + DI.ATM) * h.S.sysd.info.get(h.v.id).vol; run(h.S, 2, 0.25);
    const rl = rig(); breakHead(rl); smoke(rl.S, 0.2, 5); run(rl.S, 30, 0.25);
    ok('A43 high air is supervisory; Fire 1 AND P is the release row: solenoid energized, valve open, waterflow alarm', agree(h, 'highAir', 'ha' + h.v.id) && rowOf(rl, 'fire1+p').live && rowOf(rl, 'fire1+p').sol && rowOf(rl, 'fire1+p').open && rowOf(rl, 'fire1+p').class === rl.S.sig.get('rl' + rl.v.id).type && agree(rl, 'waterflow', 'wf' + rl.v.id) && rowOf(rl, 'waterflow').class === 'ALARM' && !rowOf(rl, 'fire1+p, battery').live);
    if (rowOf(rl, 'fire1+p').live) live.add('fire1+p');
    a.W.cfg.sigClass = {}; DI.setGate(a.S, a.g.id, 0); run(a.S, 6, 0.25);
    ok('A43 tamper (control valve closed) is supervisory, on the panel of the control valve; with no control valve the row is greyed', agree(a, 'tamper', 'tm' + a.g.id) && rowOf(a, 'tamper').class === 'SUPV' && rowOf(f, 'tamper').applies === false && rowOf(f, 'tamper').cells[2] === 'not on this site: no control valve upstream');
    const sa = rig(); sa.W.byType('comp')[0].p.fault = true; run(sa.S, 2, 0.25);
    const np = rig(); np.W.power = false; run(np.S, 2, 0.25); const ac = np.S.sig.get('ac' + np.pn.id);
    ok('A43 supply air (compressor failed, or off with no power) is TRBL, fixed in the registry; AC failure is TRBL at the panel with its transmission delay', DI.SIG_FIXED.supplyAir === 'TRBL' && agree(sa, 'supplyAir', 'sa' + sa.v.id) && rowOf(sa, 'supplyAir').class === 'TRBL' && agree(np, 'supplyAir', 'sa' + np.v.id) && agree(np, 'acFail', 'ac' + np.pn.id) && rowOf(np, 'acFail').class === 'TRBL' && ac.tx === false && rowOf(np, 'acFail').ssDelay === ac.delay && ac.delay === 3600 && rowOf(np, 'acFail').panelDelay === DI.TROUBLE_PANEL_S && !rowOf(np, 'acFail').nac);
    breakHead(np); smoke(np.S, 0.2, 5); run(np.S, 5, 0.25); if (rowOf(np, 'fire1+p, battery').live) live.add('fire1+p, battery');
    const batt = rowOf(np, 'fire1+p, battery').live && !rowOf(np, 'fire1+p').live && rowOf(np, 'fire1+p, battery').sol && np.v.p.solOut === true && np.s.state !== 'dry';
    np.pn.p.battH = 1.5; run(np.S, 1, 0.25); const lb = agree(np, 'lowBatt', 'lb' + np.pn.id) && rowOf(np, 'lowBatt').class === 'TRBL';
    const dd = rig(); dd.W.power = false; dd.pn.p.battH = 0; breakHead(dd); smoke(dd.S, 0.2, 5); const dr = rowOf(dd, 'fire1+p, panel dead'); if (dr.live) live.add('fire1+p, panel dead');
    const early = !rowOf(dd, 'lostComm').live && !dd.S.sig.has('pd' + dd.pn.id); dd.S.warp(DI.commDelay(dd.W) + 60);
    ok('A43 on battery the panel still releases; low battery is TRBL; a dead panel energizes nothing, shows nothing, and the station reports loss of communication only after its interval', batt && lb && dr.live && !dr.sol && !dr.open && !dr.annunciated && !dr.nac && dr.cells[3] === 'dark: nothing displayed' && dd.s.state === 'dry' && early && agree(dd, 'lostComm', 'pd' + dd.pn.id) && rowOf(dd, 'lostComm').class === 'TRBL' && rowOf(dd, 'lostComm').lost && dd.S.sig.get('pd' + dd.pn.id).lost === true && rowOf(dd, 'lostComm').ssDelay === 3600);
    ok('A43 every row of the matrix was seen ACTIVE NOW while its signal was present', DI.CE_ROWS.every((r) => live.has(r.key)), DI.CE_ROWS.filter((r) => !live.has(r.key)).map((r) => r.key).join() || undefined);
    const u = rig(); u.W.unwire(u.v.id); u.S.sync();
    ok('A43 a zone with no panel: nothing is annunciated or transmitted, and D energizes nothing', M(u).wired === false && M(u).rows.filter((q) => q.applies && q.class).every((q) => !q.annunciated && !q.transmit && !q.sol && !q.nac) && rowOf(u, 'fire1').cells[3] === 'local only: not wired to a panel' && DI.ceMatrix(u.S, u.pn.id) === null);
  }
  // A44 hooks are hooks only; exclusions; the class registry
  {
    const r = rig(), M = () => DI.ceMatrix(r.S, r.v.id), cells = () => M().rows.map((q) => q.cells.slice());
    const c0 = cells();
    ok('A44 the nine columns, in order', DI.CE_COLS.join() === 'Input,Tag,SignalClass,PanelAnnunciation,SS_Transmit,LocalNAC,Solenoid,HVAC_Hook,EPO_Hook' && M().cols.join() === DI.CE_COLS.join() && M().rows.every((q) => q.cells.length === 9) && M().rows.length === DI.CE_ROWS.length && DI.CE_ROWS.length === 18);
    ok('A44 both hooks default to none / OFF with nothing stored, and every row reads none and OFF', DI.hvacHook(r.W) === 'none' && DI.epoHook(r.W) === false && !('hvacHook' in r.W.cfg) && !('epoHook' in r.W.cfg) && c0.every((c) => c[7] === 'none' && c[8] === 'OFF') && M().hooks.hvac === 'none' && M().hooks.epo === false);
    r.W.cfg.hvacHook = 'crah'; r.W.cfg.epoHook = true; const c1 = cells(), rows = M().rows;
    const changed = (i) => c1.map((c, n) => (c[i] !== c0[n][i] ? rows[n].key : null)).filter(Boolean).join(), other = c1.every((c, n) => c.slice(0, 7).join('|') === c0[n].slice(0, 7).join('|'));
    ok('A44 electing the hooks changes only the hook cells: HVAC on the rows where an alarm is annunciated, EPO on the rows where the valve opens (ASSUMED mapping)', other && changed(7) === rows.filter((q) => q.applies && q.nac).map((q) => q.key).join() && changed(7) === 'fire1,fire2,manual,fire1+p,fire1+p, battery,waterflow' && changed(8) === 'fire1+p,fire1+p, battery' && rows.find((q) => q.key === 'fire1').cells[7] === 'HOOK: output contact (CRAH/AHU shutdown)' && rows.find((q) => q.key === 'fire1+p').cells[8] === 'HOOK: output contact (power isolation)', changed(7) + ' | ' + changed(8));
    r.W.cfg.hvacHook = 'damper'; const dm = M().rows.find((q) => q.key === 'fire1').cells[7]; r.W.cfg.hvacHook = 'fans';
    ok('A44 damper is the other HVAC election; any other value reads none', dm === 'HOOK: output contact (damper)' && DI.hvacHook(r.W) === 'none' && (r.W.cfg.epoHook = 'yes', DI.epoHook(r.W)) === false);
    // hook only: the same fire with and without the hooks elected leaves the same world
    const burn = (hook) => { const q = rig(); if (hook) { q.W.cfg.hvacHook = 'crah'; q.W.cfg.epoHook = true; } DI.ignite(q.S, q.head, 0); run(q.S, 240, 0.25);
      return JSON.stringify([[...q.W.parts.values()].map((x) => x.p), [...q.S.sig.keys()], q.W.rooms.map((x) => [x.temp, x.smk, x.burst]), [...q.S.smoke], q.W.power, q.S.stats, q.s.state, q.s.P]); };
    const b0 = burn(false), b1 = burn(true);
    ok('A44 hook only, never automatic: a fire with a hook elected changes no part, room temperature, detector, power or valve value', b0 === b1 && b0.length > 500 && /"lvl":[34]/.test(b0));
    const dir = path.join(__dirname, '..', 'src'), files = fs.readdirSync(dir).filter((x) => x.endsWith('.js')), names = files.filter((x) => /hvacHook|epoHook/.test(fs.readFileSync(path.join(dir, x), 'utf8')));
    ok('A44 static: the hook settings are named only in cause.js and ui.js (Site dialog and siteSet); manual.js may name them and nothing else does', names.includes('cause.js') && names.includes('ui.js') && names.every((x) => ['cause.js', 'ui.js', 'manual.js'].includes(x)), names.join());
    ok('A44 the matrix has no column or row for elevator, door or compressor control, and says so in its footer', !DI.CE_COLS.concat(DI.CE_ROWS.map((q) => q.key + ' ' + q.label)).some((t) => /elevator|door|compressor control/i.test(t)) && /elevator recall, door release, the control of the compressor/.test(M().excluded));
    const step = DI.alarmStep.toString();
    ok('A44 static: no add(...) in alarmStep carries a literal class for a signal of the registry', !/add\('(v|mn|wf|la|ha|sa|rl|ms|pl|im|tm|ac|lb|pd)' \+ [^,]+, '(ALARM|SUPV|TRBL|OPEN)'/.test(step) && (step.match(/DI\.inClass\(W, /g) || []).length >= 14 && Object.keys(DI.SIG_FIXED).join() === 'fire1,fire2,manual,mrz,release,waterflow,lowAir,highAir,tamper,supplyAir,acFail,lowBatt,lostComm,impair');
    DI.setJuris(new DI.World(4, 4));
  }
  // A45 NFPA 76 as ceilings: Alert 0.2 and Fire 1 (the first alarm stage) 1.0; nothing elected, nothing written
  {
    const r = rig(), W = r.W, codes = () => DI.n76Flags(W).map((q) => q.code + ':' + q.sev).join(), D0 = [0.03, 0.06, 0.12, 1.2];
    ok('A45 not adopted: no flags, no note', DI.n76Flags(W).length === 0 && DI.n76Note(W) === '' && !DI.review(r.S).some((q) => q.ref.startsWith('NFPA 76')));
    W.cfg.nfpa76Adopted = true;
    const note = DI.n76Note(W), rv = DI.review(r.S).filter((q) => q.ref.startsWith('NFPA 76-2024 §8.5.3.1.2.5'));
    ok('A45 adopted, defaults, VEP: no flag, no fail, and the note that the listing binds first', codes() === '' && fails(r.S, 'NFPA 76').length === 0 && note === 'NFPA 76 ceilings: Alert 0.2, Fire 1 1.0 %/ft. The VESDA-E VEP listing (Fire 1 maximum 0.614) is tighter, so the listing binds first. [PRACTICE, NEEDS PE REVIEW].' && rv.length === 1 && rv[0].sev === 'ok' && rv[0].text === note);
    W.cfg.asdModel = 'VEU'; const veu = DI.n76Note(W).includes('The VESDA-E VEU listing (Fire 1 maximum 0.614)'); delete W.cfg.asdModel;
    W.cfg.n76AlarmStage = 'fire2'; const ig = codes() === '' && DI.n76Note(W) === note && fails(r.S, 'NFPA 76').length === 0; const old = DI.World.fromJSON(JSON.parse(JSON.stringify(W.toJSON())));
    ok('A45 the retired stage election is ignored: Fire 2 = 1.2 with the old key set to fire2 raises nothing, and an old save that carries the key loads', veu && ig && old.cfg.n76AlarmStage === 'fire2' && DI.n76Flags(old).length === 0 && DI.detThr(old).join() === D0.join());
    delete W.cfg.n76AlarmStage; W.cfg.detThr = [0.3, 0.4, 0.5, 1.2];
    ok('A45 Alert 0.3 fails N76_ALERT_OVER', codes() === 'N76_ALERT_OVER:fail' && DI.n76Flags(W)[0].text === 'NFPA 76 is adopted on this site: Alert must be 0.2 %/ft or less (it is 0.3).' && fails(r.S, 'NFPA 76 is adopted').length === 1);
    // Fire 1 above 1.0 cannot be reached inside the VEP or VEU listing (maximum 0.614), so the range is widened for this check only
    const keep = DI.ASD_MODELS.VEP.range; let over = '', f2 = '', wide = '', txt = '';
    try {
      DI.ASD_MODELS.VEP.range = Object.assign({}, keep, { fire1: [0.003, 3] });
      W.cfg.detThr = [0.03, 0.06, 1.5, 2.5]; over = codes(); txt = DI.n76Flags(W)[0].text; wide = DI.n76Note(W);
      W.cfg.detThr = [0.03, 0.06, 0.9, 2.5]; f2 = codes();
    } finally { DI.ASD_MODELS.VEP.range = keep; }
    ok('A45 Fire 1 above 1.0 fails N76_ALARM_OVER; Fire 2 above 1.0 does not; where the listing is not tighter there is no note', over === 'N76_ALARM_OVER:fail' && txt === 'NFPA 76 is adopted on this site: Fire 1, the first alarm stage, must be 1.0 %/ft or less (it is 1.5). PRACTICE, NEEDS PE REVIEW.' && f2 === '' && wide === '' && DI.ASD_MODELS.VEP.range.fire1[1] === 0.614);
    W.cfg.detThr = D0.slice(); const pre = JSON.stringify(W.cfg), ver = W.ver, msg = DI.n76Check(W);
    ok('A45 the check writes nothing: thresholds, settings and the world version are identical before and after', msg === 'NFPA 76 check: Alert 0.03 (meets 0.2: yes), Fire 1 0.12 (meets 1.0: yes).' && JSON.stringify(W.cfg) === pre && W.ver === ver && DI.detThr(W).join() === D0.join());
    DI.setJuris(new DI.World(4, 4));
  }
  // A46 the refill clock, the operator-step bonus, and "skip the refill"
  {
    const toRefill = (o) => { const r = R.start(o); R.shut(r); R.iso(r, 1); R.drain(r, 1); R.zero(r); DI.replaceSprinklers(r.S, r.v.id); R.drain(r, 0); return r; };       // head replaced, drain shut, supply still isolated
    const r = toRefill(), id = r.v.id, idle = DI.refillState(r.S, id), idleRow = DI.refillText(r.S, id)[0];
    R.iso(r, 0); run(r.S, 60, 1); const on = DI.refillState(r.S, id), onRow = DI.refillText(r.S, id);
    ok('A46 the clock starts with the first gas into the closed-up zone and counts against 30 min', idle.t === null && !idle.running && idleRow === '-' && on.running && on.t > 55 && on.t <= 61 && on.limit === 1800 && DI.REFILL_LIMIT === 1800 && !on.over && onRow[0] === (on.t / 60).toFixed(1) + ' of 30 min' && onRow[1] === 'warn' && DI.refilling(r.S, id), onRow[0]);
    const t0 = r.S.t, left = r.S.warp(7200, 0, () => !DI.refilling(r.S, id)), end = DI.refillState(r.S, id), endRow = DI.refillText(r.S, id);
    ok('A46 "skip the refill" stops when the zone is back at normal, well inside 2 h, and the row reads OK', left === 0 && r.S.t - t0 < 1800 && !end.running && Math.abs(end.t - (r.S.t - t0 + 60)) < 25 && r.s.P >= r.v.p.airSet - 3.2 && r.s.P <= r.v.p.airSet + 0.5 && /^[\d.]+ min of the 30 min limit: OK$/.test(endRow[0]) && endRow[1] === 'good' && !DI.refilling(r.S, id), endRow[0] + ' after ' + Math.round(r.S.t - t0) + ' s');
    const u = toRefill(); u.W.power = false; R.iso(u, 0); const u0 = u.S.t; u.S.warp(7200, 0, () => !DI.refilling(u.S, u.v.id));
    ok('A46 with the compressor unpowered the skip never runs beyond 7,200 s, and the zone is still not at normal', Math.abs(u.S.t - u0 - 7200) < 1 && DI.refilling(u.S, u.v.id) && u.s.P < 5);
    r.S.warp(2000); r.s.fillTime = 2136; const failRow = DI.refillText(r.S, id); r.s.rfill = true; r.s.fillT0 = r.S.t - 1900; const runOver = DI.refillText(r.S, id); r.s.rfill = false;
    ok('A46 over 1,800 s the row reads FAIL (and red while still running)', failRow[0] === 'FAIL: 35.6 min over the 30 min limit' && failRow[1] === 'bad' && runOver[0] === '31.7 of 30 min' && runOver[1] === 'bad');
    const cite = (ed, n2) => { const q = rig(); if (ed) q.W.cfg.edition = ed; if (n2) { q.W.removePart(q.W.byType('comp')[0].id); q.W.addPart('n2', 14, 4, 0); q.S.sync(); } return DI.refillState(q.S, q.v.id).ref; };
    ok('A46 the limit is cited by edition: 2019 and 2022 §8.2.6.3.2, 2025 §8.2.7.3; an N2-only source 2019 and 2022 §8.2.6.8.4, and 2025 says the subsection was not pulled', cite() === 'NFPA 13-2025 §8.2.7.3' && cite('US-2022') === 'NFPA 13-2022 §8.2.6.3.2' && cite('US-2019') === 'NFPA 13-2019 §8.2.6.3.2' && cite('US-2019', true) === 'NFPA 13-2019 §8.2.6.8.4' && cite('US-2022', true) === 'NFPA 13-2022 §8.2.6.8.4' && cite('US-2025', true) === 'NFPA 13-2025 §8.2.7.3 (2025 N2-only subsection not pulled)');
    DI.setJuris(new DI.World(4, 4));
    const ds = c5run.ds;
    ok('A46 c5 reference drill: total about 755 s, of which the refill is about 732 s and the operator steps about 24 s (target 300 s, met)', Math.abs(ds.time - 755) < 20 && Math.abs(ds.refill - 732) < 20 && Math.abs(ds.opTime - 24) < 10 && ds.opTime <= DI.RECOVERY_TARGET && Math.abs(ds.time - ds.refill - ds.opTime) < 1e-6 && c5run.dr.pass, Math.round(ds.time) + ' / ' + Math.round(ds.refill) + ' / ' + Math.round(ds.opTime) + ' s');
    // On one shared 10 scfm compressor the game fills every zone at once, so two commissioning fills of the reference build run past 30 min.
    // The row says FAIL (or is red while still filling); nothing else reads it.
    const fl = c5run.fills, overs = fl.filter((q) => q.st.over);
    ok('A46 c5 reference build: a fill over 30 min shows on the valve row, and no goal, review fail or drill line changes', overs.length >= 1 && overs.every((q) => q.row[1] === 'bad' && (/^FAIL: [\d.]+ min over the 30 min limit$/.test(q.row[0]) || / of 30 min$/.test(q.row[0]))) && c5run.goals.every(Boolean) && c5run.rvFails === 0 && c5run.dr.pass && c5run.rows.every((q) => q[1] === 'good'), fl.map((q) => '#' + q.id + ' ' + q.row[0]).join(', '));
    ok('A46 no goal of any contract and no review finding reads the refill clock, except the long-standing dock goal of contract 2 (Cold Dock)', DI.SCEN.every((sc) => sc.goals.every((q) => !/refillState|refillText|\.refill\b|REFILL_LIMIT/.test(q.ok.toString()))) && DI.SCEN.reduce((n, sc) => n + sc.goals.filter((q) => /fillTime/.test(q.ok.toString())).length, 0) === 1 && !/fillTime|refillState|refillText/.test(DI.review.toString()));
    // A deliberately slow compressor on the incident zone. 3.8 scfm puts the refill over 30 min while the air is still back
    // before the drill's false alarm at 2,100 s (at 3 scfm the false alarm would find P latched and change the incident).
    const B = DI.buildScenario(c5), bs = DI.botBuild(B.S, 'c5'); B.S.warp(bs.settle);
    for (const [kind, vid] of bs.tests) { DI.startTest(B.S, kind, vid); B.S.warp(420); bs.after(B.S, kind, vid); }
    B.W.byType('comp')[0].p.scfm = 3.8; DI.startDrill(B.S, c5.drill); let guard = 0; while (!B.S.drill.done && guard++ < 400000) { B.S.step(B.S.fires.length || B.S.outFlow > 1 ? 0.25 : 1); DI.drillStep(B.S); bs.ops(B.S); }
    const bi = B.S.acts.find((q) => q.kind === 'incident' && q.t >= B.S.drill.t0), bd = DI.recoveryScore(B.S, bi.id, B.S.drill.t0), bl = B.S.drill.result.lines;
    ok('A46 a slow compressor: the refill line reads FAIL, the operator-step time is unchanged, and the drill still passes with its star', B.S.drill.result.pass && bd.complete && bd.inOrder && bd.refill > 1800 && Math.abs(bd.opTime - ds.opTime) < 5 && bl.some((l) => /^• Air refill: [\d.]+ min, limit 30 min \[NFPA 13-2025 §8\.2\.7\.3\]: FAIL$/.test(l)) && bl.some((l) => /^★ Time bonus: operator steps took [\d.]+ s, target 5\.0 min/.test(l)) && bl.includes('★ Recovery after the broken sprinkler: 13 of 13 steps, in order') && !bl.some((l) => l[0] === '✗'), bl.filter((l) => /refill|bonus|Total/.test(l)).join(' | '));
  }
  // A47 compressor sizing: scfm_min = V_ft3 x (P_normal / 14.7) / 30 on the largest zone that shares a source; a warning only
  {
    const big = c5run.fills.find((q) => q.id === q.size.gov), sz = big.size;
    ok('A47 the c5 largest zone (525 gal, 70.2 ft3 at 40 psi) needs about 6.37 scfm, 7.96 with the x1.25 margin; all three zones share the compressor and are sized on it', Math.abs(sz.min - 6.37) < 0.01 && Math.abs(sz.margin - 7.96) < 0.01 && Math.abs(sz.ft3 - 70.2) < 0.1 && sz.have === 10 && !sz.below && !sz.tight && c5run.fills.every((q) => q.size.gov === big.id && q.size.shared === 2 && q.size.min === sz.min) && DI.AIR_SIZING.margin === 1.25 && Math.abs(sz.min - sz.gal / 7.48052 * (40 / 14.7) / 30) < 1e-9, sz.min.toFixed(2) + ' / ' + sz.margin.toFixed(2));
    const Z = DI.buildScenario(c5); DI.botBuild(Z.S, 'c5'); const comp = Z.W.byType('comp')[0], air = () => DI.review(Z.S).filter((q) => q.text.includes('air supply'));
    comp.p.scfm = 5; const w5 = air(); comp.p.scfm = 7; const w7 = air(); comp.p.scfm = 10; const w10 = air();
    ok('A47 review warns once at 5 scfm (below the minimum) and at 7 scfm (below the margin), and not at 10 scfm; it is a warning, never a fail', w5.length === 1 && w5[0].sev === 'warn' && w5[0].text.includes('air supply 5.0 scfm (compressor #' + comp.id + ') is below the 6.4 scfm minimum to bring the largest zone they serve (this one, 525 gal) to normal pressure in 30 min.') && w5[0].ref === 'NFPA 13-2025 §8.2.7.3 (one source serving several systems is sized on the largest)' &&
      w7.length === 1 && w7[0].sev === 'warn' && w7[0].text.includes('meets the 6.4 scfm minimum') && w7[0].text.includes('below the x1.25 margin (8.0 scfm, ASSUMED)') && w10.length === 0 && !DI.review(Z.S).some((q) => q.sev === 'fail'), (w5[0] || {}).text);
    ok('A47 the warning text stays clear of the words the existing goals match on', [w5[0].text, w7[0].text].every((t) => !/ockey|util|start within 10 psi/.test(t)));
    const one = rig({ scfm: 1 }), o1 = DI.review(one.S).filter((q) => q.text.includes('air supply')), ok5 = DI.review(rig().S).filter((q) => q.text.includes('air supply'));
    ok('A47 a zone on its own compressor is sized on itself', o1.length === 1 && o1[0].text.includes('to bring this zone (') && o1[0].ref === 'NFPA 13-2025 §8.2.7.3' && ok5.length === 0 && DI.airSizing(one.S, one.v.id).shared === 0 && DI.airSizing(one.S, one.pn.id) === null);
    const refs = []; for (const sc of DI.SCEN) { if (!DI.BOT[sc.id]) continue; const q = DI.buildScenario(sc); DI.botBuild(q.S, sc.id); const rv = DI.review(q.S); if (rv.some((x) => x.text.includes('air supply')) || rv.some((x) => x.sev === 'fail')) refs.push(sc.id); }
    ok('A47 no reference build of the campaign gains a sizing warning or a review fail', refs.length === 0, refs.join() || undefined);
    DI.setJuris(new DI.World(4, 4));
  }
  // A48 the reopen gate refuses only in the scored incident of a running drill; anywhere else it warns, opens and logs what is still open
  {
    // drill: a running drill is on when the head is broken, so this incident is the scored one
    const tripped = (o, drill) => { const r = rig(Object.assign({ gate: true }, o)); if (drill) r.S.drill = { t0: r.S.t, done: false }; DI.breakSprinkler(r.S, r.head); run(r.S, 60, 0.25); smoke(r.S, 0.2, 10); r.S.smoke[1] = 0; run(r.S, 30, 0.25); DI.silence(r.S, r.pn.id); DI.findHead(r.S, r.head); R.shut(r); return r; };
    const refused = (r, want) => { const n = r.S.acts.length, m = DI.setGate(r.S, r.g.id, 1); run(r.S, 6, 0.25); return m === want && r.g.p.target === 0 && r.g.p.open < 0.02 && !r.S.acts.slice(n).some((a) => a.kind === 'open-valve' || a.kind === 'reopen-warn'); };
    for (const trim of ['el-pn', 'el-el']) {
      const r = tripped({ props: { trim } }, true), T = trim === 'el-pn' ? 'El/Pn' : 'El/El';
      ok('A48 ' + T + ' drill (i) D still latched: refused, the valve stays shut, nothing logged', DI.drillIncidentOpen(r.S, r.v.id, r.g.id) && refused(r, 'Reset the panel first: D / the solenoid is still latched.'));
      R.iso(r, 1); R.drain(r, 1); R.zero(r); DI.panelReset(r.S, r.pn.id); run(r.S, 1, 0.25);
      ok('A48 ' + T + ' drill (ii) riser not reset: refused', refused(r, 'Reset the riser valve first: it is still tripped.'));
      DI.replaceSprinklers(r.S, r.v.id); run(r.S, 1, 0.25); DI.resetValve(r.S, r.v.id); run(r.S, 1, 0.25); R.drain(r, 0);
      ok('A48 ' + T + ' drill (iii) riser reset, air below low air: refused', refused(r, 'Restore air first: ' + DI.fmt(r.s.P, 1) + ' psi is below low air (30 psi).') && r.s.P < r.v.p.loAir);
      R.iso(r, 0); R.air(r);
      ok('A48 ' + T + ' drill (iv) air back, P still latched: refused', r.s.P >= r.v.p.loAir && r.v.p.pLatch === true && refused(r, trim === 'el-pn' ? 'Reset the actuator at the trim: P is still latched.' : 'Reset the panel: P is still latched.'));
      if (trim === 'el-pn') { DI.resetTrimP(r.S, r.v.id); run(r.S, 1, 0.25); } DI.panelReset(r.S, r.pn.id); run(r.S, 2, 0.25);
      const m = DI.setGate(r.S, r.g.id, 1); run(r.S, 6, 0.25); const sc = R.score(r);
      ok('A48 ' + T + ' drill: it opens only with the solenoid de-energized, the valve reset, P clear and the air above low air, with no warning', m === '' && r.g.p.open > 0.99 && !r.v.p.solOut && !r.v.p.pLatch && r.s.state === 'dry' && r.s.P >= r.v.p.loAir && DI.reopenGate(r.S, r.g.id) === '' && r.S.acts.filter((a) => a.kind === 'open-valve' && a.id === r.g.id).length === 1 && !r.S.acts.some((a) => a.kind === 'reopen-warn') && R.step(r, 'open-valve').done && sc.complete, R.show(sc));
      ok('A48 ' + T + ' drill: once the incident’s open-valve is logged nothing is refused, even on a zone made unready again', !DI.drillIncidentOpen(r.S, r.v.id, r.g.id) && (R.shut(r), r.v.p.pLatch = true, DI.setGate(r.S, r.g.id, 1)) === '' && r.g.p.target === 1);
    }
    // the same unready zone outside a drill: it opens, with the warning and the items
    const p = tripped({}, false), n0 = p.S.acts.length, l0 = p.S.log.length, chk = DI.reopenCheck(p.S, p.g.id), mp = DI.setGate(p.S, p.g.id, 1), wa = p.S.acts.slice(n0).find((a) => a.kind === 'reopen-warn'), nm = DI.sysName(p.S, p.v.id);
    ok('A48 outside a drill an unready zone is not refused: the control valve opens, a warning is logged and a reopen-warn entry carries the items', !DI.drillIncidentOpen(p.S, p.v.id, p.g.id) && chk.refuse === false && chk.msg === 'Reset the panel first: D / the solenoid is still latched.' && mp === '' && p.g.p.target === 1 && !!wa && wa.id === p.g.id && wa.items.join('|') === chk.items.join('|') && p.S.log.slice(l0).some((l) => l.cls === 'bad' && l.text === DI.reopenWarn(p.g.id, chk.items) && l.text.startsWith('Control valve #' + p.g.id + ' reopened with items still open: head not replaced in ' + nm)));
    ok('A48 the items name the zone: the head, D, the tripped riser valve and P', chk.items.join('|') === ['head not replaced in ' + nm, 'D / the solenoid is still latched on ' + nm + ' (panel not reset)', 'the riser valve of ' + nm + ' is still tripped', 'P is still latched on ' + nm].join('|'), chk.items.join(' | '));
    const q = rig({ gate: true }); R.shut(q); q.v.p.airValve = 0; q.v.p.sdrain = 1; q.S.touch(); run(q.S, 20, 0.25); const qi = DI.openItems(q.S, q.v.id).join('|'), qn = DI.sysName(q.S, q.v.id);
    ok('A48 the other items: low air with the reading, the open drain, the isolated supply; a dead panel is listed and never refuses', qi === ['air in ' + qn + ' is ' + DI.fmt(q.s.P, 1) + ' psi, below low air (30 psi)', 'P is still latched on ' + qn, 'the drain of ' + qn + ' is still open', 'the air / N2 supply to ' + qn + ' is still isolated'].join('|') && (q.W.power = false, q.pn.p.battH = 0, run(q.S, 1, 0.25), DI.openItems(q.S, q.v.id)).includes('the releasing panel of ' + qn + ' is dead') && DI.openItems(q.S, q.pn.id).length === 0, qi);
    // a trip test that was never closed out, then a drill on another incident: the old test does not block anything
    const t = rig({ gate: true }); DI.startTest(t.S, 'trip', t.v.id); t.S.warp(420); R.shut(t);
    ok('A48 a trip test that was never closed out does not block a later reopen on the unready zone (it warns)', DI.lastResult(t.S, 'trip', t.v.id) !== null && t.s.state !== 'dry' && !DI.drillIncidentOpen(t.S, t.v.id, t.g.id) && DI.setGate(t.S, t.g.id, 1) === '' && t.S.acts.some((a) => a.kind === 'reopen-warn'));
    const e = tripped({}, false); e.S.drill = { t0: e.S.t, done: false };
    ok('A48 an incident from before the drill is not the scored one: not refused', !DI.drillIncidentOpen(e.S, e.v.id, e.g.id) && DI.setGate(e.S, e.g.id, 1) === '');
    const d = tripped({}, true); d.S.drill.done = true;
    ok('A48 after the drill ends nothing is refused', !DI.drillIncidentOpen(d.S, d.v.id, d.g.id) && DI.setGate(d.S, d.g.id, 1) === '' && d.S.acts.some((a) => a.kind === 'reopen-warn'));
    const c = tripped({ props: { trim: 'el-pn' } }, false); R.drain(c, 1); let n = 0; while (c.s.wat > 0 && n++ < 20000) c.S.step(0.25); const w0 = c.s.wat; R.drain(c, 0);
    DI.setGate(c.S, c.g.id, 1); run(c.S, 30, 0.25);
    ok('A48 the consequence is physical: reopened at stage (i) with D and P both true, water goes straight back through the tripped valve', w0 === 0 && c.v.p.sol === true && c.v.p.pLatch === true && c.s.state !== 'dry' && c.S.stats.gallons > 0 && c.s.flow > 1, 'flow ' + c.s.flow.toFixed(0) + ' gpm');
    const h = rig({ gate: true }); R.shut(h); const l1 = h.S.log.length, mh = R.reopen(h);
    ok('A48 a healthy zone reopens with no warning and no entry', mh === '' && h.g.p.open > 0.99 && !h.S.log.slice(l1).some((l) => l.cls === 'bad') && !h.S.acts.some((a) => a.kind === 'reopen-warn') && DI.reopenCheck(h.S, h.g.id).items.length === 0);
    const w = new DI.World(40, 14); w.addRoom('office', 20, 2, 12, 8); w.addPart('city', 1, 6, 0); hline(w, 2, 9, 6, 6); const wg = w.addPart('gate', 10, 6, 0); hline(w, 11, 13, 6, 6); w.addPart('wetv', 14, 6, 0); hline(w, 15, 19, 6, 6); for (let y = 2; y <= 9; y++) w.setPipe(20, y, 4, 0, true); grid(w, 21, 2, 31, 9);
    const wS = new DI.Sim(w); wS.commission(); DI.breakSprinkler(wS, w.k(28, 5)); run(wS, 10, 0.25); DI.setGate(wS, wg.id, 0); run(wS, 6, 0.25);
    ok('A48 a zone with no dry or preaction valve behind the control valve is not gated', DI.gateValves(wS, wg.id).length === 0 && DI.setGate(wS, wg.id, 1) === '' && wg.p.target === 1);
    const dp = tripped({}, true); R.iso(dp, 1); R.drain(dp, 1); R.zero(dp); DI.panelReset(dp.S, dp.pn.id); run(dp.S, 1, 0.25); DI.replaceSprinklers(dp.S, dp.v.id); run(dp.S, 1, 0.25); DI.resetValve(dp.S, dp.v.id); run(dp.S, 1, 0.25); R.drain(dp, 0); R.iso(dp, 0); R.air(dp);
    dp.W.power = false; dp.pn.p.battH = 0; run(dp.S, 1, 0.25); const l2 = dp.S.log.length, md = R.reopen(dp);
    ok('A48 a dead panel cannot release anything: a warning even in the drill, never a refusal; the panel steps do not apply and the recovery completes', md === '' && dp.g.p.open > 0.99 && dp.S.log.slice(l2).some((l) => l.cls === 'bad' && l.text.includes('the releasing panel of ' + DI.sysName(dp.S, dp.v.id) + ' is dead')) && R.score(dp).complete);
    ok('A48 DI.incidentOpen no longer exists', typeof DI.incidentOpen === 'undefined' && typeof DI.drillIncidentOpen === 'function');
  }
  // A49 "air supply isolated" is an impairment tag, not a signal; low air stays a pressure signal
  {
    const d = dryRig(), keys = (S) => [...S.sig.keys()].sort().join();
    const k0 = keys(d.S), i0 = DI.impairments(d.S).length; d.v.p.airValve = 0; run(d.S, 60, 0.25); const imp = DI.impairments(d.S);
    ok('A49 shutting the supply on a healthy dry zone: one impairment entry, no LOW AIR, and the signal list is unchanged', i0 === 0 && imp.length === 1 && imp[0].key === 'air-isolated:' + d.v.id && imp[0].id === d.v.id && imp[0].text === 'IMPAIRMENT - Air / N2 supply isolated: ' + DI.sysName(d.S, d.v.id) + '. The zone cannot hold or refill air. Restore the supply.' && !d.S.sig.has('la' + d.v.id) && keys(d.S) === k0 && d.s.P > 39);
    d.s.holes = 400; let n = 0; while (!d.S.sig.has('la' + d.v.id) && n++ < 4000) d.S.step(1);
    ok('A49 low air comes from the gauge: it is raised only once the pressure has actually fallen below the low-air setpoint', d.S.sig.has('la' + d.v.id) && d.S.sig.get('la' + d.v.id).type === 'SUPV' && d.s.P < d.v.p.loAir && d.s.state === 'dry' && DI.impairments(d.S).length === 1 && !/airValve/.test(DI.gasPre.toString().split('s.lowAir =')[1].split(';')[0]));
    const p = rig(); p.v.p.airValve = 0; run(p.S, 5, 0.25); const noLa = !p.S.sig.has('la' + p.v.id) && DI.impairments(p.S).length === 1; p.v.p.sdrain = 1; p.S.touch(); run(p.S, 10, 0.25);
    ok('A49 preaction: the supply shut raises the tag and no LOW AIR; opening the system drain then raises LOW AIR as the gauge falls', noLa && p.S.sig.has('la' + p.v.id) && p.s.P < p.v.p.loAir && DI.impairments(p.S).length === 1);
    ok('A49 it is not a signal: nothing in S.sig, nothing transmitted, and R09 and R11 of the truth table (which shut the supply to make low air) still match', ![...d.S.sig.values()].some((o) => /IMPAIRMENT/.test(o.text)) && !/S\.sig|sig\.set|add\(/.test(DI.impairments.toString()) && ttRow('R09').ok && ttRow('R11').ok && ttRow('R09').got.SS_Supervisory === '1' && ttRow('R09').got.SS_Trouble === '0');
    const t = rig(); DI.startTest(t.S, 'leak', t.v.id); run(t.S, 10, 0.25); const during = t.v.p.airValve === 0 && t.S.procs.length === 1 && DI.impairments(t.S).length === 0;
    t.S.warp(86500); const after = t.S.procs.length === 0 && t.v.p.airValve === 1 && DI.impairments(t.S).length === 0; t.v.p.airValve = 0; run(t.S, 1, 0.25);
    ok('A49 a 24 h air test isolates the supply on purpose and raises no tag; a supply left shut after the test is tagged', during && after && DI.impairments(t.S).length === 1);
    d.W.power = false; d.pn.p.battH = 0; run(d.S, 2, 0.25); const dead = d.pn.p.alive === false && DI.impairments(d.S).length === 1; d.v.p.airValve = 1; run(d.S, 1, 0.25);
    ok('A49 the tag survives a dead panel (it is a riser tag, not a panel display) and clears when the supply is restored', dead && DI.impairments(d.S).length === 0);
    const none = new DI.World(40, 14); none.addRoom('hall', 20, 1, 12, 9); none.addPart('city', 1, 6, 0); hline(none, 2, 13, 6, 6); const nv = none.addPart('prev', 14, 6, 0, { airValve: 0 }); hline(none, 15, 19, 6, 6); none.setPipe(20, 6, 4, 0, true); const nS = new DI.Sim(none);
    ok('A49 a zone with no air source has nothing to isolate: no tag', nS.sysd.info.get(nv.id).src.length === 0 && DI.impairments(nS).length === 0);
  }
  // A50 edition keys and the VEA record
  {
    const J = DI.JURIS, r = (ed) => J[ed].ref, AV = ' (ASSUMED, VERIFY)';
    ok('A50 the air-test section is verified in all three editions: 2019 §28.2.2.1, 2022 and 2025 §29.2.2.1, with no mark', r('US-2019').airTest === 'NFPA 13-2019 §28.2.2.1' && r('US-2022').airTest === 'NFPA 13-2022 §29.2.2.1' && r('US-2025').airTest === 'NFPA 13-2025 §29.2.2.1' && !J['US-2019'].delta.join(' ').includes('has not been checked') && !/ASSUMED|VERIFY/.test(J['US-2019'].delta.join(' ')));
    ok('A50 2022 delivery: table, manifold, di and diQod are verified; timedTest, noQod, qod, calc and otherTimes stay marked', ['table', 'manifold', 'di', 'diQod'].every((k) => !/ASSUMED|VERIFY/.test(r('US-2022')[k])) && ['timedTest', 'noQod', 'qod', 'calc', 'otherTimes'].every((k) => r('US-2022')[k].endsWith(AV)) && r('US-2019').calc.endsWith('(VERIFY)') && J['US-2022'].delta[0].includes('Verified for 2022: Table 8.2.3.6.1, §8.2.3.7, §8.3.2.3.1.1 to .4, §8.3.2.3.2 and the air test §29.2.2.1.') && J['US-2022'].delta[0].includes('§8.2.3.8'));
    ok('A50 the refill limit is keyed by edition, and the N2-only key is absent for 2025', r('US-2019').refill === 'NFPA 13-2019 §8.2.6.3.2' && r('US-2022').refill === 'NFPA 13-2022 §8.2.6.3.2' && r('US-2025').refill === 'NFPA 13-2025 §8.2.7.3' && r('US-2019').refillN2 === 'NFPA 13-2019 §8.2.6.8.4' && r('US-2022').refillN2 === 'NFPA 13-2022 §8.2.6.8.4' && !('refillN2' in r('US-2025')));
    const t = (ed) => J[ed].ref72;
    ok('A50 NFPA 72 timing references follow the site edition (ASSUMED pairing): IP path, multiple paths, DACT, AC delay, panel trouble, low battery', J['US-2019'].nfpa72 === 2019 && J['US-2022'].nfpa72 === 2022 && J['US-2025'].nfpa72 === 2025 && t('US-2019').commIp === 'NFPA 72-2019 §26.6.3.3(2)' && t('US-2022').commIp === 'NFPA 72-2022 §26.6.3.3(2)' && t('US-2025').commIp === 'NFPA 72-2025 §26.6.3.3.2(2) (annunciated per §10.15)' &&
      t('US-2019').commMulti === 'NFPA 72-2019 §26.6.3.4(2)' && t('US-2025').commMulti === 'NFPA 72-2025 §26.6.3.4(1) (6 h supervision interval; annunciation time not found in 2025, VERIFY)' && t('US-2019').commDact.startsWith('NFPA 72-2019 §26.6.4.1.5(6), §26.6.4.2.2(H)') && t('US-2022').commDact.startsWith('NFPA 72-2022 §26.6.4.2.5(6), §26.6.4.3.2.8') && t('US-2025').commDact.endsWith('ASSUMED, VERIFY)') &&
      ['US-2019', 'US-2022', 'US-2025'].every((ed) => t(ed).acDelay === 'NFPA 72-' + J[ed].nfpa72 + ' §10.6.9.3' && t(ed).trouble === 'NFPA 72-' + J[ed].nfpa72 + ' §10.15.1' && t(ed).lowBatt.startsWith('no low-battery threshold held (') && t(ed).lowBatt.includes('§10.6.9.1, §10.6.10.6')));
    const V = DI.ASD_RECORDED.VEA;
    ok('A50 VEA is recorded, not modelled: 1.23 %/ft from Xtralis Doc. 36348_03 is primary, the Gamewell 1.3 an OEM variant', !('VEA' in DI.ASD_MODELS) && Object.keys(DI.ASD_MODELS).join() === 'VEP,VEU' && V.primary === 1.23 && V.oem === 1.3 && V.fire1.join() === '0.5,1.23,2.5' && V.note.includes('Enhanced Fire 1 = 1.23 %/ft (Xtralis Doc. 36348_03, primary)') && V.note.includes('The Gamewell sheet prints 1.3, an OEM variant') && DI.ASD_SRC === '[HB, datasheet; UL Product iQ not checked]' && DI.asdModel({ cfg: { asdModel: 'VEA' } }) === 'VEP');
  }
  // A51 after the 24 h air test: return to normal pressure, only where the normal is below the test pressure
  {
    const low = rig({ props: { airSet: 30, loAir: 25, hiAir: 35 } }), id = low.v.id;
    DI.startTest(low.S, 'leak', id); low.S.warp(86500 + DI.AIR_TEST.chargeMax); const res = DI.lastResult(low.S, 'leak', id);
    ok('A51 normal 30 psi: after the test the pipe is left near 39 psi, the step is pending and HIGH AIR shows above the high-air setpoint', !!res && res.pass && low.s.ret === true && low.s.P > 38 && low.v.p.airValve === 1 && low.S.sig.has('ha' + id) && !low.S.acts.some((a) => a.kind === 'return-normal') && res.lines.length === 4);
    low.v.p.sdrain = 1; low.S.touch(); let n = 0; while (low.s.P > 30.5 && n++ < 2000) low.S.step(0.02); const bled = low.s.P;
    const open = low.s.ret === true && !low.S.acts.some((a) => a.kind === 'return-normal'); low.v.p.sdrain = 0; low.S.touch(); run(low.S, 2, 0.25);
    ok('A51 bleeding at the system drain brings the gauge down; closed with the supply open and the pipe above low air, return-normal is logged once and the step clears', bled <= 30.5 && bled >= 25 && open && low.s.ret === false && low.S.acts.filter((a) => a.kind === 'return-normal' && a.id === id).length === 1 && low.v.p.pLatch === false && low.s.P >= low.v.p.loAir && !low.S.sig.has('ha' + id), 'closed at ' + bled.toFixed(1) + ' psi');
    const b = rig({ props: { airSet: 30, loAir: 25, hiAir: 35 } }); DI.startTest(b.S, 'leak', b.v.id); b.S.warp(86500 + DI.AIR_TEST.chargeMax); const m = DI.bleedToNormal(b.S, b.v.id); run(b.S, 1, 0.25);
    ok('A51 the bleed at the trim does the same in one step, and is refused when there is nothing to bleed', m === '' && Math.abs(b.s.P - 30) < 0.5 && b.s.ret === false && b.S.acts.some((a) => a.kind === 'return-normal') && DI.bleedToNormal(b.S, b.v.id) === 'The pipe is already at or below normal pressure.');
    const d = JSON.parse(JSON.stringify(low.S.dump())); ok('A51 the pending step is saved with the game', DI.SS_KEYS.includes('ret') && DI.SS_KEYS.includes('rfill') && 'ret' in d.ss[0][1]);
    const n40 = rig(); DI.startTest(n40.S, 'leak', n40.v.id); n40.S.warp(86500); const r40 = DI.lastResult(n40.S, 'leak', n40.v.id);
    const n50 = rig({ props: { airSet: 50, loAir: 40, hiAir: 60 } }), m50 = DI.startTest(n50.S, 'leak', n50.v.id); n50.S.warp(600);
    ok('A51 normal 40 psi: no step, no act, no extra report line; normal 50 psi: the test is refused, so there is nothing to return from', r40.pass && !n40.s.ret && !n40.S.acts.some((a) => a.kind === 'return-normal') && r40.lines.length === 4 && m50.startsWith('Test pressure is 40 psi.') && !n50.s.ret && !n50.S.acts.some((a) => a.kind === 'return-normal'));
    ok('A51 practice only: no goal and no score reads it', DI.SCEN.every((sc) => sc.goals.every((q) => !/return-normal|\.ret\b/.test(q.ok.toString()))) && !/return-normal/.test(DI.recoveryScore.toString()));
  }
  // A52 supervising-station timing: path delay, AC-fail delay, panel trouble ceiling, low battery as a listed setpoint
  {
    const W0 = new DI.World(4, 4), cp = (x) => { W0.cfg.commPath = x; return DI.commPath(W0) + ':' + DI.commDelay(W0); }, ad = (x) => { W0.cfg.acDelayMin = x; return DI.acDelay(W0); };
    ok('A52 the path defaults to a single IP path (60 min); multiple paths and DACT are 6 h; an unknown value reads ip', DI.commPath(new DI.World(4, 4)) === 'ip' && DI.commDelay(new DI.World(4, 4)) === 3600 && cp('ip') === 'ip:3600' && cp('multi') === 'multi:21600' && cp('dact') === 'dact:21600' && cp('rf') === 'ip:3600' && cp('toString') === 'ip:3600' && Object.keys(DI.COMM_PATH).join() === 'ip,multi,dact');
    ok('A52 the AC-fail delay defaults to 60 min; 90 gives 5,400 s; a value outside 60 to 180 reads 60 min', DI.acDelay(new DI.World(4, 4)) === 3600 && ad(90) === 5400 && ad(180) === 10800 && ad(30) === 3600 && ad(200) === 3600 && ad('90') === 3600 && DI.AC_DELAY_MIN.join() === '60,90,120,150,180' && DI.TROUBLE_PANEL_S === 200);
    let paths = true; const note = [];
    for (const [k, d] of [['ip', 3600], ['multi', 21600], ['dact', 21600]]) {
      const r = rig(); r.W.cfg.commPath = k; r.W.power = false; r.pn.p.battH = 0; r.S.step(1); const t0 = r.pn.p.deadT, key = 'pd' + r.pn.id;
      const dark = r.pn.p.alive === false && !r.S.sig.has(key); r.S.warp(d - 100); while (r.S.t < t0 + d - 1) r.S.step(1); const before = !r.S.sig.has(key) && r.S.t === t0 + d - 1; r.S.step(1); const o = r.S.sig.get(key);
      const good = dark && before && !!o && o.lost && o.mon && o.tx && o.type === 'TRBL' && o.t0 === t0 + d && o.text === 'LOSS OF COMMUNICATION - panel #' + r.pn.id + ' (no signal, supervising station reports trouble)'; paths = paths && good; note.push(k + (good ? ' ok' : ' BAD'));
    }
    ok('A52 a dead panel: the station line is absent for the delay less 1 s and present at the delay (3,600 s on IP, 21,600 s on multiple paths and DACT), with its text unchanged', paths, note.join(', '));
    const b = rig(); b.W.power = false; b.pn.p.battH = 0; b.S.step(1); b.S.warp(3000); b.W.power = true; run(b.S, 5, 1); const back = b.pn.p.alive === true && b.pn.p.deadT === undefined; b.S.warp(7200);
    ok('A52 power back before the delay: the loss of communication never appears', back && !b.S.sig.has('pd' + b.pn.id) && !b.S.log.some((l) => l.text.includes('LOSS OF COMMUNICATION')));
    const a = rig(); run(a.S, 10, 1); const tOff = a.S.t; a.W.power = false; a.S.step(1); const ac = () => a.S.sig.get('ac' + a.pn.id), a0 = ac(), at = a0 && a0.t0;
    const once = !!a0 && a0.type === 'TRBL' && a0.mon && !a0.dark && a0.tx === false && a0.delay === 3600 && at - tOff <= DI.TROUBLE_PANEL_S && at - tOff === 1;
    a.S.warp(3400); while (a.S.t < at + 3599) a.S.step(1); const held = ac().tx === false && !a.S.log.some((l) => l.text.startsWith('Supervising station notified')); a.S.step(1);
    ok('A52 AC failure: at the panel at once (inside the 200 s ceiling), not transmitted until the 60 min delay has run, then the station is notified once', once && held && ac().tx === true && ac().t0 === at && a.S.log.filter((l) => l.text.startsWith('Supervising station notified: PANEL AC FAIL')).length === 1 && (run(a.S, 5, 1), a.S.log.filter((l) => l.text.startsWith('Supervising station notified')).length === 1));
    const a9 = rig(); a9.W.cfg.acDelayMin = 90; a9.W.power = false; a9.S.step(1); a9.S.warp(3700); const not60 = a9.S.sig.get('ac' + a9.pn.id).tx === false && a9.S.sig.get('ac' + a9.pn.id).delay === 5400; a9.S.warp(1800);
    const rs = rig(); rs.W.power = false; rs.S.step(1); rs.S.warp(3000); rs.W.power = true; run(rs.S, 5, 1); rs.W.power = false; rs.S.step(1); rs.S.warp(3000);
    ok('A52 a 90 min setting holds it for 5,400 s; power restored inside the delay: nothing is transmitted, and a new failure starts a new delay', not60 && a9.S.sig.get('ac' + a9.pn.id).tx === true && rs.S.sig.get('ac' + rs.pn.id).tx === false && !rs.S.log.some((l) => l.text.startsWith('Supervising station notified')));
    const l = rig(); l.W.power = false; l.S.warp(21.9 * 3600); const noLb = !l.S.sig.has('lb' + l.pn.id); l.S.warp(0.2 * 3600); const lb = l.S.sig.get('lb' + l.pn.id), lbT = lb && lb.text; l.W.power = true; run(l.S, 2, 1);
    ok('A52 LOW BATTERY comes in at 1/12 of capacity left (about 22 h into 24 h), transmitted at once; it is a listed setpoint, not a code threshold, and no text says "2 h"', noLb && !!lb && lb.type === 'TRBL' && lb.delay === 0 && lb.tx === true && lbT === 'LOW BATTERY - panel #' + l.pn.id + ' (battery below its listed low-voltage setpoint)' && l.S.sig.get('lb' + l.pn.id).text === lbT + ' (charging)' && DI.lowBattH() === 2 && DI.PANEL_LOWBATT_FRAC === 1 / 12 && typeof DI.PANEL_LOWBATT_H === 'undefined' &&
      /listed manufacturer low-battery voltage setpoint.*ASSUMED, NEEDS PE REVIEW/.test(DI.LOWBATT_NOTE) && !/\b2 h\b/.test(lbT + DI.LOWBATT_NOTE));
    const m = rig(), cell = (key, i) => DI.ceMatrix(m.S, m.v.id).rows.find((q) => q.key === key).cells[i];
    const ac25 = cell('acFail', 4), lc25 = cell('lostComm', 4), an = cell('acFail', 3); m.W.cfg.edition = 'US-2019'; m.W.cfg.acDelayMin = 120; const ac19 = cell('acFail', 4), lc19 = cell('lostComm', 4);
    m.W.cfg.edition = 'US-2025'; m.W.cfg.commPath = 'multi'; const mu = cell('lostComm', 4), rel = cell('fire1+p, panel dead', 4);
    ok('A52 the matrix shows the live delays with the citation of the edition: AC failure 60 or 120 min (§10.6.9.3), loss of communication 60 min on IP (2019 §26.6.3.3(2), 2025 §26.6.3.3.2(2)), 6 h on multiple paths with the 2025 not-found note', ac25 === 'TRBL after 60 min (OWNER/AHJ, 60 to 180; NFPA 72-2025 §10.6.9.3)' && lc25 === 'supervising station annunciates after 60 min (IP path; NFPA 72-2025 §26.6.3.3.2(2) (annunciated per §10.15))' && an === 'zone-identified display + audible at the panel within 200 s (shown at once here)' &&
      ac19 === 'TRBL after 120 min (OWNER/AHJ, 60 to 180; NFPA 72-2019 §10.6.9.3)' && lc19 === 'supervising station annunciates after 60 min (IP path; NFPA 72-2019 §26.6.3.3(2))' && mu.startsWith('supervising station annunciates after 6 h (multiple paths; NFPA 72-2025 §26.6.3.4(1)') && mu.includes('annunciation time not found in 2025, VERIFY') && rel.startsWith('not transmitted: dark; loss of communication: supervising station annunciates after 6 h'), ac25 + ' | ' + lc25);
    DI.setJuris(new DI.World(4, 4));
  }
  // A53 the truth table through the time-skip: the fixture is untouched, and the two non-AC rows show the delay
  {
    const r12 = ttRow('R12'), r13 = ttRow('R13');
    ok('A53 17 of 17 still match and the fixture is still the pinned file', resTT.length === 17 && resTT.every((q) => q.ok) && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && TT.FIXTURE_SHA16 === 'cb3462b268359c6e');
    ok('A53 R12 (battery): SS_Trouble reads 0 at 60 s and 1 after the skip, and the trouble that arrives is the AC failure', r12.pre.SS_Trouble === '0' && r12.got.SS_Trouble === '1' && r12.want.SS_Trouble === '1' && r12.skipped === 3660 && r12.sigs.some((q) => q.key.startsWith('ac') && q.mon && q.tx) && r12.pre.trouble.length === 0);
    ok('A53 R13 (dead panel): SS_Trouble reads 0 at 60 s and 1 after the skip, through the station’s own loss-of-communication line', r13.pre.SS_Trouble === '0' && r13.got.SS_Trouble === '1' && r13.want.SS_Trouble === '1' && r13.sigs.some((q) => q.key.startsWith('pd') && q.lost && q.tx) && r13.sigs.filter((q) => q.mon).length === 1);
    ok('A53 no other row is skipped or changed: on AC the station reading at 60 s is the row', resTT.filter((q) => q.skipped).map((q) => q.row).join() === 'R12,R13' && resTT.filter((q) => !q.skipped).every((q) => q.got.SS_Trouble === q.pre.SS_Trouble && q.got.SS_Trouble === '0'));
    ok('A53 the runner keeps the panel-power input clean: its compressor has a generator-backed feed, so no supply-air trouble rides on the battery row', !r12.sigs.some((q) => q.key.startsWith('sa')) && /emerg: true/.test(TT.runRow.toString()));
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
    // Cycle 3
    const man = DI.MANUAL ? '' : fs.readFileSync(path.join(dir, 'manual.js'), 'utf8'), claude = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
    none('assumed window or placeholder for the aspirating detector in src', src, /assumed: true|ASSUMED placeholder|placeholder until the maker|0\.01 to 5\.0/);
    none('placeholder window for the aspirating detector in README', readme, /ASSUMED placeholder|0\.01 to 5\.0|placeholder for the maker/);
    none('NFPA 76 stage election, OPEN / CONFLICT flags or a preset that writes, anywhere in src', src, /n76AlarmStage|n76Stage|N76_STAGE_OPEN|N76_BOUND_CONFLICT|N76_STAGE_OVER|applyDetPreset|n76s/);
    ok('static: NFPA 76 is two ceilings and nothing else', JSON.stringify(DI.PRESETS.nfpa76) === '{"alert":0.2,"alarm":1}' && typeof DI.applyDetPreset === 'undefined' && typeof DI.n76Stage === 'undefined' && !/cfg\.detThr\s*=|W\.ver/.test(DI.n76Check.toString()));
    // "flood" is right only where a head or a pipe is open: allowed for a pipe break (it discharges) and in the comments about the graph flood-fill
    const floods = src.split('\n').filter((l) => /flood/i.test(l)).map((l) => l.match(/[^.>]*flood[^.<]*/i)[0].trim());
    ok('static: no user-visible text says a closed-head trip floods anything', floods.every((t) => /^\/\/ (Flood-fills|air \/ nitrogen tubing: flood each)/.test(t) || /A pipe break plus a detection event floods the room/.test(t)) && floods.length === 3 && !/flood/i.test(claude) && !/floods the hall/.test(readme), floods.join(' | '));
    ok('static: manual and README carry the datasheet numbers and the source label', man.includes('DI.MAN.asd') && readme.includes('36106_07') && readme.includes('36107_05') && readme.includes('[HB, datasheet; UL Product iQ not checked]'));
    ok('static: CLAUDE.md states the fixture rule', /copied verbatim from the Lead who owns them and are never edited or reformatted here/.test(claude.replace(/\s+/g, ' ')) && claude.replace(/\s+/g, ' ').includes('stop and ask: do not change the file'));
    ok('static: a dead-panel path never writes sol, pull, mech or mrzL true', !/alive[^;]*\{[^}]*(sol|pull|mech|mrzL) = true/.test(DI.alarmStep.toString()) && /v\.p\.sol = false; v\.p\.pull = false; v\.p\.mrzL = false/.test(DI.alarmStep.toString()));
    ok('static: the riser reset no longer shuts the drain', !/sdrain\s*=/.test(DI.resetValve.toString()));
    ok('static: the riser reset never writes pLatch', !/pLatch\s*=/.test(DI.resetValve.toString()) && /mech = false/.test(DI.resetValve.toString()));
    ok('static: pLatch is cleared only by the panel reset (El/El), the trim reset (El/Pn), a dead El/El panel (the latch lives in panel memory), commissioning and save migration', (src.match(/pLatch = false/g) || []).length === 5 && /dark\) \{ v\.p\.pLatch = false/.test(DI.gasPre.toString()) && /trim === 'el-el'\) d\.p\.pLatch = false/.test(DI.panelReset.toString()) && /pLatch = false/.test(DI.resetTrimP.toString()));
    ok('static: supervisory is not an allowed class for a latched P', !DI.SIG_CLASS.pLatch.includes('SUPV') && DI.SIG_DEFAULT.pLatch === 'OPEN');
  }
}
console.log(fail ? fail + ' FAILED' : 'all sim tests passed'); process.exit(fail ? 1 : 0);
