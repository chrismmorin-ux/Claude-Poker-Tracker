/**
 * migrateGuestData.js — one-time, non-destructive merge of 'guest' data into a signed-in account.
 *
 * Context: online capture writes under the Firebase UID, but the main-app read paths
 * historically defaulted to 'guest'. After the read-path fix (signed-in = your account),
 * any data the user created while signed OUT (guest) would be hidden. This migration MOVES
 * ownership of that guest data into the signed-in account so nothing is lost or hidden.
 *
 * Strategy — RE-KEY IN PLACE, not copy:
 *   For each empirical store, cursor by PRIMARY KEY and rewrite records whose userId === 'guest'
 *   to the target userId. Primary keys (handId / sessionId / playerId / sightingId) are
 *   PRESERVED, so cross-references (seatPlayers → playerId, hand.sessionId → sessionId) stay
 *   intact. (A copy approach would mint new ids and break those references.)
 *
 * Scope:
 *   - MOVED: hands, sessions, players, sightingLogs (the empirical, user-owned data).
 *   - SKIPPED (derived — regenerate from moved hands): rangeProfiles.
 *   - SKIPPED (singletons / per-user prefs — must not clobber the signed-in user's own):
 *     settings, activeSession.
 *
 * Idempotent: once guest records are re-keyed, none remain to move, so re-runs move 0 and are
 * safe no-ops. Non-destructive: no record is ever deleted; ownership is reassigned.
 *
 * @module migrateGuestData
 */

import {
  cursorTx,
  GUEST_USER_ID,
  STORE_NAME,
  SESSIONS_STORE_NAME,
  PLAYERS_STORE_NAME,
  SIGHTING_LOGS_STORE_NAME,
  log,
  logError,
} from './database';

/** Empirical, user-owned stores to move. Order: parents before children is not required
 *  (re-key preserves keys, so references never dangle mid-migration). */
export const MERGE_STORES = [
  STORE_NAME,            // hands
  SESSIONS_STORE_NAME,   // sessions
  PLAYERS_STORE_NAME,    // players
  SIGHTING_LOGS_STORE_NAME, // PIO sighting logs
];

/**
 * Re-key every guest-owned record in one store to targetUserId. Cursor walks by PRIMARY KEY
 * (no index) so rewriting the userId field does not perturb iteration.
 * @param {string} storeName
 * @param {string} targetUserId
 * @returns {Promise<number>} count of records moved
 */
const rekeyStore = async (storeName, targetUserId) => {
  let moved = 0;
  await cursorTx(storeName, { mode: 'readwrite' }, (cursor) => {
    const rec = cursor.value;
    if (rec && rec.userId === GUEST_USER_ID) {
      cursor.update({ ...rec, userId: targetUserId });
      moved += 1;
    }
  });
  return moved;
};

/**
 * Move all guest-owned empirical data into the signed-in account. Idempotent + non-destructive.
 * @param {string} targetUserId - the signed-in account id (Firebase UID)
 * @returns {Promise<{ migrated: boolean, total: number, counts: Record<string, number|string>, reason?: string }>}
 */
export const migrateGuestDataToUser = async (targetUserId) => {
  if (!targetUserId || targetUserId === GUEST_USER_ID) {
    return { migrated: false, total: 0, counts: {}, reason: 'no-target' };
  }

  const counts = {};
  let total = 0;
  for (const store of MERGE_STORES) {
    try {
      const n = await rekeyStore(store, targetUserId);
      counts[store] = n;
      total += n;
    } catch (err) {
      logError(`migrateGuestDataToUser: re-key of ${store} failed`, err);
      counts[store] = `error: ${err?.message || String(err)}`;
    }
  }

  if (total > 0) {
    log(`Guest→${targetUserId} merge moved ${total} record(s): ${JSON.stringify(counts)}`);
  }
  return { migrated: total > 0, total, counts };
};
