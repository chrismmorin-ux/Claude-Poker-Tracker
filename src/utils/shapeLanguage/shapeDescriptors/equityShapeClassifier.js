/**
 * equityShapeClassifier.js — Spire + Polarization classifier.
 *
 * One classifier function, two-field output. Per the SLS Gate 2
 * roundtable §Top-6 (lines 74-77):
 *
 *   "classifyEquityShape(distribution) → {polarization, hasSpire, spireWidth}"
 *
 * Spire and Polarization are SIBLINGS — both classifiers on the
 * equity-distribution curve. They are kept in one function (rather
 * than split into two modules) because the underlying data they
 * consume — the EDC's 8-bucket histogram — is the same. Splitting
 * would double-compute and risk drift between the two.
 *
 * Anti-pattern refused (HARD GUARDRAIL): the polarization label +
 * hasSpire flag are presentation-only. They MUST NOT be used as
 * inputs to villain modeling, exploit generation, or any
 * decision-driving computation. Per
 * `feedback_first_principles_decisions.md` + POKER_THEORY.md §7 +
 * `shapeLanguage/CLAUDE.md` §1.
 *
 * Pure function. Deterministic. No IDB, no React, no dispatch.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import {
  POLARIZATION_LABELS,
  SPIRE_TOP_BUCKET_FRACTION,
  SPIRE_WIDTH_BUCKET_FRACTION,
  DUMBBELL_EXTREMES_MIN,
  DUMBBELL_MIDDLE_MAX,
  SIDE_HEAVY_HALF_FRACTION,
  FLAT_DEFAULT,
  MIN_CLASSIFIABLE_WEIGHT,
} from './equityShapePrototypes';

/**
 * Classify a villain-equity distribution curve into a polarization
 * label + Spire presence + spire width.
 *
 * @param {{
 *   status: 'ok' | 'empty',
 *   bucketHistogram: number[],
 *   totalWeight: number,
 *   ...
 * }} curve - Output of `computeEquityDistributionCurve(perCombo)`.
 * @returns {{
 *   status: 'ok' | 'empty',
 *   polarization: 'flat' | 'left-heavy' | 'right-heavy' | 'dumbbell',
 *   hasSpire: boolean,
 *   spireWidth: number,
 *   topBucketFraction: number,
 *   bucketHistogram: number[],
 * }}
 */
export const classifyEquityShape = (curve) => {
  const emptyResult = {
    status: 'empty',
    polarization: 'flat',
    hasSpire: false,
    spireWidth: 0,
    topBucketFraction: 0,
    bucketHistogram: new Array(8).fill(0),
  };

  if (!curve || curve.status !== 'ok') return emptyResult;
  if (!Array.isArray(curve.bucketHistogram) || curve.bucketHistogram.length !== 8) return emptyResult;
  if (typeof curve.totalWeight !== 'number' || curve.totalWeight < MIN_CLASSIFIABLE_WEIGHT) return emptyResult;

  const h = curve.bucketHistogram;

  // ─── Spire test ──────────────────────────────────────────────────
  // Spire fires when bucket 7 (top, equity ≥ 0.875) carries ≥
  // SPIRE_TOP_BUCKET_FRACTION of total weight.
  const topBucketFraction = h[7];
  const hasSpire = topBucketFraction >= SPIRE_TOP_BUCKET_FRACTION;

  // ─── Spire width ─────────────────────────────────────────────────
  // Count consecutive top-end buckets (working leftward from bucket 7)
  // that carry ≥ SPIRE_WIDTH_BUCKET_FRACTION * topBucketFraction. This
  // distinguishes a thin spike from a wider value-heavy region.
  let spireWidth = 0;
  if (hasSpire) {
    const threshold = topBucketFraction * SPIRE_WIDTH_BUCKET_FRACTION;
    for (let i = 7; i >= 0; i--) {
      if (h[i] >= threshold) spireWidth += 1;
      else break;
    }
  }

  // ─── Polarization label ──────────────────────────────────────────
  // Test in order — dumbbell first (most specific), then side-heavy,
  // then flat as residual.
  const extremes = h[0] + h[7];
  const middle = h[3] + h[4];
  const lowerHalf = h[0] + h[1] + h[2] + h[3];
  const upperHalf = h[4] + h[5] + h[6] + h[7];

  let polarization = FLAT_DEFAULT;
  if (extremes >= DUMBBELL_EXTREMES_MIN && middle <= DUMBBELL_MIDDLE_MAX) {
    polarization = 'dumbbell';
  } else if (lowerHalf >= SIDE_HEAVY_HALF_FRACTION) {
    polarization = 'left-heavy';
  } else if (upperHalf >= SIDE_HEAVY_HALF_FRACTION) {
    polarization = 'right-heavy';
  } else {
    polarization = 'flat';
  }

  return {
    status: 'ok',
    polarization,
    hasSpire,
    spireWidth,
    topBucketFraction,
    bucketHistogram: h.slice(),
  };
};

/**
 * Display name for a polarization label.
 */
export const getPolarizationDisplayName = (label) => {
  switch (label) {
    case 'flat': return 'Flat';
    case 'left-heavy': return 'Left-heavy';
    case 'right-heavy': return 'Right-heavy';
    case 'dumbbell': return 'Dumbbell';
    default: return label;
  }
};

export { POLARIZATION_LABELS };
