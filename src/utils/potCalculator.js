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

/**
 * Get sizing option buttons for bet/raise actions.
 *
 * @param {string} street - Current street
 * @param {string} actionType - 'bet' or 'raise'
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @param {number} potTotal - Current pot total
 * @param {number} currentBet - Current bet to face
 * @returns {Array<{ label: string, amount: number }>}
 */
export const getSizingOptions = (street, actionType, blinds, potTotal, currentBet) => {
  const { bb } = blinds || { sb: 1, bb: 2 };

  if (street === 'preflop') {
    if (actionType === PRIMITIVE_ACTIONS.RAISE && currentBet <= bb) {
      // Preflop open (facing only blinds)
      return [
        { label: '2.5x', amount: Math.round(bb * 2.5) },
        { label: '4x', amount: bb * 4 },
        { label: '5x', amount: bb * 5 },
        { label: '10x', amount: bb * 10 },
      ];
    }
    // Preflop raise facing a bet
    return [
      { label: '2x', amount: currentBet * 2 },
      { label: '3x', amount: currentBet * 3 },
      { label: '4x', amount: currentBet * 4 },
      { label: '5x', amount: currentBet * 5 },
    ];
  }

  // Postflop
  if (actionType === PRIMITIVE_ACTIONS.BET) {
    // Bet into pot (no current bet)
    const pot = potTotal || 1;
    return [
      { label: '1/4', amount: Math.round(pot * 0.25) },
      { label: '1/2', amount: Math.round(pot * 0.5) },
      { label: '3/4', amount: Math.round(pot * 0.75) },
      { label: '1x', amount: pot },
    ];
  }

  // Raise facing a bet (postflop)
  return [
    { label: '2x', amount: currentBet * 2 },
    { label: '3x', amount: currentBet * 3 },
    { label: '4x', amount: currentBet * 4 },
    { label: '5x', amount: currentBet * 5 },
  ];
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
