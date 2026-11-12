// node test/ui.c6.js [out.png] - Cycle 6 browser checks (Playwright): drain coaching and the "Return to normal"
// result on the valve, the AVC row with its bypass toggle and pick, the Site dialog rows (hold and send on the DACT
// path, standby basis, generator, refrigerated space), the supervising station queue on the annunciator, the matrix
// footnote, the panel's battery rows with the Ah pick and the sandbox faults, the standby reference dialog, the
// Fire 2 HVAC wording, the practice reopen banner with click-to-dismiss, and the Tutor's main drain line as a practice
// tip and as drill step 14. Same style as ui.c5.js: controls are operated with real mouse events; the game is paused
// and sim time is advanced by hand (S.step, S.warp), never by waiting. A screenshot is saved per new panel, next to
// the one named on the command line.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  const url = 'file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html');
  const out = process.argv[2] || 'ui-c6.png', shot = (tag) => p.screenshot({ path: tag ? out.replace(/(\.png)?$/, '-' + tag + '.png') : out });
  await p.goto(url); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  const ev = (fn, arg) => p.evaluate(fn, arg), tick = () => p.waitForTimeout(450);        // one inspector / annunciator refresh
  // These checks read signal rows, so open the monitor that starts collapsed in normal play.
  const start = async (id) => { await ev((i) => { DI.startScenario(i, true); DI.ui.close(); DI.setSpeed(0); }, id); await tick(); if (await p.locator('#bAnnToggle').getAttribute('aria-expanded') === 'false') await p.click('#bAnnToggle'); };
  const step = (sec, dt) => ev(([s, d]) => { const S = DI.game.S; for (let t = 0; t < s - 1e-9; t += d) S.step(d); }, [sec, dt || 0.25]);
  const sel = async (id) => { await ev((i) => { DI.game.sel = { kind: 'part', id: i }; DI.inspect.render(true); }, id); await tick(); };
  const btn = (text) => p.locator('#side button', { hasText: text });
  // the sandbox toolbar is tall and can cover the foot of the inspector: bring the button to the middle first
  const press = async (text) => { const e = btn(text).first(); await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e.click(); await tick(); };
  const row = (label) => ev((l) => { const r = [...document.querySelectorAll('#side .row')].find((e) => e.firstChild.textContent.startsWith(l)); return r ? r.lastChild.textContent : null; }, label);
  const banner = () => ev(() => { const e = document.getElementById('banner'); return { text: e.textContent, show: e.classList.contains('show') }; });
  const sigs = () => ev(() => [...document.querySelectorAll('#sigs .sig')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  const queue = () => ev(() => [...document.querySelectorAll('#stq .stq')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  const logText = () => ev(() => [...document.querySelectorAll('#log div')].map((e) => e.innerText).join('\n'));
  const on = async (id, text) => { await sel(id); await press(text); };            // select a part and press one of its buttons
  const site = async () => { await p.click('#bSite'); await tick(); }, closeModal = async () => { await ev(() => DI.ui.close()); await tick(); };
  const opts = (k) => ev((key) => [...document.querySelectorAll('#mbox button[data-s="' + key + '"]')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')).join('|'), k);
  const pick = async (k, v) => { await p.locator('#mbox button[data-s="' + k + '"][data-v="' + v + '"]').click(); await tick(); };
  const text = (q) => ev((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, q);
  const cfg = () => ev(() => JSON.parse(JSON.stringify(DI.game.W.cfg)));
  // a rig in the sandbox: campus loop tap, control valve, preaction valve, half of Data Hall A, compressor, panel,
  // aspirating detector and a manual release station in the hall
  const rig = async (props) => { await start('s0'); const ids = await ev((pr) => {
    const G = DI.game, W = G.W, m = DI.mk(W);
    m.p('city', 28, 27, 0, { stat: 90, resid: 70, flow: 1500, fixed: true }); m.h(29, 31, 27, 6); const g = m.p('gate', 32, 27); m.h(33, 33, 27, 6);
    const v = m.p('prev', 34, 27, 0, pr || undefined); m.h(35, 36, 27, 6); m.v(36, 25, 26, 6);
    const d = m.p('vesda', 42, 11), st = m.p('mstn', 41, 11), pn = m.p('panel', 30, 29), c = m.p('comp', 34, 29, 0, { scfm: 10 }); m.air([[34, 28]]);
    m.v(36, 11, 24, 5, true); m.grid(30, 11, 35, 24, 2, 1); m.grid(37, 11, 42, 24, 2, 1); m.wire(pn, g, v, d, st);
    G.S.sync(); G.S.commission(); G.S.live = true; G.S.rv = DI.review(G.S);
    return { v: v.id, g: g.id, pn: pn.id, d: d.id, st: st.id, c: c.id, head: W.k(39, 16), room: W.roomAt[W.k(39, 16)] };
  }, props); await tick(); return ids; };
  const st = (id) => ev((i) => { const S = DI.game.S, s = S.ss.get(i), v = DI.game.W.parts.get(i); return { P: s.P, ret: !!s.ret, state: s.state, pLatch: v.p.pLatch, errs: (s.rtErr || []).map((e) => e.why), avc: v.p.avc, avcBy: v.p.avcBy, sdrain: v.p.sdrain }; }, id);
  const smokeFor = (room, lvl, sec) => ev(([r, l, s]) => { const S = DI.game.S; for (let t = 0; t < s; t += 0.25) { S.smoke[r] = l; S.step(0.25); } S.smoke[r] = 0; }, [room, lvl, sec]);

  // ---- 1. Return to normal after the 24 h air test: drain coaching, the overshoot, the clear gate and the result
  let r = await rig({ airSet: 30, loAir: 25, hiAir: 35 }); await on(r.v, '24 h air test'); await ev(() => DI.game.S.warp(86500 + DI.AIR_TEST.chargeMax)); await tick(); await sel(r.v);
  let s = await st(r.v);
  ok('return: after the air test the step is pending with no error, and the tooltip no longer says "never scored"', s.ret && s.P > 38 && (await row('Return-to-normal errors so far')) === 'none' && (await ev(() => { const e = [...document.querySelectorAll('#side .row')].find((x) => x.firstChild.textContent === 'After the air test'); return e && e.title; })).startsWith('Practice only, never a contract goal.'));
  await ev(() => { document.getElementById('log').innerHTML = ''; }); await press('System drain'); await step(0.02, 0.02); await tick();
  const COACH = 'Use the trim air bleed to trim down to normal. Drains dump air too fast or flow supply water.';
  ok('return: opening a drain in the step puts the coaching line in the log, once', (await logText()).split(COACH).length === 2 && (await ev((id) => DI.game.S.acts.filter((a) => a.kind === 'return-coach' && a.id === id).length, r.v)) === 1);
  // left open until P latches (a few seconds on a zone of this size), in fine steps as the gauge falls fast
  await ev((id) => { const S = DI.game.S, v = DI.game.W.parts.get(id); let n = 0; while (!v.p.pLatch && n++ < 2000) S.step(0.02); }, r.v); await step(1, 0.25); await tick(); s = await st(r.v); const sg = await sigs();
  ok('return: left open, the system drain overshoots: low air, then P latched, one error on the valve, and the log says one fire signal from flow', s.pLatch === true && s.errs.join() === 'p-latch' && sg.some((x) => /LOW AIR/.test(x)) && /^1: pressure fell to the P trip point$/.test(await row('Return-to-normal errors so far')) && /One fire signal from flow: P latched on /.test(await logText()), s.errs.join() + ' at ' + s.P.toFixed(1) + ' psi');
  await sel(r.v); await press('System drain'); await ev((id) => { const S = DI.game.S, q = S.ss.get(id); let n = 0; while (q.P < 27.5 && n++ < 100000) S.step(0.25); }, r.v); await tick(); await sel(r.v); s = await st(r.v);
  const held = await row('After the air test');
  ok('return: a refill into the band does not finish it: the valve says reset P at the panel', s.ret && s.P >= 26.8 && s.pLatch && /still to do: reset P at the panel, then press Finish return to normal$/.test(held), held);
  // Cycle 7: after the panel reset the step is ready and waits for Finish
  await on(r.pn, 'Panel reset'); await step(1); await tick(); await sel(r.v); const waits = (await st(r.v)).ret === true && (await row('After the air test')) === 'All conditions met. Press Finish return to normal.'; await press('Finish return to normal'); await tick(); await sel(r.v); s = await st(r.v);
  const res = await ev(() => [...document.querySelectorAll('#side .res')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  ok('return: after the panel reset the step waits for Finish; pressed, the valve shows a "Return to normal" result with its error line in plain language', waits && !s.ret && !s.pLatch && res.some((x) => /^FAIL · Return to normal .* Pressure fell to the trip point, so the panel latched the pressure-loss input\. With detection also active, both release conditions were met and the valve would release\. Restore air above low air before panel reset #2\.$/.test(x)) && !res.some((x) => /p-latch|low-air(?! supervisory)/.test(x)), res.find((x) => /Return to normal/.test(x)));
  await shot('valve');

  // ---- 2. The AVC row, the bypass toggle and the pick; the impairment tag
  r = await rig(); await sel(r.v);
  ok('AVC: the valve has an AVC row reading "regulating", a bypass toggle and the sandbox pick', (await row('AVC')) === 'regulating' && (await btn('AVC bypass closed').count()) === 1 && (await btn('AVC fitted').count()) === 1 && (await btn('none (compressor direct)').count()) === 1 && (await row('Air / N₂ supply')) === 'OPEN');
  await press('AVC bypass closed'); await step(600, 1); await tick(); await sel(r.v); s = await st(r.v);
  const tag = await text('#imp'), sideTag = await ev(() => [...document.querySelectorAll('#side p.imp')].map((e) => e.textContent).join(' | '));
  ok('AVC: with the bypass open the row reads BYPASS OPEN, the impairment tag shows on the annunciator and on the valve, and HIGH AIR comes in', s.avcBy === 1 && (await row('AVC')) === 'BYPASS OPEN' && /IMPAIRMENT: AVC bypass open on Preaction system #\d+ .*Close the bypass\./.test(tag) && /AVC bypass open/.test(sideTag) && s.P > 55 && (await sigs()).some((x) => /HIGH AIR/.test(x)) && (await btn('Bleed to normal at the trim').count()) === 1, 'P ' + s.P.toFixed(1));
  await press('AVC bypass OPEN'); await press('Bleed to normal at the trim'); await step(2, 1); await tick(); s = await st(r.v);
  ok('AVC: closing the bypass and bleeding at the trim brings the zone back to normal, with no tag and no high air', s.avcBy === 0 && Math.abs(s.P - 40) < 0.6 && (await text('#imp')) === '' && !(await sigs()).some((x) => /HIGH AIR/.test(x)));
  await sel(r.v); await press('none (compressor direct)'); await sel(r.v); s = await st(r.v);
  ok('AVC: picking "none (compressor direct)" reads none (direct) and removes the bypass toggle', s.avc === 0 && (await row('AVC')) === 'none (direct)' && (await btn('AVC bypass').count()) === 0);
  await on(r.c, '55'); const rv = await ev(() => DI.review(DI.game.S).filter((f) => /cut-out/.test(f.text)).map((f) => f.sev + ': ' + f.text));
  ok('AVC: with no AVC a 55 psi compressor cut-out above the 50 psi high air is a plan review fail', rv.length === 1 && /^fail: .*compressor cut-out \(55 psi\) is above the high-air supervisory \(50 psi\) with no AVC between them/.test(rv[0]), rv[0]);

  // ---- 3. Site dialog: hold and send (DACT path only), standby basis, generator, refrigerated space, Fire 2 wording
  r = await rig(); await site();
  ok('site: off the DACT path there is no hold-and-send row; the standby, generator and air refill order rows are there with their defaults, and the refrigerated row is gone (Cycle 7)', (await opts('dactHold')) === '' && (await opts('standby')) === '24 h + 5 min*|24 h + 10 min (owner)|90 h + 10 min (FM)' && (await opts('gen')) === 'Battery only*|Generator-backed' && (await opts('cold')) === '' && (await opts('seq')) === 'All zones at once (default)*|Largest zone first' && (await ev(() => document.querySelectorAll('#mStby').length)) === 1);
  await pick('path', 'dact');
  ok('site: on the DACT path the hold-and-send row appears, On by default, and its note says the code is silent and gives the attempts', (await opts('dactHold')) === 'On*|Off' && /The code is silent on holding/.test(await text('#holdNote')) && /10 times, 90 s each, 900 s in all \(CODE bounds, count ASSUMED/.test(await text('#holdNote')) && !('dactHold' in (await cfg())));
  await pick('dactHold', '0'); const offCfg = await cfg(); await pick('dactHold', '1'); const onCfg = await cfg();
  ok('site: Off stores dactHold false; On stores nothing', offCfg.dactHold === false && !('dactHold' in onCfg) && (await opts('dactHold')) === 'On*|Off');
  await pick('standby', 'fm90'); const fmNote = await text('#stbyNote'), fmCfg = await cfg(); await pick('standby', 'nfpa5'); const defCfg = await cfg();
  ok('site: the FM standby basis is its own election: it needs 56.7 Ah here, and the default stores nothing', fmCfg.standby === 'fm90' && /this basis needs 56\.7 Ah/.test(fmNote) && /never automatic with the insurer setting/.test(fmNote) && !('standby' in defCfg) && /this basis needs 15\.2 Ah/.test(await text('#stbyNote')));
  await pick('gen', '1'); const g25 = await text('#stbyNote'); await pick('ed72', '2022'); const g22 = await text('#stbyNote'), genCfg = await cfg(); await pick('ed72', 'auto'); await pick('gen', '0');
  ok('site: the generator option is 2025 only: under NFPA 72-2022 the note says it is ignored', genCfg.panelGen === true && /this basis needs 2\.7 Ah/.test(g25) && /The generator option is ignored: it exists in NFPA 72-2025 only and NFPA 72-2022 is in force\./.test(g22) && !('panelGen' in (await cfg())));
  // Cycle 7: the 60 min limit is per zone (a freezer room), so the Site dialog only carries the note; the air refill order is the setting here
  await pick('seq', '1'); const seqCfg = await cfg(); await pick('seq', '0'); const coldNote = await text('#coldNote');
  ok('site: the per-zone note replaces the refrigerated flag, and the air refill order stores refillSeq only when it is on', seqCfg.refillSeq === true && !('refillSeq' in (await cfg())) && !('refrigerated' in (await cfg())) && /within 30 min \[NFPA 13-2025 §8\.2\.7\.3\]/.test(coldNote) && /The 60 min refill limit applies per zone, only in a freezer room held below 5 F\. A cooled dock at 35 F does not qualify\. Set it on the room\./.test(coldNote));
  await pick('hvac', 'fire2'); const hookNote = await text('#hookNote');
  ok('site: the HVAC Fire 2 option and its note read "every row with Fire 2 = 1"', /Fire 2\*/.test(await opts('hvac')) && /every row with Fire 2 = 1, release or not/.test(hookNote) && !/Fire 2 row only/.test(hookNote));
  await shot('site');
  // ---- 4. Standby reference dialog
  await p.click('#mStby'); await tick();
  const sb = await ev(() => { const t = document.querySelector('#stby'); return t ? { keys: [...t.querySelectorAll('tr[data-k]')].map((x) => x.dataset.k), off: [...t.querySelectorAll('tr.off')].map((x) => x.dataset.k), cells: [...t.querySelectorAll('tr[data-k]')].map((x) => [...x.children].map((td) => td.innerText)), notes: document.querySelectorAll('#stbyNotes li').length, back: document.getElementById('mGo').textContent } : null; });
  ok('standby reference: six rows with their tags, three of them reference only, read-only with a Back button', !!sb && sb.keys.join() === 'nfpa5,owner10,fm90,facu,evacs,ess' && sb.off.join() === 'facu,evacs,ess' && sb.cells[2].join('|').startsWith('Releasing panel, FM-insured|90 h|10 min|[OWNER/insurer, FM DS 5-40 §2.3.4, Sep 2007 edition, may not be current') && sb.cells[5][2] === '2 h' && sb.cells[0][4] === 'IN FORCE on this site' && sb.notes === 6 && sb.back === 'Back' && (await ev(() => document.querySelectorAll('#mbox button').length)) === 1, sb && sb.keys.join());
  await shot('standby'); await p.click('#mGo'); await tick();
  ok('standby reference: Back returns to the Site dialog', (await ev(() => document.querySelectorAll('#mStby').length)) === 1 && (await opts('path')).includes('DACT (dial-up)*'));
  await closeModal();

  // ---- 5. The supervising station queue (sandbox, DACT path, both channels toggled); the matrix footnote
  await ev((id) => DI.ui.showCE(id), r.v); await tick();
  const mx = await ev(() => { const t = document.querySelector('#mbox table.ce'); return { rows: t.querySelectorAll('tr[data-k]').length, cols: t.querySelectorAll('th').length, last: [...document.querySelectorAll('#mbox ul li')].pop().textContent, f2: [...t.querySelector('tr[data-k="fire2"]').children][7].innerText, f1p: [...t.querySelector('tr[data-k="fire1+p"]').children][7].innerText, cells: t.innerText }; });
  ok('matrix: 21 rows, nine columns, the Fire 2 hook cell names its input, a release row without Fire 2 has no hook, and the last footnote is the Cycle 7 DACT note (the FA Lead’s two sentences, then the restore order and the hazard case)', mx.rows === 21 && mx.cols === 9 && mx.f2 === 'HOOK: output contact (HVAC shutdown / damper): Fire 2' && mx.f1p === 'none' && mx.last === 'With both DACT channels failed, signals are not transmitted until a channel restores. Panel shows comm-failure trouble. On restore a signal that is still active is always re-sent, with its original event time: alarm, supervisory, trouble, then a class not elected (OPEN), then restorals. A panel that dies with signals queued sends none of them (hazard case). See Cycle 6 Q2 and Cycle 7 C7-1.', mx.last);
  await closeModal();
  await on(r.pn, 'Fail DACT channel 1'); await on(r.pn, 'Fail DACT channel 2'); await step(1, 1); await on(r.st, 'Operate station'); await step(200, 1); await tick();
  const q3 = await queue(), sg3 = await sigs();
  ok('queue: with both channels down the alarm is annunciated and the station queue shows it RETRYING 3 of 10', q3.length === 2 && q3.every((x) => /^RETRYING 3 of 10 · ALARM · MANUAL PULL, ZONE Preaction system #\d+ .* · event \d\d:\d\d$/.test(x)) && sg3.some((x) => /^ALARM MANUAL PULL, ZONE .*\(RETRYING 3 of 10\)$/.test(x)) && (await ev(() => DI.game.S.fd.called)) < 0, q3.join(' / '));
  await step(720, 1); await tick(); const qh = await queue(), sgh = await sigs(), mxOut = await ev((id) => DI.ceMatrix(DI.game.S, id).rows.map((x) => x.cells.join('|')).join('\n'), r.v);
  ok('queue: after the 10 attempts it reads HELD, COMM FAILURE, the panel shows DACT TRANSMISSION FAILED, and nobody is dispatched', qh.length === 2 && qh.every((x) => x.startsWith('HELD, COMM FAILURE · ALARM · ')) && sgh.some((x) => /^TRBL DACT TRANSMISSION FAILED - panel #\d+ \(10 attempts over 15 min; 2 signal\(s\) held\)/.test(x)) && sgh.some((x) => /\(HELD, COMM FAILURE\)$/.test(x)) && (await ev(() => DI.game.S.fd.called)) < 0, qh.join(' / '));
  await shot('queue');
  await ev(() => { document.getElementById('log').innerHTML = ''; }); await on(r.pn, 'Restore DACT channels'); await step(40, 1); await tick(); const qs = await queue(), lg = await logText();
  ok('queue: when the channels are back the queue reads SENT hh:mm (late), the alarm first, and the fire department is dispatched late', qs.length === 3 && qs.every((x) => /^SENT \d\d:\d\d \(late\) · /.test(x)) && / · ALARM · /.test(qs[0]) && / · TRBL · DACT COMMUNICATIONS FAILURE - panel #\d+, and its restoral · /.test(qs[2]) && /Alarm transmitted \(late, held during the DACT outage\)\. Fire department dispatched\./.test(lg) && (await ev(() => DI.game.S.fd.called)) >= 0 && (await sigs()).some((x) => /\(SENT \d\d:\d\d \(late\)\)$/.test(x)), qs.join(' / '));
  ok('matrix: the design cells did not change in the outage', mxOut === (await ev((id) => DI.ceMatrix(DI.game.S, id).rows.map((x) => x.cells.join('|')).join('\n'), r.v)) && mx.cells.length > 500);

  // ---- 6. The panel inspector: battery rows, the Ah pick, the sandbox charger and battery faults
  r = await rig(); await sel(r.pn);
  const picks = await ev(() => [...document.querySelectorAll('#side .btns button')].map((e) => e.textContent));
  ok('panel: Battery and Standby calc rows, the Ah pick, the sandbox faults and the standby reference button', (await row('Battery')) === '26 Ah, 27.0 V, 24.0 h of 24 h' && (await row('Standby calc')) === 'needs 15.2 Ah (24 h + 5 min, x1.25): margin 71 %' && ['7', '12', '18', '26', '33', '55', '65', '100'].every((x) => picks.includes(x)) && (await btn('Fail charger').count()) === 1 && (await btn('Disconnect battery').count()) === 1 && (await btn('Standby reference').count()) === 1, (await row('Battery')) + ' | ' + (await row('Standby calc')));
  await press('18'); const thin = await row('Standby calc'); await press('12'); const below = await row('Standby calc'), rvB = await ev(() => DI.review(DI.game.S).filter((f) => /^Panel #\d+ battery/.test(f.text)).map((f) => f.sev)); await press('26');
  ok('panel: an 18 Ah pick reads THIN, a 12 Ah pick reads BELOW and fails plan review, and 26 Ah is back to normal', /THIN, margin 18 %$/.test(thin) && /BELOW$/.test(below) && rvB.join() === 'fail' && (await ev(() => DI.review(DI.game.S).filter((f) => /^Panel #\d+ battery/.test(f.text)).length)) === 0, thin + ' | ' + below + ' | ' + rvB.join());
  await press('Fail charger'); await step(1, 1); await tick(); const cf = await sigs(); await sel(r.pn); const pw = await row('Power'); await press('Restore charger'); await press('Disconnect battery'); await step(1, 1); await tick(); const bd = await sigs(); await sel(r.pn);
  ok('panel: Fail charger raises CHARGER FAILURE and Disconnect battery raises BATTERY DISCONNECTED, both troubles', cf.some((x) => /^TRBL CHARGER FAILURE - panel #\d+ \(battery not charging\)$/.test(x)) && pw === 'AC normal, charger failed' && bd.some((x) => /^TRBL BATTERY DISCONNECTED - panel #\d+$/.test(x)) && (await row('Battery')) === 'DISCONNECTED' && (await btn('Reconnect battery').count()) === 1);
  await shot('panel'); await press('Reconnect battery');

  // ---- 7. Practice reopen with a head open: the banner, word for word, and a click dismisses it
  await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(60); await smokeFor(r.room, 0.2, 10); await step(20); await on(r.g, 'Close valve'); await step(10);
  await ev(() => { document.getElementById('log').innerHTML = ''; }); await on(r.g, 'Open valve'); await step(30); await tick(); const bn = await banner(), lf = await logText();
  const BAN = 'PRACTICE: You reopened the control valve with a head still open. Water flowed out of that head. Close the valve and finish the recovery in order.';
  ok('practice reopen: the banner is the Tutor’s, word for word, and the log line carries the flow and the skipped steps', bn.text === BAN && bn.show === true && /Water entered the zone through the open head \(about \d+ gpm\) because the control valve was reopened before the recovery was done\. Skipped: replace the head \(step 7\); reset the valve at the riser \(step 8\); panel reset #2 and P \(step 12\)\./.test(lf), bn.text);
  await shot('banner'); await p.click('#banner'); await p.waitForTimeout(100);
  ok('practice reopen: a click dismisses the banner', (await banner()).show === false);

  // ---- 8. The Tutor's main drain line: a tip in practice, step 14 in a scored drill incident
  // Cycle 8: the line starts with "Company practice." and ends with the find-the-cause sentence; the step 14 label is the Tutor's
  const LINE = 'Company practice. Main drain test: with the control valve fully open, open the main drain fully, record static and residual pressure, then close it slowly. A 10 percent drop in full flow pressure against the last test means find the cause (NFPA 25).', STEP14 = 'Main drain test (company practice). NFPA 25 requires a valve status test after a control valve is reopened (2023 13.3.3.4).';
  await sel(r.v); const tips = await ev(() => [...document.querySelectorAll('#side p')].map((e) => e.textContent));
  ok('practice: the checklist tip carries the Tutor one-liner and names the valve status test; there is no step 14 row', tips.includes('Tip: ' + LINE + ' The code requires a valve status test after a control valve is reopened (NFPA 25-2023 §13.3.3.4).') && (await row('Drill step 14')) === null && /^\d+ of 13/.test(await row('Latest incident')));
  // a drill is marked as running before the head breaks, so this is the scored incident (the object is the minimum the game reads)
  r = await rig(); await ev(() => { const S = DI.game.S; S.drill = { name: 'test', t0: S.t, done: false, steps: [[0, () => {}]], i: 1, len: 1e9, judge: () => ({ pass: true, lines: [] }) }; });
  await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(60); await sel(r.v);
  const p14 = await text('#mdt14'), numbered = await ev(() => [...document.querySelectorAll('#side .row')].filter((e) => /^\d+\. /.test(e.firstChild.textContent)).length);
  ok('drill: the scored incident shows the step 14 line with the Tutor one-liner, pending, under the thirteen numbered steps', p14 === 'Step 14, scored in this drill: ' + STEP14 + ' ' + LINE + ' Run it from TESTS below, after the control valve is back open.' && (await row('Drill step 14: main drain test (company practice)')) === 'pending' && numbered === 13 && (await row('Water stopped')) === 'control valve not closed yet', p14);
  // the recovery by the reference steps, then the main drain test from the TESTS button
  await on(r.pn, 'Silence'); await ev((k) => DI.findHead(DI.game.S, k), r.head); await on(r.g, 'Close valve'); await step(6);
  await sel(r.v); await press('Isolate air'); await press('System drain'); await ev((id) => { const S = DI.game.S, q = S.ss.get(id); let n = 0; while (!q.dz && n++ < 40000) S.step(0.25); }, r.v); await tick();
  await sel(r.v); await press('Replace 1 sprinkler'); await press('System drain'); await press('Restore air'); await step(1800, 1); await on(r.pn, 'Panel reset'); await step(2); await ev(() => { document.getElementById('log').innerHTML = ''; });
  await on(r.g, 'Open valve'); await step(6); await tick(); const b14 = await banner(), l14 = await logText(); await sel(r.v); const pend = await row('Drill step 14: main drain test');
  ok('drill: when the control valve is back open the banner and the log give the main drain instruction, word for word', b14.text === LINE && l14.includes('Step 14. ' + LINE) && pend === 'pending' && /^\d+ s after the alarm$/.test(await row('Water stopped')), b14.text);
  await press('Main drain test'); await step(45); await tick(); await sel(r.v);
  const d14 = await ev((id) => { const S = DI.game.S, q = DI.recoveryScore(S, id, S.drill.t0); return { done: q.done, total: q.total, ok: q.complete && q.inOrder, tier: DI.recoveryTier(q) }; }, r.v), resD = await ev(() => [...document.querySelectorAll('#side .res')].map((e) => e.innerText.replace(/\s+/g, ' ')).find((x) => /Main drain test/.test(x)));
  // (the scripted operator closes the valve about 66 s after the head broke: 2 stars at the Cycle 7 tiers of 60 / 150 s)
  ok('drill: after the main drain test step 14 reads done, the drill recovery is 14 of 14 in order, and the test report labels static and full-flow (residual)', (await row('Drill step 14: main drain test')) === 'done' && d14.done === 14 && d14.total === 14 && d14.ok && d14.tier === 2 && (await row('Latest incident')) === '13 of 13, in order' && /Static: \d+ psi Full-flow \(residual\): \d+ psi at about \d+ gpm/.test(resD), JSON.stringify(d14) + ' ' + resD);
  await ev(() => { localStorage.clear(); });
  await shot();
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fail || errs.length ? (fail + ' FAILED, ' + errs.length + ' page errors') : 'all Cycle 6 UI checks passed');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
