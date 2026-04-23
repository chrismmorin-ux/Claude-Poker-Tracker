/**
 * tiltTransform.js — Apply emotional tilt to an action distribution
 *
 * Part of the emotionalState module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Per schema v1.1 §3.3:
 *   - fear ↑ shifts probability mass toward fold
 *   - greed ↑ shifts probability mass toward raise
 *   - call absorbs the counter-mass
 *
 * Coefficients are literature-informed priors (solver equity-realization studies):
 *   - fearCoefficient = 8 → 0.1 fearIndex ≈ +2% fold shift
 *   - greedCoefficient = 6 → 0.1 greedIndex ≈ +1.5% raise shift
 *
 * Per-style multipliers reflect Exploit Theorist observation that fish feel emotion more:
 *   Fish × 1.4, Nit × 0.7, LAG × 1.1, TAG × 1.0, Unknown × 1.0
 *
 * Compound caps: fear ≤ +25% fold, greed ≤ +20% raise (schema §3.3).
 *
 * Conservative-ceiling rule (calibration.md §3.3): when Tier-2 gap > 0.25 for a predicate,
 * `predicateTransformScale[predicateKey]` scales coefficients down. Applied by caller
 * via the `scale` option; this module does not own the scale registry.
 */

export const EMOTIONAL_TRANSFORM_VERSION = '1.0';

export const FEAR_COEFFICIENT = 8;
export const GREED_COEFFICIENT = 6;
export const FEAR_FOLD_CAP = 0.25;
export const GREED_RAISE_CAP = 0.20;

export const STYLE_MULTIPLIERS = Object.freeze({
  Fish: 1.4,
  Nit: 0.7,
  LAG: 1.1,
  TAG: 1.0,
  Unknown: 1.0,
});

/**
 * Compute the fold% shift from a fear index, style, and optional scale factor.
 *
 * Uses the per-combo literature prior: `fearShift = fearIndex × fearCoefficient × 0.025 × styleMultiplier × scale`,
 * capped at FEAR_FOLD_CAP (compound cap).
 *
 * @param {number} fearIndex - [0, 1]
 * @param {string} villainStyle - "Fish" | "Nit" | "LAG" | "TAG" | "Unknown"
 * @param {number} [scale=1.0] - conservative-ceiling scale for this predicate
 * @returns {number} Shift in [0, FEAR_FOLD_CAP]
 */
export const fearFoldShift = (fearIndex, villainStyle = 'Unknown', scale = 1.0) => {
  if (!Number.isFinite(fearIndex) || fearIndex <= 0) return 0;
  const mult = STYLE_MULTIPLIERS[villainStyle] ?? STYLE_MULTIPLIERS.Unknown;
  const raw = Math.max(0, Math.min(1, fearIndex)) * FEAR_COEFFICIENT * 0.025 * mult * scale;
  return Math.min(FEAR_FOLD_CAP, Math.max(0, raw));
};

/**
 * Compute the raise% shift from a greed index, style, and optional scale factor.
 *
 * @param {number} greedIndex - [0, 1]
 * @param {string} villainStyle
 * @param {number} [scale=1.0]
 * @returns {number} Shift in [0, GREED_RAISE_CAP]
 */
export const greedRaiseShift = (greedIndex, villainStyle = 'Unknown', scale = 1.0) => {
  if (!Number.isFinite(greedIndex) || greedIndex <= 0) return 0;
  const mult = STYLE_MULTIPLIERS[villainStyle] ?? STYLE_MULTIPLIERS.Unknown;
  const raw = Math.max(0, Math.min(1, greedIndex)) * GREED_COEFFICIENT * 0.025 * mult * scale;
  return Math.min(GREED_RAISE_CAP, Math.max(0, raw));
};

/**
 * Apply emotional tilt to an action distribution.
 *
 * Per schema §1.7 rules: deltas sum to 0 (distribution is re-normalized, not inflated).
 * Deltas applied to baseline, clipped to [0, 1] per action, re-normalized if clipping occurred.
 *
 * Input distribution shape:
 *   { fold: p, call: p, raise: p } where p sums to 1.0.
 *
 * @param {Object} distribution - { fold: number, call: number, raise: number }
 * @param {Object} state - EmotionalState with fearIndex + greedIndex
 * @param {string} [villainStyle='Unknown']
 * @param {Object} [options]
 * @param {number} [options.scale=1.0] - conservative-ceiling scale factor for current predicate
 * @returns {Object} New distribution { fold, call, raise } summing to ~1.0
 */
export const applyEmotionalTilt = (distribution, state, villainStyle = 'Unknown', options = {}) => {
  const scale = options.scale ?? 1.0;
  const baseline = normalizeDistribution(distribution);
  if (!state || typeof state !== 'object') return baseline;

  const foldShift = fearFoldShift(state.fearIndex ?? 0, villainStyle, scale);
  const raiseShift = greedRaiseShift(state.greedIndex ?? 0, villainStyle, scale);

  // Both shifts pull from call. If combined demand exceeds call mass, proportionally reduce.
  const callAvailable = baseline.call ?? 0;
  const totalShift = foldShift + raiseShift;
  let actualFoldShift = foldShift;
  let actualRaiseShift = raiseShift;
  if (totalShift > callAvailable && totalShift > 0) {
    // Distribute the available call mass proportionally between fold and raise demands.
    const ratio = callAvailable / totalShift;
    actualFoldShift = foldShift * ratio;
    actualRaiseShift = raiseShift * ratio;
  }

  const result = {
    fold: (baseline.fold ?? 0) + actualFoldShift,
    call: callAvailable - (actualFoldShift + actualRaiseShift),
    raise: (baseline.raise ?? 0) + actualRaiseShift,
  };

  // Clip and renormalize for safety (should already sum to 1.0 if inputs were well-formed).
  return clampAndRenormalize(result);
};

/**
 * Normalize a distribution to sum to 1.0. Treats missing keys as 0.
 * Used to accept distributions with minor floating-point drift.
 */
const normalizeDistribution = (dist) => {
  const fold = Math.max(0, dist?.fold ?? 0);
  const call = Math.max(0, dist?.call ?? 0);
  const raise = Math.max(0, dist?.raise ?? 0);
  const sum = fold + call + raise;
  if (sum === 0) return { fold: 0, call: 0, raise: 0 };
  return { fold: fold / sum, call: call / sum, raise: raise / sum };
};

/**
 * Clamp each action probability to [0, 1], then renormalize to sum 1.0.
 */
const clampAndRenormalize = (dist) => {
  const fold = Math.max(0, Math.min(1, dist.fold));
  const call = Math.max(0, Math.min(1, dist.call));
  const raise = Math.max(0, Math.min(1, dist.raise));
  const sum = fold + call + raise;
  if (sum === 0) return { fold: 0, call: 0, raise: 0 };
  return { fold: fold / sum, call: call / sum, raise: raise / sum };
};

/**
 * Version-stamped transform config for persistence/calibration.
 * Exposed so the assumption engine can stamp `transform.version` in persisted operators.
 */
export const EMOTIONAL_TRANSFORM_CONFIG = Object.freeze({
  version: EMOTIONAL_TRANSFORM_VERSION,
  fearCoefficient: FEAR_COEFFICIENT,
  greedCoefficient: GREED_COEFFICIENT,
  fearFoldCap: FEAR_FOLD_CAP,
  greedRaiseCap: GREED_RAISE_CAP,
  styleMultipliers: STYLE_MULTIPLIERS,
});
