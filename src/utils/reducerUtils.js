/**
 * reducerUtils.js - Reducer validation and debugging utilities
 *
 * Provides:
 * - State schema validation
 * - Validated reducer wrapper for catching state corruption
 * - Action logging in debug mode
 *
 * Usage:
 *   import { createValidatedReducer, validateSchema } from '../utils/reducerUtils';
 *
 *   const SCHEMA = { ... };
 *   export const myReducer = createValidatedReducer(rawReducer, SCHEMA, 'MyReducer');
 */

import { logger, AppError, ERROR_CODES, DEBUG } from './errorHandler';

// =============================================================================
// SCHEMA VALIDATION
// =============================================================================

/**
 * Validate a value against a schema rule
 *
 * @param {any} value - Value to validate
 * @param {Object} rule - Schema rule
 * @param {string} path - Path to the value (for error messages)
 * @returns {string|null} Error message or null if valid
 */
const validateValue = (value, rule, path) => {
  // Check required (null/undefined)
  if (value === null || value === undefined) {
    if (rule.required) {
      return `${path} is required but was ${value}`;
    }
    // Not required and not present - skip other checks
    return null;
  }

  // Type checking
  if (rule.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (rule.type === 'array' && !Array.isArray(value)) {
      return `${path} should be array but was ${actualType}`;
    }

    if (rule.type !== 'array' && actualType !== rule.type) {
      return `${path} should be ${rule.type} but was ${actualType}`;
    }
  }

  // Enum checking
  if (rule.enum && !rule.enum.includes(value)) {
    return `${path} should be one of [${rule.enum.join(', ')}] but was "${value}"`;
  }

  // Range checking for numbers
  if (rule.type === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return `${path} should be >= ${rule.min} but was ${value}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return `${path} should be <= ${rule.max} but was ${value}`;
    }
  }

  // Array item validation
  if (rule.type === 'array' && rule.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const itemError = validateValue(value[i], { type: rule.items }, `${path}[${i}]`);
      if (itemError) return itemError;
    }
  }

  // Length checking for arrays and strings
  if (rule.length !== undefined) {
    if (value.length !== rule.length) {
      return `${path} should have length ${rule.length} but was ${value.length}`;
    }
  }

  return null;
};

/**
 * Validate state against a schema
 *
 * @param {Object} state - State object to validate
 * @param {Object} schema - Schema definition
 * @returns {string[]} Array of error messages (empty if valid)
 *
 * @example
 * const schema = {
 *   currentStreet: { type: 'string', enum: ['preflop', 'flop', 'turn', 'river', 'showdown'] },
 *   dealerButtonSeat: { type: 'number', min: 1, max: 9 },
 *   mySeat: { type: 'number', min: 1, max: 9 },
 *   seatActions: { type: 'object' },
 *   absentSeats: { type: 'array', items: 'number' }
 * };
 * const errors = validateSchema(state, schema);
 */
export const validateSchema = (state, schema) => {
  const errors = [];

  for (const [key, rule] of Object.entries(schema)) {
    const error = validateValue(state[key], rule, key);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
};

// =============================================================================
// VALIDATED REDUCER WRAPPER
// =============================================================================

/**
 * Create a validated reducer that logs actions and validates state
 *
 * In debug mode:
 * - Logs all actions with their payloads
 * - Validates state after each action
 * - Logs state corruption errors with context
 *
 * On error:
 * - Returns previous state to prevent corruption
 * - Logs detailed error with action and state context
 *
 * @param {Function} reducer - The raw reducer function
 * @param {Object} schema - State schema for validation
 * @param {string} moduleName - Module name for logging
 * @returns {Function} Wrapped reducer
 *
 * @example
 * const rawReducer = (state, action) => { ... };
 * const SCHEMA = { ... };
 * export const gameReducer = createValidatedReducer(rawReducer, SCHEMA, 'gameReducer');
 */
export const createValidatedReducer = (reducer, schema, moduleName) => {
  return (state, action) => {
    // Log action in debug mode
    if (DEBUG) {
      logger.action(moduleName, action.type, action.payload);
    }

    try {
      // Execute the reducer
      const newState = reducer(state, action);

      // Validate state shape after every action (debug mode only)
      if (DEBUG && schema) {
        const errors = validateSchema(newState, schema);
        if (errors.length > 0) {
          const appError = new AppError(
            ERROR_CODES.STATE_CORRUPTION,
            `State validation failed after ${action.type}`,
            {
              errors,
              actionType: action.type,
              actionPayload: action.payload,
              // Include first few keys of state for context
              stateKeys: Object.keys(newState).slice(0, 5),
            }
          );
          logger.error(moduleName, appError);

          // Return previous state to prevent corruption
          return state;
        }
      }

      return newState;
    } catch (error) {
      // Log the error with context
      const appError = new AppError(
        ERROR_CODES.REDUCER_FAILED,
        `Reducer threw error on ${action.type}: ${error.message}`,
        {
          actionType: action.type,
          actionPayload: action.payload,
          originalError: error.message,
        }
      );
      logger.error(moduleName, appError);

      // Return previous state to prevent corruption
      return state;
    }
  };
};

// =============================================================================
// COMMON SCHEMA RULES (reusable)
// =============================================================================

/**
 * Common validation rules for reuse across reducers
 */
export const SCHEMA_RULES = {
  // Seat number (1-9)
  seat: { type: 'number', min: 1, max: 9 },

  // Array of seat numbers
  seatArray: { type: 'array', items: 'number' },

  // Street names
  street: {
    type: 'string',
    enum: ['preflop', 'flop', 'turn', 'river', 'showdown']
  },

  // Boolean flag
  boolean: { type: 'boolean' },

  // Optional string
  optionalString: { type: 'string', required: false },

  // Optional number
  optionalNumber: { type: 'number', required: false },

  // Required object
  object: { type: 'object' },

  // Required array
  array: { type: 'array' },
};
