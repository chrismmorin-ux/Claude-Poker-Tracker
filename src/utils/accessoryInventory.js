/**
 * @file accessoryInventory.js — pure helpers for the per-player accessory
 *   inventory feature.
 *
 * Per `feedback_accessory_inventory_model.md`: each player record carries
 * an `accessoryInventory` array. Items accumulate across sightings. Free-
 * text `note` is the load-bearing identifier ("KC Royals", "WSOP",
 * "Cleveland Browns"). Picker filtering is positive-only — accessory
 * matches BOOST a player's score, never exclude.
 *
 * Schema:
 *   {
 *     accessoryId: string (uuid),
 *     kind: 'hat' | 'top' | 'bottom' | 'jewelry' | 'other',
 *     subtype: string | null,    // e.g., 'cap', 'hoodie', null for 'other'
 *     color: string | null,       // CLOTHING_COLORS palette key, null for note-only
 *     note: string,               // free-form descriptor; '' if none
 *     firstSeenAt: number,        // ms since epoch
 *     lastSeenAt: number,
 *     timesSeen: number,          // bumped each time the accessory is recorded in a sighting
 *   }
 *
 * Pure functions — no IDB, no React, no side effects.
 */

const newId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older Node test runs)
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const norm = (s) => (s == null ? '' : s.toString().trim().toLowerCase());

/**
 * Two accessory entries are "the same item" iff they have the same kind +
 * subtype + color + note (case-insensitive). Two black KC Royals caps are
 * one item; a black KC Royals cap and a blue KC Royals cap are separate.
 */
export const accessoryEntriesAreSame = (a, b) => {
  if (!a || !b) return false;
  return norm(a.kind) === norm(b.kind)
    && norm(a.subtype) === norm(b.subtype)
    && norm(a.color) === norm(b.color)
    && norm(a.note) === norm(b.note);
};

/**
 * Build a fresh inventory entry. Caller passes timestamp for determinism in
 * tests; production callers should pass Date.now().
 */
export const createAccessoryEntry = (input, ts = Date.now()) => ({
  accessoryId: newId(),
  kind: norm(input.kind) || 'other',
  subtype: input.subtype ? norm(input.subtype) : null,
  color: input.color ? norm(input.color) : null,
  note: (input.note || '').toString().trim(),
  firstSeenAt: ts,
  lastSeenAt: ts,
  timesSeen: 1,
});

/**
 * Add an item to an inventory, OR if an exact-match item already exists,
 * bump its lastSeenAt + timesSeen counters. Returns a new array (immutable).
 *
 * Used by the AddSightingModal save path: every accessory recorded in a
 * sighting flows through here to keep the inventory in sync.
 */
export const upsertAccessory = (inventory, item, ts = Date.now()) => {
  const list = Array.isArray(inventory) ? inventory : [];
  const idx = list.findIndex((entry) => accessoryEntriesAreSame(entry, item));
  if (idx === -1) {
    return [...list, createAccessoryEntry(item, ts)];
  }
  const existing = list[idx];
  const updated = {
    ...existing,
    lastSeenAt: ts,
    timesSeen: (existing.timesSeen || 1) + 1,
  };
  return [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
};

/**
 * Bump just the seen counters on an existing inventory entry by id.
 * Used when the user picks an existing inventory item from the
 * AddSightingModal "wearing today?" checkboxes — we know the id.
 */
export const bumpAccessoryById = (inventory, accessoryId, ts = Date.now()) => {
  const list = Array.isArray(inventory) ? inventory : [];
  return list.map((entry) =>
    entry.accessoryId === accessoryId
      ? { ...entry, lastSeenAt: ts, timesSeen: (entry.timesSeen || 1) + 1 }
      : entry,
  );
};

/**
 * Sort by most-recent-seen first. Tie-break on firstSeenAt desc so newer
 * additions appear before older ones at the same lastSeenAt.
 */
export const sortInventoryRecentFirst = (inventory) => {
  const list = Array.isArray(inventory) ? inventory : [];
  return [...list].sort((a, b) => {
    const dl = (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
    if (dl !== 0) return dl;
    return (b.firstSeenAt || 0) - (a.firstSeenAt || 0);
  });
};

/**
 * Picker filter match. Returns true if any inventory entry matches the
 * filter on every set axis. Filter shape: { kind, color }.
 *
 * Permissive note: if filter axis is null/empty, that axis doesn't
 * constrain. So `{kind: 'hat'}` matches any hat regardless of color.
 *
 * Caller (the picker) uses this only for SCORING / BOOSTING — never to
 * exclude players. A player with no inventory or no matching entry can
 * still appear in results, just without the accessory boost.
 */
export const findMatchingAccessories = (inventory, filter) => {
  if (!filter || (!filter.kind && !filter.color)) return [];
  const list = Array.isArray(inventory) ? inventory : [];
  const fk = norm(filter.kind);
  const fc = norm(filter.color);
  return list.filter((entry) => {
    if (fk && norm(entry.kind) !== fk) return false;
    if (fc && norm(entry.color) !== fc) return false;
    return true;
  });
};

/**
 * Read-side migration: derive an accessoryInventory entry list from any
 * pre-Phase-C `sighting.attributes.outfit` arrays.
 *
 * Inputs:
 *   - currentInventory: existing array (may be empty)
 *   - sightings: array of sighting records, each potentially carrying
 *     attributes.outfit = [{kind, subtype, color, note}, ...]
 *   - sortByCapturedAtAsc: callers may already have most-recent-first
 *     ordering; we re-sort ascending so timestamps reflect chronology.
 *
 * Returns the inventory with derived items added. Idempotent — running
 * twice on the same sightings produces the same inventory.
 */
export const deriveInventoryFromSightings = (currentInventory, sightings) => {
  if (!Array.isArray(sightings) || sightings.length === 0) {
    return Array.isArray(currentInventory) ? currentInventory : [];
  }
  // Re-sort ascending by capturedAt so first/lastSeen carry chronological meaning.
  const ordered = [...sightings].sort(
    (a, b) => (a.capturedAt || 0) - (b.capturedAt || 0),
  );
  let inventory = Array.isArray(currentInventory) ? currentInventory : [];
  for (const sighting of ordered) {
    const outfit = sighting?.attributes?.outfit;
    if (!Array.isArray(outfit) || outfit.length === 0) continue;
    const ts = sighting.capturedAt || Date.now();
    for (const item of outfit) {
      if (!item || !item.kind) continue;
      // Skip note-empty / color-empty / subtype-empty 'other' items (they're
      // free-text annotations not real accessories).
      const hasContent = item.subtype || item.color || (item.note && item.note.trim());
      if (!hasContent) continue;
      inventory = upsertAccessory(inventory, item, ts);
    }
  }
  return inventory;
};
