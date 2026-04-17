// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../utils/errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    action: vi.fn(),
  },
  DEBUG: false,
  AppError: class AppError extends Error {},
  ERROR_CODES: { INVALID_INPUT: 'E201' },
}));

import { resetDBPool } from '../../utils/persistence/database';
import { initDB } from '../../utils/persistence/database';
import { getDraft, putDraft } from '../../utils/persistence/draftsStorage';
import { usePlayerDraft } from '../usePlayerDraft';

beforeEach(async () => {
  resetDBPool();
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = globalThis.window || {};
  globalThis.window.indexedDB = globalThis.indexedDB;
  await initDB();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlayerDraft — initial load', () => {
  it('reports isLoading=true initially, then settles to the stored draft or null', async () => {
    const { result } = renderHook(() => usePlayerDraft('guest'));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.draft).toBeNull();
  });

  it('loads an existing draft on mount', async () => {
    await putDraft('guest', { name: 'Mike' }, null);
    const { result } = renderHook(() => usePlayerDraft('guest'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.draft?.draft?.name).toBe('Mike');
  });
});

describe('usePlayerDraft — saveDraft (debounced)', () => {
  it('writes after the debounce window (real timers)', async () => {
    const { result } = renderHook(() => usePlayerDraft('guest', { debounceMs: 50 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.saveDraft({ name: 'Mike' }, null); });
    // Well past 50ms debounce
    await new Promise(r => setTimeout(r, 150));
    const stored = await getDraft('guest');
    expect(stored?.draft?.name).toBe('Mike');
  });

  it('coalesces rapid saveDraft calls into one write', async () => {
    const { result } = renderHook(() => usePlayerDraft('guest', { debounceMs: 50 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.saveDraft({ name: 'M' });
      result.current.saveDraft({ name: 'Mi' });
      result.current.saveDraft({ name: 'Mik' });
      result.current.saveDraft({ name: 'Mike' });
    });
    await new Promise(r => setTimeout(r, 150));
    const stored = await getDraft('guest');
    // Only the final payload survives
    expect(stored?.draft?.name).toBe('Mike');
  });
});

describe('usePlayerDraft — flushDraft (immediate)', () => {
  it('persists immediately without waiting for debounce', async () => {
    const { result } = renderHook(() => usePlayerDraft('guest', { debounceMs: 2000 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.flushDraft({ name: 'Mike' }, { seat: 3, sessionId: 1 });
    });
    const stored = await getDraft('guest');
    expect(stored?.draft?.name).toBe('Mike');
    expect(stored?.seatContext).toEqual({ seat: 3, sessionId: 1 });
  });

  it('flushes pending debounced write when called with no args', async () => {
    const { result } = renderHook(() => usePlayerDraft('guest', { debounceMs: 2000 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.saveDraft({ name: 'Mike' }); });
    // Debounce timer is running but we flush early
    await act(async () => { await result.current.flushDraft(); });
    const stored = await getDraft('guest');
    expect(stored?.draft?.name).toBe('Mike');
  });

  it('flushDraft with no pending + no args is a no-op', async () => {
    const { result } = renderHook(() => usePlayerDraft('guest'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.flushDraft(); });
    expect(await getDraft('guest')).toBeNull();
  });
});

describe('usePlayerDraft — resumeDraft', () => {
  it('returns the stored draft payload', async () => {
    await putDraft('guest', { name: 'Mike', avatarFeatures: { hair: 'hair.buzz' } }, null);
    const { result } = renderHook(() => usePlayerDraft('guest'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let resumed;
    await act(async () => { resumed = await result.current.resumeDraft(); });
    expect(resumed).toEqual({ name: 'Mike', avatarFeatures: { hair: 'hair.buzz' } });
  });

  it('returns null when no draft exists', async () => {
    const { result } = renderHook(() => usePlayerDraft('guest'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let resumed;
    await act(async () => { resumed = await result.current.resumeDraft(); });
    expect(resumed).toBeNull();
  });
});

describe('usePlayerDraft — discardDraft', () => {
  it('deletes the draft and clears local state', async () => {
    await putDraft('guest', { name: 'Mike' }, null);
    const { result } = renderHook(() => usePlayerDraft('guest'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.draft).not.toBeNull();

    await act(async () => { await result.current.discardDraft(); });
    expect(result.current.draft).toBeNull();
    expect(await getDraft('guest')).toBeNull();
  });
});

describe('usePlayerDraft — multi-user isolation', () => {
  it('keeps drafts separate per userId', async () => {
    await putDraft('guest', { name: 'Mike' }, null);
    await putDraft('u2', { name: 'Alice' }, null);
    const { result: r1 } = renderHook(() => usePlayerDraft('guest'));
    const { result: r2 } = renderHook(() => usePlayerDraft('u2'));
    await waitFor(() => expect(r1.current.isLoading).toBe(false));
    await waitFor(() => expect(r2.current.isLoading).toBe(false));
    expect(r1.current.draft.draft.name).toBe('Mike');
    expect(r2.current.draft.draft.name).toBe('Alice');
  });
});
