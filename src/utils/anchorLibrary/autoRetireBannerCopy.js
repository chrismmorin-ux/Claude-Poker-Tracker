/**
 * autoRetireBannerCopy.js — deterministic copy generator for the AutoRetireBanner.
 *
 * Per `docs/design/journeys/anchor-retirement.md` Variation D step 3s:
 *   `"N anchor(s) auto-retired since you last looked. [ Review ]"`
 *
 * AP-06 forbidden patterns reused via import from `retirementCopy.js` —
 * the banner is a downstream surface in the same journey copy ladder.
 *
 * Pure module — deterministic from `count`. No runtime LLM. Every output
 * passes `validateRetirementCopy()` for every `count` value (1, 2, N+).
 *
 * EAL Phase 6 — SPR-060 / WS-170.
 */

import { validateRetirementCopy } from './retirementCopy';

/**
 * @typedef {Object} AutoRetireBannerCopy
 * @property {string} message      — "N anchor[s] auto-retired since you last looked."
 * @property {string} reviewLabel  — "Review"
 * @property {string} dismissLabel — "Dismiss"
 * @property {string} dismissAria  — "Dismiss banner"
 */

/**
 * Build the AutoRetireBanner copy bundle.
 *
 * @param {{ count: number }} args
 * @returns {AutoRetireBannerCopy | null} bundle, or null if count invalid (≤0 or non-integer)
 */
export const buildAutoRetireBannerCopy = ({ count } = {}) => {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
    return null;
  }

  const noun = count === 1 ? 'anchor' : 'anchors';
  const message = `${count} ${noun} auto-retired since you last looked.`;

  return {
    message,
    reviewLabel: 'Review',
    dismissLabel: 'Dismiss',
    dismissAria: 'Dismiss banner',
  };
};

/**
 * Validate every text field in the bundle against AP-06 forbidden patterns.
 * Used in tests; can be wired into CI lint as a per-bundle gate alongside
 * `retirementCopy.validateRetirementCopyBundle`.
 *
 * @param {AutoRetireBannerCopy | null} bundle
 * @returns {{ valid: boolean, violations: Array<{ pattern: string, match: string }> }}
 */
export const validateAutoRetireBannerCopyBundle = (bundle) => {
  if (!bundle || typeof bundle !== 'object') return { valid: true, violations: [] };
  const fields = [
    bundle.message,
    bundle.reviewLabel,
    bundle.dismissLabel,
    bundle.dismissAria,
  ];
  const allViolations = [];
  for (const field of fields) {
    const { violations } = validateRetirementCopy(field);
    allViolations.push(...violations);
  }
  return { valid: allViolations.length === 0, violations: allViolations };
};

export default buildAutoRetireBannerCopy;
