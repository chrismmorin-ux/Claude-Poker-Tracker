/**
 * ToastContext.jsx - Toast notification context provider
 *
 * Wraps useToast hook and auto-renders ToastContainer.
 * Views consume via useToast() instead of prop drilling.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useToast as useToastState } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { RotatedViewport } from '../components/ui/RotatedViewport';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const toast = useToastState();
  const value = useMemo(() => toast, [toast.toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* RotatedViewport keeps toasts readable when the canvas auto-rotates
          (WS-440). Requires ToastProvider to sit inside UIProvider — see
          AppProviders.jsx; degrades to unrotated when UIContext is absent. */}
      <RotatedViewport zClassName="z-50">
        <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
      </RotatedViewport>
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
