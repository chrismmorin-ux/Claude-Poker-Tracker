/**
 * actionMigration.js - Migration utility for action sequence format
 *
 * Converts old seatActions format to new actionSequence format:
 * - Old: seatActions[street][seat] = ["fold", "raise"]
 * - New: actionSequence = [{ seat, action, street, order }, ...]
 *
 * This migration can run automatically during DB upgrade or on-demand.
 * Uses legacyToSequence from sequenceUtils for the conversion.
 */

import { legacyToSequence } from '../utils/sequenceUtils';

/**
 * Migrate a single hand from seatActions to actionSequence format
 * Safe to call on already-migrated hands (idempotent)
 *
 * @param {Object} hand - Full hand record from database
 * @returns {Object} Hand with actionSequence field added
 */
export const migrateHandToSequence = (hand) => {
  if (!hand) return hand;

  // Skip if already has actionSequence with items
  if (hand.actionSequence && hand.actionSequence.length > 0) {
    return hand;
  }

  // Get seatActions from either top-level or nested in gameState
  const seatActions = hand.seatActions || hand.gameState?.seatActions;

  // No seatActions to convert - return with empty sequence
  if (!seatActions) {
    return { ...hand, actionSequence: [] };
  }

  // Convert using legacyToSequence utility
  const actionSequence = legacyToSequence(seatActions);

  return { ...hand, actionSequence };
};

/**
 * Batch migrate multiple hands to actionSequence format
 *
 * @param {Array} hands - Array of hand records
 * @returns {Array} Array of hands with actionSequence field
 */
export const batchMigrateHands = (hands) => {
  if (!Array.isArray(hands)) return [];
  return hands.map(migrateHandToSequence);
};

/**
 * Check if a hand needs migration
 *
 * @param {Object} hand - Hand record to check
 * @returns {boolean} True if hand needs actionSequence migration
 */
export const needsSequenceMigration = (hand) => {
  if (!hand) return false;

  // Already has actionSequence with items
  if (hand.actionSequence && hand.actionSequence.length > 0) {
    return false;
  }

  // Has seatActions that could be converted
  const seatActions = hand.seatActions || hand.gameState?.seatActions;
  if (!seatActions || typeof seatActions !== 'object') {
    return false;
  }

  return Object.keys(seatActions).length > 0;
};
