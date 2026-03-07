/**
 * ActionSequence.jsx - Display sequence of actions with overflow handling
 * Supports both legacy ACTIONS.* and primitive action values.
 */

import React from 'react';
import { ActionBadge } from './ActionBadge';
import { isPrimitiveAction, PRIMITIVE_BUTTON_CONFIG } from '../../constants/primitiveActions';
import { isFoldAction } from '../../constants/gameConstants';
import { getActionDisplayName } from '../../utils/actionUtils';

/** Abbreviations for primitive actions */
const PRIMITIVE_ABBREV = {
  check: 'Ck',
  bet: 'B',
  call: 'C',
  raise: 'R',
  fold: 'F',
};

/** Color classes for primitive action badges */
const PRIMITIVE_COLORS = {
  check: 'bg-blue-400 text-white',
  bet: 'bg-green-400 text-white',
  call: 'bg-blue-300 text-white',
  raise: 'bg-orange-400 text-white',
  fold: 'bg-red-400 text-white',
};

/**
 * ActionSequence - Displays a horizontal sequence of action badges
 * @param {Array<string>} actions - Array of action constants (legacy or primitive)
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {number} maxVisible - Maximum badges to show before overflow (default: 3)
 * @param {Object} ACTIONS - Actions constants (optional, for legacy actions)
 * @param {Object} ACTION_ABBREV - Action abbreviations map (optional, for legacy actions)
 */
export const ActionSequence = ({
  actions = [],
  size = 'medium',
  maxVisible = 3,
  ACTIONS,
  ACTION_ABBREV
}) => {
  if (!actions || actions.length === 0) {
    return null;
  }

  // Calculate overflow
  const hasOverflow = actions.length > maxVisible;
  const visibleActions = hasOverflow ? actions.slice(0, maxVisible - 1) : actions;
  const overflowCount = hasOverflow ? actions.length - visibleActions.length : 0;

  // Get display name for tooltip
  const getDisplayName = (action) => {
    if (isPrimitiveAction(action)) {
      return PRIMITIVE_BUTTON_CONFIG[action]?.label || action;
    }
    if (!ACTIONS) return action;
    return getActionDisplayName(action, isFoldAction, ACTIONS);
  };

  const tooltipText = actions.map(a => getDisplayName(a)).join(' → ');

  const sizeStyles = {
    small: 'h-5 min-w-[16px] text-xs px-1',
    medium: 'h-7 min-w-[20px] text-sm px-1.5',
    large: 'h-9 min-w-[24px] text-base px-2',
  };

  const gapClass = size === 'small' ? 'gap-0.5' : size === 'medium' ? 'gap-1' : 'gap-1.5';

  const renderBadge = (action) => {
    // Primitive actions always use primitive rendering (check, bet, call, raise, fold)
    if (isPrimitiveAction(action)) {
      return (
        <div data-testid="action-badge" className={`inline-flex items-center justify-center rounded font-bold ${sizeStyles[size]} ${PRIMITIVE_COLORS[action]}`}>
          {PRIMITIVE_ABBREV[action]}
        </div>
      );
    }
    return (
      <ActionBadge
        action={action}
        size={size}
        showArrow={false}
        ACTIONS={ACTIONS}
        ACTION_ABBREV={ACTION_ABBREV}
      />
    );
  };

  return (
    <div className={`flex items-center ${gapClass}`} title={tooltipText}>
      {visibleActions.map((action, index) => (
        <React.Fragment key={index}>
          {renderBadge(action)}
          {(index < visibleActions.length - 1 || hasOverflow) && (
            <span className="text-gray-500 text-xs">→</span>
          )}
        </React.Fragment>
      ))}
      {hasOverflow && (
        <div className={`inline-flex items-center justify-center rounded font-bold bg-gray-200 text-gray-700 ${sizeStyles[size]}`}>
          +{overflowCount}
        </div>
      )}
    </div>
  );
};
