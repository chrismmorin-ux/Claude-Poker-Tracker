/**
 * actionExtractor.js - Extract preflop actions from hand history
 *
 * Iterates hands and classifies each player's preflop decisions
 * with position context for range engine consumption.
 *
 * Classification itself lives in `lineTaxonomy.js` (POKER_THEORY §2.5 /
 * DEC-025) — this module owns seat resolution, position, showdown extraction
 * and the no-action fallback, not the taxonomy.
 */

import { buildTimeline, getStreetTimeline } from '../handAnalysis';
import { getRangePositionCategory } from '../positionUtils';
import { findPlayerSeat } from '../tendencyCalculations';
import { ACTIONS } from '../../constants/gameConstants';
import { parseCard } from '../pokerCore/cardParser';
import { rangeIndex } from '../pokerCore/rangeMatrix';
import { derivePreflopDecisions } from './lineTaxonomy';

/**
 * Resolve the seat's showdown hand index, if the hand recorded one.
 * @returns {number|null} 0-168 grid index
 */
const extractShowdownIndex = (hand, seat) => {
  const allPlayerCards = hand.cardState?.allPlayerCards;
  if (!allPlayerCards || !allPlayerCards[seat]) return null;

  const cards = allPlayerCards[seat];
  if (!Array.isArray(cards) || cards.length !== 2 || !cards[0] || !cards[1]) return null;

  const c1 = parseCard(cards[0]);
  const c2 = parseCard(cards[1]);
  if (!c1 || !c2) return null;

  return rangeIndex(c1.rank, c2.rank, c1.suit === c2.suit);
};

/**
 * Determine showdown outcome ('won' | 'lost' | null) for a seat.
 */
const extractShowdownOutcome = (hand, seat, showdownIndex) => {
  if (showdownIndex === null) return null;

  const actionSeq = hand.gameState?.actionSequence;
  if (!Array.isArray(actionSeq)) return null;

  const seatWon = actionSeq.some(
    e => String(e.seat) === String(seat) && e.action === ACTIONS.WON
  );
  return seatWon ? 'won' : 'lost';
};

/**
 * Extract EVERY preflop decision a player made in one hand.
 *
 * One hand can yield several decision points (POKER_THEORY §2.5.4): a seat that
 * limps and later re-raises made two decisions in two different game states,
 * and both are returned — `limp` and `limpReraise`.
 *
 * Each record carries:
 *   rangeAction  — the retained PARENT class (fold/limp/open/coldCall/threeBet).
 *                  Unchanged from the pre-taxonomy meaning.
 *   subAction    — the derived subclass, or null when none applies (e.g. the
 *                  unmodelled 4-bet tree, WS-270).
 *   isPrimaryDecision — true for the seat's first voluntary decision. Per-hand
 *                  counters (showdownsSeen) must gate on this so a limp-reraise
 *                  hand is not counted twice.
 *
 * `revealMechanism` is currently 'showdown' (when showdownIndex !== null) or null.
 * Reserved values per RANGE_ENGINE_DESIGN.md §4.5: 'showdown' | 'mucked-shown' |
 * 'all-in-runout' | 'inferred-from-fold'. The current extractor cannot
 * distinguish voluntary showdown from mucked-shown / all-in-runout / inference;
 * default to 'showdown' as the observability rail for FM-SEL-01.
 *
 * @param {number|string} playerId
 * @param {Object} hand - Hand record from DB
 * @returns {Array<Object>} zero or more decision records
 */
export const extractPreflopDecisions = (playerId, hand) => {
  const seat = findPlayerSeat(playerId, hand);
  if (!seat) return [];

  const dealerSeat = hand.gameState?.dealerButtonSeat;
  if (!dealerSeat) return [];

  const position = getRangePositionCategory(Number(seat), dealerSeat);
  const timeline = buildTimeline(hand);
  const preflopActions = getStreetTimeline(timeline, 'preflop');

  const showdownIndex = extractShowdownIndex(hand, seat);
  const showdownOutcome = extractShowdownOutcome(hand, seat, showdownIndex);
  const revealMechanism = showdownIndex !== null ? 'showdown' : null;

  // Player was in the hand but took no action — treat as fold (unchanged).
  const hasAnyAction = preflopActions.some(e => e.seat === seat);
  if (!hasAnyAction) {
    return [{
      position,
      rangeAction: 'fold',
      subAction: null,
      facedRaise: false,
      isPrimaryDecision: true,
      showdownIndex,
      showdownOutcome,
      revealMechanism,
    }];
  }

  const decisions = derivePreflopDecisions(preflopActions, seat);

  // A showdown reveal anchors EVERY range the hand legitimately appeared in —
  // a limp-reraised hand is genuinely in both the limp and limpReraise ranges
  // (mixing is real; rangeEngine/CLAUDE.md §2). Only the per-hand counter is
  // gated, via isPrimaryDecision.
  return decisions.map((d, i) => ({
    position,
    rangeAction: d.parentAction,
    subAction: d.subAction,
    facedRaise: d.facedRaise,
    isPrimaryDecision: i === 0,
    showdownIndex,
    showdownOutcome,
    revealMechanism,
  }));
};

/**
 * Extract a single player's PRIMARY preflop action from one hand.
 *
 * Back-compatible surface: returns the seat's first voluntary decision, which
 * is exactly what this function returned before the taxonomy landed, now with
 * an additional `subAction` field. Callers needing every decision point (the
 * range-engine pipeline) should use `extractPreflopDecisions`.
 *
 * @param {number|string} playerId
 * @param {Object} hand - Hand record from DB
 * @returns {Object|null}
 */
export const extractPreflopAction = (playerId, hand) =>
  extractPreflopDecisions(playerId, hand)[0] ?? null;

/**
 * Extract preflop decisions for a player across all hands.
 * @param {number|string} playerId
 * @param {Object[]} hands - Array of hand records
 * @returns {Array<Object>}
 */
export const extractAllActions = (playerId, hands) => {
  const results = [];
  for (const hand of hands) {
    results.push(...extractPreflopDecisions(playerId, hand));
  }
  return results;
};
