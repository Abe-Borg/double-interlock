// Graph builder: turns the tile map into a small hydraulic network for the solver.
// Raw graph = one node per pipe tile / part port. Then: dead ends with no outlet are pruned into
// their parent (their volume becomes capacitance) and runs of pipe are merged into single links.
// Dry (untripped) systems hold gas, not water, so their tiles are left out entirely.
var DI = globalThis.DI || (globalThis.DI = {});

DI.FIT = 1.3;                 // equivalent-length multiplier for fittings
DI.CAPW = 3e-5;               // gal/psi of "give" per gallon of water-filled pipe (trapped air pockets)

DI.buildGraph = function (W, S) {
  const n = W.w * W.h, DX = DI.DX, DY = DI.DY, OPP = DI.OPP, sd = S.sysd, ts = sd.tileSys;
  const net = new DI.Net(), atm = net.node(0, 0, 0);
  const G = { net, atm, tileNode: new Int32Array(n).fill(-1), partNode: new Map(), partLink: new Map(),
    eL: new Int32Array(n * 2), eS: new Int8Array(n * 2), emit: [], ver: W.ver };
  const st = (id) => S.ss.get(id);
  const isDry = (sid) => { const s = sid && st(sid); return !!s && s.state === 'dry'; };
  const rawOf = new Int32Array(n).fill(-1);
  const rCap = [], rKeep = [], rTile = [], rP = [];
  const raw = (cap, keep, tile, p) => { rCap.push(cap); rKeep.push(keep ? 1 : 0); rTile.push(tile); rP.push(p); return rCap.length - 1; };
  const Cof = () => DI.pipeC();          // company rule: one C for all pipe, any state, indoors or out
  const halfR = (k) => DI.hw(Cof(k), DI.pipeAt(W, k).id) * 5 * DI.FIT;
  // --- raw nodes
  for (let k = 0; k < n; k++) {
    if (!W.pd[k] || isDry(ts[k])) continue;
    const vol = DI.pipeAt(W, k).gal * 10, s = ts[k] && st(ts[k]);
    let cap = vol * DI.CAPW + 1e-5;
    if (s && s.state === 'filling') { const inf = sd.info.get(ts[k]); cap = (vol / inf.vol) * Math.max(inf.vol - s.wat, 0.02 * inf.vol) / (Math.max(s.P, 0) + DI.ATM); }
    rawOf[k] = raw(cap, 0, k, S.pT[k]);
  }
  const pRaw = new Map();
  for (const p of W.parts.values()) {
    const pt = W.ports(p); if (pt.i < 0 && pt.o < 0) continue;
    const k = W.k(p.x, p.y), mem = S.pP.get(p.id) || [0, 0];
    const inner = ts[k] && ts[k] !== p.id && isDry(ts[k]);
    const a = pt.i >= 0 && !inner ? raw(1e-5, 1, -1, mem[0]) : -1;
    const b = pt.o >= 0 && !inner && !(DI.SYSV[p.type] && isDry(p.id)) ? raw(1e-5, 1, -1, mem[1]) : -1;
    pRaw.set(p.id, [a, b]);
  }
  const side = (x, y, d) => {           // raw node of tile (x,y) facing direction d
    const k = W.k(x, y); if (W.pd[k]) return rawOf[k];
    const p = W.parts.get(W.partAt[k]); if (!p) return -1;
    const r = pRaw.get(p.id); if (!r) return -1;
    return W.ports(p).i === d ? r[0] : r[1];
  };
  // --- raw edges (E and S of every tile)
  const eA = [], eB = [], eR = [], eI = [];
  for (let k = 0; k < n; k++) {
    if (!W.pd[k] && !W.partAt[k]) continue;
    const x = k % W.w, y = (k / W.w) | 0;
    for (let d = 1; d <= 2; d++) {
      if (!W.linked(x, y, d)) continue;
      const nx = x + DX[d], ny = y + DY[d], a = side(x, y, d), b = side(nx, ny, OPP[d]);
      if (a < 0 || b < 0) continue;
      const nk = W.k(nx, ny);
      eA.push(a); eB.push(b); eR.push((W.pd[k] ? halfR(k) : 0) + (W.pd[nk] ? halfR(nk) : 0)); eI.push(k * 2 + d - 1);
    }
  }
  // --- emitters (outlets to atmosphere)
  const em = [];
  const wetAt = (k) => { const sid = ts[k], s = sid && st(sid); if (!s || s.state === 'wet') return true; if (s.state === 'dry') return false; return s.wat / sd.info.get(sid).vol >= sd.reach(sid, k); };
  for (let k = 0; k < n; k++) if (W.spk[k] >= 2 && rawOf[k] >= 0 && wetAt(k)) em.push({ raw: rawOf[k], K: DI.SPK_K, kind: 'spk', k, sys: ts[k] });
  for (const lk of S.leaks) if (rawOf[lk.k] >= 0 && wetAt(lk.k)) em.push({ raw: rawOf[lk.k], K: lk.K, kind: 'leak', k: lk.k, sys: ts[lk.k] });
  for (const p of W.parts.values()) {
    const r = pRaw.get(p.id); if (!r) continue;
    if (DI.SYSV[p.type]) {
      const inf = sd.info.get(p.id), k = W.k(p.x, p.y);
      if (p.p.itc && inf.remote >= 0 && rawOf[inf.remote] >= 0 && wetAt(inf.remote)) em.push({ raw: rawOf[inf.remote], K: DI.SPK_K, kind: 'itc', k: inf.remote, sys: p.id });
      if (p.type === 'wetv') { if (p.p.drain && r[1] >= 0) em.push({ raw: r[1], K: 32 * p.p.drain, kind: 'drain', k, sys: p.id }); }
      else {
        if (p.p.drain && r[0] >= 0) em.push({ raw: r[0], K: 32 * p.p.drain, kind: 'mdrain', k, sys: 0 });
        // the system drain passes water only while water is at it. Air out an open drain is air: the gas model
        // vents it (DI.gasPre), and it never counts as water flow or gpm.
        const ds = st(p.id), drainWet = !!ds && (ds.state === 'wet' || (ds.state === 'filling' && ds.wat > DI.dryLim(inf.vol)));
        if (p.p.sdrain && r[1] >= 0 && drainWet) em.push({ raw: r[1], K: 32 * p.p.sdrain, kind: 'drain', k, sys: p.id });
      }
    } else if (p.type === 'testhdr' && r[0] >= 0) em.push({ raw: r[0], K: 62 * Math.max(p.p.open, 0.001), kind: 'hdr', k: W.k(p.x, p.y), sys: 0, pid: p.id });
  }
  for (const e of em) rKeep[e.raw] = 1;
  // --- prune dead ends, merge runs
  const R = rCap.length, deg = new Int32Array(R), adj = Array.from({ length: R }, () => []);
  for (let e = 0; e < eA.length; e++) { adj[eA[e]].push(e); adj[eB[e]].push(e); deg[eA[e]]++; deg[eB[e]]++; }
  const dead = new Uint8Array(R), rep = new Int32Array(R).fill(-1), q = [];
  for (let i = 0; i < R; i++) if (!rKeep[i] && deg[i] <= 1) q.push(i);
  while (q.length) {
    const u = q.pop(); if (dead[u]) continue; dead[u] = 1;
    for (const e of adj[u]) {
      const v = eA[e] === u ? eB[e] : eA[e]; if (dead[v]) continue;
      rCap[v] += rCap[u]; rep[u] = v;
      if (--deg[v] <= 1 && !rKeep[v]) q.push(v);
    }
  }
  const inter = (i) => !dead[i] && !rKeep[i] && deg[i] === 2;
  const nodeOf = new Int32Array(R).fill(-1);
  for (let i = 0; i < R; i++) if (!dead[i] && !inter(i)) nodeOf[i] = net.node(rP[i], rCap[i]);
  const done = new Uint8Array(eA.length);
  for (let u = 0; u < R; u++) {
    if (nodeOf[u] < 0) continue;
    for (const e0 of adj[u]) {
      if (done[e0]) continue;
      let e = e0, prev = u, cur = eA[e] === u ? eB[e] : eA[e], r = 0; const run = [];
      if (dead[cur]) continue;
      for (;;) {
        done[e] = 1; r += eR[e]; run.push(e, eA[e] === prev ? 1 : -1);
        if (!inter(cur)) break;
        net.cap[nodeOf[u]] += rCap[cur]; rep[cur] = u;
        let nx = -1; for (const f of adj[cur]) if (f !== e) { const o = eA[f] === cur ? eB[f] : eA[f]; if (!dead[o]) { nx = f; break; } }
        if (nx < 0) break;
        prev = cur; e = nx; cur = eA[e] === prev ? eB[e] : eA[e];
      }
      if (nodeOf[cur] < 0) continue;
      net.link(nodeOf[u], nodeOf[cur], { r: Math.max(r, 1e-9) });
      for (let i = 0; i < run.length; i += 2) { G.eL[eI[run[i]]] = net.links.length; G.eS[eI[run[i]]] = run[i + 1]; }
    }
  }
  const find = (i) => { let g = 0; while (i >= 0 && nodeOf[i] < 0 && g++ < 1e5) i = rep[i]; return i < 0 ? -1 : nodeOf[i]; };
  for (let k = 0; k < n; k++) if (rawOf[k] >= 0) G.tileNode[k] = find(rawOf[k]);
  for (const [id, r] of pRaw) G.partNode.set(id, [r[0] >= 0 ? nodeOf[r[0]] : -1, r[1] >= 0 ? nodeOf[r[1]] : -1]);
  for (const e of em) { e.link = net.link(nodeOf[e.raw], atm, { m: 1 / (e.K * e.K), chk: true, tag: e.kind }); G.emit.push(e); }
  DI.partLinks(W, S, G);
  return G;
};
