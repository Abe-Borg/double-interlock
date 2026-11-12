// Field calls 1-4: The Narrow Neck, Facing the Wrong Way, The Last Row, Pressure Without Supply.
// Each variant changes something that matters (where the fault is, the supply, the layout or what else is going on),
// not just the budget. Coordinates are tiles of the variant's own map. See puz.js for the shape of a puzzle.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const G = DI.G, PZ = DI.PZ;
  // small edit helpers, shared with puz2.js (the solutions and the tests use them)
  const E = DI.PZE = {
    resize(W, x, y, size) { const k = W.k(x, y); W.pd[k] = size + 1; W.ver++; },
    turn(W, x, y) { const p = W.at(x, y); if (p) { p.rot = (p.rot + 2) % 4; W.ver++; } },
    cap(W, x, y, south, on) { W.setCut(x, y, !!south, on ? 1 : 0); },
    kind(W, x, y, kind) { W.pk[W.k(x, y)] = kind; W.ver++; },
    gate(W, x, y, rot, wire) { W.erasePipe(x, y); const g = W.addPart('gate', x, y, rot); if (g && wire) W.wire(W.byType('panel')[0].id, g.id); return g; },
    wire(W, x, y) { const p = W.at(x, y); if (p) W.wire(W.byType('panel')[0].id, p.id); },
    fitSwitch(W, x, y) { const p = W.at(x, y); if (p) { p.p.sw = 1; W.ver++; } },
    erase(W, x, y) { const p = W.at(x, y); if (p) W.removePart(p.id); W.erasePipe(x, y); },
  };
  DI.PUZ_KEYS.gate = ['sw'];

  // ---------- the pump site (the contract 3 site): a weak city main feeding the storage building's wet system, and
  // the pump house of contract 4: tank, electric fire pump, discharge check valve, jockey pump, test header.
  //   tank (6,12) -> 8 in. suction (7..10,12) -> pump (11,12) -> (12..13,12) -> check (14,12) -> discharge (15..19,12)
  //   -> (19,13..17) -> city main (row 18) -> riser feed (24,13..17) -> control valve (27,13), wet riser (28,13)
  //   jockey: suction tee (9,11..10) -> jockey (11,10) -> check (14,10) -> (15,10..11) -> discharge (15,12)
  //   test header line: tee (17,12) -> (17,13..15) -> test header (17,16)
  const c3 = () => DI.SCEN.find((s) => s.id === 'c3');
  const pumpSite = (W, b) => { c3().build(W); const pn = W.byType('panel')[0], o = DI.pumpHouse(b, pn); o.ep.p.orig = 1; return o; };
  const leak = (S) => { S.leaks.push({ k: S.W.k(20, 18), K: 0.012 }); S.dirty = true; };
  const PUMP_AREA = [3, 8, 30, 19];
  const pump = (S) => S.W.byType('epump')[0];
  const flowTest = (S) => { const p = pump(S); DI.startTest(S, 'pump', p.id); S.warp(420); };
  const flowOk = (S) => { const p = pump(S), r = p && PZ.since(S, 'pump', p.id); return !!r && r.pass; };

  // ---------- the office building: city tap, yard valve, backflow preventer, riser control valve, wet riser, panel,
  // a 4 in. feed main to a 3 in. cross main, and 1 1/2 in. branch lines both sides.
  //   city (0,12) -> (1,12) -> yard valve (2,12) -> (3,12) -> backflow (4,12) -> control valve (5,12) -> riser (6,12)
  //   feed main (7..19,12) -> cross main (20,3..20) -> branch lines west (8..19) and east (21..33), rows 3..20
  const OFFICE_AREA = [0, 2, 34, 21];
  const office = (W, b, o) => {
    o = o || {};
    W.addRoom('riser', 3, 9, 5, 6).exempt = true; W.addRoom('office', 8, 3, 26, 18);
    b.p('city', 0, 12, 0, Object.assign({ stat: 80, resid: 66, flow: 1500, fixed: true }, o.city || {})); b.h(1, 1, 12, 7);
    const yard = b.p('gate', 2, 12, 0, Object.assign({ label: 'Yard PIV' }, o.yard || {})); b.h(3, 3, 12, 7);
    b.p('bfp', 4, 12); const g = b.p('gate', 5, 12), r = b.p('wetv', 6, 12);
    b.h(7, 7, 12, 6); b.h(8, 19, 12, 6, true); b.v(20, 3, 20, 5, true);
    b.grid(8, 3, 19, 20, 2, 1); b.grid(21, 3, 33, 20, 2, 1);
    const pn = b.p('panel', 4, 10); b.wire(pn, g); if (!o.noFlowWire) b.wire(pn, r);
    return { yard, g, r, pn };
  };
  const riser = (S) => S.W.at(6, 12);
  const drainTest = (S, id) => { DI.startTest(S, 'drain', id); S.warp(60); };

  // =====================================================================================================
  DI.PUZ.push({
    id: 'p1', n: 1, name: 'The Narrow Neck', kind: 'Inherited installation', w: 60, h: 32, parts: ['gate', 'check', 'panel'],
    question: 'Where is the water being choked?',
    learn: ['Pipe size sets friction: halve the diameter and the loss at the same flow goes up about thirty times', 'Read a flow test: churn proves the pump, the 150% point proves the pipe around it', 'Hover a pipe while it flows: the velocity jumps at a restriction', 'Fix the fault, not the symptom: one tile, not a new pump'],
    variants: [
      { key: 'A', name: 'Site A: 1,000 gpm pump', money: 6000, area: PUMP_AREA,
        symptom: ['Inherited installation. The annual fire pump flow test failed: the pump never got past about 940 gpm, and the 150% point was never reached. The pump was rebuilt last year and its curve was good on the bench.', 'One short piece of pipe was put in the wrong size during that rebuild. Find it and fix it with the fewest edits, then prove the pump.'],
        records: ['Last annual test: 100% point 918 gpm, 150% point 936 gpm. Churn 120 psi net (rated 100 psi, churn limit 140).'],
        build(W, b) { pumpSite(W, b); E.resize(W, 16, 12, 3); }, setup: leak,
        hints: [['Start at the pump house. The pump itself made full churn pressure, so look at the pipe the water has to pass through on its way to the test header.', 13, 12],
          ['Run the flow test and, at the 150% step, hover each pipe tile between the pump and the test header tee. A restriction shows as a jump in velocity (ft/s) and a drop in pressure across one tile.', 15, 12],
          ['The tile just past the jockey line tee, two east of the discharge check valve, is 2 in. on an 8 in. discharge. Pick the 8 in. size and drag the Main tool (1) over that one tile.', 16, 12]],
        diag: { q: 'Why does the pump stall below its rated flow?', opts: [
          ['The pump is worn and cannot make its rated pressure', false, 'Churn was 120 psi net, exactly 120% of the 100 psi rating. A worn impeller loses pressure at churn too.'],
          ['One tile of the pump discharge is 2 in. pipe', true, 'Yes. At 900 gpm a 2 in. tile loses the whole margin the pump has; the flow stalls where pump pressure equals that loss.'],
          ['The tank is too small for the test', false, 'The level hardly moved in the test. Tank size sets how long the pump can run, not how much it can deliver.'],
          ['The test header does not have enough hose valves open', false, 'The test keeps opening the hose valves (up to 12) until it reaches the target flow. It ran out of pressure first.']] },
        goals: [{ t: 'Fire pump flow test passes at churn, 100% and 150%', ok: flowOk, hint: 'Select the pump and run the flow test after the repair.' },
          { t: 'Storage building hydraulic calc passes', ok: (S) => G.calcOk(S, 'stor'), hint: 'Select the wet riser and run the calc.' }],
        prove: (S) => flowTest(S),
        cheap: { t: 'Resize the one tile', steps: ['Drag the 8 in. Main tool over the 2 in. tile', 'Run the flow test again'], edit: (W) => E.resize(W, 16, 12, 8),
          lesson: 'One tile, a few hundred dollars. The pump was never the problem.' },
        maint: { t: 'Resize it and add a supervised discharge valve', steps: ['Resize the 2 in. tile to 8 in.', 'Put a control valve on the discharge after the test header tee and wire its tamper switch to the panel', 'Run the flow test again'],
          edit: (W) => { E.resize(W, 16, 12, 8); E.gate(W, 18, 12, 0, true); },
          lesson: 'A supervised valve between the test header tee and the system lets the next crew test or service the pump with the building isolated, and the panel knows the moment it is closed. Suction and discharge valves on a fire pump are NFPA 20 practice.' } },
      { key: 'B', name: 'Site B: stronger pump, same tank', money: 6000, area: PUMP_AREA,
        symptom: ['Inherited installation. The pump was upgraded to 120 psi. On its flow test it made the flow, but the suction gauge went below zero at the 150% point and the test failed. The tank was full the whole time.', 'One short piece of pipe is the wrong size. Find it and fix it with the fewest edits, then prove the pump.'],
        records: ['Pump nameplate 1,000 gpm at 120 psi. Tank 120,000 gal, full.', 'Flow test: suction 14 psi at churn, 0 psi at 100%, -16 psi at 150%.'],
        build(W, b) { const o = pumpSite(W, b); o.ep.p.psi = 120; o.ep.p.start = 115; const j = W.byType('jockey')[0]; j.p.psi = 140; j.p.start = 130; j.p.stop = 140; E.resize(W, 8, 12, 5); }, setup: leak,
        hints: [['The suction gauge is the clue: something between the tank and the pump is starving it.', 8, 12],
          ['Run the flow test and hover the suction pipe from the tank to the pump at the 150% step. Velocity in a suction pipe should stay low; one tile will read several times higher than its neighbours.', 9, 12],
          ['The tile next to the tank nozzle is 3 in. on an 8 in. suction line. Drag the 8 in. Main tool over it.', 8, 12]],
        diag: { q: 'Why does the suction collapse during the test?', opts: [
          ['The tank is too small', false, 'The tank stayed full. Its size sets duration, not how fast water can reach the pump.'],
          ['The jockey pump is stealing the suction', false, 'The jockey pump makes up a 15 gpm leak. It is off during the test.'],
          ['One tile of the suction pipe is 3 in.', true, 'Yes. The friction through that tile at 1,500 gpm is more than the tank head, so the gauge falls below zero.'],
          ['The pump is oversized for the site', false, 'A pump draws what the system asks for. The calc passes with this pump once its suction is sized right.']] },
        goals: [{ t: 'Fire pump flow test passes, suction positive at 150%', ok: flowOk, hint: 'Select the pump and run the flow test after the repair.' },
          { t: 'Storage building hydraulic calc passes', ok: (S) => G.calcOk(S, 'stor'), hint: 'Select the wet riser and run the calc.' }],
        prove: (S) => flowTest(S),
        cheap: { t: 'Resize the one tile', steps: ['Drag the 8 in. Main tool over the 3 in. suction tile', 'Run the flow test again'], edit: (W) => E.resize(W, 8, 12, 8), lesson: 'Suction pipe is sized for low velocity: one small tile undoes it.' },
        maint: { t: 'Resize it and add a supervised suction valve', steps: ['Resize the suction tile to 8 in.', 'Put a control valve on the suction near the tank and wire its tamper switch', 'Run the flow test again'],
          edit: (W) => { E.resize(W, 8, 12, 8); E.gate(W, 10, 12, 0, true); },
          lesson: 'A supervised suction valve lets the pump be serviced without draining the tank, and the panel shows when it is shut. NFPA 20 practice.' } },
      { key: 'C', name: 'Site C: the pump tests fine', money: 6000, area: PUMP_AREA,
        symptom: ['Inherited installation. The fire pump passed its flow test last month. The storage building hydraulic calc still comes up short, and the sprinkler contractor says the pump must be too small.', 'One short piece of pipe is the wrong size. Find it and fix it with the fewest edits. The pump stays.'],
        records: ['Flow test last month: PASS at churn, 100% and 150%. Storage building calc: FAIL, the far branch line is short of its minimum flow.'],
        build(W, b) { pumpSite(W, b); E.resize(W, 24, 15, 2); }, setup: (S) => { leak(S); flowTest(S); S.warp(60); },
        hints: [['The pump passed, so look past the test header: the water has to travel from the pump to the storage riser.', 24, 16],
          ['Select the wet riser and run the calc, then hover the pipe from the city main up to the riser while the calc is shown. One tile carries the whole demand at a far higher velocity.', 24, 15],
          ['A tile of the riser feed, between the city main and the riser room, is 1 1/2 in. on a 6 in. line. Drag the 6 in. Main tool over it.', 24, 15]],
        diag: { q: 'Why does the calc fail when the pump tests fine?', opts: [
          ['The pump is too small for the building', false, 'The pump passed its 150% point. It can deliver; the water cannot get to the building.'],
          ['The flow test was done wrong', false, 'The test flows through the header, which sits before the restriction. That is why it passes.'],
          ['One tile of the riser feed is 1 1/2 in. pipe', true, 'Yes. The test header tee is upstream of it, so the pump test never sees it; the building does.'],
          ['The branch lines in the building are too small', false, 'The same branch lines pass the calc once the feed is right.']] },
        goals: [{ t: 'Storage building hydraulic calc passes', ok: (S) => G.calcOk(S, 'stor'), hint: 'Select the wet riser and run the calc after the repair.' }],
        prove: () => {},
        cheap: { t: 'Resize the one tile', steps: ['Drag the 6 in. Main tool over the 1 1/2 in. tile of the riser feed', 'Run the calc again'], edit: (W) => E.resize(W, 24, 15, 7), lesson: 'A passing pump test proves the pump and the pipe up to the test header, nothing further.' },
        maint: { t: 'Resize it and add a supervised valve on the riser feed', steps: ['Resize the tile to 6 in.', 'Add a control valve on the riser feed at the city main and wire its tamper switch', 'Run the calc again'],
          edit: (W) => { E.resize(W, 24, 15, 7); E.gate(W, 24, 14, 3, true); },
          lesson: 'The building can then be isolated at the main for work on the feed without shutting the pump house, and the panel sees it. A valve costs some friction: the calc still passes.' } },
    ],
  });

  // =====================================================================================================
  DI.PUZ.push({
    id: 'p2', n: 2, name: 'Facing the Wrong Way', kind: 'Nearly finished plant', w: 60, h: 32, parts: ['gate', 'check', 'epump', 'panel'],
    question: 'Why can the pump not draw water from a full tank?',
    learn: ['A tank that stays full during a flow test is a clue: the water is not coming from it', 'Every inline part has a direction: the glyph points the way the water goes', 'A test blank left in a flange after a hydrostatic test is invisible from outside: look at the joints', 'Select a part and use Turn end for end to reverse it in place'],
    variants: [
      { key: 'A', name: 'Site A: new pump set', money: 4000, area: PUMP_AREA,
        symptom: ['Nearly finished plant. The new fire pump was set last week. The tank is full and the pump runs, but on its acceptance flow test the suction gauge collapses and the flow meter reads nothing.', 'One component is facing the wrong way or is disconnected. Find it and fix it with the fewest edits.'],
        records: ['Acceptance test: churn 120 psi net, 100% point 0 gpm, suction below zero. Tank level unchanged.'],
        build(W, b) { pumpSite(W, b); E.turn(W, 11, 12); }, setup: leak,
        hints: [['The tank level never moved during the test, so no water left the tank. Look at the path from the tank nozzle to the pump.', 9, 12],
          ['Select each inline part on that path and look at its glyph: the arrow and the pump volute show the direction of flow. Compare with the jockey pump, which works.', 11, 12],
          ['The fire pump is installed end for end: its suction faces the system and its discharge faces the tank. Select it and press Turn end for end.', 11, 12]],
        diag: { q: 'Why does the suction collapse?', opts: [
          ['The tank suction valve is closed', false, 'There is no valve on this suction line. The way is open to the pump.'],
          ['The fire pump is installed end for end', true, 'Yes. Its suction side faces the discharge check valve, which will not pass water backwards, so the pump pulls against a closed door.'],
          ['The tank is empty and the gauge is wrong', false, 'The tank inspector reads it full, and the level did not move during the test.'],
          ['The pump is too big for an 8 in. suction', false, 'The same pump and suction pass the test once the pump faces the right way.']] },
        goals: [{ t: 'Fire pump flow test passes at churn, 100% and 150%', ok: flowOk, hint: 'Run the flow test after the repair.' }, { t: 'The original fire pump is still in service', ok: (S) => S.W.byType('epump').some((p) => p.p.orig), hint: 'Turn it, do not replace it.' }],
        prove: (S) => flowTest(S),
        cheap: { t: 'Turn the pump end for end', steps: ['Select the pump and press Turn end for end', 'Run the flow test again'], edit: (W) => E.turn(W, 11, 12), lesson: 'No new parts: the same pump the right way round.' },
        maint: { t: 'Turn it and add supervised valves both sides', steps: ['Turn the pump end for end', 'Add a control valve on the suction and one on the discharge, both wired to the panel'], edit: (W) => { E.turn(W, 11, 12); E.gate(W, 10, 12, 0, true); E.gate(W, 13, 12, 0, true); },
          lesson: 'With the pump between two supervised valves it can come out for service without draining anything, and a closed valve is never a surprise.' } },
      { key: 'B', name: 'Site B: after the hydrostatic test', money: 4000, area: PUMP_AREA,
        symptom: ['Nearly finished plant. The suction line was hydrostatically tested last week. The tank is full and the pump runs, but on its acceptance flow test the suction gauge collapses and no flow is recorded.', 'One component is facing the wrong way or is disconnected. Find it and fix it with the fewest edits.'],
        records: ['Hydrostatic test of the suction line: 200 psi for 2 h, passed. Test blanks installed at the flanges.'],
        build(W, b) { pumpSite(W, b); E.cap(W, 10, 12, false, true); }, setup: leak,
        hints: [['The tank level never moved during the test, so no water left the tank. Look at the path from the tank nozzle to the pump.', 9, 12],
          ['Hover the suction pipe during the test: upstream of the blockage the pressure is the tank head, downstream it is below zero. The fault sits on a joint, not a tile. Caps show as a short bar across a joint.', 10, 12],
          ['A test blank (a cap) was left in the flange between the suction pipe and the pump inlet. Use the Cap tool (6) on that joint to remove it.', 10, 12]],
        diag: { q: 'Why does the suction collapse?', opts: [
          ['A test blank was left in the suction flange at the pump', true, 'Yes. The hydrostatic test blanks were never pulled: the pump inlet is sealed off from the tank.'],
          ['The fire pump is installed end for end', false, 'Look at the pump glyph: its suction faces the tank.'],
          ['The tank vent is blocked', false, 'A blocked vent pulls a tank down slowly over a long draw. Here no water left the tank at all.'],
          ['The jockey pump is drawing all the suction', false, 'The jockey runs off the same line and works; it is off during the test.']] },
        goals: [{ t: 'Fire pump flow test passes at churn, 100% and 150%', ok: flowOk, hint: 'Run the flow test after the repair.' }, { t: 'The original fire pump is still in service', ok: (S) => S.W.byType('epump').some((p) => p.p.orig), hint: '' }],
        prove: (S) => flowTest(S),
        cheap: { t: 'Pull the test blank', steps: ['Cap tool (6) on the joint at the pump inlet', 'Run the flow test again'], edit: (W) => E.cap(W, 10, 12, false, false), lesson: 'One joint, no cost.' },
        maint: { t: 'Pull it and add a supervised suction valve', steps: ['Remove the cap at the pump inlet', 'Add a control valve on the suction and wire its tamper switch'], edit: (W) => { E.cap(W, 10, 12, false, false); E.gate(W, 10, 12, 0, true); },
          lesson: 'Next time the line is opened, the valve closes it instead of a blank, and the panel shows it closed until it is reopened.' } },
      { key: 'C', name: 'Site C: two symptoms', money: 4000, area: PUMP_AREA,
        symptom: ['Nearly finished plant. Two complaints from the night shift: the fire pump runs all night, and when they tried the flow test the suction gauge collapsed. The tank is full.', 'One fault explains both. Find it and fix it with the fewest edits.'],
        records: ['Night log: electric fire pump RUNNING since 22:10. Jockey pump runs continuously. Tank level unchanged.'],
        build(W, b) { pumpSite(W, b); E.cap(W, 7, 12, false, true); }, setup: (S) => { leak(S); S.warp(600); },
        hints: [['Both pumps take suction from the same line. If neither can draw water, the fire pump starts on falling pressure and cannot stop it. Look at the tank nozzle.', 7, 12],
          ['Hover the suction line: the tile at the tank reads the tank head, the rest reads below zero. The fault is on a joint.', 8, 12],
          ['A test blank (a cap) sits in the flange at the tank nozzle, upstream of both pump suctions. Cap tool (6) on that joint removes it. Stop the fire pump afterwards.', 7, 12]],
        diag: { q: 'What one fault explains both symptoms?', opts: [
          ['The jockey pump settings overlap the fire pump', false, 'The settings are in order (jockey 115 / 125, fire pump 100). The jockey runs and still cannot hold pressure.'],
          ['A test blank in the tank nozzle starves both pumps', true, 'Yes. Neither pump can draw from the tank, so the jockey cannot make up the leak, the fire pump starts, and it cannot deliver either.'],
          ['The fire pump is installed end for end', false, 'Its glyph faces the right way.'],
          ['The underground leak is too big for the jockey pump', false, 'The jockey makes up that leak easily once it has water to pump.']] },
        goals: [{ t: 'Fire pump flow test passes at churn, 100% and 150%', ok: flowOk, hint: 'Run the flow test after the repair.' }, { t: 'Fire pump back in AUTO and stopped', ok: (S) => S.W.byType('epump').every((p) => p.p.mode === 'auto' && p.p.spd === 0), hint: 'Select the pump and press Stop pump once the jockey holds pressure.' }],
        prove: (S) => { flowTest(S); const p = pump(S); p.p.on = false; S.warp(120); },
        cheap: { t: 'Pull the test blank', steps: ['Cap tool (6) on the joint at the tank nozzle', 'Stop the fire pump', 'Run the flow test'], edit: (W) => E.cap(W, 7, 12, false, false), lesson: 'One joint, both symptoms gone.' },
        maint: { t: 'Pull it and add a supervised valve at the tank', steps: ['Remove the cap at the tank nozzle', 'Add a control valve right after the nozzle, wired to the panel'], edit: (W) => { E.cap(W, 7, 12, false, false); E.gate(W, 8, 12, 0, true); },
          lesson: 'A supervised tank valve is what isolates the line for the next hydrostatic test, and the panel shows it until it is reopened.' } },
    ],
  });

  // =====================================================================================================
  const coverOk = (S) => G.covered(S, ['office']) && !!S.rv && !S.rv.some((f) => f.sev === 'fail');
  const lastRowGoals = [{ t: 'Every head is on the riser and plan review finds no code failures', ok: coverOk, hint: 'Open Review: it lists heads that are not connected to any riser.' },
    { t: 'Hydraulic calc passes', ok: (S) => G.calcOk(S, 'office'), hint: 'Select the riser and run the calc.' }];
  // tie the far ends of the branch lines into a main (a gridded wet system): x is the column, rows y0..y1
  const gridTie = (W, x, y0, y1) => { for (let y = y0; y <= y1; y++) { const k = W.k(x, y); if (W.pd[k]) W.pk[k] = 0; } W.ver++; };
  DI.PUZ.push({
    id: 'p3', n: 3, name: 'The Last Row', kind: 'Nearly finished plant', w: 36, h: 23, parts: ['gate'],
    question: 'Where is the remote branch line cut off?',
    learn: ['Branch lines join only end to end and to a main beside them: one tile laid the wrong way breaks the line', 'A cap is a joint, not a tile', 'Hover a pipe: a line that is not on the riser reads no pressure', 'On a wet system the far ends of the branch lines can be tied into a grid; dry and preaction systems cannot'],
    variants: [
      { key: 'A', name: 'Office A: north-east corner', money: 3000, area: OFFICE_AREA,
        symptom: ['Nearly finished plant. The contractor reports the office wet system complete and every line flushed. At the walk-down one remote branch line has heads with no water behind them.', 'Find the broken connection and fix it with the fewest edits.'],
        records: ['Plan review: one room with heads not connected to any riser.'],
        build(W, b) { office(W, b); E.cap(W, 20, 3, false, true); },
        hints: [['Open Review and click the finding: it points at the office. The heads that are not on the riser are on one branch line.', 26, 3],
          ['Hover the branch lines in the far corners. A line on the riser reads the system pressure; the cut-off line reads 0. Then look at where that line meets the cross main.', 21, 3],
          ['The top row east of the cross main has a cap on its first joint, between the cross main and the branch line. Cap tool (6) on that joint removes it.', 20, 3]],
        diag: { q: 'Where is the remote line cut off?', opts: [
          ['The cross main is undersized', false, 'An undersized main gives low pressure, not none. The rest of the lines read full pressure.'],
          ['A cap on the joint between the cross main and the top east branch line', true, 'Yes. One capped joint, and the whole line is on no riser.'],
          ['The branch line is laid in the wrong direction', false, 'Its tiles run east-west, like the line below it.'],
          ['The riser control valve is partly closed', false, 'Every other line reads full pressure through the same valve.']] },
        goals: lastRowGoals, prove: () => {},
        cheap: { t: 'Remove the cap', steps: ['Cap tool (6) on the joint'], edit: (W) => E.cap(W, 20, 3, false, false), lesson: 'One joint, no cost.' },
        maint: { t: 'Remove it and grid the east lines', steps: ['Remove the cap', 'Lay the far end column of the east branch lines as a main (Main tool over them), so every line is fed from both ends'], edit: (W) => { E.cap(W, 20, 3, false, false); gridTie(W, 33, 3, 20); },
          lesson: 'A gridded wet system feeds each line from both ends: one lost joint no longer leaves a line dry, and the remote area calculates better. Not allowed on dry or preaction pipe.' } },
      { key: 'B', name: 'Office B: south-west corner', money: 3000, area: OFFICE_AREA,
        symptom: ['Nearly finished plant. The contractor reports the office wet system complete. At the walk-down one remote branch line has heads with no water behind them, and the drawings show it piped like every other line.', 'Find the broken connection and fix it with the fewest edits.'],
        records: ['Plan review: one room with heads not connected to any riser.'],
        build(W, b) { office(W, b); E.kind(W, 19, 20, 2); },
        hints: [['Open Review and click the finding. Then look at the bottom row of the west side.', 14, 20],
          ['Hover the bottom west branch line: it reads 0 psi, all the way to the cross main. Zoom in on the last tile before the cross main and compare its line direction with its neighbours.', 19, 20],
          ['The tile next to the cross main on the bottom west row is laid north-south. A north-south branch tile does not join an east-west line or the main beside it. Erase it and lay it again east-west (Sprinkler tool, R flips the direction).', 19, 20]],
        diag: { q: 'Where is the remote line cut off?', opts: [
          ['A cap on the joint at the cross main', false, 'There is no cap on that joint.'],
          ['One tile at the start of the line is laid north-south', true, 'Yes. Branch lines join only end to end and to a main beside them; a north-south tile in an east-west line joins neither.'],
          ['The cross main does not reach the bottom row', false, 'The cross main runs to row 20; the east line on that row is on the riser.'],
          ['The heads on that line are the wrong K-factor', false, 'A head does not stop water reaching the pipe it sits on.']] },
        goals: lastRowGoals, prove: () => {},
        cheap: { t: 'Re-lay the one tile', steps: ['Erase the tile and lay it again east-west'], edit: (W) => E.kind(W, 19, 20, 1), lesson: 'One tile.' },
        maint: { t: 'Re-lay it and grid the west lines', steps: ['Re-lay the tile east-west', 'Lay the far end column of the west branch lines as a main'], edit: (W) => { E.kind(W, 19, 20, 1); gridTie(W, 8, 3, 20); },
          lesson: 'Gridding the west side feeds the bottom line from its other end too. On a wet system that is a choice; on dry pipe it is not allowed.' } },
      { key: 'C', name: 'Office C: the whole last row', money: 3000, area: OFFICE_AREA,
        symptom: ['Nearly finished plant. At the walk-down the last row, both sides of the cross main, has no water. The head of the cross main on that row is dry too.', 'Find the broken connection and fix it with the fewest edits.'],
        records: ['Plan review: one room with heads not connected to any riser.'],
        build(W, b) { office(W, b); E.cap(W, 20, 19, true, true); },
        hints: [['Both halves of the last row are dry, so the break is on what feeds both: the cross main.', 20, 19],
          ['Hover the cross main tile by tile from the feed main southwards. The pressure drops to 0 between two tiles.', 20, 19],
          ['The cross main has a cap on the joint between its last two tiles (rows 19 and 20). Cap tool (6) on that joint removes it.', 20, 20]],
        diag: { q: 'Where is the last row cut off?', opts: [
          ['Each half of the row has its own break', false, 'Two breaks at once is unlikely, and the cross main tile on that row is dry too.'],
          ['A cap on the cross main between the last two rows', true, 'Yes. Everything past that joint is on no riser: the last cross main tile and both lines it feeds.'],
          ['The last row is laid north-south', false, 'Its tiles run east-west like the others.'],
          ['The cross main is too small to reach the last row', false, 'Size limits flow; it does not cut the water off.']] },
        goals: lastRowGoals, prove: () => {},
        cheap: { t: 'Remove the cap', steps: ['Cap tool (6) on the joint'], edit: (W) => E.cap(W, 20, 19, true, false), lesson: 'One joint.' },
        maint: { t: 'Remove it and grid both sides', steps: ['Remove the cap', 'Lay the far end columns of both sides as mains'], edit: (W) => { E.cap(W, 20, 19, true, false); gridTie(W, 8, 3, 20); gridTie(W, 33, 3, 20); },
          lesson: 'With both sides gridded, a lost joint on the cross main still leaves every line fed from the other end.' } },
    ],
  });

  // =====================================================================================================
  // The main drain test is the proof: a static reading proves pressure, the residual (full flow pressure) proves supply.
  const drainOk = (id) => (S) => { const v = typeof id === 'function' ? id(S) : riser(S), r = v && PZ.since(S, 'drain', v.id); return !!r && r.pass; };
  // record a baseline main drain test (the riser's last annual test), as a record from before the call
  const baseline = (S, id) => { drainTest(S, id); const r = DI.lastResult(S, 'drain', id); if (r) { r.name += ' (last annual test)'; r.t = 0; } S.warp(120); };
  const PUMP_RISER = (S) => S.W.at(28, 13);
  const lastAnnual = (S, v) => { const r = v && DI.lastResult(S, 'drain', v.id); return r ? 'Last annual main drain test: static ' + DI.fmt(r.lines.length && +r.lines[0].replace(/[^0-9.]/g, '')) + ' psi, full flow (residual) ' + DI.fmt(r.val) + ' psi.' : 'No main drain test on record.'; };
  DI.PUZ.push({
    id: 'p4', n: 4, name: 'Pressure Without Supply', kind: 'Records-only investigation', w: 36, h: 23, parts: ['gate', 'panel'],
    question: 'Can this system actually deliver water, and if not, what stops it?',
    learn: ['A gauge behind a closed valve holds its last pressure: static pressure proves nothing about supply', 'The main drain test is the proof: the residual (full flow pressure) against the baseline', 'A drop of more than 10 percent in full flow pressure is a reason to look upstream, not an automatic fail (NFPA 25)', 'A valve without a tamper switch, or a seal, can be shut and nobody knows'],
    variants: [
      { key: 'A', name: 'Office A: after the street work', money: 2000, area: OFFICE_AREA,
        symptom: ['Records-only investigation. The city did street work last week. The facilities manager says the sprinkler system is fine: the riser gauge reads 80 psi, as it always has, and the panel is quiet.', 'Prove the system can actually supply flowing water. If it cannot, find out why and put it right.'],
        records: (S) => [lastAnnual(S, riser(S)), 'City work order: valve operated at the property line, 9 days ago.'],
        build(W, b) { office(W, b, { yard: { sw: 0 } }); }, setup: (S) => { const r = riser(S); baseline(S, r.id); const y = S.W.at(2, 12); y.p.target = 0; S.warp(60); },
        hints: [['The riser gauge reads the pressure trapped in the pipe. To know whether water can flow, make it flow: the main drain test on the riser.', 6, 12],
          ['Run the main drain test from the riser. Compare its full flow (residual) reading with the last annual test (Tests). If it falls away, use Check the valves upstream on the riser.', 6, 12],
          ['The yard post indicator valve at the property line is shut. It has no tamper switch, so the panel could not see it. Select it and open it, then run the main drain test again.', 2, 12]],
        diag: { q: 'What stops the water?', opts: [
          ['Nothing: the gauge reads normal', false, 'The gauge reads the water trapped behind a closed valve. The main drain test shows the residual collapsing.'],
          ['The backflow preventer is stuck shut', false, 'The backflow preventer is downstream of the yard valve; with the yard valve open the test passes through it.'],
          ['The yard valve at the property line was left shut', true, 'Yes. The city closed it for the street work and never reopened it. Without a tamper switch nobody was told.'],
          ['The city main has lost pressure', false, 'The city main reads its normal static on the far side of the yard valve.']] },
        goals: [{ t: 'Main drain test passes on the riser (full flow pressure within 10 percent of the baseline)', ok: drainOk(), hint: 'Riser → Tests → Main drain test.' }, { t: 'Every control valve fully open', ok: PZ.allOpen, hint: '' }],
        prove: (S) => drainTest(S, riser(S).id),
        cheap: { t: 'Open the yard valve', steps: ['Run the main drain test: the residual collapses', 'Check the valves upstream', 'Open the yard valve', 'Run the main drain test again'], op: (S) => DI.setGate(S, S.W.at(2, 12).id, 1), lesson: 'No edits, no cost: the fault was a valve position.' },
        maint: { t: 'Open it and supervise it', steps: ['Open the yard valve', 'Fit a tamper switch to it and wire it to the panel', 'Run the main drain test again'], edit: (W) => { E.fitSwitch(W, 2, 12); E.wire(W, 2, 12); }, op: (S) => DI.setGate(S, S.W.at(2, 12).id, 1),
          lesson: 'A supervised valve that is shut is a supervisory signal within seconds. NFPA 13 requires valves on water supply connections to be supervised (by switch, lock or seal): here the seal had been cut.' } },
      { key: 'B', name: 'Office B: after the repair', money: 2000, area: OFFICE_AREA,
        symptom: ['Records-only investigation. The backflow preventer was rebuilt last month. The riser gauge reads 80 psi and the panel is quiet. The insurer wants proof that the system still delivers.', 'Prove the system can actually supply flowing water. If it cannot, find out why and put it right.'],
        records: (S) => [lastAnnual(S, riser(S)), 'Backflow rebuild ticket: closed, "valves restored".'],
        build(W, b) { office(W, b, { yard: { sw: 0 } }); }, setup: (S) => { const r = riser(S); baseline(S, r.id); const y = S.W.at(2, 12); y.p.target = 0.1; S.warp(60); },
        hints: [['The gauge reads static pressure. Make water flow: the main drain test on the riser.', 6, 12],
          ['The full flow reading is well below the baseline, though not zero. Something upstream is partly shut. Use Check the valves upstream on the riser.', 6, 12],
          ['The yard valve was reopened only a few turns after the rebuild: about 10 percent open. Open it fully, then run the main drain test again.', 2, 12]],
        diag: { q: 'What holds the water back?', opts: [
          ['The new backflow preventer has a high loss', false, 'With the yard valve fully open the residual is back within 10 percent of the baseline, through the same backflow preventer.'],
          ['The yard valve was left only partly open', true, 'Yes. A partly open valve passes static pressure perfectly and chokes the flow. The ticket said "restored", not "fully open".'],
          ['The main drain itself is partly blocked', false, 'A blocked drain flows less water but reads a higher residual, not a lower one.'],
          ['The city supply has weakened', false, 'Static is unchanged at 80 psi, and the residual comes back once the yard valve is fully open.']] },
        goals: [{ t: 'Main drain test passes on the riser (full flow pressure within 10 percent of the baseline)', ok: drainOk(), hint: 'Riser → Tests → Main drain test.' }, { t: 'Every control valve fully open', ok: PZ.allOpen, hint: '' }],
        prove: (S) => drainTest(S, riser(S).id),
        cheap: { t: 'Open the yard valve fully', steps: ['Main drain test: residual well down', 'Check the valves upstream', 'Open the yard valve fully', 'Main drain test again'], op: (S) => DI.setGate(S, S.W.at(2, 12).id, 1), lesson: 'No edits, no cost.' },
        maint: { t: 'Open it fully and supervise it', steps: ['Open the yard valve fully', 'Fit a tamper switch and wire it to the panel'], edit: (W) => { E.fitSwitch(W, 2, 12); E.wire(W, 2, 12); }, op: (S) => DI.setGate(S, S.W.at(2, 12).id, 1),
          lesson: 'A tamper switch reports a valve that is off normal (here, below 80 percent open), not only one that is shut.' } },
      { key: 'C', name: 'Pump site: the jockey keeps it happy', money: 2000, area: PUMP_AREA, w: 60, h: 32, parts: ['gate', 'check', 'panel'],
        symptom: ['Records-only investigation. A storage building on a weak city main, boosted by a fire pump from a tank. The system gauge reads a steady 120 psi and the jockey pump cycles as it always has. The pump room was repainted last week.', 'Prove the storage system can actually supply flowing water. If it cannot, find out why and put it right.'],
        records: (S) => [lastAnnual(S, PUMP_RISER(S)) + ' The fire pump ran during it.', 'Painting contractor: "valves cycled and returned".'],
        build(W, b) { pumpSite(W, b); const g = E.gate(W, 10, 12, 0, false); g.p.sw = 0; }, setup: (S) => { leak(S); S.warp(200); baseline(S, PUMP_RISER(S).id); for (const p of S.W.byType('epump')) p.p.on = false; S.warp(200); const g = S.W.at(10, 12); g.p.target = 0; S.warp(120); },
        hints: [['The jockey pump has its own suction tee, so it can hold pressure on a starved fire pump. Make water flow: the main drain test on the storage riser.', 28, 13],
          ['During the test the fire pump starts, but the residual sits near the city pressure and the suction gauge on the fire pump falls. Use Check the valves upstream on the riser.', 11, 12],
          ['The fire pump suction valve, between the jockey suction tee and the pump, is shut. It has no tamper switch. Open it, then stop the fire pump and run the main drain test again.', 10, 12]],
        diag: { q: 'Why does the storage system not get its water?', opts: [
          ['The jockey pump is too small', false, 'The jockey only maintains pressure. It is the fire pump that should carry the flow.'],
          ['The fire pump suction valve was left shut', true, 'Yes. The jockey takes its suction upstream of that valve, so the gauge stays perfect while the fire pump has nothing to pump.'],
          ['The tank is empty', false, 'The tank reads full; the jockey is pumping from it.'],
          ['The discharge check valve is reversed', false, 'The check valve faces the system and passes the flow once the suction valve is open.']] },
        goals: [{ t: 'Main drain test passes on the storage riser', ok: drainOk(PUMP_RISER), hint: 'Riser → Tests → Main drain test.' }, { t: 'Every control valve fully open', ok: PZ.allOpen, hint: '' }],
        prove: (S) => { for (const p of S.W.byType('epump')) p.p.on = false; S.warp(60); drainTest(S, PUMP_RISER(S).id); },
        cheap: { t: 'Open the suction valve', steps: ['Main drain test: residual near city pressure', 'Check the valves upstream', 'Open the fire pump suction valve', 'Main drain test again'], op: (S) => DI.setGate(S, S.W.at(10, 12).id, 1), lesson: 'No edits, no cost.' },
        maint: { t: 'Open it and supervise it', steps: ['Open the suction valve', 'Fit a tamper switch and wire it to the panel'], edit: (W) => { E.fitSwitch(W, 10, 12); E.wire(W, 10, 12); }, op: (S) => DI.setGate(S, S.W.at(10, 12).id, 1),
          lesson: 'A pump suction valve is the textbook case for supervision: a pressure maintenance pump can hide it shut for years.' } },
    ],
  });
  // shared with puz2.js
  Object.assign(DI.PZ, { office, pumpSite, leak, flowTest, flowOk, PUMP_AREA, OFFICE_AREA });
})();
