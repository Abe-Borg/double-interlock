// node test/puzzle.test.js [id]  - plays every field call (puzzle) variant headlessly.
// For each variant: the fault is real (the objective goals are not met after the player's proving steps), the cheap fix
// and the easily maintained fix both solve it, the edit count of each matches the comparison, the right diagnosis is
// accepted and a wrong one is counted, and a save / load keeps the puzzle state.
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'cause', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3', 'puz', 'puz1', 'puz2']) require('../src/' + f + '.js');
const DI = globalThis.DI; let fail = 0, n = 0;
const only = process.argv[2];
const ok = (name, cond, info) => { n++; if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  [' + info + ']' : '')); };
// what the slow loop of the game does: plan review and the hydraulic calcs
const look = (S) => { S.rv = DI.review(S); S.calc = new Map(); for (const [id, inf] of S.sysd.info) if (inf.nSpk) S.calc.set(id, DI.hydCalc(S, id)); };
const goals = (S, sc) => { look(S); return sc.goals.map((g) => { try { return !!g.ok(S); } catch (e) { return false; } }); };
const yn = (a) => a.map((v) => (v ? 'Y' : 'n')).join('');
const play = (id, vi, which) => {
  const r = DI.puzBuild(id, vi), { S, sc } = r, v = sc.v, sol = v[which];
  if (sol.edit) { sol.edit(S.W, DI.mk(S.W)); S.W.money -= DI.puzWorth(S.W) - DI.puzWorth(DI.puzStart(S)); S.sync(); }
  if (sol.op) sol.op(S);
  S.editT = S.t; DI.puzTick(S); S.warp(30); DI.puzTick(S);
  if (v.prove) v.prove(S);
  DI.puzTick(S);
  return r;
};

for (const pz of DI.PUZ) {
  if (only && only !== pz.id) continue;
  ok(pz.id + ' has 2 or 3 variants and the next number in order', pz.variants.length >= 2 && pz.variants.length <= 3 && pz.n === DI.PUZ.indexOf(pz) + 1, pz.variants.length);
  pz.variants.forEach((v, vi) => {
    const tag = pz.id + v.key + ' ' + pz.name + ' / ' + v.name;
    ok(tag + ': three graduated hints, one right diagnosis among at least three', v.hints.length === DI.PUZ_HINTS && v.diag.opts.length >= 3 && v.diag.opts.filter((o) => o[1]).length === 1);
    // 1. the fault is real
    const b = DI.puzBuild(pz.id, vi), S = b.S, sc = b.sc, nObj = sc.goals.length - 1;
    ok(tag + ': the starting layout counts 0 edits', DI.puzDiff(DI.puzStart(S), S.W).n === 0);
    if (v.prove) v.prove(S); DI.puzTick(S);
    const g0 = goals(S, sc);
    ok(tag + ': broken at the start (objective goals not all met after the proving steps)', g0.slice(0, nObj).some((x) => !x), yn(g0));
    ok(tag + ': the diagnosis goal is open until answered', g0[nObj] === false);
    // a wrong pick is counted, the right one is accepted
    const wrong = v.diag.opts.findIndex((o) => !o[1]), right = v.diag.opts.findIndex((o) => o[1]);
    const w = DI.puzDiagnose(S, wrong), rr = DI.puzDiagnose(S, right);
    ok(tag + ': a wrong diagnosis is answered and counted, the right one closes it', w && !w.ok && rr && rr.ok && S.puz.diag.tries === 2 && S.puz.diag.ok);
    // 2. both fixes solve it
    for (const which of ['cheap', 'maint']) {
      const p = play(pz.id, vi, which), cmp = DI.puzSolution(p.S, which), gs = goals(p.S, p.sc);
      ok(tag + ': the ' + which + ' fix meets every objective goal', gs.slice(0, nObj).every(Boolean), yn(gs));
      DI.puzDiagnose(p.S, right);
      ok(tag + ': ' + which + ' fix + the right diagnosis = every goal', goals(p.S, p.sc).every(Boolean));
      const d = DI.puzDiff(DI.puzStart(p.S), p.S.W);
      ok(tag + ': the ' + which + ' fix counts the edits the comparison shows', d.n === cmp.diff.n, d.n + ' / ' + cmp.diff.n + ' ' + d.items.map((i) => i.what).join('; '));
      const sc2 = DI.puzScore(p.S);
      if (which === 'cheap') ok(tag + ': the cheap fix earns the edit and cost star', sc2.lines[0][0] && sc2.lines[1][0], sc2.lines.map((l) => l[1]).join(' | '));
      else ok(tag + ': the maintained fix does more than the cheap one (edits, cost or steps)', cmp.diff.n > DI.puzPar(p.S).edits || cmp.cost > DI.puzPar(p.S).cost || v.maint.steps.join() !== v.cheap.steps.join(), cmp.diff.n + ' edits ' + DI.money(cmp.cost));
    }
  });
}
// save / load keeps the puzzle state, and the starting layout is not saved twice
if (!only || only === 'p1') {
  const { S } = DI.puzBuild('p1', 0); DI.puzHint(S); DI.puzDiagnose(S, 0); S.puz.imp = 42;
  const sv = JSON.parse(JSON.stringify({ world: S.W.toJSON(), sim: S.dump(), puz: DI.puzSave(S) }));
  DI.puzStart(S); DI.puzPar(S);
  ok('save: no cached layout or par in the saved puzzle state', !('_w0' in DI.puzSave(S)) && !('_par' in DI.puzSave(S)));
  const W2 = DI.World.fromJSON(sv.world), S2 = new DI.Sim(W2); S2.restore(sv.sim); DI.puzLoad(S2, sv.puz);
  ok('save / load keeps hints, diagnosis tries and the out-of-service clock', S2.puz.hints === 1 && S2.puz.diag.tries === 1 && S2.puz.imp === 42 && DI.puzDiff(DI.puzStart(S2), S2.W).n === 0);
}
// the diff: a part dropped into a pipe run is one edit; a wire is one; a setting is one; an operation is none
{
  const { S } = DI.puzBuild('p1', 0), W = S.W, W0 = DI.puzStart(S);
  W.erasePipe(18, 12); W.addPart('gate', 18, 12, 0); W.ver++;
  ok('diff: a valve dropped into a pipe run is one edit', DI.puzDiff(W0, W).n === 1);
  W.wire(W.byType('panel')[0].id, W.at(18, 12).id); ok('diff: its wire is one more', DI.puzDiff(W0, W).n === 2);
  W.byType('jockey')[0].p.start = 110; ok('diff: a jockey setting is one more', DI.puzDiff(W0, W).n === 3);
  W.at(18, 12).p.target = 0; W.byType('epump')[0].p.mode = 'off'; ok('diff: closing a valve or a pump mode is operation, not an edit', DI.puzDiff(W0, W).n === 3);
  W.spk[W.k(30, 8)] = 3; ok('diff: a broken head is still a head', DI.puzDiff(W0, W).n === 3);
}
// thirty quiet minutes means thirty minutes with the fire pump stopped: letting it run half an hour and then stopping it
// by hand does not count (DI.quietFor reads the pump's last run as well as its last automatic start)
if (!only || only === 'p7') {
  const { S, sc } = DI.puzBuild('p7', 0), v = sc.v; v.cheap.edit(S.W, DI.mk(S.W)); S.sync(); S.warp(1900);
  const fp = S.W.byType('epump')[0], ran = fp.p.spd > 0.9; fp.p.on = false; S.warp(20);
  ok('quiet: a fire pump stopped by hand after running half an hour is not a quiet half hour', ran && !DI.PZ.sleeps(S) && DI.quietFor(S) < 60, DI.fmt(DI.quietFor(S)));
  S.warp(1800); ok('quiet: thirty minutes after it stopped, it is', DI.PZ.sleeps(S));
  // a save and load while the pump runs stops it (the settle does), but the clock still starts from that moment
  const b = DI.puzBuild('p7', 0); b.sc.v.cheap.edit(b.S.W, DI.mk(b.S.W)); b.S.sync(); b.S.warp(2600 - b.S.t);
  const ran2 = b.S.W.byType('epump')[0].p.spd > 0.9, sv = JSON.parse(JSON.stringify({ world: b.S.W.toJSON(), sim: b.S.dump(), puz: DI.puzSave(b.S) }));
  const W2 = DI.World.fromJSON(sv.world), S2 = new DI.Sim(W2); S2.restore(sv.sim); DI.puzLoad(S2, sv.puz);
  ok('quiet: a save and load while the fire pump runs does not count the running time as quiet', ran2 && !DI.PZ.sleeps(S2) && DI.quietFor(S2) < 60 && S2.lastAuto === b.S.lastAuto, DI.fmt(DI.quietFor(S2)) + ' s, lastAuto ' + S2.lastAuto);
  S2.warp(1850); ok('quiet: thirty minutes after the load, it is', DI.PZ.sleeps(S2));
}
// a panel reset is judged when it is made: reset while paused, then clear the cause, and the reset still counts as made
// while the cause was live (call 8, variant B: the manual station)
if (!only || only === 'p8') {
  const { S } = DI.puzBuild('p8', 1); DI.panelReset(S, S.W.byType('panel')[0].id); S.W.byType('mstn')[0].p.on = false; DI.puzTick(S);
  ok('resets: a reset made before the station is reset counts as made while the cause was live, paused or not', S.puz.resets === 1 && S.puz.futile === 1, S.puz.resets + ' / ' + S.puz.futile);
  DI.panelReset(S, S.W.byType('panel')[0].id); DI.puzTick(S);
  ok('resets: the reset after the cause is cleared does not', S.puz.resets === 2 && S.puz.futile === 1);
}
console.log(fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' puzzle checks passed'); process.exit(fail ? 1 : 0);
