/**
 * PlayerForm/index.jsx - Player creation/editing form
 *
 * Modal form for creating or editing player profiles.
 * Orchestrates section components for physical descriptions, style tags, notes, and avatar.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { AVATAR_MAX_SIZE_BYTES } from '../../../constants/playerConstants';
import { BasicInfoSection } from './BasicInfoSection';
import { PhysicalSection } from './PhysicalSection';
import { StyleTagsSection } from './StyleTagsSection';
import { AvatarSection } from './AvatarSection';
import { NotesSection } from './NotesSection';

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
          <BasicInfoSection
            name={name}
            setName={setName}
            nickname={nickname}
            setNickname={setNickname}
            errors={errors}
          />

          <PhysicalSection
            ethnicity={ethnicity}
            setEthnicity={setEthnicity}
            build={build}
            setBuild={setBuild}
            gender={gender}
            setGender={setGender}
            facialHair={facialHair}
            setFacialHair={setFacialHair}
            hat={hat}
            setHat={setHat}
            sunglasses={sunglasses}
            setSunglasses={setSunglasses}
          />

          <StyleTagsSection
            styleTags={styleTags}
            onToggleTag={handleStyleTagToggle}
          />

          <AvatarSection
            avatar={avatar}
            onAvatarChange={handleAvatarChange}
            error={errors.avatar}
          />

          <NotesSection
            notes={notes}
            setNotes={setNotes}
          />

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

PlayerForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  scale: PropTypes.number,
  initialData: PropTypes.shape({
    name: PropTypes.string,
    nickname: PropTypes.string,
    ethnicity: PropTypes.string,
    build: PropTypes.string,
    gender: PropTypes.string,
    facialHair: PropTypes.string,
    hat: PropTypes.bool,
    sunglasses: PropTypes.bool,
    styleTags: PropTypes.arrayOf(PropTypes.string),
    notes: PropTypes.string,
    avatar: PropTypes.string,
  }),
  defaultName: PropTypes.string,
};
