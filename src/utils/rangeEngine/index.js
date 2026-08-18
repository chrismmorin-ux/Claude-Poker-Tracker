/**
 * rangeEngine/index.js - Public API for Bayesian Range Engine
 *
 * Orchestrates the pipeline: extract actions → update profile → normalize.
 */

import { createEmptyProfile, RANGE_ACTIONS, RANGE_POSITIONS } from './rangeProfile.js';
import { extractAllActions } from './actionExtractor.js';
import { extractAllSubActions } from './subActionExtractor.js';
import { updateProfileFromActions, updateSubActionCounts } from './bayesianUpdater.js';
import { normalizeAllPositions } from './crossRangeConstraints.js';
import { rangeWidth } from '../pokerCore/rangeMatrix.js';
import {
  NO_RAISE_ACTIONS, FACED_RAISE_ACTIONS, FACED_3BET_ACTIONS,
} from './populationPriors.js';
import { PARENT_SUBCLASSES } from './lineTaxonomy.js';
import { detectTraits } from './traitDetector.js';
import { computeAllPips, computePipConfidence } from './pipCalculator.js';

/**
 * Build a complete range profile for a player from hand history.
 * @param {number|string} playerId
 * @param {Object[]} hands - All hand records
 * @param {string} userId
 * @returns {Object} Fully computed range profile
 */
export const buildRangeProfile = (playerId, hands, userId) => {
  const profile = createEmptyProfile(playerId, userId);
  const extractions = extractAllActions(playerId, hands);
  const subExtractions = extractAllSubActions(playerId, hands);

  updateProfileFromActions(profile, extractions);
  updateSubActionCounts(profile, subExtractions);
  normalizeAllPositions(profile.ranges);

  profile.traits = detectTraits(profile);
  profile.pips = computeAllPips(profile);
  profile.pipConfidence = computePipConfidence(profile);
  profile.handsProcessed = hands.length;
  profile.lastUpdatedAt = Date.now();

  return profile;
};

/**
 * Get a summary of range widths (% of hands) per position.
 * Split by scenario: noRaise (fold/limp/open) and facedRaise (fold/coldCall/threeBet).
 *
 * Also computes observed action frequencies from raw counts.
 *
 * @param {Object} profile - Range profile
 * @returns {{ [position]: { noRaise: {...}, facedRaise: {...}, hands: number } }}
 */
export const getRangeWidthSummary = (profile) => {
  const summary = {};
  for (const pos of RANGE_POSITIONS) {
    const opp = profile.opportunities[pos];

    // Range widths (from the 169-cell grids)
    // Fold is a complement, not a range — skip it
    const noRaise = {};
    for (const action of NO_RAISE_ACTIONS) {
      if (action === 'fold') continue;
      noRaise[action] = rangeWidth(profile.ranges[pos][action]);
    }

    const facedRaise = {};
    for (const action of FACED_RAISE_ACTIONS) {
      if (action === 'fold') continue;
      facedRaise[action] = rangeWidth(profile.ranges[pos][action]);
    }

    // WS-521: the third tree, reported alongside the two that existed.
    const faced3Bet = {};
    for (const action of FACED_3BET_ACTIONS) {
      if (action === 'fold') continue;
      faced3Bet[action] = rangeWidth(profile.ranges[pos][action]);
    }

    // Observed frequencies (from raw counts)
    // Fold is stored as one combined count — derive per-scenario
    const counts = profile.actionCounts[pos];
    const noRaiseTotal = opp.noRaiseFaced || 0;
    const facedRaiseTotal = opp.facedRaise || 0;
    const faced3BetTotal = opp.faced3Bet || 0;

    const faced3BetFoldCount = Math.max(
      0, faced3BetTotal - (counts.call4 || 0) - (counts.fourBet || 0)
    );

    const faced3BetFreqs = {};
    for (const action of FACED_3BET_ACTIONS) {
      if (faced3BetTotal === 0) { faced3BetFreqs[action] = null; continue; }
      const c = action === 'fold' ? faced3BetFoldCount : (counts[action] || 0);
      faced3BetFreqs[action] = Math.round((c / faced3BetTotal) * 100);
    }

    /**
     * The composition of the facing-3-bet tree, reported BESIDE its pooled rate.
     *
     * `faced3BetFreqs` above pools three conditioning sets that measure 42.97% /
     * 94.55% / 68.16% fold on corpus. The pooled number is therefore a statement
     * about this villain's MIX as much as their tendency, and quoting it without
     * the mix is the WS-371 error. It is kept — several callers want the marginal
     * — and the mix now travels with it so the reader can see what was averaged.
     */
    const faced3BetRoleMix = { ...(opp.faced3BetByRole || { opener: 0, cold: 0, passive: 0 }) };

    /**
     * Which scenario's opportunity count a parent's subclass percentages divide by.
     *
     * This was a two-way ternary (`parent === 'open' ? noRaiseTotal : facedRaiseTotal`),
     * which is correct for exactly two trees and silently wrong for three — every
     * `fourBet` subclass would have reported its share of the FACED-RAISE
     * denominator, a percentage of a population it was never part of.
     */
    const scenarioTotalForParent = {
      limp: noRaiseTotal,
      open: noRaiseTotal,
      coldCall: facedRaiseTotal,
      threeBet: facedRaiseTotal,
      call4: faced3BetTotal,
      fourBet: faced3BetTotal,
    };

    const noRaiseFoldCount = Math.max(0, noRaiseTotal - (counts.limp || 0) - (counts.open || 0));
    const facedRaiseFoldCount = Math.max(0, facedRaiseTotal - (counts.coldCall || 0) - (counts.threeBet || 0));

    const noRaiseFreqs = {};
    for (const action of NO_RAISE_ACTIONS) {
      if (noRaiseTotal === 0) { noRaiseFreqs[action] = null; continue; }
      const c = action === 'fold' ? noRaiseFoldCount : (counts[action] || 0);
      noRaiseFreqs[action] = Math.round((c / noRaiseTotal) * 100);
    }

    const facedRaiseFreqs = {};
    for (const action of FACED_RAISE_ACTIONS) {
      if (facedRaiseTotal === 0) { facedRaiseFreqs[action] = null; continue; }
      const c = action === 'fold' ? facedRaiseFoldCount : (counts[action] || 0);
      facedRaiseFreqs[action] = Math.round((c / facedRaiseTotal) * 100);
    }

    // Derived subclasses (POKER_THEORY §2.5). Reported alongside — never
    // instead of — the parents, so existing consumers are untouched.
    // `counts` is the observed backing evidence; surfaces should gate on it
    // rather than on posterior width, which never reaches 0 (prior mass).
    const subclasses = {};
    for (const [parent, subs] of Object.entries(PARENT_SUBCLASSES)) {
      const scenarioTotal = scenarioTotalForParent[parent] ?? 0;
      for (const sub of subs) {
        subclasses[sub] = {
          parent,
          width: rangeWidth(profile.ranges[pos][sub]),
          count: counts[sub] || 0,
          pct: scenarioTotal === 0 ? null : Math.round(((counts[sub] || 0) / scenarioTotal) * 100),
        };
      }
    }

    summary[pos] = {
      noRaise,
      facedRaise,
      faced3Bet,
      faced3BetRoleMix,
      noRaiseFreqs,
      facedRaiseFreqs,
      faced3BetFreqs,
      subclasses,
      noRaiseHands: noRaiseTotal,
      facedRaiseHands: facedRaiseTotal,
      faced3BetHands: faced3BetTotal,
      hands: opp.total,
    };
  }
  return summary;
};

/**
 * Get a summary of sub-action (limp follow-up) percentages per position.
 * @param {Object} profile - Range profile
 * @returns {{ [position]: { limpFoldPct: number|null, limpCallPct: number|null, limpRaisePct: number|null, totalLimpsFacedRaise: number } }}
 */
export const getSubActionSummary = (profile) => {
  if (!profile?.subActionCounts) return null;

  const summary = {};
  for (const pos of RANGE_POSITIONS) {
    const counts = profile.subActionCounts[pos];
    if (!counts) continue;

    // Total limps that faced a raise (excludes limpNoRaise)
    const totalFacedRaise = counts.limpFold + counts.limpCall + counts.limpRaise;

    if (totalFacedRaise === 0) {
      summary[pos] = {
        limpFoldPct: null,
        limpCallPct: null,
        limpRaisePct: null,
        limpFoldCount: 0,
        limpCallCount: 0,
        limpRaiseCount: 0,
        totalLimpsFacedRaise: 0,
        totalLimps: counts.limpFold + counts.limpCall + counts.limpRaise + counts.limpNoRaise,
      };
    } else {
      summary[pos] = {
        limpFoldPct: Math.round((counts.limpFold / totalFacedRaise) * 100),
        limpCallPct: Math.round((counts.limpCall / totalFacedRaise) * 100),
        limpRaisePct: Math.round((counts.limpRaise / totalFacedRaise) * 100),
        limpFoldCount: counts.limpFold,
        limpCallCount: counts.limpCall,
        limpRaiseCount: counts.limpRaise,
        totalLimpsFacedRaise: totalFacedRaise,
        totalLimps: totalFacedRaise + counts.limpNoRaise,
      };
    }
  }
  return summary;
};

// Re-exports for convenience
export { RANGE_ACTIONS, RANGE_PARENT_ACTIONS, RANGE_SUBCLASS_ACTIONS, RANGE_POSITIONS } from './rangeProfile.js';
export {
  derivePreflopDecisions,
  PARENT_ACTIONS,
  SUBCLASS_ACTIONS,
  SUBCLASS_PARENT,
  PARENT_SUBCLASSES,
} from './lineTaxonomy.js';
export { SUBCLASS_SPLIT, SUBCLASS_PRIOR_WEIGHT, NO_RAISE_SUBCLASSES, FACED_RAISE_SUBCLASSES } from './populationPriors.js';
export { extractPreflopDecisions } from './actionExtractor.js';
export { createEmptyProfile, serializeProfile, deserializeProfile, PROFILE_VERSION } from './rangeProfile.js';
export { extractPreflopAction, extractAllActions } from './actionExtractor.js';
export { updateProfileFromActions, applyShowdownAnchor, updateSubActionCounts } from './bayesianUpdater.js';
export { extractSubAction, extractAllSubActions } from './subActionExtractor.js';
export { detectTraits } from './traitDetector.js';
export { computePips, computeAllPips, computePipConfidence, formatPips, pipConfidenceLabel, classifyHand, HAND_CATEGORIES } from './pipCalculator.js';
export { normalizeAcrossActions, normalizeAllPositions } from './crossRangeConstraints.js';
export { getPopulationPrior, NO_RAISE_FREQUENCIES, FACED_RAISE_FREQUENCIES, PRIOR_WEIGHT } from './populationPriors.js';
export { NO_RAISE_ACTIONS, FACED_RAISE_ACTIONS } from './populationPriors.js';
