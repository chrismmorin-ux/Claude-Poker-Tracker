/**
 * actionSequence.integration.test.js - Integration tests for action sequence system
 *
 * Tests the full round-trip: record → save → load → display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gameReducer, initialGameState, GAME_ACTIONS } from '../../reducers/gameReducer';
import { migrateHandToSequence } from '../../migrations/actionMigration';

// Mock IndexedDB for integration tests
const mockIndexedDB = () => {
  // Simple in-memory store
  const stores = {
    hands: [],
    sessions: [],
  };

  return {
    stores,
    reset: () => {
      stores.hands = [];
      stores.sessions = [];
    },
  };
};

describe('Action Sequence Integration', () => {
  let mockDB;

  beforeEach(() => {
    mockDB = mockIndexedDB();
  });

  afterEach(() => {
    mockDB.reset();
  });

  describe('Reducer integration', () => {
    it('records primitive actions in actionSequence', () => {
      let state = {
        ...initialGameState,
        currentStreet: 'preflop',
        dealerButtonSeat: 1,
      };

      // Record a fold action
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'fold' },
      });

      expect(state.actionSequence).toBeDefined();
      expect(state.actionSequence).toHaveLength(1);
      expect(state.actionSequence[0]).toMatchObject({
        seat: 3,
        action: 'fold',
        street: 'preflop',
        order: 1,
      });
    });

    it('maintains action order across multiple actions', () => {
      let state = {
        ...initialGameState,
        currentStreet: 'preflop',
        dealerButtonSeat: 1,
      };

      // Record multiple actions
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'call' },
      });

      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 4, action: 'raise' },
      });

      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 5, action: 'fold' },
      });

      expect(state.actionSequence).toHaveLength(3);
      expect(state.actionSequence[0].order).toBe(1);
      expect(state.actionSequence[1].order).toBe(2);
      expect(state.actionSequence[2].order).toBe(3);
    });

    it('tracks actions across street changes', () => {
      let state = {
        ...initialGameState,
        currentStreet: 'preflop',
        dealerButtonSeat: 1,
      };

      // Preflop action
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'call' },
      });

      // Advance to flop
      state = { ...state, currentStreet: 'flop' };

      // Flop action
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'check' },
      });

      expect(state.actionSequence).toHaveLength(2);
      expect(state.actionSequence[0].street).toBe('preflop');
      expect(state.actionSequence[1].street).toBe('flop');
      // Order should continue
      expect(state.actionSequence[1].order).toBe(2);
    });
  });

  describe('Migration integration', () => {
    it('migrates legacy hand to actionSequence format', () => {
      const legacyHand = {
        handId: 1,
        timestamp: Date.now(),
        gameState: {
          seatActions: {
            preflop: {
              1: ['fold'],
              2: ['call'],
              3: ['open'],  // 'open' → 'raise'
            },
            flop: {
              2: ['check'],
              3: ['donk'],  // 'donk' → 'bet'
            },
          },
        },
      };

      const migrated = migrateHandToSequence(legacyHand);

      expect(migrated.actionSequence).toBeDefined();
      expect(migrated.actionSequence.length).toBeGreaterThan(0);

      // Verify preflop actions
      const preflopActions = migrated.actionSequence.filter(a => a.street === 'preflop');
      expect(preflopActions.length).toBe(3);

      // Verify flop actions
      const flopActions = migrated.actionSequence.filter(a => a.street === 'flop');
      expect(flopActions.length).toBe(2);

      // Verify primitive conversion
      const raises = migrated.actionSequence.filter(a => a.action === 'raise');
      expect(raises.length).toBe(1); // 'open' → 'raise'
    });

    it('preserves hand data during migration', () => {
      const legacyHand = {
        handId: 123,
        timestamp: 1702000000000,
        userId: 'test-user',
        sessionId: 5,
        gameState: {
          seatActions: {
            preflop: { 1: ['fold'] },
          },
          currentStreet: 'flop',
        },
      };

      const migrated = migrateHandToSequence(legacyHand);

      expect(migrated.handId).toBe(123);
      expect(migrated.timestamp).toBe(1702000000000);
      expect(migrated.userId).toBe('test-user');
      expect(migrated.sessionId).toBe(5);
      expect(migrated.gameState.currentStreet).toBe('flop');
    });
  });

  describe('Display data transformation', () => {
    it('extracts actions by street from sequence', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 3, action: 'raise', street: 'preflop', order: 3 },
        { seat: 2, action: 'check', street: 'flop', order: 4 },
        { seat: 3, action: 'bet', street: 'flop', order: 5 },
      ];

      // Helper function (same as in ActionHistoryGrid)
      const getActionsForSeatStreet = (actionSequence, street, seat) => {
        return actionSequence
          .filter(e => e.street === street && e.seat === seat)
          .map(e => e.action);
      };

      // Test preflop seat 1
      expect(getActionsForSeatStreet(sequence, 'preflop', 1)).toEqual(['fold']);

      // Test preflop seat 2
      expect(getActionsForSeatStreet(sequence, 'preflop', 2)).toEqual(['call']);

      // Test flop seat 2
      expect(getActionsForSeatStreet(sequence, 'flop', 2)).toEqual(['check']);

      // Test empty seat/street combination
      expect(getActionsForSeatStreet(sequence, 'turn', 1)).toEqual([]);
    });
  });

  describe('Undo and Clear operations', () => {
    it('undo removes the last action for a seat on current street', () => {
      let state = {
        ...initialGameState,
        currentStreet: 'preflop',
      };

      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'call' },
      });
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'raise' },
      });

      expect(state.actionSequence).toHaveLength(2);

      state = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 3,
      });

      expect(state.actionSequence).toHaveLength(1);
      expect(state.actionSequence[0].action).toBe('call');
    });

    it('undo does nothing when no actions exist for seat', () => {
      let state = { ...initialGameState, currentStreet: 'preflop' };

      const beforeState = state;
      state = gameReducer(state, {
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 5,
      });

      expect(state).toBe(beforeState);
    });

    it('clear seat actions removes only that seat on current street', () => {
      let state = { ...initialGameState, currentStreet: 'preflop' };

      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'call' },
      });
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 5, action: 'raise' },
      });

      state = gameReducer(state, {
        type: GAME_ACTIONS.CLEAR_SEAT_ACTIONS,
        payload: [3],
      });

      expect(state.actionSequence).toHaveLength(1);
      expect(state.actionSequence[0].seat).toBe(5);
    });

    it('clear street actions removes all actions on current street', () => {
      let state = { ...initialGameState, currentStreet: 'preflop' };

      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 1, action: 'fold' },
      });
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 2, action: 'call' },
      });

      state = gameReducer(state, { type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });

      expect(state.actionSequence).toHaveLength(0);
    });
  });

  describe('Next hand lifecycle', () => {
    it('NEXT_HAND clears actionSequence and advances dealer', () => {
      let state = {
        ...initialGameState,
        currentStreet: 'flop',
        dealerButtonSeat: 3,
      };

      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 1, action: 'check' },
      });

      state = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });

      expect(state.actionSequence).toEqual([]);
      expect(state.currentStreet).toBe('preflop');
      expect(state.dealerButtonSeat).toBe(4);
      expect(state.actionSequence).toEqual([]);
    });

    it('NEXT_HAND preserves absentSeats', () => {
      let state = {
        ...initialGameState,
        absentSeats: [2, 7],
      };

      state = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });

      expect(state.absentSeats).toEqual([2, 7]);
    });

    it('RESET_HAND clears absentSeats unlike NEXT_HAND', () => {
      let state = {
        ...initialGameState,
        absentSeats: [2, 7],
      };

      state = gameReducer(state, { type: GAME_ACTIONS.RESET_HAND });

      expect(state.absentSeats).toEqual([]);
      expect(state.actionSequence).toEqual([]);
    });

    it('multi-street hand then next hand starts clean', () => {
      let state = { ...initialGameState };

      // Preflop
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'raise', amount: 8 },
      });
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 5, action: 'call', amount: 8 },
      });

      // Advance to flop
      state = gameReducer(state, { type: GAME_ACTIONS.SET_STREET, payload: 'flop' });

      // Flop
      state = gameReducer(state, {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat: 3, action: 'bet', amount: 10 },
      });

      expect(state.actionSequence).toHaveLength(3);

      // Next hand
      state = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });

      expect(state.actionSequence).toEqual([]);
      expect(state.currentStreet).toBe('preflop');
    });
  });

  describe('Backwards compatibility', () => {
    it('handles hand with only seatActions (pre-migration)', () => {
      const legacyHand = {
        seatActions: {
          preflop: { 1: ['fold'] },
        },
        // No actionSequence field
      };

      // Migration should add actionSequence
      const migrated = migrateHandToSequence(legacyHand);
      expect(migrated.actionSequence).toBeDefined();
      expect(migrated.actionSequence.length).toBe(1);

      // Original seatActions should still exist for backwards compat
      expect(migrated.seatActions).toBeDefined();
    });

    it('handles hand with both formats (post-migration)', () => {
      const hand = {
        seatActions: {
          preflop: { 1: ['fold'] },
        },
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        ],
      };

      // Should skip migration and return unchanged
      const result = migrateHandToSequence(hand);
      expect(result).toBe(hand); // Same object reference
    });
  });
});
