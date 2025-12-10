/**
 * gameReducer.test.js - Tests for game state reducer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  gameReducer,
  GAME_ACTIONS,
  initialGameState,
  GAME_STATE_SCHEMA,
} from '../gameReducer';

describe('gameReducer', () => {
  let state;

  beforeEach(() => {
    state = { ...initialGameState };
  });

  describe('initialGameState', () => {
    it('has correct default values', () => {
      expect(initialGameState.currentStreet).toBe('preflop');
      expect(initialGameState.dealerButtonSeat).toBe(1);
      expect(initialGameState.mySeat).toBe(5);
      expect(initialGameState.seatActions).toEqual({});
      expect(initialGameState.absentSeats).toEqual([]);
    });
  });

  describe('SET_STREET', () => {
    it('updates current street', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.SET_STREET,
        payload: 'flop',
      });
      expect(newState.currentStreet).toBe('flop');
    });

    it('preserves other state', () => {
      state.dealerButtonSeat = 5;
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.SET_STREET,
        payload: 'turn',
      });
      expect(newState.dealerButtonSeat).toBe(5);
    });
  });

  describe('NEXT_STREET', () => {
    it('advances from preflop to flop', () => {
      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_STREET });
      expect(newState.currentStreet).toBe('flop');
    });

    it('advances from flop to turn', () => {
      state.currentStreet = 'flop';
      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_STREET });
      expect(newState.currentStreet).toBe('turn');
    });

    it('advances from turn to river', () => {
      state.currentStreet = 'turn';
      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_STREET });
      expect(newState.currentStreet).toBe('river');
    });

    it('advances from river to showdown', () => {
      state.currentStreet = 'river';
      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_STREET });
      expect(newState.currentStreet).toBe('showdown');
    });

    it('stays at showdown when already there', () => {
      state.currentStreet = 'showdown';
      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_STREET });
      expect(newState.currentStreet).toBe('showdown');
    });
  });

  describe('SET_DEALER', () => {
    it('updates dealer seat', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.SET_DEALER,
        payload: 7,
      });
      expect(newState.dealerButtonSeat).toBe(7);
    });
  });

  describe('ADVANCE_DEALER', () => {
    it('moves dealer to next seat', () => {
      state.dealerButtonSeat = 5;
      const newState = gameReducer(state, { type: GAME_ACTIONS.ADVANCE_DEALER });
      expect(newState.dealerButtonSeat).toBe(6);
    });

    it('wraps from seat 9 to seat 1', () => {
      state.dealerButtonSeat = 9;
      const newState = gameReducer(state, { type: GAME_ACTIONS.ADVANCE_DEALER });
      expect(newState.dealerButtonSeat).toBe(1);
    });
  });

  describe('SET_MY_SEAT', () => {
    it('updates my seat', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.SET_MY_SEAT,
        payload: 3,
      });
      expect(newState.mySeat).toBe(3);
    });
  });

  describe('RECORD_ACTION', () => {
    it('records action for single seat', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [3], action: 'fold' },
      });
      expect(newState.seatActions.preflop[3]).toEqual(['fold']);
    });

    it('records action for multiple seats', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [1, 2, 3], action: 'fold' },
      });
      expect(newState.seatActions.preflop[1]).toEqual(['fold']);
      expect(newState.seatActions.preflop[2]).toEqual(['fold']);
      expect(newState.seatActions.preflop[3]).toEqual(['fold']);
    });

    it('appends multiple actions for same seat', () => {
      state.seatActions = { preflop: { 5: ['call'] } };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [5], action: '3bet' },
      });
      expect(newState.seatActions.preflop[5]).toEqual(['call', '3bet']);
    });

    it('removes seat from absent list when action recorded', () => {
      state.absentSeats = [3, 5, 7];
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [5], action: 'fold' },
      });
      expect(newState.absentSeats).toEqual([3, 7]);
    });

    it('records actions for correct street', () => {
      state.currentStreet = 'flop';
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [2], action: 'check' },
      });
      expect(newState.seatActions.flop[2]).toEqual(['check']);
      expect(newState.seatActions.preflop).toBeUndefined();
    });

    it('rejects invalid action type', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [3], action: 'invalid_action_xyz' },
      });
      // State should be unchanged
      expect(newState.seatActions).toEqual({});
    });

    it('rejects if all seats are invalid', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [0, 10, -1], action: 'fold' },
      });
      // State should be unchanged
      expect(newState.seatActions).toEqual({});
    });

    it('filters out invalid seats but processes valid ones', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_ACTION,
        payload: { seats: [0, 3, 10, 5], action: 'fold' },
      });
      // Only seats 3 and 5 should be recorded (valid seats)
      expect(newState.seatActions.preflop[3]).toEqual(['fold']);
      expect(newState.seatActions.preflop[5]).toEqual(['fold']);
      // Invalid seats should not be recorded
      expect(newState.seatActions.preflop[0]).toBeUndefined();
      expect(newState.seatActions.preflop[10]).toBeUndefined();
    });
  });

  describe('CLEAR_STREET_ACTIONS', () => {
    it('clears actions for current street', () => {
      state.seatActions = {
        preflop: { 1: ['fold'], 2: ['call'] },
        flop: { 3: ['check'] },
      };
      const newState = gameReducer(state, { type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });
      expect(newState.seatActions.preflop).toBeUndefined();
      expect(newState.seatActions.flop).toEqual({ 3: ['check'] });
    });
  });

  describe('CLEAR_SEAT_ACTIONS', () => {
    it('clears actions for specified seats on current street', () => {
      state.seatActions = {
        preflop: { 1: ['fold'], 2: ['call'], 3: ['open'] },
      };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.CLEAR_SEAT_ACTIONS,
        payload: [1, 3],
      });
      expect(newState.seatActions.preflop[1]).toBeUndefined();
      expect(newState.seatActions.preflop[2]).toEqual(['call']);
      expect(newState.seatActions.preflop[3]).toBeUndefined();
    });
  });

  describe('UNDO_LAST_ACTION', () => {
    it('removes last action from seat', () => {
      state.seatActions = { preflop: { 5: ['call', '3bet'] } };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 5,
      });
      expect(newState.seatActions.preflop[5]).toEqual(['call']);
    });

    it('removes seat entry when no actions left', () => {
      state.seatActions = { preflop: { 5: ['call'] } };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 5,
      });
      expect(newState.seatActions.preflop[5]).toBeUndefined();
    });

    it('returns same state if no actions to undo', () => {
      state.seatActions = { preflop: {} };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 5,
      });
      expect(newState).toBe(state);
    });
  });

  describe('TOGGLE_ABSENT', () => {
    it('adds seat to absent list', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.TOGGLE_ABSENT,
        payload: [3],
      });
      expect(newState.absentSeats).toContain(3);
    });

    it('removes seat from absent list if already present', () => {
      state.absentSeats = [3, 5];
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.TOGGLE_ABSENT,
        payload: [3],
      });
      expect(newState.absentSeats).not.toContain(3);
      expect(newState.absentSeats).toContain(5);
    });

    it('handles multiple seats', () => {
      state.absentSeats = [1];
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.TOGGLE_ABSENT,
        payload: [1, 2, 3],
      });
      // 1 was present -> removed, 2 and 3 were not -> added
      expect(newState.absentSeats).not.toContain(1);
      expect(newState.absentSeats).toContain(2);
      expect(newState.absentSeats).toContain(3);
    });
  });

  describe('RESET_HAND', () => {
    it('resets street and actions but keeps dealer', () => {
      state.currentStreet = 'river';
      state.seatActions = { preflop: { 1: ['fold'] }, flop: { 2: ['check'] } };
      state.absentSeats = [5, 7];
      state.dealerButtonSeat = 4;

      const newState = gameReducer(state, { type: GAME_ACTIONS.RESET_HAND });

      expect(newState.currentStreet).toBe('preflop');
      expect(newState.seatActions).toEqual({});
      expect(newState.absentSeats).toEqual([]);
      expect(newState.dealerButtonSeat).toBe(4);
    });
  });

  describe('NEXT_HAND', () => {
    it('resets for new hand and advances dealer', () => {
      state.currentStreet = 'showdown';
      state.seatActions = { preflop: { 1: ['call'] } };
      state.absentSeats = [3];
      state.dealerButtonSeat = 5;

      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });

      expect(newState.currentStreet).toBe('preflop');
      expect(newState.seatActions).toEqual({});
      expect(newState.dealerButtonSeat).toBe(6);
      // absentSeats should be preserved
      expect(newState.absentSeats).toEqual([3]);
    });

    it('wraps dealer from seat 9 to seat 1', () => {
      state.dealerButtonSeat = 9;
      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });
      expect(newState.dealerButtonSeat).toBe(1);
    });
  });

  describe('HYDRATE_STATE', () => {
    it('merges loaded state', () => {
      const loadedState = {
        currentStreet: 'turn',
        dealerButtonSeat: 8,
        seatActions: { preflop: { 1: ['fold'] } },
      };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.HYDRATE_STATE,
        payload: loadedState,
      });

      expect(newState.currentStreet).toBe('turn');
      expect(newState.dealerButtonSeat).toBe(8);
      expect(newState.seatActions).toEqual({ preflop: { 1: ['fold'] } });
      expect(newState.mySeat).toBe(5); // Original value preserved
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const newState = gameReducer(state, { type: 'UNKNOWN_ACTION' });
      expect(newState).toBe(state);
    });
  });

  describe('GAME_STATE_SCHEMA', () => {
    it('is defined and has correct keys', () => {
      expect(GAME_STATE_SCHEMA).toBeDefined();
      expect(GAME_STATE_SCHEMA).toHaveProperty('currentStreet');
      expect(GAME_STATE_SCHEMA).toHaveProperty('dealerButtonSeat');
      expect(GAME_STATE_SCHEMA).toHaveProperty('mySeat');
      expect(GAME_STATE_SCHEMA).toHaveProperty('seatActions');
      expect(GAME_STATE_SCHEMA).toHaveProperty('absentSeats');
      expect(GAME_STATE_SCHEMA).toHaveProperty('actionSequence');
    });
  });

  // ===========================================================================
  // Phase 3: Action Sequence Tests
  // ===========================================================================

  describe('RECORD_PRIMITIVE_ACTION', () => {
    it('adds action entry to sequence', () => {
      const state = { ...initialGameState, currentStreet: 'preflop' };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'raise' },
      });

      expect(result.actionSequence).toHaveLength(1);
      expect(result.actionSequence[0].seat).toBe(3);
      expect(result.actionSequence[0].action).toBe('raise');
      expect(result.actionSequence[0].street).toBe('preflop');
      expect(result.actionSequence[0].order).toBe(1);
    });

    it('increments order for each action', () => {
      let state = { ...initialGameState, currentStreet: 'preflop' };
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 1, action: 'fold' },
      });
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 2, action: 'call' },
      });
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'raise' },
      });

      expect(state.actionSequence).toHaveLength(3);
      expect(state.actionSequence[0].order).toBe(1);
      expect(state.actionSequence[1].order).toBe(2);
      expect(state.actionSequence[2].order).toBe(3);
    });

    it('records current street with action', () => {
      let state = { ...initialGameState, currentStreet: 'flop' };
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 1, action: 'bet' },
      });

      expect(state.actionSequence[0].street).toBe('flop');
    });

    it('removes seat from absent when they act', () => {
      const state = {
        ...initialGameState,
        absentSeats: [1, 3, 5],
      };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'fold' },
      });

      expect(result.absentSeats).toEqual([1, 5]);
    });

    it('rejects invalid seat', () => {
      const state = { ...initialGameState };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 0, action: 'fold' },
      });

      expect(result.actionSequence).toHaveLength(0);
    });

    it('rejects invalid primitive action', () => {
      const state = { ...initialGameState };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 1, action: '3bet' }, // Not a primitive
      });

      expect(result.actionSequence).toHaveLength(0);
    });

    it('accepts all 5 primitive actions', () => {
      const primitives = ['check', 'bet', 'call', 'raise', 'fold'];
      let state = { ...initialGameState };

      primitives.forEach((action, index) => {
        state = gameReducer(state, {
          type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
          payload: { seat: index + 1, action },
        });
      });

      expect(state.actionSequence).toHaveLength(5);
      expect(state.actionSequence.map(e => e.action)).toEqual(primitives);
    });
  });

  describe('UNDO_SEQUENCE_ACTION', () => {
    it('removes last action from sequence', () => {
      const state = {
        ...initialGameState,
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
          { seat: 2, action: 'raise', street: 'preflop', order: 2 },
        ],
      };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_SEQUENCE_ACTION,
      });

      expect(result.actionSequence).toHaveLength(1);
      expect(result.actionSequence[0].seat).toBe(1);
    });

    it('returns same state if sequence is empty', () => {
      const state = { ...initialGameState, actionSequence: [] };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_SEQUENCE_ACTION,
      });

      expect(result).toBe(state);
    });

    it('clears sequence when undoing last action', () => {
      const state = {
        ...initialGameState,
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        ],
      };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_SEQUENCE_ACTION,
      });

      expect(result.actionSequence).toHaveLength(0);
    });
  });

  describe('CLEAR_SEQUENCE', () => {
    it('clears all actions from sequence', () => {
      const state = {
        ...initialGameState,
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
          { seat: 2, action: 'raise', street: 'preflop', order: 2 },
          { seat: 3, action: 'bet', street: 'flop', order: 3 },
        ],
      };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.CLEAR_SEQUENCE,
      });

      expect(result.actionSequence).toEqual([]);
    });
  });

  describe('RESET_HAND clears actionSequence', () => {
    it('clears actionSequence on reset', () => {
      const state = {
        ...initialGameState,
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        ],
      };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.RESET_HAND,
      });

      expect(result.actionSequence).toEqual([]);
    });
  });

  describe('NEXT_HAND clears actionSequence', () => {
    it('clears actionSequence on next hand', () => {
      const state = {
        ...initialGameState,
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        ],
      };
      const result = gameReducer(state, {
        type: GAME_ACTIONS.NEXT_HAND,
      });

      expect(result.actionSequence).toEqual([]);
    });
  });
});
