/**
 * potCalculator.js - Pure utility for pot size tracking
 *
 * Calculates running pot total from action sequences and provides
 * sizing options for bet/raise actions.
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

/**
 * Parse a gameType string like "1/2" into { sb, bb } amounts.
 * Returns { sb: 1, bb: 2 } for "1/2", defaults to { sb: 1, bb: 2 } if unparseable.
 *
 * @param {string|null} gameType - e.g. "1/2", "2/5", "5/10"
 * @returns {{ sb: number, bb: number }}
 */
export const parseBlinds = (gameType) => {
  if (!gameType || typeof gameType !== 'string') return { sb: 1, bb: 2 };
  const parts = gameType.split('/');
  if (parts.length !== 2) return { sb: 1, bb: 2 };
  const sb = parseFloat(parts[0]);
  const bb = parseFloat(parts[1]);
  if (isNaN(sb) || isNaN(bb) || sb <= 0 || bb <= 0) return { sb: 1, bb: 2 };
  return { sb, bb };
};

/**
 * Calculate pot total from an action sequence.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @returns {{ total: number, currentBet: number, isEstimated: boolean }}
 */
export const calculatePot = (actionSequence, blinds) => {
  const { sb, bb } = blinds || { sb: 1, bb: 2 };
  let total = sb + bb;
  let currentBet = bb;
  let currentStreet = 'preflop';
  let isEstimated = false;
  let seatContribs = {}; // Track per-seat contributions for correct call amounts

  if (!actionSequence || actionSequence.length === 0) {
    return { total, currentBet, isEstimated };
  }

  for (const entry of actionSequence) {
    // Reset on street change
    if (entry.street !== currentStreet) {
      currentStreet = entry.street;
      currentBet = 0;
      seatContribs = {};
    }

    switch (entry.action) {
      case PRIMITIVE_ACTIONS.FOLD:
      case PRIMITIVE_ACTIONS.CHECK:
        break;

      case PRIMITIVE_ACTIONS.CALL:
        if (entry.amount !== undefined) {
          total += entry.amount;
          seatContribs[entry.seat] = (seatContribs[entry.seat] || 0) + entry.amount;
        } else {
          // Auto-calculate: match current bet minus what seat already contributed
          const alreadyIn = seatContribs[entry.seat] || 0;
          const increment = Math.max(0, currentBet - alreadyIn);
          total += increment;
          seatContribs[entry.seat] = currentBet;
        }
        break;

      case PRIMITIVE_ACTIONS.BET:
        if (entry.amount !== undefined) {
          total += entry.amount;
          currentBet = entry.amount;
          seatContribs[entry.seat] = (seatContribs[entry.seat] || 0) + entry.amount;
        } else {
          isEstimated = true;
        }
        break;

      case PRIMITIVE_ACTIONS.RAISE:
        if (entry.amount !== undefined) {
          total += entry.amount;
          currentBet = entry.amount;
          seatContribs[entry.seat] = (seatContribs[entry.seat] || 0) + entry.amount;
        } else {
          isEstimated = true;
        }
        break;

      default:
        break;
    }
  }

  return { total, currentBet, isEstimated };
};

/**
 * Get the current bet amount on a given street from the action sequence.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {string} street - Street to check
 * @returns {number} Current bet amount (0 if no bet)
 */
export const getCurrentBet = (actionSequence, street) => {
  if (!actionSequence) return 0;
  let currentBet = 0;

  for (const entry of actionSequence) {
    if (entry.street !== street) continue;
    if (
      (entry.action === PRIMITIVE_ACTIONS.BET || entry.action === PRIMITIVE_ACTIONS.RAISE) &&
      entry.amount !== undefined
    ) {
      currentBet = entry.amount;
    }
  }

  return currentBet;
};

/**
 * Calculate per-seat contribution on a given street.
 * Includes blind contributions on preflop.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {string} street - Street to compute for
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @param {number} smallBlindSeat - SB seat number
 * @param {number} bigBlindSeat - BB seat number
 * @returns {Object} Map of seat number to total amount contributed on this street
 */
export const getSeatContributions = (actionSequence, street, blinds, smallBlindSeat, bigBlindSeat) => {
  const contributions = {};
  const { sb, bb } = blinds || { sb: 1, bb: 2 };

  // On preflop, blinds have forced contributions
  if (street === 'preflop') {
    if (smallBlindSeat) contributions[smallBlindSeat] = sb;
    if (bigBlindSeat) contributions[bigBlindSeat] = bb;
  }

  if (!actionSequence) return contributions;

  // Current bet on this street (for auto-calculating call amounts)
  let currentBet = street === 'preflop' ? bb : 0;

  for (const entry of actionSequence) {
    if (entry.street !== street) continue;

    switch (entry.action) {
      case PRIMITIVE_ACTIONS.CALL: {
        const alreadyIn = contributions[entry.seat] || 0;
        const increment = entry.amount !== undefined
          ? entry.amount
          : Math.max(0, currentBet - alreadyIn);
        contributions[entry.seat] = alreadyIn + increment;
        break;
      }
      case PRIMITIVE_ACTIONS.BET:
      case PRIMITIVE_ACTIONS.RAISE:
        if (entry.amount !== undefined) {
          contributions[entry.seat] = (contributions[entry.seat] || 0) + entry.amount;
          currentBet = entry.amount;
        }
        break;
      default:
        break;
    }
  }

  return contributions;
};

// =============================================================================
// RAKE & ANTE UTILITIES
// =============================================================================

/**
 * Estimate rake taken from a pot.
 *
 * Returns 0 when: rakeConfig is null/undefined, or street is preflop
 * and noFlopNoDrop is true (the standard "no flop, no drop" rule).
 * Otherwise: min(potSize * pct, cap).
 *
 * @param {number} potSize - Total pot at showdown
 * @param {object|null} rakeConfig - { pct: number (0-1), cap: number ($), noFlopNoDrop: boolean }
 * @param {string} [street='flop'] - Current street
 * @returns {number} Estimated rake amount
 */
export const estimateRake = (potSize, rakeConfig, street = 'flop') => {
  if (!rakeConfig || potSize <= 0) return 0;
  if (street === 'preflop' && rakeConfig.noFlopNoDrop) return 0;
  const { pct = 0, cap = Infinity } = rakeConfig;
  return Math.min(potSize * pct, cap);
};

/**
 * Calculate the starting pot from blinds and antes.
 *
 * Supports two ante formats:
 * - 'per-player': Each player posts an ante (online tournaments).
 *   Pot = sb + bb + (ante * seatCount)
 * - 'bb-ante': BB posts the ante in addition to their blind (live tournaments).
 *   Pot = sb + bb + ante
 *
 * @param {{ sb: number, bb: number }} blinds
 * @param {{ amount: number, format: 'per-player'|'bb-ante', seatCount: number }} [anteConfig]
 * @returns {number} Starting pot size
 */
export const calculateStartingPot = (blinds, anteConfig) => {
  const { sb = 0, bb = 0 } = blinds || {};
  let pot = sb + bb;
  if (anteConfig && anteConfig.amount > 0) {
    if (anteConfig.format === 'bb-ante') {
      pot += anteConfig.amount;
    } else {
      // Default: per-player
      pot += anteConfig.amount * (anteConfig.seatCount || 2);
    }
  }
  return pot;
};

// Default multiplier/fraction arrays for each sizing scenario
const DEFAULT_PREFLOP_OPEN = [2.5, 4, 5, 10];
const DEFAULT_PREFLOP_RAISE = [2, 3, 4, 5];
const DEFAULT_POSTFLOP_BET = [0.25, 0.5, 0.75, 1.0];
const DEFAULT_POSTFLOP_RAISE = [2, 3, 4, 5];

// Labels for pot fraction sizing
const fractionLabel = (f) => {
  if (f === 0.25) return '1/4';
  if (f === 0.5) return '1/2';
  if (f === 0.75) return '3/4';
  if (f === 1.0) return '1x';
  return `${f}x`;
};

/**
 * Get sizing option buttons for bet/raise actions.
 *
 * @param {string} street - Current street
 * @param {string} actionType - 'bet' or 'raise'
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @param {number} potTotal - Current pot total
 * @param {number} currentBet - Current bet to face
 * @param {number[]|null} customMultipliers - Optional custom multipliers/fractions to override defaults
 * @returns {Array<{ label: string, amount: number }>}
 */
export const getSizingOptions = (street, actionType, blinds, potTotal, currentBet, customMultipliers) => {
  const { bb } = blinds || { sb: 1, bb: 2 };

  if (street === 'preflop') {
    if (actionType === PRIMITIVE_ACTIONS.RAISE && currentBet <= bb) {
      // Preflop open (facing only blinds)
      const mults = customMultipliers || DEFAULT_PREFLOP_OPEN;
      return mults.map(m => ({ label: `${m}x`, amount: Math.round(bb * m) }));
    }
    // Preflop raise facing a bet
    const mults = customMultipliers || DEFAULT_PREFLOP_RAISE;
    return mults.map(m => ({ label: `${m}x`, amount: Math.round(currentBet * m) }));
  }

  // Postflop
  if (actionType === PRIMITIVE_ACTIONS.BET) {
    // Bet into pot (no current bet)
    const pot = potTotal || 1;
    const fracs = customMultipliers || DEFAULT_POSTFLOP_BET;
    return fracs.map(f => ({ label: fractionLabel(f), amount: Math.round(pot * f) }));
  }

  // Raise facing a bet (postflop)
  const mults = customMultipliers || DEFAULT_POSTFLOP_RAISE;
  return mults.map(m => ({ label: `${m}x`, amount: Math.round(currentBet * m) }));
};

/**
 * Get minimum legal raise amount for the current action sequence.
 * In NL holdem: min raise = currentBet + lastRaiseIncrement.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {string} street - Current street
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @returns {number} Minimum legal raise-to amount
 */
export const getMinRaise = (actionSequence, street, blinds) => {
  const { bb } = blinds || { sb: 1, bb: 2 };
  let previousBet = 0;
  let currentBet = street === 'preflop' ? bb : 0;

  if (actionSequence) {
    for (const entry of actionSequence) {
      if (entry.street !== street) continue;
      if (
        (entry.action === PRIMITIVE_ACTIONS.BET || entry.action === PRIMITIVE_ACTIONS.RAISE) &&
        entry.amount !== undefined
      ) {
        previousBet = currentBet;
        currentBet = entry.amount;
      }
    }
  }

  const lastIncrement = currentBet - previousBet;
  return currentBet + Math.max(lastIncrement, bb);
};
