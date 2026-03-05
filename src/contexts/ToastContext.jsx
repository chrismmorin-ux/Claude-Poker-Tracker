/**
 * ToastContext.jsx - Toast notification context provider
 *
 * Wraps useToast hook and auto-renders ToastContainer.
 * Views consume via useToast() instead of prop drilling.
 */

import React, { createContext, useContext } from 'react';
import { useToast as useToastState } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const toast = useToastState();

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
