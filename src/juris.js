// Jurisdiction / enforced edition table. The US edition of NFPA 13 is a site setting (W.cfg.edition).
// The edition changes citations and the delta note only; pass/fail does not differ.
// Section numbers are the ones held in the DC FP training. Do not add others without verifying them.
var DI = globalThis.DI || (globalThis.DI = {});

// Water-delivery references per edition (FP Lead): timedTest = the 60 s timed trip test, noQod = the dry
// exemption without a quick-opening device, qod = the dry exemption with one, table = the calc / table
// route, di = the double-interlock size exemption, diQod = a QOD may help a double-interlock system meet
// 60 s (it does not extend the 500 gal). 2019 and 2025 are as given by the Lead; the paragraph numbers
// inside 2025 §8.2.4 and every 2022 number are not verified, so those stay at section level and the 2022
// row is marked VERIFY.
(function () {
  const r19 = { area: 'NFPA 13-2019 §4.5', delivery: 'NFPA 13-2019 §8.2.3', timedTest: 'NFPA 13-2019 §8.2.3.2', noQod: 'NFPA 13-2019 §8.2.3.3', qod: 'NFPA 13-2019 §8.2.3.4',
    table: 'NFPA 13-2019 Table 8.2.3.6.1', di: 'NFPA 13-2019 §8.3.2.3.1.1', diQod: 'NFPA 13-2019 §8.3.2.3.2' };
  const d19 = ['Dry water delivery is §8.2.3.2 to §8.2.3.4 / Table 8.2.3.6.1 (2025: §8.2.4 / Table 8.2.4.3.2).', 'System area limit is §4.5 (2025: §4.4).'];
  DI.JURIS = {
    'US-2025': { country: 'US', nfpa13: 2025, area: 52000, nfpa76Adopted: false,
      ref: { area: 'NFPA 13-2025 §4.4.1', delivery: 'NFPA 13-2025 §8.2.4', timedTest: 'NFPA 13-2025 §8.2.4', noQod: 'NFPA 13-2025 §8.2.4', qod: 'NFPA 13-2025 §8.2.4',
        table: 'NFPA 13-2025 Table 8.2.4.3.2', di: 'NFPA 13-2025 §8.3.2.3.1.1', diQod: 'NFPA 13-2025 §8.3.2.3.2' }, delta: [] },
    'US-2022': { country: 'US', nfpa13: 2022, area: 52000, nfpa76Adopted: false, verify: true,
      ref: { area: 'NFPA 13-2022 §4.4', delivery: 'NFPA 13-2022 §8.2.3.4 (VERIFY)', timedTest: 'NFPA 13-2022 §8.2.3 (VERIFY)', noQod: 'NFPA 13-2022 §8.2.3 (VERIFY)', qod: 'NFPA 13-2022 §8.2.3 (VERIFY)',
        table: 'NFPA 13-2022 Table 8.2.3.6.1 (VERIFY)', di: 'NFPA 13-2022 §8.3.2.3 (VERIFY)', diQod: 'NFPA 13-2022 §8.3.2.3 (VERIFY)' },
      delta: ['Dry water delivery is cited as §8.2.3 / Table 8.2.3.6.1 (2025: §8.2.4 / Table 8.2.4.3.2). VERIFY: the 2022 delivery and double-interlock section numbers have not been checked.'] },
    'US-2019': { country: 'US', nfpa13: 2019, area: 52000, nfpa76Adopted: false, ref: r19, delta: d19 },
    // Canada: data row only, never offered in the menu. Same references as US-2019.
    'CA-2019': { country: 'CA', nfpa13: 2019, area: 52000, nfpa76Adopted: false, hidden: true, ref: r19, delta: d19,
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

// Detection threshold presets. NFPA 76 applies only where the site has adopted it.
// Alert <= 0.2 %/ft and Fire 1 <= 1.0 %/ft: NFPA 76-2024 §8.5.3.1.2.5 (as given by the FA Lead).
// action is an ASSUMED example, used only when the site's Action value does not fit between them.
DI.PRESETS = { nfpa76: { alert: 0.2, fire1: 1.0, action: 0.6 } };
