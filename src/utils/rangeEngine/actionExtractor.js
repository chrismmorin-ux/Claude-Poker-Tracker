/**
 * actionExtractor.js - Extract preflop actions from hand history
 *
 * Iterates hands and classifies each player's preflop action
 * with position context for range engine consumption.
 */

import { buildTimeline, getStreetTimeline, didPlayerFaceRaise } from '../handAnalysis';
import { getRangePositionCategory } from '../positionUtils';
import { findPlayerSeat } from '../tendencyCalculations';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';
import { ACTIONS } from '../../constants/gameConstants';
import { parseCard } from '../pokerCore/cardParser';
import { rangeIndex } from '../pokerCore/rangeMatrix';

/**
 * Extract a single player's preflop action from one hand.
 * @param {number|string} playerId
 * @param {Object} hand - Hand record from DB
 * @returns {{ position: string, rangeAction: string, facedRaise: boolean, showdownIndex: number|null, showdownOutcome: string|null } | null}
 */
export const extractPreflopAction = (playerId, hand) => {
  const seat = findPlayerSeat(playerId, hand);
  if (!seat) return null;

  const dealerSeat = hand.gameState?.dealerButtonSeat;
  if (!dealerSeat) return null;

  const position = getRangePositionCategory(Number(seat), dealerSeat);
  const timeline = buildTimeline(hand);
  const preflopActions = getStreetTimeline(timeline, 'preflop');

  // Find this player's first action on preflop
  const playerActions = preflopActions.filter(e => e.seat === seat);
  if (playerActions.length === 0) {
    // Player was in hand but took no action — treat as fold
    return { position, rangeAction: 'fold', facedRaise: false, showdownIndex: null, showdownOutcome: null };
  }

  const firstAction = playerActions[0].action;
  const facedRaise = didPlayerFaceRaise(timeline, seat, 'preflop');

  // BB check with no raise faced = not a voluntary action, skip
  if (position === 'BB' && firstAction === PRIMITIVE_ACTIONS.CHECK && !facedRaise) {
    return null;
  }

  // Classify the range action
  let rangeAction;
  if (firstAction === PRIMITIVE_ACTIONS.FOLD) {
    rangeAction = 'fold';
  } else if (firstAction === PRIMITIVE_ACTIONS.CALL && !facedRaise) {
    rangeAction = 'limp';
  } else if (firstAction === PRIMITIVE_ACTIONS.RAISE && !facedRaise) {
    rangeAction = 'open';
  } else if (firstAction === PRIMITIVE_ACTIONS.CALL && facedRaise) {
    rangeAction = 'coldCall';
  } else if (firstAction === PRIMITIVE_ACTIONS.RAISE && facedRaise) {
    rangeAction = 'threeBet';
  } else {
    // Unexpected action (check in non-BB scenario, etc.) — skip
    return null;
  }

  // Extract showdown cards if available
  let showdownIndex = null;
  const allPlayerCards = hand.cardState?.allPlayerCards;
  if (allPlayerCards && allPlayerCards[seat]) {
    const cards = allPlayerCards[seat];
    if (Array.isArray(cards) && cards.length === 2 && cards[0] && cards[1]) {
      const c1 = parseCard(cards[0]);
      const c2 = parseCard(cards[1]);
      if (c1 && c2) {
        const suited = c1.suit === c2.suit;
        showdownIndex = rangeIndex(c1.rank, c2.rank, suited);
      }
    }
  }

  // Determine showdown outcome (won/lost/null)
  let showdownOutcome = null;
  if (showdownIndex !== null) {
    const actionSeq = hand.gameState?.actionSequence;
    if (Array.isArray(actionSeq)) {
      const seatWon = actionSeq.some(
        e => String(e.seat) === String(seat) && e.action === ACTIONS.WON
      );
      showdownOutcome = seatWon ? 'won' : 'lost';
    }
  }

  return { position, rangeAction, facedRaise, showdownIndex, showdownOutcome };
};

/**
 * Extract preflop actions for a player across all hands.
 * @param {number|string} playerId
 * @param {Object[]} hands - Array of hand records
 * @returns {Array<{ position: string, rangeAction: string, facedRaise: boolean, showdownIndex: number|null }>}
 */
export const extractAllActions = (playerId, hands) => {
  const results = [];
  for (const hand of hands) {
    const extraction = extractPreflopAction(playerId, hand);
    if (extraction) {
      results.push(extraction);
    }
  }
  return results;
};
