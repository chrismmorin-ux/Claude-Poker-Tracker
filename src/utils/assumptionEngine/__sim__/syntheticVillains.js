/**
 * syntheticVillains.js — Stylized villain policies for Tier-1 math-integrity testing
 *
 * Part of the assumptionEngine Tier-1 simulator per calibration.md §2.
 *
 * A synthetic villain is a fully specified decision policy. Running a scenario
 * iterates N hands against the policy and compares the engine's predicted
 * dividend to the realized simulated dividend. Tier-1 pass condition:
 * `|predicted − realized| / |predicted| ≤ 0.05`.
 *
 * These are NOT real villain models — they are known-ground-truth policies for
 * validating operator composition, dial curves, blend math, and emotional
 * transform layering. Real calibration (model validity) happens in Tier-2 against
 * real hand history.
 *
 * Pure module — no imports.
 */

/**
 * SyntheticVillainPolicy — fully specified decision policy.
 *
 * @typedef {Object} SyntheticVillainPolicy
 * @property {string} styleLabel
 * @property {function(node, combo): ActionDistribution} actionAtNode
 * @property {number} seed
 */

/**
 * Fish policy: calls everything, rarely folds, never raises bluff.
 * Canonical Example 1 target — fold-to-river 17%.
 */
export const FISH_STATION = Object.freeze({
  styleLabel: 'Fish',
  seed: 42,
  /**
   * Action distribution at a given node. Simplified — ignores combo for fish
   * (they call with anything).
   */
  actionAtNode: (_node, _combo) => ({
    fold: 0.17,
    call: 0.80,
    raise: 0.03,
  }),
  // Expected observed rate for foldToRiverBet: 17%
  expectedObservedRates: {
    foldToRiverBet: { rate: 0.17, n: Infinity },
    foldToCbet: { rate: 0.28, n: Infinity },
    callFrequencyVsSmallBet: { rate: 0.75, n: Infinity },
  },
});

/**
 * Nit policy: tight, folds frequently to cbet, rarely calls light.
 * Canonical Example 3 target — fold-to-cbet-dry 78%.
 */
export const NIT_TIGHT = Object.freeze({
  styleLabel: 'Nit',
  seed: 43,
  actionAtNode: (node) => {
    if (node.street === 'flop' && node.texture === 'dry') {
      return { fold: 0.78, call: 0.19, raise: 0.03 };
    }
    return { fold: 0.55, call: 0.40, raise: 0.05 };
  },
  expectedObservedRates: {
    foldToCbet: { rate: 0.78, n: Infinity },
    foldToRiverBet: { rate: 0.62, n: Infinity },
  },
});

/**
 * LAG policy: loose-aggressive; calls thin, occasionally check-raises.
 */
export const LAG_AGGRESSIVE = Object.freeze({
  styleLabel: 'LAG',
  seed: 44,
  actionAtNode: (_node) => ({
    fold: 0.32,
    call: 0.55,
    raise: 0.13,
  }),
  expectedObservedRates: {
    foldToCbet: { rate: 0.32, n: Infinity },
    checkRaiseFrequency: { rate: 0.13, n: Infinity },
  },
});

/**
 * TAG policy: solid + balanced.
 */
export const TAG_SOLID = Object.freeze({
  styleLabel: 'TAG',
  seed: 45,
  actionAtNode: (_node) => ({
    fold: 0.50,
    call: 0.42,
    raise: 0.08,
  }),
  expectedObservedRates: {
    foldToCbet: { rate: 0.50, n: Infinity },
  },
});

/**
 * Fish with selective fear: folds widely on flush-complete rivers despite
 * otherwise calling station-wide. Canonical Example 4 target.
 */
export const FISH_SELECTIVE_FEAR = Object.freeze({
  styleLabel: 'Fish',
  seed: 46,
  actionAtNode: (node) => {
    if (node.street === 'river' && node.texture === 'flush-complete' && node.betSizePot >= 0.8) {
      return { fold: 0.58, call: 0.40, raise: 0.02 };
    }
    return { fold: 0.17, call: 0.80, raise: 0.03 };
  },
  expectedObservedRates: {
    foldToRiverBet: { rate: 0.22, n: Infinity }, // aggregate across all river textures
    foldOnScareCard: { rate: 0.58, n: Infinity },
  },
});

/**
 * Custom policy factory — construct a villain with arbitrary override actions.
 *
 * @param {Object} overrides - { styleLabel, seed, actionAtNode, expectedObservedRates }
 */
export const customPolicy = ({ styleLabel = 'Unknown', seed = 0, actionAtNode, expectedObservedRates = {} }) => ({
  styleLabel,
  seed,
  actionAtNode: typeof actionAtNode === 'function' ? actionAtNode : (_node) => ({ fold: 0.5, call: 0.4, raise: 0.1 }),
  expectedObservedRates,
});

/**
 * Registry of shipped canonical synthetic villains, keyed by name for scenario references.
 */
export const CANONICAL_VILLAINS = Object.freeze({
  FISH_STATION,
  NIT_TIGHT,
  LAG_AGGRESSIVE,
  TAG_SOLID,
  FISH_SELECTIVE_FEAR,
});
