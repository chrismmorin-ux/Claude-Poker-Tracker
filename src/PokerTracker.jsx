import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logger } from './utils/errorHandler';
import { GAME_ACTIONS } from './reducers/gameReducer';
import { UI_ACTIONS } from './reducers/uiReducer';
import { CARD_ACTIONS } from './reducers/cardReducer';
import { SESSION_ACTIONS } from './reducers/sessionReducer';
import { validateActionSequence } from './utils/actionValidation';
import {
  ACTIONS,
  SEAT_STATUS,
  STREETS,
  BETTING_STREETS,
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
import { useAppState } from './hooks/useAppState';
import { AppProviders } from './AppProviders';
import { SCREEN } from './ViewRouter';
// View components
import { StatsView } from './components/views/StatsView';
import { CardSelectorView } from './components/views/CardSelectorView';
import { TableView } from './components/views/TableView';
import { ShowdownView } from './components/views/ShowdownView';
import { HistoryView } from './components/views/HistoryView';
import { SessionsView } from './components/views/SessionsView';
import { PlayersView } from './components/views/PlayersView';
import { SettingsView } from './components/views/SettingsView';
import { LoginView } from './components/views/LoginView';
import { SignupView } from './components/views/SignupView';
import { PasswordResetView } from './components/views/PasswordResetView';
import { AuthLoadingScreen } from './components/ui/AuthLoadingScreen';
import { ToastContainer } from './components/ui/Toast';
import { ViewErrorBoundary } from './components/ui/ViewErrorBoundary';

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

// SCREEN imported from ViewRouter

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const PokerTrackerWireframes = () => {
  // Consolidated state management from useAppState hook
  const {
    // State
    gameState,
    uiState,
    cardState,
    sessionState,
    playerState,
    settingsState,
    authState,
    // Dispatchers
    dispatchGame,
    dispatchUi,
    dispatchCard,
    dispatchSession,
    dispatchPlayer,
    dispatchSettings,
    dispatchAuth,
    // Ready flags
    isReady,
    // Persistence functions
    sessionPersistence: {
      startNewSession,
      endCurrentSession,
      updateSessionField,
      loadAllSessions,
      deleteSessionById
    },
    playerPersistence: {
      createNewPlayer,
      updatePlayerById,
      deletePlayerById,
      loadAllPlayers,
      assignPlayerToSeat,
      clearSeatAssignment,
      getSeatPlayerName,
      getRecentPlayers,
      isPlayerAssigned,
      getPlayerSeat,
      clearAllSeatAssignments
    },
    // Toast functions
    toast: { toasts, dismissToast, showError, showSuccess, showWarning }
  } = useAppState();

  // Local UI state (scale)
  const [scale, setScale] = useState(1);
  const tableRef = useRef(null);

  // Track which seat triggered player creation (for auto-assignment)
  const [pendingSeatForPlayerAssignment, setPendingSeatForPlayerAssignment] = useState(null);

  // Track if we should auto-open the new session form when navigating to Sessions view
  const [autoOpenNewSession, setAutoOpenNewSession] = useState(false);

  // Destructure state for easier access
  const { currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats } = gameState;
  const {
    currentView, selectedPlayers, contextMenu, isDraggingDealer, isSidebarCollapsed,
    // View state (moved from cardReducer in v114)
    showCardSelector, cardSelectorType, highlightedBoardIndex,
    isShowdownViewOpen, highlightedSeat, highlightedHoleSlot
  } = uiState;
  // Card data only
  const { communityCards, holeCards, holeCardsVisible, allPlayerCards } = cardState;

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

  const toggleSidebar = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.TOGGLE_SIDEBAR });
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
      showError(`Invalid action:\n${errorMsg}`);
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
    dispatchUi({
      type: UI_ACTIONS.OPEN_CARD_SELECTOR,
      payload: { type, index }
    });
  }, [dispatchUi]);

  const openShowdownScreen = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.OPEN_SHOWDOWN_VIEW });
  }, [dispatchUi]);

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
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX, payload: null });
  }, [dispatchCard, dispatchUi]);

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
    // Increment hand count only when actively moving to next hand
    dispatchSession({ type: SESSION_ACTIONS.INCREMENT_HAND_COUNT });
    log('nextHand: dealer advanced, all cards/actions cleared, hand count incremented');
  }, [dispatchCard, dispatchGame, dispatchUi, dispatchSession]);

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
    dispatchUi,
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
    dispatchCard,
    dispatchUi
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
    dispatchUi,
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

  // Alias for auth ready (from isReady.auth)
  const authReady = isReady.auth;

  // Toast container (rendered with every view)
  const toastOverlay = <ToastContainer toasts={toasts} onDismiss={dismissToast} />;

  // Helper to return to table view
  const returnToTable = useCallback(() => {
    setCurrentScreen(SCREEN.TABLE);
    dispatchUi({ type: UI_ACTIONS.CLOSE_SHOWDOWN_VIEW });
  }, [setCurrentScreen, dispatchUi]);

  // Context wrapper using AppProviders component
  const withContextProviders = useCallback((children) => (
    <AppProviders
      authState={authState}
      dispatchAuth={dispatchAuth}
      gameState={gameState}
      dispatchGame={dispatchGame}
      uiState={uiState}
      dispatchUi={dispatchUi}
      sessionState={sessionState}
      dispatchSession={dispatchSession}
      playerState={playerState}
      dispatchPlayer={dispatchPlayer}
      cardState={cardState}
      dispatchCard={dispatchCard}
      settingsState={settingsState}
      dispatchSettings={dispatchSettings}
    >
      {children}
    </AppProviders>
  ), [authState, dispatchAuth, gameState, dispatchGame, uiState, dispatchUi, sessionState, dispatchSession, playerState, dispatchPlayer, cardState, dispatchCard, settingsState, dispatchSettings]);

  // Show loading screen while Firebase auth initializes
  // This prevents flash of login screen for already-authenticated users
  if (!authReady) {
    return <AuthLoadingScreen />;
  }

  // Login Screen
  if (currentView === SCREEN.LOGIN) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Login" onReturnToTable={returnToTable}>
          <LoginView scale={scale} />
        </ViewErrorBoundary>
      </>
    );
  }

  // Signup Screen
  if (currentView === SCREEN.SIGNUP) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Signup" onReturnToTable={returnToTable}>
          <SignupView scale={scale} />
        </ViewErrorBoundary>
      </>
    );
  }

  // Password Reset Screen
  if (currentView === SCREEN.PASSWORD_RESET) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Password Reset" onReturnToTable={returnToTable}>
          <PasswordResetView scale={scale} />
        </ViewErrorBoundary>
      </>
    );
  }

  // Showdown Screen
  if (isShowdownViewOpen) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Showdown" onReturnToTable={returnToTable}>
          <ShowdownView
            scale={scale}
            handleNextHandFromShowdown={handleNextHandFromShowdown}
            handleClearShowdownCards={handleClearShowdownCards}
            handleCloseShowdown={handleCloseShowdown}
            allCardsAssigned={allCardsAssigned}
            isSeatInactive={isSeatInactive}
            handleMuckSeat={handleMuckSeat}
            handleWonSeat={handleWonSeat}
            selectCardForShowdown={selectCardForShowdown}
            getOverlayStatus={getOverlayStatus}
            getActionColor={getActionColor}
            getActionDisplayName={getActionDisplayName}
            getHandAbbreviation={getHandAbbreviation}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // Card Selector Screen (renders when showCardSelector is true)
  if (showCardSelector) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Card Selector" onReturnToTable={returnToTable}>
          <CardSelectorView
            scale={scale}
            getCardStreet={getCardStreet}
            selectCard={selectCard}
            clearCards={clearCards}
            handleCloseCardSelector={handleCloseCardSelector}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // Table Screen (main poker table view)
  // Props reduced by using contexts (Game, UI, Session, Player, Card)
  if (currentView === SCREEN.TABLE) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Table" onReturnToTable={returnToTable}>
          <TableView
            // Layout (viewport-derived)
            scale={scale}
            tableRef={tableRef}
            SEAT_POSITIONS={SEAT_POSITIONS}
            numSeats={CONSTANTS.NUM_SEATS}
            // Handlers not in contexts (defined in parent)
            nextHand={nextHand}
            resetHand={resetHand}
            handleSeatRightClick={handleSeatRightClick}
            getSeatColor={getSeatColor}
            handleDealerDragStart={handleDealerDragStart}
            handleDealerDrag={handleDealerDrag}
            handleDealerDragEnd={handleDealerDragEnd}
            setCurrentStreet={setCurrentStreet}
            openShowdownScreen={openShowdownScreen}
            nextStreet={nextStreet}
            clearStreetActions={clearStreetActions}
            clearSeatActions={clearSeatActions}
            undoLastAction={undoLastAction}
            handleSetMySeat={handleSetMySeat}
            setDealerSeat={setDealerSeat}
            recordAction={recordAction}
            toggleAbsent={toggleAbsent}
            // Player persistence (from usePlayerPersistence, not PlayerContext)
            getRecentPlayers={getRecentPlayers}
            clearSeatAssignment={clearSeatAssignment}
            isPlayerAssigned={isPlayerAssigned}
            // Local UI state from parent
            setPendingSeatForPlayerAssignment={setPendingSeatForPlayerAssignment}
            setAutoOpenNewSession={setAutoOpenNewSession}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // History Screen
  if (currentView === SCREEN.HISTORY) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="History" onReturnToTable={returnToTable}>
          <HistoryView
          scale={scale}
          setCurrentScreen={setCurrentScreen}
          dispatchGame={dispatchGame}
          dispatchCard={dispatchCard}
          dispatchPlayer={dispatchPlayer}
          dispatchSession={dispatchSession}
          STREETS={STREETS}
          showError={showError}
          currentSessionId={sessionState.currentSession?.sessionId}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // Sessions Screen
  if (currentView === SCREEN.SESSIONS) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Sessions" onReturnToTable={returnToTable}>
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
          autoOpenNewSession={autoOpenNewSession}
          setAutoOpenNewSession={setAutoOpenNewSession}
          resetTableState={resetHand}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // Players Screen
  if (currentView === SCREEN.PLAYERS) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Players" onReturnToTable={returnToTable}>
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
          showError={showError}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // Settings Screen - uses SettingsContext for state
  if (currentView === SCREEN.SETTINGS) {
    return withContextProviders(
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Settings" onReturnToTable={returnToTable}>
          <SettingsView
            scale={scale}
            showSuccess={showSuccess}
            showError={showError}
            showWarning={showWarning}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // Stats Screen - uses contexts for state, only scale prop needed
  return withContextProviders(
    <>
      {toastOverlay}
      <ViewErrorBoundary viewName="Stats" onReturnToTable={returnToTable}>
        <StatsView scale={scale} />
      </ViewErrorBoundary>
    </>
  );
};

// Wrap the main component with ErrorBoundary for crash protection
const PokerTrackerWithErrorBoundary = () => (
  <ErrorBoundary>
    <PokerTrackerWireframes />
  </ErrorBoundary>
);

export default PokerTrackerWithErrorBoundary;
