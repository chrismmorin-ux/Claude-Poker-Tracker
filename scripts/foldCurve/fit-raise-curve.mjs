/**
 * fit-raise-curve.mjs — WS-402. Fit the FACING-A-RAISE fold curve on the same corpus,
 * the same functional form and the same partition as `fit-fold-curve.mjs` fit the
 * facing-a-BET curve, and score it on the same hold-out.
 *
 * WHY IT IS A SEPARATE POPULATION. `fold-curve-fit.txt` already reports the raise
 * population's marginal (0.4242 on the hold-out, against 0.5616 facing a bet) and its
 * residual slope under the shipped bet curve (0.1842), i.e. the bet curve is
 * systematically wrong on raises and wrong in a sizing-dependent way. It never recorded
 * the refit PARAMETERS, so the engine had nothing to use and kept applying the bet curve.
 *
 * Usage: node scripts/foldCurve/fit-raise-curve.mjs
 */

import { readFileSync } from 'node:fs';

const DATA = 'out/fold-vs-sizing.json';
const DAY_SPLIT = 12;

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logisticFoldResponse = (baseFold, fraction, maxDelta, steepness, midpoint, steepnessUp, steepnessDown) => {
  const k = fraction < midpoint ? (steepnessUp ?? steepness) : (steepnessDown ?? steepness);
  return Math.min(1, Math.max(0, baseFold + (sigmoid(k * (fraction - midpoint)) - 0.5) * maxDelta));
};

const SHIPPED_BET_CURVE = { maxDelta: 0.95, steepness: 1.0, midpoint: 0.35, steepnessUp: 6.5, steepnessDown: 0.75 };

const raw = JSON.parse(readFileSync(DATA, 'utf8'));
const rows = Object.entries(raw.cells).map(([k, v]) => {
  const [group, site, day, street, facing, bin] = k.split('|');
  return { group, site, day: +day, street, facing, bin: +bin, n: v.n, folds: v.folds, sumFrac: v.sumFrac };
});

const select = ({ group, facing, earlyDays, streets }) => rows.filter(r =>
  (group == null || r.group === group)
  && (facing == null || r.facing === facing)
  && (earlyDays == null || (earlyDays ? r.day < DAY_SPLIT : r.day >= DAY_SPLIT))
  && (streets == null || streets.includes(r.street))
  && r.bin >= 0);

const byBin = (sel) => {
  const m = new Map();
  for (const r of sel) {
    let b = m.get(r.bin);
    if (!b) { b = { bin: r.bin, n: 0, folds: 0, sumFrac: 0 }; m.set(r.bin, b); }
    b.n += r.n; b.folds += r.folds; b.sumFrac += r.sumFrac;
  }
  return [...m.values()].sort((a, b) => a.bin - b.bin).map(b => ({ ...b, meanFrac: b.sumFrac / b.n, obs: b.folds / b.n }));
};
const totals = (sel) => sel.reduce((a, r) => ({ n: a.n + r.n, folds: a.folds + r.folds }), { n: 0, folds: 0 });

const brier = (bins, base, p) => {
  let s = 0, n = 0;
  for (const b of bins) {
    const pred = logisticFoldResponse(base, b.meanFrac, p.maxDelta, p.steepness, p.midpoint, p.steepnessUp, p.steepnessDown);
    s += b.n * pred * pred - 2 * pred * b.folds + b.folds; n += b.n;
  }
  return s / n;
};
const residualSlope = (bins, base, p) => {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const b of bins) {
    const pred = logisticFoldResponse(base, b.meanFrac, p.maxDelta, p.steepness, p.midpoint, p.steepnessUp, p.steepnessDown);
    const res = b.obs - pred, w = b.n, x = b.meanFrac;
    sw += w; sx += w * x; sy += w * res; sxx += w * x * x; sxy += w * x * res;
  }
  const den = sw * sxx - sx * sx;
  return { slope: (sw * sxy - sx * sy) / den, meanResidual: sy / sw };
};

const grid = { maxDelta: [], steepness: [], midpoint: [] };
for (let d = 0.05; d <= 1.01; d += 0.05) grid.maxDelta.push(Number(d.toFixed(2)));
for (let s = 0.5; s <= 8.01; s += 0.25) grid.steepness.push(Number(s.toFixed(2)));
for (let m = 0.05; m <= 2.51; m += 0.05) grid.midpoint.push(Number(m.toFixed(2)));

const fitCurve = (bins, base) => {
  let bs = null;
  for (const md of grid.maxDelta) for (const mp of grid.midpoint) for (const su of grid.steepness) for (const sd of grid.steepness) {
    const p = { maxDelta: md, steepness: (su + sd) / 2, midpoint: mp, steepnessUp: su, steepnessDown: sd };
    const sc = brier(bins, base, p);
    if (!bs || sc < bs.score) bs = { score: sc, p };
  }
  return bs;
};

const fmt = (x, d = 4) => (x == null || Number.isNaN(x) ? '  n/a' : x.toFixed(d));

const fitSel = select({ group: 'pool', facing: 'raise', earlyDays: true });
const tFit = totals(fitSel);
const baseFit = tFit.folds / tFit.n;
const binsFit = byBin(fitSel);

const hoSel = select({ group: 'eval', facing: 'raise', earlyDays: false });
const tHo = totals(hoSel);
const baseHo = tHo.folds / tHo.n;
const binsHo = byBin(hoSel);

console.log('=== CONDITIONING SET — FACING A RAISE ===');
console.log(`FIT SET  : POOL players, days 1-${DAY_SPLIT - 1}.  k=${tFit.folds} / n=${tFit.n}  marginal fold=${fmt(baseFit)}`);
console.log(`HOLD-OUT : EVAL players, days ${DAY_SPLIT}-23.     k=${tHo.folds} / n=${tHo.n}  marginal fold=${fmt(baseHo)}`);

const best = fitCurve(binsFit, baseFit);
console.log(`\n=== REFIT (facing a raise, fit set only) ===`);
console.log(JSON.stringify(best.p), 'brier=', fmt(best.score, 6));

for (const [label, bins, base] of [['FIT SET', binsFit, baseFit], ['HOLD-OUT', binsHo, baseHo]]) {
  console.log(`\n### ${label} (base=${fmt(base)})`);
  console.log('  frac      n      k     obs      betCurve  resid     raiseFit  resid');
  for (const b of bins) {
    if (b.n < 300) continue;
    const pB = logisticFoldResponse(base, b.meanFrac, SHIPPED_BET_CURVE.maxDelta, SHIPPED_BET_CURVE.steepness, SHIPPED_BET_CURVE.midpoint, SHIPPED_BET_CURVE.steepnessUp, SHIPPED_BET_CURVE.steepnessDown);
    const pR = logisticFoldResponse(base, b.meanFrac, best.p.maxDelta, best.p.steepness, best.p.midpoint, best.p.steepnessUp, best.p.steepnessDown);
    console.log(`  ${fmt(b.meanFrac, 2).padStart(5)} ${String(b.n).padStart(6)} ${String(b.folds).padStart(6)}  ${fmt(b.obs)}    ${fmt(pB).padStart(8)} ${(b.obs - pB >= 0 ? '+' : '') + fmt(b.obs - pB, 3)}    ${fmt(pR).padStart(8)} ${(b.obs - pR >= 0 ? '+' : '') + fmt(b.obs - pR, 3)}`);
  }
  for (const [nm, p] of [['betCurve', SHIPPED_BET_CURVE], ['raiseFit', best.p]]) {
    const r = residualSlope(bins, base, p);
    console.log(`  [${nm}] slope=${fmt(r.slope)}  meanResid=${fmt(r.meanResidual)}  brier=${fmt(brier(bins, base, p), 5)}`);
  }
}

console.log('\nRAISE_REFIT_JSON ' + JSON.stringify(best.p));
console.log('RAISE_MARGINAL_FIT ' + fmt(baseFit) + '  RAISE_MARGINAL_HOLDOUT ' + fmt(baseHo));
