import React, { useMemo } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useScale } from './hooks/useScale';
import { useAppState } from './hooks/useAppState';
import { AppProviders } from './AppProviders';
import { parseBlinds } from './utils/potCalculator';
import { useUI, useAuth } from './contexts';
import { SCREEN } from './constants/uiConstants';
// View components
import { StatsView } from './components/views/StatsView';
import { TableView } from './components/views/TableView';
import { ShowdownView } from './components/views/ShowdownView';
import { HistoryView } from './components/views/HistoryView';
import { SessionsView } from './components/views/SessionsView';
import { PlayersView } from './components/views/PlayersView';
import { SettingsView } from './components/views/SettingsView';
import { AnalysisView } from './components/views/AnalysisView';
import { LoginView } from './components/views/LoginView';
import { SignupView } from './components/views/SignupView';
import { PasswordResetView } from './components/views/PasswordResetView';
import { AuthLoadingScreen } from './components/ui/AuthLoadingScreen';
import { ViewErrorBoundary } from './components/ui/ViewErrorBoundary';

// =============================================================================
// ROUTER — Pure view selection based on UI state
// =============================================================================

const VEB = ({ viewName, onReturnToTable, children }) => (
  <ViewErrorBoundary viewName={viewName} onReturnToTable={onReturnToTable}>
    {children}
  </ViewErrorBoundary>
);

const ViewRouter = () => {
  const scale = useScale();
  const { currentView, isShowdownViewOpen, setCurrentScreen } = useUI();
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return <AuthLoadingScreen />;
  }

  const onReturnToTable = () => setCurrentScreen(SCREEN.TABLE);

  // Auth screens
  if (currentView === SCREEN.LOGIN) return <VEB viewName="Login" onReturnToTable={onReturnToTable}><LoginView scale={scale} /></VEB>;
  if (currentView === SCREEN.SIGNUP) return <VEB viewName="Signup" onReturnToTable={onReturnToTable}><SignupView scale={scale} /></VEB>;
  if (currentView === SCREEN.PASSWORD_RESET) return <VEB viewName="Password Reset" onReturnToTable={onReturnToTable}><PasswordResetView scale={scale} /></VEB>;

  // Overlay screens (card selector is now inline on TableView)
  if (isShowdownViewOpen) return <VEB viewName="Showdown" onReturnToTable={onReturnToTable}><ShowdownView scale={scale} /></VEB>;

  // Main views — all with scale only
  switch (currentView) {
    case SCREEN.TABLE: return <VEB viewName="Table" onReturnToTable={onReturnToTable}><TableView scale={scale} /></VEB>;
    case SCREEN.HISTORY: return <VEB viewName="History" onReturnToTable={onReturnToTable}><HistoryView scale={scale} /></VEB>;
    case SCREEN.SESSIONS: return <VEB viewName="Sessions" onReturnToTable={onReturnToTable}><SessionsView scale={scale} /></VEB>;
    case SCREEN.PLAYERS: return <VEB viewName="Players" onReturnToTable={onReturnToTable}><PlayersView scale={scale} /></VEB>;
    case SCREEN.SETTINGS: return <VEB viewName="Settings" onReturnToTable={onReturnToTable}><SettingsView scale={scale} /></VEB>;
    case SCREEN.ANALYSIS: return <VEB viewName="Analysis" onReturnToTable={onReturnToTable}><AnalysisView scale={scale} /></VEB>;
    default: return <VEB viewName="Stats" onReturnToTable={onReturnToTable}><StatsView scale={scale} /></VEB>;
  }
};

// =============================================================================
// APP ROOT — Initializes state and wraps with providers
// =============================================================================

const AppRoot = () => {
  const {
    gameState, uiState, cardState, sessionState, playerState, settingsState, authState,
    dispatchGame, dispatchUi, dispatchCard, dispatchSession, dispatchPlayer, dispatchSettings, dispatchAuth,
  } = useAppState();

  const blinds = useMemo(
    () => parseBlinds(sessionState.currentSession?.gameType),
    [sessionState.currentSession?.gameType]
  );

  return (
    <AppProviders
      authState={authState} dispatchAuth={dispatchAuth}
      gameState={gameState} dispatchGame={dispatchGame}
      blinds={blinds}
      uiState={uiState} dispatchUi={dispatchUi}
      sessionState={sessionState} dispatchSession={dispatchSession}
      playerState={playerState} dispatchPlayer={dispatchPlayer}
      cardState={cardState} dispatchCard={dispatchCard}
      settingsState={settingsState} dispatchSettings={dispatchSettings}
    >
      <ViewRouter />
    </AppProviders>
  );
};

const PokerTrackerWithErrorBoundary = () => (
  <ErrorBoundary>
    <AppRoot />
  </ErrorBoundary>
);

export default PokerTrackerWithErrorBoundary;
