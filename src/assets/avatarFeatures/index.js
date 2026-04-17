/**
 * index.js — Unified avatar feature registry (PEO-1)
 *
 * Aggregates per-category feature modules into a single AVATAR_FEATURES map
 * and provides lookup helpers used by AvatarRenderer.
 *
 * Contract:
 *   AVATAR_FEATURES[categoryName] → array of feature definitions
 *   getFeatureById(id)             → single feature definition or null
 *
 * Every category MUST include a "<category>.none" entry so the renderer can
 * resolve absent selections branch-free (empty paths).
 */

import skin from './skin.js';
import hair from './hair.js';
import beard from './beard.js';
import eyes from './eyes.js';
import glasses from './glasses.js';
import hat from './hat.js';

// =============================================================================
// REGISTRY
// =============================================================================

export const AVATAR_FEATURES = {
  skin,
  hair,
  beard,
  eyes,
  glasses,
  hat,
};

// =============================================================================
// FLAT ID LOOKUP
// =============================================================================

const FEATURE_BY_ID = Object.create(null);
for (const [category, list] of Object.entries(AVATAR_FEATURES)) {
  for (const feature of list) {
    FEATURE_BY_ID[feature.id] = { ...feature, category };
  }
}

/**
 * Look up a feature by its namespaced ID.
 * @param {string} id e.g. "hair.short-wavy"
 * @returns {object | null} feature definition with injected `category`
 */
export const getFeatureById = (id) => FEATURE_BY_ID[id] || null;

/**
 * Get all features for a category in their authored order.
 * @param {string} category e.g. "hair"
 * @returns {Array} feature definitions (may be empty)
 */
export const getFeaturesByCategory = (category) => AVATAR_FEATURES[category] || [];
