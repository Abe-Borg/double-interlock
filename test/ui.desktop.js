// Exercise the real update dialog with a mocked native bridge and network.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href;
    await page.goto(url);
    assert.equal(await page.locator('#mUpdates').count(), 0, 'browser build stays offline');
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
    await page.click('#updateClose');
    await page.click('.card[data-sc="c1"]');
    await page.click('#mGo');
    await page.evaluate(() => { DI.setSpeed(0); DI.game.W.money = 12345; DI.saveGame(); });
    await page.reload();
    await page.click('.card[data-sc="c1"]');
    assert.equal(await page.evaluate(() => DI.game.W.money), 12345, 'desktop assets restore saved games');
    assert.deepEqual(errors, []);
    console.log('Desktop update UI: available/current/rate-limit/offline/download/save restoration passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
