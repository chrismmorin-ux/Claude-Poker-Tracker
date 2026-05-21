/**
 * useCalibrationDashboard.test.js — orchestration hook tests.
 *
 * Coverage:
 *   - Default tab on cold open = Anchors (no localStorage, no deep-link).
 *   - localStorage-persisted active tab restores on next mount.
 *   - Deep-link presence forces Anchors tab regardless of persistence.
 *   - Deep-link auto-expands the deep-linked anchorId.
 *   - toggleAnchorExpansion adds/removes from the set.
 *   - handleBack invokes ui.closeCalibrationDashboard().
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let mockUi;

vi.mock('../../contexts', () => ({
  useUI: () => mockUi,
}));

import { useCalibrationDashboard } from '../useCalibrationDashboard';

const STORAGE_KEY = 'calibrationDashboard.activeTab';

beforeEach(() => {
  vi.clearAllMocks();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  mockUi = {
    dashboardAnchorDeepLink: null,
    closeCalibrationDashboard: vi.fn(),
  };
});

describe('useCalibrationDashboard — default tab', () => {
  it('defaults to Anchors on cold open with no persistence + no deep-link', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    expect(result.current.activeTab).toBe('anchors');
  });

  it('restores localStorage-persisted tab on cold open', () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'primitives');
    }
    const { result } = renderHook(() => useCalibrationDashboard());
    expect(result.current.activeTab).toBe('primitives');
  });

  it('falls back to Anchors when persisted value is invalid', () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'banana');
    }
    const { result } = renderHook(() => useCalibrationDashboard());
    expect(result.current.activeTab).toBe('anchors');
  });
});

describe('useCalibrationDashboard — deep-link forces Anchors tab', () => {
  it('lands on Anchors when deepLinkAnchorId is set, even with persisted Primitives', () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'primitives');
    }
    mockUi.dashboardAnchorDeepLink = 'anchor:test:1';
    const { result } = renderHook(() => useCalibrationDashboard());
    expect(result.current.activeTab).toBe('anchors');
  });

  it('auto-expands the deep-linked anchor', () => {
    mockUi.dashboardAnchorDeepLink = 'anchor:test:1';
    const { result } = renderHook(() => useCalibrationDashboard());
    expect(result.current.expandedAnchorIds.has('anchor:test:1')).toBe(true);
  });
});

describe('useCalibrationDashboard — setActiveTab', () => {
  it('updates active tab + persists to localStorage', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    act(() => result.current.setActiveTab('primitives'));
    expect(result.current.activeTab).toBe('primitives');
    if (typeof window !== 'undefined') {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('primitives');
    }
  });

  it('rejects invalid tab values silently', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    act(() => result.current.setActiveTab('banana'));
    expect(result.current.activeTab).toBe('anchors');
  });
});

describe('useCalibrationDashboard — toggleAnchorExpansion', () => {
  it('adds an anchorId to the expansion set', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    act(() => result.current.toggleAnchorExpansion('anchor:test:1'));
    expect(result.current.expandedAnchorIds.has('anchor:test:1')).toBe(true);
  });

  it('removes an anchorId on second call', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    act(() => result.current.toggleAnchorExpansion('anchor:test:1'));
    act(() => result.current.toggleAnchorExpansion('anchor:test:1'));
    expect(result.current.expandedAnchorIds.has('anchor:test:1')).toBe(false);
  });

  it('handles multiple anchor ids independently', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    act(() => result.current.toggleAnchorExpansion('anchor:a'));
    act(() => result.current.toggleAnchorExpansion('anchor:b'));
    expect(result.current.expandedAnchorIds.has('anchor:a')).toBe(true);
    expect(result.current.expandedAnchorIds.has('anchor:b')).toBe(true);
  });

  it('ignores empty/invalid ids', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    act(() => result.current.toggleAnchorExpansion(''));
    act(() => result.current.toggleAnchorExpansion(null));
    expect(result.current.expandedAnchorIds.size).toBe(0);
  });
});

describe('useCalibrationDashboard — handleBack', () => {
  it('invokes ui.closeCalibrationDashboard', () => {
    const { result } = renderHook(() => useCalibrationDashboard());
    act(() => result.current.handleBack());
    expect(mockUi.closeCalibrationDashboard).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when ui has no closeCalibrationDashboard handler', () => {
    mockUi = { dashboardAnchorDeepLink: null };
    const { result } = renderHook(() => useCalibrationDashboard());
    expect(() => act(() => result.current.handleBack())).not.toThrow();
  });
});
