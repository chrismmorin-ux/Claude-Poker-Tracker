/**
 * gameConstants.js - Game configuration and action constants
 * Centralized constants for poker game logic, actions, and card definitions
 */

// Street definitions
export const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];
export const BETTING_STREETS = ['preflop', 'flop', 'turn', 'river']; // Streets where betting occurs (excludes showdown)

// Card constants
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUIT_ABBREV = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };

// Action type constants
export const ACTIONS = {
  // Preflop actions
  FOLD: 'fold',
  LIMP: 'limp',
  CALL: 'call',
  OPEN: 'open',
  THREE_BET: '3bet',
  FOUR_BET: '4bet',

  // Postflop actions - PFR
  CBET_IP_SMALL: 'cbet_ip_small',
  CBET_IP_LARGE: 'cbet_ip_large',
  CBET_OOP_SMALL: 'cbet_oop_small',
  CBET_OOP_LARGE: 'cbet_oop_large',
  CHECK: 'check',
  FOLD_TO_CR: 'fold_to_cr',

  // Postflop actions - PFC
  DONK: 'donk',
  STAB: 'stab',
  CHECK_RAISE: 'check_raise',
  FOLD_TO_CBET: 'fold_to_cbet',

  // Showdown actions
  MUCKED: 'mucked',
  WON: 'won',
};

// All actions that count as a fold (for checking fold status)
export const FOLD_ACTIONS = [ACTIONS.FOLD, ACTIONS.FOLD_TO_CR, ACTIONS.FOLD_TO_CBET];

// Seat status values (returned by isSeatInactive)
export const SEAT_STATUS = {
  FOLDED: 'folded',
  ABSENT: 'absent',
};

// Array of seat numbers for iteration
export const SEAT_ARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Helper function: Check if an action is a fold action
export const isFoldAction = (action) => FOLD_ACTIONS.includes(action);
