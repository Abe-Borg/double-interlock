// Exercise the real update dialog with a mocked native bridge and network.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/\r\n?/g, '\n');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Every distribution must expose the exact shipped documents with networking blocked.
    for (const file of ['index.html', 'double-interlock.html', 'dist/index.html']) {
      const requests = [];
      await page.route('https://**/*', (route) => { requests.push(route.request().url()); return route.abort(); });
      await page.goto(pathToFileURL(path.resolve(__dirname, '..', file)).href);
      assert.equal(await page.locator('#mUpdates').count(), 0, 'browser build stays offline');
      await page.click('#mAbout');
      assert.match(await page.locator('#mbox').innerText(), /Personal, non-commercial use/);
      assert.match(await page.locator('#mbox').innerText(), /Third-party components retain their own license rights/);
      assert.match(await page.locator('#mbox').innerText(), /Not engineering advice/);
      for (const [button, document] of [['#aboutLicense', 'LICENSE'], ['#aboutNotices', 'THIRD_PARTY_NOTICES.txt']]) {
        await page.click(button);
        assert.equal(await page.locator('#legalText').textContent(), read(document), file + ' shows the complete ' + document);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false, 'legal text wraps within the window');
        await page.click('#legalBack');
      }
      await page.click('#aboutBack');
      assert.equal(await page.locator('#mAbout').isVisible(), true);
      assert.deepEqual(requests, [], 'reviewing legal documents requires no network');
      await page.unroute('https://**/*');
    }
    await page.addInitScript(() => {
      window.opened = [];
      window.__TAURI__ = { core: { invoke: async (command, args) => {
        if (command === 'desktop_info') return { version: '1.0.0', arch: 'x86_64' };
        if (command === 'open_release') { window.opened.push(args.version); return; }
        throw new Error('Unexpected native command');
      } } };
    });
    const api = 'https://api.github.com/repos/Abe-Borg/double-interlock/releases/latest';
    const release = (v) => ({ tag_name: 'v' + v, draft: false, prerelease: false, assets: [{ name: `Double-Interlock-${v}-windows-x64-setup.exe`, state: 'uploaded', size: 100, browser_download_url: `https://github.com/Abe-Borg/double-interlock/releases/download/v${v}/Double-Interlock-${v}-windows-x64-setup.exe` }] });
    await page.route(api, (route) => route.fulfill({ json: release('1.10.0') }));
    await page.reload();
    await page.click('#mUpdates');
    await page.waitForFunction(() => document.getElementById('updateDownload')?.hidden === false);
    assert.match(await page.locator('#updateStatus').innerText(), /1\.10\.0 is available/);
    assert.match(await page.locator('#updateLicenseNotice').innerText(), /No redistribution, modification, commercial use, or AI training or evaluation/);
    await page.click('#updateLegal');
    await page.click('#aboutLicense');
    assert.equal(await page.locator('#legalText').textContent(), read('LICENSE'));
    await page.click('#legalBack');
    await page.click('#aboutBack');
    assert.match(await page.locator('#updateStatus').innerText(), /1\.10\.0 is available/);
    assert.equal(await page.locator('#updateDownload').isVisible(), true, 'reviewing the license preserves the available update');
    await page.click('#updateDownload');
    assert.deepEqual(await page.evaluate(() => window.opened), ['1.10.0']);
    await page.click('#updateClose');
    await page.route(api, (route) => route.fulfill({ json: release('1.0.0') }));
    await page.click('#mUpdates');
    await page.waitForFunction(() => document.getElementById('updateStatus')?.textContent.includes('up to date'));
    assert.equal(await page.locator('#updateDownload').isVisible(), false);
    await page.click('#updateClose');
    await page.route(api, (route) => route.fulfill({ status: 403, body: '{}' }));
    await page.click('#mUpdates');
    await page.waitForFunction(() => document.getElementById('updateStatus')?.textContent.includes('limiting'));
    await page.click('#updateReleases');
    assert.deepEqual(await page.evaluate(() => window.opened), ['1.10.0', null]);
    await page.click('#updateClose');
    await page.route(api, (route) => route.abort());
    await page.click('#mUpdates');
    await page.waitForFunction(() => document.getElementById('updateStatus')?.textContent.includes('Could not reach'));
    await page.click('#updateLegal');
    await page.click('#aboutNotices');
    assert.equal(await page.locator('#legalText').textContent(), read('THIRD_PARTY_NOTICES.txt'));
    await page.click('#legalBack');
    await page.click('#aboutBack');
    assert.match(await page.locator('#updateStatus').innerText(), /Could not reach/, 'legal review preserves the offline result');
    assert.equal(await page.locator('#updateDownload').isVisible(), false);
    await page.click('#updateClose');

    // A check completing while legal documents are open must not replace that view.
    let respond;
    const pending = new Promise((resolve) => { respond = resolve; });
    await page.route(api, async (route) => { await pending; await route.fulfill({ json: release('1.10.0') }); });
    await page.click('#mUpdates');
    await page.click('#updateLegal');
    await page.click('#aboutLicense');
    const response = page.waitForResponse(api);
    respond();
    await response;
    await page.waitForFunction(() => document.getElementById('legalText')?.textContent.includes('PROPRIETARY SOFTWARE LICENSE'));
    await page.click('#legalBack');
    await page.click('#aboutBack');
    await page.waitForFunction(() => document.getElementById('updateDownload')?.hidden === false);
    assert.match(await page.locator('#updateStatus').innerText(), /1\.10\.0 is available/);
    await page.click('#updateClose');
    await page.click('.card[data-sc="c1"]');
    await page.click('#mGo');
    await page.evaluate(() => { DI.setSpeed(0); DI.game.W.money = 12345; DI.saveGame(); });
    await page.reload();
    await page.click('.card[data-sc="c1"]');
    assert.equal(await page.evaluate(() => DI.game.W.money), 12345, 'desktop assets restore saved games');
    assert.deepEqual(errors, []);
    console.log('Offline legal viewer (source/standalone/desktop), update legal navigation, available/current/rate-limit/offline/download/save restoration passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
