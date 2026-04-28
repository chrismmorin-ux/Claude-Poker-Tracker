/**
 * AnchorLibraryView — flat-list study surface for the Exploit Anchor Library.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Anatomy".
 *
 * S18 (first ship): header + Back + empty states + collapsed AnchorCard list +
 * default A-Z sort.
 *
 * S19 (this iteration): wires `useAnchorLibraryView` for localStorage-persisted
 * filter + sort state. Adds `<AnchorFilters>` (5 chip groups + sort dropdown +
 * Clear-filters button) + `selectAnchorsFiltered` + `applySortStrategy` from
 * `src/utils/anchorLibrary/`. New `zero-filter-matches` empty-state variant
 * with active "Clear filters" CTA.
 *
 * Deferred to S20+:
 *   - Long-press transparency panel (`useAnchorCardLongPress`)
 *   - Override actions (Retire / Suppress / Reset) — gated on W-EA-3 wiring
 *   - Deep-link to Calibration Dashboard — blocked on dashboard view
 *   - Presession referrer drift-hiding
 *
 * Red-line compliance verified by tests:
 *   - #6 flat-access: retired anchors render in default list (no filtering away)
 *   - #5: no streak/progress-bar UI
 *   - AP-01: sort enum has no "biggest-edge" option (test in anchorSortStrategies)
 *   - AP-04: no scalar "calibration score" rendered
 *   - H-ML06: ⓘ button has ≥44×44 tap target (verified in AnchorCard tests)
 *
 * EAL Phase 6 — Session 18 (S18) + Session 19 (S19).
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { useAnchorLibrary } from '../../../contexts/AnchorLibraryContext';
import { useUI, useSession } from '../../../contexts';
import { useToast } from '../../../contexts/ToastContext';
import { SCREEN } from '../../../constants/uiConstants';
import { ANCHOR_LIBRARY_UNLOCK_THRESHOLD } from '../../../constants/anchorLibraryConstants';
import { useAnchorLibraryView } from '../../../hooks/useAnchorLibraryView';
import { useLongPressTooltipState } from '../../../hooks/useAnchorCardLongPress';
import {
  selectAnchorsFiltered,
  isFilterEmpty,
} from '../../../utils/anchorLibrary/librarySelectors';
import { applySortStrategy } from '../../../utils/anchorLibrary/anchorSortStrategies';
import { AnchorCard } from './AnchorCard';
import { AnchorEmptyState } from './AnchorEmptyState';
import { AnchorFilters } from './AnchorFilters';
import { AnchorLongPressTooltip } from './AnchorLongPressTooltip';

/**
 * Compute total hands the owner has seen across all sessions, for the newcomer
 * unlock threshold. Sums `handCount` across `allSessions`. If `currentSession`
 * is not yet persisted into `allSessions` (live session in flight), add it
 * once via id-presence check to avoid double-counting.
 */
const computeTotalHandsSeen = (allSessions, currentSession) => {
  const list = Array.isArray(allSessions) ? allSessions : [];
  const archived = list.reduce((sum, s) => sum + (s?.handCount || 0), 0);
  if (!currentSession || typeof currentSession.handCount !== 'number') return archived;
  const inList = list.some((s) => s && s.id && s.id === currentSession.id);
  return inList ? archived : archived + currentSession.handCount;
};

export const AnchorLibraryView = () => {
  const { selectAllAnchors, isReady } = useAnchorLibrary();
  const ui = useUI();
  const { allSessions, currentSession, loadAllSessions } = useSession();
  const toast = useToast();
  const {
    view,
    toggleFilter,
    setSort,
    clearFilters,
    expandedCardIds,
    toggleCardExpansion,
  } = useAnchorLibraryView();
  const { showTooltip, dismissTooltip } = useLongPressTooltipState();

  // S20 fix for the side-finding from S19 verification: load archived sessions
  // on view mount so `handsSeen` reflects the owner's total history (not just
  // the in-flight currentSession). Otherwise a returning owner with a finished
  // session registers as newcomer until SessionsView is visited.
  useEffect(() => {
    if (typeof loadAllSessions === 'function') {
      loadAllSessions();
    }
  }, [loadAllSessions]);

  const handsSeen = useMemo(
    () => computeTotalHandsSeen(allSessions, currentSession),
    [allSessions, currentSession],
  );

  const allAnchors = useMemo(() => selectAllAnchors() || [], [selectAllAnchors]);

  const filteredAnchors = useMemo(
    () => selectAnchorsFiltered(allAnchors, view.filters),
    [allAnchors, view.filters],
  );

  const sortedAnchors = useMemo(
    () => applySortStrategy(filteredAnchors, view.sort),
    [filteredAnchors, view.sort],
  );

  const handleBack = useCallback(() => {
    ui.setCurrentScreen(SCREEN.TABLE);
  }, [ui]);

  // S20 stub callbacks — override actions + Calibration Dashboard deep-link.
  // Both surface visible UI but wire to deferred features (W-EA-3 retirement
  // journey + Calibration Dashboard view). Toasts make the deferred state
  // explicit instead of leaving the buttons silently inert.
  const handleOverrideAction = useCallback((action, anchorId) => {
    const labels = { retire: 'Retire', suppress: 'Suppress', reset: 'Reset calibration' };
    const verb = labels[action] || action;
    toast.showInfo(`${verb}: retirement journey ships in a future session.`);
    // Future S21+ wiring: dispatchAnchorLibrary({ type: 'ANCHOR_OVERRIDDEN', payload: { anchorId, action } })
  }, [toast]);

  const handleOpenDashboard = useCallback((anchorId) => {
    toast.showInfo('Calibration Dashboard ships in a future session.');
    // Future wiring: ui.setCurrentScreen(SCREEN.CALIBRATION_DASHBOARD) with deep-link payload anchorId
    void anchorId;
  }, [toast]);

  // First successful long-press auto-dismisses the discovery tooltip.
  const handleLongPressFire = useCallback(() => {
    if (showTooltip) dismissTooltip();
  }, [showTooltip, dismissTooltip]);

  const isNewcomer = handsSeen < ANCHOR_LIBRARY_UNLOCK_THRESHOLD;
  const filtersActive = !isFilterEmpty(view.filters);

  const showEmptyNewcomer = isNewcomer;
  // S19: distinguish "filtered to nothing" from "no anchors at all" so the
  // owner gets the actionable Clear-filters CTA when their filters caused
  // the empty list, not the matter-of-fact "no anchors yet" copy.
  const showEmptyZeroFilter = !isNewcomer && allAnchors.length > 0 && sortedAnchors.length === 0 && filtersActive;
  const showEmptyZero = !isNewcomer && allAnchors.length === 0;
  const showList = !isNewcomer && sortedAnchors.length > 0;

  return (
    <div
      className="anchor-library-view"
      role="main"
      data-testid="anchor-library-view"
      style={{
        minHeight: '100dvh',
        background: '#0f172a',
        color: '#e5e7eb',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to table"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0.5rem 0.75rem',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
          Anchor Library
        </h1>
        <div style={{ flex: 1 }} />
        {!isReady && (
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Loading…</span>
        )}
      </header>

      {/* Filters — render only when not in newcomer state (no anchors to filter) */}
      {!isNewcomer && (
        <AnchorFilters
          filters={view.filters}
          sort={view.sort}
          onToggleFilter={toggleFilter}
          onSortChange={setSort}
          onClearFilters={clearFilters}
        />
      )}

      {/* S20 — first-run discovery tooltip (renders only when showList; gated by localStorage) */}
      {showList && (
        <AnchorLongPressTooltip
          show={showTooltip}
          onDismiss={dismissTooltip}
        />
      )}

      {/* Showing N of M hint (only when list rendered) */}
      {showList && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#9ca3af',
            marginBottom: '0.5rem',
          }}
        >
          Showing {sortedAnchors.length} of {allAnchors.length} anchors
        </div>
      )}

      {/* Empty states OR card list */}
      {showEmptyNewcomer && (
        <AnchorEmptyState variant="newcomer" handsSeen={handsSeen} />
      )}
      {showEmptyZeroFilter && (
        <AnchorEmptyState variant="zero-filter-matches" onClearFilters={clearFilters} />
      )}
      {showEmptyZero && <AnchorEmptyState variant="zero-anchors" />}
      {showList && (
        <ul
          data-testid="anchor-library-list"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {sortedAnchors.map((anchor) => (
            <li key={anchor.id || anchor.archetypeName}>
              <AnchorCard
                anchor={anchor}
                isExpanded={expandedCardIds.has(anchor.id)}
                onToggleExpand={toggleCardExpansion}
                onOverrideAction={handleOverrideAction}
                onOpenDashboard={handleOpenDashboard}
                onLongPressFire={handleLongPressFire}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AnchorLibraryView;
