/**
 * equityDecomposition.js — break down hand-vs-hand equity by made-hand bucket.
 *
 * For a given hand-vs-hand matchup, enumerate all C(48,5) boards and categorize
 * each board by hero's final made-hand category (high-card, weak pair, top
 * pair / overpair, two pair, set, straight, flush, full house, quads, straight
 * flush). For each bucket we report:
 *   - hitRate:          fraction of boards where hero's best 5 is that category
 *   - winShare:         fraction of boards where hero wins AND hero's hand is
 *                       that category (sums to hero's total win rate)
 *   - tieShare:         same but for ties
 *   - conditionalWin:   winShare / hitRate — "given I make this, how often does
 *                       it win?"
 *   - equityShare:      winShare + 0.5 * tieShare — contribution to total equity
 *
 * The sum of equityShare across all buckets equals total equity from
 * computeHandVsHand.
 *
 * The "pair" category is split into two buckets to reflect how players think
 * about strength at the table:
 *   - TOP_PAIR_OR_OVERPAIR: hero's pair rank is >= the highest board rank.
 *     Includes overpairs (pocket pair with no overcard on board) and
 *     top-pair-of-board (pairing the highest community card).
 *   - WEAK_PAIR: any other pair (underpair, middle pair, bottom pair,
 *     second pair, etc.).
 *
 * Pure module — depends only on preflopEquity.js internals that are exported
 * (parseHandClass, enumerateHandCombos, evaluate7) and on cardParser.js
 * constants (TOTAL_CARDS).
 */

import { TOTAL_CARDS } from './cardParser';
import {
  evaluate7,
  parseHandClass,
  enumerateHandCombos,
  handClassToNotation,
} from './preflopEquity';

// Bucket IDs. Ordered weakest → strongest so stacked-bar UIs render
// naturally (weakest on left).
export const BUCKETS = Object.freeze({
  HIGH_CARD:             0,
  WEAK_PAIR:             1,
  TOP_PAIR_OR_OVERPAIR:  2,
  TWO_PAIR:              3,
  SET:                   4,
  STRAIGHT:              5,
  FLUSH:                 6,
  FULL_HOUSE:            7,
  QUADS:                 8,
  STRAIGHT_FLUSH:        9,
});

export const BUCKET_COUNT = 10;

export const BUCKET_LABELS = [
  'High card',
  'Weak pair',
  'Top pair / Overpair',
  'Two pair',
  'Set / Trips',
  'Straight',
  'Flush',
  'Full house',
  'Quads',
  'Straight flush',
];

// Short labels for compact UI.
export const BUCKET_SHORT = [
  'High',
  'Weak pr',
  'TP/OP',
  '2pr',
  'Set',
  'Str',
  'Flush',
  'Full',
  'Quads',
  'SF',
];

// ---------- Bucket classification ---------- //

/**
 * Convert an evaluate7 score + board max rank into a bucket id.
 *
 * Score bit layout (from handEvaluator / preflopEquity):
 *   Bits 20-23: category  (0=high card .. 8=straight flush)
 *   Bits 16-19: primary rank (pair rank, trip rank, straight high, etc.)
 *
 * The only case that requires extra context beyond the score is the
 * one-pair category, where we need the board max rank to distinguish
 * top pair / overpair from weaker pairs.
 */
export const scoreToBucket = (score, maxBoardRank) => {
  const category = (score >> 20) & 0xF;
  switch (category) {
    case 0: return BUCKETS.HIGH_CARD;
    case 1: {
      // One pair. Discriminate top/overpair vs weak pair by primary rank
      // vs max board rank.
      const pairRank = (score >> 16) & 0xF;
      return pairRank >= maxBoardRank
        ? BUCKETS.TOP_PAIR_OR_OVERPAIR
        : BUCKETS.WEAK_PAIR;
    }
    case 2: return BUCKETS.TWO_PAIR;
    case 3: return BUCKETS.SET;
    case 4: return BUCKETS.STRAIGHT;
    case 5: return BUCKETS.FLUSH;
    case 6: return BUCKETS.FULL_HOUSE;
    case 7: return BUCKETS.QUADS;
    case 8: return BUCKETS.STRAIGHT_FLUSH;
    default: return BUCKETS.HIGH_CARD;
  }
};

// ---------- Board enumeration with bucketing ---------- //

// Reused buffers — single-threaded JS allows safe reuse across calls.
const _sevenA = new Array(7);
const _sevenB = new Array(7);
const _alive = new Int8Array(50);
const _dead = new Uint8Array(TOTAL_CARDS);

/**
 * Enumerate all boards and accumulate per-bucket win/tie/lose tallies.
 *
 * Returns a 4-row table (Float64Array of length BUCKET_COUNT*4) where:
 *   row 0: hits (board count in this bucket, regardless of outcome)
 *   row 1: wins
 *   row 2: ties
 *   row 3: losses
 */
const enumerateWithBuckets = (handACards, bCombos) => {
  const numCombos = bCombos.length;
  // Per-bucket: hits, wins, ties, losses. Weighted by bCombo count to
  // average properly across B combos.
  const buckets = new Float64Array(BUCKET_COUNT * 4);

  _dead.fill(0);
  _dead[handACards[0]] = 1;
  _dead[handACards[1]] = 1;

  let n = 0;
  for (let c = 0; c < TOTAL_CARDS; c++) {
    if (!_dead[c]) _alive[n++] = c;
  }
  // n === 50

  _sevenA[0] = handACards[0]; _sevenA[1] = handACards[1];

  const bCard1 = new Int8Array(numCombos);
  const bCard2 = new Int8Array(numCombos);
  for (let b = 0; b < numCombos; b++) {
    bCard1[b] = bCombos[b][0];
    bCard2[b] = bCombos[b][1];
  }

  for (let i = 0; i < 46; i++) {
    const ci = _alive[i];
    _sevenA[2] = ci;
    const ri = ci >> 2;
    for (let j = i + 1; j < 47; j++) {
      const cj = _alive[j];
      _sevenA[3] = cj;
      const rj = cj >> 2;
      const maxIJ = ri > rj ? ri : rj;
      for (let k = j + 1; k < 48; k++) {
        const ck = _alive[k];
        _sevenA[4] = ck;
        const rk = ck >> 2;
        const maxIJK = maxIJ > rk ? maxIJ : rk;
        for (let l = k + 1; l < 49; l++) {
          const cl = _alive[l];
          _sevenA[5] = cl;
          const rl = cl >> 2;
          const maxIJKL = maxIJK > rl ? maxIJK : rl;
          for (let m = l + 1; m < 50; m++) {
            const cm = _alive[m];
            _sevenA[6] = cm;
            const rm = cm >> 2;
            const maxBoardRank = maxIJKL > rm ? maxIJKL : rm;
            const sA = evaluate7(_sevenA);
            const bucket = scoreToBucket(sA, maxBoardRank);
            const bucketBase = bucket * 4;

            for (let b = 0; b < numCombos; b++) {
              const b1 = bCard1[b], b2 = bCard2[b];
              if (b1 === ci || b1 === cj || b1 === ck || b1 === cl || b1 === cm ||
                  b2 === ci || b2 === cj || b2 === ck || b2 === cl || b2 === cm) {
                continue;
              }
              _sevenB[0] = b1; _sevenB[1] = b2;
              _sevenB[2] = ci; _sevenB[3] = cj; _sevenB[4] = ck;
              _sevenB[5] = cl; _sevenB[6] = cm;
              const sB = evaluate7(_sevenB);
              buckets[bucketBase]++; // hit
              if (sA > sB) buckets[bucketBase + 1]++;
              else if (sA === sB) buckets[bucketBase + 2]++;
              else buckets[bucketBase + 3]++;
            }
          }
        }
      }
    }
  }

  return buckets;
};

// ---------- Public API ---------- //

// Hero-specific cache. Unlike total-equity caching (which is symmetric and
// can canonicalize on lo-hi), decomposition buckets are HERO-specific — a
// board where AKs has a flush and JTs has a straight contributes to
// AKs.FLUSH if hero=AKs but to JTs.STRAIGHT if hero=JTs. So cache keys
// preserve hero/villain order.
const MAX_CACHE = 200;
const decompositionCache = new Map();

export const clearDecompositionCache = () => { decompositionCache.clear(); };
export const getDecompositionCacheSize = () => decompositionCache.size;

/**
 * Decompose hero's equity by made-hand bucket.
 *
 * @param {string|object} handA  hero hand class (e.g., 'AKs')
 * @param {string|object} handB  villain hand class
 * @param {object} [options]
 * @param {boolean} [options.useCache=true]
 * @returns {{
 *   total: number,             // hero total equity (matches computeHandVsHand)
 *   winRate: number,
 *   tieRate: number,
 *   loseRate: number,
 *   boardsEnumerated: number,
 *   elapsedMs: number,
 *   cached?: boolean,
 *   buckets: Array<{
 *     id: number,
 *     label: string,
 *     shortLabel: string,
 *     hitRate: number,          // fraction of all runouts where hero's best 5 = this bucket
 *     winShare: number,         // fraction of all runouts where hero wins AND hand is this bucket
 *     tieShare: number,
 *     loseShare: number,
 *     equityShare: number,      // winShare + 0.5*tieShare
 *     conditionalWin: number,   // given hero makes this, P(win)
 *     conditionalEquity: number // given hero makes this, expected equity
 *   }>
 * }}
 */
export const decomposeHandVsHand = (handA, handB, options = {}) => {
  const { useCache = true } = options;
  const hA = typeof handA === 'string' ? parseHandClass(handA) : handA;
  const hB = typeof handB === 'string' ? parseHandClass(handB) : handB;
  const keyA = handClassToNotation(hA);
  const keyB = handClassToNotation(hB);
  const cacheKey = `${keyA}_${keyB}`;

  if (useCache && decompositionCache.has(cacheKey)) {
    return { ...decompositionCache.get(cacheKey), cached: true };
  }

  const start = performance.now();

  const aCombos = enumerateHandCombos(hA);
  const allBCombos = enumerateHandCombos(hB);
  const aCombo = aCombos[0];

  const validBCombos = [];
  for (const bCombo of allBCombos) {
    if (bCombo[0] === aCombo[0] || bCombo[0] === aCombo[1] ||
        bCombo[1] === aCombo[0] || bCombo[1] === aCombo[1]) {
      continue;
    }
    validBCombos.push(bCombo);
  }

  const raw = enumerateWithBuckets(aCombo, validBCombos);
  let totalBoards = 0;
  for (let b = 0; b < BUCKET_COUNT; b++) totalBoards += raw[b * 4];

  let totalWin = 0, totalTie = 0, totalLose = 0;
  const buckets = [];
  for (let b = 0; b < BUCKET_COUNT; b++) {
    const base = b * 4;
    const hits = raw[base];
    const wins = raw[base + 1];
    const ties = raw[base + 2];
    const losses = raw[base + 3];
    totalWin += wins;
    totalTie += ties;
    totalLose += losses;
    const hitRate = totalBoards > 0 ? hits / totalBoards : 0;
    const winShare = totalBoards > 0 ? wins / totalBoards : 0;
    const tieShare = totalBoards > 0 ? ties / totalBoards : 0;
    const loseShare = totalBoards > 0 ? losses / totalBoards : 0;
    const equityShare = winShare + 0.5 * tieShare;
    const conditionalWin = hits > 0 ? wins / hits : 0;
    const conditionalEquity = hits > 0 ? (wins + 0.5 * ties) / hits : 0;
    buckets.push({
      id: b,
      label: BUCKET_LABELS[b],
      shortLabel: BUCKET_SHORT[b],
      hitRate,
      winShare,
      tieShare,
      loseShare,
      equityShare,
      conditionalWin,
      conditionalEquity,
    });
  }

  const winRate = totalBoards > 0 ? totalWin / totalBoards : 0;
  const tieRate = totalBoards > 0 ? totalTie / totalBoards : 0;
  const loseRate = totalBoards > 0 ? totalLose / totalBoards : 0;
  const total = winRate + 0.5 * tieRate;

  const result = {
    total,
    winRate,
    tieRate,
    loseRate,
    boardsEnumerated: totalBoards,
    elapsedMs: Math.round(performance.now() - start),
    buckets,
  };

  if (useCache) {
    if (decompositionCache.size >= MAX_CACHE) {
      decompositionCache.delete(decompositionCache.keys().next().value);
    }
    decompositionCache.set(cacheKey, result);
  }

  return result;
};
