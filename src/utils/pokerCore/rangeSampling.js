/**
 * rangeSampling.js — stratified, reproducible sampling of a range's combos.
 *
 * EXTRACTED, NOT WRITTEN (WS-313). This is `sampleCombos` from
 * `scripts/backtest/heroPolicy.mjs` (WS-287), moved into src/ so the live engine and
 * the backtest harness share ONE implementation. The harness now imports it from here.
 * Two copies of a sampler that decides which hands represent a range is exactly the
 * divergence `statsEngineParity.seam.test.js` was written to catch elsewhere.
 */

import { enumerateCombos } from './rangeMatrix';
import { comboStrengthPercentile } from './handEvaluator';

/**
 * Systematic weight-proportional sample of `k` combos, ordered by board strength.
 *
 * WHY SORT FIRST — this is what makes the sample stratified rather than arbitrary.
 * The sample points march up the strength axis, so a range that is 20% nutted and 40%
 * air contributes roughly that mix at ANY k, instead of depending on where random
 * draws happened to land. That property is what makes a small k usable: the engine's
 * cost budget forces k into the low tens, and at that size random sampling of a
 * polarized range routinely misses either the nuts or the air entirely.
 *
 * It is also exactly reproducible — no RNG — which both the backtest and the engine's
 * own regression tests require.
 *
 * @param {Float64Array} range - 169-cell weight grid
 * @param {number[]} board - encoded board cards (also used as dead cards)
 * @param {number} k - target sample size
 * @returns {Array<{card1: number, card2: number, weight: number, strength: number, sampleWeight: number}>}
 *          sampleWeight sums to 1 across the returned combos
 */
export const sampleCombos = (range, board, k) => {
  if (!range || !(k > 0)) return [];
  const combos = enumerateCombos(range, board);
  if (combos.length === 0) return [];

  for (const c of combos) {
    c.strength = comboStrengthPercentile(c.card1, c.card2, board);
  }
  combos.sort((a, b) => a.strength - b.strength);

  const total = combos.reduce((s, c) => s + c.weight, 0);
  if (!(total > 0)) return [];
  if (combos.length <= k) {
    return combos.map((c) => ({ ...c, sampleWeight: c.weight / total }));
  }

  // Equally spaced cumulative-weight points, offset to the midpoint of each stratum
  // so the sample is not biased toward either tail.
  const out = [];
  const step = total / k;
  let cum = 0;
  let idx = 0;
  for (let i = 0; i < k; i++) {
    const target = (i + 0.5) * step;
    while (idx < combos.length - 1 && cum + combos[idx].weight < target) {
      cum += combos[idx].weight;
      idx++;
    }
    out.push({ ...combos[idx], sampleWeight: 1 / k });
  }
  return out;
};
