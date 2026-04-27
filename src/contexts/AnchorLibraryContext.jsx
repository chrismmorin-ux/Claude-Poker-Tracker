/**
 * AnchorLibraryContext.jsx — Exploit Anchor Library state context
 *
 * Provides anchor / observation / draft / primitive state + global enrollment
 * + selector helpers to any consumer via `useAnchorLibrary()`. Mirrors
 * EntitlementContext shape from MPMF S9 G5-B1.
 *
 * EAL Phase 6 Stream D B3 — Session 13 (2026-04-26).
 *
 * Mounting (Phase 6+ AppRoot wiring; not done in S13):
 *   - useReducer composed in `src/hooks/useAppState.js`
 *   - Provider mounted in `src/AppProviders.jsx`
 *
 * Persistence:
 *   - `useAnchorLibraryPersistence(state, dispatch)` is called from within
 *     this Provider (mirrors EntitlementProvider pattern). The hook reads
 *     from IDB on mount and dispatches ANCHOR_LIBRARY_HYDRATED.
 *
 * Selector pattern (per Gate 2 Stage D #6 + #5 hook-hoisting concerns):
 *   - Provider exposes raw state + selector helpers.
 *   - Consumers call selector helpers directly (no `useAnchorLibrary(selector)`
 *     wrapper at v1 — keeps API surface small; can add if perf becomes an
 *     issue in Phase 6 surfaces).
 *   - `selectActiveAnchors()` / `selectAllAnchors()` distinction enforces
 *     red line #6 flat-access — surfaces never use raw `state.anchors` to
 *     hide retired ones.
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { useAnchorLibraryPersistence } from '../hooks/useAnchorLibraryPersistence';
import { ENROLLMENT_STATES } from '../constants/anchorLibraryConstants';

// =============================================================================
// CONTEXT
// =============================================================================

const AnchorLibraryContext = createContext(null);

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * AnchorLibraryProvider — wraps children with anchor library state + helpers.
 *
 * Receives state + dispatch as props from useAppState. Internally composes
 * the persistence hook to hydrate IDB state on mount.
 *
 * @param {Object} props
 * @param {Object} props.anchorLibraryState - State from anchorLibraryReducer
 * @param {Function} props.dispatchAnchorLibrary - Dispatcher for anchor library actions
 * @param {React.ReactNode} props.children
 */
export const AnchorLibraryProvider = ({
  anchorLibraryState,
  dispatchAnchorLibrary,
  children,
}) => {
  // Persistence: hydrates from IDB on mount; auto-saves on state change.
  // Returns { isReady } so consumers can defer enrollment-gated UI until
  // hydration completes (avoids flash-of-not-enrolled for enrolled owners).
  const { isReady } = useAnchorLibraryPersistence(anchorLibraryState, dispatchAnchorLibrary);

  // ==========================================================================
  // SELECTOR HELPERS
  // ==========================================================================

  /**
   * Returns all anchors as an array (red line #6 flat-access — includes
   * retired + suppressed + candidate anchors). Anchor Library surface uses
   * this; live matcher uses selectActiveAnchors instead.
   */
  const selectAllAnchors = useCallback(
    () => Object.values(anchorLibraryState?.anchors || {}),
    [anchorLibraryState],
  );

  /**
   * Returns anchors with status === 'active'. Use for live matcher pre-filter
   * + Calibration Dashboard default panel.
   */
  const selectActiveAnchors = useCallback(
    () => Object.values(anchorLibraryState?.anchors || {}).filter((a) => a?.status === 'active'),
    [anchorLibraryState],
  );

  /**
   * Returns anchors with the given status. Used by Anchor Library status-filter
   * + retirement journey "show retired" panel.
   */
  const selectAnchorsByStatus = useCallback(
    (status) => Object.values(anchorLibraryState?.anchors || {}).filter((a) => a?.status === status),
    [anchorLibraryState],
  );

  /**
   * Returns observations for a given hand id. Used by capture surface's
   * inline AnchorObservationList.
   */
  const selectObservationsByHand = useCallback(
    (handId) => Object.values(anchorLibraryState?.observations || {})
      .filter((obs) => obs?.handId === handId)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)), // chronological DESC
    [anchorLibraryState],
  );

  /**
   * Returns the draft for a given hand id, or null. Used by capture-modal
   * resume-banner check.
   */
  const selectDraftForHand = useCallback(
    (handId) => anchorLibraryState?.drafts?.[`draft:${handId}`] || null,
    [anchorLibraryState],
  );

  /**
   * Returns all primitives as an array. Calibration Dashboard primitives panel
   * uses this.
   */
  const selectAllPrimitives = useCallback(
    () => Object.values(anchorLibraryState?.primitives || {}),
    [anchorLibraryState],
  );

  /**
   * Returns primitives applicable to the given style. Mirrors
   * `getPrimitivesByStyle` IDB query in-memory.
   */
  const selectPrimitivesByStyle = useCallback(
    (style) => Object.values(anchorLibraryState?.primitives || {}).filter(
      (p) => Array.isArray(p?.appliesToStyles) && p.appliesToStyles.includes(style),
    ),
    [anchorLibraryState],
  );

  /**
   * True when global enrollment is active. Capture-modal Incognito toggle
   * + Calibration Dashboard enrollment-banner gate on this.
   */
  const isEnrolled = useCallback(
    () => anchorLibraryState?.enrollment?.observation_enrollment_state === ENROLLMENT_STATES.ENROLLED,
    [anchorLibraryState],
  );

  // ==========================================================================
  // VALUE
  // ==========================================================================

  const value = useMemo(
    () => ({
      // Raw state
      ...anchorLibraryState,
      // Persistence
      isReady,
      // Selector helpers
      selectAllAnchors,
      selectActiveAnchors,
      selectAnchorsByStatus,
      selectObservationsByHand,
      selectDraftForHand,
      selectAllPrimitives,
      selectPrimitivesByStyle,
      isEnrolled,
      // Dispatch (writers go through W-EA-* / W-AO-* / W-PP-* entry points
      // per WRITERS.md I-WR-1 — components dispatch via these constants)
      dispatchAnchorLibrary,
    }),
    [
      anchorLibraryState,
      isReady,
      selectAllAnchors,
      selectActiveAnchors,
      selectAnchorsByStatus,
      selectObservationsByHand,
      selectDraftForHand,
      selectAllPrimitives,
      selectPrimitivesByStyle,
      isEnrolled,
      dispatchAnchorLibrary,
    ],
  );

  return (
    <AnchorLibraryContext.Provider value={value}>
      {children}
    </AnchorLibraryContext.Provider>
  );
};

// =============================================================================
// CONSUMER HOOK
// =============================================================================

/**
 * useAnchorLibrary — access anchor library state + helpers from any descendant.
 *
 * @returns {Object} See AnchorLibraryProvider §VALUE
 * @throws {Error} If called outside an AnchorLibraryProvider
 */
export const useAnchorLibrary = () => {
  const context = useContext(AnchorLibraryContext);
  if (!context) {
    throw new Error('useAnchorLibrary must be used within an AnchorLibraryProvider');
  }
  return context;
};

export default AnchorLibraryContext;
