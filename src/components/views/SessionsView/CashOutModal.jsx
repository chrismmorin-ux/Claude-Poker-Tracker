import React from 'react';

/**
 * CashOutModal - Modal for entering cash out amount + optional tip when ending a session.
 *
 * AUDIT-2026-04-21-SV F2: Tip field added. JTBD-SM-21 explicitly names tip logging;
 * before this change, lifetime bankroll silently overcounted by the tip amount for
 * every tipped session. Tip is optional (null = 0) and backward-compatible with
 * legacy session records.
 */
export const CashOutModal = ({
  isOpen,
  cashOutAmount,
  onCashOutAmountChange,
  tipAmount = '',
  onTipAmountChange,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">End Session</h2>
        <p className="text-gray-300 mb-4">
          Enter your cash out amount and tip (both optional)
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cash Out Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={cashOutAmount}
              onChange={(e) => onCashOutAmountChange(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Leave empty to skip</p>
        </div>

        {/* AUDIT-2026-04-21-SV F2: optional tip field. Tip is subtracted from
            lifetime P&L in BankrollDisplay; legacy sessions without tipAmount
            default to 0 (no behavior change for historical data). */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tip (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={tipAmount}
              onChange={(e) => onTipAmountChange && onTipAmountChange(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Included in P&L. Leave empty if you didn&apos;t tip.
          </p>
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

