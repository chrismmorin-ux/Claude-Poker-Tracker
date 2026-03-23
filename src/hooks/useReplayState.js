/**
 * useReplayState.js - Core stepping logic for hand replay
 *
 * Manages action-by-action table state reconstruction from precomputed timeline.
 * Re-sorts actions into correct poker positional order (not recording order).
 * All derived state re-computed via useMemo when currentActionIndex changes.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { isFoldAction } from '../constants/gameConstants';
import { sortByPositionalOrder } from '../utils/handAnalysis';
import { getCardsForStreet } from '../utils/pokerCore/cardParser';

/**
 * @param {Array} timeline - From buildTimeline()
 * @param {Object|null} selectedHand - The hand record
 * @param {Array|null} actionAnalysis - From useHandReplayAnalysis
 * @returns {Object} Replay state + control API
 */
export const useReplayState = (timeline, selectedHand, actionAnalysis) => {
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [pinnedVillainSeat, setPinnedVillainSeat] = useState(null);
  const [revealedSeats, setRevealedSeats] = useState(new Set());
  const [analysisLens, setAnalysisLens] = useState('moment'); // 'moment' | 'hindsight'

  const dealerSeat = selectedHand?.gameState?.dealerButtonSeat ?? null;

  // Re-sort timeline into positional order for replay
  // TODO: Dual-timeline (recording order vs positional order) could be unified
  // if buildTimeline emitted positional order directly. See BACKLOG.md.
  const replayTimeline = useMemo(
    () => sortByPositionalOrder(timeline, dealerSeat),
    [timeline, dealerSeat]
  );

  const heroSeat = selectedHand?.gameState?.mySeat ?? null;

  // Track last auto-selected villain so it persists across hero actions and street jumps
  const lastAutoVillainRef = useRef(null);

  // Reset when hand changes
  useEffect(() => {
    setCurrentActionIndex(replayTimeline.length > 0 ? 0 : -1);
    setPinnedVillainSeat(null);
    setRevealedSeats(new Set());
    setAnalysisLens('moment');
    lastAutoVillainRef.current = null;
  }, [replayTimeline]);

  const maxIndex = replayTimeline.length - 1;

  // Current street
  const currentStreet = useMemo(() => {
    if (currentActionIndex < 0 || !replayTimeline[currentActionIndex]) return 'preflop';
    return replayTimeline[currentActionIndex].street;
  }, [replayTimeline, currentActionIndex]);

  // All actions up to and including current index
  const visibleActions = useMemo(() => {
    if (currentActionIndex < 0) return [];
    return replayTimeline.slice(0, currentActionIndex + 1);
  }, [replayTimeline, currentActionIndex]);

  // Seat states: scan visible actions to build per-seat state
  const seatStates = useMemo(() => {
    const states = new Map();
    for (const entry of visibleActions) {
      const seat = Number(entry.seat);
      const existing = states.get(seat) || { lastAction: null, hasFolded: false, totalBet: 0 };
      existing.lastAction = entry.action;
      if (isFoldAction(entry.action)) {
        existing.hasFolded = true;
      }
      if (entry.amount) {
        existing.totalBet += entry.amount;
      }
      states.set(seat, existing);
    }
    return states;
  }, [visibleActions]);

  // Community cards visible at current point
  const communityCardsAtPoint = useMemo(() => {
    const cards = selectedHand?.cardState?.communityCards ||
                  selectedHand?.gameState?.communityCards || [];
    return getCardsForStreet(cards, currentStreet);
  }, [selectedHand, currentStreet]);

  // Pot at current point (sum of bets + blinds)
  const potAtPoint = useMemo(() => {
    let pot = 0;
    const blindsPosted = selectedHand?.gameState?.blindsPosted;
    if (blindsPosted) {
      pot += (blindsPosted.sb || 0) + (blindsPosted.bb || 0);
    }
    for (const entry of visibleActions) {
      if (entry.amount) pot += entry.amount;
    }
    return pot;
  }, [visibleActions, selectedHand]);

  // Current action entry and analysis
  const currentActionEntry = currentActionIndex >= 0 ? replayTimeline[currentActionIndex] : null;

  // Active villain seat: pinned seat takes priority, then current actor if villain, then last auto-selected
  const selectedVillainSeat = useMemo(() => {
    if (pinnedVillainSeat) return pinnedVillainSeat;
    if (!currentActionEntry) return lastAutoVillainRef.current;
    const actorSeat = Number(currentActionEntry.seat);
    const newVillain = actorSeat !== heroSeat ? actorSeat : lastAutoVillainRef.current;
    lastAutoVillainRef.current = newVillain;
    return newVillain;
  }, [pinnedVillainSeat, currentActionEntry, heroSeat]);

  // O(1) lookup: order → analysis result (bypasses timeline index indirection)
  const orderToAnalysis = useMemo(() => {
    if (!actionAnalysis) return null;
    const map = new Map();
    for (const a of actionAnalysis) {
      if (a?.order != null) map.set(a.order, a);
    }
    return map;
  }, [actionAnalysis]);

  // Current action's analysis — direct order-based lookup
  const currentAnalysis = useMemo(() => {
    if (!currentActionEntry || !orderToAnalysis) return null;
    return orderToAnalysis.get(currentActionEntry.order) ?? null;
  }, [currentActionEntry, orderToAnalysis]);

  // Villain analysis: find nearest analysis entry for selected villain at or before current replay index
  const villainAnalysis = useMemo(() => {
    if (!selectedVillainSeat || !orderToAnalysis) return null;
    const seatStr = String(selectedVillainSeat);
    for (let i = currentActionIndex; i >= 0; i--) {
      const entry = replayTimeline[i];
      if (String(entry.seat) !== seatStr) continue;
      const analysis = orderToAnalysis.get(entry.order);
      if (analysis) return analysis;
    }
    return null;
  }, [selectedVillainSeat, orderToAnalysis, currentActionIndex, replayTimeline]);

  // Street start indices for jumpToStreet
  const streetStartIndices = useMemo(() => {
    const indices = {};
    for (let i = 0; i < replayTimeline.length; i++) {
      const street = replayTimeline[i].street;
      if (!(street in indices)) {
        indices[street] = i;
      }
    }
    return indices;
  }, [replayTimeline]);

  // Available streets
  const availableStreets = useMemo(() => {
    const streets = [];
    const seen = new Set();
    for (const entry of replayTimeline) {
      if (!seen.has(entry.street)) {
        seen.add(entry.street);
        streets.push(entry.street);
      }
    }
    return streets;
  }, [replayTimeline]);

  // Navigation API
  const stepForward = useCallback(() => {
    setCurrentActionIndex(i => Math.min(i + 1, maxIndex));
  }, [maxIndex]);

  const stepBack = useCallback(() => {
    setCurrentActionIndex(i => Math.max(i - 1, 0));
  }, []);

  const jumpToStreet = useCallback((street) => {
    const idx = streetStartIndices[street];
    if (idx !== undefined) setCurrentActionIndex(idx);
  }, [streetStartIndices]);

  const jumpToStart = useCallback(() => {
    setCurrentActionIndex(0);
  }, []);

  const jumpToEnd = useCallback(() => {
    setCurrentActionIndex(maxIndex);
  }, [maxIndex]);

  const selectVillain = useCallback((seat) => {
    setPinnedVillainSeat(prev => prev === seat ? null : seat);
    setAnalysisLens('moment');
  }, []);

  const toggleReveal = useCallback((seat) => {
    setRevealedSeats(prev => {
      const next = new Set(prev);
      if (next.has(seat)) next.delete(seat);
      else next.add(seat);
      return next;
    });
  }, []);

  return {
    currentActionIndex,
    currentStreet,
    visibleActions,
    seatStates,
    communityCardsAtPoint,
    potAtPoint,
    currentActionEntry,
    currentAnalysis,
    villainAnalysis,
    selectedVillainSeat,
    pinnedVillainSeat,
    revealedSeats,
    availableStreets,
    timelineLength: replayTimeline.length,
    // API
    stepForward,
    stepBack,
    jumpToStreet,
    jumpToStart,
    jumpToEnd,
    selectVillain,
    toggleReveal,
    analysisLens,
    setAnalysisLens,
  };
};
