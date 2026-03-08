/**
 * useShowdownEquity.js - Deterministic hand ranking for showdown
 *
 * Ranks all active seats by hand strength using bestFiveFromSeven.
 */

import { useMemo } from 'react';
import { bestFiveFromSeven, handCategory } from '../utils/exploitEngine/handEvaluator';
import { parseAndEncode, parseBoard } from '../utils/exploitEngine/cardParser';
import { ACTIONS } from '../constants/gameConstants';

/**
 * @param {Object} params
 * @param {Object} params.allPlayerCards - { [seat]: ['As', 'Kd'] }
 * @param {string[]} params.holeCards - hero's hole cards
 * @param {number} params.mySeat
 * @param {string[]} params.communityCards - all 5 community cards
 * @param {Object[]} params.actionSequence
 * @returns {{ rankings: Array }}
 */
export const useShowdownEquity = ({
  allPlayerCards,
  holeCards,
  mySeat,
  communityCards,
  actionSequence,
}) => {
  const rankings = useMemo(() => {
    // Need 5 community cards for deterministic ranking
    const board = parseBoard(communityCards);
    if (board.length < 5) return [];

    // Find folded/mucked seats
    const inactiveSeats = new Set();
    for (const entry of actionSequence) {
      if (entry.action === ACTIONS.FOLD || entry.action === ACTIONS.FOLD_TO_CR ||
          entry.action === ACTIONS.FOLD_TO_CBET || entry.action === ACTIONS.MUCKED) {
        inactiveSeats.add(entry.seat);
      }
    }

    const results = [];

    // Check all seats with known cards
    for (let seat = 1; seat <= 9; seat++) {
      if (inactiveSeats.has(seat)) continue;

      const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
      if (!cards || cards.length < 2 || !cards[0] || !cards[1] || cards[0] === '' || cards[1] === '') continue;

      const c0 = parseAndEncode(cards[0]);
      const c1 = parseAndEncode(cards[1]);
      if (c0 < 0 || c1 < 0) continue;

      const sevenCards = [c0, c1, ...board];
      const score = bestFiveFromSeven(sevenCards);
      const category = handCategory(score);

      results.push({ seat, score, category });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Assign rank (handle ties)
    let rank = 1;
    for (let i = 0; i < results.length; i++) {
      if (i > 0 && results[i].score < results[i - 1].score) {
        rank = i + 1;
      }
      results[i].rank = rank;
      results[i].isWinner = rank === 1;
    }

    return results;
  }, [allPlayerCards, holeCards, mySeat, communityCards, actionSequence]);

  return { rankings };
};
