/**
 * AnchorLongPressTooltip.jsx — first-run discoverability tooltip.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Key interactions" #3:
 *   "First-run tooltip on first render: Long-press (or tap ⓘ) for details.
 *    Dismissable; localStorage-gated once."
 *
 * Render contract:
 *   - Renders a small banner above the card list when `show` is true.
 *   - "Got it" dismiss button → invokes `onDismiss` (caller persists localStorage).
 *   - Auto-dismiss is the caller's responsibility (e.g., after first long-press fires).
 *   - When `show` is false, returns null (no banner).
 *
 * Pure-props component. Storage gating lives in `useLongPressTooltipState`.
 *
 * EAL Phase 6 — Session 20 (S20).
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {boolean} props.show — whether to render the tooltip
 * @param {() => void} props.onDismiss — invoked when "Got it" is tapped
 */
export const AnchorLongPressTooltip = ({ show, onDismiss }) => {
  if (!show) return null;

  return (
    <div
      data-testid="anchor-long-press-tooltip"
      role="status"
      aria-label="Discovery tip"
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem 0.75rem',
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        fontSize: '0.8125rem',
        color: '#cbd5e1',
      }}
    >
      <span>Long-press (or tap ⓘ) for details.</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss discovery tip"
        data-testid="anchor-long-press-tooltip-dismiss"
        style={{
          minHeight: 32,
          minWidth: 60,
          padding: '0.25rem 0.625rem',
          background: '#334155',
          color: '#e2e8f0',
          border: '1px solid #475569',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          fontSize: '0.75rem',
          flexShrink: 0,
        }}
      >
        Got it
      </button>
    </div>
  );
};

export default AnchorLongPressTooltip;
