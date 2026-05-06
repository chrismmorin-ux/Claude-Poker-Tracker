/**
 * @file CameraCaptureModal — capture or upload a photo, manually crop, save.
 *
 * Three stages:
 *   1. SOURCE       — user picks Camera (capture=environment) or Upload
 *                     (no capture attribute, gallery + files).
 *   2. CROP         — react-easy-crop renders the chosen image with
 *                     pinch-to-zoom + drag-to-pan + zoom slider. User
 *                     positions the square crop window over the desired
 *                     face. Auto-detection isn't reliable across
 *                     orientation / lighting / multi-face shots, so manual
 *                     positioning is the load-bearing path.
 *   3. SAVE         — generateCroppedBlob renders the user's crop region
 *                     into a 512×512 JPEG. Either:
 *                       - savePhotoAtomically (production path, atomic
 *                         player + photo IDB write), OR
 *                       - onAcceptOverride(blob, previewUrl) when provided
 *                         (prototype: stash for live-builder avatar without
 *                          IDB writes).
 *
 * Owner ask 2026-05-06: "We should have the modal, after taking the
 * picture, able to support the user zooming with a pinch or expand finger
 * motion, and draggable centering. … support uploading a photo, that the
 * user can then crop in the same way."
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, Upload, X } from 'lucide-react';
import { generateCroppedBlob } from '../../../utils/playerMatching/generateCroppedBlob';
import { savePhotoAtomically } from '../../../utils/persistence/savePhotoAtomically';

export const CameraCaptureModal = ({ playerId, onClose, onSaved, onAcceptOverride }) => {
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  // Stages: 'source' (pick camera/upload), 'crop' (manual position), 'saving'.
  const [stage, setStage] = useState('source');
  const [imageUrl, setImageUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Revoke any object URL we created on unmount or replacement.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const onSourceFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User dismissed picker without selecting — stay on source stage.
      return;
    }
    setError(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    // Reset crop state for the new image.
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setStage('crop');
  };

  const startCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };
  const startUpload = () => {
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
      uploadInputRef.current.click();
    }
  };

  const onRetake = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setStage('source');
    setError(null);
  };

  const onAccept = async () => {
    if (!imageUrl || !croppedAreaPixels) return;
    setIsSaving(true);
    setError(null);
    try {
      const blob = await generateCroppedBlob(imageUrl, croppedAreaPixels);
      if (onAcceptOverride) {
        // Prototype path — caller handles the blob (no IDB write).
        const previewUrl = URL.createObjectURL(blob);
        await onAcceptOverride(blob, previewUrl);
        onClose?.();
      } else {
        // Production path — atomic save + emit blobId.
        const { blobId } = await savePhotoAtomically(playerId, blob);
        onSaved?.(blobId);
      }
    } catch (err) {
      setError(err?.message || 'Save failed');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3"
      data-testid="camera-capture-modal"
    >
      {/* Hidden inputs — fired programmatically. Camera input has
          capture='environment' (back camera on phones); upload input has
          no capture attribute so the OS shows the gallery / files picker. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onSourceFileSelected}
        style={{ display: 'none' }}
        data-testid="camera-capture-input"
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={onSourceFileSelected}
        style={{ display: 'none' }}
        data-testid="camera-upload-input"
      />

      <div className="bg-slate-900 rounded-lg max-w-md w-full text-gray-200 flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-white text-base font-semibold">
            {stage === 'source' ? 'Add photo' : 'Position the crop'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-white disabled:opacity-50 p-1"
            aria-label="Close"
            data-testid="camera-capture-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {stage === 'source' ? (
          <div className="px-4 py-6 flex flex-col gap-3" data-testid="camera-capture-stage-source">
            <p className="text-sm text-gray-400 mb-1">
              Take a new photo or upload one from your gallery. You'll be
              able to drag and pinch-zoom to position the crop after.
            </p>
            <button
              type="button"
              onClick={startCamera}
              className="flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 text-white font-semibold rounded-lg py-3 min-h-[48px]"
              data-testid="camera-capture-take"
            >
              <Camera size={18} />
              Take photo
            </button>
            <button
              type="button"
              onClick={startUpload}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-gray-100 font-semibold rounded-lg py-3 min-h-[48px]"
              data-testid="camera-upload"
            >
              <Upload size={18} />
              Upload from gallery
            </button>
          </div>
        ) : null}

        {stage === 'crop' && imageUrl ? (
          <div className="flex flex-col" data-testid="camera-capture-stage-crop">
            {/* Crop surface — fixed-aspect square via aspect ratio 1; the
                crop area is fixed in viewport, image moves under it via
                pinch+drag. */}
            <div className="relative w-full bg-black" style={{ height: 'min(70vh, 360px)' }}>
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                minZoom={1}
                maxZoom={5}
              />
            </div>
            {/* Zoom slider — alternative to pinch-to-zoom for desktop +
                accessibility. Pinch on the crop surface above always works. */}
            <div className="px-4 py-3 border-t border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold w-10 shrink-0">
                  Zoom
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-amber-500"
                  data-testid="camera-capture-zoom-slider"
                  aria-label="Zoom"
                />
                <span className="text-[11px] text-gray-400 w-10 text-right tabular-nums">
                  {zoom.toFixed(2)}×
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mt-2 text-center">
                Drag to position · pinch to zoom
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            className="text-red-400 text-xs mx-4 my-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded"
            data-testid="camera-capture-error"
          >
            {error}
          </div>
        ) : null}

        {/* Footer actions */}
        <div className="flex gap-2 justify-end px-4 py-3 border-t border-slate-700">
          {stage === 'crop' ? (
            <>
              <button
                type="button"
                onClick={onRetake}
                disabled={isSaving}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-gray-300 text-sm font-semibold px-4 py-2 rounded-md min-h-[44px]"
                data-testid="camera-capture-retake"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={isSaving || !croppedAreaPixels}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 text-sm font-semibold px-4 py-2 rounded-md min-h-[44px]"
                data-testid="camera-capture-accept"
              >
                {isSaving ? 'Saving…' : 'Accept'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm font-semibold px-4 py-2 rounded-md min-h-[44px]"
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
