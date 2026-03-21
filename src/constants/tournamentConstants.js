/**
 * tournamentConstants.js - Tournament-related constants
 */

import { TOURNAMENT_M_RATIO } from './designTokens';

// =============================================================================
// BLIND SCHEDULES
// =============================================================================

export const BLIND_SCHEDULES = {
  TURBO_10MIN: [
    { level: 1, sb: 25, bb: 50, ante: 0, durationMinutes: 10 },
    { level: 2, sb: 50, bb: 100, ante: 0, durationMinutes: 10 },
    { level: 3, sb: 75, bb: 150, ante: 0, durationMinutes: 10 },
    { level: 4, sb: 100, bb: 200, ante: 25, durationMinutes: 10 },
    { level: 5, sb: 150, bb: 300, ante: 50, durationMinutes: 10 },
    { level: 6, sb: 200, bb: 400, ante: 75, durationMinutes: 10 },
    { level: 7, sb: 300, bb: 600, ante: 100, durationMinutes: 10 },
    { level: 8, sb: 400, bb: 800, ante: 100, durationMinutes: 10 },
    { level: 9, sb: 500, bb: 1000, ante: 200, durationMinutes: 10 },
    { level: 10, sb: 750, bb: 1500, ante: 300, durationMinutes: 10 },
    { level: 11, sb: 1000, bb: 2000, ante: 400, durationMinutes: 10 },
    { level: 12, sb: 1500, bb: 3000, ante: 500, durationMinutes: 10 },
  ],
  STANDARD_20MIN: [
    { level: 1, sb: 25, bb: 50, ante: 0, durationMinutes: 20 },
    { level: 2, sb: 50, bb: 100, ante: 0, durationMinutes: 20 },
    { level: 3, sb: 75, bb: 150, ante: 0, durationMinutes: 20 },
    { level: 4, sb: 100, bb: 200, ante: 25, durationMinutes: 20 },
    { level: 5, sb: 150, bb: 300, ante: 50, durationMinutes: 20 },
    { level: 6, sb: 200, bb: 400, ante: 75, durationMinutes: 20 },
    { level: 7, sb: 300, bb: 600, ante: 100, durationMinutes: 20 },
    { level: 8, sb: 400, bb: 800, ante: 100, durationMinutes: 20 },
    { level: 9, sb: 500, bb: 1000, ante: 200, durationMinutes: 20 },
    { level: 10, sb: 750, bb: 1500, ante: 300, durationMinutes: 20 },
    { level: 11, sb: 1000, bb: 2000, ante: 400, durationMinutes: 20 },
    { level: 12, sb: 1500, bb: 3000, ante: 500, durationMinutes: 20 },
    { level: 13, sb: 2000, bb: 4000, ante: 500, durationMinutes: 20 },
    { level: 14, sb: 3000, bb: 6000, ante: 1000, durationMinutes: 20 },
    { level: 15, sb: 5000, bb: 10000, ante: 1000, durationMinutes: 20 },
  ],
  DEEP_STACK_30MIN: [
    { level: 1, sb: 25, bb: 50, ante: 0, durationMinutes: 30 },
    { level: 2, sb: 50, bb: 100, ante: 0, durationMinutes: 30 },
    { level: 3, sb: 75, bb: 150, ante: 0, durationMinutes: 30 },
    { level: 4, sb: 100, bb: 200, ante: 0, durationMinutes: 30 },
    { level: 5, sb: 100, bb: 200, ante: 25, durationMinutes: 30 },
    { level: 6, sb: 150, bb: 300, ante: 50, durationMinutes: 30 },
    { level: 7, sb: 200, bb: 400, ante: 75, durationMinutes: 30 },
    { level: 8, sb: 300, bb: 600, ante: 100, durationMinutes: 30 },
    { level: 9, sb: 400, bb: 800, ante: 100, durationMinutes: 30 },
    { level: 10, sb: 500, bb: 1000, ante: 200, durationMinutes: 30 },
    { level: 11, sb: 750, bb: 1500, ante: 300, durationMinutes: 30 },
    { level: 12, sb: 1000, bb: 2000, ante: 400, durationMinutes: 30 },
    { level: 13, sb: 1500, bb: 3000, ante: 500, durationMinutes: 30 },
    { level: 14, sb: 2000, bb: 4000, ante: 500, durationMinutes: 30 },
    { level: 15, sb: 3000, bb: 6000, ante: 1000, durationMinutes: 30 },
  ],
};

export const BLIND_SCHEDULE_KEYS = Object.keys(BLIND_SCHEDULES);

export const BLIND_SCHEDULE_LABELS = {
  TURBO_10MIN: 'Turbo (10 min)',
  STANDARD_20MIN: 'Standard (20 min)',
  DEEP_STACK_30MIN: 'Deep Stack (30 min)',
};

// =============================================================================
// TOURNAMENT FORMATS
// =============================================================================

export const TOURNAMENT_FORMATS = {
  FREEZEOUT: { label: 'Freezeout', allowRebuys: false },
  REBUY: { label: 'Rebuy', allowRebuys: true },
  BOUNTY: { label: 'Bounty', allowRebuys: false },
};

export const TOURNAMENT_FORMAT_KEYS = Object.keys(TOURNAMENT_FORMATS);

// =============================================================================
// TOURNAMENT ACTION TYPES
// =============================================================================

export const TOURNAMENT_ACTIONS = {
  INIT_TOURNAMENT: 'INIT_TOURNAMENT',
  SET_BLIND_LEVEL: 'SET_BLIND_LEVEL',
  ADVANCE_BLIND_LEVEL: 'ADVANCE_BLIND_LEVEL',
  PAUSE_TIMER: 'PAUSE_TIMER',
  RESUME_TIMER: 'RESUME_TIMER',
  UPDATE_CHIP_STACK: 'UPDATE_CHIP_STACK',
  RECORD_ELIMINATION: 'RECORD_ELIMINATION',
  SET_PLAYERS_REMAINING: 'SET_PLAYERS_REMAINING',
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  RESET_TOURNAMENT: 'RESET_TOURNAMENT',
  HYDRATE_TOURNAMENT: 'HYDRATE_TOURNAMENT',
};

// =============================================================================
// M-RATIO ZONES (for color coding)
// =============================================================================

export const M_RATIO_ZONES = {
  GREEN: { min: 20, color: TOURNAMENT_M_RATIO.green, label: 'Comfortable' },
  YELLOW: { min: 10, color: TOURNAMENT_M_RATIO.yellow, label: 'Caution' },
  ORANGE: { min: 6, color: TOURNAMENT_M_RATIO.orange, label: 'Danger' },
  RED: { min: 0, color: TOURNAMENT_M_RATIO.red, label: 'Critical' },
};

/**
 * Get M-ratio zone for a given M value
 * M = stack / (sb + bb + ante * numPlayers)
 */
export const getMRatioZone = (mRatio) => {
  if (mRatio >= M_RATIO_ZONES.GREEN.min) return M_RATIO_ZONES.GREEN;
  if (mRatio >= M_RATIO_ZONES.YELLOW.min) return M_RATIO_ZONES.YELLOW;
  if (mRatio >= M_RATIO_ZONES.ORANGE.min) return M_RATIO_ZONES.ORANGE;
  return M_RATIO_ZONES.RED;
};
