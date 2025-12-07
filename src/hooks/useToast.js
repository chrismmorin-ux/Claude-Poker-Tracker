/**
 * useToast.js - Toast notification state management hook
 */

import { useState, useCallback } from 'react';

let toastId = 0;

/**
 * useToast - Manages toast notification state
 * @returns {Object} Toast state and actions
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  /**
   * Add a new toast notification
   * @param {string} message - Toast message
   * @param {Object} options - Toast options
   * @param {string} options.variant - 'error' | 'success' | 'warning' | 'info'
   * @param {number} options.duration - Auto-dismiss duration in ms (default: 4000, 0 = no auto-dismiss)
   * @returns {number} Toast ID
   */
  const addToast = useCallback((message, options = {}) => {
    const id = ++toastId;
    const toast = {
      id,
      message,
      variant: options.variant || 'info',
      duration: options.duration !== undefined ? options.duration : 4000
    };

    setToasts(prev => [...prev, toast]);
    return id;
  }, []);

  /**
   * Dismiss a toast by ID
   * @param {number} id - Toast ID to dismiss
   */
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  /**
   * Dismiss all toasts
   */
  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods for common variants
  const showError = useCallback((message, duration) => {
    return addToast(message, { variant: 'error', duration: duration || 6000 });
  }, [addToast]);

  const showSuccess = useCallback((message, duration) => {
    return addToast(message, { variant: 'success', duration });
  }, [addToast]);

  const showWarning = useCallback((message, duration) => {
    return addToast(message, { variant: 'warning', duration: duration || 5000 });
  }, [addToast]);

  const showInfo = useCallback((message, duration) => {
    return addToast(message, { variant: 'info', duration });
  }, [addToast]);

  return {
    toasts,
    addToast,
    dismissToast,
    dismissAll,
    showError,
    showSuccess,
    showWarning,
    showInfo
  };
};
