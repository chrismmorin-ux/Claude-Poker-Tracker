/**
 * persistence/validation.js - Persistence layer validation
 *
 * Validators for data before saving to IndexedDB.
 * Ensures data integrity and prevents corruption.
 *
 * Part of Phase C.1 - Audit Fixes (Persistence Hardening)
 */

import { logger } from '../errorHandler';

const MODULE_NAME = 'persistence/validation';

// =============================================================================
// HAND RECORD VALIDATION
// =============================================================================

/**
 * Validates a hand record before saving
 * @param {Object} handRecord - Hand data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateHandRecord = (handRecord) => {
  const errors = [];

  if (!handRecord || typeof handRecord !== 'object') {
    return { valid: false, errors: ['Hand record must be an object'] };
  }

  // Required fields
  if (!handRecord.timestamp || typeof handRecord.timestamp !== 'number') {
    errors.push('Missing or invalid timestamp');
  }

  // gameState validation
  if (!handRecord.gameState) {
    errors.push('Missing gameState');
  } else if (typeof handRecord.gameState !== 'object') {
    errors.push('gameState must be an object');
  } else {
    if (typeof handRecord.gameState.currentStreet !== 'string') {
      errors.push('gameState.currentStreet must be string');
    }
    if (typeof handRecord.gameState.dealerButtonSeat !== 'number') {
      errors.push('gameState.dealerButtonSeat must be number');
    }
    if (typeof handRecord.gameState.mySeat !== 'number') {
      errors.push('gameState.mySeat must be number');
    }
  }

  // cardState validation
  if (!handRecord.cardState) {
    errors.push('Missing cardState');
  } else if (typeof handRecord.cardState !== 'object') {
    errors.push('cardState must be an object');
  } else {
    if (!Array.isArray(handRecord.cardState.communityCards)) {
      errors.push('cardState.communityCards must be array');
    } else if (handRecord.cardState.communityCards.length !== 5) {
      errors.push('cardState.communityCards must have exactly 5 elements');
    }
    if (!Array.isArray(handRecord.cardState.holeCards)) {
      errors.push('cardState.holeCards must be array');
    } else if (handRecord.cardState.holeCards.length !== 2) {
      errors.push('cardState.holeCards must have exactly 2 elements');
    }
  }

  // seatPlayers validation (optional but must be object if present)
  if (handRecord.seatPlayers !== undefined && handRecord.seatPlayers !== null) {
    if (typeof handRecord.seatPlayers !== 'object') {
      errors.push('seatPlayers must be an object');
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// SESSION RECORD VALIDATION
// =============================================================================

/**
 * Validates a session record before saving
 * @param {Object} sessionRecord - Session data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateSessionRecord = (sessionRecord) => {
  const errors = [];

  if (!sessionRecord || typeof sessionRecord !== 'object') {
    return { valid: false, errors: ['Session record must be an object'] };
  }

  // Required fields
  if (!sessionRecord.startTime || typeof sessionRecord.startTime !== 'number') {
    errors.push('Missing or invalid startTime');
  }

  // Optional but typed fields
  if (sessionRecord.buyIn !== null && sessionRecord.buyIn !== undefined) {
    if (typeof sessionRecord.buyIn !== 'number') {
      errors.push('buyIn must be null or number');
    } else if (sessionRecord.buyIn < 0) {
      errors.push('buyIn must be non-negative');
    }
  }

  if (sessionRecord.cashOut !== null && sessionRecord.cashOut !== undefined) {
    if (typeof sessionRecord.cashOut !== 'number') {
      errors.push('cashOut must be null or number');
    } else if (sessionRecord.cashOut < 0) {
      errors.push('cashOut must be non-negative');
    }
  }

  // rebuyTransactions validation
  if (!Array.isArray(sessionRecord.rebuyTransactions)) {
    errors.push('rebuyTransactions must be array');
  } else {
    sessionRecord.rebuyTransactions.forEach((tx, i) => {
      if (!tx || typeof tx !== 'object') {
        errors.push(`rebuyTransactions[${i}] must be an object`);
      } else {
        if (typeof tx.amount !== 'number') {
          errors.push(`rebuyTransactions[${i}].amount must be number`);
        } else if (tx.amount < 0) {
          errors.push(`rebuyTransactions[${i}].amount must be non-negative`);
        }
        if (typeof tx.timestamp !== 'number') {
          errors.push(`rebuyTransactions[${i}].timestamp must be number`);
        }
      }
    });
  }

  // handCount validation
  if (sessionRecord.handCount !== undefined) {
    if (typeof sessionRecord.handCount !== 'number') {
      errors.push('handCount must be a number');
    } else if (sessionRecord.handCount < 0 || !Number.isInteger(sessionRecord.handCount)) {
      errors.push('handCount must be a non-negative integer');
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// PLAYER RECORD VALIDATION
// =============================================================================

/**
 * Validates a player record before saving
 * @param {Object} playerRecord - Player data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validatePlayerRecord = (playerRecord) => {
  const errors = [];

  if (!playerRecord || typeof playerRecord !== 'object') {
    return { valid: false, errors: ['Player record must be an object'] };
  }

  // Required fields
  if (!playerRecord.name || typeof playerRecord.name !== 'string') {
    errors.push('name is required and must be a string');
  } else if (playerRecord.name.trim().length === 0) {
    errors.push('name cannot be empty');
  }

  // Optional string fields
  const optionalStringFields = ['nickname', 'ethnicity', 'build', 'gender', 'facialHair', 'notes', 'avatar'];
  optionalStringFields.forEach(field => {
    if (playerRecord[field] !== undefined && playerRecord[field] !== null) {
      if (typeof playerRecord[field] !== 'string') {
        errors.push(`${field} must be a string`);
      }
    }
  });

  // Boolean fields
  const booleanFields = ['hat', 'sunglasses'];
  booleanFields.forEach(field => {
    if (playerRecord[field] !== undefined && playerRecord[field] !== null) {
      if (typeof playerRecord[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }
  });

  // styleTags validation
  if (playerRecord.styleTags !== undefined && playerRecord.styleTags !== null) {
    if (!Array.isArray(playerRecord.styleTags)) {
      errors.push('styleTags must be an array');
    } else if (!playerRecord.styleTags.every(tag => typeof tag === 'string')) {
      errors.push('styleTags must contain only strings');
    }
  }

  // Timestamp fields
  if (playerRecord.createdAt !== undefined && typeof playerRecord.createdAt !== 'number') {
    errors.push('createdAt must be a number');
  }
  if (playerRecord.lastSeenAt !== undefined && typeof playerRecord.lastSeenAt !== 'number') {
    errors.push('lastSeenAt must be a number');
  }

  // handCount validation
  if (playerRecord.handCount !== undefined) {
    if (typeof playerRecord.handCount !== 'number' || playerRecord.handCount < 0) {
      errors.push('handCount must be a non-negative number');
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Logs validation errors with context
 * @param {string} context - Where validation failed (e.g., 'saveHand', 'createSession')
 * @param {string[]} errors - Array of error messages
 */
export const logValidationErrors = (context, errors) => {
  errors.forEach(error => {
    logger.warn(MODULE_NAME, `${context}: ${error}`);
  });
};

/**
 * Validates and logs errors, returning the validation result
 * @param {Object} record - Record to validate
 * @param {Function} validator - Validation function to use
 * @param {string} context - Context for error logging
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateWithLogging = (record, validator, context) => {
  const result = validator(record);
  if (!result.valid) {
    logValidationErrors(context, result.errors);
  }
  return result;
};
