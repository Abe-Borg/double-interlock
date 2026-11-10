// Hydraulic network solver: Todini's Global Gradient Algorithm (the method EPANET uses),
// extended with a node capacitance term so trapped pressure, pump cycling and dry-system
// filling are all the same equation:
//     sum(Q in) - sum(Q out) = 60*C/dt * (P - Pprev)        [gpm; C in gal/psi]
// Link head loss a->b:  h(Q) = r*Q|Q|^0.85 + m*Q|Q| - pumpGain(Q)   [psi]
//   r = Hazen-Williams term, m = minor/orifice term (an open sprinkler is m = 1/K^2 to atmosphere).
var DI = globalThis.DI || (globalThis.DI = {});

DI.Net = class {
  constructor() { this.n = 0; this.cap = []; this.pPrev = []; this.fix = []; this.dem = []; this.links = []; this.P = null; }
  node(pPrev, cap, fixed) {
    this.cap.push(cap || 0); this.pPrev.push(pPrev || 0); this.fix.push(fixed === undefined ? NaN : fixed); this.dem.push(0);
    return this.n++;
  }
  link(a, b, o) {
    const l = { a, b, r: 0, m: 0, chk: false, pump: null, open: true, q: 0, tag: null };
    Object.assign(l, o); this.links.push(l); return l;
  }
};

DI.linkLoss = function (l, q, out) {      // out[0] = h, out[1] = dh/dq
  const aq = Math.abs(q);
  let h = l.r * q * Math.pow(aq, 0.85) + l.m * q * aq;
  let g = 1.85 * l.r * Math.pow(aq, 0.85) + 2 * l.m * aq;
  const pm = l.pump;
  if (pm && pm.spd > 0.02) {
    const s = pm.spd, qs = pm.gpm * s, x = Math.max(q, 0) / qs, e = DI.PUMP_EXP;
    h -= pm.psi * s * s * (1.2 - 0.2 * Math.pow(x, e));
    g += pm.psi * s * s * 0.2 * e * Math.pow(x, e - 1) / qs;
  }
  out[0] = h; out[1] = g < 1e-5 ? 1e-5 : g;
};

DI.solve = function (net, dt, maxIter) {
  const n = net.n, L = net.links, nl = L.length;
  const row = new Int32Array(n); let nf = 0;
  for (let i = 0; i < n; i++) row[i] = isNaN(net.fix[i]) ? nf++ : -1;
  const P = net.P && net.P.length === n ? net.P : (net.P = new Float64Array(n));
  for (let i = 0; i < n; i++) P[i] = row[i] < 0 ? net.fix[i] : net.pPrev[i];
  const cc = 60 / (dt > 0 && isFinite(dt) ? dt : 1e12);
  const A = new Float64Array(nf * nf), F = new Float64Array(nf), o = [0, 0];
  const lp = new Float64Array(nl), ly = new Float64Array(nl);
  let it = 0, ok = false;
  maxIter = maxIter || 40;
  for (; it < maxIter; it++) {
    A.fill(0);
    for (let i = 0; i < n; i++) {
      const r = row[i]; if (r < 0) continue;
      const c = net.cap[i] * cc + 1e-9;
      A[r * nf + r] = c; F[r] = c * net.pPrev[i] - net.dem[i];
    }
    for (let k = 0; k < nl; k++) {
      const l = L[k];
      if (!l.open) { lp[k] = 0; ly[k] = 0; continue; }
      DI.linkLoss(l, l.q, o);
      const p = 1 / o[1], y = l.q - p * o[0];
      lp[k] = p; ly[k] = y;
      const ra = row[l.a], rb = row[l.b];
      if (ra >= 0) { A[ra * nf + ra] += p; F[ra] -= y; if (rb >= 0) A[ra * nf + rb] -= p; else F[ra] += p * P[l.b]; }
      if (rb >= 0) { A[rb * nf + rb] += p; F[rb] += y; if (ra >= 0) A[rb * nf + ra] -= p; else F[rb] += p * P[l.a]; }
    }
    // Gaussian elimination (A is symmetric positive definite, no pivoting needed)
    for (let i = 0; i < nf; i++) {
      const d = A[i * nf + i];
      for (let j = i + 1; j < nf; j++) {
        const f = A[j * nf + i]; if (f === 0) continue;
        const m = f / d;
        for (let c = i; c < nf; c++) A[j * nf + c] -= m * A[i * nf + c];
        F[j] -= m * F[i];
      }
    }
    for (let i = nf - 1; i >= 0; i--) {
      let s = F[i];
      for (let c = i + 1; c < nf; c++) s -= A[i * nf + c] * F[c];
      F[i] = s / A[i * nf + i];
    }
    for (let i = 0; i < n; i++) if (row[i] >= 0) P[i] = F[row[i]];
    // flow update + check-valve status
    let dq = 0, sq = 0, flip = false;
    for (let k = 0; k < nl; k++) {
      const l = L[k], dp = P[l.a] - P[l.b];
      if (!l.open) {
        if (l.chk && !l.shut) { DI.linkLoss(l, 0, o); if (dp - o[0] > 0.01) { l.open = true; l.q = 0.01; flip = true; } }
        continue;
      }
      let q = ly[k] + lp[k] * dp;
      if (l.chk && q < -1e-4) { q = 0; l.open = false; flip = true; }
      dq += Math.abs(q - l.q); sq += Math.abs(q);
      l.q = q;
    }
    if (!flip && (dq < 0.02 || dq < 1e-3 * sq)) { ok = true; it++; break; }
  }
  net.iters = it; net.ok = ok;
  return ok;
};
