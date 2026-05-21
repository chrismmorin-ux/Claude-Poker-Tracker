/**
 * EnrollmentStateBanner — informational banner rendered only when
 * `observation_enrollment_state === 'not-enrolled'`.
 *
 * Single-render per visit; no nag, no dismiss button (banner is state-driven).
 * Copy from `buildEnrollmentBannerCopy()` — AP-06 forbidden patterns are
 * structurally absent (factual framing, no engagement-pressure).
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React from 'react';
import { buildEnrollmentBannerCopy } from '../../../utils/anchorLibrary/calibrationCopy';

export const EnrollmentStateBanner = ({ onOpenSettings }) => {
  const { message, ctaLabel } = buildEnrollmentBannerCopy();
  return (
    <div
      data-testid="enrollment-state-banner"
      role="status"
      aria-live="polite"
      style={{
        marginBottom: '0.75rem',
        padding: '0.625rem 0.75rem',
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '0.375rem',
        color: '#e5e7eb',
        fontSize: '0.8125rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: 1, minWidth: '12rem' }}>{message}</span>
      {typeof onOpenSettings === 'function' && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={ctaLabel}
          style={{
            minHeight: 36,
            padding: '0.375rem 0.75rem',
            background: '#374151',
            color: '#e5e7eb',
            border: '1px solid #4b5563',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
};

export default EnrollmentStateBanner;
