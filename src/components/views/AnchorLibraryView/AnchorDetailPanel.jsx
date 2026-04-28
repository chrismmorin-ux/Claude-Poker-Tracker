/**
 * AnchorDetailPanel.jsx — inline transparency panel revealed by long-press / ⓘ-tap.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Expanded (long-press / ⓘ-tap)":
 *   1. Observed rate row — `Tier 2 calibrationGap[anchor]` if present
 *   2. Predicted rate row — `gtoBaseline.referenceRate` + method attribution
 *   3. Perception model — list of `perceptionPrimitiveIds` resolved by name
 *   4. Status — full text mapping
 *   5. Last fired — relative time
 *   6. Deep-link button (stub at S20 — Calibration Dashboard not yet built)
 *   7. Override actions (stubs at S20 — retirement journey not yet wired)
 *
 * AP-06 copy discipline (model-accuracy framing — never grade the observer):
 *   - "Model's predicted rate" ✓ NOT "Your accuracy" ✗
 *   - "Observed rate" ✓ NOT "How well you've been doing" ✗
 *   - "Last fired" ✓ NOT "Last time you nailed it" ✗
 * Each ✗ pattern asserted absent in tests via DOM scan.
 *
 * S20 stub boundaries (deferred to later sessions):
 *   - Override action buttons render but invoke `onOverrideAction(action, anchorId)`
 *     which the parent surfaces via toast ("Retirement flow ships in S21").
 *   - Deep-link button renders with `aria-disabled="true"` and tooltip "Opens
 *     once Calibration Dashboard ships." Invokes `onOpenDashboard(anchorId)`
 *     if provided (parent shows toast).
 *
 * EAL Phase 6 — Session 20 (S20).
 */

import React, { useMemo } from 'react';
import { PERCEPTION_PRIMITIVE_SEEDS } from '../../../utils/anchorLibrary/perceptionPrimitiveSeed';

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

const STATUS_FULL_TEXT = {
  active: 'active — calibration within target zone',
  retired: 'retired — owner-finalized, not firing on live surfaces',
  expiring: 'expiring — retirement pending at session-close per retirement condition',
  suppressed: 'suppressed — owner muted; available to un-suppress',
  candidate: 'candidate — sub-threshold quality; not firing on live surfaces',
};

/**
 * Format an ISO 8601 timestamp into a relative-time string. Pure.
 *
 * Examples:
 *   - "just now" (< 1 min)
 *   - "5 min ago"
 *   - "3 hours ago"
 *   - "2 days ago"
 *   - "3 weeks ago"
 *   - "never" (null/undefined input)
 *   - "—" (malformed)
 */
export const formatRelativeTime = (iso, now = Date.now()) => {
  if (iso === null || iso === undefined) return 'never';
  if (typeof iso !== 'string' || iso.length === 0) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const deltaMs = now - t;
  if (deltaMs < 0) return 'in the future';
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

/**
 * Build a quick lookup map of perception primitive id → record. Lazy-init at module
 * load — primitive seeds are static module data, no DB roundtrip needed.
 */
const PRIMITIVE_BY_ID = (() => {
  const map = new Map();
  for (const p of PERCEPTION_PRIMITIVE_SEEDS) map.set(p.id, p);
  return map;
})();

const formatPercent = (n) => {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return `${Math.round(n * 100)}%`;
};

const formatCI = (ci) => {
  if (!ci || typeof ci !== 'object') return null;
  const lower = formatPercent(ci.lower);
  const upper = formatPercent(ci.upper);
  if (lower === '—' || upper === '—') return null;
  return `${lower}-${upper}`;
};

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.anchor — ExploitAnchor record
 * @param {() => void} [props.onCollapse] — invoked when ▲ collapse button is tapped
 * @param {(action: 'retire'|'suppress'|'reset', anchorId: string) => void} [props.onOverrideAction]
 * @param {(anchorId: string) => void} [props.onOpenDashboard]
 */
export const AnchorDetailPanel = ({
  anchor,
  onCollapse,
  onOverrideAction,
  onOpenDashboard,
}) => {
  if (!anchor || typeof anchor !== 'object') return null;

  const anchorId = typeof anchor.id === 'string' ? anchor.id : '';
  const status = typeof anchor.status === 'string' ? anchor.status : 'candidate';
  const statusFullText = STATUS_FULL_TEXT[status] || `${status} — status detail unavailable`;

  // Tier 2 calibrationGap is optional — anchors at seed-only state won't have it yet.
  const calibrationGap = anchor.calibrationGap;
  const observedRate = calibrationGap?.observedRate;
  const observedCI = calibrationGap?.observedCI;
  const observedSampleSize = typeof calibrationGap?.observedSampleSize === 'number'
    ? calibrationGap.observedSampleSize
    : null;
  const hasObserved = typeof observedRate === 'number';

  // Predicted rate from gtoBaseline (always present per validateAnchor).
  const predictedRate = typeof anchor.gtoBaseline?.referenceRate === 'number'
    ? anchor.gtoBaseline.referenceRate
    : null;
  const gtoMethod = typeof anchor.gtoBaseline?.method === 'string'
    ? anchor.gtoBaseline.method
    : null;

  const lastFiredAt = anchor.validation?.lastFiredAt || null;
  const lastFiredText = formatRelativeTime(lastFiredAt);

  const primitiveIds = Array.isArray(anchor.perceptionPrimitiveIds)
    ? anchor.perceptionPrimitiveIds
    : [];

  const resolvedPrimitives = useMemo(() => {
    return primitiveIds.map((id) => {
      const seed = PRIMITIVE_BY_ID.get(id);
      return {
        id,
        name: seed?.name || null,
      };
    });
  }, [primitiveIds]);

  const handleOverride = (action) => () => {
    if (typeof onOverrideAction === 'function') onOverrideAction(action, anchorId);
  };

  const handleOpenDashboard = () => {
    if (typeof onOpenDashboard === 'function') onOpenDashboard(anchorId);
  };

  return (
    <div
      data-testid="anchor-detail-panel"
      data-anchor-id={anchorId}
      role="region"
      aria-label={`Transparency details for ${anchor.archetypeName || 'anchor'}`}
      style={{
        marginTop: '0.625rem',
        padding: '0.75rem',
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '0.375rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        fontSize: '0.8125rem',
        color: '#d1d5db',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Collapse indicator (▲) — primary collapse target */}
      {typeof onCollapse === 'function' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse details"
            data-testid="anchor-detail-panel-collapse"
            style={{
              minHeight: 32,
              minWidth: 32,
              padding: '0.25rem 0.5rem',
              background: 'transparent',
              color: '#9ca3af',
              border: '1px solid #374151',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            ▲ Collapse
          </button>
        </div>
      )}

      {/* Section 1 — Observed rate */}
      <div data-testid="panel-row-observed">
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Observed rate: </span>
        {hasObserved ? (
          <span>
            <strong>{formatPercent(observedRate)}</strong>
            {formatCI(observedCI) && (
              <span style={{ color: '#9ca3af' }}> (CI {formatCI(observedCI)}{observedSampleSize !== null ? `, n=${observedSampleSize}` : ''})</span>
            )}
            {!formatCI(observedCI) && observedSampleSize !== null && (
              <span style={{ color: '#9ca3af' }}> (n={observedSampleSize})</span>
            )}
          </span>
        ) : (
          <span style={{ color: '#9ca3af' }}>Not yet observed (n=0)</span>
        )}
      </div>

      {/* Section 2 — Predicted rate */}
      <div data-testid="panel-row-predicted">
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Model's predicted rate: </span>
        {predictedRate !== null ? (
          <span>
            <strong>{formatPercent(predictedRate)}</strong>
            {gtoMethod && (
              <span style={{ color: '#9ca3af' }}> (GTO baseline: {gtoMethod})</span>
            )}
          </span>
        ) : (
          <span style={{ color: '#9ca3af' }}>Unavailable</span>
        )}
      </div>

      {/* Section 3 — Perception model */}
      <div data-testid="panel-row-perception">
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Perception model: </span>
        {resolvedPrimitives.length === 0 ? (
          <span style={{ color: '#9ca3af' }}>None</span>
        ) : (
          <ul
            style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', listStyle: 'disc' }}
            data-testid="panel-perception-list"
          >
            {resolvedPrimitives.map(({ id, name }) => (
              <li key={id} data-primitive-id={id}>
                <strong>{id}</strong>
                {name ? <span> — {name}</span> : <span style={{ color: '#9ca3af' }}> — (name unavailable)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Section 4 — Status */}
      <div data-testid="panel-row-status">
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Status: </span>
        <span>{statusFullText}</span>
      </div>

      {/* Section 5 — Last fired */}
      <div data-testid="panel-row-last-fired">
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Last fired: </span>
        <span>{lastFiredText}</span>
      </div>

      {/* Section 6 — Deep-link to Calibration Dashboard (stub) */}
      <div style={{ marginTop: '0.25rem' }}>
        <button
          type="button"
          onClick={handleOpenDashboard}
          aria-label="Open Calibration Dashboard for this anchor"
          aria-disabled="true"
          data-testid="panel-deep-link-dashboard"
          title="Opens once Calibration Dashboard ships."
          style={{
            minHeight: 40,
            padding: '0.5rem 0.75rem',
            background: '#1f2937',
            color: '#9ca3af',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            opacity: 0.65,
          }}
        >
          Open Calibration Dashboard for this anchor →
        </button>
      </div>

      {/* Section 7 — Override actions (status-conditional per journey doc).
          Active/expiring/candidate → [Retire] [Suppress] [Reset]
          Retired/suppressed       → [Re-enable] (un-retirement, Variation E) */}
      <div
        data-testid="panel-overrides"
        data-actions-variant={status === 'retired' || status === 'suppressed' ? 're-enable' : 'override'}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #1f2937',
        }}
      >
        {(status === 'retired' || status === 'suppressed') ? (
          <button
            type="button"
            onClick={handleOverride('re-enable')}
            aria-label={`Re-enable anchor ${anchor.archetypeName || ''}`.trim()}
            data-testid="panel-action-re-enable"
            data-action="re-enable"
            style={{
              minHeight: 40,
              padding: '0.5rem 0.75rem',
              background: '#1f2937',
              color: '#86efac',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Re-enable
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleOverride('retire')}
              aria-label={`Retire anchor ${anchor.archetypeName || ''}`.trim()}
              data-testid="panel-action-retire"
              data-action="retire"
              style={{
                minHeight: 40,
                padding: '0.5rem 0.75rem',
                background: '#1f2937',
                color: '#fca5a5',
                border: '1px solid #374151',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Retire
            </button>
            <button
              type="button"
              onClick={handleOverride('suppress')}
              aria-label={`Suppress anchor ${anchor.archetypeName || ''}`.trim()}
              data-testid="panel-action-suppress"
              data-action="suppress"
              style={{
                minHeight: 40,
                padding: '0.5rem 0.75rem',
                background: '#1f2937',
                color: '#fcd34d',
                border: '1px solid #374151',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Suppress
            </button>
            <button
              type="button"
              onClick={handleOverride('reset')}
              aria-label={`Reset calibration for ${anchor.archetypeName || ''}`.trim()}
              data-testid="panel-action-reset"
              data-action="reset"
              style={{
                minHeight: 40,
                padding: '0.5rem 0.75rem',
                background: '#1f2937',
                color: '#a7f3d0',
                border: '1px solid #374151',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Reset calibration
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AnchorDetailPanel;
