/**
 * @file SIGHTING_FEATURE_PRIORS.js — per-attribute Bayesian-Beta priors
 * for `computeStability()`.
 *
 * Schema:
 *   {
 *     [attributeName]: {
 *       alpha: number,  // pseudo-count for "stable" observations
 *       beta:  number,  // pseudo-count for "varying" observations
 *     }
 *   }
 *
 * Authoring guidance (per `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`
 * §PIO-G3-STAB, line 470):
 *   - Stable attributes (e.g., `ageDecade`, `ethnicity`, `skin`, `eyeColor`):
 *     prior favors stability — alpha 5+, beta 1.
 *   - Variable attributes (e.g., `wardrobe`, `hat`, `jewelry`):
 *     prior favors variability — alpha 1, beta 5+.
 *   - Mixed attributes (e.g., `hair` style/color, `facialHair`):
 *     prior balanced — alpha 2, beta 2.
 *
 * **v1 ships empty** (uniform priors via `computeStability`'s fallback path).
 * Corpus-tuning happens in a follow-up child (likely WS-162 Player Profile View
 * authoring or a dedicated WS-149-equivalent for PIO).
 *
 * Per `feedback_pio_identification_utility_first.md`: identification utility
 * binds; cultural-sensitivity is reviewing voice. Authoring priors for
 * demographic attributes (skin, ethnicity, ageDecade) is permitted when it
 * aids identification.
 *
 * SPR-034 / WS-160 (2026-05-04).
 *
 * @type {Object<string, {alpha: number, beta: number}>}
 */
export const SIGHTING_FEATURE_PRIORS = {};
