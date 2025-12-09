/**
 * uiReducer.js - UI state management
 * Manages: currentView, selectedPlayers, contextMenu, isDraggingDealer,
 *          showCardSelector, isShowdownViewOpen, and related highlighting state
 */

import { createValidatedReducer } from '../utils/reducerUtils';
import { LIMITS } from '../constants/gameConstants';

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
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  // Card selector actions (moved from cardReducer)
  OPEN_CARD_SELECTOR: 'OPEN_CARD_SELECTOR',
  CLOSE_CARD_SELECTOR: 'CLOSE_CARD_SELECTOR',
  SET_CARD_SELECTOR_TYPE: 'SET_CARD_SELECTOR_TYPE',
  SET_HIGHLIGHTED_CARD_INDEX: 'SET_HIGHLIGHTED_CARD_INDEX',
  // Showdown view actions (moved from cardReducer)
  OPEN_SHOWDOWN_VIEW: 'OPEN_SHOWDOWN_VIEW',
  CLOSE_SHOWDOWN_VIEW: 'CLOSE_SHOWDOWN_VIEW',
  SET_HIGHLIGHTED_SEAT: 'SET_HIGHLIGHTED_SEAT',
  SET_HIGHLIGHTED_HOLE_SLOT: 'SET_HIGHLIGHTED_HOLE_SLOT',
  ADVANCE_SHOWDOWN_HIGHLIGHT: 'ADVANCE_SHOWDOWN_HIGHLIGHT',
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
  isSidebarCollapsed: false, // Sidebar starts expanded
  // Card selector state (moved from cardReducer)
  showCardSelector: false,
  cardSelectorType: 'community', // 'community' or 'hole'
  highlightedBoardIndex: 0,
  // Showdown view state (moved from cardReducer)
  isShowdownViewOpen: false,
  highlightedSeat: 1,
  highlightedHoleSlot: 0,
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
  isSidebarCollapsed: { type: 'boolean' },
  // Card selector state
  showCardSelector: { type: 'boolean' },
  cardSelectorType: { type: 'string', enum: ['community', 'hole'] },
  highlightedBoardIndex: { type: 'number', required: false }, // Can be null
  // Showdown view state
  isShowdownViewOpen: { type: 'boolean' },
  highlightedSeat: { type: 'number', required: false }, // Can be null
  highlightedHoleSlot: { type: 'number', required: false }, // Can be null
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

    case UI_ACTIONS.TOGGLE_SIDEBAR:
      return {
        ...state,
        isSidebarCollapsed: !state.isSidebarCollapsed,
      };

    // Card selector actions
    case UI_ACTIONS.OPEN_CARD_SELECTOR: {
      const { type, index } = action.payload;
      return {
        ...state,
        showCardSelector: true,
        cardSelectorType: type,
        highlightedBoardIndex: index,
      };
    }

    case UI_ACTIONS.CLOSE_CARD_SELECTOR:
      return {
        ...state,
        showCardSelector: false,
        highlightedBoardIndex: null,
      };

    case UI_ACTIONS.SET_CARD_SELECTOR_TYPE:
      return {
        ...state,
        cardSelectorType: action.payload,
      };

    case UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX:
      return {
        ...state,
        highlightedBoardIndex: action.payload,
      };

    // Showdown view actions
    case UI_ACTIONS.OPEN_SHOWDOWN_VIEW:
      return {
        ...state,
        isShowdownViewOpen: true,
        highlightedSeat: 1,
        highlightedHoleSlot: 0,
      };

    case UI_ACTIONS.CLOSE_SHOWDOWN_VIEW:
      return {
        ...state,
        isShowdownViewOpen: false,
        highlightedSeat: null,
        highlightedHoleSlot: null,
      };

    case UI_ACTIONS.SET_HIGHLIGHTED_SEAT:
      return {
        ...state,
        highlightedSeat: action.payload,
      };

    case UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT:
      return {
        ...state,
        highlightedHoleSlot: action.payload,
      };

    case UI_ACTIONS.ADVANCE_SHOWDOWN_HIGHLIGHT: {
      // Find next empty card slot using allPlayerCards from payload
      const { allPlayerCards } = action.payload;
      const { highlightedSeat, highlightedHoleSlot } = state;
      let newSeat = highlightedSeat;
      let newSlot = highlightedHoleSlot;

      // Try next slot in current seat
      if (highlightedHoleSlot === 0) {
        newSlot = 1;
      } else {
        // Move to next seat
        newSeat = highlightedSeat < LIMITS.NUM_SEATS ? highlightedSeat + 1 : 1;
        newSlot = 0;
      }

      // Find next empty slot (loop through all seats/slots)
      let foundEmpty = false;
      let attempts = 0;
      const maxAttempts = LIMITS.MAX_SHOWDOWN_SLOTS;

      while (!foundEmpty && attempts < maxAttempts) {
        if (!allPlayerCards[newSeat][newSlot]) {
          foundEmpty = true;
        } else {
          // Move to next slot
          if (newSlot === 0) {
            newSlot = 1;
          } else {
            newSeat = newSeat < LIMITS.NUM_SEATS ? newSeat + 1 : 1;
            newSlot = 0;
          }
        }
        attempts++;
      }

      return {
        ...state,
        highlightedSeat: newSeat,
        highlightedHoleSlot: newSlot,
      };
    }

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
