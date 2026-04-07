/**
 * tournamentsStorage.js - Tournament CRUD operations
 *
 * Provides database operations for tournament data persistence.
 * Follows the same patterns as sessionsStorage.js.
 */

import {
  getDB,
  TOURNAMENTS_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

// =============================================================================
// TOURNAMENT CRUD OPERATIONS
// =============================================================================

/**
 * Create a new tournament record
 * @param {Object} config - Tournament configuration
 * @param {number} sessionId - Associated session ID
 * @param {string} userId - User ID
 * @returns {Promise<number>} The auto-generated tournamentId
 */
export const createTournament = async (config, sessionId, userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    const record = {
      sessionId,
      userId,
      config,
      currentLevelIndex: 0,
      levelStartTime: Date.now(),
      isPaused: false,
      pauseStartTime: null,
      totalPausedMs: 0,
      chipStacks: {},
      playersRemaining: config.totalEntrants || null,
      eliminations: [],
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([TOURNAMENTS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(TOURNAMENTS_STORE_NAME);
      const request = store.add(record);

      request.onsuccess = (e) => {
        const tournamentId = e.target.result;
        log(`Tournament created (ID: ${tournamentId}, session: ${sessionId})`);
        resolve(tournamentId);
      };
      request.onerror = (e) => {
        logError('Failed to create tournament:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (error) {
    logError(error);
    throw error;
  }
};

/**
 * Get tournament by session ID
 * @param {number} sessionId
 * @returns {Promise<Object|null>}
 */
export const getTournamentBySessionId = async (sessionId) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TOURNAMENTS_STORE_NAME], 'readonly');
      const store = tx.objectStore(TOURNAMENTS_STORE_NAME);
      const index = store.index('sessionId');
      const request = index.get(sessionId);

      request.onsuccess = (e) => resolve(e.target.result || null);
      request.onerror = (e) => {
        logError('Failed to get tournament:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (error) {
    logError(error);
    return null;
  }
};

/**
 * Update a tournament record
 * @param {number} tournamentId
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateTournament = async (tournamentId, updates) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TOURNAMENTS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(TOURNAMENTS_STORE_NAME);
      const request = store.get(tournamentId);

      request.onsuccess = (e) => {
        const record = e.target.result;
        if (!record) {
          reject(new Error(`Tournament ${tournamentId} not found`));
          return;
        }
        const updated = { ...record, ...updates, updatedAt: Date.now() };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = (err) => reject(err.target.error);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (error) {
    logError(error);
    throw error;
  }
};

// Future: tournament history

/**
 * Delete a tournament record
 * @param {number} tournamentId
 * @returns {Promise<void>}
 */
export const deleteTournament = async (tournamentId) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TOURNAMENTS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(TOURNAMENTS_STORE_NAME);
      const request = store.delete(tournamentId);

      request.onsuccess = () => {
        log(`Tournament ${tournamentId} deleted`);
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (error) {
    logError(error);
    throw error;
  }
};

// Future: tournament history

/**
 * Get all tournaments for a user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getAllTournaments = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TOURNAMENTS_STORE_NAME], 'readonly');
      const store = tx.objectStore(TOURNAMENTS_STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = (e) => resolve(e.target.result || []);
      request.onerror = (e) => {
        logError('Failed to get tournaments:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (error) {
    logError(error);
    return [];
  }
};
