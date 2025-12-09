/**
 * useStateSetters.test.js - Tests for state setters hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStateSetters } from '../useStateSetters';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { UI_ACTIONS } from '../../reducers/uiReducer';
import { CARD_ACTIONS } from '../../reducers/cardReducer';

describe('useStateSetters', () => {
  let dispatchGame;
  let dispatchUi;
  let dispatchCard;

  beforeEach(() => {
    dispatchGame = vi.fn();
    dispatchUi = vi.fn();
    dispatchCard = vi.fn();
  });

  const createHook = () => {
    return renderHook(() => useStateSetters(dispatchGame, dispatchUi, dispatchCard));
  };

  describe('returns all expected functions', () => {
    it('returns setCurrentScreen', () => {
      const { result } = createHook();
      expect(typeof result.current.setCurrentScreen).toBe('function');
    });

    it('returns setContextMenu', () => {
      const { result } = createHook();
      expect(typeof result.current.setContextMenu).toBe('function');
    });

    it('returns setSelectedPlayers', () => {
      const { result } = createHook();
      expect(typeof result.current.setSelectedPlayers).toBe('function');
    });

    it('returns setHoleCardsVisible', () => {
      const { result } = createHook();
      expect(typeof result.current.setHoleCardsVisible).toBe('function');
    });

    it('returns setCurrentStreet', () => {
      const { result } = createHook();
      expect(typeof result.current.setCurrentStreet).toBe('function');
    });

    it('returns setDealerSeat', () => {
      const { result } = createHook();
      expect(typeof result.current.setDealerSeat).toBe('function');
    });

    it('returns setCardSelectorType', () => {
      const { result } = createHook();
      expect(typeof result.current.setCardSelectorType).toBe('function');
    });

    it('returns setHighlightedCardIndex', () => {
      const { result } = createHook();
      expect(typeof result.current.setHighlightedCardIndex).toBe('function');
    });

    it('returns setHighlightedSeat', () => {
      const { result } = createHook();
      expect(typeof result.current.setHighlightedSeat).toBe('function');
    });

    it('returns setHighlightedCardSlot', () => {
      const { result } = createHook();
      expect(typeof result.current.setHighlightedCardSlot).toBe('function');
    });
  });

  describe('setCurrentScreen', () => {
    it('dispatches SET_SCREEN action to dispatchUi', () => {
      const { result } = createHook();

      act(() => {
        result.current.setCurrentScreen('stats');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_SCREEN,
        payload: 'stats',
      });
    });

    it('passes different screen values', () => {
      const { result } = createHook();

      act(() => {
        result.current.setCurrentScreen('table');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_SCREEN,
        payload: 'table',
      });
    });
  });

  describe('setContextMenu', () => {
    it('dispatches SET_CONTEXT_MENU when menu object provided', () => {
      const { result } = createHook();
      const menu = { x: 100, y: 200, seat: 5 };

      act(() => {
        result.current.setContextMenu(menu);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_CONTEXT_MENU,
        payload: menu,
      });
    });

    it('dispatches CLOSE_CONTEXT_MENU when null provided', () => {
      const { result } = createHook();

      act(() => {
        result.current.setContextMenu(null);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CONTEXT_MENU,
      });
    });
  });

  describe('setSelectedPlayers', () => {
    it('dispatches SET_SELECTION action', () => {
      const { result } = createHook();
      const players = [1, 2, 3];

      act(() => {
        result.current.setSelectedPlayers(players);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_SELECTION,
        payload: players,
      });
    });

    it('handles empty array', () => {
      const { result } = createHook();

      act(() => {
        result.current.setSelectedPlayers([]);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_SELECTION,
        payload: [],
      });
    });
  });

  describe('setHoleCardsVisible', () => {
    it('dispatches SET_HOLE_VISIBILITY to dispatchCard', () => {
      const { result } = createHook();

      act(() => {
        result.current.setHoleCardsVisible(true);
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_HOLE_VISIBILITY,
        payload: true,
      });
    });

    it('dispatches false value', () => {
      const { result } = createHook();

      act(() => {
        result.current.setHoleCardsVisible(false);
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.SET_HOLE_VISIBILITY,
        payload: false,
      });
    });
  });

  describe('setCurrentStreet', () => {
    it('dispatches SET_STREET to dispatchGame', () => {
      const { result } = createHook();

      act(() => {
        result.current.setCurrentStreet('flop');
      });

      expect(dispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.SET_STREET,
        payload: 'flop',
      });
    });
  });

  describe('setDealerSeat', () => {
    it('dispatches SET_DEALER to dispatchGame', () => {
      const { result } = createHook();

      act(() => {
        result.current.setDealerSeat(7);
      });

      expect(dispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.SET_DEALER,
        payload: 7,
      });
    });
  });

  describe('setCardSelectorType', () => {
    it('dispatches SET_CARD_SELECTOR_TYPE to dispatchUi', () => {
      const { result } = createHook();

      act(() => {
        result.current.setCardSelectorType('hole');
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_CARD_SELECTOR_TYPE,
        payload: 'hole',
      });
    });
  });

  describe('setHighlightedCardIndex', () => {
    it('dispatches SET_HIGHLIGHTED_CARD_INDEX to dispatchUi', () => {
      const { result } = createHook();

      act(() => {
        result.current.setHighlightedCardIndex(3);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX,
        payload: 3,
      });
    });

    it('handles null value', () => {
      const { result } = createHook();

      act(() => {
        result.current.setHighlightedCardIndex(null);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX,
        payload: null,
      });
    });
  });

  describe('setHighlightedSeat', () => {
    it('dispatches SET_HIGHLIGHTED_SEAT to dispatchUi', () => {
      const { result } = createHook();

      act(() => {
        result.current.setHighlightedSeat(5);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 5,
      });
    });
  });

  describe('setHighlightedCardSlot', () => {
    it('dispatches SET_HIGHLIGHTED_HOLE_SLOT to dispatchUi', () => {
      const { result } = createHook();

      act(() => {
        result.current.setHighlightedCardSlot(1);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT,
        payload: 1,
      });
    });
  });

  describe('dispatcher isolation', () => {
    it('UI setters only call dispatchUi', () => {
      const { result } = createHook();

      act(() => {
        result.current.setCurrentScreen('stats');
        result.current.setContextMenu({ x: 0, y: 0 });
        result.current.setSelectedPlayers([]);
        result.current.setCardSelectorType('hole');
        result.current.setHighlightedCardIndex(0);
        result.current.setHighlightedSeat(1);
        result.current.setHighlightedCardSlot(0);
      });

      expect(dispatchUi).toHaveBeenCalledTimes(7);
      expect(dispatchGame).not.toHaveBeenCalled();
      expect(dispatchCard).not.toHaveBeenCalled();
    });

    it('game setters only call dispatchGame', () => {
      const { result } = createHook();

      act(() => {
        result.current.setCurrentStreet('flop');
        result.current.setDealerSeat(5);
      });

      expect(dispatchGame).toHaveBeenCalledTimes(2);
      expect(dispatchUi).not.toHaveBeenCalled();
      expect(dispatchCard).not.toHaveBeenCalled();
    });

    it('card setters only call dispatchCard', () => {
      const { result } = createHook();

      act(() => {
        result.current.setHoleCardsVisible(true);
      });

      expect(dispatchCard).toHaveBeenCalledTimes(1);
      expect(dispatchGame).not.toHaveBeenCalled();
      expect(dispatchUi).not.toHaveBeenCalled();
    });
  });

  describe('function stability', () => {
    it('returns stable function references when dispatchers unchanged', () => {
      const { result, rerender } = createHook();

      const firstRender = { ...result.current };

      rerender();

      expect(result.current.setCurrentScreen).toBe(firstRender.setCurrentScreen);
      expect(result.current.setContextMenu).toBe(firstRender.setContextMenu);
      expect(result.current.setSelectedPlayers).toBe(firstRender.setSelectedPlayers);
      expect(result.current.setHoleCardsVisible).toBe(firstRender.setHoleCardsVisible);
      expect(result.current.setCurrentStreet).toBe(firstRender.setCurrentStreet);
      expect(result.current.setDealerSeat).toBe(firstRender.setDealerSeat);
    });
  });
});
