/**
 * Toast.jsx - Toast notification component with auto-dismiss
 */

import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

/**
 * Toast variants with their styling
 */
const VARIANTS = {
  error: {
    bg: 'bg-red-900/95',
    border: 'border-red-500',
    icon: AlertCircle,
    iconColor: 'text-red-400'
  },
  success: {
    bg: 'bg-green-900/95',
    border: 'border-green-500',
    icon: CheckCircle,
    iconColor: 'text-green-400'
  },
  warning: {
    bg: 'bg-yellow-900/95',
    border: 'border-yellow-500',
    icon: AlertTriangle,
    iconColor: 'text-yellow-400'
  },
  info: {
    bg: 'bg-blue-900/95',
    border: 'border-blue-500',
    icon: Info,
    iconColor: 'text-blue-400'
  }
};

/**
 * Single Toast notification
 * @param {string} id - Unique toast ID
 * @param {string} message - Toast message
 * @param {string} variant - 'error' | 'success' | 'warning' | 'info'
 * @param {number} duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @param {function} onDismiss - Callback when toast is dismissed
 */
export const Toast = ({
  id,
  message,
  variant = 'info',
  duration = 4000,
  onDismiss
}) => {
  const config = VARIANTS[variant] || VARIANTS.info;
  const Icon = config.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        ${config.bg} ${config.border}
        animate-slide-in
        max-w-md min-w-[280px]
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <p className="text-white text-sm flex-1 whitespace-pre-wrap">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * ToastContainer - Renders all active toasts
 * @param {Array} toasts - Array of toast objects
 * @param {function} onDismiss - Callback to dismiss a toast
 */
export const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};
