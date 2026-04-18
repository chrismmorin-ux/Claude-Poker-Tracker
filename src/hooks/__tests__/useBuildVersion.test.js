// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBuildVersion } from '../useBuildVersion';

const makeResponse = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
});

describe('useBuildVersion', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('returns nulls before the first fetch resolves', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useBuildVersion({ enabled: true }));
    expect(result.current.currentVersion).toBeNull();
    expect(result.current.latestVersion).toBeNull();
    expect(result.current.updateAvailable).toBe(false);
  });

  it('populates currentVersion on first fetch and marks up-to-date', async () => {
    fetchMock.mockResolvedValue(makeResponse({ version: 'abc1234', built: '2026-04-17T23:00:00Z' }));
    const { result } = renderHook(() => useBuildVersion({ enabled: true }));

    await waitFor(() => expect(result.current.currentVersion).toBe('abc1234'));
    expect(result.current.latestVersion).toBe('abc1234');
    expect(result.current.currentBuiltAt).toBe('2026-04-17T23:00:00Z');
    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('flips updateAvailable when polled version differs from current', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ version: 'abc1234', built: '2026-04-17T23:00:00Z' }))
      .mockResolvedValue(makeResponse({ version: 'def5678', built: '2026-04-18T10:00:00Z' }));

    const { result } = renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 20 }));
    await waitFor(() => expect(result.current.currentVersion).toBe('abc1234'));
    await waitFor(() => expect(result.current.latestVersion).toBe('def5678'), { timeout: 1000 });
    expect(result.current.currentVersion).toBe('abc1234'); // pinned to first-seen
    expect(result.current.updateAvailable).toBe(true);
  });

  it('is disabled in dev by default (skips polling)', () => {
    // Vitest sets import.meta.env.DEV = true, so the hook should not fetch.
    renderHook(() => useBuildVersion());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces fetch errors and recovers on next successful poll', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(makeResponse({ version: 'xyz9999', built: null }));

    const { result } = renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 20 }));
    await waitFor(() => expect(result.current.currentVersion).toBe('xyz9999'), { timeout: 1000 });
    expect(result.current.error).toBeNull();
  });

  it('treats malformed version.json as an error', async () => {
    fetchMock.mockResolvedValue(makeResponse({ notAVersion: true }));
    const { result } = renderHook(() => useBuildVersion({ enabled: true }));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.currentVersion).toBeNull();
  });

  it('clears its interval on unmount', () => {
    fetchMock.mockResolvedValue(makeResponse({ version: 'abc1234', built: null }));
    const clearSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 1000 }));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
