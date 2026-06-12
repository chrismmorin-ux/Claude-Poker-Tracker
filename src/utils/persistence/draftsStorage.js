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
  readTx,
  writeTx,
  atomicTx,
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
    const record = await readTx(PLAYER_DRAFTS_STORE_NAME, (store) => store.get(userId));
    return record ?? null;
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

  try {
    await writeTx(PLAYER_DRAFTS_STORE_NAME, (store) => store.put(record));
    log(`Draft saved for user ${record.userId}`);
  } catch (err) {
    logError('Failed to save draft:', err);
    throw err;
  }
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
    await writeTx(PLAYER_DRAFTS_STORE_NAME, (store) => store.delete(userId));
    log(`Draft deleted for user ${userId}`);
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

  try {
    const addedId = await atomicTx(
      [PLAYERS_STORE_NAME, PLAYER_DRAFTS_STORE_NAME],
      (stores, tx, setResult) => {
        const addReq = stores[PLAYERS_STORE_NAME].add(finalRecord);
        addReq.onsuccess = (event) => {
          setResult(event.target.result);
          // Delete draft in the SAME transaction so failure here aborts the add.
          stores[PLAYER_DRAFTS_STORE_NAME].delete(userId);
        };
      }
    );
    if (addedId === null || addedId === undefined) {
      throw new Error('commitDraft: transaction completed without a player id');
    }
    log(`commitDraft: player ${addedId} created + draft cleared for user ${userId}`);
    return addedId;
  } catch (err) {
    logError('commitDraft failed:', err);
    throw err;
  }
};
