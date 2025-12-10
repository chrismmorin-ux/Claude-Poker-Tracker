/**
 * primitiveActionValidation.js - Validation for primitive poker actions
 *
 * Validates that primitive actions are legal given the current betting state.
 * Uses simple rules based on whether there's an existing bet to call.
 *
 * @module primitiveActionValidation
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the action is valid
 * @property {string} [error] - Error message if invalid
 */

/**
 * Validates a primitive action given the current betting state.
 *
 * Rules:
 * - CHECK: Only valid when no bet to call (betToCall === 0)
 * - BET: Only valid when no existing bet (betToCall === 0)
 * - CALL: Only valid when there's a bet to call (betToCall > 0)
 * - RAISE: Only valid when there's a bet to raise (betToCall > 0)
 * - FOLD: Always valid (can fold anytime)
 *
 * @param {string} action - The primitive action to validate
 * @param {Object} state - Current betting state
 * @param {number} state.betToCall - Amount needed to call (0 if no bet)
 * @param {boolean} [state.hasActed=false] - Whether player has already acted this street
 * @returns {ValidationResult} Validation result with valid flag and optional error
 */
export const validatePrimitiveAction = (action, state) => {
  const { betToCall = 0, hasActed = false } = state;

  // Check if action is a valid primitive
  if (!Object.values(PRIMITIVE_ACTIONS).includes(action)) {
    return { valid: false, error: `Invalid action: ${action}` };
  }

  switch (action) {
    case PRIMITIVE_ACTIONS.CHECK:
      if (betToCall > 0) {
        return { valid: false, error: 'Cannot check when facing a bet' };
      }
      return { valid: true };

    case PRIMITIVE_ACTIONS.BET:
      if (betToCall > 0) {
        return { valid: false, error: 'Cannot bet when facing a bet (use raise)' };
      }
      return { valid: true };

    case PRIMITIVE_ACTIONS.CALL:
      if (betToCall === 0) {
        return { valid: false, error: 'Nothing to call' };
      }
      return { valid: true };

    case PRIMITIVE_ACTIONS.RAISE:
      if (betToCall === 0) {
        return { valid: false, error: 'Nothing to raise (use bet)' };
      }
      return { valid: true };

    case PRIMITIVE_ACTIONS.FOLD:
      // Folding is always valid, but warn if unnecessary
      if (betToCall === 0) {
        return { valid: true, warning: 'Folding when you could check' };
      }
      return { valid: true };

    default:
      return { valid: false, error: `Unknown action: ${action}` };
  }
};

/**
 * Get valid primitive actions for current betting state.
 *
 * @param {Object} state - Current betting state
 * @param {number} state.betToCall - Amount needed to call (0 if no bet)
 * @returns {string[]} Array of valid primitive actions
 */
export const getValidActions = (state) => {
  const { betToCall = 0 } = state;

  if (betToCall === 0) {
    // No bet to call: can check, bet, or fold
    return [
      PRIMITIVE_ACTIONS.CHECK,
      PRIMITIVE_ACTIONS.BET,
      PRIMITIVE_ACTIONS.FOLD,
    ];
  } else {
    // Facing a bet: can call, raise, or fold
    return [
      PRIMITIVE_ACTIONS.CALL,
      PRIMITIVE_ACTIONS.RAISE,
      PRIMITIVE_ACTIONS.FOLD,
    ];
  }
};

/**
 * Determines if the action opens betting (first voluntary chips into pot on street).
 *
 * @param {string} action - The primitive action
 * @param {number} betToCall - Current bet to call
 * @returns {boolean} True if this action opens the betting
 */
export const isOpeningAction = (action, betToCall) => {
  // BET when no bet, or RAISE preflop (since blinds are forced)
  return action === PRIMITIVE_ACTIONS.BET && betToCall === 0;
};

/**
 * Determines if the action is aggressive (putting chips in voluntarily).
 *
 * @param {string} action - The primitive action
 * @returns {boolean} True if the action is aggressive
 */
export const isAggressiveAction = (action) => {
  return action === PRIMITIVE_ACTIONS.BET || action === PRIMITIVE_ACTIONS.RAISE;
};

/**
 * Determines if the action is passive (not aggressive).
 *
 * @param {string} action - The primitive action
 * @returns {boolean} True if the action is passive
 */
export const isPassiveAction = (action) => {
  return action === PRIMITIVE_ACTIONS.CHECK || action === PRIMITIVE_ACTIONS.CALL;
};
