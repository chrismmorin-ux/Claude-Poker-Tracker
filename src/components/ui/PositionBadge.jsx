import React from 'react';

// Badge type configurations
const BADGE_CONFIG = {
  dealer: {
    bg: 'bg-white',
    border: 'border-gray-800',
    text: 'text-black',
    label: 'D',
  },
  sb: {
    bg: 'bg-blue-400',
    border: 'border-blue-600',
    text: 'text-white',
    label: 'SB',
  },
  bb: {
    bg: 'bg-red-400',
    border: 'border-red-600',
    text: 'text-white',
    label: 'BB',
  },
  me: {
    bg: 'bg-purple-500',
    border: 'border-purple-700',
    text: 'text-white',
    label: 'ME',
  },
};

/**
 * PositionBadge - Displays D, SB, BB, or ME indicators
 *
 * @param {string} type - Badge type: 'dealer', 'sb', 'bb', 'me'
 * @param {string} size - 'small' (16px) for showdown view, 'large' (28px) for table view
 * @param {boolean} draggable - Whether the badge can be dragged
 * @param {function} onDragStart - Drag start handler
 */
export const PositionBadge = ({ type, size = 'small', draggable = false, onDragStart = null }) => {
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  const sizeClass = size === 'small' ? 'w-4 h-4' : 'w-[28px] h-[28px]';
  const textSize = size === 'small' ? 'text-xs' : (type === 'dealer' ? 'text-lg' : 'text-xs');
  const borderWidth = size === 'small' ? 'border-2' : 'border-2';

  return (
    <div
      className={`${config.bg} rounded-full shadow flex items-center justify-center ${borderWidth} ${config.border} ${
        draggable ? 'cursor-move select-none shadow-xl' : ''
      }`}
      style={size === 'small' ? { width: '16px', height: '16px' } : { width: '28px', height: '28px' }}
      onMouseDown={draggable ? onDragStart : undefined}
    >
      <div className={`${textSize} font-bold ${config.text}`}>{config.label}</div>
    </div>
  );
};
