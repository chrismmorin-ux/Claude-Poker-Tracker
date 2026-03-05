/**
 * traitDetector.js - Detect behavioral traits from range profile data
 *
 * Three traits:
 * - trapsPreflop: Does the player slow-play premiums (limp with AA, cold-call with KK)?
 * - splitsRangePreflop: Does the player mix same hands across different action lines?
 * - positionallyAware: Do the player's frequencies differ significantly by position?
 */

import { RANGE_POSITIONS } from './rangeProfile';
import { decodeIndex } from '../exploitEngine/rangeMatrix';

const GRID_SIZE = 169;

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
    // AQ suited (A=12, Q=10)
    if (rank1 === 12 && rank2 === 10 && suited) { PREMIUM_INDICES.add(i); continue; }
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

  if (earlyOpp < 5 || lateOpp < 5) {
    return { posterior: 0, earlyOpenPct: null, lateOpenPct: null };
  }

  const earlyOpens = profile.actionCounts?.EARLY?.open || 0;
  const lateOpens = profile.actionCounts?.LATE?.open || 0;

  const earlyOpenPct = Math.round((earlyOpens / earlyOpp) * 100);
  const lateOpenPct = Math.round((lateOpens / lateOpp) * 100);

  // If LP open rate > 1.5x EP open rate, player is positionally aware
  let posterior = 0;
  if (earlyOpenPct > 0 && lateOpenPct > earlyOpenPct * 1.5) {
    posterior = Math.min(1.0, (lateOpenPct / earlyOpenPct - 1) * 0.5);
  } else if (earlyOpenPct === 0 && lateOpenPct > 0) {
    posterior = 0.7;
  }

  return { posterior, earlyOpenPct, lateOpenPct };
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
