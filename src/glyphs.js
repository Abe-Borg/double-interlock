// Vector glyphs for parts, drawn in a unit box (-0.5..0.5) facing east (inlet W, outlet E).
// st = live state: { t (anim seconds), open, spd, on, frac, lvl, tripped, sol, low, mode, alarm }
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const TAU = Math.PI * 2;
  const C = { ink: '#dbe7ef', body: '#18242f', red: '#ff4b3a', amb: '#ffb224', grn: '#3ddc91', wat: '#3aa6ff', air: '#e9d8a0', n2: '#6fe3c6', dim: '#6f8494', opn: '#c59bff' };
  DI.COL = C;
  const P = (c, pts, close) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close !== false) c.closePath(); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
  const txt = (c, s, x, y, size, col, rot) => { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.fillStyle = col || C.ink; c.font = '700 ' + size + 'px Segoe UI,system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 0.02); c.restore(); };
  const stub = (c) => { c.strokeStyle = C.ink; c.lineWidth = 0.09; P(c, [-0.5, 0, 0.5, 0], false); c.stroke(); };
  const arrow = (c) => { P(c, [0.5, 0, 0.36, -0.09, 0.36, 0.09]); c.fillStyle = '#ffd24a'; c.fill(); };     // flow direction marker at the outlet
  const led = (c, x, y, col, on) => { circ(c, x, y, 0.065); c.fillStyle = on ? col : '#26333f'; c.fill(); if (on) { c.globalAlpha = 0.35; circ(c, x, y, 0.12); c.fill(); c.globalAlpha = 1; } };
  const metal = (c, x0, y0, x1, y1, light, dark) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, light); g.addColorStop(.42, dark); g.addColorStop(1, '#14242e'); return g; };
  const pump = (c, st, r, letter, col) => {
    stub(c);
    c.fillStyle = '#090f15'; c.fillRect(-r * .85, r * .60, r * 1.7, .16);
    circ(c, 0, 0, r); c.fillStyle = metal(c, -r, -r, r, r, '#6c8794', '#2c4453'); c.fill();
    c.lineWidth = .055; c.strokeStyle = st.spd > .5 ? C.grn : col; c.stroke();
    circ(c, 0, 0, r * .76); c.fillStyle = '#10232e'; c.fill(); c.strokeStyle = '#638392'; c.lineWidth = .025; c.stroke();
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; circ(c, Math.cos(a) * r * .88, Math.sin(a) * r * .88, .025); c.fillStyle = '#d5e5e9'; c.fill(); }
    c.save(); c.rotate((st.t || 0) * 9 * (st.spd || 0)); c.strokeStyle = col; c.lineWidth = .055;
    for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.arc(r * .40, 0, r * .43, Math.PI * .9, Math.PI * 1.9); c.stroke(); }
    c.restore(); circ(c, 0, 0, r * .34); c.fillStyle = '#0b1820'; c.fill(); txt(c, letter, 0, 0, r * .74, '#effcff', -(st.rot || 0) * Math.PI / 2); arrow(c);
  };

  DI.GLYPH = {
    gate(c, st) {
      stub(c); const o = st.open === undefined ? 1 : st.open, col = o > 0.98 ? C.grn : o < 0.02 ? C.red : C.amb;
      P(c, [-0.3, -0.2, -0.3, 0.2, 0, 0]); c.fillStyle = o < 0.5 ? col : C.body; c.fill(); c.strokeStyle = col; c.lineWidth = 0.055; c.stroke();
      P(c, [0.3, -0.2, 0.3, 0.2, 0, 0]); c.fill(); c.stroke();
      P(c, [0, 0, 0, -0.34], false); c.stroke(); P(c, [-0.16, -0.34 - 0.08 * (1 - o), 0.16, -0.34 - 0.08 * (1 - o)], false); c.lineWidth = 0.07; c.stroke();
    },
    check(c) { stub(c); P(c, [-0.24, -0.2, -0.24, 0.2, 0.16, 0]); c.fillStyle = C.body; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 0.055; c.stroke(); P(c, [0.2, -0.22, 0.2, 0.22], false); c.lineWidth = 0.08; c.stroke(); },
    bfp(c) {
      stub(c); c.fillStyle = C.body; c.strokeStyle = C.wat; c.lineWidth = 0.05; c.fillRect(-0.4, -0.22, 0.8, 0.44); c.strokeRect(-0.4, -0.22, 0.8, 0.44);
      for (const x of [-0.2, 0.18]) { P(c, [x - 0.12, -0.12, x - 0.12, 0.12, x + 0.06, 0]); c.strokeStyle = C.ink; c.stroke(); P(c, [x + 0.09, -0.13, x + 0.09, 0.13], false); c.stroke(); }
    },
    epump(c, st) { pump(c, st, 0.38, 'E', C.wat); P(c, [-0.14, -0.5, 0.14, -0.5, 0.14, -0.4, -0.14, -0.4]); c.fillStyle = st.pw === false ? C.red : C.amb; c.fill(); },
    dpump(c, st) { pump(c, st, 0.38, 'D', C.amb); c.fillStyle = C.dim; c.fillRect(-0.2, -0.5, 0.4, 0.1); if (st.spd > 0.5) { c.globalAlpha = 0.5; circ(c, 0.26, -0.5 - 0.06 * Math.sin((st.t || 0) * 12), 0.05); c.fill(); c.globalAlpha = 1; } },
    jockey(c, st) { st.spd = st.on ? 1 : 0; pump(c, st, 0.26, 'J', C.n2); },
    tank(c, st) {
      const f = DI.clamp(st.frac === undefined ? 1 : st.frac, 0, 1);
      c.fillStyle = metal(c, -.4, 0, .34, 0, '#9aabb1', '#506775'); c.fillRect(-.38, -.33, .70, .67);
      c.fillStyle = '#334c5a'; c.beginPath(); c.ellipse(-.03, .33, .35, .11, 0, 0, TAU); c.fill();
      c.fillStyle = '#a5bac2'; c.beginPath(); c.ellipse(-.03, -.33, .35, .11, 0, 0, TAU); c.fill(); c.strokeStyle = '#d3e1e6'; c.lineWidth = .025; c.stroke();
      c.fillStyle = '#152c3c'; c.fillRect(-.18, -.25, .24, .54); c.fillStyle = '#55b4e9'; c.fillRect(-.16, .27 - .5 * f, .20, .5 * f);
      c.strokeStyle = '#d4e5ed'; c.lineWidth = .025; c.strokeRect(-.18, -.25, .24, .54);
      for (let i = 0; i < 4; i++) { c.fillStyle = '#bdd9e6'; c.fillRect(.09, -.19 + i * .13, .07, .018); }
      P(c, [.32, .30, .5, .30, .5, 0], false); c.strokeStyle = C.ink; c.lineWidth = .09; c.stroke();
    },
    city(c, st) { circ(c, -0.08, 0, 0.36); c.fillStyle = '#10202e'; c.fill(); c.strokeStyle = C.wat; c.lineWidth = 0.07; c.stroke(); P(c, [0.28, 0, 0.5, 0], false); c.strokeStyle = C.ink; c.lineWidth = 0.09; c.stroke();
      txt(c, st.loop ? 'LOOP' : 'CITY', -0.08, 0, 0.2, '#bfe2ff', -(st.rot || 0) * Math.PI / 2); },
    fdc(c, st) { c.strokeStyle = st.on ? C.red : C.ink; c.lineWidth = 0.08; P(c, [0.5, 0, 0.1, 0], false); c.stroke(); P(c, [0.1, 0, -0.2, -0.24], false); c.stroke(); P(c, [0.1, 0, -0.2, 0.24], false); c.stroke();
      for (const y of [-0.26, 0.26]) { circ(c, -0.28, y, 0.13); c.fillStyle = st.on ? C.red : '#7a2a22'; c.fill(); c.lineWidth = 0.04; c.stroke(); } },
    testhdr(c, st) { c.strokeStyle = C.ink; c.lineWidth = 0.09; P(c, [-0.5, 0, 0, 0], false); c.stroke(); c.fillStyle = C.body; c.lineWidth = 0.05; c.fillRect(0, -0.4, 0.16, 0.8); c.strokeRect(0, -0.4, 0.16, 0.8);
      for (const y of [-0.27, 0, 0.27]) { P(c, [0.16, y, 0.4, y], false); c.strokeStyle = st.open > 0 ? C.wat : C.ink; c.lineWidth = 0.07; c.stroke(); circ(c, 0.42, y, 0.055); c.fillStyle = st.open > 0 ? C.wat : C.dim; c.fill(); } },
    wetv(c, st) { stub(c); arrow(c); circ(c, 0, 0, 0.36); c.fillStyle = '#3a1512'; c.fill(); c.strokeStyle = C.red; c.lineWidth = 0.06; c.stroke(); P(c, [-0.1, -0.2, 0.14, 0.14], false); c.strokeStyle = C.ink; c.lineWidth = 0.06; c.stroke(); circ(c, -0.1, -0.2, 0.045); c.fillStyle = C.ink; c.fill(); led(c, 0.3, -0.36, C.red, st.alarm); },
    dryv(c, st) { stub(c); arrow(c); c.fillStyle = C.wat; c.globalAlpha = 0.8; c.fillRect(-0.34, -0.32, 0.3, 0.64); c.fillStyle = st.tripped ? C.wat : C.air; c.fillRect(-0.04, -0.32, 0.38, 0.64); c.globalAlpha = 1;
      c.strokeStyle = C.red; c.lineWidth = 0.06; c.strokeRect(-0.34, -0.32, 0.68, 0.64); c.strokeStyle = '#10161c'; c.lineWidth = 0.07; if (st.tripped) P(c, [-0.04, -0.3, 0.22, -0.12], false); else P(c, [-0.04, -0.3, -0.04, 0.3], false); c.stroke();
      led(c, 0.3, -0.42, C.red, st.alarm); led(c, 0.1, -0.42, C.amb, st.low); },
    prev(c, st) { stub(c); arrow(c); c.fillStyle = C.wat; c.globalAlpha = 0.8; c.fillRect(-0.36, -0.3, 0.3, 0.6); c.fillStyle = st.tripped ? C.wat : st.n2 ? C.n2 : C.air; c.fillRect(-0.06, -0.3, 0.42, 0.6); c.globalAlpha = 1;
      c.strokeStyle = C.red; c.lineWidth = 0.06; c.strokeRect(-0.36, -0.3, 0.72, 0.6); c.fillStyle = '#10161c'; c.fillRect(-0.2, -0.46, 0.22, 0.16); c.strokeStyle = C.ink; c.lineWidth = 0.035; c.strokeRect(-0.2, -0.46, 0.22, 0.16);
      c.strokeStyle = '#10161c'; c.lineWidth = 0.07; if (st.tripped) P(c, [-0.06, -0.28, 0.2, -0.1], false); else P(c, [-0.06, -0.28, -0.06, 0.28], false); c.stroke();
      // red LED: solenoid energized (dim red while only D is latched). Amber bar: P is latched.
      if (st.sol || !st.det) led(c, 0.14, -0.42, C.red, st.sol); else { circ(c, 0.14, -0.42, 0.065); c.fillStyle = '#8a2f25'; c.fill(); }
      led(c, 0.32, -0.42, C.amb, st.low); if (st.pl) { c.fillStyle = C.amb; c.fillRect(-0.36, 0.34, 0.72, 0.05); }
      if (st.imp) { c.save(); c.rotate(-(st.rot || 0) * Math.PI / 2); P(c, [0.2, 0.12, 0.5, 0.12, 0.5, 0.48, 0.2, 0.48, 0.1, 0.3]); c.fillStyle = C.amb; c.fill(); c.strokeStyle = '#3a2a05'; c.lineWidth = 0.03; c.stroke(); txt(c, '!', 0.34, 0.3, 0.3, '#201400'); c.restore(); } },     // amber impairment tag
    comp(c, st) { c.fillStyle = metal(c, 0, 0, 0, .34, '#6f7c79', '#334344'); c.strokeStyle = C.air; c.lineWidth = 0.05; c.beginPath(); c.roundRect(-0.38, 0, 0.76, 0.34, 0.16); c.fill(); c.stroke(); circ(c, -0.1, -0.16, 0.19); c.fill(); c.stroke();
      c.save(); c.translate(-0.1, -0.16); c.rotate((st.t || 0) * 14 * (st.on ? 1 : 0)); P(c, [-0.13, 0, 0.13, 0], false); c.stroke(); P(c, [0, -0.13, 0, 0.13], false); c.stroke(); c.restore(); led(c, 0.28, -0.2, C.grn, st.on); },
    n2(c, st) { c.fillStyle = C.body; c.strokeStyle = C.n2; c.lineWidth = 0.05; c.beginPath(); c.roundRect(-0.38, -0.38, 0.76, 0.76, 0.08); c.fill(); c.stroke(); txt(c, 'N₂', -0.02, 0.02, 0.36, C.n2, -(st.rot || 0) * Math.PI / 2); led(c, 0.26, -0.26, C.grn, st.on); },
    panel(c, st) { c.fillStyle = metal(c, -.36, -.42, .36, .42, '#a54a3e', '#51251f'); c.strokeStyle = C.red; c.lineWidth = 0.05; c.fillRect(-0.36, -0.42, 0.72, 0.84); c.strokeRect(-0.36, -0.42, 0.72, 0.84); c.fillStyle = st.alive === false ? '#05070a' : '#0c1218'; c.fillRect(-0.26, -0.32, 0.52, 0.24); if (st.alive !== false) { c.fillStyle = st.al ? '#ff9c83' : '#83e7d8'; c.fillRect(-.21, -.27, .27, .027); c.fillRect(-.21, -.20, .39, .022); } c.fillStyle = '#ce978b'; c.fillRect(-.31, -.37, .024, .025); c.fillRect(.28, .35, .024, .025); // dead panel: display dark, every LED off
      led(c, -0.2, 0.08, C.red, st.al && (st.sil || Math.sin((st.t || 0) * 10) > 0)); led(c, 0, 0.08, C.amb, st.sv); led(c, 0.2, 0.08, '#ffe45c', st.tr); led(c, -0.2, 0.28, C.grn, st.alive !== false); led(c, 0.2, 0.28, C.opn, st.op); },     // lower right: OPEN item (release input, class not elected)
    vesda(c, st) { c.fillStyle = C.body; c.strokeStyle = C.ink; c.lineWidth = 0.05; c.fillRect(-0.36, -0.3, 0.72, 0.6); c.strokeRect(-0.36, -0.3, 0.72, 0.6);
      for (let i = 0; i < 4; i++) { c.fillStyle = i < (st.lvl || 0) ? [C.grn, C.amb, C.red, C.red][i] : '#26333f'; c.fillRect(-0.28 + i * 0.15, -0.2, 0.11, 0.4); } P(c, [0, -0.3, 0, -0.5], false); c.stroke(); },
    mstn(c, st) { c.fillStyle = st.on ? '#8a1c14' : '#5a1712'; c.strokeStyle = C.red; c.lineWidth = 0.05; c.fillRect(-0.3, -0.36, 0.6, 0.72); c.strokeRect(-0.3, -0.36, 0.6, 0.72);
      c.fillStyle = '#e8eef2'; c.fillRect(-0.2, st.on ? 0.02 : -0.2, 0.4, 0.12); P(c, [0, st.on ? 0.14 : -0.08, 0, 0.26], false); c.strokeStyle = '#e8eef2'; c.lineWidth = 0.05; c.stroke(); led(c, 0.2, -0.26, C.red, st.on); },
    smoke(c, st) { circ(c, 0, 0, 0.32); c.fillStyle = '#e8eef2'; c.fill(); c.strokeStyle = C.dim; c.lineWidth = 0.04; c.stroke(); circ(c, 0, 0, 0.16); c.stroke(); led(c, 0, 0, C.red, (st.lvl || 0) > 0); },
  };
  DI.glyph = function (c, type, st) { const g = DI.GLYPH[type]; if (g) g(c, st || {}); };
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
