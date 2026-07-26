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
  /** The engine's own ladder. Control arm. */
  SHIPPED: 'shipped',
  /** Drops texture FIRST instead of preserving it — the direct inversion of the claim. */
  TEXTURE_LAST: 'texture-last',
  /** No ladder at all: exact spot, then straight to the population prior. */
  FLAT: 'flat',
  /** Shipped ladder, but a single observation is enough to use a level. */
  MIN_N_1: 'min-n-1',
};

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
