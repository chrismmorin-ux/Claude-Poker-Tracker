/**
 * StalenessBanner.jsx — passive batch-level staleness surfacing.
 *
 * Per `docs/design/surfaces/printable-refresher.md` §StalenessBanner +
 * §Behavior #9 (passive amber banner) + §Anti-patterns AP-PRF-08
 * (in-app banner gated on `notifications.staleness` opt-in; default OFF).
 *
 * Behavior:
 *   - Renders only when `staleCount > 0`. Parent additionally gates on
 *     the AP-PRF-08 opt-in flag and the session-dismiss state.
 *   - Copy is factual per CD-1: "Your 2026-04-24 batch: 12 of 15 cards
 *     current, 3 stale." No streak / no days-since-print / no engagement.
 *   - 2 actions: "Review stale cards" (filters catalog to stale) +
 *     "Dismiss — I'll check later" (session-only; not persisted).
 *   - aria-live="polite" so the count change is announced when shown.
 *   - ≥44px tap targets per H-ML06.
 *
 * Red line linkages:
 *   - #10 Printed-advice permanence requires in-app staleness surfacing.
 *   - AP-PRF-03 — no streaks / no count-since-last-print prose.
 *   - AP-PRF-08 — opt-in default OFF; gate honored at parent.
 *
 * PRF Phase 5 — Session 22 (PRF-G5-UI).
 */

import React from 'react';

/**
 * Format an ISO 8601 date or YYYY-MM-DD into a human-readable YYYY-MM-DD
 * for the banner copy. Defensive against invalid input.
 */
function formatBatchDate(isoString) {
  if (typeof isoString !== 'string' || isoString.length === 0) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const ACTION_BUTTON_STYLE = {
  minHeight: 44,
  padding: '0.5rem 0.875rem',
  background: 'transparent',
  color: '#fde68a',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#92400e',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  fontWeight: 600,
};

/**
 * @param {object} props
 * @param {number} props.staleCount - Number of stale cards.
 * @param {number} props.batchCardCount - Total cards in the referenced batch.
 * @param {string} [props.batchPrintedAt] - ISO 8601 from the referenced batch.
 * @param {string} [props.batchLabel] - Optional batch label (rendered if non-empty).
 * @param {Function} props.onReviewStale - Filters catalog to stale cards.
 * @param {Function} props.onDismiss - Hides the banner for this session.
 */
export const StalenessBanner = ({
  staleCount,
  batchCardCount,
  batchPrintedAt,
  batchLabel,
  onReviewStale,
  onDismiss,
}) => {
  if (typeof staleCount !== 'number' || staleCount <= 0) return null;

  const currentCount = Math.max(0, (batchCardCount || 0) - staleCount);
  const formattedDate = formatBatchDate(batchPrintedAt);
  const labelSegment = batchLabel ? ` "${batchLabel}"` : '';
  const dateSegment = formattedDate ? `Your ${formattedDate} batch${labelSegment}` : `Your latest batch${labelSegment}`;

  return (
    <section
      className="refresher-staleness-banner"
      role="status"
      aria-live="polite"
      data-stale-count={staleCount}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        background: '#451a03',
        color: '#fde68a',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#92400e',
        borderRadius: '0.5rem',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.125rem' }}>⚠</span>
      <p
        style={{
          margin: 0,
          fontSize: '0.875rem',
          lineHeight: 1.4,
          flex: '1 1 16rem',
        }}
      >
        {dateSegment}: <strong>{currentCount}</strong> of <strong>{batchCardCount || staleCount}</strong>{' '}
        card{(batchCardCount || staleCount) === 1 ? '' : 's'} current,{' '}
        <strong>{staleCount}</strong> stale.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onReviewStale && onReviewStale()}
          aria-label="Review stale cards"
          style={ACTION_BUTTON_STYLE}
        >
          Review stale cards
        </button>
        <button
          type="button"
          onClick={() => onDismiss && onDismiss()}
          aria-label="Dismiss staleness banner for this session"
          style={{
            ...ACTION_BUTTON_STYLE,
            color: '#d6d3d1',
            borderColor: '#57534e',
            fontWeight: 400,
          }}
        >
          Dismiss — I&apos;ll check later
        </button>
      </div>
    </section>
  );
};

export default StalenessBanner;
