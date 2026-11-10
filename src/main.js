// Game shell: scenario start, main loop, save / load, completion.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const g = DI.game = { W: null, S: null, sc: null, cam: { x: 20, y: 12, z: 22 }, tool: { type: 'select', size: 6, bsize: 1, rot: 0, bkind: 1, part: null }, sel: null, speed: 1, hover: null, ghost: null, undo: [], now: 0,
    prog: LS.get('di.progress', { done: {} }), goalOk: [], acc: 0, warp: 0, mode: 'menu' };
  DI.LS = LS;

  DI.startScenario = function (id, fresh) {
    const sc = DI.SCEN.find((s) => s.id === id), sv = fresh ? null : LS.get('di.save.' + id, null);
    let W, S;
    if (sv) { W = DI.World.fromJSON(sv.world); for (const r of W.rooms) { const o = sv.world.rooms.find((q) => q.id === r.id); if (o) { r.exempt = o.exempt; } } S = new DI.Sim(W); S.contract = !sc.sandbox; S.restore(sv.sim); if (sc.start && sv.sim.leaks.length) S.dirty = true; }
    else ({ W, S } = DI.buildScenario(sc));           // fresh map: the contract's fixed site settings (sc.cfg) are merged in
    Object.assign(g, { W, S, sc, sel: null, ghost: null, undo: [], speed: 1, warp: 0, acc: 0, goalOk: sc.goals.map(() => false), calcShow: null, mode: 'play', drillPassed: !!(sv && sv.drillPassed), calcI: 0, doneShown: false });
    S.calc = new Map(); S.rv = DI.review(S); DI.simFlags(S, sc);
    let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0; for (const r of W.rooms) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    for (const p of W.parts.values()) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + 1); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + 1); }
    g.cam.x = (x0 + x1) / 2; g.cam.y = (y0 + y1) / 2 + 1; g.cam.z = DI.clamp(Math.floor(Math.min((innerWidth - 660) / (x1 - x0 + 4), (innerHeight - 190) / (y1 - y0 + 4))), 9, 26);
    DI.ui.onScenario(); if (!sv) DI.ui.showBrief(sc);
  };
  DI.saveGame = function () { if (g.mode !== 'play' || (g.S.drill && !g.S.drill.done)) return; LS.set('di.save.' + g.sc.id, { world: g.W.toJSON(), sim: g.S.dump(), drillPassed: g.drillPassed }); };
  DI.pushUndo = function () { g.undo.push(JSON.stringify(g.W.toJSON())); if (g.undo.length > 40) g.undo.shift(); };
  DI.undo = function () {
    const j = g.undo.pop(); if (!j) return; const o = JSON.parse(j), W = DI.World.fromJSON(o);
    for (const r of W.rooms) { const q = g.W.rooms.find((a) => a.id === r.id); if (q) { r.exempt = q.exempt; r.temp = q.temp; r.burst = q.burst; r.smk = q.smk; r.cov = q.cov; } }
    W.power = g.W.power; W.cfg = g.W.cfg; W.ver = g.W.ver + 1; g.W = W; g.S.W = W; g.S.sync(); g.sel = null; DI.edited();
  };
  DI.edited = function () { g.S.editT = g.S.t; g.calcShow = null; };
  DI.setSpeed = function (s) { g.speed = s; g.warp = 0; document.querySelectorAll('.sp').forEach((b) => b.classList.toggle('on', +b.dataset.sp === s)); };
  DI.skip = function (sec) { g.warp = sec; g.warpTot = sec; };

  let last = 0, tUI = 0, tSlow = 0, tSave = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dtR = Math.min(0.1, (ts - last) / 1000 || 0); last = ts; g.now += dtR;
    const cv = DI.cv, c = DI.ctx; if (!cv) return;
    if (g.mode === 'play') {
      const S = g.S, sc = g.sc;
      if (g.warp > 0) { const sig0 = S.sig.size; g.warp = S.warp(g.warp, 14); DI.drillStep(S); if (sc.tick) sc.tick(S); if (S.sig.size > sig0 && [...S.sig.values()].some((o) => o.type === 'ALARM' && !o.sup)) g.warp = 0; }
      else if (g.speed > 0 && !DI.ui.modalOpen) {
        g.acc += dtR * g.speed;
        let busy = S.outFlow > 0.5 || S.fires.length > 0; if (!busy) for (const s of S.ss.values()) if (s.state === 'filling') { busy = true; break; }
        const base = g.speed <= 1 ? 0.1 : g.speed <= 4 ? 0.2 : g.speed <= 20 ? 0.5 : 1, step = busy ? Math.min(base, 0.25) : base, t0 = performance.now();
        while (g.acc >= step && performance.now() - t0 < 11) { S.step(step); g.acc -= step; DI.drillStep(S); }
        if (sc.tick) sc.tick(S); if (g.acc > step * 6) g.acc = 0;
      }
      if (g.now - tSlow > 0.6) { tSlow = g.now; slow(); }
      if (g.now - tUI > 0.2) { tUI = g.now; DI.ui.tick(); }
      if (g.now - tSave > 8) { tSave = g.now; DI.saveGame(); }
      DI.draw(g, c, innerWidth, innerHeight, g.now);
      DI.audio && DI.audio.tick(g);
    } else { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#070b0f'; c.fillRect(0, 0, cv.width, cv.height); }
  }
  // slow housekeeping: plan review, one hydraulic calc per pass, goals, completion
  function slow() {
    const S = g.S, sc = g.sc; if (S.ver !== g.W.ver) S.sync();
    S.rv = DI.review(S);
    const ids = [...S.sysd.info.keys()]; for (const id of [...S.calc.keys()]) if (!S.sysd.info.has(id)) S.calc.delete(id);
    if (ids.length && !S.fires.length && S.outFlow < 1) { const id = ids[g.calcI++ % ids.length]; if (S.sysd.info.get(id).nSpk) S.calc.set(id, DI.hydCalc(S, id)); else S.calc.delete(id); }
    g.goalOk = sc.goals.map((q) => { try { return !!q.ok(S); } catch (e) { return false; } });
    const all = g.goalOk.length > 0 && g.goalOk.every(Boolean);
    if (all && !sc.drill && !g.doneShown) { g.doneShown = true; DI.complete({ pass: true, lines: ['All goals met.'], loss: 0, stats: S.stats }); }
  }
  DI.goalsDone = () => g.goalOk.length > 0 && g.goalOk.every(Boolean);
  DI.complete = function (res) {
    const sc = g.sc, spent = sc.money - g.W.money, full = DI.goalsDone() || !sc.goals.length;
    let stars = 0;
    if (res.pass && full) { stars = 1 + (spent <= sc.par ? 1 : 0) + (res.loss <= (sc.drill ? 0.5 : 1) * (res.limit || 1e12) ? 1 : 0); g.drillPassed = true;
      const prev = g.prog.done[sc.id]; if (!prev || prev.stars < stars) g.prog.done[sc.id] = { stars, spent }; LS.set('di.progress', g.prog); }
    DI.ui.showReport(res, stars, spent, full);
  };
  DI.bus.on('drillEnd', (d) => { DI.setSpeed(1); DI.complete(d.result); });

  window.addEventListener('load', () => {
    const cv = DI.cv = document.getElementById('cv'); DI.ctx = cv.getContext('2d');
    const fit = () => { const d = Math.min(2, window.devicePixelRatio || 1); DI.dpr = d; cv.width = Math.floor(innerWidth * d); cv.height = Math.floor(innerHeight * d); };
    fit(); window.addEventListener('resize', fit);
    DI.ui.init(); DI.input.init(cv); DI.ui.showMenu(); requestAnimationFrame(frame);
    window.addEventListener('beforeunload', DI.saveGame);
  });
})();
