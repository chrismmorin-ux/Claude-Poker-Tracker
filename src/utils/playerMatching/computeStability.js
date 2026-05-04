/**
 * @file computeStability.js — Bayesian-Beta posterior over historical sightings
 * for a given player + attribute. Returns a stability descriptor that the
 * recognition-search ranking uses to scale per-attribute weights.
 *
 * Per `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`
 * §PIO-G3-STAB (line 470).
 *
 * Confidence label thresholds (per audit):
 *   - posterior >= 0.85 → 'always'      (high confidence the attribute persists)
 *   - 0.40 <= p < 0.85  → 'sometimes'   (moderate confidence; varies)
 *   - posterior <  0.40 → 'today-only'  (low confidence; observed once or rarely)
 *
 * The MoE (margin of error) is the half-width of the Wilson 95% credible
 * interval, narrowing as N grows. The recognition-search ranking uses MoE
 * to soften weights when N is small (avoid premature confidence on first
 * sighting).
 *
 * SPR-034 / WS-160 (2026-05-04).
 */

import { SIGHTING_FEATURE_PRIORS } from './SIGHTING_FEATURE_PRIORS.js';

/**
 * @typedef {Object} StabilityResult
 * @property {number} posterior - Beta posterior mean in [0, 1]
 * @property {'always' | 'sometimes' | 'today-only'} confidence - banded label
 * @property {number} moe - Wilson 95% half-width margin of error in [0, 1]
 * @property {number} sampleSize - count of sightings considered
 */

/**
 * Get the prior for an attribute. Falls back to uniform (alpha=1, beta=1)
 * when the attribute has no entry in SIGHTING_FEATURE_PRIORS.
 *
 * @param {string} attribute
 * @returns {{alpha: number, beta: number}}
 */
const getPrior = (attribute) => {
  const prior = SIGHTING_FEATURE_PRIORS[attribute];
  if (prior && typeof prior.alpha === 'number' && typeof prior.beta === 'number') {
    return { alpha: prior.alpha, beta: prior.beta };
  }
  return { alpha: 1, beta: 1 }; // uniform fallback
};

/**
 * Determine whether two sighting values for the same attribute "match" (i.e.,
 * count toward the stable observation count). v1 uses strict equality for
 * scalars and JSON-stringified comparison for arrays/objects (e.g., wardrobe
 * is an array of palette IDs — same set in same order = match).
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
const valuesMatch = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (_) {
      return false;
    }
  }
  return false;
};

/**
 * Compute Wilson-score 95% credible-interval half-width for a Beta posterior.
 * Uses the standard normal approximation with continuity correction omitted
 * (good enough for stability-band UI; not for hard inference).
 *
 * @param {number} alpha - posterior alpha (prior + matches)
 * @param {number} beta - posterior beta (prior + non-matches)
 * @returns {number} - half-width MoE in [0, 1]
 */
const computeMoE = (alpha, beta) => {
  const n = alpha + beta;
  if (n <= 0) return 1;
  const p = alpha / n;
  const z = 1.96;
  const variance = (p * (1 - p)) / n;
  return z * Math.sqrt(variance);
};

/**
 * Band a posterior into a confidence label per audit §PIO-G3-STAB.
 *
 * @param {number} posterior
 * @returns {'always' | 'sometimes' | 'today-only'}
 */
const bandConfidence = (posterior) => {
  if (posterior >= 0.85) return 'always';
  if (posterior >= 0.40) return 'sometimes';
  return 'today-only';
};

/**
 * Compute the stability descriptor for a player's attribute, given their
 * historical sightings.
 *
 * The stability "match" is determined by comparing each sighting's attribute
 * value against the **most recent** sighting's value. Match → contributes to
 * alpha (stable); no-match → contributes to beta (varying). This is the
 * convention from PIO-G3-STAB.
 *
 * Edge cases:
 *   - Empty sightings: returns posterior = prior.alpha / (prior.alpha + prior.beta),
 *     confidence banded from that posterior, MoE = 1.0 (max uncertainty).
 *   - Single sighting: posterior reflects 1 match (alpha = prior.alpha + 1).
 *     Banded as 'today-only' unless prior heavily favors stability.
 *   - All-same observations: posterior approaches 1; banded 'always' once
 *     sample size > prior weight.
 *
 * @param {Array<object>} sightings - records from sightingLogsStore (full attribute snapshot)
 * @param {string} attribute - attribute key to evaluate (e.g., 'ageDecade', 'wardrobe')
 * @returns {StabilityResult}
 */
export const computeStability = (sightings, attribute) => {
  if (!Array.isArray(sightings) || typeof attribute !== 'string') {
    throw new Error('computeStability requires (Array sightings, string attribute)');
  }

  const prior = getPrior(attribute);

  // Cold start: no sightings → return prior-only posterior with max uncertainty.
  if (sightings.length === 0) {
    const posterior = prior.alpha / (prior.alpha + prior.beta);
    return {
      posterior,
      confidence: bandConfidence(posterior),
      moe: 1.0,
      sampleSize: 0,
    };
  }

  // Order most-recent first so we can pick the reference value as "now."
  const sorted = [...sightings].sort((a, b) => (b.capturedAt || 0) - (a.capturedAt || 0));
  const referenceValue = sorted[0]?.attributes?.[attribute];

  // referenceValue undefined → attribute never observed in any sighting.
  if (referenceValue === undefined) {
    const posterior = prior.alpha / (prior.alpha + prior.beta);
    return {
      posterior,
      confidence: bandConfidence(posterior),
      moe: 1.0,
      sampleSize: 0,
    };
  }

  let matches = 0;
  let nonMatches = 0;
  for (const s of sorted) {
    const v = s?.attributes?.[attribute];
    if (v === undefined) continue;
    if (valuesMatch(v, referenceValue)) matches += 1;
    else nonMatches += 1;
  }

  const alpha = prior.alpha + matches;
  const beta = prior.beta + nonMatches;
  const posterior = alpha / (alpha + beta);
  const moe = computeMoE(alpha, beta);

  return {
    posterior,
    confidence: bandConfidence(posterior),
    moe,
    sampleSize: matches + nonMatches,
  };
};
