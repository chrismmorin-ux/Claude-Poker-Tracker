/**
 * settingsConstants.js - Settings-related constants
 *
 * Provides constants for app settings management including
 * action types, default values, and options for UI controls.
 */

// =============================================================================
// SETTINGS ACTION TYPES
// =============================================================================

/**
 * Action types for settingsReducer
 */
export const SETTINGS_ACTIONS = {
  LOAD_SETTINGS: 'LOAD_SETTINGS',
  UPDATE_SETTING: 'UPDATE_SETTING',
  RESET_SETTINGS: 'RESET_SETTINGS',
  HYDRATE_SETTINGS: 'HYDRATE_SETTINGS',
  SET_LOADING: 'SET_LOADING',
  ADD_CUSTOM_VENUE: 'ADD_CUSTOM_VENUE',
  REMOVE_CUSTOM_VENUE: 'REMOVE_CUSTOM_VENUE',
  ADD_CUSTOM_GAME_TYPE: 'ADD_CUSTOM_GAME_TYPE',
  REMOVE_CUSTOM_GAME_TYPE: 'REMOVE_CUSTOM_GAME_TYPE',
};

// =============================================================================
// DEFAULT SETTINGS
// =============================================================================

/**
 * Default values for all settings
 * These are used when:
 * - App is loaded for the first time
 * - User resets settings to defaults
 * - Merging with stored settings that may be missing fields
 */
export const DEFAULT_SETTINGS = {
  // Display preferences
  theme: 'dark',
  cardSize: 'medium',

  // Game defaults
  defaultVenue: null,
  defaultGameType: null,

  // Data management
  autoBackupEnabled: false,
  backupFrequency: 'manual',

  // Customization
  customVenues: [],
  customGameTypes: [],

  // Custom bet sizing presets (null = use built-in defaults)
  // Values are multipliers (preflop) or pot fractions (postflop bet)
  customBetSizes: {
    preflop_open: null,    // e.g. [2.5, 4, 5, 10] — multipliers of BB
    preflop_raise: null,   // e.g. [2, 3, 4, 5] — multipliers of current bet
    postflop_bet: null,    // e.g. [0.25, 0.5, 0.75, 1.0] — fractions of pot
    postflop_raise: null,  // e.g. [2, 3, 4, 5] — multipliers of current bet
  },

  // Privacy/telemetry
  errorReportingEnabled: true,
};

// =============================================================================
// SETTINGS OPTIONS
// =============================================================================

/**
 * Available theme options
 */
export const THEMES = ['dark', 'light'];

/**
 * Available card size options
 */
export const CARD_SIZES = ['small', 'medium', 'large'];

/**
 * Available backup frequency options
 */
export const BACKUP_FREQUENCIES = ['daily', 'weekly', 'manual'];

// =============================================================================
// SETTINGS FIELD IDENTIFIERS
// =============================================================================

/**
 * Settings field identifiers for type-safe updates
 */
export const SETTINGS_FIELDS = {
  THEME: 'theme',
  CARD_SIZE: 'cardSize',
  DEFAULT_VENUE: 'defaultVenue',
  DEFAULT_GAME_TYPE: 'defaultGameType',
  AUTO_BACKUP_ENABLED: 'autoBackupEnabled',
  BACKUP_FREQUENCY: 'backupFrequency',
  CUSTOM_VENUES: 'customVenues',
  CUSTOM_GAME_TYPES: 'customGameTypes',
  ERROR_REPORTING_ENABLED: 'errorReportingEnabled',
};

