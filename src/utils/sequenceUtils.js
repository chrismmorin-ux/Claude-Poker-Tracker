/**
 * sequenceUtils.js - Utilities for working with action sequences
 *
 * Provides functions for converting between legacy seatActions format
 * and the new ordered actionSequence format.
 *
 * @module sequenceUtils
 */

import { PRIMITIVE_ACTIONS, toPrimitive, isShowdownAction } from '../constants/primitiveActions';
import { STREETS, isFoldAction } from '../constants/gameConstants';

// =============================================================================
// ACTION ENTRY CREATION & VALIDATION
// =============================================================================

/**
 * Creates a new action entry
 * @param {Object} params - Action parameters
 * @returns {Object} ActionEntry
 */
export const createActionEntry = ({ seat, action, street, order, amount }) => {
  const entry = {
    seat,
    action,
    street,
    order,
    timestamp: Date.now(),
  };
  if (amount !== undefined && amount !== null) {
    entry.amount = amount;
  }
  return entry;
};

/**
 * Check if an action entry is valid
 * @param {Object} entry - The entry to validate
 * @returns {boolean}
 */
export const isValidActionEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return false;

  const { seat, action, street, order } = entry;

  if (!Number.isInteger(seat) || seat < 1 || seat > 9) return false;

  const primitiveValues = Object.values(PRIMITIVE_ACTIONS);
  if (!primitiveValues.includes(action) && !isShowdownAction(action)) return false;

  if (!STREETS.includes(street)) return false;

  if (!Number.isInteger(order) || order < 1) return false;

  if (entry.amount !== undefined && (typeof entry.amount !== 'number' || entry.amount < 0)) return false;

  return true;
};

/**
 * Get the next order number for a new action
 * @param {Array} sequence - Current sequence
 * @returns {number} Next order number
 */
export const getNextOrder = (sequence) => {
  if (!sequence || sequence.length === 0) return 1;
  return Math.max(...sequence.map(e => e.order)) + 1;
};

// =============================================================================
// SEQUENCE QUERY FUNCTIONS
// =============================================================================

/**
 * Filter actions by street
 * @param {Array} sequence - Full sequence
 * @param {string} street - Street to filter by
 * @returns {Array} Actions on that street
 */
export const getActionsByStreet = (sequence, street) => {
  if (!sequence) return [];
  return sequence.filter(entry => entry.street === street);
};

/**
 * Filter actions by seat
 * @param {Array} sequence - Full sequence
 * @param {number} seat - Seat number to filter by
 * @returns {Array} Actions by that seat
 */
export const getActionsBySeat = (sequence, seat) => {
  if (!sequence) return [];
  return sequence.filter(entry => entry.seat === seat);
};

/**
 * Get the last action on a specific street
 * @param {Array} sequence - Current sequence
 * @param {string} street - Street to check
 * @returns {Object|null}
 */
export const getLastActionOnStreet = (sequence, street) => {
  const streetActions = getActionsByStreet(sequence, street);
  if (streetActions.length === 0) return null;
  return streetActions[streetActions.length - 1];
};

/**
 * Count raise/bet actions on a street (for determining bet level)
 * @param {Array} sequence - Current sequence
 * @param {string} street - Street to check
 * @returns {number} Number of raises/bets
 */
export const getBetLevel = (sequence, street) => {
  const streetActions = getActionsByStreet(sequence, street);
  return streetActions.filter(
    e => e.action === PRIMITIVE_ACTIONS.RAISE || e.action === PRIMITIVE_ACTIONS.BET
  ).length;
};

/**
 * Convert legacy seatActions format to ordered actionSequence
 *
 * Legacy format: { street: { seat: [actions] } }
 * New format: [{ seat, action, street, order }, ...]
 *
 * Note: This conversion loses original ordering since legacy format
 * doesn't store action order. We approximate order based on seat position.
 *
 * @param {Object} seatActions - Legacy seatActions object
 * @returns {Array} Ordered action sequence
 */
export const legacyToSequence = (seatActions) => {
  if (!seatActions || typeof seatActions !== 'object') {
    return [];
  }

  const sequence = [];
  const streets = ['preflop', 'flop', 'turn', 'river'];
  let order = 1;

  streets.forEach(street => {
    const streetActions = seatActions[street];
    if (!streetActions) return;

    // Sort seats numerically for consistent ordering
    const seats = Object.keys(streetActions)
      .map(Number)
      .sort((a, b) => a - b);

    // For each seat, add their actions in order
    seats.forEach(seat => {
      const actions = streetActions[seat];
      if (!Array.isArray(actions)) return;

      actions.forEach(legacyAction => {
        const primitive = toPrimitive(legacyAction);
        if (primitive) {
          sequence.push({
            seat,
            action: primitive,
            street,
            order: order++,
          });
        }
      });
    });
  });

  return sequence;
};

/**
 * Get summary of actions by seat for a given street
 * Returns object mapping seat number to array of actions
 *
 * @param {Array} sequence - Action sequence
 * @param {string} street - Street to summarize
 * @returns {Object} { seat: [actions] }
 */
export const summarizeByStreet = (sequence, street) => {
  const streetActions = getActionsByStreet(sequence, street);
  const summary = {};

  streetActions.forEach(entry => {
    if (!summary[entry.seat]) {
      summary[entry.seat] = [];
    }
    summary[entry.seat].push(entry.action);
  });

  return summary;
};

/**
 * Get the preflop aggressor (last player to raise preflop)
 *
 * @param {Array} sequence - Action sequence
 * @returns {number|null} Seat number of PFR, or null if no raises
 */
export const getPreflopAggressor = (sequence) => {
  const preflopActions = getActionsByStreet(sequence, 'preflop');
  const raises = preflopActions.filter(e => e.action === PRIMITIVE_ACTIONS.RAISE);

  if (raises.length === 0) return null;
  return raises[raises.length - 1].seat;
};

/**
 * Get players still in the hand (haven't folded)
 *
 * @param {Array} sequence - Action sequence
 * @returns {number[]} Array of seat numbers
 */
export const getActivePlayers = (sequence) => {
  if (!sequence || sequence.length === 0) return [];

  // Get all seats that have acted
  const allSeats = new Set(sequence.map(e => e.seat));

  // Get seats that have folded
  const foldedSeats = new Set(
    sequence
      .filter(e => e.action === PRIMITIVE_ACTIONS.FOLD)
      .map(e => e.seat)
  );

  // Return seats that haven't folded
  return Array.from(allSeats)
    .filter(seat => !foldedSeats.has(seat))
    .sort((a, b) => a - b);
};

/**
 * Check if a seat has acted on the current street
 *
 * @param {Array} sequence - Action sequence
 * @param {number} seat - Seat number
 * @param {string} street - Current street
 * @returns {boolean}
 */
export const hasActedOnStreet = (sequence, seat, street) => {
  const seatActions = getActionsBySeat(sequence, seat);
  return seatActions.some(e => e.street === street);
};

/**
 * Get the number of players who have put money in the pot on a street
 * (i.e., called, bet, or raised)
 *
 * @param {Array} sequence - Action sequence
 * @param {string} street - Street to check
 * @returns {number}
 */
export const getPlayersInPot = (sequence, street) => {
  const streetActions = getActionsByStreet(sequence, street);
  const playersWithMoney = new Set(
    streetActions
      .filter(e =>
        e.action === PRIMITIVE_ACTIONS.CALL ||
        e.action === PRIMITIVE_ACTIONS.BET ||
        e.action === PRIMITIVE_ACTIONS.RAISE
      )
      .map(e => e.seat)
  );

  return playersWithMoney.size;
};

/**
 * Check if action would be a cold call (calling a raise without having acted)
 *
 * @param {Array} sequence - Action sequence
 * @param {number} seat - Seat considering calling
 * @param {string} street - Current street
 * @returns {boolean}
 */
export const wouldBeColdCall = (sequence, seat, street) => {
  // Has this seat already acted this street?
  if (hasActedOnStreet(sequence, seat, street)) {
    return false;
  }

  // Is there a raise/bet to cold call?
  return getBetLevel(sequence, street) > 0;
};

/**
 * Check if action would be a squeeze (3bet with callers in pot)
 *
 * @param {Array} sequence - Action sequence
 * @param {number} seat - Seat considering raising
 * @returns {boolean} True if raising would be a squeeze
 */
// =============================================================================
// ACTIONSEQUENCE-NATIVE QUERY FUNCTIONS
// =============================================================================

/**
 * Check if a seat has folded anywhere in the sequence
 * @param {Array} sequence - Action sequence
 * @param {number} seat - Seat number
 * @returns {boolean}
 */
export const hasSeatFolded = (sequence, seat) => {
  if (!sequence) return false;
  return sequence.some(e => e.seat === seat && isFoldAction(e.action));
};

/**
 * Get action strings for a seat on a specific street
 * Replaces `seatActions[street]?.[seat] || []`
 * @param {Array} sequence - Action sequence
 * @param {number} seat - Seat number
 * @param {string} street - Street name
 * @returns {string[]} Array of action strings
 */
export const getActionsForSeatOnStreet = (sequence, seat, street) => {
  if (!sequence) return [];
  return sequence
    .filter(e => e.seat === seat && e.street === street)
    .map(e => e.action);
};

/**
 * Check if there's been a bet or raise on a street
 * Replaces `hasBetOnStreet(seatActions, street)`
 * @param {Array} sequence - Action sequence
 * @param {string} street - Street name
 * @returns {boolean}
 */
export const hasBetOrRaiseOnStreet = (sequence, street) => {
  if (!sequence) return false;
  return sequence.some(
    e => e.street === street &&
      (e.action === PRIMITIVE_ACTIONS.BET || e.action === PRIMITIVE_ACTIONS.RAISE)
  );
};

/**
 * Get showdown actions for a seat
 * @param {Array} sequence - Action sequence
 * @param {number} seat - Seat number
 * @returns {string[]} Array of showdown action strings
 */
export const getShowdownActions = (sequence, seat) => {
  return getActionsForSeatOnStreet(sequence, seat, 'showdown');
};

/**
 * Check if a seat has a specific showdown action
 * @param {Array} sequence - Action sequence
 * @param {number} seat - Seat number
 * @param {string} action - 'mucked' or 'won'
 * @returns {boolean}
 */
export const hasShowdownAction = (sequence, seat, action) => {
  if (!sequence) return false;
  return sequence.some(
    e => e.seat === seat && e.street === 'showdown' && e.action === action
  );
};

export const wouldBeSqueeze = (sequence, seat) => {
  const preflopActions = getActionsByStreet(sequence, 'preflop');

  // Need exactly one raise so far
  const raises = preflopActions.filter(e => e.action === PRIMITIVE_ACTIONS.RAISE);
  if (raises.length !== 1) return false;

  // Need at least one caller after the raise
  const raiseOrder = raises[0].order;
  const callersAfterRaise = preflopActions.filter(
    e => e.action === PRIMITIVE_ACTIONS.CALL && e.order > raiseOrder
  );

  return callersAfterRaise.length >= 1;
};
