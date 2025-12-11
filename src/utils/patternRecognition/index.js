/**
 * patternRecognition/index.js - Pattern recognition module
 *
 * Provides unified API for detecting poker patterns from action sequences.
 * This module computes patterns on-read from primitive actions.
 *
 * @module patternRecognition
 */

// Import functions for local use
import { detectPreflopPattern as _detectPreflopPattern } from './preflopPatterns';
import { detectPostflopPattern as _detectPostflopPattern } from './postflopPatterns';

// Position utilities
export {
  POSITION_NAMES,
  POSITION_CATEGORIES,
  getPositionName,
  getSeatForPosition,
  isInPosition,
  isOutOfPosition,
  getPositionCategory,
  isBlindPosition,
  getPreflopOrder,
  getPostflopOrder,
  isEarlyPosition,
  isLatePosition,
} from './positionUtils';

// Preflop patterns
export {
  PREFLOP_PATTERNS,
  PREFLOP_PATTERN_LABELS,
  detectPreflopPattern,
  getPreflopPatterns,
  getFirstVoluntaryPattern,
  summarizePreflopPatterns,
  getPreflopAggressorFromPatterns,
} from './preflopPatterns';

// Postflop patterns
export {
  POSTFLOP_PATTERNS,
  POSTFLOP_PATTERN_LABELS,
  detectPostflopPattern,
  getPostflopPatterns,
  summarizePostflopPatterns,
  getCbetStats,
} from './postflopPatterns';

/**
 * All pattern constants combined
 */
export const PATTERNS = {
  // Preflop
  FOLD: 'fold',
  LIMP: 'limp',
  OPEN: 'open',
  THREE_BET: '3bet',
  FOUR_BET: '4bet',
  FIVE_BET: '5bet',
  COLD_CALL: 'cold-call',
  SQUEEZE: 'squeeze',
  OVER_LIMP: 'over-limp',
  ISO_RAISE: 'iso-raise',

  // Postflop basic
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',

  // Postflop specific
  CBET_IP: 'cbet-ip',
  CBET_OOP: 'cbet-oop',
  DONK: 'donk',
  PROBE: 'probe',
  STAB: 'stab',
  CHECK_RAISE: 'check-raise',
  RAISE_VS_CBET: 'raise-vs-cbet',
  RE_RAISE: 're-raise',
  FLOAT_CALL: 'float-call',
  FLOAT_BET: 'float-bet',
  FOLD_TO_CBET: 'fold-to-cbet',
  CALL_CBET: 'call-cbet',
  FOLD_TO_CR: 'fold-to-cr',
};

/**
 * Combined pattern labels for UI display
 */
export const PATTERN_LABELS = {
  // Preflop
  fold: 'Fold',
  limp: 'Limp',
  open: 'Open',
  '3bet': '3-Bet',
  '4bet': '4-Bet',
  '5bet': '5-Bet',
  'cold-call': 'Cold Call',
  squeeze: 'Squeeze',
  'over-limp': 'Over-Limp',
  'iso-raise': 'Iso-Raise',

  // Postflop basic
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise',

  // Postflop specific
  'cbet-ip': 'C-Bet (IP)',
  'cbet-oop': 'C-Bet (OOP)',
  donk: 'Donk',
  probe: 'Probe',
  stab: 'Stab',
  'check-raise': 'Check-Raise',
  'raise-vs-cbet': 'Raise vs C-Bet',
  're-raise': 'Re-Raise',
  'float-call': 'Float',
  'float-bet': 'Float Bet',
  'fold-to-cbet': 'Fold to C-Bet',
  'call-cbet': 'Call C-Bet',
  'fold-to-cr': 'Fold to C/R',
};

/**
 * Get the display label for a pattern
 *
 * @param {string} pattern - Pattern constant
 * @returns {string} Human-readable label
 */
export const getPatternLabel = (pattern) => {
  return PATTERN_LABELS[pattern] || pattern || 'Unknown';
};

/**
 * Detect pattern for any action entry (preflop or postflop)
 *
 * @param {Object} actionEntry - The action entry to analyze
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat for position context
 * @returns {string} Pattern name
 */
export const detectPattern = (actionEntry, sequence, buttonSeat) => {
  const { street } = actionEntry;

  if (street === 'preflop') {
    return _detectPreflopPattern(actionEntry, sequence, buttonSeat);
  }

  if (street === 'showdown') {
    return null; // Showdown has no patterns
  }

  return _detectPostflopPattern(actionEntry, sequence, buttonSeat);
};

/**
 * Get all patterns for an entire action sequence
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat for position context
 * @returns {Array} Array of { ...actionEntry, pattern }
 */
export const getAllPatterns = (sequence, buttonSeat) => {
  if (!sequence || sequence.length === 0) return [];

  return sequence
    .filter(e => e.street !== 'showdown')
    .map(entry => ({
      ...entry,
      pattern: detectPattern(entry, sequence, buttonSeat),
    }));
};

/**
 * Get pattern summary for a hand by seat
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat
 * @returns {Object} { seat: { preflop: [patterns], flop: [patterns], ... } }
 */
export const getHandPatternSummary = (sequence, buttonSeat) => {
  const patterns = getAllPatterns(sequence, buttonSeat);
  const summary = {};

  patterns.forEach(p => {
    if (!summary[p.seat]) {
      summary[p.seat] = {
        preflop: [],
        flop: [],
        turn: [],
        river: [],
      };
    }
    if (summary[p.seat][p.street]) {
      summary[p.seat][p.street].push(p.pattern);
    }
  });

  return summary;
};

/**
 * Check if a pattern is aggressive (bet/raise type)
 *
 * @param {string} pattern - Pattern to check
 * @returns {boolean}
 */
export const isAggressivePattern = (pattern) => {
  const aggressivePatterns = [
    PATTERNS.OPEN,
    PATTERNS.THREE_BET,
    PATTERNS.FOUR_BET,
    PATTERNS.FIVE_BET,
    PATTERNS.SQUEEZE,
    PATTERNS.ISO_RAISE,
    PATTERNS.BET,
    PATTERNS.RAISE,
    PATTERNS.CBET_IP,
    PATTERNS.CBET_OOP,
    PATTERNS.DONK,
    PATTERNS.PROBE,
    PATTERNS.STAB,
    PATTERNS.CHECK_RAISE,
    PATTERNS.RAISE_VS_CBET,
    PATTERNS.RE_RAISE,
    PATTERNS.FLOAT_BET,
  ];

  return aggressivePatterns.includes(pattern);
};

/**
 * Check if a pattern is passive (check/call/fold type)
 *
 * @param {string} pattern - Pattern to check
 * @returns {boolean}
 */
export const isPassivePattern = (pattern) => {
  const passivePatterns = [
    PATTERNS.FOLD,
    PATTERNS.LIMP,
    PATTERNS.COLD_CALL,
    PATTERNS.OVER_LIMP,
    PATTERNS.CHECK,
    PATTERNS.CALL,
    PATTERNS.FLOAT_CALL,
    PATTERNS.CALL_CBET,
    PATTERNS.FOLD_TO_CBET,
    PATTERNS.FOLD_TO_CR,
  ];

  return passivePatterns.includes(pattern);
};
