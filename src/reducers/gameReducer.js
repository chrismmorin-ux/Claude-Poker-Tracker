/**
 * gameReducer.js - Game state management
 * Manages: currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats
 */

// Action types
export const GAME_ACTIONS = {
  SET_STREET: 'SET_STREET',
  NEXT_STREET: 'NEXT_STREET',
  SET_DEALER: 'SET_DEALER',
  ADVANCE_DEALER: 'ADVANCE_DEALER',
  SET_MY_SEAT: 'SET_MY_SEAT',
  RECORD_ACTION: 'RECORD_ACTION',
  CLEAR_STREET_ACTIONS: 'CLEAR_STREET_ACTIONS',
  TOGGLE_ABSENT: 'TOGGLE_ABSENT',
  RESET_HAND: 'RESET_HAND',
  NEXT_HAND: 'NEXT_HAND',
};

// Initial state
export const initialGameState = {
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  seatActions: {}, // { seat: { street: action } }
  absentSeats: [],
};

// Street progression order
const STREET_ORDER = ['preflop', 'flop', 'turn', 'river', 'showdown'];
const NUM_SEATS = 9;

// Reducer
export const gameReducer = (state, action) => {
  switch (action.type) {
    case GAME_ACTIONS.SET_STREET:
      return {
        ...state,
        currentStreet: action.payload,
      };

    case GAME_ACTIONS.NEXT_STREET: {
      const currentIndex = STREET_ORDER.indexOf(state.currentStreet);
      const nextStreet = currentIndex < STREET_ORDER.length - 1
        ? STREET_ORDER[currentIndex + 1]
        : state.currentStreet;
      return {
        ...state,
        currentStreet: nextStreet,
      };
    }

    case GAME_ACTIONS.SET_DEALER:
      return {
        ...state,
        dealerButtonSeat: action.payload,
      };

    case GAME_ACTIONS.ADVANCE_DEALER:
      return {
        ...state,
        dealerButtonSeat: (state.dealerButtonSeat % NUM_SEATS) + 1,
      };

    case GAME_ACTIONS.SET_MY_SEAT:
      return {
        ...state,
        mySeat: action.payload,
      };

    case GAME_ACTIONS.RECORD_ACTION: {
      const { seats, action: playerAction } = action.payload;
      const newSeatActions = { ...state.seatActions };

      // Structure: seatActions[street][seat] = action
      if (!newSeatActions[state.currentStreet]) {
        newSeatActions[state.currentStreet] = {};
      }

      seats.forEach(seat => {
        newSeatActions[state.currentStreet] = {
          ...newSeatActions[state.currentStreet],
          [seat]: playerAction
        };
      });

      // Remove seats from absent if they're taking action
      const newAbsentSeats = state.absentSeats.filter(s => !seats.includes(s));

      return {
        ...state,
        seatActions: newSeatActions,
        absentSeats: newAbsentSeats,
      };
    }

    case GAME_ACTIONS.CLEAR_STREET_ACTIONS: {
      const newSeatActions = { ...state.seatActions };
      delete newSeatActions[state.currentStreet];

      return {
        ...state,
        seatActions: newSeatActions,
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
      };

    case GAME_ACTIONS.NEXT_HAND:
      return {
        ...state,
        currentStreet: 'preflop',
        dealerButtonSeat: (state.dealerButtonSeat % NUM_SEATS) + 1,
        seatActions: {},
        // Keep absentSeats as-is (don't clear)
      };

    default:
      return state;
  }
};
