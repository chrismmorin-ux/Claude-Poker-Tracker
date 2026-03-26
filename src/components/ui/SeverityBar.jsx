/**
 * SeverityBar.jsx — Shared severity/weakness indicator bar
 */

import React from 'react';

const SeverityBar = ({ severity, width = 'w-16', showLabel = true }) => {
  const pct = Math.round(severity * 100);
  const color = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-1">
      <div className={`h-1.5 ${width} bg-gray-700 rounded overflow-hidden`}>
        <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-[9px] text-gray-500">{pct}%</span>}
    </div>
  );
};

export default SeverityBar;
