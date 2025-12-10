/**
 * actionTypes.js - Type definitions for the action sequence system
 *
 * Defines the structure for ordered action sequences that replace
 * the legacy aggregated seatActions format.
 *
 * @module actionTypes
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

/**
 * Valid streets in a poker hand
 * @constant {string[]}
 */
export const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];

/**
 * ActionEntry - A single action in the sequence
 *
 * @typedef {Object} ActionEntry
 * @property {number} seat - Seat number (1-9)
 * @property {string} action - Primitive action (check/bet/call/raise/fold)
 * @property {string} street - Current street (preflop/flop/turn/river)
 * @property {number} order - Action order within the hand (1-indexed)
 * @property {number} [timestamp] - Optional timestamp for timing analysis
 */

/**
 * Creates a new action entry
 *
 * @param {Object} params - Action parameters
 * @param {number} params.seat - Seat number (1-9)
 * @param {string} params.action - Primitive action
 * @param {string} params.street - Current street
 * @param {number} params.order - Action order
 * @returns {ActionEntry}
 */
export const createActionEntry = ({ seat, action, street, order }) => ({
  seat,
  action,
  street,
  order,
  timestamp: Date.now(),
});

/**
 * ActionSequence - The complete action sequence for a hand
 * An ordered array of ActionEntry objects
 *
 * @typedef {ActionEntry[]} ActionSequence
 */

/**
 * Creates an empty action sequence
 * @returns {ActionSequence}
 */
export const createEmptySequence = () => [];

/**
 * Check if an action entry is valid
 *
 * @param {ActionEntry} entry - The entry to validate
 * @returns {boolean}
 */
export const isValidActionEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return false;

  const { seat, action, street, order } = entry;

  // Validate seat (1-9)
  if (!Number.isInteger(seat) || seat < 1 || seat > 9) return false;

  // Validate action is a primitive
  const primitiveValues = Object.values(PRIMITIVE_ACTIONS);
  if (!primitiveValues.includes(action)) return false;

  // Validate street
  if (!STREETS.includes(street)) return false;

  // Validate order (positive integer)
  if (!Number.isInteger(order) || order < 1) return false;

  return true;
};

/**
 * Get the next order number for a new action
 *
 * @param {ActionSequence} sequence - Current sequence
 * @returns {number} Next order number
 */
export const getNextOrder = (sequence) => {
  if (!sequence || sequence.length === 0) return 1;
  return Math.max(...sequence.map(e => e.order)) + 1;
};

/**
 * Filter actions by street
 *
 * @param {ActionSequence} sequence - Full sequence
 * @param {string} street - Street to filter by
 * @returns {ActionSequence} Actions on that street
 */
export const getActionsByStreet = (sequence, street) => {
  if (!sequence) return [];
  return sequence.filter(entry => entry.street === street);
};

/**
 * Filter actions by seat
 *
 * @param {ActionSequence} sequence - Full sequence
 * @param {number} seat - Seat number to filter by
 * @returns {ActionSequence} Actions by that seat
 */
export const getActionsBySeat = (sequence, seat) => {
  if (!sequence) return [];
  return sequence.filter(entry => entry.seat === seat);
};

/**
 * Get the last action in the sequence
 *
 * @param {ActionSequence} sequence - Current sequence
 * @returns {ActionEntry|null}
 */
export const getLastAction = (sequence) => {
  if (!sequence || sequence.length === 0) return null;
  return sequence[sequence.length - 1];
};

/**
 * Get the last action on a specific street
 *
 * @param {ActionSequence} sequence - Current sequence
 * @param {string} street - Street to check
 * @returns {ActionEntry|null}
 */
export const getLastActionOnStreet = (sequence, street) => {
  const streetActions = getActionsByStreet(sequence, street);
  if (streetActions.length === 0) return null;
  return streetActions[streetActions.length - 1];
};

/**
 * Count raise/bet actions on a street (for determining bet level)
 *
 * @param {ActionSequence} sequence - Current sequence
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
 * Check if there has been any aggressive action (bet/raise) on the street
 *
 * @param {ActionSequence} sequence - Current sequence
 * @param {string} street - Street to check
 * @returns {boolean}
 */
export const hasAggressionOnStreet = (sequence, street) => {
  return getBetLevel(sequence, street) > 0;
};
