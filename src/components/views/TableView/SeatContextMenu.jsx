import React from 'react';

/**
 * SeatContextMenu - Right-click menu for seat assignment and configuration.
 *
 * Menu ordering is state-aware (H-PLT07): when a seat is occupied, Clear
 * Player is promoted to the top — the owner-reported most-common intent on
 * an occupied-seat open. Clear is rendered with a divider below + visible
 * margin above the Recent list to prevent miss-tap adjacency.
 *
 * Audit refs: AUDIT-2026-04-21-player-selection F1 + F3 + F11.
 */

// AUDIT-2026-04-21-TV F8: single source of truth for menu-row touch height.
// Every tappable row in this menu MUST use one of these classes — previously,
// RecentPlayersSection drifted to min-h-[40px] and silently violated H-ML06.
// If you're adding a new row type, copy one of these; don't hand-roll heights.
const MENU_ROW_CLASS =
  'w-full px-4 py-3 text-left hover:bg-gray-100 font-semibold min-h-[44px]';
const RECENT_ROW_CLASS =
  'w-full px-4 py-2.5 text-left hover:bg-gray-100 text-sm min-h-[44px]';
const SECTION_LABEL_CLASS =
  'px-4 py-1 text-xs font-semibold text-gray-500 uppercase';

const MakeMySeatButton = ({ onClick }) => (
  <button onClick={onClick} className={MENU_ROW_CLASS}>
    Make My Seat
  </button>
);

const MakeDealerButton = ({ onClick }) => (
  <button onClick={onClick} className={MENU_ROW_CLASS}>
    Make Dealer
  </button>
);

const FindPlayerButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className={`${MENU_ROW_CLASS} text-blue-600`}
    data-testid="menu-find-player"
  >
    🔍 Find Player…
  </button>
);

const SwapPlayerButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className={`${MENU_ROW_CLASS} text-blue-600`}
    data-testid="menu-swap-player"
  >
    ⇄ Swap Player…
  </button>
);

const CreateNewPlayerButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className={`${MENU_ROW_CLASS} text-blue-600`}
    data-testid="menu-create-new-player"
  >
    + Create New Player
  </button>
);

const ClearPlayerButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className={`${MENU_ROW_CLASS} text-red-600`}
    data-testid="menu-clear-player"
  >
    Clear Player
  </button>
);

const Divider = () => <div className="border-t border-gray-200 my-1" />;

const RecentPlayersSection = ({ recentPlayers, seat, onAssignPlayer }) => {
  if (!recentPlayers || recentPlayers.length === 0) return null;
  const count = recentPlayers.length;
  // AUDIT-2026-04-21-TV F6: threshold where the scroll hint becomes load-bearing.
  // At ~8 rows × 44px = 352px; the menu's max-h-96 (384px) caps the scroll region,
  // so beyond 8 items the bottom rows drop below the fold without a visual cue.
  const hasOverflowRisk = count > 8;
  return (
    <>
      <Divider />
      {/* AUDIT-2026-04-21-TV F6: count badge surfaces total recent players so
          between-hands-chris knows whether to scroll instead of re-creating a
          duplicate. Bottom-fade gradient becomes a scroll hint when overflow is
          imminent. */}
      <div className={`${SECTION_LABEL_CLASS} flex justify-between items-center`}>
        <span>Recent</span>
        <span className="text-gray-400 normal-case tracking-normal">
          {count} {count === 1 ? 'player' : 'players'}
        </span>
      </div>
      <div
        className="relative"
        data-recent-players-count={count}
      >
        {recentPlayers.map((player) => (
          <button
            key={player.playerId}
            onClick={() => onAssignPlayer(seat, player.playerId)}
            className={RECENT_ROW_CLASS}
          >
            {player.name}
          </button>
        ))}
        {hasOverflowRisk && (
          <div
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 left-0 right-0 h-6 -mt-6"
            style={{
              background: 'linear-gradient(to top, rgba(255,255,255,0.9), rgba(255,255,255,0))',
            }}
          />
        )}
      </div>
    </>
  );
};

const AssignSection = ({ seat, onFindPlayer, onCreateNewPlayer, onAssignPlayer, recentPlayers }) => (
  <>
    <div className={SECTION_LABEL_CLASS}>Assign Player</div>
    {onFindPlayer ? <FindPlayerButton onClick={() => onFindPlayer(seat)} /> : null}
    <CreateNewPlayerButton onClick={() => onCreateNewPlayer(seat)} />
    <RecentPlayersSection
      recentPlayers={recentPlayers}
      seat={seat}
      onAssignPlayer={onAssignPlayer}
    />
  </>
);

const SeatConfigSection = ({ seat, onMakeMySeat, onMakeDealer }) => (
  <>
    <MakeMySeatButton onClick={() => onMakeMySeat(seat)} />
    <MakeDealerButton onClick={() => onMakeDealer(seat)} />
  </>
);

export const SeatContextMenu = ({
  contextMenu,
  onMakeMySeat,
  onMakeDealer,
  onCreateNewPlayer,
  onFindPlayer,
  onSwapPlayer,
  onAssignPlayer,
  onClearPlayer,
  recentPlayers,
  getSeatPlayerName,
}) => {
  if (!contextMenu) return null;

  const { seat, x, y } = contextMenu;
  const isOccupied = Boolean(getSeatPlayerName(seat));

  return (
    <div
      className="absolute bg-white rounded-lg shadow-2xl py-2 z-50 max-h-96 overflow-y-auto"
      style={{ left: `${x}px`, top: `${y}px`, minWidth: '200px' }}
      onClick={(e) => e.stopPropagation()}
      data-testid="seat-context-menu"
      data-seat-occupied={isOccupied ? 'true' : 'false'}
    >
      {isOccupied ? (
        <>
          <ClearPlayerButton onClick={() => onClearPlayer(seat)} />
          {onSwapPlayer ? <SwapPlayerButton onClick={() => onSwapPlayer(seat)} /> : null}
          <Divider />
          <SeatConfigSection
            seat={seat}
            onMakeMySeat={onMakeMySeat}
            onMakeDealer={onMakeDealer}
          />
          <Divider />
          <AssignSection
            seat={seat}
            onFindPlayer={onFindPlayer}
            onCreateNewPlayer={onCreateNewPlayer}
            onAssignPlayer={onAssignPlayer}
            recentPlayers={recentPlayers}
          />
        </>
      ) : (
        <>
          <SeatConfigSection
            seat={seat}
            onMakeMySeat={onMakeMySeat}
            onMakeDealer={onMakeDealer}
          />
          <Divider />
          <AssignSection
            seat={seat}
            onFindPlayer={onFindPlayer}
            onCreateNewPlayer={onCreateNewPlayer}
            onAssignPlayer={onAssignPlayer}
            recentPlayers={recentPlayers}
          />
        </>
      )}
    </div>
  );
};
