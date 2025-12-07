/**
 * usePlayerPersistence.js - React hook for player persistence
 *
 * Integrates IndexedDB player persistence with React state management.
 * Handles:
 * - Database initialization on mount
 * - Player CRUD operations
 * - Seat assignment (ephemeral - per hand)
 * - Player lookup and retrieval
 */

import { useEffect, useState, useCallback } from 'react';
import {
  createPlayer,
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer as dbDeletePlayer,
  getPlayerByName
} from '../utils/persistence';
import { PLAYER_ACTIONS } from '../constants/playerConstants';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBUG = true;

// =============================================================================
// LOGGING
// =============================================================================

const log = (...args) => DEBUG && console.log('[usePlayerPersistence]', ...args);
const logError = (...args) => console.error('[usePlayerPersistence]', ...args);

// =============================================================================
// PLAYER PERSISTENCE HOOK
// =============================================================================

/**
 * usePlayerPersistence - React hook for player persistence
 *
 * @param {Object} playerState - Player state from playerReducer
 * @param {Function} dispatchPlayer - Player state dispatcher
 * @returns {Object} { isReady, createNewPlayer, updatePlayerById, deletePlayerById, loadAllPlayers, assignPlayerToSeat, clearSeatAssignment, getSeatPlayerName }
 */
export const usePlayerPersistence = (playerState, dispatchPlayer) => {
  // State
  const [isReady, setIsReady] = useState(false);

  // ==========================================================================
  // INITIALIZATION (on mount)
  // ==========================================================================

  useEffect(() => {
    const initialize = async () => {
      log('Initializing player persistence...');

      try {
        // Load all players from database
        const players = await getAllPlayers();
        log(`Loaded ${players.length} players`);

        // Update state with all players
        dispatchPlayer({
          type: PLAYER_ACTIONS.LOAD_PLAYERS,
          payload: { players }
        });

        setIsReady(true);
        log('Player persistence ready');
      } catch (error) {
        logError('Initialization failed:', error);
        // Continue without player persistence
        setIsReady(true);
      }
    };

    initialize();
  }, []); // Run once on mount

  // ==========================================================================
  // PLAYER CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a new player
   * @param {Object} playerData - Player data (name, nickname, ethnicity, etc.)
   * @returns {Promise<number>} The new player ID
   */
  const createNewPlayer = useCallback(async (playerData) => {
    try {
      log('Creating new player...');

      // Validate name is unique
      if (playerData.name) {
        const existingPlayer = await getPlayerByName(playerData.name);
        if (existingPlayer) {
          throw new Error(`Player with name "${playerData.name}" already exists`);
        }
      }

      // Create player in database
      const playerId = await createPlayer(playerData);
      log(`Player ${playerId} created in database`);

      // Reload all players to update list
      await loadAllPlayers();

      log('New player created successfully');
      return playerId;
    } catch (error) {
      logError('Failed to create new player:', error);
      throw error;
    }
  }, []);

  /**
   * Update a player by ID
   * @param {number} playerId - Player ID to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  const updatePlayerById = useCallback(async (playerId, updates) => {
    try {
      log(`Updating player ${playerId}...`);

      // Validate name uniqueness if name is being updated
      if (updates.name) {
        const existingPlayer = await getPlayerByName(updates.name);
        if (existingPlayer && existingPlayer.playerId !== playerId) {
          throw new Error(`Player with name "${updates.name}" already exists`);
        }
      }

      // Update in database
      await updatePlayer(playerId, updates);
      log(`Player ${playerId} updated successfully`);

      // Reload all players to update list
      await loadAllPlayers();
    } catch (error) {
      logError(`Failed to update player ${playerId}:`, error);
      throw error;
    }
  }, []);

  /**
   * Delete a player by ID
   * @param {number} playerId - Player ID to delete
   * @returns {Promise<void>}
   */
  const deletePlayerById = useCallback(async (playerId) => {
    try {
      log(`Deleting player ${playerId}...`);

      await dbDeletePlayer(playerId);
      log(`Player ${playerId} deleted`);

      // Reload all players to update list
      await loadAllPlayers();
    } catch (error) {
      logError(`Failed to delete player ${playerId}:`, error);
      throw error;
    }
  }, []);

  /**
   * Load all players from database
   * @returns {Promise<Array>} Array of player records
   */
  const loadAllPlayers = useCallback(async () => {
    try {
      log('Loading all players...');

      const players = await getAllPlayers();
      log(`Loaded ${players.length} players`);

      // Update reducer state
      dispatchPlayer({
        type: PLAYER_ACTIONS.LOAD_PLAYERS,
        payload: { players }
      });

      return players;
    } catch (error) {
      logError('Failed to load players:', error);
      return [];
    }
  }, [dispatchPlayer]);

  // ==========================================================================
  // SEAT ASSIGNMENT OPERATIONS (Ephemeral - per hand)
  // ==========================================================================

  /**
   * Assign a player to a seat
   * @param {number} seat - Seat number (1-9)
   * @param {number} playerId - Player ID to assign
   * @returns {void}
   */
  const assignPlayerToSeat = useCallback((seat, playerId) => {
    log(`Assigning player ${playerId} to seat ${seat}`);

    dispatchPlayer({
      type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
      payload: { seat, playerId }
    });
  }, [dispatchPlayer]);

  /**
   * Clear player assignment from a seat
   * @param {number} seat - Seat number (1-9)
   * @returns {void}
   */
  const clearSeatAssignment = useCallback((seat) => {
    log(`Clearing player from seat ${seat}`);

    dispatchPlayer({
      type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
      payload: { seat }
    });
  }, [dispatchPlayer]);

  /**
   * Get the name of the player assigned to a seat
   * @param {number} seat - Seat number (1-9)
   * @returns {string|null} Player name or null if no player assigned
   */
  const getSeatPlayerName = useCallback((seat) => {
    const playerId = playerState.seatPlayers[seat];
    if (!playerId) return null;

    const player = playerState.allPlayers.find(p => p.playerId === playerId);
    return player ? player.name : null;
  }, [playerState.seatPlayers, playerState.allPlayers]);

  /**
   * Get all players sorted by lastSeenAt (most recent first)
   * @param {number} limit - Optional limit on number of players returned
   * @param {boolean} excludeAssigned - If true, exclude players already assigned to seats
   * @returns {Array} Array of players sorted by lastSeenAt
   */
  const getRecentPlayers = useCallback((limit = null, excludeAssigned = false) => {
    let players = [...playerState.allPlayers];

    // Filter out assigned players if requested
    if (excludeAssigned) {
      const assignedIds = new Set(Object.values(playerState.seatPlayers).filter(Boolean));
      players = players.filter(p => !assignedIds.has(p.playerId));
    }

    const sorted = players.sort((a, b) =>
      (b.lastSeenAt || 0) - (a.lastSeenAt || 0)
    );

    return limit ? sorted.slice(0, limit) : sorted;
  }, [playerState.allPlayers, playerState.seatPlayers]);

  /**
   * Get all assigned player IDs
   * @returns {Set} Set of player IDs that are currently assigned to seats
   */
  const getAssignedPlayerIds = useCallback(() => {
    return new Set(Object.values(playerState.seatPlayers).filter(Boolean));
  }, [playerState.seatPlayers]);

  /**
   * Check if a player is assigned to any seat
   * @param {number} playerId - Player ID to check
   * @returns {boolean} True if player is assigned to a seat
   */
  const isPlayerAssigned = useCallback((playerId) => {
    return Object.values(playerState.seatPlayers).includes(playerId);
  }, [playerState.seatPlayers]);

  /**
   * Get the seat number a player is assigned to
   * @param {number} playerId - Player ID to check
   * @returns {number|null} Seat number (1-9) or null if not assigned
   */
  const getPlayerSeat = useCallback((playerId) => {
    for (const [seat, assignedPlayerId] of Object.entries(playerState.seatPlayers)) {
      if (assignedPlayerId === playerId) {
        return parseInt(seat);
      }
    }
    return null;
  }, [playerState.seatPlayers]);

  /**
   * Clear all seat assignments
   */
  const clearAllSeatAssignments = useCallback(() => {
    dispatchPlayer({
      type: PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS
    });
  }, [dispatchPlayer]);

  // ==========================================================================
  // RETURN VALUES
  // ==========================================================================

  return {
    isReady,
    createNewPlayer,
    updatePlayerById,
    deletePlayerById,
    loadAllPlayers,
    assignPlayerToSeat,
    clearSeatAssignment,
    getSeatPlayerName,
    getRecentPlayers,
    getAssignedPlayerIds,
    isPlayerAssigned,
    getPlayerSeat,
    clearAllSeatAssignments
  };
};
