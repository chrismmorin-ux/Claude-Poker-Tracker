/**
 * PhysicalSection.jsx - Physical description inputs
 *
 * Part of PlayerForm component decomposition.
 * Includes: ethnicity, build, gender, facial hair, hat, sunglasses
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  ETHNICITY_OPTIONS,
  BUILD_OPTIONS,
  GENDER_OPTIONS,
  FACIAL_HAIR_OPTIONS,
} from '../../../constants/playerConstants';

/**
 * PhysicalSection - Physical description inputs
 */
export const PhysicalSection = ({
  ethnicity,
  setEthnicity,
  build,
  setBuild,
  gender,
  setGender,
  facialHair,
  setFacialHair,
  hat,
  setHat,
  sunglasses,
  setSunglasses,
}) => {
  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Physical Description</h3>

      {/* Ethnicity */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ethnicity
        </label>
        <select
          value={ethnicity}
          onChange={(e) => setEthnicity(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select ethnicity...</option>
          {ETHNICITY_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* Build - Radio buttons */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Build
        </label>
        <div className="flex gap-3">
          {BUILD_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="build"
                value={option.value}
                checked={build === option.value}
                onChange={(e) => setBuild(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Gender - Radio buttons */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gender
        </label>
        <div className="flex gap-3">
          {GENDER_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="gender"
                value={option.value}
                checked={gender === option.value}
                onChange={(e) => setGender(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Facial Hair */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Facial Hair
        </label>
        <select
          value={facialHair}
          onChange={(e) => setFacialHair(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select facial hair...</option>
          {FACIAL_HAIR_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* Checkboxes - Hat and Sunglasses */}
      <div className="flex gap-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={hat}
            onChange={(e) => setHat(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm">Wears Hat</span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={sunglasses}
            onChange={(e) => setSunglasses(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm">Wears Sunglasses</span>
        </label>
      </div>
    </div>
  );
};

PhysicalSection.propTypes = {
  ethnicity: PropTypes.string.isRequired,
  setEthnicity: PropTypes.func.isRequired,
  build: PropTypes.string.isRequired,
  setBuild: PropTypes.func.isRequired,
  gender: PropTypes.string.isRequired,
  setGender: PropTypes.func.isRequired,
  facialHair: PropTypes.string.isRequired,
  setFacialHair: PropTypes.func.isRequired,
  hat: PropTypes.bool.isRequired,
  setHat: PropTypes.func.isRequired,
  sunglasses: PropTypes.bool.isRequired,
  setSunglasses: PropTypes.func.isRequired,
};
