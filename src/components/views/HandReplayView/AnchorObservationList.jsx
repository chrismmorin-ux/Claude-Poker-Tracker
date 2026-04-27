/**
 * AnchorObservationList.jsx — Inline list of captured observations for one hand.
 *
 * Per `docs/design/surfaces/hand-replay-observation-capture.md` §"Inline list —
 * AnchorObservationList". Renders one row per observation (chronological DESC),
 * expand-in-place on tap to show the full note. Tag-pill click is exposed via
 * `onTagClick` prop for the parent to deep-link into a filtered Anchor Library
 * (Phase 6+). Empty state renders nothing — the parent (Section G slot) keeps
 * the button visible regardless.
 *
 * Signal-separation contract (AP-08):
 *   - This list shows ONLY `origin === 'owner-captured'` observations.
 *   - `origin === 'matcher-system'` observations live on the Calibration
 *     Dashboard and are never visually fused with owner captures here.
 *   - Filter applied at render time defensively, even if the parent already
 *     filtered via `selectObservationsByHand`.
 *
 * Soft-cap: if >10 observations exist, render first 10 + "See all (N)" link
 * (parent supplies `onSeeAll`). Rare at MVP per spec.
 *
 * EAL Phase 6 Stream D B3 — Session 16 (2026-04-27).
 */

import React, { useMemo, useState, useCallback } from 'react';

const SOFT_CAP = 10;

/**
 * Compute a small, factual relative-time label.
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "2w ago".
 * For ages > ~30d, fall back to ISO date (YYYY-MM-DD) for unambiguity.
 *
 * @param {string} createdAt  ISO 8601
 * @param {number} [nowMs]    injected wall-clock for testability
 * @returns {string}
 */
export const formatRelativeTime = (createdAt, nowMs = Date.now()) => {
  if (typeof createdAt !== 'string' || createdAt.length === 0) return '';
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return '';
  const deltaMs = Math.max(0, nowMs - t);
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  // Fall back to ISO date for unambiguity beyond ~30 days
  return createdAt.slice(0, 10);
};

/**
 * @typedef {Object} AnchorObservationListItem
 * @property {string} id
 * @property {string} handId
 * @property {string[]} ownerTags
 * @property {string} createdAt
 * @property {string} [note]
 * @property {string} origin
 * @property {boolean} contributesToCalibration
 */

/**
 * @param {Object} props
 * @param {AnchorObservationListItem[]} props.observations
 *           — pre-filtered + chronologically sorted (DESC) by parent
 * @param {(tag: string) => void} [props.onTagClick]
 *           — invoked when a tag pill is tapped (parent deep-links to library)
 * @param {(count: number) => void} [props.onSeeAll]
 *           — invoked when "See all (N)" link is tapped (after soft-cap)
 * @param {() => number} [props.nowFn]
 *           — injected now() for stable relative-time rendering in tests
 */
export const AnchorObservationList = ({
  observations,
  onTagClick,
  onSeeAll,
  nowFn,
}) => {
  // Defensive filter — only render owner-captured observations (AP-08).
  const ownerCaptured = useMemo(() => {
    if (!Array.isArray(observations)) return [];
    return observations.filter((o) => o && o.origin === 'owner-captured');
  }, [observations]);

  const visible = ownerCaptured.slice(0, SOFT_CAP);
  const hidden = ownerCaptured.length - visible.length;

  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Empty state: render nothing (parent keeps button visible)
  if (ownerCaptured.length === 0) return null;

  const now = typeof nowFn === 'function' ? nowFn() : Date.now();

  return (
    <ul
      data-testid="anchor-observation-list"
      role="list"
      aria-label="Captured observations for this hand"
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '0.5rem 0 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      {visible.map((obs) => {
        const isExpanded = expandedIds.has(obs.id);
        const firstTag = Array.isArray(obs.ownerTags) ? obs.ownerTags[0] : '';
        const incognitoMarker = obs.contributesToCalibration === false ? ' · incognito' : '';
        return (
          <li
            key={obs.id}
            data-testid={`anchor-observation-row-${obs.id}`}
            data-incognito={obs.contributesToCalibration === false ? 'true' : 'false'}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              color: '#d1d5db',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => toggleExpanded(obs.id)}
                aria-expanded={isExpanded}
                aria-controls={`anchor-observation-note-${obs.id}`}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  background: 'transparent',
                  color: '#e5e7eb',
                  border: 'none',
                  padding: 0,
                  minHeight: 32,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                }}
              >
                · {firstTag || '(no tag)'}
              </button>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatRelativeTime(obs.createdAt, now)}
                {incognitoMarker}
              </span>
            </div>

            {/* Tag pills (only if more than one tag) */}
            {Array.isArray(obs.ownerTags) && obs.ownerTags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                  marginTop: '0.25rem',
                }}
              >
                {obs.ownerTags.map((tag) => (
                  <button
                    key={`${obs.id}:${tag}`}
                    type="button"
                    onClick={() => typeof onTagClick === 'function' && onTagClick(tag)}
                    aria-label={`Filter by tag ${tag}`}
                    style={{
                      padding: '0.125rem 0.5rem',
                      background: '#374151',
                      color: '#e5e7eb',
                      border: '1px solid #4b5563',
                      borderRadius: '999px',
                      fontSize: '0.6875rem',
                      cursor: typeof onTagClick === 'function' ? 'pointer' : 'default',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Expanded note */}
            {isExpanded && obs.note && (
              <p
                id={`anchor-observation-note-${obs.id}`}
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.8125rem',
                  color: '#d1d5db',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {obs.note}
              </p>
            )}
          </li>
        );
      })}

      {hidden > 0 && (
        <li style={{ marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => typeof onSeeAll === 'function' && onSeeAll(ownerCaptured.length)}
            aria-label={`See all ${ownerCaptured.length} observations`}
            style={{
              minHeight: 32,
              padding: '0.25rem 0.5rem',
              background: 'transparent',
              color: '#93c5fd',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              textDecoration: 'underline',
            }}
          >
            See all ({ownerCaptured.length})
          </button>
        </li>
      )}
    </ul>
  );
};

export default AnchorObservationList;
