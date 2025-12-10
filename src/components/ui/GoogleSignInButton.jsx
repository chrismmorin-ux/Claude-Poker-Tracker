/**
 * GoogleSignInButton.jsx - Styled Google OAuth sign-in button
 *
 * Follows Google's branding guidelines with proper styling.
 * Shows loading state when auth is in progress.
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Google "G" logo SVG component
 */
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9.003 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.33z"
      fill="#FBBC05"
    />
    <path
      d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
      fill="#EA4335"
    />
  </svg>
);

/**
 * Loading spinner for button
 */
const LoadingSpinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-gray-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * GoogleSignInButton - Styled button for Google OAuth sign-in
 */
export const GoogleSignInButton = ({
  onClick,
  disabled = false,
  isLoading = false,
  text = 'Continue with Google',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        w-full flex items-center justify-center gap-3
        px-4 py-3 rounded-lg
        bg-white border border-gray-300
        text-gray-700 font-medium
        transition-all duration-200
        ${disabled || isLoading
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm active:bg-gray-100'
        }
      `}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <GoogleLogo />
      )}
      <span>{isLoading ? 'Signing in...' : text}</span>
    </button>
  );
};

GoogleSignInButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  text: PropTypes.string,
};

export default GoogleSignInButton;
