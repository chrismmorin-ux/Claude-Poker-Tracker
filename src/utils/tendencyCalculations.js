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
  findLastRaiser,
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
 * Also tracks whether the player folded when facing a raise (fold to 3-bet).
 * @param {string} seat
 * @param {Array} timeline
 * @returns {{ facedRaise: boolean, threeBet: boolean, foldedTo3Bet: boolean } | null}
 */
const extract3BetStats = (seat, timeline) => {
  const preflopActions = getStreetTimeline(timeline, 'preflop')
    .filter(e => e.seat === seat);

  if (preflopActions.length === 0) return null;

  const facedRaise = didPlayerFaceRaise(timeline, seat, 'preflop');
  if (!facedRaise) return { facedRaise: false, threeBet: false, foldedTo3Bet: false };

  const threeBet = preflopActions.some(e => e.action === PRIMITIVE_ACTIONS.RAISE);
  const foldedTo3Bet = !threeBet && preflopActions.some(e => e.action === PRIMITIVE_ACTIONS.FOLD);
  return { facedRaise: true, threeBet, foldedTo3Bet };
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

/**
 * Extract fold-to-cbet data from a single hand for a player.
 * "Faced c-bet" = preflop raiser bet the flop AND this player was in the hand on the flop.
 * "Folded to c-bet" = player folded on the flop facing that c-bet.
 * @param {string} seat
 * @param {Array} timeline
 * @returns {{ facedCbet: boolean, foldedToCbet: boolean } | null}
 */
const extractFoldToCbet = (seat, timeline) => {
  const s = String(seat);

  // Find the preflop aggressor
  const pfRaiser = findLastRaiser(timeline, 'preflop');
  if (!pfRaiser || pfRaiser === s) return null; // no cbet possible if we're the raiser

  // Check if preflop raiser bet the flop (= c-bet)
  const flopActions = getStreetTimeline(timeline, 'flop');
  const raiserBetFlop = flopActions.some(e => e.seat === pfRaiser && e.action === PRIMITIVE_ACTIONS.BET);
  if (!raiserBetFlop) return null; // no c-bet happened

  // Check if this player was in the hand on the flop
  const playerFlopActions = flopActions.filter(e => e.seat === s);
  if (playerFlopActions.length === 0) return null; // not in hand on flop

  // Player faced a c-bet. Did they fold?
  const foldedToCbet = playerFlopActions.some(e => e.action === PRIMITIVE_ACTIONS.FOLD);

  return { facedCbet: true, foldedToCbet };
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
  facedCbet: 0,
  foldedToCbet: 0,
  foldTo3BetCount: 0,
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

  // 3-bet and fold-to-3bet
  const threeBet = extract3BetStats(seat, timeline);
  if (threeBet) {
    if (threeBet.facedRaise) {
      stats.facedRaisePreflop++;
      if (threeBet.threeBet) stats.threeBetCount++;
      if (threeBet.foldedTo3Bet) stats.foldTo3BetCount++;
    }
  }

  // C-bet
  const cbet = extractCbetStats(seat, timeline);
  if (cbet.isPfAggressor && cbet.sawFlop) {
    stats.pfAggressorFlops++;
    if (cbet.cbet) stats.cbetCount++;
  }

  // Fold to c-bet
  const ftc = extractFoldToCbet(seat, timeline);
  if (ftc) {
    stats.facedCbet++;
    if (ftc.foldedToCbet) stats.foldedToCbet++;
  }

  stats.lastCalculatedHandId = hand.handId ?? null;
};


// =============================================================================
// DERIVED PERCENTAGES
// =============================================================================

/**
 * Derive display percentages from running totals.
 * @param {Object} stats - Stats with running totals
 * @returns {Object} Display values with percentages and sample size
 */
// =============================================================================
// STYLE CLASSIFICATION
// =============================================================================

const MIN_STYLE_SAMPLE = 20;

/**
 * Classify player style from derived percentages.
 * @param {{ vpip: number|null, pfr: number|null, af: number|null, sampleSize: number }} pct
 * @returns {string|null} Style label or null if insufficient data
 */
export const classifyStyle = (pct) => {
  if (!pct || pct.sampleSize < MIN_STYLE_SAMPLE) return null;

  const { vpip, pfr, af } = pct;
  if (vpip === null || pfr === null) return null;

  // Order matters: most specific first
  if (vpip > 40) return 'Fish';
  if (vpip > 30 && pfr > 20) return 'LAG';
  if (vpip > 30 && pfr < 10) return 'LP';
  if (vpip < 15 && pfr < 10) return 'Nit';
  if (vpip >= 20 && vpip <= 30 && pfr >= 15 && pfr <= 25 && af !== null && af > 1.5) return 'Reg';
  if (vpip >= 15 && vpip <= 30 && pfr >= 10 && pfr <= 25) return 'TAG';

  return 'Unknown';
};

// =============================================================================
// DERIVED PERCENTAGES
// =============================================================================

export const derivePercentages = (stats) => {
  if (!stats) return { vpip: null, pfr: null, af: null, threeBet: null, cbet: null, foldToCbet: null, foldTo3Bet: null, sampleSize: 0 };

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

  const foldToCbet = stats.facedCbet > 0
    ? Math.round((stats.foldedToCbet / stats.facedCbet) * 100)
    : null;

  const foldTo3Bet = stats.facedRaisePreflop > 0
    ? Math.round((stats.foldTo3BetCount / stats.facedRaisePreflop) * 100)
    : null;

  return { vpip, pfr, af, threeBet, cbet, foldToCbet, foldTo3Bet, sampleSize };
};
