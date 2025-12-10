/**
 * cardReducer.js - Card state management
 * Manages: communityCards, holeCards, holeCardsVisible, allPlayerCards
 *
 * NOTE: View-related state (showCardSelector, isShowdownViewOpen, etc.)
 *       has been moved to uiReducer as of v114 state consolidation.
 */

import { createValidatedReducer } from '../utils/reducerUtils';
import { isCardInUse } from '../utils/validation';
import { logger, DEBUG } from '../utils/errorHandler';

// Action types (card data only)
export const CARD_ACTIONS = {
  SET_COMMUNITY_CARD: 'SET_COMMUNITY_CARD',
  SET_HOLE_CARD: 'SET_HOLE_CARD',
  CLEAR_COMMUNITY_CARDS: 'CLEAR_COMMUNITY_CARDS',
  CLEAR_HOLE_CARDS: 'CLEAR_HOLE_CARDS',
  TOGGLE_HOLE_VISIBILITY: 'TOGGLE_HOLE_VISIBILITY',
  SET_HOLE_VISIBILITY: 'SET_HOLE_VISIBILITY',
  SET_PLAYER_CARD: 'SET_PLAYER_CARD',
  RESET_CARDS: 'RESET_CARDS',
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

// Initial state (card data only - view state moved to uiReducer)
export const initialCardState = {
  communityCards: ['', '', '', '', ''],
  holeCards: ['', ''],
  holeCardsVisible: true,
  allPlayerCards: createEmptyPlayerCards(),
};

// =============================================================================
// STATE SCHEMA (for validation)
// =============================================================================

/**
 * Schema for card state validation
 * Used by createValidatedReducer to catch state corruption
 * NOTE: View state fields moved to uiReducer as of v114
 */
export const CARD_STATE_SCHEMA = {
  communityCards: { type: 'array', length: 5 },
  holeCards: { type: 'array', length: 2 },
  holeCardsVisible: { type: 'boolean' },
  allPlayerCards: { type: 'object' },
};

// =============================================================================
// RAW REDUCER
// =============================================================================

// Raw reducer (wrapped with validation below)
const rawCardReducer = (state, action) => {
  switch (action.type) {
    case CARD_ACTIONS.SET_COMMUNITY_CARD: {
      const { index, card } = action.payload;

      // Check for duplicate cards (skip empty strings - clearing a slot)
      if (card && card !== '') {
        const inUse = isCardInUse(
          card,
          state.communityCards,
          state.holeCards,
          state.allPlayerCards,
          null,  // No seat exclusion (this is community card)
          null   // No slot exclusion
        );

        // Allow if card is already in this exact slot (same card re-selected)
        const alreadyInSlot = state.communityCards[index] === card;

        if (inUse && !alreadyInSlot) {
          if (DEBUG) {
            logger.warn('cardReducer', `Duplicate card rejected: ${card} at community index ${index}`);
          }
          return state; // Reject duplicate - return unchanged state
        }
      }

      const newCommunityCards = [...state.communityCards];
      newCommunityCards[index] = card;
      return {
        ...state,
        communityCards: newCommunityCards,
      };
    }

    case CARD_ACTIONS.SET_HOLE_CARD: {
      const { index, card } = action.payload;

      // Check for duplicate cards (skip empty strings - clearing a slot)
      if (card && card !== '') {
        const inUse = isCardInUse(
          card,
          state.communityCards,
          state.holeCards,
          state.allPlayerCards,
          null,  // No seat exclusion (this is hole card)
          null   // No slot exclusion
        );

        // Allow if card is already in this exact slot (same card re-selected)
        const alreadyInSlot = state.holeCards[index] === card;

        if (inUse && !alreadyInSlot) {
          if (DEBUG) {
            logger.warn('cardReducer', `Duplicate card rejected: ${card} at hole index ${index}`);
          }
          return state; // Reject duplicate - return unchanged state
        }
      }

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

    case CARD_ACTIONS.SET_PLAYER_CARD: {
      const { seat, slotIndex, card } = action.payload;

      // Check for duplicate cards (skip empty strings - clearing a slot)
      if (card && card !== '') {
        const inUse = isCardInUse(
          card,
          state.communityCards,
          state.holeCards,
          state.allPlayerCards,
          seat,      // Exclude current seat
          slotIndex  // Exclude current slot
        );

        if (inUse) {
          if (DEBUG) {
            logger.warn('cardReducer', `Duplicate card rejected: ${card} at seat ${seat}, slot ${slotIndex}`);
          }
          return state; // Reject duplicate - return unchanged state
        }
      }

      const newAllPlayerCards = { ...state.allPlayerCards };
      newAllPlayerCards[seat] = [...newAllPlayerCards[seat]];
      newAllPlayerCards[seat][slotIndex] = card;
      return {
        ...state,
        allPlayerCards: newAllPlayerCards,
      };
    }

    case CARD_ACTIONS.RESET_CARDS:
      return {
        ...state,
        communityCards: ['', '', '', '', ''],
        holeCards: ['', ''],
        allPlayerCards: createEmptyPlayerCards(),
      };

    // Hydrate card state from database (on app startup)
    // Merges with defaults to ensure all fields exist (handles old records lacking new fields)
    case CARD_ACTIONS.HYDRATE_STATE:
      return {
        ...initialCardState,  // Defaults first
        ...state,             // Current state
        ...action.payload     // Loaded data overwrites
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
