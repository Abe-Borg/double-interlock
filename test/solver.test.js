// node test/solver.test.js
require('../src/core.js'); require('../src/data.js'); require('../src/solver.js');
const DI = globalThis.DI; let fail = 0;
const near = (name, got, want, tol) => { const ok = Math.abs(got - want) <= tol; if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + ': ' + got.toFixed(3) + ' (want ' + want + ' +/- ' + tol + ')'); };

// 1. tank(50 psi) -> 100 ft of 2" C120 -> one K5.6 sprinkler. Check against hand iteration.
{
  const N = new DI.Net(), src = N.node(0, 0, 50), j = N.node(0, 0.001), atm = N.node(0, 0, 0);
  N.link(src, j, { r: DI.hw(120, 2.067) * 100 }); N.link(j, atm, { m: 1 / (5.6 * 5.6), chk: true });
  DI.solve(N, Infinity);
  const q = N.links[1].q, pj = N.P[j];
  near('sprinkler Q = K sqrt(P)', q, 5.6 * Math.sqrt(pj), 0.01);
  near('friction closes the loop', 50 - pj, DI.hw(120, 2.067) * 100 * Math.pow(q, 1.85), 0.01);
}
// 2. pump at churn and at rated/150% points through a throttled outlet
{
  for (const [K, name, wantQ, wantH] of [[1e-6, 'churn', 0, 150], [1500 / Math.sqrt(125), 'rated', 1500, 125], [2250 / Math.sqrt(81.25), '150%', 2250, 81.25]]) {
    const N = new DI.Net(), src = N.node(0, 0, 0), d = N.node(0, 0.001), atm = N.node(0, 0, 0);
    N.link(src, d, { chk: true, pump: { gpm: 1500, psi: 125, spd: 1 } }); N.link(d, atm, { m: 1 / (K * K), chk: true });
    DI.solve(N, Infinity);
    near('pump ' + name + ' flow', N.links[0].q, wantQ, 1); near('pump ' + name + ' head', N.P[d], wantH, 0.5);
  }
}
// 3. loop: two parallel identical pipes split the flow evenly
{
  const N = new DI.Net(), s = N.node(0, 0, 80), a = N.node(0, 0.001), b = N.node(0, 0.001), atm = N.node(0, 0, 0);
  const r = DI.hw(120, 4.26) * 300;
  N.link(s, a, { r: r / 10 }); N.link(a, b, { r }); N.link(a, b, { r }); N.link(b, atm, { m: 1 / (40 * 40), chk: true });
  DI.solve(N, Infinity);
  near('parallel split', N.links[1].q, N.links[2].q, 0.01); near('continuity', N.links[0].q, N.links[1].q + N.links[2].q, 0.01);
}
// 4. check valve blocks reverse flow; trapped pressure holds via capacitance
{
  const N = new DI.Net(), s = N.node(0, 0, 20), a = N.node(100, 0.5);
  N.link(s, a, { r: 0.001, chk: true });
  for (let i = 0; i < 20; i++) { DI.solve(N, 0.5); N.pPrev[a] = N.P[a]; }
  near('trapped pressure above check', N.P[a], 100, 0.01);
}
// 5. capacitance: leak bleeds a trapped volume: P falls, never negative
{
  const N = new DI.Net(), a = N.node(100, 0.05), atm = N.node(0, 0, 0);
  N.link(a, atm, { m: 1 / (0.5 * 0.5), chk: true });
  let t = 0; for (let i = 0; i < 200; i++) { DI.solve(N, 1); N.pPrev[a] = N.P[a]; t++; }
  near("bleed-down decays", N.P[a] < 5 && N.P[a] > -0.01 ? 1 : 0, 1, 0);
}
console.log(fail ? fail + ' FAILED' : 'all solver tests passed'); process.exit(fail ? 1 : 0);
