/**
 * ActionBadge.jsx - Display single action as a colored badge
 */

import React from 'react';
import { getActionBadgeStyle } from '../../constants/designTokens';
import { getActionAbbreviation } from '../../utils/actionUtils';

/**
 * ActionBadge - Displays a single action as a colored badge
 * @param {string} action - Action string (e.g., 'raise', 'call', 'fold')
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {boolean} showArrow - Whether to show arrow after badge
 */
export const ActionBadge = ({ action, size = 'medium', showArrow = false }) => {
  // Size style mappings
  const sizeStyles = {
    small: 'h-5 min-w-[16px] text-xs px-1',
    medium: 'h-7 min-w-[20px] text-sm px-1.5',
    large: 'h-9 min-w-[24px] text-base px-2'
  };

  // Get inline style from design tokens
  const colorStyle = getActionBadgeStyle(action);

  // Get abbreviated action text
  const abbreviatedAction = getActionAbbreviation(action);

  return (
    <div
      className={`inline-flex items-center justify-center rounded font-bold ${sizeStyles[size]}`}
      style={colorStyle}
    >
      {abbreviatedAction}
      {showArrow && <span className="ml-0.5">→</span>}
    </div>
  );
};
