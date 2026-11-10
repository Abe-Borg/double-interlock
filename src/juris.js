// Jurisdiction / enforced edition table. The US edition of NFPA 13 is a site setting (W.cfg.edition).
// In this cycle the edition changes citations and the delta note only; pass/fail does not differ.
// Section numbers are the ones held in the DC FP training. Do not add others without verifying them.
var DI = globalThis.DI || (globalThis.DI = {});

DI.JURIS = {
  'US-2025': { country: 'US', nfpa13: 2025, area: 52000, nfpa76Adopted: false,
    ref: { area: 'NFPA 13-2025 §4.4.1', delivery: 'NFPA 13-2025 §8.2.4', di: 'NFPA 13-2025 §8.3.2.3.1.1' }, delta: [] },
  'US-2022': { country: 'US', nfpa13: 2022, area: 52000, nfpa76Adopted: false,
    ref: { area: 'NFPA 13-2022 §4.4', delivery: 'NFPA 13-2022 §8.2.3.4', di: 'NFPA 13-2022 §8.3.2.3' },
    delta: ['Dry water delivery is §8.2.3.4 / Table 8.2.3.6.1 (2025: §8.2.4).'] },
  'US-2019': { country: 'US', nfpa13: 2019, area: 52000, nfpa76Adopted: false,
    ref: { area: 'NFPA 13-2019 §4.5', delivery: 'NFPA 13-2019 §8.2.3', di: 'NFPA 13-2019 §8.3.2.3.1.1' },
    delta: ['Dry water delivery is §8.2.3 / Table 8.2.3.6.1 (2025: §8.2.4).', 'System area limit is §4.5 (2025: §4.4).'] },
  // Canada: data row only, never offered in the menu. Same references as US-2019.
  'CA-2019': { country: 'CA', nfpa13: 2019, area: 52000, nfpa76Adopted: false, hidden: true,
    ref: { area: 'NFPA 13-2019 §4.5', delivery: 'NFPA 13-2019 §8.2.3', di: 'NFPA 13-2019 §8.3.2.3.1.1' },
    delta: ['Dry water delivery is §8.2.3 / Table 8.2.3.6.1 (2025: §8.2.4).', 'System area limit is §4.5 (2025: §4.4).'],
    note: 'ASSUMED: NFPA 13-2019 via NBC 2020 / BCBC 2024; verify before ship' },
};
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
