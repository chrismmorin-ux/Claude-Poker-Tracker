/**
 * ActionSequence.jsx - Display sequence of actions with overflow handling
 */

import React from 'react';
import { ActionBadge } from './ActionBadge';
import { getActionSequenceDisplay } from '../../utils/actionUtils';

/**
 * ActionSequence - Displays a horizontal sequence of action badges
 * @param {Array<string>} actions - Array of action constants
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {number} maxVisible - Maximum badges to show before overflow (default: 3)
 * @param {Object} ACTIONS - Actions constants
 * @param {Object} ACTION_ABBREV - Action abbreviations map
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

  // Get full sequence for tooltip
  const getDisplayName = (action) => {
    // Simple inline function to get display name for tooltip
    const displayNames = {
      [ACTIONS.FOLD]: 'fold',
      [ACTIONS.LIMP]: 'limp',
      [ACTIONS.CALL]: 'call',
      [ACTIONS.OPEN]: 'open',
      [ACTIONS.THREE_BET]: '3bet',
      [ACTIONS.FOUR_BET]: '4bet',
      [ACTIONS.CBET_IP_SMALL]: 'cbet IP (S)',
      [ACTIONS.CBET_IP_LARGE]: 'cbet IP (L)',
      [ACTIONS.CBET_OOP_SMALL]: 'cbet OOP (S)',
      [ACTIONS.CBET_OOP_LARGE]: 'cbet OOP (L)',
      [ACTIONS.CHECK]: 'check',
      [ACTIONS.CHECK_RAISE]: 'check-raise',
      [ACTIONS.DONK]: 'donk',
      [ACTIONS.STAB]: 'stab',
      [ACTIONS.FOLD_TO_CBET]: 'fold to cbet',
      [ACTIONS.FOLD_TO_CR]: 'fold to CR',
      [ACTIONS.MUCKED]: 'muck',
      [ACTIONS.WON]: 'won',
    };
    return displayNames[action] || action;
  };

  const tooltipText = actions.map(a => getDisplayName(a)).join(' → ');

  // Size-specific gap
  const gapClass = size === 'small' ? 'gap-0.5' : size === 'medium' ? 'gap-1' : 'gap-1.5';

  return (
    <div className={`flex items-center ${gapClass}`} title={tooltipText}>
      {visibleActions.map((action, index) => (
        <React.Fragment key={index}>
          <ActionBadge
            action={action}
            size={size}
            showArrow={false}
            ACTIONS={ACTIONS}
            ACTION_ABBREV={ACTION_ABBREV}
          />
          {(index < visibleActions.length - 1 || hasOverflow) && (
            <span className="text-gray-500 text-xs">→</span>
          )}
        </React.Fragment>
      ))}
      {hasOverflow && (
        <div className={`inline-flex items-center justify-center rounded font-bold bg-gray-200 text-gray-700
          ${size === 'small' ? 'h-5 min-w-[16px] text-xs px-1' :
            size === 'medium' ? 'h-7 min-w-[20px] text-sm px-1.5' :
            'h-9 min-w-[24px] text-base px-2'}`}>
          +{overflowCount}
        </div>
      )}
    </div>
  );
};
