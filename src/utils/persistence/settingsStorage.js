/**
 * settingsStorage.js - Settings CRUD operations
 *
 * Provides database operations for app settings persistence.
 * Uses a singleton pattern (single record with id: 1) since
 * there's only one settings object per app instance.
 * Part of the persistence layer.
 */

import {
  initDB,
  SETTINGS_STORE_NAME,
  log,
  logError,
} from './database';
import { DEFAULT_SETTINGS } from '../../constants/settingsConstants';

// =============================================================================
// SETTINGS CRUD OPERATIONS
// =============================================================================

/**
 * Get settings from database
 * @returns {Promise<Object|null>} Settings object or null if not found
 */
export const getSettings = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.get(1); // Singleton record with id: 1

      request.onsuccess = () => {
        const settings = request.result;
        if (settings) {
          log('Settings loaded successfully');
          // Return settings without the id field
          const { id, ...settingsData } = settings;
          resolve(settingsData);
        } else {
          log('No settings found, will use defaults');
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
 * @returns {Promise<void>}
 */
export const saveSettings = async (settings) => {
  try {
    const db = await initDB();

    // Create record with id: 1 for singleton pattern
    const settingsRecord = {
      id: 1,
      ...settings,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.put(settingsRecord); // put creates or updates

      request.onsuccess = () => {
        log('Settings saved successfully');
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
 * @returns {Promise<Object>} Updated settings object
 */
export const updateSettings = async (updates) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const getRequest = objectStore.get(1);

      getRequest.onsuccess = () => {
        // Get existing settings or use defaults
        const existing = getRequest.result || { id: 1, ...DEFAULT_SETTINGS };

        // Merge updates
        const updated = {
          ...existing,
          ...updates,
          updatedAt: Date.now(),
        };

        const putRequest = objectStore.put(updated);

        putRequest.onsuccess = () => {
          log('Settings updated successfully');
          const { id, ...settingsData } = updated;
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
 * Reset settings to defaults
 * @returns {Promise<void>}
 */
export const resetSettings = async () => {
  try {
    await saveSettings({ ...DEFAULT_SETTINGS });
    log('Settings reset to defaults');
  } catch (error) {
    logError('Error in resetSettings:', error);
    throw error;
  }
};

/**
 * Clear all settings (delete the record)
 * @returns {Promise<void>}
 */
export const clearSettings = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.delete(1);

      request.onsuccess = () => {
        log('Settings cleared');
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
