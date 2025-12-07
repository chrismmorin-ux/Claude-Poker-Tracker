/**
 * sessionReducer.js - Session state management
 *
 * Manages session state including current active session and all sessions list.
 * Follows the v108 reducer pattern used by gameReducer, uiReducer, and cardReducer.
 */

import { SESSION_ACTIONS } from '../constants/sessionConstants';

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialSessionState = {
  // Current active session data
  currentSession: {
    sessionId: null,
    startTime: null,
    endTime: null,
    isActive: false,
    venue: null,
    gameType: null,
    buyIn: null,
    rebuyTransactions: [],  // Changed from rebuy: 0
    cashOut: null,          // Cash out amount when session ends
    reUp: 0,
    goal: null,
    notes: null,
    handCount: 0
  },

  // All sessions (cached for performance)
  allSessions: [],

  // Loading state
  isLoading: false
};

// =============================================================================
// REDUCER
// =============================================================================

/**
 * Session reducer
 * Handles all session-related state changes
 */
export const sessionReducer = (state, action) => {
  switch (action.type) {
    // Start a new session
    case SESSION_ACTIONS.START_SESSION:
      return {
        ...state,
        currentSession: {
          sessionId: action.payload.sessionId,
          startTime: action.payload.startTime,
          endTime: null,
          isActive: true,
          venue: action.payload.venue || 'Online',
          gameType: action.payload.gameType || '1/2',
          buyIn: action.payload.buyIn || null,
          rebuyTransactions: action.payload.rebuyTransactions || [],
          cashOut: null,  // Always null when starting
          reUp: action.payload.reUp || 0,
          goal: action.payload.goal || null,
          notes: action.payload.notes || null,
          handCount: 0
        }
      };

    // End the current session
    case SESSION_ACTIONS.END_SESSION:
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          endTime: action.payload.endTime,
          cashOut: action.payload.cashOut || null,
          isActive: false
        }
      };

    // Update a specific field in the current session
    case SESSION_ACTIONS.UPDATE_SESSION_FIELD:
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          [action.payload.field]: action.payload.value
        }
      };

    // Add a rebuy transaction to the current session
    case SESSION_ACTIONS.ADD_REBUY:
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          rebuyTransactions: [
            ...state.currentSession.rebuyTransactions,
            {
              timestamp: action.payload.timestamp,
              amount: action.payload.amount
            }
          ]
        }
      };

    // Load all sessions from database
    case SESSION_ACTIONS.LOAD_SESSIONS:
      return {
        ...state,
        allSessions: action.payload.sessions
      };

    // Set which session is active (used when loading existing session)
    case SESSION_ACTIONS.SET_ACTIVE_SESSION:
      return {
        ...state,
        currentSession: action.payload.session
      };

    // Hydrate session state from database (on app startup)
    case SESSION_ACTIONS.HYDRATE_SESSION:
      return {
        ...state,
        currentSession: action.payload.session || initialSessionState.currentSession
      };

    // Increment hand count (called after each hand is saved)
    case SESSION_ACTIONS.INCREMENT_HAND_COUNT:
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          handCount: state.currentSession.handCount + 1
        }
      };

    // Set loading state
    case SESSION_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading
      };

    default:
      return state;
  }
};

// Export action types for convenience
export { SESSION_ACTIONS };
