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
  // Unified PlayerFinder context.
  SET_FINDER_CONTEXT: 'SET_FINDER_CONTEXT',
  // SCF G5 child 3 (WS-147 / SPR-032, 2026-05-03) — lesson detail nav state.
  SET_LESSON_DETAIL: 'SET_LESSON_DETAIL',
  // PIO G5 child C (WS-162 / SPR-035, 2026-05-04) — player profile nav state.
  SET_PLAYER_PROFILE: 'SET_PLAYER_PROFILE',
  // EAL Stream D / WS-169 / SPR-066 (2026-05-09) — Calibration Dashboard nav state.
  SET_CALIBRATION_DASHBOARD: 'SET_CALIBRATION_DASHBOARD',
};

import { SCREEN } from '../constants/uiConstants';

// Initial state
export const initialUiState = {
  // Homebase is the default app-entry screen (2026-06-19). Was SCREEN.TABLE.
  // See docs/design/surfaces/homebase-view.md.
  currentView: SCREEN.HOMEBASE,
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
  // Showdown mode ('quick' skips card assignment, 'full' is traditional).
  // Owner-revised 2026-05-05: default to 'full' so showdown opens with the
  // card-entry grid + action history visible. Quick mode hides the data-
  // capture surface ("nowhere to enter the showdown cards") and is now an
  // opt-in via the header toggle.
  showdownMode: 'full',
  // Cross-view navigation state
  autoOpenNewSession: false,
  replayHandId: null,
  replayHand: null,
  // Unified PlayerFinder context.
  // finderContext: null | { mode: 'find' | 'edit' | 'create', seat?, playerId?,
  //   swapMode?, fieldSeeds?, prevScreen, nameSeed? }
  finderContext: null,
  // SCF G5 child 3 (WS-147 / SPR-032, 2026-05-03) — lesson detail nav state.
  // lessonConceptId: which lesson the LessonDetailView should show.
  // lessonReturnScreen: where back-nav should return to (typically HAND_REPLAY).
  lessonConceptId: null,
  lessonReturnScreen: null,
  // PIO G5 child C (WS-162 / SPR-035, 2026-05-04) — player profile nav state.
  // profilePlayerId: which player the PlayerProfileView should show.
  // profileReturnScreen: where back-nav should return to (typically PLAYERS).
  profilePlayerId: null,
  profileReturnScreen: null,
  // EAL Stream D / WS-169 / SPR-066 (2026-05-09) — Calibration Dashboard nav state.
  // dashboardAnchorDeepLink: anchor id to auto-scroll/expand on entry; null
  //   when entry is via primary nav (no deep-link).
  // dashboardReturnScreen: where back-nav should return to (typically
  //   ANCHOR_LIBRARY when entered via deep-link, else TABLE).
  dashboardAnchorDeepLink: null,
  dashboardReturnScreen: null,
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
  // Unified finder context (nullable object)
  finderContext: { type: 'object', required: false },
  // SCF G5 child 3 (WS-147)
  lessonConceptId: { type: 'string', required: false },
  lessonReturnScreen: { type: 'string', required: false },
  // PIO G5 child C (WS-162)
  // Note: PIO G4 audit specified string playerIds for cross-venue stability,
  // but the players store has used autoIncrement integer keys since v5. Schema
  // declared as 'number' to match the implementation. A future PIO v2 pass can
  // migrate to stable string IDs if cross-venue identity is added.
  profilePlayerId: { type: 'number', required: false },
  profileReturnScreen: { type: 'string', required: false },
  // EAL Stream D / WS-169 / SPR-066
  dashboardAnchorDeepLink: { type: 'string', required: false }, // null when no deep-link
  dashboardReturnScreen: { type: 'string', required: false },
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
        showdownMode: 'full', // owner: default to data-capture mode
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

    case UI_ACTIONS.SET_LESSON_DETAIL:
      return {
        ...state,
        lessonConceptId: action.payload?.lessonConceptId ?? null,
        lessonReturnScreen: action.payload?.lessonReturnScreen ?? null,
      };

    case UI_ACTIONS.SET_PLAYER_PROFILE:
      return {
        ...state,
        profilePlayerId: action.payload?.profilePlayerId ?? null,
        profileReturnScreen: action.payload?.profileReturnScreen ?? null,
      };

    case UI_ACTIONS.SET_CALIBRATION_DASHBOARD:
      return {
        ...state,
        dashboardAnchorDeepLink: action.payload?.dashboardAnchorDeepLink ?? null,
        dashboardReturnScreen: action.payload?.dashboardReturnScreen ?? null,
      };

    // Open/close the unified PlayerFinder. Payload is either the finder
    // context object (open) or null (close). Caller dispatches SET_SCREEN
    // separately to route into / out of PlayerFinderView.
    case UI_ACTIONS.SET_FINDER_CONTEXT:
      return {
        ...state,
        finderContext: action.payload,
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
