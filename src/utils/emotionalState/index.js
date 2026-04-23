/**
 * emotionalState/index.js — Public API for two-dimensional fear/greed engine
 *
 * Schema v1.1 §3 per `docs/projects/exploit-deviation/schema.md`.
 * Owner directive 2026-04-23: fear and greed are two separate dimensions; the joint tuple
 * `[fearIndex, greedIndex]` is preserved on every CitedDecision for later quadrant analysis.
 *
 * Before editing any file in this directory, read this directory's `CLAUDE.md`.
 */

// Public API — schema v1.1 §3
export { computeEmotionalState } from './emotionalStateComputer';
export { applyEmotionalTilt } from './tiltTransform';

// Transform metadata — consumed by assumptionEngine operators for version stamping
export {
  EMOTIONAL_TRANSFORM_VERSION,
  EMOTIONAL_TRANSFORM_CONFIG,
  STYLE_MULTIPLIERS,
  FEAR_FOLD_CAP,
  GREED_RAISE_CAP,
} from './tiltTransform';

// Factor-level primitives — exposed for targeted testing + for assumptionEngine
// to introspect when building per-assumption emotionalTrigger evaluation.
export {
  computeFearIndex,
  rangePositionBottomShare,
  sprDynamicFear,
  sessionStuckFear,
  FEAR_FACTOR_WEIGHTS,
  BOTTOM_THRESHOLD,
  cellPreflopStrength,
} from './fearIndex';

export {
  computeGreedIndex,
  rangePositionTopShare,
  sprDynamicGreed,
  sessionHeaterGreed,
  GREED_FACTOR_WEIGHTS,
  TOP_THRESHOLD,
} from './greedIndex';

// Direct shift primitives — exposed so citedDecision/dialMath can probe shifts
// without applying them (e.g. for "what would the fold% be at this emotional state")
export { fearFoldShift, greedRaiseShift } from './tiltTransform';
