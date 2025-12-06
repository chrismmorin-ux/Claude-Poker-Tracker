/**
 * persistence.js - IndexedDB persistence layer
 *
 * Provides core database operations for hand history tracking.
 * All functions are async and handle errors gracefully (fail-safe).
 *
 * Database Schema:
 *   Database: "PokerTrackerDB" v1
 *   Object Store: "hands" (keyPath: "handId", autoIncrement: true)
 *   Indexes: timestamp, sessionId
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const DB_NAME = 'PokerTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'hands';
const DEBUG = true; // Set to false to disable console logging

// =============================================================================
// LOGGING
// =============================================================================

const log = (...args) => DEBUG && console.log('[Persistence]', ...args);
const logError = (...args) => console.error('[Persistence]', ...args);

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

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'handId',
          autoIncrement: true
        });

        // Create indexes for efficient queries
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('sessionId', 'sessionId', { unique: false });

        log('Object store and indexes created');
      }
    };
  });
};

// =============================================================================
// HAND CRUD OPERATIONS
// =============================================================================

/**
 * Save a hand to the database
 * @param {Object} handData - Hand data containing gameState and cardState
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveHand = async (handData) => {
  try {
    const db = await initDB();

    // Add metadata
    const handRecord = {
      ...handData,
      timestamp: Date.now(),
      version: '1.0.8', // TODO: Get from package.json
      sessionId: null,  // Future: session tracking
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
