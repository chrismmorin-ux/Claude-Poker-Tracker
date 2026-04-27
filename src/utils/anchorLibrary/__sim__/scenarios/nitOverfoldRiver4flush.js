/**
 * scenarios/nitOverfoldRiver4flush.js — EAL-SEED-01 Tier-1 scenario
 *
 * Validates math integrity of the Nit-over-fold-to-river-overbet-on-4-flush anchor.
 * Per `schema-delta.md` §7 (inherits `calibration.md` §2.5 pass condition):
 *   |predicted − realized| / |predicted| ≤ 0.05
 *
 * This scenario exercises:
 *   - `validateAnchor` schema gate (should pass)
 *   - GTO baseline math (MDF at 1.2× pot = 54.5% fold rate; anchor declares 0.54 within 2pt tolerance)
 *   - Predicted vs simulated dividend (delegated to assumptionEngine per-predicate runner — see test)
 *   - Honesty check (inherited from underlying runner; I-AE-3)
 *
 * Commit 1 scope: scenario config object + schema-gate + GTO-math verification.
 * Commit 2 scope (this): wire NIT_SCARE_OVERFOLD synthetic villain (replaces Commit 1 `null`).
 * Commit 2.5 scope: wire real assumption producer for end-to-end predicted-vs-simulated assertion.
 *
 * See `docs/projects/exploit-anchor-library/seed-anchors/01-nit-overfold-river-overbet-4flush.md`
 * for the anchor's derivation.
 */

import { ANCHOR_SCHEMA_VERSION } from '../../validateAnchor';
import { NIT_SCARE_OVERFOLD } from '../syntheticVillains';

// ───────────────────────────────────────────────────────────────────────────
// Anchor under test — EAL-SEED-01
// ───────────────────────────────────────────────────────────────────────────

/**
 * The ExploitAnchor record derived from seed-anchors/01-nit-overfold-river-overbet-4flush.md.
 *
 * Note: inherited VillainAssumption v1.1 fields (scope, evidence, stability,
 * recognizability, counterExploit, operator, claim, consequence, narrative,
 * emotionalTrigger, quality) are present for completeness but are validated by
 * `assumptionEngine/validator.js` — not by `validateAnchor`. See `CLAUDE.md`
 * §1 inheritance contract.
 *
 * This file authors the anchor-specific extension fields (archetypeName,
 * polarity, tier, lineSequence, perceptionPrimitiveIds, gtoBaseline,
 * evDecomposition, retirementCondition, origin) to the authoritative values
 * from the seed-anchor markdown.
 */
export const EAL_SEED_01_ANCHOR = Object.freeze({
  // ─── EAL extension fields (validated by validateAnchor) ─────────────────
  schemaVersion: ANCHOR_SCHEMA_VERSION,
  archetypeName: 'Nit Over-Fold to River Overbet on 4-Flush Scare',
  polarity: 'overfold',
  tier: 2,

  lineSequence: [
    // Flop — villain call or check-call
    {
      street: 'flop',
      villainAction: { kind: 'call' },
      boardCondition: { texture: 'any' },
    },
    // Turn — hero bet ≥60% pot or check-behind-IP; villain call
    {
      street: 'turn',
      heroAction: { kind: 'bet', sizingRange: [0.6, 1.0] },
      villainAction: { kind: 'call' },
      boardCondition: { texture: 'wet' },
    },
    // River — hero overbet on 4-flush scare; villain decision
    {
      street: 'river',
      heroAction: { kind: 'bet', sizingRange: [1.0, 1.8] },
      boardCondition: { texture: 'flush-complete', scareKind: '4-flush' },
    },
  ],

  perceptionPrimitiveIds: ['PP-01'],

  gtoBaseline: {
    method: 'MDF',
    // At typical anchor sizing 1.2× pot: MDF = pot/(pot+bet) = 1/2.2 ≈ 0.4545
    // Fold rate at MDF = 1 − MDF = bet/(pot+bet) ≈ 0.5455 → rounded to 0.54
    referenceRate: 0.54,
    referenceEv: 0.04,
    notes: 'MDF at 1.2× pot ≈ 54.5% fold rate; seed anchor markdown lists 0.52 at interpolation midpoint of 1.0× (0.5) and 1.5× (0.6).',
  },

  evDecomposition: {
    // +20pp over GTO (0.72 observed − 0.52 GTO at midpoint). Attribution:
    // population-Nit-overfold baseline vs 4-flush-scare-specific cognitive response.
    statAttributable: 0.35,
    perceptionAttributable: 0.65,
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

  // ─── Inherited VillainAssumption v1.1 fields (stub; validated elsewhere) ──
  // Included for shape completeness + so the scenario can be runnable end-to-end
  // in Commit 2 once the producer+simulator chain is wired. Values lifted from
  // seed-anchor markdown §2-§6.
  id: 'anchor:nit:river:overfold:4flush',
  villainId: null,
  claim: {
    predicate: 'foldToRiverBet',
    operator: '≥',
    threshold: 0.60,
  },
  evidence: {
    sampleSize: null,
    observationCount: null,
    pointEstimate: 0.72,
    credibleInterval: { lower: 0.58, upper: 0.83, level: 0.95 },
    prior: { type: 'style', alpha: 14, beta: 10 },
    posteriorConfidence: 0.91,
    decayHalfLife: 30,
  },
  consequence: {
    deviationId: 'overbetScareVsNit',
    deviationType: 'sizing-shift',
    expectedDividend: { mean: 0.66, sd: 0.14, sharpe: 4.7, unit: 'bb per 100 trigger firings' },
    affectedHands: "hero's turn-check-and-river-bet range that missed (busted draws, blockers to flush)",
  },
  operator: {
    target: 'villain',
    transform: { actionDistributionDelta: { fold: 0.20, call: -0.18, raise: -0.02 } },
    dialCurve: 'sigmoid(k=8, floor=0.3, ceiling=0.9)',
    currentDial: 0.78,
    suppresses: [],
  },
});

// ───────────────────────────────────────────────────────────────────────────
// Scenario config — runnable by anchorScenarioRunner
// ───────────────────────────────────────────────────────────────────────────

/**
 * Tier-1 scenario configuration for EAL-SEED-01.
 *
 * Commit 1: runnable for schema-gate + GTO-math verification. End-to-end
 * predicted-vs-simulated dividend assertion requires Commit 2 wiring of:
 *   - A scare-specific Nit synthetic villain (fold 72% on flush-complete rivers
 *     to overbet sizing; fold ~48% on non-scare rivers)
 *   - Producer recipe that emits foldToRiverBet assumption from the above
 *     tendency on matching gameState
 *
 * Consumers inject `produceAssumptions` and `runPredicateScenario` at run time
 * (the scenario file intentionally does not import them — keeps the scenario
 * description decoupled from execution infrastructure).
 */
export const nitOverfoldRiver4flushScenario = {
  name: 'EAL-SEED-01 — Nit over-fold to river overbet on 4-flush scare',
  anchor: EAL_SEED_01_ANCHOR,

  // Commit 2: scare-specific Nit policy wired (was null in Commit 1).
  // NIT_SCARE_OVERFOLD produces fold rate 0.72 on `flush-complete | straight-complete`
  // rivers to bets ≥1.0× pot; 0.48 population baseline otherwise.
  villain: NIT_SCARE_OVERFOLD,

  villainTendency: {
    villainId: 'v-nit-scare-1',
    style: 'Nit',
    totalObservations: 54,
    adaptationObservations: 8,
    observedRates: {
      // Pooled Nit data on scare-completing rivers to overbet sizing
      foldToRiverBet: { rate: 0.72, n: 52, lastUpdated: '2026-04-22T19:15:00Z' },
    },
  },

  gameState: {
    street: 'river',
    position: 'OOP',
    texture: 'flush-complete',
    spr: 4,
    heroIsAggressor: true,
    betSizePot: 1.2, // typical anchor sizing (aligns with gtoContext below)
    nodeId: 'river-4flush-overbet',
  },

  sessionContext: {
    villainBBDelta: 0,
    stake: 'cash',
  },

  targetPredicate: 'foldToRiverBet',

  // GTO verification context: pot-size and bet-size at the decision node.
  // Per POKER_THEORY.md §6.2: MDF = pot/(pot+bet). Fold rate at MDF = bet/(pot+bet).
  // 1.2× pot bet against pot of 1.0 → fold rate = 1.2 / 2.2 ≈ 0.5455 → anchor's 0.54 ✓
  gtoContext: {
    potSize: 1.0,
    betSize: 1.2,
  },

  firings: 10000,
  tolerance: 0.05,
};

export default nitOverfoldRiver4flushScenario;
