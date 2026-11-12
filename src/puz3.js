// Design calls 9-12: The Last $8,000, One Wall, Two Systems, Split Decision, The Forbidden Grid.
// A design call gives one hard constraint (a budget, a part limit, a rule of the system type) and one decision, and
// both are in the briefing before anything is built (variant.constraints, variant.decision). The later calls combine
// ideas from the earlier ones: gridding a wet system (call 3), the dry system's rules (contract 2), delivery and zoning
// (contract 5), caps (call 3). See puz.js for the shape of a call; coordinates are tiles of the variant's own map.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const G = DI.G, PZ = DI.PZ, E = DI.PZE;
  const col = (x, y0, y1) => { const o = []; for (let y = y0; y <= y1; y++) o.push([x, y]); return o; };
  const row = (y, x0, x1) => { const o = []; for (let x = x0; x <= x1; x++) o.push([x, y]); return o; };
  // resize a list of tiles to pipe size index `size` (a resize keeps the head and the line direction: the Main tool
  // over an existing tile does the same, except that it lays the tile as a main)
  const resize = (W, pts, size) => { for (const [x, y] of pts) { const k = W.k(x, y); if (W.pd[k]) { W.pd[k] = size + 1; W.pk[k] = 0; } } W.ver++; };
  // lay the branch tiles of a column as a main at size index `size` (or the size they have): a grid tie. A main already
  // in the column (the feed main crossing it) is left as it is.
  const tie = (W, x, y0, y1, size) => { for (let y = y0; y <= y1; y++) { const k = W.k(x, y); if (W.pd[k] && W.pk[k]) { W.pk[k] = 0; if (size !== undefined) W.pd[k] = size + 1; } } W.ver++; };
  // the worst calc of the first system of a room type, as a records line
  const calcLine = (S, type, who) => { const id = G.sysOf(S, type)[0], c = id && PZ.calcAll(S, id);
    return c && c.ok ? (who || 'Hydraulic calc') + ': ' + (c.pass ? 'PASS' : 'FAIL') + ', the weakest head in the most demanding area gets ' + DI.fmt(c.minQ, 1) + ' gpm of the ' + DI.fmt(c.need, 1) + ' gpm it needs (' + DI.fmt(c.margin * 100) + ' percent).' : (who || 'Hydraulic calc') + ': no result.'; };
  DI.PZ3 = { col, row, resize, tie, calcLine };

  // =====================================================================================================
  // Call 9. A storage floor (or an unheated dock) that misses its calc by a few percent, with $8,000 left.
  //   city (0,12) -> backflow (1,12) -> control valve (2,12) -> system valve (3,12) in the riser room
  //   centre-fed (A, B): feed main (4..27,12) -> cross main (28,3..18) -> branch lines west (16..27) and east (29..40)
  //   end-fed (C): feed main (4..15,12), down (15,13..19), along (16..27,19) -> cross main (28,19 up to 3)
  const AREA9 = [0, 2, 42, 20];
  const floor9 = (W, b, o) => {
    W.addRoom('riser', 1, 9, 5, 6).exempt = true; W.addRoom(o.room, 16, 3, 25, 16);
    b.p('city', 0, 12, 0, { stat: 75, resid: o.resid || 60, flow: 1500, fixed: true }); b.p('bfp', 1, 12); const g = b.p('gate', 2, 12, 0);
    const r = o.dry ? b.p('dryv', 3, 12, 0, { qod: true }) : b.p('wetv', 3, 12);
    if (o.endFed) { b.h(4, 15, 12, o.feed); b.v(15, 13, 19, o.feed); b.h(16, 27, 19, o.feed); b.v(28, 3, 19, o.cross); for (let y = 3; y <= 18; y++) W.spk[W.k(28, y)] = 1; }
    else { b.h(4, 27, 12, o.feed); b.v(28, 3, 18, o.cross, true); }
    b.grid(16, 3, 27, 18, o.br, 1); b.grid(29, 3, 40, 18, o.br, 1);
    const pn = b.p('panel', 4, 10); b.wire(pn, g, r);
    if (o.dry) { b.p('comp', 3, 10, 0, { scfm: 20 }); b.air([[3, 11]]); }
  };
  const calc9 = (type) => ({ t: 'Hydraulic calc passes at the most demanding area (the design area moved to every branch line end)', ok: (S) => PZ.calcAllOk(S, type), hint: 'Select the riser and run the calc. The goal checks the design area at the end of every branch line, not only the farthest one.' });
  const review9 = { t: 'Plan review finds no code failures', ok: G.noFails, hint: 'Open Review.' };
  const C9 = ['Budget: what is left, $8,000. No new pump, tank or water supply: pipe and valves only.', 'The calc must pass wherever the design area falls: the goal moves it to the end of every branch line.'];
  DI.PUZ.push({
    id: 'p9', n: 9, name: 'The Last $8,000', kind: 'Nearly finished plant', design: true, w: 44, h: 24, parts: ['gate', 'check'],
    builds: ['Call 1: friction, and where a restriction shows on the hover readings', 'Call 3: a wet system may be gridded; dry pipe may not', 'Cold Dock: the dry design area is 30 percent larger'],
    question: 'Where does a small budget buy the most pressure?',
    learn: ['Friction grows with the flow to the power 1.85: a tile that carries the whole demand loses far more than a tile that carries one line', 'Upsize only as far as the calc needs: past that point the money buys margin, not a pass', 'On a wet system, tying the far ends of the branch lines into a grid feeds every line from both ends, almost for free', 'Dry and preaction pipe may not be gridded, so there the cross main has to carry it', 'Check the most demanding area, not only the farthest one: strengthening the remote lines moves the area, it does not remove it'],
    variants: [
      { key: 'A', name: 'Floor A: the long feed', money: 8000, area: AREA9, impPar: null, constraints: C9,
        decision: 'The calc is about 10 percent short. Pressure is lost in three places: the 240 ft feed main, the cross main and the branch lines. Every tile you upsize costs money, and $8,000 will not buy all three. Spend it where the most water flows.',
        symptom: ['Nearly finished plant. A storage building on a city main: the sprinklers are hung, the riser is set, and the contractor has $8,000 left in the contract. The hydraulic calc fails by about 10 percent.', 'Find an upgrade that passes within the budget. The cheapest one earns the star.'],
        records: (S) => [calcLine(S, 'stor', 'Contractor’s calc'), 'Hydrant flow test at the street: 75 psi static, 60 psi residual at 1,500 gpm.'],
        build: (W, b) => floor9(W, b, { room: 'stor', feed: 5, cross: 6, br: 3 }),
        hints: [['Start at the riser: run the calc and read the pressure at the riser against the hydrant test. Then follow the water: feed main, cross main, branch lines.', 3, 12],
          ['While the calc is shown, hover the feed main, the cross main and a branch line. The feed main carries the whole demand at the highest velocity: it loses the most pressure per tile, and every tile of it loses about the same.', 10, 12],
          ['The 3 in. feed main is the bottleneck. Upsize half of it (12 tiles) to 4 in. with the Main tool: about $1,300 and the calc passes. The whole feed main works too, at twice the price.', 10, 12]],
        diag: { q: 'Where does $8,000 buy the most pressure?', opts: [
          ['The feed main: it carries the whole demand', true, 'Yes. Every tile of it carries all 600 gpm, so each one upsized buys more pressure than any other tile on the floor.'],
          ['The branch lines in the design area', false, 'The two farthest lines then pass, and the area moves to the next lines, which still fail. All the lines would cost over $20,000.'],
          ['The cross main', false, 'It carries less than half the demand to the far end. The whole cross main one size up buys under one percent.'],
          ['A fire pump', false, 'Not in the budget, and not needed: the street has the pressure. The pipe loses it.']] },
        goals: [calc9('stor'), review9], prove: () => {},
        cheap: { t: 'Half the feed main one size up', steps: ['Main tool at 4 in. over 12 tiles of the 3 in. feed main', 'Run the calc'], edit: (W) => resize(W, row(12, 4, 15), 6),
          lesson: 'About $1,300. The calc passes with a percent or two to spare: just enough.' },
        maint: { t: 'The whole feed main one size up', steps: ['Main tool at 4 in. over the whole feed main', 'Run the calc'], edit: (W) => resize(W, row(12, 4, 27), 6),
          lesson: 'Twice the price for a margin of about 17 percent. The next tenant who adds a rack or a few heads does not reopen the calc.' } },
      { key: 'B', name: 'Floor B: the long lines', money: 8000, area: AREA9, impPar: null, constraints: C9,
        decision: 'The calc is about 20 percent short and the branch lines are 120 ft long on 1½ in. pipe. Upsizing them all would cost about $15,000. Is there a way to shorten the path the water takes without buying pipe?',
        symptom: ['Nearly finished plant. The same storage building with a bigger feed main and long branch lines. The calc fails by about 20 percent, and the contractor has $8,000 left.', 'Find an upgrade that passes within the budget. The cheapest one earns the star.'],
        records: (S) => [calcLine(S, 'stor', 'Contractor’s calc'), 'Contractor’s note: "upsize the branch lines" (quoted at $14,880).'],
        build: (W, b) => floor9(W, b, { room: 'stor', feed: 7, cross: 6, br: 2 }),
        hints: [['The feed main is 6 in. now. Run the calc and hover a far branch line: almost all the pressure is lost along the 1½ in. lines.', 38, 4],
          ['Upsizing the two farthest lines passes the farthest area, and the area moves to the next lines. A line fed from both ends carries half the flow over each half: about a quarter of the loss.', 40, 10],
          ['This is a wet system: tie the far ends of the lines into a grid. Lay the far column of each side (x 16 and x 40) as a main, at the 1½ in. size it already is: no cost. Both sides, or the area moves to the side you left.', 40, 10]],
        diag: { q: 'Where does $8,000 buy the most pressure?', opts: [
          ['Tie the far ends of the branch lines into a grid', true, 'Yes. Each line is fed from both ends, so each half carries half the flow. On a wet system that is allowed and costs nothing but the far column.'],
          ['Upsize the branch lines in the design area', false, 'The area moves to the next lines along, which still fail. Every line would cost about $15,000.'],
          ['Upsize the feed main', false, 'It is 6 in. already: almost no pressure is lost there.'],
          ['Upsize the cross main', false, 'One size up buys about two percent. The loss is in the lines.']] },
        goals: [calc9('stor'), review9], prove: () => {},
        cheap: { t: 'Grid both sides, same size', steps: ['Main tool at 1½ in. over the far column of each side (x 16 and x 40)', 'Run the calc'], edit: (W) => { tie(W, 16, 3, 18); tie(W, 40, 3, 18); },
          lesson: 'No cost. The same pipe, joined at both ends: about 30 percent over the need.' },
        maint: { t: 'Grid both sides with 2 in. ties', steps: ['Main tool at 2 in. over the far column of each side', 'Run the calc'], edit: (W) => { tie(W, 16, 3, 18, 3); tie(W, 40, 3, 18, 3); },
          lesson: 'About $1,200. A tie one size up is a real main on the drawings, and it keeps the grid balanced when heads are added at the far end later.' } },
      { key: 'C', name: 'Dock C: dry pipe', money: 8000, area: AREA9, impPar: null, constraints: C9.concat(['The dock is unheated: dry pipe, and dry pipe may not be gridded.']),
        decision: 'An unheated dock on dry pipe, the calc about 18 percent short, with the cross main fed from its south end. The free fix of a wet floor (a grid) fails review on dry pipe. Where else does $8,000 buy the pressure?',
        symptom: ['Nearly finished plant. A loading dock, unheated, on a dry pipe valve in the riser room. The cross main is fed from its south end and the calc fails by about 18 percent. $8,000 is left.', 'Find an upgrade that passes within the budget and still passes plan review.'],
        records: (S) => [calcLine(S, 'dock', 'Contractor’s calc'), 'Dry design area: 1,950 ft² (1,500 + 30 percent).'],
        build: (W, b) => floor9(W, b, { room: 'dock', dry: true, endFed: true, feed: 7, cross: 5, br: 3 }),
        hints: [['The cross main is fed from its south end, so the water for the far (north) area travels its whole length. Run the calc and hover the cross main.', 28, 12],
          ['A grid would pass the calc and fail plan review: dry pipe must not be gridded. The cross main is 3 in. and carries the whole design area to the far end.', 28, 6],
          ['Upsize the whole cross main, from the feed at the south end to the north end, one size (3 in. to 4 in.). Half of it is not enough: the far area draws through all of it.', 28, 10]],
        diag: { q: 'Where does $8,000 buy the most pressure on dry pipe?', opts: [
          ['The cross main, end to end: it carries the whole design area', true, 'Yes. End-fed, every tile of the cross main carries the far area’s water. One size up passes with margin.'],
          ['Tie the far ends of the lines into a grid', false, 'It would pass the calc, and fail plan review: dry pipe must not be gridded.'],
          ['The north half of the cross main only', false, 'The far area draws through the south half too. Half the cross main buys about nine percent.'],
          ['The feed main', false, 'It is 6 in.: almost nothing is lost there, and more pipe adds volume to the dry zone.']] },
        goals: [calc9('dock'), review9], prove: () => {},
        cheap: { t: 'The cross main one size up', steps: ['Main tool at 4 in. over the whole cross main, rows 3 to 19', 'Run the calc'], edit: (W) => resize(W, col(28, 3, 19), 6),
          lesson: 'About $1,900. The legal fix on dry pipe is bigger pipe where the flow concentrates.' },
        maint: { t: 'The cross main two sizes up', steps: ['Main tool at 6 in. over the whole cross main', 'Run the calc'], edit: (W) => resize(W, col(28, 3, 19), 7),
          lesson: 'About $6,000 for a margin near 20 percent: room for the racks the dock will get. The zone volume grows by about 200 gal; it still needs its timed trip test.' } },
    ],
  });

  // =====================================================================================================
  // Call 10. A heated storage room and an unheated dock on one city tap. The branch lines are hung in both rooms and the
  // storage room's cross main is laid; the player builds both risers, the mains, the air and the wiring.
  //   A: riser room west (1..6, 8..15), storage (8..20, 4..17), dock (21..33, 4..17); tap (0,12), backflow, control
  //      valve, stub (3,12). The storage cross main is column 14, down to row 17.
  //   B: storage (3..15, 3..16), dock (16..28, 3..16), riser room south of the shared wall (12..19, 18..22); tap from the
  //      south (15,25), backflow (15,24), control valve (15,23), stub (15,22). The storage cross main runs down the
  //      shared wall, column 15, to row 17.
  const wall10A = (W, b) => {
    W.addRoom('riser', 1, 8, 6, 8).exempt = true; W.addRoom('stor', 8, 4, 13, 14); W.addRoom('dock', 21, 4, 13, 14);
    b.p('city', 0, 12, 0, { stat: 80, resid: 65, flow: 1500, fixed: true }); b.p('bfp', 1, 12); const g = b.p('gate', 2, 12, 0); W.setPipe(3, 12, 7, 0);
    b.grid(8, 4, 20, 17, 3, 1); b.grid(21, 4, 33, 17, 3, 1); b.v(14, 4, 17, 6, true);
    const pn = b.p('panel', 5, 9); b.wire(pn, g);
  };
  const wall10B = (W, b) => {
    W.addRoom('stor', 3, 3, 13, 14); W.addRoom('dock', 16, 3, 13, 14); W.addRoom('riser', 12, 18, 8, 5).exempt = true;
    b.p('city', 15, 25, 3, { stat: 80, resid: 65, flow: 1500, fixed: true }); b.p('bfp', 15, 24, 3); const g = b.p('gate', 15, 23, 3); W.setPipe(15, 22, 7, 0);
    b.grid(3, 3, 15, 16, 3, 1); b.grid(16, 3, 28, 16, 3, 1); b.v(15, 3, 17, 6); for (let y = 3; y <= 16; y++) W.spk[W.k(15, y)] = 1;
    const pn = b.p('panel', 13, 19); b.wire(pn, g);
  };
  const heads = (W, x, y0, y1) => { for (let y = y0; y <= y1; y++) W.spk[W.k(x, y)] = 1; W.ver++; };
  // A: wet riser east of the tee, its feed along row 12 into the storage cross main; dry valve south of the tee, its main
  // through the yard along row 18 and up the dock's middle column; a cap where it passes the foot of the storage cross main
  const solA10 = (W, b, valves) => {
    const pn = W.byType('panel')[0], o = valves ? 1 : 0;
    if (valves) b.p('gate', 4, 12, 0); const r = b.p('wetv', 4 + o, 12); b.h(5 + o, 7, 12, 5); for (let x = 8; x <= 13; x++) { const k = W.k(x, 12); W.pk[k] = 0; W.pd[k] = 6; }
    if (valves) b.p('gate', 3, 13, 1); else W.setPipe(3, 13, 7, 0); const d = b.p('dryv', 3, 14, 1); b.v(3, 15, 18, 6); b.h(4, 26, 18, 6); b.v(27, 4, 18, 6); heads(W, 27, 4, 17);
    b.p('comp', 5, 14, 0, { scfm: 10 }); b.air([[4, 14]]); b.wire(pn, r, d); if (valves) { b.wire(pn, W.at(4, 12), W.at(3, 13)); } W.setCut(14, 17, true, 1);
  };
  // B: wet riser north from the tee into the foot of the storage cross main; dry riser and the dock cross main one column
  // clear of it (column 17), so no main of the dock touches a main of the storage room
  const solB10 = (W, b, valves) => {
    const pn = W.byType('panel')[0];
    if (valves) { b.p('gate', 15, 21, 3); b.p('gate', 17, 21, 3); } else { W.setPipe(15, 21, 7, 0); W.setPipe(17, 21, 7, 0); }
    const r = b.p('wetv', 15, 20, 3); b.v(15, 18, 19, 6); W.setPipe(16, 22, 7, 0); W.setPipe(17, 22, 7, 0);
    const d = b.p('dryv', 17, 20, 3); b.v(17, 3, 19, 6); heads(W, 17, 3, 16);
    b.p('comp', 19, 20, 0, { scfm: 10 }); b.air([[18, 20]]); b.wire(pn, r, d); if (valves) b.wire(pn, W.at(15, 21), W.at(17, 21));
  };
  const goals10 = [
    { t: 'Both rooms sprinklered, every head on a riser', ok: (S) => G.covered(S, ['stor', 'dock']) && !!S.rv && !S.rv.some((f) => /not connected to any system riser/.test(f.text)), hint: 'Every head needs a path to a riser: hover a line, it reads no pressure if it is not on one.' },
    { t: 'Two separate systems: storage on a wet riser, the dock on a dry valve, nothing joined', ok: (S) => G.each(S, 'stor', (v, inf) => v.type === 'wetv' && ![...inf.rooms].some((r) => S.W.rooms[r - 1].type === 'dock')) && G.each(S, 'dock', (v, inf) => v.type === 'dryv' && ![...inf.rooms].some((r) => S.W.rooms[r - 1].type === 'stor')), hint: 'If one valve feeds both rooms, a main of one system touches a main of the other somewhere.' },
    { t: 'Plan review finds no code failures', ok: G.noFails, hint: 'Open Review: a cross-connection or wet pipe in the dock means the two systems have joined.' },
    { t: 'Both calcs pass at the most demanding area', ok: (S) => PZ.calcAllOk(S, 'stor') && PZ.calcAllOk(S, 'dock'), hint: 'Select each riser and run the calc.' },
    { t: 'The dock’s dry system is set and up to pressure', ok: (S) => G.each(S, 'dock', (v, i, s) => v.type === 'dryv' && s.state === 'dry' && s.set), hint: 'Tube a compressor to the dry valve and let it pump up (speed up the clock).' },
  ];
  DI.PUZ.push({
    id: 'p10', n: 10, name: 'One Wall, Two Systems', kind: 'Empty site', design: true, w: 36, h: 27, parts: ['gate', 'check', 'wetv', 'dryv', 'comp', 'panel'],
    builds: ['Cold Dock: wet pipe stays out of unheated rooms; the dry valve sits in heated space', 'Call 3: a cap is a joint, not a tile'],
    question: 'How do two systems share one supply without joining?',
    learn: ['Branch lines stop at a wall; mains pass straight through it and join every main or branch line beside them', 'Two systems side by side need a capped joint or a clear tile between their mains, in the rooms and in the riser room', 'A dry valve lives in heated space; its pipe can run anywhere, the yard included, because it holds air', 'Wet pipe, the supply main included, stays in heated space or underground', 'Split the supply after the control valve, then give each system its own riser'],
    variants: [
      { key: 'A', name: 'Site A: past the warm room', money: 55000, area: [0, 3, 35, 19], impPar: null, editSlack: 0.25, w: 36, h: 22,
        constraints: ['One city tap, already through its backflow preventer and control valve in the riser room.', 'The riser room is the only heated place for the dry valve.', 'The branch lines are hung in both rooms and the storage cross main is laid: keep them.'],
        decision: 'The dock is beyond the heated storage room. Its dry main has to get past that room without touching it: inside the room a main joins every branch line it meets, and pipes cannot cross. Which way does the dry main go?',
        symptom: ['Empty site. A heated storage room and an unheated loading dock share a wall and one city tap. The sprinkler fitter has hung the branch lines in both rooms and laid the storage room’s cross main. Nothing else is built.', 'Give the storage room a wet system and the dock a dry system, from the one tap, and keep them separate.'],
        records: ['Hydrant flow test: 80 psi static, 65 psi residual at 1,500 gpm.', 'Both rooms: storage / staging and dock, Ordinary Hazard Group 2.'],
        build: wall10A, prove: (S) => S.warp(2400),
        hints: [['Tee off the stub after the control valve: a wet riser for the storage room, and a dry valve for the dock. Both go in the riser room.', 3, 12],
          ['The dry main cannot go through the storage room: it would join the branch lines and cross the storage cross main. Go around through the yard below the rooms. Then hover it: where does it pass the foot of the storage cross main?', 14, 18],
          ['Dry valve south of the tee, its main down to row 18, east along row 18 and up the dock’s middle column as the cross main. Cap the joint between the storage cross main and row 18 (Cap tool at 14,17 south side). Tube a 10 scfm compressor to the dry valve, wire both risers.', 14, 17]],
        diag: { q: 'How does the dry main reach the dock?', opts: [
          ['Around the heated room through the yard, capped where it passes a wet main', true, 'Yes. Outside the room it touches no branch line, and the one joint it shares with the storage cross main is capped.'],
          ['Straight through the storage room, along a row of branch line', false, 'Laid as a main it joins that row’s heads and the storage cross main where it crosses it: one system again.'],
          ['From the storage cross main through the wall', false, 'That is the wet system: wet pipe in an unheated dock, and no dry valve at all.'],
          ['From a second city tap on the dock side', false, 'There is one tap. Two systems share a supply after its control valve: that is what the riser room is for.']] },
        goals: goals10,
        cheap: { t: 'Around through the yard, one cap', steps: ['Wet riser east of the tee, 3 in. feed into the storage cross main', 'Dry valve south of the tee, 4 in. main along row 18 and up the dock’s middle column', 'Cap the joint at the foot of the storage cross main', '10 scfm compressor, tubing, wire both risers'], edit: (W, b) => solA10(W, b, false),
          lesson: 'The cap is free and is the whole trick: without it the yard main joins the storage cross main and the dock ends up on the wet system.' },
        maint: { t: 'The same, with a control valve on each system', steps: ['As the cheapest fix', 'A supervised control valve ahead of each riser, both wired to the panel'], edit: (W, b) => solA10(W, b, true),
          lesson: 'One system can be shut for work while the other stays in service, and the panel sees both valves. The shared control valve still isolates the whole building.' } },
      { key: 'B', name: 'Site B: on the wall', money: 40000, area: [2, 2, 30, 24], impPar: null, editSlack: 0.25,
        constraints: ['One city tap from the south, through its backflow preventer and control valve.', 'The riser room sits under the shared wall; the dry valve goes there.', 'The storage cross main runs down the shared wall into the riser room: keep it.'],
        decision: 'The storage cross main already runs down the shared wall. A main beside it, on either side of the wall, joins it: the dock would end up on the wet system. Where do the dry riser and the dock’s cross main go?',
        symptom: ['Empty site. The same two rooms, built the other way round: the storage room’s cross main was laid down the shared wall, into a riser room under it. The dock has its branch lines and nothing else.', 'Give the dock a dry system from the same tap and keep it separate from the storage room.'],
        records: ['Hydrant flow test: 80 psi static, 65 psi residual at 1,500 gpm.', 'Fitter’s note: "dock main against the wall, like the storage one".'],
        build: wall10B, prove: (S) => S.warp(2400),
        hints: [['The storage cross main comes down the shared wall to row 17. Anything you lay beside it is on the wet system.', 15, 17],
          ['Walls stop branch lines, not mains. Two risers side by side in the riser room join as well. Leave a clear column between the wet pipe and the dry pipe all the way up.', 16, 12],
          ['Wet riser north from the tee into the foot of the storage cross main. Tee east twice, dry valve in column 17 facing north, and the dock’s cross main up column 17 with its heads. Compressor beside it, tubed; wire both risers.', 17, 20]],
        diag: { q: 'Where do the dry riser and the dock’s cross main go?', opts: [
          ['One column clear of the storage main, all the way from the riser room', true, 'Yes. Column 17 touches no wet main: the dock’s first tile of branch line meets it end to end, and the wall keeps that branch line from the storage main.'],
          ['Against the wall in column 16, like the storage main', false, 'Two mains side by side join through the wall: one wet system with pipe in the dock.'],
          ['Anywhere in the dock: the wall keeps the systems apart', false, 'Only branch lines stop at a wall. Mains pass straight through it.'],
          ['Beside the wet riser in the riser room, then into the dock', false, 'Two risers side by side join each other before they ever reach the rooms.']] },
        goals: goals10,
        cheap: { t: 'Dry riser and cross main in column 17', steps: ['Wet riser north into the foot of the storage cross main', 'Tee east to column 17: dry valve facing north, the dock cross main up column 17', '10 scfm compressor, tubing, wire both risers'], edit: (W, b) => solB10(W, b, false),
          lesson: 'No caps needed: one clear column keeps the two systems apart from the riser room to the far wall.' },
        maint: { t: 'The same, with a control valve on each system', steps: ['As the cheapest fix', 'A supervised control valve ahead of each riser, both wired'], edit: (W, b) => solB10(W, b, true),
          lesson: 'Either room can be shut down for work with the other in service.' } },
    ],
  });

  // =====================================================================================================
  // Call 11. One preaction zone over a whole data hall: too much pipe volume for the 60 s delivery, and the owner wants
  // every zone at 500 gal or less. A riser room runs down the hall's west wall with a supply header (column 5); the
  // zone's valve is at (7,12) behind its control valve (6,12), its feed main along row 12 to the cross main.
  //   A: hall (12..41, 4..19), cross main column 26, 4 in. feed; at most three preaction valves.
  //   B: hall (12..37, 4..17), cross main column 24, 6 in. feed; at most two preaction valves.
  const hall11 = (W, b, o) => {
    W.addRoom('riser', 5, 4, 7, 16).exempt = true; W.addRoom('hall', 12, 4, o.wid, o.rows);
    const y1 = 4 + o.rows - 1, x1 = 12 + o.wid - 1, cx = o.cx;
    b.p('city', 0, 12, 0, { stat: 165, resid: 145, flow: 2500, fixed: true, loop: true, label: 'Campus Fire Loop' }); b.h(1, 5, 12, 8); b.v(5, 5, 18, 8);
    const d = b.p('vesda', x1, 4), g = b.p('gate', 6, 12, 0), v = b.p('prev', 7, 12, 0);
    b.h(8, cx - 1, 12, o.feed); b.v(cx, 4, y1, 7, true); b.grid(12, 4, cx - 1, y1, 2, 1); b.grid(cx + 1, 4, x1, y1, 2, 1);
    const pn = b.p('panel', 10, 9); b.wire(pn, g, v, d); b.p('comp', 7, 15, 0, { scfm: 10 }); b.air(col(8, 12, 15));
  };
  // a new zone: control valve and preaction valve at (6,y), (7,y), its row laid as a 4 in. main to the cross main
  const zone11 = (W, b, y, cx) => {
    const pn = W.byType('panel')[0], g = b.p('gate', 6, y, 0), v = b.p('prev', 7, y, 0);
    for (let x = 8; x < cx; x++) { const k = W.k(x, y); if (x < 12) W.setPipe(x, y, 6, 0); else { W.pk[k] = 0; W.pd[k] = 7; } }
    W.ver++; b.wire(pn, g, v);
  };
  const tube11 = (W, y0, y1) => { for (let y = y0; y <= y1; y++) if (!W.air[W.k(8, y)]) W.setAir(8, y, 1); };
  const solA11 = (W, b, big) => { W.setCut(26, 9, true, 1); W.setCut(26, 14, true, 1); zone11(W, b, 6, 26); zone11(W, b, 17, 26); tube11(W, 6, 17); if (big) { W.byType('comp')[0].p.scfm = 20; W.ver++; } };
  const solB11 = (W, b, big) => { for (let x = 8; x < 24; x++) W.pd[W.k(x, 12)] = 7; W.ver++; W.setCut(24, 10, true, 1); zone11(W, b, 8, 24); tube11(W, 8, 11); if (big) { W.byType('comp')[0].p.scfm = 20; W.ver++; } };
  const zones11 = (S) => S.W.byType('prev').every((v) => { const inf = S.sysd.info.get(v.id); return !!inf && DI.zoneVolume(S.W, inf) <= DI.DELIVERY.di; });
  const goals11 = [
    { t: 'Every preaction zone 500 gal or less (owner standard: no zone depends on the timed trip test)', ok: (S) => S.W.byType('prev').length > 0 && zones11(S), hint: 'Select each preaction valve: the Piping row shows its zone volume, pipe plus fittings plus trim.' },
    { t: 'The whole hall still on double-interlock preaction, with no code failures', ok: (S) => G.covered(S, ['hall']) && G.each(S, 'hall', (v) => v.type === 'prev') && G.noFails(S), hint: 'Open Review: each new valve needs its solenoid wired, air tubed, and detection on its panel.' },
    { t: 'Every zone’s calc passes at the most demanding area', ok: (S) => PZ.calcAllOk(S, 'hall'), hint: 'Select each preaction valve and run the calc.' },
    { t: 'Every zone set and pressurized, nothing latched', ok: (S) => S.W.byType('prev').every((v) => PZ.inService(S, v)), hint: 'Let the compressor fill the new zones (speed up the clock).' },
  ];
  DI.PUZ.push({
    id: 'p11', n: 11, name: 'Split Decision', kind: 'Nearly finished plant', design: true, w: 46, h: 22, parts: ['gate', 'prev', 'comp', 'panel'],
    builds: ['Double Interlock: zone volume counts pipe, fittings and trim; over 500 gal a double-interlock zone needs the 60 s timed test', 'Call 10: two systems stay apart only where their mains do not touch', 'The air supply code check: one compressor is sized on the largest zone it serves'],
    question: 'How do you divide one zone into zones that deliver in time, with the valves you have?',
    learn: ['Delivery time follows the air the water must push out: the zone volume, feed main included', 'A zone’s own feed main counts in its volume: a fat feed to a far zone can be most of it', 'Equal rows do not make equal zones: balance the gallons, not the area', 'A cap on the cross main and a feed of its own turn one band of rows into a zone', 'One compressor can serve several zones: it is sized on the largest one, so smaller zones also fix an undersized compressor'],
    variants: [
      { key: 'A', name: 'Hall A: three valves', money: 75000, area: [4, 3, 42, 20], impPar: null, editSlack: 0.25, limits: { prev: 3, comp: 1 }, w: 46, h: 22,
        constraints: ['At most three preaction valves on this hall, the one there now included.', 'One compressor, the one there now.', 'Owner standard: no preaction zone over 500 gal.'],
        decision: 'The zone is about 920 gal: two zones would each still be over 500 with their feeds. Three valves give three zones, but each one carries its own feed main. Where do the cuts go so that all three are under 500 gal and still pass the calc?',
        symptom: ['Nearly finished plant. Data Hall A is one double-interlock preaction zone. Its acceptance trip test put water at the inspector’s test in 104 s against 60 s, and the compressor fails the air supply check for a zone this size.', 'Divide it into zones of 500 gal or less with the valves allowed, and put every zone back in service.'],
        records: ['Acceptance trip test: valve tripped at 96 s, water at the inspector’s test at 104 s (limit 60 s over 500 gal). Zone volume 918 gal.', 'Plan review: air supply 10 scfm cannot restore normal pressure in this zone within 30 min.'],
        build: (W, b) => hall11(W, b, { wid: 30, rows: 16, cx: 26, feed: 6 }), prove: (S) => S.warp(2400),
        hints: [['Select the preaction valve: the Piping row shows the zone volume. Three valves in the riser room means three zones, each fed from the riser room.', 7, 12],
          ['Cap the cross main twice to cut the hall into three bands of rows, and feed each new band along one of its rows from a new valve. The feed main counts in its zone: check each valve’s zone volume as you build, and run each calc.', 26, 9],
          ['Cap the cross main below row 9 and below row 14. New control valve and preaction valve at (6,6) and (7,6), and at (6,17) and (7,17), each feeding its row as a 4 in. main to the cross main. Wire both, carry the air tubing down column 8, and let the zones fill.', 26, 14]],
        diag: { q: 'How do three valves make three zones under 500 gal?', opts: [
          ['Cap the cross main into three bands and feed each band from its own valve', true, 'Yes. About 370, 420 and 370 gal, each with its own feed, and each passes its calc.'],
          ['Two zones, and keep the third valve spare', false, 'No two-way cut gets both zones to 500 gal or less once each has its own feed main.'],
          ['A quick-opening device on the one valve', false, 'On double interlock a quick-opening device does not extend the 500 gal.'],
          ['A bigger compressor', false, 'The air comes back faster, and the water still has to push 900 gal of it out of the pipe.']] },
        goals: goals11,
        cheap: { t: 'Three bands, two new valves', steps: ['Cap the cross main below rows 9 and 14', 'Control valve + preaction valve at rows 6 and 17, each row laid as a 4 in. feed main', 'Wire both, tubing down column 8, let the zones fill'], edit: (W, b) => solA11(W, b, false),
          lesson: 'Three zones of about 400 gal: no zone needs the timed test, and the 10 scfm compressor passes for the largest one.' },
        maint: { t: 'The same split, with a 20 scfm compressor', steps: ['As the cheapest fix', 'Compressor to 20 scfm'], edit: (W, b) => solA11(W, b, true),
          lesson: 'The code check passes at 10 scfm. At 20 a tripped zone is back to normal in half the time: recovery after an incident is mostly compressor time.' } },
      { key: 'B', name: 'Hall B: one more valve', money: 35000, area: [4, 3, 38, 18], impPar: null, editSlack: 0.25, limits: { prev: 2, comp: 1 },
        constraints: ['At most two preaction valves: one more than now.', 'One compressor, the one there now.', 'Owner standard: no preaction zone over 500 gal.'],
        decision: 'A smaller hall, about 900 gal, and only one more valve. Split in two, each half is still over 500 gal. Over a quarter of the zone is the 6 in. feed main, which carries water to one zone only. What else can come out of the zone?',
        symptom: ['Nearly finished plant. Data Hall B is one double-interlock preaction zone of about 900 gal. Its trip test took 104 s against 60 s. The riser room has space for one more valve and no more.', 'Get every zone to 500 gal or less with one more valve, and put both back in service.'],
        records: ['Acceptance trip test: valve tripped at 94 s, water at the inspector’s test at 104 s (limit 60 s over 500 gal). Zone volume 896 gal, of which the 6 in. feed main holds about 260 gal.', 'Plan review: air supply 10 scfm cannot restore normal pressure in this zone within 30 min.'],
        build: (W, b) => hall11(W, b, { wid: 26, rows: 14, cx: 24, feed: 7 }), prove: (S) => S.warp(2400),
        hints: [['Select the preaction valve and read the zone volume. Hover the feed main: 6 in. pipe holds about 16 gal per tile.', 14, 12],
          ['Two zones of 500 gal or less leave no room for a second fat feed main, and the new zone needs a feed of its own. The feed main is sized for far more flow than one zone draws: run the calc with it smaller.', 18, 12],
          ['Resize the 6 in. feed main to 4 in. (it refunds), cap the cross main below row 10, and feed rows 4 to 10 from a new control valve and preaction valve at (6,8) and (7,8) along row 8 as a 4 in. main. Wire, tube, let it fill.', 24, 10]],
        diag: { q: 'How do two zones fit under 500 gal each?', opts: [
          ['Downsize the 6 in. feed main, then split the hall in two', true, 'Yes. At 4 in. the feed still passes the calc and holds about 150 gal less, and the two halves come out near 430 gal each.'],
          ['Split the hall in two, nothing else', false, 'Each half keeps or gets a feed main: one zone stays over 500 gal.'],
          ['Lower the supervisory air pressure', false, 'Pressure changes how fast the air comes back, not the volume the water must fill.'],
          ['A quick-opening device', false, 'On double interlock it does not extend the 500 gal.']] },
        goals: goals11,
        cheap: { t: 'A 4 in. feed and one more zone', steps: ['Resize the feed main to 4 in.', 'Cap the cross main below row 10', 'Control valve + preaction valve at row 8, its row laid as a 4 in. feed', 'Wire, tube, let it fill'], edit: (W, b) => solB11(W, b, false),
          lesson: 'The smaller feed pays for part of the valve: downsizing refunds the difference.' },
        maint: { t: 'The same, with a 20 scfm compressor', steps: ['As the cheapest fix', 'Compressor to 20 scfm'], edit: (W, b) => solB11(W, b, true),
          lesson: 'Faster recovery after a trip: the refill clock is compressor time.' } },
    ],
  });

  // =====================================================================================================
  // Call 12. A dry system laid as a grid: it calculates well and fails review. Make it a tree and keep the pipe.
  //   dock (10..33, 4..17), unheated; riser room (2..7, 8..14): tap (0,11), backflow (1,11), control valve (3,11), dry
  //   valve (5,11), feed main (6..9, 11) into the west main (column 10).
  //   A (ring): west and east mains (columns 10 and 33) joined by headers outside the dock (rows 3 and 18); the branch
  //      lines hang from each main and are capped where they meet in the middle (between x 21 and 22).
  //   B (ladder): the branch lines run from the west main to the east main, nothing else joins the east main.
  const dock12 = (W, b, ring) => {
    W.addRoom('riser', 2, 8, 6, 7).exempt = true; W.addRoom('dock', 10, 4, 24, 14);
    b.p('city', 0, 11, 0, { stat: 80, resid: 65, flow: 1500, fixed: true }); b.p('bfp', 1, 11); W.setPipe(2, 11, 7, 0); const g = b.p('gate', 3, 11, 0); W.setPipe(4, 11, 7, 0);
    const v = b.p('dryv', 5, 11, 0, { qod: true }); b.h(6, 9, 11, 7);
    if (ring) { b.v(10, 3, 18, 6); b.v(33, 3, 18, 6); b.h(11, 32, 3, 6); b.h(11, 32, 18, 6); for (let y = 4; y <= 17; y++) { W.spk[W.k(10, y)] = 1; W.spk[W.k(33, y)] = 1; } }
    else { b.v(10, 4, 17, 6, true); b.v(33, 4, 17, 6, true); }
    b.grid(11, 4, 32, 17, 3, 1); if (ring) for (let y = 4; y <= 17; y++) W.setCut(21, y, false, 1);
    const pn = b.p('panel', 6, 9); b.wire(pn, g, v); b.p('comp', 5, 13, 0, { scfm: 20 }); b.air([[5, 12]]);
  };
  const capLines = (W) => { for (let y = 4; y <= 17; y++) W.setCut(21, y, false, 1); };
  const goals12 = [
    { t: 'Plan review finds no code failures: no loop left, every head on the riser', ok: G.noFails, hint: 'Open Review: the gridded finding goes once every loop is broken; a head cut off from the riser is a failure too.' },
    { t: 'The calc passes at the most demanding area', ok: (S) => PZ.calcAllOk(S, 'dock'), hint: 'Select the dry valve and run the calc after every cut.' },
    { t: 'The dock is set and pressurized', ok: (S) => G.each(S, 'dock', (v, i, s) => v.type === 'dryv' && s.state === 'dry' && s.set), hint: 'Let the compressor bring it up.' },
  ];
  DI.PUZ.push({
    id: 'p12', n: 12, name: 'The Forbidden Grid', kind: 'Inherited installation', design: true, w: 36, h: 22, parts: ['gate', 'n2', 'comp'],
    builds: ['Call 3: a cap is a joint, and a wet system may be gridded', 'Call 9: the calc at the most demanding area', 'Cold Dock: dry pipe must not be gridded'],
    question: 'Where do you break a loop so the pipe still works?',
    learn: ['A dry or preaction system must be a tree: every loop broken exactly once, so the air can be driven out one way', 'Each loop needs one cut, and the place of the cut decides the calc: cut where the two ways round are equally long', 'A cut next to the riser makes the water go the long way round to half the system', 'Cutting a ladder grid orphans its far main unless the far main gets a path of its own', 'Inherited pipe is worth keeping: new pipe beside it usually beats replacing it'],
    variants: [
      { key: 'A', name: 'Dock A: the ring', money: 35000, area: [0, 2, 35, 19], impPar: null, reuse: true,
        constraints: ['Plan review must pass: no loop of any kind on dry pipe.', 'Keep the pipe: the scorecard counts the starting pipe tiles you keep.'],
        decision: 'The branch lines are already dead-ended. The loop is the ring of mains: the west main, the two headers outside the dock and the east main. One cap breaks it. Where it goes decides whether the calc still passes.',
        symptom: ['Inherited installation. The new owner’s insurer walked the unheated dock and flagged its dry system: the mains form a ring. The contractor who built it says it calculates better that way, and it does.', 'Make it a legal tree without losing the calc. Keep as much of the existing pipe as you can.'],
        records: (S) => ['Plan review (insurer): FAIL, dry piping is gridded (looped).', calcLine(S, 'dock', 'Contractor’s calc, with the ring')],
        build: (W, b) => dock12(W, b, true), prove: (S) => S.warp(2400),
        hints: [['Open Review and click the gridded finding. Follow the mains: west main, north header, east main, south header, and back.', 10, 3],
          ['One cap on the ring makes it a tree, and the water then reaches every part one way only. Try a cap, run the calc, undo, try another: compare a cut next to the riser with one at the far side.', 33, 11],
          ['Cap the east main in the middle (between rows 10 and 11), the point of the ring farthest from the riser. Each half of the ring then feeds its half of the dock the short way.', 33, 10]],
        diag: { q: 'Where does the one cap go?', opts: [
          ['At the far side of the ring, the middle of the east main', true, 'Yes. Both halves of the ring are then about equally long, and the calc keeps a quarter of its margin.'],
          ['Next to the riser, where the ring starts', false, 'Then half the west main is fed the long way round the whole ring: the calc falls to about 94 percent.'],
          ['On every branch line', false, 'The lines are already dead-ended in the middle. The loop is the ring of mains.'],
          ['Nowhere: a dry system may loop if it calculates', false, 'Not dry or preaction pipe: the air has to be driven out one way, and review fails any loop.']] },
        goals: goals12,
        cheap: { t: 'One cap at the far side', steps: ['Cap tool on the east main between rows 10 and 11', 'Run the calc'], edit: (W) => W.setCut(33, 10, true, 1),
          lesson: 'One edit, no cost, every tile kept.' },
        maint: { t: 'One cap, and nitrogen', steps: ['Cap the east main at the far side', 'Add a nitrogen generator beside the compressor, tubed to the dry valve'], edit: (W, b) => { W.setCut(33, 10, true, 1); b.p('n2', 4, 13, 0); W.setAir(4, 12, 1); },
          lesson: 'A loop that was flushed from both ends has left water in its low points. Nitrogen stops the corrosion that water would feed, while the compressor still does the fast refill.' } },
      { key: 'B', name: 'Dock B: the ladder', money: 15000, area: [0, 2, 35, 19], impPar: null, reuse: true, editSlack: 0.25,
        constraints: ['Plan review must pass: no loop of any kind on dry pipe.', 'Keep the pipe: the scorecard counts the starting pipe tiles you keep, and the cheaper fix is not the better one here.'],
        decision: 'Every branch line runs from the west main to the east main: fourteen loops, and the east main is fed only through them. Break every loop once and the east main has nothing feeding it. Replace a line with a main, or add pipe that keeps every old tile?',
        symptom: ['Inherited installation. A dry system in an unheated dock, laid as a ladder: every branch line joins a cross main at each end. It calculates with a big margin and fails review.', 'Make it a legal tree that still passes the calc, keeping as much of the existing pipe as you can.'],
        records: (S) => ['Plan review (insurer): FAIL, dry piping is gridded (looped).', calcLine(S, 'dock', 'Contractor’s calc, as a grid')],
        build: (W, b) => dock12(W, b, false), prove: (S) => S.warp(2400),
        hints: [['Each branch line with the two mains makes a loop: fourteen of them. A cap on every line gives each a dead end, and then the east main is fed by nothing.', 21, 10],
          ['The east main needs one path of its own. A branch line kept as that path carries half the dock’s water: at 2 in. the calc collapses. Either upsize one line into a main, or add a header that joins the two mains outside the dock.', 21, 3],
          ['Cap every line in the middle (between x 21 and 22) and lay a 3 in. header along row 3, from the top of the west main to the top of the east main. Every starting tile stays; the calc passes.', 21, 3]],
        diag: { q: 'How does the ladder become a tree and keep its pipe?', opts: [
          ['Cap every line once and feed the far main with a new header', true, 'Yes. The header is new pipe beside the old, so every old tile is kept, and each half line is fed from the nearer main.'],
          ['Keep one line as the connector and cap the rest', false, 'It works only with that line upsized to a main: 22 old tiles replaced. The header keeps them all.'],
          ['Cap every line at the east main', false, 'The east main’s heads then hang on no riser, and every line is 220 ft long from one end.'],
          ['Leave one loop: review allows one', false, 'Review allows none on dry pipe.']] },
        goals: goals12,
        cheap: { t: 'Fourteen caps and a 3 in. header', steps: ['Cap every branch line between x 21 and 22', 'Lay a 3 in. header along row 3 joining the tops of the two mains', 'Run the calc'], edit: (W, b) => { capLines(W); b.h(10, 33, 3, 5); },
          lesson: 'All 342 starting tiles kept. Upsizing one line as the connector costs less money and throws away 22 tiles of good pipe.' },
        maint: { t: 'The same with a 4 in. header', steps: ['Cap every line once', 'A 4 in. header along row 3', 'Run the calc'], edit: (W, b) => { capLines(W); b.h(10, 33, 3, 6); },
          lesson: 'A 3 in. header passes by two percent. At 4 in. the calc keeps about a quarter of margin for the racks the dock will get.' } },
    ],
  });
})();
