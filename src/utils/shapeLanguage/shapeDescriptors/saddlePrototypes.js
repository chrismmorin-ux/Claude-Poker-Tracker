/**
 * saddlePrototypes.js — Calibration constants for the Saddle (way-ahead
 * / way-behind) descriptor.
 *
 * Per `docs/projects/poker-shape-language.project.md` Phase 7 + the SLS
 * catalog row 4 (priority P1): Saddle is a "way-ahead/way-behind detector;
 * threshold-driven."
 *
 * Saddle has two genuinely independent dimensions:
 *   - `wayAheadMass` — fraction of villain's range whose combos beat
 *      hero by a comfortable margin (heroEquity < WAY_BEHIND_EQUITY_CEILING)
 *   - `wayBehindMass` — fraction of villain's range whose combos lose to
 *      hero by a comfortable margin (heroEquity > WAY_AHEAD_EQUITY_FLOOR)
 *
 * Either can be elevated independently of the other. A range can be
 * wayAhead-only (e.g., BTN c-bet bluffs on K72r seen from BB POV),
 * wayBehind-only (loose limp range vs squeeze), both (true saddle —
 * polarized at showdown), or neither (flat range with middle equity).
 *
 * That bidimensional structure is the load-bearing reason this descriptor's
 * primary output is two-field {wayAheadMass, wayBehindMass} rather than a
 * single discriminated union — see INV-SLS-B3-SADDLE-TWO-MASS in
 * `system/invariants.md`.
 *
 * Hand-calibrated thresholds, not learned. Same calibration discipline as
 * `silhouettePrototypes.js` / `sizingCurveTagPrototypes.js`.
 *
 * SLS Stream B3 — WS-043 / SPR-088.
 */

/**
 * Per-combo equity threshold defining "villain is way-ahead" — when
 * `heroEquity < WAY_BEHIND_EQUITY_CEILING`, that combo beats hero by
 * a comfortable margin (≥65/35 equity edge from villain's POV).
 */
export const WAY_BEHIND_EQUITY_CEILING = 0.35;

/**
 * Per-combo equity threshold defining "villain is way-behind" — when
 * `heroEquity > WAY_AHEAD_EQUITY_FLOOR`, hero beats that combo by the
 * same comfortable margin.
 */
export const WAY_AHEAD_EQUITY_FLOOR = 0.65;

/**
 * Mass-fraction threshold above which `wayAheadMass` counts as
 * "elevated" — when at least 30% of villain's weighted range falls in
 * the way-ahead-for-villain bucket, the wayAhead dimension is firing.
 */
export const WAY_AHEAD_MASS_FLOOR = 0.30;

/**
 * Same threshold mirrored for `wayBehindMass`. Symmetric by design.
 */
export const WAY_BEHIND_MASS_FLOOR = 0.30;

/**
 * Middle-mass ceiling for "depleted middle" — the canonical Saddle
 * pattern requires BOTH dimensions elevated AND the middle bucket
 * (heroEquity ∈ [WAY_BEHIND_EQUITY_CEILING, WAY_AHEAD_EQUITY_FLOOR])
 * carrying less than 20% of the weighted mass. A range that has high
 * way-ahead + high way-behind + a fat middle is bimodal-with-noise,
 * not a true saddle.
 */
export const MIDDLE_MASS_CEILING = 0.20;

/**
 * Minimum number of combos required for classification to be
 * meaningful. Below this, return `label: 'empty'`. Lower than the
 * silhouette guard (10) because Saddle works off small per-combo
 * arrays at later streets where the range has compressed.
 */
export const MIN_CLASSIFIABLE_COMBO_COUNT = 8;

/**
 * The 5 canonical Saddle labels. `empty` is the sparse-input fallback;
 * the other four are the meaningful classifications.
 *
 * Order:
 *   `saddle` first because it's the descriptor's namesake configuration
 *   (both masses elevated + middle depleted).
 *   `wayAhead`, `wayBehind` are the single-dimension elevations.
 *   `flat` is the no-asymmetry case (neither mass elevated).
 *   `empty` is the data-too-sparse guard.
 */
export const SADDLE_LABELS = Object.freeze([
  'saddle',
  'wayAhead',
  'wayBehind',
  'flat',
  'empty',
]);

/**
 * User-facing display strings for each label. The em-dash for `empty`
 * matches the `getSizingCurveTagDisplayName` convention.
 */
export const SADDLE_DISPLAY_NAMES = Object.freeze({
  saddle: 'Saddle',
  wayAhead: 'Way-Ahead',
  wayBehind: 'Way-Behind',
  flat: 'Flat',
  empty: '—',
});
