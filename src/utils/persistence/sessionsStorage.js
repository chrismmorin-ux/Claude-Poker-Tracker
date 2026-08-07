/**
 * sessionsStorage.js - Session CRUD operations
 *
 * Provides database operations for session management including
 * active session tracking, rebuy transactions, and cash out.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  readTx,
  writeTx,
  updateTx,
  atomicTx,
  STORE_NAME,
  SESSIONS_STORE_NAME,
  ACTIVE_SESSION_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

import {
  validateSessionRecord,
  logValidationErrors,
} from './validation';

/**
 * Get the active session key for a user
 * @param {string} userId - User ID (or 'guest')
 * @returns {string} Active session key
 */
const getActiveSessionKey = (userId) => `active_${userId || GUEST_USER_ID}`;

// =============================================================================
// SESSION CRUD OPERATIONS
// =============================================================================

/**
 * Build the common session record shape.
 *
 * Shared by `createSession` (live, in-progress) and `createCompletedSession`
 * (backfilled, already finished) so their defaults cannot drift apart. Every
 * field that differs between the two is passed in via `overrides`.
 *
 * @param {Object} sessionData - caller-supplied fields
 * @param {string} userId
 * @param {Object} overrides - startTime / endTime / isActive / cashOut / tipAmount
 * @returns {Object} session record
 */
const buildSessionRecord = (sessionData, userId, overrides) => ({
  venue: sessionData.venue || 'Online',
  gameType: sessionData.gameType || '1/2',
  buyIn: sessionData.buyIn || null,
  rebuyTransactions: sessionData.rebuyTransactions || [],
  // AUDIT-2026-04-21-SV F2: optional tip amount logged at cash-out.
  // JTBD-SM-21 names tip logging explicitly; prior to this addition net P&L
  // silently overcounted by the tip amount for every tipped session.
  // Backward-compat: legacy sessions without the field read as undefined →
  // treated as 0 downstream via `(session.tipAmount || 0)` pattern.
  reUp: sessionData.reUp || 0,
  goal: sessionData.goal || null,
  notes: sessionData.notes || null,
  // Straddle config must survive an app restart WITHIN the session —
  // HYDRATE_SESSION restores from this record, and pot math downstream
  // depends on it. (It still never carries across to a NEW session.)
  straddle: sessionData.straddle || null,
  handCount: sessionData.handCount || 0,
  userId,
  version: '1.4.0',  // Updated version for v7 schema (userId)
  ...overrides,
});

/**
 * Create a new session
 * @param {Object} sessionData - Session data (buyIn, goal, notes, etc.)
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} The auto-generated sessionId
 */
export const createSession = async (sessionData = {}, userId = GUEST_USER_ID) => {
  try {
    const sessionRecord = buildSessionRecord(sessionData, userId, {
      startTime: Date.now(),
      endTime: null,
      isActive: true,
      cashOut: null,  // Always null when creating session
      tipAmount: null,
      handCount: 0,   // A live session always starts at zero hands
    });

    // Validate session record before saving
    const validation = validateSessionRecord(sessionRecord);
    if (!validation.valid) {
      logValidationErrors('createSession', validation.errors);
      throw new Error(`Invalid session data: ${validation.errors.join(', ')}`);
    }

    const sessionId = await writeTx(SESSIONS_STORE_NAME, (store) => store.add(sessionRecord));
    log(`Session created successfully (ID: ${sessionId})`);
    return sessionId;
  } catch (error) {
    logError('Error in createSession:', error);
    throw error;
  }
};

/**
 * Create an ALREADY-FINISHED session — the backfill path.
 *
 * `createSession` stamps `Date.now()` and `isActive: true`, which is correct for
 * a session you are about to sit down and play but useless for logging one you
 * played last night. This writer takes explicit start/end times and a cash-out,
 * and never produces an active session, so backfilling can never collide with a
 * live session or leave a second one running.
 *
 * Times are supplied as epoch ms by the caller (SessionLogForm derives them from
 * a date + two clock fields, wrapping past midnight when the end reads earlier
 * than the start).
 *
 * @param {Object} sessionData - startTime, endTime, cashOut, venue, gameType,
 *   buyIn, rebuyTransactions, tipAmount, goal, notes
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} The auto-generated sessionId
 */
export const createCompletedSession = async (sessionData = {}, userId = GUEST_USER_ID) => {
  try {
    if (!sessionData.startTime) {
      throw new Error('createCompletedSession requires an explicit startTime');
    }

    const sessionRecord = buildSessionRecord(sessionData, userId, {
      startTime: sessionData.startTime,
      endTime: sessionData.endTime ?? null,
      // Never active. A backfilled session is history by definition, and an
      // active one here would shadow whatever the founder is actually playing.
      isActive: false,
      cashOut: sessionData.cashOut ?? null,
      tipAmount: sessionData.tipAmount ?? null,
      origin: 'manual-log',
    });

    const validation = validateSessionRecord(sessionRecord);
    if (!validation.valid) {
      logValidationErrors('createCompletedSession', validation.errors);
      throw new Error(`Invalid session data: ${validation.errors.join(', ')}`);
    }

    const sessionId = await writeTx(SESSIONS_STORE_NAME, (store) => store.add(sessionRecord));
    log(`Completed session logged (ID: ${sessionId})`);
    return sessionId;
  } catch (error) {
    logError('Error in createCompletedSession:', error);
    throw error;
  }
};

/**
 * End a session by setting its endTime and isActive = false
 * @param {number} sessionId - The session ID to end
 * @param {number|null} cashOut - Optional cash out amount
 * @returns {Promise<void>}
 */
export const endSession = async (sessionId, cashOut = null) => {
  try {
    await updateTx(SESSIONS_STORE_NAME, sessionId, (session) => {
      if (!session) throw new Error(`Session ${sessionId} not found`);
      session.endTime = Date.now();
      session.isActive = false;
      session.cashOut = cashOut;
      return session;
    });
    log(`Session ${sessionId} ended successfully`);
  } catch (error) {
    logError('Error in endSession:', error);
    throw error;
  }
};

/**
 * Get the currently active session for a user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Object|null>} Active session data or null
 */
export const getActiveSession = async (userId = GUEST_USER_ID) => {
  try {
    const activeKey = getActiveSessionKey(userId);
    const activeSessionRecord = await readTx(ACTIVE_SESSION_STORE_NAME, (store) => store.get(activeKey));
    if (activeSessionRecord && activeSessionRecord.sessionId) {
      log(`Active session for user ${userId}: ${activeSessionRecord.sessionId}`);
      return { sessionId: activeSessionRecord.sessionId };
    }
    log(`No active session for user ${userId}`);
    return null;
  } catch (error) {
    logError('Error in getActiveSession:', error);
    return null; // Fail gracefully
  }
};

/**
 * Set the active session for a user
 * @param {number} sessionId - The session ID to make active
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
export const setActiveSession = async (sessionId, userId = GUEST_USER_ID) => {
  try {
    const activeKey = getActiveSessionKey(userId);
    const activeSessionRecord = {
      id: activeKey,
      sessionId: sessionId,
      userId,
      lastUpdated: Date.now()
    };
    await writeTx(ACTIVE_SESSION_STORE_NAME, (store) => store.put(activeSessionRecord));
    log(`Active session set to ${sessionId} for user ${userId}`);
  } catch (error) {
    logError('Error in setActiveSession:', error);
    throw error;
  }
};

/**
 * Clear the active session for a user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
export const clearActiveSession = async (userId = GUEST_USER_ID) => {
  try {
    const activeKey = getActiveSessionKey(userId);
    await writeTx(ACTIVE_SESSION_STORE_NAME, (store) => store.delete(activeKey));
    log(`Active session cleared for user ${userId}`);
  } catch (error) {
    logError('Error in clearActiveSession:', error);
    throw error;
  }
};

/**
 * Get all sessions from the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Array>} Array of session records
 */
export const getAllSessions = async (userId = GUEST_USER_ID) => {
  try {
    // Use userId index to filter sessions
    const sessions = await readTx(SESSIONS_STORE_NAME, (store) => store.index('userId').getAll(userId));
    log(`Loaded ${sessions.length} sessions for user ${userId}`);
    return sessions;
  } catch (error) {
    logError('Error in getAllSessions:', error);
    return [];
  }
};

/**
 * Import historical session records additively.
 *
 * WHY THIS EXISTS SEPARATELY FROM `importAllData` (src/utils/exportUtils.js):
 * that path calls `clearAllData()` first — it restores a full backup and is
 * destructive by design. Importing a bankroll history must never wipe tracked
 * hands, players, or existing sessions, so this writer only ever adds.
 *
 * IDEMPOTENT: every record carries a deterministic `importKey`. Keys already
 * present are skipped, so re-running the import is safe and reports how many
 * rows it recognised. `sessionId` is deliberately not accepted from callers —
 * IndexedDB assigns it — so a record can never overwrite an unrelated session.
 *
 * @param {Array<Object>} records - Session records (see sheetImport.toSessionRecord)
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<{imported:number, skipped:number, errors:Array<string>}>}
 */
export const importHistoricalSessions = async (records = [], userId = GUEST_USER_ID) => {
  const result = { imported: 0, skipped: 0, errors: [] };
  if (!Array.isArray(records) || records.length === 0) return result;

  try {
    const existing = await getAllSessions(userId);
    const seenKeys = new Set(
      existing.map((session) => session.importKey).filter(Boolean)
    );

    for (const record of records) {
      const { sessionId, ...rest } = record || {};

      if (rest.importKey && seenKeys.has(rest.importKey)) {
        result.skipped += 1;
        continue;
      }

      const sessionRecord = {
        ...rest,
        isActive: false,
        userId,
        version: '1.4.0',
      };

      const validation = validateSessionRecord(sessionRecord);
      if (!validation.valid) {
        logValidationErrors('importHistoricalSessions', validation.errors);
        result.errors.push(
          `Skipped ${rest.importKey || 'unkeyed row'}: ${validation.errors.join(', ')}`
        );
        continue;
      }

      try {
        await writeTx(SESSIONS_STORE_NAME, (store) => store.add(sessionRecord));
        if (rest.importKey) seenKeys.add(rest.importKey);
        result.imported += 1;
      } catch (error) {
        result.errors.push(`Failed to import ${rest.importKey || 'row'}: ${error.message}`);
      }
    }

    log(`Imported ${result.imported} historical sessions (${result.skipped} already present)`);
    return result;
  } catch (error) {
    logError('Error in importHistoricalSessions:', error);
    result.errors.push(`Import failed: ${error.message}`);
    return result;
  }
};

/**
 * Get a specific session by ID
 * @param {number} sessionId - The session ID to load
 * @returns {Promise<Object|null>} Session data or null if not found
 */
export const getSessionById = async (sessionId) => {
  try {
    const session = await readTx(SESSIONS_STORE_NAME, (store) => store.get(sessionId));
    log(session ? `Loaded session ID ${sessionId}` : `Session ID ${sessionId} not found`);
    return session ?? null;
  } catch (error) {
    logError('Error in getSessionById:', error);
    return null;
  }
};

/**
 * Delete a specific session by ID
 * @param {number} sessionId - The session ID to delete
 * @returns {Promise<void>}
 */
export const deleteSession = async (sessionId) => {
  try {
    await writeTx(SESSIONS_STORE_NAME, (store) => store.delete(sessionId));
    log(`Session ${sessionId} deleted successfully`);
  } catch (error) {
    logError('Error in deleteSession:', error);
    throw error;
  }
};

/**
 * Update a session's fields
 * @param {number} sessionId - The session ID to update
 * @param {Object} updates - Fields to update (buyIn, rebuy, reUp, goal, notes, etc.)
 * @returns {Promise<void>}
 */
export const updateSession = async (sessionId, updates) => {
  try {
    await updateTx(SESSIONS_STORE_NAME, sessionId, (session) => {
      if (!session) throw new Error(`Session ${sessionId} not found`);
      // Update fields
      Object.keys(updates).forEach(key => {
        session[key] = updates[key];
      });
      return session;
    });
    log(`Session ${sessionId} updated successfully`);
  } catch (error) {
    logError('Error in updateSession:', error);
    throw error;
  }
};

// =============================================================================
// ATOMIC SESSION OPERATIONS (multi-store transactions)
// =============================================================================

/**
 * Create a session and set it as active in a single atomic transaction.
 * Both writes commit or both abort — no drift between stores.
 * @param {Object} sessionData - Session data (buyIn, goal, notes, etc.)
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} The auto-generated sessionId
 */
export const createSessionAtomic = async (sessionData = {}, userId = GUEST_USER_ID) => {
  try {
    const sessionRecord = {
      startTime: Date.now(),
      endTime: null,
      isActive: true,
      venue: sessionData.venue || 'Online',
      gameType: sessionData.gameType || '1/2',
      buyIn: sessionData.buyIn || null,
      rebuyTransactions: sessionData.rebuyTransactions || [],
      cashOut: null,
      // AUDIT-2026-04-21-SV F2: schema parity with createSession — initialize
      // tipAmount: null on create so both creators produce identical record
      // shapes (WS-219). endSessionAtomic later sets it at cash-out.
      tipAmount: null,
      reUp: sessionData.reUp || 0,
      goal: sessionData.goal || null,
      notes: sessionData.notes || null,
      // Same within-session restart contract as createSession above.
      straddle: sessionData.straddle || null,
      handCount: 0,
      userId,
      version: '1.4.0'
    };

    const validation = validateSessionRecord(sessionRecord);
    if (!validation.valid) {
      logValidationErrors('createSessionAtomic', validation.errors);
      throw new Error(`Invalid session data: ${validation.errors.join(', ')}`);
    }

    const activeKey = `active_${userId || GUEST_USER_ID}`;

    // Resolves with sessionId after the full transaction commits.
    const sessionId = await atomicTx(
      [SESSIONS_STORE_NAME, ACTIVE_SESSION_STORE_NAME],
      (stores, tx, setResult) => {
        const addRequest = stores[SESSIONS_STORE_NAME].add(sessionRecord);
        addRequest.onsuccess = (event) => {
          setResult(event.target.result);
          stores[ACTIVE_SESSION_STORE_NAME].put({
            id: activeKey,
            sessionId: event.target.result,
            userId,
            lastUpdated: Date.now()
          });
        };
      }
    );
    log(`Session ${sessionId} created and set active atomically`);
    return sessionId;
  } catch (error) {
    logError('Error in createSessionAtomic:', error);
    throw error;
  }
};

/**
 * End a session and clear the active marker in a single atomic transaction.
 * Both writes commit or both abort — no drift between stores.
 * @param {number} sessionId - The session ID to end
 * @param {number|null} cashOut - Optional cash out amount
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
// AUDIT-2026-04-21-SV F2: `tipAmount` is additive-optional. Legacy sessions without
// the field remain valid; readers treat undefined as 0. No IDB version bump needed.
export const endSessionAtomic = async (sessionId, cashOut = null, userId = GUEST_USER_ID, tipAmount = null, endTime = null) => {
  let sessionMissing = false;
  try {
    const activeKey = `active_${userId || GUEST_USER_ID}`;

    await atomicTx(
      [SESSIONS_STORE_NAME, ACTIVE_SESSION_STORE_NAME],
      (stores, tx) => {
        const getRequest = stores[SESSIONS_STORE_NAME].get(sessionId);
        getRequest.onsuccess = (event) => {
          const session = event.target.result;
          if (!session) {
            sessionMissing = true;
            tx.abort();
            return;
          }

          // Explicit endTime when the founder corrected it at cash-out (racked
          // up earlier, ended the session late); otherwise now.
          session.endTime = endTime ?? Date.now();
          session.isActive = false;
          session.cashOut = cashOut;
          // AUDIT-2026-04-21-SV F2: persist tip when provided; skip field when null
          // to keep legacy-session parity on round-trip.
          if (tipAmount !== null && tipAmount !== undefined) {
            session.tipAmount = tipAmount;
          }

          stores[SESSIONS_STORE_NAME].put(session);
          stores[ACTIVE_SESSION_STORE_NAME].delete(activeKey);
        };
      }
    );
    log(`Session ${sessionId} ended and active marker cleared atomically`);
  } catch (error) {
    const err = sessionMissing ? new Error(`Session ${sessionId} not found`) : error;
    logError('Error in endSessionAtomic:', err);
    throw err;
  }
};

/**
 * Get the count of hands for a specific session
 * @param {number} sessionId - The session ID
 * @returns {Promise<number>} Number of hands in session
 */
export const getSessionHandCount = async (sessionId) => {
  try {
    const count = await readTx(STORE_NAME, (store) => store.index('sessionId').count(sessionId));
    log(`Session ${sessionId} hand count: ${count}`);
    return count;
  } catch (error) {
    logError('Error in getSessionHandCount:', error);
    return 0;
  }
};

// =============================================================================
// ONLINE SESSION OPERATIONS (for Ignition integration)
// =============================================================================

/**
 * Get or create an online session for a specific table.
 * Each Ignition table gets its own session, identified by tableId.
 * Reuses existing session if one exists for this tableId.
 *
 * @param {string} tableId - Unique table identifier from extension
 * @param {string} userId - User ID
 * @param {Object} [meta] - Optional table metadata from the wire capture.
 * @param {{sb: number, bb: number}} [meta.blinds] - Real table blinds (dollars). When
 *        present, the session records the true stakes so the pool baseline segments
 *        online populations by stake (WS-260 / FIND-037) instead of one blended pool.
 * @returns {Promise<number>} Session ID
 */
export const getOrCreateOnlineSession = async (tableId, userId = GUEST_USER_ID, meta = {}) => {
  try {
    const stakes = normalizeStakes(meta.blinds);
    // Reuse-check + create happen in ONE readwrite transaction so two
    // concurrent callers can't both create a session for the same table.
    return await atomicTx([SESSIONS_STORE_NAME], (stores, tx, setResult) => {
      const sessionsStore = stores[SESSIONS_STORE_NAME];

      // Check if tableId index exists (v12+)
      if (sessionsStore.indexNames.contains('tableId')) {
        const getRequest = sessionsStore.index('tableId').get(tableId);

        getRequest.onsuccess = (event) => {
          const existingSession = event.target.result;

          if (existingSession && existingSession.userId === userId) {
            // Reuse existing session — heal missing stakes if the wire now has them
            // (covers sessions created before the first blinds frame arrived).
            if (!existingSession.stakes && stakes) {
              const healed = {
                ...existingSession,
                stakes,
                gameType: stakesLabel(stakes),
              };
              sessionsStore.put(healed);
              log(`Healed stakes on online session ${existingSession.sessionId} → ${healed.gameType}`);
            } else {
              log(`Reusing online session ${existingSession.sessionId} for table ${tableId}`);
            }
            setResult(existingSession.sessionId);
          } else {
            // Create new session
            createOnlineSession(sessionsStore, tableId, userId, stakes, setResult);
          }
        };
      } else {
        // No tableId index (pre-v12) — just create
        createOnlineSession(sessionsStore, tableId, userId, stakes, setResult);
      }
    });
  } catch (error) {
    logError('Error in getOrCreateOnlineSession:', error);
    throw error;
  }
};

/**
 * Validate wire blinds into a stakes record, or null when absent/malformed.
 * The protocol adapter can emit { sb: null, bb: null } on partial captures.
 */
export const normalizeStakes = (blinds) => {
  const sb = blinds?.sb;
  const bb = blinds?.bb;
  if (typeof sb !== 'number' || typeof bb !== 'number' || !(sb > 0) || !(bb > 0)) return null;
  return { sb, bb };
};

/** Display label for a stakes record, e.g. { sb: 0.02, bb: 0.05 } → '0.02/0.05'. */
export const stakesLabel = (stakes) => `${stakes.sb}/${stakes.bb}`;

function createOnlineSession(store, tableId, userId, stakes, setResult) {
  const sessionRecord = {
    startTime: Date.now(),
    endTime: null,
    isActive: false, // Online sessions don't use active session tracking
    venue: 'Ignition',
    // Real stakes when the wire capture provides blinds; legacy placeholder otherwise
    // (healed on a later import or by the one-time WS-260 backfill).
    gameType: stakes ? stakesLabel(stakes) : 'NL Holdem',
    stakes: stakes || null,
    buyIn: null,
    rebuyTransactions: [],
    cashOut: null,
    reUp: 0,
    goal: null,
    notes: null,
    handCount: 0,
    userId,
    version: '1.4.0',
    source: 'ignition',
    tableId,
  };

  const addRequest = store.add(sessionRecord);

  addRequest.onsuccess = (event) => {
    const sessionId = event.target.result;
    log(`Created online session ${sessionId} for table ${tableId} (${sessionRecord.gameType})`);
    setResult(sessionId);
  };
}
