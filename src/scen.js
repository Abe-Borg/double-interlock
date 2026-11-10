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
  for (const [ok, txt] of ex) { lines.push((ok ? '✓ ' : '✗ ') + txt); if (!ok) pass = false; }
  lines.push((loss <= limit ? '✓ ' : '✗ ') + 'Total loss ' + DI.money(loss) + ' (limit ' + DI.money(limit) + ')');
  return { pass, lines, limit };
};
