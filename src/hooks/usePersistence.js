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
import { initDB, saveHand, loadLatestHand } from '../utils/persistence';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { CARD_ACTIONS } from '../reducers/cardReducer';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBOUNCE_DELAY = 1500; // 1.5 seconds
const DEBUG = true;

// =============================================================================
// LOGGING
// =============================================================================

const log = (...args) => DEBUG && console.log('[usePersistence]', ...args);
const logError = (...args) => console.error('[usePersistence]', ...args);

// =============================================================================
// PERSISTENCE HOOK
// =============================================================================

/**
 * usePersistence - React hook for state persistence
 *
 * @param {Object} gameState - Game state from gameReducer
 * @param {Object} cardState - Card state from cardReducer
 * @param {Function} dispatchGame - Game state dispatcher
 * @param {Function} dispatchCard - Card state dispatcher
 * @returns {Object} { isReady, saveNow, clearHistory, lastSavedAt }
 */
export const usePersistence = (gameState, cardState, dispatchGame, dispatchCard) => {
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
      log('Initializing persistence...');

      try {
        // Initialize database
        await initDB();
        log('Database initialized');

        // Load latest hand
        const latestHand = await loadLatestHand();

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
  }, []); // Run once on mount

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
          }
        };

        const handId = await saveHand(handData);
        setLastSavedAt(new Date());
        log(`Auto-saved hand ${handId}`);
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
  }, [gameState, cardState, isReady]);

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

      const handId = await saveHand(handData);
      setLastSavedAt(new Date());
      log(`Manual save completed - hand ${handId}`);
    } catch (error) {
      logError('Manual save failed:', error);
    }
  }, [gameState, cardState, isReady]);

  /**
   * Clear all hand history
   * Future use: "Clear History" button
   */
  const clearHistory = useCallback(async () => {
    if (!isReady) {
      log('Cannot clear - persistence not ready');
      return;
    }

    try {
      const { clearAllHands } = await import('../utils/persistence');
      await clearAllHands();
      log('Hand history cleared');
    } catch (error) {
      logError('Failed to clear history:', error);
    }
  }, [isReady]);

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
