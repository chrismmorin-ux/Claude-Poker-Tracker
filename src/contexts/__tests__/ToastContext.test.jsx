/**
 * ToastContext.test.jsx - Tests for toast notification context provider
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

describe('ToastContext', () => {
  it('provides toast functions', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.showError).toBeDefined();
    expect(result.current.showSuccess).toBeDefined();
    expect(result.current.showWarning).toBeDefined();
    expect(result.current.showInfo).toBeDefined();
    expect(result.current.dismissToast).toBeDefined();
    expect(result.current.toasts).toEqual([]);
  });

  it('adds toast via showError', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showError('Test error');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].variant).toBe('error');
    expect(result.current.toasts[0].message).toBe('Test error');
  });

  it('adds toast via showSuccess', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showSuccess('Test success');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].variant).toBe('success');
  });

  it('dismisses toast by id', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    let toastId;
    act(() => {
      toastId = result.current.showInfo('Dismissable');
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      result.current.dismissToast(toastId);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow('useToast must be used within a ToastProvider');
  });

  it('renders ToastContainer automatically', () => {
    const TestComponent = () => {
      const { showSuccess } = useToast();
      return <button onClick={() => showSuccess('Visible')}>Show</button>;
    };

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Show').click();
    });

    expect(screen.getByText('Visible')).toBeInTheDocument();
  });
});
