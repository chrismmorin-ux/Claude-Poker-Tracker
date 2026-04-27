/**
 * AnchorObservationSection.jsx — Section G composite (Tier 0 owner observation capture).
 *
 * Per `docs/design/surfaces/hand-replay-observation-capture.md` — composes the
 * three S16 components (Button + List + Modal) with the S15 orchestrator hook
 * + AnchorLibrary selectors + ToastContext into one self-contained slot for
 * `ReviewPanel.jsx` to mount below `VillainAnalysisSection`.
 *
 * Responsibilities:
 *   - Compose `useAnchorObservationCapture({ handId })` for isOpen + openCapture
 *     + closeCapture (S15 orchestrator owns the dispatch flow).
 *   - Compose `useAnchorLibrary().selectObservationsByHand(handId)` for the
 *     inline list.
 *   - Compose `useToast()` to fire the 5s success toast on `onSaved` per
 *     surface spec §"Save pattern".
 *   - Defensive: render nothing when `handId` is missing (edge case at
 *     screen-transition before HandReplayView's loadHandById resolves).
 *
 * S17 — EAL Phase 6 Stream D B3 (2026-04-27).
 */

import React from 'react';
import { useAnchorLibrary } from '../../../contexts/AnchorLibraryContext';
import { useAnchorObservationCapture } from '../../../hooks/useAnchorObservationCapture';
import { useToast } from '../../../contexts/ToastContext';
import { AnchorObservationButton } from './AnchorObservationButton';
import { AnchorObservationList } from './AnchorObservationList';
import { AnchorObservationModal } from './AnchorObservationModal';

/**
 * @param {Object} props
 * @param {string} props.handId
 * @param {string} [props.initialStreetKey]
 * @param {number} [props.initialActionIndex]
 */
export const AnchorObservationSection = ({
  handId,
  initialStreetKey,
  initialActionIndex,
}) => {
  // Hooks must be called unconditionally per Rules of Hooks. The defensive
  // null-handId path returns AFTER all hook calls below.
  //
  // String coercion: the existing app stores `hand.handId` as a NUMBER in
  // IndexedDB (autoincrement primary key), but EAL's schema-delta §3.1 +
  // captureObservation pure-util require a string handId. Coerce at this
  // adapter boundary so EAL can use string ids throughout (e.g., the
  // deterministic record id `obs:${handId}:${idx}`) without leaking the
  // number↔string conversion into the pure utils. Discovered during S17
  // visual verification — captureObservation rejected number ids.
  const handIdStr = handId === undefined || handId === null ? null : String(handId);
  const { selectObservationsByHand } = useAnchorLibrary();
  const { addToast } = useToast();
  const observations = handIdStr ? selectObservationsByHand(handIdStr) : [];
  const observationIndex = Array.isArray(observations) ? observations.length : 0;

  const capture = useAnchorObservationCapture({ handId: handIdStr, observationIndex });
  const { isOpen, openCapture, closeCapture } = capture;

  const handleSaved = (record) => {
    const firstTag = Array.isArray(record?.ownerTags) ? record.ownerTags[0] : '';
    const message = firstTag
      ? `Pattern tagged — ${firstTag}`
      : 'Pattern tagged';
    addToast(message, { variant: 'success', duration: 5000 });
  };

  // Defensive: render nothing when handId is missing (edge case at screen-transition
  // before HandReplayView's loadHandById resolves).
  if (!handIdStr) return null;

  return (
    <div
      data-testid="anchor-observation-section"
      style={{
        flexShrink: 0,
        padding: '0.5rem 0.75rem',
        background: 'rgba(31, 41, 55, 0.4)',
        border: '1px solid rgba(75, 85, 99, 0.5)',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      <AnchorObservationButton isOpen={isOpen} onClick={openCapture} />

      <AnchorObservationList observations={observations} />

      {isOpen && (
        <AnchorObservationModal
          handId={handIdStr}
          observationIndex={observationIndex}
          initialStreetKey={initialStreetKey}
          initialActionIndex={initialActionIndex}
          onClose={closeCapture}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default AnchorObservationSection;
