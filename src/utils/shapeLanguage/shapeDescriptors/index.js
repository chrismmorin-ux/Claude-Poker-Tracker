/**
 * shapeDescriptors/index.js — Re-exports for per-descriptor classifier
 * modules under the consolidated `shapeDescriptors/` namespace.
 *
 * Decision B (SPR-084 plan, 2026-05-16): consolidate per-descriptor
 * classifiers under one namespace rather than scatter at the
 * `shapeLanguage/` parent level. Silhouette (B1) was relocated here
 * from the parent in the same sprint to keep the structure uniform.
 *
 * General feature math (`gridFeatures.js`) and the shared lesson
 * loader (`lessonRegistry.js`) stay at the parent — they're not
 * per-descriptor.
 */

// Silhouette (B1 — SPR-082; relocated SPR-084 Sub-phase 0)
export {
  classifySilhouette,
  getSilhouetteDisplayName,
  getSilhouetteMorphology,
} from './silhouetteClassifier';

export {
  SILHOUETTE_LABELS,
  SILHOUETTE_PROTOTYPES,
  COMPOUND_DELTA,
} from './silhouettePrototypes';

// Equity-Distribution Curve (B2 — SPR-084 Sub-phase 1)
// Data-only descriptor (no classifier label); produces the sorted
// villain-equity curve consumed by Spire+Polarization downstream.
export {
  computeEquityDistributionCurve,
  EQUITY_BUCKET_EDGES,
} from './equityDistributionCurve';

// Spire + Polarization (B2 — SPR-084 Sub-phase 2)
// One classifier, two-field output {polarization, hasSpire, spireWidth}
// per roundtable §Top-6.
export {
  classifyEquityShape,
  getPolarizationDisplayName,
  POLARIZATION_LABELS,
} from './equityShapeClassifier';

// Sizing Curve Tag (B2 — SPR-084 Sub-phase 3)
// Discriminated-union output {label, confidence, prototypeScores,
// components?, peakIndex, peakEV}. Mirrors silhouette classifier shape.
export {
  classifySizingCurveTag,
  getSizingCurveTagDisplayName,
  SIZING_CURVE_LABELS,
} from './sizingCurveTagClassifier';

// Saddle (B3 — SPR-088)
// Two-field output {wayAheadMass, wayBehindMass, middleMass, label,
// confidence}. Mirrors Spire+Polarization shape — two genuinely
// independent dimensions, with label as a derived rollup. Per
// INV-SLS-B3-SADDLE-TWO-MASS, surfaces must render both masses
// alongside the label.
export {
  classifySaddle,
  getSaddleDisplayName,
} from './saddleClassifier';

export {
  SADDLE_LABELS,
  WAY_AHEAD_EQUITY_FLOOR,
  WAY_BEHIND_EQUITY_CEILING,
  WAY_AHEAD_MASS_FLOOR,
  WAY_BEHIND_MASS_FLOOR,
  MIDDLE_MASS_CEILING,
} from './saddlePrototypes';
