/**
 * Centralized Error Handler
 *
 * Provides structured error codes, AppError class, and unified logging.
 * All error codes are searchable - grep for "E1xx" to find state errors, etc.
 *
 * Usage:
 *   import { logger, AppError, ERROR_CODES, DEBUG } from '../utils/errorHandler';
 *
 *   logger.debug('MyModule', 'Processing started', { data });
 *   logger.error('MyModule', new AppError(ERROR_CODES.SAVE_FAILED, 'Failed to save', { handId }));
 */

// =============================================================================
// DEBUG FLAG
// =============================================================================

/**
 * Global debug flag - set to false to disable debug logging
 * All modules should import this instead of defining their own
 */
export const DEBUG = true;

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Structured error codes for quick identification and searchability
 *
 * Code Ranges:
 *   E1xx - State errors (reducers, state shape issues)
 *   E2xx - Validation errors (input validation, poker rules)
 *   E3xx - Persistence errors (IndexedDB, save/load)
 *   E4xx - Component errors (render failures, handlers)
 */
export const ERROR_CODES = {
  // State errors (1xx)
  INVALID_STATE: 'E101',
  STATE_CORRUPTION: 'E102',
  REDUCER_FAILED: 'E103',
  HYDRATION_FAILED: 'E104',

  // Validation errors (2xx)
  INVALID_INPUT: 'E201',
  INVALID_ACTION: 'E202',
  INVALID_SEAT: 'E203',
  INVALID_CARD: 'E204',
  INVALID_STREET: 'E205',
  ACTION_SEQUENCE_INVALID: 'E206',

  // Persistence errors (3xx)
  DB_INIT_FAILED: 'E301',
  SAVE_FAILED: 'E302',
  LOAD_FAILED: 'E303',
  DELETE_FAILED: 'E304',
  MIGRATION_FAILED: 'E305',
  QUOTA_EXCEEDED: 'E306',

  // Component errors (4xx)
  RENDER_FAILED: 'E401',
  HANDLER_FAILED: 'E402',
  HOOK_FAILED: 'E403',
  PROP_INVALID: 'E404',
};

// =============================================================================
// APP ERROR CLASS
// =============================================================================

/**
 * Structured error with code, message, context, and timestamp
 *
 * @example
 * throw new AppError(ERROR_CODES.SAVE_FAILED, 'Failed to save hand', { handId: 123 });
 */
export class AppError extends Error {
  /**
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {Object} context - Additional context for debugging
   */
  constructor(code, message, context = {}) {
    super(`[${code}] ${message}`);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Format error for console output with full context
   * @returns {string} JSON string with error details
   */
  toDebugString() {
    return JSON.stringify({
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      // Include first 3 lines of stack trace for quick debugging
      stack: this.stack?.split('\n').slice(0, 4).join('\n')
    }, null, 2);
  }

  /**
   * Format error for user display (no technical details)
   * @returns {string} User-friendly error message
   */
  toUserString() {
    // Map error codes to user-friendly messages
    const userMessages = {
      E301: 'Unable to connect to local storage. Your data may not be saved.',
      E302: 'Failed to save. Please try again.',
      E303: 'Failed to load data. Please refresh the page.',
      E306: 'Storage is full. Please clear some old hands.',
      E401: 'Something went wrong. Please refresh the page.',
    };
    return userMessages[this.code] || 'An error occurred. Please try again.';
  }
}

// =============================================================================
// LOGGER
// =============================================================================

/**
 * Centralized logger with module prefixes and structured output
 *
 * @example
 * logger.debug('Persistence', 'Saving hand', { handId: 123 });
 * logger.error('Persistence', new AppError(ERROR_CODES.SAVE_FAILED, 'Save failed'));
 */
export const logger = {
  /**
   * Debug level - only logs when DEBUG is true
   * Use for detailed tracing during development
   * @param {string} module - Module name for prefix
   * @param {...any} args - Arguments to log
   */
  debug: (module, ...args) => {
    if (DEBUG) {
      console.log(`[${module}]`, ...args);
    }
  },

  /**
   * Info level - always logs
   * Use for important state changes and events
   * @param {string} module - Module name for prefix
   * @param {...any} args - Arguments to log
   */
  info: (module, ...args) => {
    console.info(`[${module}]`, ...args);
  },

  /**
   * Warning level - always logs
   * Use for recoverable issues that should be addressed
   * @param {string} module - Module name for prefix
   * @param {...any} args - Arguments to log
   */
  warn: (module, ...args) => {
    console.warn(`[${module}]`, ...args);
  },

  /**
   * Error level - always logs
   * Formats AppError instances with full context
   * @param {string} module - Module name for prefix
   * @param {Error|AppError} error - Error to log
   */
  error: (module, error) => {
    if (error instanceof AppError) {
      console.error(`[${module}]`, error.toDebugString());
    } else if (error instanceof Error) {
      console.error(`[${module}]`, {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 4).join('\n')
      });
    } else {
      console.error(`[${module}]`, error);
    }
  },

  /**
   * Action level - logs reducer actions in debug mode
   * Compact format for high-frequency logging
   * @param {string} module - Module name for prefix
   * @param {string} actionType - Redux/useReducer action type
   * @param {any} payload - Action payload (will be stringified)
   */
  action: (module, actionType, payload) => {
    if (DEBUG) {
      const payloadStr = payload !== undefined
        ? JSON.stringify(payload, null, 0).substring(0, 100)
        : '';
      console.log(`[${module}] Action: ${actionType}`, payloadStr);
    }
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a module-specific log function (for backward compatibility)
 * Use this when migrating existing code that uses local log functions
 *
 * @param {string} module - Module name for prefix
 * @returns {{ log: Function, logError: Function }} Module-specific loggers
 *
 * @example
 * const { log, logError } = createModuleLogger('Persistence');
 * log('Saving hand'); // Same as logger.debug('Persistence', 'Saving hand')
 */
export const createModuleLogger = (module) => ({
  log: (...args) => logger.debug(module, ...args),
  logError: (error) => logger.error(module, error),
});

/**
 * Wrap an async function with error handling
 * Catches errors, logs them, and optionally re-throws
 *
 * @param {string} module - Module name for logging
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options
 * @param {boolean} options.rethrow - Whether to re-throw after logging (default: true)
 * @param {any} options.fallback - Value to return on error (only if rethrow is false)
 * @returns {Function} Wrapped function
 *
 * @example
 * const safeSave = withErrorHandling('Persistence', saveHand, { fallback: null });
 * const result = await safeSave(handData); // Returns null on error instead of throwing
 */
export const withErrorHandling = (module, fn, options = {}) => {
  const { rethrow = true, fallback = undefined } = options;

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(module, error);
      if (rethrow) {
        throw error;
      }
      return fallback;
    }
  };
};
