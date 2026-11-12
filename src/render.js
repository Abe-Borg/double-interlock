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
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const siteLayers = new WeakMap();
  const roomAccent = { hall: '#59c9e0', tel: '#88a5f4', elec: '#b39bde', batt: '#e1a08d', dock: '#c2b67e', cold: '#93d4ef', pump: '#73b8aa', riser: '#7ab3c4', office: '#8fa9ce', stor: '#c6b174' };
  // Repeatable architectural detail. No random numbers or simulation writes in the view.
  function rack(c, X, Y, z, type, k, powered) {
    const x = X + z * 0.2, y = Y + z * 0.13, rw = z * 0.6, rh = z * 0.73;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + z * 0.08, y + z * 0.09, rw, rh);
    c.fillStyle = '#243744'; c.fillRect(x, y, rw, rh);
    c.strokeStyle = '#526977'; c.lineWidth = Math.max(0.6, z * 0.025); c.strokeRect(x, y, rw, rh);
    c.fillStyle = '#14232e'; c.fillRect(x + z * 0.06, y + z * 0.06, rw - z * 0.12, rh - z * 0.12);
    c.fillStyle = 'rgba(169,196,208,0.24)'; c.fillRect(x + 1, y + 1, rw - 2, Math.max(1, z * 0.035));
    if (z < 17) return;
    const rows = type === 'hall' || type === 'tel' ? 4 : 2;
    for (let i = 0; i < rows; i++) {
      const yy = y + z * (0.15 + i * (0.5 / rows));
      c.fillStyle = '#354b59'; c.fillRect(x + z * 0.11, yy, z * 0.35, Math.max(1, z * 0.055));
      c.fillStyle = !powered ? '#35414a' : ((k + i * 3) % 7 === 0 ? '#416c76' : '#7ddfc3');
      c.fillRect(x + z * 0.42, yy, Math.max(1, z * 0.045), Math.max(1, z * 0.045));
    }
  }

  function fireEffect(c, X, Y, z, k, q, incipient, now) {
    const heat = Math.min(1.8, Math.sqrt(Math.max(0, q)) / 26), r = z * (incipient ? 0.3 : 0.35 + heat);
    // Smoke puffs drift upward and become more transparent as they disperse.
    for (let i = 0; i < 4; i++) {
      const t = (now * 0.36 + i / 4 + (k % 13) / 13) % 1, pr = r * (0.3 + t * 0.75);
      const px = X + Math.sin(t * 4 + k) * r * 0.24, py = Y - r * (0.3 + t * 1.65);
      const smoke = c.createRadialGradient(px, py, 0, px, py, pr);
      smoke.addColorStop(0, 'rgba(132,146,157,' + (0.23 * (1 - t)) + ')'); smoke.addColorStop(1, 'rgba(83,96,112,0)');
      c.fillStyle = smoke; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
    }
    const glow = c.createRadialGradient(X, Y, 0, X, Y, r * 1.65);
    glow.addColorStop(0, 'rgba(255,157,53,0.5)'); glow.addColorStop(0.35, 'rgba(255,81,27,0.2)'); glow.addColorStop(1, 'rgba(255,64,20,0)');
    c.globalCompositeOperation = 'lighter'; c.fillStyle = glow; c.beginPath(); c.arc(X, Y, r * 1.65, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
    if (incipient) { c.fillStyle = '#ffc079'; c.beginPath(); c.arc(X, Y, z * 0.08, 0, TAU); c.fill(); return; }
    // Three overlapping tongues retain a recognizable flame silhouette at any zoom.
    for (let i = 0; i < 3; i++) {
      const flicker = 0.9 + 0.12 * Math.sin(now * 12 + k + i * 2.3), h = r * (i === 1 ? 1.5 : 1.05) * flicker;
      const fx = X + (i - 1) * r * 0.29, fy = Y + r * 0.14, bend = Math.sin(now * 6 + k + i) * r * 0.2, b = r * 0.28;
      const flame = c.createLinearGradient(fx, fy - h, fx, fy + r * 0.25);
      flame.addColorStop(0, 'rgba(255,94,35,0.8)'); flame.addColorStop(0.48, '#ffac38'); flame.addColorStop(0.86, '#ffe69c'); flame.addColorStop(1, '#fff5d8');
      c.fillStyle = flame; c.beginPath(); c.moveTo(fx, fy - h);
      c.bezierCurveTo(fx + b + bend, fy - h * 0.38, fx + b * 1.8, fy + b, fx, fy + b);
      c.bezierCurveTo(fx - b * 1.8, fy + b, fx - b + bend, fy - h * 0.45, fx, fy - h); c.fill();
    }
    c.fillStyle = '#ffd694';
    for (let i = 0; i < 5; i++) { const t = (now * 0.65 + i * 0.19) % 1; c.globalAlpha = (1 - t) * 0.85; c.fillRect(X + Math.sin(k + i * 3 + t * 2) * r * 0.7, Y - r * (0.4 + t * 1.5), Math.max(1, z * 0.035), Math.max(1.5, z * 0.07)); }
    c.globalAlpha = 1;
  }

  DI.draw = function (g, c, cw, ch, now) {
    const W = g.W, S = g.S, z = g.cam.z, ox = Math.round(cw / 2 - g.cam.x * z), oy = Math.round(ch / 2 - g.cam.y * z), w = W.w;
    const x0 = Math.max(0, Math.floor(-ox / z)), y0 = Math.max(0, Math.floor(-oy / z)), x1 = Math.min(W.w - 1, Math.ceil((cw - ox) / z)), y1 = Math.min(W.h - 1, Math.ceil((ch - oy) / z));
    const ts = S.sysd.tileSys, G = S.G;
    // A positive fixed phase keeps active alarm LEDs lit when animation is reduced.
    const motionNow = reducedMotion && reducedMotion.matches ? 0.1 : now;
    // Cache the architectural layer at the current viewport. Pipes, water, damage and
    // equipment remain live; a pan, resize, edit or temperature change redraws the floor.
    const target = c, dpr = DI.dpr || 1;
    const layerKey = [cw, ch, dpr, ox, oy, z, W.ver, W.power, ...W.rooms.map(r => r.temp)].join('|');
    let layer = siteLayers.get(W);
    if (!layer) { const canvas = document.createElement('canvas'); layer = { canvas, ctx: canvas.getContext('2d'), key: '' }; siteLayers.set(W, layer); }
    if (layer.key !== layerKey) {
      layer.canvas.width = Math.round(cw * dpr); layer.canvas.height = Math.round(ch * dpr); c = layer.ctx;
    c.setTransform(DI.dpr || 1, 0, 0, DI.dpr || 1, 0, 0); c.fillStyle = '#080e17'; c.fillRect(0, 0, cw, ch);
    const ground = c.createLinearGradient(ox, oy, ox + W.w * z, oy + W.h * z); ground.addColorStop(0, '#11202b'); ground.addColorStop(1, '#0a141f');
    c.fillStyle = ground; c.fillRect(ox, oy, W.w * z, W.h * z);
    if (z >= 9) {
      c.fillStyle = 'rgba(115,154,180,0.23)';
      for (let x = x0; x <= x1 + 1; x++) for (let y = y0; y <= y1 + 1; y++) c.fillRect(ox + x * z, oy + y * z, 1, 1);
      c.strokeStyle = 'rgba(116,157,182,0.07)'; c.lineWidth = 1; c.beginPath();
      for (let x = Math.ceil(x0 / 5) * 5; x <= x1 + 1; x += 5) { c.moveTo(ox + x * z + 0.5, oy + y0 * z); c.lineTo(ox + x * z + 0.5, oy + (y1 + 1) * z); }
      for (let y = Math.ceil(y0 / 5) * 5; y <= y1 + 1; y += 5) { c.moveTo(ox + x0 * z, oy + y * z + 0.5); c.lineTo(ox + (x1 + 1) * z, oy + y * z + 0.5); } c.stroke();
    }
    // rooms
    for (const r of W.rooms) {
      const rt = DI.ROOMS[r.type], X = ox + r.x * z, Y = oy + r.y * z, RW = r.w * z, RH = r.h * z;
      if (X > cw || Y > ch || X + RW < 0 || Y + RH < 0) continue;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(X + z * 0.22, Y + z * 0.28, RW, RH);
      const floor = c.createLinearGradient(X, Y, X, Y + RH); floor.addColorStop(0, rt.col); floor.addColorStop(1, '#15232f');
      c.fillStyle = floor; c.fillRect(X, Y, RW, RH);
      if (z >= 10) { c.lineWidth = 0.6; c.strokeStyle = 'rgba(136,174,193,0.1)'; c.beginPath();
        for (let x = Math.max(r.x + 1, x0); x < Math.min(r.x + r.w, x1 + 1); x++) { c.moveTo(ox + x * z, Math.max(Y, 0)); c.lineTo(ox + x * z, Math.min(Y + RH, ch)); }
        for (let y = Math.max(r.y + 1, y0); y < Math.min(r.y + r.h, y1 + 1); y++) { c.moveTo(Math.max(X, 0), oy + y * z); c.lineTo(Math.min(X + RW, cw), oy + y * z); } c.stroke(); }
      if (r.temp < 36) { c.fillStyle = 'rgba(120,190,255,' + DI.clamp((36 - r.temp) / 60, 0.05, 0.3) + ')'; c.fillRect(X, Y, RW, RH); }
      c.strokeStyle = rt.open ? 'rgba(170,190,205,0.35)' : '#09131d'; c.lineWidth = rt.open ? 1 : Math.max(4, z * 0.22); if (rt.open) c.setLineDash([6, 5]); c.strokeRect(X + 1, Y + 1, RW - 2, RH - 2); c.setLineDash([]);
      if (!rt.open) { c.strokeStyle = '#6c8291'; c.lineWidth = Math.max(1, z * 0.055); c.strokeRect(X, Y, RW, RH);
        c.strokeStyle = 'rgba(165,193,205,0.32)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X + 4, Y + RH - 4); c.lineTo(X + 4, Y + 4); c.lineTo(X + RW - 4, Y + 4); c.stroke(); }
      const corner = Math.min(z * 0.6, RW * 0.15, RH * 0.15);
      c.strokeStyle = roomAccent[r.type] || '#7ab3c4'; c.lineWidth = 2; c.beginPath();
      c.moveTo(X, Y + corner); c.lineTo(X, Y); c.lineTo(X + corner, Y); c.moveTo(X + RW - corner, Y + RH); c.lineTo(X + RW, Y + RH); c.lineTo(X + RW, Y + RH - corner); c.stroke();
    }
    if (z >= 12) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x, rm = W.roomAt[k]; if (!rm) continue; const room = W.rooms[rm - 1], ty = room.type;
      if ((ty === 'hall' || ty === 'batt' || ty === 'elec' || ty === 'tel') && !W.partAt[k] && (x - room.x) % 3 !== 1) rack(c, ox + x * z, oy + y * z, z, ty, k, W.power);
    }
      layer.key = layerKey;
    }
    c = target; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.drawImage(layer.canvas, 0, 0, cw, ch);
    // Live floor state: water and char overlay the cached architecture.
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x, rm = W.roomAt[k]; if (!rm) continue; const X = ox + x * z, Y = oy + y * z;
      if (S.wet[k] > 0.5) { const a = Math.min(0.42, S.wet[k] / 120); c.fillStyle = 'rgba(58,166,255,' + a + ')'; c.fillRect(X, Y, z, z);
        if (a > 0.08 && z >= 12) { c.strokeStyle = 'rgba(129,208,239,' + a + ')'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(X + z * 0.5, Y + z * 0.62, z * 0.3, z * 0.13, 0, 0.2, 2.8); c.stroke(); } }
      if (S.burn[k] > 0.01) { c.fillStyle = 'rgba(8,5,3,' + Math.min(0.85, S.burn[k] * 1.4) + ')'; c.fillRect(X, Y, z, z); }
    }
    for (const r of W.rooms) { const sm = S.smoke[r.id]; if (sm > 0.02) { const X = ox + r.x * z, Y = oy + r.y * z, alpha = Math.min(0.42, 0.04 + Math.log10(1 + sm * 8) * 0.1);
      const haze = c.createLinearGradient(X, Y, X + r.w * z, Y + r.h * z); haze.addColorStop(0, 'rgba(170,178,185,' + alpha + ')'); haze.addColorStop(0.5, 'rgba(118,129,143,' + alpha * 0.5 + ')'); haze.addColorStop(1, 'rgba(170,178,185,' + alpha + ')'); c.fillStyle = haze; c.fillRect(X, Y, r.w * z, r.h * z); } }
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
      c.beginPath();
      for (let d = 0; d < 4; d++) if (W.linked(x, y, d)) { n++; c.moveTo(X, Y); c.lineTo(X + DI.DX[d] * z * 0.5, Y + DI.DY[d] * z * 0.5); }
      if (z >= 18 || lw >= 2.8) { c.strokeStyle = 'rgba(3,10,17,0.85)'; c.lineWidth = lw + Math.max(1.8, z * 0.09); c.stroke(); }
      c.strokeStyle = col(k); c.lineWidth = lw; c.stroke();
      if (lw >= 3) { c.strokeStyle = 'rgba(225,247,255,0.2)'; c.lineWidth = Math.max(0.6, lw * 0.2); c.stroke(); }
      if (n < 2) { c.fillStyle = col(k); c.beginPath(); c.arc(X, Y, lw * 0.75, 0, TAU); c.fill(); }
      if (n > 2 && z >= 15) { c.fillStyle = '#a3c3d1'; c.beginPath(); c.arc(X, Y, Math.max(1, lw * 0.3), 0, TAU); c.fill(); }
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
          c.lineWidth = Math.max(1.2, z * 0.07); c.setLineDash([z * 0.16, z * 0.34]); c.lineDashOffset = -Math.sign(q) * motionNow * sp * z * 0.9;
          c.beginPath(); c.moveTo(X, Y); c.lineTo(X + DI.DX[d] * z, Y + DI.DY[d] * z); c.stroke();
        }
      }
      c.setLineDash([]); c.lineDashOffset = 0;
    }
    // pipe breaks: a red cross on the tile
    for (const lk of S.leaks) if (lk.a) {
      const X = ox + ((lk.k % w) + 0.5) * z, Y = oy + (((lk.k / w) | 0) + 0.5) * z, r = z * 0.3;
      c.fillStyle = 'rgba(255,90,65,0.1)'; c.beginPath(); c.arc(X, Y, z * 0.65, 0, TAU); c.fill();
      c.strokeStyle = C.red; c.lineWidth = Math.max(1.5, z * 0.09); c.beginPath(); c.moveTo(X - r, Y - r); c.lineTo(X + r, Y + r); c.moveTo(X + r, Y - r); c.lineTo(X - r, Y + r); c.stroke();
    }
    // sprinklers
    if (z >= 6) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x, sp = W.spk[k]; if (!sp) continue; const X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, r = Math.max(1.6, z * 0.13);
      if (sp >= 2 && S.dens[k] > 0.01) {
        const pr = z * (0.75 + 0.06 * Math.sin(motionNow * 7 + k)); const gr = c.createRadialGradient(X, Y, 1, X, Y, pr); gr.addColorStop(0, 'rgba(190,235,255,0.65)'); gr.addColorStop(0.35, 'rgba(80,183,240,0.25)'); gr.addColorStop(1, 'rgba(58,166,255,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(X, Y, pr, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(210,238,255,0.7)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + (k % 7), f = (motionNow * 1.6 + i * 0.37) % 1; c.moveTo(X + Math.cos(a) * z * 0.15 * (1 + 3 * f), Y + Math.sin(a) * z * 0.15 * (1 + 3 * f)); c.lineTo(X + Math.cos(a) * z * 0.15 * (1.5 + 3 * f), Y + Math.sin(a) * z * 0.15 * (1.5 + 3 * f)); } c.stroke();
        const ripple = (motionNow * 0.8 + (k % 9) / 9) % 1; c.strokeStyle = 'rgba(148,221,251,' + ((1 - ripple) * 0.3) + ')'; c.beginPath(); c.ellipse(X, Y, z * (0.25 + ripple * 0.55), z * (0.18 + ripple * 0.4), 0, 0, TAU); c.stroke();
      }
      c.fillStyle = '#07131d'; c.beginPath(); c.arc(X, Y, r + Math.max(0.7, z * 0.025), 0, TAU); c.fill();
      c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fillStyle = sp === 1 ? '#f2f6f8' : sp === 2 ? C.amb : C.red; c.fill();
      if (sp >= 2) { c.strokeStyle = sp === 2 ? C.amb : C.red; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y, r * 2.1, 0, TAU); c.stroke(); }
      else if (S.lt[k] > 30) { c.strokeStyle = 'rgba(255,120,40,' + Math.min(1, (S.lt[k] - 30) / 38) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y, r * 1.8, 0, TAU * (S.lt[k] - 21) / 47); c.stroke(); }
    }
    // wires
    const showW = g.tool.type === 'wire' || (g.sel && g.sel.kind === 'part');
    c.lineWidth = 1; c.setLineDash([3, 4]);
    for (const wr of W.wires) { const a = W.parts.get(wr[0]), b = W.parts.get(wr[1]); if (!a || !b) continue; const hot = showW && (g.tool.type === 'wire' || g.sel.id === a.id || g.sel.id === b.id);
      c.strokeStyle = hot ? 'rgba(255,131,108,0.85)' : 'rgba(255,131,108,0.09)'; c.beginPath(); c.moveTo(ox + (a.x + 0.5) * z, oy + (a.y + 0.5) * z); c.lineTo(ox + (b.x + 0.5) * z, oy + (b.y + 0.5) * z); c.stroke(); }
    c.setLineDash([]);
    // parts
    for (const p of W.parts.values()) {
      if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      c.save(); c.translate(ox + (p.x + 0.5) * z, oy + (p.y + 0.5) * z); c.rotate(p.rot * Math.PI / 2); c.scale(z, z); c.lineCap = 'round'; c.lineJoin = 'round';
      DI.glyph(c, p.type, DI.partState(g, p, motionNow)); c.restore();
    }
    // fire
    for (const k of S.fires) {
      const x = k % w, y = (k / w) | 0, X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, q = S.fq[k];
      if (X < -z * 6 || X > cw + z * 6 || Y < -z * 6 || Y > ch + z * 6) continue;
      fireEffect(c, X, Y, z, k, q, S.fi[k] > 0, motionNow);
    }
    if (z >= 7) { c.font = '600 ' + Math.max(9, Math.min(12, z * 0.5)) + 'px Segoe UI,system-ui,sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
      for (const r of W.rooms) { const t = r.name.toUpperCase() + (r.exempt ? ' (by others)' : '') + (DI.ROOMS[r.type].cond ? '' : ' \u00b7 UNHEATED ' + DI.fmt(r.temp) + '\u00b0F'), X = ox + r.x * z, Y = oy + r.y * z - 25, tw = c.measureText(t).width;
        if (X > cw || Y > ch || X + r.w * z < 0 || Y + r.h * z < -25) continue;
        c.fillStyle = 'rgba(9,18,29,0.94)'; c.fillRect(X, Y, tw + 23, 22); c.strokeStyle = '#334957'; c.lineWidth = 1; c.strokeRect(X + 0.5, Y + 0.5, tw + 22, 21);
        c.fillStyle = roomAccent[r.type] || '#7ab3c4'; c.fillRect(X, Y + 1, 3, 20); c.fillStyle = r.temp < 32 ? '#9ed8f5' : '#d3e1e9'; c.fillText(t, X + 12, Y + 11);
        if (z >= 18 && r.w * z > tw + 125) { c.font = '10px Consolas,monospace'; c.fillStyle = '#8199aa'; c.fillText((r.w * r.h * 100).toLocaleString('en-US') + ' SQ FT', X + tw + 35, Y + 11); c.font = '600 ' + Math.max(9, Math.min(12, z * 0.5)) + 'px Segoe UI,system-ui,sans-serif'; }
      } }
    DI.drawOverlay(g, c, ox, oy, z, now);
  };

  DI.drawOverlay = function (g, c, ox, oy, z, now) {
    const W = g.W, S = g.S;
    const box = (x, y, colr, lw, fill) => { if (fill) { c.fillStyle = fill; c.fillRect(ox + x * z, oy + y * z, z, z); } c.strokeStyle = colr; c.lineWidth = lw || 1.5; c.strokeRect(ox + x * z + 1, oy + y * z + 1, z - 2, z - 2); };
    const select = (x, y) => {
      const X = ox + x * z - 3, Y = oy + y * z - 3, size = z + 6, arm = Math.min(10, size * 0.28);
      c.fillStyle = 'rgba(101,221,241,0.07)'; c.fillRect(X, Y, size, size);
      c.strokeStyle = 'rgba(102,221,242,0.18)'; c.lineWidth = 1; c.strokeRect(X, Y, size, size);
      c.strokeStyle = '#a5edf7'; c.lineWidth = 2; c.beginPath();
      for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = X + sx * size, yy = Y + sy * size; c.moveTo(xx + (sx ? -arm : arm), yy); c.lineTo(xx, yy); c.lineTo(xx, yy + (sy ? -arm : arm)); } c.stroke();
    };
    if (g.calcShow) { const cs = g.calcShow; for (const k of cs.tiles) box(k % W.w, (k / W.w) | 0, cs.pass ? 'rgba(61,220,145,0.9)' : 'rgba(255,75,58,0.9)', 2, cs.pass ? 'rgba(61,220,145,0.12)' : 'rgba(255,75,58,0.14)'); }
    if (g.sel) {
      if (g.sel.kind === 'part') { const p = W.parts.get(g.sel.id); if (p) { select(p.x, p.y);
        const inf = S.sysd.info.get(p.id); if (inf && inf.remote >= 0) { const x = inf.remote % W.w, y = (inf.remote / W.w) | 0; c.fillStyle = '#ffd24a'; c.font = '700 10px Consolas,monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('ITC', ox + (x + 0.5) * z, oy + y * z - 1); box(x, y, '#ffd24a', 1.5); } } }
      else if (g.sel.kind === 'tile') select(g.sel.k % W.w, (g.sel.k / W.w) | 0);
    }
    if (g.hover && g.tool.type === 'select' && W.inb(g.hover.x, g.hover.y)) box(g.hover.x, g.hover.y, 'rgba(140,207,227,0.4)', 1, 'rgba(140,207,227,0.04)');
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
