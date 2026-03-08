/**
 * gameReducer.js - Game state management
 * Manages: currentStreet, dealerButtonSeat, mySeat, absentSeats, actionSequence
 * Note: seatActions and showdownActions are derived in GameContext from actionSequence
 */

import { createValidatedReducer, SCHEMA_RULES } from '../utils/reducerUtils';
import { LIMITS } from '../constants/gameConstants';
import { PRIMITIVE_ACTIONS, isPrimitiveAction, isShowdownAction } from '../constants/primitiveActions';
import { isValidSeat } from '../utils/validation';
import { logger, DEBUG } from '../utils/errorHandler';
import { createActionEntry, getNextOrder, isValidActionEntry, legacyToSequence } from '../utils/sequenceUtils';

// Action types
export const GAME_ACTIONS = {
  SET_STREET: 'SET_STREET',
  SET_DEALER: 'SET_DEALER',
  SET_MY_SEAT: 'SET_MY_SEAT',
  RECORD_SHOWDOWN_ACTION: 'RECORD_SHOWDOWN_ACTION',
  CLEAR_STREET_ACTIONS: 'CLEAR_STREET_ACTIONS',
  CLEAR_SEAT_ACTIONS: 'CLEAR_SEAT_ACTIONS',
  UNDO_LAST_ACTION: 'UNDO_LAST_ACTION',
  TOGGLE_ABSENT: 'TOGGLE_ABSENT',
  RESET_HAND: 'RESET_HAND',
  NEXT_HAND: 'NEXT_HAND',
  HYDRATE_STATE: 'HYDRATE_STATE',
  RECORD_PRIMITIVE_ACTION: 'RECORD_PRIMITIVE_ACTION',
  SET_POT_OVERRIDE: 'SET_POT_OVERRIDE',
};

// Initial state
export const initialGameState = {
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  absentSeats: [],
  actionSequence: [], // Ordered list of { seat, action, street, order, amount? } — single source of truth for all actions (betting + showdown)
  potOverride: null, // Manual pot correction (number or null)
};

// Use centralized LIMITS.NUM_SEATS instead of hardcoded value
const NUM_SEATS = LIMITS.NUM_SEATS;

// =============================================================================
// STATE SCHEMA (for validation)
// =============================================================================

/**
 * Schema for game state validation
 * Used by createValidatedReducer to catch state corruption
 */
export const GAME_STATE_SCHEMA = {
  currentStreet: SCHEMA_RULES.street,
  dealerButtonSeat: SCHEMA_RULES.seat,
  mySeat: SCHEMA_RULES.seat,
  absentSeats: SCHEMA_RULES.seatArray,
  actionSequence: SCHEMA_RULES.array,
  potOverride: SCHEMA_RULES.optionalNumber,
};

// =============================================================================
// RAW REDUCER
// =============================================================================

// Raw reducer (wrapped with validation below)
const rawGameReducer = (state, action) => {
  switch (action.type) {
    case GAME_ACTIONS.SET_STREET:
      return {
        ...state,
        currentStreet: action.payload,
      };

    case GAME_ACTIONS.SET_DEALER:
      return {
        ...state,
        dealerButtonSeat: action.payload,
      };

    case GAME_ACTIONS.SET_MY_SEAT:
      return {
        ...state,
        mySeat: action.payload,
      };

    case GAME_ACTIONS.RECORD_SHOWDOWN_ACTION: {
      const { seat, action: showdownAction } = action.payload;

      if (!isValidSeat(seat, NUM_SEATS)) {
        if (DEBUG) {
          logger.warn('gameReducer', `Invalid seat in RECORD_SHOWDOWN_ACTION: ${seat}`);
        }
        return state;
      }

      if (!isShowdownAction(showdownAction)) {
        if (DEBUG) {
          logger.warn('gameReducer', `Invalid showdown action: ${showdownAction}`);
        }
        return state;
      }

      // Append to actionSequence with street: 'showdown'
      const showdownEntry = createActionEntry({
        seat,
        action: showdownAction,
        street: 'showdown',
        order: getNextOrder(state.actionSequence),
      });

      return {
        ...state,
        actionSequence: [...state.actionSequence, showdownEntry],
      };
    }

    case GAME_ACTIONS.CLEAR_STREET_ACTIONS: {
      return {
        ...state,
        actionSequence: state.actionSequence.filter(
          entry => entry.street !== state.currentStreet
        ),
      };
    }

    case GAME_ACTIONS.CLEAR_SEAT_ACTIONS: {
      const seats = action.payload;
      return {
        ...state,
        actionSequence: state.actionSequence.filter(
          entry => !(entry.street === state.currentStreet && seats.includes(entry.seat))
        ),
      };
    }

    case GAME_ACTIONS.UNDO_LAST_ACTION: {
      const seat = action.payload;

      // Find the last entry for this seat+street in actionSequence
      let removeIndex = -1;
      for (let i = state.actionSequence.length - 1; i >= 0; i--) {
        if (state.actionSequence[i].seat === seat && state.actionSequence[i].street === state.currentStreet) {
          removeIndex = i;
          break;
        }
      }

      if (removeIndex === -1) {
        return state; // Nothing to undo
      }

      const newSequence = [...state.actionSequence];
      newSequence.splice(removeIndex, 1);

      return {
        ...state,
        actionSequence: newSequence,
      };
    }

    case GAME_ACTIONS.TOGGLE_ABSENT: {
      const seats = action.payload;
      let newAbsentSeats = [...state.absentSeats];

      seats.forEach(seat => {
        if (newAbsentSeats.includes(seat)) {
          newAbsentSeats = newAbsentSeats.filter(s => s !== seat);
        } else {
          newAbsentSeats.push(seat);
        }
      });

      return {
        ...state,
        absentSeats: newAbsentSeats,
      };
    }

    case GAME_ACTIONS.RESET_HAND:
      return {
        ...state,
        currentStreet: 'preflop',
        absentSeats: [],
        actionSequence: [],
        potOverride: null,
      };

    case GAME_ACTIONS.NEXT_HAND:
      return {
        ...state,
        currentStreet: 'preflop',
        dealerButtonSeat: (state.dealerButtonSeat % NUM_SEATS) + 1,
        actionSequence: [],
        potOverride: null,
        // Keep absentSeats as-is (don't clear)
      };

    // Hydrate game state from database (on app startup)
    // Merges with defaults to ensure all fields exist (handles old records lacking new fields)
    // Migrates legacy seatActions: extracts showdown data and converts betting to actionSequence
    case GAME_ACTIONS.HYDRATE_STATE: {
      const payload = action.payload;
      let merged = {
        ...initialGameState,
        ...state,
        ...payload,
      };

      // Migration: if payload has legacy seatActions but no showdownActions, extract showdown
      if (payload.seatActions && !payload.showdownActions) {
        const { showdown, ...bettingStreets } = payload.seatActions;
        merged.showdownActions = showdown || {};
        // If no actionSequence was saved, derive from legacy betting streets
        if (!payload.actionSequence || payload.actionSequence.length === 0) {
          merged.actionSequence = legacyToSequence(bettingStreets);
        }
      }

      // Migration: convert showdownActions object into actionSequence entries
      if (merged.showdownActions && Object.keys(merged.showdownActions).length > 0) {
        let order = getNextOrder(merged.actionSequence);
        const showdownEntries = [];
        for (const [seatStr, actions] of Object.entries(merged.showdownActions)) {
          const seat = Number(seatStr);
          const actionArray = Array.isArray(actions) ? actions : [actions];
          for (const act of actionArray) {
            if (isShowdownAction(act)) {
              showdownEntries.push(createActionEntry({
                seat,
                action: act,
                street: 'showdown',
                order: order++,
              }));
            }
          }
        }
        if (showdownEntries.length > 0) {
          merged.actionSequence = [...merged.actionSequence, ...showdownEntries];
        }
        merged.showdownActions = {};
      }

      // Remove legacy fields from state (now derived in GameContext)
      delete merged.seatActions;
      delete merged.showdownActions;

      return merged;
    }

    case GAME_ACTIONS.SET_POT_OVERRIDE:
      return {
        ...state,
        potOverride: action.payload,
      };

    case GAME_ACTIONS.RECORD_PRIMITIVE_ACTION: {
      const { seat, action: primitiveAction, amount } = action.payload;

      // Validate seat
      if (!isValidSeat(seat, NUM_SEATS)) {
        if (DEBUG) {
          logger.warn('gameReducer', `Invalid seat in RECORD_PRIMITIVE_ACTION: ${seat}`);
        }
        return state;
      }

      // Validate primitive action
      if (!isPrimitiveAction(primitiveAction)) {
        if (DEBUG) {
          logger.warn('gameReducer', `Invalid primitive action: ${primitiveAction}`);
        }
        return state;
      }

      // Create new action entry
      const newEntry = createActionEntry({
        seat,
        action: primitiveAction,
        street: state.currentStreet,
        order: getNextOrder(state.actionSequence),
        amount,
      });

      // Validate the entry
      if (!isValidActionEntry(newEntry)) {
        if (DEBUG) {
          logger.warn('gameReducer', `Invalid action entry created: ${JSON.stringify(newEntry)}`);
        }
        return state;
      }

      // Remove seat from absent if they're taking action
      const newAbsentSeats = state.absentSeats.filter(s => s !== seat);

      return {
        ...state,
        actionSequence: [...state.actionSequence, newEntry],
        absentSeats: newAbsentSeats,
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
 * Game reducer wrapped with validation
 * - Logs all actions in debug mode
 * - Validates state after each action
 * - Returns previous state on error (prevents corruption)
 */
export const gameReducer = createValidatedReducer(
  rawGameReducer,
  GAME_STATE_SCHEMA,
  'gameReducer'
);
