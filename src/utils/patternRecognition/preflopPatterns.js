/**
 * preflopPatterns.js - Preflop pattern recognition
 *
 * Derives preflop patterns (limp, open, 3bet, 4bet, cold-call, squeeze)
 * from primitive action sequences.
 *
 * @module patternRecognition/preflopPatterns
 */

import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';
import { getActionsByStreet } from '../../types/actionTypes';

/**
 * Preflop pattern constants
 */
export const PREFLOP_PATTERNS = {
  FOLD: 'fold',
  LIMP: 'limp',           // CALL when betLevel = 0 (only blinds posted)
  OPEN: 'open',           // First RAISE preflop
  THREE_BET: '3bet',      // RAISE when betLevel = 1
  FOUR_BET: '4bet',       // RAISE when betLevel = 2
  FIVE_BET: '5bet',       // RAISE when betLevel = 3
  COLD_CALL: 'cold-call', // CALL a raise without having acted
  SQUEEZE: 'squeeze',     // 3bet with callers in pot
  OVER_LIMP: 'over-limp', // CALL a limp (not the first limper)
  ISO_RAISE: 'iso-raise', // Raise over limper(s)
};

/**
 * Pattern display names for UI
 */
export const PREFLOP_PATTERN_LABELS = {
  [PREFLOP_PATTERNS.FOLD]: 'Fold',
  [PREFLOP_PATTERNS.LIMP]: 'Limp',
  [PREFLOP_PATTERNS.OPEN]: 'Open',
  [PREFLOP_PATTERNS.THREE_BET]: '3-Bet',
  [PREFLOP_PATTERNS.FOUR_BET]: '4-Bet',
  [PREFLOP_PATTERNS.FIVE_BET]: '5-Bet',
  [PREFLOP_PATTERNS.COLD_CALL]: 'Cold Call',
  [PREFLOP_PATTERNS.SQUEEZE]: 'Squeeze',
  [PREFLOP_PATTERNS.OVER_LIMP]: 'Over-Limp',
  [PREFLOP_PATTERNS.ISO_RAISE]: 'Iso-Raise',
};

/**
 * Detect preflop pattern for a specific action entry
 *
 * @param {Object} actionEntry - The action entry to analyze
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat for position context
 * @returns {string} Pattern name from PREFLOP_PATTERNS
 */
export const detectPreflopPattern = (actionEntry, sequence, buttonSeat) => {
  const { seat, action, street, order } = actionEntry;

  // Only analyze preflop actions
  if (street !== 'preflop') return null;

  // Get all preflop actions before this one
  const preflopActions = getActionsByStreet(sequence, 'preflop');
  const priorActions = preflopActions.filter(a => a.order < order);

  // Handle FOLD
  if (action === PRIMITIVE_ACTIONS.FOLD) {
    return PREFLOP_PATTERNS.FOLD;
  }

  // Handle CHECK (only BB can check preflop if no raise)
  if (action === PRIMITIVE_ACTIONS.CHECK) {
    return PRIMITIVE_ACTIONS.CHECK; // Not really a pattern, keep as-is
  }

  // Handle CALL patterns
  if (action === PRIMITIVE_ACTIONS.CALL) {
    return detectCallPattern(priorActions, seat);
  }

  // Handle RAISE patterns
  if (action === PRIMITIVE_ACTIONS.RAISE) {
    return detectRaisePattern(priorActions, seat);
  }

  // Handle BET (shouldn't happen preflop, but just in case)
  if (action === PRIMITIVE_ACTIONS.BET) {
    return PREFLOP_PATTERNS.OPEN; // Treat as open
  }

  return null;
};

/**
 * Detect pattern for a CALL action preflop
 *
 * @param {Array} priorActions - Actions before this one
 * @param {number} seat - Seat making the call
 * @returns {string} Pattern name
 */
const detectCallPattern = (priorActions, seat) => {
  // Count raises before this call
  const raises = priorActions.filter(a => a.action === PRIMITIVE_ACTIONS.RAISE);
  const raiseCount = raises.length;

  // Count limps (calls with no prior raise)
  const limps = priorActions.filter(a => {
    if (a.action !== PRIMITIVE_ACTIONS.CALL) return false;
    const actionsBeforeThisCall = priorActions.filter(p => p.order < a.order);
    const raisesBeforeThisCall = actionsBeforeThisCall.filter(p => p.action === PRIMITIVE_ACTIONS.RAISE);
    return raisesBeforeThisCall.length === 0;
  });

  // Check if this player has already acted
  const hasActed = priorActions.some(a => a.seat === seat);

  if (raiseCount === 0) {
    // No raises yet - this is a limp
    if (limps.length === 0) {
      return PREFLOP_PATTERNS.LIMP; // First limper
    }
    return PREFLOP_PATTERNS.OVER_LIMP; // Over-limping
  }

  // There's a raise - this is calling a raise
  if (!hasActed) {
    return PREFLOP_PATTERNS.COLD_CALL; // Cold calling (hasn't acted yet)
  }

  // Player already acted and is now calling - just a regular call
  return PRIMITIVE_ACTIONS.CALL;
};

/**
 * Detect pattern for a RAISE action preflop
 *
 * @param {Array} priorActions - Actions before this one
 * @param {number} seat - Seat making the raise
 * @returns {string} Pattern name
 */
const detectRaisePattern = (priorActions, seat) => {
  // Count raises before this one
  const raises = priorActions.filter(a => a.action === PRIMITIVE_ACTIONS.RAISE);
  const raiseCount = raises.length;

  // Count limps (calls with no prior raise)
  const limps = priorActions.filter(a => {
    if (a.action !== PRIMITIVE_ACTIONS.CALL) return false;
    const actionsBeforeThisCall = priorActions.filter(p => p.order < a.order);
    const raisesBeforeThisCall = actionsBeforeThisCall.filter(p => p.action === PRIMITIVE_ACTIONS.RAISE);
    return raisesBeforeThisCall.length === 0;
  });

  // No prior raises
  if (raiseCount === 0) {
    if (limps.length > 0) {
      return PREFLOP_PATTERNS.ISO_RAISE; // Raising over limpers
    }
    return PREFLOP_PATTERNS.OPEN; // First raise = open
  }

  // One prior raise (considering 3bet)
  if (raiseCount === 1) {
    // Check for squeeze (3bet with callers after the raise)
    const raiseOrder = raises[0].order;
    const callersAfterRaise = priorActions.filter(
      a => a.action === PRIMITIVE_ACTIONS.CALL && a.order > raiseOrder
    );

    if (callersAfterRaise.length >= 1) {
      return PREFLOP_PATTERNS.SQUEEZE;
    }
    return PREFLOP_PATTERNS.THREE_BET;
  }

  // Two prior raises (4bet)
  if (raiseCount === 2) {
    return PREFLOP_PATTERNS.FOUR_BET;
  }

  // Three or more prior raises (5bet+)
  return PREFLOP_PATTERNS.FIVE_BET;
};

/**
 * Get all preflop patterns for a sequence
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat for position context
 * @returns {Array} Array of { ...actionEntry, pattern }
 */
export const getPreflopPatterns = (sequence, buttonSeat) => {
  if (!sequence || sequence.length === 0) return [];

  const preflopActions = getActionsByStreet(sequence, 'preflop');

  return preflopActions.map(entry => ({
    ...entry,
    pattern: detectPreflopPattern(entry, sequence, buttonSeat),
  }));
};

/**
 * Get pattern for a seat's first voluntary action preflop
 * Excludes forced blinds, checks for their first real decision
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} seat - Seat to check
 * @param {number} buttonSeat - Button seat
 * @returns {string|null} Pattern name or null
 */
export const getFirstVoluntaryPattern = (sequence, seat, buttonSeat) => {
  const patterns = getPreflopPatterns(sequence, buttonSeat);
  const seatPatterns = patterns.filter(p => p.seat === seat);

  // Find first non-fold, non-check action (voluntary)
  const voluntary = seatPatterns.find(
    p => p.pattern !== PREFLOP_PATTERNS.FOLD && p.action !== PRIMITIVE_ACTIONS.CHECK
  );

  return voluntary?.pattern || null;
};

/**
 * Summarize preflop patterns by seat
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat
 * @returns {Object} { seat: [patterns] }
 */
export const summarizePreflopPatterns = (sequence, buttonSeat) => {
  const patterns = getPreflopPatterns(sequence, buttonSeat);
  const summary = {};

  patterns.forEach(p => {
    if (!summary[p.seat]) {
      summary[p.seat] = [];
    }
    summary[p.seat].push(p.pattern);
  });

  return summary;
};

/**
 * Get the preflop aggressor from patterns
 * Returns seat of last raiser (open, 3bet, 4bet, etc.)
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat
 * @returns {number|null} Seat number or null
 */
export const getPreflopAggressorFromPatterns = (sequence, buttonSeat) => {
  const patterns = getPreflopPatterns(sequence, buttonSeat);

  const raisePatterns = [
    PREFLOP_PATTERNS.OPEN,
    PREFLOP_PATTERNS.THREE_BET,
    PREFLOP_PATTERNS.FOUR_BET,
    PREFLOP_PATTERNS.FIVE_BET,
    PREFLOP_PATTERNS.ISO_RAISE,
    PREFLOP_PATTERNS.SQUEEZE,
  ];

  const raises = patterns.filter(p => raisePatterns.includes(p.pattern));
  if (raises.length === 0) return null;

  return raises[raises.length - 1].seat;
};
