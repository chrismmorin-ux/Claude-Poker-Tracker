// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimer } from '../useSessionTimer';

describe('useSessionTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string when sessionStartTime is null', () => {
    const { result } = renderHook(() => useSessionTimer(null));
    expect(result.current).toBe('');
  });

  it('returns empty string when sessionStartTime is undefined', () => {
    const { result } = renderHook(() => useSessionTimer(undefined));
    expect(result.current).toBe('');
  });

  it('formats minutes correctly', () => {
    const thirtyMinAgo = Date.now() - 30 * 60000;
    const { result } = renderHook(() => useSessionTimer(thirtyMinAgo));
    expect(result.current).toBe('Started 30m ago');
  });

  it('formats hours correctly', () => {
    const twoHoursAgo = Date.now() - 2 * 3600000;
    const { result } = renderHook(() => useSessionTimer(twoHoursAgo));
    expect(result.current).toBe('Started 2h ago');
  });

  it('formats days correctly', () => {
    const twoDaysAgo = Date.now() - 2 * 86400000;
    const { result } = renderHook(() => useSessionTimer(twoDaysAgo));
    expect(result.current).toBe('Started 2d ago');
  });

  it('updates display after 60s interval', () => {
    const startTime = Date.now() - 5 * 60000; // 5 minutes ago
    const { result } = renderHook(() => useSessionTimer(startTime));
    expect(result.current).toBe('Started 5m ago');

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current).toBe('Started 6m ago');
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const startTime = Date.now() - 10 * 60000;
    const { unmount } = renderHook(() => useSessionTimer(startTime));

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('resets to empty when startTime changes to null', () => {
    const startTime = Date.now() - 10 * 60000;
    const { result, rerender } = renderHook(
      ({ time }) => useSessionTimer(time),
      { initialProps: { time: startTime } }
    );

    expect(result.current).toBe('Started 10m ago');

    rerender({ time: null });
    expect(result.current).toBe('');
  });
});
