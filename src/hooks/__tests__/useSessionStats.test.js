// @vitest-environment jsdom
/**
 * useSessionStats.test.js - Tests for session-scoped stats hook
 *
 * Tests empty state, computation, lazy recalc, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock persistence
vi.mock('../../utils/persistence/index', () => ({
  getHandsBySessionId: vi.fn(() => Promise.resolve([])),
}));

// Mock stats builder
vi.mock('../../utils/sessionStats', () => ({
  buildSessionStats: vi.fn(() => ({})),
}));

import { useSessionStats } from '../useSessionStats';
import { getHandsBySessionId } from '../../utils/persistence/index';
import { buildSessionStats } from '../../utils/sessionStats';

const EMPTY_SEAT_PLAYERS = {};

describe('useSessionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty seatStats when no sessionId', async () => {
    const { result } = renderHook(() => useSessionStats(null, EMPTY_SEAT_PLAYERS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.seatStats).toEqual({});
    expect(getHandsBySessionId).not.toHaveBeenCalled();
  });

  it('fetches hands and computes stats for session', async () => {
    const mockHands = [
      { handId: 1, sessionId: 42 },
      { handId: 2, sessionId: 42 },
    ];
    const mockStats = {
      3: { vpip: 30, pfr: 20, sampleSize: 2 },
      5: { vpip: 50, pfr: 10, sampleSize: 2 },
    };
    getHandsBySessionId.mockResolvedValue(mockHands);
    buildSessionStats.mockReturnValue(mockStats);

    const seatPlayers = { 3: 1, 5: 2 };
    const { result } = renderHook(() => useSessionStats(42, seatPlayers));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getHandsBySessionId).toHaveBeenCalledWith(42);
    expect(buildSessionStats).toHaveBeenCalledWith(mockHands, seatPlayers);
    expect(result.current.seatStats).toEqual(mockStats);
  });

  it('sets isLoading during calculation', async () => {
    let resolveHands;
    getHandsBySessionId.mockReturnValue(new Promise(resolve => { resolveHands = resolve; }));

    const { result } = renderHook(() => useSessionStats(1, EMPTY_SEAT_PLAYERS));

    expect(result.current.isLoading).toBe(true);

    resolveHands([]);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('handles missing seatPlayers gracefully', async () => {
    getHandsBySessionId.mockResolvedValue([{ handId: 1 }]);
    buildSessionStats.mockReturnValue({});

    const { result } = renderHook(() => useSessionStats(5, undefined));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(buildSessionStats).toHaveBeenCalledWith([{ handId: 1 }], undefined);
  });

  it('handles persistence errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getHandsBySessionId.mockRejectedValue(new Error('DB error'));

    const { result } = renderHook(() => useSessionStats(1, EMPTY_SEAT_PLAYERS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.seatStats).toEqual({});
    consoleSpy.mockRestore();
  });
});
