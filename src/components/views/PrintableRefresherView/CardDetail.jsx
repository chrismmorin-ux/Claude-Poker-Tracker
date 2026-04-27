/**
 * CardDetail.jsx — single-card detail sub-view.
 *
 * Per `docs/design/surfaces/printable-refresher.md` §CardDetail. Renders
 * the card via class-dispatched template + actions panel + "Where does
 * this number come from?" CTA opening LineageModal + back-to-catalog button.
 *
 * Class dispatch:
 *   - 'math' → MathCardTemplate (S18; in production)
 *   - 'preflop' / 'equity' / 'exceptions' → placeholder + dev warning
 *     pending S20+ template authoring
 *
 * The "Suppress class permanently" action opens the SuppressConfirmModal
 * via the parent's pendingSuppress state (hoisted to PrintableRefresherView).
 *
 * PRF Phase 5 — Session 19 (PRF-G5-UI).
 */

import React, { useState, useCallback } from 'react';
import { MathCardTemplate } from './MathCardTemplate';
import { LineageModal } from './LineageModal';

const ACTION_BUTTON_STYLE = {
  minHeight: 44,
  padding: '0.5rem 0.875rem',
  background: '#1f2937',
  color: '#e5e7eb',
  border: '1px solid #374151',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

function ClassDispatchedTemplate({ manifest, runtime }) {
  if (!manifest) return null;
  if (manifest.class === 'math') {
    return <MathCardTemplate manifest={manifest} runtime={runtime} />;
  }
  // Preflop / equity / exceptions placeholder pending S20+ templates
  return (
    <div
      role="status"
      style={{
        padding: '2rem',
        textAlign: 'center',
        background: '#111827',
        border: '1px dashed #374151',
        borderRadius: '0.5rem',
        color: '#9ca3af',
        fontSize: '0.875rem',
      }}
    >
      Card template for class &quot;{manifest.class}&quot; will land in a future session. The card
      data is loaded; only the rendering layer is missing.
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.card - AnnotatedCard from selectors (has visibility / classSuppressed).
 * @param {object} [props.runtime] - { engineVersion, appVersion } passed to the template + lineage.
 * @param {boolean} [props.isStale]
 * @param {Function} props.onBack - Returns to catalog.
 * @param {Function} props.onPin - Toggles 'pinned'.
 * @param {Function} props.onHide - Toggles 'hidden'.
 * @param {Function} props.onSuppress - Triggers SuppressConfirmModal flow at parent.
 */
export const CardDetail = ({
  card,
  runtime,
  isStale,
  onBack,
  onPin,
  onHide,
  onSuppress,
}) => {
  const [showLineageModal, setShowLineageModal] = useState(false);

  const openLineage = useCallback(() => setShowLineageModal(true), []);
  const closeLineage = useCallback(() => setShowLineageModal(false), []);

  if (!card) return null;

  const visibility = card.visibility || 'default';
  const classSuppressed = card.classSuppressed === true;

  return (
    <section
      className="refresher-card-detail"
      data-card-id={card.cardId}
      style={{
        background: '#0f172a',
        color: '#e5e7eb',
        padding: '1rem 0',
      }}
    >
      {/* Header — back button */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => onBack && onBack()}
          aria-label="Back to catalog"
          style={{
            ...ACTION_BUTTON_STYLE,
            minWidth: 44,
          }}
        >
          ← Back to catalog
        </button>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{card.cardId}</h2>
        {isStale && (
          <span
            role="status"
            style={{
              fontSize: '0.75rem',
              color: '#d97706',
              fontWeight: 500,
              padding: '0.125rem 0.5rem',
              background: '#1c1917',
              border: '1px solid #d97706',
              borderRadius: '999px',
            }}
          >
            ⚠ Stale
          </span>
        )}
      </header>

      {/* Card preview rendering */}
      <section
        className="refresher-card-detail-preview"
        style={{
          background: '#fff',
          padding: '0.75rem',
          borderRadius: '0.375rem',
          marginBottom: '1rem',
          maxWidth: '40rem',
        }}
      >
        <ClassDispatchedTemplate manifest={card} runtime={runtime} />
      </section>

      {/* Lineage CTA */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={openLineage}
          aria-label="Open lineage modal"
          style={{
            ...ACTION_BUTTON_STYLE,
            background: '#374151',
            fontSize: '0.8125rem',
          }}
        >
          Where does this number come from? →
        </button>
      </div>

      {/* Actions panel */}
      <section
        className="refresher-card-detail-actions"
        aria-label="Card actions"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => onPin && onPin(card)}
          aria-pressed={visibility === 'pinned'}
          style={{
            ...ACTION_BUTTON_STYLE,
            background: visibility === 'pinned' ? '#1e3a5f' : ACTION_BUTTON_STYLE.background,
          }}
        >
          {visibility === 'pinned' ? '📌 Unpin' : '📌 Pin'}
        </button>
        <button
          type="button"
          onClick={() => onHide && onHide(card)}
          aria-pressed={visibility === 'hidden'}
          style={{
            ...ACTION_BUTTON_STYLE,
            background: visibility === 'hidden' ? '#374151' : ACTION_BUTTON_STYLE.background,
          }}
        >
          {visibility === 'hidden' ? '👁 Show' : '👁 Hide from print'}
        </button>
        <button
          type="button"
          onClick={() => onSuppress && onSuppress(card)}
          aria-pressed={classSuppressed}
          style={{
            ...ACTION_BUTTON_STYLE,
            background: classSuppressed ? '#7f1d1d' : ACTION_BUTTON_STYLE.background,
            color: classSuppressed ? '#fee2e2' : ACTION_BUTTON_STYLE.color,
          }}
        >
          {classSuppressed
            ? `⛔ Un-suppress ${card.class} class`
            : `⛔ Suppress ${card.class} class permanently`}
        </button>
      </section>

      {/* Status footer */}
      <footer
        style={{
          paddingTop: '0.75rem',
          borderTop: '1px solid #1f2937',
          fontSize: '0.75rem',
          color: '#9ca3af',
        }}
      >
        Class: {card.class} · Tier: {card.tier} · Schema v{card.schemaVersion}
        {visibility === 'hidden' && ' · Hidden from print-export'}
        {classSuppressed && ` · Class ${card.class} is suppressed`}
      </footer>

      {/* Lineage modal */}
      {showLineageModal && (
        <LineageModal
          manifest={card}
          runtime={runtime}
          onClose={closeLineage}
        />
      )}
    </section>
  );
};

export default CardDetail;
