/**
 * SuppressConfirmModal.jsx — confirmation modal for class suppress / un-suppress.
 *
 * Per `docs/design/surfaces/printable-refresher.md` §Card-row action —
 * confirmation for Suppress. ≤2-tap flow:
 *   1. Owner taps ⛔ chip in CardRow → opens this modal.
 *   2. Owner ticks "I understand" checkbox + taps "Suppress class".
 *   3. Modal calls onConfirm() → parent dispatches W-URC-2b with
 *      `confirmed: true` (or `ownerInitiated: true` for un-suppress).
 *
 * The writer enforces both guards (defense-in-depth per WRITERS.md
 * §W-URC-2 Failure mode). UI also enforces — checkbox must be ticked
 * before the primary button enables. Cancel button always enabled.
 *
 * Copy is CD-clean: factual, no engagement copy, no urgency.
 *
 * PRF Phase 5 — Session 19 (PRF-G5-UI).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @param {object} props
 * @param {string} props.classId - The card class to suppress / un-suppress.
 * @param {boolean} props.currentlySuppressed - True if currently suppressed (modal shows un-suppress flow).
 * @param {Function} props.onConfirm - Called with no args after checkbox + Confirm.
 * @param {Function} props.onCancel - Called when modal dismissed (Cancel / Escape / backdrop).
 */
export const SuppressConfirmModal = ({
  classId,
  currentlySuppressed,
  onConfirm,
  onCancel,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef(null);

  // Esc closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel && onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Focus trap (initial focus on the dialog)
  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.focus();
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!acknowledged) return;
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      await onConfirm();
      // Parent unmounts the modal on success.
    } catch (err) {
      setErrorMessage(err && err.message ? err.message : 'Action failed');
      setSubmitting(false);
    }
  }, [acknowledged, submitting, onConfirm]);

  const action = currentlySuppressed ? 'Un-suppress' : 'Suppress';
  const titleCopy = currentlySuppressed
    ? `Un-suppress ${classId} class`
    : `Suppress ${classId} class`;
  const explainerCopy = currentlySuppressed
    ? `Cards in the ${classId} class will appear in the catalog and print-export again. Per-card pin and hide settings persist.`
    : `Cards in the ${classId} class will be hidden from default print-export. Per-card pin and hide settings remain. The setting persists across engine and app version updates.`;
  const checkboxCopy = currentlySuppressed
    ? 'I understand this will re-include the class in print-export.'
    : `I understand this will hide the ${classId} class from print-export.`;

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
        aria-labelledby="suppress-modal-title"
        tabIndex={-1}
        className="refresher-modal-suppress"
        style={{
          width: '100%',
          maxWidth: '28rem',
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
          id="suppress-modal-title"
          style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
        >
          {titleCopy}
        </h2>

        <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#d1d5db', lineHeight: 1.4 }}>
          {explainerCopy}
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '1rem',
            fontSize: '0.875rem',
            color: '#e5e7eb',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={submitting}
            style={{ marginTop: '0.2rem' }}
            aria-label="Acknowledge consequence"
          />
          <span>{checkboxCopy}</span>
        </label>

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
            disabled={!acknowledged || submitting}
            aria-disabled={!acknowledged || submitting}
            style={{
              minHeight: 44,
              padding: '0.5rem 1rem',
              background: acknowledged && !submitting ? '#7f1d1d' : '#4b5563',
              color: '#fee2e2',
              border: '1px solid ' + (acknowledged && !submitting ? '#b91c1c' : '#374151'),
              borderRadius: '0.375rem',
              cursor: acknowledged && !submitting ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Working…' : `${action} class`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuppressConfirmModal;
