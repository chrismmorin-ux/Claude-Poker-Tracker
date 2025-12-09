/**
 * IndexedDBStorage.js - IndexedDB Implementation of IStorage
 *
 * Wraps the existing persistence.js functions to implement the IStorage interface.
 * This is the default storage backend for the application.
 */

import { IStorage } from './IStorage';
import {
  // Hand operations
  saveHand,
  loadLatestHand,
  loadHandById,
  getAllHands,
  getHandsBySessionId,
  deleteHand,
  clearAllHands,
  getHandCount,
  handExists,
  // Session operations
  createSession,
  endSession,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getAllSessions,
  getSessionById,
  deleteSession,
  updateSession,
  getSessionHandCount,
  // Player operations
  createPlayer,
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
  getPlayerByName,
  // Database operations
  initDB,
} from '../utils/persistence';

/**
 * IndexedDB storage implementation.
 * Delegates all operations to the persistence.js utility functions.
 */
export class IndexedDBStorage extends IStorage {
  constructor() {
    super();
    this._initialized = false;
    this._available = typeof window !== 'undefined' && !!window.indexedDB;
  }

  // ===========================================================================
  // HAND OPERATIONS
  // ===========================================================================

  async saveHand(handData) {
    return saveHand(handData);
  }

  async loadLatestHand() {
    return loadLatestHand();
  }

  async loadHandById(handId) {
    return loadHandById(handId);
  }

  async getAllHands() {
    return getAllHands();
  }

  async getHandsBySessionId(sessionId) {
    return getHandsBySessionId(sessionId);
  }

  async deleteHand(handId) {
    return deleteHand(handId);
  }

  async clearAllHands() {
    return clearAllHands();
  }

  async getHandCount() {
    return getHandCount();
  }

  async handExists(handId) {
    return handExists(handId);
  }

  // ===========================================================================
  // SESSION OPERATIONS
  // ===========================================================================

  async createSession(sessionData = {}) {
    return createSession(sessionData);
  }

  async endSession(sessionId, cashOut = null) {
    return endSession(sessionId, cashOut);
  }

  async getActiveSession() {
    return getActiveSession();
  }

  async setActiveSession(sessionId) {
    return setActiveSession(sessionId);
  }

  async clearActiveSession() {
    return clearActiveSession();
  }

  async getAllSessions() {
    return getAllSessions();
  }

  async getSessionById(sessionId) {
    return getSessionById(sessionId);
  }

  async deleteSession(sessionId) {
    return deleteSession(sessionId);
  }

  async updateSession(sessionId, updates) {
    return updateSession(sessionId, updates);
  }

  async getSessionHandCount(sessionId) {
    return getSessionHandCount(sessionId);
  }

  // ===========================================================================
  // PLAYER OPERATIONS
  // ===========================================================================

  async createPlayer(playerData) {
    return createPlayer(playerData);
  }

  async getAllPlayers() {
    return getAllPlayers();
  }

  async getPlayerById(playerId) {
    return getPlayerById(playerId);
  }

  async updatePlayer(playerId, updates) {
    return updatePlayer(playerId, updates);
  }

  async deletePlayer(playerId) {
    return deletePlayer(playerId);
  }

  async getPlayerByName(name) {
    return getPlayerByName(name);
  }

  // ===========================================================================
  // DATABASE OPERATIONS
  // ===========================================================================

  async initialize() {
    if (this._initialized) {
      return;
    }

    if (!this._available) {
      throw new Error('IndexedDB is not available in this environment');
    }

    // Initialize the database (creates stores if needed)
    await initDB();
    this._initialized = true;
  }

  isAvailable() {
    return this._available;
  }
}

// Export singleton instance for convenience
export const indexedDBStorage = new IndexedDBStorage();

export default IndexedDBStorage;
