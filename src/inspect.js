// Inspector: the right-hand panel. Live gauges and the controls of whatever is selected.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const g = () => DI.game, esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let acts = [], upd = [], lastSig = null, el = null;
  const B = {
    h: '', add(s) { this.h += s; },
    title(t, sub) { this.add('<h3>' + esc(t) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</h3>'); },
    p(t) { this.add('<p>' + esc(t) + '</p>'); }, sec(t) { this.add('<div class="sec">' + esc(t) + '</div>'); },
    row(label, fn, tip) { const i = upd.length; upd.push(fn); this.add('<div class="row"' + (tip ? ' title="' + esc(tip).replace(/"/g, '&quot;') + '"' : '') + '><span>' + esc(label) + '</span><b id="iv' + i + '"></b></div>'); },
    btns(list) { this.add('<div class="btns">' + list.filter(Boolean).map(([label, fn, cls, dis, tip]) => { acts.push(fn); return '<button data-a="' + (acts.length - 1) + '" class="' + (cls || '') + '"' + (dis ? ' disabled' : '') + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + esc(label) + '</button>'; }).join('') + '</div>'); },
    step(label, get, set, d, lo, hi, unit) { acts.push(() => set(DI.clamp(get() - d, lo, hi))); const a = acts.length - 1; acts.push(() => set(DI.clamp(get() + d, lo, hi))); const i = upd.length; upd.push(() => get() + (unit || ''));
      this.add('<div class="row"><span>' + esc(label) + '</span><span class="stp"><button data-a="' + a + '">−</button><b id="iv' + i + '"></b><button data-a="' + (a + 1) + '">+</button></span></div>'); },
    pick(label, opts, get, set, fmt) { this.add('<div class="row"><span>' + esc(label) + '</span></div>'); this.btns(opts.map((o) => [fmt ? fmt(o) : String(o), () => set(o), get() === o ? 'on' : ''])); },
    res(r) { if (r) this.add(DI.ui.resHtml(r)); },
    canvas(w, h, fn) { const i = upd.length; upd.push(() => { const c = document.getElementById('ic' + i); if (c) fn(c.getContext('2d'), w, h); return null; }); this.add('<canvas id="ic' + i + '" width="' + w * 2 + '" height="' + h * 2 + '" style="width:' + w + 'px;height:' + h + 'px"></canvas><b id="iv' + i + '" style="display:none"></b>'); },
  };
  const spend = (d) => { const G = g(); if (!G.sc.sandbox && d > G.W.money) { DI.ui.banner('Not enough budget (' + DI.money(d) + ').'); return false; } G.W.money -= d; return true; };
  const reprice = (p, change) => { const c0 = DI.partCost(p.type, p.p), old = Object.assign({}, p.p); change(); const d = DI.partCost(p.type, p.p) - c0; if (!spend(d)) { Object.assign(p.p, old); return; } g().S.touch(); g().W.ver++; DI.edited(); };
  const test = (kind, id) => { const m = DI.startTest(g().S, kind, id); if (m) DI.ui.banner(m); };
  const say = (m) => { if (m) DI.ui.banner(m); };
  const psi = (v) => DI.fmt(v, 1) + ' psi', gpm = (v) => DI.fmt(v) + ' gpm';
  // is the latest incident on this valve the scored incident of a running drill? (the checklist then has step 14)
  const drillScored = (S, id) => { const d = S.drill; if (!d || d.done || !(d.t0 >= 0)) return false; const a = S.acts.find((q) => q.kind === 'incident' && q.t >= d.t0); if (!a || a.id !== id) return false; const r = DI.recoveryScore(S, id); return !!r && r.t0 === a.t; };
  // gas in a set pipe more than 1 psi above normal, with no air test running: the trim bleed is offered
  const highGas = (S, p) => { const s = S.ss.get(p.id); return !!s && p.type !== 'wetv' && s.state === 'dry' && s.P > p.p.airSet + 1 && !S.procs.some((x) => x.kind === 'leak' && x.id === p.id); };

  function pumpChart(p) {
    return (c, w, h) => { const S = g().S, q = p.p, qm = q.gpm * 1.75, hm = q.psi * 1.35, X = (v) => 30 + (v / qm) * (w - 38), Y = (v) => h - 18 - (v / hm) * (h - 26);
      c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, w, h); c.strokeStyle = '#243342'; c.lineWidth = 1; c.font = '9px Consolas,monospace'; c.fillStyle = '#7f93a3'; c.textAlign = 'right';
      for (const f of [0, 0.65, 1, 1.2]) { c.beginPath(); c.moveTo(X(0), Y(q.psi * f)); c.lineTo(w - 8, Y(q.psi * f)); c.stroke(); c.fillText(DI.fmt(q.psi * f), 27, Y(q.psi * f) + 3); }
      c.textAlign = 'center'; for (const f of [0, 1, 1.5]) { c.beginPath(); c.moveTo(X(q.gpm * f), Y(0)); c.lineTo(X(q.gpm * f), 6); c.stroke(); c.fillText(DI.fmt(q.gpm * f), X(q.gpm * f), h - 6); }
      c.strokeStyle = '#3aa6ff'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 40; i++) { const f = i / 40 * qm, v = DI.pumpHead(q, f, 1); if (v < 0) break; if (i) c.lineTo(X(f), Y(v)); else c.moveTo(X(f), Y(v)); } c.stroke();
      const fl = S.flowOf(p.id), net = S.pout(p.id) - S.pin(p.id); if (q.spd > 0.05) { c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(X(Math.min(fl, qm)), Y(DI.clamp(net, 0, hm)), 4, 0, 7); c.fill(); }
      const r = DI.lastResult(S, 'pump', p.id); if (r && r.pts) { c.fillStyle = r.pass ? '#3ddc91' : '#ff4b3a'; for (const pt of r.pts) { c.beginPath(); c.arc(X(pt.q), Y(pt.pd - pt.ps), 3, 0, 7); c.fill(); } } };
  }
  function calcBlock(S, id) {
    B.btns([['Run hydraulic calc', () => { const c = DI.hydCalc(S, id); S.calc.set(id, c); if (c.ok) g().calcShow = { tiles: c.tiles, pass: c.pass }; else say(c.err); }, 'go', false, 'Checks hydraulics only: does every sprinkler in the remote area get its density. Coverage is checked in plan review.']]);
    const c = S.calc.get(id); if (!c || !c.ok) return;
    B.add('<div class="res ' + (c.pass && c.covOk ? 'pass' : 'fail') + '"><b>' + esc(c.verdict) + ' · ' + esc(c.hz.name) + (c.room ? ' \u00b7 ' + esc(g().W.rooms[c.room - 1].name) : '') + '</b>' +
      'Design area ' + DI.fmt(c.area) + ' ft²' + (c.dryLike ? ' (+30% dry)' : '') + ': ' + c.n + ' sprinklers<br>Need ' + DI.fmt(c.need, 1) + ' gpm each (' + c.hz.dens.toFixed(2) + ' gpm/ft²)<br>Weakest gets ' + DI.fmt(c.minQ, 1) + ' gpm (' + c.dens.toFixed(3) + ')<br>' +
      'Demand ' + DI.fmt(c.total) + ' gpm (incl. ' + c.hz.hose + ' hose) @ ' + DI.fmt(c.pRiser) + ' psi at riser' + c.pumpPts.filter((p) => p.on).map((p) => '<br>Pump #' + p.id + ' at ' + DI.fmt(p.pct) + '% of rated' + (p.pct > 150 ? ' - OVERLOADED' : '')).join('') +
      (isFinite(c.tankMin) ? '<br>Tank lasts ' + DI.fmt(c.tankMin) + ' min (need ' + c.hz.dur + ')' : '') + '</div>');
  }
  function sysPanel(S, W, p) {
    const s = S.ss.get(p.id), inf = S.sysd.info.get(p.id), q = p.p, dry = p.type !== 'wetv'; if (!s || !inf) return;
    // riser tag, not a signal: an isolated air / N2 supply is an impairment (shown with a dead panel too)
    if (dry) for (const imp of DI.impairments(S)) if (imp.id === p.id) B.add('<p class="imp">' + esc(imp.text) + '</p>');
    B.sec('GAUGES'); B.row('Water supply', () => psi(S.pin(p.id)));
    B.row(dry ? (s.state === 'dry' ? 'System (gas)' : 'System (water)') : 'System', () => { const v = dry && s.state !== 'wet' ? s.P : S.pout(p.id); return [psi(v), dry && s.lowAir ? 'warn' : '']; });      // the label follows what is in the pipe: gas while the valve is set, water once it has tripped
    if (p.type === 'dryv') B.row('Trip point (supply ÷ 5.5)', () => psi(S.pin(p.id) / DI.DRY_RATIO));
    B.row('Status', () => s.state === 'wet' ? (dry ? ['TRIPPED - full of water', 'bad'] : ['Normal', 'good']) : s.state === 'filling' ? ['Filling ' + DI.fmt(100 * s.wat / Math.max(inf.vol, 1)) + '%', 'warn'] : s.set ? (q.pLatch ? ['Set, but P is LATCHED', 'warn'] : ['Set - in service', 'good']) : ['Charging with air', 'warn']);
    B.row('Flow through valve', () => gpm(s.flow || 0));
    B.row('Piping', () => (dry ? 'Zone ' + DI.fmt(DI.zoneVolume(W, inf)) + ' gal (pipe ' + DI.fmt(inf.vol) + ')' : DI.fmt(inf.vol) + ' gal') + ' · ' + inf.nSpk + ' heads · ' + inf.area.toLocaleString() + ' ft²');
    if (dry) B.row('Water delivery limit', () => { const dl = DI.deliveryLimits(S, p.id); return dl.governing === null ? 'none (' + dl.nfpa.thr + ' gal or less)' : [dl.by + ' ' + dl.governing + ' s to the inspector’s test', 'warn']; });
    if (p.type === 'prev') {
      // every reset path named here has a control on screen: the panel for El/El, the actuator at the trim for El/Pn
      const el = q.trim !== 'el-pn', mr = DI.stationType(W, p) === 'MANUAL RELEASE', how = el ? 'reset the panel' : 'reset the actuator at the trim';
      // A dead panel displays nothing: the rows it feeds (D, the release path, the solenoid, and P on an electric /
      // electric trim) go dark. Gauges, the valve state and the pneumatic actuator's P are read at the valve and stay.
      const dark = () => { const x = W.panelOf(p.id); return !!x && x.p.alive === false; }, ND = ['not displayed: panel dead', 'warn'];
      B.sec('INTERLOCKS: D AND P');
      B.row('D: detection (Fire 1 or manual station)', () => dark() ? ND : DI.relState(W, p).D ? [q.sol ? 'ACTIVE - latched by the panel' : 'ACTIVE - manual station', 'bad'] : ['normal', 'good']);
      B.row('P: pipe pressure below ' + q.pTrip + ' psi', () => el && dark() ? ND : q.pLatch ? ['LATCHED - ' + how, 'bad'] : ['normal', 'good']);
      B.row('Release path', () => dark() ? ND : DI.relPath(W, p));       // names the Manual Release zone when it, not D AND P, is letting water in
      B.row('Solenoid (' + (el ? 'D AND P' : 'D alone') + ')', () => dark() ? ND : q.solOut ? ['ENERGIZED', 'bad'] : ['de-energized', 'good']);
      B.row('P sensor', () => DI.trimOf(p).sensor + (el ? ' switch (panel latch)' : ' actuator (at the valve)'));
      B.row('Manual station type', () => mr ? ['MANUAL RELEASE - bypasses P', 'warn'] : 'DETECTION - inside D');
      if (mr && S.contract) B.row('IMPAIRMENT TAG', () => ['Manual Release zone bypasses P', 'warn']);
      B.btns([['Cause and effect matrix', () => DI.ui.showCE(p.id), '', false, 'Read-only: what each input does on this zone (signal class, panel, supervising station, solenoid, hooks). Generated from the release logic.']]);
      B.pick('Maker trim (loads its ASSUMED setpoints)', Object.keys(DI.TRIMS), () => q.trim, (v) => { DI.loadTrim(p, v); W.ver++; }, (v) => DI.TRIMS[v].name);
      B.p('Water enters only when D and P are both true. ' + (el ? 'On this electric / electric trim P is latched in the releasing panel: a panel reset clears it once the pipe is back above P trip, and it latches straight back if the pipe is still low.' : 'On this electric / pneumatic trim P is the pneumatic actuator at the valve: a panel reset cannot clear it. Restore the air, then reset the actuator at the trim. It latches straight back if the pipe is still low.') + ' A reset at the riser closes the clapper and never clears P. Low and high air are supervisory only and follow live pressure.');
      const pn = W.panelOf(p.id);
      B.btns([el ? (q.pLatch && pn ? ['Go to the releasing panel', () => DI.ui.focus(pn.x, pn.y, { kind: 'part', id: pn.id }), 'go', false, 'P is latched in panel #' + pn.id + '. The Panel reset button is there.'] : null)
        : ['Reset actuator at the trim', () => say(DI.resetTrimP(S, p.id)), q.pLatch ? 'go' : '', !q.pLatch, 'Clears P at the pneumatic actuator. Restore the air first, or it latches again.']]);
      // The thirteen recovery steps for the latest incident on this valve. Practice everywhere: only the drill's
      // broken-sprinkler incident in contract 5 is scored, and nothing gates on this list.
      if (DI.recoveryScore(S, p.id)) {
        // The checklist is the thirteen practice steps everywhere. In a running drill the scored incident has a
        // fourteenth step, the main drain test (DI.RECOVERY_DRAIN): it is shown under the list as its own row, read
        // from the drill form of the score, with the time the rating reads.
        const scored = drillScored(S, p.id);
        let memo = null, mt = -1, mn = -1; const rc = () => { if (mt !== S.t || mn !== S.acts.length) { memo = DI.recoveryScore(S, p.id); mt = S.t; mn = S.acts.length; } return memo; };
        let memoD = null, dt = -1, dn = -1; const rd = () => { if (dt !== S.t || dn !== S.acts.length) { memoD = S.drill ? DI.recoveryScore(S, p.id, S.drill.t0) : null; dt = S.t; dn = S.acts.length; } return memoD; };
        B.sec('RECOVERY CHECKLIST (PRACTICE)');
        B.row('Latest incident', () => { const r = rc(); return r ? [r.done + ' of ' + r.total + (r.inOrder ? ', in order' : ', OUT OF ORDER'), r.complete && r.inOrder ? 'good' : r.inOrder ? 'warn' : 'bad'] : '-'; });
        DI.RECOVERY.forEach(([, label], i) => B.row((i + 1) + '. ' + label, () => { const r = rc(), st = r && r.steps[i]; return !st ? '-' : st.na ? 'not applicable' : st.done ? ['done', 'good'] : ['pending', 'warn']; }));
        if (scored) {
          B.row('Drill step 14: main drain test (company practice)', () => { const r = rd(), st = r && r.steps[13]; return !st ? '-' : st.done ? ['done', 'good'] : ['pending', 'warn']; }, DI.RECOVERY_DRAIN[1] + ' ' + DI.MDT_LINE);
          B.row('Water stopped', () => { const r = rd(); return !r || r.waterStopped === null ? ['control valve not closed yet', 'warn'] : [Math.round(r.waterStopped) + ' s after the alarm', r.waterStopped <= DI.RECOVERY_TIERS[0].s ? 'good' : 'warn']; }, 'Informational: the recovery rating reads this time (3 stars at ' + DI.RECOVERY_TIERS[0].s + ' s or less, 2 at ' + DI.RECOVERY_TIERS[1].s + ' s or less; ASSUMED) and that every step is in order. Contract stars do not read it.');
        }
        B.row('If the control valve is reopened now', () => { const it = DI.openItems(S, p.id); return it.length ? ['still open: ' + it.join('; '), 'warn'] : ['nothing is still open', 'good']; });
        B.p('Generic practice; the valve maker’s IOM governs the specifics. After a trip the clapper is reset before the air is restored, with the drain still open. Reopening the control valve is the last step: until it is open the zone is unprotected. In practice the valve reopens with a warning that lists what is still open; in the scored drill incident it refuses until the zone will hold.');
        // In the scored drill incident the main drain test is step 14 (Fire Tutor wording, DI.MDT_LINE). Everywhere
        // else it is a tip, coaching only: no act, no score, no goal.
        // Cycle 8 (Fire Tutor): the main drain test at this point is company practice; the test NFPA 25 requires after a
        // control valve is reopened is the valve status test.
        if (scored) B.add('<p id="mdt14">' + esc('Step 14, scored in this drill: ' + DI.RECOVERY_DRAIN[1] + ' ' + DI.MDT_LINE + ' Run it from TESTS below, after the control valve is back open.') + '</p>');
        else B.p('Tip: ' + DI.MDT_LINE + ' The code requires a valve status test after a control valve is reopened (' + DI.REF25.valveStatusShort + ').');
      }
    }
    if (dry) {
      B.sec('SUPERVISORY GAS'); B.row('Source', () => inf.src.length ? inf.src.map((id) => W.parts.get(id).type === 'n2' ? 'N₂ gen #' + id : 'Compressor #' + id).join(', ') : ['NONE - run tubing', 'bad']);
      B.row('Air / N₂ supply', () => q.airValve ? ['OPEN', 'good'] : s.state === 'dry' && s.P < q.loAir ? ['ISOLATED - restore the supply to refill', 'bad'] : ['ISOLATED', 'warn']);
      // The AVC (air maintenance device) is its own device, not the supply valve: "in auto" means the supply valve
      // open AND the AVC bypass closed. With the bypass open nothing regulates and the zone climbs to the cut-out.
      B.row('AVC', () => !DI.avcFitted(p) ? 'none (direct)' : q.avcBy ? ['BYPASS OPEN', 'bad'] : ['regulating', 'good'], 'Air maintenance device (AVC). Regulating: it holds the zone at normal pressure. Bypass open: it does not regulate, and the zone climbs to what the compressor can deliver: its cut-out where one is set, else its rated max discharge or its relief setpoint, whichever is lower, or ' + DI.AVC_BYPASS_PSI + ' psi where the compressor is not modeled (ASSUMED). HIGH AIR at the high setpoint comes in on the way. ' + DI.AVC_NOTE + ' None: a compressor direct to the system, the small-compressor case. The supply-side shutoff is not the AVC.');
      // optional, per zone, default not fitted: a tamper switch on the bypass valve. Not a code requirement.
      if (DI.avcFitted(p)) B.row('AVC bypass tamper switch', () => q.avcTamper === 1 ? [(q.avcBy ? 'fitted: BYPASS OPEN, supervisory' : 'fitted: normal') + ' · ' + DI.AVC_TAMPER_TAG, q.avcBy ? 'warn' : ''] : 'not fitted (optional) · ' + DI.AVC_TAMPER_TAG, 'An optional supervisory switch on the AVC bypass valve. ' + DI.AVC_TAMPER_TAG + '. Fitted, an open bypass is a supervisory signal at the panel; it is never a release input. ' + DI.AVC_NOTE);
      const A = p.type === 'prev' ? ' (ASSUMED)' : '';
      B.step('High-air supervisory' + A, () => q.hiAir, (v) => { q.hiAir = v; }, 5, 10, 90, ' psi');
      B.step('Normal pressure' + A, () => q.airSet, (v) => { q.airSet = v; }, 5, 10, 60, ' psi');
      B.step('Low-air supervisory' + A, () => q.loAir, (v) => { q.loAir = v; }, 5, 5, 55, ' psi');
      if (p.type === 'prev') B.step('P trip' + A, () => q.pTrip, (v) => { q.pTrip = v; }, 5, 5, 50, ' psi');
      B.row('Oxygen', () => s.state === 'wet' ? '-' : [DI.fmt(100 * s.o2g / Math.max(s.G, 1e-9), 1) + ' %', s.o2g / Math.max(s.G, 1e-9) <= 0.02 ? 'good' : '']);
      // Two measured readings, both informational: the first fill of the zone (commissioning) and the last refill
      // (the running clock while it fills). The code check is the sizing row under them, never these clocks.
      const lim = DI.refillLimit(W, inf) / 60, clockTip = 'Informational: a measured time, never compared with the limit. The code check is the Air supply sizing row under these two. The air supply must restore normal pressure within ' + lim + ' min [' + DI.refillRef(W, inf) + ']; the code check is the largest zone on the supply filled alone from 0 psig (the Air supply sizing row). The clock runs from the first gas into the closed-up zone to normal pressure; on a zone that lost its air without tripping it starts at the low-air crossing. ' + DI.PARALLEL_SPLIT + '. Recovery time is mostly compressor time. Some owners or FM jobs set a tighter refill time. Check the project basis of design. ' + DI.COLD_NOTE + (DI.refillSeq(W) ? ' Air refill order on this site: ' + DI.SEQ_NOTE + '; a wait behind a larger zone is part of the measured time and is not a code limit.' : '');
      B.row('First fill (commissioning)', () => DI.refillText(S, p.id, true), clockTip);
      B.row('Last refill', () => DI.refillText(S, p.id), clockTip);
      B.row('Air supply sizing', () => { const z = DI.airSizing(S, p.id); return !z ? '-' : [DI.fmt(z.have, 1) + ' scfm; largest zone alone ' + (isFinite(z.tAlone) ? DI.fmt(z.tAlone, 1) : 'never') + ' of ' + lim + ' min (minimum ' + DI.fmt(z.min, 1) + ' scfm, x' + DI.AIR_SIZING.margin + ' margin ' + DI.fmt(z.margin, 1) + ')', z.below ? 'bad' : z.tight ? 'warn' : 'good']; },
        'The code check; the measured clocks above are informational. The largest zone that shares these sources, filled alone from 0 psig with the full capacity, must reach its restore pressure in ' + lim + ' min. Minimum scfm = zone volume in cubic feet x (pressure / 14.7) / ' + lim + '. With an AVC regulating the pressure is the zone’s normal; on a compressor direct to the system (no AVC) it is the normal or the compressor cut-out, whichever is higher. Below the minimum is a review FAIL; up to 25 % above it is a warning (ASSUMED margin, NEEDS PE REVIEW). ' + DI.PARALLEL_SPLIT + '.');
      // Owner / insurer refill target (site setting, Cycle 8): shown only where one is set. Judged like the code check; a warning, never a code failure.
      if (DI.ownerRefill(W)) B.row('Owner / insurer refill target', () => { const z = DI.airSizing(S, p.id), T = DI.ownerRefill(W); return !z ? '-' : z.tAlone <= T ? [T + ' min: met (largest zone alone ' + DI.fmt(z.tAlone, 1) + ' min)', 'good'] : [T + ' min: not met (largest zone alone ' + (isFinite(z.tAlone) ? DI.fmt(z.tAlone, 1) + ' min' : 'never') + '); owner/insurer criterion, not a code limit', 'warn']; },
        'An optional site setting. It is judged the way the code check is, on the largest zone alone from 0 psig (method ASSUMED, unless the owner defines it differently). Over the target and inside the code limit is a plan review warning tagged owner/insurer criterion, never a code failure. The measured clocks above are not compared with it.');
      if (s.ret) {
        // The step ends only with the Finish button (DI.returnFinish): nothing clears it by itself. Ready is a hint.
        B.row('After the air test', () => { const r = DI.returnStep(S, p.id); return r ? [r.text, r.mode === 'ready' ? 'good' : 'warn'] : ['returned to normal', 'good']; }, 'Practice only, never a contract goal. The 24 h air test runs at the greater of 40 psi or the zone’s normal pressure (company practice, NEEDS PE REVIEW). Afterwards the zone goes back to its normal set point: bleed at the trim if it is high, let the supply refill it if it is low. Then press Finish return to normal. Finish is accepted when the pressure is in the normal band, P is reset, no air supervisory is active, the AVC is regulating, the control valve is normal and every drain is closed. Pressed sooner it is refused; a refusal counts as an error once for each new set of blockers.');
        B.row('Return-to-normal errors so far', () => { const n = (s.rtErr || []).length, pr = DI.rtPresses(s), tail = pr ? ' (Finish pressed ' + DI.rtTimes(pr) + ')' : ''; return n ? [n + ': ' + s.rtErr.map((e) => DI.rtName(e)).join(', ') + tail, 'bad'] : ['none' + tail, 'good']; }, 'One error per event: pressure below low air, pressure down to the P trip point (the most severe), supply water out of the main drain, or Finish pressed before the zone was ready. A refused Finish counts once for each new set of blockers: pressing again with the same things missing, or with fewer, adds no error; a blocker that was not in the last refusal does (PRACTICE). The raw number of presses is shown as information. Opening a drain and closing it before any of these is coaching only. Practice: never a contract goal or star.');
        B.btns([['Finish return to normal', () => say(DI.returnFinish(S, p.id)), DI.returnReady(S, p.id) ? 'go' : '', false, 'Ends the return to normal. Accepted only when every condition is met; pressed sooner it is refused and names what was missing. A refusal is one scored error for each new set of blockers; pressing again with nothing new missing adds none (practice only).']]);
      }
      B.row('Corrosion / pinholes', () => [DI.fmt(100 * s.corr) + '% / ' + (s.holes || 0), s.holes ? 'warn' : '']);
      B.btns([p.type === 'dryv' ? ['Accelerator ' + (q.qod ? 'ON' : 'off'), () => reprice(p, () => { q.qod = !q.qod; }), q.qod ? 'on' : '', false, 'Quick-opening device: trips the valve on the first few psi of loss. +$2,800'] : null,
        ['N₂ purge vent ' + (q.vent ? 'ON' : 'off'), () => { if (q.vent) { q.vent = false; g().W.money += 3200; } else if (spend(3200)) q.vent = true; }, q.vent ? 'on' : '', false, 'Bleeds gas at the far end until an analyzer reads 98% nitrogen. $3,200'],
        [q.airValve ? 'Isolate air / N₂ supply' : 'Restore air / N₂ supply', () => { q.airValve = q.airValve ? 0 : 1; }, q.airValve ? '' : 'hot', false, 'Shuts the supply to this zone only. The compressor is not affected. A shut supply is an impairment: tag it and restore it.'],
        DI.avcFitted(p) ? ['AVC bypass ' + (q.avcBy ? 'OPEN' : 'closed'), () => { q.avcBy = q.avcBy ? 0 : 1; }, q.avcBy ? 'hot' : '', false, 'Opens or closes the bypass around the air maintenance device. Open, the AVC does not regulate: the zone climbs toward what the compressor can deliver and HIGH AIR comes in. It is an impairment: tag it and close it. ' + DI.AVC_NOTE] : null,
        DI.avcFitted(p) ? ['AVC bypass tamper switch (optional): ' + (q.avcTamper === 1 ? 'fitted' : 'none'), () => { q.avcTamper = q.avcTamper === 1 ? 0 : 1; W.ver++; DI.edited(); }, q.avcTamper === 1 ? 'on' : '', false, 'Fits or removes an optional supervisory switch on the bypass valve. ' + DI.AVC_TAMPER_TAG + '.'] : null,
        DI.refilling(S, p.id) ? ['Skip the refill', () => DI.skip(7200, () => !DI.refilling(S, p.id)), 'go', false, 'Skips ahead until this zone is back at normal pressure, 2 h at most. It stops early on a new alarm. The same skip as the clock menu, with a stop condition.'] : null,
        highGas(S, p) ? ['Bleed to normal at the trim', () => say(DI.bleedToNormal(S, p.id)), 'go', false, 'The pipe is above its normal pressure (after the 24 h air test, or after an AVC bypass was left open). This bleeds it at the trim (the test bleed) to the normal set point: not at the main drain, and never by opening the control valve. Drains dump air too fast or flow supply water.'] : null, s.holes ? ['Repair ' + s.holes + ' leak(s) ' + DI.money(s.holes * 1800), () => { if (spend(s.holes * 1800)) { s.holes = 0; s.corr = Math.min(s.corr, 0.25); S.say('Leaking pipe sections replaced.', 'good'); } }] : null]);
    }
    // design choice, sandbox only: a contract build keeps the default (an AVC is fitted)
    if (dry && g().sc.sandbox) B.pick('Air maintenance device', [1, 0], () => (DI.avcFitted(p) ? 1 : 0), (v) => { q.avc = v; if (!v) q.avcBy = 0; W.ver++; DI.edited(); }, (v) => (v ? 'AVC fitted' : 'none (compressor direct)'));
    B.sec('OPERATE');
    B.btns([[(dry ? 'Main drain ' : 'Main drain ') + (q.drain ? 'OPEN' : 'closed'), () => { q.drain = q.drain ? 0 : 1; S.touch(); }, q.drain ? 'hot' : ''], dry ? ['System drain ' + (q.sdrain ? 'OPEN' : 'closed'), () => { q.sdrain = q.sdrain ? 0 : 1; S.touch(); }, q.sdrain ? 'hot' : ''] : null,
      ['Inspector’s test ' + (q.itc ? 'OPEN' : 'closed'), () => { q.itc = q.itc ? 0 : 1; S.touch(); }, q.itc ? 'hot' : ''],
      // sandbox shortcut: in a contract the manual input is the wired Manual Release Station device
      p.type === 'prev' && g().sc.sandbox ? ['Manual station (shortcut, typed ' + DI.stationType(W, p) + ')', () => { const pn = W.panelOf(p.id); if (!pn || pn.p.alive === false) say('No live releasing panel, so the manual station does nothing. Use the mechanical emergency release at the trim.'); else if (DI.stationType(W, p) === 'MANUAL RELEASE') q.mrzL = true; else q.pull = true; }, 'hot', q.pull || q.mrzL, DI.stationType(W, p) === 'MANUAL RELEASE' ? 'Manual Release zone: releases without P (project flag, NEEDS PE REVIEW).' : 'Counts as detection. Water still needs P. Same as operating a wired Manual Release Station.'] : null,
      p.type === 'prev' ? ['Mechanical emergency release (at the trim)', () => { q.mech = true; }, 'hot', false, 'Opens the valve by hand at the trim, outside the panel logic. Works with a dead panel. Water flows only where a sprinkler is open.'] : null,
      dry && s.state !== 'dry' ? ['Reset valve at the riser', () => say(DI.resetValve(S, p.id)), 'go', false, p.type === 'prev' ? 'Closes the clapper and the emergency release once the system is drained. The drain may stay open: close it afterwards, then restore the air. It does not clear P.' : 'Closes the clapper once the system is drained. The drain may stay open: close it afterwards, then restore the air.'] : null,
      s.openK && s.openK.length ? ['Replace ' + s.openK.length + ' sprinkler(s)', () => say(DI.replaceSprinklers(S, p.id)), 'go', false, dry ? 'Same type, K-factor, temperature and response. First: control valve closed, air / N₂ supply isolated, pipe drained to 0 psi with no water.' : 'Same type, K-factor, temperature and response.'] : null]);
    B.sec('TESTS'); const busy = S.procs.some((x) => x.id === p.id);
    B.btns([dry ? ['Full-flow trip test', () => test('trip', p.id), '', busy] : ['Inspector’s test (timed)', () => test('itc', p.id), '', busy], ['Main drain test', () => test('drain', p.id), '', busy], dry ? ['24 h air test', () => test('leak', p.id), '', busy] : null,
      // the follow-up to a main drain test whose residual is down more than 10 percent: look at every control valve on the supply path
      ['Check the valves upstream', () => say(DI.dropCheck(S, p.id)), '', false, 'Reports how far open the zone control valve and every other control valve on the supply path is, and logs the check. Use it when a main drain test shows the full flow pressure more than 10 percent below the last test: NFPA 25 says find the cause, and a partly closed valve is the usual one [' + DI.REF25.passRule + ']. Then test again.']]);
    if (busy) B.p('Test running… speed up time if you like.');
    for (const k of dry ? ['trip', 'leak', 'return', 'drain'] : ['itc', 'drain']) B.res(DI.lastResult(S, k, p.id));
    B.sec('HYDRAULICS'); calcBlock(S, p.id);
  }
  function partPanel(S, W, p) {
    const d = DI.PARTS[p.type], q = p.p;
    B.title(q.label || d.name, '#' + p.id); B.p(d.desc);
    const pn = W.panelOf(p.id); if (['gate', 'wetv', 'dryv', 'prev', 'epump', 'dpump', 'vesda', 'smoke', 'mstn'].includes(p.type)) B.row('Wired to', () => { const x = W.panelOf(p.id); return x ? ['Panel #' + x.id, 'good'] : ['NOT WIRED', 'warn']; });
    if (p.type === 'gate') { B.row('Position', () => [DI.fmt(q.open * 100) + '% open', q.open > 0.98 ? 'good' : 'bad']); B.row('Flow', () => gpm(Math.abs(S.flowOf(p.id)))); B.row('Upstream / downstream', () => DI.fmt(S.pin(p.id)) + ' / ' + DI.fmt(S.pout(p.id)) + ' psi');
      B.row('Zone behind it', () => { if (q.target > 0.5) return q.open > 0.98 ? ['in service', 'good'] : 'opening'; const c = DI.reopenCheck(S, p.id); return c.msg ? [c.msg, 'warn'] : c.items.length ? [c.items.length + ' item(s) still open', 'warn'] : ['ready to reopen', 'good']; });
      // opening is refused only in the scored incident of a running drill; anywhere else it opens and the warning lists what is still open
      B.btns([[q.target > 0.5 ? 'Close valve' : 'Open valve', () => { const opening = !(q.target > 0.5), chk = opening ? DI.reopenCheck(S, p.id) : null, m = DI.setGate(S, p.id, opening ? 1 : 0); if (m) say(m); else { if (chk && chk.items.length) say(DI.reopenWarn(p.id, chk.items)); DI.audio.play('valve'); } },
        q.target > 0.5 ? 'hot' : 'go', false, 'In the scored incident of a drill the valve reopens only when the zone behind it will hold: panel reset, clapper reset, P clear, air above low air. Anywhere else it opens, and warns about what is still open.']]);
      // a valve with no supervisory switch fitted (an old sealed yard valve in a field call): closing it signals nothing
      if (q.sw === 0) { B.row('Tamper switch', () => ['none fitted: nothing reports this valve', 'warn']); B.btns([['Fit a tamper switch (' + DI.money(DI.TAMPER_SW_COST) + ')', () => reprice(p, () => { q.sw = 1; }), '', false, 'A supervisory switch: wired to a panel, the valve reports off normal (below 80 percent open) as a supervisory signal.']]); } }
    else if (p.type === 'city') { B.row('Flow test', () => q.stat + ' static, ' + q.resid + ' @ ' + q.flow + ' gpm'); B.row('Flowing now', () => gpm(S.flowOf(p.id))); B.row('Pressure at tap', () => psi(S.pout(p.id))); }
    else if (p.type === 'tank') { B.pick('Capacity (gal)', [60000, 120000, 240000, 360000, 500000], () => q.cap, (v) => reprice(p, () => { q.cap = v; q.gal = v; }), (v) => v / 1000 + 'k'); B.row('Level', () => DI.fmt(100 * q.gal / q.cap, 1) + '%  (' + Math.round(q.gal).toLocaleString() + ' gal)'); B.row('Draw', () => gpm(S.flowOf(p.id))); B.row('Lasts at this rate', () => S.flowOf(p.id) > 5 ? DI.dur(q.gal / S.flowOf(p.id) * 60) : '-'); }
    else if (p.type === 'epump' || p.type === 'dpump') {
      B.canvas(296, 150, pumpChart(p));
      B.row('Status', () => q.spd > 0.9 ? ['RUNNING', 'good'] : q.on ? [q.failed ? 'FAILED TO START' : p.type === 'dpump' ? 'cranking' : 'no power', 'bad'] : 'standby');
      B.row('Flow', () => gpm(S.flowOf(p.id)) + ' (' + DI.fmt(100 * S.flowOf(p.id) / q.gpm) + '%)'); B.row('Suction / discharge', () => DI.gaugeText(S.pin(p.id)) + ' / ' + DI.fmt(S.pout(p.id)) + ' psi'); B.row('System pressure (sensing line)', () => psi(S.pout(q.sense || p.id)));
      B.sec('CONTROLLER'); B.pick('Mode', ['off', 'auto', 'hand'], () => q.mode, (v) => { q.mode = v; if (v === 'off') q.on = false; }, (v) => v.toUpperCase());
      B.btns([['Stop pump', () => { q.on = false; }, 'hot', !q.on || q.mode === 'hand', 'Fire pumps are stopped by hand once the emergency is over']]);
      B.step('Start pressure', () => q.start, (v) => { q.start = v; }, 5, 30, 220, ' psi');
      B.sec('NAMEPLATE'); B.pick('Rated flow (gpm)', DI.PUMP_GPM, () => q.gpm, (v) => reprice(p, () => { q.gpm = v; })); B.pick('Rated pressure (psi)', DI.PUMP_PSI, () => q.psi, (v) => reprice(p, () => { q.psi = v; }));
      B.row('Driver', () => DI.pumpHp(q) + ' hp · churn ' + DI.fmt(q.psi * 1.2) + ' psi');
      if (p.type === 'epump') B.btns([['Generator-backed feed ' + (q.emerg ? 'ON' : 'off'), () => reprice(p, () => { q.emerg = !q.emerg; }), q.emerg ? 'on' : '', false, 'Second power source through a transfer switch. +$38,000']]);
      else { B.row('Fuel', () => [DI.fmt(q.fuel * 100) + '% of ' + DI.fuelCap(q) + ' gal', q.fuel < 0.667 ? 'warn' : 'good']); B.row('Batteries', () => q.batt < 0.5 ? ['DEAD', 'bad'] : ['charged', 'good']);
        B.btns([['Refuel', () => { if (spend(Math.round((1 - q.fuel) * DI.fuelCap(q) * 4))) q.fuel = 1; }], ['Replace batteries $1,200', () => { if (spend(1200)) { q.batt = 1; q.failed = false; q.crank = 0; } }]]); }
      B.sec('TESTS'); const busy = S.procs.some((x) => x.id === p.id); B.btns([['Flow test (3-point)', () => test('pump', p.id), '', busy], [(p.type === 'dpump' ? '30' : '10') + ' min churn run', () => test('run', p.id), '', busy]]);
      B.res(DI.lastResult(S, 'pump', p.id)); B.res(DI.lastResult(S, 'run', p.id));
    } else if (p.type === 'jockey') { B.row('Status', () => q.on ? ['RUNNING', 'good'] : 'standby'); B.row('System pressure', () => psi(S.pout(q.sense || p.id))); B.row('Starts', () => String(q.starts)); B.step('Stop pressure', () => q.stop, (v) => { q.stop = v; }, 5, 30, 250, ' psi'); B.step('Start pressure', () => q.start, (v) => { q.start = v; }, 5, 30, 250, ' psi'); B.step('Rated pressure', () => q.psi, (v) => { q.psi = v; W.ver++; }, 5, 60, 220, ' psi'); }
    else if (p.type === 'bfp' || p.type === 'check') { B.row('Flow', () => gpm(S.flowOf(p.id))); B.row('Pressure loss', () => psi(Math.max(0, S.pin(p.id) - S.pout(p.id)))); }
    else if (p.type === 'fdc') B.row('Fire department', () => q.active ? ['PUMPING 150 psi', 'bad'] : 'not connected');
    else if (p.type === 'testhdr') { B.step('Hose valves open', () => Math.round(q.open * 10) / 10, (v) => { q.open = v; }, 0.5, 0, 12, ''); B.row('Flowing', () => gpm(S.G ? S.G.emit.filter((e) => e.pid === p.id).reduce((a, e) => a + e.link.q, 0) : 0)); }
    else if (DI.SYSV[p.type]) sysPanel(S, W, p);
    else if (p.type === 'comp' || p.type === 'n2') { B.pick('Capacity (SCFM)', p.type === 'comp' ? DI.COMP_SCFM : DI.N2_SCFM, () => q.scfm, (v) => reprice(p, () => { q.scfm = v; }));
      // a sizing input only on a compressor direct to the system (no AVC); with an AVC the zone is sized at normal
      if (p.type === 'comp') { B.pick('Cut-out pressure (psi, ASSUMED; 0 = none)', DI.COMP_CUTOUT, () => q.cutOut || 0, (v) => { q.cutOut = v; W.ver++; DI.edited(); }, (v) => (v ? String(v) : 'none'));
        // the ceiling of an open AVC bypass: rated max discharge, or the relief setpoint if lower (ASSUMED picks)
        B.pick('Rated max discharge (psi, ASSUMED; 0 = not modeled)', DI.COMP_MAXPSI, () => q.maxPsi || 0, (v) => { q.maxPsi = v; W.ver++; DI.edited(); }, (v) => (v ? String(v) : 'not modeled'));
        B.pick('Relief valve setpoint (psi, ASSUMED; 0 = none)', DI.COMP_RELIEF, () => q.relief || 0, (v) => { q.relief = v; W.ver++; DI.edited(); }, (v) => (v ? String(v) : 'none'));
        B.row('With an AVC bypass open, a zone drifts to', () => DI.compLimit(q) + ' psi' + (!(q.cutOut > 0) && !(q.maxPsi > 0) ? ' (ASSUMED: compressor not modeled)' : ''), 'What this compressor can deliver into a zone whose AVC bypass is open: its cut-out where one is set, else its rated max discharge or its relief setpoint, whichever is lower; ' + DI.AVC_BYPASS_PSI + ' psi where the max discharge is not modeled (ASSUMED). Never the 40 psi test pressure. ' + DI.AVC_NOTE); }
      // relief setpoint against the cut-out, the high air of a zone it feeds and the rated max discharge: warnings only (FP Lead, Cycle 8)
      if (p.type === 'comp') B.row('Relief check', () => { const w = DI.compWarnings(S, p); return !(q.relief > 0) ? 'no relief set' : w.length ? [w.map((x) => x.text).join(' '), 'warn'] : ['no warning', 'good']; },
        'Two plan review warnings, never a fail (PRACTICE checks on ASSUMED picks): the relief setpoint at or below the compressor cut-out, or at or below the high-air setpoint of a zone it feeds, will lift during normal operation; and a relief above the rated max discharge. The drift of an open AVC bypass does not change with them. On a real job the values come from the selected unit.');
      B.row('Status', () => q.fault ? ['FAULT - not making gas', 'bad'] : q.on ? ['RUNNING', 'good'] : !S.powered(p) ? ['NO POWER', 'bad'] : 'idle'); B.row('Starts', () => String(q.starts)); B.row('Run time', () => DI.dur(q.runSec) + ' (' + DI.fmt(100 * q.runSec / Math.max(S.t, 1), 1) + '% duty)');
      B.row('Feeds', () => { const o = []; for (const [id, i] of S.sysd.info) if (i.src.includes(p.id)) o.push('#' + id); return o.length ? 'valve ' + o.join(', ') : ['nothing - run tubing', 'bad']; });
      if (g().sc.sandbox) B.btns([[q.fault ? 'Restore source (sandbox)' : 'Fail source (sandbox)', () => { q.fault = !q.fault; }, q.fault ? 'hot' : '', false, 'Sandbox only: the unit stops making gas, as with a tripped breaker or a failed compressor. Every zone it feeds reports LOSS OF SUPPLY AIR (trouble) once no other source is left.']]);
      { const m = DI.REFILL_LIMIT / 60;
        B.p('Sized so the largest zone it serves, filled alone from 0 psig, reaches normal pressure in ' + m + ' minutes (' + DI.REFILL_LIMIT_COLD / 60 + ' for a zone wholly in freezer rooms held below 5 F): scfm = zone volume in cubic feet x (pressure / 14.7) / ' + m + '. With an AVC (air maintenance device) regulating, the pressure is the zone’s normal. Below that is a review FAIL; up to 25 % above it is a warning (ASSUMED margin). The game fills every zone on a shared compressor at the same time (SIMPLIFICATION: parallel split; real ECS per-riser AVC / restrictors feed concurrently), unless the site’s air refill order is set to largest zone first (PRACTICE): then one zone fills at a time and the code check is the same.'); }
      if (p.type === 'comp') B.p('The cut-out is a sizing input only on a compressor direct to the system (a zone with no AVC): there the supply is sized at the normal or the cut-out, whichever is higher, and a cut-out above the zone’s high-air supervisory is a review FAIL (ASSUMED practice, NEEDS PE REVIEW). With an AVC regulating it does not enter the sizing. It is not a switch model (SIMPLIFICATION): an open AVC bypass drifts the zone to the cut-out, or with none set to the rated max discharge or the relief setpoint, whichever is lower (' + DI.AVC_BYPASS_PSI + ' psi where the compressor is not modeled, ASSUMED).'); }
    else if (p.type === 'panel') { const HH = () => DI.panelH(W, p), low = () => !q.battDisc && q.battH <= DI.lowBattH(HH());
      B.row('Power', () => q.alive === false ? ['DEAD - display dark', 'bad'] : W.power ? (q.battDisc ? ['AC normal, battery disconnected', 'warn'] : q.chgFail ? ['AC normal, charger failed', 'warn'] : low() ? ['AC normal, battery low (charging)', 'warn'] : ['AC normal', 'good']) : q.onGen ? ['GENERATOR (battery held at ' + DI.fmt(q.battH, 1) + ' h)', 'warn'] : [(low() ? 'LOW BATTERY ' : 'BATTERY ') + DI.fmt(q.battH, 1) + ' h', 'warn']);
      // Standby battery: the pick, its voltage on the linear curve (SIMPLIFICATION) and the hours left of the hours the
      // site's standby basis gives; then the calculation the plan review reads (DI.standbyCalc).
      B.row('Battery', () => q.battDisc ? ['DISCONNECTED', 'bad'] : [(q.ah || DI.PANEL_LOADS.ah) + ' Ah, ' + DI.fmt(DI.battV(q.battH, HH()), 1) + ' V, ' + DI.fmt(q.battH, 1) + ' h of ' + DI.fmt(HH(), HH() % 1 ? 1 : 0) + ' h', low() ? 'warn' : ''], 'Voltage is a straight line from ' + DI.BATT_V_END + ' V (end of discharge) to ' + DI.BATT_V_FLOAT + ' V (float), both ASSUMED (SIMPLIFICATION). LOW BATTERY comes in at ' + DI.LOWBATT_V + ' V, the listed setpoint (ASSUMED): the code sets no low-battery voltage. The charger restores a full discharge within ' + DI.RECHARGE_H + ' h [' + DI.ref72(W).chgRecharge + '].');
      B.row('Standby calc', () => { const c = DI.standbyCalc(W, p); return ['needs ' + DI.fmt(c.req, 1) + ' Ah (' + c.basis + ')' + (c.below ? ': BELOW' : c.thin ? ': THIN, margin ' + DI.fmt(c.margin * 100) + ' %' : ': margin ' + DI.fmt(c.margin * 100) + ' %'), c.below ? 'bad' : c.thin ? 'warn' : 'good']; },
        'Required Ah = (standby A x hours + alarm A x alarm minutes / 60) x the sizing factor of the NFPA 72 edition (' + DI.ref72(W).battFactor + '). Loads here: ' + (q.iStby || DI.PANEL_LOADS.iStby) + ' A standby, ' + (q.iAlarm || DI.PANEL_LOADS.iAlarm) + ' A alarm (ASSUMED listing values). Below the requirement is a plan review FAIL; a margin under ' + DI.STBY_THIN * 100 + ' % is THIN, a warning (PRACTICE, NEEDS PE REVIEW). The standby basis is a site setting.');
      B.pick('Battery (Ah, ASSUMED picks; the pick is free)', DI.BATT_AH, () => q.ah || DI.PANEL_LOADS.ah, (v) => reprice(p, () => { q.ah = v; }));
      // Charger: amperes are listing values, ASSUMED (no charger ampere rating is in NFPA 72 §10.6.10). It must restore the
      // battery inside the 48 h recharge window; "matched" (0) raises no finding.
      B.pick('Charger (A, ASSUMED listing values; a charger ampere rating is not in NFPA 72 §10.6.10)', DI.CHG_A, () => q.chgA || 0, (v) => reprice(p, () => { q.chgA = v; }), (v) => (v ? v + ' A' : 'matched'));
      B.row('Charger check', () => { const ah = q.ah || DI.PANEL_LOADS.ah; if (!(q.chgA > 0)) return ['matched to the battery (ASSUMED): restores ' + ah + ' Ah in ' + DI.RECHARGE_H + ' h', 'good']; const can = DI.chargerAh(p); return can >= ah ? [q.chgA + ' A restores ' + can + ' Ah in ' + DI.RECHARGE_H + ' h: OK for ' + ah + ' Ah', 'good'] : ['FAIL: ' + q.chgA + ' A restores ' + can + ' Ah in ' + DI.RECHARGE_H + ' h, the battery is ' + ah + ' Ah. A bigger battery needs a bigger charger; the ' + DI.RECHARGE_H + ' h does not stretch', 'bad']; },
        'The charger must restore the battery within ' + DI.RECHARGE_H + ' h after one full discharge [' + DI.ref72(W).chgRecharge + ', identical in 2019 / 2022 / 2025]. Restorable Ah = amperes x ' + DI.RECHARGE_H + ' (ASSUMED: no taper, no efficiency loss). A battery above that is a plan review FAIL. An undersized charger also recharges slower here; a larger one never charges faster than the 48 h rate (SIMPLIFICATION). Battery and charger cost are ASSUMED: ' + DI.money(DI.BATT_COST_PER_AH) + ' per Ah against the default ' + DI.PANEL_LOADS.ah + ' Ah, plus the charger by its amperes.');
      B.btns([['Standby reference', () => DI.ui.showStandby(), '', false, 'Read-only: the standby bases by panel type, with their tags.']]);
      // NAC voltage drop at the last appliance (FA Lead, Cycle 8): one Class B circuit, end-line-loaded, a plan review
      // check only. Off by default. Every row reads DI.nacCalc; nothing here is a signal or an input of anything else.
      { const nc = () => DI.nacCalc(W, p), setN = (k, v) => { q[k] = v; W.ver++; DI.edited(); }, v2 = (x) => x.toFixed(2) + ' V';
        B.sec(DI.NAC_TITLE.toUpperCase());
        B.btns([['NAC voltage-drop check: ' + (q.nacOn === 1 ? 'ON' : 'off'), () => setN('nacOn', q.nacOn === 1 ? 0 : 1), q.nacOn === 1 ? 'on' : '', false, 'A plan review check, off by default: the voltage at the last appliance of one notification circuit. It raises no signal and never touches the release or the battery calculation.']]);
        if (q.nacOn === 1 && nc().hold) B.add('<p id="nacHold">' + esc(DI.NAC_CA_HOLD) + '</p>');
        else if (q.nacOn === 1) {
          B.pick('Wire gauge (AWG)', DI.NAC_AWG, () => q.nacAwg, (v) => setN('nacAwg', v), (v) => v + ' AWG');
          B.step('One-way length', () => q.nacFt, (v) => setN('nacFt', v), DI.NAC_FT_STEP, DI.NAC_FT_MIN, DI.NAC_FT_MAX, ' ft');
          B.step('Appliances', () => q.nacN, (v) => setN('nacN', v), 1, 1, DI.NAC_N_MAX, '');
          B.pick('Candela (appliance current is an ASSUMED listing value)', DI.NAC_CDS, () => q.nacCd, (v) => setN('nacCd', v), (v) => v + ' cd');
          B.pick('Start voltage at the panel or module terminals (ASSUMED picks)', DI.NAC_VSTART, () => q.nacV || 0, (v) => setN('nacV', v), (v) => (v ? v.toFixed(1) + ' V' : 'not given'));
          B.row('Appliance current', () => nc().iEach.toFixed(2) + ' A each at ' + DI.NAC_VMIN + ' V (ASSUMED)');
          B.row('Total current', () => nc().iTot.toFixed(2) + ' A');
          B.row('Circuit resistance', () => nc().R.toFixed(3) + ' ohm', 'Resistance = 2 x one-way length x ohm per 1000 ft / 1000: both conductors are counted through the length, and the table value is used as printed. Wire: ' + nc().wire + '.');
          B.row('Start voltage used', () => { const c = nc(); return [c.vStart.toFixed(1) + ' V' + (c.startAssumed ? ' (ASSUMED: end of discharge)' : ' (given)'), c.startAssumed ? 'warn' : '']; });
          B.row('Voltage drop', () => v2(nc().drop));
          B.row('Voltage at the last appliance', () => { const c = nc(); return [v2(c.vEol) + ' (minimum ' + DI.NAC_VMIN + ' V)', c.below ? 'bad' : c.thin ? 'warn' : 'good']; });
          B.row('Margin', () => { const c = nc(); return [DI.fmt(c.margin * 100, 1) + ' %' + (c.thin ? ' (THIN: under ' + DI.NAC_THIN * 100 + ' %)' : ''), c.below ? 'bad' : c.thin ? 'warn' : 'good']; });
          B.row('Longest one-way length that passes', () => DI.nacMaxFt(nc()) + ' ft');
          B.row('Basis', () => nc().basis + '; documentation item ' + nc().doc);
          B.row('Wire resistance', () => nc().ohm + ' ohm per 1000 ft: ' + nc().wire);
          B.row('NAC verdict', () => { const c = nc(); return [DI.nacVerdict(c), c.sev === 'fail' ? 'bad' : c.sev === 'warn' ? 'warn' : 'good']; }, 'FAIL below the appliance listed minimum (' + DI.NAC_VMIN + ' V, ASSUMED: confirm on the listing). THIN, a warning, when the margin is under ' + DI.NAC_THIN * 100 + ' % (company rule, PRACTICE). A warning, not a fail, when the start voltage is ASSUMED. Plan review carries the same finding.');
        } }
      B.row('Devices wired', () => String(W.wires.filter((w) => w[0] === p.id).length)); B.row('Audible', () => q.silenced ? ['SILENCED', 'warn'] : 'normal');
      const deadP = q.alive === false;          // a dead panel cannot be silenced or reset: both buttons are disabled and say why
      B.btns([['Silence', () => say(DI.silence(S, p.id)), q.silenced ? 'on' : '', deadP, deadP ? DI.PANEL_DEAD_MSG : 'Acknowledges the signals. Nothing is reset and nothing clears. A new signal sounds again.'], ['Panel reset', () => say(DI.panelReset(S, p.id)), 'go', deadP, deadP ? DI.PANEL_DEAD_MSG : 'Clears the panel’s latches (D, the Manual Release zone, and P on an electric / electric trim), then every input is read again.']]);
      if (deadP) B.p(DI.PANEL_DEAD_MSG);
      // Sandbox only: fail the charger or disconnect the battery. Both are troubles; neither is an input of D or P.
      if (g().sc.sandbox) B.btns([[q.chgFail ? 'Restore charger' : 'Fail charger', () => { q.chgFail = !q.chgFail; }, q.chgFail ? 'hot' : '', false, 'Sandbox only. CHARGER FAILURE is a trouble at the panel and at the supervising station [' + DI.ref72(W).chgFail + ']; the battery stops charging.'],
        [q.battDisc ? 'Reconnect battery' : 'Disconnect battery', () => { q.battDisc = !q.battDisc; }, q.battDisc ? 'hot' : '', false, 'Sandbox only. BATTERY DISCONNECTED is modelled as a trouble (PRACTICE, not code). With no battery the panel dies as soon as AC is lost.']]);
      // Sandbox only, DACT path only: fail one or both of the two DACT channels. One down is a trouble sent on the
      // other channel within 4 minutes; both down, nothing can be sent and the station reports a missed test.
      if ((g().sc.sandbox || (g().sc.puzzle && !(Array.isArray(q.chan) && q.chan[0] && q.chan[1]))) && DI.commPath(W) === 'dact') { const ch = () => (Array.isArray(q.chan) ? q.chan : [1, 1]), setCh = (a, b) => { q.chan = [a, b]; };
        B.row('DACT channels', () => { const c = ch(); return ['1 ' + (c[0] ? 'up' : 'DOWN') + ', 2 ' + (c[1] ? 'up' : 'DOWN'), c[0] && c[1] ? 'good' : 'warn']; }, 'One channel down: a trouble at the panel at once, sent on the other channel within ' + DI.delayText(DI.DACT_CHAN_S) + ' [' + DI.ref72(W).dactChan + ']; every other signal goes on the surviving channel at once. Both down: the panel cannot send anything, alarms included, so nothing is transmitted and the fire department is not dispatched from it. It tries each signal ' + DI.DACT_TRIES + ' times, ' + DI.DACT_ATTEMPT_S + ' s each (CODE bounds, count ASSUMED; ' + DI.ref72(W).dactTry + '), then shows DACT TRANSMISSION FAILED. When a channel is back every signal that is still active is sent, with its original event time, in priority order (alarm, supervisory, trouble, then a class not elected), then the restorals. Hold and send (site setting, PRACTICE) decides only what happens to a signal that restored inside the outage: ON sends it late with its restoral, OFF drops it. If the panel dies with signals queued none of them is sent: the hazard case. The supervising station reports a missed test after ' + DI.delayText(DI.commDelay(W)) + ' (ASSUMED).');
        B.btns([g().sc.sandbox ? ['Fail DACT channel 1', () => setCh(0, ch()[1]), 'hot', !ch()[0], 'Sandbox only.'] : null, g().sc.sandbox ? ['Fail DACT channel 2', () => setCh(ch()[0], 0), 'hot', !ch()[1], 'Sandbox only.'] : null, ['Restore DACT channels', () => setCh(1, 1), 'go', !!(ch()[0] && ch()[1]), g().sc.sandbox ? '' : 'The telephone company puts the lines back.']]); }
      // one read-only cause-and-effect matrix per preaction zone wired to this panel
      const zones = W.wires.filter((w) => w[0] === p.id).map((w) => W.parts.get(w[1])).filter((d) => d && d.type === 'prev' && S.sysd.info.has(d.id));
      if (zones.length) B.btns(zones.map((z) => ['Cause and effect matrix: #' + z.id, () => DI.ui.showCE(z.id), '', false, DI.sysName(S, z.id) + '. Read-only.']));
      B.p('Reset clears the panel’s latches and then reads every input again, so a live input comes straight back: a detector or manual station still in alarm, or pipe still below P trip. P is a panel latch on an electric / electric trim and clears here. On an electric / pneumatic trim P sits at the actuator: reset it at the trim. A panel reset never closes a tripped valve. A waterflow alarm stays latched at the panel after the flow has stopped, until a reset (' + DI.ref72(W).latch + '); a reset with water still flowing leaves it in alarm.'); B.p('On AC failure the panel shows the trouble at once and runs on its standby battery (' + DI.fmt(DI.panelH(W, p), DI.panelH(W, p) % 1 ? 1 : 0) + ' h with this battery on the site’s standby basis' + (DI.panelGen(W) ? '; the standby generator carries it for 24 h first' : '') + '). On battery it still alarms and releases. The supervising station is told only after the AC-fail delay (' + Math.round(DI.acDelay(W) / 60) + ' min on this site; power back sooner, nothing is sent). LOW BATTERY comes in at the battery’s listed low-voltage setpoint, ' + DI.LOWBATT_V + ' V on a 24 V system (ASSUMED, NEEDS PE REVIEW): the code sets no low-battery voltage. A silenced trouble that is still active sounds again after ' + DI.delayText(DI.TROUBLE_RESOUND_S) + '. A dead panel is dark: no display, no reset, no silence. The supervising station reports the loss of communication only after its supervision interval (' + DI.delayText(DI.commDelay(W)) + ' on this site’s path). It leaves every preaction valve shut: the solenoid is energize-to-release. Recovery is the mechanical emergency release at the trim, by a person. On an electric / electric trim the P latch lives in the panel: when power returns the panel reads its inputs again, so P comes back if the pipe is still low. Power coming back is not a release; the inputs are.'); }
    else if (p.type === 'vesda' || p.type === 'smoke') { const room = W.room(p.x, p.y);
      B.row('Room', () => room ? room.name : ['outdoors - move it', 'bad']); B.row('Smoke reading', () => DI.fmt(q.obs || 0, 3)); B.row('Level', () => p.type === 'vesda' ? [DI.VESDA_N[q.lvl] || 'normal', q.lvl >= DI.FIRE1 ? 'bad' : q.lvl ? 'warn' : 'good'] : [q.lvl ? 'ALARM' : 'normal', q.lvl ? 'bad' : 'good']);
      if (p.type === 'vesda' && DI.isVea(W)) {
        // VEA: a Fire 1-only model. One threshold, picked from three listed settings; nothing is printed for the other stages.
        const M = DI.ASD_MODELS.VEA;
        B.row('Fire 1', () => { const f = DI.veaFire1At(W, room), i = M.pick.indexOf(f); return [f + ' %/ft' + (i >= 0 ? ' (' + M.pickName[i] + ')' : ' - not a listed VEA setting') + ' · ' + DI.veaFire1Src(W, room), i >= 0 ? '' : 'bad']; }, 'A VEA detector reads the Fire 1 of the room it sits in: the room’s own pick, else the site pick, else the default (0.5 %/ft in a telecom room where NFPA 76 applies, 1.23 %/ft in every other room). Set a room pick on the room, in the Sandbox.');
        B.row('Alert / Action / Fire 2', () => DI.VEA_NA);
        B.row('Model', () => M.label + ' (Fire 1 only)');
        B.row('Listed Fire 1 settings', () => M.pick.map((x, i) => x + ' ' + M.pickName[i]).join(' / ') + ' %/ft');
        B.row('Range source', () => M.doc + ' ' + DI.ASD_SRC, M.oemNote);
        if (DI.n76Applies(W, room)) B.row('NFPA 76', () => { const f = DI.n76Flags(W, room); return f.length ? [f.map((x) => x.text).join(' '), 'bad'] : ['ceiling met in ' + room.name, 'good']; }, 'NFPA 76 applies in this room (a telecom room; the site setting is the default). Ceiling: Fire 1 (the first alarm stage) 1.0 %/ft. ' + DI.N76_TAG + ' On this model 1.23 and 2.5 are above it and 0.5 meets it.');
      } else if (p.type === 'vesda') {
        // thresholds are owner-set inside the listed range of the model; the range is the maker's datasheet
        const M = () => DI.ASD_MODELS[DI.asdModel(W)];
        B.row('Alert / Action / Fire 1 / Fire 2', () => [DI.detThr(W).join(' / ') + ' %/ft (owner-set: ASSUMED, NEEDS PE REVIEW)', DI.asdFindings(W).length ? 'bad' : '']);
        B.row('Model', () => M().label);
        B.row('Listed range per stage', () => DI.asdRange(W).map((r) => (r ? DI.asdFmt(r[0]) + ' to ' + DI.asdFmt(r[1]) : '-')).join(' / ') + ' %/ft');
        B.row('Range source', () => M().doc + ' ' + DI.ASD_SRC);
        if (DI.n76Applies(W, room)) B.row('NFPA 76', () => { const f = DI.n76Flags(W, room); return f.length ? [f.map((x) => x.text).join(' '), 'bad'] : ['ceilings met in ' + room.name, 'good']; }, 'NFPA 76 applies in this room (a telecom room; the site setting is the default). Ceilings: Alert 0.2 %/ft, Fire 1 (the first alarm stage) 1.0 %/ft. ' + DI.N76_TAG);
      } else {
        B.row('Alarm threshold', () => DI.spotThr(W) + ' (example)');
        B.row('Listed window', () => { const L = DI.LISTED.smoke; return L.min + ' to ' + L.max + ' %/ft (example)'; });
      }
      B.row('Release role', () => p.type === 'vesda' ? 'Fire 1 is the detection leg' : DI.canRelease(W, p) ? 'alarm is the detection leg' : ['alarm only here', 'warn']);
      if (p.type === 'vesda' && DI.isVea(W)) B.p('This model reports one stage, Fire 1: at or above it the detection leg D is true, and water still needs P. It has no Alert, Action or Fire 2 stage (' + DI.VEA_NA + '). The detector model is a site setting. Fire 1 is read per room on this model: the room’s pick, else the site pick, else the default by room.');
      else if (p.type === 'vesda') B.p('Alert and Action are pre-alarm (supervisory unless the site elects alarm). At or above Fire 1 the detection leg D is true, and water still needs P. Fire 2 is escalation and releases nothing by itself. Thresholds and signal classes are site settings.');
      else B.p('One listed spot detector in alarm is the detection leg in an electrical / UPS room. In white space it raises the alarm only: use aspirating detection there.'); if (room) B.btns([['Send technician', () => say(DI.sendTech(S, room.id)), 'go', false, 'Someone walks to the room. If the fire is still smouldering they can stop it by hand.']]); }
    if (p.type === 'mstn') { const room = W.room(p.x, p.y), pn2 = W.panelOf(p.id), r = W.roomAt[W.k(p.x, p.y)];
      const zone = () => (pn2 ? [...S.sysd.info.values()].filter((i) => i.type === 'prev' && r && i.rooms.has(r) && W.panelOf(i.id) === pn2).map((i) => W.parts.get(i.id)) : []);
      B.row('Room', () => room ? room.name : ['outdoors', 'warn']); B.row('Status', () => q.on ? ['OPERATED', 'bad'] : ['normal', 'good']);
      B.row('Operates', () => { const z = zone(); return z.length ? 'valve ' + z.map((v) => '#' + v.id + ' (' + DI.stationType(W, v) + ')').join(', ') : ['no preaction valve protects this room', 'warn']; });
      B.btns([q.on ? ['Reset station', () => { q.on = false; S.say('Manual station #' + p.id + ' reset. Reset the panel to clear the alarm.', ''); }, 'go'] : ['Operate station', () => { q.on = true; DI.audio.play('valve'); }, 'hot', false, 'An alarm, and the manual input of the valves listed above.']]);
      B.p('Typed DETECTION: operating it is the detection leg D, and water still needs P. It stays operated until it is reset here, so a panel reset alone brings the alarm straight back. With the Manual Release zone bypass ON (site setting, NEEDS PE REVIEW) it is typed MANUAL RELEASE on an electric / electric trim and releases without P.'); }
    // a two-port part can be turned end for end in place (free): a check valve, a pump or a backflow preventer set the
    // wrong way round is a fault of its own (the field calls). The glyph shows which way the water is meant to go.
    if (!q.fixed && DI.PARTS[p.type].ports === 2 && !DI.SYSV[p.type]) B.btns([['Turn end for end', () => { DI.pushUndo(); p.rot = (p.rot + 2) % 4; W.ver++; S.touch(); DI.edited(); }, '', false, 'Reverse the part in place: inlet and outlet swap. The glyph points the way the water goes.']]);
    if (!q.fixed) B.btns([['Remove (refund ' + DI.money(DI.partCost(p.type, q)) + ')', () => { const G = g(); DI.pushUndo(); W.money += DI.partCost(p.type, q) + (q.vent ? 3200 : 0); W.removePart(p.id); G.sel = null; DI.edited(); }]]);
  }
  function tilePanel(S, W, k) {
    const x = k % W.w, y = (k / W.w) | 0, room = W.room(x, y), G = g();
    if (W.pd[k]) { const pi = DI.pipeAt(W, k), sid = S.sysd.tileSys[k], brk = S.leaks.find((l) => l.k === k && l.a); B.title(pi.n + ' Sch ' + pi.sch + (W.pk[k] ? ' branch line' : ' main'), x + ',' + y); B.row('Inside diameter', () => pi.id.toFixed(3) + ' in · C = ' + DI.pipeC(W, k));
      if (brk) { B.row('Condition', () => ['BROKEN PIPE', 'bad']); B.btns([['Repair this pipe ' + DI.money(1800), () => { if (spend(1800)) { S.leaks = S.leaks.filter((l) => l !== brk); S.touch(); S.say('Broken pipe section replaced.', 'good'); } }, 'go']]); } B.row('Pressure', () => { const s = sid && S.ss.get(sid); return s && s.state === 'dry' ? psi(s.P) + ' gas' : psi(S.pT[k]); });
      B.row('System', () => sid ? DI.sysName(S, sid) : 'supply side'); if (W.spk[k]) B.row('Sprinkler', () => W.spk[k] === 1 ? 'K5.6, 155 °F quick response (link ' + DI.fmt(S.lt[k] * 9 / 5 + 32) + ' °F)' : [(W.spk[k] === 2 ? 'OPERATED' : 'BROKEN') + ' - replace with a matching head', 'bad']);
      if (G.sc.sandbox) B.btns([W.spk[k] === 1 ? ['Break this sprinkler', () => DI.breakSprinkler(S, k), 'hot'] : null, !brk ? ['Break this pipe', () => DI.breakPipe(S, k), 'hot', false, 'To the P sensor a broken pipe is the same pressure drop as an open sprinkler.'] : null]); }
    if (room) { const rt = DI.ROOMS[room.type], hz = DI.HAZ[rt.haz]; B.title(room.name, rt.cond ? 'heated' : 'UNHEATED'); B.row('Hazard', () => hz.name); B.row('Design', () => hz.dens.toFixed(2) + ' gpm/ft² over ' + hz.area + ' ft² + ' + hz.hose + ' gpm hose');
      B.row('Coverage', () => room.exempt ? 'by others' : [DI.fmt(100 * (room.cov || 0)) + '%', room.cov >= 0.999 ? 'good' : 'bad']); B.row('Temperature', () => [DI.fmt(room.temp) + ' °F', room.temp < 40 ? 'bad' : '']); B.row('Smoke', () => DI.fmt(S.smoke[room.id], 3)); B.row('Contents', () => DI.money(rt.val * room.w * room.h));
      // Refrigerated Space: "held below 5 F" makes it a freezer for the 60 min refill limit of a zone that protects
      // freezer rooms only. Off (the default) it is a cooled space and does not qualify: 30 min. The room type alone
      // never qualifies (FP Lead, Cycle 8). Basis of design: changed in the Sandbox only.
      if (room.type === 'cold') { const tip = 'NFPA 13 allows 60 min instead of 30 to restore air in a refrigerated space maintained below 5 F. Here a zone gets 60 min only when every room it protects is a freezer room with this set (ASSUMED reading, NEEDS PE REVIEW). A cooled space that is not held below 5 F (a 35 F dock, for example) does not qualify and stays at 30 min: the room type alone never qualifies. The room’s temperature itself is not modelled (SIMPLIFICATION).';
        B.row('Held below 5 F (freezer)', () => (room.below5 === true ? ['yes: 60 min air refill limit for a zone wholly in freezer rooms', 'warn'] : 'no: a cooled space (a 35 F dock, for example) does not qualify: 30 min'), tip);
        if (G.sc.sandbox) B.btns([['Held below 5 F: ' + (room.below5 === true ? 'YES' : 'no'), () => { if (room.below5 === true) delete room.below5; else room.below5 = true; W.ver++; S.touch(); DI.edited(); }, room.below5 === true ? 'on' : '', false, tip]]); }
      // Room type (Cycle 8, FA Lead): NFPA 76 applies by room. A data hall can be made a Telecom / MMR room and back
      // (Sandbox only: basis of design); only a telecom room can be an NFPA 76 space, and the site setting is its default.
      const roomSet = () => { W.ver++; S.touch(); DI.edited(); };
      if (room.type === 'hall' || room.type === 'tel') { B.row('Room type', () => rt.name, 'Which rooms count as NFPA 76 telecom is a judgment call: PRACTICE, NEEDS PE REVIEW. A data hall is never an NFPA 76 space; a Telecom / MMR room can be.');
        if (G.sc.sandbox) B.pick('Room type (player choice; PRACTICE, NEEDS PE REVIEW)', ['hall', 'tel'], () => room.type, (v) => { if (room.type === v) return; if (room.name === DI.ROOMS[room.type].name) room.name = DI.ROOMS[v].name; room.type = v; if (v !== 'tel') delete room.n76; roomSet(); }, (v) => DI.ROOMS[v].name); }
      if (room.type === 'tel') { const tip76 = 'NFPA 76 applies by room. With nothing set here the room follows the site setting "NFPA 76 adopted on this site", which is only the default for telecom rooms. Where it applies, the NFPA 76 ceilings are checked against the aspirating detector in this room (Alert 0.2 %/ft, Fire 1 1.0 %/ft), and a VEA detector here defaults to 0.5 %/ft. PRACTICE, NEEDS PE REVIEW.';
        B.row('NFPA 76 applies here (default: the site setting)', () => [(DI.n76Applies(W, room) ? 'yes' : 'no') + (room.n76 === undefined ? ' (the site setting)' : ' (set on this room)'), DI.n76Applies(W, room) ? 'warn' : ''], tip76);
        if (G.sc.sandbox) B.pick('NFPA 76 applies here', ['site', 'yes', 'no'], () => (room.n76 === undefined ? 'site' : room.n76 ? 'yes' : 'no'), (v) => { if (v === 'site') delete room.n76; else room.n76 = v === 'yes'; roomSet(); }, (v) => (v === 'site' ? 'Site setting' : v === 'yes' ? 'Yes' : 'No')); }
      // VEA only: the Fire 1 of a detector in this room. No other detector model has a per-room threshold.
      if (DI.isVea(W)) { const M = DI.ASD_MODELS.VEA;
        B.row('VEA Fire 1 in this room', () => { const f = DI.veaFire1At(W, room), i = M.pick.indexOf(f); return [f + ' %/ft' + (i >= 0 ? ' (' + M.pickName[i] + ')' : '') + ' · ' + DI.veaFire1Src(W, room), i >= 0 ? '' : 'bad']; }, 'The room’s own pick, else the site pick, else the default: 0.5 %/ft in a telecom room where NFPA 76 applies, 1.23 %/ft in every other room. VEA only.');
        if (G.sc.sandbox) B.pick('Room pick (VEA Fire 1, %/ft)', [0].concat(M.pick), () => (typeof room.f1 === 'number' ? room.f1 : 0), (v) => { if (v) room.f1 = v; else delete room.f1; roomSet(); }, (v) => (v ? v + ' (' + M.pickName[M.pick.indexOf(v)] + ')' : 'none')); }
      B.btns([['Send technician', () => say(DI.sendTech(S, room.id))], G.sc.sandbox ? ['Start a fire here', () => DI.ignite(S, k, 0, 1), 'hot'] : null, G.sc.sandbox ? ['Smouldering fault here', () => DI.ignite(S, k, 240, 1), 'hot'] : null]); }
  }
  function homePanel(G) {
    if (G.sc.puzzle) return puzPanel(G);
    B.title(G.sc.name, G.sc.sandbox ? 'sandbox' : 'goals'); if (!G.sc.goals.length) { B.p('Free build. Select a floor tile to start a fire there or break a sprinkler. The Incident menu cuts power and changes the weather.'); return; }
    G.sc.goals.forEach((q, i) => B.add('<div class="goal' + (G.goalOk[i] ? ' ok' : '') + '" style="margin:0 10px;font-size:12.5px"><i>' + (G.goalOk[i] ? '✓' : '○') + '</i><div>' + esc(q.t) + '</div></div>'));
    const nx = G.sc.goals.find((q, i) => !G.goalOk[i]); if (nx && nx.hint) B.p('Next: ' + nx.hint); else if (!nx && G.sc.drill) B.p('All goals met. Run the acceptance drill.');
  }
  // a field call: the question, the goals, the running scorecard and the hints shown so far
  function puzPanel(G) {
    const S = G.S, st = DI.puzStatus(S); B.title(G.sc.name, 'field call ' + G.sc.pz.n + ' · ' + G.sc.v.key); if (!st) return;
    B.p(st.v.diag.q);
    G.sc.goals.forEach((q, i) => B.add('<div class="goal' + (G.goalOk[i] ? ' ok' : '') + '" style="margin:0 10px;font-size:12.5px"><i>' + (G.goalOk[i] ? '✓' : '○') + '</i><div>' + esc(q.t) + '</div></div>'));
    B.sec('SO FAR');
    B.row('Edits', () => String(DI.puzStatus(S).edits)); B.row('Spent', () => DI.money(Math.max(0, DI.puzSpent(S))) + ' of ' + DI.money(G.sc.money));
    B.row('Out of service', () => { const x = DI.puzStatus(S); return x.now.length ? [DI.dur(x.imp) + ' (now)', 'warn'] : DI.dur(x.imp); });
    if (st.v.live) B.row('Resets while the cause was live', () => { const n = S.puz.futile; return n ? [String(n), 'warn'] : '0'; });
    B.row('Hints used', () => (st.v.hints.length - DI.puzStatus(S).left) + ' of ' + st.v.hints.length);
    if (st.hints.length) { B.sec('HINTS'); st.hints.forEach((x, i) => B.p((i + 1) + '. ' + x[0])); }
    B.btns([[st.left ? 'Hint (' + st.left + ' left)' : 'Hints', () => DI.puzUI.hint()], [S.puz.diag.ok ? 'Diagnosed' : 'Diagnose', () => DI.puzUI.diagnose(), S.puz.diag.ok ? '' : 'go'], ['Goals and records', () => DI.puzUI.goals()]]);
  }
  DI.inspect = { render(force) {
    const G = g(); el = el || document.getElementById('side'); if (G.mode !== 'play') { el.innerHTML = ''; lastSig = null; return; }
    const S = G.S, W = G.W, sel = G.sel, p = sel && sel.kind === 'part' ? W.parts.get(sel.id) : null; if (sel && sel.kind === 'part' && !p) G.sel = null;
    el.dataset.selected = String(!!G.sel);
    const s = p && S.ss.get(p.id);
    const sig = JSON.stringify([G.sc.id, sel, p ? p.p : 0, s ? [s.state, s.set, s.holes, s.openK && s.openK.length, s.ret ? (DI.returnStep(S, p.id) || {}).mode : 0, DI.refilling(S, p.id), !!W.cfg.nfpa76Adopted, highGas(S, p), p.type === 'prev' ? drillScored(S, p.id) : 0] : 0, S.leaks.length, S.procs.length, S.results.length, sel ? 0 : G.goalOk, p ? S.calc.get(p.id) && S.calc.get(p.id).minQ : 0, W.ver, !!W.panelOf(p ? p.id : 0), p && p.type === 'prev' ? !!DI.recoveryScore(S, p.id) : 0, p && p.type === 'vesda' ? [DI.n76Flags(W).length, !!W.cfg.nfpa76Adopted] : 0, S.puz ? [S.puz.hints, S.puz.diag.ok, S.puz.diag.tries] : 0], (k, v) => (typeof v === 'number' && k !== 'id' && k !== 'k' ? Math.round(v) : v));
    if (force || sig !== lastSig) { lastSig = sig; acts = []; upd = []; B.h = ''; if (p) partPanel(S, W, p); else if (sel && sel.kind === 'tile') tilePanel(S, W, sel.k); else homePanel(G); el.innerHTML = B.h; if (G.sel) { const close = document.createElement('button'); close.className = 'inspector-close'; close.textContent = '×'; close.title = 'Close inspector'; close.setAttribute('aria-label', 'Close inspector'); el.querySelector('h3').appendChild(close); } }
    for (let i = 0; i < upd.length; i++) { const v = upd[i](); if (v === null) continue; const e = document.getElementById('iv' + i); if (!e) continue; const t = Array.isArray(v) ? v[0] : v, c = Array.isArray(v) ? v[1] : ''; if (e.textContent !== t) e.textContent = t; if (e.className !== c) e.className = c; }
  } };
  window.addEventListener('load', () => { document.getElementById('side').addEventListener('mousedown', (e) => { const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return; e.preventDefault(); const fn = acts[+b.dataset.a]; if (fn) { fn(); DI.audio.play('click'); DI.inspect.render(true); } }); });
})();
