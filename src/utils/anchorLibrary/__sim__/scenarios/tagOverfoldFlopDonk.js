/**
 * scenarios/tagOverfoldFlopDonk.js — EAL-SEED-04 Tier-1 scenario (candidate non-firing)
 *
 * Validates math integrity of the TAG-over-fold-to-flop-donk-on-wet-connected anchor.
 * Per `seed-anchors/04-tag-overfold-flop-donk-wet-connected.md` — **intentional
 * failing-gate stress test**, ships as `status: 'candidate'` non-firing per
 * Session 1 Decisions Log + gate3-owner-interview §PP-04-speculative-acceptance.
 *
 * Why this scenario exists: it exercises the schema-for-failing-anchors pathway.
 * PP-04 is the most-likely-to-invalidate primitive in the Phase 1 library;
 * posteriorConfidence is 0.78 (below the ≥0.80 v1.1 gate). The anchor SHOULD
 * validate as schema-correct (tier=2, all required fields present, invariants
 * honored) but its consumption path on live/drill surfaces is blocked by the
 * v1.1 quality gate — that blocking happens at the surface layer, not in
 * schema validation.
 *
 * Commit 2 scope: schema gate + GTO math verification (range-balance method is
 * deferred by the runner).
 * Commit 2.5 scope: wire to producer + verify that posteriorConfidence < 0.80
 * produces sub-threshold assumption that does NOT gate for live/drill surfaces.
 */

import { ANCHOR_SCHEMA_VERSION } from '../../validateAnchor';
import { TAG_OFFSCRIPT_VALUE_READ } from '../syntheticVillains';

// ───────────────────────────────────────────────────────────────────────────
// Anchor under test — EAL-SEED-04 (candidate)
// ───────────────────────────────────────────────────────────────────────────

export const EAL_SEED_04_ANCHOR = Object.freeze({
  schemaVersion: ANCHOR_SCHEMA_VERSION,
  archetypeName: 'TAG Over-Fold to Flop Donk on Wet Connected Board',
  polarity: 'overfold',
  tier: 2,

  lineSequence: [
    {
      street: 'preflop',
      heroAction: { kind: 'call' }, // hero flats PFA's open
      villainAction: { kind: 'raise' },
    },
    {
      street: 'flop',
      heroAction: { kind: 'bet', sizingRange: [0.33, 0.50] }, // hero donks OOP
      boardCondition: { texture: 'wet' },
    },
  ],

  perceptionPrimitiveIds: ['PP-04'],

  gtoBaseline: {
    method: 'range-balance',
    referenceRate: 0.32,
    referenceEv: 0.05,
    notes: 'Defender MDF vs 0.4× pot donk = 71% call → fold ≤ 29%. Range-balance analysis: TAG PFR range has nuts advantage on wet connected → GTO fold ~30-35%.',
  },

  evDecomposition: {
    // Seed-04 §5: 15/85 split — claim is almost entirely perception-driven (PP-04 load-bearing).
    statAttributable: 0.15,
    perceptionAttributable: 0.85,
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

  // INTENTIONAL: anchor ships as candidate non-firing per S1 design decision.
  // The schema accepts candidate status; the v1.1 quality-gate (posteriorConfidence ≥ 0.80)
  // is checked at the surface layer — not here in schema validation.
  status: 'candidate',

  // Inherited v1.1 fields
  id: 'anchor:tag:flop:overfold:donk-wet',
  villainId: null,
  claim: {
    predicate: 'foldVsFlopDonkWetConnected',
    operator: '≥',
    threshold: 0.55,
  },
  evidence: {
    sampleSize: null,
    observationCount: null,
    pointEstimate: 0.64,
    credibleInterval: { lower: 0.48, upper: 0.78, level: 0.95 },
    prior: { type: 'style', alpha: 11, beta: 13 },
    // INTENTIONAL: below v1.1 §7.1 ≥0.80 gate — forces sub-threshold status
    posteriorConfidence: 0.78,
    decayHalfLife: 30,
  },
  consequence: {
    deviationId: 'donkBluffVsTagWetConnected',
    deviationType: 'line-shift',
    expectedDividend: { mean: 0.58, sd: 0.22, sharpe: 2.6, unit: 'bb per 100 trigger firings' },
    affectedHands: "hero's donking range: paired low cards, open-enders, gutshots with equity",
  },
  operator: {
    target: 'villain',
    transform: { actionDistributionDelta: { fold: 0.16, call: -0.14, raise: -0.02 } },
    dialCurve: 'sigmoid(k=8, floor=0.3, ceiling=0.9)',
    currentDial: 0.55,
    suppresses: [],
  },
});

// ───────────────────────────────────────────────────────────────────────────
// Scenario config
// ───────────────────────────────────────────────────────────────────────────

export const tagOverfoldFlopDonkScenario = {
  name: 'EAL-SEED-04 — TAG over-fold to flop donk on wet connected (candidate non-firing)',
  anchor: EAL_SEED_04_ANCHOR,
  villain: TAG_OFFSCRIPT_VALUE_READ,

  villainTendency: {
    villainId: 'v-tag-donk-1',
    style: 'TAG',
    totalObservations: 33,
    adaptationObservations: 5,
    observedRates: {
      foldVsFlopDonkWetConnected: {
        rate: 0.64,
        n: 19,
        lastUpdated: '2026-04-22T22:00:00Z',
      },
    },
  },

  gameState: {
    street: 'flop',
    position: 'PFA', // TAG is PFA; hero donked OOP
    texture: 'wet',
    spr: 11,
    heroIsAggressor: false,
    heroLineType: 'donk',
    betSizePot: 0.40,
    nodeId: 'flop-tag-vs-donk-wet',
  },

  sessionContext: {
    villainBBDelta: 0,
    stake: 'cash',
  },

  targetPredicate: 'foldVsFlopDonkWetConnected',

  // range-balance method — runner defers GTO verification
  gtoContext: {
    potSize: 1.0,
    betSize: 0.40,
  },

  firings: 10000,
  tolerance: 0.05,
};

export default tagOverfoldFlopDonkScenario;
