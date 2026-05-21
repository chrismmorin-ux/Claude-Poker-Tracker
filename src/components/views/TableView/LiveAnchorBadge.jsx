/**
 * LiveAnchorBadge.jsx — Glanceable archetype-level badge for the live surface.
 *
 * Per `docs/design/surfaces/live-anchor-badge.md` (Gate 4 surface artifact)
 * + `docs/projects/exploit-anchor-library/anti-patterns.md` AP-07 hard floor.
 *
 * Renders ONLY:
 *   - Status dot glyph (active=●; non-active anchors are filtered upstream by
 *     the matcher's DEFAULT_LIVE_STATUSES so the runtime case is `active`)
 *   - Archetype name (≤ 3 words per H-PLT01; copy is socially-discreet per
 *     H-PLT04)
 *   - 10-segment confidence dial (visual only; numeric companion intentionally
 *     omitted to preserve glance budget)
 *
 * Does NOT render (AP-07 forbids):
 *   - Observed rate, sample size, credible interval (`evidence.*` raw fields)
 *   - Retirement state, expiring/retired/suppressed labels
 *   - Trend arrows, gap arrows, dividend metrics
 *   - Perception-primitive names (those live in study-mode AnchorDetailPanel)
 *
 * Tap → deferred drill (per AP-07 line 112). Dispatches `ANCHOR_BADGE_TAPPED`
 * carrying `{anchorId, tappedAt, handId}`. v1 has no immediate UI consequence;
 * v2 wires HandReplay (or a between-hands drill panel) to consume the queued
 * intent.
 *
 * Architecture: stateless presentational component. Stateful concerns
 * (matcher subscription, observation writer dispatch) live in the
 * `useExploitAnchorsForLive` hook + its caller in CommandStrip.
 */

import React from 'react';

const STATUS_GLYPHS = Object.freeze({
  active: '●',
  // non-active never reaches the live surface; map kept for parity with
  // AnchorCard's vocabulary.
  retired: '○',
  expiring: '◐',
  suppressed: '⊘',
  candidate: '?',
});

const STATUS_COLORS = Object.freeze({
  active: '#10b981',     // emerald-500
  retired: '#6b7280',    // gray-500
  expiring: '#f59e0b',   // amber-500
  suppressed: '#9ca3af', // gray-400
  candidate: '#6366f1',  // indigo-500
});

/**
 * 10-segment dial. Visual-only on live (no numeric companion). Identical
 * geometry to AnchorCard.jsx:58-76 but stripped of the `(0.50)` parens-numeric
 * to preserve glance budget per AP-07 spirit (calibration data minimal).
 */
const LiveConfidenceDial = ({ pointEstimate }) => {
  const value = typeof pointEstimate === 'number'
    ? Math.max(0, Math.min(1, pointEstimate))
    : 0;
  const filled = Math.round(value * 10);
  const percent = Math.round(value * 100);
  return (
    <span
      role="img"
      aria-label={`Confidence ${percent}% of 100%`}
      data-testid="live-anchor-badge-dial"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'monospace',
        letterSpacing: '0.05em',
        fontSize: '0.75rem',
        color: '#9ca3af',
      }}
    >
      {'■'.repeat(filled)}{'□'.repeat(10 - filled)}
    </span>
  );
};

/**
 * @param {Object} props
 * @param {Object|null} props.anchor — ExploitAnchor record, or null when no match
 * @param {string|null} [props.handId] — current hand id, threaded into tap dispatch
 * @param {(payload: {anchorId: string, tappedAt: string, handId: string|null}) => void} [props.onTap]
 *   — invoked on tap; caller dispatches `ANCHOR_BADGE_TAPPED`
 */
export const LiveAnchorBadge = ({ anchor, handId, onTap }) => {
  if (!anchor || typeof anchor !== 'object') return null;

  const archetypeName = typeof anchor.archetypeName === 'string' && anchor.archetypeName.length > 0
    ? anchor.archetypeName
    : '(unnamed anchor)';
  const status = typeof anchor.status === 'string' ? anchor.status : 'active';
  const statusGlyph = STATUS_GLYPHS[status] || STATUS_GLYPHS.active;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.active;
  const pointEstimate = anchor?.evidence?.pointEstimate;
  const anchorId = typeof anchor.id === 'string' ? anchor.id : '';

  const handleTap = (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof onTap === 'function') {
      onTap({
        anchorId,
        tappedAt: new Date().toISOString(),
        handId: typeof handId === 'string' ? handId : null,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      data-testid="live-anchor-badge"
      data-anchor-id={anchorId}
      aria-label={`Anchor pattern matched: ${archetypeName}. Tap for details after the hand.`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'transparent',
        border: 'none',
        padding: '3px 4px',
        marginTop: 3,
        cursor: 'pointer',
        color: '#d1d5db',
        fontSize: '0.75rem',
        // Tap target sits within an existing live-surface row; full row is
        // the practical target. Button is left-aligned per LiveAdviceBar
        // row-level convention.
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden="true"
        style={{ color: statusColor, fontSize: '0.875rem', lineHeight: 1 }}
      >
        {statusGlyph}
      </span>
      <span style={{ fontWeight: 600, color: '#e5e7eb', whiteSpace: 'nowrap' }}>
        {archetypeName}
      </span>
      <LiveConfidenceDial pointEstimate={pointEstimate} />
    </button>
  );
};

export default LiveAnchorBadge;
