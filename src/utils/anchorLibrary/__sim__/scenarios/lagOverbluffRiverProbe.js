/**
 * scenarios/lagOverbluffRiverProbe.js — EAL-SEED-02 Tier-1 scenario
 *
 * Validates math integrity of the LAG-over-bluff-to-river-probe-after-turn-XX anchor.
 * Per `seed-anchors/02-lag-overbluff-river-probe-turn-xx.md` §2 + schema-delta §7.
 *
 * Commit 2 scope: scenario config + schema-gate + GTO-math-deferred verification
 * (method is `pot-odds-equilibrium` — deferred by anchorScenarioRunner at Commit 1).
 *
 * Commit 2.5 scope: wire to producer + simulate end-to-end hero-side bluff-catch EV.
 *
 * Important: this anchor's asymmetricPayoff (0.18) is BELOW the 0.30 live gate.
 * Ships as `actionableInDrill: true, actionableLive: false` per seed-02 §6.
 * Schema validation still passes — the live-gate check is a surface-level guard,
 * not a schema invariant.
 */

import { ANCHOR_SCHEMA_VERSION } from '../../validateAnchor';
import { LAG_TURN_XX_OVERBLUFF } from '../syntheticVillains';
import { buildSeedQuality } from '../seedQuality';

// ───────────────────────────────────────────────────────────────────────────
// Anchor under test — EAL-SEED-02
// ───────────────────────────────────────────────────────────────────────────

const SEED_02_BASE = {
  // ─── EAL extension fields ───────────────────────────────────────────────
  schemaVersion: ANCHOR_SCHEMA_VERSION,
  archetypeName: 'LAG Over-Bluff to River Probe After Turn Check-Check',
  polarity: 'overbluff',
  tier: 2,

  lineSequence: [
    // Flop — hero flats, villain bets
    {
      street: 'flop',
      heroAction: { kind: 'call' },
      villainAction: { kind: 'bet', sizingRange: [0.5, 0.75] },
      boardCondition: { texture: 'any' },
    },
    // Turn — check-check (the key trigger)
    {
      street: 'turn',
      heroAction: { kind: 'check' },
      villainAction: { kind: 'check' },
      boardCondition: { texture: 'any' },
    },
    // River — villain probes, hero decides
    {
      street: 'river',
      villainAction: { kind: 'bet', sizingRange: [0.66, 0.80] },
      boardCondition: { texture: 'any' },
    },
  ],

  perceptionPrimitiveIds: ['PP-02', 'PP-05'],

  gtoBaseline: {
    method: 'pot-odds-equilibrium',
    // GTO-balanced bluff frequency at 0.75× pot bet = bet/(pot+bet) = 0.75/1.75 ≈ 0.4286 → rounded to 0.43
    referenceRate: 0.43,
    referenceEv: 0.16,
    notes: 'Hero bluff-catch break-even at 0.75× pot needs ~27% equity; balanced 43% bluff frequency clears that.',
  },

  evDecomposition: {
    // Mostly perception-driven: 75% of edge from PP-02 + PP-05 co-firing.
    statAttributable: 0.25,
    perceptionAttributable: 0.75,
  },

  retirementCondition: {
    // Per seed-02 §7: gap-threshold (not CI-overlap) because hero's call-EV is
    // sensitive to the point estimate of villain bluff frequency via pot odds.
    method: 'gap-threshold',
    params: { gap: 0.05, sessions: 10 },
  },

  origin: {
    source: 'ai-authored',
    authoredAt: '2026-04-24T12:00:00Z',
    authoredBy: 'session-1',
  },

  status: 'active', // drill-only ship; actionableLive gated at surface layer

  // ─── Inherited v1.1 fields (full conformance per WS-218; transcribed from
  // seed-anchor markdown §1-§8) ─────────────────────────────────────────────
  id: 'anchor:lag:river:overbluff:turnxx',
  // Template anchor: pooled per-style claim (markdown §2).
  villainId: 'population:LAG',
  claim: {
    predicate: 'riverProbeBluffFrequencyAfterTurnXX',
    operator: '>=',
    threshold: 0.50,
    // markdown §1 scope predicates
    scope: {
      street: 'river',
      position: 'any',
      texture: 'any',
      sprRange: [3, 8],
      betSizeRange: [0.66, 0.80],
      playersToAct: 0,
      heroLineType: 'any',
      activationFrequency: 0.035,
    },
  },
  evidence: {
    sampleSize: 0,
    observationCount: 0,
    pointEstimate: 0.62,
    credibleInterval: { lower: 0.48, upper: 0.74, level: 0.95 },
    prior: { type: 'style', alpha: 12, beta: 14 },
    posteriorConfidence: 0.87,
    lastUpdated: '2026-04-24T12:00:00Z',
    decayHalfLife: 30,
  },
  // All subscores pending at authoring (markdown gate checks).
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
    triggerDescription: 'style=LAG + flop hero-call + turn check-check + river villain-bet',
    conditionsCount: 4,
    heroCognitiveLoad: 'low',
    score: 0.88,
  },
  consequence: {
    deviationId: 'bluffCatchLagRiverProbe',
    deviationType: 'value-expand',
    expectedDividend: { mean: 0.42, sd: 0.19, sharpe: 2.2, unit: 'bb per 100 trigger firings' },
    affectedHands: 'hero bluff-catcher range: middle pair, weak top pair, pocket pairs below top pair',
  },
  // markdown §6 counterExploit (asymmetricPayoff 0.18 is honestly sub-gate —
  // markdown ships this anchor drill/review-only pending narrowed scope)
  counterExploit: {
    resistanceScore: 0.68,
    resistanceConfidence: 0.55,
    resistanceSources: [
      { factor: 'style-conditioned', weight: 0.5, contribution: 0.40, observationCount: 0 },
      { factor: 'adaptationHistory', weight: 0.3, contribution: 0.16, observationCount: 0 },
      { factor: 'session-length', weight: 0.2, contribution: 0.12, observationCount: 0 },
    ],
    adjustmentCost: 0.22,
    asymmetricPayoff: 0.18,
  },
  operator: {
    target: 'villain',
    // markdown §6 operator nodeSelector
    nodeSelector: {
      street: 'river',
      villainStyle: 'LAG',
      villainAction: 'bet',
      precedingStreetSequence: ['flop:heroCall', 'turn:checkCheck'],
      betSize: [0.66, 0.80],
    },
    transform: {
      actionDistributionDelta: { bet: 0.15, check: -0.15 },
      rangeShift: { include: 'bluff combos (missed draws, 3-to-straight no-pair)' },
    },
    dialCurve: 'sigmoid(k=8, floor=0.3, ceiling=0.9)',
    currentDial: 0.68,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  },
  // markdown §8 narrative
  narrative: {
    humanStatement: 'LAGs probe the river after turn check-check 58% of the time, with ~62% of those probes being bluffs vs ~43% GTO-balanced',
    citationShort: 'LAG turn-xx-probe bluffs 62% (CI [48%, 74%])',
    citationLong: 'When facing a LAG-classified villain on a river where hero flat-called the flop, turn checked through both ways, and villain now bets 66-80% pot, observed bluff frequency is ~62% — substantially above the 43% GTO-balanced rate. Primary drivers: LAG misreads turn check-check as mutual capping (PP-02) and doesn’t integrate hero’s prior-street range forward (PP-05), together inflating their perceived fold equity. Hero’s bluff-catchers are significantly wider-than-GTO profitable calls. Note: asymmetric payoff currently sub-live-threshold; anchor fires in drill and post-session review only pending narrowed scope or more data.',
    teachingPattern: 'LAG in the line, turn went check-check, river villain bets 3/4 pot? Call with any pair or decent blocker.',
    analogAnchor: 'the aggressive reg who thinks every check means weakness',
    concept: 'POKER_THEORY.md §5.5 (bluff catching math) + §3.5 (range advantage)',
  },
  // v1.1 §1.11 calibration tracking — no Tier 1 or Tier 2 validation at authoring.
  validation: { tier1: null, tier2: null },
};

export const EAL_SEED_02_ANCHOR = Object.freeze({
  ...SEED_02_BASE,
  // §1.10 quality derived via the engine's own gate evaluator (seedQuality.js).
  quality: buildSeedQuality(SEED_02_BASE),
});

// ───────────────────────────────────────────────────────────────────────────
// Scenario config
// ───────────────────────────────────────────────────────────────────────────

export const lagOverbluffRiverProbeScenario = {
  name: 'EAL-SEED-02 — LAG over-bluff to river probe after turn check-check',
  anchor: EAL_SEED_02_ANCHOR,
  villain: LAG_TURN_XX_OVERBLUFF,

  villainTendency: {
    villainId: 'v-lag-xx-1',
    style: 'LAG',
    totalObservations: 47,
    adaptationObservations: 6,
    observedRates: {
      riverProbeBluffFrequencyAfterTurnXX: {
        rate: 0.62,
        n: 38,
        lastUpdated: '2026-04-22T20:00:00Z',
      },
    },
  },

  gameState: {
    street: 'river',
    position: 'IP', // hero checked-back turn, LAG probes river
    texture: 'any',
    spr: 5,
    heroIsAggressor: false,
    precedingStreetSequence: ['flop:heroCall', 'flop:villainBet', 'turn:checkCheck'],
    villainAction: 'bet',
    betSizePot: 0.75,
    nodeId: 'river-lag-probe-post-xx',
  },

  sessionContext: {
    villainBBDelta: 0,
    stake: 'cash',
  },

  targetPredicate: 'riverProbeBluffFrequencyAfterTurnXX',

  // pot-odds-equilibrium method — GTO math verification is deferred by the
  // anchorScenarioRunner. gtoContext not required but included for completeness.
  // Note: for a `pot-odds-equilibrium` anchor, the hero's call-EV is sensitive
  // to villain bluff-frequency (not fold frequency), so the MDF math doesn't
  // directly apply. Commit 2.5 wires a method-specific verifier.
  gtoContext: {
    potSize: 1.0,
    betSize: 0.75,
  },

  firings: 10000,
  tolerance: 0.05,
};

export default lagOverbluffRiverProbeScenario;
