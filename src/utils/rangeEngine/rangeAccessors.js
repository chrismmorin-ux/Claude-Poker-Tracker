/**
 * rangeAccessors.js — Shared helpers for reading villain range grids
 * from Bayesian range profiles.
 *
 * Used by useLiveActionAdvisor and useLiveEquity.
 */

import { getActionsForSeatOnStreet } from '../sequenceUtils';

/**
 * Determine villain's preflop action key from the action sequence.
 * Maps to range sub-keys: 'open', 'coldCall', 'threeBet'.
 * Returns null to use merged open+coldCall default.
 */
export const getVillainActionKey = (actionSequence, villainSeat) => {
  const preflopActions = getActionsForSeatOnStreet(actionSequence, villainSeat, 'preflop');
  if (!preflopActions || preflopActions.length === 0) return null;

  for (const entry of preflopActions) {
    const action = typeof entry === 'string' ? entry : entry.action;
    if (action === 'raise' || action === 'open') return 'open';
    if (action === '3bet' || action === 'threeBet') return 'threeBet';
    if (action === 'call' || action === 'coldCall') return 'coldCall';
  }
  return null;
};

/**
 * Get a villain's range grid for the given position + action.
 * Falls back to merged open+coldCall if no specific action identified.
 */
export const getVillainRange = (rangeProfile, position, actionKey) => {
  if (!rangeProfile?.ranges?.[position]) return null;

  const posRanges = rangeProfile.ranges[position];

  if (actionKey && posRanges[actionKey]) {
    return posRanges[actionKey];
  }

  // Merge open + coldCall weighted equally as fallback
  const open = posRanges.open;
  const coldCall = posRanges.coldCall;
  if (!open && !coldCall) return null;
  if (!open) return coldCall;
  if (!coldCall) return open;

  const merged = new Float64Array(169);
  for (let i = 0; i < 169; i++) {
    merged[i] = (open[i] + coldCall[i]) / 2;
  }
  return merged;
};
