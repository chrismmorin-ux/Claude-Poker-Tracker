/**
 * playerConstants.js - Player management constants
 *
 * Constants for player logging, physical descriptions, and playing styles.
 */

// =============================================================================
// PLAYER ACTION TYPES (for playerReducer)
// =============================================================================

export const PLAYER_ACTIONS = {
  // Player CRUD
  LOAD_PLAYERS: 'LOAD_PLAYERS',
  CREATE_PLAYER: 'CREATE_PLAYER',
  UPDATE_PLAYER: 'UPDATE_PLAYER',
  DELETE_PLAYER: 'DELETE_PLAYER',

  // Seat assignment (ephemeral - per hand)
  SET_SEAT_PLAYER: 'SET_SEAT_PLAYER',
  CLEAR_SEAT_PLAYER: 'CLEAR_SEAT_PLAYER',
  CLEAR_ALL_SEAT_PLAYERS: 'CLEAR_ALL_SEAT_PLAYERS',
  HYDRATE_SEAT_PLAYERS: 'HYDRATE_SEAT_PLAYERS',

  // Loading state
  SET_LOADING: 'SET_LOADING'
};

// =============================================================================
// PHYSICAL DESCRIPTION OPTIONS
// =============================================================================

export const ETHNICITY_OPTIONS = [
  'White/Caucasian',
  'Black/African American',
  'Hispanic/Latino',
  'Asian',
  'Middle Eastern',
  'Native American',
  'Pacific Islander',
  'Mixed/Other'
];

export const BUILD_OPTIONS = [
  { value: 'Slim', label: 'Slim' },
  { value: 'Average', label: 'Average' },
  { value: 'Heavy', label: 'Heavy' },
  { value: 'Muscular', label: 'Muscular' }
];

export const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' }
];

export const FACIAL_HAIR_OPTIONS = [
  'Clean-shaven',
  'Stubble',
  'Goatee',
  'Mustache',
  'Full Beard',
  'Van Dyke',
  'Soul Patch'
];

// =============================================================================
// PLAYING STYLE TAGS
// =============================================================================

export const STYLE_TAGS = [
  'Tight',
  'Loose',
  'Passive',
  'Aggressive',
  'TAG (Tight-Aggressive)',
  'LAG (Loose-Aggressive)',
  'Maniac',
  'Rock',
  'Calling Station',
  'Nit',
  'Fish',
  'Whale',
  'Reg',
  'Tricky',
  'Straightforward',
  'Tilty',
  'Social Player'
];

// =============================================================================
// PLAYER FIELD NAMES
// =============================================================================

export const PLAYER_FIELDS = {
  // Identity
  NAME: 'name',
  NICKNAME: 'nickname',

  // Physical description
  ETHNICITY: 'ethnicity',
  BUILD: 'build',
  GENDER: 'gender',
  FACIAL_HAIR: 'facialHair',
  HAT: 'hat',
  SUNGLASSES: 'sunglasses',

  // Playing style
  STYLE_TAGS: 'styleTags',

  // Notes and avatar
  NOTES: 'notes',
  AVATAR: 'avatar',

  // Metadata
  CREATED_AT: 'createdAt',
  LAST_SEEN_AT: 'lastSeenAt',
  HAND_COUNT: 'handCount',

  // Stats (populated in Phase 2)
  STATS: 'stats'
};

// =============================================================================
// AVATAR CONSTRAINTS
// =============================================================================

export const AVATAR_MAX_SIZE_MB = 2;
export const AVATAR_MAX_SIZE_BYTES = AVATAR_MAX_SIZE_MB * 1024 * 1024;
