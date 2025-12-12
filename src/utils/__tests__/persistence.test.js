/**
 * persistence.test.js - Tests for IndexedDB persistence layer
 *
 * Uses fake-indexeddb to mock IndexedDB in the test environment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock the errorHandler to suppress logs during tests
vi.mock('../errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    action: vi.fn(),
  },
  AppError: class AppError extends Error {
    constructor(code, message) {
      super(`[${code}] ${message}`);
      this.code = code;
    }
  },
  ERROR_CODES: {
    DB_INIT_FAILED: 'E301',
    SAVE_FAILED: 'E302',
    LOAD_FAILED: 'E303',
  },
}));

// Mock the migration module
vi.mock('../../migrations/normalizeSeatActions', () => ({
  normalizeHandRecord: (record) => record,
}));

// Import functions after mocks are set up
import {
  initDB,
  saveHand,
  loadHandById,
  loadLatestHand,
  getAllHands,
  deleteHand,
  clearAllHands,
  getHandCount,
  handExists,
  createSession,
  endSession,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getAllSessions,
  getSessionById,
  deleteSession,
  updateSession,
  createPlayer,
  getAllPlayers,
  getPlayerById,
  deletePlayer,
} from '../persistence';

// Helper to create valid hand data that passes validation
const createValidHandData = (overrides = {}) => ({
  timestamp: Date.now(),
  gameState: {
    currentStreet: 'preflop',
    dealerButtonSeat: 1,
    mySeat: 5,
    ...overrides.gameState,
  },
  cardState: {
    communityCards: ['', '', '', '', ''],
    holeCards: ['', ''],
    ...overrides.cardState,
  },
  ...overrides,
});

describe('persistence', () => {
  // Clear IndexedDB before each test
  beforeEach(async () => {
    // Delete the database to start fresh
    await new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase('PokerTrackerDB');
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  });

  describe('initDB', () => {
    it('creates database successfully', async () => {
      const db = await initDB();
      expect(db).toBeDefined();
      expect(db.name).toBe('PokerTrackerDB');
      db.close();
    });

    it('creates all object stores', async () => {
      const db = await initDB();
      expect(db.objectStoreNames.contains('hands')).toBe(true);
      expect(db.objectStoreNames.contains('sessions')).toBe(true);
      expect(db.objectStoreNames.contains('activeSession')).toBe(true);
      expect(db.objectStoreNames.contains('players')).toBe(true);
      db.close();
    });
  });

  describe('Hands CRUD', () => {
    describe('saveHand', () => {
      it('saves a hand and returns handId', async () => {
        const handData = createValidHandData({
          cardState: { communityCards: ['A♠', 'K♥', '', '', ''], holeCards: ['', ''] },
        });

        const handId = await saveHand(handData);
        expect(handId).toBeGreaterThan(0);
      });

      it('saves multiple hands with unique IDs', async () => {
        const hand1 = await saveHand(createValidHandData({ timestamp: Date.now() }));
        const hand2 = await saveHand(createValidHandData({ timestamp: Date.now() + 1000 }));
        const hand3 = await saveHand(createValidHandData({ timestamp: Date.now() + 2000 }));

        expect(hand1).toBe(1);
        expect(hand2).toBe(2);
        expect(hand3).toBe(3);
      });
    });

    describe('loadHandById', () => {
      it('loads a saved hand', async () => {
        const handData = createValidHandData({
          gameState: { currentStreet: 'flop', dealerButtonSeat: 1, mySeat: 5 },
        });

        const handId = await saveHand(handData);
        const loaded = await loadHandById(handId);

        expect(loaded).toBeDefined();
        expect(loaded.handId).toBe(handId);
        // saveHand always sets timestamp to Date.now(), so just verify it exists
        expect(loaded.timestamp).toBeDefined();
        expect(typeof loaded.timestamp).toBe('number');
        expect(loaded.gameState.currentStreet).toBe('flop');
      });

      it('returns null for non-existent hand', async () => {
        const loaded = await loadHandById(999);
        expect(loaded).toBeNull();
      });
    });

    describe('loadLatestHand', () => {
      it('returns the most recent hand', async () => {
        // saveHand always sets timestamp to Date.now(), so the last saved hand
        // will have the highest timestamp and be returned as "latest"
        await saveHand(createValidHandData({ note: 'first' }));
        await saveHand(createValidHandData({ note: 'second' }));
        const thirdId = await saveHand(createValidHandData({ note: 'third' }));

        const latest = await loadLatestHand();
        // The last saved hand should be returned
        expect(latest.handId).toBe(thirdId);
        expect(latest.note).toBe('third');
      });

      it('returns null when no hands exist', async () => {
        const latest = await loadLatestHand();
        expect(latest).toBeNull();
      });
    });

    describe('getAllHands', () => {
      it('returns all saved hands', async () => {
        await saveHand(createValidHandData());
        await saveHand(createValidHandData());
        await saveHand(createValidHandData());

        const hands = await getAllHands();
        expect(hands).toHaveLength(3);
      });

      it('returns empty array when no hands', async () => {
        const hands = await getAllHands();
        expect(hands).toEqual([]);
      });
    });

    describe('deleteHand', () => {
      it('deletes a hand', async () => {
        const handId = await saveHand(createValidHandData());
        await deleteHand(handId);

        const loaded = await loadHandById(handId);
        expect(loaded).toBeNull();
      });

      it('succeeds silently for non-existent hand', async () => {
        // deleteHand resolves successfully even if the hand doesn't exist
        // (IndexedDB delete on non-existent key is not an error)
        await expect(deleteHand(999)).resolves.not.toThrow();
      });
    });

    describe('clearAllHands', () => {
      it('removes all hands', async () => {
        await saveHand(createValidHandData());
        await saveHand(createValidHandData());
        await saveHand(createValidHandData());

        await clearAllHands();
        const hands = await getAllHands();
        expect(hands).toEqual([]);
      });
    });

    describe('getHandCount', () => {
      it('returns correct count', async () => {
        expect(await getHandCount()).toBe(0);

        await saveHand(createValidHandData());
        expect(await getHandCount()).toBe(1);

        await saveHand(createValidHandData());
        expect(await getHandCount()).toBe(2);
      });
    });

    describe('handExists', () => {
      it('returns true for existing hand', async () => {
        const handId = await saveHand(createValidHandData());
        expect(await handExists(handId)).toBe(true);
      });

      it('returns false for non-existent hand', async () => {
        expect(await handExists(999)).toBe(false);
      });
    });
  });

  describe('Sessions CRUD', () => {
    describe('createSession', () => {
      it('creates a session with default values', async () => {
        const sessionId = await createSession();
        expect(sessionId).toBeGreaterThan(0);

        const session = await getSessionById(sessionId);
        expect(session.venue).toBe('Online');
        expect(session.gameType).toBe('1/2');
        expect(session.isActive).toBe(true);
      });

      it('creates a session with custom values', async () => {
        const sessionId = await createSession({
          venue: 'Horseshoe Casino',
          gameType: '2/5',
          buyIn: 500,
        });

        const session = await getSessionById(sessionId);
        expect(session.venue).toBe('Horseshoe Casino');
        expect(session.gameType).toBe('2/5');
        expect(session.buyIn).toBe(500);
      });
    });

    describe('endSession', () => {
      it('ends a session with cash out', async () => {
        const sessionId = await createSession({ buyIn: 200 });
        await endSession(sessionId, 350);

        const session = await getSessionById(sessionId);
        expect(session.isActive).toBe(false);
        expect(session.cashOut).toBe(350);
        expect(session.endTime).toBeDefined();
      });
    });

    describe('getActiveSession / setActiveSession / clearActiveSession', () => {
      it('manages active session correctly', async () => {
        // Initially no active session
        const initial = await getActiveSession();
        expect(initial).toBeNull();

        // Set active session
        const sessionId = await createSession();
        await setActiveSession(sessionId);

        // getActiveSession returns an object { sessionId: number }, not just the number
        const active = await getActiveSession();
        expect(active).toEqual({ sessionId: sessionId });

        // Clear active session
        await clearActiveSession();
        const cleared = await getActiveSession();
        expect(cleared).toBeNull();
      });
    });

    describe('getAllSessions', () => {
      it('returns all sessions', async () => {
        await createSession({ venue: 'Online' });
        await createSession({ venue: 'Casino A' });
        await createSession({ venue: 'Casino B' });

        const sessions = await getAllSessions();
        expect(sessions).toHaveLength(3);
      });
    });

    describe('updateSession', () => {
      it('updates session fields', async () => {
        const sessionId = await createSession({ venue: 'Online' });
        await updateSession(sessionId, { venue: 'Updated Venue', notes: 'Test notes' });

        const session = await getSessionById(sessionId);
        expect(session.venue).toBe('Updated Venue');
        expect(session.notes).toBe('Test notes');
      });
    });

    describe('deleteSession', () => {
      it('deletes a session', async () => {
        const sessionId = await createSession();
        await deleteSession(sessionId);

        const session = await getSessionById(sessionId);
        expect(session).toBeNull();
      });
    });
  });

  describe('Players CRUD', () => {
    describe('createPlayer', () => {
      it('creates a player with required fields', async () => {
        const playerId = await createPlayer({ name: 'John Doe' });
        expect(playerId).toBeGreaterThan(0);

        const player = await getPlayerById(playerId);
        expect(player.name).toBe('John Doe');
        expect(player.createdAt).toBeDefined();
        expect(player.lastSeenAt).toBeDefined();
      });

      it('creates a player with all fields', async () => {
        const playerId = await createPlayer({
          name: 'Jane Smith',
          nickname: 'JJ',
          ethnicity: 'caucasian',
          build: 'average',
          gender: 'female',
          facialHair: 'none',
          styleTags: ['tight', 'aggressive'],
          notes: 'Regular player',
        });

        const player = await getPlayerById(playerId);
        expect(player.name).toBe('Jane Smith');
        expect(player.nickname).toBe('JJ');
        expect(player.styleTags).toEqual(['tight', 'aggressive']);
        expect(player.notes).toBe('Regular player');
      });
    });

    describe('getAllPlayers', () => {
      it('returns all players', async () => {
        await createPlayer({ name: 'Player 1' });
        await createPlayer({ name: 'Player 2' });
        await createPlayer({ name: 'Player 3' });

        const players = await getAllPlayers();
        expect(players).toHaveLength(3);
      });

      it('returns empty array when no players', async () => {
        const players = await getAllPlayers();
        expect(players).toEqual([]);
      });
    });

    describe('getPlayerById', () => {
      it('returns player by ID', async () => {
        const playerId = await createPlayer({ name: 'Test Player' });
        const player = await getPlayerById(playerId);

        expect(player.playerId).toBe(playerId);
        expect(player.name).toBe('Test Player');
      });

      it('returns null for non-existent player', async () => {
        const player = await getPlayerById(999);
        expect(player).toBeNull();
      });
    });

    describe('deletePlayer', () => {
      it('deletes a player', async () => {
        const playerId = await createPlayer({ name: 'To Delete' });
        await deletePlayer(playerId);

        const player = await getPlayerById(playerId);
        expect(player).toBeNull();
      });
    });
  });

  describe('Hand-Session Integration', () => {
    it('auto-links hand to active session', async () => {
      // Create a session and set it as active
      const sessionId = await createSession();
      await setActiveSession(sessionId);

      // Save a hand - saveHand automatically links to active session
      const handId = await saveHand(createValidHandData({
        gameState: { currentStreet: 'flop', dealerButtonSeat: 1, mySeat: 5 },
      }));

      const hand = await loadHandById(handId);
      expect(hand.sessionId).toBe(sessionId);
    });

    it('saves hand without sessionId when no active session', async () => {
      // Ensure no active session
      await clearActiveSession();

      const handId = await saveHand(createValidHandData({
        gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 5 },
      }));

      const hand = await loadHandById(handId);
      expect(hand.sessionId).toBeNull();
    });
  });

  describe('Hand-Player Integration', () => {
    it('saves hand with seatPlayers', async () => {
      const player1 = await createPlayer({ name: 'Player 1' });
      const player2 = await createPlayer({ name: 'Player 2' });

      const handId = await saveHand(createValidHandData({
        seatPlayers: { 1: player1, 5: player2 },
      }));

      const hand = await loadHandById(handId);
      expect(hand.seatPlayers[1]).toBe(player1);
      expect(hand.seatPlayers[5]).toBe(player2);
    });
  });
});
