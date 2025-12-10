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

// =============================================================================
// SETTINGS CATEGORIES (for UI grouping)
// =============================================================================

/**
 * Settings categories for UI organization
 */
export const SETTINGS_CATEGORIES = {
  DISPLAY: 'display',
  GAME_DEFAULTS: 'gameDefaults',
  DATA: 'data',
  ABOUT: 'about',
};
