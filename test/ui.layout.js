// node test/ui.layout.js [out.png] - Playwright checks for the expanded play area.
// Uses real controls and pointer events; the simulation is paused for repeatability.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await page.goto('file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html'));
    await page.waitForFunction(() => !!globalThis.DI?.ui && !!DI.game);
    const start = async (id) => {
      await page.evaluate((sc) => { DI.startScenario(sc, true); DI.ui.close(); DI.setSpeed(0); }, id);
      await page.waitForTimeout(300);
    };
    const xy = (x, y) => page.evaluate(([x, y]) => {
      const c = DI.game.cam;
      return { x: innerWidth / 2 + (x + 0.5 - c.x) * c.z, y: innerHeight / 2 + (y + 0.5 - c.y) * c.z };
    }, [x, y]);
    const checkFit = async () => {
      const bounds = await page.evaluate(() => {
        const G = DI.game, c = G.cam, rooms = G.W.rooms;
        const left = Math.min(...rooms.map((r) => r.x)), right = Math.max(...rooms.map((r) => r.x + r.w));
        const top = Math.min(...rooms.map((r) => r.y)), bottom = Math.max(...rooms.map((r) => r.y + r.h));
        const header = document.getElementById('top').getBoundingClientRect();
        const toolbar = document.getElementById('tools').getBoundingClientRect();
        const inspector = document.getElementById('side').getBoundingClientRect();
        return { left: innerWidth / 2 + (left - c.x) * c.z, right: innerWidth / 2 + (right - c.x) * c.z,
          top: innerHeight / 2 + (top - c.y) * c.z, bottom: innerHeight / 2 + (bottom - c.y) * c.z,
          width: innerWidth, inspectorLeft: inspector.width ? inspector.left : innerWidth,
          headerBottom: header.bottom, toolbarTop: toolbar.height ? toolbar.top : innerHeight };
      });
      assert.ok(bounds.left >= 0 && bounds.right <= bounds.width, 'Fit keeps the entire campus within the window horizontally: ' + JSON.stringify(bounds));
      assert.ok(bounds.top >= bounds.headerBottom && bounds.bottom <= bounds.toolbarTop, 'Fit keeps the campus between the header and toolbar: ' + JSON.stringify(bounds));
      assert.ok(bounds.right <= bounds.inspectorLeft, 'Fit keeps the campus clear of an open inspector: ' + JSON.stringify(bounds));
    };

    await start('s0');
    assert.equal(await page.locator('#side').isVisible(), false, 'Inspector does not consume the play area until something is selected');
    const categories = await page.evaluate(() => DI.CATS.filter((cat) => DI.game.sc.parts.some((p) => DI.PARTS[p].cat === cat.id)).map((cat) => ({ id: cat.id, parts: DI.game.sc.parts.filter((p) => DI.PARTS[p].cat === cat.id).map((p) => DI.PARTS[p].name) })));
    for (const cat of categories) {
      await page.click('[data-category="' + cat.id + '"]');
      for (const name of cat.parts) {
        await page.click('.tb[title^="' + name.replace(/["\\]/g, '\\$&') + '"]');
        assert.equal(await page.evaluate(() => DI.PARTS[DI.game.tool.part]?.name), name, name + ' can be selected from its equipment category');
      }
    }
    console.log('ok   Every sandbox equipment category remains available');
    if (await page.locator('#bAnnToggle').getAttribute('aria-expanded') === 'false') await page.click('#bAnnToggle');
    const annBefore = await page.locator('#ann').boundingBox();
    await page.click('#bAnnToggle');
    const annAfter = await page.locator('#ann').boundingBox();
    assert.ok(annAfter.height < annBefore.height, 'Collapsing the annunciator frees canvas space');
    assert.ok(await page.locator('#annState').isVisible(), 'Collapsed annunciator keeps the system state visible');
    console.log('ok   Annunciator collapses while retaining its status');

    await page.click('#bFocus');
    assert.equal(await page.locator('body').evaluate((e) => e.classList.contains('focus-view')), true);
    assert.equal(await page.locator('#tools').isVisible(), false, 'Focus view removes the equipment dock');
    await page.keyboard.press('f');
    assert.equal(await page.locator('body').evaluate((e) => e.classList.contains('focus-view')), false);
    assert.equal(await page.locator('#tools').isVisible(), true);
    console.log('ok   Focus button and keyboard shortcut restore the tools');

    await start('c1');
    await page.click('#bFit');
    await checkFit();
    await page.keyboard.press('1');
    await page.locator('.tb.sz').filter({ hasText: /^4"$/ }).click();
    const a = await xy(3, 12), b = await xy(4, 12);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
    assert.equal(await page.evaluate(() => !!DI.game.W.pd[DI.game.W.k(3, 12)] && !!DI.game.W.pd[DI.game.W.k(4, 12)]), true, 'Dragging still builds pipe on the intended tiles');
    const cat = await page.evaluate(() => DI.PARTS.bfp.cat);
    await page.click('[data-category="' + cat + '"]');
    await page.click('.tb[title^="Backflow Preventer"]');
    const target = await xy(5, 12); await page.mouse.click(target.x, target.y);
    assert.equal(await page.evaluate(() => DI.game.W.at(5, 12)?.type), 'bfp', 'Equipment placement uses the same coordinates as the fitted canvas');
    assert.equal(await page.locator('#side').isVisible(), false, 'Construction leaves the play area clear for the next placement');
    await page.keyboard.press('q'); await page.mouse.click(target.x, target.y);
    assert.equal(await page.locator('#side').isVisible(), true, 'Selecting equipment opens its inspector');
    await page.keyboard.press('f'); await page.click('#bFit');
    assert.equal(await page.locator('#side').isVisible(), true, 'Focus view keeps selected equipment controls usable');
    await checkFit();
    await page.keyboard.press('f');
    await page.keyboard.press('2');
    const edgeA = await xy(28, 6), edgeB = await xy(28, 17);
    await page.mouse.move(edgeA.x, edgeA.y); await page.mouse.down(); await page.mouse.move(edgeB.x, edgeB.y, { steps: 4 }); await page.mouse.up();
    assert.equal(await page.evaluate(() => Array.from({ length: 12 }, (_, i) => DI.game.W.spk[DI.game.W.k(28, 6 + i)]).every(Boolean)), true, 'Switching from inspection to building leaves the right edge of the room available');
    console.log('ok   Pipe drawing and equipment placement hit their intended tiles');

    await page.keyboard.press('q');
    await page.evaluate(() => { DI.game.sel = null; DI.inspect.render(true); });
    for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => { DI.game.cam.x += 30; DI.game.cam.y -= 20; DI.game.cam.z = 56; });
      await page.keyboard.press('Home');
      await checkFit();
      const clipped = await page.locator('#top button, #workspaceBar button, #viewControls button').evaluateAll((buttons) => buttons.filter((button) => {
        const r = button.getBoundingClientRect();
        return r.width > 0 && (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight);
      }).map((button) => button.id || button.textContent));
      assert.deepEqual(clipped, [], 'Shell controls remain within the ' + viewport.width + ' × ' + viewport.height + ' window');
    }
    console.log('ok   Home refits the campus after pan, zoom, and window resize');
    // A panel that was hidden while the toolbar laid out still needs the correct height when opened.
    await page.setViewportSize({ width: 1024, height: 768 });
    await start('c5');
    await page.addScriptTag({ path: path.resolve(__dirname, 'bot.js') });
    await page.evaluate(() => {
      DI.botBuild(DI.game.S, 'c5');
      DI.game.sel = { kind: 'part', id: DI.game.W.byType('prev')[0].id };
      DI.inspect.render(true);
    });
    const checkInspector = async (focus) => {
      const panel = await page.locator('#side').boundingBox();
      const dock = await page.locator('#tools').boundingBox();
      assert.ok(panel.y + panel.height <= (focus ? page.viewportSize().height : dock.y), 'Tall inspector stays above the toolbar or inside the Focus window');
      assert.equal(await page.locator('#side').evaluate((e) => e.scrollHeight > e.clientHeight), true, 'Tall inspector scrolls instead of growing over the play controls');
      await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
      await page.mouse.wheel(0, 10000);
      await page.waitForFunction(() => {
        const e = document.getElementById('side');
        return e.scrollTop + e.clientHeight >= e.scrollHeight - 2;
      });
      const reachable = await page.locator('#side').evaluate((e) => {
        const buttons = e.querySelectorAll('button');
        const last = buttons[buttons.length - 1], r = last.getBoundingClientRect(), p = e.getBoundingClientRect();
        return r.top >= p.top && r.bottom <= p.bottom && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === last;
      });
      assert.equal(reachable, true, 'The final inspector control can be reached without the toolbar covering it');
    };
    await checkInspector(false);
    await page.keyboard.press('f');
    await checkInspector(true);
    await page.keyboard.press('f');
    console.log('ok   Tall inspectors stay within the play area and their last controls remain reachable');
    if (await page.locator('#bAnnToggle').getAttribute('aria-expanded') !== 'false') await page.click('#bAnnToggle');
    const alarmState = await page.locator('#annState').innerText();
    await page.locator('#side button').filter({ hasText: /^Isolate air \/ N₂ supply$/ }).click();
    await page.waitForFunction(() => document.getElementById('annTags').textContent === '1 IMPAIRMENT');
    assert.equal(await page.locator('#annTags').isVisible(), true, 'An isolated air supply stays visible on the collapsed monitor');
    assert.equal(await page.locator('#annState').innerText(), alarmState, 'An impairment tag does not replace the alarm signal state');
    await page.click('#bAnnToggle');
    assert.match(await page.locator('#imp').innerText(), /Air \/ N2 supply isolated/);
    await page.locator('#side button').filter({ hasText: /^Restore air \/ N₂ supply$/ }).click();
    await page.waitForFunction(() => document.getElementById('annTags').textContent === '');
    assert.equal(await page.locator('#annTags').isVisible(), false, 'Restoring the supply clears the impairment badge');
    console.log('ok   Collapsed monitor retains impairment visibility without changing alarm status');
    if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('All expanded play-area checks passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
