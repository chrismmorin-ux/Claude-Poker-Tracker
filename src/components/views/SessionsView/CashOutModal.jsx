import React from 'react';
import PropTypes from 'prop-types';

/**
 * CashOutModal - Modal for entering cash out amount when ending a session
 */
export const CashOutModal = ({
  isOpen,
  cashOutAmount,
  onCashOutAmountChange,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">End Session</h2>
        <p className="text-gray-600 mb-4">
          Enter your cash out amount (optional)
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cash Out Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={cashOutAmount}
              onChange={(e) => onCashOutAmountChange(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Leave empty to skip</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};

CashOutModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  cashOutAmount: PropTypes.string.isRequired,
  onCashOutAmountChange: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
