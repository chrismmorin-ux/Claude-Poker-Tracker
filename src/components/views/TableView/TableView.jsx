import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { CardSlot } from '../../ui/CardSlot';
import { CollapsibleSidebar } from '../../ui/CollapsibleSidebar';
import { LAYOUT } from '../../../constants/gameConstants';
import { useGame, useUI, useSession, usePlayer, useCard } from '../../../contexts';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { TableHeader } from './TableHeader';
import { SeatComponent } from './SeatComponent';
import { ActionPanel } from './ActionPanel';
import { SeatContextMenu } from './SeatContextMenu';
import { StreetSelector } from './StreetSelector';

/**
 * Format relative time from start timestamp
 */
const formatRelativeTime = (startTime) => {
  if (!startTime) return '';

  const now = Date.now();
  const diff = now - startTime;

  if (diff < 0) return '';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `Started ${minutes}m ago`;
  if (hours < 24) return `Started ${hours}h ago`;
  return `Started ${days}d ago`;
};

/**
 * TableView - Main poker table interface
 * Orchestrates sub-components for the poker table display
 */
export const TableView = ({
  // Layout (viewport-derived)
  scale,
  tableRef,
  SEAT_POSITIONS,
  numSeats,
  // Handlers not in contexts (defined in parent)
  nextHand,
  resetHand,
  handleSeatRightClick,
  getSeatColor,
  handleDealerDragStart,
  handleDealerDrag,
  handleDealerDragEnd,
  setCurrentStreet,
  openShowdownScreen,
  nextStreet,
  clearStreetActions,
  clearSeatActions,
  undoLastAction,
  handleSetMySeat,
  setDealerSeat,
  recordAction,
  toggleAbsent,
  // Player persistence (from usePlayerPersistence, not PlayerContext)
  getRecentPlayers,
  clearSeatAssignment,
  isPlayerAssigned,
  // Local UI state from parent
  setPendingSeatForPlayerAssignment,
  setAutoOpenNewSession,
  // Toast notifications
  showSuccess,
  showWarning,
  showInfo,
}) => {
  // Get state and handlers from contexts
  const {
    currentStreet,
    mySeat,
    dealerButtonSeat,
    seatActions,
    absentSeats,
    getSmallBlindSeat,
    getBigBlindSeat,
  } = useGame();

  const {
    selectedPlayers,
    contextMenu,
    isDraggingDealer,
    isSidebarCollapsed,
    setCurrentScreen,
    setContextMenu,
    togglePlayerSelection,
    toggleSidebar,
    openCardSelector,
    setSelectedPlayers,
    SCREEN,
  } = useUI();

  const {
    currentSession,
    hasActiveSession,
    updateSessionField,
  } = useSession();

  const {
    getSeatPlayerName,
    assignPlayerToSeat,
  } = usePlayer();

  // Card state from CardContext
  const {
    communityCards,
    holeCards,
    holeCardsVisible,
    dispatchCard,
  } = useCard();

  // Derived session values
  const handCount = currentSession?.handCount || 0;
  const sessionStartTime = currentSession?.startTime;
  const currentSessionVenue = currentSession?.venue;
  const currentSessionGameType = currentSession?.gameType;

  // Update session time display every minute
  const [sessionTimeDisplay, setSessionTimeDisplay] = useState(() => formatRelativeTime(sessionStartTime));

  // Convert absentSeats array to Set for CollapsibleSidebar
  const absentSeatsSet = useMemo(() => new Set(absentSeats || []), [absentSeats]);

  // Handle seat change from sidebar navigation
  const handleSeatChange = (seat) => {
    setSelectedPlayers([seat]);
  };

  useEffect(() => {
    if (!sessionStartTime) {
      setSessionTimeDisplay('');
      return;
    }

    setSessionTimeDisplay(formatRelativeTime(sessionStartTime));

    const interval = setInterval(() => {
      setSessionTimeDisplay(formatRelativeTime(sessionStartTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Handler callbacks for sub-components
  const handleEndSession = () => setCurrentScreen(SCREEN.SESSIONS);

  const handleNewSession = () => {
    setAutoOpenNewSession(true);
    setCurrentScreen(SCREEN.SESSIONS);
  };

  // Wrapped handlers with toast notifications
  const handleNextHandWithToast = () => {
    nextHand();
    const nextHandNumber = (currentSession?.handCount || 0) + 2; // +1 for increment, +1 for display
    showInfo(`Hand #${nextHandNumber} started`);
  };

  const handleResetHandWithToast = () => {
    resetHand();
    showWarning('Hand reset');
  };

  const handleStreetChange = (street) => {
    setCurrentStreet(street);
    if (street === 'showdown') {
      openShowdownScreen();
    }
  };

  const handleMakeDealer = (seat) => {
    setDealerSeat(seat);
    setContextMenu(null);
  };

  const handleCreateNewPlayer = (seat) => {
    setPendingSeatForPlayerAssignment(seat);
    setContextMenu(null);
    setCurrentScreen(SCREEN.PLAYERS);
  };

  const handleAssignPlayer = (seat, playerId) => {
    assignPlayerToSeat(seat, playerId);
    setContextMenu(null);
    showSuccess(`Player assigned to seat ${seat}`);
  };

  const handleClearPlayer = (seat) => {
    clearSeatAssignment(seat);
    setContextMenu(null);
  };

  const handleHoleCardClick = (index) => {
    openCardSelector('hole', index);
  };

  const handleToggleHoleCardsVisibility = () => {
    dispatchCard({ type: CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY });
  };

  const handleClearSelection = () => {
    setSelectedPlayers([]);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
      <div style={{
        width: `${LAYOUT.TABLE_WIDTH}px`,
        height: `${LAYOUT.TABLE_HEIGHT}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center'
      }}>
        <div
          className="bg-gradient-to-br from-green-800 to-green-900 flex flex-col"
          style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
          onClick={() => {
            if (!isDraggingDealer) {
              setContextMenu(null);
            }
          }}
        >
          {/* Collapsible Sidebar */}
          <CollapsibleSidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={toggleSidebar}
            onNavigate={setCurrentScreen}
            onSeatChange={handleSeatChange}
            SCREEN={SCREEN}
            selectedPlayers={selectedPlayers}
            dealerButtonSeat={dealerButtonSeat}
            absentSeats={absentSeatsSet}
            numSeats={numSeats}
            hasActiveSession={hasActiveSession}
            currentSessionVenue={currentSessionVenue}
            currentSessionGameType={currentSessionGameType}
            updateSessionField={updateSessionField}
          />

          {/* Header Bar */}
          <TableHeader
            handCount={handCount}
            sessionTimeDisplay={sessionTimeDisplay}
            hasActiveSession={hasActiveSession}
            isSidebarCollapsed={isSidebarCollapsed}
            onEndSession={handleEndSession}
            onNewSession={handleNewSession}
            onNextHand={handleNextHandWithToast}
            onResetHand={handleResetHandWithToast}
          />

          <div className={`flex-1 relative p-4 transition-all duration-300 ${isSidebarCollapsed ? 'ml-14' : 'ml-36'}`}>
            {/* Felt table */}
            <div
              ref={tableRef}
              className="absolute bg-green-700 shadow-2xl"
              style={{
                top: `${LAYOUT.TABLE_OFFSET_Y}px`,
                left: `${LAYOUT.TABLE_OFFSET_X}px`,
                width: `${LAYOUT.FELT_WIDTH}px`,
                height: `${LAYOUT.FELT_HEIGHT}px`,
                borderRadius: `${LAYOUT.FELT_HEIGHT / 2}px`
              }}
              onMouseMove={handleDealerDrag}
              onMouseUp={handleDealerDragEnd}
              onMouseLeave={handleDealerDragEnd}
            >
              {/* Inner felt with community cards */}
              <div
                className="absolute inset-4 bg-green-600 border-8 border-green-800 shadow-inner"
                style={{ borderRadius: `${LAYOUT.FELT_HEIGHT / 2 - 8}px` }}
              >
                {/* Community cards */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <CardSlot
                      key={idx}
                      card={communityCards[idx]}
                      variant="table"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCardSelector('community', idx);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Seats */}
              {SEAT_POSITIONS.map(({ seat, x, y }) => (
                <SeatComponent
                  key={seat}
                  seat={seat}
                  x={x}
                  y={y}
                  actionArray={seatActions[currentStreet]?.[seat] || []}
                  isDealer={dealerButtonSeat === seat}
                  isSmallBlind={getSmallBlindSeat() === seat}
                  isBigBlind={getBigBlindSeat() === seat}
                  isMySeat={seat === mySeat}
                  playerName={getSeatPlayerName(seat)}
                  holeCards={holeCards}
                  holeCardsVisible={holeCardsVisible}
                  getSeatColor={getSeatColor}
                  onSeatClick={togglePlayerSelection}
                  onSeatRightClick={handleSeatRightClick}
                  onDealerDragStart={handleDealerDragStart}
                  onHoleCardClick={handleHoleCardClick}
                  onToggleVisibility={handleToggleHoleCardsVisibility}
                />
              ))}

              {/* Table label */}
              <div
                className="absolute transform -translate-x-1/2 bg-amber-800 border-4 border-amber-900 rounded-lg shadow-xl flex items-center justify-center"
                style={{
                  left: '50%',
                  bottom: `${LAYOUT.TABLE_LABEL_BOTTOM}px`,
                  width: `${LAYOUT.TABLE_LABEL_WIDTH}px`,
                  height: `${LAYOUT.TABLE_LABEL_HEIGHT}px`
                }}
              >
                <div className="text-white font-bold text-2xl">TABLE</div>
              </div>
            </div>

            {/* Street selector and controls */}
            <StreetSelector
              currentStreet={currentStreet}
              onStreetChange={handleStreetChange}
              onNextStreet={nextStreet}
              onClearStreet={clearStreetActions}
            />

            {/* Context menu */}
            <SeatContextMenu
              contextMenu={contextMenu}
              onMakeMySeat={handleSetMySeat}
              onMakeDealer={handleMakeDealer}
              onCreateNewPlayer={handleCreateNewPlayer}
              onAssignPlayer={handleAssignPlayer}
              onClearPlayer={handleClearPlayer}
              recentPlayers={getRecentPlayers(20, true)}
              getSeatPlayerName={getSeatPlayerName}
            />

            {/* Action panel */}
            <ActionPanel
              selectedPlayers={selectedPlayers}
              currentStreet={currentStreet}
              seatActions={seatActions}
              onRecordAction={recordAction}
              onClearSelection={handleClearSelection}
              onToggleAbsent={toggleAbsent}
              onClearSeatActions={clearSeatActions}
              onUndoLastAction={undoLastAction}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

TableView.propTypes = {
  // Layout (viewport-derived)
  scale: PropTypes.number.isRequired,
  tableRef: PropTypes.object,
  SEAT_POSITIONS: PropTypes.arrayOf(PropTypes.shape({
    seat: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
  })).isRequired,
  numSeats: PropTypes.number.isRequired,

  // Handlers not in contexts (defined in parent)
  nextHand: PropTypes.func.isRequired,
  resetHand: PropTypes.func.isRequired,
  handleSeatRightClick: PropTypes.func.isRequired,
  getSeatColor: PropTypes.func.isRequired,
  handleDealerDragStart: PropTypes.func.isRequired,
  handleDealerDrag: PropTypes.func.isRequired,
  handleDealerDragEnd: PropTypes.func.isRequired,
  setCurrentStreet: PropTypes.func.isRequired,
  openShowdownScreen: PropTypes.func.isRequired,
  nextStreet: PropTypes.func.isRequired,
  clearStreetActions: PropTypes.func.isRequired,
  clearSeatActions: PropTypes.func.isRequired,
  undoLastAction: PropTypes.func.isRequired,
  handleSetMySeat: PropTypes.func.isRequired,
  setDealerSeat: PropTypes.func.isRequired,
  recordAction: PropTypes.func.isRequired,
  toggleAbsent: PropTypes.func.isRequired,

  // Player persistence (from usePlayerPersistence, not PlayerContext)
  getRecentPlayers: PropTypes.func.isRequired,
  clearSeatAssignment: PropTypes.func.isRequired,
  isPlayerAssigned: PropTypes.func.isRequired,

  // Local UI state from parent
  setPendingSeatForPlayerAssignment: PropTypes.func.isRequired,
  setAutoOpenNewSession: PropTypes.func.isRequired,

  // Toast notifications
  showSuccess: PropTypes.func.isRequired,
  showWarning: PropTypes.func.isRequired,
  showInfo: PropTypes.func.isRequired,
};
