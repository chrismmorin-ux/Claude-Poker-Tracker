/**
 * @file SightingHistorySection — top-10 sightings + expand-to-all affordance.
 * Per docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md
 * §PIO-G4-S1.
 *
 * SPR-035 / WS-162 (2026-05-04).
 */

import React, { useState } from 'react';

const TOP_N = 10;

const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Phase 6 (PIO G4 v2 §11): render the per-sighting volatile attributes
// captured by assignPlayerToSeat. Headwear / wardrobe / jewelry / logo
// are session-snapshots — what the player was wearing THAT day. They
// don't define long-term identity but help reconstruct context later.
const SIGHTING_ATTRIBUTE_LABELS = [
  { key: 'headwear', prefix: 'hat:' },
  { key: 'wardrobe', prefix: 'wearing:' },
  { key: 'jewelry', prefix: 'jewelry:' },
  { key: 'logo', prefix: 'logo:' },
];

const renderAttributeChip = (key, prefix, value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <span
        key={key}
        className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 border border-gray-600 mr-1"
        data-testid={`sighting-attr-${key}`}
      >
        <span className="text-gray-500 mr-1">{prefix}</span>
        {value.slice(0, 3).join(', ')}
        {value.length > 3 ? ` +${value.length - 3}` : ''}
      </span>
    );
  }
  return (
    <span
      key={key}
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 border border-gray-600 mr-1"
      data-testid={`sighting-attr-${key}`}
    >
      <span className="text-gray-500 mr-1">{prefix}</span>
      {value}
    </span>
  );
};

export const SightingHistorySection = ({ sightings }) => {
  const [showAll, setShowAll] = useState(false);

  if (!sightings || sightings.length === 0) {
    return (
      <section
        className="mb-6"
        data-testid="player-profile-sighting-history"
      >
        <h2 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">
          Sighting History
        </h2>
        <div
          className="text-gray-500 text-sm bg-gray-800/40 rounded p-3"
          data-testid="player-profile-sighting-empty"
        >
          No sightings recorded yet.
        </div>
      </section>
    );
  }

  const visible = showAll ? sightings : sightings.slice(0, TOP_N);
  const hasMore = sightings.length > TOP_N;

  return (
    <section
      className="mb-6"
      data-testid="player-profile-sighting-history"
    >
      <h2 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">
        Sighting History ({sightings.length})
      </h2>
      <div className="bg-gray-800/40 rounded divide-y divide-gray-700">
        {visible.map((s) => {
          const attrs = s.attributes || {};
          const attrChips = SIGHTING_ATTRIBUTE_LABELS
            .map(({ key, prefix }) => renderAttributeChip(key, prefix, attrs[key]))
            .filter(Boolean);
          // Render seat + source if present (helps the user reconstruct
          // "I sat them at seat 3 in this session via the picker" later).
          const sourceLabel = s.source ? s.source.replace(/-/g, ' ') : null;
          return (
            <div
              key={s.sightingId}
              className="px-3 py-2 text-sm"
              data-testid="player-profile-sighting-row"
            >
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-gray-300">
                  {formatDate(s.capturedAt)}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  {typeof s.seat === 'number' ? (
                    <span className="text-gray-500" data-testid="sighting-seat">
                      seat {s.seat}
                    </span>
                  ) : null}
                  {sourceLabel ? (
                    <span className="text-gray-600" data-testid="sighting-source">
                      {sourceLabel}
                    </span>
                  ) : null}
                  {s.venueId ? (
                    <span className="text-gray-500">{s.venueId}</span>
                  ) : null}
                </div>
              </div>
              {attrChips.length > 0 ? (
                <div className="text-gray-500 text-xs mt-1.5 flex flex-wrap items-center">
                  {attrChips}
                </div>
              ) : Array.isArray(s.featuresSeen) && s.featuresSeen.length > 0 ? (
                <div className="text-gray-500 text-xs mt-1">
                  {s.featuresSeen.join(' · ')}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-cyan-400 text-xs mt-2 hover:underline"
          data-testid="player-profile-sighting-toggle"
        >
          {showAll ? `Show top ${TOP_N}` : `Show all ${sightings.length}`}
        </button>
      ) : null}
    </section>
  );
};
