/**
 * tournamentsStorage.js - Tournament CRUD operations
 *
 * Provides database operations for tournament data persistence.
 * Follows the same patterns as sessionsStorage.js.
 */

import {
  readTx,
  writeTx,
  updateTx,
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
    const tournamentId = await writeTx(TOURNAMENTS_STORE_NAME, (store) => store.add(record));
    log(`Tournament created (ID: ${tournamentId}, session: ${sessionId})`);
    return tournamentId;
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
    const record = await readTx(TOURNAMENTS_STORE_NAME, (store) => store.index('sessionId').get(sessionId));
    return record ?? null;
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
    await updateTx(TOURNAMENTS_STORE_NAME, tournamentId, (record) => {
      if (!record) throw new Error(`Tournament ${tournamentId} not found`);
      return { ...record, ...updates, updatedAt: Date.now() };
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
    await writeTx(TOURNAMENTS_STORE_NAME, (store) => store.delete(tournamentId));
    log(`Tournament ${tournamentId} deleted`);
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
    const records = await readTx(TOURNAMENTS_STORE_NAME, (store) => store.index('userId').getAll(userId));
    return records || [];
  } catch (error) {
    logError(error);
    return [];
  }
};
