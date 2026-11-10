// node test/shot.js <scenario|menu> <out.png> [js to eval after start]   - headless smoke test + screenshot
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [sc, out, js] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'))); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html'));
  await p.waitForTimeout(400);
  await p.addScriptTag({ path: path.resolve(__dirname, 'bot.js') });
  if (sc && sc !== 'menu') { await p.evaluate((id) => { DI.startScenario(id, true); DI.ui.close(); }, sc); await p.waitForTimeout(600); }
  if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log('eval ->', typeof r === 'string' ? r : JSON.stringify(r)); await p.waitForTimeout(1200); }
  if (process.env.WAIT) await p.waitForTimeout(+process.env.WAIT);
  await p.screenshot({ path: out }); console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
