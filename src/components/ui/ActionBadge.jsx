/**
 * ActionBadge.jsx - Display single action as a colored badge
 */

import React from 'react';
import { getActionColor, getActionAbbreviation } from '../../utils/actionUtils';
import { isFoldAction } from '../../constants/gameConstants';

/**
 * ActionBadge - Displays a single action as a colored badge
 * @param {string} action - Action constant (e.g., ACTIONS.OPEN)
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {boolean} showArrow - Whether to show arrow after badge
 * @param {Object} ACTIONS - Actions constants
 * @param {Object} ACTION_ABBREV - Action abbreviations map
 */
export const ActionBadge = ({ action, size = 'medium', showArrow = false, ACTIONS, ACTION_ABBREV }) => {
  // Size style mappings
  const sizeStyles = {
    small: 'h-5 min-w-[16px] text-xs px-1',
    medium: 'h-7 min-w-[20px] text-sm px-1.5',
    large: 'h-9 min-w-[24px] text-base px-2'
  };

  // Get color classes from utility (returns full Tailwind class string)
  const colorClasses = getActionColor(action, isFoldAction, ACTIONS);

  // Get abbreviated action text
  const abbreviatedAction = getActionAbbreviation(action, ACTION_ABBREV);

  return (
    <div className={`inline-flex items-center justify-center rounded font-bold ${sizeStyles[size]} ${colorClasses}`}>
      {abbreviatedAction}
      {showArrow && <span className="ml-0.5">→</span>}
    </div>
  );
};
