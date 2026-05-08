/**
 * derivation.js — top-level dispatcher that routes a position to its scenario
 * decomposer and produces a Float64Array of EV(open) per hand class.
 *
 * Public API:
 *   buildOpeningRange(position, opts) → Promise<Float64Array(169)>
 *
 * v1 supports BTN and UTG only. Middle positions + blinds deferred to v2.
 */

import { buildBtnDerivedRange, JOINT_PROBABILITIES_BTN } from './scenarios/btnScenarios';
import { buildUtgDerivedRange, UTG_SCENARIO_PROBS } from './scenarios/utgScenarios';
import { createCache } from './cache';

const DEFAULTS = {
  openSize: 2.5,
  effStack: 100,
  mcTrials: 5000,
  mcConvergenceThreshold: 0.02,
};

/**
 * @param {('BTN'|'UTG')} position
 * @param {Object} [userOpts]
 * @returns {Promise<{ derivedEV: Float64Array, scenarioProbs: Object, cache: Object, config: Object }>}
 */
export const buildOpeningRange = async (position, userOpts = {}) => {
  const opts = { ...DEFAULTS, ...userOpts };
  const cache = createCache();

  let derivedEV;
  let scenarioProbs;

  if (position === 'BTN') {
    derivedEV = await buildBtnDerivedRange(opts, cache);
    scenarioProbs = JOINT_PROBABILITIES_BTN;
  } else if (position === 'UTG') {
    derivedEV = await buildUtgDerivedRange(opts, cache);
    scenarioProbs = UTG_SCENARIO_PROBS;
  } else {
    throw new Error(`buildOpeningRange: unsupported position '${position}'. v1 supports 'BTN' and 'UTG' only.`);
  }

  return {
    derivedEV,
    scenarioProbs,
    cache,
    config: opts,
  };
};
