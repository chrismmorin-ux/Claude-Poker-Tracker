/**
 * useAnchorLibraryView.js — UI-only filter/sort state for AnchorLibraryView.
 *
 * Per `docs/design/surfaces/anchor-library.md` §State + §Filter row:
 *   - 5 filter groups (styles / streets / polarities / tiers / statuses)
 *   - 3 sort strategies (alphabetical / last-fired / sample-size)
 *   - localStorage-persisted across reloads
 *   - "All" within a group = empty array
 *
 * Why localStorage (not IDB): (a) per-device UI preference, not owner-portable;
 * (b) doesn't need to survive engine version bumps; (c) read/write is hot-path
 * on every filter-chip tap. Mirrors `useRefresherView.js` precedent.
 *
 * Doctrine deviation from spec (§Mutations):
 *   The spec says writes are "debounced 100ms." This implementation uses
 *   synchronous writes per the `useRefresherView` precedent. Toggle chips +
 *   sort dropdown produce at most one write per discrete user action; debounce
 *   would add testing complexity without observable benefit. If a future
 *   surface (e.g., a drag slider) introduces high-frequency writes, debounce
 *   can be added then.
 *
 * EAL Phase 6 — Session 19 (S19).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  VALID_SORT_STRATEGIES,
  DEFAULT_SORT_STRATEGY,
} from '../utils/anchorLibrary/anchorSortStrategies';
import { EMPTY_FILTERS } from '../utils/anchorLibrary/librarySelectors';

const LOCALSTORAGE_KEY = 'eal:anchorLibraryView:v1';

const DEFAULT_VIEW = Object.freeze({
  filters: EMPTY_FILTERS,
  sort: DEFAULT_SORT_STRATEGY,
});

const sanitizeArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function loadFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_VIEW;
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return DEFAULT_VIEW;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_VIEW;
    return {
      filters: {
        styles: sanitizeArray(parsed.filters?.styles),
        streets: sanitizeArray(parsed.filters?.streets),
        polarities: sanitizeArray(parsed.filters?.polarities),
        tiers: sanitizeArray(parsed.filters?.tiers),
        statuses: sanitizeArray(parsed.filters?.statuses),
      },
      sort: VALID_SORT_STRATEGIES.includes(parsed.sort) ? parsed.sort : DEFAULT_SORT_STRATEGY,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

function saveToStorage(view) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(view));
  } catch {
    // Quota exceeded / disabled — silently ignore. UI state isn't load-bearing.
  }
}

/**
 * Toggle a value in an array (add if absent, remove if present). Pure.
 */
const toggleInArray = (arr, value) => {
  const safe = Array.isArray(arr) ? arr : [];
  return safe.includes(value) ? safe.filter((x) => x !== value) : [...safe, value];
};

/**
 * useAnchorLibraryView — read/write the localStorage UI state for the surface.
 *
 * @returns {{
 *   view: { filters: { styles, streets, polarities, tiers, statuses }, sort },
 *   toggleFilter: (group, value) => void,
 *   setFilters: (patch) => void,
 *   setSort: (sortValue) => void,
 *   clearFilters: () => void,
 *   resetView: () => void,
 * }}
 */
export const useAnchorLibraryView = () => {
  const [view, setView] = useState(loadFromStorage);

  useEffect(() => {
    saveToStorage(view);
  }, [view]);

  const toggleFilter = useCallback((group, value) => {
    if (typeof group !== 'string' || typeof value !== 'string') return;
    setView((prev) => {
      const current = prev.filters[group];
      if (!Array.isArray(current)) return prev; // unknown group — ignore
      return {
        ...prev,
        filters: {
          ...prev.filters,
          [group]: toggleInArray(current, value),
        },
      };
    });
  }, []);

  const setFilters = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setView((prev) => ({
      ...prev,
      filters: { ...prev.filters, ...patch },
    }));
  }, []);

  const setSort = useCallback((sortValue) => {
    if (!VALID_SORT_STRATEGIES.includes(sortValue)) return;
    setView((prev) => ({ ...prev, sort: sortValue }));
  }, []);

  const clearFilters = useCallback(() => {
    setView((prev) => ({ ...prev, filters: { ...EMPTY_FILTERS } }));
  }, []);

  const resetView = useCallback(() => {
    setView({ filters: { ...EMPTY_FILTERS }, sort: DEFAULT_SORT_STRATEGY });
  }, []);

  return {
    view,
    toggleFilter,
    setFilters,
    setSort,
    clearFilters,
    resetView,
  };
};

export default useAnchorLibraryView;
