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

import { useEffect, useRef, useState, useCallback } from 'react';
import { initDB, saveHand, loadLatestHand, GUEST_USER_ID } from '../utils/persistence';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../reducers/playerReducer';
import { logger } from '../utils/errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBOUNCE_DELAY = 1500; // 1.5 seconds
const MODULE_NAME = 'usePersistence';

// Backward-compatible logging wrappers
const log = (...args) => logger.debug(MODULE_NAME, ...args);
const logError = (error) => logger.error(MODULE_NAME, error);

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
 * @param {Function} dispatchSession - Session state dispatcher (optional, for hand count)
 * @param {Function} dispatchPlayer - Player state dispatcher (optional, for seat assignments)
 * @param {string} userId - User ID for data isolation (defaults to 'guest')
 * @returns {Object} { isReady, saveNow, clearHistory, lastSavedAt }
 */
export const usePersistence = (gameState, cardState, playerState, dispatchGame, dispatchCard, dispatchSession = null, dispatchPlayer = null, userId = GUEST_USER_ID) => {
  // State
  const [isReady, setIsReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Refs
  const saveTimerRef = useRef(null);
  const isInitializedRef = useRef(false);

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

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new debounced save
    saveTimerRef.current = setTimeout(async () => {
      try {
        const handData = {
          gameState: {
            currentStreet: gameState.currentStreet,
            dealerButtonSeat: gameState.dealerButtonSeat,
            mySeat: gameState.mySeat,
            seatActions: gameState.seatActions,
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

        const handId = await saveHand(handData, userId);
        setLastSavedAt(new Date());
        log(`Auto-saved hand ${handId} for user ${userId}`);

        // Note: Hand count is NOT incremented here - it's only incremented
        // when explicitly calling nextHand() to advance to a new hand
      } catch (error) {
        logError('Auto-save failed:', error);
        // Fail silently - app continues working
      }
    }, DEBOUNCE_DELAY);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [gameState, cardState, playerState, isReady, userId]);

  // ==========================================================================
  // EXPORTED FUNCTIONS
  // ==========================================================================

  /**
   * Force immediate save (bypassing debounce)
   * Future use: manual save button
   */
  const saveNow = useCallback(async () => {
    if (!isReady) {
      log('Cannot save - persistence not ready');
      return;
    }

    try {
      // Clear pending timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      const handData = {
        gameState: {
          currentStreet: gameState.currentStreet,
          dealerButtonSeat: gameState.dealerButtonSeat,
          mySeat: gameState.mySeat,
          seatActions: gameState.seatActions,
          absentSeats: gameState.absentSeats
        },
        cardState: {
          communityCards: cardState.communityCards,
          holeCards: cardState.holeCards,
          holeCardsVisible: cardState.holeCardsVisible,
          allPlayerCards: cardState.allPlayerCards
        }
      };

      const handId = await saveHand(handData, userId);
      setLastSavedAt(new Date());
      log(`Manual save completed - hand ${handId} for user ${userId}`);

      // Note: Hand count is NOT incremented here - it's only incremented
      // when explicitly calling nextHand() to advance to a new hand
    } catch (error) {
      logError('Manual save failed:', error);
    }
  }, [gameState, cardState, isReady, userId]);

  /**
   * Clear all hand history for this user
   * Future use: "Clear History" button
   */
  const clearHistory = useCallback(async () => {
    if (!isReady) {
      log('Cannot clear - persistence not ready');
      return;
    }

    try {
      const { clearAllHands } = await import('../utils/persistence');
      await clearAllHands(userId);
      log(`Hand history cleared for user ${userId}`);
    } catch (error) {
      logError('Failed to clear history:', error);
    }
  }, [isReady, userId]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isReady,
    saveNow,
    clearHistory,
    lastSavedAt
  };
};
