// Stage only the self-contained game. Never bundle the repository or node_modules.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const config = require('../src-tauri/tauri.conf.json');
if (config.version !== pkg.version) throw new Error('package.json and tauri.conf.json versions must match');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'double-interlock.html'), path.join(root, 'dist', 'index.html'));
console.log('Desktop assets staged for v' + pkg.version);
