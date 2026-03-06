/**
 * GameContext.test.jsx - Tests for game state context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext';

const PREFLOP = 'preflop';

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

  describe('smallBlindSeat', () => {
    it('returns seat after dealer (seat 2 when dealer is seat 1)', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 1 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.smallBlindSeat).toBe(2);
    });

    it('wraps around from seat 9 to seat 1', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 9 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.smallBlindSeat).toBe(1);
    });

    it('skips absent seats', () => {
      const gameState = createDefaultGameState({
        dealerButtonSeat: 1,
        absentSeats: [2],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.smallBlindSeat).toBe(3);
    });

    it('skips multiple absent seats', () => {
      const gameState = createDefaultGameState({
        dealerButtonSeat: 1,
        absentSeats: [2, 3, 4],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.smallBlindSeat).toBe(5);
    });
  });

  describe('bigBlindSeat', () => {
    it('returns seat two positions after dealer', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 1 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.bigBlindSeat).toBe(3);
    });

    it('wraps around correctly', () => {
      const gameState = createDefaultGameState({ dealerButtonSeat: 8 });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.bigBlindSeat).toBe(1);
    });

    it('skips absent seats', () => {
      const gameState = createDefaultGameState({
        dealerButtonSeat: 1,
        absentSeats: [3],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.bigBlindSeat).toBe(4);
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
      expect(result.current).toHaveProperty('smallBlindSeat');
      expect(result.current).toHaveProperty('bigBlindSeat');
    });
  });
});
