import React from 'react';

/**
 * BankrollDisplay - Running total bankroll card.
 *
 * AUDIT-2026-04-21-SV F5: Positioning responsibility moved OUT of this component.
 * The parent (SessionsView) now wraps BankrollDisplay + drill buttons in a single
 * flex container at the bottom of the view. This eliminates the silent-collision
 * risk that the old three-independent-absolute-elements layout had at sub-reference
 * scale (H-ML01, H-ML06).
 */
export const BankrollDisplay = ({
  totalBankroll,
  completedSessionCount,
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-xl p-4 text-white max-w-xs">
      <div className="text-blue-100 text-xs mb-1">Running Total Bankroll</div>
      <div className={`text-2xl font-bold ${totalBankroll >= 0 ? 'text-white' : 'text-red-200'}`}>
        {totalBankroll >= 0 ? '+' : ''}${totalBankroll.toFixed(2)}
      </div>
      <div className="text-blue-100 text-xs mt-1">
        {completedSessionCount} sessions
      </div>
    </div>
  );
};

