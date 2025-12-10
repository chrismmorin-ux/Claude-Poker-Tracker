/**
 * LoginView.jsx - User login screen
 *
 * Provides email/password login, Google OAuth, and guest mode access.
 * Uses AuthContext for authentication operations.
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ScaledContainer } from '../ui/ScaledContainer';
import { GoogleSignInButton } from '../ui/GoogleSignInButton';
import { useAuth, useUI } from '../../contexts';
import { LAYOUT } from '../../constants/gameConstants';
import { MIN_PASSWORD_LENGTH } from '../../constants/authConstants';

/**
 * LoginView - User login screen with email/password and Google OAuth
 */
export const LoginView = ({ scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const {
    signInWithEmail,
    signInWithGoogle,
    isLoading,
    error,
    clearError,
  } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Validate form inputs
  const validateForm = useCallback(() => {
    if (!email.trim()) {
      setLocalError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setLocalError('Password is required');
      return false;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return false;
    }
    setLocalError('');
    return true;
  }, [email, password]);

  // Handle email/password sign in
  const handleEmailSignIn = useCallback(async (e) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    const result = await signInWithEmail(email, password);
    if (result.success) {
      setCurrentScreen(SCREEN.TABLE);
    }
  }, [email, password, signInWithEmail, validateForm, clearError, setCurrentScreen, SCREEN]);

  // Handle Google sign in
  const handleGoogleSignIn = useCallback(async () => {
    clearError();
    const result = await signInWithGoogle();
    if (result.success) {
      setCurrentScreen(SCREEN.TABLE);
    }
  }, [signInWithGoogle, clearError, setCurrentScreen, SCREEN]);

  // Handle continue as guest
  const handleContinueAsGuest = useCallback(() => {
    setCurrentScreen(SCREEN.TABLE);
  }, [setCurrentScreen, SCREEN]);

  // Navigate to signup
  const handleGoToSignup = useCallback(() => {
    clearError();
    setCurrentScreen(SCREEN.SIGNUP);
  }, [clearError, setCurrentScreen, SCREEN]);

  // Navigate to password reset
  const handleGoToPasswordReset = useCallback(() => {
    clearError();
    setCurrentScreen(SCREEN.PASSWORD_RESET);
  }, [clearError, setCurrentScreen, SCREEN]);

  // Display error (prefer Firebase error over local validation)
  const displayError = error || localError;

  return (
    <ScaledContainer scale={scale}>
      <div
        className="bg-gray-900 flex items-center justify-center"
        style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
      >
        <div className="w-full max-w-md p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Poker Tracker</h1>
            <p className="text-gray-400">Sign in to sync your data across devices</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="you@example.com"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            {/* Error Display */}
            {displayError && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {displayError}
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                isLoading
                  ? 'bg-blue-800 text-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-700" />
            <span className="px-4 text-gray-500 text-sm">or</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          {/* Google Sign In */}
          <GoogleSignInButton
            onClick={handleGoogleSignIn}
            isLoading={isLoading}
            disabled={isLoading}
          />

          {/* Continue as Guest */}
          <button
            type="button"
            onClick={handleContinueAsGuest}
            disabled={isLoading}
            className="w-full mt-4 py-3 px-4 rounded-lg font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Continue as Guest
          </button>

          {/* Links */}
          <div className="mt-6 text-center space-y-2">
            <button
              type="button"
              onClick={handleGoToPasswordReset}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Forgot your password?
            </button>
            <div className="text-gray-500 text-sm">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={handleGoToSignup}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Create account
              </button>
            </div>
          </div>
        </div>
      </div>
    </ScaledContainer>
  );
};

LoginView.propTypes = {
  scale: PropTypes.number.isRequired,
};

export default LoginView;
