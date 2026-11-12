// Design calls 13-16: The Valve Gallery, Keep the Good Pipe, The Small Tank, One Supply, Many Rooms.
// The same shape as calls 9-12 (puz3.js): one hard constraint and one decision, both in the briefing. These combine more
// ideas: caps and independent isolation (calls 10, 13), salvage and reuse (calls 12, 14), the supply's pressure,
// flow and duration against the most demanding room (calls 9, 15, 16, Churn).
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const G = DI.G, PZ = DI.PZ, P3 = DI.PZ3, col = P3.col, row = P3.row, resize = P3.resize, tie = P3.tie, calcLine = P3.calcLine;

  // =====================================================================================================
  // Call 13. A valve gallery three tiles deep (rows 11 to 13) with rooms on both sides. Each room's cross main is laid
  // down to the gallery wall (its "entry"); the player builds the trunk and a control valve plus a wet riser per room,
  // all inside the gallery. A riser for a north room needs the trunk on row 13 at its column (valve row 11, control
  // valve row 12); one for a south room needs it on row 11. Pipes cannot cross, so the trunk has to weave.
  //   rooms: [side, type, x0, x1, entry column]; north rooms rows 2..10, south rooms rows 14..22
  const ROOMS13 = {
    A: [['N', 'office', 3, 12, 7], ['N', 'stor', 14, 25, 19], ['N', 'office', 27, 38, 32], ['S', 'stor', 8, 19, 13], ['S', 'office', 21, 32, 26], ['S', 'stor', 34, 44, 39]],
    B: [['N', 'office', 3, 12, 7], ['N', 'stor', 14, 25, 19], ['N', 'office', 27, 38, 32], ['S', 'stor', 4, 16, 12], ['S', 'office', 18, 29, 20], ['S', 'stor', 31, 44, 38]],
  };
  const gallery13 = (W, b, rooms) => {
    W.addRoom('corr', 2, 11, 44, 3).exempt = true;
    for (const [side, type, x0, x1, sx] of rooms) {
      const y0 = side === 'N' ? 2 : 14, y1 = side === 'N' ? 10 : 22, big = type === 'stor'; W.addRoom(type, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      b.v(sx, y0, y1, big ? 6 : 5, true); b.grid(x0, y0, x1, y1, big ? 3 : 2, 1);
    }
    b.p('city', 0, 12, 0, { stat: 90, resid: 75, flow: 2500, fixed: true, loop: true, label: 'Campus Fire Loop' }); const g = b.p('gate', 1, 12, 0);
    const pn = b.p('panel', 1, 14); b.wire(pn, g);
  };
  // a riser at column x for a north (valve row 11, control valve row 12) or south room (control valve row 12, valve row 13)
  const riser13 = (W, b, side, x) => { const pn = W.byType('panel')[0]; const pair = side === 'N' ? [b.p('wetv', x, 11, 3), b.p('gate', x, 12, 3)] : [b.p('gate', x, 12, 1), b.p('wetv', x, 13, 1)]; b.wire(pn, ...pair); };
  // the trunk: from the gallery's west end, a list of row segments [y, x0, x1]; consecutive segments are joined by a jog
  // down or up the column where they meet (through row 12)
  const trunk13 = (W, segs, size) => {
    const lay = (x, y) => { if (!W.pd[W.k(x, y)] && !W.partAt[W.k(x, y)]) W.setPipe(x, y, size, 0); };
    lay(2, 12); for (let y = 11; y <= 13; y++) if (y === segs[0][0]) lay(2, y);
    segs.forEach(([y, a, c], i) => { for (let x = a; x <= c; x++) lay(x, y); if (i + 1 < segs.length) lay(c, 12); });
  };
  const solA13 = (W, b, size) => {
    for (const [side, , , , x] of ROOMS13.A) riser13(W, b, side, x);
    trunk13(W, [[13, 2, 10], [11, 10, 16], [13, 16, 23], [11, 23, 29], [13, 29, 35], [11, 35, 39]], size);
  };
  // B: the office south of the storage room enters at column 20, beside the storage room's 19: no weave serves both.
  // Its entry moves to column 23 along its first row (three tiles laid as a main), and the two joints where the trunk
  // passes over that main are capped.
  const solB13 = (W, b, size) => {
    for (const [side, , , , x] of ROOMS13.B) if (x !== 20) riser13(W, b, side, x);
    for (let x = 21; x <= 23; x++) { const k = W.k(x, 14); W.pk[k] = 0; W.pd[k] = 6; } W.ver++;
    riser13(W, b, 'S', 23); W.setCut(20, 13, true, 1); W.setCut(21, 13, true, 1);
    trunk13(W, [[13, 2, 9], [11, 9, 15], [13, 15, 21], [11, 21, 28], [13, 28, 34], [11, 34, 38]], size);
  };
  // every non-exempt room on exactly one system, which protects that room only
  const ownRiser = (S) => S.W.rooms.filter((r) => !r.exempt).every((r) => { const sys = [...S.sysd.info.values()].filter((i) => i.rooms.has(r.id)); return sys.length === 1 && sys[0].rooms.size === 1; });
  const inGallery = (S) => { const W = S.W, gal = W.rooms.find((r) => r.type === 'corr'), inG = (p) => W.roomAt[W.k(p.x, p.y)] === gal.id;
    const sys = [...W.parts.values()].filter((p) => DI.SYSV[p.type]); return sys.length > 0 && sys.every((v) => { const g = DI.ctrlValve(W, v.id); return inG(v) && !!g && inG(g); }); };
  const goals13 = [
    { t: 'Every room on a riser of its own: one system valve per room', ok: (S) => G.covered(S) && ownRiser(S), hint: 'Hover a room’s lines: they read no pressure until its entry is on a riser.' },
    { t: 'Every riser and its control valve in the valve gallery', ok: inGallery, hint: 'The owner’s rule: nobody enters a room to work a valve.' },
    { t: 'Independent isolation: each room’s control valve shuts off that room and no other', ok: (S) => S.W.byType('wetv').length > 0 && PZ.notIsolated(S).length === 0, hint: 'A control valve on the trunk between two risers shuts everything past it. Each control valve belongs between the trunk and one riser.' },
    { t: 'Every valve supervised: risers and control valves wired to the panel', ok: (S) => G.wired(S, ['wetv', 'gate']), hint: 'Wire tool: the panel, then each riser and each control valve.' },
    { t: 'Plan review finds no code failures', ok: G.noFails, hint: 'Open Review: a cross-connection means the trunk touches a room’s main without a valve between them.' },
    { t: 'Every room’s calc passes at the most demanding area', ok: (S) => PZ.calcEvery(S), hint: 'Select each riser and run the calc.' },
  ];
  DI.PUZ.push({
    id: 'p13', n: 13, name: 'The Valve Gallery', kind: 'Empty site', design: true, w: 48, h: 25, parts: ['gate', 'wetv', 'check', 'panel'],
    builds: ['Hyperscale: risers in a gallery beside the rooms, one trunk down the corridor', 'Call 10: mains join through walls; a cap keeps them apart', 'Call 4: a control valve that shuts more than it should'],
    question: 'How do you fit a riser for every room into a corridor where pipes cannot cross?',
    learn: ['Plan the trunk before the first tile: in a narrow gallery the order of the risers decides where the trunk can run', 'A riser takes two tiles between the trunk and the wall: control valve, then system valve', 'Rooms on both sides of a three-tile gallery need the trunk to weave from one edge to the other between risers', 'Independent isolation: each control valve sits between the trunk and one riser, never on the trunk', 'When two entries are too close, move one entry along the room’s first row, and cap the trunk where it passes the new main'],
    variants: [
      { key: 'A', name: 'Gallery A: staggered entries', money: 85000, area: [0, 1, 47, 23], impPar: null, editSlack: 0.25,
        constraints: ['The gallery is three tiles deep. Every riser and its control valve go in it.', 'Each room is isolated by its own control valve, without shutting any other room.', 'The rooms are piped to the gallery wall: keep their entries.'],
        decision: 'A riser for a north room needs the trunk on the south edge of the gallery at its column; a riser for a south room needs it on the north edge. The entries alternate north and south. One straight trunk cannot serve both sides: where does it cross over?',
        symptom: ['Empty site. Six rooms on both sides of a valve gallery, every room piped to the gallery wall. The campus loop comes in at the west end through one control valve. The gallery is empty.', 'Plan the gallery, then build a trunk and a riser for every room, each with its own control valve, all in the gallery.'],
        records: ['Campus fire loop at the gallery: 90 psi static, 75 psi residual at 2,500 gpm.', 'Owner standard: risers in the gallery only; each room isolated on its own valve.'],
        build: (W, b) => gallery13(W, b, ROOMS13.A), prove: () => {},
        hints: [['Look at where each room’s cross main reaches the gallery wall. North entries are at columns 7, 19 and 32; south entries at 13, 26 and 39.', 13, 12],
          ['A north riser: system valve on row 11, control valve on row 12, trunk on row 13 at that column. A south riser is the mirror: the trunk on row 11. Between a north riser and the next south one, the trunk has to jog across the gallery.', 10, 12],
          ['Trunk (4 in.) along row 13 from the west end to column 10, up to row 11 and on to column 16, down to row 13 to column 23, up at 23, down at 29, up at 35, ending at 39. A riser at every entry column, wired with its control valve.', 23, 12]],
        diag: { q: 'Where does the trunk run in a three-tile gallery with rooms on both sides?', opts: [
          ['It weaves: along the south edge past north risers, across the gallery between risers, along the north edge past south risers', true, 'Yes. Each jog sits in a column with no entry, so the trunk never touches a room’s main except through a riser.'],
          ['Down the middle row, with the valves on either side of it', false, 'Then a riser has only one tile between the trunk and the wall: the system valve would have to go in the room.'],
          ['Two trunks, one along each edge', false, 'A north riser’s system valve sits on the north edge: the second trunk would run into it.'],
          ['Along one edge, with sectional valves between rooms', false, 'A valve on the trunk shuts every room past it: that is not independent isolation, and the south rooms still need the other edge.']] },
        goals: goals13,
        cheap: { t: 'A 4 in. trunk that weaves', steps: ['Trunk along row 13, jogging across the gallery at columns 10, 16, 23, 29 and 35', 'A riser and its control valve at every entry, wired'], edit: (W, b) => solA13(W, b, 6),
          lesson: 'Twelve valves, one trunk, five jogs: every room isolated on its own valve. A 3 in. trunk fails the far storage rooms.' },
        maint: { t: 'The same with a 6 in. trunk', steps: ['As the cheapest fix, with the trunk at 6 in.'], edit: (W, b) => solA13(W, b, 7),
          lesson: 'About $12,000 more for a trunk that can take a seventh room at the east end without a new calc for the others.' } },
      { key: 'B', name: 'Gallery B: two entries side by side', money: 85000, area: [0, 1, 47, 23], impPar: null, editSlack: 0.25,
        constraints: ['The gallery is three tiles deep. Every riser and its control valve go in it.', 'Each room is isolated by its own control valve.', 'A room’s piping may be changed along its first row; nothing deeper.'],
        decision: 'The storage room enters at column 19 from the north and the office at column 20 from the south. One needs the trunk on the south edge, the other on the north edge, a column apart: no jog fits between them. One entry has to move, and the trunk must not touch the main that moves it.',
        symptom: ['Empty site. The same gallery, with the rooms piped by two different contractors. Two entries ended up in neighbouring columns on opposite sides.', 'Build a trunk and a riser for every room, each with its own control valve, all in the gallery.'],
        records: ['Campus fire loop at the gallery: 90 psi static, 75 psi residual at 2,500 gpm.', 'Coordination note: "office entry at column 20, clashes with storage at 19. Resolve in the gallery."'],
        build: (W, b) => gallery13(W, b, ROOMS13.B), prove: () => {},
        hints: [['North entries at 7, 19 and 32; south entries at 12, 20 and 38. Columns 19 and 20 cannot both have a riser: the trunk would have to be on both edges at once.', 20, 12],
          ['Move the office entry: lay its first row (row 14) as a main from column 20 to a free column further east, and put its riser there. The trunk passes over that main on row 13 and joins it unless the joints are capped.', 22, 14],
          ['Lay row 14 from column 21 to 23 as a main; riser for the office at column 23. Trunk: row 13 to 9, row 11 to 15, row 13 to 21, row 11 to 28, row 13 to 34, row 11 to 38. Cap the two joints between the trunk on row 13 and the office main below it (columns 20 and 21).', 21, 13]],
        diag: { q: 'How do two entries a column apart both get a riser?', opts: [
          ['Move one entry along the room’s first row to a free column, and cap the trunk where it passes over that main', true, 'Yes. The moved entry gets a riser of its own, and the caps keep the trunk off the room’s main.'],
          ['One riser for both rooms', false, 'Then one control valve shuts both rooms: not independent isolation, and review counts it a shared system.'],
          ['Put one system valve in the room', false, 'The owner’s rule: every riser in the gallery.'],
          ['Feed one of them from the other room’s main', false, 'That puts both rooms behind one riser again.']] },
        goals: goals13,
        cheap: { t: 'Move the office entry, two caps', steps: ['Row 14, columns 21 to 23, laid as a 4 in. main; the office riser at column 23', 'A riser at every other entry', '4 in. trunk weaving across at columns 9, 15, 21, 28 and 34', 'Cap the trunk over the office main at columns 20 and 21'], edit: (W, b) => solB13(W, b, 6),
          lesson: 'Three tiles of room main and two free caps resolve the clash.' },
        maint: { t: 'The same with a 6 in. trunk', steps: ['As the cheapest fix, with the trunk at 6 in.'], edit: (W, b) => solB13(W, b, 7),
          lesson: 'Spare capacity on the trunk for the next room.' } },
    ],
  });

  // =====================================================================================================
  // Call 14. An inherited wet system on a floor whose use changes, gridded by the original installer: both far ends of
  // the branch lines are tied into mains (columns 12 and 35; the feed main crosses the west tie on row 12). Nothing
  // taken out refunds anything (salvage 0), and the pipe kept is scored.
  //   riser room (1..5, 9..14): tap (0,12), backflow (1,12), control valve (2,12), riser (3,12); feed main (4..23, 12),
  //   cross main column 24 (3..18), branch lines west (12..23) and east (25..35).
  //   A: the floor is now storage: 2½ in. feed and cross main, 1½ in. lines, both sides tied.
  //   B: the floor becomes a data hall on double-interlock preaction: 3 in. feed and cross main, 2 in. lines, west tie.
  const floor14 = (W, b, o) => {
    W.addRoom('riser', 1, 9, 5, 6).exempt = true; W.addRoom(o.room, 12, 3, 24, 16);
    b.p('city', 0, 12, 0, { stat: 75, resid: 60, flow: 1500, fixed: true }); b.p('bfp', 1, 12); const g = b.p('gate', 2, 12, 0), r = b.p('wetv', 3, 12);
    b.h(4, 23, 12, o.feed); b.v(24, 3, 18, o.feed, true); b.grid(12, 3, 23, 18, o.br, 1); b.grid(25, 3, 35, 18, o.br, 1);
    tie(W, 12, 3, 18); if (o.east) tie(W, 35, 3, 18);
    const pn = b.p('panel', 4, 10); b.wire(pn, g, r);
  };
  // B: preaction valve in place of the wet riser, a 20 scfm compressor tubed to it, an aspirating detector in the hall's
  // north-east corner (it takes the place of one tile of line), both wired; every west line capped off the tie column
  const toDI = (W, b) => {
    const pn = W.byType('panel')[0]; W.removePart(W.at(3, 12).id); const v = b.p('prev', 3, 12, 0);
    W.erasePipe(35, 3); const d = b.p('vesda', 35, 3); b.p('comp', 4, 13, 0, { scfm: 20 }); W.setAir(3, 13, 1); b.wire(pn, v, d);
    for (let y = 3; y <= 18; y++) if (y !== 12) W.setCut(12, y, false, 1);
  };
  const C14 = ['Inherited material has no resale value: anything you take out or replace refunds nothing.', 'The starting pipe you keep is scored: the best fix keeps nearly all of it.'];
  DI.PUZ.push({
    id: 'p14', n: 14, name: 'Keep the Good Pipe', kind: 'Inherited installation', design: true, w: 40, h: 22, parts: ['gate', 'prev', 'wetv', 'comp', 'panel', 'vesda'],
    builds: ['Call 9: friction concentrates where the whole demand flows', 'Call 12: a grid on preaction pipe has to become a tree, and where it is cut decides the calc', 'Double Interlock: valve, air, detection and the 30 percent larger design area'],
    question: 'What is the least you have to replace to make an old system meet a new use?',
    learn: ['Old pipe that is sound is free capacity: every tile replaced is paid for twice', 'Find the bottleneck before buying pipe: here the lines and the grid were big enough, the feed was not', 'A use that needs more water does not mean a new system; a system type that changes (wet to preaction) means the grid goes and the valve changes, not the pipe', 'Where a grid is cut decides the calc: a tie column that stays fed from the feed main keeps half its value', 'Replace the length that carries the whole demand, and only as far as the calc needs'],
    variants: [
      { key: 'A', name: 'Floor A: office to storage', money: 20000, area: [0, 2, 37, 19], impPar: null, salvage: 0, reuse: true, constraints: C14,
        decision: 'The floor is storage now and its calc fails. The contractor quotes $132,000 to re-pipe it for the new use. The pipe is sound, gridded and paid for; whatever you take out is scrap. Most of it is big enough. Which part is not?',
        symptom: ['Inherited installation. An office floor on a gridded wet system is being turned into storage. At the higher hazard the calc fails, and the sprinkler contractor proposes re-piping the whole floor.', 'Make the calc pass for storage, replacing as little as you can.'],
        records: (S) => [calcLine(S, 'stor', 'Calc at the storage hazard (0.20 gpm/ft² over 1,500 ft²)'), 'Contractor’s proposal: re-pipe the floor, 2 in. lines and a 6 in. feed, $132,000.'],
        build: (W, b) => floor14(W, b, { room: 'stor', feed: 4, br: 2, east: true }), prove: () => {},
        hints: [['Run the calc and hover from the riser outwards. The lines are gridded and fed from both ends: look for the pipe that carries the whole floor’s demand.', 8, 12],
          ['The 2½ in. feed main carries everything. A tile replaced costs the full price of the new pipe, and the old one is scrap: replace only as much of it as the calc needs.', 8, 12],
          ['Replace the feed main from the riser room to the building wall (8 tiles, x 4 to 11) with 4 in. pipe: about $3,200, and the calc passes.', 8, 12]],
        diag: { q: 'What does the change to storage actually need?', opts: [
          ['A short length of bigger feed main', true, 'Yes. Eight tiles of 4 in. where the whole demand flows: the gridded lines were big enough all along.'],
          ['Re-pipe the floor for storage', false, 'About $132,000 and every tile scrapped, for lines that already calculate.'],
          ['Bigger branch lines in the design area', false, 'The lines are gridded and fed from both ends: they are not where the pressure goes.'],
          ['Replace the cross main', false, 'One size up buys about five percent: the grid feeds the lines from the tie mains as well.']] },
        goals: [{ t: 'The calc passes at the storage hazard, at the most demanding area', ok: (S) => PZ.calcAllOk(S, 'stor'), hint: 'Select the riser and run the calc.' }, { t: 'Plan review finds no code failures', ok: G.noFails, hint: 'Open Review.' }],
        cheap: { t: 'Eight tiles of 4 in. feed', steps: ['Main tool at 4 in. over the feed main from the riser room to the building wall (x 4 to 11)', 'Run the calc'], edit: (W) => resize(W, row(12, 4, 11), 6),
          lesson: 'About $3,200 against a $132,000 proposal, and 384 of 392 tiles kept.' },
        maint: { t: 'The whole feed main at 4 in.', steps: ['Main tool at 4 in. over the whole feed main', 'Run the calc'], edit: (W) => resize(W, row(12, 4, 23), 6),
          lesson: 'About $8,000 for a margin over 10 percent, still keeping 372 tiles.' } },
      { key: 'B', name: 'Floor B: office to data hall', money: 60000, area: [0, 2, 37, 19], impPar: null, salvage: 0, reuse: true, editSlack: 0.25,
        constraints: C14.concat(['The hall needs double-interlock preaction (owner standard for white space).']),
        decision: 'The office becomes a data hall: double interlock, so the grid must go, the riser valve must change and the design area grows 30 percent. The old valve and every tile you replace are scrap. Where do you cut the grid, and what little do you replace?',
        symptom: ['Inherited installation. An office floor on a wet system, gridded on its west side, becomes a data hall. The owner’s standard for white space is double-interlock preaction.', 'Convert it, keeping as much of the old pipe as you can.'],
        records: (S) => [calcLine(S, 'hall', 'Calc as a wet system today'), 'Owner standard: white space on double-interlock preaction, aspirating detection.'],
        build: (W, b) => floor14(W, b, { room: 'hall', feed: 5, br: 3 }), prove: (S) => S.warp(2400),
        hints: [['Swap the wet riser for a preaction valve, tube a compressor to it, put an aspirating detector in the hall and wire both to the panel. Then open Review: the grid fails on preaction pipe.', 3, 12],
          ['The west lines are tied into a main at their far ends (column 12), and the feed main crosses that tie. Cap the lines off the tie, or cap them in their middles: try both, and run the calc. The bigger preaction design area needs more pressure than the wet system did.', 12, 8],
          ['Cap every west line where it meets the tie column (between x 12 and 13, every row but the feed row): the tie stays a dead-end main off the feed. Then replace the feed main from the riser to just inside the hall (10 tiles, x 4 to 13) with 4 in. pipe.', 12, 12]],
        diag: { q: 'Where does the grid get cut, and what gets replaced?', opts: [
          ['Cap the lines off the tie column, and replace the first length of feed main', true, 'Yes. The tie stays fed from the feed main as a dead end, the lines are fed from the cross main, and ten tiles of 4 in. feed make up the bigger design area.'],
          ['Cap every line in its middle', false, 'That is a tree too, and it calculates worse: the tie then feeds half of every west line the long way.'],
          ['Keep the grid on the preaction valve', false, 'No loop is allowed on preaction pipe: the air has to be driven out one way.'],
          ['Re-pipe the hall as a new tree', false, 'Everything taken out is scrap. The old pipe is sound: it needs cutting differently, not replacing.']] },
        goals: [{ t: 'The hall on double-interlock preaction, every head on it', ok: (S) => G.covered(S, ['hall']) && G.each(S, 'hall', (v) => v.type === 'prev'), hint: 'Replace the wet riser with a preaction valve.' },
          { t: 'Plan review finds no code failures: no loop, detection, air, wiring', ok: G.noFails, hint: 'Open Review.' },
          { t: 'The calc passes at the most demanding area (the preaction area is 30 percent larger)', ok: (S) => PZ.calcAllOk(S, 'hall'), hint: 'Select the preaction valve and run the calc.' },
          { t: 'The zone set and pressurized, nothing latched', ok: (S) => G.each(S, 'hall', (v) => PZ.inService(S, v)), hint: 'Let the compressor fill it.' }],
        cheap: { t: 'Valve swap, caps off the tie, ten tiles of feed', steps: ['Preaction valve in place of the wet riser; compressor, tubing, aspirating detector, wiring', 'Cap every west line off the tie column', 'Main tool at 4 in. over the feed main, x 4 to 13'], edit: (W, b) => { toDI(W, b); resize(W, row(12, 4, 13), 6); },
          lesson: 'Fifteen free caps and ten tiles of pipe; 381 of 392 tiles kept.' },
        maint: { t: 'The same with the whole feed main at 4 in.', steps: ['As the cheapest fix, with the whole feed main replaced'], edit: (W, b) => { toDI(W, b); resize(W, row(12, 4, 23), 6); },
          lesson: 'About $5,000 more for a margin near 20 percent: data halls get re-racked.' } },
    ],
  });

  // =====================================================================================================
  // Call 15. The pump site of Churn (contract 3): a tank, an electric fire pump, a jockey pump, a storage building on a
  // wet riser at (28,13). The calc has pressure to spare; the tank does not last the hazard's 60 minutes.
  //   A: an oversized pump (1,500 gpm at 150 psi) on a 60,000 gal tank.
  //   B: 1¼ in. branch lines on a 3 in. main, a dry valve in the heated riser room, an inherited 45,000 gal tank.
  const c3 = () => DI.SCEN.find((s) => s.id === 'c3');
  const site15 = (W, b, o) => {
    c3().build(W); const pn = W.byType('panel')[0], h = DI.pumpHouse(b, pn); Object.assign(h.ep.p, o.pump); h.ep.p.orig = 1;
    const t = W.byType('tank')[0]; t.p.cap = t.p.gal = o.cap;
    if (o.br !== undefined) { for (let y = 8; y <= 17; y++) for (let x = 30; x <= 45; x++) { const k = W.k(x, y); if (W.pk[k]) W.pd[k] = o.br + 1; } for (let x = 29; x <= 45; x++) W.pd[W.k(x, 13)] = 6; W.ver++; }
    if (o.dry) { W.removePart(W.at(28, 13).id); const v = b.p('dryv', 28, 13, 0); b.p('comp', 28, 11, 0, { scfm: 10 }); W.setAir(28, 12, 1); b.wire(pn, v); }
  };
  const wet15 = (W, b) => { const pn = W.byType('panel')[0]; W.removePart(W.at(28, 13).id); const r = b.p('wetv', 28, 13, 0); b.wire(pn, r); W.removePart(W.at(28, 11).id); };
  const pump15 = (W, gpm, psi) => { const p = W.byType('epump')[0]; p.p.gpm = gpm; p.p.psi = psi; W.ver++; };
  const n0 = (x) => Math.round(x).toLocaleString('en-US');
  const tankLine = (S) => { const id = G.sysOf(S, 'stor')[0], c = id && PZ.calcAll(S, id); return c && c.ok ? 'Insurer survey: at the design demand of ' + n0(c.total) + ' gpm the tank lasts ' + DI.fmt(c.tankMin) + ' min against the 60 min the storage hazard needs. The calc itself passes at ' + DI.fmt(c.margin * 100) + ' percent.' : 'Insurer survey: no calc result.'; };
  const goals15 = [{ t: 'The calc passes at the most demanding area, the tank lasts the full 60 minutes and the pump runs at 150 percent of rating or less', ok: (S) => PZ.calcAllOk(S, 'stor', true), hint: 'Select the wet riser and run the calc: it reports the tank’s duration and the pump’s operating point.' },
    { t: 'Plan review finds no code failures', ok: G.noFails, hint: 'Open Review.' }];
  const C15 = ['Every protection requirement stays: the hazard, the density, the design area, the hose allowance and the 60 minutes.', 'Money back counts: the best fix here may cost less than nothing.'];
  DI.PUZ.push({
    id: 'p15', n: 15, name: 'The Small Tank', kind: 'Records-only investigation', design: true, w: 60, h: 32, parts: ['tank', 'epump', 'wetv', 'dryv', 'gate', 'check', 'panel'],
    builds: ['Churn: the tank sets how long you can fight, and the pump curve sets the flow', 'Call 1: Q = K√P, so more pressure is more water from every open head', 'Cold Dock: the dry design area is 30 percent larger'],
    question: 'What uses up the water, and what is the cheapest way to make it last?',
    learn: ['Duration is storage divided by demand: a tank can be too small, or the demand too big', 'Every open head flows K√P: a pump far bigger than the system needs over-discharges, and the tank empties faster', 'Size the pump to the demand, not to the catalogue: up to 150 percent of rating is allowed', 'A dry system calculates 30 percent more heads: in a heated room it costs water, money and delivery time for nothing', 'Read the calc for three things: pressure (the weakest head), flow (the pump’s point) and duration (the tank)'],
    variants: [
      { key: 'A', name: 'Site A: the big pump', money: 40000, area: [3, 7, 47, 19], impPar: null, constraints: C15.concat(['Plan review must pass.']),
        decision: 'The calc passes by a mile and the tank empties in 56 minutes. A bigger tank costs at least $36,000. The pump makes far more pressure than the storage building needs, and every open head turns pressure into water. Spend money on storage, or take it off demand?',
        symptom: ['Records-only investigation. The insurer’s survey of the storage building’s pump house: the 60,000 gal tank does not last the 60 minutes the storage hazard needs. The pump was upgraded to 1,500 gpm at 150 psi "for margin" two years ago.', 'Make the water last, keeping every protection requirement. The cheapest fix earns the star.'],
        records: (S) => [tankLine(S), 'Pump upgrade ticket: 1,000 gpm / 100 psi replaced by 1,500 gpm / 150 psi.'],
        build: (W, b) => site15(W, b, { pump: { gpm: 1500, psi: 150, start: 100 }, cap: 60000 }), prove: () => {},
        hints: [['Select the wet riser and run the calc: read the pressure at the riser, the total demand and the tank’s duration. The weakest head gets more than twice what it needs.', 28, 13],
          ['Every head in the design area flows K√P: at more than twice the needed pressure it flows about 50 percent more water. Select the fire pump: its nameplate (rated flow and pressure) is a design setting.', 11, 12],
          ['Pick a smaller pump on its nameplate and run the calc again. 500 gpm at 80 psi still passes, runs under 150 percent of rating and lasts over 80 minutes, and its price comes back to you.', 11, 12]],
        diag: { q: 'What empties the tank early?', opts: [
          ['A pump far bigger than the demand: every open head over-discharges', true, 'Yes. The heads take K√P at the pump’s pressure, not at the pressure they need. A pump sized to the demand draws about 30 percent less from the tank.'],
          ['The tank is too small for the room', false, 'With a pump sized to the demand it lasts over 80 minutes as it is.'],
          ['The hose allowance', false, 'It is fixed at 250 gpm for this hazard. The sprinklers are what take more than they need.'],
          ['A leak on the underground main', false, 'A leak is a few gallons a minute of jockey make-up, not hundreds.']] },
        goals: goals15,
        cheap: { t: 'A 500 gpm, 80 psi pump', steps: ['Fire pump nameplate: 500 gpm, 80 psi', 'Run the calc'], edit: (W) => pump15(W, 500, 80),
          lesson: 'About $49,500 back, and the tank lasts about 82 minutes. The pump runs near 147 percent of rating at the design demand: inside the 150 percent the curve allows.' },
        maint: { t: 'A 1,000 gpm, 100 psi pump', steps: ['Fire pump nameplate: 1,000 gpm, 100 psi', 'Run the calc'], edit: (W) => pump15(W, 1000, 100),
          lesson: 'About $33,000 back. At about 90 percent of rating it keeps headroom for wear and for the annual flow test, and the tank still lasts 67 minutes.' } },
      { key: 'B', name: 'Site B: the dry room', money: 20000, area: [3, 7, 47, 19], impPar: null, constraints: C15.concat(['The storage building is heated.']),
        decision: 'The calc passes with a little pressure to spare and the 45,000 gal tank empties in 57 minutes. A smaller pump cannot hold the pressure the 1¼ in. lines need. The storage building is heated, and its system is dry. What is the extra water for?',
        symptom: ['Records-only investigation. The insurer’s survey of a storage building with an inherited 45,000 gal tank: it does not last the 60 minutes the hazard needs. The building is heated; its sprinklers are on a dry pipe valve "because the last tenant asked for it".', 'Make the water last, keeping every protection requirement. The cheapest fix earns the star.'],
        records: (S) => [tankLine(S), 'Building: heated storage, 70 °F year round.'],
        build: (W, b) => site15(W, b, { pump: { gpm: 750, psi: 100, start: 100 }, cap: 45000, br: 1, dry: true }), prove: () => {},
        hints: [['Run the calc on the riser: the design area says 1,950 ft² (1,500 + 30 percent). That is the dry pipe rule.', 28, 13],
          ['The 30 percent larger area means about 30 percent more heads flowing, all from the tank. Try a smaller pump: the 1¼ in. lines need the pressure. The room is heated: does it need dry pipe at all?', 28, 13],
          ['Replace the dry valve with a wet riser (wire it to the panel) and remove the compressor. The design area drops to 1,500 ft², the tank lasts over an hour, and both parts refund.', 28, 13]],
        diag: { q: 'What empties the tank early?', opts: [
          ['A dry system in a heated room: its design area is 30 percent larger', true, 'Yes. A wet system in the same room calculates 1,500 ft², not 1,950, and the tank lasts over an hour.'],
          ['The pump is too big', false, 'A smaller pump cannot hold the pressure the 1¼ in. lines need: the calc fails first.'],
          ['The tank is too small', false, 'For a wet system it lasts over an hour as it is. A 60,000 gal tank would cost about $9,000.'],
          ['The hose allowance', false, 'It is fixed at 250 gpm for this hazard.']] },
        goals: goals15,
        cheap: { t: 'Wet riser in place of the dry valve', steps: ['Remove the dry valve, place a wet riser, wire it', 'Remove the compressor', 'Run the calc'], edit: (W, b) => wet15(W, b),
          lesson: 'About $13,000 back, and faster water on the fire: no air to push out first.' },
        maint: { t: 'Wet riser, and a 60,000 gal tank', steps: ['As the cheapest fix', 'Tank capacity to 60,000 gal'], edit: (W, b) => { wet15(W, b); const t = W.byType('tank')[0]; t.p.cap = t.p.gal = 60000; W.ver++; },
          lesson: 'The odd 45,000 gal tank becomes a catalogue size with about 20 minutes of margin, for about $9,000 of the money the conversion gave back.' } },
    ],
  });

  // =====================================================================================================
  // Call 16. One pump house for several rooms. The pump house (6..19, 10..18) is the reference installation: tank (6,12),
  // fire pump (11,12), check valve, jockey pump, test header; the discharge runs down to a 6 in. main along row 18. A
  // weak city main joins it at (19,19). Each room has its riser off the main: control valve and system valve in its own
  // column, the cross main up (north rooms) or down (south rooms) the same column. The pump and the tank start at the
  // smallest catalogue nameplates (500 gpm, 80 psi, 60,000 gal): sizing them is the call.
  //   room: [type, x0, x1, y0, y1, riser column, 'N' | 'S', system valve type, cross main size, branch line size]
  const ROOMS16 = {
    A: { mainEnd: 50, rooms: [['office', 22, 31, 21, 28, 26, 'S', 'wetv', 5, 2], ['stor', 22, 33, 6, 15, 27, 'N', 'wetv', 6, 2], ['dock', 36, 47, 6, 15, 41, 'N', 'dryv', 6, 3]] },
    B: { mainEnd: 40, tail: 5, tailEnd: 55, rooms: [['stor', 22, 33, 6, 15, 27, 'N', 'wetv', 6, 3], ['office', 50, 61, 21, 28, 55, 'S', 'wetv', 5, 0]] },
  };
  const site16 = (W, b, o) => {
    W.addRoom('pump', 4, 9, 14, 7).exempt = true;
    b.p('city', 0, 24, 0, { stat: 40, resid: 15, flow: 500, fixed: true }); b.h(1, 1, 24, 6); b.p('bfp', 2, 24); b.h(3, 19, 24, 6); b.v(19, 19, 23, 6);
    const pn = b.p('panel', 18, 10);
    b.p('tank', 6, 12, 0, { cap: 60000, gal: 60000 }); b.h(7, 10, 12, 8); const ep = b.p('epump', 11, 12, 0, { gpm: 500, psi: 80, start: 100 }); ep.p.orig = 1;
    b.h(12, 13, 12, 8); b.p('check', 14, 12); b.h(15, 19, 12, 8); b.v(19, 13, 18, 8);
    b.v(9, 10, 11, 3); b.h(10, 10, 10, 3); b.p('jockey', 11, 10, 0, { gpm: 15, psi: 135, start: 115, stop: 125 }); b.h(12, 13, 10, 3); b.p('check', 14, 10); b.h(15, 15, 10, 3); b.v(15, 11, 11, 3);
    b.v(17, 13, 15, 7); b.p('testhdr', 17, 16, 1); b.wire(pn, ep);
    b.h(20, o.mainEnd, 18, 7); if (o.tail) b.h(o.mainEnd + 1, o.tailEnd, 18, o.tail);
    for (const [type, x0, x1, y0, y1, rx, side, sys, cm, br] of o.rooms) {
      W.addRoom(type, x0, y0, x1 - x0 + 1, y1 - y0 + 1); const N = side === 'N';
      const g = b.p('gate', rx, N ? 17 : 19, N ? 3 : 1), v = b.p(sys, rx, N ? 16 : 20, N ? 3 : 1, sys === 'dryv' ? { qod: true } : undefined);
      b.v(rx, y0, y1, cm, true); b.grid(x0, y0, x1, y1, br, 1); b.wire(pn, g, v);
      if (sys === 'dryv') { b.p('comp', rx + 2, 16, 0, { scfm: 20 }); W.setAir(rx + 1, 16, 1); }
    }
  };
  const plant16 = (W, gpm, psi, cap) => { const p = W.byType('epump')[0], t = W.byType('tank')[0]; p.p.gpm = gpm; p.p.psi = psi; if (cap) { t.p.cap = t.p.gal = cap; } W.ver++; };
  // what each room's calc says, for the records: pass, or which of pressure, pump flow and tank duration fails
  const roomLines = (S) => [...S.sysd.info.keys()].map((id) => { const c = PZ.calcAll(S, id), nm = DI.sysName(S, id).replace(/^.* - /, '');
    if (!c || !c.ok) return nm + ': no result.';
    const why = [c.pass ? '' : 'pressure (weakest head ' + DI.fmt(c.margin * 100) + ' percent)', c.over ? 'the pump past 150 percent of rating (' + DI.fmt(Math.max(...c.pumpPts.map((q) => q.pct))) + ' percent)' : '', c.durOk ? '' : 'the tank (' + DI.fmt(c.tankMin) + ' min of ' + c.hz.dur + ')'].filter(Boolean);
    return nm + ' (' + c.hz.name + (c.dryLike ? ', dry' : '') + '): ' + Math.round(c.total).toLocaleString('en-US') + ' gpm at the riser. ' + (why.length ? 'FAILS on ' + why.join(', ') + '.' : 'Passes.'); });
  const goals16 = [{ t: 'Every room’s calc passes at its most demanding area, with the tank lasting each hazard’s duration and the pump at 150 percent of rating or less', ok: (S) => PZ.calcEvery(S, true), hint: 'Select each riser and run the calc. The pump and the tank nameplates are on their inspectors.' },
    { t: 'Plan review finds no code failures', ok: G.noFails, hint: 'Open Review.' }];
  const C16 = ['One fire pump and one tank serve every room. Their nameplates (rated flow, rated pressure, tank capacity) are design settings on the inspector.', 'Every room passes: pressure at its most demanding area, the pump at 150 percent of rating or less, the tank for its hazard’s duration.'];
  DI.PUZ.push({
    id: 'p16', n: 16, name: 'One Supply, Many Rooms', kind: 'Nearly finished plant', design: true, w: 66, h: 30, parts: ['tank', 'epump', 'gate', 'check'],
    builds: ['Churn: the pump curve and the tank', 'Call 15: a pump bigger than the demand over-discharges and shortens the tank', 'Call 9: friction where the flow concentrates', 'Hyperscale: one supply sized for the worst demand'],
    question: 'Which room actually controls the design of a shared supply?',
    learn: ['The governing room is the one that needs the most from the plant, and it is often not the highest hazard', 'Three numbers can be governed by three rooms: the pump’s pressure, the pump’s flow, the tank’s duration', 'A dry room calculates 30 percent more heads: at the same density it needs more water than the wet room beside it', 'More pressure for one room is more water from every other room: buying pressure can make the tank govern', 'When one far room governs, changing that room’s pipe is often cheaper than sizing the whole plant around it'],
    variants: [
      { key: 'A', name: 'Campus A: three rooms', money: 60000, area: [2, 5, 50, 29], impPar: null, constraints: C16,
        decision: 'An office, a storage room at the highest density, and a dry dock at the same density as storage. The nameplates on order are the smallest in the catalogue. Size the pump and the tank once: for which room?',
        symptom: ['Nearly finished plant. A pump house serves three rooms on one main: an office, a storage room and an unheated dock on dry pipe. The fire pump and the tank are set with placeholder nameplates, the smallest the catalogue has.', 'Size the pump and the tank so that every room passes, as cheaply as you can, and name the room that controls the design.'],
        records: (S) => roomLines(S),
        build: (W, b) => site16(W, b, ROOMS16.A), prove: (S) => S.warp(2400),
        hints: [['Run the calc on every riser. Read the total demand at each riser and what fails: pressure, the pump’s flow, or the tank.', 41, 16],
          ['The storage room has the highest density and passes on the placeholder pump. The dock, same density, calculates 1,950 ft² because it is dry: it draws more than the 500 gpm pump can give at 150 percent.', 41, 16],
          ['Set the fire pump nameplate to 750 gpm at 80 psi and keep the 60,000 gal tank. A bigger or stronger pump makes the dock over-discharge and outrun the tank, and then the tank has to grow too.', 11, 12]],
        diag: { q: 'Which room controls the pump and the tank?', opts: [
          ['The dry dock: its design area is 30 percent larger, so it needs the most water', true, 'Yes. Same density as storage, 30 percent more heads flowing: the dock sets the pump’s flow and the tank.'],
          ['The storage room: it has the highest density', false, 'The dock has the same density over a larger area. The storage room passes on a pump the dock overloads.'],
          ['The office: it is the lowest hazard but on the far side', false, 'It needs the least water and passes three times over.'],
          ['All three equally', false, 'One room fails first on every pump you try: the dock.']] },
        goals: goals16.concat([{ t: 'The dock’s dry system set and up to pressure', ok: (S) => G.each(S, 'dock', (v, i, s) => s.state === 'dry' && s.set), hint: 'Let the compressor pump it up.' }]),
        cheap: { t: 'A 750 gpm, 80 psi pump on the same tank', steps: ['Fire pump nameplate: 750 gpm, 80 psi', 'Run every calc'], edit: (W) => plant16(W, 750, 80),
          lesson: 'About $5,000. Any pump with more flow or pressure makes the dock over-discharge, and the tank must then double.' },
        maint: { t: 'A 750 gpm, 100 psi pump and a 120,000 gal tank', steps: ['Fire pump nameplate: 750 gpm, 100 psi', 'Tank capacity: 120,000 gal'], edit: (W) => plant16(W, 750, 100, 120000),
          lesson: 'About $46,000: pressure headroom and two hours of water, so the next room on the main does not reopen the plant.' } },
      { key: 'B', name: 'Campus B: the far office', money: 80000, area: [2, 5, 64, 29], impPar: null, editSlack: 0.25, constraints: C16.concat(['Pipe may change as well as the plant.']),
        decision: 'A storage room near the pump house and a light-hazard office at the far end of a 3 in. tail main. One needs water, the other pressure. A pump that gives the office its pressure gives every head in the storage room more water too. Which room controls, and where is it cheapest to answer it?',
        symptom: ['Nearly finished plant. A pump house serves a storage room near it and an office 350 ft away at the end of a 3 in. main. The fire pump and the tank are set with placeholder nameplates, the smallest the catalogue has.', 'Make every room pass as cheaply as you can, and name the room that controls the design.'],
        records: (S) => roomLines(S),
        build: (W, b) => site16(W, b, ROOMS16.B), prove: () => {},
        hints: [['Run both calcs. The storage room overloads the 500 gpm pump; the office, light hazard, fails on pressure.', 55, 20],
          ['A pump strong enough for the office (150 psi) makes the storage room over-discharge, and then the tank has to double: about $56,000. Hover the tail main to the office while its calc is shown: that is where the office’s pressure goes.', 50, 18],
          ['Upsize the 3 in. tail main to the office (x 41 to 55, row 18) to 4 in., about $1,650. Then a 750 gpm, 100 psi pump on the 60,000 gal tank passes both rooms.', 50, 18]],
        diag: { q: 'Which room controls the design, and where is it cheapest to answer it?', opts: [
          ['The far office, and the answer is its tail main, not the plant', true, 'Yes. The office sets the pressure. Fix its 150 ft of 3 in. main and the plant only has to serve the storage room’s flow.'],
          ['The storage room: it is the highest hazard', false, 'It passes on a 750 gpm pump at 80 psi. The office does not.'],
          ['The office, so the pump must be sized for it', false, 'A pump that gives the office its pressure makes the storage room over-discharge, and then the tank governs: about $56,000 in all.'],
          ['The tank', false, 'The tank is enough for both rooms once nobody over-discharges.']] },
        goals: goals16,
        cheap: { t: '4 in. tail main and a 750 gpm, 100 psi pump', steps: ['Main tool at 4 in. over the tail main to the office (x 41 to 55)', 'Fire pump nameplate: 750 gpm, 100 psi', 'Run both calcs'], edit: (W) => { resize(W, row(18, 41, 55), 6); plant16(W, 750, 100); },
          lesson: 'About $11,650, and the office passes with under one percent to spare. Sizing the plant for the office instead costs about $56,000: a 150 psi pump and a doubled tank.' },
        maint: { t: '6 in. tail main and a 750 gpm, 100 psi pump', steps: ['Main tool at 6 in. over the tail main to the office', 'Fire pump nameplate: 750 gpm, 100 psi'], edit: (W) => { resize(W, row(18, 41, 55), 7); plant16(W, 750, 100); },
          lesson: 'About $3,600 more for five percent at the office, without raising the pressure on the storage room’s heads.' } },
    ],
  });
})();
