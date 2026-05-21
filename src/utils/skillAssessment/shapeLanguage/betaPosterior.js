/**
 * betaPosterior.js — Beta(α,β) math for Shape Language mastery.
 *
 * Pure math. No side effects. No IDB. No dispatch.
 *
 * Per `docs/design/contracts/shape-mastery.md` I-SM-7 — posterior bounds α≥1,
 * β≥1 are enforced as floors here (defense-in-depth with the reducer).
 *
 * The credible-interval helper delegates to `exploitEngine/bayesianConfidence.js`
 * `credibleInterval()` so the implementation is single-source. The wrapper
 * here adapts the posterior-shape API (`{alpha, beta}`) → the call-shape
 * (`k, n, priorAlpha, priorBeta`) used in `bayesianConfidence`.
 *
 * SLS Stream D — SPR-081 / WS-040.
 */

import { credibleInterval } from '../../exploitEngine/bayesianConfidence';

/**
 * Posterior bound floor per I-SM-7.
 */
export const POSTERIOR_FLOOR = 1;

/**
 * Update a Beta posterior with new observation counts.
 *
 * Per Bayesian convention: posterior_α = prior_α + successes,
 * posterior_β = prior_β + failures. Clamped to the I-SM-7 floor.
 *
 * @param {{alpha: number, beta: number}} posterior — Current posterior.
 * @param {{successes?: number, failures?: number}} observation — Observed
 *   counts. Defaults to zero for missing fields.
 * @returns {{alpha: number, beta: number}} Updated posterior.
 */
export const updateBetaPosterior = (posterior, observation = {}) => {
  if (!posterior || typeof posterior !== 'object') {
    return { alpha: POSTERIOR_FLOOR, beta: POSTERIOR_FLOOR };
  }
  const baseAlpha = typeof posterior.alpha === 'number' ? posterior.alpha : POSTERIOR_FLOOR;
  const baseBeta = typeof posterior.beta === 'number' ? posterior.beta : POSTERIOR_FLOOR;
  const successes = typeof observation.successes === 'number' ? observation.successes : 0;
  const failures = typeof observation.failures === 'number' ? observation.failures : 0;
  return {
    alpha: Math.max(POSTERIOR_FLOOR, baseAlpha + successes),
    beta: Math.max(POSTERIOR_FLOOR, baseBeta + failures),
  };
};

/**
 * Beta credible interval for a posterior {alpha, beta}.
 *
 * Returns `{lower, upper, mean, level}` per the canonical
 * `bayesianConfidence.credibleInterval()` shape. Delegates to that
 * implementation to avoid a duplicate Beta CDF + quantile routine.
 *
 * @param {number} alpha — Posterior α (≥1).
 * @param {number} beta — Posterior β (≥1).
 * @param {number} [level=0.95] — Credible-interval level.
 * @returns {{lower: number, upper: number, mean: number, level: number}}
 */
export const betaCredibleInterval = (alpha, beta, level = 0.95) => {
  const safeAlpha = Math.max(POSTERIOR_FLOOR, typeof alpha === 'number' ? alpha : POSTERIOR_FLOOR);
  const safeBeta = Math.max(POSTERIOR_FLOOR, typeof beta === 'number' ? beta : POSTERIOR_FLOOR);
  // credibleInterval(k, n, priorAlpha, priorBeta) treats `k` and `n` as new
  // observations and `priorAlpha + k` / `priorBeta + (n-k)` as the posterior.
  // We already have the posterior, so we pass k=0, n=0 and use alpha/beta as
  // the prior parameters — the function returns the interval of the
  // distribution they parameterize.
  return credibleInterval(0, 0, safeAlpha, safeBeta, level);
};

/**
 * Mean of a Beta(α, β) distribution. Trivial helper for renderers that
 * want the point estimate alongside the interval.
 */
export const betaMean = (alpha, beta) => {
  const safeAlpha = Math.max(POSTERIOR_FLOOR, typeof alpha === 'number' ? alpha : POSTERIOR_FLOOR);
  const safeBeta = Math.max(POSTERIOR_FLOOR, typeof beta === 'number' ? beta : POSTERIOR_FLOOR);
  return safeAlpha / (safeAlpha + safeBeta);
};
