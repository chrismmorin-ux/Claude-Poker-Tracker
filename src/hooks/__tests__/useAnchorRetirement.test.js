/**
 * useAnchorRetirement.test.js — orchestrator hook coverage.
 *
 * EAL Phase 6 — Session 21 (S21).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnchorRetirement, buildOverridePayload } from '../useAnchorRetirement';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

const sampleAnchor = {
  id: 'anchor:test:1',
  archetypeName: 'Nit Over-Fold',
  status: 'active',
  operator: { dialCurve: 'sigmoid(k=8)', currentDial: 0.5 },
};

const FIXED_TS = '2026-04-28T18:00:00.000Z';

const buildToastDouble = () => ({
  addToast: vi.fn(),
  dismissToast: vi.fn(),
  showInfo: vi.fn(),
  showError: vi.fn(),
});

describe('buildOverridePayload (pure helper)', () => {
  const buildCopy = (action) => ({
    action,
    targetStatus: action === 'retire' ? 'retired' : action === 'suppress' ? 'suppressed' : null,
    overrideReason: `manual-${action}`,
  });

  it('Retire: status → retired + operator stamped', () => {
    const updated = buildOverridePayload(sampleAnchor, buildCopy('retire'), FIXED_TS);
    expect(updated.status).toBe('retired');
    expect(updated.operator.lastOverrideAt).toBe(FIXED_TS);
    expect(updated.operator.lastOverrideBy).toBe('owner');
    expect(updated.operator.overrideReason).toBe('manual-retire');
  });

  it('Suppress: status → suppressed + operator stamped', () => {
    const updated = buildOverridePayload(sampleAnchor, buildCopy('suppress'), FIXED_TS);
    expect(updated.status).toBe('suppressed');
    expect(updated.operator.overrideReason).toBe('manual-suppress');
  });

  it('Reset: status unchanged + calibrationResetAt stamped', () => {
    const updated = buildOverridePayload(sampleAnchor, buildCopy('reset'), FIXED_TS);
    expect(updated.status).toBe('active'); // unchanged
    expect(updated.operator.overrideReason).toBe('manual-reset');
    expect(updated.operator.calibrationResetAt).toBe(FIXED_TS);
  });

  it('preserves prior operator fields not touched by override', () => {
    const updated = buildOverridePayload(sampleAnchor, buildCopy('retire'), FIXED_TS);
    expect(updated.operator.dialCurve).toBe('sigmoid(k=8)');
    expect(updated.operator.currentDial).toBe(0.5);
  });

  it('preserves all non-status / non-operator anchor fields', () => {
    const updated = buildOverridePayload(sampleAnchor, buildCopy('retire'), FIXED_TS);
    expect(updated.id).toBe(sampleAnchor.id);
    expect(updated.archetypeName).toBe(sampleAnchor.archetypeName);
  });

  it('handles missing prior operator gracefully', () => {
    const anchorNoOperator = { id: 'a:1', archetypeName: 'X', status: 'active' };
    const updated = buildOverridePayload(anchorNoOperator, buildCopy('retire'), FIXED_TS);
    expect(updated.operator.lastOverrideBy).toBe('owner');
  });
});

describe('useAnchorRetirement — initial state', () => {
  it('starts with pendingCopy = null', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: vi.fn(),
      toast: buildToastDouble(),
    }));
    expect(result.current.pendingCopy).toBeNull();
  });
});

describe('useAnchorRetirement — beginRetirement', () => {
  it('opens modal with copy bundle for known action', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: vi.fn(),
      toast: buildToastDouble(),
    }));

    act(() => result.current.beginRetirement('retire', sampleAnchor));
    expect(result.current.pendingCopy).not.toBeNull();
    expect(result.current.pendingCopy.action).toBe('retire');
    expect(result.current.pendingCopy.anchorId).toBe(sampleAnchor.id);
  });

  it('ignores unknown action', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: vi.fn(),
      toast: buildToastDouble(),
    }));
    act(() => result.current.beginRetirement('shred', sampleAnchor));
    expect(result.current.pendingCopy).toBeNull();
  });

  it('ignores missing anchor', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: vi.fn(),
      toast: buildToastDouble(),
    }));
    act(() => result.current.beginRetirement('retire', null));
    expect(result.current.pendingCopy).toBeNull();
  });

  it('ignores anchor without id', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: vi.fn(),
      toast: buildToastDouble(),
    }));
    act(() => result.current.beginRetirement('retire', { archetypeName: 'X' }));
    expect(result.current.pendingCopy).toBeNull();
  });
});

describe('useAnchorRetirement — cancelRetirement', () => {
  it('clears pendingCopy', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: vi.fn(),
      toast: buildToastDouble(),
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    expect(result.current.pendingCopy).not.toBeNull();
    act(() => result.current.cancelRetirement());
    expect(result.current.pendingCopy).toBeNull();
  });

  it('does not dispatch on cancel', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch,
      toast: buildToastDouble(),
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    act(() => result.current.cancelRetirement());
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('useAnchorRetirement — confirmRetirement happy path', () => {
  let dispatch;
  let toast;

  beforeEach(() => {
    dispatch = vi.fn();
    toast = buildToastDouble();
  });

  it('dispatches ANCHOR_OVERRIDDEN with status=retired payload', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    act(() => result.current.confirmRetirement());
    expect(dispatch).toHaveBeenCalledTimes(1);
    const call = dispatch.mock.calls[0][0];
    expect(call.type).toBe(ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN);
    expect(call.payload.anchor.id).toBe(sampleAnchor.id);
    expect(call.payload.anchor.status).toBe('retired');
    expect(call.payload.anchor.operator.lastOverrideAt).toBe(FIXED_TS);
  });

  it('Suppress dispatches status=suppressed', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('suppress', sampleAnchor));
    act(() => result.current.confirmRetirement());
    expect(dispatch.mock.calls[0][0].payload.anchor.status).toBe('suppressed');
  });

  it('Reset dispatches status unchanged + calibrationResetAt stamped', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('reset', sampleAnchor));
    act(() => result.current.confirmRetirement());
    const updated = dispatch.mock.calls[0][0].payload.anchor;
    expect(updated.status).toBe('active'); // unchanged
    expect(updated.operator.calibrationResetAt).toBe(FIXED_TS);
  });

  it('Re-enable (S23) dispatches status=active + overrideReason=owner-un-retire on retired anchor', () => {
    const retiredAnchor = { ...sampleAnchor, status: 'retired' };
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('re-enable', retiredAnchor));
    act(() => result.current.confirmRetirement());
    const updated = dispatch.mock.calls[0][0].payload.anchor;
    expect(updated.status).toBe('active');
    expect(updated.operator.overrideReason).toBe('owner-un-retire');
    expect(updated.operator.lastOverrideBy).toBe('owner');
  });

  it('Re-enable success toast says "re-enabled" with archetype name', () => {
    const retiredAnchor = { ...sampleAnchor, status: 'retired' };
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('re-enable', retiredAnchor));
    act(() => result.current.confirmRetirement());
    expect(toast.addToast).toHaveBeenCalledTimes(1);
    expect(toast.addToast.mock.calls[0][0]).toMatch(/re-enabled/);
    expect(toast.addToast.mock.calls[0][0]).toContain(retiredAnchor.archetypeName);
  });

  it('clears pendingCopy after dispatch', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    act(() => result.current.confirmRetirement());
    expect(result.current.pendingCopy).toBeNull();
  });

  it('fires success toast with Undo action button (12s duration)', () => {
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    act(() => result.current.confirmRetirement());
    expect(toast.addToast).toHaveBeenCalledTimes(1);
    const [msg, opts] = toast.addToast.mock.calls[0];
    expect(msg).toContain('retired');
    expect(opts.variant).toBe('success');
    expect(opts.duration).toBe(12000);
    expect(opts.action).toBeTruthy();
    expect(opts.action.label).toBe('Undo');
    expect(typeof opts.action.onClick).toBe('function');
  });
});

describe('useAnchorRetirement — Undo action', () => {
  it('Undo dispatches ANCHOR_OVERRIDDEN with prior anchor record', () => {
    const dispatch = vi.fn();
    const toast = buildToastDouble();
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    act(() => result.current.confirmRetirement());

    // Forward dispatch + Undo dispatch
    const undoFn = toast.addToast.mock.calls[0][1].action.onClick;
    act(() => undoFn());
    expect(dispatch).toHaveBeenCalledTimes(2);
    const undoDispatched = dispatch.mock.calls[1][0];
    expect(undoDispatched.type).toBe(ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN);
    expect(undoDispatched.payload.anchor).toBe(sampleAnchor); // strict reference equality
  });

  it('Undo fires "Undone" info toast for 3s', () => {
    const dispatch = vi.fn();
    const toast = buildToastDouble();
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    act(() => result.current.confirmRetirement());
    const undoFn = toast.addToast.mock.calls[0][1].action.onClick;
    act(() => undoFn());
    expect(toast.showInfo).toHaveBeenCalledTimes(1);
    expect(toast.showInfo.mock.calls[0][0]).toContain('restored');
    expect(toast.showInfo.mock.calls[0][1]).toBe(3000);
  });
});

describe('useAnchorRetirement — error paths', () => {
  it('shows error toast when dispatch throws', () => {
    const dispatch = vi.fn(() => { throw new Error('boom'); });
    const toast = buildToastDouble();
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast,
    }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    act(() => result.current.confirmRetirement());
    expect(toast.showError).toHaveBeenCalledTimes(1);
    expect(toast.addToast).not.toHaveBeenCalled();
    expect(result.current.pendingCopy).toBeNull(); // still cleared
  });

  it('confirms-without-pending is a no-op', () => {
    const dispatch = vi.fn();
    const toast = buildToastDouble();
    const { result } = renderHook(() => useAnchorRetirement({
      dispatchAnchorLibrary: dispatch, toast,
    }));
    act(() => result.current.confirmRetirement());
    expect(dispatch).not.toHaveBeenCalled();
    expect(toast.addToast).not.toHaveBeenCalled();
  });

  it('handles missing dispatch gracefully', () => {
    const toast = buildToastDouble();
    const { result } = renderHook(() => useAnchorRetirement({ toast }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    expect(() => act(() => result.current.confirmRetirement())).not.toThrow();
    expect(result.current.pendingCopy).toBeNull();
  });

  it('handles missing toast gracefully', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useAnchorRetirement({ dispatchAnchorLibrary: dispatch, now: () => FIXED_TS }));
    act(() => result.current.beginRetirement('retire', sampleAnchor));
    expect(() => act(() => result.current.confirmRetirement())).not.toThrow();
    expect(dispatch).toHaveBeenCalled();
  });
});
