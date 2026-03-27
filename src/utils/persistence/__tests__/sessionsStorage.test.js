/**
 * sessionsStorage.test.js - Tests for session CRUD operations
 *
 * Uses fake-indexeddb to test all session persistence functions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Mock the errorHandler to suppress logs
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

import {
  initDB,
  STORE_NAME,
  SESSIONS_STORE_NAME,
  ACTIVE_SESSION_STORE_NAME,
} from '../database';

import {
  createSession,
  endSession,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getAllSessions,
  getSessionById,
  deleteSession,
  updateSession,
  createSessionAtomic,
  endSessionAtomic,
  getSessionHandCount,
  getOrCreateOnlineSession,
} from '../sessionsStorage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a raw hand record directly to the hands store so that
 * getSessionHandCount has something to count.
 */
const insertHandForSession = async (db, sessionId, userId = 'guest') => {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.add({
    timestamp: Date.now(),
    sessionId,
    userId,
    gameState: { street: 'preflop' },
    actionSequence: [],
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('sessionsStorage', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    globalThis.window = { indexedDB: globalThis.indexedDB };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  describe('createSession', () => {
    it('returns a numeric sessionId', async () => {
      const sessionId = await createSession({}, 'guest');
      expect(typeof sessionId).toBe('number');
      expect(sessionId).toBeGreaterThan(0);
    });

    it('stores session with correct defaults when no data provided', async () => {
      const sessionId = await createSession({}, 'guest');
      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const record = await new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();

      expect(record.isActive).toBe(true);
      expect(record.endTime).toBeNull();
      expect(record.cashOut).toBeNull();
      expect(record.venue).toBe('Online');
      expect(record.gameType).toBe('1/2');
      expect(record.handCount).toBe(0);
      expect(record.userId).toBe('guest');
      expect(record.version).toBe('1.4.0');
    });

    it('respects provided session data fields', async () => {
      const sessionId = await createSession(
        { venue: 'Bicycle', gameType: '2/5', buyIn: 500, goal: 'test goal', notes: 'test notes' },
        'guest'
      );
      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const record = await new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();

      expect(record.venue).toBe('Bicycle');
      expect(record.gameType).toBe('2/5');
      expect(record.buyIn).toBe(500);
      expect(record.goal).toBe('test goal');
      expect(record.notes).toBe('test notes');
    });

    it('auto-increments sessionId for multiple sessions', async () => {
      const id1 = await createSession({}, 'guest');
      const id2 = await createSession({}, 'guest');
      expect(id2).toBeGreaterThan(id1);
    });

    it('uses guest as default userId', async () => {
      const sessionId = await createSession();
      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const record = await new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();

      expect(record.userId).toBe('guest');
    });

    it('stores rebuyTransactions as an empty array by default', async () => {
      const sessionId = await createSession({}, 'guest');
      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const record = await new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();

      expect(Array.isArray(record.rebuyTransactions)).toBe(true);
      expect(record.rebuyTransactions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // endSession
  // -------------------------------------------------------------------------

  describe('endSession', () => {
    it('sets endTime, isActive=false, and cashOut on the session', async () => {
      const before = Date.now();
      const sessionId = await createSession({}, 'guest');
      await endSession(sessionId, 800);
      const after = Date.now();

      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const record = await new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();

      expect(record.isActive).toBe(false);
      expect(record.cashOut).toBe(800);
      expect(record.endTime).toBeGreaterThanOrEqual(before);
      expect(record.endTime).toBeLessThanOrEqual(after);
    });

    it('accepts null cashOut', async () => {
      const sessionId = await createSession({}, 'guest');
      await endSession(sessionId, null);

      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const record = await new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();

      expect(record.cashOut).toBeNull();
    });

    it('defaults cashOut to null when not provided', async () => {
      const sessionId = await createSession({}, 'guest');
      await endSession(sessionId);

      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const record = await new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();

      expect(record.cashOut).toBeNull();
    });

    it('rejects with an error for a nonexistent sessionId', async () => {
      await expect(endSession(99999, 0)).rejects.toThrow('Session 99999 not found');
    });
  });

  // -------------------------------------------------------------------------
  // getActiveSession / setActiveSession / clearActiveSession
  // -------------------------------------------------------------------------

  describe('getActiveSession / setActiveSession / clearActiveSession', () => {
    it('returns null when no active session exists', async () => {
      const result = await getActiveSession('guest');
      expect(result).toBeNull();
    });

    it('set then get returns correct sessionId', async () => {
      await setActiveSession(42, 'guest');
      const result = await getActiveSession('guest');
      expect(result).toEqual({ sessionId: 42 });
    });

    it('overwriting set replaces the previous active session', async () => {
      await setActiveSession(1, 'guest');
      await setActiveSession(2, 'guest');
      const result = await getActiveSession('guest');
      expect(result).toEqual({ sessionId: 2 });
    });

    it('clearActiveSession removes the active marker', async () => {
      await setActiveSession(42, 'guest');
      await clearActiveSession('guest');
      const result = await getActiveSession('guest');
      expect(result).toBeNull();
    });

    it('clearActiveSession is idempotent when nothing is set', async () => {
      await expect(clearActiveSession('guest')).resolves.toBeUndefined();
      const result = await getActiveSession('guest');
      expect(result).toBeNull();
    });

    it('uses per-user keys so different users have independent active sessions', async () => {
      await setActiveSession(10, 'user_a');
      await setActiveSession(20, 'user_b');

      const a = await getActiveSession('user_a');
      const b = await getActiveSession('user_b');

      expect(a).toEqual({ sessionId: 10 });
      expect(b).toEqual({ sessionId: 20 });
    });

    it('clearing one user active session does not affect another', async () => {
      await setActiveSession(10, 'user_a');
      await setActiveSession(20, 'user_b');
      await clearActiveSession('user_a');

      const a = await getActiveSession('user_a');
      const b = await getActiveSession('user_b');

      expect(a).toBeNull();
      expect(b).toEqual({ sessionId: 20 });
    });
  });

  // -------------------------------------------------------------------------
  // getAllSessions
  // -------------------------------------------------------------------------

  describe('getAllSessions', () => {
    it('returns an empty array when no sessions exist', async () => {
      const sessions = await getAllSessions('guest');
      expect(sessions).toEqual([]);
    });

    it('returns sessions for the requested userId', async () => {
      await createSession({ venue: 'CardRoom' }, 'guest');
      await createSession({ venue: 'Home' }, 'guest');

      const sessions = await getAllSessions('guest');
      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.userId === 'guest')).toBe(true);
    });

    it('filters by userId — does not return other users sessions', async () => {
      await createSession({}, 'user_a');
      await createSession({}, 'user_b');

      const sessions = await getAllSessions('user_a');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe('user_a');
    });

    it('returns all sessions when multiple exist for the same user', async () => {
      await createSession({ venue: 'A' }, 'guest');
      await createSession({ venue: 'B' }, 'guest');
      await createSession({ venue: 'C' }, 'guest');

      const sessions = await getAllSessions('guest');
      expect(sessions).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // getSessionById
  // -------------------------------------------------------------------------

  describe('getSessionById', () => {
    it('returns the session record for a valid id', async () => {
      const sessionId = await createSession({ venue: 'Aria' }, 'guest');
      const session = await getSessionById(sessionId);

      expect(session).not.toBeNull();
      expect(session.sessionId).toBe(sessionId);
      expect(session.venue).toBe('Aria');
    });

    it('returns null for a nonexistent id', async () => {
      const session = await getSessionById(99999);
      expect(session).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // deleteSession
  // -------------------------------------------------------------------------

  describe('deleteSession', () => {
    it('removes the session from the store', async () => {
      const sessionId = await createSession({}, 'guest');
      await deleteSession(sessionId);
      const session = await getSessionById(sessionId);
      expect(session).toBeNull();
    });

    it('resolves without error when deleting a nonexistent id', async () => {
      await expect(deleteSession(99999)).resolves.toBeUndefined();
    });

    it('does not affect other sessions', async () => {
      const id1 = await createSession({ venue: 'A' }, 'guest');
      const id2 = await createSession({ venue: 'B' }, 'guest');
      await deleteSession(id1);

      const remaining = await getSessionById(id2);
      expect(remaining).not.toBeNull();
      expect(remaining.venue).toBe('B');
    });
  });

  // -------------------------------------------------------------------------
  // updateSession
  // -------------------------------------------------------------------------

  describe('updateSession', () => {
    it('merges provided fields into the existing session', async () => {
      const sessionId = await createSession({ venue: 'Initial', notes: null }, 'guest');
      await updateSession(sessionId, { venue: 'Updated', notes: 'some note' });

      const session = await getSessionById(sessionId);
      expect(session.venue).toBe('Updated');
      expect(session.notes).toBe('some note');
    });

    it('preserves fields not included in the update', async () => {
      const sessionId = await createSession({ venue: 'Preserve', buyIn: 300 }, 'guest');
      await updateSession(sessionId, { notes: 'added' });

      const session = await getSessionById(sessionId);
      expect(session.venue).toBe('Preserve');
      expect(session.buyIn).toBe(300);
      expect(session.notes).toBe('added');
    });

    it('can update handCount', async () => {
      const sessionId = await createSession({}, 'guest');
      await updateSession(sessionId, { handCount: 15 });

      const session = await getSessionById(sessionId);
      expect(session.handCount).toBe(15);
    });

    it('rejects with an error for a nonexistent sessionId', async () => {
      await expect(updateSession(99999, { notes: 'x' })).rejects.toThrow(
        'Session 99999 not found'
      );
    });
  });

  // -------------------------------------------------------------------------
  // createSessionAtomic
  // -------------------------------------------------------------------------

  describe('createSessionAtomic', () => {
    it('returns a numeric sessionId', async () => {
      const sessionId = await createSessionAtomic({}, 'guest');
      expect(typeof sessionId).toBe('number');
      expect(sessionId).toBeGreaterThan(0);
    });

    it('creates the session record in the sessions store', async () => {
      const sessionId = await createSessionAtomic({ venue: 'Atomic' }, 'guest');
      const session = await getSessionById(sessionId);

      expect(session).not.toBeNull();
      expect(session.venue).toBe('Atomic');
      expect(session.isActive).toBe(true);
    });

    it('sets the active session marker in the activeSession store', async () => {
      const sessionId = await createSessionAtomic({}, 'guest');
      const active = await getActiveSession('guest');
      expect(active).toEqual({ sessionId });
    });

    it('active session and session record are consistent', async () => {
      const sessionId = await createSessionAtomic({ venue: 'Bellagio' }, 'guest');
      const active = await getActiveSession('guest');
      const session = await getSessionById(active.sessionId);

      expect(session.sessionId).toBe(sessionId);
      expect(session.venue).toBe('Bellagio');
    });

    it('uses guest as default userId', async () => {
      const sessionId = await createSessionAtomic();
      const session = await getSessionById(sessionId);
      expect(session.userId).toBe('guest');
    });
  });

  // -------------------------------------------------------------------------
  // endSessionAtomic
  // -------------------------------------------------------------------------

  describe('endSessionAtomic', () => {
    it('marks session as ended and clears the active marker together', async () => {
      const sessionId = await createSessionAtomic({}, 'guest');
      await endSessionAtomic(sessionId, 600, 'guest');

      const session = await getSessionById(sessionId);
      const active = await getActiveSession('guest');

      expect(session.isActive).toBe(false);
      expect(session.cashOut).toBe(600);
      expect(session.endTime).toBeGreaterThan(0);
      expect(active).toBeNull();
    });

    it('sets endTime to a recent timestamp', async () => {
      const before = Date.now();
      const sessionId = await createSessionAtomic({}, 'guest');
      await endSessionAtomic(sessionId, null, 'guest');
      const after = Date.now();

      const session = await getSessionById(sessionId);
      expect(session.endTime).toBeGreaterThanOrEqual(before);
      expect(session.endTime).toBeLessThanOrEqual(after);
    });

    it('accepts null cashOut', async () => {
      const sessionId = await createSessionAtomic({}, 'guest');
      await endSessionAtomic(sessionId, null, 'guest');

      const session = await getSessionById(sessionId);
      expect(session.cashOut).toBeNull();
    });

    it('rejects with an error for a nonexistent sessionId', async () => {
      await expect(endSessionAtomic(99999, 0, 'guest')).rejects.toThrow(
        'Session 99999 not found'
      );
    });

    it('does not clear another users active session', async () => {
      const idA = await createSessionAtomic({}, 'user_a');
      await setActiveSession(idA, 'user_a');
      const idB = await createSessionAtomic({}, 'user_b');
      await setActiveSession(idB, 'user_b');

      await endSessionAtomic(idA, 0, 'user_a');

      const activeB = await getActiveSession('user_b');
      expect(activeB).toEqual({ sessionId: idB });
    });
  });

  // -------------------------------------------------------------------------
  // getSessionHandCount
  // -------------------------------------------------------------------------

  describe('getSessionHandCount', () => {
    it('returns 0 when no hands exist for the session', async () => {
      const sessionId = await createSession({}, 'guest');
      const count = await getSessionHandCount(sessionId);
      expect(count).toBe(0);
    });

    it('returns the correct count after hands are inserted', async () => {
      const sessionId = await createSession({}, 'guest');
      const db = await initDB();
      await insertHandForSession(db, sessionId);
      await insertHandForSession(db, sessionId);
      await insertHandForSession(db, sessionId);
      db.close();

      const count = await getSessionHandCount(sessionId);
      expect(count).toBe(3);
    });

    it('counts only hands for the specified session', async () => {
      const id1 = await createSession({}, 'guest');
      const id2 = await createSession({}, 'guest');
      const db = await initDB();
      await insertHandForSession(db, id1);
      await insertHandForSession(db, id1);
      await insertHandForSession(db, id2);
      db.close();

      const count1 = await getSessionHandCount(id1);
      const count2 = await getSessionHandCount(id2);

      expect(count1).toBe(2);
      expect(count2).toBe(1);
    });

    it('returns 0 for a nonexistent sessionId', async () => {
      const count = await getSessionHandCount(99999);
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getOrCreateOnlineSession
  // -------------------------------------------------------------------------

  describe('getOrCreateOnlineSession', () => {
    it('creates a new session for a new tableId and returns a numeric id', async () => {
      const sessionId = await getOrCreateOnlineSession('table-abc', 'guest');
      expect(typeof sessionId).toBe('number');
      expect(sessionId).toBeGreaterThan(0);
    });

    it('created session has ignition source and correct tableId', async () => {
      const sessionId = await getOrCreateOnlineSession('table-xyz', 'guest');
      const session = await getSessionById(sessionId);

      expect(session.source).toBe('ignition');
      expect(session.tableId).toBe('table-xyz');
      expect(session.venue).toBe('Ignition');
      expect(session.gameType).toBe('NL Holdem');
    });

    it('created online session has isActive=false', async () => {
      const sessionId = await getOrCreateOnlineSession('table-001', 'guest');
      const session = await getSessionById(sessionId);
      expect(session.isActive).toBe(false);
    });

    it('returns a new session for different tableIds', async () => {
      const id1 = await getOrCreateOnlineSession('table-001', 'guest');
      const id2 = await getOrCreateOnlineSession('table-002', 'guest');
      expect(id1).not.toBe(id2);
    });

    it('stores correct userId on the created session', async () => {
      const sessionId = await getOrCreateOnlineSession('table-user', 'player_99');
      const session = await getSessionById(sessionId);
      expect(session.userId).toBe('player_99');
    });
  });
});
