// Fire, heat, sprinkler activation, water application, damage, freezing and corrosion.
// Fire growth is t-squared; ceiling jet temperature/velocity use Alpert's correlations and the
// sprinkler link heats by the RTI equation (the DETACT model used in fire engineering).
var DI = globalThis.DI || (globalThis.DI = {});

DI.RTI = 50;            // quick-response link, (m*s)^0.5
DI.T_ACT = 68;          // 155 F ordinary temperature rating, C
DI.YEAR = 31536000;

DI.fireInit = function (S) {
  const n = S.W.w * S.W.h;
  S.fq = new Float32Array(n); S.fa = new Float32Array(n); S.fi = new Float32Array(n);
  S.lt = new Float32Array(n).fill(21); S.wet = new Float32Array(n); S.burn = new Float32Array(n);
  S.dens = new Float32Array(n); S.ice = new Float32Array(n); S.fires = []; S.densK = [];
  S.smoke = new Float32Array(S.W.rooms.length + 1); S.spkVer = 0; S.aging = 1; S.frzT = 0;
};

DI.ignite = function (S, k, incip, alphaMul) {
  if (S.fq[k] > 0 || S.fi[k] > 0) return;
  S.fi[k] = incip || 0; S.fa[k] = 0; S.fq[k] = incip ? 0 : 1; S.fam = alphaMul || 1;
  S.fires.push(k); if (S.fireT0 === undefined || S.fireT0 < 0) S.fireT0 = S.t;
  DI.bus.emit('fire', k);
};
DI.breakSprinkler = function (S, k) { if (S.W.spk[k] === 1) { S.W.spk[k] = 3; S.spkVer++; S.dirty = true; DI.bus.emit('spk', k); } };
DI.fuse = function (S, k) { S.W.spk[k] = 2; S.spkVer++; S.dirty = true; S.say('Sprinkler operated (' + (k % S.W.w) + ',' + ((k / S.W.w) | 0) + ')', 'warn'); DI.bus.emit('spk', k); };

DI.fireStep = function (S, dt) {
  const W = S.W, w = W.w;
  for (let f = S.fires.length - 1; f >= 0; f--) {
    const k = S.fires[f], rm = W.roomAt[k], room = rm ? W.rooms[rm - 1] : null;
    const rt = room ? DI.ROOMS[room.type] : DI.ROOMS.gen, hz = DI.HAZ[rt.haz], alpha = hz.alpha * (S.fam || 1);
    let q;
    if (S.fi[k] > 0) { S.fi[k] -= dt; q = 6; if (S.fi[k] <= 0) { S.fi[k] = 0; S.fa[k] = 25; S.say('Fire has reached open flaming' + (room ? ' in ' + room.name : ''), 'bad'); } }
    else {
      const ratio = S.dens[k] / hz.dens;
      q = S.fq[k];
      if (ratio >= 1) { q *= Math.exp(-0.02 * Math.min(ratio, 2.5) * dt); S.fa[k] = Math.sqrt(q / alpha); }
      else { S.fa[k] += dt * (1 - ratio) * (1 - ratio); q = Math.min(alpha * S.fa[k] * S.fa[k], hz.cap); if (ratio > 0.3) q = Math.min(q, S.fq[k] * (1 + 0.02 * dt) + 0.5); }
      const fdOn = S.fd.onScene >= 0 && S.t - S.fd.onScene > 150;
      if (fdOn) q *= Math.exp(-0.012 * dt);
      if (q < 2 && (ratio >= 1 || fdOn)) { S.fq[k] = 0; S.fires.splice(f, 1); if (!S.fires.length) { S.fireOutT = S.t; S.say('Fire is out.', 'good'); DI.bus.emit('fireout'); } continue; }
    }
    S.fq[k] = q;
    const db = (q / hz.cap) * dt / 150; if (S.burn[k] < 1) { const b = Math.min(1, S.burn[k] + db); S.stats.fireLoss += (b - S.burn[k]) * rt.val; S.burn[k] = b; }
    if (rm) S.smoke[rm] += ((S.fi[k] > 0 ? 0.5 : q) * dt) / (room.w * room.h * 100 * rt.ceil) * 307;
    // spread to neighbours once well developed
    if (q > 0.5 * hz.cap && S.burn[k] > 0.12) for (let d = 0; d < 4; d++) {
      const nk = k + DI.DX[d] + DI.DY[d] * w;
      if (W.roomAt[nk] === rm && !S.fq[nk] && S.burn[nk] < 0.5 && S.dens[nk] < hz.dens && Math.random() < 0.03 * dt) { DI.ignite(S, nk, 0, S.fam); S.fa[nk] = 40; }
    }
    if (q < 15) continue;
    // ceiling jet -> sprinkler links (Alpert + RTI)
    const H = rt.ceil * 0.3048, x0 = k % w, y0 = (k / w) | 0, q23 = Math.pow(q, 2 / 3), q13 = Math.pow(q, 1 / 3);
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      const x = x0 + i, y = y0 + j; if (!W.inb(x, y)) continue;
      const k2 = y * w + x; if (W.spk[k2] !== 1 || W.roomAt[k2] !== rm) continue;
      const r = Math.max(0.6, Math.hypot(i, j) * 3.048);
      const dT = r / H <= 0.18 ? 16.9 * q23 / Math.pow(H, 5 / 3) : 5.38 * Math.pow(q / r, 2 / 3) / H;
      const u = r / H <= 0.15 ? 0.96 * Math.pow(q / H, 1 / 3) : 0.195 * q13 * Math.sqrt(H) / Math.pow(r, 5 / 6);
      const Tg = 21 + dT * (S.dens[k2] > 0.02 ? 0.35 : 1);
      if (Tg > S.lt[k2]) { S.lt[k2] += Math.sqrt(u) * (Tg - S.lt[k2]) / DI.RTI * dt; if (S.lt[k2] >= DI.T_ACT) DI.fuse(S, k2); }
    }
  }
  for (let r = 1; r < S.smoke.length; r++) if (S.smoke[r] > 0) {
    const room = W.rooms[r - 1], rt = DI.ROOMS[room.type];
    let burning = false; for (const k of S.fires) if (W.roomAt[k] === r) { burning = true; break; }
    S.smoke[r] *= Math.exp(-dt / (burning ? 900 : 150));          // air handlers clear a room quickly once the source is gone
    const dmg = Math.min(1, S.smoke[r] / 2000); if (dmg > (room.smk || 0)) { S.stats.smokeLoss += (dmg - (room.smk || 0)) * rt.smokeDmg * rt.val * room.w * room.h * 0.25; room.smk = dmg; }
  }
  // weather: unconditioned rooms drift to outdoor temperature; water-filled pipe below 32 F freezes
  S.frzT += dt; if (S.frzT < 5) return; const ft = S.frzT; S.frzT = 0;
  for (const room of W.rooms) {
    const rt = DI.ROOMS[room.type], tgt = rt.cond && !room.noHeat ? 70 : W.outTemp;
    room.temp += (tgt - room.temp) * Math.min(1, ft / 1800);
    if (room.temp >= 32 || room.burst) continue;
    for (let y = room.y; y < room.y + room.h && !room.burst; y++) for (let x = room.x; x < room.x + room.w; x++) {
      const k = y * w + x; if (!W.pd[k]) continue;
      const sid = S.sysd.tileSys[k], s = sid && S.ss.get(sid);
      if (s && (s.state === 'dry' || s.wat < 0.5 * s.vol)) continue;       // gas-filled pipe cannot freeze
      S.ice[k] += ft * (32 - room.temp) / 9000;
      if (S.ice[k] >= 1) { room.burst = true; S.leaks.push({ k, K: 9, sys: sid }); S.dirty = true; S.say('FROZEN PIPE BURST in ' + room.name + ' (' + DI.fmt(room.temp) + ' F)', 'bad'); DI.bus.emit('burst', k); break; }
    }
  }
  // oxygen corrosion of dry / preaction pipe: needs residual water + oxygen
  for (const [id, s] of S.ss) {
    if (S.sysd.info.get(id).type === 'wetv' || s.state !== 'dry') continue;
    const o2 = s.G > 0 ? s.o2g / s.G : 0.209;
    s.corr += s.moist * Math.pow(o2 / 0.209, 1.5) * ((s.P + DI.ATM) / 35) * ft * S.aging / (DI.YEAR * 6);
    const holes = Math.floor(Math.max(0, s.corr - 0.25) * 16);
    if (holes > (s.holes || 0)) { s.holes = holes; S.say(DI.sysName(S, id) + ': corrosion pinhole leak #' + holes + ' (air loss rising)', 'warn'); }
  }
};

// water landing on the floor: applied density (suppression) and water damage
DI.fireWater = function (S, dt) {
  const W = S.W, w = W.w;
  for (const k of S.densK) S.dens[k] = 0; S.densK.length = 0;
  for (const e of S.G.emit) {
    if ((e.kind !== 'spk' && e.kind !== 'leak') || e.link.q < 0.05) continue;
    const k = e.k, q = e.link.q, rm = W.roomAt[k];
    S.dens[k] += q / 100; S.densK.push(k);
    for (let d = 0; d < 4; d++) { const nk = k + DI.DX[d] + DI.DY[d] * w; if (nk >= 0 && nk < S.dens.length && W.roomAt[nk] === rm) { S.dens[nk] += 0.12 * q / 100; S.densK.push(nk); } }
    if (!rm) continue;
    const rt = DI.ROOMS[W.rooms[rm - 1].type], a = Math.min(1, S.wet[k] / 60);
    S.wet[k] += q * dt / 60;
    S.stats.waterLoss += (Math.min(1, S.wet[k] / 60) - a) * rt.val * rt.wetDmg * (1 - S.burn[k]);
  }
};

DI.replaceSprinklers = function (S, id) {
  const s = S.ss.get(id), inf = S.sysd.info.get(id); if (!s) return 'No system.';
  if (!s.openK || !s.openK.length) return 'No operated sprinklers on this system.';
  if (Math.abs(s.flow) > 1 || (s.qOut || 0) > 1) return 'Water is still flowing. Close the control valve first.';
  const n = s.openK.length; for (const k of s.openK) { S.W.spk[k] = 1; S.lt[k] = 21; }
  S.spkVer++; S.dirty = true; S.W.money -= n * 180; S.say('Replaced ' + n + ' sprinkler(s) (-' + DI.money(n * 180) + ')', 'good');
  return '';
};
