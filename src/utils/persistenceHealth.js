import { logErrorObject } from './errorLog';
import { logger, ERROR_CODES } from './errorHandler';

/**
 * persistenceHealth — "is the app actually saving?" as an observable fact.
 *
 * The four persistence hooks (hands, sessions, players, settings) each catch an
 * init failure and continue with a `// Continue without persistence` comment.
 * Continuing is the right call — a tracker that refuses to open is useless at a
 * table — but it was SILENT. Every button worked, every hand appeared to record,
 * and nothing was being written. At a live session the founder would discover it
 * when the session was already gone.
 *
 * This is the missing half: the hooks still degrade, but they now say so, and
 * the app-root HealthIndicator can surface it. Per navigation-ia.md, an
 * operator/health signal extends HealthIndicator rather than growing a per-view
 * widget (a per-view warning is invisible from the table, which is the one place
 * it matters).
 *
 * Deliberately module-scoped rather than persisted: init runs on every load, so
 * a failure that mattered will re-report itself, and a failure from last week is
 * not evidence about this session. That is the same reasoning that scoped the
 * error-log pill to the running build.
 */

// subsystem id → { subsystem, message, at }
const failures = new Map();

// WS-556: change listeners, so a write failure surfaces without waiting out a poll.
const listeners = new Set();
const notify = () => {
  // A throwing listener must never break the save path that reported the failure.
  listeners.forEach((fn) => {
    try { fn(); } catch { /* listener errors are not the writer's problem */ }
  });
};

/**
 * Record that a persistence subsystem failed to initialise.
 *
 * Also written to the exportable error log (E307) so a bug report carries it —
 * console-only would be invisible on a phone.
 *
 * @param {string} subsystem - 'hands' | 'sessions' | 'players' | 'settings'
 * @param {Error} error
 */
export const reportPersistenceFailure = (subsystem, error) => {
  failures.set(subsystem, {
    subsystem,
    message: error?.message || String(error),
    at: Date.now(),
  });

  logger.error('persistenceHealth', error);
  logErrorObject(error, ERROR_CODES.PERSISTENCE_DEGRADED, {
    view: 'persistence-init',
    subsystem,
  });
  notify();
};

/**
 * Record that a subsystem initialised successfully — clears any prior failure
 * for it. Matters because userId changes re-run init: a guest-session failure
 * must not keep alarming after a signed-in retry succeeds.
 *
 * @param {string} subsystem
 */
export const reportPersistenceHealthy = (subsystem) => {
  const had = failures.delete(subsystem);
  if (had) notify();
};

/**
 * Subscribe to health changes.
 *
 * WS-556: HealthIndicator polled on a 60s interval, which was fine when this module
 * only ever reported INIT failures — those land during boot, and the indicator's 3s
 * post-mount re-read catches them. It is not fine for WRITE failures. A hand that
 * fails to save mid-session could leave "Not saving — data at risk" unshown for a
 * full minute, and a minute at a live table is several decisions and possibly the
 * next hand. Polling stays as the backstop; this makes the common case immediate.
 *
 * @param {Function} listener - called with no arguments whenever health changes
 * @returns {Function} unsubscribe
 */
export const subscribePersistenceHealth = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** @returns {Array<{subsystem: string, message: string, at: number}>} */
export const getPersistenceFailures = () => Array.from(failures.values());

/** @returns {number} how many subsystems are currently not saving */
export const getPersistenceFailureCount = () => failures.size;

/** Test seam. */
export const __resetPersistenceHealth = () => { failures.clear(); listeners.clear(); };
