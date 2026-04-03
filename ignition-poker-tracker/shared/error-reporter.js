/**
 * shared/error-reporter.js — Lightweight error reporting for the extension
 *
 * Replaces silent catch blocks with observable error tracking.
 * Ring buffer of last 50 errors, categorized for debugging.
 *
 * Categories: storage, messaging, pipeline, bridge
 */

const MAX_ERRORS = 50;
const MAX_PERSISTED = 10;
const errors = [];
let _persistTimer = null;
let _contextDead = false;

// Messages that should only log once (not on every repeat)
const CONTEXT_DEAD_PATTERNS = [
  'Extension context invalidated',
  'Access to storage is not allowed',
  'Cannot access a chrome',
];

const isContextDeadError = (msg) =>
  CONTEXT_DEAD_PATTERNS.some(p => msg.includes(p));

/**
 * Report an error with category, context, and optional correlation ID.
 * @param {'storage'|'messaging'|'pipeline'|'bridge'|'validation'|'app'} category
 * @param {Error|string} error
 * @param {Object} [context] - May include captureId for hand correlation
 */
export const report = (category, error, context = {}) => {
  const message = error?.message || String(error);

  // Once context is dead, suppress all further logging — nothing useful can happen
  if (_contextDead) return;
  if (isContextDeadError(message)) {
    _contextDead = true;
    console.warn(`[Poker:${category}]`, message, '(further errors suppressed)');
    return;
  }

  const entry = {
    category,
    message,
    source: context.source || 'extension',
    correlationId: context.captureId || context.correlationId || null,
    context,
    timestamp: Date.now(),
  };
  // Deduplicate consecutive identical errors — collapse into count
  const last = errors.length > 0 ? errors[errors.length - 1] : null;
  if (last && last.category === category && last.message === entry.message) {
    last.count = (last.count || 1) + 1;
    last.timestamp = entry.timestamp;
    // Suppress console for repeated errors — already logged on first occurrence
  } else {
    entry.count = 1;
    errors.push(entry);
    if (errors.length > MAX_ERRORS) errors.shift();
    console.warn(`[Poker:${category}]`, entry.message, context);
  }

  // Throttled persist: write count + last 10 errors to session storage (max 1 write per 5s)
  if (!_persistTimer) {
    _persistTimer = setTimeout(() => {
      _persistTimer = null;
      _persistToStorage();
    }, 5000);
  }
};

/** Persist error count + recent entries to chrome.storage.session. */
const _persistToStorage = () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      const recent = errors.slice(-MAX_PERSISTED).map(e => ({
        category: e.category,
        message: e.message,
        source: e.source,
        correlationId: e.correlationId,
        count: e.count,
        timestamp: e.timestamp,
      }));
      // .catch() required — chrome.storage.session is not accessible from
      // content scripts in iframe contexts, and returns a rejected Promise
      chrome.storage.session.set({
        error_count: errors.length,
        error_log: recent,
      }).catch(() => {});
    }
  } catch (_) {
    // Chrome context gone — truly unavoidable
  }
};

/** Immediately flush current errors to storage (for diagnostics). */
export const flush = () => {
  if (_persistTimer) {
    clearTimeout(_persistTimer);
    _persistTimer = null;
  }
  _persistToStorage();
};

export const getErrors = () => [...errors];
export const getCount = () => errors.length;
export const clear = () => { errors.length = 0; };

/** Get error counts grouped by category. */
export const getCountByCategory = () => {
  const counts = {};
  for (const e of errors) {
    counts[e.category] = (counts[e.category] || 0) + (e.count || 1);
  }
  return counts;
};

/**
 * Get all errors matching a correlation ID (e.g., captureId).
 * Useful for tracing a specific hand through the pipeline.
 * @param {string} id - Correlation ID to search for
 * @returns {Array} Matching error entries
 */
export const getErrorsByCorrelation = (id) => {
  if (!id) return [];
  return errors.filter(e => e.correlationId === id);
};
