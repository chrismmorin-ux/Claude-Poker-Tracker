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
import { isChunkLoadError } from '../utils/chunkRecovery';
import { hardRefresh } from '../utils/swUpdate';

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
    // Determine error code. A missing code-split chunk is its own failure —
    // the app isn't broken, it's stale — and it gets its own recovery UI.
    let errorCode;
    if (error instanceof AppError) {
      errorCode = error.code;
    } else if (isChunkLoadError(error)) {
      errorCode = ERROR_CODES.CHUNK_LOAD_FAILED;
    } else {
      errorCode = ERROR_CODES.RENDER_FAILED;
    }

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
          isChunkLoadError(error)
            ? ERROR_CODES.CHUNK_LOAD_FAILED
            : ERROR_CODES.RENDER_FAILED,
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

  /**
   * Drop the service-worker caches, then reload.
   *
   * A plain reload can be answered by the active worker out of its own
   * precache, so it brings the same stale build straight back. This is the only
   * control that escapes it — and it has to live here, in the main bundle,
   * because Settings' Force Update button is itself behind a lazy chunk.
   */
  handleHardRefresh = () => {
    hardRefresh();
  };

  render() {
    if (this.state.hasError) {
      const isStale = this.state.errorCode === ERROR_CODES.CHUNK_LOAD_FAILED;

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100dvh',
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
              {isStale ? '🔄' : '⚠️'}
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '8px',
                color: isStale ? '#4dabf7' : '#ff6b6b',
              }}
            >
              {isStale ? 'A new version is ready' : 'Something went wrong'}
            </h1>

            {/* Plain-language explanation for the stale-build case — the founder
                did nothing wrong and nothing is lost, so say so before the code. */}
            {isStale && (
              <p
                style={{
                  fontSize: '14px',
                  color: '#ccc',
                  marginBottom: '16px',
                  lineHeight: '1.5',
                }}
              >
                The app was updated while this page was open, so part of it
                couldn’t load. Tap Update to get the new version — your sessions,
                hands and players are untouched.
              </p>
            )}

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

            {/* Error Message (in debug mode) — suppressed for the stale-build
                case, where the raw chunk URL tells the founder nothing the
                explanation above hasn't already said. */}
            {!isStale && <pre
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
            </pre>}

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              {/* "Try Again" only helps when the failure was transient. A
                  missing chunk isn't: React.lazy caches the rejection, so
                  resetting the boundary re-throws the same error immediately. */}
              {!isStale && (
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
              )}
              {!isStale && (
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
              )}
              <button
                onClick={this.handleHardRefresh}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: isStale ? '#37b24d' : '#2d2d44',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {isStale ? 'Update App' : 'Update & Reload'}
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
              {isStale ? (
                <>
                  If this keeps happening, close the app and reopen it.
                </>
              ) : (
                <>
                  If this error persists, check the browser console for details.
                  <br />
                  Search for error code <code style={{ color: '#ffd93d' }}>{this.state.errorCode}</code> in the codebase.
                </>
              )}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
