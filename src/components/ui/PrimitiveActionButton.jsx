/**
 * PrimitiveActionButton.jsx - Button for primitive poker actions
 */

import React from 'react';
import PropTypes from 'prop-types';
import { PRIMITIVE_BUTTON_CONFIG } from '../../constants/primitiveActions';

/**
 * PrimitiveActionButton - Renders a styled button for a primitive action
 * @param {string} action - Primitive action value (check, bet, call, raise, fold)
 * @param {Function} onClick - Click handler
 * @param {boolean} disabled - Whether the button is disabled
 */
export const PrimitiveActionButton = ({ action, onClick, disabled = false }) => {
  const config = PRIMITIVE_BUTTON_CONFIG[action];
  if (!config) return null;

  const { label, bg, hover } = config;

  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      disabled={disabled}
      className={`text-white px-3 py-2 rounded font-bold text-sm transition-colors duration-150 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ backgroundColor: bg }}
      onMouseEnter={disabled ? undefined : (e) => { e.currentTarget.style.backgroundColor = hover; }}
      onMouseLeave={disabled ? undefined : (e) => { e.currentTarget.style.backgroundColor = bg; }}
    >
      {label}
    </button>
  );
};

PrimitiveActionButton.propTypes = {
  action: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
