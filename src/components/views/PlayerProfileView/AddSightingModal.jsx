/**
 * @file AddSightingModal — single-form modal for capturing a new sighting.
 *
 * On save, calls `appendSighting()` with attribute snapshot + featuresSeen
 * (derived from which fields the user populated). Per
 * docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md
 * §PIO-G4-S1 manual-add-sighting flow.
 *
 * v1 form: snapshot the player's CURRENT attribute values as the sighting
 * payload, with optional override of any field. Simpler than rebuilding the
 * full editor's palette UI here; if user wants to change attributes, they
 * use the Edit affordance + come back to add the sighting.
 *
 * SPR-035 / WS-162 (2026-05-04).
 */

import React, { useState } from 'react';
import { appendSighting } from '../../../utils/persistence/sightingLogsStore';
import { useSession } from '../../../contexts';

const AGE_DECADE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];

const buildFeaturesSeen = (attributes) => {
  const seen = [];
  if (attributes.ageDecade) seen.push('ageDecade');
  if (Array.isArray(attributes.ethnicityTags) && attributes.ethnicityTags.length > 0) seen.push('ethnicity');
  if (Array.isArray(attributes.wardrobe) && attributes.wardrobe.length > 0) seen.push('wardrobe');
  if (Array.isArray(attributes.jewelry) && attributes.jewelry.length > 0) seen.push('jewelry');
  if (Array.isArray(attributes.logo) && attributes.logo.length > 0) seen.push('logo');
  return seen;
};

export const AddSightingModal = ({ player, onClose, onSaved }) => {
  const { currentSession } = useSession();
  const activeSessionId = currentSession?.sessionId ?? null;
  // Snapshot the current attribute values; user can override.
  const [ageDecade, setAgeDecade] = useState(player.ageDecade ?? null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const onSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const attributes = {
        ageDecade,
        ethnicityTags: player.ethnicityTags ?? [],
        wardrobe: player.wardrobe ?? [],
        jewelry: player.jewelry ?? [],
        logo: player.logo ?? [],
      };
      await appendSighting({
        playerId: player.playerId,
        sessionId: activeSessionId ?? null,
        capturedAt: Date.now(),
        venueId: null,
        featuresSeen: buildFeaturesSeen(attributes),
        attributes,
        notes: notes || null,
      });
      onSaved?.();
    } catch (e) {
      setError(e?.message || 'Failed to save sighting.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      data-testid="add-sighting-modal"
    >
      <div className="bg-gray-900 rounded-lg max-w-md w-full p-4 text-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-lg font-semibold">Add sighting</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white"
            data-testid="add-sighting-close"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-400 text-xs mb-4">
          Recording a sighting captures the current attribute values for {player.name || 'this player'} at this moment.
          Attribute changes can be made via the Edit screen first.
        </p>

        <div className="mb-3">
          <div className="text-gray-400 text-xs mb-1">Age decade</div>
          <div className="flex flex-wrap gap-1">
            {AGE_DECADE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAgeDecade(opt === ageDecade ? null : opt)}
                className={`px-2 py-1 rounded text-xs ${
                  ageDecade === opt
                    ? 'bg-cyan-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
                data-testid={`add-sighting-age-${opt}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 text-xs text-gray-500">
          <div className="mb-1">Ethnicity: {(player.ethnicityTags || []).join(', ') || '—'}</div>
          <div className="mb-1">Wardrobe: {(player.wardrobe || []).join(', ') || '—'}</div>
          <div className="mb-1">Jewelry: {(player.jewelry || []).join(', ') || '—'}</div>
          <div>Logo: {(player.logo || []).join(', ') || '—'}</div>
        </div>

        <div className="mb-4">
          <div className="text-gray-400 text-xs mb-1">Notes (optional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-gray-800 text-gray-200 text-sm rounded p-2 border border-gray-700"
            rows={2}
            data-testid="add-sighting-notes"
          />
        </div>

        {error ? (
          <div className="text-red-400 text-xs mb-2" data-testid="add-sighting-error">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded"
            data-testid="add-sighting-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded"
            data-testid="add-sighting-save"
          >
            {isSaving ? 'Saving…' : 'Save sighting'}
          </button>
        </div>
      </div>
    </div>
  );
};
