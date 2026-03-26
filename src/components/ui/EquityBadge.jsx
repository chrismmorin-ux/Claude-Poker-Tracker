import React from 'react';

/**
 * EquityBadge - Small pill showing live equity vs a villain.
 * Green when equity > 50%, red when < 50%. Shows spinner when computing.
 */
export const EquityBadge = ({ equity, isComputing, villainName }) => {
  if (!isComputing && equity === null) return null;

  const pct = equity !== null ? Math.round(equity * 100) : null;
  const isGood = equity !== null && equity >= 0.5;

  return (
    <div
      className={`absolute left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-semibold shadow-md ${
        isComputing
          ? 'bg-gray-600 text-gray-300'
          : isGood
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
      }`}
      style={{ bottom: '-24px', whiteSpace: 'nowrap' }}
    >
      {isComputing ? (
        <span className="animate-pulse">computing...</span>
      ) : (
        <span>vs {villainName}: {pct}%</span>
      )}
    </div>
  );
};

