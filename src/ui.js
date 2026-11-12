// HUD: top bar, toolbar, annunciator, modals (menu, briefing, goals, review, tests, report).
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const $ = (id) => document.getElementById(id), g = () => DI.game;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const ui = DI.ui = { modalOpen: false };
  const TOOLS = [['select', 'Select', 'Q'], ['pipe', 'Main', '1'], ['branch', 'Sprinklers', '2'], ['head', 'Head', '3'], ['air', 'Air line', '4'], ['wire', 'Wire', '5'], ['cap', 'Cap', '6'], ['erase', 'Erase', 'X']];
  const SHORT = { city: 'City Tap', tank: 'Tank', epump: 'Electric', dpump: 'Diesel', jockey: 'Jockey', bfp: 'Backflow', gate: 'Valve', check: 'Check', fdc: 'FDC', testhdr: 'Test Hdr', wetv: 'Wet', dryv: 'Dry', prev: 'Preaction', comp: 'Compr.', n2: 'N\u2082 Gen', panel: 'Panel', vesda: 'VESDA', smoke: 'Smoke', mstn: 'Station' };
  const HINT = { select: 'Click anything to inspect and operate it. Right-drag or WASD to pan, wheel to zoom.', pipe: 'Drag to lay main pipe. [ and ] change size. Drawing over pipe resizes it.',
    branch: 'Drag a rectangle of sprinkler branch lines. R flips their direction. Feed each line from a main at one end.', head: 'Click a pipe to add or remove a sprinkler on it.',
    air: 'Drag air / nitrogen tubing from a compressor or generator to a dry or preaction valve.', wire: 'Click a panel, then each device to wire to it (valves, pumps, detectors).', cap: 'Cap a joint so two neighbouring pipes do NOT connect. Click near the joint, or drag along a row or column to cap its whole far side. Again to remove.', erase: 'Drag to remove. Full refund.' };

  ui.init = function () {
    $('bMenu').onclick = () => { DI.saveGame(); ui.showMenu(); };
    $('bGoals').onclick = ui.showGoals; $('bSite').onclick = () => ui.showSite(); $('bReview').onclick = ui.showReview; $('bTests').onclick = ui.showTests; $('bManual').onclick = () => ui.showManual();
    $('bDrill').onclick = ui.askDrill; $('bHint').onclick = () => DI.puzUI.hint(); $('bDiag').onclick = () => DI.puzUI.diagnose(); $('bSnd').onclick = () => { const on = DI.audio.toggle(); $('bSnd').classList.toggle('on', on); };
    $('bSnd').classList.add('on');
    document.querySelectorAll('.sp').forEach((b) => { b.onclick = () => DI.setSpeed(+b.dataset.sp); });
    $('bSkip').onclick = (e) => ui.pop(e.clientX - 60, 44, [['10 minutes', 600], ['1 hour', 3600], ['1 day', 86400], ['1 week', 604800], ['1 year', DI.YEAR], ['5 years', 5 * DI.YEAR]].map(([n, s]) => [n, () => DI.skip(s)]));
    $('bInc').onclick = (e) => ui.pop(e.clientX - 100, 44, [
      ['Utility power: toggle', () => { g().W.power = !g().W.power; }], ['Weather: -10 °F', () => { g().W.outTemp = -10; }], ['Weather: 70 °F', () => { g().W.outTemp = 70; }],
      ['False smoke in every room', () => { for (const r of g().W.rooms) g().S.smoke[r.id] = 2.5; }],
      ['Break a pipe', () => { const S = g().S, t = ['hall', 'elec', 'dock', 'stor', 'batt', 'office'].find((q) => DI.G.sysOf(S, q).length); if (!t || !DI.X.pipeBreak(t)(S)) ui.banner('No sprinkler system main to break yet. Or select a pipe tile and break that one.'); }], ['Wipe the map and start over', () => { DI.LS.del('di.save.' + g().sc.id); DI.startScenario(g().sc.id, true); }], ['Tip: select a tile to ignite it or break its sprinkler', () => {}]]);
    $('modal').addEventListener('mousedown', (e) => { if (e.target === $('modal') && ui.dismiss) ui.close(); });
    window.addEventListener('resize', () => ui.fitPanels());
    document.addEventListener('mousedown', (e) => { if (!$('pop').contains(e.target)) $('pop').style.display = 'none'; });
    DI.bus.on('log', (text, cls) => { const d = document.createElement('div'); d.className = cls || ''; d.innerHTML = '<i>' + DI.clock(g().S ? g().S.t : 0).slice(-8) + '</i>' + esc(text); const L = $('log'); L.appendChild(d); while (L.childNodes.length > 80) L.removeChild(L.firstChild); L.scrollTop = 1e6; });
    DI.bus.on('banner', ui.banner);
    // a banner goes away by itself after 7 s, or at once with a click
    $('banner').addEventListener('click', () => { clearTimeout(ui.bt); $('banner').classList.remove('show'); });
    for (const id of ['sigs', 'imp', 'stq']) $(id).addEventListener('click', (e) => { const el = e.target.closest('.sig, .imp, .stq'); if (!el) return; const p = g().W.parts.get(+el.dataset.p); if (p) ui.focus(p.x, p.y, { kind: 'part', id: p.id }); });
  };
  ui.focus = function (x, y, sel) { const G = g(); G.cam.x = x + 0.5; G.cam.y = y + 0.5; G.mark = { x, y, t: G.now }; if (sel) { G.sel = sel; DI.inspect.render(true); } };
  ui.banner = function (t) { const b = $('banner'); b.textContent = t; b.classList.add('show'); clearTimeout(ui.bt); ui.bt = setTimeout(() => b.classList.remove('show'), 7000); };
  ui.pop = function (x, y, items) { const p = $('pop'); p.innerHTML = ''; for (const [n, fn] of items) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { p.style.display = 'none'; fn(); }; p.appendChild(b); } p.style.left = Math.max(4, Math.min(innerWidth - 190, x)) + 'px'; p.style.top = y + 'px'; p.style.display = 'block'; };
  ui.modal = function (html, dismiss) { ui.ce = 0; $('mbox').classList.remove('wide', 'menu-box', 'brief-box'); $('modal').classList.remove('menu-mode'); $('mbox').innerHTML = html; $('modal').classList.add('show'); ui.modalOpen = true; ui.dismiss = dismiss !== false; $('mbox').scrollTop = 0; };
  ui.close = function () { $('modal').classList.remove('show'); ui.modalOpen = false; ui.ce = 0; };
  ui.setTool = function (type, part) { const G = g(); G.tool.type = type; G.tool.part = part || null; G.ghost = null; G.wireFrom = 0; ui.hintText = type === 'part' ? DI.PARTS[part].name + ' (' + DI.money(DI.partCost(part)) + '): click to place, R rotates. ' + DI.PARTS[part].desc : HINT[type] || ''; ui.toolbar(); DI.cv.style.cursor = type === 'select' ? 'default' : 'crosshair'; };

  ui.toolbar = function () {
    const G = g(), T0 = $('tools'); T0.innerHTML = '<div id="hint"></div><div class="rowg"></div>'; const T = T0.lastChild; T0.firstChild.textContent = ui.hintText || '';
    const grp = (name) => { const d = document.createElement('div'); d.className = 'grp'; d.innerHTML = '<span>' + name + '</span><div class="bs"></div>'; T.appendChild(d); return d.lastChild; };
    const btn = (par, icon, label, key, on, fn, tip) => { const b = document.createElement('button'); b.className = 'tb' + (on ? ' on' : ''); b.appendChild(DI.iconCanvas(icon, 30)); b.insertAdjacentHTML('beforeend', '<kbd>' + key + '</kbd>' + esc(label)); b.onclick = fn; b.title = tip || label; par.appendChild(b); };
    let d = grp('TOOLS');
    for (const [t, n, k] of TOOLS) { if ((t === 'air' && !G.sc.parts.some((p) => p === 'comp' || p === 'n2')) || (t === 'wire' && !G.sc.parts.includes('panel'))) continue; btn(d, t, n, k, G.tool.type === t, () => ui.setTool(t), HINT[t]); }
    d = grp('SIZE'); const sz = document.createElement('div'); sz.className = 'szs';
    const sk = G.tool.type === 'branch' ? 'bsize' : 'size';
    DI.PIPES.forEach((p, i) => { const b = document.createElement('button'); b.className = 'tb sz' + (G.tool[sk] === i ? ' on' : ''); b.textContent = p.n; b.title = p.n + ' pipe: ' + DI.money(p.cost) + ' per 10 ft'; b.onclick = () => { G.tool[sk] = i; ui.toolbar(); }; sz.appendChild(b); }); d.appendChild(sz);
    for (const cat of DI.CATS) {
      const ps = G.sc.parts.filter((p) => DI.PARTS[p].cat === cat.id); if (!ps.length) continue; d = grp(cat.name.toUpperCase());
      for (const p of ps) btn(d, p, SHORT[p] || DI.PARTS[p].name, '', G.tool.type === 'part' && G.tool.part === p, () => ui.setTool('part', p), DI.PARTS[p].name + ' - ' + DI.money(DI.partCost(p)) + '\n' + DI.PARTS[p].desc);
    }
    ui.fitPanels();
  };
  // The toolbar grows with the parts a scenario offers (two rows in the sandbox and contract 7). Keep the
  // inspector and the annunciator above it, so the last controls of a panel are never hidden behind it.
  ui.fitPanels = function () { const top = $('tools').getBoundingClientRect().top; if (!(top > 0)) return; for (const id of ['side', 'ann']) $(id).style.maxHeight = Math.max(180, top - 52 - 8) + 'px'; };
  ui.onScenario = function () {
    const G = g(); ui.close(); $('log').innerHTML = ''; $('scName').innerHTML = esc(G.sc.name) + '<small>' + esc(G.sc.tag) + '</small>';
    $('bInc').style.display = G.sc.sandbox ? '' : 'none'; $('bSite').style.display = ''; $('bDrill').style.display = G.sc.drill ? '' : 'none'; $('bGoals').style.display = G.sc.goals.length ? '' : 'none';
    $('bHint').style.display = $('bDiag').style.display = G.sc.puzzle ? '' : 'none';
    ui.setTool('select'); DI.inspect.render(true);
  };
  ui.tick = function () {
    const G = g(), S = G.S, W = G.W;
    $('clock').textContent = (G.warp > 0 ? '⏩ ' : '') + DI.clock(S.t);
    $('money').textContent = G.sc.sandbox ? '∞' : DI.money(W.money); $('money').classList.toggle('neg', W.money < 0);
    $('goalN').textContent = G.goalOk.filter(Boolean).length + '/' + G.goalOk.length;
    $('wx').textContent = DI.fmt(W.outTemp) + '°F  ' + (W.power ? 'UTILITY OK' : 'UTILITY OUT');
    $('wx').style.color = W.power ? '' : 'var(--red)';
    const dr = S.drill && !S.drill.done; $('bDrill').textContent = dr ? 'Drill running…' : 'Run drill'; $('bDrill').disabled = !!dr; $('bDrill').classList.toggle('go', !dr && DI.goalsDone()); $('bDrill').classList.toggle('hot', !!dr);
    if (G.sc.puzzle && S.puz) { const left = G.sc.v.hints.length - S.puz.hints; $('bHint').textContent = 'Hint (' + left + ')'; $('bDiag').classList.toggle('go', !S.puz.diag.ok); $('bDiag').textContent = S.puz.diag.ok ? 'Diagnosed' : 'Diagnose'; }
    // Impairment tags are riser tags, not signals: listed above the signals, and still shown with a dead panel.
    const imps = DI.impairments(S), ih = imps.length ? '<div class="hd3">IMPAIRMENT TAGS</div>' + imps.map((x) => '<div class="imp" data-p="' + x.id + '">' + esc(x.text) + '</div>').join('') : '';
    if ($('imp').dataset.h !== ih) { $('imp').innerHTML = ih; $('imp').dataset.h = ih; }
    // Annunciator: alarm, then OPEN (release input, class not elected), then supervisory, then trouble. A detector
    // stage that a higher stage has superseded stays listed as the record of the crossing and is not counted.
    // A dead panel is dark: its own signals (o.dark) are not listed. What the supervising station reports about it
    // (o.lost: loss of communication) is listed ahead of the rest, on its own line. That line arrives only after the
    // station's supervision interval, so the banner reads PANEL DEAD from the panel itself, not from that line.
    // A signal whose transmission is delayed (AC failure) says so until the station has it (o.tx).
    // A signal with an entry in the DACT queue (o.q) shows its live state: RETRYING n of 10, HELD, COMM FAILURE,
    // SENT hh:mm (late), with RESTORAL hh:mm once its restoral has gone, NOT SENT (hold off) for a signal that had
    // restored, or NOT SENT (panel dead): HAZARD CASE. The queue itself is listed under the signals (#stq).
    let h = '', al = 0, sv = 0, tr = 0, op = 0, loud = 0, lost = 0; const ORD = DI.SIG_ORDER, all = [...S.sig.values()];
    for (const o of all) if (o.lost) { lost++; h += '<div class="sig TRBL stn" data-p="' + o.part + '"><b>TRBL</b><span><em>SUPERVISING STATION</em> ' + esc(o.text) + '</span></div>'; }
    const list = all.filter((o) => !o.lost && !o.dark).sort((a, b) => (a.type === b.type ? b.t0 - a.t0 : ORD[a.type] - ORD[b.type]));
    for (const o of list) { if (!o.sup) { if (o.type === 'ALARM') al++; else if (o.type === 'OPEN') op++; else if (o.type === 'SUPV') sv++; else tr++; if (!DI.sigSilenced(W, o)) loud++; }
      h += '<div class="sig ' + o.type + (o.mon ? '' : ' loc') + (o.sup ? ' sup' : '') + '" data-p="' + o.part + '"><b>' + o.type + '</b><span>' + esc(o.text) + (o.mon ? (o.q ? ' <em>(' + esc(DI.dactLabel(o.q)) + ')</em>' : o.cut ? ' <em>(cannot be sent to the supervising station)</em>' : o.delay && !o.tx ? ' <em>(not yet sent to the supervising station: ' + DI.delayText(o.delay) + ' delay)</em>' : '') : ' <em>(local only)</em>') + '</span></div>'; }
    // an empty list under a dead panel is a dark display, not "normal"
    const deadP = W.byType('panel').some((q) => q.p.alive === false), none = deadP ? 'Display dark: the panel is dead. Nothing is shown or sent.' : 'All systems normal.';
    if ($('sigs').dataset.h !== h + none) { $('sigs').innerHTML = h || '<div class="sig"><span style="color:var(--dim)">' + none + '</span></div>'; $('sigs').dataset.h = h + none; }
    // Supervising station queue (DACT path): every entry that is not sent yet or was never sent, and the last 8 sent
    // ones. Live state only: the cause-and-effect matrix stays design intent.
    const sq = DI.stationQueue(S), sent = sq.filter((r) => r.state === 'SENT').slice(-8), shown = sq.filter((r) => r.state !== 'SENT' || sent.includes(r));
    const qh = shown.length ? '<div class="hd3">SUPERVISING STATION QUEUE</div>' + shown.map((r) => '<div class="stq ' + r.state + (r.hazard ? ' haz' : '') + '" data-p="' + r.panel + '"' + (r.hazard ? ' title="' + esc(DI.dactHazard(W)).replace(/"/g, '&quot;') + '"' : '') + '><b>' + esc(r.label) + '</b>' + esc(' · ' + r.cls + ' · ' + r.text + ' · event ' + DI.hhmm(r.t0)) + (r.hazard ? '<small>' + esc(DI.dactHazard(W)) + '</small>' : '') + '</div>').join('') + '<div class="stqFoot" id="stqFoot">' + esc(DI.stationNote(W)) + '</div>' : '';
    if ($('stq').dataset.h !== qh) { $('stq').innerHTML = qh; $('stq').dataset.h = qh; }
    // ASSUMED presentation: the banner reads OPEN ITEM only when nothing but OPEN is present
    const st = $('annState'), sil = (al || sv || tr || op) && !loud;       // SILENCED only when every active signal's own panel is silenced
    st.textContent = (al ? 'ALARM' : sv ? 'SUPERVISORY' : tr ? 'TROUBLE' : op ? 'OPEN ITEM' : deadP || lost ? 'PANEL DEAD - DISPLAY DARK' : 'NORMAL') + (sil ? ' · SILENCED' : ''); st.className = (al ? 'al' : sv ? 'sv' : tr || lost || deadP ? 'tr' : op ? 'op' : '') + (sil ? ' sil' : '');
    DI.inspect.render(false);
    if (ui.modalOpen && ui.ce) ui.showCE(ui.ce, true);          // the matrix marks what is active now
  };

  // ---------- modals
  // Original vector artwork: an isometric server hall, drawn locally so the title screen works offline.
  // It is decorative; all live system state belongs to the map and annunciator.
  function menuArt() {
    const iso = (x, y, h) => [280 + x - y, 88 + (x + y) * 0.48 - (h || 0)];
    const pts = (a) => a.map((p) => p.join(',')).join(' ');
    const cube = (x, y, w, d, h, top, left, right) => {
      const a = iso(x, y, h), b = iso(x + w, y, h), c = iso(x + w, y + d, h), e = iso(x, y + d, h);
      return '<polygon points="' + pts([e, c, iso(x + w, y + d), iso(x, y + d)]) + '" fill="' + left + '"/><polygon points="' + pts([b, c, iso(x + w, y + d), iso(x + w, y)]) + '" fill="' + right + '"/><polygon points="' + pts([a, b, c, e]) + '" fill="' + top + '" stroke="#7194a2" stroke-opacity=".24" stroke-width=".6"/>';
    };
    let art = '<svg class="facility-art" viewBox="0 0 600 370" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="hallGlow"><stop stop-color="#155363" stop-opacity=".5"/><stop offset="1" stop-color="#0a1720" stop-opacity="0"/></radialGradient><linearGradient id="pipeGlow" x2="0" y2="1"><stop stop-color="#ffd69b"/><stop offset="1" stop-color="#ef854b"/></linearGradient></defs><ellipse cx="300" cy="212" rx="280" ry="150" fill="url(#hallGlow)"/>';
    art += cube(-20, -15, 270, 205, 9, '#142b34', '#0b1922', '#08141c');
    for (let i = 0; i <= 12; i++) { const a = iso(i * 20, 0, 10), b = iso(i * 20, 175, 10); art += '<path d="M' + a.join(' ') + 'L' + b.join(' ') + '" stroke="#70c5c9" stroke-opacity=".1"/>'; }
    for (let i = 0; i <= 9; i++) { const a = iso(0, i * 20, 10), b = iso(240, i * 20, 10); art += '<path d="M' + a.join(' ') + 'L' + b.join(' ') + '" stroke="#70c5c9" stroke-opacity=".1"/>'; }
    art += cube(-20, -15, 270, 6, 35, '#456271', '#1e3644', '#152a36');
    art += cube(-20, -9, 6, 199, 35, '#456271', '#1e3644', '#152a36');
    for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
      const x = 10 + col * 32, y = 8 + row * 44;
      art += cube(x, y, 21, 29, 30, '#304c5b', '#142936', '#0b1c28');
      for (let j = 0; j < 4; j++) { const a = iso(x + 2, y + 29, 7 + j * 5), b = iso(x + 18, y + 29, 7 + j * 5); art += '<path d="M' + a.join(' ') + 'L' + b.join(' ') + '" stroke="#36576b" stroke-width="1.4"/>'; const l = iso(x + 3, y + 29, 9 + j * 5); art += '<circle cx="' + l[0] + '" cy="' + l[1] + '" r=".9" fill="' + ((row + col + j) % 5 ? '#78d9cc' : '#e8bc74') + '"/>'; }
    }
    const line = (a, b, col, width) => '<path d="M' + iso(...a).join(' ') + 'L' + iso(...b).join(' ') + '" stroke="' + col + '" stroke-width="' + width + '" stroke-linecap="round"/>';
    art += line([-5, 15, 45], [245, 15, 45], '#182e37', 8) + line([-5, 15, 46], [245, 15, 46], '#f0a466', 3.5);
    for (let x = 20; x < 240; x += 64) {
      art += line([x, 15, 46], [x, 170, 46], '#263b40', 5) + line([x, 15, 47], [x, 170, 47], '#df9c65', 2);
      for (let y = 40; y < 170; y += 40) { const q = iso(x, y, 47); art += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3" fill="#e0f7f4"/><circle cx="' + q[0] + '" cy="' + q[1] + '" r="6" stroke="#a8e3e0" stroke-opacity=".2"/>'; }
    }
    art += '<path d="M63 267H120L161 244M465 114L520 84H569" stroke="#5f8b99" stroke-width=".8"/><circle cx="161" cy="244" r="3" fill="#8eddd6"/><circle cx="465" cy="114" r="3" fill="#e6ad75"/><text x="38" y="283" fill="#86b4bf" font-family="monospace" font-size="8" letter-spacing="1.5">PROTECT THE CAMPUS</text><text x="477" y="74" fill="#d1ac80" font-family="monospace" font-size="8" letter-spacing="1.5">EVERY SECOND COUNTS</text><path d="M280 337h42m-21-5v10" stroke="#507786"/><text x="279" y="358" fill="#598493" font-family="monospace" font-size="8" letter-spacing="2">SYSTEMS / STRATEGY / SURVIVAL</text></svg>';
    return art;
  }
  ui.showMenu = function () {
    const G = g(); G.mode = 'menu';
    const contracts = DI.SCEN.filter((sc) => !sc.sandbox), won = contracts.filter((sc) => G.prog.done[sc.id] && G.prog.done[sc.id].stars > 0).length;
    let unlocked = true, h = '<div class="menu-mast"><span class="di-mark" aria-hidden="true">Ⅱ</span><span>CRITICAL INFRASTRUCTURE / OPERATIONS DIVISION</span><span class="menu-status"><i></i> SIMULATION ONLINE</span></div><section class="menu-hero"><div class="hero-copy"><div class="eyebrow">A FIRE PROTECTION STRATEGY GAME</div><h1>DOUBLE<br><span>INTERLOCK</span></h1><p class="hero-line">Build with purpose.<br>Protect under pressure.</p><p class="hero-description">Engineer the systems that stand between a data center and disaster. Learn the physics. Master the response.</p><div class="hero-tags"><span>LIVE HYDRAULICS</span><span>REAL CONSEQUENCES</span><span>HANDS-ON LEARNING</span></div></div>' + menuArt() + '</section><div class="campaign-heading"><div><span class="eyebrow">BUILD. COMMISSION. SURVIVE.</span><h2>Choose your contract</h2></div><div class="campaign-progress"><strong>' + String(won).padStart(2, '0') + '</strong><span>/ ' + String(contracts.length).padStart(2, '0') + ' CONTRACTS CLEARED</span></div></div><div class="cards campaign-cards">';
    DI.SCEN.forEach((sc, i) => {
      const d = G.prog.done[sc.id], open = unlocked || sc.sandbox, sv = DI.LS.get('di.save.' + sc.id, null);
      h += '<button class="card' + (open ? ' available' : ' lock') + (sc.sandbox ? ' sandbox-card' : '') + '" data-sc="' + sc.id + '"' + (open ? '' : ' disabled') + '><div class="card-top"><em>' + (sc.sandbox ? 'FREE PLAY' : 'CONTRACT ' + String(i + 1).padStart(2, '0')) + '</em><span class="card-state">' + (d && d.stars ? '★'.repeat(d.stars) : !open ? 'LOCKED' : sv ? 'RESUME ↗' : 'DEPLOY ↗') + '</span></div><b>' + esc(sc.name) + '</b><small>' + esc(sc.tag) + (sv ? ' · in progress' : '') + '</small><span class="card-rule"><span style="width:' + (d ? (d.stars / 3 * 100) : 0) + '%"></span></span></button>';
      if (!sc.sandbox && !d) unlocked = false;
    });
    h += '</div>' + DI.puzUI.menuHtml() + '<div class="mrow"><span style="color:var(--dim);font-size:12px;margin-right:auto">' + (DI.desktop && DI.desktop.available ? 'Progress saves on this PC.' : 'Progress saves in this browser.') + ' Numbers follow NFPA 13 (the enforced edition is a site setting, default 2025), NFPA 20, NFPA 25 and NFPA 72, plus the company rules listed under Site. Verify against the adopted edition before using them on a job.</span><button id="mUnlock">Unlock all</button><button id="mMan">Field manual</button></div>';
    if (DI.desktop && DI.desktop.available) h += '<div class="mrow"><span style="color:var(--dim);font-size:12px;margin-right:auto">Windows desktop · Progress saves on this PC.</span><button id="mUpdates">Check for updates</button></div>';
    ui.modal(h, false);
    $('mbox').classList.add('menu-box'); $('modal').classList.add('menu-mode');
    if ($('mUpdates')) $('mUpdates').onclick = DI.desktop.check;
    $('mbox').querySelectorAll('.card[data-sc]').forEach((b) => { b.onclick = () => DI.startScenario(b.dataset.sc); }); DI.puzUI.bindMenu();
    $('mMan').onclick = () => ui.showManual(null, ui.showMenu);
    $('mUnlock').onclick = () => { for (const sc of DI.SCEN) if (!sc.sandbox && !G.prog.done[sc.id]) G.prog.done[sc.id] = { stars: 0, spent: 0 }; for (const pz of DI.PUZ) if (!G.prog.done[pz.id]) G.prog.done[pz.id] = { stars: 0, v: {} }; DI.LS.set('di.progress', G.prog); ui.showMenu(); };
  };
  ui.showBrief = function (sc) {
    if (sc.puzzle) return DI.puzUI.brief(sc);
    ui.modal('<div class="brief-heading"><span class="eyebrow">OPERATIONS / CONTRACT BRIEFING</span><h2>' + esc(sc.name) + '</h2><div class="sub">' + esc(sc.tag).toUpperCase() + ' · BUDGET ' + DI.money(sc.money) + '</div></div>' + sc.brief.map((p) => '<p>' + esc(p) + '</p>').join('') +
      (sc.learn.length ? '<h4>WHAT THIS CONTRACT TEACHES</h4><ul class="learning-grid">' + sc.learn.map((l, i) => '<li><span>' + String(i + 1).padStart(2, '0') + '</span><div>' + esc(l) + '</div></li>').join('') + '</ul>' : '') +
      (sc.goals.length ? '<h4>GOALS</h4>' + sc.goals.map((q) => '<div class="goal"><i>○</i><div>' + esc(q.t) + '</div></div>').join('') : '') +
      '<div class="mrow"><span class="brief-tip">Plan your system. Prove it under pressure.</span><button id="mGo" class="go">Start contract</button></div>');
    $('mbox').classList.add('brief-box');
    $('mGo').onclick = ui.close;
  };
  ui.showGoals = function () {
    if (g().sc.puzzle) return DI.puzUI.goals();
    const G = g(); let h = '<h4>' + esc(G.sc.name).toUpperCase() + '</h4><h2>Goals</h2>';
    G.sc.goals.forEach((q, i) => { h += '<div class="goal' + (G.goalOk[i] ? ' ok' : '') + '"><i>' + (G.goalOk[i] ? '✓' : '○') + '</i><div>' + esc(q.t) + (!G.goalOk[i] && q.hint ? '<small>' + esc(q.hint) + '</small>' : '') + '</div></div>'; });
    if (G.sc.drill) h += '<p>When every goal is met, run the acceptance drill: <b>' + esc(G.sc.drill.name) + '</b>. You can run it early to see what happens. It will not be kind.</p>';
    ui.modal(h + '<div class="mrow"><button id="mRe" style="margin-right:auto">Restart contract</button><button id="mBrief">Briefing</button><button id="mGo" class="go">Close</button></div>'); $('mGo').onclick = ui.close; $('mBrief').onclick = () => ui.showBrief(G.sc);
    $('mRe').onclick = () => { if ($('mRe').dataset.sure) { DI.LS.del('di.save.' + G.sc.id); DI.startScenario(G.sc.id, true); } else { $('mRe').dataset.sure = 1; $('mRe').textContent = 'Click again to wipe this map'; $('mRe').className = 'hot'; } };
  };
  ui.showReview = function () {
    const G = g(); G.S.rv = DI.review(G.S); const J = DI.juris; let h = '<h4>AUTHORITY HAVING JURISDICTION</h4><h2>Plan review</h2>' + (J.delta.length ? '<p><b>Edition delta vs 2025:</b> ' + J.delta.map(esc).join(' ') + '</p>' : '') + '<p>Reviewed to NFPA 13-' + J.nfpa13 + '. Click a finding to jump to it.</p>';
    G.S.rv.forEach((f, i) => { h += '<div class="find ' + f.sev + '" data-i="' + i + '">' + esc(f.text) + (f.ref ? '<small>' + esc(f.ref) + '</small>' : '') + '</div>'; });
    ui.modal(h + '<div class="mrow"><button id="mGo" class="go">Close</button></div>'); $('mGo').onclick = ui.close;
    $('mbox').querySelectorAll('.find').forEach((el) => { el.onclick = () => { const f = G.S.rv[+el.dataset.i]; if (f.x !== undefined) { ui.close(); ui.focus(f.x, f.y); } }; });
  };
  // Site / project settings: enforced edition, company rules and the values that are ASSUMED or NEEDS PE REVIEW.
  // ui.siteSet is the only writer of W.cfg in the front end. It works in the sandbox only: in a contract the
  // basis of design is fixed (set by the AHJ, the owner and the insurer) and the dialog is read-only.
  ui.siteSet = function (key, val) {
    const G = g(), W = G.W, c = W.cfg; if (!G.sc.sandbox) return false;
    const num = (x, lo, hi) => typeof x === 'number' && isFinite(x) && x >= lo && x <= hi;
    if (key === 'ed') { if (!DI.editionChoices().includes(val)) return false; c.edition = val; }
    else if (key === 'cut') { if (!DI.PIPE_CUTS.includes(+val)) return false; c.pipeCut = +val; }
    else if (key === 'n76') c.nfpa76Adopted = val === '1';
    // the aspirating detector model: only a model in the table. It never edits a threshold (no clamping).
    else if (key === 'asd') { if (!Object.prototype.hasOwnProperty.call(DI.ASD_MODELS, val)) return false; c.asdModel = val; }
    else if (key === 'byp') c.manualReleaseBypassP = val === '1';
    else if (key === 'ins') c.insurer = val === 'FM' ? 'FM' : 'none';
    // "Check against NFPA 76" reads the thresholds against the two ceilings and writes nothing (the dialog shows the result)
    else if (key === 'pre') { ui.siteNote = ''; if (val === 'reset') { delete c.detThr; delete c.spotThr; } else { if (val === 'nfpa76') ui.siteNote = DI.n76Check(W); return false; } }
    // supervising station: the path type sets when a dead panel is annunciated; the AC-fail transmission delay is 60 to 180 min
    else if (key === 'path') { if (!Object.prototype.hasOwnProperty.call(DI.COMM_PATH, val)) return false; c.commPath = val; }
    else if (key === 'acd') { if (!DI.AC_DELAY_MIN.includes(+val)) return false; c.acDelayMin = +val; }
    // the NFPA 72 edition is its own setting (adoption is by the AHJ and can differ from NFPA 13); Auto stores nothing
    else if (key === 'ed72') { if (!DI.ED72.includes(val)) return false; if (val === 'auto') delete c.ed72; else c.ed72 = val; }
    // cause-and-effect hooks: displayed in the matrix only, the engine never acts on them. HVAC = the trigger stage.
    else if (key === 'hvac') { if (!Object.prototype.hasOwnProperty.call(DI.HVAC_HOOKS, val)) return false; if (val === 'none') delete c.hvacHook; else c.hvacHook = val; }
    else if (key === 'epo') { if (val === '1') c.epoHook = true; else delete c.epoHook; }
    // DACT hold and send after a communications failure: ON is the default and stores nothing
    else if (key === 'dactHold') { if (val === '0') c.dactHold = false; else delete c.dactHold; }
    // standby basis of the releasing panel (only a selectable row), the generator-backed option, the air refill order
    else if (key === 'standby') { const r = DI.STANDBY.find((q) => q.key === val); if (!r || !r.sel) return false; if (val === DI.STANDBY_DEFAULT) delete c.standby; else c.standby = val; }
    else if (key === 'gen') { if (val === '1') c.panelGen = true; else delete c.panelGen; }
    // air refill order: all zones at once is the default and stores nothing (the 60 min freezer limit is set on the room, not here)
    else if (key === 'seq') { if (val === '1') c.refillSeq = true; else delete c.refillSeq; }
    // owner / insurer refill target in minutes: none is the default and stores nothing (a plan-review warning, never a code limit)
    else if (key === 'own') { if (!DI.OWNER_REFILL.includes(+val)) return false; if (+val > 0) c.ownerRefill = +val; else delete c.ownerRefill; }
    // NEC edition for the NAC wire resistance: 2023 is the default and stores nothing
    else if (key === 'nec') { if (!DI.NEC.includes(val)) return false; if (val === '2026') c.nec = '2026'; else delete c.nec; }
    // VEA Fire 1 pick: one of the three listed settings, stored as the Fire 1 threshold (index 2). Nothing else is written.
    else if (key === 'vea') { if (!DI.ASD_MODELS.VEA.pick.includes(+val)) return false; const t = DI.detThr(W).slice(); t[2] = +val; c.detThr = t; }
    // a threshold is stored exactly as typed: out of range or out of order shows red and fails plan review, it is never clamped
    else if (key === 'thr') { const t = DI.detThr(W).slice(); if (!num(val[1], 1e-6, 1e3)) return false; t[val[0]] = val[1]; c.detThr = t; }
    else if (key === 'spot') { if (!num(val, 1e-6, 1e3)) return false; c.spotThr = val; }
    else if (key === 'fit') { if (!num(val, 0, 50)) return false; c.fitPct = val; }
    else if (key === 'trim') { if (!num(val, 0, 50)) return false; c.trimGal = val; }
    else if (key === 'alert' || key === 'action' || key === 'pLatch') { if (!DI.SIG_CLASS[key].includes(val)) return false; c.sigClass = Object.assign({}, c.sigClass, { [key]: val }); }   // SUPV is not in the pLatch list
    else return false;
    W.ver++; DI.setJuris(W); G.S.touch(); DI.edited(); return true;
  };
  ui.showSite = function () {
    const G = g(), W = G.W, c = W.cfg, ro = !G.sc.sandbox, J = DI.setJuris(W), thr = DI.detThr(W), cut = DI.pipeCut(W), ed = DI.JURIS[c.edition] && !DI.JURIS[c.edition].hidden ? c.edition : DI.EDITION_DEFAULT;
    const opt = (grp, val, label, on, dis) => '<button data-s="' + grp + '" data-v="' + val + '"' + (on ? ' class="on"' : '') + (dis || ro ? ' disabled' : '') + '>' + esc(label) + '</button>';
    const rowL = (inner) => '<div class="mrow" style="justify-content:flex-start;margin-top:6px;flex-wrap:wrap">' + inner + '</div>';
    const lab = (t) => '<span style="font-size:13px;color:#b6c6d2">' + t + '</span>';
    const inp = (key, val, step, w) => '<input data-n="' + key + '" type="number" step="' + step + '" min="0" value="' + val + '"' + (ro ? ' disabled' : '') + ' style="width:' + (w || 74) + 'px;background:#0c1218;color:#e6eef3;border:1px solid #2f4254;border-radius:4px;padding:5px 6px;font:13px Consolas,monospace">';
    const A = ' <b style="color:var(--amb)">ASSUMED</b>', PE = '<b style="color:var(--amb)">NEEDS PE REVIEW</b>', CLS = { SUPV: 'Supervisory', ALARM: 'Alarm', TRBL: 'Trouble', OPEN: 'Not elected' };
    const LS = DI.LISTED.smoke, D = DI.DELIVERY, mk = DI.asdModel(W), M = DI.ASD_MODELS[mk], RG = DI.asdRange(W), af = DI.asdFmt;
    const badStage = new Set(DI.asdFindings(W).map((x) => x.stage)), flags = DI.n76Flags(W), note76 = DI.n76Note(W), R72 = DI.ref72(W), cp = DI.COMM_PATH[DI.commPath(W)], hv = DI.hvacHook(W), epo = DI.epoHook(W);
    // the NFPA 72 edition row is US only: a Canadian row ignores the setting and the row is not shown
    const us = J.country === 'US', e72 = DI.ED72.includes(c.ed72) ? c.ed72 : 'auto';
    let h = '<h4>SITE SETTINGS</h4><h2>Project and company rules</h2><div class="mrow" style="justify-content:flex-start;margin:0 0 8px"><button id="mSched" title="Read-only: every signal, its class, and whether it goes to the supervising station only or on to the fire department.">Signal schedule</button><button id="mStby" title="Read-only: the standby battery bases by panel type, with their tags.">Standby reference</button></div>';
    if (ro) h += '<p id="siteRO" style="border-left:3px solid var(--amb);padding-left:10px"><b>Basis of design is fixed in a contract: set by the AHJ, the owner and the insurer.</b> These settings are read-only here. They can be changed in the Sandbox.</p>';
    h += '<p>ASSUMED marks a value the company has not fixed: it is a tunable default. NEEDS PE REVIEW marks a choice an engineer of record has to make.</p>';
    h += '<h4>ENFORCED EDITION OF NFPA 13 (US)</h4>' + rowL(DI.editionChoices().map((k) => opt('ed', k, 'NFPA 13-' + DI.JURIS[k].nfpa13, ed === k)).join(''));
    h += '<p id="siteDelta">' + (J.delta.length ? '<b>Edition delta vs 2025:</b> ' + J.delta.map(esc).join(' ') + ' ' : '') + 'Citations in plan review and on test reports follow the edition. Pass and fail do not differ by edition in this version.</p>';
    if (us) {
      h += '<h4>ENFORCED EDITION OF NFPA 72 (US)</h4>' + rowL(lab('NFPA 72 edition (site setting; adoption is by the AHJ and can differ from NFPA 13)') + opt('ed72', 'auto', 'Auto (follows NFPA 13)', e72 === 'auto') + DI.ED72.filter((k) => k !== 'auto').map((k) => opt('ed72', k, 'NFPA 72-' + k, e72 === k)).join(''));
      h += '<p id="ed72Note">In force here: <b>NFPA 72-' + DI.ed72(W) + '</b>. The supervising-station, panel-power and DACT citations follow it; NFPA 13 citations do not change. Separate settings because the two are adopted separately (PRACTICE).</p>';
    }
    h += '<h4>HAZEN-WILLIAMS C</h4><p>C = ' + DI.HW_C + ' for all sprinkler pipe: wet, dry, preaction, interior, yard and underground. Company rule. Nitrogen earns no credit.<br><span style="color:var(--dim)">Comparison only: the NFPA table value is 120 for wet steel. It has no effect on any calculation here.</span></p>';
    h += '<h4>PIPE SCHEDULE: SIZE CUT</h4>' + rowL(lab('Largest size on threaded Schedule 40') + DI.PIPE_CUTS.map((i) => opt('cut', i, DI.PIPES[i].n.replace('"', ' in.'), cut === i)).join(''));
    h += '<p>' + esc(DI.PIPES[cut].n.replace('"', ' in.')) + ' and smaller is threaded Schedule 40; every larger size is roll-grooved Schedule 10, main or branch alike.' + A + ' (default 2 in.). It sets the inside diameter and volume of every pipe. Cost per size is the same for both schedules (ASSUMED).</p>';
    h += '<h4>WATER DELIVERY</h4>' + rowL('<label>' + lab('Fittings allowance, % of pipe volume ') + inp('fit', DI.cfgNum(W, 'fitPct'), 1, 60) + '</label><label>' + lab('Trim volume per valve, gal ') + inp('trim', DI.cfgNum(W, 'trimGal'), 1, 60) + '</label>');
    h += '<p>Zone volume = pipe + fittings + trim.' + A + ' (5 % and 2 gal). NFPA 13 judges the size exemptions on it: a dry system needs the ' + D.timed + ' s timed trip test above ' + D.dry + ' gal (' + D.dryQod + ' gal with a quick-opening device), a double-interlock system above ' + D.di + ' gal, and a quick-opening device does not extend that one.</p>';
    h += rowL(lab('Insurer') + opt('ins', 'none', 'None', DI.insurer(W) === 'none') + opt('ins', 'FM', 'FM', DI.insurer(W) === 'FM'));
    h += '<p>' + PE + ' With FM, dry and double-interlock systems must deliver water in ' + D.fm + ' s at any volume (' + D.fmRef + '). The most stringent limit governs, so a zone can pass NFPA 13 and fail FM. FM density, hose and duration are not part of this setting.</p>';
    h += '<h4>ASPIRATING DETECTION (%/FT OBSCURATION)</h4>' + rowL(lab('Aspirating detector model') + Object.keys(DI.ASD_MODELS).map((k) => opt('asd', k, DI.ASD_MODELS[k].label, mk === k)).join(''));
    if (M.fire1Only) {
      // VEA: a Fire 1-only model. One pick of three listed settings; Alert, Action and Fire 2 are not published and not shown as numbers.
      // the site pick is highlighted only where one is stored: with none, each room reads its own default
      const sp = DI.veaSitePick(W), f1 = sp === null ? null : sp, listed = sp === null || M.pick.includes(sp);
      h += '<p id="asdDoc">' + esc(M.label) + ', Fire 1 only: ' + esc(M.doc) + ' ' + esc(DI.ASD_SRC) + '. Changing the model never changes a stored threshold.</p>';
      h += rowL(lab('Fire 1 setting') + M.pick.map((x, i) => opt('vea', x, x + ' (' + M.pickName[i] + ')', f1 === x)).join('') + (listed ? '' : '<b id="veaBad" style="color:var(--red)">' + esc(f1 + ' %/ft is stored and is not a listed VEA setting: pick one') + '</b>'));
      h += '<p id="veaNote">Alert, Action and Fire 2: <b>' + esc(DI.VEA_NA) + '</b>. This detector reports Fire 1 only, the detection leg of a release: D is true at or above it, and water still needs P. A pick here is the <b>site pick</b>: it applies in every room that has no pick of its own. ' + (sp === null ? '<b>No site pick is stored now</b>, so each room reads its default' : 'With no site pick (Back to example values) each room reads its default') + ': 0.5 %/ft (High) in a telecom room where NFPA 76 applies, 1.23 %/ft (Enhanced) in every other room. A room can carry its own pick, set on the room (which rooms count as NFPA 76 telecom: PRACTICE,' + ' ' + PE + '). Plan review fails any value that is not one of the three.</p>';
      h += '<p id="veaOem" style="border-left:3px solid var(--amb);padding-left:10px">' + esc(M.oemNote) + '</p>';
    } else {
    h += '<p id="asdDoc">Listed range per stage, ' + esc(M.label) + ' (' + esc(M.models) + '): ' + esc(M.doc) + ' ' + esc(DI.ASD_SRC) + '. Changing the model never changes a threshold.</p>';
    // one input per stage with its listed range printed under it. A value outside its range, or out of order, is
    // drawn red and left exactly as typed: plan review fails it, nothing is clamped.
    h += rowL(DI.ASD_STAGES.map(([, n], i) => { const bad = badStage.has(i) || !(thr[i] > 0) || (i > 0 && !(thr[i] > thr[i - 1])) || (i < 3 && !(thr[i] < thr[i + 1]));
      return '<label style="display:inline-flex;flex-direction:column;gap:3px">' + lab(n) + '<input data-t="' + i + '"' + (bad ? ' data-bad="1"' : '') + ' type="number" step="any" min="' + RG[i][0] + '" max="' + RG[i][1] + '" value="' + thr[i] + '"' + (ro ? ' disabled' : '') + ' style="width:86px;background:#0c1218;color:' + (bad ? 'var(--red)' : '#e6eef3') + ';border:1px solid ' + (bad ? 'var(--red)' : '#2f4254') + ';border-radius:4px;padding:5px 6px;font:13px Consolas,monospace"><small data-r="' + i + '" style="font:11px var(--mono);color:var(--dim)">' + af(RG[i][0]) + ' to ' + af(RG[i][1]) + '</small></label>'; }).join(''));
    h += '<p>The four thresholds are owner-set values inside the listed range:' + A + ', ' + PE + '. The datasheets print setting ranges, not defaults; 0.03 / 0.06 / 0.12 / 1.2 are example values. Alert and Action are pre-alarm. Fire 1 is the detection leg of a release: D is true at or above it. Fire 2 is escalation and never releases by itself. Plan review fails thresholds that are not strictly increasing and any stage outside its listed range. A value typed outside the range is kept as typed and shown red.</p>';
    }
    h += rowL('<label>' + lab('Spot detector alarm threshold ') + inp('spot', DI.spotThr(W), 0.1) + '</label>' + lab('listed window ' + LS.min + ' to ' + LS.max + ' %/ft (example data)') + A);
    h += rowL(lab('NFPA 76 adopted on this site (the default for telecom rooms)') + opt('n76', '0', 'No', !c.nfpa76Adopted) + opt('n76', '1', 'Yes', !!c.nfpa76Adopted));
    h += rowL(opt('pre', 'nfpa76', 'Check against NFPA 76', false, false) + opt('pre', 'reset', 'Back to example values', false));
    if (ui.siteNote) h += '<p id="siteNote" style="border-left:3px solid var(--amb);padding-left:10px">' + esc(ui.siteNote) + '</p>';
    h += flags.map((x) => '<p class="n76" data-c="' + x.code + '" style="border-left:3px solid var(--red);padding-left:10px">' + esc(x.text) + '</p>').join('');
    if (note76) h += '<p id="n76Note" style="border-left:3px solid var(--grn);padding-left:10px">' + esc(note76) + '</p>';
    h += '<p id="n76Rooms">' + PE + ' <b>NFPA 76 applies by room.</b> Only a ' + esc(DI.ROOMS.tel.name) + ' room can be an NFPA 76 space, and a data hall never is. This setting is the default for telecom rooms; each telecom room can override it (select the room: “NFPA 76 applies here”). Which rooms count as NFPA 76 telecom is PRACTICE. The ceilings are checked in every NFPA 76 room that holds an aspirating detector: ' + (DI.n76Rooms(W).length ? esc(DI.n76Rooms(W).map((r) => r.name).join(', ')) : 'none on this site now') + '.</p>';
    h += '<p id="n76Text">' + PE + ' Where NFPA 76 applies its limits are plain ceilings (NFPA 76-2024 &sect;8.5.3.1.2.5): Alert 0.2 %/ft or less, and the 1.0 %/ft alarm ceiling applied to Fire 1, the first alarm stage. The 1.0 %/ft figure is VERIFIED (Alarm condition, air-sampling: 3.2 percent per meter, 1.0 percent per foot obscuration, effective sensitivity at each port; the same figure in NFPA 76-2020). Applying that Alarm condition to Fire 1, on a VEA detector too, is PRACTICE. Action stays pre-alarm and Fire 2 has no NFPA 76 limit. Plan review fails an Alert above 0.2 %/ft or a Fire 1 above 1.0 %/ft: on a VEA detector 1.23 and 2.5 are above the ceiling and 0.5 meets it. The check button reads the values against the ceilings and writes nothing.</p>';
    h += '<h4>SIGNAL CLASSES</h4>' + [['alert', 'Aspirating Alert'], ['action', 'Aspirating Action'], ['pLatch', 'Latched P (release input)']].map(([k, n]) => rowL(lab(n) + DI.SIG_CLASS[k].map((v) => opt(k, v, CLS[v], DI.sigClass(W, k) === v)).join(''))).join('');
    h += '<p>' + PE + A + ' Alert and Action are supervisory unless the engineer elects alarm. A latched P is a release input whose class has not been elected: it shows as an OPEN item until it is elected alarm or trouble. Supervisory is blocked for it. Fixed: Fire 1, Fire 2, manual station and waterflow are alarm; low and high air and valve tamper are supervisory; panel AC failure, low battery, loss of communication with a dead panel and loss of supply air are trouble. Loss of supply air is equipment trouble, its own signal (PRACTICE); the pressure drop it causes is still reported by the low-air supervisory.</p>';
    h += '<h4>SUPERVISING STATION AND PANEL POWER (NFPA 72)</h4>' + rowL(lab('Supervising-station path (OWNER)') + Object.keys(DI.COMM_PATH).map((k) => opt('path', k, DI.COMM_PATH[k].label, DI.commPath(W) === k)).join(''));
    h += '<p id="pathNote">A dead panel shows and sends nothing. On this path the supervising station annunciates the loss of communication after <b>' + DI.delayText(cp.delay) + '</b> [' + esc(R72[cp.ref]) + ']. A single IP path as the default is PRACTICE. The DACT figure is its 6 h test-signal interval [' + esc(R72.dactTest) + '], used as the delay' + A + '. On the DACT path the failure of one of the two channels is a trouble sent on the other channel within ' + DI.delayText(DI.DACT_CHAN_S) + ' [' + esc(R72.dactChan) + '], and every other signal goes on the surviving channel at once: fail a channel from the panel in the Sandbox. Two-way radio paths are not modelled.</p>';
    // DACT path only: hold and send. The code is silent on holding (NOT FOUND in 2019, 2022 or 2025), so it is a setting.
    if (DI.commPath(W) === 'dact') {
      h += rowL(lab('Hold and send after a communications failure (PRACTICE, NEEDS PE REVIEW)') + opt('dactHold', '1', 'On', DI.dactHold(W)) + opt('dactHold', '0', 'Off', !DI.dactHold(W)));
      h += '<p id="holdNote">' + PE + ' With both DACT channels down nothing from the panel reaches the station, alarms included, and nothing is dispatched from it. The panel tries each signal ' + DI.DACT_TRIES + ' times, ' + DI.DACT_ATTEMPT_S + ' s each, ' + DI.DACT_TOTAL_S + ' s in all (CODE bounds, count ASSUMED; ' + esc(R72.dactTry) + '; ' + esc(R72.dactAnnex) + '), then shows DACT TRANSMISSION FAILED at the premises. ' +
        'The code is silent on holding a signal after that: holding is manufacturer behaviour (PRACTICE), so it is a setting. When a channel is back, <b>every signal that is still active is re-sent</b>, On and Off alike, in priority order: alarm, then supervisory, then trouble (' + esc(R72.priority) + '), then a class that is not elected (a latched P; where it sits is PRACTICE / OWNER), each with its original event time, ' + DI.DACT_SEND_S + ' s apart' + A + '; then the restorals; then the communications-failure trouble and its restoral. ' +
        '<b>On</b> (default): a signal that restored inside the outage is sent late too, and its restoral follows. An alarm sent late still dispatches the fire department (' + esc(R72.retransmit) + '); verification (' + esc(R72.stnVerify) + ') is not a late-signal or no-dispatch path. <b>Off</b>: drops what has restored; a live signal is always re-sent. A restoral for a signal the station already holds is never dropped. Restorals are reported to the station (' + esc(R72.restoral) + ').' + (us ? ' ' : ' ' + esc(DI.CA_STATION_NOTE) + ' ') +
        'A silenced trouble sounds again every 24 h or less (' + esc(R72.silenceTrouble) + '). The live state shows in the supervising station queue on the annunciator; the cause-and-effect matrix stays design intent.</p>';
      h += '<p id="hazNote" style="border-left:3px solid var(--red);padding-left:10px"><b>Hazard case.</b> If the panel dies with signals queued: ' + esc(DI.dactHazard(W)) + '</p>';
    }
    h += rowL(lab('AC-fail transmission delay (OWNER / AHJ)') + DI.AC_DELAY_MIN.map((m) => opt('acd', m, m + ' min', DI.acDelay(W) === m * 60)).join(''));
    h += '<p id="acdNote">' + PE + ' The panel shows an AC failure at once (the ceiling for a trouble at the panel is ' + DI.TROUBLE_PANEL_S + ' s, ' + esc(R72.panelTrouble) + '; it is a trouble signal, ' + esc(R72.acTrouble) + ') and transmits it to the supervising station only after this delay, 60 to 180 min (' + esc(R72.acDelay) + '). Power back inside the delay: nothing is sent. Low battery: ' + esc(R72.lowBatt) + '. The trouble shown here is ' + esc(DI.LOWBATT_NOTE) + ', and it is transmitted at once' + A + '. Citations are NFPA 72-' + DI.ed72(W) + ', the NFPA 72 edition set above.</p>';
    // standby battery of the releasing panel: the basis (three selectable rows) and the generator-backed option
    { const sk = DI.standbyKey(W), genSet = c.panelGen === true, ed72n = DI.ed72(W), pn0 = W.byType('panel')[0], sc0 = DI.standbyCalc(W, pn0 || null);
      h += rowL(lab('Standby basis of the releasing panel (OWNER / insurer)') + DI.STANDBY.filter((r) => r.sel).map((r) => opt('standby', r.key, r.hours + ' h + ' + r.alarmMin + ' min' + (r.key === 'fm90' ? ' (FM)' : r.key === 'owner10' ? ' (owner)' : ''), sk === r.key)).join(''));
      h += rowL(lab('Generator-backed panel (2025 only)') + opt('gen', '0', 'Battery only', !genSet) + opt('gen', '1', 'Generator-backed', genSet));
      h += '<p id="stbyNote">' + PE + ' Standby: ' + DI.STANDBY.filter((r) => r.sel).map((r) => r.hours + ' h + ' + r.alarmMin + ' min ' + esc(r.tag)).join('; ') + '. The battery must carry (standby load x hours + alarm load x minutes) x <b>' + sc0.factor.toFixed(2) + '</b>, the factor of NFPA 72-' + ed72n + ' (' + esc(R72.battFactor) + '). ' +
        'With the ASSUMED loads (' + sc0.iStby + ' A standby, ' + sc0.iAlarm + ' A alarm) this basis needs <b>' + DI.fmt(sc0.req, 1) + ' Ah</b>; the battery is picked on the panel and plan review fails one that is too small. FM is an election here, never automatic with the insurer setting. ' +
        (genSet && !DI.panelGen(W) ? '<b>The generator option is ignored: it exists in NFPA 72-2025 only and NFPA 72-' + ed72n + ' is in force.</b> ' : 'Generator-backed: batteries for ' + DI.GEN_BATT_H + ' h, the generator covers 24 h (' + esc(DI.REF72[2025].battGen) + '); ignored under 2019 and 2022. ') +
        'The charger restores a full discharge within ' + DI.RECHARGE_H + ' h (' + esc(R72.chgRecharge) + ').</p>'; }
    // NEC edition: only the NAC voltage-drop check reads it (the wire resistance table). NEC 2026 Table 8 is on hold.
    h += '<h4>NAC VOLTAGE DROP (PLAN REVIEW CHECK)</h4>' + rowL(lab('NEC edition, for the wire resistance') + DI.NEC.map((k) => opt('nec', k, 'NEC ' + k + (k === '2023' ? ' (default)' : ''), DI.nec(W) === k)).join(''));
    h += '<p id="necNote">The NAC voltage-drop check is switched on per panel (select the releasing panel); it is off by default. Wire resistance: ' + esc(DI.nec(W) === '2026' ? DI.NAC_WIRE_2026 : DI.NAC_WIRE) + '. Basis on this site: ' + esc(us ? R72.nacVd : DI.NAC_CA_HOLD) + '. The calculation is a documentation item (' + esc(R72.nacDoc) + ' [CODE]). Appliance currents, the ' + DI.NAC_VMIN + ' V minimum and the start-voltage picks are' + A + '; the ' + DI.NAC_THIN * 100 + ' % THIN margin is PRACTICE. It is a plan review check only: no signal, no matrix row, nothing in the release.</p>';
    h += '<h4>AIR REFILL</h4>' + rowL(lab('Air refill order (PRACTICE)') + opt('seq', '0', 'All zones at once (default)', !DI.refillSeq(W)) + opt('seq', '1', 'Largest zone first', DI.refillSeq(W)));
    h += '<p id="seqNote">On a shared compressor the zones fill at the same time by default (SIMPLIFICATION: parallel split). With <b>largest zone first</b> the compressor serves one calling zone at a time, the largest zone volume first, ties by the lowest zone number (PRACTICE). The code check does not change: the largest zone alone, from 0 psig, at full capacity, within the limit [' + esc(DI.refillRef(W, null)) + ']. A sequence total over the limit is informational and not a code limit.</p>';
    h += rowL(lab('Owner / insurer refill target (optional; minutes; ASSUMED picks)') + DI.OWNER_REFILL.map((m) => opt('own', m, m ? m + ' min' : 'None', DI.ownerRefill(W) === m)).join(''));
    h += '<p id="ownNote">A refill target tighter than the code, set by the owner or the insurer. It is judged the way the code check is: the largest zone alone, from 0 psig (method' + A + ', unless the owner defines it differently). Over the target and inside the code limit, plan review raises a <b>warning tagged owner/insurer criterion</b>, not a code failure (PRACTICE). Over the code limit it stays the code FAIL. Every pick here is under 30 min; a target at or above a zone’s code limit would be no tighter than the code and raises nothing.</p>';
    h += '<p id="coldNote">The air supply must restore normal pressure within <b>' + DI.REFILL_LIMIT / 60 + ' min</b> [' + esc(DI.refillRef(W, null)) + ']. ' + esc(DI.COLD_NOTE) + ' A zone gets 60 min only when every room it protects is a Refrigerated Space room with "held below 5 F" set (NFPA 13 §8.2.6.3.3 / §8.2.6.8.5, 2025 §8.2.7.4; the "every room" reading is ASSUMED, ' + PE + '). A cooled space that is not held below 5 F (a 35 F dock, for example), and every zone of a typical data center, stays at 30 min.</p>';
    h += '<h4>CAUSE-AND-EFFECT HOOKS</h4>' + rowL(lab('HVAC shutdown / damper hook: trigger (OWNER, NEEDS PE REVIEW)') + opt('hvac', 'none', 'None', hv === 'none') + opt('hvac', 'fire1', 'Fire 1', hv === 'fire1') + opt('hvac', 'fire2', 'Fire 2', hv === 'fire2') + opt('hvac', 'waterflow', 'Waterflow', hv === 'waterflow'));
    h += rowL(lab('EPO / power isolation hook (OWNER, NEEDS PE REVIEW; NEC 645, FM DS 5-32 election)') + opt('epo', '0', 'OFF', !epo) + opt('epo', '1', 'ON', epo));
    h += '<p id="hookNote">' + PE + ' HVAC: never on Alert or Action; with Fire 1 elected, manual and waterflow also trip it. EPO: waterflow only, because waterflow proves water is in the system and, on El/Pn, is the only way the panel knows the valve opened. Hook only: the game switches nothing. An elected hook appears in the cause-and-effect matrix of each preaction zone (open it from the valve or the panel) as an output contact for others to wire. With Fire 2 elected the hook sits on every row with Fire 2 = 1, release or not; a release alone (Fire 1 and P, or the Manual Release zone) does not trip it.</p>';
    h += '<p>Duct-detector shutdown (IMC) is a separate device, outside this matrix.</p>';
    h += '<h4>MANUAL RELEASE ZONE</h4>' + rowL(lab('Manual Release zone bypasses P') + opt('byp', '0', 'OFF', !c.manualReleaseBypassP) + opt('byp', '1', 'ON', !!c.manualReleaseBypassP));
    h += '<p>' + PE + ' (owner/insurer exception, footnote 9(c)). OFF: the manual station is typed DETECTION, sits inside D, and water still needs P. ON: the station is typed MANUAL RELEASE and alone releases water on an electric / electric trim. That is a separate release path, not detection: Release = (D AND P) OR (bypass AND Manual Release zone). It does not latch D, and it latches its own release until the panel is reset. On an electric / pneumatic trim the pneumatic leg sits at the valve, so P is still needed. In a contract an ON bypass is an impairment: a supervisory on the panel and a tag on the valve.</p>';
    const keep = ui.modalOpen ? $('mbox').scrollTop : 0;
    ui.modal(h + '<div class="mrow"><button id="mGo" class="go">Close</button></div>'); $('mGo').onclick = () => { ui.siteNote = ''; ui.close(); }; $('mbox').scrollTop = keep;      // a redraw keeps the reader's place
    $('mSched').onclick = () => ui.showSchedule(() => ui.showSite());       // read-only, so it also works in a contract
    $('mStby').onclick = () => ui.showStandby(() => ui.showSite());
    if (ro) return;
    const set = (k, v) => { if (k !== 'pre') ui.siteNote = ''; ui.siteSet(k, v); ui.showSite(); };
    $('mbox').querySelectorAll('button[data-s]').forEach((b) => { b.onclick = () => set(b.dataset.s, b.dataset.v); });
    $('mbox').querySelectorAll('input[data-t]').forEach((el) => { el.onchange = () => set('thr', [+el.dataset.t, parseFloat(el.value)]); });
    $('mbox').querySelectorAll('input[data-n]').forEach((el) => { el.onchange = () => set(el.dataset.n, parseFloat(el.value)); });
  };
  // Cause-and-effect matrix of one preaction zone: read-only. Every word of the table, its header lines, notes and
  // footer comes from DI.ceMatrix (cause.js); nothing about a row is written here. With refresh it redraws only
  // when something changed, so the dialog follows the plant while it is open.
  ui.showCE = function (id, refresh) {
    const m = DI.ceMatrix(g().S, id); if (!m) { if (!refresh) ui.banner('Only a preaction valve has a cause-and-effect matrix.'); return; }
    let h = '<h4>CAUSE AND EFFECT MATRIX &middot; READ-ONLY</h4><h2>' + esc(m.name) + '</h2><div class="sub" id="ceHead">' + m.head.map(esc).join(' &middot; ') + '</div><div class="mrow" style="justify-content:flex-start;margin:6px 0"><button id="mSched">Signal schedule</button></div>';
    h += m.imp.map((t) => '<p class="impTag">' + esc(t) + '</p>').join('');
    h += '<table class="ce"><tr>' + m.cols.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr>' + m.rows.map((r) => '<tr data-k="' + esc(r.key) + '" class="' + (r.applies ? '' : 'off') + (r.live ? ' live' : '') + '">' +
      r.cells.map((c, i) => '<td>' + esc(c) + (i === 0 && r.live ? '<b class="now">' + esc(m.liveLabel) + '</b>' : '') + '</td>').join('') + '</tr>').join('') + '</table>';
    h += '<p id="ceLegend" style="font:11.5px var(--mono);color:var(--dim)">' + m.legend.map(esc).join(' &middot; ') + '</p><ul>' + m.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul><p id="ceFoot" style="color:var(--dim)">' + esc(m.excluded) + '</p>';
    if (refresh && ui.ceH === h) return;
    const keep = refresh ? $('mbox').scrollTop : 0;
    ui.modal(h + '<div class="mrow"><button id="mGo" class="go">Close</button></div>'); $('mbox').classList.add('wide'); ui.ce = id; ui.ceH = h; $('mGo').onclick = ui.close; $('mbox').scrollTop = keep;
    $('mSched').onclick = () => ui.showSchedule(() => ui.showCE(id));
  };
  // Signal schedule: read-only. Every word of it comes from DI.signalSchedule and the DI.SCHED_* texts (cause.js),
  // which read the same registry the alarm code does. `back` reopens the dialog it was opened from.
  ui.showSchedule = function (back) {
    const W = g().W, rows = DI.signalSchedule(W);
    let h = '<h4>SIGNAL SCHEDULE &middot; READ-ONLY</h4><h2>Where each signal goes</h2><table class="ce" id="sched"><tr>' + DI.SCHED_COLS.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr>' +
      rows.map((r) => '<tr data-k="' + esc(r.key) + '">' + [r.label, r.class, r.ss, r.fd, r.tag].map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>';
    h += '<p id="schedFoot">' + esc(DI.SCHED_FOOT) + '</p><p style="color:var(--dim)">' + esc(DI.SCHED_NOTE) + '</p><p id="schedLatch" style="color:var(--dim)">' + esc(DI.schedLatch(W)) + '</p>';
    ui.modal(h + '<div class="mrow"><button id="mGo" class="go">' + (back ? 'Back' : 'Close') + '</button></div>'); $('mbox').classList.add('wide'); $('mGo').onclick = back || ui.close;
  };
  // Standby reference: read-only. Every word comes from DI.standbyTable and DI.standbyNotes (cause.js).
  ui.showStandby = function (back) {
    const W = g().W, rows = DI.standbyTable(W);
    let h = '<h4>STANDBY REFERENCE &middot; READ-ONLY</h4><h2>Standby battery by panel type</h2><table class="ce" id="stby"><tr>' + DI.STBY_COLS.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr>' +
      rows.map((r) => '<tr data-k="' + esc(r.key) + '" class="' + (r.sel ? '' : 'off') + '">' + [r.label, r.standby, r.alarm, r.tag, r.use].map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>';
    h += '<ul id="stbyNotes">' + DI.standbyNotes(W).map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>';
    ui.modal(h + '<div class="mrow"><button id="mGo" class="go">' + (back ? 'Back' : 'Close') + '</button></div>'); $('mbox').classList.add('wide'); $('mGo').onclick = back || ui.close;
  };
  // r.gov = index of the governing-limit line of a trip test: it is highlighted
  // a main drain test with a drop over 10 percent reads INVESTIGATE (amber): a trigger to investigate, not a fail
  ui.resHtml = (r) => '<div class="res ' + (r.pass ? 'pass' : r.invest ? 'warn' : 'fail') + '"><b>' + DI.resBadge(r) + ' · ' + esc(r.title) + '</b>' + r.lines.map((l, i) => (i === r.gov ? '<span class="gov">' + esc(l) + '</span>' : esc(l))).join('<br>') + '</div>';
  ui.showTests = function () {
    const S = g().S; let h = '<h4>COMMISSIONING RECORD</h4><h2>Test log</h2>';
    if (!S.results.length) h += '<p>No tests on record. Select a riser or a pump and run its tests from the panel on the right.</p>';
    for (let i = S.results.length - 1; i >= 0 && i > S.results.length - 25; i--) { const r = S.results[i]; h += '<div style="color:var(--dim);font:11px var(--mono);margin:10px 0 -4px">' + DI.clock(r.t) + ' · ' + esc(r.name) + '</div>' + ui.resHtml(r); }
    ui.modal(h + '<div class="mrow"><button id="mGo" class="go">Close</button></div>'); $('mGo').onclick = ui.close;
  };
  ui.askDrill = function () {
    const G = g(), d = G.sc.drill, ready = DI.goalsDone();
    ui.modal('<h4>ACCEPTANCE DRILL</h4><h2>' + esc(d.name) + '</h2><p>' + (ready ? 'Every goal is met. The drill throws real incidents at what you built, in real time. You are the operator: watch the annunciator, and restore anything that gets impaired.' : '<b style="color:var(--amb)">Goals are not complete.</b> You can still run the drill to see how the plant behaves. It will not count, and the map is restored afterwards.') +
      '</p><p>Speed controls work during the drill. The map is saved first and restored when the drill ends.</p><div class="mrow"><button id="mNo">Not yet</button><button id="mGo" class="hot">Run the drill</button></div>');
    $('mNo').onclick = ui.close; $('mGo').onclick = () => { ui.close(); G.pre = { world: JSON.stringify(G.W.toJSON()), sim: JSON.stringify(G.S.dump()), ex: G.W.rooms.map((r) => r.exempt) }; DI.setSpeed(1); DI.startDrill(G.S, d, DI.goalState(G.S, G.sc)); };
  };
  ui.showReport = function (res, stars, spent, full) {
    const G = g(), st = res.stats || {}; let h = '<h4>' + (G.sc.drill ? 'DRILL REPORT · ' + esc(G.sc.drill.name).toUpperCase() : 'CONTRACT COMPLETE') + '</h4><h2>' + (res.pass ? (full ? 'Contract complete' : 'Survived, but goals are incomplete') : 'The plant failed') + '</h2>';
    const g0 = G.S.drill && G.S.drill.goals0; if (G.sc.drill && g0) h += '<p style="font-size:13px">Commissioning record, taken when the drill started: ' + g0.filter(Boolean).length + ' of ' + g0.length + ' goals met' + (g0.every(Boolean) ? '. What was proved before the drill stays proved.' : '. The drill counts only with every goal met before it.') + '</p>';
    if (res.pass && full) h += '<div class="stars">' + '★'.repeat(stars) + '<s>' + '★'.repeat(3 - stars) + '</s></div><p>Spent ' + DI.money(spent) + ' of ' + DI.money(G.sc.money) + ' (par ' + DI.money(G.sc.par) + ').</p>';
    h += res.lines.map((l) => '<div class="goal' + (l[0] === '✓' ? ' ok' : '') + '"><i>' + esc(l[0]) + '</i><div>' + esc(l.slice(2)) + '</div></div>').join('');
    if (G.sc.drill) h += '<h4>LOSSES</h4><div class="goal"><i></i><div>Fire ' + DI.money(st.fireLoss || 0) + ' · Water ' + DI.money(st.waterLoss || 0) + ' · Smoke ' + DI.money(st.smokeLoss || 0) + '</div></div>' + DI.galLines(st).map((t) => '<div class="goal gal"><i></i><div>' + esc(t) + '</div></div>').join('');     // two gallon lines, never a total
    const i = DI.SCEN.indexOf(G.sc), nx = DI.SCEN[i + 1];
    h += '<div class="mrow"><button id="mBack">Back to the plant</button>' + (res.pass && full && nx ? '<button id="mNext" class="go">Next: ' + esc(nx.name) + '</button>' : '') + '</div>';
    ui.modal(h, false);
    $('mBack').onclick = () => { ui.close(); if (G.pre) { const pre = G.pre; G.pre = null; const W = DI.World.fromJSON(JSON.parse(pre.world)); W.rooms.forEach((r, k) => { r.exempt = pre.ex[k]; }); const S = new DI.Sim(W); S.restore(JSON.parse(pre.sim)); G.W = W; G.S = S; S.calc = new Map(); S.rv = DI.review(S); DI.simFlags(S, G.sc); G.sel = null; G.calcShow = null; $('log').innerHTML = ''; DI.inspect.render(true); } };
    if ($('mNext')) $('mNext').onclick = () => { G.pre = null; DI.startScenario(nx.id); };
  };
  ui.showManual = function (topic, back) {
    const M = DI.MANUAL, cur = M.find((m) => m.id === topic) || M[0];
    ui.modal('<h4>FIELD MANUAL</h4><div class="man"><nav>' + M.map((m) => '<button data-m="' + m.id + '"' + (m === cur ? ' class="on"' : '') + '>' + esc(m.t) + '</button>').join('') + '</nav><div><h2>' + esc(cur.t) + '</h2>' + cur.h + '</div></div><div class="mrow"><button id="mGo" class="go">Close</button></div>');
    $('mbox').querySelectorAll('nav button').forEach((b) => { b.onclick = () => ui.showManual(b.dataset.m, back); }); $('mGo').onclick = back || ui.close;
  };
})();
