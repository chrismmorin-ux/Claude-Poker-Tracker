/**
 * actionValidation.js - Poker action sequence validation
 * Validates that action sequences follow legal poker rules
 */

import { TERMINAL_ACTIONS, isFoldAction } from '../constants/gameConstants';

/**
 * Check if action is terminal (blocks further actions)
 * @param {string} action - Action to check
 * @returns {boolean}
 */
export const isTerminalAction = (action) => {
  return TERMINAL_ACTIONS.includes(action);
};

/**
 * Get the last action from an action array
 * @param {Array<string>} actions - Action array
 * @returns {string|null}
 */
export const getLastAction = (actions) => {
  if (!actions || actions.length === 0) return null;
  return actions[actions.length - 1];
};

/**
 * Check if there's an opening bet in the action sequence
 * @param {Array<string>} actions - Action array
 * @param {Object} ACTIONS - Actions constants
 * @returns {boolean}
 */
export const hasOpeningBet = (actions, ACTIONS) => {
  if (!actions || actions.length === 0) return false;
  return actions.some(a =>
    a === ACTIONS.OPEN ||
    a === ACTIONS.THREE_BET ||
    a === ACTIONS.FOUR_BET ||
    a === ACTIONS.DONK ||
    a === ACTIONS.STAB
  );
};

/**
 * Check if there's a check in the action sequence
 * @param {Array<string>} actions - Action array
 * @param {Object} ACTIONS - Actions constants
 * @returns {boolean}
 */
export const hasCheck = (actions, ACTIONS) => {
  if (!actions || actions.length === 0) return false;
  return actions.includes(ACTIONS.CHECK);
};

/**
 * Check if there's a bet in the action sequence (any cbet)
 * @param {Array<string>} actions - Action array
 * @param {Object} ACTIONS - Actions constants
 * @returns {boolean}
 */
export const hasCbet = (actions, ACTIONS) => {
  if (!actions || actions.length === 0) return false;
  return actions.some(a =>
    a === ACTIONS.CBET_IP_SMALL ||
    a === ACTIONS.CBET_IP_LARGE ||
    a === ACTIONS.CBET_OOP_SMALL ||
    a === ACTIONS.CBET_OOP_LARGE
  );
};

/**
 * Validate preflop action sequence
 * @param {Array<string>} currentActions - Current actions for this seat
 * @param {string} newAction - New action to add
 * @param {Object} ACTIONS - Actions constants
 * @returns {{valid: boolean, error?: string}}
 */
const validatePreflopSequence = (currentActions, newAction, ACTIONS) => {
  const lastAction = getLastAction(currentActions);

  // Check if already has terminal action
  if (lastAction && isTerminalAction(lastAction)) {
    return { valid: false, error: `Cannot act after ${lastAction}` };
  }

  // Validate specific sequences
  switch (newAction) {
    case ACTIONS.FOLD:
    case ACTIONS.FOLD_TO_CR:
    case ACTIONS.FOLD_TO_CBET:
      // Can always fold (if not already folded/won)
      return { valid: true };

    case ACTIONS.LIMP:
      // Can only limp if no previous actions
      if (currentActions.length > 0) {
        return { valid: false, error: 'Cannot limp after previous action' };
      }
      return { valid: true };

    case ACTIONS.CALL:
      // Can call if there's been a previous action (open, 3bet, 4bet)
      // But can't call after limp
      if (lastAction === ACTIONS.LIMP) {
        return { valid: false, error: 'Cannot call after limp' };
      }
      return { valid: true };

    case ACTIONS.OPEN:
      // Can only open if no previous actions
      if (currentActions.length > 0) {
        return { valid: false, error: 'Cannot open after previous action' };
      }
      return { valid: true };

    case ACTIONS.THREE_BET:
      // Can 3bet after call or if someone else opened
      // (Note: This is seat-specific validation, global street state would need to track if there was an open)
      return { valid: true };

    case ACTIONS.FOUR_BET:
      // Can 4bet after call or if someone else 3bet
      return { valid: true };

    default:
      return { valid: false, error: `Invalid preflop action: ${newAction}` };
  }
};

/**
 * Validate postflop action sequence
 * @param {Array<string>} currentActions - Current actions for this seat
 * @param {string} newAction - New action to add
 * @param {Object} ACTIONS - Actions constants
 * @returns {{valid: boolean, error?: string}}
 */
const validatePostflopSequence = (currentActions, newAction, ACTIONS) => {
  const lastAction = getLastAction(currentActions);

  // Check if already has terminal action
  if (lastAction && isTerminalAction(lastAction)) {
    return { valid: false, error: `Cannot act after ${lastAction}` };
  }

  const hasCheckBefore = hasCheck(currentActions, ACTIONS);
  const hasCbetBefore = hasCbet(currentActions, ACTIONS);
  const hasBetBefore = hasOpeningBet(currentActions, ACTIONS) || hasCbetBefore;

  // Validate specific sequences
  switch (newAction) {
    case ACTIONS.FOLD:
    case ACTIONS.FOLD_TO_CR:
    case ACTIONS.FOLD_TO_CBET:
      // Can always fold (if not already folded/won)
      return { valid: true };

    case ACTIONS.CHECK:
      // Cannot check after betting
      if (hasBetBefore) {
        return { valid: false, error: 'Cannot check after betting' };
      }
      return { valid: true };

    case ACTIONS.CALL:
      // Can call if there's been a bet
      if (!hasBetBefore) {
        return { valid: false, error: 'Cannot call without a bet' };
      }
      return { valid: true };

    case ACTIONS.CBET_IP_SMALL:
    case ACTIONS.CBET_IP_LARGE:
    case ACTIONS.CBET_OOP_SMALL:
    case ACTIONS.CBET_OOP_LARGE:
      // Cannot cbet after checking
      if (hasCheckBefore) {
        return { valid: false, error: 'Cannot cbet after checking' };
      }
      // Cannot cbet if already bet
      if (currentActions.length > 0) {
        return { valid: false, error: 'Cannot bet multiple times' };
      }
      return { valid: true };

    case ACTIONS.CHECK_RAISE:
      // Must have checked first
      if (!hasCheckBefore) {
        return { valid: false, error: 'Must check before check-raising' };
      }
      // Must have a bet to raise against (this would need global street state)
      return { valid: true };

    case ACTIONS.DONK:
    case ACTIONS.STAB:
      // Donk/stab must be first action
      if (currentActions.length > 0) {
        return { valid: false, error: `${newAction} must be first action` };
      }
      return { valid: true };

    default:
      return { valid: false, error: `Invalid postflop action: ${newAction}` };
  }
};

/**
 * Validate showdown action sequence
 * @param {Array<string>} currentActions - Current actions for this seat
 * @param {string} newAction - New action to add
 * @param {Object} ACTIONS - Actions constants
 * @returns {{valid: boolean, error?: string}}
 */
const validateShowdownSequence = (currentActions, newAction, ACTIONS) => {
  const lastAction = getLastAction(currentActions);

  // Check if already has an action
  if (lastAction) {
    return { valid: false, error: 'Can only have one showdown action' };
  }

  // Only allow showdown actions
  if (newAction === ACTIONS.MUCKED || newAction === ACTIONS.WON) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid showdown action' };
};

/**
 * Validate action sequence for a seat
 * @param {Array<string>} currentActions - Current action sequence for this seat
 * @param {string} newAction - New action to add
 * @param {string} street - Current street
 * @param {Object} ACTIONS - Actions constants
 * @returns {{valid: boolean, error?: string}}
 */
export const validateActionSequence = (currentActions = [], newAction, street, ACTIONS) => {
  if (!newAction) {
    return { valid: false, error: 'No action specified' };
  }

  // Route to appropriate validator based on street
  switch (street) {
    case 'preflop':
      return validatePreflopSequence(currentActions, newAction, ACTIONS);

    case 'flop':
    case 'turn':
    case 'river':
      return validatePostflopSequence(currentActions, newAction, ACTIONS);

    case 'showdown':
      return validateShowdownSequence(currentActions, newAction, ACTIONS);

    default:
      return { valid: false, error: `Invalid street: ${street}` };
  }
};

/**
 * Get valid next actions for a seat
 * @param {Array<string>} currentActions - Current action sequence
 * @param {string} street - Current street
 * @param {Object} ACTIONS - Actions constants
 * @returns {Array<string>} - Array of valid action constants
 */
export const getValidNextActions = (currentActions = [], street, ACTIONS) => {
  const validActions = [];

  // Get all possible actions for this street
  let possibleActions = [];

  if (street === 'preflop') {
    possibleActions = [
      ACTIONS.FOLD,
      ACTIONS.LIMP,
      ACTIONS.CALL,
      ACTIONS.OPEN,
      ACTIONS.THREE_BET,
      ACTIONS.FOUR_BET,
    ];
  } else if (street === 'showdown') {
    possibleActions = [
      ACTIONS.MUCKED,
      ACTIONS.WON,
    ];
  } else {
    possibleActions = [
      ACTIONS.FOLD,
      ACTIONS.CHECK,
      ACTIONS.CALL,
      ACTIONS.CBET_IP_SMALL,
      ACTIONS.CBET_IP_LARGE,
      ACTIONS.CBET_OOP_SMALL,
      ACTIONS.CBET_OOP_LARGE,
      ACTIONS.CHECK_RAISE,
      ACTIONS.DONK,
      ACTIONS.STAB,
      ACTIONS.FOLD_TO_CBET,
      ACTIONS.FOLD_TO_CR,
    ];
  }

  // Test each possible action
  for (const action of possibleActions) {
    const result = validateActionSequence(currentActions, action, street, ACTIONS);
    if (result.valid) {
      validActions.push(action);
    }
  }

  return validActions;
};
