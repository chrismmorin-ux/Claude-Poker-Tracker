/**
 * uiReducer.js - UI state management
 * Manages: currentView, selectedPlayers, contextMenu, isDraggingDealer
 */

import { createValidatedReducer } from '../utils/reducerUtils';

// Action types
export const UI_ACTIONS = {
  SET_SCREEN: 'SET_SCREEN',
  TOGGLE_PLAYER_SELECTION: 'TOGGLE_PLAYER_SELECTION',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  SET_SELECTION: 'SET_SELECTION',
  SET_CONTEXT_MENU: 'SET_CONTEXT_MENU',
  CLOSE_CONTEXT_MENU: 'CLOSE_CONTEXT_MENU',
  START_DRAGGING_DEALER: 'START_DRAGGING_DEALER',
  STOP_DRAGGING_DEALER: 'STOP_DRAGGING_DEALER',
};

// Screen constants (imported from main component)
export const SCREEN = {
  TABLE: 'table',
  STATS: 'stats',
};

// Initial state
export const initialUiState = {
  currentView: SCREEN.TABLE,
  selectedPlayers: [],
  contextMenu: null, // { x, y, seat }
  isDraggingDealer: false,
};

// =============================================================================
// STATE SCHEMA (for validation)
// =============================================================================

/**
 * Schema for UI state validation
 * Used by createValidatedReducer to catch state corruption
 */
export const UI_STATE_SCHEMA = {
  currentView: { type: 'string' }, // Can be any screen type
  selectedPlayers: { type: 'array', items: 'number' },
  contextMenu: { type: 'object', required: false }, // Can be null
  isDraggingDealer: { type: 'boolean' },
};

// =============================================================================
// RAW REDUCER
// =============================================================================

// Raw reducer (wrapped with validation below)
const rawUiReducer = (state, action) => {
  switch (action.type) {
    case UI_ACTIONS.SET_SCREEN:
      return {
        ...state,
        currentView: action.payload,
      };

    case UI_ACTIONS.TOGGLE_PLAYER_SELECTION: {
      const seat = action.payload;
      const isSelected = state.selectedPlayers.includes(seat);

      return {
        ...state,
        selectedPlayers: isSelected
          ? state.selectedPlayers.filter(s => s !== seat)
          : [...state.selectedPlayers, seat],
      };
    }

    case UI_ACTIONS.CLEAR_SELECTION:
      return {
        ...state,
        selectedPlayers: [],
      };

    case UI_ACTIONS.SET_SELECTION:
      return {
        ...state,
        selectedPlayers: action.payload,
      };

    case UI_ACTIONS.SET_CONTEXT_MENU:
      return {
        ...state,
        contextMenu: action.payload,
      };

    case UI_ACTIONS.CLOSE_CONTEXT_MENU:
      return {
        ...state,
        contextMenu: null,
      };

    case UI_ACTIONS.START_DRAGGING_DEALER:
      return {
        ...state,
        isDraggingDealer: true,
      };

    case UI_ACTIONS.STOP_DRAGGING_DEALER:
      return {
        ...state,
        isDraggingDealer: false,
      };

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

/**
 * UI reducer wrapped with validation
 * - Logs all actions in debug mode
 * - Validates state after each action
 * - Returns previous state on error (prevents corruption)
 */
export const uiReducer = createValidatedReducer(
  rawUiReducer,
  UI_STATE_SCHEMA,
  'uiReducer'
);
