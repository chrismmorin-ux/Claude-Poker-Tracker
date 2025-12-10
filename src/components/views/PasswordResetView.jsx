/**
 * PasswordResetView.jsx - Password reset request screen
 *
 * Allows users to request a password reset email.
 * Uses AuthContext for the reset operation.
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ScaledContainer } from '../ui/ScaledContainer';
import { useAuth, useUI } from '../../contexts';
import { LAYOUT } from '../../constants/gameConstants';

/**
 * PasswordResetView - Password reset request screen
 */
export const PasswordResetView = ({ scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const { resetPassword, isLoading, error, clearError } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate email
  const validateEmail = useCallback(() => {
    if (!email.trim()) {
      setLocalError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Please enter a valid email address');
      return false;
    }
    setLocalError('');
    return true;
  }, [email]);

  // Handle password reset request
  const handleResetPassword = useCallback(async (e) => {
    e.preventDefault();
    clearError();
    setIsSuccess(false);

    if (!validateEmail()) return;

    const result = await resetPassword(email);
    if (result.success) {
      setIsSuccess(true);
    }
  }, [email, resetPassword, validateEmail, clearError]);

  // Navigate to login
  const handleGoToLogin = useCallback(() => {
    clearError();
    setCurrentScreen(SCREEN.LOGIN);
  }, [clearError, setCurrentScreen, SCREEN]);

  // Display error
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
            <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-gray-400">
              Enter your email and we'll send you a link to reset your password
            </p>
          </div>

          {isSuccess ? (
            /* Success State */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
              <p className="text-gray-400 mb-6">
                We've sent a password reset link to{' '}
                <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button
                type="button"
                onClick={() => setIsSuccess(false)}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Send another email
              </button>
            </div>
          ) : (
            /* Form State */
            <form onSubmit={handleResetPassword} className="space-y-4">
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
                  autoFocus
                />
              </div>

              {/* Error Display */}
              {displayError && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                  {displayError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  isLoading
                    ? 'bg-blue-800 text-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleGoToLogin}
              className="inline-flex items-center text-gray-400 hover:text-white text-sm"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </ScaledContainer>
  );
};

PasswordResetView.propTypes = {
  scale: PropTypes.number.isRequired,
};

export default PasswordResetView;
