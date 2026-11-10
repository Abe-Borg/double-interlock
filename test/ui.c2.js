// node test/ui.c2.js [out.png] - Cycle 2 browser checks (Playwright): the Site gate and round-trip, the P latch
// and both reset paths, a dead panel with a manual pull, stage order at a fixed time step, the mechanical
// release, the impairment tag and the play-test fixes. Inspector buttons are operated with real mouse events;
// sim time is advanced by hand with the game paused, so every run is the same.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  await p.goto('file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  await p.addScriptTag({ path: path.resolve(__dirname, 'bot.js') });
  const ev = (fn, arg) => p.evaluate(fn, arg), tick = () => p.waitForTimeout(450);        // one inspector / annunciator refresh
  const start = async (id) => { await ev((i) => { DI.startScenario(i, true); DI.ui.close(); DI.setSpeed(0); }, id); await tick(); };
  const step = (sec, dt) => ev(([s, d]) => { const S = DI.game.S; for (let t = 0; t < s; t += d) S.step(d); }, [sec, dt || 0.25]);
  const sel = async (id) => { await ev((i) => { DI.game.sel = { kind: 'part', id: i }; DI.inspect.render(true); }, id); await tick(); };
  const side = () => ev(() => document.getElementById('side').innerText);
  const btn = (text) => p.locator('#side button', { hasText: text });
  // the sandbox toolbar is tall and can cover the foot of the inspector: bring the button to the middle first
  const press = async (text) => { const e = btn(text).first(); await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e.click(); await tick(); };
  const row = (label) => ev((l) => { const r = [...document.querySelectorAll('#side .row')].find((e) => e.firstChild.textContent.startsWith(l)); return r ? r.lastChild.textContent : null; }, label);
  // a double-interlock rig in the sandbox: campus loop tap, control valve, preaction valve, half of Data Hall A,
  // compressor, panel, aspirating detector and a manual release station in the hall
  const rig = async (trim) => { await start('s0'); const ids = await ev((tr) => {
    const G = DI.game, W = G.W, m = DI.mk(W);
    m.p('city', 28, 27, 0, { stat: 90, resid: 70, flow: 1500, fixed: true }); m.h(29, 31, 27, 6); const g = m.p('gate', 32, 27); m.h(33, 33, 27, 6);
    const v = m.p('prev', 34, 27, 0); if (tr) DI.loadTrim(v, tr); m.h(35, 36, 27, 6); m.v(36, 25, 26, 6);
    const d = m.p('vesda', 42, 11), st = m.p('mstn', 41, 11), pn = m.p('panel', 30, 29); m.p('comp', 34, 29, 0, { scfm: 10 }); m.air([[34, 28]]);
    m.v(36, 11, 24, 5, true); m.grid(30, 11, 35, 24, 2, 1); m.grid(37, 11, 42, 24, 2, 1); m.wire(pn, g, v, d, st);
    G.S.sync(); G.S.commission(); G.S.live = true; G.S.rv = DI.review(G.S);
    return { v: v.id, g: g.id, pn: pn.id, d: d.id, st: st.id, head: W.k(39, 16), room: W.roomAt[W.k(39, 16)] };
  }, trim); await tick(); return ids; };
  const st = (id) => ev((i) => { const S = DI.game.S, s = S.ss.get(i), q = S.W.parts.get(i).p; return { state: s.state, set: s.set, P: s.P, pLatch: q.pLatch, sol: q.sol, pull: q.pull, solOut: q.solOut, mech: q.mech, wat: s.wat }; }, id);
  const breakFix = async (r) => { await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(240); await sel(r.v); await press('Replace 1 sprinkler'); };

  // ---- 1. Site menu: read-only in a contract, editable in the sandbox, saved with the map, edition delta shown
  await start('c5'); await p.click('#bSite'); await tick();
  const ro = await ev(() => ({ line: !!document.getElementById('siteRO') && document.getElementById('siteRO').innerText, n: document.querySelectorAll('#mbox [data-s], #mbox input').length, enabled: document.querySelectorAll('#mbox [data-s]:not([disabled]), #mbox input:not([disabled])').length }));
  ok('site: a contract shows the fixed basis-of-design line and every control disabled', /Basis of design is fixed in a contract: set by the AHJ, the owner and the insurer/.test(ro.line) && ro.n > 20 && ro.enabled === 0, ro.n + ' controls');
  const tried = await ev(() => { const before = JSON.stringify(DI.game.W.cfg);
    document.querySelectorAll('#mbox [data-s]').forEach((e) => { e.disabled = false; e.click(); }); document.querySelectorAll('#mbox input').forEach((e) => { e.disabled = false; e.value = 9; e.dispatchEvent(new Event('change')); });
    const set = [['ed', 'US-2019'], ['ins', 'FM'], ['byp', '1'], ['cut', 5], ['fit', 20], ['pLatch', 'ALARM'], ['thr', [2, 0.5]]].map(([k, v]) => DI.ui.siteSet(k, v));
    return { same: JSON.stringify(DI.game.W.cfg) === before, cfg: before, set }; });
  ok('site: in a contract no Site control changes W.cfg', tried.same && tried.cfg === '{}' && tried.set.every((x) => x === false));
  await ev(() => DI.ui.close()); await start('s0'); await p.click('#bSite'); await tick();
  await p.click('#mbox button[data-s="ed"][data-v="US-2019"]'); await tick();
  const d19 = await ev(() => document.getElementById('siteDelta').innerText);
  ok('site: in the sandbox the edition changes and the edition-delta line shows', (await ev(() => DI.game.W.cfg.edition)) === 'US-2019' && d19.includes('Edition delta vs 2025') && d19.includes('§8.2.3.2') && d19.includes('Table 8.2.4.3.2'), d19.slice(0, 90));
  await p.click('#mbox button[data-s="ins"][data-v="FM"]'); await tick(); await p.click('#mbox button[data-s="cut"][data-v="5"]'); await tick(); await p.click('#mbox button[data-s="pLatch"][data-v="TRBL"]'); await tick();
  await p.fill('#mbox input[data-n="fit"]', '10'); await p.press('#mbox input[data-n="fit"]', 'Tab'); await tick(); await p.fill('#mbox input[data-n="spot"]', '2'); await p.press('#mbox input[data-n="spot"]', 'Tab'); await tick();
  await p.fill('#mbox input[data-t="2"]', '0.2'); await p.press('#mbox input[data-t="2"]', 'Tab'); await tick();
  const cfg = await ev(() => DI.game.W.cfg), supv = await ev(() => ({ btn: !!document.querySelector('#mbox button[data-s="pLatch"][data-v="SUPV"]'), set: DI.ui.siteSet('pLatch', 'SUPV'), cls: DI.sigClass(DI.game.W, 'pLatch'), opts: [...document.querySelectorAll('#mbox button[data-s="pLatch"]')].map((e) => e.textContent).join() }));
  ok('site: sandbox controls write the settings (insurer, size cut, fittings %, spot threshold, Fire 1, signal class)', cfg.insurer === 'FM' && cfg.pipeCut === 5 && cfg.fitPct === 10 && cfg.spotThr === 2 && cfg.detThr[2] === 0.2 && cfg.sigClass.pLatch === 'TRBL', JSON.stringify(cfg));
  ok('site: supervisory is not offered for a latched P and is refused', !supv.btn && supv.set === false && supv.cls === 'TRBL' && supv.opts === 'Not elected,Alarm,Trouble', supv.opts);
  await ev(() => { DI.ui.close(); DI.saveGame(); DI.startScenario('s0'); DI.ui.close(); }); await tick(); await p.click('#bSite'); await tick();
  const back = await ev(() => ({ cfg: DI.game.W.cfg, delta: document.getElementById('siteDelta').innerText, on: [...document.querySelectorAll('#mbox button.on')].map((e) => e.textContent).join('|'), fit: document.querySelector('#mbox input[data-n="fit"]').value }));
  ok('site: settings round-trip through save and load, with the edition-delta line', back.cfg.edition === 'US-2019' && back.cfg.insurer === 'FM' && back.cfg.pipeCut === 5 && back.fit === '10' && back.delta.includes('Edition delta vs 2025') && back.on.includes('NFPA 13-2019') && back.on.includes('FM') && back.on.includes('3 in.') && back.on.includes('Trouble'), back.on);
  await ev(() => DI.ui.close()); await p.click('#bReview'); await tick(); const rvTxt = await ev(() => document.getElementById('mbox').innerText);
  ok('site: plan review carries the same delta line and the edition', rvTxt.includes('Edition delta vs 2025') && rvTxt.includes('Reviewed to NFPA 13-2019'));
  await ev(() => { DI.ui.close(); localStorage.clear(); });

  // ---- 2. P latch and the reset path of each trim (A2), the gauge label (A4)
  let r = await rig(); await breakFix(r);
  let s = await st(r.v), txt = await side();
  ok('El/El: P latched, the valve names the panel reset only', s.pLatch && s.state === 'dry' && (await row('P: pipe pressure')) === 'LATCHED - reset the panel' && !txt.includes('actuator at the trim') && (await row('System (gas)')) !== null);
  ok('El/El: the named path has a visible control and no trim-reset button', (await btn('Go to the releasing panel').count()) === 1 && (await btn('Reset actuator at the trim').count()) === 0);
  const ann = await ev(() => [...document.querySelectorAll('#sigs .sig')].map((e) => e.className + ' ' + e.innerText.replace(/\s+/g, ' ')).join(' / '));
  ok('annunciator: the latched P is an OPEN row, release input class not elected', /sig OPEN\s+OPEN RELEASE INPUT - CLASS NOT ELECTED: P LATCHED \(PSL-REL\)/.test(ann), ann.slice(0, 160));
  await press('Go to the releasing panel'); ok('El/El: the button lands on the panel, which has Silence and Panel reset', (await ev(() => DI.game.sel.id)) === r.pn && (await btn('Panel reset').count()) === 1 && (await btn('Silence').count()) === 1);
  await press('Panel reset'); await step(2); s = await st(r.v);
  ok('El/El: a panel reset before the air is back latches P again', s.pLatch === true && s.P < 20, 'P=' + s.P.toFixed(1));
  await step(1800, 1); await sel(r.pn); await press('Panel reset'); await step(5); s = await st(r.v);
  ok('El/El: with the air back the panel reset clears P', s.pLatch === false && s.set && s.P > 35);
  r = await rig('el-pn'); await breakFix(r); s = await st(r.v); txt = await side();
  ok('El/Pn: P latched, the valve names the trim reset only and shows its control', s.pLatch && (await row('P: pipe pressure')) === 'LATCHED - reset the actuator at the trim' && (await btn('Reset actuator at the trim').count()) === 1 && !(await btn('Reset actuator at the trim').first().isDisabled()) && (await btn('Go to the releasing panel').count()) === 0 && (await row('Solenoid (D alone)')) === 'de-energized');
  await step(1800, 1); await sel(r.pn); await press('Panel reset'); await step(5);
  ok('El/Pn: a panel reset does not clear P', (await st(r.v)).pLatch === true);
  await sel(r.v); await press('Reset actuator at the trim'); await step(5); s = await st(r.v);
  ok('El/Pn: the trim reset clears P, and the button goes idle', s.pLatch === false && (await btn('Reset actuator at the trim').first().isDisabled()));

  // ---- 3. dead panel + manual pull never releases
  r = await rig(); await ev((id) => { DI.game.W.power = false; DI.game.W.parts.get(id).p.battH = 0; }, r.pn); await step(2);
  await sel(r.st); await press('Operate station'); await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(300); await sel(r.v); s = await st(r.v);
  ok('dead panel + manual pull + P: the valve stays shut and the solenoid de-energized', s.state === 'dry' && s.wat === 0 && s.pLatch && !s.pull && !s.solOut && (await row('Solenoid (D AND P)')) === 'de-energized' && (await row('D: detection')) === 'normal');
  const dead = await ev(() => [...DI.game.S.sig.values()].filter((o) => o.type === 'TRBL').map((o) => o.text + (o.mon ? ' [monitored]' : '')).join());
  ok('dead panel: a monitored trouble reports the loss of signal', /PANEL DEAD.*loss of signal.*\[monitored\]/.test(dead), dead);
  await ev(() => { DI.game.W.power = true; }); await step(2); s = await st(r.v);
  ok('power back: the station is still operated, so D returns and D AND P releases', s.pull === true && s.state !== 'dry');

  // ---- 4. stage order at a fixed time step (A1)
  r = await rig(); await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(240);
  await ev((rm) => { document.getElementById('log').innerHTML = ''; const S = DI.game.S; for (let i = 0; i < 2; i++) { S.smoke[rm] = 5; S.step(0.25); } }, r.room); await tick();
  const log = await ev(() => [...document.querySelectorAll('#log div')].map((e) => e.innerText)), at = (w) => log.findIndex((l) => l.includes(w));
  const ord = ['VESDA ALERT', 'VESDA ACTION', 'VESDA FIRE 1', 'VESDA FIRE 2', 'latched detection (D)', 'TRIPPED'].map(at);
  ok('stage order: a jump to Fire 2 logs Alert, Action, Fire 1, Fire 2, then the release, at one time stamp', ord.every((i, k) => i >= 0 && (k === 0 || i > ord[k - 1])) && new Set(ord.slice(0, 4).map((i) => log[i].slice(0, 8))).size === 1, ord.join());
  const rows = await ev(() => [...document.querySelectorAll('#sigs .sig')].filter((e) => e.innerText.includes('VESDA')).map((e) => (e.classList.contains('sup') ? 'sup ' : '') + e.innerText.replace(/\s+/g, ' ')));
  ok('annunciator: every stage crossed is listed, the superseded ones marked', rows.length === 4 && rows.filter((x) => x.startsWith('sup ')).length === 3 && rows.some((x) => x.startsWith('ALARM VESDA FIRE 2')), rows.join(' / '));
  // the valve has tripped on D AND P with a head open: once the pipe is full the gauge label follows it (A4)
  await step(120); await sel(r.v); s = await st(r.v);
  ok('gauge label: System (gas) becomes System (water) after a trip and fill', s.state !== 'dry' && s.wat > 100 && (await row('System (water)')) !== null && (await row('System (gas)')) === null, (await row('System (water)')) + ', ' + Math.round(s.wat) + ' gal in the pipe');

  // ---- 5. mechanical release trips with D and P normal and resets only after drain; calc verdict (A3)
  r = await rig(); await sel(r.v);
  // hydraulic calc is never an unqualified PASS over a coverage failure (A3): this rig sprinklers half of the hall
  await press('Run hydraulic calc'); const calc = await ev(() => { const e = document.querySelector('#side .res b'); return e ? e.textContent : ''; });
  ok('calc: with the hall half covered the result is qualified or a fail', /^FAIL|^PASS \(hydraulics only\); coverage FAIL, see plan review/.test(calc) && !/^PASS ·/.test(calc), calc);
  const pre = [await row('D: detection'), await row('P: pipe pressure'), await row('System (gas)')];
  await press('Mechanical emergency release'); await step(120); await sel(r.v); s = await st(r.v);
  ok('mechanical release: trips with D and P both normal', pre[0] === 'normal' && pre[1] === 'normal' && pre[2] !== null && s.state !== 'dry' && !s.sol && !s.pull);
  ok('mechanical release with every head closed: water is in the pipe and the gauge says so', (await row('System (water)')) !== null && (await row('System (gas)')) === null);
  await press('Reset valve at the riser'); const refused = await ev(() => document.getElementById('banner').textContent); s = await st(r.v);
  ok('mechanical release: the riser reset is refused while the system holds water', s.state !== 'dry' && /still holds|still flowing/.test(refused), refused);
  await sel(r.g); await press('Close valve'); await step(8); await sel(r.v); await press('System drain'); await ev((id) => { const S = DI.game.S, s2 = S.ss.get(id); for (let t = 0; t < 2400 && s2.wat > 0.01 * s2.vol + 0.2; t += 0.5) S.step(0.5); }, r.v);
  await sel(r.v); await press('Reset valve at the riser'); await step(2); s = await st(r.v);
  ok('mechanical release: after the drain the riser reset closes the valve and the release', s.state === 'dry' && s.mech === false && (await row('System (gas)')) !== null);
  ok('and the empty pipe then reads low: P is latched until the air is back and the panel is reset', s.pLatch === true);


  // ---- 6. contract: the Manual Release zone bypass is a visible impairment
  await start('c5'); const imp = await ev(() => { const G = DI.game; DI.botBuild(G.S, 'c5'); G.W.cfg.manualReleaseBypassP = true; G.W.ver++; for (let i = 0; i < 8; i++) G.S.step(0.25); const v = G.W.byType('prev')[0];
    return { v: v.id, tag: DI.partState(G, v, 0).imp, sig: [...G.S.sig.values()].filter((o) => o.text.startsWith('IMPAIRMENT')).map((o) => o.type).join() }; });
  await sel(imp.v); await tick();
  ok('contract + bypass: supervisory on the panel, tag on the valve, tag row in the inspector', imp.tag === true && imp.sig === 'SUPV,SUPV,SUPV' && (await row('IMPAIRMENT TAG')) === 'Manual Release zone bypasses P' && (await btn('Manual station (shortcut').count()) === 0);
  const annImp = await ev(() => document.getElementById('sigs').innerText.replace(/\s+/g, ' '));
  ok('contract + bypass: the annunciator lists the impairment', annImp.includes('SUPV IMPAIRMENT - Manual Release zone bypasses P'), annImp.slice(0, 120));
  await p.screenshot({ path: process.argv[2] || 'ui-c2.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fail || errs.length ? (fail + ' FAILED, ' + errs.length + ' page errors') : 'all Cycle 2 UI checks passed');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
