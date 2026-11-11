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
    $('bDrill').onclick = ui.askDrill; $('bSnd').onclick = () => { const on = DI.audio.toggle(); $('bSnd').classList.toggle('on', on); };
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
  ui.modal = function (html, dismiss) { ui.ce = 0; $('mbox').classList.remove('wide'); $('mbox').innerHTML = html; $('modal').classList.add('show'); ui.modalOpen = true; ui.dismiss = dismiss !== false; $('mbox').scrollTop = 0; };
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
    // SENT hh:mm (late) or NOT SENT (hold off). The queue itself is listed under the signals (#stq).
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
    const qh = shown.length ? '<div class="hd3">SUPERVISING STATION QUEUE</div>' + shown.map((r) => '<div class="stq ' + r.state + '" data-p="' + r.panel + '"><b>' + esc(r.label) + '</b>' + esc(' · ' + r.cls + ' · ' + r.text + ' · event ' + DI.hhmm(r.t0)) + '</div>').join('') : '';
    if ($('stq').dataset.h !== qh) { $('stq').innerHTML = qh; $('stq').dataset.h = qh; }
    // ASSUMED presentation: the banner reads OPEN ITEM only when nothing but OPEN is present
    const st = $('annState'), sil = (al || sv || tr || op) && !loud;       // SILENCED only when every active signal's own panel is silenced
    st.textContent = (al ? 'ALARM' : sv ? 'SUPERVISORY' : tr ? 'TROUBLE' : op ? 'OPEN ITEM' : deadP || lost ? 'PANEL DEAD - DISPLAY DARK' : 'NORMAL') + (sil ? ' · SILENCED' : ''); st.className = (al ? 'al' : sv ? 'sv' : tr || lost || deadP ? 'tr' : op ? 'op' : '') + (sil ? ' sil' : '');
    DI.inspect.render(false);
    if (ui.modalOpen && ui.ce) ui.showCE(ui.ce, true);          // the matrix marks what is active now
  };

  // ---------- modals
  ui.showMenu = function () {
    const G = g(); G.mode = 'menu'; let unlocked = true, h = '<h1>DOUBLE <span>INTERLOCK</span></h1><div class="sub">A FIRE PROTECTION SIM FOR HYPERSCALE DATA CENTERS</div>' +
      '<p>Design, build, commission and operate the systems that keep a data center from burning down or drowning. The hydraulics are solved live, the air leaks, the pumps follow their curves, and the valves trip when physics says so.</p><div class="cards">';
    DI.SCEN.forEach((sc, i) => {
      const d = G.prog.done[sc.id], open = unlocked || sc.sandbox, sv = DI.LS.get('di.save.' + sc.id, null);
      h += '<button class="card' + (open ? '' : ' lock') + '" data-sc="' + sc.id + '"' + (open ? '' : ' disabled') + '><em>' + (sc.sandbox ? 'FREE PLAY' : 'CONTRACT ' + (i + 1)) + '</em>' + (d ? '<i>' + '★'.repeat(d.stars) + '</i>' : '') + '<b>' + esc(sc.name) + '</b><small>' + esc(sc.tag) + (sv ? ' · in progress' : '') + '</small></button>';
      if (!sc.sandbox && !d) unlocked = false;
    });
    h += '</div><div class="mrow"><span style="color:var(--dim);font-size:12px;margin-right:auto">Progress saves in this browser. Numbers follow NFPA 13 (the enforced edition is a site setting, default 2025), NFPA 20, NFPA 25 and NFPA 72, plus the company rules listed under Site. Verify against the adopted edition before using them on a job.</span><button id="mUnlock">Unlock all</button><button id="mMan">Field manual</button></div>';
    ui.modal(h, false);
    $('mbox').querySelectorAll('.card').forEach((b) => { b.onclick = () => DI.startScenario(b.dataset.sc); });
    $('mMan').onclick = () => ui.showManual(null, ui.showMenu);
    $('mUnlock').onclick = () => { for (const sc of DI.SCEN) if (!sc.sandbox && !G.prog.done[sc.id]) G.prog.done[sc.id] = { stars: 0, spent: 0 }; DI.LS.set('di.progress', G.prog); ui.showMenu(); };
  };
  ui.showBrief = function (sc) {
    ui.modal('<h4>CONTRACT BRIEFING</h4><h2>' + esc(sc.name) + '</h2><div class="sub">' + esc(sc.tag).toUpperCase() + ' · BUDGET ' + DI.money(sc.money) + '</div>' + sc.brief.map((p) => '<p>' + esc(p) + '</p>').join('') +
      (sc.learn.length ? '<h4>WHAT THIS CONTRACT TEACHES</h4><ul>' + sc.learn.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') +
      (sc.goals.length ? '<h4>GOALS</h4>' + sc.goals.map((q) => '<div class="goal"><i>○</i><div>' + esc(q.t) + '</div></div>').join('') : '') +
      '<div class="mrow"><button id="mGo" class="go">Start</button></div>');
    $('mGo').onclick = ui.close;
  };
  ui.showGoals = function () {
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
    // standby basis of the releasing panel (only a selectable row), the generator-backed option, the refrigerated-space flag
    else if (key === 'standby') { const r = DI.STANDBY.find((q) => q.key === val); if (!r || !r.sel) return false; if (val === DI.STANDBY_DEFAULT) delete c.standby; else c.standby = val; }
    else if (key === 'gen') { if (val === '1') c.panelGen = true; else delete c.panelGen; }
    else if (key === 'cold') { if (val === '1') c.refrigerated = true; else delete c.refrigerated; }
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
    h += '<p id="asdDoc">Listed range per stage, ' + esc(M.label) + ' (' + esc(M.models) + '): ' + esc(M.doc) + ' ' + esc(DI.ASD_SRC) + '. Changing the model never changes a threshold.</p>';
    // one input per stage with its listed range printed under it. A value outside its range, or out of order, is
    // drawn red and left exactly as typed: plan review fails it, nothing is clamped.
    h += rowL(DI.ASD_STAGES.map(([, n], i) => { const bad = badStage.has(i) || !(thr[i] > 0) || (i > 0 && !(thr[i] > thr[i - 1])) || (i < 3 && !(thr[i] < thr[i + 1]));
      return '<label style="display:inline-flex;flex-direction:column;gap:3px">' + lab(n) + '<input data-t="' + i + '"' + (bad ? ' data-bad="1"' : '') + ' type="number" step="any" min="' + RG[i][0] + '" max="' + RG[i][1] + '" value="' + thr[i] + '"' + (ro ? ' disabled' : '') + ' style="width:86px;background:#0c1218;color:' + (bad ? 'var(--red)' : '#e6eef3') + ';border:1px solid ' + (bad ? 'var(--red)' : '#2f4254') + ';border-radius:4px;padding:5px 6px;font:13px Consolas,monospace"><small data-r="' + i + '" style="font:11px var(--mono);color:var(--dim)">' + af(RG[i][0]) + ' to ' + af(RG[i][1]) + '</small></label>'; }).join(''));
    h += '<p>The four thresholds are owner-set values inside the listed range:' + A + ', ' + PE + '. The datasheets print setting ranges, not defaults; 0.03 / 0.06 / 0.12 / 1.2 are example values. Alert and Action are pre-alarm. Fire 1 is the detection leg of a release: D is true at or above it. Fire 2 is escalation and never releases by itself. Plan review fails thresholds that are not strictly increasing and any stage outside its listed range. A value typed outside the range is kept as typed and shown red.</p>';
    h += rowL('<label>' + lab('Spot detector alarm threshold ') + inp('spot', DI.spotThr(W), 0.1) + '</label>' + lab('listed window ' + LS.min + ' to ' + LS.max + ' %/ft (example data)') + A);
    h += rowL(lab('NFPA 76 adopted on this site') + opt('n76', '0', 'No', !c.nfpa76Adopted) + opt('n76', '1', 'Yes', !!c.nfpa76Adopted));
    h += rowL(opt('pre', 'nfpa76', 'Check against NFPA 76', false, !J.nfpa76Adopted) + opt('pre', 'reset', 'Back to example values', false));
    if (ui.siteNote) h += '<p id="siteNote" style="border-left:3px solid var(--amb);padding-left:10px">' + esc(ui.siteNote) + '</p>';
    h += flags.map((x) => '<p class="n76" data-c="' + x.code + '" style="border-left:3px solid var(--red);padding-left:10px">' + esc(x.text) + '</p>').join('');
    if (note76) h += '<p id="n76Note" style="border-left:3px solid var(--grn);padding-left:10px">' + esc(note76) + '</p>';
    h += '<p>' + PE + ' Where NFPA 76 is adopted its limits are plain ceilings (NFPA 76-2024 &sect;8.5.3.1.2.5): Alert 0.2 %/ft or less, and the 1.0 %/ft alarm ceiling applied to Fire 1, the first alarm stage (PRACTICE). Action stays pre-alarm and Fire 2 has no NFPA 76 limit. Plan review fails an Alert above 0.2 %/ft or a Fire 1 above 1.0 %/ft. The check button reads the values against the two ceilings and writes nothing.</p>';
    h += '<h4>SIGNAL CLASSES</h4>' + [['alert', 'Aspirating Alert'], ['action', 'Aspirating Action'], ['pLatch', 'Latched P (release input)']].map(([k, n]) => rowL(lab(n) + DI.SIG_CLASS[k].map((v) => opt(k, v, CLS[v], DI.sigClass(W, k) === v)).join(''))).join('');
    h += '<p>' + PE + A + ' Alert and Action are supervisory unless the engineer elects alarm. A latched P is a release input whose class has not been elected: it shows as an OPEN item until it is elected alarm or trouble. Supervisory is blocked for it. Fixed: Fire 1, Fire 2, manual station and waterflow are alarm; low and high air and valve tamper are supervisory; panel AC failure, low battery, loss of communication with a dead panel and loss of supply air are trouble. Loss of supply air is equipment trouble, its own signal (PRACTICE); the pressure drop it causes is still reported by the low-air supervisory.</p>';
    h += '<h4>SUPERVISING STATION AND PANEL POWER (NFPA 72)</h4>' + rowL(lab('Supervising-station path (OWNER)') + Object.keys(DI.COMM_PATH).map((k) => opt('path', k, DI.COMM_PATH[k].label, DI.commPath(W) === k)).join(''));
    h += '<p id="pathNote">A dead panel shows and sends nothing. On this path the supervising station annunciates the loss of communication after <b>' + DI.delayText(cp.delay) + '</b> [' + esc(R72[cp.ref]) + ']. A single IP path as the default is PRACTICE. The DACT figure is its 6 h test-signal interval [' + esc(R72.dactTest) + '], used as the delay' + A + '. On the DACT path the failure of one of the two channels is a trouble sent on the other channel within ' + DI.delayText(DI.DACT_CHAN_S) + ' [' + esc(R72.dactChan) + '], and every other signal goes on the surviving channel at once: fail a channel from the panel in the Sandbox. Two-way radio paths are not modelled.</p>';
    // DACT path only: hold and send. The code is silent on holding (NOT FOUND in 2019, 2022 or 2025), so it is a setting.
    if (DI.commPath(W) === 'dact') {
      h += rowL(lab('Hold and send after a communications failure (PRACTICE, NEEDS PE REVIEW)') + opt('dactHold', '1', 'On', DI.dactHold(W)) + opt('dactHold', '0', 'Off', !DI.dactHold(W)));
      h += '<p id="holdNote">' + PE + ' With both DACT channels down nothing from the panel reaches the station, alarms included, and nothing is dispatched from it. The panel tries each signal ' + DI.DACT_TRIES + ' times, ' + DI.DACT_ATTEMPT_S + ' s each, ' + DI.DACT_TOTAL_S + ' s in all (CODE bounds, count ASSUMED; ' + esc(R72.dactTry) + '; ' + esc(R72.dactAnnex) + '), then shows DACT TRANSMISSION FAILED at the premises. ' +
        'The code is silent on holding a signal after that: holding is manufacturer behaviour (PRACTICE), so it is a setting. <b>On</b> (default): when a channel is back the held queue is sent in priority order, alarm, then supervisory, then trouble (' + esc(R72.priority) + '), each with its original event time, ' + DI.DACT_SEND_S + ' s apart' + A + ', then the communications-failure trouble and its restoral. A held alarm dispatches the fire department when it is sent, even if it has cleared since. ' +
        '<b>Off</b>: only signals still inside their attempts are sent; the rest are not sent at all. A silenced trouble sounds again every 24 h or less (' + esc(R72.silenceTrouble) + '). The live state shows in the supervising station queue on the annunciator; the cause-and-effect matrix stays design intent.</p>';
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
    h += '<h4>AIR REFILL</h4>' + rowL(lab('Refrigerated space maintained below 5°F: restore within 60 min instead of 30') + opt('cold', '0', 'No', !DI.refrigerated(W)) + opt('cold', '1', 'Yes', DI.refrigerated(W)));
    h += '<p id="coldNote">The air supply must restore normal pressure within <b>' + DI.refillLimit(W) / 60 + ' min</b> on this site [' + esc(DI.refillRef(W, null)) + ']. Refrigerated spaces below 5°F get 60 min (NFPA 13 §8.2.6.3.3 / §8.2.6.8.5, 2025 §8.2.7.4); low priority for data centers. It moves the refill clock, the compressor sizing minimum and the review text together. One flag for the whole site (SIMPLIFICATION: the game has no freezer room type).</p>';
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
    h += '<p id="schedFoot">' + esc(DI.SCHED_FOOT) + '</p><p style="color:var(--dim)">' + esc(DI.SCHED_NOTE) + '</p>';
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
  ui.resHtml = (r) => '<div class="res ' + (r.pass ? 'pass' : 'fail') + '"><b>' + (r.pass ? 'PASS' : 'FAIL') + ' · ' + esc(r.title) + '</b>' + r.lines.map((l, i) => (i === r.gov ? '<span class="gov">' + esc(l) + '</span>' : esc(l))).join('<br>') + '</div>';
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
    $('mNo').onclick = ui.close; $('mGo').onclick = () => { ui.close(); G.pre = { world: JSON.stringify(G.W.toJSON()), sim: JSON.stringify(G.S.dump()), ex: G.W.rooms.map((r) => r.exempt) }; DI.setSpeed(1); DI.startDrill(G.S, d); };
  };
  ui.showReport = function (res, stars, spent, full) {
    const G = g(), st = res.stats || {}; let h = '<h4>' + (G.sc.drill ? 'DRILL REPORT · ' + esc(G.sc.drill.name).toUpperCase() : 'CONTRACT COMPLETE') + '</h4><h2>' + (res.pass ? (full ? 'Contract complete' : 'Survived, but goals are incomplete') : 'The plant failed') + '</h2>';
    if (res.pass && full) h += '<div class="stars">' + '★'.repeat(stars) + '<s>' + '★'.repeat(3 - stars) + '</s></div><p>Spent ' + DI.money(spent) + ' of ' + DI.money(G.sc.money) + ' (par ' + DI.money(G.sc.par) + ').</p>';
    h += res.lines.map((l) => '<div class="goal' + (l[0] === '✓' ? ' ok' : '') + '"><i>' + esc(l[0]) + '</i><div>' + esc(l.slice(2)) + '</div></div>').join('');
    if (G.sc.drill) h += '<h4>LOSSES</h4><div class="goal"><i></i><div>Fire ' + DI.money(st.fireLoss || 0) + ' · Water ' + DI.money(st.waterLoss || 0) + ' · Smoke ' + DI.money(st.smokeLoss || 0) + ' · ' + DI.fmt(st.gallons || 0) + ' gal discharged</div></div>';
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
