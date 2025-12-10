/**
 * useAuthPersistence.js - React hook for Firebase auth state persistence
 *
 * Handles:
 * - Firebase onAuthStateChanged subscription
 * - Initial auth state check on mount
 * - Syncing Firebase auth state to React reducer
 * - Cleanup on unmount
 *
 * This hook bridges Firebase Auth with our React state management,
 * ensuring the app stays in sync with the user's auth status.
 */

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AUTH_ACTIONS } from '../constants/authConstants';
import { logger } from '../utils/errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODULE_NAME = 'useAuthPersistence';

// Backward-compatible logging wrappers
const log = (...args) => logger.debug(MODULE_NAME, ...args);
const logError = (error) => logger.error(MODULE_NAME, error);

// =============================================================================
// AUTH PERSISTENCE HOOK
// =============================================================================

/**
 * useAuthPersistence - React hook for Firebase auth state persistence
 *
 * Subscribes to Firebase auth state changes and updates the React reducer.
 * The first auth state callback determines if user is logged in or guest.
 *
 * @param {Function} dispatchAuth - Auth state dispatcher from authReducer
 * @returns {Object} { isReady } - Ready when first auth check completes
 */
export const useAuthPersistence = (dispatchAuth) => {
  // State
  const [isReady, setIsReady] = useState(false);

  // Refs
  const unsubscribeRef = useRef(null);
  const isFirstCheckRef = useRef(true);

  // ==========================================================================
  // AUTH STATE LISTENER (on mount)
  // ==========================================================================

  useEffect(() => {
    log('Initializing auth persistence...');

    // Subscribe to Firebase auth state changes
    unsubscribeRef.current = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        try {
          if (isFirstCheckRef.current) {
            log('First auth check complete', firebaseUser ? 'User logged in' : 'Guest mode');
            isFirstCheckRef.current = false;
          } else {
            log('Auth state changed', firebaseUser ? 'User logged in' : 'User logged out');
          }

          // Update auth state with user (or null for guest)
          dispatchAuth({
            type: AUTH_ACTIONS.SET_USER,
            payload: { user: firebaseUser },
          });

          // Mark as ready after first check
          setIsReady(true);
        } catch (error) {
          logError(error);
          // Even on error, mark as initialized to prevent app from hanging
          dispatchAuth({ type: AUTH_ACTIONS.SET_INITIALIZED });
          setIsReady(true);
        }
      },
      (error) => {
        // Auth state observer error
        logError(error);
        dispatchAuth({
          type: AUTH_ACTIONS.SET_ERROR,
          payload: { error: 'Failed to check authentication status' },
        });
        dispatchAuth({ type: AUTH_ACTIONS.SET_INITIALIZED });
        setIsReady(true);
      }
    );

    log('Auth state listener attached');

    // Cleanup: unsubscribe on unmount
    return () => {
      if (unsubscribeRef.current) {
        log('Cleaning up auth state listener');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [dispatchAuth]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isReady,
  };
};

export default useAuthPersistence;
