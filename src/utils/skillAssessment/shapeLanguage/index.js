/**
 * shapeLanguage/index.js — public re-exports.
 *
 * SLS Stream D — SPR-081 / WS-040.
 *
 * Pure math + read-API hooks for Shape Language mastery state. The reducer +
 * context + persistence live elsewhere; this module is read-time-only.
 */

export {
  POSTERIOR_FLOOR,
  updateBetaPosterior,
  betaCredibleInterval,
  betaMean,
} from './betaPosterior';

export {
  DEFAULT_DECAY_PROFILE,
  applyTemporalDecay,
} from './temporalDecay';

export { useShapeMasteryDecay } from './hooks';
