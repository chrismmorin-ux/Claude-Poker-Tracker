/**
 * playerAutoName.js — Non-blocking name derivation for player save (PEO-2)
 *
 * Per plan §D5 the editor save button is ALWAYS enabled; if the user hasn't
 * typed a name, we derive one that is still recognizable so the record
 * doesn't land in the database as an unusable "" or placeholder blob.
 *
 * Fallback chain (first match wins):
 *   1. User-typed name (non-empty after trim)  → nameSource: 'user'
 *   2. seatContext present → "Seat N — <distinctive feature label>"
 *      or just "Seat N" if no features picked  → nameSource: 'auto'
 *   3. Monotonic fallback using ISO timestamp   → nameSource: 'auto'
 *
 * The `nameSource` field on the Player record is later used by the picker
 * and editor-re-open flows to decide whether the name should be re-derived
 * on subsequent edits (user === canonical, auto === may be reprinted).
 */

import { getFeatureById } from '../assets/avatarFeatures';

// Ordered most-distinctive → least-distinctive. Picked first non-"none" wins.
// Beards and hats are the strongest single identifiers at a glance in live
// poker; style labels ("Goatee", "Cowboy") are already human-readable.
const DISTINCTIVE_CATEGORY_ORDER = [
  'beard',
  'hat',
  'glasses',
  'hair',
  'eyes',
];

/**
 * Pick the most distinctive feature label from an avatarFeatures object.
 * Returns the label string (e.g. "Goatee") or null if nothing picked.
 *
 * @param {object | null | undefined} avatarFeatures
 * @returns {string | null}
 */
export const pickDistinctiveFeature = (avatarFeatures) => {
  if (!avatarFeatures || typeof avatarFeatures !== 'object') return null;

  for (const category of DISTINCTIVE_CATEGORY_ORDER) {
    const id = avatarFeatures[category];
    if (!id || typeof id !== 'string') continue;
    // Skip the canonical "<category>.none" entries — those are not distinctive.
    if (id.endsWith('.none')) continue;
    const feature = getFeatureById(id);
    if (feature?.label && feature.label !== 'None' && feature.label !== 'Clean Shaven') {
      return feature.label;
    }
  }
  return null;
};

/**
 * Derive the final {name, nameSource} for a player record.
 *
 * @param {object} fields  in-progress form fields (at minimum may contain .name
 *                         and .avatarFeatures)
 * @param {{seat: number, sessionId?: number} | null | undefined} seatContext
 * @param {() => Date} [nowFn] injectable for deterministic tests
 * @returns {{ name: string, nameSource: 'user' | 'auto' }}
 */
export const deriveAutoName = (fields, seatContext, nowFn = () => new Date()) => {
  // 1. User-typed wins
  const typed = (fields?.name ?? '').toString().trim();
  if (typed.length > 0) {
    return { name: typed, nameSource: 'user' };
  }

  // 2. Seat-anchored fallback
  if (seatContext && typeof seatContext.seat === 'number') {
    const distinctive = pickDistinctiveFeature(fields?.avatarFeatures);
    const name = distinctive
      ? `Seat ${seatContext.seat} — ${distinctive}`
      : `Seat ${seatContext.seat}`;
    return { name, nameSource: 'auto' };
  }

  // 3. Timestamp fallback — short HH-MM-SS form keeps names scanable
  const now = nowFn();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return { name: `Player ${stamp}`, nameSource: 'auto' };
};
