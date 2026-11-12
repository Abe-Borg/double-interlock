// Map renderer (Canvas 2D). Pure view: reads game state, never changes it.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const TAU = Math.PI * 2, C = DI.COL;
  const motionPreference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
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

  // Architecture and furniture are presentation only: pipe lengths and placement still use 10 ft cells.
  // The half-cell floor grid is a 5 ft visual reference; no simulation state is written by this renderer.
  const roomAccent = (type) => ({ hall: '#54c9e8', tel: '#54c9e8', office: '#83b1c7', riser: '#e2ad65', pump: '#e2ad65', batt: '#ba93ea', elec: '#ba93ea', dock: '#80b8cf', cold: '#80b8cf' }[type] || '#9cae94');
  const path = (c, points) => { c.beginPath(); c.moveTo(points[0], points[1]); for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]); };
  function ground(c, W, ox, oy, z, x0, y0, x1, y1, detail) {
    c.fillStyle = '#101d25'; c.fillRect(ox, oy, W.w * z, W.h * z);
    // Survey points keep the wider campus legible when zoomed out.
    if (z >= 9) {
      c.strokeStyle = 'rgba(111,157,176,.085)'; c.lineWidth = 1; c.beginPath();
      for (let x = x0; x <= x1 + 1; x++) { c.moveTo(ox + x * z + .5, oy + y0 * z); c.lineTo(ox + x * z + .5, oy + (y1 + 1) * z); }
      for (let y = y0; y <= y1 + 1; y++) { c.moveTo(ox + x0 * z, oy + y * z + .5); c.lineTo(ox + (x1 + 1) * z, oy + y * z + .5); } c.stroke();
      if (detail && z >= 16) { c.fillStyle = 'rgba(137,191,211,.14)'; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.fillRect(ox + (x + .5) * z, oy + (y + .5) * z, 1, 1); }
      c.strokeStyle = 'rgba(130,180,199,.16)'; c.beginPath();
      for (let y = Math.ceil(y0 / 5) * 5; y <= y1; y += 5) for (let x = Math.ceil(x0 / 5) * 5; x <= x1; x += 5) { const X = ox + x * z, Y = oy + y * z; c.moveTo(X - 3, Y); c.lineTo(X + 3, Y); c.moveTo(X, Y - 3); c.lineTo(X, Y + 3); } c.stroke();
    }
  }
  function roomFloor(c, r, ox, oy, z, detail) {
    const rt = DI.ROOMS[r.type], X = ox + r.x * z, Y = oy + r.y * z, RW = r.w * z, RH = r.h * z, a = roomAccent(r.type);
    c.fillStyle = 'rgba(0,0,0,.34)'; c.fillRect(X + 5, Y + 8, RW + 4, RH + 4);
    c.fillStyle = '#26353d'; c.fillRect(X - 3, Y - 3, RW + 6, RH + 6);
    if (!rt.open) { c.fillStyle = '#17252d'; c.fillRect(X - 3, Y + RH, RW + 6, Math.max(4, z * .18)); c.fillStyle = '#1d2d36'; c.fillRect(X + RW, Y, Math.max(3, z * .13), RH + 4); }
    const floor = c.createLinearGradient(X, Y, X + RW * .7, Y + RH);
    floor.addColorStop(0, r.type === 'hall' || r.type === 'tel' ? '#263b49' : '#2b373b'); floor.addColorStop(1, rt.col);
    c.fillStyle = floor; c.fillRect(X, Y, RW, RH);
    if (r.type === 'hall' || r.type === 'tel') { c.fillStyle = 'rgba(95,190,220,.035)'; for (let n = 1; n < r.w; n += 3) c.fillRect(X + n * z, Y, z, RH); }
    if (r.temp < 36) { c.fillStyle = 'rgba(120,190,255,' + DI.clamp((36 - r.temp) / 100, .04, .16) + ')'; c.fillRect(X, Y, RW, RH); }
    // Half-cell subdivisions remain distinct from the brighter construction tile boundaries.
    if (z >= 12) {
      c.strokeStyle = 'rgba(159,186,198,.055)'; c.lineWidth = 1; c.beginPath();
      for (let x = .5; detail && x < r.w; x += .5) { c.moveTo(X + x * z, Y); c.lineTo(X + x * z, Y + RH); }
      for (let y = .5; detail && y < r.h; y += .5) { c.moveTo(X, Y + y * z); c.lineTo(X + RW, Y + y * z); } c.stroke();
      c.strokeStyle = 'rgba(160,192,208,.10)'; c.beginPath();
      for (let x = 1; x < r.w; x++) { c.moveTo(X + x * z, Y); c.lineTo(X + x * z, Y + RH); }
      for (let y = 1; y < r.h; y++) { c.moveTo(X, Y + y * z); c.lineTo(X + RW, Y + y * z); } c.stroke();
    }
    if (rt.open) { c.strokeStyle = '#61767b'; c.lineWidth = 1; c.setLineDash([5, 5]); c.strokeRect(X, Y, RW, RH); c.setLineDash([]); }
    else {
      // Raised cutaway walls: lit north/west coping, shaded south/east face.
      c.strokeStyle = '#111d25'; c.lineWidth = Math.max(3, z * .18); c.strokeRect(X, Y, RW, RH);
      c.strokeStyle = '#78939f'; c.lineWidth = Math.max(1, z * .06); path(c, [X, Y + RH, X, Y, X + RW, Y]); c.stroke();
      c.strokeStyle = '#40545e'; path(c, [X + RW, Y, X + RW, Y + RH, X, Y + RH]); c.stroke();
      c.strokeStyle = 'rgba(9,17,23,.55)'; c.lineWidth = Math.max(2, z * .10); path(c, [X + 3, Y + RH - 2, X + 3, Y + 3, X + RW - 2, Y + 3]); c.stroke();
      c.fillStyle = a; c.globalAlpha = .68; c.fillRect(X + 4, Y + 3, Math.min(RW - 8, z * 2.4), 2); c.globalAlpha = 1;
      // Recessed wall lights, spaced by the room rather than by screen position.
      if (z >= 15) for (let n = 3; n < r.w - 1; n += 5) { c.fillStyle = '#aacbd7'; c.fillRect(X + n * z, Y - 1, z * .65, 2); c.fillStyle = 'rgba(132,208,233,.07)'; c.fillRect(X + (n - .15) * z, Y + 2, z * .95, z * .45); }
    }
  }
  function furniture(c, g, r, x, y, X, Y, z, now) {
    const S = g.S, k = y * g.W.w + x, rx = x - r.x, ry = y - r.y, dead = S.burn[k] > .5, wet = S.wet[k] > 30;
    if (g.W.partAt[k]) return;
    const rack = r.type === 'hall' || r.type === 'tel' || r.type === 'batt' || r.type === 'elec';
    if (rack && rx % 3 !== 1) {
      const bx = X + z * .17, by = Y + z * .12, bw = z * .66, bh = z * .73;
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(bx + z * .10, by + z * .11, bw, bh);
      c.fillStyle = dead ? '#241c18' : wet ? '#183341' : '#101c25'; c.fillRect(bx, by, bw, bh);
      c.fillStyle = '#415968'; c.fillRect(bx, by, bw, Math.max(1, z * .055)); c.fillRect(bx, by, Math.max(1, z * .045), bh);
      c.fillStyle = '#0a1219'; c.fillRect(bx + bw - z * .08, by + z * .08, z * .08, bh - z * .08);
      for (let n = 0; n < 4; n++) {
        const sy = by + z * (.13 + n * .13); c.fillStyle = dead ? '#302622' : (k + n) % 4 === 0 ? '#304c5b' : '#253944'; c.fillRect(bx + z * .09, sy, bw - z * .21, z * .08);
        if (!dead && g.W.power !== false) { c.fillStyle = r.type === 'batt' || r.type === 'elec' ? '#dcb575' : ((k + n * 3 + Math.floor(now * .7)) % 9 === 0 ? '#b8efff' : '#4c9cba'); c.fillRect(bx + z * .10, sy + 1, Math.max(1, z * .04), Math.max(1, z * .025)); }
      }
      if (!dead && r.type === 'hall') { c.fillStyle = 'rgba(74,173,210,.055)'; c.fillRect(X + z * .88, Y + z * .06, z * .12, z * .9); }
    } else if (r.type === 'office' && rx % 3 === 1 && ry % 3 === 1) {
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(X + z * .18, Y + z * .25, z * .72, z * .48);
      c.fillStyle = dead ? '#33291e' : '#62615a'; c.fillRect(X + z * .12, Y + z * .18, z * .72, z * .44);
      c.fillStyle = '#243746'; c.fillRect(X + z * .27, Y + z * .23, z * .33, z * .20); c.fillStyle = dead ? '#17232a' : '#487f92'; c.fillRect(X + z * .30, Y + z * .25, z * .27, z * .14);
      c.fillStyle = '#22343d'; c.fillRect(X + z * .35, Y + z * .70, z * .28, z * .22);
    } else if (['stor', 'dock'].includes(r.type) && rx % 4 < 2 && ry % 4 < 2 && rx > 0 && ry > 0) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(X + z * .20, Y + z * .22, z * .65, z * .65);
      c.fillStyle = dead ? '#35251a' : '#645744'; c.fillRect(X + z * .14, Y + z * .14, z * .65, z * .65);
      c.strokeStyle = '#8c7c5e'; c.lineWidth = Math.max(1, z * .035); c.strokeRect(X + z * .18, Y + z * .18, z * .57, z * .57);
      c.fillStyle = '#988765'; c.fillRect(X + z * .43, Y + z * .14, z * .07, z * .65);
    }
  }

  DI.draw = function (g, c, cw, ch, now) {
    // Freeze decorative motion when requested; state, pressure and temporary marker lifetimes remain live.
    const anim = motionPreference && motionPreference.matches ? 0 : now;
    const W = g.W, S = g.S, z = g.cam.z, ox = Math.round(cw / 2 - g.cam.x * z), oy = Math.round(ch / 2 - g.cam.y * z), w = W.w;
    const x0 = Math.max(0, Math.floor(-ox / z)), y0 = Math.max(0, Math.floor(-oy / z)), x1 = Math.min(W.w - 1, Math.ceil((cw - ox) / z)), y1 = Math.min(W.h - 1, Math.ceil((ch - oy) / z));
    const ts = S.sysd.tileSys, G = S.G;
    c.setTransform(DI.dpr || 1, 0, 0, DI.dpr || 1, 0, 0); c.fillStyle = '#071016'; c.fillRect(0, 0, cw, ch);
    ground(c, W, ox, oy, z, x0, y0, x1, y1, g.viewGrid !== false);
    for (const r of W.rooms) roomFloor(c, r, ox, oy, z, g.viewGrid !== false);
    // Furnishings establish the room's purpose; hydraulic and detection layers stay above them.
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x, rm = W.roomAt[k]; if (!rm) continue; const X = ox + x * z, Y = oy + y * z, r = W.rooms[rm - 1];
      if (z >= 12) furniture(c, g, r, x, y, X, Y, z, anim);
      if (S.wet[k] > .5) {
        c.fillStyle = 'rgba(58,166,255,' + Math.min(.40, S.wet[k] / 120) + ')'; c.fillRect(X, Y, z, z);
        if (S.wet[k] > 5 && z >= 16) { c.strokeStyle = 'rgba(171,221,242,.20)'; c.lineWidth = 1; c.beginPath(); c.ellipse(X + z * .5, Y + z * .55, z * (.14 + ((anim * .3 + k * .17) % 1) * .26), z * .10, 0, 0, TAU); c.stroke(); }
      }
      if (S.burn[k] > .01) { c.fillStyle = 'rgba(8,5,3,' + Math.min(.85, S.burn[k] * 1.4) + ')'; c.fillRect(X, Y, z, z); }
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
    // A dark jacket lifts every pipe off the floor. Contents retain their original physical colours.
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x; if (!W.pd[k]) continue;
      const X = ox + (x + .5) * z, Y = oy + (y + .5) * z, lw = pipeW(W, k, z); let n = 0;
      c.beginPath();
      for (let d = 0; d < 4; d++) if (W.linked(x, y, d)) { n++; c.moveTo(X, Y); c.lineTo(X + DI.DX[d] * z * .5, Y + DI.DY[d] * z * .5); }
      c.strokeStyle = 'rgba(3,10,15,.8)'; c.lineWidth = lw + Math.max(2, z * .09); c.stroke();
      c.strokeStyle = col(k); c.lineWidth = lw; c.stroke();
      if (z >= 18 && lw >= 2.5) { c.strokeStyle = 'rgba(212,237,249,.26)'; c.lineWidth = Math.max(.7, lw * .22); c.stroke(); }
      if (n !== 2) { c.fillStyle = '#15222c'; c.beginPath(); c.arc(X, Y, lw * .82, 0, TAU); c.fill(); c.fillStyle = col(k); c.beginPath(); c.arc(X, Y, lw * .51, 0, TAU); c.fill(); }
      // Small metal unions communicate physical pipe sections without competing with flow animation.
      if (z >= 21 && lw > 2.5 && (x + y) % 3 === 0) {
        c.strokeStyle = 'rgba(190,213,221,.48)'; c.lineWidth = Math.max(1, z * .045); c.beginPath();
        for (let d = 0; d < 4; d++) if (W.linked(x, y, d)) { const fx = X + DI.DX[d] * z * .31, fy = Y + DI.DY[d] * z * .31; c.moveTo(fx - DI.DY[d] * lw * .68, fy + DI.DX[d] * lw * .68); c.lineTo(fx + DI.DY[d] * lw * .68, fy - DI.DX[d] * lw * .68); } c.stroke();
      }
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
          c.lineWidth = Math.max(1.2, z * 0.07); c.setLineDash([z * 0.16, z * 0.34]); c.lineDashOffset = -Math.sign(q) * anim * sp * z * 0.9;
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
      const k = y * w + x, sp = W.spk[k]; if (!sp) continue; const X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, r = sp === 1 ? Math.max(1.1, z * .085) : Math.max(1.6, z * .13);
      if (sp >= 2 && S.dens[k] > 0.01) {
        const pr = z * (0.62 + 0.06 * Math.sin(anim * 7 + k)); const gr = c.createRadialGradient(X, Y, 1, X, Y, pr); gr.addColorStop(0, 'rgba(150,215,255,0.75)'); gr.addColorStop(1, 'rgba(58,166,255,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(X, Y, pr, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(210,238,255,0.7)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + (k % 7), f = (anim * 1.6 + i * 0.37) % 1; c.moveTo(X + Math.cos(a) * z * 0.15 * (1 + 3 * f), Y + Math.sin(a) * z * 0.15 * (1 + 3 * f)); c.lineTo(X + Math.cos(a) * z * 0.15 * (1.5 + 3 * f), Y + Math.sin(a) * z * 0.15 * (1.5 + 3 * f)); } c.stroke();
      }
      if (sp === 1) { c.fillStyle = '#0b1720'; c.beginPath(); c.arc(X, Y, r + Math.max(.6, z * .025), 0, TAU); c.fill(); }
      c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fillStyle = sp === 1 ? '#b4c7ce' : sp === 2 ? C.amb : C.red; c.fill();
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
      const px = ox + (p.x + .5) * z, py = oy + (p.y + .5) * z, st = DI.partState(g, p, anim);
      if (motionPreference && motionPreference.matches) st.sil = true; // show alarm LED steadily, never hide it by freezing the blink off
      c.fillStyle = 'rgba(0,0,0,.48)'; c.beginPath(); c.roundRect(px - z * .46 + 2, py - z * .43 + 3, z * .92, z * .86, 3); c.fill();
      if (z >= 16) { c.fillStyle = '#1b2a33'; c.strokeStyle = '#3b505b'; c.lineWidth = 1; c.beginPath(); c.roundRect(px - z * .47, py - z * .47, z * .94, z * .94, 3); c.fill(); c.stroke(); }
      if (st.alarm || st.al || st.on || st.spd > .5) { const gl = c.createRadialGradient(px, py, z * .3, px, py, z * 1.1); gl.addColorStop(0, st.alarm || st.al ? 'rgba(255,84,54,.2)' : 'rgba(62,220,154,.12)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(px - z * 1.1, py - z * 1.1, z * 2.2, z * 2.2); }
      c.save(); c.translate(px, py); c.rotate(p.rot * Math.PI / 2); c.scale(z, z); c.lineCap = 'round'; c.lineJoin = 'round';
      DI.glyph(c, p.type, st); c.restore();
    }
    // fire
    for (const k of S.fires) {
      const x = k % w, y = (k / w) | 0, X = ox + (x + 0.5) * z, Y = oy + (y + 0.5) * z, q = S.fq[k];
      if (S.fi[k] > 0) { c.fillStyle = 'rgba(190,190,190,' + (0.25 + 0.15 * Math.sin(anim * 5)) + ')'; c.beginPath(); c.arc(X, Y - z * 0.2 * ((anim * 0.6) % 1), z * (0.18 + 0.2 * ((anim * 0.6) % 1)), 0, TAU); c.fill(); c.fillStyle = '#ff7a2e'; c.beginPath(); c.arc(X, Y, z * 0.09, 0, TAU); c.fill(); continue; }
      const r = z * (0.35 + Math.min(1.9, Math.sqrt(q) / 26)) * (0.9 + 0.14 * Math.sin(anim * 17 + k) + 0.08 * Math.sin(anim * 31 + k * 2));
      const gr = c.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, 'rgba(255,244,190,0.95)'); gr.addColorStop(0.35, 'rgba(255,150,40,0.85)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
      // Layered flame tongues and embers follow real burning tiles; they never imply a scripted incident.
      for (let n = 0; n < 3; n++) {
        const sway = Math.sin(anim * (5 + n) + k + n) * r * .15, fx = X + (n - 1) * r * .22, fh = r * (.8 + .25 * Math.sin(anim * 11 + k + n));
        c.fillStyle = n === 1 ? '#fff0b2' : '#ff923c'; c.globalAlpha = n === 1 ? .94 : .76;
        c.beginPath(); c.moveTo(fx - r * .19, Y + r * .16); c.bezierCurveTo(fx - r * .35, Y - fh * .25, fx + sway, Y - fh * .55, fx + sway + r * .06, Y - fh); c.bezierCurveTo(fx + r * .03, Y - fh * .40, fx + r * .38, Y - fh * .12, fx + r * .16, Y + r * .16); c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
      for (let n = 0; n < 5; n++) { const f = (anim * .6 + n * .21 + (k % 11) * .1) % 1; c.fillStyle = 'rgba(255,192,93,' + (1 - f) * .85 + ')'; c.fillRect(X + Math.sin(n * 9 + k + f * 2) * r * .7, Y - r * (.2 + f * 2.5), Math.max(1, z * .035), Math.max(1, z * .055)); }

    }
    if (z >= 7) {
      c.font = '600 ' + Math.max(9, Math.min(11, z * .50)) + 'px Segoe UI,system-ui,sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
      for (const r of W.rooms) {
        const t = r.name.toUpperCase() + (r.exempt ? ' · BY OTHERS' : '') + (DI.ROOMS[r.type].cond ? '' : ' · ' + DI.fmt(r.temp) + '°F'), X = ox + r.x * z, Y = oy + r.y * z - 23, tw = c.measureText(t).width;
        c.fillStyle = 'rgba(9,19,27,.94)'; c.beginPath(); c.roundRect(X, Y, tw + 24, 19, 3); c.fill();
        c.strokeStyle = '#324954'; c.lineWidth = 1; c.stroke(); c.fillStyle = roomAccent(r.type); c.fillRect(X + 6, Y + 6, 3, 7);
        c.fillStyle = '#d0e2e9'; c.fillText(t, X + 15, Y + 9.5);
      }
    }
    DI.drawOverlay(g, c, ox, oy, z, now);
  };

  DI.drawOverlay = function (g, c, ox, oy, z, now) {
    const W = g.W, S = g.S;
    const box = (x, y, colr, lw, fill) => { if (fill) { c.fillStyle = fill; c.fillRect(ox + x * z, oy + y * z, z, z); } c.strokeStyle = colr; c.lineWidth = lw || 1.5; c.strokeRect(ox + x * z + 1, oy + y * z + 1, z - 2, z - 2); };
    if (g.hover && !g.ghost && g.tool.type === 'select' && W.inb(g.hover.x, g.hover.y)) box(g.hover.x, g.hover.y, 'rgba(137,218,239,.45)', 1, 'rgba(104,194,226,.055)');
    if (g.calcShow) { const cs = g.calcShow; for (const k of cs.tiles) box(k % W.w, (k / W.w) | 0, cs.pass ? 'rgba(61,220,145,0.9)' : 'rgba(255,75,58,0.9)', 2, cs.pass ? 'rgba(61,220,145,0.12)' : 'rgba(255,75,58,0.14)'); }
    if (g.sel) {
      if (g.sel.kind === 'part') { const p = W.parts.get(g.sel.id); if (p) { box(p.x, p.y, '#8ce4ff', 1, 'rgba(100,202,232,.09)');
        const sx = ox + p.x * z - 3, sy = oy + p.y * z - 3, sz = z + 6, cr = Math.min(7, z * .24); c.strokeStyle = '#bcefff'; c.lineWidth = 2; c.beginPath(); for (const [a, b, dx, dy] of [[sx, sy, 1, 1], [sx + sz, sy, -1, 1], [sx, sy + sz, 1, -1], [sx + sz, sy + sz, -1, -1]]) { c.moveTo(a + cr * dx, b); c.lineTo(a, b); c.lineTo(a, b + cr * dy); } c.stroke();
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
