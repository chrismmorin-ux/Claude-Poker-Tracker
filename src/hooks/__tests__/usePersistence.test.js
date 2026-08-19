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
  ERROR_CODES: { SAVE_FAILED: 'E302' },
}));

import { initDB, saveHand, loadLatestHand } from '../../utils/persistence/index';
import {
  getPersistenceFailureCount,
  __resetPersistenceHealth,
} from '../../utils/persistenceHealth';

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
  // ==========================================================================
  // WS-556 — a failed save must be observable, and a backgrounded page must flush
  // ==========================================================================
  describe('WS-556: save failure is observable', () => {
    // Local harness. The shared createHook() captures its params ONCE, so calling
    // rerender() re-renders with the same objects and reassigning the outer
    // `gameState` afterwards changes nothing the hook can see. These tests need a
    // state change to genuinely reach the hook, so they drive props through
    // renderHook's initialProps/rerender contract instead.
    const renderPersistence = (initialGameState) =>
      renderHook(
        ({ gs }) => usePersistence(
          gs,
          cardState,
          playerState,
          dispatchers.dispatchGame,
          dispatchers.dispatchCard,
          dispatchers.dispatchPlayer,
          undefined,
          undefined,
        ),
        { initialProps: { gs: initialGameState } },
      );

    beforeEach(() => {
      __resetPersistenceHealth();
    });

    // Mount leaves a scheduled write behind, and the next rerender's cleanup flushes it.
    // Left unsettled that stray write consumes the mocked outcome intended for the write
    // under test. Draining twice runs the timers AND the microtasks the save closure
    // awaits, so nothing is pending when the assertions start.
    const settle = async () => {
      await act(async () => {
        await vi.runAllTimersAsync();
        await vi.runAllTimersAsync();
      });
    };

    it('reports a persistence failure when the auto-save write throws', async () => {
      // Known-answer anchor. Before this change the catch ended at console.error, so
      // this count stayed 0 and HealthIndicator's 'Not saving — data at risk' fault —
      // its highest-priority state — could never fire for a write failure.
      const { rerender, unmount } = renderPersistence(createMockGameState());
      await settle();

      expect(getPersistenceFailureCount()).toBe(0);

      // Reject EVERY write in this window rather than just the next one. The mount
      // sequence can leave more than one write in flight, and the claim under test is
      // "a write that throws becomes observable" — not how many writes the harness
      // happened to schedule. Pinning the call count would be testing the harness.
      vi.mocked(saveHand).mockClear();
      vi.mocked(saveHand).mockRejectedValue(new Error('QuotaExceededError'));

      rerender({ gs: createMockGameState({ currentStreet: 'flop' }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

      expect(saveHand).toHaveBeenCalled();
      expect(getPersistenceFailureCount()).toBe(1);
      unmount();
    });

    it('clears the failure once a later save succeeds', async () => {
      // An alarm that never clears stops being read. A transient quota blip that has
      // since resolved must not pin the indicator red for the rest of the session.
      const { rerender, unmount } = renderPersistence(createMockGameState());
      await settle();

      vi.mocked(saveHand).mockClear();
      vi.mocked(saveHand).mockRejectedValue(new Error('transient'));
      rerender({ gs: createMockGameState({ currentStreet: 'flop' }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
      expect(getPersistenceFailureCount()).toBe(1);

      vi.mocked(saveHand).mockResolvedValue(2);
      rerender({ gs: createMockGameState({ currentStreet: 'turn' }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

      expect(saveHand).toHaveBeenCalled();
      expect(getPersistenceFailureCount()).toBe(0);
      unmount();
    });

    it('flushes the pending write when the page is hidden, before the debounce elapses', async () => {
      // The failure this prevents: locking the phone mid-hand. There is NO rerender in
      // that scenario — the component never unmounts and no dependency changes — so the
      // existing cleanup-on-deps-change flush never runs, and up to DEBOUNCE_DELAY of
      // the most recent action was discarded with no error at all, because the closure
      // that would have caught one never executed.
      //
      // The sequence below leaves a genuinely pending write: the rerender flushes the
      // PREVIOUS pending save and schedules a new timer, then microtasks are drained
      // WITHOUT advancing the 1500ms clock, and the mock is cleared. Anything saveHand
      // records after that point came from the visibility handler alone.
      const { rerender, unmount } = renderPersistence(createMockGameState());
      await act(async () => { await vi.runAllTimersAsync(); });

      rerender({ gs: createMockGameState({ currentStreet: 'flop' }) });
      await act(async () => { await Promise.resolve(); });   // drain microtasks, not timers

      vi.mocked(saveHand).mockClear();
      expect(saveHand).not.toHaveBeenCalled();

      const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);   // microtasks only; debounce is 1500ms
      });

      // Fired on the hide, not on the debounce — the clock never reached 1500.
      expect(saveHand).toHaveBeenCalledTimes(1);
      spy.mockRestore();
      unmount();
    });

    it('flushes the pending write on pagehide', async () => {
      const { rerender, unmount } = renderPersistence(createMockGameState());
      await act(async () => { await vi.runAllTimersAsync(); });

      rerender({ gs: createMockGameState({ currentStreet: 'river' }) });
      await act(async () => { await Promise.resolve(); });

      vi.mocked(saveHand).mockClear();
      expect(saveHand).not.toHaveBeenCalled();

      await act(async () => {
        window.dispatchEvent(new Event('pagehide'));
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(saveHand).toHaveBeenCalledTimes(1);
      unmount();
    });

  });
});
