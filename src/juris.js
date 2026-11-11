// Jurisdiction / enforced edition table. The US edition of NFPA 13 is a site setting (W.cfg.edition).
// The edition changes citations and the delta note only; pass/fail does not differ.
// Section numbers are the ones held in the DC FP training. Do not add others without verifying them.
var DI = globalThis.DI || (globalThis.DI = {});

// Water-delivery, air-test and air-refill references per edition (FP Lead, from the NFPA LiNK notes unless marked):
//   timedTest = the 60 s timed trip test, noQod = the dry exemption without a quick-opening device, qod = the dry
//   exemption with one, calc = the listed calculation route, table = the calc / table route by hazard, manifold and
//   otherTimes = information only, di = the double-interlock size exemption, diQod = a QOD may help a
//   double-interlock system meet 60 s (it does not extend the 500 gal), delivery = the section-level pointer,
//   airTest = the 24 h air test (40 psi, loss over 1.5 psi to be corrected),
//   refill = the air supply restores normal pressure within 30 min, refillN2 = the same for an N2-only source
//   (2025: the N2-only subsection is not pulled; the key is absent there and DI.refillRef applies the 2025 refill
//   section as the conservative reading, marked ASSUMED),
//   refillAnnex = the Annex note that one compressor serving several systems is sized on the single largest system
//   (2025: it also covers a shared N2 source),
//   refillCold / refillN2Cold = 60 min for refrigerated spaces below 5 F. Recorded as text only: not modelled, there
//   is no freezer room type (2025 N2-only: not pulled, key absent).
// 2025: held. 2022 keeps the 2019 numbering (the renumber to §8.2.4 is 2025). Verified for 2022 (FP Lead, raw
// 13-FP006-2022-8.2.3.txt and earlier pulls): §8.2.3.2, §8.2.3.3, §8.2.3.4, §8.2.3.5 to .6, Table 8.2.3.6.1, §8.2.3.7,
// §8.2.3.8, §8.3.2.3.1.1 to .4, §8.3.2.3.2, the air test §29.2.2.1 and the refill sections. 2019: as given by the
// Lead; the air test §28.2.2.1 and the refill sections are verified, the calc route still needs verification.
// Not in the table: the 2025 acceptance wording for the refill time, §29.2.3.2.4.1 (VERIFY, from a search, not
// verbatim).
//
// NFPA 72 references (DI.REF72, FA Lead pulls of 2026-11-10). They are keyed by the NFPA 72 edition, which is its
// own site setting (W.cfg.ed72: 'auto' | '2019' | '2022' | '2025', read with DI.ed72): adoption is by the AHJ and
// can differ from the NFPA 13 edition (PRACTICE). Auto follows the NFPA 13 row. Every edition carries every key:
//   ipFail      a single performance-based path: failure annunciated within 60 min
//   multiFail   multiple paths: failure of any path annunciated within 6 h. 2025 has no counterpart: its
//               §26.6.3.4(1) is a 6 h supervision interval, so the 6 h there is ASSUMED
//   dactTest    the 6 h DACT test-signal interval
//   dactMissed  a missed DACT test is a trouble [CODE]; its annunciation time is not in held text (ASSUMED 6 h)
//   dactChan    failure of either DACT channel: trouble on the other channel within 4 minutes [CODE]
//   acDelay     the delayed transmission of a primary power failure (60 to 180 min)
//   acTrouble   a primary power failure is a trouble signal
//   panelTrouble  trouble signals at the panel within 200 s
//   lowBatt     what the code says about a low battery (no threshold)
(function () {
  const r72 = (yr, o) => { const p = 'NFPA 72-' + yr + ' '; return { ipFail: p + o.ip, multiFail: p + o.multi, dactTest: p + o.test,
    dactMissed: p + o.missed + ' (a missed test is a trouble [CODE]; the 6 h annunciation time is ASSUMED, taken from the test interval ' + o.test + ')', dactChan: p + o.chan,
    acDelay: p + '§10.6.9.3', acTrouble: p + '§10.6.9.1.1', panelTrouble: p + '§10.15.1', lowBatt: 'no low-battery threshold held (' + p + '§10.6.9.1, §10.6.10.6)' }; };
  DI.REF72 = {
    2019: r72(2019, { ip: '§26.6.3.3(2)', multi: '§26.6.3.4(2)', test: '§26.6.4.1.5(6)', missed: '§26.6.4.2.2(H)', chan: '§26.6.4.1.4(B)(3)' }),
    2022: r72(2022, { ip: '§26.6.3.3(2)', multi: '§26.6.3.4(2)', test: '§26.6.4.2.5(6)', missed: '§26.6.4.3.2.8', chan: '§26.6.4.2.4.2(3)' }),
    2025: r72(2025, { ip: '§26.6.3.3.2(2) (annunciated per §10.15)', multi: '§26.6.3.4(1) (a 6 h supervision interval, not a failure-annunciation time: ASSUMED 6 h; 2025 annunciation time not found)',
      test: '§26.6.4.2.5(6)', missed: '§26.6.4.3.2.8', chan: '§26.6.4.2.4.2(3)' }),
  };
  DI.ED72 = ['auto', '2019', '2022', '2025'];
  const r19 = { area: 'NFPA 13-2019 §4.5', delivery: 'NFPA 13-2019 §8.2.3', timedTest: 'NFPA 13-2019 §8.2.3.2', noQod: 'NFPA 13-2019 §8.2.3.3', qod: 'NFPA 13-2019 §8.2.3.4',
    calc: 'NFPA 13-2019 §8.2.3.5 to .6 (VERIFY)', table: 'NFPA 13-2019 Table 8.2.3.6.1', di: 'NFPA 13-2019 §8.3.2.3.1.1', diQod: 'NFPA 13-2019 §8.3.2.3.2', airTest: 'NFPA 13-2019 §28.2.2.1',
    refill: 'NFPA 13-2019 §8.2.6.3.2', refillN2: 'NFPA 13-2019 §8.2.6.8.4', refillAnnex: 'NFPA 13-2019 A.8.2.6.3.2', refillCold: 'NFPA 13-2019 §8.2.6.3.3', refillN2Cold: 'NFPA 13-2019 §8.2.6.8.5' };
  const d19 = ['Dry water delivery is §8.2.3.2 to §8.2.3.4 / Table 8.2.3.6.1 (2025: §8.2.4 / Table 8.2.4.3.2).', 'System area limit is §4.5 (2025: §4.4).',
    'The 24 h air test is cited as §28.2.2.1 (2025: §29.2.2.1).', 'The 30 min air refill is §8.2.6.3.2 (2025: §8.2.7.3).'];
  DI.JURIS = {
    'US-2025': { country: 'US', nfpa13: 2025, nfpa72: 2025, area: 52000, nfpa76Adopted: false,
      ref: { area: 'NFPA 13-2025 §4.4.1', delivery: 'NFPA 13-2025 §8.2.4', timedTest: 'NFPA 13-2025 §8.2.4.2', noQod: 'NFPA 13-2025 §8.2.4.2.1', qod: 'NFPA 13-2025 §8.2.4.2.2',
        calc: 'NFPA 13-2025 §8.2.4.3.1', table: 'NFPA 13-2025 Table 8.2.4.3.2', manifold: 'NFPA 13-2025 §8.2.4.4', otherTimes: 'NFPA 13-2025 §8.2.4.5',
        di: 'NFPA 13-2025 §8.3.2.3.1.1', diQod: 'NFPA 13-2025 §8.3.2.3.2', airTest: 'NFPA 13-2025 §29.2.2.1', refill: 'NFPA 13-2025 §8.2.7.3',
        refillAnnex: 'NFPA 13-2025 A.8.2.7.3', refillCold: 'NFPA 13-2025 §8.2.7.4' }, delta: [] },
    'US-2022': { country: 'US', nfpa13: 2022, nfpa72: 2022, area: 52000, nfpa76Adopted: false,
      ref: { area: 'NFPA 13-2022 §4.4', delivery: 'NFPA 13-2022 §8.2.3', timedTest: 'NFPA 13-2022 §8.2.3.2', noQod: 'NFPA 13-2022 §8.2.3.3', qod: 'NFPA 13-2022 §8.2.3.4',
        calc: 'NFPA 13-2022 §8.2.3.5 to .6', table: 'NFPA 13-2022 Table 8.2.3.6.1', manifold: 'NFPA 13-2022 §8.2.3.7', otherTimes: 'NFPA 13-2022 §8.2.3.8',
        di: 'NFPA 13-2022 §8.3.2.3.1.1 to .4', diQod: 'NFPA 13-2022 §8.3.2.3.2', airTest: 'NFPA 13-2022 §29.2.2.1', refill: 'NFPA 13-2022 §8.2.6.3.2', refillN2: 'NFPA 13-2022 §8.2.6.8.4',
        refillAnnex: 'NFPA 13-2022 A.8.2.6.3.2', refillCold: 'NFPA 13-2022 §8.2.6.3.3', refillN2Cold: 'NFPA 13-2022 §8.2.6.8.5' },
      delta: ['2022 keeps the 2019 numbering for delivery (§8.2.3.x); the renumber to §8.2.4 is 2025. Verified for 2022: §8.2.3.2, §8.2.3.3, §8.2.3.4, §8.2.3.5 to .6, Table 8.2.3.6.1, §8.2.3.7, §8.2.3.8, §8.3.2.3.1.1 to .4, §8.3.2.3.2 and the air test §29.2.2.1.', 'The 30 min air refill is §8.2.6.3.2 (2025: §8.2.7.3).'] },
    'US-2019': { country: 'US', nfpa13: 2019, nfpa72: 2019, area: 52000, nfpa76Adopted: false, ref: r19, delta: d19 },
    // Canada: data row only, never offered in the menu. Same references as US-2019. Its NFPA 72 setting is ignored (auto).
    'CA-2019': { country: 'CA', nfpa13: 2019, nfpa72: 2019, area: 52000, nfpa76Adopted: false, hidden: true, ref: r19, delta: d19,
      note: 'ASSUMED: NFPA 13-2019 via NBC 2020 / BCBC 2024; verify before ship' },
  };
})();
// Water-delivery numbers (same values in 2019 and 2025, FP Lead). Volumes are full zone volume in gallons
// (pipe + fittings % + trim, see DI.zoneVolume). timed = the trip-test clock in seconds. table = the calc /
// table route by hazard, shown for information only (not modelled). fm = the FM Global limit at any volume
// for dry and double interlock (FM DS 5-32; NEEDS PE REVIEW), applied only when the site insurer is FM.
DI.DELIVERY = { timed: 60, dry: 500, dryQod: 750, di: 500, fm: 30, fmRef: 'FM DS 5-32',
  table: { LH: 60, OH1: 50, OH2: 50, EH1: 45 } };
DI.EDITION_DEFAULT = 'US-2025';
DI.juris = DI.JURIS[DI.EDITION_DEFAULT];          // site setting, default 2025
// editions the site-settings menu offers (hidden rows are never listed)
DI.editionChoices = () => Object.keys(DI.JURIS).filter((k) => !DI.JURIS[k].hidden).sort();
// Resolve the active jurisdiction from a world's site settings. NFPA 76 adoption is a per-site flag.
DI.setJuris = function (W) {
  const c = (W && W.cfg) || {}, row = DI.JURIS[c.edition] || DI.JURIS[DI.EDITION_DEFAULT];
  DI.juris = c.nfpa76Adopted ? Object.assign({}, row, { nfpa76Adopted: true }) : row;
  return DI.juris;
};
// NFPA 72 edition of the site: the stored year, or (auto, an old save, an unknown value, or a Canadian row, where the
// setting is ignored) the NFPA 72 year paired with the active NFPA 13 row. DI.ref72(W) is that edition's citations.
DI.ed72 = function (W) {
  const c = (W && W.cfg) || {}, row = DI.JURIS[c.edition] || DI.JURIS[DI.EDITION_DEFAULT];
  return row.country === 'US' && c.ed72 !== 'auto' && DI.ED72.includes(c.ed72) ? +c.ed72 : row.nfpa72;
};
DI.ref72 = (W) => DI.REF72[DI.ed72(W)];
// citation helper: 'NFPA 13-<edition> <tail>'
DI.ref13 = (tail) => 'NFPA 13-' + DI.juris.nfpa13 + (tail ? ' ' + tail : '');

// NFPA 76 ceilings, applied only where the site has adopted NFPA 76 (NFPA 76-2024 §8.5.3.1.2.5, as given by the
// FA Lead): Alert at 0.2 %/ft or less, and the alarm ceiling of 1.0 %/ft applied to Fire 1, the first alarm stage.
// Action stays pre-alarm and Fire 2 has no NFPA 76 limit. PRACTICE, NEEDS PE REVIEW. They are ceilings to check
// against (DI.n76Flags, DI.n76Check): nothing ever writes them into a threshold.
DI.PRESETS = { nfpa76: { alert: 0.2, alarm: 1.0 } };
