import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * SizingPanel - Quick-click sizing buttons for bet/raise actions.
 * Shows preset multiplier buttons plus a custom input field.
 */
export const SizingPanel = ({ options, onSelect, onCancel }) => {
  const [customValue, setCustomValue] = useState('');

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(customValue);
    if (!isNaN(val) && val > 0) {
      onSelect(val);
    }
  };

  return (
    <div className="mt-2 p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
      <div className="text-xs font-semibold text-gray-600 mb-2">Select Size:</div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {options.map(({ label, amount }) => (
          <button
            key={label}
            onClick={() => onSelect(amount)}
            className="py-2 px-1 bg-green-500 hover:bg-green-600 text-white rounded font-bold text-sm shadow"
          >
            <div>{label}</div>
            <div className="text-xs opacity-90">${amount}</div>
          </button>
        ))}
      </div>
      <form onSubmit={handleCustomSubmit} className="flex gap-2">
        <div className="flex-1 flex items-center gap-1">
          <span className="text-gray-600 font-bold">$</span>
          <input
            type="number"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Custom"
            min="1"
            step="any"
            className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm font-semibold focus:border-green-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!customValue || parseFloat(customValue) <= 0}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-bold text-sm"
        >
          OK
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded font-bold text-sm"
        >
          Back
        </button>
      </form>
    </div>
  );
};

SizingPanel.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
  })).isRequired,
  onSelect: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
