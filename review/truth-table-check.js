// node review/truth-table-check.js [file.csv]
// Prints the FA Lead's release truth table against the engine, row by row. Exit code 1 if any row differs.
const path = require('path');
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links', 'gas', 'fire', 'alarm', 'sim', 'calc', 'review', 'proc']) require(path.join('..', 'src', f + '.js'));
const TT = require('../test/truth-table.js'), DI = globalThis.DI;
const res = TT.run(DI, process.argv[2]); let bad = 0;
console.log(['Row', 'Trim  ', ...TT.CHECKED].join('  '));
for (const r of res) {
  if (!r.ok) bad++;
  console.log([r.row, r.trim.padEnd(6), ...TT.CHECKED.map((k) => (r.diff.includes(k) ? r.got[k] + '!=' + r.want[k] : r.got[k]).padEnd(k.length))].join('  ') + (r.ok ? '' : '   DIFFERS') + '   ' + r.notes);
}
console.log(res.length + ' rows, ' + (res.length - bad) + ' match, ' + bad + ' differ. LocalNAC is not modelled and not checked.');
process.exit(bad ? 1 : 0);
