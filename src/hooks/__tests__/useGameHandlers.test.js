// @vitest-environment jsdom
/**
 * useGameHandlers.test.js - Tests for game action handlers hook
 *
 * Tests key flows: nextHand, resetHand, restFold, checkAround,
 * toggleAbsent, isSeatInactive, getRemainingSeats, nextStreet
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameHandlers } from '../useGameHandlers';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { UI_ACTIONS } from '../../reducers/uiReducer';
import { SESSION_ACTIONS } from '../../reducers/sessionReducer';

// Mock all context hooks
const mockDispatchGame = vi.fn();
const mockDispatchUi = vi.fn();
const mockDispatchCard = vi.fn();
const mockDispatchSession = vi.fn();
const mockOpenCardSelector = vi.fn();

let mockGameState;
let mockUiState;
let mockCardState;

vi.mock('../../contexts', () => ({
  useGame: () => ({
    currentStreet: mockGameState.currentStreet,
    mySeat: mockGameState.mySeat,
    absentSeats: mockGameState.absentSeats,
    dealerButtonSeat: mockGameState.dealerButtonSeat,
    actionSequence: mockGameState.actionSequence,
    dispatchGame: mockDispatchGame,
  }),
  useUI: () => ({
    selectedPlayers: mockUiState.selectedPlayers,
    openCardSelector: mockOpenCardSelector,
    dispatchUi: mockDispatchUi,
  }),
  useCard: () => ({
    communityCards: mockCardState.communityCards,
    holeCards: mockCardState.holeCards,
    holeCardsVisible: mockCardState.holeCardsVisible,
    allPlayerCards: mockCardState.allPlayerCards,
    dispatchCard: mockDispatchCard,
  }),
  useSession: () => ({
    dispatchSession: mockDispatchSession,
  }),
}));

vi.mock('../useSeatUtils', () => ({
  useSeatUtils: () => ({
    getFirstActionSeat: vi.fn(() => 1),
  }),
}));

vi.mock('../../utils/errorHandler', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Helper to create actionSequence entries
const entry = (seat, action, street = 'preflop', order = 1) => ({
  seat, action, street, order,
});

describe('useGameHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGameState = {
      currentStreet: 'preflop',
      mySeat: 5,
      absentSeats: [],
      dealerButtonSeat: 1,
      actionSequence: [],
    };
    mockUiState = {
      selectedPlayers: [],
    };
    mockCardState = {
      communityCards: [null, null, null, null, null],
      holeCards: [null, null],
      holeCardsVisible: false,
      allPlayerCards: {},
    };
  });

  describe('nextHand', () => {
    it('dispatches RESET_CARDS, NEXT_HAND, INCREMENT_HAND_COUNT, CLEAR_SELECTION', () => {
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.nextHand();
      });

      expect(mockDispatchCard).toHaveBeenCalledWith({ type: CARD_ACTIONS.RESET_CARDS });
      expect(mockDispatchGame).toHaveBeenCalledWith({ type: GAME_ACTIONS.NEXT_HAND });
      expect(mockDispatchSession).toHaveBeenCalledWith({ type: SESSION_ACTIONS.INCREMENT_HAND_COUNT });
      expect(mockDispatchUi).toHaveBeenCalledWith({ type: UI_ACTIONS.CLEAR_SELECTION });
    });
  });

  describe('resetHand', () => {
    it('dispatches RESET_CARDS, RESET_HAND, CLEAR_SELECTION', () => {
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.resetHand();
      });

      expect(mockDispatchCard).toHaveBeenCalledWith({ type: CARD_ACTIONS.RESET_CARDS });
      expect(mockDispatchGame).toHaveBeenCalledWith({ type: GAME_ACTIONS.RESET_HAND });
      expect(mockDispatchUi).toHaveBeenCalledWith({ type: UI_ACTIONS.CLEAR_SELECTION });
    });

    it('does not increment hand count', () => {
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.resetHand();
      });

      expect(mockDispatchSession).not.toHaveBeenCalled();
    });
  });

  describe('restFold', () => {
    it('dispatches fold for all remaining seats', () => {
      // Seats 1-9 with no actions, none absent
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        const count = result.current.restFold();
        expect(count).toBe(9);
      });

      // Should dispatch 9 fold actions
      const foldCalls = mockDispatchGame.mock.calls.filter(
        c => c[0].type === GAME_ACTIONS.RECORD_PRIMITIVE_ACTION && c[0].payload.action === 'fold'
      );
      expect(foldCalls.length).toBe(9);
      expect(mockDispatchUi).toHaveBeenCalledWith({ type: UI_ACTIONS.CLEAR_SELECTION });
    });

    it('skips absent seats', () => {
      mockGameState.absentSeats = [3, 7];
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        const count = result.current.restFold();
        expect(count).toBe(7);
      });
    });

    it('only skips aggressor — earlier callers remain to respond to raise', () => {
      mockGameState.actionSequence = [
        entry(2, 'call', 'preflop', 1),
        entry(4, 'raise', 'preflop', 2),
      ];
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        const count = result.current.restFold();
        expect(count).toBe(8);
      });
    });
  });

  describe('checkAround', () => {
    it('dispatches check for all remaining seats', () => {
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        const count = result.current.checkAround();
        expect(count).toBe(9);
      });

      const checkCalls = mockDispatchGame.mock.calls.filter(
        c => c[0].type === GAME_ACTIONS.RECORD_PRIMITIVE_ACTION && c[0].payload.action === 'check'
      );
      expect(checkCalls.length).toBe(9);
    });
  });

  describe('toggleAbsent', () => {
    it('dispatches TOGGLE_ABSENT and clears selection', () => {
      mockUiState.selectedPlayers = [3, 5];
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.toggleAbsent();
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.TOGGLE_ABSENT,
        payload: [3, 5],
      });
      expect(mockDispatchUi).toHaveBeenCalledWith({ type: UI_ACTIONS.CLEAR_SELECTION });
    });

    it('does nothing when no players selected', () => {
      mockUiState.selectedPlayers = [];
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.toggleAbsent();
      });

      expect(mockDispatchGame).not.toHaveBeenCalled();
    });
  });

  describe('isSeatInactive', () => {
    it('returns null for active seat', () => {
      const { result } = renderHook(() => useGameHandlers());
      expect(result.current.isSeatInactive(1)).toBeNull();
    });

    it('returns ABSENT for absent seat', () => {
      mockGameState.absentSeats = [4];
      const { result } = renderHook(() => useGameHandlers());
      expect(result.current.isSeatInactive(4)).toBe('absent');
    });

    it('returns FOLDED for seat with fold in actionSequence', () => {
      mockGameState.actionSequence = [entry(6, 'fold', 'preflop')];
      const { result } = renderHook(() => useGameHandlers());
      expect(result.current.isSeatInactive(6)).toBe('folded');
    });

    it('returns FOLDED for fold_to_cbet action', () => {
      mockGameState.actionSequence = [entry(6, 'fold_to_cbet', 'flop')];
      const { result } = renderHook(() => useGameHandlers());
      expect(result.current.isSeatInactive(6)).toBe('folded');
    });

    it('returns FOLDED for fold_to_cr action', () => {
      mockGameState.actionSequence = [entry(6, 'fold_to_cr', 'flop')];
      const { result } = renderHook(() => useGameHandlers());
      expect(result.current.isSeatInactive(6)).toBe('folded');
    });
  });

  describe('getRemainingSeats', () => {
    it('returns all 9 seats when none have acted', () => {
      const { result } = renderHook(() => useGameHandlers());
      expect(result.current.getRemainingSeats()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('excludes absent seats', () => {
      mockGameState.absentSeats = [1, 9];
      const { result } = renderHook(() => useGameHandlers());
      const remaining = result.current.getRemainingSeats();
      expect(remaining).not.toContain(1);
      expect(remaining).not.toContain(9);
      expect(remaining.length).toBe(7);
    });

    it('excludes aggressor but keeps earlier callers who must respond to raise', () => {
      mockGameState.actionSequence = [
        entry(2, 'call', 'preflop', 1),
        entry(5, 'raise', 'preflop', 2),
      ];
      const { result } = renderHook(() => useGameHandlers());
      const remaining = result.current.getRemainingSeats();
      expect(remaining).toContain(2); // must respond to raise
      expect(remaining).not.toContain(5); // aggressor excluded
    });
  });

  describe('nextStreet', () => {
    it('advances from preflop to flop and opens card selector', () => {
      mockGameState.currentStreet = 'preflop';
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.nextStreet();
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.SET_STREET,
        payload: 'flop',
      });
      expect(mockDispatchUi).toHaveBeenCalledWith({ type: UI_ACTIONS.CLEAR_SELECTION });
      expect(mockOpenCardSelector).toHaveBeenCalledWith('community', 0);
    });

    it('advances from flop to turn and opens card selector at index 3', () => {
      mockGameState.currentStreet = 'flop';
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.nextStreet();
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.SET_STREET,
        payload: 'turn',
      });
      expect(mockOpenCardSelector).toHaveBeenCalledWith('community', 3);
    });

    it('advances from turn to river and opens card selector at index 4', () => {
      mockGameState.currentStreet = 'turn';
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.nextStreet();
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.SET_STREET,
        payload: 'river',
      });
      expect(mockOpenCardSelector).toHaveBeenCalledWith('community', 4);
    });

    it('advances from river to showdown and opens showdown view', () => {
      mockGameState.currentStreet = 'river';
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.nextStreet();
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.SET_STREET,
        payload: 'showdown',
      });
      expect(mockDispatchUi).toHaveBeenCalledWith({ type: UI_ACTIONS.OPEN_SHOWDOWN_VIEW });
    });

    it('does nothing when already on showdown', () => {
      mockGameState.currentStreet = 'showdown';
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.nextStreet();
      });

      expect(mockDispatchGame).not.toHaveBeenCalled();
    });
  });

  describe('clearSeatActions', () => {
    it('dispatches CLEAR_SEAT_ACTIONS with seat array', () => {
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.clearSeatActions([3, 5]);
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.CLEAR_SEAT_ACTIONS,
        payload: [3, 5],
      });
    });
  });

  describe('undoLastAction', () => {
    it('dispatches UNDO_LAST_ACTION with seat number', () => {
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.undoLastAction(7);
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.UNDO_LAST_ACTION,
        payload: 7,
      });
    });
  });

  describe('handleSetMySeat', () => {
    it('dispatches SET_MY_SEAT and closes context menu', () => {
      const { result } = renderHook(() => useGameHandlers());

      act(() => {
        result.current.handleSetMySeat(3);
      });

      expect(mockDispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.SET_MY_SEAT,
        payload: 3,
      });
      expect(mockDispatchUi).toHaveBeenCalledWith({ type: UI_ACTIONS.CLOSE_CONTEXT_MENU });
    });
  });
});
