// node test/puzzle.test.js [id]  - plays every field call (puzzle) variant headlessly, the find-the-fault calls (1-8) and
// the design calls (9-16). For each variant: the fault is real (the objective goals are not met after the player's
// proving steps), the cheap fix and the easily maintained fix both solve it, the edit count of each matches the
// comparison, the right diagnosis (a design call's answer) is accepted and a wrong one is counted, and a save / load keeps
// the puzzle state. Then the design-call machinery: part limits, salvage, pipe reuse, independent isolation and the calc
// at the most demanding area.
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'cause', 'sim', 'calc', 'review', 'proc', 'scen', 'scen1', 'scen2', 'scen3', 'puz', 'puz1', 'puz2', 'puz3', 'puz4']) require('../src/' + f + '.js');
const DI = globalThis.DI; let fail = 0, n = 0;
const only = process.argv[2];
const ok = (name, cond, info) => { n++; if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  [' + info + ']' : '')); };
// what the slow loop of the game does: plan review and the hydraulic calcs
const look = (S) => { S.rv = DI.review(S); S.calc = new Map(); for (const [id, inf] of S.sysd.info) if (inf.nSpk) S.calc.set(id, DI.hydCalc(S, id)); };
const goals = (S, sc) => { look(S); return sc.goals.map((g) => { try { return !!g.ok(S); } catch (e) { return false; } }); };
const yn = (a) => a.map((v) => (v ? 'Y' : 'n')).join('');
const play = (id, vi, which) => {
  const r = DI.puzBuild(id, vi), { S, sc } = r, v = sc.v, sol = v[which];
  if (sol.edit) { sol.edit(S.W, DI.mk(S.W)); S.W.money -= DI.puzCost(DI.puzStart(S), S.W, v.salvage); S.sync(); }
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
    if (pz.design) ok(tag + ': a design call shows its constraints and its decision in the briefing, and names the ideas it builds on', Array.isArray(v.constraints) && v.constraints.length > 0 && typeof v.decision === 'string' && v.decision.length > 40 && Array.isArray(pz.builds) && pz.builds.length > 0);
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
      // whatever the fix places, and the wire or air tool it needs, is on the call's toolbar
      { const W0 = DI.puzStart(p.S), W1 = cmp.W, parts = p.sc.parts, at = (WW, q) => WW.parts.get(WW.partAt[WW.k(q.x, q.y)]);
        const placed = [...W1.parts.values()].filter((q) => { const o = at(W0, q); return !o || o.id !== q.id; }).map((q) => q.type);
        const wired = W1.wires.length > W0.wires.length || W1.wires.some(([a, b]) => !W0.wires.some(([c, d]) => c === a && d === b)), aired = W1.air.some((x, k) => x && !W0.air[k]);
        const miss = placed.filter((t) => !parts.includes(t)).concat(wired && !parts.includes('panel') ? ['the wire tool'] : [], aired && !parts.some((t) => t === 'comp' || t === 'n2') ? ['the air tool'] : []);
        ok(tag + ': the ' + which + ' fix needs nothing the toolbar does not offer', miss.length === 0, miss.join(', ') || undefined); }
      const d = DI.puzDiff(DI.puzStart(p.S), p.S.W);
      ok(tag + ': the ' + which + ' fix counts the edits the comparison shows', d.n === cmp.diff.n, d.n + ' / ' + cmp.diff.n + ' ' + d.items.map((i) => i.what).join('; '));
      const sc2 = DI.puzScore(p.S);
      if (which === 'cheap') ok(tag + ': the cheap fix earns the edit and cost star' + (v.reuse ? ' and keeps the par pipe' : ''), sc2.lines[0][0] && sc2.lines[1][0] && (!v.reuse || sc2.lines[2][0]), sc2.lines.map((l) => l[1]).join(' | '));
      if (which === 'cheap') ok(tag + ': the cheap fix spends within the budget', DI.puzCost(DI.puzStart(p.S), p.S.W, v.salvage) <= v.money, DI.money(DI.puzCost(DI.puzStart(p.S), p.S.W, v.salvage)) + ' of ' + DI.money(v.money));
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

// ---------- design-call machinery
if (!only || only === 'p11') {
  // part limits: refused at the build tools at the limit, and a goal that fails over it
  const { S, sc } = DI.puzBuild('p11', 0), W = S.W, b = DI.mk(W);
  ok('limits: below the limit the tools allow a preaction valve', DI.puzLimit(S, 'prev') === '' && DI.puzLimit(S, 'gate') === '');
  b.p('prev', 7, 6, 0); b.p('prev', 7, 17, 0); W.ver++;
  ok('limits: at three preaction valves the tools refuse a fourth, and say why', /at most 3 preaction valves/.test(DI.puzLimit(S, 'prev')) && /at most 1 air compressor/.test(DI.puzLimit(S, 'comp')));
  const lim = sc.goals.find((g) => /^Within the limits/.test(g.t)); b.p('prev', 7, 8, 0); W.ver++;
  ok('limits: a layout over the limit fails the limits goal', !!lim && !lim.ok(S) && DI.puzOverLimit(W, sc.v.limits).join() === 'prev');
}
if (!only || only === 'p14') {
  // salvage 0: inherited pipe, heads and parts refund nothing; what the player laid refunds in full
  const { S } = DI.puzBuild('p14', 0), W = S.W, k = W.k(8, 12);
  ok('salvage: an inherited pipe tile refunds nothing, an inherited head nothing, an inherited riser nothing', DI.puzSalv(S) === 0 && DI.puzTileRefund(S, 8, 12) === 0 && DI.puzTileRefund(S, 20, 5) === 0 && DI.puzPartRefund(S, W.at(3, 12)) === 0);
  W.pd[k] = 7; W.ver++;
  ok('salvage: a tile the player resized refunds its new pipe in full', DI.puzPipeCredit(S, k) === DI.pipeAt(W, k).cost && DI.puzTileRefund(S, 8, 12) === DI.pipeAt(W, k).cost);
  const W0 = DI.puzStart(S), W1 = DI.puzWorld(S.puz.w0); W1.erasePipe(8, 12); W1.ver++;
  ok('salvage: DI.puzCost of erasing inherited pipe is nothing back, and of replacing it the full new price', DI.puzCost(W0, W1, 0) === 0 && (W1.setPipe(8, 12, 6, 0), DI.puzCost(W0, W1, 0) === DI.PIPES[6].cost) && DI.puzCost(W0, W1, 1) === DI.PIPES[6].cost - DI.PIPES[4].cost);
  const W2 = DI.puzWorld(S.puz.w0); W2.pk[W2.k(20, 5)] = 0; W2.ver++;
  ok('salvage: a branch tile laid as a main at its own size costs nothing (tees, not pipe) and is still kept pipe', DI.puzCost(W0, W2, 0) === 0 && DI.puzReuse(W0, W2).kept === DI.puzReuse(W0, W2).total);
  // reuse: the whole feed replaced keeps fewer tiles than the cheap fix, and loses the edit star
  const p = play('p14', 0, 'maint'), r = DI.puzScore(p.S);
  ok('reuse: replacing the whole feed main keeps fewer starting tiles than the cheap fix, and the scorecard says so', r.reuse && r.reuse.kept < r.par.reuse && r.lines.some((l) => /^Starting pipe kept: \d+ of \d+ tiles/.test(l[1]) && !l[0]), r.lines.map((l) => l[1]).join(' | '));
}
if (!only || only === 'p10' || only === 'p13') {
  // independent isolation: one control valve for two risers fails, one each passes; a valve on the trunk fails
  const a = DI.puzBuild('p10', 0), cheap = DI.puzSolution(a.S, 'cheap'), maint = DI.puzSolution(a.S, 'maint');
  const S1 = new DI.Sim(cheap.W), S2 = new DI.Sim(maint.W); S1.commission(); S2.commission();
  ok('isolation: two risers behind one control valve are not independently isolated; a control valve each is', DI.PZ.notIsolated(S1).length === 2 && DI.PZ.notIsolated(S2).length === 0);
  const g = DI.puzBuild('p13', 0), s13 = DI.puzSolution(g.S, 'cheap'), W = s13.W; W.removePart(W.at(19, 12).id); W.setPipe(19, 12, 6, 0); W.ver++;
  const S3 = new DI.Sim(W); S3.commission();
  ok('isolation: a riser with no control valve of its own is isolated only by the supply valve, which shuts every room', DI.PZ.notIsolated(S3).map((v) => v.x + ',' + v.y).join() === '19,11' && DI.puzScenario('p13', 0).goals[2].ok(S3) === false);
}
if (!only || only === 'p9') {
  // the most demanding area: strengthening only the two farthest lines passes the farthest-area calc, not this one
  const { S } = DI.puzBuild('p9', 1), W = S.W, id = W.byType('wetv')[0].id;
  for (const y of [3, 4]) for (let x = 16; x <= 40; x++) { const k = W.k(x, y); if (W.pd[k] && W.pk[k]) W.pd[k] = 4; }
  W.ver++; S.sync();
  const far = DI.hydCalc(S, id), all = DI.PZ.calcAll(S, id);
  ok('calc: upsizing only the farthest lines passes the farthest area and fails the most demanding one', far.ok && far.pass && all.ok && !all.pass && all.areas > 20, DI.fmt(far.margin * 100) + ' / ' + DI.fmt(all.margin * 100) + ' over ' + all.areas + ' areas');
  // (Codex review on the PR: the count of areas checked once overwrote `n`, so the riser's calc read 32 sprinklers for a
  // 15-head area on call 15 A)
  { const p = play('p15', 0, 'cheap'), id15 = p.S.W.byType('wetv')[0].id, c = DI.PZ.calcAll(p.S, id15);
    ok('calc: the worst-area result keeps the design area\'s sprinkler count in n and the areas checked in areas', c.ok && c.n === c.tiles.length && c.n === DI.hydCalc(p.S, id15).n && c.areas > 1, c.n + ' sprinklers, ' + c.tiles.length + ' tiles, ' + c.areas + ' areas'); }
  ok('calc: the result is cached on the layout and recomputed after an edit', DI.PZ.calcAll(S, id) === all && (W.ver++, DI.PZ.calcAll(S, id) !== all));
}
{
  // the scorecard of a design call: Answer, not Diagnosis; no out-of-service line where impairment is not scored
  const p = play('p12', 0, 'cheap'); DI.puzDiagnose(p.S, p.sc.v.diag.opts.findIndex((o) => o[1])); const r = DI.puzScore(p.S);
  ok('design scorecard: the answer line, the pipe kept, no out-of-service line, three stars for the cheap fix answered first time', r.stars === 3 && r.lines.some((l) => /^Answer: right the first time/.test(l[1])) && r.lines.some((l) => /^Starting pipe kept: 390 of 390/.test(l[1])) && !r.lines.some((l) => /Out of service/.test(l[1])), r.lines.map((l) => l[1]).join(' | '));
  ok('design calls: eight of them, numbered 9 to 16, after the eight find-the-fault calls', DI.PUZ.filter((q) => q.design).map((q) => q.n).join() === '9,10,11,12,13,14,15,16' && DI.PUZ.filter((q) => !q.design).length === 8);
}
console.log(fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' puzzle checks passed'); process.exit(fail ? 1 : 0);
