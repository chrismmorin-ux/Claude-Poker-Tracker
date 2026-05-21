/**
 * equityCache.js — Range Lab per-combo equity precompute cache (WS-205)
 *
 * Engineering Phase-0 primitive for Range Lab DS-54 (per-street range
 * evolution). At flop-paint-finalize the consumer precomputes hero equity
 * against every villain combo once; turn/river reveals then re-derive equity
 * by filtering board-colliding combos and recomputing the survivors over a
 * shorter (deterministic) runout — a filter+recompute, never a from-scratch
 * per-frame rollout of the full street.
 *
 * Design decisions (SPR-095, founder-ratified 2026-05-20):
 *   - Storage layer: in-memory Map, session-scoped, cleared on app reload.
 *     Keyed by (preflop context + flop + villain archetype + hero hand).
 *   - Equity source: reuse pokerCore's deterministic exactComboEquity — one
 *     source of equity truth shared with the LSW↔RL parity invariant (WS-206).
 *     No second equity implementation to drift.
 *
 * INV-RL-DETERMINISM: exactComboEquity is pure exhaustive enumeration with no
 * RNG, so a given (hero, villain combo, board) always yields the same equity.
 * The cache therefore never serves a value that depends on sampling order.
 *
 * Dependency direction: rangeEngine -> pokerCore only (allowed). This module
 * does NOT import from exploitEngine/ — the equity kernel lives in pokerCore.
 */

import { exactComboEquity } from '../pokerCore/monteCarloEquity';

/** C(52, 2) — number of distinct unordered two-card combos. */
export const NUM_COMBOS = 1326;

/**
 * Canonical dense index in [0, 1326) for an unordered pair of distinct encoded
 * cards (each in [0, 52)). Bijective onto [0, 1326) — used to address the
 * per-combo Float64Array. Order of the two arguments does not matter.
 *
 * @param {number} c1
 * @param {number} c2
 * @returns {number} index in [0, 1326)
 */
export const comboIndex = (c1, c2) => {
  const a = c1 < c2 ? c1 : c2;
  const b = c1 < c2 ? c2 : c1;
  // Sum of row lengths above row `a` (51 + 50 + ... ) plus the offset within row a.
  return a * 52 - (a * (a + 1)) / 2 + (b - a - 1);
};

const sortNums = (cards) => [...cards].sort((x, y) => x - y);

/**
 * Build the cache key for a flop precompute. Hero hand is part of the key
 * because equity is a property of the hero-vs-combo matchup — the same villain
 * range against a different hero hand is a different equity table.
 */
const flopCacheKey = ({ heroCards, flop, archetype, preflopContext }) =>
  `${preflopContext ?? ''}|${sortNums(flop).join(',')}|${archetype ?? ''}|${sortNums(heroCards).join('-')}`;

/** Key for a narrowed (turn/river) board derived from a flop entry. */
const narrowedKey = (entry, board) => `${entry.key}#${board.join(',')}`;

/**
 * Compute a Float64Array[1326] of hero equity per villain combo on `board`.
 * Entries are NaN for combos that are not in the villain range, share a card
 * with hero, collide with the board, or carry negligible weight (< 0.001).
 */
const computeBoardEquities = (heroCards, villainCombos, board) => {
  const equities = new Float64Array(NUM_COMBOS).fill(NaN);
  const [h0, h1] = heroCards;
  const boardSet = new Set(board);

  for (const combo of villainCombos) {
    const { card1, card2, weight } = combo;
    if (weight !== undefined && weight < 0.001) continue;
    if (card1 === h0 || card1 === h1 || card2 === h0 || card2 === h1) continue;
    if (boardSet.has(card1) || boardSet.has(card2)) continue;
    equities[comboIndex(card1, card2)] = exactComboEquity(heroCards, [card1, card2], board);
  }
  return equities;
};

/**
 * Create a session-scoped equity cache. The returned object owns an in-memory
 * Map; call `clear()` to drop everything (also dropped naturally on reload,
 * since nothing is persisted).
 */
export const createEquityCache = () => {
  const store = new Map();

  /**
   * Precompute (or return cached) per-combo hero equity on the flop.
   *
   * @param {object} params
   * @param {number[]} params.heroCards - [c0, c1] encoded hole cards
   * @param {Array<{card1:number, card2:number, weight?:number}>} params.villainCombos
   * @param {number[]} params.flop - exactly 3 encoded board cards
   * @param {string} [params.archetype] - villain range archetype id (key component)
   * @param {string} [params.preflopContext] - preflop context id (key component)
   * @returns {{ key:string, heroCards:number[], villainCombos:Array, board:number[], street:string, equities:Float64Array }}
   */
  const precomputeAtFlop = ({ heroCards, villainCombos, flop, archetype, preflopContext }) => {
    if (!flop || flop.length !== 3) {
      throw new RangeError(`precomputeAtFlop requires a 3-card flop, got ${flop ? flop.length : 'none'}`);
    }
    const key = flopCacheKey({ heroCards, flop, archetype, preflopContext });
    const existing = store.get(key);
    if (existing) return existing;

    const entry = {
      key,
      heroCards: [...heroCards],
      villainCombos,
      board: [...flop],
      street: 'flop',
      equities: computeBoardEquities(heroCards, villainCombos, flop),
    };
    store.set(key, entry);
    return entry;
  };

  /**
   * Hero equity for a specific villain combo in a precomputed entry.
   * Returns NaN if the combo is not present on this board.
   */
  const equityForCombo = (entry, card1, card2) => entry.equities[comboIndex(card1, card2)];

  /**
   * Reveal the next board card (turn from a flop entry, river from a turn
   * entry). Combos colliding with the revealed card drop out (NaN); survivors
   * are recomputed exactly over the shorter runout. Result is memoized per
   * full board, so re-entering the same line is a cache hit.
   *
   * @param {object} entry - a prior precomputed/narrowed entry
   * @param {number} card - the newly revealed encoded board card
   */
  const narrow = (entry, card) => {
    if (entry.board.includes(card)) {
      throw new RangeError(`narrow: card ${card} already on board`);
    }
    if (entry.board.length >= 5) {
      throw new RangeError('narrow: board is already complete (river)');
    }
    const board = [...entry.board, card];
    const memoKey = narrowedKey(entry, board);
    const cached = store.get(memoKey);
    if (cached) return cached;

    const narrowed = {
      key: entry.key,
      heroCards: entry.heroCards,
      villainCombos: entry.villainCombos,
      board,
      street: board.length === 4 ? 'turn' : 'river',
      equities: computeBoardEquities(entry.heroCards, entry.villainCombos, board),
    };
    store.set(memoKey, narrowed);
    return narrowed;
  };

  return {
    precomputeAtFlop,
    equityForCombo,
    narrow,
    /** Number of memoized board states (flop + any narrowed turn/river). */
    size: () => store.size,
    /** Drop all cached entries. */
    clear: () => store.clear(),
  };
};
