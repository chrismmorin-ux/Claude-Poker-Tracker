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
 *
 * NOT v5, deliberately (WS-337). The equity operator's rotation-plane basis reproduces every
 * class-vs-class equity to ~1pp mean with 26 coordinates, which raises the question of storing
 * those coordinates on the profile instead of estimating 169 cells from tens of observations.
 * They are a DERIVED VIEW for now — `pokerCore/equitySkew.js#projectOntoPlanes` — and the
 * 169-cell grid stays the record. Two reasons: the mean error hides a 16pp max, and the
 * estimation claim itself (log-loss in the low-dimensional basis vs the shipped ladder, on
 * corpus data, under POOL/EVAL *and* walk-forward) has not been run. A stored coordinate would
 * commit a schema to an answer nobody has measured. Revisit only after that score exists.
 */
/**
 * v5 (WS-521 / WS-270): the facing-3-bet tree. Adds the `call4` and `fourBet`
 * parents, the `cold4Bet` / `fourBetAfterOpen` subclasses, and a third
 * opportunity counter. v4 profiles deserialize cleanly — the new grids are
 * created empty and the new counters start at 0, which is exactly the state a
 * player with no observed 4-bet decisions should be in.
 */
export const PROFILE_VERSION = 5;

/**
 * Retained parent aggregates. These keep their pre-taxonomy semantics exactly —
 * every existing consumer reads these and is unaffected by the subclass split.
 *
 * `call4` / `fourBet` are the third tree's parents. They are NOT subclasses of
 * `threeBet`: a seat facing a 3-bet chooses among fold / call4 / fourBet, and
 * only a scenario can carry that normalization (POKER_THEORY §2.5).
 */
export const RANGE_PARENT_ACTIONS = [
  'fold', 'limp', 'open', 'coldCall', 'threeBet', 'call4', 'fourBet',
];

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
  'cold4Bet',
  'fourBetAfterOpen',
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
    opportunities[pos] = {
      noRaiseFaced: 0, facedRaise: 0, faced3Bet: 0, total: 0, showdownsSeen: 0,
      // WS-521 follow-up: the facing-3-bet tree split by PRIOR ROLE. `faced3Bet`
      // stays the total (nothing downstream of it moves); these are its parts,
      // and they exist because the measured prior only describes `opener`.
      faced3BetByRole: { opener: 0, cold: 0, passive: 0 },
    };
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
