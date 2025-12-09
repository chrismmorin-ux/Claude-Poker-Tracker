/**
 * StyleTagsSection.jsx - Playing style checkboxes
 *
 * Part of PlayerForm component decomposition.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { STYLE_TAGS } from '../../../constants/playerConstants';

/**
 * StyleTagsSection - Playing style tag checkboxes
 */
export const StyleTagsSection = ({
  styleTags,
  onToggleTag,
}) => {
  return (
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
              onChange={() => onToggleTag(tag)}
              className="mr-2"
            />
            <span className="text-xs">{tag}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

StyleTagsSection.propTypes = {
  styleTags: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleTag: PropTypes.func.isRequired,
};
