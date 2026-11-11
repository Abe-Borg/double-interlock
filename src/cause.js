// Cause-and-effect matrix for one preaction zone (fire alarm phase-in, slice 1). Read-only.
// It is generated, not written: signal classes come from the registry the alarm code reads (DI.inClass), and
// the release cells from DI.relState on the zone's real trim and bypass setting. test/sim.test.js (A42, A43)
// holds it against the FA Lead's truth-table fixture and against the live engine, row by row. If the matrix and
// the engine or the fixture disagree, fix the engine or ask: do not hand-edit a cell.
// Covered: preaction (double interlock) valves only. Dry and wet valves have no release logic (Simplification).
// Not covered, on purpose: elevator recall, door release and the control of the compressor.
var DI = globalThis.DI || (globalThis.DI = {});

// ---------- hook elections (site settings; OWNER, NEEDS PE REVIEW)
// Hook only, never automatic: the matrix shows where an output contact would sit for others to wire. The engine
// never reads either setting: no fan, damper, room temperature, detector or power value changes because of them.
// Which rows carry a hook is ours, not the FA Lead's: ASSUMED, NEEDS PE REVIEW. HVAC on rows where an alarm
// is annunciated; EPO on rows where the valve opens.
DI.HVAC_HOOKS = { none: 'none', crah: 'CRAH/AHU shutdown', damper: 'damper' };
DI.hvacHook = (W) => { const k = W && W.cfg ? W.cfg.hvacHook : undefined; return k === 'crah' || k === 'damper' ? k : 'none'; };
DI.epoHook = (W) => !!(W && W.cfg && W.cfg.epoHook === true);

// ---------- what the releasing panel holds
// The panel latches D (sol, pull) and the Manual Release zone (mrzL): a dead or missing panel holds none of them.
// P is a panel latch on an electric / electric trim (lost with a dead panel) and the pneumatic actuator at the
// valve on electric / pneumatic (held there whatever the panel does). With no panel wired the P sensor still latches.
// The engine applies the same rule in DI.alarmStep (sol, pull, mrzL) and DI.gasPre (the El/El P latch); this
// copy is used by DI.ceEval only, and the consistency tests are the guard against drift.
DI.panelHolds = (trim, alive, wired) => ({ sol: !!alive, pull: !!alive, mrzL: !!alive, pLatch: !!alive || trim === 'el-pn' || wired === false });

// ---------- rows and columns
DI.CE_COLS = ['Input', 'Tag', 'SignalClass', 'PanelAnnunciation', 'SS_Transmit', 'LocalNAC', 'Solenoid', 'HVAC_Hook', 'EPO_Hook'];
// key = the row, sig = its own signal in DI.inClass terms, in = the input vector the row stands for.
// Vector fields: alert, action, fire1, fire2, manual, mrz, p, lowAir, highAir, waterflow, tamper, supplyAir,
// power ('AC' | 'Battery' | 'Dead'), plus acFail, lowBatt, lostComm naming the three power rows.
DI.CE_ROWS = [
  { key: 'alert', sig: 'alert', label: 'Aspirating Alert (pre-alarm)', tag: '[OWNER] handling', in: { alert: true } },
  { key: 'action', sig: 'action', label: 'Aspirating Action (pre-alarm)', tag: '[OWNER] handling', in: { action: true } },
  { key: 'fire1', sig: 'fire1', label: 'Fire 1 (detection, D)', tag: '[CODE]', in: { fire1: true } },
  { key: 'fire2', sig: 'fire2', label: 'Fire 2 (escalation, never releases alone)', tag: '[CODE]', in: { fire1: true, fire2: true } },
  { key: 'manual', sig: 'manual', label: 'Manual station typed DETECTION (inside D)', tag: '[PRACTICE]', in: { manual: true } },
  { key: 'mrz', sig: 'mrz', label: 'Manual Release zone (9(c) bypass, releases without P)', tag: '[OWNER], NEEDS PE REVIEW', in: { mrz: true } },
  { key: 'p', sig: 'pLatch', label: 'P latched (pipe pressure below P trip)', tag: '[OWNER] class, default OPEN', in: { p: true } },
  { key: 'fire1+p', sig: 'release', label: 'Fire 1 AND P (release)', tag: '[PRACTICE]', in: { fire1: true, p: true } },
  { key: 'fire1+p, battery', sig: 'release', label: 'Fire 1 AND P, panel on battery', tag: '[PRACTICE]', in: { fire1: true, p: true, power: 'Battery' } },
  { key: 'fire1+p, panel dead', sig: 'fire1', label: 'Fire 1 AND P, panel dead', tag: '[PRACTICE]', in: { fire1: true, p: true, power: 'Dead' } },
  { key: 'waterflow', sig: 'waterflow', label: 'Waterflow', tag: '[CODE]', in: { waterflow: true } },
  { key: 'tamper', sig: 'tamper', label: 'Control valve tamper', tag: '[CODE]', in: { tamper: true } },
  { key: 'lowAir', sig: 'lowAir', label: 'Low air (never a release input)', tag: '[CODE]', in: { lowAir: true } },
  { key: 'highAir', sig: 'highAir', label: 'High air (never a release input)', tag: '[CODE]', in: { highAir: true } },
  { key: 'supplyAir', sig: 'supplyAir', label: 'Loss of supply air (compressor / N2 source)', tag: '[PRACTICE]', in: { supplyAir: true } },
  { key: 'acFail', sig: 'acFail', label: 'Panel AC failure (on battery)', tag: '[CODE]; delay [OWNER/AHJ]', in: { power: 'Battery', acFail: true } },
  { key: 'lowBatt', sig: 'lowBatt', label: 'Panel low battery', tag: '[OWNER/listing], ASSUMED', in: { lowBatt: true } },
  { key: 'lostComm', sig: 'lostComm', label: 'Loss of communication (panel dead)', tag: '[CODE]; path [OWNER]', in: { power: 'Dead', lostComm: true } },
];
DI.CE_LEGEND = ['[CODE] a code requirement', '[OWNER] an owner, insurer or AHJ election', '[PRACTICE] industry or maker practice', 'NEEDS PE REVIEW an engineer-of-record choice', 'ASSUMED a value the Leads did not fix'];
DI.CE_LIVE = 'ACTIVE NOW';
DI.CE_EXCLUDED = 'Not in this matrix: elevator recall, door release, the control of the compressor, battery sizing and notification circuits (later cycles). Dry and wet valves have no release logic and no matrix.';

// ---------- one input vector in, one result out
// Returns { D, P, mrz, open, sol, signals, ss, class, annunciated, transmit, nac, hvac, epo, panelDelay, ssDelay, lost }.
//   signals  every signal the vector raises: { key, class, annunciated, transmit, panelDelay, ssDelay, lost }.
//            annunciated = shown and sounded at the panel; transmit = it reaches the supervising station (after
//            ssDelay seconds); lost = the station itself reports it (the panel is dead).
//   ss       what the supervising station ends up with, by class.
//   class .. lost describe the signal named `sigKey` (the row's own), or the first signal when that one is absent.
//   nac      a rule, not a circuit: an alarm annunciated at a live panel sounds the notification appliances.
DI.ceEval = function (W, v, vec, sigKey) {
  const x = Object.assign({ power: 'AC' }, vec || {}), trim = v.p.trim, wired = !!W.panelOf(v.id), dead = x.power === 'Dead', alive = wired && !dead;
  const H = DI.panelHolds(trim, alive, wired), type = DI.stationType(W, v), det = !!(x.fire1 || x.fire2);
  const probe = { p: { trim, sol: H.sol && det, pull: H.pull && !!x.manual && type === 'DETECTION', mrzL: H.mrzL && !!x.mrz && type === 'MANUAL RELEASE', pLatch: H.pLatch && !!x.p } };
  const rs = DI.relState(W, probe), signals = [];
  const put = (key, o) => { const w = o && o.wired !== undefined ? o.wired : wired, up = w && !dead; signals.push(Object.assign({ key, class: DI.inClass(W, key), annunciated: up, transmit: up, panelDelay: 0, ssDelay: 0, lost: false }, o && o.set)); };
  const stage = x.fire2 ? 'fire2' : x.fire1 ? 'fire1' : x.action ? 'action' : x.alert ? 'alert' : '';       // the detector reports its highest stage
  if (stage) put(stage);
  if (x.manual && type === 'DETECTION') put('manual');
  if (x.mrz && type === 'MANUAL RELEASE') put('mrz');
  if (probe.p.pLatch) put('pLatch');
  if (rs.sol) put('release');
  if (x.waterflow || rs.open) put('waterflow');                       // the valve opens, water enters the pipe, the pressure switch reports it
  if (x.lowAir && !rs.open) put('lowAir');                            // air signals belong to a set valve
  if (x.highAir && !rs.open) put('highAir');
  if (x.tamper) { const g = DI.ctrlValve(W, v.id); if (g) put('tamper', { wired: !!W.panelOf(g.id) }); }
  if (x.supplyAir) put('supplyAir');
  if (wired) {
    if (x.power === 'Battery') put('acFail', { set: { panelDelay: DI.TROUBLE_PANEL_S, ssDelay: DI.acDelay(W) } });
    if (x.lowBatt && !dead) put('lowBatt', { set: { panelDelay: DI.TROUBLE_PANEL_S } });
    if (dead) put('lostComm', { set: { annunciated: false, transmit: true, lost: true, ssDelay: DI.commDelay(W) } });
  }
  const ss = { ALARM: false, OPEN: false, SUPV: false, TRBL: false }; for (const q of signals) if (q.transmit) ss[q.class] = true;
  const nac = signals.some((q) => q.class === 'ALARM' && q.annunciated), own = signals.find((q) => q.key === sigKey) || signals[0] || null;
  return { D: rs.D, P: rs.P, mrz: rs.mrz, open: rs.open, sol: rs.sol, signals, ss, nac, own,
    class: own ? own.class : '', annunciated: !!own && own.annunciated, transmit: !!own && own.transmit, panelDelay: own ? own.panelDelay : 0, ssDelay: own ? own.ssDelay : 0, lost: !!own && own.lost,
    hvac: DI.hvacHook(W) !== 'none' && nac, epo: DI.epoHook(W) && rs.open && alive };
};

// ---------- which matrix row a live engine signal belongs to, for zone `id` (null: not this zone's, or not in the matrix)
DI.ceKeyOf = function (S, id, o) {
  const W = S.W, v = W.parts.get(id), inf = S.sysd.info.get(id), pn = W.panelOf(id), part = W.parts.get(o.part), k = o.key; if (!v || !inf || !part) return null;
  // A detector or station is an input of this zone only when it sits in a room the zone protects AND is wired to the
  // zone's own releasing panel: that is the test DI.alarmStep applies before it latches D. An unwired device still
  // raises its local-only signal, but it is no input here, so it must not mark a row active.
  const inZone = (d) => { const r = W.roomAt[W.k(d.x, d.y)]; return !!r && inf.rooms.has(r) && !!pn && W.panelOf(d.id) === pn; };
  if (part.id === id) {
    const m = { la: 'lowAir', ha: 'highAir', sa: 'supplyAir', wf: 'waterflow', pl: 'pLatch', rl: 'release', im: 'impair' }[k.slice(0, 2)];
    return m || (k.startsWith('ms') ? (DI.relState(W, v).mrz ? 'mrz' : 'manual') : null);
  }
  if (part.type === 'vesda' && k[0] === 'v') return inZone(part) ? DI.ASD_STAGES[+k.slice(k.indexOf('.') + 1) - 1][0] : null;
  if (part.type === 'smoke') return inZone(part) && DI.canRelease(W, part) ? 'fire1' : null;       // a spot detector that is the detection leg here
  if (part.type === 'mstn') return inZone(part) ? (DI.stationType(W, v) === 'MANUAL RELEASE' ? 'mrz' : 'manual') : null;
  if (part.type === 'gate' && k.startsWith('tm')) { const g = DI.ctrlValve(W, id); return g && g.id === part.id ? 'tamper' : null; }
  if (part.type === 'panel' && pn && part.id === pn.id) return { ac: 'acFail', lb: 'lowBatt', pd: 'lostComm' }[k.slice(0, 2)] || null;
  return null;
};
// is the row's situation present on the zone right now?
DI.ceLive = function (S, id, row, keys) {
  const W = S.W, v = W.parts.get(id), s = S.ss.get(id), pn = W.panelOf(id), q = v.p;
  if (row.key === 'fire1+p' || row.key === 'fire1+p, battery') return !!pn && pn.p.alive !== false && !!q.sol && !!q.pLatch && W.power === (row.key === 'fire1+p');
  if (row.key === 'fire1+p, panel dead') return !!pn && pn.p.alive === false && keys.has('fire1') && (!!q.pLatch || (!!s && s.state === 'dry' && s.P < q.pTrip));
  return keys.has(row.sig);
};

// ---------- the matrix of zone `id` (a preaction valve), with its cell text. Null for anything else.
DI.ceMatrix = function (S, id) {
  const W = S.W, v = W.parts.get(id); if (!v || v.type !== 'prev' || !S.sysd.info.has(id)) return null;
  const J = DI.setJuris(W), R = J.ref72, el = v.p.trim !== 'el-pn', type = DI.stationType(W, v), pn = W.panelOf(id), gate = DI.ctrlValve(W, id);
  const hv = DI.hvacHook(W), epo = DI.epoHook(W), path = DI.COMM_PATH[DI.commPath(W)], acMin = Math.round(DI.acDelay(W) / 60) + ' min', cmT = DI.delayText(DI.commDelay(W));
  // matrix keys active on this zone now. A stage the detector has passed is not active, except Fire 1: D is a level check.
  const keys = new Set(); for (const o of S.sig.values()) { const k = DI.ceKeyOf(S, id, o); if (k && (!o.sup || k === 'fire1')) keys.add(k); }
  const off = (r) => (r.key === 'mrz' && type !== 'MANUAL RELEASE' ? (el ? 'not on this site: bypass OFF' : 'not on this site: electric / pneumatic trim (the bypass applies to electric / electric only)')
    : r.key === 'manual' && type !== 'DETECTION' ? 'not on this site: bypass ON, the station is typed MANUAL RELEASE' : r.key === 'tamper' && !gate ? 'not on this site: no control valve upstream' : '');
  const ssOf = (q) => (q.lost ? 'supervising station annunciates after ' + cmT + ' (' + path.short + '; ' + R[path.ref] + ')'
    : !q.transmit ? (pn ? 'not transmitted: dark' : 'not transmitted: local only')
    : q.key === 'acFail' ? q.class + ' after ' + acMin + ' (OWNER/AHJ, 60 to 180; ' + R.acDelay + ')'
    : q.class + (q.key === 'alert' || q.key === 'action' ? ' ([OWNER] pre-alarm handling)' : q.class === 'OPEN' ? ' (class not elected)' : ''));
  const rows = DI.CE_ROWS.map((r) => {
    const why = off(r), e = DI.ceEval(W, v, r.in, r.sig), own = e.own, live = !why && DI.ceLive(S, id, r, keys);
    const o = { key: r.key, label: r.label, tag: r.tag, applies: !why, live, class: e.class, annunciated: e.annunciated, transmit: e.transmit, nac: e.nac, sol: e.sol, open: e.open, hvac: e.hvac, epo: e.epo, panelDelay: e.panelDelay, ssDelay: e.ssDelay, lost: e.lost };
    const none = 'none', OFF = 'OFF';
    if (why || !own) { o.cells = [r.label, r.tag, why || 'no signal on this zone', '-', '-', '-', '-', none, OFF]; o.hvac = false; o.epo = false; return o; }
    const cls = own.key === 'alert' || own.key === 'action' ? own.class + ' (pre-alarm, [OWNER])' : own.key === 'pLatch' ? (own.class === 'OPEN' ? 'OPEN - class not elected, never supervisory' : own.class + ' (elected, [OWNER]; never supervisory)') : own.class;
    const ann = !pn ? 'local only: not wired to a panel' : !own.annunciated ? 'dark: nothing displayed' : 'zone-identified display + audible at the panel' + (own.panelDelay ? ' within ' + DI.TROUBLE_PANEL_S + ' s (shown at once here)' : '');
    // the row's own signal first, then any power signal the same vector raises (it has its own timing)
    const tx = [ssOf(own)].concat(e.signals.filter((q) => q !== own && (q.key === 'acFail' || q.key === 'lostComm')).map((q) => (q.key === 'acFail' ? 'AC failure: ' : 'loss of communication: ') + ssOf(q))).join('; ');
    const sol = !e.sol ? (r.in.power === 'Dead' && (r.in.fire1 || r.in.manual) ? 'no: a dead panel energizes nothing' : 'no') : e.open ? 'yes: ENERGIZED, valve opens' : 'yes: ENERGIZED; valve opens only with P';
    o.cells = [r.label, r.tag, cls, ann, tx, e.nac ? 'yes' : 'no', sol, e.hvac ? 'HOOK: output contact (' + DI.HVAC_HOOKS[hv] + ')' : none, e.epo ? 'HOOK: output contact (power isolation)' : OFF];
    return o;
  });
  const notes = [
    el ? 'Solenoid on this electric / electric trim: ENERGIZED only when D AND P.' : 'Solenoid on this electric / pneumatic trim: ENERGIZED on D; water also needs P at the actuator.',
    'P is OPEN until the engineer elects its class, and it is never supervisory. Low and high air are supervisory and never a release input.',
    'LocalNAC is a rule read from the signal class: an alarm at a live panel sounds the notification appliances; supervisory and trouble never do. Notification circuits are not modelled.',
    'HVAC_Hook and EPO_Hook are hooks only: an output contact for others to wire, never an automatic action in this game. Which rows carry one is ASSUMED, NEEDS PE REVIEW: HVAC on rows where an alarm is annunciated, EPO on rows where the valve opens.',
    'Timing: panel troubles show within ' + DI.TROUBLE_PANEL_S + ' s (' + R.trouble + '; at once here). AC failure is transmitted after ' + acMin + ' (' + R.acDelay + '). A dead panel shows nothing; the supervising station annunciates the loss after ' + cmT + ' (' + path.short + '; ' + R[path.ref] + '). Low battery: ' + R.lowBatt + '; the trouble is ' + DI.LOWBATT_NOTE + '.',
    'The NFPA 72 edition follows the NFPA 13 edition of the site (ASSUMED).',
  ];
  const imp = DI.impairments(S).filter((q) => q.id === id).map((q) => q.text);
  return { id, name: DI.sysName(S, id), trim: v.p.trim, trimName: DI.trimOf(v).name, bypass: type === 'MANUAL RELEASE', wired: !!pn,
    head: ['Trim: ' + DI.trimOf(v).name, 'Manual Release zone bypass (9(c)): ' + (type === 'MANUAL RELEASE' ? 'ON' : W.cfg && W.cfg.manualReleaseBypassP ? 'ON for the site, not on this trim' : 'OFF'),
      'HVAC hook: ' + DI.HVAC_HOOKS[hv], 'EPO hook: ' + (epo ? 'ON' : 'OFF'), 'Releasing panel: ' + (pn ? '#' + pn.id + (pn.p.alive === false ? ' (DEAD)' : '') : 'NOT WIRED')],
    hooks: { hvac: hv, epo }, cols: DI.CE_COLS.slice(), rows, notes, liveLabel: DI.CE_LIVE, legend: DI.CE_LEGEND.slice(), excluded: DI.CE_EXCLUDED, imp };
};
