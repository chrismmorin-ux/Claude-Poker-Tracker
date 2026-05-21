/**
 * wilsonCI.js — Wilson 95% CI for a binomial proportion.
 *
 * Extracted from skillAssessment/heroDecisionAccumulator.js. The original
 * defaulted `z = 1.96`; this canonical version reads Z_95 from
 * betaPosterior so all decision systems converge on a single z constant.
 *
 * Wilson interval is the right choice for binomial proportions at the
 * sample sizes SCF uses (n=30..200): it has better coverage than normal-
 * approximation Wald intervals near p=0 or p=1, and remains valid at
 * the n≥30 floor enforced by AP-SCF-04.
 *
 * Pure module — no IO, no side effects.
 *
 * Future consumers: any rule-anchored leak detector or post-hand audit
 * that reports a binomial rate with credible interval. Today: only
 * skillAssessment/heroDecisionAccumulator.js.
 */

import { Z_95 } from './betaPosterior';

/**
 * Wilson score interval for a binomial proportion.
 *
 * Returns `{ lower, upper, mean }` to match the existing
 * `skillAssessment/heroDecisionAccumulator.wilsonCI` shape — callers can
 * substitute the import without touching consumer code.
 *
 * Edge cases:
 *   - trials = 0 → `{ lower: 0, upper: 0, mean: 0 }` (no data, no interval).
 *   - successes < 0 or successes > trials → clamped (defense in depth).
 *
 * @param {number} successes - Count of successes; clamped to [0, trials].
 * @param {number} trials - Sample size.
 * @param {number} [z=Z_95] - z-score for the desired confidence level.
 * @returns {{lower: number, upper: number, mean: number}}
 */
export const wilsonInterval = (successes, trials, z = Z_95) => {
  if (!Number.isFinite(trials) || trials <= 0) {
    return { lower: 0, upper: 0, mean: 0 };
  }
  const k = Math.min(Math.max(successes, 0), trials);
  const phat = k / trials;
  const denom = 1 + (z * z) / trials;
  const center = (phat + (z * z) / (2 * trials)) / denom;
  const halfWidth = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * trials)) / trials)) / denom;
  return {
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
    mean: phat,
  };
};
