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

// Phase 7: pickDistinctiveFeature now reads Phase-3 identification fields
// directly (avatarFeatures was dropped). Order remains most-distinctive
// first — facial hair / headwear / eyewear are the strongest single
// identifiers at a glance in live poker.

const FACIAL_HAIR_LABELS = {
  stubble: 'Stubble',
  mustache: 'Mustache',
  goatee: 'Goatee',
  full: 'Full Beard',
  'soul-patch': 'Soul Patch',
};

const HEADWEAR_LABELS = {
  cap: 'Cap',
  beanie: 'Beanie',
  visor: 'Visor',
  fedora: 'Fedora',
  cowboy: 'Cowboy Hat',
};

const EYEWEAR_LABELS = {
  clear: 'Glasses',
  sunglasses: 'Sunglasses',
  readers: 'Readers',
  aviators: 'Aviators',
};

const HAIR_LENGTH_LABELS = {
  bald: 'Bald',
  shaved: 'Buzz Cut',
  long: 'Long Hair',
};

/**
 * Pick the most distinctive identification-derived label.
 * Returns a human-readable string (e.g. "Goatee") or null if nothing picked.
 *
 * @param {object | null | undefined} fields  Player fields (Phase 3 shape)
 * @returns {string | null}
 */
export const pickDistinctiveFeature = (fields) => {
  if (!fields || typeof fields !== 'object') return null;

  // Order: facial hair → headwear → eyewear → hair length (only if distinctive)
  const fh = fields.facialHair;
  if (fh && fh !== 'clean' && FACIAL_HAIR_LABELS[fh]) return FACIAL_HAIR_LABELS[fh];

  const hw = fields.headwear;
  if (hw && hw !== 'none' && HEADWEAR_LABELS[hw]) return HEADWEAR_LABELS[hw];

  const ew = fields.eyewear;
  if (ew && ew !== 'none' && EYEWEAR_LABELS[ew]) return EYEWEAR_LABELS[ew];

  const hl = fields.hairLength;
  if (hl && HAIR_LENGTH_LABELS[hl]) return HAIR_LENGTH_LABELS[hl];

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
    const distinctive = pickDistinctiveFeature(fields);
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
