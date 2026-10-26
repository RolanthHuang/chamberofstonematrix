// Reverse-engineered model for "Chamber of Stone Matrix":
// each round draws uniformly from ALL subsets of the n cells with size <= M.
// A beam (line) covers L cells. P(k) = C(L,k) * S(n-L, M-k) / S(n, M), S(n,M) = sum_{j<=M} C(n,j)
const cache = new Map();
function C(n, k) {
  if (k < 0 || k > n) return 0n;
  if (k > n - k) k = n - k;
  const key = n * 4096 + k;
  if (cache.has(key)) return cache.get(key);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  cache.set(key, r);
  return r;
}
function S(n, M) { let s = 0n; for (let j = 0; j <= Math.min(M, n); j++) s += C(n, j); return s; }
const SC = 10n ** 18n;
const ratio = (a, b) => Number((a * SC) / b) / 1e18;
function model(n, L, M, odds) {
  const den = S(n, M);
  const P = [];
  for (let k = 0; k <= L; k++) { const num = k <= M ? C(L, k) * S(n - L, M - k) : 0n; P.push(ratio(num, den)); }
  let rtp = 0, ex2 = 0;
  P.forEach((p, k) => { rtp += p * odds[k]; ex2 += p * odds[k] ** 2; });
  return { P, rtp, sigma: Math.sqrt(ex2 - rtp * rtp), den };
}
const oddsDef = (N) => { const o = [0]; for (let k = 1; k < N; k++) o.push(k); o.push(N * N); return o; };

console.log('== 2D (PDF rule: M = N, odds k / full line N^2) ==');
for (const N of [2, 3, 4, 5, 6]) {
  const m = model(N * N, N, N, oddsDef(N));
  console.log(`N=${N}`, m.P.map((p) => (p * 100).toFixed(4) + '%').join(' '), '| RTP', (m.rtp * 100).toFixed(4) + '%', '| sigma', m.sigma.toFixed(3), '| full line 1/' + (1 / m.P[N]).toFixed(0));
}

console.log('\n== 3D candidates (same odds table, vary M) ==');
for (const N of [3, 4, 5, 6]) {
  for (let M = N * N - 3; M <= N * N + 1; M++) {
    const m = model(N ** 3, N, M, oddsDef(N));
    console.log(`N=${N} M=${M}`, '| RTP', (m.rtp * 100).toFixed(4) + '%', '| P(k)', m.P.map((p) => (p * 100).toFixed(3)).join('/'), '| full 1/' + (1 / m.P[N]).toFixed(0), '| sigma', m.sigma.toFixed(3));
  }
}

// Monte Carlo: single line vs. full coverage (hedge) volatility
function sim(dim, N, M, odds, R, faces) {
  const X = N, Y = N, Z = dim === 2 ? 1 : N, n = X * Y * Z;
  const idx = (i, j, k) => i + X * (j + Y * k);
  const lines = [];
  for (let k = 0; k < Z; k++) for (let i = 0; i < X; i++) { const c = []; for (let j = 0; j < Y; j++) c.push(idx(i, j, k)); lines.push(c); }
  for (let k = 0; k < Z; k++) for (let j = 0; j < Y; j++) { const c = []; for (let i = 0; i < X; i++) c.push(idx(i, j, k)); lines.push(c); }
  if (faces === 3 && Z > 1) for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) { const c = []; for (let k = 0; k < Z; k++) c.push(idx(i, j, k)); lines.push(c); }
  const den = S(n, M); const cum = []; let acc = 0;
  for (let m = 0; m <= M; m++) { acc += ratio(C(n, m), den); cum.push(acc); } cum[M] = 1;
  const a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = i;
  const occ = new Uint8Array(n);
  let s = 0, s2 = 0, sl = 0, sl2 = 0, lossRounds = 0;
  for (let r = 0; r < R; r++) {
    const u = Math.random(); let m = 0; while (m < M && u > cum[m]) m++;
    for (let i = 0; i < m; i++) { const j = i + Math.floor(Math.random() * (n - i)); const t = a[i]; a[i] = a[j]; a[j] = t; occ[a[i]] = 1; }
    let ret = 0;
    for (const c of lines) { let k = 0; for (const x of c) k += occ[x]; ret += odds[k]; }
    let k0 = 0; for (const x of lines[0]) k0 += occ[x];
    const single = odds[k0]; sl += single; sl2 += single * single;
    ret /= lines.length; s += ret; s2 += ret * ret; if (ret < 1) lossRounds++;
    for (let i = 0; i < m; i++) occ[a[i]] = 0;
  }
  const mean = s / R, sd = Math.sqrt(s2 / R - mean * mean);
  const ms = sl / R, sds = Math.sqrt(sl2 / R - ms * ms);
  return { lines: lines.length, fullMean: mean.toFixed(4), fullSd: sd.toFixed(3), singleMean: ms.toFixed(4), singleSd: sds.toFixed(3) };
}
console.log('\n== Hedge check (full coverage vs single line) ==');
console.log('2D N=4 M=4', sim(2, 4, 4, oddsDef(4), 200000, 2));
console.log('3D N=4 M=15 floor+wall', sim(3, 4, 15, oddsDef(4), 200000, 2));
console.log('3D N=4 M=15 3 faces', sim(3, 4, 15, oddsDef(4), 200000, 3));
