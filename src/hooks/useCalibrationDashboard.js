/**
 * useCalibrationDashboard — orchestrates active-tab + expanded-row state for
 * `CalibrationDashboardView`. Mirrors `useAnchorLibraryView`'s expansion-set
 * pattern + reads `dashboardAnchorDeepLink` from `UIContext` to auto-expand
 * the deep-linked anchor on entry.
 *
 * Pure React-state hook — no IDB IO; no dispatch. Persistence of the active
 * tab is `localStorage` only (matches the spec's "last-viewed tab remembered
 * across sessions" line).
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useUI } from '../contexts';

const STORAGE_KEY = 'calibrationDashboard.activeTab';
const DEFAULT_TAB = 'anchors';
const VALID_TABS = Object.freeze(['predicates', 'anchors', 'primitives']);

const readPersistedTab = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_TAB;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return VALID_TABS.includes(raw) ? raw : DEFAULT_TAB;
  } catch {
    return DEFAULT_TAB;
  }
};

const writePersistedTab = (tab) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (VALID_TABS.includes(tab)) window.localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    /* noop */
  }
};

export const useCalibrationDashboard = () => {
  const ui = useUI();
  const deepLinkAnchorId = ui?.dashboardAnchorDeepLink || null;

  // Deep-link entry forces Anchors tab regardless of last-viewed tab.
  const [activeTab, setActiveTabState] = useState(() => (
    deepLinkAnchorId ? 'anchors' : readPersistedTab()
  ));

  const [expandedAnchorIds, setExpandedAnchorIds] = useState(() => {
    const set = new Set();
    if (deepLinkAnchorId) set.add(deepLinkAnchorId);
    return set;
  });

  const setActiveTab = useCallback((tab) => {
    if (!VALID_TABS.includes(tab)) return;
    setActiveTabState(tab);
    writePersistedTab(tab);
  }, []);

  const toggleAnchorExpansion = useCallback((anchorId) => {
    if (typeof anchorId !== 'string' || anchorId.length === 0) return;
    setExpandedAnchorIds((prev) => {
      const next = new Set(prev);
      if (next.has(anchorId)) next.delete(anchorId);
      else next.add(anchorId);
      return next;
    });
  }, []);

  // If the deep-link payload changes (founder navigates from a different
  // anchor row), force-expand the new id without collapsing previously
  // expanded ones.
  useEffect(() => {
    if (!deepLinkAnchorId) return;
    setActiveTabState('anchors');
    setExpandedAnchorIds((prev) => {
      if (prev.has(deepLinkAnchorId)) return prev;
      const next = new Set(prev);
      next.add(deepLinkAnchorId);
      return next;
    });
  }, [deepLinkAnchorId]);

  const handleBack = useCallback(() => {
    if (ui && typeof ui.closeCalibrationDashboard === 'function') {
      ui.closeCalibrationDashboard();
    }
  }, [ui]);

  return useMemo(
    () => ({
      activeTab,
      setActiveTab,
      expandedAnchorIds,
      toggleAnchorExpansion,
      deepLinkAnchorId,
      handleBack,
      VALID_TABS,
    }),
    [activeTab, setActiveTab, expandedAnchorIds, toggleAnchorExpansion, deepLinkAnchorId, handleBack],
  );
};

export default useCalibrationDashboard;
