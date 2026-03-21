/**
 * blindLevelUtils.js - Shared blind level lookup with extrapolation
 *
 * Single source of truth for resolving a blind level by index,
 * including extrapolation beyond the defined schedule.
 */

/**
 * Get blind level from schedule, extrapolating beyond defined levels
 * by doubling the last level's values for each level past the end.
 *
 * @param {Array<{sb: number, bb: number, ante: number, durationMinutes: number}>} schedule
 * @param {number} index - Level index to look up
 * @returns {{ sb: number, bb: number, ante: number, durationMinutes: number }}
 */
export const getBlindLevel = (schedule, index) => {
  if (index < schedule.length) return schedule[index];
  const last = schedule[schedule.length - 1];
  const mult = Math.pow(2, index - schedule.length + 1);
  return {
    sb: last.sb * mult,
    bb: last.bb * mult,
    ante: last.ante * mult,
    durationMinutes: last.durationMinutes,
  };
};
