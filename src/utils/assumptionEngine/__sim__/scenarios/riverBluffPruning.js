/**
 * scenarios/riverBluffPruning.js — Canonical Example 1 Tier-1 scenario
 *
 * Validates math integrity of the foldToRiverBet → bluff-prune recipe.
 * Per calibration.md §2.2, this scenario should exercise:
 *   - producer recipe applicability (river + hero aggressor)
 *   - Bayesian posterior computation with Fish style prior
 *   - quality-gate passage (confidence, stability, recognizability, asymmetric payoff, sharpe)
 *   - honesty check (dial = 0 → zero shift)
 *
 * This scenario is the first proof-of-concept. Additional scenarios (one per recipe)
 * land alongside each new recipe in Commit 4.5/5 per the 4-file-touch rule.
 */

import { FISH_STATION } from '../syntheticVillains';

export const riverBluffPruningScenario = {
  name: 'Canonical Example 1 — River bluff pruning vs Fish station',
  villain: FISH_STATION,

  villainTendency: {
    villainId: 'v42',
    style: 'Fish',
    totalObservations: 54,
    adaptationObservations: 8,
    observedRates: {
      foldToRiverBet: { rate: 0.17, n: 52, lastUpdated: '2026-04-22T19:15:00Z' },
    },
  },

  gameState: {
    street: 'river',
    position: 'OOP',
    texture: 'any',
    spr: 4,
    heroIsAggressor: true,
    betSizePot: 0.75,
    nodeId: 'river-bluff-spot',
  },

  sessionContext: {
    villainBBDelta: 0,
    stake: 'cash',
  },

  targetPredicate: 'foldToRiverBet',
  firings: 10000,
  tolerance: 0.05,
};
