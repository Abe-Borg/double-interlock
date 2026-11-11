// Scenario toolkit: map-building helpers, goal helpers and the drill (scripted incident) runner.
var DI = globalThis.DI || (globalThis.DI = {});

DI.SCEN = [];
DI.mk = function (W) {
  const b = {
    h(x0, x1, y, size, spk, kind) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) W.setPipe(x, y, size, kind || 0, !!spk); return b; },
    v(x, y0, y1, size, spk, kind) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) W.setPipe(x, y, size, kind || 0, !!spk); return b; },
    // sprinkler branch lines filling a rectangle; kind 1 = lines run E-W, 2 = N-S
    grid(x0, y0, x1, y1, size, kind) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!W.pd[W.k(x, y)] && !W.partAt[W.k(x, y)]) W.setPipe(x, y, size, kind, true); return b; },
    p(type, x, y, rot, props) { return W.addPart(type, x, y, rot || 0, props); },
    capCol(x, y0, y1) { for (let y = y0; y <= y1; y++) W.setCut(x, y, false, 1); return b; },
    capRow(y, x0, x1) { for (let x = x0; x <= x1; x++) W.setCut(x, y, true, 1); return b; },
    air(pts) { for (const [x, y] of pts) W.setAir(x, y, 1); return b; },
    wire(panel, ...devs) { for (const d of devs) W.wire(panel.id, d.id); return b; },
  };
  return b;
};

// Build a fresh world and sim for a scenario: the map, the budget, the site settings the contract fixes
// (sc.cfg, optional: basis of design set by the AHJ, the owner and the insurer) and the plant commissioned.
// `cfg` adds settings on top, for tests and what-if runs.
DI.buildScenario = function (sc, cfg) {
  const W = new DI.World(sc.w, sc.h); sc.build(W); W.money = sc.money;
  Object.assign(W.cfg, JSON.parse(JSON.stringify(sc.cfg || {})), JSON.parse(JSON.stringify(cfg || {})));
  const S = new DI.Sim(W); S.contract = !sc.sandbox; S.commission(); if (sc.start) sc.start(S);
  DI.simFlags(S, sc);
  return { W, S };
};
// live = the site transmits to the fire department outside drills (sandbox only). contract = site settings
// are fixed, and a Manual Release zone bypass shows as an impairment.
DI.simFlags = function (S, sc) { S.live = !!sc.sandbox; S.contract = !sc.sandbox; };

// --- goal helpers (all read live state)
DI.G = {
  covered: (S, types) => S.W.rooms.filter((r) => !types || types.includes(r.type)).every((r) => (r.cov === undefined ? 0 : r.cov) >= 0.999),
  noFails: (S) => !!S.rv && !S.rv.some((f) => f.sev === 'fail'),
  noWarn: (S, word) => !!S.rv && !S.rv.some((f) => f.sev !== 'ok' && f.text.includes(word)),
  sysOf: (S, type) => { const o = []; for (const [id, inf] of S.sysd.info) { const r = [...inf.rooms].map((i) => S.W.rooms[i - 1].type); if (r.includes(type)) o.push(id); } return o; },
  // every system serving rooms of `type` passes fn(valve, info, state)
  each: (S, type, fn) => { const ids = DI.G.sysOf(S, type); return ids.length > 0 && ids.every((id) => fn(S.W.parts.get(id), S.sysd.info.get(id), S.ss.get(id), id)); },
  calcOk: (S, type) => DI.G.each(S, type, (v, inf, s, id) => { const c = S.calc && S.calc.get(id); return !!c && c.ok && c.pass; }),
  test: (S, kind, type) => DI.G.each(S, type, (v, inf, s, id) => { const r = DI.lastResult(S, kind, id); return !!r && r.pass; }),
  anyTest: (S, kind, ptype) => S.results.some((r) => r.kind === kind && r.pass && (!ptype || (S.W.parts.get(r.id) || {}).type === ptype)),
  wired: (S, types) => [...S.W.parts.values()].filter((p) => types.includes(p.type)).every((p) => S.W.panelOf(p.id)),
};
// Recovery score of the first incident of the running drill, as report lines for DI.lossJudge (informational).
// The recovery rating (DI.recoveryTier, 0 to 3 stars) reads "water stopped" (the alarm to the control valve closed)
// and the order of the steps; the operator's own step time is an info stat on the same line. The air refill is
// compressor time and gets its own line against the 30 min limit (Fire Tutor wording: it never says FAIL, and it
// says why a refill ran over); the total is reported beside them. None of these lines can fail the drill, and the
// rating is separate from the contract's stars. Cycle 7 (Fire Tutor, FP Lead): the operator's steps and the main
// drain test are two time lines, the water is two gallon lines (never a total), the shared-compressor note prints
// whenever zones share the supply, and the return-to-normal errors and the main drain follow-up are listed as
// informational lines in plain language.
// Only the drill's incident is scored; every other recovery (a trip test, a sandbox incident) is practice and
// shows as a checklist on the valve. A zone that filled with every head closed because P was left latched is
// reported as its own line: an unattended low-air failure, not a discharge.
// The air-refill lines of a recovery report (Cycle 8: FP Lead for the order and the labels, Fire Tutor for the
// sentences). Two numbers on two labeled lines, and only the first one is ever compared with the limit:
//   DI.codeCheckLine  the code check, on top: the largest zone on the supply, alone, from 0 psig, against the zone's
//                     limit. It decides pass or fail (in the report it is informational; the FAIL is in plan review).
//   DI.measuredLine   what this drill measured: zones refilled together (or one at a time), from partly full.
//                     Informational: it never says limit, OK or over, and nothing compares it with the limit.
//   DI.sharedLine     the note that the zones share a compressor, only where they do.
//   DI.seqLine        sequential refill on, the measured total over the zone limit and the code check passing: the
//                     FP Lead's Cycle 7 sentence, word for word (the sequence total is not a code limit).
//   DI.ownerLine      the owner / insurer refill target (site setting), judged like the code check. '' with none set.
// The two-line display is PRACTICE; the rule is VERIFIED (NFPA 13-2019 / 2022 §8.2.6.3.2, 2025 §8.2.7.3).
DI.wordNum = (n) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
DI.codeCheckLine = function (S, id) {
  const az = DI.airSizing(S, id), inf = S.sysd.info.get(id); if (!az || !inf) return '';
  const gov = S.sysd.info.get(az.gov) || inf, L = DI.fmt(az.limit);
  return 'Code check: largest zone alone, from 0 psig: ' + (isFinite(az.tAlone) ? DI.fmt(az.tAlone, 1) + ' min' : 'never') + '. Limit ' + L + ' min (NFPA 13). ' +
    (az.below ? 'Fails: the compressor is too small for this zone. Size it to refill the largest zone to normal pressure in ' + L + ' min.' : 'Passes.') + ' [' + DI.refillRef(S.W, gov) + ']';
};
// sec = the measured refill of the scored recovery, in seconds
DI.measuredLine = function (S, id, sec) {
  const az = DI.airSizing(S, id), how = az && az.shared ? (DI.refillSeq(S.W) ? 'zones refilled one at a time, largest first, from partly full' : 'zones refilled at the same time, from partly full') : 'from partly full';
  return 'Air refill this drill, measured: ' + DI.fmt(sec / 60, 1) + ' min (' + how + '). Informational.';
};
DI.sharedLine = function (S, id) {
  const az = DI.airSizing(S, id), gov = az ? S.sysd.info.get(az.gov) : null; if (!az || !az.shared || !gov) return '';
  return 'Note: ' + (az.shared + 1) + ' zones share this compressor. It is sized for the largest zone, not for all zones at once. [' + DI.refillRef(S.W, gov) + ']';
};
DI.seqLine = function (S, id, sec) {
  const az = DI.airSizing(S, id), inf = S.sysd.info.get(id); if (!az || !inf || az.below || !DI.refillSeq(S.W) || !(sec > DI.refillLimit(S.W, inf))) return '';
  const lim = DI.fmt(DI.refillLimit(S.W, inf) / 60) + ' min';
  return 'PASS: each zone restores in ' + lim + ' or less when filled alone (largest ' + DI.fmt(az.tAlone, 1) + ' min). The sequential campus refill total of ' + DI.fmt(sec / 60, 1) + ' min is informational and not a code limit.';
};
DI.ownerLine = function (S, id) {
  const T = DI.ownerRefill(S.W), az = DI.airSizing(S, id); if (!T || !az) return '';
  return 'Owner/insurer target: ' + T + ' min. ' + (az.tAlone <= T ? 'Met.' : 'Not met (' + (isFinite(az.tAlone) ? DI.fmt(az.tAlone, 1) + ' min' : 'never') + '): ' + (az.below ? 'the code check fails first.' : 'a warning tagged owner/insurer criterion, not a code limit.'));
};
// Water of a drill, never added together (Fire Tutor): what left through open heads (and breaks), and what a main
// drain test sent down the drain. Water out of the other drains and test connections (a system drain, an
// inspector's test, the pump test header: Sim.account tallies it as otGal) is neither: it gets a line of its own,
// only when there is some (that line's wording is ASSUMED; the Tutor gave the first two).
// S = the sim, or a stats object (the drill result keeps a copy).
DI.headGal = (S) => { const st = (S && S.stats) || S || {}; return Math.max(0, (st.gallons || 0) - (st.mdGal || 0) - (st.otGal || 0)); };
DI.drainGal = (S) => { const st = (S && S.stats) || S || {}; return st.mdGal || 0; };
DI.testGal = (S) => { const st = (S && S.stats) || S || {}; return st.otGal || 0; };
DI.galLines = (S) => ['Discharged through the open head: ' + DI.fmt(DI.headGal(S)) + ' gal'].concat(DI.drainGal(S) > 0 ? ['Main drain test: ' + DI.fmt(DI.drainGal(S)) + ' gal (to drain, not to the floor)'] : [],
  // Fire Tutor, Cycle 8, word for word
  DI.testGal(S) > 0 ? ['Other drains and test connections (system drain, inspector’s test): ' + DI.fmt(DI.testGal(S)) + ' gal, to drain, not to the floor.'] : []);
// Main drain follow-up (FP Lead, Fire Tutor). A test with a drop over 10 percent against a baseline is "investigated"
// by a `drop-check` entry on that valve (the Check the valves upstream button), by a control valve on its supply path
// reopened through the reopen gate, or by a later passing main drain test, at or after the test. PRACTICE scoring.
DI.dropFollowed = function (S, act) {
  const A = S.acts, i = A.indexOf(act), gates = new Set(DI.supplyValves(S.W, act.id).map((g) => g.id));
  for (let k = i + 1; k < A.length; k++) { const q = A[k];
    if ((q.kind === 'drop-check' && q.id === act.id) || (q.kind === 'open-valve' && gates.has(q.id)) || (q.kind === 'main-drain-test' && q.id === act.id && q.pass === true)) return true; }
  return false;
};
// "Check the valves upstream": reports the opening of every control valve on the supply path of system valve `id`
// and logs the check. Returns the text.
DI.dropCheck = function (S, id) {
  const v = S.W.parts.get(id); if (!v || !DI.SYSV[v.type]) return 'No system valve.';
  const gs = DI.supplyValves(S.W, id), part = gs.filter((g) => g.p.open < 0.99);
  const text = gs.length ? 'Valves upstream of ' + DI.sysName(S, id) + ': ' + gs.map((g) => 'control valve #' + g.id + ' ' + DI.fmt(g.p.open * 100) + '% open').join(', ') + '. ' + (part.length ? part.length + ' not fully open: open ' + (part.length > 1 ? 'them' : 'it') + ' fully, then run the main drain test again.' : 'All fully open. If the residual is still low, the cause is further upstream (the supply itself): find it and correct it.')
    : 'No control valve found upstream of ' + DI.sysName(S, id) + '. If the residual is still low, the cause is in the supply itself.';
  S.act('drop-check', id, { n: gs.length, part: part.length }); S.say(text, part.length ? 'warn' : '');
  return text;
};
// The main drain lines of a drill report: the skipped test, the baseline, the hint and the one scored error.
// r = the drill's recovery score (or null), id = its zone.
DI.drillDrainLines = function (S, r, id) {
  const out = [], t0 = S.drill.t0, st13 = r && r.steps.find((q) => q.kind === 'open-valve'), st14 = r && r.steps.find((q) => q.kind === 'drain-test');
  if (st13 && st14 && st13.done && !st13.na && !st14.done) out.push([false, DI.MDT_SKIPPED, true]);
  for (const q of S.acts) { if (q.kind !== 'main-drain-test' || q.t < t0 || !S.W.parts.get(q.id)) continue;
    const nm = DI.sysName(S, q.id);
    if (!(q.base > 0)) { out.push([false, 'Main drain test on ' + nm + ': no earlier test to compare with, so record as baseline. ' + DI.MDT_BASELINE, true]); continue; }
    if (!DI.mdtBig(q.drop)) continue;
    out.push(DI.dropFollowed(S, q) ? [false, 'Main drain test on ' + nm + ': ' + DI.mdtHint(q.drop) + ' Investigated. [' + DI.REF25.passLine + ']', true] : [false, DI.MDT_NOT_INVESTIGATED + ' (' + nm + '). ' + DI.mdtHint(q.drop) + ' [' + DI.REF25.passLine + ']', true]);
  }
  return out;
};
// The return-to-normal lines of a drill report (FP Lead): one informational line per error, clock and plain text, for
// every step finished since the drill started and every step still pending. They never fail the drill, and no goal,
// star or review finding reads them (not until the scoring has settled for a cycle). Cycle 8 (FP Lead): a refused
// Finish is one error per new set of blockers, and the raw number of presses is its own information line.
DI.drillReturnLines = function (S) {
  const out = [], t0 = S.drill.t0, line = (e) => [false, DI.clock(e.t) + ' ' + DI.rtLine(e), true], early = (errs) => errs.filter((e) => e.why === 'finish-early').length;
  const press = (nm, n, errs) => { if (n > 0) out.push([false, 'Return to normal, ' + nm + ': ' + DI.rtPressLine(n, early(errs)), true]); };
  for (const q of S.acts) { if (q.kind !== 'return-normal' || q.t < t0 || !S.W.parts.get(q.id)) continue;
    const nm = DI.sysName(S, q.id);
    if (Array.isArray(q.errs)) { if (!q.errs.length) out.push([true, 'Return to normal, ' + nm + ': ' + DI.RT_CLEAN, true]); else { out.push([false, 'Return to normal, ' + nm + ': ' + q.errs.length + ' error(s)' + (q.aborted ? ', ended by the valve tripping' : ''), true]); for (const e of q.errs) out.push(line(e)); } press(nm, q.presses, q.errs); }
    else out.push([!(q.err > 0), 'Return to normal, ' + nm + ': ' + (q.err || 0) + ' error(s)', true]);       // an entry from before Cycle 7 carries only the count
  }
  for (const [id, s] of S.ss) if (s.ret && Array.isArray(s.rtErr) && s.rtErr.length) { const n = DI.rtPresses(s);
    out.push([false, 'Return to normal, ' + DI.sysName(S, id) + ': not finished, ' + s.rtErr.length + ' error(s) so far' + (n ? ' (Finish pressed ' + DI.rtTimes(n) + ')' : ''), true]); for (const e of s.rtErr) out.push(line(e)); press(DI.sysName(S, id), n, s.rtErr); }
  return out;
};
DI.drillRecovery = function (S, what) {
  const a = S.acts.find((q) => q.kind === 'incident' && q.t >= S.drill.t0), r = a ? DI.recoveryScore(S, a.id, S.drill.t0) : null; if (!r) return [];
  const inf = S.sysd.info.get(a.id), miss = r.steps.filter((st) => !st.done).map((st) => (st.kind === 'drain-test' ? st.label.split('. ')[0] : st.label).toLowerCase()), tier = DI.recoveryTier(r), T = DI.RECOVERY_TIERS, L = DI.refillLimit(S.W, inf);
  const ws = r.waterStopped === null ? 'Water not stopped: the control valve is not closed' : 'Water stopped ' + Math.round(r.waterStopped) + ' s after the alarm';
  const out = [[r.complete && r.inOrder, 'Recovery after ' + what + ': ' + r.done + ' of ' + r.total + ' steps, ' + (r.inOrder ? 'in order' : 'out of order') + (miss.length ? '. Missing: ' + miss.join('; ') : ''), true],
    [tier > 0, 'Recovery rating: ' + tier + ' of 3 stars. ' + ws + ' (3 stars at ' + T[0].s + ' s or less, 2 at ' + T[1].s + ' s or less; any complete in-order recovery is 1; ASSUMED, informational).', true],
    [false, DI.RECOVERY_TIP, true]].concat(r.waterStopped !== null && r.waterStopped < DI.RISER_NOTE_S ? [[false, DI.RISER_NOTE, true]] : [], [
    // two time lines, never one sum: the operator's own steps, and the main drain test of step 14
    [false, r.opTime === null ? 'Recovery not finished.' : 'Operator steps took: ' + Math.round(r.opTime) + ' s' + (r.inOrder ? '' : ' (out of order)'), true]]);
  if (r.mdtTime > 0) out.push([false, 'Main drain test took: ' + Math.round(r.mdtTime) + ' s', true]);
  out.push(...DI.drillDrainLines(S, r, a.id));
  // two gallon lines, never a total
  for (const t of DI.galLines(S)) out.push([false, t, true]);
  // Air refill (Cycle 8): the code check on top, then what this drill measured, each with its own label. Only the
  // code check is compared with the limit; the measured time is informational and is never read against it.
  // The code check and the shared note do not depend on the drill: they print whenever the zone has an air supply, an
  // unfinished recovery included. The measured line needs a measured refill (the air is back: r.air).
  if (inf) { const az = DI.airSizing(S, a.id), cc = DI.codeCheckLine(S, a.id), own = DI.ownerLine(S, a.id), seq = r.air ? DI.seqLine(S, a.id, r.refill) : '', note = DI.sharedLine(S, a.id);
    if (cc) out.push([!az.below, cc, true]);
    if (own) out.push([false, own, true]);
    if (r.air && az) out.push([false, DI.measuredLine(S, a.id, r.refill), true]);
    if (seq) out.push([false, seq, true]);
    if (note) out.push([false, note, true]); }
  if (r.time !== null) out.push([false, 'Total recovery ' + DI.dur(r.time) + (r.refill > r.time / 2 ? ', mostly the compressor' : ''), true]);
  for (const z of S.acts) if (z.kind === 'zone-filled' && z.why === 'low-air' && z.t >= S.drill.t0) if (S.W.parts.get(z.id)) out.push([false, 'Water-filled zone: ' + DI.sysName(S, z.id) + ' filled because P was left latched (unattended low-air failure), no discharge', true]);
  out.push(...DI.drillReturnLines(S));
  return out;
};

// --- drills: timed scripts of incidents. step = [secondsFromStart, fn(S), optional banner]
DI.startDrill = function (S, d) {
  S.drill = { name: d.name, steps: d.steps(S).sort((a, b) => a[0] - b[0]), i: 0, t0: S.t, len: d.len, judge: d.judge, done: false };
  S.stats = { fireLoss: 0, waterLoss: 0, smokeLoss: 0, gallons: 0 }; S.drillLog0 = S.log.length;
  S.say('ACCEPTANCE DRILL: ' + d.name, 'warn'); DI.bus.emit('drill', S.drill);
};
DI.drillStep = function (S) {
  const d = S.drill; if (!d || d.done) return;
  const el = S.t - d.t0;
  while (d.i < d.steps.length && el >= d.steps[d.i][0]) { const st = d.steps[d.i++]; st[1](S); if (st[2]) { S.say(st[2], 'warn'); DI.bus.emit('banner', st[2]); } }
  const quiet = !S.fires.length && S.outFlow < 1 && d.i >= d.steps.length;
  if (el >= d.len || (quiet && el > d.steps[d.steps.length - 1][0] + 240 && (S.fireOutT === undefined || S.t - S.fireOutT > 60))) {
    d.done = true; d.result = d.judge(S); d.result.stats = Object.assign({}, S.stats);
    d.result.loss = S.stats.fireLoss + S.stats.waterLoss + S.stats.smokeLoss; DI.bus.emit('drillEnd', d);
  }
};
// incident helpers
DI.X = {
  tileIn(S, type, fx, fy) { const r = S.W.rooms.find((q) => q.type === type); return S.W.k(r.x + Math.floor(r.w * (fx === undefined ? 0.5 : fx)), r.y + Math.floor(r.h * (fy === undefined ? 0.5 : fy))); },
  fire(type, fx, fy, incip, mul) { return (S) => DI.ignite(S, DI.X.tileIn(S, type, fx, fy), incip || 0, mul || 1); },
  smash(type, fx, fy) { return (S) => DI.breakSprinkler(S, DI.X.tileIn(S, type, fx, fy)); },
  // break a main of the system that protects the first room of `type` (a main inside that room if there is one)
  pipeBreak(type) { return (S) => {
    const W = S.W, id = DI.G.sysOf(S, type)[0], inf = id && S.sysd.info.get(id); if (!inf) return false;
    const mains = inf.tiles.filter((k) => !W.pk[k]), k = mains.find((q) => { const r = W.roomAt[q]; return r && W.rooms[r - 1].type === type; });
    return DI.breakPipe(S, k !== undefined ? k : mains.length ? mains[0] : inf.tiles[0]);
  }; },
  power(on) { return (S) => { S.W.power = on; }; },
  temp(f) { return (S) => { S.W.outTemp = f; }; },
  falseAlarm(type) { return (S) => { const r = S.W.rooms.find((q) => q.type === type); S.smoke[r.id] = Math.max(S.smoke[r.id], 2.5); }; },
};
DI.lossJudge = (limit, extra) => (S) => {
  const loss = S.stats.fireLoss + S.stats.waterLoss + S.stats.smokeLoss, lines = [], ex = extra ? extra(S) : [];
  let pass = loss <= limit && !S.fires.length;
  // [ok, text] decides the drill; [ok, text, true] is informational (a star when earned) and never fails it
  for (const [ok, txt, info] of ex) { lines.push((info ? (ok ? '★ ' : '• ') : ok ? '✓ ' : '✗ ') + txt); if (!ok && !info) pass = false; }
  lines.push((loss <= limit ? '✓ ' : '✗ ') + 'Total loss ' + DI.money(loss) + ' (limit ' + DI.money(limit) + ')');
  return { pass, lines, limit };
};
