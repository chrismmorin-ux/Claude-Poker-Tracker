/**
 * pushFoldEngine — short-stack push/fold verdicts ($EV decision).
 *
 * A decision layer above icmEngine + pokerCore equity + population ranges.
 * Governed by POKER_THEORY §10.4. See ./CLAUDE.md. Pure: equity is injected.
 */

export { effectiveStackBB, isPushFoldDepth, PUSH_FOLD_MAX_BB } from './effectiveStack';
export { computeCallVerdict, computeShoveVerdict } from './pushFold';
export { assessPushFoldSetup } from './setup';
