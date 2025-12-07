/**
 * SessionCard.jsx - Single past session display card
 *
 * Extracted from SessionsView.jsx for better maintainability.
 */

import React from 'react';
import { Clock, DollarSign, Target, Trash2 } from 'lucide-react';
import { formatTime12Hour, calculateTotalRebuy } from '../../utils/displayUtils';

/**
 * Format duration from start to end time
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {string} Formatted duration
 */
const formatDuration = (startTime, endTime) => {
  const duration = (endTime || Date.now()) - startTime;
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Format date from timestamp
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date (e.g., "Dec 7")
 */
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * SessionCard - Displays a single past session
 *
 * @param {Object} props
 * @param {Object} props.session - Session data object
 * @param {Function} props.onDelete - Delete handler
 */
export const SessionCard = ({ session, onDelete }) => {
  const totalRebuys = calculateTotalRebuy(session.rebuyTransactions);
  const hasCashOut = session.cashOut !== null && session.cashOut !== undefined;
  const profitLoss = hasCashOut && session.buyIn
    ? session.cashOut - session.buyIn - totalRebuys
    : null;

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-800">
              {formatDate(session.startTime)} - {session.venue} - {session.gameType} - {formatTime12Hour(session.startTime)}
            </h3>
          </div>

          <div className="flex gap-6 text-sm text-gray-600 flex-wrap">
            {/* Duration */}
            <div className="flex items-center gap-1">
              <Clock size={14} />
              {formatDuration(session.startTime, session.endTime)}
            </div>

            {/* Hand count */}
            <div>
              {session.handCount} hands
            </div>

            {/* Buy-in + Total Rebuy */}
            {session.buyIn && (
              <div className="flex items-center gap-1">
                <DollarSign size={14} />
                Buy-in: ${session.buyIn}
                {session.rebuyTransactions && session.rebuyTransactions.length > 0 && (
                  <span className="text-xs text-gray-500">
                    (+${totalRebuys} rebuy)
                  </span>
                )}
              </div>
            )}

            {/* Cash Out */}
            {hasCashOut && (
              <div className="flex items-center gap-1">
                <DollarSign size={14} />
                Cash out: ${session.cashOut}
              </div>
            )}

            {/* Profit/Loss */}
            {profitLoss !== null && (
              <div className={`font-medium ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}
              </div>
            )}

            {/* Goal */}
            {session.goal && (
              <div className="flex items-center gap-1">
                <Target size={14} />
                {session.goal}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onDelete(session.sessionId)}
          className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default SessionCard;
