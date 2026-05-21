/**
 * silhouettePrototypes.js — Feature signatures for the 5 silhouette prototypes.
 *
 * Each prototype is defined by:
 *   - `targets`: target value for each feature (the prototype's location in
 *     feature-space).
 *   - `weights`: importance weight for each feature (how load-bearing this
 *     feature is for identifying the prototype).
 *
 * These are CALIBRATION CONSTANTS, not learned weights. They were
 * hand-calibrated against fixture tests of canonical example ranges
 * (UTG-open / 3-bet / BTN-open / suited-only / 50% diffuse). Tweaking
 * a target requires re-running the fixture suite.
 *
 * Prototype names match the SLS Gate 2 roundtable catalog
 * (`docs/projects/poker-shape-language/roundtable.md` line 22):
 *   Oval / Barbell / Triangle / Comb / Cloud
 *
 * Anti-pattern refused: these names are OUTPUTS of the classifier; they
 * are NEVER used as inputs to villain modeling or exploit generation.
 * Per `feedback_first_principles_decisions.md` + POKER_THEORY.md §7.
 *
 * SLS Stream B1 — WS-041 / SPR-082.
 */

/**
 * The 5 silhouette labels. Order matches the SLS catalog at
 * `docs/projects/poker-shape-language/roundtable.md` line 22 +
 * `src/constants/shapeMasteryConstants.js` SHAPE_DESCRIPTOR_CATALOG[0]
 * sub-prototypes.
 */
export const SILHOUETTE_LABELS = Object.freeze([
  'oval',
  'barbell',
  'triangle',
  'comb',
  'cloud',
]);

/**
 * Compound label fires when the top-2 prototype probabilities are within
 * `COMPOUND_DELTA` of each other after softmax normalization. Tuned at
 * 0.15 for v1 per the plan-mode decision; revisit after live observation.
 */
export const COMPOUND_DELTA = 0.15;

/**
 * Per-feature signature for each prototype. All target values are in the
 * natural feature scale (the same scale that `gridFeatures.js` returns).
 *
 * `weight` is unitless importance; sum across features doesn't need to
 * normalize. Distance contribution is `weight * ((x - target) / scale)^2`
 * where `scale` is the feature's natural standard deviation in the
 * fixture corpus.
 */
const FEATURE_SCALES = Object.freeze({
  rangeWidthPct: 0.15,        // ~15pp natural variation
  premiumMassFraction: 0.25,
  rankSumMean: 4,             // rank-sum stdev in fixtures
  rankSumVariance: 12,
  bimodality: 0.2,
  suitedAsymmetry: 0.3,
  wedgeMonotonicity: 0.2,
  diagonalDominance: 0.15,
  entropy: 0.15,
  contiguity: 0.2,
});

/**
 * Oval — condensed, tight EP-style range. UTG-open canonical.
 *
 * Characteristics: small range, concentrated at premium corner, high
 * monotonicity, low bimodality, moderate-high contiguity.
 */
const OVAL = Object.freeze({
  id: 'oval',
  displayName: 'Oval',
  morphology: 'condensed',
  targets: Object.freeze({
    rangeWidthPct: 0.1,
    premiumMassFraction: 0.7,
    rankSumMean: 18,
    rankSumVariance: 15,
    bimodality: 0.0,
    suitedAsymmetry: 0.4,
    wedgeMonotonicity: 0.75,
    diagonalDominance: 0.35,
    entropy: 0.55,
    contiguity: 0.7,
  }),
  weights: Object.freeze({
    rangeWidthPct: 1.2,
    premiumMassFraction: 1.8,
    rankSumMean: 1.0,
    rankSumVariance: 0.8,
    bimodality: 1.2,           // low-bimodality distinguishes Oval from Barbell
    suitedAsymmetry: 0.3,
    wedgeMonotonicity: 1.0,
    diagonalDominance: 0.5,
    entropy: 1.2,              // low-entropy distinguishes Oval from Cloud
    contiguity: 1.0,
  }),
});

/**
 * Barbell — polarized 3-bet style. Mass at top + speculative cluster,
 * with a gap in the middle.
 *
 * Bimodality is the load-bearing distinguisher.
 */
const BARBELL = Object.freeze({
  id: 'barbell',
  displayName: 'Barbell',
  morphology: 'polarized',
  targets: Object.freeze({
    rangeWidthPct: 0.06,
    premiumMassFraction: 0.5,
    rankSumMean: 16,
    rankSumVariance: 30,
    bimodality: 0.4,
    suitedAsymmetry: 0.4,
    wedgeMonotonicity: 0.4,
    diagonalDominance: 0.35,
    entropy: 0.45,
    contiguity: 0.3,
  }),
  weights: Object.freeze({
    rangeWidthPct: 0.8,
    premiumMassFraction: 0.6,
    rankSumMean: 0.4,
    rankSumVariance: 1.2,
    bimodality: 3.5,            // primary distinguisher
    suitedAsymmetry: 0.3,
    wedgeMonotonicity: 1.8,     // low-monotonicity (gaps) is also load-bearing
    diagonalDominance: 0.4,
    entropy: 0.6,
    contiguity: 1.0,
  }),
});

/**
 * Triangle — linear/wedge range. BTN-open style. Continuous mass
 * tapering from premium corner outward.
 *
 * Wedge-monotonicity is the load-bearing distinguisher.
 */
const TRIANGLE = Object.freeze({
  id: 'triangle',
  displayName: 'Triangle',
  morphology: 'linear',
  targets: Object.freeze({
    rangeWidthPct: 0.45,
    premiumMassFraction: 0.32,
    rankSumMean: 15,
    rankSumVariance: 22,
    bimodality: 0.1,
    suitedAsymmetry: 0.3,
    wedgeMonotonicity: 0.55,
    diagonalDominance: 0.1,
    entropy: 0.85,
    contiguity: 0.55,
  }),
  weights: Object.freeze({
    rangeWidthPct: 1.0,
    premiumMassFraction: 2.0,   // Triangle's premium is higher than Cloud's
    rankSumMean: 0.6,
    rankSumVariance: 0.4,
    bimodality: 1.2,
    suitedAsymmetry: 1.2,       // Triangle has slight suited bias; Cloud is balanced
    wedgeMonotonicity: 2.5,
    diagonalDominance: 0.6,
    entropy: 1.5,
    contiguity: 0.5,
  }),
});

/**
 * Comb — suited-heavy range. SB cold-call style, or suited-aces-only
 * defenses. Vertical-stripe pattern when displayed on the 13×13 grid.
 *
 * Suited-asymmetry is the load-bearing distinguisher.
 */
const COMB = Object.freeze({
  id: 'comb',
  displayName: 'Comb',
  morphology: 'capped',
  targets: Object.freeze({
    rangeWidthPct: 0.05,
    premiumMassFraction: 0.4,
    rankSumMean: 16,
    rankSumVariance: 14,
    bimodality: 0.15,
    suitedAsymmetry: 0.95,      // suited-only pushes this to ~1
    wedgeMonotonicity: 0.7,
    diagonalDominance: 0.0,
    entropy: 0.55,
    contiguity: 0.5,
  }),
  weights: Object.freeze({
    rangeWidthPct: 0.5,
    premiumMassFraction: 0.4,
    rankSumMean: 0.3,
    rankSumVariance: 0.6,
    bimodality: 0.6,
    suitedAsymmetry: 5.0,       // primary distinguisher — very-high suited weight
    wedgeMonotonicity: 0.5,
    diagonalDominance: 2.0,     // 0-pair-mass distinguishes Comb sharply
    entropy: 0.4,
    contiguity: 0.5,
  }),
});

/**
 * Cloud — diffuse merged range. Recreational 50%-style caller, or
 * a player whose action mixes everything.
 *
 * Entropy + low concentration are the load-bearing distinguishers.
 */
const CLOUD = Object.freeze({
  id: 'cloud',
  displayName: 'Cloud',
  morphology: 'merged',
  targets: Object.freeze({
    rangeWidthPct: 0.5,
    premiumMassFraction: 0.18,
    rankSumMean: 12,
    rankSumVariance: 30,
    bimodality: 0.0,
    suitedAsymmetry: 0.0,
    wedgeMonotonicity: 0.1,
    diagonalDominance: 0.05,
    entropy: 0.97,
    contiguity: 0.5,
  }),
  weights: Object.freeze({
    rangeWidthPct: 1.0,
    premiumMassFraction: 2.0,
    rankSumMean: 0.4,
    rankSumVariance: 0.6,
    bimodality: 0.5,
    suitedAsymmetry: 1.5,       // Cloud is balanced; Triangle leans suited
    wedgeMonotonicity: 2.5,     // very-low monotonicity (scattered)
    diagonalDominance: 0.3,
    entropy: 3.0,               // primary distinguisher
    contiguity: 0.8,
  }),
});

export const SILHOUETTE_PROTOTYPES = Object.freeze({
  oval: OVAL,
  barbell: BARBELL,
  triangle: TRIANGLE,
  comb: COMB,
  cloud: CLOUD,
});

/**
 * Per-feature natural-scale stdev used to normalize the distance
 * contribution per feature. Exposed for the classifier scoring loop.
 */
export const getFeatureScales = () => FEATURE_SCALES;
