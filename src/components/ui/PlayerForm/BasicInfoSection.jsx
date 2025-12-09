/**
 * BasicInfoSection.jsx - Name and nickname inputs
 *
 * Part of PlayerForm component decomposition.
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * BasicInfoSection - Name and nickname inputs
 */
export const BasicInfoSection = ({
  name,
  setName,
  nickname,
  setNickname,
  errors,
}) => {
  return (
    <>
      {/* Name - Required */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player's name or nickname"
          className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
        )}
      </div>

      {/* Nickname */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nickname (optional)
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Alternative name or alias"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </>
  );
};

BasicInfoSection.propTypes = {
  name: PropTypes.string.isRequired,
  setName: PropTypes.func.isRequired,
  nickname: PropTypes.string.isRequired,
  setNickname: PropTypes.func.isRequired,
  errors: PropTypes.object.isRequired,
};
