/**
 * fearIndex.js — Per-combo + range-weighted fear computation
 *
 * Part of the emotionalState module. See `CLAUDE.md` for rules (mandatory read).
 *
 * v1 non-zero factors:
 *   - rangePositionBottomShare (weight 0.6) — fraction of villain's range that is bottom-30% preflop
 *   - sprDynamicFear (weight 0.2) — high SPR with marginal range elevates fear
 *   - sessionStuck (weight 0.2) — villain down ≥ 2 buy-ins this session
 *
 * v1 stubbed factors (documented for Commit 3+):
 *   - textureShift — requires board-level handAnalysis integration
 *   - drawCompletion — requires board runout analysis
 *   - rangeCapping — requires action-sequence-aware range narrowing
 *
 * Range iteration uses the 169-cell villain range grid from rangeEngine/rangeProfile.
 * Per-combo fear is then range-weighted: expectedFear = Σ weight[i] × fearIndex(combo_i, state).
 */

import { decodeIndex } from '../pokerCore/rangeMatrix';

const GRID_SIZE = 169;

/**
 * Preflop hand strength rank in [0, 1].
 * Simple proxy — pairs ranked on pair value, unpaired on high-card + kicker + suitedness.
 * Benchmark values: AA = 0.97, KK = 0.92, 22 = 0.45, AKs = 0.85, AKo = 0.77,
 * JTs = 0.61, 72o = 0.10, 83o = 0.18, 94o = 0.26.
 *
 * This is intentionally approximate for v1. Commit 3+ can introduce board-relative
 * strength when handAnalysis integration lands. See CLAUDE.md "v1 stubbed factors."
 *
 * Formula:
 *   pair:     0.45 + rank × 0.0433   (22 = 0.45, AA = 0.97)
 *   unpaired: −0.15 + 0.6 × (high/12) + 0.35 × (low/12) + (suited ? 0.08 : 0)
 *             clamped to [0, 1]
 *
 * @param {number} idx - 0..168 range grid index
 * @returns {number} in [0, 1]
 */
export const cellPreflopStrength = (idx) => {
  const { rank1, rank2, suited, isPair } = decodeIndex(idx);
  if (isPair) {
    // 22 = 0.45, AA = 0.97
    return 0.45 + rank1 * 0.0433;
  }
  const hi = Math.max(rank1, rank2) / 12;
  const lo = Math.min(rank1, rank2) / 12;
  const suitedBonus = suited ? 0.08 : 0;
  const raw = -0.15 + hi * 0.6 + lo * 0.35 + suitedBonus;
  return Math.min(1.0, Math.max(0, raw));
};

/**
 * Bottom-share threshold (cells with strength below this count as "bottom").
 * 0.35 approximately captures the bottom 30% of hands by preflop rank.
 */
export const BOTTOM_THRESHOLD = 0.35;

/**
 * Compute rangePositionBottomShare — weighted fraction of range in bottom 30%.
 * @param {Float64Array} rangeWeights - 169-cell grid
 * @returns {number} in [0, 1]; returns 0 when rangeWeights is empty/all-zero
 */
export const rangePositionBottomShare = (rangeWeights) => {
  if (!rangeWeights || rangeWeights.length !== GRID_SIZE) return 0;
  let totalWeight = 0;
  let bottomWeight = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = rangeWeights[i];
    if (w <= 0) continue;
    totalWeight += w;
    if (cellPreflopStrength(i) < BOTTOM_THRESHOLD) {
      bottomWeight += w;
    }
  }
  return totalWeight > 0 ? bottomWeight / totalWeight : 0;
};

/**
 * Compute SPR-dynamic fear contribution.
 *
 * High SPR (≥ 8) with a range whose bottom share exceeds 40% creates fear —
 * villain has a lot of marginal equity facing potential multi-street pressure.
 * Low SPR (≤ 2) does not contribute fear regardless of range composition.
 *
 * @param {number} spr - Stack-to-pot ratio
 * @param {number} bottomShare - rangePositionBottomShare output
 * @returns {number} in [0, 1]
 */
export const sprDynamicFear = (spr, bottomShare) => {
  if (!Number.isFinite(spr) || spr < 0) return 0;
  if (spr <= 2) return 0;
  const sprFactor = Math.min(1.0, (spr - 2) / 10); // 0 at SPR=2, 1 at SPR=12
  const shareFactor = Math.max(0, bottomShare - 0.4) * 2.5; // 0 at share=0.4, 1 at share=0.8
  return Math.min(1.0, sprFactor * shareFactor);
};

/**
 * Compute session-stuck fear contribution.
 * Fires when villain's session P/L is below a stuck threshold.
 *
 * @param {number} bbDelta - Villain's session bb delta (negative = losing)
 * @param {number} stuckThreshold - bb units of loss that qualifies (default -200 bb = 2 buy-ins of 100bb)
 * @returns {number} in [0, 1]; proportional to depth of loss, capped at 1.0 when 5+ buy-ins stuck
 */
export const sessionStuckFear = (bbDelta, stuckThreshold = -200) => {
  if (!Number.isFinite(bbDelta)) return 0;
  if (bbDelta >= stuckThreshold) return 0;
  // Stuck 2 buy-ins = 0.2, 5 buy-ins = 0.8, 7+ buy-ins = 1.0
  const excess = (stuckThreshold - bbDelta) / 500; // scale: 500bb = 5 buy-ins
  return Math.min(1.0, 0.2 + excess);
};

/**
 * Weight constants for v1 fear aggregation.
 * Sum of active weights ≤ 1.0. Stubbed factors have weight 0 in v1; extending
 * them requires updating this object + adding the factor's computation.
 */
export const FEAR_FACTOR_WEIGHTS = Object.freeze({
  rangePositionBottomShare: 0.6,
  sprDynamicFear: 0.2,
  sessionStuckFear: 0.2,
  textureShift: 0, // v1 stub
  drawCompletion: 0, // v1 stub
  rangeCapping: 0, // v1 stub
});

/**
 * Compute overall range-weighted fear index.
 *
 * @param {Float64Array} rangeWeights - 169-cell villain range grid
 * @param {Object} gameState - { spr: number }
 * @param {Object} sessionContext - { villainBBDelta: number }
 * @returns {{ index: number, sources: Array<{factor, weight, value, citation}> }}
 */
export const computeFearIndex = (rangeWeights, gameState = {}, sessionContext = {}) => {
  const bottomShare = rangePositionBottomShare(rangeWeights);
  const spr = gameState.spr ?? 0;
  const sprFear = sprDynamicFear(spr, bottomShare);
  const bbDelta = sessionContext.villainBBDelta ?? 0;
  const stuckFear = sessionStuckFear(bbDelta);

  const sources = [
    {
      factor: 'rangePositionBottomShare',
      weight: FEAR_FACTOR_WEIGHTS.rangePositionBottomShare,
      value: bottomShare,
      citation: `${(bottomShare * 100).toFixed(0)}% of villain's range is bottom-30% hands`,
    },
    {
      factor: 'sprDynamicFear',
      weight: FEAR_FACTOR_WEIGHTS.sprDynamicFear,
      value: sprFear,
      citation: `SPR ${spr.toFixed(1)} with ${(bottomShare * 100).toFixed(0)}% marginal range`,
    },
    {
      factor: 'sessionStuckFear',
      weight: FEAR_FACTOR_WEIGHTS.sessionStuckFear,
      value: stuckFear,
      citation: bbDelta < -200
        ? `villain stuck ${(-bbDelta / 100).toFixed(1)} buy-ins`
        : 'villain not stuck',
    },
  ];

  const index =
    bottomShare * FEAR_FACTOR_WEIGHTS.rangePositionBottomShare +
    sprFear * FEAR_FACTOR_WEIGHTS.sprDynamicFear +
    stuckFear * FEAR_FACTOR_WEIGHTS.sessionStuckFear;

  return {
    index: Math.min(1.0, Math.max(0, index)),
    sources,
  };
};
