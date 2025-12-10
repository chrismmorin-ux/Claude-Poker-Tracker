/**
 * ViewRouter.jsx - View routing and rendering
 *
 * Handles which view to display based on currentView state.
 * Wraps each view with ErrorBoundary and ToastContainer.
 *
 * Extracted from PokerTracker.jsx to reduce main component complexity.
 */

import React from 'react';
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
import { STREETS } from './constants/gameConstants';

// Screen/View identifiers (exported for use by other components)
export const SCREEN = {
  TABLE: 'table',
  STATS: 'stats',
  HISTORY: 'history',
  SESSIONS: 'sessions',
  PLAYERS: 'players',
  SETTINGS: 'settings',
  LOGIN: 'login',
  SIGNUP: 'signup',
  PASSWORD_RESET: 'password_reset',
};

/**
 * ViewRouter - Routes to the appropriate view based on app state
 *
 * @param {Object} props - All props needed by views
 */
export const ViewRouter = ({
  // App state
  currentView,
  isShowdownViewOpen,
  showCardSelector,
  authReady,

  // Layout
  scale,
  tableRef,
  SEAT_POSITIONS,
  numSeats,

  // Toast
  toasts,
  dismissToast,
  showError,
  showSuccess,
  showWarning,

  // Navigation
  returnToTable,
  setCurrentScreen,

  // Table view handlers
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
  getRecentPlayers,
  clearSeatAssignment,
  isPlayerAssigned,
  setPendingSeatForPlayerAssignment,
  setAutoOpenNewSession,

  // Showdown view handlers
  handleNextHandFromShowdown,
  handleClearShowdownCards,
  handleCloseShowdown,
  allCardsAssigned,
  isSeatInactive,
  handleMuckSeat,
  handleWonSeat,
  selectCardForShowdown,
  getOverlayStatus,
  getActionColor,
  getActionDisplayName,
  getHandAbbreviation,

  // Card selector handlers
  getCardStreet,
  selectCard,
  clearCards,
  handleCloseCardSelector,

  // History view
  dispatchGame,
  dispatchCard,
  dispatchPlayer,
  dispatchSession,
  currentSessionId,

  // Sessions view
  sessionState,
  startNewSession,
  endCurrentSession,
  updateSessionField,
  loadAllSessions,
  deleteSessionById,
  autoOpenNewSession,

  // Players view
  playerState,
  createNewPlayer,
  updatePlayerById,
  deletePlayerById,
  loadAllPlayers,
  assignPlayerToSeat,
  getSeatPlayerName,
  getPlayerSeat,
  clearAllSeatAssignments,
  pendingSeatForPlayerAssignment,
}) => {
  // Toast overlay (rendered with every view)
  const toastOverlay = <ToastContainer toasts={toasts} onDismiss={dismissToast} />;

  // Show loading screen while Firebase auth initializes
  if (!authReady) {
    return <AuthLoadingScreen />;
  }

  // Login Screen
  if (currentView === SCREEN.LOGIN) {
    return (
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
    return (
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
    return (
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
    return (
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

  // Card Selector Screen
  if (showCardSelector) {
    return (
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
  if (currentView === SCREEN.TABLE) {
    return (
      <>
        {toastOverlay}
        <ViewErrorBoundary viewName="Table" onReturnToTable={returnToTable}>
          <TableView
            scale={scale}
            tableRef={tableRef}
            SEAT_POSITIONS={SEAT_POSITIONS}
            numSeats={numSeats}
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
            getRecentPlayers={getRecentPlayers}
            clearSeatAssignment={clearSeatAssignment}
            isPlayerAssigned={isPlayerAssigned}
            setPendingSeatForPlayerAssignment={setPendingSeatForPlayerAssignment}
            setAutoOpenNewSession={setAutoOpenNewSession}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // History Screen
  if (currentView === SCREEN.HISTORY) {
    return (
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
            currentSessionId={currentSessionId}
          />
        </ViewErrorBoundary>
      </>
    );
  }

  // Sessions Screen
  if (currentView === SCREEN.SESSIONS) {
    return (
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
    return (
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

  // Settings Screen
  if (currentView === SCREEN.SETTINGS) {
    return (
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

  // Stats Screen (default)
  return (
    <>
      {toastOverlay}
      <ViewErrorBoundary viewName="Stats" onReturnToTable={returnToTable}>
        <StatsView scale={scale} />
      </ViewErrorBoundary>
    </>
  );
};

export default ViewRouter;
