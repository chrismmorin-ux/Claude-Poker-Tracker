/**
 * handTypeBreakdown.js — precise hand-type distribution for a range on a flop.
 *
 * Replaces the earlier 6-bucket abstraction (nuts/strong/topPair/medium/weakDraw/air)
 * with the engine's native 22-type taxonomy (see `HAND_TYPES` in
 * `exploitEngine/rangeSegmenter.js`): straightFlush, quads, fullHouse, nutFlush,
 * secondFlush, weakFlush, nutStraight, nonNutStraight, set, trips, twoPair,
 * overpair, topPairGood, topPairWeak, middlePair, bottomPair, weakPair,
 * comboDraw, nutFlushDraw, nonNutFlushDraw, oesd, gutshot, overcards, air.
 *
 * Per hand type we also surface:
 *   - avgDrawOuts       — straight/flush draw outs (engine's detectDraws)
 *   - avgImprovementOuts — pair→trips, two-pair→boat, overcard→pair, etc.
 *   - avgTotalEquityOuts — combined equity outs (what actually pulls equity)
 *
 * These numbers are what Hero needs to reason precisely: "22% overpair with 5
 * improvement outs each" vs "14% overcards with 6 pair-outs" beats any
 * fuzzy "topPair" / "medium" labeling, especially on two-tone or multi-
 * broadway boards where precision determines correct sizing and continue
 * thresholds.
 *
 * Pure module — wraps engine's `segmentRange` + `classifyComboFull`.
 */

import { analyzeBoardTexture } from '../pokerCore/boardTexture';
import {
  segmentRange,
  HAND_TYPES,
  HAND_TYPE_GROUPS,
  HAND_TYPE_LABELS,
} from '../exploitEngine/rangeSegmenter';
import { classifyComboFull } from '../exploitEngine/postflopNarrower';

export { HAND_TYPES, HAND_TYPE_GROUPS, HAND_TYPE_LABELS };

/**
 * Minimum distinct combos for a per-bucket average to be considered reliable
 * teaching content. Buckets below this floor are flagged `lowConfidence` so
 * the UI can caveat (or suppress) numeric precision. Ships with RT-115 and
 * is consumed by bucket-EV surfaces shipped under RT-111 onwards.
 */
export const MIN_COMBO_SAMPLE = 3;

/**
 * Produce the per-hand-type breakdown of a weighted range on a flop.
 *
 * @param {Float64Array} range        — 169-cell weighted grid
 * @param {number[]} board             — 3 encoded flop cards
 * @param {object} [boardTexture]       — optional precomputed texture
 * @returns {{
 *   handTypes: Record<string, {
 *     count: number, weight: number, pct: number,
 *     avgDrawOuts: number, avgImprovementOuts: number, avgTotalEquityOuts: number,
 *   }>,
 *   byGroup: Record<string, {
 *     id: string, label: string, totalCount: number, totalPct: number, totalWeight: number,
 *     types: Array<{id, label, count, weight, pct, avgDrawOuts, avgImprovementOuts, avgTotalEquityOuts}>,
 *   }>,
 *   totalWeight: number,
 *   totalCombos: number,
 *   isCapped: boolean,
 *   isWeaklyCapped: boolean,
 *   engine: object,  // raw segmentRange output
 * }}
 */
export const handTypeBreakdown = (range, board, boardTexture = null) => {
  if (!board || board.length !== 3) {
    throw new Error('handTypeBreakdown: flop must be 3 encoded cards');
  }
  const tx = boardTexture || analyzeBoardTexture(board);
  const seg = segmentRange(range, board, [], tx);

  // Initialize per-type accumulators.
  const perType = {};
  for (const ht of HAND_TYPES) {
    perType[ht] = {
      count: 0,
      weight: 0,
      pct: 0,
      avgDrawOuts: 0,
      avgImprovementOuts: 0,
      avgTotalEquityOuts: 0,
      sampleSize: 0,        // RT-115 — alias of count, explicit teaching-layer field
      lowConfidence: false,  // RT-115 — true when 0 < count < MIN_COMBO_SAMPLE
    };
  }

  // Walk combos: engine already did classifyComboFull via its internal cache,
  // but didn't expose improvementOuts/totalEquityOuts in the combos[] output.
  // We re-classify per combo — `classifyComboFull` is cheap (single 5-card
  // evaluate + draws detection), and typical ranges have <1500 combos.
  for (const c of seg.combos) {
    const full = classifyComboFull(c.card1, c.card2, board, tx);
    const acc = perType[c.handType];
    if (!acc) continue; // shouldn't happen, but defensive
    const w = c.weight;
    acc.count += 1;
    acc.weight += w;
    acc.avgDrawOuts += (full.drawOuts || 0) * w;
    acc.avgImprovementOuts += (full.improvementOuts || 0) * w;
    acc.avgTotalEquityOuts += (full.totalEquityOuts || 0) * w;
  }

  // Normalize — convert weighted sums of outs to weighted averages.
  const total = seg.totalWeight;
  for (const ht of HAND_TYPES) {
    const acc = perType[ht];
    acc.pct = total > 0 ? acc.weight / total : 0;
    if (acc.weight > 0) {
      acc.avgDrawOuts /= acc.weight;
      acc.avgImprovementOuts /= acc.weight;
      acc.avgTotalEquityOuts /= acc.weight;
    }
    // RT-115: expose sample-size + low-confidence flag. Absent-bucket
    // (count=0) is not "low confidence" — it's just not part of the range.
    acc.sampleSize = acc.count;
    acc.lowConfidence = acc.count > 0 && acc.count < MIN_COMBO_SAMPLE;
  }

  // Build group aggregation for the UI.
  const byGroup = {};
  for (const [groupId, group] of Object.entries(HAND_TYPE_GROUPS)) {
    const types = group.types.map((ht) => ({
      id: ht,
      label: HAND_TYPE_LABELS[ht] || ht,
      ...perType[ht],
    }));
    const totalCount = types.reduce((s, t) => s + t.count, 0);
    byGroup[groupId] = {
      id: groupId,
      label: group.label,
      types,
      totalCount,
      totalWeight: types.reduce((s, t) => s + t.weight, 0),
      totalPct:    types.reduce((s, t) => s + t.pct, 0),
      // RT-115: group-level sample-size flag mirrors per-type semantics.
      sampleSize: totalCount,
      lowConfidence: totalCount > 0 && totalCount < MIN_COMBO_SAMPLE,
    };
  }

  return {
    handTypes: perType,
    byGroup,
    totalCombos: seg.totalCombos,
    totalWeight: total,
    isCapped: seg.isCapped,
    isWeaklyCapped: seg.isWeaklyCapped,
    engine: seg,
  };
};

/**
 * Aggregate helpers for framework narrations and advantage comparisons.
 * All return weighted %s (0..1) of the range.
 */

/** Made flush or better (straight flush, quads, boat, any flush). */
export const pctMadeFlushPlus = (bd) => (
  bd.handTypes.straightFlush.pct +
  bd.handTypes.quads.pct +
  bd.handTypes.fullHouse.pct +
  bd.handTypes.nutFlush.pct +
  bd.handTypes.secondFlush.pct +
  bd.handTypes.weakFlush.pct
);

/** Made straight or better. */
export const pctMadeStraightPlus = (bd) => (
  pctMadeFlushPlus(bd) +
  bd.handTypes.nutStraight.pct +
  bd.handTypes.nonNutStraight.pct
);

/** Set, trips, or two-pair (strong made that's not straight+). */
export const pctSetTripsTwoPair = (bd) => (
  bd.handTypes.set.pct +
  bd.handTypes.trips.pct +
  bd.handTypes.twoPair.pct
);

/** Any made hand of at least pair (includes all one-pair types). */
export const pctAnyPairPlus = (bd) => (
  pctMadeStraightPlus(bd) +
  pctSetTripsTwoPair(bd) +
  bd.handTypes.overpair.pct +
  bd.handTypes.topPairGood.pct +
  bd.handTypes.topPairWeak.pct +
  bd.handTypes.middlePair.pct +
  bd.handTypes.bottomPair.pct +
  bd.handTypes.weakPair.pct
);

/** Top pair or better (everything that beats middle pair). */
export const pctTopPairPlus = (bd) => (
  pctMadeStraightPlus(bd) +
  pctSetTripsTwoPair(bd) +
  bd.handTypes.overpair.pct +
  bd.handTypes.topPairGood.pct +
  bd.handTypes.topPairWeak.pct
);

/** Made draws strong enough to be semi-bluff candidates (comboDraw, FD, OESD). */
export const pctStrongDraws = (bd) => (
  bd.handTypes.comboDraw.pct +
  bd.handTypes.nutFlushDraw.pct +
  bd.handTypes.nonNutFlushDraw.pct +
  bd.handTypes.oesd.pct
);

/** Weak draws: gutshot + overcards. */
export const pctWeakDraws = (bd) => (
  bd.handTypes.gutshot.pct +
  bd.handTypes.overcards.pct
);

/** Air (no made hand, no meaningful outs). */
export const pctAir = (bd) => bd.handTypes.air.pct;
