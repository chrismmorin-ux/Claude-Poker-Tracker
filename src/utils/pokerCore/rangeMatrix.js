/**
 * rangeMatrix.js - 13x13 range grid for preflop hand ranges
 *
 * Grid layout: row = rank1 (high), col = rank2 (low)
 *   - row < col: suited combos (upper triangle)
 *   - row > col: offsuit combos (lower triangle)
 *   - row === col: pocket pairs (diagonal)
 *
 * Rank indices: 0=2, 1=3, ..., 12=A (matching cardParser)
 */

import { TOTAL_CARDS, encodeCard, cardRank, cardSuit } from './cardParser';

const GRID_SIZE = 169;

/**
 * Create an empty range (all weights 0).
 */
export const createRange = () => new Float64Array(GRID_SIZE);

/**
 * Get grid index from two rank values.
 * Convention: higher rank is row, lower rank is col.
 * Suited = upper triangle (row < col in display), offsuit = lower triangle.
 * @param {number} rank1 - First card rank (0-12)
 * @param {number} rank2 - Second card rank (0-12)
 * @param {boolean} suited
 * @returns {number} Grid index 0-168
 */
export const rangeIndex = (rank1, rank2, suited) => {
  const high = Math.max(rank1, rank2);
  const low = Math.min(rank1, rank2);
  if (high === low) return high * 13 + low; // pair on diagonal
  // Suited: high is row, low is col (upper-right triangle)
  // Offsuit: low is row, high is col (lower-left triangle)
  return suited ? (high * 13 + low) : (low * 13 + high);
};

/**
 * Decode grid index back to hand description.
 * @param {number} idx
 * @returns {{ rank1: number, rank2: number, suited: boolean, isPair: boolean }}
 */
export const decodeIndex = (idx) => {
  const row = Math.floor(idx / 13);
  const col = idx % 13;
  if (row === col) return { rank1: row, rank2: col, suited: false, isPair: true };
  const high = Math.max(row, col);
  const low = Math.min(row, col);
  // Upper triangle (row > col in our layout) = suited
  const suited = row > col;
  return { rank1: high, rank2: low, suited, isPair: false };
};

// ========== PREFLOP CHARTS ==========
// Weights 0.0-1.0 for standard opening ranges by position
// Encoded as hand strings for readability, then converted to grid

const RANK_CHARS = '23456789TJQKA';
const rankFromChar = (c) => RANK_CHARS.indexOf(c);

/**
 * Parse a range string like "AA,KK,QQ,AKs,AQs,AKo" into a range grid.
 */
export const parseRangeString = (str) => {
  const range = createRange();
  const parts = str.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('+')) {
      // Range notation: "TT+" or "ATs+"
      const base = trimmed.replace('+', '');
      if (base.length === 2 && base[0] === base[1]) {
        // Pair+: "66+" means 66,77,88,...,AA
        const r = rankFromChar(base[0]);
        for (let i = r; i <= 12; i++) range[rangeIndex(i, i, false)] = 1.0;
      } else if (base.length === 3) {
        // "ATs+" means ATs,AJs,AQs,AKs (keep high card, raise kicker)
        const high = rankFromChar(base[0]);
        const low = rankFromChar(base[1]);
        const suited = base[2] === 's';
        for (let i = low; i < high; i++) range[rangeIndex(high, i, suited)] = 1.0;
      }
    } else if (trimmed.length === 2) {
      // Pair: "AA"
      const r = rankFromChar(trimmed[0]);
      if (r >= 0) range[rangeIndex(r, r, false)] = 1.0;
    } else if (trimmed.length === 3) {
      // Single hand: "AKs" or "AKo"
      const r1 = rankFromChar(trimmed[0]);
      const r2 = rankFromChar(trimmed[1]);
      const suited = trimmed[2] === 's';
      if (r1 >= 0 && r2 >= 0) range[rangeIndex(r1, r2, suited)] = 1.0;
    }
  }
  return range;
};

// GTO-approximate opening (RFI) ranges from solver data, 9-max 100bb cash
// Sources: PokerCoaching 9-max charts, TightPoker range guides, RangeConverter
export const PREFLOP_CHARTS = {
  UTG: parseRangeString('66+,A9s+,A5s,KTs+,QTs+,JTs,T9s,98s,AQo+'),
  'UTG+1': parseRangeString('66+,A4s+,K9s+,Q9s+,J9s+,T9s,98s,AJo+,KQo'),
  MP1: parseRangeString('66+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,AJo+,KQo'),
  MP2: parseRangeString('44+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,ATo+,KJo+'),
  HJ: parseRangeString('22+,A2s+,K8s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,54s,ATo+,KJo+'),
  CO: parseRangeString('22+,A2s+,K7s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,64s+,54s,43s,A9o+,KJo+'),
  BTN: parseRangeString('22+,A2s+,K2s+,Q2s+,J6s+,T6s+,96s+,85s+,75s+,64s+,53s+,43s,32s,A2o+,K7o+,Q8o+,J8o+,T8o+,97o+,87o,76o'),
  SB: parseRangeString('22+,A2s+,K8s+,Q9s+,J9s+,T8s+,97s+,86s+,76s,65s,54s,A8o+,KTo+,QTo+,JTo,T9o'),
  BB: parseRangeString('22+,A2s+,K4s+,Q7s+,J7s+,T7s+,97s+,86s+,76s,75s,65s,64s,54s,53s,43s,A6o+,K9o+,Q9o+,J9o+,T9o,98o,87o'),
};

/**
 * Get approximate range width (% of hands) for a range grid.
 * Suited combos = 4, offsuit combos = 12, pairs = 6.
 */
export const rangeWidth = (range) => {
  let totalCombos = 0;
  for (let idx = 0; idx < GRID_SIZE; idx++) {
    if (range[idx] <= 0) continue;
    const { isPair, suited } = decodeIndex(idx);
    const combos = isPair ? 6 : suited ? 4 : 12;
    totalCombos += combos * range[idx];
  }
  return Math.round((totalCombos / 1326) * 100);
};

/**
 * Map 5-category positions to PREFLOP_CHARTS keys for GTO comparison.
 */
export const POSITION_GTO_KEYS = {
  EARLY: ['UTG', 'UTG+1'],
  MIDDLE: ['MP1', 'MP2'],
  LATE: ['HJ', 'CO', 'BTN'],
  SB: ['SB'],
  BB: ['BB'],
};

/**
 * Average multiple GTO chart ranges into one.
 * @param {...string} positionKeys - Keys into PREFLOP_CHARTS
 * @returns {Float64Array}
 */
export const averageCharts = (...positionKeys) => {
  const result = createRange();
  const n = positionKeys.length;
  for (const key of positionKeys) {
    const chart = PREFLOP_CHARTS[key];
    if (!chart) continue;
    for (let i = 0; i < GRID_SIZE; i++) {
      result[i] += chart[i] / n;
    }
  }
  return result;
};

/**
 * Enumerate actual card combos from a range, excluding dead cards.
 * @param {Float64Array} range - Range grid
 * @param {number[]} deadCards - Array of encoded dead cards
 * @returns {Array<{card1: number, card2: number, weight: number}>}
 */
export const enumerateCombos = (range, deadCards = []) => {
  const dead = new Set(deadCards);
  const combos = [];

  for (let idx = 0; idx < GRID_SIZE; idx++) {
    if (range[idx] <= 0) continue;

    const { rank1, rank2, suited, isPair } = decodeIndex(idx);

    if (isPair) {
      // 6 combos for pairs
      for (let s1 = 0; s1 < 4; s1++) {
        for (let s2 = s1 + 1; s2 < 4; s2++) {
          const c1 = encodeCard(rank1, s1);
          const c2 = encodeCard(rank2, s2);
          if (!dead.has(c1) && !dead.has(c2)) {
            combos.push({ card1: c1, card2: c2, weight: range[idx] });
          }
        }
      }
    } else if (suited) {
      // 4 suited combos
      for (let s = 0; s < 4; s++) {
        const c1 = encodeCard(rank1, s);
        const c2 = encodeCard(rank2, s);
        if (!dead.has(c1) && !dead.has(c2)) {
          combos.push({ card1: c1, card2: c2, weight: range[idx] });
        }
      }
    } else {
      // 12 offsuit combos
      for (let s1 = 0; s1 < 4; s1++) {
        for (let s2 = 0; s2 < 4; s2++) {
          if (s1 === s2) continue;
          const c1 = encodeCard(rank1, s1);
          const c2 = encodeCard(rank2, s2);
          if (!dead.has(c1) && !dead.has(c2)) {
            combos.push({ card1: c1, card2: c2, weight: range[idx] });
          }
        }
      }
    }
  }

  return combos;
};
