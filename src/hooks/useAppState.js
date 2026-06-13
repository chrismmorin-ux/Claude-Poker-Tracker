/**
 * useAppState.js - Consolidated app state initialization
 *
 * Combines all reducer initialization and persistence hooks into a single hook.
 * Reduces PokerTracker.jsx complexity by centralizing state management setup.
 *
 * Returns all state, dispatchers, and persistence functions needed by the app.
 */

import { useReducer, useRef } from 'react';
import { gameReducer, initialGameState } from '../reducers/gameReducer';
import { uiReducer, initialUiState } from '../reducers/uiReducer';
import { cardReducer, initialCardState } from '../reducers/cardReducer';
import { sessionReducer, initialSessionState } from '../reducers/sessionReducer';
import { playerReducer, initialPlayerState } from '../reducers/playerReducer';
import { settingsReducer, initialSettingsState } from '../reducers/settingsReducer';
import { authReducer, initialAuthState } from '../reducers/authReducer';
import { tournamentReducer, initialTournamentState } from '../reducers/tournamentReducer';
// MPMF G5-B1 (2026-04-25) — entitlement reducer.
import { entitlementReducer, initialEntitlementState } from '../reducers/entitlementReducer';
// PRF Phase 5 (2026-04-26, PRF-G5-HK) — printable refresher reducer.
import { refresherReducer, initialRefresherState } from '../reducers/refresherReducer';
// EAL Phase 6 Stream D B3 (2026-04-27, S14) — exploit anchor library reducer.
import { anchorLibraryReducer, initialAnchorLibraryState } from '../reducers/anchorLibraryReducer';
// SLS Stream D (2026-05-14, SPR-081 / WS-040) — shape language mastery reducer.
import { shapeMasteryReducer, initialShapeMasteryState } from '../reducers/shapeMasteryReducer';
import { usePersistence } from './usePersistence';
import { useSettingsPersistence } from './useSettingsPersistence';
import { useAuthPersistence } from './useAuthPersistence';
// EAL WS-222 (2026-06-12) — settings → anchor-library enrollment sync.
import { useAnchorEnrollmentBridge } from './useAnchorEnrollmentBridge';


/**
 * useAppState - Initialize all reducers and persistence hooks
 *
 * @returns {Object} All state, dispatchers, persistence functions, and ready flags
 */
export const useAppState = () => {
  // =========================================================================
  // REDUCERS - All app state managed by reducers
  // =========================================================================

  const [gameState, dispatchGame] = useReducer(gameReducer, initialGameState);
  const [uiState, dispatchUi] = useReducer(uiReducer, initialUiState);
  const [cardState, dispatchCard] = useReducer(cardReducer, initialCardState);
  const [sessionState, dispatchSession] = useReducer(sessionReducer, initialSessionState);
  const [playerState, dispatchPlayer] = useReducer(playerReducer, initialPlayerState);
  const [settingsState, dispatchSettings] = useReducer(settingsReducer, initialSettingsState);
  const [authState, dispatchAuth] = useReducer(authReducer, initialAuthState);
  const [tournamentState, dispatchTournament] = useReducer(tournamentReducer, initialTournamentState);
  // MPMF G5-B1 — entitlement state. Hydration happens inside EntitlementProvider
  // via useEntitlementPersistence (mirrors PlayerProvider pattern).
  const [entitlementState, dispatchEntitlement] = useReducer(entitlementReducer, initialEntitlementState);
  // PRF Phase 5 (PRF-G5-HK) — printable refresher state. Hydration happens
  // inside RefresherProvider via useRefresherPersistence (hydrate-only;
  // writers.js owns IDB writes).
  const [refresherState, dispatchRefresher] = useReducer(refresherReducer, initialRefresherState);
  // EAL Phase 6 Stream D B3 (S14) — exploit anchor library state. Hydration
  // happens inside AnchorLibraryProvider via useAnchorLibraryPersistence —
  // parallel `Promise.all` over 4 wrapper getAlls + 400ms debounced
  // per-slice diff-write (mirrors EntitlementProvider pattern).
  const [anchorLibraryState, dispatchAnchorLibrary] = useReducer(anchorLibraryReducer, initialAnchorLibraryState);
  // SLS Stream D (SPR-081 / WS-040) — shape language mastery state. Hydration
  // happens inside ShapeMasteryProvider via useShapeMasteryPersistence —
  // single-record load + 400ms debounce singleton write (mirrors
  // useTelemetryConsentPersistence pattern).
  const [shapeMasteryState, dispatchShapeMastery] = useReducer(shapeMasteryReducer, initialShapeMasteryState);

  // =========================================================================
  // PERSISTENCE - Auto-save/restore for all state types
  // =========================================================================

  // Auth persistence (Firebase auth state listener)
  useAuthPersistence(dispatchAuth);

  // PMC Phase 5a-2 (WS-178 / SPR-070) — engine-context bridge ref.
  // Populated by <EngineCtxBridge/> inside <TendencyProvider/>; read by
  // usePersistence at hand-save time to query rangeProfiles + evaluateGameTree
  // for predictionAudit.predictedDistribution. Null until bridge mounts;
  // reconstruct falls back to Phase 5a behavior (empty array) until then.
  const engineCtxGetterRef = useRef(null);

  // Hand persistence (auto-save + auto-restore)
  usePersistence(
    gameState,
    cardState,
    playerState,
    dispatchGame,
    dispatchCard,
    dispatchPlayer,
    undefined,
    engineCtxGetterRef,
  );

  // Settings persistence
  useSettingsPersistence(settingsState, dispatchSettings);

  // EAL WS-222 — mirror persisted enrollment (settings store, source of
  // truth) into anchorLibraryReducer (runtime read model). Reconciling:
  // self-heals after ANCHOR_LIBRARY_HYDRATED resets enrollment to default.
  useAnchorEnrollmentBridge(settingsState, anchorLibraryState, dispatchAnchorLibrary);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    // State
    gameState,
    uiState,
    cardState,
    sessionState,
    playerState,
    settingsState,
    authState,
    tournamentState,
    entitlementState,
    refresherState,
    anchorLibraryState,
    shapeMasteryState,

    // Dispatchers
    dispatchGame,
    dispatchUi,
    dispatchCard,
    dispatchSession,
    dispatchPlayer,
    dispatchSettings,
    dispatchAuth,
    dispatchTournament,
    dispatchEntitlement,
    dispatchRefresher,
    dispatchAnchorLibrary,
    dispatchShapeMastery,

    // Engine-context bridge ref (PMC Phase 5a-2)
    engineCtxGetterRef,
  };
};
