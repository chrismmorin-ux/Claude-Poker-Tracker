/**
 * rangeProfilesStorage.js - Range profile CRUD operations
 *
 * Stores Bayesian range profiles in IndexedDB.
 * Follows playersStorage.js patterns.
 */

import {
  readTx,
  writeTx,
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
    const serialized = serializeProfile(profile);
    await writeTx(RANGE_PROFILES_STORE_NAME, (store) => store.put(serialized));
    log(`Range profile saved for player ${profile.playerId}`);
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
    const profileKey = `${userId}_${playerId}`;
    const record = await readTx(RANGE_PROFILES_STORE_NAME, (store) => store.get(profileKey));
    return record ? deserializeProfile(record) : null;
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
    const profileKey = `${userId}_${playerId}`;
    await writeTx(RANGE_PROFILES_STORE_NAME, (store) => store.delete(profileKey));
    log(`Range profile deleted for player ${playerId}`);
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
    const records = await readTx(RANGE_PROFILES_STORE_NAME, (store) => store.index('userId').getAll(userId));
    return records.map(deserializeProfile);
  } catch (error) {
    logError('Error in getAllRangeProfiles:', error);
    return [];
  }
};
