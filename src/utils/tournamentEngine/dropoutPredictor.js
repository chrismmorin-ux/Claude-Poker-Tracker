/**
 * dropoutPredictor.js - Tournament milestone projections
 *
 * Uses exponentially-weighted moving average (EWMA) on elimination
 * inter-arrival times to project when milestones will be reached.
 */

import { getBlindLevel } from './blindLevelUtils';

/**
 * Compute the current dropout/elimination rate using EWMA
 *
 * @param {Array<{timestamp: number}>} eliminations - Elimination events (chronological)
 * @param {number} windowMinutes - Lookback window for weighting (default 30)
 * @returns {{ ratePerMinute: number, confidence: 'low'|'medium'|'high' } | null}
 */
export const computeDropoutRate = (eliminations, windowMinutes = 30) => {
  if (!eliminations || eliminations.length < 2) {
    if (eliminations && eliminations.length === 1) {
      return { ratePerMinute: 0, confidence: 'low' };
    }
    return null;
  }

  // Sort by timestamp
  const sorted = [...eliminations].sort((a, b) => a.timestamp - b.timestamp);

  // Compute inter-arrival times in minutes
  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    const deltaMs = sorted[i].timestamp - sorted[i - 1].timestamp;
    intervals.push(deltaMs / 60000); // convert to minutes
  }

  // EWMA with alpha based on sample size
  const windowSize = Math.ceil(windowMinutes / (intervals.reduce((a, b) => a + b, 0) / intervals.length || 1));
  const alpha = 2 / (Math.min(intervals.length, windowSize) + 1);

  let ewma = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    ewma = alpha * intervals[i] + (1 - alpha) * ewma;
  }

  // Rate = 1 / average interval
  const ratePerMinute = ewma > 0 ? 1 / ewma : 0;

  // Confidence based on data points
  let confidence;
  if (intervals.length < 3) {
    confidence = 'low';
  } else if (intervals.length < 8) {
    confidence = 'medium';
  } else {
    confidence = 'high';
  }

  return { ratePerMinute, confidence };
};

/**
 * Project when tournament milestones will be reached
 *
 * @param {number} playersRemaining - Current players remaining
 * @param {number} totalEntrants - Total tournament entrants
 * @param {number} payoutSlots - Number of paid positions
 * @param {number} dropoutRatePerMin - Eliminations per minute (from computeDropoutRate)
 * @param {Array} blindSchedule - Blind schedule for acceleration
 * @param {number} currentLevelIndex - Current blind level
 * @returns {Array<{milestone: string, playersNeeded: number, estimatedMinutes: number}>}
 */
export const projectMilestones = (playersRemaining, totalEntrants, payoutSlots, dropoutRatePerMin, blindSchedule, currentLevelIndex) => {
  if (!dropoutRatePerMin || dropoutRatePerMin <= 0 || playersRemaining <= 1) {
    return [];
  }

  const milestones = [];

  // Define possible milestones
  const targets = [
    { milestone: 'final_table', playersNeeded: 9 },
    { milestone: 'bubble', playersNeeded: payoutSlots ? payoutSlots + 1 : null },
    { milestone: 'heads_up', playersNeeded: 2 },
    { milestone: 'winner', playersNeeded: 1 },
  ];

  for (const target of targets) {
    if (target.playersNeeded === null) continue;
    if (target.playersNeeded >= playersRemaining) continue; // Already past this milestone

    const eliminationsNeeded = playersRemaining - target.playersNeeded;

    // Accelerate rate proportional to blind level growth
    // As blinds increase, short stacks bust faster
    let totalMinutes = 0;
    let elimsRemaining = eliminationsNeeded;
    let currentPlayers = playersRemaining;
    let levelIdx = currentLevelIndex;

    // Walk forward in time chunks
    const currentBlinds = blindSchedule[currentLevelIndex];
    const currentBlindSize = currentBlinds ? (currentBlinds.sb + currentBlinds.bb) : 1;

    while (elimsRemaining > 0) {
      const level = getBlindLevel(blindSchedule, levelIdx);

      const levelBlindSize = level.sb + level.bb;
      const acceleration = levelBlindSize / currentBlindSize;
      const adjustedRate = dropoutRatePerMin * acceleration;

      // How many eliminations happen during this level?
      const elimsThisLevel = adjustedRate * level.durationMinutes;
      const elimsProcessed = Math.min(elimsRemaining, elimsThisLevel);
      const minutesUsed = elimsProcessed / adjustedRate;

      totalMinutes += minutesUsed;
      elimsRemaining -= elimsProcessed;
      currentPlayers -= elimsProcessed;
      levelIdx++;

      // Safety: cap at 24 hours
      if (totalMinutes > 1440) break;
    }

    milestones.push({
      milestone: target.milestone,
      playersNeeded: target.playersNeeded,
      estimatedMinutes: Math.round(totalMinutes),
    });
  }

  // Sort chronologically (earliest milestone first)
  milestones.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

  return milestones;
};
