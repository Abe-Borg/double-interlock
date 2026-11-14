// node build-standalone.js  ->  double-interlock.html (one self-contained file)
const fs = require('fs'), path = require('path');
require('./scripts/legal-content.js');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, f) => '<style>\n' + fs.readFileSync(path.join(__dirname, f), 'utf8') + '</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/<\/script/g, '<\\/script') + '\n</script>');
fs.writeFileSync(path.join(__dirname, 'double-interlock.html'), html);
console.log('double-interlock.html', (html.length / 1024).toFixed(0) + ' KB');
