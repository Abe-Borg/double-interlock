// Runs the FA Lead's double-interlock release truth table (fixtures/di-release-truth-table.csv) against the
// engine. The CSV is the Lead's file, copied byte for byte: it is never edited or reformatted here. Each row
// builds a set, pressurized preaction valve on the row's trim, applies the inputs, runs 60 s and reads back
// D, the solenoid output, the valve and what the supervising station sees. LocalNAC is not modelled.
// Used by test/sim.test.js and review/truth-table-check.js. Load the engine (src/*.js) first.
//
// Supervising-station timing (Cycle 4). SS_Trouble on the rows that are not on AC is a steady-state value: the
// station learns of an AC failure only after the site's transmission delay (DI.acDelay) and of a dead panel only
// after its supervision interval (DI.commDelay). So for those rows the runner (never the fixture) skips that
// long after the 60 s and reads SS_Trouble then. "Seen by the station" is o.mon && o.tx. The reading taken
// before the skip is returned too (pre), so a test can show that the trouble was not there at 60 s.
//
// Two guards run every time the fixture is read, before any row is played:
//   1. the pin: the sha256 of the raw file bytes (first 16 hex, no newline normalization) must equal
//      FIXTURE_SHA16. To take a new Lead file, copy it byte for byte and update the pin in the same commit
//      (the commit message says which Lead file the new sha16 came from). If the engine and the fixture
//      disagree, stop and ask: do not change the file.
//   2. self-consistency, from each row's own columns, so a bad edit fails even if the pin were moved carelessly.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = path.join(__dirname, '..', 'fixtures', 'di-release-truth-table.csv');
const FIXTURE_SHA16 = 'cb3462b268359c6e';       // FA Lead's corrected file of 2026-11-10 (R08 Fire1 = 1, R14 D = 0)
const CHECKED = ['D', 'Solenoid', 'ValveOpen', 'SS_Alarm', 'SS_Supervisory', 'SS_Trouble'];

const sha16 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
// throws unless the file hashes to the pin
function checkFixture(file, pin) {
  const got = sha16(file || FILE), want = pin === undefined ? FIXTURE_SHA16 : pin;
  if (got !== want) throw new Error('Truth-table fixture is not the pinned file: sha16 ' + got + ', pinned ' + want + '. The fixture is copied verbatim from the FA Lead and never edited here. To take a new Lead file, copy it byte for byte and update FIXTURE_SHA16 in the same commit.');
  return got;
}
// Self-consistency of one row, from its own columns. Returns the list of problems (empty when consistent).
//   Fire2 = 1 implies Fire1 = 1: one detector stream, so a reading at Fire 2 is at or above Fire 1.
//   ManualReleaseZone = 1 implies Bypass9c = 1, or the row expects no release.
//   Release = (D AND P) OR (Bypass9c AND ManualReleaseZone AND Trim = El/El).
//   ValveOpen = Release. Solenoid = Release on El/El and D on El/Pn. P is the row's input column.
function rowProblems(row) {
  const on = (k) => row[k] === '1', elel = /^el\/el$/i.test(row.Trim), bad = [];
  const release = (on('D') && on('P')) || (on('Bypass9c') && on('ManualReleaseZone') && elel);
  if (on('Fire2') && !on('Fire1')) bad.push('Fire2 = 1 with Fire1 = 0 (a reading at Fire 2 is at or above Fire 1)');
  if (on('ManualReleaseZone') && !on('Bypass9c') && (on('ValveOpen') || (elel && on('Solenoid')))) bad.push('ManualReleaseZone = 1 with Bypass9c = 0 expects a release');
  if (on('ValveOpen') !== release) bad.push('ValveOpen = ' + row.ValveOpen + ' but (D AND P) OR (Bypass9c AND ManualReleaseZone AND El/El) = ' + (release ? 1 : 0));
  const sol = elel ? release : on('D');
  if (on('Solenoid') !== sol) bad.push('Solenoid = ' + row.Solenoid + ' but ' + (elel ? 'the release' : 'D') + ' = ' + (sol ? 1 : 0) + ' on ' + row.Trim);
  return bad;
}
function parse(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim()), head = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((l) => { const c = l.split(','), o = {}; head.forEach((h, i) => { o[h] = i === head.length - 1 ? c.slice(i).join(',').trim() : (c[i] || '').trim(); }); return o; });
}
// Read the fixture. opts.pin: the sha16 the file must have (default FIXTURE_SHA16); null skips the pin, which is
// only for a temporary file a test writes to prove the self-consistency checks. Both guards throw.
function readRows(file, opts) {
  const f = file || FILE, pin = opts && 'pin' in opts ? opts.pin : FIXTURE_SHA16;
  if (pin !== null) checkFixture(f, pin);
  const rows = parse(f), bad = [];
  for (const r of rows) for (const m of rowProblems(r)) bad.push(r.Row + ': ' + m);
  if (bad.length) throw new Error('Truth-table fixture is not self-consistent: ' + bad.join('; '));
  return rows;
}
function runRow(DI, row) {
  const on = (k) => row[k] === '1';
  const W = new DI.World(40, 14); W.addRoom('hall', 20, 1, 12, 9);
  W.addPart('city', 1, 6, 0, { stat: 90, resid: 70, flow: 1500 }); for (let x = 2; x <= 13; x++) W.setPipe(x, 6, 6, 0);
  const v = W.addPart('prev', 14, 6, 0); for (let x = 15; x <= 19; x++) W.setPipe(x, 6, 6, 0);
  for (let y = 2; y <= 9; y++) W.setPipe(20, y, 4, 0, true);
  for (let y = 2; y <= 9; y++) for (let x = 21; x <= 31; x++) W.setPipe(x, y, 1, 1, true);
  // The compressor has a generator-backed feed, so the Power column changes the panel's power and nothing else:
  // a compressor that died with the utility would add its own LOSS OF SUPPLY AIR trouble, which is no input of the table.
  W.addPart('comp', 14, 4, 0, { scfm: 5, emerg: true }); W.setAir(14, 5, 1);
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
  // One station is wired in the room. Its type follows the site: MANUAL RELEASE only where the 9(c) flag is ON
  // on El/El, DETECTION everywhere else. The `Manual` column operates a station typed DETECTION and the
  // `ManualReleaseZone` column one typed MANUAL RELEASE; an input whose station type does not exist on the
  // row's site is not operated (R14 with the flag OFF: the zone does not exist, nothing releases).
  const type = DI.stationType(W, v);
  if (on('Manual') && type !== 'DETECTION') throw new Error(row.Row + ': Manual = 1 needs a station typed DETECTION, but this row types it ' + type + '. The rig has one station.');
  if ((on('Manual') && type === 'DETECTION') || (on('ManualReleaseZone') && type === 'MANUAL RELEASE')) stn.p.on = true;
  const thr = DI.detThr(W), lvl = on('Fire2') ? thr[3] * 2 : on('Fire1') ? (thr[2] + thr[3]) / 2 : 0;
  for (let t = 0; t < 60; t += 0.25) { S.smoke[1] = lvl; S.step(0.25); }
  // what the supervising station has now: monitored, transmitted, and not a stage the detector has passed
  const station = () => { const seen = [...S.sig.values()].filter((o) => o.mon && o.tx && !o.sup), has = (type2) => seen.some((o) => o.type === type2);
    return { SS_Alarm: has('ALARM') ? '1' : has('OPEN') ? 'OPEN' : '0', SS_Supervisory: has('SUPV') ? '1' : '0', SS_Trouble: has('TRBL') ? '1' : '0', trouble: seen.filter((o) => o.type === 'TRBL').map((o) => o.key) }; };
  const pre = station();
  const got = { D: DI.relState(W, v).D ? '1' : '0', Solenoid: v.p.solOut ? '1' : '0', ValveOpen: s.state !== 'dry' ? '1' : '0', SS_Alarm: pre.SS_Alarm, SS_Supervisory: pre.SS_Supervisory, SS_Trouble: pre.SS_Trouble };
  let skipped = 0;
  if (!/^ac$/i.test(row.Power)) {       // the row's inputs are held through the skip, as they were for the 60 s
    skipped = Math.max(DI.acDelay(W), DI.commDelay(W)) + 60; for (let t = 0; t < skipped; t += 1) { S.smoke[1] = lvl; S.step(1); }
    got.SS_Trouble = station().SS_Trouble;
  }
  const diff = CHECKED.filter((k) => String(row[k]).toUpperCase() !== got[k]);
  // every active signal at the final reading, for the cause-and-effect matrix test: its matrix key (cause.js), class and where it went
  const sigs = [...S.sig.values()].filter((o) => !o.sup).map((o) => ({ key: o.key, ce: DI.ceKeyOf ? DI.ceKeyOf(S, v.id, o) : null, class: o.type, dark: !!o.dark, mon: !!o.mon, tx: !!o.tx, lost: !!o.lost }));
  return { row: row.Row, trim: row.Trim, notes: row.Notes, want: row, got, diff, ok: diff.length === 0, mrzL: !!v.p.mrzL, pull: !!v.p.pull, pre, skipped, sigs, rig: { W, S, v, pn } };
}
module.exports = { FILE, FIXTURE_SHA16, CHECKED, sha16, checkFixture, rowProblems, readRows, runRow, run: (DI, file, opts) => readRows(file, opts).map((r) => runRow(DI, r)) };
