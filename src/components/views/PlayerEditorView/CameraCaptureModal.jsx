/**
 * @file CameraCaptureModal — capture or upload a photo, manually crop, save.
 *
 * Three stages (FSM-managed):
 *   1. SOURCE       — user picks Camera (capture=environment) or Upload
 *                     (no capture attribute, gallery + files).
 *   2. PREPARING    — file picked; downscaling source to 1500×1500 max
 *                     edge BEFORE the Cropper renders. Keeps memory
 *                     pressure low on mobile (Galaxy A22, etc.) per
 *                     WS-184 / SPR-076. Brief — usually 50-200ms.
 *   3. CROPPING     — react-easy-crop renders the downscaled image with
 *                     pinch-to-zoom + drag-to-pan + zoom slider. User
 *                     positions the square crop window.
 *   4. SAVING       — generateCroppedBlob renders the user's crop region
 *                     into a 512×512 JPEG. Either:
 *                       - savePhotoAtomically (production path, atomic
 *                         player + photo IDB write), OR
 *                       - onAcceptOverride(blob, previewUrl) when provided
 *                         (prototype: stash for live-builder avatar without
 *                          IDB writes).
 *
 * FSM (WS-184 / SPR-076) — every transition is named; no silent stage
 * changes. Each transition logs in dev. Replaces the prior 20-line
 * imperative onAccept that held isSaving/stage/error in three useState
 * hooks with no transition discipline (Bugs A-E).
 *
 * Owner ask 2026-05-06: pinch-zoom + draggable centering for both camera
 * and upload sources.
 */

import React, { useEffect, useReducer, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, Upload, X } from 'lucide-react';
import { generateCroppedBlob } from '../../../utils/playerMatching/generateCroppedBlob';
import { downscaleImageBlob } from '../../../utils/playerMatching/downscaleImageBlob';
import { savePhotoAtomically } from '../../../utils/persistence/savePhotoAtomically';

// Per WS-184 D2 ratification: bounding-box max edge for source-image
// downscale at file-pick time. Keeps Cropper + crop-canvas memory
// envelope predictable on mobile.
const SOURCE_MAX_EDGE = 1500;

// Per WS-184 D3 ratification: single user-facing copy for any failure in
// the camera path. Steers user to in-modal recovery (Retake / Take photo)
// with Upload mentioned only as a secondary option if it keeps failing.
// Raw err.message goes to dev console only.
const FAILURE_COPY = "Couldn't process this photo. Try again — if it keeps failing, you can also Upload from your gallery.";

const STAGE = {
  SOURCE: 'source',
  PREPARING: 'preparing',
  CROPPING: 'cropping',
  SAVING: 'saving',
};

const INITIAL_STATE = {
  stage: STAGE.SOURCE,
  imageUrl: null,
  error: null,
};

const isDev = (() => {
  try { return !!import.meta.env?.DEV; } catch { return false; }
})();

const logTransition = (from, action) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[CameraCaptureModal FSM]', from, '→', action.type);
  }
};

const reducer = (state, action) => {
  logTransition(state.stage, action);
  switch (action.type) {
    case 'SOURCE_FILE_PICKED':
      return { stage: STAGE.PREPARING, imageUrl: null, error: null };
    case 'DOWNSCALE_OK':
      return { stage: STAGE.CROPPING, imageUrl: action.imageUrl, error: null };
    case 'DOWNSCALE_FAIL':
      // Stay on source stage — user can re-tap Take photo or Upload.
      return { stage: STAGE.SOURCE, imageUrl: null, error: FAILURE_COPY };
    case 'ACCEPT_TAPPED':
      return { ...state, stage: STAGE.SAVING, error: null };
    case 'SAVE_FAIL':
      // Return to crop stage — user keeps their positioned crop and can
      // Retake or re-tap Accept. Avoids losing their work on transient errors.
      return { ...state, stage: STAGE.CROPPING, error: FAILURE_COPY };
    case 'RETAKE':
      return { stage: STAGE.SOURCE, imageUrl: null, error: null };
    default:
      return state;
  }
};

export const CameraCaptureModal = ({ playerId, onClose, onSaved, onAcceptOverride }) => {
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { stage, imageUrl, error } = state;

  // Cropper widget state stays as plain useState — react-easy-crop owns
  // these and they're reset whenever a fresh source enters the cropping
  // stage. Tracking them via the FSM would just shuffle data without any
  // discipline win.
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState(null);

  // Revoke any object URL we created on unmount or replacement.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const onSourceFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User dismissed picker without selecting — stay on source stage.
      return;
    }
    dispatch({ type: 'SOURCE_FILE_PICKED' });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);

    try {
      // Per WS-184 D1 + D2: downscale BEFORE the Cropper renders the source.
      // Keeps mobile memory under ~9MB even on 13MP sensor shots.
      const downscaled = await downscaleImageBlob(file, SOURCE_MAX_EDGE);
      const url = URL.createObjectURL(downscaled);
      dispatch({ type: 'DOWNSCALE_OK', imageUrl: url });
    } catch (err) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[CameraCaptureModal] downscale failed:', err);
      }
      dispatch({ type: 'DOWNSCALE_FAIL' });
    }
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
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    dispatch({ type: 'RETAKE' });
  };

  const onAccept = async () => {
    // Belt + suspenders — the Accept button is disabled when the FSM
    // isn't in CROPPING with croppedAreaPixels set. This guard exists
    // so that if some future caller programmatically calls onAccept,
    // it can't drop silently.
    if (stage !== STAGE.CROPPING || !imageUrl || !croppedAreaPixels) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.warn('[CameraCaptureModal] onAccept called from invalid state', { stage, hasImage: !!imageUrl, hasCrop: !!croppedAreaPixels });
      }
      return;
    }
    dispatch({ type: 'ACCEPT_TAPPED' });
    try {
      const blob = await generateCroppedBlob(imageUrl, croppedAreaPixels);
      if (onAcceptOverride) {
        // Prototype path — caller handles the blob (no IDB write).
        const previewUrl = URL.createObjectURL(blob);
        await onAcceptOverride(blob, previewUrl);
        // Caller manages preview lifecycle. Close + unmount.
        onClose?.();
        return;
      }
      // Production path — atomic save + emit blobId AND preview URL so the
      // caller can update its avatar overlay without re-fetching the blob
      // from IDB. This closes Bug E (avatar render-chain refresh): the
      // chain is CameraCaptureModal → onSaved(blobId, photoUrl) →
      // PlayerFinderView setCapturedPreviewUrl → IdentityAvatar
      // photoOverlay re-render.
      const { blobId } = await savePhotoAtomically(playerId, blob);
      const photoUrl = URL.createObjectURL(blob);
      onSaved?.(blobId, photoUrl);
      onClose?.();
    } catch (err) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[CameraCaptureModal] save failed:', err);
      }
      dispatch({ type: 'SAVE_FAIL' });
    }
  };

  const isSaving = stage === STAGE.SAVING;
  const isPreparing = stage === STAGE.PREPARING;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3"
      data-testid="camera-capture-modal"
      data-fsm-stage={stage}
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
            {stage === STAGE.SOURCE ? 'Add photo' : 'Position the crop'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isPreparing}
            className="text-gray-400 hover:text-white disabled:opacity-50 p-1"
            aria-label="Close"
            data-testid="camera-capture-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {stage === STAGE.SOURCE || stage === STAGE.PREPARING ? (
          <div className="px-4 py-6 flex flex-col gap-3" data-testid="camera-capture-stage-source">
            <p className="text-sm text-gray-400 mb-1">
              Take a new photo or upload one from your gallery. You'll be
              able to drag and pinch-zoom to position the crop after.
            </p>
            <button
              type="button"
              onClick={startCamera}
              disabled={isPreparing}
              className="flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 min-h-[48px]"
              data-testid="camera-capture-take"
            >
              <Camera size={18} />
              {isPreparing ? 'Preparing…' : 'Take photo'}
            </button>
            <button
              type="button"
              onClick={startUpload}
              disabled={isPreparing}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-gray-100 font-semibold rounded-lg py-3 min-h-[48px]"
              data-testid="camera-upload"
            >
              <Upload size={18} />
              Upload from gallery
            </button>
          </div>
        ) : null}

        {(stage === STAGE.CROPPING || stage === STAGE.SAVING) && imageUrl ? (
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
                  disabled={isSaving}
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
            className="text-red-300 text-xs mx-4 my-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded"
            data-testid="camera-capture-error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {/* Footer actions */}
        <div className="flex gap-2 justify-end px-4 py-3 border-t border-slate-700">
          {stage === STAGE.CROPPING || stage === STAGE.SAVING ? (
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
              disabled={isPreparing}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-gray-300 text-sm font-semibold px-4 py-2 rounded-md min-h-[44px]"
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
