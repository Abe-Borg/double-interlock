// node test/ui.c7.js [out.png] - Cycle 7 browser checks (Playwright): the Finish return to normal button in every mode,
// its refusal and its clean pass in plain language, the compressor picks and the optional AVC bypass tamper switch,
// the Site dialog (no refrigerated row, the per-zone note, the air refill order, the VEA model with its Fire 1 pick),
// the Freezer / Cold Dock room with its "below 5 F" toggle, the charger pick with its FAIL text, RESTORAL and HAZARD
// CASE in the supervising station queue, the drill report (tiers at 60 / 150, two time lines, two gallon lines, the
// shared-compressor note, the error lines), and the main drain hint with "Check the valves upstream".
// Same style as ui.c6.js: controls are operated with real mouse events; the game is paused and sim time is advanced by
// hand (S.step, S.warp), never by waiting. A screenshot is saved per new panel, next to the one named on the command line.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  const url = 'file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html');
  const out = process.argv[2] || 'ui-c7.png', shot = (tag) => p.screenshot({ path: tag ? out.replace(/(\.png)?$/, '-' + tag + '.png') : out });
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
  const sigs = () => ev(() => [...document.querySelectorAll('#sigs .sig')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  const queue = () => ev(() => [...document.querySelectorAll('#stq .stq')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  const logText = () => ev(() => [...document.querySelectorAll('#log div')].map((e) => e.innerText).join('\n'));
  const clearLog = () => ev(() => { document.getElementById('log').innerHTML = ''; });
  const on = async (id, text) => { await sel(id); await press(text); };            // select a part and press one of its buttons
  const site = async () => { await p.click('#bSite'); await tick(); }, closeModal = async () => { await ev(() => DI.ui.close()); await tick(); };
  const opts = (k) => ev((key) => [...document.querySelectorAll('#mbox button[data-s="' + key + '"]')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')).join('|'), k);
  const pick = async (k, v) => { await p.locator('#mbox button[data-s="' + k + '"][data-v="' + v + '"]').click(); await tick(); };
  const text = (q) => ev((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, q);
  const cfg = () => ev(() => JSON.parse(JSON.stringify(DI.game.W.cfg)));
  const results = () => ev(() => [...document.querySelectorAll('#side .res')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  const TAGS = /p-latch|finish-early|main-drain-flow|drain-open|water-flow|low-air(?! supervisory)/;       // internal names: never player text
  // a rig in the sandbox: campus loop tap, control valve, preaction valve, half of Data Hall A, compressor, panel, aspirating
  // detector and a manual release station in the hall. two = a second (dry) valve on the same compressor.
  const rig = async (props, two) => { await start('s0'); const ids = await ev(([pr, tw]) => {
    const G = DI.game, W = G.W, m = DI.mk(W);
    m.p('city', 28, 27, 0, { stat: 90, resid: 70, flow: 1500, fixed: true }); m.h(29, 31, 27, 6); const g = m.p('gate', 32, 27); m.h(33, 33, 27, 6);
    const v = m.p('prev', 34, 27, 0, pr || undefined); m.h(35, 36, 27, 6); m.v(36, 25, 26, 6);
    const d = m.p('vesda', 42, 11), st = m.p('mstn', 41, 11), pn = m.p('panel', 30, 29), c = m.p('comp', 34, 29, 0, { scfm: 10 }); m.air([[34, 28]]);
    m.v(36, 11, 24, 5, true); m.grid(30, 11, 35, 24, 2, 1); m.grid(37, 11, 42, 24, 2, 1); m.wire(pn, g, v, d, st);
    let v2 = null; if (tw) { m.air([[34, 30]]); v2 = m.p('dryv', 34, 31); }
    G.S.sync(); G.S.commission(); G.S.live = true; G.S.rv = DI.review(G.S);
    return { v: v.id, g: g.id, pn: pn.id, d: d.id, st: st.id, c: c.id, v2: v2 ? v2.id : 0, head: W.k(39, 16), room: W.roomAt[W.k(39, 16)] };
  }, [props || null, !!two]); await tick(); return ids; };
  const st = (id) => ev((i) => { const S = DI.game.S, s = S.ss.get(i), v = DI.game.W.parts.get(i); return { P: s.P, ret: !!s.ret, state: s.state, pLatch: v.p.pLatch, errs: (s.rtErr || []).map((e) => e.why), mode: (DI.returnStep(S, i) || {}).mode }; }, id);
  const P30 = { airSet: 30, loAir: 25, hiAir: 45 };
  const airTest = async (r) => { await on(r.v, '24 h air test'); await ev(() => DI.game.S.warp(86500 + DI.AIR_TEST.chargeMax)); await tick(); await sel(r.v); };

  // ---- 1. Finish return to normal: the button in every mode, the refusal in plain language, the hint, the result
  let r = await rig(P30); await airTest(r); let s = await st(r.v); const FIN = 'Finish return to normal';
  const bleedBtn = await btn(FIN).count(), bleedMode = s.mode;
  await clearLog(); await press(FIN); await step(0.5); await tick(); await sel(r.v); s = await st(r.v);
  const early = await logText(), res1 = await results(), rtRes = res1.find((x) => /Return to normal/.test(x));
  ok('finish: the button is there in bleed mode; pressed too early it is refused, the log names what was missing, and the step stays pending with one error', bleedBtn === 1 && bleedMode === 'bleed' && s.ret && s.errs.join() === 'finish-early' && /Finish was pressed before the zone was ready: the pressure is not in the normal band\. Close every drain\. Bring air into the normal band, above low air and above the P set point\. Reset the panel to clear the pressure-loss \(P\) latch\. Clear any supervisory signal \(low air, high air, AVC bypass, valve off normal\)\. Then press Finish\./.test(early), early.split('\n').pop());
  ok('finish: the valve shows a "Return to normal" result with the error line, and neither it nor the error row carries an internal tag', !!rtRes && /^FAIL · Return to normal .* Finish was pressed before the zone was ready: /.test(rtRes) && !TAGS.test(rtRes) && (await row('Return-to-normal errors so far')) === '1: Finish pressed too early (Finish pressed 1 time)' && !TAGS.test(await text('#side')), rtRes);
  await press('Bleed to normal at the trim'); await step(1); await tick(); await sel(r.v);
  const readyRow = await row('After the air test'), goBtn = await btn(FIN).first().getAttribute('class'); await step(300, 1); await tick(); await sel(r.v); s = await st(r.v);
  ok('finish: with every condition met the row reads "All conditions met. Press Finish return to normal." and the step does not end by itself', readyRow === 'All conditions met. Press Finish return to normal.' && goBtn === 'go' && s.ret && s.mode === 'ready' && (await btn(FIN).count()) === 1 && /All conditions met\. Press Finish return to normal\./.test(await logText()));
  // confirm mode (the AVC bypass open) and refill mode (the normal raised above the pipe): the button is there in both
  await press('AVC bypass closed'); await step(0.25); await sel(r.v); const cMode = (await st(r.v)).mode, cBtn = await btn(FIN).count(), cRow = await row('After the air test'); await press('AVC bypass OPEN'); await step(0.25);
  await ev((id) => { const v = DI.game.W.parts.get(id); Object.assign(v.p, { airSet: 40, loAir: 35 }); }, r.v); await step(0.25); await sel(r.v); const rMode = (await st(r.v)).mode, rBtn = await btn(FIN).count(), rRow = await row('After the air test');
  ok('finish: the button is also there in confirm mode and in refill mode, and the refill text ends "then press Finish"', cMode === 'confirm' && cBtn === 1 && /still to do: AVC bypass is open, then press Finish return to normal$/.test(cRow) && rMode === 'refill' && rBtn === 1 && /^refill to 40 psi: leave the air supply open; then press Finish$/.test(rRow), cRow + ' | ' + rRow);
  await shot('finish');
  // a clean pass on a fresh rig: bleed at the trim, then Finish
  r = await rig(P30); await airTest(r); await press('Bleed to normal at the trim'); await step(1); await sel(r.v); await press(FIN); await tick(); await sel(r.v); s = await st(r.v);
  const clean = (await results()).find((x) => /Return to normal/.test(x));
  ok('finish: pressed when ready it ends the step and the result is the clean-pass sentence', !s.ret && clean === 'PASS · Return to normal Clean return to normal. Air held above low air, both panel resets were done in order, drains were closed, the control valve is fully open, and supervision is back to normal.' && (await btn(FIN).count()) === 0 && (await row('After the air test')) === null, clean);

  // ---- 2. The compressor picks and the optional AVC bypass tamper switch
  r = await rig(); await sel(r.c); const compText = await text('#side');
  const drift0 = await row('With an AVC bypass open, a zone drifts to'); await ev((id) => { Object.assign(DI.game.W.parts.get(id).p, { maxPsi: 100, relief: 75 }); DI.game.W.ver++; }, r.c); await sel(r.c);
  ok('compressor: the rated max discharge and relief picks are there (ASSUMED), and the drift row follows them: 60 psi not modeled, 75 psi with max 100 and relief 75', /Rated max discharge \(psi, ASSUMED; 0 = not modeled\)/.test(compText) && /Relief valve setpoint \(psi, ASSUMED; 0 = none\)/.test(compText) && drift0 === '60 psi (ASSUMED: compressor not modeled)' && (await row('With an AVC bypass open, a zone drifts to')) === '75 psi', drift0);
  await sel(r.v); const tRow0 = await row('AVC bypass tamper switch'); await press('AVC bypass tamper switch (optional): none'); await sel(r.v); const tRow1 = await row('AVC bypass tamper switch');
  await press('AVC bypass closed'); await step(2); await tick(); await sel(r.v); const sg = await sigs(), tRow2 = await row('AVC bypass tamper switch'), tip = await ev(() => { const e = [...document.querySelectorAll('#side .row')].find((x) => x.firstChild.textContent === 'AVC'); return e ? e.title : ''; });
  ok('tamper: the optional switch is a toggle on the valve, off by default, labelled PRACTICE; fitted, an open bypass adds a supervisory row on the annunciator', /^not fitted \(optional\) · PRACTICE \(no code requirement verified for the air bypass\)$/.test(tRow0) && /^fitted: normal · PRACTICE \(no code requirement verified for the air bypass\)$/.test(tRow1) && /^fitted: BYPASS OPEN, supervisory · PRACTICE/.test(tRow2) && sg.some((x) => /^SUPV AVC BYPASS OPEN \(tamper\) - Preaction system/.test(x)) &&
    /The bypass is normally closed\. Leaving it open is a classic way to get high air or over-pressure\./.test(tip) && (await ev((id) => DI.game.W.parts.get(id).p.avcTamper, r.v)) === 1, sg.join(' | '));
  await shot('avc');
  await p.click('#bSite'); await tick(); await p.click('#mSched'); await tick(); const schRow = await ev(() => { const e = document.querySelector('#sched tr[data-k="avcTamper"]'); return e ? [...e.children].map((td) => td.innerText) : null; }); await closeModal();
  ok('tamper: the signal schedule lists it as supervisory, station only, with the PRACTICE label', !!schRow && schRow[1] === 'SUPV' && schRow[3] === 'No; station only' && /^PRACTICE \(no code requirement verified for the air bypass\)/.test(schRow[4]), schRow && schRow.join(' | '));

  // ---- 3. Site dialog: no refrigerated row, the per-zone note, the air refill order, the VEA model and its Fire 1 pick
  r = await rig(); await site();
  ok('site: no refrigerated row; the per-zone note and the Air refill order row are there', (await opts('cold')) === '' && /The 60 min refill limit applies per zone, only in a freezer room held below 5 F\. A cooled dock at 35 F does not qualify\. Set it on the room\./.test(await text('#coldNote')) && (await opts('seq')) === 'All zones at once (default)*|Largest zone first' && /The code check does not change/.test(await text('#seqNote')));
  const models = await opts('asd'); await pick('asd', 'VEA'); const vea0 = await opts('vea'), veaNote = await text('#veaNote'), veaOem = await text('#veaOem'), inputs = await ev(() => document.querySelectorAll('#mbox input[data-t]').length), c0 = await cfg();
  ok('site: VEA is offered as a model; chosen, it shows the Fire 1 pick with no site pick stored (Cycle 8: each room reads its default, 1.23 outside an NFPA 76 telecom room), no Alert / Action / Fire 2 inputs, and the Gamewell 1.3 as a note', /VESDA-E VEP\*\|VESDA-E VEU\|VESDA-E VEA/.test(models) && vea0 === '0.5 (High)|1.23 (Enhanced)|2.5 (Standard)' && /No site pick is stored now, so each room reads its default: 0\.5 %\/ft \(High\) in a telecom room where NFPA 76 applies, 1\.23 %\/ft \(Enhanced\) in every other room\./.test(veaNote) && (await ev(() => DI.veaFire1(DI.game.W))) === 1.23 && inputs === 0 && /Alert, Action and Fire 2: not published for this model\./.test(veaNote) && /Gamewell sheet 9021-61037 prints the Enhanced setting as 1\.3 %\/ft/.test(veaOem) && c0.asdModel === 'VEA' && !('detThr' in c0), vea0);
  const flags = () => ev(() => [...document.querySelectorAll('#mbox .n76')].map((e) => e.dataset.c).join());
  // Cycle 8: NFPA 76 applies by room. In a hall the site setting flags nothing, whatever the pick; then the detector's hall is made a Telecom / MMR room (MMR 1).
  await pick('n76', '1'); await pick('vea', '2.5'); const fHall = await flags(); await pick('pre', 'reset'); await pick('asd', 'VEA');
  await ev((id) => { const W = DI.game.W, d = W.parts.get(id), room = W.room(d.x, d.y); room.type = 'tel'; room.name0 = room.name; room.name = 'MMR 1'; W.ver++; DI.game.S.touch(); }, r.d); await closeModal(); await site();
  const vea76 = await opts('vea'), f05 = await flags(), d05 = await ev((id) => { const W = DI.game.W, d = W.parts.get(id); return DI.veaFire1At(W, W.room(d.x, d.y)); }, r.d); await pick('vea', '1.23'); const f123 = await flags(), c1 = await cfg(); await pick('vea', '2.5'); const f25 = await flags(); await pick('vea', '0.5'); const fBack = await flags(), n76Text = await text('#n76Text'), noteV = await text('#n76Note');
  ok('site: the setting on, a hall is never flagged; in the telecom room the default is 0.5; 1.23 and 2.5 raise the ceiling flag and 0.5 does not; the 1.0 %/ft figure reads VERIFIED and the mapping PRACTICE', fHall === '' && vea76 === '0.5 (High)|1.23 (Enhanced)|2.5 (Standard)' && d05 === 0.5 && f05 === '' && f123 === 'N76_ALARM_OVER' && c1.detThr[2] === 1.23 && f25 === 'N76_ALARM_OVER' && fBack === '' && /The 1\.0 %\/ft figure is VERIFIED/.test(n76Text) && /is PRACTICE/.test(n76Text) && /the ceiling binds: 1\.23 and 2\.5 %\/ft are above it, 0\.5 %\/ft meets it/.test(noteV), f123 + ' / ' + f25);
  await shot('site'); await pick('n76', '0'); await pick('asd', 'VEP'); await pick('pre', 'reset'); await closeModal();
  await ev((id) => { const W = DI.game.W, d = W.parts.get(id), room = W.room(d.x, d.y); room.type = 'hall'; room.name = room.name0; delete room.name0; W.ver++; DI.game.S.touch(); }, r.d);
  // the detector inspector follows the model
  await ev(() => { DI.ui.siteSet('asd', 'VEA'); }); await sel(r.d);
  ok('detector: on the VEA model the inspector shows one Fire 1 setting and "not published for this model" for the other stages', (await row('Fire 1')) === '1.23 %/ft (Enhanced) · default' && (await row('Alert / Action / Fire 2')) === 'not published for this model' && (await row('Model')) === 'VESDA-E VEA (Fire 1 only)');
  await ev(() => { DI.ui.siteSet('asd', 'VEP'); });

  // ---- 4. The Refrigerated Space room (the Cycle 7 Freezer / Cold Dock type, renamed in Cycle 8) and its "below 5 F" toggle
  const coldK = await ev(() => { const W = DI.game.W, room = W.rooms.find((q) => q.type === 'cold'); if (!room) return -1; const k = W.k(room.x + 2, room.y + 2); DI.game.sel = { kind: 'tile', k }; DI.inspect.render(true); return k; }); await tick();
  const title = await text('#side h3'), cold0 = await row('Held below 5 F (freezer)'); await press('Held below 5 F: no'); await tick(); const cold1 = await row('Held below 5 F (freezer)'), flag = await ev(() => DI.game.W.rooms.find((q) => q.type === 'cold').below5);
  ok('room: the sandbox has a Refrigerated Space room; "Held below 5 F" is off by default (a cooled space does not qualify) and the toggle sets it on the room', coldK >= 0 && /^Refrigerated Space/i.test(title) && cold0 === 'no: a cooled space (a 35 F dock, for example) does not qualify: 30 min' && /^yes: 60 min air refill limit/.test(cold1) && flag === true && (await btn('Held below 5 F: YES').count()) === 1, title + ' | ' + cold0 + ' | ' + cold1);
  await shot('room');

  // ---- 5. The charger pick on the panel, and the FAIL text when it is undersized
  await sel(r.pn); const chg0 = await row('Charger check'); await press('55'); await sel(r.pn); await press('1 A'); await sel(r.pn); const chg1 = await row('Charger check'), pq = await ev((id) => { const q = DI.game.W.parts.get(id).p; return [q.ah, q.chgA]; }, r.pn);
  const rvChg = await ev(() => DI.review(DI.game.S).filter((f) => /charger/.test(f.text)).map((f) => f.sev + ': ' + f.text));
  ok('charger: "matched to the battery" by default; 1 A on a 55 Ah battery reads FAIL on the panel and is a plan review fail that cites the 48 h', /^matched to the battery \(ASSUMED\): restores 26 Ah in 48 h$/.test(chg0) && pq.join() === '55,1' && /^FAIL: 1 A restores 48 Ah in 48 h, the battery is 55 Ah\. A bigger battery needs a bigger charger; the 48 h does not stretch$/.test(chg1) && rvChg.length === 1 && /^fail: Panel #\d+ charger \(1 A\) cannot restore the 55 Ah battery within 48 h after one discharge \(NFPA 72 §10\.6\.10\.3\.2/.test(rvChg[0]) && /a charger ampere rating is not in NFPA 72 §10\.6\.10/.test(await text('#side')), chg1);
  await shot('charger');

  // ---- 6. The supervising station queue: RESTORAL after an outage, HAZARD CASE when the panel dies with a signal queued
  r = await rig(); await ev(() => { DI.ui.siteSet('path', 'dact'); }); await step(1); await on(r.g, 'Close valve'); await step(8); await tick();
  await sel(r.pn); await press('Fail DACT channel 1'); await press('Fail DACT channel 2'); await step(2); await on(r.g, 'Open valve'); await step(8); await tick(); const qOut = await queue();
  await sel(r.pn); await press('Restore DACT channels'); await step(40, 1); await tick(); const qBack = await queue(), lg = await logText();
  ok('queue: a tamper the station already had, cleared in the outage, is queued as a restoral and reads RESTORAL hh:mm (late) once a channel is back', qOut.some((x) => /^RESTORAL, RETRYING 1 of 10 · SUPV · VALVE TAMPER/.test(x)) && qBack.some((x) => /^RESTORAL \d\d:\d\d \(late\) · SUPV · VALVE TAMPER/.test(x)) && /RESTORAL \d\d:\d\d \(late\): VALVE TAMPER/.test(lg), qBack.join(' | '));
  await sel(r.pn); await press('Fail DACT channel 1'); await press('Fail DACT channel 2'); await step(2); await on(r.st, 'Operate station'); await step(5, 1); await ev((id) => { DI.game.W.power = false; DI.game.W.parts.get(id).p.battH = 0; }, r.pn); await step(2, 1); await tick(); const qDead = await queue();
  ok('queue: an alarm queued when the panel dies reads NOT SENT (panel dead): HAZARD CASE, with the hazard text under it', qDead.some((x) => /^NOT SENT \(panel dead\): HAZARD CASE · ALARM · MANUAL PULL, ZONE .* missed 6 h test.* The passer-by 911 call in this game is not an NFPA 72 path\.$/.test(x)) && (await ev(() => document.querySelectorAll('#stq .stq.haz').length)) >= 1, qDead.find((x) => /HAZARD/.test(x)));
  await shot('queue'); await ev(() => { DI.game.W.power = true; });

  // ---- 7. Main drain: the Tutor hint at a 12 % drop, and "Check the valves upstream"
  r = await rig(P30, true); await sel(r.v); await press('Main drain test'); await step(45); await tick(); await sel(r.v);
  const base = (await results()).find((x) => /Main drain test/.test(x)), resid = await ev((id) => DI.lastResult(DI.game.S, 'drain', id).val, r.v);
  await ev(([id, v]) => { DI.game.W.parts.get(id).p.drainBase = v / 0.88; }, [r.v, resid]);
  // ---- 8. A scored drill incident on this rig: recovery, step 14 with the 12 % drop, then a bad return to normal; the report
  await ev(() => { const S = DI.game.S; S.drill = { name: 'test', t0: S.t, done: false, steps: [[0, () => {}]], i: 1, len: 1e9, judge: DI.lossJudge(1e9, (q) => DI.drillRecovery(q, 'the broken sprinkler')) }; S.stats = { fireLoss: 0, waterLoss: 0, smokeLoss: 0, gallons: 0 }; });
  await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(20); await on(r.pn, 'Silence'); await ev((k) => DI.findHead(DI.game.S, k), r.head); await on(r.g, 'Close valve'); await step(6);
  await sel(r.v); await press('Isolate air'); await press('System drain'); await ev((id) => { const S = DI.game.S, q = S.ss.get(id); let n = 0; while (!q.dz && n++ < 40000) S.step(0.25); }, r.v); await tick();
  await sel(r.v); await press('Replace 1 sprinkler'); await press('System drain'); await press('Restore air'); await step(1800, 1); await on(r.pn, 'Panel reset'); await step(2); await on(r.g, 'Open valve'); await step(6); await tick();
  await sel(r.v); await clearLog(); await press('Main drain test'); await step(45); await tick(); await sel(r.v); const dropRes = (await results()).find((x) => /Main drain test/.test(x));
  ok('main drain: with no earlier test the result records the baseline; 12 % under it the result reads INVESTIGATE (Cycle 8: not an automatic fail), cites the NFPA 25 text and carries the Tutor hint with the drop in percent', /Recorded as the baseline for the next test\. \[NFPA 25-2023 §13\.2\.2\.3 \(2020 §13\.2\.3\.3\)\]$/.test(base) && /^INVESTIGATE · Main drain test .*\(DOWN 12%\) NFPA 25-2023 §13\.2\.2\.3 \(2020 §13\.2\.3\.3\): a 10 percent drop in full flow pressure vs the acceptance test or earlier tests means find the cause and correct it if necessary\. Full flow pressure is 12\.0 percent lower than the last test\. NFPA 25 says find the cause\. A partly closed valve is the usual one\. Check the zone control valve and the supply valves upstream \(riser control valve, PIV, backflow preventer valves\)\.$/.test(dropRes) && !/FAIL/.test(dropRes), dropRes);
  const rep = () => ev(() => { const S = DI.game.S; return S.drill.judge(S).lines; });
  const before = await rep(); await press('Check the valves upstream'); await tick(); const chk = await logText(), after = await rep(), acts = await ev((id) => DI.game.S.acts.filter((a) => a.kind === 'drop-check' && a.id === id).length, r.v);
  ok('main drain: unchecked, the report has the "10% drop not investigated" line; "Check the valves upstream" reports the control valve, logs the check, and the line is gone', before.some((l) => /^• 10% drop not investigated \(.*\)\. Full flow pressure is 12\.0 percent lower/.test(l)) && /Valves upstream of .*: control valve #\d+ 100% open\. All fully open\./.test(chk) && acts === 1 && !after.some((l) => /not investigated/.test(l)) && after.some((l) => / Investigated\. \[NFPA 25-2023 §13\.2\.2\.3 /.test(l)), before.find((l) => /not investigated/.test(l)));
  // the bad return: air test, system drain left open to low air, Finish pressed too early
  await airTest(r); await sel(r.v); await press('System drain'); await ev((id) => { const S = DI.game.S, q = S.ss.get(id); let n = 0; while (!q.lowAir && n++ < 4000) S.step(0.02); }, r.v); await sel(r.v); await press('System drain'); await step(0.1, 0.02); await sel(r.v); await press(FIN); await tick();
  await ev(() => { const G = DI.game, S = G.S, res = S.drill.judge(S); res.stats = Object.assign({}, S.stats); G.sc = Object.assign({}, G.sc, { drill: { name: 'Cycle 7 report check' } }); DI.ui.showReport(res, 0, 0, true); }); await tick();
  const lines = await ev(() => [...document.querySelectorAll('#mbox .goal')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const has = (re) => lines.filter((l) => re.test(l)).length;
  ok('report: the tier line at 60 / 150, the realism tip, and two separate time lines', has(/Recovery rating: 3 of 3 stars\. Water stopped \d+ s after the alarm \(3 stars at 60 s or less, 2 at 150 s or less; any complete in-order recovery is 1; ASSUMED, informational\)\.$/) === 1 && has(/In a real building, getting to the riser takes minutes\./) === 1 && has(/^• Operator steps took: \d+ s$/) === 1 && has(/^• Main drain test took: \d+ s$/) === 1 && has(/Operator steps took \d/) === 0, lines.filter((l) => /took|rating/.test(l)).join(' | '));
  ok('report: two separate gallon lines, in the recovery list and under LOSSES, and no total', has(/^• Discharged through the open head: \d+ gal$/) === 1 && has(/^• Main drain test: \d+ gal \(to drain, not to the floor\)$/) === 1 && has(/^Discharged through the open head: \d+ gal$/) === 1 && has(/^Main drain test: \d+ gal \(to drain, not to the floor\)$/) === 1 && has(/gal discharged/) === 0, lines.filter((l) => /gal/.test(l)).join(' | '));
  ok('report: the shared-compressor note (Cycle 8 wording) with the edition’s section, the code-check line, and the return-to-normal errors as plain lines with no internal tag', has(/^• Note: 2 zones share this compressor\. It is sized for the largest zone, not for all zones at once\. \[NFPA 13-2025 §8\.2\.7\.3\]$/) === 1 && has(/^. Code check: largest zone alone, from 0 psig: [\d.]+ min\. Limit 30 min \(NFPA 13\)\. /) === 1 && has(/^• (D\d+ )?\d\d:\d\d:\d\d (You let air out through a drain, and pressure fell below low air\.|Pressure fell below low air, so the low-air supervisory came in and the zone could not hold its air\.)/) === 1 && has(/^• (D\d+ )?\d\d:\d\d:\d\d Finish was pressed before the zone was ready: /) === 1 && !lines.some((l) => TAGS.test(l)), lines.filter((l) => /Note:|ressure fell|Finish was|Code check/.test(l)).join(' | '));
  await shot('report'); await closeModal();

  // ---- 9. A save from before Cycle 7 with the site refrigerated flag set: loaded, the flag is gone and the log says so
  r = await rig(); await ev(() => { DI.saveGame(); const k = 'di.save.s0', sv = JSON.parse(localStorage.getItem(k)); sv.world.cfg.refrigerated = true; localStorage.setItem(k, JSON.stringify(sv)); DI.startScenario('s0'); DI.ui.close(); DI.setSpeed(0); }); await tick();
  const MIG = 'The site refrigerated setting was replaced by a per-zone setting (freezer room held below 5 F). Your zones now use 30 min until a freezer room is set.';
  ok('old save: a save with the site refrigerated flag loads with the flag deleted, and the log panel and a banner say so once', !('refrigerated' in (await cfg())) && (await logText()).split(MIG).length === 2 && (await ev(() => document.getElementById('banner').textContent)) === MIG && (await ev(() => DI.game.W.parts.size)) > 5);
  await ev(() => { localStorage.clear(); });
  await shot();
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fail || errs.length ? (fail + ' FAILED, ' + errs.length + ' page errors') : 'all Cycle 7 UI checks passed');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
