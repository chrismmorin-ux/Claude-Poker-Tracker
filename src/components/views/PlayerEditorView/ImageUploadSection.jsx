/**
 * ImageUploadSection.jsx — Secondary image upload (PEO-2, per D6)
 *
 * Feature avatars are canonical; image upload is rare (public photos, cropped
 * portraits) and kept collapsed by default. Writes base64 into `avatar` field.
 * Respects AVATAR_MAX_SIZE_BYTES budget from playerConstants.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { AVATAR_MAX_SIZE_BYTES, AVATAR_MAX_SIZE_MB } from '../../../constants/playerConstants';

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
  reader.readAsDataURL(file);
});

export const ImageUploadSection = ({ avatar, onAvatarChange }) => {
  const [open, setOpen] = useState(!!avatar);
  const [error, setError] = useState(null);
  const Icon = open ? ChevronDown : ChevronRight;

  const handleFile = async (e) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setError(`Image too large (max ${AVATAR_MAX_SIZE_MB} MB)`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      onAvatarChange(dataUrl);
    } catch {
      setError('Could not read image file');
    }
  };

  const clear = () => onAvatarChange('');

  return (
    <div className="bg-white border border-gray-200 rounded" data-testid="image-upload-section">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-t"
        aria-expanded={open}
        data-testid="image-upload-toggle"
      >
        <Icon size={14} />
        Photo (optional)
      </button>
      {open ? (
        <div className="p-3 pt-0 space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="w-full text-xs"
            data-testid="image-upload-input"
          />
          {error ? (
            <p className="text-red-600 text-xs">{error}</p>
          ) : null}
          {avatar ? (
            <div className="flex items-center gap-2">
              <img
                src={avatar}
                alt="Player photo preview"
                className="w-16 h-16 rounded-full object-cover border border-gray-300"
              />
              <button
                type="button"
                onClick={clear}
                className="text-xs text-red-700 flex items-center gap-1 hover:underline"
                data-testid="image-clear-btn"
              >
                <X size={12} />
                Remove
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ImageUploadSection;
