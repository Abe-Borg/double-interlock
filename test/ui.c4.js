// node test/ui.c4.js [out.png] - Cycle 4 browser checks (Playwright): the cause-and-effect matrix, NFPA 76 as ceilings,
// the refill clock with "Skip the refill" and the reopen gate in both modes, the impairment tag, and the
// supervising-station timing. Same style as ui.c3.js: inspector, dialog and menu controls are operated with real mouse
// events; the game is paused and sim time is advanced by hand (S.step, S.warp), never by waiting.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  await p.goto('file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  const ev = (fn, arg) => p.evaluate(fn, arg), tick = () => p.waitForTimeout(450);        // one inspector / annunciator refresh
  const start = async (id) => { await ev((i) => { DI.startScenario(i, true); DI.ui.close(); DI.setSpeed(0); }, id); await tick(); };
  const step = (sec, dt) => ev(([s, d]) => { const S = DI.game.S; for (let t = 0; t < s; t += d) S.step(d); }, [sec, dt || 0.25]);
  const sel = async (id) => { await ev((i) => { DI.game.sel = { kind: 'part', id: i }; DI.inspect.render(true); }, id); await tick(); };
  const btn = (text) => p.locator('#side button', { hasText: text });
  // the sandbox toolbar is tall and can cover the foot of the inspector: bring the button to the middle first
  const press = async (text) => { const e = btn(text).first(); await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e.click(); await tick(); };
  const row = (label) => ev((l) => { const r = [...document.querySelectorAll('#side .row')].find((e) => e.firstChild.textContent.startsWith(l)); return r ? r.lastChild.textContent : null; }, label);
  const banner = () => ev(() => document.getElementById('banner').textContent);
  const sigs = () => ev(() => [...document.querySelectorAll('#sigs .sig')].map((e) => e.className + ' | ' + e.innerText.replace(/\s+/g, ' ')));
  const on = async (id, text) => { await sel(id); await press(text); };            // select a part and press one of its buttons
  const site = async () => { await p.click('#bSite'); await tick(); }, closeModal = async () => { await ev(() => DI.ui.close()); await tick(); };
  // a rig in the sandbox: campus loop tap, control valve, system valve (preaction by default), half of Data Hall A,
  // compressor, panel, aspirating detector and a manual release station in the hall
  const rig = async (type) => { await start('s0'); const ids = await ev((ty) => {
    const G = DI.game, W = G.W, m = DI.mk(W);
    m.p('city', 28, 27, 0, { stat: 90, resid: 70, flow: 1500, fixed: true }); m.h(29, 31, 27, 6); const g = m.p('gate', 32, 27); m.h(33, 33, 27, 6);
    const v = m.p(ty || 'prev', 34, 27, 0); m.h(35, 36, 27, 6); m.v(36, 25, 26, 6);
    const d = m.p('vesda', 42, 11), st = m.p('mstn', 41, 11), pn = m.p('panel', 30, 29), c = m.p('comp', 34, 29, 0, { scfm: 10 }); m.air([[34, 28]]);
    m.v(36, 11, 24, 5, true); m.grid(30, 11, 35, 24, 2, 1); m.grid(37, 11, 42, 24, 2, 1); m.wire(pn, g, v, d, st);
    G.S.sync(); G.S.commission(); G.S.live = true; G.S.rv = DI.review(G.S);
    return { v: v.id, g: g.id, pn: pn.id, d: d.id, st: st.id, c: c.id, head: W.k(39, 16), room: W.roomAt[W.k(39, 16)] };
  }, type); await tick(); return ids; };
  const st = (id) => ev((i) => { const S = DI.game.S, s = S.ss.get(i), q = S.W.parts.get(i).p; return { state: s.state, set: s.set, P: s.P, pLatch: q.pLatch, sdrain: q.sdrain, airValve: q.airValve, rfill: !!s.rfill, t: S.t }; }, id);
  const untilZero = (id) => ev((i) => { const S = DI.game.S, s = S.ss.get(i); for (let n = 0; n < 40000 && !s.dz; n++) S.step(0.25); return !!s.dz; }, id);
  // the matrix dialog as the player sees it: column headers, and each row's cells by row key
  const matrix = () => ev(() => { const t = document.querySelector('#mbox table.ce'); if (!t) return null; const rows = {}, cls = {};
    for (const tr of t.querySelectorAll('tr[data-k]')) { rows[tr.dataset.k] = [...tr.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim()); cls[tr.dataset.k] = tr.className.trim(); }
    return { cols: [...t.querySelectorAll('th')].map((e) => e.textContent), rows, cls, title: document.querySelector('#mbox h2').textContent, head: document.getElementById('ceHead').innerText, foot: document.getElementById('ceFoot').innerText,
      controls: [...document.querySelectorAll('#mbox button, #mbox input, #mbox select')].map((e) => e.textContent).join('|') }; });

  // ---- 1. Cause and effect matrix
  let r = await rig(); await sel(r.v); await press('Cause and effect matrix'); let m = await matrix();
  ok('matrix: the valve inspector opens it, read-only (its one extra control opens the signal schedule), with exactly the nine columns', !!m && m.cols.join() === 'Input,Tag,SignalClass,PanelAnnunciation,SS_Transmit,LocalNAC,Solenoid,HVAC_Hook,EPO_Hook' && m.controls === 'Signal schedule|Close' && /^Preaction system #\d+ - Data Hall A$/.test(m.title) && Object.keys(m.rows).length === 20, m && m.cols.join());      // Cycle 6: 20 rows, with the charger-failure row
  ok('matrix: the header shows the trim, the bypass state, both hooks and the panel', /Trim: Electric \/ electric · Manual Release zone bypass \(9\(c\)\): OFF · HVAC hook: none · EPO hook: OFF · Releasing panel: #\d+/.test(m.head.replace(/\s+/g, ' ')), m.head);
  ok('matrix: P reads OPEN (never supervisory) and loss of supply air reads TRBL', m.rows.p[2] === 'OPEN - class not elected, never supervisory' && m.rows.supplyAir[2] === 'TRBL' && m.rows.lowAir[2] === 'SUPV' && m.rows.fire1[2] === 'ALARM' && m.rows.alert[2] === 'SUPV (pre-alarm, [OWNER])');
  ok('matrix: every hook cell reads none and OFF by default', Object.values(m.rows).every((c) => c[7] === 'none' && c[8] === 'OFF'));
  ok('matrix: the AC-fail and loss-of-communication rows show 60 min with their NFPA 72 sections', m.rows.acFail[4] === 'TRBL after 60 min (OWNER/AHJ, 60 to 180; NFPA 72-2025 §10.6.9.3) to the station only (no fire department)' && m.rows.lostComm[4].startsWith('supervising station annunciates after 60 min (IP path; NFPA 72-2025 §26.6.3.3.2(2)') && m.rows.acFail[3].includes('within 200 s'));
  ok('matrix: the solenoid column follows the trim, and the Manual Release zone row is greyed with the bypass OFF', m.rows.fire1[6] === 'no' && m.rows['fire1+p'][6] === 'yes: ENERGIZED, valve opens' && m.rows['fire1+p, panel dead'][6] === 'no: a dead panel energizes nothing' && m.cls.mrz === 'off' && m.rows.mrz[2] === 'not on this site: bypass OFF');
  ok('matrix: the footer lists what is left out', /elevator recall, door release, the control of the compressor/.test(m.foot));
  const m0 = m; await closeModal(); await site();
  const hk0 = await ev(() => ['hvac', 'epo'].map((k) => document.querySelector('#mbox button[data-s="' + k + '"].on').textContent).join());
  await p.click('#mbox button[data-s="hvac"][data-v="fire1"]'); await tick(); await p.click('#mbox button[data-s="epo"][data-v="1"]'); await tick(); await closeModal();
  await sel(r.v); await press('Cause and effect matrix'); m = await matrix();
  const diff = (i) => Object.keys(m.rows).filter((k) => m.rows[k][i] !== m0.rows[k][i]).join(), same = Object.keys(m.rows).every((k) => m.rows[k].slice(0, 7).join('|') === m0.rows[k].slice(0, 7).join('|'));
  ok('matrix: electing the hooks in the Site dialog changes only the hook cells: Alert stays none, Fire 1 and the release row gain the HVAC hook (trigger Fire 1), and EPO is on the waterflow row only', hk0 === 'None,OFF' && same && m.rows.alert[7] === 'none' && m.rows.alert[8] === 'OFF' && m.rows.fire1[7] === 'HOOK: output contact (HVAC shutdown / damper): Fire 1' && m.rows.fire1[8] === 'OFF' && m.rows['fire1+p'][7] === 'HOOK: output contact (HVAC shutdown / damper): Fire 1' && m.rows['fire1+p'][8] === 'OFF' && m.rows.waterflow[8] === 'HOOK: output contact (power isolation)' &&
    diff(7) === 'fire1,fire2,manual,fire1+p,fire1+p, battery,waterflow' && diff(8) === 'waterflow' && /HVAC hook: on Fire 1 \(also manual and waterflow\) · EPO hook: ON \(waterflow only\)/.test(m.head.replace(/\s+/g, ' ')), diff(7) + ' | ' + diff(8));
  const world0 = await ev(() => JSON.stringify([...DI.game.W.parts.values()].map((x) => x.p))); await closeModal(); await step(30);
  ok('matrix: hook only: with both hooks elected nothing in the plant has changed', (await ev(() => JSON.stringify([...DI.game.W.parts.values()].map((x) => x.p)))) === world0 && (await sigs()).join().includes('All systems normal'));
  await on(r.st, 'Operate station'); await step(2); await sel(r.v); await press('Cause and effect matrix'); m = await matrix();
  ok('matrix: operating the wired manual station marks its row ACTIVE NOW', /\blive\b/.test(m.cls.manual) && m.rows.manual[0].endsWith('ACTIVE NOW') && m.rows.manual[2] === 'ALARM' && m.rows.manual[5] === 'yes' && !/\blive\b/.test(m.cls.fire1) && !m.rows.fire1[0].includes('ACTIVE NOW'));
  // the dialog follows the plant while it is open: reset the station and the panel behind it, and the mark goes
  await ev(([s, pn]) => { const S = DI.game.S; S.W.parts.get(s).p.on = false; DI.panelReset(S, pn); S.step(0.5); }, [r.st, r.pn]); await tick(); m = await matrix();
  ok('matrix: it refreshes while open: with the station and the panel reset the row is no longer marked', !!m && !/\blive\b/.test(m.cls.manual) && !m.rows.manual[0].includes('ACTIVE NOW'));
  await closeModal(); await sel(r.pn); const pb = await btn('Cause and effect matrix: #' + r.v).count(); await press('Cause and effect matrix: #' + r.v); m = await matrix();
  ok('matrix: the panel inspector offers the same dialog for each wired preaction zone', pb === 1 && !!m && /^Preaction system #\d+ - Data Hall A$/.test(m.title) && m.cols.length === 9);
  await closeModal();

  // ---- 2. NFPA 76 as ceilings
  await start('s0'); await site(); await p.click('#mbox button[data-s="n76"][data-v="1"]'); await tick();
  const n76 = () => ev(() => ({ stage: document.querySelectorAll('#mbox button[data-s="n76s"]').length, chips: !!document.getElementById('n76Open') || !!document.getElementById('n76Conf'), note: (document.getElementById('n76Note') || {}).innerText || '', flags: [...document.querySelectorAll('#mbox p.n76')].map((e) => e.innerText).join(' / '),
    res: (document.getElementById('siteNote') || {}).innerText || '', vals: [...document.querySelectorAll('#mbox input[data-t]')].map((e) => e.value).join(), thr: DI.detThr(DI.game.W).join(), txt: document.getElementById('mbox').innerText }));
  let n = await n76();
  ok('NFPA 76: adopted, the Site dialog has no alarm-stage row and no OPEN or CONFLICT chip, and shows the VEP note', n.stage === 0 && !n.chips && !/NFPA 76 alarm stage|CONFLICT/.test(n.txt) && n.note.startsWith('NFPA 76 ceilings: Alert 0.2, Fire 1 1.0 %/ft. The VESDA-E VEP listing (Fire 1 maximum 0.614) is tighter') && n.flags === '', n.note);
  await p.fill('#mbox input[data-t="0"]', '0.3'); await p.press('#mbox input[data-t="0"]', 'Tab'); await tick(); n = await n76(); await closeModal();
  await p.click('#bReview'); await tick(); const rv = await ev(() => [...document.querySelectorAll('#mbox .find.fail')].map((e) => ({ t: e.innerText, c: getComputedStyle(e).borderLeftColor }))); await closeModal();
  ok('NFPA 76: 0.3 typed into Alert is a red fail in plan review, and the dialog says so', rv.some((x) => x.t.includes('NFPA 76 is adopted on this site: Alert must be 0.2 %/ft or less (it is 0.3).') && x.c === 'rgb(255, 75, 58)') && n.flags.includes('Alert must be 0.2 %/ft or less (it is 0.3)') && n.vals === '0.3,0.06,0.12,1.2');
  await site(); await p.click('#mbox button[data-s="pre"][data-v="nfpa76"]'); await tick(); n = await n76();
  ok('NFPA 76: "Check against NFPA 76" shows the result text and every field keeps its value', n.res === 'NFPA 76 check: Alert 0.3 (meets 0.2: no), Fire 1 0.12 (meets 1.0: yes).' && n.vals === '0.3,0.06,0.12,1.2' && n.thr === '0.3,0.06,0.12,1.2', n.res);
  await closeModal();

  // ---- 3. Refill clock, "Skip the refill", and the reopen gate in both modes
  r = await rig(); await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(90); await on(r.g, 'Close valve'); await step(6);
  await on(r.g, 'Open valve'); const gw = await banner(), g1 = await ev((id) => ({ target: DI.game.W.parts.get(id).p.target, warn: DI.game.S.acts.filter((q) => q.kind === 'reopen-warn').map((q) => q.items.join('; ')).join(' / ') }), r.g);
  ok('gate, practice: reopening on an unready zone outside a drill opens the valve and shows the warning with the items', g1.target === 1 && /^Control valve #\d+ reopened with items still open: head not replaced in Preaction system #\d+ - Data Hall A; air in Preaction system #\d+ - Data Hall A is [\d.]+ psi, below low air \(30 psi\); P is still latched on Preaction system #\d+ - Data Hall A\.$/.test(gw) && g1.warn.startsWith('head not replaced in '), gw);
  await on(r.g, 'Close valve'); await step(6); await sel(r.v); const c0 = await row('Last refill');
  await press('Isolate air'); await press('System drain'); const z = await untilZero(r.v); await tick(); await press('Replace 1 sprinkler'); await press('System drain');
  const noSkip = await btn('Skip the refill').count(); await press('Restore air'); await step(30, 1); await tick();
  const c1 = await row('Last refill'), s1 = await st(r.v); await step(60, 1); await tick(); const c2 = await row('Last refill');
  const tipR = await ev(() => { const e = [...document.querySelectorAll('#side .row')].find((x) => x.firstChild.textContent === 'Last refill'); return e ? e.title : ''; });
  ok('refill clock: it starts when the closed-up zone takes air, and counts up against 30 min, with the section in its tooltip', z && c0 === '-' && /^0\.\d of 30 min$/.test(c1) && /^1\.\d of 30 min$/.test(c2) && parseFloat(c2) > parseFloat(c1) && s1.rfill && s1.P < 30 && tipR.includes('within 30 min [NFPA 13-2025 §8.2.7.3]') && tipR.startsWith('Informational: a measured time, not the code check.'), c1 + ' -> ' + c2);
  ok('refill clock: "Skip the refill" is offered only while the zone is filling', noSkip === 0 && (await btn('Skip the refill').count()) === 1);
  const t0 = (await st(r.v)).t; await press('Skip the refill'); await p.waitForFunction(() => !(DI.game.warp > 0), null, { timeout: 60000 }); await tick(); const s2 = await st(r.v), c3 = await row('Last refill');
  ok('refill clock: the skip jumps to the zone at normal pressure, inside 30 min, and the row reads OK', !s2.rfill && s2.set && s2.P >= 36.8 && s2.P <= 40.5 && s2.t - t0 > 60 && s2.t - t0 < 1800 && /^[\d.]+ min of the 30 min limit: OK$/.test(c3) && (await btn('Skip the refill').count()) === 0, c3 + ' after skipping ' + Math.round(s2.t - t0) + ' s');
  ok('air supply sizing: the valve shows the code check (largest zone alone, of 30 min) with the minimum and the x1.25 margin', /^10\.0 scfm; largest zone alone [\d.]+ of 30 min \(minimum [\d.]+ scfm, x1\.25 margin [\d.]+\)$/.test(await row('Air supply sizing') || ''), await row('Air supply sizing'));
  // the same unready zone during a running drill: this incident is the scored one, so the gate refuses
  r = await rig(); await ev(() => { const S = DI.game.S; S.drill = { name: 'test', t0: S.t, done: false, steps: [[0, () => {}]], i: 1, len: 1e9, judge: () => ({ pass: true, lines: [] }) }; });
  await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(90); await on(r.g, 'Close valve'); await step(6); await on(r.g, 'Open valve');
  const gr = await banner(), g2 = await ev((id) => ({ target: DI.game.W.parts.get(id).p.target, warn: DI.game.S.acts.some((q) => q.kind === 'reopen-warn') }), r.g);
  ok('gate, drill: the same reopening during the scored incident of a running drill is refused', g2.target === 0 && !g2.warn && /^Restore air first: [\d.]+ psi is below low air \(30 psi\)\.$/.test(gr), gr);
  await ev(() => { DI.game.S.drill = null; });

  // ---- 4. Impairment tag: a shut air supply is an impairment, low air is a pressure signal
  r = await rig('dryv'); await sel(r.v); const imp = () => ev(() => ({ strip: document.getElementById('imp').innerText.replace(/\s+/g, ' ').trim(), side: [...document.querySelectorAll('#side p.imp')].map((e) => e.innerText).join(), col: (document.querySelector('#imp .hd3') ? getComputedStyle(document.querySelector('#imp .hd3')).color : '') }));
  const i0 = await imp(); await press('Isolate air'); await step(30); await tick(); const i1 = await imp(), a1 = await sigs();
  ok('impairment: shutting the air supply on a healthy dry zone shows the amber IMPAIRMENT TAGS strip and a line on the valve, and no LOW AIR', i0.strip === '' && i0.side === '' && /^IMPAIRMENT TAGS IMPAIRMENT: Air \/ N2 supply isolated to Dry system #\d+ - Data Hall A\. The zone cannot hold or refill air and will drift to low air\. Restore the supply\.$/.test(i1.strip) && i1.side.startsWith('IMPAIRMENT: Air / N2 supply isolated to Dry system #') && i1.col === 'rgb(255, 178, 36)' && !a1.some((x) => x.includes('LOW AIR')) && a1.join().includes('All systems normal'), i1.strip);
  await press('System drain'); const la = await ev((id) => { const S = DI.game.S; let n = 0; while (!S.sig.has('la' + id) && n++ < 400) S.step(0.05); return { has: S.sig.has('la' + id), P: S.ss.get(id).P, state: S.ss.get(id).state }; }, r.v); await tick(); const a2 = await sigs();
  ok('impairment: opening the system drain raises LOW AIR when the gauge has fallen below the setpoint', la.has && la.P < 30 && la.state === 'dry' && a2.some((x) => /^sig SUPV \| SUPV LOW AIR - Dry system #/.test(x)) && (await imp()).strip.startsWith('IMPAIRMENT TAGS'), 'P ' + la.P.toFixed(1));
  await press('System drain'); await press('Restore air'); await step(2); await tick(); const i3 = await imp();
  ok('impairment: restoring the supply clears the strip and the line', i3.strip === '' && i3.side === '' && (await st(r.v)).airValve === 1);

  // ---- 5. Supervising-station timing
  r = await rig(); await site();
  const ss = await ev(() => ({ path: document.querySelector('#mbox button[data-s="path"].on').textContent, acd: document.querySelector('#mbox button[data-s="acd"].on').textContent, n: document.querySelectorAll('#mbox button[data-s="path"]').length + '/' + document.querySelectorAll('#mbox button[data-s="acd"]').length,
    note: document.getElementById('pathNote').innerText, ac: document.getElementById('acdNote').innerText }));
  ok('station: the Site dialog shows the path row with IP selected and the AC-fail delay row at 60 min', ss.path === 'Single path (IP, performance-based)' && ss.acd === '60 min' && ss.n === '3/5' && ss.note.includes('after 60 min [NFPA 72-2025 §26.6.3.3.2(2)') && ss.ac.includes('60 to 180 min (NFPA 72-2025 §10.6.9.3)') && ss.ac.includes('no low-battery threshold held'), ss.note.slice(0, 120));
  await closeModal(); await p.click('#bInc'); await p.locator('#pop button', { hasText: 'Utility power: toggle' }).click(); await step(1); await tick(); let a = await sigs();
  ok('station: failing the utility power shows AC FAIL on the annunciator at once, marked as not yet sent', (await ev(() => DI.game.W.power)) === false && a.some((x) => /^sig TRBL \| TRBL PANEL AC FAIL - on standby battery .*\(not yet sent to the supervising station: 60 min delay\)$/.test(x)) && !(await ev(() => DI.game.S.log.some((l) => l.text.startsWith('Supervising station notified')))), a.join(' / ').slice(0, 220));
  await ev(() => { document.getElementById('log').innerHTML = ''; DI.game.S.warp(3700); }); await tick(); a = await sigs();
  const logT = await ev(() => [...document.querySelectorAll('#log div')].map((e) => e.innerText).join('\n'));
  ok('station: after the 60 min delay the supervising station has the AC trouble, and the log says so', /Supervising station notified: PANEL AC FAIL/.test(logT) && a.some((x) => x.includes('PANEL AC FAIL')) && !a.some((x) => x.includes('not yet sent')) && (await ev((id) => DI.game.S.sig.get('ac' + id).tx, r.pn)) === true);
  await ev((id) => { DI.game.W.parts.get(id).p.battH = 0; }, r.pn); await step(1); await tick(); a = await sigs();
  ok('station: with the battery dead the status bar reads PANEL DEAD at once and the station line is absent', (await ev(() => document.getElementById('annState').textContent)) === 'PANEL DEAD - DISPLAY DARK' && !a.some((x) => x.includes('SUPERVISING STATION')) && a.length === 1 && a[0].includes('Display dark: the panel is dead.'), a.join(' / '));
  await ev(() => DI.game.S.warp(3700)); await tick(); a = await sigs();
  ok('station: 60 min later the station line LOSS OF COMMUNICATION appears', a.length === 1 && /stn \| TRBL SUPERVISING STATION LOSS OF COMMUNICATION - panel #\d+ \(no signal, supervising station reports trouble\)/.test(a[0]) && (await ev(() => document.getElementById('annState').textContent)) === 'PANEL DEAD - DISPLAY DARK', a.join(' / '));
  await sel(r.v); await press('Cause and effect matrix'); m = await matrix();
  ok('station: the matrix marks the loss-of-communication row ACTIVE NOW and names the dead panel in its header', /\blive\b/.test(m.cls.lostComm) && /Releasing panel: #\d+ \(DEAD\)/.test(m.head));
  await p.screenshot({ path: process.argv[2] || 'ui-c4.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fail || errs.length ? (fail + ' FAILED, ' + errs.length + ' page errors') : 'all Cycle 4 UI checks passed');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
