// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast, ToastContainer } from '../Toast';

describe('Toast', () => {
  const defaultProps = {
    id: 'toast-1',
    message: 'Test message',
    variant: 'info',
    duration: 4000,
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    defaultProps.onDismiss.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with message', () => {
    render(<Toast {...defaultProps} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders with role="alert" for accessibility', () => {
    render(<Toast {...defaultProps} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('auto-dismisses after duration', () => {
    render(<Toast {...defaultProps} duration={3000} />);
    expect(defaultProps.onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(defaultProps.onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('does not auto-dismiss when duration is 0', () => {
    render(<Toast {...defaultProps} duration={0} />);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(defaultProps.onDismiss).not.toHaveBeenCalled();
  });

  it('clears timer on unmount', () => {
    const { unmount } = render(<Toast {...defaultProps} duration={5000} />);
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(defaultProps.onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    render(<Toast {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(defaultProps.onDismiss).toHaveBeenCalledWith('toast-1');
  });
});

describe('ToastContainer', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    mockOnDismiss.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when toasts array is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={mockOnDismiss} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when toasts is null', () => {
    const { container } = render(<ToastContainer toasts={null} onDismiss={mockOnDismiss} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders multiple toasts', () => {
    const toasts = [
      { id: '1', message: 'Toast 1', variant: 'info' },
      { id: '2', message: 'Toast 2', variant: 'error' },
      { id: '3', message: 'Toast 3', variant: 'success' },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
  });

  it('passes onDismiss to individual toasts', () => {
    const toasts = [{ id: '1', message: 'Test', variant: 'info' }];
    render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(mockOnDismiss).toHaveBeenCalledWith('1');
  });

  it('passes duration to individual toasts', () => {
    const toasts = [{ id: '1', message: 'Test', variant: 'info', duration: 2000 }];
    render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(mockOnDismiss).toHaveBeenCalledWith('1');
  });
});
