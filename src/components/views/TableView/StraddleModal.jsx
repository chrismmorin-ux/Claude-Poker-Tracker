/**
 * StraddleModal — confirm + amount input for posting a straddle on the
 * current hand. WS-002 Sprint A2 (HE-18 — post a straddle for the current hand).
 *
 * Triggered by long-press (500ms) on UTG or BTN seat when no preflop action
 * has been recorded yet. Pre-fills amount from session default (if set) or
 * 2× BB. UTG > BTN precedence is enforced upstream — the modal opens for the
 * pressed seat only when no STRADDLE entry exists yet.
 */

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const STRADDLE_PURPLE = '#a855f7';
const STRADDLE_PURPLE_HOVER = '#9333ea';

export const StraddleModal = ({
  isOpen,
  positionLabel, // 'UTG' | 'BTN'
  defaultAmount, // number — pre-fill (session default or 2×BB)
  onPost,        // (amount) => void
  onCancel,
}) => {
  const [amountStr, setAmountStr] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmountStr(String(defaultAmount ?? ''));
    }
  }, [isOpen, defaultAmount]);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amountStr);
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    onPost(parsedAmount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-60" onClick={onCancel} />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-gray-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-200"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-2">
          Straddle from {positionLabel}?
        </h3>
        <p className="text-gray-400 text-sm text-center mb-5">
          Posts before any action. Straddler acts last preflop.
        </p>

        {/* Amount input */}
        <label className="block mb-5">
          <span className="block text-sm font-semibold text-gray-300 mb-1.5">
            Amount
          </span>
          <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg overflow-hidden focus-within:border-purple-500">
            <span className="px-3 text-gray-400 font-bold text-lg">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              autoFocus
              className="flex-1 py-2.5 pr-3 bg-transparent text-white text-lg font-bold outline-none"
            />
          </div>
        </label>

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className="px-5 py-2.5 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isValid ? STRADDLE_PURPLE : '#6b7280',
            }}
            onMouseEnter={(e) => {
              if (isValid) e.currentTarget.style.background = STRADDLE_PURPLE_HOVER;
            }}
            onMouseLeave={(e) => {
              if (isValid) e.currentTarget.style.background = STRADDLE_PURPLE;
            }}
          >
            Post Straddle
          </button>
        </div>
      </form>
    </div>
  );
};

export default StraddleModal;
