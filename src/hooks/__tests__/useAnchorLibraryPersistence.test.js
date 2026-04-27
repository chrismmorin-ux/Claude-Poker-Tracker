// @vitest-environment jsdom
/**
 * useAnchorLibraryPersistence.test.js
 *
 * Tests for hydration + debounced-write behavior of the anchor library
 * persistence hook.
 *
 * EAL Phase 6 Stream D B3 — Session 13.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnchorLibraryPersistence } from '../useAnchorLibraryPersistence';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

// Mock the 4 persistence wrapper modules. Each test sets per-call return values.
vi.mock('../../utils/persistence/exploitAnchorsStore', () => ({
  getAllAnchors: vi.fn(),
  putAnchor: vi.fn(),
}));

vi.mock('../../utils/persistence/anchorObservationsStore', () => ({
  getAllObservations: vi.fn(),
  putObservation: vi.fn(),
  deleteObservation: vi.fn(),
}));

vi.mock('../../utils/persistence/anchorObservationDraftsStore', () => ({
  getAllDrafts: vi.fn(),
  putDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

vi.mock('../../utils/persistence/perceptionPrimitivesStore', () => ({
  getAllPrimitives: vi.fn(),
  putPrimitive: vi.fn(),
}));

import { getAllAnchors, putAnchor } from '../../utils/persistence/exploitAnchorsStore';
import {
  getAllObservations,
  putObservation,
  deleteObservation,
} from '../../utils/persistence/anchorObservationsStore';
import {
  getAllDrafts,
  putDraft,
  deleteDraft,
} from '../../utils/persistence/anchorObservationDraftsStore';
import {
  getAllPrimitives,
  putPrimitive,
} from '../../utils/persistence/perceptionPrimitivesStore';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all reads return empty arrays; all writes resolve void
  getAllAnchors.mockResolvedValue([]);
  getAllObservations.mockResolvedValue([]);
  getAllDrafts.mockResolvedValue([]);
  getAllPrimitives.mockResolvedValue([]);
  putAnchor.mockResolvedValue();
  putObservation.mockResolvedValue();
  deleteObservation.mockResolvedValue();
  putDraft.mockResolvedValue();
  deleteDraft.mockResolvedValue();
  putPrimitive.mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
});

const baseState = () => ({
  anchors: {},
  observations: {},
  drafts: {},
  primitives: {},
  enrollment: { observation_enrollment_state: 'not-enrolled' },
  schemaVersion: '1.0.0',
});

// ───────────────────────────────────────────────────────────────────────────
// Hydration
// ───────────────────────────────────────────────────────────────────────────

describe('hydration on mount', () => {
  it('calls all 4 wrapper getAlls in parallel', async () => {
    const dispatch = vi.fn();
    renderHook(() => useAnchorLibraryPersistence(baseState(), dispatch));

    await waitFor(() => {
      expect(getAllAnchors).toHaveBeenCalled();
      expect(getAllObservations).toHaveBeenCalled();
      expect(getAllDrafts).toHaveBeenCalled();
      expect(getAllPrimitives).toHaveBeenCalled();
    });
  });

  it('dispatches ANCHOR_LIBRARY_HYDRATED with all 4 slices', async () => {
    const dispatch = vi.fn();
    getAllAnchors.mockResolvedValue([{ id: 'a-1', status: 'active' }]);
    getAllObservations.mockResolvedValue([{ id: 'obs:1' }]);
    getAllDrafts.mockResolvedValue([{ id: 'draft:hand-42' }]);
    getAllPrimitives.mockResolvedValue([{ id: 'PP-01' }]);

    renderHook(() => useAnchorLibraryPersistence(baseState(), dispatch));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
        payload: expect.objectContaining({
          anchors: [{ id: 'a-1', status: 'active' }],
          observations: [{ id: 'obs:1' }],
          drafts: [{ id: 'draft:hand-42' }],
          primitives: [{ id: 'PP-01' }],
        }),
      });
    });
  });

  it('marks isReady true after hydration completes', async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useAnchorLibraryPersistence(baseState(), dispatch));

    expect(result.current.isReady).toBe(false);
    await waitFor(() => expect(result.current.isReady).toBe(true));
  });

  it('marks isReady true even when hydration fails (app remains usable)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dispatch = vi.fn();
    getAllAnchors.mockRejectedValue(new Error('IDB error'));

    const { result } = renderHook(() => useAnchorLibraryPersistence(baseState(), dispatch));

    await waitFor(() => expect(result.current.isReady).toBe(true));
    errorSpy.mockRestore();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Debounced writes
// ───────────────────────────────────────────────────────────────────────────

describe('debounced writes after hydration', () => {
  const renderWithStateChanges = async (initialState, ...subsequentStates) => {
    const dispatch = vi.fn();
    const { rerender, result } = renderHook(
      ({ state }) => useAnchorLibraryPersistence(state, dispatch),
      { initialProps: { state: initialState } },
    );
    // Wait for hydration
    await waitFor(() => expect(result.current.isReady).toBe(true));
    // Apply subsequent state updates
    for (const next of subsequentStates) {
      rerender({ state: next });
    }
    return { dispatch };
  };

  it('does not write before hydration completes', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    // Block hydration by leaving the read promise unresolved
    let resolveAnchors;
    getAllAnchors.mockReturnValue(new Promise((res) => { resolveAnchors = res; }));

    renderHook(() => useAnchorLibraryPersistence(baseState(), dispatch));

    // Advance well past debounce; no writes should have fired since hydration isn't done
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(putAnchor).not.toHaveBeenCalled();
    expect(putObservation).not.toHaveBeenCalled();

    // Cleanup: resolve hydration
    resolveAnchors([]);
    vi.useRealTimers();
  });

  it('writes new anchor 400ms after state change', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();

    const initial = baseState();
    const { rerender, result } = renderHook(
      ({ state }) => useAnchorLibraryPersistence(state, dispatch),
      { initialProps: { state: initial } },
    );

    // Wait for hydration with timers running normally
    await vi.waitFor(() => expect(result.current.isReady).toBe(true));

    const next = {
      ...initial,
      anchors: { 'a-1': { id: 'a-1', status: 'active' } },
    };
    rerender({ state: next });

    // Before debounce expires
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(putAnchor).not.toHaveBeenCalled();

    // After debounce expires
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await vi.waitFor(() => expect(putAnchor).toHaveBeenCalledWith({ id: 'a-1', status: 'active' }));
    vi.useRealTimers();
  });

  it('writes new observation on state change', async () => {
    const initial = baseState();
    const next = {
      ...initial,
      observations: { 'obs:hand-42:0': { id: 'obs:hand-42:0', handId: 'hand-42' } },
    };
    await renderWithStateChanges(initial, next);

    await waitFor(() => {
      expect(putObservation).toHaveBeenCalledWith({ id: 'obs:hand-42:0', handId: 'hand-42' });
    });
  });

  it('calls deleteObservation when an observation is removed from state', async () => {
    const obs = { id: 'obs:hand-42:0', handId: 'hand-42' };
    const initial = { ...baseState(), observations: { 'obs:hand-42:0': obs } };
    const next = { ...initial, observations: {} };

    // Pre-hydrate with the existing observation
    getAllObservations.mockResolvedValue([obs]);
    await renderWithStateChanges(initial, next);

    await waitFor(() => {
      expect(deleteObservation).toHaveBeenCalledWith('obs:hand-42:0');
    });
  });

  it('writes new draft on DRAFT_UPDATED-style state change', async () => {
    const initial = baseState();
    const next = {
      ...initial,
      drafts: { 'draft:hand-42': { id: 'draft:hand-42', handId: 'hand-42', note: 'in progress' } },
    };
    await renderWithStateChanges(initial, next);

    await waitFor(() => {
      expect(putDraft).toHaveBeenCalledWith(expect.objectContaining({
        id: 'draft:hand-42',
        handId: 'hand-42',
      }));
    });
  });

  it('calls deleteDraft when a draft key is removed (DRAFT_CLEARED)', async () => {
    const draft = { id: 'draft:hand-42', handId: 'hand-42' };
    const initial = { ...baseState(), drafts: { 'draft:hand-42': draft } };
    const next = { ...initial, drafts: {} };

    getAllDrafts.mockResolvedValue([draft]);
    await renderWithStateChanges(initial, next);

    await waitFor(() => {
      expect(deleteDraft).toHaveBeenCalledWith('hand-42');
    });
  });

  it('writes updated primitive on state change', async () => {
    const initial = baseState();
    const next = {
      ...initial,
      primitives: { 'PP-01': { id: 'PP-01', validityScore: { pointEstimate: 0.7 } } },
    };
    await renderWithStateChanges(initial, next);

    await waitFor(() => {
      expect(putPrimitive).toHaveBeenCalledWith({
        id: 'PP-01',
        validityScore: { pointEstimate: 0.7 },
      });
    });
  });

  it('does not re-write unchanged anchors when only observations change', async () => {
    const anchor = { id: 'a-1', status: 'active' };
    const initial = { ...baseState(), anchors: { 'a-1': anchor } };
    const next = {
      ...initial,
      observations: { 'obs:1': { id: 'obs:1', handId: 'h-1' } },
    };

    getAllAnchors.mockResolvedValue([anchor]);
    await renderWithStateChanges(initial, next);

    await waitFor(() => {
      expect(putObservation).toHaveBeenCalled();
    });
    // Anchor unchanged; should not re-write
    expect(putAnchor).not.toHaveBeenCalled();
  });
});
