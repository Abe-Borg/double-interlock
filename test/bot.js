// Headless playthrough helpers, shared by test/campaign.test.js and the browser smoke test.
// build(id) lays out a known-good solution on the world of scenario `id`.
(function (root) {
  const DI = root.DI;
  const SOL = {
    c1(W, b) {
      b.h(3, 4, 12, 6); b.p('bfp', 5, 12); b.h(6, 6, 12, 6); const g = b.p('gate', 7, 12), r = b.p('wetv', 8, 12);
      b.h(9, 19, 12, 6, true); b.v(20, 6, 17, 5, true); const pn = b.p('panel', 8, 10);
      b.v(10, 10, 11, 1, true); W.setPipe(10, 13, 1, 0, true); W.setPipe(9, 13, 6, 0, true); b.grid(8, 10, 9, 11, 1, 1); b.grid(8, 13, 8, 13, 1, 1);
      b.grid(11, 6, 19, 11, 1, 1); b.grid(11, 13, 19, 17, 1, 1); b.grid(21, 6, 28, 17, 1, 1);
      b.p('fdc', 6, 14, 0); b.p('check', 7, 14); b.h(8, 9, 14, 6);
      b.wire(pn, g, r);
      return { tests: [['itc', r.id], ['drain', r.id]], cost: 1 };
    },
    c2(W, b) {
      W.setPipe(8, 12, 6, 0); const g = b.p('gate', 8, 13, 1), v = W.addPart('dryv', 8, 14, 1, { qod: true });
      b.v(8, 15, 16, 6); b.h(9, 34, 16, 6); b.v(34, 11, 15, 6, true); b.h(24, 45, 10, 6, true); b.grid(24, 6, 45, 9, 2, 2); b.grid(24, 11, 45, 15, 2, 2);
      b.p('comp', 10, 14, 0, { scfm: 10 }); b.air([[9, 14]]); b.wire(W.byType('panel')[0], g, v);
      return { settle: 1900, tests: [['trip', v.id]], after: (S) => DI.botRestore(S, 4000), ops: (S) => DI.botOps(S) };
    },
    c3(W, b) { const pn = W.byType('panel')[0], o = DI.pumpHouse(b, pn); return { tests: [['pump', o.ep.id]], post: (S) => S.warp(1900) }; },
    c4(W, b) {
      const pn = W.byType('panel')[0]; b.v(8, 13, 14, 8); b.h(9, 10, 14, 8); const dp = b.p('dpump', 11, 14, 0, { gpm: 1000, psi: 100, start: 90 }); b.h(12, 13, 14, 8); b.p('check', 14, 14); b.h(15, 16, 14, 8); W.setPipe(16, 13, 8, 0);
      b.p('fdc', 21, 20, 0); b.p('check', 22, 20); W.setPipe(23, 20, 7, 0); W.setPipe(23, 19, 7, 0); b.wire(pn, dp);
      const ep = W.byType('epump')[0];
      return { tests: [['pump', ep.id], ['pump', dp.id], ['run', ep.id], ['run', dp.id]], ops: (S) => DI.botOps(S) };
    },
    c5(W, b) {                       // one control valve per preaction valve, so restoring one system never isolates the others
      b.v(17, 12, 15, 8);
      const gA = b.p('gate', 18, 13, 0), A = b.p('prev', 19, 13, 0), gB = b.p('gate', 17, 11, 3), B = b.p('prev', 17, 10, 3), gC = b.p('gate', 17, 16, 1), C = b.p('prev', 17, 17, 1);
      const pn = b.p('panel', 15, 10), d1 = b.p('vesda', 36, 5), d2 = b.p('vesda', 33, 22);
      b.h(20, 21, 13, 6); b.h(22, 28, 13, 6, true); b.v(29, 5, 20, 5, true); b.grid(22, 5, 28, 20, 2, 1); b.grid(30, 5, 36, 20, 2, 1);
      b.v(17, 4, 9, 5); b.h(18, 44, 4, 5); b.v(44, 5, 20, 6, true); b.grid(37, 5, 43, 20, 2, 1); b.grid(45, 5, 51, 20, 2, 1); b.capCol(36, 5, 20); b.capRow(4, 29, 29);
      b.v(17, 18, 25, 5); b.h(18, 21, 25, 5); b.h(22, 26, 25, 5, true); b.v(27, 22, 28, 4, true); b.grid(22, 22, 26, 28, 2, 1); b.grid(28, 22, 33, 28, 2, 1);
      b.p('comp', 19, 15, 0, { scfm: 10 }); b.air([[18, 10], [18, 11], [18, 12], [19, 12], [20, 12], [20, 13], [20, 14], [20, 15], [20, 16], [20, 17], [19, 17], [18, 17]]);
      b.wire(pn, A, B, C, gA, gB, gC, d1, d2, W.byType('gate')[0]);
      return { settle: 1900, tests: [['trip', A.id], ['trip', B.id], ['trip', C.id]], after: (S) => DI.botRestore(S, 4000), ops: (S) => DI.botOps(S) };
    },
    c6(W, b) {
      b.p('n2', 18, 13, 0); const v = W.byType('prev')[0];
      return { tests: [['leak', v.id]], after: (S, kind) => { const s = S.ss.get(v.id); if (s.holes) { W.money -= s.holes * 1800; s.holes = 0; s.corr = 0.25; v.p.vent = true; S.warp(16 * 86400); DI.startTest(S, 'leak', v.id); S.warp(86500); } },
        post: (S) => { for (let i = 0; i < 12; i++) { S.warp(DI.YEAR / 2); DI.SCEN.find((q) => q.id === 'c6').tick(S); } } };
    },
    c7(W, b) {
      b.p('tank', 2, 28, 0, { cap: 120000, gal: 120000 }); b.h(3, 7, 28, 8);
      const ep = b.p('epump', 8, 28, 0, { gpm: 1000, psi: 125, start: 140 }); b.h(9, 10, 28, 8); b.p('check', 11, 28); b.h(12, 19, 28, 8); const mg = b.p('gate', 20, 28); b.h(21, 83, 28, 8);
      b.v(4, 29, 30, 8); b.h(5, 7, 30, 8); const dp = b.p('dpump', 8, 30, 0, { gpm: 1000, psi: 125, start: 130 }); b.h(9, 10, 30, 8); b.p('check', 11, 30); W.setPipe(12, 30, 8, 0); W.setPipe(12, 29, 8, 0);
      b.v(6, 26, 27, 3); W.setPipe(7, 26, 3, 0); b.p('jockey', 8, 26, 0, { psi: 150, start: 150, stop: 160 }); b.h(9, 10, 26, 3); b.p('check', 11, 26); W.setPipe(12, 26, 3, 0); W.setPipe(12, 27, 3, 0);
      b.v(14, 29, 31, 7); b.p('testhdr', 14, 32, 1); b.p('fdc', 16, 30, 0); b.p('check', 17, 30); W.setPipe(18, 30, 7, 0); W.setPipe(18, 29, 7, 0);
      const pn = b.p('panel', 27, 25), devs = [ep, dp, mg];
      const north = (x, type, props) => { const g = b.p('gate', x, 27, 3); W.setPipe(x, 26, 6, 0); const v = b.p(type, x, 25, 3, props); devs.push(g, v); return v; };
      const south = (x, type, props) => { const g = b.p('gate', x, 29, 1); W.setPipe(x, 30, 6, 0); const v = b.p(type, x, 31, 1, props); devs.push(g, v); return v; };
      const hall = (xc, x0, x1) => { b.v(xc, 11, 24, 5, true); b.grid(x0, 11, xc - 1, 24, 2, 1); b.grid(xc + 1, 11, x1, 24, 2, 1); };
      const room = (xc, x0, x1, bs, cm) => { b.v(xc, 32, 38, cm, true); b.grid(x0, 32, xc - 1, 38, bs, 1); b.grid(xc + 1, 32, x1, 38, bs, 1); };
      const A1 = north(36, 'prev'), A2 = north(49, 'prev'), B1 = north(64, 'prev'), B2 = north(77, 'prev');
      devs.push(b.p('vesda', 42, 11), b.p('vesda', 70, 11), b.p('vesda', 61, 32));
      hall(36, 30, 42); hall(49, 43, 55); hall(64, 58, 70); hall(77, 71, 83); b.capCol(42, 11, 24); b.capCol(70, 11, 24);
      south(38, 'wetv'); room(38, 30, 45, 1, 5); const E = south(55, 'prev'); room(55, 48, 61, 2, 5); south(69, 'wetv'); room(69, 64, 73, 2, 5);
      const D = south(82, 'dryv', { qod: true, airSet: 50 }); room(82, 76, 87, 2, 6);
      b.p('comp', 27, 27, 0, { scfm: 20 }); const air = []; for (let x = 28; x <= 82; x++) { if (x <= 77) air.push([x, 26]); air.push([x, 30]); } for (let y = 27; y <= 29; y++) air.push([28, y]); b.air(air);
      b.wire(pn, ...devs);
      return { settle: 2400, tests: [['pump', ep.id], ['pump', dp.id], ['trip', A1.id], ['trip', A2.id], ['trip', B1.id], ['trip', B2.id], ['trip', E.id], ['trip', D.id]], after: (S) => DI.botRestore(S, 5000), ops: (S) => DI.botOps(S) };
    },
  };
  DI.worth = function (W) { let c = 0; for (let k = 0; k < W.pd.length; k++) { if (W.pd[k]) c += DI.PIPES[W.pd[k] - 1].cost + (W.spk[k] ? DI.SPK_COST : 0); if (W.air[k]) c += 25; } for (const p of W.parts.values()) if (!p.p.fixed) c += DI.partCost(p.type, p.p) + (p.p.vent ? 3200 : 0); return c; };
  DI.botBuild = function (S, id) { const W = S.W, b = DI.mk(W), c0 = DI.worth(W), out = SOL[id](W, b); W.money -= DI.worth(W) - c0; S.sync(); return out; };
  // operator: put impaired dry / preaction systems back in service, the way the manual says to
  DI.botOps = function (S) {
    const W = S.W, gates = W.byType('gate');
    for (const p of W.byType('dpump')) if (p.p.batt < 0.5) { p.p.batt = 1; p.p.failed = false; p.p.crank = 0; }
    for (const g of gates) if (g.p.target < 1 && !g.p.bot) g.p.target = 1;                    // somebody closed a valve: open it
    for (const d of W.parts.values()) if ((d.type === 'vesda') && d.p.lvl >= 1 && d.p.lvl < 3 && !S.tech) { const r = W.room(d.x, d.y); if (r) DI.sendTech(S, r.id); }
    if (S.fires.length) return;
    for (const [id, s] of S.ss) {
      const v = W.parts.get(id); if (v.type === 'wetv') { if (s.openK && s.openK.length && S.outFlow < 1) DI.replaceSprinklers(S, id); continue; }
      if (s.state === 'dry') { if (s.openK && s.openK.length) DI.replaceSprinklers(S, id); continue; }
      const g = DI.botGate(S, id); if (g) { g.p.target = 0; g.p.bot = true; if (g.p.open > 0.02) continue; }
      if (!v.p.sdrain) { v.p.sdrain = 1; S.touch(); }
      for (const pn of W.byType('panel')) if ([...W.parts.values()].every((d) => !(d.type === 'vesda' || d.type === 'smoke') || !(d.p.live > 0))) DI.panelReset(S, pn.id);
      if (s.wat < 0.01 * s.vol + 0.2) { DI.replaceSprinklers(S, id); DI.resetValve(S, id); }
    }
    for (const g of gates) if (g.p.bot && [...S.ss.entries()].every(([id, s]) => W.parts.get(id).type === 'wetv' || DI.botGate(S, id) !== g || (s.state === 'dry' && s.set))) { g.p.target = 1; g.p.bot = false; }
    if (W.byType('prev').some((v) => v.p.sol) && [...W.parts.values()].every((d) => !(d.type === 'vesda' || d.type === 'smoke') || !(d.p.live > 0))) for (const pn of W.byType('panel')) DI.panelReset(S, pn.id);
  };
  // nearest control valve upstream of a system valve (walk the supply pipe run)
  DI.botGate = function (S, id) {
    const W = S.W, v = W.parts.get(id), seen = new Set(), q = [[v.x, v.y, W.ports(v).i]];
    for (let h = 0; h < q.length && h < 400; h++) {
      const [x, y, d] = q[h]; if (!W.linked(x, y, d)) continue; const nx = x + DI.DX[d], ny = y + DI.DY[d], k = W.k(nx, ny); if (seen.has(k)) continue; seen.add(k);
      const o = W.at(nx, ny); if (o) { if (o.type === 'gate') return o; continue; }
      for (let e = 0; e < 4; e++) if (e !== DI.OPP[d]) q.push([nx, ny, e]);
    }
    return null;
  };
  DI.botRestore = function (S, maxSec) { const end = S.t + maxSec; while (S.t < end) { DI.botOps(S); S.step(0.5); if ([...S.ss.entries()].every(([id, s]) => S.W.parts.get(id).type === 'wetv' || (s.state === 'dry' && s.set)) && S.W.byType('gate').every((g) => g.p.open > 0.99)) break; } };
  DI.botCheck = function (S, sc) { S.rv = DI.review(S); S.calc = new Map(); for (const i of S.sysd.info.keys()) if (S.sysd.info.get(i).nSpk) S.calc.set(i, DI.hydCalc(S, i)); return sc.goals.map((q) => !!q.ok(S)); };
  DI.BOT = SOL;
})(typeof window !== 'undefined' ? window : globalThis);
