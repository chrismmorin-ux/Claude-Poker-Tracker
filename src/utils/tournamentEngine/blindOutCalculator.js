/**
 * blindOutCalculator.js - Blind-out and finish position projections
 *
 * Pure functions for calculating when a stack will be blinded out
 * and projecting finish positions based on relative stack survival.
 */

import { getBlindLevel } from './blindLevelUtils';

/**
 * Calculate how many orbits/levels until a stack is blinded out
 *
 * @param {number} stack - Current chip stack
 * @param {Array<{sb: number, bb: number, ante: number, durationMinutes: number}>} blindSchedule
 * @param {number} currentLevelIndex - Index into blindSchedule
 * @param {number} numPlayers - Players at the table (for orbit cost)
 * @param {number} handPaceSeconds - Average seconds per hand
 * @returns {{ blindOutLevel: number, totalOrbits: number, wallClockMinutes: number, breakdown: Array }}
 */
export const calculateOrbitsUntilBlindOut = (stack, blindSchedule, currentLevelIndex, numPlayers, handPaceSeconds = 30) => {
  if (stack <= 0) {
    return { blindOutLevel: currentLevelIndex, totalOrbits: 0, wallClockMinutes: 0, breakdown: [] };
  }
  if (numPlayers <= 0 || handPaceSeconds <= 0) {
    return { blindOutLevel: currentLevelIndex, totalOrbits: 0, wallClockMinutes: 0, breakdown: [] };
  }

  let remaining = stack;
  let totalOrbits = 0;
  let totalMinutes = 0;
  const breakdown = [];
  let levelIndex = currentLevelIndex;

  // Walk through scheduled levels
  const maxLevels = blindSchedule.length + 50; // cap extrapolation
  for (let i = 0; i < maxLevels && remaining > 0; i++) {
    const level = getBlindLevel(blindSchedule, levelIndex);

    const costPerOrbit = level.sb + level.bb + (level.ante * numPlayers);
    if (costPerOrbit <= 0) {
      // Free level (shouldn't happen but guard against infinite loop)
      levelIndex++;
      continue;
    }

    const secondsPerOrbit = numPlayers * handPaceSeconds;
    const orbitsPerLevel = (level.durationMinutes * 60) / secondsPerOrbit;

    // How many full orbits can we survive at this level?
    const orbitsCanSurvive = remaining / costPerOrbit;
    const orbitsInLevel = Math.min(orbitsCanSurvive, orbitsPerLevel);

    const isBlindedOut = orbitsCanSurvive <= orbitsPerLevel;

    const orbitsPlayed = isBlindedOut ? orbitsCanSurvive : orbitsPerLevel;
    const chipsConsumed = orbitsPlayed * costPerOrbit;
    const minutesInLevel = (orbitsPlayed * secondsPerOrbit) / 60;

    remaining -= chipsConsumed;
    totalOrbits += orbitsPlayed;
    totalMinutes += minutesInLevel;

    breakdown.push({
      level: levelIndex,
      orbitsPlayed,
      chipsConsumed: Math.round(chipsConsumed),
      stackRemaining: Math.max(0, Math.round(remaining)),
    });

    if (isBlindedOut) {
      return {
        blindOutLevel: levelIndex,
        totalOrbits: Math.round(totalOrbits * 100) / 100,
        wallClockMinutes: Math.round(totalMinutes * 100) / 100,
        breakdown,
      };
    }

    levelIndex++;
  }

  // Survived all levels (very large stack)
  return {
    blindOutLevel: levelIndex - 1,
    totalOrbits: Math.round(totalOrbits * 100) / 100,
    wallClockMinutes: Math.round(totalMinutes * 100) / 100,
    breakdown,
  };
};

/**
 * Project finish positions for all stacks based on blind-out survival
 *
 * @param {Array<{seat: number, stack: number}>} chipStacks
 * @param {Array} blindSchedule
 * @param {number} currentLevelIndex
 * @param {number} numPlayers
 * @param {number} handPaceSeconds
 * @returns {{ rankings: Array<{seat: number, stack: number, blindOutLevel: number, wallClockMinutes: number, projectedFinish: number}> }}
 */
export const projectFinishPosition = (chipStacks, blindSchedule, currentLevelIndex, numPlayers, handPaceSeconds = 30) => {
  if (!chipStacks || chipStacks.length === 0) {
    return { rankings: [] };
  }

  // Single player remaining = winner
  if (chipStacks.length === 1) {
    const entry = chipStacks[0];
    return {
      rankings: [{
        seat: entry.seat,
        stack: entry.stack,
        blindOutLevel: null,
        wallClockMinutes: Infinity,
        projectedFinish: 1,
      }],
    };
  }

  // Calculate blind-out for each stack
  const results = chipStacks.map(({ seat, stack }) => {
    const projection = calculateOrbitsUntilBlindOut(stack, blindSchedule, currentLevelIndex, numPlayers, handPaceSeconds);
    return {
      seat,
      stack,
      blindOutLevel: projection.blindOutLevel,
      wallClockMinutes: projection.wallClockMinutes,
    };
  });

  // Sort by survival time DESC (longest survivor = best finish)
  results.sort((a, b) => b.wallClockMinutes - a.wallClockMinutes);

  // Assign ordinal positions with ties
  let currentPosition = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].wallClockMinutes < results[i - 1].wallClockMinutes) {
      currentPosition = i + 1;
    }
    results[i].projectedFinish = currentPosition;
  }

  return { rankings: results };
};
