// node test/ui.c5.js [out.png] - Cycle 5 browser checks (Playwright): the hook triggers and the NFPA 72 edition row in
// the Site dialog, the signal schedule dialog, the DACT channel fault on the panel, the air supply code check in plan
// review with the two fill rows, the recovery wording with the practice reopen note, the return-to-normal step, and
// save / load of utility power with a pending AC-fail delay. Same style as ui.c4.js: inspector, dialog and menu
// controls are operated with real mouse events; the game is paused and sim time is advanced by hand (S.step, S.warp)
// or with the game's own Skip menu, never by waiting.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  const url = 'file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html');
  await p.goto(url); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  await p.addScriptTag({ path: path.resolve(__dirname, 'bot.js') });                        // the reference builds (item 4)
  const ev = (fn, arg) => p.evaluate(fn, arg), tick = () => p.waitForTimeout(450);        // one inspector / annunciator refresh
  const start = async (id) => { await ev((i) => { DI.startScenario(i, true); DI.ui.close(); DI.setSpeed(0); }, id); await tick(); };
  const step = (sec, dt) => ev(([s, d]) => { const S = DI.game.S; for (let t = 0; t < s; t += d) S.step(d); }, [sec, dt || 0.25]);
  const sel = async (id) => { await ev((i) => { DI.game.sel = { kind: 'part', id: i }; DI.inspect.render(true); }, id); await tick(); };
  const btn = (text) => p.locator('#side button', { hasText: text });
  // the sandbox toolbar is tall and can cover the foot of the inspector: bring the button to the middle first
  const press = async (text) => { const e = btn(text).first(); await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e.click(); await tick(); };
  const row = (label) => ev((l) => { const r = [...document.querySelectorAll('#side .row')].find((e) => e.firstChild.textContent.startsWith(l)); return r ? r.lastChild.textContent : null; }, label);
  const labels = () => ev(() => [...document.querySelectorAll('#side .row')].map((e) => e.firstChild.textContent));
  const banner = () => ev(() => document.getElementById('banner').textContent);
  const sigs = () => ev(() => [...document.querySelectorAll('#sigs .sig')].map((e) => e.className + ' | ' + e.innerText.replace(/\s+/g, ' ')));
  const logText = () => ev(() => [...document.querySelectorAll('#log div')].map((e) => e.innerText).join('\n'));
  const on = async (id, text) => { await sel(id); await press(text); };            // select a part and press one of its buttons
  const site = async () => { await p.click('#bSite'); await tick(); }, closeModal = async () => { await ev(() => DI.ui.close()); await tick(); };
  const opts = (k) => ev((key) => [...document.querySelectorAll('#mbox button[data-s="' + key + '"]')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')).join('|'), k);
  // a rig in the sandbox: campus loop tap, control valve, system valve (preaction by default), half of Data Hall A,
  // compressor, panel, aspirating detector and a manual release station in the hall
  const rig = async (props) => { await start('s0'); const ids = await ev((pr) => {
    const G = DI.game, W = G.W, m = DI.mk(W);
    m.p('city', 28, 27, 0, { stat: 90, resid: 70, flow: 1500, fixed: true }); m.h(29, 31, 27, 6); const g = m.p('gate', 32, 27); m.h(33, 33, 27, 6);
    const v = m.p('prev', 34, 27, 0, pr || undefined); m.h(35, 36, 27, 6); m.v(36, 25, 26, 6);
    const d = m.p('vesda', 42, 11), st = m.p('mstn', 41, 11), pn = m.p('panel', 30, 29), c = m.p('comp', 34, 29, 0, { scfm: 10 }); m.air([[34, 28]]);
    m.v(36, 11, 24, 5, true); m.grid(30, 11, 35, 24, 2, 1); m.grid(37, 11, 42, 24, 2, 1); m.wire(pn, g, v, d, st);
    G.S.sync(); G.S.commission(); G.S.live = true; G.S.rv = DI.review(G.S);
    return { v: v.id, g: g.id, pn: pn.id, d: d.id, st: st.id, c: c.id, head: W.k(39, 16), room: W.roomAt[W.k(39, 16)] };
  }, props); await tick(); return ids; };
  // the matrix dialog as the player sees it: each row's cells by row key
  const matrix = () => ev(() => { const t = document.querySelector('#mbox table.ce:not(#sched)'); if (!t) return null; const rows = {};
    for (const tr of t.querySelectorAll('tr[data-k]')) rows[tr.dataset.k] = [...tr.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim());
    return { cols: [...t.querySelectorAll('th')].map((e) => e.textContent), rows, head: document.getElementById('ceHead').innerText.replace(/\s+/g, ' '), notes: [...document.querySelectorAll('#mbox li')].map((e) => e.innerText).join('\n') }; });
  const sched = () => ev(() => { const t = document.getElementById('sched'); if (!t) return null; const rows = {};
    for (const tr of t.querySelectorAll('tr[data-k]')) rows[tr.dataset.k] = [...tr.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim());
    return { cols: [...t.querySelectorAll('th')].map((e) => e.textContent), rows, keys: Object.keys(rows), foot: document.getElementById('schedFoot').innerText, title: document.querySelector('#mbox h2').textContent,
      controls: [...document.querySelectorAll('#mbox button, #mbox input, #mbox select')].map((e) => e.textContent).join('|'), engine: JSON.stringify(DI.signalSchedule(DI.game.W).map((q) => [q.key, q.label, q.class, q.ss, q.fd, q.tag])) }; });

  // ---- 1. Site dialog: hook triggers and the NFPA 72 edition row
  let r = await rig(); await site();
  const hv0 = await opts('hvac'), ep0 = await opts('epo'), e72 = await opts('ed72'), ed13 = await opts('ed'), note0 = await ev(() => [document.getElementById('hookNote').innerText, document.getElementById('ed72Note').innerText, document.getElementById('siteDelta').innerText]);
  ok('site: the HVAC row offers None / Fire 1 / Fire 2 / Waterflow, None by default; EPO is OFF by default', hv0 === 'None*|Fire 1|Fire 2|Waterflow' && ep0 === 'OFF*|ON', hv0 + ' ; ' + ep0);
  ok('site: the hook note states the rule: never Alert or Action, EPO on waterflow only, hook only; duct detectors are outside the matrix', note0[0].includes('HVAC: never on Alert or Action; with Fire 1 elected, manual and waterflow also trip it. EPO: waterflow only, because waterflow proves water is in the system') && note0[0].includes('Hook only: the game switches nothing.') && (await ev(() => document.getElementById('mbox').innerText.includes('Duct-detector shutdown (IMC) is a separate device, outside this matrix.'))), note0[0].slice(0, 120));
  ok('site: the NFPA 72 edition row exists beside the NFPA 13 row: Auto by default, then 2019, 2022 and 2025', e72 === 'Auto (follows NFPA 13)*|NFPA 72-2019|NFPA 72-2022|NFPA 72-2025' && ed13 === 'NFPA 13-2019|NFPA 13-2022|NFPA 13-2025*' && note0[1].startsWith('In force here: NFPA 72-2025.'), e72);
  await p.click('#mbox button[data-s="epo"][data-v="1"]'); await tick(); await p.click('#mbox button[data-s="hvac"][data-v="waterflow"]'); await tick(); await closeModal();
  await sel(r.v); await press('Cause and effect matrix'); let m = await matrix();
  const hookRows = (i, word) => Object.keys(m.rows).filter((k) => m.rows[k][i].startsWith(word)).join();
  ok('matrix: with EPO elected it is on the waterflow row only, never on a release or valve-open row; the Waterflow HVAC trigger is on the same row only', hookRows(8, 'HOOK') === 'waterflow' && m.rows['fire1+p'][8] === 'OFF' && m.rows['fire1+p'][6] === 'yes: ENERGIZED, valve opens' && hookRows(7, 'HOOK') === 'waterflow' && m.rows.waterflow[7] === 'HOOK: output contact (HVAC shutdown / damper)' && /HVAC hook: on Waterflow · EPO hook: ON \(waterflow only\)/.test(m.head), hookRows(7, 'HOOK') + ' | ' + hookRows(8, 'HOOK'));
  const ac25 = m.rows.acFail[4], lc25 = m.rows.lostComm[4]; await closeModal(); await site(); await p.click('#mbox button[data-s="ed72"][data-v="2019"]'); await tick();
  const s19 = await ev(() => ({ on72: document.querySelector('#mbox button[data-s="ed72"].on').textContent, on13: document.querySelector('#mbox button[data-s="ed"].on').textContent, note: document.getElementById('ed72Note').innerText, delta: document.getElementById('siteDelta').innerText, acd: document.getElementById('acdNote').innerText, path: document.getElementById('pathNote').innerText, cfg: DI.game.W.cfg.ed72, ed13: DI.juris.nfpa13 }));
  ok('site: choosing NFPA 72-2019 changes the NFPA 72 citations in the dialog and leaves NFPA 13 at 2025', s19.on72 === 'NFPA 72-2019' && s19.on13 === 'NFPA 13-2025' && s19.note.startsWith('In force here: NFPA 72-2019.') && s19.delta === note0[2] && s19.acd.includes('NFPA 72-2019 §10.6.9.3') && s19.acd.includes('NFPA 72-2019 §10.15.1') && s19.path.includes('NFPA 72-2019 §26.6.3.3(2)') && s19.cfg === '2019' && s19.ed13 === 2025, s19.note);
  await closeModal(); await sel(r.v); await press('Cause and effect matrix'); m = await matrix();
  ok('matrix: its NFPA 72 citations follow the NFPA 72 edition (2019), and say which edition is in force', ac25.includes('NFPA 72-2025 §10.6.9.3') && lc25.includes('NFPA 72-2025 §26.6.3.3.2(2)') && m.rows.acFail[4] === 'TRBL after 60 min (OWNER/AHJ, 60 to 180; NFPA 72-2019 §10.6.9.3) to the station only (no fire department)' && m.rows.lostComm[4].includes('NFPA 72-2019 §26.6.3.3(2)') && m.notes.includes('NFPA 72 edition: 2019'), m.rows.acFail[4]);
  await closeModal(); await p.click('#bReview'); await tick(); const rvHead = await ev(() => document.getElementById('mbox').innerText); await closeModal();
  ok('review: NFPA 13 text is unchanged by the NFPA 72 setting: still reviewed to NFPA 13-2025', rvHead.includes('Reviewed to NFPA 13-2025.') && !rvHead.includes('NFPA 13-2019'));
  await site(); await p.click('#mbox button[data-s="ed72"][data-v="auto"]'); await tick(); const auto = await ev(() => [!('ed72' in DI.game.W.cfg), document.getElementById('ed72Note').innerText].join('|')); await closeModal();
  ok('site: Auto stores nothing and follows NFPA 13 again', auto.startsWith('true|In force here: NFPA 72-2025.'), auto);

  // ---- 2. Signal schedule dialog, from the Site dialog and from the matrix
  await site(); const hasBtn = await p.locator('#mbox #mSched').count(); await p.click('#mSched'); await tick(); let sc = await sched();
  const L13 = 'fire1,fire2,manual,waterflow,tamper,lowAir,highAir,supplyAir,lowBatt,acFail,alert,action,pLatch';
  ok('schedule: the Site dialog opens it, read-only, with the fire-department column and the FA Lead rows first', hasBtn === 1 && !!sc && sc.title === 'Where each signal goes' && sc.cols.join('|') === 'Signal|Class|To the supervising station|Fire department|Tag' && sc.keys.slice(0, 13).join() === L13 && sc.keys.length === 27 && sc.controls === 'Back', sc && sc.keys.join());
  ok('schedule: alarm signals go to the fire department; supervisory, trouble, pre-alarm and P do not', ['fire1', 'fire2', 'manual', 'waterflow'].every((k) => sc.rows[k][1] === 'ALARM' && sc.rows[k][2] === 'Yes' && sc.rows[k][3] === 'Yes') && ['tamper', 'lowAir', 'highAir', 'supplyAir', 'lowBatt', 'acFail'].every((k) => sc.rows[k][3] === 'No; station only') && sc.rows.lowAir[1] === 'SUPV' && sc.rows.acFail[1] === 'TRBL' && sc.rows.acFail[4] === 'Class [CODE 10.6.9.1.1]; station only [PRACTICE]' &&
    sc.rows.alert[2] === 'OWNER; supervisory is the usual default' && sc.rows.alert[3] === 'No' && sc.rows.action[3] === 'No' && sc.rows.pLatch.slice(1, 4).join('|') === 'OPEN|Not elected|No' && sc.foot === 'Alarm signals go to the fire department; supervisory and trouble signals go to the supervising station only (PRACTICE). Pre-alarm handling is an owner election.');
  ok('schedule: every cell is the engine’s own row (generated, not written in the dialog)', JSON.stringify(sc.keys.map((k) => [k].concat(sc.rows[k]))) === sc.engine);
  await p.click('#mGo'); await tick(); const backSite = await ev(() => document.querySelector('#mbox h2').textContent);
  await p.click('#mbox button[data-s="alert"][data-v="ALARM"]'); await tick(); await p.click('#mSched'); await tick(); sc = await sched();
  ok('schedule: Back returns to the Site dialog; electing Alert to alarm changes its class cell and not its fire-department cell', backSite === 'Project and company rules' && sc.rows.alert[1] === 'ALARM' && sc.rows.alert[3] === 'No' && sc.rows.action[1] === 'SUPV');
  await p.click('#mGo'); await tick(); await p.click('#mbox button[data-s="alert"][data-v="SUPV"]'); await tick(); await closeModal();
  await sel(r.v); await press('Cause and effect matrix'); await p.click('#mSched'); await tick(); sc = await sched(); await p.click('#mGo'); await tick(); m = await matrix();
  ok('schedule: the matrix dialog opens it too, and Back returns to the matrix with its nine columns', !!sc && sc.keys.length === 27 && sc.rows.alert[1] === 'SUPV' && !!m && m.cols.length === 9 && Object.keys(m.rows).length === 19);
  await closeModal(); ok('schedule: closable', (await ev(() => DI.ui.modalOpen)) === false);

  // ---- 3. DACT path: the channel fault on the panel (sandbox only)
  r = await rig(); await sel(r.pn); const ipBtns = (await btn('Fail DACT channel').count()) + (await btn('Restore DACT channels').count()), ipRow = await row('DACT channels');
  await site(); await p.click('#mbox button[data-s="path"][data-v="dact"]'); await tick(); const pathNote = await ev(() => document.getElementById('pathNote').innerText); await closeModal(); await sel(r.pn);
  ok('DACT: on the IP path the panel has no channel buttons; on the DACT path it shows both, and the Site note cites the 4-minute rule', ipBtns === 0 && ipRow === null && (await btn('Fail DACT channel 1').count()) === 1 && (await btn('Fail DACT channel 2').count()) === 1 && (await btn('Restore DACT channels').count()) === 1 && (await row('DACT channels')) === '1 up, 2 up' && pathNote.includes('within 4 min [NFPA 72-2025 §26.6.4.2.4.2(3)]'), pathNote.slice(-200));
  await ev(() => { document.getElementById('log').innerHTML = ''; }); await press('Fail DACT channel 1'); await step(1, 1); await tick(); let a = await sigs();
  ok('DACT: failing one channel raises a TRBL row on the annunciator at once, marked as not yet at the station', a.some((x) => /^sig TRBL \| TRBL DACT CHANNEL FAILED - panel #\d+ \(trouble sent on the other channel within 4 min\) \(not yet sent to the supervising station: 4 min delay\)$/.test(x)) && (await row('DACT channels')) === '1 DOWN, 2 up' && (await ev(() => document.getElementById('annState').textContent)) === 'TROUBLE', a.join(' / '));
  await p.click('#bSkip'); await p.locator('#pop button', { hasText: '10 minutes' }).click(); await p.waitForFunction(() => !(DI.game.warp > 0), null, { timeout: 60000 }); await tick(); a = await sigs(); const lg = await logText();
  ok('DACT: after a 10-minute skip the log says the supervising station was notified, and the row no longer says "not yet sent"', /Supervising station notified: DACT CHANNEL FAILED - panel #\d+/.test(lg) && a.some((x) => x.includes('DACT CHANNEL FAILED')) && !a.some((x) => x.includes('not yet sent')) && (await ev(() => !DI.game.S.fd.log)));
  await sel(r.pn); await press('Fail DACT channel 2'); await step(1, 1); await tick(); a = await sigs();
  ok('DACT: with both channels down the panel cannot send, and the row says so', a.some((x) => /DACT CHANNELS FAILED - panel #\d+ \(both channels down: the panel cannot send\) \(cannot be sent to the supervising station\)$/.test(x)) && (await row('DACT channels')) === '1 DOWN, 2 DOWN', a.join(' / '));
  await press('Restore DACT channels'); await step(1, 1); await tick(); a = await sigs();
  ok('DACT: restoring the channels clears the trouble', !a.some((x) => x.includes('DACT')) && (await row('DACT channels')) === '1 up, 2 up');
  await site(); await p.click('#mbox button[data-s="path"][data-v="ip"]'); await tick(); await closeModal(); await sel(r.pn);
  ok('DACT: back on the IP path the buttons are gone', (await btn('Fail DACT channel').count()) === 0 && (await row('DACT channels')) === null);

  // ---- 4. Plan review: the air supply code check, and the two fill rows
  await start('c5'); const c5 = await ev(() => { const G = DI.game, sol = DI.botBuild(G.S, 'c5'); G.S.warp(sol.settle + 900) /* the largest zone is still filling at the end of the settle: let it finish */; G.S.rv = DI.review(G.S); const big = [...G.S.sysd.info.keys()].map((id) => DI.airSizing(G.S, id)).find(Boolean).gov;
    return { comp: G.W.byType('comp')[0].id, pn: G.W.byType('panel')[0].id, big, fails: G.S.rv.filter((f) => f.sev === 'fail').length, air: G.S.rv.filter((f) => f.text.includes('air supply')).length }; }); await tick();
  await p.click('#bReview'); await tick(); const rv0 = await ev(() => ({ fail: document.querySelectorAll('#mbox .find.fail').length, txt: document.getElementById('mbox').innerText })); await closeModal();
  await ev(() => { DI.game.W.cfg.commPath = 'dact'; DI.game.W.ver++; }); await sel(c5.pn); const cBtns = await btn('Fail DACT channel').count(), cRow = await row('DACT channels'); await ev(() => { delete DI.game.W.cfg.commPath; DI.game.W.ver++; }); await tick();
  ok('DACT: the fault buttons are sandbox only: a contract panel on the DACT path has none', cBtns === 0 && cRow === null);
  ok('review, c5 reference build: no fail and no air supply finding', c5.fails === 0 && c5.air === 0 && rv0.fail === 0 && rv0.txt.includes('No code failures found.'));
  await sel(c5.big); const lb = await labels(), f1 = await row('First fill (commissioning)'), f2 = await row('Last refill'), sz = await row('Air supply sizing'), sideTxt = await ev(() => document.getElementById('side').innerText);
  ok('valve: two fill rows, first fill and last refill, both informational, with the parallel-split note where a shared fill ran over, and no FAIL text', lb.includes('First fill (commissioning)') && lb.includes('Last refill') && !lb.includes('Refill clock') && /min/.test(f1) && f1 === f2 && !/FAIL/.test(f1 + f2) && !/FAIL/.test(sideTxt) &&
    (/of the 30 min limit: OK$/.test(f1) || /min, over the 30 min limit - zones fill together on a shared compressor \(SIMPLIFICATION: parallel split\); the largest zone alone: 19\.1 min$/.test(f1)) && /^10\.0 scfm; largest zone alone 19\.1 of 30 min \(minimum 6\.4 scfm, x1\.25 margin 8\.0\)$/.test(sz), f1 + ' | ' + sz);
  await sel(c5.comp); const cutLbl = (await labels()).includes('Cut-out pressure (psi, ASSUMED; 0 = none)');
  const e5 = p.locator('#side button', { hasText: /^5$/ }).first(); await e5.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e5.click(); await tick();
  await p.click('#bReview'); await tick(); const rv5 = await ev(() => [...document.querySelectorAll('#mbox .find.fail')].map((e) => ({ t: e.innerText, c: getComputedStyle(e).borderLeftColor }))); await closeModal();
  ok('review: with a 5 scfm compressor the review lists the sizing FAIL, in red, with the code reference and the Annex note', cutLbl && (await ev((id) => DI.game.W.parts.get(id).p.scfm, c5.comp)) === 5 && rv5.length === 1 && rv5[0].c === 'rgb(255, 75, 58)' && /air supply 5\.0 scfm \(compressor #\d+\) cannot restore normal pressure in the largest zone they serve \(this one, 525 gal\) within 30 min even filling it alone \(needs 6\.4 scfm; fills in 38\.2 min\)\./.test(rv5[0].t) && rv5[0].t.includes('NFPA 13-2025 §8.2.7.3; NFPA 13-2025 A.8.2.7.3'), rv5[0] && rv5[0].t);
  await sel(c5.big); const sz5 = await row('Air supply sizing'), cls5 = await ev(() => { const e = [...document.querySelectorAll('#side .row')].find((x) => x.firstChild.textContent === 'Air supply sizing'); return e.lastChild.className; });
  ok('valve: the sizing row turns red and shows the largest zone alone over 30 min; the fill rows still carry no FAIL', /^5\.0 scfm; largest zone alone 38\.2 of 30 min/.test(sz5) && cls5 === 'bad' && !/FAIL/.test((await row('First fill (commissioning)')) + (await row('Last refill'))), sz5);

  // ---- 5. Practice recovery wording, the tip, and the practice reopen note
  r = await rig(); await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(60);
  await ev((room) => { const S = DI.game.S; for (let t = 0; t < 10; t += 0.25) { S.smoke[room] = 0.2; S.step(0.25); } S.smoke[room] = 0; }, r.room); await step(20);
  await on(r.g, 'Close valve'); await step(10); await sel(r.v); const cl = await labels(), tips = await ev(() => [...document.querySelectorAll('#side p')].map((e) => e.innerText));
  ok('checklist: steps 12 and 13 carry the new wording', cl.includes('12. Panel reset #2: clear the pressure-loss (P) latch and troubles; panel reads normal.') && cl.includes('13. Slowly open the control valve fully; confirm no flow, panel normal, supervision restored.') && cl.filter((x) => /^\d+\. /.test(x)).length === 13, cl.filter((x) => /^1[23]\. /.test(x)).join(' / '));
  ok('checklist: the main-drain tip is shown as coaching text', tips.includes('Tip: after a control valve has been closed and reopened, a main drain test confirms the valve is really open and the supply is normal (NFPA 25; VERIFY section per edition).'));
  await ev(() => { document.getElementById('log').innerHTML = ''; }); await on(r.g, 'Open valve'); const gw = await banner(); await step(30); await tick(); const lg5 = await logText();
  const FLOOD = 'Water entered the zone through the open head because the valve was still tripped / P latched. In a data hall this is water on the IT load.';
  ok('practice: reopening a tripped zone with a head open warns, opens, and the log then explains the water, once', /^Control valve #\d+ reopened with items still open: head not replaced in /.test(gw) && lg5.split(FLOOD).length === 2 && (await ev((id) => DI.game.W.parts.get(id).p.open > 0.99, r.g)) && (await ev(() => DI.game.S.acts.filter((q) => q.kind === 'reopen-flood').length)) === 1, gw.slice(0, 90));
  await step(30); await tick(); ok('practice: the line is not repeated while the water keeps flowing', (await logText()).split(FLOOD).length === 2);

  // ---- 6. Return to the normal set point after the 24 h air test (normal 30 psi)
  r = await rig({ airSet: 30, loAir: 25, hiAir: 35 }); await on(r.v, '24 h air test'); await ev(() => DI.game.S.warp(86500 + DI.AIR_TEST.chargeMax)); await tick(); await sel(r.v);
  const rt = await row('After the air test'), nb = await btn('Bleed to normal at the trim').count();
  ok('air test: at a 30 psi normal the valve asks for the return to normal set point, at the trim and not the main drain', rt === 'return to normal set point: bleed to 30 psi at the trim (test bleed), not the main drain; never open the control valve to bleed air; then confirm above low air (25 psi), above the P set point (20 psi), supply in auto, supervisory clear.' && nb === 1, rt);
  await ev(() => { document.getElementById('log').innerHTML = ''; }); await press('Bleed to normal at the trim'); await step(1); await tick();
  ok('air test: the bleed at the trim completes it, and the log confirms the set point', (await row('After the air test')) === null && (await btn('Bleed to normal at the trim').count()) === 0 && /Returned to normal set point: 30\.0 psi, above low air and the P set point, supervisory clear\./.test(await logText()) && (await ev((id) => DI.game.W.parts.get(id).p.open, r.g)) === 1);
  r = await rig({ airSet: 50, loAir: 40, hiAir: 60 }); await on(r.v, '24 h air test'); await ev(() => DI.game.S.warp(86500 + DI.AIR_TEST.chargeMax)); await tick(); await sel(r.v);
  const res50 = await ev(() => [...document.querySelectorAll('#side .res')].map((e) => e.innerText).join('\n'));
  ok('air test: a 50 psi normal is tested at 50 and passes at 48.5 or more, with no step afterwards', /PASS · 24-hour air leakage test/.test(res50) && res50.includes('Test pressure: 50 psi') && res50.includes('Pass: end reading at least 48.5 psi') && res50.includes('company practice, NEEDS PE REVIEW') && (await row('After the air test')) === null, res50.replace(/\n/g, ' | ').slice(0, 200));

  // ---- 7. Save and load: utility power off and a pending AC-fail delay
  r = await rig(); await p.click('#bInc'); await p.locator('#pop button', { hasText: 'Utility power: toggle' }).click(); await step(1, 1); await ev(() => DI.game.S.warp(1800)); await tick();
  const before = await ev((id) => { const S = DI.game.S, o = S.sig.get('ac' + id); DI.saveGame(); return { t: S.t, t0: o.t0, tx: o.tx, wx: document.getElementById('wx').textContent, saved: !!localStorage.getItem('di.save.s0') }; }, r.pn);
  await p.reload(); await p.waitForTimeout(300); await ev(() => { DI.startScenario('s0'); DI.ui.close(); DI.setSpeed(0); }); await tick();
  const after = await ev((id) => { const S = DI.game.S, o = S.sig.get('ac' + id); return { power: DI.game.W.power, t: S.t, t0: o && o.t0, tx: o && o.tx, wx: document.getElementById('wx').textContent }; }, r.pn); a = await sigs();
  ok('save / load: after a reload the utility still reads OUT and the AC-fail row is still pending on its original clock', before.saved && /UTILITY OUT/.test(before.wx) && after.power === false && /UTILITY OUT/.test(after.wx) && after.t0 === before.t0 && after.tx === false && Math.abs(after.t - before.t) < 30 && a.some((x) => /PANEL AC FAIL - on standby battery .*\(not yet sent to the supervising station: 60 min delay\)$/.test(x)), after.wx + ' / ' + a.join(' / ').slice(0, 160));
  await ev(() => { document.getElementById('log').innerHTML = ''; DI.game.S.step(1); }); await tick(); const relog = await logText();
  await ev(([t0]) => { const S = DI.game.S; S.warp(t0 + 3600 - S.t + 5); }, [before.t0]); await tick(); a = await sigs();
  ok('save / load: the restored trouble is not announced again, and it is transmitted when the original 60 min have run', !/PANEL AC FAIL/.test(relog) && (await ev((id) => DI.game.S.sig.get('ac' + id).tx, r.pn)) === true && !a.some((x) => x.includes('not yet sent')) && /Supervising station notified: PANEL AC FAIL/.test(await logText()));
  await ev(() => { localStorage.clear(); });
  await p.screenshot({ path: process.argv[2] || 'ui-c5.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fail || errs.length ? (fail + ' FAILED, ' + errs.length + ' page errors') : 'all Cycle 5 UI checks passed');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
