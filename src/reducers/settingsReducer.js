/**
 * settingsReducer.js - Settings state management
 *
 * Manages app settings state including theme, defaults, and customizations.
 * Follows the v108 reducer pattern used by gameReducer, uiReducer, sessionReducer, etc.
 */

import { SETTINGS_ACTIONS, DEFAULT_SETTINGS } from '../constants/settingsConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialSettingsState = {
  // Settings values
  settings: { ...DEFAULT_SETTINGS },

  // Loading state
  isLoading: false,

  // Initialization state (false until first hydration)
  isInitialized: false,
};

// =============================================================================
// STATE SCHEMA (for validation)
// =============================================================================

/**
 * Schema for settings state validation
 * Used by createValidatedReducer to catch state corruption
 */
export const SETTINGS_STATE_SCHEMA = {
  settings: { type: 'object' },
  isLoading: { type: 'boolean' },
  isInitialized: { type: 'boolean' },
};

// =============================================================================
// RAW REDUCER
// =============================================================================

/**
 * Settings reducer (raw, wrapped with validation below)
 * Handles all settings-related state changes
 */
const rawSettingsReducer = (state, action) => {
  switch (action.type) {
    // Load settings from database (full replacement)
    case SETTINGS_ACTIONS.LOAD_SETTINGS:
      return {
        ...state,
        settings: {
          ...DEFAULT_SETTINGS,
          ...action.payload.settings,
        },
        isInitialized: true,
      };

    // Update a single setting
    case SETTINGS_ACTIONS.UPDATE_SETTING:
      return {
        ...state,
        settings: {
          ...state.settings,
          [action.payload.key]: action.payload.value,
        },
      };

    // Reset all settings to defaults
    case SETTINGS_ACTIONS.RESET_SETTINGS:
      return {
        ...state,
        settings: { ...DEFAULT_SETTINGS },
      };

    // Hydrate settings from database (on app startup)
    // Merges with defaults to ensure all fields exist
    case SETTINGS_ACTIONS.HYDRATE_SETTINGS:
      return {
        ...state,
        settings: action.payload.settings
          ? { ...DEFAULT_SETTINGS, ...action.payload.settings }
          : { ...DEFAULT_SETTINGS },
        isInitialized: true,
      };

    // Set loading state
    case SETTINGS_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    // Add a custom venue
    case SETTINGS_ACTIONS.ADD_CUSTOM_VENUE: {
      const venue = action.payload.venue;
      // Prevent duplicates
      if (!venue || state.settings.customVenues.includes(venue)) {
        return state;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          customVenues: [...state.settings.customVenues, venue],
        },
      };
    }

    // Remove a custom venue
    case SETTINGS_ACTIONS.REMOVE_CUSTOM_VENUE:
      return {
        ...state,
        settings: {
          ...state.settings,
          customVenues: state.settings.customVenues.filter(
            (v) => v !== action.payload.venue
          ),
        },
      };

    // Add a custom game type
    case SETTINGS_ACTIONS.ADD_CUSTOM_GAME_TYPE: {
      const gameType = action.payload.gameType;
      // Prevent duplicates by label
      if (
        !gameType ||
        state.settings.customGameTypes.some((gt) => gt.label === gameType.label)
      ) {
        return state;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          customGameTypes: [...state.settings.customGameTypes, gameType],
        },
      };
    }

    // Remove a custom game type
    case SETTINGS_ACTIONS.REMOVE_CUSTOM_GAME_TYPE:
      return {
        ...state,
        settings: {
          ...state.settings,
          customGameTypes: state.settings.customGameTypes.filter(
            (gt) => gt.label !== action.payload.label
          ),
        },
      };

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

/**
 * Settings reducer wrapped with validation
 * - Logs all actions in debug mode
 * - Validates state after each action
 * - Returns previous state on error (prevents corruption)
 */
export const settingsReducer = createValidatedReducer(
  rawSettingsReducer,
  SETTINGS_STATE_SCHEMA,
  'settingsReducer'
);

// Export action types for convenience
export { SETTINGS_ACTIONS };
