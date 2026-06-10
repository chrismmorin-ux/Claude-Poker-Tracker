/**
 * deriveAnchorBoardCondition.js — Per-street board condition in anchor vocabulary.
 *
 * Translates raw community cards into the `boardCondition` shape the anchor
 * matcher compares against (`schema-delta.md` §2.2):
 *
 *   texture:   'dry' | 'wet' | 'paired' | 'monotone' | 'flush-complete'
 *              | 'straight-complete'   (+ 'medium' — see note below)
 *   scareKind: '4-flush' | 'straight-complete' | 'overcard' | 'board-pair' | 'none'
 *
 * Texture is a static property of the street's board prefix (flop = first 3
 * cards, turn = 4, river = 5). scareKind is a STREET-TRANSITION property —
 * what the newly-arrived turn/river card just completed relative to the
 * previous street's board — so it is emitted for turn/river only.
 *
 * The matcher does exact string equality, so a single label must be chosen
 * when several apply. Priority: most range-narrowing wins (POKER_THEORY §3.1 —
 * a completed flush narrows continuing ranges more drastically than a pair
 * or generic wetness).
 *
 * Boards scoring between dry and wet keep `analyzeBoardTexture`'s 'medium'
 * label, which matches no anchor constraint except 'any' — conservative by
 * design: never claim 'wet' or 'dry' for a board the classifier calls neither.
 *
 * These labels are derived OUTPUTS of board geometry, fed to the matcher as
 * comparison slots. They are never inputs to villain decision modeling
 * (POKER_THEORY §7.1 — decisions derive from game state, not labels).
 *
 * Pure module. No React, no persistence.
 */

import { parseBoard, getCardsForStreet, cardRank, cardSuit } from '../pokerCore/cardParser';
import { analyzeBoardTexture } from '../pokerCore/boardTexture';

const PREFIX_LENGTH = Object.freeze({ flop: 3, turn: 4, river: 5 });

/**
 * True when 4+ consecutive ranks are present on the board (a one-card
 * straight: any player holding the right single card has a straight).
 * Includes the A-2-3-4 wheel run. Rank encoding: 2=0 … A=12.
 */
const hasFourConsecutiveRanks = (encodedCards) => {
  const present = new Array(13).fill(false);
  for (const card of encodedCards) present[cardRank(card)] = true;

  for (let low = 0; low + 3 <= 12; low++) {
    if (present[low] && present[low + 1] && present[low + 2] && present[low + 3]) {
      return true;
    }
  }
  // Wheel run A-2-3-4 (ace plays low)
  return present[12] && present[0] && present[1] && present[2];
};

/**
 * Map a board prefix to the single anchor-vocabulary texture label.
 * Priority: flush-complete > monotone > straight-complete > paired >
 * wet/medium/dry from the classifier's wetness score.
 */
const deriveTexture = (analysis, encodedCards) => {
  if (analysis.flushComplete) return 'flush-complete';
  if (analysis.monotone) return 'monotone';
  if (hasFourConsecutiveRanks(encodedCards)) return 'straight-complete';
  if (analysis.isPaired) return 'paired';
  return analysis.texture; // 'wet' | 'medium' | 'dry'
};

/**
 * Classify what the newly-arrived card (last of `encodedCards`) just
 * completed relative to the previous street's prefix. Single label,
 * most range-narrowing wins: 4-flush > straight-complete > board-pair >
 * overcard > none.
 */
const deriveScareKind = (previousCards, encodedCards) => {
  const newCard = encodedCards[encodedCards.length - 1];
  const newSuit = cardSuit(newCard);
  const newRank = cardRank(newCard);

  const suitedCount = encodedCards.filter((c) => cardSuit(c) === newSuit).length;
  if (suitedCount >= 4) return '4-flush';

  if (hasFourConsecutiveRanks(encodedCards) && !hasFourConsecutiveRanks(previousCards)) {
    return 'straight-complete';
  }

  if (previousCards.some((c) => cardRank(c) === newRank)) return 'board-pair';

  const previousHigh = Math.max(...previousCards.map(cardRank));
  if (newRank > previousHigh) return 'overcard';

  return 'none';
};

/**
 * Build the matcher `board` slot for one street from raw community cards.
 *
 * @param {string[]} communityCards — raw card strings (e.g. 'A♥'), 5-slot array
 * @param {string} street — 'flop' | 'turn' | 'river' (preflop/invalid → null)
 * @returns {{ texture: string, scareKind?: string }|null} null when the
 *          street has no board concept or the prefix isn't fully entered /
 *          parseable — caller omits the board slot, and anchor steps with a
 *          real board demand then correctly don't fire (fail-safe).
 */
export const deriveAnchorBoardCondition = (communityCards, street) => {
  const needed = PREFIX_LENGTH[street];
  if (!needed) return null;

  const cards = getCardsForStreet(communityCards, street);
  if (cards.length < needed) return null;

  const encoded = parseBoard(cards);
  if (encoded.length < needed) return null;

  const analysis = analyzeBoardTexture(encoded);
  const board = { texture: deriveTexture(analysis, encoded) };

  if (street === 'turn' || street === 'river') {
    board.scareKind = deriveScareKind(encoded.slice(0, needed - 1), encoded);
  }

  return board;
};
