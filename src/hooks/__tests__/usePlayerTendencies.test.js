// @vitest-environment jsdom
/**
 * usePlayerTendencies.test.js - Tests for player tendency calculation hook
 *
 * Tests loading state, lazy recalculation, empty data handling.
 * classifyStyle is tested separately in classifyStyle.test.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock persistence
vi.mock('../../utils/persistence/index', () => ({
  getAllHands: vi.fn(() => Promise.resolve([])),
  getHandCount: vi.fn(() => Promise.resolve(0)),
  getRangeProfile: vi.fn(() => Promise.resolve(null)),
  saveRangeProfile: vi.fn(() => Promise.resolve()),
  GUEST_USER_ID: 'guest',
}));

// Mock heavy computation modules
vi.mock('../../utils/tendencyCalculations', () => ({
  buildPlayerStats: vi.fn(() => ({
    handsPlayed: 0, vpipCount: 0, pfr: 0, totalBets: 0, totalCalls: 0,
    threeBetCount: 0, threeBetOpportunity: 0, cbetCount: 0, cbetOpportunity: 0,
  })),
  derivePercentages: vi.fn(() => ({
    vpip: null, pfr: null, af: null, threeBet: null, cbet: null, sampleSize: 0,
  })),
  classifyStyle: vi.fn(() => null),
}));

vi.mock('../../utils/exploitEngine/positionStats', () => ({
  buildPositionStats: vi.fn(() => ({})),
}));

vi.mock('../../utils/sessionStats', () => ({
  countLimps: vi.fn(() => ({ limpCount: 0, limpOpportunity: 0, limpPct: null })),
}));

vi.mock('../../utils/rangeEngine', () => ({
  buildRangeProfile: vi.fn(() => null),
  getRangeWidthSummary: vi.fn(() => null),
  getSubActionSummary: vi.fn(() => null),
  PROFILE_VERSION: 1,
}));

vi.mock('../../utils/exploitEngine/generateExploits', () => ({
  generateExploits: vi.fn(() => []),
}));

vi.mock('../../utils/persistence/playersStorage', () => ({
  getAllPlayers: vi.fn(() => Promise.resolve([])),
  updatePlayer: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../utils/exploitEngine/briefingMerge', () => ({
  mergeBriefings: vi.fn(() => []),
}));

vi.mock('../../utils/analysisPipeline', () => ({
  runAnalysisPipeline: vi.fn((playerId) => ({
    pct: { vpip: 25, pfr: 18, af: 2.0, threeBet: 5, cbet: 65, sampleSize: 10 },
    rawStats: {},
    positionStats: {},
    limpData: {},
    style: 'TAG',
    exploits: [],
    briefings: [],
    rangeProfile: null,
    rangeSummary: null,
    subActionSummary: null,
    decisionSummary: null,
    villainModel: null,
    villainProfile: null,
    weaknesses: [],
    observations: [],
    thoughtAnalysis: null,
  })),
}));

import { usePlayerTendencies } from '../usePlayerTendencies';
import { getAllHands, getHandCount } from '../../utils/persistence/index';
import { getAllPlayers as getAllPlayersFromDB } from '../../utils/persistence/playersStorage';
import { runAnalysisPipeline } from '../../utils/analysisPipeline';
import { derivePercentages } from '../../utils/tendencyCalculations';

const EMPTY_PLAYERS = [];

describe('usePlayerTendencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty tendencyMap when no players', async () => {
    const { result } = renderHook(() => usePlayerTendencies(EMPTY_PLAYERS, 'guest'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tendencyMap).toEqual({});
  });

  it('returns empty tendencyMap when players is null', async () => {
    const { result } = renderHook(() => usePlayerTendencies(null, 'guest'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tendencyMap).toEqual({});
  });

  it('sets isLoading during calculation', async () => {
    let resolveHands;
    getAllHands.mockReturnValue(new Promise(resolve => { resolveHands = resolve; }));

    const players = [{ playerId: 1, name: 'Alice' }];
    const { result } = renderHook(() => usePlayerTendencies(players, 'guest'));

    // Should be loading
    expect(result.current.isLoading).toBe(true);

    // Resolve
    resolveHands([]);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('computes tendencyMap with player entries', async () => {
    getAllHands.mockResolvedValue([{ handId: 1 }]);
    derivePercentages.mockReturnValue({
      vpip: 25, pfr: 18, af: 2.0, threeBet: 5, cbet: 65, sampleSize: 30,
    });

    const players = [
      { playerId: 1, name: 'Alice' },
      { playerId: 2, name: 'Bob' },
    ];

    const { result } = renderHook(() => usePlayerTendencies(players, 'guest'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tendencyMap).toHaveProperty('1');
    expect(result.current.tendencyMap).toHaveProperty('2');
    expect(result.current.tendencyMap[1].vpip).toBe(25);
  });

  it('provides refresh function', async () => {
    getAllHands.mockResolvedValue([]);
    const players = [{ playerId: 1, name: 'Alice' }];

    const { result } = renderHook(() => usePlayerTendencies(players, 'guest'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refresh).toBe('function');
  });

  it('handles persistence errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAllHands.mockRejectedValue(new Error('DB failed'));

    const players = [{ playerId: 1, name: 'Alice' }];
    const { result } = renderHook(() => usePlayerTendencies(players, 'guest'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not crash, returns empty map
    expect(result.current.tendencyMap).toEqual({});
    consoleSpy.mockRestore();
  });

  // --- RT-28: Per-player memoization tests ---

  it('skips recalculation when hand count unchanged and no new players', async () => {
    getHandCount.mockResolvedValue(2);
    getAllHands.mockResolvedValue([
      { handId: 1, seatPlayers: { 1: 'p1' } },
      { handId: 2, seatPlayers: { 1: 'p1' } },
    ]);

    const players = [{ playerId: 'p1', name: 'Alice' }];
    const { result, rerender } = renderHook(
      ({ p }) => usePlayerTendencies(p, 'guest'),
      { initialProps: { p: players } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getAllHands).toHaveBeenCalledTimes(1);

    // Re-render with same player count (new array ref, same content)
    const samePlayers = [{ playerId: 'p1', name: 'Alice' }];
    rerender({ p: samePlayers });

    // Wait a tick to ensure effect had a chance to fire
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // getAllHands should NOT be called again (hand count unchanged, no new players)
    expect(getAllHands).toHaveBeenCalledTimes(1);
  });

  it('computes tendencies for newly seated player even when hand count unchanged', async () => {
    getHandCount.mockResolvedValue(3);
    getAllHands.mockResolvedValue([
      { handId: 1, seatPlayers: { 1: 'p1', 2: 'p2' } },
      { handId: 2, seatPlayers: { 1: 'p1' } },
      { handId: 3, seatPlayers: { 2: 'p2' } },
    ]);

    // Start with just p1
    const { result, rerender } = renderHook(
      ({ p }) => usePlayerTendencies(p, 'guest'),
      { initialProps: { p: [{ playerId: 'p1', name: 'Alice' }] } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tendencyMap).toHaveProperty('p1');
    expect(result.current.tendencyMap).not.toHaveProperty('p2');

    runAnalysisPipeline.mockClear();

    // Add p2 — hand count is STILL 3, but p2 is a new player
    rerender({ p: [{ playerId: 'p1', name: 'Alice' }, { playerId: 'p2', name: 'Bob' }] });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tendencyMap).toHaveProperty('p2');
    });

    // Only p2 should have been computed (p1's hand count didn't change)
    const p2Calls = runAnalysisPipeline.mock.calls.filter(c => c[0] === 'p2');
    expect(p2Calls.length).toBe(1);
  });

  it('skips expensive DB reads when no players have changed hand counts', async () => {
    getHandCount.mockResolvedValue(2);
    getAllHands.mockResolvedValue([
      { handId: 1, seatPlayers: { 1: 'p1', 2: 'p2' } },
      { handId: 2, seatPlayers: { 1: 'p1', 2: 'p2' } },
    ]);

    const players = [
      { playerId: 'p1', name: 'Alice' },
      { playerId: 'p2', name: 'Bob' },
    ];
    const { result } = renderHook(() => usePlayerTendencies(players, 'guest'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getAllPlayersFromDB).toHaveBeenCalledTimes(1);

    getAllPlayersFromDB.mockClear();
    runAnalysisPipeline.mockClear();

    // Trigger refresh — hand count unchanged
    await result.current.refresh();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // getAllPlayersFromDB should NOT be called (no changed players → early exit)
    expect(getAllPlayersFromDB).not.toHaveBeenCalled();
    expect(runAnalysisPipeline).not.toHaveBeenCalled();
  });
});
