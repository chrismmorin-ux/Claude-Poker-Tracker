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
import { buildSeedQuality } from '../seedQuality';

// ───────────────────────────────────────────────────────────────────────────
// Anchor under test — EAL-SEED-03
// ───────────────────────────────────────────────────────────────────────────

const SEED_03_BASE = {
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

  // Inherited v1.1 fields (full conformance per WS-218; transcribed from
  // seed-anchor markdown §1-§8)
  id: 'anchor:fish:turn:overcall:drypaired',
  // Template anchor: pooled per-style claim (markdown §2).
  villainId: 'population:Fish',
  claim: {
    predicate: 'callVsTurnDoubleBarrelPaired',
    operator: '>=',
    threshold: 0.60,
    // markdown §1 scope predicates
    scope: {
      street: 'turn',
      position: 'any',
      texture: 'paired',
      sprRange: [3, 8],
      betSizeRange: [0.66, 0.75],
      playersToAct: 0,
      heroLineType: 'double-barrel',
      activationFrequency: 0.025,
    },
  },
  evidence: {
    sampleSize: 0,
    observationCount: 0,
    pointEstimate: 0.76,
    credibleInterval: { lower: 0.65, upper: 0.85, level: 0.95 },
    prior: { type: 'style', alpha: 15, beta: 8 },
    posteriorConfidence: 0.89,
    lastUpdated: '2026-04-24T12:00:00Z',
    decayHalfLife: 30,
  },
  // markdown: acrossTextures scope-nulled ("paired"); acrossStreetContext
  // scope-nulled (heroLineType set); others pending data.
  stability: {
    acrossSessions: null,
    acrossTextures: null,
    acrossStackDepths: null,
    acrossStreetContext: null,
    compositeScore: null,
    nonNullSubscoreCount: 0,
  },
  // markdown §1 recognizability
  recognizability: {
    triggerDescription: 'style=Fish + dry-paired flop + called flop c-bet + brick turn',
    conditionsCount: 4,
    heroCognitiveLoad: 'low',
    score: 0.88,
  },
  consequence: {
    deviationId: 'valueExpandVsFishPaired',
    deviationType: 'value-expand',
    expectedDividend: { mean: 0.31, sd: 0.12, sharpe: 2.6, unit: 'bb per 100 trigger firings' },
    affectedHands: "hero's top-pair-weak-kicker and middle-pair-good-kicker combos on dry paired turns",
  },
  // markdown §6 counterExploit (asymmetricPayoff 0.24 honestly sub-live-gate —
  // markdown ships drill-only in Phase 1)
  counterExploit: {
    resistanceScore: 0.92,
    resistanceConfidence: 0.70,
    resistanceSources: [
      { factor: 'style-conditioned', weight: 0.7, contribution: 0.72, observationCount: 0 },
      { factor: 'adaptationHistory', weight: 0.3, contribution: 0.27, observationCount: 0 },
    ],
    adjustmentCost: 0.08,
    asymmetricPayoff: 0.24,
  },
  operator: {
    target: 'villain',
    // markdown §6 operator nodeSelector
    nodeSelector: {
      street: 'turn',
      texture: 'paired',
      villainStyle: 'Fish',
      precedingStreetSequence: ['flop:heroCbet', 'flop:villainCall'],
      heroLineType: 'double-barrel',
      betSize: [0.66, 0.75],
    },
    transform: { actionDistributionDelta: { fold: -0.20, call: 0.18, raise: 0.02 } },
    dialCurve: 'sigmoid(k=8, floor=0.3, ceiling=0.9)',
    currentDial: 0.72,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  },
  // markdown §8 narrative
  narrative: {
    humanStatement: 'Fish call turn double-barrels on dry paired boards ~76% of the time (fold ~20%), vs ~59% GTO-balanced call rate',
    citationShort: 'Fish paired-turn call 76% (CI [65%, 85%])',
    citationLong: 'Against Fish-classified villains who flat-called a flop cbet on a dry paired board, their call rate to a 66-75% pot double-barrel on a brick turn is ~76%. GTO-balanced defense is ~59% call. The +17pp gap expands hero’s value-bet threshold meaningfully — top-pair-weak-kicker and middle-pair become value bets (not bluff-catches). Primary driver: PP-03 (absence-of-reweighting — Fish process each street’s decision as “do I have a pair?” rather than as range-based reasoning). Resistance to adaptation is extremely high (0.92) because this is the Fish default heuristic. Anchor fires as drill-only in Phase 1 (asymmetricPayoff 0.24 below live threshold); scope narrowing may promote to live in Phase 2.',
    teachingPattern: 'Dry paired flop + Fish called + brick turn? Value-bet wider than GTO — any pair wins, thin value is still value.',
    analogAnchor: 'the recreational caller who’ll “just call and see” the river with any pair',
    concept: 'POKER_THEORY.md §5.3 (value thresholds) + §3.4 (three motivations — showdown-value)',
  },
  // markdown §6 emotionalTrigger
  emotionalTrigger: {
    type: 'greed-exploit',
    condition: { minGreedIndex: 0.45 },
    activationMultiplier: 1.10,
    citableReason: 'Paired turn + Fish-with-a-pair → elevated greed (showdown-value-feel); expanded value range exploits the stickiness',
  },
  // v1.1 §1.11 calibration tracking — no Tier 1 or Tier 2 validation at authoring.
  validation: { tier1: null, tier2: null },
};

export const EAL_SEED_03_ANCHOR = Object.freeze({
  ...SEED_03_BASE,
  // §1.10 quality derived via the engine's own gate evaluator (seedQuality.js).
  quality: buildSeedQuality(SEED_03_BASE),
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
