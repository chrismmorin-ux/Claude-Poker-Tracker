/**
 * draftsStorage.js — Player-creation draft CRUD (PEO-1)
 *
 * Backs the `playerDrafts` IDB store (created in migrateV14).
 *
 * Invariants:
 *   I-PEO-1: At most one draft per userId. Key is userId.
 *            Commit (save player + delete draft) is atomic in a single IDB
 *            transaction spanning the players and playerDrafts stores —
 *            see commitDraft().
 *
 * Usage:
 *   const draft = await getDraft('guest');
 *   await putDraft('guest', { name: 'Mike', avatarFeatures: {...} }, { seat: 3, sessionId: 42 });
 *   await deleteDraft('guest');
 *   const playerId = await commitDraft('guest', finalPlayerRecord);
 */

import {
  getDB,
  PLAYER_DRAFTS_STORE_NAME,
  PLAYERS_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';
import { validateDraftRecord, validatePlayerRecord, logValidationErrors } from './validation';

// =============================================================================
// READ
// =============================================================================

/**
 * Fetch the draft record for a user, or null if no draft exists.
 * @param {string} userId
 * @returns {Promise<{userId, draft, seatContext, updatedAt} | null>}
 */
export const getDraft = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([PLAYER_DRAFTS_STORE_NAME], 'readonly');
      const store = tx.objectStore(PLAYER_DRAFTS_STORE_NAME);
      const req = store.get(userId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('Error in getDraft:', err);
    return null;
  }
};

// =============================================================================
// WRITE
// =============================================================================

/**
 * Upsert the draft for a user. Overwrites any existing draft (single-draft
 * invariant). Stamps updatedAt server-side.
 *
 * @param {string} userId
 * @param {object} draft in-progress form state (any subset of Player fields)
 * @param {object | null} seatContext { seat, sessionId } or null
 * @returns {Promise<void>}
 */
export const putDraft = async (userId, draft, seatContext = null) => {
  // Distinguish "omitted" (→ guest) from "explicitly empty string" (→ error).
  const finalUserId = (userId === undefined || userId === null) ? GUEST_USER_ID : userId;
  const record = {
    userId: finalUserId,
    draft: draft || null,
    seatContext: seatContext || null,
    updatedAt: Date.now(),
  };

  const validation = validateDraftRecord(record);
  if (!validation.valid) {
    logValidationErrors('putDraft', validation.errors);
    throw new Error(`Invalid draft record: ${validation.errors.join(', ')}`);
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYER_DRAFTS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(PLAYER_DRAFTS_STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => {
      log(`Draft saved for user ${record.userId}`);
      resolve();
    };
    req.onerror = () => {
      logError('Failed to save draft:', req.error);
      reject(req.error);
    };
  });
};

// =============================================================================
// DELETE
// =============================================================================

/**
 * Delete the draft for a user. No-op if no draft exists.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const deleteDraft = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([PLAYER_DRAFTS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(PLAYER_DRAFTS_STORE_NAME);
      const req = store.delete(userId);
      req.onsuccess = () => {
        log(`Draft deleted for user ${userId}`);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('Error in deleteDraft:', err);
    throw err;
  }
};

// =============================================================================
// ATOMIC COMMIT (I-PEO-1)
// =============================================================================

/**
 * Atomically commit a draft: write the final player record AND delete the
 * draft in ONE IDB transaction spanning both stores. If either op fails the
 * transaction aborts and the draft survives for retry.
 *
 * Does NOT check for name collisions here — caller must pre-check via
 * getPlayerByName (at the UI layer, as a non-blocking warning per D5).
 * This function trusts its input.
 *
 * @param {string} userId
 * @param {object} playerRecord finalised player (must pass validation)
 * @returns {Promise<number>} auto-generated playerId
 */
export const commitDraft = async (userId, playerRecord) => {
  if (!userId) throw new Error('commitDraft requires a userId');

  // Pre-validate before opening the transaction — if this fails there is no
  // partial state to worry about.
  const finalRecord = {
    ...playerRecord,
    userId,
    createdAt: playerRecord.createdAt ?? Date.now(),
    lastSeenAt: playerRecord.lastSeenAt ?? Date.now(),
    handCount: playerRecord.handCount ?? 0,
    stats: playerRecord.stats ?? null,
  };
  const validation = validatePlayerRecord(finalRecord);
  if (!validation.valid) {
    logValidationErrors('commitDraft', validation.errors);
    throw new Error(`Invalid player record: ${validation.errors.join(', ')}`);
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYERS_STORE_NAME, PLAYER_DRAFTS_STORE_NAME], 'readwrite');
    const playersStore = tx.objectStore(PLAYERS_STORE_NAME);
    const draftsStore = tx.objectStore(PLAYER_DRAFTS_STORE_NAME);

    let addedId = null;

    const addReq = playersStore.add(finalRecord);
    addReq.onsuccess = (event) => {
      addedId = event.target.result;
      // Delete draft in the SAME transaction so failure here aborts the add.
      const delReq = draftsStore.delete(userId);
      delReq.onerror = () => {
        // Abort triggers tx.onabort below; let that path reject.
        logError('commitDraft: draft delete failed', delReq.error);
      };
    };
    addReq.onerror = () => {
      // Caller may see this before tx.onabort fires; we still need the onabort
      // to run and reject (handles the "name unique constraint" case too).
      logError('commitDraft: player add failed', addReq.error);
    };

    tx.oncomplete = () => {
      if (addedId !== null) {
        log(`commitDraft: player ${addedId} created + draft cleared for user ${userId}`);
        resolve(addedId);
      } else {
        reject(new Error('commitDraft: transaction completed without a player id'));
      }
    };
    tx.onabort = () => reject(tx.error || new Error('commitDraft transaction aborted'));
    tx.onerror = () => reject(tx.error || new Error('commitDraft transaction errored'));
  });
};
