// Supervisory gas + system fill model for wet / dry / preaction systems.
// Gas is tracked as G = P_abs * V (psi*gal, isothermal ideal gas) with a separate O2 tally,
// so compressor fill time, leak-down, trip point, water transit and nitrogen purity all
// come out of the same bookkeeping rather than being scripted.
var DI = globalThis.DI || (globalThis.DI = {});

DI.SCFM = DI.ATM * 7.4805 / 60;        // psi*gal per second for 1 standard cubic foot / minute
DI.A_SPK = 0.147;                      // effective orifice area of an open 1/2" sprinkler, in^2
// gas flow through an orifice to atmosphere, SCFM (choked above ~13 psig)
DI.gasFlow = function (a, pg) {
  if (pg <= 0 || a <= 0) return 0;
  const pa = pg + DI.ATM, r = DI.ATM / pa, x = (r - 0.528) / 0.472;
  return 18.15 * a * pa * (r <= 0.528 ? 1 : Math.sqrt(Math.max(0, 1 - x * x)));
};
DI.N2_O2 = 0.015;                      // oxygen fraction leaving a 98.5% nitrogen generator
DI.DRY_RATIO = 5.5;                    // differential dry pipe valve: trips near P_water / 5.5

// ---------- preaction release state (FA Lead truth table, fixtures/di-release-truth-table.csv)
// The panel manual station is typed DETECTION and sits inside D. Only where the project flag is ON and the
// trim is electric / electric is it typed MANUAL RELEASE (footnote 9(c), NEEDS PE REVIEW): then it is the
// Manual Release zone, a separate release path that is not detection and bypasses P.
DI.stationType = (W, v) => (v.p.trim === 'el-el' && W.cfg && W.cfg.manualReleaseBypassP ? 'MANUAL RELEASE' : 'DETECTION');
//   Release = (D AND P) OR (Bypass9c AND ManualReleaseZone), the second term on electric / electric only.
//   D    = Fire 1 latched by the panel (v.p.sol) OR the manual station typed DETECTION (v.p.pull).
//          The Manual Release zone is never in D.
//   P    = pipe pressure fell below P trip and latched (v.p.pLatch)
//   mrz  = the Manual Release zone has latched its own release (v.p.mrzL). It stays latched after the station
//          is reset, until a panel reset.
//   sol  = the energized solenoid.  El/El: the release.  El/Pn: D alone, because P is the pneumatic actuator
//          at the valve and not a panel input.
//   open = the release, on both trims. The mechanical release is separate.
DI.relState = function (W, v) {
  const q = v.p, mrz = !!q.mrzL && DI.stationType(W, v) === 'MANUAL RELEASE';
  const D = !!q.sol || !!q.pull, P = !!q.pLatch, open = (D && P) || mrz;
  return { D, P, mrz, sol: q.trim === 'el-pn' ? D : open, open };
};
// which release path is acting, for the inspector and the manual: [text, class]
DI.relPath = function (W, v) {
  const rs = DI.relState(W, v);
  if (rs.mrz) return ['Manual Release zone RELEASING - without P', 'bad'];
  if (DI.stationType(W, v) === 'MANUAL RELEASE') return ['Manual Release zone BYPASS ARMED (9(c), NEEDS PE REVIEW)', 'warn'];
  return ['(D AND P)  armed', 'good'];
};
DI.SAFE_PSI = 0.5;                      // ASSUMED: "about 0 psi" on the system gauge, near gauge resolution
// water left in a pipe that counts as drained (the same threshold the riser reset uses)
DI.dryLim = (V) => 0.2 + 0.01 * V;
// maintenance regulator target: normal pressure, raised to the test pressure while a 24 h air test is charging
// (the greater of 40 psi or the zone's normal: DI.airTestPsi, proc.js)
DI.airCharging = (S, id) => S.procs.length > 0 && S.procs.some((q) => q.kind === 'leak' && q.id === id && q.stage === 0);
DI.airTarget = (S, id, v) => { const q = S.procs.find((x) => x.kind === 'leak' && x.id === id && x.stage === 0); return q ? q.psi || DI.airTestPsi(v) : v.p.airSet; };
// ---------- air refill (FP Lead): the air supply must restore normal pressure in each system within 30 min.
// The CODE CHECK is DI.airSizing: the largest single zone on the supply, filled ALONE with the full capacity from
// 0 psig to its restore pressure, in 30 min or less. That is a plan review fail when it is not met.
// The MEASURED CLOCK is informational. It runs from the first gas in with the zone closed up (no open head, drain
// or inspector's test) to the moment the zone is back at normal (the practical "set" point the game uses
// everywhere: normal minus 3.2 psi; that figure is not a sizing basis). It runs after a trip and riser reset (the
// valve is not set yet) and also on a zone that lost its air without tripping (s.rfill: below low air, then
// filling; that timer starts at the low-air crossing and is informational too).
// Nothing may key a goal, a review fail or a drill result to the measured clock: on a shared compressor the game
// fills every zone at the same time (DI.PARALLEL_SPLIT), so fills on a shared compressor can run over (the
// commissioning fills of the contract 5 reference build do) while the code check passes.
// s.fill1 = the first measured fill of the zone (commissioning), set once; s.fillTime = the last refill.
// Refrigerated spaces maintained below 5 F get 60 min instead of 30 (FP Lead, VERIFIED: 2019 / 2022 §8.2.6.3.3 and
// §8.2.6.8.5, 2025 §8.2.7.4). Per zone since Cycle 7 (FP Lead): a zone gets 60 min only when EVERY room it protects is
// a Freezer / Cold Dock room (DI.ROOMS.cold) with "maintained below 5 F" set (room.below5, default false). That
// "every room" reading is ASSUMED, NEEDS PE REVIEW. A cold dock that is not held below 5 F, a zone that also covers
// any other room, and every zone of a typical data center get 30 min. The old site-wide flag is gone (World.fromJSON deletes it from a save).
DI.REFILL_LIMIT = 1800;                 // seconds, all editions
DI.REFILL_LIMIT_COLD = 3600;            // seconds, a zone wholly in freezer rooms held below 5 F, all editions
DI.COLD_MIGRATED = 'The site refrigerated setting was replaced by a per-zone setting (freezer room held below 5 F). Your zones now use 30 min until a freezer room is set.';
DI.COLD_NOTE = 'The 60 min refill limit applies per zone, only in a freezer room held below 5 F. Set it on the room.';
// inf = the zone (S.sysd.info.get(id)). With no zone given the answer is the general 30 min.
DI.refrigerated = function (W, inf) {
  if (!W || !inf || !inf.rooms || !inf.rooms.size) return false;
  for (const r of inf.rooms) { const room = W.rooms[r - 1]; if (!room || room.type !== 'cold' || room.below5 !== true) return false; }
  return true;
};
DI.refillLimit = (W, inf) => (DI.refrigerated(W, inf) ? DI.REFILL_LIMIT_COLD : DI.REFILL_LIMIT);
DI.GAL_FT3 = 7.48052;                   // gallons per cubic foot
// minutes = the refill limit; margin = ASSUMED practice margin on the bare minimum, NEEDS PE REVIEW, not an NFPA factor
DI.AIR_SIZING = { minutes: 30, margin: 1.25 };
DI.sizingMinutes = (W, inf) => DI.refillLimit(W, inf) / 60;
DI.PARALLEL_SPLIT = 'SIMPLIFICATION: parallel split; real ECS per-riser AVC/restrictors feed concurrently';
// Air refill order (site setting W.cfg.refillSeq, default off, FP Lead, PRACTICE): off, every calling zone on a shared
// source fills at the same time (the parallel split above). On, a source serves one calling zone at a time: the
// largest zone volume first, ties by the lowest zone ID. The code check (DI.airSizing) does not change with it.
DI.refillSeq = (W) => !!(W && W.cfg && W.cfg.refillSeq === true);
DI.SEQ_NOTE = 'sequential refill: one zone at a time, largest first (PRACTICE)';
// The citation for the refill limit on this zone: the N2-only section where every source is a nitrogen generator
// (2025 has no separate N2-only clause: its key names the general section and says so, VERIFIED), and the 60 min
// sections where the zone is wholly in freezer rooms held below 5 F (DI.refrigerated).
// annex: add the Annex note that one compressor serving several systems is sized on the single largest system.
DI.refillRef = function (W, inf, annex) {
  const R = DI.setJuris(W).ref, n2 = !!inf && inf.src.length > 0 && inf.src.every((id) => { const p = W.parts.get(id); return p && p.type === 'n2'; }), cold = DI.refrigerated(W, inf);
  return (cold ? (n2 ? R.refillN2Cold : R.refillCold) : n2 ? R.refillN2 : R.refill) +
    (annex ? '; ' + R.refillAnnex + ' (one source serving several systems is sized on the single largest system)' : '');
};
// an opening that lets the air straight out: the refill clock does not run against one
DI.zoneOpen = (v, s) => !!((s.openK && s.openK.length) || v.p.sdrain || v.p.itc);
// is this zone closed up and filling toward normal, with its supply open?
DI.refilling = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id), inf = S.sysd.info.get(id);
  return !!(v && s && inf && v.type !== 'wetv' && s.state === 'dry' && (!s.set || s.rfill) && v.p.airValve && inf.src.length && !DI.zoneOpen(v, s));
};
// The measured clock of zone `id`, informational: { t, first, limit, over, running, tAlone, shared, ref }.
//   t       seconds on the clock now (running) or of the last refill (null: none yet)
//   first   the first measured fill, commissioning (null: none yet)
//   tAlone  minutes the largest zone on this supply needs when it is filled alone (the code check, DI.airSizing)
//   shared  how many other zones share a source with this one
DI.refillState = function (S, id) {
  const W = S.W, v = W.parts.get(id), s = S.ss.get(id), inf = S.sysd.info.get(id); if (!v || !s || !inf || v.type === 'wetv') return null;
  const running = s.state === 'dry' && (!s.set || !!s.rfill) && s.fillT0 >= 0, t = running ? S.t - s.fillT0 : s.fillTime > 0 ? s.fillTime : null, az = DI.airSizing(S, id);
  const L = DI.refillLimit(W, inf);
  return { t, first: s.fill1 > 0 ? s.fill1 : null, limit: L, over: t !== null && t > L, running, tAlone: az ? az.tAlone : null, shared: az ? az.shared : 0, ref: DI.refillRef(W, inf), seq: DI.refillSeq(W) };
};
// The inspector rows: [text, class]. first = the "First fill (commissioning)" row, else the "Last refill" row (which
// is the running clock while the zone is filling). A time over the limit is amber, never a fail: where the zones
// share a compressor and the largest one alone passes the code check, the row says why it ran over.
DI.refillText = function (S, id, first) {
  const r = DI.refillState(S, id), t = r ? (first ? r.first : r.t) : null; if (t === null) return ['-', ''];
  const m = DI.fmt(t / 60, 1), lim = DI.fmt(r.limit / 60), over = t > r.limit;
  const sized = ' NFPA 13 sizes the compressor for one system: the largest zone alone fills in about ' + Math.round(r.tAlone) + ' min, so the compressor is sized correctly';
  const why = !(over && r.shared && r.tAlone !== null && r.tAlone <= r.limit / 60) ? '' : r.seq ? ' - zones on a shared compressor fill one at a time, largest first (' + DI.SEQ_NOTE + '): a wait is part of this time and is not a code limit.' + sized
    : ' - zones fill together on a shared compressor (SIMPLIFICATION: parallel split).' + sized;
  if (!first && r.running) return [m + ' of ' + lim + ' min' + why, 'warn'];
  return over ? [m + ' min, over the ' + lim + ' min limit' + why, 'warn'] : [m + ' min of the ' + lim + ' min limit: OK', 'good'];
};
// The pressure a zone's air supply is sized for (FP Lead, Cycle 6). With an AVC (air maintenance device) regulating,
// it is the zone's normal set point: the cut-out never enters the minimum scfm. Only on a compressor direct to the
// system (no AVC, v.p.avc === 0: the small-compressor case) is it normal or the compressor cut-out if that is higher.
// The cut-out (compressor prop cutOut, psi, 0 = none, ASSUMED) is not a switch model (SIMPLIFICATION): the regulator in
// DI.gasPre holds the zone at normal, and an open AVC bypass drifts it to the cut-out.
DI.sizingP = function (S, id) {
  const W = S.W, v = W.parts.get(id), inf = S.sysd.info.get(id); let P = v.p.airSet;
  if (DI.avcFitted(v)) return P;
  for (const q of inf.src) { const c = W.parts.get(q); if (c && c.p.cutOut > P) P = c.p.cutOut; }
  return P;
};
// Where an open AVC bypass takes the zone (FP Lead, Cycle 7; ASSUMED): what its compressor can deliver. Per compressor
// that is its cut-out where one is set, else its rated max discharge (maxPsi; 0 = not modeled: DI.AVC_BYPASS_PSI,
// 60 psi) or its relief setpoint if that is lower. The zone goes to the highest of its compressors; with no compressor
// on the zone it is DI.AVC_BYPASS_PSI. HIGH AIR at the high setpoint comes in on the way and is the main signal.
DI.compLimit = (c) => (c.cutOut > 0 ? c.cutOut : Math.min(c.maxPsi > 0 ? c.maxPsi : DI.AVC_BYPASS_PSI, c.relief > 0 ? c.relief : Infinity));
DI.bypassTarget = function (W, inf) {
  let c = 0; for (const q of inf.src) { const p = W.parts.get(q); if (p && p.type === 'comp') c = Math.max(c, DI.compLimit(p.p)); }
  return c || DI.AVC_BYPASS_PSI;
};
// Air supply sizing for zone `id` (FP Lead): an ideal-gas screen, not a quoted NFPA equation.
//   min    = V_ft3 x (P / 14.7) / 30 on the governing zone: the bare minimum scfm (each zone with its own minutes: 60
//            for a zone wholly in freezer rooms held below 5 F, DI.sizingMinutes)
//   margin = min x 1.25 (ASSUMED practice, NEEDS PE REVIEW)
//   P      = DI.sizingP of the governing zone
//   gov    = the zone with the largest minimum among the zones that share any of this zone's sources: one compressor
//            serving several systems is sized on the single largest system (Annex)
//   have   = the sum of the ratings of this zone's own sources (an N2 generator counts: Simplification)
//   tAlone = minutes to fill the governing zone alone from 0 psig to P with the full capacity. THE CODE CHECK:
//            tAlone over 30 min (the same thing as have < min) is `below`, a plan review FAIL.
//   tight  = not below, and under the margin: a plan review warning.
// Returns null for a wet riser or a zone with no source.
DI.airSizing = function (S, id) {
  const W = S.W, inf = S.sysd.info.get(id), v = W.parts.get(id); if (!v || !inf || v.type === 'wetv' || !inf.src.length) return null;
  const need = (zid) => { const z = S.sysd.info.get(zid), gal = DI.zoneVolume(W, z), ft3 = gal / DI.GAL_FT3, P = DI.sizingP(S, zid), mins = DI.sizingMinutes(W, z); return { id: zid, gal, ft3, P, mins, min: ft3 * (P / DI.ATM) / mins }; };
  let gov = need(id), shared = 0;
  for (const [zid, z] of S.sysd.info) {
    if (zid === id || z.type === 'wetv' || !z.src.some((q) => inf.src.includes(q))) continue;
    shared++; const n = need(zid); if (n.min > gov.min) gov = n;
  }
  const have = inf.src.reduce((a, q) => a + (W.parts.get(q).p.scfm || 0), 0), margin = gov.min * DI.AIR_SIZING.margin, below = have < gov.min;
  return { have, P: gov.P, min: gov.min, margin, tAlone: have > 0 ? gov.ft3 * (gov.P / DI.ATM) / have : Infinity, limit: gov.mins, gov: gov.id, gal: gov.gal, ft3: gov.ft3, shared, below, tight: !below && have < margin };
};
// ---------- return to normal after the 24 h air test (FP Lead, Cycle 6; the Finish gate and the scoring are Cycle 7):
// do not hard-block, model the consequence, coach first, score only real consequences. ASSUMED company practice:
// NFPA 13 prescribes no bleed point for it.
//   Main drain (supply side of the clapper): never bleeds system air. Open with the control valve open it is a main
//   drain flow test: supply water flows, system pressure stays put.
//   System drain (downstream of the clapper): bleeds air fast and coarse, so it overshoots. The physics run.
//   The correct path is the trim air / test bleed (DI.bleedToNormal), or a refill where normal is above test pressure.
// The step ends only when the operator presses Finish (DI.returnFinish): nothing clears it by itself. DI.returnReady
// (the gate is met) only drives a hint. Scored while s.ret is true, one error per event (s.rtErr: [{ t, why, miss }]):
//   finish-early     Finish was pressed with the gate not met: refused, and each refused press is one error (ASSUMED).
//                    miss = what was missing: a drain open, not in the normal band, P still latched, a supervisory active
//   main-drain-flow  the main drain flowed supply water (not the Tests-button main drain test, which is deliberate)
//   low-air          pressure fell below low air (the low-air supervisory came in)
//   p-latch          pressure fell to P and latched it: the most severe while the valve holds
//   water-flow       the valve tripped during the step: water flow, a fire alarm signal. It ends the step.
// A drain opened and closed with no consequence is coaching only, also while the pressure passes through the band.
// One low-pressure episode is one event: its entry is raised to the most severe thing that came of it, never doubled.
// s.rtEv = index of the entry of the open low-pressure episode (null: none); s.rtDr = flags per drain opening.
// Scoring is independent of the time step: the consequences read the LOWEST pressure of the tick (s.rtMin, from
// s.rtP0, the pressure before the tick moved it), the event time is interpolated to the crossing, and Sim.step splits
// a long step into DI.RET_SUBSTEP pieces while a return-step system drain is still letting air out (DI.retDrainOpen).
// The names above are internal: player text comes from DI.rtLine and DI.RT_NAME only (Fire Tutor: no tags).
// The result is a practice `return` result on the valve: never a contract goal, never a contract star.
DI.RT_COACH = 'Use the trim air bleed to trim down to normal. Drains dump air too fast or flow supply water.';
DI.RT_RANK = { 'finish-early': 0, 'main-drain-flow': 1, 'low-air': 2, 'p-latch': 3, 'water-flow': 4 };
// Player text of each error: what happened, why it matters, how to avoid it. The P-latched, water-flow and clean-pass
// sentences are the Fire Tutor's, word for word. The low-air, main-drain-flow and finish-early sentences are written
// in the same form and are ASSUMED wording (Tutor to confirm).
DI.RT_TEXT = {
  'p-latch': 'Pressure fell to the trip point, so the panel latched the pressure-loss input. With detection also active, both release conditions were met and the valve would release. Restore air above low air before panel reset #2.',
  'water-flow': 'Water flow was detected. That sends a fire alarm signal. Keep the control valve closed until the head is replaced and the system is reset.',
  'low-air': 'Pressure fell below low air, so the low-air supervisory came in. The zone could not hold its air. Use the trim air bleed to come down to normal; drains dump air too fast.',
  'main-drain-flow': 'The main drain flowed supply water with the control valve open. That is a main drain flow test, and it bleeds no system air. Close it and use the trim air bleed.',
};
DI.RT_EARLY = ['Finish was pressed before the zone was ready: ', '. Close every drain, bring the pressure into the normal band above low air and above the P set point, reset P, clear the supervisory, then press Finish.'];
DI.RT_CLEAN = 'Clean return to normal. Air held above low air, both panel resets were done in order, drains were closed, the control valve is fully open, and supervision is back to normal.';
DI.RT_READY = 'All conditions met. Press Finish return to normal.';
// short names for the inspector row
DI.RT_NAME = { 'finish-early': 'Finish pressed too early', 'main-drain-flow': 'main drain flowed supply water', 'low-air': 'pressure fell below low air', 'p-latch': 'pressure fell to the P trip point', 'water-flow': 'water flow' };
// One error as player text. An entry from a save made before Cycle 7 (a drain left open when the zone was otherwise
// ready) reads as a Finish that was not possible yet.
DI.rtLine = function (e) {
  if (DI.RT_TEXT[e.why]) return DI.RT_TEXT[e.why];
  const miss = e.miss && e.miss.length ? e.miss : ['a drain is open'];
  return DI.RT_EARLY[0] + miss.join('; ') + DI.RT_EARLY[1];
};
DI.rtName = (e) => DI.RT_NAME[e.why] || DI.RT_NAME['finish-early'];
DI.rtClear = function (s) { s.rtErr = []; s.rtEv = null; s.rtDr = {}; delete s.rtMin; delete s.rtP0; };
// add an error, or raise the entry at index `at` to `why` if that is more severe. Returns the entry's index.
DI.rtNote = function (s, why, t, at) {
  const e = at !== undefined && at !== null ? s.rtErr[at] : null;
  if (e) { if (DI.RT_RANK[why] > (DI.RT_RANK[e.why] || 0)) e.why = why; return at; }
  s.rtErr.push({ t, why }); return s.rtErr.length - 1;
};
// gpm leaving the main drain of valve `id` (the supply-side emitter on its tile), as the main drain test reads it
DI.mdrainFlow = function (S, id) {
  const v = S.W.parts.get(id); if (!v || !S.G) return 0;
  const k = S.W.k(v.x, v.y); let q = 0; for (const e of S.G.emit) if (e.kind === 'mdrain' && e.k === k) q += e.link.q;
  return q;
};
// The Finish gate of the step, ALL of (FP Lead ruling 6): pressure in the normal band (not above normal + 1 psi, not
// under the "set" point), above low air and not above high air with no low-air supervisory, above the P set point
// with margin and the P latch reset (preaction: at the panel on El/El, at the trim on El/Pn), the air supply open
// AND the AVC bypass closed (the AVC regulating), no tamper on the zone's control valve, no air test running, and
// every drain closed. Returns { band, drains, why, miss, ok }: why = what still blocks it apart from the band and the
// drains, as short instructions (the inspector text is built from the same list); miss = everything that is not
// met, as plain statements (the text of a Finish pressed too early names them).
DI.returnGate = function (S, id) {
  const W = S.W, v = W.parts.get(id), s = S.ss.get(id), q = v.p, pre = v.type === 'prev', g = DI.ctrlValve(W, id), why = [], miss = [];
  const band = s.P <= q.airSet + 1 && s.P >= q.airSet - 3.2, drains = !!(q.drain || q.sdrain);
  if (drains) miss.push('a drain is open');
  if (!band) miss.push('the pressure is not in the normal band');
  if (pre && q.pLatch) { why.push('reset P ' + (q.trim === 'el-pn' ? 'at the trim' : 'at the panel')); miss.push('P is still latched'); }
  else if (pre && !(s.P > q.pTrip + DI.P_MARGIN)) { why.push('pressure is not ' + DI.P_MARGIN + ' psi above the P set point'); miss.push('the pressure is not ' + DI.P_MARGIN + ' psi above the P set point'); }
  if (s.lowAir || s.P < q.loAir) { why.push('clear the low-air supervisory'); miss.push('a supervisory is active: low air'); }
  if (s.P > q.hiAir) { why.push('high air'); miss.push('a supervisory is active: high air'); }
  if (!q.airValve) { why.push('open the air supply'); miss.push('the air supply is isolated'); }
  if (DI.avcBypassed(v)) { why.push('AVC bypass is open'); miss.push('the AVC bypass is open'); }
  if (g && g.p.open < 0.8) { why.push('control valve off normal'); miss.push('a supervisory is active: control valve off normal'); }
  if (S.procs.some((x) => x.kind === 'leak' && x.id === id)) { why.push('the air test is still running'); miss.push('the air test is still running'); }
  return { band, drains, why, miss, ok: band && !drains && !why.length };
};
// The hint only: every condition of the gate is met and the step waits for Finish.
DI.returnReady = (S, id) => { const s = S.ss.get(id), v = S.W.parts.get(id); return !!(s && v && s.ret && v.type !== 'wetv' && DI.returnGate(S, id).ok); };
// The pending "return to normal set point" step of zone `id` after a 24 h air test: null, or { mode, text }.
//   bleed    the pipe is more than 1 psi above normal: bleed at the trim (the button). Not the main drain, and never
//            the control valve: that is the water supply side.
//   refill   the pipe is below its normal band (a normal raised after the test, an overshoot through the system
//            drain, or an old save): the open supply brings it up.
//   confirm  in the normal band, and something DI.returnGate checks is still off: the text lists it.
//   ready    every condition is met: press Finish (DI.returnFinish). The step never ends by itself.
DI.returnStep = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id); if (!v || !s || !s.ret || v.type === 'wetv') return null;
  const q = v.p, pre = v.type === 'prev', G = DI.returnGate(S, id), todo = G.why.concat(G.drains ? ['close every drain'] : []);
  if (s.P > q.airSet + 1) return { mode: 'bleed', text: 'return to normal set point: bleed to ' + q.airSet + ' psi at the trim (test bleed), not the main drain; never open the control valve to bleed air; then confirm above low air (' + q.loAir + ' psi)' + (pre ? ', above the P set point (' + q.pTrip + ' psi)' : '') + ', AVC in auto, supervisory clear, every drain closed, and press Finish.' };
  if (s.P < q.airSet - 3.2) { const rest = todo.filter((t) => t !== 'clear the low-air supervisory' && t !== 'pressure is not ' + DI.P_MARGIN + ' psi above the P set point'); return { mode: 'refill', text: 'refill to ' + q.airSet + ' psi: leave the air supply open' + (rest.length ? '; still to do: ' + rest.join('; ') : '') + '; then press Finish' }; }
  if (G.ok) return { mode: 'ready', text: DI.RT_READY };
  return { mode: 'confirm', text: 'at ' + DI.fmt(s.P, 1) + ' psi, still to do: ' + todo.join('; ') + ', then press Finish return to normal' };
};
// DI.RET_SUBSTEP (seconds, ASSUMED; SIMPLIFICATION, PRACTICE): while a system drain is letting air out of a zone in the
// return step, Sim.step splits any longer step into pieces of this size, so a coarse step (a time-skip, a test
// calling S.step(1)) cannot overshoot a bleed the player could have stopped. The main drain moves no system air and
// a pipe already at 0 psi has nothing left to resolve, so neither needs the split.
DI.RET_SUBSTEP = 0.1;
DI.retDrainOpen = function (S) {
  for (const [id, s] of S.ss) { if (!s.ret || s.state !== 'dry') continue; const v = S.W.parts.get(id); if (v && v.p.sdrain && s.P > DI.SAFE_PSI) return true; }
  return false;
};
// One tick of the step (DI.gasPre calls it while s.ret is true, after the P sensor): coaching and the scored
// events. It never ends the step and never moves gas. pl0 = the P latch as it was before this tick; dt = the tick.
DI.returnWatch = function (S, id, v, s, pl0, dt) {
  const W = S.W, q = v.p, pre = v.type === 'prev', nm = DI.sysName(S, id);
  if (!Array.isArray(s.rtErr)) s.rtErr = []; if (!s.rtDr) s.rtDr = {}; if (s.rtEv === undefined) s.rtEv = null;
  const D = s.rtDr, test = S.procs.some((x) => x.kind === 'drain' && x.id === id);       // the Tests-button main drain test: never coached, never an error
  const md = !!q.drain && !test, sd = !!q.sdrain, coach = () => { S.say(DI.RT_COACH, 'warn'); S.act('return-coach', id); };
  // the lowest pressure of this tick, and the time it crossed a threshold on the way down (interpolated)
  const P0 = s.rtP0 !== undefined && s.rtP0 !== null ? s.rtP0 : s.P, lo = s.rtMin = Math.min(P0, s.P);
  const cross = (th) => (P0 > th && s.P < th && dt > 0 ? S.t - dt * (1 - (P0 - th) / (P0 - s.P)) : S.t);
  // 1. coaching, once per opening, no score
  if (md && !D.m) { D.m = 1; coach(); } else if (!md && D.m) { delete D.m; delete D.me; delete D.mf; }
  if (sd && !D.s) { D.s = 1; coach(); } else if (!sd && D.s) delete D.s;
  // 2. the low-pressure episode: one error, raised to the P latch if the pressure reaches P inside it
  if (s.set && lo < q.loAir && s.rtEv === null) s.rtEv = DI.rtNote(s, 'low-air', cross(q.loAir));
  const latched = pre && q.pLatch && !pl0;
  if (latched || (pre && s.armed && lo < q.pTrip)) {
    const e = s.rtEv !== null ? s.rtErr[s.rtEv] : null;
    if (e ? e.why !== 'p-latch' : latched) {
      if (e) DI.rtNote(s, 'p-latch', S.t, s.rtEv); else DI.rtNote(s, 'p-latch', cross(q.pTrip));       // (no open episode: setpoints out of order)
      S.say('One fire signal from flow: P latched on ' + nm + ' during the return to normal. Detection alone would now open the valve. Refill, then reset P ' + (q.trim === 'el-pn' ? 'at the trim' : 'at the panel') + '.', 'bad');
    }
  }
  if (s.rtEv !== null && s.P >= q.loAir) s.rtEv = null;
  // 3. the main drain flowing supply water, once per opening
  const g = DI.ctrlValve(W, id);
  if (md && !D.mf && (!g || g.p.open > 0.02) && DI.mdrainFlow(S, id) > 1) {
    D.mf = 1; D.me = DI.rtNote(s, 'main-drain-flow', S.t, D.me);
    S.say(nm + ': the main drain is flowing supply water. It is on the supply side of the clapper and bleeds no system air. Close it and use the trim air bleed.', 'warn');
  }
  // 4. the hint, once each time the gate comes true: the step itself waits for Finish
  if (DI.returnGate(S, id).ok) { if (!D.rdy) { D.rdy = 1; S.say(nm + ': ' + DI.RT_READY, 'good'); } } else if (D.rdy) delete D.rdy;
};
// File (or refresh) the practice `return` result of zone `id` with the errors so far. done = the step is over.
DI.returnResult = function (S, id, errs, done) {
  const nm = DI.sysName(S, id), lines = errs.length ? errs.map((e) => DI.clock(e.t) + ' ' + DI.rtLine(e)) : [DI.RT_CLEAN];
  let res = null; for (let i = S.results.length - 1; i >= 0; i--) { const r = S.results[i]; if (r.kind === 'return' && r.id === id) { if (r.open) res = r; break; } }
  if (!res) { res = { kind: 'return', id }; S.results.push(res); }
  Object.assign(res, { t: S.t, name: nm, pass: done && !errs.length, title: 'Return to normal', say: 0, errs: errs.map((e) => Object.assign({}, e)), lines, open: !done });
  if (done) delete res.open;
  return res;
};
// The Finish button (FP Lead, Cycle 7; PRACTICE). It ends the step only when every condition of DI.returnGate holds:
// then it logs `return-normal` with the errors of the step and files the practice result. Pressed too early it is
// refused, the press is scored as one error naming what was missing (each refused press counts: ASSUMED), and the
// step stays pending. Returns '' or the refusal text.
DI.returnFinish = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id); if (!v || !s || !s.ret || v.type === 'wetv') return 'No return to normal is pending on this zone.';
  const pre = v.type === 'prev', nm = DI.sysName(S, id), G = DI.returnGate(S, id);
  if (!Array.isArray(s.rtErr)) s.rtErr = [];
  if (!G.ok) {
    const e = s.rtErr[DI.rtNote(s, 'finish-early', S.t)]; e.miss = G.miss.slice();
    const text = DI.rtLine(e); S.say(nm + ': ' + text, 'warn'); S.act('return-early', id, { miss: e.miss.slice() });
    DI.bus.emit('result', DI.returnResult(S, id, s.rtErr, false)); return text;
  }
  const errs = s.rtErr.map((e) => Object.assign({}, e));
  s.ret = false; DI.rtClear(s); S.act('return-normal', id, { err: errs.length, errs });
  S.say(nm + ': Returned to normal set point: ' + DI.fmt(s.P, 1) + ' psi, above low air' + (pre ? ' and the P set point' : '') + ', supervisory clear.', 'good');
  const res = DI.returnResult(S, id, errs, true);
  S.say(res.title + ': ' + (res.pass ? 'no errors' : errs.length + ' error(s)') + ' (practice)', res.pass ? 'good' : 'warn'); DI.bus.emit('result', res);
  return '';
};
// The valve tripped during the step: water flow. It is the most severe consequence and it ends the step (the
// recovery checklist takes over). Called by DI.gasPre.
DI.returnAbort = function (S, id, s) {
  if (!Array.isArray(s.rtErr)) s.rtErr = [];
  DI.rtNote(s, 'water-flow', s.tripT >= 0 ? s.tripT : S.t, s.rtEv);
  const errs = s.rtErr.map((e) => Object.assign({}, e));
  s.ret = false; DI.rtClear(s); S.act('return-normal', id, { err: errs.length, errs, aborted: true });
  const res = DI.returnResult(S, id, errs, true);
  S.say(DI.sysName(S, id) + ': the return to normal ended with the valve tripped. ' + DI.RT_TEXT['water-flow'], 'bad'); DI.bus.emit('result', res);
};
// After a 24 h air test the zone is returned to its normal set point (FP Lead). Above normal, the operator bleeds
// it at the trim air / test bleed: a small bleed, not the 2 in. drain and never the control valve. This function is
// that bleed and touches the gas in the pipe only. It snaps to normal (SIMPLIFICATION) and is never an error.
// It also brings a zone down from high air after an AVC bypass was left open.
DI.bleedToNormal = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id), inf = S.sysd.info.get(id);
  if (!v || !s || v.type === 'wetv' || s.state !== 'dry') return 'Nothing to bleed: the valve is not set with gas in the pipe.';
  if (s.P <= v.p.airSet) return 'The pipe is already at or below normal pressure.';
  const Vg = Math.max(inf.vol - s.wat, 0.02 * inf.vol), x = s.G > 0 ? s.o2g / s.G : 0.209;
  s.G = (v.p.airSet + DI.ATM) * Vg; s.o2g = x * s.G; s.P = v.p.airSet; s.ref = s.P;
  S.say(DI.sysName(S, id) + ': bled at the trim to ' + v.p.airSet + ' psi, the normal pressure.', '');
  return '';
};
DI.setSolOut = function (S, id, v) {
  const on = DI.relState(S.W, v).sol;
  if (on && !v.p.solOut) S.say('Releasing panel energized the solenoid on ' + DI.sysName(S, id) + (v.p.trim === 'el-pn' ? ' (electric leg). Water still needs P at the pneumatic actuator.' : '.'), 'bad');
  v.p.solOut = on;
};
// An incident on a preaction system starts with an operated head, a latched P or a trip, and stays open
// until the system is back in service. The recovery score (DI.recoveryScore) reads the log between them.
DI.incident = function (S, id, s, why) {
  if (s.inc) return; s.inc = true; s.airLost = true;
  const q = S.W.parts.get(id).p; S.act('incident', id, { why, det: !!(q.sol || q.pull || q.mrzL) });     // det: D or the zone was already latched
};


DI.gasPre = function (S, dt) {
  const W = S.W, info = S.sysd.info;
  // 1. who is calling for gas? (pressure switch with 3 psi dead band)
  // callers = how many zones call on each source (the parallel split). With sequential refill on (DI.refillSeq) a
  // source serves one calling zone at a time: head = that zone, the largest zone volume, ties by the lowest zone ID.
  const callers = new Map(), seq = DI.refillSeq(W), head = new Map();
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = info.get(id);
    if (!v || v.type === 'wetv' || s.state === 'wet' || inf.vol <= 0) { s.call = false; continue; }
    // a zone being charged for the 24 h air test is held at the test pressure, with no dead band
    // with the AVC bypass open the AVC does not regulate: the target is the source's own limit (DI.bypassTarget)
    const chg = DI.airCharging(S, id), tgt = s.tgt = chg ? DI.airTarget(S, id, v) : DI.avcBypassed(v) ? DI.bypassTarget(W, inf) : v.p.airSet;
    if (chg) s.call = s.P < tgt; else if (s.P >= tgt) s.call = false; else if (s.P < tgt - 3) s.call = true;
    if (!v.p.airValve) s.call = false;
    if (s.call) for (const sid of inf.src) {
      const src = W.parts.get(sid);
      if (src.type === 'comp' && inf.hasN2 && s.P > v.p.airSet - 8) continue;   // compressor only does the bulk fill
      callers.set(sid, (callers.get(sid) || 0) + 1);
      if (seq) { const h = head.get(sid), vol = DI.zoneVolume(W, inf); if (!h || vol > h.vol + 1e-9 || (Math.abs(vol - h.vol) <= 1e-9 && id < h.id)) head.set(sid, { id, vol }); }
    }
  }
  for (const p of W.parts.values()) if (p.type === 'comp' || p.type === 'n2') {
    const on = (callers.get(p.id) || 0) > 0 && S.powered(p) && !p.p.fault;
    if (on && !p.p.on) p.p.starts++;
    p.p.on = on; if (on) p.p.runSec += dt;
  }
  // 2. per-system gas balance and trip logic
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = info.get(id); if (!v || inf.vol <= 0) continue;
    const V = inf.vol;
    if (s.spkVer !== S.spkVer || s.ver !== S.ver) { s.openK = inf.tiles.filter((k) => W.spk[k] >= 2); s.spkVer = S.spkVer; s.ver = S.ver; }
    const pre = v.type === 'prev'; let dark = false;
    if (pre) {
      // recovery log: edge-detect what the operator did, whoever did it (UI, bot or test)
      const nOpen = s.openK.length; if (nOpen > (s.nOpen || 0)) { DI.incident(S, id, s, 'head'); S.act('head-open', id); } s.nOpen = nOpen;
      if (!!v.p.sdrain !== !!s.sdr) { s.sdr = !!v.p.sdrain; S.act(s.sdr ? 'drain' : 'drain-close', id); s.dz = false; }
      // "confirm 0 psi and no water" is automatic (Simplification): logged once per drain opening
      if (s.sdr && !s.dz && s.state !== 'wet' && s.P <= DI.SAFE_PSI && s.wat <= DI.dryLim(V)) {
        s.dz = true; S.act('drain-zero', id);
        if (s.inc) S.say(DI.sysName(S, id) + ': drain open, gauge at 0 psi, no water in the pipe.', 'good');
      }
      const av = v.p.airValve ? 1 : 0; if (s.av === undefined) s.av = av;
      if (av !== s.av) { s.av = av; if (!S.procs.some((q) => q.kind === 'leak' && q.id === id)) S.act(av ? 'supply-open' : 'isolate-air', id); }
      const det = !!(v.p.sol || v.p.pull || v.p.mrzL); if (det && !s.det) { s.dT = S.t; S.act('det-latch', id); } s.det = det;
      // An electric / electric trim keeps the P latch in panel memory. A dead panel holds nothing (ASSUMED
      // simplification): the latch is lost, and when power returns the panel reads PSL-REL again, so P comes
      // back on that tick if the pipe is still low. Power coming back is not a release; the inputs are.
      const pn = W.panelOf(id); dark = v.p.trim === 'el-el' && !!pn && pn.p.alive === false;
      if (dark) { v.p.pLatch = false; s.pDark = true; }
      else if (s.pDark) {
        s.pDark = false; const back = s.state === 'dry' && !!s.armed && s.P < v.p.pTrip;
        S.say('Panel power restored: inputs re-read. P ' + (back ? 'returns (pipe still below P trip)' : 'is clear') + ' on ' + DI.sysName(S, id) + '.', back ? 'warn' : '');
      }
      if (s.state !== 'dry' || s.P < v.p.loAir) s.airLost = true;
      else if (s.airLost && s.set && s.P >= v.p.airSet - 3.2 && !nOpen && !v.p.sdrain && !v.p.itc && (v.p.airValve || !inf.src.length)) { s.airLost = false; S.act('restore-air', id); }   // normal pressure, supply open, every opening shut
      if (s.inc && s.state === 'dry' && s.set && !v.p.pLatch && !nOpen && !s.airLost) { s.inc = false; S.act('in-service', id); }
      DI.setSolOut(S, id, v);
    }
    if (s.state === 'wet') continue;
    const Vg = Math.max(V - s.wat, 0.02 * V), frac = s.wat / V;
    if (s.ret && !S.settling) s.rtP0 = s.P;             // the pressure before this tick moves it (DI.returnWatch reads the lowest of the tick)
    let inAir = 0, inN2 = 0;
    if (s.call) for (const sid of inf.src) {
      const src = W.parts.get(sid); if (!src.p.on) continue;
      if (src.type === 'comp' && inf.hasN2 && s.P > v.p.airSet - 8) continue;
      const f = seq ? (head.get(sid).id === id ? src.p.scfm : 0) : src.p.scfm / callers.get(sid);
      if (src.type === 'n2') inN2 += f; else inAir += f;
    }
    // outlets that are still passing gas (water has not reached them yet)
    let big = 0;
    for (const k of s.openK) if (s.state === 'dry' || frac < S.sysd.reach(id, k)) big += DI.A_SPK;
    if (v.p.itc && inf.remote >= 0 && (s.state === 'dry' || frac < S.sysd.reach(id, inf.remote))) big += DI.A_SPK;
    if (v.type !== 'wetv' && v.p.sdrain) big += 1.5 * v.p.sdrain;
    let small = v.type === 'wetv' ? 0.05 : V * 6e-9 * (1 + 2 * s.corr) + (s.holes || 0) * 2e-5;
    for (const lk of S.leaks) if (lk.sys === id) small += lk.a || 0;
    const purge = v.type !== 'wetv' && v.p.vent && v.p.airValve && inf.hasN2 && s.P > 5 && s.o2g / s.G > 0.0195 ? 6e-5 : 0;
    const out = DI.gasFlow(big + small + purge, s.P);
    const x = DI.clamp(s.o2g / s.G, 0, 0.209);
    // the air maintenance device is a regulator: it never fills past the set pressure
    const gOut = out * DI.SCFM * dt, room = Math.max(0, (v.type === 'wetv' ? 0 : (s.tgt || v.p.airSet) + DI.ATM) * Vg - s.G + gOut);
    const gInRaw = (inAir + inN2) * DI.SCFM * dt, gIn = Math.min(gInRaw, room), o2in = gInRaw > 0 ? (inAir * 0.209 + inN2 * DI.N2_O2) / (inAir + inN2) : 0;
    if (gInRaw > gIn) for (const sid of inf.src) { const src = W.parts.get(sid); if (!src.p.on || (seq && (!head.get(sid) || head.get(sid).id !== id))) continue; src.p.runSec -= dt * (1 - gIn / gInRaw) / (seq ? 1 : Math.max(1, callers.get(sid) || 1)); }
    s.o2g += gIn * o2in - gOut * x;
    s.G += gIn - gOut;
    if (s.G < DI.ATM * Vg) { s.o2g += (DI.ATM * Vg - s.G) * 0.209; s.G = DI.ATM * Vg; }   // air drawn back in
    s.o2g = DI.clamp(s.o2g, 0, 0.209 * s.G);
    s.P = s.G / Vg - DI.ATM;
    s.gasOut = out; s.gasIn = inAir + inN2;
    if (big > 0 && s.openT < 0) s.openT = S.t;
    if (v.type === 'wetv') continue;
    const pl0 = pre && !!v.p.pLatch;
    s.lowAir = s.set && s.P < v.p.loAir;         // supervisory only: follows live pressure, never a release input
    if (s.state !== 'dry') { s.rfill = false; if (s.ret) DI.returnAbort(S, id, s); continue; }
    // refill clock of a zone that lost its air while set (no trip): starts below low air, ends back at normal
    if (s.set) {
      if (!s.rfill && s.P < Math.min(v.p.loAir, v.p.airSet - 3.2)) { s.rfill = true; s.fillT0 = -1; s.fillTime = -1; }
      if (s.rfill) {
        if (DI.zoneOpen(v, s)) s.fillT0 = -1; else if (s.fillT0 < 0 && s.gasIn > 0) s.fillT0 = S.t;
        if (s.P >= v.p.airSet - 3.2) { s.rfill = false; if (s.fillT0 >= 0) { s.fillTime = S.t - s.fillT0; if (!(s.fill1 > 0)) s.fill1 = s.fillTime; } }
      }
    }
    // P sensor (PSL-REL switch or PA-REL actuator): a pure threshold on pipe pressure. No outlet-type test and
    // no rate term: a sprinkler, an open inspector's test and a broken pipe all look the same to it, and a
    // slow leak the compressor holds never reaches the setpoint. It latches until a manual reset: the panel
    // on an electric / electric trim, the actuator at the trim on electric / pneumatic. The sensor is live
    // from the first time the valve is set (commissioning), so after a riser reset the empty pipe reads low
    // and an early reset latches straight back.
    if (pre) {
      if (s.set) s.armed = true;
      if (!dark && s.armed && !v.p.pLatch && s.P < v.p.pTrip) {
        v.p.pLatch = true; v.p.pT = S.t; DI.incident(S, id, s, 'P');
        S.say(DI.sysName(S, id) + ': P latched (' + DI.fmt(s.P, 1) + ' psi, ' + DI.trimOf(v).sensor + '). It stays latched until ' + DI.pResetText(v) + '.', 'warn');
      }
      DI.setSolOut(S, id, v);
    }
    // After a 24 h air test: the return to the normal set point (s.ret). Coaching and the scored events are
    // DI.returnWatch; it reads the drains and never moves gas. The step ends with Finish (DI.returnFinish) only.
    // (not during the settle of a load: that is not game time, and nothing may be coached or scored in it)
    if (s.ret && !S.settling) DI.returnWatch(S, id, v, s, pl0, dt);
    // Mechanical emergency release at the trim: a person opens the valve directly, outside the panel
    // logic. No detection and no P involved, and it works with a dead panel. Water then flows only
    // where a sprinkler is open. Simplification: with every head closed the trapped air is not vented.
    let why = pre && v.p.mech ? 'mechanical emergency release at the trim' : '', zf = '';
    if (!why) {
      if (!s.set) {
        if (DI.zoneOpen(v, s)) s.fillT0 = -1; else if (s.fillT0 < 0 && s.gasIn > 0) s.fillT0 = S.t;
        if (s.P >= v.p.airSet - 3.2) { s.set = true; s.ref = s.P; if (s.fillT0 >= 0) { s.fillTime = S.t - s.fillT0; if (!(s.fill1 > 0)) s.fill1 = s.fillTime; } S.say(DI.sysName(S, id) + ' is pressurized and in service (' + DI.fmt(s.P) + ' psi)' + (pre && v.p.pLatch ? '. P is still latched: reset ' + (v.p.trim === 'el-pn' ? 'the actuator at the trim' : 'the releasing panel') + '.' : ''), pre && v.p.pLatch ? 'warn' : 'good'); }
        continue;
      }
      // trip logic, evaluated only while the valve is set and pressurized
      const ps = S.pin(id);
      s.ref = s.P > s.ref ? s.P : s.ref + (s.P - s.ref) * Math.min(1, dt / 120);
      if (v.type === 'dryv') {
        if (s.P < ps / DI.DRY_RATIO) why = 'air fell below the trip point (' + DI.fmt(ps / DI.DRY_RATIO, 1) + ' psi)';
        else if (v.p.qod && s.ref - s.P > 2.5) why = 'accelerator sensed the pressure drop';
        zf = 'low-air';
      } else {
        // Preaction is double interlock only:  trip := (D AND P) OR the Manual Release zone (9(c) flag, El/El).
        const rs = DI.relState(W, v);
        if (rs.mrz) { why = 'Manual Release zone (bypasses P)'; zf = 'manual-release'; }       // per-project flag, default OFF, NEEDS PE REVIEW
        else if (rs.open) { why = 'detection (or manual detection station) AND P (pipe pressure below ' + v.p.pTrip + ' psi)'; zf = v.p.pT >= s.dT ? 'false-alarm' : 'low-air'; }   // low-air: P was latched before D
      }
    }
    if (why) {
      s.state = 'filling'; s.tripT = S.t; s.set = false; v.p.tripped = true; S.dirty = true;
      if (pre) DI.incident(S, id, s, 'trip');
      S.act('trip', id);
      // A trip with every outlet closed and no fire fills the pipe and discharges nothing: a water-filled
      // zone. It is reported once water has entered (DI.gasPost), unless a head opens first.
      s.zf = zf && !s.openK.length && !v.p.itc && !S.fires.length && !S.leaks.some((l) => l.sys === id) && !S.procs.some((q) => q.kind === 'trip' && q.id === id) ? zf : '';
      S.say(DI.sysName(S, id) + ' TRIPPED: ' + why, 'bad'); DI.bus.emit('trip', id);
    }
  }
};

// Practice only (Fire Tutor, word for word): shown as a banner when water leaves through an open head after a reopen.
DI.FLOOD_BANNER = 'PRACTICE: You reopened the control valve with a head still open. Water flowed out of that head. Close the valve and finish the recovery in order.';
DI.gasPost = function (S, dt) {
  const W = S.W, G = S.G, net = G.net;
  const outBy = new Map();
  for (const e of G.emit) if (e.sys) outBy.set(e.sys, (outBy.get(e.sys) || 0) + e.link.q);
  for (const [id, s] of S.ss) {
    const v = W.parts.get(id), inf = S.sysd.info.get(id); if (!v || inf.vol <= 0) { s.flow = 0; continue; }
    const V = inf.vol, l = G.partLink.get(id), qIn = l && l.open ? l.q : 0, qOut = outBy.get(id) || 0;
    s.flow = qIn; s.qOut = qOut;
    // Practice only: a control valve was reopened (DI.setGate) with a head open on a zone that would not hold. The
    // warning let it happen; once water is actually leaving through the head the log says why, once per reopen.
    // The watch ends when the valve is closed again (DI.setGate) or the zone is ready before any water flows.
    if (s.floodW !== undefined) {
      const head = !!(s.openK && s.openK.length);
      if (head && qOut > 1) {
        const k = s.floodK || 0, skip = ['replace the head (step 7)'];
        if (k & 2) skip.push('reset the valve at the riser (step 8)'); if (k & 4) skip.push('panel reset #2 and P (step 12)');
        S.say('Water entered the zone through the open head (about ' + DI.fmt(qOut) + ' gpm) because the control valve was reopened before the recovery was done. Skipped: ' + skip.join('; ') +
          '. Correct order: replace the head (step 7), reset the valve at the riser (step 8), panel reset #2 to clear P (step 12), then open the control valve (step 13). In a data hall this is water on the IT load.', 'warn');
        S.act('reopen-flood', id, { gpm: qOut }); delete s.floodW; delete s.floodK; DI.bus.emit('banner', DI.FLOOD_BANNER);
      }
      else if (!head && !DI.zoneReady(S, id)) { delete s.floodW; delete s.floodK; }
    }
    const nd = G.partNode.get(id), po = nd && nd[1] >= 0 ? net.P[nd[1]] : 0;
    if (s.state === 'filling') {
      s.wat += (qIn - qOut) * dt / 60;
      const dr = v.type === 'wetv' ? v.p.drain : v.p.sdrain;
      if (dr && po < 1.5) s.wat -= 45 * dr * dt / 60;                       // gravity drain once pressure is gone
      s.wat = DI.clamp(s.wat, 0, V);
      const Vg = Math.max(V - s.wat, 0.02 * V), pn = Math.max(s.G, DI.ATM * Vg) / Vg - DI.ATM;
      const nodes = G.sysNodes.get(id);
      if (nodes && nodes.length) { let avg = 0; for (const i of nodes) avg += net.P[i]; avg /= nodes.length; const d = pn - avg; for (const i of nodes) net.pPrev[i] = Math.max(0, net.pPrev[i] + d); }
      s.P = pn;
      if (qOut > 1 && s.waterT < 0) s.waterT = S.t;
      // the system drain is a water outlet only while water is at it: the graph follows this flag
      const dw = s.wat > DI.dryLim(V); if (dw !== s.dw) { s.dw = dw; if (v.type !== 'wetv' && v.p.sdrain) S.dirty = true; }
      if (s.zf) {
        if ((s.openK && s.openK.length) || S.leaks.some((l) => l.sys === id)) s.zf = '';          // an outlet opened: this is a discharge
        else if (dw) {
          S.act('zone-filled', id, { why: s.zf });
          for (let i = S.acts.length - 1; i >= 0; i--) if (S.acts[i].kind === 'incident' && S.acts[i].id === id) { S.acts[i].why = 'fill'; break; }
          S.say(DI.sysName(S, id) + ' is water-filled: no head is open, so nothing discharges. ' + (s.zf === 'manual-release' ? 'The Manual Release zone let the water in without P; it is not a discharge.' : 'This is an unattended low-air failure, not a discharge.') +
            ' Drain it, reset it, check for freeze and corrosion exposure, and fix the air supply.', 'bad');
          s.zf = '';
        }
      }
      // water front reaching another open outlet changes the network
      let nr = 0; const fr = s.wat / V;
      for (const k of s.openK || []) if (fr >= S.sysd.reach(id, k)) nr++;
      if (v.p.itc && inf.remote >= 0 && fr >= S.sysd.reach(id, inf.remote)) nr++;
      for (const lk of S.leaks) if (lk.sys === id && fr >= S.sysd.reach(id, lk.k)) nr++;
      if (nr !== s.nReach) { s.nReach = nr; S.dirty = true; }
      if (s.wat >= 0.985 * V) { s.state = 'wet'; s.wat = V; S.dirty = true; if (v.type !== 'wetv') s.moist = 1; }
    } else if (s.state === 'wet') {
      s.P = po;
      if (qOut > 1 && s.waterT < 0) s.waterT = S.t;
      if (qOut - qIn > 1 && po < 1.5) { s.state = 'filling'; s.wat = 0.984 * V; s.G = DI.ATM * 0.02 * V; s.o2g = 0.209 * s.G; S.dirty = true; }
    }
    // waterflow alarm: vane switch with ~30 s retard on wet risers, pressure switch on dry / preaction
    if (v.type === 'wetv') { s.flowT = Math.abs(qIn) > 8 ? s.flowT + dt : Math.max(0, s.flowT - 2 * dt); s.alarm = s.flowT >= 30; }
    // (air pressure alone behind a tripped clapper is not waterflow: there must be water in the pipe or moving)
    else s.alarm = s.state !== 'dry' && po > 4 && (s.wat > DI.dryLim(V) || Math.abs(qIn) > 1 || qOut > 1);
    if (s.alarm && !(s.alarmT >= 0)) s.alarmT = S.t; else if (!s.alarm) s.alarmT = -1;
  }
};

// Player actions on a tripped / drained valve
DI.resetValve = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id), inf = S.sysd.info.get(id);
  if (!v || v.type === 'wetv') return 'Wet risers have nothing to reset.';
  if (s.state === 'dry') return 'Valve is already set.';
  if (s.wat > 0.01 * inf.vol + 0.2) return 'System still holds ' + DI.fmt(s.wat) + ' gal. Close the control valve and open the system drain first.';
  if (Math.abs(s.flow) > 1) return 'Water is still flowing through the valve. Close the control valve first.';
  if (v.type === 'prev' && (v.p.sol || v.p.pull || v.p.mrzL)) return 'Detection is still active (solenoid, manual station or Manual Release zone). Reset the releasing panel first.';
  if (s.openK && s.openK.length) return 'Replace the ' + s.openK.length + ' operated sprinkler(s) first.';
  s.state = 'dry'; s.wat = 0; s.G = DI.ATM * inf.vol; s.o2g = 0.209 * s.G; s.P = 0; s.set = false; s.fillT0 = -1; s.fillTime = -1;
  s.tripT = -1; s.openT = -1; s.waterT = -1; s.moist = 1; s.zf = ''; v.p.tripped = false; v.p.itc = 0; S.dirty = true;
  // The riser reset closes the clapper and the mechanical emergency release. It never clears P: that is
  // the releasing panel on an electric / electric trim and the actuator at the trim on electric / pneumatic.
  // The clapper is reset with the system drain still open (FP Lead): the drain is left as the operator has
  // it and is closed as its own step afterwards. Air cannot build until it is closed.
  if (v.type === 'prev') v.p.mech = false;
  S.act('reset-valve', id);
  S.say(DI.sysName(S, id) + ' clapper reset. ' + (v.p.sdrain ? 'Close the system drain, then restore the air.' : v.p.airValve ? 'Re-pressurizing.' : 'Restore the air / N2 supply to refill.') + (v.type === 'prev' ? ' P stays latched until the air is back and ' + DI.pResetText(v) + '.' : ''), 'good');
  return '';
};

// How a latched P is cleared on this valve's trim (the only path that exists for it).
DI.pResetText = (v) => (v.p.trim === 'el-pn' ? 'the actuator is reset at the trim' : 'the releasing panel is reset');
// Electric / pneumatic trim: P is the pneumatic actuator at the valve. A panel reset cannot clear it.
// Restore the air, then reset the actuator here. If the pipe is still below P trip it latches again.
DI.resetTrimP = function (S, id) {
  const v = S.W.parts.get(id), s = S.ss.get(id);
  if (!v || v.type !== 'prev') return 'Only a preaction valve has a P sensor to reset.';
  if (v.p.trim !== 'el-pn') return 'On an electric / electric trim P is latched in the releasing panel. Reset the panel.';
  const low = s && s.state === 'dry' && s.armed && s.P < v.p.pTrip;
  v.p.pLatch = false; S.act('reset-trim', id);
  S.say(DI.sysName(S, id) + ': pneumatic actuator reset at the trim.' + (low ? ' The pipe is still below P trip, so it latches again.' : ''), low ? 'warn' : 'good');
  return '';
};

DI.sysName = function (S, id) {
  const v = S.W.parts.get(id), inf = S.sysd.info.get(id);
  const kind = { wetv: 'Wet system', dryv: 'Dry system', prev: 'Preaction system' }[v.type];
  let where = '';
  if (inf && inf.rooms.size) where = ' - ' + [...inf.rooms].map((r) => S.W.rooms[r - 1].name).slice(0, 2).join(' + ');
  return kind + ' #' + id + where;
};
