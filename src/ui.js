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
    $('sigs').addEventListener('click', (e) => { const el = e.target.closest('.sig'); if (!el) return; const p = g().W.parts.get(+el.dataset.p); if (p) ui.focus(p.x, p.y, { kind: 'part', id: p.id }); });
  };
  ui.focus = function (x, y, sel) { const G = g(); G.cam.x = x + 0.5; G.cam.y = y + 0.5; G.mark = { x, y, t: G.now }; if (sel) { G.sel = sel; DI.inspect.render(true); } };
  ui.banner = function (t) { const b = $('banner'); b.textContent = t; b.classList.add('show'); clearTimeout(ui.bt); ui.bt = setTimeout(() => b.classList.remove('show'), 7000); };
  ui.pop = function (x, y, items) { const p = $('pop'); p.innerHTML = ''; for (const [n, fn] of items) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { p.style.display = 'none'; fn(); }; p.appendChild(b); } p.style.left = Math.max(4, Math.min(innerWidth - 190, x)) + 'px'; p.style.top = y + 'px'; p.style.display = 'block'; };
  ui.modal = function (html, dismiss) { $('mbox').innerHTML = html; $('modal').classList.add('show'); ui.modalOpen = true; ui.dismiss = dismiss !== false; $('mbox').scrollTop = 0; };
  ui.close = function () { $('modal').classList.remove('show'); ui.modalOpen = false; };
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
    // Annunciator: alarm, then OPEN (release input, class not elected), then supervisory, then trouble. A detector
    // stage that a higher stage has superseded stays listed as the record of the crossing and is not counted.
    let h = '', al = 0, sv = 0, tr = 0, op = 0, loud = 0; const ORD = DI.SIG_ORDER;
    const list = [...S.sig.values()].sort((a, b) => (a.type === b.type ? b.t0 - a.t0 : ORD[a.type] - ORD[b.type]));
    for (const o of list) { if (!o.sup) { if (o.type === 'ALARM') al++; else if (o.type === 'OPEN') op++; else if (o.type === 'SUPV') sv++; else tr++; if (!DI.sigSilenced(W, o)) loud++; }
      h += '<div class="sig ' + o.type + (o.mon ? '' : ' loc') + (o.sup ? ' sup' : '') + '" data-p="' + o.part + '"><b>' + o.type + '</b><span>' + esc(o.text) + (o.mon ? '' : ' <em>(local only)</em>') + '</span></div>'; }
    if ($('sigs').dataset.h !== h) { $('sigs').innerHTML = h || '<div class="sig"><span style="color:var(--dim)">All systems normal.</span></div>'; $('sigs').dataset.h = h; }
    // ASSUMED presentation: the banner reads OPEN ITEM only when nothing but OPEN is present
    const st = $('annState'), sil = (al || sv || tr || op) && !loud;       // SILENCED only when every active signal's own panel is silenced
    st.textContent = (al ? 'ALARM' : sv ? 'SUPERVISORY' : tr ? 'TROUBLE' : op ? 'OPEN ITEM' : 'NORMAL') + (sil ? ' · SILENCED' : ''); st.className = (al ? 'al' : sv ? 'sv' : tr ? 'tr' : op ? 'op' : '') + (sil ? ' sil' : '');
    DI.inspect.render(false);
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
    else if (key === 'byp') c.manualReleaseBypassP = val === '1';
    else if (key === 'ins') c.insurer = val === 'FM' ? 'FM' : 'none';
    else if (key === 'pre') { if (val === 'reset') { delete c.detThr; delete c.spotThr; } else { const m = DI.applyDetPreset(W, val); if (m) { ui.banner(m); return false; } } }
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
    const LA = DI.LISTED.vesda, LS = DI.LISTED.smoke, D = DI.DELIVERY;
    let h = '<h4>SITE SETTINGS</h4><h2>Project and company rules</h2>';
    if (ro) h += '<p id="siteRO" style="border-left:3px solid var(--amb);padding-left:10px"><b>Basis of design is fixed in a contract: set by the AHJ, the owner and the insurer.</b> These settings are read-only here. They can be changed in the Sandbox.</p>';
    h += '<p>ASSUMED marks a value the company has not fixed: it is a tunable default. NEEDS PE REVIEW marks a choice an engineer of record has to make.</p>';
    h += '<h4>ENFORCED EDITION OF NFPA 13 (US)</h4>' + rowL(DI.editionChoices().map((k) => opt('ed', k, 'NFPA 13-' + DI.JURIS[k].nfpa13, ed === k)).join(''));
    h += '<p id="siteDelta">' + (J.delta.length ? '<b>Edition delta vs 2025:</b> ' + J.delta.map(esc).join(' ') + ' ' : '') + 'Citations in plan review and on test reports follow the edition. Pass and fail do not differ by edition in this version.</p>';
    h += '<h4>HAZEN-WILLIAMS C</h4><p>C = ' + DI.HW_C + ' for all sprinkler pipe: wet, dry, preaction, interior, yard and underground. Company rule. Nitrogen earns no credit.<br><span style="color:var(--dim)">Comparison only: the NFPA table value is 120 for wet steel. It has no effect on any calculation here.</span></p>';
    h += '<h4>PIPE SCHEDULE: SIZE CUT</h4>' + rowL(lab('Largest size on threaded Schedule 40') + DI.PIPE_CUTS.map((i) => opt('cut', i, DI.PIPES[i].n.replace('"', ' in.'), cut === i)).join(''));
    h += '<p>' + esc(DI.PIPES[cut].n.replace('"', ' in.')) + ' and smaller is threaded Schedule 40; every larger size is roll-grooved Schedule 10, main or branch alike.' + A + ' (default 2 in.). It sets the inside diameter and volume of every pipe. Cost per size is the same for both schedules (ASSUMED).</p>';
    h += '<h4>WATER DELIVERY</h4>' + rowL('<label>' + lab('Fittings allowance, % of pipe volume ') + inp('fit', DI.cfgNum(W, 'fitPct'), 1, 60) + '</label><label>' + lab('Trim volume per valve, gal ') + inp('trim', DI.cfgNum(W, 'trimGal'), 1, 60) + '</label>');
    h += '<p>Zone volume = pipe + fittings + trim.' + A + ' (5 % and 2 gal). NFPA 13 judges the size exemptions on it: a dry system needs the ' + D.timed + ' s timed trip test above ' + D.dry + ' gal (' + D.dryQod + ' gal with a quick-opening device), a double-interlock system above ' + D.di + ' gal, and a quick-opening device does not extend that one.</p>';
    h += rowL(lab('Insurer') + opt('ins', 'none', 'None', DI.insurer(W) === 'none') + opt('ins', 'FM', 'FM', DI.insurer(W) === 'FM'));
    h += '<p>' + PE + ' With FM, dry and double-interlock systems must deliver water in ' + D.fm + ' s at any volume (' + D.fmRef + '). The most stringent limit governs, so a zone can pass NFPA 13 and fail FM. FM density, hose and duration are not part of this setting.</p>';
    h += '<h4>ASPIRATING DETECTION THRESHOLDS (EXAMPLE VALUES, %/FT)</h4>' + rowL(['Alert', 'Action', 'Fire 1', 'Fire 2'].map((n, i) => '<label>' + lab(n + ' ') + '<input data-t="' + i + '" type="number" step="0.01" min="0.001" value="' + thr[i] + '"' + (ro ? ' disabled' : '') + ' style="width:74px;background:#0c1218;color:#e6eef3;border:1px solid #2f4254;border-radius:4px;padding:5px 6px;font:13px Consolas,monospace"></label>').join(''));
    h += '<p>Alert and Action are pre-alarm. Fire 1 is the detection leg of a release: D is true at or above it. Fire 2 is escalation and never releases by itself. Plan review fails thresholds that are not strictly increasing, and a Fire 1 or Fire 2 outside the listed window of the detector: ' + LA.min + ' to ' + LA.max + ' %/ft' + A + ' (placeholder until the maker’s listing is given).</p>';
    h += rowL('<label>' + lab('Spot detector alarm threshold ') + inp('spot', DI.spotThr(W), 0.1) + '</label>' + lab('listed window ' + LS.min + ' to ' + LS.max + ' %/ft (example data)') + A);
    h += rowL(lab('NFPA 76 adopted on this site') + opt('n76', '0', 'No', !c.nfpa76Adopted) + opt('n76', '1', 'Yes', !!c.nfpa76Adopted) + opt('pre', 'nfpa76', 'Apply NFPA 76 preset', false, !J.nfpa76Adopted) + opt('pre', 'reset', 'Back to example values', false));
    h += '<p>Where NFPA 76 is adopted, plan review fails an Alert above 0.2 %/ft or a Fire 1 above 1.0 %/ft (NFPA 76-2024 &sect;8.5.3.1.2.5). The preset sets both. Action 0.6 is an ASSUMED example, used when the current Action value does not fit between them.</p>';
    h += '<h4>SIGNAL CLASSES</h4>' + [['alert', 'Aspirating Alert'], ['action', 'Aspirating Action'], ['pLatch', 'Latched P (release input)']].map(([k, n]) => rowL(lab(n) + DI.SIG_CLASS[k].map((v) => opt(k, v, CLS[v], DI.sigClass(W, k) === v)).join(''))).join('');
    h += '<p>' + PE + A + ' Alert and Action are supervisory unless the engineer elects alarm. A latched P is a release input whose class has not been elected: it shows as an OPEN item until it is elected alarm or trouble. Supervisory is blocked for it. Fixed: Fire 1, Fire 2, manual station and waterflow are alarm; low and high air are supervisory; panel and battery are trouble.</p>';
    h += '<h4>MANUAL RELEASE ZONE</h4>' + rowL(lab('Manual Release zone bypasses P') + opt('byp', '0', 'OFF', !c.manualReleaseBypassP) + opt('byp', '1', 'ON', !!c.manualReleaseBypassP));
    h += '<p>' + PE + ' (owner/insurer exception, footnote 9(c)). OFF: the manual station is typed DETECTION, sits inside D, and water still needs P. ON: the station is typed MANUAL RELEASE and alone releases water on an electric / electric trim. On an electric / pneumatic trim the pneumatic leg sits at the valve, so P is still needed. In a contract an ON bypass is an impairment: a supervisory on the panel and a tag on the valve.</p>';
    ui.modal(h + '<div class="mrow"><button id="mGo" class="go">Close</button></div>'); $('mGo').onclick = ui.close;
    if (ro) return;
    const set = (k, v) => { ui.siteSet(k, v); ui.showSite(); };
    $('mbox').querySelectorAll('button[data-s]').forEach((b) => { b.onclick = () => set(b.dataset.s, b.dataset.v); });
    $('mbox').querySelectorAll('input[data-t]').forEach((el) => { el.onchange = () => set('thr', [+el.dataset.t, parseFloat(el.value)]); });
    $('mbox').querySelectorAll('input[data-n]').forEach((el) => { el.onchange = () => set(el.dataset.n, parseFloat(el.value)); });
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
