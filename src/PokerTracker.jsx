import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useScale } from './hooks/useScale';
import { useAppState } from './hooks/useAppState';
import { AppProviders } from './AppProviders';
import { useUI, useAuth } from './contexts';
import { SCREEN } from './reducers/uiReducer';
// View components
import { StatsView } from './components/views/StatsView';
import { CardSelectorView } from './components/views/CardSelectorView';
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

const ViewRouter = () => {
  const scale = useScale();
  const { currentView, showCardSelector, isShowdownViewOpen, setCurrentScreen } = useUI();
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return <AuthLoadingScreen />;
  }

  const VEB = ({ viewName, children }) => (
    <ViewErrorBoundary viewName={viewName} onReturnToTable={() => setCurrentScreen(SCREEN.TABLE)}>
      {children}
    </ViewErrorBoundary>
  );

  // Auth screens
  if (currentView === SCREEN.LOGIN) return <VEB viewName="Login"><LoginView scale={scale} /></VEB>;
  if (currentView === SCREEN.SIGNUP) return <VEB viewName="Signup"><SignupView scale={scale} /></VEB>;
  if (currentView === SCREEN.PASSWORD_RESET) return <VEB viewName="Password Reset"><PasswordResetView scale={scale} /></VEB>;

  // Overlay screens
  if (isShowdownViewOpen) return <VEB viewName="Showdown"><ShowdownView scale={scale} /></VEB>;
  if (showCardSelector) return <VEB viewName="Card Selector"><CardSelectorView scale={scale} /></VEB>;

  // Main views — all with scale only
  switch (currentView) {
    case SCREEN.TABLE: return <VEB viewName="Table"><TableView scale={scale} /></VEB>;
    case SCREEN.HISTORY: return <VEB viewName="History"><HistoryView scale={scale} /></VEB>;
    case SCREEN.SESSIONS: return <VEB viewName="Sessions"><SessionsView scale={scale} /></VEB>;
    case SCREEN.PLAYERS: return <VEB viewName="Players"><PlayersView scale={scale} /></VEB>;
    case SCREEN.SETTINGS: return <VEB viewName="Settings"><SettingsView scale={scale} /></VEB>;
    case SCREEN.ANALYSIS: return <VEB viewName="Analysis"><AnalysisView scale={scale} /></VEB>;
    default: return <VEB viewName="Stats"><StatsView scale={scale} /></VEB>;
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

  return (
    <AppProviders
      authState={authState} dispatchAuth={dispatchAuth}
      gameState={gameState} dispatchGame={dispatchGame}
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
