/**
 * VersionMismatchModal — diagnostic + confirm before reloading on protocol mismatch.
 *
 * Replaces the silent window.location.reload() at OnlineView.jsx (WS-076).
 * Shows both versions, warns about Online state loss, and gates the reload
 * behind explicit user confirmation. When postReloadStatus === 'still-mismatched'
 * (i.e., the user already reloaded but versions are still divergent), the
 * modal is auto-opened by OnlineView with a stronger warning string.
 *
 * Mirrors ConfirmDeleteModal layout (Tailwind + lucide-react AlertTriangle +
 * click-backdrop-to-cancel).
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const formatProtocolVersion = (v) => (v == null ? 'unknown' : `protocol v${v}`);
const formatManifestVersion = (v) => (v == null ? 'unknown' : v);

export const VersionMismatchModal = ({
  isOpen,
  onConfirm,
  onCancel,
  extProtocolVersion,
  extManifestVersion,
  appProtocolVersion,
  postReloadStatus = null,
}) => {
  if (!isOpen) return null;

  const stillMismatched = postReloadStatus === 'still-mismatched';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="version-mismatch-modal">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-60"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-300"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-3">
          Extension version mismatch
        </h3>

        {/* Message */}
        <p className="text-gray-300 text-center mb-4">
          The Ignition extension and this app are speaking different
          protocol versions — hand imports are paused.
        </p>

        {/* Version table */}
        <div className="bg-gray-900/60 rounded-md p-3 mb-4 font-mono text-sm">
          <div className="flex justify-between items-baseline py-1">
            <span className="text-gray-400">Extension</span>
            <span className="text-amber-300">
              {formatManifestVersion(extManifestVersion)}{' '}
              <span className="text-gray-500">({formatProtocolVersion(extProtocolVersion)})</span>
            </span>
          </div>
          <div className="flex justify-between items-baseline py-1">
            <span className="text-gray-400">App</span>
            <span className="text-amber-300">
              ({formatProtocolVersion(appProtocolVersion)})
            </span>
          </div>
        </div>

        {/* Session-at-risk warning */}
        <p className="text-gray-300 text-sm text-center mb-2">
          Reloading will discard any unsaved Online session state.
          Update the extension first if possible.
        </p>

        {/* Conditional "still mismatched" warning */}
        {stillMismatched && (
          <p className="text-amber-300 text-sm text-center mb-4" data-testid="still-mismatched-copy">
            You already reloaded, but the versions still differ.
            Try updating the extension manually before reloading again.
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionMismatchModal;
