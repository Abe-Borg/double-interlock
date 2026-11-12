// Vector glyphs for parts, drawn in a unit box (-0.5..0.5) facing east (inlet W, outlet E).
// st = live state: { t (anim seconds), open, spd, on, frac, lvl, tripped, sol, low, mode, alarm }
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const TAU = Math.PI * 2;
  const C = { ink: '#dbe7ef', body: '#182b39', red: '#ff6455', amb: '#ffbd55', grn: '#4ee4ac', wat: '#47b6ff', air: '#e9d8a0', n2: '#6fe3c6', dim: '#7893a5', opn: '#c59bff' };
  DI.COL = C;
  const P = (c, pts, close) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close !== false) c.closePath(); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
  const txt = (c, s, x, y, size, col, rot) => { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.fillStyle = col || C.ink; c.font = '700 ' + size + 'px Segoe UI,system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 0.02); c.restore(); };
  const metal = (c, top, bottom, y0 = -0.4, y1 = 0.4) => { const g = c.createLinearGradient(-0.2, y0, 0.2, y1); g.addColorStop(0, top || '#3d596b'); g.addColorStop(0.46, bottom || '#172c3b'); g.addColorStop(1, '#0a1621'); return g; };
  const bolt = (c, x, y) => { circ(c, x, y, 0.023); c.fillStyle = '#a8bdc9'; c.fill(); };
  const housing = (c, x, y, w, h, col, top) => {
    c.fillStyle = 'rgba(0,5,10,0.6)'; c.fillRect(x + 0.035, y + 0.05, w, h);
    c.fillStyle = metal(c, top, undefined, y, y + h); c.fillRect(x, y, w, h);
    c.lineWidth = 0.035; c.strokeStyle = col || '#7d9caf'; c.strokeRect(x, y, w, h);
    c.strokeStyle = 'rgba(220,240,255,0.25)'; c.lineWidth = 0.018; P(c, [x + 0.025, y + h - 0.04, x + 0.025, y + 0.025, x + w - 0.025, y + 0.025], false); c.stroke();
  };
  const stub = (c) => {
    P(c, [-0.5, 0, 0.5, 0], false); c.strokeStyle = '#07121b'; c.lineWidth = 0.15; c.stroke();
    c.strokeStyle = '#9cb6c7'; c.lineWidth = 0.085; c.stroke(); c.strokeStyle = '#e2edf3'; c.lineWidth = 0.02; c.stroke();
    c.strokeStyle = '#7f9aab'; c.lineWidth = 0.055;
    for (const x of [-0.42, 0.42]) { P(c, [x, -0.11, x, 0.11], false); c.stroke(); }
  };
  const arrow = (c) => { P(c, [0.5, 0, 0.36, -0.09, 0.36, 0.09]); c.fillStyle = '#ffd24a'; c.fill(); };     // flow direction marker at the outlet
  const led = (c, x, y, col, on) => {
    c.save();
    if (on) { c.globalAlpha *= 0.2; circ(c, x, y, 0.115); c.fillStyle = col; c.fill(); c.globalAlpha /= 0.2; }
    circ(c, x, y, 0.07); c.fillStyle = '#061018'; c.fill(); circ(c, x, y, 0.046); c.fillStyle = on ? col : '#31434e'; c.fill();
    if (on) { circ(c, x - 0.012, y - 0.014, 0.016); c.fillStyle = '#f1ffff'; c.fill(); }
    c.restore();
  };
  const pump = (c, st, r, letter, col) => {
    stub(c); circ(c, 0.025, 0.045, r + 0.025); c.fillStyle = '#030b12'; c.fill();
    circ(c, 0, 0, r); c.fillStyle = metal(c, '#486579'); c.fill(); c.lineWidth = 0.045; c.strokeStyle = st.spd > 0.5 ? C.grn : col; c.stroke();
    circ(c, 0, 0, r * 0.78); c.fillStyle = '#0b1a26'; c.fill(); c.lineWidth = 0.015; c.strokeStyle = '#7b9daf'; c.stroke();
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * TAU / 4; bolt(c, Math.cos(a) * r * 0.87, Math.sin(a) * r * 0.87); }
    c.save(); c.rotate((st.t || 0) * 9 * (st.spd || 0)); c.strokeStyle = col; c.lineWidth = 0.055;
    for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.arc(r * 0.45, 0, r * 0.5, Math.PI * 0.9, Math.PI * 1.9); c.stroke(); }
    c.restore(); circ(c, 0, 0, r * 0.4); c.fillStyle = '#142837'; c.fill(); txt(c, letter, 0, 0, r * 0.78, '#eefaff', -(st.rot || 0) * Math.PI / 2); arrow(c);
  };

  DI.GLYPH = {
    gate(c, st) {
      stub(c); const o = st.open === undefined ? 1 : st.open, col = o > 0.98 ? C.grn : o < 0.02 ? C.red : C.amb;
      P(c, [-0.3, -0.2, -0.3, 0.2, 0, 0]); c.fillStyle = o < 0.5 ? col : metal(c); c.fill(); c.strokeStyle = col; c.lineWidth = 0.045; c.stroke();
      P(c, [0.3, -0.2, 0.3, 0.2, 0, 0]); c.fill(); c.stroke();
      P(c, [0, 0, 0, -0.34], false); c.stroke(); P(c, [-0.16, -0.34 - 0.08 * (1 - o), 0.16, -0.34 - 0.08 * (1 - o)], false); c.lineWidth = 0.07; c.stroke();
      circ(c, 0, 0, 0.065); c.fillStyle = '#b8cedb'; c.fill();
    },
    check(c) { stub(c); P(c, [-0.24, -0.2, -0.24, 0.2, 0.16, 0]); c.fillStyle = metal(c); c.fill(); c.strokeStyle = C.ink; c.lineWidth = 0.045; c.stroke(); P(c, [0.2, -0.22, 0.2, 0.22], false); c.lineWidth = 0.08; c.stroke(); },
    bfp(c) {
      stub(c); housing(c, -0.4, -0.22, 0.8, 0.44, C.wat);
      for (const x of [-0.2, 0.18]) { P(c, [x - 0.12, -0.12, x - 0.12, 0.12, x + 0.06, 0]); c.strokeStyle = C.ink; c.stroke(); P(c, [x + 0.09, -0.13, x + 0.09, 0.13], false); c.stroke(); }
    },
    epump(c, st) { pump(c, st, 0.38, 'E', C.wat); P(c, [-0.14, -0.5, 0.14, -0.5, 0.14, -0.4, -0.14, -0.4]); c.fillStyle = st.pw === false ? C.red : C.amb; c.fill(); c.fillStyle = '#0b1a26'; c.fillRect(-0.03, -0.5, 0.06, 0.07); },
    dpump(c, st) { pump(c, st, 0.38, 'D', C.amb); c.fillStyle = C.dim; c.fillRect(-0.2, -0.5, 0.4, 0.1); if (st.spd > 0.5) { c.globalAlpha = 0.5; circ(c, 0.26, -0.5 - 0.06 * Math.sin((st.t || 0) * 12), 0.05); c.fill(); c.globalAlpha = 1; } },
    jockey(c, st) { pump(c, { ...st, spd: st.on ? 1 : 0 }, 0.26, 'J', C.n2); },
    tank(c, st) {
      housing(c, -0.4, -0.42, 0.72, 0.86, '#91aebf');
      const f = DI.clamp(st.frac === undefined ? 1 : st.frac, 0, 1), y = 0.39 - 0.76 * f;
      c.fillStyle = metal(c, '#55cbff', '#1476ac', -0.42, 0.44); c.fillRect(-0.35, y, 0.62, 0.76 * f);
      if (f > 0) { c.strokeStyle = '#a9e8ff'; c.lineWidth = 0.022; P(c, [-0.35, y, 0.27, y], false); c.stroke(); }
      c.strokeStyle = 'rgba(210,235,250,0.4)'; c.lineWidth = 0.018;
      for (let i = 0; i < 4; i++) { P(c, [-0.31, -0.23 + i * 0.17, -0.23, -0.23 + i * 0.17], false); c.stroke(); }
      c.strokeStyle = C.ink; P(c, [0.32, 0.3, 0.5, 0.3, 0.5, 0], false); c.lineWidth = 0.07; c.stroke();
    },
    city(c, st) { circ(c, -0.06, 0.04, 0.38); c.fillStyle = '#030b12'; c.fill(); circ(c, -0.08, 0, 0.36); c.fillStyle = metal(c, '#244e69'); c.fill(); c.strokeStyle = C.wat; c.lineWidth = 0.05; c.stroke(); circ(c, -0.08, 0, 0.28); c.strokeStyle = '#426c85'; c.lineWidth = 0.02; c.stroke(); P(c, [0.28, 0, 0.5, 0], false); c.strokeStyle = C.ink; c.lineWidth = 0.09; c.stroke();
      txt(c, st.loop ? 'LOOP' : 'CITY', -0.08, 0, 0.2, '#bfe2ff', -(st.rot || 0) * Math.PI / 2); },
    fdc(c, st) { c.strokeStyle = '#7b6250'; c.lineWidth = 0.12; P(c, [0.5, 0, 0.1, 0, -0.2, -0.24], false); c.stroke(); P(c, [0.1, 0, -0.2, 0.24], false); c.stroke(); c.strokeStyle = st.on ? C.red : '#dec1a1'; c.lineWidth = 0.045; P(c, [0.5, 0, 0.1, 0, -0.2, -0.24], false); c.stroke(); P(c, [0.1, 0, -0.2, 0.24], false); c.stroke();
      for (const y of [-0.26, 0.26]) { circ(c, -0.28, y, 0.13); c.fillStyle = metal(c, st.on ? '#f97c62' : '#8a4c3d', '#44291f', y - 0.13, y + 0.2); c.fill(); c.strokeStyle = '#d3af8a'; c.lineWidth = 0.035; c.stroke(); P(c, [-0.34, y, -0.22, y], false); c.strokeStyle = '#edc9a9'; c.lineWidth = 0.025; c.stroke(); } },
    testhdr(c, st) { c.strokeStyle = C.ink; c.lineWidth = 0.09; P(c, [-0.5, 0, 0, 0], false); c.stroke(); housing(c, 0, -0.4, 0.16, 0.8);
      for (const y of [-0.27, 0, 0.27]) { P(c, [0.16, y, 0.4, y], false); c.strokeStyle = st.open > 0 ? C.wat : C.ink; c.lineWidth = 0.07; c.stroke(); circ(c, 0.42, y, 0.055); c.fillStyle = st.open > 0 ? C.wat : C.dim; c.fill(); } },
    wetv(c, st) { stub(c); arrow(c); circ(c, 0.02, 0.035, 0.37); c.fillStyle = '#080e15'; c.fill(); circ(c, 0, 0, 0.36); c.fillStyle = metal(c, '#8d4138', '#452723'); c.fill(); c.strokeStyle = C.red; c.lineWidth = 0.045; c.stroke(); circ(c, 0, 0, 0.25); c.strokeStyle = '#cb7a6b'; c.lineWidth = 0.02; c.stroke(); P(c, [-0.1, -0.2, 0.14, 0.14], false); c.strokeStyle = C.ink; c.lineWidth = 0.06; c.stroke(); circ(c, -0.1, -0.2, 0.045); c.fillStyle = C.ink; c.fill(); for (const x of [-0.26, 0.26]) bolt(c, x, 0); led(c, 0.3, -0.36, C.red, st.alarm); },
    dryv(c, st) { stub(c); arrow(c); housing(c, -0.34, -0.32, 0.68, 0.64, C.red, '#69443f'); c.fillStyle = metal(c, '#66c9ff', '#1a7fba', -0.28, 0.28); c.fillRect(-0.3, -0.27, 0.26, 0.54); c.fillStyle = metal(c, st.tripped ? '#66c9ff' : '#e9d8a0', st.tripped ? '#1a7fba' : '#817552', -0.28, 0.28); c.fillRect(-0.04, -0.27, 0.34, 0.54);
      c.strokeStyle = C.red; c.lineWidth = 0.06; c.strokeRect(-0.34, -0.32, 0.68, 0.64); c.strokeStyle = '#10161c'; c.lineWidth = 0.07; if (st.tripped) P(c, [-0.04, -0.3, 0.22, -0.12], false); else P(c, [-0.04, -0.3, -0.04, 0.3], false); c.stroke();
      led(c, 0.3, -0.42, C.red, st.alarm); led(c, 0.1, -0.42, C.amb, st.low); },
    prev(c, st) { stub(c); arrow(c); housing(c, -0.36, -0.3, 0.72, 0.6, C.red, '#69443f'); c.fillStyle = metal(c, '#66c9ff', '#1a7fba', -0.26, 0.26); c.fillRect(-0.32, -0.25, 0.26, 0.5); c.fillStyle = metal(c, st.tripped ? '#66c9ff' : st.n2 ? '#6fe3c6' : '#e9d8a0', st.tripped ? '#1a7fba' : st.n2 ? '#287668' : '#817552', -0.26, 0.26); c.fillRect(-0.06, -0.25, 0.38, 0.5);
      c.strokeStyle = C.red; c.lineWidth = 0.06; c.strokeRect(-0.36, -0.3, 0.72, 0.6); c.fillStyle = '#10161c'; c.fillRect(-0.2, -0.46, 0.22, 0.16); c.strokeStyle = C.ink; c.lineWidth = 0.035; c.strokeRect(-0.2, -0.46, 0.22, 0.16);
      c.strokeStyle = '#10161c'; c.lineWidth = 0.07; if (st.tripped) P(c, [-0.06, -0.28, 0.2, -0.1], false); else P(c, [-0.06, -0.28, -0.06, 0.28], false); c.stroke();
      // red LED: solenoid energized (dim red while only D is latched). Amber bar: P is latched.
      if (st.sol || !st.det) led(c, 0.14, -0.42, C.red, st.sol); else { circ(c, 0.14, -0.42, 0.065); c.fillStyle = '#8a2f25'; c.fill(); }
      led(c, 0.32, -0.42, C.amb, st.low); if (st.pl) { c.fillStyle = C.amb; c.fillRect(-0.36, 0.34, 0.72, 0.05); }
      if (st.imp) { c.save(); c.rotate(-(st.rot || 0) * Math.PI / 2); P(c, [0.2, 0.12, 0.5, 0.12, 0.5, 0.48, 0.2, 0.48, 0.1, 0.3]); c.fillStyle = C.amb; c.fill(); c.strokeStyle = '#3a2a05'; c.lineWidth = 0.03; c.stroke(); txt(c, '!', 0.34, 0.3, 0.3, '#201400'); c.restore(); } },     // amber impairment tag
    comp(c, st) { c.fillStyle = '#101b22'; c.fillRect(-0.28, 0.27, 0.1, 0.16); c.fillRect(0.18, 0.27, 0.1, 0.16); c.fillStyle = metal(c, '#ae9e77', '#675b41', 0, 0.34); c.strokeStyle = C.air; c.lineWidth = 0.035; c.beginPath(); c.roundRect(-0.38, 0, 0.76, 0.34, 0.16); c.fill(); c.stroke(); c.fillStyle = metal(c); circ(c, -0.1, -0.16, 0.19); c.fill(); c.stroke();
      c.save(); c.translate(-0.1, -0.16); c.rotate((st.t || 0) * 14 * (st.on ? 1 : 0)); P(c, [-0.13, 0, 0.13, 0], false); c.stroke(); P(c, [0, -0.13, 0, 0.13], false); c.stroke(); c.restore(); led(c, 0.28, -0.2, C.grn, st.on); },
    n2(c, st) { housing(c, -0.38, -0.38, 0.76, 0.76, C.n2, '#295a55'); c.strokeStyle = '#345751'; c.lineWidth = 0.025; for (let i = 0; i < 3; i++) { P(c, [-0.26, 0.23 + i * 0.04, 0.26, 0.23 + i * 0.04], false); c.stroke(); } txt(c, 'N₂', -0.02, 0.02, 0.36, C.n2, -(st.rot || 0) * Math.PI / 2); led(c, 0.26, -0.26, C.grn, st.on); },
    panel(c, st) { housing(c, -0.36, -0.42, 0.72, 0.84, C.red, '#7e3c35'); c.fillStyle = '#050b10'; c.fillRect(-0.27, -0.33, 0.54, 0.25);      // dead panel: display dark, every LED off
      if (st.alive !== false) { c.fillStyle = '#173c39'; c.fillRect(-0.24, -0.3, 0.48, 0.19); c.fillStyle = st.al ? C.red : C.n2; c.fillRect(-0.2, -0.26, st.al ? 0.36 : 0.23, 0.025); c.fillStyle = '#588a80'; c.fillRect(-0.2, -0.2, 0.31, 0.02); }
      bolt(c, -0.3, -0.36); bolt(c, 0.3, 0.36);
      led(c, -0.2, 0.08, C.red, st.al && (st.sil || Math.sin((st.t || 0) * 10) > 0)); led(c, 0, 0.08, C.amb, st.sv); led(c, 0.2, 0.08, '#ffe45c', st.tr); led(c, -0.2, 0.28, C.grn, st.alive !== false); led(c, 0.2, 0.28, C.opn, st.op); },     // lower right: OPEN item (release input, class not elected)
    vesda(c, st) { housing(c, -0.36, -0.3, 0.72, 0.6); c.fillStyle = '#07141e'; c.fillRect(-0.3, -0.23, 0.6, 0.46);
      for (let i = 0; i < 4; i++) { c.fillStyle = i < (st.lvl || 0) ? [C.grn, C.amb, C.red, C.red][i] : '#263d48'; c.fillRect(-0.27 + i * 0.15, -0.18, 0.1, 0.36); } P(c, [0, -0.3, 0, -0.5], false); c.strokeStyle = C.ink; c.lineWidth = 0.05; c.stroke(); },
    mstn(c, st) { housing(c, -0.3, -0.36, 0.6, 0.72, C.red, st.on ? '#b44a3c' : '#82423a');
      c.fillStyle = '#e8eef2'; c.fillRect(-0.2, st.on ? 0.02 : -0.2, 0.4, 0.12); P(c, [0, st.on ? 0.14 : -0.08, 0, 0.26], false); c.strokeStyle = '#e8eef2'; c.lineWidth = 0.05; c.stroke(); led(c, 0.2, -0.26, C.red, st.on); },
    smoke(c, st) { circ(c, 0.02, 0.04, 0.33); c.fillStyle = '#09121b'; c.fill(); circ(c, 0, 0, 0.32); c.fillStyle = metal(c, '#f4f9fb', '#9eb4c1', -0.32, 0.75); c.fill(); c.strokeStyle = '#e2edf3'; c.lineWidth = 0.03; c.stroke(); circ(c, 0, 0, 0.16); c.strokeStyle = '#587384'; c.stroke(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P(c, [Math.cos(a) * 0.21, Math.sin(a) * 0.21, Math.cos(a) * 0.26, Math.sin(a) * 0.26], false); c.stroke(); } led(c, 0, 0, C.red, (st.lvl || 0) > 0); },
  };
  DI.glyph = function (c, type, st) { const g = DI.GLYPH[type]; if (g) { c.save(); g(c, st || {}); c.restore(); } };
  // small toolbar icons for tools that are not parts
  DI.ICON = {
    select(c) { P(c, [-0.2, -0.3, -0.2, 0.26, -0.05, 0.12, 0.08, 0.36, 0.17, 0.31, 0.05, 0.08, 0.24, 0.08]); c.fillStyle = C.ink; c.fill(); },
    pipe(c) { c.strokeStyle = C.wat; c.lineWidth = 0.16; P(c, [-0.4, 0.2, 0, 0.2, 0, -0.2, 0.4, -0.2], false); c.stroke(); },
    branch(c) { c.strokeStyle = C.wat; c.lineWidth = 0.07; for (const y of [-0.24, 0, 0.24]) { P(c, [-0.4, y, 0.4, y], false); c.stroke(); for (const x of [-0.25, 0, 0.25]) { circ(c, x, y, 0.06); c.fillStyle = '#fff'; c.fill(); } } },
    head(c) { circ(c, 0, 0, 0.14); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = C.wat; c.lineWidth = 0.05; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P(c, [Math.cos(a) * 0.22, Math.sin(a) * 0.22, Math.cos(a) * 0.38, Math.sin(a) * 0.38], false); c.stroke(); } },
    air(c) { c.strokeStyle = C.air; c.lineWidth = 0.07; c.setLineDash([0.1, 0.07]); P(c, [-0.4, 0.2, 0, 0.2, 0, -0.2, 0.4, -0.2], false); c.stroke(); c.setLineDash([]); },
    wire(c) { c.strokeStyle = C.red; c.lineWidth = 0.05; c.setLineDash([0.06, 0.06]); P(c, [-0.35, 0.3, 0.35, -0.3], false); c.stroke(); c.setLineDash([]); circ(c, -0.35, 0.3, 0.08); c.fillStyle = C.red; c.fill(); circ(c, 0.35, -0.3, 0.08); c.fill(); },
    cap(c) { c.strokeStyle = C.wat; c.lineWidth = 0.14; P(c, [-0.42, 0, -0.08, 0], false); c.stroke(); P(c, [0.08, 0, 0.42, 0], false); c.stroke(); c.strokeStyle = '#ffd24a'; c.lineWidth = 0.09; P(c, [0, -0.26, 0, 0.26], false); c.stroke(); },
    erase(c) { c.strokeStyle = C.red; c.lineWidth = 0.1; P(c, [-0.28, -0.28, 0.28, 0.28], false); c.stroke(); P(c, [0.28, -0.28, -0.28, 0.28], false); c.stroke(); },
  };
  DI.iconCanvas = function (name, px) {
    const cv = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1); cv.width = cv.height = px * d;
    const c = cv.getContext('2d'); c.translate(px * d / 2, px * d / 2); c.scale(px * d * 0.92, px * d * 0.92); c.lineCap = 'round'; c.lineJoin = 'round';
    if (DI.ICON[name]) DI.ICON[name](c); else DI.glyph(c, name, { open: 1, frac: 0.7, mode: 'double' });
    return cv;
  };
})();
