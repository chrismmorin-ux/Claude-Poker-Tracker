/**
 * CalibrationDashboardView — fullscreen study surface for the calibration
 * pipeline (3-tab IA: Predicates / Anchors / Primitives).
 *
 * Per `docs/design/surfaces/calibration-dashboard.md` v1.1 (Gate 4 +
 * 2026-05-09 amendment under SPR-066/WS-169) and Gate 1 audit at
 * `docs/design/audits/2026-05-09-entry-calibration-dashboard.md` (verdict
 * YELLOW; conditions C1-C3 binding).
 *
 * Design constraints:
 *   - AP-06 — model-accuracy framing throughout; never "your accuracy."
 *     Enforced at component level via deterministic copy generators in
 *     `calibrationCopy.js` + DOM-assertion test in `__tests__/`.
 *   - AP-08 — origin separation; matcher-system and owner-captured
 *     observations rendered in stacked cards with per-row origin badge.
 *     Counts never summed.
 *   - AP-04 — no scalar score column. Every row is multi-dimensional.
 *   - AP-01 — default sort A-Z; `Largest model deviation` sort deferred to
 *     post-v1 per Gate 1 audit §166.
 *   - Operator dial slider DEFERRED to WS-176 (post-WS-169).
 *
 * Mounts `RetirementConfirmModal` at root (reused from AnchorLibraryView
 * journey); override actions on AnchorDetailPanel rows hand off to
 * `useAnchorRetirement` orchestrator.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React, { useCallback, useMemo } from 'react';
import { useAnchorLibrary } from '../../../contexts/AnchorLibraryContext';
import { useToast } from '../../../contexts/ToastContext';
import { useUI } from '../../../contexts';
import { useAnchorRetirement } from '../../../hooks/useAnchorRetirement';
import { useCalibrationDashboard } from '../../../hooks/useCalibrationDashboard';
import { RetirementConfirmModal } from '../AnchorLibraryView/RetirementConfirmModal';
import { CalibrationTabs } from './CalibrationTabs';
import { EnrollmentStateBanner } from './EnrollmentStateBanner';
import { AnchorCalibrationPanel } from './AnchorCalibrationPanel';
import { PredicateCalibrationPanel } from './PredicateCalibrationPanel';
import { PrimitiveCalibrationPanel } from './PrimitiveCalibrationPanel';

export const CalibrationDashboardView = () => {
  const ui = useUI();
  const anchorLibrary = useAnchorLibrary();
  const { isReady, isEnrolled, dispatchAnchorLibrary, selectAllAnchors } = anchorLibrary;
  const toast = useToast();
  const {
    activeTab,
    setActiveTab,
    expandedAnchorIds,
    toggleAnchorExpansion,
    deepLinkAnchorId,
    handleBack,
  } = useCalibrationDashboard();

  // Retirement journey orchestrator — same hook used by AnchorLibraryView.
  const {
    pendingCopy,
    beginRetirement,
    cancelRetirement,
    confirmRetirement,
  } = useAnchorRetirement({ dispatchAnchorLibrary, toast });

  const allAnchors = useMemo(
    () => (typeof selectAllAnchors === 'function' ? selectAllAnchors() : []),
    [selectAllAnchors],
  );

  const handleOverrideAction = useCallback((action, anchorId) => {
    const anchor = allAnchors.find((a) => a && a.id === anchorId);
    if (!anchor) return;
    beginRetirement(action, anchor);
  }, [allAnchors, beginRetirement]);

  const enrolled = typeof isEnrolled === 'function' ? isEnrolled() : false;

  return (
    <div
      data-testid="calibration-dashboard-view"
      role="main"
      style={{
        minHeight: '100dvh',
        background: '#0f172a',
        color: '#e5e7eb',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
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
          aria-label="Back"
          data-testid="calibration-dashboard-back"
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
          Calibration Dashboard
        </h1>
        <div style={{ flex: 1 }} />
        {!isReady && (
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Loading…</span>
        )}
        {deepLinkAnchorId && isReady && (
          <span
            data-testid="calibration-deep-link-marker"
            style={{ fontSize: '0.6875rem', color: '#9ca3af' }}
          >
            Anchor {deepLinkAnchorId} expanded.
          </span>
        )}
      </header>

      {!enrolled && <EnrollmentStateBanner />}

      <CalibrationTabs activeTab={activeTab} onChange={setActiveTab} />

      <section
        id={`calibration-panel-${activeTab}`}
        aria-labelledby={`calibration-tab-${activeTab}`}
      >
        {activeTab === 'predicates' && <PredicateCalibrationPanel />}
        {activeTab === 'anchors' && (
          <AnchorCalibrationPanel
            expandedAnchorIds={expandedAnchorIds}
            onToggleExpansion={toggleAnchorExpansion}
            onOverrideAction={handleOverrideAction}
          />
        )}
        {activeTab === 'primitives' && <PrimitiveCalibrationPanel />}
      </section>

      <RetirementConfirmModal
        copy={pendingCopy}
        onCancel={cancelRetirement}
        onConfirm={confirmRetirement}
      />
    </div>
  );
};

export default CalibrationDashboardView;
