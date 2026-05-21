/**
 * AutoRetireBanner.jsx — Tier-3 auto-retire review banner.
 *
 * Per `docs/design/surfaces/anchor-library.md` §AutoRetireBanner slot
 * (added SPR-060) + `docs/design/journeys/anchor-retirement.md`
 * Variation D step 3s.
 *
 * Renders when ≥1 anchor was auto-retired at the previous session-close
 * AND the founder has not yet dismissed the resulting prompt. One-shot
 * per session-close-with-transitions; dismissal persists across reloads
 * via localStorage (managed by useAnchorAutoRetire orchestrator).
 *
 * Hard rules (carried from journey + CLAUDE.md):
 *   - Cannot render mid-session — caller gates on session-end transition.
 *   - Copy passes AP-06 forbidden-pattern check at every count value.
 *   - No render for 'expiring' transitions; only confirmed 'retired'.
 *   - Tap targets ≥44×44 (WCAG SC 2.5.5; doctrine R-1.12).
 *
 * Pure render — receives count + callbacks. No internal state.
 *
 * EAL Phase 6 — SPR-060 / WS-170.
 */

import React from 'react';
import { buildAutoRetireBannerCopy } from '../../../utils/anchorLibrary/autoRetireBannerCopy';

/**
 * @param {Object} props
 * @param {number} props.count          — number of anchors auto-retired since last dismissal
 * @param {() => void} props.onReview   — fired when [Review] tapped
 * @param {() => void} props.onDismiss  — fired when [×] dismiss tapped
 */
export const AutoRetireBanner = ({ count, onReview, onDismiss }) => {
  const copy = buildAutoRetireBannerCopy({ count });
  if (!copy) return null;

  const handleReview = () => {
    if (typeof onReview === 'function') onReview();
  };

  const handleDismiss = () => {
    if (typeof onDismiss === 'function') onDismiss();
  };

  return (
    <div
      data-testid="auto-retire-banner"
      data-count={count}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        marginBottom: '0.75rem',
        background: '#1e293b',
        color: '#e5e7eb',
        border: '1px solid #334155',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        lineHeight: 1.5,
      }}
    >
      <span
        data-testid="auto-retire-banner-message"
        style={{ flex: 1, color: '#d1d5db' }}
      >
        {copy.message}
      </span>
      <button
        type="button"
        data-testid="auto-retire-banner-review"
        onClick={handleReview}
        style={{
          minHeight: 44,
          minWidth: 44,
          padding: '0.5rem 1rem',
          background: '#0f766e',
          color: '#f0fdfa',
          border: '1px solid #115e59',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        {copy.reviewLabel}
      </button>
      <button
        type="button"
        data-testid="auto-retire-banner-dismiss"
        onClick={handleDismiss}
        aria-label={copy.dismissAria}
        style={{
          minHeight: 44,
          minWidth: 44,
          padding: '0.5rem',
          background: '#1f2937',
          color: '#9ca3af',
          border: '1px solid #374151',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '1.125rem',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
};

export default AutoRetireBanner;
