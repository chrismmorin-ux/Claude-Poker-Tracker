/**
 * shapeLanguage/index.js — Public re-exports for the Shape Language
 * classifier primitives.
 *
 * Scope: per-descriptor classifier modules (now under
 * `shapeDescriptors/` namespace per SPR-084 Decision B) + general
 * feature extractors + lesson registry. Mastery state (Bayesian
 * posterior over user knowledge) lives at
 * `src/utils/skillAssessment/shapeLanguage/` — a separate domain.
 *
 * SLS Stream B1 — WS-041 / SPR-082 (Silhouette).
 * SLS Stream B2 — WS-042 / SPR-084 (Equity-Distribution Curve +
 *   Spire/Polarization + Sizing Curve Tag; consolidated namespace).
 * SLS Stream B3 — WS-043 / SPR-088 (Saddle; Basin/Sankey deferred
 *   per scope-reframe — see project doc Phase 7 note + memory
 *   `feedback_river_equity_is_showdown_outcome.md`).
 */

// Per-descriptor classifiers (Silhouette + Stream B2 trio + Saddle)
export * from './shapeDescriptors';

// General feature math — shared across classifiers, not per-descriptor.
export {
  computeGridFeatures,
  GRID_SIZE,
  TOTAL_COMBOS,
} from './gridFeatures';

// Lesson loader — shared across descriptors.
export { getShapeLesson, getAllShapeLessons } from './lessonRegistry';
