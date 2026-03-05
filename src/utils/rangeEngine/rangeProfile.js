/**
 * rangeProfile.js - Range profile schema, creation, and serialization
 *
 * A range profile stores per-position, per-action frequency counts
 * and 169-cell hand weight grids for Bayesian range estimation.
 */

const GRID_SIZE = 169;

/** Bump when profile schema changes to invalidate cached profiles */
export const PROFILE_VERSION = 2;

export const RANGE_ACTIONS = ['fold', 'limp', 'open', 'coldCall', 'threeBet'];
export const RANGE_POSITIONS = ['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB'];

/**
 * Create an empty range profile for a player.
 * @param {number|string} playerId
 * @param {string} userId
 * @returns {Object} Empty range profile
 */
export const createEmptyProfile = (playerId, userId) => {
  const actionCounts = {};
  const opportunities = {};
  const ranges = {};

  const subActionCounts = {};

  for (const pos of RANGE_POSITIONS) {
    actionCounts[pos] = {};
    for (const action of RANGE_ACTIONS) {
      actionCounts[pos][action] = 0;
    }
    opportunities[pos] = { noRaiseFaced: 0, facedRaise: 0, total: 0 };
    ranges[pos] = {};
    for (const action of RANGE_ACTIONS) {
      ranges[pos][action] = new Float64Array(GRID_SIZE);
    }
    subActionCounts[pos] = { limpFold: 0, limpCall: 0, limpRaise: 0, limpNoRaise: 0 };
  }

  return {
    playerId,
    userId,
    profileKey: `${userId}_${playerId}`,
    lastUpdatedAt: Date.now(),
    handsProcessed: 0,
    actionCounts,
    opportunities,
    ranges,
    showdownAnchors: [],
    subActionCounts,
    traits: null,
    profileVersion: PROFILE_VERSION,
  };
};

/**
 * Serialize a profile for IndexedDB storage.
 * Converts Float64Array ranges to plain arrays.
 * @param {Object} profile
 * @returns {Object} Serializable plain object
 */
export const serializeProfile = (profile) => {
  const serializedRanges = {};
  for (const pos of RANGE_POSITIONS) {
    serializedRanges[pos] = {};
    for (const action of RANGE_ACTIONS) {
      serializedRanges[pos][action] = Array.from(profile.ranges[pos][action]);
    }
  }

  return {
    ...profile,
    ranges: serializedRanges,
  };
};

/**
 * Deserialize a profile from IndexedDB storage.
 * Converts plain arrays back to Float64Array.
 * @param {Object} record
 * @returns {Object} Profile with Float64Array ranges
 */
export const deserializeProfile = (record) => {
  const ranges = {};
  for (const pos of RANGE_POSITIONS) {
    ranges[pos] = {};
    for (const action of RANGE_ACTIONS) {
      ranges[pos][action] = new Float64Array(record.ranges[pos][action]);
    }
  }

  return {
    ...record,
    ranges,
  };
};
