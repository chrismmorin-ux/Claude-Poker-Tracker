/**
 * AppProviders.jsx - Context provider composition
 *
 * Wraps the app in all necessary context providers in the correct order.
 * Provider nesting order matters for dependency access:
 *   Auth → Game → UI → Session → Player → Card → Settings
 *
 * Extracted from PokerTracker.jsx to reduce main component complexity.
 */

import React from 'react';
import {
  GameProvider,
  UIProvider,
  SessionProvider,
  PlayerProvider,
  CardProvider,
  SettingsProvider,
  AuthProvider,
  ToastProvider,
  TendencyProvider,
  TournamentProvider,
  SyncBridgeProvider,
  OnlineSessionProvider,
  OnlineAnalysisProvider,
  TournamentBridgeProvider,
} from './contexts';

/**
 * AppProviders - Wraps children in all context providers
 *
 * @param {Object} props.children - Child components to wrap
 * @param {Object} props.authState - Auth state from authReducer
 * @param {Function} props.dispatchAuth - Auth dispatcher
 * @param {Object} props.gameState - Game state from gameReducer
 * @param {Function} props.dispatchGame - Game dispatcher
 * @param {Object} props.uiState - UI state from uiReducer
 * @param {Function} props.dispatchUi - UI dispatcher
 * @param {Object} props.sessionState - Session state from sessionReducer
 * @param {Function} props.dispatchSession - Session dispatcher
 * @param {Object} props.playerState - Player state from playerReducer
 * @param {Function} props.dispatchPlayer - Player dispatcher
 * @param {Object} props.cardState - Card state from cardReducer
 * @param {Function} props.dispatchCard - Card dispatcher
 * @param {Object} props.settingsState - Settings state from settingsReducer
 * @param {Function} props.dispatchSettings - Settings dispatcher
 */
export const AppProviders = ({
  children,
  authState,
  dispatchAuth,
  gameState,
  dispatchGame,
  blinds,
  uiState,
  dispatchUi,
  sessionState,
  dispatchSession,
  playerState,
  dispatchPlayer,
  cardState,
  dispatchCard,
  tournamentState,
  dispatchTournament,
  settingsState,
  dispatchSettings,
}) => (
  <ToastProvider>
    <AuthProvider authState={authState} dispatchAuth={dispatchAuth}>
      <GameProvider gameState={gameState} dispatchGame={dispatchGame} blinds={blinds}>
        <UIProvider uiState={uiState} dispatchUi={dispatchUi}>
          <SessionProvider sessionState={sessionState} dispatchSession={dispatchSession}>
            <TournamentProvider tournamentState={tournamentState} dispatchTournament={dispatchTournament}>
              <PlayerProvider playerState={playerState} dispatchPlayer={dispatchPlayer}>
                <TendencyProvider>
                  <SyncBridgeProvider>
                    <CardProvider cardState={cardState} dispatchCard={dispatchCard}>
                      <SettingsProvider settingsState={settingsState} dispatchSettings={dispatchSettings}>
                        <OnlineSessionProvider>
                          <OnlineAnalysisProvider>
                            <TournamentBridgeProvider>
                              {children}
                            </TournamentBridgeProvider>
                          </OnlineAnalysisProvider>
                        </OnlineSessionProvider>
                      </SettingsProvider>
                    </CardProvider>
                  </SyncBridgeProvider>
                </TendencyProvider>
              </PlayerProvider>
            </TournamentProvider>
          </SessionProvider>
        </UIProvider>
      </GameProvider>
    </AuthProvider>
  </ToastProvider>
);

export default AppProviders;
