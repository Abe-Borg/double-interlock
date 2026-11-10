// node test/graph.test.js  - tile map -> network -> solve, checked against hand calcs
for (const f of ['core', 'juris', 'data', 'world', 'solver', 'systems', 'graph', 'links']) require('../src/' + f + '.js');
const DI = globalThis.DI; let fail = 0;
const near = (name, got, want, tol) => { const ok = Math.abs(got - want) <= tol; if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + ': ' + (+got).toFixed(3) + ' (want ' + want + ' +/- ' + tol + ')'); };
const mkS = (W) => { const S = { ss: new Map(), pT: new Float32Array(W.w * W.h), pP: new Map(), leaks: [] }; S.sysd = DI.findSystems(W); for (const [id, i] of S.sysd.info) S.ss.set(id, { state: i.type === 'wetv' ? 'wet' : 'dry', wat: 0, P: 0 }); return S; };

// city -> 20 tiles of 4" -> wet riser -> 6" main -> branch of 8 sprinklers (1"), last one open
const W = new DI.World(40, 10); W.addRoom('office', 24, 1, 12, 8);
const city = W.addPart('city', 1, 5, 0, { stat: 60, resid: 40, flow: 800 });
for (let x = 2; x < 22; x++) W.setPipe(x, 5, 6, 0);
const riser = W.addPart('wetv', 22, 5, 0);
for (let x = 23; x < 26; x++) W.setPipe(x, 5, 6, 0);
for (let x = 26; x < 34; x++) W.setPipe(x, 5, 0, 1, true);
// a dead-end side branch that must be pruned
for (let y = 6; y < 9; y++) W.setPipe(24, y, 3, 0);
const S = mkS(W);
let G = DI.buildGraph(W, S);
near('static network is tiny (nodes)', G.net.n <= 8 ? 1 : 0, 1, 0);
for (let i = 0; i < 50; i++) { DI.updateLinks(W, S, G); DI.solve(G.net, 1); DI.readback(W, S, G); }
near('static pressure everywhere = city static', S.pT[W.k(33, 5)], 60, 0.05);
near('pruned dead end reads pressure too', S.pT[W.k(24, 8)], 60, 0.05);
W.spk[W.k(33, 5)] = 2; G = DI.buildGraph(W, S);
for (let i = 0; i < 80; i++) { DI.updateLinks(W, S, G); DI.solve(G.net, 1); DI.readback(W, S, G); }
const q = G.emit[0].link.q, pEnd = S.pT[W.k(33, 5)];
near('open sprinkler Q = 5.6 sqrt(P)', q, 5.6 * Math.sqrt(pEnd), 0.05);
// hand calc of the path: city curve + 4" + riser + 4" + 1" branch
const f = (C, d, L) => DI.hw(C, d) * L * DI.FIT * Math.pow(q, 1.85);
// 4" main: pipe-pipe edges tile 2..21 (19 full tiles) + half tile at each end = 200 ft; city->pipe half counted
const loss = (20 / Math.pow(800, 1.85)) * Math.pow(q, 1.85) + f(100, 4.26, 200) + 3e-6 * q * q + f(100, 4.26, 30) + f(100, 1.049, 75);   // C = 100 on every segment
near('end pressure matches hand calc', pEnd, 60 - loss, 0.15);
near('edge flow readable for animation', Math.abs(DI.edgeFlow(G, W.k(10, 5), false)), q, 0.05);
console.log(fail ? fail + ' FAILED' : 'all graph tests passed'); process.exit(fail ? 1 : 0);
