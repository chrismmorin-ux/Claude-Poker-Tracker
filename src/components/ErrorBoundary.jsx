/**
 * ErrorBoundary Component
 *
 * Catches React render errors and displays a recovery UI.
 * Logs errors with full context using the centralized error handler.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import React from 'react';
import { logger, AppError, ERROR_CODES } from '../utils/errorHandler';

/**
 * Error Boundary for catching React render errors
 *
 * Features:
 * - Catches errors in child component tree
 * - Logs errors with component stack trace
 * - Displays recovery UI with reload button
 * - Shows error code for debugging
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCode: null,
    };
  }

  /**
   * Update state when an error is caught
   * Called during the "render" phase
   */
  static getDerivedStateFromError(error) {
    // Determine error code
    const errorCode = error instanceof AppError
      ? error.code
      : ERROR_CODES.RENDER_FAILED;

    return {
      hasError: true,
      error,
      errorCode,
    };
  }

  /**
   * Log the error with full context
   * Called during the "commit" phase
   */
  componentDidCatch(error, errorInfo) {
    const appError = error instanceof AppError
      ? error
      : new AppError(
          ERROR_CODES.RENDER_FAILED,
          error.message || 'Component render failed',
          {
            componentStack: errorInfo.componentStack,
            originalError: error.name,
          }
        );

    logger.error('ErrorBoundary', appError);
  }

  /**
   * Reset error state to allow retry
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCode: null,
    });
  };

  /**
   * Reload the page
   */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            backgroundColor: '#1a1a2e',
            color: '#eee',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                fontSize: '48px',
                marginBottom: '16px',
              }}
            >
              ⚠️
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#ff6b6b',
              }}
            >
              Something went wrong
            </h1>

            {/* Error Code */}
            <p
              style={{
                fontSize: '14px',
                color: '#888',
                marginBottom: '16px',
              }}
            >
              Error Code: <code style={{ color: '#ffd93d' }}>{this.state.errorCode}</code>
            </p>

            {/* Error Message (in debug mode) */}
            <pre
              style={{
                backgroundColor: '#0d0d1a',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#ccc',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: '150px',
                marginBottom: '24px',
              }}
            >
              {this.state.error?.message || 'Unknown error'}
            </pre>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: '#2d2d44',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: '#4dabf7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
            </div>

            {/* Help Text */}
            <p
              style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '24px',
              }}
            >
              If this error persists, check the browser console for details.
              <br />
              Search for error code <code style={{ color: '#ffd93d' }}>{this.state.errorCode}</code> in the codebase.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
