/**
 * postflopPatterns.js - Postflop pattern recognition
 *
 * Derives postflop patterns (c-bet, donk, check-raise, probe, float, etc.)
 * from primitive action sequences.
 *
 * @module patternRecognition/postflopPatterns
 */

import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';
import { getActionsByStreet, getActionsBySeat } from '../../types/actionTypes';
import { getPreflopAggressor, hasActedOnStreet } from '../sequenceUtils';
import { isInPosition, isOutOfPosition } from './positionUtils';

/**
 * Postflop pattern constants
 */
export const POSTFLOP_PATTERNS = {
  // Basic patterns
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',

  // Continuation bet patterns
  CBET_IP: 'cbet-ip',       // C-bet in position
  CBET_OOP: 'cbet-oop',     // C-bet out of position

  // Non-aggressor betting patterns
  DONK: 'donk',             // OOP bet into preflop aggressor
  PROBE: 'probe',           // Bet into aggressor who checked
  STAB: 'stab',             // Bet into uncapped pot

  // Raise patterns
  CHECK_RAISE: 'check-raise',     // Check then raise same street
  RAISE_VS_CBET: 'raise-vs-cbet', // Raising a c-bet
  RE_RAISE: 're-raise',           // Raising a non-cbet bet

  // Float patterns
  FLOAT_CALL: 'float-call',       // Calling with intent to take away
  FLOAT_BET: 'float-bet',         // Betting after floating

  // Response patterns
  FOLD_TO_CBET: 'fold-to-cbet',
  CALL_CBET: 'call-cbet',
  FOLD_TO_CR: 'fold-to-cr',
};

/**
 * Pattern display names for UI
 */
export const POSTFLOP_PATTERN_LABELS = {
  [POSTFLOP_PATTERNS.FOLD]: 'Fold',
  [POSTFLOP_PATTERNS.CHECK]: 'Check',
  [POSTFLOP_PATTERNS.CALL]: 'Call',
  [POSTFLOP_PATTERNS.BET]: 'Bet',
  [POSTFLOP_PATTERNS.RAISE]: 'Raise',
  [POSTFLOP_PATTERNS.CBET_IP]: 'C-Bet (IP)',
  [POSTFLOP_PATTERNS.CBET_OOP]: 'C-Bet (OOP)',
  [POSTFLOP_PATTERNS.DONK]: 'Donk',
  [POSTFLOP_PATTERNS.PROBE]: 'Probe',
  [POSTFLOP_PATTERNS.STAB]: 'Stab',
  [POSTFLOP_PATTERNS.CHECK_RAISE]: 'Check-Raise',
  [POSTFLOP_PATTERNS.RAISE_VS_CBET]: 'Raise vs C-Bet',
  [POSTFLOP_PATTERNS.RE_RAISE]: 'Re-Raise',
  [POSTFLOP_PATTERNS.FLOAT_CALL]: 'Float',
  [POSTFLOP_PATTERNS.FLOAT_BET]: 'Float Bet',
  [POSTFLOP_PATTERNS.FOLD_TO_CBET]: 'Fold to C-Bet',
  [POSTFLOP_PATTERNS.CALL_CBET]: 'Call C-Bet',
  [POSTFLOP_PATTERNS.FOLD_TO_CR]: 'Fold to C/R',
};

/**
 * Detect postflop pattern for a specific action entry
 *
 * @param {Object} actionEntry - The action entry to analyze
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat for position context
 * @returns {string} Pattern name from POSTFLOP_PATTERNS
 */
export const detectPostflopPattern = (actionEntry, sequence, buttonSeat) => {
  const { seat, action, street, order } = actionEntry;

  // Only analyze postflop streets
  if (street === 'preflop' || street === 'showdown') return null;

  const preflopAggressor = getPreflopAggressor(sequence);
  const isPFR = seat === preflopAggressor;

  // Get all actions on this street before this one
  const streetActions = getActionsByStreet(sequence, street);
  const priorStreetActions = streetActions.filter(a => a.order < order);
  const seatPriorActions = priorStreetActions.filter(a => a.seat === seat);

  // Handle basic actions
  if (action === PRIMITIVE_ACTIONS.CHECK) {
    return POSTFLOP_PATTERNS.CHECK;
  }

  if (action === PRIMITIVE_ACTIONS.FOLD) {
    return detectFoldPattern(priorStreetActions, sequence, preflopAggressor);
  }

  if (action === PRIMITIVE_ACTIONS.CALL) {
    return detectCallPattern(priorStreetActions, sequence, seat, street, preflopAggressor);
  }

  if (action === PRIMITIVE_ACTIONS.BET) {
    return detectBetPattern(
      seat,
      street,
      priorStreetActions,
      sequence,
      buttonSeat,
      preflopAggressor,
      isPFR
    );
  }

  if (action === PRIMITIVE_ACTIONS.RAISE) {
    return detectRaisePattern(seatPriorActions, priorStreetActions, sequence, preflopAggressor);
  }

  return null;
};

/**
 * Detect pattern for a FOLD action postflop
 */
const detectFoldPattern = (priorStreetActions, sequence, preflopAggressor) => {
  const lastBet = getLastBetOrRaise(priorStreetActions);

  if (!lastBet) return POSTFLOP_PATTERNS.FOLD;

  // Check if folding to a c-bet
  if (isCbet(lastBet, sequence, preflopAggressor)) {
    return POSTFLOP_PATTERNS.FOLD_TO_CBET;
  }

  // Check if folding to a check-raise
  const wasCheckRaise = isCheckRaise(lastBet, priorStreetActions);
  if (wasCheckRaise) {
    return POSTFLOP_PATTERNS.FOLD_TO_CR;
  }

  return POSTFLOP_PATTERNS.FOLD;
};

/**
 * Detect pattern for a CALL action postflop
 */
const detectCallPattern = (priorStreetActions, sequence, seat, street, preflopAggressor) => {
  const lastBet = getLastBetOrRaise(priorStreetActions);

  if (!lastBet) return POSTFLOP_PATTERNS.CALL;

  // Check if calling a c-bet
  if (isCbet(lastBet, sequence, preflopAggressor)) {
    return POSTFLOP_PATTERNS.CALL_CBET;
  }

  // Check for float call on flop (to bet later streets)
  if (street === 'flop' && preflopAggressor && lastBet.seat === preflopAggressor) {
    // Could be a float - mark as regular call for now
    // Float detection requires seeing turn action
    return POSTFLOP_PATTERNS.FLOAT_CALL;
  }

  return POSTFLOP_PATTERNS.CALL;
};

/**
 * Detect pattern for a BET action postflop
 */
const detectBetPattern = (
  seat,
  street,
  priorStreetActions,
  sequence,
  buttonSeat,
  preflopAggressor,
  isPFR
) => {
  // If PFR is betting, it's a c-bet
  if (isPFR) {
    // Check position relative to any remaining opponent
    const activeOpponents = getActiveOpponents(sequence, seat, street);
    const isIP = activeOpponents.length > 0 &&
      activeOpponents.every(opp => isInPosition(seat, opp, buttonSeat));

    return isIP ? POSTFLOP_PATTERNS.CBET_IP : POSTFLOP_PATTERNS.CBET_OOP;
  }

  // Non-PFR betting first on street
  const hasAnyBets = priorStreetActions.some(
    a => a.action === PRIMITIVE_ACTIONS.BET || a.action === PRIMITIVE_ACTIONS.RAISE
  );

  if (!hasAnyBets) {
    // First bet on street from non-PFR
    if (preflopAggressor) {
      // Check if aggressor has checked this street
      const aggressorChecked = priorStreetActions.some(
        a => a.seat === preflopAggressor && a.action === PRIMITIVE_ACTIONS.CHECK
      );

      if (aggressorChecked) {
        return POSTFLOP_PATTERNS.PROBE; // Betting into aggressor who checked
      }

      return POSTFLOP_PATTERNS.DONK; // Donk betting into aggressor
    }

    // No preflop aggressor - limped pot
    return POSTFLOP_PATTERNS.STAB;
  }

  // Float bet - betting after calling previous street
  const prevStreet = getPreviousStreet(street);
  if (prevStreet) {
    const prevStreetActions = getActionsByStreet(sequence, prevStreet);
    const calledPrevStreet = prevStreetActions.some(
      a => a.seat === seat && a.action === PRIMITIVE_ACTIONS.CALL
    );

    if (calledPrevStreet && !isPFR) {
      return POSTFLOP_PATTERNS.FLOAT_BET;
    }
  }

  return POSTFLOP_PATTERNS.BET;
};

/**
 * Detect pattern for a RAISE action postflop
 */
const detectRaisePattern = (seatPriorActions, priorStreetActions, sequence, preflopAggressor) => {
  // Check-raise: player checked, then raising
  const playerChecked = seatPriorActions.some(a => a.action === PRIMITIVE_ACTIONS.CHECK);
  if (playerChecked) {
    return POSTFLOP_PATTERNS.CHECK_RAISE;
  }

  // Find what we're raising
  const lastBet = getLastBetOrRaise(priorStreetActions);

  if (lastBet && isCbet(lastBet, sequence, preflopAggressor)) {
    return POSTFLOP_PATTERNS.RAISE_VS_CBET;
  }

  return POSTFLOP_PATTERNS.RE_RAISE;
};

/**
 * Get the last bet or raise action on the street
 */
const getLastBetOrRaise = (streetActions) => {
  const betsRaises = streetActions.filter(
    a => a.action === PRIMITIVE_ACTIONS.BET || a.action === PRIMITIVE_ACTIONS.RAISE
  );

  return betsRaises.length > 0 ? betsRaises[betsRaises.length - 1] : null;
};

/**
 * Check if an action was a c-bet
 */
const isCbet = (actionEntry, sequence, preflopAggressor) => {
  if (!preflopAggressor) return false;
  if (actionEntry.seat !== preflopAggressor) return false;

  // First bet/raise on street from PFR = c-bet
  const streetActions = getActionsByStreet(sequence, actionEntry.street);
  const priorBets = streetActions.filter(
    a => a.order < actionEntry.order &&
      (a.action === PRIMITIVE_ACTIONS.BET || a.action === PRIMITIVE_ACTIONS.RAISE)
  );

  return priorBets.length === 0;
};

/**
 * Check if an action was a check-raise
 */
const isCheckRaise = (raiseEntry, priorStreetActions) => {
  if (raiseEntry.action !== PRIMITIVE_ACTIONS.RAISE) return false;

  const raiseSeatActions = priorStreetActions.filter(a => a.seat === raiseEntry.seat);
  return raiseSeatActions.some(a => a.action === PRIMITIVE_ACTIONS.CHECK);
};

/**
 * Get opponents still in hand (not folded)
 */
const getActiveOpponents = (sequence, mySeat, currentStreet) => {
  const allSeats = new Set(sequence.map(e => e.seat));
  const foldedSeats = new Set(
    sequence
      .filter(e => e.action === PRIMITIVE_ACTIONS.FOLD)
      .map(e => e.seat)
  );

  return Array.from(allSeats)
    .filter(s => s !== mySeat && !foldedSeats.has(s))
    .sort((a, b) => a - b);
};

/**
 * Get previous street name
 */
const getPreviousStreet = (street) => {
  const streets = ['preflop', 'flop', 'turn', 'river'];
  const idx = streets.indexOf(street);
  return idx > 0 ? streets[idx - 1] : null;
};

/**
 * Get all postflop patterns for a sequence
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat for position context
 * @returns {Array} Array of { ...actionEntry, pattern }
 */
export const getPostflopPatterns = (sequence, buttonSeat) => {
  if (!sequence || sequence.length === 0) return [];

  const postflopActions = sequence.filter(
    e => e.street !== 'preflop' && e.street !== 'showdown'
  );

  return postflopActions.map(entry => ({
    ...entry,
    pattern: detectPostflopPattern(entry, sequence, buttonSeat),
  }));
};

/**
 * Summarize postflop patterns by seat and street
 *
 * @param {Array} sequence - Full action sequence
 * @param {number} buttonSeat - Button seat
 * @returns {Object} { street: { seat: [patterns] } }
 */
export const summarizePostflopPatterns = (sequence, buttonSeat) => {
  const patterns = getPostflopPatterns(sequence, buttonSeat);
  const summary = {};

  patterns.forEach(p => {
    if (!summary[p.street]) {
      summary[p.street] = {};
    }
    if (!summary[p.street][p.seat]) {
      summary[p.street][p.seat] = [];
    }
    summary[p.street][p.seat].push(p.pattern);
  });

  return summary;
};

/**
 * Get c-bet frequency data for a seat
 *
 * @param {Array[]} sequences - Array of action sequences
 * @param {number} seat - Seat to analyze
 * @param {number[]} buttonSeats - Button seats for each sequence
 * @returns {Object} { opportunities: number, made: number, percentage: number }
 */
export const getCbetStats = (sequences, seat, buttonSeats) => {
  let opportunities = 0;
  let made = 0;

  sequences.forEach((sequence, i) => {
    const pfr = getPreflopAggressor(sequence);
    if (pfr !== seat) return; // Only count when we were PFR

    // Check flop action
    const flopActions = getActionsByStreet(sequence, 'flop');
    if (flopActions.length === 0) return; // No flop action

    opportunities++;

    // Did we c-bet?
    const ourFlopBet = flopActions.find(
      a => a.seat === seat && a.action === PRIMITIVE_ACTIONS.BET
    );
    if (ourFlopBet) made++;
  });

  return {
    opportunities,
    made,
    percentage: opportunities > 0 ? Math.round((made / opportunities) * 100) : 0,
  };
};
