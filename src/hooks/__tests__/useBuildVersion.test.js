// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBuildVersion } from '../useBuildVersion';
import { requestSwUpdate } from '../../utils/swUpdate';

vi.mock('../../utils/swUpdate', () => ({
  requestSwUpdate: vi.fn(async () => true),
}));

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

  // Fallback path: no build identity compiled in (unstamped bundle, or a build
  // made where `git rev-parse` failed). `current` then seeds from the first poll
  // — server-vs-server, which can only spot deploys that land AFTER this page
  // started polling. `build: null` selects that path explicitly.
  describe('without a known running build', () => {
    it('returns nulls before the first fetch resolves', () => {
      fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
      const { result } = renderHook(() => useBuildVersion({ enabled: true, build: null }));
      expect(result.current.currentVersion).toBeNull();
      expect(result.current.latestVersion).toBeNull();
      expect(result.current.updateAvailable).toBe(false);
    });

    it('populates currentVersion on first fetch and marks up-to-date', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'abc1234', built: '2026-04-17T23:00:00Z' }));
      const { result } = renderHook(() => useBuildVersion({ enabled: true, build: null }));

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

      const { result } = renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 20, build: null }));
      await waitFor(() => expect(result.current.currentVersion).toBe('abc1234'));
      await waitFor(() => expect(result.current.latestVersion).toBe('def5678'), { timeout: 1000 });
      expect(result.current.currentVersion).toBe('abc1234'); // pinned to first-seen
      expect(result.current.updateAvailable).toBe(true);
    });

    it('surfaces fetch errors and recovers on next successful poll', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(makeResponse({ version: 'xyz9999', built: null }));

      const { result } = renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 20, build: null }));
      await waitFor(() => expect(result.current.currentVersion).toBe('xyz9999'), { timeout: 1000 });
      expect(result.current.error).toBeNull();
    });

    it('treats malformed version.json as an error', async () => {
      fetchMock.mockResolvedValue(makeResponse({ notAVersion: true }));
      const { result } = renderHook(() => useBuildVersion({ enabled: true, build: null }));
      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
      expect(result.current.currentVersion).toBeNull();
    });
  });

  it('is disabled in dev by default (skips polling)', () => {
    // Vitest sets import.meta.env.DEV = true, so the hook should not fetch.
    renderHook(() => useBuildVersion());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The running bundle's SHA is the only reliable "am I stale?" signal:
  // version.json always reports the server's newest build, so seeding `current`
  // from the first poll compares the server to itself and can never detect that
  // THIS page is out of date. That gap is why an install left open across a
  // deploy never saw the update banner.
  describe('seeded from the running build', () => {
    const build = { version: 'oldsha1', built: '2026-07-23T16:15:00Z' };

    it('reports the running build as current before any fetch resolves', () => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useBuildVersion({ enabled: true, build }));
      expect(result.current.currentVersion).toBe('oldsha1');
      expect(result.current.updateAvailable).toBe(false);
    });

    it('flips updateAvailable on the FIRST poll when the server is ahead', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'newsha2', built: '2026-07-25T18:43:00Z' }));
      const { result } = renderHook(() => useBuildVersion({ enabled: true, build }));

      await waitFor(() => expect(result.current.latestVersion).toBe('newsha2'));
      expect(result.current.currentVersion).toBe('oldsha1');
      expect(result.current.updateAvailable).toBe(true);
    });

    it('stays quiet when the server matches the running build', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'oldsha1', built: '2026-07-23T16:15:00Z' }));
      const { result } = renderHook(() => useBuildVersion({ enabled: true, build }));

      await waitFor(() => expect(result.current.latestVersion).toBe('oldsha1'));
      expect(result.current.updateAvailable).toBe(false);
    });
  });

  // A phone PWA is resumed, not reloaded, and the poll interval is throttled or
  // frozen while it's backgrounded. Without a foreground re-check the hook keeps
  // serving whatever it last fetched — which is how the app could report itself
  // up to date right until a manual Force Update.
  describe('re-checks when the app comes back to the foreground', () => {
    const build = { version: 'oldsha1', built: '2026-07-23T16:15:00Z' };

    it('fetches again on visibilitychange → visible', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'oldsha1', built: null }));
      renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 10_000, build }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      // Server moves ahead while the app is backgrounded.
      fetchMock.mockResolvedValue(makeResponse({ version: 'newsha2', built: null }));
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });

    it('does not fetch when the page goes to the background', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'oldsha1', built: null }));
      renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 10_000, build }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('fetches again when the network comes back', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'oldsha1', built: null }));
      renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 10_000, build }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });

    it('asks the browser for a newer worker, not just the server for a newer version', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'oldsha1', built: null }));
      renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 10_000, build }));

      // Knowing a new build exists is useless if the new worker was never
      // fetched — the browser only re-checks sw.js on its own schedule.
      await waitFor(() => expect(requestSwUpdate).toHaveBeenCalled());
    });

    it('stops listening on unmount', async () => {
      fetchMock.mockResolvedValue(makeResponse({ version: 'oldsha1', built: null }));
      const { unmount } = renderHook(() =>
        useBuildVersion({ enabled: true, pollIntervalMs: 10_000, build })
      );
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      unmount();
      await act(async () => {
        window.dispatchEvent(new Event('online'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('reports when the last successful check happened', async () => {
    fetchMock.mockResolvedValue(makeResponse({ version: 'abc1234', built: null }));
    const { result } = renderHook(() => useBuildVersion({ enabled: true, build: null }));

    await waitFor(() => expect(result.current.lastCheckedAt).toEqual(expect.any(Number)));
    expect(Date.now() - result.current.lastCheckedAt).toBeLessThan(5000);
  });

  it('leaves lastCheckedAt null while every check is failing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useBuildVersion({ enabled: true, build: null }));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.lastCheckedAt).toBeNull();
  });

  it('clears its interval on unmount', () => {
    fetchMock.mockResolvedValue(makeResponse({ version: 'abc1234', built: null }));
    const clearSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useBuildVersion({ enabled: true, pollIntervalMs: 1000 }));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
