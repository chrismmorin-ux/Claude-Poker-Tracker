/**
 * useSettingsPersistence.js - React hook for settings persistence
 *
 * Integrates IndexedDB settings persistence with React state management.
 * Handles:
 * - Database initialization on mount
 * - Auto-restore settings on startup
 * - Immediate auto-save on settings changes (no debounce - settings change infrequently)
 * - Settings reset to defaults
 *
 * Simpler than session persistence since:
 * - Settings is a singleton (not a collection)
 * - Changes are infrequent (no debounce needed)
 * - No complex lifecycle (no start/end like sessions)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getSettings,
  saveSettings,
  resetSettings as dbResetSettings,
  GUEST_USER_ID,
} from '../utils/persistence';
import { SETTINGS_ACTIONS, DEFAULT_SETTINGS } from '../constants/settingsConstants';
import { logger } from '../utils/errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODULE_NAME = 'useSettingsPersistence';

// Backward-compatible logging wrappers
const log = (...args) => logger.debug(MODULE_NAME, ...args);
const logError = (error) => logger.error(MODULE_NAME, error);

// =============================================================================
// SETTINGS PERSISTENCE HOOK
// =============================================================================

/**
 * useSettingsPersistence - React hook for settings persistence
 *
 * @param {Object} settingsState - Settings state from settingsReducer
 * @param {Function} dispatchSettings - Settings state dispatcher
 * @param {string} userId - User ID for data isolation (defaults to 'guest')
 * @returns {Object} { isReady, resetToDefaults }
 */
export const useSettingsPersistence = (settingsState, dispatchSettings, userId = GUEST_USER_ID) => {
  // State
  const [isReady, setIsReady] = useState(false);

  // Refs
  const isInitializedRef = useRef(false);
  const previousSettingsRef = useRef(null);

  // ==========================================================================
  // INITIALIZATION (on mount)
  // ==========================================================================

  useEffect(() => {
    const initialize = async () => {
      log(`Initializing settings persistence for user ${userId}...`);

      try {
        // Load settings from database for this user
        const storedSettings = await getSettings(userId);

        // Hydrate settings state (merges with defaults)
        dispatchSettings({
          type: SETTINGS_ACTIONS.HYDRATE_SETTINGS,
          payload: { settings: storedSettings },
        });

        // Store initial settings for change detection
        previousSettingsRef.current = storedSettings
          ? { ...DEFAULT_SETTINGS, ...storedSettings }
          : { ...DEFAULT_SETTINGS };

        isInitializedRef.current = true;
        setIsReady(true);
        log('Settings persistence ready');
      } catch (error) {
        logError(error);
        // Continue with default settings
        dispatchSettings({
          type: SETTINGS_ACTIONS.HYDRATE_SETTINGS,
          payload: { settings: null },
        });
        previousSettingsRef.current = { ...DEFAULT_SETTINGS };
        isInitializedRef.current = true;
        setIsReady(true);
        log('Settings persistence ready (using defaults after error)');
      }
    };

    initialize();
  }, [dispatchSettings, userId]); // Re-initialize if userId changes

  // ==========================================================================
  // AUTO-SAVE (on settings change)
  // ==========================================================================

  useEffect(() => {
    // Don't save during initialization or if not ready
    if (!isReady || !isInitializedRef.current) {
      return;
    }

    // Check if settings actually changed (shallow comparison)
    const currentSettings = settingsState.settings;
    const previousSettings = previousSettingsRef.current;

    // Skip if no change
    if (
      previousSettings &&
      JSON.stringify(currentSettings) === JSON.stringify(previousSettings)
    ) {
      return;
    }

    // Save immediately (no debounce needed for settings)
    const save = async () => {
      try {
        log(`Auto-saving settings for user ${userId}...`);
        await saveSettings(currentSettings, userId);
        previousSettingsRef.current = { ...currentSettings };
        log('Settings saved');
      } catch (error) {
        logError(error);
        // Don't throw - settings save failure shouldn't break the app
      }
    };

    save();
  }, [settingsState.settings, isReady, userId]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  /**
   * Reset settings to defaults and persist
   */
  const resetToDefaults = useCallback(async () => {
    try {
      log(`Resetting settings to defaults for user ${userId}...`);

      // Reset in database for this user
      await dbResetSettings(userId);

      // Reset in state
      dispatchSettings({ type: SETTINGS_ACTIONS.RESET_SETTINGS });

      // Update previous settings ref
      previousSettingsRef.current = { ...DEFAULT_SETTINGS };

      log('Settings reset to defaults');
    } catch (error) {
      logError(error);
      throw error;
    }
  }, [dispatchSettings, userId]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isReady,
    resetToDefaults,
  };
};

export default useSettingsPersistence;
