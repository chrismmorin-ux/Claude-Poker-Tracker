/**
 * @file AddSightingModal — capture a sighting with outfit details for the day.
 *
 * Per feedback_color_independent_of_ethnicity.md + owner request 2026-05-05:
 * outfit attributes (hat / top / bottom / jewelry / other) are volatile per-
 * sighting and need color + free-form note ("blue baseball cap, KC Royals").
 *
 * Schema written to sighting.attributes.outfit:
 *   [
 *     { kind: 'hat', subtype: 'cap', color: 'blue', note: 'KC Royals' },
 *     { kind: 'top', subtype: 'hoodie', color: 'black', note: '' },
 *     ...
 *   ]
 *
 * Items are only persisted when the user has populated something (subtype,
 * color, or note) — empty rows are dropped on save.
 */

import React, { useState } from 'react';
import { appendSighting } from '../../../utils/persistence/sightingLogsStore';
import { useSession } from '../../../contexts';
import { CLOTHING_COLORS } from '../../../constants/avatarFeatureConstants';

const AGE_DECADE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];

const OUTFIT_ROWS = [
  { kind: 'hat',     label: 'Hat',     subtypes: ['cap', 'beanie', 'visor', 'cowboy', 'fedora'] },
  { kind: 'top',     label: 'Top',     subtypes: ['t-shirt', 'hoodie', 'polo', 'button-down', 'sweater', 'jacket'] },
  { kind: 'bottom',  label: 'Bottom',  subtypes: ['jeans', 'shorts', 'slacks', 'sweatpants'] },
  { kind: 'jewelry', label: 'Jewelry', subtypes: ['ring', 'chain', 'watch', 'earrings', 'bracelet'] },
  // 'other' is a note-only row for stuff that doesn't fit a category
  // (e.g. "Lakers gym bag", "carrying a sleeve of $25 chips").
  { kind: 'other',   label: 'Other',   subtypes: [] },
];

const isEmptyItem = (item) =>
  !item.subtype && !item.color && !(item.note && item.note.trim());

const buildFeaturesSeen = (attributes) => {
  const seen = [];
  if (attributes.ageDecade) seen.push('ageDecade');
  if (Array.isArray(attributes.ethnicityTags) && attributes.ethnicityTags.length > 0) seen.push('ethnicity');
  if (Array.isArray(attributes.outfit) && attributes.outfit.length > 0) {
    for (const item of attributes.outfit) {
      seen.push(item.kind);
    }
  }
  return seen;
};

// --- Subcomponents ---------------------------------------------------------

const SubtypeChip = ({ active, label, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
      active
        ? 'bg-cyan-700 text-white border-cyan-400'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`}
    data-testid={testId}
    aria-pressed={active}
  >
    {label}
  </button>
);

const ColorSwatchChip = ({ active, label, hex, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-xs border transition-colors ${
      active
        ? 'bg-cyan-700 text-white border-cyan-400'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`}
    data-testid={testId}
    aria-pressed={active}
  >
    <span
      className="rounded-full inline-block shrink-0"
      style={{
        background: hex,
        width: 18,
        height: 18,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
      aria-hidden="true"
    />
    <span>{label}</span>
  </button>
);

const OutfitRow = ({ row, item, onChange }) => {
  const setSubtype = (s) => onChange({ ...item, subtype: s === item.subtype ? null : s });
  const setColor = (c) => onChange({ ...item, color: c === item.color ? null : c });
  const setNote = (n) => onChange({ ...item, note: n });

  return (
    <div
      className="border border-gray-200 rounded-md p-2 mb-2 bg-gray-50"
      data-testid={`add-sighting-outfit-row-${row.kind}`}
    >
      <div className="text-gray-700 text-xs font-semibold mb-1.5">{row.label}</div>

      {row.subtypes.length > 0 ? (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {row.subtypes.map((sub) => (
            <SubtypeChip
              key={sub}
              active={item.subtype === sub}
              label={sub}
              onClick={() => setSubtype(sub)}
              testId={`add-sighting-${row.kind}-subtype-${sub}`}
            />
          ))}
        </div>
      ) : null}

      {row.kind !== 'other' ? (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {CLOTHING_COLORS.map((c) => {
            const key = c.id.replace(/^cloth\./, '');
            return (
              <ColorSwatchChip
                key={c.id}
                active={item.color === key}
                label={c.label}
                hex={c.hex}
                onClick={() => setColor(key)}
                testId={`add-sighting-${row.kind}-color-${key}`}
              />
            );
          })}
        </div>
      ) : null}

      <input
        type="text"
        value={item.note || ''}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          row.kind === 'other'
            ? 'note (e.g., "Lakers gym bag", "carrying $25 chip stack")'
            : 'note (e.g., "KC Royals", "ripped knees")'
        }
        className="w-full bg-white text-gray-800 text-sm rounded border border-gray-300 px-2 py-1"
        data-testid={`add-sighting-${row.kind}-note`}
      />
    </div>
  );
};

// --- Modal -----------------------------------------------------------------

export const AddSightingModal = ({ player, onClose, onSaved }) => {
  const { currentSession } = useSession();
  const activeSessionId = currentSession?.sessionId ?? null;

  const [ageDecade, setAgeDecade] = useState(player.ageDecade ?? null);
  const [outfit, setOutfit] = useState(() =>
    OUTFIT_ROWS.map((r) => ({ kind: r.kind, subtype: null, color: null, note: '' }))
  );
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const updateOutfitItem = (index, next) => {
    setOutfit((prev) => prev.map((it, i) => (i === index ? next : it)));
  };

  const onSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const cleanedOutfit = outfit
        .filter((it) => !isEmptyItem(it))
        .map((it) => ({
          kind: it.kind,
          subtype: it.subtype || null,
          color: it.color || null,
          note: (it.note || '').trim() || null,
        }));

      const attributes = {
        ageDecade,
        ethnicityTags: player.ethnicityTags ?? [],
        outfit: cleanedOutfit,
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
      className="fixed inset-0 bg-black/70 flex items-stretch sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto"
      data-testid="add-sighting-modal"
    >
      <div className="bg-gray-100 sm:rounded-lg max-w-md w-full max-h-screen sm:max-h-[90vh] flex flex-col text-gray-800 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-white sm:rounded-t-lg sticky top-0 z-10">
          <h3 className="text-gray-900 text-base font-semibold">Add sighting</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-lg leading-none"
            data-testid="add-sighting-close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" data-testid="add-sighting-scroll">
          <p className="text-gray-600 text-xs mb-3">
            Capture what {player.name || 'this player'} is wearing today.
            Subtypes and colors are optional — leave a row blank if there's
            nothing to record.
          </p>

          <div className="mb-3">
            <div className="text-gray-700 text-xs font-semibold mb-1">Age decade</div>
            <div className="flex flex-wrap gap-1">
              {AGE_DECADE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAgeDecade(opt === ageDecade ? null : opt)}
                  className={`px-2.5 py-1 rounded text-xs border ${
                    ageDecade === opt
                      ? 'bg-cyan-700 text-white border-cyan-400'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  data-testid={`add-sighting-age-${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {OUTFIT_ROWS.map((row, i) => (
            <OutfitRow
              key={row.kind}
              row={row}
              item={outfit[i]}
              onChange={(next) => updateOutfitItem(i, next)}
            />
          ))}

          <div className="mb-3 mt-3">
            <div className="text-gray-700 text-xs font-semibold mb-1">General notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white text-gray-800 text-sm rounded border border-gray-300 px-2 py-1"
              rows={2}
              data-testid="add-sighting-notes"
              placeholder="Anything else worth remembering about this sighting"
            />
          </div>

          {error ? (
            <div className="text-red-600 text-xs mb-2" data-testid="add-sighting-error">
              {error}
            </div>
          ) : null}
        </div>

        <div className="px-4 py-3 border-t border-gray-300 bg-white flex gap-2 justify-end sticky bottom-0 sm:rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1.5 rounded"
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
