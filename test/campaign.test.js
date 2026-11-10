// node test/campaign.test.js [id]  - plays each contract headlessly with a reference solution: goals, then the drill.
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3']) require('../src/' + f + '.js');
require('./bot.js'); const DI = globalThis.DI; let fail = 0;
const only = process.argv[2];
// build the reference solution and run its commissioning tests; `cfg` adds site settings for a what-if run
const play = (sc, cfg) => {
  const { W, S } = DI.buildScenario(sc, cfg);
  const sol = DI.botBuild(S, sc.id); if (sol.pre) sol.pre(S);
  S.warp(sol.settle || 120);
  for (const [kind, id] of sol.tests || []) { const m = DI.startTest(S, kind, id); if (m) console.log('   test refused:', kind, m); S.warp(kind === 'leak' ? 86500 : kind === 'run' ? 2000 : 420); if (sol.after) sol.after(S, kind, id); }
  if (sol.post) sol.post(S);
  if (sc.tick) sc.tick(S);
  return { W, S, sol };
};
for (const sc of DI.SCEN) {
  if (!DI.BOT[sc.id] || (only && only !== sc.id)) continue;
  const { W, S, sol } = play(sc);
  const ok = DI.botCheck(S, sc);
  console.log(sc.id, sc.name, 'goals', ok.map((v) => (v ? 'Y' : 'n')).join(''));
  ok.forEach((v, i) => { if (!v) { fail++; console.log('   UNMET:', sc.goals[i].t); } });
  for (const f of S.rv) if (f.sev !== 'ok') console.log('   ' + f.sev + ': ' + f.text.slice(0, 110));
  for (const [id, c] of S.calc) console.log('   calc #' + id, c.ok ? c.verdict + ' minQ ' + c.minQ.toFixed(1) + '/' + c.need + ' total ' + c.total.toFixed(0) + ' gpm @ ' + c.pRiser.toFixed(0) + ' psi' : c.err);
  for (const r of S.results) console.log('   ' + (r.pass ? 'PASS ' : 'FAIL ') + r.title + ': ' + r.lines.join(' | '));
  for (const id of S.sysd.info.keys()) { const r = DI.recoveryScore(S, id); if (r) console.log('   recovery #' + id + ': ' + r.done + '/' + r.total + (r.inOrder ? ' in order' : ' OUT OF ORDER') + (r.time !== null ? ' in ' + DI.dur(r.time) : '')); }
  if (sc.drill) {
    DI.startDrill(S, sc.drill); let guard = 0;
    while (!S.drill.done && guard++ < 400000) { S.step(S.fires.length || S.outFlow > 1 ? 0.25 : 1); DI.drillStep(S); if (sol.ops) sol.ops(S); }
    const r = S.drill.result; if (!r || !r.pass) fail++;
    console.log('   DRILL', r && r.pass ? 'PASS' : 'FAIL', r ? r.lines.join(' | ') : 'timeout', '| fire', DI.money(S.stats.fireLoss), 'water', DI.money(S.stats.waterLoss), 'smoke', DI.money(S.stats.smokeLoss), '| spent', DI.money(sc.money - W.money));
  }
}
// Informational only: the same reference builds with the insurer set to FM (30 s at any volume, NEEDS PE REVIEW).
// Contracts stay winnable because the default insurer is none; this prints which trip tests FM would fail.
if (!only) {
  console.log('what-if, insurer = FM (informational, not counted):');
  for (const sc of DI.SCEN) {
    if (!DI.BOT[sc.id] || !(DI.BOT[sc.id].toString().includes("'trip'"))) continue;
    const { S } = play(sc, { insurer: 'FM' });
    for (const r of S.results) if (r.kind === 'trip') console.log('   ' + sc.id + ' ' + (r.pass ? 'pass' : 'FAIL') + '  zone ' + DI.fmt(r.zone) + ' gal (pipe ' + DI.fmt(r.pipe) + ')  ' + DI.fmt(r.val, 1) + ' s  governing ' + r.by + ' ' + r.governing + ' s  margin ' + DI.fmt(r.margin, 1) + ' s');
  }
}
console.log(fail ? fail + ' FAILED' : 'campaign ok'); process.exit(fail ? 1 : 0);
