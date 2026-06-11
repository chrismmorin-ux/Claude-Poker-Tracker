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
import { buildSeedQuality } from '../seedQuality';

// ───────────────────────────────────────────────────────────────────────────
// Anchor under test — EAL-SEED-04 (candidate)
// ───────────────────────────────────────────────────────────────────────────

const SEED_04_BASE = {
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

  // Inherited v1.1 fields (full conformance per WS-218; transcribed from
  // seed-anchor markdown §1-§8)
  id: 'anchor:tag:flop:overfold:donk-wet',
  // Template anchor: pooled per-style claim (markdown §2).
  villainId: 'population:TAG',
  claim: {
    predicate: 'foldVsFlopDonkWetConnected',
    operator: '>=',
    threshold: 0.55,
    // markdown §1 scope predicates
    scope: {
      street: 'flop',
      position: 'OOP',
      texture: 'wet',
      sprRange: [8, 15],
      betSizeRange: [0.33, 0.50],
      playersToAct: 0,
      heroLineType: 'donk',
      activationFrequency: 0.008,
    },
  },
  evidence: {
    sampleSize: 0,
    observationCount: 0,
    pointEstimate: 0.64,
    credibleInterval: { lower: 0.48, upper: 0.78, level: 0.95 },
    prior: { type: 'style', alpha: 11, beta: 13 },
    // INTENTIONAL: below v1.1 §7.1 ≥0.80 gate — forces sub-threshold status
    posteriorConfidence: 0.78,
    lastUpdated: '2026-04-24T12:00:00Z',
    decayHalfLife: 30,
  },
  // markdown: all subscores pending at authoring.
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
    triggerDescription: 'style=TAG + wet-connected board + hero donked + small sizing + HU',
    conditionsCount: 5,
    heroCognitiveLoad: 'medium',
    score: 0.65,
  },
  consequence: {
    deviationId: 'donkBluffVsTagWetConnected',
    // markdown §6 says "sizing-shift" — the previous 'line-shift' value was
    // code drift outside the DEVIATION_TYPES enum, caught by WS-218 wiring.
    deviationType: 'sizing-shift',
    expectedDividend: { mean: 0.58, sd: 0.22, sharpe: 2.6, unit: 'bb per 100 trigger firings' },
    affectedHands: "hero's donking range: paired low cards, open-enders, gutshots with equity",
  },
  // markdown §6 counterExploit (asymmetricPayoff ≈ 0.00 — fails gate by design;
  // this seed exercises the schema at its failing-gate edge)
  counterExploit: {
    resistanceScore: 0.55,
    resistanceConfidence: 0.45,
    resistanceSources: [
      { factor: 'style-conditioned', weight: 0.6, contribution: 0.33, observationCount: 0 },
      { factor: 'adaptationHistory', weight: 0.4, contribution: 0.22, observationCount: 0 },
    ],
    adjustmentCost: 0.35,
    asymmetricPayoff: 0.0,
  },
  operator: {
    target: 'villain',
    // markdown §6 operator nodeSelector
    nodeSelector: {
      street: 'flop',
      texture: 'wet',
      villainStyle: 'TAG',
      heroLineType: 'donk',
      heroPosition: 'OOP',
      betSize: [0.33, 0.50],
    },
    transform: { actionDistributionDelta: { fold: 0.16, call: -0.14, raise: -0.02 } },
    dialCurve: 'sigmoid(k=8, floor=0.3, ceiling=0.9)',
    currentDial: 0.55,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  },
  // markdown §8 narrative
  narrative: {
    humanStatement: 'TAGs fold to wet-connected-flop donks from OOP at ~64% (CI [48%, 78%]), vs ~32% GTO-balanced; Phase 1 anchor is SUB-ACTIONABLE (confidence 0.78 < 0.80 gate)',
    citationShort: 'TAG donk-fold 64% wet (CANDIDATE, under-confident)',
    citationLong: 'Observed TAG fold rate to small flop donks on wet connected boards is elevated ~32pp over the GTO-calibrated rate of 32%. The edge is large if real, but rests almost entirely on a perception-primitive claim (PP-04, TAGs read off-script aggression as value-indicating) that has not been empirically validated. The Phase 1 sample is insufficient to pass confidence gate (posterior 0.78 < 0.80); counter-exploit cost is high because TAGs adapt quickly. Net asymmetric payoff after resistance ≈ 0.00 bb. Anchor ships in Phase 1 as CANDIDATE status — non-firing — to exercise the schema at its failing-gate edge. Either data promotes it in Phase 2 or it retires without firing.',
    teachingPattern: 'Caveat: the claim that TAGs overfold donks is lightly-evidenced. If you’re going to exploit it, track fold rates yourself and promote to active when your personal data supports it.',
    analogAnchor: 'a theoretical exploit that exists in pattern-recognition but hasn’t been confirmed in the wild',
    concept: 'POKER_THEORY.md §5.6 (fold equity) — with caveat on sample size',
  },
  // v1.1 §1.11 calibration tracking — no Tier 1 or Tier 2 validation at authoring.
  validation: { tier1: null, tier2: null },
};

export const EAL_SEED_04_ANCHOR = Object.freeze({
  ...SEED_04_BASE,
  // §1.10 quality derived via the engine's own gate evaluator (seedQuality.js);
  // honestly fails the confidence gate (0.78 < 0.80) — candidate status consistent.
  quality: buildSeedQuality(SEED_04_BASE),
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
