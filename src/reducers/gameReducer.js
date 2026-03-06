/**
 * gameReducer.js - Game state management
 * Manages: currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats, actionSequence
 */

import { createValidatedReducer, SCHEMA_RULES } from '../utils/reducerUtils';
import { LIMITS, ACTIONS } from '../constants/gameConstants';
import { PRIMITIVE_ACTIONS, isPrimitiveAction } from '../constants/primitiveActions';
import { isValidSeat, isValidAction } from '../utils/validation';
import { logger, DEBUG } from '../utils/errorHandler';
import { createActionEntry, getNextOrder, isValidActionEntry } from '../types/actionTypes';

// Action types
export const GAME_ACTIONS = {
  SET_STREET: 'SET_STREET',
  SET_DEALER: 'SET_DEALER',
  SET_MY_SEAT: 'SET_MY_SEAT',
  RECORD_ACTION: 'RECORD_ACTION',
  CLEAR_STREET_ACTIONS: 'CLEAR_STREET_ACTIONS',
  CLEAR_SEAT_ACTIONS: 'CLEAR_SEAT_ACTIONS',
  UNDO_LAST_ACTION: 'UNDO_LAST_ACTION',
  TOGGLE_ABSENT: 'TOGGLE_ABSENT',
  RESET_HAND: 'RESET_HAND',
  NEXT_HAND: 'NEXT_HAND',
  HYDRATE_STATE: 'HYDRATE_STATE',
  RECORD_PRIMITIVE_ACTION: 'RECORD_PRIMITIVE_ACTION',
};

// Initial state
export const initialGameState = {
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  seatActions: {}, // Legacy: { street: { seat: [actions] } }
  absentSeats: [],
  actionSequence: [], // New: ordered list of { seat, action, street, order }
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
  seatActions: SCHEMA_RULES.object,
  absentSeats: SCHEMA_RULES.seatArray,
  actionSequence: SCHEMA_RULES.array,
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

    case GAME_ACTIONS.RECORD_ACTION: {
      const { seats, action: playerAction } = action.payload;

      // P1 Fix: Validate action type
      if (!isValidAction(playerAction, ACTIONS)) {
        if (DEBUG) {
          logger.warn('gameReducer', `Invalid action rejected: ${playerAction}`);
        }
        return state; // Reject invalid action
      }

      // P1 Fix: Validate and filter seat numbers
      const validSeats = seats.filter(seat => isValidSeat(seat, NUM_SEATS));
      if (validSeats.length === 0) {
        if (DEBUG) {
          logger.warn('gameReducer', `No valid seats in RECORD_ACTION: ${seats}`);
        }
        return state; // Reject if no valid seats
      }

      if (validSeats.length !== seats.length && DEBUG) {
        logger.warn('gameReducer', `Invalid seats filtered out: ${seats.filter(s => !validSeats.includes(s))}`);
      }

      const newSeatActions = { ...state.seatActions };

      // Structure: seatActions[street][seat] = [action1, action2, ...]
      if (!newSeatActions[state.currentStreet]) {
        newSeatActions[state.currentStreet] = {};
      }

      validSeats.forEach(seat => {
        // Get current actions for this seat (array)
        const currentActions = newSeatActions[state.currentStreet][seat] || [];

        // Append new action to array
        newSeatActions[state.currentStreet] = {
          ...newSeatActions[state.currentStreet],
          [seat]: [...currentActions, playerAction]
        };
      });

      // Remove seats from absent if they're taking action
      const newAbsentSeats = state.absentSeats.filter(s => !validSeats.includes(s));

      // Also populate actionSequence for each seat
      let newSequence = [...state.actionSequence];
      validSeats.forEach(seat => {
        const entry = createActionEntry({
          seat,
          action: playerAction,
          street: state.currentStreet,
          order: getNextOrder(newSequence),
        });
        newSequence.push(entry);
      });

      return {
        ...state,
        seatActions: newSeatActions,
        absentSeats: newAbsentSeats,
        actionSequence: newSequence,
      };
    }

    case GAME_ACTIONS.CLEAR_STREET_ACTIONS: {
      const newSeatActions = { ...state.seatActions };
      delete newSeatActions[state.currentStreet];

      return {
        ...state,
        seatActions: newSeatActions,
        actionSequence: state.actionSequence.filter(
          entry => entry.street !== state.currentStreet
        ),
      };
    }

    case GAME_ACTIONS.CLEAR_SEAT_ACTIONS: {
      const seats = action.payload;
      const newSeatActions = { ...state.seatActions };

      if (newSeatActions[state.currentStreet]) {
        const updatedStreet = { ...newSeatActions[state.currentStreet] };
        seats.forEach(seat => {
          delete updatedStreet[seat];
        });
        newSeatActions[state.currentStreet] = updatedStreet;
      }

      return {
        ...state,
        seatActions: newSeatActions,
        actionSequence: state.actionSequence.filter(
          entry => !(entry.street === state.currentStreet && seats.includes(entry.seat))
        ),
      };
    }

    case GAME_ACTIONS.UNDO_LAST_ACTION: {
      const seat = action.payload;
      const currentActions = [...(state.seatActions[state.currentStreet]?.[seat] || [])];

      if (currentActions.length === 0) {
        return state; // Nothing to undo
      }

      currentActions.pop(); // Remove last action
      const newSeatActions = { ...state.seatActions };

      if (currentActions.length === 0) {
        // Remove seat entry if no actions left
        const updatedStreet = { ...newSeatActions[state.currentStreet] };
        delete updatedStreet[seat];
        newSeatActions[state.currentStreet] = updatedStreet;
      } else {
        // Update with remaining actions
        newSeatActions[state.currentStreet] = {
          ...newSeatActions[state.currentStreet],
          [seat]: currentActions
        };
      }

      // Remove the last actionSequence entry for this seat+street
      const newSequence = [...state.actionSequence];
      for (let i = newSequence.length - 1; i >= 0; i--) {
        if (newSequence[i].seat === seat && newSequence[i].street === state.currentStreet) {
          newSequence.splice(i, 1);
          break;
        }
      }

      return {
        ...state,
        seatActions: newSeatActions,
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
        seatActions: {},
        absentSeats: [],
        actionSequence: [],
      };

    case GAME_ACTIONS.NEXT_HAND:
      return {
        ...state,
        currentStreet: 'preflop',
        dealerButtonSeat: (state.dealerButtonSeat % NUM_SEATS) + 1,
        seatActions: {},
        actionSequence: [],
        // Keep absentSeats as-is (don't clear)
      };

    // Hydrate game state from database (on app startup)
    // Merges with defaults to ensure all fields exist (handles old records lacking new fields)
    case GAME_ACTIONS.HYDRATE_STATE:
      return {
        ...initialGameState,  // Defaults first
        ...state,             // Current state
        ...action.payload     // Loaded data overwrites
      };

    case GAME_ACTIONS.RECORD_PRIMITIVE_ACTION: {
      const { seat, action: primitiveAction } = action.payload;

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

      // Also write to seatActions for UI consumers (street→seat→[actions] lookup)
      const newSeatActions = { ...state.seatActions };
      if (!newSeatActions[state.currentStreet]) {
        newSeatActions[state.currentStreet] = {};
      }
      const currentSeatActions = newSeatActions[state.currentStreet][seat] || [];
      newSeatActions[state.currentStreet] = {
        ...newSeatActions[state.currentStreet],
        [seat]: [...currentSeatActions, primitiveAction],
      };

      return {
        ...state,
        actionSequence: [...state.actionSequence, newEntry],
        seatActions: newSeatActions,
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
