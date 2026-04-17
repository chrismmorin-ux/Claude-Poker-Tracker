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
  // Cross-view navigation state
  SET_AUTO_OPEN_NEW_SESSION: 'SET_AUTO_OPEN_NEW_SESSION',
  SET_REPLAY_HAND: 'SET_REPLAY_HAND',
  SET_SHOWDOWN_MODE: 'SET_SHOWDOWN_MODE',
  // PEO-1: fullscreen player-entry routes
  SET_EDITOR_CONTEXT: 'SET_EDITOR_CONTEXT',
  SET_PICKER_CONTEXT: 'SET_PICKER_CONTEXT',
};

import { SCREEN } from '../constants/uiConstants';

// Initial state
export const initialUiState = {
  currentView: SCREEN.TABLE,
  selectedPlayers: [],
  contextMenu: null, // { x, y, seat }
  isDraggingDealer: false,
  isSidebarCollapsed: true, // Sidebar starts collapsed
  // Card selector state (moved from cardReducer)
  showCardSelector: false,
  cardSelectorType: 'community', // 'community' or 'hole'
  highlightedBoardIndex: 0,
  // Showdown view state (moved from cardReducer)
  isShowdownViewOpen: false,
  highlightedSeat: 1,
  highlightedHoleSlot: 0,
  // Showdown mode ('quick' skips card assignment, 'full' is traditional)
  showdownMode: 'quick',
  // Cross-view navigation state
  // (PEO-4: pendingSeatForPlayerAssignment removed — generalized to editorContext/pickerContext.)
  autoOpenNewSession: false,
  replayHandId: null,
  replayHand: null,
  // PEO-1: fullscreen player-entry route contexts
  // editorContext: null | { mode: 'create' | 'edit', playerId?, seatContext?, prevScreen, nameSeed? }
  // pickerContext: null | { seat, batchMode, assignedSeats, prevScreen }
  editorContext: null,
  pickerContext: null,
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
  showdownMode: { type: 'string', enum: ['quick', 'full'] },
  // Cross-view navigation state
  autoOpenNewSession: { type: 'boolean' },
  replayHandId: { type: 'number', required: false }, // Can be null
  replayHand: { type: 'object', required: false }, // Can be null
  // PEO-1 contexts (nullable objects)
  editorContext: { type: 'object', required: false },
  pickerContext: { type: 'object', required: false },
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
        showdownMode: 'quick',
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

    // Cross-view navigation
    case UI_ACTIONS.SET_AUTO_OPEN_NEW_SESSION:
      return {
        ...state,
        autoOpenNewSession: action.payload,
      };

    case UI_ACTIONS.SET_SHOWDOWN_MODE:
      return {
        ...state,
        showdownMode: action.payload,
      };

    case UI_ACTIONS.SET_REPLAY_HAND:
      return {
        ...state,
        replayHandId: action.payload.handId ?? action.payload,
        replayHand: action.payload.hand ?? null,
      };

    // PEO-1: open/close fullscreen player-entry routes. Payload is either
    // the context object (open) or null (close). Caller is expected to
    // dispatch SET_SCREEN separately to route to the matching view.
    case UI_ACTIONS.SET_EDITOR_CONTEXT:
      return {
        ...state,
        editorContext: action.payload,
      };

    case UI_ACTIONS.SET_PICKER_CONTEXT:
      return {
        ...state,
        pickerContext: action.payload,
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
