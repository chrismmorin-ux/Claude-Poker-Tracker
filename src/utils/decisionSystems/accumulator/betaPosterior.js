/**
 * betaPosterior.js — shared Beta-Binomial posterior primitives.
 *
 * Resolves z-constant drift between consumers:
 *   - anchorLibrary/primitiveValidity.js  → was 1.959963984540054
 *   - assumptionEngine/assumptionProducer → was 1.96
 *   - skillAssessment/heroDecisionAccumulator (Wilson) → was 1.96
 *
 * After extraction every consumer reads `Z_95` from this module. The
 * single source of truth is the IEEE-754 nearest-representable value of
 * the two-tailed inverse-normal at 97.5%, which is 1.959963984540054.
 *
 * Pure module — no IO, no side effects. Consumed by:
 *   - createAccumulator.js (folds an `applyEvent` reducer)
 *   - anchorLibrary/primitiveValidity.js (Tier-2 posterior update)
 *
 * Future consumers (deferred per ADR-1): assumptionEngine/assumptionProducer.js
 * Beta math migration is a future sprint; this module is the eventual home.
 */

// ───────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────

/**
 * Z-score for 95% two-tailed normal-approximation credible interval.
 * IEEE-754 nearest representable of Φ⁻¹(0.975). Use this constant; do NOT
 * inline 1.96 anywhere. CI grep enforces (`docs/decisions/2026-05-14-...`).
 */
export const Z_95 = 1.959963984540054;

/**
 * z-score lookup for common two-tailed CI levels. Falls back to Z_95 for
 * unknown levels (conservative — slightly tighter than exact at edges).
 */
const Z_BY_LEVEL = Object.freeze({
  0.90: 1.6448536269514722,
  0.95: Z_95,
  0.99: 2.5758293035489004,
});

const zForLevel = (level) => Z_BY_LEVEL[level] ?? Z_95;

// ───────────────────────────────────────────────────────────────────────────
// Beta posterior update (single event)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Apply one observation to a Beta(α, β) prior, returning the updated shape.
 *
 * Beta-Binomial update:
 *   success → Beta(α + w, β)
 *   failure → Beta(α, β + w)
 * where `w` is the observation weight clamped to [0, 1] (default 1).
 *
 * @param {Object} args
 * @param {{alpha: number, beta: number}} args.prior - Current Beta shape.
 * @param {boolean|'success'|'failure'} args.outcome - true / 'success' → success.
 * @param {number} [args.weight=1] - Observation weight; clamped to [0, 1].
 * @returns {{alpha: number, beta: number}} New Beta shape.
 */
export const applyEvent = ({ prior, outcome, weight = 1 }) => {
  if (!prior || typeof prior.alpha !== 'number' || typeof prior.beta !== 'number') {
    throw new TypeError('applyEvent: prior must be { alpha: number, beta: number }');
  }
  const w = clampWeight(weight);
  const isSuccess = outcome === true || outcome === 'success';
  return {
    alpha: prior.alpha + (isSuccess ? w : 0),
    beta: prior.beta + (isSuccess ? 0 : w),
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Posterior summary statistics
// ───────────────────────────────────────────────────────────────────────────

/**
 * Mean of Beta(α, β): α / (α + β).
 *
 * @param {{alpha: number, beta: number}} shape
 * @returns {number}
 */
export const mean = (shape) => {
  const total = shape.alpha + shape.beta;
  return total > 0 ? shape.alpha / total : 0;
};

/**
 * Variance of Beta(α, β): αβ / ((α+β)² (α+β+1)).
 *
 * @param {{alpha: number, beta: number}} shape
 * @returns {number}
 */
export const variance = (shape) => {
  const total = shape.alpha + shape.beta;
  if (total <= 0) return 0;
  return (shape.alpha * shape.beta) / (total * total * (total + 1));
};

/**
 * Standard deviation of Beta(α, β).
 *
 * @param {{alpha: number, beta: number}} shape
 * @returns {number}
 */
export const standardDeviation = (shape) => Math.sqrt(variance(shape));

/**
 * Approximate (1 − α)-level credible interval for Beta(α, β) using normal
 * approximation: mean ± z × σ, clamped to [0, 1].
 *
 * Returns `{ lower, upper, level }` to match the shape consumed by
 * anchorLibrary/primitiveValidity.js + assumptionEngine/validator.js.
 *
 * For n ≥ 20 this is accurate enough for production use. For n < 20 the
 * approximation widens conservatively (wider CI → harder to fire
 * invalidation rules), which is the safe direction.
 *
 * Phase 6+ may swap to exact Beta CDF inversion if precision becomes
 * load-bearing (e.g., for predicate-retirement decisions on small n).
 *
 * @param {{alpha: number, beta: number}} shape
 * @param {number} [level=0.95] - Two-tailed CI level.
 * @returns {{lower: number, upper: number, level: number}}
 */
export const credibleInterval = (shape, level = 0.95) => {
  if (!shape
    || !Number.isFinite(shape.alpha)
    || !Number.isFinite(shape.beta)
    || shape.alpha + shape.beta <= 0) {
    return { lower: 0, upper: 1, level };
  }
  const m = mean(shape);
  const sd = standardDeviation(shape);
  const z = zForLevel(level);
  return {
    lower: Math.max(0, m - z * sd),
    upper: Math.min(1, m + z * sd),
    level,
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

const clampWeight = (w) => {
  const n = typeof w === 'number' && Number.isFinite(w) ? w : 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};
