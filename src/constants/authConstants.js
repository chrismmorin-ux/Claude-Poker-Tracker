/**
 * authConstants.js - Authentication-related constants
 *
 * Provides constants for Firebase Auth management including
 * action types, provider identifiers, and error message mappings.
 */

// =============================================================================
// AUTH ACTION TYPES
// =============================================================================

/**
 * Action types for authReducer
 */
export const AUTH_ACTIONS = {
  SET_USER: 'SET_USER',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_INITIALIZED: 'SET_INITIALIZED',
};

// =============================================================================
// AUTH PROVIDERS
// =============================================================================

/**
 * Firebase Auth provider identifiers
 * These match Firebase's providerId values
 */
export const AUTH_PROVIDERS = {
  EMAIL: 'password',
  GOOGLE: 'google.com',
};

// =============================================================================
// AUTH ERROR MESSAGES
// =============================================================================

/**
 * Firebase Auth error code to user-friendly message mapping
 * Keys are Firebase error codes, values are user-friendly messages
 */
export const AUTH_ERRORS = {
  // Email/Password errors
  'auth/email-already-in-use': 'This email is already registered',
  'auth/invalid-email': 'Invalid email address',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/invalid-credential': 'Invalid email or password',
  'auth/user-disabled': 'This account has been disabled',

  // Rate limiting
  'auth/too-many-requests': 'Too many attempts. Please try again later',

  // Network errors
  'auth/network-request-failed': 'Network error. Check your connection',

  // Google OAuth errors
  'auth/popup-closed-by-user': 'Sign-in was cancelled',
  'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups',
  'auth/cancelled-popup-request': 'Sign-in was cancelled',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method',

  // Password reset errors
  'auth/expired-action-code': 'This reset link has expired',
  'auth/invalid-action-code': 'This reset link is invalid',

  // Re-authentication errors
  'auth/requires-recent-login': 'Please sign in again to complete this action',

  // Generic fallback
  'auth/internal-error': 'An unexpected error occurred. Please try again',
};

/**
 * Get user-friendly error message from Firebase error code
 * @param {string} errorCode - Firebase error code (e.g., 'auth/email-already-in-use')
 * @returns {string} User-friendly error message
 */
export const getAuthErrorMessage = (errorCode) => {
  return AUTH_ERRORS[errorCode] || 'An unexpected error occurred. Please try again';
};

// =============================================================================
// AUTH STATE CONSTANTS
// =============================================================================

/**
 * Guest user identifier used in IndexedDB for data isolation
 */
export const GUEST_USER_ID = 'guest';

/**
 * Minimum password length required by Firebase
 */
export const MIN_PASSWORD_LENGTH = 6;
