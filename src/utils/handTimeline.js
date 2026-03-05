/**
 * handTimeline.js - Ordered action timeline for hand analysis
 *
 * Builds a normalized, ordered view of all actions in a hand.
 * Uses actionSequence when available (precise), falls back to
 * seatActions with positional ordering (approximate for old data).
 *
 * This is the shared abstraction consumed by the stat engine
 * and the future range engine.
 */

import { isPrimitiveAction, toPrimitive } from '../constants/primitiveActions';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

const NUM_SEATS = 9;
const BETTING_STREETS = ['preflop', 'flop', 'turn', 'river'];

// =============================================================================
// TIMELINE BUILDING
// =============================================================================

/**
 * Normalize an action string to its primitive form.
 * @param {string} action
 * @returns {string|null}
 */
const normalizeToPrimitive = (action) => {
  if (isPrimitiveAction(action)) return action;
  return toPrimitive(action);
};

/**
 * Build an ordered timeline from a hand record.
 * Uses actionSequence if available; falls back to seatActions.
 *
 * @param {Object} hand - Hand record from DB
 * @returns {Array<{order: number, seat: string, action: string, street: string}>}
 */
export const buildTimeline = (hand) => {
  const actionSequence = hand.gameState?.actionSequence;

  if (Array.isArray(actionSequence) && actionSequence.length > 0) {
    return buildFromActionSequence(actionSequence);
  }

  const seatActions = hand.gameState?.seatActions || hand.seatActions || {};
  const dealerSeat = hand.gameState?.dealerButtonSeat ?? 1;
  return buildFromSeatActions(seatActions, dealerSeat);
};

/**
 * Build timeline from actionSequence (precise ordering).
 * @param {Array} actionSequence
 * @returns {Array}
 */
const buildFromActionSequence = (actionSequence) => {
  const timeline = [];

  for (const entry of actionSequence) {
    const action = normalizeToPrimitive(entry.action);
    if (!action) continue;

    timeline.push({
      order: entry.order,
      seat: String(entry.seat),
      action,
      street: entry.street,
    });
  }

  return timeline.sort((a, b) => a.order - b.order);
};

/**
 * Get seats in positional order starting after the dealer button.
 * Preflop: UTG (dealer+3) acts first, BB (dealer+2) acts last.
 * Postflop: SB (dealer+1) acts first, dealer acts last.
 *
 * @param {number} dealerSeat - Dealer button seat (1-9)
 * @param {string} street - 'preflop' or postflop street
 * @returns {number[]} Seats in acting order
 */
const getPositionalOrder = (dealerSeat, street) => {
  const seats = [];
  for (let i = 1; i <= NUM_SEATS; i++) {
    seats.push(((dealerSeat - 1 + i) % NUM_SEATS) + 1);
  }

  if (street === 'preflop') {
    // Preflop: SB, BB go to end (they act last unless they raise)
    // seats is [SB, BB, UTG, UTG+1, ..., BTN] — rotate SB, BB to end
    const sb = seats.shift();
    const bb = seats.shift();
    seats.push(sb, bb);
  }

  return seats;
};

/**
 * Build timeline from seatActions (approximate positional ordering).
 * For old hands without actionSequence.
 *
 * Strategy: within each street, iterate seats in positional order.
 * For each seat, emit their actions in recorded order.
 * This is approximate — we can't know exact inter-seat ordering,
 * but positional order is a reasonable default.
 *
 * @param {Object} seatActions - { [street]: { [seat]: string[] } }
 * @param {number} dealerSeat
 * @returns {Array}
 */
const buildFromSeatActions = (seatActions, dealerSeat) => {
  const timeline = [];
  let order = 1;

  for (const street of BETTING_STREETS) {
    const streetData = seatActions[street];
    if (!streetData) continue;

    const seatOrder = getPositionalOrder(dealerSeat, street);

    for (const seat of seatOrder) {
      const seatKey = String(seat);
      const actions = streetData[seatKey];
      if (!Array.isArray(actions)) continue;

      for (const rawAction of actions) {
        const action = normalizeToPrimitive(rawAction);
        if (!action) continue;

        timeline.push({ order: order++, seat: seatKey, action, street });
      }
    }
  }

  return timeline;
};

// =============================================================================
// TIMELINE QUERIES
// =============================================================================

/**
 * Get a specific player's actions from a timeline.
 * @param {Array} timeline
 * @param {string} seat
 * @returns {Array}
 */
export const getPlayerTimeline = (timeline, seat) => {
  const s = String(seat);
  return timeline.filter(e => e.seat === s);
};

/**
 * Get all actions on a specific street.
 * @param {Array} timeline
 * @param {string} street
 * @returns {Array}
 */
export const getStreetTimeline = (timeline, street) => {
  return timeline.filter(e => e.street === street);
};

/**
 * Check if a player faced a raise on a given street.
 * "Faced a raise" = another seat recorded a raise BEFORE this player's
 * first action on that street (or before their raise, if they raised).
 *
 * @param {Array} timeline - Full hand timeline
 * @param {string} seat - The player's seat
 * @param {string} street - Street to check
 * @returns {boolean}
 */
export const didPlayerFaceRaise = (timeline, seat, street) => {
  const s = String(seat);
  const streetActions = getStreetTimeline(timeline, street);

  // Find the first action by this player on this street
  const playerFirstAction = streetActions.find(e => e.seat === s);
  if (!playerFirstAction) return false;

  // Check if any other seat raised before this player's first action
  for (const entry of streetActions) {
    if (entry.order >= playerFirstAction.order) break;
    if (entry.seat !== s && entry.action === PRIMITIVE_ACTIONS.RAISE) {
      return true;
    }
  }

  return false;
};

/**
 * Find the last player to raise on a given street.
 * Used for identifying the preflop aggressor (for C-bet detection).
 *
 * @param {Array} timeline
 * @param {string} street
 * @returns {string|null} Seat number as string, or null if no raises
 */
export const findLastRaiser = (timeline, street) => {
  const streetActions = getStreetTimeline(timeline, street);
  let lastRaiserSeat = null;

  for (const entry of streetActions) {
    if (entry.action === PRIMITIVE_ACTIONS.RAISE) {
      lastRaiserSeat = entry.seat;
    }
  }

  return lastRaiserSeat;
};

/**
 * Check if a player continuation bet.
 * C-bet = player was the last preflop raiser AND bet the flop.
 *
 * @param {Array} timeline
 * @param {string} seat
 * @returns {{ isPfAggressor: boolean, sawFlop: boolean, cbet: boolean }}
 */
export const getCbetInfo = (timeline, seat) => {
  const s = String(seat);
  const lastPfRaiser = findLastRaiser(timeline, 'preflop');
  const isPfAggressor = lastPfRaiser === s;

  if (!isPfAggressor) {
    return { isPfAggressor: false, sawFlop: false, cbet: false };
  }

  const flopActions = getStreetTimeline(timeline, 'flop');
  const playerFlopActions = flopActions.filter(e => e.seat === s);
  const sawFlop = playerFlopActions.length > 0;
  const cbet = playerFlopActions.some(e => e.action === PRIMITIVE_ACTIONS.BET);

  return { isPfAggressor: true, sawFlop, cbet };
};
