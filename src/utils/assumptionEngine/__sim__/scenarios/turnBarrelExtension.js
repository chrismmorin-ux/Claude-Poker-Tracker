/**
 * scenarios/turnBarrelExtension.js — Tier-1 scenario for foldToTurnBarrel recipe
 *
 * Validates math integrity of the foldToTurnBarrel → line-change (double-barrel
 * extension) recipe against an over-folding Nit policy.
 *
 * Pass condition per calibration.md §2.5:
 *   |predicted − simulated| / |predicted| ≤ 0.05
 */

import { NIT_TIGHT } from '../syntheticVillains';

export const turnBarrelExtensionScenario = {
  name: 'foldToTurnBarrel — double-barrel extension vs Nit over-folder',
  villain: NIT_TIGHT,

  villainTendency: {
    villainId: 'v-nit-turn',
    style: 'Nit',
    totalObservations: 78,
    adaptationObservations: 4,
    observedRates: {
      foldToTurnBarrel: { rate: 0.74, n: 62, lastUpdated: '2026-04-23T10:00:00Z' },
    },
  },

  gameState: {
    street: 'turn',
    position: 'IP',
    texture: 'any',
    spr: 4,
    heroIsAggressor: true,
    betSizePot: 0.66,
    nodeId: 'turn-barrel-spot',
  },

  sessionContext: {
    villainBBDelta: 0,
    stake: 'cash',
  },

  targetPredicate: 'foldToTurnBarrel',
  firings: 10000,
  tolerance: 0.05,
};
