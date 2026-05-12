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
  // SCF self-coach settings (WS-148 / SPR-033) — UI lands in WS-159.
  SET_SELF_COACH_SIGNAL_TOGGLE: 'SET_SELF_COACH_SIGNAL_TOGGLE',
  SET_SELF_COACH_SIGNAL_WEIGHT: 'SET_SELF_COACH_SIGNAL_WEIGHT',
  SET_SELF_COACH_OWNER_TIER: 'SET_SELF_COACH_OWNER_TIER',
  // PIO G5 child F (WS-165 / SPR-036, 2026-05-04) — privacy controls.
  // Default OFF per AP-PIO-03 (privacy-first; user must opt in).
  SET_PRIVACY_PHOTO_CAPTURE_ENABLED: 'SET_PRIVACY_PHOTO_CAPTURE_ENABLED',
  // VCE (WS-181, 2026-05-11) — feature flag + confidence threshold.
  // Default OFF per WS-181 R3 (ship-or-drop spike).
  SET_VOICE_CARD_ENTRY_ENABLED: 'SET_VOICE_CARD_ENTRY_ENABLED',
  SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD: 'SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD',
  // 2026-05-12 — added per first-live-use iteration.
  SET_VOICE_CARD_ENTRY_ACTIVATION_MODE: 'SET_VOICE_CARD_ENTRY_ACTIVATION_MODE',
  SET_VOICE_CARD_ENTRY_POSITION: 'SET_VOICE_CARD_ENTRY_POSITION',
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

  // SCF self-coach settings (WS-148 / SPR-033). Default weights per
  // SCF Gate 4 v1 spec §SCF-G4-SPINE; toggles default on. ownerTier is
  // owner-set only via the SelfCoachView Settings panel (WS-159) — never
  // inferred (AP-SCF-03). Do NOT render any of these as user-facing rank
  // labels — see feedback_scf_learning_state_not_tier_rank.md.
  selfCoach: {
    signalToggles: {
      enableLeak: true,
      enableDrill: true,
      enableTest: true,
      enableRecent: true,
    },
    signalWeights: {
      W_leak: 0.5,
      W_drill: 0.3,
      W_test: 0.15,
      W_recent: 0.05,
    },
    ownerTier: null, // 'novice' | 'live-rec' | 'studied-amateur' | 'part-time-grinder' | 'serious-grinder' | 'pro' | null
  },

  // PIO privacy controls (WS-165 / SPR-036, 2026-05-04). Per AP-PIO-03:
  // photo capture is OFF by default; user must explicitly opt in. Camera
  // entry button visibility is gated by `photoCaptureEnabled === true`.
  privacy: {
    photoCaptureEnabled: false,
  },

  // Voice Card Entry (WS-181, 2026-05-11). Ship-or-drop spike behind a flag.
  // Default OFF. State-aware predicates in TableView / ShowdownView decide
  // when the PTT button renders. See docs/design/surfaces/voice-card-entry.md.
  // Founder ratifications binding: R1 Web Speech only / R2 board+showdown
  // scope only / R3 ship-or-drop / R4 swipe-to-cycle correction / R5 extended
  // grammar w/ villain tokens (advisory under per-villain PTT) / R6 strict
  // no-op on blank/short utterance. Confidence threshold D-3 = 0.65 default,
  // exposed in Settings as a slider in range 0.5–0.9.
  //
  // 2026-05-12 iteration (post first-live-use feedback):
  //   - activationMode: 'hold' (default, accidental-activation safe) or
  //     'tap' (walkie-talkie style, hands-free; auto-stops on silence).
  //   - position: 'bottom-left' (default, near phone speaker/mic on Galaxy A22
  //     landscape) or 'top-right' (legacy, less ergonomic but verified safe).
  voiceCardEntry: {
    enabled: false,
    confidenceThreshold: 0.65,
    activationMode: 'hold',
    position: 'bottom-left',
  },
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
};

