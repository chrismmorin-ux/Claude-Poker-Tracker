/**
 * handsStorage.js - Hand CRUD operations
 *
 * Provides database operations for hand history management.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  getDB,
  STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

import {
  getActiveSession,
  getSessionHandCount,
} from './sessionsStorage';

import {
  validateHandRecord,
  logValidationErrors,
} from './validation';

// =============================================================================
// HAND CRUD OPERATIONS
// =============================================================================

/**
 * Save a hand to the database
 * Auto-links hand to active session if one exists
 * Calculates sessionHandNumber for display (1-based index within session)
 * @param {Object} handData - Hand data containing gameState, cardState, and optional seatPlayers
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveHand = async (handData, userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    // Get active session to auto-link hand (for this user)
    const activeSession = await getActiveSession(userId);
    const sessionId = activeSession?.sessionId || null;

    const timestamp = Date.now();

    // RT-39: Atomic count + add in single readwrite transaction to prevent TOCTOU race
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);

      // Step 1: Count existing hands in this session (within same transaction)
      const resolveCount = (count) => {
        const sessionHandNumber = sessionId ? count + 1 : null;
        const handDisplayId = sessionId
          ? `S${sessionId}-H${sessionHandNumber}`
          : `H${timestamp}`;

        const handRecord = {
          ...handData,
          timestamp,
          version: '1.3.0',
          userId,
          sessionId,
          sessionHandNumber,
          handDisplayId,
        };

        const validation = validateHandRecord(handRecord);
        if (!validation.valid) {
          logValidationErrors('saveHand', validation.errors);
          reject(new Error(`Invalid hand data: ${validation.errors.join(', ')}`));
          return;
        }

        // Step 2: Add hand in same transaction
        const addRequest = objectStore.add(handRecord);
        addRequest.onsuccess = (event) => {
          const handId = event.target.result;
          log(`Hand saved successfully (ID: ${handId}, displayId: ${handDisplayId})`);
          resolve(handId);
        };
        addRequest.onerror = (event) => {
          logError('Failed to save hand:', event.target.error);
          if (event.target.error?.name === 'QuotaExceededError') {
            logError('Storage quota exceeded. Please clear old hands.');
          }
          reject(event.target.error);
        };
      };

      if (sessionId) {
        const index = objectStore.index('sessionId');
        const countRequest = index.count(sessionId);
        countRequest.onsuccess = (event) => resolveCount(event.target.result);
        countRequest.onerror = (event) => {
          logError('Failed to count session hands:', event.target.error);
          reject(event.target.error);
        };
      } else {
        resolveCount(0);
      }
    });
  } catch (error) {
    logError('Error in saveHand:', error);
    throw error;
  }
};

/**
 * Load the most recent hand from the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Object|null>} Hand data or null if no hands exist
 */
export const loadLatestHand = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);

      // Use userId_timestamp compound index for efficient user-filtered query
      const index = objectStore.index('userId_timestamp');

      // Create key range for this user's records, open cursor in descending order
      const keyRange = IDBKeyRange.bound([userId, 0], [userId, Date.now()]);
      const request = index.openCursor(keyRange, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          const hand = cursor.value;
          log(`Loaded latest hand for user ${userId} (ID: ${hand.handId})`);
          resolve(hand);
        } else {
          log(`No hands found for user ${userId}`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to load latest hand:', event.target.error);
        reject(event.target.error);
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
    const db = await getDB();

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

    });
  } catch (error) {
    logError('Error in loadHandById:', error);
    return null;
  }
};

/**
 * Load all hands from the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Array>} Array of hand records
 */
export const getAllHands = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);

      // Use userId index to filter hands
      const index = objectStore.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = (event) => {
        const hands = event.target.result;
        log(`Loaded ${hands.length} hands for user ${userId}`);
        resolve(hands);
      };

      request.onerror = (event) => {
        logError('Failed to load hands:', event.target.error);
        reject(event.target.error);
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
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = (event) => {
        const hands = event.target.result;
        log(`Loaded ${hands.length} hands for session ${sessionId}`);
        resolve(hands);
      };

      request.onerror = (event) => {
        logError(`Failed to load hands for session ${sessionId}:`, event.target.error);
        reject(event.target.error);
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
    const db = await getDB();

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

    });
  } catch (error) {
    logError('Error in deleteHand:', error);
    throw error;
  }
};

// =============================================================================
// SEAT-PLAYER UPDATE OPERATIONS (PEO-1 retroactive linking)
// =============================================================================

/**
 * Update seat→player mapping on a single hand.
 * Used by retroactive linking when a player is assigned to a seat whose prior
 * hands this session were recorded anonymously.
 *
 * Setting playerId to null clears the seat assignment.
 *
 * @param {number} handId
 * @param {number} seat
 * @param {number | null} playerId
 * @returns {Promise<void>}
 */
export const updateSeatPlayerForHand = async (handId, seat, playerId) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(handId);

    getReq.onsuccess = (event) => {
      const hand = event.target.result;
      if (!hand) {
        reject(new Error(`Hand ${handId} not found`));
        return;
      }
      const nextSeatPlayers = { ...(hand.seatPlayers || {}) };
      if (playerId === null || playerId === undefined) {
        delete nextSeatPlayers[seat];
      } else {
        nextSeatPlayers[seat] = playerId;
      }
      hand.seatPlayers = nextSeatPlayers;
      const putReq = store.put(hand);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onabort = () => reject(tx.error || new Error('updateSeatPlayerForHand aborted'));
  });
};

/**
 * Batch update seat→player mappings across multiple hands in ONE transaction.
 * Required for retroactive linking to preserve atomicity — either all updates
 * apply or none do. See invariant I-PEO-1.
 *
 * @param {Array<{handId: number, seat: number, playerId: number | null}>} updates
 * @returns {Promise<void>}
 */
export const batchUpdateSeatPlayers = async (updates) => {
  if (!Array.isArray(updates)) {
    throw new Error('batchUpdateSeatPlayers: updates must be an array');
  }
  if (updates.length === 0) return;

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let remaining = updates.length;
    let aborted = false;

    const failTx = (err) => {
      if (aborted) return;
      aborted = true;
      tx.abort();
      reject(err);
    };

    for (const { handId, seat, playerId } of updates) {
      const getReq = store.get(handId);
      getReq.onsuccess = (event) => {
        if (aborted) return;
        const hand = event.target.result;
        if (!hand) {
          failTx(new Error(`Hand ${handId} not found`));
          return;
        }
        const nextSeatPlayers = { ...(hand.seatPlayers || {}) };
        if (playerId === null || playerId === undefined) {
          delete nextSeatPlayers[seat];
        } else {
          nextSeatPlayers[seat] = playerId;
        }
        hand.seatPlayers = nextSeatPlayers;
        const putReq = store.put(hand);
        putReq.onsuccess = () => {
          remaining -= 1;
          // All puts scheduled; tx.oncomplete will fire next.
        };
        putReq.onerror = () => failTx(putReq.error);
      };
      getReq.onerror = () => failTx(getReq.error);
    }

    tx.oncomplete = () => {
      if (!aborted) {
        log(`batchUpdateSeatPlayers: ${updates.length} hands updated`);
        resolve();
      }
    };
    tx.onabort = () => {
      if (!aborted) reject(tx.error || new Error('batchUpdateSeatPlayers aborted'));
    };
    tx.onerror = () => failTx(tx.error || new Error('batchUpdateSeatPlayers errored'));
  });
};

// =============================================================================

/**
 * Clear all hands for a specific user from the database
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
export const clearAllHands = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('userId');

      // Get all hands for this user and delete them
      const getRequest = index.getAllKeys(userId);

      getRequest.onsuccess = (event) => {
        const keys = event.target.result;
        let deleted = 0;

        if (keys.length === 0) {
          log(`No hands to clear for user ${userId}`);
          resolve();
          return;
        }

        keys.forEach((key) => {
          const deleteRequest = objectStore.delete(key);
          deleteRequest.onsuccess = () => {
            deleted++;
            if (deleted === keys.length) {
              log(`Cleared ${deleted} hands for user ${userId}`);
              resolve();
            }
          };
          deleteRequest.onerror = (e) => {
            logError('Failed to delete hand:', e.target.error);
          };
        });
      };

      getRequest.onerror = (event) => {
        logError('Failed to get hands for clearing:', event.target.error);
        reject(event.target.error);
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
 * Get the count of hands in the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} Number of hands
 */
export const getHandCount = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('userId');
      const request = index.count(userId);

      request.onsuccess = (event) => {
        const count = event.target.result;
        log(`Hand count for user ${userId}: ${count}`);
        resolve(count);
      };

      request.onerror = (event) => {
        logError('Failed to get hand count:', event.target.error);
        reject(event.target.error);
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
// ONLINE HAND OPERATIONS (for Ignition integration)
// =============================================================================

/**
 * Save a hand from online play (Ignition extension).
 * Unlike saveHand(), does NOT auto-link to active session — uses provided sessionId.
 * Adds source: 'ignition' and generates display IDs.
 *
 * @param {Object} handData - Hand record from extension (gameState, cardState, seatPlayers)
 * @param {number} sessionId - Online session ID (from getOrCreateOnlineSession)
 * @param {string} userId - User ID
 * @returns {Promise<number>} The auto-generated handId
 */
export const saveOnlineHand = async (handData, sessionId, userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    // Calculate sessionHandNumber
    let sessionHandNumber = null;
    if (sessionId) {
      const existingCount = await getSessionHandCount(sessionId);
      sessionHandNumber = existingCount + 1;
    }

    const timestamp = handData.timestamp || Date.now();
    const handDisplayId = sessionId
      ? `S${sessionId}-H${sessionHandNumber}`
      : `H${timestamp}`;

    const handRecord = {
      ...handData,
      timestamp,
      version: '1.3.0',
      userId,
      sessionId,
      sessionHandNumber,
      handDisplayId,
      source: 'ignition',
    };

    // Keep captureId for dedup, strip extension-only capturedAt
    delete handRecord.capturedAt;

    const validation = validateHandRecord(handRecord);
    if (!validation.valid) {
      logValidationErrors('saveOnlineHand', validation.errors);
      throw new Error(`Invalid online hand: ${validation.errors.join(', ')}`);
    }

    // Dedup check: skip if hand with this captureId already exists
    if (handRecord.captureId) {
      const existingHands = await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const idx = store.index('sessionId');
        const req = idx.getAll(sessionId);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
        tx.oncomplete = () => {};
      });
      if (existingHands.some(h => h.captureId === handRecord.captureId)) {
        log(`Skipping duplicate online hand: ${handRecord.captureId}`);
        return -1; // Already exists
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(handRecord);

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        logError('Failed to save online hand:', event.target.error);
        reject(event.target.error);
      };

    });
  } catch (error) {
    logError('Error in saveOnlineHand:', error);
    throw error;
  }
};

/**
 * Get all hands for a specific source (e.g., 'ignition', 'live')
 * Uses the source index added in v12 migration.
 *
 * @param {string} source - Data source ('live' | 'ignition')
 * @param {string} userId - User ID
 * @returns {Promise<Object[]>} Array of hand records
 */
export const getHandsBySource = async (source, userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);

      // Use userId index and filter by source in memory
      // (compound index userId_source would be ideal but source index is new)
      const index = objectStore.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = (event) => {
        const hands = event.target.result.filter(h => h.source === source);
        log(`Loaded ${hands.length} ${source} hands for user ${userId}`);
        resolve(hands);
      };

      request.onerror = (event) => {
        logError('Failed to load hands by source:', event.target.error);
        reject(event.target.error);
      };

    });
  } catch (error) {
    logError('Error in getHandsBySource:', error);
    return [];
  }
};
