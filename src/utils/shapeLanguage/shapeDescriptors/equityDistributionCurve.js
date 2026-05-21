/**
 * equityDistributionCurve.js — Pure-math representation of the "hockey
 * stick" curve: sorted per-combo equity values + percentile mapping +
 * weight-respecting bucket histogram, derived from a per-combo equity
 * input.
 *
 * Per the SLS Gate 2 roundtable (`docs/projects/poker-shape-language/
 * roundtable.md:26-28`), the Equity-Distribution Curve is a DATA
 * STRUCTURE, not a classifier with a label output. Spire and
 * Polarization are downstream classifiers that operate ON TOP of the
 * curve emitted here (see `equityShapeClassifier.js`).
 *
 * Input contract: a `perCombo`-shaped array, each entry
 * `{ weight, heroEquity }` (additional fields ignored). This matches
 * the output of `computeComboEquityDistribution(...)` in
 * `src/utils/exploitEngine/gameTreeEquity.js:273`, but the input is
 * deliberately type-narrow so this module stays pure-math with no
 * exploitEngine dependency (data flows `exploitEngine/` →
 * `shapeLanguage/`, never the reverse — see `shapeLanguage/CLAUDE.md`
 * §Cross-domain import rule).
 *
 * Output is a discriminated-union-style descriptor object:
 *   {
 *     status: 'ok' | 'empty',
 *     sortedEquities: number[],      // by ascending equity, weighted
 *     percentiles: number[],         // 0..1 cumulative weight per sortedEquities[i]
 *     bucketHistogram: number[8],    // weight fraction in each of 8 equity buckets
 *     bucketEdges: number[9],        // [0, 0.125, 0.25, ..., 1.0]
 *     totalWeight: number,
 *     weightedMean: number,
 *     combosTotal: number,
 *   }
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

const NUM_BUCKETS = 8;

/**
 * 8 equally-spaced equity buckets [0, 1]. Used by Polarization
 * classifier downstream; exposed here so the EDC consumer can render
 * a histogram with the same axis.
 */
export const EQUITY_BUCKET_EDGES = Object.freeze([
  0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0,
]);

/**
 * Minimum total weight to consider the input curve classifiable. Below
 * this, return `status: 'empty'` and zero-valued fields rather than
 * forcing a meaningless distribution.
 */
const MIN_CLASSIFIABLE_WEIGHT = 0.01;

/**
 * Compute the equity-distribution curve descriptor from a per-combo
 * equity array.
 *
 * @param {Array<{weight: number, heroEquity: number}>} perCombo
 *   Per-combo equity entries. Other fields (card1/card2/bucket) are
 *   ignored. `weight` is the combo's range weight in [0, 1];
 *   `heroEquity` is hero's equity vs that combo on the current street
 *   (so 1 - heroEquity = villain's equity, which is what the descriptor
 *   actually describes for the villain's range).
 * @returns {{
 *   status: 'ok' | 'empty',
 *   sortedEquities: number[],
 *   percentiles: number[],
 *   bucketHistogram: number[],
 *   bucketEdges: number[],
 *   totalWeight: number,
 *   weightedMean: number,
 *   combosTotal: number,
 * }}
 */
export const computeEquityDistributionCurve = (perCombo) => {
  const emptyResult = {
    status: 'empty',
    sortedEquities: [],
    percentiles: [],
    bucketHistogram: new Array(NUM_BUCKETS).fill(0),
    bucketEdges: EQUITY_BUCKET_EDGES.slice(),
    totalWeight: 0,
    weightedMean: 0,
    combosTotal: 0,
  };

  if (!Array.isArray(perCombo) || perCombo.length === 0) {
    return emptyResult;
  }

  // The descriptor describes the VILLAIN's range, not hero's. perCombo
  // entries carry hero's equity vs each villain combo; villain equity
  // is the complement. Convert here so downstream classifiers reason
  // about villain's range shape directly.
  const entries = [];
  let totalWeight = 0;
  for (const c of perCombo) {
    if (!c || typeof c.weight !== 'number' || typeof c.heroEquity !== 'number') continue;
    if (!Number.isFinite(c.weight) || !Number.isFinite(c.heroEquity)) continue;
    if (c.weight < 0.001) continue;
    const villainEq = clamp01(1 - c.heroEquity);
    entries.push({ weight: c.weight, equity: villainEq });
    totalWeight += c.weight;
  }

  if (totalWeight < MIN_CLASSIFIABLE_WEIGHT || entries.length === 0) {
    return emptyResult;
  }

  // Sort ascending by villain equity to produce the hockey-stick curve.
  entries.sort((a, b) => a.equity - b.equity);

  const sortedEquities = entries.map((e) => e.equity);

  // Cumulative-weight percentile mapping. percentiles[i] = (cumulative
  // weight through entries[i]) / totalWeight. Gives a CDF the consumer
  // can plot directly.
  const percentiles = new Array(entries.length);
  let cumWeight = 0;
  for (let i = 0; i < entries.length; i++) {
    cumWeight += entries[i].weight;
    percentiles[i] = cumWeight / totalWeight;
  }

  // 8-bucket weighted histogram. Right-edge inclusive on the final
  // bucket so equity === 1 lands in bucket 7, not out-of-range.
  const bucketHistogram = new Array(NUM_BUCKETS).fill(0);
  let weightedEqSum = 0;
  for (const e of entries) {
    weightedEqSum += e.weight * e.equity;
    let bucketIdx = Math.floor(e.equity * NUM_BUCKETS);
    if (bucketIdx >= NUM_BUCKETS) bucketIdx = NUM_BUCKETS - 1;
    if (bucketIdx < 0) bucketIdx = 0;
    bucketHistogram[bucketIdx] += e.weight;
  }
  for (let i = 0; i < NUM_BUCKETS; i++) {
    bucketHistogram[i] = bucketHistogram[i] / totalWeight;
  }

  return {
    status: 'ok',
    sortedEquities,
    percentiles,
    bucketHistogram,
    bucketEdges: EQUITY_BUCKET_EDGES.slice(),
    totalWeight,
    weightedMean: weightedEqSum / totalWeight,
    combosTotal: entries.length,
  };
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
