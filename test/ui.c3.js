// node test/ui.c3.js [out.png] - Cycle 3 browser checks (Playwright): the Manual Release zone path, a dead panel,
// the head gate with the recovery checklist and the reopen gate, the 24 h air test, loss of supply air with a
// water-filled zone, and the aspirating detector model with the NFPA 76 ceilings. Same style as ui.c2.js: inspector
// and dialog controls are operated with real mouse events; sim time is advanced by hand with the game paused.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  await p.goto('file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  const ev = (fn, arg) => p.evaluate(fn, arg), tick = () => p.waitForTimeout(450);        // one inspector / annunciator refresh
  // These checks read signal rows, so open the monitor that starts collapsed in normal play.
  const start = async (id) => { await ev((i) => { DI.startScenario(i, true); DI.ui.close(); DI.setSpeed(0); }, id); await tick(); if (await p.locator('#bAnnToggle').getAttribute('aria-expanded') === 'false') await p.click('#bAnnToggle'); };
  const step = (sec, dt) => ev(([s, d]) => { const S = DI.game.S; for (let t = 0; t < s; t += d) S.step(d); }, [sec, dt || 0.25]);
  const sel = async (id) => { await ev((i) => { DI.game.sel = { kind: 'part', id: i }; DI.inspect.render(true); }, id); await tick(); };
  const side = () => ev(() => document.getElementById('side').innerText);
  const btn = (text) => p.locator('#side button', { hasText: text });
  // the sandbox toolbar is tall and can cover the foot of the inspector: bring the button to the middle first
  const press = async (text) => { const e = btn(text).first(); await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e.click(); await tick(); };
  const row = (label) => ev((l) => { const r = [...document.querySelectorAll('#side .row')].find((e) => e.firstChild.textContent.startsWith(l)); return r ? r.lastChild.textContent : null; }, label);
  const banner = () => ev(() => document.getElementById('banner').textContent);
  const sigs = () => ev(() => [...document.querySelectorAll('#sigs .sig')].map((e) => e.className + ' | ' + e.innerText.replace(/\s+/g, ' ')));
  const on = async (id, text) => { await sel(id); await press(text); };            // select a part and press one of its buttons
  // a double-interlock rig in the sandbox: campus loop tap, control valve, preaction valve, half of Data Hall A,
  // compressor, panel, aspirating detector and a manual release station in the hall
  const rig = async (trim) => { await start('s0'); const ids = await ev((tr) => {
    const G = DI.game, W = G.W, m = DI.mk(W);
    m.p('city', 28, 27, 0, { stat: 90, resid: 70, flow: 1500, fixed: true }); m.h(29, 31, 27, 6); const g = m.p('gate', 32, 27); m.h(33, 33, 27, 6);
    const v = m.p('prev', 34, 27, 0); if (tr) DI.loadTrim(v, tr); m.h(35, 36, 27, 6); m.v(36, 25, 26, 6);
    const d = m.p('vesda', 42, 11), st = m.p('mstn', 41, 11), pn = m.p('panel', 30, 29), c = m.p('comp', 34, 29, 0, { scfm: 10 }); m.air([[34, 28]]);
    m.v(36, 11, 24, 5, true); m.grid(30, 11, 35, 24, 2, 1); m.grid(37, 11, 42, 24, 2, 1); m.wire(pn, g, v, d, st);
    G.S.sync(); G.S.commission(); G.S.live = true; G.S.rv = DI.review(G.S);
    return { v: v.id, g: g.id, pn: pn.id, d: d.id, st: st.id, c: c.id, hx: 39, hy: 16, head: W.k(39, 16), room: W.roomAt[W.k(39, 16)] };
  }, trim); await tick(); return ids; };
  const st = (id) => ev((i) => { const S = DI.game.S, s = S.ss.get(i), q = S.W.parts.get(i).p; return { state: s.state, set: s.set, P: s.P, pLatch: q.pLatch, sol: q.sol, pull: q.pull, mrzL: q.mrzL, solOut: q.solOut, sdrain: q.sdrain, airValve: q.airValve, wat: s.wat, dz: !!s.dz, qOut: s.qOut || 0 }; }, id);
  const site = async () => { await p.click('#bSite'); await tick(); }, closeModal = async () => { await ev(() => DI.ui.close()); await tick(); };
  const smokeFor = (room, lvl, sec) => ev(([rm, l, s]) => { const S = DI.game.S; for (let t = 0; t < s; t += 0.25) { S.smoke[rm] = l; S.step(0.25); } S.smoke[rm] = 0; }, [room, lvl, sec]);
  const untilZero = (id) => ev((i) => { const S = DI.game.S, s = S.ss.get(i); for (let n = 0; n < 40000 && !s.dz; n++) S.step(0.25); return !!s.dz; }, id);

  // ---- 1. Manual Release zone: its own release path, shown on the valve
  let r = await rig(); await site(); await p.click('#mbox button[data-s="byp"][data-v="1"]'); await tick(); await closeModal(); await step(1); await sel(r.v);
  const d0 = await row('D: detection');
  ok('zone: with the 9(c) bypass ON on El/El the valve shows the release path BYPASS ARMED', (await row('Release path')) === 'Manual Release zone BYPASS ARMED (9(c), NEEDS PE REVIEW)' && (await row('Manual station type')) === 'MANUAL RELEASE - bypasses P');
  await on(r.st, 'Operate station'); await step(5); await sel(r.v); let s = await st(r.v);
  const d1 = await row('D: detection');
  ok('zone: operating the station releases without P: RELEASING, valve tripped, P normal', (await row('Release path')) === 'Manual Release zone RELEASING - without P' && s.state !== 'dry' && s.mrzL === true && s.pull === false && s.pLatch === false && (await row('P: pipe pressure')) === 'normal' && (await row('Solenoid (D AND P)')) === 'ENERGIZED');
  await on(r.st, 'Reset station'); await step(5); await sel(r.v); s = await st(r.v); const d2 = await row('D: detection');
  ok('zone: resetting the station leaves the release latched', s.mrzL === true && (await row('Release path')) === 'Manual Release zone RELEASING - without P');
  await on(r.pn, 'Panel reset'); await step(1); await sel(r.v); s = await st(r.v); const d3 = await row('D: detection');
  ok('zone: the panel reset clears it, back to BYPASS ARMED', s.mrzL === false && (await row('Release path')) === 'Manual Release zone BYPASS ARMED (9(c), NEEDS PE REVIEW)' && (await row('Solenoid (D AND P)')) === 'de-energized');
  ok('zone: the D row reads normal throughout (the zone is not detection)', [d0, d1, d2, d3].every((x) => x === 'normal'), [d0, d1, d2, d3].join());

  // ---- 2. Dead panel: trouble first, then dark, unresettable; P returns when power does
  r = await rig(); await ev(() => { DI.game.W.power = false; DI.game.S.warp(3600); }); await tick();
  let a = await sigs();
  ok('dead panel: AC failure is on the annunciator first, with no low battery yet', a.some((x) => /sig TRBL \| TRBL PANEL AC FAIL/.test(x)) && !a.some((x) => x.includes('LOW BATTERY')), a.join(' / ').slice(0, 200));
  await ev(() => DI.game.S.warp(21.2 * 3600)); await tick(); a = await sigs();
  ok('dead panel: then LOW BATTERY, while the panel is still alive', a.some((x) => x.includes('PANEL AC FAIL')) && a.some((x) => /sig TRBL \| TRBL LOW BATTERY - panel #/.test(x)) && (await ev((id) => DI.game.W.parts.get(id).p.alive, r.pn)) === true);
  await ev(() => DI.game.S.warp(2 * 3600)); await tick(); a = await sigs();
  const glyph = await ev((id) => { const G = DI.game, x = DI.partState(G, G.W.parts.get(id), 0); return [x.alive, x.al, x.sv, x.tr, x.op].join(); }, r.pn);
  ok('dead panel: at death the display is dark and the banner reads PANEL DEAD - DISPLAY DARK, before the supervising station knows', a.length === 1 && a[0].includes('Display dark: the panel is dead.') && (await ev(() => document.getElementById('annState').textContent)) === 'PANEL DEAD - DISPLAY DARK' && !(await ev(() => [...DI.game.S.sig.values()].some((o) => o.lost))), a.join(' / '));
  await ev(() => DI.game.S.warp(DI.commDelay(DI.game.W) + 60)); await tick(); a = await sigs();       // the supervising station's own interval: use the time-skip
  ok('dead panel: one supervision interval later the annunciator lists only the supervising station line, and the banner still reads PANEL DEAD - DISPLAY DARK', a.length === 1 && /stn \| TRBL SUPERVISING STATION LOSS OF COMMUNICATION - panel #\d+ \(no signal, supervising station reports trouble\)/.test(a[0]) && (await ev(() => document.getElementById('annState').textContent)) === 'PANEL DEAD - DISPLAY DARK', a.join(' / '));
  ok('dead panel: the panel glyph is dark, every LED off', glyph === 'false,0,0,0,0', glyph);
  await sel(r.pn);
  const dis = await ev(() => [...document.querySelectorAll('#side button')].filter((e) => /^(Silence|Panel reset)$/.test(e.textContent)).map((e) => e.disabled + '|' + e.title));
  ok('dead panel: Panel reset and Silence are disabled and say why', dis.length === 2 && dis.every((x) => x.startsWith('true|The panel is dead: no power, no display. Nothing can be reset or silenced.')) && (await row('Power')) === 'DEAD - display dark', dis.join(' / ').slice(0, 120));
  await sel(r.v); const g0 = await row('System (gas)');
  ok('dead panel: the rows it feeds read not displayed: panel dead', (await row('D: detection')) === 'not displayed: panel dead' && (await row('P: pipe pressure')) === 'not displayed: panel dead' && (await row('Solenoid (D AND P)')) === 'not displayed: panel dead' && (await row('Release path')) === 'not displayed: panel dead');
  await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(120); await tick(); const g1 = await row('System (gas)'); s = await st(r.v);
  ok('dead panel: the gauge and the valve state still update, and nothing latches or releases', g0 !== g1 && parseFloat(g1) < 20 && parseFloat(g0) > 35 && (await row('Status')) === 'Set - in service' && s.state === 'dry' && s.pLatch === false, g0 + ' -> ' + g1);
  await ev(() => { DI.game.W.power = true; }); await step(0.25); await tick(); s = await st(r.v);
  ok('dead panel: power restored, the pipe is still low, so P returns and the row says so', s.pLatch === true && s.state === 'dry' && (await row('P: pipe pressure')) === 'LATCHED - reset the panel' && (await ev(() => DI.game.S.log.some((l) => l.text.startsWith('Panel power restored: inputs re-read. P returns')))));

  // ---- 3a. Head gate: each refusal in turn, on a broken head that has not tripped the valve (El/El)
  r = await rig(); await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(3); await sel(r.v);
  ok('recovery: a broken head opens the Recovery checklist (PRACTICE) on the valve', (await side()).includes('RECOVERY CHECKLIST (PRACTICE)') && (await row('Latest incident')) !== null);
  await press('Replace 1 sprinkler'); const m1 = await banner();
  await on(r.g, 'Close valve'); await step(5);
  // practice (no drill running): reopening on a zone that is not ready is allowed, with a warning that lists what is still open
  await on(r.g, 'Open valve'); const gw = await banner(), gs = await ev((id) => ({ target: DI.game.W.parts.get(id).p.target, act: DI.game.S.acts.filter((q) => q.kind === 'reopen-warn' && q.id === id).map((q) => q.items.join('; ')).join(' / '), log: DI.game.S.log.some((l) => l.cls === 'bad' && l.text.includes('reopened with items still open')) }), r.g);
  ok('reopen gate, practice: outside a drill an unready zone reopens with a warning naming the open items, and a reopen-warn entry is logged', gs.target === 1 && /^Control valve #\d+ reopened with items still open: head not replaced in Preaction system #\d+ - Data Hall A/.test(gw) && gs.act.startsWith('head not replaced in Preaction system #') && gs.log, gw);
  await on(r.g, 'Close valve'); await step(5);
  await sel(r.v); const still = await row('If the control valve is reopened now'); ok('recovery: the practice checklist shows the same items', /^still open: head not replaced in Preaction system #\d+ - Data Hall A/.test(still || ''), still);
  await press('Replace 1 sprinkler'); const m2 = await banner();
  ok('head gate: refused with the control valve open, then with the air supply not isolated', m1 === 'Close the control valve first.' && m2 === 'Isolate the air / N2 supply first.' && (await row('Air / N₂ supply')) === 'OPEN', m1 + ' / ' + m2);
  await press('Isolate air'); await press('Replace 1 sprinkler'); const m3 = await banner(); s = await st(r.v);
  ok('head gate: then refused while the pipe still holds pressure', /^The pipe still holds [\d.]+ psi\. Open the system drain and wait for the gauge to read 0\.$/.test(m3) && s.P > 0.5 && (await row('Air / N₂ supply')) !== 'OPEN', m3);
  await press('System drain'); const z = await untilZero(r.v); await tick(); s = await st(r.v);
  const wf = await ev(() => ({ out: DI.game.S.outFlow, wfSig: [...DI.game.S.sig.keys()].some((k) => k.startsWith('wf')), gal: DI.game.S.stats.gallons }));
  ok('head gate: drain open, gauge at 0, and the open drain never shows as water flow', z && s.P <= 0.5 && s.sdrain === 1 && wf.out === 0 && !wf.wfSig && wf.gal === 0 && s.qOut === 0 && (await row('Flow through valve')) === '0 gpm', 'P ' + s.P.toFixed(2));
  await press('Replace 1 sprinkler'); await tick();
  ok('head gate: now the head is replaced, with the drain still open', (await ev((k) => DI.game.W.spk[k], r.head)) === 1 && (await btn('Replace 1 sprinkler').count()) === 0 && (await st(r.v)).sdrain === 1);
  await press('System drain'); await press('Restore air'); await step(1800, 1); await on(r.pn, 'Panel reset'); await step(2); await on(r.g, 'Open valve'); await step(6); await sel(r.v);
  const na = await ev(() => [...document.querySelectorAll('#side .row')].filter((e) => /^\d+\. /.test(e.firstChild.textContent)).map((e) => e.lastChild.textContent));
  ok('recovery: steps that do not apply are shown as such (no silence or find-head here, so it is not a clean 13)', na.length === 13 && na[5] === 'not applicable' && na[7] === 'not applicable' && na[10] === 'not applicable' && na[12] === 'done' && na[0] === 'pending', na.join(','));

  // ---- 3b. The full tripped recovery by mouse, El/Pn: every reopen-gate refusal, then 13 of 13 in order
  // A drill is marked as running before the head breaks, so this is the scored incident and the gate refuses. (The sandbox has
  // no drill of its own: the object below is the minimum the gate reads, with one spent step so the drill runner leaves it alone.)
  r = await rig('el-pn'); await ev(() => { const S = DI.game.S; S.drill = { name: 'test', t0: S.t, done: false, steps: [[0, () => {}]], i: 1, len: 1e9, judge: () => ({ pass: true, lines: [] }) }; });
  await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(60); await smokeFor(r.room, 0.2, 3); await step(20); s = await st(r.v);
  ok('recovery: broken head, then Fire 1: the valve has tripped and is discharging', s.state !== 'dry' && s.sol === true && s.pLatch === true);
  await on(r.pn, 'Silence');
  // find the head: centre the map on it and click it, as a player would
  await ev(({ x, y }) => { DI.ui.setTool('select'); DI.ui.focus(x, y); }, { x: r.hx, y: r.hy }); await tick(); await p.mouse.click(800, 450); await tick();
  ok('recovery: clicking the operated head on the map logs find-head', (await ev((id) => DI.game.S.acts.some((q) => q.kind === 'find-head' && q.id === id), r.v)) && (await ev(() => DI.game.sel && DI.game.sel.kind)) === 'tile');
  await on(r.g, 'Close valve'); await step(6);
  const gate = async () => { await on(r.g, 'Open valve'); const m = await banner(); const o = await ev((id) => DI.game.W.parts.get(id).p.target, r.g); return o === 0 ? m : 'OPENED'; };
  const gm1 = await gate();
  await sel(r.v); await press('Isolate air'); await press('System drain'); const z2 = await untilZero(r.v); await tick();
  await on(r.pn, 'Panel reset'); await step(1); const gm2 = await gate();
  await sel(r.v); await press('Replace 1 sprinkler'); await step(1); await sel(r.v); await press('Reset valve at the riser'); await step(1); s = await st(r.v);
  ok('recovery: the riser reset works with the drain still open, and leaves it open', z2 && s.state === 'dry' && s.sdrain === 1 && (await btn('Reset valve at the riser').count()) === 0);
  const gm3 = await gate();
  await sel(r.v); await press('System drain'); await press('Restore air'); await step(1800, 1); const gm4 = await gate();
  await sel(r.v); await press('Reset actuator at the trim'); await step(1); await on(r.pn, 'Panel reset'); await step(2); const gm5 = await gate(); await step(6);
  ok('reopen gate, scored drill incident: refused while D is latched, while the valve is tripped, while the air is below low air, and while P is latched', gm1 === 'Reset the panel first: D / the solenoid is still latched.' && gm2 === 'Reset the riser valve first: it is still tripped.' && /^Restore air first: [\d.]+ psi is below low air \(30 psi\)\.$/.test(gm3) && gm4 === 'Reset the actuator at the trim: P is still latched.', [gm1, gm2, gm3, gm4].join(' / '));
  await sel(r.g); const zone = await row('Zone behind it'); await sel(r.v); s = await st(r.v);
  const rows = await ev(() => [...document.querySelectorAll('#side .row')].filter((e) => /^\d+\. /.test(e.firstChild.textContent)).map((e) => e.lastChild.textContent));
  ok('reopen gate, scored drill incident: it opens once the panel is reset, the clapper reset, P clear and the air above low air, and no warning was logged', !(await ev(() => DI.game.S.acts.some((q) => q.kind === 'reopen-warn'))) && gm5 === 'OPENED' && zone === 'in service' && s.state === 'dry' && s.set && !s.pLatch && s.P >= 30 && (await ev((id) => DI.game.W.parts.get(id).p.open, r.g)) > 0.99);
  ok('recovery: the checklist reads 13 of 13, in order', (await row('Latest incident')) === '13 of 13, in order' && rows.length === 13 && rows.every((x) => x === 'done'), (await row('Latest incident')) + ' | ' + rows.join(','));

  // ---- 4. 24 h air test: starts at 40 psi, end reading 38.5 or more, section follows the edition
  r = await rig(); await ev((id) => { const S = DI.game.S, s2 = S.ss.get(id), q = S.W.parts.get(id).p; q.airValve = 0; s2.G = (37 + DI.ATM) * S.sysd.info.get(id).vol; S.step(0.25); q.airValve = 1; }, r.v); await sel(r.v);
  await press('24 h air test'); const p0 = await ev((id) => { const S = DI.game.S, pr = S.procs[0], P0 = S.ss.get(id).P; let n = 0; while (S.procs.length && S.procs[0].stage === 0 && n++ < 8000) S.step(0.25); return { stage0: pr.stage0 === undefined && n > 0, P0, p0: pr.p0, av: S.W.parts.get(id).p.airValve }; }, r.v);
  ok('air test: from about 37 psi the zone is charged first, and the clock starts at 40.0 psi with the supply isolated', p0.stage0 && Math.abs(p0.P0 - 37) < 0.2 && Math.abs(p0.p0 - 40) < 0.01 && p0.av === 0, 'from ' + p0.P0.toFixed(1) + ' to ' + (p0.p0 || 0).toFixed(2));
  await ev(() => DI.game.S.warp(86500)); await sel(r.v); let rep = await ev(() => [...document.querySelectorAll('#side .res')].map((e) => e.innerText).find((t) => t.includes('air leakage')) || '');
  ok('air test: sound pipe passes, and the report gives the test pressure and the 2025 section', rep.startsWith('PASS') && rep.includes('Test pressure: 40 psi') && rep.includes('Start: 40.0 psi') && rep.includes('Pass: end reading at least 38.5 psi (loss of 1.5 psi or less in 24 h) [NFPA 13-2025 §29.2.2.1]'), rep.replace(/\n/g, ' | '));
  const leakRun = async () => { await sel(r.v); await press('24 h air test'); await ev(() => DI.game.S.warp(86500 + 1800)); await sel(r.v); return ev((id) => { const q = DI.lastResult(DI.game.S, 'leak', id); return { pass: q.pass, end: q.end, txt: [...document.querySelectorAll('#side .res')].map((e) => e.innerText).find((t) => t.includes('air leakage')) || '' }; }, r.v); };
  await ev((id) => { DI.game.S.ss.get(id).holes = 1; }, r.v); await step(1); let lk = await leakRun();
  ok('air test: a leaking zone ends FAIL with an end reading below 38.5 psi and the section on the report', !lk.pass && lk.end < 38.5 && lk.txt.startsWith('FAIL') && lk.txt.includes('[NFPA 13-2025 §29.2.2.1]'), lk.txt.replace(/\n/g, ' | '));
  await site(); await p.click('#mbox button[data-s="ed"][data-v="US-2019"]'); await tick(); await closeModal();
  await ev((id) => { const S = DI.game.S, pn = S.W.panelOf(id); S.warp(1800); DI.panelReset(S, pn.id); S.step(1); }, r.v); lk = await leakRun();
  ok('air test: with the edition set to 2019 in the Site dialog the report cites §28.2.2.1, verified, with no ASSUMED mark', !lk.pass && lk.txt.includes('[NFPA 13-2019 §28.2.2.1]') && !lk.txt.includes('ASSUMED') && !lk.txt.includes('§29.2.2.1'), lk.txt.replace(/\n/g, ' | '));

  // ---- 5. Loss of supply air, and a zone that fills with every head closed
  r = await rig(); await on(r.c, 'Fail source (sandbox)'); await ev((id) => { DI.game.S.ss.get(id).holes = 400; }, r.v); await step(900, 1); await tick(); a = await sigs();
  ok('supply air: failing the only compressor raises LOSS OF SUPPLY AIR as a trouble, beside the LOW AIR supervisory', a.some((x) => /^sig TRBL \| TRBL LOSS OF SUPPLY AIR - Preaction system #\d+.*\(compressor \/ N2 source unavailable\)$/.test(x)) && a.some((x) => /^sig SUPV \| SUPV LOW AIR - /.test(x)) && (await row('Status')) === 'FAULT - not making gas', a.join(' / ').slice(0, 260));
  const latched = await ev((id) => { const S = DI.game.S, q = S.W.parts.get(id).p; for (let n = 0; n < 40000 && !q.pLatch; n++) S.step(1); return q.pLatch; }, r.v);
  await ev(() => { document.getElementById('log').innerHTML = ''; }); await smokeFor(r.room, 0.2, 5); await step(120); await sel(r.v); s = await st(r.v);
  const log = await ev(() => [...document.querySelectorAll('#log div')].map((e) => e.className + ' ' + e.innerText).join('\n')), flow = await ev(() => ({ out: DI.game.S.outFlow, gal: DI.game.S.stats.gallons, zf: DI.game.S.acts.filter((q) => q.kind === 'zone-filled').map((q) => q.why).join() }));
  ok('water-filled zone: latched P plus Fire 1 with every head closed trips the valve and the log says water-filled, not a discharge', latched && s.state !== 'dry' && /bad .*is water-filled: no head is open, so nothing discharges\. This is an unattended low-air failure, not a discharge\./.test(log) && flow.zf === 'low-air');
  ok('water-filled zone: the gauge reads System (water) and nothing is discharged', (await row('System (water)')) !== null && (await row('System (gas)')) === null && flow.out === 0 && flow.gal === 0 && s.wat > 10, Math.round(s.wat) + ' gal in the pipe, outflow ' + flow.out);

  // ---- 6. Aspirating detector model, per-stage ranges, no clamp; NFPA 76 as ceilings (a note, no chips, a check that writes nothing)
  await start('s0'); await site();
  const rd = () => ev(() => ({ on: [...document.querySelectorAll('#mbox button[data-s="asd"]')].filter((e) => e.classList.contains('on')).map((e) => e.textContent).join(), ranges: [...document.querySelectorAll('#mbox small[data-r]')].map((e) => e.textContent), doc: document.getElementById('asdDoc').innerText,
    vals: [...document.querySelectorAll('#mbox input[data-t]')].map((e) => e.value), bad: [...document.querySelectorAll('#mbox input[data-t]')].map((e) => (e.dataset.bad ? 1 : 0)).join(''), mm: [...document.querySelectorAll('#mbox input[data-t]')].map((e) => e.min + '-' + e.max).join(' '), thr: DI.detThr(DI.game.W).join(), note: (document.getElementById('siteNote') || {}).innerText || '' }));
  let d = await rd();
  ok('ASD: the model row shows VEP selected, with the four listed ranges and the datasheet number under the inputs', d.on === 'VESDA-E VEP' && d.ranges.join(' | ') === '0.0015 to 0.614 | 0.0015 to 0.614 | 0.0030 to 0.614 | 0.0061 to 6.575' && d.doc.includes('Xtralis Doc. 36106_07') && d.doc.includes('[HB, datasheet; UL Product iQ not checked]') && d.mm === '0.0015-0.614 0.0015-0.614 0.003-0.614 0.0061-6.575' && d.bad === '0000', d.ranges.join(' | '));
  await p.fill('#mbox input[data-t="2"]', '0.7'); await p.press('#mbox input[data-t="2"]', 'Tab'); await tick(); d = await rd();
  const rvFail = () => ev(() => DI.review(DI.game.S).filter((f) => f.sev === 'fail' && f.text.includes('Fire 1 threshold 0.7 %/ft is outside the listed range')).map((f) => f.text));
  let f = await rvFail();
  ok('ASD: 0.7 typed into Fire 1 turns the field red, stays 0.7, and fails plan review against the VEP range', d.vals[2] === '0.7' && d.bad === '0010' && d.thr === '0.03,0.06,0.7,1.2' && f.length === 1 && f[0].includes('VESDA-E VEP (0.0030 to 0.614 %/ft)'), d.vals.join() + ' bad ' + d.bad);
  await p.click('#mbox button[data-s="asd"][data-v="VEU"]'); await tick(); d = await rd(); f = await rvFail();
  ok('ASD: switching to VEU widens the ranges, changes no threshold, and the same 0.7 still fails', d.on === 'VESDA-E VEU' && d.ranges.join(' | ') === '0.0003 to 0.614 | 0.0003 to 0.614 | 0.0003 to 0.614 | 0.0003 to 6.575' && d.doc.includes('36107_05') && d.thr === '0.03,0.06,0.7,1.2' && d.bad === '0010' && f.length === 1 && f[0].includes('VESDA-E VEU'));
  ok('ASD: a model that is not in the table is rejected', (await ev(() => DI.ui.siteSet('asd', 'XYZ'))) === false && (await ev(() => DI.asdModel(DI.game.W))) === 'VEU');
  await p.click('#mbox button[data-s="asd"][data-v="VEP"]'); await tick(); await p.click('#mbox button[data-s="pre"][data-v="reset"]'); await tick();
  const n76 = () => ev(() => ({ open: !!document.getElementById('n76Open'), conf: !!document.getElementById('n76Conf'), stage: document.querySelectorAll('#mbox button[data-s="n76s"]').length, note: (document.getElementById('n76Note') || {}).innerText || '', flags: [...document.querySelectorAll('#mbox p.n76')].map((e) => e.dataset.c).join(),
    chk: document.querySelector('#mbox button[data-s="pre"][data-v="nfpa76"]').textContent + '|' + document.querySelector('#mbox button[data-s="pre"][data-v="nfpa76"]').disabled }));
  let n = await n76();
  ok('NFPA 76: not adopted, there is no note, no chip and no alarm-stage row; the check button only reads, so it is always enabled', !n.open && !n.conf && n.stage === 0 && n.note === '' && n.flags === '' && n.chk === 'Check against NFPA 76|false');
  // Cycle 8: NFPA 76 applies by room. With the site setting on and no telecom room, nothing is checked and the note says so;
  // then one data hall becomes a Telecom / MMR room with an aspirating detector in it.
  await p.click('#mbox button[data-s="n76"][data-v="1"]'); await tick(); n = await n76();
  ok('NFPA 76: the site setting alone checks nothing: the note says there is no NFPA 76 room', /^NFPA 76 is set as the default for telecom rooms on this site, and there is no NFPA 76 room/.test(n.note) && n.flags === '');
  await ev(() => { const W = DI.game.W, r = W.rooms.find((q) => q.type === 'hall'); r.type = 'tel'; r.name = 'MMR 1'; let d = null; for (let y = r.y; y < r.y + r.h && !d; y++) for (let x = r.x; x < r.x + r.w && !d; x++) d = W.addPart('vesda', x, y, 0); W.ver++; DI.game.S.touch(); }); await closeModal(); await site(); n = await n76();
  ok('NFPA 76: with a telecom room the note names it and says the VEP listing binds first, with no OPEN chip, no CONFLICT chip, no flag and no alarm-stage row', !n.open && !n.conf && n.stage === 0 && n.flags === '' && n.note === 'NFPA 76 rooms: MMR 1. NFPA 76 ceilings: Alert 0.2, Fire 1 1.0 %/ft. The VESDA-E VEP listing (Fire 1 maximum 0.614) is tighter, so the listing binds first. [PRACTICE, NEEDS PE REVIEW].' && n.chk === 'Check against NFPA 76|false', n.note);
  await closeModal(); await p.click('#bReview'); await tick(); const rv76 = await ev(() => ({ ok: [...document.querySelectorAll('#mbox .find.ok')].map((e) => e.innerText).join('\n'), bad: [...document.querySelectorAll('#mbox .find.warn, #mbox .find.fail')].map((e) => e.innerText).join('\n') })); await closeModal();
  ok('NFPA 76: plan review carries the note as one ok line and raises no NFPA 76 warning or failure', rv76.ok.includes('NFPA 76 ceilings: Alert 0.2, Fire 1 1.0 %/ft.') && !/NFPA 76/.test(rv76.bad));
  await site(); await p.click('#mbox button[data-s="pre"][data-v="nfpa76"]'); await tick(); d = await rd();
  ok('NFPA 76: "Check against NFPA 76" shows the result and changes no field', d.note === 'NFPA 76 check, MMR 1: Alert 0.03 (meets 0.2: yes), Fire 1 0.12 (meets 1.0: yes).' && d.thr === '0.03,0.06,0.12,1.2' && d.vals.join() === '0.03,0.06,0.12,1.2' && d.bad === '0000' && (await ev(() => !('detThr' in DI.game.W.cfg) && !('n76AlarmStage' in DI.game.W.cfg))), d.note);
  await closeModal(); await ev(() => localStorage.clear()); await start('c5'); await site();
  const ro = await ev(() => ['asd', 'n76', 'pre', 'path', 'acd', 'hvac', 'epo', 'ed72'].map((k) => { const l = [...document.querySelectorAll('#mbox button[data-s="' + k + '"]')]; return l.length > 0 && l.every((e) => e.disabled); }).join() + '|' + [...document.querySelectorAll('#mbox input[data-t]')].every((e) => e.disabled) + '|' + DI.ui.siteSet('asd', 'VEU') + DI.ui.siteSet('path', 'multi') + DI.ui.siteSet('hvac', 'fire1') + DI.ui.siteSet('ed72', '2019'));
  ok('contract: the model, NFPA 76, supervising-station, hook and NFPA 72 edition rows are read-only', ro === 'true,true,true,true,true,true,true,true|true|falsefalsefalsefalse', ro);
  await p.screenshot({ path: process.argv[2] || 'ui-c3.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fail || errs.length ? (fail + ' FAILED, ' + errs.length + ' page errors') : 'all Cycle 3 UI checks passed');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
