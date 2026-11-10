// Campaign contracts 1-2: the wet system and the dry system.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const G = DI.G, X = DI.X;

  DI.SCEN.push({
    id: 'c1', name: 'Wet Behind the Ears', tag: 'Wet pipe system', w: 44, h: 26, money: 150000, par: 118000,
    parts: ['bfp', 'gate', 'check', 'fdc', 'wetv', 'panel'],
    brief: ['The admin wing of a new data center campus needs sprinklers before anyone can move in. Nothing exotic: offices, heated, light hazard. This is the system every other system is a variation of.',
      'You have a tap on the city main and an empty riser room. Bring water in, protect the public supply, give the system a valve you can close and an alarm that tells somebody when water moves.'],
    learn: ['Backflow preventer, control valve, alarm riser: the anatomy of a wet system', 'Q = K√P and why the far end of a branch line is always hungry', 'Density / area: 0.10 gpm/ft² over the most remote 1,500 ft², plus 100 gpm for hose', 'Inspector’s test and main drain test'],
    build(W) {
      const b = DI.mk(W); W.addRoom('riser', 8, 10, 3, 4); W.addRoom('office', 11, 6, 18, 12);
      b.p('city', 2, 12, 0, { stat: 62, resid: 45, flow: 1000, fixed: true });
    },
    goals: [
      { t: 'Sprinkler every tile of the office and the riser room', ok: (S) => G.covered(S), hint: 'Sprinkler tool (2). Drag rectangles of branch lines, then feed them from a main.' },
      { t: 'Pass plan review with no code failures', ok: (S) => G.noFails(S), hint: 'Open Review. The city connection needs a backflow preventer before anything else.' },
      { t: 'Hydraulic calc passes: 0.10 gpm/ft² over 1,500 ft² + 100 gpm hose', ok: (S) => G.calcOk(S, 'office'), hint: 'Select the riser and run the calc. Starved? Upsize the main, shorten branch lines, feed from the middle.' },
      { t: 'Riser flow switch and every control valve wired to a panel', ok: (S) => S.W.byType('wetv').length > 0 && S.W.byType('gate').length > 0 && G.wired(S, ['wetv', 'gate']), hint: 'Wire tool (5): click the panel, then each device.' },
      { t: 'Inspector’s test: waterflow alarm within 90 s', ok: (S) => G.test(S, 'itc', 'office'), hint: 'Select the riser and run the inspector’s test.' },
      { t: 'Record a main drain test', ok: (S) => G.test(S, 'drain', 'office'), hint: 'Select the riser. Static, then residual with the 2" drain wide open.' },
    ],
    drill: { name: 'After Hours', len: 1200, steps: () => [[8, X.fire('office', 0.72, 0.4), 'Space heater left on under a desk. Nobody is in the building.']],
      judge: DI.lossJudge(25000, (S) => [[!!S.fd.log && S.fd.log.auto && S.fd.log.t >= S.drill.t0, 'Alarm reached the fire department automatically']]) },
  });

  DI.SCEN.push({
    id: 'c2', name: 'Cold Dock', tag: 'Dry pipe system', w: 56, h: 30, money: 150000, par: 112000,
    parts: ['gate', 'check', 'fdc', 'wetv', 'dryv', 'comp', 'panel'],
    brief: ['The staging area is sprinklered and warm. The loading dock next to it is neither. Dock doors stand open all winter, and water in pipe at 20 °F becomes a pipe bomb with a delay fuse.',
      'A dry pipe system keeps the dock piping full of compressed air. A differential clapper holds the water back with roughly one-sixth the pressure. When a sprinkler opens the air has to get out of the way first, and the fire keeps growing while it does. Everything about dry pipe design is managing that delay.'],
    learn: ['Differential dry valve: trips near water pressure ÷ 5.5, so air is set ~20 psi above that', 'Delay costs area: design area +30%, no gridding, 60 s water delivery above 500 gal (750 with an accelerator)', 'Compressor must refill the system in 30 minutes', 'Impairment: what to do, in order, after a trip'],
    build(W) {
      const b = DI.mk(W); const rr = W.addRoom('riser', 8, 8, 4, 6); rr.exempt = true; W.addRoom('stor', 12, 6, 12, 10); W.addRoom('dock', 24, 6, 22, 10);
      b.p('city', 2, 11, 0, { stat: 78, resid: 60, flow: 1400, fixed: true }); b.h(3, 4, 11, 7);
      b.p('bfp', 5, 11); b.h(6, 6, 11, 7); const g = b.p('gate', 7, 11); b.h(8, 9, 11, 7);
      const r = b.p('wetv', 10, 11); b.h(11, 11, 11, 6); b.h(12, 23, 11, 6, true);
      b.grid(12, 6, 23, 10, 2, 2); b.grid(12, 12, 23, 15, 2, 2);
      const pn = b.p('panel', 9, 9); b.wire(pn, g, r);
    },
    goals: [
      { t: 'Sprinkler every tile of the loading dock', ok: (S) => G.covered(S, ['dock']), hint: 'Tee off the supply between the control valve and the wet riser. Run the feed main around the building.' },
      { t: 'The dock is on a dry pipe valve, and review finds no code failures', ok: (S) => G.each(S, 'dock', (v) => v.type === 'dryv') && G.noFails(S), hint: 'Wet pipe may not pass through an unheated room. Dry systems may not be gridded: every branch line needs a dead end.' },
      { t: 'Compressor brings the system up to pressure in 30 minutes or less', ok: (S) => G.each(S, 'dock', (v, i, s) => s.set && s.fillTime > 0 && s.fillTime <= 1800), hint: 'Tube a compressor to the dry valve (Air tool, 4). Too slow? Bigger compressor or smaller system.' },
      { t: 'Hydraulic calc passes: 0.20 gpm/ft² over 1,950 ft² (1,500 + 30%) + 250 gpm hose', ok: (S) => G.calcOk(S, 'dock'), hint: 'All pipe is calculated at C = 100, and the dry design area is 30% bigger. Expect larger pipe than the wet side.' },
      { t: 'Full-flow trip test passes', ok: (S) => G.test(S, 'trip', 'dock'), hint: 'Select the dry valve. Over 500 gal the water must reach the inspector’s test in 60 s. An accelerator raises the limit to 750 gal.' },
      { t: 'Low air and waterflow report to the panel; system reset and back in service', ok: (S) => G.each(S, 'dock', (v, i, s, id) => !!S.W.panelOf(id) && s.state === 'dry' && s.set), hint: 'After the trip test: close the control valve, open the system drain, reset the clapper, let the air build, reopen the valve.' },
    ],
    drill: { name: 'Cold Snap', len: 7800, steps: () => [
      [10, X.temp(-5), 'Arctic front. Outdoor temperature is heading for −5 °F and the dock doors are open.'],
      [4500, X.temp(38)], [4520, X.smash('dock', 0.3, 0.5), 'A forklift mast just sheared a sprinkler off in the dock.'],
      [5900, X.fire('dock', 0.72, 0.45, 0, 2), 'Shrink-wrapped pallets are burning at dock door 7.']],
      judge: DI.lossJudge(60000, (S) => [[!S.W.rooms.some((r) => r.burst), 'No pipe froze'], [!S.fires.length, 'Dock fire controlled (was the system back in service?)']]) },
  });
})();
