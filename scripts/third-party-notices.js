// node scripts/third-party-notices.js          -> writes THIRD_PARTY_NOTICES.txt
// node scripts/third-party-notices.js --check  -> fails if THIRD_PARTY_NOTICES.txt is out of date
//
// Lists every Rust crate compiled into the Windows desktop build (x86_64-pc-windows-msvc, normal dependencies,
// proc-macro crates and build-only crates left out because none of their code ships), with the license text each
// crate ships. Identical texts are printed once. The browser game itself contains no third-party code.
// Needs cargo on the PATH. Run it after any change to src-tauri/Cargo.toml or src-tauri/Cargo.lock.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'THIRD_PARTY_NOTICES.txt');
const TARGET = 'x86_64-pc-windows-msvc';

// Crates published without a license file. Each points at the text it is licensed under: a file in this repository
// (taken from the crate's upstream repository) or the license file of a sibling crate from the same upstream repository.
const FALLBACK = {
  'webview2-com': { file: 'scripts/licenses/webview2-rs-MIT.txt' },            // github.com/wravery/webview2-rs
  'webview2-com-sys': { file: 'scripts/licenses/webview2-rs-MIT.txt' },
  'selectors': { crate: 'cssparser', name: 'LICENSE' },                        // servo: the MPL-2.0 text, no copyright line
  'alloc-stdlib': { crate: 'alloc-no-stdlib', name: 'LICENSE' },               // github.com/dropbox/rust-alloc-no-stdlib
};

const meta = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version', '1', '--filter-platform', TARGET],
  { cwd: path.join(root, 'src-tauri'), maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }));
const byId = new Map(meta.packages.map((p) => [p.id, p]));
const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
const isProcMacro = (p) => p.targets.some((t) => t.kind.includes('proc-macro'));

const shipped = new Set(), stack = [meta.resolve.root];
while (stack.length) {
  const id = stack.pop();
  if (shipped.has(id)) continue;
  if (id !== meta.resolve.root && isProcMacro(byId.get(id))) continue;
  shipped.add(id);
  for (const d of nodes.get(id).deps) if (d.dep_kinds.some((k) => k.kind === null)) stack.push(d.pkg);
}
shipped.delete(meta.resolve.root);

const norm = (s) => s.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim() + '\n';
const LIC = /^(licen[cs]e|copying|notice|copyright|unlicense)/i;
const filesOf = (p) => {
  const dir = path.dirname(p.manifest_path);
  return fs.readdirSync(dir).filter((n) => LIC.test(n) && fs.statSync(path.join(dir, n)).isFile()).sort().map((n) => path.join(dir, n));
};
const pkgByName = (name) => meta.packages.filter((p) => p.name === name).sort((a, b) => a.version < b.version ? 1 : -1)[0];

const crates = [...shipped].map((id) => byId.get(id)).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
const texts = new Map();   // normalized text -> [crate labels]
const missing = [];
for (const p of crates) {
  let files = filesOf(p);
  if (!files.length && FALLBACK[p.name]) {
    const f = FALLBACK[p.name];
    files = [f.file ? path.join(root, f.file) : path.join(path.dirname(pkgByName(f.crate).manifest_path), f.name)];
  }
  if (!files.length) { missing.push(p.name + ' ' + p.version + ' (' + (p.license || 'no license field') + ')'); continue; }
  for (const f of files) {
    const t = norm(fs.readFileSync(f, 'utf8'));
    if (!texts.has(t)) texts.set(t, []);
    const list = texts.get(t), label = p.name + ' ' + p.version;
    if (!list.includes(label)) list.push(label);
  }
}
if (missing.length) {
  console.error('No license text found for:\n  ' + missing.join('\n  ') + '\nAdd an entry to FALLBACK in scripts/third-party-notices.js.');
  process.exit(1);
}

const RULE = '='.repeat(100), rule = '-'.repeat(100);
const lines = [];
lines.push('DOUBLE INTERLOCK: THIRD-PARTY NOTICES', '');
lines.push('Double Interlock is proprietary software (see LICENSE). Some third-party components ship with the Windows');
lines.push('desktop app. They are not covered by the Double Interlock license; each stays under its own license, reproduced');
lines.push('below. Nothing here grants any right to Double Interlock itself.', '');
lines.push('The browser game (double-interlock.html, index.html, src/) contains no third-party code.', '');
lines.push(RULE, 'COMPONENTS THAT ARE NOT RUST CRATES', RULE, '');
lines.push('Microsoft Edge WebView2 Runtime and its Evergreen Bootstrapper');
lines.push('  The installer embeds Microsoft\'s WebView2 Evergreen Bootstrapper, which installs the WebView2 Runtime when');
lines.push('  it is missing. Both are Microsoft software, distributed under Microsoft\'s WebView2 distribution terms');
lines.push('  (https://developer.microsoft.com/microsoft-edge/webview2/). They are not part of Double Interlock.', '');
lines.push('NSIS (Nullsoft Scriptable Install System)');
lines.push('  The Windows installer is built with NSIS, which is licensed under the zlib/libpng license');
lines.push('  (https://nsis.sourceforge.io/License).', '');
lines.push(RULE, 'SOURCE CODE OF MPL-2.0 COMPONENTS', RULE, '');
const mpl = crates.filter((p) => /MPL-2\.0/.test(p.license || ''));
lines.push('The following components are licensed under the Mozilla Public License 2.0 and are used unmodified. Their source');
lines.push('code is available from crates.io at the addresses below (and from the repository each one names there):', '');
for (const p of mpl) lines.push('  ' + p.name + ' ' + p.version + '  https://crates.io/crates/' + p.name + '/' + p.version);
lines.push('');
lines.push(RULE, 'RUST CRATES COMPILED INTO THE DESKTOP APP (' + TARGET + ', ' + crates.length + ' crates)', RULE, '');
const w = Math.max(...crates.map((p) => (p.name + ' ' + p.version).length)) + 2;
for (const p of crates) lines.push('  ' + (p.name + ' ' + p.version).padEnd(w) + (p.license || 'see license text'));
lines.push('');
lines.push(RULE, 'LICENSE TEXTS (each text once, followed by the crates it was found in)', RULE);
const groups = [...texts.entries()].sort((a, b) => a[1][0].localeCompare(b[1][0]) || a[0].localeCompare(b[0]));
for (const [t, who] of groups) {
  const used = []; let cur = 'Used by:';
  for (const c of who) { if (cur.length + c.length + 2 > 100) { used.push(cur + ','); cur = ' '; } cur += (cur.trim() && !cur.endsWith(':') ? ', ' : ' ') + c; }
  used.push(cur);
  lines.push('', rule, ...used, rule, '', t.trimEnd());
}
const body = lines.join('\n') + '\n';

if (process.argv.includes('--check')) {
  const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
  if (have !== body) { console.error('THIRD_PARTY_NOTICES.txt is out of date: run node scripts/third-party-notices.js'); process.exit(1); }
  console.log('THIRD_PARTY_NOTICES.txt is up to date (' + crates.length + ' crates, ' + groups.length + ' license texts)');
} else {
  fs.writeFileSync(out, body);
  console.log('THIRD_PARTY_NOTICES.txt: ' + crates.length + ' crates, ' + groups.length + ' license texts, ' + (body.length / 1024).toFixed(0) + ' KB');
}
