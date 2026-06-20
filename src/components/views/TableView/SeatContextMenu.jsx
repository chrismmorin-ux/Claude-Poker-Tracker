import React from 'react';

/**
 * SeatContextMenu - Right-click menu for seat assignment and configuration.
 *
 * Menu ordering (owner-revised 2026-05-05): seat-config rows (Make My Seat /
 * Make Dealer) ALWAYS first, then ALL player-related operations grouped
 * together below — Clear Player + Swap Player + Find or Add Player + Recent.
 * Supersedes the prior H-PLT07 "promote Clear to top" rule; owner prefers
 * one continuous "player ops" cluster over fastest-action promotion.
 *
 * "+ Create New Player" was removed — it duplicated "Find or Add Player…"
 * (both opened the picker) per Phase 4 search-first creation.
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

// WS-002 Sprint A2 (revised 2026-05-06): straddle entry moved from long-press
// gesture (conflicted with the right-click / long-press menu itself) to a
// menu row. Only rendered when the seat is UTG or BTN, no preflop action has
// been recorded, and no existing straddle is posted — gating handled by the
// caller via the optional onStraddle prop (undefined ⇒ row hidden).
const StraddleButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className={`${MENU_ROW_CLASS} text-purple-600`}
    data-testid="menu-straddle"
  >
    🎲 Straddle…
  </button>
);

// WS-191 scope #3 (owner-decided 2026-06-19): multi-seat selection is now an
// explicit, rare action behind the touch-hold / right-click menu. Plain tap on a
// seat is single-select-replace; this row is the ONLY way to build a multi-seat
// batch. Label adapts to whether the seat is already in the current selection.
// Step-back Undo for mis-entries lives in ControlZone.
const MultiSelectButton = ({ onClick, isInSelection }) => (
  <button
    onClick={onClick}
    className={`${MENU_ROW_CLASS} text-amber-700`}
    data-testid="menu-multi-select"
  >
    {isInSelection ? '➖ Remove from multi-select' : '➕ Add to multi-select'}
  </button>
);

const FindPlayerButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className={`${MENU_ROW_CLASS} text-blue-600`}
    data-testid="menu-find-player"
  >
    🔍 Find or Add Player…
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

const AssignSection = ({ seat, onFindPlayer, onAssignPlayer, recentPlayers }) => (
  <>
    {onFindPlayer ? <FindPlayerButton onClick={() => onFindPlayer(seat)} /> : null}
    <RecentPlayersSection
      recentPlayers={recentPlayers}
      seat={seat}
      onAssignPlayer={onAssignPlayer}
    />
  </>
);

const SeatConfigSection = ({ seat, onMakeMySeat, onMakeDealer, onStraddle, onAddToMultiSelect, isSeatInSelection }) => (
  <>
    <MakeMySeatButton onClick={() => onMakeMySeat(seat)} />
    <MakeDealerButton onClick={() => onMakeDealer(seat)} />
    {onStraddle ? <StraddleButton onClick={() => onStraddle(seat)} /> : null}
    {onAddToMultiSelect ? (
      <MultiSelectButton
        onClick={() => onAddToMultiSelect(seat)}
        isInSelection={isSeatInSelection}
      />
    ) : null}
  </>
);

export const SeatContextMenu = ({
  contextMenu,
  onMakeMySeat,
  onMakeDealer,
  onStraddle,
  onAddToMultiSelect,
  isSeatInSelection,
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
      {/* Seat config — always first, regardless of occupancy. */}
      <SeatConfigSection
        seat={seat}
        onMakeMySeat={onMakeMySeat}
        onMakeDealer={onMakeDealer}
        onStraddle={onStraddle}
        onAddToMultiSelect={onAddToMultiSelect}
        isSeatInSelection={isSeatInSelection}
      />
      <Divider />
      {/* Player ops — grouped together: clear/swap (if occupied), then
          find-or-add, then recent. */}
      {isOccupied ? (
        <>
          <ClearPlayerButton onClick={() => onClearPlayer(seat)} />
          {onSwapPlayer ? <SwapPlayerButton onClick={() => onSwapPlayer(seat)} /> : null}
        </>
      ) : null}
      <AssignSection
        seat={seat}
        onFindPlayer={onFindPlayer}
        onAssignPlayer={onAssignPlayer}
        recentPlayers={recentPlayers}
      />
    </div>
  );
};
