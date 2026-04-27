/**
 * useAppState.js - Consolidated app state initialization
 *
 * Combines all reducer initialization and persistence hooks into a single hook.
 * Reduces PokerTracker.jsx complexity by centralizing state management setup.
 *
 * Returns all state, dispatchers, and persistence functions needed by the app.
 */

import { useReducer } from 'react';
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
import { usePersistence } from './usePersistence';
import { useSettingsPersistence } from './useSettingsPersistence';
import { useAuthPersistence } from './useAuthPersistence';


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

  // =========================================================================
  // PERSISTENCE - Auto-save/restore for all state types
  // =========================================================================

  // Auth persistence (Firebase auth state listener)
  useAuthPersistence(dispatchAuth);

  // Hand persistence (auto-save + auto-restore)
  usePersistence(
    gameState,
    cardState,
    playerState,
    dispatchGame,
    dispatchCard,
    dispatchPlayer
  );

  // Settings persistence
  useSettingsPersistence(settingsState, dispatchSettings);

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

  };
};
