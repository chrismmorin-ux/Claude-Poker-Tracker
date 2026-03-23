// @vitest-environment jsdom
/**
 * useReplayState.test.js - Tests for hand replay stepping hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplayState } from '../useReplayState';

// Mock cardParser to avoid actual parsing
vi.mock('../../utils/pokerCore/cardParser', () => ({
  getCardsForStreet: vi.fn((cards, street) => {
    if (!cards || !cards.length) return [];
    if (street === 'preflop') return [];
    if (street === 'flop') return cards.slice(0, 3);
    if (street === 'turn') return cards.slice(0, 4);
    if (street === 'river') return cards.slice(0, 5);
    return [];
  }),
}));

// Mock handTimeline's sortByPositionalOrder to pass through
vi.mock('../../utils/handAnalysis', () => ({
  sortByPositionalOrder: vi.fn((timeline) => [...timeline]),
}));

const makeTimeline = () => [
  { seat: '3', street: 'preflop', action: 'raise', order: 1, amount: 6 },
  { seat: '5', street: 'preflop', action: 'call', order: 2, amount: 6 },
  { seat: '1', street: 'preflop', action: 'fold', order: 3 },
  { seat: '3', street: 'flop', action: 'bet', order: 4, amount: 10 },
  { seat: '5', street: 'flop', action: 'call', order: 5, amount: 10 },
  { seat: '3', street: 'turn', action: 'check', order: 6 },
  { seat: '5', street: 'turn', action: 'bet', order: 7, amount: 20 },
];

const makeHand = () => ({
  gameState: {
    dealerButtonSeat: 9,
    mySeat: 5,
    blindsPosted: { sb: 1, bb: 2 },
    communityCards: ['Ah', 'Kd', 'Qs', '5c', '2h'],
  },
  cardState: { communityCards: ['Ah', 'Kd', 'Qs', '5c', '2h'] },
});

describe('useReplayState', () => {
  describe('initial state', () => {
    it('starts at index 0 when timeline has actions', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );
      expect(result.current.currentActionIndex).toBe(0);
    });

    it('starts at -1 for empty timeline', () => {
      const { result } = renderHook(() =>
        useReplayState([], makeHand(), null)
      );
      expect(result.current.currentActionIndex).toBe(-1);
    });

    it('returns correct available streets', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );
      expect(result.current.availableStreets).toEqual(['preflop', 'flop', 'turn']);
    });
  });

  describe('stepping', () => {
    it('stepForward increments currentActionIndex', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );
      expect(result.current.currentActionIndex).toBe(0);

      act(() => result.current.stepForward());
      expect(result.current.currentActionIndex).toBe(1);

      act(() => result.current.stepForward());
      expect(result.current.currentActionIndex).toBe(2);
    });

    it('stepBack decrements currentActionIndex', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.stepForward());
      act(() => result.current.stepForward());
      expect(result.current.currentActionIndex).toBe(2);

      act(() => result.current.stepBack());
      expect(result.current.currentActionIndex).toBe(1);
    });

    it('stepForward clamps at max index', () => {
      const timeline = makeTimeline();
      const { result } = renderHook(() =>
        useReplayState(timeline, makeHand(), null)
      );

      // Step to end
      for (let i = 0; i < timeline.length + 5; i++) {
        act(() => result.current.stepForward());
      }
      expect(result.current.currentActionIndex).toBe(timeline.length - 1);
    });

    it('stepBack clamps at 0', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.stepBack());
      expect(result.current.currentActionIndex).toBe(0);
    });
  });

  describe('jumpToStreet', () => {
    it('jumps to flop start', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.jumpToStreet('flop'));
      expect(result.current.currentActionIndex).toBe(3); // first flop action
      expect(result.current.currentStreet).toBe('flop');
    });

    it('jumps to turn start', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.jumpToStreet('turn'));
      expect(result.current.currentActionIndex).toBe(5);
      expect(result.current.currentStreet).toBe('turn');
    });

    it('does nothing for non-existent street', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.jumpToStreet('river'));
      // Should stay at initial index since river doesn't exist in this timeline
      expect(result.current.currentActionIndex).toBe(0);
    });
  });

  describe('jumpToStart / jumpToEnd', () => {
    it('jumpToStart goes to index 0', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.stepForward());
      act(() => result.current.stepForward());
      act(() => result.current.jumpToStart());
      expect(result.current.currentActionIndex).toBe(0);
    });

    it('jumpToEnd goes to last index', () => {
      const timeline = makeTimeline();
      const { result } = renderHook(() =>
        useReplayState(timeline, makeHand(), null)
      );

      act(() => result.current.jumpToEnd());
      expect(result.current.currentActionIndex).toBe(timeline.length - 1);
    });
  });

  describe('villain selection', () => {
    it('auto-selects villain when current action is by a non-hero seat', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );
      // First action is seat 3 (not hero seat 5)
      expect(result.current.selectedVillainSeat).toBe(3);
    });

    it('persists last villain across hero actions', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      // Step to seat 5 action (hero) — index 1
      act(() => result.current.stepForward());
      // Hero action at seat 5, should still show villain from previous (seat 3)
      expect(result.current.selectedVillainSeat).toBe(3);
    });

    it('pinned villain overrides auto-selection', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.selectVillain(1));
      expect(result.current.pinnedVillainSeat).toBe(1);
      expect(result.current.selectedVillainSeat).toBe(1);
    });

    it('toggling same pinned seat unpins it', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      act(() => result.current.selectVillain(1));
      expect(result.current.pinnedVillainSeat).toBe(1);

      act(() => result.current.selectVillain(1));
      expect(result.current.pinnedVillainSeat).toBeNull();
    });
  });

  describe('seat states', () => {
    it('tracks folded seats', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      // Advance past the fold action (index 2)
      act(() => result.current.stepForward());
      act(() => result.current.stepForward());

      const seatState = result.current.seatStates.get(1);
      expect(seatState.hasFolded).toBe(true);
    });

    it('accumulates bet totals', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      // Jump to end to see all bets
      act(() => result.current.jumpToEnd());

      const seat3State = result.current.seatStates.get(3);
      expect(seat3State.totalBet).toBe(16); // 6 (raise) + 10 (bet)
    });
  });

  describe('pot calculation', () => {
    it('includes blinds in pot', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );
      // At index 0, pot should include blinds (1+2=3) + first action amount
      expect(result.current.potAtPoint).toBeGreaterThanOrEqual(3);
    });
  });

  describe('reveal toggle', () => {
    it('toggles seat reveal on and off', () => {
      const { result } = renderHook(() =>
        useReplayState(makeTimeline(), makeHand(), null)
      );

      expect(result.current.revealedSeats.has(3)).toBe(false);

      act(() => result.current.toggleReveal(3));
      expect(result.current.revealedSeats.has(3)).toBe(true);

      act(() => result.current.toggleReveal(3));
      expect(result.current.revealedSeats.has(3)).toBe(false);
    });
  });
});
