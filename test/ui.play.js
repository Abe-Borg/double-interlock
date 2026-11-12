// node test/ui.play.js [out.png] - plays contract 1 with real mouse and keyboard events (no bot).
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  await p.click('.card[data-sc="c1"]'); await p.waitForTimeout(200); await p.click('#mGo'); await p.waitForTimeout(200);
  const xy = (x, y) => p.evaluate(([x, y]) => { const G = DI.game; return [innerWidth / 2 + (x + 0.5 - G.cam.x) * G.cam.z, innerHeight / 2 + (y + 0.5 - G.cam.y) * G.cam.z]; }, [x, y]);
  const drag = async (x0, y0, x1, y1) => { const a = await xy(x0, y0), c = await xy(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); };
  const click = async (x, y) => { const a = await xy(x, y); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.up(); };
  const part = async (name, x, y) => {
    const category = await p.evaluate((n) => Object.values(DI.PARTS).find((q) => q.name.startsWith(n)).cat, name);
    await p.click('[data-category="' + category + '"]');
    await p.click('.tb[title^="' + name + '"]'); await click(x, y);
  };
  const size = async (n) => { await p.click('.tb.sz >> text="' + n + '"'); };
  await p.keyboard.press('1'); await size('4"'); await drag(3, 12, 4, 12); await part('Backflow Preventer', 5, 12);
  await p.keyboard.press('1'); await drag(6, 12, 6, 12); await part('Control Valve', 7, 12); await part('Wet Riser', 8, 12);
  await p.keyboard.press('1'); await drag(9, 12, 19, 12); await size('3"'); await drag(20, 6, 20, 17);
  await size('1¼"'); await drag(10, 10, 10, 11); await drag(10, 13, 10, 13);
  await part('Releasing Panel', 8, 10);
  await p.keyboard.press('2'); await drag(9, 12, 19, 12); await drag(20, 6, 20, 17); await drag(10, 10, 10, 13);
  await drag(11, 6, 19, 11); await drag(11, 13, 19, 17); await drag(21, 6, 28, 17); await drag(8, 10, 9, 11); await drag(8, 13, 9, 13);
  await part('Fire Dept. Connection', 6, 14); await part('Check Valve', 7, 14); await p.keyboard.press('1'); await size('4"'); await drag(8, 14, 9, 13);
  await p.keyboard.press('5'); await click(8, 10); await click(7, 12); await click(8, 12);
  await p.keyboard.press('q'); await click(8, 12); await p.waitForTimeout(300);
  const info = await p.evaluate(() => { const G = DI.game; return { money: G.W.money, parts: [...G.W.parts.values()].map((q) => q.type + '@' + q.x + ',' + q.y + 'r' + q.rot).join(' '), wires: G.W.wires.length, heads: G.W.spk.reduce((a, v) => a + (v ? 1 : 0), 0), sel: G.sel }; });
  console.log(JSON.stringify(info));
  await p.click('.sp[data-sp="20"]'); await p.waitForTimeout(6000);                      // let the system fill
  await p.click('#side button:has-text("Run hydraulic calc")'); await p.waitForTimeout(300);
  await p.click('#side button:has-text("Inspector’s test (timed)")'); await p.waitForTimeout(300);
  console.log('after itc click:', await p.evaluate(() => JSON.stringify({ procs: DI.game.S.procs.map((q) => q.kind), banner: document.getElementById('banner').textContent, st: [...DI.game.S.ss.values()].map((s) => s.state + ':' + Math.round(s.wat) + '/' + Math.round(s.vol)) }))); await p.waitForTimeout(4500);
  await p.click('#side button:has-text("Main drain test")'); await p.waitForTimeout(4000);
  const g1 = await p.evaluate(() => ({ goals: DI.game.goalOk, rv: DI.game.S.rv.filter((f) => f.sev !== 'ok').map((f) => f.text.slice(0, 70)), res: DI.game.S.results.map((r) => r.title + ':' + r.pass), t: DI.game.S.t }));
  console.log(JSON.stringify(g1));
  await p.click('#bDrill'); await p.waitForTimeout(200); await p.click('#mGo'); await p.click('.sp[data-sp="120"]'); await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[2] || 'ui.png' });
  for (let i = 0; i < 20 && !(await p.evaluate(() => DI.ui.modalOpen)); i++) await p.waitForTimeout(1500);
  console.log('report:', (await p.evaluate(() => document.getElementById('mbox').innerText)).replace(/\n+/g, ' | ').slice(0, 400));
  await p.screenshot({ path: (process.argv[2] || 'ui.png').replace('.png', '-report.png') });
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
  if (!g1.goals.every(Boolean)) { console.error('Contract 1 build did not meet every goal; check for controls covering the canvas.'); process.exitCode = 1; }
  if (errs.length) process.exitCode = 1;
})();
