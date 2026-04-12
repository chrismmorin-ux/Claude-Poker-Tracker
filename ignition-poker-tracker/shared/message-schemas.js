/**
 * shared/message-schemas.js — Runtime message validators
 *
 * Delegates to wire-schemas.js for deep validation of cross-boundary messages.
 * Each validator returns null (valid) or an error string (invalid).
 * Used at boundary points to catch schema drift early.
 */

import {
  validateLiveContext,
  validateExploitSeat,
  validateActionAdvice,
  validateStatus,
  validateTournament,
  validateErrorReport,
} from './wire-schemas.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

const validators = {
  // Content script → SW (hand delivery now uses chrome.storage.session)
  hand_saved: (msg) => {
    if (!msg.captureId) return 'missing captureId';
    return null;
  },

  live_context: (msg) => {
    if (!isObj(msg.context)) return 'missing context object';
    const v = validateLiveContext(msg.context);
    return v.valid ? null : v.errors.join('; ');
  },

  pipeline_status: (msg) => {
    if (!isObj(msg.status)) return 'missing status object';
    return null;
  },

  pipeline_error: (msg) => {
    if (!msg.message && msg.message !== '') return 'missing error message';
    return null;
  },

  diagnostics: (msg) => {
    if (!isObj(msg.data)) return 'missing data object';
    return null;
  },

  hand_complete: (msg) => {
    if (!isObj(msg.hand)) return 'missing hand object';
    return null;
  },

  pipeline_diagnostics: (msg) => {
    if (!isObj(msg.data)) return 'missing data object';
    return null;
  },

  recovery_needed: (msg) => {
    if (typeof msg.reason !== 'string' && typeof msg.message !== 'string') {
      return 'missing reason or message';
    }
    return null;
  },

  recovery_cleared: (_msg) => null,

  silence_alert: (msg) => {
    if (typeof msg.silenceMs !== 'number') return 'silenceMs must be a number';
    return null;
  },

  // SW → app bridge (hand delivery now uses chrome.storage.session)
  status: (msg) => {
    const v = validateStatus(msg);
    return v.valid ? null : v.errors.join('; ');
  },

  // App bridge → SW
  sync_exploits: (msg) => {
    if (!Array.isArray(msg.seats)) return 'seats must be an array';
    for (const seat of msg.seats) {
      const v = validateExploitSeat(seat);
      if (!v.valid) return `seat ${seat?.seat}: ${v.errors.join('; ')}`;
    }
    return null;
  },

  sync_action_advice: (msg) => {
    const v = validateActionAdvice(msg.advice);
    return v.valid ? null : v.errors.join('; ');
  },

  sync_tournament: (msg) => {
    const v = validateTournament(msg.tournament);
    return v.valid ? null : v.errors.join('; ');
  },

  // SW → side panel
  push_pipeline_status: (msg) => {
    if (msg.tableCount === undefined) return 'missing tableCount';
    return null;
  },

  push_hands_updated: (msg) => {
    if (typeof msg.totalHands !== 'number') return 'totalHands must be a number';
    return null;
  },

  push_exploits: (msg) => {
    if (!Array.isArray(msg.seats)) return 'seats must be an array';
    return null;
  },

  push_action_advice: (msg) => {
    const v = validateActionAdvice(msg.advice);
    return v.valid ? null : v.errors.join('; ');
  },
  push_live_context: (msg) => {
    if (!isObj(msg.context)) return 'missing context object';
    const v = validateLiveContext(msg.context);
    return v.valid ? null : v.errors.join('; ');
  },
  push_tournament: (msg) => {
    const v = validateTournament(msg.tournament);
    return v.valid ? null : v.errors.join('; ');
  },

  // App → SW (via app-bridge relay)
  error_report: (msg) => {
    const v = validateErrorReport(msg.report);
    return v.valid ? null : v.errors.join('; ');
  },
};

/**
 * Validate a message against its schema.
 * @param {string} type - Message type
 * @param {object} msg - The full message object
 * @returns {string|null} Error string or null if valid
 */
export const validateMessage = (type, msg) => {
  const validator = validators[type];
  if (!validator) return `unknown message type: ${type}`;
  return validator(msg);
};
