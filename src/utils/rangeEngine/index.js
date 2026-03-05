/**
 * rangeEngine/index.js - Public API for Bayesian Range Engine
 *
 * Orchestrates the pipeline: extract actions → update profile → normalize.
 */

import { createEmptyProfile, RANGE_ACTIONS, RANGE_POSITIONS } from './rangeProfile';
import { extractAllActions } from './actionExtractor';
import { extractAllSubActions } from './subActionExtractor';
import { updateProfileFromActions, updateSubActionCounts } from './bayesianUpdater';
import { normalizeAllPositions } from './crossRangeConstraints';
import { rangeWidth } from '../exploitEngine/rangeMatrix';
import { NO_RAISE_ACTIONS, FACED_RAISE_ACTIONS } from './populationPriors';
import { detectTraits } from './traitDetector';
import { computeAllPips } from './pipCalculator';

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

    // Observed frequencies (from raw counts)
    // Fold is stored as one combined count — derive per-scenario
    const counts = profile.actionCounts[pos];
    const noRaiseTotal = opp.noRaiseFaced || 0;
    const facedRaiseTotal = opp.facedRaise || 0;

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

    summary[pos] = {
      noRaise,
      facedRaise,
      noRaiseFreqs,
      facedRaiseFreqs,
      noRaiseHands: noRaiseTotal,
      facedRaiseHands: facedRaiseTotal,
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
export { RANGE_ACTIONS, RANGE_POSITIONS } from './rangeProfile';
export { createEmptyProfile, serializeProfile, deserializeProfile, PROFILE_VERSION } from './rangeProfile';
export { extractPreflopAction, extractAllActions } from './actionExtractor';
export { updateProfileFromActions, applyShowdownAnchor, updateSubActionCounts } from './bayesianUpdater';
export { extractSubAction, extractAllSubActions } from './subActionExtractor';
export { detectTraits } from './traitDetector';
export { computePips, computeAllPips, formatPips, classifyHand } from './pipCalculator';
export { normalizeAcrossActions, normalizeAllPositions } from './crossRangeConstraints';
export { getPopulationPrior, NO_RAISE_FREQUENCIES, FACED_RAISE_FREQUENCIES, PRIOR_WEIGHT } from './populationPriors';
export { NO_RAISE_ACTIONS, FACED_RAISE_ACTIONS } from './populationPriors';
