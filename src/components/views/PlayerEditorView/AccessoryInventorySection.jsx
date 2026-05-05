/**
 * @file AccessoryInventorySection — manage the per-player accessory list.
 *
 * Per `feedback_accessory_inventory_model.md`: each player record carries
 * a persistent accessory inventory that accumulates across sightings. The
 * editor lets the owner curate it directly (add/edit/delete) outside of a
 * sighting — useful for "I know Michael wears a Rolex" pre-population.
 *
 * Schema (per item):
 *   { accessoryId, kind, subtype, color, note, firstSeenAt, lastSeenAt, timesSeen }
 *
 * UI:
 *   - List of existing inventory items (most-recent-seen first)
 *   - Each row: kind/subtype/color chip-display + free-text note + delete
 *   - Bottom: compact add form — kind chips → subtype chips → color chips → note
 *
 * Owner-confirmed (2026-05-05): single subtype chip + single color chip + note.
 * No free-text matching on subtype/color in the picker — those are enumerated
 * for fast filtering.
 */

import React, { useState } from 'react';
import { CLOTHING_COLORS } from '../../../constants/avatarFeatureConstants';
import {
  createAccessoryEntry,
  sortInventoryRecentFirst,
} from '../../../utils/accessoryInventory';

// Same kinds/subtypes as AddSightingModal — single source of truth here.
export const ACCESSORY_KINDS = [
  { kind: 'hat',     label: 'Hat',     subtypes: ['cap', 'beanie', 'visor', 'cowboy', 'fedora'] },
  { kind: 'top',     label: 'Top',     subtypes: ['t-shirt', 'hoodie', 'polo', 'button-down', 'sweater', 'jacket', 'vest'] },
  { kind: 'bottom',  label: 'Bottom',  subtypes: ['jeans', 'shorts', 'slacks', 'sweatpants'] },
  { kind: 'jewelry', label: 'Jewelry', subtypes: ['ring', 'chain', 'watch', 'earrings', 'bracelet'] },
  { kind: 'other',   label: 'Other',   subtypes: [] },
];

const COLOR_HEX_BY_KEY = Object.fromEntries(
  CLOTHING_COLORS.map((c) => [c.id.replace(/^cloth\./, ''), c.hex]),
);

const formatDate = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString();
};

// --- Sub-components --------------------------------------------------------

const SmallSwatch = ({ colorKey }) => {
  const hex = COLOR_HEX_BY_KEY[colorKey];
  if (!hex) return null;
  return (
    <span
      className="rounded-full inline-block shrink-0 align-middle"
      style={{
        background: hex,
        width: 14,
        height: 14,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
      aria-label={`color ${colorKey}`}
    />
  );
};

const InventoryRow = ({ entry, onDelete }) => {
  const parts = [];
  if (entry.color) parts.push(entry.color);
  if (entry.subtype) parts.push(entry.subtype);
  const headline = parts.join(' ') || entry.kind;
  return (
    <li
      className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 last:border-b-0"
      data-testid={`accessory-row-${entry.accessoryId}`}
    >
      <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
        {entry.kind}
      </span>
      {entry.color ? <SmallSwatch colorKey={entry.color} /> : null}
      <span className="text-sm text-gray-800 truncate">
        {headline}
        {entry.note ? (
          <span className="ml-1 text-gray-500 italic">({entry.note})</span>
        ) : null}
      </span>
      <span className="ml-auto text-[10px] text-gray-400 whitespace-nowrap">
        seen {entry.timesSeen || 1}× · {formatDate(entry.lastSeenAt)}
      </span>
      <button
        type="button"
        onClick={() => onDelete(entry.accessoryId)}
        className="text-gray-400 hover:text-red-600 text-xs px-1"
        data-testid={`accessory-delete-${entry.accessoryId}`}
        aria-label="Delete accessory"
      >
        ✕
      </button>
    </li>
  );
};

const KindChip = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
      active
        ? 'bg-cyan-700 text-white border-cyan-400'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`}
    aria-pressed={active}
  >
    {label}
  </button>
);

const ColorSwatchChip = ({ active, label, hex, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-xs border transition-colors ${
      active
        ? 'bg-cyan-700 text-white border-cyan-400'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`}
    aria-pressed={active}
  >
    <span
      className="rounded-full inline-block shrink-0"
      style={{
        background: hex,
        width: 16,
        height: 16,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
    />
    <span>{label}</span>
  </button>
);

const SubtypeChip = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
      active
        ? 'bg-cyan-700 text-white border-cyan-400'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`}
    aria-pressed={active}
  >
    {label}
  </button>
);

// --- Main section ----------------------------------------------------------

export const AccessoryInventorySection = ({ inventory, onChange }) => {
  const [draftKind, setDraftKind] = useState(null);
  const [draftSubtype, setDraftSubtype] = useState(null);
  const [draftColor, setDraftColor] = useState(null);
  const [draftNote, setDraftNote] = useState('');

  const list = Array.isArray(inventory) ? inventory : [];
  const sorted = sortInventoryRecentFirst(list);

  const draftIsValid = draftKind
    && (draftSubtype || draftColor || draftNote.trim());

  const handleAdd = () => {
    if (!draftIsValid) return;
    const entry = createAccessoryEntry({
      kind: draftKind,
      subtype: draftSubtype,
      color: draftColor,
      note: draftNote.trim(),
    });
    onChange([...list, entry]);
    setDraftKind(null);
    setDraftSubtype(null);
    setDraftColor(null);
    setDraftNote('');
  };

  const handleDelete = (accessoryId) => {
    onChange(list.filter((e) => e.accessoryId !== accessoryId));
  };

  const subtypeOptions = ACCESSORY_KINDS.find((k) => k.kind === draftKind)?.subtypes || [];

  return (
    <section className="mb-4" data-testid="player-editor-accessory-inventory">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
        Accessory inventory
      </h3>

      {/* Existing items list */}
      {sorted.length > 0 ? (
        <ul className="bg-white border border-gray-200 rounded-md mb-3" data-testid="accessory-list">
          {sorted.map((entry) => (
            <InventoryRow key={entry.accessoryId} entry={entry} onDelete={handleDelete} />
          ))}
        </ul>
      ) : (
        <div className="text-[11px] text-gray-500 italic mb-3">
          No accessories yet. Add what this player wears so they're easier to spot next time.
        </div>
      )}

      {/* Add form */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Add accessory</div>
        <div className="flex flex-wrap gap-1 mb-2" data-testid="accessory-kind-row">
          {ACCESSORY_KINDS.map((k) => (
            <KindChip
              key={k.kind}
              active={draftKind === k.kind}
              label={k.label}
              onClick={() => {
                setDraftKind(draftKind === k.kind ? null : k.kind);
                setDraftSubtype(null);
              }}
            />
          ))}
        </div>

        {draftKind && subtypeOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-2" data-testid="accessory-subtype-row">
            {subtypeOptions.map((sub) => (
              <SubtypeChip
                key={sub}
                active={draftSubtype === sub}
                label={sub}
                onClick={() => setDraftSubtype(draftSubtype === sub ? null : sub)}
              />
            ))}
          </div>
        ) : null}

        {draftKind && draftKind !== 'other' ? (
          <div className="flex flex-wrap gap-1 mb-2" data-testid="accessory-color-row">
            {CLOTHING_COLORS.map((c) => {
              const key = c.id.replace(/^cloth\./, '');
              return (
                <ColorSwatchChip
                  key={c.id}
                  active={draftColor === key}
                  label={c.label}
                  hex={c.hex}
                  onClick={() => setDraftColor(draftColor === key ? null : key)}
                />
              );
            })}
          </div>
        ) : null}

        {draftKind ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="note (e.g., 'KC Royals', 'WSOP', 'Cleveland Browns')"
              className="flex-1 bg-white text-gray-800 text-sm rounded border border-gray-300 px-2 py-1"
              data-testid="accessory-note-input"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!draftIsValid}
              className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-xs px-3 py-1 rounded"
              data-testid="accessory-add-button"
            >
              Add
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default AccessoryInventorySection;
