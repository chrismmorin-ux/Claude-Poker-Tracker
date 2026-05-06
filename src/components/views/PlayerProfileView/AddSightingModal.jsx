/**
 * @file AddSightingModal — capture a sighting with outfit details for the day.
 *
 * Per `feedback_accessory_inventory_model.md` (2026-05-05):
 *   1. Show the player's existing accessory INVENTORY at the top with
 *      "wearing today?" checkboxes — owner picks what they're seeing
 *      without re-typing.
 *   2. Below: add-new form for never-before-seen accessories. New entries
 *      auto-add to the player's inventory.
 *   3. On save: bump lastSeenAt + timesSeen for checked existing items;
 *      append new items to inventory; persist both inventory + sighting.
 *
 * Sighting.attributes.outfit shape (unchanged from Phase B):
 *   [{ accessoryId?, kind, subtype, color, note }, ...]
 * The optional accessoryId references back into the player's inventory
 * for items that came from the existing list.
 */

import React, { useState } from 'react';
import { appendSighting } from '../../../utils/persistence/sightingLogsStore';
import { updatePlayer } from '../../../utils/persistence';
import { useSession, usePlayer } from '../../../contexts';
import { CLOTHING_COLORS } from '../../../constants/avatarFeatureConstants';
import {
  upsertAccessory,
  bumpAccessoryById,
  sortInventoryRecentFirst,
  createAccessoryEntry,
} from '../../../utils/accessoryInventory';

const AGE_DECADE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];

const NEW_ACCESSORY_KINDS = [
  { kind: 'hat',     label: 'Hat',     subtypes: ['cap', 'beanie', 'visor', 'cowboy', 'fedora'] },
  { kind: 'top',     label: 'Top',     subtypes: ['t-shirt', 'hoodie', 'polo', 'button-down', 'sweater', 'jacket', 'vest'] },
  { kind: 'bottom',  label: 'Bottom',  subtypes: ['jeans', 'shorts', 'slacks', 'sweatpants'] },
  { kind: 'jewelry', label: 'Jewelry', subtypes: ['ring', 'chain', 'watch', 'earrings', 'bracelet'] },
  { kind: 'other',   label: 'Other',   subtypes: [] },
];

const COLOR_HEX_BY_KEY = Object.fromEntries(
  CLOTHING_COLORS.map((c) => [c.id.replace(/^cloth\./, ''), c.hex]),
);

const buildFeaturesSeen = (attributes) => {
  const seen = [];
  if (attributes.ageDecade) seen.push('ageDecade');
  if (Array.isArray(attributes.ethnicityTags) && attributes.ethnicityTags.length > 0) seen.push('ethnicity');
  if (Array.isArray(attributes.outfit) && attributes.outfit.length > 0) {
    for (const item of attributes.outfit) seen.push(item.kind);
  }
  return seen;
};

// --- Sub-components --------------------------------------------------------

const SmallSwatch = ({ colorKey }) => {
  const hex = COLOR_HEX_BY_KEY[colorKey];
  if (!hex) return null;
  return (
    <span
      className="rounded-full inline-block shrink-0"
      style={{
        background: hex,
        width: 16,
        height: 16,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
    />
  );
};

const SubtypeChip = ({ active, label, onClick }) => (
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

// One row for an existing inventory item — checkbox + headline + note.
const InventoryCheckRow = ({ entry, checked, onToggle }) => {
  const headlineParts = [];
  if (entry.color) headlineParts.push(entry.color);
  if (entry.subtype) headlineParts.push(entry.subtype);
  const headline = headlineParts.join(' ') || entry.kind;
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded ${
        checked ? 'bg-cyan-50 border border-cyan-200' : 'border border-transparent hover:bg-gray-100'
      }`}
      data-testid={`sighting-inventory-row-${entry.accessoryId}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(entry.accessoryId)}
        className="shrink-0"
      />
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
        {entry.timesSeen || 1}×
      </span>
    </label>
  );
};

// New-accessory add form.
const NewAccessoryForm = ({ draft, setDraft }) => {
  const subtypeOptions = NEW_ACCESSORY_KINDS.find((k) => k.kind === draft.kind)?.subtypes || [];
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-2 mt-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
        Add new accessory (gets added to inventory)
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {NEW_ACCESSORY_KINDS.map((k) => (
          <SubtypeChip
            key={k.kind}
            active={draft.kind === k.kind}
            label={k.label}
            onClick={() => setDraft({ ...draft, kind: draft.kind === k.kind ? null : k.kind, subtype: null })}
          />
        ))}
      </div>
      {draft.kind && subtypeOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {subtypeOptions.map((sub) => (
            <SubtypeChip
              key={sub}
              active={draft.subtype === sub}
              label={sub}
              onClick={() => setDraft({ ...draft, subtype: draft.subtype === sub ? null : sub })}
            />
          ))}
        </div>
      ) : null}
      {draft.kind && draft.kind !== 'other' ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {CLOTHING_COLORS.map((c) => {
            const key = c.id.replace(/^cloth\./, '');
            return (
              <ColorSwatchChip
                key={c.id}
                active={draft.color === key}
                label={c.label}
                hex={c.hex}
                onClick={() => setDraft({ ...draft, color: draft.color === key ? null : key })}
              />
            );
          })}
        </div>
      ) : null}
      {draft.kind ? (
        <input
          type="text"
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          placeholder={
            draft.kind === 'other'
              ? 'note (e.g., "Lakers gym bag")'
              : 'note (e.g., "KC Royals", "WSOP")'
          }
          className="w-full bg-white text-gray-800 text-sm rounded border border-gray-300 px-2 py-1"
          data-testid="sighting-new-accessory-note"
        />
      ) : null}
    </div>
  );
};

// --- Modal -----------------------------------------------------------------

export const AddSightingModal = ({ player, onClose, onSaved }) => {
  const { currentSession } = useSession();
  const { loadAllPlayers } = usePlayer();
  const activeSessionId = currentSession?.sessionId ?? null;

  const inventory = Array.isArray(player.accessoryInventory) ? player.accessoryInventory : [];
  const sortedInventory = sortInventoryRecentFirst(inventory);

  const [ageDecade, setAgeDecade] = useState(player.ageDecade ?? null);
  // checkedAccessoryIds: existing inventory items the user is wearing today
  const [checkedAccessoryIds, setCheckedAccessoryIds] = useState(new Set());
  // newDrafts: new accessories not in inventory yet — array of in-progress
  // entries. Single draft slot kept simple here (one new accessory at a time);
  // user can repeat the form to add more before saving.
  const [draft, setDraft] = useState({ kind: null, subtype: null, color: null, note: '' });
  // newItemsToAdd: accessories committed to be added on save (not yet
  // persisted — only added on Save click).
  const [newItemsToAdd, setNewItemsToAdd] = useState([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const draftHasContent = draft.kind
    && (draft.subtype || draft.color || draft.note.trim());

  const toggleAccessory = (accessoryId) => {
    setCheckedAccessoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(accessoryId)) next.delete(accessoryId);
      else next.add(accessoryId);
      return next;
    });
  };

  const stageNewItem = () => {
    if (!draftHasContent) return;
    setNewItemsToAdd((prev) => [
      ...prev,
      {
        kind: draft.kind,
        subtype: draft.subtype || null,
        color: draft.color || null,
        note: draft.note.trim() || '',
      },
    ]);
    setDraft({ kind: null, subtype: null, color: null, note: '' });
  };

  const removeStagedItem = (idx) => {
    setNewItemsToAdd((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const ts = Date.now();

      // Build the updated inventory: bump checked items, append staged new items.
      let nextInventory = inventory;
      for (const id of checkedAccessoryIds) {
        nextInventory = bumpAccessoryById(nextInventory, id, ts);
      }
      for (const item of newItemsToAdd) {
        nextInventory = upsertAccessory(nextInventory, item, ts);
      }

      // Build the sighting outfit array. Existing items reference their
      // accessoryId; staged new items get one assigned by upsertAccessory
      // above — find them in the new inventory by content match.
      const outfit = [];
      for (const id of checkedAccessoryIds) {
        const entry = nextInventory.find((e) => e.accessoryId === id);
        if (entry) {
          outfit.push({
            accessoryId: entry.accessoryId,
            kind: entry.kind,
            subtype: entry.subtype,
            color: entry.color,
            note: entry.note,
          });
        }
      }
      for (const item of newItemsToAdd) {
        // The matching new entry was just upserted; create a quick lookup.
        const placeholder = createAccessoryEntry(item, ts);
        outfit.push({
          accessoryId: nextInventory.find((e) =>
            e.kind === placeholder.kind
              && e.subtype === placeholder.subtype
              && e.color === placeholder.color
              && e.note === placeholder.note
          )?.accessoryId ?? null,
          kind: placeholder.kind,
          subtype: placeholder.subtype,
          color: placeholder.color,
          note: placeholder.note,
        });
      }

      // Persist inventory update on the player record FIRST so that if
      // the sighting append fails, the inventory is still consistent.
      if (nextInventory !== inventory) {
        await updatePlayer(player.playerId, { accessoryInventory: nextInventory });
      }

      const attributes = {
        ageDecade,
        ethnicityTags: player.ethnicityTags ?? [],
        outfit,
      };

      await appendSighting({
        playerId: player.playerId,
        sessionId: activeSessionId ?? null,
        capturedAt: ts,
        // Pull venue from the active session — a sighting recorded during
        // session play inherits the session's venue. Falls back to null
        // when there's no active session (e.g., adding a sighting to a
        // historical player record outside of game flow).
        venueId: currentSession?.venue ?? null,
        featuresSeen: buildFeaturesSeen(attributes),
        attributes,
        notes: notes || null,
      });

      // Refresh the player context so the profile shows the updated inventory.
      try {
        await loadAllPlayers();
      } catch {
        // Non-fatal — profile will catch up on next mount.
      }

      onSaved?.();
    } catch (e) {
      setError(e?.message || 'Failed to save sighting.');
      setIsSaving(false);
    }
  };

  const hasAnyContent = checkedAccessoryIds.size > 0
    || newItemsToAdd.length > 0
    || draftHasContent
    || ageDecade !== player.ageDecade;

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
          {/* Age decade — small but useful confirmation. */}
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
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory checkboxes — what they have worn before. */}
          <div className="mb-3">
            <div className="text-gray-700 text-xs font-semibold mb-1">
              Wearing today? <span className="text-gray-500 font-normal">(from inventory)</span>
            </div>
            {sortedInventory.length === 0 ? (
              <div className="text-[11px] text-gray-500 italic px-2 py-1">
                No accessories in inventory yet. Add one below.
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-md divide-y divide-gray-100">
                {sortedInventory.map((entry) => (
                  <InventoryCheckRow
                    key={entry.accessoryId}
                    entry={entry}
                    checked={checkedAccessoryIds.has(entry.accessoryId)}
                    onToggle={toggleAccessory}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Staged new items list. */}
          {newItemsToAdd.length > 0 ? (
            <div className="mb-2">
              <div className="text-gray-700 text-xs font-semibold mb-1">
                New items to add on save
              </div>
              <ul className="bg-white border border-gray-200 rounded-md divide-y divide-gray-100">
                {newItemsToAdd.map((item, idx) => {
                  const head = [item.color, item.subtype].filter(Boolean).join(' ') || item.kind;
                  return (
                    <li
                      key={`staged-${idx}`}
                      className="flex items-center gap-2 px-2 py-1.5"
                      data-testid={`sighting-staged-${idx}`}
                    >
                      <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
                        {item.kind}
                      </span>
                      {item.color ? <SmallSwatch colorKey={item.color} /> : null}
                      <span className="text-sm text-gray-800 truncate">
                        {head}
                        {item.note ? (
                          <span className="ml-1 text-gray-500 italic">({item.note})</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeStagedItem(idx)}
                        className="ml-auto text-gray-400 hover:text-red-600 text-xs px-1"
                        aria-label="Remove staged item"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {/* New-accessory add form. */}
          <NewAccessoryForm draft={draft} setDraft={setDraft} />
          {draftHasContent ? (
            <button
              type="button"
              onClick={stageNewItem}
              className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-3 py-1 rounded"
              data-testid="sighting-stage-new-button"
            >
              Stage this accessory
            </button>
          ) : null}

          {/* General notes. */}
          <div className="mb-3 mt-4">
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
            disabled={isSaving || !hasAnyContent}
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
