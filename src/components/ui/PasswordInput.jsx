import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Eye, EyeOff } from 'lucide-react';

/**
 * PasswordInput - Reusable password input component with visibility toggle
 *
 * @param {string} value - Current password value
 * @param {function} onChange - Change handler
 * @param {string} placeholder - Placeholder text
 * @param {boolean} disabled - Whether input is disabled
 * @param {string} autoComplete - Autocomplete attribute
 * @param {boolean} showStrength - Whether to display strength indicator
 * @param {object} strengthValue - Strength data: { text, color }
 * @param {string} className - Additional CSS classes
 */
export const PasswordInput = ({
  value,
  onChange,
  placeholder = 'Password',
  disabled = false,
  autoComplete = 'current-password',
  showStrength = false,
  strengthValue = null,
  className = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${className}`}
          aria-label={placeholder}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>

      {showStrength && strengthValue && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Password strength:</span>
            <span
              className={`font-medium ${
                strengthValue.color === 'text-red-500'
                  ? 'text-red-500'
                  : strengthValue.color === 'text-yellow-500'
                  ? 'text-yellow-500'
                  : strengthValue.color === 'text-green-500'
                  ? 'text-green-500'
                  : 'text-gray-500'
              }`}
            >
              {strengthValue.text}
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                strengthValue.color === 'text-red-500'
                  ? 'bg-red-500 w-1/4'
                  : strengthValue.color === 'text-yellow-500'
                  ? 'bg-yellow-500 w-1/2'
                  : strengthValue.color === 'text-green-500'
                  ? 'bg-green-500 w-full'
                  : 'bg-gray-400 w-0'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

PasswordInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  autoComplete: PropTypes.string,
  showStrength: PropTypes.bool,
  strengthValue: PropTypes.shape({
    text: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
  }),
  className: PropTypes.string,
};
