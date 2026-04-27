/**
 * AnchorEmptyState.jsx — Empty-state messages for AnchorLibraryView.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Empty states". Variants:
 *   - `newcomer`: hands-seen below ANCHOR_LIBRARY_UNLOCK_THRESHOLD. Copy is
 *     matter-of-fact ("Anchors unlock after N hands — your progress: M / N");
 *     no progress bar per AP-04 / red line #5 (no gamification, no streaks).
 *   - `zero-anchors`: post-threshold but no anchors authored yet (Phase 8
 *     matcher hasn't shipped or hasn't fired). Copy is editor's-note tone.
 *   - `zero-filter-matches` (S19): post-threshold + anchors exist but active
 *     filters exclude all of them. "No anchors match your filters." with
 *     active "Clear filters" button wired through `onClearFilters` callback.
 *
 * Deferred:
 *   - `pre-seeding`: skeleton loader; not needed today (IDB hydration is fast).
 *   - `all-retired`: requires retirement data, which doesn't exist yet.
 *
 * Pure render — receives variant + counts + callbacks via props. Parent
 * (AnchorLibraryView) decides which variant to render.
 *
 * EAL Phase 6 — Session 18 (S18) + Session 19 (S19, zero-filter-matches).
 */

import React from 'react';
import { ANCHOR_LIBRARY_UNLOCK_THRESHOLD } from '../../../constants/anchorLibraryConstants';

/**
 * @param {Object} props
 * @param {'newcomer' | 'zero-anchors' | 'zero-filter-matches'} props.variant
 * @param {number} [props.handsSeen] — current hand count; required for 'newcomer'.
 * @param {number} [props.threshold] — override unlock threshold; defaults to constant.
 * @param {() => void} [props.onClearFilters] — wired to "Clear filters" button on 'zero-filter-matches' only.
 */
export const AnchorEmptyState = ({
  variant,
  handsSeen = 0,
  threshold = ANCHOR_LIBRARY_UNLOCK_THRESHOLD,
  onClearFilters,
}) => {
  if (variant === 'newcomer') {
    const progress = Math.max(0, Math.min(handsSeen, threshold));
    return (
      <div
        data-testid="anchor-library-empty-state"
        data-variant="newcomer"
        role="status"
        style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.875rem',
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#d1d5db' }}>
          Anchors unlock after {threshold} hands — your progress: {progress} / {threshold}
        </p>
        <p style={{ margin: 0 }}>
          The library activates once enough hands have been reviewed to calibrate the first anchors.
        </p>
      </div>
    );
  }

  if (variant === 'zero-filter-matches') {
    const handleClick = () => {
      if (typeof onClearFilters === 'function') onClearFilters();
    };
    return (
      <div
        data-testid="anchor-library-empty-state"
        data-variant="zero-filter-matches"
        role="status"
        style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.875rem',
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: '0 0 0.75rem 0', fontWeight: 600, color: '#d1d5db' }}>
          No anchors match your filters.
        </p>
        <button
          type="button"
          onClick={handleClick}
          aria-label="Clear all filters"
          style={{
            minHeight: 36,
            padding: '0.375rem 0.875rem',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
          }}
        >
          Clear filters
        </button>
      </div>
    );
  }

  // 'zero-anchors' variant (default fallthrough)
  return (
    <div
      data-testid="anchor-library-empty-state"
      data-variant="zero-anchors"
      role="status"
      style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '0.875rem',
        lineHeight: 1.6,
      }}
    >
      <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#d1d5db' }}>
        No anchors in your library yet.
      </p>
      <p style={{ margin: 0 }}>
        The library will populate as the matcher detects patterns in your sessions.
      </p>
    </div>
  );
};

export default AnchorEmptyState;
