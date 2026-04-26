/**
 * useRefresherView.js — UI-only state for the Printable Refresher catalog.
 *
 * localStorage-backed. Filter (classes / phases / tiers / showSuppressed) +
 * sort (theoretical / alphabetical / lastPrinted / pinnedFirst). NOT in IDB
 * because: (a) UI state isn't owner-portable across devices, (b) doesn't need
 * to survive engine version bumps, (c) read/write is hot-path on every
 * filter-chip tap and IDB latency would lag.
 *
 * Per `selectors.md` §Filter + sort composition: this hook owns the view
 * state; selectors take the base set + apply view filters/sort downstream.
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  REFRESHER_VIEW_LOCALSTORAGE_KEY,
  initialRefresherView,
  VALID_SORT_VALUES,
} from '../constants/refresherConstants';

function loadFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return initialRefresherView;
    const raw = localStorage.getItem(REFRESHER_VIEW_LOCALSTORAGE_KEY);
    if (!raw) return initialRefresherView;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return initialRefresherView;
    // Defensive merge: preserve unknown fields but enforce known shape.
    return {
      filter: {
        classes: Array.isArray(parsed.filter?.classes) ? parsed.filter.classes : [],
        phases: Array.isArray(parsed.filter?.phases) ? parsed.filter.phases : [],
        tiers: Array.isArray(parsed.filter?.tiers) ? parsed.filter.tiers : [],
        showSuppressed: parsed.filter?.showSuppressed === true,
      },
      sort: VALID_SORT_VALUES.includes(parsed.sort) ? parsed.sort : initialRefresherView.sort,
    };
  } catch {
    return initialRefresherView;
  }
}

function saveToStorage(view) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(REFRESHER_VIEW_LOCALSTORAGE_KEY, JSON.stringify(view));
  } catch {
    // Quota exceeded / disabled — silently ignore. UI state isn't load-bearing.
  }
}

/**
 * useRefresherView — read/write the localStorage UI state.
 *
 * @returns {{
 *   view: { filter: { classes, phases, tiers, showSuppressed }, sort },
 *   setFilter: (patch) => void,    // partial filter merge
 *   setSort: (sortValue) => void,
 *   setShowSuppressed: (boolean) => void,  // shortcut for filter.showSuppressed
 *   resetView: () => void,
 * }}
 */
export const useRefresherView = () => {
  const [view, setView] = useState(loadFromStorage);

  // Persist on every change (synchronous; localStorage is fast enough that
  // debouncing would be over-engineering for this use case).
  useEffect(() => {
    saveToStorage(view);
  }, [view]);

  const setFilter = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setView((prev) => ({
      ...prev,
      filter: { ...prev.filter, ...patch },
    }));
  }, []);

  const setSort = useCallback((sortValue) => {
    if (!VALID_SORT_VALUES.includes(sortValue)) return;
    setView((prev) => ({ ...prev, sort: sortValue }));
  }, []);

  const setShowSuppressed = useCallback((value) => {
    setView((prev) => ({
      ...prev,
      filter: { ...prev.filter, showSuppressed: value === true },
    }));
  }, []);

  const resetView = useCallback(() => {
    setView({
      filter: {
        classes: [],
        phases: [],
        tiers: [],
        showSuppressed: false,
      },
      sort: initialRefresherView.sort,
    });
  }, []);

  return {
    view,
    setFilter,
    setSort,
    setShowSuppressed,
    resetView,
  };
};
