import React, { useState, useMemo, useRef, useCallback } from 'react';
import { getActionsForSeatOnStreet, hasBetOrRaiseOnStreet, getPreflopAggressor } from '../../../utils/sequenceUtils';
import { getSeatContributions } from '../../../utils/potCalculator';
import PropTypes from 'prop-types';
import { CardSlot } from '../../ui/CardSlot';
import { CollapsibleSidebar } from '../../ui/CollapsibleSidebar';
import { buildExploitSummary } from '../../ui/ExploitBadges';
import { analyzeBoardFromStrings } from '../../../utils/exploitEngine/boardTexture';
import { generateBoardExploits, enrichExploitsWithEquity } from '../../../utils/exploitEngine/generateExploits';
import { filterDismissed } from '../../../utils/exploitEngine/generateExploits';
import { LAYOUT, LIMITS } from '../../../constants/gameConstants';
import { useGame, useUI, useSession, usePlayer, useCard, useToast } from '../../../contexts';
import { usePlayerTendencies } from '../../../hooks/usePlayerTendencies';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useSeatColor } from '../../../hooks/useSeatColor';
import { useSeatUtils } from '../../../hooks/useSeatUtils';
import { useSessionTimer } from '../../../hooks/useSessionTimer';
import { useAutoSeatSelection } from '../../../hooks/useAutoSeatSelection';
import { useAutoStreetAdvance } from '../../../hooks/useAutoStreetAdvance';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { GAME_ACTIONS } from '../../../reducers/gameReducer';
import { UI_ACTIONS } from '../../../reducers/uiReducer';
import { TableHeader } from './TableHeader';
import { SeatComponent } from './SeatComponent';
import { SeatContextMenu } from './SeatContextMenu';
import { CommandStrip } from './CommandStrip';
import { RangeDetailPanel } from '../../ui/RangeDetailPanel';
import { PotDisplay } from '../../ui/PotDisplay';
import { useCardSelection } from '../../../hooks/useCardSelection';
import { useLiveEquity } from '../../../hooks/useLiveEquity';
import { EquityBadge } from '../../ui/EquityBadge';


/**
 * TableView - Main poker table interface
 * Orchestrates sub-components for the poker table display
 */
// Seat positions (percentage-based for responsive layout)
// Equidistant around stadium perimeter (860×450, r=225), half-gap at TABLE label edges
const SEAT_POSITIONS = [
  { seat: 1, x: 20, y: 96 },
  { seat: 2, x: 2,  y: 69 },
  { seat: 3, x: 4,  y: 23 },
  { seat: 4, x: 25, y: 2 },
  { seat: 5, x: 50, y: 2 },
  { seat: 6, x: 75, y: 2 },
  { seat: 7, x: 96, y: 23 },
  { seat: 8, x: 98, y: 69 },
  { seat: 9, x: 80, y: 96 },
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
    getRemainingSeats,
    restFold,
    checkAround,
    getCardStreet,
    clearCards,
  } = useGameHandlers();

  // Get state and handlers from contexts
  const {
    currentStreet,
    mySeat,
    dealerButtonSeat,
    absentSeats,
    smallBlindSeat,
    bigBlindSeat,
    actionSequence,
    dispatchGame,
    potInfo,
    blinds,
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
    cardSelectorType,
    highlightedBoardIndex,
    setCardSelectorType,
    setHighlightedCardIndex,
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
  const { hasSeatFolded, getFirstActionSeat, getNextActionSeat, isStreetComplete, activeSeatCount } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, actionSequence, numSeats);
  const getSeatColor = useSeatColor({ hasSeatFolded, selectedPlayers, mySeat, absentSeats, actionSequence, currentStreet });

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

  // Auto-select first action seat on mount, street change, or card selector close
  const { scheduleAutoSelect } = useAutoSeatSelection(showCardSelector, currentStreet, getFirstActionSeat, dispatchUi);

  // Auto-advance to next street when all actions are complete
  useAutoStreetAdvance(
    actionSequence, currentStreet, showCardSelector,
    isStreetComplete, nextStreet, activeSeatCount,
    setCurrentStreet, openShowdownScreen
  );

  // Player tendency stats for confidence opacity
  const { tendencyMap } = usePlayerTendencies(allPlayers);

  // Live equity computation
  const liveEquity = useLiveEquity({
    holeCards,
    communityCards,
    mySeat,
    dealerSeat: dealerButtonSeat,
    actionSequence,
    tendencyMap,
    getSeatPlayer,
  });

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

      let combined = [...persisted, ...liveSuggestions];

      // Enrich with live equity for the focused villain
      if (liveEquity.equity != null && liveEquity.villainSeat === seat && combined.length > 0) {
        combined = enrichExploitsWithEquity([...combined], { heroEquity: liveEquity.equity, foldPct: liveEquity.foldPct });
      }

      if (combined.length > 0) {
        data[seat] = {
          summary: buildExploitSummary(combined),
          exploits: combined,
          sampleSize: tendencies?.sampleSize || 0,
        };
      }
    }
    return data;
  }, [numSeats, getSeatPlayer, tendencyMap, boardTexture, liveEquity.equity, liveEquity.villainSeat]);

  // Derived session values
  const handCount = currentSession?.handCount || 0;
  const sessionStartTime = currentSession?.startTime;
  const currentSessionVenue = currentSession?.venue;
  const currentSessionGameType = currentSession?.gameType;

  // Session timer
  const sessionTimeDisplay = useSessionTimer(sessionStartTime);

  // Convert absentSeats array to Set for CollapsibleSidebar
  const absentSeatsSet = useMemo(() => new Set(absentSeats || []), [absentSeats]);

  // Per-seat bet amounts for chip display
  const seatContributions = useMemo(
    () => getSeatContributions(actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat),
    [actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat]
  );

  // Handle seat change from sidebar navigation
  const handleSeatChange = (seat) => {
    setSelectedPlayers([seat]);
  };

  // Handler callbacks for sub-components
  const handleEndSession = () => setCurrentScreen(SCREEN.SESSIONS);

  const handleNewSession = () => {
    setAutoOpenNewSession(true);
    setCurrentScreen(SCREEN.SESSIONS);
  };

  const handleNextHandWithToast = () => {
    const handNumber = (currentSession?.handCount || 0) + 1;
    nextHand();
    if (hasActions) {
      showSuccess(`Hand #${handNumber} completed`);
    } else {
      showInfo(`Hand #${handNumber + 1} started`);
    }
    scheduleAutoSelect();
  };

  const handleResetHandWithToast = () => {
    resetHand();
    showWarning('Hand reset');
    scheduleAutoSelect();
  };

  const handleClearStreetWithAutoSelect = () => {
    clearStreetActions();
    // clearStreetActions already auto-selects in useGameHandlers
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

  // Auto-advance to next action seat after recording an action
  const handleAdvanceSeat = useCallback((currentSeat) => {
    // Use setTimeout so the reducer processes the action first,
    // then we compute the next seat from updated state on next render.
    // Instead, we compute optimistically: next seat after current.
    const nextSeat = getNextActionSeat(currentSeat);
    if (nextSeat) {
      dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [nextSeat] });
    } else {
      // No more seats to act — clear selection
      setSelectedPlayers([]);
    }
  }, [getNextActionSeat, dispatchUi, setSelectedPlayers]);

  // Pot correction handler
  const handlePotCorrection = useCallback((amount) => {
    dispatchGame({ type: GAME_ACTIONS.SET_POT_OVERRIDE, payload: amount });
  }, [dispatchGame]);

  // PFR badge: show on postflop streets
  const pfrSeat = currentStreet !== 'preflop' ? getPreflopAggressor(actionSequence) : null;

  const hasActions = actionSequence.length > 0;

  // HE-1a: Batch action handlers
  const remainingSeats = getRemainingSeats();
  const remainingCount = remainingSeats.length;
  const canCheckAround = currentStreet !== 'preflop' && !hasBetOrRaiseOnStreet(actionSequence, currentStreet);

  const handleRestFold = () => {
    const count = restFold();
    showInfo(`${count} seat${count !== 1 ? 's' : ''} folded`);
  };

  const handleCheckAround = () => {
    const count = checkAround();
    showInfo(`${count} seat${count !== 1 ? 's' : ''} checked`);
  };

  // HE-1b: Card selector overlay
  const selectCard = useCardSelection(
    highlightedBoardIndex,
    cardSelectorType,
    communityCards,
    holeCards,
    currentStreet,
    dispatchCard,
    dispatchUi
  );

  const handleCloseCardSelector = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.CLOSE_CARD_SELECTOR });
  }, [dispatchUi]);

  return (
    <div className="flex items-center justify-center h-dvh overflow-hidden" style={{ background: '#111318' }}>
      <div style={{
        width: `${LAYOUT.TABLE_WIDTH}px`,
        height: `${LAYOUT.TABLE_HEIGHT}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center'
      }}>
        <div
          className="flex flex-col"
          style={{
            width: `${LAYOUT.TABLE_WIDTH}px`,
            height: `${LAYOUT.TABLE_HEIGHT}px`,
            background: 'radial-gradient(ellipse 70% 60% at 40% 50%, #1a2030 0%, #0d1117 100%)',
          }}
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
          />

          <div className={`flex-1 relative p-4 transition-all duration-300 ${isSidebarCollapsed ? 'ml-14' : 'ml-36'}`}>
            {/* Felt table */}
            <div
              ref={tableRef}
              className="absolute"
              style={{
                top: `${LAYOUT.TABLE_OFFSET_Y}px`,
                left: `${LAYOUT.TABLE_OFFSET_X}px`,
                width: `${LAYOUT.FELT_WIDTH}px`,
                height: `${LAYOUT.FELT_HEIGHT}px`,
                borderRadius: `${LAYOUT.FELT_HEIGHT / 2}px`,
                background: 'linear-gradient(160deg, #5c3a1a 0%, #3d2510 30%, #2a1808 70%, #3d2510 100%)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,200,100,0.08)',
              }}
              onMouseMove={handleDealerDrag}
              onMouseUp={handleDealerDragEnd}
              onMouseLeave={handleDealerDragEnd}
            >
              {/* Inner felt with community cards */}
              <div
                className="absolute inset-3"
                style={{
                  borderRadius: `${LAYOUT.FELT_HEIGHT / 2 - 12}px`,
                  background: 'radial-gradient(ellipse 90% 70% at 50% 45%, #228b46 0%, #1a6b3c 40%, #145a30 70%, #0f4d2a 100%)',
                  boxShadow: 'inset 0 2px 40px rgba(0,0,0,0.35), inset 0 0 80px rgba(0,0,0,0.15)',
                  border: '2px solid rgba(0,0,0,0.3)',
                }}
              >
                {/* Community cards */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2 relative w-fit">
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
                  <EquityBadge
                    equity={liveEquity.equity}
                    isComputing={liveEquity.isComputing}
                    villainName={liveEquity.villainName}
                  />
                </div>

                {/* Pot display */}
                <PotDisplay
                  potTotal={potInfo.total}
                  isEstimated={potInfo.isEstimated}
                  onCorrect={handlePotCorrection}
                />
              </div>

              {/* Seats */}
              {SEAT_POSITIONS.map(({ seat, x, y }) => (
                <SeatComponent
                  key={seat}
                  seat={seat}
                  x={x}
                  y={y}
                  actionArray={getActionsForSeatOnStreet(actionSequence, seat, currentStreet)}
                  isDealer={dealerButtonSeat === seat}
                  isSmallBlind={smallBlindSeat === seat}
                  isBigBlind={bigBlindSeat === seat}
                  isMySeat={seat === mySeat}
                  isPFR={pfrSeat === seat}
                  playerName={getSeatPlayerName(seat)}
                  exploitSummary={seatExploitData[seat]?.summary || null}
                  exploits={seatExploitData[seat]?.exploits || []}
                  sampleSize={seatExploitData[seat]?.sampleSize || 0}
                  holeCards={holeCards}
                  holeCardsVisible={holeCardsVisible}
                  getSeatColor={getSeatColor}
                  seatBet={seatContributions[seat] || 0}
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
                className="absolute transform -translate-x-1/2 flex items-center justify-center"
                style={{
                  left: '50%',
                  bottom: `${LAYOUT.TABLE_LABEL_BOTTOM}px`,
                  width: `${LAYOUT.TABLE_LABEL_WIDTH}px`,
                  height: `${LAYOUT.TABLE_LABEL_HEIGHT}px`,
                  background: 'linear-gradient(180deg, #3d2510 0%, #2a1808 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(212,168,71,0.3)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontFamily: "'Playfair Display', serif", color: '#d4a847', fontSize: '20px', fontWeight: 700, letterSpacing: '4px' }}>TABLE</div>
              </div>
            </div>

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
          </div>

          {/* Command Strip - unified right panel */}
          <CommandStrip
            currentStreet={currentStreet}
            onStreetChange={handleStreetChange}
            onNextStreet={nextStreet}
            onClearStreet={handleClearStreetWithAutoSelect}
            selectedPlayers={selectedPlayers}
            dealerButtonSeat={dealerButtonSeat}
            onClearSelection={handleClearSelection}
            onToggleAbsent={toggleAbsent}
            onClearSeatActions={clearSeatActions}
            onUndoLastAction={undoLastAction}
            onAdvanceSeat={handleAdvanceSeat}
            remainingCount={remainingCount}
            canCheckAround={canCheckAround}
            onRestFold={handleRestFold}
            onCheckAround={handleCheckAround}
            onNextHand={handleNextHandWithToast}
            onResetHand={handleResetHandWithToast}
            showCardSelector={showCardSelector}
            communityCards={communityCards}
            holeCards={holeCards}
            holeCardsVisible={holeCardsVisible}
            cardSelectorType={cardSelectorType}
            highlightedBoardIndex={highlightedBoardIndex}
            onSelectCard={selectCard}
            onCloseCardSelector={handleCloseCardSelector}
            getCardStreet={getCardStreet}
            setCardSelectorType={setCardSelectorType}
            setHighlightedCardIndex={setHighlightedCardIndex}
            onToggleHoleVisibility={handleToggleHoleCardsVisibility}
            onClearBoard={() => clearCards('community')}
            onClearHole={() => clearCards('hole')}
            nextActionSeat={selectedPlayers.length === 1 ? getNextActionSeat(selectedPlayers[0]) : null}
            getSeatPlayerName={getSeatPlayerName}
          />

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

      {/* Card selector is now inline in CommandStrip */}
    </div>
  );
};

TableView.propTypes = {
  scale: PropTypes.number.isRequired,
};
