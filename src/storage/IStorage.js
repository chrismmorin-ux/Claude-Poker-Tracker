/**
 * IStorage.js - Storage Interface Definition
 *
 * Defines the contract that any storage backend must implement.
 * This abstraction allows swapping between IndexedDB, cloud storage, or mock implementations.
 *
 * Usage:
 *   class MyStorage extends IStorage {
 *     async saveHand(handData) { ... }
 *     // ... implement all methods
 *   }
 */

/**
 * Abstract base class for storage implementations.
 * All methods throw if not implemented by subclass.
 */
export class IStorage {
  // ===========================================================================
  // HAND OPERATIONS
  // ===========================================================================

  /**
   * Save a hand to storage
   * @param {Object} handData - Hand data (gameState, cardState, seatPlayers)
   * @returns {Promise<number>} The generated handId
   */
  async saveHand(handData) {
    throw new Error('IStorage.saveHand() must be implemented');
  }

  /**
   * Load the most recent hand
   * @returns {Promise<Object|null>} Hand data or null if none exist
   */
  async loadLatestHand() {
    throw new Error('IStorage.loadLatestHand() must be implemented');
  }

  /**
   * Load a specific hand by ID
   * @param {number} handId - The hand ID
   * @returns {Promise<Object|null>} Hand data or null if not found
   */
  async loadHandById(handId) {
    throw new Error('IStorage.loadHandById() must be implemented');
  }

  /**
   * Load all hands
   * @returns {Promise<Array>} Array of all hand records
   */
  async getAllHands() {
    throw new Error('IStorage.getAllHands() must be implemented');
  }

  /**
   * Get all hands for a specific session
   * @param {number} sessionId - The session ID
   * @returns {Promise<Array>} Array of hand records for this session
   */
  async getHandsBySessionId(sessionId) {
    throw new Error('IStorage.getHandsBySessionId() must be implemented');
  }

  /**
   * Delete a specific hand
   * @param {number} handId - The hand ID to delete
   * @returns {Promise<void>}
   */
  async deleteHand(handId) {
    throw new Error('IStorage.deleteHand() must be implemented');
  }

  /**
   * Clear all hands
   * @returns {Promise<void>}
   */
  async clearAllHands() {
    throw new Error('IStorage.clearAllHands() must be implemented');
  }

  /**
   * Get the count of hands
   * @returns {Promise<number>} Number of hands
   */
  async getHandCount() {
    throw new Error('IStorage.getHandCount() must be implemented');
  }

  /**
   * Check if a hand exists
   * @param {number} handId - The hand ID
   * @returns {Promise<boolean>} True if hand exists
   */
  async handExists(handId) {
    throw new Error('IStorage.handExists() must be implemented');
  }

  // ===========================================================================
  // SESSION OPERATIONS
  // ===========================================================================

  /**
   * Create a new session
   * @param {Object} sessionData - Session data (venue, gameType, buyIn, etc.)
   * @returns {Promise<number>} The generated sessionId
   */
  async createSession(sessionData) {
    throw new Error('IStorage.createSession() must be implemented');
  }

  /**
   * End a session
   * @param {number} sessionId - The session ID
   * @param {number|null} cashOut - Optional cash out amount
   * @returns {Promise<void>}
   */
  async endSession(sessionId, cashOut) {
    throw new Error('IStorage.endSession() must be implemented');
  }

  /**
   * Get the currently active session
   * @returns {Promise<Object|null>} Active session data or null
   */
  async getActiveSession() {
    throw new Error('IStorage.getActiveSession() must be implemented');
  }

  /**
   * Set the active session
   * @param {number} sessionId - The session ID to make active
   * @returns {Promise<void>}
   */
  async setActiveSession(sessionId) {
    throw new Error('IStorage.setActiveSession() must be implemented');
  }

  /**
   * Clear the active session
   * @returns {Promise<void>}
   */
  async clearActiveSession() {
    throw new Error('IStorage.clearActiveSession() must be implemented');
  }

  /**
   * Get all sessions
   * @returns {Promise<Array>} Array of all session records
   */
  async getAllSessions() {
    throw new Error('IStorage.getAllSessions() must be implemented');
  }

  /**
   * Get a specific session by ID
   * @param {number} sessionId - The session ID
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async getSessionById(sessionId) {
    throw new Error('IStorage.getSessionById() must be implemented');
  }

  /**
   * Delete a specific session
   * @param {number} sessionId - The session ID to delete
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    throw new Error('IStorage.deleteSession() must be implemented');
  }

  /**
   * Update a session's fields
   * @param {number} sessionId - The session ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateSession(sessionId, updates) {
    throw new Error('IStorage.updateSession() must be implemented');
  }

  /**
   * Get the count of hands for a specific session
   * @param {number} sessionId - The session ID
   * @returns {Promise<number>} Number of hands in session
   */
  async getSessionHandCount(sessionId) {
    throw new Error('IStorage.getSessionHandCount() must be implemented');
  }

  // ===========================================================================
  // PLAYER OPERATIONS
  // ===========================================================================

  /**
   * Create a new player
   * @param {Object} playerData - Player data (name, nickname, etc.)
   * @returns {Promise<number>} The generated playerId
   */
  async createPlayer(playerData) {
    throw new Error('IStorage.createPlayer() must be implemented');
  }

  /**
   * Get all players
   * @returns {Promise<Array>} Array of all player records
   */
  async getAllPlayers() {
    throw new Error('IStorage.getAllPlayers() must be implemented');
  }

  /**
   * Get a specific player by ID
   * @param {number} playerId - The player ID
   * @returns {Promise<Object|null>} Player data or null if not found
   */
  async getPlayerById(playerId) {
    throw new Error('IStorage.getPlayerById() must be implemented');
  }

  /**
   * Update a player's fields
   * @param {number} playerId - The player ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updatePlayer(playerId, updates) {
    throw new Error('IStorage.updatePlayer() must be implemented');
  }

  /**
   * Delete a specific player
   * @param {number} playerId - The player ID to delete
   * @returns {Promise<void>}
   */
  async deletePlayer(playerId) {
    throw new Error('IStorage.deletePlayer() must be implemented');
  }

  /**
   * Get a player by name
   * @param {string} name - The player name
   * @returns {Promise<Object|null>} Player data or null if not found
   */
  async getPlayerByName(name) {
    throw new Error('IStorage.getPlayerByName() must be implemented');
  }

  // ===========================================================================
  // DATABASE OPERATIONS
  // ===========================================================================

  /**
   * Initialize the storage backend
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('IStorage.initialize() must be implemented');
  }

  /**
   * Check if storage is available/ready
   * @returns {boolean}
   */
  isAvailable() {
    throw new Error('IStorage.isAvailable() must be implemented');
  }
}

export default IStorage;
