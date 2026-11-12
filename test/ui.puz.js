// node test/ui.puz.js [out.png] - field call (puzzle) browser checks (Playwright), with real mouse events: the Field
// Calls and Design Calls sections of the menu and their lock order, the briefing with records and variants, a hint that moves the camera,
// a wrong and a right diagnosis, the repair itself drawn with the Main tool, the flow test from the inspector, the
// scorecard and the three-way comparison (your fix, the cheapest, the easily maintained), progress and variant stars,
// "Turn end for end" on a check valve, the Cap tool on a test blank at a pump inlet, a save and reload in the middle of
// a call, the drill commissioning record (contract 3), and the design calls: the briefing's constraints and decision,
// the Answer button, call 9 solved with the Main tool, the part limit refused at the build tool (call 11) and inherited
// material refunding nothing (call 14). One screenshot per panel, beside the one named on the
// command line. The game is paused and sim time is advanced by hand (S.warp) where a test would take long.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  const url = 'file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html');
  const out = process.argv[2] || 'ui-puz.png', shot = (tag) => p.screenshot({ path: tag ? out.replace(/(\.png)?$/, '-' + tag + '.png') : out });
  await p.goto(url); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(400);
  const ev = (fn, arg) => p.evaluate(fn, arg), tick = () => p.waitForTimeout(450);
  const text = (q) => ev((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, q);
  const xy = (x, y) => ev(([x, y]) => { const G = DI.game; return [innerWidth / 2 + (x + 0.5 - G.cam.x) * G.cam.z, innerHeight / 2 + (y + 0.5 - G.cam.y) * G.cam.z]; }, [x, y]);
  const drag = async (x0, y0, x1, y1) => { const a = await xy(x0, y0), c = await xy(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); };
  const click = async (x, y, fx, fy) => { const a = await xy(x, y), z = await ev(() => DI.game.cam.z); await p.mouse.move(a[0] + (fx || 0) * z, a[1] + (fy || 0) * z); await p.mouse.down(); await p.mouse.up(); };
  const pause = () => ev(() => DI.setSpeed(0));
  const btn = (t) => p.locator('#side button', { hasText: t }).first();
  const press = async (t) => { const e = btn(t); await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e.click(); await tick(); };
  const warp = (s) => ev((sec) => { DI.game.S.warp(sec); DI.puzTick(DI.game.S); }, s);

  // 1. the menu: eight find-the-fault calls and eight design calls, two tracks, the first of each open
  await p.waitForSelector('.card.puz');
  const cards = await ev(() => [...document.querySelectorAll('.card.puz')].map((e) => (e.disabled ? 'L' : 'O') + ':' + e.querySelector('b').textContent));
  ok('menu: sixteen calls in two tracks, the first of each open and the rest locked in order', cards.length === 16 && cards[0].startsWith('O') && cards[8].startsWith('O') && cards.slice(1, 8).every((c) => c.startsWith('L')) && cards.slice(9).every((c) => c.startsWith('L')) && /DESIGN CALLS · STRONG CONSTRAINTS/.test(await text('#mbox')) && (await ev(() => document.querySelectorAll('.card.puz.design').length)) === 8, cards.join(' | '));
  await shot('menu');

  // 2. call 1, variant A: the briefing shows the records, the question, the variants
  await p.click('.card.puz[data-pz="p1"]'); await tick();
  const brief = await text('#mbox');
  ok('briefing: field call, records, the question, the scoring and three variants', /FIELD CALL 1/.test(brief) && /RECORDS/.test(brief) && /THE QUESTION/.test(brief) && /HOW IT IS SCORED/.test(brief) && (await ev(() => document.querySelectorAll('#mbox button[data-vi]').length)) === 3, brief.slice(0, 160));
  await shot('brief');
  await p.click('#mGo'); await tick(); await pause();
  ok('top bar: Hint and Diagnose shown in a call, Run drill hidden', await ev(() => getComputedStyle(document.getElementById('bHint')).display !== 'none' && getComputedStyle(document.getElementById('bDiag')).display !== 'none' && getComputedStyle(document.getElementById('bDrill')).display === 'none'));
  ok('inspector home: the question and the running scorecard', /Why does the pump stall/.test(await text('#side')) && /Edits/.test(await text('#side')));

  // 3. a hint: shown, counted, and the camera goes to it
  const cam0 = await ev(() => [DI.game.cam.x, DI.game.cam.y]);
  await p.click('#bHint'); await tick(); await p.click('#mHint'); await tick();
  const cam1 = await ev(() => [DI.game.cam.x, DI.game.cam.y]);
  ok('hint 1: shown in the dialog, counted, and the camera moved to the pump house', (await text('#mbox')).includes('Start at the pump house') && (await ev(() => DI.game.S.puz.hints)) === 1 && (cam0[0] !== cam1[0] || cam0[1] !== cam1[1]), cam1.join(','));
  await ev(() => DI.ui.close()); await tick();

  // 4. the flow test fails first (the fault is real), then the repair with the Main tool
  await ev(() => { const S = DI.game.S; DI.game.sel = { kind: 'part', id: S.W.byType('epump')[0].id }; DI.inspect.render(true); }); await tick();
  await press('Flow test (3-point)'); await warp(420); await tick();
  const r0 = await ev(() => { const r = DI.lastResult(DI.game.S, 'pump'); return r && r.pass; });
  ok('the flow test fails before the repair', r0 === false);
  await ev(() => { DI.game.sel = null; DI.inspect.render(true); }); await p.keyboard.press('1'); await p.click('.tb.sz >> text="8\\""'); await drag(16, 12, 16, 12); await tick();
  ok('the Main tool over the narrow tile: one edit, about $730', (await ev(() => DI.puzStatus(DI.game.S).edits)) === 1 && Math.abs((await ev(() => DI.puzSpent(DI.game.S))) - 730) < 5);
  await p.keyboard.press('q'); await ev(() => { const S = DI.game.S; DI.game.sel = { kind: 'part', id: S.W.byType('epump')[0].id }; DI.inspect.render(true); }); await tick();
  await press('Flow test (3-point)'); await warp(420); await tick();
  ok('the flow test passes after the repair', await ev(() => DI.lastResult(DI.game.S, 'pump').pass));
  await ev(() => { DI.game.S.calc.set(DI.game.S.W.byType('wetv')[0].id, DI.hydCalc(DI.game.S, DI.game.S.W.byType('wetv')[0].id)); });

  // 5. the diagnosis: one wrong pick, then the right one
  await p.click('#bDiag'); await tick();
  await p.locator('#mbox button.dg', { hasText: 'worn' }).click(); await tick();
  ok('a wrong diagnosis: answered with why, counted, and the option is struck', (await ev(() => DI.game.S.puz.diag.tries)) === 1 && /Churn was 120 psi net/.test(await text('#mbox')));
  await p.locator('#mbox button.dg', { hasText: '2 in. pipe' }).click(); await tick();
  ok('the right diagnosis closes the question', await ev(() => DI.game.S.puz.diag.ok));
  await shot('diagnose');

  // 6. solved: the report replaces the diagnosis dialog within a slow-loop pass (the game is paused: goals still update)
  for (let i = 0; i < 10 && !/Fault found/i.test(await text('#mbox')); i++) await p.waitForTimeout(400);
  ok('the report opens by itself once every goal is met', await ev(() => DI.ui.modalOpen && /Fault found/i.test(document.getElementById('mbox').innerText)));
  const rep = await text('#mbox');
  ok('report: fault found and fixed, the scorecard, the fault explained', /Fault found and fixed/i.test(rep) && /Edits: 1 \(fewest needed: 1\)/.test(rep) && /right on try 2/.test(rep) && /THE FAULT/.test(rep), rep.slice(0, 200));
  ok('report: three fixes compared, each with a drawn layout', (await ev(() => document.querySelectorAll('.cmpc canvas').length)) === 3 && /Cheapest/.test(rep) && /Easily maintained/.test(rep));
  const drawn = await ev(() => { const c = document.querySelector('#pzc2'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let amb = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 160 && d[i + 1] < 200 && d[i + 2] < 60) amb++; return amb; });
  ok('the maintained fix thumbnail rings its edits in amber', drawn > 50, drawn);
  ok('report: two stars (the diagnosis took two tries), progress saved with the variant', (await ev(() => DI.game.prog.done.p1 && DI.game.prog.done.p1.v.A)) === 2);
  await shot('report');

  // 7. the next call is unlocked; call 2 variant A: Turn end for end on the pump
  await p.click('#mNextP'); await tick(); await p.click('#mGo'); await tick(); await pause();
  await ev(() => { const S = DI.game.S; DI.game.sel = { kind: 'part', id: S.W.byType('epump')[0].id }; DI.inspect.render(true); }); await tick();
  const rot0 = await ev(() => DI.game.S.W.byType('epump')[0].rot);
  await press('Turn end for end');
  ok('Turn end for end: the pump is reversed in place, one edit, the same part', (await ev(() => DI.game.S.W.byType('epump')[0].rot)) === (rot0 + 2) % 4 && (await ev(() => DI.puzStatus(DI.game.S).edits)) === 1 && await ev(() => DI.game.S.W.byType('epump')[0].p.orig === 1));

  // 8. a save and reload in the middle of a call keeps its state
  await p.click('#bHint'); await tick(); await p.click('#mHint'); await tick(); await ev(() => DI.ui.close());
  await ev(() => DI.saveGame()); await p.reload(); await p.waitForTimeout(400);
  await p.click('.card.puz[data-pz="p2"]'); await tick(); await pause();
  ok('reload: the call resumes with its hint, its edit and its variant', (await ev(() => [DI.game.S.puz.hints, DI.puzStatus(DI.game.S).edits, DI.game.sc.vi].join())) === '1,1,0');

  // 9. variant B of call 2: the test blank shows as a cap at the pump inlet, and the Cap tool removes it
  await ev(() => { DI.startScenario('p2', true, 1); DI.ui.close(); DI.setSpeed(0); }); await tick();
  await ev(() => { const G = DI.game; G.cam.x = 11; G.cam.y = 12; G.cam.z = 40; }); await tick();
  await shot('blank');
  await p.keyboard.press('6'); await click(10, 12, 0.45, 0); await tick();
  ok('Cap tool on the joint at the pump inlet removes the test blank: one edit', (await ev(() => DI.game.W.cut[DI.game.W.k(10, 12) * 2])) === 0 && (await ev(() => DI.puzStatus(DI.game.S).edits)) === 1);

  // 10. a locked call cannot be opened from the menu; Unlock all opens every call
  await ev(() => DI.ui.showMenu()); await tick();
  const locked = await ev(() => document.querySelector('.card.puz[data-pz="p5"]').disabled);
  await p.click('#mUnlock'); await tick();
  ok('locked in order, and Unlock all opens every call', locked && (await ev(() => [...document.querySelectorAll('.card.puz')].every((e) => !e.disabled))));

  // 11. the drill commissioning record (contract 3): goals taken at the drill start hold through the fire
  const rec = await ev(() => { DI.startScenario('c3', true); DI.ui.close(); const G = DI.game, S = G.S; DI.setSpeed(0);
    const sol = DI.BOT_LAYOUT ? null : null; return !!S; });
  ok('contract 3 opens', rec);
  await ev(() => { const G = DI.game; G.goalOk = G.sc.goals.map(() => true); const S = G.S; DI.startDrill(S, G.sc.drill, G.goalOk.slice()); for (const p of S.W.byType('jockey')) p.p.auto = false; S.warp(300); });
  await p.waitForTimeout(1300);
  ok('during the drill the goals read the commissioning record, not the live plant', await ev(() => DI.game.goalOk.every(Boolean) && DI.game.S.drill.goals0.length === DI.game.sc.goals.length));

  // 12. design call 9, variant A: the briefing shows the constraints, the decision and what the call builds on
  await ev(() => { DI.ui.showMenu(); }); await tick();
  await p.click('.card.puz[data-pz="p9"]'); await tick();
  const b9 = await text('#mbox');
  ok('design briefing: design call, the constraints, the decision, builds on, Answer', /DESIGN CALL 9/.test(b9) && /THE CONSTRAINTS/.test(b9) && /THE DECISION/.test(b9) && /BUILDS ON/.test(b9) && /Answer it with Answer on the top bar/.test(b9) && (await ev(() => !!document.querySelector('#mbox .decision'))), b9.slice(0, 200));
  await shot('design-brief');
  await p.click('#mGo'); await tick(); await pause();
  ok('design call: the top bar reads Answer, the inspector shows the decision', (await ev(() => document.getElementById('bDiag').textContent)) === 'Answer' && /THE DECISION/.test(await text('#side')));
  // the fix with the Main tool: 4 in. over the first twelve tiles of the 3 in. feed main
  await ev(() => { const G = DI.game; G.cam.x = 10; G.cam.y = 12; G.cam.z = 26; DI.game.sel = null; DI.inspect.render(true); }); await tick();
  await p.keyboard.press('1'); await p.click('.tb.sz >> text="4\\""'); await drag(4, 12, 15, 12); await tick(); await p.keyboard.press('q');
  ok('design call 9: twelve tiles of 4 in. feed, twelve edits, $1,320', (await ev(() => DI.puzStatus(DI.game.S).edits)) === 12 && (await ev(() => DI.puzSpent(DI.game.S))) === 1320);
  await ev(() => { const S = DI.game.S; DI.game.sel = { kind: 'part', id: S.W.byType('wetv')[0].id }; DI.inspect.render(true); }); await tick();
  await press('Run hydraulic calc');
  ok('design call: the riser’s calc is the one the goal reads, at the most demanding of every branch line end', /PASS/.test(await text('#side')) && /Most demanding of \d+ areas checked/.test(await text('#side')) && (await ev(() => DI.game.calcShow && DI.game.calcShow.tiles.length > 0)));
  await ev(() => { DI.game.sel = null; DI.game.calcShow = null; DI.inspect.render(true); }); await tick();
  await p.click('#bDiag'); await tick();
  ok('the answer dialog: THE ANSWER, pick the answer', /THE ANSWER/.test(await text('#mbox')) && /Pick the answer/.test(await text('#mbox')));
  await p.locator('#mbox button.dg', { hasText: 'whole demand' }).click(); await tick();
  for (let i = 0; i < 12 && !/Design accepted/i.test(await text('#mbox')); i++) await p.waitForTimeout(400);
  const r9 = await text('#mbox');
  ok('design report: design accepted, three stars, the answer explained, the cheapest fix compared', /Design accepted/i.test(r9) && /Answer: right the first time/.test(r9) && /THE ANSWER/.test(r9) && /Cheapest: Half the feed main/.test(r9) && (await ev(() => DI.game.prog.done.p9 && DI.game.prog.done.p9.v.A)) === 3, r9.slice(0, 220));
  await shot('design-report');

  // 13. design call 11, variant A: the part limit is refused at the build tool
  await ev(() => { DI.startScenario('p11', true, 0); DI.ui.close(); DI.setSpeed(0); const G = DI.game; G.cam.x = 8; G.cam.y = 10; G.cam.z = 30; }); await tick();
  await ev(() => DI.ui.setTool('part', 'prev')); await click(7, 6); await click(7, 17); await tick();
  const n2 = await ev(() => DI.game.W.byType('prev').length);
  await click(7, 8); await tick();
  const ban = await ev(() => document.getElementById('banner').textContent);
  ok('limits: two more preaction valves place, a fourth is refused with the constraint named', n2 === 3 && (await ev(() => DI.game.W.byType('prev').length)) === 3 && /at most 3 preaction valves/.test(ban), ban);
  await ev(() => DI.ui.setTool('select')); await tick();
  ok('limits: the inspector home shows the count against the limit', /3 of 3 preaction valves/.test(await text('#side')));

  // 14. design call 14, variant A: inherited pipe refunds nothing; pipe laid in the call refunds in full
  await ev(() => { DI.startScenario('p14', true, 0); DI.ui.close(); DI.setSpeed(0); const G = DI.game; G.cam.x = 9; G.cam.y = 13; G.cam.z = 30; }); await tick();
  const m0 = await ev(() => DI.game.W.money);
  await p.keyboard.press('x'); await drag(8, 12, 8, 12); await tick();
  const m1 = await ev(() => DI.game.W.money);
  await p.keyboard.press('1'); await p.click('.tb.sz >> text="4\\""'); await drag(8, 12, 8, 12); await tick();
  const m2 = await ev(() => DI.game.W.money);
  await p.keyboard.press('x'); await drag(8, 12, 8, 12); await tick();
  const m3 = await ev(() => DI.game.W.money);
  ok('salvage: erasing an inherited tile refunds nothing, a new 4 in. tile costs $400, erasing it refunds $400', m1 === m0 && m2 === m0 - 400 && m3 === m0, [m0, m1, m2, m3].join(' / '));
  await p.keyboard.press('q'); await ev(() => { const S = DI.game.S; DI.game.sel = { kind: 'part', id: S.W.at(3, 12).id }; DI.inspect.render(true); }); await tick();
  ok('salvage: the inspector offers the inherited riser for a refund of $0', /Remove \(refund \$0\)/.test(await text('#side')));
  ok('salvage: the scorecard counts the starting pipe kept', /Starting pipe kept/.test(await ev(() => { DI.game.sel = null; DI.inspect.render(true); return document.getElementById('side').innerText; })));

  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fail++;
  console.log(fail ? fail + ' FAILED' : 'all field call UI checks passed'); await b.close(); process.exit(fail ? 1 : 0);
})();
