/**
 * @file AnchorCalibrationResetSection — global anchor-library calibration reset
 * in Settings (EAL WS-221 / SPR-126). Red line #4b (three-way reversibility,
 * arm b): one owner action resets calibration across every anchor at once.
 *
 * Self-contained container (precedent: RefresherSettings / AdminSection consume
 * contexts directly, mounted propless in SettingsView). Reuses the shared
 * RetirementConfirmModal (2-tap destructive confirm) + 12s undo toast via the
 * useLibraryReset orchestrator — single source of truth, no journey drift.
 *
 * Scope: anchors only — posteriors restart from seed priors; raw observation
 * evidence is preserved (red line #3 durability). All confirm/toast copy comes
 * from buildLibraryResetCopy() so it stays under AP-06 FORBIDDEN_PATTERNS
 * enforcement; the section's own framing is factual (never grades the owner).
 *
 * Gate 1: docs/design/audits/2026-06-13-entry-global-anchor-library-reset.md
 * Gate 4: docs/design/surfaces/settings-view.md §EAL-G4-SET
 */

import React from 'react';
import { useAnchorLibrary } from '../../../contexts/AnchorLibraryContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLibraryReset } from '../../../hooks/useLibraryReset';
import { RetirementConfirmModal } from '../AnchorLibraryView/RetirementConfirmModal';
import { GOLD } from '../../../constants/designTokens';

export const AnchorCalibrationResetSection = () => {
  const { anchors, selectAllAnchors, dispatchAnchorLibrary, isReady } = useAnchorLibrary();
  const toast = useToast();

  const { pendingCopy, beginReset, cancelReset, confirmReset } = useLibraryReset({
    dispatchAnchorLibrary,
    anchors,
    toast,
  });

  const anchorCount = typeof selectAllAnchors === 'function' ? selectAllAnchors().length : 0;
  const disabled = !isReady || anchorCount === 0;

  return (
    <div
      className="bg-gray-800 rounded-lg p-5"
      data-testid="settings-anchor-calibration-reset-section"
    >
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>
        Reset calibration
      </h3>

      <p className="text-gray-500 text-xs mb-3">
        Restarts Tier 2 calibration for every anchor from seed priors. Observation
        history is preserved but no longer contributes to the posteriors. There is a
        short window to undo.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={beginReset}
          disabled={disabled}
          aria-disabled={disabled ? 'true' : undefined}
          className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
            disabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-red-700 text-white hover:bg-red-600'
          }`}
          data-testid="settings-anchor-calibration-reset-button"
        >
          Reset all calibration
        </button>
        <span className="text-gray-500 text-xs" data-testid="settings-anchor-calibration-reset-count">
          {anchorCount === 1 ? '1 anchor' : `${anchorCount} anchors`}
        </span>
      </div>

      <RetirementConfirmModal
        copy={pendingCopy}
        onCancel={cancelReset}
        onConfirm={confirmReset}
      />
    </div>
  );
};

export default AnchorCalibrationResetSection;
