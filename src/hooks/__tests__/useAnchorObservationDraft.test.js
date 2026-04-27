// @vitest-environment jsdom
/**
 * useAnchorObservationDraft.test.js
 *
 * EAL Phase 6 Stream D B3 — Session 15.
 *
 * Tests draft sidecar contract:
 *   - reads existing draft from state via selectDraftForHand
 *   - updateDraft merges partials, debounces 400ms, dispatches DRAFT_UPDATED
 *   - clearDraft dispatches DRAFT_CLEARED immediately + cancels pending debounce
 *   - handId change cancels in-flight debounce
 *   - unmount cancels in-flight debounce
 *
 * Mocks `useAnchorLibrary` to isolate from the Provider tree (S13 + S14
 * already cover the integration surface).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

vi.mock('../../contexts/AnchorLibraryContext', () => ({
  useAnchorLibrary: vi.fn(),
}));

import { useAnchorLibrary } from '../../contexts/AnchorLibraryContext';
import { useAnchorObservationDraft } from '../useAnchorObservationDraft';

const makeContext = ({ draft = null, dispatch = vi.fn() } = {}) => ({
  selectDraftForHand: vi.fn(() => draft),
  dispatchAnchorLibrary: dispatch,
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ───────────────────────────────────────────────────────────────────────────
// Read path
// ───────────────────────────────────────────────────────────────────────────

describe('read path', () => {
  it('returns null when no draft exists for the hand', () => {
    useAnchorLibrary.mockReturnValue(makeContext({ draft: null }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));
    expect(result.current.draft).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it('returns the existing draft when present', () => {
    const existing = { id: 'draft:hand-42', handId: 'hand-42', note: 'wip' };
    useAnchorLibrary.mockReturnValue(makeContext({ draft: existing }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));
    expect(result.current.draft).toEqual(existing);
    expect(result.current.hasDraft).toBe(true);
  });

  it('returns null when handId is empty (defensive)', () => {
    useAnchorLibrary.mockReturnValue(makeContext({ draft: null }));
    const { result } = renderHook(() => useAnchorObservationDraft(''));
    expect(result.current.draft).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// updateDraft — debounced dispatch
// ───────────────────────────────────────────────────────────────────────────

describe('updateDraft', () => {
  it('does not dispatch immediately on call', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.updateDraft({ note: 'first keystroke' });
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches DRAFT_UPDATED after 400ms debounce', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.updateDraft({ note: 'hello' });
    });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(dispatch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: { handId: 'hand-42', note: 'hello' } },
    });
  });

  it('merges multiple updates within the debounce window into a single dispatch', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.updateDraft({ ownerTags: ['villain-overfold'] });
      result.current.updateDraft({ note: 'fishy' });
      result.current.updateDraft({ streetKey: 'turn' });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: {
        draft: {
          handId: 'hand-42',
          ownerTags: ['villain-overfold'],
          note: 'fishy',
          streetKey: 'turn',
        },
      },
    });
  });

  it('resets the debounce timer on each new update (typical typing pattern)', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.updateDraft({ note: 'a' });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      result.current.updateDraft({ note: 'ab' });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // 600ms total elapsed but debounce was reset at 300ms; should not have fired
    expect(dispatch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload.draft.note).toBe('ab');
  });

  it('ignores non-object partials defensively', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.updateDraft(null);
      result.current.updateDraft(undefined);
      result.current.updateDraft('not-an-object');
      result.current.updateDraft(42);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('no-op when handId is empty (defensive)', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft(''));

    act(() => {
      result.current.updateDraft({ note: 'x' });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// clearDraft — immediate dispatch
// ───────────────────────────────────────────────────────────────────────────

describe('clearDraft', () => {
  it('dispatches DRAFT_CLEARED immediately', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.clearDraft();
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED,
      payload: { handId: 'hand-42' },
    });
  });

  it('cancels a pending updateDraft so the cleared draft is not resurrected', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.updateDraft({ note: 'will be discarded' });
    });
    act(() => {
      vi.advanceTimersByTime(200); // mid-debounce
      result.current.clearDraft();
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].type).toBe(ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED);

    // Even after the original 400ms window expires, no DRAFT_UPDATED fires
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('no-op when handId is empty (defensive)', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result } = renderHook(() => useAnchorObservationDraft(''));

    act(() => {
      result.current.clearDraft();
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Lifecycle — handId change + unmount
// ───────────────────────────────────────────────────────────────────────────

describe('lifecycle', () => {
  it('cancels pending update when handId changes', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result, rerender } = renderHook(
      ({ id }) => useAnchorObservationDraft(id),
      { initialProps: { id: 'hand-42' } },
    );

    act(() => {
      result.current.updateDraft({ note: 'pending on hand-42' });
    });
    rerender({ id: 'hand-99' });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    // The old hand's pending update was cancelled by the handId change
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('cancels pending update on unmount', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ dispatch }));
    const { result, unmount } = renderHook(() => useAnchorObservationDraft('hand-42'));

    act(() => {
      result.current.updateDraft({ note: 'unmount before flush' });
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
