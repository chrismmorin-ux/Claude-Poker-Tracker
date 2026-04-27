/**
 * featureMap.js — feature-to-tier mapping for the Monetization & PMF entitlement system
 *
 * Single source of truth for "which tier unlocks which feature". Consumers
 * read via `hasAccessTo(currentTier, FEATURE_TIER.X)` rather than hard-coding
 * tier strings inside components.
 *
 * MPMF G5-B1 (2026-04-25): authored as part of entitlement foundation batch.
 * Architecture: `docs/projects/monetization-and-pmf/entitlement-architecture.md`
 * §Feature map (consumer layer).
 *
 * Adding a new feature: add to FEATURE_TIER + add a test case.
 * Changing a feature's required tier: requires Gate 4 surface re-review (paywall-spectrum
 * doc + the affected surface spec) — pricing decisions cascade.
 */

import { TIERS } from '../../constants/entitlementConstants';

// =============================================================================
// FEATURE → REQUIRED TIER
// =============================================================================

/**
 * Map of feature identifiers to the minimum tier required for access.
 * Frozen to prevent runtime mutation.
 *
 * Free-tier features: hand entry, live exploit engine, end-of-session recap, sample data
 * Plus features:      cross-session history, villain models persisted, basic drills
 * Pro features:       game tree deep analysis, exploit anchor library, calibration dashboard,
 *                     advanced drills, printable refresher
 *
 * Founding-lifetime tier inherits Pro feature access via TIER_ORDER (both at level 2).
 * Ignition is a separate lane (level 99) — its features are not in this map yet (Phase 2+).
 */
export const FEATURE_TIER = Object.freeze({
  // Free-tier features (always available)
  HAND_ENTRY: TIERS.FREE,
  LIVE_EXPLOIT_ENGINE: TIERS.FREE,
  END_OF_SESSION_RECAP: TIERS.FREE,
  SAMPLE_DATA_MODE: TIERS.FREE,

  // Plus features
  CROSS_SESSION_HISTORY: TIERS.PLUS,
  VILLAIN_MODELS_PERSISTED: TIERS.PLUS,
  BASIC_DRILLS: TIERS.PLUS,

  // Pro features
  GAME_TREE_DEEP_ANALYSIS: TIERS.PRO,
  EXPLOIT_ANCHOR_LIBRARY: TIERS.PRO,
  CALIBRATION_DASHBOARD: TIERS.PRO,
  ADVANCED_DRILLS: TIERS.PRO,
  PRINTABLE_REFRESHER: TIERS.PRO,

  // Ignition SKU — reserved for Phase 2+ (Q3=C deferral)
  IGNITION_SIDEBAR: TIERS.IGNITION,
});

// =============================================================================
// TIER ORDERING
// =============================================================================

/**
 * Numeric ranking for tier comparison. Higher = more access.
 *
 * Founding-lifetime ranks at 2 (= pro) so `hasAccessTo(FOUNDING_LIFETIME, ...)`
 * returns true for any pro-or-below feature.
 *
 * Ignition ranks at 99 (separate lane) so it doesn't accidentally satisfy
 * pro-tier checks if the feature map ever needs to distinguish ignition-only
 * from pro-or-better.
 */
export const TIER_ORDER = Object.freeze({
  [TIERS.FREE]: 0,
  [TIERS.PLUS]: 1,
  [TIERS.PRO]: 2,
  [TIERS.FOUNDING_LIFETIME]: 2, // feature-equivalent to pro
  [TIERS.IGNITION]: 99,         // separate lane
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if `currentTier` ranks at or above `requiredTier` in the linear
 * free → plus → pro ladder.
 *
 * Founding-lifetime is treated as pro (level 2). Ignition is treated as a
 * separate lane (level 99) — `isAtLeast('ignition', 'pro')` returns true,
 * but `isAtLeast('pro', 'ignition')` returns false.
 *
 * Unknown tiers throw — surface bugs early rather than silently grant or
 * deny access.
 *
 * @param {string} currentTier - Tier identifier from entitlement state
 * @param {string} requiredTier - Tier identifier the gated feature requires
 * @returns {boolean}
 * @throws {Error} If either tier is unrecognized
 */
export const isAtLeast = (currentTier, requiredTier) => {
  if (!(currentTier in TIER_ORDER)) {
    throw new Error(`isAtLeast: unknown currentTier "${currentTier}"`);
  }
  if (!(requiredTier in TIER_ORDER)) {
    throw new Error(`isAtLeast: unknown requiredTier "${requiredTier}"`);
  }
  return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];
};

/**
 * Check if `currentTier` has access to a feature identified by FEATURE_TIER key.
 *
 * The feature argument should be a value from FEATURE_TIER (not a feature key
 * string) — `hasAccessTo(tier, FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)` is the
 * intended call site.
 *
 * Unknown feature values throw — surface bugs early.
 *
 * @param {string} currentTier - Tier identifier from entitlement state
 * @param {string} feature - Tier value from FEATURE_TIER
 * @returns {boolean}
 * @throws {Error} If `feature` is not a value in FEATURE_TIER
 */
export const hasAccessTo = (currentTier, feature) => {
  // Feature should be one of the tier values in FEATURE_TIER
  const featureTiers = Object.values(FEATURE_TIER);
  if (!featureTiers.includes(feature)) {
    throw new Error(
      `hasAccessTo: feature "${feature}" is not a value in FEATURE_TIER. ` +
      `Pass a value like FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS, not a key string.`
    );
  }
  return isAtLeast(currentTier, feature);
};

/**
 * Resolve the effective tier the user has — applying dev override if present.
 * Used by EntitlementContext semantic helpers so they consistently observe
 * any dev-mode tier override without consumers having to re-implement the
 * fallback logic.
 *
 * @param {Object} entitlementState - Full state from entitlement reducer
 * @returns {string} Effective tier identifier
 */
export const resolveEffectiveTier = (entitlementState) => {
  const override = entitlementState?.overrides?.devForceTier;
  if (override && override in TIER_ORDER) {
    return override;
  }
  return entitlementState?.tier ?? TIERS.FREE;
};
