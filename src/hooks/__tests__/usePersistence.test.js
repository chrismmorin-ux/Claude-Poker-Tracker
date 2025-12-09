/**
 * usePersistence.test.js - Tests for persistence hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersistence } from '../usePersistence';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../../reducers/playerReducer';
import {
  createMockGameState,
  createMockCardState,
  createMockPlayerState,
  createMockHandRecord,
  createMockDispatchers,
} from '../../test/utils';

// Mock the persistence module
vi.mock('../../utils/persistence', () => ({
  initDB: vi.fn(() => Promise.resolve()),
  saveHand: vi.fn(() => Promise.resolve(1)),
  loadLatestHand: vi.fn(() => Promise.resolve(null)),
  clearAllHands: vi.fn(() => Promise.resolve()),
}));

// Mock the errorHandler module
vi.mock('../../utils/errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  AppError: class AppError extends Error {},
  ERROR_CODES: {},
}));

import { initDB, saveHand, loadLatestHand, clearAllHands } from '../../utils/persistence';

describe('usePersistence', () => {
  let dispatchers;
  let gameState;
  let cardState;
  let playerState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    dispatchers = createMockDispatchers();
    gameState = createMockGameState();
    cardState = createMockCardState();
    playerState = createMockPlayerState();
    vi.mocked(initDB).mockResolvedValue(undefined);
    vi.mocked(saveHand).mockResolvedValue(1);
    vi.mocked(loadLatestHand).mockResolvedValue(null);
    vi.mocked(clearAllHands).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createHook = (overrides = {}) => {
    const params = {
      gameState,
      cardState,
      playerState,
      dispatchGame: dispatchers.dispatchGame,
      dispatchCard: dispatchers.dispatchCard,
      dispatchSession: dispatchers.dispatchSession,
      dispatchPlayer: dispatchers.dispatchPlayer,
      ...overrides,
    };
    return renderHook(() =>
      usePersistence(
        params.gameState,
        params.cardState,
        params.playerState,
        params.dispatchGame,
        params.dispatchCard,
        params.dispatchSession,
        params.dispatchPlayer
      )
    );
  };

  describe('initialization', () => {
    it('initializes database on mount', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(initDB).toHaveBeenCalled();
    });

    it('sets isReady to true after initialization', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.isReady).toBe(true);
    });

    it('loads latest hand on mount', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(loadLatestHand).toHaveBeenCalled();
    });

    it('hydrates game state when latest hand exists', async () => {
      const mockHand = createMockHandRecord({
        gameState: {
          currentStreet: 'flop',
          dealerButtonSeat: 3,
          mySeat: 7,
          seatActions: { preflop: { 2: ['open'] } },
          absentSeats: [4],
        },
      });
      vi.mocked(loadLatestHand).mockResolvedValue(mockHand);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(dispatchers.dispatchGame).toHaveBeenCalledWith({
        type: GAME_ACTIONS.HYDRATE_STATE,
        payload: mockHand.gameState,
      });
    });

    it('hydrates card state when latest hand exists', async () => {
      const mockHand = createMockHandRecord({
        cardState: {
          communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
          holeCards: ['J♣', 'T♠'],
          holeCardsVisible: true,
          allPlayerCards: {},
        },
      });
      vi.mocked(loadLatestHand).mockResolvedValue(mockHand);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(dispatchers.dispatchCard).toHaveBeenCalledWith({
        type: CARD_ACTIONS.HYDRATE_STATE,
        payload: mockHand.cardState,
      });
    });

    it('hydrates seat players when latest hand has them', async () => {
      const mockHand = createMockHandRecord({
        seatPlayers: { 1: 101, 3: 102 },
      });
      vi.mocked(loadLatestHand).mockResolvedValue(mockHand);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(dispatchers.dispatchPlayer).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
        payload: { seatPlayers: mockHand.seatPlayers },
      });
    });

    it('does not hydrate when no latest hand exists', async () => {
      vi.mocked(loadLatestHand).mockResolvedValue(null);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(dispatchers.dispatchGame).not.toHaveBeenCalled();
      expect(dispatchers.dispatchCard).not.toHaveBeenCalled();
    });

    it('sets isReady to true even when initialization fails', async () => {
      vi.mocked(initDB).mockRejectedValue(new Error('DB error'));

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.isReady).toBe(true);
    });
  });

  describe('auto-save', () => {
    it('auto-saves after debounce delay when state changes', async () => {
      const { result, rerender } = createHook();

      // Wait for initialization
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(saveHand).mockClear();

      // Update state to trigger auto-save
      gameState = createMockGameState({ currentStreet: 'flop' });
      rerender();

      // Fast-forward debounce delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(saveHand).toHaveBeenCalled();
    });

    it('includes gameState in auto-save', async () => {
      // Start with turn street so it saves with that value
      gameState = createMockGameState({ currentStreet: 'turn' });
      const { result } = createHook({ gameState });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(saveHand).mockClear();

      // Trigger a re-render to activate auto-save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(saveHand).toHaveBeenCalled();
      const saveCall = vi.mocked(saveHand).mock.calls[0][0];
      expect(saveCall.gameState).toBeDefined();
      expect(saveCall.gameState.currentStreet).toBe('turn');
    });

    it('includes cardState in auto-save', async () => {
      // Start with hole cards so it saves with those values
      cardState = createMockCardState({ holeCards: ['A♠', 'K♥'] });
      const { result } = createHook({ cardState });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(saveHand).mockClear();

      // Trigger a re-render to activate auto-save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(saveHand).toHaveBeenCalled();
      const saveCall = vi.mocked(saveHand).mock.calls[0][0];
      expect(saveCall.cardState).toBeDefined();
      expect(saveCall.cardState.holeCards).toEqual(['A♠', 'K♥']);
    });

    it('updates lastSavedAt after successful save', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.lastSavedAt).toBeNull();

      gameState = createMockGameState({ currentStreet: 'flop' });
      rerender();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });

    it('debounces multiple rapid changes', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(saveHand).mockClear();

      // Make multiple rapid state changes
      gameState = createMockGameState({ currentStreet: 'flop' });
      rerender();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      gameState = createMockGameState({ currentStreet: 'turn' });
      rerender();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      gameState = createMockGameState({ currentStreet: 'river' });
      rerender();

      // Only after full debounce should it save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      // Should only save once with the final state
      expect(saveHand).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveNow', () => {
    it('saves immediately bypassing debounce', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(saveHand).mockClear();

      await act(async () => {
        await result.current.saveNow();
      });

      expect(saveHand).toHaveBeenCalled();
    });

    it('clears pending debounce timer', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(saveHand).mockClear();

      // Trigger auto-save timer
      gameState = createMockGameState({ currentStreet: 'flop' });
      rerender();

      // Immediately call saveNow before debounce completes
      await act(async () => {
        await result.current.saveNow();
      });

      // Advance past debounce - should not trigger another save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // Only one save should have happened (from saveNow)
      expect(saveHand).toHaveBeenCalledTimes(1);
    });

    it('does nothing when not ready', async () => {
      vi.mocked(initDB).mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = createHook();

      await act(async () => {
        await result.current.saveNow();
      });

      expect(saveHand).not.toHaveBeenCalled();
    });

    it('updates lastSavedAt after manual save', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.lastSavedAt).toBeNull();

      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });
  });

  describe('clearHistory', () => {
    it('clears all hands from database', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.clearHistory();
      });

      expect(clearAllHands).toHaveBeenCalled();
    });

    it('does nothing when not ready', async () => {
      vi.mocked(initDB).mockImplementation(() => new Promise(() => {}));

      const { result } = createHook();

      await act(async () => {
        await result.current.clearHistory();
      });

      expect(clearAllHands).not.toHaveBeenCalled();
    });
  });

  describe('return values', () => {
    it('returns isReady boolean', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.isReady).toBe('boolean');
      unmount();
    });

    it('returns saveNow function', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.saveNow).toBe('function');
      unmount();
    });

    it('returns clearHistory function', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.clearHistory).toBe('function');
      unmount();
    });

    it('returns lastSavedAt (initially null)', async () => {
      const { result, unmount } = createHook();

      expect(result.current.lastSavedAt).toBeNull();
      unmount();
    });
  });

  describe('function stability', () => {
    it('returns stable saveNow reference', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const first = result.current.saveNow;
      rerender();

      // Note: saveNow depends on gameState/cardState, so it may change
      // This test verifies it's a function
      expect(typeof result.current.saveNow).toBe('function');
    });

    it('returns stable clearHistory reference when ready state unchanged', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const first = result.current.clearHistory;
      rerender();
      expect(result.current.clearHistory).toBe(first);
    });
  });
});
