import React from 'react';

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
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">End Session</h2>
        <p className="text-gray-300 mb-4">
          Enter your cash out amount (optional)
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cash Out Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              value={cashOutAmount}
              onChange={(e) => onCashOutAmountChange(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Leave empty to skip</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors font-medium"
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

