/**
 * RetirementConfirmModal.jsx — shared confirmation modal for the retirement journey.
 *
 * Per `docs/design/journeys/anchor-retirement.md` §"Observations":
 *   "Cross-surface consistency. Retirement action on `anchor-library` OR
 *    `calibration-dashboard` enters the same journey with same confirm sheet
 *    + copy + toast. Single source of truth: `RetirementConfirmModal.jsx`
 *    (Phase 5) is used by both entry points. No drift."
 *
 * Renders:
 *   - title (e.g., "Retire {archetypeName}?")
 *   - subText (consequences + reversibility)
 *   - destructive checkbox (Reset only — gates the confirm button)
 *   - Cancel + Confirm buttons (≥44×44 tap targets)
 *
 * Accessibility:
 *   - Native `<dialog open>` element with `aria-modal="true"` for focus-trap
 *   - Escape closes (browser native dialog behavior)
 *   - Backdrop click closes (manual handler)
 *   - Initial focus moves to Cancel button (less destructive default)
 *
 * Pure-props. The orchestrator hook (`useAnchorRetirement`) owns the open/close
 * + dispatch logic; this component renders + reports user intent.
 *
 * EAL Phase 6 — Session 21 (S21).
 */

import React, { useEffect, useRef, useState } from 'react';

/**
 * @param {Object} props
 * @param {Object|null} props.copy — bundle from buildRetirementCopy(); null hides modal
 * @param {() => void} props.onCancel
 * @param {() => void} props.onConfirm
 */
export const RetirementConfirmModal = ({ copy, onCancel, onConfirm }) => {
  const [understood, setUnderstood] = useState(false);
  const cancelBtnRef = useRef(null);
  const dialogRef = useRef(null);

  // Reset checkbox + initial focus on each open.
  useEffect(() => {
    if (!copy) return;
    setUnderstood(false);
    const t = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [copy?.action, copy?.anchorId]);

  // Escape key — close the modal. (Native <dialog> does this too, but we keep
  // an explicit handler for non-dialog fallback if styling forces a div.)
  useEffect(() => {
    if (!copy) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof onCancel === 'function') onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copy, onCancel]);

  if (!copy) return null;

  const isDestructive = copy.destructive === true;
  const confirmDisabled = isDestructive && !understood;

  const handleBackdropClick = (e) => {
    // Click on the backdrop (outermost wrapper) — close.
    if (e.target === e.currentTarget && typeof onCancel === 'function') {
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (confirmDisabled) return;
    if (typeof onConfirm === 'function') onConfirm();
  };

  const handleCancel = () => {
    if (typeof onCancel === 'function') onCancel();
  };

  return (
    <div
      data-testid="retirement-modal-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="retirement-modal-title"
        aria-describedby="retirement-modal-subtext"
        data-testid="retirement-modal"
        data-action={copy.action}
        data-destructive={isDestructive ? 'true' : 'false'}
        style={{
          background: '#1f2937',
          color: '#e5e7eb',
          border: '1px solid #374151',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          maxWidth: '460px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <h2
          id="retirement-modal-title"
          data-testid="retirement-modal-title"
          style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}
        >
          {copy.title}
        </h2>

        <p
          id="retirement-modal-subtext"
          data-testid="retirement-modal-subtext"
          style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.55, color: '#d1d5db' }}
        >
          {copy.subText}
        </p>

        {isDestructive && (
          <label
            data-testid="retirement-modal-destructive-checkbox-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              color: '#fcd34d',
              padding: '0.5rem',
              background: '#1c1917',
              border: '1px solid #44403c',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              data-testid="retirement-modal-destructive-checkbox"
              style={{ minWidth: 18, minHeight: 18, accentColor: '#f59e0b' }}
            />
            <span>{copy.destructiveCheckboxLabel}</span>
          </label>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '0.25rem',
          }}
        >
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={handleCancel}
            data-testid="retirement-modal-cancel"
            style={{
              minHeight: 44,
              minWidth: 88,
              padding: '0.5rem 0.875rem',
              background: '#374151',
              color: '#e5e7eb',
              border: '1px solid #4b5563',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {copy.cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            aria-disabled={confirmDisabled ? 'true' : undefined}
            data-testid="retirement-modal-confirm"
            data-confirm-disabled={confirmDisabled ? 'true' : 'false'}
            style={{
              minHeight: 44,
              minWidth: 100,
              padding: '0.5rem 0.875rem',
              background: isDestructive ? '#b91c1c' : '#1d4ed8',
              color: '#f9fafb',
              border: '1px solid transparent',
              borderRadius: '0.375rem',
              cursor: confirmDisabled ? 'not-allowed' : 'pointer',
              opacity: confirmDisabled ? 0.5 : 1,
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RetirementConfirmModal;
