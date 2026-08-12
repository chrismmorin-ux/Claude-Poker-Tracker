/**
 * hierarchyVariants.mjs — WS-273 Phase 4. The first simplification to be priced.
 *
 * THE CLAIM UNDER TEST. When a villain has too little data for the exact spot,
 * `villainDecisionModel` falls back through six progressively broader patterns,
 * dropping dimensions in the order aggressor → IP → texture → position → street.
 * The shipped ladder deliberately preserves board texture through level 3, on
 * this stated reasoning:
 *
 *   "Texture preserved through L3 (3 levels) because wet vs dry boards have the
 *    largest impact on villain action distribution after street context."
 *
 * That is a plausible poker claim (POKER_THEORY §3.1 — texture drives range
 * interaction more than seat does) and it has never been measured. It is a
 * comment, not a result. Every fallback below level 1 is answering a question
 * with a broader question, and nobody has checked which broadening hurts least.
 *
 * WHY THIS IS THE RIGHT FIRST A/B (founder-approved 2026-07-26):
 *   - Cheapest possible swap: one function, no new machinery.
 *   - Scores directly as villain-action prediction, so log-loss answers it
 *     without needing the EV pipeline.
 *   - `facingAction` is never dropped in ANY variant — it defines the decision
 *     context, and a ladder that dropped it would be comparing different
 *     questions rather than different answers.
 *
 * Variants are passed to `queryActionDistribution` through its options
 * parameter; nothing is monkey-patched. SHIPPED and MIN_N_1 both leave the
 * builder unset so the engine uses its OWN ladder — never a copy of it that
 * could drift. This module deliberately imports nothing from `src/`, so the
 * plain-Node CLI can read variant names without dragging the bundler-targeted
 * engine graph in behind them.
 */

const WILDCARD = '*';

export const HIERARCHY_VARIANTS = {
  /**
   * The engine's own resolution, whatever it currently is. Control arm.
   *
   * CAUTION when comparing across dates: this arm deliberately touches nothing, so
   * it tracks the engine. Before 2026-07-27 it meant the six-level gate ordered
   * street-first; since WS-285 it means shrinkage down the measured order. Numbers
   * labelled `shipped` in the 2026-07-26 report are the OLD engine and are not
   * comparable to a `shipped` number produced today. To score the old arrangement
   * deliberately, pass `{ blend: 'gate', hierarchyBuilder: orderedLadder(SHIPPED_ORDER) }`.
   */
  SHIPPED: 'shipped',
  /** Drops texture FIRST instead of preserving it — the direct inversion of the claim. */
  TEXTURE_LAST: 'texture-last',
  /** No ladder at all: exact spot, then straight to the population prior. */
  FLAT: 'flat',
  /** Shipped ladder, but a single observation is enough to use a level. */
  MIN_N_1: 'min-n-1',
};

// =============================================================================
// LADDER SHAPE FROM A DIMENSION ORDER (WS-285)
// =============================================================================

/**
 * Build a fallback ladder from an explicit BROAD -> SPECIFIC dimension order.
 *
 * The shipped ladder and every reordering of it are the same object — a nesting
 * chain — differing only in which dimension survives fallback longest. Writing
 * them as two hand-maintained pattern arrays invites exactly the drift the
 * SHIPPED arm avoids by leaving `hierarchyBuilder` unset. So they are generated.
 *
 * `order[0]` is added FIRST, i.e. nearest the root, i.e. it survives fallback
 * longest. That position is the valuable one: the broad levels are the ones that
 * actually fire (level-5 and level-6 took 7,130 of 10,147 corpus decisions),
 * while level-1 fired on 157.
 *
 * @param {string[]} order - dimensions, broad -> specific
 * @returns {Function} a hierarchyBuilder emitting patterns MOST SPECIFIC first
 */
export const orderedLadder = (order) =>
  (street, texture, posCategory, isAgg, isIP, facingAction) => {
    const v = { street, texture, posCategory, isAgg, isIP };
    const patterns = [];
    // depth = how many dimensions are kept; walk specific -> broad
    for (let depth = order.length; depth >= 0; depth--) {
      const keep = order.slice(0, depth);
      const pattern = { facingAction, contextAction: WILDCARD };
      for (const dim of ABLATABLE_DIMENSIONS) {
        pattern[dim] = keep.includes(dim) ? v[dim] : WILDCARD;
      }
      patterns.push(pattern);
    }
    return patterns;
  };

/**
 * The shipped ladder's own order, broad -> specific. Kept as DOCUMENTATION and
 * as a self-check (see `assertShippedOrderMatches` below) — the SHIPPED arm still
 * leaves `hierarchyBuilder` unset so it exercises the engine's real ladder.
 */
export const SHIPPED_ORDER = ['street', 'posCategory', 'texture', 'isIP', 'isAgg'];

/**
 * Ordered by MEASURED information content instead of by assertion.
 *
 * The 2026-07-26 paired ablation (10,147 decisions) ranked the five dimensions,
 * as single-dimension arms against the `ctrl:none` pooled baseline:
 *
 *   isAgg       -0.0167  better than pooling
 *   isIP        -0.0081  better than pooling
 *   (pooled)     0.0000  ctrl:none
 *   street      +0.0096  WORSE than pooling
 *   texture     +0.0132  WORSE than pooling
 *   posCategory +0.0153  WORSE than pooling
 *
 * The shipped order is close to the exact inverse of that ranking: it puts
 * `street` and `posCategory` — the two dimensions measured worse than pooling —
 * nearest the root where they survive fallback, and buries `isAgg`, the only
 * dimension that clearly beats pooling, at level-1 where it reached 1.5% of
 * decisions. This arm simply reverses that.
 */
export const REORDERED_ORDER = ['isAgg', 'isIP', 'texture', 'street', 'posCategory'];

/**
 * Texture dropped at the FIRST fallback step, position and aggressor preserved
 * longer. If the shipped ordering is right, this arm should score worse.
 */
const textureLastPatterns = (street, texture, posCategory, isAgg, isIP, facingAction) => [
  { street, texture, posCategory, isAgg, isIP, facingAction, contextAction: WILDCARD },
  { street, texture: WILDCARD, posCategory, isAgg, isIP, facingAction, contextAction: WILDCARD },
  { street, texture: WILDCARD, posCategory, isAgg: WILDCARD, isIP, facingAction, contextAction: WILDCARD },
  { street, texture: WILDCARD, posCategory, isAgg: WILDCARD, isIP: WILDCARD, facingAction, contextAction: WILDCARD },
  { street, texture: WILDCARD, posCategory: WILDCARD, isAgg: WILDCARD, isIP: WILDCARD, facingAction, contextAction: WILDCARD },
  { street: WILDCARD, texture: WILDCARD, posCategory: WILDCARD, isAgg: WILDCARD, isIP: WILDCARD, facingAction, contextAction: WILDCARD },
];

/**
 * Exact spot only. Measures what the ladder as a whole is worth: if this scores
 * as well as SHIPPED, the five fallback levels are ceremony.
 */
const flatPatterns = (street, texture, posCategory, isAgg, isIP, facingAction) => [
  { street, texture, posCategory, isAgg, isIP, facingAction, contextAction: WILDCARD },
];

/**
 * Resolve a variant name to the options `queryActionDistribution` accepts.
 *
 * @param {string} variant
 * @returns {{ hierarchyBuilder?: Function, minEffectiveN?: number }}
 */
export const hierarchyOptionsFor = (variant) => {
  switch (variant) {
    case HIERARCHY_VARIANTS.SHIPPED:
      return {}; // engine defaults — the control arm touches nothing
    case HIERARCHY_VARIANTS.TEXTURE_LAST:
      return { hierarchyBuilder: textureLastPatterns };
    case HIERARCHY_VARIANTS.FLAT:
      return { hierarchyBuilder: flatPatterns };
    case HIERARCHY_VARIANTS.MIN_N_1:
      // Engine's own ladder, lower evidence bar — builder deliberately unset.
      return { minEffectiveN: 1 };
    default:
      throw new Error(
        `Unknown hierarchy variant "${variant}". Expected one of: ${Object.values(HIERARCHY_VARIANTS).join(', ')}`,
      );
  }
};

/** Every variant name, for CLI validation and sweep loops. */
export const ALL_VARIANTS = Object.values(HIERARCHY_VARIANTS);

// =============================================================================
// ABLATION — "what should I be paying attention to at the table?"
// =============================================================================

/**
 * THE FOUNDER'S QUESTION, 2026-07-26, and it is the right one:
 *
 *   "This translates pretty closely to 'what should I be paying attention to at
 *    the table', where the user won't be able to enter live hands fast enough to
 *    keep up with all hands. So what minimum pieces of info make the most
 *    difference is an important question."
 *
 * The fallback ladder already encodes an ANSWER to that question — it drops
 * dimensions in the order aggressor → IP → texture → position → street, which is
 * an implicit ranking of what matters least to most. That ranking was authored,
 * never measured. Finding 1 showed the ladder as a whole is load-bearing (remove
 * it and the model falls below the population prior), which makes the ORDER worth
 * getting right rather than an academic question.
 *
 * Reordering variants alone cannot answer it, because at realistic sample sizes
 * almost every query falls through to the broad levels regardless of order — the
 * arms barely differ in what they DO. So we ablate instead.
 *
 * TWO FAMILIES, and they answer different questions:
 *
 *   ONLY_<dim>  — context is facingAction + that ONE dimension, then the prior.
 *                 "If I could track exactly one thing about a spot, which?"
 *                 This is the direct answer to the table-capture question.
 *
 *   DROP_<dim>  — full context MINUS that one dimension.
 *                 "Given I'm already tracking everything else, what does this
 *                 one still add?" Marginal value, which is what tells you what
 *                 you can afford to STOP recording.
 *
 * A dimension can score low on DROP (redundant with the others) while scoring
 * high on ONLY (informative on its own). Both readings matter for a live-capture
 * decision, so both are reported.
 *
 * facingAction is never ablated — it defines which actions are even available,
 * so removing it compares different questions rather than different answers.
 */
export const ABLATABLE_DIMENSIONS = ['street', 'texture', 'posCategory', 'isAgg', 'isIP'];

/** Human-readable names, for the report. */
export const DIMENSION_LABELS = {
  street: 'street (flop/turn/river)',
  texture: 'board texture (wet/dry/paired)',
  posCategory: 'position category',
  isAgg: 'who is the aggressor',
  isIP: 'in position / out of position',
};

const WILD = WILDCARD;

/**
 * Build a one-level pattern from an explicit set of KEPT dimensions.
 * Everything not kept is wildcarded; facingAction is always kept.
 */
const patternBuilderKeeping = (keep) =>
  (street, texture, posCategory, isAgg, isIP, facingAction) => {
    const v = { street, texture, posCategory, isAgg, isIP };
    const pattern = { facingAction, contextAction: WILD };
    for (const dim of ['street', 'texture', 'posCategory', 'isAgg', 'isIP']) {
      pattern[dim] = keep.includes(dim) ? v[dim] : WILD;
    }
    return [pattern];
  };

export const onlyVariantName = (dim) => `only:${dim}`;
export const dropVariantName = (dim) => `drop:${dim}`;

/**
 * The full ablation arm set, including the two controls.
 *
 * `full` (all dimensions, one level) is the ceiling any single-dimension arm is
 * measured against; `none` (facingAction only) is the floor. Without both, an
 * ONLY_<dim> number has nothing to be a fraction of.
 *
 * @returns {Array<{name: string, hierarchyOptions: Object, kind: string, dim: string|null}>}
 */
export const buildAblationArms = () => {
  const all = ABLATABLE_DIMENSIONS;
  const arms = [
    {
      name: 'ctrl:full',
      kind: 'control',
      dim: null,
      hierarchyOptions: { hierarchyBuilder: patternBuilderKeeping(all) },
    },
    {
      name: 'ctrl:none',
      kind: 'control',
      dim: null,
      hierarchyOptions: { hierarchyBuilder: patternBuilderKeeping([]) },
    },
    {
      name: HIERARCHY_VARIANTS.SHIPPED,
      kind: 'control',
      dim: null,
      hierarchyOptions: {},
    },
  ];

  for (const dim of all) {
    arms.push({
      name: onlyVariantName(dim),
      kind: 'only',
      dim,
      hierarchyOptions: { hierarchyBuilder: patternBuilderKeeping([dim]) },
    });
    arms.push({
      name: dropVariantName(dim),
      kind: 'drop',
      dim,
      hierarchyOptions: { hierarchyBuilder: patternBuilderKeeping(all.filter(d => d !== dim)) },
    });
  }

  return arms;
};

// =============================================================================
// CANDIDATE REPLACEMENTS (WS-285) — the bake-off
// =============================================================================

/**
 * The arms that could actually SHIP, scored against the arms that only diagnose.
 *
 * The ablation answered "which dimensions carry information". It did not answer
 * "what should replace the ladder", because none of its arms is a shippable
 * hierarchy — `ctrl:none` and `only:isAgg` are single fixed levels with no
 * fallback, which is fine as a measuring instrument and wrong as an engine.
 *
 * THE TENSION THE ABLATION EXPOSED, and which every candidate here must resolve:
 * restricted to the 3,035 decisions that already fall through to pooled
 * `facingAction`, adding `isAgg` scores 0.0159 WORSE. Restricted to the 930 that
 * stop at level-4, pooling scores 0.0504 BETTER and adding `isAgg` 0.0725 better.
 * So neither "always pool" nor "always split on isAgg" is right — the correct
 * structure pools when the cell is thin and splits when it is not. That is what a
 * correctly ORDERED gate does discretely and what SHRINKAGE does smoothly.
 *
 * Three families, and they are genuinely different hypotheses:
 *
 *   reordered    the gate is fine, its ORDER is inverted.
 *   shrinkage    the gate itself is the defect; blend instead of choose.
 *   min-n-N      neither; the gate's THRESHOLD was just set too low.
 *
 * The min-n arms matter even though WS-285 asserts the order is the problem.
 * They cost one number each and they are the arms that can falsify the ticket's
 * own diagnosis — if `min-n-25` alone recovers the gap, the ordering story is
 * wrong and the fix is a constant, not a restructure.
 *
 * @returns {Array<{name: string, hierarchyOptions: Object, kind: string, dim: string|null}>}
 */
export const buildCandidateArms = () => ([
  // --- benchmarks: what any candidate has to beat -----------------------------
  { name: HIERARCHY_VARIANTS.SHIPPED, kind: 'control', dim: null, hierarchyOptions: {} },
  {
    name: 'ctrl:none',
    kind: 'control',
    dim: null,
    hierarchyOptions: { hierarchyBuilder: patternBuilderKeeping([]) },
  },
  {
    name: 'only:isAgg',
    kind: 'control',
    dim: 'isAgg',
    hierarchyOptions: { hierarchyBuilder: patternBuilderKeeping(['isAgg']) },
  },

  // --- hypothesis 1: the order is inverted ------------------------------------
  {
    name: 'reordered',
    kind: 'candidate',
    dim: null,
    hierarchyOptions: { hierarchyBuilder: orderedLadder(REORDERED_ORDER) },
  },

  // --- hypothesis 2: the gate itself is the defect ----------------------------
  // W is the parent-constraint strength. Swept rather than guessed: W is a new
  // free parameter and shipping it on a default would repeat this ticket's sin.
  ...[5, 10, 20].map(W => ({
    name: `shrinkage:W${W}`,
    kind: 'candidate',
    dim: null,
    hierarchyOptions: { blend: 'shrinkage', shrinkWeight: W },
  })),
  // Shrinkage on the reordered ladder. Shrinkage is claimed to be order-insensitive
  // (a low-information dimension gets shrunk back toward its parent rather than
  // gated on); this arm is what tests that claim instead of asserting it.
  {
    name: 'shrinkage:W10+reordered',
    kind: 'candidate',
    dim: null,
    hierarchyOptions: {
      blend: 'shrinkage',
      shrinkWeight: 10,
      hierarchyBuilder: orderedLadder(REORDERED_ORDER),
    },
  },

  // --- hypothesis 3: the threshold was just too low ---------------------------
  ...[10, 25].map(n => ({
    name: `min-n-${n}`,
    kind: 'candidate',
    dim: null,
    hierarchyOptions: { minEffectiveN: n },
  })),
]);

// =============================================================================
// PRIOR SOURCE (WS-436) — what conditions the Dirichlet seed
// =============================================================================

/**
 * The style-label channel, priced per decision. Unlike every arm above, this is
 * a model-BUILD axis (`priorSource`), not a query axis: `runner.mjs` builds one
 * model per distinct source per checkpoint and the arms diverge only in what
 * seeds `buildActionPriors` — the six-label `STYLE_PRIORS` table (shipping
 * config) versus no per-player conditioning at all.
 *
 * Three arms, and the third is a tripwire:
 *
 *   shipped               control — whatever the engine currently builds.
 *   priors:population     the seed is POPULATION_PRIORS, always.
 *   priors:style-labels   the label channel, explicitly.
 *
 * At the pre-A4 engine, `priors:style-labels` must be RECORD-IDENTICAL to
 * `shipped` (both build with the label) — a zero paired delta that verifies the
 * pairing itself. After WS-436 A4 lands, `shipped` means the continuous shrunk
 * seed, `priors:style-labels` degrades to it (the label has no channel left),
 * and the pair must be identical AGAIN — which is falsifier #1 of the removal,
 * scored on the same instrument that measured the channel it removes.
 */
export const buildPriorSourceArms = () => ([
  { name: HIERARCHY_VARIANTS.SHIPPED, kind: 'control', dim: null, hierarchyOptions: {} },
  {
    name: 'priors:population',
    kind: 'candidate',
    dim: null,
    priorSource: 'population',
    hierarchyOptions: {},
  },
  {
    name: 'priors:style-labels',
    kind: 'candidate',
    dim: null,
    priorSource: 'style-labels',
    hierarchyOptions: {},
  },
]);

/**
 * Price `shrinkWeight` on the ladder that actually WON (2026-07-27 bake-off).
 *
 * The bake-off swept W over the SHIPPED ordering, where W=10 beat W=5 and W=20.
 * But shrinkage and ordering turned out to be complements rather than substitutes
 * — `shrinkage:W10+reordered` scored 2.0x the combined arm's own components — so
 * the W optimum measured on the shipped ladder does not automatically carry to the
 * reordered one. W is the single free parameter this change ships; leaving it on a
 * value fitted against a discarded ladder would be the same unmeasured-assumption
 * failure WS-285 exists to correct.
 *
 * W=40 is included above the shipped-ladder sweep's ceiling because the winning
 * arm shrinks harder overall — the optimum may sit outside the old bracket, and a
 * sweep that cannot find its own edge has not bracketed anything.
 */
export const buildShrinkWeightSweepArms = () => ([
  { name: HIERARCHY_VARIANTS.SHIPPED, kind: 'control', dim: null, hierarchyOptions: {} },
  {
    name: 'ctrl:none',
    kind: 'control',
    dim: null,
    hierarchyOptions: { hierarchyBuilder: patternBuilderKeeping([]) },
  },
  ...[5, 10, 20, 40].map(W => ({
    name: `shrinkage:W${W}+reordered`,
    kind: 'candidate',
    dim: null,
    hierarchyOptions: {
      blend: 'shrinkage',
      shrinkWeight: W,
      hierarchyBuilder: orderedLadder(REORDERED_ORDER),
    },
  })),
]);
