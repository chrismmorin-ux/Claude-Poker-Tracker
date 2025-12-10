/**
 * IndexedDBStorage.test.js - Tests for IndexedDB storage implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexedDBStorage } from '../IndexedDBStorage';
import { IStorage } from '../IStorage';

// Mock the persistence module
vi.mock('../../utils/persistence', () => ({
  saveHand: vi.fn().mockResolvedValue(1),
  loadLatestHand: vi.fn().mockResolvedValue({ handId: 1 }),
  loadHandById: vi.fn().mockResolvedValue({ handId: 1 }),
  getAllHands: vi.fn().mockResolvedValue([]),
  getHandsBySessionId: vi.fn().mockResolvedValue([]),
  deleteHand: vi.fn().mockResolvedValue(undefined),
  clearAllHands: vi.fn().mockResolvedValue(undefined),
  getHandCount: vi.fn().mockResolvedValue(10),
  handExists: vi.fn().mockResolvedValue(true),
  createSession: vi.fn().mockResolvedValue(1),
  endSession: vi.fn().mockResolvedValue(undefined),
  getActiveSession: vi.fn().mockResolvedValue(null),
  setActiveSession: vi.fn().mockResolvedValue(undefined),
  clearActiveSession: vi.fn().mockResolvedValue(undefined),
  getAllSessions: vi.fn().mockResolvedValue([]),
  getSessionById: vi.fn().mockResolvedValue({ sessionId: 1 }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  updateSession: vi.fn().mockResolvedValue(undefined),
  getSessionHandCount: vi.fn().mockResolvedValue(5),
  createPlayer: vi.fn().mockResolvedValue(1),
  getAllPlayers: vi.fn().mockResolvedValue([]),
  getPlayerById: vi.fn().mockResolvedValue({ playerId: 1 }),
  updatePlayer: vi.fn().mockResolvedValue(undefined),
  deletePlayer: vi.fn().mockResolvedValue(undefined),
  getPlayerByName: vi.fn().mockResolvedValue(null),
  initDB: vi.fn().mockResolvedValue(undefined),
  GUEST_USER_ID: 'guest',
}));

describe('IndexedDBStorage', () => {
  let storage;
  let persistence;

  beforeEach(async () => {
    vi.clearAllMocks();
    storage = new IndexedDBStorage();
    persistence = await import('../../utils/persistence');
  });

  describe('constructor', () => {
    it('extends IStorage', () => {
      expect(storage).toBeInstanceOf(IStorage);
    });

    it('initializes with _initialized false', () => {
      expect(storage._initialized).toBe(false);
    });

    it('checks indexedDB availability', () => {
      // In test environment, indexedDB should be available (fake-indexeddb)
      expect(typeof storage._available).toBe('boolean');
    });
  });

  describe('hand operations', () => {
    it('saveHand delegates to persistence', async () => {
      const handData = { gameState: {}, cardState: {} };
      const result = await storage.saveHand(handData);

      expect(persistence.saveHand).toHaveBeenCalledWith(handData);
      expect(result).toBe(1);
    });

    it('loadLatestHand delegates to persistence', async () => {
      const result = await storage.loadLatestHand();

      expect(persistence.loadLatestHand).toHaveBeenCalled();
      expect(result).toEqual({ handId: 1 });
    });

    it('loadHandById delegates to persistence', async () => {
      const result = await storage.loadHandById(5);

      expect(persistence.loadHandById).toHaveBeenCalledWith(5);
      expect(result).toEqual({ handId: 1 });
    });

    it('getAllHands delegates to persistence', async () => {
      const result = await storage.getAllHands();

      expect(persistence.getAllHands).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('getHandsBySessionId delegates to persistence', async () => {
      const result = await storage.getHandsBySessionId(3);

      expect(persistence.getHandsBySessionId).toHaveBeenCalledWith(3);
      expect(result).toEqual([]);
    });

    it('deleteHand delegates to persistence', async () => {
      await storage.deleteHand(7);

      expect(persistence.deleteHand).toHaveBeenCalledWith(7);
    });

    it('clearAllHands delegates to persistence', async () => {
      await storage.clearAllHands();

      expect(persistence.clearAllHands).toHaveBeenCalled();
    });

    it('getHandCount delegates to persistence', async () => {
      const result = await storage.getHandCount();

      expect(persistence.getHandCount).toHaveBeenCalled();
      expect(result).toBe(10);
    });

    it('handExists delegates to persistence', async () => {
      const result = await storage.handExists(2);

      expect(persistence.handExists).toHaveBeenCalledWith(2);
      expect(result).toBe(true);
    });
  });

  describe('session operations', () => {
    it('createSession delegates to persistence', async () => {
      const sessionData = { venue: 'Test', gameType: 'ONE_TWO' };
      const result = await storage.createSession(sessionData);

      expect(persistence.createSession).toHaveBeenCalledWith(sessionData);
      expect(result).toBe(1);
    });

    it('createSession uses empty object as default', async () => {
      await storage.createSession();

      expect(persistence.createSession).toHaveBeenCalledWith({});
    });

    it('endSession delegates to persistence', async () => {
      await storage.endSession(5, 500);

      expect(persistence.endSession).toHaveBeenCalledWith(5, 500);
    });

    it('endSession uses null as default cashOut', async () => {
      await storage.endSession(5);

      expect(persistence.endSession).toHaveBeenCalledWith(5, null);
    });

    it('getActiveSession delegates to persistence', async () => {
      const result = await storage.getActiveSession();

      expect(persistence.getActiveSession).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('setActiveSession delegates to persistence', async () => {
      await storage.setActiveSession(3);

      expect(persistence.setActiveSession).toHaveBeenCalledWith(3);
    });

    it('clearActiveSession delegates to persistence', async () => {
      await storage.clearActiveSession();

      expect(persistence.clearActiveSession).toHaveBeenCalled();
    });

    it('getAllSessions delegates to persistence', async () => {
      const result = await storage.getAllSessions();

      expect(persistence.getAllSessions).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('getSessionById delegates to persistence', async () => {
      const result = await storage.getSessionById(4);

      expect(persistence.getSessionById).toHaveBeenCalledWith(4);
      expect(result).toEqual({ sessionId: 1 });
    });

    it('deleteSession delegates to persistence', async () => {
      await storage.deleteSession(6);

      expect(persistence.deleteSession).toHaveBeenCalledWith(6);
    });

    it('updateSession delegates to persistence', async () => {
      const updates = { venue: 'Updated' };
      await storage.updateSession(2, updates);

      expect(persistence.updateSession).toHaveBeenCalledWith(2, updates);
    });

    it('getSessionHandCount delegates to persistence', async () => {
      const result = await storage.getSessionHandCount(8);

      expect(persistence.getSessionHandCount).toHaveBeenCalledWith(8);
      expect(result).toBe(5);
    });
  });

  describe('player operations', () => {
    it('createPlayer delegates to persistence', async () => {
      const playerData = { name: 'Test Player' };
      const result = await storage.createPlayer(playerData);

      expect(persistence.createPlayer).toHaveBeenCalledWith(playerData);
      expect(result).toBe(1);
    });

    it('getAllPlayers delegates to persistence', async () => {
      const result = await storage.getAllPlayers();

      expect(persistence.getAllPlayers).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('getPlayerById delegates to persistence', async () => {
      const result = await storage.getPlayerById(9);

      expect(persistence.getPlayerById).toHaveBeenCalledWith(9);
      expect(result).toEqual({ playerId: 1 });
    });

    it('updatePlayer delegates to persistence', async () => {
      const updates = { name: 'New Name' };
      await storage.updatePlayer(3, updates);

      expect(persistence.updatePlayer).toHaveBeenCalledWith(3, updates);
    });

    it('deletePlayer delegates to persistence', async () => {
      await storage.deletePlayer(4);

      expect(persistence.deletePlayer).toHaveBeenCalledWith(4);
    });

    it('getPlayerByName delegates to persistence', async () => {
      const result = await storage.getPlayerByName('John');

      expect(persistence.getPlayerByName).toHaveBeenCalledWith('John');
      expect(result).toBeNull();
    });
  });

  describe('database operations', () => {
    it('initialize calls initDB', async () => {
      // Force _available to true for this test
      storage._available = true;
      storage._initialized = false;

      await storage.initialize();

      expect(persistence.initDB).toHaveBeenCalled();
      expect(storage._initialized).toBe(true);
    });

    it('initialize does nothing if already initialized', async () => {
      storage._initialized = true;

      await storage.initialize();

      expect(persistence.initDB).not.toHaveBeenCalled();
    });

    it('initialize throws if indexedDB not available', async () => {
      const unavailableStorage = new IndexedDBStorage();
      unavailableStorage._available = false;
      unavailableStorage._initialized = false;

      await expect(unavailableStorage.initialize()).rejects.toThrow(
        'IndexedDB is not available in this environment'
      );
    });

    it('isAvailable returns availability status', () => {
      storage._available = true;
      expect(storage.isAvailable()).toBe(true);

      storage._available = false;
      expect(storage.isAvailable()).toBe(false);
    });
  });
});
