// Field calls: small "find the fault" puzzles. Engine side (no DOM), so the tests can play them under Node.
// A puzzle hands the player an existing installation, a symptom and a small repair budget, and asks one central
// question. The live plant is the same simulation as the contracts: nothing here changes how water, air or the panel
// behave. This file holds the puzzle machinery; the puzzles themselves are in puz1.js and puz2.js.
//
//   DI.PUZ            the puzzle list: { id, n, name, tag, kind, question, learn, w, h, parts, variants: [...] }
//   variant           { key, name, money, symptom, records, build(W, b), setup(S), area, hints, diag, goals,
//                       cheap, maint, live, impPar, cfg }
//   DI.puzScenario    one variant as a scenario object (the shape main.js and DI.buildScenario expect)
//   S.puz             the running puzzle's state: the starting layout (w0), hints shown, diagnosis tries, the
//                     out-of-service clock and the resets made while the cause was still live. It is saved beside
//                     the world and the sim (main.js), never inside Sim.dump.
//   DI.puzDiff        the edits between the starting layout and now: what "fewest edits" counts
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
DI.puzWorld = (snap) => DI.World.fromJSON(JSON.parse(snap));

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

// ---------- a variant as a scenario
DI.puzFind = (id) => DI.PUZ.find((p) => p.id === id) || null;
DI.puzScenario = function (id, vi) {
  const pz = DI.puzFind(id); if (!pz) return null;
  const i = DI.clamp(vi | 0, 0, pz.variants.length - 1), v = pz.variants[i];
  const diagGoal = { t: 'Name the fault (Diagnose, on the top bar)', ok: (S) => !!(S.puz && S.puz.diag.ok), hint: 'Answer the central question: ' + (v.diag.q || pz.question) };
  const sc = {
    id: pz.id, name: pz.name, tag: 'Field call ' + pz.n + ' · ' + v.name, w: v.w || pz.w, h: v.h || pz.h, money: v.money, par: 0,
    parts: v.parts || pz.parts, brief: v.symptom, learn: pz.learn, cfg: v.cfg, drill: null, puzzle: true, pz, vi: i, v,
    build: (W) => v.build(W, DI.mk(W)), start: v.setup ? (S) => v.setup(S) : undefined,
    goals: v.goals.concat([diagGoal]), tick: (S) => DI.puzTick(S),
  };
  return sc;
};
// build a variant and start its puzzle state (the tests and main.js both use it)
DI.puzBuild = function (id, vi) { const sc = DI.puzScenario(id, vi); const { W, S } = DI.buildScenario(sc); DI.puzInit(S, sc); return { W, S, sc }; };

// ---------- the running puzzle
DI.puzInit = function (S, sc) {
  // the records of the call: fixed text, or read from the starting state (a baseline test the setup recorded)
  const v = sc.v, rec = typeof v.records === 'function' ? v.records(S) : v.records || [];
  S.puz = { id: sc.id, vi: sc.vi, t0: S.t, w0: DI.puzSnap(S.W), rec, money0: S.W.money, hints: 0, diag: { tries: 0, ok: false, picks: [] }, imp: 0, lastT: S.t, futile: 0, resets: 0, actN: S.acts.length, lastReset: -1, flags: {} };
  DI.puzActive = S; return S.puz;
};
// (the keys that start with _ are caches: the parsed starting layout and the par)
DI.puzSave = (S) => (S.puz ? JSON.parse(JSON.stringify(S.puz, (k, val) => (k[0] === '_' ? undefined : val))) : null);
DI.puzLoad = function (S, o) { S.puz = Object.assign({ flags: {}, diag: { tries: 0, ok: false, picks: [] } }, o); S.puz.lastT = S.t; S.puz.actN = S.acts.length; DI.puzActive = S; return S.puz; };
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
// Called after every batch of steps (main.js frame, the tests): the out-of-service clock, and every panel reset made
// while the variant's cause was still live (its `live` predicate): a reset that cannot hold.
DI.puzTick = function (S) {
  const pz = S.puz; if (!pz) return;
  const dt = S.t - pz.lastT; pz.lastT = S.t;
  if (dt > 0 && DI.puzImpaired(S).length) pz.imp += dt;
  const v = DI.puzVariant(S); if (!v) return;
  for (let i = pz.actN; i < S.acts.length; i++) { const a = S.acts[i];
    if (a.kind !== 'reset-panel' || a.t < pz.t0 || a.t === pz.lastReset) continue;      // one panel reset logs one entry per valve
    pz.lastReset = a.t; pz.resets++; if (v.live && v.live(S)) pz.futile++; }
  pz.actN = S.acts.length;
  if (v.watch) v.watch(S, pz.flags);
};
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
  return { sol, W: W1, diff: DI.puzDiff(W0, W1), cost: DI.puzWorth(W1) - DI.puzWorth(W0) };
};
// par = the cheap fix: its edits and its cost
DI.puzPar = function (S) {
  const pz = S.puz; if (pz._par) return pz._par;
  const c = DI.puzSolution(S, 'cheap'), v = DI.puzVariant(S);
  return (pz._par = { edits: c ? c.diff.n : 0, cost: c ? Math.max(0, c.cost) : 0, imp: v && v.impPar !== undefined ? v.impPar : DI.PUZ_IMP_PAR });
};
// The scorecard. [ok, text] lines; the stars: one for the fix (every goal, the diagnosis included), one for fewest
// edits at no more than the cheap fix's cost, one for the diagnosis right the first time with at most one hint, no
// more out-of-service time than par and no reset made while the cause was still live.
DI.puzScore = function (S) {
  const pz = S.puz, v = DI.puzVariant(S), par = DI.puzPar(S), d = DI.puzDiff(DI.puzStart(S), S.W), spent = DI.puzSpent(S);
  const costOk = spent <= par.cost * (1 + DI.PUZ_COST_SLACK) + 100, editOk = d.n <= par.edits, diagOk = pz.diag.ok && pz.diag.tries === 1, hintOk = pz.hints <= 1, impOk = pz.imp <= par.imp, resetOk = !v.live || pz.futile === 0;
  const lines = [
    [editOk, 'Edits: ' + d.n + ' (fewest needed: ' + par.edits + ')'],
    [costOk, 'Spent: ' + DI.money(Math.max(0, spent)) + ' (cheapest fix: ' + DI.money(par.cost) + ')'],
    [diagOk, pz.diag.ok ? 'Diagnosis: ' + (pz.diag.tries === 1 ? 'right the first time' : 'right on try ' + pz.diag.tries) : 'Diagnosis: not given'],
    [hintOk, 'Hints used: ' + pz.hints + ' of ' + v.hints.length],
    [impOk, 'Out of service: ' + DI.dur(pz.imp) + ' (par ' + DI.dur(par.imp) + ')'],
  ];
  if (v.live) lines.push([resetOk, 'Resets made while the cause was still live: ' + pz.futile + (pz.resets ? ' of ' + pz.resets : '')]);
  const stars = 1 + (editOk && costOk ? 1 : 0) + (diagOk && hintOk && impOk && resetOk ? 1 : 0);
  return { stars, lines, edits: d.n, diff: d, spent, par };
};
// Live status for the inspector's home panel and the goals dialog.
DI.puzStatus = function (S) {
  const v = DI.puzVariant(S), pz = S.puz; if (!v) return null;
  return { v, edits: DI.puzDiff(DI.puzStart(S), S.W).n, spent: DI.puzSpent(S), hints: v.hints.slice(0, pz.hints), left: v.hints.length - pz.hints, imp: pz.imp, now: DI.puzImpaired(S), futile: pz.futile, diag: pz.diag };
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
};
