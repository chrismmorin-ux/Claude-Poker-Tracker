/**
 * Toast.test.jsx - Tests for Toast notification components
 */

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

  describe('rendering', () => {
    it('renders with message', () => {
      render(<Toast {...defaultProps} />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('renders with role="alert" for accessibility', () => {
      render(<Toast {...defaultProps} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders dismiss button with aria-label', () => {
      render(<Toast {...defaultProps} />);
      expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders info variant by default', () => {
      render(<Toast {...defaultProps} />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-blue-900');
      expect(toast.className).toContain('border-blue-500');
    });

    it('renders error variant correctly', () => {
      render(<Toast {...defaultProps} variant="error" />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-red-900');
      expect(toast.className).toContain('border-red-500');
    });

    it('renders success variant correctly', () => {
      render(<Toast {...defaultProps} variant="success" />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-green-900');
      expect(toast.className).toContain('border-green-500');
    });

    it('renders warning variant correctly', () => {
      render(<Toast {...defaultProps} variant="warning" />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-yellow-900');
      expect(toast.className).toContain('border-yellow-500');
    });

    it('falls back to info for unknown variant', () => {
      render(<Toast {...defaultProps} variant="unknown" />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-blue-900');
    });
  });

  describe('auto-dismiss', () => {
    it('auto-dismisses after duration', () => {
      render(<Toast {...defaultProps} duration={3000} />);

      expect(defaultProps.onDismiss).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(defaultProps.onDismiss).toHaveBeenCalledWith('toast-1');
    });

    it('does not auto-dismiss when duration is 0', () => {
      render(<Toast {...defaultProps} duration={0} />);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(defaultProps.onDismiss).not.toHaveBeenCalled();
    });

    it('clears timer on unmount', () => {
      const { unmount } = render(<Toast {...defaultProps} duration={5000} />);

      unmount();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(defaultProps.onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('manual dismiss', () => {
    it('calls onDismiss when dismiss button is clicked', () => {
      render(<Toast {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Dismiss'));

      expect(defaultProps.onDismiss).toHaveBeenCalledWith('toast-1');
    });
  });

  describe('message formatting', () => {
    it('preserves whitespace in message', () => {
      render(<Toast {...defaultProps} message="Line 1\nLine 2" />);
      const message = screen.getByText(/Line 1/);
      expect(message.className).toContain('whitespace-pre-wrap');
    });
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

  describe('rendering', () => {
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

    it('has aria-live="polite" for accessibility', () => {
      const toasts = [{ id: '1', message: 'Test', variant: 'info' }];

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      const container = screen.getByRole('alert').parentElement;
      expect(container).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('positioning', () => {
    it('is positioned fixed at top-right', () => {
      const toasts = [{ id: '1', message: 'Test', variant: 'info' }];

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      const container = screen.getByRole('alert').parentElement;
      expect(container.className).toContain('fixed');
      expect(container.className).toContain('top-4');
      expect(container.className).toContain('right-4');
    });

    it('uses flexbox for vertical stacking', () => {
      const toasts = [{ id: '1', message: 'Test', variant: 'info' }];

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      const container = screen.getByRole('alert').parentElement;
      expect(container.className).toContain('flex');
      expect(container.className).toContain('flex-col');
    });
  });

  describe('toast interaction', () => {
    it('passes onDismiss to individual toasts', () => {
      const toasts = [{ id: '1', message: 'Test', variant: 'info' }];

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      fireEvent.click(screen.getByLabelText('Dismiss'));

      expect(mockOnDismiss).toHaveBeenCalledWith('1');
    });

    it('passes duration to individual toasts', () => {
      const toasts = [{ id: '1', message: 'Test', variant: 'info', duration: 2000 }];

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('1');
    });
  });
});
