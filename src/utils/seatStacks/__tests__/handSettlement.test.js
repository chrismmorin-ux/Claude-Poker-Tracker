/**
 * handSettlement.test.js — turning a finished hand into carry-forward inputs.
 *
 * The property under test is CHIP CONSERVATION: what leaves the seats must equal
 * what arrives back at them, or the ledger drifts a little every hand and the
 * staleness ceiling is the only thing standing between the founder and a
 * confidently wrong stack.
 */

import { describe, it, expect } from 'vitest';
import { settleHand, committedSoFar } from '../handSettlement';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import { ACTIONS } from '../../../constants/gameConstants';

const BLINDS = { sb: 1, bb: 2 };
const SEATS = { smallBlindSeat: 1, bigBlindSeat: 2 };

// INV-POT-RAISETO-IS-NOT-INCREMENT: on a RAISE/BET the `amount` is the raise-TO
// level, but on a CALL it is the INCREMENT owed on top of what the seat already
// has in — so a big blind calling a raise to 8 records `amount: 6`, not 8.
// Getting this backwards inflates the caller's contribution by the blind.

describe('handSettlement — settleHand', () => {
  it('credits the winner with the pot and debits every contributor', () => {
    const seq = [
      { seat: 3, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 1, action: PRIMITIVE_ACTIONS.FOLD, street: 'preflop', order: 2 },
      { seat: 2, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 3, amount: 6 },
      { seat: 2, action: PRIMITIVE_ACTIONS.CHECK, street: 'flop', order: 4 },
      { seat: 3, action: PRIMITIVE_ACTIONS.CHECK, street: 'flop', order: 5 },
      { seat: 3, action: ACTIONS.WON, street: 'showdown', order: 6, pot: 0 },
    ];

    const { contributions, payouts, estimated } = settleHand(seq, BLINDS, SEATS);

    expect(estimated).toBe(false);
    expect(contributions[3]).toBe(8);
    expect(contributions[2]).toBe(8);
    expect(contributions[1]).toBe(1);          // dead small blind

    const totalIn = Object.values(contributions).reduce((a, b) => a + b, 0);
    const totalOut = Object.values(payouts).reduce((a, b) => a + b, 0);
    expect(totalOut).toBe(totalIn);            // chips are conserved
  });

  it('returns an uncalled bet to its owner rather than treating it as won', () => {
    // Everyone folds to a raise. The raise was never called, so it comes back —
    // it never became a pot and is never raked. Without this, chips vanish.
    const seq = [
      { seat: 3, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 1, action: PRIMITIVE_ACTIONS.FOLD, street: 'preflop', order: 2 },
      { seat: 2, action: PRIMITIVE_ACTIONS.FOLD, street: 'preflop', order: 3 },
      { seat: 3, action: ACTIONS.WON, street: 'showdown', order: 4, pot: 0 },
    ];

    const { contributions, payouts } = settleHand(seq, BLINDS, SEATS);
    const totalIn = Object.values(contributions).reduce((a, b) => a + b, 0);
    const totalOut = Object.values(payouts).reduce((a, b) => a + b, 0);
    expect(totalOut).toBe(totalIn);
    expect(payouts[3]).toBeGreaterThan(0);
  });

  it('flags an estimated hand so the ledger refuses to carry it', () => {
    // A raise with no amount makes every contribution unreliable.
    const seq = [
      { seat: 3, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1 },
      { seat: 2, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2 },
    ];
    expect(settleHand(seq, BLINDS, SEATS).estimated).toBe(true);
  });

  it('pays no one when the winner was never recorded', () => {
    const seq = [
      { seat: 3, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 2, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2, amount: 6 },
    ];
    const { payouts } = settleHand(seq, BLINDS, SEATS);
    // Founder ratified that he always records the winner; if one is missing we
    // credit nobody rather than guessing, and the shortfall is visible.
    expect(Object.values(payouts).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('takes rake off the winner when a rake config is supplied', () => {
    const seq = [
      { seat: 3, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 20 },
      { seat: 2, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2, amount: 18 },
      { seat: 3, action: ACTIONS.WON, street: 'showdown', order: 3, pot: 0 },
    ];

    const gross = settleHand(seq, BLINDS, SEATS).payouts[3];
    const net = settleHand(seq, BLINDS, {
      ...SEATS,
      rakeConfig: { pct: 0.05, cap: 5, noFlopNoDrop: false },
      street: 'flop',
    }).payouts[3];

    expect(net).toBeLessThan(gross);
  });
});

describe('handSettlement — committedSoFar', () => {
  it('reports what is already in the middle at the cursor', () => {
    const upToHere = [
      { seat: 3, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 2, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2, amount: 6 },
    ];
    const committed = committedSoFar(upToHere, BLINDS, SEATS);
    expect(committed[3]).toBe(8);
    expect(committed[2]).toBe(8);
  });

  it('grows as the cursor advances — this is what makes a mid-hand stack correct', () => {
    const early = [
      { seat: 3, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
    ];
    const later = [
      ...early,
      { seat: 3, action: PRIMITIVE_ACTIONS.BET, street: 'flop', order: 2, amount: 25 },
    ];
    expect(committedSoFar(later, BLINDS, SEATS)[3])
      .toBeGreaterThan(committedSoFar(early, BLINDS, SEATS)[3]);
  });
});
