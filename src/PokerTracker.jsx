import React, { useMemo, useEffect, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useScale } from './hooks/useScale';
import { useScreenOrientationLock } from './hooks/useScreenOrientationLock';
import { useAppState } from './hooks/useAppState';
import { AppProviders } from './AppProviders';
import { parseBlinds } from './utils/potCalculator';
import { useUI, useAuth, useSession } from './contexts';
import { SCREEN } from './constants/uiConstants';
import { useBackButton } from './hooks/useBackButton';
// Single source of truth for routable views (router/orientation/hash all derive from it).
import { VIEW_REGISTRY, renderView, VIEW_TO_ORIENTATION, HASH_TO_SCREEN } from './constants/viewRegistry';
// Showdown is an overlay toggled by isShowdownViewOpen (not currentView), so it
// stays out of the registry and is eager-imported here.
import { ShowdownView } from './components/views/ShowdownView';
import { AuthLoadingScreen } from './components/ui/AuthLoadingScreen';
import { ViewErrorBoundary } from './components/ui/ViewErrorBoundary';
import { UpdateBanner } from './components/ui/UpdateBanner';
import { HealthIndicator } from './components/ui/HealthIndicator';
import { NavShell } from './components/ui/NavShell';
// VCE (WS-181, 2026-05-11) — viewport-anchored PTT overlay; gated by
// settings.voiceCardEntry.enabled (default OFF). Renders only on TableView
// with empty board slots. ShowdownView per-villain wiring deferred.
import VoiceCardEntryOverlay from './components/ui/VoiceCardEntryOverlay';
import { RotateDeviceHint } from './components/ui/RotateDeviceHint';

// =============================================================================
// ROUTER — Pure view selection based on UI state, driven by VIEW_REGISTRY
// =============================================================================

const VEB = ({ viewName, onReturnToTable, children }) => (
  <ViewErrorBoundary viewName={viewName} onReturnToTable={onReturnToTable}>
    {children}
  </ViewErrorBoundary>
);

// Orientation policy derives from the registry (per-view 'portrait'/'landscape').
// Showdown forces landscape; anything not flagged defaults to 'landscape' (the
// app's 1600×720 ScaledContainer design). The PWA manifest is `orientation: 'any'`
// so this hook is the single place orientation is asserted at runtime.
const orientationFor = (currentView, isShowdownOpen) => {
  if (isShowdownOpen) return 'landscape';
  return VIEW_TO_ORIENTATION[currentView] ?? 'landscape';
};

const ViewRouter = () => {
  const scale = useScale();
  const { currentView, isShowdownViewOpen, setCurrentScreen } = useUI();
  const { isInitialized } = useAuth();
  const { hasActiveSession } = useSession();
  useBackButton();
  useScreenOrientationLock(orientationFor(currentView, isShowdownViewOpen));

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

  // Error-boundary "return" target: the live table if a session is in progress,
  // otherwise Homebase (the default entry). Was hardwired to TABLE before Homebase.
  const onReturnToTable = () => setCurrentScreen(hasActiveSession ? SCREEN.TABLE : SCREEN.HOMEBASE);

  // Showdown overlay — eager, not registry-routed (toggled by isShowdownViewOpen).
  if (isShowdownViewOpen) {
    return <VEB viewName="Showdown" onReturnToTable={onReturnToTable}><ShowdownView scale={scale} /></VEB>;
  }

  const entry = VIEW_REGISTRY[currentView];

  // Eager hot-path views (Homebase, Table) render without a Suspense spinner.
  if (entry?.eager) {
    return <VEB viewName={entry.name} onReturnToTable={onReturnToTable}>{renderView(currentView, scale)}</VEB>;
  }

  // Unknown SCREEN value — observable fallback to Stats (INV-15 / RT-102). A
  // registry-driven router makes "renders nothing" impossible: a SCREEN with no
  // entry lands here instead of silently blanking.
  const resolved = entry ? currentView : SCREEN.STATS;
  if (!entry && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[ViewRouter] unknown currentView='${currentView}', falling back to Stats`);
  }
  const viewName = VIEW_REGISTRY[resolved]?.name || 'Stats';

  // All other views are lazy-loaded (RT-23: route-level code splitting).
  return (
    <Suspense fallback={
      <div className="h-dvh bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <VEB viewName={viewName} onReturnToTable={onReturnToTable}>{renderView(resolved, scale)}</VEB>
    </Suspense>
  );
};

// =============================================================================
// APP ROOT — Initializes state and wraps with providers
// =============================================================================

const AppRoot = () => {
  const {
    gameState, uiState, cardState, sessionState, playerState, settingsState, authState, tournamentState, entitlementState, refresherState, anchorLibraryState, shapeMasteryState,
    dispatchGame, dispatchUi, dispatchCard, dispatchSession, dispatchPlayer, dispatchSettings, dispatchAuth, dispatchTournament, dispatchEntitlement, dispatchRefresher, dispatchAnchorLibrary, dispatchShapeMastery,
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
      entitlementState={entitlementState} dispatchEntitlement={dispatchEntitlement}
      refresherState={refresherState} dispatchRefresher={dispatchRefresher}
      anchorLibraryState={anchorLibraryState} dispatchAnchorLibrary={dispatchAnchorLibrary}
      shapeMasteryState={shapeMasteryState} dispatchShapeMastery={dispatchShapeMastery}
    >
      <UpdateBanner />
      <ViewRouter />
      <RotateDeviceHint />
      <VoiceCardEntryOverlay />
      <NavShell />
      <HealthIndicator />
    </AppProviders>
  );
};

const PokerTrackerWithErrorBoundary = () => (
  <ErrorBoundary>
    <AppRoot />
  </ErrorBoundary>
);

export default PokerTrackerWithErrorBoundary;
