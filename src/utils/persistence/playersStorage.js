/**
 * playersStorage.js - Player CRUD operations
 *
 * Provides database operations for player management.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  initDB,
  PLAYERS_STORE_NAME,
  log,
  logError,
} from './database';

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
