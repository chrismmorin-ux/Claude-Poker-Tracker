/**
 * buildIcmStacks.js — assemble the modeled stack array for ICM from live
 * tournament state, honestly (POKER_THEORY.md §10.6).
 *
 * Exact ICM needs EVERY remaining player's stack. The app only observes the
 * stacks at hero's table (`chipStacks`) + a `playersRemaining` count:
 *   - Final table (playersRemaining ≤ seated): observed stacks ARE the field → EXACT.
 *   - Small multi-table (playersRemaining ≤ MAX_ICM_FIELD): bucket the unseen
 *     players at the average remaining stack → APPROXIMATE (flagged).
 *   - Large field (playersRemaining > MAX_ICM_FIELD): decline to fabricate a
 *     precise ICM number → `tooLarge`. ICM matters most near the bubble/final
 *     table, which is exactly when the field IS small enough to model; far from
 *     the money the risk premium ≈ 1 (chips ≈ dollars) anyway.
 */

import { MAX_ICM_FIELD } from './malmuthHarville';

/**
 * @param {Object} params
 * @param {Object} params.chipStacks       - { [seat]: chips } at hero's table
 * @param {number} params.mySeat           - hero seat
 * @param {number|null} params.playersRemaining - total players left in the tournament
 * @param {number|null} [params.totalChips]     - total chips in play (startingStack × entrants)
 * @returns {{
 *   stacks: number[], heroIndex: number, seats: number[],
 *   unknownCount: number, isApproximate: boolean, tooLarge: boolean
 * } | null}  null when there is no usable stack data.
 */
export const buildIcmStacks = ({ chipStacks, mySeat, playersRemaining, totalChips }) => {
  if (!chipStacks || typeof chipStacks !== 'object') return null;

  // Seated stacks with chips, in seat order (deterministic).
  const seated = Object.keys(chipStacks)
    .map(Number)
    .filter(seat => Number.isFinite(chipStacks[seat]) && chipStacks[seat] > 0)
    .sort((a, b) => a - b)
    .map(seat => ({ seat, stack: chipStacks[seat] }));

  if (seated.length === 0) return null;

  const seats = seated.map(s => s.seat);
  const stacks = seated.map(s => s.stack);
  const heroIndex = seats.indexOf(mySeat);

  const knownChips = stacks.reduce((a, b) => a + b, 0);
  const nRemaining = (playersRemaining != null && playersRemaining > 0)
    ? playersRemaining
    : seated.length;

  // Final table (or all remaining players visible at the table): EXACT.
  if (nRemaining <= seated.length) {
    return { stacks, heroIndex, seats, unknownCount: 0, isApproximate: false, tooLarge: false };
  }

  // Larger than we can model exactly — decline to fabricate precision.
  if (nRemaining > MAX_ICM_FIELD) {
    return { stacks, heroIndex, seats, unknownCount: nRemaining - seated.length, isApproximate: true, tooLarge: true };
  }

  // Small multi-table: bucket the unseen field at the average remaining stack.
  const unknownCount = nRemaining - seated.length;
  let avgUnknown;
  if (totalChips != null && totalChips > knownChips) {
    avgUnknown = (totalChips - knownChips) / unknownCount;
  } else {
    // No total-chip info — approximate unseen stacks at the seated average.
    avgUnknown = knownChips / seated.length;
  }
  avgUnknown = Math.max(1, Math.round(avgUnknown));

  return {
    stacks: [...stacks, ...Array(unknownCount).fill(avgUnknown)],
    heroIndex,
    seats, // only the seated portion maps to real seats; unknown buckets follow
    unknownCount,
    isApproximate: true,
    tooLarge: false,
  };
};
