/**
 * CardRow.jsx — single card row in the refresher catalog.
 *
 * Per `docs/design/surfaces/printable-refresher.md` §Top-level view §Card-row
 * action chips: Pin / Hide / Suppress / Detail (4 chips, ≥44×44 tap target
 * each per H-ML06). Plus title + abbreviated lineage + status badge
 * (current / stale / suppressed).
 *
 * Action handlers come from the parent (PrintableRefresherView) which gets
 * them from useRefresher(). This keeps CardRow pure — no IDB or context
 * coupling at this layer.
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import React from 'react';

const STATUS_BADGE_STYLES = {
  current: { color: '#16a34a', icon: '●', label: 'Current' },          // green
  stale: { color: '#d97706', icon: '⚠', label: 'Stale' },              // amber (red line #10 amber-only)
  suppressed: { color: '#71717a', icon: '⊘', label: 'Suppressed' },    // gray
  hidden: { color: '#71717a', icon: '👁⃠', label: 'Hidden' },           // gray
  pinned: { color: '#1e3a5f', icon: '📌', label: 'Pinned' },           // navy
};

function getStatus(annotatedCard, isStale) {
  // Order matters: stale > suppressed > hidden > pinned > current
  if (isStale) return 'stale';
  if (annotatedCard.classSuppressed) return 'suppressed';
  if (annotatedCard.visibility === 'hidden') return 'hidden';
  if (annotatedCard.visibility === 'pinned') return 'pinned';
  return 'current';
}

const ChipButton = ({ ariaLabel, onClick, active, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={active}
    title={title || ariaLabel}
    className="refresher-card-row-chip"
    style={{
      minWidth: 44,
      minHeight: 44,
      padding: '0.4rem',
      border: '1px solid #4b5563',
      borderRadius: '0.375rem',
      background: active ? '#374151' : '#1f2937',
      color: '#e5e7eb',
      fontSize: '1rem',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </button>
);

/**
 * CardRow — renders a single AnnotatedCard with action chips.
 *
 * @param {object} props
 * @param {object} props.card - AnnotatedCard from refresherSelectors.
 * @param {boolean} [props.isStale] - True if the card is in the staleCards set.
 * @param {Function} props.onPin - Toggles 'pinned' visibility.
 * @param {Function} props.onHide - Toggles 'hidden' visibility.
 * @param {Function} props.onSuppress - Triggers SuppressConfirmModal flow.
 * @param {Function} props.onOpenDetail - Opens CardDetail sub-view.
 */
export const CardRow = ({ card, isStale, onPin, onHide, onSuppress, onOpenDetail }) => {
  if (!card) return null;
  const status = getStatus(card, isStale);
  const badge = STATUS_BADGE_STYLES[status];

  return (
    <article
      className="refresher-card-row"
      data-card-id={card.cardId}
      data-card-status={status}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #374151',
        background: '#111827',
        color: '#e5e7eb',
        opacity: status === 'suppressed' || status === 'hidden' ? 0.6 : 1,
      }}
    >
      {/* Left: title + lineage line */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="refresher-card-row-title"
          style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb' }}
        >
          {card.cardId}
        </div>
        <div
          className="refresher-card-row-lineage"
          style={{
            fontSize: '0.75rem',
            color: '#9ca3af',
            marginTop: '0.125rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={card.title}
        >
          {card.title}
        </div>
        <div
          className="refresher-card-row-version"
          style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}
        >
          v{card.schemaVersion} · {card.class} · {card.tier}
        </div>
      </div>

      {/* Center: status badge */}
      <div
        className="refresher-card-row-status"
        style={{
          fontSize: '0.75rem',
          color: badge.color,
          fontWeight: 500,
          minWidth: '6rem',
          textAlign: 'right',
        }}
        aria-label={`status: ${badge.label}`}
      >
        <span style={{ marginRight: '0.25rem' }}>{badge.icon}</span>
        {badge.label}
      </div>

      {/* Right: action chips */}
      <div className="refresher-card-row-chips" style={{ display: 'flex', gap: '0.375rem' }}>
        <ChipButton
          ariaLabel={card.visibility === 'pinned' ? 'Unpin card' : 'Pin card'}
          active={card.visibility === 'pinned'}
          onClick={() => onPin && onPin(card)}
          title="Pin / unpin"
        >
          📌
        </ChipButton>
        <ChipButton
          ariaLabel={card.visibility === 'hidden' ? 'Show card' : 'Hide card'}
          active={card.visibility === 'hidden'}
          onClick={() => onHide && onHide(card)}
          title="Hide / show"
        >
          👁
        </ChipButton>
        <ChipButton
          ariaLabel={card.classSuppressed ? `Un-suppress ${card.class} class` : `Suppress ${card.class} class`}
          active={card.classSuppressed}
          onClick={() => onSuppress && onSuppress(card)}
          title="Suppress / un-suppress class"
        >
          ⛔
        </ChipButton>
        <ChipButton
          ariaLabel="Open card detail"
          onClick={() => onOpenDetail && onOpenDetail(card)}
          title="Detail"
        >
          ⓘ
        </ChipButton>
      </div>
    </article>
  );
};

export default CardRow;
