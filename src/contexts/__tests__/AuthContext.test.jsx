/**
 * AuthContext.test.jsx - Tests for authentication state context provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { AUTH_ACTIONS, GUEST_USER_ID, AUTH_PROVIDERS } from '../../constants/authConstants';
import { initialAuthState } from '../../reducers/authReducer';

// Mock Firebase auth module
vi.mock('../../config/firebase', () => ({
  auth: {
    currentUser: null,
  },
  googleProvider: {},
}));

// Mock Firebase auth functions
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updatePassword: vi.fn(),
  deleteUser: vi.fn(),
  EmailAuthProvider: {
    credential: vi.fn(),
  },
  reauthenticateWithCredential: vi.fn(),
  linkWithPopup: vi.fn(),
  unlink: vi.fn(),
}));

// Helper to create a wrapper with AuthProvider
const createWrapper = (authState, dispatchAuth = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <AuthProvider authState={authState} dispatchAuth={dispatchAuth}>
      {children}
    </AuthProvider>
  );
  return Wrapper;
};

// Default auth state for testing
const createDefaultAuthState = (overrides = {}) => ({
  user: null,
  isLoading: false,
  isInitialized: true,
  error: null,
  ...overrides,
});

// Mock authenticated user
const createMockUser = (overrides = {}) => ({
  uid: 'user123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  emailVerified: true,
  providerData: [
    {
      providerId: 'password',
      uid: 'test@example.com',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: null,
    },
  ],
  ...overrides,
});

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAuth hook', () => {
    it('throws error when used outside of AuthProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('provides auth state values', () => {
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.user).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('provides dispatchAuth function', () => {
      const mockDispatch = vi.fn();
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState, mockDispatch),
      });

      expect(typeof result.current.dispatchAuth).toBe('function');

      result.current.dispatchAuth({ type: 'TEST_ACTION' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'TEST_ACTION' });
    });
  });

  describe('isGuest derived value', () => {
    it('returns true when user is null and initialized', () => {
      const authState = createDefaultAuthState({ user: null, isInitialized: true });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.isGuest).toBe(true);
    });

    it('returns false when user is not null', () => {
      const authState = createDefaultAuthState({ user: createMockUser(), isInitialized: true });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.isGuest).toBe(false);
    });

    it('returns false when not initialized', () => {
      const authState = createDefaultAuthState({ user: null, isInitialized: false });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.isGuest).toBe(false);
    });
  });

  describe('isAuthenticated derived value', () => {
    it('returns true when user is present', () => {
      const authState = createDefaultAuthState({ user: createMockUser() });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('returns false when user is null', () => {
      const authState = createDefaultAuthState({ user: null });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('userId derived value', () => {
    it('returns user uid when authenticated', () => {
      const authState = createDefaultAuthState({ user: createMockUser({ uid: 'abc123' }) });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.userId).toBe('abc123');
    });

    it('returns GUEST_USER_ID when not authenticated', () => {
      const authState = createDefaultAuthState({ user: null });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.userId).toBe(GUEST_USER_ID);
    });
  });

  describe('userProvider derived value', () => {
    it('returns primary provider when authenticated', () => {
      const authState = createDefaultAuthState({
        user: createMockUser({
          providerData: [{ providerId: 'google.com' }],
        }),
      });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.userProvider).toBe('google.com');
    });

    it('returns null when not authenticated', () => {
      const authState = createDefaultAuthState({ user: null });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.userProvider).toBe(null);
    });

    it('returns null when no provider data', () => {
      const authState = createDefaultAuthState({
        user: createMockUser({ providerData: [] }),
      });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.userProvider).toBe(null);
    });
  });

  describe('hasEmailProvider derived value', () => {
    it('returns true when email provider exists', () => {
      const authState = createDefaultAuthState({
        user: createMockUser({
          providerData: [{ providerId: AUTH_PROVIDERS.EMAIL }],
        }),
      });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.hasEmailProvider).toBe(true);
    });

    it('returns false when email provider does not exist', () => {
      const authState = createDefaultAuthState({
        user: createMockUser({
          providerData: [{ providerId: AUTH_PROVIDERS.GOOGLE }],
        }),
      });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.hasEmailProvider).toBe(false);
    });
  });

  describe('hasGoogleProvider derived value', () => {
    it('returns true when Google provider exists', () => {
      const authState = createDefaultAuthState({
        user: createMockUser({
          providerData: [{ providerId: AUTH_PROVIDERS.GOOGLE }],
        }),
      });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.hasGoogleProvider).toBe(true);
    });

    it('returns false when Google provider does not exist', () => {
      const authState = createDefaultAuthState({
        user: createMockUser({
          providerData: [{ providerId: AUTH_PROVIDERS.EMAIL }],
        }),
      });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(result.current.hasGoogleProvider).toBe(false);
    });
  });

  describe('clearError handler', () => {
    it('dispatches CLEAR_ERROR action', () => {
      const mockDispatch = vi.fn();
      const authState = createDefaultAuthState({ error: 'Some error' });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState, mockDispatch),
      });

      act(() => {
        result.current.clearError();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.CLEAR_ERROR,
      });
    });
  });

  describe('auth handler functions exist', () => {
    it('provides all auth handler functions', () => {
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState),
      });

      expect(typeof result.current.signInWithEmail).toBe('function');
      expect(typeof result.current.signUpWithEmail).toBe('function');
      expect(typeof result.current.signInWithGoogle).toBe('function');
      expect(typeof result.current.signOut).toBe('function');
      expect(typeof result.current.resetPassword).toBe('function');
      expect(typeof result.current.updatePassword).toBe('function');
      expect(typeof result.current.linkGoogleAccount).toBe('function');
      expect(typeof result.current.unlinkGoogleAccount).toBe('function');
      expect(typeof result.current.deleteAccount).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('signInWithEmail handler', () => {
    it('dispatches loading and clears error on call', async () => {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      signInWithEmailAndPassword.mockResolvedValueOnce({ user: createMockUser() });

      const mockDispatch = vi.fn();
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState, mockDispatch),
      });

      await act(async () => {
        await result.current.signInWithEmail('test@example.com', 'password123');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.CLEAR_ERROR,
      });
    });
  });

  describe('signUpWithEmail handler', () => {
    it('dispatches loading and clears error on call', async () => {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      createUserWithEmailAndPassword.mockResolvedValueOnce({ user: createMockUser() });

      const mockDispatch = vi.fn();
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState, mockDispatch),
      });

      await act(async () => {
        await result.current.signUpWithEmail('test@example.com', 'password123');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.CLEAR_ERROR,
      });
    });
  });

  describe('signInWithGoogle handler', () => {
    it('dispatches loading and clears error on call', async () => {
      const { signInWithPopup } = await import('firebase/auth');
      signInWithPopup.mockResolvedValueOnce({ user: createMockUser() });

      const mockDispatch = vi.fn();
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState, mockDispatch),
      });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
    });
  });

  describe('signOut handler', () => {
    it('dispatches loading on call', async () => {
      const { signOut } = await import('firebase/auth');
      signOut.mockResolvedValueOnce();

      const mockDispatch = vi.fn();
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState, mockDispatch),
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
    });
  });

  describe('resetPassword handler', () => {
    it('dispatches loading on call', async () => {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      sendPasswordResetEmail.mockResolvedValueOnce();

      const mockDispatch = vi.fn();
      const authState = createDefaultAuthState();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authState, mockDispatch),
      });

      await act(async () => {
        await result.current.resetPassword('test@example.com');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: AUTH_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
    });
  });
});
