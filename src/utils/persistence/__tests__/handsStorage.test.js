/**
 * handsStorage.test.js - Tests for hand CRUD operations
 *
 * Uses fake-indexeddb to test all hand storage functions against
 * a real IndexedDB schema without browser dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Mock the errorHandler to suppress logs during tests
vi.mock('../../errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    action: vi.fn(),
  },
  DEBUG: false,
}));

// Mock normalizeSeatActions so loaded records are returned as-is
vi.mock('../normalizeSeatActions', () => ({
  normalizeHandRecord: (record) => record,
}));

import { initDB } from '../database';
import {
  saveHand,
  loadLatestHand,
  loadHandById,
  getAllHands,
  getHandsBySessionId,
  deleteHand,
  clearAllHands,
  getHandCount,
  handExists,
  saveOnlineHand,
  getHandsBySource,
} from '../handsStorage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createValidHandData = (overrides = {}) => ({
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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = { indexedDB: globalThis.indexedDB };
});

afterEach(() => {
  delete globalThis.window;
});

// ---------------------------------------------------------------------------
// saveHand
// ---------------------------------------------------------------------------

describe('saveHand', () => {
  it('saves a valid hand and returns a numeric handId', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    expect(typeof handId).toBe('number');
    expect(handId).toBeGreaterThan(0);
  });

  it('auto-increments handId across multiple saves', async () => {
    await initDB();
    const id1 = await saveHand(createValidHandData());
    const id2 = await saveHand(createValidHandData());
    expect(id2).toBeGreaterThan(id1);
  });

  it('attaches a numeric timestamp to the saved record', async () => {
    const before = Date.now();
    await initDB();
    const handId = await saveHand(createValidHandData());
    const after = Date.now();

    const saved = await loadHandById(handId);
    expect(typeof saved.timestamp).toBe('number');
    expect(saved.timestamp).toBeGreaterThanOrEqual(before);
    expect(saved.timestamp).toBeLessThanOrEqual(after);
  });

  it('attaches version metadata to the saved record', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    const saved = await loadHandById(handId);
    expect(saved.version).toBe('1.3.0');
  });

  it('attaches userId to the saved record (defaults to guest)', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    const saved = await loadHandById(handId);
    expect(saved.userId).toBe('guest');
  });

  it('uses the provided userId when given', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData(), 'user-abc');
    const saved = await loadHandById(handId);
    expect(saved.userId).toBe('user-abc');
  });

  it('sets sessionId to null when no active session exists', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    const saved = await loadHandById(handId);
    expect(saved.sessionId).toBeNull();
  });

  it('generates a handDisplayId starting with H when no session', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    const saved = await loadHandById(handId);
    expect(saved.handDisplayId).toMatch(/^H\d+$/);
  });

  it('rejects when gameState is missing', async () => {
    await initDB();
    const bad = {
      cardState: {
        communityCards: ['', '', '', '', ''],
        holeCards: ['', ''],
      },
    };
    await expect(saveHand(bad)).rejects.toThrow('Invalid hand data');
  });

  it('rejects when cardState is missing', async () => {
    await initDB();
    const bad = {
      gameState: {
        currentStreet: 'preflop',
        dealerButtonSeat: 1,
        mySeat: 5,
      },
    };
    await expect(saveHand(bad)).rejects.toThrow('Invalid hand data');
  });

  it('rejects when communityCards does not have exactly 5 elements', async () => {
    await initDB();
    const bad = createValidHandData({
      cardState: { communityCards: ['Ah', 'Kd'], holeCards: ['', ''] },
    });
    await expect(saveHand(bad)).rejects.toThrow('Invalid hand data');
  });

  it('rejects when holeCards does not have exactly 2 elements', async () => {
    await initDB();
    const bad = createValidHandData({
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['Ah'] },
    });
    await expect(saveHand(bad)).rejects.toThrow('Invalid hand data');
  });

  it('rejects when gameState.dealerButtonSeat is not a number', async () => {
    await initDB();
    const bad = createValidHandData({
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 'one', mySeat: 5 },
    });
    await expect(saveHand(bad)).rejects.toThrow('Invalid hand data');
  });
});

// ---------------------------------------------------------------------------
// loadLatestHand
// ---------------------------------------------------------------------------

describe('loadLatestHand', () => {
  it('returns null when no hands exist for the user', async () => {
    await initDB();
    const result = await loadLatestHand('guest');
    expect(result).toBeNull();
  });

  it('returns the only hand when one exists', async () => {
    await initDB();
    await saveHand(createValidHandData());
    const result = await loadLatestHand('guest');
    expect(result).not.toBeNull();
    expect(result.userId).toBe('guest');
  });

  it('returns the most recently saved hand when multiple exist', async () => {
    await initDB();
    await saveHand(createValidHandData({ gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 1 } }));
    await saveHand(createValidHandData({ gameState: { currentStreet: 'flop', dealerButtonSeat: 2, mySeat: 2 } }));
    await saveHand(createValidHandData({ gameState: { currentStreet: 'turn', dealerButtonSeat: 3, mySeat: 3 } }));

    const result = await loadLatestHand('guest');
    expect(result.gameState.currentStreet).toBe('turn');
  });

  it('does not return hands belonging to a different user', async () => {
    await initDB();
    await saveHand(createValidHandData(), 'user-other');
    const result = await loadLatestHand('guest');
    expect(result).toBeNull();
  });

  it('returns null gracefully when called on an empty database', async () => {
    await initDB();
    const result = await loadLatestHand();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadHandById
// ---------------------------------------------------------------------------

describe('loadHandById', () => {
  it('returns the correct hand for a valid handId', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData({ gameState: { currentStreet: 'river', dealerButtonSeat: 9, mySeat: 4 } }));
    const result = await loadHandById(handId);
    expect(result).not.toBeNull();
    expect(result.handId).toBe(handId);
    expect(result.gameState.currentStreet).toBe('river');
  });

  it('returns null for a nonexistent handId', async () => {
    await initDB();
    const result = await loadHandById(99999);
    expect(result).toBeNull();
  });

  it('returns null for handId 0', async () => {
    await initDB();
    const result = await loadHandById(0);
    expect(result).toBeNull();
  });

  it('returns the correct hand when multiple hands exist', async () => {
    await initDB();
    const id1 = await saveHand(createValidHandData({ gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 1 } }));
    const id2 = await saveHand(createValidHandData({ gameState: { currentStreet: 'flop', dealerButtonSeat: 2, mySeat: 2 } }));

    const result1 = await loadHandById(id1);
    const result2 = await loadHandById(id2);

    expect(result1.gameState.dealerButtonSeat).toBe(1);
    expect(result2.gameState.dealerButtonSeat).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getAllHands
// ---------------------------------------------------------------------------

describe('getAllHands', () => {
  it('returns an empty array when no hands exist', async () => {
    await initDB();
    const result = await getAllHands('guest');
    expect(result).toEqual([]);
  });

  it('returns all hands for the user', async () => {
    await initDB();
    await saveHand(createValidHandData());
    await saveHand(createValidHandData());
    await saveHand(createValidHandData());

    const result = await getAllHands('guest');
    expect(result).toHaveLength(3);
  });

  it('only returns hands belonging to the specified user', async () => {
    await initDB();
    await saveHand(createValidHandData(), 'guest');
    await saveHand(createValidHandData(), 'guest');
    await saveHand(createValidHandData(), 'other-user');

    const guestHands = await getAllHands('guest');
    const otherHands = await getAllHands('other-user');

    expect(guestHands).toHaveLength(2);
    expect(otherHands).toHaveLength(1);
  });

  it('returns hands that contain expected fields', async () => {
    await initDB();
    await saveHand(createValidHandData());

    const [hand] = await getAllHands('guest');
    expect(hand).toHaveProperty('handId');
    expect(hand).toHaveProperty('timestamp');
    expect(hand).toHaveProperty('userId', 'guest');
    expect(hand).toHaveProperty('gameState');
    expect(hand).toHaveProperty('cardState');
  });
});

// ---------------------------------------------------------------------------
// getHandsBySessionId
// ---------------------------------------------------------------------------

describe('getHandsBySessionId', () => {
  it('returns an empty array when no hands exist for the session', async () => {
    await initDB();
    const result = await getHandsBySessionId(42);
    expect(result).toEqual([]);
  });

  it('returns only hands matching the given sessionId', async () => {
    await initDB();

    // Bypass saveHand's auto-link by inserting directly with a known sessionId
    const db = await initDB();
    const tx = db.transaction('hands', 'readwrite');
    const store = tx.objectStore('hands');

    const base = {
      timestamp: Date.now(),
      version: '1.3.0',
      userId: 'guest',
      sessionHandNumber: 1,
      handDisplayId: 'S10-H1',
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 5 },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] },
    };

    store.add({ ...base, sessionId: 10, handDisplayId: 'S10-H1' });
    store.add({ ...base, sessionId: 10, handDisplayId: 'S10-H2', sessionHandNumber: 2 });
    store.add({ ...base, sessionId: 20, handDisplayId: 'S20-H1' });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const session10Hands = await getHandsBySessionId(10);
    const session20Hands = await getHandsBySessionId(20);

    expect(session10Hands).toHaveLength(2);
    expect(session20Hands).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// deleteHand
// ---------------------------------------------------------------------------

describe('deleteHand', () => {
  it('removes the hand so it can no longer be loaded', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());

    await deleteHand(handId);

    const result = await loadHandById(handId);
    expect(result).toBeNull();
  });

  it('reduces the hand count by one', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    await saveHand(createValidHandData());

    expect(await getHandCount('guest')).toBe(2);
    await deleteHand(handId);
    expect(await getHandCount('guest')).toBe(1);
  });

  it('does not throw when deleting a nonexistent handId', async () => {
    await initDB();
    await expect(deleteHand(99999)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clearAllHands
// ---------------------------------------------------------------------------

describe('clearAllHands', () => {
  it('removes all hands for the specified user', async () => {
    await initDB();
    await saveHand(createValidHandData());
    await saveHand(createValidHandData());
    await saveHand(createValidHandData());

    await clearAllHands('guest');

    expect(await getHandCount('guest')).toBe(0);
  });

  it('does not remove hands belonging to a different user', async () => {
    await initDB();
    await saveHand(createValidHandData(), 'guest');
    await saveHand(createValidHandData(), 'other-user');

    await clearAllHands('guest');

    expect(await getHandCount('guest')).toBe(0);
    expect(await getHandCount('other-user')).toBe(1);
  });

  it('resolves without error when there are no hands to clear', async () => {
    await initDB();
    await expect(clearAllHands('guest')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getHandCount
// ---------------------------------------------------------------------------

describe('getHandCount', () => {
  it('returns 0 when no hands exist', async () => {
    await initDB();
    expect(await getHandCount('guest')).toBe(0);
  });

  it('returns the correct count after saving hands', async () => {
    await initDB();
    await saveHand(createValidHandData());
    await saveHand(createValidHandData());
    expect(await getHandCount('guest')).toBe(2);
  });

  it('counts only hands for the specified user', async () => {
    await initDB();
    await saveHand(createValidHandData(), 'guest');
    await saveHand(createValidHandData(), 'guest');
    await saveHand(createValidHandData(), 'other-user');

    expect(await getHandCount('guest')).toBe(2);
    expect(await getHandCount('other-user')).toBe(1);
  });

  it('reflects the count after deletion', async () => {
    await initDB();
    const id1 = await saveHand(createValidHandData());
    await saveHand(createValidHandData());

    await deleteHand(id1);
    expect(await getHandCount('guest')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// handExists
// ---------------------------------------------------------------------------

describe('handExists', () => {
  it('returns true for a hand that was saved', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    expect(await handExists(handId)).toBe(true);
  });

  it('returns false for a handId that does not exist', async () => {
    await initDB();
    expect(await handExists(99999)).toBe(false);
  });

  it('returns false after the hand has been deleted', async () => {
    await initDB();
    const handId = await saveHand(createValidHandData());
    await deleteHand(handId);
    expect(await handExists(handId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveOnlineHand
// ---------------------------------------------------------------------------

describe('saveOnlineHand', () => {
  it('saves the hand and returns a numeric handId', async () => {
    await initDB();
    const handId = await saveOnlineHand(createValidHandData(), null, 'guest');
    expect(typeof handId).toBe('number');
    expect(handId).toBeGreaterThan(0);
  });

  it('sets source to "ignition" on the saved record', async () => {
    await initDB();
    const handId = await saveOnlineHand(createValidHandData(), null, 'guest');
    const saved = await loadHandById(handId);
    expect(saved.source).toBe('ignition');
  });

  it('strips capturedAt from the saved record', async () => {
    await initDB();
    const handData = { ...createValidHandData(), capturedAt: '2026-01-01T00:00:00Z' };
    const handId = await saveOnlineHand(handData, null, 'guest');
    const saved = await loadHandById(handId);
    expect(saved.capturedAt).toBeUndefined();
  });

  it('preserves captureId on the saved record', async () => {
    await initDB();
    const handData = { ...createValidHandData(), captureId: 'cap-abc-123' };
    const handId = await saveOnlineHand(handData, null, 'guest');
    const saved = await loadHandById(handId);
    expect(saved.captureId).toBe('cap-abc-123');
  });

  it('deduplicates: returns -1 when the same captureId is saved twice', async () => {
    await initDB();

    // Insert a hand directly with a known sessionId so dedup lookup has a session to scan
    const db = await initDB();
    const tx = db.transaction('hands', 'readwrite');
    const store = tx.objectStore('hands');
    store.add({
      timestamp: Date.now(),
      version: '1.3.0',
      userId: 'guest',
      sessionId: 77,
      sessionHandNumber: 1,
      handDisplayId: 'S77-H1',
      source: 'ignition',
      captureId: 'cap-dup-001',
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 5 },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] },
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const handData = { ...createValidHandData(), captureId: 'cap-dup-001' };
    const result = await saveOnlineHand(handData, 77, 'guest');
    expect(result).toBe(-1);
  });

  it('saves two hands with different captureIds without deduplication', async () => {
    await initDB();
    const hand1 = { ...createValidHandData(), captureId: 'cap-unique-001' };
    const hand2 = { ...createValidHandData(), captureId: 'cap-unique-002' };

    const id1 = await saveOnlineHand(hand1, null, 'guest');
    const id2 = await saveOnlineHand(hand2, null, 'guest');

    expect(id1).toBeGreaterThan(0);
    expect(id2).toBeGreaterThan(0);
    expect(id1).not.toBe(id2);
  });

  it('uses handData.timestamp when provided', async () => {
    await initDB();
    const fixedTimestamp = 1700000000000;
    const handData = { ...createValidHandData(), timestamp: fixedTimestamp };
    const handId = await saveOnlineHand(handData, null, 'guest');
    const saved = await loadHandById(handId);
    expect(saved.timestamp).toBe(fixedTimestamp);
  });

  it('rejects when gameState is missing', async () => {
    await initDB();
    const bad = {
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] },
    };
    await expect(saveOnlineHand(bad, null, 'guest')).rejects.toThrow('Invalid online hand');
  });
});

// ---------------------------------------------------------------------------
// getHandsBySource
// ---------------------------------------------------------------------------

describe('getHandsBySource', () => {
  it('returns an empty array when no hands exist for the source', async () => {
    await initDB();
    const result = await getHandsBySource('ignition', 'guest');
    expect(result).toEqual([]);
  });

  it('returns only ignition hands when source is "ignition"', async () => {
    await initDB();

    // Save one online (ignition) hand
    await saveOnlineHand(createValidHandData(), null, 'guest');
    // Save one regular (live) hand — source field will be absent
    await saveHand(createValidHandData(), 'guest');

    const ignitionHands = await getHandsBySource('ignition', 'guest');
    expect(ignitionHands).toHaveLength(1);
    expect(ignitionHands[0].source).toBe('ignition');
  });

  it('returns multiple ignition hands when several exist', async () => {
    await initDB();
    await saveOnlineHand(createValidHandData(), null, 'guest');
    await saveOnlineHand(createValidHandData(), null, 'guest');
    await saveHand(createValidHandData(), 'guest');

    const result = await getHandsBySource('ignition', 'guest');
    expect(result).toHaveLength(2);
  });

  it('does not return hands from other users', async () => {
    await initDB();
    await saveOnlineHand(createValidHandData(), null, 'guest');
    await saveOnlineHand(createValidHandData(), null, 'other-user');

    const result = await getHandsBySource('ignition', 'guest');
    expect(result).toHaveLength(1);
  });

  it('returns an empty array when source does not match any hand', async () => {
    await initDB();
    await saveHand(createValidHandData(), 'guest');

    const result = await getHandsBySource('ignition', 'guest');
    expect(result).toEqual([]);
  });
});
