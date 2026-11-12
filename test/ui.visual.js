// node test/ui.visual.js [out.png] — tactical HUD behavior and camera/plant separation.
// Uses the same browser/file entry point as the other UI suites; DI_BASE_URL is optional.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = process.env.DI_BASE_URL || 'file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html');
  const check = (label, value) => { assert.ok(value, label); console.log('ok   ' + label); };
  const waitHud = () => page.waitForTimeout(260);
  const plant = () => page.evaluate(() => JSON.stringify(DI.game.W.toJSON()));
  const key = async value => { await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press(value); await waitHud(); };
  try {
    await page.goto(url);
    await page.waitForSelector('.card[data-sc="c1"]');
    check('tactical HUD is hidden on the campaign menu', await page.locator('#tactical').isHidden());
    await page.click('.card[data-sc="c1"]');
    await page.click('#mGo');
    await page.evaluate(() => DI.setSpeed(0));
    await waitHud();
    check('map controls and minimap are available in play', await page.locator('#viewControls').isVisible() && await page.locator('#campusMap').isVisible());
    check('grid scale distinguishes visual guides from building cells', /5 ft guides.*10 ft build/.test(await page.locator('.view-scale').innerText()));

    const original = await plant();
    await page.click('#vGrid');
    check('detail guides can be turned off', await page.locator('#vGrid').getAttribute('aria-pressed') === 'false' && await page.evaluate(() => DI.game.viewGrid === false));
    await page.click('#vGrid');
    check('detail guides can be restored', await page.locator('#vGrid').getAttribute('aria-pressed') === 'true');
    check('grid controls preserve plant geometry, budget and settings', await plant() === original);

    const mini = await page.locator('#campusMap').boundingBox();
    await page.mouse.click(mini.x + mini.width * 0.8, mini.y + mini.height * 0.7);
    const nav = await page.evaluate(() => ({ x: DI.game.cam.x / DI.game.W.w, y: DI.game.cam.y / DI.game.W.h }));
    check('clicking the minimap navigates to the corresponding campus position', Math.abs(nav.x - 0.8) < 0.02 && Math.abs(nav.y - 0.7) < 0.02);
    await page.locator('#campusMap').focus();
    const x0 = await page.evaluate(() => DI.game.cam.x);
    await page.keyboard.press('ArrowLeft');
    check('minimap supports keyboard navigation without building', await page.evaluate(() => DI.game.cam.x) < x0 && await plant() === original);

    // A remote pipe is a fixture: Fit must include player construction outside the original building envelope.
    await page.evaluate(() => { DI.game.W.setPipe(42, 24, 6, 0); DI.game.S.sync(); });
    const extended = await plant();
    await key('f');
    const fitted = await page.evaluate(() => {
      const g = DI.game, x = innerWidth / 2 + (42.5 - g.cam.x) * g.cam.z, y = innerHeight / 2 + (24.5 - g.cam.y) * g.cam.z;
      return x > document.getElementById('ann').getBoundingClientRect().right && x < document.getElementById('side').getBoundingClientRect().left && y > 100 && y < document.getElementById('tools').getBoundingClientRect().top;
    });
    check('Fit campus includes remote construction in the playable area', fitted);
    check('camera fitting does not edit the plant', await plant() === extended);
    const zoom = await page.evaluate(() => DI.game.cam.z);
    await page.click('#vIn');
    check('zoom buttons change camera magnification', await page.evaluate(() => DI.game.cam.z) > zoom);

    // Selecting the real city supply should teach its hydraulic principle and link to the correct chapter.
    await page.evaluate(() => { const g = DI.game; g.sel = { kind: 'part', id: g.W.byType('city')[0].id }; DI.inspect.render(true); });
    await waitHud();
    check('field coaching follows the selected equipment', /Start with the source/.test(await page.locator('#coachTitle').innerText()));
    await page.click('#coachMore');
    check('the coaching link opens the relevant manual chapter', await page.locator('#mbox nav button.on').getAttribute('data-m') === 'hyd');
    await page.click('#mGo');

    await key('h');
    check('photo mode hides the interface and exposes a restore control', await page.locator('#top').isHidden() && await page.locator('#tools').isHidden() && await page.locator('#restoreHud').isVisible());
    await page.click('#restoreHud');
    check('the interface can be restored by mouse', await page.locator('#top').isVisible() && await page.locator('#tools').isVisible());
    await key('h'); await key('h');
    check('photo mode can also be restored by keyboard', await page.locator('#top').isVisible() && await plant() === extended);

    await page.setViewportSize({ width: 1366, height: 768 });
    await waitHud();
    await page.click('#vFit');
    check('map controls remain reachable on a laptop viewport', await page.locator('#vFit').isVisible() && await page.locator('#bMenu').isVisible());
    await page.click('#bMenu');
    await waitHud();
    check('returning to the menu removes the tactical overlay', await page.locator('#tactical').isHidden());
    await page.click('.card[data-sc="c1"]');
    if (await page.locator('#mGo').isVisible()) await page.click('#mGo');
    await page.evaluate(() => DI.setSpeed(0));
    await waitHud();
    check('a saved game resumes with its HUD intact', await page.locator('#viewControls').isVisible());
    await page.screenshot({ path: process.argv[2] || '/tmp/di-visual.png' });
    // The all-parts toolbar wraps onto more rows on smaller screens. Navigation must sit above it.
    for (const height of [768, 600]) {
      await page.setViewportSize({ width: 1024, height });
      await page.evaluate(() => { DI.startScenario('c7', true); DI.ui.close(); DI.setSpeed(0); DI.game.cam.x = 1000; });
      await waitHud();
      const available = await page.evaluate(() => {
        const button = document.getElementById('vFit'), rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return document.getElementById('viewControls').getBoundingClientRect().bottom < document.getElementById('tools').getBoundingClientRect().top && button.contains(hit);
      });
      check('map controls clear the wrapped toolbar and receive clicks at 1024×' + height, available);
      await page.click('#vFit');
      check('Fit navigates back to the campus at 1024×' + height, await page.evaluate(() => DI.game.cam.x < DI.game.W.w));
    }
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.evaluate(() => {
      DI.startScenario('c7', true); DI.ui.close(); DI.setSpeed(0);
      for (let i = 0; i < 5; i++) DI.bus.emit('log', 'Commissioning record ' + (i + 1) + ': verify valve supervision and confirm that the protected area is back in service.', 'warn');
    });
    await waitHud();
    check('growing event logs never overlap the campus navigator', await page.evaluate(() => {
      const nav = document.getElementById('campusNav'), rect = nav.getBoundingClientRect();
      return !rect.height || rect.top > document.getElementById('ann').getBoundingClientRect().bottom;
    }));

    // A filling-system fixture must show water near the riser and gas ahead of its advancing front.
    const front = await page.evaluate(() => {
      DI.startScenario('c6', true); DI.ui.close(); DI.setSpeed(0);
      const g = DI.game, S = g.S, W = g.W, [id, state] = [...S.ss][0], tiles = [];
      for (let k = 0; k < W.pd.length; k++) if (W.pd[k] && !W.partAt[k] && S.sysd.tileSys[k] === id) tiles.push({ k, reach: S.sysd.reach(id, k) });
      tiles.sort((a, b) => a.reach - b.reach);
      const near = tiles[0], far = tiles[tiles.length - 1];
      state.state = 'filling'; state.wat = state.vol * (near.reach + far.reach) / 2;
      g.cam.x = 1000; DI.tactical.drawMap();
      const canvas = document.getElementById('campusMap'), context = canvas.getContext('2d');
      const sample = k => [...context.getImageData(Math.floor((k % W.w + 0.25) * canvas.width / W.w), Math.floor((Math.floor(k / W.w) + 0.25) * canvas.height / W.h), 1, 1).data];
      return { near: sample(near.k), far: sample(far.k), ordered: near.reach < far.reach };
    });
    check('the minimap distinguishes water from gas while a system fills', front.ordered && front.near[2] > front.near[0] && front.far[0] > front.far[2]);
    check('no browser errors', errors.length === 0);
    console.log('all tactical HUD checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
