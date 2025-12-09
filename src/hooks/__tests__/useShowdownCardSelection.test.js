/**
 * useShowdownCardSelection.test.js - Tests for showdown card selection hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShowdownCardSelection } from '../useShowdownCardSelection';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { UI_ACTIONS } from '../../reducers/uiReducer';
import { createEmptyPlayerCards } from '../../test/utils';

// Mock the seatNavigation module
vi.mock('../../utils/seatNavigation', () => ({
  findNextEmptySlot: vi.fn(() => null),
}));

import { findNextEmptySlot } from '../../utils/seatNavigation';

describe('useShowdownCardSelection', () => {
  let dispatchCard;
  let dispatchUi;
  let isSeatInactive;

  beforeEach(() => {
    dispatchCard = vi.fn();
    dispatchUi = vi.fn();
    isSeatInactive = vi.fn(() => null);
    vi.mocked(findNextEmptySlot).mockReturnValue(null);
  });

  const createHook = (overrides = {}) => {
    const defaults = {
      highlightedSeat: 3,
      highlightedHoleSlot: 0,
      mySeat: 5,
      holeCards: ['', ''],
      allPlayerCards: createEmptyPlayerCards(),
      communityCards: ['', '', '', '', ''],
      seatActions: {},
      numSeats: 9,
    };
    const params = { ...defaults, ...overrides };
    return renderHook(() =>
      useShowdownCardSelection(
        params.highlightedSeat,
        params.highlightedHoleSlot,
        params.mySeat,
        params.holeCards,
        params.allPlayerCards,
        params.communityCards,
        params.seatActions,
        isSeatInactive,
        dispatchCard,
        dispatchUi,
        params.numSeats
      )
    );
  };

  describe('returns a function', () => {
    it('returns selectCardForShowdown function', () => {
      const { result } = createHook();
      expect(typeof result.current).toBe('function');
    });
  });

  describe('my seat card assignment', () => {
    it('assigns card to holeCards when seat is mySeat', () => {
      const { result } = createHook({ highlightedSeat: 5, highlightedHoleSlot: 0, mySeat: 5 });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_HOLE_CARD,
        payload: { index: 0, card: 'A♠' },
      });
    });

    it('clears card from other hole slot if present for my seat', () => {
      const { result } = createHook({
        highlightedSeat: 5,
        highlightedHoleSlot: 1,
        mySeat: 5,
        holeCards: ['A♠', ''],
      });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_HOLE_CARD,
        payload: { index: 0, card: '' },
      });
    });
  });

  describe('other player card assignment', () => {
    it('assigns card to allPlayerCards for other seats', () => {
      const { result } = createHook({ highlightedSeat: 3, highlightedHoleSlot: 0 });

      act(() => {
        result.current('K♥');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 3, slotIndex: 0, card: 'K♥' },
      });
    });

    it('clears card from other players if present', () => {
      const allPlayerCards = createEmptyPlayerCards();
      allPlayerCards[7] = ['K♥', ''];

      const { result } = createHook({
        highlightedSeat: 3,
        highlightedHoleSlot: 0,
        allPlayerCards,
      });

      act(() => {
        result.current('K♥');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 7, slotIndex: 0, card: '' },
      });
    });

    it('assigns to second slot correctly', () => {
      const { result } = createHook({ highlightedSeat: 3, highlightedHoleSlot: 1 });

      act(() => {
        result.current('Q♦');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 3, slotIndex: 1, card: 'Q♦' },
      });
    });
  });

  describe('community card removal', () => {
    it('removes card from community cards if present', () => {
      const { result } = createHook({
        communityCards: ['A♠', 'K♥', '', '', ''],
      });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_COMMUNITY_CARD,
        payload: { index: 0, card: '' },
      });
    });

    it('does not remove from community if card not present', () => {
      const { result } = createHook({
        communityCards: ['K♥', 'Q♦', '', '', ''],
      });

      act(() => {
        result.current('A♠');
      });

      const communityCalls = dispatchCard.mock.calls.filter(
        ([action]) => action.type === CARD_ACTIONS.SET_COMMUNITY_CARD
      );
      expect(communityCalls).toHaveLength(0);
    });
  });

  describe('auto-advance behavior', () => {
    it('advances to next empty slot from findNextEmptySlot', () => {
      vi.mocked(findNextEmptySlot).mockReturnValue({ seat: 4, slot: 0 });

      const { result } = createHook();

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 4,
      });
      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT,
        payload: 0,
      });
    });

    it('clears highlights when no more empty slots', () => {
      vi.mocked(findNextEmptySlot).mockReturnValue(null);

      const { result } = createHook();

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: null,
      });
      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT,
        payload: null,
      });
    });

    it('calls findNextEmptySlot with correct params', () => {
      const allPlayerCards = createEmptyPlayerCards();
      const holeCards = ['', ''];

      const { result } = createHook({
        highlightedSeat: 3,
        highlightedHoleSlot: 0,
        mySeat: 5,
        holeCards,
        allPlayerCards,
      });

      act(() => {
        result.current('A♠');
      });

      expect(findNextEmptySlot).toHaveBeenCalledWith(
        3, // seat
        0, // slot
        5, // mySeat
        holeCards,
        allPlayerCards,
        9, // numSeats
        isSeatInactive,
        {} // seatActions
      );
    });
  });

  describe('function stability', () => {
    it('returns stable function when dependencies unchanged', () => {
      const { result, rerender } = createHook();
      const first = result.current;
      rerender();
      expect(result.current).toBe(first);
    });
  });

  describe('edge cases', () => {
    it('handles slot 0 and slot 1', () => {
      const { result: result0 } = createHook({ highlightedHoleSlot: 0 });
      const { result: result1 } = createHook({ highlightedHoleSlot: 1 });

      act(() => {
        result0.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 3, slotIndex: 0, card: 'A♠' },
      });

      dispatchCard.mockClear();

      act(() => {
        result1.current('K♥');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 3, slotIndex: 1, card: 'K♥' },
      });
    });
  });
});
