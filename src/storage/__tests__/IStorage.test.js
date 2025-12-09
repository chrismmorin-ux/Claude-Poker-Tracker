/**
 * IStorage.test.js - Tests for storage interface
 */

import { describe, it, expect } from 'vitest';
import { IStorage } from '../IStorage';

describe('IStorage', () => {
  const storage = new IStorage();

  describe('hand operations', () => {
    it('throws on saveHand', async () => {
      await expect(storage.saveHand({})).rejects.toThrow('IStorage.saveHand() must be implemented');
    });

    it('throws on loadLatestHand', async () => {
      await expect(storage.loadLatestHand()).rejects.toThrow('IStorage.loadLatestHand() must be implemented');
    });

    it('throws on loadHandById', async () => {
      await expect(storage.loadHandById(1)).rejects.toThrow('IStorage.loadHandById() must be implemented');
    });

    it('throws on getAllHands', async () => {
      await expect(storage.getAllHands()).rejects.toThrow('IStorage.getAllHands() must be implemented');
    });

    it('throws on getHandsBySessionId', async () => {
      await expect(storage.getHandsBySessionId(1)).rejects.toThrow('IStorage.getHandsBySessionId() must be implemented');
    });

    it('throws on deleteHand', async () => {
      await expect(storage.deleteHand(1)).rejects.toThrow('IStorage.deleteHand() must be implemented');
    });

    it('throws on clearAllHands', async () => {
      await expect(storage.clearAllHands()).rejects.toThrow('IStorage.clearAllHands() must be implemented');
    });

    it('throws on getHandCount', async () => {
      await expect(storage.getHandCount()).rejects.toThrow('IStorage.getHandCount() must be implemented');
    });

    it('throws on handExists', async () => {
      await expect(storage.handExists(1)).rejects.toThrow('IStorage.handExists() must be implemented');
    });
  });

  describe('session operations', () => {
    it('throws on createSession', async () => {
      await expect(storage.createSession({})).rejects.toThrow('IStorage.createSession() must be implemented');
    });

    it('throws on endSession', async () => {
      await expect(storage.endSession(1, 500)).rejects.toThrow('IStorage.endSession() must be implemented');
    });

    it('throws on getActiveSession', async () => {
      await expect(storage.getActiveSession()).rejects.toThrow('IStorage.getActiveSession() must be implemented');
    });

    it('throws on setActiveSession', async () => {
      await expect(storage.setActiveSession(1)).rejects.toThrow('IStorage.setActiveSession() must be implemented');
    });

    it('throws on clearActiveSession', async () => {
      await expect(storage.clearActiveSession()).rejects.toThrow('IStorage.clearActiveSession() must be implemented');
    });

    it('throws on getAllSessions', async () => {
      await expect(storage.getAllSessions()).rejects.toThrow('IStorage.getAllSessions() must be implemented');
    });

    it('throws on getSessionById', async () => {
      await expect(storage.getSessionById(1)).rejects.toThrow('IStorage.getSessionById() must be implemented');
    });

    it('throws on deleteSession', async () => {
      await expect(storage.deleteSession(1)).rejects.toThrow('IStorage.deleteSession() must be implemented');
    });

    it('throws on updateSession', async () => {
      await expect(storage.updateSession(1, {})).rejects.toThrow('IStorage.updateSession() must be implemented');
    });

    it('throws on getSessionHandCount', async () => {
      await expect(storage.getSessionHandCount(1)).rejects.toThrow('IStorage.getSessionHandCount() must be implemented');
    });
  });

  describe('player operations', () => {
    it('throws on createPlayer', async () => {
      await expect(storage.createPlayer({})).rejects.toThrow('IStorage.createPlayer() must be implemented');
    });

    it('throws on getAllPlayers', async () => {
      await expect(storage.getAllPlayers()).rejects.toThrow('IStorage.getAllPlayers() must be implemented');
    });

    it('throws on getPlayerById', async () => {
      await expect(storage.getPlayerById(1)).rejects.toThrow('IStorage.getPlayerById() must be implemented');
    });

    it('throws on updatePlayer', async () => {
      await expect(storage.updatePlayer(1, {})).rejects.toThrow('IStorage.updatePlayer() must be implemented');
    });

    it('throws on deletePlayer', async () => {
      await expect(storage.deletePlayer(1)).rejects.toThrow('IStorage.deletePlayer() must be implemented');
    });

    it('throws on getPlayerByName', async () => {
      await expect(storage.getPlayerByName('test')).rejects.toThrow('IStorage.getPlayerByName() must be implemented');
    });
  });

  describe('database operations', () => {
    it('throws on initialize', async () => {
      await expect(storage.initialize()).rejects.toThrow('IStorage.initialize() must be implemented');
    });

    it('throws on isAvailable', () => {
      expect(() => storage.isAvailable()).toThrow('IStorage.isAvailable() must be implemented');
    });
  });
});
