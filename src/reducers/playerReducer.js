/**
 * playerReducer.js - Player state management
 *
 * Manages player state including all players list and seat assignments.
 * Follows the v108 reducer pattern used by gameReducer, uiReducer, cardReducer, and sessionReducer.
 */

import { PLAYER_ACTIONS } from '../constants/playerConstants';

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
// REDUCER
// =============================================================================

/**
 * Player reducer
 * Handles all player-related state changes
 */
export const playerReducer = (state, action) => {
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

// Export action types for convenience
export { PLAYER_ACTIONS };
