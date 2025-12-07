/**
 * persistence.js - IndexedDB persistence layer
 *
 * Provides core database operations for hand history and session tracking.
 * All functions are async and handle errors gracefully (fail-safe).
 *
 * Database Schema:
 *   Database: "PokerTrackerDB" v5
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
 */

import { logger, AppError, ERROR_CODES } from './errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

const DB_NAME = 'PokerTrackerDB';
const DB_VERSION = 5;
const STORE_NAME = 'hands';
const SESSIONS_STORE_NAME = 'sessions';
const ACTIVE_SESSION_STORE_NAME = 'activeSession';
const PLAYERS_STORE_NAME = 'players';
const MODULE_NAME = 'Persistence';

// Backward-compatible logging wrappers
const log = (...args) => logger.debug(MODULE_NAME, ...args);
const logError = (error) => logger.error(MODULE_NAME, error);

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
    };
  });
};

// =============================================================================
// HAND CRUD OPERATIONS
// =============================================================================

/**
 * Save a hand to the database
 * Auto-links hand to active session if one exists
 * @param {Object} handData - Hand data containing gameState, cardState, and optional seatPlayers
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveHand = async (handData) => {
  try {
    const db = await initDB();

    // Get active session to auto-link hand
    const activeSession = await getActiveSession();

    // Add metadata
    const handRecord = {
      ...handData,
      timestamp: Date.now(),
      version: '1.1.0', // Session tracking support
      sessionId: activeSession?.sessionId || null,  // Auto-link to active session
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(handRecord);

      request.onsuccess = (event) => {
        const handId = event.target.result;
        log(`Hand saved successfully (ID: ${handId})`);
        resolve(handId);
      };

      request.onerror = (event) => {
        logError('Failed to save hand:', event.target.error);

        // Check for quota exceeded
        if (event.target.error.name === 'QuotaExceededError') {
          logError('Storage quota exceeded. Please clear old hands.');
        }

        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in saveHand:', error);
    throw error;
  }
};

/**
 * Load the most recent hand from the database
 * @returns {Promise<Object|null>} Hand data or null if no hands exist
 */
export const loadLatestHand = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('timestamp');

      // Open cursor in descending order (most recent first)
      const request = index.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          const hand = cursor.value;
          log(`Loaded latest hand (ID: ${hand.handId}, timestamp: ${new Date(hand.timestamp).toLocaleString()})`);
          resolve(hand);
        } else {
          log('No hands found in database');
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to load latest hand:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
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
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(handId);

      request.onsuccess = (event) => {
        const hand = event.target.result;

        if (hand) {
          log(`Loaded hand ID ${handId}`);
          resolve(hand);
        } else {
          log(`Hand ID ${handId} not found`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError(`Failed to load hand ${handId}:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in loadHandById:', error);
    return null;
  }
};

/**
 * Load all hands from the database
 * @returns {Promise<Array>} Array of all hand records
 */
export const getAllHands = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const hands = event.target.result;
        log(`Loaded ${hands.length} hands from database`);
        resolve(hands);
      };

      request.onerror = (event) => {
        logError('Failed to load all hands:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getAllHands:', error);
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
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(handId);

      request.onsuccess = () => {
        log(`Hand ${handId} deleted successfully`);
        resolve();
      };

      request.onerror = (event) => {
        logError(`Failed to delete hand ${handId}:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in deleteHand:', error);
    throw error;
  }
};

/**
 * Clear all hands from the database
 * @returns {Promise<void>}
 */
export const clearAllHands = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        log('All hands cleared from database');
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to clear hands:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in clearAllHands:', error);
    throw error;
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the count of hands in the database
 * @returns {Promise<number>} Number of hands
 */
export const getHandCount = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.count();

      request.onsuccess = (event) => {
        const count = event.target.result;
        log(`Hand count: ${count}`);
        resolve(count);
      };

      request.onerror = (event) => {
        logError('Failed to get hand count:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
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

// =============================================================================
// PLAYER CRUD OPERATIONS
// =============================================================================

/**
 * Create a new player
 * @param {Object} playerData - Player data (name, nickname, ethnicity, etc.)
 * @returns {Promise<number>} The auto-generated playerId
 */
export const createPlayer = async (playerData) => {
  try {
    const db = await initDB();

    // Add metadata
    const playerRecord = {
      ...playerData,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      handCount: 0,
      stats: null
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);
      const request = objectStore.add(playerRecord);

      request.onsuccess = (event) => {
        const playerId = event.target.result;
        log(`Player created successfully (ID: ${playerId})`);
        resolve(playerId);
      };

      request.onerror = (event) => {
        logError('Failed to create player:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in createPlayer:', error);
    throw error;
  }
};

/**
 * Get all players from the database
 * @returns {Promise<Array>} Array of all player records
 */
export const getAllPlayers = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const players = event.target.result;
        log(`Loaded ${players.length} players from database`);
        resolve(players);
      };

      request.onerror = (event) => {
        logError('Failed to load all players:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getAllPlayers:', error);
    return [];
  }
};

/**
 * Get a specific player by ID
 * @param {number} playerId - The player ID to load
 * @returns {Promise<Object|null>} Player data or null if not found
 */
export const getPlayerById = async (playerId) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);
      const request = objectStore.get(playerId);

      request.onsuccess = (event) => {
        const player = event.target.result;

        if (player) {
          log(`Loaded player ID ${playerId}`);
          resolve(player);
        } else {
          log(`Player ID ${playerId} not found`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError(`Failed to load player ${playerId}:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getPlayerById:', error);
    return null;
  }
};

/**
 * Update a player's fields
 * @param {number} playerId - The player ID to update
 * @param {Object} updates - Fields to update (name, nickname, ethnicity, etc.)
 * @returns {Promise<void>}
 */
export const updatePlayer = async (playerId, updates) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);
      const getRequest = objectStore.get(playerId);

      getRequest.onsuccess = (event) => {
        const player = event.target.result;

        if (!player) {
          logError(`Player ${playerId} not found`);
          reject(new Error(`Player ${playerId} not found`));
          return;
        }

        // Update fields
        Object.keys(updates).forEach(key => {
          player[key] = updates[key];
        });

        const updateRequest = objectStore.put(player);

        updateRequest.onsuccess = () => {
          log(`Player ${playerId} updated successfully`);
          resolve();
        };

        updateRequest.onerror = (event) => {
          logError(`Failed to update player ${playerId}:`, event.target.error);
          reject(event.target.error);
        };
      };

      getRequest.onerror = (event) => {
        logError(`Failed to get player ${playerId}:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in updatePlayer:', error);
    throw error;
  }
};

/**
 * Delete a specific player by ID
 * @param {number} playerId - The player ID to delete
 * @returns {Promise<void>}
 */
export const deletePlayer = async (playerId) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);
      const request = objectStore.delete(playerId);

      request.onsuccess = () => {
        log(`Player ${playerId} deleted successfully`);
        resolve();
      };

      request.onerror = (event) => {
        logError(`Failed to delete player ${playerId}:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in deletePlayer:', error);
    throw error;
  }
};

/**
 * Get a player by name (case-insensitive)
 * @param {string} name - The player name to search for
 * @returns {Promise<Object|null>} Player data or null if not found
 */
export const getPlayerByName = async (name) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);
      const index = objectStore.index('name');
      const request = index.get(name);

      request.onsuccess = (event) => {
        const player = event.target.result;

        if (player) {
          log(`Found player with name "${name}"`);
          resolve(player);
        } else {
          log(`Player with name "${name}" not found`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError(`Failed to search for player "${name}":`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getPlayerByName:', error);
    return null;
  }
};
