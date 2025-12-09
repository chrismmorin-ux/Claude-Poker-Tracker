import React from 'react';
import PropTypes from 'prop-types';

/**
 * BankrollDisplay - Running total bankroll display in bottom left corner
 */
export const BankrollDisplay = ({
  totalBankroll,
  completedSessionCount,
}) => {
  return (
    <div className="absolute bottom-8 left-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-xl p-4 text-white z-20 max-w-xs">
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

BankrollDisplay.propTypes = {
  totalBankroll: PropTypes.number.isRequired,
  completedSessionCount: PropTypes.number.isRequired,
};
