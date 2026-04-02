import React, { useMemo, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useScale } from './hooks/useScale';
import { useAppState } from './hooks/useAppState';
import { AppProviders } from './AppProviders';
import { parseBlinds } from './utils/potCalculator';
import { useUI, useAuth, useTournament } from './contexts';
import { SCREEN } from './constants/uiConstants';
import { useBackButton } from './hooks/useBackButton';
// View components
import { StatsView } from './components/views/StatsView';
import { TableView } from './components/views/TableView';
import { ShowdownView } from './components/views/ShowdownView';

import { SessionsView } from './components/views/SessionsView';
import { PlayersView } from './components/views/PlayersView';
import { SettingsView } from './components/views/SettingsView';
import { AnalysisView } from './components/views/AnalysisView';
import { HandReplayView } from './components/views/HandReplayView';
import { LoginView } from './components/views/LoginView';
import { SignupView } from './components/views/SignupView';
import { PasswordResetView } from './components/views/PasswordResetView';
import { AuthLoadingScreen } from './components/ui/AuthLoadingScreen';
import { ViewErrorBoundary } from './components/ui/ViewErrorBoundary';
import { TournamentView } from './components/views/TournamentView';
import { OnlineView } from './components/views/OnlineView';
import { ExtensionPanel } from './components/views/OnlineView/ExtensionPanel';

// =============================================================================
// ROUTER — Pure view selection based on UI state
// =============================================================================

const VEB = ({ viewName, onReturnToTable, children }) => (
  <ViewErrorBoundary viewName={viewName} onReturnToTable={onReturnToTable}>
    {children}
  </ViewErrorBoundary>
);

// Map URL hash to SCREEN constant for deep-linking (e.g., #online)
const HASH_TO_SCREEN = {
  '#online': 'online',
  '#extension': 'extension',
  '#sessions': 'sessions',
  '#players': 'players',
  '#settings': 'settings',
};

const ViewRouter = () => {
  const scale = useScale();
  const { currentView, isShowdownViewOpen, setCurrentScreen } = useUI();
  const { isInitialized } = useAuth();
  useBackButton();

  // Deep-link support: navigate to view from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    const screen = HASH_TO_SCREEN[hash];
    if (screen) {
      setCurrentScreen(screen);
      // Clear hash so refreshes don't re-navigate
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [setCurrentScreen]);

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
    case SCREEN.HISTORY: return <VEB viewName="History" onReturnToTable={onReturnToTable}><AnalysisView scale={scale} initialTab="review" /></VEB>;
    case SCREEN.SESSIONS: return <VEB viewName="Sessions" onReturnToTable={onReturnToTable}><SessionsView scale={scale} /></VEB>;
    case SCREEN.PLAYERS: return <VEB viewName="Players" onReturnToTable={onReturnToTable}><PlayersView scale={scale} /></VEB>;
    case SCREEN.SETTINGS: return <VEB viewName="Settings" onReturnToTable={onReturnToTable}><SettingsView scale={scale} /></VEB>;
    case SCREEN.ANALYSIS: return <VEB viewName="Analysis" onReturnToTable={onReturnToTable}><AnalysisView scale={scale} /></VEB>;
    case SCREEN.HAND_REPLAY: return <VEB viewName="Hand Replay" onReturnToTable={onReturnToTable}><HandReplayView scale={scale} /></VEB>;
    case SCREEN.TOURNAMENT: return <VEB viewName="Tournament" onReturnToTable={onReturnToTable}><TournamentView scale={scale} /></VEB>;
    case SCREEN.ONLINE: return <VEB viewName="Online" onReturnToTable={onReturnToTable}><OnlineView scale={scale} /></VEB>;
    case SCREEN.EXTENSION: return <VEB viewName="Extension" onReturnToTable={onReturnToTable}><ExtensionPanel /></VEB>;
    case SCREEN.STATS: return <VEB viewName="Stats" onReturnToTable={onReturnToTable}><StatsView scale={scale} /></VEB>;
    default: return <VEB viewName="Stats" onReturnToTable={onReturnToTable}><StatsView scale={scale} /></VEB>;
  }
};

// =============================================================================
// APP ROOT — Initializes state and wraps with providers
// =============================================================================

const AppRoot = () => {
  const {
    gameState, uiState, cardState, sessionState, playerState, settingsState, authState, tournamentState,
    dispatchGame, dispatchUi, dispatchCard, dispatchSession, dispatchPlayer, dispatchSettings, dispatchAuth, dispatchTournament,
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
      tournamentState={tournamentState} dispatchTournament={dispatchTournament}
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
