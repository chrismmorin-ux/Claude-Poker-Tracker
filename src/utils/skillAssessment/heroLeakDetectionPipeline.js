/**
 * @file Hero-leak detection orchestrator. Loads hand history → runs
 * accumulator → runs detector → writes leaks to IDB. Single entry point
 * for the React hook to call.
 *
 * v1 simplification: picks the most-common heroSeat across the history.
 * Multi-seat per-hand support deferred — typical case is hero plays from
 * one seat per session and we want the dominant seat's leaks surfaced.
 *
 * SPR-031 / WS-158 (2026-05-03).
 */

import { getAllHands } from '../persistence/handsStorage.js';
import { accumulateHeroDecisions } from './heroDecisionAccumulator.js';
import { detectHeroLeaks } from './heroLeakDetector.js';
import { replacePlayerLeaks } from '../persistence/heroLeaksStore.js';

/**
 * Returns the most-common heroSeat across the hand-history. Returns null if
 * no hand has a mySeat field.
 */
export const mostCommonHeroSeat = (hands) => {
  if (!Array.isArray(hands) || hands.length === 0) return null;
  const counts = new Map();
  for (const hand of hands) {
    const s = hand?.gameState?.mySeat;
    if (s == null) continue;
    const seat = Number(s);
    counts.set(seat, (counts.get(seat) || 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestSeat = null;
  let bestCount = -1;
  for (const [seat, count] of counts) {
    if (count > bestCount) {
      bestSeat = seat;
      bestCount = count;
    }
  }
  return bestSeat;
};

/**
 * Run hero-leak detection end-to-end against IDB hand history.
 *
 * @param {string} userId - Auth-scoped user id (used for both hand fetch + playerId on leak records)
 * @param {object} [options]
 * @param {function} [options.loadHands] - Override (test injection)
 * @param {function} [options.persistLeaks] - Override (test injection)
 * @returns {Promise<{firedLeaks: Array, totalActions: number, totalBuckets: number, heroSeat: number|null, handCount: number}>}
 */
export const runHeroLeakDetection = async (userId, options = {}) => {
  const loadHands = options.loadHands || getAllHands;
  const persistLeaks = options.persistLeaks || replacePlayerLeaks;

  const hands = await loadHands(userId);
  if (!Array.isArray(hands) || hands.length === 0) {
    return { firedLeaks: [], totalActions: 0, totalBuckets: 0, heroSeat: null, handCount: 0 };
  }

  const heroSeat = mostCommonHeroSeat(hands);
  if (!heroSeat) {
    return { firedLeaks: [], totalActions: 0, totalBuckets: 0, heroSeat: null, handCount: hands.length };
  }

  const accumulatorOutput = accumulateHeroDecisions({ hands, heroSeat });
  const firedLeaks = detectHeroLeaks(accumulatorOutput);
  await persistLeaks(userId, firedLeaks);

  return {
    firedLeaks,
    totalActions: accumulatorOutput.totalActions,
    totalBuckets: accumulatorOutput.totalBucketCount,
    heroSeat,
    handCount: hands.length,
  };
};
