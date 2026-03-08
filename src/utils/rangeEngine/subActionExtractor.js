/**
 * subActionExtractor.js - Extract sub-actions after a player limps
 *
 * Tracks what happens AFTER a player limps preflop:
 * - limpFold: limped, then folded to a raise
 * - limpCall: limped, then called a raise
 * - limpRaise: limped, then re-raised (limp-reraise trap)
 * - limpNoRaise: limped, no raise followed (saw flop unraised)
 */

import { buildTimeline, getStreetTimeline } from '../handTimeline';
import { getRangePositionCategory } from '../positionUtils';
import { findPlayerSeat } from '../tendencyCalculations';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';
import { parseCard } from '../exploitEngine/cardParser';
import { rangeIndex } from '../exploitEngine/rangeMatrix';

/**
 * Extract a player's sub-action after limping in a single hand.
 * Returns null if the player didn't limp.
 *
 * @param {number|string} playerId
 * @param {Object} hand - Hand record from DB
 * @returns {{ position: string, subAction: string, showdownIndex: number|null } | null}
 */
export const extractSubAction = (playerId, hand) => {
  const seat = findPlayerSeat(playerId, hand);
  if (!seat) return null;

  const dealerSeat = hand.gameState?.dealerButtonSeat;
  if (!dealerSeat) return null;

  const position = getRangePositionCategory(Number(seat), dealerSeat);
  const timeline = buildTimeline(hand);
  const preflopActions = getStreetTimeline(timeline, 'preflop');

  // Find this player's actions on preflop
  const playerActions = preflopActions.filter(e => e.seat === seat);
  if (playerActions.length === 0) return null;

  // First action must be a limp (call without facing a raise)
  const firstAction = playerActions[0];
  if (firstAction.action !== PRIMITIVE_ACTIONS.CALL) return null;

  // Verify no raise before the limp (i.e., this is a limp, not a cold call)
  const raiseBeforeLimp = preflopActions.some(
    e => e.order < firstAction.order && e.seat !== seat && e.action === PRIMITIVE_ACTIONS.RAISE
  );
  if (raiseBeforeLimp) return null;

  // Check if anyone raised AFTER the limp
  const raiseAfterLimp = preflopActions.some(
    e => e.order > firstAction.order && e.seat !== seat && e.action === PRIMITIVE_ACTIONS.RAISE
  );

  let subAction;
  if (!raiseAfterLimp) {
    subAction = 'limpNoRaise';
  } else {
    // Player limped and faced a raise — find their second action
    const secondAction = playerActions[1];
    if (!secondAction) {
      // No second action recorded — treat as fold (timed out / didn't act)
      subAction = 'limpFold';
    } else if (secondAction.action === PRIMITIVE_ACTIONS.FOLD) {
      subAction = 'limpFold';
    } else if (secondAction.action === PRIMITIVE_ACTIONS.CALL) {
      subAction = 'limpCall';
    } else if (secondAction.action === PRIMITIVE_ACTIONS.RAISE) {
      subAction = 'limpRaise';
    } else {
      return null; // unexpected action
    }
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

  return { position, subAction, showdownIndex };
};

/**
 * Extract sub-actions for a player across all hands.
 * Only returns results for hands where the player limped.
 *
 * @param {number|string} playerId
 * @param {Object[]} hands - Array of hand records
 * @returns {Array<{ position: string, subAction: string, showdownIndex: number|null }>}
 */
export const extractAllSubActions = (playerId, hands) => {
  const results = [];
  for (const hand of hands) {
    const extraction = extractSubAction(playerId, hand);
    if (extraction) {
      results.push(extraction);
    }
  }
  return results;
};
