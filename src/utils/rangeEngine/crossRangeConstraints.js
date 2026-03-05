/**
 * crossRangeConstraints.js - Cross-action range normalization
 *
 * Normalizes non-fold actions within each independent decision tree:
 *   No raise faced:  limp + open        <= 1.0 per cell
 *   Facing a raise:  coldCall + threeBet <= 1.0 per cell
 *
 * Fold is NOT a range — it's the complement. We don't store or normalize
 * a fold grid because fold probability is derived from frequencies, not
 * from a 169-cell hand distribution.
 *
 * Open and threeBet are NOT competing — a hand like AA can be
 * 100% in "open" (first in) AND 100% in "threeBet" (facing raise).
 */

import { RANGE_POSITIONS } from './rangeProfile';
import { NO_RAISE_ACTIONS, FACED_RAISE_ACTIONS } from './populationPriors';

const GRID_SIZE = 169;

/**
 * Normalize one scenario's non-fold actions so they sum to at most 1.0 per cell.
 * @param {Object} ranges - ranges[action] = Float64Array(169)
 * @param {string[]} actions - scenario actions (includes 'fold' which we skip)
 */
const normalizeScenario = (ranges, actions) => {
  const nonFold = actions.filter(a => a !== 'fold');

  for (let i = 0; i < GRID_SIZE; i++) {
    let sum = 0;
    for (const action of nonFold) {
      sum += ranges[action][i];
    }

    if (sum > 1.0) {
      const scale = 1.0 / sum;
      for (const action of nonFold) {
        ranges[action][i] *= scale;
      }
    }

    // Clamp
    for (const action of nonFold) {
      ranges[action][i] = Math.max(0, Math.min(1.0, ranges[action][i]));
    }
  }
};

/**
 * Normalize all actions for a single position across both scenarios.
 * Only constrains non-fold actions within each scenario independently.
 * @param {Object} ranges - ranges[action] = Float64Array(169)
 */
export const normalizeAcrossActions = (ranges) => {
  normalizeScenario(ranges, NO_RAISE_ACTIONS);
  normalizeScenario(ranges, FACED_RAISE_ACTIONS);
};

/**
 * Normalize all positions in a profile's ranges.
 * @param {Object} ranges - { [position]: { [action]: Float64Array(169) } }
 */
export const normalizeAllPositions = (ranges) => {
  for (const pos of RANGE_POSITIONS) {
    if (ranges[pos]) {
      normalizeAcrossActions(ranges[pos]);
    }
  }
};
