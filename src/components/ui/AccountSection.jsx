/**
 * AccountSection - Account management section for SettingsView
 *
 * For Guests: Shows sign-in/create account options
 * For Authenticated Users: Shows profile info, password change, sign out, delete account
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { User, Mail, LogOut, Trash2, Key, Shield, Link2, Unlink } from 'lucide-react';
import { useAuth } from '../../contexts';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AUTH_PROVIDERS } from '../../constants/authConstants';

export const AccountSection = ({ onNavigateToLogin, onNavigateToSignup, onShowToast }) => {
  const {
    user,
    isGuest,
    isAuthenticated,
    isLoading,
    error,
    hasEmailProvider,
    hasGoogleProvider,
    signOut,
    updatePassword,
    linkGoogleAccount,
    unlinkGoogleAccount,
    deleteAccount,
    clearError,
  } = useAuth();

  // Password change form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    const result = await signOut();
    if (result.success) {
      onShowToast?.('Signed out successfully', 'success');
    } else {
      onShowToast?.(result.error || 'Failed to sign out', 'error');
    }
  }, [signOut, onShowToast]);

  // Handle password change
  const handlePasswordChange = useCallback(async () => {
    // Validate
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    const result = await updatePassword(currentPassword, newPassword);
    if (result.success) {
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      onShowToast?.('Password updated successfully', 'success');
    } else {
      setPasswordError(result.error || 'Failed to update password');
    }
  }, [currentPassword, newPassword, confirmPassword, updatePassword, onShowToast]);

  // Handle link Google account
  const handleLinkGoogle = useCallback(async () => {
    const result = await linkGoogleAccount();
    if (result.success) {
      onShowToast?.('Google account linked successfully', 'success');
    } else {
      onShowToast?.(result.error || 'Failed to link Google account', 'error');
    }
  }, [linkGoogleAccount, onShowToast]);

  // Handle unlink Google account
  const handleUnlinkGoogle = useCallback(async () => {
    const result = await unlinkGoogleAccount();
    if (result.success) {
      onShowToast?.('Google account unlinked', 'success');
    } else {
      onShowToast?.(result.error || 'Failed to unlink Google account', 'error');
    }
  }, [unlinkGoogleAccount, onShowToast]);

  // Handle delete account
  const handleDeleteAccount = useCallback(async () => {
    const result = await deleteAccount(hasEmailProvider ? deletePassword : undefined);
    if (result.success) {
      setShowDeleteModal(false);
      setDeletePassword('');
      onShowToast?.('Account deleted', 'info');
    } else {
      onShowToast?.(result.error || 'Failed to delete account', 'error');
    }
  }, [deleteAccount, deletePassword, hasEmailProvider, onShowToast]);

  // Cancel password form
  const handleCancelPasswordForm = useCallback(() => {
    setShowPasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    clearError();
  }, [clearError]);

  // Get provider badge text
  const getProviderBadge = () => {
    if (hasEmailProvider && hasGoogleProvider) {
      return 'Email + Google';
    }
    if (hasEmailProvider) {
      return 'Email';
    }
    if (hasGoogleProvider) {
      return 'Google';
    }
    return 'Unknown';
  };

  // GUEST VIEW: Show sign-in/create account options
  if (isGuest) {
    return (
      <div className="bg-gray-800 rounded-lg p-5">
        <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Account
        </h3>

        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-4">
          <p className="text-gray-300 text-sm mb-1">
            You&apos;re using Poker Tracker as a guest.
          </p>
          <p className="text-gray-400 text-xs">
            Sign in to sync your data across devices.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onNavigateToLogin}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={onNavigateToSignup}
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  // AUTHENTICATED VIEW: Show profile and account management
  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
        <User className="w-5 h-5" />
        Account
      </h3>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={clearError}
            className="text-red-300 hover:text-red-200 text-xs underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* User info */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <Mail className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <p className="text-white font-medium">
              {user?.displayName || user?.email}
            </p>
            {user?.displayName && user?.email && (
              <p className="text-gray-400 text-sm">{user.email}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs font-medium flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {getProviderBadge()}
          </span>
        </div>
      </div>

      {/* Linked accounts management */}
      <div className="border-t border-gray-700 pt-4 mb-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Linked Accounts</h4>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-gray-300 text-sm">Email/Password</span>
          </div>
          {hasEmailProvider ? (
            <span className="text-green-400 text-xs">Connected</span>
          ) : (
            <span className="text-gray-500 text-xs">Not connected</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-300 text-sm">Google</span>
          </div>
          {hasGoogleProvider ? (
            <button
              onClick={handleUnlinkGoogle}
              disabled={isLoading || !hasEmailProvider}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title={!hasEmailProvider ? 'Cannot unlink your only sign-in method' : 'Unlink Google account'}
            >
              <Unlink className="w-3 h-3" />
              Unlink
            </button>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={isLoading}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
            >
              <Link2 className="w-3 h-3" />
              Link
            </button>
          )}
        </div>
      </div>

      {/* Password change (only for email provider users) */}
      {hasEmailProvider && (
        <div className="border-t border-gray-700 pt-4 mb-4">
          {showPasswordForm ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-300">Change Password</h4>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="Current password"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="New password (min 6 characters)"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
              {passwordError && (
                <p className="text-red-400 text-xs">{passwordError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handlePasswordChange}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  onClick={handleCancelPasswordForm}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="flex items-center gap-2 text-gray-300 hover:text-white text-sm"
            >
              <Key className="w-4 h-4" />
              Change Password
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={handleSignOut}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>

      {/* Delete account modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletePassword('');
        }}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message={
          hasEmailProvider
            ? 'This will permanently delete your account and all associated data. Enter your password to confirm.'
            : 'This will permanently delete your account and all associated data. This action cannot be undone.'
        }
        confirmText="Delete Account"
        isLoading={isLoading}
      />

      {/* Password input for delete (if email provider) */}
      {showDeleteModal && hasEmailProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-8 pointer-events-auto">
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none text-sm w-64"
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
};

AccountSection.propTypes = {
  onNavigateToLogin: PropTypes.func.isRequired,
  onNavigateToSignup: PropTypes.func.isRequired,
  onShowToast: PropTypes.func,
};

export default AccountSection;
