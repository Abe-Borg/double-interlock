// Hydraulic calculation (density / area method, NFPA 13 Ch. 19 + 28; edition per the site setting) run on the live map:
// opens the hydraulically remote design area, adds the hose stream allowance, assumes the fire
// pumps are running and solves steady state. Answers "does every sprinkler get its density?"
var DI = globalThis.DI || (globalThis.DI = {});

// design area for one room served by system `id`: the hydraulically most remote sprinklers in that room.
// anchor (optional, a sprinkler tile of that room): the area is placed there instead (DI.hydCalcWorst moves it to every
// branch line end, so a fix that only strengthens the farthest area cannot pass by moving the demanding area elsewhere)
DI.designArea = function (S, id, rm, anchor) {
  const W = S.W, inf = S.sysd.info.get(id), v = W.parts.get(id), td = S.sysd.tdist; if (!inf || inf.remote < 0) return null;
  if (!rm) rm = W.roomAt[inf.remote];
  let remote = -1; for (const k of inf.tiles) if (W.spk[k] && W.roomAt[k] === rm && (remote < 0 || td[k] > td[remote])) remote = k;
  if (anchor !== undefined && W.spk[anchor] && W.roomAt[anchor] === rm) remote = anchor;
  if (remote < 0) return null;
  const hz = rm ? DI.HAZ[DI.ROOMS[W.rooms[rm - 1].type].haz] : DI.HAZ.OH1;
  const dryLike = v.type === 'dryv' || v.type === 'prev';
  const area = hz.area * (dryLike ? 1.3 : 1), rx = remote % W.w, ry = (remote / W.w) | 0, horiz = W.pk[remote] !== 2;
  const cand = inf.tiles.filter((k) => W.spk[k] && W.roomAt[k] === rm).map((k) => {
    const dx = Math.abs((k % W.w) - rx), dy = Math.abs(((k / W.w) | 0) - ry);
    return [k, horiz ? dx + 1.7 * dy : dy + 1.7 * dx];       // rectangle 1.2*sqrt(A) long, along the branch lines
  }).sort((a, b) => a[1] - b[1]).slice(0, Math.ceil(area / 100)).map((c) => c[0]);
  return { hz, area, n: cand.length, tiles: cand, dryLike, room: rm };
};

// every room the system protects is calculated for its own hazard; the worst one is reported
DI.hydCalc = function (S, id) {
  const inf = S.sysd.info.get(id); if (!inf || inf.remote < 0) return { ok: false, err: 'No sprinklers on this system.' };
  let worst = null; const rooms = inf.rooms.size ? [...inf.rooms] : [0];
  for (const rm of rooms) { const r = DI.hydCalcRoom(S, id, rm); if (!r.ok) return r; r.margin = r.minQ / r.need; if (!worst || r.margin < worst.margin) worst = r; }
  worst.pass = worst.pass && worst.margin >= 0.999;
  return DI.calcVerdict(S, inf, worst);
};
// The calc checks hydraulics only. Coverage stays in plan review, so the result carries a flag and the UI
// never shows an unqualified PASS over a room that is not fully sprinklered.
DI.calcVerdict = function (S, inf, r) {
  r.covOk = [...inf.rooms].every((rm) => { const room = S.W.rooms[rm - 1]; if (room.exempt || DI.ROOMS[room.type].open) return true; const c = DI.roomCoverage(S.W, S.sysd, room); return c.have >= c.need && !c.orphan; });      // a head on no riser protects nothing
  r.verdict = !r.pass ? 'FAIL' : r.covOk ? 'PASS' : 'PASS (hydraulics only); coverage FAIL, see plan review';
  return r;
};

DI.hydCalcRoom = function (S, id, rm, anchor) {
  const W = S.W, inf = S.sysd.info.get(id), v = W.parts.get(id);
  const da = DI.designArea(S, id, rm, anchor); if (!da) return { ok: false, err: 'No sprinklers on this system.' };
  if (!inf.fed) return { ok: false, err: 'Riser has no water supply connection.' };
  // temporary "everything wet, pumps running, design area open" copy of the state
  const saved = da.tiles.map((k) => W.spk[k]); da.tiles.forEach((k) => { W.spk[k] = 2; });
  const ss = new Map(); for (const [sid, s] of S.ss) ss.set(sid, { state: 'wet', wat: s.vol, P: 0 });
  const T = { W, sysd: S.sysd, ss, pT: new Float32Array(W.w * W.h), pP: new Map(), leaks: [] };
  const pumps = [...W.parts.values()].filter((p) => p.type === 'epump' || p.type === 'dpump');
  const keep = pumps.map((p) => p.p.spd); pumps.forEach((p) => { p.p.spd = p.p.mode === 'off' ? 0 : 1; });
  const drains = [v.p.drain, v.p.sdrain, v.p.itc]; v.p.drain = 0; v.p.sdrain = 0; v.p.itc = 0;
  let res;
  try {
    const G = DI.buildGraph(W, T), net = G.net, nd = G.partNode.get(id);
    if (nd && nd[0] >= 0) net.dem[nd[0]] = da.hz.hose;                 // hose stream taken at the base of the riser
    for (const l of net.links) l.q = 1;
    const conv = DI.solve(net, Infinity, 120);
    let minQ = 1e9, sum = 0, minK = -1;
    for (const e of G.emit) if (e.kind === 'spk' && e.sys === id) { sum += e.link.q; if (e.link.q < minQ) { minQ = e.link.q; minK = e.k; } }
    const need = da.hz.dens * 100, pIn = nd && nd[0] >= 0 ? net.P[nd[0]] : 0;
    const pumpPts = pumps.map((p) => { const l = G.partLink.get(p.id); return { id: p.id, q: l ? l.q : 0, pct: l ? 100 * l.q / p.p.gpm : 0, on: p.p.spd > 0 }; });
    let tankMin = Infinity; for (const t of W.byType('tank')) { const l = G.partLink.get(t.id); if (l && l.q > 1) tankMin = Math.min(tankMin, t.p.cap / l.q); }
    if (!conv || !isFinite(pIn) || pIn < -500 || minQ > 1e8) { res = { ok: false, err: 'No water reaches this riser. Check for a closed valve or a missing supply connection.' }; return res; }
    const neg = pIn < 0 || minQ < 0;
    res = { ok: true, conv, room: da.room, hz: da.hz, area: da.area, n: da.n, tiles: da.tiles, dryLike: da.dryLike, need, minQ: Math.max(0, minQ), minK,
      dens: Math.max(0, minQ) / 100, sprQ: sum, total: sum + da.hz.hose, pRiser: pIn, pumpPts, tankMin,
      pass: !neg && minQ >= need - 0.05 && da.n > 0, over: pumpPts.some((p) => p.pct > 150), durOk: tankMin >= da.hz.dur };
  } finally {
    da.tiles.forEach((k, i) => { W.spk[k] = saved[i]; }); pumps.forEach((p, i) => { p.p.spd = keep[i]; });
    v.p.drain = drains[0]; v.p.sdrain = drains[1]; v.p.itc = drains[2];
  }
  return res;
};

// The calc at the most demanding area (NFPA 13 asks for the hydraulically most demanding design area): the area moved
// to the far end of every branch line (a sprinkler with no linked neighbour farther from the riser) in every room the
// system protects, and the worst result returned, with `at` (the tile the area was placed at) and `areas` (the number
// of areas checked; `n` stays the design area's sprinkler count, as in DI.hydCalc). DI.hydCalc places the area at the
// farthest sprinkler only, so a fix that strengthens just the farthest lines can pass it while the next lines along
// fail. About one ordinary calc per branch line end (a few ms each): callers cache it (DI.PZ.calcAll). Used by the
// design calls; the contracts keep DI.hydCalc.
// The tank duration and the pump point of the result (`tankMin`, `durOk`, `pumpPts`, `over`) are those of the most
// demanding area's demand, as NFPA 13 sizes a supply on the system demand of the hydraulically most demanding area. An
// area near the riser over-discharges and draws more, and it is not the basis: the same basis as DI.hydCalc, so the
// design calls judge tanks and pumps the way the contracts do (Churn). Checking every area for the highest flow would
// be a stricter rule than that, and calls 15 and 16 are tuned on this one.
DI.HYD_WORST_MAX = 96;
DI.hydCalcWorst = function (S, id) {
  const W = S.W, inf = S.sysd.info.get(id), td = S.sysd.tdist; if (!inf || inf.remote < 0) return { ok: false, err: 'No sprinklers on this system.' };
  let worst = null, n = 0;
  for (const rm of inf.rooms.size ? [...inf.rooms] : [0]) {
    const ends = inf.tiles.filter((k) => {
      if (!W.spk[k] || W.roomAt[k] !== rm) return false; const x = k % W.w, y = (k / W.w) | 0;
      for (let d = 0; d < 4; d++) if (W.linked(x, y, d)) { const q = W.k(x + DI.DX[d], y + DI.DY[d]); if (S.sysd.tileSys[q] === id && td[q] > td[k]) return false; }
      return true;
    }).sort((a, b) => td[b] - td[a]);
    for (const k of ends.slice(0, DI.HYD_WORST_MAX)) {
      const r = DI.hydCalcRoom(S, id, rm, k); if (!r.ok) return r;
      n++; r.margin = r.minQ / r.need; r.at = k; if (!worst || r.margin < worst.margin) worst = r;
    }
  }
  if (!worst) return DI.hydCalc(S, id);
  worst.pass = worst.pass && worst.margin >= 0.999; worst.areas = n;
  return DI.calcVerdict(S, inf, worst);
};
