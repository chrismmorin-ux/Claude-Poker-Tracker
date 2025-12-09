import React from 'react';
import PropTypes from 'prop-types';
import { SkipForward, RotateCcw } from 'lucide-react';

/**
 * TableHeader - Header bar with hand count, session timer, and control buttons
 */
export const TableHeader = ({
  handCount,
  sessionTimeDisplay,
  hasActiveSession,
  isSidebarCollapsed,
  onEndSession,
  onNewSession,
  onNextHand,
  onResetHand,
}) => {
  return (
    <div className={`flex justify-between items-center px-4 py-2 bg-black bg-opacity-40 transition-all duration-300 ${isSidebarCollapsed ? 'ml-14' : 'ml-36'}`}>
      <div className="flex items-center gap-4">
        <div className="text-white text-xl font-bold">Hand #{handCount + 1}</div>
        {hasActiveSession ? (
          <>
            <div className="text-green-300 text-base">{sessionTimeDisplay}</div>
            <button
              onClick={onEndSession}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-semibold"
            >
              End Session
            </button>
          </>
        ) : (
          <button
            onClick={onNewSession}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-semibold"
          >
            New Session
          </button>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={onNextHand}
          className="bg-yellow-600 text-white px-3 py-2 rounded flex items-center gap-2"
        >
          <SkipForward size={18} />
          Next Hand
        </button>
        <button
          onClick={onResetHand}
          className="bg-gray-700 text-white px-3 py-2 rounded flex items-center gap-2"
        >
          <RotateCcw size={18} />
          Reset Hand
        </button>
      </div>
    </div>
  );
};

TableHeader.propTypes = {
  handCount: PropTypes.number.isRequired,
  sessionTimeDisplay: PropTypes.string.isRequired,
  hasActiveSession: PropTypes.bool.isRequired,
  isSidebarCollapsed: PropTypes.bool.isRequired,
  onEndSession: PropTypes.func.isRequired,
  onNewSession: PropTypes.func.isRequired,
  onNextHand: PropTypes.func.isRequired,
  onResetHand: PropTypes.func.isRequired,
};
