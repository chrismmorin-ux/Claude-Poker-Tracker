/**
 * database.test.js - Tests for IndexedDB initialization and migrations
 *
 * Uses fake-indexeddb to test database creation and upgrade paths.
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
  },
  DEBUG: false,
}));

import {
  initDB,
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  SESSIONS_STORE_NAME,
  ACTIVE_SESSION_STORE_NAME,
  PLAYERS_STORE_NAME,
  SETTINGS_STORE_NAME,
  RANGE_PROFILES_STORE_NAME,
} from '../database';

describe('database initialization', () => {
  beforeEach(() => {
    // Reset IndexedDB between tests
    globalThis.indexedDB = new IDBFactory();
    // initDB uses window.indexedDB
    globalThis.window = { indexedDB: globalThis.indexedDB };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  describe('initDB fresh database', () => {
    it('creates database at current version', async () => {
      const db = await initDB();
      expect(db).toBeTruthy();
      expect(db.name).toBe(DB_NAME);
      expect(db.version).toBe(DB_VERSION);
      db.close();
    });

    it('creates all 6 object stores', async () => {
      const db = await initDB();
      const storeNames = Array.from(db.objectStoreNames);

      expect(storeNames).toContain(STORE_NAME);
      expect(storeNames).toContain(SESSIONS_STORE_NAME);
      expect(storeNames).toContain(ACTIVE_SESSION_STORE_NAME);
      expect(storeNames).toContain(PLAYERS_STORE_NAME);
      expect(storeNames).toContain(SETTINGS_STORE_NAME);
      expect(storeNames).toContain(RANGE_PROFILES_STORE_NAME);
      expect(storeNames.length).toBe(6);
      db.close();
    });

    it('creates hands store with correct indexes', async () => {
      const db = await initDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      expect(store.keyPath).toBe('handId');
      expect(store.autoIncrement).toBe(true);
      expect(store.indexNames.contains('timestamp')).toBe(true);
      expect(store.indexNames.contains('sessionId')).toBe(true);
      expect(store.indexNames.contains('userId')).toBe(true);
      expect(store.indexNames.contains('userId_timestamp')).toBe(true);

      db.close();
    });

    it('creates sessions store with correct indexes', async () => {
      const db = await initDB();
      const tx = db.transaction(SESSIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);

      expect(store.keyPath).toBe('sessionId');
      expect(store.indexNames.contains('startTime')).toBe(true);
      expect(store.indexNames.contains('endTime')).toBe(true);
      expect(store.indexNames.contains('isActive')).toBe(true);
      expect(store.indexNames.contains('userId')).toBe(true);
      expect(store.indexNames.contains('userId_startTime')).toBe(true);

      db.close();
    });

    it('creates players store with correct indexes', async () => {
      const db = await initDB();
      const tx = db.transaction(PLAYERS_STORE_NAME, 'readonly');
      const store = tx.objectStore(PLAYERS_STORE_NAME);

      expect(store.keyPath).toBe('playerId');
      expect(store.indexNames.contains('name')).toBe(true);
      expect(store.indexNames.contains('createdAt')).toBe(true);
      expect(store.indexNames.contains('lastSeenAt')).toBe(true);
      expect(store.indexNames.contains('userId')).toBe(true);
      expect(store.indexNames.contains('userId_name')).toBe(true);

      db.close();
    });

    it('creates rangeProfiles store with correct indexes', async () => {
      const db = await initDB();
      const tx = db.transaction(RANGE_PROFILES_STORE_NAME, 'readonly');
      const store = tx.objectStore(RANGE_PROFILES_STORE_NAME);

      expect(store.keyPath).toBe('profileKey');
      expect(store.indexNames.contains('playerId')).toBe(true);
      expect(store.indexNames.contains('userId')).toBe(true);

      db.close();
    });
  });

  describe('error handling', () => {
    it('rejects when IndexedDB is not supported', async () => {
      globalThis.window = { indexedDB: null };

      await expect(initDB()).rejects.toThrow('IndexedDB not supported');
    });
  });

  describe('data operations after init', () => {
    it('can write and read from hands store', async () => {
      const db = await initDB();

      // Write
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const hand = {
        timestamp: Date.now(),
        sessionId: 1,
        userId: 'guest',
        actionSequence: [
          { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        ],
      };
      store.add(hand);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      // Read
      const readTx = db.transaction(STORE_NAME, 'readonly');
      const readStore = readTx.objectStore(STORE_NAME);
      const result = await new Promise((resolve, reject) => {
        const req = readStore.get(1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      expect(result.userId).toBe('guest');
      expect(result.actionSequence).toHaveLength(1);
      expect(result.handId).toBe(1);

      db.close();
    });

    it('can write and read from rangeProfiles store', async () => {
      const db = await initDB();

      const tx = db.transaction(RANGE_PROFILES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(RANGE_PROFILES_STORE_NAME);
      store.add({
        profileKey: 'player1_UTG',
        playerId: 1,
        userId: 'guest',
        ranges: {},
        handsProcessed: 10,
      });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      const readTx = db.transaction(RANGE_PROFILES_STORE_NAME, 'readonly');
      const readStore = readTx.objectStore(RANGE_PROFILES_STORE_NAME);
      const result = await new Promise((resolve, reject) => {
        const req = readStore.get('player1_UTG');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      expect(result.playerId).toBe(1);
      expect(result.handsProcessed).toBe(10);

      db.close();
    });
  });
});
