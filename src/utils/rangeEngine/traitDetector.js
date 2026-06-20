/**
 * traitDetector.js - Detect behavioral traits from range profile data
 *
 * Three traits:
 * - trapsPreflop: Does the player slow-play premiums (limp with AA, cold-call with KK)?
 * - splitsRangePreflop: Does the player mix same hands across different action lines?
 * - positionallyAware: Do the player's frequencies differ significantly by position?
 */

import { RANGE_POSITIONS } from './rangeProfile';
import { decodeIndex } from '../pokerCore/rangeMatrix';
import { betaPosterior, betaCDF, betaQuantile } from '../pokerCore/betaMath';

const GRID_SIZE = 169;

// Open-rate (RFI) prior for the positional-awareness comparison: Beta(6, 24),
// mean 20%, pseudocount 30 — a deliberately firm prior that pulls EARLY and LATE
// rates toward a common 20% until real evidence accumulates. This is the Bayesian
// replacement for the old hard "n < 5 → bail" gate (FIND-011): small samples stay
// near the prior, so noise cannot manufacture a positional spread and a single
// extra open at n=5 cannot flip the verdict; only a sustained divergence over a
// real sample (~n≥20 per position) clears the >0.5 detection gate. The weight is
// heavier than rangeEngine's PRIOR_WEIGHT=10 single-rate convention on purpose —
// detecting a *difference* between two rates needs more regularization than
// estimating one rate, and concluding a player "adjusts by position" warrants a
// meaningful per-position sample.
const OPEN_RATE_PRIOR = { alpha: 6, beta: 24 };
// Trait fires when LP open rate exceeds EP open rate by this factor.
const POS_AWARE_FACTOR = 1.5;

/**
 * Posterior probability that one rate exceeds `factor`× another, given two
 * independent Beta posteriors. Computed by exact quadrature over the lower
 * posterior's equal-probability quantile bins — deterministic, and using exact
 * Beta tails (NO normal/z approximation, per the rangeEngine no-frequentist rule).
 *
 *   P(θ_hi > factor·θ_lo) = E_{e ~ postLo}[ 1 − F_hi(factor·e) ]
 *
 * @param {{alpha:number, beta:number}} postHi - higher-rate posterior
 * @param {{alpha:number, beta:number}} postLo - lower-rate posterior
 * @param {number} factor - multiple of the lower rate to exceed
 * @param {number} [bins=48] - quantile bins for the quadrature
 * @returns {number} posterior probability in [0, 1]
 */
const probRateExceedsFactor = (postHi, postLo, factor, bins = 48) => {
  let acc = 0;
  for (let i = 0; i < bins; i++) {
    const p = (i + 0.5) / bins; // bin midpoint in probability space
    const eLo = betaQuantile(p, postLo.alpha, postLo.beta);
    const threshold = Math.min(1, factor * eLo);
    acc += 1 - betaCDF(threshold, postHi.alpha, postHi.beta);
  }
  return acc / bins;
};

// Top 5% of hands by strength tier (pairs TT+, AKs, AKo, AQs)
const PREMIUM_INDICES = new Set();
const initPremiums = () => {
  if (PREMIUM_INDICES.size > 0) return;
  for (let i = 0; i < GRID_SIZE; i++) {
    const { rank1, rank2, isPair, suited } = decodeIndex(i);
    // Pairs TT+ (rank >= 8 means TT, JJ, QQ, KK, AA)
    if (isPair && rank1 >= 8) { PREMIUM_INDICES.add(i); continue; }
    // AK suited/offsuit (A=12, K=11)
    if (rank1 === 12 && rank2 === 11) { PREMIUM_INDICES.add(i); continue; }
    // AQ suited/offsuit (A=12, Q=10)
    if (rank1 === 12 && rank2 === 10) { PREMIUM_INDICES.add(i); continue; }
  }
};

/**
 * Detect whether the player traps with premiums preflop.
 * Evidence: showdown anchors with premium hands in passive action lines (limp/coldCall),
 * or observed limp-reraise sub-actions.
 *
 * @param {Object} profile - Range profile
 * @returns {{ posterior: number, observations: number, opportunities: number, confirmed: boolean }}
 */
const detectTrapsPreflop = (profile) => {
  initPremiums();

  let premiumPassiveCount = 0;
  let nonPremiumCount = 0;

  // Check showdown anchors for premiums in passive lines
  for (const anchor of (profile.showdownAnchors || [])) {
    const isPremium = PREMIUM_INDICES.has(anchor.handIndex);
    const isPassiveLine = anchor.action === 'limp' || anchor.action === 'coldCall';

    if (isPassiveLine && isPremium) {
      premiumPassiveCount++;
    } else if (isPassiveLine && !isPremium) {
      nonPremiumCount++;
    }
  }

  // Check for limp-reraise evidence
  let limpReraiseCount = 0;
  if (profile.subActionCounts) {
    for (const pos of RANGE_POSITIONS) {
      const counts = profile.subActionCounts[pos];
      if (counts) limpReraiseCount += counts.limpRaise;
    }
  }

  // Beta distribution posterior: Beta(successes + 0.5, failures + 2)
  // Higher alpha = more trapping evidence, higher beta = more non-trap evidence
  const alpha = premiumPassiveCount + limpReraiseCount + 0.5;
  const beta = nonPremiumCount + 2;
  const posterior = alpha / (alpha + beta);

  const observations = premiumPassiveCount + limpReraiseCount;
  const opportunities = observations + nonPremiumCount;
  const confirmed = observations >= 1 && posterior > 0.3;

  return { posterior, observations, opportunities, confirmed };
};

/**
 * Detect whether the player splits the same hand across different action lines.
 * Evidence: same handIndex appearing in multiple action lines in showdown anchors.
 *
 * @param {Object} profile - Range profile
 * @returns {{ posterior: number, evidence: Array<{ handIndex: number, actions: string[] }> }}
 */
const detectSplitsRangePreflop = (profile) => {
  const anchors = profile.showdownAnchors || [];
  if (anchors.length < 2) return { posterior: 0, evidence: [] };

  // Group anchors by handIndex
  const byHand = {};
  for (const anchor of anchors) {
    const key = anchor.handIndex;
    if (!byHand[key]) byHand[key] = new Set();
    byHand[key].add(anchor.action);
  }

  // Find hands that appear in multiple action lines
  const evidence = [];
  for (const [handIndex, actions] of Object.entries(byHand)) {
    if (actions.size >= 2) {
      evidence.push({ handIndex: Number(handIndex), actions: Array.from(actions) });
    }
  }

  // Posterior: ratio of split hands to total unique hands seen at showdown
  const totalUniqueHands = Object.keys(byHand).length;
  const posterior = totalUniqueHands > 0 ? evidence.length / totalUniqueHands : 0;

  return { posterior, evidence };
};

/**
 * Detect whether the player adjusts frequencies by position.
 * Compares early position open rate vs late position open rate.
 *
 * @param {Object} profile - Range profile
 * @returns {{ posterior: number, earlyOpenPct: number|null, lateOpenPct: number|null }}
 */
const detectPositionallyAware = (profile) => {
  const earlyOpp = profile.opportunities?.EARLY?.noRaiseFaced || 0;
  const lateOpp = profile.opportunities?.LATE?.noRaiseFaced || 0;

  // No-data guard: a rate comparison needs at least one opportunity in BOTH
  // positions (zero-denominator guard, NOT a min-sample gate). Small samples are
  // handled by the prior in probRateExceedsFactor, not excluded here.
  if (earlyOpp < 1 || lateOpp < 1) {
    return { posterior: 0, earlyOpenPct: null, lateOpenPct: null };
  }

  const earlyOpens = profile.actionCounts?.EARLY?.open || 0;
  const lateOpens = profile.actionCounts?.LATE?.open || 0;

  // Beta posteriors on each position's open rate, regularized by a common RFI
  // prior. posterior = P(LP open rate > 1.5× EP open rate) — a genuine Bayesian
  // probability that shrinks toward 0.5 (then below the >0.5 detection gate) when
  // the sample is too small to distinguish a real positional spread from noise.
  const earlyPost = betaPosterior(earlyOpens, earlyOpp, OPEN_RATE_PRIOR.alpha, OPEN_RATE_PRIOR.beta);
  const latePost = betaPosterior(lateOpens, lateOpp, OPEN_RATE_PRIOR.alpha, OPEN_RATE_PRIOR.beta);
  const posterior = probRateExceedsFactor(latePost, earlyPost, POS_AWARE_FACTOR);

  return {
    posterior,
    earlyOpenPct: Math.round((earlyOpens / earlyOpp) * 100),
    lateOpenPct: Math.round((lateOpens / lateOpp) * 100),
  };
};

/**
 * Detect all traits and return a trait bundle.
 * @param {Object} profile - Range profile
 * @returns {Object} Trait detection results
 */
export const detectTraits = (profile) => {
  return {
    trapsPreflop: detectTrapsPreflop(profile),
    splitsRangePreflop: detectSplitsRangePreflop(profile),
    positionallyAware: detectPositionallyAware(profile),
  };
};
