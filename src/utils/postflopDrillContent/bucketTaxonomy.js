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

  // Backdoor-only draws (LSW-G3, 2026-04-22). Air-otherwise hands with
  // runner-runner potential. `backdoorFlushDraw` + `backdoorStraightDraw`
  // are singletons; `backdoorCombo` stacks both. A hand that would have
  // classified as topPair / overpair / direct draw stays under its
  // primary shape — per-combo surfacing of "TP + BDFD" is the LSW-H2
  // hero-combo-specific EV row, not a bucket.
  backdoorFlushDraw:    Object.freeze(['airBackdoorFlush', 'airBackdoorCombo']),
  backdoorStraightDraw: Object.freeze(['airBackdoorStraight', 'airBackdoorCombo']),
  backdoorCombo:        Object.freeze(['airBackdoorCombo']),

  // Nothing
  air:           Object.freeze(['air']),
});

/**
 * Plain-language 1-sentence definitions for every bucket. Drives the inline
 * glossary (P6b GlossaryBlock per `bucket-ev-panel-v2` spec) and the
 * tap-for-definition popover on bucket labels. Every BUCKET_TAXONOMY key
 * has a matching entry — the test suite enforces 1:1 coverage so new
 * taxonomy additions surface as missing-definition test failures.
 *
 * Definitions are student-language, not developer-language: prefer "A flush
 * using the nut-suit card" over "nutFlush handType."
 */
export const BUCKET_DEFINITIONS = Object.freeze({
  // Monster made hands
  straightFlush: 'A straight and a flush at the same time — five consecutive cards all the same suit.',
  quads:         'Four of a kind.',
  boat:          'A full house — three of a kind plus a pair.',
  fullHouse:     'A full house — three of a kind plus a pair.',

  // Flushes
  flush:         'Five cards of the same suit. Combines nut-flush / K-high flush / low flush.',
  nutFlush:      'A flush using the nut-suit card — cannot be beaten by another flush.',
  secondFlush:   'A K-high flush — loses only to the ace-high nut flush.',
  weakFlush:     'A flush below K-high — can be outflushed by a bigger flush.',

  // Straights
  straight:      'Five consecutive cards — combines nut and non-nut straights.',
  nutStraight:   'The highest possible straight on this board — cannot be outstraighted.',

  // Big made-hand tier
  set:           'Three of a kind using a pocket pair — two of your hand cards hit the board-rank.',
  trips:         'Three of a kind using one of your cards plus a paired board.',
  twoPair:       'Two pairs using both your hole cards with the board.',

  // Pair tier
  overpair:      'A pocket pair larger than any card on the board.',
  topPair:       'A pair using the highest board card. Combines good-kicker and weak-kicker variants.',
  tptk:          'Top pair with a strong kicker (A or K usually) — the top of the top-pair region.',
  topPairWeak:   'Top pair with a weak kicker — beaten by same top-pair + better kicker.',
  middlePair:    'A pair using the middle-ranked board card.',
  bottomPair:    'A pair using the lowest-ranked board card.',
  weakPair:      'An under-pair (pocket pair smaller than the lowest board card).',

  // Draws
  flushDraw:       'Four cards of the same suit, one card away from a flush.',
  nutFlushDraw:    'A flush draw using the nut-suit card — the best flush draw.',
  nonNutFlushDraw: 'A flush draw that would not make the nut flush.',
  comboDraw:       'A flush draw plus a straight draw on the same hand — high equity semi-bluff.',
  openEnder:       'An open-ended straight draw — four consecutive cards, 8 outs to a straight.',
  oesd:            'An open-ended straight draw — four consecutive cards, 8 outs to a straight.',
  gutshot:         'An inside straight draw — needs one specific rank, 4 outs.',
  overcards:       'Two unpaired cards higher than every board card — equity from pairing up or bluff value.',

  // Backdoor-only draws
  backdoorFlushDraw:    'One card of a suit plus two on the board — runner-runner flush potential.',
  backdoorStraightDraw: 'Three consecutive cards across hand and board — runner-runner straight potential.',
  backdoorCombo:        'Both backdoor flush draw and backdoor straight draw in the same hand.',

  // Nothing
  air:           'No pair, no draw, no showdown value — just high-card.',
});

/**
 * Display names for bucket IDs — used by the `BucketLabel` primitive in the
 * v2 panel so students see natural-language labels ("Top pair, good kicker")
 * rather than developer shorthand ("topPairGood").
 */
export const BUCKET_DISPLAY_NAMES = Object.freeze({
  straightFlush: 'Straight flush',
  quads: 'Quads',
  boat: 'Full house',
  fullHouse: 'Full house',
  flush: 'Flush',
  nutFlush: 'Nut flush',
  secondFlush: 'K-high flush',
  weakFlush: 'Low flush',
  straight: 'Straight',
  nutStraight: 'Nut straight',
  set: 'Set',
  trips: 'Trips',
  twoPair: 'Two pair',
  overpair: 'Overpair',
  topPair: 'Top pair',
  tptk: 'Top pair, top kicker',
  topPairWeak: 'Top pair, weak kicker',
  middlePair: 'Middle pair',
  bottomPair: 'Bottom pair',
  weakPair: 'Weak / underpair',
  flushDraw: 'Flush draw',
  nutFlushDraw: 'Nut flush draw',
  nonNutFlushDraw: 'Non-nut flush draw',
  comboDraw: 'Combo draw (FD + straight)',
  openEnder: 'Open-ended straight draw',
  oesd: 'Open-ended straight draw',
  gutshot: 'Gutshot',
  overcards: 'Overcards',
  backdoorFlushDraw: 'Backdoor flush draw',
  backdoorStraightDraw: 'Backdoor straight draw',
  backdoorCombo: 'Backdoor combo (FD + straight)',
  air: 'Air',
});

/**
 * Resolve a bucket ID to its display name, falling back to the ID itself
 * when unknown (so new taxonomy entries aren't invisible in the UI while
 * their display entry is authored).
 */
export const displayNameForBucket = (bucketId) =>
  BUCKET_DISPLAY_NAMES[bucketId] || bucketId;

/**
 * Resolve a bucket ID to its 1-sentence definition, returning null when
 * unknown (caller decides whether to fallback).
 */
export const definitionForBucket = (bucketId) =>
  BUCKET_DEFINITIONS[bucketId] || null;

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
