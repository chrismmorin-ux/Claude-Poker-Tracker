// Instantiated in: PlayerContext.jsx
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
  getPlayerByName,
  GUEST_USER_ID,
  createPersistenceLogger,
} from '../utils/persistence/index';
import { appendSighting } from '../utils/persistence/sightingLogsStore';
import { PLAYER_ACTIONS } from '../constants/playerConstants';
import { AppError, ERROR_CODES } from '../utils/errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

const { log, logError } = createPersistenceLogger('usePlayerPersistence');

// =============================================================================
// PLAYER PERSISTENCE HOOK
// =============================================================================

/**
 * usePlayerPersistence - React hook for player persistence
 *
 * @param {Object} playerState - Player state from playerReducer
 * @param {Function} dispatchPlayer - Player state dispatcher
 * @param {string} userId - User ID for data isolation (defaults to 'guest')
 * @returns {Object} { isReady, createNewPlayer, updatePlayerById, deletePlayerById, loadAllPlayers, assignPlayerToSeat, getRecentPlayers, isPlayerAssigned, getPlayerSeat }
 */
export const usePlayerPersistence = (playerState, dispatchPlayer, userId = GUEST_USER_ID) => {
  // State
  const [isReady, setIsReady] = useState(false);

  // ==========================================================================
  // INITIALIZATION (on mount)
  // ==========================================================================

  useEffect(() => {
    const initialize = async () => {
      log(`Initializing player persistence for user ${userId}...`);

      try {
        // Load all players from database for this user
        const players = await getAllPlayers(userId);
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
  }, [dispatchPlayer, userId]); // Re-initialize if userId changes

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
      log(`Creating new player for user ${userId}...`);

      // Validate name is unique for this user
      if (playerData.name) {
        const existingPlayer = await getPlayerByName(playerData.name, userId);
        if (existingPlayer) {
          throw new Error(`Player with name "${playerData.name}" already exists`);
        }
      }

      // Create player in database for this user
      const playerId = await createPlayer(playerData, userId);
      log(`Player ${playerId} created in database`);

      // Reload all players to update list
      await loadAllPlayers();

      log('New player created successfully');
      return playerId;
    } catch (error) {
      logError('Failed to create new player:', error);
      throw error;
    }
  }, [userId]);

  /**
   * Update a player by ID
   * @param {number} playerId - Player ID to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  const updatePlayerById = useCallback(async (playerId, updates) => {
    try {
      log(`Updating player ${playerId}...`);

      // Validate name uniqueness if name is being updated (for this user)
      if (updates.name) {
        const existingPlayer = await getPlayerByName(updates.name, userId);
        if (existingPlayer && existingPlayer.playerId !== playerId) {
          throw new Error(`Player with name "${updates.name}" already exists`);
        }
      }

      // Update in database
      await updatePlayer(playerId, updates, userId);
      log(`Player ${playerId} updated successfully`);

      // Reload all players to update list
      await loadAllPlayers();
    } catch (error) {
      logError(`Failed to update player ${playerId}:`, error);
      throw error;
    }
  }, [userId]);

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
   * Load all players from database for this user
   * @returns {Promise<Array>} Array of player records
   */
  const loadAllPlayers = useCallback(async () => {
    try {
      log(`Loading all players for user ${userId}...`);

      const players = await getAllPlayers(userId);
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
  }, [dispatchPlayer, userId]);

  // ==========================================================================
  // SEAT ASSIGNMENT OPERATIONS (Ephemeral - per hand)
  // ==========================================================================

  /**
   * Assign a player to a seat. Fires sighting + lastSeenAt persistence as
   * a side effect — seat assignment IS a sighting per PIO design (a player
   * the user recognizes well enough to seat is a player they observed).
   *
   * @param {number} seat - Seat number (1-9)
   * @param {number} playerId - Player ID to assign
   * @param {Object} [opts] - Optional { sessionId, source }
   * @param {number|string|null} [opts.sessionId] - Session this sighting belongs to
   * @param {string} [opts.source] - 'seat-assignment' | 'picker' | 'undo' (default: 'seat-assignment')
   * @returns {void}
   */
  const assignPlayerToSeat = useCallback((seat, playerId, opts = {}) => {
    log(`Assigning player ${playerId} to seat ${seat}`);

    dispatchPlayer({
      type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
      payload: { seat, playerId }
    });

    if (playerId == null) return;
    const sessionId = opts.sessionId ?? null;
    const source = opts.source || 'seat-assignment';
    const now = Date.now();

    // Phase 6 (PIO G4 v2 §11 / §10): snapshot the player's volatile
    // attributes into the sighting record. Volatile = "what they're
    // wearing today" (headwear, top color, jewelry visible). These move
    // OFF the canonical Player record's identity surface and onto the
    // sighting record where they belong (per-session, not per-identity).
    const playerSnapshot = playerState.allPlayers.find((p) => p.playerId === playerId);
    const attributes = {};
    const featuresSeen = [];
    if (playerSnapshot) {
      // Stable identity attributes (also captured for the stability
      // calculation in PlayerProfileView). These come from the player
      // record at sighting time but won't change between sightings unless
      // the user edits them.
      if (playerSnapshot.ageDecade) {
        attributes.ageDecade = playerSnapshot.ageDecade;
        featuresSeen.push('ageDecade');
      }
      if (Array.isArray(playerSnapshot.ethnicityTags) && playerSnapshot.ethnicityTags.length > 0) {
        attributes.ethnicityTags = [...playerSnapshot.ethnicityTags];
        featuresSeen.push('ethnicity');
      }
      // Volatile per-session attributes (Phase 6 — captured here, displayed
      // in SightingHistorySection per-row).
      if (playerSnapshot.headwear) {
        attributes.headwear = playerSnapshot.headwear;
        featuresSeen.push('headwear');
      }
      if (Array.isArray(playerSnapshot.wardrobe) && playerSnapshot.wardrobe.length > 0) {
        attributes.wardrobe = [...playerSnapshot.wardrobe];
        featuresSeen.push('wardrobe');
      }
      if (Array.isArray(playerSnapshot.jewelry) && playerSnapshot.jewelry.length > 0) {
        attributes.jewelry = [...playerSnapshot.jewelry];
        featuresSeen.push('jewelry');
      }
      if (Array.isArray(playerSnapshot.logo) && playerSnapshot.logo.length > 0) {
        attributes.logo = [...playerSnapshot.logo];
        featuresSeen.push('logo');
      }
    }

    // Fire-and-forget — the dispatch above is the user-visible effect; the
    // sighting/lastSeenAt writes are bookkeeping that shouldn't block UI
    // or fail loudly. Errors are logged but not surfaced.
    appendSighting({
      playerId,
      sessionId,
      capturedAt: now,
      venueId: null,
      featuresSeen,
      attributes,
      source,
      seat,
    }).catch((err) => logError('Failed to append sighting on seat assignment:', err));

    updatePlayer(playerId, { lastSeenAt: now }, userId)
      .catch((err) => logError('Failed to bump lastSeenAt on seat assignment:', err));
  }, [dispatchPlayer, playerState.allPlayers, userId]);

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
    getRecentPlayers,
    isPlayerAssigned,
    getPlayerSeat,
  };
};
