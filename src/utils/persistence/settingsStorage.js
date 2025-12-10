/**
 * settingsStorage.js - Settings CRUD operations
 *
 * Provides database operations for app settings persistence.
 * Uses per-user keying (id: `settings_${userId}`) for multi-user support.
 * Part of the persistence layer.
 */

import {
  initDB,
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
    const db = await initDB();
    const settingsKey = getSettingsKey(userId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.get(settingsKey);

      request.onsuccess = () => {
        const settings = request.result;
        if (settings) {
          log(`Settings loaded for user ${userId}`);
          // Return settings without the id and userId fields
          const { id, userId: _, ...settingsData } = settings;
          resolve(settingsData);
        } else {
          log(`No settings found for user ${userId}, will use defaults`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to get settings:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
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
    const db = await initDB();
    const settingsKey = getSettingsKey(userId);

    // Create record with userId-based key
    const settingsRecord = {
      id: settingsKey,
      userId,
      ...settings,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.put(settingsRecord); // put creates or updates

      request.onsuccess = () => {
        log(`Settings saved for user ${userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to save settings:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
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
    const db = await initDB();
    const settingsKey = getSettingsKey(userId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const getRequest = objectStore.get(settingsKey);

      getRequest.onsuccess = () => {
        // Get existing settings or use defaults with userId-based key
        const existing = getRequest.result || { id: settingsKey, userId, ...DEFAULT_SETTINGS };

        // Merge updates
        const updated = {
          ...existing,
          ...updates,
          updatedAt: Date.now(),
        };

        const putRequest = objectStore.put(updated);

        putRequest.onsuccess = () => {
          log(`Settings updated for user ${userId}`);
          const { id, userId: _, ...settingsData } = updated;
          resolve(settingsData);
        };

        putRequest.onerror = (event) => {
          logError('Failed to update settings:', event.target.error);
          reject(event.target.error);
        };
      };

      getRequest.onerror = (event) => {
        logError('Failed to get settings for update:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
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
    const db = await initDB();
    const settingsKey = getSettingsKey(userId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.delete(settingsKey);

      request.onsuccess = () => {
        log(`Settings cleared for user ${userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to clear settings:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    logError('Error in clearSettings:', error);
    throw error;
  }
};
