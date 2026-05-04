// @vitest-environment jsdom
/**
 * @file Tests for useHeroLeakDetection — React hook lifecycle.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useHeroLeakDetection } from '../useHeroLeakDetection.js';

afterEach(() => cleanup());

describe('useHeroLeakDetection', () => {
  it('returns initial state shape with no run yet', () => {
    const { result } = renderHook(() =>
      useHeroLeakDetection('user-1', {
        runDetection: () => new Promise(() => {}), // never resolves
        countHands: async () => 50,
      }),
    );
    expect(result.current.detecting).toBe(false);
    expect(result.current.lastRunCount).toBe(0);
    expect(result.current.lastRunAt).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('runs detection on mount when count > 0', async () => {
    const runSpy = vi.fn(async () => ({ firedLeaks: [{ leakRuleId: 'x' }], heroSeat: 3, totalActions: 100, totalBuckets: 5 }));
    const countSpy = vi.fn(async () => 50);
    const { result } = renderHook(() =>
      useHeroLeakDetection('user-1', { runDetection: runSpy, countHands: countSpy }),
    );
    await waitFor(() => {
      expect(result.current.lastRunAt).not.toBeNull();
    });
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith('user-1');
    expect(result.current.firedLeaks).toEqual([{ leakRuleId: 'x' }]);
    expect(result.current.heroSeat).toBe(3);
    expect(result.current.lastRunCount).toBe(50);
    expect(result.current.error).toBeNull();
  });

  it('still runs once when count is 0 (first-time / no hands yet)', async () => {
    const runSpy = vi.fn(async () => ({ firedLeaks: [], heroSeat: null }));
    const { result } = renderHook(() =>
      useHeroLeakDetection('user-1', {
        runDetection: runSpy,
        countHands: async () => 0,
      }),
    );
    await waitFor(() => expect(result.current.lastRunAt).not.toBeNull());
    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  it('skips re-run when remounted with unchanged count (within hook instance)', async () => {
    // Note: this tests the internal lastCountRef, which lives per hook instance.
    // A re-render with same userId + same count should not re-run.
    const runSpy = vi.fn(async () => ({ firedLeaks: [], heroSeat: 1 }));
    const { result, rerender } = renderHook(
      ({ uid }) => useHeroLeakDetection(uid, {
        runDetection: runSpy,
        countHands: async () => 50,
      }),
      { initialProps: { uid: 'user-1' } },
    );
    await waitFor(() => expect(result.current.lastRunAt).not.toBeNull());
    expect(runSpy).toHaveBeenCalledTimes(1);
    // Re-render with same uid — should not re-run
    rerender({ uid: 'user-1' });
    // Give it a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null leak + does NOT run when userId is missing', () => {
    const runSpy = vi.fn();
    const countSpy = vi.fn();
    renderHook(() =>
      useHeroLeakDetection(null, {
        runDetection: runSpy,
        countHands: countSpy,
      }),
    );
    expect(runSpy).not.toHaveBeenCalled();
    expect(countSpy).not.toHaveBeenCalled();
  });

  it('surfaces error state when runDetection throws', async () => {
    const runSpy = vi.fn(async () => {
      throw new Error('synthetic detection failure');
    });
    const { result } = renderHook(() =>
      useHeroLeakDetection('user-1', {
        runDetection: runSpy,
        countHands: async () => 50,
      }),
    );
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toMatch(/synthetic detection failure/);
    expect(result.current.detecting).toBe(false);
  });
});
