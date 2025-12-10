/**
 * AuthLoadingScreen.jsx - Full-screen loading indicator during auth initialization
 *
 * Displays while Firebase Auth is checking the user's authentication status.
 * Prevents flash of login screen for already-authenticated users.
 */

import React from 'react';

/**
 * Loading spinner component
 */
const Spinner = () => (
  <div className="relative">
    <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

/**
 * AuthLoadingScreen - Full-screen loading state during auth initialization
 */
export const AuthLoadingScreen = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <Spinner />
      <p className="mt-4 text-gray-400 text-sm">Loading...</p>
    </div>
  );
};

export default AuthLoadingScreen;
