/**
 * settingsStorage.js - Settings CRUD operations
 *
 * Provides database operations for app settings persistence.
 * Uses per-user keying (id: `settings_${userId}`) for multi-user support.
 * Part of the persistence layer.
 */

import {
  readTx,
  writeTx,
  updateTx,
  SETTINGS_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';
import { DEFAULT_SETTINGS } from '../../constants/settingsConstants';

/**
 * Get the settings key for a user
 * @param {string} userId - User ID (or 'guest')
 * @returns {string} Settings key
 */
const getSettingsKey = (userId) => `settings_${userId || GUEST_USER_ID}`;

// =============================================================================
// SETTINGS CRUD OPERATIONS
// =============================================================================

/**
 * Get settings from database for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Object|null>} Settings object or null if not found
 */
export const getSettings = async (userId = GUEST_USER_ID) => {
  try {
    const settings = await readTx(SETTINGS_STORE_NAME, (store) => store.get(getSettingsKey(userId)));
    if (!settings) {
      log(`No settings found for user ${userId}, will use defaults`);
      return null;
    }
    log(`Settings loaded for user ${userId}`);
    // Return settings without the id and userId fields
    const { id, userId: _, ...settingsData } = settings;
    return settingsData;
  } catch (error) {
    logError('Error in getSettings:', error);
    throw error;
  }
};

/**
 * Save settings to database (full replacement)
 * @param {Object} settings - Full settings object to save
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
export const saveSettings = async (settings, userId = GUEST_USER_ID) => {
  try {
    // Create record with userId-based key
    const settingsRecord = {
      id: getSettingsKey(userId),
      userId,
      ...settings,
      updatedAt: Date.now(),
    };
    await writeTx(SETTINGS_STORE_NAME, (store) => store.put(settingsRecord)); // put creates or updates
    log(`Settings saved for user ${userId}`);
  } catch (error) {
    logError('Error in saveSettings:', error);
    throw error;
  }
};

/**
 * Update specific settings fields (merge with existing)
 * @param {Object} updates - Partial settings to update
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<Object>} Updated settings object
 */
export const updateSettings = async (updates, userId = GUEST_USER_ID) => {
  try {
    const settingsKey = getSettingsKey(userId);
    const updated = await updateTx(SETTINGS_STORE_NAME, settingsKey, (existing) => ({
      // Get existing settings or use defaults with userId-based key
      ...(existing || { id: settingsKey, userId, ...DEFAULT_SETTINGS }),
      ...updates,
      updatedAt: Date.now(),
    }));
    log(`Settings updated for user ${userId}`);
    const { id, userId: _, ...settingsData } = updated;
    return settingsData;
  } catch (error) {
    logError('Error in updateSettings:', error);
    throw error;
  }
};

/**
 * Reset settings to defaults for a specific user
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
export const resetSettings = async (userId = GUEST_USER_ID) => {
  try {
    await saveSettings({ ...DEFAULT_SETTINGS }, userId);
    log(`Settings reset to defaults for user ${userId}`);
  } catch (error) {
    logError('Error in resetSettings:', error);
    throw error;
  }
};

/**
 * Clear settings for a specific user (delete the record)
 * @param {string} userId - User ID (defaults to 'guest')
 * @returns {Promise<void>}
 */
export const clearSettings = async (userId = GUEST_USER_ID) => {
  try {
    await writeTx(SETTINGS_STORE_NAME, (store) => store.delete(getSettingsKey(userId)));
    log(`Settings cleared for user ${userId}`);
  } catch (error) {
    logError('Error in clearSettings:', error);
    throw error;
  }
};
