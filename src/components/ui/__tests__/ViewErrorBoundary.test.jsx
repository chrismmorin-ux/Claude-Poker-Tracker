/**
 * ViewErrorBoundary.test.jsx - Tests for ViewErrorBoundary component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewErrorBoundary } from '../ViewErrorBoundary';
import { AppError, ERROR_CODES } from '../../../utils/errorHandler';

// Mock the logger to avoid console noise in tests
vi.mock('../../../utils/errorHandler', async () => {
  const actual = await vi.importActual('../../../utils/errorHandler');
  return {
    ...actual,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

// Component that throws an error
const ThrowError = ({ error }) => {
  throw error;
};

// Normal component
const NormalComponent = () => <div data-testid="normal">Normal content</div>;

describe('ViewErrorBoundary', () => {
  const defaultProps = {
    viewName: 'TestView',
    onReturnToTable: vi.fn(),
  };

  // Suppress console.error during error boundary tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
    defaultProps.onReturnToTable.mockClear();
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('normal rendering', () => {
    it('renders children when no error', () => {
      render(
        <ViewErrorBoundary {...defaultProps}>
          <NormalComponent />
        </ViewErrorBoundary>
      );

      expect(screen.getByTestId('normal')).toBeInTheDocument();
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('does not show error UI when no error', () => {
      render(
        <ViewErrorBoundary {...defaultProps}>
          <NormalComponent />
        </ViewErrorBoundary>
      );

      expect(screen.queryByText('TestView Error')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('catches and displays error when child throws', () => {
      const error = new Error('Test error message');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('TestView Error')).toBeInTheDocument();
    });

    it('displays error message', () => {
      const error = new Error('Test error message');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('displays error code for regular errors', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText(ERROR_CODES.RENDER_FAILED)).toBeInTheDocument();
    });

    it('displays custom error code for AppError', () => {
      const error = new AppError('CUSTOM_CODE', 'Custom error message');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('CUSTOM_CODE')).toBeInTheDocument();
    });

    it('displays view name in error title', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary viewName="CustomViewName" onReturnToTable={vi.fn()}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('CustomViewName Error')).toBeInTheDocument();
    });
  });

  describe('error recovery', () => {
    it('renders retry button', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('renders return to table button', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('Return to Table')).toBeInTheDocument();
    });

    it('resets error state when retry is clicked', () => {
      let shouldThrow = true;
      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div data-testid="recovered">Recovered</div>;
      };

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ConditionalError />
        </ViewErrorBoundary>
      );

      // Error UI should be shown
      expect(screen.getByText('TestView Error')).toBeInTheDocument();

      // Stop throwing
      shouldThrow = false;

      // Click retry
      fireEvent.click(screen.getByText('Try Again'));

      // Should recover and show normal content
      expect(screen.getByTestId('recovered')).toBeInTheDocument();
    });

    it('calls onReturnToTable when return button is clicked', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      fireEvent.click(screen.getByText('Return to Table'));

      expect(defaultProps.onReturnToTable).toHaveBeenCalled();
    });

    it('resets error state when returning to table', () => {
      let shouldThrow = true;
      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div data-testid="recovered">Recovered</div>;
      };

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ConditionalError />
        </ViewErrorBoundary>
      );

      // Error UI should be shown
      expect(screen.getByText('TestView Error')).toBeInTheDocument();

      // Stop throwing
      shouldThrow = false;

      // Click return to table
      fireEvent.click(screen.getByText('Return to Table'));

      // onReturnToTable should be called
      expect(defaultProps.onReturnToTable).toHaveBeenCalled();
    });

    it('handles missing onReturnToTable gracefully', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary viewName="Test">
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      // Should not throw when clicking return
      expect(() => {
        fireEvent.click(screen.getByText('Return to Table'));
      }).not.toThrow();
    });
  });

  describe('error UI content', () => {
    it('displays description text', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('Something went wrong while rendering this view.')).toBeInTheDocument();
    });

    it('displays error code label', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText(/Error Code:/)).toBeInTheDocument();
    });

    it('displays help text', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText(/If this keeps happening/)).toBeInTheDocument();
    });

    it('handles error without message', () => {
      const error = new Error();
      error.message = '';

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('Unknown error')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has dark background', () => {
      const error = new Error('Test error');

      const { container } = render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(container.firstChild.className).toContain('bg-gray-900');
    });

    it('centers content', () => {
      const error = new Error('Test error');

      const { container } = render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(container.firstChild.className).toContain('flex');
      expect(container.firstChild.className).toContain('items-center');
      expect(container.firstChild.className).toContain('justify-center');
    });

    it('uses full screen height', () => {
      const error = new Error('Test error');

      const { container } = render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(container.firstChild.className).toContain('min-h-screen');
    });
  });

  describe('getDerivedStateFromError', () => {
    it('sets hasError to true', () => {
      const error = new Error('Test error');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      // If hasError wasn't set, children would render
      expect(screen.queryByTestId('normal')).not.toBeInTheDocument();
      expect(screen.getByText('TestView Error')).toBeInTheDocument();
    });

    it('captures error object', () => {
      const error = new Error('Unique error message');

      render(
        <ViewErrorBoundary {...defaultProps}>
          <ThrowError error={error} />
        </ViewErrorBoundary>
      );

      expect(screen.getByText('Unique error message')).toBeInTheDocument();
    });
  });
});
