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
 * Create a new session
 * @param {Object} sessionData - Session data (buyIn, goal, notes, etc.)
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} The auto-generated sessionId
 */
export const createSession = async (sessionData = {}, userId = GUEST_USER_ID) => {
  try {
    const sessionRecord = {
      startTime: Date.now(),
      endTime: null,
      isActive: true,
      venue: sessionData.venue || 'Online',
      gameType: sessionData.gameType || '1/2',
      buyIn: sessionData.buyIn || null,
      rebuyTransactions: sessionData.rebuyTransactions || [],
      cashOut: null,  // Always null when creating session
      // AUDIT-2026-04-21-SV F2: optional tip amount logged at cash-out.
      // JTBD-SM-21 names tip logging explicitly; prior to this addition net P&L
      // silently overcounted by the tip amount for every tipped session.
      // Backward-compat: legacy sessions without the field read as undefined →
      // treated as 0 downstream via `(session.tipAmount || 0)` pattern.
      tipAmount: null,
      reUp: sessionData.reUp || 0,
      goal: sessionData.goal || null,
      notes: sessionData.notes || null,
      // Straddle config must survive an app restart WITHIN the session —
      // HYDRATE_SESSION restores from this record, and pot math downstream
      // depends on it. (It still never carries across to a NEW session.)
      straddle: sessionData.straddle || null,
      handCount: 0,
      userId,
      version: '1.4.0'  // Updated version for v7 schema (userId)
    };

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
export const endSessionAtomic = async (sessionId, cashOut = null, userId = GUEST_USER_ID, tipAmount = null) => {
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

          session.endTime = Date.now();
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
 * @returns {Promise<number>} Session ID
 */
export const getOrCreateOnlineSession = async (tableId, userId = GUEST_USER_ID) => {
  try {
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
            // Reuse existing session
            log(`Reusing online session ${existingSession.sessionId} for table ${tableId}`);
            setResult(existingSession.sessionId);
          } else {
            // Create new session
            createOnlineSession(sessionsStore, tableId, userId, setResult);
          }
        };
      } else {
        // No tableId index (pre-v12) — just create
        createOnlineSession(sessionsStore, tableId, userId, setResult);
      }
    });
  } catch (error) {
    logError('Error in getOrCreateOnlineSession:', error);
    throw error;
  }
};

function createOnlineSession(store, tableId, userId, setResult) {
  const sessionRecord = {
    startTime: Date.now(),
    endTime: null,
    isActive: false, // Online sessions don't use active session tracking
    venue: 'Ignition',
    gameType: 'NL Holdem',
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
    log(`Created online session ${sessionId} for table ${tableId}`);
    setResult(sessionId);
  };
}
