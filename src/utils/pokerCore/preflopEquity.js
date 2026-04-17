/**
 * preflopEquity.js — Exact preflop all-in equity.
 *
 * v1 implements hand-vs-hand via exhaustive C(48,5) board enumeration. Hand A is
 * fixed at canonical suits and all valid hand-B combos are averaged, producing
 * the same all-suit-averaged equity that published tables (Twodimes, PokerStove)
 * report. Results are deterministic and cached by canonical matchup key.
 *
 * The `computeEquity(targetA, targetB)` dispatcher is designed to accept range
 * targets in v2 without any caller changes; those branches currently throw
 * NotImplementedError with a clear message.
 */

import { encodeCard, TOTAL_CARDS } from './cardParser';

// ---------- Fast 7-card evaluator (private) ---------- //
//
// A dedicated direct 7-card hand evaluator, roughly 5–10× faster than the
// generic bestFiveFromSeven which iterates C(7,5)=21 subsets. Produces score
// values identical in format to handEvaluator.packScore — a dev-time test
// verifies equivalence against bestFiveFromSeven on sampled hands.
//
// Encoding (matches handEvaluator):
//   Bits 20-23: category (0=high card .. 8=straight flush)
//   Bits 16-19: primary rank
//   Bits 12-15: secondary rank
//   Bits  8-11: kicker[0]
//   Bits  4- 7: kicker[1]
//   Bits  0- 3: kicker[2]

const POPCOUNT_13 = (() => {
  const t = new Int8Array(8192);
  for (let i = 0; i < 8192; i++) {
    let c = 0, x = i;
    while (x) { x &= x - 1; c++; }
    t[i] = c;
  }
  return t;
})();

const highestStraight = (mask) => {
  // Regular straights, high rank 12 (A-high) down to 4 (6-high).
  for (let high = 12; high >= 4; high--) {
    if (((mask >> (high - 4)) & 0x1F) === 0x1F) return high;
  }
  // Wheel: A-2-3-4-5 — high rank = 3 (five).
  if ((mask & 0x100F) === 0x100F) return 3;
  return -1;
};

const _freq7 = new Uint8Array(13);

export const evaluate7 = (cards) => {
  _freq7.fill(0);
  let rankMask = 0;
  let sm0 = 0, sm1 = 0, sm2 = 0, sm3 = 0;

  for (let i = 0; i < 7; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    const bit = 1 << r;
    rankMask |= bit;
    if (s === 0) sm0 |= bit;
    else if (s === 1) sm1 |= bit;
    else if (s === 2) sm2 |= bit;
    else sm3 |= bit;
    _freq7[r]++;
  }

  // Flush detection (≥5 of one suit).
  let flushMask = 0;
  if (POPCOUNT_13[sm0] >= 5) flushMask = sm0;
  else if (POPCOUNT_13[sm1] >= 5) flushMask = sm1;
  else if (POPCOUNT_13[sm2] >= 5) flushMask = sm2;
  else if (POPCOUNT_13[sm3] >= 5) flushMask = sm3;

  // Straight flush
  if (flushMask) {
    const sfHigh = highestStraight(flushMask);
    if (sfHigh >= 0) return (8 << 20) | (sfHigh << 16);
  }

  // Find quad / trips / pairs, highest first.
  let quad = -1, trip1 = -1, trip2 = -1, pair1 = -1, pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const f = _freq7[r];
    if (f === 4) quad = r;
    else if (f === 3) {
      if (trip1 < 0) trip1 = r;
      else if (trip2 < 0) trip2 = r;
    } else if (f === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  // Quads + highest kicker
  if (quad >= 0) {
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== quad && _freq7[r] > 0) { kicker = r; break; }
    }
    return (7 << 20) | (quad << 16) | (kicker << 12);
  }

  // Full house: trip + (second trip | pair)
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    const pairRank = trip2 >= 0 ? trip2 : pair1;
    return (6 << 20) | (trip1 << 16) | (pairRank << 12);
  }

  // Flush (not a straight flush)
  if (flushMask) {
    let k0 = -1, k1 = -1, k2 = -1, k3 = -1, k4 = -1;
    for (let r = 12; r >= 0; r--) {
      if (flushMask & (1 << r)) {
        if (k0 < 0) k0 = r;
        else if (k1 < 0) k1 = r;
        else if (k2 < 0) k2 = r;
        else if (k3 < 0) k3 = r;
        else if (k4 < 0) { k4 = r; break; }
      }
    }
    return (5 << 20) | (k0 << 16) | (k1 << 12) | (k2 << 8) | (k3 << 4) | k4;
  }

  // Straight
  const straightHigh = highestStraight(rankMask);
  if (straightHigh >= 0) return (4 << 20) | (straightHigh << 16);

  // Three of a kind + top two kickers
  if (trip1 >= 0) {
    let k0 = -1, k1 = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== trip1 && _freq7[r] > 0) {
        if (k0 < 0) k0 = r;
        else if (k1 < 0) { k1 = r; break; }
      }
    }
    return (3 << 20) | (trip1 << 16) | (k0 << 12) | (k1 << 8);
  }

  // Two pair + highest kicker
  if (pair1 >= 0 && pair2 >= 0) {
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r === pair1 || r === pair2) continue;
      if (_freq7[r] > 0) { kicker = r; break; }
    }
    return (2 << 20) | (pair1 << 16) | (pair2 << 12) | (kicker << 8);
  }

  // One pair + top three kickers
  if (pair1 >= 0) {
    let k0 = -1, k1 = -1, k2 = -1;
    for (let r = 12; r >= 0; r--) {
      if (r === pair1) continue;
      if (_freq7[r] > 0) {
        if (k0 < 0) k0 = r;
        else if (k1 < 0) k1 = r;
        else if (k2 < 0) { k2 = r; break; }
      }
    }
    return (1 << 20) | (pair1 << 16) | (k0 << 12) | (k1 << 8) | (k2 << 4);
  }

  // High card: top 5
  let h0 = -1, h1 = -1, h2 = -1, h3 = -1, h4 = -1;
  for (let r = 12; r >= 0; r--) {
    if (_freq7[r] > 0) {
      if (h0 < 0) h0 = r;
      else if (h1 < 0) h1 = r;
      else if (h2 < 0) h2 = r;
      else if (h3 < 0) h3 = r;
      else if (h4 < 0) { h4 = r; break; }
    }
  }
  return (h0 << 16) | (h1 << 12) | (h2 << 8) | (h3 << 4) | h4;
};


export class NotImplementedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

// ---------- Hand notation parsing ---------- //

// Display order: A high, 2 low. Rank integers: A=12, 2=0.
const RANK_CHARS = 'AKQJT98765432';
const rankFromChar = (c) => {
  const idx = RANK_CHARS.indexOf(c);
  return idx < 0 ? -1 : 12 - idx;
};
const charFromRank = (r) => RANK_CHARS[12 - r];

/**
 * Parse standard hand notation into structured form.
 *   "AA"  → { rankHigh: 12, rankLow: 12, suited: false, pair: true }
 *   "AKs" → { rankHigh: 12, rankLow: 11, suited: true,  pair: false }
 *   "JTo" → { rankHigh: 9,  rankLow: 8,  suited: false, pair: false }
 */
export const parseHandClass = (str) => {
  if (!str || typeof str !== 'string') {
    throw new Error(`Invalid hand notation: ${String(str)}`);
  }
  const trimmed = str.trim().toUpperCase();
  if (trimmed.length === 2) {
    if (trimmed[0] !== trimmed[1]) {
      throw new Error(`Ambiguous hand "${trimmed}" — use "s" or "o" suffix`);
    }
    const r = rankFromChar(trimmed[0]);
    if (r < 0) throw new Error(`Invalid rank: ${trimmed[0]}`);
    return { rankHigh: r, rankLow: r, suited: false, pair: true };
  }
  if (trimmed.length === 3) {
    const r1 = rankFromChar(trimmed[0]);
    const r2 = rankFromChar(trimmed[1]);
    const suffix = trimmed[2];
    if (r1 < 0 || r2 < 0) throw new Error(`Invalid ranks in: ${trimmed}`);
    if (r1 === r2) throw new Error(`Pair cannot have suit suffix: ${trimmed}`);
    if (suffix !== 'S' && suffix !== 'O') {
      throw new Error(`Invalid suit suffix "${suffix}" — must be "s" or "o"`);
    }
    return {
      rankHigh: Math.max(r1, r2),
      rankLow: Math.min(r1, r2),
      suited: suffix === 'S',
      pair: false,
    };
  }
  throw new Error(`Invalid hand notation: "${trimmed}"`);
};

export const handClassToNotation = (hc) => {
  const high = charFromRank(hc.rankHigh);
  if (hc.pair) return `${high}${high}`;
  const low = charFromRank(hc.rankLow);
  return `${high}${low}${hc.suited ? 's' : 'o'}`;
};

// ---------- Combo enumeration ---------- //

/**
 * Enumerate all card combos for a hand class.
 *   Pair:    6 combos (C(4,2))
 *   Suited:  4 combos (one per suit)
 *   Offsuit: 12 combos (4 × 3 distinct suits)
 *
 * Returns [card1, card2] pairs with card1 always the higher-rank card.
 */
export const enumerateHandCombos = (handClass) => {
  const { rankHigh, rankLow, suited, pair } = handClass;
  const combos = [];
  if (pair) {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) {
        combos.push([encodeCard(rankHigh, s1), encodeCard(rankHigh, s2)]);
      }
    }
  } else if (suited) {
    for (let s = 0; s < 4; s++) {
      combos.push([encodeCard(rankHigh, s), encodeCard(rankLow, s)]);
    }
  } else {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) {
        if (s1 === s2) continue;
        combos.push([encodeCard(rankHigh, s1), encodeCard(rankLow, s2)]);
      }
    }
  }
  return combos;
};

// ---------- Exact board enumeration ---------- //

// Pre-allocated buffers reused across all enumeration calls. Safe because JS is
// single-threaded and we never recurse.
const _sevenA = new Array(7);
const _sevenB = new Array(7);
const _alive = new Int8Array(50);
const _dead = new Uint8Array(TOTAL_CARDS);

/**
 * Enumerate all C(50, 5) = 2,118,760 boards with only hand A's cards excluded.
 * For every board, evaluate hand A once, then iterate each valid hand B combo,
 * skipping boards that contain B's cards. This hoists the hand-A evaluation out
 * of the B-combo loop — for offsuit-vs-offsuit with 12 B combos, ~2× speedup
 * over per-combo-pair enumeration.
 *
 * Returns a 3-element Float64Array per B combo: [win, tie, lose] counts of
 * boards that don't conflict with that combo. Total boards per combo is
 * C(48, 5) = 1,712,304; mismatch boards are skipped.
 */
const enumerateAllBoards = (handACards, bCombos) => {
  const numCombos = bCombos.length;
  // win[i], tie[i], lose[i] for combo i
  const tallies = new Float64Array(numCombos * 3);

  _dead.fill(0);
  _dead[handACards[0]] = 1;
  _dead[handACards[1]] = 1;

  let n = 0;
  for (let c = 0; c < TOTAL_CARDS; c++) {
    if (!_dead[c]) _alive[n++] = c;
  }
  // n === 50

  _sevenA[0] = handACards[0]; _sevenA[1] = handACards[1];

  // Cache B combo cards locally for tight loop.
  const bCard1 = new Int8Array(numCombos);
  const bCard2 = new Int8Array(numCombos);
  for (let b = 0; b < numCombos; b++) {
    bCard1[b] = bCombos[b][0];
    bCard2[b] = bCombos[b][1];
  }

  for (let i = 0; i < 46; i++) {
    const ci = _alive[i];
    _sevenA[2] = ci;
    for (let j = i + 1; j < 47; j++) {
      const cj = _alive[j];
      _sevenA[3] = cj;
      for (let k = j + 1; k < 48; k++) {
        const ck = _alive[k];
        _sevenA[4] = ck;
        for (let l = k + 1; l < 49; l++) {
          const cl = _alive[l];
          _sevenA[5] = cl;
          for (let m = l + 1; m < 50; m++) {
            const cm = _alive[m];
            _sevenA[6] = cm;
            const sA = evaluate7(_sevenA);

            // Inner loop over B combos. Skip any combo whose cards are on this board.
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
              const base = b * 3;
              if (sA > sB) tallies[base]++;
              else if (sA < sB) tallies[base + 2]++;
              else tallies[base + 1]++;
            }
          }
        }
      }
    }
  }

  return tallies;
};

// ---------- Hand-vs-hand exact equity ---------- //

/**
 * Compute hand-vs-hand equity, averaged over all valid combo pairs.
 * Hand A is fixed at canonical suits; hand B iterates all 4/6/12 of its suit
 * combos (skipping any that share cards with A). By 4-fold suit symmetry this
 * produces the true all-suits-averaged equity matching published tables.
 */
const computeHandVsHandExact = (handAClass, handBClass) => {
  const start = performance.now();

  const aCombo = enumerateHandCombos(handAClass)[0];
  const allBCombos = enumerateHandCombos(handBClass);

  // Filter to B combos that don't share cards with A.
  const validBCombos = [];
  for (const bCombo of allBCombos) {
    if (bCombo[0] === aCombo[0] || bCombo[0] === aCombo[1] ||
        bCombo[1] === aCombo[0] || bCombo[1] === aCombo[1]) {
      continue;
    }
    validBCombos.push(bCombo);
  }

  if (validBCombos.length === 0) {
    // Only happens if the two hand classes share every possible combo (impossible for
    // distinct canonical classes). Safe fallback: coin-flip.
    return {
      equity: 0.5, winRate: 0.5, tieRate: 0, loseRate: 0.5,
      exact: true, combosEvaluated: 0, boardsEnumerated: 0,
      elapsedMs: Math.round(performance.now() - start),
    };
  }

  const tallies = enumerateAllBoards(aCombo, validBCombos);
  let totalWin = 0, totalTie = 0, totalLose = 0;
  for (let b = 0; b < validBCombos.length; b++) {
    totalWin += tallies[b * 3];
    totalTie += tallies[b * 3 + 1];
    totalLose += tallies[b * 3 + 2];
  }
  const totalBoards = totalWin + totalTie + totalLose;
  const validCombos = validBCombos.length;

  const winRate = totalWin / totalBoards;
  const tieRate = totalTie / totalBoards;
  const loseRate = totalLose / totalBoards;
  const equity = winRate + tieRate * 0.5;

  return {
    equity,
    winRate,
    tieRate,
    loseRate,
    exact: true,
    combosEvaluated: validCombos,
    boardsEnumerated: totalBoards,
    elapsedMs: Math.round(performance.now() - start),
  };
};

// ---------- Result caching ---------- //

const MAX_CACHE = 500;
const equityCache = new Map();

const canonicalKey = (keyA, keyB) => (keyA <= keyB ? `${keyA}_${keyB}` : `${keyB}_${keyA}`);

const flipPerspective = (r) => ({
  equity: r.loseRate + r.tieRate * 0.5,
  winRate: r.loseRate,
  tieRate: r.tieRate,
  loseRate: r.winRate,
  exact: r.exact,
  combosEvaluated: r.combosEvaluated,
  boardsEnumerated: r.boardsEnumerated,
  elapsedMs: r.elapsedMs,
});

export const clearEquityCache = () => { equityCache.clear(); };
export const getEquityCacheSize = () => equityCache.size;

// ---------- Public API ---------- //

/**
 * @typedef {Object} EquityTarget
 * @property {'hand' | 'range'} type
 * @property {string} [notation]     // 'AKs', 'JTs', '77' — when type='hand'
 * @property {Float64Array} [range]  // 169-element grid — when type='range'
 */

/**
 * Compute exact preflop all-in equity between two targets.
 *
 * v1: hand-vs-hand fully implemented. Range branches throw NotImplementedError.
 * v2 will fill in the range paths without changing callers.
 *
 * @param {EquityTarget} targetA
 * @param {EquityTarget} targetB
 * @param {Object} [options]
 * @param {boolean} [options.useCache=true]
 * @returns {{ equity: number, winRate: number, tieRate: number, loseRate: number,
 *            exact: boolean, combosEvaluated: number, boardsEnumerated: number,
 *            elapsedMs: number, cached?: boolean }}
 */
export const computeEquity = (targetA, targetB, options = {}) => {
  const { useCache = true } = options;

  if (!targetA || !targetB || !targetA.type || !targetB.type) {
    throw new Error('computeEquity requires two EquityTarget objects with .type');
  }

  if (targetA.type === 'hand' && targetB.type === 'hand') {
    const hA = parseHandClass(targetA.notation);
    const hB = parseHandClass(targetB.notation);
    const keyA = handClassToNotation(hA);
    const keyB = handClassToNotation(hB);
    const reversed = keyA > keyB;
    const cacheKey = canonicalKey(keyA, keyB);

    let canonResult;
    if (useCache && equityCache.has(cacheKey)) {
      canonResult = equityCache.get(cacheKey);
      const view = reversed ? flipPerspective(canonResult) : canonResult;
      return { ...view, cached: true };
    }

    canonResult = reversed
      ? computeHandVsHandExact(hB, hA)
      : computeHandVsHandExact(hA, hB);

    if (useCache) {
      if (equityCache.size >= MAX_CACHE) {
        const firstKey = equityCache.keys().next().value;
        equityCache.delete(firstKey);
      }
      equityCache.set(cacheKey, canonResult);
    }
    return reversed ? flipPerspective(canonResult) : canonResult;
  }

  if (targetA.type === 'range' || targetB.type === 'range') {
    throw new NotImplementedError(
      'Range targets are not yet supported — v2 feature. ' +
      'v1 supports only { type: "hand", notation: "AKs" } targets.',
    );
  }

  throw new Error(
    `Invalid target types: A="${targetA.type}", B="${targetB.type}"`,
  );
};

/**
 * Convenience wrapper: compute equity directly from hand notation strings.
 */
export const computeHandVsHand = (handA, handB, options) =>
  computeEquity(
    { type: 'hand', notation: handA },
    { type: 'hand', notation: handB },
    options,
  );
