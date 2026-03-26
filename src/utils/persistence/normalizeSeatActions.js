/**
 * normalizeSeatActions.js - Migration utility for seatActions format
 *
 * Converts old single-string format to new array format:
 * - Old: seatActions[street][seat] = "fold"
 * - New: seatActions[street][seat] = ["fold"]
 *
 * This migration runs automatically when loading saved hands.
 */

/**
 * Normalizes seatActions to always use array format
 * Safe to call on already-normalized data (idempotent)
 *
 * @param {Object} seatActions - The seatActions object from a hand
 * @returns {Object} Normalized seatActions with all values as arrays
 */
export const normalizeSeatActions = (seatActions) => {
  if (!seatActions || typeof seatActions !== 'object') {
    return {};
  }

  const normalized = {};

  // Iterate through each street (preflop, flop, turn, river, showdown)
  for (const street of Object.keys(seatActions)) {
    const streetActions = seatActions[street];

    if (!streetActions || typeof streetActions !== 'object') {
      normalized[street] = {};
      continue;
    }

    normalized[street] = {};

    // Iterate through each seat's actions
    for (const seat of Object.keys(streetActions)) {
      const actions = streetActions[seat];

      // Already an array - keep as is
      if (Array.isArray(actions)) {
        normalized[street][seat] = actions;
      }
      // Single string - convert to array
      else if (typeof actions === 'string' && actions) {
        normalized[street][seat] = [actions];
      }
      // Null, undefined, or empty - use empty array
      else {
        normalized[street][seat] = [];
      }
    }
  }

  return normalized;
};

/**
 * Normalizes a full hand record's seatActions field
 * Returns the hand with normalized seatActions
 *
 * @param {Object} hand - Full hand record from database
 * @returns {Object} Hand with normalized seatActions
 */
export const normalizeHandRecord = (hand) => {
  if (!hand) return hand;

  return {
    ...hand,
    seatActions: normalizeSeatActions(hand.seatActions)
  };
};
