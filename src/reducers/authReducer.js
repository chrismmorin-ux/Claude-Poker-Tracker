/**
 * authReducer.js - Authentication state management
 *
 * Manages auth state including user, loading, initialized, and error states.
 * Follows the v108 reducer pattern used by gameReducer, settingsReducer, etc.
 */

import { AUTH_ACTIONS } from '../constants/authConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialAuthState = {
  // Current user object from Firebase (null = guest/not logged in)
  // Shape: { uid, email, displayName, photoURL, providerData } or null
  user: null,

  // Loading state (true during auth operations)
  isLoading: true,

  // Initialization state (false until first auth state check completes)
  isInitialized: false,

  // Error message (null when no error)
  error: null,
};

// =============================================================================
// STATE SCHEMA (for validation)
// =============================================================================

/**
 * Schema for auth state validation
 * Used by createValidatedReducer to catch state corruption
 */
export const AUTH_STATE_SCHEMA = {
  user: { type: 'object', required: false }, // Can be null
  isLoading: { type: 'boolean' },
  isInitialized: { type: 'boolean' },
  error: { type: 'string', required: false }, // Can be null
};

// =============================================================================
// RAW REDUCER
// =============================================================================

/**
 * Auth reducer (raw, wrapped with validation below)
 * Handles all authentication-related state changes
 */
const rawAuthReducer = (state, action) => {
  switch (action.type) {
    // Set current user (or null for guest)
    case AUTH_ACTIONS.SET_USER: {
      const user = action.payload.user;
      // Extract only serializable user properties
      const serializedUser = user
        ? {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            providerData: user.providerData?.map((provider) => ({
              providerId: provider.providerId,
              uid: provider.uid,
              displayName: provider.displayName,
              email: provider.email,
              photoURL: provider.photoURL,
            })),
          }
        : null;

      return {
        ...state,
        user: serializedUser,
        isLoading: false,
        isInitialized: true,
        error: null, // Clear any previous errors on successful auth
      };
    }

    // Set loading state
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    // Set error message
    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload.error,
        isLoading: false,
      };

    // Clear error
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    // Mark auth as initialized (after first auth state check)
    case AUTH_ACTIONS.SET_INITIALIZED:
      return {
        ...state,
        isInitialized: true,
        isLoading: false,
      };

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

/**
 * Auth reducer wrapped with validation
 * - Logs all actions in debug mode
 * - Validates state after each action
 * - Returns previous state on error (prevents corruption)
 */
export const authReducer = createValidatedReducer(
  rawAuthReducer,
  AUTH_STATE_SCHEMA,
  'authReducer'
);

// Export action types for convenience
export { AUTH_ACTIONS };
