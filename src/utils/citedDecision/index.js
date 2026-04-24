/**
 * citedDecision/index.js — Public API for decision wrapping + attribution + dial math
 *
 * Per `docs/projects/exploit-deviation/architecture.md` §3.3.
 * Before editing any file in this directory, read this directory's `CLAUDE.md`.
 *
 * Ruthlessly minimal public API. Internal helpers remain unexported.
 */

// Primary producer — wraps baseline + assumptions + emotional state → CitedDecision
export { produceCitedDecision } from './citedDecisionProducer';

// Dial + blend math (schema §4.1 + §6.1)
export { computeBlend, isZeroBlend, computeDialFromQuality } from './dialMath';

// Shapley-style attribution
export { computeShapleyContributions, attributionsSumToTotal } from './attribution';

// Baseline synthesis + computation (Commit 11 — DrillReveal real labels)
export { synthesizeNodeFromAssumption, villainRangeForStyle } from './baselineSynthesis';
export { computeBaselineForAssumption } from './computeBaselineForAssumption';
