/**
 * dialMath.js — Dial curve + blend formula per schema v1.1 §4.1 and §6.1
 *
 * Part of the citedDecision module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Two-level commitment structure:
 *   - Per-assumption dial (`operator.currentDial`) — how committed to THIS claim.
 *     Curve lives in assumptionEngine/operator.js; re-exported here for consumer
 *     convenience.
 *   - Overall blend (`mutation.blend`) — how committed to the mutated model as a whole.
 *     Formula defined below per schema §4.1.
 *
 * Blend formula (schema §4.1):
 *   blend = clamp(
 *     0.5 +
 *     0.15 × normalize(Σ quality × recognizability × (1 − counterExploitFragility)) +
 *     0.10 × varianceBudgetFactor +
 *     0.05 × stakeContextFactor,
 *     0, 1
 *   )
 *
 * Free parameters documented as calibration targets per theory-roundtable.md Stage 7:
 *   - 0.5 baseline
 *   - 0.15 quality-bundle weight
 *   - 0.10 variance weight
 *   - 0.05 stake-context weight
 *
 * Pure module — imports only from assumptionEngine/operator (consumer-direction OK).
 */

export { computeDialFromQuality } from '../assumptionEngine/operator';

// ───────────────────────────────────────────────────────────────────────────
// Blend formula (schema §4.1)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Compute the overall blend coefficient from applied assumptions + context.
 *
 * @param {Array} appliedAssumptions - VillainAssumption[]. Only the actionable
 *   subset should be passed (caller filters).
 * @param {Object} [context={}]
 * @param {number} [context.varianceBudget=0]   — [-1, +1] hero risk appetite; negative when in drawdown / variance-averse
 * @param {'cash' | 'tournament' | 'high-stakes'} [context.stakeContext='cash']
 * @returns {number} Blend in [0, 1]
 */
export const computeBlend = (appliedAssumptions, context = {}) => {
  const varianceBudgetFactor = clamp(context.varianceBudget ?? 0, -1, 1);
  const stakeContextFactor = stakeFactor(context.stakeContext);

  if (!Array.isArray(appliedAssumptions) || appliedAssumptions.length === 0) {
    // No assumptions → blend is baseline (0.5) modulo context adjustments only.
    // This means the "mutated model" and the baseline coincide — no divergence.
    return clamp(0.5 + 0.10 * varianceBudgetFactor + 0.05 * stakeContextFactor, 0, 1);
  }

  // Σ quality × recognizability × (1 − counterExploitFragility)
  // counterExploitFragility = 1 − resistanceScore
  let rawStrength = 0;
  for (const a of appliedAssumptions) {
    const quality = a.quality?.composite ?? 0;
    const recog = a.recognizability?.score ?? 0;
    const resistance = a.counterExploit?.resistanceScore ?? 0;
    const fragility = 1 - resistance;
    rawStrength += quality * recog * (1 - fragility);
  }

  // Normalize by count — turns sum into mean, giving us a [0, 1]-ish value per-bundle
  const normalized = normalizeStrength(rawStrength, appliedAssumptions.length);

  return clamp(
    0.5
    + 0.15 * (normalized * 2 - 1) // map normalized [0,1] into [-1, +1] to shift either way
    + 0.10 * varianceBudgetFactor
    + 0.05 * stakeContextFactor,
    0,
    1,
  );
};

/**
 * Normalize the raw strength sum to [0, 1] using a mean-based approach.
 * Each assumption's max-possible contribution is 1.0 (quality=1, recog=1, resistance=1),
 * so the theoretical max for N assumptions is N. Normalization = sum / N.
 */
const normalizeStrength = (rawSum, count) => {
  if (count <= 0) return 0;
  return clamp(rawSum / count, 0, 1);
};

/**
 * Stake-context factor maps stake category to [-1, +1].
 * Higher stakes → negative factor (pulls blend down toward balanced);
 * cash → neutral; tournament → slightly negative (ICM considerations).
 */
const stakeFactor = (ctx) => {
  switch (ctx) {
    case 'high-stakes': return -0.8;
    case 'tournament': return -0.2;
    case 'cash':
    default: return 0;
  }
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));

// ───────────────────────────────────────────────────────────────────────────
// Honesty-check helper
// ───────────────────────────────────────────────────────────────────────────

/**
 * Zero-blend indicator — true when all applied assumptions' dials are 0 OR
 * the overall blend is 0 (or negligibly small). Used by producer to short-circuit
 * to baseline recommendation (I-AE-3 honesty check).
 *
 * @param {Array} appliedAssumptions - VillainAssumption[]
 * @param {number} blend
 * @returns {boolean}
 */
export const isZeroBlend = (appliedAssumptions, blend) => {
  if (blend !== undefined && Math.abs(blend) < 0.001) return true;
  if (!Array.isArray(appliedAssumptions) || appliedAssumptions.length === 0) return true;
  return appliedAssumptions.every((a) => (a.operator?.currentDial ?? 0) < 0.001);
};
