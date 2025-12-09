/**
 * useShowdownHandlers.test.js - Tests for showdown handlers hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShowdownHandlers } from '../useShowdownHandlers';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { UI_ACTIONS } from '../../reducers/uiReducer';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { ACTIONS } from '../../constants/gameConstants';

// Mock the seatNavigation module
vi.mock('../../utils/seatNavigation', () => ({
  findFirstActiveSeat: vi.fn(() => 1),
  findNextActiveSeat: vi.fn(() => null),
}));

import { findFirstActiveSeat, findNextActiveSeat } from '../../utils/seatNavigation';

describe('useShowdownHandlers', () => {
  let dispatchCard;
  let dispatchUi;
  let dispatchGame;
  let isSeatInactive;
  let recordSeatAction;
  let nextHand;
  let log;

  beforeEach(() => {
    dispatchCard = vi.fn();
    dispatchUi = vi.fn();
    dispatchGame = vi.fn();
    isSeatInactive = vi.fn(() => null);
    recordSeatAction = vi.fn();
    nextHand = vi.fn();
    log = vi.fn();
    vi.mocked(findFirstActiveSeat).mockReturnValue(1);
    vi.mocked(findNextActiveSeat).mockReturnValue(null);
  });

  const createHook = (overrides = {}) => {
    const defaults = {
      seatActions: {},
      numSeats: 9,
    };
    const params = { ...defaults, ...overrides };
    return renderHook(() =>
      useShowdownHandlers(
        dispatchCard,
        dispatchUi,
        dispatchGame,
        isSeatInactive,
        params.seatActions,
        recordSeatAction,
        nextHand,
        params.numSeats,
        log
      )
    );
  };

  describe('returns all handlers', () => {
    it('returns handleClearShowdownCards', () => {
      const { result } = createHook();
      expect(typeof result.current.handleClearShowdownCards).toBe('function');
    });

    it('returns handleMuckSeat', () => {
      const { result } = createHook();
      expect(typeof result.current.handleMuckSeat).toBe('function');
    });

    it('returns handleWonSeat', () => {
      const { result } = createHook();
      expect(typeof result.current.handleWonSeat).toBe('function');
    });

    it('returns handleNextHandFromShowdown', () => {
      const { result } = createHook();
      expect(typeof result.current.handleNextHandFromShowdown).toBe('function');
    });

    it('returns handleCloseShowdown', () => {
      const { result } = createHook();
      expect(typeof result.current.handleCloseShowdown).toBe('function');
    });

    it('returns handleCloseCardSelector', () => {
      const { result } = createHook();
      expect(typeof result.current.handleCloseCardSelector).toBe('function');
    });
  });

  describe('handleClearShowdownCards', () => {
    it('dispatches RESET_CARDS', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleClearShowdownCards();
      });

      expect(dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.RESET_CARDS,
      });
    });

    it('dispatches CLEAR_STREET_ACTIONS', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleClearShowdownCards();
      });

      expect(dispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.CLEAR_STREET_ACTIONS,
      });
    });

    it('highlights first active seat', () => {
      vi.mocked(findFirstActiveSeat).mockReturnValue(3);
      const { result } = createHook();

      act(() => {
        result.current.handleClearShowdownCards();
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 3,
      });
      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT,
        payload: 0,
      });
    });

    it('uses seat 1 as fallback when no active seat', () => {
      vi.mocked(findFirstActiveSeat).mockReturnValue(null);
      const { result } = createHook();

      act(() => {
        result.current.handleClearShowdownCards();
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 1,
      });
    });

    it('calls log function', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleClearShowdownCards();
      });

      expect(log).toHaveBeenCalled();
    });
  });

  describe('handleMuckSeat', () => {
    it('records MUCKED action for seat', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleMuckSeat(3);
      });

      expect(recordSeatAction).toHaveBeenCalledWith(3, ACTIONS.MUCKED);
    });

    it('advances to next active seat', () => {
      vi.mocked(findNextActiveSeat).mockReturnValue(5);
      const { result } = createHook();

      act(() => {
        result.current.handleMuckSeat(3);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 5,
      });
      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT,
        payload: 0,
      });
    });

    it('clears highlight when no more active seats', () => {
      vi.mocked(findNextActiveSeat).mockReturnValue(null);
      const { result } = createHook();

      act(() => {
        result.current.handleMuckSeat(3);
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
  });

  describe('handleWonSeat', () => {
    it('records WON action for seat', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleWonSeat(7);
      });

      expect(recordSeatAction).toHaveBeenCalledWith(7, ACTIONS.WON);
    });

    it('advances to next active seat', () => {
      vi.mocked(findNextActiveSeat).mockReturnValue(9);
      const { result } = createHook();

      act(() => {
        result.current.handleWonSeat(7);
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 9,
      });
    });
  });

  describe('handleNextHandFromShowdown', () => {
    it('calls nextHand function', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleNextHandFromShowdown();
      });

      expect(nextHand).toHaveBeenCalled();
    });

    it('closes showdown view', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleNextHandFromShowdown();
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_SHOWDOWN_VIEW,
      });
    });
  });

  describe('handleCloseShowdown', () => {
    it('closes showdown view', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleCloseShowdown();
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_SHOWDOWN_VIEW,
      });
    });

    it('does not call nextHand', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleCloseShowdown();
      });

      expect(nextHand).not.toHaveBeenCalled();
    });
  });

  describe('handleCloseCardSelector', () => {
    it('closes card selector', () => {
      const { result } = createHook();

      act(() => {
        result.current.handleCloseCardSelector();
      });

      expect(dispatchUi).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });
  });

  describe('function stability', () => {
    it('returns stable handler references when dependencies unchanged', () => {
      const { result, rerender } = createHook();

      const firstRender = {
        handleClearShowdownCards: result.current.handleClearShowdownCards,
        handleMuckSeat: result.current.handleMuckSeat,
        handleWonSeat: result.current.handleWonSeat,
        handleNextHandFromShowdown: result.current.handleNextHandFromShowdown,
        handleCloseShowdown: result.current.handleCloseShowdown,
        handleCloseCardSelector: result.current.handleCloseCardSelector,
      };

      rerender();

      expect(result.current.handleClearShowdownCards).toBe(firstRender.handleClearShowdownCards);
      expect(result.current.handleMuckSeat).toBe(firstRender.handleMuckSeat);
      expect(result.current.handleWonSeat).toBe(firstRender.handleWonSeat);
      expect(result.current.handleNextHandFromShowdown).toBe(firstRender.handleNextHandFromShowdown);
      expect(result.current.handleCloseShowdown).toBe(firstRender.handleCloseShowdown);
      expect(result.current.handleCloseCardSelector).toBe(firstRender.handleCloseCardSelector);
    });
  });
});
