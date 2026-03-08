/**
 * seatUtils.js - Utility functions for seat navigation and position calculation
 */

import { STREETS, BETTING_STREETS, SEAT_STATUS, isFoldAction } from '../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';
import { hasSeatFolded, hasShowdownAction as seqHasShowdownAction } from './sequenceUtils';

/**
 * Checks if a seat is inactive (absent or folded)
 * @param {number} seat - Seat number
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {Array} actionSequence - Action sequence array
 * @returns {string|null} SEAT_STATUS.ABSENT, SEAT_STATUS.FOLDED, or null
 */
export const isSeatInactive = (seat, absentSeats, actionSequence) => {
  if (absentSeats.includes(seat)) return SEAT_STATUS.ABSENT;

  if (actionSequence.some(e => e.seat === seat && isFoldAction(e.action))) {
    return SEAT_STATUS.FOLDED;
  }

  return null;
};

/**
 * Gets the next seat in clockwise order, skipping absent seats
 * @param {number} currentSeat - Current seat number
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {number} numSeats - Total number of seats
 * @returns {number} - Next active seat
 */
export const getNextActiveSeat = (currentSeat, absentSeats, numSeats) => {
  let seat = (currentSeat % numSeats) + 1;
  let attempts = 0;
  while (absentSeats.includes(seat) && attempts < numSeats) {
    seat = (seat % numSeats) + 1;
    attempts++;
  }
  return seat;
};

/**
 * Gets the small blind seat (first active seat after dealer)
 * @param {number} dealerSeat - Dealer button seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {number} numSeats - Total number of seats
 * @returns {number} - Small blind seat
 */
export const getSmallBlindSeat = (dealerSeat, absentSeats, numSeats) => {
  return getNextActiveSeat(dealerSeat, absentSeats, numSeats);
};

/**
 * Gets the big blind seat (first active seat after small blind)
 * @param {number} dealerSeat - Dealer button seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {number} numSeats - Total number of seats
 * @returns {number} - Big blind seat
 */
export const getBigBlindSeat = (dealerSeat, absentSeats, numSeats) => {
  const sbSeat = getSmallBlindSeat(dealerSeat, absentSeats, numSeats);
  return getNextActiveSeat(sbSeat, absentSeats, numSeats);
};

/**
 * Gets the first seat to act on current street
 * @param {string} currentStreet - Current street
 * @param {number} dealerSeat - Dealer button seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {Array} actionSequence - Action sequence
 * @param {number} numSeats - Total number of seats
 * @returns {number} - First action seat
 */
export const getFirstActionSeat = (
  currentStreet,
  dealerSeat,
  absentSeats,
  actionSequence,
  numSeats
) => {
  if (currentStreet === 'preflop') {
    // First to act preflop is after big blind
    const sbSeat = getSmallBlindSeat(dealerSeat, absentSeats, numSeats);
    const bbSeat = getNextActiveSeat(sbSeat, absentSeats, numSeats);
    let seat = (bbSeat % numSeats) + 1;
    let attempts = 0;
    while (absentSeats.includes(seat) && attempts < numSeats) {
      seat = (seat % numSeats) + 1;
      attempts++;
    }
    return seat;
  } else {
    // Postflop, first to act is first non-absent, non-folded seat after dealer
    let seat = (dealerSeat % numSeats) + 1;
    let attempts = 0;
    while (attempts < numSeats) {
      if (!absentSeats.includes(seat) && !hasSeatFolded(actionSequence, seat)) {
        return seat;
      }
      seat = (seat % numSeats) + 1;
      attempts++;
    }
    return 1; // Fallback
  }
};

/**
 * Gets the next seat to act after current seat
 * @param {number} currentSeat - Current seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {Array} actionSequence - Action sequence
 * @param {number} numSeats - Total number of seats
 * @returns {number|null} - Next action seat or null if no more seats
 */
export const getNextActionSeat = (
  currentSeat,
  absentSeats,
  actionSequence,
  numSeats
) => {
  let seat = (currentSeat % numSeats) + 1;
  let attempts = 0;
  while (attempts < numSeats) {
    if (!absentSeats.includes(seat) && !hasSeatFolded(actionSequence, seat)) {
      return seat;
    }
    seat = (seat % numSeats) + 1;
    attempts++;
  }
  return null; // No more seats to act
};

/**
 * Counts the number of active (non-absent, non-folded) players.
 *
 * @param {Array} actionSequence - Action sequence
 * @param {Array} absentSeats - Absent seat numbers
 * @param {number} numSeats - Total seats at table
 * @returns {number} Count of active players
 */
export const getActiveSeatCount = (actionSequence, absentSeats, numSeats) => {
  let count = 0;
  for (let s = 1; s <= numSeats; s++) {
    if (absentSeats.includes(s)) continue;
    if (!hasSeatFolded(actionSequence, s)) count++;
  }
  return count;
};

/**
 * Determines if a betting street's action is complete following poker rules.
 *
 * Uses a pending-count model: every active player starts as "pending."
 * Each action decrements pending. A bet/raise resets pending to
 * (remaining active players - 1), since everyone else must respond.
 * Street is complete when pending reaches 0.
 *
 * @param {string} street - Street to check
 * @param {Array} actionSequence - Chronological action entries
 * @param {Array} absentSeats - Absent seat numbers
 * @param {number} numSeats - Total seats at table
 * @returns {boolean}
 */
export const isStreetActionComplete = (
  street,
  actionSequence,
  absentSeats,
  numSeats
) => {
  if (!BETTING_STREETS.includes(street)) return false;

  // Get active seats: not absent and not folded on a previous street
  const activeSeats = new Set();
  for (let s = 1; s <= numSeats; s++) {
    if (absentSeats.includes(s)) continue;
    // Check fold on any previous street using actionSequence directly
    const foldedOnPrev = actionSequence.some(
      e => e.seat === s && e.street !== street &&
        STREETS.indexOf(e.street) < STREETS.indexOf(street) &&
        (e.action === PRIMITIVE_ACTIONS.FOLD)
    );
    if (!foldedOnPrev) activeSeats.add(s);
  }

  // 0 or 1 active players — hand is over, street is "complete"
  if (activeSeats.size <= 1) return true;

  // Filter action sequence to this street only
  const streetEntries = actionSequence.filter(e => e.street === street);
  if (streetEntries.length === 0) return false;

  let pendingCount = activeSeats.size; // Everyone needs to act once
  const livePlayers = new Set(activeSeats);

  for (const entry of streetEntries) {
    if (!livePlayers.has(entry.seat)) continue;

    pendingCount--;

    if (entry.action === PRIMITIVE_ACTIONS.FOLD) {
      livePlayers.delete(entry.seat);
      // If only 1 player left, hand is over
      if (livePlayers.size <= 1) return true;
    } else if (entry.action === PRIMITIVE_ACTIONS.BET || entry.action === PRIMITIVE_ACTIONS.RAISE) {
      // Everyone still in (except the aggressor) must respond
      pendingCount = livePlayers.size - 1;
    }

    if (pendingCount <= 0) return true;
  }

  return false;
};

// =============================================================================
// SHOWDOWN SEAT NAVIGATION (merged from seatNavigation.js)
// =============================================================================

/**
 * Checks if a seat is active for showdown (not folded, absent, mucked, or won)
 */
export const isSeatShowdownActive = (seat, isSeatInactive, actionSequence) => {
  const status = isSeatInactive(seat);
  if (status === SEAT_STATUS.FOLDED || status === SEAT_STATUS.ABSENT) {
    return false;
  }
  if (seqHasShowdownAction(actionSequence, seat, 'mucked')) {
    return false;
  }
  if (seqHasShowdownAction(actionSequence, seat, 'won')) {
    return false;
  }
  return true;
};

/**
 * Finds the first active seat starting from seat 1
 */
export const findFirstActiveSeat = (numSeats, isSeatInactive, actionSequence) => {
  for (let seat = 1; seat <= numSeats; seat++) {
    if (isSeatShowdownActive(seat, isSeatInactive, actionSequence)) {
      return seat;
    }
  }
  return null;
};

/**
 * Finds the next active seat after fromSeat
 */
export const findNextActiveSeat = (fromSeat, numSeats, isSeatInactive, actionSequence) => {
  for (let seat = fromSeat + 1; seat <= numSeats; seat++) {
    if (isSeatShowdownActive(seat, isSeatInactive, actionSequence)) {
      return seat;
    }
  }
  return null;
};

/**
 * Gets the cards for a seat (handles mySeat using holeCards)
 */
const getSeatCards = (seat, mySeat, holeCards, allPlayerCards) => {
  return seat === mySeat ? holeCards : allPlayerCards[seat];
};

/**
 * Finds the next empty card slot in showdown
 */
export const findNextEmptySlot = (
  currentSeat,
  currentSlot,
  mySeat,
  holeCards,
  allPlayerCards,
  numSeats,
  isSeatInactive,
  actionSequence
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
    if (!isSeatShowdownActive(seat, isSeatInactive, actionSequence)) {
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

