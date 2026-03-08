// @vitest-environment jsdom
/**
 * GameContext.expanded.test.jsx - Expanded tests for game context derived values
 * Tests: recordPrimitiveAction, potInfo, potOverride
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext';

const defaultBlinds = { sb: 1, bb: 2 };

const createWrapper = (gameState, dispatchGame = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <GameProvider gameState={gameState} dispatchGame={dispatchGame} blinds={defaultBlinds}>
      {children}
    </GameProvider>
  );
  return Wrapper;
};

const createGameState = (overrides = {}) => ({
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  absentSeats: [],
  actionSequence: [],
  potOverride: null,
  ...overrides,
});

describe('GameContext derived values', () => {
  describe('actionSequence is passed through', () => {
    it('provides empty actionSequence', () => {
      const gameState = createGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });
      expect(result.current.actionSequence).toEqual([]);
    });

    it('provides populated actionSequence', () => {
      const gameState = createGameState({
        actionSequence: [
          { seat: 3, action: 'call', street: 'preflop', order: 1 },
          { seat: 5, action: 'raise', street: 'preflop', order: 2, amount: 8 },
        ],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.actionSequence).toHaveLength(2);
      expect(result.current.actionSequence[0].action).toBe('call');
      expect(result.current.actionSequence[1].action).toBe('raise');
    });
  });

  describe('recordPrimitiveAction', () => {
    it('dispatches RECORD_PRIMITIVE_ACTION with correct payload', () => {
      const mockDispatch = vi.fn();
      const gameState = createGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState, mockDispatch),
      });

      act(() => {
        result.current.recordPrimitiveAction(3, 'call');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'RECORD_PRIMITIVE_ACTION',
        payload: { seat: 3, action: 'call', amount: undefined },
      });
    });

    it('passes amount when provided', () => {
      const mockDispatch = vi.fn();
      const gameState = createGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState, mockDispatch),
      });

      act(() => {
        result.current.recordPrimitiveAction(5, 'raise', 15);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'RECORD_PRIMITIVE_ACTION',
        payload: { seat: 5, action: 'raise', amount: 15 },
      });
    });
  });

  describe('potInfo calculation', () => {
    it('returns blinds total for empty actionSequence', () => {
      const gameState = createGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.potInfo.total).toBe(3); // sb(1) + bb(2)
      expect(result.current.potInfo.isEstimated).toBe(false);
    });

    it('calculates pot from actions with amounts', () => {
      const gameState = createGameState({
        actionSequence: [
          { seat: 3, action: 'raise', street: 'preflop', order: 1, amount: 8 },
          { seat: 5, action: 'call', street: 'preflop', order: 2, amount: 8 },
        ],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      // sb(1) + bb(2) + raise(8) + call(8) = 19
      expect(result.current.potInfo.total).toBe(19);
    });

    it('marks as estimated when bet/raise has no amount', () => {
      const gameState = createGameState({
        actionSequence: [
          { seat: 3, action: 'raise', street: 'preflop', order: 1 },
        ],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.potInfo.isEstimated).toBe(true);
    });
  });

  describe('potOverride', () => {
    it('overrides pot total when set', () => {
      const gameState = createGameState({
        potOverride: 50,
        actionSequence: [
          { seat: 3, action: 'raise', street: 'preflop', order: 1, amount: 8 },
        ],
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.potInfo.total).toBe(50);
      expect(result.current.potInfo.isEstimated).toBe(false);
    });

    it('uses calculated pot when potOverride is null', () => {
      const gameState = createGameState({
        potOverride: null,
      });
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current.potInfo.total).toBe(3); // blinds only
    });
  });

  describe('context exposes all expected fields', () => {
    it('provides actionSequence, potInfo, blinds, recordPrimitiveAction', () => {
      const gameState = createGameState();
      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(gameState),
      });

      expect(result.current).toHaveProperty('actionSequence');
      expect(result.current).toHaveProperty('potInfo');
      expect(result.current).toHaveProperty('blinds');
      expect(result.current).toHaveProperty('recordPrimitiveAction');
    });
  });
});
