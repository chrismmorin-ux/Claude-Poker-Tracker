/**
 * primitiveActions.js - Primitive poker action constants
 *
 * Defines the 5 fundamental poker actions that all other actions derive from.
 * Complex actions like "3bet", "cbet", "check-raise" are patterns (sequences of primitives).
 *
 * @module primitiveActions
 */

/**
 * The 5 primitive poker actions - the atomic building blocks of all betting.
 * Every poker action can be decomposed into these primitives.
 *
 * @constant {Object} PRIMITIVE_ACTIONS
 * @property {string} CHECK - Pass when no bet to call (cost: 0)
 * @property {string} BET - First chips into pot on a street
 * @property {string} CALL - Match existing bet amount
 * @property {string} RAISE - Increase existing bet amount
 * @property {string} FOLD - Surrender hand, forfeit pot equity
 */
export const PRIMITIVE_ACTIONS = {
  CHECK: 'check',
  BET: 'bet',
  CALL: 'call',
  RAISE: 'raise',
  FOLD: 'fold',
};

/**
 * Maps legacy action values to their primitive equivalents.
 * Used for converting old action data to the new primitive format.
 *
 * Mapping logic:
 * - fold, fold_to_cr, fold_to_cbet → FOLD (all surrender the hand)
 * - limp, call → CALL (matching existing bet/blind)
 * - open, 3bet, 4bet → RAISE (increasing the bet level)
 * - check → CHECK (passing with no bet)
 * - cbet_*, donk, stab → BET (first chips on street)
 * - check_raise → RAISE (response to bet after checking)
 * - mucked, won → null (showdown states, not betting actions)
 *
 * @constant {Object} LEGACY_TO_PRIMITIVE
 */
export const LEGACY_TO_PRIMITIVE = {
  // Preflop actions
  'fold': PRIMITIVE_ACTIONS.FOLD,
  'limp': PRIMITIVE_ACTIONS.CALL,      // Calling the big blind
  'call': PRIMITIVE_ACTIONS.CALL,
  'open': PRIMITIVE_ACTIONS.RAISE,     // First raise preflop
  '3bet': PRIMITIVE_ACTIONS.RAISE,     // Re-raise
  '4bet': PRIMITIVE_ACTIONS.RAISE,     // Re-re-raise

  // Postflop actions - PFR
  'cbet_ip_small': PRIMITIVE_ACTIONS.BET,
  'cbet_ip_large': PRIMITIVE_ACTIONS.BET,
  'cbet_oop_small': PRIMITIVE_ACTIONS.BET,
  'cbet_oop_large': PRIMITIVE_ACTIONS.BET,
  'check': PRIMITIVE_ACTIONS.CHECK,
  'fold_to_cr': PRIMITIVE_ACTIONS.FOLD,

  // Postflop actions - PFC
  'donk': PRIMITIVE_ACTIONS.BET,       // Betting into aggressor
  'stab': PRIMITIVE_ACTIONS.BET,       // Betting when checked to
  'check_raise': PRIMITIVE_ACTIONS.RAISE,
  'fold_to_cbet': PRIMITIVE_ACTIONS.FOLD,

  // Showdown actions (not betting actions)
  'mucked': null,
  'won': null,
};

/**
 * Array of all primitive action values for iteration/validation.
 * @constant {string[]}
 */
export const PRIMITIVE_ACTION_VALUES = Object.values(PRIMITIVE_ACTIONS);

/**
 * Check if a value is a valid primitive action.
 * @param {string} action - The action to check
 * @returns {boolean} True if the action is a primitive action
 */
export const isPrimitiveAction = (action) => PRIMITIVE_ACTION_VALUES.includes(action);

/**
 * Convert a legacy action to its primitive equivalent.
 * @param {string} legacyAction - The legacy action value
 * @returns {string|null} The primitive action, or null for showdown states
 */
export const toPrimitive = (legacyAction) => LEGACY_TO_PRIMITIVE[legacyAction] ?? null;
