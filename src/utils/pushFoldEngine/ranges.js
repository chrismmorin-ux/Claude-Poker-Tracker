/**
 * ranges.js — population model of short-stack push/fold ranges.
 *
 * POKER_THEORY §10.4: this is the documented APPROXIMATION (the shove case's
 * villain calling range + fold-equity prior). It is a population model, not
 * solved Nash — depth-conditioned Nash is a deferred refinement. The CALL-vs-
 * shove case does NOT use these (it's exact: hero equity vs the shover's range).
 *
 * Bucketed by effective stack: shallower stacks → wider jam + wider call.
 */

import { parseRangeString, rangeWidth } from '../pokerCore/rangeMatrix';

// What a villain CALLS a short all-in with (used to score hero's jam).
const CALL_VS_JAM = {
  shallow: '44+,A7s+,A9o+,KTs+,KJo,QJs',   // ≤8bb
  standard: '55+,A8s+,ATo+,KTs+,KQo,QJs',  // 8–15bb
};

// What a short stack JAMS first-in (used as the shover's range when hero faces a jam).
const JAM_RANGE = {
  shallow: '22+,A2s+,A2o+,K5s+,K8o+,Q8s+,QTo+,J8s+,JTo,T8s+,97s+,87s,76s', // ≤8bb
  standard: '22+,A2s+,A7o+,K9s+,KTo+,Q9s+,QJo,J9s+,T9s,98s',               // 8–15bb
};

const bucketOf = (effStackBB) => (effStackBB != null && effStackBB <= 8 ? 'shallow' : 'standard');

/** Villain calling range vs a short jam (Float64Array) + its combo fraction. */
export const getCallingRange = (effStackBB) => {
  const range = parseRangeString(CALL_VS_JAM[bucketOf(effStackBB)]);
  return { range, width: rangeWidth(range) };
};

/** Representative shover range (Float64Array) when hero faces a short all-in. */
export const getShoverRange = (effStackBB) => {
  const range = parseRangeString(JAM_RANGE[bucketOf(effStackBB)]);
  return { range, width: rangeWidth(range) };
};

/**
 * Fold equity for a first-in jam: P(all players behind fold) ≈ (1 − callWidth)^N,
 * where callWidth is the share of hands a single villain calls with. A documented
 * approximation (independent villains, population call range).
 */
export const estimateJamFoldEquity = (callWidth, playersBehind) => {
  const w = Math.max(0, Math.min(1, callWidth || 0));
  const n = Math.max(0, playersBehind || 0);
  return Math.pow(1 - w, n);
};
