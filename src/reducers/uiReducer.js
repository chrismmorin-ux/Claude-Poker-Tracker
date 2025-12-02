/**
 * uiReducer.js - UI state management
 * Manages: currentView, selectedPlayers, contextMenu, isDraggingDealer
 */

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

// Reducer
export const uiReducer = (state, action) => {
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
