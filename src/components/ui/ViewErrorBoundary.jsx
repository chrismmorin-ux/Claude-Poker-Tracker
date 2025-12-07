/**
 * ViewErrorBoundary.jsx - Per-view error boundary with recovery options
 *
 * Catches errors in a specific view and allows:
 * - Retry the current view
 * - Return to table view
 * - Shows which view failed
 */

import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { logger, AppError, ERROR_CODES } from '../../utils/errorHandler';

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
    const errorCode = error instanceof AppError
      ? error.code
      : ERROR_CODES.RENDER_FAILED;

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
          ERROR_CODES.RENDER_FAILED,
          `${viewName} render failed: ${error.message}`,
          {
            viewName,
            componentStack: errorInfo.componentStack,
            originalError: error.name,
          }
        );

    logger.error('ViewErrorBoundary', appError);
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

  render() {
    const { viewName, children } = this.props;
    const { hasError, error, errorCode } = this.state;

    if (hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
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
