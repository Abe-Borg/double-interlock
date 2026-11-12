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
  // Cycle 8: NFPA 76 applies by room. tel(r) makes the rig's one room a Telecom / MMR room (the detector sits in it).
  const TEL = 'MMR 1', tel = (r) => { const room = r.W.rooms[0]; room.type = 'tel'; room.name = TEL; r.W.ver++; return room; };
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
    const noRoom = 'NFPA 76 check: no NFPA 76 room: NFPA 76 applies by room, in a Telecom / MMR room that holds an aspirating detector, and this site has none.';
    ok('A14 the NFPA 76 check says so where there is no NFPA 76 room', DI.n76Check(r.W) === noRoom && DI.detThr(r.W)[0] === 0.03 && DI.juris.nfpa76Adopted === false);
    r.W.cfg.nfpa76Adopted = true; const hallChk = DI.n76Check(r.W); tel(r); const before = JSON.stringify(r.W.cfg), chk = DI.n76Check(r.W);
    ok('A14 the site flag alone checks nothing in a hall: the detector has to sit in a telecom room', hallChk === noRoom);
    ok('A14 adopted, telecom room: the check reads Alert and Fire 1 against the two ceilings and changes no setting', chk === 'NFPA 76 check, ' + TEL + ': Alert 0.03 (meets 0.2: yes), Fire 1 0.12 (meets 1.0: yes).' && JSON.stringify(r.W.cfg) === before && DI.detThr(r.W).join() === '0.03,0.06,0.12,1.2', chk);
    r.W.cfg.detThr = [0.3, 0.4, 0.5, 1.2];
    ok('A14 the check reports a ceiling that is not met, and still writes nothing', DI.n76Check(r.W) === 'NFPA 76 check, ' + TEL + ': Alert 0.3 (meets 0.2: no), Fire 1 0.5 (meets 1.0: yes).' && r.W.cfg.detThr.join() === '0.3,0.4,0.5,1.2');
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
    r.W.cfg.nfpa76Adopted = true; tel(r);
    ok('A22 NFPA 76 adopted, telecom room: the example values raise no finding; the listing note is one ok line, not a flag', n76(r.S).length === 1 && n76(r.S)[0].sev === 'ok' && n76(r.S)[0].text.startsWith('NFPA 76 rooms: ' + TEL + '. NFPA 76 ceilings: Alert 0.2, Fire 1 1.0 %/ft.') && DI.n76Flags(r.W).length === 0);
    r.W.cfg.detThr = [0.3, 0.6, 2.0, 3.0];
    ok('A22 Alert 0.3 fails NFPA 76; Fire 1 = 2.0 fails the VEP range and the NFPA 76 ceiling on the first alarm stage', fails(r.S, 'NFPA 76 applies in ' + TEL).length === 2 && fails(r.S, 'Alert must be 0.2 %/ft or less (it is 0.3)').length === 1 && out(r.S).some((f) => f.text.includes('Fire 1 threshold 2 %/ft')) && fails(r.S, 'Fire 1, the first alarm stage, must be 1.0 %/ft or less (it is 2)').length === 1 && n76(r.S).some((f) => f.sev === 'fail' && f.ref.includes('N76_ALARM_OVER')));
    delete r.W.cfg.detThr;
    r.W.cfg.nfpa76Adopted = false; ok('A22 where NFPA 76 does not apply (the flag off, the telecom room following it) its limits are not applied and neither a flag nor the note is shown', fails(r.S, 'NFPA 76 applies in').length === 0 && n76(r.S).length === 0 && DI.n76Flags(r.W).length === 0 && DI.n76Note(r.W) === '');
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
    // Cycle 5: the 2022 delivery keys the FP Lead verified (raw 13-FP006-2022-8.2.3.txt) carry no mark any more.
    const J = DI.JURIS, set = (ed) => { const W = new DI.World(4, 4); W.cfg.edition = ed; DI.setJuris(W); };
    const T = {            // key: [2025, 2022, 2019]
      timedTest: ['§8.2.4.2', '§8.2.3.2', '§8.2.3.2'], noQod: ['§8.2.4.2.1', '§8.2.3.3', '§8.2.3.3'], qod: ['§8.2.4.2.2', '§8.2.3.4', '§8.2.3.4'],
      calc: ['§8.2.4.3.1', '§8.2.3.5 to .6', '§8.2.3.5 to .6 (VERIFY)'], table: ['Table 8.2.4.3.2', 'Table 8.2.3.6.1', 'Table 8.2.3.6.1'],
      manifold: ['§8.2.4.4', '§8.2.3.7', undefined], otherTimes: ['§8.2.4.5', '§8.2.3.8', undefined],
      di: ['§8.3.2.3.1.1', '§8.3.2.3.1.1 to .4', '§8.3.2.3.1.1'], diQod: ['§8.3.2.3.2', '§8.3.2.3.2', '§8.3.2.3.2'], delivery: ['§8.2.4', '§8.2.3', '§8.2.3'],
      airTest: ['§29.2.2.1', '§29.2.2.1', '§28.2.2.1'], refill: ['§8.2.7.3', '§8.2.6.3.2', '§8.2.6.3.2'], refillN2: ['§8.2.7.3 (no separate N2-only clause in 2025; §8.2.7.6 has none)', '§8.2.6.8.4', '§8.2.6.8.4'],
      refillCold: ['§8.2.7.4', '§8.2.6.3.3', '§8.2.6.3.3'], refillN2Cold: ['§8.2.7.4', '§8.2.6.8.5', '§8.2.6.8.5'] };      // Cycle 6: 2025 has no N2-only clause (VERIFIED); the 60 min keys are held in every edition
    const yrs = [2025, 2022, 2019], bad = [];
    for (const [k, row] of Object.entries(T)) row.forEach((tail, i) => { const got = J['US-' + yrs[i]].ref[k], want = tail === undefined ? undefined : 'NFPA 13-' + yrs[i] + ' ' + tail; if (got !== want) bad.push(yrs[i] + ' ' + k + ': ' + got); });
    ok('A24 / A38 delivery and air-test citations match the FP Lead table, key by key, in 2025, 2022 and 2019', bad.length === 0, bad.join('; ') || undefined);
    const c = J['US-2022'].ref;
    ok('A24 / A38 2022 is held throughout: no key carries ASSUMED or VERIFY, and the row has no verify flag', Object.values(c).every((x) => !/ASSUMED|VERIFY/.test(x)) && !('verify' in J['US-2022']) && J['US-2022'].delta.join(' ').includes('2022 keeps the 2019 numbering'));
    ok('A24 / A38 2025 is held throughout; the 2019 delta names the air-test section against 2025', Object.values(J['US-2025'].ref).every((x) => !/ASSUMED|VERIFY/.test(x)) && J['US-2025'].delta.length === 0 && J['US-2019'].delta.join(' ').includes('§28.2.2.1 (2025: §29.2.2.1)'));
    set('US-2019'); const d19 = [DI.deliveryRule('dryv', false, 600, 'none').nfpa.ref, DI.deliveryRule('dryv', false, 400, 'none').nfpa.ref, DI.deliveryRule('dryv', true, 600, 'none').nfpa.ref, DI.deliveryRule('prev', false, 600, 'none').nfpa.rule];
    set('US-2022'); const d22 = [DI.deliveryRule('dryv', false, 600, 'none').nfpa.ref, DI.deliveryRule('prev', false, 600, 'none').nfpa.ref];
    set('US-2025'); const d25 = [DI.deliveryRule('dryv', false, 600, 'none').nfpa.rule, DI.deliveryRule('dryv', false, 400, 'none').nfpa.ref, DI.deliveryRule('dryv', true, 600, 'none').nfpa.ref];
    ok('A24 / A38 the rule follows the site edition', d19[0] === 'NFPA 13-2019 §8.2.3.2' && d19[1] === 'NFPA 13-2019 §8.2.3.3' && d19[2] === 'NFPA 13-2019 §8.2.3.4' && d19[3] === 'NFPA 13: 60 s (over 500 gal) [NFPA 13-2019 §8.3.2.3.1.1]' &&
      d22[0] === 'NFPA 13-2022 §8.2.3.2' && d22[1] === 'NFPA 13-2022 §8.3.2.3.1.1 to .4' && d25[0] === 'NFPA 13: 60 s (over 500 gal) [NFPA 13-2025 §8.2.4.2]' && d25[1] === 'NFPA 13-2025 §8.2.4.2.1' && d25[2] === 'NFPA 13-2025 §8.2.4.2.2');
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
    ok('A25 c5: the drill has no hard timer and the false alarm comes after the 30 min air-restore window', c5.drill.steps().some((st) => st[0] === 2100 && /dust/.test(st[2])) && c5.drill.len === 5600 && typeof DI.RECOVERY_TARGET === 'undefined');
    const S2 = new DI.Sim(DI.World.fromJSON(JSON.parse(JSON.stringify(S.W.toJSON())))); S2.restore(JSON.parse(JSON.stringify(S.dump())));
    ok('A25 the recovery log is saved with the game', [...S2.sysd.info.keys()].every((id) => { const q = DI.recoveryScore(S2, id); return q && q.complete && q.inOrder; }) && S2.acts.length === S.acts.length);
    // the drill's broken-sprinkler incident is the only scored recovery
    DI.startDrill(S, c5.drill); let guard = 0; while (!S.drill.done && guard++ < 400000) { S.step(S.fires.length || S.outFlow > 1 ? 0.25 : 1); DI.drillStep(S); sol.ops(S); }
    const dr = S.drill.result, inc = S.acts.find((q) => q.kind === 'incident' && q.t >= S.drill.t0), ds = DI.recoveryScore(S, inc.id, S.drill.t0), nas = ds.steps.filter((q) => q.na).map((q) => q.kind).join();
    ok('A25 c5 drill: the broken-sprinkler incident is 14 of 14 in order, the main drain test last (never tripped, D never latched, El/El: steps 6, 8 and 11 do not apply)', dr.pass && ds.done === 14 && ds.total === 14 && ds.steps[13].kind === 'drain-test' && ds.steps[13].t > ds.steps[12].t && ds.complete && ds.inOrder && !ds.tripped && !ds.det && nas === 'reset-panel-1,reset-valve,reset-trim' && ds.why === 'head', ds.steps.map((q) => q.kind + (q.na ? ' n/a' : '@' + Math.round(q.t - S.drill.t0))).join(' '));
    Object.assign(c5run, { S, dr, ds, inc });
    const iCC = dr.lines.findIndex((l) => /^★ Code check: largest zone alone, from 0 psig: [\d.]+ min\. Limit 30 min \(NFPA 13\)\. Passes\. \[NFPA 13-2025 §8\.2\.7\.3\]$/.test(l)), iMs = dr.lines.findIndex((l) => /^• Air refill this drill, measured: [\d.]+ min \(zones refilled at the same time, from partly full\)\. Informational\.$/.test(l));
    ok('A25 c5 drill report: the 14-step line with its star, the recovery rating (3 stars, on water stopped), the code-check line above the measured refill line, the total, no water-filled line and no gate', dr.lines.some((l) => l === '★ Recovery after the broken sprinkler: 14 of 14 steps, in order') && dr.lines.some((l) => /^★ Recovery rating: 3 of 3 stars\. Water stopped \d+ s after the alarm \(3 stars at 60 s or less, 2 at 150 s or less; any complete in-order recovery is 1; ASSUMED, informational\)\.$/.test(l)) && dr.lines.some((l) => /^• Operator steps took: \d+ s$/.test(l)) &&
      iCC >= 0 && iMs === iCC + 1 && !/limit|OK|over/i.test(dr.lines[iMs]) && !dr.lines.some((l) => /^. Air refill: /.test(l)) && !dr.lines.some((l) => /FAIL|Time bonus/.test(l)) && dr.lines.some((l) => /^• Total recovery [\d.]+ min, mostly the compressor$/.test(l)) && !dr.lines.some((l) => l.includes('Water-filled zone')) && dr.lines.filter((l) => l[0] === '✗').length === 0, dr.lines.join(' | '));
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
    DI.breakSprinkler(d.S, d.head); run(d.S, 5, 0.25); { const first = DI.recoveryScore(d.S, d.v.id, 0);       // read with `from`, the drill form: fourteen steps, and only the main drain test (drill only) is missing
      ok('A26 a new incident starts a new score', R.score(d).done < 13 && first.total === 14 && first.done === 13 && first.steps.filter((q) => !q.done).map((q) => q.kind).join() === 'drain-test'); }
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
    ok('A28 station operated with full air: alarm, D, no release', r.S.sig.get('mn' + r.stn.id).type === 'ALARM' && /^MANUAL PULL, ZONE Preaction system #\d+ .*\(DETECTION\)$/.test(r.S.sig.get('ms' + r.v.id).text) && r.S.sig.get('mn' + r.stn.id).text.startsWith('MANUAL PULL, ZONE Preaction system #' + r.v.id) && r.v.p.pull === true && DI.relState(r.W, r.v).D && r.v.p.solOut === false && r.s.state === 'dry');
    DI.panelReset(r.S, r.pn.id); const dropped = r.v.p.pull === false; run(r.S, 1, 0.25);
    ok('A28 a panel reset re-reads the station: still operated, so D comes straight back', dropped && r.v.p.pull === true && r.S.log.some((l) => l.text.includes('manual station(s) or waterflow switch(es) are still in alarm')));
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
    ok('A28 with the bypass ON on El/El the station is typed MANUAL RELEASE and releases without P', m.s.tripT > 0 && m.v.p.pLatch === false && m.v.p.mrzL === true && m.v.p.pull === false && /^MANUAL RELEASE, ZONE Preaction system #\d+ .*\(BYPASSES P\)$/.test(m.S.sig.get('ms' + m.v.id).text) && DI.relState(m.W, m.v).D === false);
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
    ok('A34 a zone sitting more than 0.5 psi above its test pressure is refused: bleed it at the trim first', DI.startTest(b.S, 'leak', b.v.id) === 'Test pressure is 40 psi. This zone is at 45.0 psi: bleed it at the trim first.' && b.S.procs.length === 0);
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
    ok('A35 air pressure alone behind a tripped clapper is not waterflow: the switch reads no flow, and the alarm of the earlier trip is held by the panel latch only (Cycle 7)', r.s.state === 'filling' && r.s.P > 4 && r.s.wat === 0 && r.s.alarm === false && r.S.sig.has('wf' + r.v.id) && r.S.sig.get('wf' + r.v.id).hold === true && r.v.p.wfL === true && /\(latched: reset the panel\)$/.test(r.S.sig.get('wf' + r.v.id).text) && r.s.qOut === 0, 'P ' + r.s.P.toFixed(1) + ' psi');
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
    const wfl = lines.filter((q) => q[1].startsWith('Water-filled zone'));
    ok('A37 the drill report adds one informational water-filled line for a low-air fill, and none otherwise', wfl.length === 1 && wfl[0][0] === false && wfl[0][2] === true && wfl[0][1] === 'Water-filled zone: ' + DI.sysName(D2.S, D2.v.id) + ' filled because P was left latched (unattended low-air failure), no discharge' && lines.every((q) => q[2] === true) && (D2.S.acts[D2.S.acts.length - 1].why = 'false-alarm', DI.drillRecovery(D2.S, 'x').length === lines.length - 1 && !DI.drillRecovery(D2.S, 'x').some((q) => q[1].startsWith('Water-filled zone'))));
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
    ok('A39 package.json: private, test and test:ui scripts, browser and desktop build tools only, no runtime dependencies', pkg.private === true && Object.keys(pkg.devDependencies).sort().join() === '@tauri-apps/cli,playwright' && !('dependencies' in pkg) && pkg.scripts.test.includes('test/campaign.test.js') && pkg.scripts['test:ui'].includes('test/ui.c3.js') && pkg.scripts['test:ui'].includes('test/ui.c4.js'));
    const au = fs.readFileSync(path.join(__dirname, '..', 'src', 'audio.js'), 'utf8');
    ok('A39 tones: audio.js has its own branch for ALARM, OPEN, TRBL and SUPV', ['ALARM', 'OPEN', 'TRBL', 'SUPV'].every((c) => new RegExp("=== '" + c + "'").test(au)) && /o\.lost|o\.dark/.test(au));
  }
  // A40 aspirating detector: per-model listed ranges, no clamp (the NFPA 76 ceilings are A45)
  {
    const rng = (k) => DI.ASD_STAGES.map(([s]) => DI.ASD_MODELS[k].range[s].join('-')).join(' ');
    ok('A40 the range table is the datasheet table: VEP and VEU, four stages each (VEA, Cycle 7, is Fire 1 only and has no range per stage)', Object.keys(DI.ASD_MODELS).join() === 'VEP,VEU,VEA' && JSON.stringify(DI.ASD_MODELS.VEA.range) === '{}' && rng('VEP') === '0.0015-0.614 0.0015-0.614 0.003-0.614 0.0061-6.575' && rng('VEU') === '0.0003-0.614 0.0003-0.614 0.0003-0.614 0.0003-6.575' && DI.ASD_DEFAULT === 'VEP');
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
    // Cycle 5: the DACT channel row is on the site only on the DACT path, and is ACTIVE NOW with one channel down
    const dc = rig(); dc.W.cfg.commPath = 'dact'; dc.pn.p.chan = [0, 1]; run(dc.S, 1, 0.25);
    // Cycle 6: the charger-failure row, driven on a rig (a sandbox fault; a trouble at the panel and at the station, never an input of D or P)
    const cf = rig(); cf.pn.p.chgFail = true; run(cf.S, 1, 0.25);
    ok('A43 charger failure: the row is ACTIVE NOW and reads the engine signal (TRBL, annunciated, transmitted, no NAC, no solenoid)', agree(cf, 'chgFail', 'cf' + cf.pn.id) && rowOf(cf, 'chgFail').class === 'TRBL' && rowOf(cf, 'chgFail').transmit && !rowOf(cf, 'chgFail').nac && !rowOf(cf, 'chgFail').sol && rowOf(cf, 'chgFail').cells[4] === 'TRBL to the station only (no fire department)');
    ok('A43 one DACT channel down: the row is ACTIVE NOW and reads the engine signal (TRBL, annunciated, monitored)', agree(dc, 'dactChan', 'dc' + dc.pn.id) && rowOf(dc, 'dactChan').class === 'TRBL' && !rowOf(dc, 'dactChan').nac && !rowOf(dc, 'dactChan').sol);
    // Cycle 7: the optional AVC bypass tamper row, driven on a rig with the switch fitted and the bypass open
    const bt = rig(); bt.v.p.avcTamper = 1; bt.v.p.avcBy = 1; run(bt.S, 1, 0.25);
    ok('A43 AVC bypass tamper (optional switch fitted, bypass open): the row is ACTIVE NOW and reads the engine signal (SUPV, annunciated, transmitted, no NAC, no solenoid)', agree(bt, 'avcTamper', 'avcT' + bt.v.id) && rowOf(bt, 'avcTamper').class === 'SUPV' && !rowOf(bt, 'avcTamper').nac && !rowOf(bt, 'avcTamper').sol && !rowOf(bt, 'avcTamper').fd && rowOf(bt, 'avcTamper').cells[4] === 'SUPV to the station only (no fire department)');
    ok('A43 every row of the matrix was seen ACTIVE NOW while its signal was present', DI.CE_ROWS.every((r) => live.has(r.key)), DI.CE_ROWS.filter((r) => !live.has(r.key)).map((r) => r.key).join() || undefined);
    // a device that is not wired to the zone's panel is no input of the zone: its local-only signal marks no row
    const lo2 = rig({ stn: true }); lo2.W.unwire(lo2.d.id); lo2.W.unwire(lo2.stn.id); lo2.stn.p.on = true; smoke(lo2.S, 0.2, 5);
    const lsig = lo2.S.sig.get('v' + lo2.d.id + '.3'), msig = lo2.S.sig.get('mn' + lo2.stn.id);
    const other = rig({ stn: true }), p2 = other.W.addPart('panel', 18, 4, 0); other.W.wire(p2.id, other.d.id); other.stn.p.on = false; smoke(other.S, 0.2, 5);
    ok('A43 an unwired detector at Fire 1 and an unwired operated station raise local-only signals and mark no row ACTIVE NOW; nor does a detector wired to another panel', !!lsig && lsig.mon === false && !!msig && msig.mon === false && lo2.v.p.sol === false && lo2.v.p.pull === false && !rowOf(lo2, 'fire1').live && !rowOf(lo2, 'manual').live && M(lo2).rows.every((q) => !q.live) &&
      other.S.sig.get('v' + other.d.id + '.3').mon === true && other.v.p.sol === false && !rowOf(other, 'fire1').live && rowOf(f, 'fire1').live);
    const u = rig(); u.W.unwire(u.v.id); u.S.sync();
    ok('A43 a zone with no panel: nothing is annunciated or transmitted, and D energizes nothing', M(u).wired === false && M(u).rows.filter((q) => q.applies && q.class).every((q) => !q.annunciated && !q.transmit && !q.sol && !q.nac) && rowOf(u, 'fire1').cells[3] === 'local only: not wired to a panel' && DI.ceMatrix(u.S, u.pn.id) === null);
  }
  // A44 hooks are hooks only; exclusions; the class registry (hook triggers rewritten in Cycle 5: see A56 for the full mapping)
  {
    const r = rig(), M = () => DI.ceMatrix(r.S, r.v.id), cells = () => M().rows.map((q) => q.cells.slice());
    const c0 = cells();
    ok('A44 the nine columns, in order, and 21 rows (Cycle 6 adds the charger-failure row, Cycle 7 the optional AVC bypass tamper row)', DI.CE_COLS.join() === 'Input,Tag,SignalClass,PanelAnnunciation,SS_Transmit,LocalNAC,Solenoid,HVAC_Hook,EPO_Hook' && M().cols.join() === DI.CE_COLS.join() && M().rows.every((q) => q.cells.length === 9) && M().rows.length === DI.CE_ROWS.length && DI.CE_ROWS.length === 21 && DI.CE_ROWS[20].key === 'dactChan' && DI.CE_ROWS[18].key === 'chgFail' && DI.CE_ROWS[14].key === 'avcTamper');
    ok('A44 both hooks default to none / OFF with nothing stored, and every row reads none and OFF', DI.hvacHook(r.W) === 'none' && DI.epoHook(r.W) === false && !('hvacHook' in r.W.cfg) && !('epoHook' in r.W.cfg) && c0.every((c) => c[7] === 'none' && c[8] === 'OFF') && M().hooks.hvac === 'none' && M().hooks.epo === false);
    r.W.cfg.hvacHook = 'fire1'; r.W.cfg.epoHook = true; const c1 = cells(), rows = M().rows;
    const changed = (i) => c1.map((c, n) => (c[i] !== c0[n][i] ? rows[n].key : null)).filter(Boolean).join(), other = c1.every((c, n) => c.slice(0, 7).join('|') === c0[n].slice(0, 7).join('|'));
    ok('A44 electing the hooks changes only the hook cells: HVAC (trigger Fire 1) on the Fire 1, Fire 2, manual, release and waterflow rows; EPO on the waterflow row only', other && changed(7) === 'fire1,fire2,manual,fire1+p,fire1+p, battery,waterflow' && changed(8) === 'waterflow' && rows.find((q) => q.key === 'fire1').cells[7] === 'HOOK: output contact (HVAC shutdown / damper): Fire 1' && rows.find((q) => q.key === 'waterflow').cells[7] === DI.HVAC_CELL + ': waterflow' && rows.find((q) => q.key === 'manual').cells[7] === DI.HVAC_CELL + ': manual station' && rows.find((q) => q.key === 'waterflow').cells[8] === 'HOOK: output contact (power isolation)' && rows.find((q) => q.key === 'fire1+p').cells[8] === 'OFF', changed(7) + ' | ' + changed(8));
    const old = ['crah', 'damper'].map((k) => { r.W.cfg.hvacHook = k; return DI.hvacHook(r.W) + ':' + M().rows.find((q) => q.key === 'fire1').cells[7]; }); r.W.cfg.hvacHook = 'fans';
    ok('A44 a Cycle 4 save that stored crah or damper reads as the Fire 1 trigger; any other value reads none', old.every((x) => x === 'fire1:HOOK: output contact (HVAC shutdown / damper): Fire 1') && DI.hvacHook(r.W) === 'none' && (r.W.cfg.hvacHook = 'toString', DI.hvacHook(r.W)) === 'none' && (r.W.cfg.epoHook = 'yes', DI.epoHook(r.W)) === false && Object.keys(DI.HVAC_HOOKS).join() === 'none,fire1,fire2,waterflow');
    // hook only: the same fire with and without the hooks elected leaves the same world
    const burn = (hook) => { const q = rig(); q.S.live = true; if (hook) { q.W.cfg.hvacHook = 'fire1'; q.W.cfg.epoHook = true; } DI.ignite(q.S, q.head, 0); run(q.S, 240, 0.25);
      return JSON.stringify([[...q.W.parts.values()].map((x) => x.p), [...q.S.sig.keys()], q.W.rooms.map((x) => [x.temp, x.smk, x.burst]), [...q.S.smoke], q.W.power, q.S.stats, q.s.state, q.s.P, q.S.fd.called >= 0]); };
    const b0 = burn(false), b1 = burn(true);
    ok('A44 hook only, never automatic: a fire with both hooks elected changes no part, pump, room temperature, detector, power or valve value', b0 === b1 && b0.length > 500 && /"lvl":[34]/.test(b0) && b0.endsWith('true]'));
    const dir = path.join(__dirname, '..', 'src'), files = fs.readdirSync(dir).filter((x) => x.endsWith('.js')), names = files.filter((x) => /hvacHook|epoHook/.test(fs.readFileSync(path.join(dir, x), 'utf8')));
    ok('A44 static: the hook settings are named only in cause.js and ui.js (Site dialog and siteSet); manual.js may name them and nothing else does', names.includes('cause.js') && names.includes('ui.js') && names.every((x) => ['cause.js', 'ui.js', 'manual.js'].includes(x)), names.join());
    ok('A44 the matrix has no column or row for elevator, door or compressor control, and says so in its footer', !DI.CE_COLS.concat(DI.CE_ROWS.map((q) => q.key + ' ' + q.label)).some((t) => /elevator|door|compressor control/i.test(t)) && /elevator recall, shunt trip and door devices \(outputs and monitor points only: they never feed the release, and a shunt trip is not an EPO hook\), the control of the compressor/.test(M().excluded) && /the NAC voltage drop \(a plan-review check only, with no signal and no row here/.test(M().excluded) && !/notification circuits/.test(M().excluded));
    // every add(...) in alarmStep: its key prefix is one of the known ones, and its second argument is a registry key, never a class
    const step = DI.alarmStep.toString(), calls = [...step.matchAll(/\badd\('([a-zA-Z]+)' \+ [^,]+, ([^,]+),/g)].map((m) => [m[1], m[2]]), reg = Object.keys(DI.SIG_FIXED).concat(Object.keys(DI.SIG_CLASS));
    const lit = calls.filter(([, arg]) => { const m = arg.match(/^'([A-Za-z0-9]+)'$/); return m && !reg.includes(m[1]); }), pre = [...new Set(calls.map((q) => q[0]))].sort().join();
    ok('A44 static: no add(...) in alarmStep carries a literal class; every call passes a registry key', calls.length >= 27 && lit.length === 0 && !/add\('[a-zA-Z]+' \+ [^,]+, '(ALARM|SUPV|TRBL|OPEN)'/.test(step) && !/add\('[^;]*DI\.inClass/.test(step) && (step.match(/DI\.inClass\(W, /g) || []).length === 2 &&
      pre === 'ac,avcT,bd,cf,dc,dx,fu,ha,im,la,lb,lt,mn,ms,pb,pc,pd,pf,pl,pm,pp,pr,rl,s,sa,tl,tm,v,wf' && Object.keys(DI.SIG_FIXED).join() === 'fire1,fire2,manual,mrz,release,waterflow,lowAir,highAir,tamper,avcTamper,supplyAir,acFail,lowBatt,lostComm,impair,dactFail,chgFail,battDisc,spot,pumpRun,pumpMode,pumpPower,pumpFail,pumpFuel,pumpBatt,tankLow,lowTemp,dactChan', pre + (lit.length ? ' | literal: ' + lit.join(';') : ''));
    DI.setJuris(new DI.World(4, 4));
  }
  // A45 NFPA 76 as ceilings: Alert 0.2 and Fire 1 (the first alarm stage) 1.0; nothing elected, nothing written
  {
    const r = rig(), W = r.W, codes = () => DI.n76Flags(W).map((q) => q.code + ':' + q.sev).join(), D0 = [0.03, 0.06, 0.12, 1.2];
    ok('A45 not adopted: no flags, no note', DI.n76Flags(W).length === 0 && DI.n76Note(W) === '' && !DI.review(r.S).some((q) => q.ref.startsWith('NFPA 76')));
    W.cfg.nfpa76Adopted = true; const hallNote = DI.n76Note(W); W.cfg.detThr = [0.3, 0.4, 0.5, 1.2]; const hallCodes = codes(); delete W.cfg.detThr;
    ok('A45 the flag on with the detector in a hall: nothing is checked, and the note says there is no NFPA 76 room', hallCodes === '' && /^NFPA 76 is set as the default for telecom rooms on this site, and there is no NFPA 76 room/.test(hallNote) && hallNote.endsWith('No room is checked.'));
    tel(r);
    const note = DI.n76Note(W), rv = DI.review(r.S).filter((q) => q.ref.startsWith('NFPA 76-2024 §8.5.3.1.2.5'));
    ok('A45 adopted, telecom room, defaults, VEP: no flag, no fail, and the note that the listing binds first', codes() === '' && fails(r.S, 'NFPA 76').length === 0 && note === 'NFPA 76 rooms: ' + TEL + '. NFPA 76 ceilings: Alert 0.2, Fire 1 1.0 %/ft. The VESDA-E VEP listing (Fire 1 maximum 0.614) is tighter, so the listing binds first. [PRACTICE, NEEDS PE REVIEW].' && rv.length === 1 && rv[0].sev === 'ok' && rv[0].text === note);
    W.cfg.asdModel = 'VEU'; const veu = DI.n76Note(W).includes('The VESDA-E VEU listing (Fire 1 maximum 0.614)'); delete W.cfg.asdModel;
    W.cfg.n76AlarmStage = 'fire2'; const ig = codes() === '' && DI.n76Note(W) === note && fails(r.S, 'NFPA 76').length === 0; const old = DI.World.fromJSON(JSON.parse(JSON.stringify(W.toJSON())));
    ok('A45 the retired stage election is ignored: Fire 2 = 1.2 with the old key set to fire2 raises nothing, and an old save that carries the key loads', veu && ig && old.cfg.n76AlarmStage === 'fire2' && DI.n76Flags(old).length === 0 && DI.detThr(old).join() === D0.join());
    delete W.cfg.n76AlarmStage; W.cfg.detThr = [0.3, 0.4, 0.5, 1.2];
    ok('A45 Alert 0.3 fails N76_ALERT_OVER', codes() === 'N76_ALERT_OVER:fail' && DI.n76Flags(W)[0].text === 'NFPA 76 applies in ' + TEL + ': Alert must be 0.2 %/ft or less (it is 0.3).' && DI.n76Flags(W)[0].room === W.rooms[0].id && fails(r.S, 'NFPA 76 applies in').length === 1);
    // Fire 1 above 1.0 cannot be reached inside the VEP or VEU listing (maximum 0.614), so the range is widened for this check only
    const keep = DI.ASD_MODELS.VEP.range; let over = '', f2 = '', wide = '', txt = '';
    try {
      DI.ASD_MODELS.VEP.range = Object.assign({}, keep, { fire1: [0.003, 3] });
      W.cfg.detThr = [0.03, 0.06, 1.5, 2.5]; over = codes(); txt = DI.n76Flags(W)[0].text; wide = DI.n76Note(W);
      W.cfg.detThr = [0.03, 0.06, 0.9, 2.5]; f2 = codes();
    } finally { DI.ASD_MODELS.VEP.range = keep; }
    ok('A45 Fire 1 above 1.0 fails N76_ALARM_OVER; Fire 2 above 1.0 does not; where the listing is not tighter there is no note', over === 'N76_ALARM_OVER:fail' && txt === 'NFPA 76 applies in ' + TEL + ': Fire 1, the first alarm stage, must be 1.0 %/ft or less (it is 1.5). The 1.0 %/ft figure is VERIFIED (NFPA 76-2024 §8.5.3.1.2.5); applying it to Fire 1 is PRACTICE, NEEDS PE REVIEW.' && f2 === '' && wide === '' && DI.ASD_MODELS.VEP.range.fire1[1] === 0.614);
    W.cfg.detThr = D0.slice(); const pre = JSON.stringify(W.cfg), ver = W.ver, msg = DI.n76Check(W);
    ok('A45 the check writes nothing: thresholds, settings and the world version are identical before and after', msg === 'NFPA 76 check, ' + TEL + ': Alert 0.03 (meets 0.2: yes), Fire 1 0.12 (meets 1.0: yes).' && JSON.stringify(W.cfg) === pre && W.ver === ver && DI.detThr(W).join() === D0.join());
    DI.setJuris(new DI.World(4, 4));
  }
  // A46 the refill clock, the operator-step bonus, and "skip the refill"
  {
    const toRefill = (o) => { const r = R.start(o); R.shut(r); R.iso(r, 1); R.drain(r, 1); R.zero(r); DI.replaceSprinklers(r.S, r.v.id); R.drain(r, 0); return r; };       // head replaced, drain shut, supply still isolated
    const r = toRefill(), id = r.v.id, idle = DI.refillState(r.S, id), idleRow = DI.refillText(r.S, id)[0];
    R.iso(r, 0); run(r.S, 60, 1); const on = DI.refillState(r.S, id), onRow = DI.refillText(r.S, id);
    ok('A46 the clock starts with the first gas into the closed-up zone; the row is a measured time with no limit and no colour (Cycle 8)', idle.t === null && !idle.running && idleRow === '-' && on.running && on.t > 55 && on.t <= 61 && on.limit === 1800 && DI.REFILL_LIMIT === 1800 && !on.over && onRow[0] === (on.t / 60).toFixed(1) + ' min so far (measured, informational)' && onRow[1] === '' && DI.refilling(r.S, id), onRow[0]);
    const t0 = r.S.t, left = r.S.warp(7200, 0, () => !DI.refilling(r.S, id)), end = DI.refillState(r.S, id), endRow = DI.refillText(r.S, id);
    ok('A46 "skip the refill" stops when the zone is back at normal, well inside 2 h, and the row reads the measured time, neutral', left === 0 && r.S.t - t0 < 1800 && !end.running && Math.abs(end.t - (r.S.t - t0 + 60)) < 25 && r.s.P >= r.v.p.airSet - 3.2 && r.s.P <= r.v.p.airSet + 0.5 && /^[\d.]+ min \(measured, informational\)$/.test(endRow[0]) && endRow[1] === '' && !DI.refilling(r.S, id), endRow[0] + ' after ' + Math.round(r.S.t - t0) + ' s');
    const u = toRefill(); u.W.power = false; R.iso(u, 0); const u0 = u.S.t; u.S.warp(7200, 0, () => !DI.refilling(u.S, u.v.id));
    ok('A46 with the compressor unpowered the skip never runs beyond 7,200 s, and the zone is still not at normal', Math.abs(u.S.t - u0 - 7200) < 1 && DI.refilling(u.S, u.v.id) && u.s.P < 5);
    r.S.warp(2000); r.s.fillTime = 2136; const failRow = DI.refillText(r.S, id); r.s.rfill = true; r.s.fillT0 = r.S.t - 1900; const runOver = DI.refillText(r.S, id); r.s.rfill = false;
    ok('A46 over 1,800 s the row reads the same neutral way: no limit, no verdict, no amber, and never FAIL (the measured time is not the code check)', failRow[0] === '35.6 min (measured, informational)' && failRow[1] === '' && runOver[0] === '31.7 min so far (measured, informational)' && runOver[1] === '' && DI.refillState(r.S, id).over === true);
    const cite = (ed, n2) => { const q = rig(); if (ed) q.W.cfg.edition = ed; if (n2) { q.W.removePart(q.W.byType('comp')[0].id); q.W.addPart('n2', 14, 4, 0); q.S.sync(); } return DI.refillState(q.S, q.v.id).ref; };
    ok('A46 the limit is cited by edition: 2019 and 2022 §8.2.6.3.2, 2025 §8.2.7.3; an N2-only source 2019 and 2022 §8.2.6.8.4, and 2025 §8.2.7.3 (no N2-only clause in 2025, VERIFIED: no ASSUMED wording)', cite() === 'NFPA 13-2025 §8.2.7.3' && cite('US-2022') === 'NFPA 13-2022 §8.2.6.3.2' && cite('US-2019') === 'NFPA 13-2019 §8.2.6.3.2' && cite('US-2019', true) === 'NFPA 13-2019 §8.2.6.8.4' && cite('US-2022', true) === 'NFPA 13-2022 §8.2.6.8.4' && cite('US-2025', true) === 'NFPA 13-2025 §8.2.7.3 (no separate N2-only clause in 2025; §8.2.7.6 has none)' && !/ASSUMED|not pulled/.test(DI.refillRef.toString()));
    DI.setJuris(new DI.World(4, 4));
    const ds = c5run.ds;
    // Cycle 7: the total still includes the main drain test of step 14 (about 34 s), but that time is its own figure (mdtTime): the operator steps are the recovery steps only
    ok('A46 c5 reference drill: total about 790 s, of which the refill is about 732 s, the operator steps about 23 s and the main drain test about 34 s; water stopped in a few seconds', Math.abs(ds.time - 790) < 20 && Math.abs(ds.refill - 732) < 20 && Math.abs(ds.opTime - 23) < 8 && Math.abs(ds.mdtTime - 34) < 4 && ds.waterStopped >= 0 && ds.waterStopped < 20 && Math.abs(ds.time - ds.refill - ds.opTime - ds.mdtTime) < 1e-6 && c5run.dr.pass, Math.round(ds.time) + ' / ' + Math.round(ds.refill) + ' / ' + Math.round(ds.opTime) + ' / ' + Math.round(ds.mdtTime) + ' s');
    // On one shared 10 scfm compressor the game fills every zone at once, so two commissioning fills of the reference build run past 30 min.
    // Cycle 8: the row is the measured time and nothing else (no limit, no verdict, no amber); the largest-zone-alone figure is the code check, which passes; nothing else reads the clock.
    const fl = c5run.fills, overs = fl.filter((q) => q.st.over);
    ok('A46 c5 reference build: a fill over 30 min shows on the valve row as a measured time, neutral, and no goal, review fail or drill line changes', overs.length >= 1 && overs.every((q) => q.row[1] === '' && !/FAIL|limit|OK|over/.test(q.row[0]) && /^[\d.]+ min( so far)? \(measured, informational\)$/.test(q.row[0]) && Math.abs(q.st.tAlone - 19.1) < 0.1 && q.st.shared === 2) && c5run.goals.every(Boolean) && c5run.rvFails === 0 && c5run.dr.pass && c5run.rows.every((q) => q[1] === ''), fl.map((q) => '#' + q.id + ' ' + q.row[0]).join(', '));
    ok('A46 no goal of any contract and no review finding reads the refill clock, except the long-standing dock goal of contract 2 (Cold Dock)', DI.SCEN.every((sc) => sc.goals.every((q) => !/refillState|refillText|\.refill\b|REFILL_LIMIT/.test(q.ok.toString()))) && DI.SCEN.reduce((n, sc) => n + sc.goals.filter((q) => /fillTime/.test(q.ok.toString())).length, 0) === 1 && !/fillTime|refillState|refillText/.test(DI.review.toString()));
    // A deliberately slow compressor on the incident zone. 3.8 scfm puts the refill over 30 min while the air is still back
    // before the drill's false alarm at 2,100 s (at 3 scfm the false alarm would find P latched and change the incident).
    const B = DI.buildScenario(c5), bs = DI.botBuild(B.S, 'c5'); B.S.warp(bs.settle);
    for (const [kind, vid] of bs.tests) { DI.startTest(B.S, kind, vid); B.S.warp(420); bs.after(B.S, kind, vid); }
    B.W.byType('comp')[0].p.scfm = 3.8; DI.startDrill(B.S, c5.drill); let guard = 0; while (!B.S.drill.done && guard++ < 400000) { B.S.step(B.S.fires.length || B.S.outFlow > 1 ? 0.25 : 1); DI.drillStep(B.S); bs.ops(B.S); }
    const bi = B.S.acts.find((q) => q.kind === 'incident' && q.t >= B.S.drill.t0), bd = DI.recoveryScore(B.S, bi.id, B.S.drill.t0), bl = B.S.drill.result.lines;
    ok('A46 a slow compressor (3.8 scfm, too small to fill the largest zone alone): the code-check line says so and never FAIL, the measured line carries no limit, the operator-step time and the 3-star rating are unchanged, and the drill still passes', B.S.drill.result.pass && bd.complete && bd.inOrder && bd.refill > 1800 && Math.abs(bd.opTime - ds.opTime) < 5 && DI.airSizing(B.S, bi.id).below &&
      bl.some((l) => /^• Code check: largest zone alone, from 0 psig: [\d.]+ min\. Limit 30 min \(NFPA 13\)\. Fails: the compressor is too small for this zone\. Size it to refill the largest zone to normal pressure in 30 min\. \[NFPA 13-2025 §8\.2\.7\.3\]$/.test(l)) && bl.some((l) => /^• Air refill this drill, measured: [\d.]+ min \(zones refilled at the same time, from partly full\)\. Informational\.$/.test(l)) && bl.some((l) => /^★ Recovery rating: 3 of 3 stars\. Water stopped \d+ s after the alarm /.test(l)) && bl.includes('★ Recovery after the broken sprinkler: 14 of 14 steps, in order') && !bl.some((l) => l[0] === '✗' || /FAIL/.test(l)), bl.filter((l) => /refill|rating|Total/.test(l)).join(' | '));
  }
  // A47 compressor sizing: scfm_min = V_ft3 x (P / 14.7) / 30 on the largest zone that shares a source. Cycle 5: below the bare minimum is a review FAIL, below the x1.25 margin a warning (see A59)
  {
    const big = c5run.fills.find((q) => q.id === q.size.gov), sz = big.size;
    ok('A47 the c5 largest zone (525 gal, 70.2 ft3 at 40 psi) needs about 6.37 scfm, 7.96 with the x1.25 margin; all three zones share the compressor and are sized on it', Math.abs(sz.min - 6.37) < 0.01 && Math.abs(sz.margin - 7.96) < 0.01 && Math.abs(sz.ft3 - 70.2) < 0.1 && sz.have === 10 && !sz.below && !sz.tight && c5run.fills.every((q) => q.size.gov === big.id && q.size.shared === 2 && q.size.min === sz.min) && DI.AIR_SIZING.margin === 1.25 && Math.abs(sz.min - sz.gal / 7.48052 * (40 / 14.7) / 30) < 1e-9, sz.min.toFixed(2) + ' / ' + sz.margin.toFixed(2));
    const Z = DI.buildScenario(c5); DI.botBuild(Z.S, 'c5'); const comp = Z.W.byType('comp')[0], air = () => DI.review(Z.S).filter((q) => q.text.includes('air supply'));
    comp.p.scfm = 5; const w5 = air(); comp.p.scfm = 7; const w7 = air(); comp.p.scfm = 10; const w10 = air();
    ok('A47 review fails once at 5 scfm (the largest zone cannot be filled alone in 30 min), warns once at 7 scfm (below the margin), and says nothing at 10 scfm', w5.length === 1 && w5[0].sev === 'fail' && w5[0].text.includes('air supply 5.0 scfm (compressor #' + comp.id + ') cannot restore normal pressure in the largest zone they serve (this one, 525 gal) within 30 min even filling it alone (needs 6.4 scfm; fills in 38.2 min).') && w5[0].ref === 'NFPA 13-2025 §8.2.7.3; NFPA 13-2025 A.8.2.7.3 (one source serving several systems is sized on the single largest system)' &&
      w7.length === 1 && w7[0].sev === 'warn' && w7[0].text.includes('meets the 6.4 scfm minimum') && w7[0].text.includes('below the x1.25 margin (8.0 scfm; ASSUMED, NEEDS PE REVIEW)') && w10.length === 0 && !DI.review(Z.S).some((q) => q.sev === 'fail'), (w5[0] || {}).text);
    ok('A47 the warning text stays clear of the words the existing goals match on', [w5[0].text, w7[0].text].every((t) => !/ockey|util|start within 10 psi/.test(t)));
    const one = rig({ scfm: 1 }), o1 = DI.review(one.S).filter((q) => q.text.includes('air supply')), ok5 = DI.review(rig().S).filter((q) => q.text.includes('air supply'));
    ok('A47 a zone on its own compressor is sized on itself', o1.length === 1 && o1[0].sev === 'fail' && o1[0].text.includes('cannot restore normal pressure in this zone (') && o1[0].ref === 'NFPA 13-2025 §8.2.7.3' && ok5.length === 0 && DI.airSizing(one.S, one.v.id).shared === 0 && DI.airSizing(one.S, one.pn.id) === null);
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
    ok('A49 shutting the supply on a healthy dry zone: one impairment entry, no LOW AIR, and the signal list is unchanged', i0 === 0 && imp.length === 1 && imp[0].key === 'air-isolated:' + d.v.id && imp[0].id === d.v.id && imp[0].text === 'IMPAIRMENT: Air / N2 supply isolated to ' + DI.sysName(d.S, d.v.id) + '. The zone cannot hold or refill air and will drift to low air. Restore the supply.' && !d.S.sig.has('la' + d.v.id) && keys(d.S) === k0 && d.s.P > 39);
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
    const J = DI.JURIS, r = (ed) => J[ed].ref;
    ok('A50 the air-test section is verified in all three editions: 2019 §28.2.2.1, 2022 and 2025 §29.2.2.1, with no mark', r('US-2019').airTest === 'NFPA 13-2019 §28.2.2.1' && r('US-2022').airTest === 'NFPA 13-2022 §29.2.2.1' && r('US-2025').airTest === 'NFPA 13-2025 §29.2.2.1' && !J['US-2019'].delta.join(' ').includes('has not been checked') && !/ASSUMED|VERIFY/.test(J['US-2019'].delta.join(' ')));
    ok('A50 2022 delivery: every key is verified and carries no mark (Cycle 5); the 2019 calc route still says VERIFY', ['table', 'manifold', 'di', 'diQod', 'timedTest', 'noQod', 'qod', 'calc', 'otherTimes'].every((k) => !/ASSUMED|VERIFY/.test(r('US-2022')[k])) && r('US-2019').calc.endsWith('(VERIFY)') && J['US-2022'].delta[0].includes('Verified for 2022: §8.2.3.2, §8.2.3.3, §8.2.3.4, §8.2.3.5 to .6, Table 8.2.3.6.1, §8.2.3.7, §8.2.3.8, §8.3.2.3.1.1 to .4, §8.3.2.3.2 and the air test §29.2.2.1.') && !/ASSUMED|VERIFY/.test(J['US-2022'].delta.join(' ')));
    ok('A50 the refill limit is keyed by edition; 2025 has no N2-only clause, and its N2-only key names §8.2.7.3 and says so (Cycle 6, VERIFIED)', r('US-2019').refill === 'NFPA 13-2019 §8.2.6.3.2' && r('US-2022').refill === 'NFPA 13-2022 §8.2.6.3.2' && r('US-2025').refill === 'NFPA 13-2025 §8.2.7.3' && r('US-2019').refillN2 === 'NFPA 13-2019 §8.2.6.8.4' && r('US-2022').refillN2 === 'NFPA 13-2022 §8.2.6.8.4' && r('US-2025').refillN2 === 'NFPA 13-2025 §8.2.7.3 (no separate N2-only clause in 2025; §8.2.7.6 has none)' && r('US-2025').refillN2Cold === 'NFPA 13-2025 §8.2.7.4');
    // Cycle 5: the NFPA 72 citations live in DI.REF72, keyed by the NFPA 72 edition (its own site setting; Auto follows the NFPA 13 row). See A58.
    const t = (ed) => DI.REF72[J[ed].nfpa72];
    ok('A50 NFPA 72 timing references are keyed by NFPA 72 edition: IP path, multiple paths, DACT, AC delay, panel trouble, low battery', J['US-2019'].nfpa72 === 2019 && J['US-2022'].nfpa72 === 2022 && J['US-2025'].nfpa72 === 2025 && t('US-2019').ipFail === 'NFPA 72-2019 §26.6.3.3(2)' && t('US-2022').ipFail === 'NFPA 72-2022 §26.6.3.3(2)' && t('US-2025').ipFail === 'NFPA 72-2025 §26.6.3.3.2(2) (annunciated per §10.15)' &&
      t('US-2019').multiFail === 'NFPA 72-2019 §26.6.3.4(2)' && t('US-2025').multiFail.startsWith('NFPA 72-2025 §26.6.3.4(1) (') && t('US-2025').multiFail.includes('ASSUMED 6 h; 2025 annunciation time not found') && t('US-2019').dactMissed.startsWith('NFPA 72-2019 §26.6.4.2.2(H) (') && t('US-2022').dactMissed.startsWith('NFPA 72-2022 §26.6.4.3.2.8 (') && t('US-2025').dactMissed.includes('annunciation time is ASSUMED') &&
      ['US-2019', 'US-2022', 'US-2025'].every((ed) => t(ed).acDelay === 'NFPA 72-' + J[ed].nfpa72 + ' §10.6.9.3' && t(ed).panelTrouble === 'NFPA 72-' + J[ed].nfpa72 + ' §10.15.1' && t(ed).lowBatt.startsWith('no low-battery threshold held (') && t(ed).lowBatt.includes('§10.6.9.1, §10.6.10.6')) && Object.values(J).every((row) => !('ref72' in row)));
    const V = DI.ASD_RECORDED.VEA;
    ok('A50 VEA (a Fire 1-only model since Cycle 7): its source record keeps 1.23 %/ft from Xtralis Doc. 36348_03 as primary and the Gamewell 1.3 as a mismatch note; the default model is still VEP', 'VEA' in DI.ASD_MODELS && DI.ASD_MODELS.VEA.fire1Only === true && V.primary === 1.23 && V.oem === 1.3 && V.fire1.join() === '0.5,1.23,2.5' && V.note.includes('1.23 (Enhanced)') && V.note.includes('(Xtralis Doc. 36348_03, primary)') && V.note.includes('The Gamewell sheet 9021-61037 prints Enhanced as 1.3 (4.0 %/m), a source mismatch kept as a note only') && DI.ASD_SRC === '[HB, datasheet; UL Product iQ not checked]' && DI.asdModel({ cfg: { asdModel: 'VEA' } }) === 'VEA' && DI.asdModel({ cfg: {} }) === 'VEP' && DI.asdModel({ cfg: { asdModel: 'XYZ' } }) === 'VEP' && DI.ASD_DEFAULT === 'VEP');
  }
  // A51 after the 24 h air test: return to normal pressure, only where the normal is below the test pressure
  {
    const low = rig({ props: { airSet: 30, loAir: 25, hiAir: 35 } }), id = low.v.id;
    DI.startTest(low.S, 'leak', id); low.S.warp(86500 + DI.AIR_TEST.chargeMax); const res = DI.lastResult(low.S, 'leak', id);
    ok('A51 normal 30 psi: after the test the pipe is left near 39 psi, the step is pending and HIGH AIR shows above the high-air setpoint', !!res && res.pass && low.s.ret === true && low.s.P > 38 && low.v.p.airValve === 1 && low.S.sig.has('ha' + id) && !low.S.acts.some((a) => a.kind === 'return-normal') && res.lines.length === 4);
    low.v.p.sdrain = 1; low.S.touch(); let n = 0; while (low.s.P > 30.5 && n++ < 2000) low.S.step(0.02); const bled = low.s.P;
    const open = low.s.ret === true && !low.S.acts.some((a) => a.kind === 'return-normal'); low.v.p.sdrain = 0; low.S.touch(); run(low.S, 2, 0.25);
    // Cycle 7: the step stays pending until Finish is pressed; return-normal is logged once, on Finish
    const wait = low.s.ret === true && DI.returnReady(low.S, id) && !low.S.acts.some((a) => a.kind === 'return-normal'), fin = DI.returnFinish(low.S, id);
    ok('A51 bleeding at the system drain brings the gauge down; closed with the supply open and the pipe above low air the step is ready but still pending, and Finish logs return-normal once and ends it', bled <= 30.5 && bled >= 25 && open && wait && fin === '' && low.s.ret === false && low.S.acts.filter((a) => a.kind === 'return-normal' && a.id === id).length === 1 && low.v.p.pLatch === false && low.s.P >= low.v.p.loAir && !low.S.sig.has('ha' + id), 'closed at ' + bled.toFixed(1) + ' psi');
    const b = rig({ props: { airSet: 30, loAir: 25, hiAir: 35 } }); DI.startTest(b.S, 'leak', b.v.id); b.S.warp(86500 + DI.AIR_TEST.chargeMax); const m = DI.bleedToNormal(b.S, b.v.id); run(b.S, 1, 0.25); const bWait = b.s.ret === true && !b.S.acts.some((a) => a.kind === 'return-normal'), bFin = DI.returnFinish(b.S, b.v.id);
    ok('A51 the bleed at the trim brings it to normal in one step (the step then waits for Finish), and is refused when there is nothing to bleed', m === '' && Math.abs(b.s.P - 30) < 0.5 && bWait && bFin === '' && b.s.ret === false && b.S.acts.some((a) => a.kind === 'return-normal') && DI.bleedToNormal(b.S, b.v.id) === 'The pipe is already at or below normal pressure.');
    const d = JSON.parse(JSON.stringify(low.S.dump())); ok('A51 the pending step is saved with the game', DI.SS_KEYS.includes('ret') && DI.SS_KEYS.includes('rfill') && 'ret' in d.ss[0][1]);
    const n40 = rig(); DI.startTest(n40.S, 'leak', n40.v.id); n40.S.warp(86500); const r40 = DI.lastResult(n40.S, 'leak', n40.v.id);
    const n50 = rig({ props: { airSet: 50, loAir: 40, hiAir: 60 } }), m50 = DI.startTest(n50.S, 'leak', n50.v.id), st50 = n50.S.procs[0] && n50.S.procs[0].stage; n50.S.warp(86500); const r50 = DI.lastResult(n50.S, 'leak', n50.v.id);
    ok('A51 normal 40 psi: no step, no act, no extra report line; normal 50 psi: the test starts at 50, passes at an end reading of 48.5 or more, and no step appears', r40.pass && !n40.s.ret && !n40.S.acts.some((a) => a.kind === 'return-normal') && r40.lines.length === 4 && m50 === '' && st50 === 1 && !!r50 && r50.pass && r50.end >= 48.5 && r50.lines[0] === 'Test pressure: 50 psi' && !n50.s.ret && !n50.S.acts.some((a) => a.kind === 'return-normal'), r50 && r50.lines[1]);
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
    ok('A52 LOW BATTERY comes in at 1/12 of capacity left (about 22 h into 24 h), transmitted at once; it is a listed setpoint, not a code threshold, and no text says "2 h"', noLb && !!lb && lb.type === 'TRBL' && lb.delay === 0 && lb.tx === true && lbT === 'LOW BATTERY - panel #' + l.pn.id + ' (20.4 V listed setpoint, ASSUMED)' && l.S.sig.get('lb' + l.pn.id).text === lbT + ' (charging)' && DI.lowBattH() === 2 && DI.PANEL_LOWBATT_FRAC === 1 / 12 && typeof DI.PANEL_LOWBATT_H === 'undefined' &&
      /listed low-battery voltage setpoint, 20\.4 V on a 24 V system.*ASSUMED, NEEDS PE REVIEW/.test(DI.LOWBATT_NOTE) && !/\b2 h\b/.test(lbT + DI.LOWBATT_NOTE));
    const m = rig(), cell = (key, i) => DI.ceMatrix(m.S, m.v.id).rows.find((q) => q.key === key).cells[i];
    const ac25 = cell('acFail', 4), lc25 = cell('lostComm', 4), an = cell('acFail', 3); m.W.cfg.edition = 'US-2019'; m.W.cfg.acDelayMin = 120; const ac19 = cell('acFail', 4), lc19 = cell('lostComm', 4);
    m.W.cfg.edition = 'US-2025'; m.W.cfg.commPath = 'multi'; const mu = cell('lostComm', 4), rel = cell('fire1+p, panel dead', 4);
    ok('A52 the matrix shows the live delays with the citation of the edition: AC failure 60 or 120 min (§10.6.9.3), loss of communication 60 min on IP (2019 §26.6.3.3(2), 2025 §26.6.3.3.2(2)), 6 h on multiple paths with the 2025 ASSUMED note', ac25 === 'TRBL after 60 min (OWNER/AHJ, 60 to 180; NFPA 72-2025 §10.6.9.3) to the station only (no fire department)' && lc25 === 'supervising station annunciates after 60 min (IP path; NFPA 72-2025 §26.6.3.3.2(2) (annunciated per §10.15))' && an === 'zone-identified display + audible at the panel within 200 s (shown at once here)' &&
      ac19 === 'TRBL after 120 min (OWNER/AHJ, 60 to 180; NFPA 72-2019 §10.6.9.3) to the station only (no fire department)' && lc19 === 'supervising station annunciates after 60 min (IP path; NFPA 72-2019 §26.6.3.3(2))' && mu.startsWith('supervising station annunciates after 6 h (multiple paths; NFPA 72-2025 §26.6.3.4(1)') && mu.includes('ASSUMED 6 h; 2025 annunciation time not found') && !/VERIFY/.test(mu) && rel.startsWith('not transmitted: dark; loss of communication: supervising station annunciates after 6 h'), ac25 + ' | ' + lc25);
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
  // ====================== Cycle 5 acceptance (A54 onward: the signal registry and fire-department dispatch, the signal
  // schedule, hook triggers, the DACT channel trouble, the NFPA 72 edition, the air supply code check, the two fill
  // readings, return to the normal set point, the recovery rating, the practice reopen note, save / load of power and
  // delay clocks, the El/Pn dead panel). Every case is driven on a rig; nothing is copied from the fixture.
  const liveRig = (o) => { const r = rig(o); r.S.live = true; return r; };       // dispatch runs only on a live site (or in a drill)
  const called = (r) => r.S.fd.called >= 0 && !!r.S.fd.log && r.S.fd.log.auto === true;
  const quiet = (r) => r.S.fd.called < 0 && !r.S.fd.log && !r.S.log.some((l) => /Fire department dispatched/.test(l.text));
  const sha16 = (t) => require('crypto').createHash('sha256').update(t).digest('hex').slice(0, 16);
  // A54 one registry for every signal, and fire-department dispatch from the registry
  {
    const W0 = new DI.World(4, 4), fixed = Object.keys(DI.SIG_FIXED), reg = fixed.concat(Object.keys(DI.SIG_CLASS));
    ok('A54 the registry: 28 fixed keys (Cycle 6 adds dactFail, chgFail and battDisc; Cycle 7 the optional avcTamper) and 3 elected ones, each with a class; the dispatch list is exactly fire1, fire2, manual, mrz, waterflow, spot, all of them alarm', fixed.length === 28 && reg.length === 31 && DI.SIG_FIXED.avcTamper === 'SUPV' && reg.every((k) => ['ALARM', 'SUPV', 'TRBL', 'OPEN'].includes(DI.inClass(W0, k))) && Object.keys(DI.SIG_FD).join() === 'fire1,fire2,manual,mrz,waterflow,spot' && Object.keys(DI.SIG_FD).every((k) => DI.SIG_FIXED[k] === 'ALARM') &&
      ['spot:ALARM', 'pumpRun:SUPV', 'pumpMode:SUPV', 'pumpPower:SUPV', 'pumpFail:TRBL', 'pumpFuel:SUPV', 'pumpBatt:TRBL', 'tankLow:SUPV', 'lowTemp:SUPV', 'dactChan:TRBL', 'dactFail:TRBL', 'chgFail:TRBL', 'battDisc:TRBL'].every((x) => { const [k, c] = x.split(':'); return DI.SIG_FIXED[k] === c; }));
    // positives first: each alarm key, raised on a live wired panel with no fire, calls the fire department
    const sigOf = (r, key) => r.S.sig.get(key), pos = [];
    const f1 = liveRig(); smoke(f1.S, 0.2, 10); pos.push(['fire1', called(f1) && sigOf(f1, 'v' + f1.d.id + '.3').reg === 'fire1' && sigOf(f1, 'v' + f1.d.id + '.3').fd === true]);
    ok('A54 Fire 1 on a live wired panel dispatches the fire department automatically (the positive the negatives are read against)', pos[0][1] && f1.S.log.some((l) => l.text === 'Alarm transmitted. Fire department dispatched.') && f1.S.fires.length === 0);
    const f2 = liveRig(); smoke(f2.S, 1.5, 10); pos.push(['fire2', called(f2) && sigOf(f2, 'v' + f2.d.id + '.4').reg === 'fire2' && sigOf(f2, 'v' + f2.d.id + '.4').fd && sigOf(f2, 'v' + f2.d.id + '.3').sup === true]);
    const mn = liveRig({ stn: true }); mn.stn.p.on = true; run(mn.S, 5, 0.25); pos.push(['manual', called(mn) && sigOf(mn, 'mn' + mn.stn.id).reg === 'manual' && sigOf(mn, 'ms' + mn.v.id).reg === 'manual' && mn.s.state === 'dry']);
    const mz = liveRig({ stn: true }); mz.W.cfg.manualReleaseBypassP = true; mz.stn.p.on = true; run(mz.S, 5, 0.25); pos.push(['mrz', called(mz) && sigOf(mz, 'ms' + mz.v.id).reg === 'mrz' && sigOf(mz, 'ms' + mz.v.id).fd === true]);
    const wf = liveRig(); wf.v.p.mech = true; run(wf.S, 60, 0.25); pos.push(['waterflow', called(wf) && sigOf(wf, 'wf' + wf.v.id).reg === 'waterflow' && [...wf.S.sig.values()].filter((o) => o.fd).length === 1]);
    const sp = liveRig({ det: 'smoke' }); smoke(sp.S, 2, 10); pos.push(['spot', called(sp) && sigOf(sp, 's' + sp.d.id).reg === 'spot' && sp.v.p.sol === false]);
    ok('A54 every alarm key of the dispatch list calls the fire department: Fire 1, Fire 2, manual station, Manual Release zone, waterflow, spot detector', pos.length === 6 && pos.every((q) => q[1]) && pos.map((q) => q[0]).join() === Object.keys(DI.SIG_FD).sort((a, b) => ['fire1', 'fire2', 'manual', 'mrz', 'waterflow', 'spot'].indexOf(a) - ['fire1', 'fire2', 'manual', 'mrz', 'waterflow', 'spot'].indexOf(b)).join(), pos.filter((q) => !q[1]).map((q) => q[0]).join() || undefined);
    // negatives: every supervisory, trouble and pre-alarm key, 10 minutes with no fire, and nobody is called
    const neg = [], seen = new Set(), note = (name, r, keys, hold) => { if (hold) hold(); else r.S.warp(600); const got = keys.map((k) => r.S.sig.get(k)); for (const o of got) if (o) seen.add(o.reg);
      neg.push([name, got.every((o) => !!o && o.fd === false && o.mon) && quiet(r) && r.S.fires.length === 0 && ![...r.S.sig.values()].some((o) => o.fd)]); };
    const al = liveRig(); note('alert', al, ['v' + al.d.id + '.1'], () => smoke(al.S, 0.04, 600));
    const ac = liveRig(); note('action', ac, ['v' + ac.d.id + '.2'], () => smoke(ac.S, 0.07, 600));
    const pl = liveRig(); pl.v.p.sdrain = 1; pl.S.touch(); run(pl.S, 20, 0.25); pl.v.p.sdrain = 0; pl.v.p.airValve = 0; pl.S.touch(); run(pl.S, 2, 0.25); note('pLatch, lowAir', pl, ['pl' + pl.v.id, 'la' + pl.v.id]);
    const rl = liveRig({ props: { trim: 'el-pn' } }); rl.v.p.sol = true; run(rl.S, 2, 0.25); note('release (the circuit alone)', rl, ['rl' + rl.v.id]);
    const ha = liveRig(); ha.v.p.hiAir = 35; run(ha.S, 2, 0.25); note('highAir', ha, ['ha' + ha.v.id]);
    const tm = liveRig({ gate: true }); tm.g.p.target = 0; run(tm.S, 6, 0.25); note('tamper', tm, ['tm' + tm.g.id]);
    const sa = liveRig(); sa.W.byType('comp')[0].p.fault = true; run(sa.S, 2, 0.25); note('supplyAir', sa, ['sa' + sa.v.id]);
    const af = liveRig(); af.W.power = false; run(af.S, 2, 0.25); note('acFail', af, ['ac' + af.pn.id]);
    const lb = liveRig(); lb.pn.p.battH = 1; run(lb.S, 2, 0.25); note('lowBatt', lb, ['lb' + lb.pn.id]);
    const lc = liveRig(); lc.W.power = false; lc.pn.p.battH = 0; lc.S.step(1); lc.S.warp(DI.commDelay(lc.W) + 60); note('lostComm', lc, ['pd' + lc.pn.id]);
    const dc = liveRig(); dc.W.cfg.commPath = 'dact'; dc.pn.p.chan = [1, 0]; run(dc.S, 2, 0.25); note('dactChan', dc, ['dc' + dc.pn.id]);
    const cf = liveRig(); cf.pn.p.chgFail = true; run(cf.S, 2, 0.25); note('chgFail', cf, ['cf' + cf.pn.id]);
    const bd = liveRig(); bd.pn.p.battDisc = true; run(bd.S, 2, 0.25); note('battDisc', bd, ['bd' + bd.pn.id]);
    const dx = liveRig(); dx.W.cfg.commPath = 'dact'; dx.pn.p.chan = [0, 0]; dx.pn.p.chgFail = true; run(dx.S, 2, 0.25); note('dactFail (a trouble held past the 10 attempts)', dx, ['dx' + dx.pn.id], () => dx.S.warp(DI.DACT_TOTAL_S + 30));
    const bt = liveRig(); bt.v.p.avcTamper = 1; bt.v.p.avcBy = 1; run(bt.S, 2, 0.25); note('avcTamper (the optional switch fitted, the bypass open)', bt, ['avcT' + bt.v.id]);
    const im = liveRig(); im.S.contract = true; im.W.cfg.manualReleaseBypassP = true; run(im.S, 2, 0.25); note('impair', im, ['im' + im.v.id]);
    // pumps, tank and a cold room: a small plant of its own (tank, electric pump, two diesels, test header, an unheated dock)
    const PW = new DI.World(40, 14); PW.addRoom('dock', 22, 2, 8, 8); const tk = PW.addPart('tank', 1, 6, 0); hline(PW, 2, 4, 6, 8); const ep = PW.addPart('epump', 5, 6, 0, { gpm: 1000, psi: 100, start: 95 }); hline(PW, 6, 8, 6, 8);
    const dp = PW.addPart('dpump', 9, 6, 0, { gpm: 1000, psi: 100, start: 85 }); hline(PW, 10, 12, 6, 8); const d2 = PW.addPart('dpump', 13, 6, 0, { gpm: 1000, psi: 100, start: 75 }); hline(PW, 14, 16, 6, 8); PW.addPart('testhdr', 17, 6, 0);
    const pp = PW.addPart('panel', 5, 3, 0); for (const x of [tk, ep, dp, d2]) PW.wire(pp.id, x.id);
    const PS = new DI.Sim(PW); PS.commission(); PS.live = true; const pr = { S: PS };
    tk.p.gal = 0.5 * tk.p.cap; tk.p.fill = 0; ep.p.mode = 'off'; PW.power = false; dp.p.mode = 'hand'; dp.p.fuel = 0.5; dp.p.batt = 0.4; d2.p.mode = 'hand'; d2.p.batt = 0.1;
    note('pumps, tank, low temperature', pr, ['tl' + tk.id, 'pm' + ep.id, 'pp' + ep.id, 'pr' + dp.id, 'fu' + dp.id, 'pb' + dp.id, 'pf' + d2.id, 'lt1', 'ac' + pp.id], () => { for (let t = 0; t < 600; t += 1) { PW.rooms[0].temp = 30; PS.step(1); } });
    const want = reg.filter((k) => !DI.SIG_FD[k]).sort().join(), have = [...seen].sort().join();
    ok('A54 every supervisory, trouble and pre-alarm key goes to the supervising station only: 10 minutes with no fire and the fire department is never called', neg.every((q) => q[1]) && have === want, neg.filter((q) => !q[1]).map((q) => q[0]).join() || (have === want ? undefined : 'not raised: ' + reg.filter((k) => !DI.SIG_FD[k] && !seen.has(k)).join()));
    // elected ALARM: the panel sounds, the matrix shows the NAC, and still nobody is called
    const ea = liveRig(); ea.W.cfg.sigClass = { alert: 'ALARM', action: 'ALARM' }; smoke(ea.S, 0.07, 600); const eRow = (k) => DI.ceMatrix(ea.S, ea.v.id).rows.find((q) => q.key === k), eo = ea.S.sig.get('v' + ea.d.id + '.2');
    ok('A54 Alert and Action elected ALARM: shown as ALARM, NAC yes, fire department no, and D is still Fire 1 only', eo.type === 'ALARM' && eo.fd === false && quiet(ea) && eRow('alert').nac && eRow('action').nac && !eRow('alert').fd && !eRow('action').fd && eRow('fire1').fd && ea.v.p.sol === false && DI.relState(ea.W, ea.v).D === false && (smoke(ea.S, 0.2, 5), ea.v.p.sol === true && called(ea)));
    const ep2 = liveRig(); ep2.W.cfg.sigClass = { pLatch: 'ALARM' }; ep2.v.p.sdrain = 1; ep2.S.touch(); run(ep2.S, 20, 0.25); ep2.v.p.sdrain = 0; ep2.v.p.airValve = 0; ep2.S.touch(); run(ep2.S, 2, 0.25); ep2.S.warp(600); const po = ep2.S.sig.get('pl' + ep2.v.id);
    ok('A54 a latched P elected ALARM does not dispatch by itself', !!po && po.type === 'ALARM' && po.fd === false && po.reg === 'pLatch' && quiet(ep2) && DI.ceMatrix(ep2.S, ep2.v.id).rows.find((q) => q.key === 'p').fd === false);
    const stepSrc = DI.alarmStep.toString();
    ok('A54 static: dispatch reads the registry flag, and add() takes a registry key and reads the class in one place', /if \(o\.fd && o\.type === 'ALARM' && o\.mon && !o\.cut && \(!o\.q \|\| o\.q\.state === 'SENT'\) && !o\.sup && !o\.test && !o\.hold\) monAlarm = true/.test(stepSrc) && /const add = \(key, regKey, text, part, lost, delay\) =>/.test(stepSrc) && /type = DI\.inClass\(W, regKey\)/.test(stepSrc) && /fd: !!DI\.SIG_FD\[regKey\]/.test(stepSrc) && !/monAlarm = true[^;]*;[^;]*o\.type === 'ALARM' && o\.mon && !o\.sup && !o\.test\) monAlarm/.test(stepSrc));
    const c1 = DI.SCEN.find((q) => q.id === 'c1');
    ok('A54 the contract 1 drill still judges on an automatic dispatch', /S\.fd\.log\.auto/.test(c1.drill.judge.toString() + DI.SCEN.map((q) => (q.drill ? String(q.drill.judge) : '')).join('') + fs.readFileSync(path.join(__dirname, '..', 'src', 'scen1.js'), 'utf8')));
    DI.setJuris(new DI.World(4, 4));
  }
  // A55 the signal schedule is generated from the registry
  {
    const W = new DI.World(4, 4), sch = DI.signalSchedule(W), by = Object.fromEntries(sch.map((q) => [q.key, q])), CODE = '[CODE, alarm signals go to the communications center; section not pulled]', OURS = 'PRACTICE / not in FA Lead table (ASSUMED)';
    const reg = Object.keys(DI.SIG_FIXED).concat(Object.keys(DI.SIG_CLASS)), is = (k, cls, ss, fd, tag) => by[k].class === cls && by[k].ss === ss && by[k].fd === fd && by[k].tag === tag;
    ok('A55 one row per registry key, the FA Lead’s thirteen first and in the Lead’s order', sch.length === 31 && new Set(sch.map((q) => q.key)).size === 31 && reg.every((k) => !!by[k]) && sch.slice(0, 13).map((q) => q.key).join() === 'fire1,fire2,manual,waterflow,tamper,lowAir,highAir,supplyAir,lowBatt,acFail,alert,action,pLatch' && sch.every((q) => q.label && q.tag) && Object.keys(DI.SIG_META).length === 31);
    ok('A55 Fire 1, Fire 2, manual and waterflow: alarm, to the station, to the fire department [CODE]', ['fire1', 'fire2', 'manual', 'waterflow'].every((k) => is(k, 'ALARM', 'Yes', 'Yes', CODE)));
    ok('A55 tamper, low air, high air, supply-air fault, low battery and AC fail: station only, with the Lead’s tags', is('tamper', 'SUPV', 'Yes', 'No; station only', 'Class [CODE]; station only [PRACTICE]') && is('lowAir', 'SUPV', 'Yes', 'No; station only', 'Class [CODE], section not pulled; station only [PRACTICE]') && is('highAir', 'SUPV', 'Yes', 'No; station only', 'Class [CODE], section not pulled; station only [PRACTICE]') &&
      is('supplyAir', 'TRBL', 'Yes', 'No; station only', '[PRACTICE, per FP Lead’s call]') && is('lowBatt', 'TRBL', 'Yes', 'No; station only', 'Class [PRACTICE]; no voltage threshold in held Ch.10; station only [PRACTICE]') && is('acFail', 'TRBL', 'Yes', 'No; station only', 'Class [CODE 10.6.9.1.1]; station only [PRACTICE]'));
    ok('A55 Alert and Action: the owner’s call, never the fire department; P: OPEN, not elected, not dispatched', is('alert', 'SUPV', 'OWNER; supervisory is the usual default', 'No', '[OWNER]') && is('action', 'SUPV', 'OWNER; supervisory is the usual default', 'No', '[OWNER]') && is('pLatch', 'OPEN', 'Not elected', 'No', 'Class OPEN (R04, R17)'));
    const C6 = { dactFail: '[CODE: failure indication at the premises after the maximum attempts]', chgFail: 'Class [CODE 10.6.10.6.1 to .2]; station only [PRACTICE]', battDisc: '[PRACTICE, not code]; station only [PRACTICE]' };       // Cycle 6 keys carry the FA Lead's tags
    const C7 = { avcTamper: 'PRACTICE (no code requirement verified for the air bypass); station only [PRACTICE]' };       // Cycle 7: the optional bypass tamper carries the FP Lead's label
    ok('A55 the keys the Lead’s first table does not list are marked as ours, except the three Cycle 6 troubles with the Lead’s tags and the optional bypass tamper with its PRACTICE label; only the spot detector and the Manual Release zone among them dispatch', sch.slice(13).every((q) => q.tag === (C6[q.key] || C7[q.key] || OURS)) && is('avcTamper', 'SUPV', 'Yes', 'No; station only', C7.avcTamper) && Object.keys(C6).every((k) => is(k, 'TRBL', 'Yes', 'No; station only', C6[k])) && sch.slice(13).filter((q) => q.fd === 'Yes').map((q) => q.key).join() === 'mrz,spot' && by.release.class === 'ALARM' && by.release.fd === 'No; station only' && by.dactChan.class === 'TRBL' && by.lostComm.fd === 'No; station only');
    W.cfg.sigClass = { alert: 'ALARM', pLatch: 'TRBL' }; const e = Object.fromEntries(DI.signalSchedule(W).map((q) => [q.key, q]));
    ok('A55 the classes read DI.inClass: electing Alert to ALARM (or P to trouble) changes the class cell and not the fire-department cell', e.alert.class === 'ALARM' && e.alert.fd === 'No' && e.action.class === 'SUPV' && e.pLatch.class === 'TRBL' && e.pLatch.ss === 'Yes' && e.pLatch.fd === 'No' && /DI\.inClass\(W, key\)/.test(DI.signalSchedule.toString()) && /DI\.SIG_FD\[key\]/.test(DI.signalSchedule.toString()));
    const r = rig({ gate: true }), cell = (k) => DI.ceMatrix(r.S, r.v.id).rows.find((q) => q.key === k).cells[4];
    ok('A55 the matrix SS_Transmit cell says who is told, per class', cell('fire1') === 'ALARM to the station; fire department: yes' && cell('waterflow') === 'ALARM to the station; fire department: yes' && cell('manual') === 'ALARM to the station; fire department: yes' && cell('lowAir') === 'SUPV to the station only (no fire department)' && cell('tamper') === 'SUPV to the station only (no fire department)' && cell('supplyAir') === 'TRBL to the station only (no fire department)' &&
      cell('lowBatt') === 'TRBL to the station only (no fire department)' && cell('alert') === 'SUPV ([OWNER] pre-alarm handling); no fire department by itself' && cell('p') === 'OPEN (class not elected); no fire department by itself' && cell('fire1+p') === 'ALARM to the station; fire department: yes, by Fire 1 and waterflow (the release circuit is an output)', cell('fire1+p'));
    r.W.cfg.sigClass = { alert: 'ALARM', pLatch: 'ALARM' };
    ok('A55 elected ALARM, the pre-alarm and P rows still say no fire department by itself; the matrix keeps its nine columns', cell('alert') === 'ALARM ([OWNER] pre-alarm handling); no fire department by itself' && cell('p') === 'ALARM; no fire department by itself' && DI.CE_COLS.length === 9 && DI.ceMatrix(r.S, r.v.id).rows.every((q) => q.cells.length === 9));
    ok('A55 the dialog text lives in cause.js: columns, footer and note', DI.SCHED_COLS.join('|') === 'Signal|Class|To the supervising station|Fire department|Tag' && DI.SCHED_FOOT === 'Alarm signals go to the fire department; supervisory and trouble signals go to the supervising station only (PRACTICE). Pre-alarm handling is an owner election.' && /never call the fire department by themselves/.test(DI.SCHED_NOTE));
    DI.setJuris(new DI.World(4, 4));
  }
  // A56 HVAC and EPO hook triggers
  {
    const hk = (r, col) => DI.ceMatrix(r.S, r.v.id).rows.filter((q) => q[col]).map((q) => q.key).join(), set = (r, h, e) => { if (h) r.W.cfg.hvacHook = h; else delete r.W.cfg.hvacHook; if (e) r.W.cfg.epoHook = true; else delete r.W.cfg.epoHook; };
    const r = rig({ gate: true }), REL = 'fire1,fire2,manual,fire1+p,fire1+p, battery,waterflow';
    ok('A56 defaults: HVAC none, EPO OFF, no hook cell anywhere', DI.hvacHook(r.W) === 'none' && DI.epoHook(r.W) === false && hk(r, 'hvac') === '' && hk(r, 'epo') === '');
    set(r, 'fire1'); const f1 = hk(r, 'hvac'); r.W.cfg.sigClass = { alert: 'ALARM', action: 'ALARM' }; const f1a = hk(r, 'hvac'), nacA = DI.ceMatrix(r.S, r.v.id).rows.find((q) => q.key === 'alert').nac; delete r.W.cfg.sigClass;
    ok('A56 trigger Fire 1: HVAC on Fire 1, Fire 2, manual, waterflow and every release row; never Alert, Action, P, a supervisory or trouble row or the dead-panel row, not even with Alert and Action elected ALARM', f1 === REL && f1a === REL && nacA === true && hk(r, 'epo') === '');
    r.W.cfg.manualReleaseBypassP = true; const f1m = hk(r, 'hvac'); delete r.W.cfg.manualReleaseBypassP;
    ok('A56 trigger Fire 1 with the Manual Release zone on the site: its row carries the hook and the greyed DETECTION row does not', f1m === 'fire1,fire2,mrz,fire1+p,fire1+p, battery,waterflow');
    set(r, 'fire2'); const f2 = hk(r, 'hvac'); set(r, 'waterflow'); const fw = hk(r, 'hvac');
    ok('A56 trigger Fire 2: every row with Fire 2 = 1 (in the matrix that is the Fire 2 row; see A85 for the input rule); trigger waterflow: the waterflow row only', f2 === 'fire2' && fw === 'waterflow' && DI.CE_ROWS.filter((q) => q.in.fire2).map((q) => q.key).join() === 'fire2');
    const V = (vec) => DI.ceEval(r.W, r.v, vec); set(r, 'fire1', true);
    ok('A56 the trigger is read from the input vector, never the outcome, and needs a live panel', V({ fire1: true }).hvac && !V({ alert: true }).hvac && !V({ action: true }).hvac && !V({ p: true }).hvac && !V({ lowAir: true }).hvac && !V({ tamper: true }).hvac && !V({ power: 'Battery', acFail: true }).hvac && !V({ fire1: true, p: true, power: 'Dead' }).hvac && !V({ waterflow: true, power: 'Dead' }).epo && !V({ fire1: true, p: true }).epo && V({ fire1: true, p: true }).open && V({ waterflow: true }).epo && !V({ mrz: true }).hvac);
    const epoKeys = [];
    for (const trim of ['el-el', 'el-pn']) { const q = rig({ props: { trim } }); set(q, null, true); const m = DI.ceMatrix(q.S, q.v.id); epoKeys.push(hk(q, 'epo') + '|' + m.rows.filter((x) => (x.open || x.sol) && x.epo).length + '|' + m.rows.filter((x) => x.open).length + '|' + hk(q, 'hvac')); }
    ok('A56 EPO ON: the waterflow row only, on both trims; no EPO on any release or valve-open row', epoKeys.join() === 'waterflow|0|2|,waterflow|0|2|', epoKeys.join());
    const u = rig(); u.W.unwire(u.v.id); u.S.sync(); set(u, 'fire1', true);
    ok('A56 a zone with no panel, and the dead-panel row, carry no hook', hk(u, 'hvac') === '' && hk(u, 'epo') === '' && !DI.ceMatrix(r.S, r.v.id).rows.find((q) => q.key === 'fire1+p, panel dead').hvac);
    const rd = (x) => DI.hvacHook({ cfg: { hvacHook: x } });
    ok('A56 a stored crah or damper reads fire1; an unknown value reads none; EPO is a strict boolean', rd('crah') === 'fire1' && rd('damper') === 'fire1' && rd('fire2') === 'fire2' && rd('waterflow') === 'waterflow' && rd('fans') === 'none' && rd('constructor') === 'none' && rd(undefined) === 'none' && DI.epoHook({ cfg: { epoHook: 1 } }) === false);
    const eng = ['alarm.js', 'gas.js', 'sim.js', 'fire.js', 'proc.js', 'review.js', 'scen.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
    ok('A56 hook only: the engine never reads either hook (static)', !/hvacHook|epoHook|HVAC_HOOKS/.test(eng));
    DI.setJuris(new DI.World(4, 4));
  }
  // A57 DACT channel-failure trouble: 4 minutes on the other channel; both down, a missed test after the 6 h interval
  {
    const r = rig(), id = r.pn.id, dk = 'dc' + id, pk = 'pc' + id, notified = (S) => S.log.filter((l) => l.text.startsWith('Supervising station notified: DACT CHANNEL FAILED')).length;
    r.W.cfg.commPath = 'dact'; run(r.S, 5, 1); const none0 = !r.S.sig.has(dk);
    r.pn.p.chan = [0, 1]; r.S.step(1); const o = r.S.sig.get(dk), t0 = o && o.t0;
    ok('A57 one channel down: a trouble at the panel at once, monitored, not yet at the station', none0 && !!o && o.type === 'TRBL' && o.reg === 'dactChan' && o.mon && !o.dark && o.tx === false && o.delay === 240 && t0 === r.S.t && o.text === 'DACT CHANNEL FAILED - panel #' + id + ' (trouble sent on the other channel within 4 min)');
    while (r.S.t < t0 + 239) r.S.step(1); const at239 = r.S.sig.get(dk).tx === false && notified(r.S) === 0; r.S.step(1); const at240 = r.S.sig.get(dk).tx === true && r.S.t === t0 + 240; run(r.S, 30, 1);
    ok('A57 the station has it after 240 s on the other channel, not at 239 s, and is notified once', at239 && at240 && notified(r.S) === 1 && DI.DACT_CHAN_S === 240 && DI.COMM_PATH.dact.delay === 21600);
    r.pn.p.chan = [1, 1]; r.S.step(1);
    ok('A57 restoring the channel clears it', !r.S.sig.has(dk) && !r.S.sig.has(pk) && r.pn.p.chanT === undefined);
    r.pn.p.chan = [0, 0]; r.S.step(1); const b = r.S.sig.get(dk), tB = r.pn.p.chanT; r.S.warp(21000); while (r.S.t < tB + 21599) r.S.step(1);
    const before = !r.S.sig.has(pk) && r.S.sig.get(dk).tx === false && r.S.t === tB + 21599; r.S.step(1); const pc = r.S.sig.get(pk);
    ok('A57 both channels down: the trouble can never be sent, no missed-test line at 21,599 s, and the supervising station reports it at 21,600 s (ASSUMED)', !!b && b.delay === Infinity && b.tx === false && tB === r.S.t - 21600 && before && !!pc && pc.lost === true && pc.type === 'TRBL' && pc.reg === 'lostComm' && pc.tx === true && pc.text === 'LOSS OF COMMUNICATION - panel #' + id + ' (both DACT channels down; the supervising station reports a missed test)');
    r.pn.p.chan = [0, 1]; r.S.step(1); const back = !r.S.sig.has(pk) && r.S.sig.get(dk).delay === 240;
    ok('A57 when either channel returns the missed-test line clears and the trouble is back to the delayed form', back && r.pn.p.chanT === undefined);
    // both channels down means the panel cannot send anything: an alarm is annunciated, not transmitted, and dispatches nobody
    const cu = liveRig({ stn: true }); cu.W.cfg.commPath = 'dact'; cu.pn.p.chan = [0, 0]; cu.S.step(1); cu.stn.p.on = true; run(cu.S, 5, 1); cu.W.power = false; run(cu.S, 5, 1); cu.S.warp(4000);
    const mnS = () => cu.S.sig.get('mn' + cu.stn.id), acS = () => cu.S.sig.get('ac' + cu.pn.id), c0 = mnS(), a0 = acS(), noFd = quiet(cu), said = cu.S.log.some((l) => l.text.startsWith('ALARM: MANUAL PULL, ZONE ') && l.text.endsWith('[both DACT channels down: not transmitted]'));
    // Cycle 6: on restore the held queue goes out in priority order (hold ON, the default): the alarm at once, the AC-fail trouble in its turn (A77 to A79)
    cu.pn.p.chan = [1, 0]; cu.S.step(1); const mn1 = mnS().cut === false && mnS().tx === true && called(cu) && cu.S.fd.log.late === true, ac1 = acS().tx === false; run(cu.S, 90, 1);
    ok('A57 with both channels down no signal of that panel is transmitted and an alarm does not dispatch the fire department; it is still annunciated, and all of it goes out, the alarm first, when a channel returns', !!c0 && c0.type === 'ALARM' && c0.mon && !c0.dark && c0.cut === true && c0.tx === false && !!a0 && a0.cut && a0.tx === false && noFd && said && cu.v.p.pull === true &&
      mn1 && ac1 && acS().tx === true && cu.S.log.some((l) => /^SENT \d\d:\d\d \(late\): PANEL AC FAIL/.test(l.text)) && !cu.S.log.some((l) => l.text.startsWith('Supervising station notified: PANEL AC FAIL')));
    const one = liveRig({ stn: true }); one.W.cfg.commPath = 'dact'; one.pn.p.chan = [0, 1]; one.S.step(1); one.stn.p.on = true; run(one.S, 5, 1); const ipB = liveRig({ stn: true }); ipB.pn.p.chan = [0, 0]; ipB.stn.p.on = true; run(ipB.S, 5, 1);
    ok('A57 one channel down still sends everything, and the channel state means nothing off the DACT path', one.S.sig.get('mn' + one.stn.id).tx === true && !one.S.sig.get('mn' + one.stn.id).cut && called(one) && ipB.S.sig.get('mn' + ipB.stn.id).tx === true && !ipB.S.sig.get('mn' + ipB.stn.id).cut && called(ipB) && b.cut === true && pc.cut === false);
    const dd = rig(); dd.W.cfg.commPath = 'dact'; dd.pn.p.chan = [0, 0]; dd.W.power = false; dd.pn.p.battH = 0; run(dd.S, 5, 1); dd.S.warp(3600);
    ok('A57 a dead panel raises neither', dd.pn.p.alive === false && !dd.S.sig.has('dc' + dd.pn.id) && !dd.S.sig.has('pc' + dd.pn.id));
    let other = true; for (const k of ['ip', 'multi']) { const q = rig(); q.W.cfg.commPath = k; q.pn.p.chan = [0, 0]; run(q.S, 5, 1); q.S.warp(22000); other = other && ![...q.S.sig.keys()].some((x) => /^(dc|pc)/.test(x)); }
    ok('A57 on the IP and multiple-path sites no DACT signal can exist', other);
    const m = rig(); m.W.cfg.commPath = 'dact'; const rowD = () => DI.ceMatrix(m.S, m.v.id).rows.find((q) => q.key === 'dactChan'), d1 = rowD(); m.W.cfg.commPath = 'ip'; const d2 = rowD(); m.W.cfg.commPath = 'multi'; const d3 = rowD();
    ok('A57 the matrix row: TRBL, at the panel at once, at the station after DI.DACT_CHAN_S with the edition’s section; greyed off the DACT path; 21 rows', d1.applies && d1.class === 'TRBL' && d1.annunciated && d1.transmit && d1.ssDelay === DI.DACT_CHAN_S && !d1.nac && !d1.sol && !d1.fd && d1.cells[4] === 'TRBL after 4 min on the other channel (DACT path; NFPA 72-2025 §26.6.4.2.4.2(3)) to the station only (no fire department)' && d1.cells[3].includes('within 200 s') &&
      !d2.applies && d2.cells[2] === 'not on this site: path is IP' && !d3.applies && d3.cells[2] === 'not on this site: path is multiple paths' && DI.ceMatrix(m.S, m.v.id).rows.length === 21, d1.cells[4]);
    const trip = (fail) => { const q = rig(); q.W.cfg.commPath = 'dact'; if (fail) q.pn.p.chan = [0, 0]; breakHead(q); smoke(q.S, 0.2, 10); const rs = DI.relState(q.W, q.v); return JSON.stringify([rs.D, rs.P, rs.open, rs.sol, q.v.p.solOut, q.s.tripT > 0, q.v.p.tripped]); };
    ok('A57 a failed channel is no input of D or P: the release is identical with and without it', trip(false) === trip(true) && trip(true) === '[true,true,true,true,true,true,true]');
    const old = DI.World.fromJSON(JSON.parse(JSON.stringify(r.W.toJSON()).replace(/"chan":\[[01],[01]\],?/g, '')));
    ok('A57 a panel from an older save gets both channels up, and each new panel has its own channel array', old.byType('panel').every((q) => q.p.chan.join() === '1,1') && m.pn.p.chan !== DI.PARTS.panel.props.chan && DI.PARTS.panel.props.chan.join() === '1,1');
    DI.setJuris(new DI.World(4, 4));
  }
  // A58 NFPA 72 has its own edition setting
  {
    const W = new DI.World(4, 4), e = (ed, e72) => { const w = new DI.World(4, 4); if (ed) w.cfg.edition = ed; if (e72 !== undefined) w.cfg.ed72 = e72; return DI.ed72(w); };
    ok('A58 default is auto: NFPA 72 follows the NFPA 13 edition, and nothing is stored', !('ed72' in W.cfg) && e() === 2025 && e('US-2022') === 2022 && e('US-2019') === 2019 && e('US-2019', 'auto') === 2019 && DI.ED72.join() === 'auto,2019,2022,2025');
    ok('A58 a stored year overrides the pairing; an unknown value reads auto; Canada ignores the setting', e('US-2025', '2019') === 2019 && e('US-2019', '2025') === 2025 && e('US-2022', '2022') === 2022 && e('US-2025', 'x') === 2025 && e('US-2019', 2025) === 2019 && e('CA-2019', '2025') === 2019 && e('CA-2019', '2022') === 2019 && DI.JURIS['CA-2019'].hidden === true);
    const T = { ipFail: ['§26.6.3.3(2)', '§26.6.3.3(2)', '§26.6.3.3.2(2)'], multiFail: ['§26.6.3.4(2)', '§26.6.3.4(2)', '§26.6.3.4(1)'], dactTest: ['§26.6.4.1.5(6)', '§26.6.4.2.5(6)', '§26.6.4.2.5(6)'], dactMissed: ['§26.6.4.2.2(H)', '§26.6.4.3.2.8', '§26.6.4.3.2.8'],
      dactChan: ['§26.6.4.1.4(B)(3)', '§26.6.4.2.4.2(3)', '§26.6.4.2.4.2(3)'], acDelay: ['§10.6.9.3', '§10.6.9.3', '§10.6.9.3'], acTrouble: ['§10.6.9.1.1', '§10.6.9.1.1', '§10.6.9.1.1'], panelTrouble: ['§10.15.1', '§10.15.1', '§10.15.1'],
      // Cycle 6 keys (FA Lead): DACT attempts, signal priority, the trouble resound, standby capacity and factor, the charger
      dactTry: ['§26.6.4.1.3(B)-(D)', '§26.6.4.2.3.2-.4', '§26.6.4.2.3.2-.4'], priority: ['§10.7.2, §10.7.7', '§10.7.2, §10.7.7', '§10.7.2, §10.7.7'], silenceTrouble: ['§10.15.9.1; §10.15.10.7 for a Ch. 26 premises unit', '§10.15.9.1; §10.15.10.7 for a Ch. 26 premises unit', '§10.15.9.1; §10.15.10.7 for a Ch. 26 premises unit'],
      battStby: ['§10.6.7.2', '§10.6.7.2', '§10.6.7.2'], battFactor: ['§10.6.7.2.1.1', '§10.6.7.2.14', '§10.6.7.2.14'], chgRecharge: ['§10.6.10.3.2', '§10.6.10.3.2', '§10.6.10.3.2'], chgFail: ['§10.6.10.6.1 to .2', '§10.6.10.6.1 to .2', '§10.6.10.6.1 to .2'],
      // Cycle 8 (FA Lead): the station cites are held for 2019 too (no VERIFY), the verification section, and the NAC documentation item
      restoral: ['§26.2.5.1', '§26.2.5.1', '§26.2.5.1'], retransmit: ['§26.2.1.2', '§26.2.1.2', '§26.2.1.2'], stnVerify: ['§26.2.2', '§26.2.2', '§26.2.2'], nacDoc: ['§7.2.1(8)', '§7.2.1(8)', '§7.2.1(8)'] };
    const yrs = [2019, 2022, 2025], bad = []; for (const [k, row] of Object.entries(T)) row.forEach((sec, i) => { const got = DI.REF72[yrs[i]][k], want = 'NFPA 72-' + yrs[i] + ' ' + sec; if (!(got === want || (got || '').startsWith(want + ' ('))) bad.push(yrs[i] + ' ' + k + ': ' + got); });
    ok('A58 every edition carries every key with its own section, key by key', bad.length === 0 && yrs.every((y) => Object.keys(DI.REF72[y]).join() === 'ipFail,multiFail,dactTest,dactMissed,dactChan,acDelay,acTrouble,panelTrouble,lowBatt,dactTry,dactAnnex,priority,silenceTrouble,battStby,battFactor,chgRecharge,chgFail,battListed,battGen,restoral,retransmit,stnVerify,latch,nacVd,nacDoc') && Object.keys(DI.REF72).join() === '2019,2022,2025' && yrs.every((y) => DI.REF72[y].restoral === 'NFPA 72-' + y + ' §26.2.5.1' && DI.REF72[y].retransmit === 'NFPA 72-' + y + ' §26.2.1.2' && typeof DI.REF72[y].latch === 'string' && typeof DI.REF72[y].nacVd === 'string') &&
      DI.REF72[2022].dactAnnex === 'NFPA 72-2022 Annex Table A.26.6.1' && DI.REF72[2025].dactAnnex === 'NFPA 72-2025 Annex Table A.26.6.1' && /^no annex table/.test(DI.REF72[2019].dactAnnex) && DI.REF72[2022].battListed === 'NFPA 72-2022 §10.6.10.1.3' && /^no such rule in 2019/.test(DI.REF72[2019].battListed) && DI.REF72[2025].battGen === 'NFPA 72-2025 §10.6.7.3.1(2)' && /^not in 2022/.test(DI.REF72[2022].battGen), bad.join('; ') || undefined);
    ok('A58 2025: the single-path section is verbatim (no VERIFY); the multiple-path time says ASSUMED; a missed DACT test says trouble [CODE] with an ASSUMED time; exact strings carry no mark', DI.REF72[2025].ipFail === 'NFPA 72-2025 §26.6.3.3.2(2) (annunciated per §10.15)' && !/VERIFY/.test(Object.values(DI.REF72[2025]).join(' ')) && DI.REF72[2025].multiFail.includes('ASSUMED 6 h; 2025 annunciation time not found') && !/ASSUMED/.test(DI.REF72[2019].multiFail + DI.REF72[2022].multiFail) &&
      yrs.every((y) => /a missed test is a trouble \[CODE\]; the 6 h annunciation time is ASSUMED/.test(DI.REF72[y].dactMissed) && DI.REF72[y].dactChan === 'NFPA 72-' + y + ' ' + T.dactChan[yrs.indexOf(y)] && DI.REF72[y].dactTest === 'NFPA 72-' + y + ' ' + T.dactTest[yrs.indexOf(y)]));
    ok('A58 the NFPA 72 citations are no longer on the jurisdiction rows; DI.ref72 reads the table', Object.values(DI.JURIS).every((row) => !('ref72' in row) && typeof row.nfpa72 === 'number') && DI.ref72(W) === DI.REF72[2025] && Object.keys(DI.COMM_PATH).every((k) => typeof DI.REF72[2025][DI.COMM_PATH[k].ref] === 'string'));
    const r = rig(), cell = (key, i) => DI.ceMatrix(r.S, r.v.id).rows.find((q) => q.key === key).cells[i], notes = () => DI.ceMatrix(r.S, r.v.id).notes.join(' ');
    const a25 = cell('acFail', 4), n25 = notes(); r.W.cfg.ed72 = '2019'; const a19 = cell('acFail', 4), l19 = cell('lostComm', 4), n19 = notes(), ref13 = DI.refillState(r.S, r.v.id).ref, rv13 = DI.review(r.S).map((q) => q.ref).join(' ');
    ok('A58 NFPA 72-2019 on an NFPA 13-2025 site: the matrix cites 2019 NFPA 72 sections and NFPA 13 citations stay 2025', a25.includes('NFPA 72-2025 §10.6.9.3') && a19.includes('NFPA 72-2019 §10.6.9.3') && l19.includes('NFPA 72-2019 §26.6.3.3(2)') && n25.includes('NFPA 72 edition: 2025') && n19.includes('NFPA 72 edition: 2019') && n19.includes('NFPA 72-2019 §10.15.1') && ref13 === 'NFPA 13-2025 §8.2.7.3' && DI.juris.nfpa13 === 2025 && !/NFPA 13-2019/.test(rv13));
    r.W.cfg.commPath = 'dact'; r.W.cfg.ed72 = '2019'; const dc19 = cell('dactChan', 4), lc19 = cell('lostComm', 4); r.W.cfg.ed72 = '2022'; const dc22 = cell('dactChan', 4);
    ok('A58 the DACT citations follow it too: 2019 §26.6.4.1.4(B)(3), 2022 §26.6.4.2.4.2(3), and the missed test §26.6.4.2.2(H)', dc19.includes('NFPA 72-2019 §26.6.4.1.4(B)(3)') && dc22.includes('NFPA 72-2022 §26.6.4.2.4.2(3)') && lc19.includes('NFPA 72-2019 §26.6.4.2.2(H)'));
    const W2 = DI.World.fromJSON(JSON.parse(JSON.stringify(r.W.toJSON()))), j = r.W.toJSON(); delete j.cfg.ed72; const W3 = DI.World.fromJSON(JSON.parse(JSON.stringify(j)));
    ok('A58 the setting is saved with the world; a save with no ed72 reads auto', W2.cfg.ed72 === '2022' && DI.ed72(W2) === 2022 && !('ed72' in W3.cfg) && DI.ed72(W3) === 2025);
    const man = fs.readFileSync(path.join(__dirname, '..', 'src', 'manual.js'), 'utf8'), uiSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
    ok('A58 static: the manual table is built from DI.REF72 with a 2022 column, the Site dialog reads DI.ref72, and siteSet validates ed72', /DI\.REF72\[yr\]\[k\]/.test(man) && /NFPA 72-2022<\/th>/.test(man) && /R72 = DI\.ref72\(W\)/.test(uiSrc) && /key === 'ed72'\) \{ if \(!DI\.ED72\.includes\(val\)\) return false;/.test(uiSrc) && !/\.ref72\b(?!\()/.test(uiSrc + man + fs.readFileSync(path.join(__dirname, '..', 'src', 'cause.js'), 'utf8').replace(/DI\.ref72\(W\)/g, '')));
    DI.setJuris(new DI.World(4, 4));
  }
  // A59 air supply: the code check is the largest zone filled alone from 0 psig; below it is a review fail
  {
    const big = c5run.fills.find((q) => q.id === q.size.gov), sz = big.size;
    ok('A59 the c5 largest zone (525 gal at 40 psi): P 40, minimum about 6.37 scfm, margin about 7.96, and 10 scfm fills it alone in about 19.1 min', sz.P === 40 && Math.abs(sz.min - 6.37) < 0.01 && Math.abs(sz.margin - 7.96) < 0.01 && Math.abs(sz.tAlone - 19.1) < 0.1 && sz.limit === 30 && !sz.below && !sz.tight && Math.abs(sz.tAlone - sz.ft3 * (40 / 14.7) / 10) < 1e-9, sz.tAlone.toFixed(2) + ' min');
    ok('A59 the normal-minus-3.2 basis is gone: a zone at 40 is sized at 40, not 36.8', Math.abs(sz.min - sz.ft3 * (40 / DI.ATM) / 30) < 1e-9 && Math.abs(sz.min - sz.ft3 * (36.8 / DI.ATM) / 30) > 0.4 && !/3\.2/.test(DI.airSizing.toString() + DI.sizingP.toString()));
    const Z = DI.buildScenario(c5); DI.botBuild(Z.S, 'c5'); const comp = Z.W.byType('comp')[0], zid = big.id, az = () => DI.airSizing(Z.S, zid), air = () => DI.review(Z.S).filter((q) => q.text.includes('air supply'));
    comp.p.scfm = 5; const a5 = az(), w5 = air(); comp.p.scfm = 7; const a7 = az(), w7 = air(); comp.p.scfm = 10; const w10 = air();
    ok('A59 review: 5 scfm is one fail on the governing zone (it cannot be filled alone in 30 min), 7 scfm one warning (x1.25 margin, ASSUMED), 10 scfm nothing', a5.below && a5.tAlone > 30 && w5.length === 1 && w5[0].sev === 'fail' && w5[0].text.startsWith(DI.sysName(Z.S, zid) + ': air supply 5.0 scfm') && /even filling it alone \(needs 6\.4 scfm; fills in 38\.2 min\)\.$/.test(w5[0].text) &&
      !a7.below && a7.tight && a7.tAlone < 30 && w7.length === 1 && w7[0].sev === 'warn' && w7[0].text.includes('x1.25 margin (8.0 scfm; ASSUMED, NEEDS PE REVIEW)') && w10.length === 0, w5[0] && w5[0].text);
    ok('A59 one compressor serving several zones is sized on the single largest: the smaller zones report no finding, and the reference cites the Annex', c5run.fills.every((q) => q.size.gov === zid && q.size.shared === 2) && w5[0].ref === 'NFPA 13-2025 §8.2.7.3; NFPA 13-2025 A.8.2.7.3 (one source serving several systems is sized on the single largest system)');
    // Cycle 6: the cut-out enters the sizing only on a compressor direct to the system (no AVC). With the default AVC it never does: see A76.
    const avcP = az().P; for (const z of Z.W.byType('prev')) z.p.avc = 0;
    comp.p.cutOut = 50; const c50 = az(), w50 = air(); comp.p.scfm = 9; const wc = air(); comp.p.scfm = 7; const wf = air(); comp.p.scfm = 10; comp.p.cutOut = 45; const c45 = az(); comp.p.cutOut = 30; const c30 = az(); comp.p.cutOut = 0; for (const z of Z.W.byType('prev')) z.p.avc = 1;
    ok('A59 on a compressor direct to the system (no AVC) a cut-out above normal raises the sizing pressure (50 psi: minimum about 7.96 scfm, so 9 scfm is a warning and 7 scfm a fail); one at or below normal changes nothing; the regulator still holds normal', avcP === 40 && c50.P === 50 && Math.abs(c50.min - 7.96) < 0.01 && Math.abs(c50.tAlone - 23.9) < 0.1 && w50.length === 0 && c45.P === 45 && c30.P === 40 && Math.abs(c30.min - sz.min) < 1e-9 && wc.length === 1 && wc[0].sev === 'warn' && wc[0].text.includes('Sized at the 50 psi compressor cut-out, which is above normal (compressor direct to the system, no AVC; ASSUMED).') && wf.length === 1 && wf[0].sev === 'fail' && wf[0].text.includes('needs 8.0 scfm') && DI.PARTS.comp.props.cutOut === 0 && !('cutOut' in DI.PARTS.n2.props) && DI.COMP_CUTOUT.join() === '0,45,50,55,60' && !/cutOut/.test(DI.gasPre.toString()));
    const oldC = DI.migratePart({ id: 1, type: 'comp', x: 0, y: 0, rot: 0, p: { scfm: 5 } });
    ok('A59 a compressor from an older save has no cut-out', oldC.p.cutOut === 0 && oldC.p.fault === false);
    const n2 = (ed) => { const q = rig(); if (ed) q.W.cfg.edition = ed; q.W.removePart(q.W.byType('comp')[0].id); q.W.addPart('n2', 14, 4, 0, { scfm: 1 }); q.S.sync(); return DI.review(q.S).filter((x) => x.text.includes('air supply'))[0]; };
    const n25 = n2(), n19 = n2('US-2019');
    ok('A59 an N2-only source: 2025 cites §8.2.7.3 and says it has no N2-only clause (VERIFIED, no ASSUMED wording); 2019 cites its N2-only section', !!n25 && n25.sev === 'fail' && n25.ref === 'NFPA 13-2025 §8.2.7.3 (no separate N2-only clause in 2025; §8.2.7.6 has none)' && !/ASSUMED/.test(n25.ref) && n25.text.includes('N₂ generator') && n19.ref === 'NFPA 13-2019 §8.2.6.8.4');
    const refs = []; for (const sc of DI.SCEN) { if (!DI.BOT[sc.id]) continue; const q = DI.buildScenario(sc); DI.botBuild(q.S, sc.id); const rv = DI.review(q.S); for (const [id] of q.S.sysd.info) { const a = DI.airSizing(q.S, id); if (a && (a.below || a.tight)) refs.push(sc.id + '#' + id); } if (rv.some((x) => x.text.includes('air supply')) || rv.some((x) => x.sev === 'fail')) refs.push(sc.id); }
    ok('A59 no reference build (c1 to c7) gains a sizing fail, a sizing warning or any review fail', refs.length === 0, refs.join() || undefined);
    ok('A59 the review reads the sizing check and never the measured clock', /DI\.airSizing\(S, id\)/.test(DI.review.toString()) && !/fillTime|fill1|refillState|refillText/.test(DI.review.toString()));
    DI.setJuris(new DI.World(4, 4));
  }
  // A60 the measured clock is informational: no FAIL text, a parallel-split note, and two readings
  {
    const txt = [];
    const one = rig(); one.s.fillTime = 2136; txt.push(DI.refillText(one.S, one.v.id)); one.s.fill1 = 2136; txt.push(DI.refillText(one.S, one.v.id, true)); one.s.fillTime = 700; txt.push(DI.refillText(one.S, one.v.id));
    ok('A60 a zone on its own compressor (Cycle 8): over the limit and inside it the row reads "<m> min (measured, informational)" with a neutral class: no limit, no OK, no amber', txt[0][0] === '35.6 min (measured, informational)' && txt[0][1] === '' && txt[1][0] === '35.6 min (measured, informational)' && txt[1][1] === '' && txt[2][0] === '11.7 min (measured, informational)' && txt[2][1] === '');
    const Z = DI.buildScenario(c5), zsol = DI.botBuild(Z.S, 'c5'); Z.S.warp(zsol.settle); const zid = [...Z.S.sysd.info.keys()][0], zs = Z.S.ss.get(zid), comp = Z.W.byType('comp')[0]; zs.fillTime = 2136;
    const sh = DI.refillText(Z.S, zid), st = DI.refillState(Z.S, zid); comp.p.scfm = 5; const sm = DI.refillText(Z.S, zid), st5 = DI.refillState(Z.S, zid); comp.p.scfm = 10;
    ok('A60 a shared compressor reads the same neutral row whether the code check passes or fails: the code check is the sizing row, never the clock (Cycle 8)', sh[0] === '35.6 min (measured, informational)' && sh[1] === '' && st.shared === 2 && Math.abs(st.tAlone - 19.1) < 0.1 && sm[0] === '35.6 min (measured, informational)' && sm[1] === '' && st5.tAlone > 30 && st.over === true);
    ok('A60 the label is the FP Lead’s, and no clock text ever says FAIL', DI.PARALLEL_SPLIT === 'SIMPLIFICATION: parallel split; real ECS per-riser AVC/restrictors feed concurrently' && txt.concat([sh, sm], c5run.fills.map((q) => q.row), c5run.rows).every((q) => !/FAIL|limit|OK|over/.test(q[0]) && q[1] === '') && !/FAIL|'bad'|'warn'|'good'|limit/.test(DI.refillText.toString()));
    // two fills on one valve: the first (commissioning, by the compressor from 0 psig) and a later refill after a trip
    const base = rig({ gate: true }), S = new DI.Sim(base.W), v = base.v, s = S.ss.get(v.id), g = base.g;
    const init = s.fill1 === -1 && s.fillTime === -1 && !s.set; let n = 0; while (!s.set && n++ < 4000) S.step(1); const first = s.fill1, f0 = s.fillTime, rows0 = [DI.refillText(S, v.id, true)[0], DI.refillText(S, v.id)[0]];
    v.p.mech = true; run(S, 30, 0.25); DI.setGate(S, g.id, 0); run(S, 6, 0.25); v.p.sdrain = 1; S.touch(); n = 0; while (!s.dz && n++ < 40000) S.step(0.25);
    base.W.byType('comp')[0].p.scfm = 10;        // a bigger compressor for the refill, so the two readings differ
    const m = DI.resetValve(S, v.id); v.p.sdrain = 0; S.touch(); n = 0; while (!s.set && n++ < 4000) S.step(1); const second = s.fillTime;
    ok('A60 fill1 is set by the first commissioning fill and is not overwritten by a later refill; fillTime is the last refill', init && first > 0 && f0 === first && m === '' && s.set && second > 0 && second !== first && s.fill1 === first && DI.refillState(S, v.id).first === first && DI.refillState(S, v.id).t === second, 'first ' + Math.round(first) + ' s, second ' + Math.round(second) + ' s');
    ok('A60 the inspector’s two rows read the two numbers', rows0[0] === rows0[1] && /^[\d.]+ min \(measured, informational\)$/.test(rows0[0]) && DI.refillText(S, v.id, true)[0] === DI.fmt(first / 60, 1) + ' min (measured, informational)' && DI.refillText(S, v.id)[0] === DI.fmt(second / 60, 1) + ' min (measured, informational)' && DI.refillText(rig().S, base.v.id, true)[0] === '-');
    const jw = JSON.parse(JSON.stringify(base.W.toJSON())), js = JSON.parse(JSON.stringify(S.dump())), W2 = DI.World.fromJSON(jw), S2 = new DI.Sim(W2); S2.restore(js);
    const oldSave = JSON.parse(JSON.stringify(S.dump())); for (const q of oldSave.ss) delete q[1].fill1; const S3 = new DI.Sim(DI.World.fromJSON(jw)); S3.restore(oldSave);
    ok('A60 both readings survive save and load; a save from before fill1 loads with none', DI.SS_KEYS.includes('fill1') && S2.ss.get(v.id).fill1 === first && S2.ss.get(v.id).fillTime === second && S3.ss.get(v.id).fill1 === -1 && DI.refillState(S3, v.id).first === null);
    const C = DI.buildScenario(c5); ok('A60 commissioning a ready-built plant measures nothing: both readings start empty', [...C.S.ss.values()].every((q) => q.fill1 === -1 && q.fillTime === -1));
    ok('A60 no goal of any contract and no review finding reads either number, except the one dock goal', DI.SCEN.reduce((k, sc) => k + sc.goals.filter((q) => /fillTime|fill1/.test(q.ok.toString())).length, 0) === 1 && DI.SCEN.every((sc) => sc.goals.every((q) => !/fill1|refillState|refillText|tAlone/.test(q.ok.toString()))) && !/fillTime|fill1/.test(DI.review.toString() + DI.drillRecovery.toString() + DI.recoveryScore.toString()));
    DI.setJuris(new DI.World(4, 4));
  }
  // A61 edition keys: what the Leads verified is recorded, and what is still ASSUMED says so
  {
    const J = DI.JURIS, r22 = J['US-2022'].ref, jsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'juris.js'), 'utf8'), man = fs.readFileSync(path.join(__dirname, '..', 'src', 'manual.js'), 'utf8');
    ok('A61 the 2022 delivery strings carry no mark, the row has no verify flag and the ASSUMED suffix is gone from the file', r22.timedTest === 'NFPA 13-2022 §8.2.3.2' && r22.noQod === 'NFPA 13-2022 §8.2.3.3' && r22.qod === 'NFPA 13-2022 §8.2.3.4' && r22.calc === 'NFPA 13-2022 §8.2.3.5 to .6' && r22.otherTimes === 'NFPA 13-2022 §8.2.3.8' && !('verify' in J['US-2022']) && !/const AV\b|\+ AV\b|verify: true/.test(jsrc));
    const W = new DI.World(4, 4), rr = (ed, n2, annex) => { W.cfg.edition = ed; return DI.refillRef(W, n2 ? { src: [1] } : { src: [] }, annex); }; W.parts.set(1, { id: 1, type: 'n2', p: {} });
    ok('A61 the refill cites by edition, with the Annex note for a shared supply', rr('US-2019') === 'NFPA 13-2019 §8.2.6.3.2' && rr('US-2022') === 'NFPA 13-2022 §8.2.6.3.2' && rr('US-2025') === 'NFPA 13-2025 §8.2.7.3' && rr('US-2019', false, true) === 'NFPA 13-2019 §8.2.6.3.2; NFPA 13-2019 A.8.2.6.3.2 (one source serving several systems is sized on the single largest system)' &&
      rr('US-2022', false, true).includes('NFPA 13-2022 A.8.2.6.3.2') && rr('US-2025', false, true) === 'NFPA 13-2025 §8.2.7.3; NFPA 13-2025 A.8.2.7.3 (one source serving several systems is sized on the single largest system)');
    ok('A61 N2-only: 2019 and 2022 §8.2.6.8.4 are verified; 2025 has no N2-only clause (VERIFIED: §8.2.7.6 has none) and cites §8.2.7.3 with no ASSUMED wording', rr('US-2019', true) === 'NFPA 13-2019 §8.2.6.8.4' && rr('US-2022', true) === 'NFPA 13-2022 §8.2.6.8.4' && rr('US-2025', true) === 'NFPA 13-2025 §8.2.7.3 (no separate N2-only clause in 2025; §8.2.7.6 has none)' && !/ASSUMED|not pulled/.test(rr('US-2025', true) + DI.refillRef.toString()));
    // Cycle 6: the 60 min limit is modelled by one site flag (W.cfg.refrigerated, default off): see A90. Only DI.refillRef (gas.js) reads the two cold keys.
    ok('A61 60 min for refrigerated spaces is keyed in every edition (2019 and 2022 §8.2.6.3.3, N2-only §8.2.6.8.5; 2025 §8.2.7.4 for every source); the default limit stays 30 min', J['US-2019'].ref.refillCold === 'NFPA 13-2019 §8.2.6.3.3' && r22.refillCold === 'NFPA 13-2022 §8.2.6.3.3' && J['US-2025'].ref.refillCold === 'NFPA 13-2025 §8.2.7.4' && r22.refillN2Cold === 'NFPA 13-2022 §8.2.6.8.5' && J['US-2025'].ref.refillN2Cold === 'NFPA 13-2025 §8.2.7.4' && DI.REFILL_LIMIT === 1800 && DI.refillLimit(new DI.World(4, 4)) === 1800 &&
      !/refillCold|refillN2Cold/.test(['review.js', 'sim.js', 'proc.js', 'scen.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('')));
    ok('A61 the 2025 acceptance cite still says VERIFY (from a search, not verbatim)', /&sect;29\.2\.3\.2\.4\.1\) measures the time to set pressure from the opening of the air supply \(from a search, not verbatim: VERIFY\)/.test(man) && /§29\.2\.3\.2\.4\.1 \(VERIFY, from a search, not\s*\/\/ verbatim\)/.test(jsrc));
    DI.setJuris(new DI.World(4, 4));
    const R = (qod, z) => DI.deliveryRule('prev', qod, z, 'none');
    ok('A61 double interlock has only the 500 gal exemption: a 600 gal zone with a QOD is over it, and 750 gal changes nothing', R(true, 600).nfpa.limit === 60 && R(true, 600).nfpa.thr === 500 && R(false, 600).nfpa.limit === 60 && R(true, 740).nfpa.limit === 60 && R(true, 500).nfpa.limit === null && DI.DELIVERY.di === 500 && DI.deliveryRule('dryv', true, 600, 'none').nfpa.limit === null &&
      /On double interlock 750 gal is that trip-test connection trigger, not a maximum volume/.test(man));
  }
  // A62 the 24 h air test runs at the greater of 40 psi or normal, and ends with "return to normal set point"
  {
    const test = (props) => { const r = rig({ gate: true, props }); const m = DI.startTest(r.S, 'leak', r.v.id); r.S.warp(86500 + DI.AIR_TEST.chargeMax); return Object.assign(r, { m, res: DI.lastResult(r.S, 'leak', r.v.id) }); };
    const n50 = test({ airSet: 50, loAir: 40, hiAir: 60 }), n40 = test(), V = (a) => ({ p: { airSet: a } });
    ok('A62 test pressure is the greater of 40 psi or normal; the pass line is a loss of 1.5 psi or less at every test pressure', DI.airTestPsi(V(50)) === 50 && DI.airTestEnd(V(50)) === 48.5 && DI.airTestPsi(V(40)) === 40 && DI.airTestEnd(V(40)) === DI.AIR_TEST.endMin && DI.airTestPsi(V(30)) === 40 && DI.airTestPsi(V(35)) === 40 && DI.airTestPsi(V(60)) === 60);
    ok('A62 normal 50 psi: the test starts, holds 24 h at 50, passes at 48.5 or more, and no step appears', n50.m === '' && n50.res.pass && n50.res.psi === 50 && n50.res.end >= 48.5 && /^Start: 50\.0 psi, end: 4[89]\.\d psi$/.test(n50.res.lines[1]) && n50.res.lines[0] === 'Test pressure: 50 psi' && n50.res.lines[2].startsWith('Pass: end reading at least 48.5 psi (loss of 1.5 psi or less in 24 h) [NFPA 13-2025 §29.2.2.1]') && !n50.s.ret && DI.returnStep(n50.S, n50.v.id) === null && n50.v.p.pLatch === false, n50.res.lines.join(' | '));
    ok('A62 above 40 psi the report says whose rule the test pressure is; at 40 it is the four lines it always was', n50.res.lines.length === 5 && n50.res.lines[4] === 'Tested at the zone’s normal pressure, the greater of 40 psi or normal: company practice, NEEDS PE REVIEW' && n40.res.pass && n40.res.lines.length === 4 && n40.res.lines[0] === 'Test pressure: 40 psi' && n40.res.lines[2].startsWith('Pass: end reading at least 38.5 psi') && !n40.s.ret);
    const bad = rig({ props: { airSet: 50, loAir: 40, hiAir: 60 } }); bad.s.holes = 300; DI.startTest(bad.S, 'leak', bad.v.id); bad.S.warp(86500); const rb = DI.lastResult(bad.S, 'leak', bad.v.id);
    ok('A62 a leaking zone at normal 50 fails against 48.5, not against 38.5', !!rb && !rb.pass && rb.end < 48.5 && rb.psi === 50, rb && rb.lines[1]);
    const P30 = { airSet: 30, loAir: 25, hiAir: 35 }, lo = test(P30), id = lo.v.id, st0 = DI.returnStep(lo.S, id), n35 = test({ airSet: 35, loAir: 30, hiAir: 45 });
    ok('A62 normal 30 and 35: the pipe ends above normal, the step is pending and says "at the trim (test bleed), not the main drain"; HIGH AIR shows where the pipe is above the setpoint', lo.res.pass && lo.s.ret === true && lo.s.P > 38 && lo.S.sig.has('ha' + id) && st0.mode === 'bleed' &&
      st0.text === 'return to normal set point: bleed to 30 psi at the trim (test bleed), not the main drain; never open the control valve to bleed air; then confirm above low air (25 psi), above the P set point (20 psi), AVC in auto, supervisory clear, every drain closed, and press Finish.' && n35.s.ret === true && DI.returnStep(n35.S, n35.v.id).mode === 'bleed' && !n35.S.sig.has('ha' + n35.v.id));
    // an open drain does not complete it, whatever the gauge reads: every condition has to hold
    lo.v.p.sdrain = 1; lo.S.touch(); let n = 0; while (lo.s.P > 30.4 && n++ < 3000) lo.S.step(0.02); const atNormalOpen = lo.s.P <= 30.4 && lo.s.P > 26.8 && lo.s.ret === true && !lo.S.acts.some((a) => a.kind === 'return-normal');
    lo.S.step(0.02); const stillOpen = lo.s.ret === true; lo.v.p.sdrain = 0; lo.S.touch();
    ok('A62 opening the system drain does not complete the step: with the drain open and the gauge at normal it is still pending', atNormalOpen && stillOpen);
    const cond = (mut, undo) => { const r = test(P30); mut(r); const m = DI.bleedToNormal(r.S, r.v.id); run(r.S, 2, 0.25); const held = m === '' && Math.abs(r.s.P - 30) < 0.6 && r.s.ret === true && !DI.returnReady(r.S, r.v.id) && !r.S.acts.some((a) => a.kind === 'return-normal'); undo(r); run(r.S, 2, 0.25); const ready = r.s.ret === true && DI.returnReady(r.S, r.v.id), fin = DI.returnFinish(r.S, r.v.id); return held && ready && fin === '' && r.s.ret === false && r.S.acts.filter((a) => a.kind === 'return-normal').length === 1; };
    ok('A62 after the bleed at the trim the step is not ready until each condition holds (then Finish ends it): supply open, system drain closed, main drain closed, not above high air, above P trip plus the margin', cond((r) => { r.v.p.airValve = 0; }, (r) => { r.v.p.airValve = 1; }) && cond((r) => { r.v.p.drain = 1; }, (r) => { r.v.p.drain = 0; }) &&
      cond((r) => { r.v.p.hiAir = 29; }, (r) => { r.v.p.hiAir = 35; }) && cond((r) => { r.v.p.pTrip = 26; }, (r) => { r.v.p.pTrip = 20; }) && DI.P_MARGIN === 5);
    const t = test(P30), g0 = JSON.stringify(t.g.p), gates = () => JSON.stringify([...t.W.parts.values()].filter((q) => q.type === 'gate').map((q) => q.p)), gs = gates(), v0 = JSON.stringify([t.v.p.sdrain, t.v.p.drain, t.v.p.airValve, t.v.p.itc]), m = DI.bleedToNormal(t.S, t.v.id), l0 = t.S.log.length; run(t.S, 1, 0.25); const tFin = DI.returnFinish(t.S, t.v.id);
    ok('A62 the bleed at the trim brings it to normal in one step with every condition true; Finish then logs the confirmation; neither touches a control valve or a drain', m === '' && tFin === '' && !/gate|target|setGate|sdrain = |\.drain = |airValve = |\.open = /.test(DI.returnFinish.toString()) && Math.abs(t.s.P - 30) < 0.5 && t.s.ret === false && t.S.acts.filter((a) => a.kind === 'return-normal' && a.id === t.v.id).length === 1 && JSON.stringify(t.g.p) === g0 && gates() === gs && JSON.stringify([t.v.p.sdrain, t.v.p.drain, t.v.p.airValve, t.v.p.itc]) === v0 &&
      t.S.log.slice(l0).some((l) => l.text === DI.sysName(t.S, t.v.id) + ': Returned to normal set point: 30.0 psi, above low air and the P set point, supervisory clear.') && !t.S.sig.has('ha' + t.v.id) && t.v.p.pLatch === false && !/gate|target|setGate|sdrain|\.drain|airValve|\.open\b/.test(DI.bleedToNormal.toString()));
    const up = test(P30); Object.assign(up.v.p, { airSet: 50, loAir: 40, hiAir: 60 }); run(up.S, 1, 0.25); const su = DI.returnStep(up.S, up.v.id), early = up.s.ret === true; n = 0; while (!DI.returnReady(up.S, up.v.id) && n++ < 4000) up.S.step(1); run(up.S, 1000, 1); const upWait = up.s.ret === true && DI.returnStep(up.S, up.v.id).mode === 'ready', upFin = DI.returnFinish(up.S, up.v.id);
    ok('A62 a zone found below normal after a test reads "refill ... then press Finish", offers no bleed, and when the supply has brought it up it waits for Finish (it does not end by itself in 1,000 s)', early && su.mode === 'refill' && su.text === 'refill to 50 psi: leave the air supply open; then press Finish' && DI.bleedToNormal(up.S, up.v.id) === 'The pipe is already at or below normal pressure.' && upWait && upFin === '' && up.s.ret === false && up.s.P >= 46.8 && up.S.acts.filter((a) => a.kind === 'return-normal').length === 1);
    const d = dryRig(); Object.assign(d.v.p, { airSet: 30, loAir: 25, hiAir: 35 }); d.S.commission(); DI.startTest(d.S, 'leak', d.v.id); d.S.warp(86500 + DI.AIR_TEST.chargeMax); const dst = DI.returnStep(d.S, d.v.id); DI.bleedToNormal(d.S, d.v.id); run(d.S, 1, 0.25); const dFin = DI.returnFinish(d.S, d.v.id);
    ok('A62 a dry valve has no P set point: the step and its confirmation leave it out', dFin === '' && !!dst && dst.mode === 'bleed' && !/P set point/.test(dst.text) && d.s.ret === false && d.S.log.some((l) => /Returned to normal set point: 30\.0 psi, above low air, supervisory clear\.$/.test(l.text)));
    ok('A62 practice only: no goal, no contract star, no recovery score and no review finding reads the step (it files its own practice `return` result: A73)', !/'return'|rtErr|\.ret\b|returnStep/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')) && DI.SCEN.every((sc) => sc.goals.every((q) => !/return-normal|returnStep|\.ret\b/.test(q.ok.toString()))) && !/return-normal|returnStep|\.ret\b/.test(DI.recoveryScore.toString() + DI.review.toString() + DI.drillRecovery.toString()));
    DI.setJuris(new DI.World(4, 4));
  }
  // A63 Fire Tutor: the tiered recovery rating, the refill wording, the banner and the two step labels
  {
    // Cycle 6 (Fire Tutor): the rating reads "water stopped" (the alarm to the control valve closed) plus every step in order. Operator-step time is an info stat.
    const T = (waterStopped, o) => DI.recoveryTier(Object.assign({ complete: true, inOrder: true, waterStopped, opTime: 9999 }, o));
    ok('A63 the rating reads water stopped only (Cycle 7 tiers): 4 s is 3 stars, 90 s is 2, 300 s is 1; incomplete or out of order is 0', T(4) === 3 && T(60) === 3 && T(60.5) === 2 && T(90) === 2 && T(150) === 2 && T(151) === 1 && T(300) === 1 && T(4000) === 1 && T(null) === 1 && T(4, { complete: false }) === 0 && T(4, { inOrder: false }) === 0 && T(null, { complete: false }) === 0 && DI.recoveryTier(null) === 0 &&
      JSON.stringify(DI.RECOVERY_TIERS) === '[{"stars":3,"s":60},{"stars":2,"s":150}]' && typeof DI.RECOVERY_TARGET === 'undefined' && !/refill|\.time\b|opTime/.test(DI.recoveryTier.toString()));
    const dr = c5run.dr, ds = c5run.ds, line = dr.lines.find((l) => l.includes('Recovery rating:'));
    ok('A63 the c5 drill report carries the rating with its live stars as an informational line; it cannot fail the drill', DI.recoveryTier(ds) === 3 && /^★ Recovery rating: 3 of 3 stars\. Water stopped \d+ s after the alarm \(3 stars at 60 s or less, 2 at 150 s or less; any complete in-order recovery is 1; ASSUMED, informational\)\.$/.test(line) && dr.pass && !dr.lines.some((l) => /Time bonus|FAIL/.test(l)), line);
    // the same lines for a recovery that is not finished: informational, the drill result does not depend on them
    const part = rig({ gate: true }); part.S.drill = { t0: part.S.t, done: false }; DI.breakSprinkler(part.S, part.head); run(part.S, 60, 0.25); const pl = DI.drillRecovery(part.S, 'the broken sprinkler'), judged = DI.lossJudge(1e9, () => pl)(part.S);
    ok('A63 an unfinished recovery rates 0 of 3 stars and still cannot fail the drill', pl.length >= 2 && pl.every((q) => q[2] === true) && pl[1][0] === false && /^Recovery rating: 0 of 3 stars\. Water not stopped: the control valve is not closed \(3 stars at 60 s or less.*\)\.$/.test(pl[1][1]) && pl.some((q) => q[1] === 'Recovery not finished.') && judged.pass === true && judged.lines.some((l) => l.startsWith('• Recovery rating: 0 of 3 stars')));
    const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
    ok('A63 contract stars are not changed: the star formula is the Cycle 4 one and reads no recovery tier', mainSrc.includes('stars = 1 + (spent <= sc.par ? 1 : 0) + (res.loss <= (sc.drill ? 0.5 : 1) * (res.limit || 1e12) ? 1 : 0)') && !/recoveryTier|RECOVERY_TIERS|recoveryScore|opTime/.test(mainSrc));
    // Cycle 8: the refill report is two labeled lines built from the plant (DI.codeCheckLine, DI.measuredLine); only the code check is compared with the limit
    const one = rig(), oid = one.v.id, oaz = DI.airSizing(one.S, oid), ccOne = DI.codeCheckLine(one.S, oid), msOne = DI.measuredLine(one.S, oid, 732), msOver = DI.measuredLine(one.S, oid, 2040);
    one.W.byType('comp')[0].p.scfm = 0.5; const ccSmall = DI.codeCheckLine(one.S, oid), azSmall = DI.airSizing(one.S, oid);
    ok('A63 the code-check line: the largest zone alone from 0 psig against the limit, Passes with the edition cite; a compressor that is too small reads Fails with the sizing instruction', !oaz.below && ccOne === 'Code check: largest zone alone, from 0 psig: ' + oaz.tAlone.toFixed(1) + ' min. Limit 30 min (NFPA 13). Passes. [NFPA 13-2025 §8.2.7.3]' && azSmall.below &&
      ccSmall === 'Code check: largest zone alone, from 0 psig: ' + azSmall.tAlone.toFixed(1) + ' min. Limit 30 min (NFPA 13). Fails: the compressor is too small for this zone. Size it to refill the largest zone to normal pressure in 30 min. [NFPA 13-2025 §8.2.7.3]');
    ok('A63 the measured line has the same form inside the limit and over it, and no variant says FAIL; the measured line never says limit, OK or over', msOne === 'Air refill this drill, measured: 12.2 min (from partly full). Informational.' && msOver === 'Air refill this drill, measured: 34.0 min (from partly full). Informational.' &&
      [ccOne, ccSmall, msOne, msOver].every((x) => !/FAIL/.test(x)) && [msOne, msOver].every((x) => !/limit|OK|over/i.test(x)) && DI.refillLine === undefined && DI.sharedNote === undefined && dr.lines.some((l) => /^★ Code check: largest zone alone, from 0 psig: [\d.]+ min\. Limit 30 min \(NFPA 13\)\. Passes\. \[NFPA 13-2025 §8\.2\.7\.3\]$/.test(l)));
    const b = dryRig(); b.v.p.airValve = 0; run(b.S, 2, 0.25); const imp = DI.impairments(b.S)[0];
    ok('A63 the impairment banner, word for word, and still a tag with its old key', imp.text === 'IMPAIRMENT: Air / N2 supply isolated to ' + DI.sysName(b.S, b.v.id) + '. The zone cannot hold or refill air and will drift to low air. Restore the supply.' && imp.key === 'air-isolated:' + b.v.id && ![...b.S.sig.values()].some((o) => /IMPAIRMENT/.test(o.text)));
    ok('A63 steps 12 and 13, word for word; the step kinds and their order are unchanged', DI.RECOVERY.length === 13 && DI.RECOVERY[11][0] === 'reset-panel' && DI.RECOVERY[11][1] === 'Panel reset #2: clear the pressure-loss (P) latch and troubles; panel reads normal.' && DI.RECOVERY[12][0] === 'open-valve' && DI.RECOVERY[12][1] === 'Slowly open the control valve fully; confirm no flow, panel normal, supervision restored.' &&
      DI.RECOVERY.map((q) => q[0]).join() === 'silence,find-head,close-valve,isolate-air,drain-zero,reset-panel-1,replace-head,reset-valve,drain-close,restore-air,reset-trim,reset-panel,open-valve');
    const man = fs.readFileSync(path.join(__dirname, '..', 'src', 'manual.js'), 'utf8'), insp = fs.readFileSync(path.join(__dirname, '..', 'src', 'inspect.js'), 'utf8');
    ok('A63 the manual says silence is not reset, in the step list and in the recovery paragraph; the main-drain tip is a paragraph with no act behind it', (man.match(/Silence is not reset: it acknowledges the sound and clears nothing\./g) || []).length === 2 && /B\.p\('Tip: ' \+ DI\.MDT_LINE \+ ' The code requires a valve status test after a control valve is reopened \(' \+ DI\.REF25\.valveStatusShort \+ '\)\.'\)/.test(insp) && DI.REF25.valveStatusShort === 'NFPA 25-2023 §13.3.3.4' && DI.MDT_LINE.startsWith('Company practice. ') && !/MDT_LINE/.test(DI.recoveryScore.toString()));
    DI.setJuris(new DI.World(4, 4));
  }
  // A64 practice: reopening on a zone with a head open lets the water in, then the log explains it once
  {
    // Cycle 6: the line carries the flow and the skipped steps (A89 holds the wording and the banner)
    const LINE = /^Water entered the zone through the open head \(about \d+ gpm\) because the control valve was reopened before the recovery was done\. Skipped: .*In a data hall this is water on the IT load\.$/;
    const said = (r) => r.S.log.filter((l) => LINE.test(l.text)).length, acted = (r) => r.S.acts.filter((a) => a.kind === 'reopen-flood').length;
    // a tripped zone with one head open, the control valve shut on it
    const tripped = (drill) => { const r = rig({ gate: true }); if (drill) r.S.drill = { t0: r.S.t, done: false }; DI.breakSprinkler(r.S, r.head); run(r.S, 60, 0.25); smoke(r.S, 0.2, 10); r.S.smoke[1] = 0; run(r.S, 20, 0.25); R.shut(r); run(r.S, 10, 0.25); return r; };
    const a = tripped(), pre = said(a) === 0 && acted(a) === 0 && a.s.state !== 'dry' && a.s.openK.length === 1, m = DI.setGate(a.S, a.g.id, 1), watch = a.s.floodW !== undefined, warned = a.S.acts.filter((q) => q.kind === 'reopen-warn').length;
    run(a.S, 30, 0.25); const once = said(a) === 1 && acted(a) === 1 && a.s.floodW === undefined && a.s.qOut > 1; run(a.S, 30, 0.25);
    ok('A64 practice: reopening a tripped zone with an open head warns, opens, and when water flows the log explains it, once', pre && m === '' && watch && warned === 1 && once && said(a) === 1 && acted(a) === 1 && a.g.p.open > 0.99 && a.S.log.find((l) => LINE.test(l.text)).cls === 'warn' && a.S.acts.find((q) => q.kind === 'reopen-flood').id === a.v.id);
    R.shut(a); run(a.S, 10, 0.25); DI.setGate(a.S, a.g.id, 1); run(a.S, 30, 0.25);
    ok('A64 it is logged once per reopen: a second reopening logs it a second time', said(a) === 2 && acted(a) === 2);
    const b = tripped(); DI.setGate(b.S, b.g.id, 1); const set = b.s.floodW !== undefined; DI.setGate(b.S, b.g.id, 0); const cleared = b.s.floodW === undefined; run(b.S, 30, 0.25);
    ok('A64 closing the valve before any water flows ends the watch: nothing is logged', set && cleared && said(b) === 0 && acted(b) === 0);
    // P latched and a head open, the valve not tripped: the reopening lets nothing in; a later detection does
    const c = rig({ gate: true }); DI.breakSprinkler(c.S, c.head); run(c.S, 60, 0.25); R.shut(c); DI.setGate(c.S, c.g.id, 1); run(c.S, 30, 0.25); const held = said(c) === 0 && c.s.floodW !== undefined && c.s.state === 'dry' && c.v.p.pLatch; smoke(c.S, 0.2, 10); run(c.S, 30, 0.25);
    ok('A64 reopened with P latched and a head open: no water, no line; when detection then trips the valve the line comes', held && said(c) === 1 && acted(c) === 1);
    const e = rig({ gate: true }); R.shut(e); DI.setGate(e.S, e.g.id, 1); run(e.S, 10, 0.25);
    ok('A64 a ready zone is not watched', e.s.floodW === undefined && said(e) === 0 && !e.S.acts.some((q) => q.kind === 'reopen-warn'));
    const d = tripped(true), md = DI.setGate(d.S, d.g.id, 1); run(d.S, 30, 0.25);
    ok('A64 the scored drill incident keeps its hard stop: refused, the valve stays shut, and the line is never logged', md !== '' && d.g.p.target === 0 && d.s.floodW === undefined && said(d) === 0 && acted(d) === 0);
    ok('A64 the watch is saved with the game, and the recovery score does not read the entry', DI.SS_KEYS.includes('floodW') && DI.SS_KEYS.includes('floodK') && !/reopen-flood|floodW/.test(DI.recoveryScore.toString()) && /S\.act\('reopen-flood', id, \{ gpm: qOut \}\)/.test(DI.gasPost.toString()));
  }
  // A65 utility power and the delay clocks are saved with the game
  {
    const reload = (r, edit) => { const jw = JSON.parse(JSON.stringify(r.W.toJSON())), js = JSON.parse(JSON.stringify(r.S.dump())); if (edit) edit(jw, js); const W = DI.World.fromJSON(jw), S = new DI.Sim(W); S.restore(js); return { W, S, pn: W.parts.get(r.pn.id), v: W.parts.get(r.v.id), s: S.ss.get(r.v.id) }; };
    const r = rig(); run(r.S, 10, 1); r.W.power = false; r.S.step(1); const key = 'ac' + r.pn.id, t0 = r.S.sig.get(key).t0; DI.silence(r.S, r.pn.id); r.S.warp(1800); const tSave = r.S.t, bh = r.pn.p.battH;
    const q = reload(r), o = q.S.sig.get(key), seen = q.S.sigSeen instanceof Map && q.S.sigSeen.has(key);
    ok('A65 utility power off survives save and load, with the AC-fail trouble still pending on its original clock', q.W.power === false && Math.abs(q.S.t - tSave) < 1e-6 && !!o && o.t0 === t0 && o.tx === false && o.delay === 3600 && seen && Math.abs(q.pn.p.battH - bh) < 1e-9 && r.S.sig.get(key).tx === false && tSave - t0 > 1700);
    q.S.step(1); const l1 = q.S.log.map((l) => l.text).join('\n');
    ok('A65 a restored signal is not announced again, a silenced panel stays silenced, and sigSeen is dropped after the first step', q.S.sigSeen === null && !/PANEL AC FAIL|LOSS OF SUPPLY AIR/.test(l1) && q.pn.p.silenced === true && q.S.sig.get(key).t0 === t0);
    q.S.warp(1700); while (q.S.t < t0 + 3599) q.S.step(1); const held = q.S.sig.get(key).tx === false; q.S.step(1);
    ok('A65 the AC failure is transmitted at the original absolute time, not 60 min after the load', held && q.S.sig.get(key).tx === true && q.S.t === t0 + 3600 && q.S.log.filter((l) => l.text.startsWith('Supervising station notified: PANEL AC FAIL')).length === 1 && q.S.t - tSave < 1900);
    const q2 = reload({ W: q.W, S: q.S, pn: q.pn, v: q.v }); q2.S.step(1); run(q2.S, 5, 1);
    ok('A65 saved after the transmission, it is not transmitted or announced a second time', q2.S.sig.get(key).tx === true && q2.S.sig.get(key).t0 === t0 && !q2.S.log.some((l) => /Supervising station notified|PANEL AC FAIL/.test(l.text)));
    const d = rig(); run(d.S, 10, 1); d.W.power = false; d.pn.p.battH = 0; d.S.step(1); const dT = d.pn.p.deadT; d.S.warp(1000); const e = reload(d), pk = 'pd' + d.pn.id;
    const kept = e.W.power === false && e.pn.p.alive === false && e.pn.p.deadT === dT && !e.S.sig.has(pk); e.S.warp(2000); while (e.S.t < dT + 3599) e.S.step(1); const notYet = !e.S.sig.has(pk); e.S.step(1);
    ok('A65 a dead panel keeps the time it died: the loss-of-communication line appears at the original time', kept && notYet && e.S.sig.has(pk) && e.S.sig.get(pk).t0 === dT + 3600 && e.S.sig.get(pk).lost);
    const f = reload({ W: e.W, S: e.S, pn: e.pn, v: e.v }); f.S.step(1); run(f.S, 5, 1);
    ok('A65 saved with the station line present, the line comes back without being announced again', f.S.sig.has(pk) && f.S.sig.get(pk).t0 === dT + 3600 && !f.S.log.some((l) => /LOSS OF COMMUNICATION/.test(l.text)) && f.pn.p.deadT === dT);
    const c = rig(); c.W.cfg.commPath = 'dact'; run(c.S, 10, 1); c.pn.p.chan = [0, 1]; c.S.step(1); const ct = c.S.sig.get('dc' + c.pn.id).t0; run(c.S, 100, 1); const h = reload(c); h.S.step(1); while (h.S.t < ct + 239) h.S.step(1); const c239 = h.S.sig.get('dc' + c.pn.id).tx === false; h.S.step(1);
    ok('A65 the DACT 4-minute timer carries across a load too', h.pn.p.chan.join() === '0,1' && c239 && h.S.sig.get('dc' + c.pn.id).tx === true && h.S.t === ct + 240);
    // seconds of standby left at the save: the settle of the load must not run the battery out and drop the panel's latches
    const lowB = rig(); smoke(lowB.S, 0.2, 10); lowB.S.smoke[1] = 0; run(lowB.S, 20, 1); lowB.W.power = false; lowB.pn.p.battH = 9 / 3600; lowB.S.step(1); const bh0 = lowB.pn.p.battH, latched = lowB.v.p.sol === true && lowB.d.p.lvl === 3 && lowB.pn.p.alive === true;
    const lw = reload(lowB), ld = lw.W.parts.get(lowB.d.id), atLoad = lw.pn.p.alive !== false && lw.pn.p.deadT === undefined && Math.abs(lw.pn.p.battH - bh0) < 1e-12 && lw.v.p.sol === true && ld.p.lvl === 3; lw.S.step(0.25);
    ok('A65 saved with seconds of battery left and D latched: the load does not run the battery down, the panel is still alive and the latch is kept', latched && atLoad && lw.pn.p.alive === true && lw.v.p.sol === true && ld.p.lvl === 3 && lw.S.sig.has('v' + lowB.d.id + '.3') && lw.S.settling === false && (run(lw.S, 10, 1), lw.pn.p.alive === false && lw.v.p.sol === false));
    const oldS = reload(r, (jw, js) => { delete jw.power; delete js.sig; });
    ok('A65 a save with no power field and no sig field loads as before: utility power on, no stored clocks', oldS.W.power === true && oldS.S.sigSeen === undefined && !oldS.S.sig.has(key) && !('power' in JSON.parse(JSON.stringify({ a: undefined }))) && r.W.toJSON().power === false && Array.isArray(r.S.dump().sig));
    DI.setJuris(new DI.World(4, 4));
  }
  // A66 (extends A42) the El/Pn dead panel: matrix and engine agree, driven on a rig
  {
    const V = (r, vec) => DI.ceEval(r.W, r.v, vec), rowOf = (r, k) => DI.ceMatrix(r.S, r.v.id).rows.find((q) => q.key === k);
    const pn = rig({ props: { trim: 'el-pn' } }); pn.W.power = false; pn.pn.p.battH = 0; run(pn.S, 2, 0.25); breakHead(pn); smoke(pn.S, 0.2, 10);
    const eD = V(pn, { fire1: true, p: true, power: 'Dead' }), plS = pn.S.sig.get('pl' + pn.v.id), dr = rowOf(pn, 'fire1+p, panel dead'), pe = eD.signals.find((q) => q.key === 'pLatch');
    ok('A66 El/Pn, panel dead, Fire 1 and P: no sol, no pull, no Manual Release latch, the valve does not open; P is held at the actuator and is not a panel output', pn.pn.p.alive === false && pn.s.P < pn.v.p.pTrip && pn.v.p.pLatch === true && pn.v.p.sol === false && pn.v.p.pull === false && pn.v.p.mrzL === false && pn.v.p.solOut === false && pn.s.state === 'dry' && pn.s.wat === 0 && !pn.v.p.tripped &&
      !!plS && plS.dark === true && plS.mon === false);
    ok('A66 the matrix says the same: D false, P true, no solenoid, no release, nothing annunciated or transmitted but the station’s own line', eD.D === false && eD.P === true && eD.sol === false && eD.open === false && eD.nac === false && eD.fd === false && !!pe && pe.annunciated === false && pe.transmit === false && eD.signals.filter((q) => q.transmit).map((q) => q.key).join() === 'lostComm' &&
      dr.live === true && dr.sol === false && dr.open === false && dr.cells[6] === 'no: a dead panel energizes nothing' && dr.cells[3] === 'dark: nothing displayed' && DI.relState(pn.W, pn.v).D === eD.D && DI.relState(pn.W, pn.v).P === eD.P && DI.relState(pn.W, pn.v).open === eD.open && DI.relState(pn.W, pn.v).sol === eD.sol);
    const H = DI.panelHolds('el-pn', false, true);
    ok('A66 one rule: a dead El/Pn panel holds no D and no zone latch, and P stays at the pneumatic actuator', H.sol === false && H.pull === false && H.mrzL === false && H.pLatch === true && DI.panelHolds('el-el', false, true).pLatch === false);
    pn.pn.p.battH = 24; pn.W.power = true; smoke(pn.S, 0.2, 5);
    ok('A66 power back with detection still at Fire 1 and P still at the actuator: the inputs release, as they should', pn.pn.p.alive === true && pn.v.p.sol === true && pn.s.tripT > 0);
    const al = rig({ props: { trim: 'el-pn' } }); smoke(al.S, 0.2, 10); const e1 = V(al, { fire1: true }), dOnly = al.v.p.sol === true && al.v.p.solOut === true && al.s.state === 'dry' && al.s.wat === 0; breakHead(al); const e2 = V(al, { fire1: true, p: true });
    ok('A66 El/Pn, panel alive: the solenoid energizes on D alone and water flows only with P at the actuator; the matrix agrees', dOnly && e1.sol === true && e1.open === false && rowOf(al, 'fire1').cells[6] === 'yes: ENERGIZED; valve opens only with P' && al.v.p.pLatch === true && al.s.tripT > 0 && e2.sol === true && e2.open === true && rowOf(al, 'fire1+p').cells[6] === 'yes: ENERGIZED, valve opens');
    const ee = rig(); ee.W.power = false; ee.pn.p.battH = 0; run(ee.S, 2, 0.25); breakHead(ee); smoke(ee.S, 0.2, 10); const e3 = V(ee, { fire1: true, p: true, power: 'Dead' });
    ok('A66 El/El, panel dead: no output at all, and the P latch is gone with the panel, as before', ee.v.p.pLatch === false && ee.v.p.sol === false && ee.v.p.solOut === false && ee.s.state === 'dry' && e3.D === false && e3.P === false && e3.open === false && e3.sol === false && !ee.S.sig.has('pl' + ee.v.id));
  }
  // A67 regression: the company locks
  {
    ok('A67 the truth-table runner is 17 of 17 and the fixture is the pinned file', resTT.length === 17 && resTT.every((q) => q.ok) && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && TT.FIXTURE_SHA16 === 'cb3462b268359c6e');
    const f2 = rig(); smoke(f2.S, 1.5, 30);
    ok('A67 Fire 2 never releases alone: with no P the valve stays shut and the El/El solenoid stays off', f2.d.p.lvl === 4 && f2.v.p.sol === true && f2.v.p.pLatch === false && f2.v.p.solOut === false && f2.s.state === 'dry' && f2.s.wat === 0 && !/lvl >= 4/.test(DI.alarmStep.toString()));
    const la = rig(); la.v.p.airValve = 0; la.s.holes = 400; let n = 0; while (!la.S.sig.has('la' + la.v.id) && n++ < 4000) la.S.step(1); run(la.S, 60, 1);
    ok('A67 a low-air crossing never releases: supervisory only, the valve stays shut', la.S.sig.get('la' + la.v.id).type === 'SUPV' && la.s.state === 'dry' && la.s.tripT < 0 && la.v.p.sol === false && !/loAir|lowAir/.test(DI.relState.toString()));
    const p = rig(); p.v.p.sdrain = 1; p.S.touch(); run(p.S, 20, 0.25); const prow = DI.ceMatrix(p.S, p.v.id).rows.find((q) => q.key === 'p'), psch = DI.signalSchedule(p.W).find((q) => q.key === 'pLatch');
    ok('A67 P on El/El reads OPEN in the matrix and in the schedule, never supervisory', p.v.p.pLatch === true && p.S.sig.get('pl' + p.v.id).type === 'OPEN' && prow.class === 'OPEN' && prow.cells[2] === 'OPEN - class not elected, never supervisory' && psch.class === 'OPEN' && psch.ss === 'Not elected' && !DI.SIG_CLASS.pLatch.includes('SUPV'));
    ok('A67 hooks default OFF and never act; Canada is still hidden and its NFPA 72 setting ignored', DI.hvacHook(new DI.World(4, 4)) === 'none' && DI.epoHook(new DI.World(4, 4)) === false && DI.editionChoices().join() === 'US-2019,US-2022,US-2025' && DI.JURIS['CA-2019'].hidden === true && DI.ed72({ cfg: { edition: 'CA-2019', ed72: '2025' } }) === 2019);
    const head = fs.readFileSync(path.join(__dirname, '..', 'src', 'alarm.js'), 'utf8').split('\n').slice(0, 30).join('\n');
    ok('A67 DI.relState and the D logic at the top of alarm.js are byte-identical to the Cycle 4 baseline (8bd06e4)', sha16(DI.relState.toString()) === 'a19f3e39ec09d52e' && sha16(head) === '1581435a5c3a9485', sha16(DI.relState.toString()) + ' ' + sha16(head));
  }
  const c6 = {};          // rigs kept between the Cycle 6 blocks
  // ====================== Cycle 6 acceptance (A68 onward: drain realism and the return-to-normal gate, the AVC as its
  // own device, DACT retries / hold and send / restore order, the 24 h trouble resound, battery and standby, the Fire 2
  // HVAC trigger and the manual labels, water stopped and step 14, the Tutor wording, the refrigerated flag, persistence).
  // Every case is driven on a rig; nothing is copied from the fixture.
  // a preaction zone left above its normal pressure by a passed 24 h air test: the return-to-normal step is pending (bleed mode)
  const retRig = (props, o) => { const r = rig(Object.assign({ gate: true, props: Object.assign({ airSet: 30, loAir: 25, hiAir: 35 }, props) }, o)); DI.startTest(r.S, 'leak', r.v.id); r.S.warp(86500 + DI.AIR_TEST.chargeMax); return r; };
  const errs = (r) => r.s.rtErr.map((e) => e.why).join(), coached = (r) => r.S.acts.filter((a) => a.kind === 'return-coach').length;
  const drain = (r, key, on, sec, dt) => { r.v.p[key] = on; r.S.touch(); if (sec) run(r.S, sec, dt || 0.25); };
  const refillTo = (r, psi) => { let n = 0; while (r.s.P < psi && n++ < 200000) r.S.step(0.25); return r.s.P >= psi; };
  const banners = []; DI.bus.on('banner', (t) => banners.push(t));
  // A68 the main drain is on the supply side: it never moves system air
  {
    const r = retRig(), P0 = r.s.P, G0 = r.s.G, pin0 = r.S.pin(r.v.id), pre = r.s.ret === true && P0 > 38 && DI.returnStep(r.S, r.v.id).mode === 'bleed';
    drain(r, 'drain', 1, 60); const q = DI.mdrainFlow(r.S, r.v.id);
    ok('A68 main drain open 60 s with the control valve open: supply water flows, supply pressure drops, and the system gauge and gas do not move', pre && Math.abs(r.s.P - P0) < 0.01 && Math.abs(r.s.G - G0) / G0 < 1e-4 && q > 100 && r.S.pin(r.v.id) < pin0 - 2 && !r.s.lowAir && r.v.p.pLatch === false && r.s.ret === true && r.s.state === 'dry' && r.s.wat === 0, 'flow ' + q.toFixed(0) + ' gpm, supply ' + pin0.toFixed(0) + ' -> ' + r.S.pin(r.v.id).toFixed(0) + ' psi, system ' + P0.toFixed(2) + ' -> ' + r.s.P.toFixed(2));
    const c = retRig(); DI.setGate(c.S, c.g.id, 0); run(c.S, 8, 0.25); const cP = c.s.P; drain(c, 'drain', 1, 30);
    ok('A68 with the control valve closed the main drain flows nothing, moves no air and scores nothing', DI.mdrainFlow(c.S, c.v.id) < 0.5 && Math.abs(c.s.P - cP) < 0.01 && c.s.rtErr.length === 0 && c.s.ret === true);
    ok('A68 static: the main drain emitter is on the valve inlet with no system, and only the system drain is in the gas balance', /p\.p\.drain && r\[0\] >= 0\) em\.push\(\{ raw: r\[0\], K: 32 \* p\.p\.drain, kind: 'mdrain', k, sys: 0 \}\)/.test(DI.buildGraph.toString()) && /v\.p\.sdrain\) big \+= 1\.5 \* v\.p\.sdrain/.test(DI.gasPre.toString()) && !/\.drain\b/.test(DI.gasPre.toString().replace(/sdrain/g, '')));
  }
  // A69 the system drain bleeds, fast and coarse, and overshoots: one error for the whole event
  {
    const r = retRig(), t0 = r.S.t, P0 = r.s.P; r.v.p.sdrain = 1; r.S.touch(); let n = 0, atLow = null, band = null;
    while (!r.v.p.pLatch && n++ < 5000) { r.S.step(0.02); if (band === null && r.s.P <= 31 && r.s.P >= 26.8) band = errs(r); if (!atLow && r.s.lowAir) atLow = { t: r.S.t - t0, e: errs(r), sig: r.S.sig.has('la' + r.v.id) || true }; }
    const tP = r.S.t - t0, rate = (P0 - r.s.P) / tP;
    ok('A69 system drain open: pressure falls about 17 psi a second (10 to 30), crosses low air in under 2 s and P in under 3 s', rate > 10 && rate < 30 && !!atLow && atLow.t < 2 && tP < 3 && r.v.p.pLatch === true, rate.toFixed(1) + ' psi/s, low air at ' + (atLow && atLow.t.toFixed(2)) + ' s, P at ' + tP.toFixed(2) + ' s');
    ok('A69 one coaching line and one error: passing through the band with the drain open scores nothing (Cycle 7), then the low-air entry is raised to the P latch, never doubled', coached(r) === 1 && band === '' && atLow.e === 'low-air' && errs(r) === 'p-latch' && r.s.rtErr.length === 1 && r.S.log.filter((l) => l.text === DI.RT_COACH).length === 1 && r.S.log.some((l) => l.text.startsWith('One fire signal from flow: P latched on ') && l.cls === 'bad') && r.S.log.some((l) => /: P latched \(/.test(l.text)));
    run(r.S, 2, 0.25); ok('A69 the low-air supervisory is in and nothing released: no water, the valve is still set', r.S.sig.has('la' + r.v.id) && r.S.sig.get('la' + r.v.id).type === 'SUPV' && r.s.state === 'dry' && r.s.wat === 0 && r.v.p.sol === false);
    drain(r, 'sdrain', 0); const back = refillTo(r, 27.5); run(r.S, 5, 0.25);
    ok('A69 closing the drain and refilling adds no second error, and the step is still pending', back && r.s.rtErr.length === 1 && errs(r) === 'p-latch' && r.s.rtEv === null && r.s.ret === true && coached(r) === 1);
    c6.over = r;
  }
  // A70 coaching only: a drain opened and closed before anything comes of it
  {
    const r = retRig(); r.v.p.sdrain = 1; r.S.touch(); r.S.step(0.02); r.v.p.sdrain = 0; r.S.touch(); run(r.S, 2, 0.25);
    ok('A70 the system drain opened and closed before pressure is below normal: one return-coach entry with the exact text, no error', coached(r) === 1 && r.s.rtErr.length === 0 && r.s.P > r.v.p.airSet + 1 && r.s.ret === true && r.S.log.filter((l) => l.text === DI.RT_COACH && l.cls === 'warn').length === 1 &&
      DI.RT_COACH === 'Use the trim air bleed to trim down to normal. Drains dump air too fast or flow supply water.');
    const c = retRig(); DI.setGate(c.S, c.g.id, 0); run(c.S, 8, 0.25); drain(c, 'drain', 1, 5); drain(c, 'drain', 0, 2);
    ok('A70 the same for a main drain opened with the control valve closed', coached(c) === 1 && c.s.rtErr.length === 0 && c.s.ret === true);
    const z = rig(); drain(z, 'sdrain', 1, 0.5, 0.02); drain(z, 'drain', 1, 2);
    ok('A70 a zone that is not in the post-test step is never coached and never scored', coached(z) === 0 && !(z.s.rtErr && z.s.rtErr.length) && !z.S.log.some((l) => l.text === DI.RT_COACH));
  }
  // A71 supply water out of the main drain is one error per opening; the Tests-button main drain test is none
  {
    const r = retRig(); drain(r, 'drain', 1, 2); const one = errs(r); run(r.S, 30, 0.25); const still = errs(r); drain(r, 'drain', 0, 5); drain(r, 'drain', 1, 5);
    ok('A71 main drain opened by hand with the control valve open: one main-drain-flow error, not repeated per tick, and again on a second opening', one === 'main-drain-flow' && still === 'main-drain-flow' && errs(r) === 'main-drain-flow,main-drain-flow' && coached(r) === 2 && r.s.ret === true);
    const t = retRig(), m = DI.startTest(t.S, 'drain', t.v.id); let n = 0; while (t.S.procs.length && n++ < 2000) t.S.step(0.25); const res = DI.lastResult(t.S, 'drain', t.v.id);
    ok('A71 the Tests-button main drain test records no error and no coaching, and the step is still pending', m === '' && !!res && t.s.rtErr.length === 0 && coached(t) === 0 && t.s.ret === true && t.v.p.drain === 0);
  }
  // A72 trying to complete with a drain open (Cycle 7: a refused Finish is the error; nothing is scored by itself)
  {
    const r = retRig(); r.v.p.sdrain = 1; DI.bleedToNormal(r.S, r.v.id); r.S.touch(); r.S.step(0.02);
    const held = r.s.ret === true && r.s.P <= 31 && r.s.P >= 26.8 && errs(r) === '' && r.v.p.pLatch === false && !r.s.lowAir && r.v.p.airValve === 1 && !r.v.p.avcBy && !DI.returnReady(r.S, r.v.id);
    const m1 = DI.returnFinish(r.S, r.v.id), one = errs(r) === 'finish-early' && r.s.ret === true && r.s.rtErr[0].miss.join() === 'a drain is open', pend = DI.lastResult(r.S, 'return', r.v.id), open = !!pend && pend.open === true && pend.pass === false;
    r.v.p.sdrain = 0; r.S.touch(); r.S.step(0.02); const m2 = DI.returnFinish(r.S, r.v.id), res = DI.lastResult(r.S, 'return', r.v.id);
    ok('A72 in band, supply open, bypass closed, P clear, system drain open: no error by itself; Finish is refused and scored once, naming the drain; with the drain closed Finish ends the step and the result keeps the one error', held && m1 === 'Finish was pressed before the zone was ready: a drain is open. Close every drain. Bring air into the normal band, above low air and above the P set point. Reset the panel to clear the pressure-loss (P) latch. Clear any supervisory signal (low air, high air, AVC bypass, valve off normal). Then press Finish.' && one && open && m2 === '' && r.s.ret === false && !!res && res === pend && !res.open && res.pass === false && res.lines.length === 2 && res.lines[0].endsWith(m1) && res.lines[1] === DI.rtPressLine(1, 1) && !/drain-open|finish-early/.test(res.lines.join(' ')) && r.S.results.filter((q) => q.kind === 'return').length === 1 && r.S.log.some((l) => l.text === DI.sysName(r.S, r.v.id) + ': ' + m1 && l.cls === 'warn'), m1);
    const c = retRig(); DI.setGate(c.S, c.g.id, 0); run(c.S, 8, 0.25); c.v.p.drain = 1; c.S.touch(); DI.bleedToNormal(c.S, c.v.id); run(c.S, 3, 0.25); const txt = DI.returnStep(c.S, c.v.id).text;
    ok('A72 a drain open never lets the step be ready: the main drain too, and the text says what is left', c.s.ret === true && !DI.returnReady(c.S, c.v.id) && /close every drain/.test(txt) && /control valve off normal/.test(txt) && /then press Finish return to normal$/.test(txt));
  }
  // A73 the clear gate: P reset, no supervisory, AVC regulating, control valve normal, every drain closed, in band
  {
    const r = c6.over, st = DI.returnStep(r.S, r.v.id);
    ok('A73 after an overshoot that latched P, a refill into the band does not clear the step: the text says reset P at the panel', r.s.ret === true && r.s.P >= 26.8 && r.s.P <= 31 && r.v.p.pLatch === true && st.mode === 'confirm' && /still to do: reset P at the panel, then press Finish return to normal$/.test(st.text), st.text);
    const m = DI.panelReset(r.S, r.pn.id); run(r.S, 1, 0.25); const wait73 = r.s.ret === true && DI.returnReady(r.S, r.v.id), fin73 = DI.returnFinish(r.S, r.v.id), res = DI.lastResult(r.S, 'return', r.v.id), act = r.S.acts.filter((a) => a.kind === 'return-normal');
    ok('A73 El/El: the panel reset clears P, the step is then ready and Finish ends it; the Return to normal result has one line for the one error, in the Tutor’s words with no internal tag, and does not pass', m === '' && r.v.p.pLatch === false && wait73 && fin73 === '' && r.s.ret === false && !!res && res.kind === 'return' && res.pass === false && res.title === 'Return to normal' && res.lines.length === 1 &&
      res.lines[0].endsWith(' Pressure fell to the trip point, so the panel latched the pressure-loss input. With detection also active, both release conditions were met and the valve would release. Restore air above low air before panel reset #2.') && !/p-latch|low-air/.test(res.lines[0]) && act.length === 1 && act[0].err === 1 && act[0].errs.length === 1 && act[0].errs[0].why === 'p-latch' && r.s.rtErr.length === 0 && r.s.rtEv === null && JSON.stringify(r.s.rtDr) === '{}', res && res.lines[0]);
    const pn = retRig({ trim: 'el-pn' }); drain(pn, 'sdrain', 1, 2, 0.02); drain(pn, 'sdrain', 0); refillTo(pn, 27.5); DI.panelReset(pn.S, pn.pn.id); run(pn.S, 2, 0.25);
    const heldPn = pn.s.ret === true && pn.v.p.pLatch === true && /reset P at the trim/.test(DI.returnStep(pn.S, pn.v.id).text) && !DI.returnReady(pn.S, pn.v.id); DI.resetTrimP(pn.S, pn.v.id); run(pn.S, 1, 0.25); const pnFin = DI.returnFinish(pn.S, pn.v.id);
    ok('A73 El/Pn: a panel reset is not enough, the actuator reset at the trim clears P and Finish is then accepted', heldPn && pnFin === '' && pn.s.ret === false && pn.v.p.pLatch === false && DI.lastResult(pn.S, 'return', pn.v.id).pass === false);
    const hold = (mut, undo, word) => { const q = retRig(); mut(q); DI.bleedToNormal(q.S, q.v.id); q.S.step(0.25); const t = (DI.returnStep(q.S, q.v.id) || {}).text || '', h = q.s.ret === true && t.includes(word); undo(q); DI.bleedToNormal(q.S, q.v.id); run(q.S, 2, 0.25); const fin = DI.returnFinish(q.S, q.v.id); return h && fin === '' && q.s.ret === false; };
    ok('A73 a high-air zone, an open AVC bypass and a control valve off normal each hold the step, and Finish is accepted when each is put right', hold((q) => { q.v.p.hiAir = 29; }, (q) => { q.v.p.hiAir = 35; }, 'high air') && hold((q) => { q.v.p.avcBy = 1; }, (q) => { q.v.p.avcBy = 0; }, 'AVC bypass is open') &&
      hold((q) => { DI.setGate(q.S, q.g.id, 0); run(q.S, 6, 0.25); }, (q) => { DI.setGate(q.S, q.g.id, 1); run(q.S, 6, 0.25); }, 'control valve off normal') && hold((q) => { q.v.p.airValve = 0; }, (q) => { q.v.p.airValve = 1; }, 'open the air supply'));
    const clean = retRig(); DI.bleedToNormal(clean.S, clean.v.id); run(clean.S, 1, 0.25); const cFin = DI.returnFinish(clean.S, clean.v.id), cr = DI.lastResult(clean.S, 'return', clean.v.id);
    ok('A73 a clean return (the trim bleed, no drain, then Finish) passes with the Tutor’s clean-pass sentence; the bleed is never an error', cFin === '' && clean.s.ret === false && !!cr && cr.pass === true && cr.lines.length === 1 && cr.lines[0] === DI.RT_CLEAN && coached(clean) === 0 && clean.S.acts.find((a) => a.kind === 'return-normal').err === 0);
    const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
    ok('A73 practice only: the contract star formula is unchanged, and no goal reads the result', mainSrc.includes('stars = 1 + (spent <= sc.par ? 1 : 0) + (res.loss <= (sc.drill ? 0.5 : 1) * (res.limit || 1e12) ? 1 : 0)') && !/rtErr|'return'/.test(mainSrc) && DI.SCEN.every((sc) => sc.goals.every((q) => !/rtErr|'return'|return-normal/.test(q.ok.toString()))));
  }
  // A74 the 1.5 psi pass line is an absolute value at every test pressure
  {
    const V = (a) => ({ p: { airSet: a } }), src = DI.testStep.toString();
    ok('A74 the pass line is the test pressure less 1.5 psi exactly at 40, 45 and 52 psi, and nothing scales it', DI.airTestEnd(V(40)) === 38.5 && DI.airTestEnd(V(45)) === 43.5 && DI.airTestEnd(V(52)) === 50.5 && DI.AIR_TEST.drop === 1.5 && /endMin = T - A\.drop/.test(src) && !/\/ ?(T|pr\.psi|A\.psi|DI\.airTestPsi)\b/.test(src) && !/drop \* ?(T|pr\.psi)|A\.drop \*/.test(src));
  }
  // A75 the AVC is its own device
  {
    const r = rig(), id = r.v.id; r.v.p.avcBy = 1; r.S.warp(1200); const tags = DI.impairments(r.S).filter((x) => x.id === id);
    ok('A75 bypass open with the supply valve open: the zone climbs to 60 psi (no cut-out), HIGH AIR comes in, and the impairment tag shows', Math.abs(r.s.P - DI.AVC_BYPASS_PSI) < 0.5 && DI.AVC_BYPASS_PSI === 60 && r.S.sig.has('ha' + id) && r.S.sig.get('ha' + id).type === 'SUPV' && tags.length === 1 && tags[0].key === 'avc-bypass:' + id &&
      tags[0].text === 'IMPAIRMENT: AVC bypass open on ' + DI.sysName(r.S, id) + '. The air maintenance device is not regulating: pressure will climb toward the compressor cut-out. Close the bypass.' && ![...r.S.sig.values()].some((o) => /IMPAIRMENT|AVC/.test(o.text)) && r.v.p.pLatch === false && r.s.state === 'dry', 'P=' + r.s.P.toFixed(1));
    const c = rig(); c.W.byType('comp')[0].p.cutOut = 55; c.v.p.avcBy = 1; c.S.warp(1200); const d = rig(); d.W.byType('comp')[0].p.cutOut = 45; d.v.p.avcBy = 1; d.S.warp(1200);
    ok('A75 with a compressor cut-out the bypass takes the zone to the cut-out: 55 psi is past high air, 45 psi is not', Math.abs(c.s.P - 55) < 0.5 && c.S.sig.has('ha' + c.v.id) && d.s.P > 44 && d.s.P <= 45.01 && !d.S.sig.has('ha' + d.v.id));
    r.v.p.avcBy = 0; run(r.S, 5, 1); const stays = r.S.sig.has('ha' + id) && DI.impairments(r.S).length === 0, m = DI.bleedToNormal(r.S, id); run(r.S, 2, 1);
    ok('A75 closing the bypass removes the tag; the pipe stays high until it is bled at the trim, which is never an error', stays && m === '' && Math.abs(r.s.P - 40) < 0.5 && !r.S.sig.has('ha' + id));
    const iso = rig(); iso.v.p.airValve = 0; iso.s.holes = 400; let n = 0; while (!iso.S.sig.has('la' + iso.v.id) && n++ < 4000) iso.S.step(1); const it = DI.impairments(iso.S);
    ok('A75 the supply valve closed with the bypass closed is a different state: the isolated-supply tag, and low air later', it.length === 1 && it[0].key === 'air-isolated:' + iso.v.id && iso.S.sig.has('la' + iso.v.id) && !iso.S.sig.has('ha' + iso.v.id));
    const both = rig(); both.v.p.airValve = 0; both.v.p.avcBy = 1; run(both.S, 2, 1);
    ok('A75 both at once are two tags, and neither is a signal', DI.impairments(both.S).map((x) => x.key.split(':')[0]).join() === 'air-isolated,avc-bypass' && ![...both.S.sig.values()].some((o) => /IMPAIRMENT/.test(o.text)));
    const rt = (a, b) => { const q = rig(); q.v.p.airValve = a; q.v.p.avcBy = b; const W2 = DI.World.fromJSON(JSON.parse(JSON.stringify(q.W.toJSON()))); return W2.parts.get(q.v.id).p.airValve + '/' + W2.parts.get(q.v.id).p.avcBy; };
    const oldV = DI.migratePart({ id: 1, type: 'prev', x: 0, y: 0, rot: 0, p: { trim: 'el-el', airSet: 40, hiAir: 50, loAir: 30, pTrip: 20, airValve: 1 } }), oldD = DI.migratePart({ id: 2, type: 'dryv', x: 0, y: 0, rot: 0, p: { airSet: 40, hiAir: 50, loAir: 30 } });
    ok('A75 the two props are independent in save and load; an old save gets an AVC with its bypass closed', rt(1, 1) === '1/1' && rt(0, 0) === '0/0' && rt(0, 1) === '0/1' && oldV.p.avc === 1 && oldV.p.avcBy === 0 && oldD.p.avc === 1 && oldD.p.avcBy === 0 && DI.PARTS.prev.props.avc === 1 && DI.PARTS.dryv.props.avcBy === 0);
    const bad = []; for (const sc of DI.SCEN) { if (!DI.BOT[sc.id]) continue; const q = DI.buildScenario(sc); DI.botBuild(q.S, sc.id); for (const p of q.W.parts.values()) if ((p.type === 'prev' || p.type === 'dryv') && !(p.p.avc === 1 && p.p.avcBy === 0)) bad.push(sc.id + '#' + p.id); }
    ok('A75 every dry and preaction valve of every contract build has an AVC with its bypass closed', bad.length === 0, bad.join() || undefined);
    ok('A75 static: the engine holds the bypass target in one place and release never reads the AVC', /DI\.avcBypassed\(v\) \? DI\.bypassTarget\(W, inf\) : v\.p\.airSet/.test(DI.gasPre.toString()) && !/avc/i.test(DI.relState.toString() + DI.alarmStep.toString().split('DI.dactStep')[0].replace(/[^]*?\/\/ detection/, '')));
  }
  // A76 sizing on normal when an AVC regulates; the cut-out rule only on a compressor direct to the system
  {
    const Z = DI.buildScenario(c5); DI.botBuild(Z.S, 'c5'); const comp = Z.W.byType('comp')[0], zs = Z.W.byType('prev'), gov = DI.airSizing(Z.S, zs[0].id).gov, az = () => DI.airSizing(Z.S, gov), base = az();
    const hi = () => DI.review(Z.S).filter((q) => /above the high-air supervisory/.test(q.text)), air = () => DI.review(Z.S).filter((q) => q.text.includes('air supply'));
    comp.p.cutOut = 50; const a50 = az(); comp.p.cutOut = 55; const a55 = az(), f55 = hi().length, w55 = air().length;
    ok('A76 AVC fitted, cut-out 50 or 55: the minimum is the normal-pressure value (about 6.37 scfm, not 7.96), the sizing pressure is normal, and there is no finding', base.P === 40 && a50.P === 40 && a55.P === 40 && Math.abs(a50.min - base.min) < 1e-12 && Math.abs(a55.min - 6.37) < 0.01 && DI.sizingP(Z.S, gov) === Z.W.parts.get(gov).p.airSet && f55 === 0 && w55 === 0, a55.min.toFixed(2) + ' scfm at ' + a55.P + ' psi');
    for (const z of zs) z.p.avc = 0; comp.p.cutOut = 50; const d50 = az(), f50 = hi().length; comp.p.cutOut = 55; const d55 = az(), fd = hi();
    ok('A76 no AVC (compressor direct): the sizing pressure is the cut-out where it is higher (50 psi: about 7.96 scfm); a cut-out above high air is one review fail per zone, and one at high air is none', d50.P === 50 && Math.abs(d50.min - 7.96) < 0.01 && f50 === 0 && d55.P === 55 && fd.length === zs.length && fd.every((q) => q.sev === 'fail' && /compressor cut-out \(55 psi\) is above the high-air supervisory \(50 psi\) with no AVC between them: the compressor can push the zone into high air \(ASSUMED practice, NEEDS PE REVIEW\)\.$/.test(q.text)), fd[0] && fd[0].text);
    zs[0].p.avc = 1; ok('A76 the fail is per zone: giving one zone its AVC back removes its finding only', hi().length === zs.length - 1); for (const z of zs) z.p.avc = 1; comp.p.cutOut = 0;
    const refs = []; for (const sc of DI.SCEN) { if (!DI.BOT[sc.id]) continue; const q = DI.buildScenario(sc); DI.botBuild(q.S, sc.id); const rv = DI.review(q.S); if (rv.some((x) => x.sev === 'fail' || /cut-out|air supply|battery|THIN/.test(x.text))) refs.push(sc.id); }
    ok('A76 no reference build (c1 to c7) gains a fail, an air-supply finding, a cut-out finding or a battery finding', refs.length === 0, refs.join() || undefined);
  }
  // A77 DACT retries: 10 attempts of 90 s, then the failure indication at the premises
  const dactRig = (o) => { const r = liveRig(Object.assign({ det: 'smoke', gate: true, stn: true }, o)); r.W.cfg.commPath = 'dact'; run(r.S, 2, 1); return r; };
  const ent = (r, key) => r.S.dq.filter((e) => e.key === key), sq = (r) => DI.stationQueue(r.S);
  {
    const r = dactRig(), id = r.pn.id, key = 's' + r.d.id; r.pn.p.chan = [0, 0]; r.S.step(1); smoke(r.S, 2, 2); r.S.smoke[1] = 0;
    const o = r.S.sig.get(key), t0 = o.t0, e = ent(r, key)[0], at = (sec) => { const T = t0 + sec; while (r.S.t < T - 1e-9) r.S.step(Math.min(1, T - r.S.t)); return r.S.t; }, seen = [];
    const start = !!o && o.type === 'ALARM' && o.cut && !o.tx && !!e && e.state === 'RETRY' && e.n === 1 && e.t0 === t0 && e.cls === 'ALARM' && e.fd === true && r.S.sig.get(key).q === e && r.S.dq.length === 1;
    for (const [sec, n] of [[89, 1], [90, 2], [179, 2], [180, 3], [719, 8], [809, 9], [810, 10], [899, 10]]) { at(sec); seen.push(e.n === n && e.state === 'RETRY' && !r.S.sig.has('dx' + id)); }
    ok('A77 both channels down, one alarm: attempt 1 to 89 s, 2 to 179 s, ... 10 from 810 s; no premises failure at 899 s', start && seen.every(Boolean) && DI.DACT_TRIES === 10 && DI.DACT_ATTEMPT_S === 90 && DI.DACT_TOTAL_S === 900, seen.map((x) => (x ? 'y' : 'N')).join(''));
    at(900); const dx = r.S.sig.get('dx' + id);
    ok('A77 at 900 s exactly one DACT TRANSMISSION FAILED trouble: class TRBL, at the panel only, never transmitted; the entry is HELD', [...r.S.sig.keys()].filter((k) => k.startsWith('dx')).length === 1 && !!dx && dx.type === 'TRBL' && dx.reg === 'dactFail' && dx.mon && dx.cut && dx.tx === false && dx.delay === Infinity && dx.t0 === t0 + 900 && e.state === 'HELD' &&
      dx.text === 'DACT TRANSMISSION FAILED - panel #' + id + ' (10 attempts over 15 min; 1 signal(s) held)' && quiet(r) && r.S.dq.length === 1, dx && dx.text);
    run(r.S, 600, 1); ok('A77 it stays at the panel while both channels are down, the alarm is still annunciated, and nobody is dispatched', r.S.sig.has('dx' + id) && r.S.sig.get(key).tx === false && quiet(r) && sq(r)[0].label === 'HELD, COMM FAILURE');
    c6.held = r; c6.heldKey = key; c6.heldT0 = t0;
  }
  // A78 single-channel failover; hold and send ON (default) and OFF
  {
    const one = dactRig(); one.pn.p.chan = [0, 1]; one.S.step(1); one.stn.p.on = true; run(one.S, 3, 1);
    ok('A78 one channel down: nothing is queued, the alarm is sent at once on the other channel and the log names it', one.S.dq.length === 0 && one.S.sig.get('mn' + one.stn.id).tx === true && called(one) && !one.S.fd.log.late && one.S.log.some((l) => /^ALARM: MANUAL PULL, ZONE .*  \[sent on channel 2\]$/.test(l.text)) && !one.S.log.some((l) => /sent on channel 1/.test(l.text)));
    // both down: an alarm raised and cleared inside the outage, a supervisory held past the attempts, and a trouble still retrying at the restore
    const scene = (hold) => { const r = dactRig(); if (hold === false) r.W.cfg.dactHold = false; r.pn.p.chan = [0, 0]; r.S.step(1);
      r.stn.p.on = true; run(r.S, 5, 1); const tA = r.S.sig.get('mn' + r.stn.id).t0; r.stn.p.on = false; DI.panelReset(r.S, r.pn.id); run(r.S, 5, 1); const gone = !r.S.sig.has('mn' + r.stn.id) && !r.S.sig.has('ms' + r.v.id);
      DI.setGate(r.S, r.g.id, 0); run(r.S, 1000, 1); r.pn.p.chgFail = true; run(r.S, 30, 1); const pre = { a: ent(r, 'mn' + r.stn.id)[0], t: ent(r, 'tm' + r.g.id)[0], c: ent(r, 'cf' + r.pn.id)[0] }, st = [pre.a.state, pre.t.state, pre.c.state].join();
      r.pn.p.chan = [1, 0]; r.S.step(1); const tR = r.S.t; run(r.S, 120, 1); return Object.assign(r, pre, { tA, tR, gone, st }); };
    const on = scene();
    ok('A78 hold ON (default): an alarm raised and cleared inside the outage is sent after restore with its original event time and its clear time, and the fire department is dispatched late', on.gone && on.st === 'HELD,HELD,RETRY' && on.a.state === 'SENT' && on.a.t0 === on.tA && on.a.tClr > on.tA && on.a.tClr < on.tR && on.a.sentT === on.tR && called(on) && on.S.fd.log.late === true && on.S.fd.called === on.tR &&
      on.S.log.some((l) => l.text === 'Alarm transmitted (late, held during the DACT outage). Fire department dispatched.') && on.S.log.some((l) => /^SENT \d\d:\d\d \(late\): MANUAL PULL, ZONE .* \(event \d\d:\d\d, cleared \d\d:\d\d before sending\)$/.test(l.text)) && !('dactHold' in on.W.cfg) && DI.dactHold(on.W) === true);
    ok('A78 hold ON: the signal held past the 900 s is sent too, and so is the one still inside its attempts', on.t.state === 'SENT' && on.c.state === 'SENT' && on.t.sentT > on.a.sentT && on.c.sentT > on.t.sentT && on.S.sig.get('tm' + on.g.id).tx === true && on.S.sig.get('cf' + on.pn.id).tx === true && !on.S.sig.has('dx' + on.pn.id));
    const off = scene(false);
    ok('A78 hold OFF (Cycle 7): only the alarm that cleared inside the outage is DROPPED and never sent, and nothing is dispatched from it; the supervisory held past the attempts is still active, so it is sent, and so is the one still retrying', off.st === 'HELD,HELD,RETRY' && off.a.state === 'DROPPED' && off.a.why === 'hold' && off.t.state === 'SENT' && off.t.t0 < off.tR - 1000 && off.c.state === 'SENT' && off.a.sentT === undefined && quiet(off) && off.S.sig.get('tm' + off.g.id).tx === true && off.S.sig.get('cf' + off.pn.id).tx === true &&
      off.S.log.filter((l) => /^NOT SENT \(hold off, cleared \d\d:\d\d\): MANUAL PULL, ZONE .* \(event \d\d:\d\d\)$/.test(l.text)).length === 2 && off.S.log.filter((l) => l.text.startsWith('NOT SENT (hold off')).length === 2 && off.W.cfg.dactHold === false && DI.dactHold(off.W) === false && DI.dactHold({ cfg: { dactHold: 0 } }) === true, off.S.dq.map((e) => e.key + ':' + e.state).join());
    c6.off = off;
  }
  // A79 the restore order: alarm, supervisory, trouble, then the communications-failure trouble and its restoral
  {
    const r = dactRig(); r.pn.p.chan = [0, 0]; r.S.step(1); r.pn.p.chgFail = true; run(r.S, 20, 1); DI.setGate(r.S, r.g.id, 0); run(r.S, 20, 1); r.stn.p.on = true; run(r.S, 20, 1);
    const tOut = r.pn.p.dnT, before = quiet(r) && r.S.dq.every((e) => e.state === 'RETRY'), t0s = Object.fromEntries(r.S.dq.map((e) => [e.key, e.t0]));
    r.pn.p.chan = [0, 1]; r.S.step(1); const tR = r.S.t, ms0 = r.S.sig.get('ms' + r.v.id), mn0 = r.S.sig.get('mn' + r.stn.id), first = { called: r.S.fd.called, mn: mn0.tx, ms: ms0.tx, msState: ms0.q.state }; run(r.S, 9, 1); const at9 = r.S.sig.get('ms' + r.v.id).tx; r.S.step(1); const at10 = r.S.sig.get('ms' + r.v.id).tx; run(r.S, 120, 1);
    const sent = r.S.dq.slice().sort((a, b) => a.sentT - b.sentT), order = sent.map((e) => (e.comm ? 'COMM' : e.cls)).join(), gaps = sent.slice(1).map((e, i) => e.sentT - sent[i].sentT);
    ok('A79 a trouble, then a supervisory, then an alarm in the outage; on restore they go alarm, alarm, supervisory, trouble, 10 s apart, then the communications failure and its restoral', before && order === 'ALARM,ALARM,SUPV,TRBL,COMM' && sent.every((e) => e.state === 'SENT') && gaps.every((x) => x === DI.DACT_SEND_S) && DI.DACT_SEND_S === 10 && sent[0].sentT === tR && sent[4].t0 === tOut && sent[4].text === 'DACT COMMUNICATIONS FAILURE - panel #' + r.pn.id + ', and its restoral', order + ' gaps ' + gaps.join());
    ok('A79 each keeps its original event time, earlier than the restore, in the order they happened', sent.slice(0, 4).every((e) => e.t0 === t0s[e.key] && e.t0 < tR) && t0s['cf' + r.pn.id] < t0s['tm' + r.g.id] && t0s['tm' + r.g.id] < t0s['mn' + r.stn.id]);
    ok('A79 the fire department is called at the alarm’s send, not before; a signal reads as sent only once its own entry is SENT', first.called === tR && r.S.fd.log.late === true && first.mn === true && first.ms === false && first.msState !== 'SENT' && at9 === false && at10 === true && r.S.sig.get('tm' + r.g.id).tx === true);
    ok('A79 static (Cycle 7): the priority is alarm, supervisory, trouble, then OPEN (3), and the communications failure after all (4)', /e\.comm \? 4 : e\.cls === 'ALARM' \? 0 : e\.cls === 'SUPV' \? 1 : e\.cls === 'TRBL' \? 2 : 3/.test(DI.dactStep.toString()) && !/OPEN sorts with supervisory/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'alarm.js'), 'utf8').replace(/the Cycle 6 rule "OPEN sorts with supervisory" is withdrawn/, '')));
  }
  // A80 the live indication, and the matrix as design intent
  {
    const r = dactRig(), cells = () => JSON.stringify(DI.ceMatrix(r.S, r.v.id).rows.map((q) => q.cells)), c0 = cells(); r.pn.p.chan = [0, 0]; r.S.step(1); r.pn.p.chgFail = true; r.S.step(1); const t0 = r.S.sig.get('cf' + r.pn.id).t0; while (r.S.t < t0 + 200) r.S.step(1);
    const l3 = sq(r)[0].label, cOut = cells(); while (r.S.t < t0 + 900) r.S.step(1); const lh = sq(r)[0].label; r.pn.p.chan = [1, 1]; run(r.S, 30, 1); const ls = sq(r)[0].label, rows = sq(r);
    ok('A80 the station queue reads RETRYING 3 of 10, then HELD, COMM FAILURE, then SENT hh:mm (late); hold off reads NOT SENT (hold off)', l3 === 'RETRYING 3 of 10' && lh === 'HELD, COMM FAILURE' && /^SENT \d\d:\d\d \(late\)$/.test(ls) && rows.length === 2 && rows.every((q) => q.state === 'SENT' && q.cls === 'TRBL' && typeof q.t0 === 'number' && typeof q.sentT === 'number' && q.panel === r.pn.id) &&
      DI.stationQueue(c6.off.S).filter((q) => q.label === 'NOT SENT (hold off)').length === 2 && DI.stationQueue(rig().S).length === 0, [l3, lh, ls].join(' | '));
    const m = DI.ceMatrix(r.S, r.v.id);
    ok('A80 the matrix is design intent: every cell is identical before and during the outage, and the footnote is the Cycle 7 text: the FA Lead’s two sentences, then the restore order and the hazard case', c0 === cOut && m.notes[m.notes.length - 1] === 'With both DACT channels failed, signals are not transmitted until a channel restores. Panel shows comm-failure trouble. On restore a signal that is still active is always re-sent, with its original event time: alarm, supervisory, trouble, then a class not elected (OPEN), then restorals. A panel that dies with signals queued sends none of them (hazard case). See Cycle 6 Q2 and Cycle 7 C7-1.' && m.notes[m.notes.length - 1] === DI.CE_DACT_NOTE && DI.CE_COLS.length === 9 && !DI.CE_COLS.some((c) => /live/i.test(c)));
    const trip = (out) => { const q = dactRig({ det: 'vesda' }); if (out) q.pn.p.chan = [0, 0]; q.W.cfg.hvacHook = 'fire1'; q.W.cfg.epoHook = true; breakHead(q); smoke(q.S, 0.2, 10); const rs = DI.relState(q.W, q.v), mm = DI.ceMatrix(q.S, q.v.id);
      return JSON.stringify([rs.D, rs.P, rs.open, rs.sol, q.v.p.solOut, q.s.tripT > 0, mm.rows.map((x) => [x.nac, x.hvac, x.epo, x.annunciated, x.sol]), [...q.S.sig.values()].filter((o) => !/^d[cx]/.test(o.key)).map((o) => [o.key, o.type, o.mon, o.dark])]); };
    const gasSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'gas.js'), 'utf8'), ceSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'cause.js'), 'utf8'), stepSrc = DI.alarmStep.toString().replace(/\/\/.*$/gm, '');       // code only, comments stripped
    ok('A80 release, the notification rule, annunciation and the HVAC / EPO hooks are identical in an outage; release and hook code never read the queue (static)', trip(false) === trip(true) && /true,true,true,true,true,true/.test(trip(true)) && !/\bdq\b|dactStep|\.q\.state|stationQueue/.test(gasSrc + ceSrc + DI.relState.toString() + DI.panelReset.toString()) && (stepSrc.match(/\bo\.q\b/g) || []).length === 3 && (stepSrc.match(/S\.dq\b/g) || []).length === 2);
  }
  // A81 a silenced trouble resounds after 24 h
  {
    const r = rig(), pn = r.pn; pn.p.chgFail = true; run(r.S, 2, 1); const m = DI.silence(r.S, pn.id), tS = r.S.t; r.S.warp(86000); while (r.S.t < tS + 86399) r.S.step(1);
    const still = pn.p.silenced === true && pn.p.silT === tS && r.S.t === tS + 86399 && !r.S.log.some((l) => /resounded/.test(l.text)); r.S.step(1);
    ok('A81 silenced with an active trouble: still silenced at 86,399 s, resounded at 86,400 s with a log line that cites the section', m === '' && still && pn.p.silenced === false && DI.TROUBLE_RESOUND_S === 86400 && r.S.log.some((l) => l.text === 'Silenced trouble resounded at panel #' + pn.id + ' (every 24 h or less, NFPA 72-2025 §10.15.9.1; §10.15.10.7 for a Ch. 26 premises unit)' && l.cls === 'warn'));
    const n = rig(); run(n.S, 2, 1); DI.silence(n.S, n.pn.id); n.S.warp(90000);
    const c = rig(); c.pn.p.chgFail = true; run(c.S, 2, 1); DI.silence(c.S, c.pn.id); c.S.warp(3600); c.pn.p.chgFail = false; c.S.warp(90000);
    ok('A81 with no active trouble it stays silenced, and a trouble that cleared does not resound', n.pn.p.silenced === true && c.pn.p.silenced === true && !c.S.sig.has('cf' + c.pn.id) && !c.S.log.some((l) => /resounded/.test(l.text)));
    const s2 = rig({ gate: true }); s2.pn.p.chgFail = true; run(s2.S, 2, 1); DI.silence(s2.S, s2.pn.id); DI.setGate(s2.S, s2.g.id, 0); run(s2.S, 6, 0.25); const bySig = s2.pn.p.silenced === false; DI.silence(s2.S, s2.pn.id); DI.panelReset(s2.S, s2.pn.id);
    const dead = rig(); dead.W.power = false; dead.pn.p.battH = 0; dead.S.step(1);
    ok('A81 a new signal and a panel reset clear the silence as before; a dead panel cannot be silenced', bySig && s2.pn.p.silenced === false && DI.silence(dead.S, dead.pn.id) === DI.PANEL_DEAD_MSG && dead.pn.p.silenced === false);
  }
  // A82 the standby calculation
  {
    const W = new DI.World(4, 4), pn = (ah) => ({ p: Object.assign({}, DI.PARTS.panel.props, ah ? { ah } : {}) }), C = (cfg, ah) => { const w = new DI.World(4, 4); Object.assign(w.cfg, cfg || {}); return DI.standbyCalc(w, pn(ah)); };
    const d25 = C(), d19 = C({ ed72: '2019' }), d22 = C({ ed72: '2022' });
    ok('A82 the default panel needs 15.21 Ah in 2025 and 14.60 Ah in 2019; 26 Ah passes with about 71 % margin and is not THIN', Math.abs(d25.req - 15.2083) < 1e-3 && Math.abs(d19.req - 14.6) < 1e-9 && Math.abs(d22.req - d25.req) < 1e-12 && !d25.below && !d25.thin && Math.abs(d25.margin - 0.7096) < 1e-3 && d25.ah === 26 && d25.iStby === 0.5 && d25.iAlarm === 2 && d25.h === 24 && d25.alarmMin === 5 && d25.basis === '24 h + 5 min, x1.25', d25.req.toFixed(2) + ' / ' + d19.req.toFixed(2));
    ok('A82 the factor follows the NFPA 72 edition, never the NFPA 13 edition: 2019 x1.20, 2022 and 2025 x1.25', d19.factor === 1.2 && d22.factor === 1.25 && d25.factor === 1.25 && C({ edition: 'US-2019', ed72: '2025' }).factor === 1.25 && C({ edition: 'US-2025', ed72: '2019' }).factor === 1.2 && C({ edition: 'US-2019' }).factor === 1.2 && JSON.stringify(DI.STBY_FACTOR) === '{"2019":1.2,"2022":1.25,"2025":1.25}' && !/cfg\.edition|juris/.test(DI.standbyCalc.toString()));
    const o10 = C({ standby: 'owner10' }), fm = C({ standby: 'fm90' }), fm65 = C({ standby: 'fm90' }, 65);
    ok('A82 the owner row is 24 h + 10 min; the FM row is 90 h + 10 min and needs 56.67 Ah: the default panel fails it and a 65 Ah pick passes', o10.h === 24 && o10.alarmMin === 10 && Math.abs(o10.req - (12 + 2 * 10 / 60) * 1.25) < 1e-9 && Math.abs(o10.req - 15.4167) < 1e-3 && !o10.below && fm.h === 90 && fm.alarmMin === 10 && Math.abs(fm.req - 56.6667) < 1e-3 && fm.below && !fm65.below && fm65.basis === '90 h + 10 min, x1.25', fm.req.toFixed(2) + ' Ah');
    ok('A82 FM is an election of its own: insurer = FM leaves the basis at 24 h + 5 min', C({ insurer: 'FM' }).key === 'nfpa5' && !C({ insurer: 'FM' }).below);
    const t18 = C(null, 18), t18b = C({ ed72: '2019' }, 18), t12 = C(null, 12);
    ok('A82 an 18 Ah pick is THIN at 2025 and passes plain at 2019 (margin 23 %); 12 Ah fails', t18.thin && !t18.below && Math.abs(t18.margin - 0.1836) < 1e-3 && !t18b.thin && !t18b.below && Math.abs(t18b.margin - 0.2329) < 1e-3 && t12.below && DI.STBY_THIN === 0.2);
    const rows = DI.STANDBY, tab = DI.standbyTable(W);
    ok('A82 the six rows exist with their tags; three are selectable and three are reference only, never selectable', rows.map((q) => q.key).join() === 'nfpa5,owner10,fm90,facu,evacs,ess' && rows.filter((q) => q.sel).map((q) => q.key).join() === 'nfpa5,owner10,fm90' && rows.every((q) => q.tag && q.label) && /FM DS 5-40 §2\.3\.4, Sep 2007 edition, may not be current/.test(rows[2].tag) && /NFPA 855 §4\.8\.3/.test(rows[5].tag) &&
      tab.map((q) => q.standby + '+' + q.alarm).join() === '24 h+5 min,24 h+10 min,90 h+10 min,24 h+5 min,24 h+15 min,24 h+2 h' && tab[0].use === 'IN FORCE on this site' && tab.slice(3).every((q) => /reference only/.test(q.use)) && ['facu', 'evacs', 'ess', 'x', undefined].every((k) => DI.standbyKey({ cfg: { standby: k } }) === 'nfpa5') && DI.standbyKey({ cfg: { standby: 'fm90' } }) === 'fm90');
    const R = (cfg, ah) => { const r = rig(); Object.assign(r.W.cfg, cfg || {}); if (ah) r.pn.p.ah = ah; return DI.review(r.S).filter((q) => /battery/i.test(q.text) && /Panel #/.test(q.text)); };
    const f12 = R(null, 12), w18 = R(null, 18), ffm = R({ standby: 'fm90' });
    ok('A82 plan review: below the requirement is one fail per panel, THIN is one warning, the default is no finding', R().length === 0 && f12.length === 1 && f12[0].sev === 'fail' && /battery 12 Ah is below the 15\.2 Ah the standby basis needs \(24 h \+ 5 min, x1\.25, NFPA 72-2025 §10\.6\.7\.2\)/.test(f12[0].text) && w18.length === 1 && w18[0].sev === 'warn' && /THIN: margin 18 %, under 20 %/.test(w18[0].text) && /PRACTICE, NEEDS PE REVIEW/.test(w18[0].text) && ffm.length === 1 && ffm[0].sev === 'fail' && /56\.7 Ah/.test(ffm[0].text), f12[0] && f12[0].text);
    DI.setJuris(new DI.World(4, 4));
  }
  // A83 capacity in the sim, the 48 h recharge and the generator option
  {
    const base = rig(), fm = rig(); fm.W.cfg.standby = 'fm90'; fm.pn.p.ah = 65; const fm26 = rig(); fm26.W.cfg.standby = 'fm90';
    ok('A83 hours of standby follow the basis and the Ah ratio: 24 by default, 90 for the FM row with 65 Ah, less in proportion with the default battery', DI.panelH(base.W, base.pn) === 24 && DI.panelH(fm.W, fm.pn) === 90 && Math.abs(DI.panelH(fm26.W, fm26.pn) - 90 * 26 / (56 + 2 / 3)) < 1e-9 && DI.RECHARGE_H === 48);
    const charge = (r) => { r.S.step(1); r.pn.p.battH = 0; r.S.warp(47 * 3600); const H = DI.panelH(r.W, r.pn), at47 = r.pn.p.battH; r.S.warp(3600 + 60); return at47 < H * 0.985 && at47 > H * 0.97 && Math.abs(r.pn.p.battH - H) < 1e-6; };
    ok('A83 after a full discharge on AC the battery is not full at 47 h and full at 48 h, for a 24 h and for a 90 h battery', charge(base) && charge(fm));
    const nc = (key) => { const r = rig(); r.S.step(1); r.pn.p.battH = 5; r.pn.p[key] = true; r.S.warp(10 * 3600); return r.pn.p.battH === 5; };
    ok('A83 no recharge while the charger has failed or the battery is disconnected', nc('chgFail') && nc('battDisc') && !/0\.5\)/.test(DI.alarmStep.toString().split('// lost =')[0]));
    const g = rig(); g.W.cfg.panelGen = true; const cg = DI.standbyCalc(g.W, g.pn); run(g.S, 2, 1); g.W.power = false; run(g.S, 5, 1); const onBatt = g.pn.p.alive && !g.pn.p.onGen && g.pn.p.battH < 4; run(g.S, 10, 1); const b10 = g.pn.p.battH, onGen = g.pn.p.onGen === true && g.pn.p.alive;
    g.S.warp(12 * 3600); const mid = g.pn.p.alive && g.pn.p.onGen && g.pn.p.battH === b10 && /on the standby generator/.test(g.S.sig.get('ac' + g.pn.id).text); g.S.warp(12 * 3600 + 120); const off = g.pn.p.onGen === false && g.pn.p.alive && g.pn.p.battH < b10; g.S.warp(4 * 3600 + 120);
    ok('A83 generator-backed (2025): 4 h of battery required, the panel is on the generator 10 s after the loss with the battery held, the generator drops at 24 h, and the battery then carries 4 h', cg.gen && cg.h === 4 && Math.abs(cg.req - (0.5 * 4 + 2 * 5 / 60) * 1.25) < 1e-9 && DI.panelH(g.W, g.pn) === 4 && onBatt && onGen && mid && off && g.pn.p.alive === false && DI.GEN_BATT_H === 4 && DI.GEN_RUN_S === 86400);
    const g22 = rig(); g22.W.cfg.panelGen = true; g22.W.cfg.ed72 = '2022'; const c22 = DI.standbyCalc(g22.W, g22.pn);
    ok('A83 under 2019 or 2022 the generator setting is ignored, with a note', !c22.gen && c22.h === 24 && DI.panelGen(g22.W) === false && DI.panelH(g22.W, g22.pn) === 24 && DI.standbyNotes(g22.W).some((t) => /Set for this site, and ignored: NFPA 72-2022 is in force\./.test(t)) && DI.panelGen({ cfg: { panelGen: 1 } }) === false);
    DI.setJuris(new DI.World(4, 4));
  }
  // A84 low battery in volts; the charger and battery-disconnect troubles
  {
    ok('A84 20.4 V is exactly 1/12 of the hours, whatever the capacity; 27.0 V on float and 19.8 V at the end', [4, 24, 41.3, 90].every((H) => Math.abs(DI.battV(DI.lowBattH(H), H) - 20.4) < 1e-9 && Math.abs(DI.lowBattH(H) - H / 12) < 1e-12) && DI.battV(24, 24) === 27 && DI.battV(0, 24) === 19.8 && DI.LOWBATT_V === 20.4 && DI.lowBattH() === 2);
    const fm = rig(); fm.W.cfg.standby = 'fm90'; fm.pn.p.ah = 65; fm.pn.p.battH = 90; run(fm.S, 2, 1); fm.W.power = false; fm.S.warp(82.4 * 3600); const no = !fm.S.sig.has('lb' + fm.pn.id); fm.S.warp(0.2 * 3600); const lb = fm.S.sig.get('lb' + fm.pn.id);
    ok('A84 the low-battery trouble comes in there and not before (82.5 h into a 90 h battery), and its text says volts', no && !!lb && lb.type === 'TRBL' && lb.text === 'LOW BATTERY - panel #' + fm.pn.id + ' (20.4 V listed setpoint, ASSUMED)' && lb.tx === true && fm.pn.p.alive);
    const c = rig(); run(c.S, 2, 1); c.pn.p.battH = 10; c.pn.p.chgFail = true; c.S.step(1); const cf = c.S.sig.get('cf' + c.pn.id); c.S.warp(3600);
    ok('A84 charger failure on AC: a trouble at the panel at once and at the station, the battery not charging, and a matrix row', !!cf && cf.type === 'TRBL' && cf.reg === 'chgFail' && cf.mon && cf.tx === true && cf.t0 === c.S.t - 3600 && cf.text === 'CHARGER FAILURE - panel #' + c.pn.id + ' (battery not charging)' && c.pn.p.battH === 10 && DI.ceMatrix(c.S, c.v.id).rows.find((q) => q.key === 'chgFail').live === true);
    const b = rig(); run(b.S, 2, 1); b.pn.p.battDisc = true; b.S.step(1); const bd = b.S.sig.get('bd' + b.pn.id), aliveAc = b.pn.p.alive; b.W.power = false; b.S.step(1);
    ok('A84 battery disconnected: a trouble (PRACTICE), no matrix row, and the panel dies the moment AC is lost', !!bd && bd.type === 'TRBL' && bd.reg === 'battDisc' && bd.text === 'BATTERY DISCONNECTED - panel #' + b.pn.id && aliveAc === true && b.pn.p.alive === false && !DI.CE_ROWS.some((q) => q.key === 'battDisc') && /a disconnected battery/.test(DI.CE_EXCLUDED) && !b.S.sig.has('lb' + b.pn.id));
    const trip = (mut) => { const q = rig(); if (mut) mut(q); breakHead(q); smoke(q.S, 0.2, 10); const rs = DI.relState(q.W, q.v); return JSON.stringify([rs.D, rs.P, rs.open, rs.sol, q.v.p.solOut, q.s.tripT > 0, q.v.p.tripped]); };
    ok('A84 neither is an input of D or P: the release is identical with a failed charger, and a low battery on AC', trip() === trip((q) => { q.pn.p.chgFail = true; }) && trip() === trip((q) => { q.pn.p.battH = 1; q.pn.p.chgFail = true; }) && trip() === '[true,true,true,true,true,true,true]' && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && resTT.every((q) => q.ok));
  }
  // A85 the HVAC Fire 2 hook is keyed on the Fire 2 input
  {
    const r = rig({ gate: true, stn: true }), V = (vec) => DI.ceEval(r.W, r.v, vec), rows = () => DI.ceMatrix(r.S, r.v.id).rows, on = () => rows().filter((q) => q.hvac).map((q) => q.key).join();
    const set = (h) => { if (h) r.W.cfg.hvacHook = h; else delete r.W.cfg.hvacHook; };
    set('fire2'); const byIn = DI.CE_ROWS.every((q) => { const x = rows().find((z) => z.key === q.key); return !x.applies || x.hvac === (!!q.in.fire2 && q.in.power !== 'Dead'); });
    ok('A85 hook = Fire 2: on for every matrix row whose input has Fire 2 and off for every row without; a synthetic Fire 2 + P vector trips it, release or not', byIn && on() === 'fire2' && V({ fire2: true, p: true }).hvac && V({ fire2: true, p: true }).open && V({ fire2: true }).hvac && !V({ fire2: true }).open && V({ fire2: true, lowAir: true, tamper: true }).hvac && V({ fire2: true, p: true }).hvacBy === 'Fire 2' && rows().find((q) => q.key === 'fire2').cells[7] === 'HOOK: output contact (HVAC shutdown / damper): Fire 2');
    r.W.cfg.manualReleaseBypassP = true; const mz = V({ mrz: true }); delete r.W.cfg.manualReleaseBypassP;
    ok('A85 hook = Fire 2: a release alone never trips it (Fire 1 + P, the Manual Release zone, the manual station)', !V({ fire1: true, p: true }).hvac && V({ fire1: true, p: true }).open && !mz.hvac && mz.open && !V({ manual: true, p: true }).hvac && !V({ waterflow: true }).hvac);
    set('fire1'); const f1 = V({ fire2: true }).hvac && V({ fire2: true, p: true }).hvac && V({ fire1: true }).hvac && V({ manual: true }).hvac && V({ waterflow: true }).hvac && DI.CE_ROWS.filter((q) => q.in.fire2).every((q) => rows().find((z) => z.key === q.key).hvac);
    set('waterflow'); const wf = on() === 'waterflow' && !V({ fire2: true, p: true }).hvac && !V({ fire1: true, p: true }).hvac && V({ waterflow: true }).hvac;
    ok('A85 hook = Fire 1 also trips on every Fire 2 row; hook = waterflow trips on waterflow only', f1 && wf);
    const never = ['fire1', 'fire2', 'waterflow', null].every((h) => { set(h); r.W.cfg.sigClass = { alert: 'ALARM', action: 'ALARM' }; const x = !V({ alert: true }).hvac && !V({ action: true }).hvac && !V({ alert: true, action: true, p: true }).hvac; delete r.W.cfg.sigClass; return x; });
    set('fire2'); const dead = !V({ fire2: true, p: true, power: 'Dead' }).hvac; set(null);
    ok('A85 never Alert or Action in any setting, even elected ALARM; default none; a dead panel trips no hook', never && dead && DI.hvacHook(r.W) === 'none' && on() === '' && !V({ fire2: true }).hvac);
    const src = DI.ceEval.toString();
    ok('A85 static: the rule reads x.fire2, never a row key', /hk === 'fire2' \? !!x\.fire2/.test(src) && !/key === '|sigKey === 'fire2'|\.key\b[^,;]*fire2/.test(src.replace(/q\.key === sigKey/, '')) && /every row with Fire 2 = 1/.test(DI.ceMatrix.toString()) && !/Fire 2 row only/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'cause.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8')));
    DI.setJuris(new DI.World(4, 4));
  }
  // A86 manual release and manual pull: the same dispatch, different labels and logic
  {
    const pull = liveRig({ stn: true }); pull.stn.p.on = true; run(pull.S, 5, 0.25); const nm = DI.sysName(pull.S, pull.v.id), mnP = pull.S.sig.get('mn' + pull.stn.id), msP = pull.S.sig.get('ms' + pull.v.id);
    const rel = liveRig({ stn: true }); rel.W.cfg.manualReleaseBypassP = true; rel.stn.p.on = true; run(rel.S, 5, 0.25); const mnR = rel.S.sig.get('mn' + rel.stn.id), msR = rel.S.sig.get('ms' + rel.v.id);
    ok('A86 the labels read MANUAL PULL, ZONE x and MANUAL RELEASE, ZONE x', mnP.text === 'MANUAL PULL, ZONE ' + nm && msP.text === 'MANUAL PULL, ZONE ' + nm + ' (DETECTION)' && mnR.text === 'MANUAL RELEASE, ZONE ' + nm && msR.text === 'MANUAL RELEASE, ZONE ' + nm + ' (BYPASSES P)' && !/MANUAL STATION/.test(DI.alarmStep.toString()));
    const cellP = DI.ceMatrix(pull.S, pull.v.id).rows.find((q) => q.key === 'manual').cells[4], cellR = DI.ceMatrix(rel.S, rel.v.id).rows.find((q) => q.key === 'mrz').cells[4];
    ok('A86 both are class ALARM on the dispatch list, with the same SS_Transmit text and the same dispatch', [mnP, msP, mnR, msR].every((o) => o.type === 'ALARM' && o.fd === true && o.mon && o.tx) && DI.SIG_FD.manual === 1 && DI.SIG_FD.mrz === 1 && DI.SIG_FIXED.manual === 'ALARM' && DI.SIG_FIXED.mrz === 'ALARM' && cellP === cellR && cellP === 'ALARM to the station; fire department: yes' && called(pull) && called(rel) && mnR.reg === 'manual' && msR.reg === 'mrz');
    ok('A86 the logic differs: the Manual Release zone releases without P, the DETECTION station still needs P; DI.relState is the Cycle 4 function', rel.s.tripT > 0 && rel.v.p.pLatch === false && rel.v.p.mrzL === true && pull.s.state === 'dry' && pull.v.p.pull === true && pull.v.p.pLatch === false && pull.s.wat === 0 && sha16(DI.relState.toString()) === 'a19f3e39ec09d52e');
    const lone = liveRig({ stn: true }); lone.W.unwire(lone.v.id); lone.S.sync(); lone.stn.p.on = true; run(lone.S, 2, 0.25);
    ok('A86 a station with no preaction zone on its panel still raises its alarm, labelled by its room', /^MANUAL PULL - .* \(no preaction zone\)$/.test(lone.S.sig.get('mn' + lone.stn.id).text) && DI.stationZone(lone.S, lone.stn) === null && DI.stationZone(pull.S, pull.stn) === pull.v);
    DI.setJuris(new DI.World(4, 4));
  }
  // A87 water stopped, and the tiers that read it. A scripted operator on a broken-head incident, as in the drill.
  const recover = (wait, o = {}) => { const r = rig(Object.assign({ gate: true }, o.rig)); r.S.drill = { t0: r.S.t, done: false }; const t0 = r.S.t; DI.breakSprinkler(r.S, r.head); if (o.fire) { run(r.S, 30, 0.25); smoke(r.S, 0.2, 10); r.S.smoke[1] = 0; run(r.S, wait - 40, 0.25); } else run(r.S, wait, 0.25);
    if (o.early) DI.panelReset(r.S, r.pn.id);
    DI.silence(r.S, r.pn.id); DI.findHead(r.S, r.head); R.shut(r); R.iso(r, 1); R.drain(r, 1); R.zero(r); if (o.fire) { DI.panelReset(r.S, r.pn.id); run(r.S, 1, 0.25); } DI.replaceSprinklers(r.S, r.v.id); if (o.fire) { DI.resetValve(r.S, r.v.id); run(r.S, 1, 0.25); }
    if (o.before) { DI.startTest(r.S, 'drain', r.v.id); run(r.S, 45, 0.25); }
    R.drain(r, 0); R.iso(r, 0); R.air(r); DI.panelReset(r.S, r.pn.id); run(r.S, 2, 0.25); if (o.noOpen) return Object.assign(r, { t0 }); const m = R.reopen(r);
    if (o.base) r.v.p.drainBase = o.base; if (!o.noDrain) { DI.startTest(r.S, 'drain', r.v.id); run(r.S, 45, 0.25); } return Object.assign(r, { t0, m }); };
  const drillScore = (r) => DI.recoveryScore(r.S, r.v.id, r.t0);
  {
    const ds = c5run.ds;
    ok('A87 the reference drill: water stopped well under 60 s, 3 stars; the operator step time is still reported, on its own line', ds.waterStopped >= 0 && ds.waterStopped < 30 && DI.recoveryTier(ds) === 3 && ds.opTime > 0 && c5run.dr.lines.some((l) => /Water stopped \d+ s after the alarm /.test(l)) && c5run.dr.lines.some((l) => /^• Operator steps took: \d+ s$/.test(l)));
    const fast = drillScore(recover(30)), slow = drillScore(recover(90)), late = drillScore(recover(200));
    ok('A87 a scripted operator who closes the valve at 30 s rates 3 stars, at 90 s 2 stars, at 200 s 1 star (every one complete and in order; Cycle 7 tiers 60 / 150)', [fast, slow, late].every((q) => q.complete && q.inOrder && q.total === 14) && Math.abs(fast.waterStopped - 34) < 4 && DI.recoveryTier(fast) === 3 && Math.abs(slow.waterStopped - 94) < 4 && DI.recoveryTier(slow) === 2 && Math.abs(late.waterStopped - 204) < 4 && DI.recoveryTier(late) === 1,
      [fast, slow, late].map((q) => Math.round(q.waterStopped) + ' s: ' + DI.recoveryTier(q) + (q.complete && q.inOrder ? '' : ' (' + q.done + '/' + q.total + (q.inOrder ? '' : ' out of order') + ')')).join(', '));
    const inc = drillScore(recover(60, { noOpen: true })), ooo = drillScore(recover(60, { early: true }));
    ok('A87 incomplete or out of order is 0 stars, however fast the water was stopped', !inc.complete && inc.waterStopped < 120 && DI.recoveryTier(inc) === 0 && DI.recoveryTier(Object.assign({}, fast, { inOrder: false })) === 0 && DI.recoveryTier(Object.assign({}, fast, { complete: false })) === 0 && ooo.waterStopped < 120);
    const f = recover(150, { fire: true }), fs2 = drillScore(f), al = f.S.acts.find((a) => a.kind === 'alarm' && a.t >= fs2.t0), cv = fs2.steps.find((q) => q.kind === 'close-valve');
    ok('A87 the clock starts at the first alarm signal after the incident opens (Fire 1 here), or at the incident itself when none rings', !!al && al.t > fs2.t0 + 20 && Math.abs(fs2.waterStopped - (cv.t - al.t)) < 1e-9 && fs2.waterStopped < cv.t - fs2.t0 - 20 && fs2.tripped && Math.abs(fast.waterStopped - (fast.steps.find((q) => q.kind === 'close-valve').t - fast.t0)) < 1e-9, 'alarm ' + Math.round(al.t - fs2.t0) + ' s after the head, valve closed ' + Math.round(fs2.waterStopped) + ' s after the alarm');
    ok('A87 the tier lines are 60 s and 150 s (ASSUMED, Cycle 7) and no contract star reads the tier', DI.RECOVERY_TIERS[0].s === 60 && DI.RECOVERY_TIERS[1].s === 150 && !/recoveryTier|RECOVERY_TIERS|waterStopped/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')));
    c6.fast = recover(60);
  }
  // A88 step 14: the main drain test, scored in the drill and a tip in practice
  {
    const r = c6.fast, p13 = DI.recoveryScore(r.S, r.v.id), d14 = drillScore(r), st = d14.steps[13], act = r.S.acts.find((a) => a.kind === 'main-drain-test');
    ok('A88 practice reads 13 steps and the drill call 14; step 14 is the main drain test, after step 13, with both readings in the operator log', p13.total === 13 && p13.complete && d14.total === 14 && d14.complete && d14.inOrder && st.kind === 'drain-test' && st.label === DI.RECOVERY_DRAIN[1] && st.done && st.t >= d14.steps[12].t && !!act && act.stat > 0 && act.resid > 0 && act.ts >= d14.steps[12].t && act.id === r.v.id && DI.RECOVERY.length === 13 && DI.RECOVERY_DRAIN[0] === 'drain-test');
    const none = drillScore(recover(60, { noDrain: true })), early = recover(60, { before: true, noDrain: true }), es = drillScore(early);
    ok('A88 without the test the drill recovery is 13 of 14; a main drain test run before the control valve was reopened does not count', none.done === 13 && !none.complete && none.steps[13].done === false && es.done === 13 && es.steps[13].done === false && early.S.acts.some((a) => a.kind === 'main-drain-test') && DI.recoveryScore(early.S, early.v.id).complete);
    const base = DI.lastResult(r.S, 'drain', r.v.id).val, d = recover(60, { base: base / 0.88 }), res = DI.lastResult(d.S, 'drain', d.v.id), dsc = drillScore(d), lines = DI.drillRecovery(d.S, 'the broken sprinkler').map((q) => q[1]);
    ok('A88 a result with a 12 % drop still passes the step, reads INVESTIGATE (not an automatic fail), and carries the Tutor’s hint with the drop in percent on the test and in the report', !!res && res.pass === false && res.invest === true && DI.resBadge(res) === 'INVESTIGATE' && Math.abs(res.drop - 0.12) < 0.01 && res.lines[res.lines.length - 1] === DI.mdtHint(res.drop) && /^Full flow pressure is 12\.\d percent lower than the last test\. NFPA 25 says find the cause\. A partly closed valve is the usual one\. Check the zone control valve and the supply valves upstream \(riser control valve, PIV, backflow preventer valves\)\.$/.test(DI.mdtHint(res.drop)) && typeof DI.MDT_FOLLOW === 'undefined' && dsc.steps[13].done && dsc.complete && dsc.inOrder && lines.some((l) => l.includes(DI.mdtHint(res.drop)) && l.endsWith('[' + DI.REF25.passLine + ']')) && lines[0].startsWith('Recovery after the broken sprinkler: 14 of 14 steps, in order') &&
      /Full-flow \(residual\): /.test(res.lines[1]) && /^Previous full flow pressure: \d+ psi \(DOWN 12%\)$/.test(res.lines[2]) && res.lines[3] === DI.REF25.passLine && DI.REF25.passLine === 'NFPA 25-2023 §13.2.2.3 (2020 §13.2.3.3): a 10 percent drop in full flow pressure vs the acceptance test or earlier tests means find the cause and correct it if necessary.', res && res.lines.join(' | '));
    const LINE = 'Company practice. Main drain test: with the control valve fully open, open the main drain fully, record static and residual pressure, then close it slowly. A 10 percent drop in full flow pressure against the last test means find the cause (NFPA 25).';
    const man = fs.readFileSync(path.join(__dirname, '..', 'src', 'manual.js'), 'utf8'), insp = fs.readFileSync(path.join(__dirname, '..', 'src', 'inspect.js'), 'utf8');
    ok('A88 the step 14 line (Cycle 8: company practice first, the Tutor’s procedure sentence, the find-the-cause sentence last): in the drill banner when the valve is back open, in the manual and in the practice tip', DI.MDT_LINE === LINE && banners.filter((t) => t === LINE).length >= 4 && r.S.log.some((l) => l.text === 'Step 14. ' + LINE) && r.S.drill.mdt === true && /\$\{DI\.MDT_LINE\}/.test(man) && /B\.p\('Tip: ' \+ DI\.MDT_LINE/.test(insp) && c5run.S.log.some((l) => l.text === 'Step 14. ' + LINE));
    ok('A88 the NFPA 25 cites: the main drain test and its 10 percent rule, the valve status test after a reopen, and what is company practice', /NFPA 25-2023 §13\.2\.2 \(2020 §13\.2\.3\)/.test(DI.REF25.mainDrain) && /full flow pressure/.test(DI.REF25.mainDrain) && /§13\.2\.2\.3; 2020 §13\.2\.3\.3/.test(DI.REF25.mainDrain) && /2023 \/ 2026 §13\.3\.3\.4; 2020 Table 13\.1\.1\.2 row/.test(DI.REF25.valveStatus) && /company practice/.test(DI.REF25.practice) && /ASSUMED teaching practice/.test(DI.REF25.practice));
  }
  // A89 Tutor wording: the parallel-split line and the practice reopen banner
  {
    // Cycle 8: a measured 34.0 min on the shared c5 compressor is one informational line; the code check (19.1 min alone) is its own line above it and is the only one compared with the limit
    const big = c5run.fills.find((q) => q.id === q.size.gov), line = DI.measuredLine(c5run.S, big.id, 2040), cc = DI.codeCheckLine(c5run.S, big.id), nt = DI.sharedLine(c5run.S, big.id);
    ok('A89 the measured line on the c5 build: 34.0 min, zones refilled at the same time, informational, with no limit in it; the code check passes at 19.1 min; the note is the Tutor’s', line === 'Air refill this drill, measured: 34.0 min (zones refilled at the same time, from partly full). Informational.' && !/limit|OK|over|FAIL/i.test(line) && DI.wordNum(2) === 'two' && DI.wordNum(4) === 'four' && DI.wordNum(10) === 'ten' && DI.wordNum(11) === '11' &&
      cc === 'Code check: largest zone alone, from 0 psig: 19.1 min. Limit 30 min (NFPA 13). Passes. [NFPA 13-2025 §8.2.7.3]' && nt.startsWith('Note: 3 zones share this compressor. It is sized for the largest zone, not for all zones at once. [NFPA 13-2025 §8.2.7.3'), line + ' | ' + cc + ' | ' + nt);
    const BAN = 'PRACTICE: You reopened the control valve with a head still open. Water flowed out of that head. Close the valve and finish the recovery in order.', nb = () => banners.filter((t) => t === BAN).length, said = (r) => r.S.log.filter((l) => /^Water entered the zone through the open head \(about \d+ gpm\)/.test(l.text));
    const a = rig({ gate: true }); DI.breakSprinkler(a.S, a.head); run(a.S, 60, 0.25); smoke(a.S, 0.2, 10); a.S.smoke[1] = 0; run(a.S, 20, 0.25); R.shut(a); run(a.S, 10, 0.25); const b0 = nb(); DI.setGate(a.S, a.g.id, 1); run(a.S, 30, 0.25); const b1 = nb(), l1 = said(a); run(a.S, 30, 0.25);
    ok('A89 the practice reopen banner is word for word and comes once per reopen; the log line carries the gpm, the skipped steps and the correct order', DI.FLOOD_BANNER === BAN && b1 === b0 + 1 && nb() === b1 && l1.length === 1 && said(a).length === 1 && /Skipped: replace the head \(step 7\); reset the valve at the riser \(step 8\); panel reset #2 and P \(step 12\)\. Correct order: replace the head \(step 7\), reset the valve at the riser \(step 8\), panel reset #2 to clear P \(step 12\), then open the control valve \(step 13\)\. In a data hall this is water on the IT load\.$/.test(l1[0].text) &&
      a.S.acts.find((q) => q.kind === 'reopen-flood').gpm > 1 && a.s.floodK === undefined, l1[0] && l1[0].text);
    const c = rig({ gate: true }); DI.breakSprinkler(c.S, c.head); run(c.S, 60, 0.25); R.shut(c); DI.setGate(c.S, c.g.id, 1); run(c.S, 10, 0.25); const k = c.s.floodK; smoke(c.S, 0.2, 10); run(c.S, 30, 0.25);
    ok('A89 the skipped steps are the ones that applied at the reopen: a set valve with P latched and a head open names steps 7 and 12 only', k === 5 && said(c).length === 1 && /Skipped: replace the head \(step 7\); panel reset #2 and P \(step 12\)\. Correct order/.test(said(c)[0].text));
    const e = rig({ gate: true }); e.v.p.mech = true; run(e.S, 30, 0.25); R.shut(e); const b2 = nb(); DI.setGate(e.S, e.g.id, 1); run(e.S, 40, 0.25);
    ok('A89 reopening with every head closed emits neither the banner nor the line', nb() === b2 && said(e).length === 0 && e.S.acts.some((q) => q.kind === 'reopen-warn') && !e.S.acts.some((q) => q.kind === 'reopen-flood'));
  }
  // A90 the 60 min refrigerated limit, per zone since Cycle 7 (the site flag is gone: A103), and the 2025 N2-only citation
  {
    const r = rig(), id = r.v.id, inf = () => r.S.sysd.info.get(id), a30 = DI.airSizing(r.S, id), s30 = DI.refillState(r.S, id); r.s.fillTime = 2136; const t30 = DI.refillText(r.S, id)[0];
    ok('A90 default: 30 min everywhere, nothing is stored, and a site flag is no longer read', DI.refillLimit(r.W, inf()) === 1800 && DI.refillLimit(r.W) === 1800 && DI.sizingMinutes(r.W, inf()) === 30 && s30.limit === 1800 && a30.limit === 30 && !('refrigerated' in r.W.cfg) && DI.refrigerated(r.W, inf()) === false && t30 === '35.6 min (measured, informational)' && DI.refillRef(r.W, inf()) === 'NFPA 13-2025 §8.2.7.3' &&
      (r.W.cfg.refrigerated = true, DI.refillLimit(r.W, inf()) === 1800 && DI.refrigerated(r.W, inf()) === false) && delete r.W.cfg.refrigerated);
    const cold = (o) => { const q = rig(Object.assign({ room: 'cold' }, o)); q.W.rooms[0].below5 = true; q.W.ver++; q.S.sync(); return q; };
    const b = rig({ room: 'cold' }), b30 = DI.airSizing(b.S, b.v.id), c = cold(), cid = c.v.id, cinf = () => c.S.sysd.info.get(cid); c.s.fillTime = 2136;
    const a60 = DI.airSizing(c.S, cid), s60 = DI.refillState(c.S, cid), t60 = DI.refillText(c.S, cid)[0]; c.W.byType('comp')[0].p.scfm = 0.5; const rv = DI.review(c.S).find((q) => q.text.includes('air supply')); c.W.byType('comp')[0].p.scfm = 5;
    ok('A90 a zone wholly in a freezer room held below 5 F: 60 min in the clock state, the sizing minimum halves, and the review text and the code-check line say 60 (the measured row carries no limit)', DI.refillLimit(c.W, cinf()) === 3600 && DI.sizingMinutes(c.W, cinf()) === 60 && s60.limit === 3600 && !s60.over && a60.limit === 60 && b30.limit === 30 && Math.abs(a60.min - b30.min / 2) < 1e-12 && Math.abs(a60.tAlone - b30.tAlone) < 1e-12 && t60 === '35.6 min (measured, informational)' && !!rv && /within 60 min/.test(rv.text) && rv.ref === 'NFPA 13-2025 §8.2.7.4' &&
      DI.codeCheckLine(c.S, cid) === 'Code check: largest zone alone, from 0 psig: ' + a60.tAlone.toFixed(1) + ' min. Limit 60 min (NFPA 13). Passes. [NFPA 13-2025 §8.2.7.4]' && (c.W.byType('comp')[0].p.scfm = 0.5, /Limit 60 min \(NFPA 13\)\. Fails: the compressor is too small for this zone\. Size it to refill the largest zone to normal pressure in 60 min\. \[NFPA 13-2025 §8\.2\.7\.4\]$/.test(DI.codeCheckLine(c.S, cid))) && (c.W.byType('comp')[0].p.scfm = 5, true), rv && rv.text);
    const ref = (ed, n2) => { const q = cold(); q.W.cfg.edition = ed; if (n2) { q.W.removePart(q.W.byType('comp')[0].id); q.W.addPart('n2', 14, 4, 0); q.S.sync(); } return DI.refillState(q.S, q.v.id).ref; };
    ok('A90 the 60 min cites: 2019 and 2022 §8.2.6.3.3 (N2-only §8.2.6.8.5), 2025 §8.2.7.4 for every source', ref('US-2019') === 'NFPA 13-2019 §8.2.6.3.3' && ref('US-2022') === 'NFPA 13-2022 §8.2.6.3.3' && ref('US-2019', true) === 'NFPA 13-2019 §8.2.6.8.5' && ref('US-2022', true) === 'NFPA 13-2022 §8.2.6.8.5' && ref('US-2025') === 'NFPA 13-2025 §8.2.7.4' && ref('US-2025', true) === 'NFPA 13-2025 §8.2.7.4');
    const n25 = rig(); n25.W.removePart(n25.W.byType('comp')[0].id); n25.W.addPart('n2', 14, 4, 0); n25.S.sync(); const jsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'juris.js'), 'utf8');
    ok('A90 2025 N2-only cites §8.2.7.3 and §8.2.7.4 with no ASSUMED wording anywhere', DI.refillState(n25.S, n25.v.id).ref === 'NFPA 13-2025 §8.2.7.3 (no separate N2-only clause in 2025; §8.2.7.6 has none)' && DI.JURIS['US-2025'].ref.refillN2Cold === 'NFPA 13-2025 §8.2.7.4' && !/N2-only subsection is not pulled|conservative reading/.test(jsrc + fs.readFileSync(path.join(__dirname, '..', 'src', 'gas.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'src', 'manual.js'), 'utf8')));
    DI.setJuris(new DI.World(4, 4));
  }
  // A91 persistence, and saves from before Cycle 6
  {
    const reload = (r, edit) => { const jw = JSON.parse(JSON.stringify(r.W.toJSON())), js = JSON.parse(JSON.stringify(r.S.dump())); if (edit) edit(jw, js); const W = DI.World.fromJSON(jw), S = new DI.Sim(W); S.live = true; S.restore(js); return { W, S, pn: W.parts.get(r.pn.id), v: W.parts.get(r.v.id), s: S.ss.get(r.v.id), g: r.g && W.parts.get(r.g.id), stn: r.stn && W.parts.get(r.stn.id), d: W.parts.get(r.d.id) }; };
    // mid-outage: an alarm at attempt 3, a silenced panel, and a both-channels-down clock
    const r = dactRig(); r.pn.p.chan = [0, 0]; r.S.step(1); r.stn.p.on = true; run(r.S, 200, 1); DI.silence(r.S, r.pn.id); run(r.S, 10, 1);
    const q = reload(r), same = JSON.stringify(q.S.dq) === JSON.stringify(r.S.dq) && q.S.dqSeq === r.S.dqSeq && r.S.dq.length === 2 && r.S.dq.every((e) => e.state === 'RETRY' && e.n === 3);
    q.S.step(1); const o = q.S.sig.get('mn' + q.stn.id), linked = !!o && o.q === q.S.dq.find((e) => e.key === o.key) && o.cut && !o.tx && q.S.dq.length === 2; run(q.S, 60, 1);
    ok('A91 a save made in an outage keeps the queue, the attempts, the original times, the outage start and the silence clock', same && linked && q.pn.p.silT === r.pn.p.silT && q.pn.p.silenced === true && q.pn.p.dnT === r.pn.p.dnT && q.S.dq.every((e) => e.n === 4 && e.state === 'RETRY') && q.S.dq.map((e) => e.t0).join() === r.S.dq.map((e) => e.t0).join() && quiet(q));
    q.pn.p.chan = [1, 1]; run(q.S, 60, 1); ok('A91 after the load the held alarm is still sent late, in order, when a channel returns', q.S.dq.filter((e) => !e.comm).every((e) => e.state === 'SENT' && e.t0 < r.S.t) && q.S.fd.called >= 0 && q.S.fd.log.late === true);
    // the return-to-normal step with an error on it, and an open AVC bypass
    const rt = retRig(); drain(rt, 'drain', 1, 3); rt.v.p.avcBy = 1; run(rt.S, 1, 0.25); const q2 = reload(rt);
    ok('A91 the pending return step, its error list and the open bypass survive save and load', q2.s.ret === true && JSON.stringify(q2.s.rtErr) === JSON.stringify(rt.s.rtErr) && rt.s.rtErr.length === 1 && JSON.stringify(q2.s.rtDr) === JSON.stringify(rt.s.rtDr) && q2.s.rtEv === null && q2.v.p.avcBy === 1 && q2.v.p.drain === 1 && ['rtErr', 'rtEv', 'rtDr', 'floodK'].every((k) => DI.SS_KEYS.includes(k)) && (run(q2.S, 5, 0.25), q2.s.rtErr.length === 1));
    // a Cycle 5 save: no AVC props, no battery props, no new settings, no queue
    const strip = (jw, js) => { for (const p of jw.parts) for (const k of ['avc', 'avcBy', 'ah', 'iStby', 'iAlarm', 'chgFail', 'battDisc', 'silT', 'dnT', 'dqNext', 'onGen']) delete p.p[k]; for (const k of ['dactHold', 'standby', 'panelGen', 'refrigerated']) delete jw.cfg[k]; delete js.dq; delete js.dqSeq; for (const x of js.ss) for (const k of ['rtErr', 'rtEv', 'rtDr', 'floodK']) delete x[1][k]; for (const x of js.sig) delete x[1].had; };
    const old = rig({ gate: true, stn: true }); run(old.S, 30, 1); const q5 = reload(old, strip); run(q5.S, 30, 1);
    ok('A91 a Cycle 5 save loads with hold ON, standby 24 h + 5 min, an AVC with its bypass closed and a 26 Ah panel, with no signal, no finding and no error', DI.dactHold(q5.W) === true && DI.standbyKey(q5.W) === 'nfpa5' && DI.refillLimit(q5.W) === 1800 && DI.panelGen(q5.W) === false && q5.v.p.avc === 1 && q5.v.p.avcBy === 0 && q5.pn.p.ah === 26 && q5.pn.p.iStby === 0.5 && q5.pn.p.iAlarm === 2 && q5.pn.p.chgFail === false && q5.pn.p.battDisc === false &&
      q5.S.sig.size === 0 && q5.S.dq.length === 0 && q5.s.state === 'dry' && q5.s.set && DI.impairments(q5.S).length === 0 && !DI.review(q5.S).some((f) => f.sev === 'fail' && /battery|cut-out/.test(f.text)) && DI.panelH(q5.W, q5.pn) === 24);
    // a Cycle 5 save made in an outage: the queue is made again from the saved signals, RETRY or HELD by age
    const mid = dactRig(); mid.pn.p.chan = [0, 0]; mid.S.step(1); mid.stn.p.on = true; run(mid.S, 300, 1); DI.setGate(mid.S, mid.g.id, 0); run(mid.S, 1000, 1); mid.pn.p.chgFail = true; run(mid.S, 100, 1);
    const q6 = reload(mid, (jw, js) => { strip(jw, js); for (const p of jw.parts) if (p.type === 'panel') p.p.chgFail = true; }), empty = q6.S.dq.length === 0; q6.S.step(1);
    const by = (k) => q6.S.dq.find((e) => e.key === k), want = (k) => mid.S.dq.find((e) => e.key === k);
    ok('A91 a Cycle 5 save made in an outage: on the first step the entries are made again with their original event times, RETRY or HELD by age', empty && q6.S.dq.length === mid.S.dq.length && ['mn' + mid.stn.id, 'tm' + mid.g.id, 'cf' + mid.pn.id].every((k) => by(k) && by(k).t0 === want(k).t0) && by('mn' + mid.stn.id).state === 'HELD' && by('tm' + mid.g.id).state === 'HELD' && by('cf' + mid.pn.id).state === 'RETRY' && q6.S.sig.has('dx' + mid.pn.id) === false && (q6.S.step(1), q6.S.sig.has('dx' + mid.pn.id)), q6.S.dq.map((e) => e.key + ':' + e.state).join());
    // the outage clock of the standby generator: a save made one hour into an outage on day three
    const gn = rig(); gn.W.cfg.panelGen = true; gn.S.warp(2.5 * 86400); gn.W.power = false; gn.S.step(1); gn.S.warp(3600); const g0 = gn.S.genT, wasOn = gn.pn.p.onGen === true, bh = gn.pn.p.battH;
    const qg = reload(gn); qg.S.step(1); const kept = qg.S.genT === g0 && qg.pn.p.onGen === true && qg.pn.p.alive && Math.abs(qg.pn.p.battH - bh) < 1e-9; qg.S.warp(22 * 3600); const still = qg.pn.p.onGen === true; qg.S.warp(3600 + 120);
    const og = reload(gn, (jw, js) => { delete js.genT; }); og.S.step(1);
    ok('A91 the outage clock is saved: one hour into an outage on day three the panel is still on the generator after a load, the generator still drops 24 h after the loss, and a save without the clock loads with the generator running', wasOn && g0 > 2 * 86400 && kept && still && qg.pn.p.onGen === false && og.pn.p.onGen === true && og.S.genT > 2 * 86400 && (() => { const pw = rig(); pw.S.warp(100); return reload(pw).S.genT === -1; })(), 'genT ' + Math.round(g0) + ' -> ' + Math.round(qg.S.genT));
    DI.setJuris(new DI.World(4, 4));
  }
  // A92 regression: the company locks, with everything of Cycle 6 switched on
  {
    ok('A92 the truth-table runner is 17 of 17 and the fixture is the pinned file', resTT.length === 17 && resTT.every((q) => q.ok) && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && TT.FIXTURE_SHA16 === 'cb3462b268359c6e');
    const worst = () => { const q = dactRig({ det: 'vesda' }); q.pn.p.chan = [0, 0]; q.pn.p.battH = 1; q.pn.p.chgFail = true; q.v.p.drain = 1; q.v.p.avcBy = 1; q.S.touch(); run(q.S, 5, 1); return q; };
    const w = worst(), lowB = w.S.sig.has('lb' + w.pn.id) && w.S.sig.has('dc' + w.pn.id); breakHead(w); const pOnly = w.v.p.pLatch === true && w.s.state === 'dry' && w.s.wat === 0; smoke(w.S, 0.2, 10); run(w.S, 20, 0.25);
    ok('A92 release = (D AND P) does not depend on the DACT, the battery or the drains: both channels down, the battery low, the charger failed, the main drain and the AVC bypass open, and it still releases on Fire 1 AND P and on nothing less', lowB && pOnly && w.s.tripT > 0 && w.v.p.solOut === true && w.s.state !== 'dry' && quiet(w));
    const f2 = worst(); smoke(f2.S, 1.5, 30); const la = worst(); la.v.p.avcBy = 0; la.v.p.airValve = 0; la.s.holes = 400; let n = 0; while (!la.S.sig.has('la' + la.v.id) && n++ < 4000) la.S.step(1); run(la.S, 60, 1);
    ok('A92 Fire 2 never releases alone, and low air is supervisory only and never a release input', f2.d.p.lvl === 4 && f2.v.p.sol === true && f2.v.p.pLatch === false && f2.v.p.solOut === false && f2.s.state === 'dry' && f2.s.wat === 0 && la.S.sig.get('la' + la.v.id).type === 'SUPV' && la.s.state === 'dry' && la.s.tripT < 0 && !/loAir|lowAir|hiAir|avc|drain|batt|chan|\bdq\b/.test(DI.relState.toString()));
    const W0 = new DI.World(4, 4), sch = Object.fromEntries(DI.signalSchedule(W0).map((q) => [q.key, q])), ev = (vec, cfg) => { const r = rig(); Object.assign(r.W.cfg, cfg); return DI.ceEval(r.W, r.v, vec); };
    ok('A92 the EPO hook is waterflow only and default OFF; the HVAC hook is never on Alert or Action; Alert, Action and P never dispatch', DI.epoHook(W0) === false && DI.hvacHook(W0) === 'none' && ev({ waterflow: true }, { epoHook: true }).epo && !ev({ fire1: true, p: true }, { epoHook: true }).epo && !ev({ alert: true }, { hvacHook: 'fire1' }).hvac && !ev({ action: true }, { hvacHook: 'fire2' }).hvac &&
      sch.alert.fd === 'No' && sch.action.fd === 'No' && sch.pLatch.fd === 'No' && !ev({ alert: true, action: true, p: true }, { sigClass: { alert: 'ALARM', action: 'ALARM', pLatch: 'ALARM' } }).fd && Object.keys(DI.SIG_FD).join() === 'fire1,fire2,manual,mrz,waterflow,spot');
    const head = fs.readFileSync(path.join(__dirname, '..', 'src', 'alarm.js'), 'utf8').split('\n').slice(0, 30).join('\n'), q = DI.PARTS.prev.props;
    ok('A92 DI.relState and the D logic at the top of alarm.js are not edited (the Cycle 4 hashes); setpoints stay 50 / 40 / 30 / 20; C stays 100; preaction has no release mode', sha16(DI.relState.toString()) === 'a19f3e39ec09d52e' && sha16(head) === '1581435a5c3a9485' && [q.hiAir, q.airSet, q.loAir, q.pTrip].join() === '50,40,30,20' && DI.pipeC() === 100 && !('mode' in q) && DI.inClass(W0, 'pLatch') === 'OPEN' && DI.inClass(W0, 'lowAir') === 'SUPV' && DI.inClass(W0, 'supplyAir') === 'TRBL');
    DI.setJuris(new DI.World(4, 4));
  }
  // ====================== Cycle 7 acceptance (A93 onward: hold-and-send keeps a live alarm, OPEN last, restorals and the
  // hazard case, the waterflow latch, the Finish gate and its dt-independent scoring, the AVC drift ceiling and the
  // optional bypass tamper, the per-zone refrigerated limit, sequential refill, the main drain follow-up, the Tutor
  // report lines and tiers, the VEA Fire 1 pick, the charger, persistence, and the company locks once more).
  // Every case is driven on a rig; nothing is copied from the fixture.
  const c7 = {};
  const reload7 = (r, edit) => { const jw = JSON.parse(JSON.stringify(r.W.toJSON())), js = JSON.parse(JSON.stringify(r.S.dump())); if (edit) edit(jw, js); const W = DI.World.fromJSON(jw), S = new DI.Sim(W); S.live = true; S.restore(js); const g = (x) => (x ? W.parts.get(x.id) : null); return { W, S, pn: g(r.pn), v: g(r.v), s: S.ss.get(r.v.id), g: g(r.g), stn: g(r.stn), d: g(r.d) }; };
  const sends = (r) => { const o = []; for (const e of r.S.dq) { if (e.sentT >= 0) o.push([e.sentT, e.comm ? 'COMM' : e.kind === 'rest' ? 'REST' : e.cls, e]); if (e.rsT >= 0) o.push([e.rsT, 'REST', e]); } return o.sort((a, b) => a[0] - b[0]); };
  const fdCalls = (r) => r.S.log.filter((l) => /Fire department dispatched/.test(l.text)).length;
  // A93 hold OFF keeps a live alarm
  {
    // both channels down; (ii) an alarm raised and cleared inside the outage (the manual station, then a reset); (i) an alarm raised
    // and still active past the 900 s (the spot detector, latched at the panel); then one channel comes back
    const scene = (hold) => { const r = dactRig(); if (hold === false) r.W.cfg.dactHold = false; r.pn.p.chan = [0, 0]; r.S.step(1);
      r.stn.p.on = true; run(r.S, 5, 1); const tB = r.S.sig.get('mn' + r.stn.id).t0; r.stn.p.on = false; DI.panelReset(r.S, r.pn.id); run(r.S, 5, 1);
      smoke(r.S, 2, 2); r.S.smoke[1] = 0; const kA = 's' + r.d.id, tA = r.S.sig.get(kA).t0; run(r.S, 1000, 1);
      const a = ent(r, kA)[0], b = ent(r, 'mn' + r.stn.id)[0], st = a.state + ',' + b.state, q0 = quiet(r), live = r.S.sig.has(kA) && !r.S.sig.has('mn' + r.stn.id);
      r.pn.p.chan = [1, 0]; r.S.step(1); const tR = r.S.t; run(r.S, 200, 1); return Object.assign(r, { a, b, tA, tB, tR, st, q0, live, kA }); };
    const off = scene(false), on = scene();
    ok('A93 hold OFF, an alarm still active at 1,000 s (HELD): it is not dropped. On restore it is sent with its original event time, and the fire department is called at that send', off.st === 'HELD,HELD' && off.q0 && off.live && off.a.state === 'SENT' && off.a.t0 === off.tA && off.a.sentT === off.tR && off.S.sig.get(off.kA).tx === true && called(off) && off.S.fd.called === off.tR && off.S.fd.log.late === true && fdCalls(off) === 1, off.S.dq.map((e) => e.key + ':' + e.state).join());
    const nots = off.S.log.filter((l) => l.text.startsWith('NOT SENT (hold off'));
    ok('A93 hold OFF, an alarm raised and cleared inside the outage: DROPPED with why "hold", never sent, no restoral, and one log line each that names the clear time', off.b.state === 'DROPPED' && off.b.why === 'hold' && off.b.sentT === undefined && off.b.rsT === undefined && !off.b.rs && nots.length === 2 && nots.every((l) => /^NOT SENT \(hold off, cleared \d\d:\d\d\): MANUAL PULL, ZONE .* \(event \d\d:\d\d\)$/.test(l.text) && l.cls === 'warn') &&
      !off.S.acts.some((q) => q.kind === 'restoral' && /^m[ns]/.test(q.key)) && DI.stationQueue(off.S).filter((q) => q.label === 'NOT SENT (hold off)').length === 2);
    ok('A93 hold ON is as in Cycle 6 for both: the cleared alarm is sent late with its event and clear times, the live one too, and the dispatch is at the first send', on.st === 'HELD,HELD' && on.b.state === 'SENT' && on.b.t0 === on.tB && on.b.tClr > on.tB && on.b.sentT === on.tR && on.a.state === 'SENT' && on.a.t0 === on.tA && on.a.sentT === on.tR + 2 * DI.DACT_SEND_S && called(on) && on.S.fd.called === on.tR && on.S.fd.log.late === true &&
      on.S.log.some((l) => /^SENT \d\d:\d\d \(late\): MANUAL PULL, ZONE .* \(event \d\d:\d\d, cleared \d\d:\d\d before sending\)$/.test(l.text)) && DI.dactHold(on.W) === true && !('dactHold' in on.W.cfg));
    const src = DI.dactStep.toString();
    ok('A93 static: the hold-OFF test drops only an entry that has cleared, never one for being HELD', /!hold && e\.tClr !== undefined && e\.kind !== 'rest'/.test(src) && !/!hold && \(?e\.state === 'HELD'/.test(src) && !/hold[^;\n]*e\.state === 'HELD'/.test(src));
    c7.off = off; c7.on = on;
  }
  // A94 restore order, OPEN last
  {
    // in the outage: a trouble (charger), a supervisory (tamper, and low air once the air is let out), an OPEN (P latched on El/El),
    // then an alarm (the spot detector); before them an alarm that came and went (the manual station), so that restorals follow
    const r = dactRig(); r.pn.p.chan = [0, 0]; r.S.step(1);
    r.stn.p.on = true; run(r.S, 5, 1); r.stn.p.on = false; DI.panelReset(r.S, r.pn.id); run(r.S, 5, 1);
    r.pn.p.chgFail = true; run(r.S, 10, 1); DI.setGate(r.S, r.g.id, 0); run(r.S, 10, 1);
    r.v.p.airValve = 0; r.v.p.sdrain = 1; r.S.touch(); run(r.S, 4, 0.1); r.v.p.sdrain = 0; r.S.touch(); run(r.S, 6, 1); const open = r.S.sig.get('pl' + r.v.id);
    smoke(r.S, 2, 2); r.S.smoke[1] = 0; run(r.S, 10, 1);
    const t0s = Object.fromEntries(r.S.dq.map((e) => [e.key, e.t0])), before = quiet(r) && r.S.dq.every((e) => e.state === 'RETRY') && !!open && open.type === 'OPEN' && r.s.state === 'dry' && r.s.wat === 0;
    r.pn.p.chan = [0, 1]; r.S.step(1); const tR = r.S.t; run(r.S, 200, 1);
    const sq7 = sends(r), order = sq7.map((q) => q[1]).join(), gaps = sq7.slice(1).map((q, i) => q[0] - sq7[i][0]);
    ok('A94 on restore: alarm, alarm, alarm, supervisory, supervisory, trouble, then OPEN, 10 s apart; then the restorals; then the communications failure and its restoral', before && order === 'ALARM,ALARM,ALARM,SUPV,SUPV,TRBL,OPEN,REST,REST,COMM' && gaps.every((x) => x === DI.DACT_SEND_S) && sq7[0][0] === tR && sq7[6][2].key === 'pl' + r.v.id && sq7[9][2].comm === true, order + ' gaps ' + gaps.join());
    ok('A94 each original keeps its event time, earlier than the restore; OPEN is sent last of the originals and never dispatches by itself', r.S.dq.filter((e) => !e.comm).every((e) => e.t0 === t0s[e.key] && e.t0 < tR) && fdCalls(r) === 1 && r.S.fd.called === tR && r.S.dq.find((e) => e.key === 'pl' + r.v.id).fd === false && r.S.sig.get('pl' + r.v.id).fd === false && r.S.sig.get('pl' + r.v.id).tx === true);
    const o = dactRig(); o.pn.p.chan = [0, 0]; o.S.step(1); o.v.p.airValve = 0; o.v.p.sdrain = 1; o.S.touch(); run(o.S, 4, 0.1); o.v.p.sdrain = 0; o.S.touch(); run(o.S, 20, 1); o.pn.p.chan = [1, 1]; run(o.S, 60, 1); const so = sends(o).map((q) => q[1]).join();
    ok('A94 a latched P alone in the outage: sent after the low-air supervisory, as OPEN, and nobody is called', so === 'SUPV,OPEN,COMM' && quiet(o) && o.S.sig.get('pl' + o.v.id).type === 'OPEN', so);
    const src = DI.dactStep.toString();
    ok('A94 static: rank gives ALARM 0, SUPV 1, TRBL 2, OPEN 3 and the communications failure 4; originals, then restorals, then the communications failure', /e\.comm \? 4 : e\.cls === 'ALARM' \? 0 : e\.cls === 'SUPV' \? 1 : e\.cls === 'TRBL' \? 2 : 3/.test(src) && /e\.comm \? 2 : e\.rs \|\| e\.kind === 'rest' \? 1 : 0/.test(src) && /phase\(a\) - phase\(b\) \|\| rank\(a\) - rank\(b\) \|\| a\.t0 - b\.t0/.test(src));
  }
  // A95 waterflow latches until reset
  {
    const wetRig = () => { const W = new DI.World(40, 14); W.addRoom('office', 20, 2, 12, 8); W.addPart('city', 1, 6, 0); hline(W, 2, 9, 6, 6); const g = W.addPart('gate', 10, 6, 0); hline(W, 11, 13, 6, 6);
      const v = W.addPart('wetv', 14, 6, 0); hline(W, 15, 19, 6, 6); for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true); grid(W, 21, 2, 31, 9); const pn = W.addPart('panel', 14, 4, 0); W.wire(pn.id, v.id); W.wire(pn.id, g.id);
      const S = new DI.Sim(W); S.commission(); return { W, S, v, s: S.ss.get(v.id), pn, g }; };
    const wf = (r) => r.S.sig.get('wf' + r.v.id);
    // wet: the inspector's test connection opened by hand (no test procedure), then closed
    const w = wetRig(); w.v.p.itc = 1; w.S.touch(); run(w.S, 60, 0.25); const wOn = w.s.alarm === true && !!wf(w) && wf(w).text === 'WATERFLOW - ' + DI.sysName(w.S, w.v.id) && !wf(w).hold && w.v.p.wfL === true, mOn = DI.panelReset(w.S, w.pn.id), kept = w.v.p.wfL === true && w.S.log.some((l) => /Panel reset, but 1 detector\(s\), manual station\(s\) or waterflow switch\(es\) are still in alarm\./.test(l.text));
    w.v.p.itc = 0; w.S.touch(); run(w.S, 60, 0.25); const wLat = w.s.alarm === false && !!wf(w) && wf(w).hold === true && wf(w).type === 'ALARM' && wf(w).text === 'WATERFLOW - ' + DI.sysName(w.S, w.v.id) + ' (latched: reset the panel)' && w.v.p.wfL === true; DI.panelReset(w.S, w.pn.id); w.S.step(0.25);
    ok('A95 wet: water flows 60 s, a reset then says still in alarm and keeps it; the flow stops and the signal stays, marked latched; a reset after that clears it', wOn && mOn === '' && kept && wLat && !wf(w) && w.v.p.wfL === false);
    // preaction: tripped by the mechanical release, then the control valve closed and the pipe drained
    const p = rig({ gate: true }); p.v.p.mech = true; run(p.S, 60, 0.25); const pOn = p.s.alarm && !!wf(p) && p.v.p.wfL === true; DI.panelReset(p.S, p.pn.id); const pKept = p.v.p.wfL === true; DI.setGate(p.S, p.g.id, 0); run(p.S, 8, 0.25); p.v.p.sdrain = 1; p.S.touch(); let n = 0; while (p.s.alarm && n++ < 20000) p.S.step(0.25); run(p.S, 5, 0.25);
    const pLat = !p.s.alarm && !!wf(p) && wf(p).hold === true && /\(latched: reset the panel\)$/.test(wf(p).text), row = DI.ceMatrix(p.S, p.v.id).rows.find((q) => q.key === 'waterflow'); DI.panelReset(p.S, p.pn.id); p.S.step(0.25);
    // dry: tripped through the inspector's test connection left open by hand
    const d = dryRig(); d.v.p.itc = 1; d.S.touch(); n = 0; while (!d.s.alarm && n++ < 4000) d.S.step(0.25); run(d.S, 5, 0.25); const dOn = d.s.alarm && d.v.p.wfL === true; DI.panelReset(d.S, d.pn.id); d.S.step(0.25);
    ok('A95 preaction and dry: the same latch; with water still in the pipe a reset keeps the alarm, and the matrix row reads ACTIVE NOW while only the latch holds it', pOn && pKept && pLat && row.live === true && !wf(p) && p.v.p.wfL === false && dOn && d.v.p.wfL === true && !!wf(d) && DI.PARTS.wetv.props.wfL === false && DI.PARTS.dryv.props.wfL === false && DI.PARTS.prev.props.wfL === false);
    // dispatch is unchanged: a latched alarm whose flow is over starts no dispatch; a live one does, once
    const q = wetRig(); q.v.p.itc = 1; q.S.touch(); run(q.S, 60, 0.25); q.v.p.itc = 0; q.S.touch(); run(q.S, 60, 0.25); q.S.live = true; run(q.S, 120, 1); const noCall = quiet(q) && wf(q).hold === true && wf(q).fd === true && wf(q).tx === true;
    q.v.p.itc = 1; q.S.touch(); run(q.S, 60, 0.25); const again = called(q) && fdCalls(q) === 1 && !wf(q).hold && q.S.log.some((l) => /^WATERFLOW again on .*: the alarm was still latched from the earlier flow \(the panel was not reset\)\.$/.test(l.text) && l.cls === 'bad');
    ok('A95 dispatch: a waterflow alarm held by the latch alone calls nobody; a new flow on the latched zone is a live alarm again and dispatches once', noCall && again);
    // a dead panel holds no latch; an unwired valve has none
    const dd = wetRig(); dd.v.p.itc = 1; dd.S.touch(); run(dd.S, 60, 0.25); dd.v.p.itc = 0; dd.S.touch(); run(dd.S, 60, 0.25); const had = dd.v.p.wfL === true; dd.W.power = false; dd.pn.p.battH = 0; dd.S.step(1); const dark = dd.v.p.wfL === false; dd.W.power = true; run(dd.S, 3, 1);
    const u = wetRig(); u.W.unwire(u.v.id); u.S.sync(); u.v.p.itc = 1; u.S.touch(); run(u.S, 60, 0.25); const loc = !!wf(u) && wf(u).mon === false && u.v.p.wfL === false; u.v.p.itc = 0; u.S.touch(); run(u.S, 60, 0.25);
    ok('A95 a dead panel holds no latch (nothing comes back with the power), and a valve wired to no panel has none', had && dark && !wf(dd) && dd.v.p.wfL === false && loc && !wf(u));
    // the inspector's test procedure and the switch are unchanged; a flow raised on test does not latch
    const t = wetRig(), m = DI.startTest(t.S, 'itc', t.v.id); n = 0; while (t.S.procs.length && n++ < 4000) t.S.step(0.25); const res = DI.lastResult(t.S, 'itc', t.v.id); run(t.S, 120, 0.25);
    ok('A95 the timed inspector’s test still passes on the switch itself; its waterflow is on test, does not latch, and clears when the flow stops (SIMPLIFICATION)', m === '' && !!res && res.pass && res.val > 0 && res.val <= 90 && t.v.p.wfL === false && !wf(t) && !/wfL/.test(DI.gasPost.toString() + DI.testStep.toString() + DI.startTest.toString() + DI.relState.toString()) && /s\.alarm = s\.flowT >= 30/.test(DI.gasPost.toString()));
    const old = DI.migratePart({ id: 1, type: 'wetv', x: 0, y: 0, rot: 0, p: { drain: 0, itc: 0 } }), oldD = DI.migratePart({ id: 2, type: 'dryv', x: 0, y: 0, rot: 0, p: { airSet: 40, hiAir: 50, loAir: 30 } }), oldP = DI.migratePart({ id: 3, type: 'prev', x: 0, y: 0, rot: 0, p: { trim: 'el-el', airSet: 40, hiAir: 50, loAir: 30, pTrip: 20 } });
    ok('A95 an old save gets no latch on any of the three valve types', old.p.wfL === false && oldD.p.wfL === false && oldP.p.wfL === false);
  }
  // A96 late alarm and restoral
  {
    const on = c7.on, off = c7.off, lab = DI.stationQueue(on.S).find((q) => q.id === on.b.id).label, rsLog = on.S.log.filter((l) => /^RESTORAL \d\d:\d\d \(late\): MANUAL PULL, ZONE .* \(event \d\d:\d\d, restored \d\d:\d\d\)$/.test(l.text));
    ok('A96 hold ON, an alarm raised and cleared inside the outage: sent late, the fire department is dispatched at that send, and its restoral follows after every unsent original', on.b.state === 'SENT' && on.S.fd.called === on.b.sentT && on.b.rsT > on.a.sentT && on.b.rsT === on.tR + 3 * DI.DACT_SEND_S && !on.b.rs && /^SENT \d\d:\d\d \(late\), RESTORAL \d\d:\d\d$/.test(lab) && rsLog.length === 2 &&
      on.S.acts.filter((q) => q.kind === 'restoral' && q.key === 'mn' + on.stn.id && q.cls === 'ALARM' && q.id === on.pn.id).length === 1, lab);
    ok('A96 a restoral dispatches nothing, and a dropped signal has none', fdCalls(on) === 1 && on.S.dq.filter((e) => e.rsT >= 0).every((e) => e.rsT > on.S.fd.called) && off.b.state === 'DROPPED' && off.b.rsT === undefined && !off.S.log.some((l) => /^RESTORAL/.test(l.text) && /MANUAL PULL/.test(l.text)));
    // live path: a channel is up, a signal the station has clears
    const l = liveRig({ gate: true }); DI.setGate(l.S, l.g.id, 0); run(l.S, 8, 0.25); const tx = l.S.sig.get('tm' + l.g.id).tx === true, t0 = l.S.sig.get('tm' + l.g.id).t0; DI.setGate(l.S, l.g.id, 1); run(l.S, 8, 0.25); const ll = l.S.log.filter((x) => /^RESTORAL to station: /.test(x.text)), la = l.S.acts.filter((q) => q.kind === 'restoral');
    ok('A96 live path: a sent signal that clears logs one RESTORAL to station with its event and restore times, and one restoral entry in the operator log', tx && !l.S.sig.has('tm' + l.g.id) && ll.length === 1 && /^RESTORAL to station: VALVE TAMPER - control valve #\d+ .* \(event \d\d:\d\d, restored \d\d:\d\d\)$/.test(ll[0].text) && la.length === 1 && la[0].key === 'tm' + l.g.id && la[0].cls === 'SUPV' && la[0].id === l.pn.id && t0 > 0 && quiet(l));
    const fa = liveRig({ det: 'smoke' }); smoke(fa.S, 2, 3); fa.S.smoke[1] = 0; run(fa.S, 30, 1); const still = fa.S.sig.has('s' + fa.d.id) && !fa.S.acts.some((q) => q.kind === 'restoral'); DI.panelReset(fa.S, fa.pn.id); fa.S.step(1);
    ok('A96 a fire alarm restores with the panel reset, not when the smoke clears: its restoral follows the reset', still && !fa.S.sig.has('s' + fa.d.id) && fa.S.acts.filter((q) => q.kind === 'restoral' && q.key === 's' + fa.d.id && q.cls === 'ALARM').length === 1);
    // a signal the station already has, cleared in a later outage: a restoral is queued, and hold OFF does not drop it
    const again = (hold) => { const r = dactRig(); if (hold === false) r.W.cfg.dactHold = false; DI.setGate(r.S, r.g.id, 0); run(r.S, 8, 0.25); const had = r.S.sig.get('tm' + r.g.id).tx === true; r.pn.p.chan = [0, 0]; r.S.step(1); DI.setGate(r.S, r.g.id, 1); run(r.S, 8, 0.25);
      const e = r.S.dq.find((x) => x.kind === 'rest'), pre = had && !!e && e.key === 'tm' + r.g.id && e.state === 'RETRY' && e.cls === 'SUPV' && e.tClr > e.t0 && r.S.dq.length === 1 && !r.S.log.some((x) => /^RESTORAL/.test(x.text)) && DI.dactLabel(e) === 'RESTORAL, RETRYING 1 of 10';
      r.pn.p.chan = [1, 1]; run(r.S, 30, 1); return pre && e.state === 'SENT' && /^RESTORAL \d\d:\d\d \(late\)$/.test(DI.dactLabel(e)) && r.S.acts.filter((x) => x.kind === 'restoral' && x.key === 'tm' + r.g.id).length === 1 && r.S.log.filter((x) => /^RESTORAL \d\d:\d\d \(late\): VALVE TAMPER/.test(x.text)).length === 1 && sends(r).map((x) => x[1]).join() === 'REST,COMM'; };
    ok('A96 a signal already at the station that clears in a later outage queues a restoral; it is sent on restore, hold ON and hold OFF alike (never dropped)', again() && again(false));
    const ver = (cfg) => { const r = liveRig({ gate: true }); Object.assign(r.W.cfg, cfg); DI.setGate(r.S, r.g.id, 0); run(r.S, 8, 0.25); DI.setGate(r.S, r.g.id, 1); run(r.S, 8, 0.25); return r.S.log.find((x) => /^RESTORAL to station: /.test(x.text)).text; };
    const v19 = ver({ ed72: '2019' }), vca = ver({ edition: 'CA-2019' }), v22 = ver({ ed72: '2022' }), v25 = ver({});
    ok('A96 the restoral text carries no mark in any edition (Cycle 8: the 2019 text is held, so US-2019 and CA-2019 drop VERIFY)', !/VERIFY|not on disk/.test(v19 + vca + v22 + v25) && /\(event \d\d:\d\d, restored \d\d:\d\d\)$/.test(v19) && /\(event \d\d:\d\d, restored \d\d:\d\d\)$/.test(vca) && DI.REF72[2019].restoral === 'NFPA 72-2019 §26.2.5.1' && DI.REF72[2022].restoral === 'NFPA 72-2022 §26.2.5.1' && DI.REF72[2025].restoral === 'NFPA 72-2025 §26.2.5.1' && DI.REF72[2025].retransmit === 'NFPA 72-2025 §26.2.1.2' && DI.REF72[2019].retransmit === 'NFPA 72-2019 §26.2.1.2', v19);
    DI.setJuris(new DI.World(4, 4));
  }
  // A97 the hazard case
  {
    const r = dactRig(); r.pn.p.chan = [0, 0]; r.S.step(1); smoke(r.S, 2, 2); r.S.smoke[1] = 0; run(r.S, 60, 1); const e = ent(r, 's' + r.d.id)[0], pre = !!e && e.state === 'RETRY' && quiet(r);
    r.W.power = false; r.pn.p.battH = 0; r.S.step(1); const row = DI.stationQueue(r.S).find((q) => q.id === e.id), bad = r.S.log.filter((l) => l.cls === 'bad');
    ok('A97 an entry queued when the panel dies is DROPPED with why "dead", and the queue row reads NOT SENT (panel dead): HAZARD CASE', pre && r.pn.p.alive === false && e.state === 'DROPPED' && e.why === 'dead' && row.label === 'NOT SENT (panel dead): HAZARD CASE' && row.hazard === true && DI.DACT_HAZARD_LABEL === row.label && DI.dactLabel(e) === row.label);
    ok('A97 the log line is bad, the hazard text is shown once, and it names the 6 h test and says the passer-by call is not an NFPA 72 path', bad.some((l) => /^NOT SENT \(panel dead\): HAZARD CASE: SMOKE DETECTION - .* \(event \d\d:\d\d\)$/.test(l.text)) && bad.filter((l) => l.text === 'Panel #' + r.pn.id + ' is dead with signals still queued. ' + DI.DACT_HAZARD).length === 1 &&
      DI.DACT_HAZARD === 'No alarm reaches the supervising station from this panel and nothing is dispatched from its signals. The station can learn the premises is down only from its own missed 6 h test, which it treats as a trouble (NFPA 72 §26.6.4.2.5(6), §26.6.4.3.2.8; the annunciation time is ASSUMED). The passer-by 911 call in this game is not an NFPA 72 path.' &&
      /§26\.6\.4\.1\.5\(6\), §26\.6\.4\.2\.2\(H\)/.test(DI.dactHazard({ cfg: { ed72: '2019' } })) && DI.dactHazard(r.W) === DI.DACT_HAZARD && /A passer-by called 911 \(not an NFPA 72 path\)\. Fire department dispatched \(late\)\./.test(DI.alarmStep.toString()));
    r.W.power = true; r.pn.p.chan = [1, 1]; run(r.S, 120, 1);
    ok('A97 nothing is dispatched from that panel’s signals, then or after power and the channels are back; the entry stays not sent', quiet(r) && e.state === 'DROPPED' && e.sentT === undefined && !e.rs && !r.S.acts.some((q) => q.kind === 'restoral') && !/6 h|missed/.test(DI.dactStep.toString().replace(/\/\/.*$/gm, '')));
  }
  // A98 the Finish gate
  {
    const P = { airSet: 30, loAir: 25, hiAir: 45 }, fresh = (props) => retRig(props || P);
    const c = fresh(); DI.bleedToNormal(c.S, c.v.id); run(c.S, 1000, 1); const waits = c.s.ret === true && DI.returnReady(c.S, c.v.id) && DI.returnStep(c.S, c.v.id).mode === 'ready' && DI.returnStep(c.S, c.v.id).text === 'All conditions met. Press Finish return to normal.' && !c.S.acts.some((a) => a.kind === 'return-normal') && c.S.log.filter((l) => l.text.endsWith(': All conditions met. Press Finish return to normal.')).length === 1;
    const m = DI.returnFinish(c.S, c.v.id), act = c.S.acts.filter((a) => a.kind === 'return-normal'), res = DI.lastResult(c.S, 'return', c.v.id);
    ok('A98 with every condition true the step does not end by itself in 1,000 s; Finish ends it, logs one return-normal entry with its error list, and the result reads the clean-pass sentence', waits && m === '' && c.s.ret === false && act.length === 1 && act[0].err === 0 && Array.isArray(act[0].errs) && act[0].errs.length === 0 && res.pass === true && res.lines.length === 1 &&
      res.lines[0] === 'Clean return to normal. Air held above low air, both panel resets were done in order, drains were closed, the control valve is fully open, and supervision is back to normal.' && DI.returnFinish(c.S, c.v.id) === 'No return to normal is pending on this zone.');
    // each blocker alone: refused, one error that names exactly that cause, the step stays pending; a second press with the same blocker set is refused again and is NOT a second error (Cycle 8, FP Lead)
    const block = (name, set, want) => { const r = fresh(); if (name !== 'band') DI.bleedToNormal(r.S, r.v.id); set(r); const n0 = (r.s.rtErr || []).length, ready0 = DI.returnReady(r.S, r.v.id), gate0 = DI.returnGate(r.S, r.v.id).ok, t1 = DI.returnFinish(r.S, r.v.id), e1 = r.s.rtErr[n0], miss = e1 && e1.miss ? e1.miss.join('|') : '?', one = r.s.rtErr.length === n0 + 1 && e1.why === 'finish-early' && r.s.ret === true;
      const t2 = DI.returnFinish(r.S, r.v.id), early = r.S.acts.filter((a) => a.kind === 'return-early'), two = r.s.rtErr.length === n0 + 1 && r.s.rtPress === 2 && r.s.rtLast.join('|') === want && r.s.ret === true && early.length === 2 && early[0].n === 1 && early[0].newErr === true && early[1].n === 2 && early[1].newErr === false && !r.S.acts.some((a) => a.kind === 'return-normal');
      const good = !ready0 && !gate0 && miss === want && one && two && t1 === 'Finish was pressed before the zone was ready: ' + want.replace(/\|/g, '; ') + '. Close every drain. Bring air into the normal band, above low air and above the P set point. Reset the panel to clear the pressure-loss (P) latch. Clear any supervisory signal (low air, high air, AVC bypass, valve off normal). Then press Finish.' && t2 === t1; return good ? '' : name + ' [' + miss + ']'; };
    const badB = [block('drain', (r) => { r.v.p.sdrain = 1; r.S.touch(); r.S.step(0.02); }, 'a drain is open'), block('main drain', (r) => { DI.setGate(r.S, r.g.id, 0); run(r.S, 6, 0.25); r.v.p.drain = 1; r.S.touch(); r.S.step(0.25); DI.setGate(r.S, r.g.id, 1); }, 'a drain is open|a supervisory is active: control valve off normal'),
      block('band', () => {}, 'the pressure is not in the normal band'),
      block('P latched', (r) => { r.v.p.sdrain = 1; r.S.touch(); let n = 0; while (!r.v.p.pLatch && n++ < 5000) r.S.step(0.02); r.v.p.sdrain = 0; r.S.touch(); refillTo(r, 27.5); }, 'P is still latched'),
      block('high air', (r) => { r.v.p.hiAir = 29; r.S.step(0.25); }, 'a supervisory is active: high air'), block('AVC bypass', (r) => { r.v.p.avcBy = 1; r.S.step(0.25); }, 'the AVC bypass is open'),
      block('valve off normal', (r) => { DI.setGate(r.S, r.g.id, 0); run(r.S, 6, 0.25); }, 'a supervisory is active: control valve off normal'), block('low air', (r) => { r.v.p.loAir = 32; r.v.p.airSet = 33; r.S.step(0.25); }, 'a supervisory is active: low air')].filter(Boolean);
    ok('A98 a drain open, pressure outside the band, P latched, high air, the AVC bypass open and the valve off normal each refuse Finish: one finish-early error naming exactly that cause, the step stays pending, and a second press with the same blockers is refused with the same text and adds no error (one error per unchanged blocker set)', badB.length === 0, badB.join('; ') || undefined);
    const rr = fresh(), states = []; states.push(DI.returnReady(rr.S, rr.v.id) === DI.returnGate(rr.S, rr.v.id).ok); DI.bleedToNormal(rr.S, rr.v.id); rr.S.step(0.25); states.push(DI.returnReady(rr.S, rr.v.id) === true && DI.returnGate(rr.S, rr.v.id).ok === true); rr.v.p.drain = 1; states.push(DI.returnReady(rr.S, rr.v.id) === false && DI.returnGate(rr.S, rr.v.id).ok === false); rr.v.p.drain = 0; DI.returnFinish(rr.S, rr.v.id);
    ok('A98 DI.returnReady is true exactly when the gate is, and false once the step is over; nothing in the watch ends the step', states.every(Boolean) && DI.returnReady(rr.S, rr.v.id) === false && !/s\.ret = false/.test(DI.returnWatch.toString()) && (DI.gasPre.toString().match(/DI\.returnAbort\(/g) || []).length === 1 && /s\.ret = false/.test(DI.returnFinish.toString()) && DI.RT_RANK['finish-early'] === 0 && !('drain-open' in DI.RT_RANK) && !('drain-open' in DI.RT_TEXT));
  }
  // A99 the scoring is independent of the time step
  {
    const DTS = [0.05, 0.1, 0.25, 0.5, 1], openFor = (dt, sec) => { const r = retRig(), t0 = r.S.t, P0 = r.s.P; r.v.p.sdrain = 1; r.S.touch(); let el = 0; while (el < sec - 1e-9) { const h = Math.min(dt, sec - el); r.S.step(h); el += h; } r.v.p.sdrain = 0; r.S.touch(); r.S.step(0.02); return Object.assign(r, { t0, P0, el }); };
    const a = DTS.map((dt) => openFor(dt, 0.6)), Ps = a.map((r) => r.s.P), spread = Math.max(...Ps) - Math.min(...Ps);
    ok('A99 the system drain open 0.6 s at dt 0.05, 0.1, 0.25, 0.5 and 1: the end pressure agrees within 1 psi and the errors are the same at every dt (none: coaching only)', spread < 1 && a.every((r) => errs(r) === '' && coached(r) === 1 && r.s.ret === true && Math.abs(r.S.t - r.t0 - 0.62) < 1e-9 && r.s.P > r.v.p.loAir && r.s.P < r.P0 - 5), Ps.map((x) => x.toFixed(2)).join(' / '));
    // the reference crossing of low air, from a fine run: pressure against time, interpolated
    const f = retRig(), ft0 = f.S.t; f.v.p.sdrain = 1; f.S.touch(); let pp = f.s.P, tLow = null, tP = null, n = 0;
    while (tP === null && n++ < 4000) { f.S.step(0.01); const el = f.S.t - ft0; if (tLow === null && f.s.P < 25) tLow = el - 0.01 * (1 - (pp - 25) / (pp - f.s.P)); if (f.s.P < 20) tP = el; pp = f.s.P; }
    const close = (tLow + tP) / 2, b = DTS.map((dt) => openFor(dt, close)), tErr = b.map((r) => (r.s.rtErr[0] ? r.s.rtErr[0].t - r.t0 : NaN));
    ok('A99 left open long enough to cross low air (and not P): exactly one low-air error at every dt, its event time within one sub-step of the interpolated crossing', tLow > 0.3 && tP > tLow + 0.1 && b.every((r) => errs(r) === 'low-air' && r.s.rtErr.length === 1 && r.v.p.pLatch === false) && tErr.every((t) => Math.abs(t - tLow) <= DI.RET_SUBSTEP + 1e-9) && DI.RET_SUBSTEP === 0.1, 'crossing ' + tLow.toFixed(3) + ' s; scored at ' + tErr.map((t) => t.toFixed(3)).join(' / '));
    const src = DI.Sim.prototype.step.toString(), iSplit = src.indexOf('DI.retDrainOpen(this)'), iT = src.indexOf('this.t += dt'), iC = src.indexOf('if (this.coarse) return');
    const one = retRig(); one.v.p.sdrain = 1; one.S.touch(); const t1 = one.S.t, was = DI.retDrainOpen(one.S); one.S.step(1); const exact = one.S.t === t1 + 1; const idle = retRig(), t2 = idle.S.t; idle.S.step(1);
    const md = retRig(); md.v.p.drain = 1; md.S.touch(); const noMd = DI.retDrainOpen(md.S) === false, plain = rig(); plain.v.p.sdrain = 1; plain.S.touch();
    ok('A99 Sim.step splits a step above DI.RET_SUBSTEP only while a return-step system drain is letting air out, before the clock advances and before the coarse return; time is not double counted', iSplit > 0 && iSplit < iT && iT < iC && was === true && exact && idle.S.t === t2 + 1 && DI.retDrainOpen(idle.S) === false && noMd && DI.retDrainOpen(plain.S) === false && (run(one.S, 60, 1), one.s.P <= DI.SAFE_PSI && DI.retDrainOpen(one.S) === false));
    // a tick that dips below low air and comes back is still scored: the watch reads the lowest pressure of the tick
    const dip = retRig(); DI.bleedToNormal(dip.S, dip.v.id); dip.S.step(0.02); dip.s.rtP0 = 24; const lowFlag = dip.s.lowAir; DI.returnWatch(dip.S, dip.v.id, dip.v, dip.s, false, 0.1);
    ok('A99 a step that dips below low air and returns inside one tick still scores, through the minimum pressure of the tick', lowFlag === false && dip.s.P > 25 && dip.s.rtMin === 24 && errs(dip) === 'low-air' && dip.s.rtEv === null && ['rtMin', 'rtP0'].every((k) => DI.SS_KEYS.includes(k)) && /Math\.min\(P0, s\.P\)/.test(DI.returnWatch.toString()));
  }
  // A101 the AVC bypass drift ceiling
  {
    const T = (props) => { const r = rig(); Object.assign(r.W.byType('comp')[0].p, props); return DI.bypassTarget(r.W, r.S.sysd.info.get(r.v.id)); };
    ok('A101 the ceiling of an open bypass: 60 psi when the compressor is not modeled (ASSUMED); max 100 with relief 75 gives 75; relief 60 with max 125 gives 60; a cut-out rules as before', T({}) === 60 && DI.AVC_BYPASS_PSI === 60 && T({ maxPsi: 100, relief: 75 }) === 75 && T({ maxPsi: 125, relief: 60 }) === 60 && T({ maxPsi: 100 }) === 100 && T({ relief: 75 }) === 60 && T({ relief: 100 }) === 60 && T({ cutOut: 55, maxPsi: 125, relief: 100 }) === 55 && T({ cutOut: 45 }) === 45 &&
      DI.compLimit({ cutOut: 0, maxPsi: 175, relief: 125 }) === 125 && DI.COMP_MAXPSI.join() === '0,60,100,125,175' && DI.COMP_RELIEF.join() === '0,60,75,100,125' && DI.PARTS.comp.props.maxPsi === 0 && DI.PARTS.comp.props.relief === 0);
    const r = rig(); Object.assign(r.W.byType('comp')[0].p, { maxPsi: 100, relief: 75 }); r.v.p.avcBy = 1; r.S.warp(900); const hi = r.S.sig.get('ha' + r.v.id), on50 = !!hi && hi.type === 'SUPV'; r.S.warp(3600);
    ok('A101 in the sim: bypass open, supply open, no cut-out, max discharge 100 and relief 75: HIGH AIR comes in at the high setpoint as a supervisory, the zone settles at 75 psi, and nothing releases', on50 && Math.abs(r.s.P - 75) < 0.5 && r.S.sig.has('ha' + r.v.id) && r.s.state === 'dry' && r.v.p.pLatch === false && r.v.p.sol === false && r.s.tripT < 0, 'P=' + r.s.P.toFixed(1));
    const n2 = rig(); n2.W.removePart(n2.W.byType('comp')[0].id); n2.W.addPart('n2', 14, 4, 0); n2.S.sync(); const old = DI.migratePart({ id: 9, type: 'comp', x: 0, y: 0, rot: 0, p: { scfm: 5 } });
    ok('A101 with no compressor on the zone, and on an old save, the target is the ASSUMED 60 psi; the target never reads the 40 psi test pressure (static)', DI.bypassTarget(n2.W, n2.S.sysd.info.get(n2.v.id)) === 60 && old.p.maxPsi === 0 && old.p.relief === 0 && old.p.cutOut === 0 && DI.compLimit(old.p) === 60 && !/airTest|AIR_TEST|\b40\b|airSet|hiAir/.test(DI.bypassTarget.toString() + DI.compLimit.toString()) && sha16(DI.relState.toString()) === 'a19f3e39ec09d52e');
  }
  // A102 the optional bypass tamper
  {
    const keys = (r) => [...r.S.sig.keys()].sort().join(), off = liveRig(); off.v.p.avcBy = 1; run(off.S, 5, 1); const rowOff = DI.ceMatrix(off.S, off.v.id).rows.find((q) => q.key === 'avcTamper');
    ok('A102 tamper not fitted (the default): an open bypass raises no signal and the matrix row is greyed "not fitted on this site"', DI.PARTS.prev.props.avcTamper === 0 && DI.PARTS.dryv.props.avcTamper === 0 && off.v.p.avcTamper === 0 && keys(off) === '' && !rowOff.applies && !rowOff.live && rowOff.cells[2] === 'not fitted on this site (optional; PRACTICE (no code requirement verified for the air bypass))' && DI.impairments(off.S).length === 1);
    const on = liveRig(); on.v.p.avcTamper = 1; run(on.S, 5, 1); const idle = keys(on) === ''; on.v.p.avcBy = 1; run(on.S, 5, 1); const o = on.S.sig.get('avcT' + on.v.id), row = DI.ceMatrix(on.S, on.v.id).rows.find((q) => q.key === 'avcTamper'), sch = DI.signalSchedule(on.W).find((q) => q.key === 'avcTamper');
    ok('A102 fitted, the bypass open: one supervisory at the panel, sent to the station, not dispatched, and labelled PRACTICE in the matrix and the schedule', idle && keys(on) === 'avcT' + on.v.id && o.type === 'SUPV' && o.reg === 'avcTamper' && o.mon && o.tx && o.fd === false && o.text === 'AVC BYPASS OPEN (tamper) - ' + DI.sysName(on.S, on.v.id) && quiet(on) && row.applies && row.live && row.class === 'SUPV' && !row.nac && !row.sol && row.cells[1] === 'PRACTICE (no code requirement verified for the air bypass)' &&
      sch.class === 'SUPV' && sch.fd === 'No; station only' && sch.tag.startsWith('PRACTICE (no code requirement verified for the air bypass)') && DI.AVC_TAMPER_TAG === 'PRACTICE (no code requirement verified for the air bypass)' && DI.AVC_NOTE === 'The bypass is normally closed. Leaving it open is a classic way to get high air or over-pressure.');
    on.v.p.avcBy = 0; run(on.S, 2, 1); const other = liveRig(); other.v.p.avcTamper = 1; const W2 = other.W, v2 = W2.addPart('dryv', 2, 12, 0), rowZ = () => DI.ceMatrix(off.S, off.v.id).rows.find((q) => q.key === 'avcTamper');
    ok('A102 closing the bypass clears it; the tag stays an impairment tag; a zone without the switch on a site that has one elsewhere reads "not fitted on this zone"', !on.S.sig.has('avcT' + on.v.id) && DI.impairments(on.S).length === 0 && !!v2 && (off.W.addPart('dryv', 2, 12, 0, { avcTamper: 1 }), /^not fitted on this zone/.test(rowZ().cells[2])));
    const trip = (mut) => { const q = rig(); if (mut) mut(q); breakHead(q); smoke(q.S, 0.2, 10); const rs = DI.relState(q.W, q.v); return JSON.stringify([rs.D, rs.P, rs.open, rs.sol, q.v.p.solOut, q.s.tripT > 0, q.v.p.tripped]); };
    ok('A102 not a release input: the release is identical with the switch fitted and the bypass open, and the engine line never feeds D or P (static)', trip() === trip((q) => { q.v.p.avcTamper = 1; q.v.p.avcBy = 1; }) && trip() === '[true,true,true,true,true,true,true]' && !/avc/i.test(DI.relState.toString()) && (DI.alarmStep.toString().replace(/\/\/.*$/gm, '').match(/avc/gi) || []).length === 3 && /if \(DI\.bypassTamper\(v\)\) add\('avcT' \+ id, 'avcTamper',/.test(DI.alarmStep.toString()) && resTT.every((q) => q.ok));
  }
  // A103 the 60 min refrigerated limit is per zone
  {
    const W = new DI.World(30, 10), f = W.addRoom('cold', 1, 1, 4, 4), dk = W.addRoom('cold', 6, 1, 4, 4), h = W.addRoom('hall', 11, 1, 4, 4); f.below5 = true; const Z = (...ids) => ({ rooms: new Set(ids), src: [] });
    ok('A103 60 min only when every room of the zone is a freezer room held below 5 F; a cooled space that is not, a zone that also covers a data hall, and the default get 30 (the room type alone never qualifies: its name is Refrigerated Space)', DI.refillLimit(W, Z(f.id)) === 3600 && DI.refillLimit(W, Z(dk.id)) === 1800 && DI.refillLimit(W, Z(f.id, dk.id)) === 1800 && DI.refillLimit(W, Z(f.id, h.id)) === 1800 && DI.refillLimit(W, Z(h.id)) === 1800 && DI.refillLimit(W, Z()) === 1800 && DI.refillLimit(W) === 1800 &&
      (dk.below5 = true, DI.refillLimit(W, Z(f.id, dk.id)) === 3600) && DI.sizingMinutes(W, Z(f.id)) === 60 && DI.sizingMinutes(W, Z(h.id)) === 30 && DI.ROOMS.cold.name === 'Refrigerated Space' && DI.ROOMS.cold.cond === false && DI.ROOMS.cold.haz === DI.ROOMS.dock.haz && !('below5' in h) && DI.REFILL_LIMIT === 1800 && DI.REFILL_LIMIT_COLD === 3600);
    const W2 = DI.World.fromJSON(JSON.parse(JSON.stringify(W.toJSON())));
    ok('A103 the room flag is saved with the world, and only where it is set', W2.rooms[0].below5 === true && W2.rooms[1].below5 === true && !('below5' in W2.rooms[2]) && W2.rooms[0].type === 'cold');
    // a Cycle 6 save with the site flag set: the flag is deleted, every zone is at 30 min, and the log says so once
    const r = rig(); run(r.S, 5, 1); const jw = JSON.parse(JSON.stringify(r.W.toJSON())), js = JSON.parse(JSON.stringify(r.S.dump())); jw.cfg.refrigerated = true;
    const Wo = DI.World.fromJSON(jw), So = new DI.Sim(Wo); So.restore(js); run(So, 5, 1); const LINE = 'The site refrigerated setting was replaced by a per-zone setting (freezer room held below 5 F). Your zones now use 30 min until a freezer room is set.';
    const Wn = DI.World.fromJSON(JSON.parse(JSON.stringify(r.W.toJSON()))), Sn = new DI.Sim(Wn); Sn.restore(js);
    ok('A103 a Cycle 6 save with the site flag set loads with the flag deleted, 30 min, and one log line; a save without it says nothing', !('refrigerated' in Wo.cfg) && DI.refillLimit(Wo, So.sysd.info.get(r.v.id)) === 1800 && DI.refillState(So, r.v.id).limit === 1800 && So.log.filter((l) => l.text === LINE).length === 1 && DI.COLD_MIGRATED === LINE && !Wo.notes && !Sn.log.some((l) => l.text === LINE) &&
      DI.COLD_NOTE === 'The 60 min refill limit applies per zone, only in a freezer room held below 5 F. A cooled dock at 35 F does not qualify. Set it on the room.');
    const src = ['gas', 'ui', 'inspect', 'scen', 'review', 'data'].map((n) => fs.readFileSync(path.join(__dirname, '..', 'src', n + '.js'), 'utf8')).join('\n');
    ok('A103 static: nothing reads a site-wide refrigerated setting any more, and the VERIFIED cites carry no ASSUMED wording', !/cfg\.refrigerated|c\.refrigerated/.test(src) && !/ASSUMED/.test(Object.values(DI.JURIS).map((j) => [j.ref.refillCold, j.ref.refillN2Cold, j.ref.refill].join(' ')).join(' ')) && DI.JURIS['US-2025'].ref.refillCold === 'NFPA 13-2025 §8.2.7.4' && DI.JURIS['US-2019'].ref.refillCold === 'NFPA 13-2019 §8.2.6.3.3' && DI.JURIS['US-2022'].ref.refillN2Cold === 'NFPA 13-2022 §8.2.6.8.5');
    DI.setJuris(new DI.World(4, 4));
  }
  // A104 sequential, largest-first refill
  {
    // the c5 reference build: three preaction zones (about 385, 525 and 179 gal) on one 10 scfm compressor, all starting at 0 psig
    const fill = (seq) => { const Z = DI.buildScenario(c5, seq ? { refillSeq: true } : null); DI.botBuild(Z.S, 'c5'); const ids = [...Z.S.sysd.info.keys()].filter((id) => Z.W.parts.get(id).type === 'prev'), vol = (id) => DI.zoneVolume(Z.W, Z.S.sysd.info.get(id)), set = {}, first = {}, alone = []; let n = 0;
      while (ids.some((id) => !Z.S.ss.get(id).set) && n++ < 3000) { Z.S.step(2); const fed = ids.filter((id) => Z.S.ss.get(id).gasIn > 0); if (fed.length > 1) alone.push(fed.join()); for (const id of ids) { const s = Z.S.ss.get(id); if (s.gasIn > 0 && first[id] === undefined) first[id] = Z.S.t; if (s.set && set[id] === undefined) set[id] = Z.S.t; } }
      return { Z, ids, vol, set, first, alone, total: Math.max(...ids.map((id) => set[id])), az: DI.airSizing(Z.S, ids[0]) }; };
    const par = fill(false), sq = fill(true), bySize = sq.ids.slice().sort((a, b) => sq.vol(b) - sq.vol(a)), order = sq.ids.slice().sort((a, b) => sq.set[a] - sq.set[b]);
    ok('A104 toggle on: the three zones fill one at a time, largest zone volume first; no two are fed in the same step, and each starts when the one before it is at normal', sq.alone.length === 0 && order.join() === bySize.join() && sq.first[bySize[1]] >= sq.set[bySize[0]] - 2 && sq.first[bySize[2]] >= sq.set[bySize[1]] - 2 && DI.refillSeq(sq.Z.W) === true && par.alone.length > 0 && DI.refillSeq(par.Z.W) === false,
      bySize.map((id) => '#' + id + ' ' + Math.round(sq.vol(id)) + ' gal set at ' + Math.round(sq.set[id]) + ' s').join(', '));
    ok('A104 the code check is unchanged by the toggle: the largest zone alone from 0 psig at full capacity, the same number on and off; and the sequence total is about the parallel total', Math.abs(sq.az.tAlone - par.az.tAlone) < 1e-12 && sq.az.gov === par.az.gov && sq.az.gov === bySize[0] && !sq.az.below && sq.az.limit === 30 && sq.set[bySize[0]] / 60 <= sq.az.tAlone && sq.set[bySize[0]] / 60 > sq.az.tAlone - 3.5 && Math.abs(sq.total - par.total) < 0.1 * par.total && sq.total > 1800,
      'largest alone ' + sq.az.tAlone.toFixed(1) + ' min (measured ' + (sq.set[bySize[0]] / 60).toFixed(1) + '); sequence ' + (sq.total / 60).toFixed(1) + ' min, parallel ' + (par.total / 60).toFixed(1) + ' min');
    // Cycle 8: the sequence sentence is its own line after the measured line (DI.seqLine); the measured line says how the zones filled and never carries a limit
    const zq = bySize[0], line = DI.seqLine(sq.Z.S, zq, sq.total), X = sq.az.tAlone.toFixed(1), Y = (sq.total / 60).toFixed(1), cq = sq.Z.W.byType('comp')[0], scfm0 = cq.p.scfm;
    ok('A104 total over 30 min with each zone under 30 alone: the sequence line is the FP Lead’s, word for word; within the limit, with the toggle off, or with a compressor that is too small there is none (the code-check line says Fails); the measured line names the order', line === 'PASS: each zone restores in 30 min or less when filled alone (largest ' + X + ' min). The sequential campus refill total of ' + Y + ' min is informational and not a code limit.' && !/FAIL/.test(line) &&
      DI.seqLine(sq.Z.S, zq, 732) === '' && DI.seqLine(par.Z.S, par.ids[0], sq.total) === '' && DI.measuredLine(sq.Z.S, zq, sq.total) === 'Air refill this drill, measured: ' + Y + ' min (zones refilled one at a time, largest first, from partly full). Informational.' && DI.measuredLine(par.Z.S, par.ids[0], 2040) === 'Air refill this drill, measured: 34.0 min (zones refilled at the same time, from partly full). Informational.' &&
      (cq.p.scfm = 0.5, DI.seqLine(sq.Z.S, zq, 2700) === '' && /Limit 30 min \(NFPA 13\)\. Fails: the compressor is too small for this zone\./.test(DI.codeCheckLine(sq.Z.S, zq))) && (cq.p.scfm = scfm0, DI.codeCheckLine(sq.Z.S, zq).includes('Passes.')), line);
    // ties go to the lowest zone ID: two identical zones on one compressor
    const two = (seq) => { const W = new DI.World(40, 16); W.addRoom('hall', 20, 1, 12, 4); W.addRoom('hall', 20, 8, 12, 4); const mk = (y, y0) => { W.addPart('city', 1, y, 0, { stat: 90, resid: 70, flow: 1500 }); hline(W, 2, 13, y, 6); const v = W.addPart('prev', 14, y, 0); hline(W, 15, 19, y, 6); for (let j = y0; j <= y0 + 3; j++) W.setPipe(20, j, 4, 0, true); grid(W, 21, y0, 31, y0 + 3); return v; };
      const A = mk(3, 1), B = mk(10, 8); W.addPart('comp', 14, 6, 0, { scfm: 5 }); for (const y of [4, 5, 7, 8, 9]) W.setAir(14, y, 1); if (seq) W.cfg.refillSeq = true; const S = new DI.Sim(W), a = S.ss.get(A.id), b = S.ss.get(B.id); let both = 0, bFirst = false, n = 0;
      while (!a.set && n++ < 4000) { S.step(1); if (a.gasIn > 0 && b.gasIn > 0) both++; if (b.gasIn > 0 && !(a.gasIn > 0)) bFirst = true; } const bAt = b.P; n = 0; while (!b.set && n++ < 4000) S.step(1); return { A, B, a, b, both, bFirst, bAt, t: S.t, src: S.sysd.info.get(A.id).src.join() === S.sysd.info.get(B.id).src.join(), eq: Math.abs(S.sysd.info.get(A.id).vol - S.sysd.info.get(B.id).vol) < 1e-9 }; };
    const tie = two(true), split = two(false);
    ok('A104 two equal zones on one compressor: with the toggle on the lower zone ID fills first and the other waits at 0 psi; with it off they fill together', tie.src && tie.eq && tie.A.id < tie.B.id && tie.both === 0 && !tie.bFirst && tie.bAt < 1 && tie.a.set && tie.b.set && split.both > 100 && split.bAt > 30 && Math.abs(tie.t - split.t) < 0.1 * split.t, 'B at ' + tie.bAt.toFixed(1) + ' psi when A was set; totals ' + Math.round(tie.t) + ' / ' + Math.round(split.t) + ' s');
    ok('A104 the setting is off by default and stores nothing; only true turns it on', DI.refillSeq(new DI.World(4, 4)) === false && !('refillSeq' in new DI.World(4, 4).cfg) && DI.refillSeq({ cfg: { refillSeq: 1 } }) === false && DI.refillSeq({ cfg: { refillSeq: true } }) === true && /seq \? \(head\.get\(sid\)\.id === id \? src\.p\.scfm : 0\) : src\.p\.scfm \/ callers\.get\(sid\)/.test(DI.gasPre.toString()));
    c7.c5par = par; DI.setJuris(new DI.World(4, 4));
  }
  // A105 the main drain follow-up
  {
    const rep = (r) => DI.drillRecovery(r.S, 'the broken sprinkler').map((q) => q[1]), nm = (r) => DI.sysName(r.S, r.v.id), val = DI.lastResult(c6.fast.S, 'drain', c6.fast.v.id).val;
    const b = recover(60), bAct = b.S.acts.find((a) => a.kind === 'main-drain-test'), bRes = DI.lastResult(b.S, 'drain', b.v.id), bl = rep(b);
    ok('A105 no earlier test: the reading is recorded as the baseline, the report says "record as baseline", and nothing is scored', !('base' in bAct) && bAct.drop === 0 && bRes.pass && bRes.lines[2] === 'Recorded as the baseline for the next test. [NFPA 25-2023 §13.2.2.3 (2020 §13.2.3.3)]' && b.v.p.drainBase === bRes.val && bl.some((l) => l === 'Main drain test on ' + nm(b) + ': no earlier test to compare with, so record as baseline. Recorded as the baseline for the next test.') && !bl.some((l) => /not investigated|Full flow pressure is|Residual pressure/.test(l)));
    const d = recover(60, { base: val / 0.88 }), act = d.S.acts.find((a) => a.kind === 'main-drain-test'), hint = 'Full flow pressure is 12.0 percent lower than the last test. NFPA 25 says find the cause. A partly closed valve is the usual one. Check the zone control valve and the supply valves upstream (riser control valve, PIV, backflow preventer valves).', dl = rep(d), res = DI.lastResult(d.S, 'drain', d.v.id);
    ok('A105 a test 12 % under the baseline with nothing done about it by the end of the drill: one informational error, "10% drop not investigated", with the Tutor’s hint (12.0%); the step still passes', Math.abs(act.drop - 0.12) < 1e-9 && Math.abs(act.base - val / 0.88) < 1e-9 && DI.mdtHint(act.drop) === hint && res.lines[res.lines.length - 1] === hint && res.lines[3] === DI.REF25.passLine && res.pass === false && res.invest === true &&
      dl.filter((l) => l === '10% drop not investigated (' + nm(d) + '). ' + hint + ' [' + DI.REF25.passLine + ']').length === 1 && dl.filter((l) => /not investigated/.test(l)).length === 1 && DI.drillRecovery(d.S, 'x').find((q) => /not investigated/.test(q[1]))[2] === true && drillScore(d).steps[13].done && drillScore(d).complete && DI.dropFollowed(d.S, act) === false && Math.abs(d.v.p.drainBase - val / 0.88) < 1e-9, dl.find((l) => /not investigated/.test(l)));
    const txt = DI.dropCheck(d.S, d.v.id), d1 = rep(d);
    ok('A105 "Check the valves upstream" reports every control valve on the supply path, logs a drop-check entry, and clears the error', /^Valves upstream of .*: control valve #\d+ 100% open\. All fully open\./.test(txt) && d.S.acts.filter((a) => a.kind === 'drop-check' && a.id === d.v.id).length === 1 && DI.dropFollowed(d.S, act) === true && !d1.some((l) => /not investigated/.test(l)) && d1.some((l) => l === 'Main drain test on ' + nm(d) + ': ' + hint + ' Investigated. [' + DI.REF25.passLine + ']') && DI.supplyValves(d.W, d.v.id).map((g) => g.id).join() === String(d.g.id));
    const g = recover(60, { base: val / 0.88 }); DI.setGate(g.S, g.g.id, 0); run(g.S, 6, 0.25); const half = DI.dropCheck(g.S, g.v.id); DI.setGate(g.S, g.g.id, 1); run(g.S, 6, 0.25); const g2 = recover(60, { base: val / 0.88 }); g2.S.acts.push({ t: g2.S.t, kind: 'open-valve', id: g2.g.id, flow: 0 });
    const t = recover(60, { base: val / 0.88 }); t.v.p.drainBase = val; DI.startTest(t.S, 'drain', t.v.id); run(t.S, 45, 0.25); const nine = recover(60, { base: val / 0.91 }), n9 = nine.S.acts.find((a) => a.kind === 'main-drain-test');
    ok('A105 a supply-path control valve reopened, or a later passing test, also count as investigated; a 9 % drop scores nothing and adds no hint', /1 not fully open: open it fully, then run the main drain test again\.$/.test(half) && !rep(g2).some((l) => /not investigated/.test(l)) && t.S.acts.filter((a) => a.kind === 'main-drain-test').length === 2 && DI.lastResult(t.S, 'drain', t.v.id).pass && !rep(t).some((l) => /not investigated/.test(l)) &&
      Math.abs(n9.drop - 0.09) < 1e-9 && DI.lastResult(nine.S, 'drain', nine.v.id).pass && !rep(nine).some((l) => /not investigated|Residual pressure/.test(l)) && DI.MDT_DROP === 0.10);
    const none = recover(60, { noDrain: true }), stay = recover(60, { noOpen: true }), SK = 'Main drain test not done. After any control valve is closed and reopened, run one to prove the valve is fully open.', eng = ['sim', 'gas', 'proc', 'inspect', 'ui', 'main'].map((n) => fs.readFileSync(path.join(__dirname, '..', 'src', n + '.js'), 'utf8')).join('\n');
    ok('A105 the skipped-test line is exact when the valve was reopened and no test followed, absent when it was not reopened, and there is no timed nag', DI.MDT_SKIPPED === SK && rep(none).filter((l) => l === SK).length === 1 && !rep(stay).some((l) => l === SK) && !rep(d).some((l) => l === SK) && !/MDT_SKIPPED/.test(eng));
  }
  // A106 the tiers
  {
    const s90 = drillScore(recover(90)), s200 = drillScore(recover(200)), part = drillScore(recover(30, { noOpen: true }));
    ok('A106 the reference drill is 3 stars; the valve closed at 90 s is 2 stars, at 200 s 1 star; out of order or incomplete is 0', DI.recoveryTier(c5run.ds) === 3 && c5run.ds.waterStopped <= 60 && DI.recoveryTier(s90) === 2 && s90.waterStopped > 60 && s90.waterStopped <= 150 && DI.recoveryTier(s200) === 1 && s200.waterStopped > 150 && s200.complete && s200.inOrder && DI.recoveryTier(Object.assign({}, s90, { inOrder: false })) === 0 && !part.complete && part.waterStopped <= 60 && DI.recoveryTier(part) === 0, Math.round(s90.waterStopped) + ' s: ' + DI.recoveryTier(s90) + ', ' + Math.round(s200.waterStopped) + ' s: ' + DI.recoveryTier(s200));
    const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
    ok('A106 DI.RECOVERY_TIERS is 60 / 150 (ASSUMED) and no contract star changes', JSON.stringify(DI.RECOVERY_TIERS) === '[{"stars":3,"s":60},{"stars":2,"s":150}]' && mainSrc.includes('stars = 1 + (spent <= sc.par ? 1 : 0) + (res.loss <= (sc.drill ? 0.5 : 1) * (res.limit || 1e12) ? 1 : 0)') && !/recoveryTier|RECOVERY_TIERS|waterStopped|rtErr|drop-check|restoral/.test(mainSrc));
  }
  // A107 the report lines and the gallons
  {
    const L = c5run.dr.lines, st = c5run.dr.stats, ds = c5run.ds, head = DI.headGal(st), drain = DI.drainGal(st), op = L.filter((l) => /^• Operator steps took: \d+ s$/.test(l)), md = L.filter((l) => /^• Main drain test took: \d+ s$/.test(l));
    ok('A107 the c5 reference drill reports "Operator steps took: 23 s" (the recovery steps only) and "Main drain test took: 34 s" on their own lines; the old 57 s is gone', op.length === 1 && op[0] === '• Operator steps took: 23 s' && md.length === 1 && md[0] === '• Main drain test took: 34 s' && Math.round(ds.opTime) === 23 && Math.round(ds.mdtTime) === 34 && !L.some((l) => /57 s|Operator steps took \d/.test(l)), op[0] + ' | ' + md[0]);
    const gh = L.filter((l) => /^• Discharged through the open head: \d+ gal$/.test(l)), gd = L.filter((l) => /^• Main drain test: \d+ gal \(to drain, not to the floor\)$/.test(l));
    ok('A107 the water is two lines, never a total: what left through the open head, and what the main drain test sent to the drain', gh.length === 1 && gh[0] === '• Discharged through the open head: ' + DI.fmt(head) + ' gal' && gd.length === 1 && gd[0] === '• Main drain test: ' + DI.fmt(drain) + ' gal (to drain, not to the floor)' && head > 5 && drain > 50 && DI.fmt(st.gallons) !== DI.fmt(head) && !L.some((l) => l.includes(DI.fmt(st.gallons) + ' gal')), gh[0] + ' | ' + gd[0]);
    const uiSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8'), scSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'scen.js'), 'utf8');
    // water out of a drain or a test connection is never reported as head discharge: an inspector's test connection on a dry valve, a system drain, a wet riser's main drain
    const dt = dryRig(); dt.S.stats = { fireLoss: 0, waterLoss: 0, smokeLoss: 0, gallons: 0 }; dt.v.p.itc = 1; dt.S.touch(); run(dt.S, 120, 0.25); dt.v.p.itc = 0; dt.v.p.sdrain = 1; dt.S.touch(); run(dt.S, 30, 0.25); const dOt = DI.testGal(dt.S), dLines = DI.galLines(dt.S);
    const ww = new DI.World(40, 14); ww.addRoom('office', 20, 2, 12, 8); ww.addPart('city', 1, 6, 0); hline(ww, 2, 13, 6, 6); const wv = ww.addPart('wetv', 14, 6, 0); hline(ww, 15, 19, 6, 6); for (let y = 2; y <= 9; y++) ww.setPipe(20, y, 4, 0, true); grid(ww, 21, 2, 31, 9);
    const wS = new DI.Sim(ww); wS.commission(); wv.p.drain = 1; wS.touch(); run(wS, 20, 0.25); wv.p.drain = 0; wS.touch(); run(wS, 5, 0.25); const wLines = DI.galLines(wS);
    ok('A107 drain and test water is never called head discharge: an inspector’s test and a system drain on a dry valve go to their own line, and a wet riser’s main drain counts as main drain water', dt.s.tripT > 0 && dOt > 20 && DI.headGal(dt.S) < 1e-6 && Math.abs(dt.S.stats.gallons - dOt) < 1e-6 && dLines.length === 2 && dLines[0] === 'Discharged through the open head: 0 gal' && dLines[1] === 'Other drains and test connections (system drain, inspector’s test): ' + DI.fmt(dOt) + ' gal, to drain, not to the floor.' &&
      DI.drainGal(wS) > 20 && DI.headGal(wS) < 1e-6 && DI.testGal(wS) === 0 && wLines.length === 2 && wLines[0] === 'Discharged through the open head: 0 gal' && /^Main drain test: \d+ gal \(to drain, not to the floor\)$/.test(wLines[1]) && DI.galLines({ gallons: 300, mdGal: 156, otGal: 23 }).join('|') === 'Discharged through the open head: 121 gal|Main drain test: 156 gal (to drain, not to the floor)|Other drains and test connections (system drain, inspector’s test): 23 gal, to drain, not to the floor.', dLines.join(' | ') + ' || ' + wLines.join(' | '));
    ok('A107 S.stats.gallons is unchanged (every outlet: the loss accounting reads it); a drill with no main drain test prints one gallon line; no source adds the lines for display', Math.abs(st.gallons - head - drain - DI.testGal(st)) < 1e-9 && st.mdGal === drain && DI.galLines({ gallons: 121, mdGal: 0 }).join('|') === 'Discharged through the open head: 121 gal' && DI.galLines({ gallons: 277, mdGal: 156 }).join('|') === 'Discharged through the open head: 121 gal|Main drain test: 156 gal (to drain, not to the floor)' &&
      !/gal discharged|st\.gallons/.test(uiSrc) && /DI\.galLines\(st\)/.test(uiSrc) && !/headGal\(S\) \+|\+ DI\.drainGal/.test(uiSrc + scSrc));
  }
  // A108 the Tutor's wording, and the shared-compressor note
  {
    ok('A108 the P-latched, water-flow and clean-pass sentences are the Tutor’s, word for word', DI.RT_TEXT['p-latch'] === 'Pressure fell to the trip point, so the panel latched the pressure-loss input. With detection also active, both release conditions were met and the valve would release. Restore air above low air before panel reset #2.' &&
      DI.RT_TEXT['water-flow'] === 'Water flow was detected. That sends a fire alarm signal. Keep the control valve closed until the head is replaced and the system is reset.' && DI.RT_CLEAN === 'Clean return to normal. Air held above low air, both panel resets were done in order, drains were closed, the control valve is fully open, and supervision is back to normal.' &&
      DI.RT_COACH === 'Use the trim air bleed to trim down to normal. Drains dump air too fast or flow supply water.');
    const L = c5run.dr.lines, S5 = c5run.S, inc = c5run.inc, az = DI.airSizing(S5, inc.id), note = L.find((l) => /^• Note: /.test(l));
    ok('A108 the realism tip is its own line, and a drill on a compressor that serves three zones adds the Tutor’s note with N = 3 (Cycle 8: sized for the largest zone, not for all zones at once), citing the edition’s own section', L.includes('• In a real building, getting to the riser takes minutes. Know where each zone’s control valve is before an event.') && az.shared === 2 &&
      note === '• Note: 3 zones share this compressor. It is sized for the largest zone, not for all zones at once. [NFPA 13-2025 §8.2.7.3]' && Math.abs(az.tAlone - 19.1) < 0.2, note);
    const Z = c7.c5par.Z, zid = c7.c5par.ids[0]; Z.W.cfg.edition = 'US-2019'; const n19 = DI.sharedLine(Z.S, zid); Z.W.cfg.edition = 'US-2022'; const n22 = DI.sharedLine(Z.S, zid); delete Z.W.cfg.edition;
    Z.S.drill = { t0: Z.S.t, done: false }; Z.S.acts.push({ t: Z.S.t, kind: 'incident', id: zid, why: 'head' }); const unfinished = DI.drillRecovery(Z.S, 'x'), solo = rig();
    ok('A108 the note follows the edition (2019 and 2022 §8.2.6.3.2; 2025 §8.2.7.3), prints pass or fail (an unfinished recovery has it too), and a compressor of its own adds none', /\[NFPA 13-2019 §8\.2\.6\.3\.2\]$/.test(n19) && /\[NFPA 13-2022 §8\.2\.6\.3\.2\]$/.test(n22) && unfinished.some((q) => /^Note: 3 zones share this compressor\./.test(q[1]) && q[2] === true) && unfinished[0][0] === false && DI.sharedLine(solo.S, solo.v.id) === '' && !/8\.2\.6\.3\.2|8\.2\.7\.3/.test(DI.sharedLine.toString() + DI.codeCheckLine.toString()), n19);
    // water flow during the return to normal: the valve trips, the step ends, and the result carries the Tutor's sentence
    const w = retRig(); w.v.p.mech = true; run(w.S, 20, 0.25); const res = DI.lastResult(w.S, 'return', w.v.id), act = w.S.acts.find((a) => a.kind === 'return-normal');
    ok('A108 a trip during the return step is the water-flow error: the step ends, the result does not pass and reads the Tutor’s water-flow sentence', w.s.ret === false && w.s.state !== 'dry' && !!res && res.pass === false && res.lines.length === 1 && res.lines[0].endsWith(' ' + DI.RT_TEXT['water-flow']) && act.aborted === true && act.errs.length === 1 && act.errs[0].why === 'water-flow' && DI.RT_RANK['water-flow'] === 4);
    DI.setJuris(new DI.World(4, 4));
  }
  // A100 the return-to-normal errors in the drill report (run on the finished c5 reference drill: nothing below reads its lines again)
  {
    const S = c5run.S, W = S.W, id = [...S.sysd.info.keys()].find((q) => W.parts.get(q).type === 'prev' && q !== c5run.inc.id), v = W.parts.get(id), s = S.ss.get(id), TAGS = /p-latch|finish-early|main-drain-flow|drain-open|water-flow|low-air(?! supervisory)/;       // ("the low-air supervisory" is plain English, the bare tag is not)
    Object.assign(v.p, { airSet: 30, loAir: 25, hiAir: 35 }); const m = DI.startTest(S, 'leak', id); S.warp(86500 + DI.AIR_TEST.chargeMax); const pend = s.ret === true && s.P > 31;
    v.p.sdrain = 1; S.touch(); let n = 0; while (!s.lowAir && n++ < 4000) S.step(0.02); v.p.sdrain = 0; S.touch(); S.step(0.02); const refused = DI.returnFinish(S, id), res = S.drill.judge(S), L = res.lines, tm = '\\d\\d:\\d\\d:\\d\\d';
    const low = L.filter((l) => new RegExp('^• (D\\d+ )?' + tm + ' You let air out through a drain, and pressure fell below low air\\. That sets off the low-air supervisory signal, and if pressure keeps falling it reaches the P set point\\. To lower pressure, use the trim air bleed in small steps; drains let air out too fast\\.$').test(l));
    const early = L.filter((l) => new RegExp('^• (D\\d+ )?' + tm + ' Finish was pressed before the zone was ready: ').test(l));
    ok('A100 a drain left open to low air, then a Finish refused: the drill report lists each error as its own informational line, clock and plain text, and the drill still passes', m === '' && pend && /^Finish was pressed before the zone was ready: /.test(refused) && s.rtErr.length === 2 && low.length === 1 && early.length === 1 && early[0].endsWith(refused) && res.pass === true && c5run.dr.pass === true && L.some((l) => /^• Return to normal, .*: not finished, 2 error\(s\) so far \(Finish pressed 1 time\)$/.test(l)) && L.some((l) => /^• Return to normal, .*: Finish was pressed 1 time\(s\) before the zone was ready; counted as 1 error\(s\), one for each new set of blockers \(informational\)\.$/.test(l)) && s.rtErr[0].drain === true && s.rtErr[0].iso === false, low[0]);
    const texts = Object.values(DI.RT_TEXT).concat(DI.RT_EARLY, [DI.RT_CLEAN, DI.RT_READY, DI.RT_COACH, DI.MDT_SKIPPED, DI.MDT_NOT_INVESTIGATED, DI.RECOVERY_TIP, DI.RT_LOW_DRAIN, DI.RT_LOW_NODRAIN, DI.RT_ISO, DI.RISER_NOTE, DI.rtPressLine(3, 1), DI.MDT_LINE, DI.RECOVERY_DRAIN[1], DI.mdtHint(0.12)], Object.values(DI.RT_NAME)), shown = (S.results.filter((q) => q.kind === 'return').map((q) => q.lines.join(' '))).concat(L, S.log.map((l) => l.text));
    const insp = fs.readFileSync(path.join(__dirname, '..', 'src', 'inspect.js'), 'utf8');
    ok('A100 no internal tag appears in any player-facing string: not in the text constants, not in the report, the result or the log, and the inspector prints names, never the tags', texts.every((t) => !TAGS.test(t)) && shown.every((t) => !TAGS.test(t)) && Object.keys(DI.RT_NAME).join() === Object.keys(DI.RT_RANK).join() && /s\.rtErr\.map\(\(e\) => DI\.rtName\(e\)\)/.test(insp) && !/e\.why\)/.test(insp) && DI.rtLine({ why: 'drain-open' }) === DI.RT_EARLY[0] + 'a drain is open' + DI.RT_EARLY[1], texts.filter((t) => TAGS.test(t)).concat(shown.filter((t) => TAGS.test(t))).slice(0, 3).join(' || ') || undefined);
    // then closed out properly: the finished step is reported from the operator log, with the same lines
    refillTo({ s, S }, 27.5); run(S, 5, 0.25); const fin = DI.returnFinish(S, id), L2 = S.drill.judge(S).lines; S.acts.push({ t: S.t, kind: 'return-normal', id, err: 3 });
    ok('A100 finished: the report reads the return-normal entry (2 errors, each a line); an entry from before Cycle 7 that carries only a count reads "N error(s)"', fin === '' && s.ret === false && L2.some((l) => /^• Return to normal, .*: 2 error\(s\)$/.test(l)) && L2.filter((l) => / You let air out through a drain, and pressure fell below low air\. /.test(l)).length === 1 && L2.filter((l) => / Finish was pressed before the zone was ready: /.test(l)).length === 1 && L2.filter((l) => l.endsWith(DI.rtPressLine(1, 1))).length === 1 && S.acts.find((q) => q.kind === 'return-normal' && q.id === id).presses === 1 && S.drill.judge(S).lines.some((l) => /^• Return to normal, .*: 3 error\(s\)$/.test(l)));
    const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
    ok('A100 no contract goal, star or review finding reads the errors: they are report lines only', !/rtErr|return-normal|return-early|errs\b|drillReturnLines/.test(mainSrc + DI.review.toString() + DI.recoveryScore.toString() + DI.recoveryTier.toString()) && DI.SCEN.every((sc) => sc.goals.every((q) => !/rtErr|return-normal|return-early|returnFinish/.test(q.ok.toString()))) && DI.drillReturnLines(S).every((q) => q[2] === true) && /out\.push\(\.\.\.DI\.drillReturnLines\(S\)\)/.test(DI.drillRecovery.toString()));
    DI.setJuris(new DI.World(4, 4));
  }
  // A109 the VEA Fire 1 pick
  {
    const vea = (cfg, o) => { const r = liveRig(o); Object.assign(r.W.cfg, { asdModel: 'VEA' }, cfg); return r; }, rows = (r) => [...r.S.sig.keys()].filter((k) => k[0] === 'v').join();
    const a = vea(); smoke(a.S, 0.2, 5); const below = rows(a) === '' && a.d.p.lvl === 0 && a.v.p.sol === false; smoke(a.S, 1.0, 5); const still = rows(a) === ''; smoke(a.S, 1.3, 5); const f1 = rows(a), lvl1 = a.d.p.lvl, rel1 = a.d.p.rel; smoke(a.S, 6, 5);
    ok('A109 model VEA: nothing at 0.2 or 1.0 %/ft (no Alert, no Action), FIRE 1 at 1.3, and at 6 %/ft still only the FIRE 1 row (no Fire 2); D latches and the fire department is called', below && still && f1 === 'v' + a.d.id + '.3' && lvl1 === DI.FIRE1 && rel1 === true && rows(a) === 'v' + a.d.id + '.3' && a.d.p.lvl === DI.FIRE1 && a.d.p.rel === (a.d.p.lvl >= DI.FIRE1) && a.v.p.sol === true && a.S.sig.get('v' + a.d.id + '.3').text.startsWith('VESDA FIRE 1 - ') && called(a) && a.s.state === 'dry' && a.s.wat === 0);
    const rel = vea(); breakHead(rel); const pOnly = rel.v.p.pLatch && rel.s.state === 'dry'; smoke(rel.S, 1.3, 10);
    ok('A109 the release is the same function: P alone releases nothing, Fire 1 AND P releases; p.p.rel is still lvl >= DI.FIRE1 (static)', pOnly && rel.s.tripT > 0 && rel.v.p.solOut === true && /p\.p\.rel = p\.p\.lvl >= DI\.FIRE1;/.test(DI.alarmStep.toString()) && sha16(DI.relState.toString()) === 'a19f3e39ec09d52e' && sha16(DI.canRelease.toString()) === sha16('function (W, d) {\n  if (d.type === \'vesda\') return true;\n  const room = d.type === \'smoke\' ? W.room(d.x, d.y) : null;\n  return !!(room && DI.ROOMS[room.type].spotRelease);\n}'));
    // Cycle 8: NFPA 76 applies by room, so the little world has one room with a VEA detector in it: a telecom room (MMR 1) unless a hall is asked for
    const W = (cfg, type) => { const w = new DI.World(12, 6); Object.assign(w.cfg, { asdModel: 'VEA' }, cfg); w.addRoom(type || 'tel', 1, 1, 4, 4, type ? undefined : TEL); w.addPart('vesda', 2, 2, 0); return w; }, F = (w) => DI.veaFire1At(w, w.rooms[0]);
    const M = DI.ASD_MODELS.VEA, codes = (w) => DI.n76Flags(w).map((q) => q.code).join(), fails = (w) => { const r = rig(); Object.assign(r.W.cfg, w.cfg); if (w.rooms[0].type === 'tel') tel(r); return DI.review(r.S).filter((q) => q.sev === 'fail' && /VEA|NFPA 76|thresholds are not strictly/.test(q.text)); };
    ok('A109 the pick is 0.5 / 1.23 / 2.5 only; the default is 1.23, and 0.5 in a telecom room where NFPA 76 applies (a hall stays at 1.23 whatever the site flag); the Gamewell 1.3 is a note, never a setting', M.pick.join() === '0.5,1.23,2.5' && M.pickName.join() === 'High,Enhanced,Standard' && M.fire1Only === true && DI.veaFire1(W()) === 1.23 && F(W()) === 1.23 && F(W({ nfpa76Adopted: true })) === 0.5 && F(W({ nfpa76Adopted: true }, 'hall')) === 1.23 && DI.veaFire1(W({ nfpa76Adopted: true })) === 1.23 && F(W({ detThr: [0.03, 0.06, 2.5, 1.2] })) === 2.5 && F(W({ nfpa76Adopted: true, detThr: [0.03, 0.06, 1.23, 1.2] })) === 1.23 &&
      !M.pick.includes(1.3) && M.oem === 1.3 && /Gamewell sheet 9021-61037 prints the Enhanced setting as 1\.3 %\/ft \(4\.0 %\/m\)/.test(M.oemNote) && /1\.3 is not a setting here/.test(M.oemNote) && DI.asdThr(W()).join() === 'Infinity,Infinity,1.23,Infinity' && DI.asdThr(new DI.World(4, 4)).join() === DI.VESDA_T.join() && M.doc === 'Xtralis Doc. 36348_03');
    const bad = fails(W({ detThr: [0.03, 0.06, 0.12, 1.2] })), f13 = fails(W({ detThr: [0.03, 0.06, 1.3, 1.2] }));
    ok('A109 a stored Fire 1 that is not one of the three is a review fail ("not a listed VEA setting"), 1.3 included; a listed pick fails nothing, and the four-stage order check does not apply', bad.length === 1 && /^Aspirating Fire 1 threshold 0\.12 %\/ft is not a listed VEA setting: the VESDA-E VEA offers 0\.5 \(High\), 1\.23 \(Enhanced\), 2\.5 \(Standard\) %\/ft only \[HB, datasheet; UL Product iQ not checked\]\. Pick one of the three\.$/.test(bad[0].text) && f13.length === 1 && /1\.3 %\/ft is not a listed VEA setting/.test(f13[0].text) &&
      fails(W()).length === 0 && fails(W({ detThr: [9, 9, 2.5, 9] })).length === 0 && fails(W({ detThr: [0.03, 0.06, 0.5, 1.2] })).length === 0, bad[0] && bad[0].text);
    const n = (f) => W({ nfpa76Adopted: true, detThr: [0.03, 0.06, f, 1.2] });
    ok('A109 in a telecom room where NFPA 76 applies 1.23 and 2.5 are above the ceiling and 0.5 meets it (the same detector in a hall is not checked); the 1.0 %/ft figure reads VERIFIED and the mapping to Fire 1 reads PRACTICE; the note says the ceiling binds', codes(n(1.23)) === 'N76_ALARM_OVER' && codes(n(2.5)) === 'N76_ALARM_OVER' && codes(n(0.5)) === '' && codes(W({ nfpa76Adopted: true })) === '' && codes(W({ detThr: [0.03, 0.06, 2.5, 1.2] })) === '' && codes(W({ nfpa76Adopted: true, detThr: [0.03, 0.06, 2.5, 1.2] }, 'hall')) === '' && fails(n(1.23)).length === 1 && fails(n(0.5)).length === 0 && DI.n76Flags(n(1.23))[0].text.startsWith('NFPA 76 applies in ' + TEL + ': Fire 1, the first alarm stage, must be 1.0 %/ft or less (it is 1.23).') &&
      /The 1\.0 %\/ft figure is VERIFIED \(NFPA 76-2024 §8\.5\.3\.1\.2\.5\); applying it to Fire 1 is PRACTICE, NEEDS PE REVIEW\.$/.test(DI.n76Flags(n(1.23))[0].text) && /the ceiling binds: 1\.23 and 2\.5 %\/ft are above it, 0\.5 %\/ft meets it \(the listing is not tighter than 1\.0\)/.test(DI.n76Note(n(0.5))) && DI.n76Check(n(1.23)) === 'NFPA 76 check, ' + TEL + ': Fire 1 1.23 (meets 1.0: no). This model has no Alert stage.' && DI.n76Check(n(0.5)) === 'NFPA 76 check, ' + TEL + ': Fire 1 0.5 (meets 1.0: yes). This model has no Alert stage.');
    const mx = (cfg) => { const r = rig({ gate: true, stn: true }); Object.assign(r.W.cfg, cfg); return DI.ceMatrix(r.S, r.v.id); }, m = mx({ asdModel: 'VEA', hvacHook: 'fire2' }), na = m.rows.filter((q) => !q.applies).map((q) => q.key).join(), sch = Object.fromEntries(DI.signalSchedule(W()).map((q) => [q.key, q]));
    ok('A109 the matrix: the Alert, Action and Fire 2 rows read "not available", the Fire 2 HVAC hook is never on, and the matrix is the same for VEP and VEU (deep-equal)', na === 'alert,action,fire2,mrz,avcTamper,dactChan' && m.rows.find((q) => q.key === 'fire2').cells[2] === 'not available (this detector model has no Fire 2)' && /^not available: not published for this model/.test(m.rows.find((q) => q.key === 'alert').cells[2]) && m.rows.every((q) => !q.hvac) && m.head[2] === 'HVAC hook: on Fire 2: not available (this detector model has no Fire 2)' &&
      m.rows.find((q) => q.key === 'fire1').applies && m.rows.find((q) => q.key === 'fire1+p').sol && JSON.stringify(mx({})) === JSON.stringify(mx({ asdModel: 'VEU' })) && JSON.stringify(mx({})) === JSON.stringify(mx({ asdModel: 'VEP' })) && mx({ hvacHook: 'fire2' }).rows.filter((q) => q.hvac).map((q) => q.key).join() === 'fire2' &&
      sch.alert.ss === 'not published for this model' && sch.action.fd === 'not published for this model' && sch.fire2.ss === 'not published for this model' && sch.fire1.fd === 'Yes' && DI.VEA_NA === 'not published for this model', na);
    DI.setJuris(new DI.World(4, 4));
  }
  // A110 the charger
  {
    const pn = (ah, a) => ({ p: Object.assign({}, DI.PARTS.panel.props, { ah, chgA: a }) }), R = (ah, a) => { const r = rig(); r.pn.p.ah = ah; r.pn.p.chgA = a; return DI.review(r.S).filter((q) => /charger/.test(q.text) && /Panel #/.test(q.text)); };
    const f55 = R(55, 1);
    ok('A110 charger 0 (matched, the default) raises nothing; 1 A with a 55 Ah battery fails (it restores 48 Ah in 48 h), with a 26 Ah battery it passes', DI.PARTS.panel.props.chgA === 0 && R(26, 0).length === 0 && R(100, 0).length === 0 && R(26, 1).length === 0 && R(33, 1).length === 0 && f55.length === 1 && f55[0].sev === 'fail' && DI.chargerAh(pn(55, 1)) === 48 && DI.chargerAh(pn(55, 2)) === 96 && DI.chargerAh(pn(55, 0)) === Infinity && R(55, 2).length === 0 && R(100, 2).length === 1 && DI.CHG_A.join() === '0,1,2,3,4,6,10');
    ok('A110 the fail text names §10.6.10.3.2 and the 48 h, and says the window does not stretch', /^Panel #\d+ charger \(1 A\) cannot restore the 55 Ah battery within 48 h after one discharge \(NFPA 72 §10\.6\.10\.3\.2, identical in 2019 \/ 2022 \/ 2025\)\. A bigger battery needs a bigger charger; the 48 h does not stretch\./.test(f55[0].text) && f55[0].ref === 'NFPA 72-2025 §10.6.10.3.2' && /ASSUMED/.test(f55[0].text), f55[0].text);
    const charge = (ah, a, hrs) => { const r = rig(); r.pn.p.ah = ah; r.pn.p.chgA = a; r.S.step(1); r.pn.p.battH = 0; r.S.warp(hrs * 3600); return r.pn.p.battH / DI.panelH(r.W, r.pn); };
    const u48 = charge(100, 1, 48.1), u100 = charge(100, 1, 100.1), u99 = charge(100, 1, 99), o47 = charge(26, 10, 47), o48 = charge(26, 10, 48.1), m47 = charge(26, 0, 47);
    ok('A110 in the sim an undersized charger really takes longer (1 A on 100 Ah: 48 % at 48 h, full at 100 h), an oversized one never charges faster than the 48 h rate, and the 48 h never stretches', Math.abs(u48 - 0.481) < 0.005 && u99 < 1 && Math.abs(u100 - 1) < 1e-9 && Math.abs(o47 - m47) < 1e-9 && o47 < 0.985 && Math.abs(o48 - 1) < 1e-9 && DI.RECHARGE_H === 48 &&
      [7, 26, 55, 100].every((ah) => DI.CHG_A.every((a) => DI.chargeRate(pn(ah, a), 24) <= 24 / 48 + 1e-12)) && DI.chargeRate(pn(100, 0), 24) === 0.5 && !/RECHARGE_H \* \(|RECHARGE_H \* ah|RECHARGE_H \* c\.ah/.test(DI.chargerAh.toString() + DI.chargeRate.toString() + DI.review.toString()), 'at 48 h: ' + (u48 * 100).toFixed(1) + ' %');
    const cost = (ah, a) => DI.partCost('panel', { ah, chgA: a });
    ok('A110 cost rises with Ah and with amperes (ASSUMED) and the default panel costs what it always did; an old save gets charger 0', cost(26, 0) === DI.PARTS.panel.cost && DI.partCost('panel') === DI.PARTS.panel.cost && cost(55, 0) > cost(26, 0) && cost(100, 0) > cost(55, 0) && cost(26, 2) > cost(26, 1) && cost(26, 1) > cost(26, 0) && cost(26, 10) > cost(26, 6) && DI.BATT_COST_PER_AH > 0 &&
      DI.migratePart({ id: 1, type: 'panel', x: 0, y: 0, rot: 0, p: { silenced: false } }).p.chgA === 0 && !/partCost|BATT_COST|CHG_COST/.test(DI.SCEN.map((sc) => sc.goals.map((q) => q.ok.toString()).join('')).join('')));
    const refs = []; for (const sc of DI.SCEN) { if (!DI.BOT[sc.id]) continue; const q = DI.buildScenario(sc); DI.botBuild(q.S, sc.id); if (DI.review(q.S).some((x) => /charger|not a listed VEA|bypass tamper/.test(x.text)) || q.W.byType('panel').some((p) => p.p.chgA !== 0) || q.W.rooms.some((x) => x.type === 'cold')) refs.push(sc.id); }
    ok('A110 no reference build gains a charger finding, and no contract uses a charger pick or the freezer room', refs.length === 0, refs.join() || undefined);
  }
  // A111 persistence and old saves
  {
    // mid-outage: a restoral queued, an entry that owes one, and a latched waterflow
    const r = dactRig(); DI.setGate(r.S, r.g.id, 0); run(r.S, 8, 0.25); r.pn.p.chan = [0, 0]; r.S.step(1); DI.setGate(r.S, r.g.id, 1); run(r.S, 8, 0.25); r.stn.p.on = true; run(r.S, 5, 1); r.stn.p.on = false; DI.panelReset(r.S, r.pn.id); run(r.S, 5, 1); r.v.p.wfL = true;
    const q = reload7(r), same = JSON.stringify(q.S.dq) === JSON.stringify(r.S.dq) && r.S.dq.some((e) => e.kind === 'rest') && r.S.dq.length === 3; q.pn.p.chan = [1, 1]; run(q.S, 90, 1); const sq = sends(q).map((x) => x[1]).join();
    ok('A111 a save made in an outage keeps the queue with its restoral entry and the waterflow latch; after the load the sends run in order and the late alarm’s restoral is sent', same && q.v.p.wfL === true && q.S.sig.has('wf' + q.v.id) && q.S.sig.get('wf' + q.v.id).hold === true && sq === 'ALARM,ALARM,REST,REST,REST,COMM' && q.S.dq.filter((e) => e.rsT >= 0).length === 2 && q.S.dq.every((e) => !e.rs), sq);
    const mid = dactRig(); mid.pn.p.chan = [0, 0]; mid.S.step(1); mid.stn.p.on = true; run(mid.S, 5, 1); mid.stn.p.on = false; DI.panelReset(mid.S, mid.pn.id); run(mid.S, 5, 1); mid.pn.p.chan = [1, 1]; run(mid.S, 5, 1); const owed = mid.S.dq.filter((e) => e.rs).length, q1 = reload7(mid), kept = q1.S.dq.filter((e) => e.rs).length, next1 = q1.pn.p.dqNext; run(q1.S, 60, 1);
    ok('A111 a save made between a late send and its restoral keeps the restoral owed and its send time, and sends it after the load', owed >= 1 && kept === owed && next1 === mid.pn.p.dqNext && next1 > 0 && q1.pn.p.dqNext === undefined && q1.S.dq.every((e) => !e.rs) && q1.S.dq.filter((e) => e.rsT >= 0).length === 2);
    // mid return step: an error on the list, the minimum-pressure keys
    const rt = retRig(); rt.v.p.sdrain = 1; rt.S.touch(); let n = 0; while (!rt.s.lowAir && n++ < 4000) rt.S.step(0.02); rt.v.p.sdrain = 0; rt.S.touch(); rt.S.step(0.02); DI.returnFinish(rt.S, rt.v.id); const q2 = reload7(rt);
    ok('A111 the pending return step survives save and load with its errors (the missing list included) and the minimum-pressure keys; Finish works afterwards', q2.s.ret === true && JSON.stringify(q2.s.rtErr) === JSON.stringify(rt.s.rtErr) && rt.s.rtErr.length === 2 && rt.s.rtErr[1].miss.length >= 1 && q2.s.rtMin === rt.s.rtMin && q2.s.rtP0 === rt.s.rtP0 && typeof rt.s.rtMin === 'number' && (refillTo(q2, 27.5), run(q2.S, 3, 0.25), DI.returnFinish(q2.S, q2.v.id)) === '' && q2.S.acts.filter((a) => a.kind === 'return-normal')[0].errs.length === 2);
    // the new settings and props
    const all = rig({ room: 'cold', gate: true }); all.W.rooms[0].below5 = true; Object.assign(all.W.cfg, { refillSeq: true, asdModel: 'VEA', detThr: [0.03, 0.06, 2.5, 1.2] }); all.v.p.avcTamper = 1; all.pn.p.chgA = 2; all.pn.p.ah = 55; Object.assign(all.W.byType('comp')[0].p, { maxPsi: 100, relief: 75 }); all.W.ver++; run(all.S, 3, 1);
    const q3 = reload7(all), c3 = q3.W.byType('comp')[0].p;
    ok('A111 refillSeq, the bypass tamper, a freezer room, the VEA model and pick, the charger and the compressor limits are all intact after save and load', DI.refillSeq(q3.W) === true && q3.v.p.avcTamper === 1 && q3.W.rooms[0].below5 === true && DI.refillLimit(q3.W, q3.S.sysd.info.get(q3.v.id)) === 3600 && DI.isVea(q3.W) && DI.veaFire1(q3.W) === 2.5 && q3.pn.p.chgA === 2 && q3.pn.p.ah === 55 && c3.maxPsi === 100 && c3.relief === 75 && DI.bypassTarget(q3.W, q3.S.sysd.info.get(q3.v.id)) === 75);
    // a Cycle 6 save: none of the Cycle 7 fields, and the old site flag set
    const strip = (jw, js) => { for (const p of jw.parts) for (const k of ['wfL', 'avcTamper', 'maxPsi', 'relief', 'chgA']) delete p.p[k]; for (const k of ['refillSeq', 'asdModel']) delete jw.cfg[k]; jw.cfg.refrigerated = true; for (const x of jw.rooms) delete x.below5; for (const x of js.ss) for (const k of ['rtMin', 'rtP0']) delete x[1][k]; for (const e of js.dq) for (const k of ['kind', 'rs', 'rsT']) delete e[k]; };
    const old = dactRig(); old.pn.p.chan = [0, 0]; old.S.step(1); old.pn.p.chgFail = true; run(old.S, 30, 1); old.pn.p.chan = [1, 1]; run(old.S, 30, 1); const sent0 = old.S.dq.filter((e) => e.state === 'SENT').length;
    const q6 = reload7(old, strip), c6c = q6.W.byType('comp')[0].p; run(q6.S, 60, 1);
    ok('A111 a Cycle 6 save loads with every new field at its default (no latch, no tamper, compressor not modeled, charger matched, model VEP, parallel refill, hold ON), no restoral queued for what was already sent, no error, and the site flag gone', q6.v.p.wfL === false && q6.v.p.avcTamper === 0 && c6c.maxPsi === 0 && c6c.relief === 0 && q6.pn.p.chgA === 0 && DI.asdModel(q6.W) === 'VEP' && DI.refillSeq(q6.W) === false && DI.dactHold(q6.W) === true && !('refrigerated' in q6.W.cfg) &&
      DI.refillLimit(q6.W, q6.S.sysd.info.get(q6.v.id)) === 1800 && sent0 === 2 && q6.S.dq.length === 2 && q6.S.dq.every((e) => e.state === 'SENT' && !e.rs && e.rsT === undefined && e.kind === undefined) && !q6.S.log.some((l) => /^RESTORAL \d/.test(l.text)) && q6.S.log.filter((l) => l.text === DI.COLD_MIGRATED).length === 1 && q6.s.state === 'dry' && q6.s.set && DI.bypassTarget(q6.W, q6.S.sysd.info.get(q6.v.id)) === 60);
    DI.setJuris(new DI.World(4, 4));
  }
  // A112 regression: the company locks, with everything of Cycle 7 switched on
  {
    ok('A112 the truth-table runner is 17 of 17 and the fixture is the pinned file', resTT.length === 17 && resTT.every((q) => q.ok) && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && TT.FIXTURE_SHA16 === 'cb3462b268359c6e');
    // both channels down, the battery low, an undersized charger that has also failed, the main drain open, the AVC bypass open with its
    // tamper switch, a waterflow latch held, sequential refill on, and a return-to-normal step pending
    const worst = () => { const q = dactRig({ det: 'vesda' }); q.W.cfg.refillSeq = true; q.pn.p.chan = [0, 0]; q.pn.p.battH = 1; q.pn.p.chgFail = true; q.pn.p.chgA = 1; q.pn.p.ah = 26; q.v.p.drain = 1; q.v.p.avcBy = 1; q.v.p.avcTamper = 1; q.v.p.wfL = true; q.s.ret = true; DI.rtClear(q.s); q.S.touch(); run(q.S, 5, 1); return q; };
    const w = worst(), pre = w.S.sig.has('lb' + w.pn.id) && w.S.sig.has('dc' + w.pn.id) && w.S.sig.has('avcT' + w.v.id) && w.S.sig.has('wf' + w.v.id) && w.s.ret === true; breakHead(w); const pOnly = w.v.p.pLatch === true && w.s.state === 'dry' && w.s.wat === 0; smoke(w.S, 0.2, 10); run(w.S, 20, 0.25);
    ok('A112 release = (D AND P) does not depend on the DACT, the battery, the charger, the drains, the latches or the Finish step: with all of that against it the zone still releases on Fire 1 AND P and on nothing less', pre && pOnly && w.s.tripT > 0 && w.v.p.solOut === true && w.s.state !== 'dry' && quiet(w) && w.s.ret === false);
    const f2 = worst(); smoke(f2.S, 1.5, 30); const hi = worst(); hi.v.p.drain = 0; hi.S.touch(); hi.S.warp(1500); const la = worst(); la.v.p.avcBy = 0; la.v.p.drain = 0; la.v.p.airValve = 0; la.s.holes = 400; la.S.touch(); let n = 0; while (!la.S.sig.has('la' + la.v.id) && n++ < 4000) la.S.step(1); run(la.S, 60, 1);
    ok('A112 Fire 2 never releases alone; low air and high air are supervisory only and never a release input', f2.d.p.lvl === 4 && f2.v.p.sol === true && f2.v.p.pLatch === false && f2.v.p.solOut === false && f2.s.state === 'dry' && f2.s.wat === 0 && hi.S.sig.get('ha' + hi.v.id).type === 'SUPV' && hi.s.state === 'dry' && hi.s.tripT < 0 && hi.s.P > hi.v.p.hiAir && la.S.sig.get('la' + la.v.id).type === 'SUPV' && la.s.state === 'dry' && la.s.tripT < 0 &&
      !/loAir|lowAir|hiAir|avc|drain|batt|chan|chg|wfL|\bdq\b|\bret\b|rtErr/.test(DI.relState.toString()));
    const W0 = new DI.World(4, 4), sch = Object.fromEntries(DI.signalSchedule(W0).map((q) => [q.key, q])), ev = (vec, cfg) => { const r = rig(); Object.assign(r.W.cfg, cfg); return DI.ceEval(r.W, r.v, vec); };
    const p = rig(); p.v.p.sdrain = 1; p.S.touch(); run(p.S, 20, 0.25); const po = p.S.sig.get('pl' + p.v.id);
    ok('A112 the EPO hook is waterflow only and default OFF; the HVAC hook is never on Alert or Action; Alert, Action and P never dispatch; P on El/El is OPEN, never supervisory', DI.epoHook(W0) === false && DI.hvacHook(W0) === 'none' && ev({ waterflow: true }, { epoHook: true }).epo && !ev({ fire1: true, p: true }, { epoHook: true }).epo && !ev({ alert: true }, { hvacHook: 'fire1' }).hvac && !ev({ action: true }, { hvacHook: 'fire2' }).hvac &&
      sch.alert.fd === 'No' && sch.action.fd === 'No' && sch.pLatch.fd === 'No' && !ev({ alert: true, action: true, p: true }, { sigClass: { alert: 'ALARM', action: 'ALARM', pLatch: 'ALARM' } }).fd && Object.keys(DI.SIG_FD).join() === 'fire1,fire2,manual,mrz,waterflow,spot' && po.type === 'OPEN' && po.fd === false && !DI.SIG_CLASS.pLatch.includes('SUPV') && DI.inClass(W0, 'pLatch') === 'OPEN');
    const head = fs.readFileSync(path.join(__dirname, '..', 'src', 'alarm.js'), 'utf8').split('\n').slice(0, 30).join('\n'), q = DI.PARTS.prev.props;
    ok('A112 DI.relState and the D logic at the top of alarm.js are byte-identical to 68bb926 (the same hashes since Cycle 4); setpoints stay 50 / 40 / 30 / 20; C stays 100; preaction has no release mode', sha16(DI.relState.toString()) === 'a19f3e39ec09d52e' && sha16(head) === '1581435a5c3a9485' && [q.hiAir, q.airSet, q.loAir, q.pTrip].join() === '50,40,30,20' && DI.pipeC() === 100 && !('mode' in q) && DI.inClass(W0, 'lowAir') === 'SUPV' && DI.inClass(W0, 'highAir') === 'SUPV' && DI.inClass(W0, 'supplyAir') === 'TRBL', sha16(DI.relState.toString()) + ' ' + sha16(head));
    ok('A112 DI.JURIS keeps US-2025, US-2022 and US-2019 and a hidden CA-2019', Object.keys(DI.JURIS).join() === 'US-2025,US-2022,US-2019,CA-2019' && DI.editionChoices().join() === 'US-2019,US-2022,US-2025' && DI.JURIS['CA-2019'].hidden === true && DI.EDITION_DEFAULT === 'US-2025');
    // the standalone file is what build-standalone.js makes from index.html and src/ as they are now
    const root = path.join(__dirname, '..'); let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, f) => '<style>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '</style>').replace(/<script src="([^"]+)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/g, '<\\/script') + '\n</script>');
    ok('A112 build-standalone.js reproduces double-interlock.html byte for byte (run it after any change in src/)', html === fs.readFileSync(path.join(root, 'double-interlock.html'), 'utf8'));
    DI.setJuris(new DI.World(4, 4));
  }
  // ======================= Cycle 8 =======================
  // label corrections, NAC voltage drop, the two-number refill report, Finish once per blocker set, compressor and
  // owner warnings, Tutor wording, per-room telecom. Text read from the sources or from the evaluated manual (a child
  // process loads manual.js, so this process keeps DI.MANUAL undefined for the static block below).
  const SRC8 = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ROOT8 = path.join(__dirname, '..');
  const ENG8 = ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'cause', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3'];
  const manual8 = JSON.parse(require('child_process').execFileSync(process.execPath, ['-e', 'for (const f of ' + JSON.stringify(ENG8.concat(['manual'])) + ') require(' + JSON.stringify(path.join(ROOT8, 'src') + path.sep) + ' + f + ".js"); process.stdout.write(JSON.stringify(globalThis.DI.MANUAL.map((m) => m.h)))'], { maxBuffer: 1 << 26 }).toString()).join('\n');
  const allSrc8 = fs.readdirSync(path.join(ROOT8, 'src')).filter((f) => f.endsWith('.js')).map((f) => [f, SRC8(f)]), readme8 = fs.readFileSync(path.join(ROOT8, 'README.md'), 'utf8'), claude8 = fs.readFileSync(path.join(ROOT8, 'CLAUDE.md'), 'utf8');
  const docs8 = allSrc8.map((q) => q[1]).join('\n') + readme8 + claude8, uiSrc8 = SRC8('ui.js'), inspSrc8 = SRC8('inspect.js');
  // A113 2019 and CA-2019 station labels
  {
    const ver = (cfg) => { const r = liveRig({ gate: true }); Object.assign(r.W.cfg, cfg); DI.setGate(r.S, r.g.id, 0); run(r.S, 8, 0.25); DI.setGate(r.S, r.g.id, 1); run(r.S, 8, 0.25); return { line: r.S.log.find((x) => /^RESTORAL to station: /.test(x.text)).text, note: DI.stationNote(r.W), haz: DI.dactHazard(r.W), W: r.W }; };
    const u19 = ver({ ed72: '2019' }), ca = ver({ edition: 'CA-2019' }), u25 = ver({}), row19 = Object.values(DI.REF72[2019]).join(' | ');
    ok('A113 2019: the restoral and late-dispatch cites are §26.2.5.1 and §26.2.1.2, held like 2022 and 2025; no 2019 key and no 2019 or CA-2019 player text says VERIFY or "not on disk"', DI.REF72[2019].restoral === 'NFPA 72-2019 §26.2.5.1' && DI.REF72[2019].retransmit === 'NFPA 72-2019 §26.2.1.2' && !/VERIFY|not on disk/i.test(row19) &&
      !/VERIFY|not on disk/i.test(u19.line + u19.note + u19.haz + ca.line + ca.note + ca.haz + DI.CE_DACT_NOTE + DI.JURIS['CA-2019'].note.replace('verify before ship', '')) && !/the 2019 text is not on disk|shows? VERIFY on the/.test(manual8) && [2019, 2022, 2025].every((y) => DI.restoralTag({ cfg: { ed72: String(y) } }) === '') && DI.restoralTag(ca.W) === '' && !/restoralTag\(W\)/.test(DI.dactStep.toString() + DI.restoralStep.toString()), u19.line);
    ok('A113 §26.2.2 is cited in the late-dispatch text (verification is not a late-signal or no-dispatch path), in the station queue footnote, the Site dialog and the manual', DI.REF72[2019].stnVerify === 'NFPA 72-2019 §26.2.2' && DI.REF72[2025].stnVerify === 'NFPA 72-2025 §26.2.2' && u19.note === 'Restorals are reported to the station (NFPA 72-2019 §26.2.5.1). An alarm sent late still dispatches: a received fire alarm is retransmitted at once (NFPA 72-2019 §26.2.1.2). Verification (NFPA 72-2019 §26.2.2) is not a late-signal or no-dispatch path. [CODE]' &&
      u25.note.includes('NFPA 72-2025 §26.2.2') && /esc\(R72\.stnVerify\) \+ '\) is not a late-signal or no-dispatch path/.test(uiSrc8) && /id="stqFoot">' \+ esc\(DI\.stationNote\(W\)\)/.test(uiSrc8) && /verification \(&sect;26\.2\.2\) is not a late-signal or no-dispatch path \[CODE, 2019, 2022 and 2025\]/.test(manual8), u19.note);
    const where = allSrc8.filter((q) => /26\.2\.1\.4/.test(q[1])).map((q) => q[0]).join(), jurisCode = SRC8('juris.js').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    ok('A113 §26.2.1.4 (subsequent signals) is never shown on a 2019 build and is unmodelled: no 2019 string carries it, only the manual names it, as 2022 and 2025 only', !/26\.2\.1\.4/.test(row19 + u19.line + u19.note + u19.haz + ca.note) && where === 'juris.js,manual.js' && !/26\.2\.1\.4/.test(jurisCode) && /&sect;26\.2\.1\.4 \(subsequent signals\) is in the 2022 and 2025 editions only; it is not modelled in any edition and is not shown on a 2019 site/.test(manual8), where);
    ok('A113 CA-2019 is the NFPA 72-2019 label only: the note names ULC S561 as not held, the station footnote carries it on a Canadian build only, and its cites are NFPA 72-2019 sections, never a Canadian standard', DI.JURIS['CA-2019'].note.includes('CA-2019 is the NFPA 72-2019 label only. CAN/ULC-S561 is not held (on hold). The station rule is not shown as Canadian code.') && DI.CA_STATION_NOTE === 'CA-2019 is the NFPA 72-2019 label only. CAN/ULC-S561 is not held (on hold). The station rule is not shown as Canadian code.' &&
      ca.note.endsWith('[CODE] ' + DI.CA_STATION_NOTE) && ca.note.includes('NFPA 72-2019 §26.2.5.1') && !u19.note.includes('CA-2019') && !u25.note.includes('ULC') && !/(CAN\/ULC|CSA|NBC)[^.]*§/.test(ca.note) && manual8.includes(DI.CA_STATION_NOTE), ca.note);
    DI.setJuris(new DI.World(4, 4));
  }
  // A114 the latch label
  {
    const L = (y) => DI.REF72[y].latch;
    ok('A114 the latch label per edition: PRACTICE with code support, §10.11.6, §23.8.2.2 [indirect], and §10.18.1.1.2 in 2019 against §10.18.1.2 in 2022 and 2025, NEEDS PE REVIEW', L(2019) === 'PRACTICE with code support (NFPA 72-2019 §10.11.6, §23.8.2.2 [indirect], §10.18.1.1.2), NEEDS PE REVIEW' && L(2022) === 'PRACTICE with code support (NFPA 72-2022 §10.11.6, §23.8.2.2 [indirect], §10.18.1.2), NEEDS PE REVIEW' &&
      L(2025) === 'PRACTICE with code support (NFPA 72-2025 §10.11.6, §23.8.2.2 [indirect], §10.18.1.2), NEEDS PE REVIEW' && [2019, 2022, 2025].every((y) => L(y).startsWith('PRACTICE with code support') && L(y).includes('§10.11.6') && L(y).includes('§23.8.2.2 [indirect]') && L(y).endsWith('NEEDS PE REVIEW')) && !L(2022).includes('10.18.1.1.2') && !L(2025).includes('10.18.1.1.2'), L(2019));
    const w19 = new DI.World(4, 4); w19.cfg.ed72 = '2019';
    ok('A114 "no general latch rule is on disk" is gone from src, README and CLAUDE.md; the label is on the signal schedule, the panel tip and the engine comment', !/no general latch rule/i.test(docs8) && DI.schedLatch(new DI.World(4, 4)).startsWith('Waterflow latches at the panel until a panel reset: PRACTICE with code support (NFPA 72-2025 §10.11.6') && DI.schedLatch(w19).includes('§10.18.1.1.2') &&
      /id="schedLatch"[^>]*>' \+ esc\(DI\.schedLatch\(W\)\)/.test(uiSrc8) && /until a reset \(' \+ DI\.ref72\(W\)\.latch \+ '\)/.test(inspSrc8) && /the label is DI\.ref72\(W\)\.latch/.test(SRC8('alarm.js')));
    ok('A114 the manual says §23.8.2.2 is indirect support and never calls it a latch rule; no NFPA 72 sentence says alarms latch until manual reset; §10.14.2 is supervisory only', /&sect;23\.8\.2\.2 is about combined subsystems that share equipment/.test(manual8) && /it is <b>indirect support<\/b>: it stays in the cite list and is never quoted as a rule that alarms hold until reset/.test(manual8) && /No NFPA 72 sentence says fire alarms latch until manual reset, and &sect;10\.14\.2 covers supervisory latching only/.test(manual8) &&
      /&sect;10\.11\.6 says resetting of alarm signals shall comply with &sect;23\.8\.2\.2: the same number and sentence in 2019, 2022 and 2025 \[CODE\]/.test(manual8) && !/23\.8\.2\.2[^.]{0,80}(is|as) (a|the) latch rule/i.test(manual8.replace(/never quoted as a latch rule/g, '') + DI.schedLatch(w19).replace('is not quoted as a latch rule', '')));
    // behaviour unchanged: the latch itself (A95) is as it was
    const r = liveRig({ gate: true }); r.v.p.itc = 1; r.S.touch(); r.v.p.mech = true; run(r.S, 60, 0.25); const flowing = r.S.sig.has('wf' + r.v.id) && r.v.p.wfL === true; DI.setGate(r.S, r.g.id, 0); run(r.S, 60, 0.25);
    ok('A114 behaviour is unchanged: the waterflow alarm stays at the panel after the flow has stopped, marked latched, until a panel reset', flowing && r.S.sig.has('wf' + r.v.id) && r.S.sig.get('wf' + r.v.id).hold === true && /\(latched: reset the panel\)$/.test(r.S.sig.get('wf' + r.v.id).text) && (DI.panelReset(r.S, r.pn.id), run(r.S, 2, 0.25), !r.S.sig.has('wf' + r.v.id)));
  }
  // A115 the 10 percent: a trigger to investigate, not an automatic fail
  {
    ok('A115 static: "rule of thumb" appears nowhere in src, README or CLAUDE.md', !/rule of thumb/i.test(docs8));
    ok('A115 the hint is the Tutor’s, word for word, with the drop to one decimal', DI.mdtHint(0.12) === 'Full flow pressure is 12.0 percent lower than the last test. NFPA 25 says find the cause. A partly closed valve is the usual one. Check the zone control valve and the supply valves upstream (riser control valve, PIV, backflow preventer valves).' && DI.mdtHint(0.1234).startsWith('Full flow pressure is 12.3 percent lower'));
    const r = rig({ gate: true }), go = (f) => { if (f) r.v.p.drainBase = r.v.p.drainBase0 / f; DI.startTest(r.S, 'drain', r.v.id); run(r.S, 45, 0.25); return DI.lastResult(r.S, 'drain', r.v.id); };
    const first = go(); r.v.p.drainBase0 = first.val; const d9 = go(0.91), d10 = go(0.90), d12 = go(0.88), logged = r.S.log.filter((l) => /^Main drain test: (PASS|FAIL|INVESTIGATE) - /.test(l.text)).map((l) => l.text.split(' - ')[0] + '/' + l.cls);
    ok('A115 a 12 percent drop: the reference line is DI.REF25.passLine (the Tutor’s sentence), then the hint; pass:false, invest:true; the log reads INVESTIGATE in amber', Math.abs(d12.drop - 0.12) < 1e-9 && d12.pass === false && d12.invest === true && d12.lines[3] === DI.REF25.passLine && d12.lines[4] === DI.mdtHint(d12.drop) && d12.lines.length === 5 && /^Previous full flow pressure: \d+ psi \(DOWN 12%\)$/.test(d12.lines[2]) && /^Full-flow \(residual\): /.test(d12.lines[1]) &&
      DI.REF25.passLine === DI.REF25.passRule + ': a 10 percent drop in full flow pressure vs the acceptance test or earlier tests means find the cause and correct it if necessary.' && logged[3] === 'Main drain test: INVESTIGATE/warn', d12.lines.join(' | '));
    ok('A115 no baseline, a 9 percent drop and exactly 10.0 percent are not INVESTIGATE: PASS, no hint, and the trigger is strictly more than 10 percent', first.pass === true && !first.invest && first.lines.length === 3 && Math.abs(d9.drop - 0.09) < 1e-9 && d9.pass === true && !d9.invest && d9.lines.length === 4 && d9.lines[3] === DI.REF25.passLine && Math.abs(d10.drop - 0.10) < 1e-9 && d10.pass === true && !d10.invest &&
      logged.slice(0, 3).join() === 'Main drain test: PASS/good,Main drain test: PASS/good,Main drain test: PASS/good' && DI.MDT_DROP === 0.10 && DI.mdtBig(0.1) === false && DI.mdtBig(0.1001) === true, 'drops ' + [d9.drop, d10.drop, d12.drop].map((x) => x.toFixed(4)).join(' / '));
    ok('A115 the badge: INVESTIGATE for a result that carries invest, PASS and FAIL unchanged for every other result; ui.resHtml and the log read the same function', DI.resBadge(d12) === 'INVESTIGATE' && DI.resBadge(d9) === 'PASS' && DI.resBadge({ pass: false }) === 'FAIL' && DI.resBadge({ pass: true }) === 'PASS' && r.S.results.filter((q) => q.invest).length === 1 &&
      /ui\.resHtml = \(r\) => '<div class="res ' \+ \(r\.pass \? 'pass' : r\.invest \? 'warn' : 'fail'\) \+ '"><b>' \+ DI\.resBadge\(r\) \+ ' · '/.test(uiSrc8) && /\.res\.warn \{ border-color:var\(--amb\); \}/.test(fs.readFileSync(path.join(ROOT8, 'src', 'style.css'), 'utf8')) && /DI\.resBadge\(res\)/.test(DI.procStep ? DI.procStep.toString() : SRC8('proc.js')));
    const act = r.S.acts.filter((a) => a.kind === 'main-drain-test').pop();
    ok('A115 the follow-up reads the result as before: the 12 percent test is not "followed" until a drop-check, and the act still carries pass:false, drop and base', act.pass === false && Math.abs(act.drop - 0.12) < 1e-9 && act.base > 0 && DI.dropFollowed(r.S, act) === false && (DI.dropCheck(r.S, r.v.id), DI.dropFollowed(r.S, act) === true));
  }
  // A116 step 14 and the room name
  {
    ok('A116 the step 14 label is the Tutor’s, word for word; the banner line starts with "Company practice.", keeps the procedure sentence and ends with the find-the-cause sentence', DI.RECOVERY_DRAIN.join('|') === 'drain-test|Main drain test (company practice). NFPA 25 requires a valve status test after a control valve is reopened (2023 13.3.3.4).' &&
      DI.MDT_LINE === 'Company practice. Main drain test: with the control valve fully open, open the main drain fully, record static and residual pressure, then close it slowly. A 10 percent drop in full flow pressure against the last test means find the cause (NFPA 25).' && DI.MDT_SKIPPED === 'Main drain test not done. After any control valve is closed and reopened, run one to prove the valve is fully open.');
    const r = recover(60, { noDrain: true }), sc = drillScore(r), rep = DI.drillRecovery(r.S, 'the broken sprinkler').map((q) => q[1]);
    ok('A116 the drill checklist and the report read "company practice": step 14 carries the label, a skipped step 14 is named "main drain test (company practice)", and the inspector names NFPA 25-2023 §13.3.3.4', sc.steps[13].label === DI.RECOVERY_DRAIN[1] && sc.steps[13].done === false && /Missing: main drain test \(company practice\)$/.test(rep[0]) && rep.includes(DI.MDT_SKIPPED) &&
      /B\.row\('Drill step 14: main drain test \(company practice\)'/.test(inspSrc8) && /'Step 14, scored in this drill: ' \+ DI\.RECOVERY_DRAIN\[1\] \+ ' ' \+ DI\.MDT_LINE/.test(inspSrc8) && DI.REF25.valveStatusShort === 'NFPA 25-2023 §13.3.3.4' && /valve status test after a control valve is reopened \(' \+ DI\.REF25\.valveStatusShort/.test(inspSrc8), rep[0]);
    const W = new DI.World(30, 10), f = W.addRoom('cold', 1, 1, 4, 4), dk = W.addRoom('cold', 6, 1, 4, 4), h = W.addRoom('hall', 11, 1, 4, 4); f.below5 = true; const Z = (...ids) => ({ rooms: new Set(ids), src: [] });
    ok('A116 the cold room type is named Refrigerated Space, and the numbers are unchanged: not held below 5 F 30 min, a mixed zone 30 min, every room held below 5 F 60 min', DI.ROOMS.cold.name === 'Refrigerated Space' && f.name === 'Refrigerated Space' && DI.refillLimit(W, Z(dk.id)) === 1800 && DI.refillLimit(W, Z(f.id, dk.id)) === 1800 && DI.refillLimit(W, Z(f.id, h.id)) === 1800 && DI.refillLimit(W, Z(f.id)) === 3600 && (dk.below5 = true, DI.refillLimit(W, Z(f.id, dk.id)) === 3600));
    const leftover = allSrc8.filter((q) => /Freezer \/ Cold Dock/.test(q[1].replace("DI.COLD_OLD_NAME = 'Freezer / Cold Dock';", ''))).map((q) => q[0]).join();
    ok('A116 no string calls a cold dock qualifying: the old name survives only as the migration constant, and the texts say a cooled dock at 35 F does not qualify', leftover === '' && DI.COLD_OLD_NAME === 'Freezer / Cold Dock' && DI.COLD_NOTE.includes('A cooled dock at 35 F does not qualify.') && /B\.row\('Held below 5 F \(freezer\)'/.test(inspSrc8) && /'no: a cooled space \(a 35 F dock, for example\) does not qualify: 30 min'/.test(inspSrc8) && /60 min air refill limit for a zone wholly in freezer rooms/.test(inspSrc8) && !/Freezer \/ Cold Dock/.test(readme8 + claude8), leftover || undefined);
    const jw = JSON.parse(JSON.stringify(W.toJSON())); for (const x of jw.rooms) if (x.type === 'cold') x.name = 'Freezer / Cold Dock'; delete jw.v; jw.rooms[1].name = 'Dock 7'; const Wo = DI.World.fromJSON(jw);
    ok('A116 an old save with a cold room loads, keeps below5 and its own name, and a room still carrying the old default name is renamed', Wo.rooms[0].type === 'cold' && Wo.rooms[0].below5 === true && Wo.rooms[0].name === 'Refrigerated Space' && Wo.rooms[1].name === 'Dock 7' && Wo.rooms[1].below5 === true && Wo.rooms[2].name === 'Data Hall');
  }
  // A117 the NAC check is off by default: nothing changes for an old save or for any contract
  {
    const r = rig(), q = r.pn.p, D = { nacOn: 0, nacAwg: 14, nacFt: 200, nacN: 8, nacCd: 75, nacV: 0 }, rv0 = JSON.stringify(DI.review(r.S));
    const jw = JSON.parse(JSON.stringify(r.W.toJSON())); for (const p of jw.parts) for (const k of Object.keys(D)) delete p.p[k]; delete jw.v;
    const Wo = DI.World.fromJSON(jw), So = new DI.Sim(Wo); So.restore(JSON.parse(JSON.stringify(r.S.dump()))); const po = Wo.byType('panel')[0].p;
    ok('A117 a new panel and a Cycle 7 save both carry the NAC props at their defaults (off), and the review of the loaded save is identical', Object.keys(D).every((k) => q[k] === D[k] && po[k] === D[k] && DI.PARTS.panel.props[k] === D[k]) && JSON.stringify(DI.review(So)) === rv0 && !/NAC/.test(rv0) && DI.migratePart({ id: 1, type: 'panel', x: 0, y: 0, rot: 0, p: { silenced: false } }).p.nacOn === 0);
    const c = DI.nacCalc(r.W, r.pn);
    ok('A117 DI.nacCalc on an off panel says on:false and raises no finding; no signal, no registry key and no matrix row exist for it (28 fixed keys, 21 rows)', c.on === false && DI.nacFinding(r.W, r.pn) === null && Object.keys(DI.SIG_FIXED).length === 28 && DI.CE_ROWS.length === 21 && !Object.keys(DI.SIG_FIXED).concat(Object.keys(DI.SIG_META), DI.CE_ROWS.map((x) => x.key), DI.CE_COLS).some((k) => /nac(?!ks)/i.test(k) && k !== 'LocalNAC') &&
      ![...r.S.sig.keys()].some((k) => /nac/i.test(k)));
    // the plan review of every contract, built by the reference bot, is byte-identical to Cycle 7 (sha16 of the JSON, taken at 5479029): as built, after the bot, after the settle
    const C7 = { c1: '5f194bf457495517,8a5aead7ece265b1,8a5aead7ece265b1', c2: 'eb0c4dd89c0aab12,c1793a3828a0b95a,c1793a3828a0b95a', c3: 'c1793a3828a0b95a,ba4ed4d156090ac5,ba4ed4d156090ac5', c4: 'ba4ed4d156090ac5,8a5aead7ece265b1,8a5aead7ece265b1',
      c5: '0d80d4b103134133,19b1bd7f2f41f207,19b1bd7f2f41f207', c6: 'a92f9560a909ad98,c1793a3828a0b95a,c1793a3828a0b95a', c7: '81129f869c757d19,8a5aead7ece265b1,8a5aead7ece265b1' }, got = {}, extra = [];
    for (const sc of DI.SCEN) { if (!DI.BOT[sc.id]) continue; const a = DI.buildScenario(sc), b = DI.buildScenario(sc), sol = DI.botBuild(b.S, sc.id), h = [sha16(JSON.stringify(DI.review(a.S))), sha16(JSON.stringify(DI.review(b.S)))]; b.S.warp(sol.settle); const rv = DI.review(b.S); h.push(sha16(JSON.stringify(rv))); got[sc.id] = h.join();
      if (rv.some((x) => /NAC|Owner\/insurer|relief \(|NFPA 76/.test(x.text)) || b.W.byType('panel').some((p) => p.p.nacOn !== 0) || 'nec' in b.W.cfg || 'ownerRefill' in b.W.cfg || b.W.rooms.some((x) => x.type === 'tel' || 'n76' in x || 'f1' in x)) extra.push(sc.id); }
    ok('A117 the review of every contract rig and of the c5 reference build is byte-identical to Cycle 7, and no contract uses a Cycle 8 setting, prop or room type', Object.keys(C7).join() === Object.keys(got).join() && Object.keys(C7).every((k) => got[k] === C7[k]) && extra.length === 0, Object.keys(C7).filter((k) => got[k] !== C7[k]).concat(extra).join() || undefined);
    DI.setJuris(new DI.World(4, 4));
  }
  // A118 the NAC math, anchored on hand calculations
  const nac8 = (o, cfg) => { const r = rig(); Object.assign(r.W.cfg, cfg || {}); Object.assign(r.pn.p, { nacOn: 1 }, o); r.W.ver++; return Object.assign(r, { c: DI.nacCalc(r.W, r.pn), f: DI.nacFinding(r.W, r.pn), rv: () => DI.review(r.S).filter((q) => /^Panel #\d+ NAC /.test(q.text)) }); };
  {
    const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);
    ok('A118 the wire table is NFPA 70-2023 Ch. 9 Table 8: 7.95 / 4.99 / 3.14 / 1.98 ohm per 1000 ft for 18 / 16 / 14 / 12 AWG; the other constants are the ASSUMED ones', JSON.stringify(DI.NAC_OHM) === '{"12":1.98,"14":3.14,"16":4.99,"18":7.95}' && DI.NAC_AWG.join() === '18,16,14,12' && DI.NAC_VMIN === 16 && DI.NAC_V_END === 20.4 && DI.NAC_THIN === 0.20 && JSON.stringify(DI.NAC_CD) === '{"15":0.1,"30":0.15,"75":0.2,"95":0.25}' && DI.NAC_VSTART.join() === '0,21,22,23,24' && DI.NAC_N_MAX === 40 &&
      DI.NAC_WIRE === 'NFPA 70-2023 Ch. 9 Table 8, 75 C, uncoated stranded copper [CODE NEC 2023]');
    const a = nac8({ nacN: 14, nacCd: 75, nacFt: 600, nacAwg: 14, nacV: 0 }).c;
    ok('A118 (i) 14 x 75 cd, 600 ft of 14 AWG from 20.4 V: 3.768 ohm, 2.8 A, a drop of 10.5504 V, 9.85 V at the last appliance: FAIL', near(a.R, 3.768) && near(a.iTot, 2.8) && near(a.iEach, 0.20) && near(a.drop, 10.5504) && near(a.vEol, 9.8496) && a.vEol.toFixed(2) === '9.85' && a.below === true && a.thin === false && a.sev === 'fail' && a.startAssumed === true && a.vStart === 20.4, a.vEol.toFixed(4));
    const b = nac8({ nacN: 7, nacCd: 75, nacFt: 600, nacAwg: 12, nacV: 0 }).c;
    ok('A118 (ii) 7 x 75 cd, 600 ft of 12 AWG from 20.4 V: 1.4 A, 2.376 ohm, 3.3264 V, 17.07 V, margin 6.7 %: no FAIL, a THIN warning, longest passing length 793.7 ft', near(b.iTot, 1.4) && near(b.R, 2.376) && near(b.drop, 3.3264) && near(b.vEol, 17.0736) && b.vEol.toFixed(2) === '17.07' && (b.margin * 100).toFixed(1) === '6.7' && b.below === false && b.thin === true && b.sev === 'warn' && b.maxFt.toFixed(1) === '793.7' && near(b.maxFt, 4.4 / 0.005544, 1e-6), b.vEol.toFixed(4) + ' V, max ' + b.maxFt.toFixed(2) + ' ft');
    const c3 = nac8({ nacN: 9, nacCd: 75, nacFt: 600, nacAwg: 12, nacV: 0 }).c;
    ok('A118 (iii) 9 x 75 cd (1.8 A), 600 ft of 12 AWG from 20.4 V: 16.1232 V, margin 0.77 %: a THIN warning, not a FAIL', near(c3.iTot, 1.8) && near(c3.vEol, 16.1232) && (c3.margin * 100).toFixed(2) === '0.77' && c3.below === false && c3.thin === true && c3.sev === 'warn', c3.vEol.toFixed(4));
    const d = nac8({ nacN: 8, nacCd: 75, nacFt: 150, nacAwg: 14, nacV: 24.0 }), e = nac8({ nacN: 8, nacCd: 75, nacFt: 150, nacAwg: 14, nacV: 0 });
    ok('A118 (iv) 8 x 75 cd, 150 ft of 14 AWG: from a given 24.0 V, 22.4928 V and 40.6 %: a clean pass, one info line, no warning; from the ASSUMED 20.4 V, 18.8928 V and 18.1 %: THIN and ASSUMED start, both named', near(d.c.vEol, 22.4928) && (d.c.margin * 100).toFixed(1) === '40.6' && d.c.sev === 'info' && !d.c.thin && !d.c.startAssumed && d.rv().length === 1 && d.rv()[0].sev === 'info' &&
      near(e.c.vEol, 18.8928) && (e.c.margin * 100).toFixed(1) === '18.1' && e.c.thin && e.c.startAssumed && e.c.sev === 'warn' && /THIN: margin 18\.1 %, under 20 % above the 16 V minimum \(PRACTICE, NEEDS PE REVIEW\); the start voltage is ASSUMED \(20\.4 V, end of discharge\): a warning, not a failure/i.test(e.f.text), e.f.text);
    const src = DI.nacCalc.toString(), twos = src.match(/(^|[^\w.])2(?![\w.])/g) || [];
    ok('A118 the length counts both conductors (R = 2 x ft x ohm / 1000) and the Table 8 value is never doubled: the only factor 2 in the calculation is the length factor', /perFt = 2 \* ohm \/ 1000/.test(src) && /R = ft \* perFt/.test(src) && /maxFt = \(vStart - DI\.NAC_VMIN\) \/ \(iTot \* perFt\)/.test(src) && twos.length === 1 && near(a.R, 2 * 600 * 3.14 / 1000) && near(DI.NAC_OHM[14], 3.14), twos.length + ' factor(s) 2');
  }
  // A119 NAC verdicts and severities
  {
    const F = nac8({ nacN: 14, nacCd: 75, nacFt: 600, nacAwg: 14, nacV: 0 }), rvF = DI.review(F.S), fF = F.rv();
    ok('A119 a FAIL is sev fail on the panel, names the panel and the numbers, and the "No code failures found" line is absent', fF.length === 1 && fF[0].sev === 'fail' && fF[0].x === F.pn.x && fF[0].y === F.pn.y && fF[0].text.startsWith('Panel #' + F.pn.id + ' NAC (Class B, end-line-loaded): 14 x 75 cd at 0.20 A = 2.80 A, 600 ft one-way of 14 AWG (3.14 ohm per 1000 ft, both conductors counted: 3.768 ohm), start 20.4 V (ASSUMED): drop 10.55 V, 9.85 V at the last appliance. FAIL: below the appliance listed minimum of 16 V') &&
      !rvF.some((q) => q.sev === 'ok' && q.text === 'No code failures found.') && DI.G.noFails(Object.assign(F.S, { rv: rvF })) === false, fF[0] && fF[0].text);
    const thin = nac8({ nacN: 4, nacCd: 75, nacFt: 600, nacAwg: 12, nacV: 21.0 }), asm = nac8({ nacN: 2, nacCd: 15, nacFt: 100, nacAwg: 12, nacV: 0 }), both = nac8({ nacN: 7, nacCd: 75, nacFt: 600, nacAwg: 12, nacV: 0 }), ok20 = nac8({ nacN: 8, nacCd: 75, nacFt: 150, nacAwg: 14, nacV: 24.0 }), worst = nac8({ nacN: 14, nacCd: 75, nacFt: 600, nacAwg: 14, nacV: 21.0 });
    ok('A119 THIN alone is warn; an ASSUMED start with a passing, non-thin margin is warn, not fail; a given start with a margin of 20 % or more is info only; the worst of the three rules when two apply', thin.c.thin && !thin.c.startAssumed && thin.f.sev === 'warn' && /THIN: margin/.test(thin.f.text) && !/ASSUMED \(20\.4 V/.test(thin.f.text) &&
      !asm.c.thin && !asm.c.below && asm.c.startAssumed && asm.c.margin >= 0.2 && asm.f.sev === 'warn' && /The start voltage is ASSUMED \(20\.4 V, end of discharge\): a warning, not a failure/.test(asm.f.text) && ok20.f.sev === 'info' && /Passes: margin 40\.6 % above the 16 V minimum/.test(ok20.f.text) && /documentation list \(NFPA 72-2025 §7\.2\.1\(8\) \[CODE\]\)/.test(ok20.f.text) &&
      both.f.sev === 'warn' && both.c.thin && both.c.startAssumed && worst.f.sev === 'fail' && worst.c.below && !worst.c.startAssumed, [thin.f.sev, asm.f.sev, ok20.f.sev, both.f.sev, worst.f.sev].join());
    const two = nac8({ nacN: 8, nacV: 24 }); const pn2 = two.W.addPart('panel', 18, 4, 0, { nacOn: 1, nacN: 14, nacFt: 600 }); const pn3 = two.W.addPart('panel', 19, 12, 0); const rv2 = DI.review(two.S).filter((q) => /^Panel #\d+ NAC /.test(q.text));
    ok('A119 one finding per panel whose check is on, placed on that panel; a panel with the check off has none', rv2.length === 2 && rv2[0].text.startsWith('Panel #' + two.pn.id + ' ') && rv2[1].text.startsWith('Panel #' + pn2.id + ' ') && rv2[1].x === pn2.x && rv2[1].sev === 'fail' && rv2[0].sev === 'info' && !rv2.some((q) => q.text.startsWith('Panel #' + pn3.id + ' ')));
    const M = nac8({ nacN: 7, nacCd: 75, nacFt: 600, nacAwg: 12, nacV: 0 }), at = (ft) => { M.pn.p.nacFt = ft; return DI.nacCalc(M.W, M.pn); }, mx = M.c.maxFt, shown = +DI.nacMaxFt(M.c);
    ok('A119 the longest passing length: at maxFt the verdict is not FAIL, at maxFt + 10 it is; the number shown is rounded down so that it passes, and the inspector row reads it', at(mx).below === false && at(mx + 10).below === true && at(shown).below === false && shown <= mx && mx - shown < 0.1 && DI.nacMaxFt(M.c) === '793.6' && at(790).below === false && at(800).below === true &&
      /B\.row\('Longest one-way length that passes', \(\) => DI\.nacMaxFt\(nc\(\)\) \+ ' ft'\)/.test(inspSrc8) && /B\.row\('Voltage at the last appliance'/.test(inspSrc8) && /B\.row\('NAC verdict'/.test(inspSrc8), 'maxFt ' + mx.toFixed(3) + ', shown ' + DI.nacMaxFt(M.c));
  }
  // A120 NAC labels by edition, the Canadian hold and the NEC edition
  {
    ok('A120 basis by NFPA 72 edition: [CODE] with the section range in 2025; PRACTICE in 2022 (§18.3.7 ends at §18.3.7.2) and in 2019 (no §18.3.7); §7.2.1(8) in all three', DI.REF72[2025].nacVd === 'NFPA 72-2025 §18.3.7.1 to §18.3.7.6 [CODE]' && DI.REF72[2022].nacVd === 'PRACTICE: NFPA 72-2022 §18.3.7 ends at §18.3.7.2; the method here is the 2025 §18.3.7.1 to .6 method' &&
      DI.REF72[2019].nacVd === 'PRACTICE: NFPA 72-2019 has no §18.3.7; the method here is the 2025 §18.3.7.1 to .6 method' && [2019, 2022, 2025].every((y) => DI.REF72[y].nacDoc === 'NFPA 72-' + y + ' §7.2.1(8)') && !/\[CODE\]/.test(DI.REF72[2022].nacVd + DI.REF72[2019].nacVd));
    const o = { nacN: 8, nacCd: 75, nacFt: 150, nacAwg: 14, nacV: 24.0 }, e25 = nac8(o), e22 = nac8(o, { ed72: '2022' }), e19 = nac8(o, { edition: 'US-2019' });
    ok('A120 the finding carries the basis of the edition in force as its reference, with the documentation item, and the same verdict in every edition', e25.f.ref === 'NFPA 72-2025 §18.3.7.1 to §18.3.7.6 [CODE]; NFPA 72-2025 §7.2.1(8)' && e22.f.ref.startsWith('PRACTICE: NFPA 72-2022 §18.3.7 ends at §18.3.7.2') && e22.f.ref.endsWith('NFPA 72-2022 §7.2.1(8)') && e19.f.ref.startsWith('PRACTICE: NFPA 72-2019 has no §18.3.7') && e25.f.sev === 'info' && e22.f.sev === 'info' && e19.f.sev === 'info' && e25.c.vEol === e19.c.vEol, e22.f.ref);
    const ca = nac8({ nacN: 14, nacCd: 75, nacFt: 600, nacAwg: 14, nacV: 0 }, { edition: 'CA-2019' });
    ok('A120 CA-2019: not evaluated. The finding and the row say on hold (CAN/ULC-S524 and CEC Section 32 are not held), with no pass or fail line, even for a circuit that fails in the US', ca.c.hold === true && ca.f.sev === 'info' && ca.f.text === 'Panel #' + ca.pn.id + ' NAC (Class B, end-line-loaded): NAC voltage drop is on hold on a Canadian build: CAN/ULC-S524 and CEC Section 32 are not held. CA-2019 is the NFPA 72-2019 label only.' && !/FAIL|Passes|THIN/.test(ca.f.text) &&
      ca.rv().length === 1 && ca.rv()[0].sev === 'info' && /nc\(\)\.hold\) B\.add\('<p id="nacHold">' \+ esc\(DI\.NAC_CA_HOLD\)/.test(inspSrc8), ca.f.text);
    const n23 = nac8({ nacN: 14, nacCd: 75, nacFt: 600, nacAwg: 14, nacV: 0 }), n26 = nac8({ nacN: 14, nacCd: 75, nacFt: 600, nacAwg: 14, nacV: 0 }, { nec: '2026' }), p26 = nac8(o, { nec: '2026' });
    ok('A120 NEC 2026: the text reads "2023 Table 8 ohms: ASSUMED / VERIFY" and never gives 2026 as the source of the number; the numbers and the severity equal the 2023 result; an absent key reads 2023', DI.nec(n23.W) === '2023' && !('nec' in n23.W.cfg) && DI.nec(n26.W) === '2026' && DI.nec({ cfg: { nec: 'x' } }) === '2023' && n26.f.sev === n23.f.sev && n26.c.vEol === n23.c.vEol && p26.f.sev === e25.f.sev && n23.f.text.endsWith('Wire: NFPA 70-2023 Ch. 9 Table 8, 75 C, uncoated stranded copper [CODE NEC 2023].') &&
      n26.f.text.endsWith('Wire: 2023 Table 8 ohms: ASSUMED / VERIFY (NEC 2026 Table 8 is on hold), never 2026 code.') && !/NEC 2026\]|\[CODE NEC 2026|NFPA 70-2026/.test(n26.f.text + p26.f.text + DI.NAC_WIRE_2026) && !/CODE NEC 2023/.test(n26.f.text), n26.f.text.slice(-90));
    const j = JSON.parse(JSON.stringify(n26.W.toJSON())), W2 = DI.World.fromJSON(j);
    ok('A120 the NEC edition is saved with the world and set only through the Site dialog (2023 stores nothing)', W2.cfg.nec === '2026' && DI.nec(W2) === '2026' && /key === 'nec'\) \{ if \(!DI\.NEC\.includes\(val\)\) return false; if \(val === '2026'\) c\.nec = '2026'; else delete c\.nec; \}/.test(uiSrc8) && DI.NEC.join() === '2023,2026');
    DI.setJuris(new DI.World(4, 4));
  }
  // A121 the NAC check never touches release or standby
  {
    const body = DI.nacCalc.toString() + DI.nacFinding.toString() + DI.nacVerdict.toString() + DI.nacMaxFt.toString(), block = DI.review.toString().split('\n').filter((l) => /nacFinding/.test(l)).join('\n');
    ok('A121 static: the calculation, its finding and the review line mention no release function, no signal list, no standby calculation and no alarm step', !/relState|setSolOut|canRelease|FIRE1|S\.sig|standbyCalc|alarmStep|pLatch|\.sol\b|hvac|epo/i.test(body + block) && /for \(const p of W\.byType\('panel'\)\) \{ const f = DI\.nacFinding\(W, p\); if \(f\) add\(f\.sev, f\.text, f\.ref, p\.x, p\.y\); \}/.test(block) &&
      !/nacOn|nacCalc|nacFinding|NAC_/.test(DI.relState.toString() + DI.standbyCalc.toString() + DI.setSolOut.toString() + DI.ceEval.toString()) && !/nac/i.test(DI.relState.toString() + DI.standbyCalc.toString() + DI.setSolOut.toString()) && !/nacOn|nacCalc|nacFinding/.test(DI.alarmStep.toString() + DI.gasPre.toString() + DI.dactStep.toString()));
    const off = rig(), on = nac8({ nacN: 14, nacCd: 75, nacFt: 600, nacAwg: 14, nacV: 0 }), sb = (r) => JSON.stringify(DI.standbyCalc(r.W, r.pn)), sigs = (r) => [...r.S.sig.keys()].sort().join();
    run(off.S, 30, 1); run(on.S, 30, 1);
    const trip = (mut) => { const q = rig(); if (mut) mut(q); breakHead(q); smoke(q.S, 0.2, 10); const rs = DI.relState(q.W, q.v); return JSON.stringify([rs.D, rs.P, rs.open, rs.sol, q.v.p.solOut, q.s.tripT > 0, q.v.p.tripped]); };
    ok('A121 run-time: with the check on and failing, the standby calculation, the battery hours, the signals and the release are identical to the same rig with it off', on.f.sev === 'fail' && sb(on) === sb(off) && DI.panelH(on.W, on.pn) === DI.panelH(off.W, off.pn) && sigs(on) === sigs(off) && trip() === trip((q) => { Object.assign(q.pn.p, { nacOn: 1, nacN: 14, nacFt: 600 }); }) && trip() === '[true,true,true,true,true,true,true]');
    ok('A121 the truth-table runner is 17 of 17 and the fixture is the pinned file', resTT.length === 17 && resTT.every((q) => q.ok) && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && TT.FIXTURE_SHA16 === 'cb3462b268359c6e');
  }
  // A122 the refill report lines: the code check on top, the measured time under it, each with its own label
  {
    const L = c5run.dr.lines, iC = L.findIndex((l) => /^. Code check: /.test(l)), iM = L.findIndex((l) => /^. Air refill this drill, measured: /.test(l)), iN = L.findIndex((l) => /^. Note: 3 zones share this compressor\./.test(l));
    ok('A122 c5 reference drill: the order is code check, measured, then the shared note; the code check reads 19.1 min against 30 with the 2025 cite, the measured line 12.2 min, informational', iC >= 0 && iM === iC + 1 && iN === iM + 1 && L[iC] === '★ Code check: largest zone alone, from 0 psig: 19.1 min. Limit 30 min (NFPA 13). Passes. [NFPA 13-2025 §8.2.7.3]' &&
      /^• Air refill this drill, measured: 12\.[0-9] min \(zones refilled at the same time, from partly full\)\. Informational\.$/.test(L[iM]) && L[iN] === '• Note: 3 zones share this compressor. It is sized for the largest zone, not for all zones at once. [NFPA 13-2025 §8.2.7.3]' && Math.abs(c5run.ds.refill / 60 - parseFloat(L[iM].match(/measured: ([\d.]+)/)[1])) < 0.06, L.slice(iC, iN + 1).join(' | '));
    const Q = DI.buildScenario(c5), qs = DI.botBuild(Q.S, 'c5'); Q.S.warp(qs.settle); const ids = [...Q.S.sysd.info.keys()], zid = ids[0], az = DI.airSizing(Q.S, zid), cc = () => DI.codeCheckLine(Q.S, zid), comp = Q.W.byType('comp')[0], scfm0 = comp.p.scfm;
    Q.W.cfg.edition = 'US-2019'; const c19 = cc(); Q.W.cfg.edition = 'US-2022'; const c22 = cc(); delete Q.W.cfg.edition; const c25 = cc(); comp.p.scfm = 3.8; const below = DI.airSizing(Q.S, zid), cFail = cc(); comp.p.scfm = scfm0;
    ok('A122 X is DI.airSizing(...).tAlone; the cite follows the edition (2019 and 2022 §8.2.6.3.2; 2025 §8.2.7.3); a compressor that is too small reads Fails, with the sizing instruction', c25 === 'Code check: largest zone alone, from 0 psig: ' + az.tAlone.toFixed(1) + ' min. Limit 30 min (NFPA 13). Passes. [NFPA 13-2025 §8.2.7.3]' && Math.abs(az.tAlone - 19.1) < 0.1 && c19.endsWith('Passes. [NFPA 13-2019 §8.2.6.3.2]') && c22.endsWith('Passes. [NFPA 13-2022 §8.2.6.3.2]') &&
      below.below === true && cFail === 'Code check: largest zone alone, from 0 psig: ' + below.tAlone.toFixed(1) + ' min. Limit 30 min (NFPA 13). Fails: the compressor is too small for this zone. Size it to refill the largest zone to normal pressure in 30 min. [NFPA 13-2025 §8.2.7.3]' && !/FAIL/.test(cFail), cFail);
    const solo = rig(), m = (S, id, sec) => DI.measuredLine(S, id, sec); Q.W.cfg.refillSeq = true; const mSeq = m(Q.S, zid, 2400); delete Q.W.cfg.refillSeq; solo.W.cfg.refillSeq = true; const soloSeq = m(solo.S, solo.v.id, 600); delete solo.W.cfg.refillSeq;
    const all = [m(Q.S, zid, 732), m(Q.S, zid, 1750), m(Q.S, zid, 2700), mSeq, m(solo.S, solo.v.id, 732), m(solo.S, solo.v.id, 2700), soloSeq];
    ok('A122 the measured line says how the zones refilled (at the same time; one at a time, largest first; a compressor of its own: from partly full) and never contains "limit", "OK" or "over" at any length', all[0] === 'Air refill this drill, measured: 12.2 min (zones refilled at the same time, from partly full). Informational.' && all[2] === 'Air refill this drill, measured: 45.0 min (zones refilled at the same time, from partly full). Informational.' &&
      mSeq === 'Air refill this drill, measured: 40.0 min (zones refilled one at a time, largest first, from partly full). Informational.' && all[4] === 'Air refill this drill, measured: 12.2 min (from partly full). Informational.' && soloSeq === 'Air refill this drill, measured: 10.0 min (from partly full). Informational.' && all.every((t) => !/limit|\bOK\b|over|FAIL|Pass/i.test(t)) && !/limit|REFILL_LIMIT|refillLimit|\.below|tAlone/.test(DI.measuredLine.toString()));
    // a drill whose code check fails: the line's flag is false (a bullet, never a star), and it still cannot fail the drill
    const part = rig({ gate: true, scfm: 0.5 }); part.S.drill = { t0: part.S.t, done: false }; DI.breakSprinkler(part.S, part.head); run(part.S, 60, 0.25); const pl = DI.drillRecovery(part.S, 'x'), pc = pl.find((q) => /^Code check: /.test(q[1])), okc = DI.drillRecovery(recover(60).S, 'x').find((q) => /^Code check: /.test(q[1]));
    ok('A122 the flag of the code-check line is false when the check fails and true when it passes; both are informational lines, and an unfinished recovery has the code check but no measured line', !!pc && pc[0] === false && pc[2] === true && / Fails: the compressor is too small/.test(pc[1]) && !!okc && okc[0] === true && okc[2] === true && !pl.some((q) => /^Air refill this drill/.test(q[1])) && DI.lossJudge(1e9, () => pl)(part.S).pass === true);
    DI.setJuris(new DI.World(4, 4));
    c7.c8 = { Q, zid, ids };
  }
  // A123 the shared note, the sequence sentence and the inspector rows
  {
    const { Q, zid } = c7.c8, solo = rig(), note = DI.sharedLine(Q.S, zid);
    ok('A123 the shared line is the Tutor’s for three zones, with the cite, and empty on a compressor of its own', note === 'Note: 3 zones share this compressor. It is sized for the largest zone, not for all zones at once. [NFPA 13-2025 §8.2.7.3]' && DI.sharedLine(solo.S, solo.v.id) === '' && DI.airSizing(Q.S, zid).shared === 2);
    Q.W.cfg.refillSeq = true; const az = DI.airSizing(Q.S, zid), s1 = DI.seqLine(Q.S, zid, 2700), s0 = DI.seqLine(Q.S, zid, 1700); delete Q.W.cfg.refillSeq; const sOff = DI.seqLine(Q.S, zid, 2700);
    ok('A123 the sequential sentence after the measured line is the FP Lead’s, word for word, only with sequential refill on, the total over the limit and the code check passing', s1 === 'PASS: each zone restores in 30 min or less when filled alone (largest ' + az.tAlone.toFixed(1) + ' min). The sequential campus refill total of 45.0 min is informational and not a code limit.' && s0 === '' && sOff === '');
    const r = rig(), id = r.v.id, row = (sec, first) => { if (first) r.s.fill1 = sec; else r.s.fillTime = sec; return DI.refillText(r.S, id, first); }, rows = [row(720), row(1740), row(2700), row(720, true), row(1740, true), row(2700, true)];
    r.S.warp(3000); r.s.rfill = true; r.s.fillT0 = r.S.t - 2700; const running = DI.refillText(r.S, id), st = DI.refillState(r.S, id); r.s.rfill = false;
    ok('A123 the inspector rows read "<m> min (measured, informational)" with a neutral class at 12, 29 and 45 min alike, first fill and last refill; a running clock adds "so far"; no amber, no OK', rows.map((q) => q[0]).join('|') === '12.0 min (measured, informational)|29.0 min (measured, informational)|45.0 min (measured, informational)|12.0 min (measured, informational)|29.0 min (measured, informational)|45.0 min (measured, informational)' &&
      rows.every((q) => q[1] === '') && running[0] === '45.0 min so far (measured, informational)' && running[1] === '' && st.running === true && st.over === true);
    ok('A123 DI.refillState(...).over still computes, and no UI file reads it; the sizing row says it is the code check', DI.refillState(r.S, id).over === true && (r.s.fillTime = 600, DI.refillState(r.S, id).over === false) && !/\.over\b/.test(inspSrc8 + uiSrc8 + SRC8('render.js') + SRC8('main.js')) && /'The code check; the measured clocks above are informational\./.test(inspSrc8) && /Informational: a measured time, never compared with the limit\./.test(inspSrc8));
  }
  // A124 a refused Finish counts once per unchanged blocker set
  {
    const r = retRig(), id = r.v.id, s = r.s, q = r.v.p, n = () => s.rtErr.length, press = () => DI.returnFinish(r.S, id), early = () => r.S.acts.filter((a) => a.kind === 'return-early');
    DI.bleedToNormal(r.S, id); r.S.step(0.25); const ready0 = DI.returnGate(r.S, id).ok === true && n() === 0 && DI.rtPresses(s) === 0 && s.rtLast === null;
    // (i) the same single blocker three times: three refusals, one error
    q.drain = 1; const t1 = press(), t2 = press(), t3 = press(), i1 = n(), p1 = s.rtPress;
    ok('A124 (i) three presses with the same single blocker (a drain open): three refusals with the same text, one error, three presses counted', ready0 && t1 === 'Finish was pressed before the zone was ready: a drain is open' + DI.RT_EARLY[1] && t2 === t1 && t3 === t1 && i1 === 1 && p1 === 3 && s.ret === true && early().length === 3 && early().map((a) => a.n + ':' + a.newErr).join() === '1:true,2:false,3:false' && s.rtLast.join() === 'a drain is open', t3);
    // (ii) the drain cleared, P latched: a blocker that was not in the last set
    q.drain = 0; q.pLatch = true; const t4 = press(), i2 = n();
    // (iii) two blockers refused, one cleared, pressed again: the set only shrank
    q.avcBy = 1; press(); const i3 = n(), set3 = s.rtLast.join('|'); q.avcBy = 0; press(); const i3b = n(), set3b = s.rtLast.join('|');
    // (iv) the cleared blocker comes back: it was not in the last refused set
    q.avcBy = 1; press(); const i4 = n();
    ok('A124 (ii) to (iv): a new blocker is a second error; a second blocker added is a third; a press after one of two was cleared adds none (the set shrank); the cleared one coming back adds one', /: P is still latched\. Close every drain\./.test(t4) && i2 === 2 && i3 === 3 && set3 === 'P is still latched|the AVC bypass is open' && i3b === 3 && set3b === 'P is still latched' && i4 === 4 && s.rtPress === 7 && s.rtErr.every((e) => e.why === 'finish-early'), [i1, i2, i3, i3b, i4].join());
    // save and load in the middle of the step
    const mid = reload7(r), midOk = mid.s.rtPress === 7 && JSON.stringify(mid.s.rtLast) === JSON.stringify(s.rtLast) && mid.s.rtErr.length === 4 && mid.s.ret === true;
    const oldS = reload7(r, (jw, js) => { for (const z of js.ss) { delete z[1].rtPress; delete z[1].rtLast; } }), oldOk = DI.rtPresses(oldS.s) === 0 && !Array.isArray(oldS.s.rtLast) && oldS.s.rtErr.length === 4 && (DI.returnFinish(oldS.S, id) !== '' && oldS.s.rtErr.length === 5 && oldS.s.rtPress === 1);
    ok('A124 save and load in the middle of the step keep the press count and the last blocker set; a save from before Cycle 8 reads 0 presses and no last set, and its next refusal counts', midOk && oldOk && DI.SS_KEYS.includes('rtPress') && DI.SS_KEYS.includes('rtLast'));
    // (v) the gate comes true, then a blocker is back: the last set was forgotten when the zone was ready
    q.pLatch = false; q.avcBy = 0; r.S.step(0.25); const cleared = DI.returnGate(r.S, id).ok === true && s.rtLast === null && s.rtPress === 7; q.avcBy = 1; press(); const i5 = n(); q.avcBy = 0;
    r.S.drill = { t0: 0, done: false }; const pend = DI.drillReturnLines(r.S).map((x) => x[1]);
    // (vi) Finish accepted
    const fin = press(), act = r.S.acts.filter((a) => a.kind === 'return-normal').pop(), res = DI.lastResult(r.S, 'return', id), rep = DI.drillReturnLines(r.S), nm = DI.sysName(r.S, id);
    ok('A124 (v) with the gate true in between, a blocker that returns is a new error even though it was in an earlier refusal; (vi) Finish accepted ends the step, the entry carries the presses, and the counters are reset', cleared && i5 === 5 && fin === '' && s.ret === false && act.presses === 8 && act.errs.length === 5 && act.err === 5 && s.rtPress === 0 && s.rtLast === null && s.rtErr.length === 0, 'errors ' + i5 + ', presses ' + act.presses);
    ok('A124 the report lists the errors, one per new blocker set, and the raw presses on their own informational line; the pending step shows them too', res.lines.length === 6 && res.lines[5] === 'Finish was pressed 8 time(s) before the zone was ready; counted as 5 error(s), one for each new set of blockers (informational).' && res.pass === false && rep.some((x) => x[1] === 'Return to normal, ' + nm + ': 5 error(s)' && x[0] === false) &&
      rep.some((x) => x[1] === 'Return to normal, ' + nm + ': ' + DI.rtPressLine(8, 5) && x[0] === false && x[2] === true) && pend.includes('Return to normal, ' + nm + ': not finished, 5 error(s) so far (Finish pressed 8 times)') && pend.includes('Return to normal, ' + nm + ': ' + DI.rtPressLine(8, 5)) && DI.rtTimes(1) === '1 time' &&
      /' \(Finish pressed ' \+ DI\.rtTimes\(pr\) \+ '\)'/.test(inspSrc8), res.lines[5]);
    // a clean return has no presses line; the other error kinds are as they were (one low-pressure episode is one entry)
    const c = retRig(); DI.bleedToNormal(c.S, c.v.id); c.S.step(0.25); const cf = DI.returnFinish(c.S, c.v.id), cr = DI.lastResult(c.S, 'return', c.v.id);
    const lo = retRig(); lo.v.p.sdrain = 1; lo.S.touch(); let k = 0; while (!lo.s.lowAir && k++ < 4000) lo.S.step(0.02); lo.v.p.sdrain = 0; lo.S.touch(); lo.S.step(0.02); const loN = lo.s.rtErr.length, loWhy = lo.s.rtErr[0].why; DI.returnFinish(lo.S, lo.v.id); DI.returnFinish(lo.S, lo.v.id);
    ok('A124 a clean return has no presses line and reads the clean pass; a low-air episode is still one entry of its own, and refused presses after it add one finish-early error, not two', cf === '' && cr.pass === true && cr.lines.join() === DI.RT_CLEAN && c.S.acts.filter((a) => a.kind === 'return-normal').pop().presses === 0 && loN === 1 && loWhy === 'low-air' && lo.s.rtErr.map((e) => e.why).join() === 'low-air,finish-early' && lo.s.rtPress === 2);
  }
  // A125 compressor relief warnings (FP Lead, PRACTICE): warnings only, and the drift rule is untouched
  {
    const cw = (cp, vp) => { const r = rig(); const c = r.W.byType('comp')[0]; Object.assign(c.p, cp); if (vp) Object.assign(r.v.p, vp); r.W.ver++; r.S.sync(); return { r, c, f: DI.review(r.S).filter((q) => /^Compressor #\d+ relief /.test(q.text)), w: DI.compWarnings(r.S, c).map((x) => x.text) }; };
    const d = cw({}), a = cw({ relief: 60, cutOut: 60 }), b = cw({ relief: 60, cutOut: 75 }), h75 = cw({ relief: 75, cutOut: 0 }, { hiAir: 75 }), h80 = cw({ relief: 75, cutOut: 0 }, { hiAir: 80 }), h50 = cw({ relief: 75, cutOut: 0 });
    ok('A125 the defaults raise nothing; relief 60 with a cut-out of 60 or 75 warns "at or below the cut-out"; relief 75 feeding a zone whose high air is 75 or 80 warns "at or below the zone high air"; relief 75 above a 50 psi high air does not', d.f.length === 0 && d.w.length === 0 &&
      a.f.length === 1 && a.f[0].text === 'Compressor #' + a.c.id + ' relief (60 psi) is at or below the cut-out 60 psi: the relief will lift during normal operation.' && b.f.length === 1 && b.f[0].text === 'Compressor #' + b.c.id + ' relief (60 psi) is at or below the cut-out 75 psi: the relief will lift during normal operation.' &&
      h75.f.length === 1 && h75.f[0].text === 'Compressor #' + h75.c.id + ' relief (75 psi) is at or below the zone high air 75 psi (' + DI.sysName(h75.r.S, h75.r.v.id) + '): the relief will lift during normal operation.' && h80.f.length === 1 && /at or below the zone high air 80 psi/.test(h80.f[0].text) && h50.f.length === 0, a.f[0] && a.f[0].text);
    const m = cw({ relief: 125, maxPsi: 100 }), eq = cw({ relief: 100, maxPsi: 100 }), two = cw({ relief: 60, cutOut: 60, maxPsi: 0 }), both = cw({ relief: 125, maxPsi: 100, cutOut: 0 }, { hiAir: 130, airSet: 40 }), all = [a, b, h75, h80, m, both].flatMap((x) => x.f);
    ok('A125 relief 125 above a rated max discharge of 100 warns; relief 100 at 100 does not; both warnings can apply to one compressor; every one is a warning on the compressor with the PRACTICE / ASSUMED reference, never a fail', m.f.length === 1 && m.f[0].text === 'Compressor #' + m.c.id + ' relief (125 psi) is above its rated max discharge (100 psi).' && eq.f.length === 0 && two.f.length === 1 &&
      both.f.length === 2 && /at or below the zone high air 130 psi/.test(both.f[0].text) && /above its rated max discharge \(100 psi\)/.test(both.f[1].text) && all.every((q) => q.sev === 'warn' && q.ref === 'Company practice (ASSUMED picks; PRACTICE check)') && m.f[0].x === m.c.x && m.f[0].y === m.c.y && !DI.review(m.r.S).some((q) => q.sev === 'fail' && /relief/.test(q.text)), both.f.map((q) => q.text).join(' | '));
    const T = (cp) => { const q = cw(cp); return DI.bypassTarget(q.r.W, q.r.S.sysd.info.get(q.r.v.id)); };
    ok('A125 the drift rule is unchanged for every A101 case (relief 75 with max 100 gives 75; relief 60 with max 125 gives 60; a cut-out rules, also over a lower relief; 60 psi where the compressor is not modeled), and the pick lists are unchanged', T({ relief: 75, maxPsi: 100 }) === 75 && T({ relief: 60, maxPsi: 125 }) === 60 && T({ cutOut: 55, relief: 75, maxPsi: 100 }) === 55 && T({ cutOut: 60, relief: 45 }) === 60 && T({}) === 60 && T({ maxPsi: 175 }) === 175 &&
      DI.COMP_MAXPSI.join() === '0,60,100,125,175' && DI.COMP_RELIEF.join() === '0,60,75,100,125' && DI.COMP_CUTOUT.join() === '0,45,50,55,60' && !/compWarnings|relief <=|relief > c\./.test(DI.compLimit.toString() + DI.bypassTarget.toString() + DI.gasPre.toString()) && !/scfm|\.G\b|\.P =/.test(DI.compWarnings.toString()) && /B\.row\('Relief check'/.test(inspSrc8));
  }
  // A126 the owner / insurer refill target: a warning, never a code failure
  {
    const { Q, zid } = c7.c8, W = Q.W, own = () => DI.review(Q.S).filter((q) => /^Owner\/insurer criterion: /.test(q.text)), rv0 = JSON.stringify(DI.review(Q.S)), az = DI.airSizing(Q.S, zid), gov = az.gov, nm = DI.sysName(Q.S, gov), ms0 = DI.measuredLine(Q.S, zid, 732);
    W.cfg.ownerRefill = 15; const w15 = own(), l15 = DI.ownerLine(Q.S, zid), ms15 = DI.measuredLine(Q.S, zid, 732); W.cfg.ownerRefill = 20; const w20 = own(), l20 = DI.ownerLine(Q.S, zid); W.cfg.ownerRefill = 25; const w25 = own(); W.cfg.ownerRefill = 10; const w10 = own();
    ok('A126 default: no finding and no report line. With the largest zone alone at 19.1 min, a target of 15 or 10 gives one warning tagged Owner/insurer criterion with the numbers and the "warning, not a code failure" sentence; 20 and 25 give none', !/Owner\/insurer/.test(rv0) && DI.ownerRefill(new DI.World(4, 4)) === 0 && w15.length === 1 && w15[0].sev === 'warn' &&
      w15[0].text === 'Owner/insurer criterion: the largest zone alone fills in 19.1 min against the owner/insurer target of 15 min. The code limit of 30 min is met, so this is a warning, not a code failure. (Method ASSUMED: the largest zone alone, from 0 psig.) Zone: ' + nm + '.' && w15[0].ref === 'Owner/insurer criterion (site setting); not a code limit. Code limit: NFPA 13-2025 §8.2.7.3' &&
      w20.length === 0 && w25.length === 0 && w10.length === 1 && /target of 10 min/.test(w10[0].text) && !DI.review(Q.S).some((q) => q.sev === 'fail'), w15[0] && w15[0].text);
    ok('A126 the drill report line reads Met or Not met with the tag; the measured line is unchanged by the target', l15 === 'Owner/insurer target: 15 min. Not met (19.1 min): a warning tagged owner/insurer criterion, not a code limit.' && l20 === 'Owner/insurer target: 20 min. Met.' && ms15 === ms0 && !/owner|target/i.test(ms15) && (delete W.cfg.ownerRefill, DI.ownerLine(Q.S, zid) === ''));
    // a zone whose code check fails: the existing FAIL, and no owner warning beside it
    const comp = W.byType('comp')[0], s0 = comp.p.scfm; W.cfg.ownerRefill = 15; comp.p.scfm = 3.8; const rvF = DI.review(Q.S), fF = rvF.filter((q) => q.sev === 'fail' && /cannot restore normal pressure/.test(q.text)), lF = DI.ownerLine(Q.S, zid); comp.p.scfm = s0; delete W.cfg.ownerRefill;
    ok('A126 over the code limit: the existing code FAIL and no owner warning (no second finding)', fF.length === 1 && !rvF.some((q) => /^Owner\/insurer criterion/.test(q.text)) && /Not met \([\d.]+ min\): the code check fails first\.$/.test(lF) && JSON.stringify(DI.review(Q.S)) === rv0);
    // a refrigerated zone (60 min) with the zone alone at 40 min and a target of 30: the warning; a target at or above the limit: nothing
    const c = rig({ room: 'cold' }); c.W.rooms[0].below5 = true; c.W.ver++; c.S.sync(); const a0 = DI.airSizing(c.S, c.v.id), cc = c.W.byType('comp')[0]; cc.p.scfm = a0.tAlone * a0.have / 40; const a40 = DI.airSizing(c.S, c.v.id);
    const cown = (T) => { c.W.cfg.ownerRefill = T; const o = DI.review(c.S).filter((q) => /^Owner\/insurer criterion: /.test(q.text)); delete c.W.cfg.ownerRefill; return o; }, w30 = cown(30), w60 = cown(60), w75 = cown(75), w45 = cown(45);
    const h = rig(); h.W.byType('comp')[0].p.scfm = DI.airSizing(h.S, h.v.id).tAlone * 5 / 25; h.W.cfg.ownerRefill = 30; const hAz = DI.airSizing(h.S, h.v.id), h30 = DI.review(h.S).filter((q) => /^Owner\/insurer/.test(q.text)); h.W.cfg.ownerRefill = 20; const h20 = DI.review(h.S).filter((q) => /^Owner\/insurer/.test(q.text));
    ok('A126 a refrigerated zone at 40 min alone with a target of 30 gets the warning against its 60 min limit; a target at or above the zone’s limit raises nothing; a stored value outside the picks is read as it is', a40.limit === 60 && Math.abs(a40.tAlone - 40) < 1e-6 && !a40.below && w30.length === 1 && /fills in 40\.0 min against the owner\/insurer target of 30 min\. The code limit of 60 min is met/.test(w30[0].text) && /Code limit: NFPA 13-2025 §8\.2\.7\.4$/.test(w30[0].ref) && w60.length === 0 && w75.length === 0 && w45.length === 0 &&
      Math.abs(hAz.tAlone - 25) < 1e-6 && h30.length === 0 && h20.length === 1 && DI.OWNER_REFILL.join() === '0,10,15,20,25' && DI.ownerRefill({ cfg: { ownerRefill: 30 } }) === 30 && DI.ownerRefill({ cfg: { ownerRefill: -5 } }) === 0 && DI.ownerRefill({ cfg: { ownerRefill: 'x' } }) === 0, w30[0] && w30[0].text);
    const jw = JSON.parse(JSON.stringify(h.W.toJSON())); const W2 = DI.World.fromJSON(jw); delete jw.cfg.ownerRefill; const W3 = DI.World.fromJSON(jw);
    ok('A126 the target is saved with the world, set only through the Site dialog, and an old save has none; no goal, no drill result and no measured clock reads it', W2.cfg.ownerRefill === 20 && DI.ownerRefill(W3) === 0 && /key === 'own'\) \{ if \(!DI\.OWNER_REFILL\.includes\(\+val\)\) return false; if \(\+val > 0\) c\.ownerRefill = \+val; else delete c\.ownerRefill; \}/.test(uiSrc8) &&
      !/ownerRefill/.test(DI.SCEN.map((sc) => sc.goals.map((g) => g.ok.toString()).join('') + (sc.drill ? sc.drill.judge.toString() : '')).join('') + DI.measuredLine.toString() + DI.refillState.toString() + DI.refillText.toString() + DI.airSizing.toString()));
    DI.setJuris(new DI.World(4, 4));
  }
  // A127 the Tutor's error sentences
  {
    const EARLY = 'Finish was pressed before the zone was ready: a drain is open; P is still latched. Close every drain. Bring air into the normal band, above low air and above the P set point. Reset the panel to clear the pressure-loss (P) latch. Clear any supervisory signal (low air, high air, AVC bypass, valve off normal). Then press Finish.';
    const MD = 'You opened the main drain with the control valve open. That flows supply water. It’s a main drain test, not a way to let out system air, because the main drain is below the DI valve. Close it and use the trim air bleed.';
    const LOWD = 'You let air out through a drain, and pressure fell below low air. That sets off the low-air supervisory signal, and if pressure keeps falling it reaches the P set point. To lower pressure, use the trim air bleed in small steps; drains let air out too fast.';
    const LOWN = 'Pressure fell below low air, so the low-air supervisory came in and the zone could not hold its air. If pressure keeps falling it reaches the P set point.', ISO = ' If the air supply is isolated, restore it first.';
    ok('A127 DI.rtLine returns the Tutor’s sentences word for word: Finish too early with the list, and the main drain flow', DI.rtLine({ why: 'finish-early', miss: ['a drain is open', 'P is still latched'] }) === EARLY && DI.rtLine({ why: 'main-drain-flow' }) === MD && DI.RT_TEXT['main-drain-flow'] === MD && DI.RT_EARLY[0] === 'Finish was pressed before the zone was ready: ');
    ok('A127 low air: with a system drain open the Tutor’s sentence, with no drain open the plan’s (ASSUMED wording), each followed by the isolated-supply sentence when the supply was off at the event', DI.rtLine({ why: 'low-air', drain: true }) === LOWD && DI.rtLine({ why: 'low-air', drain: false }) === LOWN && DI.rtLine({ why: 'low-air', drain: true, iso: true }) === LOWD + ISO && DI.rtLine({ why: 'low-air', drain: false, iso: true }) === LOWN + ISO &&
      DI.rtLine({ why: 'low-air' }) === LOWD && DI.RT_LOW_DRAIN === LOWD && DI.RT_LOW_NODRAIN === LOWN && DI.RT_ISO === ISO && !('low-air' in DI.RT_TEXT));
    ok('A127 the P-latched and water-flow sentences and the clean pass are unchanged', DI.rtLine({ why: 'p-latch' }) === 'Pressure fell to the trip point, so the panel latched the pressure-loss input. With detection also active, both release conditions were met and the valve would release. Restore air above low air before panel reset #2.' &&
      DI.rtLine({ why: 'water-flow' }) === 'Water flow was detected. That sends a fire alarm signal. Keep the control valve closed until the head is replaced and the system is reset.' && DI.RT_CLEAN === 'Clean return to normal. Air held above low air, both panel resets were done in order, drains were closed, the control valve is fully open, and supervision is back to normal.');
    // run-time: what was open at the crossing is recorded on the entry
    const bleed = (r) => { r.v.p.sdrain = 1; r.S.touch(); let k = 0; while (!r.s.lowAir && k++ < 4000) r.S.step(0.02); r.v.p.sdrain = 0; r.S.touch(); r.S.step(0.02); return r.s.rtErr[0]; };
    const a = retRig(), ea = bleed(a), b = retRig(); b.v.p.airValve = 0; const eb = bleed(b);
    const c = retRig(); DI.bleedToNormal(c.S, c.v.id); c.S.step(0.25); c.v.p.airValve = 0; c.s.holes = 400; c.S.touch(); let k = 0; while (!(c.s.rtErr || []).length && k++ < 20000) c.S.step(0.25); const ec = (c.s.rtErr || [])[0];
    ok('A127 run-time: a system drain to low air records drain:true (isolated supply: iso:true too); a zone that leaks down with no drain open and the supply isolated records drain:false, iso:true; each reads its own sentence', !!ea && ea.why === 'low-air' && ea.drain === true && ea.iso === false && DI.rtLine(ea) === LOWD && !!eb && eb.drain === true && eb.iso === true && DI.rtLine(eb) === LOWD + ISO &&
      !!ec && ec.why === 'low-air' && ec.drain === false && ec.iso === true && DI.rtLine(ec) === LOWN + ISO, ec && DI.rtLine(ec));
    const TAGS = /p-latch|finish-early|main-drain-flow|drain-open|water-flow|low-air(?! supervisory)/, texts = Object.values(DI.RT_TEXT).concat(DI.RT_EARLY, Object.values(DI.RT_NAME), [EARLY, MD, LOWD, LOWN, ISO, DI.RT_CLEAN, DI.RT_READY, DI.RT_COACH, DI.RISER_NOTE, DI.rtPressLine(2, 1)]);
    a.S.drill = { t0: 0, done: false }; DI.returnFinish(a.S, a.v.id); const shown = DI.drillReturnLines(a.S).map((x) => x[1]).concat(a.S.results.filter((x) => x.kind === 'return').map((x) => x.lines.join(' ')), a.S.log.map((l) => l.text));
    ok('A127 no internal tag in any player-facing string: the constants, a drill report, the result and the log', texts.every((t) => !TAGS.test(t)) && shown.every((t) => !TAGS.test(t)) && shown.some((t) => t.endsWith(LOWD)), texts.concat(shown).filter((t) => TAGS.test(t)).slice(0, 2).join(' || ') || undefined);
  }
  // A128 gallons and the realism line
  {
    const g5 = DI.galLines({ gallons: 277 + 5, mdGal: 156, otGal: 5 }), g0 = DI.galLines({ gallons: 277, mdGal: 156, otGal: 0 });
    ok('A128 the other-drains line is the Tutor’s when 5 gal came through them and absent at 0; the head and main drain lines are unchanged and never summed', g5.join('|') === 'Discharged through the open head: 121 gal|Main drain test: 156 gal (to drain, not to the floor)|Other drains and test connections (system drain, inspector’s test): 5 gal, to drain, not to the floor.' && g0.join('|') === 'Discharged through the open head: 121 gal|Main drain test: 156 gal (to drain, not to the floor)' &&
      !g5.some((t) => /282|277|total/i.test(t)) && c5run.dr.lines.includes('• Other drains and test connections (system drain, inspector’s test): 5 gal, to drain, not to the floor.'));
    const TIP = 'In a real building, getting to the riser takes minutes. Know where each zone’s control valve is before an event.', NOTE = 'Your time assumes you were standing at the riser.', L = c5run.dr.lines, iT = L.indexOf('• ' + TIP);
    const slow = recover(60), sl = DI.drillRecovery(slow.S, 'x').map((q) => q[1]), ws = drillScore(slow).waterStopped;
    ok('A128 the realism tip is in the c5 reference drill report and in a slow drill; the standing-at-the-riser line is directly under it when water was stopped in under 30 s (the reference drill: a few seconds) and absent in the slow drill', DI.RECOVERY_TIP === TIP && DI.RISER_NOTE === NOTE && DI.RISER_NOTE_S === 30 && iT >= 0 && L[iT + 1] === '• ' + NOTE && c5run.ds.waterStopped < 30 && sl.includes(TIP) && !sl.includes(NOTE) && ws >= 30, 'reference ' + Math.round(c5run.ds.waterStopped) + ' s, slow ' + Math.round(ws) + ' s');
    const rs = DI.recoveryScore, at = (v) => { DI.recoveryScore = (...a) => { const o = rs(...a); if (o) o.waterStopped = v; return o; }; try { return DI.drillRecovery(slow.S, 'x').map((q) => q[1]); } finally { DI.recoveryScore = rs; } };
    ok('A128 the line appears under 30 s only: at 29.9 s yes, at exactly 30 s no, and not when the control valve was never closed', at(29.9).includes(NOTE) && !at(30).includes(NOTE) && !at(45).includes(NOTE) && !at(null).includes(NOTE) && at(null).includes(TIP) && DI.recoveryScore === rs && DI.drillRecovery(slow.S, 'x').find((q) => q[1] === TIP)[2] === true);
  }
  // A129 telecom as a room type; NFPA 76 and the VEA Fire 1 by room
  const tw8 = (cfg, o = {}) => { const w = new DI.World(24, 8); Object.assign(w.cfg, cfg || {}); const h = w.addRoom('hall', 1, 1, 4, 4), t = w.addRoom('tel', 7, 1, 4, 4, 'MMR 1'); if (o.n76 !== undefined) t.n76 = o.n76; const dh = w.addPart(o.det || 'vesda', 2, 2, 0), dt = w.addPart(o.det || 'vesda', 8, 2, 0); return { w, h, t, dh, dt }; };
  {
    const T = DI.ROOMS.tel, E = DI.ROOMS.elec;
    ok('A129 the room type Telecom / MMR (NFPA 76 space) exists: the electrical room row without spotRelease', T.name === 'Telecom / MMR (NFPA 76 space)' && T.haz === E.haz && T.val === E.val && T.wetDmg === E.wetDmg && T.smokeDmg === E.smokeDmg && T.cond === true && T.ceil === E.ceil && !('spotRelease' in T) && E.spotRelease === true && DI.canRelease(tw8({}, { det: 'smoke' }).w, tw8({}, { det: 'smoke' }).dt) === false);
    const off = tw8({}), on = tw8({ nfpa76Adopted: true }), yes = tw8({}, { n76: true }), no = tw8({ nfpa76Adopted: true }, { n76: false }), cold = new DI.World(8, 8), cr = cold.addRoom('cold', 1, 1, 3, 3); cr.n76 = true; cold.cfg.nfpa76Adopted = true;
    ok('A129 DI.n76Applies: a hall never; a telecom room follows the site flag when n76 is absent, and n76 true / false overrides it; no other room type can be an NFPA 76 space', !DI.n76Applies(off.w, off.h) && !DI.n76Applies(on.w, on.h) && !DI.n76Applies(off.w, off.t) && DI.n76Applies(on.w, on.t) && DI.n76Applies(yes.w, yes.t) && !DI.n76Applies(no.w, no.t) && !DI.n76Applies(cold, cr) && !DI.n76Applies(on.w, null) &&
      (on.h.n76 = true, !DI.n76Applies(on.w, on.h)) && (delete on.h.n76, true) && !('n76' in off.t) && !('f1' in off.t));
    const vea = (cfg, o) => tw8(Object.assign({ asdModel: 'VEA' }, cfg), o), a = vea({ nfpa76Adopted: true }), b = vea({}), s = vea({ nfpa76Adopted: true, detThr: [0.03, 0.06, 2.5, 1.2] }), f = vea({ nfpa76Adopted: true, detThr: [0.03, 0.06, 2.5, 1.2] }); f.t.f1 = 1.23; f.h.f1 = 0.5;
    ok('A129 the VEA Fire 1 default is 0.5 in a telecom room where NFPA 76 applies and 1.23 in a hall, whatever the site flag: on one VEA site the hall and the telecom room read different numbers; a site pick wins over the default, and a room pick over both', DI.veaFire1At(a.w, a.t) === 0.5 && DI.veaFire1At(a.w, a.h) === 1.23 && DI.veaFire1At(b.w, b.t) === 1.23 && DI.veaFire1At(b.w, b.h) === 1.23 &&
      DI.asdThr(a.w, a.t).join() === 'Infinity,Infinity,0.5,Infinity' && DI.asdThr(a.w, a.h).join() === 'Infinity,Infinity,1.23,Infinity' && DI.veaFire1At(s.w, s.t) === 2.5 && DI.veaFire1At(s.w, s.h) === 2.5 && DI.veaFire1At(f.w, f.t) === 1.23 && DI.veaFire1At(f.w, f.h) === 0.5 && DI.veaFire1(a.w) === 1.23 && DI.VEA_TEL === 0.5 &&
      DI.veaFire1Src(a.w, a.t) === 'default in an NFPA 76 telecom room' && DI.veaFire1Src(a.w, a.h) === 'default' && DI.veaFire1Src(s.w, s.t) === 'site pick' && DI.veaFire1Src(f.w, f.t) === 'room pick');
    // the detectors really read those numbers: smoke at 0.8 %/ft in both rooms latches Fire 1 in the telecom room (0.5) and not in the hall (1.23)
    const S = new DI.Sim(a.w); S.commission(); for (let t = 0; t < 5; t += 0.25) { S.smoke[a.h.id] = 0.8; S.smoke[a.t.id] = 0.8; S.step(0.25); } const lv08 = [a.dh.p.lvl, a.dt.p.lvl]; for (let t = 0; t < 5; t += 0.25) { S.smoke[a.h.id] = 1.3; S.smoke[a.t.id] = 1.3; S.step(0.25); }
    ok('A129 in the sim the two VEA detectors latch at their own room’s Fire 1: at 0.8 %/ft only the telecom detector is at Fire 1, at 1.3 %/ft both are', lv08.join() === '0,3' && a.dh.p.lvl === 3 && a.dt.p.lvl === 3 && a.dt.p.rel === true && S.sig.has('v' + a.dt.id + '.3') && S.sig.has('v' + a.dh.id + '.3'), lv08.join());
    const vep = tw8({ nfpa76Adopted: true }), veu = tw8({ nfpa76Adopted: true, asdModel: 'VEU' }); vep.t.f1 = 0.5; veu.t.f1 = 0.5; const sp = tw8({ nfpa76Adopted: true, spotThr: 2 }, { det: 'smoke' });
    ok('A129 VEP, VEU and the spot detector read the site thresholds in every room: a room pick and the room type change nothing for them', DI.asdThr(vep.w, vep.t).join() === DI.VESDA_T.join() && DI.asdThr(vep.w, vep.h).join() === DI.VESDA_T.join() && DI.asdThr(veu.w, veu.t).join() === DI.VESDA_T.join() && DI.spotThr(sp.w) === 2 && !/room/.test(DI.spotThr.toString() + DI.detThr.toString()));
    f.t.n76 = false; const j = JSON.parse(JSON.stringify(f.w.toJSON())), W2 = DI.World.fromJSON(j), j2 = JSON.parse(JSON.stringify(b.w.toJSON())), W3 = DI.World.fromJSON(j2);
    ok('A129 the room JSON round-trips n76 and f1 where they are set, and only there; the save carries the format number', W2.rooms[1].type === 'tel' && W2.rooms[1].n76 === false && W2.rooms[1].f1 === 1.23 && W2.rooms[0].f1 === 0.5 && !('n76' in W2.rooms[0]) && W2.rooms[1].name === 'MMR 1' && !('n76' in W3.rooms[1]) && !('f1' in W3.rooms[1]) && W3.rooms[1].type === 'tel' && j.v === 8 && DI.SAVE_V === 8);
    DI.setJuris(new DI.World(4, 4));
  }
  // A130 NFPA 76 by room, the migration, and the lock
  {
    const vea = (f1, o, cfg) => tw8(Object.assign({ asdModel: 'VEA', nfpa76Adopted: true }, f1 ? { detThr: [0.03, 0.06, f1, 1.2] } : {}, cfg), o), codes = (q) => DI.n76Flags(q.w).map((x) => x.code + '@' + x.room).join();
    const a123 = vea(1.23), a25 = vea(2.5), a05 = vea(0.5), def = vea(), offRoom = vea(2.5, { n76: false });
    ok('A130 the flag on: a VEA detector in a telecom room at 1.23 or 2.5 raises N76_ALARM_OVER naming the room, at 0.5 nothing; the same detector in the hall raises nothing; a telecom room with n76 false raises nothing', codes(a123) === 'N76_ALARM_OVER@' + a123.t.id && codes(a25) === 'N76_ALARM_OVER@' + a25.t.id && codes(a05) === '' && codes(def) === '' && codes(offRoom) === '' &&
      DI.n76Flags(a123.w)[0].text === 'NFPA 76 applies in MMR 1: Fire 1, the first alarm stage, must be 1.0 %/ft or less (it is 1.23). The 1.0 %/ft figure is VERIFIED (NFPA 76-2024 §8.5.3.1.2.5); applying it to Fire 1 is PRACTICE, NEEDS PE REVIEW.' && DI.n76Flags(a123.w)[0].sev === 'fail' && DI.n76Rooms(a123.w).map((r) => r.name).join() === 'MMR 1' && DI.n76Flags(a123.w, a123.h).length === 0 && DI.n76Flags(a123.w, a123.t).length === 1);
    const noDet = vea(2.5); noDet.w.removePart(noDet.dt.id); const vp = tw8({ nfpa76Adopted: true, detThr: [0.3, 0.4, 0.5, 1.2] }), vpNo = tw8({ nfpa76Adopted: true, detThr: [0.3, 0.4, 0.5, 1.2] }); vpNo.w.removePart(vpNo.dt.id); const two = vea(2.5); const t2 = two.w.addRoom('tel', 13, 1, 4, 4, 'MMR 2'); two.w.addPart('vesda', 14, 2, 0); t2.f1 = 0.5;
    ok('A130 Alert over 0.2 flags only where an aspirating detector sits in an NFPA 76 room; a telecom room with no aspirating detector is not checked; with two telecom rooms each is judged on its own Fire 1', codes(vp) === 'N76_ALERT_OVER@' + vp.t.id && /^NFPA 76 applies in MMR 1: Alert must be 0\.2 %\/ft or less \(it is 0\.3\)\.$/.test(DI.n76Flags(vp.w)[0].text) && codes(vpNo) === '' && codes(noDet) === '' &&
      DI.n76Check(noDet.w) === 'NFPA 76 check: ' + DI.N76_NO_ROOM + '.' && codes(two) === 'N76_ALARM_OVER@' + two.t.id && DI.n76Check(two.w) === 'NFPA 76 check, MMR 1: Fire 1 2.5 (meets 1.0: no). This model has no Alert stage. NFPA 76 check, MMR 2: Fire 1 0.5 (meets 1.0: yes). This model has no Alert stage.' && /^NFPA 76 rooms: MMR 1, MMR 2\. /.test(DI.n76Note(two.w)), DI.n76Check(two.w));
    ok('A130 the 1.0 %/ft figure still reads VERIFIED and the mapping to Fire 1 PRACTICE; the ceilings only check: nothing writes a threshold or a room', DI.N76_TAG === 'The 1.0 %/ft figure is VERIFIED (NFPA 76-2024 §8.5.3.1.2.5); applying it to Fire 1 is PRACTICE, NEEDS PE REVIEW.' && JSON.stringify(DI.PRESETS.nfpa76) === '{"alert":0.2,"alarm":1}' && !/cfg\.detThr\s*=|\.f1\s*=|\.n76\s*=|W\.ver/.test(DI.n76Flags.toString() + DI.n76Check.toString() + DI.n76Note.toString() + DI.n76Rooms.toString()));
    // migration: a save from before Cycle 8 (no format number) with the site flag on
    const old = (cfg, edit) => { const r = rig(); Object.assign(r.W.cfg, cfg); run(r.S, 3, 1); const jw = JSON.parse(JSON.stringify(r.W.toJSON())), js = JSON.parse(JSON.stringify(r.S.dump())); delete jw.v; if (edit) edit(jw); const W = DI.World.fromJSON(jw), notes = (W.notes || []).slice(), S = new DI.Sim(W); S.restore(js); return { W, S, notes, r }; };
    const NOTE = 'NFPA 76 now applies by room. This save has no telecom room, so no room is checked until you set one (room type Telecom / MMR, or NFPA 76 applies here).';
    const m1 = old({ nfpa76Adopted: true, asdModel: 'VEA' }), m2 = old({ nfpa76Adopted: true, asdModel: 'VEA', detThr: [0.03, 0.06, 2.5, 1.2] }), m3 = old({ nfpa76Adopted: true }), m4 = old({ asdModel: 'VEA' }), m5 = old({});
    ok('A130 migration: the flag on, VEA and no stored pick loads with detThr[2] === 0.5 (the halls keep the sensitivity they had) and the load note, said once in the log; a stored pick is kept as it is', DI.N76_MIGRATED === NOTE && m1.W.cfg.detThr.join() === '0.03,0.06,0.5,1.2' && DI.veaFire1At(m1.W, m1.W.rooms[0]) === 0.5 && m1.notes[0] === NOTE && m1.notes[1] === DI.N76_PICK_KEPT && m1.notes.length === 2 &&
      m1.S.log.filter((l) => l.text === NOTE).length === 1 && m1.S.loadNotes[0] === NOTE && !m1.W.notes && m2.W.cfg.detThr[2] === 2.5 && m2.notes.join() === NOTE, m1.notes.join(' | '));
    ok('A130 migration: the flag on with VEP writes no threshold and says the one note; the flag off writes nothing and says nothing, VEA or not; a Cycle 8 save is not migrated again', !('detThr' in m3.W.cfg) && m3.notes.join() === NOTE && !('detThr' in m4.W.cfg) && m4.notes.length === 0 && DI.veaFire1At(m4.W, m4.W.rooms[0]) === 1.23 && m5.notes.length === 0 && JSON.stringify(m5.W.cfg) === JSON.stringify(m5.r.W.cfg) &&
      (() => { const r = rig(); Object.assign(r.W.cfg, { nfpa76Adopted: true, asdModel: 'VEA' }); const W = DI.World.fromJSON(JSON.parse(JSON.stringify(r.W.toJSON()))); return !W.notes && !('detThr' in W.cfg) && DI.veaFire1At(W, W.rooms[0]) === 1.23; })() && DI.n76Flags(m1.W).length === 0 && /^NFPA 76 is set as the default for telecom rooms on this site, and there is no NFPA 76 room/.test(DI.n76Note(m1.W)));
    // the lock: the release function, the D block and the Fire 1 line are what they were in Cycle 7
    const head = SRC8('alarm.js').split('\n').slice(0, 30).join('\n'), as = DI.alarmStep.toString();
    ok('A130 LOCK: DI.relState, DI.canRelease, the D block at the top of alarm.js and DI.FIRE1 are hash-equal to Cycle 7; p.p.rel = p.p.lvl >= DI.FIRE1 is still the line; the detection loop reads DI.asdThr(W, room) for VEA only', sha16(DI.relState.toString()) === 'a19f3e39ec09d52e' && sha16(head) === '1581435a5c3a9485' && DI.FIRE1 === 3 &&
      sha16(DI.canRelease.toString()) === sha16('function (W, d) {\n  if (d.type === \'vesda\') return true;\n  const room = d.type === \'smoke\' ? W.room(d.x, d.y) : null;\n  return !!(room && DI.ROOMS[room.type].spotRelease);\n}') && (as.match(/p\.p\.rel = p\.p\.lvl >= DI\.FIRE1;/g) || []).length === 1 &&
      /T = p\.type === 'vesda' \? \(vea \? DI\.asdThr\(W, room\) : DI\.asdThr\(W\)\) : \[DI\.spotThr\(W\)\];/.test(as) && (as.match(/asdThr\(/g) || []).length === 2 && !/n76|veaFire1|\.f1\b/.test(DI.relState.toString() + DI.canRelease.toString() + DI.setSolOut.toString()));
    const rows = TT.readRows(), tt = [0.5, 1.23, 2.5].map((f1) => rows.map((row) => TT.runRow(DI, row, { room: 'tel', cfg: { asdModel: 'VEA', nfpa76Adopted: true, detThr: [0.03, 0.06, f1, 1.2] } })).filter((q) => q.ok).length), ttDef = rows.map((row) => TT.runRow(DI, row, { room: 'tel', cfg: { asdModel: 'VEA', nfpa76Adopted: true } })).filter((q) => q.ok).length;
    ok('A130 the truth table is 17 of 17 with a telecom room and a VEA detector at 0.5, 1.23 and 2.5, and at the room default; the fixture is the pinned file', tt.join() === '17,17,17' && ttDef === 17 && rows.length === 17 && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && resTT.every((q) => q.ok), tt.join() + ',' + ttDef);
    DI.setJuris(new DI.World(4, 4));
  }
  // A131 no recall, shunt, waterflow or door device feeds the release (FA Lead ruling 8cb97c21, PRACTICE; a guard for the future)
  {
    // (a) static: DI.relState reads the detection latch (sol), the DETECTION-typed manual station (pull), the P latch, and the Manual Release zone latch of the 9(c) bypass, and nothing else
    const rsSrc = DI.relState.toString(), props = [...new Set((rsSrc.match(/\bq\.[A-Za-z0-9_]+/g) || []))].sort().join(), ALLOW = /^(function|W|v|const|q|p|mrz|mrzL|DI|stationType|MANUAL|RELEASE|D|sol|pull|P|pLatch|open|return|trim|el|pn)$/;
    const words = [...new Set(rsSrc.match(/[A-Za-z_][A-Za-z0-9_]*/g))], strange = words.filter((w) => !ALLOW.test(w));
    ok('A131 (a) static: DI.relState is the pinned source and names only the detection latch, the manual station, P, the Manual Release zone latch and the trim: no waterflow, alarm, recall, shunt, door, hold, EPO, HVAC or NAC', sha16(rsSrc) === 'a19f3e39ec09d52e' && props === 'q.mrzL,q.pLatch,q.pull,q.sol,q.trim' && strange.length === 0 && !/waterflow|wf|alarm|recall|shunt|door|hold|epo|hvac|nac/i.test(rsSrc), strange.join() || undefined);
    // (b) run-time: P latched, no Fire 1; each device on its own must leave D false and the valve shut
    const quiet = (trim, mut) => { const r = liveRig({ gate: true, stn: true }); if (trim === 'el-pn') { DI.loadTrim(r.v, 'el-pn'); r.W.ver++; r.S.sync(); } const sp = r.W.addPart('smoke', 29, 1, 0); r.W.wire(r.pn.id, sp.id); r.S.sync(); r.sp = sp;
      breakHead(r); const pre = r.v.p.pLatch === true && r.s.state === 'dry'; mut(r); const rs = DI.relState(r.W, r.v); return pre && rs.D === false && rs.open === false && r.v.p.solOut === false && r.s.state === 'dry' && r.s.wat === 0 && !(r.s.tripT > 0) ? '' : 'released'; };
    const cases = { waterflow: (r) => { r.s.alarm = true; r.s.alarmT = r.S.t; r.v.p.wfL = true; run(r.S, 10, 0.25); }, 'AVC tamper': (r) => { r.v.p.avcTamper = 1; r.v.p.avcBy = 1; run(r.S, 10, 0.25); }, 'charger failure': (r) => { r.pn.p.chgFail = true; run(r.S, 10, 0.25); }, 'battery disconnect': (r) => { r.pn.p.battDisc = true; run(r.S, 10, 0.25); },
      'DACT failure': (r) => { r.W.cfg.commPath = 'dact'; r.pn.p.chan = [0, 0]; run(r.S, 10, 1); r.S.warp(DI.DACT_TOTAL_S + 30); }, 'valve tamper': (r) => { DI.setGate(r.S, r.g.id, 0); run(r.S, 10, 0.25); },
      'spot (lobby) smoke detector in a hall, the aspirating detector quiet': (r) => { r.sp.p.lvl = 1; const k = r.W.rooms[0].id; for (let t = 0; t < 10; t += 0.25) { r.S.smoke[k] = 0.02; r.sp.p.lvl = 1; r.S.step(0.25); } } };
    const bad = []; for (const trim of ['el-el', 'el-pn']) for (const [name, mut] of Object.entries(cases)) { const m = quiet(trim, mut); if (m) bad.push(trim + ' ' + name); }
    const lobby = liveRig({ gate: true }), sp = lobby.W.addPart('smoke', 29, 1, 0); lobby.W.wire(lobby.pn.id, sp.id); lobby.S.sync(); sp.p.lvl = 1; lobby.S.step(0.25); const lobbySig = lobby.S.sig.has('s' + sp.id) && sp.p.rel === false && lobby.v.p.sol === false && DI.canRelease(lobby.W, sp) === false;
    ok('A131 (b) run-time, El/El and El/Pn, P latched and no Fire 1: waterflow, AVC tamper, charger failure, battery disconnect, DACT failure, a control valve tamper and a spot smoke detector in a hall each leave D false and the valve shut', bad.length === 0 && lobbySig, bad.join('; ') || undefined);
    // (c) the registry: no fixed signal key other than fire1 and manual (D), and mrz (the Manual Release zone of the 9(c) bypass, the locked second release path), may be read by the release. The allow-list is here on purpose: a new key has to be added to it deliberately.
    const INPUTS = ['fire1', 'manual', 'mrz'], NEVER = Object.keys(DI.SIG_FIXED).filter((k) => !INPUTS.includes(k)), named = NEVER.filter((k) => new RegExp('\\b' + k + '\\b').test(rsSrc)), gasRel = DI.setSolOut.toString();
    ok('A131 (c) no registry key other than fire1, manual and mrz (the company-locked Manual Release zone path of the 9(c) bypass) appears as an input of the release: the allow-list is in this test, so a new key must be added on purpose', NEVER.length === 25 && named.length === 0 && !NEVER.some((k) => new RegExp("sig\\.(has|get)\\('?" + k).test(rsSrc + gasRel)) && !/S\.sig|\.dq\b|wfL|alarm\b/.test(rsSrc + gasRel) && Object.keys(DI.SIG_FIXED).length === 28, named.join() || undefined);
    // (d) the rule is written down
    const SENT = 'elevator recall, shunt trip, door hold-open and locked-door devices are outputs and monitor points only and never feed release; a shunt trip is not an EPO hook';
    ok('A131 (d) CLAUDE.md carries the rule and the manual lists it under "Simplified on purpose"; the matrix footer says so too (FA Lead ruling 8cb97c21, PRACTICE)', /No elevator recall, shunt-trip, waterflow or door device ever feeds the DI release/.test(claude8.replace(/\s+/g, ' ')) && /8cb97c21/.test(claude8) && manual8.includes(SENT) && /Simplified on purpose in the fire alarm side:<\/b>[^<]*elevator recall, shunt trip, door hold-open/.test(manual8) &&
      DI.CE_EXCLUDED.includes('elevator recall, shunt trip and door devices (outputs and monitor points only: they never feed the release, and a shunt trip is not an EPO hook)') && !Object.keys(DI.PARTS).some((k) => /elev|recall|shunt|door|lock/i.test(k + DI.PARTS[k].name)));
    DI.setJuris(new DI.World(4, 4));
  }
  // A132 persistence and migration of every new field
  {
    const r = retRig(); tel(r); r.W.rooms[0].n76 = true; r.W.rooms[0].f1 = 2.5; Object.assign(r.W.cfg, { nec: '2026', ownerRefill: 15, asdModel: 'VEA' }); Object.assign(r.pn.p, { nacOn: 1, nacAwg: 12, nacFt: 640, nacN: 11, nacCd: 95, nacV: 23 }); r.W.ver++;
    DI.bleedToNormal(r.S, r.v.id); r.S.step(0.25); r.v.p.drain = 1; DI.returnFinish(r.S, r.v.id); DI.returnFinish(r.S, r.v.id); const c0 = DI.nacCalc(r.W, r.pn), rv0 = DI.review(r.S).filter((q) => /NAC|NFPA 76|Owner/.test(q.text)).map((q) => q.sev + ':' + q.text).join('\n');
    const q = reload7(r), room = q.W.rooms[0], c1 = DI.nacCalc(q.W, q.pn), rv1 = DI.review(q.S).filter((x) => /NAC|NFPA 76|Owner/.test(x.text)).map((x) => x.sev + ':' + x.text).join('\n');
    ok('A132 the NAC props, the NEC edition, the owner target, a telecom room with n76 and f1, and the press count and last blocker set of a pending return step all round-trip through save and load', ['nacOn', 'nacAwg', 'nacFt', 'nacN', 'nacCd', 'nacV'].every((k) => q.pn.p[k] === r.pn.p[k]) && q.pn.p.nacFt === 640 && q.pn.p.nacV === 23 && JSON.stringify(c1) === JSON.stringify(c0) && q.W.cfg.nec === '2026' && q.W.cfg.ownerRefill === 15 &&
      room.type === 'tel' && room.n76 === true && room.f1 === 2.5 && room.name === TEL && DI.veaFire1At(q.W, room) === 2.5 && q.s.ret === true && q.s.rtPress === 2 && q.s.rtLast.join() === 'a drain is open' && q.s.rtErr.length === 1 && rv1 === rv0 && /N76_ALARM_OVER|NFPA 76 applies in/.test(rv1) && !q.W.notes && !q.S.loadNotes);
    // a Cycle 7 save: none of the Cycle 8 fields
    const b = rig({ gate: true }); run(b.S, 5, 1); const strip = (jw, js) => { delete jw.v; for (const p of jw.parts) for (const k of ['nacOn', 'nacAwg', 'nacFt', 'nacN', 'nacCd', 'nacV']) delete p.p[k]; for (const k of ['nec', 'ownerRefill']) delete jw.cfg[k]; for (const x of jw.rooms) { delete x.n76; delete x.f1; } for (const z of js.ss) { delete z[1].rtPress; delete z[1].rtLast; } };
    const o = reload7(b, strip), sigs = (x) => [...x.S.sig.keys()].sort().join(); run(o.S, 5, 1); run(b.S, 5, 1);
    ok('A132 a Cycle 7 save loads with every default (NAC off, NEC 2023, no owner target, no telecom room, 0 presses), with no load note, and the review and the signals are what the same plant gives now', o.pn.p.nacOn === 0 && o.pn.p.nacAwg === 14 && o.pn.p.nacFt === 200 && o.pn.p.nacN === 8 && o.pn.p.nacCd === 75 && o.pn.p.nacV === 0 && DI.nec(o.W) === '2023' && !('nec' in o.W.cfg) && DI.ownerRefill(o.W) === 0 &&
      !o.W.rooms.some((x) => x.type === 'tel' || 'n76' in x || 'f1' in x) && DI.rtPresses(o.s) === 0 && !o.W.notes && !o.S.loadNotes && JSON.stringify(DI.review(o.S)) === JSON.stringify(DI.review(b.S)) && sigs(o) === sigs(b) && DI.nacFinding(o.W, o.pn) === null);
    // no secrets: nothing that looks like a key, a token or a credential in the sources, the tests or the docs
    const files = allSrc8.map((x) => x[1]).concat(fs.readdirSync(__dirname).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')), [readme8, claude8]).join('\n');
    const KEYS = [/AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /sk-[A-Za-z0-9_-]{24,}/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, /(api[_-]?key|secret|passwd|password|auth[_-]?token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i];
    const hits = KEYS.map((re) => (files.match(re) || [])[0]).filter(Boolean);
    ok('A132 static: no secrets, tokens or credentials in src/, test/, README.md or CLAUDE.md', hits.length === 0, hits.map((h) => h.slice(0, 12) + '…').join() || undefined);
    DI.setJuris(new DI.World(4, 4));
  }
  // A133 docs and the standalone file
  {
    const C = claude8.replace(/\s+/g, ' '), Rm = readme8.replace(/\s+/g, ' '), has = (t, list) => list.filter((re) => !re.test(t)).map(String);
    const mMiss = has(manual8, [/NOTIFICATION CIRCUIT VOLTAGE DROP \(NAC\), A PLAN REVIEW CHECK/, /circuit resistance = 2 &times; one-way length &times; ohm per 1000 ft &divide; 1000/, /2025: NFPA 72-2025 &sect;18\.3\.7\.1 to &sect;18\.3\.7\.6 \[CODE\]/, /2022: PRACTICE: NFPA 72-2022 &sect;18\.3\.7 ends at &sect;18\.3\.7\.2/, /2019: PRACTICE: NFPA 72-2019 has no &sect;18\.3\.7/, /17\.07 V/,
      /air refill is two numbers on two labeled lines/, /one error for each unchanged set of blockers/, /warnings on a compressor&rsquo;s relief setpoint/, /warning tagged owner\/insurer criterion/, /NFPA 76 applies by room/, /NFPA 76 now applies by room\. This save has no telecom room/, /PRACTICE with code support/, /a trigger to investigate/, /INVESTIGATE/, /Refrigerated Space/]);
    const rMiss = has(Rm, [/Cycle 8/, /NAC voltage drop/i, /§18\.3\.7\.1 to §18\.3\.7\.6/, /Table 8/, /Code check: largest zone alone, from 0 psig/, /measured, informational/, /one error for each unchanged set of blockers|once per unchanged blocker set/i, /Owner\/insurer criterion|owner \/ insurer refill target/i, /relief/i, /Telecom \/ MMR/, /NFPA 76 now applies by room|applies by room/i, /PRACTICE with code support/, /INVESTIGATE/, /Refrigerated Space/, /ui\.c8\.js/]);
    const cMiss = has(C, [/DI\.nacCalc/, /NAC_OHM/, /DI\.codeCheckLine/, /DI\.measuredLine/, /rtPress/, /rtLast/, /DI\.compWarnings/, /ownerRefill/, /DI\.n76Applies/, /DI\.veaFire1At/, /DI\.ref72\(W\)\.latch|REF72.*latch/, /INVESTIGATE|res\.invest|invest/, /ui\.c8\.js/, /8cb97c21/, /Refrigerated Space/]);
    ok('A133 the manual, README.md and CLAUDE.md carry the Cycle 8 sections: the NAC calculation and its basis by edition, the two-number refill report, Finish once per blocker set, the compressor and owner warnings, per-room telecom with the migration note, and the corrected latch and NFPA 25 text', mMiss.length === 0 && rMiss.length === 0 && cMiss.length === 0, [].concat(mMiss.map((x) => 'manual ' + x), rMiss.map((x) => 'README ' + x), cMiss.map((x) => 'CLAUDE ' + x)).slice(0, 6).join('  ') || undefined);
    let html = fs.readFileSync(path.join(ROOT8, 'index.html'), 'utf8');
    html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, f) => '<style>\n' + fs.readFileSync(path.join(ROOT8, f), 'utf8') + '</style>').replace(/<script src="([^"]+)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(ROOT8, f), 'utf8').replace(/<\/script/g, '<\\/script') + '\n</script>');
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT8, 'package.json'), 'utf8'));
    // (the field call checks, ui.puz.js, run last; npm test runs the field call engine test, puzzle.test.js, last)
    ok('A133 build-standalone.js reproduces double-interlock.html byte for byte; the fixture is the pinned file; npm run test:ui runs ui.c8.js after ui.c7.js, then the field calls; the game still has no runtime dependency', html === fs.readFileSync(path.join(ROOT8, 'double-interlock.html'), 'utf8') && TT.sha16(TT.FILE) === 'cb3462b268359c6e' && /node test\/ui\.c7\.js \/tmp\/c7\.png && node test\/ui\.c8\.js \/tmp\/c8\.png && node test\/ui\.puz\.js \/tmp\/puz\.png$/.test(pkg.scripts['test:ui']) && /node test\/puzzle\.test\.js$/.test(pkg.scripts.test) &&
      !pkg.dependencies && Object.keys(pkg.devDependencies).sort().join() === '@tauri-apps/cli,playwright' && fs.existsSync(path.join(__dirname, 'ui.c8.js')));
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
    // Cycle 5 adds two identifiers for the practice reopen with a head open (s.floodW, the reopen-flood log entry): a head is open there. They are names, not text.
    const noId = (t) => t.replace(/floodW|floodK|FLOOD_BANNER|reopen-flood/g, '');      // Cycle 6 adds two more names (s.floodK, DI.FLOOD_BANNER): names again, not text
    const floods = noId(src).split('\n').filter((l) => /flood/i.test(l)).map((l) => l.match(/[^.>]*flood[^.<]*/i)[0].trim());
    ok('static: no user-visible text says a closed-head trip floods anything', floods.every((t) => /^\/\/ (Flood-fills|air \/ nitrogen tubing: flood each)/.test(t) || /A pipe break plus a detection event floods the room/.test(t)) && floods.length === 3 && !/flood/i.test(noId(claude)) && !/floods the hall/.test(readme), floods.join(' | '));
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
