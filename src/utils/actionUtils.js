/**
 * actionUtils.js - Utility functions for action styling and display
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

/**
 * Gets the display name for an action
 * @param {string} action - Action constant
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {Object} ACTIONS - Actions constants
 * @returns {string} - Display name for the action
 */
export const getActionDisplayName = (action, isFoldAction, ACTIONS) => {
  if (isFoldAction(action)) return 'fold';

  switch (action) {
    case ACTIONS.LIMP: return 'limp';
    case ACTIONS.CALL: return 'call';
    case ACTIONS.OPEN: return 'open';
    case ACTIONS.THREE_BET: return '3bet';
    case ACTIONS.FOUR_BET: return '4bet';
    case ACTIONS.CBET_IP_SMALL: return 'cbet IP (S)';
    case ACTIONS.CBET_IP_LARGE: return 'cbet IP (L)';
    case ACTIONS.CBET_OOP_SMALL: return 'cbet OOP (S)';
    case ACTIONS.CBET_OOP_LARGE: return 'cbet OOP (L)';
    case ACTIONS.CHECK: return 'check';
    case ACTIONS.CHECK_RAISE: return 'check-raise';
    case ACTIONS.DONK: return 'donk';
    case ACTIONS.STAB: return 'stab';
    case ACTIONS.MUCKED: return 'muck';
    case ACTIONS.WON: return 'won';
    case ACTIONS.FOLD_TO_CBET: return 'fold to cbet';
    case ACTIONS.FOLD_TO_CR: return 'fold to CR';
    default: return action || '';
  }
};

/**
 * Gets Tailwind classes for action color (used in showdown summary)
 * @param {string} action - Action constant
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {Object} ACTIONS - Actions constants
 * @returns {string} - Tailwind classes
 */
export const getActionColor = (action, isFoldAction, ACTIONS) => {
  if (isFoldAction(action)) {
    return 'bg-red-300 text-red-900';
  }

  switch (action) {
    case ACTIONS.LIMP:
      return 'bg-gray-300 text-gray-900';
    case ACTIONS.CALL:
    case ACTIONS.CHECK:
      return 'bg-blue-200 text-blue-900';
    case ACTIONS.OPEN:
      return 'bg-green-300 text-green-900';
    case ACTIONS.THREE_BET:
    case ACTIONS.STAB:
      return 'bg-yellow-300 text-yellow-900';
    case ACTIONS.FOUR_BET:
    case ACTIONS.DONK:
    case ACTIONS.CHECK_RAISE:
      return 'bg-orange-300 text-orange-900';
    case ACTIONS.CBET_IP_SMALL:
    case ACTIONS.CBET_IP_LARGE:
    case ACTIONS.CBET_OOP_SMALL:
    case ACTIONS.CBET_OOP_LARGE:
      return 'bg-green-200 text-green-900';
    case ACTIONS.MUCKED:
      return 'bg-gray-400 text-gray-900';
    case ACTIONS.WON:
      return 'bg-green-400 text-green-900';
    default:
      return 'bg-gray-100 text-gray-900';
  }
};

/**
 * Gets seat background and ring colors based on action (used in table view)
 * @param {string} action - Action constant
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {Object} ACTIONS - Actions constants
 * @returns {Object} - {bg, ring} with Tailwind classes
 */
export const getSeatActionStyle = (action, isFoldAction, ACTIONS) => {
  if (isFoldAction(action)) {
    return { bg: 'bg-red-400', ring: 'ring-red-300' };
  }

  switch (action) {
    case ACTIONS.LIMP:
      return { bg: 'bg-gray-400', ring: 'ring-gray-300' };
    case ACTIONS.CALL:
    case ACTIONS.CHECK:
      return { bg: 'bg-blue-300', ring: 'ring-blue-200' };
    case ACTIONS.OPEN:
      return { bg: 'bg-green-400', ring: 'ring-green-300' };
    case ACTIONS.THREE_BET:
    case ACTIONS.STAB:
      return { bg: 'bg-yellow-400', ring: 'ring-yellow-300' };
    case ACTIONS.FOUR_BET:
    case ACTIONS.DONK:
    case ACTIONS.CHECK_RAISE:
      return { bg: 'bg-orange-400', ring: 'ring-orange-300' };
    case ACTIONS.CBET_IP_SMALL:
    case ACTIONS.CBET_IP_LARGE:
    case ACTIONS.CBET_OOP_SMALL:
    case ACTIONS.CBET_OOP_LARGE:
      return { bg: 'bg-green-500', ring: 'ring-green-300' };
    default:
      return { bg: 'bg-green-500', ring: 'ring-green-300' };
  }
};

/**
 * Determines overlay status for showdown view
 * @param {string} inactiveStatus - Inactive status (SEAT_STATUS.FOLDED or SEAT_STATUS.ABSENT)
 * @param {boolean} isMucked - Whether seat mucked
 * @param {boolean} hasWon - Whether seat won
 * @param {Object} SEAT_STATUS - Seat status constants
 * @returns {string|null} - Status string or null
 */
export const getOverlayStatus = (inactiveStatus, isMucked, hasWon, SEAT_STATUS) => {
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
 * @param {Object} ACTIONS - Actions constants
 * @param {Object} SEAT_STATUS - Seat status constants
 * @param {number} mySeat - Player's seat
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} allPlayerCards - All player cards
 * @returns {boolean} - True if all cards assigned
 */
export const allCardsAssigned = (
  numSeats,
  isSeatInactive,
  actionSequence,
  ACTIONS,
  SEAT_STATUS,
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
 * @param {string} action - Action constant
 * @param {Object} ACTION_ABBREV - Abbreviation map
 * @returns {string} - Abbreviated action
 */
export const getActionAbbreviation = (action, ACTION_ABBREV) => {
  return ACTION_ABBREV[action] || action?.substring(0, 3).toUpperCase() || '???';
};

/**
 * Checks if a pattern represents aggressive action
 * @param {string} pattern - Pattern constant
 * @returns {boolean}
 */
export const isAggressivePattern = (pattern) => {
  const aggressivePatterns = [
    'open', '3bet', '4bet', '5bet', 'squeeze', 'iso-raise',
    'bet', 'raise', 'cbet-ip', 'cbet-oop', 'donk', 'probe',
    'stab', 'check-raise', 'raise-vs-cbet', 're-raise', 'float-bet',
  ];
  return aggressivePatterns.includes(pattern);
};

// =============================================================================
// PRIMITIVE ACTION UTILITIES (Phase 1)
// =============================================================================

/**
 * Returns the valid primitive actions for the current game state.
 * @param {string} street - Current street ('preflop', 'flop', 'turn', 'river')
 * @param {boolean} hasBet - Whether there's already a bet on this street
 * @param {boolean} isMultiSeat - Whether tracking multiple seats simultaneously
 * @returns {string[]} Array of valid PRIMITIVE_ACTIONS values
 */
export function getValidActions(street, hasBet, isMultiSeat) {
  const { CHECK, BET, CALL, RAISE, FOLD } = PRIMITIVE_ACTIONS;
  if (isMultiSeat) return [CHECK, BET, CALL, RAISE, FOLD];
  if (street === 'preflop') return [CALL, RAISE, FOLD]; // Blinds are forced bets — no CHECK or BET preflop
  return hasBet ? [CALL, RAISE, FOLD] : [CHECK, BET, FOLD];
}

