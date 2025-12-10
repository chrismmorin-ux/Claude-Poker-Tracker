/**
 * Shared test utilities
 * Mock factories, test helpers, and re-exported constants for tests
 */

import { vi } from 'vitest';

// Import constants for internal use
import { SEAT_ARRAY as SEAT_ARRAY_INTERNAL } from '../constants/gameConstants';

// Re-export constants for convenience in tests
export {
  ACTIONS,
  ACTION_ABBREV,
  FOLD_ACTIONS,
  TERMINAL_ACTIONS,
  SEAT_STATUS,
  SEAT_ARRAY,
  STREETS,
  BETTING_STREETS,
  SUITS,
  RANKS,
  SUIT_ABBREV,
  LIMITS,
  LAYOUT,
  isFoldAction,
} from '../constants/gameConstants';

export {
  SESSION_ACTIONS,
  VENUES,
  GAME_TYPES,
  SESSION_GOALS,
} from '../constants/sessionConstants';

export {
  PLAYER_ACTIONS,
  ETHNICITY_OPTIONS,
  BUILD_OPTIONS,
  GENDER_OPTIONS,
  STYLE_TAGS,
} from '../constants/playerConstants';

export {
  SETTINGS_ACTIONS,
  DEFAULT_SETTINGS,
  THEMES,
  CARD_SIZES,
  BACKUP_FREQUENCIES,
  SETTINGS_FIELDS,
} from '../constants/settingsConstants';

// =============================================================================
// MOCK STATE FACTORIES
// =============================================================================

/**
 * Create a mock game state with optional overrides
 */
export const createMockGameState = (overrides = {}) => ({
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  seatActions: {},
  absentSeats: [],
  ...overrides,
});

/**
 * Create a mock card state with optional overrides
 */
export const createMockCardState = (overrides = {}) => ({
  communityCards: ['', '', '', '', ''],
  holeCards: ['', ''],
  holeCardsVisible: true,
  allPlayerCards: createEmptyPlayerCards(),
  ...overrides,
});

/**
 * Create a mock UI state with optional overrides
 */
export const createMockUIState = (overrides = {}) => ({
  currentView: 'table',
  selectedPlayers: [],
  contextMenu: null,
  isDraggingDealer: false,
  isSidebarCollapsed: false,
  showCardSelector: false,
  cardSelectorType: null,
  highlightedBoardIndex: null,
  isShowdownViewOpen: false,
  highlightedSeat: null,
  highlightedHoleSlot: null,
  ...overrides,
});

/**
 * Create a mock session state with optional overrides
 */
export const createMockSessionState = (overrides = {}) => ({
  currentSession: null,
  allSessions: [],
  isLoading: false,
  ...overrides,
});

/**
 * Create a mock player state with optional overrides
 */
export const createMockPlayerState = (overrides = {}) => ({
  allPlayers: [],
  seatPlayers: {},
  isLoading: false,
  ...overrides,
});

/**
 * Create a mock settings state with optional overrides
 * Use this when testing components that use useSettings()
 */
export const createMockSettingsState = (overrides = {}) => {
  // Import DEFAULT_SETTINGS inline to avoid circular dependency
  const defaults = {
    theme: 'dark',
    cardSize: 'medium',
    defaultVenue: null,
    defaultGameType: null,
    autoBackupEnabled: false,
    backupFrequency: 'manual',
    customVenues: [],
    customGameTypes: [],
    errorReportingEnabled: true,
  };

  return {
    settings: { ...defaults, ...(overrides.settings || {}) },
    isLoading: false,
    isInitialized: true,
    ...overrides,
  };
};

/**
 * Create empty player cards object for all 9 seats
 */
export const createEmptyPlayerCards = () => {
  const playerCards = {};
  SEAT_ARRAY_INTERNAL.forEach(seat => {
    playerCards[seat] = ['', ''];
  });
  return playerCards;
};

/**
 * Create a mock session object
 */
export const createMockSession = (overrides = {}) => ({
  sessionId: 1,
  startTime: Date.now(),
  endTime: null,
  venue: 'Horseshoe Casino',
  gameType: '1/2',
  buyIn: 200,
  rebuyTransactions: [],
  cashOut: null,
  handCount: 0,
  notes: '',
  isActive: true,
  ...overrides,
});

/**
 * Create a mock player object
 */
export const createMockPlayer = (overrides = {}) => ({
  playerId: 1,
  name: 'Test Player',
  nickname: '',
  ethnicity: '',
  build: '',
  gender: '',
  facialHair: '',
  hat: false,
  sunglasses: false,
  styleTags: [],
  notes: '',
  avatar: null,
  handCount: 0,
  createdAt: Date.now(),
  lastSeenAt: Date.now(),
  ...overrides,
});

/**
 * Create a mock hand record for persistence tests
 */
export const createMockHandRecord = (overrides = {}) => ({
  handId: 1,
  timestamp: Date.now(),
  sessionId: null,
  gameState: createMockGameState(),
  cardState: {
    communityCards: ['', '', '', '', ''],
    holeCards: ['', ''],
    allPlayerCards: createEmptyPlayerCards(),
  },
  seatPlayers: {},
  ...overrides,
});

// =============================================================================
// MOCK DISPATCH FACTORY
// =============================================================================

/**
 * Create a mock dispatch function
 * @returns {Function} A vi.fn() that can be used as a dispatch mock
 */
export const createMockDispatch = () => vi.fn();

/**
 * Create all six dispatchers used in PokerTracker
 */
export const createMockDispatchers = () => ({
  dispatchGame: vi.fn(),
  dispatchUi: vi.fn(),
  dispatchCard: vi.fn(),
  dispatchSession: vi.fn(),
  dispatchPlayer: vi.fn(),
  dispatchSettings: vi.fn(),
});

// =============================================================================
// MOCK FUNCTION FACTORIES
// =============================================================================

/**
 * Create a mock isSeatInactive function
 * @param {Set|Array} inactiveSeats - Seats to treat as inactive
 * @returns {Function}
 */
export const createMockIsSeatInactive = (inactiveSeats = []) => {
  const inactiveSet = new Set(inactiveSeats);
  return vi.fn((seat) => inactiveSet.has(seat) ? 'folded' : null);
};

/**
 * Create a mock hasSeatFolded function
 * @param {Set|Array} foldedSeats - Seats to treat as folded
 * @returns {Function}
 */
export const createMockHasSeatFolded = (foldedSeats = []) => {
  const foldedSet = new Set(foldedSeats);
  return vi.fn((seat) => foldedSet.has(seat));
};

/**
 * Create a mock logger
 */
export const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  action: vi.fn(),
});

// =============================================================================
// INDEXEDDB TEST HELPERS
// =============================================================================

/**
 * Clean up test database before each test
 * Use with fake-indexeddb
 */
export const cleanupTestDB = async (dbName = 'PokerTrackerDB') => {
  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(dbName);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => reject(deleteRequest.error);
    deleteRequest.onblocked = () => resolve(); // Proceed anyway if blocked
  });
};

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

/**
 * Check if a dispatch was called with a specific action type
 */
export const expectDispatchCalledWith = (dispatch, actionType, payloadMatcher = undefined) => {
  const calls = dispatch.mock.calls;
  const matchingCall = calls.find(([action]) => action.type === actionType);

  if (!matchingCall) {
    throw new Error(`Expected dispatch to be called with action type "${actionType}"`);
  }

  if (payloadMatcher !== undefined) {
    expect(matchingCall[0].payload).toEqual(payloadMatcher);
  }

  return matchingCall[0];
};

/**
 * Create a set of community cards at specific positions
 */
export const createCommunityCards = (cards = {}) => {
  const result = ['', '', '', '', ''];
  for (const [index, card] of Object.entries(cards)) {
    result[parseInt(index, 10)] = card;
  }
  return result;
};

/**
 * Create seat actions for testing
 */
export const createSeatActions = (actions = {}) => {
  // actions format: { seat: { street: action } } or { seat: { street: [action1, action2] } }
  return actions;
};

// =============================================================================
// TEST DATA
// =============================================================================

/**
 * Sample valid cards for testing
 */
export const SAMPLE_CARDS = {
  aceSpades: 'A♠',
  kingHearts: 'K♥',
  queenDiamonds: 'Q♦',
  jackClubs: 'J♣',
  tenSpades: 'T♠',
  nineHearts: '9♥',
  twoClubs: '2♣',
};

/**
 * Sample complete hand for testing
 */
export const SAMPLE_HAND = {
  communityCards: ['A♠', 'K♥', 'Q♦', 'J♣', 'T♠'],
  holeCards: ['A♥', 'A♦'],
};

/**
 * All valid card strings for iteration
 */
export const ALL_VALID_CARDS = (() => {
  const cards = [];
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const suits = ['♠', '♥', '♦', '♣'];
  for (const rank of ranks) {
    for (const suit of suits) {
      cards.push(rank + suit);
    }
  }
  return cards;
})();

// =============================================================================
// REACT TESTING LIBRARY HELPERS
// =============================================================================

/**
 * Helper to create a wrapper factory for context providers
 * Use this pattern in your test files for components that use context hooks.
 *
 * @example
 * // In your test file:
 * import { render } from '@testing-library/react';
 * import { SettingsProvider } from '../../../contexts/SettingsContext';
 * import { createMockSettingsState } from '../../test/utils';
 *
 * // Create a wrapper helper
 * const renderWithSettings = (ui, settingsState = createMockSettingsState()) => {
 *   return render(
 *     <SettingsProvider settingsState={settingsState} dispatchSettings={vi.fn()}>
 *       {ui}
 *     </SettingsProvider>
 *   );
 * };
 *
 * // Use it in tests
 * it('renders with default settings', () => {
 *   renderWithSettings(<MyComponent />);
 *   // assertions...
 * });
 *
 * // Test with custom settings
 * it('shows custom venues', () => {
 *   const customState = createMockSettingsState({
 *     settings: { customVenues: ['My Casino'] }
 *   });
 *   renderWithSettings(<MyComponent />, customState);
 * });
 *
 * NOTE: This pattern must be implemented in each test file that needs it
 * because utils.js is a plain JS file and cannot contain JSX.
 */
