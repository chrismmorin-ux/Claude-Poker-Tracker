/**
 * scenarios/floatVsRangeBettor.js — Tier-1 scenario for cbetFrequency recipe
 *
 * Validates math integrity of the cbetFrequency → line-change (float-wider)
 * recipe against a LAG range-bettor policy.
 *
 * Hero-as-defender scope: `heroIsAggressor=false` + `villainIsAggressor=true`.
 *
 * Pass condition per calibration.md §2.5:
 *   |predicted − simulated| / |predicted| ≤ 0.05
 */

import { LAG_AGGRESSIVE } from '../syntheticVillains';

export const floatVsRangeBettorScenario = {
  name: 'cbetFrequency — float wider vs LAG range-bettor',
  villain: LAG_AGGRESSIVE,

  villainTendency: {
    villainId: 'v-lag-range-bet',
    style: 'LAG',
    totalObservations: 92,
    adaptationObservations: 6,
    observedRates: {
      cbetFrequency: { rate: 0.91, n: 88, lastUpdated: '2026-04-23T10:00:00Z' },
    },
  },

  gameState: {
    street: 'flop',
    position: 'IP', // hero defends IP
    texture: 'any',
    spr: 8,
    heroIsAggressor: false,
    villainIsAggressor: true,
    betSizePot: 0.50,
    nodeId: 'flop-defender-spot',
  },

  sessionContext: {
    villainBBDelta: 0,
    stake: 'cash',
  },

  targetPredicate: 'cbetFrequency',
  firings: 10000,
  tolerance: 0.05,
};
