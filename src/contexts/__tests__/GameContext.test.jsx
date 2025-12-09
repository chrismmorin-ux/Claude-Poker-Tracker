/**
 * GameContext.test.jsx - Tests for game state context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext';
import { ACTIONS, FOLD_ACTIONS } from '../../constants/gameConstants';

// Streets are strings (array values), not object properties
const PREFLOP = 'preflop';
const FLOP = 'flop';
const TURN = 'turn';
const RIVER = 'river';

// Helper to create a wrapper with GameProvider
const createWrapper = (gameState, dispatchGame = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <GameProvider gameState={gameState} dispatchGame={dispatchGame}>
      {children}
    </GameProvider>
  );
  return Wrapper;
};

// Default game state for testing
const createDefaultGameState = (overrides = {}) => ({
  currentStreet: PREFLOP,
  dealerButtonSeat: 1,
  mySeat: 5,
  seatActions: {},
  absentSeats: [],
  ...overrides,
});

describe('GameContext', () => {
  describe('useGame hook', () => {
    it('throws error when used outside of GameProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useGame());
      }).toThrow('useGame must be used within a GameProvider');

      consoleSpy.mockRestore();
    });

    it('provides game state values', () => {
      const gameState = createDefaultGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.currentStreet).toBe(PREFLOP);
      expect(result.current.dealerButtonSeat).toBe(1);
      expect(result.current.mySeat).toBe(5);
      expect(result.current.seatActions).toEqual({});
      expect(result.current.absentSeats).toEqual([]);
    });

    it('provides dispatchGame function', () => {
      const mockDispatch = vi.fn();
      const gameState = createDefaultGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState, mockDispatch),
      });

      expect(typeof result.current.dispatchGame).toBe('function');

      result.current.dispatchGame({ type: 'TEST_ACTION' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'TEST_ACTION' });
    });
  });

  describe('getSmallBlindSeat', () => {
    it('returns seat after dealer (seat 2 when dealer is seat 1)', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 1 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getSmallBlindSeat()).toBe(2);
    });

    it('wraps around from seat 9 to seat 1', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 9 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getSmallBlindSeat()).toBe(1);
    });

    it('skips absent seats', () => {
      const gameState = createDefaultGameState({
        dealerButtonSeat: 1,
        absentSeats: [2],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getSmallBlindSeat()).toBe(3);
    });

    it('skips multiple absent seats', () => {
      const gameState = createDefaultGameState({
        dealerButtonSeat: 1,
        absentSeats: [2, 3, 4],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getSmallBlindSeat()).toBe(5);
    });
  });

  describe('getBigBlindSeat', () => {
    it('returns seat two positions after dealer', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 1 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getBigBlindSeat()).toBe(3);
    });

    it('wraps around correctly', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 8 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getBigBlindSeat()).toBe(1);
    });

    it('skips absent seats', () => {
      const gameState = createDefaultGameState({
        dealerButtonSeat: 1,
        absentSeats: [3],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getBigBlindSeat()).toBe(4);
    });
  });

  describe('hasSeatFolded', () => {
    it('returns false when seat has no actions', () => {
      const gameState = createDefaultGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.hasSeatFolded(1)).toBe(false);
    });

    it('returns false when seat has non-fold actions', () => {
      const gameState = createDefaultGameState({
        currentStreet: PREFLOP,
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.CALL],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.hasSeatFolded(1)).toBe(false);
    });

    it('returns true when seat has folded', () => {
      const gameState = createDefaultGameState({
        currentStreet: PREFLOP,
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.FOLD],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.hasSeatFolded(1)).toBe(true);
    });

    it('returns true for FOLD_TO_CBET action', () => {
      const gameState = createDefaultGameState({
        currentStreet: PREFLOP,
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.FOLD_TO_CBET],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.hasSeatFolded(1)).toBe(true);
    });

    it('returns true when fold is among multiple actions', () => {
      const gameState = createDefaultGameState({
        currentStreet: PREFLOP,
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.CALL, ACTIONS.FOLD],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.hasSeatFolded(1)).toBe(true);
    });

    it('only checks current street', () => {
      const gameState = createDefaultGameState({
        currentStreet: FLOP,
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.FOLD],
          },
          [FLOP]: {
            1: [ACTIONS.CALL],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      // On flop, seat 1 called (but folded on preflop)
      expect(result.current.hasSeatFolded(1)).toBe(false);
    });
  });

  describe('isSeatInactive', () => {
    it('returns null for active seat', () => {
      const gameState = createDefaultGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.isSeatInactive(1)).toBeNull();
    });

    it('returns "absent" for absent seat', () => {
      const gameState = createDefaultGameState({
        absentSeats: [3],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.isSeatInactive(3)).toBe('absent');
    });

    it('returns "folded" for folded seat', () => {
      const gameState = createDefaultGameState({
        currentStreet: PREFLOP,
        seatActions: {
          [PREFLOP]: {
            2: [ACTIONS.FOLD],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.isSeatInactive(2)).toBe('folded');
    });

    it('prioritizes absent over folded', () => {
      const gameState = createDefaultGameState({
        absentSeats: [4],
        currentStreet: PREFLOP,
        seatActions: {
          [PREFLOP]: {
            4: [ACTIONS.FOLD],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.isSeatInactive(4)).toBe('absent');
    });
  });

  describe('getSeatAllActions', () => {
    it('returns empty object for seat with no actions', () => {
      const gameState = createDefaultGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getSeatAllActions(1)).toEqual({});
    });

    it('returns actions for single street', () => {
      const gameState = createDefaultGameState({
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.CALL],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getSeatAllActions(1)).toEqual({
        [PREFLOP]: [ACTIONS.CALL],
      });
    });

    it('returns actions across multiple streets', () => {
      const gameState = createDefaultGameState({
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.CALL],
            2: [ACTIONS.OPEN],
          },
          [FLOP]: {
            1: [ACTIONS.CHECK],
            2: [ACTIONS.DONK],
          },
          [TURN]: {
            1: [ACTIONS.FOLD],
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.getSeatAllActions(1)).toEqual({
        [PREFLOP]: [ACTIONS.CALL],
        [FLOP]: [ACTIONS.CHECK],
        [TURN]: [ACTIONS.FOLD],
      });

      expect(result.current.getSeatAllActions(2)).toEqual({
        [PREFLOP]: [ACTIONS.OPEN],
        [FLOP]: [ACTIONS.DONK],
      });
    });

    it('does not include streets where seat has no actions', () => {
      const gameState = createDefaultGameState({
        seatActions: {
          [PREFLOP]: {
            1: [ACTIONS.CALL],
          },
          [FLOP]: {
            2: [ACTIONS.DONK], // seat 1 has no flop actions
          },
        },
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      const seat1Actions = result.current.getSeatAllActions(1);
      expect(Object.keys(seat1Actions)).toEqual([PREFLOP]);
      expect(seat1Actions[FLOP]).toBeUndefined();
    });
  });

  describe('context memoization', () => {
    it('provides all expected context values', () => {
      const gameState = createDefaultGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      // State values
      expect(result.current).toHaveProperty('currentStreet');
      expect(result.current).toHaveProperty('dealerButtonSeat');
      expect(result.current).toHaveProperty('mySeat');
      expect(result.current).toHaveProperty('seatActions');
      expect(result.current).toHaveProperty('absentSeats');

      // Dispatch
      expect(result.current).toHaveProperty('dispatchGame');

      // Derived utilities
      expect(result.current).toHaveProperty('getSmallBlindSeat');
      expect(result.current).toHaveProperty('getBigBlindSeat');
      expect(result.current).toHaveProperty('hasSeatFolded');
      expect(result.current).toHaveProperty('isSeatInactive');
      expect(result.current).toHaveProperty('getSeatAllActions');
    });
  });
});
