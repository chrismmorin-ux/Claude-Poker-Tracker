/**
 * TournamentBridge.jsx — Tournament auto-detection + state sync with extension
 *
 * Side-effect-only component (no context). Detects tournaments from extension
 * data (seatDisplayMap or ante > 0), auto-initializes the tournament engine,
 * and pushes tournament state (M-ratio, blind-out, ICM) back to the extension.
 */

import { useEffect, useRef } from 'react';
import { useSyncBridge } from './SyncBridgeContext';
import { useTournament } from './TournamentContext';
import { useGame } from './GameContext';
import { useOnlineSession } from './OnlineSessionContext';
import { updateSession } from '../utils/persistence/sessionsStorage';
import { logger } from '../utils/errorHandler';
import { TOURNAMENT_ACTIONS } from '../constants/tournamentConstants';

const DEFAULT_LEVEL_DURATION_MIN = 15;

export const TournamentBridge = ({ children }) => {
  const { liveHandState, pushTournament, isExtensionConnected } = useSyncBridge();
  const { mySeat } = useGame();
  const { selectedSessionId } = useOnlineSession();

  const {
    isTournament, currentBlinds, nextBlinds, levelTimeRemaining,
    heroMRatio, mRatioGuidance, blindOutInfo, icmPressure,
    lockoutInfo, predictions, tournamentState,
    initTournament, updateStack, advanceLevel, setPlayersRemaining,
    dispatchTournament,
  } = useTournament();

  const tournamentInitedRef = useRef(false);
  const lastBlindsKeyRef = useRef(null);
  const selectedRef = useRef(selectedSessionId);
  useEffect(() => { selectedRef.current = selectedSessionId; }, [selectedSessionId]);

  // Detect tournament from extension data and auto-initialize
  useEffect(() => {
    if (!liveHandState || tournamentInitedRef.current) return;

    // Heuristic: seatDisplayMap is tournament-only; ante > 0 can false-positive
    // on cash games with antes (e.g., bomb pots), but seatDisplayMap takes priority.
    const isTournamentTable = liveHandState.seatDisplayMap != null || (liveHandState.ante > 0);
    if (!isTournamentTable) return;

    const blinds = liveHandState.blinds;
    if (!blinds || (!blinds.sb && !blinds.bb)) return;

    tournamentInitedRef.current = true;
    logger.info('TournamentBridge', 'Tournament detected from extension data, auto-initializing engine');

    // Ante format: extension may provide it directly; otherwise online = per-player
    const anteFormat = liveHandState.anteFormat || 'per-player';

    const initialSchedule = [{
      sb: blinds.sb,
      bb: blinds.bb,
      ante: liveHandState.ante || 0,
      anteFormat,
      durationMinutes: DEFAULT_LEVEL_DURATION_MIN,
    }];

    const stacks = liveHandState.stacks || {};
    const stackValues = Object.values(stacks).filter(s => s > 0);
    const avgStack = stackValues.length > 0
      ? Math.round(stackValues.reduce((a, b) => a + b, 0) / stackValues.length)
      : 10000;

    initTournament({
      format: 'freezeout',
      startingStack: avgStack,
      blindSchedule: initialSchedule,
      handPaceSeconds: 30,
      totalEntrants: null,
      payoutSlots: null,
    });

    const activePlayers = liveHandState.activeSeatNumbers?.length || stackValues.length;
    if (activePlayers > 0) {
      setPlayersRemaining(activePlayers);
    }

    if (selectedRef.current) {
      updateSession(selectedRef.current, { gameType: 'Tournament' }).catch(err => {
        logger.warn('TournamentBridge', 'Failed to update session gameType to Tournament', err);
      });
    }

    lastBlindsKeyRef.current = `${blinds.sb}/${blinds.bb}/${liveHandState.ante || 0}`;
  }, [liveHandState, initTournament, setPlayersRemaining]);

  // Sync stacks from extension to tournament reducer
  useEffect(() => {
    if (!isTournament || !liveHandState?.stacks) return;
    for (const [seat, amount] of Object.entries(liveHandState.stacks)) {
      if (amount > 0) updateStack(Number(seat), amount);
    }
  }, [isTournament, liveHandState?.stacks, updateStack]);

  // Detect blind level changes
  useEffect(() => {
    if (!isTournament || !liveHandState?.blinds) return;

    const { blinds, ante } = liveHandState;
    const key = `${blinds.sb}/${blinds.bb}/${ante || 0}`;
    if (key === lastBlindsKeyRef.current) return;

    lastBlindsKeyRef.current = key;
    logger.info('TournamentBridge', 'Blind level change detected:', key);

    const newLevel = {
      sb: blinds.sb,
      bb: blinds.bb,
      ante: ante || 0,
      anteFormat: liveHandState.anteFormat || 'per-player',
      durationMinutes: DEFAULT_LEVEL_DURATION_MIN,
    };

    const currentSchedule = tournamentState.config.blindSchedule || [];
    dispatchTournament({
      type: TOURNAMENT_ACTIONS.UPDATE_CONFIG,
      payload: { blindSchedule: [...currentSchedule, newLevel] },
    });
    advanceLevel();
  }, [isTournament, liveHandState?.blinds, liveHandState?.ante, advanceLevel, dispatchTournament, tournamentState.config.blindSchedule]);

  // Push tournament state to extension
  useEffect(() => {
    if (!isTournament) {
      pushTournament(null);
      return;
    }

    const { chipStacks, playersRemaining, currentLevelIndex, config } = tournamentState;
    const heroStack = chipStacks[mySeat] || 0;
    const totalEntrants = config.totalEntrants || null;

    const stacks = Object.values(chipStacks).filter(s => s > 0);
    const avgStack = stacks.length > 0 ? Math.round(stacks.reduce((a, b) => a + b, 0) / stacks.length) : 0;

    const progress = totalEntrants && playersRemaining
      ? Math.round(((totalEntrants - playersRemaining) / totalEntrants) * 100)
      : null;

    const levelEndTime = levelTimeRemaining != null
      ? Date.now() + levelTimeRemaining
      : null;

    pushTournament({
      heroMRatio: heroMRatio != null ? Math.round(heroMRatio * 10) / 10 : null,
      mRatioGuidance,
      blindOutInfo,
      icmPressure,
      lockoutInfo,
      currentBlinds,
      nextBlinds,
      levelEndTime,
      playersRemaining,
      totalEntrants,
      currentLevelIndex,
      predictions: predictions ? {
        milestones: predictions.milestones || [],
        dropoutRate: predictions.dropoutRate || null,
        finishProjections: predictions.finishProjections || null,
      } : null,
      progress,
      heroStack,
      avgStack,
      format: config.format || 'freezeout',
    });
  }, [
    isTournament, heroMRatio, mRatioGuidance, blindOutInfo, icmPressure, lockoutInfo,
    currentBlinds, nextBlinds, tournamentState.currentLevelIndex,
    tournamentState.playersRemaining, tournamentState.chipStacks,
    predictions, mySeat, pushTournament, isExtensionConnected,
  ]);

  return <>{children}</>;
};
