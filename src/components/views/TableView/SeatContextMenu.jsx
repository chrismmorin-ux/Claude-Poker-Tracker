import React from 'react';
import PropTypes from 'prop-types';

/**
 * SeatContextMenu - Right-click menu for seat assignment and configuration
 */
export const SeatContextMenu = ({
  contextMenu,
  onMakeMySeat,
  onMakeDealer,
  onCreateNewPlayer,
  onAssignPlayer,
  onClearPlayer,
  recentPlayers,
  getSeatPlayerName,
}) => {
  if (!contextMenu) return null;

  return (
    <div
      className="absolute bg-white rounded-lg shadow-2xl py-2 z-50 max-h-96 overflow-y-auto"
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        minWidth: '180px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => onMakeMySeat(contextMenu.seat)}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold"
      >
        Make My Seat
      </button>
      <button
        onClick={() => onMakeDealer(contextMenu.seat)}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold"
      >
        Make Dealer
      </button>

      {/* Divider */}
      <div className="border-t border-gray-200 my-1"></div>

      {/* Player Assignment Section */}
      <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase">
        Assign Player
      </div>

      {/* Create New Player */}
      <button
        onClick={() => onCreateNewPlayer(contextMenu.seat)}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold text-blue-600"
      >
        + Create New Player
      </button>

      {/* Divider */}
      <div className="border-t border-gray-200 my-1"></div>

      {/* Recent Players List */}
      {recentPlayers.map(player => (
        <button
          key={player.playerId}
          onClick={() => onAssignPlayer(contextMenu.seat, player.playerId)}
          className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
        >
          {player.name}
        </button>
      ))}

      {/* Divider */}
      <div className="border-t border-gray-200 my-1"></div>

      {/* Clear Player (only show if player is assigned) */}
      {getSeatPlayerName(contextMenu.seat) && (
        <button
          onClick={() => onClearPlayer(contextMenu.seat)}
          className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold text-red-600"
        >
          Clear Player
        </button>
      )}
    </div>
  );
};

SeatContextMenu.propTypes = {
  contextMenu: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    seat: PropTypes.number,
  }),
  onMakeMySeat: PropTypes.func.isRequired,
  onMakeDealer: PropTypes.func.isRequired,
  onCreateNewPlayer: PropTypes.func.isRequired,
  onAssignPlayer: PropTypes.func.isRequired,
  onClearPlayer: PropTypes.func.isRequired,
  recentPlayers: PropTypes.arrayOf(PropTypes.shape({
    playerId: PropTypes.string,
    name: PropTypes.string,
  })).isRequired,
  getSeatPlayerName: PropTypes.func.isRequired,
};
