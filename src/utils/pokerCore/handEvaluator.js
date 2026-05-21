/**
 * handEvaluator.js - 5-card hand ranking as comparable integers
 *
 * Encoding (32-bit int):
 *   Bits 20-23: Category (0=high card .. 8=straight flush)
 *   Bits 16-19: Primary rank
 *   Bits 12-15: Secondary rank
 *   Bits 0-11: Kickers (packed 4 bits each, up to 3)
 */

import { cardRank, cardSuit } from './cardParser';

// Pre-allocated buffers for evaluate5().
// Safe because JS is single-threaded and the Monte Carlo runBatch loop is synchronous.
// Async chunking yields only between batches via setTimeout, never mid-evaluation.
const _ranks = new Int8Array(5);
const _suits = new Int8Array(5);
const _sorted = new Int8Array(5);
const _freq = new Uint8Array(13);
const _hand5 = new Array(5);

// Hand categories
export const HAND_CATEGORIES = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
};

const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
];

const packScore = (category, primary, secondary, kickers) => {
  let score = (category << 20) | (primary << 16) | (secondary << 12);
  for (let i = 0; i < kickers.length && i < 3; i++) {
    score |= (kickers[i] << (8 - i * 4));
  }
  return score;
};

/**
 * Check for a straight in sorted descending ranks.
 * Returns the high card rank of the straight, or -1.
 */
const findStraight = (sortedDesc) => {
  // Normal straight check
  for (let i = 0; i <= sortedDesc.length - 5; i++) {
    if (sortedDesc[i] - sortedDesc[i + 4] === 4) {
      // Verify consecutive
      let consecutive = true;
      for (let j = i; j < i + 4; j++) {
        if (sortedDesc[j] - sortedDesc[j + 1] !== 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) return sortedDesc[i];
    }
  }
  // Wheel: A-2-3-4-5
  if (sortedDesc[0] === 12 && sortedDesc.includes(3) &&
      sortedDesc.includes(2) && sortedDesc.includes(1) && sortedDesc.includes(0)) {
    return 3; // 5-high straight
  }
  return -1;
};

/**
 * Evaluate a 5-card hand and return a comparable integer score.
 * Higher score = better hand.
 * @param {number[]} cards - Array of 5 encoded card integers
 * @returns {number} Hand score
 */
export const evaluate5 = (cards) => {
  if (!cards || cards.length !== 5) return 0;

  // Use pre-allocated buffers instead of .map() allocations
  for (let i = 0; i < 5; i++) {
    _ranks[i] = cardRank(cards[i]);
    _suits[i] = cardSuit(cards[i]);
    _sorted[i] = _ranks[i];
  }

  // In-place insertion sort descending (5 elements)
  for (let i = 1; i < 5; i++) {
    const val = _sorted[i];
    let j = i - 1;
    while (j >= 0 && _sorted[j] < val) {
      _sorted[j + 1] = _sorted[j];
      j--;
    }
    _sorted[j + 1] = val;
  }

  // Check flush
  const isFlush = _suits[0] === _suits[1] && _suits[1] === _suits[2] &&
                  _suits[2] === _suits[3] && _suits[3] === _suits[4];

  // Check straight
  const straightHigh = findStraight(_sorted);
  const isStraight = straightHigh >= 0;

  // Build frequency map (reuse pre-allocated buffer)
  _freq.fill(0);
  for (let i = 0; i < 5; i++) _freq[_ranks[i]]++;

  // Group by frequency using length counters instead of push-arrays
  let quad0 = -1, trip0 = -1;
  let pair0 = -1, pair1 = -1;
  let single0 = -1, single1 = -1, single2 = -1;
  let pairCount = 0;

  for (let r = 12; r >= 0; r--) {
    const f = _freq[r];
    if (f === 4) quad0 = r;
    else if (f === 3) trip0 = r;
    else if (f === 2) {
      if (pairCount === 0) pair0 = r;
      else pair1 = r;
      pairCount++;
    } else if (f === 1) {
      if (single0 === -1) single0 = r;
      else if (single1 === -1) single1 = r;
      else single2 = r;
    }
  }

  // Straight flush
  if (isFlush && isStraight) {
    return packScore(HAND_CATEGORIES.STRAIGHT_FLUSH, straightHigh, 0, []);
  }

  // Four of a kind
  if (quad0 >= 0) {
    // Kicker is the single card
    return packScore(HAND_CATEGORIES.FOUR_OF_A_KIND, quad0, single0, []);
  }

  // Full house
  if (trip0 >= 0 && pairCount === 1) {
    return packScore(HAND_CATEGORIES.FULL_HOUSE, trip0, pair0, []);
  }

  // Flush
  if (isFlush) {
    return packScore(HAND_CATEGORIES.FLUSH, _sorted[0], _sorted[1], [_sorted[2], _sorted[3], _sorted[4]]);
  }

  // Straight
  if (isStraight) {
    return packScore(HAND_CATEGORIES.STRAIGHT, straightHigh, 0, []);
  }

  // Three of a kind
  if (trip0 >= 0) {
    return packScore(HAND_CATEGORIES.THREE_OF_A_KIND, trip0, single0, [single1]);
  }

  // Two pair
  if (pairCount === 2) {
    return packScore(HAND_CATEGORIES.TWO_PAIR, pair0, pair1, [single0]);
  }

  // Pair
  if (pairCount === 1) {
    return packScore(HAND_CATEGORIES.PAIR, pair0, single0, [single1, single2]);
  }

  // High card
  return packScore(HAND_CATEGORIES.HIGH_CARD, _sorted[0], _sorted[1], [_sorted[2], _sorted[3], _sorted[4]]);
};

/**
 * Pre-computed C(n,5) index combinations for best-hand selection.
 */
const buildCombos = (n) => {
  const out = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++)
            out.push([a, b, c, d, e]);
  return out;
};
const COMBOS_6_5 = buildCombos(6); // C(6,5) = 6  — turn (2 hole + 4 board)
const COMBOS_7_5 = buildCombos(7); // C(7,5) = 21 — river (2 hole + 5 board)

/**
 * Find the best 5-card hand from 5-7 cards.
 * @param {number[]} cards - Array of 5-7 encoded card integers
 * @returns {number} Best hand score
 */
export const bestFiveFromSeven = (cards) => {
  if (!cards || cards.length < 5) return 0;
  if (cards.length === 5) return evaluate5(cards);

  const combos = cards.length === 6 ? COMBOS_6_5 : COMBOS_7_5;
  let best = 0;
  for (const combo of combos) {
    for (let k = 0; k < 5; k++) _hand5[k] = cards[combo[k]];
    const score = evaluate5(_hand5);
    if (score > best) best = score;
  }
  return best;
};

/**
 * Get the category name from a hand score.
 * @param {number} score - Hand evaluation score
 * @returns {string} Category name
 */
export const handCategory = (score) => {
  const cat = (score >> 20) & 0xF;
  return CATEGORY_NAMES[cat] || 'Unknown';
};

// =============================================================================
// VILLAIN STRENGTH BUCKET (board-relative, hero-agnostic)
// =============================================================================
// Per WS-194 / memory feedback_river_equity_is_showdown_outcome.md:
// classify each 2-card combo on a fixed postflop board into a rank-relative
// strength tier. The bucket reflects how strong this combo's CURRENT 5-card
// hand is vs every other legal combo on the same board (no hero card
// dependency, no range context). Consumers (e.g., Basin classifier) use the
// strength-tier histogram of a villain's range to expose bluff content.

export const STRENGTH_BUCKETS = ['nuts', 'very-strong', 'strong', 'marginal', 'weak-or-bluff'];

// Cumulative percentile band ceilings (top of each tier). Ties on score group
// together; the group's bucket is decided by the percentile of its FIRST
// member, so a tie straddling a boundary lands in the higher tier.
const STRENGTH_BAND_TOPS = [0.05, 0.20, 0.50, 0.80, 1.00];

const bucketForPercentile = (p) => {
  if (p < STRENGTH_BAND_TOPS[0]) return STRENGTH_BUCKETS[0];
  if (p < STRENGTH_BAND_TOPS[1]) return STRENGTH_BUCKETS[1];
  if (p < STRENGTH_BAND_TOPS[2]) return STRENGTH_BUCKETS[2];
  if (p < STRENGTH_BAND_TOPS[3]) return STRENGTH_BUCKETS[3];
  return STRENGTH_BUCKETS[4];
};

// Order-independent integer key for an unordered 2-card combo. Cards are
// 0-51; the key fits in ~2,700 max so a Map<number, string> is compact.
const comboKey = (c1, c2) => (c1 < c2 ? c1 * 52 + c2 : c2 * 52 + c1);

/**
 * Compute the board-relative strength table for a postflop board.
 *
 * Enumerates every legal 2-card combo (skips combos using any board card),
 * scores each via bestFiveFromSeven, sorts descending, then assigns a
 * STRENGTH_BUCKETS tier by percentile. Combos with identical scores share
 * the bucket of the group's first member (ties get the higher tier when
 * they straddle a boundary).
 *
 * Returns an empty Map for invalid boards (length < 3).
 *
 * @param {number[]} board - 3, 4, or 5 encoded board cards
 * @returns {Map<number, string>} comboKey -> bucket name
 */
export const computeBoardStrengthTable = (board) => {
  const table = new Map();
  if (!Array.isArray(board) || board.length < 3 || board.length > 5) {
    return table;
  }

  const boardSet = new Set(board);
  const entries = [];
  for (let a = 0; a < 52; a++) {
    if (boardSet.has(a)) continue;
    for (let b = a + 1; b < 52; b++) {
      if (boardSet.has(b)) continue;
      const score = bestFiveFromSeven([a, b, ...board]);
      entries.push({ key: comboKey(a, b), score });
    }
  }
  const total = entries.length;
  if (total === 0) return table;

  // Sort by score desc. Tie-stable order across runs (a, b ascending order
  // is preserved because the inner loop visits combos in a deterministic
  // sequence, and Array.prototype.sort with a comparator that only depends
  // on score keeps tied items adjacent — exact within-tie order is
  // irrelevant since the whole tie group shares one bucket).
  entries.sort((x, y) => y.score - x.score);

  // Walk groups by score. The percentile assigned to a group is the
  // starting-index percentile (group's first member). Every combo in the
  // group inherits that bucket.
  let i = 0;
  while (i < total) {
    const groupScore = entries[i].score;
    const groupStartIndex = i;
    const percentile = groupStartIndex / total;
    const bucket = bucketForPercentile(percentile);
    while (i < total && entries[i].score === groupScore) {
      table.set(entries[i].key, bucket);
      i++;
    }
  }

  return table;
};

/**
 * Classify a single villain combo on a board into its strength bucket.
 *
 * Returns null if either combo card collides with a board card (invalid
 * combo — villain can't hold a card that's on the public board). Returns
 * null for boards with fewer than 3 cards (preflop has no current-strength
 * concept — equity-by-runout is the right primitive there, not bucket).
 *
 * Optional `table` parameter amortizes the ~1,200-combo enumeration cost
 * across many classifications on the same board. Callers iterating
 * segCombos for one board should call computeBoardStrengthTable once and
 * pass the result here.
 *
 * @param {number} card1 - First combo card (0-51)
 * @param {number} card2 - Second combo card (0-51)
 * @param {number[]} board - 3, 4, or 5 encoded board cards
 * @param {Map<number, string> | null} table - optional pre-computed table
 * @returns {string | null} STRENGTH_BUCKETS member or null
 */
export const classifyVillainCombo = (card1, card2, board, table = null) => {
  if (!Array.isArray(board) || board.length < 3 || board.length > 5) return null;
  if (board.includes(card1) || board.includes(card2)) return null;
  if (card1 === card2) return null;
  const t = table ?? computeBoardStrengthTable(board);
  return t.get(comboKey(card1, card2)) ?? null;
};
