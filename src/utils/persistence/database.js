/**
 * database.js - IndexedDB initialization and configuration
 *
 * Provides database initialization, constants, and migration logic.
 * This is the foundation module that all other persistence modules depend on.
 *
 * Database Schema:
 *   Database: "PokerTrackerDB" v6
 *   Object Stores:
 *     - "hands" (keyPath: "handId", autoIncrement: true)
 *       Indexes: timestamp, sessionId
 *       Fields: seatPlayers (object mapping seat # to playerId)
 *     - "sessions" (keyPath: "sessionId", autoIncrement: true)
 *       Indexes: startTime, endTime, isActive
 *       Fields: venue, gameType, buyIn, rebuyTransactions (array), cashOut, goal, notes, etc.
 *     - "activeSession" (keyPath: "id")
 *       Single-record store for current active session
 *     - "players" (keyPath: "playerId", autoIncrement: true)
 *       Indexes: name, createdAt, lastSeenAt
 *       Fields: name, nickname, ethnicity, build, gender, facialHair, hat, sunglasses, styleTags, notes, avatar, handCount, stats
 *     - "settings" (keyPath: "id")
 *       Single-record store for app settings (id: 1)
 *       Fields: theme, cardSize, defaultVenue, defaultGameType, autoBackupEnabled, backupFrequency, customVenues, customGameTypes, errorReportingEnabled
 */

import { logger } from '../errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

export const DB_NAME = 'PokerTrackerDB';
export const DB_VERSION = 6;
export const STORE_NAME = 'hands';
export const SESSIONS_STORE_NAME = 'sessions';
export const ACTIVE_SESSION_STORE_NAME = 'activeSession';
export const PLAYERS_STORE_NAME = 'players';
export const SETTINGS_STORE_NAME = 'settings';

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

    request.onsuccess = (event) => {
      const db = event.target.result;
      log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      log(`Database upgrade needed: v${oldVersion} → v${DB_VERSION}`);

      // Create hands object store if it doesn't exist (v1)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'handId',
          autoIncrement: true
        });

        // Create indexes for efficient queries
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('sessionId', 'sessionId', { unique: false });

        log('Hands object store and indexes created');
      }

      // Create sessions object store (v2)
      if (oldVersion < 2 && !db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE_NAME, {
          keyPath: 'sessionId',
          autoIncrement: true
        });

        // Create indexes for efficient queries
        sessionsStore.createIndex('startTime', 'startTime', { unique: false });
        sessionsStore.createIndex('endTime', 'endTime', { unique: false });
        sessionsStore.createIndex('isActive', 'isActive', { unique: false });

        log('Sessions object store and indexes created');
      }

      // Create activeSession object store (v2)
      if (oldVersion < 2 && !db.objectStoreNames.contains(ACTIVE_SESSION_STORE_NAME)) {
        db.createObjectStore(ACTIVE_SESSION_STORE_NAME, { keyPath: 'id' });
        log('ActiveSession object store created');
      }

      // Migrate to v3: Add venue, gameType, and convert rebuy to rebuyTransactions
      if (oldVersion < 3) {
        log('Upgrading to v3: Adding venue, gameType, and rebuyTransactions');

        const transaction = event.target.transaction;
        const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);

        // Get all existing sessions for migration
        const getAllRequest = sessionsStore.openCursor();

        getAllRequest.onsuccess = (e) => {
          const cursor = e.target.result;

          if (cursor) {
            const session = cursor.value;

            // Add new fields with defaults
            session.venue = session.venue || 'Online';
            session.gameType = session.gameType || '1/2';

            // Migrate rebuy: number → rebuyTransactions: array
            if (typeof session.rebuy === 'number') {
              if (session.rebuy > 0) {
                // Create single transaction with estimated timestamp (1 minute after session start)
                session.rebuyTransactions = [{
                  timestamp: session.startTime + 60000,
                  amount: session.rebuy
                }];
              } else {
                session.rebuyTransactions = [];
              }

              // Remove old rebuy field
              delete session.rebuy;
            } else {
              // Field already migrated or doesn't exist
              session.rebuyTransactions = session.rebuyTransactions || [];
            }

            // Update the session record
            cursor.update(session);

            // Move to next session
            cursor.continue();
          } else {
            log('v3 migration completed for all sessions');
          }
        };

        getAllRequest.onerror = (e) => {
          logError('v3 migration failed:', e.target.error);
        };
      }

      // Migrate to v4: Add cashOut field
      if (oldVersion < 4) {
        log('Upgrading to v4: Adding cashOut field');

        const transaction = event.target.transaction;
        const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);

        // Get all existing sessions for migration
        const getAllRequest = sessionsStore.openCursor();

        getAllRequest.onsuccess = (e) => {
          const cursor = e.target.result;

          if (cursor) {
            const session = cursor.value;

            // Add cashOut field with default null
            session.cashOut = session.cashOut || null;

            // Update the session record
            cursor.update(session);

            // Move to next session
            cursor.continue();
          } else {
            log('v4 migration completed for all sessions');
          }
        };

        getAllRequest.onerror = (e) => {
          logError('v4 migration failed:', e.target.error);
        };
      }

      // Migrate to v5: Add players object store
      if (oldVersion < 5) {
        log('Upgrading to v5: Adding players object store');

        if (!db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
          const playersStore = db.createObjectStore(PLAYERS_STORE_NAME, {
            keyPath: 'playerId',
            autoIncrement: true
          });

          // Create indexes for efficient queries
          playersStore.createIndex('name', 'name', { unique: false });
          playersStore.createIndex('createdAt', 'createdAt', { unique: false });
          playersStore.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });

          log('Players object store and indexes created');
        }
      }

      // Migrate to v6: Add settings object store
      if (oldVersion < 6) {
        log('Upgrading to v6: Adding settings object store');

        if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          // Settings uses a singleton pattern with keyPath 'id'
          // There will only ever be one record with id: 1
          db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'id' });

          log('Settings object store created');
        }
      }
    };
  });
};
