/**
 * sequenceUtils.js - Utilities for working with action sequences
 *
 * Provides functions for converting between legacy seatActions format
 * and the new ordered actionSequence format.
 *
 * @module sequenceUtils
 */

import { PRIMITIVE_ACTIONS, toPrimitive } from '../constants/primitiveActions';
import { getActionsByStreet, getActionsBySeat, getBetLevel } from '../types/actionTypes';

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
 * Convert actionSequence to legacy seatActions format
 * Used for backwards compatibility during transition
 *
 * @param {Array} sequence - Ordered action sequence
 * @returns {Object} Legacy seatActions format
 */
export const sequenceToLegacy = (sequence) => {
  if (!sequence || !Array.isArray(sequence)) {
    return {};
  }

  const seatActions = {};

  sequence.forEach(entry => {
    const { seat, action, street } = entry;
    if (!seat || !action || !street) return;

    if (!seatActions[street]) {
      seatActions[street] = {};
    }
    if (!seatActions[street][seat]) {
      seatActions[street][seat] = [];
    }

    seatActions[street][seat].push(action);
  });

  return seatActions;
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
