/**
 * rangeVsBoard.js — range-vs-range equity + derived advantage metrics.
 *
 * Three derived numbers drive the postflop drill's framework outputs:
 *   - rangeVsRangeEquity(A, B, flop) → expected equity of A against B (MC)
 *   - nutAdvantage(A, B, board)      → delta in strict nut-region share (sync)
 *   - whiffRate(range, board)        → % of range in engine's 'air' handType (sync)
 *
 * Nut-advantage definition is hand-type-precise: "nut region" = made straight
 * or better ∪ sets ∪ trips ∪ two-pair. Overpairs and top-pair do NOT count —
 * they belong to the top-pair tier, a separate comparator.
 */

import { handVsRange } from '../pokerCore/monteCarloEquity';
import { enumerateCombos } from '../pokerCore/rangeMatrix';
import { analyzeBoardTexture } from '../pokerCore/boardTexture';
import { computeAdvantage } from '../exploitEngine/rangeSegmenter';
import {
  handTypeBreakdown,
  pctMadeStraightPlus,
  pctSetTripsTwoPair,
  pctAir,
} from './handTypeBreakdown';

/**
 * Weighted range-vs-range equity on a specific board.
 */
export const rangeVsRangeEquity = async (rangeA, rangeB, board, opts = {}) => {
  const { trials = 1200 } = opts;
  const start = Date.now();

  const heroCombos = enumerateCombos(rangeA, board);
  if (heroCombos.length === 0) {
    return { aEq: 0.5, bEq: 0.5, trials: 0, elapsed: 0 };
  }

  let weightedEq = 0;
  let totalWeight = 0;
  let totalTrials = 0;

  for (const hc of heroCombos) {
    if (hc.weight <= 0) continue;
    const hero = [hc.card1, hc.card2];
    const r = await handVsRange(hero, rangeB, board, { trials });
    weightedEq += hc.weight * r.equity;
    totalWeight += hc.weight;
    totalTrials += r.trials;
  }

  const aEq = totalWeight > 0 ? weightedEq / totalWeight : 0.5;
  return {
    aEq,
    bEq: 1 - aEq,
    trials: totalTrials,
    elapsed: Date.now() - start,
  };
};

/**
 * Nut advantage — delta in strict nut-region share between A and B.
 *
 * Nut region = straight+/flushes ∪ sets ∪ trips ∪ two-pair.
 * Excludes overpair and top-pair — those are a separate (top-pair tier) comparator.
 */
export const nutAdvantage = (rangeA, rangeB, board) => {
  const tx = analyzeBoardTexture(board);
  const bdA = handTypeBreakdown(rangeA, board, tx);
  const bdB = handTypeBreakdown(rangeB, board, tx);
  const aNutsPct = pctMadeStraightPlus(bdA) + pctSetTripsTwoPair(bdA);
  const bNutsPct = pctMadeStraightPlus(bdB) + pctSetTripsTwoPair(bdB);
  const delta = (aNutsPct - bNutsPct) * 100;
  return {
    aNutsPct,
    bNutsPct,
    delta,
    favored: delta > 0.5 ? 'A' : delta < -0.5 ? 'B' : null,
    engineA: computeAdvantage(bdA.engine, tx),
    engineB: computeAdvantage(bdB.engine, tx),
  };
};

/**
 * Whiff rate — % of the range in the engine's 'air' handType on this flop.
 * Gutshots + overcards are NOT air — they surface separately via
 * handTypeBreakdown().
 */
export const whiffRate = (range, board) => {
  const tx = analyzeBoardTexture(board);
  return pctAir(handTypeBreakdown(range, board, tx));
};
