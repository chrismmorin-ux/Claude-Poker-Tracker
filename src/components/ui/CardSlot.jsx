import React from 'react';
import PropTypes from 'prop-types';
import { isRedCard } from '../../utils/displayUtils';

/**
 * CardSlot - Reusable card display component
 *
 * @param {string} card - Card string (e.g., 'A♠', 'K♥')
 * @param {string} variant - Display size variant: 'table', 'hole-table', 'showdown', 'selector'
 * @param {boolean} isHighlighted - Whether to show highlight ring
 * @param {boolean} isHidden - Whether to show as hidden (face down)
 * @param {string} status - Status overlay: 'folded', 'absent', 'mucked', 'won', or null
 * @param {function} onClick - Click handler
 * @param {boolean} canInteract - Whether the card can be clicked
 */
export const CardSlot = ({
  card,
  variant = 'showdown',
  isHighlighted = false,
  isHidden = false,
  status = null,
  onClick = null,
  canInteract = true,
  SEAT_STATUS = null, // Pass SEAT_STATUS constant if using status
}) => {
  // Size configurations for different variants
  const sizeConfig = {
    'table': { width: 70, height: 100, fontSize: 'text-2xl', plusSize: 'text-4xl' },
    'hole-table': { width: 40, height: 58, fontSize: 'text-xl', plusSize: 'text-2xl' },
    'showdown': { width: 50, height: 70, fontSize: 'text-lg', plusSize: 'text-2xl' },
    'selector': { width: 60, height: 85, fontSize: 'text-xl', plusSize: 'text-3xl' },
  };

  const size = sizeConfig[variant] || sizeConfig.showdown;

  // Determine background color based on state
  let bgColor = 'bg-gray-300';
  if (isHidden) {
    bgColor = 'bg-gray-700';
  } else if (card) {
    bgColor = 'bg-white';
  } else if (status === 'mucked') {
    bgColor = 'bg-gray-400';
  } else if (status === 'won') {
    bgColor = 'bg-green-200';
  } else if (SEAT_STATUS && status === SEAT_STATUS.FOLDED) {
    bgColor = 'bg-red-200';
  } else if (SEAT_STATUS && status === SEAT_STATUS.ABSENT) {
    bgColor = 'bg-gray-300';
  } else if (variant === 'table') {
    bgColor = card ? 'bg-white' : 'bg-gray-700';
  }

  // Determine opacity
  const opacity = (status && status !== 'won') || isHidden ? 'opacity-60' : '';

  // Highlight and interaction styles
  const highlightStyle = isHighlighted ? 'ring-4 ring-yellow-400 scale-110' : '';
  const hoverStyle = canInteract && !isHighlighted && onClick ? 'hover:ring-2 hover:ring-blue-400 cursor-pointer' : '';
  const tableHoverStyle = variant === 'table' && onClick ? 'hover:ring-4 hover:ring-yellow-400 cursor-pointer' : '';
  const cursorStyle = !canInteract ? 'cursor-default' : '';

  return (
    <div
      className={`${bgColor} rounded-lg shadow-lg flex items-center justify-center font-bold ${size.fontSize} transition-all ${opacity} ${highlightStyle} ${hoverStyle} ${tableHoverStyle} ${cursorStyle}`}
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
      onClick={canInteract && onClick ? onClick : undefined}
    >
      {!isHidden && card ? (
        <span className={isRedCard(card) ? 'text-red-600' : 'text-black'}>{card}</span>
      ) : (
        <span className={`text-gray-400 ${size.plusSize}`}>{isHidden ? '' : '+'}</span>
      )}
    </div>
  );
};

CardSlot.propTypes = {
  card: PropTypes.string,
  variant: PropTypes.oneOf(['table', 'hole-table', 'showdown', 'selector']),
  isHighlighted: PropTypes.bool,
  isHidden: PropTypes.bool,
  status: PropTypes.oneOf(['folded', 'absent', 'mucked', 'won', null]),
  onClick: PropTypes.func,
  canInteract: PropTypes.bool,
  SEAT_STATUS: PropTypes.shape({
    FOLDED: PropTypes.string,
    ABSENT: PropTypes.string,
  }),
};
