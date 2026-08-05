/**
 * WS-283 fold-curve fit — fit + residual tables
 *
 * WHY THIS LIVES HERE AND NOT IN `scripts/backtest/`. That directory is the WS-273 villain
 * PREDICTION harness. This is a different instrument measuring a different quantity: the
 * population fold-to-bet response as a function of bet size, which `queryActionDistribution`
 * — everything `scripts/backtest/run.mjs` scores — does not take as an input at all. Filing
 * it next to the harness would invite the two to be read as the same measurement.
 *
 * It imports `scripts/backtest/` modules read-only (`phhAdapter`, `corpusFiles`, `partition`,
 * `dealBook`, `replicationStamp`, `loader`) rather than re-deriving the corpus conventions —
 * the pot convention in particular is one that silently corrupts everything downstream when
 * two copies drift.
 *
 * Run order, from the repo root:
 *
 *   node scripts/foldCurve/mine-fold-vs-sizing.mjs      # ~7 min, writes fold-vs-sizing.json
 *   node scripts/foldCurve/fit-fold-curve.mjs           # ~2 min, prints the residual tables
 *   node scripts/foldCurve/emit-result-card.mjs         # writes the Result Card
 */
import { readFileSync } from 'node:fs';

// Repo root. Run these from the repo root; the loader resolves `/src/...` against it.
const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
const { openLoader } = await import(`file:///${REPO}/scripts/backtest/loader.mjs`);
const loader = await openLoader(REPO);
const { logisticFoldResponse, POPULATION_CURVE } = await loader.load('/src/utils/exploitEngine/villainModelData.js');

const IN = process.env.IN || 'out/fold-vs-sizing.json';

/**
 * The curve as it shipped BEFORE WS-283, kept as an explicit arm.
 *
 * Once the refit lands in `POPULATION_CURVE`, comparing the fit against "shipped" compares it
 * against itself and the before/after silently becomes a tautology — the arm reads 0.0000 and
 * looks like a triumph. Pinning the previous values is what keeps this script an instrument
 * rather than a mirror, and it doubles as a self-check: `refit` should reproduce `shipped`
 * exactly on the same fit set.
 */
const PREVIOUS_CURVE = Object.freeze({
  maxDelta: 0.25, steepness: 3.0, steepnessUp: 4.0, steepnessDown: 2.0, midpoint: 0.75,
});
const data = JSON.parse(readFileSync(IN, 'utf8'));
const BIN_W = data.meta.binWidth, BIN_MAX = data.meta.binMax;
const DAY_SPLIT = Number(process.env.DAY_SPLIT || 12);

/** Flatten cells into rows with a parsed key. */
const rows = [];
for (const [key, c] of Object.entries(data.cells)) {
  const [group, site, day, street, facing, bin] = key.split('|');
  rows.push({ group, site, day: Number(day), street, facing, bin: Number(bin), ...c });
}

const select = ({ group, facing = 'bet', earlyDays = null, streets = null, sites = null }) =>
  rows.filter(r =>
    (group == null || r.group === group)
    && (facing == null || r.facing === facing)
    && (earlyDays == null || (earlyDays ? r.day < DAY_SPLIT : r.day >= DAY_SPLIT))
    && (streets == null || streets.includes(r.street))
    && (sites == null || sites.includes(r.site))
    && r.bin >= 0);

/** Collapse to per-bin { n, folds, meanFrac }. */
const byBin = (sel) => {
  const m = new Map();
  for (const r of sel) {
    let b = m.get(r.bin);
    if (!b) { b = { bin: r.bin, n: 0, folds: 0, sumFrac: 0 }; m.set(r.bin, b); }
    b.n += r.n; b.folds += r.folds; b.sumFrac += r.sumFrac;
  }
  return [...m.values()].sort((a, b) => a.bin - b.bin)
    .map(b => ({ ...b, meanFrac: b.sumFrac / b.n, obs: b.folds / b.n }));
};

const totals = (sel) => sel.reduce((a, r) => ({ n: a.n + r.n, folds: a.folds + r.folds, sumFrac: a.sumFrac + r.sumFrac }), { n: 0, folds: 0, sumFrac: 0 });

/** Weighted Brier of a curve against per-bin observed rates (bins are sufficient statistics). */
const brier = (bins, base, p) => {
  let s = 0, n = 0;
  for (const b of bins) {
    const pred = logisticFoldResponse(base, b.meanFrac, p.maxDelta, p.steepness, p.midpoint, p.steepnessUp, p.steepnessDown);
    // sum over trials of (pred - y)^2 = n*pred^2 - 2*pred*folds + folds
    s += b.n * pred * pred - 2 * pred * b.folds + b.folds;
    n += b.n;
  }
  return s / n;
};

/** Slope of residual vs meanFrac, n-weighted. The number that must go to ~0. */
const residualSlope = (bins, base, p) => {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const b of bins) {
    const pred = logisticFoldResponse(base, b.meanFrac, p.maxDelta, p.steepness, p.midpoint, p.steepnessUp, p.steepnessDown);
    const res = b.obs - pred;
    const w = b.n, x = b.meanFrac;
    sw += w; sx += w * x; sy += w * res; sxx += w * x * x; sxy += w * x * res;
  }
  const den = sw * sxx - sx * sx;
  return { slope: (sw * sxy - sx * sy) / den, intercept: (sy * sxx - sx * sxy) / den, meanResidual: sy / sw };
};

const fmt = (x, d = 4) => (x == null || Number.isNaN(x) ? '  n/a' : x.toFixed(d));

const table = (label, bins, base, curves) => {
  const names = Object.keys(curves);
  console.log(`\n### ${label}   (base=${fmt(base, 4)})`);
  console.log(`  frac      n      k     obs    ` + names.map(n => `${n.padStart(8)}  resid`).join('   '));
  for (const b of bins) {
    if (b.n < 200) continue;
    const cells = names.map((nm) => {
      const p = curves[nm];
      const pred = logisticFoldResponse(base, b.meanFrac, p.maxDelta, p.steepness, p.midpoint, p.steepnessUp, p.steepnessDown);
      return `${fmt(pred, 4).padStart(8)}  ${(b.obs - pred >= 0 ? '+' : '') + fmt(b.obs - pred, 3)}`;
    });
    console.log(`  ${fmt(b.meanFrac, 2).padStart(5)} ${String(b.n).padStart(7)} ${String(b.folds).padStart(6)}  ${fmt(b.obs, 4)}   ` + cells.join('   '));
  }
  for (const nm of names) {
    const r = residualSlope(bins, base, curves[nm]);
    console.log(`  [${nm}] residual slope vs frac = ${fmt(r.slope, 4)}   mean residual = ${fmt(r.meanResidual, 4)}   brier = ${fmt(brier(bins, base, curves[nm]), 5)}`);
  }
};

// ---------------------------------------------------------------------------
// 1. THE SHIPPED CURVE against the POOL half, early days.
// ---------------------------------------------------------------------------
const poolEarly = select({ group: 'pool', facing: 'bet', earlyDays: true });
const tPoolEarly = totals(poolEarly);
const basePool = tPoolEarly.folds / tPoolEarly.n;
const binsPoolEarly = byBin(poolEarly);

console.log('=== CONDITIONING SET ===');
console.log(`HandHQ online cash, July 2009, 50NL, FTP+PS, 3-9 handed (HU excluded by the adapter).`);
console.log(`Postflop decisions where the seat faced a live BET (not a raise).`);
console.log(`FIT SET   : POOL players (partitionOf, poolPct=50), days 1-${DAY_SPLIT - 1}.  k=${tPoolEarly.folds} / n=${tPoolEarly.n}  marginal fold=${fmt(basePool, 4)}`);

const evalLate = select({ group: 'eval', facing: 'bet', earlyDays: false });
const tEvalLate = totals(evalLate);
const baseEvalLate = tEvalLate.folds / tEvalLate.n;
console.log(`HOLD-OUT  : EVAL players, days ${DAY_SPLIT}-23.                       k=${tEvalLate.folds} / n=${tEvalLate.n}  marginal fold=${fmt(baseEvalLate, 4)}`);

// Inverse conditional: P(sizing bucket | folded) vs P(sizing bucket | called/raised).
const invCond = (sel) => {
  const b = byBin(sel);
  const tot = totals(sel);
  const nonFolds = tot.n - tot.folds;
  const buckets = [[0, 0.5], [0.5, 1.0], [1.0, 2.0], [2.0, 99]];
  console.log('\n=== INVERSE CONDITIONAL — P(sizing | outcome), fit set ===');
  console.log('  bet/pot        P(size|fold)   P(size|continue)');
  for (const [lo, hi] of buckets) {
    const inB = b.filter(x => x.meanFrac >= lo && x.meanFrac < hi);
    const k = inB.reduce((a, x) => a + x.folds, 0);
    const n = inB.reduce((a, x) => a + x.n, 0);
    console.log(`  [${lo}, ${hi})`.padEnd(15) + `${fmt(k / tot.folds, 4)}         ${fmt((n - k) / nonFolds, 4)}`);
  }
};
invCond(poolEarly);

// ---------------------------------------------------------------------------
// 2. Refit the SAME functional form on the fit set.
// ---------------------------------------------------------------------------
const grid = { maxDelta: [], steepness: [], midpoint: [] };
for (let d = 0.05; d <= 1.01; d += 0.05) grid.maxDelta.push(Number(d.toFixed(2)));
for (let s = 0.5; s <= 8.01; s += 0.25) grid.steepness.push(Number(s.toFixed(2)));
for (let m = 0.05; m <= 2.51; m += 0.05) grid.midpoint.push(Number(m.toFixed(2)));

/** Fit (maxDelta, midpoint, steepnessUp, steepnessDown) — up and down INDEPENDENT.
 *  `steepness` is reported as their mean, the value callers that ignore the
 *  asymmetric pair fall back to. */
const fitCurve = (bins, base) => {
  let bs = null;
  for (const md of grid.maxDelta) {
    for (const mp of grid.midpoint) {
      for (const su of grid.steepness) {
        for (const sd of grid.steepness) {
          const p = { maxDelta: md, steepness: (su + sd) / 2, midpoint: mp, steepnessUp: su, steepnessDown: sd };
          const sc = brier(bins, base, p);
          if (!bs || sc < bs.score) bs = { score: sc, p };
        }
      }
    }
  }
  return bs;
};
const best = fitCurve(binsPoolEarly, basePool);
console.log(`\n=== REFIT (same functional form, fit set only) ===`);
console.log(JSON.stringify(best.p), 'brier=', fmt(best.score, 6));

table('FIT SET — POOL players, days 1-11', binsPoolEarly, basePool, { previous: PREVIOUS_CURVE, shipped: POPULATION_CURVE, refit: best.p });
table('HOLD-OUT — EVAL players, days 12-23', byBin(evalLate), baseEvalLate, { previous: PREVIOUS_CURVE, shipped: POPULATION_CURVE, refit: best.p });

// ---------------------------------------------------------------------------
// 3. The WS-273 report's own three buckets, reproduced on its own axis.
//    Its `sizeBucket` divides by the pot INCLUDING the faced bet: fCorpus = f/(1+f).
//    So 0-33 <-> f < 0.4925,  33-66 <-> 0.4925 <= f < 1.9412,  66-100 <-> f >= 1.9412.
// ---------------------------------------------------------------------------
const ticketBuckets = [['0-33', 0, 0.4925], ['33-66', 0.4925, 1.9412], ['66-100', 1.9412, 1e9]];
const ticketTable = (label, sel, base) => {
  console.log(`\n=== TICKET AXIS — ${label} ===`);
  console.log('  bucket        n        k      actual   shippedPred  err     refitPred   err');
  const bins = byBin(sel);
  for (const [nm, lo, hi] of ticketBuckets) {
    const inB = bins.filter(b => b.meanFrac >= lo && b.meanFrac < hi);
    const n = inB.reduce((a, b) => a + b.n, 0);
    const k = inB.reduce((a, b) => a + b.folds, 0);
    if (!n) continue;
    const predOf = (p) => inB.reduce((a, b) => a + b.n * logisticFoldResponse(base, b.meanFrac, p.maxDelta, p.steepness, p.midpoint, p.steepnessUp, p.steepnessDown), 0) / n;
    const ps = predOf(PREVIOUS_CURVE), pr = predOf(POPULATION_CURVE);
    console.log(`  ${nm.padEnd(8)} ${String(n).padStart(8)} ${String(k).padStart(8)}   ${fmt(k / n, 4)}    ${fmt(ps, 4)}   ${((k / n - ps) * 100 >= 0 ? '+' : '') + fmt((k / n - ps) * 100, 1)}pp   ${fmt(pr, 4)}   ${((k / n - pr) * 100 >= 0 ? '+' : '') + fmt((k / n - pr) * 100, 1)}pp`);
  }
};
ticketTable('HOLD-OUT (EVAL, days 12-23)', evalLate, baseEvalLate);
// Same, with the base the ENGINE actually ships (POPULATION_PRIORS.bet.fold = 0.45),
// which is a founder estimate of the LIVE pool, not a corpus number.
ticketTable('HOLD-OUT, base pinned at the shipped 0.45 live estimate', evalLate, 0.45);

// ---------------------------------------------------------------------------
// 4. Per-street: is FOLD_CURVE_STREET_MODS' direction supported?
// ---------------------------------------------------------------------------
console.log('\n=== PER-STREET REFIT (fit set only) — tests FOLD_CURVE_STREET_MODS ===');
console.log('  street      n        k     marginal   maxDelta  steepness  midpoint   brier');
const streetFits = {};
for (const s of ['flop', 'turn', 'river']) {
  const sel = select({ group: 'pool', facing: 'bet', earlyDays: true, streets: [s] });
  const t = totals(sel);
  if (t.n < 500) continue;
  const b = t.folds / t.n;
  const bins = byBin(sel);
  const bs = fitCurve(bins, b);
  streetFits[s] = bs.p;
  console.log(`  ${s.padEnd(8)} ${String(t.n).padStart(7)} ${String(t.folds).padStart(8)}   ${fmt(b, 4)}     ${fmt(bs.p.maxDelta, 2)}      ${fmt(bs.p.steepness, 2)}      ${fmt(bs.p.midpoint, 2)}    ${fmt(bs.score, 5)}   up=${fmt(bs.p.steepnessUp, 2)} down=${fmt(bs.p.steepnessDown, 2)}`);
  console.log(`           implied mults vs global refit: maxDelta x${fmt(bs.p.maxDelta / best.p.maxDelta, 2)}  steepness x${fmt(bs.p.steepness / best.p.steepness, 2)}  midpoint x${fmt(bs.p.midpoint / best.p.midpoint, 2)}`);
}
console.log('  shipped mods:  flop midpoint x0.90 maxDelta x1.10 steep x0.95 | turn x1.00 | river midpoint x1.10 maxDelta x0.85 steep x1.15');

// Do the SHIPPED street mods help or hurt, applied on top of the refit? Scored on the hold-out.
const SHIPPED_MODS = { flop: { midpointMult: 0.90, maxDeltaMult: 1.10, steepnessMult: 0.95 }, turn: { midpointMult: 1, maxDeltaMult: 1, steepnessMult: 1 }, river: { midpointMult: 1.10, maxDeltaMult: 0.85, steepnessMult: 1.15 } };
const applyMod = (p, m) => ({ maxDelta: p.maxDelta * m.maxDeltaMult, steepness: p.steepness * m.steepnessMult, steepnessUp: p.steepnessUp * m.steepnessMult, steepnessDown: p.steepnessDown * m.steepnessMult, midpoint: p.midpoint * m.midpointMult });
console.log('\n=== DO THE SHIPPED STREET MODS EARN THEIR PLACE? (hold-out, on top of the refit) ===');
console.log('  street    brier refit-only   brier refit+shippedMods   verdict');
for (const s of ['flop', 'turn', 'river']) {
  const sel = select({ group: 'eval', facing: 'bet', earlyDays: false, streets: [s] });
  const t = totals(sel); if (t.n < 500) continue;
  const b = t.folds / t.n, bins = byBin(sel);
  const a = brier(bins, b, POPULATION_CURVE), c = brier(bins, b, applyMod(POPULATION_CURVE, SHIPPED_MODS[s]));
  console.log(`  ${s.padEnd(8)} ${fmt(a, 5)}            ${fmt(c, 5)}                 ${c < a ? 'mods HELP' : 'mods HURT'} (${((c - a) * 1e5).toFixed(0)}e-5)`);
}

// Per-street residual slope on the HOLD-OUT under the single global refit.
console.log('\n=== HOLD-OUT residual slope by street, global refit vs shipped ===');
for (const s of ['flop', 'turn', 'river']) {
  const sel = select({ group: 'eval', facing: 'bet', earlyDays: false, streets: [s] });
  const t = totals(sel);
  if (t.n < 500) continue;
  const b = t.folds / t.n, bins = byBin(sel);
  const rs = residualSlope(bins, b, PREVIOUS_CURVE), rr = residualSlope(bins, b, POPULATION_CURVE);
  console.log(`  ${s.padEnd(6)} n=${String(t.n).padStart(7)}  marginal=${fmt(b, 4)}  slope shipped=${fmt(rs.slope, 4)} -> refit=${fmt(rr.slope, 4)}   brier ${fmt(brier(bins, b, PREVIOUS_CURVE), 5)} -> ${fmt(brier(bins, b, POPULATION_CURVE), 5)}`);
}

// Facing a RAISE — reported separately, never merged.
const raiseSel = select({ group: 'eval', facing: 'raise', earlyDays: false });
const tr = totals(raiseSel);
if (tr.n > 500) {
  const b = tr.folds / tr.n, bins = byBin(raiseSel);
  console.log(`\n=== HOLD-OUT facing a RAISE (separate population) n=${tr.n} k=${tr.folds} marginal=${fmt(b, 4)} ===`);
  console.log(`  slope shipped=${fmt(residualSlope(bins, b, PREVIOUS_CURVE).slope, 4)} -> refit=${fmt(residualSlope(bins, b, POPULATION_CURVE).slope, 4)}   brier ${fmt(brier(bins, b, PREVIOUS_CURVE), 5)} -> ${fmt(brier(bins, b, POPULATION_CURVE), 5)}`);
}

console.log('\nREFIT_JSON ' + JSON.stringify(best.p));

await loader.close();
