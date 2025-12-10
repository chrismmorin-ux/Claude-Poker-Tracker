/**
 * authReducer.test.js - Tests for authentication state reducer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  authReducer,
  AUTH_ACTIONS,
  initialAuthState,
  AUTH_STATE_SCHEMA,
} from '../authReducer';

describe('authReducer', () => {
  let state;

  beforeEach(() => {
    // Deep clone initial state to avoid mutation between tests
    state = JSON.parse(JSON.stringify(initialAuthState));
  });

  describe('initialAuthState', () => {
    it('has correct default values', () => {
      expect(initialAuthState.user).toBe(null);
      expect(initialAuthState.isLoading).toBe(true);
      expect(initialAuthState.isInitialized).toBe(false);
      expect(initialAuthState.error).toBe(null);
    });
  });

  describe('SET_USER', () => {
    it('sets user and marks as initialized', () => {
      const mockUser = {
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
      };

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_USER,
        payload: { user: mockUser },
      });

      expect(newState.user.uid).toBe('user123');
      expect(newState.user.email).toBe('test@example.com');
      expect(newState.user.displayName).toBe('Test User');
      expect(newState.isLoading).toBe(false);
      expect(newState.isInitialized).toBe(true);
      expect(newState.error).toBe(null);
    });

    it('sets user to null for guest', () => {
      state.user = { uid: 'existing', email: 'old@example.com' };

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_USER,
        payload: { user: null },
      });

      expect(newState.user).toBe(null);
      expect(newState.isInitialized).toBe(true);
    });

    it('clears previous error on successful auth', () => {
      state.error = 'Previous error';

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_USER,
        payload: {
          user: {
            uid: 'user123',
            email: 'test@example.com',
            providerData: [],
          },
        },
      });

      expect(newState.error).toBe(null);
    });

    it('serializes providerData correctly', () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
        providerData: [
          {
            providerId: 'google.com',
            uid: 'google-uid',
            displayName: 'Google User',
            email: 'test@gmail.com',
            photoURL: 'https://google.com/photo.jpg',
            extraField: 'should be excluded',
          },
          {
            providerId: 'password',
            uid: 'test@example.com',
            displayName: null,
            email: 'test@example.com',
            photoURL: null,
          },
        ],
      };

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_USER,
        payload: { user: mockUser },
      });

      expect(newState.user.providerData).toHaveLength(2);
      expect(newState.user.providerData[0].providerId).toBe('google.com');
      expect(newState.user.providerData[0].extraField).toBeUndefined();
      expect(newState.user.providerData[1].providerId).toBe('password');
    });

    it('handles user without providerData', () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
        providerData: undefined,
      };

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_USER,
        payload: { user: mockUser },
      });

      expect(newState.user.providerData).toBeUndefined();
    });
  });

  describe('SET_LOADING', () => {
    it('sets loading to true', () => {
      state.isLoading = false;

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });

      expect(newState.isLoading).toBe(true);
    });

    it('sets loading to false', () => {
      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_LOADING,
        payload: { isLoading: false },
      });

      expect(newState.isLoading).toBe(false);
    });
  });

  describe('SET_ERROR', () => {
    it('sets error message', () => {
      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_ERROR,
        payload: { error: 'Invalid email or password' },
      });

      expect(newState.error).toBe('Invalid email or password');
      expect(newState.isLoading).toBe(false);
    });

    it('sets loading to false when error occurs', () => {
      state.isLoading = true;

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_ERROR,
        payload: { error: 'Network error' },
      });

      expect(newState.isLoading).toBe(false);
    });
  });

  describe('CLEAR_ERROR', () => {
    it('clears error message', () => {
      state.error = 'Some error';

      const newState = authReducer(state, {
        type: AUTH_ACTIONS.CLEAR_ERROR,
      });

      expect(newState.error).toBe(null);
    });

    it('has no effect when error is already null', () => {
      const newState = authReducer(state, {
        type: AUTH_ACTIONS.CLEAR_ERROR,
      });

      expect(newState.error).toBe(null);
    });
  });

  describe('SET_INITIALIZED', () => {
    it('marks auth as initialized', () => {
      const newState = authReducer(state, {
        type: AUTH_ACTIONS.SET_INITIALIZED,
      });

      expect(newState.isInitialized).toBe(true);
      expect(newState.isLoading).toBe(false);
    });
  });

  describe('unknown action', () => {
    it('returns current state for unknown action', () => {
      const newState = authReducer(state, {
        type: 'UNKNOWN_ACTION',
      });

      expect(newState).toEqual(state);
    });
  });

  describe('AUTH_STATE_SCHEMA', () => {
    it('has expected shape', () => {
      expect(AUTH_STATE_SCHEMA.user.type).toBe('object');
      expect(AUTH_STATE_SCHEMA.user.required).toBe(false);
      expect(AUTH_STATE_SCHEMA.isLoading.type).toBe('boolean');
      expect(AUTH_STATE_SCHEMA.isInitialized.type).toBe('boolean');
      expect(AUTH_STATE_SCHEMA.error.type).toBe('string');
      expect(AUTH_STATE_SCHEMA.error.required).toBe(false);
    });
  });

  describe('state immutability', () => {
    it('does not mutate original state on SET_USER', () => {
      const originalState = { ...state };

      authReducer(state, {
        type: AUTH_ACTIONS.SET_USER,
        payload: {
          user: {
            uid: 'user123',
            email: 'test@example.com',
            providerData: [],
          },
        },
      });

      expect(state).toEqual(originalState);
    });

    it('does not mutate original state on SET_ERROR', () => {
      const originalState = { ...state };

      authReducer(state, {
        type: AUTH_ACTIONS.SET_ERROR,
        payload: { error: 'Error message' },
      });

      expect(state).toEqual(originalState);
    });
  });
});
