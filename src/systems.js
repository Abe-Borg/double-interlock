// System discovery: what does each riser (wet / dry / preaction valve) actually feed?
// Flood-fills downstream of every system valve and records volume, sprinkler count, rooms,
// the hydraulically remote sprinkler, loops (gridding) and illegal cross-connections.
// Also resolves the air / nitrogen tubing layer: which gas sources feed which valve.
var DI = globalThis.DI || (globalThis.DI = {});

DI.SYSV = { wetv: 1, dryv: 1, prev: 1 };

DI.findSystems = function (W) {
  const n = W.w * W.h, DX = DI.DX, DY = DI.DY;
  const tileSys = new Int32Array(n), par = new Int32Array(n).fill(-1), dvol = new Float32Array(n), tdist = new Int32Array(n);
  const info = new Map();
  for (const v of W.parts.values()) {
    if (!DI.SYSV[v.type]) continue;
    const s = { id: v.id, type: v.type, vol: 0, nSpk: 0, tiles: [], rooms: new Set(), remote: -1, remDist: -1, gridded: false,
      bypass: false, fed: false, src: [], hasN2: false, hasAir: false, area: 0, thru: new Set() };
    info.set(v.id, s);
    const kv = W.k(v.x, v.y); tileSys[kv] = v.id;
    const o = W.ports(v).o;
    s.fed = W.linked(v.x, v.y, W.ports(v).i);
    if (!W.linked(v.x, v.y, o)) continue;
    const q = [[v.x + DX[o], v.y + DY[o], kv, 1, 0]];
    for (let h = 0; h < q.length; h++) {
      const [x, y, from, dist, vol] = q[h], k = W.k(x, y);
      if (tileSys[k] === v.id) { if (k !== kv) s.gridded = true; else s.bypass = true; continue; }
      if (tileSys[k]) { s.bypass = true; continue; }
      const p = W.at(x, y);
      if (p) {
        const t = DI.PARTS[p.type];
        if (p.type === 'fdc' || p.type === 'testhdr') { tileSys[k] = v.id; continue; }     // legitimate dead ends on a system
        if (t.ports !== 2 || DI.SYSV[p.type] || p.type === 'epump' || p.type === 'dpump' || p.type === 'jockey') { s.bypass = true; continue; }
        tileSys[k] = v.id; par[k] = from; dvol[k] = vol;
        const pp = W.ports(p);
        for (const d of [pp.i, pp.o]) {
          const nx = x + DX[d], ny = y + DY[d];
          if (W.linked(x, y, d) && W.k(nx, ny) !== from) q.push([nx, ny, k, dist + 1, vol]);
        }
        continue;
      }
      if (!W.pd[k]) continue;
      const g = DI.PIPES[W.pd[k] - 1].gal * DI.TILE_FT;
      tileSys[k] = v.id; par[k] = from; dvol[k] = vol + g / 2; tdist[k] = dist;
      s.vol += g; s.tiles.push(k);
      const rm = W.roomAt[k]; if (rm) s.thru.add(rm);
      if (W.spk[k]) { s.nSpk++; s.area += 100; if (rm) s.rooms.add(rm); if (dist > s.remDist) { s.remDist = dist; s.remote = k; } }
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (W.linked(x, y, d) && W.k(nx, ny) !== from) q.push([nx, ny, k, dist + 1, vol + g]);
      }
    }
  }
  // air / nitrogen tubing: flood each tubing network, collect the parts that touch it
  const seen = new Uint8Array(n);
  for (let k0 = 0; k0 < n; k0++) {
    if (!W.air[k0] || seen[k0]) continue;
    const st = [k0], touch = new Set(); seen[k0] = 1;
    while (st.length) {
      const k = st.pop(), x = k % W.w, y = (k / W.w) | 0;
      if (W.partAt[k]) touch.add(W.partAt[k]);
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (!W.inb(nx, ny)) continue;
        const nk = W.k(nx, ny);
        if (W.partAt[nk]) touch.add(W.partAt[nk]);
        if (W.air[nk] && !seen[nk]) { seen[nk] = 1; st.push(nk); }
      }
    }
    const srcs = [...touch].filter((id) => { const t = W.part(id).type; return t === 'comp' || t === 'n2'; });
    for (const id of touch) {
      const s = info.get(id);
      if (!s || s.type === 'wetv') continue;
      for (const sid of srcs) if (!s.src.includes(sid)) s.src.push(sid);
    }
  }
  for (const s of info.values()) {
    s.hasN2 = s.src.some((id) => W.part(id).type === 'n2');
    s.hasAir = s.src.some((id) => W.part(id).type === 'comp');
  }
  // fraction of the system that must fill before water reaches tile k (dry / preaction transit)
  const reach = (sid, k) => { const s = info.get(sid); if (!s || s.vol <= 0) return 0; return Math.min(1, (dvol[k] + 0.35 * (s.vol - dvol[k])) / s.vol); };
  return { tileSys, par, dvol, tdist, info, reach };
};
