/**
 * playerReducer.js - Player state management
 *
 * Manages player state including all players list and seat assignments.
 * Follows the v108 reducer pattern used by gameReducer, uiReducer, cardReducer, and sessionReducer.
 */

import { PLAYER_ACTIONS } from '../constants/playerConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialPlayerState = {
  // All players (cached for performance)
  allPlayers: [],

  // Seat assignments (ephemeral - per hand)
  // Maps seat number (1-9) to playerId
  // Example: { 1: 5, 3: 12, 7: 2 }
  seatPlayers: {},

  // Loading state
  isLoading: false
};

// =============================================================================
// STATE SCHEMA (for validation)
// =============================================================================

/**
 * Schema for player state validation
 * Used by createValidatedReducer to catch state corruption
 */
export const PLAYER_STATE_SCHEMA = {
  allPlayers: { type: 'array' },
  seatPlayers: { type: 'object' },
  isLoading: { type: 'boolean' },
};

// =============================================================================
// RAW REDUCER
// =============================================================================

/**
 * Player reducer (raw, wrapped with validation below)
 * Handles all player-related state changes
 */
const rawPlayerReducer = (state, action) => {
  switch (action.type) {
    // Load all players from database
    case PLAYER_ACTIONS.LOAD_PLAYERS:
      return {
        ...state,
        allPlayers: action.payload.players
      };

    // Assign a player to a seat
    case PLAYER_ACTIONS.SET_SEAT_PLAYER:
      return {
        ...state,
        seatPlayers: {
          ...state.seatPlayers,
          [action.payload.seat]: action.payload.playerId
        }
      };

    // Clear player from a specific seat
    case PLAYER_ACTIONS.CLEAR_SEAT_PLAYER:
      const { [action.payload.seat]: removed, ...remainingPlayers } = state.seatPlayers;
      return {
        ...state,
        seatPlayers: remainingPlayers
      };

    // Clear all seat assignments (when starting new hand)
    case PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS:
      return {
        ...state,
        seatPlayers: {}
      };

    // Hydrate seat assignments from saved hand
    case PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS:
      return {
        ...state,
        seatPlayers: action.payload.seatPlayers || {}
      };

    // Set loading state
    case PLAYER_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading
      };

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

/**
 * Player reducer wrapped with validation
 * - Logs all actions in debug mode
 * - Validates state after each action
 * - Returns previous state on error (prevents corruption)
 */
export const playerReducer = createValidatedReducer(
  rawPlayerReducer,
  PLAYER_STATE_SCHEMA,
  'playerReducer'
);

// Export action types for convenience
export { PLAYER_ACTIONS };
