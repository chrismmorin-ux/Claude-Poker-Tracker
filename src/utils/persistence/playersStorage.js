/**
 * playersStorage.js - Player CRUD operations
 *
 * Provides database operations for player management.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  initDB,
  PLAYERS_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

// =============================================================================
// PLAYER CRUD OPERATIONS
// =============================================================================

/**
 * Create a new player
 * @param {Object} playerData - Player data (name, nickname, ethnicity, etc.)
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<number>} The auto-generated playerId
 * @throws {Error} If player with same name already exists for this user
 */
export const createPlayer = async (playerData, userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();

    // Check for duplicate name at DB level for this user
    if (playerData.name) {
      const existingPlayer = await getPlayerByNameInternal(db, playerData.name, userId);
      if (existingPlayer) {
        db.close();
        throw new Error(`Player with name "${playerData.name}" already exists`);
      }
    }

    // Add metadata including userId
    const playerRecord = {
      ...playerData,
      userId,
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
 * Internal helper to check player by name using existing db connection
 * @param {IDBDatabase} db - Open database connection
 * @param {string} name - Player name to search
 * @param {string} userId - User ID to filter by
 * @returns {Promise<Object|null>} Player or null
 */
const getPlayerByNameInternal = (db, name, userId) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYERS_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);

    // Use the userId_name compound index
    const index = objectStore.index('userId_name');
    const request = index.get([userId, name]);

    request.onsuccess = (event) => {
      resolve(event.target.result || null);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * Get all players from the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Array>} Array of player records
 */
export const getAllPlayers = async (userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);

      // Use userId index to filter players
      const index = objectStore.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = (event) => {
        const players = event.target.result;
        log(`Loaded ${players.length} players for user ${userId}`);
        resolve(players);
      };

      request.onerror = (event) => {
        logError('Failed to load players:', event.target.error);
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
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 * @throws {Error} If updating name to one that already exists for this user
 */
export const updatePlayer = async (playerId, updates, userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();

    // Check for duplicate name at DB level if name is being updated
    if (updates.name) {
      const existingPlayer = await getPlayerByNameInternal(db, updates.name, userId);
      if (existingPlayer && existingPlayer.playerId !== playerId) {
        db.close();
        throw new Error(`Player with name "${updates.name}" already exists`);
      }
    }

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
 * Get a player by name for a specific user
 * @param {string} name - The player name to search for
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Object|null>} Player data or null if not found
 */
export const getPlayerByName = async (name, userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYERS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PLAYERS_STORE_NAME);

      // Use the userId_name compound index
      const index = objectStore.index('userId_name');
      const request = index.get([userId, name]);

      request.onsuccess = (event) => {
        const player = event.target.result;

        if (player) {
          log(`Found player "${name}" for user ${userId}`);
          resolve(player);
        } else {
          log(`Player "${name}" not found for user ${userId}`);
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
