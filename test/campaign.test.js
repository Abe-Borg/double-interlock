// node test/campaign.test.js [id]  - plays each contract headlessly with a reference solution: goals, then the drill.
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'cause', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3']) require('../src/' + f + '.js');
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
  // Contract 6 opens on a leaking zone: its first 24 h air test is the baseline and is expected to fail. It is
  // labelled as such and asserted, so a real failure cannot hide behind it: an unexpected PASS, or a failed
  // re-test after the repair, fails the campaign.
  const leaks = S.results.filter((r) => r.kind === 'leak'), baseline = sc.id === 'c6' ? leaks[0] : null;
  if (sc.id === 'c6') {
    const again = leaks[leaks.length - 1];
    if (!baseline || baseline.pass || !(baseline.end < DI.AIR_TEST.endMin)) { fail++; console.log('   UNEXPECTED: the c6 baseline air test should FAIL with an end reading below ' + DI.AIR_TEST.endMin + ' psi'); }
    if (leaks.length < 2 || !again.pass) { fail++; console.log('   UNEXPECTED: the c6 air test after the repair should PASS'); }
  }
  if (sc.id === 'c5' && sc.goals.length !== 6) { fail++; console.log('   UNEXPECTED: contract 5 should have six goals'); }
  for (const r of S.results) console.log('   ' + (r === baseline ? 'EXPECTED baseline FAIL (leaking zone, before the repair) ' : r.pass ? 'PASS ' : 'FAIL ') + r.title + ': ' + r.lines.join(' | '));
  // recoveries after the commissioning tests are practice: printed, never counted. Only the c5 drill incident is scored.
  for (const id of S.sysd.info.keys()) { const r = DI.recoveryScore(S, id); if (r) console.log('   recovery #' + id + (sc.id === 'c6' ? ' (not scored in c6): ' : ' (practice): ') + r.done + '/' + r.total + (r.inOrder ? ' in order' : ' OUT OF ORDER') + (r.time !== null ? ' in ' + DI.dur(r.time) + ', of which air refill ' + DI.dur(r.refill) : '')); }
  if (sc.drill) {
    DI.startDrill(S, sc.drill); let guard = 0;
    while (!S.drill.done && guard++ < 400000) { S.step(S.fires.length || S.outFlow > 1 ? 0.25 : 1); DI.drillStep(S); if (sol.ops) sol.ops(S); }
    const r = S.drill.result; if (!r || !r.pass) fail++;
    if (sc.id === 'c5') {      // the one scored recovery: the drill's broken-sprinkler incident, 13 of 13 in order by the reference operator
      const a = S.acts.find((q) => q.kind === 'incident' && q.t >= S.drill.t0), q = a && DI.recoveryScore(S, a.id, S.drill.t0);
      if (!q || !q.complete || !q.inOrder || q.total !== 13) { fail++; console.log('   UNEXPECTED: the c5 drill recovery should be 13 of 13 in order'); }
      else console.log('   drill recovery #' + a.id + ' (scored): ' + q.done + '/' + q.total + ' in order; operator steps ' + Math.round(q.opTime) + ' s (informational target ' + DI.RECOVERY_TARGET + ' s' + (q.opTime > DI.RECOVERY_TARGET ? ', MISSED by the reference operator' : ', met') +
        '), recovery rating ' + DI.recoveryTier(q) + ' of 3 stars, air refill ' + DI.dur(q.refill) + ' of the ' + DI.REFILL_LIMIT / 60 + ' min limit (' + (q.refill <= DI.REFILL_LIMIT ? 'OK' : 'over, informational') + '), total ' + DI.dur(q.time) + ' (' + Math.round(q.time) + ' s)');
      // Cycle 5: the report carries the recovery rating and the Tutor's refill wording, and never the word FAIL
      if (!r || !r.lines.some((l) => l.includes('Recovery rating:')) || r.lines.some((l) => /FAIL|Time bonus/.test(l))) { fail++; console.log('   UNEXPECTED: the c5 drill report should carry "Recovery rating:" and no FAIL'); }
    }
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
