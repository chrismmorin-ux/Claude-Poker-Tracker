import React from 'react';

/**
 * SeatContextMenu - Right-click menu for seat assignment and configuration
 */
export const SeatContextMenu = ({
  contextMenu,
  onMakeMySeat,
  onMakeDealer,
  onCreateNewPlayer,
  onFindPlayer,
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

      {/* Find Player — opens fullscreen picker (PEO-3) */}
      {onFindPlayer ? (
        <button
          onClick={() => onFindPlayer(contextMenu.seat)}
          className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold text-blue-600"
          data-testid="menu-find-player"
        >
          🔍 Find Player…
        </button>
      ) : null}

      {/* Create New Player — routes to fullscreen editor (PEO-3) */}
      <button
        onClick={() => onCreateNewPlayer(contextMenu.seat)}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold text-blue-600"
        data-testid="menu-create-new-player"
      >
        + Create New Player
      </button>

      {recentPlayers.length > 0 ? (
        <>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase">
            Recent
          </div>
          {recentPlayers.map(player => (
            <button
              key={player.playerId}
              onClick={() => onAssignPlayer(contextMenu.seat, player.playerId)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
            >
              {player.name}
            </button>
          ))}
        </>
      ) : null}

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

