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
import { usePersistence } from './usePersistence';
import { useSessionPersistence } from './useSessionPersistence';
import { usePlayerPersistence } from './usePlayerPersistence';
import { useSettingsPersistence } from './useSettingsPersistence';
import { useAuthPersistence } from './useAuthPersistence';
import { useToast } from './useToast';

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

  // =========================================================================
  // PERSISTENCE - Auto-save/restore for all state types
  // =========================================================================

  // Auth persistence (Firebase auth state listener)
  const { isReady: authReady } = useAuthPersistence(dispatchAuth);

  // Hand persistence (auto-save + auto-restore)
  const { isReady: handReady } = usePersistence(
    gameState,
    cardState,
    playerState,
    dispatchGame,
    dispatchCard,
    dispatchSession,
    dispatchPlayer
  );

  // Session persistence
  const {
    isReady: sessionReady,
    startNewSession,
    endCurrentSession,
    updateSessionField,
    loadAllSessions,
    deleteSessionById
  } = useSessionPersistence(sessionState, dispatchSession);

  // Player persistence
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

  // Settings persistence
  const {
    isReady: settingsReady,
    resetToDefaults: resetSettingsToDefaults
  } = useSettingsPersistence(settingsState, dispatchSettings);

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================

  const { toasts, dismissToast, showError, showSuccess, showWarning, showInfo } = useToast();

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

    // Dispatchers
    dispatchGame,
    dispatchUi,
    dispatchCard,
    dispatchSession,
    dispatchPlayer,
    dispatchSettings,
    dispatchAuth,

    // Ready flags
    isReady: {
      auth: authReady,
      hand: handReady,
      session: sessionReady,
      player: playerReady,
      settings: settingsReady,
      all: authReady && handReady && sessionReady && playerReady && settingsReady
    },

    // Session persistence functions
    sessionPersistence: {
      startNewSession,
      endCurrentSession,
      updateSessionField,
      loadAllSessions,
      deleteSessionById
    },

    // Player persistence functions
    playerPersistence: {
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
    },

    // Settings persistence functions
    settingsPersistence: {
      resetSettingsToDefaults
    },

    // Toast functions
    toast: {
      toasts,
      dismissToast,
      showError,
      showSuccess,
      showWarning,
      showInfo
    }
  };
};

export default useAppState;
