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
      const g = DI.pipeAt(W, k).gal * DI.TILE_FT;
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

// Sprinkler coverage of one room: tiles that need a head, tiles that have one, heads on no system.
DI.roomCoverage = function (W, sd, room) {
  let need = 0, have = 0, orphan = 0;
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
    const k = W.k(x, y); if (W.partAt[k]) continue; need++;
    if (W.spk[k]) { have++; if (!sd.tileSys[k]) orphan++; }
    else if (W.pd[k] && (W.spk[k - 1] || W.spk[k + 1] || W.spk[k - W.w] || W.spk[k + W.w])) have++;   // a main between branch lines
  }
  return { need, have, orphan };
};

// Nearest control valve upstream of a system valve (walk the supply pipe run back from the riser inlet).
DI.ctrlValve = function (W, id) {
  const v = W.parts.get(id); if (!v) return null;
  const seen = new Set(), q = [[v.x, v.y, W.ports(v).i]];
  for (let h = 0; h < q.length && h < 400; h++) {
    const [x, y, d] = q[h]; if (!W.linked(x, y, d)) continue; const nx = x + DI.DX[d], ny = y + DI.DY[d], k = W.k(nx, ny); if (seen.has(k)) continue; seen.add(k);
    const o = W.at(nx, ny); if (o) { if (o.type === 'gate') return o; continue; }
    for (let e = 0; e < 4; e++) if (e !== DI.OPP[d]) q.push([nx, ny, e]);
  }
  return null;
};

// ---------- water delivery
// Full zone volume = pipe + a fittings allowance + the valve trim (project settings, ASSUMED 5 % and 2 gal).
// inf.vol stays pipe only; every delivery rule is judged on the zone volume.
DI.zoneVolume = (W, inf) => inf.vol * (1 + DI.cfgNum(W, 'fitPct') / 100) + DI.cfgNum(W, 'trimGal');
// the most demanding hazard among the rooms a system protects (key into DI.HAZ)
DI.sysHazard = function (W, inf) {
  let key = '';
  for (const r of inf.rooms) { const h = DI.ROOMS[W.rooms[r - 1].type].haz; if (!key || DI.HAZ[h].dens > DI.HAZ[key].dens) key = h; }
  return key || 'OH1';
};
// The limits that apply to a zone of `zone` gallons. Pure: no world needed, so the thresholds can be tested exactly.
//   NFPA 13: dry needs the 60 s timed test above 500 gal, or above 750 gal with a quick-opening device.
//            Double interlock needs it above 500 gal and a QOD does not extend that. Wet: nothing.
//   FM:      30 s at any volume for dry and double interlock, only when the site insurer is FM (NEEDS PE REVIEW).
//   The most stringent limit governs.
DI.deliveryRule = function (type, qod, zone, insurer) {
  const D = DI.DELIVERY, R = DI.juris.ref, o = { type, zone, nfpa: { limit: null, thr: null, rule: '', ref: '' }, fm: { limit: null, rule: 'FM: not applied' }, governing: null, by: '' };
  if (type !== 'dryv' && type !== 'prev') return o;
  const thr = type === 'dryv' ? (qod ? D.dryQod : D.dry) : D.di, over = zone > thr;
  const ref = type === 'prev' ? R.di : over ? R.timedTest : qod ? R.qod : R.noQod;
  o.nfpa = { limit: over ? D.timed : null, thr, ref, rule: (over ? 'NFPA 13: ' + D.timed + ' s (over ' + thr + ' gal)' : 'NFPA 13: no timed test (' + thr + ' gal or less)') + ' [' + ref + ']' };
  if (insurer === 'FM') o.fm = { limit: D.fm, rule: 'FM: ' + D.fm + ' s (any volume, ' + D.fmRef.replace('FM ', '') + ', NEEDS PE REVIEW)' };
  for (const [by, l] of [['NFPA', o.nfpa.limit], ['FM', o.fm.limit]]) if (l !== null && (o.governing === null || l < o.governing)) { o.governing = l; o.by = by; }
  return o;
};
// Limits for system `id` on this site, with the margin against a measured delivery time (seconds) if one is given.
// margin = governing - measured: negative means it failed. null when no limit applies or nothing was measured.
DI.deliveryLimits = function (S, id, measured) {
  const W = S.W, v = W.parts.get(id), inf = S.sysd.info.get(id); if (!v || !inf) return null;
  DI.setJuris(W);
  const o = DI.deliveryRule(v.type, !!v.p.qod, DI.zoneVolume(W, inf), DI.insurer(W));
  o.pipe = inf.vol; o.margin = o.governing !== null && measured > 0 ? o.governing - measured : null;
  return o;
};
