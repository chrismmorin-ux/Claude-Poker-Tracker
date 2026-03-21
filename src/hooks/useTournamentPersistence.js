/**
 * useTournamentPersistence.js - Tournament state persistence hook
 *
 * Hydrates from IndexedDB on mount, debounced auto-save on changes.
 * Same pattern as useSessionPersistence.
 */

import { useEffect, useRef } from 'react';
import {
  createTournament,
  getTournamentBySessionId,
  updateTournament,
} from '../utils/persistence/tournamentsStorage';
import { TOURNAMENT_ACTIONS } from '../constants/tournamentConstants';
import { createPersistenceLogger } from '../utils/persistence/index';

const DEBOUNCE_DELAY = 1500;
const { log, logError } = createPersistenceLogger('useTournamentPersistence');

/**
 * @param {Object} tournamentState - Tournament state from reducer
 * @param {Function} dispatchTournament - Tournament dispatcher
 * @param {number|null} sessionId - Current session ID (for linking)
 * @param {boolean} isTournamentSession - Whether current session is a tournament
 */
export const useTournamentPersistence = (
  tournamentState,
  dispatchTournament,
  sessionId,
  isTournamentSession
) => {
  const saveTimerRef = useRef(null);
  const tournamentIdRef = useRef(null);
  const isHydratedRef = useRef(false);

  // Hydrate on mount if active tournament session
  useEffect(() => {
    if (!sessionId || !isTournamentSession || isHydratedRef.current) return;

    const hydrate = async () => {
      try {
        const record = await getTournamentBySessionId(sessionId);
        if (record && record.isActive) {
          tournamentIdRef.current = record.tournamentId;
          dispatchTournament({
            type: TOURNAMENT_ACTIONS.HYDRATE_TOURNAMENT,
            payload: {
              config: record.config,
              currentLevelIndex: record.currentLevelIndex,
              levelStartTime: record.levelStartTime,
              isPaused: record.isPaused,
              pauseStartTime: record.pauseStartTime,
              totalPausedMs: record.totalPausedMs,
              chipStacks: record.chipStacks,
              playersRemaining: record.playersRemaining,
              eliminations: record.eliminations,
              isActive: true,
            },
          });
          log(`Hydrated tournament ${record.tournamentId} for session ${sessionId}`);
        }
      } catch (error) {
        logError(error);
      }
      isHydratedRef.current = true;
    };

    hydrate();
  }, [sessionId, isTournamentSession, dispatchTournament]);

  // Debounced auto-save on state changes
  useEffect(() => {
    if (!tournamentState.isActive || !tournamentIdRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateTournament(tournamentIdRef.current, {
          config: tournamentState.config,
          currentLevelIndex: tournamentState.currentLevelIndex,
          levelStartTime: tournamentState.levelStartTime,
          isPaused: tournamentState.isPaused,
          pauseStartTime: tournamentState.pauseStartTime,
          totalPausedMs: tournamentState.totalPausedMs,
          chipStacks: tournamentState.chipStacks,
          playersRemaining: tournamentState.playersRemaining,
          eliminations: tournamentState.eliminations,
          isActive: tournamentState.isActive,
        });
        log('Tournament state auto-saved');
      } catch (error) {
        logError(error);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tournamentState]);

  /**
   * Create a new tournament in IndexedDB
   * Called when tournament is initialized via SessionForm
   */
  const createNewTournament = async (config, sid) => {
    try {
      const tournamentId = await createTournament(config, sid);
      tournamentIdRef.current = tournamentId;
      log(`Created tournament ${tournamentId} for session ${sid}`);
      return tournamentId;
    } catch (error) {
      logError(error);
      throw error;
    }
  };

  return { createNewTournament };
};
