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
//   (not pulled for 2025: the key is absent there and the text says so, see DI.refillRef).
// 2025: held. 2022 keeps the 2019 numbering (the renumber to §8.2.4 is 2025). Verified for 2022: Table 8.2.3.6.1,
// §8.2.3.7, §8.3.2.3.1.1 to .4, §8.3.2.3.2 and the air test §29.2.2.1. Still carried from 2019 for 2022 and marked
// (ASSUMED, VERIFY): §8.2.3.2, §8.2.3.3, §8.2.3.4, §8.2.3.5 to .6 and §8.2.3.8. 2019: as given by the Lead; the air
// test §28.2.2.1 is verified, the calc route still needs verification.
//
// NFPA 72 timing references (ref72, FA Lead pull of 2026-11-10). ASSUMED: the NFPA 72 edition follows the site's
// NFPA 13 edition; a real AHJ adopts them separately.
//   commIp / commMulti / commDact = when the supervising station annunciates the loss of a path, per path type
//   (DI.COMM_PATH), acDelay = the delayed transmission of a primary power failure, trouble = trouble signals at the
//   panel within 200 s, lowBatt = what the code says about a low battery (no threshold).
(function () {
  const AV = ' (ASSUMED, VERIFY)';
  const r72 = (yr, ip, multi, dact) => { const p = 'NFPA 72-' + yr + ' '; return { commIp: p + ip, commMulti: p + multi, commDact: p + dact + ' (6 h test interval used as the delay: ASSUMED, VERIFY)',
    acDelay: p + '§10.6.9.3', trouble: p + '§10.15.1', lowBatt: 'no low-battery threshold held (' + p + '§10.6.9.1, §10.6.10.6)' }; };
  const r19 = { area: 'NFPA 13-2019 §4.5', delivery: 'NFPA 13-2019 §8.2.3', timedTest: 'NFPA 13-2019 §8.2.3.2', noQod: 'NFPA 13-2019 §8.2.3.3', qod: 'NFPA 13-2019 §8.2.3.4',
    calc: 'NFPA 13-2019 §8.2.3.5 to .6 (VERIFY)', table: 'NFPA 13-2019 Table 8.2.3.6.1', di: 'NFPA 13-2019 §8.3.2.3.1.1', diQod: 'NFPA 13-2019 §8.3.2.3.2', airTest: 'NFPA 13-2019 §28.2.2.1',
    refill: 'NFPA 13-2019 §8.2.6.3.2', refillN2: 'NFPA 13-2019 §8.2.6.8.4' };
  const d19 = ['Dry water delivery is §8.2.3.2 to §8.2.3.4 / Table 8.2.3.6.1 (2025: §8.2.4 / Table 8.2.4.3.2).', 'System area limit is §4.5 (2025: §4.4).',
    'The 24 h air test is cited as §28.2.2.1 (2025: §29.2.2.1).', 'The 30 min air refill is §8.2.6.3.2 (2025: §8.2.7.3).'];
  const t19 = r72(2019, '§26.6.3.3(2)', '§26.6.3.4(2)', '§26.6.4.1.5(6), §26.6.4.2.2(H)');
  DI.JURIS = {
    'US-2025': { country: 'US', nfpa13: 2025, nfpa72: 2025, area: 52000, nfpa76Adopted: false,
      ref: { area: 'NFPA 13-2025 §4.4.1', delivery: 'NFPA 13-2025 §8.2.4', timedTest: 'NFPA 13-2025 §8.2.4.2', noQod: 'NFPA 13-2025 §8.2.4.2.1', qod: 'NFPA 13-2025 §8.2.4.2.2',
        calc: 'NFPA 13-2025 §8.2.4.3.1', table: 'NFPA 13-2025 Table 8.2.4.3.2', manifold: 'NFPA 13-2025 §8.2.4.4', otherTimes: 'NFPA 13-2025 §8.2.4.5',
        di: 'NFPA 13-2025 §8.3.2.3.1.1', diQod: 'NFPA 13-2025 §8.3.2.3.2', airTest: 'NFPA 13-2025 §29.2.2.1', refill: 'NFPA 13-2025 §8.2.7.3' },
      ref72: r72(2025, '§26.6.3.3.2(2) (annunciated per §10.15)', '§26.6.3.4(1) (6 h supervision interval; annunciation time not found in 2025, VERIFY)', '§26.6.4.2.5(6), §26.6.4.3.2.8'), delta: [] },
    'US-2022': { country: 'US', nfpa13: 2022, nfpa72: 2022, area: 52000, nfpa76Adopted: false, verify: true,
      ref: { area: 'NFPA 13-2022 §4.4', delivery: 'NFPA 13-2022 §8.2.3', timedTest: 'NFPA 13-2022 §8.2.3.2' + AV, noQod: 'NFPA 13-2022 §8.2.3.3' + AV, qod: 'NFPA 13-2022 §8.2.3.4' + AV,
        calc: 'NFPA 13-2022 §8.2.3.5 to .6' + AV, table: 'NFPA 13-2022 Table 8.2.3.6.1', manifold: 'NFPA 13-2022 §8.2.3.7', otherTimes: 'NFPA 13-2022 §8.2.3.8' + AV,
        di: 'NFPA 13-2022 §8.3.2.3.1.1 to .4', diQod: 'NFPA 13-2022 §8.3.2.3.2', airTest: 'NFPA 13-2022 §29.2.2.1', refill: 'NFPA 13-2022 §8.2.6.3.2', refillN2: 'NFPA 13-2022 §8.2.6.8.4' },
      ref72: r72(2022, '§26.6.3.3(2)', '§26.6.3.4(2)', '§26.6.4.2.5(6), §26.6.4.3.2.8'),
      delta: ['2022 keeps the 2019 numbering for delivery (§8.2.3.x); the renumber to §8.2.4 is 2025. Verified for 2022: Table 8.2.3.6.1, §8.2.3.7, §8.3.2.3.1.1 to .4, §8.3.2.3.2 and the air test §29.2.2.1. Still carried from 2019 and marked ASSUMED, VERIFY: §8.2.3.2, §8.2.3.3, §8.2.3.4, §8.2.3.5 to .6 and §8.2.3.8.', 'The 30 min air refill is §8.2.6.3.2 (2025: §8.2.7.3).'] },
    'US-2019': { country: 'US', nfpa13: 2019, nfpa72: 2019, area: 52000, nfpa76Adopted: false, ref: r19, ref72: t19, delta: d19 },
    // Canada: data row only, never offered in the menu. Same references as US-2019.
    'CA-2019': { country: 'CA', nfpa13: 2019, nfpa72: 2019, area: 52000, nfpa76Adopted: false, hidden: true, ref: r19, ref72: t19, delta: d19,
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
// citation helper: 'NFPA 13-<edition> <tail>'
DI.ref13 = (tail) => 'NFPA 13-' + DI.juris.nfpa13 + (tail ? ' ' + tail : '');

// NFPA 76 ceilings, applied only where the site has adopted NFPA 76 (NFPA 76-2024 §8.5.3.1.2.5, as given by the
// FA Lead): Alert at 0.2 %/ft or less, and the alarm ceiling of 1.0 %/ft applied to Fire 1, the first alarm stage.
// Action stays pre-alarm and Fire 2 has no NFPA 76 limit. PRACTICE, NEEDS PE REVIEW. They are ceilings to check
// against (DI.n76Flags, DI.n76Check): nothing ever writes them into a threshold.
DI.PRESETS = { nfpa76: { alert: 0.2, alarm: 1.0 } };
