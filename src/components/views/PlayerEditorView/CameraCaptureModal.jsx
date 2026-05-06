/**
 * @file CameraCaptureModal — 2-stage native capture → crop preview → save.
 *
 * Stage 1: hidden <input type="file" capture="environment"> programmatically
 * clicked on mount. The browser handles native camera/gallery picker.
 *
 * Stage 2: cropToSquare(file) → JPEG Blob → preview. Retake re-fires input;
 * Accept atomically writes via savePhotoAtomically.
 *
 * Per `docs/design/surfaces/camera-capture-modal.md` §Atomic-txn binding +
 * AP-PIO-03 (master toggle gates visibility upstream — modal only opens
 * when CameraButton is rendered).
 *
 * SPR-036 / WS-161 (2026-05-04).
 */

import React, { useEffect, useRef, useState } from 'react';
import { cropToSquare } from '../../../utils/playerMatching/cropToSquare';
import { savePhotoAtomically } from '../../../utils/persistence/savePhotoAtomically';

// `onAcceptOverride(blob, previewUrl)` — optional. When provided, the
// modal calls this instead of savePhotoAtomically + onSaved. Used by the
// prototype to demo the capture flow without writing to IDB. If absent,
// the production save path runs.
export const CameraCaptureModal = ({ playerId, onClose, onSaved, onAcceptOverride }) => {
  const inputRef = useRef(null);
  const [stage, setStage] = useState('capture'); // 'capture' | 'preview'
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Stage 1: open native camera picker on mount.
  useEffect(() => {
    inputRef.current?.click();
  }, []);

  // Cleanup blob URL on unmount or replacement.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User dismissed the picker — close the modal.
      onClose?.();
      return;
    }
    setError(null);
    try {
      const cropped = await cropToSquare(file);
      const url = URL.createObjectURL(cropped);
      setPreviewBlob(cropped);
      setPreviewUrl(url);
      setStage('preview');
    } catch (err) {
      setError(err?.message || 'Could not process image');
    }
  };

  const onRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setStage('capture');
    setError(null);
    // Re-fire the input.
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  const onAccept = async () => {
    if (!previewBlob) return;
    setIsSaving(true);
    setError(null);
    try {
      if (onAcceptOverride) {
        await onAcceptOverride(previewBlob, previewUrl);
        onClose?.();
      } else {
        const { blobId } = await savePhotoAtomically(playerId, previewBlob);
        onSaved?.(blobId);
      }
    } catch (err) {
      setError(err?.message || 'Save failed');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      data-testid="camera-capture-modal"
    >
      {/* Hidden native input — Stage 1 entry point */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileSelected}
        style={{ display: 'none' }}
        data-testid="camera-capture-input"
      />

      <div className="bg-gray-900 rounded-lg max-w-md w-full p-4 text-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-lg font-semibold">
            {stage === 'capture' ? 'Capture photo' : 'Preview'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white"
            data-testid="camera-capture-close"
          >
            ✕
          </button>
        </div>

        {stage === 'capture' ? (
          <div className="py-6 text-center" data-testid="camera-capture-stage-1">
            <div className="text-gray-400 text-sm mb-3">
              Opening camera…
            </div>
            {/* Explicit fallback button. Some browsers (notably iOS Safari)
                block programmatic .click() on hidden file inputs that fire
                from useEffect — the user-gesture chain is broken between
                the modal-opening tap and the auto-click. This button gives
                the user a direct gesture path. Owner reported 2026-05-06:
                "the camera modal doesn't open. it requests to open, but
                upon approval nothing happens." */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold px-4 py-2 rounded"
              data-testid="camera-capture-open-button"
            >
              Tap to open camera
            </button>
            <div className="text-gray-500 text-[11px] mt-3">
              If your camera doesn't open automatically, tap the button above.
            </div>
          </div>
        ) : (
          <div className="space-y-3" data-testid="camera-capture-stage-2">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Captured photo preview"
                className="w-full h-auto rounded border border-gray-700"
                data-testid="camera-capture-preview"
              />
            ) : null}
          </div>
        )}

        {error ? (
          <div className="text-red-400 text-xs mt-2" data-testid="camera-capture-error">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2 justify-end mt-4">
          {stage === 'preview' ? (
            <>
              <button
                type="button"
                onClick={onRetake}
                disabled={isSaving}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm px-3 py-1.5 rounded"
                data-testid="camera-capture-retake"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={isSaving}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded"
                data-testid="camera-capture-accept"
              >
                {isSaving ? 'Saving…' : 'Accept'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded"
              data-testid="camera-capture-cancel"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
