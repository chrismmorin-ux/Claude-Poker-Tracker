/**
 * gameConstants.js - Game configuration and action constants
 * Centralized constants for poker game logic, actions, and card definitions
 */

// Re-export primitive actions for unified import
export {
  PRIMITIVE_ACTIONS,
  LEGACY_TO_PRIMITIVE,
  PRIMITIVE_ACTION_VALUES,
  isPrimitiveAction,
  toPrimitive,
  SHOWDOWN_ACTIONS,
  isShowdownAction,
} from './primitiveActions';

// Street definitions
export const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];
export const BETTING_STREETS = ['preflop', 'flop', 'turn', 'river']; // Streets where betting occurs (excludes showdown)

// Card constants
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUIT_ABBREV = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };

// Action type constants (only actions stored in state — primitives use string literals)
export const ACTIONS = {
  FOLD: 'fold',
  FOLD_TO_CR: 'fold_to_cr',
  FOLD_TO_CBET: 'fold_to_cbet',
  MUCKED: 'mucked',
  WON: 'won',
};

// Action abbreviations (3-4 chars max) for display in badges
export const ACTION_ABBREV = {
  fold: 'FLD',
  check: 'CHK',
  call: 'CAL',
  bet: 'BET',
  raise: 'RSE',
  fold_to_cr: 'F/CR',
  fold_to_cbet: 'F/C',
  mucked: 'MCK',
  won: 'WON',
};

// All actions that count as a fold (for checking fold status)
export const FOLD_ACTIONS = [ACTIONS.FOLD, ACTIONS.FOLD_TO_CR, ACTIONS.FOLD_TO_CBET];

// Terminal actions (actions that end a player's participation in the hand)
export const TERMINAL_ACTIONS = [...FOLD_ACTIONS, ACTIONS.WON];

// Seat status values (returned by isSeatInactive)
export const SEAT_STATUS = {
  FOLDED: 'folded',
  ABSENT: 'absent',
};

// Array of seat numbers for iteration
export const SEAT_ARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Helper function: Check if an action is a fold action
export const isFoldAction = (action) => FOLD_ACTIONS.includes(action);

// =============================================================================
// NUMERIC LIMITS (replaces magic numbers)
// =============================================================================

/**
 * Game limits - centralizes all numeric constraints
 * Use these instead of hardcoded numbers like 9, 18, etc.
 */
export const LIMITS = {
  // Table configuration
  NUM_SEATS: 9,

  // Card limits
  MAX_HOLE_CARDS: 2,
  MAX_COMMUNITY_CARDS: 5,

  // Derived limits (calculated from base values)
  MAX_SHOWDOWN_SLOTS: 18,  // NUM_SEATS * MAX_HOLE_CARDS
};

// =============================================================================
// LAYOUT CONSTANTS (replaces magic numbers in positioning)
// =============================================================================

/**
 * Layout dimensions for table rendering
 * All values in pixels, used for positioning calculations
 */
export const LAYOUT = {
  // Design dimensions (Samsung Galaxy A22 landscape)
  TABLE_WIDTH: 1600,
  TABLE_HEIGHT: 720,

  // Felt (playing area) dimensions
  FELT_WIDTH: 860,
  FELT_HEIGHT: 450,

  // Table positioning offsets
  TABLE_OFFSET_X: 117,
  TABLE_OFFSET_Y: 95,

  // Context menu positioning
  CONTEXT_MENU_OFFSET_X: -160,
  CONTEXT_MENU_OFFSET_Y: -20,

  // Card dimensions (in pixels) - scaled for mobile
  CARD: {
    SMALL: { width: 24, height: 35 },    // Hole cards on table
    MEDIUM: { width: 28, height: 40 },   // Showdown card slots
    LARGE: { width: 32, height: 45 },    // Card selector slots
    TABLE: { width: 35, height: 50 },    // Community cards on table
  },

  // UI element dimensions
  BADGE_SIZE: 16,
  SEAT_SIZE: 56,
  DEALER_BUTTON_SIZE: 28,
  TOGGLE_BUTTON_SIZE: 24,

  // Table label positioning (below felt)
  TABLE_LABEL_BOTTOM: -30,
  TABLE_LABEL_WIDTH: 300,
  TABLE_LABEL_HEIGHT: 60,

  // Action panel positioning
  ACTION_PANEL_WIDTH: 450,
  ACTION_PANEL_TOP: 0,
};
