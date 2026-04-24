/**
 * assumptionProducer.js — Produce VillainAssumption objects from tendency + range + game state
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Input shape:
 *   - villainTendency: VillainTendencyInput (simplified; adapter from
 *     exploitEngine/villainProfileBuilder is Commit 5/7)
 *   - gameState: current decision-node context (street, texture, spr, etc.)
 *   - sessionContext: current session-level context (villainBBDelta, stake, etc.)
 *   - options: { surface, decayHalfLife, emotionalStateProvider }
 *
 * Output:
 *   - Array of VillainAssumption objects in v1.1 shape. Each passes `validateAssumption()`.
 *     Only assumptions where `quality.actionableInDrill === true` are emitted by default;
 *     callers can pass `includeBelowThreshold: true` for research-tier exposure (schema §7.3).
 *
 * v1 recipe coverage (3 of 18 predicates — additional recipes land in Commit 4.5 / 5):
 *   - foldToRiverBet → bluff-prune deviation (Canonical Example 1)
 *   - foldToCbet → range-bet deviation (Canonical Example 3)
 *   - thinValueFrequency → value-expand deviation (Canonical Example 2)
 *
 * Beta posterior computed via normal approximation (accurate for n ≥ 20).
 * Replaced with exact incomplete-beta function in a future hardening pass.
 *
 * Imports: assumptionTypes (intra-module) + qualityGate (intra-module).
 * NO imports from exploitEngine/, rangeEngine/, or any other engine — I-AE-CIRC-1.
 */

import {
  SCHEMA_VERSION,
  DEFAULT_DECAY_HALFLIFE_DAYS,
  VILLAIN_SIDE_THRESHOLDS,
  HERO_SIDE_THRESHOLDS,
  DIAL_DEFAULTS,
} from './assumptionTypes';
import { determineActionability } from './qualityGate';
import { computeDialFromQuality } from './operator';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Produce VillainAssumption objects for a given villain + game state.
 *
 * @param {Object} villainTendency - Simplified tendency input (see docs/schema)
 * @param {Object} gameState - { street, position, texture, spr, betSizeRange, playersToAct, nodeId, ... }
 * @param {Object} [sessionContext={}] - { villainBBDelta, stake, ... }
 * @param {Object} [options={}]
 * @returns {Array} VillainAssumption[] — all actionable-in-drill by default
 */
export const produceAssumptions = (villainTendency, gameState, sessionContext = {}, options = {}) => {
  if (!villainTendency || typeof villainTendency !== 'object') return [];
  if (!gameState || typeof gameState !== 'object') return [];

  const {
    includeBelowThreshold = false,
    decayHalfLife = sessionContext?.stake === 'tournament'
      ? DEFAULT_DECAY_HALFLIFE_DAYS.tournament
      : DEFAULT_DECAY_HALFLIFE_DAYS.cash,
  } = options;

  const results = [];

  for (const recipe of Object.values(PRODUCTION_RECIPES)) {
    if (!recipe.applicable(villainTendency, gameState)) continue;

    const assumption = buildAssumption(recipe, villainTendency, gameState, sessionContext, { decayHalfLife });
    if (!assumption) continue;

    if (includeBelowThreshold || assumption.quality.actionableInDrill) {
      results.push(assumption);
    }
  }

  // Sort descending by composite so caller can take top-N.
  results.sort((a, b) => b.quality.composite - a.quality.composite);
  return results;
};

// ───────────────────────────────────────────────────────────────────────────
// Recipe infrastructure
// ───────────────────────────────────────────────────────────────────────────

/**
 * Build a VillainAssumption from the common template. Recipe-specific fields
 * (scope, consequence, operator, narrative) are supplied by the recipe via
 * template functions.
 */
const buildAssumption = (recipe, villainTendency, gameState, sessionContext, ctx) => {
  const observed = villainTendency.observedRates?.[recipe.tendencyKey];
  if (!observed || !isValidObserved(observed)) return null;

  // 1. Evidence (Bayesian posterior computation) + claim, compute posteriorConfidence
  const prior = recipe.prior(villainTendency);
  const rawEvidence = buildEvidence(observed, prior, ctx.decayHalfLife);
  const claim = recipe.claim(rawEvidence);
  const posteriorConfidence = computePosteriorConfidence(rawEvidence, claim);
  // Strip internal fields that schema doesn't include
  const evidence = {
    sampleSize: rawEvidence.sampleSize,
    observationCount: rawEvidence.observationCount,
    pointEstimate: rawEvidence.pointEstimate,
    credibleInterval: rawEvidence.credibleInterval,
    prior: rawEvidence.prior,
    posteriorConfidence,
    lastUpdated: rawEvidence.lastUpdated,
    decayHalfLife: rawEvidence.decayHalfLife,
  };

  // 2. Stability — recipe provides subscores; compositeScore computed here
  const stability = finalizeStabilityComposite(recipe.stability(villainTendency, observed));

  // 3. Recognizability, consequence
  const recognizability = recipe.recognizability(gameState);
  const consequence = recipe.consequence(villainTendency, evidence, gameState);

  // 4. CounterExploit — needs posteriorConfidence for asymmetric payoff
  const counterExploit = recipe.counterExploit(villainTendency, consequence, posteriorConfidence);

  // 5. Operator (dial filled in step 7 after quality composite)
  const operator = recipe.operator(villainTendency, gameState, recipe);

  // 6. Narrative
  const narrative = recipe.narrative(villainTendency, evidence, consequence);

  // 7. Determine actionability + composite
  const partial = { evidence, stability, recognizability, consequence, counterExploit, operator };
  const actionability = determineActionability(partial);
  operator.currentDial = computeDialFromQuality(actionability.composite, DIAL_DEFAULTS);

  const id = `${villainTendency.villainId}:${recipe.predicate}@${recipe.scopeKey(gameState)}`;

  const quality = {
    composite: actionability.composite,
    actionableInDrill: actionability.actionableInDrill,
    actionableLive: actionability.actionableLive,
    actionable: actionability.actionable,
    thresholds: {
      villainSide: { ...VILLAIN_SIDE_THRESHOLDS },
      heroSide: { ...HERO_SIDE_THRESHOLDS },
    },
    gatesPassed: actionability.gatesPassedLive,
    reason: actionability.reason,
  };

  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    villainId: villainTendency.villainId,
    claim,
    evidence,
    stability,
    recognizability,
    consequence,
    counterExploit,
    operator,
    narrative,
    quality,
    status: actionability.actionableInDrill ? 'active' : 'candidate',
    validation: { timesApplied: 0, realizedDividend: 0, calibrationGap: 0, lastValidated: null },
    // Snapshot the villain's style + key tendency rates so downstream surfaces
    // (baselineSynthesis, useCitedDecisions) can reproduce the production-time
    // context without an additional persistence layer. Additive sidecar — does
    // not alter assumption semantics.
    _villainSnapshot: {
      villainId: villainTendency.villainId,
      style: villainTendency.style ?? 'Unknown',
    },
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Evidence + Beta posterior
// ───────────────────────────────────────────────────────────────────────────

const buildEvidence = (observed, prior, decayHalfLife) => {
  const { rate, n, lastUpdated } = observed;
  const k = Math.round(rate * n);
  const posteriorAlpha = prior.alpha + k;
  const posteriorBeta = prior.beta + (n - k);
  const posteriorMean = posteriorAlpha / (posteriorAlpha + posteriorBeta);
  const posteriorSD = betaStandardDeviation(posteriorAlpha, posteriorBeta);

  // 95% CI via normal approximation (accurate for n ≥ 20; acceptable for v1)
  const ciLower = Math.max(0, posteriorMean - 1.96 * posteriorSD);
  const ciUpper = Math.min(1, posteriorMean + 1.96 * posteriorSD);

  return {
    sampleSize: n,
    observationCount: k,
    pointEstimate: rate,
    credibleInterval: { lower: ciLower, upper: ciUpper, level: 0.95 },
    prior: { type: prior.type, alpha: prior.alpha, beta: prior.beta },
    posteriorConfidence: 0, // computed by caller after claim constructed
    lastUpdated: lastUpdated || new Date().toISOString(),
    decayHalfLife,
    // Internal — not persisted per schema but used downstream for confidence computation
    _posteriorMean: posteriorMean,
    _posteriorSD: posteriorSD,
  };
};

const computePosteriorConfidence = (evidence, claim) => {
  const mean = evidence._posteriorMean;
  const sd = evidence._posteriorSD;
  if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd === 0) {
    return 0;
  }

  if (claim.operator === '<=' || claim.operator === '==') {
    // P(rate ≤ threshold) via normal approximation
    const z = (claim.threshold - mean) / sd;
    return normalCDF(z);
  }
  if (claim.operator === '>=') {
    // P(rate ≥ threshold)
    const z = (mean - claim.threshold) / sd;
    return normalCDF(z);
  }
  if (claim.operator === 'in_range' && Array.isArray(claim.threshold)) {
    const [lo, hi] = claim.threshold;
    const zHi = (hi - mean) / sd;
    const zLo = (lo - mean) / sd;
    return normalCDF(zHi) - normalCDF(zLo);
  }
  return 0;
};

const betaStandardDeviation = (alpha, beta) => {
  const n = alpha + beta;
  const variance = (alpha * beta) / (n * n * (n + 1));
  return Math.sqrt(variance);
};

/**
 * Normal CDF via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7).
 * Pure function, no dependency on a stats library.
 */
const normalCDF = (z) => {
  if (z >= 8) return 1;
  if (z <= -8) return 0;
  // Φ(z) = 0.5 × (1 + erf(z / √2))
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

const isValidObserved = (o) =>
  o != null && typeof o.rate === 'number' && o.rate >= 0 && o.rate <= 1
  && typeof o.n === 'number' && o.n > 0;

// ───────────────────────────────────────────────────────────────────────────
// Recipe: foldToRiverBet (Canonical Example 1 — bluff-prune)
// ───────────────────────────────────────────────────────────────────────────

const foldToRiverBetRecipe = {
  predicate: 'foldToRiverBet',
  tendencyKey: 'foldToRiverBet',

  applicable: (_villain, gameState) =>
    gameState.street === 'river' && gameState.heroIsAggressor === true,

  prior: (villain) => stylePriorForFoldRate(villain.style, 'river'),

  claim: (evidence) => ({
    predicate: 'foldToRiverBet',
    operator: '<=',
    threshold: 0.25, // fold rate ≤ 25% → bluff-prune justified
    scope: {
      street: 'river',
      position: 'any',
      texture: 'any',
      sprRange: [0, 100],
      betSizeRange: [0.66, 1.2],
      playersToAct: 0,
      activationFrequency: 0.04,
    },
  }),

  stability: (villain, observed) => defaultStabilityV1(villain, observed),

  recognizability: (_gameState) => ({
    triggerDescription: 'Hero has taken aggressive line to river; villain has called each street',
    conditionsCount: 2,
    heroCognitiveLoad: 'low',
    score: 0.95,
  }),

  consequence: (_villain, evidence, _gameState) => {
    // Dividend heuristic: base EV saved by dropping −EV bluff combos, scaled by
    // how far below threshold villain's observed fold rate is. Real computation
    // lands in citedDecision/ (Commit 6) via gameTree baseline. v1 scale here is
    // calibrated to produce ~0.4–1.2 bb per 100 trigger firings at typical priors.
    const belowThreshold = Math.max(0, 0.25 - evidence.pointEstimate);
    const meanBB = 0.40 + belowThreshold * 8;
    const sd = Math.max(0.15, meanBB * 0.30);
    return {
      deviationId: 'dropRiverBluffs',
      deviationType: 'bluff-prune',
      expectedDividend: {
        mean: meanBB,
        sd,
        sharpe: meanBB / sd,
        unit: 'bb per 100 trigger firings',
      },
      affectedHands: "missed-draw combos in hero's river-bet bluff range",
    };
  },

  counterExploit: (villain, consequence, posteriorConfidence) =>
    defaultCounterExploitV1(villain, consequence, posteriorConfidence),

  operator: (_villain, _gameState) => ({
    target: 'villain',
    nodeSelector: { street: 'river', action: 'hero-bet' },
    transform: {
      // Bluff pruning changes HERO's range, not villain's distribution at the node.
      // Express as zero action-distribution delta (honesty check) + range-only shift.
      actionDistributionDelta: { fold: 0, call: 0, raise: 0 },
      rangeShift: { exclude: 'missed-draw bluff combos', include: [] },
    },
    currentDial: 0, // filled by quality composite
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  }),

  narrative: (villain, evidence, _consequence) => {
    const pct = Math.round(evidence.pointEstimate * 100);
    const ciLo = Math.round(evidence.credibleInterval.lower * 100);
    const ciHi = Math.round(evidence.credibleInterval.upper * 100);
    return {
      humanStatement:
        `Villain folds to river bets only ${pct}% of the time (n=${evidence.sampleSize}, 95% CI [${ciLo}%, ${ciHi}%])`,
      citationShort: `fold-to-river ${pct}% @ n=${evidence.sampleSize}`,
      citationLong:
        `Over ${evidence.sampleSize} observed river decisions, villain folded ${evidence.observationCount}. Their style (${villain.style}) aligns with the population-level tendency. Confidence in this claim is backed by the Beta(${evidence.prior.alpha}, ${evidence.prior.beta}) prior.`,
      teachingPattern:
        "When I've barreled to river and villain has called every street, they're not folding.",
      analogAnchor: "classic station who won't fold any pair",
    };
  },

  scopeKey: (_gameState) => 'river:aggressor',
};

// ───────────────────────────────────────────────────────────────────────────
// Recipe: foldToCbet (Canonical Example 3 — range-bet on overfolder)
// ───────────────────────────────────────────────────────────────────────────

const foldToCbetRecipe = {
  predicate: 'foldToCbet',
  tendencyKey: 'foldToCbet',

  applicable: (_villain, gameState) =>
    gameState.street === 'flop' && gameState.heroIsAggressor === true && gameState.texture === 'dry',

  prior: (villain) => stylePriorForFoldRate(villain.style, 'flop'),

  claim: (_evidence) => ({
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
      activationFrequency: 0.20,
    },
  }),

  stability: (villain, observed) => defaultStabilityV1(villain, observed),

  recognizability: (_gameState) => ({
    triggerDescription: 'Dry flop after preflop flat call',
    conditionsCount: 2,
    heroCognitiveLoad: 'low',
    score: 0.88,
  }),

  consequence: (_villain, evidence, _gameState) => {
    const aboveThreshold = Math.max(0, evidence.pointEstimate - 0.70);
    const meanBB = 0.45 + aboveThreshold * 6;
    const sd = Math.max(0.15, meanBB * 0.28);
    return {
      deviationId: 'rangeBetDryFlops',
      deviationType: 'range-bet',
      expectedDividend: {
        mean: meanBB,
        sd,
        sharpe: meanBB / sd,
        unit: 'bb per 100 trigger firings',
      },
      affectedHands: "hero's entire range on dry flops after flat-call preflop",
    };
  },

  counterExploit: (villain, consequence, posteriorConfidence) =>
    defaultCounterExploitV1(villain, consequence, posteriorConfidence),

  operator: (_villain, _gameState) => ({
    target: 'villain',
    nodeSelector: { street: 'flop', texture: 'dry', heroPosition: 'IP', heroAction: 'cbet' },
    transform: {
      actionDistributionDelta: { fold: 0.15, call: -0.12, raise: -0.03 },
      sizingShift: { from: [0.5, 0.75], to: [0.25, 0.33] },
    },
    currentDial: 0,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  }),

  narrative: (villain, evidence, _consequence) => {
    const pct = Math.round(evidence.pointEstimate * 100);
    return {
      humanStatement: `Villain folds to cbet ${pct}% on dry flops (n=${evidence.sampleSize})`,
      citationShort: `fold-to-cbet ${pct}% @ n=${evidence.sampleSize}`,
      citationLong: `Over ${evidence.sampleSize} observed dry-flop cbet decisions, villain folded ${evidence.observationCount}.`,
      teachingPattern: 'Dry flop + flat caller = small cbet your range. Do not need a hand.',
      analogAnchor: villain.style === 'Nit' ? 'classic nit giving up air too easily' : undefined,
    };
  },

  scopeKey: (_gameState) => 'flop:dry:IP',
};

// ───────────────────────────────────────────────────────────────────────────
// Recipe: thinValueFrequency (Canonical Example 2 — value expansion vs station)
// ───────────────────────────────────────────────────────────────────────────

const thinValueFrequencyRecipe = {
  predicate: 'thinValueFrequency',
  tendencyKey: 'callFrequencyVsSmallBet',

  applicable: (_villain, gameState) =>
    gameState.street === 'turn' && gameState.texture === 'paired'
    && gameState.heroIsAggressor === true,

  prior: (villain) => styleCallFrequencyPrior(villain.style),

  claim: (_evidence) => ({
    predicate: 'thinValueFrequency',
    operator: '>=',
    threshold: 0.60,
    scope: {
      street: 'turn',
      position: 'any',
      texture: 'paired',
      sprRange: [3, 8],
      betSizeRange: [0.5, 0.75],
      playersToAct: 0,
      activationFrequency: 0.06,
    },
  }),

  stability: (villain, observed) => defaultStabilityV1(villain, observed),

  recognizability: (_gameState) => ({
    triggerDescription: 'Paired turn; hero has TPTK or better; villain is station-type',
    conditionsCount: 3,
    heroCognitiveLoad: 'medium',
    score: 0.78,
  }),

  consequence: (_villain, evidence, _gameState) => {
    const aboveThreshold = Math.max(0, evidence.pointEstimate - 0.60);
    const meanBB = 0.40 + aboveThreshold * 5;
    const sd = Math.max(0.14, meanBB * 0.30);
    return {
      deviationId: 'expandThinValueOnPairedTurns',
      deviationType: 'value-expand',
      expectedDividend: {
        mean: meanBB,
        sd,
        sharpe: meanBB / sd,
        unit: 'bb per 100 trigger firings',
      },
      affectedHands: 'medium-to-strong made hands on paired middle-wet turns',
    };
  },

  counterExploit: (villain, consequence, posteriorConfidence) =>
    defaultCounterExploitV1(villain, consequence, posteriorConfidence),

  operator: (_villain, _gameState) => ({
    target: 'villain',
    nodeSelector: { street: 'turn', texture: 'paired', heroAction: 'bet', betSize: [0.5, 0.75] },
    transform: {
      actionDistributionDelta: { fold: -0.12, call: 0.15, raise: -0.03 },
    },
    currentDial: 0,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  }),

  narrative: (villain, evidence, _consequence) => {
    const pct = Math.round(evidence.pointEstimate * 100);
    return {
      humanStatement:
        `Villain calls ≥ 60% on paired turns vs 2/3-pot bets (observed ${pct}%, n=${evidence.sampleSize})`,
      citationShort: `call-paired-turn ${pct}% @ n=${evidence.sampleSize}`,
      citationLong:
        `Over ${evidence.sampleSize} observed decisions facing bets on paired turns, villain called ${evidence.observationCount}. Their range is sticky here; value bets print with TPTK-strength hands.`,
      teachingPattern: 'Paired turn + station villain + top pair = bet. Balanced play checks; they do not raise.',
      analogAnchor: villain.style === 'Fish' ? 'station who will call with any pair' : undefined,
    };
  },

  scopeKey: (_gameState) => 'turn:paired:aggressor',
};

// ───────────────────────────────────────────────────────────────────────────
// Recipe: foldToTurnBarrel — double-barrel extension vs over-folder
// ───────────────────────────────────────────────────────────────────────────

const foldToTurnBarrelRecipe = {
  predicate: 'foldToTurnBarrel',
  tendencyKey: 'foldToTurnBarrel',

  applicable: (_villain, gameState) =>
    gameState.street === 'turn' && gameState.heroIsAggressor === true,

  prior: (villain) => stylePriorForFoldRate(villain.style, 'turn'),

  claim: (_evidence) => ({
    predicate: 'foldToTurnBarrel',
    operator: '>=',
    threshold: 0.60, // fold rate ≥ 60% → double-barrel extension justified
    scope: {
      street: 'turn',
      position: 'any',
      texture: 'any',
      sprRange: [2, 8],
      betSizeRange: [0.5, 0.85],
      playersToAct: 0,
      activationFrequency: 0.12,
    },
  }),

  stability: (villain, observed) => defaultStabilityV1(villain, observed),

  recognizability: (_gameState) => ({
    triggerDescription: 'Hero cbet flop + facing villain call; turn reached heads-up',
    conditionsCount: 2,
    heroCognitiveLoad: 'low',
    score: 0.85,
  }),

  consequence: (_villain, evidence, _gameState) => {
    // Dividend scales with how far over-folding the villain is; extension of
    // bluff barrels into fold equity is pure EV per POKER_THEORY.md §3.3.
    const aboveThreshold = Math.max(0, evidence.pointEstimate - 0.60);
    const meanBB = 0.50 + aboveThreshold * 7;
    const sd = Math.max(0.17, meanBB * 0.30);
    return {
      deviationId: 'extendTurnBarrelRange',
      deviationType: 'line-change',
      expectedDividend: {
        mean: meanBB,
        sd,
        sharpe: meanBB / sd,
        unit: 'bb per 100 trigger firings',
      },
      affectedHands: "hero's semi-bluff + air floats that would normally give up turn",
    };
  },

  counterExploit: (villain, consequence, posteriorConfidence) =>
    defaultCounterExploitV1(villain, consequence, posteriorConfidence),

  operator: (_villain, _gameState) => ({
    target: 'villain',
    nodeSelector: { street: 'turn', heroAction: 'barrel' },
    transform: {
      // Villain overfolds turn → shift fold up, call down, raise down.
      actionDistributionDelta: { fold: 0.12, call: -0.10, raise: -0.02 },
    },
    currentDial: 0,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  }),

  narrative: (villain, evidence, _consequence) => {
    const pct = Math.round(evidence.pointEstimate * 100);
    return {
      humanStatement: `Villain folds to turn barrel ${pct}% (n=${evidence.sampleSize})`,
      citationShort: `fold-to-turn ${pct}% @ n=${evidence.sampleSize}`,
      citationLong: `Over ${evidence.sampleSize} observed turn-barrel decisions, villain folded ${evidence.observationCount}. Their flop-call range is dominated by weak pairs + gutshots that do not continue turn.`,
      teachingPattern: "They called flop light and folded turn. Keep barreling — don't give up your air.",
      analogAnchor: villain.style === 'Nit' ? "passive Nit who flop-peels and turn-bails" : undefined,
    };
  },

  scopeKey: (_gameState) => 'turn:aggressor',
};

// ───────────────────────────────────────────────────────────────────────────
// Recipe: cbetFrequency — floating/check-raising vs range-bettor
// ───────────────────────────────────────────────────────────────────────────

const cbetFrequencyRecipe = {
  predicate: 'cbetFrequency',
  tendencyKey: 'cbetFrequency',

  applicable: (_villain, gameState) =>
    gameState.street === 'flop'
    && gameState.heroIsAggressor === false
    && gameState.villainIsAggressor === true,

  prior: (villain) => styleCbetFrequencyPrior(villain.style),

  claim: (_evidence) => ({
    predicate: 'cbetFrequency',
    operator: '>=',
    threshold: 0.85, // cbet rate ≥ 85% → villain range-bets, range is uncapped+weak
    scope: {
      street: 'flop',
      position: 'any',
      texture: 'any',
      sprRange: [3, 15],
      betSizeRange: [0.25, 0.66],
      playersToAct: 0,
      activationFrequency: 0.18,
    },
  }),

  stability: (villain, observed) => defaultStabilityV1(villain, observed),

  recognizability: (_gameState) => ({
    triggerDescription: 'Hero called preflop; villain is PFA and bet flop',
    conditionsCount: 2,
    heroCognitiveLoad: 'medium',
    score: 0.80,
  }),

  consequence: (_villain, evidence, _gameState) => {
    // Dividend scales with how far over-c-betting the villain is. Beyond
    // population ~75%, each extra 5% of cbet frequency meaningfully widens
    // hero's float + check-raise range. POKER_THEORY.md §3.4 (range width).
    const aboveThreshold = Math.max(0, evidence.pointEstimate - 0.85);
    const meanBB = 0.35 + aboveThreshold * 10;
    const sd = Math.max(0.14, meanBB * 0.32);
    return {
      deviationId: 'floatWiderVsRangeBettor',
      deviationType: 'line-change',
      expectedDividend: {
        mean: meanBB,
        sd,
        sharpe: meanBB / sd,
        unit: 'bb per 100 trigger firings',
      },
      affectedHands: "hero's backdoor draws + weak pairs that are normally fold/check-call",
    };
  },

  counterExploit: (villain, consequence, posteriorConfidence) =>
    defaultCounterExploitV1(villain, consequence, posteriorConfidence),

  operator: (_villain, _gameState) => ({
    target: 'villain',
    nodeSelector: { street: 'flop', heroAction: 'float-or-check-raise' },
    transform: {
      // When hero floats, villain's uncapped-weak range folds more on turn.
      // Express the downstream state: villain fold distribution increases when
      // the range is dominated by air.
      actionDistributionDelta: { fold: 0.10, call: -0.08, raise: -0.02 },
    },
    currentDial: 0,
    dialFloor: 0.3,
    dialCeiling: 0.9,
    suppresses: [],
  }),

  narrative: (villain, evidence, _consequence) => {
    const pct = Math.round(evidence.pointEstimate * 100);
    return {
      humanStatement: `Villain cbets ${pct}% of flops (n=${evidence.sampleSize}) — range-bettor`,
      citationShort: `cbet ${pct}% @ n=${evidence.sampleSize}`,
      citationLong: `Over ${evidence.sampleSize} observed opportunities, villain cbet ${evidence.observationCount} flops. Their cbet range is their entire preflop range — not range-narrowed for board texture.`,
      teachingPattern: 'They cbet everything. Float wider IP with backdoors; check-raise medium-wet boards.',
      analogAnchor: villain.style === 'LAG' ? "reg who range-bets and barrels air" : undefined,
    };
  },

  scopeKey: (_gameState) => 'flop:defender',
};

// ───────────────────────────────────────────────────────────────────────────
// Recipe registry
// ───────────────────────────────────────────────────────────────────────────

/**
 * PRODUCTION_RECIPES: keyed by recipe identifier, iterated by produceAssumptions.
 * Commit 4 shipped 3 of 18+ predicates; Session 18 adds foldToTurnBarrel +
 * cbetFrequency. Extending is a bounded task per CLAUDE.md "4-file touch for
 * new predicate" rule:
 *   1. Add entry to PREDICATE_KEYS (done in Commit 3).
 *   2. Add recipe here.
 *   3. Add narrative template (inline or separate file in narratives/).
 *   4. Add Tier-1 scenario under __sim__/scenarios/.
 */
export const PRODUCTION_RECIPES = Object.freeze({
  foldToRiverBet: foldToRiverBetRecipe,
  foldToCbet: foldToCbetRecipe,
  thinValueFrequency: thinValueFrequencyRecipe,
  foldToTurnBarrel: foldToTurnBarrelRecipe,
  cbetFrequency: cbetFrequencyRecipe,
});

// Export assumption builder for targeted testing
export const buildAssumptionFromRecipe = buildAssumption;

// ───────────────────────────────────────────────────────────────────────────
// Shared recipe helpers (defaults)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Style-conditioned prior for fold-rate predicates.
 * Priors reflect live-pool typical behavior (memory: project_villain_model_assumptions_fix).
 */
const stylePriorForFoldRate = (style, street) => {
  // Priors as Beta(α, β) where α/(α+β) is the expected fold rate.
  // Effective-sample weight ~ α+β = 10 — matches rangeEngine's PRIOR_WEIGHT convention
  // (RANGE_ENGINE_DESIGN.md §4.2). Light prior lets ~20+ real observations dominate.
  const base = {
    Fish:    { alpha: 4, beta: 7 }, // fish fold ~36% (mean α/(α+β) = 4/11)
    Nit:     { alpha: 7, beta: 5 }, // nit folds ~58%
    LAG:     { alpha: 4, beta: 6 }, // lag folds ~40%
    TAG:     { alpha: 5, beta: 5 }, // tag folds ~50%
    Unknown: { alpha: 5, beta: 6 }, // population ~45%
  }[style] || { alpha: 5, beta: 6 };
  return {
    type: style === 'Unknown' ? 'population' : 'style',
    alpha: base.alpha,
    beta: base.beta,
  };
};

/**
 * Style-conditioned prior for villain cbet frequency.
 * Population cbet ~70%; LAG + aggressive regs lean higher, Nits lean lower.
 * Same PRIOR_WEIGHT ≈ 10 convention.
 */
const styleCbetFrequencyPrior = (style) => {
  const base = {
    Fish:    { alpha: 5, beta: 5 }, // fish cbet irregular ~50%
    Nit:     { alpha: 4, beta: 6 }, // nit selectively cbets value ~40%
    LAG:     { alpha: 8, beta: 3 }, // lag range-bets ~73%
    TAG:     { alpha: 6, beta: 4 }, // tag ~60%
    Unknown: { alpha: 6, beta: 4 }, // population lean
  }[style] || { alpha: 6, beta: 4 };
  return { type: style === 'Unknown' ? 'population' : 'style', alpha: base.alpha, beta: base.beta };
};

/**
 * Style-conditioned prior for call-frequency-vs-bet (inverse of fold rate).
 * Same PRIOR_WEIGHT ≈ 10 convention.
 */
const styleCallFrequencyPrior = (style) => {
  const base = {
    Fish:    { alpha: 7, beta: 4 }, // fish calls ~64%
    Nit:     { alpha: 5, beta: 6 }, // nit calls ~45%
    LAG:     { alpha: 6, beta: 5 },
    TAG:     { alpha: 5, beta: 5 },
    Unknown: { alpha: 5, beta: 5 },
  }[style] || { alpha: 5, beta: 5 };
  return { type: style === 'Unknown' ? 'population' : 'style', alpha: base.alpha, beta: base.beta };
};

/**
 * v1 default stability — simple heuristic based on sample size.
 * Commit 5+ will introduce real slice-analysis stability scoring.
 */
const defaultStabilityV1 = (villain, observed) => {
  const n = observed.n;
  // Scale stability by sample size (confidence proxy); reach 1.0 at n ≥ 100.
  const sessionStability = Math.min(1.0, 0.5 + n / 200);
  return {
    acrossSessions: sessionStability,
    acrossTextures: n >= 30 ? Math.min(1.0, 0.6 + n / 300) : null,
    acrossStackDepths: n >= 30 ? Math.min(1.0, 0.6 + n / 300) : null,
    acrossStreetContext: n >= 30 ? Math.min(1.0, 0.6 + n / 300) : null,
    compositeScore: null, // computed below
    nonNullSubscoreCount: 0, // computed below
  };
};

/**
 * v1 default counterExploit — heuristic from style + dividend magnitude.
 * Commit 5+ will introduce real adaptation-history scoring.
 *
 * @param {Object} villain - VillainTendencyInput
 * @param {Object} consequence - Consequence with expectedDividend
 * @param {number} [posteriorConfidence=0.5] - P(claim true) from evidence (used in asymmetricPayoff)
 */
const defaultCounterExploitV1 = (villain, consequence, posteriorConfidence = 0.5) => {
  const styleResistance = {
    Fish: 0.88,
    LP: 0.85,
    Nit: 0.72,
    LAG: 0.55,
    TAG: 0.50,
    Reg: 0.45,
    Unknown: 0.70,
  }[villain.style] || 0.70;

  const adaptationObs = villain.adaptationObservations || 0;
  const resistanceConfidence = Math.min(1.0, adaptationObs / 15);

  // If confidence in resistance is low, clamp resistance to conservative default per schema §1.6.
  const resistanceScore = resistanceConfidence < 0.5
    ? Math.min(0.65, styleResistance)
    : styleResistance;

  const dividend = consequence.expectedDividend.mean;
  const adjustmentCost = dividend * 0.3;
  // Asymmetric payoff per schema v1.1 §1.6 formula:
  //   E[dividend|true] × P(true) × resistance
  //   − E[cost|false] × P(false)
  //   − E[counter-exploit cost] × (1 − resistance)
  const pTrue = Math.min(1, Math.max(0, posteriorConfidence));
  const pFalse = 1 - pTrue;
  const asymmetricPayoff =
      dividend * pTrue * resistanceScore
    - adjustmentCost * pFalse
    - adjustmentCost * (1 - resistanceScore);

  return {
    resistanceScore,
    resistanceConfidence,
    resistanceSources: [
      {
        factor: 'style-conditioned',
        weight: 0.7,
        contribution: styleResistance * 0.7,
        observationCount: villain.totalObservations || 0,
      },
      {
        factor: 'adaptationHistory',
        weight: 0.3,
        contribution: resistanceConfidence * 0.3,
        observationCount: adaptationObs,
      },
    ],
    adjustmentCost,
    asymmetricPayoff,
  };
};

// Export helpers for targeted testing
export const __testing__ = {
  stylePriorForFoldRate,
  styleCallFrequencyPrior,
  defaultStabilityV1,
  defaultCounterExploitV1,
  normalCDF,
  betaStandardDeviation,
};

// ───────────────────────────────────────────────────────────────────────────
// Post-processing: finalize stability composite + counterExploit asymmetric payoff
// ───────────────────────────────────────────────────────────────────────────

/**
 * After evidence.posteriorConfidence is computed, re-derive counterExploit
 * asymmetricPayoff using the actual P(claim true).
 *
 * Exported to allow producer + tests to share the logic.
 */
export const finalizeStabilityComposite = (stability) => {
  const subscores = [
    stability.acrossSessions,
    stability.acrossTextures,
    stability.acrossStackDepths,
    stability.acrossStreetContext,
  ];
  const nonNull = subscores.filter((v) => v !== null && v !== undefined);
  if (nonNull.length === 0) {
    stability.compositeScore = null;
    stability.nonNullSubscoreCount = 0;
    return stability;
  }
  const geoMean = Math.pow(nonNull.reduce((a, b) => a * Math.max(b, 0.001), 1), 1 / nonNull.length);
  const coverage = Math.sqrt(nonNull.length / 4);
  stability.compositeScore = geoMean * coverage;
  stability.nonNullSubscoreCount = nonNull.length;
  return stability;
};
