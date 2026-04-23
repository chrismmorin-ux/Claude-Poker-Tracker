/**
 * operator.js — Apply DecisionModelOperator transforms to an ActionDistribution
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Per schema v1.1 §1.7:
 *   - `transform.actionDistributionDelta` shifts the baseline distribution.
 *   - Deltas must sum to 0 (validator enforces).
 *   - Per-assumption `currentDial` ∈ [0, 1] scales the applied delta proportionally.
 *   - Result is clipped to [0, 1] per action, then renormalized if clipping occurred.
 *
 * Honesty check (I-AE-3): `dial = 0` MUST produce zero delta from baseline.
 * This module enforces that structurally — `applyOperator` with dial=0 returns the
 * normalized baseline unchanged (modulo floating-point drift).
 *
 * Pure module — no imports from outside assumptionEngine/ except assumptionTypes.
 */

/**
 * Apply an operator transform to a baseline action distribution, scaled by dial.
 *
 * @param {Object} operator - DecisionModelOperator per schema §1.7
 * @param {Object} baseline - ActionDistribution { fold, call, raise } summing to ~1.0
 * @param {number} [dialOverride] - Optional dial override; defaults to operator.currentDial
 * @returns {Object} Mutated ActionDistribution summing to 1.0
 */
export const applyOperator = (operator, baseline, dialOverride) => {
  const normalizedBaseline = normalizeDistribution(baseline);

  if (!operator || typeof operator !== 'object') {
    return normalizedBaseline;
  }

  const dial = clampDial(dialOverride !== undefined ? dialOverride : operator.currentDial);

  // Honesty check: dial = 0 returns baseline unchanged.
  if (dial === 0) return normalizedBaseline;

  const delta = operator.transform?.actionDistributionDelta;
  if (!delta || typeof delta !== 'object') {
    return normalizedBaseline;
  }

  // Apply dial-scaled delta to each action.
  const shifted = {
    fold: (normalizedBaseline.fold ?? 0) + (delta.fold ?? 0) * dial,
    call: (normalizedBaseline.call ?? 0) + (delta.call ?? 0) * dial,
    raise: (normalizedBaseline.raise ?? 0) + (delta.raise ?? 0) * dial,
  };

  // Clip each action to [0, 1] + renormalize.
  return clampAndRenormalize(shifted);
};

/**
 * Compose multiple operators onto a baseline in a single pass.
 *
 * Per schema §1.7, when multiple operators target the same node, order is
 * stable by `quality.composite` descending. Caller is expected to pre-sort
 * the appliedOperators array accordingly.
 *
 * Suppression resolution (schema §1.7.1) is a caller concern — the suppression
 * module (Commit 5) dials suppressed operators to 0 before they reach this function.
 *
 * @param {Array<{operator, dial}>} appliedOperators - [{operator, dial}, ...]
 * @param {Object} baseline - ActionDistribution
 * @returns {Object} Composed ActionDistribution
 */
export const composeOperators = (appliedOperators, baseline) => {
  if (!Array.isArray(appliedOperators) || appliedOperators.length === 0) {
    return normalizeDistribution(baseline);
  }

  // Accumulate deltas across all operators, then apply once.
  // This avoids renormalization cascade between operators.
  let totalFoldDelta = 0;
  let totalCallDelta = 0;
  let totalRaiseDelta = 0;

  for (const { operator, dial } of appliedOperators) {
    if (!operator || !operator.transform?.actionDistributionDelta) continue;
    const d = clampDial(dial !== undefined ? dial : operator.currentDial);
    if (d === 0) continue;
    const delta = operator.transform.actionDistributionDelta;
    totalFoldDelta += (delta.fold ?? 0) * d;
    totalCallDelta += (delta.call ?? 0) * d;
    totalRaiseDelta += (delta.raise ?? 0) * d;
  }

  const normalized = normalizeDistribution(baseline);
  const shifted = {
    fold: (normalized.fold ?? 0) + totalFoldDelta,
    call: (normalized.call ?? 0) + totalCallDelta,
    raise: (normalized.raise ?? 0) + totalRaiseDelta,
  };

  return clampAndRenormalize(shifted);
};

/**
 * Compute effective dial from quality composite via sigmoid curve.
 * Schema §6.1 default curve: `dialFloor + (dialCeiling - dialFloor) × sigmoid(k × (quality - 0.5))`.
 *
 * @param {number} qualityComposite - [0, 1]
 * @param {Object} [params] - { dialFloor, dialCeiling, sigmoidSteepness }
 * @returns {number} Dial in [dialFloor, dialCeiling]
 */
export const computeDialFromQuality = (qualityComposite, params = {}) => {
  const floor = params.dialFloor ?? 0.3;
  const ceiling = params.dialCeiling ?? 0.9;
  const k = params.sigmoidSteepness ?? 8;
  const sig = sigmoid(k * (clamp01(qualityComposite) - 0.5));
  return clamp(floor + (ceiling - floor) * sig, floor, ceiling);
};

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers
// ───────────────────────────────────────────────────────────────────────────

const normalizeDistribution = (dist) => {
  if (!dist || typeof dist !== 'object') return { fold: 0, call: 0, raise: 0 };
  const fold = Math.max(0, Number.isFinite(dist.fold) ? dist.fold : 0);
  const call = Math.max(0, Number.isFinite(dist.call) ? dist.call : 0);
  const raise = Math.max(0, Number.isFinite(dist.raise) ? dist.raise : 0);
  const sum = fold + call + raise;
  if (sum === 0) return { fold: 0, call: 0, raise: 0 };
  return { fold: fold / sum, call: call / sum, raise: raise / sum };
};

const clampAndRenormalize = (dist) => {
  const fold = clamp01(dist.fold);
  const call = clamp01(dist.call);
  const raise = clamp01(dist.raise);
  const sum = fold + call + raise;
  if (sum === 0) return { fold: 0, call: 0, raise: 0 };
  return { fold: fold / sum, call: call / sum, raise: raise / sum };
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => clamp(Number.isFinite(v) ? v : 0, 0, 1);

const clampDial = (v) => {
  if (!Number.isFinite(v)) return 0;
  return clamp(v, 0, 1);
};

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
