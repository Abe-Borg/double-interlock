// node test/campaign.test.js [id]  - plays each contract headlessly with a reference solution: goals, then the drill.
for (const f of ['core', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3']) require('../src/' + f + '.js');
require('./bot.js'); const DI = globalThis.DI; let fail = 0;
const only = process.argv[2];
for (const sc of DI.SCEN) {
  if (!DI.BOT[sc.id] || (only && only !== sc.id)) continue;
  const W = new DI.World(sc.w, sc.h); sc.build(W); W.money = sc.money; const S = new DI.Sim(W); S.commission(); if (sc.start) sc.start(S);
  const sol = DI.botBuild(S, sc.id); if (sol.pre) sol.pre(S);
  S.warp(sol.settle || 120);
  for (const [kind, id] of sol.tests || []) { const m = DI.startTest(S, kind, id); if (m) console.log('   test refused:', kind, m); S.warp(kind === 'leak' ? 86500 : kind === 'run' ? 2000 : 420); if (sol.after) sol.after(S, kind, id); }
  if (sol.post) sol.post(S);
  if (sc.tick) sc.tick(S);
  const ok = DI.botCheck(S, sc);
  console.log(sc.id, sc.name, 'goals', ok.map((v) => (v ? 'Y' : 'n')).join(''));
  ok.forEach((v, i) => { if (!v) { fail++; console.log('   UNMET:', sc.goals[i].t); } });
  for (const f of S.rv) if (f.sev !== 'ok') console.log('   ' + f.sev + ': ' + f.text.slice(0, 110));
  for (const [id, c] of S.calc) console.log('   calc #' + id, c.ok ? (c.pass ? 'PASS' : 'FAIL') + ' minQ ' + c.minQ.toFixed(1) + '/' + c.need + ' total ' + c.total.toFixed(0) + ' gpm @ ' + c.pRiser.toFixed(0) + ' psi' : c.err);
  for (const r of S.results) console.log('   ' + (r.pass ? 'PASS ' : 'FAIL ') + r.title + ': ' + r.lines.join(' | '));
  if (sc.drill) {
    DI.startDrill(S, sc.drill); let guard = 0;
    while (!S.drill.done && guard++ < 400000) { S.step(S.fires.length || S.outFlow > 1 ? 0.25 : 1); DI.drillStep(S); if (sol.ops) sol.ops(S); }
    const r = S.drill.result; if (!r || !r.pass) fail++;
    console.log('   DRILL', r && r.pass ? 'PASS' : 'FAIL', r ? r.lines.join(' | ') : 'timeout', '| fire', DI.money(S.stats.fireLoss), 'water', DI.money(S.stats.waterLoss), 'smoke', DI.money(S.stats.smokeLoss), '| spent', DI.money(sc.money - W.money));
  }
}
console.log(fail ? fail + ' FAILED' : 'campaign ok'); process.exit(fail ? 1 : 0);
