// node test/ui.c8.js [out.png] - Cycle 8 browser checks (Playwright): the NAC voltage-drop block on the panel (off by
// default, the FAIL and THIN cases, the longest passing length, labels by edition, NEC 2026, the Canadian hold), the Site
// rows (NEC edition, owner / insurer refill target) and the owner warning in plan review, the drill report (code check
// above the measured line, the shared note, the realism lines, the other-drains line), the neutral refill rows, Finish
// pressed three times, the compressor relief warnings, the Refrigerated Space and Telecom / MMR rooms with NFPA 76 by
// room, the latch label on the signal schedule, the station queue footnote on a 2019 site, INVESTIGATE on a 12 % drop,
// step 14 as company practice, and an old save with the NFPA 76 flag on.
// Same style as ui.c7.js: controls are operated with real mouse events; the game is paused and sim time is advanced by
// hand (S.step, S.warp), never by waiting. A screenshot is saved per new panel, next to the one named on the command line.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }); const errs = []; let fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const ok = (name, cond, note) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (note !== undefined ? '  [' + note + ']' : '')); };
  const url = 'file://' + path.resolve(__dirname, '..', process.env.STANDALONE ? 'double-interlock.html' : 'index.html');
  const out = process.argv[2] || 'ui-c8.png', shot = (tag) => p.screenshot({ path: tag ? out.replace(/(\.png)?$/, '-' + tag + '.png') : out });
  await p.goto(url); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  const ev = (fn, arg) => p.evaluate(fn, arg), tick = () => p.waitForTimeout(450);        // one inspector / annunciator refresh
  // These checks read signal rows, so open the monitor that starts collapsed in normal play.
  const start = async (id) => { await ev((i) => { DI.startScenario(i, true); DI.ui.close(); DI.setSpeed(0); }, id); await tick(); if (await p.locator('#bAnnToggle').getAttribute('aria-expanded') === 'false') await p.click('#bAnnToggle'); };
  const step = (sec, dt) => ev(([s, d]) => { const S = DI.game.S; for (let t = 0; t < s - 1e-9; t += d) S.step(d); }, [sec, dt || 0.25]);
  const sel = async (id) => { await ev((i) => { DI.game.sel = { kind: 'part', id: i }; DI.inspect.render(true); }, id); await tick(); };
  const selTile = async (k) => { await ev((q) => { DI.game.sel = { kind: 'tile', k: q }; DI.inspect.render(true); }, k); await tick(); };
  const btn = (text) => p.locator('#side button', { hasText: text });
  // the sandbox toolbar is tall and can cover the foot of the inspector: bring the button to the middle first
  const press = async (text) => { const e = btn(text).first(); await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await e.click(); await tick(); };
  const row = (label) => ev((l) => { const r = [...document.querySelectorAll('#side .row')].find((e) => e.firstChild.textContent.startsWith(l)); return r ? r.lastChild.textContent : null; }, label);
  const rowCls = (label) => ev((l) => { const r = [...document.querySelectorAll('#side .row')].find((e) => e.firstChild.textContent.startsWith(l)); return r ? r.lastChild.className : null; }, label);
  const queue = () => ev(() => [...document.querySelectorAll('#stq .stq')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  const logText = () => ev(() => [...document.querySelectorAll('#log div')].map((e) => e.innerText).join('\n'));
  const on = async (id, text) => { await sel(id); await press(text); };            // select a part and press one of its buttons
  const site = async () => { await p.click('#bSite'); await tick(); }, closeModal = async () => { await ev(() => DI.ui.close()); await tick(); };
  const opts = (k) => ev((key) => [...document.querySelectorAll('#mbox button[data-s="' + key + '"]')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')).join('|'), k);
  const pick = async (k, v) => { await p.locator('#mbox button[data-s="' + k + '"][data-v="' + v + '"]').click(); await tick(); };
  const text = (q) => ev((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, q);
  const cfg = () => ev(() => JSON.parse(JSON.stringify(DI.game.W.cfg)));
  const results = () => ev(() => [...document.querySelectorAll('#side .res')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  // the plan review dialog: every finding as { sev, text }
  const review = async () => { await p.click('#bReview'); await tick(); const f = await ev(() => [...document.querySelectorAll('#mbox .find')].map((e) => ({ sev: e.className.replace('find', '').trim(), text: e.innerText.replace(/\s+/g, ' ') }))); await closeModal(); return f; };
  const setP = async (id, props) => { await ev(([i, pr]) => { const G = DI.game; Object.assign(G.W.parts.get(i).p, pr); G.W.ver++; G.S.touch(); DI.edited(); }, [id, props]); await sel(id); };
  const TAGS = /p-latch|finish-early|main-drain-flow|drain-open|water-flow|low-air(?! supervisory)/;       // internal names: never player text
  // a rig in the sandbox: campus loop tap, control valve, preaction valve, half of Data Hall A, compressor, panel, aspirating
  // detector and a manual release station in the hall. two = a second (dry) valve on the same compressor.
  const rig = async (props, two) => { await start('s0'); const ids = await ev(([pr, tw]) => {
    const G = DI.game, W = G.W, m = DI.mk(W);
    m.p('city', 28, 27, 0, { stat: 90, resid: 70, flow: 1500, fixed: true }); m.h(29, 31, 27, 6); const g = m.p('gate', 32, 27); m.h(33, 33, 27, 6);
    const v = m.p('prev', 34, 27, 0, pr || undefined); m.h(35, 36, 27, 6); m.v(36, 25, 26, 6);
    const d = m.p('vesda', 42, 11), st = m.p('mstn', 41, 11), pn = m.p('panel', 30, 29), c = m.p('comp', 34, 29, 0, { scfm: 10 }); m.air([[34, 28]]);
    m.v(36, 11, 24, 5, true); m.grid(30, 11, 35, 24, 2, 1); m.grid(37, 11, 42, 24, 2, 1); m.wire(pn, g, v, d, st);
    let v2 = null; if (tw) { m.air([[34, 30]]); v2 = m.p('dryv', 34, 31); }
    G.S.sync(); G.S.commission(); G.S.live = true; G.S.rv = DI.review(G.S);
    return { v: v.id, g: g.id, pn: pn.id, d: d.id, st: st.id, c: c.id, v2: v2 ? v2.id : 0, head: W.k(39, 16), room: W.roomAt[W.k(39, 16)] };
  }, [props || null, !!two]); await tick(); return ids; };
  const P30 = { airSet: 30, loAir: 25, hiAir: 45 }, FIN = 'Finish return to normal';
  const airTest = async (r) => { await on(r.v, '24 h air test'); await ev(() => DI.game.S.warp(86500 + DI.AIR_TEST.chargeMax)); await tick(); await sel(r.v); };

  // ---- 1. The NAC block on the panel: off by default, the FAIL case, the THIN case, the longest passing length, a given start
  let r = await rig(); await sel(r.pn);
  const nacOff = { btn: await btn('NAC voltage-drop check: off').count(), verdict: await row('NAC verdict'), gauge: await btn('14 AWG').count() }, rv0 = await review();
  ok('NAC: the panel shows the block off by default, with no pickers, no rows and no plan review finding', nacOff.btn === 1 && nacOff.verdict === null && nacOff.gauge === 0 && !rv0.some((f) => /NAC/.test(f.text)) && (await text('#side')).includes('NOTIFICATION CIRCUIT (NAC), CLASS B, END-LINE-LOADED'));
  await sel(r.pn); await press('NAC voltage-drop check: off'); await sel(r.pn);
  const labels = await ev(() => [...document.querySelectorAll('#side .row')].map((e) => e.firstChild.textContent));
  ok('NAC: switched on, the pickers and the rows are there', (await btn('NAC voltage-drop check: ON').count()) === 1 && ['Wire gauge (AWG)', 'One-way length', 'Appliances', 'Appliance current', 'Total current', 'Circuit resistance', 'Voltage drop', 'Voltage at the last appliance', 'Margin', 'Longest one-way length that passes', 'Basis', 'NAC verdict'].every((l) => labels.includes(l)) &&
    labels.some((l) => l.startsWith('Candela')) && labels.some((l) => l.startsWith('Start voltage at the panel or module terminals')) && (await btn('14 AWG').count()) === 1 && (await btn('75 cd').count()) === 1 && (await btn('not given').count()) === 1);
  // the FAIL case: 14 x 75 cd, 600 ft of 14 AWG, start not given
  await setP(r.pn, { nacN: 14, nacFt: 600, nacAwg: 14, nacCd: 75, nacV: 0 });
  const fV = await row('Voltage at the last appliance'), fVerdict = await row('NAC verdict'), fCls = await rowCls('NAC verdict'), rvF = await review(), fFind = rvF.find((f) => /NAC/.test(f.text));
  ok('NAC: 14 x 75 cd on 600 ft of 14 AWG shows 9.85 V and the FAIL verdict, and the plan review list carries a FAIL line naming the panel', /^9\.85 V \(minimum 16 V\)$/.test(fV) && /^FAIL: below the appliance listed minimum of 16 V/.test(fVerdict) && fCls === 'bad' && !!fFind && fFind.sev === 'fail' && fFind.text.startsWith('Panel #' + r.pn + ' NAC (Class B, end-line-loaded): 14 x 75 cd') && /9\.85 V at the last appliance/.test(fFind.text) &&
    (await row('Circuit resistance')) === '3.768 ohm' && (await row('Total current')) === '2.80 A', fV + ' | ' + fVerdict);
  // the passing case with a thin margin: 7 x 75 cd, 12 AWG (the gauge by a real click), 600 ft
  await setP(r.pn, { nacN: 7 }); await press('12 AWG'); await sel(r.pn);
  const tV = await row('Voltage at the last appliance'), tVerdict = await row('NAC verdict'), tMax = await row('Longest one-way length that passes'), tMargin = await row('Margin'), rvT = (await review()).find((f) => /NAC/.test(f.text));
  ok('NAC: 7 x 75 cd on 600 ft of 12 AWG shows 17.07 V and a THIN warning, not a FAIL; the longest passing length is shown', /^17\.07 V \(minimum 16 V\)$/.test(tV) && /^THIN: margin 6\.7 %, under 20 % above the 16 V minimum \(PRACTICE, NEEDS PE REVIEW\); the start voltage is ASSUMED/.test(tVerdict) && tMax === '793.6 ft' && /^6\.7 % \(THIN: under 20 %\)$/.test(tMargin) && !!rvT && rvT.sev === 'warn' &&
    (await rowCls('NAC verdict')) === 'warn' && (await ev((id) => DI.game.W.parts.get(id).p.nacAwg, r.pn)) === 12, tV + ' | ' + tVerdict + ' | ' + tMax);
  await shot('nac');
  // a given start voltage removes the ASSUMED warning
  await press('24.0 V'); await sel(r.pn); const gVerdict = await row('NAC verdict'), gStart = await row('Start voltage used'), rvG = (await review()).find((f) => /NAC/.test(f.text));
  ok('NAC: a given start voltage (24.0 V) removes the ASSUMED warning: the verdict passes and plan review carries one information line', /^passes: margin 29\.2 % above the 16 V minimum$/.test(gVerdict) && gStart === '24.0 V (given)' && !/ASSUMED/.test(gVerdict) && !!rvG && rvG.sev === 'info' && /documentation list \(NFPA 72-2025 §7\.2\.1\(8\) \[CODE\]\)/.test(rvG.text), gVerdict + ' | ' + gStart + ' | ' + (rvG && rvG.sev + ': ' + rvG.text));

  // ---- 2. NAC labels: by NFPA 72 edition, NEC 2026, and the Canadian hold
  await sel(r.pn); const b25 = await row('Basis'); await ev(() => DI.ui.siteSet('ed', 'US-2022')); await sel(r.pn); const b22 = await row('Basis'); await ev(() => DI.ui.siteSet('ed', 'US-2019')); await sel(r.pn); const b19 = await row('Basis'); await ev(() => DI.ui.siteSet('ed', 'US-2025'));
  ok('NAC labels: US-2025 shows [CODE] and the section range; US-2022 and US-2019 show PRACTICE; all three name the documentation item', b25 === 'NFPA 72-2025 §18.3.7.1 to §18.3.7.6 [CODE]; documentation item NFPA 72-2025 §7.2.1(8)' && /^PRACTICE: NFPA 72-2022 §18\.3\.7 ends at §18\.3\.7\.2; .*documentation item NFPA 72-2022 §7\.2\.1\(8\)$/.test(b22) && /^PRACTICE: NFPA 72-2019 has no §18\.3\.7; .*documentation item NFPA 72-2019 §7\.2\.1\(8\)$/.test(b19), b22);
  await sel(r.pn); const w23 = await row('Wire resistance'); await ev(() => DI.ui.siteSet('nec', '2026')); await sel(r.pn); const w26 = await row('Wire resistance'), v26 = await row('NAC verdict'), rv26 = (await review()).find((f) => /NAC/.test(f.text)); await ev(() => DI.ui.siteSet('nec', '2023'));
  ok('NAC labels: on NEC 2026 the wire row and the finding read "2023 Table 8 ohms: ASSUMED / VERIFY", never 2026 code, and the verdict is unchanged', w23 === '1.98 ohm per 1000 ft: NFPA 70-2023 Ch. 9 Table 8, 75 C, uncoated stranded copper [CODE NEC 2023]' && w26 === '1.98 ohm per 1000 ft: 2023 Table 8 ohms: ASSUMED / VERIFY (NEC 2026 Table 8 is on hold), never 2026 code' && v26 === gVerdict && rv26.sev === 'info' && /ASSUMED \/ VERIFY/.test(rv26.text) && !('nec' in (await cfg())), w26);
  await ev(() => { const G = DI.game; G.W.cfg.edition = 'CA-2019'; G.W.ver++; G.S.touch(); DI.edited(); }); await sel(r.pn); const hold = await text('#nacHold'), caVerdict = await row('NAC verdict'), rvCa = (await review()).find((f) => /NAC/.test(f.text));
  ok('NAC labels: a CA-2019 world shows the on-hold text and no verdict, in the panel and in plan review', hold === 'NAC voltage drop is on hold on a Canadian build: CAN/ULC-S524 and CEC Section 32 are not held. CA-2019 is the NFPA 72-2019 label only.' && caVerdict === null && !!rvCa && rvCa.sev === 'info' && rvCa.text.includes(hold) && !/FAIL|Passes|THIN/.test(rvCa.text), hold);
  await ev(() => { const G = DI.game; delete G.W.cfg.edition; G.W.ver++; G.S.touch(); DI.edited(); });

  // ---- 3. Site dialog: the NEC row and the owner / insurer refill target; the owner warning in plan review
  await setP(r.pn, { nacOn: 0 }); await site();
  const necOpts = await opts('nec'), ownOpts = await opts('own'), ownNote = await text('#ownNote'), necNote = await text('#necNote');
  ok('site: the NEC row and the Owner / insurer refill target row are there (picks none, 10, 15, 20, 25, labelled ASSUMED)', necOpts === 'NEC 2023 (default)*|NEC 2026' && ownOpts === 'None*|10 min|15 min|20 min|25 min' && /ASSUMED/.test(ownNote) && /warning tagged owner\/insurer criterion, not a code failure/.test(ownNote) && /Owner \/ insurer refill target \(optional; minutes; ASSUMED picks\)/.test(await text('#mbox')) && /plan review check only/.test(necNote), ownOpts);
  await shot('site'); await closeModal();
  // a compressor sized so that the largest zone alone fills in about 18 min: inside the 30 min code limit, over a 15 min target
  const tA = await ev(([vid, cid]) => { const G = DI.game, S = G.S, az = DI.airSizing(S, vid), c = G.W.parts.get(cid); c.p.scfm = az.have * az.tAlone / 18; G.W.ver++; S.touch(); DI.edited(); return DI.airSizing(S, vid).tAlone; }, [r.v, r.c]);
  await sel(r.v); const ownRow0 = await row('Owner / insurer refill target');
  await site(); await pick('own', '15'); const c15 = await cfg(); await closeModal(); const rvOwn = await review(), ow = rvOwn.filter((f) => /Owner\/insurer criterion/.test(f.text)); await sel(r.v); const ownRow = await row('Owner / insurer refill target'), ownCls = await rowCls('Owner / insurer refill target');
  ok('site: a 15 min target on a build whose largest zone alone fills in 18 min raises the owner warning in the review list, and not a FAIL', Math.abs(tA - 18) < 0.01 && c15.ownerRefill === 15 && ow.length === 1 && ow[0].sev === 'warn' && /^Owner\/insurer criterion: the largest zone alone fills in 18\.0 min against the owner\/insurer target of 15 min\. The code limit of 30 min is met, so this is a warning, not a code failure\./.test(ow[0].text) && !rvOwn.some((f) => f.sev === 'fail' && /air supply|Owner/.test(f.text)) && ownRow0 === null && ownRow === '15 min: not met (largest zone alone 18.0 min); owner/insurer criterion, not a code limit' && ownCls === 'warn', ow[0] && ow[0].text);
  await site(); await pick('own', '0'); const c0 = await cfg(); await closeModal();
  ok('site: "None" stores nothing and the warning is gone', !('ownerRefill' in c0) && !(await review()).some((f) => /Owner\/insurer/.test(f.text)));

  // ---- 4. The compressor inspector: the relief warnings
  await setP(r.c, { scfm: 10, relief: 60, cutOut: 75, maxPsi: 0 }); const rc1 = await row('Relief check'), rcCls = await rowCls('Relief check');
  await setP(r.c, { relief: 125, cutOut: 0, maxPsi: 100 }); const rc2 = await row('Relief check'), rvRc = (await review()).filter((f) => /^Compressor #\d+ relief/.test(f.text));
  await shot('comp'); await setP(r.c, { relief: 0, maxPsi: 0 }); const rc0 = await row('Relief check');
  ok('compressor: the inspector shows the relief warnings for relief 60 with cut-out 75 and for relief 125 with a rated max of 100; plan review carries them as warnings, never a fail; the defaults raise nothing', /relief \(60 psi\) is at or below the cut-out 75 psi: the relief will lift during normal operation\./.test(rc1) && rcCls === 'warn' && /relief \(125 psi\) is above its rated max discharge \(100 psi\)\./.test(rc2) && rvRc.length === 1 && rvRc[0].sev === 'warn' && rc0 === 'no relief set', rc1 + ' | ' + rc2);

  // ---- 5. Rooms: Refrigerated Space, and Telecom / MMR with NFPA 76 by room
  const coldK = await ev(() => { const W = DI.game.W, room = W.rooms.find((q) => q.type === 'cold'); return room ? W.k(room.x + 2, room.y + 2) : -1; }); await selTile(coldK);
  const coldTitle = await text('#side h3'), coldRow = await row('Held below 5 F (freezer)'), coldTip = await ev(() => { const e = [...document.querySelectorAll('#side .row')].find((x) => x.firstChild.textContent.startsWith('Held below 5 F')); return e ? e.title : ''; });
  ok('room: the type reads "Refrigerated Space", with the "Held below 5 F (freezer)" row and the 35 F note', coldK >= 0 && /^Refrigerated Space/i.test(coldTitle) && (await ev(() => DI.game.W.rooms.find((q) => q.type === 'cold').name)) === 'Refrigerated Space' && coldRow === 'no: a cooled space (a 35 F dock, for example) does not qualify: 30 min' && /a 35 F dock, for example\) does not qualify and stays at 30 min: the room type alone never qualifies/.test(coldTip) && (await btn('Held below 5 F: no').count()) === 1, coldTitle + ' | ' + coldRow);
  // the detector's hall with the site flag on and a VEA site pick of 1.23: nothing in a hall
  await ev(() => { DI.ui.siteSet('asd', 'VEA'); DI.ui.siteSet('n76', '1'); DI.ui.siteSet('vea', '1.23'); }); await sel(r.d); const hall76 = await row('NFPA 76'), hallF1 = await row('Fire 1'), rvHall = (await review()).filter((f) => /NFPA 76 applies in/.test(f.text));
  const hallK = await ev((id) => { const W = DI.game.W, d = W.parts.get(id), room = W.room(d.x, d.y); return W.k(room.x + room.w - 2, room.y + 1); }, r.d); await selTile(hallK);
  const typeRow0 = await row('Room type'); await press('Telecom / MMR (NFPA 76 space)'); await selTile(hallK);
  const typeRow1 = await row('Room type'), appl = await row('NFPA 76 applies here (default: the site setting)'), roomF1 = await row('VEA Fire 1 in this room'), roomName = await ev((id) => { const W = DI.game.W, d = W.parts.get(id); return W.room(d.x, d.y).name + '|' + W.room(d.x, d.y).type; }, r.d);
  ok('room: a data hall is made a Telecom / MMR room on the room itself, with "NFPA 76 applies here (default: the site setting)"', typeRow0 === 'Data Hall' && typeRow1 === 'Telecom / MMR (NFPA 76 space)' && appl === 'yes (the site setting)' && roomName === 'Data Hall A|tel' && roomF1 === '1.23 %/ft (Enhanced) · site pick' && (await btn('Site setting').count()) === 1, typeRow1 + ' | ' + appl);
  await shot('room'); await sel(r.d); const tel76 = await row('NFPA 76'), rvTel = (await review()).filter((f) => /NFPA 76 applies in/.test(f.text));
  ok('room: with the site flag on, a VEA detector in the telecom room at 1.23 shows the NFPA 76 limit message naming the room, and the same detector in a hall did not', hall76 === null && rvHall.length === 0 && hallF1 === '1.23 %/ft (Enhanced) · site pick' && /^NFPA 76 applies in Data Hall A: Fire 1, the first alarm stage, must be 1\.0 %\/ft or less \(it is 1\.23\)\./.test(tel76 || '') && rvTel.length === 1 && rvTel[0].sev === 'fail', tel76);
  // the room's own "No" overrides the site flag; a room pick of 0.5 with it applying meets the ceiling
  await selTile(hallK); await press('No'); await sel(r.d); const off76 = await row('NFPA 76'); await selTile(hallK); await press('Yes'); await press('0.5 (High)'); await sel(r.d); const pick76 = await row('NFPA 76'), pickF1 = await row('Fire 1');
  ok('room: "NFPA 76 applies here: No" switches the check off for that room; back on, a room pick of 0.5 meets the ceiling', off76 === null && pick76 === 'ceiling met in Data Hall A' && pickF1 === '0.5 %/ft (High) · room pick' && !(await review()).some((f) => /NFPA 76 applies in/.test(f.text)), pick76);
  await ev((id) => { const W = DI.game.W, d = W.parts.get(id), room = W.room(d.x, d.y); room.type = 'hall'; delete room.n76; delete room.f1; W.ver++; DI.ui.siteSet('n76', '0'); DI.ui.siteSet('pre', 'reset'); DI.ui.siteSet('asd', 'VEP'); }, r.d);

  // ---- 6. Labels: the latch on the signal schedule, the station queue footnote on a 2019 site, the manual
  await site(); await p.click('#mSched'); await tick(); const latch = await text('#schedLatch'); await closeModal();
  ok('labels: the signal schedule note for the latched waterflow reads "PRACTICE with code support", with §10.11.6, §23.8.2.2 [indirect] and §10.18.1.2', /^Waterflow latches at the panel until a panel reset: PRACTICE with code support \(NFPA 72-2025 §10\.11\.6, §23\.8\.2\.2 \[indirect\], §10\.18\.1\.2\), NEEDS PE REVIEW\./.test(latch) && /is not quoted as a latch rule/.test(latch), latch);
  await ev(() => { DI.ui.siteSet('ed72', '2019'); DI.ui.siteSet('path', 'dact'); }); await sel(r.pn); await press('Fail DACT channel 1'); await press('Fail DACT channel 2'); await step(2); await on(r.st, 'Operate station'); await step(5, 1); await tick();
  const q19 = await queue(), foot19 = await text('#stqFoot'), man = await ev(() => DI.MANUAL.map((m) => m.h).join('\n'));
  ok('labels: on a 2019 site the station queue footnote cites NFPA 72-2019 §26.2.5.1, §26.2.1.2 and §26.2.2 with no VERIFY, and the manual says the same', q19.length >= 1 && foot19 === 'Restorals are reported to the station (NFPA 72-2019 §26.2.5.1). An alarm sent late still dispatches: a received fire alarm is retransmitted at once (NFPA 72-2019 §26.2.1.2). Verification (NFPA 72-2019 §26.2.2) is not a late-signal or no-dispatch path. [CODE]' && !/VERIFY|not on disk/.test(foot19) &&
    !/the 2019 text is not on disk|shows VERIFY on the/.test(man) && /VERIFIED in 2019, 2022 and 2025/.test(man), foot19);
  await shot('sched'); await ev((id) => { DI.game.W.parts.get(id).p.on = false; }, r.st); await ev(() => { DI.ui.siteSet('ed72', 'auto'); DI.ui.siteSet('path', 'ip'); });

  // ---- 7. A scored drill incident: step 14 as company practice, INVESTIGATE on a 12 % drop, then Finish pressed three times; the report
  r = await rig(P30, true); await sel(r.v); await press('Main drain test'); await step(45); await tick();
  const resid = await ev((id) => DI.lastResult(DI.game.S, 'drain', id).val, r.v); await ev(([id, v]) => { DI.game.W.parts.get(id).p.drainBase = v / 0.88; }, [r.v, resid]);
  await ev(() => { const S = DI.game.S; S.drill = { name: 'test', t0: S.t, done: false, steps: [[0, () => {}]], i: 1, len: 1e9, judge: DI.lossJudge(1e9, (q) => DI.drillRecovery(q, 'the broken sprinkler')) }; S.stats = { fireLoss: 0, waterLoss: 0, smokeLoss: 0, gallons: 0 }; });
  await ev((k) => DI.breakSprinkler(DI.game.S, k), r.head); await step(5); await on(r.pn, 'Silence'); await ev((k) => DI.findHead(DI.game.S, k), r.head); await on(r.g, 'Close valve'); await step(6);
  await sel(r.v); const st14 = await row('Drill step 14: main drain test (company practice)'), p14 = await text('#mdt14');
  ok('drill: the checklist step 14 reads "company practice" and names the valve status test NFPA 25 requires', st14 === 'pending' && /^Step 14, scored in this drill: Main drain test \(company practice\)\. NFPA 25 requires a valve status test after a control valve is reopened \(2023 13\.3\.3\.4\)\. Company practice\. Main drain test: /.test(p14), p14);
  await sel(r.v); await press('Isolate air'); await press('System drain'); await ev((id) => { const S = DI.game.S, q = S.ss.get(id); let n = 0; while (!q.dz && n++ < 40000) S.step(0.25); }, r.v); await tick();
  await sel(r.v); await press('Replace 1 sprinkler'); await press('System drain'); await press('Restore air'); await step(1800, 1); await on(r.pn, 'Panel reset'); await step(2); await on(r.g, 'Open valve'); await step(6); await tick();
  // the zone has just refilled from 0 psig: the Last refill row is a measured time, with no limit, no verdict and no colour; so is a running clock
  await sel(r.v); const fill2 = await row('Last refill'), fill2Cls = await rowCls('Last refill'), fillTxt = await ev((id) => { const S = DI.game.S, s = S.ss.get(id), keep = [s.fillTime, s.fill1]; s.fillTime = 2700; s.fill1 = 2700; const o = [DI.refillText(S, id), DI.refillText(S, id, true)]; s.fillTime = keep[0]; s.fill1 = keep[1]; return o; }, r.v);
  ok('valve: the refill rows read "(measured, informational)" and are neutral: no limit, no OK and no colour, at 45 min as well', /^[\d.]+ min \(measured, informational\)$/.test(fill2) && fill2Cls === '' && !/limit|OK|over/.test(fill2) && fillTxt.every((q) => q[0] === '45.0 min (measured, informational)' && q[1] === ''), fill2);
  await sel(r.v); await press('Main drain test'); await step(45); await tick(); await sel(r.v); const dropRes = (await results()).find((x) => /Main drain test/.test(x)), dropCls = await ev(() => { const e = [...document.querySelectorAll('#side .res')].find((x) => /Main drain test/.test(x.innerText)); return e ? e.className : ''; });
  ok('drill: the main drain test result for a 12 % drop reads INVESTIGATE (amber), not FAIL, with the NFPA 25 text and the Tutor hint', /^INVESTIGATE · Main drain test /.test(dropRes) && dropCls === 'res warn' && !/FAIL/.test(dropRes) && /a 10 percent drop in full flow pressure vs the acceptance test or earlier tests means find the cause and correct it if necessary\. Full flow pressure is 12\.0 percent lower than the last test\. NFPA 25 says find the cause\./.test(dropRes) && /Main drain test: INVESTIGATE - /.test(await logText()), dropRes);
  await shot('drain');
  // Finish pressed three times with the same thing missing: one error, three presses
  await airTest(r); await sel(r.v); await press(FIN); await press(FIN); await press(FIN); await sel(r.v);
  const errRow = await row('Return-to-normal errors so far'), rtRes = (await results()).find((x) => /Return to normal/.test(x)), errN = await ev((id) => { const s = DI.game.S.ss.get(id); return [s.rtErr.length, s.rtPress].join(); }, r.v);
  ok('finish: refused three times with the same blocker, the error row shows 1 error and "Finish pressed 3 times", and the result has one error line and the presses line', errN === '1,3' && errRow === '1: Finish pressed too early (Finish pressed 3 times)' && !!rtRes && (rtRes.match(/Finish was pressed before the zone was ready: /g) || []).length === 1 &&
    /Finish was pressed 3 time\(s\) before the zone was ready; counted as 1 error\(s\), one for each new set of blockers \(informational\)\.$/.test(rtRes) && !TAGS.test(rtRes + errRow), errRow);
  await shot('finish');
  // the report (5 gal are put through the other drains so that their line prints: its wording is what is checked here)
  await ev(() => { const G = DI.game, S = G.S; S.stats.otGal = (S.stats.otGal || 0) + 5; S.stats.gallons += 5; const res = S.drill.judge(S); res.stats = Object.assign({}, S.stats); G.sc = Object.assign({}, G.sc, { drill: { name: 'Cycle 8 report check' } }); DI.ui.showReport(res, 0, 0, true); }); await tick();
  const lines = await ev(() => [...document.querySelectorAll('#mbox .goal')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const at = (re) => lines.findIndex((l) => re.test(l)), has = (re) => lines.filter((l) => re.test(l)).length;
  const iC = at(/^. Code check: largest zone alone, from 0 psig: [\d.]+ min\. Limit 30 min \(NFPA 13\)\. Passes\. \[NFPA 13-2025 §8\.2\.7\.3\]$/), iM = at(/^• Air refill this drill, measured: [\d.]+ min \(zones refilled at the same time, from partly full\)\. Informational\.$/), iT = at(/In a real building, getting to the riser takes minutes\./);
  ok('report: the code-check line is above the measured line, and the measured line has no "limit", "OK" or "over"', iC >= 0 && iM === iC + 1 && !/limit|OK|over/i.test(lines[iM]) && has(/Air refill: /) === 0, lines.slice(iC, iM + 2).join(' | '));
  ok('report: the shared note (two zones) has the new text, right under the measured line', lines[iM + 1] === '• Note: 2 zones share this compressor. It is sized for the largest zone, not for all zones at once. [NFPA 13-2025 §8.2.7.3]', lines[iM + 1]);
  ok('report: the realism tip and, with the water stopped in under 30 s, the standing-at-the-riser line directly under it', iT >= 0 && lines[iT + 1] === '• Your time assumes you were standing at the riser.' && has(/Recovery rating: 3 of 3 stars\. Water stopped \d+ s after the alarm/) === 1, lines[iT + 1]);
  ok('report: the other-drains line has the Tutor’s text, in the recovery list and under LOSSES', has(/^• Other drains and test connections \(system drain, inspector’s test\): 5 gal, to drain, not to the floor\.$/) === 1 && has(/^Other drains and test connections \(system drain, inspector’s test\): 5 gal, to drain, not to the floor\.$/) === 1, lines.filter((l) => /Other drains/.test(l)).join(' | '));
  ok('report: the presses line: Finish pressed 3 times, counted as 1 error, informational; and no internal tag anywhere', has(/^• Return to normal, .*: Finish was pressed 3 time\(s\) before the zone was ready; counted as 1 error\(s\), one for each new set of blockers \(informational\)\.$/) === 1 && has(/not finished, 1 error\(s\) so far \(Finish pressed 3 times\)$/) === 1 && !lines.some((l) => TAGS.test(l)), lines.filter((l) => /Finish/.test(l)).join(' | '));
  await shot('report'); await closeModal();

  // ---- 8. A Cycle 7 save with NFPA 76 adopted on a VEA site: it loads with the 0.5 pick, and the log and a banner say so once
  r = await rig(); await ev(() => { DI.saveGame(); const k = 'di.save.s0', sv = JSON.parse(localStorage.getItem(k)); delete sv.world.v; sv.world.cfg.nfpa76Adopted = true; sv.world.cfg.asdModel = 'VEA'; delete sv.world.cfg.detThr; localStorage.setItem(k, JSON.stringify(sv)); DI.startScenario('s0'); DI.ui.close(); DI.setSpeed(0); }); await tick();
  const MIG = 'NFPA 76 now applies by room. This save has no telecom room, so no room is checked until you set one (room type Telecom / MMR, or NFPA 76 applies here).', cOld = await cfg(), logOld = await logText();
  ok('old save: a Cycle 7 save with NFPA 76 adopted and VEA loads with the 0.5 pick stored, and the log panel and the banner show the NFPA 76 note once', cOld.nfpa76Adopted === true && cOld.asdModel === 'VEA' && Array.isArray(cOld.detThr) && cOld.detThr[2] === 0.5 && logOld.split(MIG).length === 2 && (await ev(() => document.getElementById('banner').textContent)) === MIG && (await ev(() => DI.game.W.parts.size)) > 5 &&
    (await ev(() => DI.n76Flags(DI.game.W).length)) === 0, logOld.split('\n').filter((l) => /NFPA 76|0\.5/.test(l)).join(' | '));
  // saved again and loaded again, it is a Cycle 8 save: nothing is migrated and nothing is said twice
  await ev(() => { DI.saveGame(); DI.startScenario('s0'); DI.ui.close(); DI.setSpeed(0); }); await tick();
  ok('old save: saved again, the next load says nothing', !(await logText()).includes(MIG) && (await cfg()).detThr[2] === 0.5);
  await ev(() => { localStorage.clear(); });
  await shot();
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(fail || errs.length ? (fail + ' FAILED, ' + errs.length + ' page errors') : 'all Cycle 8 UI checks passed');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
