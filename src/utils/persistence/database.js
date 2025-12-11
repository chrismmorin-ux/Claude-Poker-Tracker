/**
 * database.js - IndexedDB initialization and configuration
 *
 * Provides database initialization, constants, and migration logic.
 * This is the foundation module that all other persistence modules depend on.
 *
 * Database Schema:
 *   Database: "PokerTrackerDB" v7
 *   Object Stores:
 *     - "hands" (keyPath: "handId", autoIncrement: true)
 *       Indexes: timestamp, sessionId, userId, userId_timestamp (compound)
 *       Fields: seatPlayers, userId (for multi-user data isolation)
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
 *
 * Migration History:
 *   v6 → v7: Added userId field to all stores for multi-user data isolation
 *            Changed settings/activeSession from singleton to per-user keying
 *   v7 → v8: Added actionSequence field to hands for ordered action storage
 *            Converts existing seatActions to actionSequence on migration
 */

import { logger } from '../errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

export const DB_NAME = 'PokerTrackerDB';
export const DB_VERSION = 8;

// Guest user ID constant - matches authConstants.GUEST_USER_ID
export const GUEST_USER_ID = 'guest';
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

      // Migrate to v7: Add userId field for multi-user data isolation
      if (oldVersion < 7) {
        log('Upgrading to v7: Adding userId for multi-user support');

        const transaction = event.target.transaction;

        // Add userId index to hands store
        if (db.objectStoreNames.contains(STORE_NAME)) {
          const handsStore = transaction.objectStore(STORE_NAME);
          if (!handsStore.indexNames.contains('userId')) {
            handsStore.createIndex('userId', 'userId', { unique: false });
            log('Created userId index on hands store');
          }
          if (!handsStore.indexNames.contains('userId_timestamp')) {
            handsStore.createIndex('userId_timestamp', ['userId', 'timestamp'], { unique: false });
            log('Created userId_timestamp compound index on hands store');
          }

          // Migrate existing hands to have userId = 'guest'
          const handsCursor = handsStore.openCursor();
          handsCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const record = cursor.value;
              if (!record.userId) {
                record.userId = GUEST_USER_ID;
                cursor.update(record);
              }
              cursor.continue();
            } else {
              log('v7 migration: hands userId added');
            }
          };
        }

        // Add userId index to sessions store
        if (db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
          const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
          if (!sessionsStore.indexNames.contains('userId')) {
            sessionsStore.createIndex('userId', 'userId', { unique: false });
            log('Created userId index on sessions store');
          }
          if (!sessionsStore.indexNames.contains('userId_startTime')) {
            sessionsStore.createIndex('userId_startTime', ['userId', 'startTime'], { unique: false });
            log('Created userId_startTime compound index on sessions store');
          }

          // Migrate existing sessions to have userId = 'guest'
          const sessionsCursor = sessionsStore.openCursor();
          sessionsCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const record = cursor.value;
              if (!record.userId) {
                record.userId = GUEST_USER_ID;
                cursor.update(record);
              }
              cursor.continue();
            } else {
              log('v7 migration: sessions userId added');
            }
          };
        }

        // Add userId index to players store
        if (db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
          const playersStore = transaction.objectStore(PLAYERS_STORE_NAME);
          if (!playersStore.indexNames.contains('userId')) {
            playersStore.createIndex('userId', 'userId', { unique: false });
            log('Created userId index on players store');
          }
          if (!playersStore.indexNames.contains('userId_name')) {
            playersStore.createIndex('userId_name', ['userId', 'name'], { unique: false });
            log('Created userId_name compound index on players store');
          }

          // Migrate existing players to have userId = 'guest'
          const playersCursor = playersStore.openCursor();
          playersCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const record = cursor.value;
              if (!record.userId) {
                record.userId = GUEST_USER_ID;
                cursor.update(record);
              }
              cursor.continue();
            } else {
              log('v7 migration: players userId added');
            }
          };
        }

        // Add userId index to settings store
        // Settings changes from singleton (id:1) to per-user (id: `settings_${userId}`)
        if (db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          const settingsStore = transaction.objectStore(SETTINGS_STORE_NAME);

          // Migrate existing settings record (id: 1) to guest user
          const settingsCursor = settingsStore.openCursor();
          settingsCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const record = cursor.value;
              // Migrate old singleton record (id: 1) to guest user format
              if (record.id === 1 && !record.userId) {
                // Delete old record with id: 1
                settingsStore.delete(1);
                // Create new record with userId-based key
                record.id = `settings_${GUEST_USER_ID}`;
                record.userId = GUEST_USER_ID;
                settingsStore.add(record);
                log('v7 migration: settings migrated to userId-based key');
              }
              cursor.continue();
            } else {
              log('v7 migration: settings userId added');
            }
          };
        }

        // ActiveSession changes from singleton (id:1) to per-user (id: `active_${userId}`)
        if (db.objectStoreNames.contains(ACTIVE_SESSION_STORE_NAME)) {
          const activeStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);

          const activeCursor = activeStore.openCursor();
          activeCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const record = cursor.value;
              // Migrate old singleton record (id: 1) to guest user format
              if (record.id === 1 && !record.userId) {
                // Delete old record with id: 1
                activeStore.delete(1);
                // Create new record with userId-based key
                record.id = `active_${GUEST_USER_ID}`;
                record.userId = GUEST_USER_ID;
                activeStore.add(record);
                log('v7 migration: activeSession migrated to userId-based key');
              }
              cursor.continue();
            } else {
              log('v7 migration: activeSession userId added');
            }
          };
        }

        log('v7 migration initiated for all stores');
      }

      // Migrate to v8: Add actionSequence field to hands
      if (oldVersion < 8) {
        log('Upgrading to v8: Adding actionSequence field to hands');

        const transaction = event.target.transaction;

        if (db.objectStoreNames.contains(STORE_NAME)) {
          const handsStore = transaction.objectStore(STORE_NAME);

          // Migrate existing hands to have actionSequence
          const handsCursor = handsStore.openCursor();
          handsCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const hand = cursor.value;

              // Skip if already has actionSequence with items
              if (!hand.actionSequence || hand.actionSequence.length === 0) {
                // Get seatActions from either top-level or gameState
                const seatActions = hand.seatActions || hand.gameState?.seatActions;

                if (seatActions && typeof seatActions === 'object') {
                  // Inline conversion (can't import during migration)
                  const sequence = [];
                  const streets = ['preflop', 'flop', 'turn', 'river'];
                  let order = 1;

                  streets.forEach(street => {
                    const streetActions = seatActions[street];
                    if (!streetActions || typeof streetActions !== 'object') return;

                    // Sort seats numerically for consistent ordering
                    const seats = Object.keys(streetActions)
                      .map(Number)
                      .sort((a, b) => a - b);

                    seats.forEach(seat => {
                      const actions = streetActions[seat];
                      if (!Array.isArray(actions)) return;

                      actions.forEach(action => {
                        if (action && typeof action === 'string') {
                          sequence.push({
                            seat,
                            action,
                            street,
                            order: order++
                          });
                        }
                      });
                    });
                  });

                  hand.actionSequence = sequence;
                  cursor.update(hand);
                } else {
                  // No seatActions - add empty sequence
                  hand.actionSequence = [];
                  cursor.update(hand);
                }
              }

              cursor.continue();
            } else {
              log('v8 migration: hands actionSequence added');
            }
          };

          handsCursor.onerror = (e) => {
            logError('v8 migration failed:', e.target.error);
          };
        }

        log('v8 migration initiated for hands store');
      }
    };
  });
};
