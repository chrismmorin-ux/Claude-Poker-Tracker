/**
 * sessionConstants.js - Session-related constants
 *
 * Provides constants for session management and goals.
 */

// =============================================================================
// SESSION GOALS
// =============================================================================

/**
 * Predefined session goals for quick selection
 */
export const SESSION_GOALS = [
  'Make money',
  'Work on cbets',
  'Work on bluff catching',
  'Work on position awareness',
  'Practice GTO play',
  'Work on 3-betting',
  'Work on check-raising',
  'Tighten up preflop',
  'Play more aggressively',
  'Study opponents',
  'Custom goal...'
];

// =============================================================================
// VENUES
// =============================================================================

/**
 * Available poker venues for session tracking
 * Used for filtering statistics by location
 */
export const VENUES = [
  'Online',
  'Horseshoe Casino',
  'Wind Creek Casino'
];

// =============================================================================
// GAME TYPES
// =============================================================================

/**
 * Poker game types with default buy-in and rebuy amounts
 * Each game type includes:
 * - label: Display name
 * - buyInDefault: Default buy-in amount for this game
 * - rebuyDefault: Default rebuy amount for this game
 */
export const GAME_TYPES = {
  TOURNAMENT: {
    label: 'Tournament',
    buyInDefault: 0,
    rebuyDefault: 0
  },
  ONE_TWO: {
    label: '1/2',
    buyInDefault: 200,
    rebuyDefault: 200
  },
  ONE_THREE: {
    label: '1/3',
    buyInDefault: 300,
    rebuyDefault: 300
  },
  TWO_FIVE: {
    label: '2/5',
    buyInDefault: 500,
    rebuyDefault: 500
  }
};

/**
 * Array of game type keys for iteration
 */
export const GAME_TYPE_KEYS = Object.keys(GAME_TYPES);

// =============================================================================
// SESSION FIELDS
// =============================================================================

/**
 * Session field identifiers for updates
 */
export const SESSION_FIELDS = {
  VENUE: 'venue',
  GAME_TYPE: 'gameType',
  BUY_IN: 'buyIn',
  REBUY: 'rebuy',
  REBUY_TRANSACTIONS: 'rebuyTransactions',
  RE_UP: 'reUp',
  GOAL: 'goal',
  NOTES: 'notes',
  HAND_COUNT: 'handCount'
};

// =============================================================================
// SESSION STATUS
// =============================================================================

/**
 * Session status types
 */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed'
};

// =============================================================================
// SESSION ACTION TYPES
// =============================================================================

/**
 * Action types for sessionReducer
 */
export const SESSION_ACTIONS = {
  START_SESSION: 'START_SESSION',
  END_SESSION: 'END_SESSION',
  UPDATE_SESSION_FIELD: 'UPDATE_SESSION_FIELD',
  ADD_REBUY: 'ADD_REBUY',
  LOAD_SESSIONS: 'LOAD_SESSIONS',
  SET_ACTIVE_SESSION: 'SET_ACTIVE_SESSION',
  HYDRATE_SESSION: 'HYDRATE_SESSION',
  INCREMENT_HAND_COUNT: 'INCREMENT_HAND_COUNT',
  SET_HAND_COUNT: 'SET_HAND_COUNT',  // Reset or set hand count to specific value
  SET_LOADING: 'SET_LOADING'
};
