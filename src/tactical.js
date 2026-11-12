// Navigation and field coaching. Presentation only: never edits the plant or simulation.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const $ = (id) => document.getElementById(id);
  const notes = {
    city: ['Start with the source', 'Pressure is only half the story. A water supply must also deliver the flow your most demanding system needs.', 'hyd'],
    tank: ['A reserve with a deadline', 'Stored water buys time. Compare usable gallons with system demand to find how long the supply can last.', 'pump'],
    epump: ['Pressure has a price', 'A pump adds pressure, not water. Follow its curve: as demand rises, the pressure it can add falls.', 'pump'],
    dpump: ['Keep the second driver ready', 'A diesel pump can survive a utility outage. Its fuel, battery and cooling still need attention.', 'pump'],
    jockey: ['Let the small pump do the small job', 'The jockey pump makes up small leaks. Set it above the fire pump so routine losses do not start the big machine.', 'set'],
    bfp: ['Protect the public supply', 'A backflow preventer keeps fire-system water out of the drinking supply. It also costs pressure: include that loss.', 'wet'],
    gate: ['Open is a safety condition', 'A closed control valve can leave a pressurized system without a useful supply. Supervision tells the panel when it moves.', 'sig'],
    check: ['One direction only', 'A check valve prevents reverse flow. Trace the arrow from the supply toward the protected space.', 'pump'],
    wetv: ['Heat opens the sprinkler', 'Wet piping already holds water. Only sprinklers heated enough to operate discharge; a smoke alarm alone does not open them.', 'wet'],
    dryv: ['Air must leave before water arrives', 'Compressed air holds the dry valve closed. When a head opens, air falls, the valve trips and water travels to the fire.', 'dry'],
    prev: ['Two independent conditions', 'Normal double-interlock release needs detection AND the low-air input. Detection alone does not put water in the piping.', 'pre'],
    comp: ['Too much air can slow protection', 'The compressor restores supervisory pressure. Higher pressure is not always better: air must escape before water can arrive.', 'gas'],
    n2: ['Less oxygen, less corrosion', 'Nitrogen reduces the oxygen feeding corrosion. Purging and leak repair matter as much as installing the generator.', 'gas'],
    panel: ['Read the signal, then the cause', 'Alarm, supervisory and trouble describe different conditions. Silencing acknowledges the sound; it does not repair the cause.', 'sig'],
    vesda: ['An early warning buys time', 'Aspirating detection samples the room air. Early smoke detection can prompt investigation before a sprinkler operates.', 'pre'],
    smoke: ['Detection is one piece of the chain', 'A detector senses smoke. Follow the wiring and system logic to understand what that input actually controls.', 'sig'],
    fdc: ['A supplemental water path', 'The fire department connection lets responders support the system. Check valves control where their water can go.', 'wet'],
    testhdr: ['Prove it under flow', 'A static gauge reading cannot prove pump capacity. A flow test shows whether the supply and pump deliver together.', 'pump']
  };
  let root, mini, map, view, lastNote = '', lastLayout = '';
  const nav = DI.tactical = {};
  nav.init = function () {
    root = document.createElement('div'); root.id = 'tactical'; root.hidden = true;
    root.innerHTML = '<div id="viewControls" aria-label="Map controls"><span class="view-live"><i></i><span id="viewState">LIVE SYSTEMS</span></span><span class="view-scale">5 ft guides <b>·</b> 10 ft build</span><button id="vGrid" aria-pressed="true" title="Toggle 5-foot detail guides">Grid</button><button id="vFit" title="Fit campus (F)">Fit <kbd>F</kbd></button><button id="vOut" aria-label="Zoom out">−</button><button id="vIn" aria-label="Zoom in">+</button><button id="vPhoto" title="Hide interface (H)" aria-label="Hide interface">Hide</button></div>' +
      '<aside id="campusNav"><div class="nav-head"><span>CAMPUS OVERVIEW</span><span id="navZoom"></span></div><canvas id="campusMap" width="544" height="224" tabindex="0" role="button" aria-label="Campus minimap. Click to move the camera. Arrow keys pan; Enter fits the campus."></canvas><div class="map-key"><span><i class="water"></i> Water</span><span><i class="gas"></i> Air / N₂</span><span><i class="alarm"></i> Fire</span><span>CLICK TO NAVIGATE</span></div><div id="fieldCoach"><div class="coach-tag">FIELD NOTE <span id="coachNumber">01</span></div><h3 id="coachTitle"></h3><p id="coachText"></p><button id="coachMore">Explore the principle <span>&gt;</span></button></div><div class="mission-progress"><span id="missionPhase"></span><span id="missionCount"></span><div class="mission-track"><i id="missionFill"></i></div></div></aside>' +
      '<button id="restoreHud" hidden>Show interface <kbd>H</kbd></button>';
    document.body.appendChild(root); mini = $('campusMap'); map = mini.getContext('2d'); view = $('viewControls');
    $('vGrid').onclick = () => { const g = DI.game; g.viewGrid = g.viewGrid === false; $('vGrid').setAttribute('aria-pressed', String(g.viewGrid)); };
    $('vFit').onclick = nav.fit;
    $('vOut').onclick = () => nav.zoom(1 / 1.2); $('vIn').onclick = () => nav.zoom(1.2);
    $('vPhoto').onclick = $('restoreHud').onclick = nav.photo;
    mini.addEventListener('click', (e) => { const r = mini.getBoundingClientRect(), g = DI.game; g.cam.x = DI.clamp((e.clientX - r.left) / r.width * g.W.w, 0, g.W.w); g.cam.y = DI.clamp((e.clientY - r.top) / r.height * g.W.h, 0, g.W.h); nav.drawMap(); });
    mini.addEventListener('keydown', (e) => { const g = DI.game; if (e.key === 'Enter' || e.key === ' ') nav.fit(); else if (e.key === 'ArrowLeft') g.cam.x -= 3; else if (e.key === 'ArrowRight') g.cam.x += 3; else if (e.key === 'ArrowUp') g.cam.y -= 3; else if (e.key === 'ArrowDown') g.cam.y += 3; else return; e.preventDefault(); e.stopPropagation(); nav.drawMap(); });
    window.addEventListener('keydown', (e) => { if (DI.game.mode !== 'play' || DI.ui.modalOpen || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return; if (e.key.toLowerCase() === 'f') nav.fit(); else if (e.key.toLowerCase() === 'h') nav.photo(); });
    window.addEventListener('resize', () => { lastLayout = ''; if (DI.game.mode === 'play') nav.tick(); });
  };
  nav.visible = function (on) { if (root && root.hidden === on) root.hidden = !on; };
  nav.onScenario = function () { nav.visible(true); document.body.classList.remove('cinematic'); $('restoreHud').hidden = true; lastNote = ''; lastLayout = ''; $('vGrid').setAttribute('aria-pressed', String(DI.game.viewGrid !== false)); nav.tick(); };
  nav.photo = function () { const on = document.body.classList.toggle('cinematic'); $('restoreHud').hidden = !on; $('tip').style.display = 'none'; };
  nav.zoom = function (factor) { DI.game.cam.z = DI.clamp(Math.round(DI.game.cam.z * factor), 5, 56); nav.drawMap(); };
  nav.fit = function () {
    const g = DI.game, W = g.W; if (!W) return;
    let x0 = W.w, y0 = W.h, x1 = 0, y1 = 0;
    for (const r of W.rooms) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    for (const p of W.parts.values()) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + 1); y1 = Math.max(y1, p.y + 1); }
    for (let k = 0; k < W.pd.length; k++) if (W.pd[k] || W.air[k]) { const x = k % W.w, y = Math.floor(k / W.w); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    if (x1 <= x0) { x0 = y0 = 0; x1 = W.w; y1 = W.h; }
    const cinematic = document.body.classList.contains('cinematic'), left = cinematic ? 28 : innerWidth > 1050 ? 324 : 20, right = cinematic ? 28 : innerWidth > 1050 ? 348 : 20, top = cinematic ? 28 : 105;
    const bottom = cinematic ? innerHeight - 28 : $('tools').getBoundingClientRect().top - 24;
    const cx = (left + innerWidth - right) / 2, cy = (top + bottom) / 2;
    const z = g.cam.z = DI.clamp(Math.floor(Math.min((innerWidth - left - right) / (x1 - x0 + 3), (bottom - top) / (y1 - y0 + 3))), 5, 38);
    g.cam.x = (x0 + x1) / 2 - (cx - innerWidth / 2) / z; g.cam.y = (y0 + y1) / 2 - (cy - innerHeight / 2) / z; nav.drawMap();
  };
  nav.drawMap = function () {
    const g = DI.game, W = g.W, S = g.S; if (!W || !map) return;
    const w = 272, h = 112, sx = w / W.w, sy = h / W.h;
    map.setTransform(2, 0, 0, 2, 0, 0); map.fillStyle = '#07121a'; map.fillRect(0, 0, w, h);
    map.strokeStyle = '#102732'; map.lineWidth = 0.5;
    for (let x = 0; x < w; x += 16) { map.beginPath(); map.moveTo(x, 0); map.lineTo(x, h); map.stroke(); }
    for (let y = 0; y < h; y += 16) { map.beginPath(); map.moveTo(0, y); map.lineTo(w, y); map.stroke(); }
    for (const r of W.rooms) { map.fillStyle = r.type === 'hall' ? '#1c4550' : '#23323c'; map.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy); map.strokeStyle = '#496777'; map.strokeRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy); }
    for (let k = 0; k < W.pd.length; k++) if (W.pd[k]) { const sid = S.sysd.tileSys[k], state = S.ss.get(sid); const gas = state && (state.state === 'dry' || (state.state === 'filling' && state.wat / state.vol < S.sysd.reach(sid, k))); map.fillStyle = gas ? '#c9c08d' : '#48aee3'; map.fillRect(k % W.w * sx, Math.floor(k / W.w) * sy, Math.max(1, sx * 0.6), Math.max(1, sy * 0.6)); }
    for (const p of W.parts.values()) { map.fillStyle = '#b9d8e3'; map.fillRect(p.x * sx, p.y * sy, Math.max(2, sx), Math.max(2, sy)); }
    for (const k of S.fires) { map.fillStyle = '#ff714f'; map.beginPath(); map.arc((k % W.w + 0.5) * sx, (Math.floor(k / W.w) + 0.5) * sy, 3, 0, Math.PI * 2); map.fill(); }
    map.strokeStyle = '#91e8de'; map.fillStyle = 'rgba(114,226,215,.06)'; map.lineWidth = 1;
    const vw = innerWidth / g.cam.z, vh = innerHeight / g.cam.z, x = (g.cam.x - vw / 2) * sx, y = (g.cam.y - vh / 2) * sy;
    map.fillRect(x, y, vw * sx, vh * sy); map.strokeRect(x + 0.5, y + 0.5, vw * sx - 1, vh * sy - 1);
    $('navZoom').textContent = Math.round(g.cam.z / 22 * 100) + '%';
  };
  nav.tick = function () {
    if (!root) return; const g = DI.game; if (g.mode !== 'play') return nav.visible(false); nav.visible(true);
    $('viewState').textContent = g.speed === 0 ? 'SIM PAUSED' : 'LIVE SYSTEMS';
    const done = g.goalOk.filter(Boolean).length, total = g.goalOk.length, drill = g.S.drill && !g.S.drill.done;
    $('missionPhase').textContent = drill ? '03 / SURVIVE THE DRILL' : g.drillPassed ? 'CONTRACT PROVEN' : total && done === total ? '02 / READY TO PROVE' : g.sc.sandbox ? 'FREE BUILD / EXPERIMENT' : g.sc.puzzle ? 'FIELD CALL / INVESTIGATE' : '01 / BUILD & COMMISSION';
    $('missionCount').textContent = total ? done + ' / ' + total : '∞'; $('missionFill').style.width = (total ? done / total * 100 : 100) + '%';
    const p = g.sel && g.sel.kind === 'part' ? g.W.parts.get(g.sel.id) : null;
    const topic = { c1: 'wet', c2: 'dry', c3: 'pump', c4: 'pump', c5: 'pre', c6: 'gas', c7: 'pre' }[g.sc.id] || 'play';
    let note = p && notes[p.type] || ['Learn by doing', g.sc.learn && g.sc.learn[0] || 'Trace the supply, inspect the equipment, then test your theory. Every change is a chance to understand the system.', topic];
    if (!p && (g.tool.type === 'pipe' || g.tool.type === 'branch')) note = ['Give water a clear path', 'Larger pipe loses less pressure. Feed branch lines from a main, then calculate the most remote area to test your design.', 'hyd'];
    const key = note.join('|'); if (key !== lastNote) { lastNote = key; lastLayout = ''; $('coachTitle').textContent = note[0]; $('coachText').textContent = note[1]; $('coachNumber').textContent = p ? '↳ SELECTED' : '↳ MISSION'; $('coachMore').onclick = () => DI.ui.showManual(note[2]); }
    const toolsTop = $('tools').getBoundingClientRect().top, annBottom = $('ann').getBoundingClientRect().bottom, available = toolsTop - annBottom - 24;
    const layout = [toolsTop, Math.round(available), innerWidth].join(':');
    if (layout !== lastLayout) {
      lastLayout = layout; const panel = $('campusNav'); panel.style.bottom = (innerHeight - toolsTop + 10) + 'px'; panel.style.display = innerWidth < 1050 ? 'none' : '';
      $('fieldCoach').hidden = false;
      if (panel.offsetHeight > available) $('fieldCoach').hidden = true;
      if (panel.offsetHeight > available) panel.style.display = 'none';
      view.classList.toggle('compact', innerWidth < 1250); view.style.bottom = innerWidth <= 1050 ? (innerHeight - toolsTop + 10) + 'px' : '';
    }
    nav.drawMap();
  };
})();
