/**
 * sessionsStorage.js - Session CRUD operations
 *
 * Provides database operations for session management including
 * active session tracking, rebuy transactions, and cash out.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  getDB,
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
    const db = await getDB();

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

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const request = objectStore.add(sessionRecord);

      request.onsuccess = (event) => {
        const sessionId = event.target.result;
        log(`Session created successfully (ID: ${sessionId})`);
        resolve(sessionId);
      };

      request.onerror = (event) => {
        logError('Failed to create session:', event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const getRequest = objectStore.get(sessionId);

      getRequest.onsuccess = (event) => {
        const session = event.target.result;

        if (!session) {
          logError(`Session ${sessionId} not found`);
          reject(new Error(`Session ${sessionId} not found`));
          return;
        }

        // Update session
        session.endTime = Date.now();
        session.isActive = false;
        session.cashOut = cashOut;

        const updateRequest = objectStore.put(session);

        updateRequest.onsuccess = () => {
          log(`Session ${sessionId} ended successfully`);
          resolve();
        };

        updateRequest.onerror = (event) => {
          logError(`Failed to end session ${sessionId}:`, event.target.error);
          reject(event.target.error);
        };
      };

      getRequest.onerror = (event) => {
        logError(`Failed to get session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();
    const activeKey = getActiveSessionKey(userId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ACTIVE_SESSION_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);
      const request = objectStore.get(activeKey);

      request.onsuccess = (event) => {
        const activeSessionRecord = event.target.result;

        if (activeSessionRecord && activeSessionRecord.sessionId) {
          log(`Active session for user ${userId}: ${activeSessionRecord.sessionId}`);
          resolve({ sessionId: activeSessionRecord.sessionId });
        } else {
          log(`No active session for user ${userId}`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to get active session:', event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();
    const activeKey = getActiveSessionKey(userId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ACTIVE_SESSION_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);

      const activeSessionRecord = {
        id: activeKey,
        sessionId: sessionId,
        userId,
        lastUpdated: Date.now()
      };

      const request = objectStore.put(activeSessionRecord);

      request.onsuccess = () => {
        log(`Active session set to ${sessionId} for user ${userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to set active session:', event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();
    const activeKey = getActiveSessionKey(userId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ACTIVE_SESSION_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);
      const request = objectStore.delete(activeKey);

      request.onsuccess = () => {
        log(`Active session cleared for user ${userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to clear active session:', event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(SESSIONS_STORE_NAME);

      // Use userId index to filter sessions
      const index = objectStore.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = (event) => {
        const sessions = event.target.result;
        log(`Loaded ${sessions.length} sessions for user ${userId}`);
        resolve(sessions);
      };

      request.onerror = (event) => {
        logError('Failed to load sessions:', event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const request = objectStore.get(sessionId);

      request.onsuccess = (event) => {
        const session = event.target.result;

        if (session) {
          log(`Loaded session ID ${sessionId}`);
          resolve(session);
        } else {
          log(`Session ID ${sessionId} not found`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError(`Failed to load session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const request = objectStore.delete(sessionId);

      request.onsuccess = () => {
        log(`Session ${sessionId} deleted successfully`);
        resolve();
      };

      request.onerror = (event) => {
        logError(`Failed to delete session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const getRequest = objectStore.get(sessionId);

      getRequest.onsuccess = (event) => {
        const session = event.target.result;

        if (!session) {
          logError(`Session ${sessionId} not found`);
          reject(new Error(`Session ${sessionId} not found`));
          return;
        }

        // Update fields
        Object.keys(updates).forEach(key => {
          session[key] = updates[key];
        });

        const updateRequest = objectStore.put(session);

        updateRequest.onsuccess = () => {
          log(`Session ${sessionId} updated successfully`);
          resolve();
        };

        updateRequest.onerror = (event) => {
          logError(`Failed to update session ${sessionId}:`, event.target.error);
          reject(event.target.error);
        };
      };

      getRequest.onerror = (event) => {
        logError(`Failed to get session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();

    const sessionRecord = {
      startTime: Date.now(),
      endTime: null,
      isActive: true,
      venue: sessionData.venue || 'Online',
      gameType: sessionData.gameType || '1/2',
      buyIn: sessionData.buyIn || null,
      rebuyTransactions: sessionData.rebuyTransactions || [],
      cashOut: null,
      reUp: sessionData.reUp || 0,
      goal: sessionData.goal || null,
      notes: sessionData.notes || null,
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

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [SESSIONS_STORE_NAME, ACTIVE_SESSION_STORE_NAME],
        'readwrite'
      );

      const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const activeStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);

      const addRequest = sessionsStore.add(sessionRecord);

      addRequest.onsuccess = (event) => {
        const sessionId = event.target.result;

        activeStore.put({
          id: activeKey,
          sessionId,
          userId,
          lastUpdated: Date.now()
        });

        // Resolve with sessionId after full transaction commits
        transaction.oncomplete = () => {
          log(`Session ${sessionId} created and set active atomically`);
          resolve(sessionId);
        };
      };

      addRequest.onerror = (event) => {
        reject(event.target.error);
      };

      transaction.onerror = (event) => {
        logError('Atomic createSession failed:', event.target.error);
        reject(event.target.error);
      };

      transaction.onabort = (event) => {
        logError('Atomic createSession aborted:', event.target.error);
        reject(event.target.error || new Error('Transaction aborted'));
      };
    });
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
  try {
    const db = await getDB();
    const activeKey = `active_${userId || GUEST_USER_ID}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [SESSIONS_STORE_NAME, ACTIVE_SESSION_STORE_NAME],
        'readwrite'
      );

      const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const activeStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);

      const getRequest = sessionsStore.get(sessionId);

      getRequest.onsuccess = (event) => {
        const session = event.target.result;

        if (!session) {
          reject(new Error(`Session ${sessionId} not found`));
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

        sessionsStore.put(session);
        activeStore.delete(activeKey);

        transaction.oncomplete = () => {
          log(`Session ${sessionId} ended and active marker cleared atomically`);
          resolve();
        };
      };

      getRequest.onerror = (event) => {
        reject(event.target.error);
      };

      transaction.onerror = (event) => {
        logError('Atomic endSession failed:', event.target.error);
        reject(event.target.error);
      };

      transaction.onabort = (event) => {
        logError('Atomic endSession aborted:', event.target.error);
        reject(event.target.error || new Error('Transaction aborted'));
      };
    });
  } catch (error) {
    logError('Error in endSessionAtomic:', error);
    throw error;
  }
};

/**
 * Get the count of hands for a specific session
 * @param {number} sessionId - The session ID
 * @returns {Promise<number>} Number of hands in session
 */
export const getSessionHandCount = async (sessionId) => {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('sessionId');
      const request = index.count(sessionId);

      request.onsuccess = (event) => {
        const count = event.target.result;
        log(`Session ${sessionId} hand count: ${count}`);
        resolve(count);
      };

      request.onerror = (event) => {
        logError(`Failed to get hand count for session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };

    });
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
    const db = await getDB();

    // Look for existing session with this tableId
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readwrite');
      const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);

      // Check if tableId index exists (v12+)
      let existingSession = null;
      if (sessionsStore.indexNames.contains('tableId')) {
        const tableIdIndex = sessionsStore.index('tableId');
        const getRequest = tableIdIndex.get(tableId);

        getRequest.onsuccess = (event) => {
          existingSession = event.target.result;

          if (existingSession && existingSession.userId === userId) {
            // Reuse existing session
            log(`Reusing online session ${existingSession.sessionId} for table ${tableId}`);
            resolve(existingSession.sessionId);
          } else {
            // Create new session
            createOnlineSession(sessionsStore, tableId, userId, resolve, reject);
          }
        };

        getRequest.onerror = () => {
          // Index query failed — create new
          createOnlineSession(sessionsStore, tableId, userId, resolve, reject);
        };
      } else {
        // No tableId index (pre-v12) — just create
        createOnlineSession(sessionsStore, tableId, userId, resolve, reject);
      }

    });
  } catch (error) {
    logError('Error in getOrCreateOnlineSession:', error);
    throw error;
  }
};

function createOnlineSession(store, tableId, userId, resolve, reject) {
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
    resolve(sessionId);
  };

  addRequest.onerror = (event) => {
    logError('Failed to create online session:', event.target.error);
    reject(event.target.error);
  };
}
