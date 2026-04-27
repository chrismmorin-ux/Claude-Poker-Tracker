/**
 * AnchorCard.jsx — collapsed per-anchor row for AnchorLibraryView.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Card — AnchorCard". S18 ships
 * the collapsed state only; the long-press/ⓘ-tap transparency panel is
 * deferred to S20 along with `useAnchorCardLongPress`.
 *
 * S18 collapsed render:
 *   - Archetype name (wraps to 2 lines, ellipsis at 3+)
 *   - Status dot + chip (● active / ○ retired / ◐ expiring / ⊘ suppressed / ? candidate)
 *   - Tier chip
 *   - Street + polarity chips
 *   - Confidence dial (10-segment bar from evidence.pointEstimate)
 *   - Firing count (`fired N×`)
 *   - ⓘ icon (≥44×44 tap target; inert at S18, parent receives onInfoTap)
 *
 * Anti-pattern compliance:
 *   - AP-04 — no scalar "calibration score" rendered. Confidence dial is the
 *     only quantitative element + always displayed alongside the % alt-text.
 *   - Red line #5 — no streak indicator, no "this many anchors mastered."
 *   - Red line #6 — retired anchors render with same structural prominence
 *     as active; only the status dot/chip distinguishes them (no dimming
 *     beyond the `○` glyph + status chip text).
 *
 * EAL Phase 6 — Session 18 (S18).
 */

import React from 'react';

const STATUS_GLYPHS = {
  active: '●',
  retired: '○',
  expiring: '◐',
  suppressed: '⊘',
  candidate: '?',
};

const STATUS_COLORS = {
  active: '#10b981',     // emerald-500
  retired: '#6b7280',    // gray-500
  expiring: '#f59e0b',   // amber-500
  suppressed: '#9ca3af', // gray-400
  candidate: '#6366f1',  // indigo-500
};

/**
 * Derive the spot street from an anchor's lineSequence. Anchor spec uses the
 * last sequence entry as the actionable street (the spot the anchor names).
 */
const deriveStreet = (anchor) => {
  const seq = Array.isArray(anchor?.lineSequence) ? anchor.lineSequence : [];
  if (seq.length === 0) return null;
  return seq[seq.length - 1]?.street || null;
};

/**
 * Render the 10-segment confidence dial as filled/unfilled blocks.
 * `pointEstimate` is in [0, 1]; clamp + multiply by 10.
 */
const ConfidenceDial = ({ pointEstimate }) => {
  const value = typeof pointEstimate === 'number' ? Math.max(0, Math.min(1, pointEstimate)) : 0;
  const filled = Math.round(value * 10);
  const percent = Math.round(value * 100);
  return (
    <span
      role="img"
      aria-label={`Confidence ${percent}% of 100%`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
    >
      <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontSize: '0.75rem', color: '#9ca3af' }}>
        {'■'.repeat(filled)}{'□'.repeat(10 - filled)}
      </span>
      <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
        ({value.toFixed(2)})
      </span>
    </span>
  );
};

/**
 * @param {Object} props
 * @param {Object} props.anchor — ExploitAnchor record (see schema-delta §2)
 * @param {() => void} [props.onInfoTap] — invoked on ⓘ tap; inert at S18 if omitted
 */
export const AnchorCard = ({ anchor, onInfoTap }) => {
  if (!anchor || typeof anchor !== 'object') return null;

  const status = typeof anchor.status === 'string' ? anchor.status : 'candidate';
  const statusGlyph = STATUS_GLYPHS[status] || STATUS_GLYPHS.candidate;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.candidate;
  const street = deriveStreet(anchor);
  const polarity = typeof anchor.polarity === 'string' ? anchor.polarity : null;
  const tierLabel =
    typeof anchor.tier === 'number'
      ? `Tier ${anchor.tier}`
      : (typeof anchor.tier === 'string' ? anchor.tier : null);
  const pointEstimate = anchor?.evidence?.pointEstimate;
  const timesApplied = typeof anchor?.validation?.timesApplied === 'number'
    ? anchor.validation.timesApplied
    : 0;
  const archetypeName = typeof anchor.archetypeName === 'string' && anchor.archetypeName.length > 0
    ? anchor.archetypeName
    : '(unnamed anchor)';

  const handleInfoTap = () => {
    if (typeof onInfoTap === 'function') onInfoTap(anchor);
  };

  return (
    <article
      data-testid="anchor-card"
      data-anchor-id={anchor.id || ''}
      data-status={status}
      style={{
        position: 'relative',
        padding: '0.75rem 0.875rem',
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
      }}
    >
      {/* Top row: archetype name + ⓘ icon */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3
          style={{
            margin: 0,
            flex: 1,
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: '#e5e7eb',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {archetypeName}
        </h3>
        <button
          type="button"
          onClick={handleInfoTap}
          aria-label={`Show details for ${archetypeName}`}
          aria-expanded="false"
          data-testid="anchor-card-info"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0.25rem',
            background: 'transparent',
            color: '#9ca3af',
            border: '1px solid transparent',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          ⓘ
        </button>
      </div>

      {/* Status row: status chip · tier · street · polarity */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: '#d1d5db',
        }}
      >
        <span
          aria-label={`Status: ${status}`}
          style={{ color: statusColor, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <span aria-hidden="true">{statusGlyph}</span>
          <span>{status}</span>
        </span>
        {tierLabel && <span style={{ color: '#9ca3af' }}>· {tierLabel}</span>}
        {street && <span style={{ color: '#9ca3af' }}>· {street}</span>}
        {polarity && <span style={{ color: '#9ca3af' }}>· {polarity}</span>}
      </div>

      {/* Confidence dial + firing count */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.625rem',
          fontSize: '0.75rem',
        }}
      >
        <ConfidenceDial pointEstimate={pointEstimate} />
        <span style={{ color: '#9ca3af' }}>· fired {timesApplied}×</span>
      </div>
    </article>
  );
};

export default AnchorCard;
