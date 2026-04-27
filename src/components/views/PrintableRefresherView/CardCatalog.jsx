/**
 * CardCatalog.jsx — vertical list of CardRow components.
 *
 * Composes useRefresher() selectors via the active-vs-all toggle from
 * useRefresherView (showSuppressed flag). When showSuppressed is true,
 * uses getAllCards() with visibility annotations; when false, uses
 * getActiveCards() (default catalog read).
 *
 * Empty-state copy is factual per CD-3 (no engagement copy / no nudges /
 * no streak framing). Empty state appears when the registry is empty OR
 * filter is too narrow.
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import React, { useMemo } from 'react';
import { CardRow } from './CardRow';

/**
 * CardCatalog — receives precomputed card list + stale-card-id set + handlers.
 *
 * Filtering + sorting happens upstream in PrintableRefresherView (composition
 * pattern per `selectors.md` §Filter + sort composition). This component is
 * pure render — no IDB, no context.
 *
 * @param {object} props
 * @param {AnnotatedCard[]} props.cards - filtered + sorted cards from selectors.
 * @param {Set<string>} [props.staleCardIds] - set of cardIds in the stale set.
 * @param {Function} props.onPin
 * @param {Function} props.onHide
 * @param {Function} props.onSuppress
 * @param {Function} props.onOpenDetail
 */
export const CardCatalog = ({
  cards,
  staleCardIds,
  onPin,
  onHide,
  onSuppress,
  onOpenDetail,
}) => {
  const staleSet = useMemo(
    () => (staleCardIds instanceof Set ? staleCardIds : new Set(staleCardIds || [])),
    [staleCardIds],
  );

  if (!Array.isArray(cards) || cards.length === 0) {
    return (
      <div
        className="refresher-catalog-empty-state"
        role="status"
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.875rem',
          background: '#111827',
          border: '1px dashed #374151',
          borderRadius: '0.5rem',
        }}
      >
        No cards match the current filter. Adjust filters or show suppressed cards.
      </div>
    );
  }

  return (
    <div
      className="refresher-catalog"
      role="list"
      style={{
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        overflow: 'hidden',
      }}
    >
      {cards.map((card) => (
        <CardRow
          key={card.cardId}
          card={card}
          isStale={staleSet.has(card.cardId)}
          onPin={onPin}
          onHide={onHide}
          onSuppress={onSuppress}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
};

export default CardCatalog;
