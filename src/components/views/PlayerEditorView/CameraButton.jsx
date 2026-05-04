/**
 * @file CameraButton — gated by settings.privacy.photoCaptureEnabled.
 *
 * Renders only when the privacy toggle is ON (per AP-PIO-03 privacy-first).
 * Click opens CameraCaptureModal; on save, fires onPhotoSaved(blobId) so the
 * parent (PlayerEditor) can update form state.
 *
 * SPR-036 / WS-161 (2026-05-04).
 */

import React, { useState } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { CameraCaptureModal } from './CameraCaptureModal';

export const CameraButton = ({ playerId, photoBlobId, onPhotoSaved }) => {
  const { settings } = useSettings();
  const photoCaptureEnabled = !!settings?.privacy?.photoCaptureEnabled;
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!photoCaptureEnabled) return null;
  // No playerId → can't save (e.g., Create mode pre-save). Hide button.
  if (!playerId) return null;

  const label = photoBlobId ? 'Replace photo' : 'Add photo';

  const handleSaved = (blobId) => {
    setIsModalOpen(false);
    onPhotoSaved?.(blobId);
  };

  return (
    <div className="mb-4" data-testid="player-editor-camera-button">
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="bg-cyan-700 hover:bg-cyan-600 text-white text-sm px-3 py-2 rounded"
        data-testid="player-editor-camera-button-trigger"
      >
        📷 {label}
      </button>
      {isModalOpen ? (
        <CameraCaptureModal
          playerId={playerId}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
};
