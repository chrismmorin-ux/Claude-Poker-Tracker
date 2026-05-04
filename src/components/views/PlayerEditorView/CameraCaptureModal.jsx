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

export const CameraCaptureModal = ({ playerId, onClose, onSaved }) => {
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
      const { blobId } = await savePhotoAtomically(playerId, previewBlob);
      onSaved?.(blobId);
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
          <div className="text-gray-400 text-sm py-8 text-center" data-testid="camera-capture-stage-1">
            Opening camera…
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
