import React, { useMemo, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useScale } from './hooks/useScale';
import { useAppState } from './hooks/useAppState';
import { AppProviders } from './AppProviders';
import { parseBlinds } from './utils/potCalculator';
import { useUI, useAuth, useTournament } from './contexts';
import { SCREEN } from './constants/uiConstants';
import { useBackButton } from './hooks/useBackButton';
// Hot-path views — always in main bundle
import { TableView } from './components/views/TableView';
import { ShowdownView } from './components/views/ShowdownView';
import { AuthLoadingScreen } from './components/ui/AuthLoadingScreen';
import { ViewErrorBoundary } from './components/ui/ViewErrorBoundary';
import { UpdateBanner } from './components/ui/UpdateBanner';
// Lazy-loaded views (RT-23: route-level code splitting)
const StatsView = lazy(() => import('./components/views/StatsView').then(m => ({ default: m.StatsView })));
const SessionsView = lazy(() => import('./components/views/SessionsView').then(m => ({ default: m.SessionsView })));
const PlayersView = lazy(() => import('./components/views/PlayersView').then(m => ({ default: m.PlayersView })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then(m => ({ default: m.SettingsView })));
const AnalysisView = lazy(() => import('./components/views/AnalysisView').then(m => ({ default: m.AnalysisView })));
const HandReplayView = lazy(() => import('./components/views/HandReplayView').then(m => ({ default: m.HandReplayView })));
const LoginView = lazy(() => import('./components/views/LoginView').then(m => ({ default: m.LoginView })));
const SignupView = lazy(() => import('./components/views/SignupView').then(m => ({ default: m.SignupView })));
const PasswordResetView = lazy(() => import('./components/views/PasswordResetView').then(m => ({ default: m.PasswordResetView })));
const TournamentView = lazy(() => import('./components/views/TournamentView').then(m => ({ default: m.TournamentView })));
const OnlineView = lazy(() => import('./components/views/OnlineView').then(m => ({ default: m.OnlineView })));
const ExtensionPanel = lazy(() => import('./components/views/OnlineView/ExtensionPanel').then(m => ({ default: m.ExtensionPanel })));
const PlayerEditorView = lazy(() => import('./components/views/PlayerEditorView/PlayerEditorView').then(m => ({ default: m.PlayerEditorView })));
const PlayerPickerView = lazy(() => import('./components/views/PlayerPickerView/PlayerPickerView').then(m => ({ default: m.PlayerPickerView })));
const PreflopDrillsView = lazy(() => import('./components/views/PreflopDrillsView/PreflopDrillsView').then(m => ({ default: m.PreflopDrillsView })));
const PostflopDrillsView = lazy(() => import('./components/views/PostflopDrillsView/PostflopDrillsView').then(m => ({ default: m.PostflopDrillsView })));

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

  // Showdown overlay — eagerly loaded, no Suspense needed
  if (isShowdownViewOpen) return <VEB viewName="Showdown" onReturnToTable={onReturnToTable}><ShowdownView scale={scale} /></VEB>;

  // Table view — eagerly loaded hot path
  if (currentView === SCREEN.TABLE) return <VEB viewName="Table" onReturnToTable={onReturnToTable}><TableView scale={scale} /></VEB>;

  // All other views are lazy-loaded (RT-23)
  return (
    <Suspense fallback={
      <div className="h-dvh bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      {(() => {
        // Auth screens
        if (currentView === SCREEN.LOGIN) return <VEB viewName="Login" onReturnToTable={onReturnToTable}><LoginView scale={scale} /></VEB>;
        if (currentView === SCREEN.SIGNUP) return <VEB viewName="Signup" onReturnToTable={onReturnToTable}><SignupView scale={scale} /></VEB>;
        if (currentView === SCREEN.PASSWORD_RESET) return <VEB viewName="Password Reset" onReturnToTable={onReturnToTable}><PasswordResetView scale={scale} /></VEB>;

        // Main views
        switch (currentView) {
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
          case SCREEN.PLAYER_EDITOR: return <VEB viewName="Player Editor" onReturnToTable={onReturnToTable}><PlayerEditorView scale={scale} /></VEB>;
          case SCREEN.PLAYER_PICKER: return <VEB viewName="Player Picker" onReturnToTable={onReturnToTable}><PlayerPickerView scale={scale} /></VEB>;
          case SCREEN.PREFLOP_DRILLS: return <VEB viewName="Preflop Drills" onReturnToTable={onReturnToTable}><PreflopDrillsView scale={scale} /></VEB>;
          case SCREEN.POSTFLOP_DRILLS: return <VEB viewName="Postflop Drills" onReturnToTable={onReturnToTable}><PostflopDrillsView scale={scale} /></VEB>;
          default: return <VEB viewName="Stats" onReturnToTable={onReturnToTable}><StatsView scale={scale} /></VEB>;
        }
      })()}
    </Suspense>
  );
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
      <UpdateBanner />
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
