/**
 * playersStorage.js - Player CRUD operations
 *
 * Provides database operations for player management.
 * Part of the persistence layer, extracted from persistence.js.
 */

import {
  getDB,
  readTx,
  writeTx,
  updateTx,
  PLAYERS_STORE_NAME,
  SIGHTING_LOGS_STORE_NAME,
  PLAYER_PHOTOS_STORE_NAME,
  PLAYER_DRAFTS_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

import {
  validatePlayerRecord,
  logValidationErrors,
} from './validation';

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
    // Check for duplicate name at DB level for this user
    if (playerData.name) {
      const existingPlayer = await getPlayerByNameInternal(playerData.name, userId);
      if (existingPlayer) {
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

    // Validate player record before saving
    const validation = validatePlayerRecord(playerRecord);
    if (!validation.valid) {
      logValidationErrors('createPlayer', validation.errors);
      throw new Error(`Invalid player data: ${validation.errors.join(', ')}`);
    }

    const playerId = await writeTx(PLAYERS_STORE_NAME, (store) => store.add(playerRecord));
    log(`Player created successfully (ID: ${playerId})`);
    return playerId;
  } catch (error) {
    logError('Error in createPlayer:', error);
    throw error;
  }
};

/**
 * Internal helper to check player by name via the userId_name compound index
 * @param {string} name - Player name to search
 * @param {string} userId - User ID to filter by
 * @returns {Promise<Object|null>} Player or null
 */
const getPlayerByNameInternal = async (name, userId) => {
  const player = await readTx(PLAYERS_STORE_NAME, (store) => store.index('userId_name').get([userId, name]));
  return player ?? null;
};

/**
 * Get all players from the database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Array>} Array of player records
 */
export const getAllPlayers = async (userId = GUEST_USER_ID) => {
  try {
    // Use userId index to filter players
    const players = await readTx(PLAYERS_STORE_NAME, (store) => store.index('userId').getAll(userId));
    log(`Loaded ${players.length} players for user ${userId}`);
    return players;
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
    const player = await readTx(PLAYERS_STORE_NAME, (store) => store.get(playerId));
    log(player ? `Loaded player ID ${playerId}` : `Player ID ${playerId} not found`);
    return player ?? null;
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
    // Check for duplicate name at DB level only when name is actually changing.
    // Without the change-check, pre-existing duplicates in the DB would block
    // edits to other fields — and `index.get([userId, name])` returns a single
    // record (lowest key first), so editing the higher-id duplicate would
    // mis-detect the lower-id record as "another player with this name."
    if (updates.name) {
      const currentRecord = await readTx(PLAYERS_STORE_NAME, (store) => store.get(playerId));
      const currentName = (currentRecord?.name ?? '').toString().trim().toLowerCase();
      const newName = updates.name.toString().trim().toLowerCase();
      if (currentName !== newName) {
        const existingPlayer = await getPlayerByNameInternal(updates.name, userId);
        if (existingPlayer && existingPlayer.playerId !== playerId) {
          throw new Error(`Player with name "${updates.name}" already exists`);
        }
      }
    }

    await updateTx(PLAYERS_STORE_NAME, playerId, (player) => {
      if (!player) throw new Error(`Player ${playerId} not found`);
      // Update fields
      Object.keys(updates).forEach(key => {
        player[key] = updates[key];
      });
      return player;
    });
    log(`Player ${playerId} updated successfully`);
  } catch (error) {
    logError('Error in updatePlayer:', error);
    throw error;
  }
};

/**
 * Delete a specific player by ID, cascading to sightings + photos + draft.
 *
 * Cascade fix 2026-05-06 (unified PlayerFinder migration): the previous
 * implementation only removed the player record, leaving orphaned
 * sighting logs and photo blobs. IndexedDB has no FK enforcement, so the
 * cascade has to be explicit here. All four deletes happen in a SINGLE
 * read-write transaction so a partial failure can't leave dangling
 * orphans.
 *
 * @param {number} playerId - The player ID to delete
 * @param {string} [userId] - The user ID (for draft cleanup; defaults to GUEST_USER_ID)
 * @returns {Promise<{playerDeleted: boolean, sightingsDeleted: number, photosDeleted: number, draftDeleted: boolean}>}
 */
// WS-226 exception: multi-store parallel cursor cascade (2 simultaneous index
// walks + 2 direct deletes in one tx). The helper shapes don't model parallel
// cursors cleanly; heavily-tested cascade logic retained hand-rolled.
export const deletePlayer = async (playerId, userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const stores = [
        PLAYERS_STORE_NAME,
        SIGHTING_LOGS_STORE_NAME,
        PLAYER_PHOTOS_STORE_NAME,
        PLAYER_DRAFTS_STORE_NAME,
      ];
      const tx = db.transaction(stores, 'readwrite');

      let sightingsDeleted = 0;
      let photosDeleted = 0;
      let playerDeleted = false;
      let draftDeleted = false;

      tx.oncomplete = () => {
        log(`Player ${playerId} cascade-deleted: sightings=${sightingsDeleted} photos=${photosDeleted} draft=${draftDeleted}`);
        resolve({ playerDeleted, sightingsDeleted, photosDeleted, draftDeleted });
      };
      tx.onerror = () => {
        logError(`Cascade delete failed for player ${playerId}:`, tx.error);
        reject(tx.error || new Error('Cascade delete tx error'));
      };
      tx.onabort = () => reject(tx.error || new Error('Cascade delete aborted'));

      // 1. Delete the player record itself.
      const playerStore = tx.objectStore(PLAYERS_STORE_NAME);
      const playerReq = playerStore.delete(playerId);
      playerReq.onsuccess = () => { playerDeleted = true; };

      // 2-3. Cursor over sightings + photos indexed by playerId, deleting
      // each match. Type-tolerant comparison: `playerId` is the integer
      // autoincrement key on the players store, but related stores may
      // have it persisted as a string (savePhoto / appendSighting accept
      // either type). Walking the full index and comparing via String()
      // avoids the type-mismatch issue an IDBKeyRange.only would have.
      const targetKey = String(playerId);

      const sightingStore = tx.objectStore(SIGHTING_LOGS_STORE_NAME);
      const sightingIdx = sightingStore.index('by_playerId');
      const sightingCursorReq = sightingIdx.openCursor();
      sightingCursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (String(cursor.value.playerId) === targetKey) {
            cursor.delete();
            sightingsDeleted += 1;
          }
          cursor.continue();
        }
      };

      const photoStore = tx.objectStore(PLAYER_PHOTOS_STORE_NAME);
      const photoIdx = photoStore.index('by_playerId');
      const photoCursorReq = photoIdx.openCursor();
      photoCursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (String(cursor.value.playerId) === targetKey) {
            cursor.delete();
            photosDeleted += 1;
          }
          cursor.continue();
        }
      };

      // 4. Delete the in-progress draft for this user if one exists.
      // Drafts are keyed by userId, not playerId — there's at most one
      // per user. We delete unconditionally; absence is not an error.
      const draftStore = tx.objectStore(PLAYER_DRAFTS_STORE_NAME);
      const draftReq = draftStore.delete(userId);
      draftReq.onsuccess = () => { draftDeleted = true; };
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
    // Use the userId_name compound index
    const player = await readTx(PLAYERS_STORE_NAME, (store) => store.index('userId_name').get([userId, name]));
    log(player
      ? `Found player "${name}" for user ${userId}`
      : `Player "${name}" not found for user ${userId}`);
    return player ?? null;
  } catch (error) {
    logError('Error in getPlayerByName:', error);
    return null;
  }
};
