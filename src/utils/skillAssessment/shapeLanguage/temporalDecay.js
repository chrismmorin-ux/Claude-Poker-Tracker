/**
 * temporalDecay.js — Recognition-latency decay for Shape Language posteriors.
 *
 * Pure math. Read-time only. No writes per I-SM-2.
 *
 * Per `docs/projects/poker-shape-language/gate3-decision-memo.md` Q3-B verdict:
 * decay is gentle (not FSRS-aggressive), passive (no notifications), and
 * computed at read time. The procedural-vs-declarative finding (chess pattern
 * recognition ≈ bike-riding) supports a long baseline interval.
 *
 * Decay model (v1, conservative):
 *   - Pseudo-evidence (α + β - 2) decays geometrically with half-life
 *     `profile.halfLifeDays` (default 90 days = ~3 months for procedural
 *     memory).
 *   - The *ratio of decayed evidence* (α-1 : β-1) is preserved as the
 *     central tendency is regressed toward the uniform prior Beta(1,1).
 *     This is Bayesian-coherent: loss of evidence pulls the posterior
 *     back toward the prior, growing uncertainty AND regressing the
 *     point estimate toward 0.5.
 *
 * This is intentionally simple — a sophisticated FSRS-style model is
 * out of scope per Q3 verdict + procedural-memory finding. The shape of
 * the decay curve can be amended in a future ticket if calibration
 * evidence justifies (PMC Phase 5+ feeds this signal).
 *
 * SLS Stream D — SPR-081 / WS-040.
 */

import { POSTERIOR_FLOOR } from './betaPosterior';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Default decay profile per Q3-B verdict (gentle / procedural-memory model).
 */
export const DEFAULT_DECAY_PROFILE = Object.freeze({
  halfLifeDays: 90,
  // Floor on retained pseudo-evidence beyond α+β-2 = 0 (the I-SM-7 floor
  // implies α≥1, β≥1; "pseudo-evidence" = (α-1) + (β-1)).
  minimumPseudoEvidence: 0,
});

/**
 * Compute days between two ms-epoch timestamps. Returns null if either is
 * missing.
 */
const daysBetween = (then, now) => {
  if (typeof then !== 'number' || typeof now !== 'number') return null;
  if (now < then) return 0; // clock skew safety — don't return negative days
  return (now - then) / MS_PER_DAY;
};

/**
 * Apply temporal decay to a Beta posterior.
 *
 * Strategy:
 *   1. Compute pseudo-evidence = (α-1) + (β-1) (i.e., observations beyond uniform prior).
 *   2. Decay pseudo-evidence by 0.5^(daysSinceValidated / halfLifeDays).
 *   3. Preserve mean ratio = α / (α+β).
 *   4. Rebuild α, β from decayed pseudo-evidence + preserved mean.
 *   5. Clamp both to the I-SM-7 floor.
 *
 * Regression toward prior rationale: decay represents loss of evidence.
 * A user who was "85% on Silhouette" 6 months ago, with no validation
 * since, is not necessarily 85% now — the data is stale enough that the
 * posterior should pull back toward the uninformed prior (0.5). The
 * faster the decay (or longer the gap), the more the point estimate
 * regresses to 0.5 AND the wider the credible interval.
 *
 * @param {{alpha: number, beta: number}} posterior — Current posterior.
 * @param {number|null} lastValidatedAt — Ms epoch of the last drill. Null
 *   = never validated (no decay).
 * @param {number} [now=Date.now()] — Override-able for testing.
 * @param {Object} [profile=DEFAULT_DECAY_PROFILE]
 * @returns {{
 *   decayedAlpha: number,
 *   decayedBeta: number,
 *   daysSinceValidated: number | null,
 *   retainedEvidenceFraction: number,
 * }}
 */
export const applyTemporalDecay = (
  posterior,
  lastValidatedAt,
  now = Date.now(),
  profile = DEFAULT_DECAY_PROFILE,
) => {
  const alpha = Math.max(POSTERIOR_FLOOR, posterior?.alpha ?? POSTERIOR_FLOOR);
  const beta = Math.max(POSTERIOR_FLOOR, posterior?.beta ?? POSTERIOR_FLOOR);

  const daysSinceValidated = daysBetween(lastValidatedAt, now);

  // If never validated, no decay applies (uniform prior stays uniform).
  if (daysSinceValidated === null) {
    return {
      decayedAlpha: alpha,
      decayedBeta: beta,
      daysSinceValidated: null,
      retainedEvidenceFraction: 1,
    };
  }

  const halfLifeDays = profile?.halfLifeDays ?? DEFAULT_DECAY_PROFILE.halfLifeDays;
  const retainedEvidenceFraction = Math.pow(0.5, daysSinceValidated / halfLifeDays);

  const pseudoEvidence = (alpha - 1) + (beta - 1);
  const decayedPseudoEvidence = Math.max(
    profile?.minimumPseudoEvidence ?? 0,
    pseudoEvidence * retainedEvidenceFraction,
  );

  // Preserve the mean ratio. If pseudoEvidence is 0 (uniform Beta(1,1)),
  // the mean is 0.5; retain that.
  const meanShare = pseudoEvidence > 0 ? (alpha - 1) / pseudoEvidence : 0.5;

  const decayedAlpha = Math.max(POSTERIOR_FLOOR, 1 + decayedPseudoEvidence * meanShare);
  const decayedBeta = Math.max(POSTERIOR_FLOOR, 1 + decayedPseudoEvidence * (1 - meanShare));

  return {
    decayedAlpha,
    decayedBeta,
    daysSinceValidated,
    retainedEvidenceFraction,
  };
};
