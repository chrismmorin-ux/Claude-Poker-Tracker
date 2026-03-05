/**
 * tendencyCalculations.js - Player tendency stat calculations
 *
 * Calculates VPIP, PFR, AF, 3-bet%, and C-bet% from hand history.
 * Internally uses the Hand Timeline abstraction for ordered action analysis.
 *
 * Public API:
 *   buildPlayerStats(playerId, hands) - Full calculation from history
 *   updatePlayerStats(existingStats, playerId, hand) - Incremental update
 *   derivePercentages(stats) - Running totals -> display values
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';
import {
  buildTimeline,
  getPlayerTimeline,
  getStreetTimeline,
  didPlayerFaceRaise,
  getCbetInfo,
} from './handTimeline';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Find which seat a player occupied in a hand.
 * @param {number|string} playerId
 * @param {Object} hand - Hand record from DB
 * @returns {string|null} Seat number as string, or null if not found
 */
export const findPlayerSeat = (playerId, hand) => {
  const seatPlayers = hand.seatPlayers;
  if (!seatPlayers) return null;

  const pid = String(playerId);
  for (const [seat, id] of Object.entries(seatPlayers)) {
    if (String(id) === pid) return seat;
  }
  return null;
};

// =============================================================================
// STAT EXTRACTION (per-hand, using timeline)
// =============================================================================

/**
 * Extract VPIP/PFR data from a single hand for a player.
 * @param {number|string} playerId
 * @param {Object} hand
 * @param {Array} [timeline] - Pre-built timeline (built if not provided)
 * @returns {{ inHand: boolean, vpip: boolean, pfr: boolean } | null}
 */
export const extractPreflopStats = (playerId, hand, timeline) => {
  const seat = findPlayerSeat(playerId, hand);
  if (!seat) return null;

  const tl = timeline || buildTimeline(hand);
  const preflopActions = getStreetTimeline(tl, 'preflop')
    .filter(e => e.seat === seat);

  if (preflopActions.length === 0) return null;

  const vpip = preflopActions.some(e =>
    e.action === PRIMITIVE_ACTIONS.CALL ||
    e.action === PRIMITIVE_ACTIONS.BET ||
    e.action === PRIMITIVE_ACTIONS.RAISE
  );

  const pfr = preflopActions.some(e => e.action === PRIMITIVE_ACTIONS.RAISE);

  return { inHand: true, vpip, pfr };
};

/**
 * Extract postflop aggression data from a single hand for a player.
 * Counts bets, raises, and calls across flop/turn/river.
 * @param {number|string} playerId
 * @param {Object} hand
 * @param {Array} [timeline] - Pre-built timeline (built if not provided)
 * @returns {{ bets: number, raises: number, calls: number } | null}
 */
export const extractPostflopAggression = (playerId, hand, timeline) => {
  const seat = findPlayerSeat(playerId, hand);
  if (!seat) return null;

  const tl = timeline || buildTimeline(hand);
  let bets = 0, raises = 0, calls = 0;

  for (const street of ['flop', 'turn', 'river']) {
    const actions = getStreetTimeline(tl, street).filter(e => e.seat === seat);
    for (const e of actions) {
      if (e.action === PRIMITIVE_ACTIONS.BET) bets++;
      else if (e.action === PRIMITIVE_ACTIONS.RAISE) raises++;
      else if (e.action === PRIMITIVE_ACTIONS.CALL) calls++;
    }
  }

  if (bets === 0 && raises === 0 && calls === 0) return null;
  return { bets, raises, calls };
};

/**
 * Extract 3-bet data from a single hand for a player.
 * @param {string} seat
 * @param {Array} timeline
 * @returns {{ facedRaise: boolean, threeBet: boolean } | null}
 */
const extract3BetStats = (seat, timeline) => {
  const preflopActions = getStreetTimeline(timeline, 'preflop')
    .filter(e => e.seat === seat);

  if (preflopActions.length === 0) return null;

  const facedRaise = didPlayerFaceRaise(timeline, seat, 'preflop');
  if (!facedRaise) return { facedRaise: false, threeBet: false };

  const threeBet = preflopActions.some(e => e.action === PRIMITIVE_ACTIONS.RAISE);
  return { facedRaise: true, threeBet };
};

/**
 * Extract C-bet data from a single hand for a player.
 * @param {string} seat
 * @param {Array} timeline
 * @returns {{ isPfAggressor: boolean, sawFlop: boolean, cbet: boolean }}
 */
const extractCbetStats = (seat, timeline) => {
  return getCbetInfo(timeline, seat);
};

// =============================================================================
// STATS BUILDING
// =============================================================================

/**
 * Create an empty stats object.
 * @returns {Object}
 */
export const createEmptyStats = () => ({
  handsSeenPreflop: 0,
  vpipCount: 0,
  pfrCount: 0,
  totalBets: 0,
  totalRaises: 0,
  totalCalls: 0,
  facedRaisePreflop: 0,
  threeBetCount: 0,
  pfAggressorFlops: 0,
  cbetCount: 0,
  lastCalculatedHandId: null,
});

/**
 * Build running totals from a set of hands for a player.
 * @param {number|string} playerId
 * @param {Object[]} hands - Array of hand records
 * @returns {Object} Stats object with running totals
 */
export const buildPlayerStats = (playerId, hands) => {
  const stats = createEmptyStats();

  for (const hand of hands) {
    accumulateHand(stats, playerId, hand);
  }

  return stats;
};

/**
 * Accumulate a single hand's data into existing stats (mutates stats).
 * @param {Object} stats - Stats object to update
 * @param {number|string} playerId
 * @param {Object} hand
 */
const accumulateHand = (stats, playerId, hand) => {
  const seat = findPlayerSeat(playerId, hand);
  if (!seat) {
    stats.lastCalculatedHandId = hand.handId ?? null;
    return;
  }

  // Build timeline once, share across all extractors
  const timeline = buildTimeline(hand);

  // VPIP / PFR
  const preflop = extractPreflopStats(playerId, hand, timeline);
  if (preflop) {
    stats.handsSeenPreflop++;
    if (preflop.vpip) stats.vpipCount++;
    if (preflop.pfr) stats.pfrCount++;
  }

  // Postflop aggression (AF)
  const aggression = extractPostflopAggression(playerId, hand, timeline);
  if (aggression) {
    stats.totalBets += aggression.bets;
    stats.totalRaises += aggression.raises;
    stats.totalCalls += aggression.calls;
  }

  // 3-bet
  const threeBet = extract3BetStats(seat, timeline);
  if (threeBet) {
    if (threeBet.facedRaise) {
      stats.facedRaisePreflop++;
      if (threeBet.threeBet) stats.threeBetCount++;
    }
  }

  // C-bet
  const cbet = extractCbetStats(seat, timeline);
  if (cbet.isPfAggressor && cbet.sawFlop) {
    stats.pfAggressorFlops++;
    if (cbet.cbet) stats.cbetCount++;
  }

  stats.lastCalculatedHandId = hand.handId ?? null;
};

/**
 * Update existing stats with a single new hand (incremental).
 * Returns a new stats object (does not mutate).
 * @param {Object} existingStats
 * @param {number|string} playerId
 * @param {Object} hand
 * @returns {Object} Updated stats
 */
export const updatePlayerStats = (existingStats, playerId, hand) => {
  const stats = { ...existingStats };
  accumulateHand(stats, playerId, hand);
  return stats;
};

// =============================================================================
// DERIVED PERCENTAGES
// =============================================================================

/**
 * Derive display percentages from running totals.
 * @param {Object} stats - Stats with running totals
 * @returns {Object} Display values with percentages and sample size
 */
export const derivePercentages = (stats) => {
  if (!stats) return { vpip: null, pfr: null, af: null, threeBet: null, cbet: null, sampleSize: 0 };

  const sampleSize = stats.handsSeenPreflop;

  const vpip = sampleSize > 0
    ? Math.round((stats.vpipCount / sampleSize) * 100)
    : null;

  const pfr = sampleSize > 0
    ? Math.round((stats.pfrCount / sampleSize) * 100)
    : null;

  const totalAggressive = stats.totalBets + stats.totalRaises;
  const af = stats.totalCalls > 0
    ? Math.round((totalAggressive / stats.totalCalls) * 10) / 10
    : totalAggressive > 0 ? Infinity : null;

  const threeBet = stats.facedRaisePreflop > 0
    ? Math.round((stats.threeBetCount / stats.facedRaisePreflop) * 100)
    : null;

  const cbet = stats.pfAggressorFlops > 0
    ? Math.round((stats.cbetCount / stats.pfAggressorFlops) * 100)
    : null;

  return { vpip, pfr, af, threeBet, cbet, sampleSize };
};
