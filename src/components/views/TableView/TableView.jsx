import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CardSlot } from '../../ui/CardSlot';
import { CollapsibleSidebar } from '../../ui/CollapsibleSidebar';
import { buildExploitSummary } from '../../ui/ExploitBadges';
import { analyzeBoardFromStrings } from '../../../utils/exploitEngine/boardTexture';
import { generateBoardExploits } from '../../../utils/exploitEngine/generateExploits';
import { filterDismissed } from '../../../utils/exploitSuggestions';
import { LAYOUT, LIMITS } from '../../../constants/gameConstants';
import { useGame, useUI, useSession, usePlayer, useCard, useToast } from '../../../contexts';
import { usePlayerTendencies } from '../../../hooks/usePlayerTendencies';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useSeatColor } from '../../../hooks/useSeatColor';
import { useSeatUtils } from '../../../hooks/useSeatUtils';
import { useActionUtils } from '../../../hooks/useActionUtils';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { GAME_ACTIONS } from '../../../reducers/gameReducer';
import { UI_ACTIONS } from '../../../reducers/uiReducer';
import { TableHeader } from './TableHeader';
import { SeatComponent } from './SeatComponent';
import { ActionPanel } from './ActionPanel';
import { SeatContextMenu } from './SeatContextMenu';
import { StreetSelector } from './StreetSelector';
import { RangeDetailPanel } from '../../ui/RangeDetailPanel';

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
// Seat positions (percentage-based for responsive layout)
const SEAT_POSITIONS = [
  { seat: 1, x: 33, y: 88 },
  { seat: 2, x: 15, y: 70 },
  { seat: 3, x: 8, y: 45 },
  { seat: 4, x: 18, y: 20 },
  { seat: 5, x: 50, y: 8 },
  { seat: 6, x: 82, y: 20 },
  { seat: 7, x: 92, y: 45 },
  { seat: 8, x: 85, y: 70 },
  { seat: 9, x: 67, y: 88 },
];

export const TableView = ({ scale }) => {
  const tableRef = useRef(null);
  const numSeats = LIMITS.NUM_SEATS;

  // Toast notifications from context
  const { showSuccess, showWarning, showInfo } = useToast();

  // Game handlers from hook
  const {
    nextHand,
    resetHand,
    nextStreet,
    clearStreetActions,
    clearSeatActions,
    undoLastAction,
    toggleAbsent,
    openShowdownScreen,
    handleSetMySeat,
    recordAction,
  } = useGameHandlers();

  // Action utils for seat color
  const { getSeatActionStyle } = useActionUtils();

  // Get state and handlers from contexts
  const {
    currentStreet,
    mySeat,
    dealerButtonSeat,
    seatActions,
    absentSeats,
    smallBlindSeat,
    bigBlindSeat,
    dispatchGame,
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
    dispatchUi,
    showCardSelector,
    setPendingSeatForPlayerAssignment,
    setAutoOpenNewSession,
  } = useUI();

  const {
    currentSession,
    hasActiveSession,
    updateSessionField,
  } = useSession();

  const {
    getSeatPlayerName,
    getSeatPlayer,
    allPlayers,
    assignPlayerToSeat,
    getRecentPlayers,
    clearSeatAssignment,
    isPlayerAssigned,
  } = usePlayer();

  // Card state from CardContext
  const {
    communityCards,
    holeCards,
    holeCardsVisible,
    dispatchCard,
  } = useCard();

  // Seat utils and color
  const { hasSeatFolded, getFirstActionSeat } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, seatActions, numSeats);
  const getSeatColor = useSeatColor(hasSeatFolded, selectedPlayers, mySeat, absentSeats, seatActions, currentStreet, getSeatActionStyle);

  // Dealer drag handlers (need tableRef)
  const handleDealerDragStart = useCallback((e) => {
    dispatchUi({ type: UI_ACTIONS.START_DRAGGING_DEALER });
    e.preventDefault();
  }, [dispatchUi]);

  const handleDealerDrag = useCallback((e) => {
    if (!isDraggingDealer || !tableRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = tableRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let closestSeat = 1;
    let minDist = Infinity;
    SEAT_POSITIONS.forEach(({ seat, x: sx, y: sy }) => {
      if (absentSeats.includes(seat)) return;
      const seatX = (sx / 100) * rect.width;
      const seatY = (sy / 100) * rect.height;
      const dist = Math.sqrt((x - seatX) ** 2 + (y - seatY) ** 2);
      if (dist < minDist) { minDist = dist; closestSeat = seat; }
    });
    dispatchGame({ type: GAME_ACTIONS.SET_DEALER, payload: closestSeat });
  }, [isDraggingDealer, absentSeats, dispatchGame]);

  const handleDealerDragEnd = useCallback((e) => {
    if (isDraggingDealer) { e.stopPropagation(); e.preventDefault(); }
    dispatchUi({ type: UI_ACTIONS.STOP_DRAGGING_DEALER });
  }, [isDraggingDealer, dispatchUi]);

  // Seat right-click handler (needs tableRef + SEAT_POSITIONS)
  const handleSeatRightClick = useCallback((e, seat) => {
    e.preventDefault();
    const seatPos = SEAT_POSITIONS.find(s => s.seat === seat);
    if (!seatPos) return;
    const seatX = (seatPos.x / 100) * LAYOUT.FELT_WIDTH + LAYOUT.TABLE_OFFSET_X;
    const seatY = (seatPos.y / 100) * LAYOUT.FELT_HEIGHT + LAYOUT.TABLE_OFFSET_Y;
    dispatchUi({
      type: UI_ACTIONS.SET_CONTEXT_MENU,
      payload: { x: seatX + LAYOUT.CONTEXT_MENU_OFFSET_X, y: seatY + LAYOUT.CONTEXT_MENU_OFFSET_Y, seat }
    });
  }, [dispatchUi]);

  const setDealerSeat = useCallback((seat) => {
    dispatchGame({ type: GAME_ACTIONS.SET_DEALER, payload: seat });
  }, [dispatchGame]);

  const setCurrentStreet = useCallback((street) => {
    dispatchGame({ type: GAME_ACTIONS.SET_STREET, payload: street });
  }, [dispatchGame]);

  // Auto-select first action seat when street changes or card selector closes
  useEffect(() => {
    if (!showCardSelector && currentStreet !== 'showdown') {
      if (selectedPlayers.length === 0) {
        const firstSeat = getFirstActionSeat();
        dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [firstSeat] });
      }
    }
  }, [currentStreet, showCardSelector, selectedPlayers, getFirstActionSeat, dispatchUi]);

  // Player tendency stats for confidence opacity
  const { tendencyMap } = usePlayerTendencies(allPlayers);

  // Range detail modal state
  const [rangeDetailSeat, setRangeDetailSeat] = useState(null);
  const rangeDetailPlayerId = rangeDetailSeat ? (getSeatPlayer(rangeDetailSeat)?.playerId || null) : null;
  const rangeDetailTendencies = rangeDetailPlayerId ? tendencyMap[rangeDetailPlayerId] : null;
  const rangeDetailProfile = rangeDetailTendencies?.rangeProfile || null;
  const rangeDetailSummary = rangeDetailTendencies?.rangeSummary || null;

  // Board texture from community cards
  const boardTexture = useMemo(() => {
    const cards = communityCards.filter(c => c && c !== '');
    if (cards.length < 3) return null;
    return analyzeBoardFromStrings(cards);
  }, [communityCards]);

  // Precompute exploit data for all seats (persisted + live suggestions)
  const seatExploitData = useMemo(() => {
    const data = {};
    for (let seat = 1; seat <= numSeats; seat++) {
      const player = getSeatPlayer(seat);
      if (!player) continue;

      const persisted = player.exploits || [];
      const tendencies = tendencyMap[player.playerId];

      let liveSuggestions = [];
      if (tendencies?.exploits) {
        liveSuggestions = filterDismissed(tendencies.exploits, player.dismissedSuggestions);
      }
      // Board-texture rules (ephemeral, computed locally)
      if (boardTexture && tendencies) {
        const boardExploits = generateBoardExploits(tendencies, boardTexture);
        liveSuggestions = [...liveSuggestions, ...boardExploits];
      }

      const combined = [...persisted, ...liveSuggestions];
      if (combined.length > 0) {
        data[seat] = {
          summary: buildExploitSummary(combined),
          exploits: combined,
          sampleSize: tendencies?.sampleSize || 0,
        };
      }
    }
    return data;
  }, [numSeats, getSeatPlayer, tendencyMap, boardTexture]);

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
                  isSmallBlind={smallBlindSeat === seat}
                  isBigBlind={bigBlindSeat === seat}
                  isMySeat={seat === mySeat}
                  playerName={getSeatPlayerName(seat)}
                  exploitSummary={seatExploitData[seat]?.summary || null}
                  exploits={seatExploitData[seat]?.exploits || []}
                  sampleSize={seatExploitData[seat]?.sampleSize || 0}
                  holeCards={holeCards}
                  holeCardsVisible={holeCardsVisible}
                  getSeatColor={getSeatColor}
                  onSeatClick={togglePlayerSelection}
                  onSeatRightClick={handleSeatRightClick}
                  onDealerDragStart={handleDealerDragStart}
                  onHoleCardClick={handleHoleCardClick}
                  onToggleVisibility={handleToggleHoleCardsVisibility}
                  onOpenRangeDetail={setRangeDetailSeat}
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
              onClearSelection={handleClearSelection}
              onToggleAbsent={toggleAbsent}
              onClearSeatActions={clearSeatActions}
              onUndoLastAction={undoLastAction}
            />
          </div>

        </div>
      </div>

      {/* Range Detail Modal — renders via portal to document.body */}
      <RangeDetailPanel
        rangeProfile={rangeDetailProfile}
        rangeSummary={rangeDetailSummary}
        playerName={rangeDetailSeat ? (getSeatPlayerName(rangeDetailSeat) || `Seat ${rangeDetailSeat}`) : ''}
        onClose={() => setRangeDetailSeat(null)}
        isOpen={rangeDetailSeat !== null}
      />
    </div>
  );
};

TableView.propTypes = {
  scale: PropTypes.number.isRequired,
};
