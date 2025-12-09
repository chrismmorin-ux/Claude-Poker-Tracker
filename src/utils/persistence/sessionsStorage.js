/**
 * sessionsStorage.js - Session CRUD operations
 *
 * Provides database operations for session management including
 * active session tracking, rebuy transactions, and cash out.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  initDB,
  STORE_NAME,
  SESSIONS_STORE_NAME,
  ACTIVE_SESSION_STORE_NAME,
  log,
  logError,
} from './database';

// =============================================================================
// SESSION CRUD OPERATIONS
// =============================================================================

/**
 * Create a new session
 * @param {Object} sessionData - Session data (buyIn, goal, notes, etc.)
 * @returns {Promise<number>} The auto-generated sessionId
 */
export const createSession = async (sessionData = {}) => {
  try {
    const db = await initDB();

    const sessionRecord = {
      startTime: Date.now(),
      endTime: null,
      isActive: true,
      venue: sessionData.venue || 'Online',
      gameType: sessionData.gameType || '1/2',
      buyIn: sessionData.buyIn || null,
      rebuyTransactions: sessionData.rebuyTransactions || [],
      cashOut: null,  // Always null when creating session
      reUp: sessionData.reUp || 0,
      goal: sessionData.goal || null,
      notes: sessionData.notes || null,
      handCount: 0,
      version: '1.3.0'  // Updated version for v4 schema
    };

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

      transaction.oncomplete = () => {
        db.close();
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
    const db = await initDB();

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

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in endSession:', error);
    throw error;
  }
};

/**
 * Get the currently active session
 * @returns {Promise<Object|null>} Active session data or null
 */
export const getActiveSession = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ACTIVE_SESSION_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);
      const request = objectStore.get(1); // Always use key = 1

      request.onsuccess = (event) => {
        const activeSessionRecord = event.target.result;

        if (activeSessionRecord && activeSessionRecord.sessionId) {
          log(`Active session: ${activeSessionRecord.sessionId}`);
          resolve({ sessionId: activeSessionRecord.sessionId });
        } else {
          log('No active session');
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to get active session:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getActiveSession:', error);
    return null; // Fail gracefully
  }
};

/**
 * Set the active session
 * @param {number} sessionId - The session ID to make active
 * @returns {Promise<void>}
 */
export const setActiveSession = async (sessionId) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ACTIVE_SESSION_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);

      const activeSessionRecord = {
        id: 1, // Always use key = 1
        sessionId: sessionId,
        lastUpdated: Date.now()
      };

      const request = objectStore.put(activeSessionRecord);

      request.onsuccess = () => {
        log(`Active session set to ${sessionId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to set active session:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in setActiveSession:', error);
    throw error;
  }
};

/**
 * Clear the active session
 * @returns {Promise<void>}
 */
export const clearActiveSession = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ACTIVE_SESSION_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);
      const request = objectStore.delete(1); // Always use key = 1

      request.onsuccess = () => {
        log('Active session cleared');
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to clear active session:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in clearActiveSession:', error);
    throw error;
  }
};

/**
 * Get all sessions from the database
 * @returns {Promise<Array>} Array of all session records
 */
export const getAllSessions = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const sessions = event.target.result;
        log(`Loaded ${sessions.length} sessions from database`);
        resolve(sessions);
      };

      request.onerror = (event) => {
        logError('Failed to load all sessions:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
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
    const db = await initDB();

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

      transaction.oncomplete = () => {
        db.close();
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
    const db = await initDB();

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

      transaction.oncomplete = () => {
        db.close();
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
    const db = await initDB();

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

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in updateSession:', error);
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
    const db = await initDB();

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

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getSessionHandCount:', error);
    return 0;
  }
};
