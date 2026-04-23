/**
 * greedIndex.js — Per-combo + range-weighted greed computation
 *
 * Part of the emotionalState module. See `CLAUDE.md` for rules (mandatory read).
 *
 * v1 non-zero factors:
 *   - rangePositionTopShare (weight 0.6) — fraction of villain's range that is top-15% preflop
 *   - sprDynamicGreed (weight 0.2) — low SPR + top-heavy range = commitment greed
 *   - sessionHeaterGreed (weight 0.2) — villain up ≥ 2 buy-ins this session
 *
 * v1 stubbed factors (documented for Commit 3+):
 *   - textureShift_for_combo — requires handAnalysis integration
 *   - rangeUncapping — requires action-aware range widening analysis
 *
 * Range iteration is the same 169-cell grid as fearIndex. The two indices are
 * computed INDEPENDENTLY: a villain can be high-fear AND high-greed simultaneously
 * (e.g. top pair on 4-flush board). Joint preservation is owner directive 2026-04-23.
 */

import { cellPreflopStrength } from './fearIndex';

const GRID_SIZE = 169;

/**
 * Top-share threshold — cells with strength above this count as "top".
 * 0.82 approximately captures the top 15% of preflop hands.
 */
export const TOP_THRESHOLD = 0.82;

/**
 * Compute rangePositionTopShare — weighted fraction of range in top 15%.
 * @param {Float64Array} rangeWeights - 169-cell grid
 * @returns {number} in [0, 1]; returns 0 when empty/all-zero
 */
export const rangePositionTopShare = (rangeWeights) => {
  if (!rangeWeights || rangeWeights.length !== GRID_SIZE) return 0;
  let totalWeight = 0;
  let topWeight = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = rangeWeights[i];
    if (w <= 0) continue;
    totalWeight += w;
    if (cellPreflopStrength(i) >= TOP_THRESHOLD) {
      topWeight += w;
    }
  }
  return totalWeight > 0 ? topWeight / totalWeight : 0;
};

/**
 * Compute SPR-dynamic greed contribution.
 *
 * Low SPR (≤ 4) with top-heavy range (topShare ≥ 0.3) triggers commitment greed —
 * villain wants to get stacks in with hands that are close to nutted.
 *
 * @param {number} spr - Stack-to-pot ratio
 * @param {number} topShare - rangePositionTopShare output
 * @returns {number} in [0, 1]
 */
export const sprDynamicGreed = (spr, topShare) => {
  if (!Number.isFinite(spr) || spr < 0) return 0;
  if (spr >= 8) return 0;
  const sprFactor = Math.max(0, (4 - spr) / 4); // 1 at SPR=0, 0 at SPR=4+
  // Clamp SPR=0 edge; still want some greed at small-but-nonzero SPR
  const sprEffective = spr < 4 ? Math.max(sprFactor, 0.5) : sprFactor;
  const shareFactor = Math.max(0, topShare - 0.1) * 1.25; // 0 at topShare=0.1, 1 at topShare=0.9
  return Math.min(1.0, sprEffective * shareFactor);
};

/**
 * Compute session-heater greed contribution.
 * Fires when villain's session P/L is above a heater threshold.
 *
 * @param {number} bbDelta - Villain's session bb delta (positive = winning)
 * @param {number} heaterThreshold - bb units of profit that qualifies (default +200 bb = 2 buy-ins)
 * @returns {number} in [0, 1]
 */
export const sessionHeaterGreed = (bbDelta, heaterThreshold = 200) => {
  if (!Number.isFinite(bbDelta)) return 0;
  if (bbDelta <= heaterThreshold) return 0;
  // Up 2 buy-ins = 0.2, 5 buy-ins = 0.8, 7+ buy-ins = 1.0
  const excess = (bbDelta - heaterThreshold) / 500;
  return Math.min(1.0, 0.2 + excess);
};

/**
 * Weight constants for v1 greed aggregation.
 * Sum of active weights ≤ 1.0. Stubbed factors have weight 0 in v1.
 */
export const GREED_FACTOR_WEIGHTS = Object.freeze({
  rangePositionTopShare: 0.6,
  sprDynamicGreed: 0.2,
  sessionHeaterGreed: 0.2,
  textureShift: 0, // v1 stub
  rangeUncapping: 0, // v1 stub
});

/**
 * Compute overall range-weighted greed index.
 *
 * @param {Float64Array} rangeWeights - 169-cell villain range grid
 * @param {Object} gameState - { spr: number }
 * @param {Object} sessionContext - { villainBBDelta: number }
 * @returns {{ index: number, sources: Array<{factor, weight, value, citation}> }}
 */
export const computeGreedIndex = (rangeWeights, gameState = {}, sessionContext = {}) => {
  const topShare = rangePositionTopShare(rangeWeights);
  const spr = gameState.spr ?? 0;
  const sprGreed = sprDynamicGreed(spr, topShare);
  const bbDelta = sessionContext.villainBBDelta ?? 0;
  const heaterGreed = sessionHeaterGreed(bbDelta);

  const sources = [
    {
      factor: 'rangePositionTopShare',
      weight: GREED_FACTOR_WEIGHTS.rangePositionTopShare,
      value: topShare,
      citation: `${(topShare * 100).toFixed(0)}% of villain's range is top-15% hands`,
    },
    {
      factor: 'sprDynamicGreed',
      weight: GREED_FACTOR_WEIGHTS.sprDynamicGreed,
      value: sprGreed,
      citation: `SPR ${spr.toFixed(1)} with ${(topShare * 100).toFixed(0)}% premium range`,
    },
    {
      factor: 'sessionHeaterGreed',
      weight: GREED_FACTOR_WEIGHTS.sessionHeaterGreed,
      value: heaterGreed,
      citation: bbDelta > 200
        ? `villain up ${(bbDelta / 100).toFixed(1)} buy-ins`
        : 'villain not on heater',
    },
  ];

  const index =
    topShare * GREED_FACTOR_WEIGHTS.rangePositionTopShare +
    sprGreed * GREED_FACTOR_WEIGHTS.sprDynamicGreed +
    heaterGreed * GREED_FACTOR_WEIGHTS.sessionHeaterGreed;

  return {
    index: Math.min(1.0, Math.max(0, index)),
    sources,
  };
};
