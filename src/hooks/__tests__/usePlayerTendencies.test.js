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

import { usePlayerTendencies } from '../usePlayerTendencies';
import { getAllHands } from '../../utils/persistence/index';
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
});
