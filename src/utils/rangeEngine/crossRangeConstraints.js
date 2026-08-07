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

import { RANGE_POSITIONS } from './rangeProfile.js';
import { clamp } from '../mathUtils.js';
import {
  NO_RAISE_ACTIONS,
  FACED_RAISE_ACTIONS,
  NO_RAISE_SUBCLASSES,
  FACED_RAISE_SUBCLASSES,
} from './populationPriors.js';

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
      ranges[action][i] = clamp(ranges[action][i], 0, 1.0);
    }
  }
};

/**
 * Constrain the derived subclasses of one parent to fit INSIDE that parent,
 * without touching the already-normalized parents themselves.
 *
 * THE CONTAINMENT INVARIANT (POKER_THEORY §2.5.1, DEC-025 §1): a parent means
 * EXACTLY the union of its subclasses — a squeeze *is* a 3-bet. So per cell:
 *
 *   every subclass <= parent      and      Σ subclasses <= parent
 *
 * The sum may fall short of the parent, and legitimately does: the residual is
 * the unmodelled 4-bet tree (`subAction: null`), which WS-270 will claim.
 *
 * This subsumes the sibling-headroom rule rather than restating it. Pass A has
 * already established `sibling + parent <= 1.0`, so `Σ subclasses <= parent`
 * gives `sibling + Σ subclasses <= 1.0` for free.
 *
 * Enforcing it HERE, after `updateSubclassRanges` has already apportioned the
 * grids, is deliberate: showdown anchoring runs between the two and sets
 * individual cells to 1.0, so the invariant needs a guard that holds whatever
 * upstream did. (Pass A treats anchored parent cells the same way.)
 *
 * Only the subclass grids are scaled. Holding the parents fixed is what keeps
 * `open` / `threeBet` / `coldCall` / `limp` bit-identical to their
 * pre-taxonomy values, so no existing consumer shifts (DEC-025).
 *
 * @param {Object} ranges - ranges[action] = Float64Array(169)
 * @param {string} parent - the retained parent aggregate ('open' | 'threeBet')
 * @param {string[]} subclasses - that parent's subclasses
 */
const constrainSubclassesToParent = (ranges, parent, subclasses) => {
  const present = subclasses.filter(a => ranges[a]);
  const parentGrid = ranges[parent];
  if (present.length === 0 || !parentGrid) return;

  for (let i = 0; i < GRID_SIZE; i++) {
    const cap = parentGrid[i];

    let sum = 0;
    for (const action of present) {
      // No child may exceed its parent.
      ranges[action][i] = clamp(ranges[action][i], 0, cap);
      sum += ranges[action][i];
    }

    // The subclasses are mutually exclusive, so together they claim at most
    // the parent's weight.
    if (sum > cap && sum > 0) {
      const scale = cap / sum;
      for (const action of present) ranges[action][i] *= scale;
    }
  }
};

/**
 * Normalize all actions for a single position across both scenarios.
 * Only constrains non-fold actions within each scenario independently.
 *
 * Pass A normalizes the retained parents exactly as it always has. Pass B then
 * constrains each parent's derived subclasses to fit inside it, without moving
 * the parents.
 *
 * @param {Object} ranges - ranges[action] = Float64Array(169)
 */
export const normalizeAcrossActions = (ranges) => {
  // Pass A — parents, unchanged behavior.
  normalizeScenario(ranges, NO_RAISE_ACTIONS);
  normalizeScenario(ranges, FACED_RAISE_ACTIONS);

  // Pass B — derived subclasses contained by their parent, parents held fixed.
  constrainSubclassesToParent(ranges, 'open', NO_RAISE_SUBCLASSES);
  constrainSubclassesToParent(ranges, 'threeBet', FACED_RAISE_SUBCLASSES);
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
