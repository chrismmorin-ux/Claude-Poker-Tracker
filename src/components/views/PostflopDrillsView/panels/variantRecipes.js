/**
 * variantRecipes.js — `VARIANT_RECIPES` constant for the v2 panel's
 * composition ordering. I-DM-1 structural enforcement: the composition
 * root reads this constant; a future contributor who wants P3 above P1
 * must edit this file's ordering, which is visible in code review.
 *
 * Primitives referenced by id (enforced against the component registry
 * in BucketEVPanelV2.jsx):
 *   P5  — StreetNarrowingContext (non-root nodes)
 *   P1  — VillainRangeDecomposition (primary teaching block)
 *   P2  — WeightedTotalTable (arithmetic)
 *   P4  — ActionRecommendationStrip
 *   P3  — HeroViewBlock (context, not answer)
 *   P6  — ConfidenceDisclosure
 *   P6b — GlossaryBlock (bucket-label definitions)
 *
 * Not yet implemented (extension seams):
 *   P7  — PerVillainDecomposition (MW, blocked on LSW-G6)
 *   P8  — MixedStrategyDisclosure (axis 8, deferred)
 */

export const VARIANT_RECIPES = Object.freeze({
  // V1 — HU villain-first flop (donk / cbet / etc). No P5 on flop_root.
  V1: Object.freeze(['P1', 'P2', 'P4', 'P3', 'P6', 'P6b']),

  // V2 — HU hero-first flop (villain checked; hero decides cbet/check).
  V2: Object.freeze(['P1', 'P2', 'P4', 'P3', 'P6', 'P6b']),

  // V3 — HU villain-first turn (barrel after call).
  V3: Object.freeze(['P5', 'P1', 'P2', 'P4', 'P3', 'P6', 'P6b']),

  // V4 — HU hero-first turn (villain checked twice).
  V4: Object.freeze(['P5', 'P1', 'P2', 'P4', 'P3', 'P6', 'P6b']),

  // V5 — River bluff-catch (hero faces bet). P1 switches to polar-split mode.
  V5: Object.freeze(['P5', 'P1', 'P2', 'P4', 'P3', 'P6', 'P6b']),

  // V6 — River thin-value (hero considers betting vs condensed range).
  // P1 switches to beat-vs-pay split mode.
  V6: Object.freeze(['P5', 'P1', 'P2', 'P4', 'P3', 'P6', 'P6b']),
});

/**
 * Choose a variant id for a node given its `decisionKind`, whether villain
 * acted first, and the street. The composition root passes these in from
 * the node's schema fields and looks up the recipe.
 *
 * v1 ship scope: V1–V6. V7 (late-street value), V8 (open-bet capped range),
 * V9 (MW), V10 (range-level hero view), V11 (preflop — wrong surface entirely)
 * are deferred; selectVariant falls back to V1 with a console.warn for those.
 */
export const selectVariant = ({ street, villainFirst, decisionKind }) => {
  if (decisionKind === 'bluff-catch') return 'V5';
  if (decisionKind === 'thin-value') return 'V6';
  // Standard decision kind.
  if (street === 'flop') {
    return villainFirst ? 'V1' : 'V2';
  }
  if (street === 'turn') {
    return villainFirst ? 'V3' : 'V4';
  }
  // River standard (neither bluff-catch nor thin-value — rare but possible,
  // e.g., river hero-first with strong range).
  return villainFirst ? 'V5' : 'V6';
};

/**
 * Return the primitive ids for a variant in render order, or null when the
 * variant id is unknown.
 */
export const primitivesForVariant = (variantId) => {
  const recipe = VARIANT_RECIPES[variantId];
  return recipe ? [...recipe] : null;
};
