// Campaign contracts 3-4: water supply. Tank, fire pump, jockey pump, then a second driver.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const G = DI.G, X = DI.X;
  const site = (W) => {       // weak city main feeding an existing storage-building wet system
    const b = DI.mk(W);
    W.addRoom('pump', 10, 10, 8, 6).exempt = true; W.addRoom('riser', 26, 11, 4, 5).exempt = true; W.addRoom('stor', 30, 8, 16, 10);
    b.p('city', 2, 18, 0, { stat: 45, resid: 18, flow: 600, fixed: true }); b.h(3, 3, 18, 7); b.p('bfp', 4, 18); b.h(5, 24, 18, 7); b.v(24, 13, 17, 7); b.h(25, 26, 13, 7);
    const g = b.p('gate', 27, 13), r = b.p('wetv', 28, 13); b.h(29, 29, 13, 6); b.h(30, 45, 13, 6, true);
    b.grid(30, 8, 45, 12, 2, 2); b.grid(30, 14, 45, 17, 2, 2);
    const pn = b.p('panel', 26, 11); b.wire(pn, g, r);
    return { b, pn };
  };
  DI.pumpHouse = (b, pn) => {  // reference electric pump installation (also the starting plant of contract 4)
    b.p('tank', 6, 12, 0, { cap: 120000, gal: 120000 }); b.h(7, 10, 12, 8);
    const ep = b.p('epump', 11, 12, 0, { gpm: 1000, psi: 100, start: 100 }); b.h(12, 13, 12, 8); b.p('check', 14, 12); b.h(15, 19, 12, 8); b.v(19, 13, 17, 8);
    b.v(9, 10, 11, 3); b.h(10, 10, 10, 3); const jp = b.p('jockey', 11, 10, 0, { gpm: 15, psi: 115, start: 115, stop: 125 }); b.h(12, 13, 10, 3); b.p('check', 14, 10); b.h(15, 15, 10, 3); b.v(15, 11, 11, 3);
    b.v(17, 13, 15, 7); const th = b.p('testhdr', 17, 16, 1);
    if (pn) b.wire(pn, ep);
    return { ep, jp, th };
  };
  const leak = (S) => { S.leaks.push({ k: S.W.k(20, 18), K: 0.012 }); S.dirty = true; };
  const pumps = (S) => [...S.W.parts.values()].filter((p) => p.type === 'epump' || p.type === 'dpump');

  DI.SCEN.push({
    id: 'c3', name: 'Churn', tag: 'Tank, fire pump, jockey pump', w: 60, h: 32, money: 330000, par: 232000,
    parts: ['tank', 'epump', 'jockey', 'gate', 'check', 'testhdr', 'fdc'],
    brief: ['Hyperscale sites get built where land and power are cheap, which is rarely where the water is. This one has a 6-inch rural main: 45 psi static, 18 psi residual at 600 gpm. The storage building needs about 550 gpm with real pressure behind it. Open the riser and run the calc if you want to see how badly that goes.',
      'So the site makes its own supply: a tank for volume, a fire pump for pressure, and a jockey pump so the big one only wakes up for a fire.'],
    learn: ['Reading a pump curve: churn (max 140%), rated point, 150% flow at 65% pressure', 'Why the tank, not the pump, sets how long you can fight', 'Pressure settings: jockey stop = churn + suction, jockey start 10 psi lower, fire pump 5 psi below that', 'The three-point flow test through a test header'],
    build(W) { site(W); }, start: leak,
    goals: [
      { t: 'Fire pump flow test passes at churn, 100% and 150%', ok: (S) => G.anyTest(S, 'pump'), hint: 'Tank → pump → check valve → main, with a test header teed off the discharge. Select the pump and run the flow test.' },
      { t: 'Storage building hydraulic calc passes with the pump running', ok: (S) => G.calcOk(S, 'stor'), hint: 'Select the wet riser and run the calc. It assumes pumps in AUTO are running.' },
      { t: 'Pump stays under 150% of rated flow and the tank lasts 60 minutes', ok: (S) => G.each(S, 'stor', (v, i, s, id) => { const c = S.calc && S.calc.get(id); return !!c && c.ok && !c.over && c.durOk; }) && pumps(S).length > 0, hint: 'The calc reports the pump operating point and tank duration. Demand × 60 min is the minimum tank.' },
      { t: 'Jockey pump installed with start/stop settings in the right order', ok: (S) => S.W.byType('jockey').length > 0 && G.noWarn(S, 'ockey') && pumps(S).length > 0, hint: 'Jockey stop about churn + suction pressure. Jockey start 10 psi under that. Fire pump start 5 psi under jockey start.' },
      { t: 'Thirty quiet minutes: the jockey holds pressure and the fire pump never starts', ok: (S) => pumps(S).length > 0 && pumps(S).every((p) => p.p.mode === 'auto' && p.p.spd === 0) && S.t - Math.max(S.lastAuto || 0, S.editT || 0, S.lastTestT || 0) >= 1800, hint: 'There is a small leak on the old underground main. Let time run (speed up). If the fire pump starts, your settings overlap.' },
      { t: 'No code failures in review', ok: (S) => G.noFails(S), hint: '' },
    ],
    drill: { name: 'Night Shift', len: 1500, steps: () => [[10, X.fire('stor', 0.6, 0.5, 0, 1.5), 'Fire in rack storage of cable reels and packaging.']],
      judge: DI.lossJudge(120000, (S) => [[pumps(S).some((p) => p.p.ranFor > 30), 'Fire pump started on pressure drop and stayed running']]) },
  });

  DI.SCEN.push({
    id: 'c4', name: 'Lights Out', tag: 'Diesel pump, FDC, redundancy', w: 60, h: 32, money: 260000, par: 205000,
    parts: ['tank', 'epump', 'dpump', 'jockey', 'gate', 'check', 'testhdr', 'fdc'],
    brief: ['Same site, one year later. The insurer walked the pump house and wrote a single line: "One pump, one feeder, no alternative."',
      'An electric fire pump is exactly as reliable as the wire that feeds it, and fires love storms. Give this site a second way to make pressure, and a way for the fire department to add theirs.'],
    learn: ['Diesel driver: fuel for 8 hours (1 gal/hp + 5% + 5%), two batteries, weekly 30-minute run', 'Lead / lag: stagger pump starts 10 psi apart so they do not start together', 'The FDC is the fire department’s way in, and it needs a check valve', 'Supervisory signals are how you find out before the fire does'],
    build(W) { const s = site(W); DI.pumpHouse(s.b, s.pn); }, start: leak,
    goals: [
      { t: 'A second, independent way to drive a fire pump', ok: (S) => G.noWarn(S, 'utility power alone'), hint: 'Add a diesel fire pump in parallel (its own check valve), or pay for a generator-backed feed on the electric pump.' },
      { t: 'Every fire pump has a passing flow test', ok: (S) => pumps(S).length > 0 && pumps(S).every((p) => { const r = DI.lastResult(S, 'pump', p.id); return r && r.pass; }), hint: 'Select each pump and run the flow test.' },
      { t: 'Lag pump starts at least 10 psi below the lead pump', ok: (S) => G.noWarn(S, 'start within 10 psi'), hint: 'Pump controller: lower the start pressure on one of them.' },
      { t: 'Churn run logged for every pump (diesel 30 min, electric 10 min)', ok: (S) => pumps(S).every((p) => { const r = DI.lastResult(S, 'run', p.id); return r && r.pass; }), hint: 'Select the pump, run the no-flow test. Speed time up.' },
      { t: 'Fire department connection installed behind a check valve', ok: (S) => S.W.byType('fdc').some((f) => { const d = S.W.ports(f).o, o = S.W.at(f.x + DI.DX[d], f.y + DI.DY[d]); return o && o.type === 'check'; }), hint: 'Place the FDC outdoors, a check valve right against its outlet, then pipe to the main.' },
      { t: 'All pumps wired to the panel, in AUTO, no code failures', ok: (S) => G.noFails(S) && G.wired(S, ['epump', 'dpump']) && pumps(S).every((p) => p.p.mode === 'auto'), hint: 'Wire tool: panel, then each pump controller.' },
    ],
    drill: { name: 'Lights Out', len: 2400, steps: () => [
      [15, (S) => { for (const p of S.W.byType('dpump')) p.p.batt = 0.1; }],
      [40, X.power(false), 'Lightning strike. Utility power is gone.'],
      [520, X.fire('stor', 0.4, 0.6, 0, 1.5), 'Fire in the storage building. In the dark.'],
      [1900, X.power(true)]],
      judge: DI.lossJudge(150000, (S) => [[pumps(S).some((p) => p.p.ranFor > 30), 'A fire pump ran without utility power']]) },
  });
})();
