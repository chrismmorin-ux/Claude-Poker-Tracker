/**
 * TournamentContext.jsx - Tournament state context provider
 *
 * Provides tournament state, derived values, predictions, and handlers.
 * Wraps the tournament prediction engine (Phase 1) with React state.
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { TOURNAMENT_ACTIONS } from '../constants/tournamentConstants';
import { useSession } from './SessionContext';
import { useGame } from './GameContext';
import { useTournamentPersistence } from '../hooks/useTournamentPersistence';
import { useTournamentTimer } from '../hooks/useTournamentTimer';
import {
  getBlindLevel,
  calculateOrbitsUntilBlindOut,
  projectFinishPosition,
  computeDropoutRate,
  projectMilestones,
} from '../utils/tournamentEngine';
import { LIMITS } from '../constants/gameConstants';

const TournamentContext = createContext(null);

/**
 * TournamentProvider - Wraps children with tournament context
 */
export const TournamentProvider = ({ tournamentState, dispatchTournament, children }) => {
  const { currentSession } = useSession();
  const { mySeat } = useGame();

  // Derived: is this a tournament session?
  // isActive is only set by explicit initTournament() — safe for both manual
  // sessions (gameType === 'Tournament') and auto-detected online tournaments.
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

  // Derived: hero M-ratio
  const heroMRatio = useMemo(() => {
    if (!isTournament) return null;
    const heroStack = tournamentState.chipStacks[mySeat];
    if (heroStack == null || heroStack <= 0) return null;
    const costPerOrbit = currentBlinds.sb + currentBlinds.bb + (currentBlinds.ante * LIMITS.NUM_SEATS);
    return costPerOrbit > 0 ? heroStack / costPerOrbit : null;
  }, [isTournament, tournamentState.chipStacks, mySeat, currentBlinds]);

  // Derived: lockout info (for rebuy freeze level)
  const lockoutInfo = useMemo(() => {
    if (!isTournament) return null;
    const { lockoutLevel } = tournamentState.config;
    if (lockoutLevel == null) return null;
    const { currentLevelIndex, config } = tournamentState;
    const levelsUntilLockout = lockoutLevel - currentLevelIndex;
    const isPastLockout = levelsUntilLockout <= 0;
    const isApproaching = !isPastLockout && levelsUntilLockout <= 2;
    // Estimate minutes until lockout
    let minutesUntilLockout = 0;
    if (!isPastLockout && config.blindSchedule?.length > 0) {
      for (let i = currentLevelIndex; i < lockoutLevel; i++) {
        const level = getBlindLevel(config.blindSchedule, i);
        minutesUntilLockout += level.durationMinutes;
      }
    }
    return { isApproaching, levelsUntilLockout, minutesUntilLockout, isPastLockout };
  }, [isTournament, tournamentState.config.lockoutLevel, tournamentState.config.blindSchedule, tournamentState.currentLevelIndex]);

  // Derived: blind-out info for hero
  const blindOutInfo = useMemo(() => {
    if (!isTournament) return null;
    const heroStack = tournamentState.chipStacks[mySeat];
    if (heroStack == null || heroStack <= 0) return null;
    const { blindSchedule, handPaceSeconds } = tournamentState.config;
    if (!blindSchedule?.length) return null;
    const result = calculateOrbitsUntilBlindOut(
      heroStack, blindSchedule, tournamentState.currentLevelIndex,
      LIMITS.NUM_SEATS, handPaceSeconds
    );
    return {
      wallClockMinutes: Math.round(result.wallClockMinutes),
      blindOutLevel: result.blindOutLevel,
      levelsRemaining: result.blindOutLevel - tournamentState.currentLevelIndex,
    };
  }, [isTournament, tournamentState.chipStacks, mySeat, tournamentState.config.blindSchedule, tournamentState.config.handPaceSeconds, tournamentState.currentLevelIndex]);

  // Derived: ICM pressure
  const icmPressure = useMemo(() => {
    if (!isTournament) return { zone: 'standard', playersFromBubble: null };
    const { playersRemaining } = tournamentState;
    const { payoutSlots } = tournamentState.config;
    if (!payoutSlots || !playersRemaining) return { zone: 'standard', playersFromBubble: null };
    const playersFromBubble = playersRemaining - payoutSlots;
    if (playersFromBubble <= 0) return { zone: 'itm', playersFromBubble: 0 };
    if (playersFromBubble <= 3) return { zone: 'bubble', playersFromBubble };
    // "Approaching" when within 20% of bubble
    const threshold = Math.ceil(payoutSlots * 0.2);
    if (playersFromBubble <= threshold) return { zone: 'approaching', playersFromBubble };
    return { zone: 'standard', playersFromBubble };
  }, [isTournament, tournamentState.playersRemaining, tournamentState.config.payoutSlots]);

  // Derived: M-ratio action guidance
  const mRatioGuidance = useMemo(() => {
    if (heroMRatio == null) return null;
    if (heroMRatio >= 20) return { label: 'Comfortable', zone: 'comfortable' };
    if (heroMRatio >= 10) return { label: 'Open/Fold', zone: 'caution' };
    if (heroMRatio >= 6) return { label: 'Push/Fold', zone: 'pushFold' };
    return { label: 'Shove/Fold', zone: 'shoveOnly' };
  }, [heroMRatio]);

  // Handlers
  const advanceLevel = useCallback(() => {
    dispatchTournament({ type: TOURNAMENT_ACTIONS.ADVANCE_BLIND_LEVEL });
  }, [dispatchTournament]);

  // W4-A2-F3 Undo support — revert a manual Advance Level back to a specific
  // level. Timer resets on the destination level (SET_BLIND_LEVEL action
  // semantics). Acceptable trade-off for the undo window — users who undo a
  // misclicked advance expect the level to revert; a fresh timer is a minor
  // side-effect we document rather than re-plumb.
  const setBlindLevel = useCallback((levelIndex) => {
    dispatchTournament({
      type: TOURNAMENT_ACTIONS.SET_BLIND_LEVEL,
      payload: { levelIndex },
    });
  }, [dispatchTournament]);

  // W4-A2-F2 Undo support — partial-state hydrate for elimination undo. Takes
  // a subset of tournamentState (typically {chipStacks, playersRemaining,
  // eliminations}) and merges it back. Reuses the existing HYDRATE_TOURNAMENT
  // reducer action which shallow-merges payload into state.
  const hydrateTournament = useCallback((partialState) => {
    dispatchTournament({
      type: TOURNAMENT_ACTIONS.HYDRATE_TOURNAMENT,
      payload: partialState,
    });
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
    heroMRatio,
    lockoutInfo,
    blindOutInfo,
    icmPressure,
    mRatioGuidance,
    // Handlers
    initTournament,
    advanceLevel,
    setBlindLevel,
    hydrateTournament,
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
    heroMRatio,
    lockoutInfo,
    blindOutInfo,
    icmPressure,
    mRatioGuidance,
    initTournament,
    advanceLevel,
    setBlindLevel,
    hydrateTournament,
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
