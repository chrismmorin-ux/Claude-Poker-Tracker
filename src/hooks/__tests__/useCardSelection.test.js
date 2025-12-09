/**
 * useCardSelection.test.js - Tests for card selection hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardSelection } from '../useCardSelection';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { UI_ACTIONS } from '../../reducers/uiReducer';

describe('useCardSelection', () => {
  let dispatchCard;
  let dispatchUi;

  beforeEach(() => {
    dispatchCard = vi.fn();
    dispatchUi = vi.fn();
  });

  const createHook = (overrides = {}) => {
    const defaults = {
      highlightedBoardIndex: 0,
      cardSelectorType: 'community',
      communityCards: ['', '', '', '', ''],
      holeCards: ['', ''],
      currentStreet: 'flop',
    };
    const params = { ...defaults, ...overrides };
    return renderHook(() =>
      useCardSelection(
        params.highlightedBoardIndex,
        params.cardSelectorType,
        params.communityCards,
        params.holeCards,
        params.currentStreet,
        dispatchCard,
        dispatchUi
      )
    );
  };

  describe('returns a function', () => {
    it('returns selectCard function', () => {
      const { result } = createHook();
      expect(typeof result.current).toBe('function');
    });
  });

  describe('null highlighted index', () => {
    it('does nothing when highlightedBoardIndex is null', () => {
      const { result } = createHook({ highlightedBoardIndex: null });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).not.toHaveBeenCalled();
      expect(dispatchUi).not.toHaveBeenCalled();
    });
  });

  describe('community card selection', () => {
    it('assigns card to highlighted community slot', () => {
      const { result } = createHook({ highlightedBoardIndex: 0 });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_COMMUNITY_CARD,
        payload: { index: 0, card: 'A♠' },
      });
    });

    it('removes card from other community slot if present', () => {
      const { result } = createHook({
        highlightedBoardIndex: 1,
        communityCards: ['A♠', '', '', '', ''],
      });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_COMMUNITY_CARD,
        payload: { index: 0, card: '' },
      });
      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_COMMUNITY_CARD,
        payload: { index: 1, card: 'A♠' },
      });
    });

    it('does not clear card if already in correct slot', () => {
      const { result } = createHook({
        highlightedBoardIndex: 0,
        communityCards: ['A♠', '', '', '', ''],
      });

      act(() => {
        result.current('A♠');
      });

      // Should only have the set call, not a clear call
      const clearCalls = dispatchCard.mock.calls.filter(
        ([action]) => action.payload?.card === ''
      );
      expect(clearCalls).toHaveLength(0);
    });

    it('auto-advances to next slot when not at street boundary', () => {
      const { result } = createHook({ highlightedBoardIndex: 0, currentStreet: 'flop' });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX,
        payload: 1,
      });
    });

    it('sets null when at last community slot', () => {
      const { result } = createHook({ highlightedBoardIndex: 4, currentStreet: 'river' });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });
  });

  describe('auto-close on street completion', () => {
    it('closes selector after 3rd card on flop', () => {
      const { result } = createHook({ highlightedBoardIndex: 2, currentStreet: 'flop' });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });

    it('closes selector after 4th card on turn', () => {
      const { result } = createHook({ highlightedBoardIndex: 3, currentStreet: 'turn' });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });

    it('closes selector after 5th card on river', () => {
      const { result } = createHook({ highlightedBoardIndex: 4, currentStreet: 'river' });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });

    it('does not auto-close on flop before 3rd card', () => {
      const { result } = createHook({ highlightedBoardIndex: 1, currentStreet: 'flop' });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).not.toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });
  });

  describe('hole card selection', () => {
    it('assigns card to highlighted hole slot', () => {
      const { result } = createHook({
        cardSelectorType: 'hole',
        highlightedBoardIndex: 0,
      });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_HOLE_CARD,
        payload: { index: 0, card: 'A♠' },
      });
    });

    it('removes card from other hole slot if present', () => {
      const { result } = createHook({
        cardSelectorType: 'hole',
        highlightedBoardIndex: 1,
        holeCards: ['A♠', ''],
      });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_HOLE_CARD,
        payload: { index: 0, card: '' },
      });
      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_HOLE_CARD,
        payload: { index: 1, card: 'A♠' },
      });
    });

    it('auto-advances to second hole slot after first', () => {
      const { result } = createHook({
        cardSelectorType: 'hole',
        highlightedBoardIndex: 0,
      });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX,
        payload: 1,
      });
    });

    it('closes selector after second hole card', () => {
      const { result } = createHook({
        cardSelectorType: 'hole',
        highlightedBoardIndex: 1,
      });

      act(() => {
        result.current('A♠');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });
  });

  describe('function stability', () => {
    it('returns stable function when dependencies unchanged', () => {
      const { result, rerender } = createHook();
      const first = result.current;
      rerender();
      expect(result.current).toBe(first);
    });

    it('updates when highlightedBoardIndex changes', () => {
      const { result, rerender } = renderHook(
        ({ index }) =>
          useCardSelection(
            index,
            'community',
            ['', '', '', '', ''],
            ['', ''],
            'flop',
            dispatchCard,
            dispatchUi
          ),
        { initialProps: { index: 0 } }
      );

      const first = result.current;
      rerender({ index: 1 });
      expect(result.current).not.toBe(first);
    });
  });
});
