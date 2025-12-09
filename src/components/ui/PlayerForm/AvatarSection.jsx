/**
 * AvatarSection.jsx - Avatar upload and preview
 *
 * Part of PlayerForm component decomposition.
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * AvatarSection - Avatar upload and preview
 */
export const AvatarSection = ({
  avatar,
  onAvatarChange,
  error,
}) => {
  return (
    <div className="border-t pt-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Avatar (optional)
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={onAvatarChange}
        className="w-full text-sm"
      />
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
      {avatar && (
        <div className="mt-2">
          <img
            src={avatar}
            alt="Avatar preview"
            className="w-20 h-20 object-cover rounded-full border border-gray-300"
          />
        </div>
      )}
    </div>
  );
};

AvatarSection.propTypes = {
  avatar: PropTypes.string,
  onAvatarChange: PropTypes.func.isRequired,
  error: PropTypes.string,
};
