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
// The recovery rating (DI.recoveryTier, 0 to 3 stars) reads the operator's own steps only. The air refill is
// compressor time and gets its own line against the 30 min limit (Fire Tutor wording: it never says FAIL, and it
// says why a refill ran over); the total is reported beside them. None of these lines can fail the drill, and the
// rating is separate from the contract's stars.
// Only the drill's incident is scored; every other recovery (a trip test, a sandbox incident) is practice and
// shows as a checklist on the valve. A zone that filled with every head closed because P was left latched is
// reported as its own line: an unattended low-air failure, not a discharge.
// The air-refill sentence of a recovery report (Fire Tutor wording; it never says FAIL). sec = the measured refill,
// az = DI.airSizing of the zone (null: no source). Within the limit it is OK. Over it, the sentence says why:
//   the supply cannot fill the largest zone alone in 30 min (the code check fails): the compressor is too small;
//   the code check passes and the zone shares its supply: the zones filled together (parallel split);
//   the code check passes on a supply of its own: the time went elsewhere.
DI.refillLine = function (sec, az) {
  const m = DI.fmt(sec / 60, 1) + ' min', lim = DI.fmt(DI.REFILL_LIMIT / 60) + ' min', alone = az && !az.below ? DI.fmt(az.tAlone, 1) + ' min' : '';
  if (sec <= DI.REFILL_LIMIT) return 'Air refill: ' + m + ' (limit ' + lim + '). OK.';
  if (!alone) return 'Air refill: ' + m + ', over the ' + lim + ' limit. The compressor is too small for this zone. Size it to refill the largest zone to normal pressure in ' + lim + '.';
  if (az.shared) return 'Air refill: ' + m + ', over the ' + lim + ' limit because the zones share one compressor and fill together (SIMPLIFICATION: parallel split). The largest zone alone fills in ' + alone + ', which passes the code check.';
  return 'Air refill: ' + m + ', over the ' + lim + ' limit. The sizing check passes (this zone alone fills in ' + alone + '), so the time went elsewhere: look for a leak, or a nitrogen generator finishing the fill.';
};
DI.drillRecovery = function (S, what) {
  const a = S.acts.find((q) => q.kind === 'incident' && q.t >= S.drill.t0), r = a ? DI.recoveryScore(S, a.id, S.drill.t0) : null; if (!r) return [];
  const miss = r.steps.filter((st) => !st.done).map((st) => st.label.toLowerCase()), tier = DI.recoveryTier(r), T = DI.RECOVERY_TIERS;
  const out = [[r.complete && r.inOrder, 'Recovery after ' + what + ': ' + r.done + ' of ' + r.total + ' steps, ' + (r.inOrder ? 'in order' : 'out of order') + (miss.length ? '. Missing: ' + miss.join('; ') : ''), true],
    [tier > 0, 'Recovery rating: ' + tier + ' of 3 stars (' + (r.opTime === null ? 'recovery not finished' : 'operator steps took ' + DI.dur(r.opTime) + (r.inOrder ? '' : ', out of order')) + '; 3 stars at ' + T[0].s + ' s or less, 2 at ' + T[1].s + ' s or less; any complete in-order recovery is 1; ASSUMED, informational)', true]];
  if (r.air && S.sysd.info.has(a.id)) out.push([r.refill <= DI.REFILL_LIMIT, DI.refillLine(r.refill, DI.airSizing(S, a.id)) + ' [' + DI.refillRef(S.W, S.sysd.info.get(a.id)) + ']', true]);
  if (r.time !== null) out.push([false, 'Total recovery ' + DI.dur(r.time) + (r.refill > r.time / 2 ? ', mostly the compressor' : ''), true]);
  for (const z of S.acts) if (z.kind === 'zone-filled' && z.why === 'low-air' && z.t >= S.drill.t0) if (S.W.parts.get(z.id)) out.push([false, 'Water-filled zone: ' + DI.sysName(S, z.id) + ' filled because P was left latched (unattended low-air failure), no discharge', true]);
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
