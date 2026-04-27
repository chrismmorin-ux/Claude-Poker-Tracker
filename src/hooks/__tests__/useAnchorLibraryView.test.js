// @vitest-environment jsdom
/**
 * useAnchorLibraryView.test.js — view-state hook coverage.
 *
 * Covers default load, localStorage round-trip, toggle/set/clear/reset
 * helpers, and defensive parsing (corrupt localStorage / unknown sort).
 *
 * EAL Phase 6 — Session 19 (S19).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnchorLibraryView } from '../useAnchorLibraryView';
import { EMPTY_FILTERS } from '../../utils/anchorLibrary/librarySelectors';
import {
  SORT_STRATEGIES,
  DEFAULT_SORT_STRATEGY,
} from '../../utils/anchorLibrary/anchorSortStrategies';

const STORAGE_KEY = 'eal:anchorLibraryView:v1';

beforeEach(() => {
  localStorage.clear();
});

describe('useAnchorLibraryView — defaults', () => {
  it('loads with empty filters + alphabetical sort when localStorage is empty', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    expect(result.current.view.filters).toEqual(EMPTY_FILTERS);
    expect(result.current.view.sort).toBe(DEFAULT_SORT_STRATEGY);
  });

  it('falls back to defaults when localStorage holds invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useAnchorLibraryView());
    expect(result.current.view.filters).toEqual(EMPTY_FILTERS);
    expect(result.current.view.sort).toBe(DEFAULT_SORT_STRATEGY);
  });

  it('falls back to defaults when stored sort is invalid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ filters: EMPTY_FILTERS, sort: 'biggest-edge' }),
    );
    const { result } = renderHook(() => useAnchorLibraryView());
    expect(result.current.view.sort).toBe(DEFAULT_SORT_STRATEGY);
  });

  it('sanitizes non-string entries in stored filter arrays', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        filters: { styles: ['Fish', 42, null], streets: 'oops', polarities: [], tiers: [], statuses: [] },
        sort: DEFAULT_SORT_STRATEGY,
      }),
    );
    const { result } = renderHook(() => useAnchorLibraryView());
    expect(result.current.view.filters.styles).toEqual(['Fish']);
    // Non-array stored value coerces to empty array (defensive).
    expect(result.current.view.filters.streets).toEqual([]);
  });
});

describe('useAnchorLibraryView — toggleFilter', () => {
  it('adds a value when absent', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter('statuses', 'active'));
    expect(result.current.view.filters.statuses).toEqual(['active']);
  });

  it('removes a value when present', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter('statuses', 'active'));
    act(() => result.current.toggleFilter('statuses', 'active'));
    expect(result.current.view.filters.statuses).toEqual([]);
  });

  it('supports multi-select within the same group', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter('polarities', 'overfold'));
    act(() => result.current.toggleFilter('polarities', 'overbluff'));
    expect(result.current.view.filters.polarities).toEqual(['overfold', 'overbluff']);
  });

  it('ignores unknown groups (defensive)', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter('mystery', 'something'));
    expect(result.current.view.filters).toEqual(EMPTY_FILTERS);
  });

  it('ignores non-string group/value (defensive)', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter(null, 'x'));
    act(() => result.current.toggleFilter('statuses', null));
    expect(result.current.view.filters).toEqual(EMPTY_FILTERS);
  });
});

describe('useAnchorLibraryView — setSort', () => {
  it('switches to a valid sort strategy', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.setSort(SORT_STRATEGIES.SAMPLE_SIZE));
    expect(result.current.view.sort).toBe('sample-size');
  });

  it('rejects unknown sort strategies (no-op)', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.setSort('biggest-edge'));
    expect(result.current.view.sort).toBe(DEFAULT_SORT_STRATEGY);
  });
});

describe('useAnchorLibraryView — setFilters / clearFilters / resetView', () => {
  it('setFilters merges a patch', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.setFilters({ statuses: ['active'] }));
    expect(result.current.view.filters.statuses).toEqual(['active']);
    // Other groups remain at empty default.
    expect(result.current.view.filters.styles).toEqual([]);
  });

  it('clearFilters resets every filter group to empty', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter('statuses', 'active'));
    act(() => result.current.toggleFilter('polarities', 'overfold'));
    act(() => result.current.clearFilters());
    expect(result.current.view.filters).toEqual(EMPTY_FILTERS);
  });

  it('clearFilters does NOT reset sort', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.setSort('sample-size'));
    act(() => result.current.toggleFilter('statuses', 'active'));
    act(() => result.current.clearFilters());
    expect(result.current.view.sort).toBe('sample-size');
    expect(result.current.view.filters).toEqual(EMPTY_FILTERS);
  });

  it('resetView clears filters AND resets sort', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.setSort('sample-size'));
    act(() => result.current.toggleFilter('statuses', 'active'));
    act(() => result.current.resetView());
    expect(result.current.view.filters).toEqual(EMPTY_FILTERS);
    expect(result.current.view.sort).toBe(DEFAULT_SORT_STRATEGY);
  });
});

describe('useAnchorLibraryView — localStorage round-trip', () => {
  it('persists filter changes', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter('statuses', 'active'));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.filters.statuses).toEqual(['active']);
  });

  it('persists sort changes', () => {
    const { result } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.setSort('sample-size'));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.sort).toBe('sample-size');
  });

  it('survives a fresh mount (state hydrates from localStorage)', () => {
    const { result, unmount } = renderHook(() => useAnchorLibraryView());
    act(() => result.current.toggleFilter('polarities', 'overfold'));
    act(() => result.current.setSort('last-fired'));
    unmount();

    const { result: result2 } = renderHook(() => useAnchorLibraryView());
    expect(result2.current.view.filters.polarities).toEqual(['overfold']);
    expect(result2.current.view.sort).toBe('last-fired');
  });
});
