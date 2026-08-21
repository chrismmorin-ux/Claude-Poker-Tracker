/**
 * handsStorage.js - Hand CRUD operations
 *
 * Provides database operations for hand history management.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  getDB,
  readTx,
  writeTx,
  updateTx,
  cursorTx,
  atomicTx,
  STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

import {
  getActiveSession,
  getSessionById,
  getSessionHandCount,
} from './sessionsStorage';

import {
  validateHandRecord,
  logValidationErrors,
} from './validation';

import {
  HAND_SOURCES,
  isHandSource,
  liveHandProvenance,
  ignitionHandProvenance,
  importedHandProvenance,
} from './handProvenance';

// =============================================================================
// HAND CRUD OPERATIONS
// =============================================================================

/**
 * Shared writer for the session-linked hand paths (`saveHand`,
 * `saveImportedHand`). Counts the session's existing hands and adds the record
 * in ONE readwrite transaction (RT-39: prevents the TOCTOU race on
 * sessionHandNumber).
 *
 * PROVENANCE IS NOT A PARAMETER OF THE PUBLIC API (WS-368). This helper takes
 * a `stamp` produced by a `handProvenance.js` constructor, and each public
 * entry point supplies exactly one constructor. There is no code path that
 * reaches an `objectStore.add` on `hands` without a stamp, and no caller can
 * choose the wrong channel because no caller names a channel.
 *
 * The stamp is spread AFTER `...handData`, so a `source` / `provenance` riding
 * along inside the incoming payload cannot survive. That single ordering is
 * what closes the import contamination vector: a file claiming its hands are
 * live cannot make them live.
 *
 * @param {Object} params
 * @param {Object} params.handData
 * @param {string} params.userId
 * @param {number|null} params.sessionId
 * @param {{source: string, provenance: Object}} params.stamp
 * @param {string} params.context - caller name, for logs
 * @returns {Promise<number>} The auto-generated handId
 */
const persistHandRecord = async ({ handData, userId, sessionId, stamp, context }) => {
  let validationFailure = null;
  try {
    const timestamp = Date.now();

    return await atomicTx([STORE_NAME], (stores, tx, setResult) => {
      const objectStore = stores[STORE_NAME];

      // Step 1: Count existing hands in this session (within same transaction)
      const resolveCount = (count) => {
        const sessionHandNumber = sessionId ? count + 1 : null;
        const handDisplayId = sessionId
          ? `S${sessionId}-H${sessionHandNumber}`
          : `H${timestamp}`;

        const handRecord = {
          ...handData,
          timestamp,
          version: '1.3.0',
          userId,
          sessionId,
          sessionHandNumber,
          handDisplayId,
          // Last spread wins — see the contamination note above.
          ...stamp,
        };

        const validation = validateHandRecord(handRecord);
        if (!validation.valid) {
          logValidationErrors(context, validation.errors);
          validationFailure = new Error(`Invalid hand data: ${validation.errors.join(', ')}`);
          tx.abort();
          return;
        }

        // Step 2: Add hand in same transaction
        const addRequest = objectStore.add(handRecord);
        addRequest.onsuccess = (event) => {
          setResult(event.target.result);
          log(`Hand saved successfully (ID: ${event.target.result}, displayId: ${handDisplayId}, source: ${handRecord.source})`);
        };
      };

      if (sessionId) {
        const countRequest = objectStore.index('sessionId').count(sessionId);
        countRequest.onsuccess = (event) => resolveCount(event.target.result);
      } else {
        resolveCount(0);
      }
    });
  } catch (error) {
    const err = validationFailure || error;
    if (err?.name === 'QuotaExceededError') {
      logError('Storage quota exceeded. Please clear old hands.');
    }
    logError(`Error in ${context}:`, err);
    throw err;
  }
};

/**
 * Save a hand recorded AT THE TABLE by the founder — the live / manual-entry
 * path. Auto-links to the active session and derives the hand's venue and
 * stake from that session record (WS-368: the stamp carries population
 * identity, because every comparative claim this repo makes is a claim about a
 * population).
 *
 * This function stamps `source: 'live'` unconditionally. That is deliberate:
 * it is the ONLY function that may, and it takes no channel argument, so the
 * live set cannot be joined by accident. Hands from the extension go through
 * `saveOnlineHand`; hands from a backup file go through `saveImportedHand`.
 *
 * @param {Object} handData - Hand data containing gameState, cardState, and optional seatPlayers
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveHand = async (handData, userId = GUEST_USER_ID) => {
  // Fetched for the session link AND for venue/stake. One read, both uses —
  // the active session is where the founder actually declared them, so the
  // stamp states a fact rather than defaulting one.
  const activeSession = await getActiveSession(userId);
  return persistHandRecord({
    handData,
    userId,
    sessionId: activeSession?.sessionId || null,
    stamp: liveHandProvenance(activeSession),
    context: 'saveHand',
  });
};

/**
 * Save a hand that arrived through the backup-import path (WS-368).
 *
 * Split out of `saveHand` because routing imports through the live writer was
 * the contamination vector: `exportUtils.importAllData` called `saveHand`,
 * which stamped nothing, so every imported hand became a member of "live" by
 * construction and nothing anywhere could detect it.
 *
 * Two behavioural differences from `saveHand`, both required by what an import
 * IS:
 *   - Stamps `source: 'import'`, preserving whatever the file claimed under
 *     `provenance.original` as evidence rather than truth.
 *   - Uses the sessionId the caller computed (importAllData remaps old session
 *     ids to new ones) instead of consulting the active session. An imported
 *     hand belongs to the session it was imported with, not to whatever the
 *     founder happens to have open.
 *
 * @param {Object} handData - Hand payload from the backup file, with sessionId already remapped
 * @param {string} userId - User ID
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveImportedHand = async (handData, userId = GUEST_USER_ID) => {
  return persistHandRecord({
    handData,
    userId,
    sessionId: handData?.sessionId ?? null,
    stamp: importedHandProvenance(handData),
    context: 'saveImportedHand',
  });
};

/**
 * Load the most recent hand from the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Object|null>} Hand data or null if no hands exist
 */
export const loadLatestHand = async (userId = GUEST_USER_ID) => {
  try {
    // Use userId_timestamp compound index for efficient user-filtered query;
    // walk descending and stop at the first (most recent) record.
    const found = await cursorTx(
      STORE_NAME,
      { index: 'userId_timestamp', range: IDBKeyRange.bound([userId, 0], [userId, Date.now()]), direction: 'prev' },
      (cursor, acc) => {
        acc.push(cursor.value);
        return false;
      }
    );
    const hand = found[0] ?? null;
    log(hand
      ? `Loaded latest hand for user ${userId} (ID: ${hand.handId})`
      : `No hands found for user ${userId}`);
    return hand;
  } catch (error) {
    logError('Error in loadLatestHand:', error);
    return null; // Fail gracefully
  }
};

/**
 * Load a specific hand by ID
 * @param {number} handId - The hand ID to load
 * @returns {Promise<Object|null>} Hand data or null if not found
 */
export const loadHandById = async (handId) => {
  try {
    const hand = await readTx(STORE_NAME, (store) => store.get(handId));
    log(hand ? `Loaded hand ID ${handId}` : `Hand ID ${handId} not found`);
    return hand ?? null;
  } catch (error) {
    logError('Error in loadHandById:', error);
    return null;
  }
};

/**
 * Load all hands from the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Array>} Array of hand records
 */
export const getAllHands = async (userId = GUEST_USER_ID) => {
  try {
    // Use userId index to filter hands
    const hands = await readTx(STORE_NAME, (store) => store.index('userId').getAll(userId));
    log(`Loaded ${hands.length} hands for user ${userId}`);
    return hands;
  } catch (error) {
    logError('Error in getAllHands:', error);
    return [];
  }
};

/**
 * Get all hands for a specific session
 * @param {number} sessionId - The session ID to filter by
 * @returns {Promise<Array>} Array of hand records for this session
 */
export const getHandsBySessionId = async (sessionId) => {
  try {
    const hands = await readTx(STORE_NAME, (store) => store.index('sessionId').getAll(sessionId));
    log(`Loaded ${hands.length} hands for session ${sessionId}`);
    return hands;
  } catch (error) {
    logError('Error in getHandsBySessionId:', error);
    return [];
  }
};

/**
 * Delete a specific hand by ID
 * @param {number} handId - The hand ID to delete
 * @returns {Promise<void>}
 */
export const deleteHand = async (handId) => {
  try {
    await writeTx(STORE_NAME, (store) => store.delete(handId));
    log(`Hand ${handId} deleted successfully`);
  } catch (error) {
    logError('Error in deleteHand:', error);
    throw error;
  }
};

// =============================================================================
// SEAT-PLAYER UPDATE OPERATIONS (PEO-1 retroactive linking)
// =============================================================================

/**
 * Update seat→player mapping on a single hand.
 * Used by retroactive linking when a player is assigned to a seat whose prior
 * hands this session were recorded anonymously.
 *
 * Setting playerId to null clears the seat assignment.
 *
 * @param {number} handId
 * @param {number} seat
 * @param {number | null} playerId
 * @returns {Promise<void>}
 */
export const updateSeatPlayerForHand = async (handId, seat, playerId) => {
  await updateTx(STORE_NAME, handId, (hand) => {
    if (!hand) throw new Error(`Hand ${handId} not found`);
    const nextSeatPlayers = { ...(hand.seatPlayers || {}) };
    if (playerId === null || playerId === undefined) {
      delete nextSeatPlayers[seat];
    } else {
      nextSeatPlayers[seat] = playerId;
    }
    hand.seatPlayers = nextSeatPlayers;
    return hand;
  });
};

/**
 * Batch update seat→player mappings across multiple hands in ONE transaction.
 * Required for retroactive linking to preserve atomicity — either all updates
 * apply or none do. See invariant I-PEO-1.
 *
 * @param {Array<{handId: number, seat: number, playerId: number | null}>} updates
 * @returns {Promise<void>}
 */
// WS-226 exception: N-read+N-write batch with bespoke abort-tracking (failTx
// short-circuits remaining callbacks on first failure). The helper shapes
// don't model mid-flight cancellation; hand-rolled tx retained deliberately.
export const batchUpdateSeatPlayers = async (updates) => {
  if (!Array.isArray(updates)) {
    throw new Error('batchUpdateSeatPlayers: updates must be an array');
  }
  if (updates.length === 0) return;

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let remaining = updates.length;
    let aborted = false;

    const failTx = (err) => {
      if (aborted) return;
      aborted = true;
      tx.abort();
      reject(err);
    };

    for (const { handId, seat, playerId } of updates) {
      const getReq = store.get(handId);
      getReq.onsuccess = (event) => {
        if (aborted) return;
        const hand = event.target.result;
        if (!hand) {
          failTx(new Error(`Hand ${handId} not found`));
          return;
        }
        const nextSeatPlayers = { ...(hand.seatPlayers || {}) };
        if (playerId === null || playerId === undefined) {
          delete nextSeatPlayers[seat];
        } else {
          nextSeatPlayers[seat] = playerId;
        }
        hand.seatPlayers = nextSeatPlayers;
        const putReq = store.put(hand);
        putReq.onsuccess = () => {
          remaining -= 1;
          // All puts scheduled; tx.oncomplete will fire next.
        };
        putReq.onerror = () => failTx(putReq.error);
      };
      getReq.onerror = () => failTx(getReq.error);
    }

    tx.oncomplete = () => {
      if (!aborted) {
        log(`batchUpdateSeatPlayers: ${updates.length} hands updated`);
        resolve();
      }
    };
    tx.onabort = () => {
      if (!aborted) reject(tx.error || new Error('batchUpdateSeatPlayers aborted'));
    };
    tx.onerror = () => failTx(tx.error || new Error('batchUpdateSeatPlayers errored'));
  });
};

// =============================================================================
// REVIEW-TAG OPERATIONS (WS-190 mid-hand tag-for-review)
// =============================================================================

/**
 * Set (or clear) the reviewTag on a single saved hand record.
 *
 * Used to untag a past hand from the Review Queue / replay surface, where the
 * hand is no longer the in-progress hand held in game state. Tagging during
 * live play rides the auto-save path (gameState.reviewTag → handData.reviewTag);
 * this function is for after-the-fact edits to a persisted record.
 *
 * @param {number} handId - The hand ID to update
 * @param {{tagged: boolean, taggedAt: number} | null} reviewTag - Tag object, or null to untag
 * @returns {Promise<void>}
 */
export const updateHandReviewTag = async (handId, reviewTag) => {
  await updateTx(STORE_NAME, handId, (hand) => {
    if (!hand) throw new Error(`Hand ${handId} not found`);
    hand.reviewTag = reviewTag ?? null;
    return hand;
  });
  log(`Hand ${handId} reviewTag updated (tagged: ${!!reviewTag?.tagged})`);
};

/**
 * Load all tagged hands (reviewTag.tagged === true) for a user, sorted by
 * taggedAt descending (most-recently-tagged first). Powers the Sessions
 * "Tagged ⭐" Review Queue filter.
 *
 * Scans the user's hands and filters in memory. A single user's local hand
 * volume is modest; a boolean reviewTag index is not worth the IDB complexity.
 *
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Array>} Array of tagged hand records, newest tag first
 */
export const getTaggedHands = async (userId = GUEST_USER_ID) => {
  try {
    const hands = await getAllHands(userId);
    return hands
      .filter((h) => h.reviewTag?.tagged === true)
      .sort((a, b) => (b.reviewTag?.taggedAt ?? 0) - (a.reviewTag?.taggedAt ?? 0));
  } catch (error) {
    logError('Error in getTaggedHands:', error);
    return [];
  }
};

// =============================================================================

/**
 * Clear all hands for a specific user from the database
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
export const clearAllHands = async (userId = GUEST_USER_ID) => {
  try {
    let keyCount = 0;
    // Key lookup + deletes happen in ONE readwrite transaction.
    await writeTx(STORE_NAME, (store) => {
      const getRequest = store.index('userId').getAllKeys(userId);
      getRequest.onsuccess = (event) => {
        const keys = event.target.result;
        keyCount = keys.length;
        keys.forEach((key) => store.delete(key));
      };
    });
    log(keyCount === 0
      ? `No hands to clear for user ${userId}`
      : `Cleared ${keyCount} hands for user ${userId}`);
  } catch (error) {
    logError('Error in clearAllHands:', error);
    throw error;
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the count of hands in the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} Number of hands
 */
export const getHandCount = async (userId = GUEST_USER_ID) => {
  try {
    const count = await readTx(STORE_NAME, (store) => store.index('userId').count(userId));
    log(`Hand count for user ${userId}: ${count}`);
    return count;
  } catch (error) {
    logError('Error in getHandCount:', error);
    return 0;
  }
};

/**
 * Check if a hand exists by ID
 * @param {number} handId - The hand ID to check
 * @returns {Promise<boolean>} True if hand exists
 */
export const handExists = async (handId) => {
  try {
    const hand = await loadHandById(handId);
    return hand !== null;
  } catch (error) {
    logError('Error in handExists:', error);
    return false;
  }
};

// =============================================================================
// ONLINE HAND OPERATIONS (for Ignition integration)
// =============================================================================

/**
 * Save a hand from online play (Ignition extension).
 * Unlike saveHand(), does NOT auto-link to active session — uses provided sessionId.
 * Stamps `source: 'ignition'` plus the structured provenance object and
 * generates display IDs.
 *
 * @param {Object} handData - Hand record from extension (gameState, cardState, seatPlayers)
 * @param {number} sessionId - Online session ID (from getOrCreateOnlineSession)
 * @param {string} userId - User ID
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveOnlineHand = async (handData, sessionId, userId = GUEST_USER_ID) => {
  try {
    // Calculate sessionHandNumber
    let sessionHandNumber = null;
    if (sessionId) {
      const existingCount = await getSessionHandCount(sessionId);
      sessionHandNumber = existingCount + 1;
    }

    // The online session carries the table's real stakes once the wire capture
    // has seen a blinds frame (sessionsStorage.normalizeStakes). Read it so the
    // ignition stamp states the same population identity the live stamp does.
    const session = sessionId ? await getSessionById(sessionId) : null;

    const timestamp = handData.timestamp || Date.now();
    const handDisplayId = sessionId
      ? `S${sessionId}-H${sessionHandNumber}`
      : `H${timestamp}`;

    const handRecord = {
      ...handData,
      timestamp,
      version: '1.3.0',
      userId,
      sessionId,
      sessionHandNumber,
      handDisplayId,
      // Last spread wins — an extension payload cannot claim another channel.
      ...ignitionHandProvenance(session),
    };

    // Keep captureId for dedup, strip extension-only capturedAt
    delete handRecord.capturedAt;

    const validation = validateHandRecord(handRecord);
    if (!validation.valid) {
      logValidationErrors('saveOnlineHand', validation.errors);
      throw new Error(`Invalid online hand: ${validation.errors.join(', ')}`);
    }

    // Dedup on captureId — the deterministic identity stamped by the extension's
    // enqueueHand. Until 2026-08-21 this guard never ran even once: `captureId` was
    // not on buildHandForRelay's whitelist (wire-schemas.js), so it never crossed
    // the wire and `if (handRecord.captureId)` was always false. Measured effect —
    // 5,992 rows in this store representing 362 distinct hands.
    //
    // Read-and-add in ONE transaction. Separate readTx/writeTx left a window where
    // two deliveries could both pass the check before either wrote, which is not
    // hypothetical: the service worker opens an app tab on its own
    // (ensureAppTabOpen), so a second tab the founder opens by hand gives two live
    // bridges delivering the same queue concurrently.
    if (!handRecord.captureId) {
      return await writeTx(STORE_NAME, (store) => store.add(handRecord));
    }

    return await atomicTx([STORE_NAME], (stores, tx, setResult) => {
      const objectStore = stores[STORE_NAME];

      const addRecord = () => {
        const addRequest = objectStore.add(handRecord);
        addRequest.onsuccess = (event) => setResult(event.target.result);
      };

      // Scope the scan by sessionId where we have one — a duplicate always carries
      // the same sessionId as its original, since sessionId is resolved from the
      // table before the record is built. Without one there is no index to narrow
      // by and correctness requires looking at every candidate.
      const scanRequest = sessionId != null
        ? objectStore.index('sessionId').getAll(sessionId)
        : objectStore.getAll();

      scanRequest.onsuccess = (event) => {
        const existing = event.target.result || [];
        if (existing.some(h => h.captureId === handRecord.captureId)) {
          log(`Skipping duplicate online hand: ${handRecord.captureId}`);
          setResult(-1); // Already exists — tx completes without a write
          return;
        }
        addRecord();
      };
    });
  } catch (error) {
    logError('Error in saveOnlineHand:', error);
    throw error;
  }
};

/**
 * Get all hands for a specific provenance channel.
 *
 * WHAT WAS WRONG (WS-368). The filter — `h.source === source` — was always
 * correct. What was wrong was that nothing ever WROTE `'live'`, so this
 * function's documented contract ("'live' | 'ignition'") and its behaviour
 * disagreed: called with `'live'` it returned [] on a database full of live
 * hands, silently, forever. Documented API, zero results, no error. That is
 * the shape the blocker took in practice, and it is why the fix is at the
 * write side rather than here.
 *
 * Two changes on the read side:
 *   - The doc now names the whole closed set, including `'unknown'` (rows the
 *     v28 migration could not attribute) and `'import'`.
 *   - An unrecognised channel THROWS instead of returning []. A typo used to
 *     be indistinguishable from an empty result, which is how a broken
 *     selector stays broken; a wrong question should be loud.
 *
 * `'unknown'` is never folded into any other channel. Those rows may be live,
 * may be imported, may be manually entered — treating them as live is exactly
 * the guess that would manufacture the population the fault register's
 * falsifier exists to measure.
 *
 * @param {'live'|'ignition'|'import'|'unknown'} source - provenance channel
 * @param {string} userId - User ID
 * @returns {Promise<Object[]>} Array of hand records
 * @throws {Error} if `source` is not a known channel
 */
export const getHandsBySource = async (source, userId = GUEST_USER_ID) => {
  if (!isHandSource(source)) {
    throw new Error(
      `getHandsBySource: unknown source ${JSON.stringify(source)} — expected one of: ${HAND_SOURCES.join(', ')}`,
    );
  }
  try {
    // Use userId index and filter by source in memory
    // (compound index userId_source would be ideal but source index is new)
    const all = await readTx(STORE_NAME, (store) => store.index('userId').getAll(userId));
    const hands = all.filter(h => h.source === source);
    log(`Loaded ${hands.length} ${source} hands for user ${userId}`);
    return hands;
  } catch (error) {
    logError('Error in getHandsBySource:', error);
    return [];
  }
};
