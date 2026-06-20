/**
 * recordSeatAction.js — single funnel for recording betting actions.
 *
 * WS-182 (owner doctrine 2026-05-12, memory: feedback_action_dispatch_legality.md):
 * "A check being available when you haven't matched the bet should be impossible
 *  at the primitive level."
 *
 * The five primitive action LABELS (CHECK / BET / CALL / RAISE / FOLD) used to be
 * free-floating strings passed into RECORD_PRIMITIVE_ACTION. Any caller could
 * pair any string with any seat — including illegal pairings like SB CHECK
 * while owing the big blind.
 *
 * This module collapses the recording API to a single function with three
 * intent shapes. The LABEL becomes a DERIVED OUTPUT of intent + game state,
 * not a free-floating input.
 *
 *   intent: 'fold'              → emits FOLD
 *   intent: 'match'             → amountOwed=0 → CHECK
 *                                 amountOwed>0 → CALL (amount = owed)
 *   intent: { raiseTo: number } → currentBet=0 → BET (amount = raiseTo)
 *                                 currentBet>0 → RAISE (amount = raiseTo)
 *                                 raiseTo <= currentBet → THROW
 *
 * CHECK-while-owing is structurally unrepresentable: no caller passes the
 * 'check' string anymore. The only path to a CHECK label is intent='match'
 * on a seat with amountOwed=0.
 *
 * @see .claude/failures/RULES_INVARIANT_DISPATCH_BYPASS.md
 * @see system/invariants.md (INV-RULES-CONTRIBUTION)
 * @see memory: feedback_action_dispatch_legality.md
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { getCurrentBet, getSeatContributions, getMinRaise } from './potCalculator';

/**
 * Compute the effective current bet on a street, accounting for preflop
 * blinds. potCalculator.getCurrentBet returns 0 if no BET/RAISE/STRADDLE
 * has been entered, but on preflop the live "current bet" is at least the
 * big blind (which is a forced contribution).
 *
 * @param {Array} actionSequence
 * @param {string} street
 * @param {{ sb: number, bb: number }} blinds
 * @returns {number}
 */
const effectiveCurrentBet = (actionSequence, street, blinds) => {
  const recorded = getCurrentBet(actionSequence, street);
  if (street === 'preflop') {
    return Math.max(recorded, blinds?.bb ?? 0);
  }
  return recorded;
};

/**
 * Pure builder for a RECORD_PRIMITIVE_ACTION dispatch payload.
 *
 * The function does NOT dispatch — callers (the useGameHandlers hook, test
 * fixtures, analytics replay) are responsible for either dispatching the
 * returned action or consuming the payload directly.
 *
 * @param {object}  gameStateView
 * @param {Array}   gameStateView.actionSequence
 * @param {string}  gameStateView.currentStreet
 * @param {{sb:number, bb:number}} gameStateView.blinds
 * @param {number}  gameStateView.smallBlindSeat
 * @param {number}  gameStateView.bigBlindSeat
 * @param {number}  seat - integer seat number
 * @param {'fold' | 'match'
 *        | { raiseTo: number, allIn?: boolean }
 *        | { callAmount: number, allIn: true }
 *        | { match: true, allIn: true }} intent
 *   All-in intents:
 *     { raiseTo, allIn:true }   — a shove that raises (raiseTo > currentBet). A
 *                                 sub-min-raise shove is legal; reopensAction is
 *                                 derived (false when below a full raise).
 *     { callAmount, allIn:true }— a short/capped all-in CALL for less than the
 *                                 amount owed (otherwise unrepresentable).
 *     { match:true, allIn:true }— the seat's last chips exactly match the bet.
 * @returns {{ type: string, payload: { seat: number, action: string, amount?: number, allIn?: boolean, reopensAction?: boolean } }}
 *
 * @throws {TypeError}  Invalid arguments (non-integer seat, malformed intent,
 *                      raiseTo/callAmount not finite-positive-number, etc.)
 * @throws {RangeError} raiseTo <= effective currentBet (a raise must exceed it;
 *                      a capped all-in call must use { callAmount } instead)
 */
export const buildSeatActionPayload = (gameStateView, seat, intent) => {
  if (typeof seat !== 'number' || !Number.isInteger(seat)) {
    throw new TypeError(
      `buildSeatActionPayload: seat must be an integer, got ${typeof seat} (${seat})`
    );
  }
  if (!gameStateView || typeof gameStateView !== 'object') {
    throw new TypeError(
      'buildSeatActionPayload: gameStateView must be an object containing actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat'
    );
  }
  const { actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat } = gameStateView;

  // FOLD — always legal at the recording layer (the seat may be inactive,
  // but that's a pre-condition the caller must check; folding is never
  // "structurally impossible" for an active seat).
  if (intent === 'fold') {
    return {
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat, action: PRIMITIVE_ACTIONS.FOLD },
    };
  }

  // MATCH (string) — auto-resolves to CHECK or CALL based on amountOwed.
  // The object form { match: true, allIn: true } resolves identically but stamps
  // the resulting entry all-in (the seat's last chips exactly cover the bet).
  const isMatchAllIn = intent && typeof intent === 'object' && intent.match === true && intent.allIn === true;
  if (intent === 'match' || isMatchAllIn) {
    const contributions = getSeatContributions(
      actionSequence,
      currentStreet,
      blinds,
      smallBlindSeat,
      bigBlindSeat
    );
    const currentBet = effectiveCurrentBet(actionSequence, currentStreet, blinds);
    const alreadyIn = contributions[seat] ?? 0;
    const amountOwed = Math.max(0, currentBet - alreadyIn);

    if (amountOwed === 0) {
      return {
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat, action: PRIMITIVE_ACTIONS.CHECK, ...(isMatchAllIn ? { allIn: true } : {}) },
      };
    }
    return {
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat, action: PRIMITIVE_ACTIONS.CALL, amount: amountOwed, ...(isMatchAllIn ? { allIn: true } : {}) },
    };
  }

  // Short / capped all-in CALL — { callAmount, allIn: true }. The seat is all-in
  // for LESS than the amount owed; record the capped call directly. (A full call
  // uses 'match'; a call that exactly covers the bet uses { match, allIn }.)
  if (intent && typeof intent === 'object' && 'callAmount' in intent) {
    const { callAmount } = intent;
    if (typeof callAmount !== 'number' || !Number.isFinite(callAmount) || callAmount <= 0) {
      throw new TypeError(
        `buildSeatActionPayload: callAmount must be a positive finite number, got ${callAmount}`
      );
    }
    return {
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat, action: PRIMITIVE_ACTIONS.CALL, amount: callAmount, allIn: true },
    };
  }

  // RAISE / all-in shove — { raiseTo: number, allIn?: boolean }
  if (intent && typeof intent === 'object' && 'raiseTo' in intent) {
    const { raiseTo, allIn } = intent;
    if (typeof raiseTo !== 'number' || !Number.isFinite(raiseTo) || raiseTo <= 0) {
      throw new TypeError(
        `buildSeatActionPayload: raiseTo must be a positive finite number, got ${raiseTo}`
      );
    }
    const currentBet = effectiveCurrentBet(actionSequence, currentStreet, blinds);
    if (raiseTo <= currentBet) {
      throw new RangeError(
        `buildSeatActionPayload: raiseTo (${raiseTo}) must exceed effective currentBet (${currentBet}). ` +
        `For an all-in for less than the current bet, use { callAmount, allIn: true }.`
      );
    }
    const label = currentBet === 0 ? PRIMITIVE_ACTIONS.BET : PRIMITIVE_ACTIONS.RAISE;
    const payload = { seat, action: label, amount: raiseTo };
    if (allIn === true) {
      payload.allIn = true;
      // A shove below a full raise does not reopen betting for players who
      // already acted (incomplete-raise rule). currentBet === 0 (a bet) always
      // reopens, so reopensAction only matters for a true raise.
      if (currentBet > 0) {
        const minRaise = getMinRaise(actionSequence, currentStreet, blinds);
        if (raiseTo < minRaise) {
          payload.reopensAction = false;
        }
      }
    }
    return {
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload,
    };
  }

  throw new TypeError(
    `buildSeatActionPayload: unrecognized intent. Expected 'fold' | 'match' | ` +
    `{ raiseTo, allIn? } | { callAmount, allIn } | { match, allIn }, got ${JSON.stringify(intent)}`
  );
};

/**
 * Convenience helper used by React hooks. Builds the payload via
 * buildSeatActionPayload and immediately dispatches it.
 *
 * Hooks like useGameHandlers expose a closure that captures
 * gameStateView + dispatchGame and surfaces a `(seat, intent)` API to
 * components.
 *
 * @param {object} gameStateView - same as buildSeatActionPayload
 * @param {function} dispatchGame - reducer dispatch
 * @param {number} seat
 * @param {'fold' | 'match' | { raiseTo: number }} intent
 * @returns {object} the dispatched payload
 */
export const recordSeatAction = (gameStateView, dispatchGame, seat, intent) => {
  const payload = buildSeatActionPayload(gameStateView, seat, intent);
  if (typeof dispatchGame === 'function') {
    dispatchGame(payload);
  }
  return payload;
};
