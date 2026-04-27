// @vitest-environment jsdom
/**
 * useAnchorObservationCapture.test.js
 *
 * EAL Phase 6 Stream D B3 — Session 15.
 *
 * Tests orchestrator contract:
 *   - openCapture / closeCapture toggle isOpen
 *   - save runs captureObservation pure-util, dispatches OBSERVATION_CAPTURED + DRAFT_CLEARED
 *   - save propagates writer validation errors without dispatching
 *   - save respects enrollment state (drives contributesToCalibration via writer)
 *   - discard dispatches DRAFT_CLEARED + closes modal
 *   - closeCapture does NOT clear the draft (Keep-for-later default)
 *   - isEnrolled reflects global enrollment
 *
 * Mocks `useAnchorLibrary` + `useAnchorObservationDraft` so tests focus on
 * the orchestrator's coordination, not on what the inner pieces already
 * verify in their own suites.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

vi.mock('../../contexts/AnchorLibraryContext', () => ({
  useAnchorLibrary: vi.fn(),
}));
vi.mock('../useAnchorObservationDraft', () => ({
  useAnchorObservationDraft: vi.fn(),
}));

import { useAnchorLibrary } from '../../contexts/AnchorLibraryContext';
import { useAnchorObservationDraft } from '../useAnchorObservationDraft';
import { useAnchorObservationCapture } from '../useAnchorObservationCapture';

const FIXED_NOW = '2026-04-27T12:00:00.000Z';

const makeContext = ({
  enrolled = true,
  dispatch = vi.fn(),
} = {}) => ({
  dispatchAnchorLibrary: dispatch,
  enrollment: {
    observation_enrollment_state: enrolled ? 'enrolled' : 'not-enrolled',
  },
  isEnrolled: () => enrolled,
});

const makeDraftHook = ({
  draft = null,
  clearDraft = vi.fn(),
  updateDraft = vi.fn(),
} = {}) => ({
  draft,
  hasDraft: draft !== null,
  updateDraft,
  clearDraft,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────────────────
// Modal state
// ───────────────────────────────────────────────────────────────────────────

describe('modal open/close state', () => {
  it('starts closed', () => {
    useAnchorLibrary.mockReturnValue(makeContext());
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() => useAnchorObservationCapture({ handId: 'h-1' }));
    expect(result.current.isOpen).toBe(false);
  });

  it('openCapture sets isOpen=true', () => {
    useAnchorLibrary.mockReturnValue(makeContext());
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() => useAnchorObservationCapture({ handId: 'h-1' }));
    act(() => {
      result.current.openCapture();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('closeCapture sets isOpen=false WITHOUT clearing draft', () => {
    const clearDraft = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext());
    useAnchorObservationDraft.mockReturnValue(makeDraftHook({
      draft: { id: 'draft:h-1', handId: 'h-1', note: 'wip' },
      clearDraft,
    }));
    const { result } = renderHook(() => useAnchorObservationCapture({ handId: 'h-1' }));
    act(() => {
      result.current.openCapture();
    });
    act(() => {
      result.current.closeCapture();
    });
    expect(result.current.isOpen).toBe(false);
    expect(clearDraft).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Save — pure-writer composition + dispatch sequence
// ───────────────────────────────────────────────────────────────────────────

describe('save', () => {
  it('returns ok with record + dispatches OBSERVATION_CAPTURED then DRAFT_CLEARED', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: true, dispatch }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() =>
      useAnchorObservationCapture({ handId: 'h-1', nowFn: () => FIXED_NOW }),
    );

    let outcome;
    act(() => {
      outcome = result.current.save({
        ownerTags: ['villain-overfold'],
        note: 'flush board overfold',
        streetKey: 'river',
      });
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.record).toMatchObject({
      id: 'obs:h-1:0',
      handId: 'h-1',
      ownerTags: ['villain-overfold'],
      note: 'flush board overfold',
      streetKey: 'river',
      origin: 'owner-captured',
      contributesToCalibration: true, // enrolled + no incognito flag
      createdAt: FIXED_NOW,
    });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toEqual({
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: outcome.record },
    });
    expect(dispatch.mock.calls[1][0]).toEqual({
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED,
      payload: { handId: 'h-1' },
    });
  });

  it('forces contributesToCalibration=false when not-enrolled (I-WR-5)', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: false, dispatch }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() =>
      useAnchorObservationCapture({ handId: 'h-1', nowFn: () => FIXED_NOW }),
    );

    let outcome;
    act(() => {
      outcome = result.current.save({
        ownerTags: ['villain-overfold'],
        // Note: caller passes contributesToCalibration=true; writer should override
        contributesToCalibration: true,
      });
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.record.contributesToCalibration).toBe(false);
  });

  it('honors caller-supplied incognito flag when enrolled (I-WR-6)', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: true, dispatch }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() =>
      useAnchorObservationCapture({ handId: 'h-1', nowFn: () => FIXED_NOW }),
    );

    let outcome;
    act(() => {
      outcome = result.current.save({
        ownerTags: ['villain-overfold'],
        contributesToCalibration: false,
      });
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.record.contributesToCalibration).toBe(false);
  });

  it('returns errors + does NOT dispatch when validation fails', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: true, dispatch }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() =>
      useAnchorObservationCapture({ handId: 'h-1', nowFn: () => FIXED_NOW }),
    );

    let outcome;
    act(() => {
      outcome = result.current.save({
        ownerTags: [], // missing required ≥1 fixed-enum tag
      });
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.length).toBeGreaterThan(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns error when handId is missing', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: true, dispatch }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() => useAnchorObservationCapture({}));

    let outcome;
    act(() => {
      outcome = result.current.save({
        ownerTags: ['villain-overfold'],
      });
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toContain('handId is required');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('uses observationIndex to build deterministic id', () => {
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: true, dispatch }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result } = renderHook(() =>
      useAnchorObservationCapture({ handId: 'h-1', observationIndex: 3, nowFn: () => FIXED_NOW }),
    );

    let outcome;
    act(() => {
      outcome = result.current.save({
        ownerTags: ['villain-overfold'],
      });
    });

    expect(outcome.record.id).toBe('obs:h-1:3');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Discard
// ───────────────────────────────────────────────────────────────────────────

describe('discard', () => {
  it('calls draft.clearDraft and closes the modal', () => {
    const clearDraft = vi.fn();
    const dispatch = vi.fn();
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: true, dispatch }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook({
      draft: { id: 'draft:h-1', handId: 'h-1', note: 'wip' },
      clearDraft,
    }));
    const { result } = renderHook(() => useAnchorObservationCapture({ handId: 'h-1' }));

    act(() => {
      result.current.openCapture();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.discard();
    });
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
    // discard should NOT dispatch OBSERVATION_CAPTURED
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Re-exports + enrollment
// ───────────────────────────────────────────────────────────────────────────

describe('re-exports + enrollment', () => {
  it('re-exports draft + hasDraft + updateDraft from the inner draft hook', () => {
    const updateDraft = vi.fn();
    const draft = { id: 'draft:h-1', handId: 'h-1', note: 'wip' };
    useAnchorLibrary.mockReturnValue(makeContext());
    useAnchorObservationDraft.mockReturnValue(makeDraftHook({ draft, updateDraft }));
    const { result } = renderHook(() => useAnchorObservationCapture({ handId: 'h-1' }));

    expect(result.current.draft).toEqual(draft);
    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.updateDraft({ note: 'changed' });
    });
    expect(updateDraft).toHaveBeenCalledWith({ note: 'changed' });
  });

  it('isEnrolled mirrors context isEnrolled selector', () => {
    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: true }));
    useAnchorObservationDraft.mockReturnValue(makeDraftHook());
    const { result: enrolled } = renderHook(() =>
      useAnchorObservationCapture({ handId: 'h-1' }),
    );
    expect(enrolled.current.isEnrolled).toBe(true);

    useAnchorLibrary.mockReturnValue(makeContext({ enrolled: false }));
    const { result: notEnrolled } = renderHook(() =>
      useAnchorObservationCapture({ handId: 'h-1' }),
    );
    expect(notEnrolled.current.isEnrolled).toBe(false);
  });
});
