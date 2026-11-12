// Field calls, front end: the menu cards, the call briefing with its variants, hints, the diagnosis, the scorecard and
// the comparison of fixes after a call is solved (your layout, the cheapest fix, the easily maintained fix).
// The rules live in puz.js; this file only shows them.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const $ = (id) => document.getElementById(id), g = () => DI.game;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const P = DI.puzUI = {};
  const stars = (n) => '★'.repeat(n) + '<s>' + '★'.repeat(3 - n) + '</s>';
  const best = (pz) => { const d = g().prog.done[pz.id]; return d ? d.stars || 0 : -1; };
  P.open = (pz) => pz.n === 1 || !!g().prog.done[DI.PUZ[pz.n - 2].id];

  // ---------- menu
  P.menuHtml = function () {
    if (!DI.PUZ.length) return '';
    let h = '<h4 style="margin-top:22px">FIELD CALLS · FIND THE FAULT</h4><p style="margin:2px 0 0;font-size:13px">Small puzzles on an installation that already exists: a symptom, a small repair budget and one question. Fewest edits, the right diagnosis and the least time out of service earn the stars.</p><div class="cards">';
    for (const pz of DI.PUZ) {
      const open = P.open(pz), d = g().prog.done[pz.id], sv = DI.LS.get('di.save.' + pz.id, null);
      const vs = pz.variants.map((v) => v.key + (d && d.v && d.v[v.key] ? '★'.repeat(d.v[v.key]) : '·')).join(' ');
      h += '<button class="card puz' + (open ? '' : ' lock') + '" data-pz="' + pz.id + '"' + (open ? '' : ' disabled') + '><em>FIELD CALL ' + pz.n + ' · ' + esc(pz.kind.toUpperCase()) + '</em>' + (d && d.stars ? '<i>' + '★'.repeat(d.stars) + '</i>' : '') +
        '<b>' + esc(pz.name) + '</b><small>' + esc(pz.question) + '</small><small class="vs">' + esc(vs) + (sv ? ' · in progress' : '') + '</small></button>';
    }
    return h + '</div>';
  };
  P.bindMenu = function () { $('mbox').querySelectorAll('.card.puz').forEach((b) => { b.onclick = () => DI.startScenario(b.dataset.pz); }); };

  // ---------- briefing, with the variant picker
  P.brief = function (sc) {
    const pz = sc.pz, v = sc.v, S = g().S, rec = (S.puz && S.puz.rec) || [], d = g().prog.done[pz.id];
    let h = '<h4>FIELD CALL ' + pz.n + ' · ' + esc(pz.kind.toUpperCase()) + '</h4><h2>' + esc(pz.name) + '</h2><div class="sub">' + esc(v.name.toUpperCase()) + ' · REPAIR BUDGET ' + DI.money(v.money) + '</div>' +
      v.symptom.map((t) => '<p>' + esc(t) + '</p>').join('') +
      (rec.length ? '<h4>RECORDS</h4><ul>' + rec.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
      '<h4>THE QUESTION</h4><p><b>' + esc(v.diag.q || pz.question) + '</b> Answer it with Diagnose on the top bar once you know.</p>' +
      '<h4>GOALS</h4>' + sc.goals.map((q) => '<div class="goal"><i>○</i><div>' + esc(q.t) + '</div></div>').join('') +
      '<h4>HOW IT IS SCORED</h4><ul><li>One star for the fix: every goal, the diagnosis included.</li><li>One for the fewest edits, at no more than the cheapest fix costs. Operating a valve or a pump is not an edit; changing the layout, a wire or a setting is.</li>' +
      '<li>One for a diagnosis right the first time, at most one hint, and no more time out of service than par' + (v.live ? ', with no panel reset made while the cause is still live' : '') + '.</li></ul>' +
      '<h4>VARIANTS</h4><p style="font-size:13px">Each variant moves the fault, the supply, the layout or what else is going on. Switching starts that variant fresh.</p><div class="mrow" style="justify-content:flex-start;margin-top:4px">' +
      pz.variants.map((x, i) => '<button data-vi="' + i + '" class="' + (i === sc.vi ? 'on' : '') + '">' + esc(x.name) + (d && d.v && d.v[x.key] ? ' ' + '★'.repeat(d.v[x.key]) : '') + '</button>').join('') + '</div>' +
      '<div class="mrow"><button id="mGo" class="go">Start</button></div>';
    DI.ui.modal(h); $('mGo').onclick = DI.ui.close;
    $('mbox').querySelectorAll('button[data-vi]').forEach((b) => { b.onclick = () => { const i = +b.dataset.vi; if (i === sc.vi) { DI.ui.close(); return; } DI.LS.del('di.save.' + pz.id); DI.startScenario(pz.id, true, i); }; });
  };

  // ---------- hints and the diagnosis
  P.hint = function () {
    const G = g(), S = G.S, v = DI.puzVariant(S); if (!v) return;
    const shown = S.puz.hints, list = v.hints;
    let h = '<h4>HINTS · ' + esc(G.sc.pz.name.toUpperCase()) + '</h4>';
    if (shown) h += list.slice(0, shown).map((x, i) => '<div class="goal"><i>' + (i + 1) + '</i><div>' + esc(x[0]) + '</div></div>').join('');
    else h += '<p>No hints used yet. They come one at a time: the system to look at, then a measurement to take, then the fault itself. Each one used counts on the scorecard; more than one costs the third star.</p>';
    h += '<div class="mrow">' + (shown < list.length ? '<button id="mHint" class="' + (shown ? '' : 'go') + '">Show hint ' + (shown + 1) + ' of ' + list.length + '</button>' : '<span style="color:var(--dim);font-size:12px;margin-right:auto">All hints shown.</span>') + '<button id="mGo">Close</button></div>';
    DI.ui.modal(h); $('mGo').onclick = DI.ui.close;
    if ($('mHint')) $('mHint').onclick = () => { const x = DI.puzHint(S); if (x && x[1] !== undefined) DI.ui.focus(x[1], x[2]); P.hint(); DI.inspect.render(true); };
  };
  P.diagnose = function () {
    const S = g().S, v = DI.puzVariant(S); if (!v) return;
    const dg = S.puz.diag;
    let h = '<h4>DIAGNOSIS</h4><h2>' + esc(v.diag.q) + '</h2>';
    if (dg.ok) { const o = v.diag.opts.find((x) => x[1]); h += '<div class="goal ok"><i>✓</i><div><b>' + esc(o[0]) + '</b><small>' + esc(o[2]) + '</small></div></div>'; }
    else {
      h += '<p>Pick the fault. A wrong pick is answered and counted; the third star needs it right the first time.</p>';
      h += v.diag.opts.map((o, i) => { const tried = dg.picks.includes(i); return '<div class="goal' + (tried ? '' : '') + '"><i>' + (tried ? '✗' : '○') + '</i><div>' + (tried ? '<span style="color:var(--dim)">' + esc(o[0]) + '</span><small>' + esc(o[2]) + '</small>' : '<button class="dg" data-i="' + i + '">' + esc(o[0]) + '</button>') + '</div></div>'; }).join('');
    }
    h += '<div class="mrow"><button id="mGo" class="go">Close</button></div>';
    DI.ui.modal(h); $('mGo').onclick = DI.ui.close;
    $('mbox').querySelectorAll('button.dg').forEach((b) => { b.onclick = () => { const r = DI.puzDiagnose(S, +b.dataset.i); if (r) DI.ui.banner(r.ok ? 'Right: ' + r.why : 'Not that: ' + r.why); P.diagnose(); DI.inspect.render(true); }; });
  };

  // ---------- goals dialog (the G key and the Goals pill)
  P.goals = function () {
    const G = g(), S = G.S, sc = G.sc, st = DI.puzStatus(S); if (!st) return;
    let h = '<h4>FIELD CALL ' + sc.pz.n + ' · ' + esc(sc.v.name.toUpperCase()) + '</h4><h2>' + esc(sc.pz.name) + '</h2>';
    sc.goals.forEach((q, i) => { h += '<div class="goal' + (G.goalOk[i] ? ' ok' : '') + '"><i>' + (G.goalOk[i] ? '✓' : '○') + '</i><div>' + esc(q.t) + (!G.goalOk[i] && q.hint ? '<small>' + esc(q.hint) + '</small>' : '') + '</div></div>'; });
    h += '<h4>SO FAR</h4>' + P.status(st).map((t) => '<div class="goal"><i></i><div>' + esc(t) + '</div></div>').join('');
    if (S.puz.rec && S.puz.rec.length) h += '<h4>RECORDS</h4><ul>' + S.puz.rec.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>';
    h += '<div class="mrow"><button id="mRe" style="margin-right:auto">Restart this variant</button><button id="mBrief">Briefing</button><button id="mHintB">Hints</button><button id="mDiag">Diagnose</button>' + (S.puz.done ? '<button id="mRep">Report</button>' : '') + '<button id="mGo" class="go">Close</button></div>';
    DI.ui.modal(h); $('mGo').onclick = DI.ui.close; $('mBrief').onclick = () => P.brief(sc); $('mHintB').onclick = P.hint; $('mDiag').onclick = P.diagnose; if ($('mRep')) $('mRep').onclick = P.finish;
    $('mRe').onclick = () => { if ($('mRe').dataset.sure) { DI.LS.del('di.save.' + sc.id); DI.startScenario(sc.id, true, sc.vi); } else { $('mRe').dataset.sure = 1; $('mRe').textContent = 'Click again to start this variant over'; $('mRe').className = 'hot'; } };
  };
  P.status = (st) => ['Edits so far: ' + st.edits, 'Spent: ' + DI.money(Math.max(0, st.spent)), 'Hints used: ' + (st.v.hints.length - st.left) + ' of ' + st.v.hints.length,
    'Out of service: ' + DI.dur(st.imp) + (st.now.length ? ' (now: ' + st.now.slice(0, 2).join('; ') + ')' : '')].concat(st.v.live ? ['Resets made while the cause was live: ' + st.futile] : [], [st.diag.ok ? 'Diagnosis: given' + (st.diag.tries > 1 ? ' (try ' + st.diag.tries + ')' : '') : st.diag.tries ? 'Diagnosis: ' + st.diag.tries + ' wrong pick(s) so far' : 'Diagnosis: not given yet']);

  // ---------- solved: the scorecard, the progress, the comparison
  P.finish = function () {
    const G = g(), S = G.S, sc = G.sc, pz = sc.pz, v = sc.v, sc2 = DI.puzScore(S);
    const d = G.prog.done[pz.id] || (G.prog.done[pz.id] = { stars: 0, v: {} }); d.v = d.v || {};
    d.stars = Math.max(d.stars || 0, sc2.stars); d.v[v.key] = Math.max(d.v[v.key] || 0, sc2.stars); DI.LS.set('di.progress', G.prog);
    S.puz.done = true; DI.saveGame();
    const right = v.diag.opts.find((o) => o[1]);
    let h = '<h4>FIELD CALL ' + pz.n + ' · ' + esc(v.name.toUpperCase()) + '</h4><h2>Fault found and fixed</h2><div class="stars">' + stars(sc2.stars) + '</div>' +
      sc2.lines.map(([ok, t]) => '<div class="goal' + (ok ? ' ok' : '') + '"><i>' + (ok ? '✓' : '•') + '</i><div>' + esc(t) + '</div></div>').join('') +
      '<h4>THE FAULT</h4><p><b>' + esc(right[0]) + '.</b> ' + esc(right[2].replace(/^Yes\. /, '')) + '</p>' +
      '<h4>COMPARE THE FIXES</h4><div class="cmp">';
    const cols = [{ t: 'Your fix', W: S.W, diff: sc2.diff, cost: sc2.spent, steps: null, lesson: '' }];
    for (const which of ['cheap', 'maint']) { const s = DI.puzSolution(S, which); if (s) cols.push({ t: (which === 'cheap' ? 'Cheapest: ' : 'Easily maintained: ') + s.sol.t, W: s.W, diff: s.diff, cost: s.cost, steps: s.sol.steps, lesson: s.sol.lesson }); }
    cols.forEach((c, i) => {
      h += '<div class="cmpc"><b>' + esc(c.t) + '</b><canvas id="pzc' + i + '" width="560" height="300"></canvas><small>' + c.diff.n + ' edit' + (c.diff.n === 1 ? '' : 's') + ' · ' + DI.money(Math.max(0, c.cost)) + '</small>' +
        (c.diff.n ? '<ul>' + c.diff.items.slice(0, 8).map((x) => '<li>' + esc(x.what) + '</li>').join('') + (c.diff.n > 8 ? '<li>and ' + (c.diff.n - 8) + ' more</li>' : '') + '</ul>' : '<ul><li>no layout change</li></ul>') +
        (c.steps ? '<ol>' + c.steps.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') + (c.lesson ? '<p>' + esc(c.lesson) + '</p>' : '') + '</div>';
    });
    h += '</div><h4>WHAT THIS CALL TEACHES</h4><ul>' + pz.learn.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>';
    const nv = pz.variants[sc.vi + 1], np = DI.PUZ[pz.n];
    h += '<div class="mrow"><button id="mBack" style="margin-right:auto">Back to the plant</button>' + (nv ? '<button id="mNextV">Variant: ' + esc(nv.name) + '</button>' : '') + (np ? '<button id="mNextP" class="go">Next call: ' + esc(np.name) + '</button>' : '<button id="mMenu" class="go">Back to the menu</button>') + '</div>';
    DI.ui.modal(h, false); $('mbox').classList.add('wide');
    cols.forEach((c, i) => P.thumb($('pzc' + i), c.W, DI.puzStart(S), v.area, c.diff));
    $('mBack').onclick = DI.ui.close;
    if ($('mNextV')) $('mNextV').onclick = () => { DI.LS.del('di.save.' + pz.id); DI.startScenario(pz.id, true, sc.vi + 1); };
    if ($('mNextP')) $('mNextP').onclick = () => DI.startScenario(np.id);
    if ($('mMenu')) $('mMenu').onclick = () => DI.ui.showMenu();
  };

  // ---------- a schematic of the area around the fault: rooms, pipe by size, heads, caps, parts, and every edit
  // against the starting layout ringed in amber (red where something was taken away)
  P.thumb = function (cv, W, W0, area, diff) {
    if (!cv) return; const c = cv.getContext('2d'), cw = cv.width, ch = cv.height, [x0, y0, x1, y1] = area || [0, 0, W.w - 1, W.h - 1];
    const nx = x1 - x0 + 1, ny = y1 - y0 + 1, s = Math.min(cw / nx, ch / ny), ox = (cw - nx * s) / 2 - x0 * s, oy = (ch - ny * s) / 2 - y0 * s, TAU = Math.PI * 2;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0d141b'; c.fillRect(0, 0, cw, ch);
    c.save(); c.beginPath(); c.rect(ox + x0 * s, oy + y0 * s, nx * s, ny * s); c.clip();
    for (const r of W.rooms) { c.fillStyle = DI.ROOMS[r.type].col; c.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); c.strokeStyle = 'rgba(190,210,225,0.5)'; c.lineWidth = 1; c.strokeRect(ox + r.x * s + 0.5, oy + r.y * s + 0.5, r.w * s - 1, r.h * s - 1); }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = W.k(x, y); if (!W.pd[k]) continue; const X = ox + (x + 0.5) * s, Y = oy + (y + 0.5) * s;
      c.strokeStyle = '#3f8fd0'; c.lineWidth = Math.max(1, DI.pipeAt(W, k).id * s * 0.07); c.lineCap = 'round';
      let n = 0; for (let d = 0; d < 4; d++) if (W.linked(x, y, d)) { n++; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + DI.DX[d] * s * 0.5, Y + DI.DY[d] * s * 0.5); c.stroke(); }
      if (!n) { c.beginPath(); c.arc(X, Y, c.lineWidth * 0.6, 0, TAU); c.fillStyle = '#3c5567'; c.fill(); }
      if (W.spk[k] && s >= 5) { c.beginPath(); c.arc(X, Y, Math.max(1, s * 0.12), 0, TAU); c.fillStyle = '#e8eef2'; c.fill(); }
    }
    c.strokeStyle = '#ffd24a'; c.lineWidth = Math.max(1.5, s * 0.12); c.lineCap = 'butt'; c.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = W.k(x, y), here = W.pd[k] || W.partAt[k];
      if (W.cut[k * 2] && here && (W.pd[k + 1] || W.partAt[k + 1])) { c.moveTo(ox + (x + 1) * s, oy + (y + 0.2) * s); c.lineTo(ox + (x + 1) * s, oy + (y + 0.8) * s); }
      if (W.cut[k * 2 + 1] && here && (W.pd[k + W.w] || W.partAt[k + W.w])) { c.moveTo(ox + (x + 0.2) * s, oy + (y + 1) * s); c.lineTo(ox + (x + 0.8) * s, oy + (y + 1) * s); } }
    c.stroke();
    c.setLineDash([3, 4]); c.lineWidth = 1; c.strokeStyle = 'rgba(255,90,70,0.45)';
    for (const [a, b] of W.wires) { const pa = W.parts.get(a), pb = W.parts.get(b); if (!pa || !pb) continue; c.beginPath(); c.moveTo(ox + (pa.x + 0.5) * s, oy + (pa.y + 0.5) * s); c.lineTo(ox + (pb.x + 0.5) * s, oy + (pb.y + 0.5) * s); c.stroke(); }
    c.setLineDash([]);
    for (const p of W.parts.values()) { if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      c.save(); c.translate(ox + (p.x + 0.5) * s, oy + (p.y + 0.5) * s); c.rotate(p.rot * Math.PI / 2); c.scale(s, s); c.lineCap = 'round'; c.lineJoin = 'round';
      DI.glyph(c, p.type, { open: p.type === 'gate' ? p.p.open : 1, frac: p.type === 'tank' ? p.p.gal / p.p.cap : 0.8, rot: p.rot, alive: true, on: !!p.p.on }); c.restore(); }
    // the edits
    for (const it of (diff && diff.items) || []) { const gone = /removed/.test(it.what); c.strokeStyle = gone ? '#ff4b3a' : '#ffb224'; c.lineWidth = Math.max(2, s * 0.12);
      c.beginPath(); c.arc(ox + (it.x + 0.5) * s, oy + (it.y + 0.5) * s, s * 0.75, 0, TAU); c.stroke(); }
    c.restore();
  };
})();
