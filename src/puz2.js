// Field calls 5-8: The Empty Test Header, The Alarm That Never Left, The Pump That Won't Sleep, Reset, Reset, Reset.
// The later variants combine ideas from the earlier calls: a closed valve on a test line (call 4), a test blank in a
// suction line (call 2), a trouble on the panel that is not the cause. See puz.js for the shape of a puzzle.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const G = DI.G, PZ = DI.PZ, E = DI.PZE;
  const pump = (S) => S.W.byType('epump')[0];
  const origPump = { t: 'The original fire pump is still in service', ok: (S) => S.W.byType('epump').some((p) => p.p.orig), hint: 'The pump is not the fault: repair the test arrangement.' };
  const flowGoal = { t: 'Fire pump flow test passes at churn, 100% and 150%', ok: PZ.flowOk, hint: 'Select the pump and run the flow test.' };
  // the test header line of the reference pump house: tee (17,12), pipe (17,13..15), header (17,16)
  const noHeader = (W) => { E.erase(W, 17, 16); for (let y = 13; y <= 15; y++) W.erasePipe(17, y); };
  const header = (W, valve) => { for (let y = 13; y <= 15; y++) W.setPipe(17, y, 7, 0); if (valve) E.gate(W, 17, 13, 1, true); W.addPart('testhdr', 17, 16, 1); };

  // =====================================================================================================
  DI.PUZ.push({
    id: 'p5', n: 5, name: 'The Empty Test Header', kind: 'Inherited installation', w: 60, h: 32, parts: ['gate', 'check', 'testhdr', 'panel'],
    question: 'Why does the flow test record almost no flow through a healthy pump?',
    learn: ['The flow test measures what goes through the pump, so the test header has to be fed from the pump discharge, after the check valve', 'A header piped from the suction, or from a small line, flows water that the pump never touched', 'A valve on a test line is part of the test arrangement: shut, it makes a good pump look dead (call 4)', 'Repair the arrangement, not the pump'],
    variants: [
      { key: 'A', name: 'Site A: a header that flows', money: 9000, area: PDI(),
        symptom: ['Inherited installation. The hose valves at the test header flow plenty of water, yet the flow test records almost nothing through the pump, and the tank level drops during the test. The owner has been quoted for a new pump.', 'Repair the test arrangement so the flow test passes. Do not replace the pump.'],
        records: ['Flow test: churn normal, 100% point 0 gpm through the pump, test header flowing about 2,000 gpm. Tank level down 3,000 gal.'],
        build(W, b) { PZ.pumpSite(W, b); noHeader(W); W.setPipe(8, 13, 7, 0); W.setPipe(8, 14, 7, 0); W.addPart('testhdr', 8, 15, 1); }, setup: PZ.leak,
        hints: [['Water leaving the test header is not proof it went through the pump. Follow the pipe from the test header back to where it tees in.', 8, 15],
          ['Run the flow test and compare the flow through the pump (select it) with the flow at the header (select it). They should be the same. Then see which side of the pump the header line joins.', 8, 13],
          ['The test header is teed off the suction line, between the tank and the pump: it flows tank water by gravity. Move it to the discharge, after the check valve (the stub at the tee south of the discharge line is where it belongs).', 17, 13]],
        diag: { q: 'Why does the pump record almost no flow?', opts: [
          ['The pump impeller is worn out', false, 'Churn is on the curve, and the pump passes once the header is on the discharge.'],
          ['The test header is piped from the suction side', true, 'Yes. It drains the tank around the pump: the header flows, the pump does not.'],
          ['The tank outlet is too small', false, 'The tank delivered about 2,000 gpm to the header through the same outlet.'],
          ['The hose valves at the header are too small', false, 'They flowed far more than the pump’s 150% point.']] },
        goals: [flowGoal, origPump], prove: PZ.flowTest,
        cheap: { t: 'Move the header to the discharge', steps: ['Erase the test header on the suction side', 'Pipe a line from the discharge tee down and put the header on it', 'Run the flow test'], edit: (W) => { E.erase(W, 8, 15); header(W, false); },
          lesson: 'Five edits. The suction stub stays as a dead end, which costs nothing and does no harm.' },
        maint: { t: 'Move it, remove the stub, valve the new line', steps: ['Remove the header and its stub from the suction', 'Pipe the new line from the discharge with a control valve wired to the panel, then the header'], edit: (W) => { E.erase(W, 8, 15); W.erasePipe(8, 14); W.erasePipe(8, 13); header(W, true); },
          lesson: 'No dead leg left on the suction, and a supervised valve on the test line lets the hose valves be serviced with the pump in service: the NFPA 20 arrangement.' } },
      { key: 'B', name: 'Site B: the small line', money: 9000, area: PDI(),
        symptom: ['Inherited installation. The flow test stalls at about 550 gpm whatever the hose valves do, on a 1,000 gpm pump that reached full churn pressure. The test header was moved during a renovation.', 'Repair the test arrangement so the flow test passes. Do not replace the pump.'],
        records: ['Flow test: churn normal, 100% and 150% points both about 557 gpm.'],
        build(W, b) { PZ.pumpSite(W, b); noHeader(W); W.setPipe(16, 10, 3, 0); W.addPart('testhdr', 17, 10, 0); }, setup: PZ.leak,
        hints: [['The pump makes its churn pressure, so look at the way from the pump to the hose valves.', 17, 10],
          ['Hover the line that feeds the test header during the test: its velocity is far higher than anything on the 8 in. discharge. Follow it back to where it tees in.', 16, 10],
          ['The header was re-piped off the 2 in. jockey pump discharge: the whole test flow runs backwards up a 2 in. line. Move the header to the 8 in. discharge, after the check valve.', 15, 10]],
        diag: { q: 'Why does the flow stall at about 550 gpm?', opts: [
          ['The test header is fed through the 2 in. jockey line', true, 'Yes. Even a good pump cannot push 1,500 gpm through 2 in. pipe.'],
          ['The pump is worn and loses pressure at flow', false, 'At 557 gpm the pump still makes 115 psi net, well above its curve: the pump is fine and the pipe is the limit.'],
          ['The jockey pump check valve is reversed', false, 'The jockey check valve faces the right way; water reaches the header through the pipe beside it.'],
          ['The test header needs more hose valves', false, 'The test opens up to 12; the flow stalled with the valves still opening.']] },
        goals: [flowGoal, origPump], prove: PZ.flowTest,
        cheap: { t: 'Move the header to the discharge', steps: ['Erase the header on the jockey line', 'Pipe a line from the discharge tee down and put the header on it', 'Run the flow test'], edit: (W) => { E.erase(W, 17, 10); header(W, false); }, lesson: 'Five edits; the 2 in. stub stays as a dead end.' },
        maint: { t: 'Move it, remove the stub, valve the new line', steps: ['Remove the header and the stub on the jockey line', 'Pipe the new line from the discharge with a supervised control valve, then the header'], edit: (W) => { E.erase(W, 17, 10); W.erasePipe(16, 10); header(W, true); },
          lesson: 'The jockey line goes back to doing one job, and the test line can be isolated without touching the pump.' } },
      { key: 'C', name: 'Site C: nothing at the header', money: 9000, area: PDI(),
        symptom: ['Inherited installation. On the flow test not a drop comes out of the test header. The pump reaches full churn pressure, the hose valves were replaced last year, and the owner has been quoted for a new pump.', 'Repair the test arrangement so the flow test passes. Do not replace the pump.'],
        records: ['Flow test: churn normal, 0 gpm at every step. Hose valves replaced last year.'],
        build(W, b) { PZ.pumpSite(W, b); const g = E.gate(W, 17, 14, 1, false); g.p.sw = 0; }, setup: (S) => { PZ.leak(S); const g = S.W.at(17, 14); g.p.target = 0; S.warp(30); },
        hints: [['Zero flow, full churn: the pump is pushing against something shut. Follow the test line from the header up to the discharge.', 17, 14],
          ['Hover the test line during the test: full pump pressure above one tile, nothing below it.', 17, 14],
          ['A control valve on the test header line is shut. It has no tamper switch, so the panel never showed it (call 4). Select it and open it.', 17, 14]],
        diag: { q: 'Why does nothing come out of the test header?', opts: [
          ['The new hose valves are seized', false, 'The test opens them; the line above them reads zero pressure.'],
          ['The pump is not turning', false, 'It reaches full churn pressure.'],
          ['A valve on the test header line is shut', true, 'Yes. An unsupervised valve on the test line, left shut after the hose valves were replaced.'],
          ['The discharge check valve is reversed', false, 'The jockey keeps system pressure through the same discharge line, and the check passes it.']] },
        goals: [flowGoal, origPump, { t: 'Every control valve fully open', ok: PZ.allOpen, hint: '' }], prove: PZ.flowTest,
        cheap: { t: 'Open the valve', steps: ['Open the valve on the test line', 'Run the flow test'], op: (S) => DI.setGate(S, S.W.at(17, 14).id, 1), lesson: 'No edits, no cost.' },
        maint: { t: 'Open it and supervise it', steps: ['Open the valve', 'Fit a tamper switch and wire it to the panel'], edit: (W) => { E.fitSwitch(W, 17, 14); E.wire(W, 17, 14); }, op: (S) => DI.setGate(S, S.W.at(17, 14).id, 1),
          lesson: 'Supervised, the next time it is left shut the panel shows it within seconds, before anyone books a pump replacement.' } },
    ],
  });
  function PDI() { return PZ.PUMP_AREA; }

  // =====================================================================================================
  const riser = (S) => S.W.at(6, 12);
  // the station has a waterflow from this riser that first appeared after the call came in
  const reached = (S) => { const r = riser(S), f = S.puz && S.puz.flags.stn; return !!r && !!f && f[r.id] >= S.puz.t0; };
  // the night event: somebody opened the inspector's test valve for two minutes (a real flow, not a test procedure)
  const night = (S) => { const r = riser(S); r.p.itc = 1; S.touch(); S.warp(150); r.p.itc = 0; S.touch(); S.warp(600); };
  const itc = (S) => { DI.startTest(S, 'itc', riser(S).id); S.warp(300); };
  const reset = (S) => { const pn = S.W.byType('panel')[0]; DI.panelReset(S, pn.id); S.warp(20); };
  const chan = (S, a, b) => { S.W.byType('panel')[0].p.chan = [a, b]; };
  const stnGoal = { t: 'An inspector’s test on the riser reaches the supervising station', ok: reached, hint: 'Run the inspector’s test from the riser and watch the event log for the station.' };
  DI.PUZ.push({
    id: 'p6', n: 6, name: 'The Alarm That Never Left', kind: 'Records-only investigation', w: 36, h: 23, parts: ['gate', 'panel'],
    question: 'Why did the waterflow alarm never reach the supervising station?',
    learn: ['Local means local: a flow switch that is not wired to a panel rings its gong and tells nobody', 'A panel can annunciate an alarm it cannot send: on a DACT, both lines down means nothing leaves', 'A trouble on the panel is not always the cause: one DACT line down still sends on the other', 'Prove it end to end: run the inspector’s test and see the station receive it'],
    variants: [
      { key: 'A', name: 'Office A: IP path', money: 1500, area: PZ.OFFICE_AREA,
        build(W, b) { PZ.office(W, b, { noFlowWire: true }); }, setup: night,
        symptom: ['Records-only investigation. At 02:14 the night guard heard the water motor gong on the office riser: somebody had opened the inspector’s test valve. The supervising station has no record of it, and no fire department was sent.', 'Find why the alarm never left the building, fix it with the fewest edits, and prove it with an inspector’s test.'],
        records: ['Guard log 02:14: water motor gong ringing at the office riser, about 2 minutes.', 'Supervising station: no signal from this account last night.'],
        hints: [['Start at the riser: what tells the panel that water is flowing?', 6, 12],
          ['Select the wet riser and read "Wired to". Then look at the event log line for last night’s waterflow: it says where the signal went.', 6, 12],
          ['The riser’s waterflow switch is not wired to the panel: the signal was local only. Wire tool (5): click the panel, then the riser. Then run the inspector’s test.', 4, 10]],
        diag: { q: 'Why did the alarm never leave?', opts: [
          ['The supervising station lost the signal', false, 'The panel never had it to send: the event log says local only.'],
          ['The waterflow switch on the riser is not wired to the panel', true, 'Yes. The gong is mechanical and rang; the switch had no wire to the panel.'],
          ['The water motor gong is broken', false, 'The guard heard it.'],
          ['The panel was dead on battery', false, 'The panel is alive and shows normal.']] },
        goals: [stnGoal], prove: itc,
        cheap: { t: 'Wire the flow switch', steps: ['Wire tool: panel, then the riser', 'Run the inspector’s test'], edit: (W) => E.wire(W, 6, 12), lesson: 'One wire.' },
        maint: { t: 'Wire it, and the yard valve too', steps: ['Wire the riser’s flow switch', 'Wire the yard valve’s tamper switch as well', 'Run the inspector’s test'], edit: (W) => { E.wire(W, 6, 12); E.wire(W, 2, 12); },
          lesson: 'While the panel is open, every supervised point gets checked: the yard valve had a switch with no wire either.' } },
      { key: 'B', name: 'Office B: DACT', money: 1500, area: PZ.OFFICE_AREA, cfg: { commPath: 'dact' },
        build(W, b) { PZ.office(W, b); }, setup: (S) => { chan(S, 0, 0); S.warp(60); night(S); S.warp(900); },
        symptom: ['Records-only investigation. At 02:14 the night guard heard the water motor gong on the office riser, and the panel showed WATERFLOW. The supervising station has no record of it. The building had its telephone lines rerouted during a renovation.', 'Find why the alarm never left, put it right, and prove it with an inspector’s test.'],
        records: ['Guard log 02:14: WATERFLOW on the panel, water motor gong ringing.', 'Supervising station: no signal from this account last night, and the daily test signal was missed.'],
        hints: [['The panel had the alarm, so look at how the panel talks to the station. Select the panel.', 4, 10],
          ['Read the DACT channels on the panel, and the annunciator line of the waterflow: it says whether it could be sent.', 4, 10],
          ['Both DACT telephone lines are down after the renovation, so nothing can leave the panel. Restore the DACT channels on the panel, reset the panel to clear last night’s latched waterflow, then run the inspector’s test.', 4, 10]],
        diag: { q: 'Why did the alarm never leave?', opts: [
          ['The waterflow switch is not wired', false, 'The panel showed WATERFLOW: the switch is wired.'],
          ['Both DACT telephone lines are down', true, 'Yes. With both channels down the panel annunciates everything and can send nothing, alarms included.'],
          ['The waterflow class is set to supervisory', false, 'Waterflow is a fixed alarm signal; nobody can change its class.'],
          ['The station only takes alarms from the fire pump', false, 'A station takes every alarm a panel sends.']] },
        goals: [stnGoal], prove: (S) => { reset(S); itc(S); },
        cheap: { t: 'Restore the lines', steps: ['Restore the DACT channels on the panel', 'Reset the panel to clear the latched waterflow', 'Run the inspector’s test'], op: (S) => chan(S, 1, 1), lesson: 'No edits. The held signals go out late, with their original time, once a line is back.' },
        maint: { t: 'Restore them, and wire the yard valve', steps: ['Restore the DACT channels', 'Wire the yard valve’s tamper switch', 'Reset, then the inspector’s test'], edit: (W) => E.wire(W, 2, 12), op: (S) => chan(S, 1, 1),
          lesson: 'A second path (cellular or IP) would be the real fix for a site that loses its phone lines; that is a site setting here.' } },
      { key: 'C', name: 'Office C: a trouble on the panel', money: 1500, area: PZ.OFFICE_AREA, cfg: { commPath: 'dact' },
        build(W, b) { PZ.office(W, b, { noFlowWire: true }); }, setup: (S) => { chan(S, 0, 1); S.warp(600); night(S); },
        symptom: ['Records-only investigation. At 02:14 the night guard heard the water motor gong on the office riser. The supervising station has no record of it. The panel has been showing a DACT trouble for a week, and the telephone company is booked to fix the line.', 'Find why the alarm never left, fix it with the fewest edits, and prove it with an inspector’s test.'],
        records: ['Guard log 02:14: water motor gong ringing at the office riser.', 'Panel: DACT CHANNEL 1 FAILURE, trouble, acknowledged a week ago.', 'Supervising station: the trouble was received. No waterflow.'],
        hints: [['The station did get the DACT trouble, so the panel can still send. Is the waterflow even reaching the panel?', 6, 12],
          ['Look at last night’s waterflow line in the event log, and at "Wired to" on the riser.', 6, 12],
          ['The DACT trouble is real but not the cause: one line down still sends on the other. The riser’s flow switch is not wired to the panel. Wire it and run the inspector’s test.', 4, 10]],
        diag: { q: 'Why did the alarm never leave?', opts: [
          ['The failed DACT line', false, 'With one channel down every signal goes on the other at once; the station received the trouble that way.'],
          ['The waterflow switch on the riser is not wired to the panel', true, 'Yes. The trouble was a distraction: the alarm never reached the panel at all.'],
          ['The guard silenced the panel', false, 'Silence quiets the panel; it does not stop a signal from being sent.'],
          ['The inspector’s test valve is too small to trip the switch', false, 'The gong rang, so water flowed through the alarm valve.']] },
        goals: [stnGoal], prove: itc,
        cheap: { t: 'Wire the flow switch', steps: ['Wire tool: panel, then the riser', 'Run the inspector’s test'], edit: (W) => E.wire(W, 6, 12), lesson: 'One wire. The DACT line is the telephone company’s job.' },
        maint: { t: 'Wire it, the yard valve, and chase the line', steps: ['Wire the riser’s flow switch and the yard valve’s tamper switch', 'Restore DACT channel 1 (the telephone company)', 'Run the inspector’s test'], edit: (W) => { E.wire(W, 6, 12); E.wire(W, 2, 12); }, op: (S) => chan(S, 1, 1),
          lesson: 'One line down is a trouble for a reason: the next fault would leave nothing. Fix both.' } },
    ],
  });

  // =====================================================================================================
  const JK = { suction: [9, 11], check: [14, 10] };
  const sleepGoals = [{ t: 'Plan review: no jockey pump or fire pump start warnings', ok: (S) => G.noWarn(S, 'ockey'), hint: 'Jockey stop about churn plus suction; jockey start at least 10 psi lower; fire pump start at least 5 psi below jockey start.' },
    { t: 'Thirty quiet minutes: the jockey holds pressure and the fire pump never starts', ok: PZ.sleeps, hint: 'Stop the fire pump once the jockey can hold pressure, then let time run (speed up).' }];
  const sleep = (S) => { for (const p of S.W.byType('epump')) p.p.on = false; S.editT = S.t; S.warp(1900); };
  const jockeyValves = (W) => { E.gate(W, 10, 10, 0, false); E.gate(W, 13, 10, 0, false); };
  const settings = (W, st, sp) => { const j = W.byType('jockey')[0]; j.p.start = st; j.p.stop = sp; W.ver++; };
  DI.PUZ.push({
    id: 'p7', n: 7, name: 'The Pump That Won’t Sleep', kind: 'Active incident', w: 60, h: 32, parts: ['gate', 'check', 'jockey'],
    question: 'Why does a small leak keep waking the fire pump?',
    learn: ['The jockey pump makes up small leaks so the fire pump only starts for real demand', 'Settings in order: jockey stop near churn plus suction, jockey start 10 psi lower, fire pump start 5 psi below that (NFPA 20 annex)', 'A jockey pump that cannot draw or cannot push (a blank, a reversed check valve) runs and does nothing', 'Prove it: thirty quiet minutes with the leak still there'],
    variants: [
      { key: 'A', name: 'Site A: after the controller swap', money: 3000, area: PZ.PUMP_AREA,
        build(W, b) { PZ.pumpSite(W, b); settings(W, 95, 105); }, setup: (S) => { PZ.leak(S); S.warp(600); },
        symptom: ['Active incident. The fire pump is running again. A small leak on the old underground main has been starting it once a night since the jockey pump controller was replaced. Facilities stops it by hand every morning.', 'Correct the jockey arrangement and settings with the fewest edits, then demonstrate thirty quiet minutes.'],
        records: ['Controller replacement ticket: jockey pump controller, settings "as found".', 'Night log: electric fire pump start demand, every night since.'],
        hints: [['Two pumps sense the same pressure. Which one is meant to start first, and does it?', 11, 10],
          ['Select the jockey pump and the fire pump and compare their start pressures. Plan review (Review) also checks the order.', 11, 10],
          ['The new jockey controller was set to start at 95 psi and stop at 105, below the fire pump’s 100 psi start. Set the jockey to start at 115 and stop at 125, stop the fire pump, and let thirty minutes run.', 11, 10]],
        diag: { q: 'Why does the leak wake the fire pump?', opts: [
          ['The leak is too big for the jockey pump', false, 'A 15 gpm jockey makes up this leak easily once its settings are right.'],
          ['The jockey pump starts below the fire pump’s start pressure', true, 'Yes. Pressure falls to the fire pump’s 100 psi before it reaches the jockey’s 95.'],
          ['The jockey pump check valve is reversed', false, 'The check valve faces the system; the jockey never runs because it never gets its start pressure.'],
          ['The fire pump controller is faulty', false, 'It starts exactly at its setting. The order of the settings is the fault.']] },
        goals: sleepGoals, prove: sleep, impPar: 600,
        cheap: { t: 'Reset the jockey settings', steps: ['Jockey pump: start 115 psi, stop 125 psi', 'Stop the fire pump', 'Thirty quiet minutes'], edit: (W) => settings(W, 115, 125), lesson: 'One setting.' },
        maint: { t: 'Reset them and add jockey isolation valves', steps: ['Jockey start 115, stop 125', 'Isolation valves on the jockey suction and discharge'], edit: (W) => { settings(W, 115, 125); jockeyValves(W); },
          lesson: 'With its own isolation valves the jockey pump can be serviced, or its controller swapped, without taking the fire pump or the system out of service.' } },
      { key: 'B', name: 'Site B: after the jockey rebuild', money: 3000, area: PZ.PUMP_AREA,
        build(W, b) { PZ.pumpSite(W, b); E.turn(W, ...JK.check); }, setup: (S) => { PZ.leak(S); S.warp(600); },
        symptom: ['Active incident. The fire pump is running. The jockey pump was rebuilt last week; since then it runs non-stop and the fire pump starts anyway.', 'Correct the jockey arrangement with the fewest edits, then demonstrate thirty quiet minutes.'],
        records: ['Jockey rebuild ticket: pump and check valve removed and reinstalled.', 'Jockey pump run counter: running continuously since the rebuild.'],
        hints: [['The jockey runs, so it has power and settings. Where does its water go?', 12, 10],
          ['Look at the parts on the jockey discharge line: the glyph of each shows its flow direction. Compare with the fire pump’s discharge check valve.', 14, 10],
          ['The jockey discharge check valve went back in the wrong way round. Select it and press Turn end for end, stop the fire pump, and let thirty minutes run.', 14, 10]],
        diag: { q: 'Why does the jockey run and the fire pump still start?', opts: [
          ['The jockey settings overlap the fire pump', false, 'Jockey 115 / 125, fire pump 100: in order.'],
          ['The jockey discharge check valve is in backwards', true, 'Yes. The jockey pushes against a closed check valve: it runs, and no water reaches the system.'],
          ['The jockey pump is too small', false, 'Fifteen gpm against this leak is plenty.'],
          ['The jockey has no suction', false, 'Its suction tee is open to the full tank.']] },
        goals: sleepGoals, prove: sleep, impPar: 600,
        cheap: { t: 'Turn the check valve', steps: ['Select the jockey check valve, Turn end for end', 'Stop the fire pump', 'Thirty quiet minutes'], edit: (W) => E.turn(W, ...JK.check), lesson: 'One edit.' },
        maint: { t: 'Turn it and add jockey isolation valves', steps: ['Turn the check valve', 'Isolation valves on the jockey suction and discharge'], edit: (W) => { E.turn(W, ...JK.check); jockeyValves(W); }, lesson: 'The next rebuild isolates the jockey at its own valves.' } },
      { key: 'C', name: 'Site C: two faults', money: 3000, area: PZ.PUMP_AREA,
        build(W, b) { PZ.pumpSite(W, b); E.cap(W, JK.suction[0], JK.suction[1], true, true); settings(W, 120, 125); }, setup: (S) => { PZ.leak(S); S.warp(600); },
        symptom: ['Active incident. The fire pump is running. After the suction header was hydrostatically tested, the jockey pump has been running non-stop and short-cycling in between, and the fire pump starts every night.', 'There are two faults. Correct both with the fewest edits, then demonstrate thirty quiet minutes.'],
        records: ['Hydrostatic test of the suction header: passed, blanks installed (call 2).', 'Jockey pump: 312 starts this week.'],
        hints: [['The jockey runs, so look at where its water comes from, and at its settings.', 9, 11],
          ['Hover the jockey suction pipe: it reads below zero. Then compare the jockey’s start and stop pressures: plan review warns about the band.', 9, 11],
          ['A test blank (a cap) was left between the jockey suction tee and the tank line (call 2), and the jockey’s start / stop band is only 5 psi (start 120, stop 125). Remove the cap, set the jockey start to 115, stop the fire pump and let thirty minutes run.', 9, 11]],
        diag: { q: 'What two faults keep the fire pump awake?', opts: [
          ['A blank in the jockey suction, and a 5 psi start / stop band', true, 'Yes. The blank starves the jockey; the narrow band would have short-cycled it even with water.'],
          ['A reversed jockey check valve, and the fire pump start set too high', false, 'The check valve faces the system, and the fire pump start (100 psi) is in order.'],
          ['The underground leak, and a worn jockey pump', false, 'The jockey makes up the leak once it can draw water.'],
          ['A closed suction valve on the fire pump', false, 'There is no valve on the suction, and the fire pump has water.']] },
        goals: sleepGoals, prove: sleep, impPar: 600,
        cheap: { t: 'Pull the blank and widen the band', steps: ['Cap tool on the jockey suction joint', 'Jockey start 115 psi (stop 125)', 'Stop the fire pump, thirty quiet minutes'], edit: (W) => { E.cap(W, JK.suction[0], JK.suction[1], true, false); settings(W, 115, 125); }, lesson: 'Two edits, one per fault.' },
        maint: { t: 'Both, and jockey isolation valves', steps: ['Pull the blank and set the band to 10 psi', 'Isolation valves on the jockey suction and discharge, so the next hydrostatic test closes a valve instead of a blank'], edit: (W) => { E.cap(W, JK.suction[0], JK.suction[1], true, false); settings(W, 115, 125); jockeyValves(W); },
          lesson: 'A valve, unlike a blank, is visible and is part of the plant record.' } },
    ],
  });

  // =====================================================================================================
  // the preaction zone of contract 6: city -> control valve (13,14) -> preaction valve (17,14), compressor (17,12),
  // panel (19,12), VESDA in the hall, and a manual release station (typed DETECTION) in the hall at (41,8)
  const c6 = () => DI.SCEN.find((s) => s.id === 'c6');
  const PRE_AREA = [10, 6, 43, 21];
  const pre = (W, b) => { c6().build(W); W.byType('comp')[0].p.scfm = 10; W.erasePipe(41, 8); const m = b.p('mstn', 41, 8); b.wire(W.byType('panel')[0], m); };
  const pv = (S) => S.W.byType('prev')[0], pss = (S) => S.ss.get(pv(S).id), pnl = (S) => S.W.byType('panel')[0], stn = (S) => S.W.byType('mstn')[0];
  const resetN = (S, n) => { for (let i = 0; i < n; i++) { DI.panelReset(S, pnl(S).id); S.warp(40); } };
  const drainDown = (S) => { const v = pv(S); v.p.sdrain = 1; S.touch(); S.warp(90); };
  // the operator's way out: wait for the air above low air, then one reset
  const airBack = (S) => { const v = pv(S); S.warp(3600, 0, () => pss(S).P > v.p.loAir + 0.5); resetN(S, 1); S.warp(30); };
  const backGoals = [{ t: 'Zone back in service: set, pressurized, nothing latched', ok: (S) => PZ.inService(S, pv(S)), hint: 'Clear the cause first, wait for the reading to recover, then reset the panel once.' },
    { t: 'Annunciator normal: no alarm, supervisory or open item', ok: (S) => PZ.quiet(S, ['ALARM', 'SUPV', 'OPEN']), hint: '' }];
  DI.PUZ.push({
    id: 'p8', n: 8, name: 'Reset, Reset, Reset', kind: 'Active incident', w: 64, h: 36, parts: ['gate'],
    question: 'What keeps bringing the indication back?',
    learn: ['A panel reset clears the latches and reads every input again: a live input comes straight back', 'P relatches while the pipe is below P trip: restore the air first, then reset', 'A manual station stays operated until it is reset at the station', 'Every reset made while the cause is live is noise in the panel history: clear the cause, then reset once'],
    variants: [
      { key: 'A', name: 'Hall A: after the head change', money: 1000, area: PRE_AREA, impPar: 2400,
        build: pre, setup: (S) => { const v = pv(S); v.p.airValve = 0; drainDown(S); v.p.sdrain = 0; S.touch(); S.warp(30); resetN(S, 3); },
        live: (S) => !pv(S).p.airValve || pss(S).P <= pv(S).p.pTrip,
        symptom: ['Active incident. A sprinkler head in the data hall was replaced this afternoon and the operator has reset the panel three times. Each time the same indications come straight back.', 'Identify and clear the live cause before you reset again. Then put the zone back in service with one reset.'],
        records: ['Head replacement ticket: control valve closed, air isolated, drained, head replaced, drain closed, control valve reopened.'],
        hints: [['Read the annunciator and the impairment tags before touching Reset. What is still the way the repair left it?', 17, 14],
          ['Select the preaction valve: compare the pipe pressure with its P trip and low air setpoints, and look at the air / N2 supply row.', 17, 13],
          ['The air supply to the zone was never restored after the repair: the pipe sits at 0 psi, below P trip, so P relatches on every reset. Restore the air supply, let the zone refill past low air (skip ahead), then reset the panel once.', 17, 13]],
        diag: { q: 'What brings the indication back?', opts: [
          ['A detector in the hall is still in alarm', false, 'No detector is above its first stage. The indication is P and low air, not detection.'],
          ['The air supply to the zone is still isolated, so the pipe stays below P trip', true, 'Yes. The ticket missed "restore air". P is a live input: it latches again the moment the panel reads the pipe.'],
          ['The panel is faulty and needs replacing', false, 'The panel does exactly what it should: it reads a pipe below P trip.'],
          ['The new head is leaking', false, 'With the air supply isolated no gauge can tell, but the zone holds once the supply is back.']] },
        goals: backGoals, prove: airBack,
        cheap: { t: 'Restore the air, then one reset', steps: ['Open the air / N2 supply to the zone', 'Let the zone refill past low air', 'Reset the panel once'], op: (S) => { pv(S).p.airValve = 1; }, lesson: 'No edits: the fault was a step missed.' },
        maint: { t: 'Restore the air, prove the zone, then one reset', steps: ['Open the air / N2 supply', 'Let it refill, reset the panel once', 'Run the 24 h air test to prove the new head holds'], op: (S) => { pv(S).p.airValve = 1; },
          lesson: 'The recovery checklist on the valve has "restore air" as its own step for this reason. The air test proves the repair, not just the reset.' } },
      { key: 'B', name: 'Hall B: after the tour', money: 1000, area: PRE_AREA, impPar: 900,
        build: pre, setup: (S) => { stn(S).p.on = true; S.warp(30); resetN(S, 3); },
        live: (S) => !!stn(S).p.on,
        symptom: ['Active incident. A school tour went through the data hall this morning. Since then the panel shows an alarm that comes straight back however many times the operator resets it. No water has flowed.', 'Identify and clear the live cause before you reset again. Then return the panel to normal with one reset.'],
        records: ['Operator log: panel reset at 10:02, 10:03 and 10:05. Same alarm each time.'],
        hints: [['Read the alarm on the annunciator: which device is it?', 41, 8],
          ['Click the alarm row to go to the device and read its status.', 41, 8],
          ['The manual station in the hall was operated during the tour and is still operated. Reset it at the station, then reset the panel once.', 41, 8]],
        diag: { q: 'What brings the alarm back?', opts: [
          ['Smoke from the tour set off the VESDA', false, 'The detector is at normal. The alarm is a manual pull.'],
          ['The manual station in the hall is still operated', true, 'Yes. A station stays operated until it is reset at the station; the panel reads it again after every reset.'],
          ['P is latched on the zone', false, 'The pipe is at normal pressure and P is clear.'],
          ['The panel reset button is broken', false, 'The reset works: it clears and re-reads, and the station is still operated.']] },
        goals: backGoals, prove: (S) => { S.warp(10); resetN(S, 1); S.warp(30); },
        cheap: { t: 'Reset the station, then the panel', steps: ['Select the manual station, Reset station', 'Reset the panel once'], op: (S) => { stn(S).p.on = false; }, lesson: 'No edits.' },
        maint: { t: 'Reset the station, the panel, and walk the room', steps: ['Reset the station', 'Reset the panel once', 'Walk the room: every station and detector back to normal before the panel is left'], op: (S) => { stn(S).p.on = false; },
          lesson: 'The station was typed DETECTION, so it latched D: with P it would have released water. Know what every input in the room does.' } },
      { key: 'C', name: 'Hall C: after the trip test', money: 1000, area: PRE_AREA, impPar: 2400,
        build: pre, setup: (S) => { drainDown(S); resetN(S, 3); },
        live: (S) => !!pv(S).p.sdrain || pss(S).P <= pv(S).p.pTrip,
        symptom: ['Active incident. The zone was trip tested and restored yesterday. Overnight its air fell away, and the operator has reset the panel three times since. Each time P latches again within seconds. The compressor runs and runs.', 'Identify and clear the live cause before you reset again. Then put the zone back in service with one reset.'],
        records: ['Trip test record: valve reset at the riser, air restored, panel reset, control valve reopened.', 'Compressor: running continuously since 01:40.'],
        hints: [['The compressor runs and the pressure still falls: air is leaving faster than it is made. Where can it leave?', 17, 14],
          ['Select the preaction valve and read every valve on its trim: control valve, air supply, system drain, inspector’s test.', 17, 14],
          ['The system drain was left open after the trip test: it vents the zone faster than the compressor can fill it, so P relatches on every reset. Close the system drain, let the zone refill past low air, then reset the panel once.', 17, 14]],
        diag: { q: 'What brings P back?', opts: [
          ['The air supply to the zone is isolated', false, 'The supply is open: the compressor is running into the zone.'],
          ['The system drain was left open after the trip test', true, 'Yes. The recovery step "close the drain" was missed: the air goes out as fast as it comes in.'],
          ['The compressor is too small for the zone', false, 'It passes the 30 minute sizing check, and it refills the zone once the drain is shut.'],
          ['The pipe has corroded through', false, 'A pinhole loses air slowly; this zone empties in under two minutes.']] },
        goals: backGoals, prove: airBack,
        cheap: { t: 'Close the drain, then one reset', steps: ['Close the system drain', 'Let the zone refill past low air', 'Reset the panel once'], op: (S) => { pv(S).p.sdrain = 0; S.touch(); }, lesson: 'No edits.' },
        maint: { t: 'Close the drain, reset once, record it', steps: ['Close the system drain', 'Let it refill, reset the panel once', 'Finish the recovery checklist on the valve so the missed step is on record'], op: (S) => { pv(S).p.sdrain = 0; S.touch(); },
          lesson: 'A practice recovery on the valve shows the thirteen steps in order: "close the drain" is step 9, before the air is restored.' } },
    ],
  });
})();
