/**
 * rangeProfile.js - Range profile schema, creation, and serialization
 *
 * A range profile stores per-position, per-action frequency counts
 * and 169-cell hand weight grids for Bayesian range estimation.
 */

const GRID_SIZE = 169;

/**
 * Bump when profile schema changes to invalidate cached profiles.
 * Profiles are a DERIVED cache, rebuildable from hand history — the gate in
 * usePlayerTendencies (`cached.profileVersion === PROFILE_VERSION`) makes a
 * bump sufficient and a migration unnecessary (DEC-025).
 *
 * v4 (WS-256): derived line-taxonomy subclasses added.
 */
export const PROFILE_VERSION = 4;

/**
 * Retained parent aggregates. These keep their pre-taxonomy semantics exactly —
 * every existing consumer reads these and is unaffected by the subclass split.
 */
export const RANGE_PARENT_ACTIONS = ['fold', 'limp', 'open', 'coldCall', 'threeBet'];

/**
 * Derived subclasses (POKER_THEORY §2.5 / DEC-025). Each sums into one parent;
 * see `lineTaxonomy.js` SUBCLASS_PARENT for the mapping.
 */
export const RANGE_SUBCLASS_ACTIONS = [
  'openFirstIn',
  'isoRaise',
  'cold3Bet',
  'squeeze',
  'limpReraise',
];

export const RANGE_ACTIONS = [...RANGE_PARENT_ACTIONS, ...RANGE_SUBCLASS_ACTIONS];
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
    opportunities[pos] = { noRaiseFaced: 0, facedRaise: 0, total: 0, showdownsSeen: 0 };
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
      // Records written by an older PROFILE_VERSION lack the subclass keys.
      // `new Float64Array(undefined)` silently yields a LENGTH-0 array rather
      // than throwing, which would propagate a corrupt grid shape into every
      // consumer — getAllRangeProfiles has no version gate. Fall back to a
      // correctly-sized zero grid instead (DEC-025).
      const stored = record.ranges?.[pos]?.[action];
      ranges[pos][action] = Array.isArray(stored) || ArrayBuffer.isView(stored)
        ? new Float64Array(stored)
        : new Float64Array(GRID_SIZE);
    }
  }

  return {
    ...record,
    ranges,
  };
};
