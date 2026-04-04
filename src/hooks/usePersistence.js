// Instantiated in: useAppState.js
/**
 * usePersistence.js - React hook for state persistence
 *
 * Integrates IndexedDB persistence with React state management.
 * Handles:
 * - Database initialization on mount
 * - Auto-restore latest hand on startup
 * - Debounced auto-save on state changes
 * - Hydration of reducer state from persisted data
 */

import { useEffect, useRef, useState } from 'react';
import { initDB, saveHand, loadLatestHand, GUEST_USER_ID, createPersistenceLogger } from '../utils/persistence/index';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../constants/playerConstants';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBOUNCE_DELAY = 1500; // 1.5 seconds

const { log, logError } = createPersistenceLogger('usePersistence');

// =============================================================================
// PERSISTENCE HOOK
// =============================================================================

/**
 * usePersistence - React hook for state persistence
 *
 * @param {Object} gameState - Game state from gameReducer
 * @param {Object} cardState - Card state from cardReducer
 * @param {Object} playerState - Player state from playerReducer
 * @param {Function} dispatchGame - Game state dispatcher
 * @param {Function} dispatchCard - Card state dispatcher
 * @param {Function} dispatchPlayer - Player state dispatcher (optional, for seat assignments)
 * @param {string} userId - User ID for data isolation (defaults to 'guest')
 * @returns {Object} { isReady, lastSavedAt }
 */
export const usePersistence = (gameState, cardState, playerState, dispatchGame, dispatchCard, dispatchPlayer = null, userId = GUEST_USER_ID) => {
  // State
  const [isReady, setIsReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Refs
  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastSnapshotRef = useRef(null);

  // ==========================================================================
  // INITIALIZATION (on mount)
  // ==========================================================================

  useEffect(() => {
    const initialize = async () => {
      log(`Initializing persistence for user ${userId}...`);

      try {
        // Initialize database
        await initDB();
        log('Database initialized');

        // Load latest hand for this user
        const latestHand = await loadLatestHand(userId);

        if (latestHand) {
          log(`Restoring hand ${latestHand.handId} from ${new Date(latestHand.timestamp).toLocaleString()}`);

          // Hydrate game state
          if (latestHand.gameState) {
            dispatchGame({
              type: GAME_ACTIONS.HYDRATE_STATE,
              payload: latestHand.gameState
            });
            log('Game state hydrated');
          }

          // Hydrate card state (only persistent fields)
          if (latestHand.cardState) {
            dispatchCard({
              type: CARD_ACTIONS.HYDRATE_STATE,
              payload: {
                communityCards: latestHand.cardState.communityCards,
                holeCards: latestHand.cardState.holeCards,
                holeCardsVisible: latestHand.cardState.holeCardsVisible,
                allPlayerCards: latestHand.cardState.allPlayerCards
              }
            });
            log('Card state hydrated');
          }

          // Hydrate player seat assignments
          if (latestHand.seatPlayers && dispatchPlayer) {
            dispatchPlayer({
              type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
              payload: { seatPlayers: latestHand.seatPlayers }
            });
            log('Player seat assignments hydrated');
          }
        } else {
          log('No previous hand found - starting fresh');
        }

        isInitializedRef.current = true;
        setIsReady(true);
        log('Persistence ready');
      } catch (error) {
        logError('Initialization failed:', error);
        // Continue without persistence
        isInitializedRef.current = true;
        setIsReady(true);
      }
    };

    initialize();
  }, [dispatchGame, dispatchCard, dispatchPlayer, userId]); // Re-initialize if userId changes

  // ==========================================================================
  // AUTO-SAVE (on state change)
  // ==========================================================================

  useEffect(() => {
    // Don't save during initialization or if not ready
    if (!isReady || !isInitializedRef.current) {
      return;
    }

    const handData = {
      gameState: {
        currentStreet: gameState.currentStreet,
        dealerButtonSeat: gameState.dealerButtonSeat,
        mySeat: gameState.mySeat,
        actionSequence: gameState.actionSequence,
        absentSeats: gameState.absentSeats
      },
      cardState: {
        communityCards: cardState.communityCards,
        holeCards: cardState.holeCards,
        holeCardsVisible: cardState.holeCardsVisible,
        allPlayerCards: cardState.allPlayerCards
      },
      seatPlayers: playerState.seatPlayers
    };

    // Skip save if data hasn't actually changed
    const snapshot = JSON.stringify(handData);
    if (snapshot === lastSnapshotRef.current) {
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Capture data for save closure
    pendingSaveRef.current = async () => {
      try {
        lastSnapshotRef.current = snapshot;
        const handId = await saveHand(handData, userId);
        setLastSavedAt(new Date());
        log(`Auto-saved hand ${handId} for user ${userId}`);
      } catch (error) {
        logError('Auto-save failed:', error);
      }
      pendingSaveRef.current = null;
    };

    // Set new debounced save
    saveTimerRef.current = setTimeout(() => {
      pendingSaveRef.current?.();
    }, DEBOUNCE_DELAY);

    // Cleanup: flush pending save on unmount or dependency change
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingSaveRef.current) {
        pendingSaveRef.current();
      }
    };
  }, [gameState, cardState, playerState, isReady, userId]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isReady,
    lastSavedAt
  };
};
