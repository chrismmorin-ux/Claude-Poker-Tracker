/**
 * PlayerForm.jsx - Player creation/editing form
 *
 * Modal form for creating or editing player profiles.
 * Allows physical descriptions, style tags, notes, and avatar upload.
 */

import React, { useState } from 'react';
import {
  ETHNICITY_OPTIONS,
  BUILD_OPTIONS,
  GENDER_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  STYLE_TAGS,
  AVATAR_MAX_SIZE_BYTES
} from '../../constants/playerConstants';

/**
 * PlayerForm component
 * @param {Object} props
 * @param {Function} props.onSubmit - Callback when form is submitted: (playerData) => void
 * @param {Function} props.onCancel - Callback when form is cancelled
 * @param {number} props.scale - Scale factor for responsive design
 * @param {Object} props.initialData - Optional initial data for editing
 * @param {string} props.defaultName - Optional default name to pre-fill (from search)
 */
export const PlayerForm = ({ onSubmit, onCancel, scale = 1, initialData = null, defaultName = '' }) => {
  // State - Initialize with initialData if editing, or defaultName if creating
  const [name, setName] = useState(initialData?.name || defaultName || '');
  const [nickname, setNickname] = useState(initialData?.nickname || '');
  const [ethnicity, setEthnicity] = useState(initialData?.ethnicity || '');
  const [build, setBuild] = useState(initialData?.build || '');
  const [gender, setGender] = useState(initialData?.gender || '');
  const [facialHair, setFacialHair] = useState(initialData?.facialHair || '');
  const [hat, setHat] = useState(initialData?.hat || false);
  const [sunglasses, setSunglasses] = useState(initialData?.sunglasses || false);
  const [styleTags, setStyleTags] = useState(initialData?.styleTags || []);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || null);
  const [errors, setErrors] = useState({});

  const isEditing = !!initialData;

  // Handle style tag toggle
  const handleStyleTagToggle = (tag) => {
    if (styleTags.includes(tag)) {
      setStyleTags(styleTags.filter(t => t !== tag));
    } else {
      setStyleTags([...styleTags, tag]);
    }
  };

  // Handle avatar file upload
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setErrors({
        ...errors,
        avatar: `File too large. Maximum size is ${AVATAR_MAX_SIZE_BYTES / 1024 / 1024}MB`
      });
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatar(event.target.result);
      setErrors({ ...errors, avatar: null });
    };
    reader.readAsDataURL(file);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    const newErrors = {};

    if (!name || name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare player data
    const playerData = {
      name: name.trim(),
      nickname: nickname.trim() || null,
      ethnicity: ethnicity || null,
      build: build || null,
      gender: gender || null,
      facialHair: facialHair || null,
      hat: hat,
      sunglasses: sunglasses,
      styleTags: styleTags,
      notes: notes.trim() || null,
      avatar: avatar || null
    };

    onSubmit(playerData);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditing ? 'Edit Player' : 'Create New Player'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Physical Description Section */}
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

          {/* Playing Style Tags */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Playing Style Tags
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_TAGS.map((tag) => (
                <label key={tag} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styleTags.includes(tag)}
                    onChange={() => handleStyleTagToggle(tag)}
                    className="mr-2"
                  />
                  <span className="text-xs">{tag}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Avatar Upload */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avatar (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full text-sm"
            />
            {errors.avatar && (
              <p className="text-red-500 text-xs mt-1">{errors.avatar}</p>
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this player..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors font-medium"
            >
              {isEditing ? 'Save Changes' : 'Create Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
