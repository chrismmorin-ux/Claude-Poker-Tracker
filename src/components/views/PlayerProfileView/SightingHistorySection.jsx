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
        {visible.map((s) => (
          <div
            key={s.sightingId}
            className="px-3 py-2 text-sm"
            data-testid="player-profile-sighting-row"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-300">
                {formatDate(s.capturedAt)}
              </span>
              {s.venueId ? (
                <span className="text-gray-500 text-xs">
                  {s.venueId}
                </span>
              ) : null}
            </div>
            {Array.isArray(s.featuresSeen) && s.featuresSeen.length > 0 ? (
              <div className="text-gray-500 text-xs mt-1">
                {s.featuresSeen.join(' · ')}
              </div>
            ) : null}
          </div>
        ))}
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
