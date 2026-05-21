/**
 * AnchorDetailPanel (Calibration Dashboard deep-dive variant).
 *
 * Distinct from `AnchorLibraryView/AnchorDetailPanel.jsx` (S20 long-press
 * transparency tooltip on the index surface). The dashboard's deep-dive panel
 * renders the full calibration story:
 *   1. Model-accuracy prose (AP-06 ladder via buildCalibrationProse)
 *   2. Stacked-card evidence list with per-origin badge (AP-08 — origin
 *      always visible per row; rows never summed into a single count)
 *   3. Perception primitives list with validity
 *   4. Override actions — Retire / Suppress / Reset (reuses useAnchorRetirement
 *      via callback). NO operator dial (DEFERRED to WS-176).
 *
 * AP-06 invariants enforced at component level:
 *   - All prose comes from `calibrationCopy.js` deterministic generator.
 *   - No template literals reference "your" / "you have" / "your accuracy".
 *   - Test `CalibrationDashboardView.test.jsx` runs FORBIDDEN_PATTERNS over
 *     rendered textContent.
 *
 * AP-08 invariants enforced at component level:
 *   - Each evidence row carries a `data-testid="origin-badge"` element.
 *   - Aggregate "X firings" labels split per-origin; matcher and
 *     owner-captured counts are never summed.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React, { useMemo } from 'react';
import { buildCalibrationProse } from '../../../utils/anchorLibrary/calibrationCopy';
import { OBSERVATION_ORIGINS } from '../../../constants/anchorLibraryConstants';

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatRelativeTime = (iso) => {
  if (!iso || typeof iso !== 'string') return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
};

const ORIGIN_BADGE_STYLE = Object.freeze({
  [OBSERVATION_ORIGINS.MATCHER_SYSTEM]: {
    label: '◆ matcher-system',
    color: '#60a5fa',
    border: '#1e40af',
  },
  [OBSERVATION_ORIGINS.OWNER_CAPTURED]: {
    label: '◆ owner-captured',
    color: '#fbbf24',
    border: '#92400e',
  },
});

const isRetiredOrSuppressed = (status) =>
  status === 'retired' || status === 'suppressed';

/**
 * Combined chronological merge of matcher + owner observations. AP-08
 * invariant: each row carries its origin; the merge does NOT collapse the
 * origin axis. Per surface spec §AnchorCalibrationPanel "Evidence list"
 * line 182 — "chronological mixed by origin (NOT grouped/blended into
 * per-origin sections — that would defeat AP-08's 'origin always visible
 * per row' guarantee)."
 */
const mergeChronological = (matcherFired, ownerCaptured) => {
  const merged = [
    ...matcherFired.map((o) => ({ ...o, origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM })),
    ...ownerCaptured.map((o) => ({ ...o, origin: OBSERVATION_ORIGINS.OWNER_CAPTURED })),
  ];
  // Most recent first for the dashboard view (reverse of the selector's
  // ascending sort — readers want recency).
  merged.sort((a, b) => {
    const ta = Date.parse(a.createdAt || '');
    const tb = Date.parse(b.createdAt || '');
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
  return merged;
};

const formatEvidenceMetric = (obs) => {
  if (!obs || typeof obs !== 'object') return '—';
  if (obs.origin === OBSERVATION_ORIGINS.OWNER_CAPTURED) return '(qualitative)';
  // matcher-system: prefer evDeltaBb, fall back to supportsClaim
  if (typeof obs.evDeltaBb === 'number' && Number.isFinite(obs.evDeltaBb)) {
    const sign = obs.evDeltaBb > 0 ? '+' : '';
    return `${sign}${obs.evDeltaBb.toFixed(2)} bb/pot`;
  }
  if (typeof obs.supportsClaim === 'boolean') {
    return obs.supportsClaim ? 'supports' : 'against';
  }
  return '—';
};

/**
 * @param {Object} props
 * @param {Object} props.anchor                 — ExploitAnchor record
 * @param {Object} props.calibration            — selectAnchorCalibration(anchor) output
 * @param {Object[]} [props.primitives]         — full perception-primitive list (for name resolution)
 * @param {(action: 'retire'|'suppress'|'reset', anchorId: string) => void} [props.onOverrideAction]
 */
export const AnchorDetailPanel = ({
  anchor,
  calibration,
  primitives = [],
  onOverrideAction,
}) => {
  if (!anchor || typeof anchor !== 'object') return null;
  if (!calibration || typeof calibration !== 'object') return null;

  const anchorId = typeof anchor.id === 'string' ? anchor.id : '';

  const proseText = useMemo(
    () => buildCalibrationProse(anchor, calibration),
    [anchor, calibration],
  );

  const primitiveById = useMemo(() => {
    const map = new Map();
    if (Array.isArray(primitives)) {
      for (const p of primitives) {
        if (p && typeof p.id === 'string') map.set(p.id, p);
      }
    }
    return map;
  }, [primitives]);

  const linkedPrimitives = useMemo(() => {
    const ids = Array.isArray(anchor.perceptionPrimitiveIds) ? anchor.perceptionPrimitiveIds : [];
    return ids.map((id) => ({
      id,
      name: primitiveById.get(id)?.name || null,
      validityPoint: primitiveById.get(id)?.validityScore?.pointEstimate ?? null,
    }));
  }, [anchor.perceptionPrimitiveIds, primitiveById]);

  const evidenceRows = useMemo(
    () => mergeChronological(calibration.matcherFired || [], calibration.ownerCaptured || []),
    [calibration.matcherFired, calibration.ownerCaptured],
  );

  const handleOverride = (action) => () => {
    if (typeof onOverrideAction === 'function') onOverrideAction(action, anchorId);
  };

  const showOverrideActions = !isRetiredOrSuppressed(calibration.status);

  return (
    <div
      data-testid="dashboard-anchor-detail-panel"
      data-anchor-id={anchorId}
      role="region"
      aria-label={`Calibration deep-dive for ${anchor.archetypeName || 'anchor'}`}
      style={{
        marginTop: '0.5rem',
        padding: '0.875rem',
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '0.375rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        fontSize: '0.8125rem',
        color: '#d1d5db',
      }}
    >
      {/* Section 1 — Model-accuracy prose (AP-06 ladder) */}
      <div data-testid="panel-prose">
        <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
          Model accuracy
        </div>
        <p
          data-testid="panel-prose-text"
          style={{ margin: 0, lineHeight: 1.5, color: '#e5e7eb' }}
        >
          {proseText}
        </p>
      </div>

      {/* Section 2 — Per-origin evidence count breakdown (AP-08 — never summed) */}
      <div
        data-testid="panel-origin-counts"
        style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          Matcher firings: <strong style={{ color: '#e5e7eb' }}>{calibration.sampleSizeMatcher}</strong>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          Owner-captured observations: <strong style={{ color: '#e5e7eb' }}>{calibration.sampleSizeOwner}</strong>
        </div>
      </div>

      {/* Section 3 — Stacked-card evidence list (AP-08 origin badge per row) */}
      <div data-testid="panel-evidence-list">
        <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.375rem' }}>
          Evidence (most recent first):
        </div>
        {evidenceRows.length === 0 ? (
          <div
            data-testid="panel-evidence-empty"
            style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.8125rem' }}
          >
            No firings or owner-captured observations recorded yet.
          </div>
        ) : (
          <ul
            data-testid="panel-evidence-cards"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            }}
          >
            {evidenceRows.slice(0, 10).map((obs, idx) => {
              const badge = ORIGIN_BADGE_STYLE[obs.origin] || ORIGIN_BADGE_STYLE[OBSERVATION_ORIGINS.MATCHER_SYSTEM];
              const key = obs.id || `${obs.origin}:${obs.createdAt || idx}`;
              return (
                <li
                  key={key}
                  data-testid="evidence-card"
                  data-origin={obs.origin}
                  style={{
                    padding: '0.5rem 0.625rem',
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    borderRadius: '0.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span
                      data-testid="origin-badge"
                      style={{
                        fontSize: '0.6875rem',
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        padding: '0.0625rem 0.375rem',
                        borderRadius: '0.25rem',
                      }}
                    >
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {formatRelativeTime(obs.createdAt)}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: '0.75rem', color: '#e5e7eb' }}>
                      {formatEvidenceMetric(obs)}
                    </span>
                  </div>
                  {obs.notes && (
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{obs.notes}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {evidenceRows.length > 10 && (
          <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.25rem' }}>
            Showing 10 most recent of {evidenceRows.length} total entries.
          </div>
        )}
      </div>

      {/* Section 4 — Perception primitives */}
      {linkedPrimitives.length > 0 && (
        <div data-testid="panel-primitives">
          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            Perception primitives:
          </div>
          <ul
            data-testid="panel-primitives-list"
            style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}
          >
            {linkedPrimitives.map(({ id, name, validityPoint }) => (
              <li key={id} data-primitive-id={id}>
                <strong>{id}</strong>
                {name && <span> — {name}</span>}
                {typeof validityPoint === 'number' && (
                  <span style={{ color: '#9ca3af' }}> (validity {formatPercent(validityPoint)})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 5 — Override actions (Retire / Suppress / Reset). NO operator dial.
          The dial is DEFERRED to WS-176 per Gate 4 spec amendment 2026-05-09. */}
      {showOverrideActions && (
        <div
          data-testid="panel-override-actions"
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          <button
            type="button"
            onClick={handleOverride('retire')}
            data-testid="override-retire"
            aria-label="Retire this anchor"
            style={overrideButtonStyle}
          >
            Retire
          </button>
          <button
            type="button"
            onClick={handleOverride('suppress')}
            data-testid="override-suppress"
            aria-label="Suppress this anchor"
            style={overrideButtonStyle}
          >
            Suppress
          </button>
          <button
            type="button"
            onClick={handleOverride('reset')}
            data-testid="override-reset"
            aria-label="Reset calibration for this anchor"
            style={overrideButtonStyle}
          >
            Reset calibration
          </button>
        </div>
      )}
    </div>
  );
};

const overrideButtonStyle = {
  minHeight: 40,
  padding: '0.5rem 0.875rem',
  background: '#1f2937',
  color: '#e5e7eb',
  border: '1px solid #4b5563',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

export default AnchorDetailPanel;
