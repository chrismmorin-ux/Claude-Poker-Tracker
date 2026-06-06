// @vitest-environment jsdom
/**
 * usePersistence.test.js - Tests for persistence hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersistence } from '../usePersistence';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../../constants/playerConstants';
import {
  createMockGameState,
  createMockCardState,
  createMockPlayerState,
  createMockHandRecord,
  createMockDispatchers,
} from '../../test/utils';

// Mock the persistence module
vi.mock('../../utils/persistence/index', () => ({
  initDB: vi.fn(() => Promise.resolve()),
  saveHand: vi.fn(() => Promise.resolve(1)),
  loadLatestHand: vi.fn(() => Promise.resolve(null)),
  GUEST_USER_ID: 'guest',
  createPersistenceLogger: () => ({ log: vi.fn(), logError: vi.fn() }),
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

import { initDB, saveHand, loadLatestHand } from '../../utils/persistence/index';

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
      dispatchPlayer: dispatchers.dispatchPlayer,
      userId: undefined,
      engineCtxGetterRef: undefined,
      ...overrides,
    };
    return renderHook(() =>
      usePersistence(
        params.gameState,
        params.cardState,
        params.playerState,
        params.dispatchGame,
        params.dispatchCard,
        params.dispatchPlayer,
        params.userId,
        params.engineCtxGetterRef,
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
        // WS-190: reviewTag is merged into the hydrate payload (stored top-level
        // on the record, not inside the saved gameState subset) so the live tag
        // flag restores across reload. Absent on this mock record → null.
        payload: { ...mockHand.gameState, reviewTag: null },
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

  describe('predictionAudit reconstruction (PMC Phase 5a + 5a-2)', () => {
    const handDataWithAction = () => createMockGameState({
      currentStreet: 'preflop',
      mySeat: 2,
      dealerButtonSeat: 1,
      actionSequence: [
        { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
      ],
    });

    it('attaches predictionAudit with empty predictedDistribution when no engineCtxGetterRef is provided', async () => {
      gameState = handDataWithAction();
      const { rerender } = createHook({ gameState });

      await act(async () => { await vi.runAllTimersAsync(); });
      vi.mocked(saveHand).mockClear();

      gameState = createMockGameState({
        currentStreet: 'flop',
        mySeat: 2,
        dealerButtonSeat: 1,
        actionSequence: handDataWithAction().actionSequence,
      });
      rerender();

      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

      expect(saveHand).toHaveBeenCalled();
      const saved = vi.mocked(saveHand).mock.calls[0][0];
      expect(saved.predictionAudit).toBeDefined();
      expect(saved.predictionAudit).not.toBeNull();
      expect(saved.predictionAudit.predictedDistribution).toEqual([]);
      expect(saved.predictionAudit.observedAction).toHaveLength(1);
      expect(typeof saved.predictionAudit.modelVersion).toBe('string');
    });

    it('populates predictedDistribution when engineCtxGetterRef returns engine context', async () => {
      // Build a rangeProfile keyed by 'BB' (offset 2 from button seat 1 → seat 3 is BB).
      const grid = new Float64Array(169);
      for (let i = 0; i < 169; i++) grid[i] = 30 / 169;
      const grid2 = new Float64Array(169);
      for (let i = 0; i < 169; i++) grid2[i] = 20 / 169;
      const rangeProfile = { ranges: { BB: { open: grid, coldCall: grid2 } } };
      const engineCtxGetterRef = {
        current: () => ({
          getRangeProfile: (playerId) => rangeProfile,
          evaluateGameTree: undefined,
        }),
      };

      // seatPlayers must map seat 3 → some playerId so actorId resolves.
      playerState = createMockPlayerState({ seatPlayers: { 3: 99 } });
      gameState = handDataWithAction();
      const { rerender } = createHook({ gameState, playerState, engineCtxGetterRef });

      await act(async () => { await vi.runAllTimersAsync(); });
      vi.mocked(saveHand).mockClear();

      gameState = createMockGameState({
        currentStreet: 'flop',
        mySeat: 2,
        dealerButtonSeat: 1,
        actionSequence: handDataWithAction().actionSequence,
      });
      rerender();

      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

      expect(saveHand).toHaveBeenCalled();
      const saved = vi.mocked(saveHand).mock.calls[0][0];
      expect(saved.predictionAudit.predictedDistribution).toHaveLength(1);
      const entry = saved.predictionAudit.predictedDistribution[0];
      expect(entry.actor).toBe('villain');
      expect(entry.distribution.length).toBeGreaterThan(0);
      const total = entry.distribution.reduce((s, d) => s + d.weight, 0);
      expect(total).toBeCloseTo(1.0, 6);
    });

    it('falls back gracefully when engineCtxGetterRef.current() returns null mid-save', async () => {
      const engineCtxGetterRef = { current: () => null };
      gameState = handDataWithAction();
      const { rerender } = createHook({ gameState, engineCtxGetterRef });

      await act(async () => { await vi.runAllTimersAsync(); });
      vi.mocked(saveHand).mockClear();

      gameState = createMockGameState({
        currentStreet: 'flop',
        mySeat: 2,
        dealerButtonSeat: 1,
        actionSequence: handDataWithAction().actionSequence,
      });
      rerender();

      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

      expect(saveHand).toHaveBeenCalled();
      const saved = vi.mocked(saveHand).mock.calls[0][0];
      expect(saved.predictionAudit).toBeDefined();
      expect(saved.predictionAudit.predictedDistribution).toEqual([]);
    });
  });

  describe('return values', () => {
    it('returns isReady boolean', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.isReady).toBe('boolean');
      unmount();
    });

    it('returns lastSavedAt (initially null)', async () => {
      const { result, unmount } = createHook();

      expect(result.current.lastSavedAt).toBeNull();
      unmount();
    });
  });
});
