/**
 * actionUtils.js - Utility functions for action styling and display
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';
import { ACTIONS, ACTION_ABBREV, SEAT_STATUS, isFoldAction } from '../constants/gameConstants';

/**
 * Gets the display name for an action
 * @param {string} action - Action string (primitive or showdown)
 * @returns {string} - Display name for the action
 */
export const getActionDisplayName = (action) => {
  if (isFoldAction(action)) return 'fold';

  switch (action) {
    case 'check': return 'check';
    case 'call': return 'call';
    case 'bet': return 'bet';
    case 'raise': return 'raise';
    case 'mucked': return 'muck';
    case 'won': return 'won';
    default: return action || '';
  }
};

/**
 * Determines overlay status for showdown view
 * @param {string} inactiveStatus - Inactive status (SEAT_STATUS.FOLDED or SEAT_STATUS.ABSENT)
 * @param {boolean} isMucked - Whether seat mucked
 * @param {boolean} hasWon - Whether seat won
 * @returns {string|null} - Status string or null
 */
export const getOverlayStatus = (inactiveStatus, isMucked, hasWon) => {
  if (inactiveStatus === SEAT_STATUS.FOLDED) return SEAT_STATUS.FOLDED;
  if (inactiveStatus === SEAT_STATUS.ABSENT) return SEAT_STATUS.ABSENT;
  if (isMucked) return 'mucked';
  if (hasWon) return 'won';
  return null;
};

/**
 * Checks if all cards are assigned in showdown
 * @param {number} numSeats - Total number of seats
 * @param {Function} isSeatInactive - Function to check if seat is inactive
 * @param {Array} actionSequence - Action sequence array
 * @param {number} mySeat - Player's seat
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} allPlayerCards - All player cards
 * @returns {boolean} - True if all cards assigned
 */
export const allCardsAssigned = (
  numSeats,
  isSeatInactive,
  actionSequence,
  mySeat,
  holeCards,
  allPlayerCards
) => {
  for (let seat = 1; seat <= numSeats; seat++) {
    const inactiveStatus = isSeatInactive(seat);
    const isMucked = actionSequence.some(e => e.seat === seat && e.street === 'showdown' && e.action === ACTIONS.MUCKED);
    const hasWon = actionSequence.some(e => e.seat === seat && e.street === 'showdown' && e.action === ACTIONS.WON);

    // Skip folded, absent, mucked, and won seats
    if (inactiveStatus === SEAT_STATUS.FOLDED || inactiveStatus === SEAT_STATUS.ABSENT || isMucked || hasWon) {
      continue;
    }

    // Check if this active seat has both cards
    const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
    if (!cards[0] || !cards[1]) {
      return false;
    }
  }
  return true;
};

/**
 * Gets action abbreviation (3-4 chars max) for badge display
 * @param {string} action - Action string
 * @returns {string} - Abbreviated action
 */
export const getActionAbbreviation = (action) => {
  return ACTION_ABBREV[action] || action?.substring(0, 3).toUpperCase() || '???';
};

// =============================================================================
// PRIMITIVE ACTION UTILITIES (Phase 1)
// =============================================================================

/**
 * Returns the valid primitive actions for the current game state.
 * Multi-seat mode excludes BET/RAISE because there is no per-seat sizing UI for batches.
 * Otherwise the legality rules are identical to single-seat — multi-seat must still
 * respect street and hasBet (no CHECK when facing a bet, no CHECK preflop where the
 * BB is a forced bet).
 * @param {string} street - Current street ('preflop', 'flop', 'turn', 'river')
 * @param {boolean} hasBet - Whether there's already a bet on this street
 * @param {boolean} isMultiSeat - Whether tracking multiple seats simultaneously
 * @returns {string[]} Array of valid PRIMITIVE_ACTIONS values
 */
export function getValidActions(street, hasBet, isMultiSeat) {
  const { CHECK, BET, CALL, RAISE, FOLD } = PRIMITIVE_ACTIONS;
  if (street === 'preflop') return isMultiSeat ? [CALL, FOLD] : [CALL, RAISE, FOLD];
  if (hasBet) return isMultiSeat ? [CALL, FOLD] : [CALL, RAISE, FOLD];
  return isMultiSeat ? [CHECK, FOLD] : [CHECK, BET, FOLD];
}
