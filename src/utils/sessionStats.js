/**
 * sessionStats.js - Session-scoped stat calculations
 *
 * Reuses buildPlayerStats + derivePercentages from tendencyCalculations.
 * Computes per-seat stats for a single session's hands.
 */

import { buildPlayerStats, derivePercentages, findPlayerSeat, classifyStyle } from './tendencyCalculations';
import { buildTimeline, getStreetTimeline } from './handTimeline';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

/**
 * Count preflop limps for a player across hands.
 * A limp = preflop CALL that is NOT facing a prior raise (only blinds before it).
 * @param {number|string} playerId
 * @param {Object[]} hands
 * @returns {{ limpCount: number, limpOpportunities: number }}
 */
export const countLimps = (playerId, hands) => {
  let limpCount = 0;
  let limpOpportunities = 0;

  for (const hand of hands) {
    const seat = findPlayerSeat(playerId, hand);
    if (!seat) continue;

    const tl = buildTimeline(hand);
    const preflopActions = getStreetTimeline(tl, 'preflop');

    // Check if player had any preflop actions
    const playerActions = preflopActions.filter(e => e.seat === seat);
    if (playerActions.length === 0) continue;

    // Check if there was a raise before the player's first action
    const playerFirstIdx = preflopActions.findIndex(e => e.seat === seat);
    const actionsBeforePlayer = preflopActions.slice(0, playerFirstIdx);
    const facedRaise = actionsBeforePlayer.some(e => e.action === PRIMITIVE_ACTIONS.RAISE);

    // If no raise before player, they had a limp opportunity
    if (!facedRaise) {
      limpOpportunities++;
      // Did they call (limp) rather than raise?
      const firstAction = playerActions[0];
      if (firstAction.action === PRIMITIVE_ACTIONS.CALL) {
        limpCount++;
      }
    }
  }

  return { limpCount, limpOpportunities };
};

/**
 * Build per-seat stats for a session's hands.
 * @param {Object[]} hands - Hands already filtered by session
 * @param {Object} seatPlayers - { [seat]: playerId } map
 * @returns {Object} { [seat]: { vpip, pfr, af, threeBet, cbet, sampleSize, style, limpPct, handCount } }
 */
export const buildSessionStats = (hands, seatPlayers) => {
  if (!hands || hands.length === 0 || !seatPlayers) return {};

  const result = {};

  for (const [seat, playerId] of Object.entries(seatPlayers)) {
    if (!playerId) continue;

    const stats = buildPlayerStats(playerId, hands);
    const pct = derivePercentages(stats);

    // Count limps
    const { limpCount, limpOpportunities } = countLimps(playerId, hands);
    const limpPct = limpOpportunities > 0
      ? Math.round((limpCount / limpOpportunities) * 100)
      : null;

    result[seat] = {
      ...pct,
      limpPct,
      style: classifyStyle(pct),
      handCount: stats.handsSeenPreflop,
    };
  }

  return result;
};
