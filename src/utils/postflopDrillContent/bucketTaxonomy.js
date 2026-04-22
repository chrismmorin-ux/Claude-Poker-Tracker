/**
 * bucketTaxonomy.js — RT-110 adapter between poker-natural bucket names and
 * the range-segmenter's 22-type native taxonomy.
 *
 * Authored lines reference buckets by the names students actually use when
 * reasoning at the table ("top set", "TPTK", "flush draw", "air"). The
 * game-tree machinery underneath reasons in the 22-type `HAND_TYPES` vocabulary
 * from `rangeSegmenter.js`. This module is the bridge: declare a bucket in
 * authored content, get back the specific combos in hero's range that belong
 * to it on a given board.
 *
 * Pure module. Imports from `pokerCore/` (board/card parsing) and
 * `exploitEngine/rangeSegmenter` (segmentation + hand-type taxonomy) under
 * the INV-08.a exception documented 2026-04-21.
 *
 * ## Taxonomy design
 *
 * Every poker-natural bucket maps to an array of one or more segmenter
 * `HAND_TYPES`. Aggregated buckets (e.g., `flush` = nutFlush + secondFlush +
 * weakFlush) resolve to multiple segmenter types; narrow buckets (e.g.,
 * `nutFlush`) resolve to exactly one.
 *
 * ## Non-goals (RT-110 v1)
 *
 * - Board-relative refinements like `topSet` vs `middleSet` vs `bottomSet`
 *   are not in the v1 table. `set` aggregates all three. Authoring bucket-
 *   by-board-rank-position will ship in a later pass when a canonical line
 *   needs it.
 * - Per-combo equity / EV computation — that's RT-111 (`drillModeEngine`).
 *   This module answers "which combos belong in this bucket," not "what is
 *   the EV of playing them."
 */

import { segmentRange, HAND_TYPES } from '../exploitEngine/rangeSegmenter';
import { analyzeBoardTexture } from '../pokerCore/boardTexture';
import { cardRank, cardSuit } from '../pokerCore/cardParser';

/**
 * Canonical poker-natural bucket taxonomy. Keys are the bucket IDs authored
 * content references; values are frozen arrays of segmenter HAND_TYPES.
 *
 * Every bucket's hand-type list is a subset of `HAND_TYPES`; the bucketTaxonomy
 * test suite asserts this invariant so new segmenter taxa surface as a test
 * failure rather than silent omission.
 */
export const BUCKET_TAXONOMY = Object.freeze({
  // Monster made hands
  straightFlush: Object.freeze(['straightFlush']),
  quads:         Object.freeze(['quads']),
  boat:          Object.freeze(['fullHouse']),
  fullHouse:     Object.freeze(['fullHouse']),

  // Flushes
  flush:         Object.freeze(['nutFlush', 'secondFlush', 'weakFlush']),
  nutFlush:      Object.freeze(['nutFlush']),
  secondFlush:   Object.freeze(['secondFlush']),
  weakFlush:     Object.freeze(['weakFlush']),

  // Straights
  straight:      Object.freeze(['nutStraight', 'nonNutStraight']),
  nutStraight:   Object.freeze(['nutStraight']),

  // Big made-hand tier
  set:           Object.freeze(['set']),
  trips:         Object.freeze(['trips']),
  twoPair:       Object.freeze(['twoPair']),

  // Pair tier
  overpair:      Object.freeze(['overpair']),
  topPair:       Object.freeze(['topPairGood', 'topPairWeak']),
  tptk:          Object.freeze(['topPairGood']),
  topPairWeak:   Object.freeze(['topPairWeak']),
  middlePair:    Object.freeze(['middlePair']),
  bottomPair:    Object.freeze(['bottomPair']),
  weakPair:      Object.freeze(['weakPair']),

  // Draws
  flushDraw:       Object.freeze(['nutFlushDraw', 'nonNutFlushDraw']),
  nutFlushDraw:    Object.freeze(['nutFlushDraw']),
  nonNutFlushDraw: Object.freeze(['nonNutFlushDraw']),
  comboDraw:       Object.freeze(['comboDraw']),
  openEnder:       Object.freeze(['oesd']),
  oesd:            Object.freeze(['oesd']),
  gutshot:         Object.freeze(['gutshot']),
  overcards:       Object.freeze(['overcards']),

  // Nothing
  air:           Object.freeze(['air']),
});

/** All authored bucket IDs known to this adapter. */
export const listKnownBuckets = () => Object.keys(BUCKET_TAXONOMY);

/** Return the segmenter hand-types for a bucket, or null if unknown. */
export const handTypesForBucket = (bucketId) => {
  const entry = BUCKET_TAXONOMY[bucketId];
  return entry ? entry : null;
};

/** Is this a bucket ID the adapter knows about? */
export const isKnownBucket = (bucketId) =>
  typeof bucketId === 'string' && Object.prototype.hasOwnProperty.call(BUCKET_TAXONOMY, bucketId);

/**
 * Enumerate hero combos in a range that fall into a named bucket on a
 * specific board. Returns `null` for an unknown bucketId.
 *
 * @param {{
 *   bucketId: string,
 *   board: number[],        // encoded cards (length 3, 4, or 5)
 *   range: Float64Array,    // 169-cell weighted grid
 *   boardTexture?: object,  // optional precomputed
 * }} args
 * @returns {{
 *   bucketId: string,
 *   segmenterHandTypes: string[],
 *   combos: Array<{ card1: number, card2: number, weight: number, handType: string }>,
 *   sampleSize: number,     // combos.length — consumed by RT-115 callers
 *   totalWeight: number,
 * } | null}
 */
export const enumerateBucketCombos = ({ bucketId, board, range, boardTexture = null }) => {
  const segmenterHandTypes = handTypesForBucket(bucketId);
  if (!segmenterHandTypes) return null;
  if (!Array.isArray(board) || board.length < 3 || board.length > 5) {
    throw new Error(`enumerateBucketCombos: board must have 3-5 encoded cards`);
  }
  const tx = boardTexture || analyzeBoardTexture(board);
  const seg = segmentRange(range, board, [], tx);

  const wanted = new Set(segmenterHandTypes);
  const combos = [];
  let totalWeight = 0;
  for (const c of seg.combos) {
    if (wanted.has(c.handType)) {
      combos.push({
        card1: c.card1,
        card2: c.card2,
        weight: c.weight,
        handType: c.handType,
      });
      totalWeight += c.weight;
    }
  }

  return {
    bucketId,
    segmenterHandTypes: [...segmenterHandTypes],
    combos,
    sampleSize: combos.length,
    totalWeight,
  };
};

/**
 * Board-relative helper: given the board, identify the highest, middle, and
 * lowest ranks among the first three community cards (the flop). Returns
 * ranks in descending order — `null` if the board has fewer than 3 cards.
 *
 * Useful for future refinements like `topSet` / `middleSet` / `bottomSet`;
 * exposed now so downstream modules can depend on a single implementation.
 */
export const flopRanksDescending = (board) => {
  if (!Array.isArray(board) || board.length < 3) return null;
  const ranks = board.slice(0, 3).map(cardRank);
  ranks.sort((a, b) => b - a);
  return ranks;
};

// Re-export segmenter HAND_TYPES so callers that want to cross-check the
// taxonomy don't need a second import line.
export { HAND_TYPES };

// Re-export card helpers for taxonomy-adjacent consumers (avoids fan-out
// imports from the drill layer).
export { cardRank, cardSuit };
