/**
 * LineageModal.jsx — read-only 7-field lineage modal.
 *
 * Per `docs/design/surfaces/printable-refresher.md` §LineageModal. Opens
 * from CardDetail "Where does this number come from?" CTA. Renders the
 * 7-field lineage as a labeled list. No actions — pure read.
 *
 * Red line #12 (lineage-mandatory): every card carries a 7-field lineage
 * footer. This modal is the in-app surface that exposes the same fields
 * the print-time footer would render.
 *
 * PRF Phase 5 — Session 19 (PRF-G5-UI).
 */

import React, { useEffect, useRef } from 'react';
import { derive7FieldLineage } from '../../../utils/printableRefresher/lineage';

const FIELD_LABELS = {
  cardIdSemver: '1. Card ID + version',
  generationDate: '2. Generated',
  sourceUtilTrail: '3. Source util',
  engineAppVersion: '4. Engine + app version',
  theoryCitation: '5. Theory citation',
  assumptionBundle: '6. Assumption bundle',
  bucketDefinitionsCited: '7. Bucket definitions',
};

/**
 * @param {object} props
 * @param {object} props.manifest - Card manifest from registry.
 * @param {object} [props.runtime] - { engineVersion, appVersion } for the lineage footer.
 * @param {Function} props.onClose
 */
export const LineageModal = ({ manifest, runtime, onClose }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose && onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.focus();
    }
  }, []);

  if (!manifest) return null;

  const lineage = derive7FieldLineage(manifest, runtime || {});

  return (
    <div
      className="refresher-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose && onClose();
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
        aria-labelledby="lineage-modal-title"
        tabIndex={-1}
        className="refresher-modal-lineage"
        style={{
          width: '100%',
          maxWidth: '36rem',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#1f2937',
          color: '#e5e7eb',
          border: '1px solid #374151',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          outline: 'none',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h2
            id="lineage-modal-title"
            style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
          >
            Lineage — {manifest.cardId}
          </h2>
          <button
            type="button"
            aria-label="Close lineage modal"
            onClick={() => onClose && onClose()}
            style={{
              minWidth: 36,
              minHeight: 36,
              padding: '0.25rem 0.5rem',
              background: 'transparent',
              color: '#9ca3af',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </header>

        <dl
          className="refresher-lineage-fields"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(8rem, max-content) 1fr',
            gap: '0.4rem 0.75rem',
            margin: 0,
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            fontFamily: 'Menlo, Consolas, monospace',
          }}
        >
          {Object.entries(FIELD_LABELS).map(([key, label]) => {
            const value = lineage[key];
            const displayValue =
              value === null || value === undefined
                ? '(not applicable)'
                : String(value);
            return (
              <React.Fragment key={key}>
                <dt
                  style={{
                    color: '#9ca3af',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </dt>
                <dd
                  data-field-key={key}
                  style={{
                    margin: 0,
                    color: '#e5e7eb',
                    wordBreak: 'break-word',
                  }}
                >
                  {displayValue}
                </dd>
              </React.Fragment>
            );
          })}
        </dl>

        <footer
          style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #374151',
            fontSize: '0.75rem',
            color: '#6b7280',
          }}
        >
          Red line #12 — lineage-mandatory. Every card carries a 7-field lineage footer.
        </footer>
      </div>
    </div>
  );
};

export default LineageModal;
