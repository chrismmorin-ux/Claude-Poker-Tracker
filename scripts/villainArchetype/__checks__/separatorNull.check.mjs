/**
 * separatorNull - a feature carrying ZERO information must never be declared a separator.
 *
 * Promoted into the permanent suite because it caught a live defect on a PUBLISHED card: the
 * nominal G-test ran with no expected-cell-count guard, so on a near-continuous column it
 * degenerated to G = 2*n*H(marginal) and declared pure noise significant. The card most affected
 * named str_pct_mean - 974 distinct values over 9,442 rows - as the separator behind its only
 * hidden-cond verdict.
 *
 * Known-answer check on the separator test itself.
 *
 * CLAIM UNDER TEST (from an independent audit): `classifyLeaf` runs a nominal G-test with no
 * minimum expected-cell-count guard, so on a feature with near-unique values it degenerates to
 * G = 2n*H(marginal) with df = n-1, INDEPENDENT OF ANY ASSOCIATION. If true, a feature carrying
 * zero information is declared a separator.
 *
 * PRE-REGISTERED, before running:
 *   IF the claim is FALSE, a zero-information feature yields a non-significant pAdj (> 0.05) and
 *   the test behaves.
 *   IF the claim is TRUE, a feature built to carry no information at all is declared significant,
 *   and its G lands near 2n*H.
 *
 * The feature is built by shuffling a unique id, so its association with the action is zero BY
 * CONSTRUCTION - not "small", not "probably noise". Zero.
 */
import { classifyLeaf } from '../mixTest.mjs';

// Villain 2's rule r08, exactly: n = 330, bet 204 / check 126.
const N = 330; const BET = 204;
const pool = Array.from({ length: N }, (_, i) => ({
  action: i < BET ? 'bet' : 'check',
  handKnown: false,
  uniqueNoise: `v${i}`,            // unique per row -> the degenerate case
  coarseNoise: `b${i % 4}`,        // same noise, four bands -> the control
}));

// Deterministic shuffle so the run is reproducible without Math.random.
for (let i = N - 1; i > 0; i--) {
  const j = (i * 1103515245 + 12345) % (i + 1);
  [pool[i].uniqueNoise, pool[j].uniqueNoise] = [pool[j].uniqueNoise, pool[i].uniqueNoise];
  [pool[i].coarseNoise, pool[j].coarseNoise] = [pool[j].coarseNoise, pool[i].coarseNoise];
}

const features = {
  uniqueNoise: (d) => d.uniqueNoise,
  coarseNoise: (d) => d.coarseNoise,
};

const res = classifyLeaf(pool, features, new Set(), { alpha: 0.05 });

const H = -((BET / N) * Math.log2(BET / N) + ((N - BET) / N) * Math.log2((N - BET) / N));
const predictedG = 2 * N * H * Math.LN2;   // G is in nats*2; H computed in bits

console.log(`leaf: n=${N}, bet=${BET}, check=${N - BET}`);
console.log(`marginal entropy H = ${H.toFixed(4)} bits`);
console.log(`predicted degenerate G = 2*n*H = ${predictedG.toFixed(1)}\n`);
console.log(`verdict: ${res.verdict}`);
console.log(`family size m = ${res.family}`);
console.log(`separators declared: ${res.separators.length}`);
for (const s of res.separators) {
  console.log(`  DECLARED SEPARATOR: ${s.feature}  G=${s.G?.toFixed(1)}  df=${s.df}  `
    + `raw p=${s.p?.toExponential(3)}  pAdj=${s.pAdj?.toExponential(3)}`);
}
if (res.nearMiss) console.log(`nearMiss: ${res.nearMiss.feature} pAdj=${res.nearMiss.pAdj.toExponential(3)}`);
console.log(`\nRESULT: a feature with ZERO association was `
  + `${res.separators.some((s) => s.feature === 'uniqueNoise') ? 'DECLARED A SEPARATOR' : 'correctly rejected'}`);

process.exit(res.separators.some((x) => x.feature === 'uniqueNoise') ? 1 : 0);
