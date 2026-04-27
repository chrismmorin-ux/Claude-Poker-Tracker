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

// ───────────────────────────────────────────────────────────────────────────
// Anchor under test — EAL-SEED-02
// ───────────────────────────────────────────────────────────────────────────

export const EAL_SEED_02_ANCHOR = Object.freeze({
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

  // ─── Inherited v1.1 fields (validated by assumptionEngine/validator) ─────
  id: 'anchor:lag:river:overbluff:turnxx',
  villainId: null,
  claim: {
    predicate: 'riverProbeBluffFrequencyAfterTurnXX',
    operator: '≥',
    threshold: 0.50,
  },
  evidence: {
    sampleSize: null,
    observationCount: null,
    pointEstimate: 0.62,
    credibleInterval: { lower: 0.48, upper: 0.74, level: 0.95 },
    prior: { type: 'style', alpha: 12, beta: 14 },
    posteriorConfidence: 0.87,
    decayHalfLife: 30,
  },
  consequence: {
    deviationId: 'bluffCatchLagRiverProbe',
    deviationType: 'value-expand',
    expectedDividend: { mean: 0.42, sd: 0.19, sharpe: 2.2, unit: 'bb per 100 trigger firings' },
    affectedHands: 'hero bluff-catcher range: middle pair, weak top pair, pocket pairs below top pair',
  },
  operator: {
    target: 'villain',
    transform: { actionDistributionDelta: { bet: 0.15, check: -0.15 } },
    dialCurve: 'sigmoid(k=8, floor=0.3, ceiling=0.9)',
    currentDial: 0.68,
    suppresses: [],
  },
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
