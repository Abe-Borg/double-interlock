// Field calls: small puzzles on the live simulation. Engine side (no DOM), so the tests can play them under Node.
// Calls 1-8 (puz1.js, puz2.js) are find-the-fault calls: an existing installation, a symptom, a small repair budget and
// one central question. Calls 9-16 (puz3.js, puz4.js) are design calls (`design: true`): a hard constraint and one
// decision, both shown in the briefing before anything is built. The live plant is the same simulation as the
// contracts: nothing here changes how water, air or the panel behave.
//
//   DI.PUZ            the puzzle list: { id, n, name, kind, design?, builds?, question, learn, w, h, parts, variants: [...] }
//   variant           { key, name, money, symptom, records, build(W, b), setup(S), area, hints, diag, goals,
//                       cheap, maint, live, impPar, cfg, kind?,
//                       design calls: constraints [text], decision text, limits { partType: max }, salvage (0..1,
//                       default 1: what removing starting material refunds), reuse (score the starting pipe kept),
//                       editSlack (fraction over the cheap fix's edits that still earns the star) }
//   DI.puzScenario    one variant as a scenario object (the shape main.js and DI.buildScenario expect)
//   S.puz             the running puzzle's state: the starting layout (w0), hints shown, diagnosis tries, the
//                     out-of-service clock and the resets made while the cause was still live. It is saved beside
//                     the world and the sim (main.js), never inside Sim.dump.
//   DI.puzDiff        the edits between the starting layout and now: what "fewest edits" counts
//   DI.puzCost        what a layout change costs, with the variant's salvage rule
//   DI.puzScore       the scorecard and the stars
//   DI.puzSolution    the cheap and the easily maintained fix, applied to a copy of the starting layout, for the
//                     comparison after the puzzle (and for the tests, which play both)
var DI = globalThis.DI || (globalThis.DI = {});

DI.PUZ = [];
DI.PUZ_HINTS = 3;                 // graduated hints: the system, a measurement, the fault
DI.PUZ_IMP_PAR = 1800;            // default out-of-service par, seconds of game time (ASSUMED, a game value)
DI.PUZ_COST_SLACK = 0.1;          // the cost line passes within 10 % of the cheapest fix (ASSUMED, a game value)
// Design settings: a change to one of these on a part is an edit. Everything else on a part is operation (a valve
// position, a pump's mode, a running flag) and is never counted.
DI.PUZ_KEYS = {
  epump: ['gpm', 'psi', 'start', 'emerg'], dpump: ['gpm', 'psi', 'start'], jockey: ['psi', 'start', 'stop'], tank: ['cap'],
  comp: ['scfm', 'cutOut', 'maxPsi', 'relief'], n2: ['scfm'], dryv: ['qod', 'airSet', 'hiAir', 'loAir', 'avc', 'avcTamper'],
  prev: ['trim', 'airSet', 'hiAir', 'loAir', 'pTrip', 'avc', 'avcTamper', 'vent'], panel: ['ah', 'chgA'],
};
// What the layout is worth at installed cost (the same prices the build tools charge and refund).
DI.puzWorth = function (W) {
  let c = 0;
  for (let k = 0; k < W.pd.length; k++) { if (W.pd[k]) c += DI.pipeAt(W, k).cost + (W.spk[k] ? DI.SPK_COST : 0); if (W.air[k]) c += 25; }
  for (const p of W.parts.values()) if (!p.p.fixed) c += DI.partCost(p.type, p.p) + (p.p.vent ? 3200 : 0);
  return c;
};
DI.puzSnap = (W) => JSON.stringify(W.toJSON());
// (World.fromJSON does not carry a room's `exempt` flag: main.js copies it on a load, and so does this)
DI.puzWorld = (snap) => { const j = JSON.parse(snap), W = DI.World.fromJSON(j); for (const r of W.rooms) { const o = j.rooms.find((q) => q.id === r.id); if (o && o.exempt) r.exempt = true; } return W; };

// The edits between two layouts, one per changed thing: a pipe tile (added, removed, resized, re-oriented, a head
// added or removed), a capped joint, a tile of air tubing, a part (added, removed, replaced, turned end for end, or
// a design setting changed) and a wire. A tile that holds a part in either layout is judged as a part only, so
// dropping a valve into a pipe run is one edit. A sprinkler that operated (fused or broken) is still a sprinkler.
DI.puzDiff = function (W0, W) {
  const items = [], tiles = new Set(), w = W.w, xy = (k) => [k % w, (k / w) | 0];
  const add = (k, what) => { const [x, y] = xy(k); items.push({ x, y, k, what }); tiles.add(k); };
  for (let k = 0; k < W.pd.length; k++) {
    if (W0.partAt[k] || W.partAt[k]) continue;
    const a = W0.pd[k], b = W.pd[k];
    if (a !== b || (a && (W0.pk[k] !== W.pk[k] || (W0.spk[k] > 0) !== (W.spk[k] > 0))))
      add(k, !a ? 'pipe added' : !b ? 'pipe removed' : a !== b ? 'pipe resized ' + DI.PIPES[a - 1].n + ' to ' + DI.PIPES[b - 1].n : W0.pk[k] !== W.pk[k] ? 'branch line re-laid' : W.spk[k] ? 'sprinkler added' : 'sprinkler removed');
    if (W0.air[k] !== W.air[k]) add(k, W.air[k] ? 'air tubing added' : 'air tubing removed');
    if (W0.cut[k * 2] !== W.cut[k * 2]) add(k, W.cut[k * 2] ? 'joint capped' : 'cap removed');
    if (W0.cut[k * 2 + 1] !== W.cut[k * 2 + 1]) add(k, W.cut[k * 2 + 1] ? 'joint capped' : 'cap removed');
  }
  for (let k = 0; k < W.pd.length; k++) if (W0.partAt[k] || W.partAt[k]) {
    // caps and tubing on a part's tile still count
    if (W0.air[k] !== W.air[k]) add(k, W.air[k] ? 'air tubing added' : 'air tubing removed');
    if (W0.cut[k * 2] !== W.cut[k * 2] || W0.cut[k * 2 + 1] !== W.cut[k * 2 + 1]) add(k, 'cap changed');
  }
  const at = (WW, p) => WW.parts.get(WW.partAt[WW.k(p.x, p.y)]);
  const name = (p) => DI.PARTS[p.type].name.toLowerCase();
  for (const p of W0.parts.values()) {
    const q = at(W, p), k = W.k(p.x, p.y);
    if (!q) { add(k, name(p) + ' removed'); continue; }
    if (q.type !== p.type) { add(k, name(p) + ' replaced by ' + name(q)); continue; }
    if (q.rot !== p.rot) { add(k, name(p) + ' turned'); continue; }
    const keys = DI.PUZ_KEYS[p.type] || [];
    const ch = keys.filter((key) => JSON.stringify(p.p[key]) !== JSON.stringify(q.p[key]));
    if (ch.length) add(k, name(p) + ' setting changed (' + ch.join(', ') + ')');
  }
  for (const q of W.parts.values()) if (!at(W0, q)) add(W.k(q.x, q.y), name(q) + ' added');
  // wires are compared by the tiles of the panel and the device, so a part put back where it was keeps its wire
  const wset = (WW) => new Set(WW.wires.map(([a, b]) => { const pa = WW.parts.get(a), pb = WW.parts.get(b); return pa && pb ? pa.x + ',' + pa.y + '>' + pb.x + ',' + pb.y : ''; }).filter(Boolean));
  const w0 = wset(W0), w1 = wset(W);
  for (const s of w1) if (!w0.has(s)) { const [x, y] = s.split('>')[1].split(',').map(Number); add(W.k(x, y), 'wire added'); }
  for (const s of w0) if (!w1.has(s)) { const [x, y] = s.split('>')[1].split(',').map(Number); add(W.k(x, y), 'wire removed'); }
  return { n: items.length, items, tiles };
};

// ---------- design-call constraints
// Part limits: { type: max } counts every part of that type in the layout, the starting ones included. The build tools
// refuse a part over the limit (DI.puzLimit, input.js) and a goal checks it (DI.puzScenario).
DI.puzLimitText = (lim) => Object.keys(lim).map((t) => 'at most ' + lim[t] + ' ' + DI.PARTS[t].name.toLowerCase() + (lim[t] === 1 ? '' : 's')).join(', ');
DI.puzOverLimit = (W, lim) => Object.keys(lim || {}).filter((t) => W.byType(t).length > lim[t]);
DI.puzLimit = function (S, type) {
  const v = S && S.puz && DI.puzVariant(S), lim = v && v.limits; if (!lim || !(type in lim)) return '';
  return S.W.byType(type).length >= lim[type] ? 'Constraint of this call: ' + DI.puzLimitText({ [type]: lim[type] }) + '. Remove one first, or rethink the arrangement.' : '';
};
// Salvage: what removing starting material refunds, as a fraction of its installed cost (variant.salvage, default 1).
// 0 = inherited material has no resale value: erasing, resizing or replacing it refunds nothing. Only material that is
// still as it was at the start counts as inherited; what the player laid during the call refunds in full as always.
DI.puzSalv = (S) => { const v = S && S.puz && DI.puzVariant(S); return v && v.salvage !== undefined ? v.salvage : 1; };
DI.puzOrigPipe = (W0, W, k) => !!W0.pd[k] && W0.pd[k] === W.pd[k] && !W0.partAt[k];
DI.puzOrigPart = (W0, p) => { const q = W0.parts.get(W0.partAt[W0.k(p.x, p.y)]); return !!q && q.id === p.id && q.type === p.type; };
// the money back for the pipe alone on tile k (a resize keeps the head), for everything on a pipe tile (pipe, head,
// tubing), and for a part; in a contract (no puzzle) these are the plain installed costs
DI.puzPipeCredit = function (S, k) {
  const W = S.W; if (!W.pd[k]) return 0; const c = DI.pipeAt(W, k).cost, f = DI.puzSalv(S);
  return f < 1 && DI.puzOrigPipe(DI.puzStart(S), W, k) ? c * f : c;
};
DI.puzTileRefund = function (S, x, y) {
  const W = S.W, k = W.k(x, y), f = DI.puzSalv(S), W0 = f < 1 ? DI.puzStart(S) : null;
  let c = DI.puzPipeCredit(S, k);
  if (W.pd[k] && W.spk[k]) c += W0 && DI.puzOrigPipe(W0, W, k) && W0.spk[k] ? DI.SPK_COST * f : DI.SPK_COST;
  return c;
};
DI.puzHeadRefund = (S, k) => { const f = DI.puzSalv(S); return f < 1 && DI.puzOrigPipe(DI.puzStart(S), S.W, k) && DI.puzStart(S).spk[k] ? DI.SPK_COST * f : DI.SPK_COST; };
DI.puzAirRefund = (S, k) => { const f = DI.puzSalv(S); return f < 1 && DI.puzStart(S).air[k] ? 25 * f : 25; };
DI.partWorth = (p) => DI.partCost(p.type, p.p) + (p.p.vent ? 3200 : 0);
DI.puzPartRefund = function (S, p) { const f = DI.puzSalv(S), c = DI.partWorth(p); return f < 1 && DI.puzOrigPart(DI.puzStart(S), p) ? c * f : c; };
// a design setting changed on a part: a price difference d; downsizing an inherited part refunds only its salvage share
DI.puzReprice = (S, p, d) => (d < 0 && DI.puzSalv(S) < 1 && DI.puzOrigPart(DI.puzStart(S), p) ? d * DI.puzSalv(S) : d);

// What turning layout W0 into W1 costs, with salvage f: everything new at its installed price, everything of W0 that
// was taken away or replaced refunded at f. With f = 1 it is the difference in installed worth (DI.puzWorth). The build
// tools charge the same (input.js): a resize pays the new size and gets the old one back at f.
DI.puzCost = function (W0, W1, f) {
  if (f === undefined) f = 1;
  const pipe = (W, k) => (W.pd[k] ? DI.pipeAt(W, k).cost : 0);
  let c = 0;
  for (let k = 0; k < W1.pd.length; k++) {
    const p0 = W0.partAt[k] ? null : W0.pd[k], p1 = W1.partAt[k] ? null : W1.pd[k];
    // (a tile re-laid at the same size, a branch line made a main, costs nothing: it adds tees, not pipe)
    if (p0 !== p1) { c += p1 ? pipe(W1, k) : 0; c -= p0 ? pipe(W0, k) * f : 0; }
    // (a head is charged when it comes or goes; a resize keeps it, as the Main tool does)
    const h0 = !!(p0 && W0.spk[k]), h1 = !!(p1 && W1.spk[k]);
    if (h0 !== h1) c += h1 ? DI.SPK_COST : -DI.SPK_COST * f;
    if (W0.air[k] !== W1.air[k]) c += W1.air[k] ? 25 : -25 * f;
  }
  const at = (W, p) => W.parts.get(W.partAt[W.k(p.x, p.y)]);
  for (const p of W0.parts.values()) {
    if (p.p.fixed) continue; const q = at(W1, p);
    if (!q || q.id !== p.id || q.type !== p.type) c -= DI.partWorth(p) * f;
    else { const d = DI.partWorth(q) - DI.partWorth(p); c += d < 0 ? d * f : d; }
  }
  for (const q of W1.parts.values()) { if (q.p.fixed) continue; const p = at(W0, q); if (!p || p.id !== q.id || p.type !== q.type) c += DI.partWorth(q); }
  return Math.round(c);
};
// Pipe reuse: the pipe tiles of the starting layout still there at the same size (a resized or re-laid tile is new pipe)
DI.puzReuse = function (W0, W) {
  let total = 0, kept = 0;
  for (let k = 0; k < W0.pd.length; k++) if (W0.pd[k] && !W0.partAt[k]) { total++; if (W.pd[k] === W0.pd[k] && !W.partAt[k]) kept++; }
  return { kept, total };
};

// ---------- a variant as a scenario
DI.puzFind = (id) => DI.PUZ.find((p) => p.id === id) || null;
// the words of a call: a find-the-fault call is diagnosed, a design call is answered
DI.puzWords = (pz) => (pz && pz.design ? { call: 'Design call', ask: 'Answer', done: 'Answered', noun: 'Answer', head: 'THE ANSWER', pick: 'Pick the answer.', solved: 'Design accepted', what: 'THE ANSWER' }
  : { call: 'Field call', ask: 'Diagnose', done: 'Diagnosed', noun: 'Diagnosis', head: 'DIAGNOSIS', pick: 'Pick the fault.', solved: 'Fault found and fixed', what: 'THE FAULT' });
DI.puzScenario = function (id, vi) {
  const pz = DI.puzFind(id); if (!pz) return null;
  const i = DI.clamp(vi | 0, 0, pz.variants.length - 1), v = pz.variants[i];
  const diagGoal = pz.design ? { t: 'Answer the design question (Answer, on the top bar)', ok: (S) => !!(S.puz && S.puz.diag.ok), hint: 'The central question: ' + (v.diag.q || pz.question) }
    : { t: 'Name the fault (Diagnose, on the top bar)', ok: (S) => !!(S.puz && S.puz.diag.ok), hint: 'Answer the central question: ' + (v.diag.q || pz.question) };
  // a design call's part limits are a goal as well as a refusal at the build tools (DI.puzLimit), so a layout that got
  // past the tools another way (an undo, a test) is still judged against them
  const limGoal = v.limits ? [{ t: 'Within the limits: ' + DI.puzLimitText(v.limits), ok: (S) => DI.puzOverLimit(S.W, v.limits).length === 0, hint: 'Remove what is over the limit: ' + DI.puzLimitText(v.limits) + '.' }] : [];
  const sc = {
    id: pz.id, name: pz.name, tag: (pz.design ? 'Design call ' : 'Field call ') + pz.n + ' · ' + v.name, w: v.w || pz.w, h: v.h || pz.h, money: v.money, par: 0,
    parts: v.parts || pz.parts, brief: v.symptom, learn: pz.learn, cfg: v.cfg, drill: null, puzzle: true, pz, vi: i, v,
    build: (W) => v.build(W, DI.mk(W)), start: v.setup ? (S) => v.setup(S) : undefined,
    goals: v.goals.concat(limGoal, [diagGoal]), tick: (S) => DI.puzTick(S),
  };
  return sc;
};
// build a variant and start its puzzle state (the tests and main.js both use it)
DI.puzBuild = function (id, vi) { const sc = DI.puzScenario(id, vi); const { W, S } = DI.buildScenario(sc); DI.puzInit(S, sc); return { W, S, sc }; };

// ---------- the running puzzle
DI.puzInit = function (S, sc) {
  // the records of the call: fixed text, or read from the starting state (a baseline test the setup recorded)
  const v = sc.v, rec = typeof v.records === 'function' ? v.records(S) : v.records || [];
  S.puz = { id: sc.id, vi: sc.vi, t0: S.t, w0: DI.puzSnap(S.W), rec, money0: S.W.money, hints: 0, diag: { tries: 0, ok: false, picks: [] }, imp: 0, lastT: S.t, futile: 0, resets: 0, flags: {} };
  DI.puzActive = S; return S.puz;
};
// (the keys that start with _ are caches: the parsed starting layout and the par)
DI.puzSave = (S) => (S.puz ? JSON.parse(JSON.stringify(S.puz, (k, val) => (k[0] === '_' ? undefined : val))) : null);
DI.puzLoad = function (S, o) { S.puz = Object.assign({ flags: {}, diag: { tries: 0, ok: false, picks: [] } }, o); S.puz.lastT = S.t; DI.puzActive = S; return S.puz; };
DI.puzVariant = (S) => { const pz = S.puz && DI.puzFind(S.puz.id); return pz ? pz.variants[S.puz.vi] : null; };
DI.puzStart = (S) => (S.puz._w0 && S.puz._w0s === S.puz.w0 ? S.puz._w0 : (S.puz._w0s = S.puz.w0, S.puz._w0 = DI.puzWorld(S.puz.w0)));
DI.puzSpent = (S) => S.puz.money0 - S.W.money;

// What is out of service right now, as short phrases: a control valve not fully open, a fire pump out of AUTO (a pump
// on its own test is not counted), a dry or preaction zone that is not set and pressurized or has P latched, and an
// isolated air / N2 supply. Read by the out-of-service clock (limited impairment).
DI.puzImpaired = function (S) {
  const W = S.W, out = [], onTest = (id) => S.procs.some((p) => (p.kind === 'pump' || p.kind === 'run') && (p.id === id || (p.others || []).some(([o]) => o === id)));
  for (const p of W.parts.values()) {
    if (p.type === 'gate' && p.p.open < 0.99) out.push('control valve #' + p.id + ' not fully open');
    if ((p.type === 'epump' || p.type === 'dpump') && p.p.mode !== 'auto' && !onTest(p.id)) out.push('fire pump #' + p.id + ' not in AUTO');
  }
  for (const [id, s] of S.ss) { const v = W.parts.get(id), inf = S.sysd.info.get(id); if (!v || v.type === 'wetv') continue;
    if (s.state !== 'dry' || !s.set || (v.type === 'prev' && v.p.pLatch)) out.push(DI.sysName(S, id) + ' not in service');
    else if (inf && inf.src.length && !v.p.airValve && !S.procs.some((q) => q.kind === 'leak' && q.id === id)) out.push('air supply to ' + DI.sysName(S, id) + ' isolated'); }
  return out;
};
// Called after every batch of steps (main.js frame, the tests): the out-of-service clock and the variant's own watch.
// Panel resets are counted by the 'panelReset' handler below, when they are made.
DI.puzTick = function (S) {
  const pz = S.puz; if (!pz) return;
  const dt = S.t - pz.lastT; pz.lastT = S.t;
  if (dt > 0 && DI.puzImpaired(S).length) pz.imp += dt;
  const v = DI.puzVariant(S); if (!v) return;
  if (v.watch) v.watch(S, pz.flags);
};
// Every panel reset is counted at the moment it is made (alarm.js emits 'panelReset' at the end of DI.panelReset; a dead
// panel's refused reset emits nothing), and judged against the state of the plant then: the variant's `live` predicate.
// Counting here, not from the operator log in the next tick, matters while the game is paused: the frame loop does not
// tick then, and a player who resets, clears the cause and resumes still made a reset that could not hold.
DI.bus.on('panelReset', (S) => { const pz = S && S.puz; if (!pz) return; const v = DI.puzVariant(S); pz.resets++; if (v && v.live && v.live(S)) pz.futile++; });
// The supervising station got a new signal (alarm.js emits 'signal' when one first appears): a waterflow from the
// running puzzle that was transmitted at once is recorded, for the "the alarm reached the station" goals.
DI.bus.on('signal', (o) => { const S = DI.puzActive; if (!S || !S.puz || !o || !o.key || o.key.slice(0, 2) !== 'wf') return;
  if (o.mon && o.tx && !o.cut && !o.dark) { const f = S.puz.flags; (f.stn || (f.stn = {}))[o.part] = S.t; } });

// Graduated hints: the system, a measurement, then the fault. Returns the hint just shown, or null when all are out.
DI.puzHint = function (S) {
  const v = DI.puzVariant(S); if (!v || S.puz.hints >= v.hints.length) return null;
  return v.hints[S.puz.hints++];
};
// The diagnosis: one pick from the variant's options. A wrong pick is counted and answered with why it is not that.
DI.puzDiagnose = function (S, i) {
  const v = DI.puzVariant(S), o = v && v.diag.opts[i]; if (!o) return null;
  const d = S.puz.diag; if (d.ok) return { ok: true, why: o[2] };
  d.tries++; d.picks.push(i); if (o[1]) d.ok = true;
  S.say('Diagnosis: ' + o[0] + (o[1] ? ' - correct.' : ' - not the fault.'), o[1] ? 'good' : 'warn');
  return { ok: !!o[1], why: o[2] };
};

// ---------- solutions: the cheap fix and the easily maintained fix, on a copy of the starting layout
// sol = { t, steps: [text], edit(W, b), op(S) } (op runs on a live sim: the tests, never the comparison)
DI.puzSolution = function (S, which) {
  const v = DI.puzVariant(S), sol = v && v[which]; if (!sol) return null;
  const W0 = DI.puzStart(S), W1 = DI.puzWorld(S.puz.w0);
  if (sol.edit) sol.edit(W1, DI.mk(W1));
  return { sol, W: W1, diff: DI.puzDiff(W0, W1), cost: DI.puzCost(W0, W1, v.salvage), reuse: DI.puzReuse(W0, W1) };
};
// par = the cheap fix: its edits and its cost
DI.puzPar = function (S) {
  const pz = S.puz; if (pz._par) return pz._par;
  const c = DI.puzSolution(S, 'cheap'), v = DI.puzVariant(S);
  return (pz._par = { edits: c ? c.diff.n : 0, cost: c ? Math.max(0, c.cost) : 0, imp: v && v.impPar !== undefined ? v.impPar : DI.PUZ_IMP_PAR, reuse: c ? c.reuse.kept : 0 });
};
// The scorecard. [ok, text] lines; the stars: one for the fix (every goal, the diagnosis or answer included), one for
// fewest edits (plus the variant's slack) at no more than the cheap fix's cost and, where pipe kept is scored, keeping
// at least as much as the cheap fix, one for the diagnosis right the first time with at most one hint, no more
// out-of-service time than par (where it is scored) and no reset made while the cause was still live.
DI.puzScore = function (S) {
  const pz = S.puz, v = DI.puzVariant(S), par = DI.puzPar(S), W0 = DI.puzStart(S), d = DI.puzDiff(W0, S.W), spent = DI.puzSpent(S), design = !!DI.puzFind(pz.id).design;
  // a design call builds more, so its edit line may allow a slack over the cheap fix (variant.editSlack, a game value)
  const editMax = Math.floor(par.edits * (1 + (v.editSlack || 0)) + 1e-9), ru = v.reuse ? DI.puzReuse(W0, S.W) : null;
  const costOk = spent <= par.cost * (1 + DI.PUZ_COST_SLACK) + 100, editOk = d.n <= editMax, reuseOk = !ru || ru.kept >= par.reuse;
  const diagOk = pz.diag.ok && pz.diag.tries === 1, hintOk = pz.hints <= 1, impOk = v.impPar === null || pz.imp <= par.imp, resetOk = !v.live || pz.futile === 0;
  const word = design ? 'Answer' : 'Diagnosis';
  const lines = [
    [editOk, 'Edits: ' + d.n + ' (fewest needed: ' + par.edits + (editMax > par.edits ? ', star up to ' + editMax : '') + ')'],
    [costOk, 'Spent: ' + DI.money(Math.max(0, spent)) + (spent < 0 ? ' (' + DI.money(-spent) + ' back)' : '') + ' (cheapest fix: ' + DI.money(par.cost) + ')'],
  ];
  if (ru) lines.push([reuseOk, 'Starting pipe kept: ' + ru.kept + ' of ' + ru.total + ' tiles (the cheapest fix keeps ' + par.reuse + ')']);
  lines.push([diagOk, pz.diag.ok ? word + ': ' + (pz.diag.tries === 1 ? 'right the first time' : 'right on try ' + pz.diag.tries) : word + ': not given'],
    [hintOk, 'Hints used: ' + pz.hints + ' of ' + v.hints.length]);
  if (v.impPar !== null) lines.push([impOk, 'Out of service: ' + DI.dur(pz.imp) + ' (par ' + DI.dur(par.imp) + ')']);
  if (v.live) lines.push([resetOk, 'Resets made while the cause was still live: ' + pz.futile + (pz.resets ? ' of ' + pz.resets : '')]);
  const stars = 1 + (editOk && costOk && reuseOk ? 1 : 0) + (diagOk && hintOk && impOk && resetOk ? 1 : 0);
  return { stars, lines, edits: d.n, diff: d, spent, par, reuse: ru };
};
// Live status for the inspector's home panel and the goals dialog.
DI.puzStatus = function (S) {
  const v = DI.puzVariant(S), pz = S.puz; if (!v) return null;
  const W0 = DI.puzStart(S);
  return { v, edits: DI.puzDiff(W0, S.W).n, spent: DI.puzSpent(S), hints: v.hints.slice(0, pz.hints), left: v.hints.length - pz.hints, imp: pz.imp, now: DI.puzImpaired(S), futile: pz.futile, diag: pz.diag,
    reuse: v.reuse ? DI.puzReuse(W0, S.W) : null, overLimit: DI.puzOverLimit(S.W, v.limits), design: !!DI.puzFind(pz.id).design };
};

// The calc a riser shows: on a design call the one its goals read, at the most demanding area (fresh = the Run button:
// computed now, past the throttle); everywhere else the ordinary calc at the farthest area. null = no result yet.
DI.puzCalc = function (S, id, fresh) {
  const pz = S && S.puz && DI.puzFind(S.puz.id); if (!pz || !pz.design) return DI.hydCalc(S, id);
  if (fresh && S._calcAll) S._calcAll.delete(id);
  return DI.PZ.calcAll(S, id);
};

// ---------- helpers the puzzles share
DI.PZ = {
  // the last result of a kind on part `id` recorded after the puzzle started
  since: (S, kind, id) => { const r = DI.lastResult(S, kind, id); return r && S.puz && r.t >= S.puz.t0 ? r : null; },
  // every control valve fully open
  allOpen: (S) => S.W.byType('gate').every((g) => g.p.open > 0.99 && g.p.target > 0.99),
  // the zone of a system valve is set, pressurized, with no latch left anywhere on it
  inService: (S, v) => { const s = v && S.ss.get(v.id); return !!s && s.state === 'dry' && s.set && !v.p.pLatch && !v.p.sol && !v.p.pull && !v.p.mrzL && v.p.airValve === 1 && !v.p.sdrain; },
  // no signal of these classes on the annunciator (superseded detector stages are records, not signals)
  quiet: (S, types) => ![...S.sig.values()].some((o) => !o.sup && !o.lost && types.includes(o.type)),
  // thirty quiet minutes: every fire pump in AUTO and stopped, and no fire pump running, automatic start, edit or pump
  // test for 1,800 s (DI.quietFor): a pump that ran half an hour and was then stopped by hand is not a quiet half hour
  sleeps: (S) => { const fp = [...S.W.parts.values()].filter((p) => p.type === 'epump' || p.type === 'dpump');
    return fp.length > 0 && fp.every((p) => p.p.mode === 'auto' && p.p.spd === 0) && DI.quietFor(S, S.puz ? S.puz.t0 : 0) >= 1800; },
  // the calc at the most demanding area (DI.hydCalcWorst, calc.js), cached on the layout, the valve positions and the
  // pump modes: the game reads the goals every 0.6 s and one result costs a few ms per branch line end (about 0.2 s for
  // the six rooms of call 13). In the browser (throttleMs, set by puzui.js) a system edited again within the window gets
  // no result (null: the goal reads as not met) until the window has passed, so building does not stall on it. It never
  // hands back a stale pass. The tests leave throttleMs at 0 and always get a fresh result.
  throttleMs: 0,
  calcAll: (S, id) => {
    const W = S.W, key = W.ver + '|' + W.byType('gate').map((g) => Math.round(g.p.open * 100)).join(',') + '|' + [...W.parts.values()].filter((p) => p.type === 'epump' || p.type === 'dpump').map((p) => p.p.mode).join(',');
    const m = S._calcAll || (S._calcAll = new Map()), c = m.get(id); if (c && c.key === key) return c.r;
    const now = DI.PZ.throttleMs > 0 ? Date.now() : 0; if (now && c && now - c.at < DI.PZ.throttleMs) return null;
    if (S.ver !== W.ver) S.sync();
    const r = DI.hydCalcWorst(S, id); m.set(id, { key, r, at: now }); return r;
  },
  // every system that protects a room of `type` passes at its most demanding area (with the tank lasting the hazard's
  // duration and no fire pump over 150 % where `plant` is set)
  calcAllOk: (S, type, plant) => DI.G.each(S, type, (v, inf, s, id) => { const c = DI.PZ.calcAll(S, id); return !!c && c.ok && c.pass && (!plant || (c.durOk && !c.over)); }),
  // Which system valves the water supplies reach with the control valve on tile `blockK` shut (-1: none shut). A walk over
  // the layout from every supply outlet: through pipe that is linked, through inline parts by their two ports, and it
  // stops at a system valve (reached) or at the shut valve. Used for independent isolation (call 13).
  reached: (W, blockK) => {
    const out = new Set(), seen = new Set(), q = [];
    for (const p of W.parts.values()) if (p.type === 'city' || p.type === 'tank') { const pt = W.ports(p); if (pt.o >= 0) q.push([p.x, p.y, pt.o]); }
    while (q.length) {
      const [x, y, d] = q.pop(); if (!W.linked(x, y, d)) continue;
      const nx = x + DI.DX[d], ny = y + DI.DY[d], k = W.k(nx, ny); if (seen.has(k)) continue; seen.add(k);
      const p = W.at(nx, ny);
      if (p) { if (DI.SYSV[p.type]) { out.add(p.id); continue; } if (k === blockK) continue; const pt = W.ports(p); for (const e of [pt.i, pt.o]) if (e >= 0 && e !== DI.OPP[d]) q.push([nx, ny, e]); continue; }
      for (let e = 0; e < 4; e++) if (e !== DI.OPP[d]) q.push([nx, ny, e]);
    }
    return out;
  },
  // Independent isolation: every system valve has a control valve of its own (the nearest upstream, DI.ctrlValve), and
  // shutting it cuts off that system and no other. Returns the system valves that fail.
  notIsolated: (S) => {
    const W = S.W, sys = [...W.parts.values()].filter((p) => DI.SYSV[p.type]), all = DI.PZ.reached(W, -1), bad = [];
    for (const v of sys) { const g = DI.ctrlValve(W, v.id); if (!g || !all.has(v.id)) { bad.push(v); continue; }
      const r = DI.PZ.reached(W, W.k(g.x, g.y)); if (r.has(v.id) || sys.some((o) => o !== v && all.has(o.id) && !r.has(o.id))) bad.push(v); }
    return bad;
  },
  // every system of the layout passes there
  calcEvery: (S, plant) => S.sysd.info.size > 0 && [...S.sysd.info.keys()].every((id) => { const c = DI.PZ.calcAll(S, id); return !!c && c.ok && c.pass && (!plant || (c.durOk && !c.over)); }),
};
