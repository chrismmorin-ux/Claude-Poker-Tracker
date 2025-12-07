import React, { useState, useReducer, useRef, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, RotateCcw, SkipForward } from 'lucide-react';
import { ScaledContainer } from './components/ui/ScaledContainer';
import { CardSlot } from './components/ui/CardSlot';
import { VisibilityToggle } from './components/ui/VisibilityToggle';
import { PositionBadge } from './components/ui/PositionBadge';
import { DiagonalOverlay } from './components/ui/DiagonalOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StatsView } from './components/views/StatsView';
import { CardSelectorView } from './components/views/CardSelectorView';
import { TableView } from './components/views/TableView';
import { ShowdownView } from './components/views/ShowdownView';
import { HistoryView } from './components/views/HistoryView';
import { SessionsView } from './components/views/SessionsView';
import { PlayersView } from './components/views/PlayersView';
import { logger } from './utils/errorHandler';
import { gameReducer, initialGameState, GAME_ACTIONS } from './reducers/gameReducer';
import { uiReducer, initialUiState, UI_ACTIONS } from './reducers/uiReducer';
import { cardReducer, initialCardState, CARD_ACTIONS } from './reducers/cardReducer';
import { sessionReducer, initialSessionState, SESSION_ACTIONS } from './reducers/sessionReducer';
import { playerReducer, initialPlayerState, PLAYER_ACTIONS } from './reducers/playerReducer';
import {
  getActionDisplayName,
  getActionColor,
  getSeatActionStyle,
  getOverlayStatus
} from './utils/actionUtils';
import { validateActionSequence } from './utils/actionValidation';
import {
  isRedCard,
  isRedSuit,
  getCardAbbreviation,
  getHandAbbreviation
} from './utils/displayUtils';
import {
  ACTIONS,
  ACTION_ABBREV,
  FOLD_ACTIONS,
  SEAT_STATUS,
  STREETS,
  BETTING_STREETS,
  SEAT_ARRAY,
  SUITS,
  RANKS,
  SUIT_ABBREV,
  isFoldAction,
  LIMITS,
  LAYOUT
} from './constants/gameConstants';
import { useActionUtils } from './hooks/useActionUtils';
import { useStateSetters } from './hooks/useStateSetters';
import { useSeatUtils } from './hooks/useSeatUtils';
import { useSeatColor } from './hooks/useSeatColor';
import { useShowdownHandlers } from './hooks/useShowdownHandlers';
import { useCardSelection } from './hooks/useCardSelection';
import { useShowdownCardSelection } from './hooks/useShowdownCardSelection';
import { usePersistence } from './hooks/usePersistence';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { usePlayerPersistence } from './hooks/usePlayerPersistence';

// =============================================================================
// CONSTANTS - All magic numbers and configuration values
// =============================================================================

// Module name for centralized logging
const MODULE_NAME = 'PokerTracker';
const log = (...args) => logger.debug(MODULE_NAME, ...args);

// Local constants that reference centralized LAYOUT and LIMITS
const CONSTANTS = {
  // From LIMITS
  NUM_SEATS: LIMITS.NUM_SEATS,

  // From LAYOUT
  CARD: LAYOUT.CARD,
  BADGE_SIZE: LAYOUT.BADGE_SIZE,
  SEAT_SIZE: LAYOUT.SEAT_SIZE,
  DEALER_BUTTON_SIZE: LAYOUT.DEALER_BUTTON_SIZE,
  TOGGLE_BUTTON_SIZE: LAYOUT.TOGGLE_BUTTON_SIZE,
  TABLE_WIDTH: LAYOUT.TABLE_WIDTH,
  TABLE_HEIGHT: LAYOUT.TABLE_HEIGHT,
  TABLE_SCALE: 1.0,  // Runtime scale factor (not a magic number)
  FELT_WIDTH: LAYOUT.FELT_WIDTH,
  FELT_HEIGHT: LAYOUT.FELT_HEIGHT,
};

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

// Screen/View identifiers
const SCREEN = {
  TABLE: 'table',
  STATS: 'stats',
  HISTORY: 'history',
  SESSIONS: 'sessions',
  PLAYERS: 'players',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const PokerTrackerWireframes = () => {
  // State managed by reducers
  const [gameState, dispatchGame] = useReducer(gameReducer, initialGameState);
  const [uiState, dispatchUi] = useReducer(uiReducer, initialUiState);
  const [cardState, dispatchCard] = useReducer(cardReducer, initialCardState);
  const [sessionState, dispatchSession] = useReducer(sessionReducer, initialSessionState);
  const [playerState, dispatchPlayer] = useReducer(playerReducer, initialPlayerState);

  // Initialize persistence (auto-save + auto-restore)
  const { isReady } = usePersistence(gameState, cardState, playerState, dispatchGame, dispatchCard, dispatchSession, dispatchPlayer);

  // Initialize session persistence (auto-save + auto-restore sessions)
  const {
    isReady: sessionReady,
    startNewSession,
    endCurrentSession,
    updateSessionField,
    loadAllSessions,
    deleteSessionById
  } = useSessionPersistence(sessionState, dispatchSession);

  // Initialize player persistence
  const {
    isReady: playerReady,
    createNewPlayer,
    updatePlayerById,
    deletePlayerById,
    loadAllPlayers,
    assignPlayerToSeat,
    clearSeatAssignment,
    getSeatPlayerName,
    getRecentPlayers,
    getAssignedPlayerIds,
    isPlayerAssigned,
    getPlayerSeat,
    clearAllSeatAssignments
  } = usePlayerPersistence(playerState, dispatchPlayer);

  // Local UI state (scale)
  const [scale, setScale] = useState(1);
  const tableRef = useRef(null);

  // Track which seat triggered player creation (for auto-assignment)
  const [pendingSeatForPlayerAssignment, setPendingSeatForPlayerAssignment] = useState(null);

  // Destructure state for easier access
  const { currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats } = gameState;
  const { currentView, selectedPlayers, contextMenu, isDraggingDealer } = uiState;
  const {
    communityCards, holeCards, holeCardsVisible, showCardSelector,
    cardSelectorType, highlightedBoardIndex, isShowdownViewOpen,
    allPlayerCards, highlightedSeat, highlightedHoleSlot
  } = cardState;

  // Calculate scale to fit viewport
  useEffect(() => {
    const calculateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const designWidth = CONSTANTS.TABLE_WIDTH;
      const designHeight = CONSTANTS.TABLE_HEIGHT;

      // Calculate scale to fit both width and height with some padding
      const scaleX = (viewportWidth * 0.95) / designWidth;
      const scaleY = (viewportHeight * 0.95) / designHeight;
      const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

      setScale(newScale);
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // =============================================================================
  // HOOKS - Custom hooks for utility functions and state setters
  // =============================================================================

  // Get action utility functions with constants injected
  const {
    getActionDisplayName,
    getActionColor,
    getSeatActionStyle,
    getOverlayStatus,
    getCardAbbreviation,
    getHandAbbreviation,
  } = useActionUtils();

  // Get state setter functions
  const {
    setCurrentScreen,
    setContextMenu,
    setSelectedPlayers,
    setHoleCardsVisible,
    setCurrentStreet,
    setDealerSeat,
    setCardSelectorType,
    setHighlightedCardIndex,
    setHighlightedSeat,
    setHighlightedCardSlot,
  } = useStateSetters(dispatchGame, dispatchUi, dispatchCard);

  // Get seat utility functions
  const {
    getSmallBlindSeat,
    getBigBlindSeat,
    hasSeatFolded,
    getFirstActionSeat,
    getNextActionSeat,
  } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, seatActions, CONSTANTS.NUM_SEATS);

  const advanceDealer = () => {
    dispatchGame({ type: GAME_ACTIONS.ADVANCE_DEALER });
  };

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
      // Skip absent seats
      if (absentSeats.includes(seat)) return;

      const seatX = (sx / 100) * rect.width;
      const seatY = (sy / 100) * rect.height;
      const dist = Math.sqrt((x - seatX) ** 2 + (y - seatY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestSeat = seat;
      }
    });

    dispatchGame({ type: GAME_ACTIONS.SET_DEALER, payload: closestSeat });
  }, [isDraggingDealer, absentSeats, dispatchGame]);

  const handleDealerDragEnd = useCallback((e) => {
    if (isDraggingDealer) {
      e.stopPropagation();
      e.preventDefault();
    }
    dispatchUi({ type: UI_ACTIONS.STOP_DRAGGING_DEALER });
  }, [isDraggingDealer, dispatchUi]);

  const togglePlayerSelection = useCallback((seat) => {
    dispatchUi({ type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION, payload: seat });
  }, [dispatchUi]);

  const handleSeatRightClick = useCallback((e, seat) => {
    e.preventDefault();

    const seatPos = SEAT_POSITIONS.find(s => s.seat === seat);
    if (!seatPos) return;

    const tableRect = tableRef.current?.getBoundingClientRect();
    if (!tableRect) return;

    // Calculate seat position using LAYOUT constants (no magic numbers)
    const seatX = (seatPos.x / 100) * LAYOUT.FELT_WIDTH + LAYOUT.TABLE_OFFSET_X;
    const seatY = (seatPos.y / 100) * LAYOUT.FELT_HEIGHT + LAYOUT.TABLE_OFFSET_Y;

    dispatchUi({
      type: UI_ACTIONS.SET_CONTEXT_MENU,
      payload: {
        x: seatX + LAYOUT.CONTEXT_MENU_OFFSET_X,
        y: seatY + LAYOUT.CONTEXT_MENU_OFFSET_Y,
        seat
      }
    });
  }, [dispatchUi]);

  const handleSetMySeat = useCallback((seat) => {
    dispatchGame({ type: GAME_ACTIONS.SET_MY_SEAT, payload: seat });
    dispatchUi({ type: UI_ACTIONS.CLOSE_CONTEXT_MENU });
  }, [dispatchGame, dispatchUi]);

  const recordAction = useCallback((action) => {
    if (selectedPlayers.length === 0) return;

    // Validate action for each selected seat
    const invalidSeats = [];
    selectedPlayers.forEach(seat => {
      const currentActions = seatActions[currentStreet]?.[seat] || [];
      const validation = validateActionSequence(currentActions, action, currentStreet, ACTIONS);
      if (!validation.valid) {
        invalidSeats.push({ seat, error: validation.error });
      }
    });

    // Show error if any seat has invalid action
    if (invalidSeats.length > 0) {
      const errorMsg = invalidSeats.map(s => `Seat ${s.seat}: ${s.error}`).join('\n');
      alert(`Invalid action:\n${errorMsg}`);
      return;
    }

    // Log and record action
    selectedPlayers.forEach(seat => {
      log(`Seat ${seat}: ${action} on ${currentStreet}`);
    });

    dispatchGame({
      type: GAME_ACTIONS.RECORD_ACTION,
      payload: { seats: selectedPlayers, action }
    });

    // Auto-advance to next seat
    const lastSelectedSeat = Math.max(...selectedPlayers);
    const nextSeat = getNextActionSeat(lastSelectedSeat);
    if (nextSeat) {
      dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [nextSeat] });
    } else {
      dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
    }
  }, [selectedPlayers, currentStreet, seatActions, dispatchGame, dispatchUi, getNextActionSeat]);

  const recordSeatAction = useCallback((seat, action) => {
    log(`Seat ${seat}: ${action} on ${currentStreet}`);
    dispatchGame({
      type: GAME_ACTIONS.RECORD_ACTION,
      payload: { seats: [seat], action }
    });
  }, [currentStreet, dispatchGame]);

  const clearSeatActions = useCallback((seats) => {
    dispatchGame({
      type: GAME_ACTIONS.CLEAR_SEAT_ACTIONS,
      payload: seats
    });
  }, [dispatchGame]);

  const undoLastAction = useCallback((seat) => {
    dispatchGame({
      type: GAME_ACTIONS.UNDO_LAST_ACTION,
      payload: seat
    });
  }, [dispatchGame]);

  const toggleAbsent = useCallback(() => {
    if (selectedPlayers.length === 0) return;

    selectedPlayers.forEach(seat => {
      log(`Seat ${seat}: marked as absent`);
    });

    dispatchGame({ type: GAME_ACTIONS.TOGGLE_ABSENT, payload: selectedPlayers });
    dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
  }, [selectedPlayers, dispatchGame, dispatchUi]);

  const clearStreetActions = useCallback(() => {
    dispatchGame({ type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });
    // Re-select first action seat
    const firstSeat = getFirstActionSeat();
    dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [firstSeat] });
  }, [dispatchGame, dispatchUi, getFirstActionSeat]);

  const openCardSelector = useCallback((type, index) => {
    log('openCardSelector::', type, index);
    dispatchCard({
      type: CARD_ACTIONS.OPEN_CARD_SELECTOR,
      payload: { type, index }
    });
  }, [dispatchCard]);

  const openShowdownScreen = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.OPEN_SHOWDOWN_VIEW });
  }, [dispatchCard]);

  const nextStreet = useCallback(() => {
    const currentIndex = STREETS.indexOf(currentStreet);
    if (currentIndex < STREETS.length - 1) {
      const nextStreetName = STREETS[currentIndex + 1];
      dispatchGame({ type: GAME_ACTIONS.SET_STREET, payload: nextStreetName });
      dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });

      // Auto-open card selector for flop, turn, and river
      if (nextStreetName === 'flop') {
        openCardSelector('community', 0);
      } else if (nextStreetName === 'turn') {
        openCardSelector('community', 3);
      } else if (nextStreetName === 'river') {
        openCardSelector('community', 4);
      } else if (nextStreetName === 'showdown') {
        openShowdownScreen();
      }
    }
  }, [currentStreet, dispatchGame, dispatchUi, openCardSelector, openShowdownScreen]);

  const isSeatInactive = useCallback((seat) => {
    // Check if seat is absent
    if (absentSeats.includes(seat)) return SEAT_STATUS.ABSENT;

    // Check if seat folded on any previous street
    for (const street of BETTING_STREETS) {
      const action = seatActions[street]?.[seat];
      if (isFoldAction(action)) {
        return SEAT_STATUS.FOLDED;
      }
    }

    return false;
  }, [absentSeats, seatActions]);

  const getSeatActionSummary = (seat) => {
    const actions = [];
    
    STREETS.forEach(street => {
      const action = seatActions[street]?.[seat];
      if (action) {
        let displayAction = getActionDisplayName(action);

        if (street === 'showdown' && action !== ACTIONS.MUCKED) {
          // For showdown, add cards if available
          const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
          const handAbbr = getHandAbbreviation(cards);
          if (handAbbr) {
            displayAction = `show ${handAbbr}`;
          } else {
            displayAction = 'show';
          }
        }

        actions.push(`${street} ${displayAction}`);
      }
    });
    
    return actions;
  };

  const allCardsAssigned = useCallback(() => {
    // Check if all non-folded, non-absent seats have cards assigned
    for (let seat = 1; seat <= CONSTANTS.NUM_SEATS; seat++) {
      const inactiveStatus = isSeatInactive(seat);
      const showdownActions = seatActions['showdown']?.[seat];
      const showdownActionsArray = Array.isArray(showdownActions) ? showdownActions : (showdownActions ? [showdownActions] : []);
      const isMucked = showdownActionsArray.includes(ACTIONS.MUCKED);
      const hasWon = showdownActionsArray.includes(ACTIONS.WON);

      // Skip folded, absent, mucked, and won seats
      if (inactiveStatus === SEAT_STATUS.FOLDED || inactiveStatus === SEAT_STATUS.ABSENT || isMucked || hasWon) {
        continue;
      }

      // Check if this active seat has both cards
      const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
      if (!cards[0] || !cards[1]) {
        return false;
      }
    }
    return true;
  }, [isSeatInactive, seatActions, mySeat, holeCards, allPlayerCards]);

  const clearCards = useCallback((type) => {
    if (type === 'community') {
      dispatchCard({ type: CARD_ACTIONS.CLEAR_COMMUNITY_CARDS });
    } else if (type === 'hole') {
      dispatchCard({ type: CARD_ACTIONS.CLEAR_HOLE_CARDS });
    }
    dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX, payload: null });
  }, [dispatchCard]);

  const getCardStreet = useCallback((card) => {
    const communityIndex = communityCards.indexOf(card);
    if (communityIndex !== -1) {
      if (communityIndex <= 2) return 'F';
      if (communityIndex === 3) return 'T';
      if (communityIndex === 4) return 'R';
    }
    // Only show "Hole" indicator if hole cards are visible
    if (holeCardsVisible && holeCards.includes(card)) return 'Hole';
    return null;
  }, [communityCards, holeCardsVisible, holeCards]);

  const nextHand = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });
    dispatchGame({ type: GAME_ACTIONS.NEXT_HAND });
    dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
    log('nextHand: dealer advanced, all cards/actions cleared');
  }, [dispatchCard, dispatchGame, dispatchUi]);

  const resetHand = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });
    dispatchGame({ type: GAME_ACTIONS.RESET_HAND });
    dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
    log('resetHand: all state cleared including absent seats');
  }, [dispatchCard, dispatchGame, dispatchUi]);

  // Get showdown handler functions
  const {
    handleClearShowdownCards,
    handleMuckSeat,
    handleWonSeat,
    handleNextHandFromShowdown,
    handleCloseShowdown,
    handleCloseCardSelector,
  } = useShowdownHandlers(
    dispatchCard,
    dispatchGame,
    isSeatInactive,
    seatActions,
    recordSeatAction,
    nextHand,
    CONSTANTS.NUM_SEATS,
    log
  );

  // Get seat color function
  const getSeatColor = useSeatColor(
    hasSeatFolded,
    selectedPlayers,
    mySeat,
    absentSeats,
    seatActions,
    currentStreet,
    getSeatActionStyle
  );

  // Get card selection functions
  const selectCard = useCardSelection(
    highlightedBoardIndex,
    cardSelectorType,
    communityCards,
    holeCards,
    currentStreet,
    dispatchCard
  );

  const selectCardForShowdown = useShowdownCardSelection(
    highlightedSeat,
    highlightedHoleSlot,
    mySeat,
    holeCards,
    allPlayerCards,
    communityCards,
    seatActions,
    isSeatInactive,
    dispatchCard,
    CONSTANTS.NUM_SEATS
  );

  // Auto-select first action seat when street changes or card selector closes
  useEffect(() => {
    if (currentView === SCREEN.TABLE && !showCardSelector && currentStreet !== 'showdown') {
      // Only auto-select if no players are currently selected
      if (selectedPlayers.length === 0) {
        const firstSeat = getFirstActionSeat();
        dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [firstSeat] });
      }
    }
  }, [currentStreet, showCardSelector, currentView, selectedPlayers, getFirstActionSeat, dispatchUi]);

  // Showdown Screen
  if (isShowdownViewOpen) {
    return (
      <ShowdownView
        scale={scale}
        communityCards={communityCards}
        holeCards={holeCards}
        holeCardsVisible={holeCardsVisible}
        mySeat={mySeat}
        dealerButtonSeat={dealerButtonSeat}
        allPlayerCards={allPlayerCards}
        highlightedSeat={highlightedSeat}
        highlightedHoleSlot={highlightedHoleSlot}
        seatActions={seatActions}
        SEAT_ARRAY={SEAT_ARRAY}
        STREETS={STREETS}
        BETTING_STREETS={BETTING_STREETS}
        ACTIONS={ACTIONS}
        ACTION_ABBREV={ACTION_ABBREV}
        SEAT_STATUS={SEAT_STATUS}
        handleNextHandFromShowdown={handleNextHandFromShowdown}
        handleClearShowdownCards={handleClearShowdownCards}
        handleCloseShowdown={handleCloseShowdown}
        allCardsAssigned={allCardsAssigned}
        isSeatInactive={isSeatInactive}
        getSmallBlindSeat={getSmallBlindSeat}
        getBigBlindSeat={getBigBlindSeat}
        setHoleCardsVisible={setHoleCardsVisible}
        setHighlightedSeat={setHighlightedSeat}
        setHighlightedCardSlot={setHighlightedCardSlot}
        handleMuckSeat={handleMuckSeat}
        handleWonSeat={handleWonSeat}
        selectCardForShowdown={selectCardForShowdown}
        getOverlayStatus={getOverlayStatus}
        getActionColor={getActionColor}
        getActionDisplayName={getActionDisplayName}
        isFoldAction={isFoldAction}
        getHandAbbreviation={getHandAbbreviation}
        SkipForward={SkipForward}
      />
    );
  }

  // Card Selector Screen (renders when showCardSelector is true)
  if (showCardSelector) {
    return (
      <CardSelectorView
        cardSelectorType={cardSelectorType}
        currentStreet={currentStreet}
        communityCards={communityCards}
        holeCards={holeCards}
        holeCardsVisible={holeCardsVisible}
        highlightedBoardIndex={highlightedBoardIndex}
        scale={scale}
        getCardStreet={getCardStreet}
        selectCard={selectCard}
        clearCards={clearCards}
        handleCloseCardSelector={handleCloseCardSelector}
        setHoleCardsVisible={setHoleCardsVisible}
        setCardSelectorType={setCardSelectorType}
        setHighlightedCardIndex={setHighlightedCardIndex}
      />
    );
  }

  // Table Screen (main poker table view)
  if (currentView === SCREEN.TABLE) {
    return (
      <TableView
        scale={scale}
        currentStreet={currentStreet}
        communityCards={communityCards}
        holeCards={holeCards}
        holeCardsVisible={holeCardsVisible}
        mySeat={mySeat}
        dealerButtonSeat={dealerButtonSeat}
        selectedPlayers={selectedPlayers}
        contextMenu={contextMenu}
        isDraggingDealer={isDraggingDealer}
        tableRef={tableRef}
        SEAT_POSITIONS={SEAT_POSITIONS}
        STREETS={STREETS}
        ACTIONS={ACTIONS}
        ACTION_ABBREV={ACTION_ABBREV}
        SCREEN={SCREEN}
        seatActions={seatActions}
        setContextMenu={setContextMenu}
        nextHand={nextHand}
        setCurrentScreen={setCurrentScreen}
        resetHand={resetHand}
        openCardSelector={openCardSelector}
        togglePlayerSelection={togglePlayerSelection}
        handleSeatRightClick={handleSeatRightClick}
        getSeatColor={getSeatColor}
        handleDealerDragStart={handleDealerDragStart}
        handleDealerDrag={handleDealerDrag}
        handleDealerDragEnd={handleDealerDragEnd}
        getSmallBlindSeat={getSmallBlindSeat}
        getBigBlindSeat={getBigBlindSeat}
        setHoleCardsVisible={setHoleCardsVisible}
        setCurrentStreet={setCurrentStreet}
        openShowdownScreen={openShowdownScreen}
        nextStreet={nextStreet}
        clearStreetActions={clearStreetActions}
        clearSeatActions={clearSeatActions}
        undoLastAction={undoLastAction}
        handleSetMySeat={handleSetMySeat}
        setDealerSeat={setDealerSeat}
        recordAction={recordAction}
        setSelectedPlayers={setSelectedPlayers}
        toggleAbsent={toggleAbsent}
        getRecentPlayers={getRecentPlayers}
        assignPlayerToSeat={assignPlayerToSeat}
        clearSeatAssignment={clearSeatAssignment}
        getSeatPlayerName={getSeatPlayerName}
        isPlayerAssigned={isPlayerAssigned}
        setPendingSeatForPlayerAssignment={setPendingSeatForPlayerAssignment}
        SkipForward={SkipForward}
        BarChart3={BarChart3}
        RotateCcw={RotateCcw}
      />
    );
  }

  // History Screen
  if (currentView === SCREEN.HISTORY) {
    return (
      <HistoryView
        scale={scale}
        setCurrentScreen={setCurrentScreen}
        dispatchGame={dispatchGame}
        dispatchCard={dispatchCard}
        dispatchPlayer={dispatchPlayer}
        STREETS={STREETS}
      />
    );
  }

  // Sessions Screen
  if (currentView === SCREEN.SESSIONS) {
    return (
      <SessionsView
        scale={scale}
        setCurrentScreen={setCurrentScreen}
        sessionState={sessionState}
        dispatchSession={dispatchSession}
        startNewSession={startNewSession}
        endCurrentSession={endCurrentSession}
        updateSessionField={updateSessionField}
        loadAllSessions={loadAllSessions}
        deleteSessionById={deleteSessionById}
        SCREEN={SCREEN}
      />
    );
  }

  // Players Screen
  if (currentView === SCREEN.PLAYERS) {
    return (
      <PlayersView
        scale={scale}
        onBackToTable={() => setCurrentScreen(SCREEN.TABLE)}
        playerState={playerState}
        createNewPlayer={createNewPlayer}
        updatePlayerById={updatePlayerById}
        deletePlayerById={deletePlayerById}
        loadAllPlayers={loadAllPlayers}
        assignPlayerToSeat={assignPlayerToSeat}
        clearSeatAssignment={clearSeatAssignment}
        getSeatPlayerName={getSeatPlayerName}
        isPlayerAssigned={isPlayerAssigned}
        getPlayerSeat={getPlayerSeat}
        clearAllSeatAssignments={clearAllSeatAssignments}
        pendingSeatForPlayerAssignment={pendingSeatForPlayerAssignment}
        setPendingSeatForPlayerAssignment={setPendingSeatForPlayerAssignment}
      />
    );
  }

  // Stats Screen
  return (
    <StatsView
      seatActions={seatActions}
      mySeat={mySeat}
      setCurrentScreen={setCurrentScreen}
      scale={scale}
    />
  );
};

// Wrap the main component with ErrorBoundary for crash protection
const PokerTrackerWithErrorBoundary = () => (
  <ErrorBoundary>
    <PokerTrackerWireframes />
  </ErrorBoundary>
);

export default PokerTrackerWithErrorBoundary;
