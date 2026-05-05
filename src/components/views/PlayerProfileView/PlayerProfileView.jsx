/**
 * @file PlayerProfileView — read-only player profile surface.
 *
 * Per docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md
 * §PIO-G4-S1. Renders for a single player:
 *   - Header: name + avatar + last-seen + Edit affordance
 *   - SightingHistorySection: recent sightings (top-10 + expand-to-all)
 *   - AttributeStability: per-attribute posterior + confidence + sample size
 *   - Actions: Add Sighting + Edit + Back
 *
 * Routed via SCREEN.PLAYER_PROFILE (uiReducer + UIContext.openPlayerProfile).
 * Row-tap from PlayersView (post-WS-163) opens this; Edit one-tap goes to
 * PlayerEditor.
 *
 * Per AP-PIO-04: factual labels, no "are you sure?" / shame copy.
 * Per AP-PIO-02: source-util-policy whitelisted (no live-table contamination).
 *
 * SPR-035 / WS-162 (2026-05-04).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useUI, usePlayer } from '../../../contexts';
import { getSightingsForPlayer } from '../../../utils/persistence/sightingLogsStore';
import { computeStability } from '../../../utils/playerMatching/computeStability';
import { SightingHistorySection } from './SightingHistorySection';
import { AttributeStabilityRow } from './AttributeStabilityRow';
import { AddSightingModal } from './AddSightingModal';
// Phase 2 (PIO G4 v2): IdentityAvatar primary, PlayerPhotoAvatar retained
// only as fallback signal — IdentityAvatar handles photo overlay natively.
import IdentityAvatar from '../../ui/IdentityAvatar';

const STABILITY_ATTRIBUTES = [
  { key: 'ageDecade', label: 'Age decade' },
  { key: 'ethnicityTags', label: 'Ethnicity' },
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'jewelry', label: 'Jewelry' },
  { key: 'logo', label: 'Logo' },
];

export const PlayerProfileView = ({ scale: _scale }) => {
  const { profilePlayerId, closePlayerProfile, openPlayerEditor } = useUI();
  const { getPlayerById } = usePlayer();
  const [sightings, setSightings] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const player = profilePlayerId ? getPlayerById(profilePlayerId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!profilePlayerId) {
      setSightings([]);
      return () => { cancelled = true; };
    }
    getSightingsForPlayer(profilePlayerId).then((records) => {
      if (!cancelled) setSightings(records);
    });
    return () => { cancelled = true; };
  }, [profilePlayerId, refreshTick]);

  const stabilityRows = useMemo(() => {
    return STABILITY_ATTRIBUTES.map(({ key, label }) => {
      const stability = computeStability(sightings, key);
      const currentValue = player ? player[key] : null;
      return { key, label, stability, currentValue };
    });
  }, [sightings, player]);

  if (!player) {
    return (
      <div className="p-4 text-gray-400" data-testid="player-profile-missing">
        <button
          type="button"
          onClick={closePlayerProfile}
          className="text-cyan-400 text-sm"
        >
          ← Back
        </button>
        <div className="mt-4">
          Player not found{profilePlayerId ? `: ${profilePlayerId}` : ''}.
        </div>
      </div>
    );
  }

  const onEdit = () => {
    openPlayerEditor({ mode: 'edit', playerId: player.playerId });
  };

  const onSightingSaved = () => {
    setIsAddModalOpen(false);
    setRefreshTick((t) => t + 1);
  };

  return (
    <div
      className="h-dvh w-full overflow-y-auto"
      data-testid="player-profile-view"
    >
    <div className="p-4 max-w-3xl mx-auto text-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          {/* Phase 2: IdentityAvatar derived from identification fields — large
              header rendition. Photo (if captured) is rendered as a
              bottom-right overlay badge; the SVG avatar remains the primary
              recognition surface (audit §A5). */}
          <div className="shrink-0 mt-7">
            <IdentityAvatar
              player={player}
              size={96}
              photoOverlay={!!player?.photoBlobId}
              photoUrl={null /* TODO Phase 2.1: hydrate from playerPhotosStore */}
              testId="player-profile-avatar"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={closePlayerProfile}
              className="text-cyan-400 text-sm mb-2"
            >
              ← Back
            </button>
            <h1
              className="text-white text-2xl font-semibold"
              data-testid="player-profile-name"
            >
              {player.name || '(no name)'}
              {player.nickname ? <span className="text-gray-400 text-base ml-2">"{player.nickname}"</span> : null}
            </h1>
            {player.lastSeenAt ? (
              <div className="text-gray-500 text-xs mt-1">
                Last seen {new Date(player.lastSeenAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="bg-cyan-700 hover:bg-cyan-600 text-white text-sm px-3 py-1.5 rounded"
          data-testid="player-profile-edit-button"
        >
          Edit
        </button>
      </div>

      {/* Sighting History */}
      <SightingHistorySection sightings={sightings} />

      {/* Attribute Stability */}
      <section
        className="mb-6"
        data-testid="player-profile-stability"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-indigo-400 text-sm font-semibold uppercase tracking-wide">
            Attribute Stability
          </h2>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-cyan-400 text-xs hover:underline"
            data-testid="player-profile-add-sighting"
          >
            + Add sighting
          </button>
        </div>
        <div className="bg-gray-800/40 rounded p-2 divide-y divide-gray-700">
          {stabilityRows.map((row) => (
            <AttributeStabilityRow
              key={row.key}
              attributeKey={row.key}
              label={row.label}
              stability={row.stability}
              currentValue={row.currentValue}
            />
          ))}
        </div>
      </section>

      {isAddModalOpen ? (
        <AddSightingModal
          player={player}
          onClose={() => setIsAddModalOpen(false)}
          onSaved={onSightingSaved}
        />
      ) : null}
    </div>
    </div>
  );
};
