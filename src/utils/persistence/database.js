/**
 * database.js - IndexedDB initialization and configuration
 *
 * Provides database initialization, constants, and migration logic.
 * This is the foundation module that all other persistence modules depend on.
 *
 * Database Schema:
 *   Database: "PokerTrackerDB" v13
 *   Object Stores:
 *     - "hands" (keyPath: "handId", autoIncrement: true)
 *       Indexes: timestamp, sessionId, userId, userId_timestamp (compound)
 *       Fields: seatPlayers, actionSequence, userId (for multi-user data isolation)
 *     - "sessions" (keyPath: "sessionId", autoIncrement: true)
 *       Indexes: startTime, endTime, isActive, userId, userId_startTime (compound)
 *       Fields: venue, gameType, buyIn, rebuyTransactions (array), cashOut, goal, notes, userId
 *     - "activeSession" (keyPath: "id")
 *       Per-user store: id = `active_${userId}` (e.g., "active_guest")
 *       Fields: sessionId, userId, lastUpdated
 *     - "players" (keyPath: "playerId", autoIncrement: true)
 *       Indexes: name, createdAt, lastSeenAt, userId, userId_name (compound)
 *       Fields: name, nickname, ethnicity, build, gender, facialHair, styleTags, notes, avatar, userId
 *     - "settings" (keyPath: "id")
 *       Per-user store: id = `settings_${userId}` (e.g., "settings_guest")
 *       Fields: theme, cardSize, defaultVenue, defaultGameType, customVenues, customGameTypes, userId
 *     - "rangeProfiles" (keyPath: "profileKey")
 *       Indexes: playerId, userId
 *       Fields: profileKey, playerId, userId, ranges, showdownAnchors, handsProcessed
 *
 * Migration History:
 *   v6 → v7: Added userId field to all stores for multi-user data isolation
 *            Changed settings/activeSession from singleton to per-user keying
 *   v7 → v8: Added actionSequence field to hands for ordered action storage
 *            Converts existing seatActions to actionSequence on migration
 *   v8 → v9: Added rangeProfiles object store for cached Bayesian range estimates
 *   v9 → v10: Added exploitBriefings[] and dismissedBriefingIds[] to player records
 *   v10 → v11: Added tournaments object store for tournament state persistence
 *   v11 → v12: Added source/tableId indexes to hands/sessions for online play integration
 *   v12 → v13: Normalized seatActions field in existing hand records
 */

import { logger } from '../errorHandler';
import { GUEST_USER_ID } from '../../constants/authConstants';
import { runMigrations } from './migrations';

// =============================================================================
// CONSTANTS
// =============================================================================

export const DB_NAME = 'PokerTrackerDB';
export const DB_VERSION = 16;

export { GUEST_USER_ID };
export const STORE_NAME = 'hands';
export const SESSIONS_STORE_NAME = 'sessions';
export const ACTIVE_SESSION_STORE_NAME = 'activeSession';
export const PLAYERS_STORE_NAME = 'players';
export const SETTINGS_STORE_NAME = 'settings';
export const RANGE_PROFILES_STORE_NAME = 'rangeProfiles';
export const TOURNAMENTS_STORE_NAME = 'tournaments';
export const PLAYER_DRAFTS_STORE_NAME = 'playerDrafts';
export const PREFLOP_DRILLS_STORE_NAME = 'preflopDrills';
export const POSTFLOP_DRILLS_STORE_NAME = 'postflopDrills';

const MODULE_NAME = 'Persistence';

// Backward-compatible logging wrappers
export const log = (...args) => logger.debug(MODULE_NAME, ...args);
export const logError = (error) => logger.error(MODULE_NAME, error);

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

/**
 * Initialize IndexedDB database
 * Creates database and object store if they don't exist
 * @returns {Promise<IDBDatabase>} Database connection
 */
export const initDB = async () => {
  return new Promise((resolve, reject) => {
    // Check if IndexedDB is supported
    if (!window.indexedDB) {
      logError('IndexedDB not supported in this browser');
      reject(new Error('IndexedDB not supported'));
      return;
    }

    log('Initializing database...');

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      logError('Failed to open database:', event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      logError('Database upgrade blocked — another tab may have an open connection. Please close other tabs and reload.');
      reject(new Error('Database upgrade blocked by another tab. Close other tabs and reload.'));
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const transaction = event.target.transaction;

      log(`Database upgrade needed: v${oldVersion} → v${DB_VERSION}`);

      runMigrations(db, transaction, oldVersion);
    };
  });
};

// =============================================================================
// CONNECTION POOL (singleton cached connection)
// =============================================================================

let cachedDb = null;
let dbPromise = null;

/**
 * Get a shared database connection. Returns cached connection if alive,
 * otherwise opens a new one via initDB(). Never call db.close() on the
 * returned connection — use closeDB() for explicit shutdown.
 * @returns {Promise<IDBDatabase>}
 */
export const getDB = async () => {
  if (cachedDb) return cachedDb;
  if (dbPromise) return dbPromise;

  dbPromise = initDB().then(db => {
    cachedDb = db;
    dbPromise = null;

    db.onclose = () => { cachedDb = null; };
    db.onversionchange = () => {
      db.close();
      cachedDb = null;
    };

    return db;
  }).catch(err => {
    dbPromise = null;
    throw err;
  });

  return dbPromise;
};

/**
 * Explicitly close the cached connection (for app unmount / test teardown).
 */
export const closeDB = () => {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
  dbPromise = null;
};

/**
 * Reset pool state without closing (for test isolation with fake-indexeddb).
 */
export const resetDBPool = () => {
  cachedDb = null;
  dbPromise = null;
};
