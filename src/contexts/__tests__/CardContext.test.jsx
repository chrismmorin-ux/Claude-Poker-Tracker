// @vitest-environment jsdom
/**
 * CardContext.test.jsx - Tests for card state context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { CardProvider, useCard } from '../CardContext';

// Helper to create a wrapper with CardProvider
const createWrapper = (cardState, dispatchCard = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <CardProvider cardState={cardState} dispatchCard={dispatchCard}>
      {children}
    </CardProvider>
  );
  return Wrapper;
};

// Default card state for testing
const createDefaultCardState = (overrides = {}) => ({
  communityCards: ['', '', '', '', ''],
  holeCards: ['', ''],
  holeCardsVisible: true,
  allPlayerCards: {},
  ...overrides,
});

describe('CardContext', () => {
  describe('useCard hook', () => {
    it('throws error when used outside of CardProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCard());
      }).toThrow('useCard must be used within a CardProvider');

      consoleSpy.mockRestore();
    });

    it('provides card state values', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.communityCards).toEqual(['', '', '', '', '']);
      expect(result.current.holeCards).toEqual(['', '']);
      expect(result.current.holeCardsVisible).toBe(true);
      expect(result.current.allPlayerCards).toEqual({});
    });

    it('provides dispatchCard function', () => {
      const mockDispatch = vi.fn();
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState, mockDispatch),
      });

      expect(typeof result.current.dispatchCard).toBe('function');

      result.current.dispatchCard({ type: 'TEST_ACTION' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'TEST_ACTION' });
    });
  });

  describe('getPlayerCards', () => {
    it('returns default empty cards for seat with no cards', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getPlayerCards(1)).toEqual(['', '']);
      expect(result.current.getPlayerCards(9)).toEqual(['', '']);
    });

    it('returns player cards when seat has cards', () => {
      const cardState = createDefaultCardState({
        allPlayerCards: {
          3: ['J♠', 'J♥'],
          7: ['A♦', 'K♣'],
        },
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getPlayerCards(3)).toEqual(['J♠', 'J♥']);
      expect(result.current.getPlayerCards(7)).toEqual(['A♦', 'K♣']);
      expect(result.current.getPlayerCards(1)).toEqual(['', '']);
    });
  });

  describe('context memoization', () => {
    it('provides all expected context values', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      // State values
      expect(result.current).toHaveProperty('communityCards');
      expect(result.current).toHaveProperty('holeCards');
      expect(result.current).toHaveProperty('holeCardsVisible');
      expect(result.current).toHaveProperty('allPlayerCards');

      // Dispatch
      expect(result.current).toHaveProperty('dispatchCard');

      // Derived utilities
      expect(result.current).toHaveProperty('getPlayerCards');
    });
  });

  describe('holeCardsVisible state', () => {
    it('provides holeCardsVisible as true by default', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.holeCardsVisible).toBe(true);
    });

    it('provides holeCardsVisible as false when set', () => {
      const cardState = createDefaultCardState({ holeCardsVisible: false });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.holeCardsVisible).toBe(false);
    });
  });
});
