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

  describe('getCommunityCard', () => {
    it('returns empty string for empty slot', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getCommunityCard(0)).toBe('');
      expect(result.current.getCommunityCard(4)).toBe('');
    });

    it('returns card when slot is filled', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getCommunityCard(0)).toBe('A♠');
      expect(result.current.getCommunityCard(1)).toBe('K♥');
      expect(result.current.getCommunityCard(2)).toBe('Q♦');
      expect(result.current.getCommunityCard(3)).toBe('');
    });

    it('returns empty string for out of bounds index', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getCommunityCard(10)).toBe('');
      expect(result.current.getCommunityCard(-1)).toBe('');
    });
  });

  describe('getHoleCard', () => {
    it('returns empty string for empty slot', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getHoleCard(0)).toBe('');
      expect(result.current.getHoleCard(1)).toBe('');
    });

    it('returns card when slot is filled', () => {
      const cardState = createDefaultCardState({
        holeCards: ['A♠', 'K♠'],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getHoleCard(0)).toBe('A♠');
      expect(result.current.getHoleCard(1)).toBe('K♠');
    });

    it('returns empty string for out of bounds index', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getHoleCard(5)).toBe('');
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

  describe('isCardInCommunity', () => {
    it('returns false for empty card', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', 'K♥', '', '', ''],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardInCommunity('')).toBe(false);
      expect(result.current.isCardInCommunity(null)).toBe(false);
    });

    it('returns false when card not in community', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardInCommunity('J♠')).toBe(false);
      expect(result.current.isCardInCommunity('2♣')).toBe(false);
    });

    it('returns true when card in community', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardInCommunity('A♠')).toBe(true);
      expect(result.current.isCardInCommunity('K♥')).toBe(true);
      expect(result.current.isCardInCommunity('Q♦')).toBe(true);
    });
  });

  describe('isCardInHoleCards', () => {
    it('returns false for empty card', () => {
      const cardState = createDefaultCardState({
        holeCards: ['A♠', 'K♠'],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardInHoleCards('')).toBe(false);
      expect(result.current.isCardInHoleCards(null)).toBe(false);
    });

    it('returns false when card not in hole cards', () => {
      const cardState = createDefaultCardState({
        holeCards: ['A♠', 'K♠'],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardInHoleCards('Q♠')).toBe(false);
    });

    it('returns true when card in hole cards', () => {
      const cardState = createDefaultCardState({
        holeCards: ['A♠', 'K♠'],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardInHoleCards('A♠')).toBe(true);
      expect(result.current.isCardInHoleCards('K♠')).toBe(true);
    });
  });

  describe('isCardUsed', () => {
    it('returns false for empty card', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardUsed('')).toBe(false);
      expect(result.current.isCardUsed(null)).toBe(false);
    });

    it('returns true for card in community cards', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', '', '', '', ''],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardUsed('A♠')).toBe(true);
    });

    it('returns true for card in hole cards', () => {
      const cardState = createDefaultCardState({
        holeCards: ['K♥', ''],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardUsed('K♥')).toBe(true);
    });

    it('returns true for card in player cards', () => {
      const cardState = createDefaultCardState({
        allPlayerCards: {
          5: ['Q♦', 'J♣'],
        },
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardUsed('Q♦')).toBe(true);
      expect(result.current.isCardUsed('J♣')).toBe(true);
    });

    it('returns false for unused card', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', 'K♥', '', '', ''],
        holeCards: ['Q♦', 'J♠'],
        allPlayerCards: {
          3: ['10♣', '9♣'],
        },
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardUsed('2♠')).toBe(false);
      expect(result.current.isCardUsed('7♥')).toBe(false);
    });

    it('checks all 9 seats for player cards', () => {
      const cardState = createDefaultCardState({
        allPlayerCards: {
          9: ['2♣', ''],
        },
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.isCardUsed('2♣')).toBe(true);
    });
  });

  describe('getAllUsedCards', () => {
    it('returns empty array when no cards used', () => {
      const cardState = createDefaultCardState();
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      expect(result.current.getAllUsedCards()).toEqual([]);
    });

    it('returns community cards', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', 'K♥', '', '', ''],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      const used = result.current.getAllUsedCards();
      expect(used).toContain('A♠');
      expect(used).toContain('K♥');
      expect(used).toHaveLength(2);
    });

    it('returns hole cards', () => {
      const cardState = createDefaultCardState({
        holeCards: ['Q♦', 'J♠'],
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      const used = result.current.getAllUsedCards();
      expect(used).toContain('Q♦');
      expect(used).toContain('J♠');
      expect(used).toHaveLength(2);
    });

    it('returns player cards', () => {
      const cardState = createDefaultCardState({
        allPlayerCards: {
          1: ['10♣', '9♣'],
          5: ['8♥', '7♥'],
        },
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      const used = result.current.getAllUsedCards();
      expect(used).toContain('10♣');
      expect(used).toContain('9♣');
      expect(used).toContain('8♥');
      expect(used).toContain('7♥');
      expect(used).toHaveLength(4);
    });

    it('returns all used cards without duplicates', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', 'K♥', 'Q♦', 'J♠', '10♠'],
        holeCards: ['9♥', '8♥'],
        allPlayerCards: {
          1: ['7♣', '6♣'],
          2: ['5♦', '4♦'],
        },
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      const used = result.current.getAllUsedCards();
      expect(used).toHaveLength(11);
      // Check no duplicates
      expect(new Set(used).size).toBe(used.length);
    });

    it('ignores empty strings in cards', () => {
      const cardState = createDefaultCardState({
        communityCards: ['A♠', '', '', '', ''],
        holeCards: ['', ''],
        allPlayerCards: {
          1: ['', ''],
        },
      });
      const { result } = renderHook(() => useCard(), {
        wrapper: createWrapper(cardState),
      });

      const used = result.current.getAllUsedCards();
      expect(used).toEqual(['A♠']);
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
      expect(result.current).toHaveProperty('getCommunityCard');
      expect(result.current).toHaveProperty('getHoleCard');
      expect(result.current).toHaveProperty('getPlayerCards');
      expect(result.current).toHaveProperty('isCardInCommunity');
      expect(result.current).toHaveProperty('isCardInHoleCards');
      expect(result.current).toHaveProperty('isCardUsed');
      expect(result.current).toHaveProperty('getAllUsedCards');
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
