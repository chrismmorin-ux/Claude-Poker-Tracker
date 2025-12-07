/**
 * seatNavigation.js - Unified seat navigation utilities for showdown
 *
 * Consolidates duplicate "find next seat" logic from:
 * - useShowdownCardSelection.js
 * - useShowdownHandlers.js
 * - cardReducer.js
 */

import { SEAT_STATUS, ACTIONS } from '../constants/gameConstants';

/**
 * Checks if a seat has a specific showdown action (MUCKED or WON)
 * Handles both array and single-value action formats
 *
 * @param {number} seat - Seat number (1-9)
 * @param {string} action - Action to check (ACTIONS.MUCKED or ACTIONS.WON)
 * @param {Object} seatActions - Current seat actions state
 * @returns {boolean} True if seat has the action
 */
const hasShowdownAction = (seat, action, seatActions) => {
  const showdownActions = seatActions['showdown']?.[seat] || [];
  return showdownActions.includes(action);
};

/**
 * Checks if a seat is active for showdown (not folded, absent, mucked, or won)
 *
 * @param {number} seat - Seat number (1-9)
 * @param {Function} isSeatInactive - Function that returns seat status
 * @param {Object} seatActions - Current seat actions state
 * @returns {boolean} True if seat is active for showdown
 */
export const isSeatShowdownActive = (seat, isSeatInactive, seatActions) => {
  const status = isSeatInactive(seat);
  if (status === SEAT_STATUS.FOLDED || status === SEAT_STATUS.ABSENT) {
    return false;
  }
  if (hasShowdownAction(seat, ACTIONS.MUCKED, seatActions)) {
    return false;
  }
  if (hasShowdownAction(seat, ACTIONS.WON, seatActions)) {
    return false;
  }
  return true;
};

/**
 * Finds the first active seat starting from seat 1
 *
 * @param {number} numSeats - Total number of seats
 * @param {Function} isSeatInactive - Function that returns seat status
 * @param {Object} seatActions - Current seat actions state
 * @returns {number|null} First active seat number or null if none
 */
export const findFirstActiveSeat = (numSeats, isSeatInactive, seatActions) => {
  for (let seat = 1; seat <= numSeats; seat++) {
    if (isSeatShowdownActive(seat, isSeatInactive, seatActions)) {
      return seat;
    }
  }
  return null;
};

/**
 * Finds the next active seat after fromSeat
 *
 * @param {number} fromSeat - Current seat number
 * @param {number} numSeats - Total number of seats
 * @param {Function} isSeatInactive - Function that returns seat status
 * @param {Object} seatActions - Current seat actions state
 * @returns {number|null} Next active seat number or null if none
 */
export const findNextActiveSeat = (fromSeat, numSeats, isSeatInactive, seatActions) => {
  for (let seat = fromSeat + 1; seat <= numSeats; seat++) {
    if (isSeatShowdownActive(seat, isSeatInactive, seatActions)) {
      return seat;
    }
  }
  return null;
};

/**
 * Gets the cards for a seat (handles mySeat using holeCards)
 *
 * @param {number} seat - Seat number
 * @param {number} mySeat - Player's seat number
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} allPlayerCards - All player cards object
 * @returns {Array} Cards for the seat [card1, card2]
 */
const getSeatCards = (seat, mySeat, holeCards, allPlayerCards) => {
  return seat === mySeat ? holeCards : allPlayerCards[seat];
};

/**
 * Finds the next empty card slot in showdown
 * Checks second slot of current seat first, then searches subsequent active seats
 *
 * @param {number} currentSeat - Current seat number
 * @param {number} currentSlot - Current slot index (0 or 1)
 * @param {number} mySeat - Player's seat number
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} allPlayerCards - All player cards object
 * @param {number} numSeats - Total number of seats
 * @param {Function} isSeatInactive - Function that returns seat status
 * @param {Object} seatActions - Current seat actions state
 * @returns {{seat: number, slot: number}|null} Next empty slot or null if none
 */
export const findNextEmptySlot = (
  currentSeat,
  currentSlot,
  mySeat,
  holeCards,
  allPlayerCards,
  numSeats,
  isSeatInactive,
  seatActions
) => {
  // First check if the second slot of current seat is empty
  if (currentSlot === 0) {
    const cards = getSeatCards(currentSeat, mySeat, holeCards, allPlayerCards);
    if (!cards[1]) {
      return { seat: currentSeat, slot: 1 };
    }
  }

  // Otherwise, look for next seat with empty slots
  for (let seat = currentSeat + 1; seat <= numSeats; seat++) {
    if (!isSeatShowdownActive(seat, isSeatInactive, seatActions)) {
      continue;
    }
    const cards = getSeatCards(seat, mySeat, holeCards, allPlayerCards);
    if (!cards[0]) {
      return { seat, slot: 0 };
    }
    if (!cards[1]) {
      return { seat, slot: 1 };
    }
  }

  return null;
};
