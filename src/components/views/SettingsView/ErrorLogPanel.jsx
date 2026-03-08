import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Trash2, AlertTriangle, Bug, Copy, Download, Check } from 'lucide-react';
import { getRecentErrors, clearErrorLog, getErrorCount, exportErrorLog } from '../../../utils/errorLog';
import { GOLD } from '../../../constants/designTokens';

export const ErrorLogPanel = ({ showSuccess }) => {
  const [errorLogExpanded, setErrorLogExpanded] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState(null);
  const [errors, setErrors] = useState([]);
  const [errorCount, setErrorCount] = useState(0);
  const [showClearErrorsConfirm, setShowClearErrorsConfirm] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  useEffect(() => {
    if (errorLogExpanded) {
      setErrors(getRecentErrors(20));
      setErrorCount(getErrorCount());
    }
  }, [errorLogExpanded]);

  const formatRelativeTime = useCallback((timestamp) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);

  const handleClearErrors = useCallback(() => {
    if (showClearErrorsConfirm) {
      clearErrorLog();
      setErrors([]);
      setErrorCount(0);
      setShowClearErrorsConfirm(false);
      setExpandedErrorId(null);
      if (showSuccess) showSuccess('Error log cleared');
    } else {
      setShowClearErrorsConfirm(true);
    }
  }, [showClearErrorsConfirm, showSuccess]);

  const handleCopyBugReport = useCallback(async () => {
    try {
      const report = exportErrorLog();
      await navigator.clipboard.writeText(report);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = exportErrorLog();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  }, []);

  const handleDownloadBugReport = useCallback(() => {
    const report = exportErrorLog();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `poker-tracker-bug-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <button
        onClick={() => setErrorLogExpanded(!errorLogExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: GOLD }}>
          <AlertTriangle className="w-5 h-5" />
          Error Log
          {errorCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
              {errorCount}
            </span>
          )}
        </h3>
        {errorLogExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {errorLogExpanded && (
        <div className="mt-4">
          {errors.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No errors recorded</p>
          ) : (
            <>
              {/* Clear All Button */}
              <div className="flex justify-end mb-3">
                {showClearErrorsConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-sm">Clear all errors?</span>
                    <button
                      onClick={handleClearErrors}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowClearErrorsConfirm(false)}
                      className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleClearErrors}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-medium"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                )}
              </div>

              {/* Error List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {errors.map((error) => (
                  <div
                    key={error.id}
                    className="bg-gray-700 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedErrorId(
                        expandedErrorId === error.id ? null : error.id
                      )}
                      className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-650"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-yellow-400 text-xs font-mono">
                          {error.code}
                        </code>
                        <span className="text-gray-300 text-sm truncate">
                          {error.message.substring(0, 50)}
                          {error.message.length > 50 && '...'}
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs whitespace-nowrap ml-2">
                        {formatRelativeTime(error.timestamp)}
                      </span>
                    </button>

                    {expandedErrorId === error.id && (
                      <div className="px-3 pb-3 border-t border-gray-600">
                        <div className="mt-2 space-y-2">
                          <div>
                            <span className="text-gray-500 text-xs">Message:</span>
                            <p className="text-gray-300 text-xs mt-1 break-words">
                              {error.message}
                            </p>
                          </div>
                          {error.context && (
                            <div>
                              <span className="text-gray-500 text-xs">Context:</span>
                              <div className="text-gray-400 text-xs mt-1 font-mono">
                                View: {error.context.view || 'unknown'}
                                {error.context.sessionActive !== undefined && (
                                  <span className="ml-2">
                                    Session: {error.context.sessionActive ? 'active' : 'none'}
                                  </span>
                                )}
                                {error.context.handCount > 0 && (
                                  <span className="ml-2">
                                    Hands: {error.context.handCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {error.stack && (
                            <div>
                              <span className="text-gray-500 text-xs">Stack:</span>
                              <pre className="text-gray-400 text-xs mt-1 font-mono whitespace-pre-wrap overflow-x-auto max-h-20 overflow-y-auto">
                                {error.stack.split('\n').slice(0, 4).join('\n')}
                              </pre>
                            </div>
                          )}
                          <div className="text-gray-500 text-xs">
                            App: {error.appVersion}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Report Bug Section */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2 mb-3">
          <Bug className="w-4 h-4" />
          Report Bug
        </h4>
        <p className="text-gray-500 text-xs mb-3">
          Generate a bug report with recent errors and app info. No sensitive data (player names, finances) is included.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleCopyBugReport}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              copiedToClipboard
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copiedToClipboard ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </>
            )}
          </button>
          <button
            onClick={handleDownloadBugReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download JSON
          </button>
        </div>
      </div>
    </div>
  );
};
