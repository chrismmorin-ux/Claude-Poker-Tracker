/**
 * gameReducer.test.js - Tests for game state reducer
 *
 * Note: seatActions and showdownActions are derived in GameContext from actionSequence.
 * The reducer only manages actionSequence as the single source of truth.
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
      expect(initialGameState.absentSeats).toEqual([]);
      expect(initialGameState.actionSequence).toEqual([]);
    });

    it('does not have legacy fields in state', () => {
      expect(initialGameState).not.toHaveProperty('seatActions');
      expect(initialGameState).not.toHaveProperty('showdownActions');
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

  describe('SET_DEALER', () => {
    it('updates dealer seat', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.SET_DEALER,
        payload: 7,
      });
      expect(newState.dealerButtonSeat).toBe(7);
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

  describe('RECORD_SHOWDOWN_ACTION', () => {
    it('appends showdown action to actionSequence', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION,
        payload: { seat: 3, action: 'mucked' },
      });
      expect(newState.actionSequence).toHaveLength(1);
      expect(newState.actionSequence[0].seat).toBe(3);
      expect(newState.actionSequence[0].action).toBe('mucked');
      expect(newState.actionSequence[0].street).toBe('showdown');
    });

    it('appends multiple showdown actions', () => {
      let s = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION,
        payload: { seat: 5, action: 'won' },
      });
      s = gameReducer(s, {
        type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION,
        payload: { seat: 3, action: 'mucked' },
      });
      expect(s.actionSequence).toHaveLength(2);
      expect(s.actionSequence[0].action).toBe('won');
      expect(s.actionSequence[1].action).toBe('mucked');
    });

    it('rejects invalid seat', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION,
        payload: { seat: 0, action: 'mucked' },
      });
      expect(newState.actionSequence).toEqual([]);
    });

    it('rejects non-showdown actions', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION,
        payload: { seat: 2, action: 'fold' },
      });
      expect(newState.actionSequence).toEqual([]);
    });

    it('always writes with street showdown regardless of currentStreet', () => {
      state.currentStreet = 'flop';
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION,
        payload: { seat: 2, action: 'won' },
      });
      expect(newState.actionSequence[0].street).toBe('showdown');
    });
  });

  describe('CLEAR_STREET_ACTIONS', () => {
    it('removes matching street entries from actionSequence', () => {
      state.actionSequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 3, action: 'check', street: 'flop', order: 3 },
      ];
      const newState = gameReducer(state, { type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });
      expect(newState.actionSequence).toHaveLength(1);
      expect(newState.actionSequence[0].street).toBe('flop');
    });

    it('preserves showdown entries in actionSequence', () => {
      state.actionSequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 3, action: 'won', street: 'showdown', order: 2 },
      ];
      const newState = gameReducer(state, { type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });
      expect(newState.actionSequence).toHaveLength(1);
      expect(newState.actionSequence[0].street).toBe('showdown');
    });
  });

  describe('CLEAR_SEAT_ACTIONS', () => {
    it('removes matching seat+street entries from actionSequence', () => {
      state.actionSequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 3, action: 'fold', street: 'preflop', order: 3 },
      ];
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.CLEAR_SEAT_ACTIONS,
        payload: [1, 3],
      });
      expect(newState.actionSequence).toHaveLength(1);
      expect(newState.actionSequence[0].seat).toBe(2);
    });
  });

  describe('UNDO_LAST_ACTION', () => {
    it('removes last action for seat from actionSequence', () => {
      state.actionSequence = [
        { seat: 5, action: 'call', street: 'preflop', order: 1 },
        { seat: 5, action: 'raise', street: 'preflop', order: 2 },
      ];
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 5,
      });
      expect(newState.actionSequence).toHaveLength(1);
      expect(newState.actionSequence[0].action).toBe('call');
    });

    it('returns same state if no actions to undo', () => {
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 5,
      });
      expect(newState).toBe(state);
    });

    it('only removes from current street', () => {
      state.currentStreet = 'flop';
      state.actionSequence = [
        { seat: 5, action: 'call', street: 'preflop', order: 1 },
        { seat: 5, action: 'bet', street: 'flop', order: 2 },
      ];
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 5,
      });
      expect(newState.actionSequence).toHaveLength(1);
      expect(newState.actionSequence[0].street).toBe('preflop');
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
      state.absentSeats = [5, 7];
      state.dealerButtonSeat = 4;
      state.actionSequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 3, action: 'won', street: 'showdown', order: 2 },
      ];

      const newState = gameReducer(state, { type: GAME_ACTIONS.RESET_HAND });

      expect(newState.currentStreet).toBe('preflop');
      expect(newState.actionSequence).toEqual([]);
      expect(newState.absentSeats).toEqual([]);
      expect(newState.dealerButtonSeat).toBe(4);
    });
  });

  describe('NEXT_HAND', () => {
    it('resets for new hand and advances dealer', () => {
      state.currentStreet = 'showdown';
      state.absentSeats = [3];
      state.dealerButtonSeat = 5;
      state.actionSequence = [
        { seat: 1, action: 'call', street: 'preflop', order: 1 },
        { seat: 1, action: 'won', street: 'showdown', order: 2 },
      ];

      const newState = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });

      expect(newState.currentStreet).toBe('preflop');
      expect(newState.actionSequence).toEqual([]);
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
    it('merges loaded state with new format', () => {
      const loadedState = {
        currentStreet: 'turn',
        dealerButtonSeat: 8,
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        ],
      };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.HYDRATE_STATE,
        payload: loadedState,
      });

      expect(newState.currentStreet).toBe('turn');
      expect(newState.dealerButtonSeat).toBe(8);
      expect(newState.actionSequence).toHaveLength(1);
      expect(newState.mySeat).toBe(5); // Original value preserved
      expect(newState).not.toHaveProperty('seatActions');
      expect(newState).not.toHaveProperty('showdownActions');
    });

    it('migrates legacy showdownActions into actionSequence', () => {
      const loadedState = {
        currentStreet: 'showdown',
        showdownActions: { 3: ['won'], 5: ['mucked'] },
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        ],
      };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.HYDRATE_STATE,
        payload: loadedState,
      });

      // showdownActions should be converted to actionSequence entries
      const showdownEntries = newState.actionSequence.filter(e => e.street === 'showdown');
      expect(showdownEntries).toHaveLength(2);
      expect(showdownEntries.find(e => e.seat === 3).action).toBe('won');
      expect(showdownEntries.find(e => e.seat === 5).action).toBe('mucked');
      expect(newState).not.toHaveProperty('showdownActions');
    });

    it('migrates legacy seatActions with showdown data', () => {
      const loadedState = {
        currentStreet: 'turn',
        dealerButtonSeat: 8,
        seatActions: {
          preflop: { 1: ['fold'], 2: ['call'] },
          showdown: { 3: ['won'] },
        },
      };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.HYDRATE_STATE,
        payload: loadedState,
      });

      // Showdown data migrated into actionSequence
      const showdownEntries = newState.actionSequence.filter(e => e.street === 'showdown');
      expect(showdownEntries).toHaveLength(1);
      expect(showdownEntries[0].seat).toBe(3);
      expect(showdownEntries[0].action).toBe('won');
      expect(newState.actionSequence.length).toBeGreaterThan(1); // betting + showdown
      expect(newState).not.toHaveProperty('seatActions');
    });

    it('migrates legacy seatActions without showdown data', () => {
      const loadedState = {
        currentStreet: 'flop',
        seatActions: {
          preflop: { 1: ['fold'] },
        },
      };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.HYDRATE_STATE,
        payload: loadedState,
      });

      expect(newState.actionSequence).toHaveLength(1);
      expect(newState).not.toHaveProperty('seatActions');
      expect(newState).not.toHaveProperty('showdownActions');
    });

    it('preserves actionSequence when present alongside legacy seatActions', () => {
      const loadedState = {
        seatActions: { preflop: { 1: ['fold'] } },
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
          { seat: 2, action: 'call', street: 'preflop', order: 2 },
        ],
      };
      const newState = gameReducer(state, {
        type: GAME_ACTIONS.HYDRATE_STATE,
        payload: loadedState,
      });

      // Should keep the actionSequence as-is (not re-derive from legacy)
      expect(newState.actionSequence).toHaveLength(2);
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
      expect(GAME_STATE_SCHEMA).not.toHaveProperty('showdownActions');
      expect(GAME_STATE_SCHEMA).toHaveProperty('absentSeats');
      expect(GAME_STATE_SCHEMA).toHaveProperty('actionSequence');
      expect(GAME_STATE_SCHEMA).not.toHaveProperty('seatActions');
    });
  });

  // ===========================================================================
  // Action Sequence Tests
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
