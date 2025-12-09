/**
 * handsStorage.js - Hand CRUD operations
 *
 * Provides database operations for hand history management.
 * Part of the persistence layer, extracted from persistence.js.
 */

import { normalizeHandRecord } from '../../migrations/normalizeSeatActions';

import {
  initDB,
  STORE_NAME,
  log,
  logError,
} from './database';

import {
  getActiveSession,
  getSessionHandCount,
} from './sessionsStorage';

// =============================================================================
// HAND CRUD OPERATIONS
// =============================================================================

/**
 * Save a hand to the database
 * Auto-links hand to active session if one exists
 * Calculates sessionHandNumber for display (1-based index within session)
 * @param {Object} handData - Hand data containing gameState, cardState, and optional seatPlayers
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveHand = async (handData) => {
  try {
    const db = await initDB();

    // Get active session to auto-link hand
    const activeSession = await getActiveSession();
    const sessionId = activeSession?.sessionId || null;

    // Calculate sessionHandNumber (1-based position within session)
    let sessionHandNumber = null;
    if (sessionId) {
      const existingCount = await getSessionHandCount(sessionId);
      sessionHandNumber = existingCount + 1;
    }

    // Generate handDisplayId for searching
    // Format: "S{sessionId}-H{sessionHandNumber}" or "H{timestamp}" if no session
    const timestamp = Date.now();
    const handDisplayId = sessionId
      ? `S${sessionId}-H${sessionHandNumber}`
      : `H${timestamp}`;

    // Add metadata
    const handRecord = {
      ...handData,
      timestamp,
      version: '1.2.0', // Added sessionHandNumber and handDisplayId
      sessionId,
      sessionHandNumber,  // 1-based index within session (null if no session)
      handDisplayId,      // Searchable identifier
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(handRecord);

      request.onsuccess = (event) => {
        const handId = event.target.result;
        log(`Hand saved successfully (ID: ${handId}, displayId: ${handDisplayId})`);
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
          // Normalize seatActions to array format (migration for old data)
          resolve(normalizeHandRecord(hand));
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
        // Normalize seatActions to array format (migration for old data)
        resolve(hands.map(normalizeHandRecord));
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
 * Get all hands for a specific session
 * @param {number} sessionId - The session ID to filter by
 * @returns {Promise<Array>} Array of hand records for this session
 */
export const getHandsBySessionId = async (sessionId) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = (event) => {
        const hands = event.target.result;
        log(`Loaded ${hands.length} hands for session ${sessionId}`);
        resolve(hands.map(normalizeHandRecord));
      };

      request.onerror = (event) => {
        logError(`Failed to load hands for session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getHandsBySessionId:', error);
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
