/**
 * SignupView.jsx - User registration screen
 *
 * Provides email/password registration and Google OAuth signup.
 * Uses AuthContext for authentication operations.
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ScaledContainer } from '../ui/ScaledContainer';
import { GoogleSignInButton } from '../ui/GoogleSignInButton';
import { PasswordInput } from '../ui/PasswordInput';
import { useAuth, useUI } from '../../contexts';
import { LAYOUT } from '../../constants/gameConstants';
import { MIN_PASSWORD_LENGTH } from '../../constants/authConstants';

/**
 * SignupView - User registration screen
 */
export const SignupView = ({ scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const {
    signUpWithEmail,
    signInWithGoogle,
    isLoading,
    error,
    clearError,
  } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }
    setLocalError('');
    return true;
  }, [email, password, confirmPassword]);

  // Handle email/password sign up
  const handleEmailSignUp = useCallback(async (e) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    const result = await signUpWithEmail(email, password);
    if (result.success) {
      setCurrentScreen(SCREEN.TABLE);
    }
  }, [email, password, signUpWithEmail, validateForm, clearError, setCurrentScreen, SCREEN]);

  // Handle Google sign up
  const handleGoogleSignUp = useCallback(async () => {
    clearError();
    const result = await signInWithGoogle();
    if (result.success) {
      setCurrentScreen(SCREEN.TABLE);
    }
  }, [signInWithGoogle, clearError, setCurrentScreen, SCREEN]);

  // Navigate to login
  const handleGoToLogin = useCallback(() => {
    clearError();
    setCurrentScreen(SCREEN.LOGIN);
  }, [clearError, setCurrentScreen, SCREEN]);

  // Display error (prefer Firebase error over local validation)
  const displayError = error || localError;

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { text: '', color: '' };
    if (password.length < MIN_PASSWORD_LENGTH) return { text: 'Too short', color: 'text-red-400' };
    if (password.length < 8) return { text: 'Weak', color: 'text-yellow-400' };
    if (password.length < 12) return { text: 'Good', color: 'text-blue-400' };
    return { text: 'Strong', color: 'text-green-400' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <ScaledContainer scale={scale}>
      <div
        className="bg-gray-900 flex items-center justify-center"
        style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
      >
        <div className="w-full max-w-md p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-gray-400">Sign up to sync your data across devices</p>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleEmailSignUp} className="space-y-4">
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
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="new-password"
                showStrength={!!password}
                strengthValue={passwordStrength}
                className="px-4 py-3 bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {password && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">
                    Minimum {MIN_PASSWORD_LENGTH} characters
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="new-password"
                className={`px-4 py-3 bg-gray-800 text-white placeholder-gray-500 focus:ring-1 ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-700 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            {/* Error Display */}
            {displayError && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {displayError}
              </div>
            )}

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                isLoading
                  ? 'bg-blue-800 text-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-700" />
            <span className="px-4 text-gray-500 text-sm">or</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          {/* Google Sign Up */}
          <GoogleSignInButton
            onClick={handleGoogleSignUp}
            isLoading={isLoading}
            disabled={isLoading}
            text="Sign up with Google"
          />

          {/* Link to Login */}
          <div className="mt-6 text-center">
            <span className="text-gray-500 text-sm">
              Already have an account?{' '}
              <button
                type="button"
                onClick={handleGoToLogin}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Sign in
              </button>
            </span>
          </div>
        </div>
      </div>
    </ScaledContainer>
  );
};

SignupView.propTypes = {
  scale: PropTypes.number.isRequired,
};

export default SignupView;
