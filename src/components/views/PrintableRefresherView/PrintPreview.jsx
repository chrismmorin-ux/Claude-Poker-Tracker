/**
 * PrintPreview.jsx — WYSIWYG print preview sub-view.
 *
 * Renders the active card set in a `.refresher-print-page[data-cards-per-sheet]`
 * grid wrapped in `.print-preview-container`. The container class triggers the
 * `@media print, .print-preview-container { ... }` selector pattern in
 * `src/styles/printable-refresher.css`, so the on-screen preview matches the
 * printed output exactly (no two-mode rendering).
 *
 * Cards are chunked into "pages" of N cards each (where N = cardsPerSheet);
 * each page is its own `.refresher-print-page` element with `break-inside: avoid`
 * so browser print pagination stays clean.
 *
 * The "Send to print dialog →" button hands off to `PrintConfirmationModal`
 * (rendered by the parent `PrintableRefresherView`) which collects the
 * `printedAt` + `label` + records the batch via W-URC-3 → fires `window.print()`.
 *
 * Spec: docs/design/surfaces/printable-refresher.md §PrintPreview.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import React, { useMemo } from 'react';
import { useRefresher } from '../../../contexts';
import { ClassDispatchedTemplate } from './ClassDispatchedTemplate';
import { PrintControls } from './PrintControls';
import { ENGINE_VERSION, APP_VERSION } from '../../../constants/runtimeVersions';

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

const PRIMARY_BUTTON_STYLE = {
  ...ACTION_BUTTON_STYLE,
  background: '#0f766e',
  borderColor: '#14b8a6',
  color: '#fff',
  fontWeight: 600,
};

/**
 * Chunk an array into N-sized pages. Last page may have fewer cards.
 */
function chunkPages(cards, cardsPerSheet) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  const size = Number.isInteger(cardsPerSheet) && cardsPerSheet > 0 ? cardsPerSheet : 12;
  const pages = [];
  for (let i = 0; i < cards.length; i += size) {
    pages.push(cards.slice(i, i + size));
  }
  return pages;
}

/**
 * @param {object} props
 * @param {Function} props.onBack - Returns to catalog (catalog mode).
 * @param {Function} props.onRequestPrintConfirm - Opens PrintConfirmationModal at parent
 *   with the prepared batch context (cardIds + perCardSnapshots).
 */
export const PrintPreview = ({ onBack, onRequestPrintConfirm }) => {
  const refresher = useRefresher();
  const prefs = refresher.config?.printPreferences || {};
  const pageSize = prefs.pageSize || 'letter';
  const cardsPerSheet = prefs.cardsPerSheet || 12;
  const colorMode = prefs.colorMode || 'auto';
  const includeLineage = prefs.includeLineage !== false;

  const activeCards = useMemo(() => refresher.getActiveCards(), [refresher]);
  const pages = useMemo(
    () => chunkPages(activeCards, cardsPerSheet),
    [activeCards, cardsPerSheet],
  );

  const runtime = useMemo(
    () => ({ engineVersion: ENGINE_VERSION, appVersion: APP_VERSION }),
    [],
  );

  /**
   * Build the W-URC-3 payload context for the parent's PrintConfirmationModal.
   * The parent appends `printedAt` + `label` from the modal inputs and calls
   * `recordPrintBatch`. Cards + snapshots are built here so I-WR-6 1:1 contract
   * between cardIds and perCardSnapshots is enforced from a single source.
   */
  const handleSendToPrintDialog = () => {
    if (!onRequestPrintConfirm) return;
    const cardIds = activeCards.map((c) => c.cardId);
    const perCardSnapshots = Object.fromEntries(
      activeCards.map((c) => [
        c.cardId,
        {
          contentHash: c.contentHash,
          version: String(c.schemaVersion),
        },
      ]),
    );
    onRequestPrintConfirm({
      cardIds,
      perCardSnapshots,
      cardCount: activeCards.length,
      pageCount: pages.length,
      pageSize,
      cardsPerSheet,
      colorMode,
    });
  };

  return (
    <section
      className="refresher-print-preview"
      aria-label="Print preview"
      data-page-size={pageSize}
      data-color-mode={colorMode}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1rem 0',
      }}
    >
      {/* Header — back button + heading */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => onBack && onBack()}
          aria-label="Back to catalog"
          style={ACTION_BUTTON_STYLE}
        >
          ← Back to catalog
        </button>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#e5e7eb' }}>
          Print preview
        </h2>
        <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
          {activeCards.length} card{activeCards.length === 1 ? '' : 's'} · {pages.length} page
          {pages.length === 1 ? '' : 's'}
        </span>
      </header>

      {/* Print controls (toggles persisted to IDB via W-URC-1) */}
      <PrintControls />

      {/* Tips panel — factual copy per CD-1 */}
      <div
        style={{
          padding: '0.5rem 0.75rem',
          background: '#0f172a',
          color: '#94a3b8',
          fontSize: '0.75rem',
          borderRadius: '0.375rem',
          border: '1px solid #1e293b',
        }}
      >
        Disable browser headers and footers for best laminate result. Press Ctrl+P (Cmd+P on Mac) or
        click the button below to open the print dialog.
      </div>

      {/* Send-to-dialog action */}
      <div>
        <button
          type="button"
          onClick={handleSendToPrintDialog}
          disabled={activeCards.length === 0}
          aria-label="Send to print dialog"
          style={{
            ...PRIMARY_BUTTON_STYLE,
            opacity: activeCards.length === 0 ? 0.5 : 1,
            cursor: activeCards.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Send to print dialog →
        </button>
      </div>

      {/* WYSIWYG container — class triggers @media print, .print-preview-container CSS */}
      <div
        className="print-preview-container"
        data-page-size={pageSize}
        data-color-mode={colorMode}
        data-include-lineage={includeLineage ? 'on' : 'off'}
      >
        {pages.length === 0 && (
          <p
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
            No active cards to preview. Un-suppress at least one class or un-hide a card to print.
          </p>
        )}
        {pages.map((pageCards, pageIdx) => (
          <div
            key={`page-${pageIdx}`}
            className="refresher-print-page"
            data-page-index={pageIdx}
            data-cards-per-sheet={cardsPerSheet}
          >
            {pageCards.map((card) => (
              <ClassDispatchedTemplate
                key={card.cardId}
                manifest={card}
                runtime={runtime}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export default PrintPreview;
