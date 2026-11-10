// Mouse / keyboard: camera, build tools, selection, undo.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const g = () => DI.game, AIR_COST = 25, keys = new Set();
  let drag = null, mouse = { x: 0, y: 0 };
  const tileAt = (mx, my) => { const G = g(), z = G.cam.z; return { x: Math.floor((mx - (innerWidth / 2 - G.cam.x * z)) / z), y: Math.floor((my - (innerHeight / 2 - G.cam.y * z)) / z) }; };
  const rich = (cost) => g().sc.sandbox || cost <= g().W.money;
  const lpath = (a, b, horizFirst) => {            // L-shaped tile path a -> b
    const o = [], sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y); let x = a.x, y = a.y; o.push([x, y]);
    const hx = () => { while (x !== b.x) { x += sx; o.push([x, y]); } }, vy = () => { while (y !== b.y) { y += sy; o.push([x, y]); } };
    if (horizFirst) { hx(); vy(); } else { vy(); hx(); } return o;
  };
  const rect = (a, b) => { const o = []; for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) o.push([x, y]); return o; };

  // what would this drag do, and what does it cost?
  function plan(end) {
    const G = g(), W = G.W, t = G.tool, a = drag.start; let tiles = [], cost = 0, label = '';
    if (t.type === 'pipe') {
      tiles = lpath(a, end, drag.hf).filter(([x, y]) => W.inb(x, y) && !W.partAt[W.k(x, y)]);
      for (const [x, y] of tiles) { const k = W.k(x, y); cost += DI.PIPES[t.size].cost - (W.pd[k] ? DI.PIPES[W.pd[k] - 1].cost : 0); }
      label = DI.PIPES[t.size].n + ' main · ' + tiles.length * 10 + ' ft · ' + DI.money(cost);
    } else if (t.type === 'branch') {
      tiles = rect(a, end).filter(([x, y]) => W.inb(x, y) && !W.partAt[W.k(x, y)]); let n = 0;
      for (const [x, y] of tiles) { const k = W.k(x, y); if (!W.pd[k]) { cost += DI.PIPES[t.bsize].cost + DI.SPK_COST; n++; } else if (!W.spk[k]) { cost += DI.SPK_COST; n++; } }
      label = n + ' sprinklers on ' + DI.PIPES[t.bsize].n + (t.bkind === 1 ? ' lines ↔' : ' lines ↕') + ' · ' + DI.money(cost);
    } else if (t.type === 'air') {
      tiles = lpath(a, end, drag.hf).filter(([x, y]) => W.inb(x, y) && !W.partAt[W.k(x, y)]);
      for (const [x, y] of tiles) if (!W.air[W.k(x, y)]) cost += AIR_COST; label = 'Tubing · ' + DI.money(cost);
    } else if (t.type === 'cap') {
      const horiz = Math.abs(end.x - a.x) > Math.abs(end.y - a.y), single = end.x === a.x && end.y === a.y;
      tiles = single ? [[a.x, a.y]] : horiz ? lpath(a, { x: end.x, y: a.y }, true) : lpath(a, { x: a.x, y: end.y }, false);
      tiles = tiles.filter(([x, y]) => W.inb(x, y)); label = single ? 'Cap joint' : horiz ? 'Cap the south side of this row' : 'Cap the east side of this column';
      return { tiles, cost: 0, label, ok: true, cap: single ? 'one' : horiz ? 'row' : 'col' };
    } else if (t.type === 'erase') {
      tiles = rect(a, end).filter(([x, y]) => W.inb(x, y));
      for (const [x, y] of tiles) { const k = W.k(x, y), p = W.at(x, y); if (p && !p.p.fixed) cost -= DI.partCost(p.type, p.p); cost -= W.pipeCost(x, y); if (W.air[k]) cost -= AIR_COST; }
      label = 'Remove · refund ' + DI.money(-cost);
    }
    return { tiles, cost, label, ok: rich(cost) };
  }
  function commit(pl) {
    const G = g(), W = G.W, t = G.tool; if (!pl.ok || !pl.tiles.length) { if (!pl.ok) DI.ui.banner('Not enough budget for that.'); return; }
    DI.pushUndo();
    if (pl.cap) {
      if (pl.cap === 'one') { const [x, y] = pl.tiles[0], z = G.cam.z, fx = (mouse.x - (innerWidth / 2 - G.cam.x * z)) / z - x, fy = (mouse.y - (innerHeight / 2 - G.cam.y * z)) / z - y;
        const d = [fy, 1 - fx, 1 - fy, fx], e = d.indexOf(Math.min(...d)), tx = e === 3 ? x - 1 : x, ty = e === 0 ? y - 1 : y, south = e === 0 || e === 2; W.setCut(tx, ty, south, !W.cut[W.k(tx, ty) * 2 + (south ? 1 : 0)]); }
      else { const south = pl.cap === 'row', all = pl.tiles.every(([x, y]) => W.cut[W.k(x, y) * 2 + (south ? 1 : 0)]); for (const [x, y] of pl.tiles) W.setCut(x, y, south, !all); }
      DI.edited(); DI.audio.play('place'); return;
    }
    for (const [x, y] of pl.tiles) {
      const k = W.k(x, y);
      if (t.type === 'pipe') { if (W.pd[k]) { W.pd[k] = t.size + 1; W.pk[k] = 0; W.ver++; } else W.setPipe(x, y, t.size, 0); }
      else if (t.type === 'branch') { if (!W.pd[k]) W.setPipe(x, y, t.bsize, t.bkind, true); else if (!W.spk[k]) { W.spk[k] = 1; W.ver++; } }
      else if (t.type === 'air') W.setAir(x, y, 1);
      else if (t.type === 'erase') { const p = W.at(x, y); if (p && !p.p.fixed) { if (G.sel && G.sel.id === p.id) G.sel = null; W.removePart(p.id); } W.erasePipe(x, y); if (W.air[k]) W.setAir(x, y, 0); }
    }
    W.money -= pl.cost; DI.edited(); DI.audio.play(t.type === 'erase' ? 'pop' : 'place');
  }
  function placePart(tl) {
    const G = g(), W = G.W, type = G.tool.part, def = DI.PARTS[type]; if (!W.inb(tl.x, tl.y)) return;
    const k = W.k(tl.x, tl.y); if (W.partAt[k]) { DI.ui.banner('That tile is occupied.'); return; }
    let rot = G.tool.rot, refund = 0;
    if (def.ports === 2) {      // line the part up with the pipe run it is dropped into, inlet toward the supply side
      const w = W.offers(tl.x - 1, tl.y, 1), e = W.offers(tl.x + 1, tl.y, 3), n = W.offers(tl.x, tl.y - 1, 2), s2 = W.offers(tl.x, tl.y + 1, 0), here = !!W.pd[k];
      const pr = (x, y) => (W.inb(x, y) ? G.S.pT[W.k(x, y)] + (G.S.sysd.tileSys[W.k(x, y)] ? 0 : 0.5) : 0);
      if ((w || e) && !(n || s2) || (here && (w || e) && rot % 2 === 0)) rot = w && !e ? 0 : e && !w ? 2 : rot % 2 ? 0 : (pr(tl.x + 1, tl.y) > pr(tl.x - 1, tl.y) + 1 ? 2 : pr(tl.x - 1, tl.y) > pr(tl.x + 1, tl.y) + 1 ? 0 : rot);
      else if ((n || s2) && !(w || e)) rot = n && !s2 ? 1 : s2 && !n ? 3 : rot % 2 ? (pr(tl.x, tl.y + 1) > pr(tl.x, tl.y - 1) + 1 ? 3 : pr(tl.x, tl.y - 1) > pr(tl.x, tl.y + 1) + 1 ? 1 : rot) : 1;
    }
    const cost = DI.partCost(type, def.props) - W.pipeCost(tl.x, tl.y);
    if (!rich(cost)) { DI.ui.banner('Not enough budget: ' + def.name + ' costs ' + DI.money(cost) + '.'); return; }
    DI.pushUndo(); W.erasePipe(tl.x, tl.y); const p = W.addPart(type, tl.x, tl.y, rot); if (!p) return;
    W.money -= cost; DI.edited(); DI.audio.play('place'); G.sel = { kind: 'part', id: p.id }; DI.inspect.render(true);
  }
  function ghostFor(tl) {
    const G = g(), W = G.W, t = G.tool;
    if (drag && drag.kind === 'tool') { G.ghost = plan(tl); return; }
    if (t.type === 'part') { const ok = W.inb(tl.x, tl.y) && !W.partAt[W.k(tl.x, tl.y)]; G.ghost = { tiles: [[tl.x, tl.y]], ok, part: t.part, label: DI.money(DI.partCost(t.part, DI.PARTS[t.part].props)) }; }
    else if (t.type !== 'select' && W.inb(tl.x, tl.y)) G.ghost = { tiles: [[tl.x, tl.y]], ok: true }; else G.ghost = null;
  }
  function tip(tl, mx, my) {
    const G = g(), W = G.W, S = G.S, el = document.getElementById('tip');
    if (!W.inb(tl.x, tl.y) || drag || DI.ui.modalOpen) { el.style.display = 'none'; return; }
    const k = W.k(tl.x, tl.y), p = W.at(tl.x, tl.y); let s = '';
    if (p) s = DI.PARTS[p.type].name + (p.p.label ? ' (' + p.p.label + ')' : '') + ' #' + p.id;
    else if (W.pd[k]) {
      const pi = DI.pipeAt(W, k), sid = S.sysd.tileSys[k], ss = sid && S.ss.get(sid); let q = 0;
      if (S.G) q = Math.max(Math.abs(DI.edgeFlow(S.G, k, false)), Math.abs(DI.edgeFlow(S.G, k, true)), tl.x > 0 ? Math.abs(DI.edgeFlow(S.G, k - 1, false)) : 0, tl.y > 0 ? Math.abs(DI.edgeFlow(S.G, k - W.w, true)) : 0);
      const dry = ss && ss.state === 'dry';
      s = pi.n + ' Sch ' + pi.sch + (W.pk[k] ? ' branch' : ' main') + (W.spk[k] ? ' + sprinkler' : '') + (S.leaks.some((l) => l.k === k && l.a) ? '  BROKEN' : '') + '\n' + (dry ? 'gas ' + DI.fmt(ss.P, 1) + ' psi' : DI.fmt(S.pT[k], 1) + ' psi') + (q > 0.4 ? '  ' + DI.fmt(q) + ' gpm  ' + DI.fmt(0.4085 * q / (pi.id * pi.id), 1) + ' ft/s' : '');
      if (S.dens[k] > 0.005) s += '\napplied ' + DI.fmt(S.dens[k], 2) + ' gpm/ft²';
    } else { const r = W.room(tl.x, tl.y); if (r) s = r.name; }
    if (!s) { el.style.display = 'none'; return; }
    el.textContent = s; el.style.display = 'block'; el.style.left = Math.min(innerWidth - 240, mx + 16) + 'px'; el.style.top = my + 18 + 'px';
  }

  DI.input = { init(cv) {
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousedown', (e) => {
      const G = g(); if (G.mode !== 'play') return; const tl = tileAt(e.clientX, e.clientY), W = G.W, t = G.tool;
      if (e.button !== 0) { if (e.button === 2 && t.type === 'wire') { const p = W.at(tl.x, tl.y); if (p) { W.unwire(p.id); G.wireFrom = 0; return; } } drag = { kind: 'pan', mx: e.clientX, my: e.clientY, cx: G.cam.x, cy: G.cam.y, moved: false, btn: e.button }; return; }
      if (t.type === 'select') {
        const p = W.at(tl.x, tl.y); G.calcShow = null;
        G.sel = p ? { kind: 'part', id: p.id } : W.inb(tl.x, tl.y) && (W.pd[W.k(tl.x, tl.y)] || W.room(tl.x, tl.y)) ? { kind: 'tile', k: W.k(tl.x, tl.y) } : null;
        if (G.sel && G.sel.kind === 'tile') DI.findHead(G.S, G.sel.k);       // selecting an operated head is "find the operated head" in the recovery log
        DI.inspect.render(true); if (p) DI.audio.play('click'); drag = { kind: 'pan', mx: e.clientX, my: e.clientY, cx: G.cam.x, cy: G.cam.y, moved: false, btn: 0 };
      } else if (t.type === 'part') placePart(tl);
      else if (t.type === 'head') { if (!W.inb(tl.x, tl.y)) return; const k = W.k(tl.x, tl.y); if (!W.pd[k]) return; const add = !W.spk[k]; if (add && !rich(DI.SPK_COST)) return; DI.pushUndo(); W.spk[k] = add ? 1 : 0; W.ver++; W.money -= add ? DI.SPK_COST : -DI.SPK_COST; DI.edited(); DI.audio.play('place'); }
      else if (t.type === 'wire') {
        const p = W.at(tl.x, tl.y); if (!p) { G.wireFrom = 0; return; }
        if (!G.wireFrom) { G.wireFrom = p.id; DI.audio.play('click'); }
        else { const a = W.parts.get(G.wireFrom); DI.pushUndo(); if (W.wire(G.wireFrom, p.id)) { DI.audio.play('place'); DI.edited(); if (a && a.type !== 'panel') G.wireFrom = 0; } else { G.undo.pop(); DI.ui.banner('A wire runs between a panel and a device.'); G.wireFrom = p.type === 'panel' ? p.id : 0; } }
      } else { drag = { kind: 'tool', start: tl, hf: true, set: false }; ghostFor(tl); }
    });
    window.addEventListener('mousemove', (e) => {
      const G = g(); if (G.mode !== 'play') return; mouse = { x: e.clientX, y: e.clientY }; const tl = tileAt(e.clientX, e.clientY); G.hover = tl;
      if (drag && drag.kind === 'pan') { const dx = e.clientX - drag.mx, dy = e.clientY - drag.my; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { G.cam.x = drag.cx - dx / G.cam.z; G.cam.y = drag.cy - dy / G.cam.z; } return; }
      if (drag && drag.kind === 'tool' && !drag.set && (tl.x !== drag.start.x || tl.y !== drag.start.y)) { drag.hf = Math.abs(tl.x - drag.start.x) >= Math.abs(tl.y - drag.start.y); drag.set = true; }
      if (e.target === cv) { ghostFor(tl); tip(tl, e.clientX, e.clientY); } else { document.getElementById('tip').style.display = 'none'; if (!drag) G.ghost = null; }
    });
    window.addEventListener('mouseup', () => { const G = g(); if (drag && drag.kind === 'tool' && G.ghost) { commit(G.ghost); G.ghost = null; } drag = null; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault(); const G = g(), z0 = G.cam.z, z1 = DI.clamp(Math.round(z0 * (e.deltaY < 0 ? 1.15 : 1 / 1.15)), 5, 56); if (z1 === z0) return;
      const wx = G.cam.x + (e.clientX - innerWidth / 2) / z0, wy = G.cam.y + (e.clientY - innerHeight / 2) / z0;
      G.cam.z = z1; G.cam.x = wx - (e.clientX - innerWidth / 2) / z1; G.cam.y = wy - (e.clientY - innerHeight / 2) / z1;
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const G = g(), k = e.key.toLowerCase(); if (e.target.tagName === 'INPUT') return;
      if (k === 'escape') { if (DI.ui.modalOpen && DI.ui.dismiss) DI.ui.close(); else if (G.mode === 'play') { DI.ui.setTool('select'); G.calcShow = null; } return; }
      if (G.mode !== 'play' || DI.ui.modalOpen) return;
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); DI.undo(); return; }
      if (e.ctrlKey || e.metaKey) return;
      const tools = { q: 'select', 1: 'pipe', 2: 'branch', 3: 'head', 4: 'air', 5: 'wire', 6: 'cap', x: 'erase' };
      if (tools[k]) DI.ui.setTool(tools[k]);
      else if (k === 'r') { if (G.tool.type === 'branch') G.tool.bkind = G.tool.bkind === 1 ? 2 : 1; else G.tool.rot = (G.tool.rot + 1) % 4; ghostFor(G.hover || { x: 0, y: 0 }); }
      else if (k === '[' || k === ']') { const key = G.tool.type === 'branch' ? 'bsize' : 'size'; G.tool[key] = DI.clamp(G.tool[key] + (k === ']' ? 1 : -1), 0, DI.PIPES.length - 1); DI.ui.toolbar(); }
      else if (k === ' ') { e.preventDefault(); DI.setSpeed(G.speed ? 0 : 1); }
      else if (k === 'm') DI.ui.showManual();
      else if (k === 'g') DI.ui.showGoals();
      else if (k === 'delete' || k === 'backspace') { if (G.sel && G.sel.kind === 'part') { const p = G.W.parts.get(G.sel.id); if (p && !p.p.fixed) { DI.pushUndo(); G.W.money += DI.partCost(p.type, p.p); G.W.removePart(p.id); G.sel = null; DI.edited(); DI.inspect.render(true); } } }
      else keys.add(k);
    });
    window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => keys.clear());
    setInterval(() => { const G = g(); if (G.mode !== 'play' || !keys.size || DI.ui.modalOpen) return; const v = 14 / G.cam.z;
      if (keys.has('a') || keys.has('arrowleft')) G.cam.x -= v; if (keys.has('d') || keys.has('arrowright')) G.cam.x += v; if (keys.has('w') || keys.has('arrowup')) G.cam.y -= v; if (keys.has('s') || keys.has('arrowdown')) G.cam.y += v; }, 16);
  } };
})();
