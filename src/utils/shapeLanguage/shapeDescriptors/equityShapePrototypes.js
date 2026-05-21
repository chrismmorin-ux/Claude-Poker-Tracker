/**
 * equityShapePrototypes.js — Calibration constants for the Spire +
 * Polarization classifier.
 *
 * CALIBRATION CONSTANTS, not learned weights. Tweaking a threshold
 * requires re-running the classifier fixture suite. Auto-tuning these
 * from production data creates a feedback loop (the classifier's
 * labels filter into "improved" training data, drifting toward
 * whatever the classifier already said) and is explicitly forbidden
 * per `shapeLanguage/CLAUDE.md` §Anti-pattern #2.
 *
 * Source taxonomy: `docs/projects/poker-shape-language/roundtable.md`
 * lines 27-28 + 74-77.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

/**
 * Polarization labels — 4 prototype mass-distribution shapes on the
 * 8-bucket villain-equity histogram.
 *
 *   flat        — mass roughly evenly distributed across buckets (low entropy gradient)
 *   left-heavy  — mass concentrated in the low-equity buckets (villain mostly weak)
 *   right-heavy — mass concentrated in the high-equity buckets (villain mostly strong)
 *   dumbbell    — bimodal: heavy on both ends, light in the middle (polarized)
 *
 * Per roundtable line 28 ("Flat, Left-Heavy, Dumbbell") + symmetry
 * extension: a right-heavy mode is the symmetric mirror of left-heavy
 * and shows up in narrowed/committed ranges where villain's air has
 * been folded out by prior streets.
 */
export const POLARIZATION_LABELS = Object.freeze([
  'flat',
  'left-heavy',
  'right-heavy',
  'dumbbell',
]);

/**
 * Spire threshold — fraction of total weight that must sit in the top
 * bucket (equity ≥ 0.875) for `hasSpire: true`. Per roundtable line 27:
 * "Small cluster of nutted combos sitting atop an otherwise medium/weak
 * range — the 'uncapped' signature." 8% is the calibrated threshold for
 * "small cluster" — anything ≥ this fires Spire.
 */
export const SPIRE_TOP_BUCKET_FRACTION = 0.08;

/**
 * Spire width band — the count of consecutive top-end buckets that
 * carry non-trivial mass when Spire fires. `spireWidth = 1` means only
 * bucket 7 has mass; `spireWidth = 2` means buckets 6+7; etc. This
 * distinguishes a thin spire (small set of nutted combos) from a wider
 * value-heavy upper region.
 *
 * Threshold for "non-trivial" — a bucket carries ≥ this fraction of
 * the top-bucket weight to count toward width.
 */
export const SPIRE_WIDTH_BUCKET_FRACTION = 0.4;

/**
 * Dumbbell threshold — when the combined mass in the two extreme
 * buckets (0 + 7) exceeds this fraction of total weight AND the middle
 * bucket (3-4) carries less than `DUMBBELL_MIDDLE_MAX`, label dumbbell.
 *
 * Per roundtable T6: a flipping classifier between dumbbell/flat is
 * worse than a stable label; thresholds are chosen to be discriminating
 * enough that real ranges land cleanly in one mode.
 */
export const DUMBBELL_EXTREMES_MIN = 0.4;
export const DUMBBELL_MIDDLE_MAX = 0.15;

/**
 * Left-heavy / right-heavy thresholds — fraction of total mass in the
 * lower-half (buckets 0-3) or upper-half (buckets 4-7) of the
 * histogram.
 *
 * 0.65 is the calibrated cutoff: above this, the range is decisively
 * skewed to one side; below this, the range is closer to balanced
 * (either flat or dumbbell, decided by the dumbbell test above).
 */
export const SIDE_HEAVY_HALF_FRACTION = 0.65;

/**
 * Flat fallback — when none of the above tests trigger, the
 * distribution is approximately flat. There is no fraction-based
 * threshold for `flat` itself; it is the residual label.
 */
export const FLAT_DEFAULT = 'flat';

/**
 * Minimum total weight for the classifier to produce a non-empty
 * label. Mirrors the EDC compute module's `MIN_CLASSIFIABLE_WEIGHT`
 * floor so a curve that EDC labels `empty` also classifies as empty
 * here (defense in depth — if the upstream changes, the classifier
 * still degrades gracefully).
 */
export const MIN_CLASSIFIABLE_WEIGHT = 0.01;
