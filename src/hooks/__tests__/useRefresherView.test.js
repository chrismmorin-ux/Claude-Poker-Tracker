// @vitest-environment jsdom
/**
 * useRefresherView.test.js — localStorage UI state coverage.
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRefresherView } from '../useRefresherView';
import {
  REFRESHER_VIEW_LOCALSTORAGE_KEY,
  initialRefresherView,
} from '../../constants/refresherConstants';

beforeEach(() => {
  localStorage.clear();
});

describe('useRefresherView — initial state', () => {
  it('returns default view when no localStorage value', () => {
    const { result } = renderHook(() => useRefresherView());
    expect(result.current.view).toEqual(initialRefresherView);
  });

  it('hydrates from localStorage on mount', () => {
    const persisted = {
      filter: { classes: ['math'], phases: [], tiers: [], showSuppressed: true },
      sort: 'alphabetical',
    };
    localStorage.setItem(REFRESHER_VIEW_LOCALSTORAGE_KEY, JSON.stringify(persisted));

    const { result } = renderHook(() => useRefresherView());
    expect(result.current.view).toEqual(persisted);
  });

  it('falls back to defaults when localStorage value is malformed JSON', () => {
    localStorage.setItem(REFRESHER_VIEW_LOCALSTORAGE_KEY, '{not valid json');
    const { result } = renderHook(() => useRefresherView());
    expect(result.current.view).toEqual(initialRefresherView);
  });

  it('coerces invalid sort value to default', () => {
    const persisted = { filter: initialRefresherView.filter, sort: 'whatever-bogus' };
    localStorage.setItem(REFRESHER_VIEW_LOCALSTORAGE_KEY, JSON.stringify(persisted));

    const { result } = renderHook(() => useRefresherView());
    expect(result.current.view.sort).toBe(initialRefresherView.sort);
  });

  it('coerces non-array filter fields to []', () => {
    const persisted = {
      filter: { classes: 'not-an-array', phases: null, tiers: 42, showSuppressed: 'truthy' },
      sort: 'theoretical',
    };
    localStorage.setItem(REFRESHER_VIEW_LOCALSTORAGE_KEY, JSON.stringify(persisted));

    const { result } = renderHook(() => useRefresherView());
    expect(result.current.view.filter.classes).toEqual([]);
    expect(result.current.view.filter.phases).toEqual([]);
    expect(result.current.view.filter.tiers).toEqual([]);
    expect(result.current.view.filter.showSuppressed).toBe(false); // strict-equality === true required
  });
});

describe('useRefresherView — setFilter', () => {
  it('partially updates filter state', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setFilter({ classes: ['math', 'preflop'] }));
    expect(result.current.view.filter.classes).toEqual(['math', 'preflop']);
    expect(result.current.view.filter.phases).toEqual([]);
  });

  it('preserves other filter fields when patching', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setFilter({ classes: ['math'] }));
    act(() => result.current.setFilter({ phases: ['B'] }));
    expect(result.current.view.filter.classes).toEqual(['math']);
    expect(result.current.view.filter.phases).toEqual(['B']);
  });

  it('persists to localStorage on change', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setFilter({ showSuppressed: true }));

    const stored = JSON.parse(localStorage.getItem(REFRESHER_VIEW_LOCALSTORAGE_KEY));
    expect(stored.filter.showSuppressed).toBe(true);
  });

  it('ignores null/non-object patches', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setFilter(null));
    act(() => result.current.setFilter('bogus'));
    expect(result.current.view).toEqual(initialRefresherView);
  });
});

describe('useRefresherView — setSort', () => {
  it('updates sort to a valid value', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setSort('alphabetical'));
    expect(result.current.view.sort).toBe('alphabetical');
  });

  it('rejects invalid sort values silently', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setSort('bogus'));
    expect(result.current.view.sort).toBe(initialRefresherView.sort);
  });

  it('persists sort change to localStorage', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setSort('lastPrinted'));

    const stored = JSON.parse(localStorage.getItem(REFRESHER_VIEW_LOCALSTORAGE_KEY));
    expect(stored.sort).toBe('lastPrinted');
  });
});

describe('useRefresherView — setShowSuppressed shortcut', () => {
  it('toggles filter.showSuppressed on', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setShowSuppressed(true));
    expect(result.current.view.filter.showSuppressed).toBe(true);
  });

  it('toggles filter.showSuppressed off', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setShowSuppressed(true));
    act(() => result.current.setShowSuppressed(false));
    expect(result.current.view.filter.showSuppressed).toBe(false);
  });

  it('coerces non-boolean true-ish to false (strict equality)', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setShowSuppressed('yes'));
    expect(result.current.view.filter.showSuppressed).toBe(false);
  });
});

describe('useRefresherView — resetView', () => {
  it('resets all filter + sort to defaults', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setFilter({ classes: ['math'], showSuppressed: true }));
    act(() => result.current.setSort('alphabetical'));

    act(() => result.current.resetView());

    expect(result.current.view.filter.classes).toEqual([]);
    expect(result.current.view.filter.showSuppressed).toBe(false);
    expect(result.current.view.sort).toBe(initialRefresherView.sort);
  });

  it('persists reset to localStorage', () => {
    const { result } = renderHook(() => useRefresherView());
    act(() => result.current.setFilter({ classes: ['math'] }));
    act(() => result.current.resetView());

    const stored = JSON.parse(localStorage.getItem(REFRESHER_VIEW_LOCALSTORAGE_KEY));
    expect(stored.filter.classes).toEqual([]);
  });
});
