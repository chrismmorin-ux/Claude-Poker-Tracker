/**
 * useLibraryReset.test.js — global library-reset orchestrator coverage.
 *
 * EAL — WS-221 / SPR-126 (red line #4b, three-way reversibility arm b).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibraryReset } from '../useLibraryReset';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

const FIXED_TS = '2026-06-13T18:00:00.000Z';

const sampleAnchors = () => ({
  'anchor:1': { id: 'anchor:1', archetypeName: 'Nit Over-Fold', status: 'active', operator: {} },
  'anchor:2': { id: 'anchor:2', archetypeName: 'LAG Over-Bluff', status: 'retired', operator: {} },
});

const buildToastDouble = () => ({
  addToast: vi.fn(),
  dismissToast: vi.fn(),
  showInfo: vi.fn(),
  showError: vi.fn(),
});

describe('useLibraryReset — initial state', () => {
  it('starts with pendingCopy = null', () => {
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: vi.fn(), anchors: sampleAnchors(), toast: buildToastDouble(),
    }));
    expect(result.current.pendingCopy).toBeNull();
  });
});

describe('useLibraryReset — beginReset', () => {
  it('opens the modal with a count-aware destructive copy bundle', () => {
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: vi.fn(), anchors: sampleAnchors(), toast: buildToastDouble(),
    }));
    act(() => result.current.beginReset());
    expect(result.current.pendingCopy).not.toBeNull();
    expect(result.current.pendingCopy.action).toBe('library-reset');
    expect(result.current.pendingCopy.destructive).toBe(true);
    // Count-aware: 2 anchors → "all 2 anchors".
    expect(result.current.pendingCopy.subText).toContain('all 2 anchors');
  });

  it('handles an empty library (count-free phrasing)', () => {
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: vi.fn(), anchors: {}, toast: buildToastDouble(),
    }));
    act(() => result.current.beginReset());
    expect(result.current.pendingCopy.subText).toContain('all anchors');
  });
});

describe('useLibraryReset — cancelReset', () => {
  it('clears pendingCopy and does not dispatch', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), toast: buildToastDouble(),
    }));
    act(() => result.current.beginReset());
    act(() => result.current.cancelReset());
    expect(result.current.pendingCopy).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('useLibraryReset — confirmReset happy path', () => {
  let dispatch;
  let toast;

  beforeEach(() => {
    dispatch = vi.fn();
    toast = buildToastDouble();
  });

  it('dispatches LIBRARY_CALIBRATION_RESET with a timestamp', () => {
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginReset());
    act(() => result.current.confirmReset());
    expect(dispatch).toHaveBeenCalledTimes(1);
    const call = dispatch.mock.calls[0][0];
    expect(call.type).toBe(ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET);
    expect(call.payload.timestamp).toBe(FIXED_TS);
  });

  it('fires a success toast with a 12s Undo action', () => {
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginReset());
    act(() => result.current.confirmReset());
    expect(toast.addToast).toHaveBeenCalledTimes(1);
    const [msg, opts] = toast.addToast.mock.calls[0];
    expect(msg).toMatch(/reset/i);
    expect(opts.variant).toBe('success');
    expect(opts.duration).toBe(12000);
    expect(opts.action.label).toBe('Undo');
    expect(typeof opts.action.onClick).toBe('function');
  });

  it('clears pendingCopy after dispatch', () => {
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginReset());
    act(() => result.current.confirmReset());
    expect(result.current.pendingCopy).toBeNull();
  });
});

describe('useLibraryReset — Undo action restores the prior snapshot', () => {
  it('Undo dispatches LIBRARY_CALIBRATION_RESET with restoreAnchors = the prior dict', () => {
    const dispatch = vi.fn();
    const toast = buildToastDouble();
    const anchors = sampleAnchors();
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginReset());
    act(() => result.current.confirmReset());

    const undoFn = toast.addToast.mock.calls[0][1].action.onClick;
    act(() => undoFn());

    expect(dispatch).toHaveBeenCalledTimes(2);
    const undo = dispatch.mock.calls[1][0];
    expect(undo.type).toBe(ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET);
    // Snapshot is a shallow copy of the prior anchors (same entries, by value).
    expect(undo.payload.restoreAnchors).toEqual(anchors);
  });

  it('Undo fires an "restored" info toast for 3s', () => {
    const dispatch = vi.fn();
    const toast = buildToastDouble();
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginReset());
    act(() => result.current.confirmReset());
    const undoFn = toast.addToast.mock.calls[0][1].action.onClick;
    act(() => undoFn());
    expect(toast.showInfo).toHaveBeenCalledTimes(1);
    expect(toast.showInfo.mock.calls[0][0]).toMatch(/restored/i);
    expect(toast.showInfo.mock.calls[0][1]).toBe(3000);
  });

  it('the undo snapshot is immune to later mutation of the live anchors dict', () => {
    const dispatch = vi.fn();
    const toast = buildToastDouble();
    const anchors = sampleAnchors();
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors, toast, now: () => FIXED_TS,
    }));
    act(() => result.current.beginReset());
    act(() => result.current.confirmReset());
    // Mutate the live dict after confirm (simulating the reset stamping anchors).
    delete anchors['anchor:1'];
    const undoFn = toast.addToast.mock.calls[0][1].action.onClick;
    act(() => undoFn());
    // The snapshot still carries both anchors.
    expect(Object.keys(dispatch.mock.calls[1][0].payload.restoreAnchors)).toContain('anchor:1');
  });
});

describe('useLibraryReset — error / guard paths', () => {
  it('confirm-without-pending is a no-op', () => {
    const dispatch = vi.fn();
    const toast = buildToastDouble();
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), toast,
    }));
    act(() => result.current.confirmReset());
    expect(dispatch).not.toHaveBeenCalled();
    expect(toast.addToast).not.toHaveBeenCalled();
  });

  it('shows error toast when dispatch throws', () => {
    const dispatch = vi.fn(() => { throw new Error('boom'); });
    const toast = buildToastDouble();
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), toast,
    }));
    act(() => result.current.beginReset());
    act(() => result.current.confirmReset());
    expect(toast.showError).toHaveBeenCalledTimes(1);
    expect(toast.addToast).not.toHaveBeenCalled();
    expect(result.current.pendingCopy).toBeNull();
  });

  it('handles missing dispatch gracefully', () => {
    const toast = buildToastDouble();
    const { result } = renderHook(() => useLibraryReset({ anchors: sampleAnchors(), toast }));
    act(() => result.current.beginReset());
    expect(() => act(() => result.current.confirmReset())).not.toThrow();
    expect(result.current.pendingCopy).toBeNull();
  });

  it('handles missing toast gracefully', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useLibraryReset({
      dispatchAnchorLibrary: dispatch, anchors: sampleAnchors(), now: () => FIXED_TS,
    }));
    act(() => result.current.beginReset());
    expect(() => act(() => result.current.confirmReset())).not.toThrow();
    expect(dispatch).toHaveBeenCalled();
  });
});
