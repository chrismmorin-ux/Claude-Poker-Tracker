import React from 'react';

/**
 * VisibilityToggle - Button to show/hide hole cards
 *
 * @param {boolean} visible - Whether cards are currently visible
 * @param {function} onToggle - Click handler
 * @param {string} size - 'small' (24px) or 'large' (40px)
 */
export const VisibilityToggle = ({ visible, onToggle, size = 'small' }) => {
  const sizeStyle = size === 'small'
    ? { width: '24px', height: '24px' }
    : { width: '40px', height: '40px' };
  const textSize = size === 'small' ? 'text-xs' : 'text-xl';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="bg-gray-600 hover:bg-gray-700 rounded shadow flex items-center justify-center cursor-pointer"
      style={sizeStyle}
    >
      <div className={`text-white ${textSize}`}>{visible ? '👁' : '👁‍🗨'}</div>
    </button>
  );
};
