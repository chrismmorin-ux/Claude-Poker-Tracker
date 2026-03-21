/**
 * TournamentContext.jsx - Tournament state context provider
 *
 * Provides tournament state, derived values, predictions, and handlers.
 * Wraps the tournament prediction engine (Phase 1) with React state.
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { TOURNAMENT_ACTIONS } from '../constants/tournamentConstants';
import { useSession } from './SessionContext';
import { useTournamentPersistence } from '../hooks/useTournamentPersistence';
import { useTournamentTimer } from '../hooks/useTournamentTimer';
import {
  getBlindLevel,
  calculateOrbitsUntilBlindOut,
  projectFinishPosition,
  computeDropoutRate,
  projectMilestones,
} from '../utils/tournamentEngine';

const TournamentContext = createContext(null);

/**
 * TournamentProvider - Wraps children with tournament context
 */
export const TournamentProvider = ({ tournamentState, dispatchTournament, children }) => {
  const { currentSession } = useSession();

  // Derived: is this a tournament session?
  const isTournamentSession = currentSession?.gameType === 'Tournament';
  const isTournament = useMemo(() => {
    return isTournamentSession && tournamentState.isActive;
  }, [isTournamentSession, tournamentState.isActive]);

  // Persistence: hydrate on mount + debounced auto-save
  const { createNewTournament } = useTournamentPersistence(
    tournamentState,
    dispatchTournament,
    currentSession?.sessionId,
    isTournamentSession
  );

  // Current blind level from schedule
  const currentBlinds = useMemo(() => {
    const schedule = tournamentState.config.blindSchedule;
    const idx = tournamentState.currentLevelIndex;
    if (!schedule || schedule.length === 0) {
      return { sb: 0, bb: 0, ante: 0, durationMinutes: 20 };
    }
    return getBlindLevel(schedule, idx);
  }, [tournamentState.config.blindSchedule, tournamentState.currentLevelIndex]);

  // Next blind level
  const nextBlinds = useMemo(() => {
    const schedule = tournamentState.config.blindSchedule;
    const idx = tournamentState.currentLevelIndex + 1;
    if (!schedule || schedule.length === 0) return null;
    return getBlindLevel(schedule, idx);
  }, [tournamentState.config.blindSchedule, tournamentState.currentLevelIndex]);

  // Handlers
  const advanceLevel = useCallback(() => {
    dispatchTournament({ type: TOURNAMENT_ACTIONS.ADVANCE_BLIND_LEVEL });
  }, [dispatchTournament]);

  // Timer: single source of truth for level countdown
  const { levelTimeRemaining } = useTournamentTimer({
    levelStartTime: isTournament ? tournamentState.levelStartTime : null,
    levelDurationMs: isTournament ? currentBlinds.durationMinutes * 60 * 1000 : 0,
    isPaused: tournamentState.isPaused,
    totalPausedMs: tournamentState.totalPausedMs,
    pauseStartTime: tournamentState.pauseStartTime,
    onLevelExpire: advanceLevel,
  });

  // Predictions (computed via useMemo)
  const predictions = useMemo(() => {
    if (!isTournament) return null;

    const { config, currentLevelIndex, chipStacks, eliminations, playersRemaining } = tournamentState;
    const { blindSchedule, handPaceSeconds, payoutSlots, totalEntrants } = config;

    if (!blindSchedule || blindSchedule.length === 0) return null;

    // Convert chipStacks object to array
    const stacksArray = Object.entries(chipStacks).map(([seat, stack]) => ({
      seat: Number(seat),
      stack,
    }));

    // Finish position projections
    const finishProjections = stacksArray.length > 0
      ? projectFinishPosition(stacksArray, blindSchedule, currentLevelIndex, stacksArray.length, handPaceSeconds)
      : { rankings: [] };

    // Dropout rate
    const dropoutRate = computeDropoutRate(eliminations);

    // Milestone projections
    const milestones = dropoutRate && dropoutRate.ratePerMinute > 0
      ? projectMilestones(
          playersRemaining || stacksArray.length,
          totalEntrants || playersRemaining || stacksArray.length,
          payoutSlots,
          dropoutRate.ratePerMinute,
          blindSchedule,
          currentLevelIndex
        )
      : [];

    return {
      finishProjections,
      dropoutRate,
      milestones,
    };
  }, [
    isTournament,
    tournamentState.config,
    tournamentState.currentLevelIndex,
    tournamentState.chipStacks,
    tournamentState.eliminations,
    tournamentState.playersRemaining,
  ]);

  // Action handlers
  const initTournament = useCallback((config) => {
    dispatchTournament({
      type: TOURNAMENT_ACTIONS.INIT_TOURNAMENT,
      payload: { config },
    });
  }, [dispatchTournament]);

  const pauseTimer = useCallback(() => {
    dispatchTournament({ type: TOURNAMENT_ACTIONS.PAUSE_TIMER });
  }, [dispatchTournament]);

  const resumeTimer = useCallback(() => {
    dispatchTournament({ type: TOURNAMENT_ACTIONS.RESUME_TIMER });
  }, [dispatchTournament]);

  const updateStack = useCallback((seat, stack) => {
    dispatchTournament({
      type: TOURNAMENT_ACTIONS.UPDATE_CHIP_STACK,
      payload: { seat, stack },
    });
  }, [dispatchTournament]);

  const recordElimination = useCallback((seat, playerName) => {
    dispatchTournament({
      type: TOURNAMENT_ACTIONS.RECORD_ELIMINATION,
      payload: { seat, playerName },
    });
  }, [dispatchTournament]);

  const setPlayersRemaining = useCallback((count) => {
    dispatchTournament({
      type: TOURNAMENT_ACTIONS.SET_PLAYERS_REMAINING,
      payload: { count },
    });
  }, [dispatchTournament]);

  const resetTournament = useCallback(() => {
    dispatchTournament({ type: TOURNAMENT_ACTIONS.RESET_TOURNAMENT });
  }, [dispatchTournament]);

  const value = useMemo(() => ({
    // Raw state
    tournamentState,
    // Derived
    isTournament,
    currentBlinds,
    nextBlinds,
    levelTimeRemaining,
    predictions,
    // Handlers
    initTournament,
    advanceLevel,
    pauseTimer,
    resumeTimer,
    updateStack,
    recordElimination,
    setPlayersRemaining,
    resetTournament,
    createNewTournament,
    dispatchTournament,
  }), [
    tournamentState,
    isTournament,
    currentBlinds,
    nextBlinds,
    levelTimeRemaining,
    predictions,
    initTournament,
    advanceLevel,
    pauseTimer,
    resumeTimer,
    updateStack,
    recordElimination,
    setPlayersRemaining,
    resetTournament,
    createNewTournament,
    dispatchTournament,
  ]);

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};

/**
 * Hook to access tournament context
 */
export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};

export default TournamentContext;
