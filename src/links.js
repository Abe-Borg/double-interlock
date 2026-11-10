// Part links: how each component appears to the hydraulic solver, plus the per-tick refresh
// (valve positions, pump speed, tank head) and the read-back of pressures onto tiles.
var DI = globalThis.DI || (globalThis.DI = {});

DI.partLinks = function (W, S, G) {
  const net = G.net; G.fixNode = new Map(); G.sysNodes = new Map(); G.fill = new Map();
  for (const p of W.parts.values()) {
    const nd = G.partNode.get(p.id); if (!nd) continue;
    const a = nd[0], b = nd[1]; let l = null;
    switch (p.type) {
      case 'gate': if (a >= 0 && b >= 0) l = net.link(a, b, { m: 2.2e-7 }); break;
      case 'check': if (a >= 0 && b >= 0) l = net.link(a, b, { m: 4.4e-7, chk: true }); break;
      case 'bfp': if (a >= 0 && b >= 0) l = net.link(a, b, { m: 7e-6, chk: true }); break;
      case 'epump': case 'dpump': case 'jockey':
        if (a >= 0 && b >= 0) l = net.link(a, b, { chk: true, pump: { gpm: p.p.gpm, psi: p.p.psi, spd: 0 } }); break;
      case 'wetv': if (a >= 0 && b >= 0) l = net.link(a, b, { m: 3e-6, chk: true }); break;
      case 'dryv': case 'prev': if (a >= 0 && b >= 0) l = net.link(a, b, { m: 5e-6, chk: true }); break;
      case 'city': { if (b < 0) break; const f = net.node(0, 0, p.p.stat); G.fixNode.set(p.id, f);
        l = net.link(f, b, { r: (p.p.stat - p.p.resid) / Math.pow(p.p.flow, 1.85), chk: true }); break; }
      case 'tank': { if (b < 0) break; const f = net.node(0, 0, 0); G.fixNode.set(p.id, f); l = net.link(f, b, { m: 1e-7, chk: true }); break; }
      case 'fdc': { if (b < 0) break; const f = net.node(0, 0, 150); G.fixNode.set(p.id, f); l = net.link(f, b, { m: 1e-5, chk: true }); break; }
    }
    if (l) { l.tag = p.type; G.partLink.set(p.id, l); }
  }
  // nodes that belong to each tripped / wet system (for fill accounting and gas coupling)
  const ts = S.sysd.tileSys, tn = G.tileNode;
  for (const [sid, s] of S.ss) {
    if (s.state === 'dry') continue;
    const set = new Set(); const inf = S.sysd.info.get(sid); if (!inf) continue;
    for (const k of inf.tiles) if (tn[k] >= 0) set.add(tn[k]);
    const nd = G.partNode.get(sid); if (nd && nd[1] >= 0) set.add(nd[1]);
    const nodes = [...set]; G.sysNodes.set(sid, nodes);
    if (s.state === 'filling') G.fill.set(sid, { nodes, cap0: nodes.map((i) => net.cap[i]), f0: Math.max(inf.vol - s.wat, 0.02 * inf.vol) / (Math.max(s.P, 0) + DI.ATM) });
  }
  DI.updateLinks(W, S, G);
};

DI.updateLinks = function (W, S, G) {
  const net = G.net;
  const want = (l, on) => { if (!on) { l.shut = true; l.open = false; l.q = 0; } else if (l.shut) { l.shut = false; l.open = true; } };
  for (const [id, l] of G.partLink) {
    const p = W.parts.get(id); if (!p) continue;
    switch (p.type) {
      case 'gate': want(l, p.p.open > 0.02); l.m = 2.2e-7 / Math.max(p.p.open * p.p.open * p.p.open, 1e-4); break;
      case 'epump': case 'dpump':
        l.pump.spd = p.p.spd; l.m = p.p.spd > 0.02 ? 0 : 8 / (p.p.gpm * p.p.gpm); break;
      case 'jockey': l.pump.spd = p.p.on ? 1 : 0; want(l, p.p.on);
        // pressure switch opens at the stop setting: never let a coarse time step carry it to shutoff head
        { const m = S.pP.get(p.id); l.pump.psi = Math.max(1, Math.min(p.p.psi, (p.p.stop + 1.5 - (m ? m[0] : 0)) / 1.2)); } break;
      case 'tank': net.fix[G.fixNode.get(id)] = (p.p.gal / p.p.cap) * p.p.ht * DI.PSI_FT; want(l, p.p.gal > 1); break;
      case 'city': net.fix[G.fixNode.get(id)] = p.p.stat; l.r = (p.p.stat - p.p.resid) / Math.pow(p.p.flow, 1.85); break;
      case 'fdc': want(l, !!p.p.active); break;
    }
  }
  for (const e of G.emit) if (e.kind === 'hdr') {     // test header hose valves throttle continuously
    const o = W.parts.get(e.pid).p.open; want(e.link, o > 0.001); e.link.m = 1 / Math.pow(62 * Math.max(o, 0.001), 2);
  }
  for (const [sid, f] of G.fill) {       // gas cushion stiffens as the system fills
    const s = S.ss.get(sid), inf = S.sysd.info.get(sid);
    const k = (Math.max(inf.vol - s.wat, 0.02 * inf.vol) / (Math.max(s.P, 0) + DI.ATM)) / f.f0;
    for (let i = 0; i < f.nodes.length; i++) net.cap[f.nodes[i]] = f.cap0[i] * k;
  }
};

// copy solved pressures back to tiles / part ports and roll pPrev forward
DI.readback = function (W, S, G) {
  const net = G.net, P = net.P, tn = G.tileNode;
  for (let i = 0; i < net.n; i++) if (isNaN(net.fix[i])) net.pPrev[i] = P[i];
  for (let k = 0; k < tn.length; k++) if (tn[k] >= 0) S.pT[k] = P[tn[k]];
  for (const [id, nd] of G.partNode) {
    let m = S.pP.get(id); if (!m) { m = [0, 0]; S.pP.set(id, m); }
    if (nd[0] >= 0) m[0] = P[nd[0]]; if (nd[1] >= 0) m[1] = P[nd[1]];
  }
};

// flow (gpm, signed toward E / S) on the E or S edge of tile k
DI.edgeFlow = function (G, k, south) {
  const i = k * 2 + (south ? 1 : 0), li = G.eL[i];
  return li ? G.net.links[li - 1].q * G.eS[i] : 0;
};
