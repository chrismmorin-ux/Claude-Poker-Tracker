/**
 * ViewErrorBoundary.jsx - Per-view error boundary with recovery options
 *
 * Catches errors in a specific view and allows:
 * - Retry the current view
 * - Return to table view
 * - Shows which view failed
 */

import React from 'react';
import { AlertTriangle, RotateCcw, Home, RefreshCw } from 'lucide-react';
import { logger, AppError, ERROR_CODES } from '../../utils/errorHandler';
import { logErrorObject } from '../../utils/errorLog';
import { isChunkLoadError } from '../../utils/chunkRecovery';
import { hardRefresh } from '../../utils/swUpdate';

/**
 * ViewErrorBoundary - Granular error boundary for individual views
 *
 * @param {string} viewName - Name of the view (for error display)
 * @param {Function} onReturnToTable - Callback to return to table view
 * @param {React.ReactNode} children - Child components to render
 */
export class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCode: null,
    };
  }

  static getDerivedStateFromError(error) {
    // A view that is lazy-loaded can fail for a reason that has nothing to do
    // with the view: its chunk is gone because a deploy landed mid-session.
    // That is a staleness problem, not a render bug, and needs its own exit.
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

  componentDidCatch(error, errorInfo) {
    const { viewName } = this.props;

    const appError = error instanceof AppError
      ? error
      : new AppError(
          isChunkLoadError(error)
            ? ERROR_CODES.CHUNK_LOAD_FAILED
            : ERROR_CODES.RENDER_FAILED,
          `${viewName} render failed: ${error.message}`,
          {
            viewName,
            componentStack: errorInfo.componentStack,
            originalError: error.name,
          }
        );

    // Log to console
    logger.error('ViewErrorBoundary', appError);

    // Persist to localStorage for later review
    logErrorObject(appError, appError.code, {
      view: viewName,
      componentStack: errorInfo.componentStack?.substring(0, 500),
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCode: null,
    });
  };

  handleReturnToTable = () => {
    const { onReturnToTable } = this.props;

    // Reset error state first
    this.setState({
      hasError: false,
      error: null,
      errorCode: null,
    });

    // Then navigate back to table
    if (onReturnToTable) {
      onReturnToTable();
    }
  };

  handleHardRefresh = () => {
    hardRefresh();
  };

  render() {
    const { viewName, children } = this.props;
    const { hasError, error, errorCode } = this.state;

    if (hasError) {
      const isStale = errorCode === ERROR_CODES.CHUNK_LOAD_FAILED;

      // Stale build: the view never loaded, so retrying or navigating home
      // leaves the app just as broken. The only working exit is a hard refresh.
      if (isStale) {
        return (
          <div className="h-dvh bg-gray-900 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
              <div className="flex justify-center mb-4">
                <RefreshCw className="w-16 h-16 text-blue-400" />
              </div>

              <h1 className="text-2xl font-bold text-white mb-2">
                A new version is ready
              </h1>

              <p className="text-gray-400 mb-6">
                The app was updated while this page was open, so {viewName} couldn’t
                load. Tap Update to get the new version — your sessions, hands and
                players are untouched.
              </p>

              <p className="text-sm text-gray-500 mb-6">
                Error Code: <code className="text-yellow-400">{errorCode}</code>
              </p>

              <div className="flex justify-center">
                <button
                  onClick={this.handleHardRefresh}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Update App
                </button>
              </div>

              <p className="text-xs text-gray-600 mt-6">
                If this keeps happening, close the app and reopen it.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="h-dvh bg-gray-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-16 h-16 text-red-500" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white mb-2">
              {viewName} Error
            </h1>

            {/* Description */}
            <p className="text-gray-400 mb-4">
              Something went wrong while rendering this view.
            </p>

            {/* Error Code */}
            <p className="text-sm text-gray-500 mb-4">
              Error Code: <code className="text-yellow-400">{errorCode}</code>
            </p>

            {/* Error Message */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-32">
                {error?.message || 'Unknown error'}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleReturnToTable}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Return to Table
              </button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-600 mt-6">
              If this keeps happening, try reloading the page or check the console for details.
            </p>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ViewErrorBoundary;
