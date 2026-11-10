// Inspector: the right-hand panel. Live gauges and the controls of whatever is selected.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const g = () => DI.game, esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let acts = [], upd = [], lastSig = null, el = null;
  const B = {
    h: '', add(s) { this.h += s; },
    title(t, sub) { this.add('<h3>' + esc(t) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</h3>'); },
    p(t) { this.add('<p>' + esc(t) + '</p>'); }, sec(t) { this.add('<div class="sec">' + esc(t) + '</div>'); },
    row(label, fn) { const i = upd.length; upd.push(fn); this.add('<div class="row"><span>' + esc(label) + '</span><b id="iv' + i + '"></b></div>'); },
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
    B.btns([['Run hydraulic calc', () => { const c = DI.hydCalc(S, id); S.calc.set(id, c); if (c.ok) g().calcShow = { tiles: c.tiles, pass: c.pass }; else say(c.err); }, 'go']]);
    const c = S.calc.get(id); if (!c || !c.ok) return;
    B.add('<div class="res ' + (c.pass ? 'pass' : 'fail') + '"><b>' + (c.pass ? 'PASS' : 'FAIL') + ' · ' + esc(c.hz.name) + (c.room ? ' \u00b7 ' + esc(g().W.rooms[c.room - 1].name) : '') + '</b>' +
      'Design area ' + DI.fmt(c.area) + ' ft²' + (c.dryLike ? ' (+30% dry)' : '') + ': ' + c.n + ' sprinklers<br>Need ' + DI.fmt(c.need, 1) + ' gpm each (' + c.hz.dens.toFixed(2) + ' gpm/ft²)<br>Weakest gets ' + DI.fmt(c.minQ, 1) + ' gpm (' + c.dens.toFixed(3) + ')<br>' +
      'Demand ' + DI.fmt(c.total) + ' gpm (incl. ' + c.hz.hose + ' hose) @ ' + DI.fmt(c.pRiser) + ' psi at riser' + c.pumpPts.filter((p) => p.on).map((p) => '<br>Pump #' + p.id + ' at ' + DI.fmt(p.pct) + '% of rated' + (p.pct > 150 ? ' - OVERLOADED' : '')).join('') +
      (isFinite(c.tankMin) ? '<br>Tank lasts ' + DI.fmt(c.tankMin) + ' min (need ' + c.hz.dur + ')' : '') + '</div>');
  }
  function sysPanel(S, W, p) {
    const s = S.ss.get(p.id), inf = S.sysd.info.get(p.id), q = p.p, dry = p.type !== 'wetv'; if (!s || !inf) return;
    B.sec('GAUGES'); B.row('Water supply', () => psi(S.pin(p.id)));
    B.row(dry ? 'System (gas)' : 'System', () => { const v = dry && s.state !== 'wet' ? s.P : S.pout(p.id); return [psi(v), dry && s.lowAir ? 'warn' : '']; });
    if (p.type === 'dryv') B.row('Trip point (supply ÷ 5.5)', () => psi(S.pin(p.id) / DI.DRY_RATIO));
    B.row('Status', () => s.state === 'wet' ? (dry ? ['TRIPPED - full of water', 'bad'] : ['Normal', 'good']) : s.state === 'filling' ? ['Filling ' + DI.fmt(100 * s.wat / Math.max(inf.vol, 1)) + '%', 'warn'] : s.set ? ['Set - in service', 'good'] : ['Charging with air', 'warn']);
    B.row('Flow through valve', () => gpm(s.flow || 0));
    B.row('Piping', () => DI.fmt(inf.vol) + ' gal · ' + inf.nSpk + ' heads · ' + inf.area.toLocaleString() + ' ft²');
    if (p.type === 'prev') { B.sec('INTERLOCKS'); B.row('1. Detection (solenoid)', () => q.sol ? ['RELEASED', 'bad'] : ['holding', 'good']); B.row('2. Supervisory air', () => s.state !== 'dry' || s.P < Math.max(5, 0.45 * q.airSet) ? ['LOST', 'bad'] : ['holding', 'good']);
      B.pick('Release mode', ['double', 'single', 'non'], () => q.mode, (v) => { q.mode = v; W.ver++; }, (v) => ({ double: 'Double interlock', single: 'Single', non: 'Non-interlock' }[v])); }
    if (dry) {
      B.sec('SUPERVISORY GAS'); B.row('Source', () => inf.src.length ? inf.src.map((id) => W.parts.get(id).type === 'n2' ? 'N₂ gen #' + id : 'Compressor #' + id).join(', ') : ['NONE - run tubing', 'bad']);
      B.step('Set pressure', () => q.airSet, (v) => { q.airSet = v; }, 5, 10, 60, ' psi'); B.row('Oxygen', () => s.state === 'wet' ? '-' : [DI.fmt(100 * s.o2g / Math.max(s.G, 1e-9), 1) + ' %', s.o2g / Math.max(s.G, 1e-9) <= 0.02 ? 'good' : '']);
      B.row('Fill time (0 to set)', () => s.fillTime > 0 ? [DI.dur(s.fillTime), s.fillTime <= 1800 ? 'good' : 'bad'] : '-'); B.row('Corrosion / pinholes', () => [DI.fmt(100 * s.corr) + '% / ' + (s.holes || 0), s.holes ? 'warn' : '']);
      B.btns([p.type === 'dryv' ? ['Accelerator ' + (q.qod ? 'ON' : 'off'), () => reprice(p, () => { q.qod = !q.qod; }), q.qod ? 'on' : '', false, 'Quick-opening device: trips the valve on the first few psi of loss. +$2,800'] : null,
        ['N₂ purge vent ' + (q.vent ? 'ON' : 'off'), () => { if (q.vent) { q.vent = false; g().W.money += 3200; } else if (spend(3200)) q.vent = true; }, q.vent ? 'on' : '', false, 'Bleeds gas at the far end until an analyzer reads 98% nitrogen. $3,200'],
        ['Air supply ' + (q.airValve ? 'open' : 'SHUT'), () => { q.airValve = q.airValve ? 0 : 1; }, q.airValve ? '' : 'hot'], s.holes ? ['Repair ' + s.holes + ' leak(s) ' + DI.money(s.holes * 1800), () => { if (spend(s.holes * 1800)) { s.holes = 0; s.corr = Math.min(s.corr, 0.25); S.say('Leaking pipe sections replaced.', 'good'); } }] : null]);
    }
    B.sec('OPERATE');
    B.btns([[(dry ? 'Main drain ' : 'Main drain ') + (q.drain ? 'OPEN' : 'closed'), () => { q.drain = q.drain ? 0 : 1; S.touch(); }, q.drain ? 'hot' : ''], dry ? ['System drain ' + (q.sdrain ? 'OPEN' : 'closed'), () => { q.sdrain = q.sdrain ? 0 : 1; S.touch(); }, q.sdrain ? 'hot' : ''] : null,
      ['Inspector’s test ' + (q.itc ? 'OPEN' : 'closed'), () => { q.itc = q.itc ? 0 : 1; S.touch(); }, q.itc ? 'hot' : ''],
      p.type === 'prev' ? ['Manual release', () => { q.pull = true; }, 'hot', q.pull, 'Emergency pull station: trips the valve regardless of interlocks'] : null,
      dry && s.state !== 'dry' ? ['Reset valve', () => say(DI.resetValve(S, p.id)), 'go'] : null,
      s.openK && s.openK.length ? ['Replace ' + s.openK.length + ' sprinkler(s)', () => say(DI.replaceSprinklers(S, p.id)), 'go'] : null]);
    B.sec('TESTS'); const busy = S.procs.some((x) => x.id === p.id);
    B.btns([dry ? ['Full-flow trip test', () => test('trip', p.id), '', busy] : ['Inspector’s test (timed)', () => test('itc', p.id), '', busy], ['Main drain test', () => test('drain', p.id), '', busy], dry ? ['24 h air test', () => test('leak', p.id), '', busy] : null]);
    if (busy) B.p('Test running… speed up time if you like.');
    for (const k of dry ? ['trip', 'leak', 'drain'] : ['itc', 'drain']) B.res(DI.lastResult(S, k, p.id));
    B.sec('HYDRAULICS'); calcBlock(S, p.id);
  }
  function partPanel(S, W, p) {
    const d = DI.PARTS[p.type], q = p.p;
    B.title(q.label || d.name, '#' + p.id); B.p(d.desc);
    const pn = W.panelOf(p.id); if (['gate', 'wetv', 'dryv', 'prev', 'epump', 'dpump', 'vesda', 'smoke'].includes(p.type)) B.row('Wired to', () => { const x = W.panelOf(p.id); return x ? ['Panel #' + x.id, 'good'] : ['NOT WIRED', 'warn']; });
    if (p.type === 'gate') { B.row('Position', () => [DI.fmt(q.open * 100) + '% open', q.open > 0.98 ? 'good' : 'bad']); B.row('Flow', () => gpm(Math.abs(S.flowOf(p.id)))); B.row('Upstream / downstream', () => DI.fmt(S.pin(p.id)) + ' / ' + DI.fmt(S.pout(p.id)) + ' psi');
      B.btns([[q.target > 0.5 ? 'Close valve' : 'Open valve', () => { q.target = q.target > 0.5 ? 0 : 1; DI.audio.play('valve'); }, q.target > 0.5 ? 'hot' : 'go']]); }
    else if (p.type === 'city') { B.row('Flow test', () => q.stat + ' static, ' + q.resid + ' @ ' + q.flow + ' gpm'); B.row('Flowing now', () => gpm(S.flowOf(p.id))); B.row('Pressure at tap', () => psi(S.pout(p.id))); }
    else if (p.type === 'tank') { B.pick('Capacity (gal)', [60000, 120000, 240000, 360000, 500000], () => q.cap, (v) => reprice(p, () => { q.cap = v; q.gal = v; }), (v) => v / 1000 + 'k'); B.row('Level', () => DI.fmt(100 * q.gal / q.cap, 1) + '%  (' + Math.round(q.gal).toLocaleString() + ' gal)'); B.row('Draw', () => gpm(S.flowOf(p.id))); B.row('Lasts at this rate', () => S.flowOf(p.id) > 5 ? DI.dur(q.gal / S.flowOf(p.id) * 60) : '-'); }
    else if (p.type === 'epump' || p.type === 'dpump') {
      B.canvas(296, 150, pumpChart(p));
      B.row('Status', () => q.spd > 0.9 ? ['RUNNING', 'good'] : q.on ? [q.failed ? 'FAILED TO START' : p.type === 'dpump' ? 'cranking' : 'no power', 'bad'] : 'standby');
      B.row('Flow', () => gpm(S.flowOf(p.id)) + ' (' + DI.fmt(100 * S.flowOf(p.id) / q.gpm) + '%)'); B.row('Suction / discharge', () => DI.fmt(S.pin(p.id)) + ' / ' + DI.fmt(S.pout(p.id)) + ' psi'); B.row('System pressure (sensing line)', () => psi(S.pout(q.sense || p.id)));
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
    else if (p.type === 'comp' || p.type === 'n2') { B.pick('Capacity (SCFM)', p.type === 'comp' ? DI.COMP_SCFM : DI.N2_SCFM, () => q.scfm, (v) => reprice(p, () => { q.scfm = v; })); B.row('Status', () => q.on ? ['RUNNING', 'good'] : 'idle'); B.row('Starts', () => String(q.starts)); B.row('Run time', () => DI.dur(q.runSec) + ' (' + DI.fmt(100 * q.runSec / Math.max(S.t, 1), 1) + '% duty)');
      B.row('Feeds', () => { const o = []; for (const [id, i] of S.sysd.info) if (i.src.includes(p.id)) o.push('#' + id); return o.length ? 'valve ' + o.join(', ') : ['nothing - run tubing', 'bad']; }); }
    else if (p.type === 'panel') { B.row('Power', () => W.power ? ['AC normal', 'good'] : q.alive ? ['BATTERY ' + DI.fmt(q.battH, 1) + ' h', 'warn'] : ['DEAD', 'bad']); B.row('Devices wired', () => String(W.wires.filter((w) => w[0] === p.id).length)); B.btns([['Panel reset', () => DI.panelReset(S, p.id), 'go']]); B.p('Reset clears latched detection and drops out the release solenoids. If a detector is still in alarm it latches right back.'); }
    else if (p.type === 'vesda' || p.type === 'smoke') { const room = W.room(p.x, p.y), T = p.type === 'vesda' ? DI.VESDA_T : DI.SPOT_T;
      B.row('Room', () => room ? room.name : ['outdoors - move it', 'bad']); B.row('Smoke reading', () => DI.fmt(q.obs || 0, 3)); B.row('Level', () => p.type === 'vesda' ? [DI.VESDA_N[q.lvl] || 'normal', q.lvl >= 3 ? 'bad' : q.lvl ? 'warn' : 'good'] : [q.lvl >= 2 ? 'CONFIRMED' : q.lvl ? 'FIRST ZONE' : 'normal', q.lvl ? 'bad' : 'good']);
      B.row('Thresholds', () => T.join(' / ')); if (room) B.btns([['Send technician', () => say(DI.sendTech(S, room.id)), 'go', false, 'Someone walks to the room. If the fire is still smouldering they can stop it by hand.']]); }
    if (!q.fixed) B.btns([['Remove (refund ' + DI.money(DI.partCost(p.type, q)) + ')', () => { const G = g(); DI.pushUndo(); W.money += DI.partCost(p.type, q) + (q.vent ? 3200 : 0); W.removePart(p.id); G.sel = null; DI.edited(); }]]);
  }
  function tilePanel(S, W, k) {
    const x = k % W.w, y = (k / W.w) | 0, room = W.room(x, y), G = g();
    if (W.pd[k]) { const pi = DI.PIPES[W.pd[k] - 1], sid = S.sysd.tileSys[k]; B.title(pi.n + (W.pk[k] ? ' branch line' : ' main'), x + ',' + y); B.row('Pressure', () => { const s = sid && S.ss.get(sid); return s && s.state === 'dry' ? psi(s.P) + ' gas' : psi(S.pT[k]); });
      B.row('System', () => sid ? DI.sysName(S, sid) : 'supply side'); if (W.spk[k]) B.row('Sprinkler', () => W.spk[k] === 1 ? 'K5.6, 155 °F quick response (link ' + DI.fmt(S.lt[k] * 9 / 5 + 32) + ' °F)' : [W.spk[k] === 2 ? 'OPERATED' : 'BROKEN', 'bad']);
      if (G.sc.sandbox && W.spk[k] === 1) B.btns([['Break this sprinkler', () => DI.breakSprinkler(S, k), 'hot']]); }
    if (room) { const rt = DI.ROOMS[room.type], hz = DI.HAZ[rt.haz]; B.title(room.name, rt.cond ? 'heated' : 'UNHEATED'); B.row('Hazard', () => hz.name); B.row('Design', () => hz.dens.toFixed(2) + ' gpm/ft² over ' + hz.area + ' ft² + ' + hz.hose + ' gpm hose');
      B.row('Coverage', () => room.exempt ? 'by others' : [DI.fmt(100 * (room.cov || 0)) + '%', room.cov >= 0.999 ? 'good' : 'bad']); B.row('Temperature', () => [DI.fmt(room.temp) + ' °F', room.temp < 40 ? 'bad' : '']); B.row('Smoke', () => DI.fmt(S.smoke[room.id], 3)); B.row('Contents', () => DI.money(rt.val * room.w * room.h));
      B.btns([['Send technician', () => say(DI.sendTech(S, room.id))], G.sc.sandbox ? ['Start a fire here', () => DI.ignite(S, k, 0, 1), 'hot'] : null, G.sc.sandbox ? ['Smouldering fault here', () => DI.ignite(S, k, 240, 1), 'hot'] : null]); }
  }
  function homePanel(G) {
    B.title(G.sc.name, G.sc.sandbox ? 'sandbox' : 'goals'); if (!G.sc.goals.length) { B.p('Free build. Select a floor tile to start a fire there or break a sprinkler. The Incident menu cuts power and changes the weather.'); return; }
    G.sc.goals.forEach((q, i) => B.add('<div class="goal' + (G.goalOk[i] ? ' ok' : '') + '" style="margin:0 10px;font-size:12.5px"><i>' + (G.goalOk[i] ? '✓' : '○') + '</i><div>' + esc(q.t) + '</div></div>'));
    const nx = G.sc.goals.find((q, i) => !G.goalOk[i]); if (nx && nx.hint) B.p('Next: ' + nx.hint); else if (!nx && G.sc.drill) B.p('All goals met. Run the acceptance drill.');
  }
  DI.inspect = { render(force) {
    const G = g(); el = el || document.getElementById('side'); if (G.mode !== 'play') { el.innerHTML = ''; lastSig = null; return; }
    const S = G.S, W = G.W, sel = G.sel, p = sel && sel.kind === 'part' ? W.parts.get(sel.id) : null; if (sel && sel.kind === 'part' && !p) G.sel = null;
    const s = p && S.ss.get(p.id);
    const sig = JSON.stringify([G.sc.id, sel, p ? p.p : 0, s ? [s.state, s.set, s.holes, s.openK && s.openK.length] : 0, S.procs.length, S.results.length, sel ? 0 : G.goalOk, p ? S.calc.get(p.id) && S.calc.get(p.id).minQ : 0, W.ver, !!W.panelOf(p ? p.id : 0)], (k, v) => (typeof v === 'number' && k !== 'id' && k !== 'k' ? Math.round(v) : v));
    if (force || sig !== lastSig) { lastSig = sig; acts = []; upd = []; B.h = ''; if (p) partPanel(S, W, p); else if (sel && sel.kind === 'tile') tilePanel(S, W, sel.k); else homePanel(G); el.innerHTML = B.h; }
    for (let i = 0; i < upd.length; i++) { const v = upd[i](); if (v === null) continue; const e = document.getElementById('iv' + i); if (!e) continue; const t = Array.isArray(v) ? v[0] : v, c = Array.isArray(v) ? v[1] : ''; if (e.textContent !== t) e.textContent = t; if (e.className !== c) e.className = c; }
  } };
  window.addEventListener('load', () => { document.getElementById('side').addEventListener('mousedown', (e) => { const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return; e.preventDefault(); const fn = acts[+b.dataset.a]; if (fn) { fn(); DI.audio.play('click'); DI.inspect.render(true); } }); });
})();
