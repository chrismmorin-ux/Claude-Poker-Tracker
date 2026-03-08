/**
 * bayesianUpdater.js - Bayesian range weight updates
 *
 * Takes a profile + extracted actions and updates the range grids
 * using population priors as a Bayesian starting point.
 *
 * KEY DESIGN: Updates are split by scenario (facedRaise vs noRaiseFaced).
 * Open and threeBet are NOT competing — they occur in different game states.
 * A hand like AA can be 100% in both "open" and "threeBet" ranges.
 */

import {
  getPopulationPrior,
  NO_RAISE_FREQUENCIES,
  FACED_RAISE_FREQUENCIES,
  NO_RAISE_ACTIONS,
  FACED_RAISE_ACTIONS,
  PRIOR_WEIGHT,
} from './populationPriors';
import { RANGE_ACTIONS, RANGE_POSITIONS } from './rangeProfile';
import { decodeIndex, rangeIndex } from '../exploitEngine/rangeMatrix';

const GRID_SIZE = 169;

/**
 * Update a profile's action counts and range weights from extracted actions.
 * @param {Object} profile - Range profile (mutated)
 * @param {Array} extractions - Output of extractAllActions
 * @returns {Object} The updated profile
 */
export const updateProfileFromActions = (profile, extractions) => {
  // 1. Count actions per position, split by scenario
  for (const ext of extractions) {
    const { position, rangeAction } = ext;
    if (!profile.actionCounts[position] || !RANGE_ACTIONS.includes(rangeAction)) continue;

    profile.actionCounts[position][rangeAction]++;
    profile.opportunities[position].total++;

    if (ext.facedRaise) {
      profile.opportunities[position].facedRaise++;
    } else {
      profile.opportunities[position].noRaiseFaced++;
    }
  }

  // 2. Update ranges per position, per scenario
  for (const pos of RANGE_POSITIONS) {
    const counts = profile.actionCounts[pos];
    const opp = profile.opportunities[pos];

    // --- No-raise scenario: fold / limp / open ---
    updateScenarioRanges(
      profile.ranges[pos],
      counts,
      NO_RAISE_ACTIONS,
      NO_RAISE_FREQUENCIES[pos],
      opp.noRaiseFaced,
      pos
    );

    // --- Faced-raise scenario: fold / coldCall / threeBet ---
    updateScenarioRanges(
      profile.ranges[pos],
      counts,
      FACED_RAISE_ACTIONS,
      FACED_RAISE_FREQUENCIES[pos],
      opp.facedRaise,
      pos
    );
  }

  // 3. Apply showdown anchors and count showdowns
  for (const ext of extractions) {
    if (ext.showdownIndex !== null) {
      applyShowdownAnchor(profile, ext.position, ext.rangeAction, ext.showdownIndex, ext.showdownOutcome);
      profile.opportunities[ext.position].showdownsSeen++;
    }
  }

  return profile;
};

/**
 * Update range weights for one scenario (noRaise or facedRaise).
 * Each scenario's actions are independent and sum to 1.0 within that scenario.
 *
 * @param {Object} ranges - ranges[action] = Float64Array(169) for this position
 * @param {Object} counts - actionCounts for this position
 * @param {string[]} actions - the actions in this scenario (e.g. ['fold','limp','open'])
 * @param {Object} popFreqs - population frequencies for this scenario
 * @param {number} totalObserved - total observations in this scenario
 * @param {string} pos - position key
 */
const updateScenarioRanges = (ranges, counts, actions, popFreqs, totalObserved, pos) => {
  // Derive scenario-specific fold count.
  // Fold is stored as one combined count, but we need it per scenario.
  // fold_in_scenario = totalObserved - sum(non_fold_actions_in_scenario)
  const nonFoldActions = actions.filter(a => a !== 'fold');
  const nonFoldTotal = nonFoldActions.reduce((sum, a) => sum + (counts[a] || 0), 0);
  const scenarioFoldCount = Math.max(0, totalObserved - nonFoldTotal);

  for (const action of actions) {
    const populationFreq = popFreqs[action];
    if (populationFreq === undefined) continue;

    const prior = getPopulationPrior(pos, action);
    const observedCount = action === 'fold' ? scenarioFoldCount : (counts[action] || 0);

    // Bayesian effective frequency
    const effectiveFreq = (PRIOR_WEIGHT * populationFreq + observedCount) /
                          (PRIOR_WEIGHT + totalObserved);

    // Scale prior range by frequency ratio
    const ratio = populationFreq > 0 ? effectiveFreq / populationFreq : effectiveFreq;

    for (let i = 0; i < GRID_SIZE; i++) {
      ranges[action][i] = Math.min(1.0, prior[i] * ratio);
    }
  }
};

/**
 * Apply a showdown anchor — a confirmed hand in a known action range.
 * Sets that hand to weight 1.0 and boosts hands with shared ranks.
 *
 * If we see AKs opened, boost: AKo (same ranks, different suitedness),
 * other Ax suited, other Kx suited (same high/low card combos).
 * Does NOT boost arbitrary grid neighbors — only semantically related hands.
 *
 * @param {Object} profile - Range profile (mutated)
 * @param {string} position
 * @param {string} action
 * @param {number} handGridIndex - 0-168 grid index
 * @param {string|null} outcome - 'won', 'lost', or null (backward compat)
 */
export const applyShowdownAnchor = (profile, position, action, handGridIndex, outcome = null) => {
  if (!profile.ranges[position] || !profile.ranges[position][action]) return;

  const range = profile.ranges[position][action];
  const { rank1, rank2, suited, isPair } = decodeIndex(handGridIndex);

  // Outcome-aware boost levels
  const altSuitBoost = outcome === 'won' ? 0.30 : outcome === 'lost' ? 0.15 : 0.25;
  const adjPairBoost = outcome === 'won' ? 0.25 : outcome === 'lost' ? 0.10 : 0.20;
  const adjKickerBoost = outcome === 'won' ? 0.20 : outcome === 'lost' ? 0.08 : 0.15;

  // Set confirmed hand to weight 1.0
  range[handGridIndex] = 1.0;

  // Boost the other suitedness variant (AKs seen → boost AKo, and vice versa)
  if (!isPair) {
    const altIdx = rangeIndex(rank1, rank2, !suited);
    range[altIdx] = Math.min(1.0, range[altIdx] + altSuitBoost);
  }

  // Boost adjacent pairs (if we see TT, boost 99 and JJ)
  if (isPair) {
    if (rank1 > 0) {
      const lowerPair = rangeIndex(rank1 - 1, rank1 - 1, false);
      range[lowerPair] = Math.min(1.0, range[lowerPair] + adjPairBoost);
    }
    if (rank1 < 12) {
      const higherPair = rangeIndex(rank1 + 1, rank1 + 1, false);
      range[higherPair] = Math.min(1.0, range[higherPair] + adjPairBoost);
    }
  } else {
    // Boost same high card with adjacent kickers (AKs → AQs, AJs get small boost)
    for (let delta = -1; delta <= 1; delta += 2) {
      const adjKicker = rank2 + delta;
      if (adjKicker >= 0 && adjKicker < rank1) {
        const adjIdx = rangeIndex(rank1, adjKicker, suited);
        range[adjIdx] = Math.min(1.0, range[adjIdx] + adjKickerBoost);
      }
    }
  }

  // Record the anchor
  profile.showdownAnchors.push({
    position,
    action,
    handIndex: handGridIndex,
    outcome,
  });
};

/**
 * Update sub-action counts (limp follow-up actions) from extracted sub-actions.
 * @param {Object} profile - Range profile (mutated)
 * @param {Array} subExtractions - Output of extractAllSubActions
 * @returns {Object} The updated profile
 */
export const updateSubActionCounts = (profile, subExtractions) => {
  for (const ext of subExtractions) {
    const { position, subAction } = ext;
    if (profile.subActionCounts[position] && profile.subActionCounts[position][subAction] !== undefined) {
      profile.subActionCounts[position][subAction]++;
    }
  }
  return profile;
};
