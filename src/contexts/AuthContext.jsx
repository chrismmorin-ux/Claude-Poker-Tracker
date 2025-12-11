/**
 * AuthContext.jsx - Authentication state context provider
 *
 * Provides: user, isLoading, isInitialized, error
 * Plus derived values: isGuest, isAuthenticated, userId
 * Plus auth operations: signInWithEmail, signUpWithEmail, signInWithGoogle,
 *                       signOut, resetPassword, updatePassword, deleteAccount
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  updatePassword as firebaseUpdatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  linkWithPopup,
  unlink,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import {
  AUTH_ACTIONS,
  AUTH_PROVIDERS,
  GUEST_USER_ID,
  getAuthErrorMessage,
} from '../constants/authConstants';

// Create context
const AuthContext = createContext(null);

/**
 * Auth context provider component
 * Wraps children with auth state and operations
 */
export const AuthProvider = ({ authState, dispatchAuth, children }) => {
  const { user, isLoading, isInitialized, error } = authState;

  // Derived: Is user a guest (not logged in)?
  const isGuest = useMemo(() => {
    return user === null && isInitialized;
  }, [user, isInitialized]);

  // Derived: Is user authenticated?
  const isAuthenticated = useMemo(() => {
    return user !== null;
  }, [user]);

  // Derived: User ID (Firebase UID or 'guest')
  const userId = useMemo(() => {
    return user?.uid || GUEST_USER_ID;
  }, [user]);

  // Derived: User's primary auth provider
  const userProvider = useMemo(() => {
    if (!user || !user.providerData || user.providerData.length === 0) {
      return null;
    }
    // Return the first provider (primary)
    return user.providerData[0]?.providerId || null;
  }, [user]);

  // Derived: Does user have email/password provider?
  const hasEmailProvider = useMemo(() => {
    if (!user || !user.providerData) return false;
    return user.providerData.some((p) => p.providerId === AUTH_PROVIDERS.EMAIL);
  }, [user]);

  // Derived: Does user have Google provider?
  const hasGoogleProvider = useMemo(() => {
    if (!user || !user.providerData) return false;
    return user.providerData.some((p) => p.providerId === AUTH_PROVIDERS.GOOGLE);
  }, [user]);

  // Helper: Handle Firebase auth errors
  const handleAuthError = useCallback(
    (err) => {
      const errorMessage = getAuthErrorMessage(err.code);
      dispatchAuth({
        type: AUTH_ACTIONS.SET_ERROR,
        payload: { error: errorMessage },
      });
      return { success: false, error: errorMessage };
    },
    [dispatchAuth]
  );

  // Handler: Sign in with email and password
  const signInWithEmail = useCallback(
    async (email, password) => {
      dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
      dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // User state will be updated by onAuthStateChanged listener
        return { success: true, user: userCredential.user };
      } catch (err) {
        return handleAuthError(err);
      }
    },
    [dispatchAuth, handleAuthError]
  );

  // Handler: Sign up with email and password
  const signUpWithEmail = useCallback(
    async (email, password) => {
      dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
      dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // User state will be updated by onAuthStateChanged listener
        return { success: true, user: userCredential.user };
      } catch (err) {
        return handleAuthError(err);
      }
    },
    [dispatchAuth, handleAuthError]
  );

  // Handler: Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
    dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      // User state will be updated by onAuthStateChanged listener
      return { success: true, user: userCredential.user };
    } catch (err) {
      return handleAuthError(err);
    }
  }, [dispatchAuth, handleAuthError]);

  // Handler: Sign out
  const signOut = useCallback(async () => {
    dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });

    try {
      await firebaseSignOut(auth);
      // User state will be updated by onAuthStateChanged listener
      return { success: true };
    } catch (err) {
      return handleAuthError(err);
    }
  }, [dispatchAuth, handleAuthError]);

  // Handler: Send password reset email
  const resetPassword = useCallback(
    async (email) => {
      dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
      dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

      try {
        await sendPasswordResetEmail(auth, email);
        dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
        return { success: true };
      } catch (err) {
        return handleAuthError(err);
      }
    },
    [dispatchAuth, handleAuthError]
  );

  // Handler: Send email verification
  const sendVerificationEmail = useCallback(async () => {
    if (!user || user.emailVerified) {
      return { success: false, error: 'Email already verified or user not found' };
    }

    dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });

    try {
      await firebaseSendEmailVerification(user);
      dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
      return { success: true };
    } catch (err) {
      return handleAuthError(err);
    }
  }, [user, dispatchAuth, handleAuthError]);

  // Handler: Update password (requires recent login)
  const updatePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!auth.currentUser) {
        return { success: false, error: 'No user logged in' };
      }

      dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
      dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

      try {
        // Re-authenticate first (required for sensitive operations)
        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(auth.currentUser, credential);

        // Now update password
        await firebaseUpdatePassword(auth.currentUser, newPassword);
        dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
        return { success: true };
      } catch (err) {
        return handleAuthError(err);
      }
    },
    [dispatchAuth, handleAuthError]
  );

  // Handler: Link Google account to existing email/password account
  const linkGoogleAccount = useCallback(async () => {
    if (!auth.currentUser) {
      return { success: false, error: 'No user logged in' };
    }

    dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
    dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      await linkWithPopup(auth.currentUser, googleProvider);
      // Force refresh user to get updated providerData
      await auth.currentUser.reload();
      dispatchAuth({
        type: AUTH_ACTIONS.SET_USER,
        payload: { user: auth.currentUser },
      });
      return { success: true };
    } catch (err) {
      return handleAuthError(err);
    }
  }, [dispatchAuth, handleAuthError]);

  // Handler: Unlink Google account from current user
  const unlinkGoogleAccount = useCallback(async () => {
    if (!auth.currentUser) {
      return { success: false, error: 'No user logged in' };
    }

    // Don't allow unlinking if it's the only provider
    if (auth.currentUser.providerData.length <= 1) {
      const errorMsg = 'Cannot unlink your only sign-in method';
      dispatchAuth({
        type: AUTH_ACTIONS.SET_ERROR,
        payload: { error: errorMsg },
      });
      return { success: false, error: errorMsg };
    }

    dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
    dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      await unlink(auth.currentUser, AUTH_PROVIDERS.GOOGLE);
      // Force refresh user to get updated providerData
      await auth.currentUser.reload();
      dispatchAuth({
        type: AUTH_ACTIONS.SET_USER,
        payload: { user: auth.currentUser },
      });
      return { success: true };
    } catch (err) {
      return handleAuthError(err);
    }
  }, [dispatchAuth, handleAuthError]);

  // Handler: Delete account (requires recent login)
  const deleteAccount = useCallback(
    async (password) => {
      if (!auth.currentUser) {
        return { success: false, error: 'No user logged in' };
      }

      dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });
      dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });

      try {
        // Re-authenticate first if email provider and password provided
        if (password && hasEmailProvider) {
          const credential = EmailAuthProvider.credential(
            auth.currentUser.email,
            password
          );
          await reauthenticateWithCredential(auth.currentUser, credential);
        }

        // Delete the user
        await deleteUser(auth.currentUser);
        // User state will be updated by onAuthStateChanged listener
        return { success: true };
      } catch (err) {
        return handleAuthError(err);
      }
    },
    [dispatchAuth, handleAuthError, hasEmailProvider]
  );

  // Handler: Clear error
  const clearError = useCallback(() => {
    dispatchAuth({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, [dispatchAuth]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // State
      user,
      isLoading,
      isInitialized,
      error,
      // Derived
      isGuest,
      isAuthenticated,
      userId,
      userProvider,
      hasEmailProvider,
      hasGoogleProvider,
      // Dispatch
      dispatchAuth,
      // Handlers
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
      sendVerificationEmail,
      updatePassword,
      linkGoogleAccount,
      unlinkGoogleAccount,
      deleteAccount,
      clearError,
    }),
    [
      user,
      isLoading,
      isInitialized,
      error,
      isGuest,
      isAuthenticated,
      userId,
      userProvider,
      hasEmailProvider,
      hasGoogleProvider,
      dispatchAuth,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
      sendVerificationEmail,
      updatePassword,
      linkGoogleAccount,
      unlinkGoogleAccount,
      deleteAccount,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to access auth context
 * Throws if used outside of AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
