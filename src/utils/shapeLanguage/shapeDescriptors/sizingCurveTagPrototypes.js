/**
 * sizingCurveTagPrototypes.js — Calibration constants for the four
 * Sizing Curve Tag prototypes (Ridge / Plateau / Cliff / Ramp).
 *
 * Per roundtable §Top-6 (line 80-84): "classifier on the EV-vs-bet-
 * size curve: sharp peak (Ridge), flat top (Plateau), monotone drop
 * (Cliff), monotone rise (Ramp). Coach's insight: the *label* travels
 * to the table; the *full curve* is study-only."
 *
 * Each prototype is identified by simple shape statistics on the
 * EV-vs-sizing array — peak prominence, monotonicity sign, range
 * span. Hand-calibrated thresholds, not learned.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

/**
 * The 4 canonical sizing-curve labels. Order matches the roundtable
 * enumeration.
 */
export const SIZING_CURVE_LABELS = Object.freeze([
  'ridge',
  'plateau',
  'cliff',
  'ramp',
]);

/**
 * Minimum number of sample points required for classification to be
 * meaningful. Below this, return `label: 'empty'`.
 */
export const MIN_SAMPLES_FOR_CLASSIFICATION = 3;

/**
 * Minimum EV span — `max - min` over the input array — required for a
 * non-flat classification. Below this, the curve is essentially flat;
 * we still classify it as `plateau` rather than `empty` because a flat
 * EV curve is a legitimate observation (it just means sizing doesn't
 * matter much).
 */
export const FLAT_EV_THRESHOLD = 0.05;

/**
 * Ridge prototype — sharp peak with monotone drop on both sides. The
 * peak's prominence (peak height above adjacent values, normalized
 * by total span) must exceed this threshold for `ridge` to fire.
 *
 * Calibrated so a curve that rises from 0 to 1 then drops back to 0
 * with no intermediate plateau lands as ridge, but a curve with a
 * broad maximum lands as plateau instead.
 */
export const RIDGE_PEAK_PROMINENCE = 0.6;

/**
 * Plateau prototype — flat-topped curve. The fraction of samples
 * within `PLATEAU_TOLERANCE` of the peak must exceed this threshold.
 * A curve where the top 60%+ of values cluster near the peak is a
 * plateau even if the surrounding values are noticeably lower.
 */
export const PLATEAU_TOP_FRACTION = 0.5;

/**
 * Tolerance band around the peak for plateau detection — values
 * within `peakEV * (1 - PLATEAU_TOLERANCE)` of the peak are
 * considered "at the top."
 */
export const PLATEAU_TOLERANCE = 0.15;

/**
 * Cliff prototype — monotone non-increasing (with small tolerance).
 * The fraction of adjacent-pair comparisons that are non-increasing
 * (within `MONOTONIC_TOLERANCE`) must exceed this threshold for the
 * curve to count as monotonic.
 */
export const MONOTONICITY_FRACTION = 0.8;

/**
 * Tolerance for "non-increasing" / "non-decreasing" — small upward
 * blips below this threshold (relative to total span) are ignored
 * when computing monotonicity, so a near-monotone curve with one
 * noise spike still classifies cleanly.
 */
export const MONOTONIC_TOLERANCE = 0.05;

/**
 * Compound delta — when the top-2 prototype scores are within this
 * fraction of each other, the classifier returns `label: 'compound'`
 * with `components: [top1, top2]` per the B1 precedent (silhouette
 * COMPOUND_DELTA = 0.15 — we mirror that here).
 */
export const COMPOUND_DELTA = 0.15;
