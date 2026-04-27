/**
 * PrintConfirmationModal.jsx — final confirmation before browser print dialog.
 *
 * Per `docs/design/surfaces/printable-refresher.md` §PrintConfirmationModal.
 *
 * Flow:
 *   1. Owner clicks "Send to print dialog →" in PrintPreview.
 *   2. PrintPreview builds the batch context (cardIds + perCardSnapshots) and
 *      hoists it to the parent which renders this modal.
 *   3. Owner reviews summary, optionally edits printedAt date / label.
 *   4. Owner clicks "Confirm and open print dialog →".
 *   5. Modal calls parent's onConfirm({printedAt, label}) which:
 *        a. Awaits `refresher.recordPrintBatch(payload)` (W-URC-3 → IDB write
 *           → REFRESHER_BATCH_APPENDED dispatch updating staleness baseline).
 *        b. On success: calls `window.print()`. Browser opens the system print
 *           dialog. Owner can dismiss without printing — the batch is already
 *           recorded, which is correct (the laminate is the owner's choice; the
 *           record exists for staleness diff regardless).
 *        c. On failure: re-throws so this modal surfaces the error inline.
 *
 * Unlike SuppressConfirmModal, no checkbox gate — printing is a normal owner
 * action. Print is owner-initiated per red line #15 by virtue of the modal
 * existing at all (it cannot be triggered programmatically without owner
 * tapping into PrintPreview first).
 *
 * Copy is CD-clean: factual, no engagement, no urgency.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

const PAGE_SIZE_LABELS = { letter: 'Letter', a4: 'A4' };
const COLOR_MODE_LABELS = { auto: 'Color (auto)', bw: 'Black & white' };

/**
 * Returns today's date in YYYY-MM-DD format (the value shape native
 * `<input type="date">` consumes + emits).
 */
function todayIsoDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * @param {object} props
 * @param {object} props.context - { cardIds, perCardSnapshots, cardCount, pageCount, pageSize, cardsPerSheet, colorMode }
 * @param {Function} props.onConfirm - async ({ printedAt, label }) => void; parent calls
 *   recordPrintBatch + window.print(). Re-throws on writer rejection so modal can
 *   surface the error inline.
 * @param {Function} props.onCancel - Called when modal dismissed (Cancel / Esc / backdrop).
 */
export const PrintConfirmationModal = ({ context, onConfirm, onCancel }) => {
  const [printedAt, setPrintedAt] = useState(todayIsoDate());
  const [label, setLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef(null);

  // Esc closes (when not submitting; mirrors SuppressConfirmModal pattern).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) {
        e.stopPropagation();
        onCancel && onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  // Initial focus — for keyboard users (mirrors SuppressConfirmModal).
  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.focus();
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    if (!printedAt) {
      setErrorMessage('Date is required.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      await onConfirm({
        printedAt,
        label: label.trim() === '' ? null : label.trim(),
      });
      // Parent unmounts the modal on success.
    } catch (err) {
      setErrorMessage(err && err.message ? err.message : 'Failed to record print batch.');
      setSubmitting(false);
    }
  }, [submitting, printedAt, label, onConfirm]);

  const cardCount = (context && context.cardCount) || 0;
  const pageCount = (context && context.pageCount) || 0;
  const pageSizeLabel = PAGE_SIZE_LABELS[(context && context.pageSize) || 'letter'] || 'Letter';
  const cardsPerSheet = (context && context.cardsPerSheet) || 12;
  const colorModeLabel = COLOR_MODE_LABELS[(context && context.colorMode) || 'auto'] || 'Color (auto)';

  return (
    <div
      className="refresher-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onCancel && onCancel();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-confirm-title"
        tabIndex={-1}
        className="refresher-modal-print-confirm"
        style={{
          width: '100%',
          maxWidth: '32rem',
          background: '#1f2937',
          color: '#e5e7eb',
          border: '1px solid #374151',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          outline: 'none',
        }}
      >
        <h2
          id="print-confirm-title"
          style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
        >
          Confirm batch print
        </h2>

        {/* Batch summary */}
        <p
          style={{
            marginTop: '0.75rem',
            fontSize: '0.875rem',
            color: '#d1d5db',
            lineHeight: 1.4,
          }}
        >
          You are about to print <strong>{cardCount}</strong> card{cardCount === 1 ? '' : 's'}{' '}
          across <strong>{pageCount}</strong> page{pageCount === 1 ? '' : 's'} on{' '}
          <strong>{pageSizeLabel}</strong> at <strong>{cardsPerSheet}-up</strong>{' '}
          (<strong>{colorModeLabel}</strong>).
        </p>

        {/* Date input — printedAt */}
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            marginTop: '1rem',
            fontSize: '0.875rem',
            color: '#e5e7eb',
          }}
        >
          <span style={{ fontWeight: 500 }}>Print date</span>
          <input
            type="date"
            value={printedAt}
            onChange={(e) => setPrintedAt(e.target.value)}
            disabled={submitting}
            aria-label="Print date"
            data-printed-at={printedAt}
            style={{
              minHeight: 44,
              padding: '0.5rem 0.75rem',
              background: '#111827',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            Stamped on cards and used for staleness diff. Edit if printing for a past date.
          </span>
        </label>

        {/* Optional label input */}
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            marginTop: '0.75rem',
            fontSize: '0.875rem',
            color: '#e5e7eb',
          }}
        >
          <span style={{ fontWeight: 500 }}>Batch label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={submitting}
            placeholder="Home game refresh, monthly review, etc."
            aria-label="Batch label"
            maxLength={120}
            style={{
              minHeight: 44,
              padding: '0.5rem 0.75rem',
              background: '#111827',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          />
        </label>

        {/* Reminder copy — factual per CD-1 */}
        <ul
          style={{
            marginTop: '1rem',
            paddingLeft: '1.25rem',
            fontSize: '0.8125rem',
            color: '#9ca3af',
            lineHeight: 1.5,
          }}
        >
          <li>Disable browser headers and footers for best laminate result.</li>
          <li>If a card is cut off, check the page-size setting.</li>
        </ul>

        {errorMessage && (
          <div
            role="alert"
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: '#7f1d1d',
              color: '#fee2e2',
              border: '1px solid #b91c1c',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '1.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => !submitting && onCancel && onCancel()}
            disabled={submitting}
            style={{
              minHeight: 44,
              padding: '0.5rem 1rem',
              background: '#374151',
              color: '#e5e7eb',
              border: '1px solid #4b5563',
              borderRadius: '0.375rem',
              cursor: submitting ? 'wait' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !printedAt}
            aria-disabled={submitting || !printedAt}
            style={{
              minHeight: 44,
              padding: '0.5rem 1rem',
              background: submitting || !printedAt ? '#4b5563' : '#0f766e',
              color: '#fff',
              border: '1px solid ' + (submitting || !printedAt ? '#374151' : '#14b8a6'),
              borderRadius: '0.375rem',
              cursor: submitting || !printedAt ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Recording…' : 'Confirm and open print dialog →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintConfirmationModal;
