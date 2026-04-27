/**
 * AnchorObservationButton.jsx — Section G entry button.
 *
 * Per `docs/design/surfaces/hand-replay-observation-capture.md` §"Section G entry
 * button — AnchorObservationButton". Owner taps this to open the capture modal.
 *
 * Design contract:
 *   - Copy: "🏷 Tag pattern" (tag emoji optional per tokens; ship variant uses it).
 *     Alternative copies "Note this hand" / "Flag this moment" allowed per spec.
 *     Forbidden copy enumerated in AP-09 + persona red line #7 (editor's-note tone).
 *   - Size: ≥44×44 DOM px (H-ML06 mobile touch target).
 *   - Placement: by parent (Section G slot in ReviewPanel.jsx, S17 work).
 *   - Visible regardless of observation count (persistent affordance).
 *   - Disabled visual state when modal is open (prevents double-invocation).
 *     Does NOT gray out when enrollment is `not-enrolled` — capture works
 *     without enrollment per spec §AnchorObservationButton.disabled-state.
 *
 * The button delegates ALL state management to the parent via props. The parent
 * composes `useAnchorObservationCapture` and passes `isOpen` + `onClick` so this
 * component stays a pure render. This keeps the component testable in isolation
 * (no context mocking required).
 *
 * EAL Phase 6 Stream D B3 — Session 16 (2026-04-27).
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen      — true while the capture modal is open
 * @param {() => void} props.onClick  — invoked when button is tapped
 * @param {string} [props.label]      — copy override; defaults to "🏷 Tag pattern"
 */
export const AnchorObservationButton = ({
  isOpen = false,
  onClick,
  label = '🏷 Tag pattern',
}) => {
  const handleClick = () => {
    if (isOpen) return; // double-invocation guard
    if (typeof onClick === 'function') onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isOpen}
      aria-disabled={isOpen}
      aria-label="Tag pattern"
      data-testid="anchor-observation-button"
      style={{
        minHeight: 44,
        minWidth: 44,
        padding: '0.5rem 1rem',
        background: isOpen ? '#374151' : '#1f2937',
        color: '#e5e7eb',
        border: '1px solid ' + (isOpen ? '#4b5563' : '#374151'),
        borderRadius: '0.375rem',
        cursor: isOpen ? 'wait' : 'pointer',
        fontSize: '0.875rem',
        fontWeight: 600,
        opacity: isOpen ? 0.65 : 1,
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
};

export default AnchorObservationButton;
