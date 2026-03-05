/**
 * rangeProfilesStorage.js - Range profile CRUD operations
 *
 * Stores Bayesian range profiles in IndexedDB.
 * Follows playersStorage.js patterns.
 */

import {
  initDB,
  RANGE_PROFILES_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

import { serializeProfile, deserializeProfile } from '../rangeEngine/rangeProfile';

/**
 * Save (upsert) a range profile.
 * @param {Object} profile - Range profile object
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const saveRangeProfile = async (profile, userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();
    const serialized = serializeProfile(profile);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RANGE_PROFILES_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(RANGE_PROFILES_STORE_NAME);
      const request = store.put(serialized);

      request.onsuccess = () => {
        log(`Range profile saved for player ${profile.playerId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to save range profile:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in saveRangeProfile:', error);
    throw error;
  }
};

/**
 * Get a range profile for a specific player.
 * @param {number|string} playerId
 * @param {string} userId
 * @returns {Promise<Object|null>} Deserialized profile or null
 */
export const getRangeProfile = async (playerId, userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();
    const profileKey = `${userId}_${playerId}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RANGE_PROFILES_STORE_NAME], 'readonly');
      const store = transaction.objectStore(RANGE_PROFILES_STORE_NAME);
      const request = store.get(profileKey);

      request.onsuccess = (event) => {
        const record = event.target.result;
        if (record) {
          resolve(deserializeProfile(record));
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to get range profile:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getRangeProfile:', error);
    return null;
  }
};

/**
 * Delete a range profile.
 * @param {number|string} playerId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const deleteRangeProfile = async (playerId, userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();
    const profileKey = `${userId}_${playerId}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RANGE_PROFILES_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(RANGE_PROFILES_STORE_NAME);
      const request = store.delete(profileKey);

      request.onsuccess = () => {
        log(`Range profile deleted for player ${playerId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to delete range profile:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in deleteRangeProfile:', error);
    throw error;
  }
};

/**
 * Get all range profiles for a user.
 * @param {string} userId
 * @returns {Promise<Object[]>} Array of deserialized profiles
 */
export const getAllRangeProfiles = async (userId = GUEST_USER_ID) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RANGE_PROFILES_STORE_NAME], 'readonly');
      const store = transaction.objectStore(RANGE_PROFILES_STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = (event) => {
        const records = event.target.result;
        resolve(records.map(deserializeProfile));
      };

      request.onerror = (event) => {
        logError('Failed to load range profiles:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in getAllRangeProfiles:', error);
    return [];
  }
};
