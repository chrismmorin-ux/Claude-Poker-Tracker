/**
 * cardReducer.js - Card state management
 * Manages: communityCards, holeCards, holeCardsVisible, showCardSelector,
 *          cardSelectorType, highlightedBoardIndex, isShowdownViewOpen,
 *          allPlayerCards, highlightedSeat, highlightedHoleSlot
 */

import { createValidatedReducer } from '../utils/reducerUtils';
import { LIMITS } from '../constants/gameConstants';

// Action types
export const CARD_ACTIONS = {
  SET_COMMUNITY_CARD: 'SET_COMMUNITY_CARD',
  SET_HOLE_CARD: 'SET_HOLE_CARD',
  CLEAR_COMMUNITY_CARDS: 'CLEAR_COMMUNITY_CARDS',
  CLEAR_HOLE_CARDS: 'CLEAR_HOLE_CARDS',
  TOGGLE_HOLE_VISIBILITY: 'TOGGLE_HOLE_VISIBILITY',
  SET_HOLE_VISIBILITY: 'SET_HOLE_VISIBILITY',
  OPEN_CARD_SELECTOR: 'OPEN_CARD_SELECTOR',
  CLOSE_CARD_SELECTOR: 'CLOSE_CARD_SELECTOR',
  SET_CARD_SELECTOR_TYPE: 'SET_CARD_SELECTOR_TYPE',
  SET_HIGHLIGHTED_CARD_INDEX: 'SET_HIGHLIGHTED_CARD_INDEX',
  OPEN_SHOWDOWN_VIEW: 'OPEN_SHOWDOWN_VIEW',
  CLOSE_SHOWDOWN_VIEW: 'CLOSE_SHOWDOWN_VIEW',
  SET_PLAYER_CARD: 'SET_PLAYER_CARD',
  SET_HIGHLIGHTED_SEAT: 'SET_HIGHLIGHTED_SEAT',
  SET_HIGHLIGHTED_HOLE_SLOT: 'SET_HIGHLIGHTED_HOLE_SLOT',
  ADVANCE_SHOWDOWN_HIGHLIGHT: 'ADVANCE_SHOWDOWN_HIGHLIGHT',
  RESET_CARDS: 'RESET_CARDS',
  SELECT_CARD_FOR_SELECTOR: 'SELECT_CARD_FOR_SELECTOR',
  SELECT_CARD_FOR_SHOWDOWN: 'SELECT_CARD_FOR_SHOWDOWN',
  REMOVE_CARD_FROM_ALL: 'REMOVE_CARD_FROM_ALL',
  HYDRATE_STATE: 'HYDRATE_STATE',
};

// Helper function to create empty player cards
const createEmptyPlayerCards = () => ({
  1: ['', ''],
  2: ['', ''],
  3: ['', ''],
  4: ['', ''],
  5: ['', ''],
  6: ['', ''],
  7: ['', ''],
  8: ['', ''],
  9: ['', '']
});

// Initial state
export const initialCardState = {
  communityCards: ['', '', '', '', ''],
  holeCards: ['', ''],
  holeCardsVisible: true,
  showCardSelector: false,
  cardSelectorType: 'community', // 'community' or 'hole'
  highlightedBoardIndex: 0,
  isShowdownViewOpen: false,
  allPlayerCards: createEmptyPlayerCards(),
  highlightedSeat: 1,
  highlightedHoleSlot: 0,
};

// =============================================================================
// STATE SCHEMA (for validation)
// =============================================================================

/**
 * Schema for card state validation
 * Used by createValidatedReducer to catch state corruption
 */
export const CARD_STATE_SCHEMA = {
  communityCards: { type: 'array', length: 5 },
  holeCards: { type: 'array', length: 2 },
  holeCardsVisible: { type: 'boolean' },
  showCardSelector: { type: 'boolean' },
  cardSelectorType: { type: 'string', enum: ['community', 'hole'] },
  highlightedBoardIndex: { type: 'number', required: false }, // Can be null
  isShowdownViewOpen: { type: 'boolean' },
  allPlayerCards: { type: 'object' },
  highlightedSeat: { type: 'number', required: false }, // Can be null
  highlightedHoleSlot: { type: 'number', required: false }, // Can be null
};

// =============================================================================
// RAW REDUCER
// =============================================================================

// Raw reducer (wrapped with validation below)
const rawCardReducer = (state, action) => {
  switch (action.type) {
    case CARD_ACTIONS.SET_COMMUNITY_CARD: {
      const { index, card } = action.payload;
      const newCommunityCards = [...state.communityCards];
      newCommunityCards[index] = card;
      return {
        ...state,
        communityCards: newCommunityCards,
      };
    }

    case CARD_ACTIONS.SET_HOLE_CARD: {
      const { index, card } = action.payload;
      const newHoleCards = [...state.holeCards];
      newHoleCards[index] = card;
      return {
        ...state,
        holeCards: newHoleCards,
      };
    }

    case CARD_ACTIONS.CLEAR_COMMUNITY_CARDS:
      return {
        ...state,
        communityCards: ['', '', '', '', ''],
      };

    case CARD_ACTIONS.CLEAR_HOLE_CARDS:
      return {
        ...state,
        holeCards: ['', ''],
      };

    case CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY:
      return {
        ...state,
        holeCardsVisible: !state.holeCardsVisible,
      };

    case CARD_ACTIONS.SET_HOLE_VISIBILITY:
      return {
        ...state,
        holeCardsVisible: action.payload,
      };

    case CARD_ACTIONS.OPEN_CARD_SELECTOR: {
      const { type, index } = action.payload;
      return {
        ...state,
        showCardSelector: true,
        cardSelectorType: type,
        highlightedBoardIndex: index,
      };
    }

    case CARD_ACTIONS.CLOSE_CARD_SELECTOR:
      return {
        ...state,
        showCardSelector: false,
        highlightedBoardIndex: null,
      };

    case CARD_ACTIONS.SET_CARD_SELECTOR_TYPE:
      return {
        ...state,
        cardSelectorType: action.payload,
      };

    case CARD_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX:
      return {
        ...state,
        highlightedBoardIndex: action.payload,
      };

    case CARD_ACTIONS.OPEN_SHOWDOWN_VIEW:
      return {
        ...state,
        isShowdownViewOpen: true,
        highlightedSeat: 1,
        highlightedHoleSlot: 0,
      };

    case CARD_ACTIONS.CLOSE_SHOWDOWN_VIEW:
      return {
        ...state,
        isShowdownViewOpen: false,
        highlightedSeat: null,
        highlightedHoleSlot: null,
      };

    case CARD_ACTIONS.SET_PLAYER_CARD: {
      const { seat, slotIndex, card } = action.payload;
      const newAllPlayerCards = { ...state.allPlayerCards };
      newAllPlayerCards[seat] = [...newAllPlayerCards[seat]];
      newAllPlayerCards[seat][slotIndex] = card;
      return {
        ...state,
        allPlayerCards: newAllPlayerCards,
      };
    }

    case CARD_ACTIONS.SET_HIGHLIGHTED_SEAT:
      return {
        ...state,
        highlightedSeat: action.payload,
      };

    case CARD_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT:
      return {
        ...state,
        highlightedHoleSlot: action.payload,
      };

    case CARD_ACTIONS.ADVANCE_SHOWDOWN_HIGHLIGHT: {
      // Find next empty card slot
      const { allPlayerCards, highlightedSeat, highlightedHoleSlot } = state;
      let newSeat = highlightedSeat;
      let newSlot = highlightedHoleSlot;

      // Try next slot in current seat
      if (highlightedHoleSlot === 0) {
        newSlot = 1;
      } else {
        // Move to next seat (using LIMITS.NUM_SEATS instead of hardcoded 9)
        newSeat = highlightedSeat < LIMITS.NUM_SEATS ? highlightedSeat + 1 : 1;
        newSlot = 0;
      }

      // Find next empty slot (loop through all seats/slots)
      let foundEmpty = false;
      let attempts = 0;
      // Use LIMITS.MAX_SHOWDOWN_SLOTS instead of hardcoded 18
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

    case CARD_ACTIONS.RESET_CARDS:
      return {
        ...state,
        communityCards: ['', '', '', '', ''],
        holeCards: ['', ''],
        allPlayerCards: createEmptyPlayerCards(),
      };

    case CARD_ACTIONS.HYDRATE_STATE:
      return {
        ...state,
        ...action.payload  // Merge loaded card state (persistent fields only)
      };

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

/**
 * Card reducer wrapped with validation
 * - Logs all actions in debug mode
 * - Validates state after each action
 * - Returns previous state on error (prevents corruption)
 */
export const cardReducer = createValidatedReducer(
  rawCardReducer,
  CARD_STATE_SCHEMA,
  'cardReducer'
);
