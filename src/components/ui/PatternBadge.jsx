/**
 * PatternBadge.jsx - Display poker pattern as a colored badge
 *
 * Works with the pattern recognition system (Phase 4) to display
 * derived patterns like limp, open, 3bet, cbet, check-raise, etc.
 */

import React from 'react';
import {
  getPatternColor,
  getPatternAbbreviation,
  getPatternDisplayName,
} from '../../utils/actionUtils';

/**
 * PatternBadge - Displays a single pattern as a colored badge
 * @param {string} pattern - Pattern constant from patternRecognition (e.g., 'open', '3bet', 'cbet-ip')
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {boolean} showArrow - Whether to show arrow after badge
 * @param {boolean} showFullName - Whether to show full name instead of abbreviation
 */
export const PatternBadge = ({
  pattern,
  size = 'medium',
  showArrow = false,
  showFullName = false,
}) => {
  if (!pattern) return null;

  // Size style mappings
  const sizeStyles = {
    small: 'h-5 min-w-[16px] text-xs px-1',
    medium: 'h-7 min-w-[20px] text-sm px-1.5',
    large: 'h-9 min-w-[24px] text-base px-2',
  };

  // Get color classes from utility
  const colorClasses = getPatternColor(pattern);

  // Get display text
  const displayText = showFullName
    ? getPatternDisplayName(pattern)
    : getPatternAbbreviation(pattern);

  // Tooltip always shows full name
  const tooltipText = getPatternDisplayName(pattern);

  return (
    <div
      className={`inline-flex items-center justify-center rounded font-bold ${sizeStyles[size]} ${colorClasses}`}
      title={tooltipText}
    >
      {displayText}
      {showArrow && <span className="ml-0.5">→</span>}
    </div>
  );
};

/**
 * PatternSequence - Displays a horizontal sequence of pattern badges
 * @param {Array<string>} patterns - Array of pattern constants
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {number} maxVisible - Maximum badges to show before overflow (default: 3)
 */
export const PatternSequence = ({
  patterns = [],
  size = 'medium',
  maxVisible = 3,
}) => {
  if (!patterns || patterns.length === 0) {
    return null;
  }

  // Calculate overflow
  const hasOverflow = patterns.length > maxVisible;
  const visiblePatterns = hasOverflow ? patterns.slice(0, maxVisible - 1) : patterns;
  const overflowCount = hasOverflow ? patterns.length - visiblePatterns.length : 0;

  // Get full sequence for tooltip
  const tooltipText = patterns.map(p => getPatternDisplayName(p)).join(' → ');

  // Size-specific gap
  const gapClass = size === 'small' ? 'gap-0.5' : size === 'medium' ? 'gap-1' : 'gap-1.5';

  return (
    <div className={`flex items-center ${gapClass}`} title={tooltipText}>
      {visiblePatterns.map((pattern, index) => (
        <React.Fragment key={index}>
          <PatternBadge pattern={pattern} size={size} showArrow={false} />
          {(index < visiblePatterns.length - 1 || hasOverflow) && (
            <span className="text-gray-500 text-xs">→</span>
          )}
        </React.Fragment>
      ))}
      {hasOverflow && (
        <div
          className={`inline-flex items-center justify-center rounded font-bold bg-gray-200 text-gray-700
          ${
            size === 'small'
              ? 'h-5 min-w-[16px] text-xs px-1'
              : size === 'medium'
              ? 'h-7 min-w-[20px] text-sm px-1.5'
              : 'h-9 min-w-[24px] text-base px-2'
          }`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
};

export default PatternBadge;
