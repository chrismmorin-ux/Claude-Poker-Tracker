/**
 * useReplayState.js - Core stepping logic for hand replay
 *
 * Manages action-by-action table state reconstruction from precomputed timeline.
 * Re-sorts actions into correct poker positional order (not recording order).
 * All derived state re-computed via useMemo when currentActionIndex changes.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { isFoldAction, LIMITS } from '../constants/gameConstants';
import { BETTING_STREETS } from '../constants/gameConstants';

const NUM_SEATS = LIMITS.NUM_SEATS;

/**
 * Get positional acting order for a street.
 * Preflop: UTG (dealer+3) first, BB last.
 * Postflop: SB (dealer+1) first, BTN last.
 */
const getPositionalOrder = (dealerSeat, street) => {
  const seats = [];
  for (let i = 1; i <= NUM_SEATS; i++) {
    seats.push(((dealerSeat - 1 + i) % NUM_SEATS) + 1);
  }
  if (street === 'preflop') {
    const sb = seats.shift();
    const bb = seats.shift();
    seats.push(sb, bb);
  }
  return seats;
};

/**
 * Re-sort a timeline into correct poker positional order.
 * Within each street, actions are ordered by position (not recording order).
 * Multiple actions by the same seat on the same street preserve their relative order.
 */
const sortByPositionalOrder = (timeline, dealerSeat) => {
  if (!timeline.length || !dealerSeat) return timeline;

  // Group actions by street, preserving original order within each group
  const streetGroups = {};
  const streetOrder = [];
  for (const entry of timeline) {
    if (!streetGroups[entry.street]) {
      streetGroups[entry.street] = [];
      streetOrder.push(entry.street);
    }
    streetGroups[entry.street].push(entry);
  }

  const sorted = [];
  for (const street of streetOrder) {
    const entries = streetGroups[street];
    const posOrder = getPositionalOrder(dealerSeat, street);

    // Build seat priority map: lower = acts first
    const seatPriority = {};
    posOrder.forEach((seat, idx) => { seatPriority[seat] = idx; });

    // Group by seat, preserving intra-seat order
    const bySeat = {};
    for (const entry of entries) {
      const seat = Number(entry.seat);
      if (!bySeat[seat]) bySeat[seat] = [];
      bySeat[seat].push(entry);
    }

    // Walk through in positional order, emitting first action for each seat.
    // Then repeat for seats with multiple actions (e.g., check then call).
    // This handles multi-action streets (bet → others respond → possible re-action).
    let remaining = { ...bySeat };
    while (Object.keys(remaining).length > 0) {
      for (const seat of posOrder) {
        if (remaining[seat] && remaining[seat].length > 0) {
          sorted.push(remaining[seat].shift());
          if (remaining[seat].length === 0) delete remaining[seat];
        }
      }
    }
  }

  return sorted;
};

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

  const dealerSeat = selectedHand?.gameState?.dealerButtonSeat ?? null;

  // Re-sort timeline into positional order for replay
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
    const filled = cards.filter(c => c && c.trim().length >= 2);
    switch (currentStreet) {
      case 'preflop': return [];
      case 'flop': return filled.slice(0, 3);
      case 'turn': return filled.slice(0, 4);
      case 'river': return filled.slice(0, 5);
      default: return filled;
    }
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

  // Map replay index back to original timeline index for actionAnalysis lookup
  const currentAnalysis = useMemo(() => {
    if (!currentActionEntry || !actionAnalysis) return null;
    // actionAnalysis is indexed 1:1 with the original timeline (by order field)
    const origIdx = timeline.findIndex(e => e.order === currentActionEntry.order);
    return origIdx >= 0 ? actionAnalysis[origIdx] : null;
  }, [currentActionEntry, actionAnalysis, timeline]);

  // Villain analysis: find nearest analysis entry for selected villain at or before current replay index
  const villainAnalysis = useMemo(() => {
    if (!selectedVillainSeat || !actionAnalysis) return null;
    const seatStr = String(selectedVillainSeat);
    // Walk backwards through replayTimeline up to currentActionIndex,
    // map each entry back to original timeline to get analysis
    for (let i = currentActionIndex; i >= 0; i--) {
      const entry = replayTimeline[i];
      if (String(entry.seat) !== seatStr) continue;
      const origIdx = timeline.findIndex(e => e.order === entry.order);
      if (origIdx >= 0 && actionAnalysis[origIdx]) {
        return actionAnalysis[origIdx];
      }
    }
    return null;
  }, [selectedVillainSeat, actionAnalysis, currentActionIndex, replayTimeline, timeline]);

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
  };
};
