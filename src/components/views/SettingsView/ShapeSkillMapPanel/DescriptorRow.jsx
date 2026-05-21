/**
 * DescriptorRow.jsx — single descriptor row for the Shape Skill Map.
 *
 * SLS Stream D — SPR-081 / WS-040. Read-only this sprint; recovery
 * affordances (Recalibrate / Mark as already known / Unmute) are
 * rendered as disabled buttons with a "Coming soon" tooltip to preserve
 * the eventual layout per `docs/design/surfaces/shape-skill-map.md`.
 *
 * I-SM-1 binding: `declared` and `posterior` render in SEPARATE DOM
 * regions. There is no fused-score field anywhere on this row. Tests
 * assert this via DOM-region presence + forbidden-field grep.
 */

import React from 'react';
import {
  betaCredibleInterval,
  betaMean,
  applyTemporalDecay,
} from '../../../../utils/skillAssessment/shapeLanguage';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const formatDaysAgo = (ms) => {
  if (typeof ms !== 'number') return 'not yet';
  const now = Date.now();
  if (now < ms) return 'just now';
  const days = Math.floor((now - ms) / MS_PER_DAY);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} months ago`;
};

const formatPct = (value) => `${Math.round(value * 100)}%`;

const formatDeclaredLevel = (level) => {
  if (level === 'known') return 'known';
  if (level === 'unknown') return 'unknown';
  return '—';
};

const formatMuteState = (state) => {
  if (state === 'already-known') return 'muted: already known';
  if (state === 'not-interested') return 'muted: not interested';
  return 'mute: none';
};

export const DescriptorRow = ({ descriptor, mastery }) => {
  if (!descriptor) return null;

  // Default to uniform Beta(1,1) if mastery is missing (first launch + no
  // descriptors hydrated yet). Should not happen post-Phase 4 wire-in but
  // guards against drift.
  const posterior = mastery?.posterior || { alpha: 1, beta: 1 };
  const lastValidatedAt = mastery?.lastValidatedAt ?? null;
  const declaredLevel = mastery?.declaredLevel ?? null;
  const userMuteState = mastery?.userMuteState || 'none';

  // Decay-adjusted posterior for the displayed credible interval. Per I-SM-2,
  // decay is read-time only — no dispatch fires from this render.
  const decayed = applyTemporalDecay(posterior, lastValidatedAt);
  const ci = betaCredibleInterval(decayed.decayedAlpha, decayed.decayedBeta);
  const mean = betaMean(decayed.decayedAlpha, decayed.decayedBeta);

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 mb-3"
      data-testid={`descriptor-row-${descriptor.id}`}
      data-descriptor-id={descriptor.id}
    >
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-base font-semibold text-white">
          {descriptor.displayName}
        </h4>
        <span
          className="text-xs text-gray-400"
          data-testid={`descriptor-mute-${descriptor.id}`}
        >
          {formatMuteState(userMuteState)}
        </span>
      </div>

      {/* I-SM-1 SEPARATE REGION #1 — posterior (data signal) */}
      <div
        className="mb-2"
        data-testid={`descriptor-posterior-${descriptor.id}`}
        data-signal="posterior"
      >
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
          Data signal (drill-derived)
        </div>
        <div className="text-sm text-gray-200">
          mean {formatPct(mean)}
          {'  '}
          <span className="text-gray-400">
            (95% CI {formatPct(ci.lower)}–{formatPct(ci.upper)})
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          α={decayed.decayedAlpha.toFixed(2)} · β={decayed.decayedBeta.toFixed(2)}
          {' · '}
          last drill: {formatDaysAgo(lastValidatedAt)}
        </div>
      </div>

      {/* I-SM-1 SEPARATE REGION #2 — declared signal (user assertion) */}
      <div
        className="mb-3"
        data-testid={`descriptor-declared-${descriptor.id}`}
        data-signal="declared"
      >
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
          Declared signal (self-asserted)
        </div>
        <div className="text-sm text-gray-200">
          {formatDeclaredLevel(declaredLevel)}
        </div>
      </div>

      {/* Recovery affordances — disabled this sprint; fast-follow WS wires
          the writers. Layout preserved so the swap-in is a label + onClick
          change, not a re-layout. */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled
          className="px-3 py-1.5 text-xs rounded-md bg-gray-700 text-gray-500 cursor-not-allowed"
          title="Coming soon"
          data-testid={`descriptor-recalibrate-${descriptor.id}`}
        >
          Recalibrate
        </button>
        <button
          type="button"
          disabled
          className="px-3 py-1.5 text-xs rounded-md bg-gray-700 text-gray-500 cursor-not-allowed"
          title="Coming soon"
          data-testid={`descriptor-mark-known-${descriptor.id}`}
        >
          Mark as already known
        </button>
        {userMuteState !== 'none' && (
          <button
            type="button"
            disabled
            className="px-3 py-1.5 text-xs rounded-md bg-gray-700 text-gray-500 cursor-not-allowed"
            title="Coming soon"
            data-testid={`descriptor-unmute-${descriptor.id}`}
          >
            Unmute
          </button>
        )}
      </div>
    </div>
  );
};

export default DescriptorRow;
