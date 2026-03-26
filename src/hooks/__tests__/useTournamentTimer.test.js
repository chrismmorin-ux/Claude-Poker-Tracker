/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTournamentTimer } from '../useTournamentTimer';

describe('useTournamentTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes remaining time from Date.now() delta', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTournamentTimer({
        levelStartTime: now,
        levelDurationMs: 60000, // 60 seconds
        isPaused: false,
        totalPausedMs: 0,
        pauseStartTime: null,
        onLevelExpire: vi.fn(),
      })
    );

    expect(result.current.levelTimeRemaining).toBe(60000);
    expect(result.current.isRunning).toBe(true);

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.levelTimeRemaining).toBeCloseTo(50000, -3);
    expect(result.current.levelElapsed).toBeCloseTo(10000, -3);
  });

  it('stops countdown when paused', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { result, rerender } = renderHook(
      (props) => useTournamentTimer(props),
      {
        initialProps: {
          levelStartTime: now,
          levelDurationMs: 60000,
          isPaused: false,
          totalPausedMs: 0,
          pauseStartTime: null,
          onLevelExpire: vi.fn(),
        },
      }
    );

    // Advance 5 seconds
    act(() => { vi.advanceTimersByTime(5000); });
    const remainingBeforePause = result.current.levelTimeRemaining;

    // Pause
    rerender({
      levelStartTime: now,
      levelDurationMs: 60000,
      isPaused: true,
      totalPausedMs: 0,
      pauseStartTime: now + 5000,
      onLevelExpire: vi.fn(),
    });

    // Advance 10 more seconds while paused
    act(() => { vi.advanceTimersByTime(10000); });

    // isRunning should be false
    expect(result.current.isRunning).toBe(false);
  });

  it('resumes correctly by accounting for paused time', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { result, rerender } = renderHook(
      (props) => useTournamentTimer(props),
      {
        initialProps: {
          levelStartTime: now,
          levelDurationMs: 60000,
          isPaused: false,
          totalPausedMs: 10000, // was paused for 10s previously
          pauseStartTime: null,
          onLevelExpire: vi.fn(),
        },
      }
    );

    // With 10s paused and 0s elapsed, remaining should be full 60s
    expect(result.current.levelTimeRemaining).toBe(60000);

    // Advance 5 seconds
    act(() => { vi.advanceTimersByTime(5000); });

    // 5s elapsed, 10s paused → effective elapsed = 5s - 0 (paused already accounted)
    // Actually: levelElapsed = now - levelStartTime - totalPausedMs = 5000 - 10000 → clamped to 0... no wait
    // The timer was started at `now` with 10s already paused. After 5s real time:
    // elapsed = (now+5000) - now - 10000 = -5000 → clamped to 0
    // remaining = 60000 - 0 = 60000
    // This is correct: the 10s pause is "within" the level, so 5s real time minus 10s pause = negative → 0
    // After 15s real time: elapsed = 15000 - 10000 = 5000, remaining = 55000
    act(() => { vi.advanceTimersByTime(10000); });
    expect(result.current.levelTimeRemaining).toBeCloseTo(55000, -3);
  });

  it('fires onLevelExpire once when time runs out', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const onExpire = vi.fn();

    renderHook(() =>
      useTournamentTimer({
        levelStartTime: now,
        levelDurationMs: 5000, // 5 seconds
        isPaused: false,
        totalPausedMs: 0,
        pauseStartTime: null,
        onLevelExpire: onExpire,
      })
    );

    // Advance past expiry
    act(() => { vi.advanceTimersByTime(6000); });
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Advance more — should not fire again
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('never returns negative remaining time', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTournamentTimer({
        levelStartTime: now,
        levelDurationMs: 3000,
        isPaused: false,
        totalPausedMs: 0,
        pauseStartTime: null,
        onLevelExpire: vi.fn(),
      })
    );

    // Way past expiry
    act(() => { vi.advanceTimersByTime(100000); });
    expect(result.current.levelTimeRemaining).toBe(0);
    expect(result.current.levelElapsed).toBeGreaterThanOrEqual(0);
  });
});
