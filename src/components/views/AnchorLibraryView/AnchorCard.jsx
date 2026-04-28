/**
 * AnchorCard.jsx — collapsed per-anchor row + expanded transparency panel.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Card — AnchorCard" + §"Expanded".
 * S18 shipped the collapsed state with an inert ⓘ button; S20 wires up:
 *   - long-press detection via `useAnchorCardLongPress` (400ms threshold + motion-cancel)
 *   - ⓘ-tap → toggle expansion (same expansion target as long-press)
 *   - inline `<AnchorDetailPanel>` rendered when `isExpanded` is true
 *   - dynamic `aria-expanded` reflecting current state
 *
 * Collapse paths:
 *   - ▲ collapse button at top of panel (primary)
 *   - ⓘ tap when already expanded (toggle)
 *   - tap on the card body header outside the ⓘ button (when expanded)
 *
 * Anti-pattern compliance:
 *   - AP-04 — no scalar "calibration score" rendered.
 *   - Red line #5 — no streak indicator.
 *   - Red line #6 — retired anchors render with same structural prominence as active.
 *
 * EAL Phase 6 — Session 18 (S18) + Session 20 (S20 long-press + panel wiring).
 */

import React from 'react';
import { useAnchorCardLongPress } from '../../../hooks/useAnchorCardLongPress';
import { AnchorDetailPanel } from './AnchorDetailPanel';

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
 * @param {boolean} [props.isExpanded] — whether the transparency panel is shown
 * @param {(anchorId: string) => void} [props.onToggleExpand] — invoked by long-press OR ⓘ tap
 * @param {(action: 'retire'|'suppress'|'reset', anchorId: string) => void} [props.onOverrideAction]
 * @param {(anchorId: string) => void} [props.onOpenDashboard]
 * @param {() => void} [props.onLongPressFire] — invoked once when long-press successfully fires
 *   (used by parent to dismiss the first-run tooltip).
 */
export const AnchorCard = ({
  anchor,
  isExpanded = false,
  onToggleExpand,
  onOverrideAction,
  onOpenDashboard,
  onLongPressFire,
}) => {
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
  const anchorId = typeof anchor.id === 'string' ? anchor.id : '';

  const handleToggle = () => {
    if (typeof onToggleExpand === 'function' && anchorId) onToggleExpand(anchorId);
  };

  // Long-press wiring: pointer-handlers spread onto the article element.
  // Tooltip auto-dismiss: onLongPressFire fires once when timer completes.
  const { pressHandlers, isPressing } = useAnchorCardLongPress({
    onLongPress: () => {
      if (typeof onToggleExpand === 'function' && anchorId) onToggleExpand(anchorId);
    },
    onFire: typeof onLongPressFire === 'function' ? onLongPressFire : undefined,
  });

  const handleInfoTap = (e) => {
    e.stopPropagation();
    handleToggle();
  };

  const handleCollapse = () => {
    handleToggle();
  };

  return (
    <article
      data-testid="anchor-card"
      data-anchor-id={anchor.id || ''}
      data-status={status}
      data-expanded={isExpanded ? 'true' : 'false'}
      data-pressing={isPressing ? 'true' : 'false'}
      {...pressHandlers}
      style={{
        position: 'relative',
        padding: '0.75rem 0.875rem',
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        // Subtle visual feedback during press (per H-N06: discoverable affordance)
        boxShadow: isPressing ? 'inset 0 0 0 1px #4b5563' : 'none',
        transition: 'box-shadow 100ms ease-out',
        // Disable native text-selection so long-press doesn't trigger selection UI
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Disable iOS Safari long-press callout menu
        WebkitTouchCallout: 'none',
        // Touch-action: pan-y allows vertical scrolling but cancels horizontal swipes
        touchAction: 'pan-y',
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
          aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${archetypeName}`}
          aria-expanded={isExpanded ? 'true' : 'false'}
          data-testid="anchor-card-info"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0.25rem',
            background: 'transparent',
            color: isExpanded ? '#e5e7eb' : '#9ca3af',
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

      {/* S20 — Inline transparency panel */}
      {isExpanded && (
        <AnchorDetailPanel
          anchor={anchor}
          onCollapse={handleCollapse}
          onOverrideAction={onOverrideAction}
          onOpenDashboard={onOpenDashboard}
        />
      )}
    </article>
  );
};

export default AnchorCard;
