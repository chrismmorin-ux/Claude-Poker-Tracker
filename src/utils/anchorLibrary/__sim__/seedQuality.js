/**
 * seedQuality.js — derive a seed anchor's v1.1 quality block from its own
 * transcribed numbers via the assumption engine's REAL gate evaluator.
 *
 * WS-218: seed anchors must pass full base-contract validation
 * (validateAnchorFull), which requires the §1.10 QualityComposite block.
 * Hand-typing composite/actionability values would fabricate quality claims;
 * deriving them through `determineActionability` keeps the block honest
 * (e.g., all Phase-1 seeds gate actionable=false on pending stability) and
 * self-consistent if gate formulas evolve.
 */

import { determineActionability } from '../../assumptionEngine/qualityGate';
import { VILLAIN_SIDE_THRESHOLDS } from '../../assumptionEngine/assumptionTypes';

/**
 * @param {Object} base - seed anchor fields (everything except `quality`)
 * @returns {Object} frozen v1.1 QualityComposite block
 */
export const buildSeedQuality = (base) => {
  const {
    actionableInDrill, actionableLive, actionable, composite, gatesPassedLive, reason,
  } = determineActionability(base);
  return Object.freeze({
    composite,
    actionableInDrill,
    actionableLive,
    actionable,
    thresholds: VILLAIN_SIDE_THRESHOLDS,
    gatesPassed: gatesPassedLive,
    ...(reason !== undefined ? { reason } : {}),
  });
};
