// Map renderer (Canvas 2D). Pure view: reads game state, never changes it.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const TAU = Math.PI * 2, C = DI.COL;
  DI.partState = function (g, p, now) {
    const S = g.S, q = p.p, st = { t: now, rot: p.rot };
    switch (p.type) {
      case 'gate': st.open = q.open; break;
      case 'epump': st.spd = q.spd; st.pw = S.powered(p); break;
      case 'dpump': st.spd = q.spd; break;
      case 'jockey': case 'comp': case 'n2': st.on = q.on; break;
      case 'tank': st.frac = q.gal / q.cap; break;
      case 'city': st.loop = q.loop; break;
      case 'fdc': st.on = q.active; break;
      case 'testhdr': st.open = q.open; break;
      case 'wetv': case 'dryv': case 'prev': { const s = S.ss.get(p.id), i = S.sysd.info.get(p.id); if (s) { st.alarm = s.alarm; st.tripped = s.state !== 'dry'; st.low = s.lowAir && s.state === 'dry'; st.sol = q.solOut; st.det = q.sol || q.pull || q.mrzL; st.pl = q.pLatch; st.n2 = i && i.hasN2; st.imp = p.type === 'prev' && !!S.contract && DI.stationType(g.W, p) === 'MANUAL RELEASE'; } break; }
      case 'panel': { let al = 0, sv = 0, tr = 0, op = 0; for (const o of S.sig.values()) if (o.mon && !o.sup && !o.lost) { if (o.type === 'ALARM') al = 1; else if (o.type === 'OPEN') op = 1; else if (o.type === 'SUPV') sv = 1; else tr = 1; }
        if (q.alive === false) al = sv = tr = op = 0;          // a dead panel is dark: every LED off, the green power LED too
        st.al = al; st.sv = sv; st.tr = tr; st.op = op; st.alive = q.alive; st.sil = q.silenced; break; }
      case 'mstn': st.on = q.on; break;
      case 'vesda': case 'smoke': st.lvl = q.lvl; break;
    }
    return st;
  };
  const pipeW = (W, k, z) => Math.max(1.6, (1.2 + DI.pipeAt(W, k).id * 0.62) * z / 22);

  DI.draw = function (g, c, cw, ch, now) {
    const W = g.W, S = g.S, z = g.cam.z, ox = Math.round(cw / 2 - g.cam.x * z), oy = Math.round(ch / 2 - g.cam.y * z), w = W.w;
    const x0 = Math.max(0, Math.floor(-ox / z)), y0 = Math.max(0, Math.floor(-oy / z)), x1 = Math.min(W.w - 1, Math.ceil((cw - ox) / z)), y1 = Math.min(W.h - 1, Math.ceil((ch - oy) / z));
    const ts = S.sysd.tileSys, G = S.G;
    c.setTransform(DI.dpr || 1, 0, 0, DI.dpr || 1, 0, 0); c.fillStyle = '#070b0f'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = '#0d141b'; c.fillRect(ox, oy, W.w * z, W.h * z);
    if (z >= 9) { c.strokeStyle = 'rgba(120,150,175,0.07)'; c.lineWidth = 1; c.beginPath(); for (let x = x0; x <= x1 + 1; x++) { c.moveTo(ox + x * z + 0.5, oy + y0 * z); c.lineTo(ox + x * z + 0.5, oy + (y1 + 1) * z); } for (let y = y0; y <= y1 + 1; y++) { c.moveTo(ox + x0 * z, oy + y * z + 0.5); c.lineTo(ox + (x1 + 1) * z, oy + y * z + 0.5); } c.stroke(); }
    // rooms
    for (const r of W.rooms) {
      const rt = DI.ROOMS[r.type], X = ox + r.x * z, Y = oy + r.y * z, RW = r.w * z, RH = r.h * z;
      c.fillStyle = rt.col; c.fillRect(X, Y, RW, RH);
      if (r.temp < 36) { c.fillStyle = 'rgba(120,190,255,' + DI.clamp((36 - r.temp) / 60, 0.05, 0.3) + ')'; c.fillRect(X, Y, RW, RH); }
      c.strokeStyle = rt.open ? 'rgba(170,190,205,0.35)' : 'rgba(190,210,225,0.7)'; c.lineWidth = rt.open ? 1 : 2; if (rt.open) c.setLineDash([6, 5]); c.strokeRect(X + 1, Y + 1, RW - 2, RH - 2); c.setLineDash([]);
    }
    // floor state: water, char, racks
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x, rm = W.roomAt[k]; if (!rm) continue; const X = ox + x * z, Y = oy + y * z;
      const ty = W.rooms[rm - 1].type;
      if (z >= 12 && (ty === 'hall' || ty === 'batt' || ty === 'elec') && !W.partAt[k] && (x - W.rooms[rm - 1].x) % 3 !== 1) { c.fillStyle = S.burn[k] > 0.5 ? '#1a1410' : S.wet[k] > 30 ? '#16324a' : 'rgba(90,120,140,0.16)'; c.fillRect(X + z * 0.18, Y + z * 0.1, z * 0.64, z * 0.8); }
      if (S.wet[k] > 0.5) { c.fillStyle = 'rgba(58,166,255,' + Math.min(0.42, S.wet[k] / 120) + ')'; c.fillRect(X, Y, z, z); }
      if (S.burn[k] > 0.01) { c.fillStyle = 'rgba(8,5,3,' + Math.min(0.85, S.burn[k] * 1.4) + ')'; c.fillRect(X, Y, z, z); }
    }
    for (const r of W.rooms) { const sm = S.smoke[r.id]; if (sm > 0.02) { c.fillStyle = 'rgba(150,150,150,' + Math.min(0.5, 0.05 + Math.log10(1 + sm * 8) * 0.13) + ')'; c.fillRect(ox + r.x * z, oy + r.y * z, r.w * z, r.h * z); } }
    // air tubing
    c.strokeStyle = 'rgba(233,216,160,0.85)'; c.lineWidth = Math.max(1, z * 0.07); c.setLineDash([z * 0.16, z * 0.12]); c.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x; if (!W.air[k]) continue; const X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z; let n = 0;
      for (let d = 0; d < 4; d++) { const nx = x + DI.DX[d], ny = y + DI.DY[d]; if (!W.inb(nx, ny)) continue; const nk = ny * w + nx; if (W.air[nk] || W.partAt[nk]) { c.moveTo(X, Y); c.lineTo(X + DI.DX[d] * z * (W.air[nk] ? 0.5 : 0.8), Y + DI.DY[d] * z * (W.air[nk] ? 0.5 : 0.8)); n++; } }
      if (!n) { c.moveTo(X - 2, Y); c.lineTo(X + 2, Y); }
    }
    c.stroke(); c.setLineDash([]);
    // pipes
    c.lineCap = 'round';
    const fracOf = new Map(); for (const [id, s] of S.ss) fracOf.set(id, s);
    const col = (k) => {
      const sid = ts[k], s = sid ? fracOf.get(sid) : null, p = S.pT[k];
      if (s && (s.state === 'dry' || (s.state === 'filling' && s.wat / s.vol < S.sysd.reach(sid, k)))) {
        const n2 = s.G > 0 ? 1 - DI.clamp((s.o2g / s.G - 0.015) / 0.19, 0, 1) : 0, a = 0.35 + Math.min(0.6, Math.max(0, s.P) / 40);
        return 'rgba(' + Math.round(233 - 122 * n2) + ',' + Math.round(216 + 11 * n2) + ',' + Math.round(160 + 38 * n2) + ',' + a + ')';
      }
      return p < 0.8 ? '#3c5567' : 'hsl(207,88%,' + (30 + Math.min(1, p / 150) * 32) + '%)';
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x; if (!W.pd[k]) continue;
      const X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, lw = pipeW(W, k, z); let n = 0;
      c.strokeStyle = col(k); c.lineWidth = lw;
      for (let d = 0; d < 4; d++) if (W.linked(x, y, d)) { n++; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + DI.DX[d] * z * 0.5, Y + DI.DY[d] * z * 0.5); c.stroke(); }
      if (n < 2) { c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(X, Y, lw * 0.75, 0, TAU); c.fill(); }
    }
    // capped joints
    if (z >= 7) { c.strokeStyle = '#ffd24a'; c.lineWidth = Math.max(2, z * 0.11); c.lineCap = 'butt'; c.beginPath();
      // a cap between a pipe and a part (a test blank at a pump inlet) is drawn too
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * w + x; if (!W.pd[k] && !W.partAt[k]) continue;
        if (W.cut[k * 2] && (W.pd[k + 1] || W.partAt[k + 1]) && x < w - 1) { c.moveTo(ox + (x + 1) * z, oy + (y + 0.28) * z); c.lineTo(ox + (x + 1) * z, oy + (y + 0.72) * z); }
        if (W.cut[k * 2 + 1] && (W.pd[k + w] || W.partAt[k + w])) { c.moveTo(ox + (x + 0.28) * z, oy + (y + 1) * z); c.lineTo(ox + (x + 0.72) * z, oy + (y + 1) * z); } }
      c.stroke(); c.lineCap = 'round'; }
    // flow animation
    if (G && z >= 8) {
      c.strokeStyle = 'rgba(235,248,255,0.85)';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = y * w + x; if (!W.pd[k] && !W.partAt[k]) continue;
        for (let s = 0; s < 2; s++) {
          const q = DI.edgeFlow(G, k, s === 1); if (Math.abs(q) < 0.4) continue;
          const d = s ? 2 : 1, X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, sp = Math.min(3.2, 0.5 + Math.abs(q) / 160);
          c.lineWidth = Math.max(1.2, z * 0.07); c.setLineDash([z * 0.16, z * 0.34]); c.lineDashOffset = -Math.sign(q) * now * sp * z * 0.9;
          c.beginPath(); c.moveTo(X, Y); c.lineTo(X + DI.DX[d] * z, Y + DI.DY[d] * z); c.stroke();
        }
      }
      c.setLineDash([]);
    }
    // pipe breaks: a red cross on the tile
    for (const lk of S.leaks) if (lk.a) {
      const X = ox + ((lk.k % w) + 0.5) * z, Y = oy + (((lk.k / w) | 0) + 0.5) * z, r = z * 0.3;
      c.strokeStyle = C.red; c.lineWidth = Math.max(1.5, z * 0.09); c.beginPath(); c.moveTo(X - r, Y - r); c.lineTo(X + r, Y + r); c.moveTo(X + r, Y - r); c.lineTo(X - r, Y + r); c.stroke();
    }
    // sprinklers
    if (z >= 6) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x, sp = W.spk[k]; if (!sp) continue; const X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, r = Math.max(1.6, z * 0.13);
      if (sp >= 2 && S.dens[k] > 0.01) {
        const pr = z * (0.62 + 0.06 * Math.sin(now * 7 + k)); const gr = c.createRadialGradient(X, Y, 1, X, Y, pr); gr.addColorStop(0, 'rgba(150,215,255,0.75)'); gr.addColorStop(1, 'rgba(58,166,255,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(X, Y, pr, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(210,238,255,0.7)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + (k % 7), f = (now * 1.6 + i * 0.37) % 1; c.moveTo(X + Math.cos(a) * z * 0.15 * (1 + 3 * f), Y + Math.sin(a) * z * 0.15 * (1 + 3 * f)); c.lineTo(X + Math.cos(a) * z * 0.15 * (1.5 + 3 * f), Y + Math.sin(a) * z * 0.15 * (1.5 + 3 * f)); } c.stroke();
      }
      c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fillStyle = sp === 1 ? '#f2f6f8' : sp === 2 ? C.amb : C.red; c.fill();
      if (sp >= 2) { c.strokeStyle = sp === 2 ? C.amb : C.red; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y, r * 2.1, 0, TAU); c.stroke(); }
      else if (S.lt[k] > 30) { c.strokeStyle = 'rgba(255,120,40,' + Math.min(1, (S.lt[k] - 30) / 38) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y, r * 1.8, 0, TAU * (S.lt[k] - 21) / 47); c.stroke(); }
    }
    // wires
    const showW = g.tool.type === 'wire' || (g.sel && g.sel.kind === 'part');
    c.lineWidth = 1; c.setLineDash([3, 4]);
    for (const wr of W.wires) { const a = W.parts.get(wr[0]), b = W.parts.get(wr[1]); if (!a || !b) continue; const hot = showW && (g.tool.type === 'wire' || g.sel.id === a.id || g.sel.id === b.id);
      c.strokeStyle = hot ? 'rgba(255,90,70,0.9)' : 'rgba(255,90,70,0.16)'; c.beginPath(); c.moveTo(ox + (a.x + 0.5) * z, oy + (a.y + 0.5) * z); c.lineTo(ox + (b.x + 0.5) * z, oy + (b.y + 0.5) * z); c.stroke(); }
    c.setLineDash([]);
    // parts
    for (const p of W.parts.values()) {
      if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      c.save(); c.translate(ox + (p.x + 0.5) * z, oy + (p.y + 0.5) * z); c.rotate(p.rot * Math.PI / 2); c.scale(z, z); c.lineCap = 'round'; c.lineJoin = 'round';
      DI.glyph(c, p.type, DI.partState(g, p, now)); c.restore();
    }
    // fire
    for (const k of S.fires) {
      const x = k % w, y = (k / w) | 0, X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, q = S.fq[k];
      if (S.fi[k] > 0) { c.fillStyle = 'rgba(190,190,190,' + (0.25 + 0.15 * Math.sin(now * 5)) + ')'; c.beginPath(); c.arc(X, Y - z * 0.2 * ((now * 0.6) % 1), z * (0.18 + 0.2 * ((now * 0.6) % 1)), 0, TAU); c.fill(); c.fillStyle = '#ff7a2e'; c.beginPath(); c.arc(X, Y, z * 0.09, 0, TAU); c.fill(); continue; }
      const r = z * (0.35 + Math.min(1.9, Math.sqrt(q) / 26)) * (0.9 + 0.14 * Math.sin(now * 17 + k) + 0.08 * Math.sin(now * 31 + k * 2));
      const gr = c.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, 'rgba(255,244,190,0.95)'); gr.addColorStop(0.35, 'rgba(255,150,40,0.85)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
    }
    if (z >= 7) { c.font = '700 ' + Math.max(9, Math.min(12, z * 0.55)) + 'px Segoe UI,system-ui,sans-serif'; c.textBaseline = 'bottom'; c.textAlign = 'left';
      for (const r of W.rooms) { const t = r.name.toUpperCase() + (r.exempt ? ' (by others)' : '') + (DI.ROOMS[r.type].cond ? '' : ' \u00b7 UNHEATED ' + DI.fmt(r.temp) + '\u00b0F'), X = ox + r.x * z, Y = oy + r.y * z - 2, tw = c.measureText(t).width;
        c.fillStyle = 'rgba(8,12,16,0.82)'; c.fillRect(X, Y - 15, tw + 10, 15); c.fillStyle = r.temp < 32 ? '#8fd0ff' : 'rgba(215,226,234,0.85)'; c.fillText(t, X + 5, Y - 2); } }
    DI.drawOverlay(g, c, ox, oy, z, now);
  };

  DI.drawOverlay = function (g, c, ox, oy, z, now) {
    const W = g.W, S = g.S;
    const box = (x, y, colr, lw, fill) => { if (fill) { c.fillStyle = fill; c.fillRect(ox + x * z, oy + y * z, z, z); } c.strokeStyle = colr; c.lineWidth = lw || 1.5; c.strokeRect(ox + x * z + 1, oy + y * z + 1, z - 2, z - 2); };
    if (g.calcShow) { const cs = g.calcShow; for (const k of cs.tiles) box(k % W.w, (k / W.w) | 0, cs.pass ? 'rgba(61,220,145,0.9)' : 'rgba(255,75,58,0.9)', 2, cs.pass ? 'rgba(61,220,145,0.12)' : 'rgba(255,75,58,0.14)'); }
    if (g.sel) {
      if (g.sel.kind === 'part') { const p = W.parts.get(g.sel.id); if (p) { box(p.x, p.y, '#fff', 2);
        const inf = S.sysd.info.get(p.id); if (inf && inf.remote >= 0) { const x = inf.remote % W.w, y = (inf.remote / W.w) | 0; c.fillStyle = '#ffd24a'; c.font = '700 10px Consolas,monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('ITC', ox + (x + 0.5) * z, oy + y * z - 1); box(x, y, '#ffd24a', 1.5); } } }
      else if (g.sel.kind === 'tile') box(g.sel.k % W.w, (g.sel.k / W.w) | 0, '#fff', 2);
    }
    if (g.mark && now - g.mark.t < 4) { const a = 1 - (now - g.mark.t) / 4; c.strokeStyle = 'rgba(255,210,74,' + a + ')'; c.lineWidth = 3; c.beginPath(); c.arc(ox + (g.mark.x + 0.5) * z, oy + (g.mark.y + 0.5) * z, z * (1 + 2 * (1 - a)), 0, TAU); c.stroke(); }
    const gh = g.ghost;
    if (gh) {
      for (const t of gh.tiles) box(t[0], t[1], gh.ok ? 'rgba(120,200,255,0.9)' : 'rgba(255,75,58,0.9)', 1.5, gh.ok ? 'rgba(58,166,255,0.2)' : 'rgba(255,75,58,0.2)');
      if (gh.part && gh.tiles.length) { const t = gh.tiles[0]; c.save(); c.globalAlpha = 0.75; c.translate(ox + (t[0] + 0.5) * z, oy + (t[1] + 0.5) * z); c.rotate(g.tool.rot * Math.PI / 2); c.scale(z, z); c.lineCap = 'round'; DI.glyph(c, gh.part, { open: 1, frac: 0.6, mode: 'double', rot: g.tool.rot }); c.restore(); }
      if (gh.label && gh.tiles.length) { const t = gh.tiles[gh.tiles.length - 1]; c.font = '600 12px Consolas,monospace'; c.textAlign = 'left'; c.textBaseline = 'bottom'; const tw = c.measureText(gh.label).width; c.fillStyle = 'rgba(8,12,16,0.9)'; c.fillRect(ox + (t[0] + 1) * z + 4, oy + t[1] * z - 18, tw + 10, 18); c.fillStyle = gh.ok ? '#bfe6ff' : '#ff9488'; c.fillText(gh.label, ox + (t[0] + 1) * z + 9, oy + t[1] * z - 3); }
    }
    if (g.wireFrom) { const p = W.parts.get(g.wireFrom); if (p && g.hover) { c.strokeStyle = '#ff5a46'; c.setLineDash([4, 4]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(ox + (p.x + 0.5) * z, oy + (p.y + 0.5) * z); c.lineTo(ox + (g.hover.x + 0.5) * z, oy + (g.hover.y + 0.5) * z); c.stroke(); c.setLineDash([]); } }
  };
})();
