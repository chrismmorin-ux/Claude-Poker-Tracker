/**
 * SeatGrid.jsx - Seat assignment grid for player management
 *
 * Extracted from PlayersView.jsx for better maintainability.
 */

import React from 'react';

/**
 * SeatGrid - 9-seat grid for managing player seat assignments
 *
 * @param {Object} props
 * @param {number|null} props.selectedSeat - Currently selected seat number
 * @param {Function} props.getSeatPlayerName - Get player name for a seat
 * @param {Function} props.onSeatClick - Handle seat click
 * @param {Function} props.onClearSeat - Clear a single seat assignment
 * @param {Function} props.onClearAllSeats - Clear all seat assignments
 * @param {Function} props.onSeatDragStart - Handle drag start from seat
 * @param {Function} props.onSeatDragEnd - Handle drag end
 * @param {Function} props.onDrop - Handle player drop onto seat
 */
export const SeatGrid = ({
  selectedSeat,
  getSeatPlayerName,
  onSeatClick,
  onClearSeat,
  onClearAllSeats,
  onSeatDragStart,
  onSeatDragEnd,
  onDrop
}) => {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Current Seat Assignments</h2>
        <button
          onClick={onClearAllSeats}
          className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors font-medium"
        >
          Clear All Seats
        </button>
      </div>
      <div className="grid grid-cols-9 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(seat => {
          const playerName = getSeatPlayerName(seat);
          const isSelected = selectedSeat === seat;
          return (
            <div
              key={seat}
              className={`border-2 rounded-lg p-3 text-center transition-all cursor-pointer ${
                isSelected
                  ? 'border-yellow-400 bg-yellow-50 ring-4 ring-yellow-400 scale-110'
                  : playerName
                  ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
              draggable={!!playerName}
              onClick={() => onSeatClick(seat)}
              onDragStart={() => onSeatDragStart(seat)}
              onDragEnd={onSeatDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(seat);
              }}
            >
              <div className="text-xs font-semibold text-gray-600 mb-1">
                Seat {seat}
              </div>
              {playerName ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-sm font-semibold text-blue-800 truncate w-full" title={playerName}>
                    {playerName}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearSeat(seat);
                    }}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  {isSelected ? 'Click player below' : 'Empty'}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selectedSeat && (
        <div className="mt-2 text-sm text-green-700 font-medium text-center">
          Seat {selectedSeat} selected - Click a player below to assign
        </div>
      )}
    </div>
  );
};

export default SeatGrid;
