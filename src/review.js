// Plan review: static rule checks on the design. Each finding cites where the rule comes from.
// sev: 'fail' (code / will not work), 'warn' (bad practice or owner standard), 'ok'.
var DI = globalThis.DI || (globalThis.DI = {});

DI.review = function (S) {
  const W = S.W, out = [], sd = S.sysd;
  const add = (sev, text, ref, x, y) => out.push({ sev, text, ref: ref || '', x, y });
  // --- coverage
  for (const room of W.rooms) {
    const rt = DI.ROOMS[room.type]; let need = 0, have = 0, orphan = 0;
    if (room.exempt || rt.open) { room.cov = 1; continue; }
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      const k = W.k(x, y); if (W.partAt[k]) continue; need++;
      if (W.spk[k]) { have++; if (!sd.tileSys[k]) orphan++; }
      else if (W.pd[k] && (W.spk[k - 1] || W.spk[k + 1] || W.spk[k - W.w] || W.spk[k + W.w])) have++;   // a main between branch lines
    }
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
    if (inf.area > 52000) add('fail', nm + ': protects ' + inf.area.toLocaleString() + ' ft². One system riser is limited to 52,000 ft² per floor for ordinary hazard.', 'NFPA 13-2025 §4.4.1', v.x, v.y);
    for (const r of inf.thru) {
      const room = W.rooms[r - 1], rt = DI.ROOMS[room.type];
      if (!dry && !rt.cond) add('fail', nm + ': wet pipe runs through ' + room.name + ', which is not heated. Wet systems need 40 °F or warmer.', 'NFPA 13-2025 Ch. 16 (freeze protection)', room.x, room.y);
      if ((room.type === 'hall' || room.type === 'elec') && inf.rooms.has(r) && !(v.type === 'prev' && v.p.mode === 'double'))
        add('warn', nm + ': ' + room.name + ' is not on double-interlock preaction. One broken sprinkler or one false detection puts water on live IT load.', 'Owner standard / FM DS 5-32', room.x, room.y);
    }
    if (dry) {
      if (inf.gridded) add('fail', nm + ': piping is gridded (looped). Dry and double-interlock preaction systems must not be gridded - air cannot be driven out one way. Give every branch line a dead end (Cap tool, 6).', 'NFPA 13-2025 §8.2.1, §8.3', v.x, v.y);
      if (!inf.src.length) add('fail', nm + ': no air compressor or nitrogen generator is tubed to the valve.', 'NFPA 13-2025 §8.2 / §8.3', v.x, v.y);
      const lim = v.type === 'dryv' && v.p.qod ? 750 : 500;
      if (inf.vol > lim) add('warn', nm + ': ' + DI.fmt(inf.vol) + ' gal exceeds ' + lim + ' gal, so it must prove water delivery by trip test (60 s).', 'NFPA 13-2025 §8.2.4 / §8.3.2', v.x, v.y);
      if (v.type === 'prev') {
        const pn = W.panelOf(id);
        if (!pn) add('fail', nm + ': solenoid is not wired to a releasing panel. The valve can never open on its own.', 'NFPA 13-2025 §8.3, NFPA 72', v.x, v.y);
        else {
          for (const r of inf.rooms) {
            const det = W.wires.some((w) => { if (w[0] !== pn.id) return false; const d = W.parts.get(w[1]); return d && (d.type === 'vesda' || d.type === 'smoke') && W.roomAt[W.k(d.x, d.y)] === r; });
            if (!det) add('fail', nm + ': no detection wired to the panel in ' + W.rooms[r - 1].name + '. A fire there would never release the valve.', 'NFPA 13-2025 §8.3, NFPA 72', v.x, v.y);
          }
        }
        if (v.p.mode !== 'double' && inf.nSpk > 1000) add('fail', nm + ': more than 1,000 sprinklers on one preaction valve.', 'NFPA 13-2025 §8.3.2', v.x, v.y);
        if (v.p.airSet < 7) add('fail', nm + ': supervisory pressure below 7 psi.', 'NFPA 13-2025 §8.3.2', v.x, v.y);
      }
      if (v.type === 'dryv') {
        const ps = S.pin(id);
        if (ps > 0 && v.p.airSet < ps / DI.DRY_RATIO + 15) add('warn', nm + ': air setting ' + v.p.airSet + ' psi is less than 20 psi above the ' + DI.fmt(ps / DI.DRY_RATIO) + ' psi trip point. A pump start surge could trip it.', 'Manufacturer data / NFPA 13-2025 §8.2', v.x, v.y);
      }
    }
    if (!W.panelOf(id)) add('warn', nm + ': waterflow alarm is not wired to a panel. Nobody off-site will know it is flowing.', 'NFPA 13-2025 Ch. 16, NFPA 72', v.x, v.y);
  }
  // --- valves, supply, pumps
  for (const p of W.parts.values()) {
    if (p.type === 'gate' && !W.panelOf(p.id)) add('warn', 'Control valve #' + p.id + ' has no tamper switch wired to a panel.', 'NFPA 13-2025 Ch. 16: valve supervision', p.x, p.y);
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
      if (bad) add('fail', 'City connection reaches fire protection equipment without a backflow preventer.', 'Water purveyor / plumbing code; NFPA 13-2025 Ch. 16', p.x, p.y);
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
  if (sd.info.size && !W.byType('fdc').length) add('warn', 'No fire department connection.', 'NFPA 13-2025 Ch. 16 (FDC required)', 0, 0);
  if (!out.some((f) => f.sev === 'fail')) add('ok', 'No code failures found.', '');
  return out;
};
