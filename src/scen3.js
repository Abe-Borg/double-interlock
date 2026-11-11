// Campaign contracts 5-7 and the sandbox: preaction, nitrogen, and the whole campus.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const G = DI.G, X = DI.X;
  const di = (S, types) => types.every((t) => G.each(S, t, (v) => v.type === 'prev'));
  // in service: set and pressurized, and for preaction the P sensor is not sitting latched
  const inService = (S, types) => types.every((t) => G.each(S, t, (v, i, s) => v.type === 'wetv' ? s.state === 'wet' : s.state === 'dry' && s.set && !v.p.pLatch));
  // water discharged so far, less what went down a main drain in a main drain test (step 14 of the recovery)
  const mark = (S) => { S.drill.g0 = S.stats.gallons - (S.stats.mdGal || 0); };

  DI.SCEN.push({
    id: 'c5', name: 'Double Interlock', tag: 'Preaction, VESDA, releasing panel', w: 64, h: 36, money: 430000, par: 345000,
    parts: ['gate', 'check', 'fdc', 'wetv', 'dryv', 'prev', 'comp', 'panel', 'vesda', 'smoke', 'mstn'],
    brief: ['Data Hall 1: 48,000 square feet and nine figures of servers. The owner wants sprinklers, because a fire that is not stopped takes the whole building. The owner is also terrified of water.',
      'Double interlock preaction answers both. The pipe is dry and held under supervisory pressure. Water is admitted only when two independent things have happened: detection has reached Fire 1 (or someone has operated the manual station) AND P, the pipe pressure falling below the P trip setpoint. A broken sprinkler alone gives P and no water. A false detection alone energizes the solenoid and no water. P stays latched until you reset it, so a broken sprinkler that was replaced but never reset still counts.'],
    learn: ['The two interlocks: detection (Fire 1 or the manual station) AND P (pipe pressure below the P trip setpoint)', 'Aspirating detection stages: Alert is supervisory, Action is a pre-alarm, Fire 1 releases, Fire 2 only escalates', 'System size: zone volume counts pipe, fittings and trim. Over 500 gal a double-interlock zone must pass the 60 s timed trip test, or be rezoned. +30% design area, no gridding', 'Low air is a warning, P is a latch: after every repair restore the air first, then reset. Left latched, one detection event trips the valve and fills the pipe: a discharge if a head is open, a water-filled zone to drain and reset if every head is closed', 'Recovery in order: silence, find the head, close the control valve, isolate the air, drain to 0 psi, panel reset #1 if detection latched, replace the head, reset the valve at the riser if it tripped (drain still open), close the drain, restore air, reset the trim (electric / pneumatic), panel reset #2, reopen the control valve. In the drill a fourteenth step follows: the main drain test', 'Stop the water first: the drill rates the time from the alarm to the control valve closed', 'One control valve per system, so an impairment stays small'],
    build(W) {
      const b = DI.mk(W); W.addRoom('riser', 15, 10, 6, 8).exempt = true; W.addRoom('hall', 22, 5, 30, 16); W.addRoom('elec', 22, 22, 12, 7);
      b.p('city', 2, 14, 0, { stat: 135, resid: 115, flow: 2500, fixed: true, loop: true, label: 'Campus Fire Loop' }); b.h(3, 12, 14, 8); b.p('gate', 13, 14); b.h(14, 16, 14, 8);
    },
    goals: [
      { t: 'Sprinkler every tile of the data hall and the electrical room', ok: (S) => G.covered(S, ['hall', 'elec']), hint: 'Tree, not grid: a feed main, cross mains, dead-end branch lines.' },
      { t: 'Both rooms on double-interlock preaction, with no code failures', ok: (S) => di(S, ['hall', 'elec']) && G.noFails(S), hint: 'Each preaction valve needs supervisory air, a releasing panel, and detection in every room it serves.' },
      { t: 'Releasing panel wired: detection, every solenoid, every tamper switch', ok: (S) => S.W.byType('prev').length > 0 && G.wired(S, ['prev', 'gate', 'vesda', 'smoke']), hint: 'Wire tool: panel first, then each device.' },
      { t: 'Hydraulic calc passes on every system: 0.15 gpm/ft² over 1,950 ft² + 250 gpm hose', ok: (S) => G.calcOk(S, 'hall') && G.calcOk(S, 'elec'), hint: 'Feed the hall from the middle so no branch line is long.' },
      { t: 'Trip test passes on every preaction valve', ok: (S) => G.test(S, 'trip', 'hall') && G.test(S, 'trip', 'elec'), hint: 'Zone volume counts fittings and trim on top of the pipe (the valve shows both). Over 500 gal a double-interlock zone must put water at the inspector’s test in 60 s, and a quick-opening device does not extend the 500 gal. Pass the timed test or rezone the hall into more systems.' },
      // Restoring after a trip test is practice: the valve shows a recovery checklist and nothing gates on it.
      // Only the drill's broken-sprinkler incident is scored (DI.drillRecovery).
      { t: 'All systems reset, pressurized and in service', ok: (S) => inService(S, ['hall', 'elec']), hint: 'After each trip test, put the valve back with the recovery checklist on the valve (practice here, scored in the drill, where it ends with a main drain test from the valve’s Tests): silence, close the control valve, isolate the air, drain to 0 psi, reset the panel so detection drops out, reset the valve at the riser with the drain still open, close the drain, restore the air, reset the actuator at the trim (electric / pneumatic only), reset the panel again, then reopen the control valve. A valve showing P LATCHED is not in service. P clears only after the air is back: at the panel on an electric / electric trim, at the actuator on electric / pneumatic. An earlier reset latches straight back. Give each preaction valve its own control valve, or restoring one system takes all of them out of service.' },
    ],
    // The false alarm comes after the 30-minute air-restore window, so a recovery done in order has time to
    // finish. No hard timer: with P still latched the false alarm trips the valve and fills the pipe. With the
    // head replaced nothing discharges (a water-filled zone, reported on its own line); with the head still
    // open it is water on the IT load.
    drill: { name: 'Three Bad Days', len: 5600, steps: () => [
      [10, X.smash('hall', 0.3, 0.3), 'A contractor’s ladder just snapped a sprinkler off in the data hall.'],
      [2100, X.falseAlarm('hall'), 'Construction dust is being pulled into a VESDA sampling pipe.'],
      [2900, mark], [2920, X.fire('hall', 0.65, 0.6, 240), 'Something in row 14 smells hot.'],
      [4100, X.fire('elec', 0.5, 0.5, 0, 1.5), 'Arc flash in a switchboard in the electrical room.']],
      judge: DI.lossJudge(4500000, (S) => [[(S.drill.g0 || 0) < 5, 'No water on the IT load from the broken sprinkler or the false alarm']].concat(DI.drillRecovery(S, 'the broken sprinkler'))) },
  });

  DI.SCEN.push({
    id: 'c6', name: 'Rust Never Sleeps', tag: 'Nitrogen, corrosion, leak testing', w: 64, h: 36, money: 78000, par: 52000,
    parts: ['gate', 'comp', 'n2', 'panel'],
    brief: ['Six years ago someone filled this preaction system with compressed air and walked away. Air is 21% oxygen. Every trip test left a little water in the low points. Oxygen, water and steel have been doing what they do.',
      'The compressor now runs all day, low-air supervisories come in at 3 a.m., and facilities has started ignoring them. That is how a double interlock system quietly loses an interlock: the day the leak outruns the compressor, P latches, and from then on one detection event is all it takes.'],
    learn: ['Why dry and preaction pipe corrodes from the inside, and where', 'Reading compressor run time and the 24-hour air test: 40 psi held 24 h, end reading 38.5 psi or more', 'A failed air test can leave P latched: after the repair, restore the air and reset the panel before you call the zone in service', 'Nitrogen generator + vent: purge to 98% and the corrosion reaction starves', 'Nitrogen buys corrosion protection, not smaller pipe: the calc stays at C = 100'],
    build(W) {
      const b = DI.mk(W); W.addRoom('riser', 15, 10, 6, 8).exempt = true; W.addRoom('hall', 22, 8, 20, 12);
      b.p('city', 2, 14, 0, { stat: 96, resid: 74, flow: 1500, fixed: true, loop: true, label: 'Campus Fire Loop' }); b.h(3, 12, 14, 8);
      const g = b.p('gate', 13, 14); b.h(14, 16, 14, 7); const v = b.p('prev', 17, 14, 0);
      const d = b.p('vesda', 41, 19); b.h(18, 30, 14, 6); for (let x = 22; x <= 30; x++) W.spk[W.k(x, 14)] = 1;
      b.v(31, 8, 19, 6, true); b.grid(22, 8, 30, 19, 2, 1); b.grid(32, 8, 41, 19, 2, 1);
      const c = b.p('comp', 17, 12, 0, { scfm: 5 }); b.air([[17, 13]]); const pn = b.p('panel', 19, 12); b.wire(pn, g, v, d);
    },
    start(S) { for (const s of S.ss.values()) { s.corr = 0.6; s.holes = 5; s.moist = 1; } },
    goals: [
      { t: 'Measure it: run the 24-hour air test', ok: (S) => S.results.some((r) => r.kind === 'leak'), hint: 'Select the preaction valve. Use the clock menu to skip ahead a day.' },
      { t: 'Repair the pinhole leaks', ok: (S) => G.each(S, 'hall', (v, i, s) => !s.holes), hint: 'Preaction valve → Repair leaks.' },
      { t: 'Supervisory gas is 98% nitrogen or better', ok: (S) => G.each(S, 'hall', (v, i, s) => i.hasN2 && s.G > 0 && s.o2g / s.G <= 0.02), hint: 'Tube a nitrogen generator to the valve and enable the purge vent. Purging takes about a week: skip ahead.' },
      { t: '24-hour air test passes', ok: (S) => G.test(S, 'leak', 'hall'), hint: 'Test pressure is 40 psi, held 24 hours. Pass is an end reading of 38.5 psi or more (a loss of 1.5 psi or less). A failed test can leave P latched: after the repair, restore the air and reset the panel before you call the zone in service.' },
      { t: 'Hydraulic calc passes (C = 100: nitrogen earns no pipe-size credit)', ok: (S) => G.calcOk(S, 'hall'), hint: 'Select the preaction valve and run the calc. All pipe is calculated at C = 100, with or without nitrogen.' },
      { t: 'Five years on nitrogen with no new leaks', ok: (S) => G.each(S, 'hall', (v, i, s) => !s.holes && s.n2T > 0 && S.t - s.n2T >= 5 * DI.YEAR), hint: 'Clock menu → skip 5 years once the gas is at 98%.' },
    ],
    tick(S) { for (const [id, s] of S.ss) { const i = S.sysd.info.get(id), pure = i.hasN2 && s.G > 0 && s.o2g / s.G <= 0.021 && s.state === 'dry'; if (pure && !(s.n2T > 0)) s.n2T = S.t; if (!pure || s.holes) s.n2T = -1; } },
    drill: null,
  });

  const campus = (W) => {
    const b = DI.mk(W);
    W.addRoom('pump', 5, 24, 10, 8).exempt = true; W.addRoom('corr', 26, 25, 63, 7).exempt = true;
    W.addRoom('hall', 30, 11, 26, 14, 'Data Hall A'); W.addRoom('hall', 58, 11, 26, 14, 'Data Hall B');
    W.addRoom('office', 30, 32, 16, 7); W.addRoom('elec', 48, 32, 14, 7); W.addRoom('batt', 64, 32, 10, 7); W.addRoom('dock', 76, 32, 12, 7); W.addRoom('gen', 58, 42, 22, 8);
    b.p('city', 2, 44, 0, { stat: 50, resid: 20, flow: 700, fixed: true });
  };
  const ALL = ['office', 'hall', 'elec', 'batt', 'dock'];
  const fp = (S) => [...S.W.parts.values()].filter((p) => p.type === 'epump' || p.type === 'dpump');

  DI.SCEN.push({
    id: 'c7', name: 'Hyperscale', tag: 'The whole campus', w: 96, h: 56, money: 1500000, par: 1120000,
    parts: Object.keys(DI.PARTS).filter((k) => k !== 'city'),
    brief: ['Two data halls, an electrical room, a battery room, a dock and offices on a rural water main, strung along a heated valve gallery. A blank site and a budget.', 'Hyperscale buildings put their risers in a gallery beside the halls: one wet trunk main down the corridor, a control valve and a system valve at each room. Pipes cannot cross each other, so plan the trunk first.',
      'Everything you have built so far, at once, on one campus loop. Then the worst night this site will ever have.'],
    learn: ['Choosing the right system for each space', 'One water supply sized for the worst demand, with a second driver', 'Sectional valves and supervision across a campus', 'Running an incident: read the panel, restore what is impaired'],
    build: campus,
    goals: [
      { t: 'Every room sprinklered (pump house and valve gallery are by others)', ok: (S) => G.covered(S, ALL), hint: '' },
      { t: 'No code failures in review', ok: (S) => G.noFails(S), hint: '' },
      { t: 'Data halls and electrical room on double-interlock preaction; dock on dry pipe', ok: (S) => di(S, ['hall', 'elec']) && G.each(S, 'dock', (v) => v.type === 'dryv'), hint: '' },
      { t: 'Hydraulic calc passes on every system', ok: (S) => ALL.every((t) => G.calcOk(S, t)), hint: 'Run the calc on each riser.' },
      { t: 'Every fire pump flow-tested; a second independent driver', ok: (S) => fp(S).length > 0 && fp(S).every((p) => { const r = DI.lastResult(S, 'pump', p.id); return r && r.pass; }) && G.noWarn(S, 'utility power alone'), hint: '' },
      { t: 'Trip test passed on every dry and preaction valve', ok: (S) => ['hall', 'elec', 'dock'].every((t) => G.test(S, 'trip', t)), hint: '' },
      { t: 'Everything supervised: risers, valves, pumps and detection wired to a panel', ok: (S) => G.wired(S, ['wetv', 'dryv', 'prev', 'gate', 'epump', 'dpump', 'vesda', 'smoke']), hint: '' },
      { t: 'All systems in service', ok: (S) => inService(S, ALL), hint: '' },
    ],
    drill: { name: 'The Longest Night', len: 6000, steps: () => [
      [10, X.temp(-10), 'Ice storm. −10 °F and falling.'],
      [150, (S) => { const g = S.W.byType('gate'); if (g.length) g[(g.length / 2) | 0].p.target = 0; }, 'A night-shift contractor is "just isolating something for a minute".'],
      [420, X.power(false), 'Ice on the lines. Utility power is out.'],
      [700, X.smash('hall', 0.3, 0.4), 'A lift truck clipped a sprinkler in Data Hall A.'],
      [1300, X.falseAlarm('hall'), 'VESDA in Data Hall A is climbing. Dust?'],
      [1880, mark], [1900, X.fire('batt', 0.5, 0.5, 0, 2), 'Thermal event in the battery room.'],
      [3100, X.fire('hall', 0.6, 0.55, 200), 'Hot spot in Data Hall A.'],
      [4300, X.fire('dock', 0.5, 0.5, 0, 2), 'Trailer fire at the dock.'], [5200, X.power(true)]],
      judge: DI.lossJudge(7000000, (S) => [[(S.drill.g0 || 0) < 5, 'No accidental discharge in the data halls'], [!S.W.rooms.some((r) => r.burst), 'No frozen pipe']]) },
  });

  DI.SCEN.push({
    id: 's0', name: 'Sandbox', tag: 'Free build, unlimited budget, break anything', w: 96, h: 56, money: 99000000, par: 0, sandbox: true,
    parts: Object.keys(DI.PARTS),
    brief: ['An empty campus and no rules. Build anything, then use the Incident menu to set fire to it, freeze it, break sprinklers, cut the power or skip ahead five years.'],
    learn: [], build: campus, goals: [], drill: null,
  });
})();
