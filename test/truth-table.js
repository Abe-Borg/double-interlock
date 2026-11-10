// Runs the FA Lead's double-interlock release truth table (fixtures/di-release-truth-table.csv) against the
// engine. The CSV is read as it stands, so the Lead's later edits flow straight into the test. Each row
// builds a set, pressurized preaction valve on the row's trim, applies the inputs, runs 60 s and reads back
// D, the solenoid output, the valve and what the supervising station sees. LocalNAC is not modelled.
// Used by test/sim.test.js and review/truth-table-check.js. Load the engine (src/*.js) first.
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'fixtures', 'di-release-truth-table.csv');
const CHECKED = ['D', 'Solenoid', 'ValveOpen', 'SS_Alarm', 'SS_Supervisory', 'SS_Trouble'];

function readRows(file) {
  const lines = fs.readFileSync(file || FILE, 'utf8').split(/\r?\n/).filter((l) => l.trim()), head = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((l) => { const c = l.split(','), o = {}; head.forEach((h, i) => { o[h] = i === head.length - 1 ? c.slice(i).join(',').trim() : (c[i] || '').trim(); }); return o; });
}
function runRow(DI, row) {
  const on = (k) => row[k] === '1';
  const W = new DI.World(40, 14); W.addRoom('hall', 20, 1, 12, 9);
  W.addPart('city', 1, 6, 0, { stat: 90, resid: 70, flow: 1500 }); for (let x = 2; x <= 13; x++) W.setPipe(x, 6, 6, 0);
  const v = W.addPart('prev', 14, 6, 0); for (let x = 15; x <= 19; x++) W.setPipe(x, 6, 6, 0);
  for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true);
  for (let y = 2; y <= 9; y++) for (let x = 21; x <= 31; x++) W.setPipe(x, y, 1, 1, true);
  W.addPart('comp', 14, 4, 0, { scfm: 5 }); W.setAir(14, 5, 1);
  const pn = W.addPart('panel', 16, 4, 0), det = W.addPart('vesda', 25, 1, 0), stn = W.addPart('mstn', 27, 1, 0);
  for (const d of [v, det, stn]) W.wire(pn.id, d.id);
  if (/pn/i.test(row.Trim)) DI.loadTrim(v, 'el-pn');
  if (on('Bypass9c')) W.cfg.manualReleaseBypassP = true;
  const S = new DI.Sim(W); S.commission(); const s = S.ss.get(v.id), V = S.sysd.info.get(v.id).vol;
  // inputs. P is the latched release input with the air since restored, so it is independent of low air.
  if (/batt/i.test(row.Power)) W.power = false;
  if (/dead/i.test(row.Power)) { W.power = false; pn.p.battH = 0; }
  if (on('P')) v.p.pLatch = true;
  if (on('LowAir_SUP')) { v.p.airValve = 0; s.G = ((v.p.loAir + v.p.pTrip) / 2 + DI.ATM) * V; }       // between P trip and the low-air setpoint
  if (on('HighAir_SUP')) s.G = (v.p.hiAir + 5 + DI.ATM) * V;
  // the Manual Release zone input exists only where the bypass flag makes the station that type
  if (on('Manual') || (on('ManualReleaseZone') && DI.stationType(W, v) === 'MANUAL RELEASE')) stn.p.on = true;
  const thr = DI.detThr(W), lvl = on('Fire2') ? thr[3] * 2 : on('Fire1') ? (thr[2] + thr[3]) / 2 : 0;
  for (let t = 0; t < 60; t += 0.25) { S.smoke[1] = lvl; S.step(0.25); }
  const seen = [...S.sig.values()].filter((o) => o.mon && !o.sup), has = (type) => seen.some((o) => o.type === type);
  const got = { D: DI.relState(W, v).D ? '1' : '0', Solenoid: v.p.solOut ? '1' : '0', ValveOpen: s.state !== 'dry' ? '1' : '0',
    SS_Alarm: has('ALARM') ? '1' : has('OPEN') ? 'OPEN' : '0', SS_Supervisory: has('SUPV') ? '1' : '0', SS_Trouble: has('TRBL') ? '1' : '0' };
  const diff = CHECKED.filter((k) => String(row[k]).toUpperCase() !== got[k]);
  return { row: row.Row, trim: row.Trim, notes: row.Notes, want: row, got, diff, ok: diff.length === 0 };
}
module.exports = { FILE, CHECKED, readRows, runRow, run: (DI, file) => readRows(file).map((r) => runRow(DI, r)) };
