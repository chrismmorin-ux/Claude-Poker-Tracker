/**
 * Error Log Utility
 *
 * Persists errors to localStorage for later review.
 * Used by ViewErrorBoundary and can be used by any error handler.
 *
 * Storage: localStorage key 'poker-tracker-error-log'
 * Limit: 50 entries (FIFO - oldest removed when limit exceeded)
 */

const STORAGE_KEY = 'poker-tracker-error-log';
const MAX_ENTRIES = 50;
const APP_VERSION = 'v115';

/**
 * Error log entry shape
 * @typedef {Object} ErrorLogEntry
 * @property {string} id - UUID
 * @property {number} timestamp - Date.now()
 * @property {string} code - E1xx-E4xx error code
 * @property {string} message - Error message
 * @property {string|null} stack - Stack trace if available
 * @property {Object} context - App state at time of error
 * @property {string} context.view - Current view name
 * @property {boolean} context.sessionActive - Whether session is active
 * @property {number} context.handCount - Current hand count
 * @property {string} userAgent - Browser info
 * @property {string} appVersion - App version
 */

/**
 * Generate a UUID v4
 * @returns {string}
 */
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Get all error log entries from localStorage
 * @returns {ErrorLogEntry[]}
 */
export const getErrorLog = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If parsing fails, return empty array
    return [];
  }
};

/**
 * Save error log entries to localStorage
 * @param {ErrorLogEntry[]} entries
 */
const saveErrorLog = (entries) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    // If localStorage is full, try to clear old entries and retry
    if (e.name === 'QuotaExceededError') {
      const trimmed = entries.slice(-10); // Keep only last 10
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // If still failing, give up silently
      }
    }
  }
};

/**
 * Log an error to persistent storage
 *
 * @param {Object} params
 * @param {string} params.code - Error code (E1xx-E4xx)
 * @param {string} params.message - Error message
 * @param {string|null} [params.stack] - Stack trace
 * @param {Object} [params.context] - App context
 * @param {string} [params.context.view] - Current view
 * @param {boolean} [params.context.sessionActive] - Session active
 * @param {number} [params.context.handCount] - Hand count
 * @returns {ErrorLogEntry} The created log entry
 */
export const logError = ({
  code,
  message,
  stack = null,
  context = {},
}) => {
  const entry = {
    id: generateId(),
    timestamp: Date.now(),
    code,
    message,
    stack: stack ? stack.substring(0, 2000) : null, // Limit stack trace length
    context: {
      view: context.view || 'unknown',
      sessionActive: context.sessionActive ?? false,
      handCount: context.handCount ?? 0,
      ...context, // Allow additional context properties
    },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    appVersion: APP_VERSION,
  };

  const entries = getErrorLog();
  entries.push(entry);

  // Enforce FIFO limit
  const trimmed = entries.length > MAX_ENTRIES
    ? entries.slice(entries.length - MAX_ENTRIES)
    : entries;

  saveErrorLog(trimmed);

  return entry;
};

/**
 * Log an Error object to persistent storage
 * Convenience wrapper for logError that extracts info from Error objects
 *
 * @param {Error} error - Error object
 * @param {string} [errorCode] - Override error code (defaults to E401)
 * @param {Object} [context] - App context
 * @returns {ErrorLogEntry} The created log entry
 */
export const logErrorObject = (error, errorCode = 'E401', context = {}) => {
  // Handle AppError instances
  const code = error.code || errorCode;
  const message = error.message || 'Unknown error';
  const stack = error.stack || null;

  // Merge any context from AppError
  const mergedContext = {
    ...context,
    ...(error.context || {}),
  };

  return logError({
    code,
    message,
    stack,
    context: mergedContext,
  });
};

/**
 * Clear all error log entries
 */
export const clearErrorLog = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors during clear
  }
};

/**
 * Get the count of error log entries
 * @returns {number}
 */
export const getErrorCount = () => {
  return getErrorLog().length;
};

/**
 * Get the most recent N error log entries
 * @param {number} [count=10] - Number of entries to return
 * @returns {ErrorLogEntry[]} Most recent entries (newest first)
 */
export const getRecentErrors = (count = 10) => {
  const entries = getErrorLog();
  return entries.slice(-count).reverse();
};

/**
 * Export error log as JSON string (for bug reports)
 * Sanitizes sensitive data before export
 * @returns {string} JSON string of error log
 */
export const exportErrorLog = () => {
  const entries = getRecentErrors(10);

  // Sanitize entries - remove any potentially sensitive data
  const sanitized = entries.map((entry) => ({
    id: entry.id,
    timestamp: entry.timestamp,
    code: entry.code,
    message: entry.message,
    // Don't include full stack in export
    hasStack: !!entry.stack,
    context: {
      view: entry.context?.view,
      sessionActive: entry.context?.sessionActive,
      handCount: entry.context?.handCount,
    },
    appVersion: entry.appVersion,
    // Include browser type but not full userAgent (privacy)
    browser: getBrowserName(entry.userAgent),
  }));

  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    errorCount: entries.length,
    errors: sanitized,
  }, null, 2);
};

/**
 * Extract browser name from user agent string
 * @param {string} userAgent
 * @returns {string}
 */
const getBrowserName = (userAgent) => {
  if (!userAgent) return 'unknown';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  return 'Other';
};
