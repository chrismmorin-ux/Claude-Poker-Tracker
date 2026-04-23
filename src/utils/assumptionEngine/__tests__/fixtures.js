/**
 * Shared test fixtures for assumptionEngine tests.
 * Canonical valid v1.1 VillainAssumption based on Example 1 (river bluff pruning).
 */

import {
  SCHEMA_VERSION,
  VILLAIN_SIDE_THRESHOLDS,
  HERO_SIDE_THRESHOLDS,
} from '../assumptionTypes';

/**
 * Return a fresh, deep-cloned canonical valid assumption each call.
 * Canonical Example 1: river bluff pruning vs non-folder.
 */
export const canonicalAssumption = () => ({
  id: 'v42:foldToRiverBet@betSize>=0.66p@river:any:any',
  schemaVersion: SCHEMA_VERSION,
  villainId: 'v42',

  claim: {
    predicate: 'foldToRiverBet',
    operator: '<=',
    threshold: 0.25,
    scope: {
      street: 'river',
      position: 'any',
      texture: 'any',
      sprRange: [0, 100],
      betSizeRange: [0.66, 1.2],
      playersToAct: 0,
      activationFrequency: 0.04,
    },
  },

  evidence: {
    sampleSize: 54,
    observationCount: 52,
    pointEstimate: 0.17,
    credibleInterval: { lower: 0.11, upper: 0.24, level: 0.95 },
    prior: { type: 'style', alpha: 8, beta: 15 },
    posteriorConfidence: 0.91,
    lastUpdated: '2026-04-22T19:15:00Z',
    decayHalfLife: 30,
  },

  stability: {
    acrossSessions: 0.82,
    acrossTextures: 0.78,
    acrossStackDepths: 0.85,
    acrossStreetContext: 0.80,
    compositeScore: 0.81,
    nonNullSubscoreCount: 4,
  },

  recognizability: {
    triggerDescription: 'Hero has taken aggressive line to river, villain has called each street',
    conditionsCount: 2,
    heroCognitiveLoad: 'low',
    score: 1.0,
  },

  consequence: {
    deviationId: 'dropRiverBluffs',
    deviationType: 'bluff-prune',
    expectedDividend: { mean: 0.52, sd: 0.11, sharpe: 4.73, unit: 'bb per 100 trigger firings' },
    affectedHands: 'missed-draw combos on river in hero\'s triple-barrel bluff range',
  },

  counterExploit: {
    resistanceScore: 0.88,
    resistanceConfidence: 0.75,
    resistanceSources: [
      { factor: 'style-conditioned', weight: 0.6, contribution: 0.55, observationCount: 54 },
      { factor: 'adaptationHistory', weight: 0.4, contribution: 0.33, observationCount: 12 },
    ],
    adjustmentCost: 0.14,
    asymmetricPayoff: 0.45,
  },

  operator: {
    target: 'villain',
    nodeSelector: { street: 'river', action: 'hero-bet', betSize: [0.66, 1.2] },
    transform: {
      actionDistributionDelta: { fold: 0.0, call: 0.0, raise: 0.0 },
      rangeShift: { exclude: 'missed-draw bluff combos from hero river range', include: [] },
    },
    currentDial: 0.82,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  },

  narrative: {
    humanStatement: 'Villain folds to river bets only 17% of the time (n=52, 95% CI [11%, 24%])',
    citationShort: 'fold-to-river 17% @ n=52',
    citationLong: 'Over 52 observed river decisions, villain folded only 9. Their style (Fish) aligns with population-level call-station tendency.',
    teachingPattern: "When I've barreled to river and villain has called every street, they're not folding.",
    analogAnchor: "classic station who won't fold any pair",
  },

  quality: {
    composite: 0.86,
    actionableInDrill: true,
    actionableLive: true,
    actionable: true,
    thresholds: {
      villainSide: { ...VILLAIN_SIDE_THRESHOLDS },
      heroSide: { ...HERO_SIDE_THRESHOLDS },
    },
    gatesPassed: {
      confidence: true,
      stability: true,
      recognizabilityDrill: true,
      recognizabilityLive: true,
      asymmetricPayoff: true,
      sharpe: true,
    },
  },

  status: 'active',
  validation: { timesApplied: 0, realizedDividend: 0, calibrationGap: 0, lastValidated: null },
});

/**
 * A v1.0 persisted record to exercise migration.
 * Omits: scope.activationFrequency, expectedDividend.sharpe,
 * counterExploit.resistanceConfidence, source observationCount, operator.suppresses,
 * stability.nonNullSubscoreCount. Uses old `unit: 'bb/100'` and flat `thresholds`.
 */
export const legacyV10Record = () => ({
  id: 'legacy-1',
  schemaVersion: '1.0',
  villainId: 'v99',

  claim: {
    predicate: 'foldToCbet',
    operator: '>=',
    threshold: 0.70,
    scope: {
      street: 'flop',
      position: 'IP',
      texture: 'dry',
      sprRange: [3, 15],
      betSizeRange: [0.25, 0.4],
      playersToAct: 0,
    },
  },

  evidence: {
    sampleSize: 71,
    observationCount: 55,
    pointEstimate: 0.78,
    credibleInterval: { lower: 0.68, upper: 0.86, level: 0.95 },
    prior: { type: 'style', alpha: 14, beta: 10 },
    posteriorConfidence: 0.88,
    lastUpdated: '2026-04-10T12:00:00Z',
    decayHalfLife: 30,
  },

  stability: {
    acrossSessions: 0.80,
    acrossTextures: 0.75,
    acrossStackDepths: 0.82,
    acrossStreetContext: 0.78,
    compositeScore: 0.79,
    // missing nonNullSubscoreCount — migration will compute
  },

  recognizability: {
    triggerDescription: 'Dry flop after preflop flat call',
    conditionsCount: 2,
    heroCognitiveLoad: 'low',
    score: 0.85,
  },

  consequence: {
    deviationId: 'rangeBetDryFlops',
    deviationType: 'range-bet',
    expectedDividend: { mean: 0.47, sd: 0.13, unit: 'bb/100' }, // v1.0 unit + missing sharpe
    affectedHands: "hero's entire range on dry flops after flat-call",
  },

  counterExploit: {
    resistanceScore: 0.82,
    resistanceSources: [
      { factor: 'style-conditioned', weight: 0.7, contribution: 0.50 },
      // missing observationCount
    ],
    adjustmentCost: 0.20,
    asymmetricPayoff: 0.38,
    // missing resistanceConfidence
  },

  operator: {
    target: 'villain',
    nodeSelector: { street: 'flop', texture: 'dry' },
    transform: {
      actionDistributionDelta: { fold: 0.15, call: -0.12, raise: -0.03 },
    },
    currentDial: 0.78,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    // missing suppresses
  },

  narrative: {
    humanStatement: 'Villain folds to cbet 78% on dry flops',
    citationShort: 'fold-to-cbet 78%',
    citationLong: 'Over 71 observed dry-flop cbet decisions, villain folded 55.',
    teachingPattern: 'Dry flop + flat caller = small cbet your range.',
  },

  quality: {
    composite: 0.81,
    actionable: true, // v1.0 single boolean
    thresholds: {
      confidence: 0.80,
      stability: 0.70,
      recognizability: 0.60,
      asymmetricPayoff: 0.30,
    },
    gatesPassed: {
      confidence: true,
      stability: true,
      recognizability: true,
      asymmetricPayoff: true,
    },
  },

  status: 'active',
  validation: { timesApplied: 5, realizedDividend: 0.42, calibrationGap: 0.10, lastValidated: '2026-04-20T12:00:00Z' },
});
