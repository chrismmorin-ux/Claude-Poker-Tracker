/**
 * recordSeatAction.test.js
 *
 * Unit tests for the WS-182 primitive-collapse recording API.
 *
 * The doctrine being tested:
 *   "A check being available when you haven't matched the bet should be
 *    impossible at the primitive level."
 *
 * Each test pins a specific shape of the (intent, gameState) → label
 * derivation, so the rules-correctness invariant cannot regress.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildSeatActionPayload, recordSeatAction } from '../recordSeatAction';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';
import { GAME_ACTIONS } from '../../reducers/gameReducer';

const BLINDS = { sb: 1, bb: 2 };
const SB_SEAT = 1;
const BB_SEAT = 2;

const makeView = (overrides = {}) => ({
  actionSequence: [],
  currentStreet: 'preflop',
  blinds: BLINDS,
  smallBlindSeat: SB_SEAT,
  bigBlindSeat: BB_SEAT,
  ...overrides,
});

describe('buildSeatActionPayload — fold intent', () => {
  it('returns FOLD payload regardless of game state', () => {
    const view = makeView();
    const payload = buildSeatActionPayload(view, 5, 'fold');
    expect(payload).toEqual({
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat: 5, action: PRIMITIVE_ACTIONS.FOLD },
    });
  });

  it('returns FOLD for blinded seats too (blinds may still fold)', () => {
    const view = makeView();
    const payload = buildSeatActionPayload(view, SB_SEAT, 'fold');
    expect(payload.payload.action).toBe(PRIMITIVE_ACTIONS.FOLD);
  });
});

describe('buildSeatActionPayload — match intent (the WS-182 anchor case)', () => {
  it('preflop SB facing only blinds → CALL with sb-to-bb completion', () => {
    // SB has posted 1 (sb); currentBet = bb = 2; amountOwed = 1.
    // This is the exact case owner observed: SB tried to CHECK and was
    // illegally allowed to. Under recordSeatAction, 'match' for SB
    // MUST resolve to CALL.
    const view = makeView({ actionSequence: [] });
    const payload = buildSeatActionPayload(view, SB_SEAT, 'match');
    expect(payload).toEqual({
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat: SB_SEAT, action: PRIMITIVE_ACTIONS.CALL, amount: 1 },
    });
  });

  it('preflop BB facing only blinds → CHECK (BB has paid bb already)', () => {
    const view = makeView();
    const payload = buildSeatActionPayload(view, BB_SEAT, 'match');
    expect(payload).toEqual({
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat: BB_SEAT, action: PRIMITIVE_ACTIONS.CHECK },
    });
  });

  it('preflop UTG (unblinded seat) → CALL with bb (owes bb)', () => {
    const view = makeView();
    const payload = buildSeatActionPayload(view, 4, 'match');
    expect(payload.payload).toEqual({
      seat: 4,
      action: PRIMITIVE_ACTIONS.CALL,
      amount: 2,
    });
  });

  it('flop with no bet yet → CHECK (currentBet=0, amountOwed=0)', () => {
    const view = makeView({
      currentStreet: 'flop',
      actionSequence: [],
    });
    const payload = buildSeatActionPayload(view, 5, 'match');
    expect(payload.payload).toEqual({ seat: 5, action: PRIMITIVE_ACTIONS.CHECK });
  });

  it('flop facing a bet → CALL with the bet amount', () => {
    const view = makeView({
      currentStreet: 'flop',
      actionSequence: [
        { seat: 5, action: PRIMITIVE_ACTIONS.BET, amount: 10, street: 'flop', order: 1 },
      ],
    });
    const payload = buildSeatActionPayload(view, 3, 'match');
    expect(payload.payload).toEqual({
      seat: 3,
      action: PRIMITIVE_ACTIONS.CALL,
      amount: 10,
    });
  });

  it('flop seat partially in (called partial) → CALL increment only', () => {
    // Edge: seat 3 has already partially called (e.g. on an earlier action
    // that was undone and re-bet). The increment math should only ask for
    // the difference.
    const view = makeView({
      currentStreet: 'flop',
      actionSequence: [
        { seat: 5, action: PRIMITIVE_ACTIONS.BET, amount: 10, street: 'flop', order: 1 },
        { seat: 3, action: PRIMITIVE_ACTIONS.CALL, amount: 4, street: 'flop', order: 2 },
        { seat: 5, action: PRIMITIVE_ACTIONS.RAISE, amount: 30, street: 'flop', order: 3 },
      ],
    });
    const payload = buildSeatActionPayload(view, 3, 'match');
    // Seat 3 has already contributed 4; currentBet now 30; owed = 26.
    expect(payload.payload).toEqual({
      seat: 3,
      action: PRIMITIVE_ACTIONS.CALL,
      amount: 26,
    });
  });

  it('preflop after a raise → SB owes raise-to minus sb', () => {
    const view = makeView({
      actionSequence: [
        { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, amount: 6, street: 'preflop', order: 1 },
      ],
    });
    const payload = buildSeatActionPayload(view, SB_SEAT, 'match');
    expect(payload.payload).toEqual({
      seat: SB_SEAT,
      action: PRIMITIVE_ACTIONS.CALL,
      amount: 5,
    });
  });

  it('IS the WS-182 anchor — CHECK-while-owing is structurally unrepresentable', () => {
    // Caller cannot construct a CHECK label for SB on the standard preflop
    // (the only path to CHECK is intent='match' AND amountOwed=0). Verify
    // by inspection: every intent value through this function for SB on a
    // limped preflop yields a non-CHECK label.
    const view = makeView();
    const intents = ['fold', 'match', { raiseTo: 6 }];
    const labels = intents.map(
      (i) => buildSeatActionPayload(view, SB_SEAT, i).payload.action
    );
    expect(labels).not.toContain(PRIMITIVE_ACTIONS.CHECK);
    expect(labels).toEqual([
      PRIMITIVE_ACTIONS.FOLD,
      PRIMITIVE_ACTIONS.CALL,
      PRIMITIVE_ACTIONS.RAISE,
    ]);
  });
});

describe('buildSeatActionPayload — raiseTo intent', () => {
  it('flop with currentBet=0 → BET label (open of street)', () => {
    const view = makeView({ currentStreet: 'flop', actionSequence: [] });
    const payload = buildSeatActionPayload(view, 5, { raiseTo: 10 });
    expect(payload.payload).toEqual({
      seat: 5,
      action: PRIMITIVE_ACTIONS.BET,
      amount: 10,
    });
  });

  it('flop facing a bet → RAISE label', () => {
    const view = makeView({
      currentStreet: 'flop',
      actionSequence: [
        { seat: 3, action: PRIMITIVE_ACTIONS.BET, amount: 10, street: 'flop', order: 1 },
      ],
    });
    const payload = buildSeatActionPayload(view, 5, { raiseTo: 30 });
    expect(payload.payload).toEqual({
      seat: 5,
      action: PRIMITIVE_ACTIONS.RAISE,
      amount: 30,
    });
  });

  it('preflop unraised → currentBet=bb → RAISE label (above the BB)', () => {
    // On preflop, the BB is a forced bet; "opening" with a raise is
    // technically a RAISE above currentBet=bb. The label remains RAISE
    // (not BET) — bet semantics are "first chips on a street"; preflop
    // is not first chips because the blinds are already in.
    const view = makeView();
    const payload = buildSeatActionPayload(view, 4, { raiseTo: 6 });
    expect(payload.payload).toEqual({
      seat: 4,
      action: PRIMITIVE_ACTIONS.RAISE,
      amount: 6,
    });
  });

  it('throws RangeError when raiseTo <= currentBet (illegal sizing)', () => {
    const view = makeView({
      currentStreet: 'flop',
      actionSequence: [
        { seat: 5, action: PRIMITIVE_ACTIONS.BET, amount: 10, street: 'flop', order: 1 },
      ],
    });
    expect(() => buildSeatActionPayload(view, 3, { raiseTo: 10 })).toThrow(RangeError);
    expect(() => buildSeatActionPayload(view, 3, { raiseTo: 5 })).toThrow(/must exceed/);
  });

  it('throws TypeError on non-numeric raiseTo', () => {
    const view = makeView();
    expect(() => buildSeatActionPayload(view, 5, { raiseTo: '10' })).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5, { raiseTo: NaN })).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5, { raiseTo: -5 })).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5, { raiseTo: 0 })).toThrow(TypeError);
  });
});

describe('buildSeatActionPayload — all-in intents', () => {
  it('{ raiseTo, allIn } full-raise shove → RAISE with allIn, action reopens (no flag)', () => {
    // Preflop UTG raised to 6 → minRaise = 6 + max(6-2, 2) = 10. A shove to 12
    // is a full raise (>= 10), so it reopens action and carries no reopensAction flag.
    const view = makeView({
      actionSequence: [
        { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, amount: 6, street: 'preflop', order: 1 },
      ],
    });
    const payload = buildSeatActionPayload(view, 7, { raiseTo: 12, allIn: true });
    expect(payload.payload).toEqual({
      seat: 7,
      action: PRIMITIVE_ACTIONS.RAISE,
      amount: 12,
      allIn: true,
    });
    expect(payload.payload.reopensAction).toBeUndefined();
  });

  it('{ raiseTo, allIn } sub-min shove → RAISE with allIn AND reopensAction:false', () => {
    // Same spot, minRaise = 10. A short all-in to 8 is below a full raise:
    // it does not reopen betting for players who already acted.
    const view = makeView({
      actionSequence: [
        { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, amount: 6, street: 'preflop', order: 1 },
      ],
    });
    const payload = buildSeatActionPayload(view, 7, { raiseTo: 8, allIn: true });
    expect(payload.payload).toEqual({
      seat: 7,
      action: PRIMITIVE_ACTIONS.RAISE,
      amount: 8,
      allIn: true,
      reopensAction: false,
    });
  });

  it('{ callAmount, allIn } short call → CALL below the bet, no RangeError', () => {
    // Flop bet 10; seat 3 is all-in for only 4. A capped call is representable
    // here even though 4 <= currentBet (which { raiseTo } would reject).
    const view = makeView({
      currentStreet: 'flop',
      actionSequence: [
        { seat: 5, action: PRIMITIVE_ACTIONS.BET, amount: 10, street: 'flop', order: 1 },
      ],
    });
    const payload = buildSeatActionPayload(view, 3, { callAmount: 4, allIn: true });
    expect(payload.payload).toEqual({
      seat: 3,
      action: PRIMITIVE_ACTIONS.CALL,
      amount: 4,
      allIn: true,
    });
  });

  it('{ callAmount } throws TypeError on non-positive amount', () => {
    const view = makeView({ currentStreet: 'flop' });
    expect(() => buildSeatActionPayload(view, 3, { callAmount: 0, allIn: true })).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 3, { callAmount: -4, allIn: true })).toThrow(TypeError);
  });

  it('{ match, allIn } exact all-in call → CALL with allIn stamped', () => {
    // Seat 4 owes the bb (2) and is all-in for exactly that.
    const view = makeView();
    const payload = buildSeatActionPayload(view, 4, { match: true, allIn: true });
    expect(payload.payload).toEqual({
      seat: 4,
      action: PRIMITIVE_ACTIONS.CALL,
      amount: 2,
      allIn: true,
    });
  });

  it('a full-raise all-in BET (opening a street) carries allIn but no reopensAction', () => {
    const view = makeView({ currentStreet: 'flop', actionSequence: [] });
    const payload = buildSeatActionPayload(view, 5, { raiseTo: 40, allIn: true });
    expect(payload.payload).toEqual({
      seat: 5,
      action: PRIMITIVE_ACTIONS.BET,
      amount: 40,
      allIn: true,
    });
  });
});

describe('buildSeatActionPayload — argument validation', () => {
  it('throws TypeError on non-integer seat', () => {
    const view = makeView();
    expect(() => buildSeatActionPayload(view, '5', 'fold')).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5.5, 'fold')).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, null, 'fold')).toThrow(TypeError);
  });

  it('throws TypeError on null gameStateView', () => {
    expect(() => buildSeatActionPayload(null, 5, 'fold')).toThrow(TypeError);
    expect(() => buildSeatActionPayload(undefined, 5, 'fold')).toThrow(TypeError);
  });

  it('throws TypeError on unrecognized intent string', () => {
    const view = makeView();
    expect(() => buildSeatActionPayload(view, 5, 'check')).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5, 'call')).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5, 'bet')).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5, 'raise')).toThrow(TypeError);
  });

  it('throws TypeError on null/undefined intent', () => {
    const view = makeView();
    expect(() => buildSeatActionPayload(view, 5, null)).toThrow(TypeError);
    expect(() => buildSeatActionPayload(view, 5, undefined)).toThrow(TypeError);
  });
});

describe('recordSeatAction (with dispatch)', () => {
  it('builds payload and dispatches it', () => {
    const view = makeView();
    const dispatchGame = vi.fn();
    const payload = recordSeatAction(view, dispatchGame, BB_SEAT, 'match');
    expect(dispatchGame).toHaveBeenCalledTimes(1);
    expect(dispatchGame).toHaveBeenCalledWith(payload);
    expect(payload.payload).toEqual({ seat: BB_SEAT, action: PRIMITIVE_ACTIONS.CHECK });
  });

  it('does not throw if dispatchGame is null (still returns payload)', () => {
    const view = makeView();
    const payload = recordSeatAction(view, null, BB_SEAT, 'match');
    expect(payload.payload.action).toBe(PRIMITIVE_ACTIONS.CHECK);
  });

  it('propagates RangeError from illegal raiseTo (does not dispatch)', () => {
    const view = makeView();
    const dispatchGame = vi.fn();
    expect(() =>
      recordSeatAction(view, dispatchGame, 5, { raiseTo: 1 })
    ).toThrow(RangeError);
    expect(dispatchGame).not.toHaveBeenCalled();
  });
});
