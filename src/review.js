// Plan review: static rule checks on the design. Each finding cites where the rule comes from.
// sev: 'fail' (code / will not work), 'warn' (bad practice or owner standard), 'ok'.
var DI = globalThis.DI || (globalThis.DI = {});

DI.review = function (S) {
  const W = S.W, out = [], sd = S.sysd;
  const J = DI.setJuris(W), R = DI.ref13;       // citations follow the site's enforced edition
  const add = (sev, text, ref, x, y) => out.push({ sev, text, ref: ref || '', x, y });
  // --- coverage
  for (const room of W.rooms) {
    const rt = DI.ROOMS[room.type];
    if (room.exempt || rt.open) { room.cov = 1; continue; }
    const { need, have, orphan } = DI.roomCoverage(W, sd, room);
    room.cov = need ? have / need : 1;
    if (have < need) add('fail', room.name + ': ' + (need - have) + ' of ' + need + ' tiles have no sprinkler (' + DI.fmt(100 * room.cov) + '% covered).', 'NFPA 13 Ch. 9: sprinklers throughout the premises', room.x, room.y);
    if (orphan) add('fail', room.name + ': ' + orphan + ' sprinklers are not connected to any system riser.', '', room.x, room.y);
  }
  // --- systems
  for (const [id, inf] of sd.info) {
    const v = W.parts.get(id), nm = DI.sysName(S, id), dry = v.type !== 'wetv';
    if (!inf.fed) add('fail', nm + ': riser inlet is not piped to a water supply.', '', v.x, v.y);
    if (!inf.nSpk) { add('warn', nm + ': feeds no sprinklers.', '', v.x, v.y); continue; }
    if (inf.bypass) add('fail', nm + ': system piping is cross-connected to the supply or another system, bypassing the valve. Use the Cap tool (6) to break the joint.', '', v.x, v.y);
    if (inf.area > J.area) add('fail', nm + ': protects ' + inf.area.toLocaleString() + ' ft². One system riser is limited to ' + J.area.toLocaleString('en-US') + ' ft² per floor for ordinary hazard.', J.ref.area, v.x, v.y);
    for (const r of inf.thru) {
      const room = W.rooms[r - 1], rt = DI.ROOMS[room.type];
      if (!dry && !rt.cond) add('fail', nm + ': wet pipe runs through ' + room.name + ', which is not heated. Wet systems need 40 °F or warmer.', R('Ch. 16 (freeze protection)'), room.x, room.y);
      if ((room.type === 'hall' || room.type === 'elec') && inf.rooms.has(r) && v.type !== 'prev')
        add('warn', nm + ': ' + room.name + ' is not on double-interlock preaction. One broken sprinkler or one false detection puts water on live IT load.', 'Owner standard / FM DS 5-32', room.x, room.y);
    }
    if (dry) {
      if (inf.gridded) add('fail', nm + ': piping is gridded (looped). Dry and double-interlock preaction systems must not be gridded - air cannot be driven out one way. Give every branch line a dead end (Cap tool, 6).', R(J.nfpa13 === 2025 ? '§8.2.1, §8.3' : '§8.2, §8.3'), v.x, v.y);
      if (!inf.src.length) add('fail', nm + ': no air compressor or nitrogen generator is tubed to the valve.', R('§8.2 / §8.3'), v.x, v.y);
      // Air supply sizing (FP Lead). The code check: the largest zone on these sources, filled alone from 0 psig
      // with the full capacity, must reach its restore pressure in 30 min. Below that bare minimum is a FAIL; between
      // it and the x1.25 margin is a warning (the margin is ASSUMED practice, NEEDS PE REVIEW, not an NFPA factor).
      // The measured refill clock on the valve is informational and is never read here. One finding per set of
      // sources, placed on the zone that governs it.
      const az = DI.airSizing(S, id);
      if (az && az.gov === id && (az.below || az.tight)) {
        const srcs = inf.src.map((q) => (W.parts.get(q).type === 'n2' ? 'N₂ generator' : 'compressor') + ' #' + q).join(' + '), zone = az.shared ? 'the largest zone they serve (this one, ' + DI.fmt(az.gal) + ' gal)' : 'this zone (' + DI.fmt(az.gal) + ' gal)';
        // the cut-out enters the sizing only on a compressor direct to the system (no AVC): the note prints only there
        const lim = DI.fmt(az.limit), cut = !DI.avcFitted(v) && az.P > v.p.airSet ? ' Sized at the ' + az.P + ' psi compressor cut-out, which is above normal (compressor direct to the system, no AVC; ASSUMED).' : '', ref = DI.refillRef(W, inf, az.shared > 0);
        if (az.below) add('fail', nm + ': air supply ' + DI.fmt(az.have, 1) + ' scfm (' + srcs + ') cannot restore normal pressure in ' + zone + ' within ' + lim + ' min even filling it alone (needs ' + DI.fmt(az.min, 1) + ' scfm; fills in ' + (isFinite(az.tAlone) ? DI.fmt(az.tAlone, 1) + ' min' : 'no time at all') + ').' + cut, ref, v.x, v.y);
        else add('warn', nm + ': air supply ' + DI.fmt(az.have, 1) + ' scfm (' + srcs + ') meets the ' + DI.fmt(az.min, 1) + ' scfm minimum for ' + zone + ' but is below the x' + DI.AIR_SIZING.margin + ' margin (' + DI.fmt(az.margin, 1) + ' scfm; ASSUMED, NEEDS PE REVIEW).' + cut + ' Recovery time is mostly compressor time: watch the refill clock on the valve.', ref, v.x, v.y);
      }
      // A compressor direct to the system (no AVC) whose cut-out is above the zone's high-air supervisory can push the
      // zone into high air: a configuration FAIL (ASSUMED practice, NEEDS PE REVIEW). With an AVC regulating there is
      // no finding: the AVC holds the zone at normal whatever the cut-out is.
      if (!DI.avcFitted(v)) { let co = 0; for (const q of inf.src) { const c = W.parts.get(q); if (c && c.p.cutOut > co) co = c.p.cutOut; }
        if (co > v.p.hiAir) add('fail', nm + ': compressor cut-out (' + co + ' psi) is above the high-air supervisory (' + v.p.hiAir + ' psi) with no AVC between them: the compressor can push the zone into high air (ASSUMED practice, NEEDS PE REVIEW).', R('§8.2 / §8.3 (air supply); company practice'), v.x, v.y); }
      // water delivery: one row per limit that applies, judged on full zone volume (pipe + fittings + trim)
      const dl = DI.deliveryLimits(S, id), vols = 'zone volume ' + DI.fmt(dl.zone) + ' gal (pipe ' + DI.fmt(dl.pipe) + ')';
      if (dl.nfpa.limit !== null) add('warn', nm + ': ' + vols + ' is over ' + dl.nfpa.thr + ' gal. Prove delivery with the ' + dl.nfpa.limit + ' s timed trip test, or rezone into smaller systems.' +
        (v.type === 'prev' ? ' A quick-opening device does not extend the ' + dl.nfpa.thr + ' gal on double interlock.' : ''), dl.nfpa.ref, v.x, v.y);
      if (dl.fm.limit !== null) add('info', nm + ': insurer is FM, so water must reach the inspector’s test in ' + dl.fm.limit + ' s at any volume (' + vols + '). The most stringent limit governs. NEEDS PE REVIEW.', DI.DELIVERY.fmRef + ' (site setting)', v.x, v.y);
      if (v.type === 'prev') {
        const pn = W.panelOf(id);
        if (!pn) add('fail', nm + ': solenoid is not wired to a releasing panel. The valve can never open on its own.' + (v.p.trim === 'el-el' ? ' P is latched in the panel; wire the valve to a panel to reset it.' : ''), R('§8.3, NFPA 72'), v.x, v.y);
        else {
          // only detectors that can act as the detection leg count: aspirating anywhere, spot only in support rooms
          for (const r of inf.rooms) {
            const room = W.rooms[r - 1];
            const det = W.wires.some((w) => { if (w[0] !== pn.id) return false; const d = W.parts.get(w[1]); return d && (d.type === 'vesda' || d.type === 'smoke') && W.roomAt[W.k(d.x, d.y)] === r && DI.canRelease(W, d); });
            if (det) continue;
            const spot = W.wires.some((w) => { if (w[0] !== pn.id) return false; const d = W.parts.get(w[1]); return d && d.type === 'smoke' && W.roomAt[W.k(d.x, d.y)] === r; });
            if (room.type === 'hall') add('fail', nm + ': ' + room.name + ' has no releasing detection. White space needs aspirating (ASD/VEWFD) detection to release' + (spot ? '; spot detectors there only raise the alarm.' : '.'), R('§8.3, NFPA 72'), v.x, v.y);
            else add('fail', nm + ': no releasing detection wired to the panel in ' + room.name + '. A fire there would never release the valve.' + (spot ? ' Spot detectors release only in electrical / UPS rooms.' : ''), R('§8.3, NFPA 72'), v.x, v.y);
          }
        }
        if (v.p.airSet < 7) add('fail', nm + ': supervisory pressure below 7 psi.', R('§8.3.2'), v.x, v.y);
        if (!(v.p.hiAir > v.p.airSet && v.p.airSet > v.p.loAir && v.p.loAir > v.p.pTrip)) add('fail', nm + ': setpoints are out of order (high ' + v.p.hiAir + ', normal ' + v.p.airSet + ', low ' + v.p.loAir + ', P trip ' + v.p.pTrip + ' psi). They must run high air > normal > low air > P trip.', 'Maker trim data (ASSUMED setpoints)', v.x, v.y);
        else if (v.p.loAir - v.p.pTrip < DI.P_MARGIN) add('warn', nm + ': low-air supervisory (' + v.p.loAir + ' psi) is less than ' + DI.P_MARGIN + ' psi above P trip (' + v.p.pTrip + ' psi). The warning would arrive with the trip.', 'Maker trim data (ASSUMED margin)', v.x, v.y);
        if (W.cfg && W.cfg.manualReleaseBypassP && v.p.trim === 'el-el') add('warn', nm + ': the Manual Release zone bypasses P, so the manual station alone releases water. NEEDS PE REVIEW (owner/insurer exception, footnote 9(c)).', 'Project setting', v.x, v.y);
      }
      if (v.type === 'dryv') {
        if (!(v.p.hiAir > v.p.airSet && v.p.airSet > v.p.loAir)) add('fail', nm + ': air setpoints are out of order (high ' + v.p.hiAir + ', normal ' + v.p.airSet + ', low ' + v.p.loAir + ' psi). They must run high air > normal > low air.', 'Manufacturer data', v.x, v.y);
        const ps = S.pin(id);
        if (ps > 0 && v.p.airSet < ps / DI.DRY_RATIO + 15) add('warn', nm + ': air setting ' + v.p.airSet + ' psi is less than 20 psi above the ' + DI.fmt(ps / DI.DRY_RATIO) + ' psi trip point. A pump start surge could trip it.', 'Manufacturer data / ' + R('§8.2'), v.x, v.y);
      }
    }
    if (!W.panelOf(id)) add('warn', nm + ': waterflow alarm is not wired to a panel. Nobody off-site will know it is flowing.', R('Ch. 16, NFPA 72'), v.x, v.y);
  }
  // --- site settings
  const thr = DI.detThr(W), LS = DI.LISTED.smoke, spot = DI.spotThr(W), listed = 'Device listing; NFPA 72 Ch. 14 (ITM)';
  // (a Fire 1-only model has one threshold: the order check does not apply; its pick is checked by DI.asdFindings)
  if (!DI.isVea(W) && !thr.every((t, i) => isFinite(t) && t > 0 && (i === 0 || t > thr[i - 1]))) add('fail', 'Aspirating detection thresholds are not strictly increasing (' + thr.join(' / ') + '). They must run Alert < Action < Fire 1 < Fire 2.', 'Site setting (owner-set values, ASSUMED, NEEDS PE REVIEW)', 0, 0);
  // every stage must sit inside the listed range of that stage for the site's detector model (datasheet ranges)
  for (const f of DI.asdFindings(W)) add('fail', f.text, f.ref, 0, 0);
  if (!(spot >= LS.min && spot <= LS.max)) add('fail', 'Spot detector alarm threshold ' + spot + ' %/ft is outside the listed window of the detector (' + LS.min + ' to ' + LS.max + ' %/ft, example data).', listed, 0, 0);
  // NFPA 76, where adopted: two ceilings, Alert and Fire 1 (the first alarm stage). A fail needs one of them
  // exceeded. Where the detector listing is tighter than the alarm ceiling a note says so; it is not a finding.
  for (const f of DI.n76Flags(W)) add(f.sev, f.text, DI.N76_REF + ' (' + f.code + ')', 0, 0);
  const n76 = DI.n76Note(W); if (n76) add('ok', n76, DI.N76_REF, 0, 0);
  // signal classes: a latched P may be OPEN (not elected), alarm or trouble, never supervisory
  const sc = (W.cfg && W.cfg.sigClass) || {};
  for (const k of Object.keys(DI.SIG_CLASS)) if (sc[k] !== undefined && !DI.SIG_CLASS[k].includes(sc[k]))
    add('fail', k === 'pLatch' ? 'Signal class of a latched P is set to ' + sc[k] + '. Supervisory is blocked for the release input: elect alarm or trouble, or leave it not elected. NEEDS PE REVIEW.' : 'Signal class of the ' + k + ' stage is set to ' + sc[k] + '. It must be supervisory or alarm.', 'Site setting; NFPA 72 (signal classification)', 0, 0);
  // manual release stations
  for (const p of W.byType('mstn')) {
    const pn = W.panelOf(p.id), r = W.roomAt[W.k(p.x, p.y)];
    if (!pn) add('warn', 'Manual release station #' + p.id + ' is not wired to a releasing panel. Operating it does nothing.', 'NFPA 72', p.x, p.y);
    else if (![...sd.info.values()].some((i) => i.type === 'prev' && r && i.rooms.has(r) && W.panelOf(i.id) === pn)) add('warn', 'Manual release station #' + p.id + ' is not in a room protected by a preaction valve on its panel. It raises the alarm and releases nothing.', 'NFPA 72', p.x, p.y);
  }
  // --- panel standby battery: one finding per panel (FA Lead). Below the requirement of the site's standby basis is
  // a FAIL; a margin under 20 % is a warning (THIN: a PRACTICE screen, NEEDS PE REVIEW). The default pick passes.
  { const R72 = DI.ref72(W);
    for (const p of W.byType('panel')) {
      const c = DI.standbyCalc(W, p);
      if (c.below) add('fail', 'Panel #' + p.id + ' battery ' + c.ah + ' Ah is below the ' + DI.fmt(c.req, 1) + ' Ah the standby basis needs (' + c.basis + ', ' + R72.battStby + '): ' + c.iStby + ' A standby for ' + c.h + ' h plus ' + c.iAlarm + ' A alarm for ' + c.alarmMin + ' min, times ' + c.factor.toFixed(2) + ' (' + R72.battFactor + '). Pick a larger battery. Loads are ASSUMED listing values.', R72.battStby, p.x, p.y);
      else if (c.thin) add('warn', 'Panel #' + p.id + ' battery ' + c.ah + ' Ah. THIN: margin ' + DI.fmt(c.margin * 100) + ' %, under ' + DI.STBY_THIN * 100 + ' % over the ' + DI.fmt(c.req, 1) + ' Ah the standby basis needs (' + c.basis + ') (PRACTICE, NEEDS PE REVIEW).', R72.battStby, p.x, p.y);
      // Charger (FA Lead, Cycle 7): the battery must be restorable inside the 48 h recharge window by the fitted charger.
      // chgA = 0 is "matched to the battery" (ASSUMED) and raises nothing. The window never stretches for a bigger battery.
      if (p.p.chgA > 0 && c.ah > DI.chargerAh(p)) add('fail', 'Panel #' + p.id + ' charger (' + p.p.chgA + ' A) cannot restore the ' + c.ah + ' Ah battery within ' + DI.RECHARGE_H + ' h after one discharge (NFPA 72 §10.6.10.3.2, identical in 2019 / 2022 / 2025). A bigger battery needs a bigger charger; the ' + DI.RECHARGE_H + ' h does not stretch. The charger restores ' + DI.chargerAh(p) + ' Ah in ' + DI.RECHARGE_H + ' h (amperes x hours, ASSUMED: no taper).', R72.chgRecharge, p.x, p.y);
    } }
  // --- valves, supply, pumps
  for (const p of W.parts.values()) {
    if (p.type === 'gate' && !W.panelOf(p.id)) add('warn', 'Control valve #' + p.id + ' has no tamper switch wired to a panel.', R('Ch. 16: valve supervision'), p.x, p.y);
    if (p.type === 'city' && !p.p.loop) {                      // backflow prevention before anything else
      const seen = new Set(), q = [[p.x, p.y, W.ports(p).o]]; let bad = false;
      while (q.length && !bad) {
        const [x, y, d] = q.pop(); if (!W.linked(x, y, d)) continue;
        const nx = x + DI.DX[d], ny = y + DI.DY[d], k = W.k(nx, ny); if (seen.has(k)) continue; seen.add(k);
        const o = W.at(nx, ny);
        if (o) { if (o.type === 'bfp') continue; if (o.type === 'gate') { q.push([nx, ny, W.ports(o).o], [nx, ny, W.ports(o).i]); continue; } bad = true; break; }
        if (W.spk[k]) { bad = true; break; }
        for (let e = 0; e < 4; e++) if (e !== DI.OPP[d]) q.push([nx, ny, e]);
      }
      if (bad) add('fail', 'City connection reaches fire protection equipment without a backflow preventer.', 'Water purveyor / plumbing code; ' + R('Ch. 16'), p.x, p.y);
    }
  }
  const fp = [...W.parts.values()].filter((p) => p.type === 'epump' || p.type === 'dpump'), jk = W.byType('jockey');
  if (fp.length && !jk.length) add('warn', 'Fire pump with no jockey pump: every small leak will start the fire pump.', 'NFPA 20 §4.27 (pressure maintenance)', fp[0].x, fp[0].y);
  if (fp.length && !W.byType('testhdr').length) add('warn', 'No test header: the fire pump cannot be flow tested.', 'NFPA 20 §4.22, NFPA 25 Ch. 8', fp[0].x, fp[0].y);
  if (fp.length && fp.every((p) => p.type === 'epump' && !p.p.emerg)) add('warn', 'All fire pumps depend on utility power alone. Add a diesel pump or a generator-backed feed.', 'NFPA 20 §9.3 (alternate power)', fp[0].x, fp[0].y);
  for (const j of jk) {
    const first = Math.max(0, ...fp.map((p) => p.p.start));
    if (j.p.stop - j.p.start < 10) add('warn', 'Jockey pump start/stop band is under 10 psi: it will short-cycle.', 'NFPA 20 A.14.2.6', j.x, j.y);
    if (fp.length && first > j.p.start - 5) add('warn', 'Fire pump start (' + first + ' psi) should be at least 5 psi below jockey start (' + j.p.start + ' psi).', 'NFPA 20 A.14.2.6', j.x, j.y);
  }
  fp.slice().sort((a, b) => b.p.start - a.p.start).forEach((p, i, a) => { if (i && a[i - 1].p.start - p.p.start < 10) add('warn', 'Fire pumps #' + a[i - 1].id + ' and #' + p.id + ' start within 10 psi of each other. Stagger the lag pump 10 psi lower.', 'NFPA 20 A.14.2.6', p.x, p.y); });
  if (sd.info.size && !W.byType('fdc').length) add('warn', 'No fire department connection.', R('Ch. 16 (FDC required)'), 0, 0);
  if (!out.some((f) => f.sev === 'fail')) add('ok', 'No code failures found.', '');
  return out;
};
