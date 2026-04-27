/**
 * scenarios/fishOvercallTurnDoubleBarrel.js — EAL-SEED-03 Tier-1 scenario
 *
 * Validates math integrity of the Fish-over-call-to-turn-double-barrel-on-dry-paired anchor.
 * Per `seed-anchors/03-fish-overcall-turn-doublebarrel-dry-paired.md` §2 + schema-delta §7.
 *
 * Commit 2 scope: scenario config + schema-gate + GTO-math verification.
 * This anchor uses `pot-odds-equilibrium` method — GTO math deferred at Commit 1.
 *
 * PP-03 "indirect usage" (absence-of-reweighting) flagged at Gate 2 per
 * seed-03 §4 — if rejected, refactor primitive to PP-03b.
 *
 * asymmetricPayoff (0.24) < 0.30 live gate → ships `actionableLive: false`, drill-only.
 */

import { ANCHOR_SCHEMA_VERSION } from '../../validateAnchor';
import { FISH_PAIRED_OVERCALL } from '../syntheticVillains';

// ───────────────────────────────────────────────────────────────────────────
// Anchor under test — EAL-SEED-03
// ───────────────────────────────────────────────────────────────────────────

export const EAL_SEED_03_ANCHOR = Object.freeze({
  schemaVersion: ANCHOR_SCHEMA_VERSION,
  archetypeName: 'Fish Over-Call to Turn Double-Barrel on Dry Paired Board',
  polarity: 'overcall',
  tier: 2,

  lineSequence: [
    {
      street: 'flop',
      heroAction: { kind: 'bet', sizingRange: [0.5, 0.67] },
      villainAction: { kind: 'call' },
      boardCondition: { texture: 'paired' },
    },
    {
      street: 'turn',
      heroAction: { kind: 'bet', sizingRange: [0.66, 0.75] },
      boardCondition: { texture: 'paired' },
    },
  ],

  perceptionPrimitiveIds: ['PP-03'],

  gtoBaseline: {
    method: 'pot-odds-equilibrium',
    referenceRate: 0.41,
    referenceEv: 0.28,
    notes: 'GTO fold rate at 0.7× pot = 0.41 (MDF defends 59%). Hero TPTK value-bet EV +0.28 pot at GTO; observed Fish over-call lets hero thin value-bet wider.',
  },

  evDecomposition: {
    statAttributable: 0.50,
    perceptionAttributable: 0.50,
  },

  retirementCondition: {
    method: 'credible-interval-overlap',
    params: { level: 0.95 },
  },

  origin: {
    source: 'ai-authored',
    authoredAt: '2026-04-24T12:00:00Z',
    authoredBy: 'session-1',
  },

  status: 'active',

  // Inherited v1.1 fields (validated by assumptionEngine/validator)
  id: 'anchor:fish:turn:overcall:drypaired',
  villainId: null,
  claim: {
    predicate: 'callVsTurnDoubleBarrelPaired',
    operator: '≥',
    threshold: 0.60,
  },
  evidence: {
    sampleSize: null,
    observationCount: null,
    pointEstimate: 0.76,
    credibleInterval: { lower: 0.65, upper: 0.85, level: 0.95 },
    prior: { type: 'style', alpha: 15, beta: 8 },
    posteriorConfidence: 0.89,
    decayHalfLife: 30,
  },
  consequence: {
    deviationId: 'valueExpandVsFishPaired',
    deviationType: 'value-expand',
    expectedDividend: { mean: 0.31, sd: 0.12, sharpe: 2.6, unit: 'bb per 100 trigger firings' },
    affectedHands: "hero's top-pair-weak-kicker and middle-pair-good-kicker combos on dry paired turns",
  },
  operator: {
    target: 'villain',
    transform: { actionDistributionDelta: { fold: -0.20, call: 0.18, raise: 0.02 } },
    dialCurve: 'sigmoid(k=8, floor=0.3, ceiling=0.9)',
    currentDial: 0.72,
    suppresses: [],
  },
});

// ───────────────────────────────────────────────────────────────────────────
// Scenario config
// ───────────────────────────────────────────────────────────────────────────

export const fishOvercallTurnDoubleBarrelScenario = {
  name: 'EAL-SEED-03 — Fish over-call to turn double-barrel on dry paired board',
  anchor: EAL_SEED_03_ANCHOR,
  villain: FISH_PAIRED_OVERCALL,

  villainTendency: {
    villainId: 'v-fish-paired-1',
    style: 'Fish',
    totalObservations: 62,
    adaptationObservations: 4,
    observedRates: {
      callVsTurnDoubleBarrelPaired: {
        rate: 0.76,
        n: 48,
        lastUpdated: '2026-04-22T21:00:00Z',
      },
    },
  },

  gameState: {
    street: 'turn',
    position: 'OOP', // villain is OOP defending
    texture: 'paired',
    spr: 5,
    heroIsAggressor: true,
    precedingStreetSequence: ['flop:heroCbet', 'flop:villainCall'],
    heroLineType: 'double-barrel',
    betSizePot: 0.70,
    nodeId: 'turn-fish-paired-barrel',
  },

  sessionContext: {
    villainBBDelta: 0,
    stake: 'cash',
  },

  targetPredicate: 'callVsTurnDoubleBarrelPaired',

  // pot-odds-equilibrium — runner defers GTO verification
  gtoContext: {
    potSize: 1.0,
    betSize: 0.70,
  },

  firings: 10000,
  tolerance: 0.05,
};

export default fishOvercallTurnDoubleBarrelScenario;
