const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../src/desktop.js');
const desktop = globalThis.DI.desktop;
const release = (version, changes = {}) => ({
  tag_name: 'v' + version, draft: false, prerelease: false,
  assets: [{ name: `Double-Interlock-${version}-windows-x64-setup.exe`, state: 'uploaded', size: 100,
    browser_download_url: `https://github.com/Abe-Borg/double-interlock/releases/download/v${version}/Double-Interlock-${version}-windows-x64-setup.exe` }],
  ...changes
});

test('stable update versions compare numerically and never downgrade', () => {
  assert.deepEqual(desktop.readRelease(release('1.10.0'), '1.9.9'), { version: '1.10.0' });
  assert.deepEqual(desktop.readRelease(release('2.0.0'), '1.99.99'), { version: '2.0.0' });
  assert.equal(desktop.readRelease(release('1.0.0'), '1.0.0'), null);
  assert.equal(desktop.readRelease(release('1.9.0'), '1.10.0'), null);
});

test('incomplete, preview, or unexpected download URLs cannot be offered', () => {
  for (const data of [release('1.1.0', { draft: true }), release('1.1.0', { prerelease: true }),
    release('1.1.0', { assets: [] }), release('1.1.0-beta.1'), release('01.1.0'), {}, null,
    release('1.1.0', { assets: [{ ...release('1.1.0').assets[0], browser_download_url: 'https://evil.example/setup.exe' }] }),
    release('1.1.0', { assets: [{ ...release('1.1.0').assets[0], state: 'new' }] })]) {
    assert.throws(() => desktop.readRelease(data, '1.0.0'));
  }
});

test('version, installer, and native app identities agree', () => {
  const pkg = require('../package.json'), config = require('../src-tauri/tauri.conf.json');
  const cargo = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src-tauri/Cargo.toml'), 'utf8');
  assert.equal(pkg.version, config.version);
  assert.equal(cargo.match(/^version = "([^"]+)"/m)[1], pkg.version);
  assert.equal(config.identifier, 'com.abeborg.doubleinterlock');
  assert.deepEqual(config.bundle.targets, ['nsis']);
});
