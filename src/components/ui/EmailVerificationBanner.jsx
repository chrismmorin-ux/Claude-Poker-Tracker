import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Mail, X, AlertCircle } from 'lucide-react';

const DISMISS_KEY = 'emailVerificationBannerDismissed';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN = 60000; // 60 seconds

/**
 * EmailVerificationBanner - Banner for unverified users
 *
 * Features:
 * - Shows only for authenticated users with unverified email
 * - "Verify Email" button triggers email send
 * - "Resend" with 60s cooldown timer
 * - Dismissible (localStorage, reshow after 24h)
 * - Auto-dismiss when email is verified
 *
 * @param {object} user - Firebase user object (must have emailVerified)
 * @param {function} onSendVerification - Callback to send verification email
 * @param {function} onShowToast - Toast notification callback
 */
export const EmailVerificationBanner = ({ user, onSendVerification, onShowToast }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Check if banner was dismissed recently
  useEffect(() => {
    const dismissedData = localStorage.getItem(DISMISS_KEY);
    if (dismissedData) {
      try {
        const { timestamp } = JSON.parse(dismissedData);
        const elapsed = Date.now() - timestamp;
        if (elapsed < DISMISS_DURATION) {
          setIsDismissed(true);
        } else {
          localStorage.removeItem(DISMISS_KEY);
        }
      } catch (err) {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (!lastSentTime) return;

    const updateCooldown = () => {
      const elapsed = Date.now() - lastSentTime;
      const remaining = Math.max(0, RESEND_COOLDOWN - elapsed);
      setCooldownRemaining(remaining);

      if (remaining > 0) {
        requestAnimationFrame(updateCooldown);
      }
    };

    updateCooldown();
  }, [lastSentTime]);

  const handleSendVerification = useCallback(async () => {
    if (isSending || cooldownRemaining > 0) return;

    setIsSending(true);
    const result = await onSendVerification();
    setIsSending(false);

    if (result.success) {
      setLastSentTime(Date.now());
      onShowToast?.('Verification email sent! Check your inbox.', 'success');
    } else {
      onShowToast?.(result.error || 'Failed to send verification email', 'error');
    }
  }, [isSending, cooldownRemaining, onSendVerification, onShowToast]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ timestamp: Date.now() }));
  }, []);

  // Don't show if user is verified, dismissed, or user is null
  if (!user || user.emailVerified || isDismissed) {
    return null;
  }

  const canResend = !isSending && cooldownRemaining === 0;
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

  return (
    <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-yellow-200 mb-1">
            Email Verification Required
          </h4>
          <p className="text-xs text-yellow-300 mb-3">
            Please verify your email address to secure your account and enable all features.
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSendVerification}
              disabled={!canResend}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {lastSentTime ? 'Resend Email' : 'Send Verification Email'}
            </button>

            {cooldownRemaining > 0 && (
              <span className="text-xs text-yellow-400">
                Wait {cooldownSeconds}s to resend
              </span>
            )}

            {lastSentTime && cooldownRemaining === 0 && (
              <span className="text-xs text-yellow-400">
                Didn't receive it? Click to resend
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-yellow-400 hover:text-yellow-200 transition-colors flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

EmailVerificationBanner.propTypes = {
  user: PropTypes.shape({
    emailVerified: PropTypes.bool,
  }),
  onSendVerification: PropTypes.func.isRequired,
  onShowToast: PropTypes.func,
};
