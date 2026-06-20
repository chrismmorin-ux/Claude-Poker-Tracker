/**
 * potCalculator.test.js - Tests for pot calculation and sizing utilities
 */

import { describe, it, expect } from 'vitest';
import { parseBlinds, calculatePot, calculatePotProgression, getCurrentBet, getSeatContributions, getTotalContributions, calculateSidePots, getSizingOptions, estimateRake, calculateStartingPot } from '../potCalculator';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

describe('parseBlinds', () => {
  it('parses "1/2" correctly', () => {
    expect(parseBlinds('1/2')).toEqual({ sb: 1, bb: 2 });
  });

  it('parses "2/5" correctly', () => {
    expect(parseBlinds('2/5')).toEqual({ sb: 2, bb: 5 });
  });

  it('parses "5/10" correctly', () => {
    expect(parseBlinds('5/10')).toEqual({ sb: 5, bb: 10 });
  });

  it('returns default for null', () => {
    expect(parseBlinds(null)).toEqual({ sb: 1, bb: 2 });
  });

  it('returns default for empty string', () => {
    expect(parseBlinds('')).toEqual({ sb: 1, bb: 2 });
  });

  it('returns default for invalid format', () => {
    expect(parseBlinds('abc')).toEqual({ sb: 1, bb: 2 });
  });
});

describe('calculatePot', () => {
  const blinds = { sb: 1, bb: 2 };

  it('returns SB + BB for empty sequence', () => {
    const result = calculatePot([], blinds);
    expect(result).toEqual({ total: 3, currentBet: 2, isEstimated: false });
  });

  it('returns SB + BB for null sequence', () => {
    const result = calculatePot(null, blinds);
    expect(result).toEqual({ total: 3, currentBet: 2, isEstimated: false });
  });

  it('adds call amount to pot', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 1, amount: 2 },
    ];
    expect(calculatePot(seq, blinds).total).toBe(5); // 3 + 2
  });

  it('uses currentBet for call without amount', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 1 },
    ];
    expect(calculatePot(seq, blinds).total).toBe(5); // 3 + 2 (bb)
  });

  it('adds raise amount and updates currentBet', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
    ];
    const result = calculatePot(seq, blinds);
    expect(result.total).toBe(11); // 3 + 8
    expect(result.currentBet).toBe(8);
    expect(result.isEstimated).toBe(false);
  });

  it('marks as estimated when bet/raise lacks amount', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1 },
    ];
    expect(calculatePot(seq, blinds).isEstimated).toBe(true);
  });

  it('fold and check add nothing', () => {
    const seq = [
      { seat: 3, action: PRIMITIVE_ACTIONS.FOLD, street: 'preflop', order: 1 },
      { seat: 4, action: PRIMITIVE_ACTIONS.CHECK, street: 'preflop', order: 2 },
    ];
    expect(calculatePot(seq, blinds).total).toBe(3);
  });

  it('handles multi-street hand', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 5, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2, amount: 8 },
      // Flop: currentBet resets to 0
      { seat: 4, action: PRIMITIVE_ACTIONS.BET, street: 'flop', order: 3, amount: 10 },
      { seat: 5, action: PRIMITIVE_ACTIONS.CALL, street: 'flop', order: 4, amount: 10 },
    ];
    // 3 (blinds) + 8 + 8 + 10 + 10 = 39
    expect(calculatePot(seq, blinds).total).toBe(39);
  });

  it('resets currentBet on street change', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 5, action: PRIMITIVE_ACTIONS.CHECK, street: 'flop', order: 2 },
    ];
    const result = calculatePot(seq, blinds);
    expect(result.currentBet).toBe(0); // Reset on flop
  });

  // INV-POT-RAISETO-IS-NOT-INCREMENT — a raise-to amount is a level, not an increment.
  it('does not over-count when a seat re-raises after already betting on the street', () => {
    const seq = [
      { seat: 1, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 6 },
      { seat: 2, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2, amount: 6 },
      // Flop: s1 bets 10, s2 raises to 30, s1 re-raises to 90 (already 10 in → +80, not +90)
      { seat: 1, action: PRIMITIVE_ACTIONS.BET, street: 'flop', order: 3, amount: 10 },
      { seat: 2, action: PRIMITIVE_ACTIONS.RAISE, street: 'flop', order: 4, amount: 30 },
      { seat: 1, action: PRIMITIVE_ACTIONS.RAISE, street: 'flop', order: 5, amount: 90 },
    ];
    // preflop 3 + 6 + 6 = 15; flop 10 + 30 + 80 = 120; total 135 (buggy code gave 145)
    expect(calculatePot(seq, blinds).total).toBe(135);
  });

  it('does not over-count a blind seat raising when blind seats are seeded', () => {
    const seq = [
      { seat: 2, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 10 },
    ];
    // BB (seat 2) raises to 10, already has bb=2 in → adds 8. Pot = sb 1 + 10 = 11.
    const seeded = calculatePot(seq, blinds, { smallBlindSeat: 1, bigBlindSeat: 2 });
    expect(seeded.total).toBe(11);
    // Without seeding the blind is not subtracted, so the total over-counts by bb.
    expect(calculatePot(seq, blinds).total).toBe(13);
  });
});

describe('getSeatContributions', () => {
  const blinds = { sb: 1, bb: 2 };

  it('seeds blind contributions on preflop', () => {
    expect(getSeatContributions([], 'preflop', blinds, 1, 2)).toEqual({ 1: 1, 2: 2 });
  });

  it('records a raise-to amount as a level, not an accumulating sum (4-bet pot)', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 5, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 2, amount: 24 },
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 3, amount: 80 },
    ];
    const contribs = getSeatContributions(seq, 'preflop', blinds, 1, 2);
    // seat 4 raised to 8 then to 80 → cumulative street contribution is 80, not 88.
    expect(contribs[4]).toBe(80);
    expect(contribs[5]).toBe(24);
    expect(contribs[1]).toBe(1); // SB blind, never acted
    expect(contribs[2]).toBe(2); // BB blind, never acted
  });

  it('accumulates a call increment onto a prior contribution', () => {
    const seq = [
      { seat: 5, action: PRIMITIVE_ACTIONS.RAISE, street: 'flop', order: 1, amount: 10 },
      { seat: 6, action: PRIMITIVE_ACTIONS.CALL, street: 'flop', order: 2, amount: 10 },
    ];
    const contribs = getSeatContributions(seq, 'flop', blinds);
    expect(contribs[5]).toBe(10);
    expect(contribs[6]).toBe(10);
  });
});

describe('calculateSidePots', () => {
  const blinds = { sb: 1, bb: 2 };
  const A = PRIMITIVE_ACTIONS;

  // Conservation: every test asserts sum(pots) + returned === totalContributed.
  const assertConserved = (result) => {
    const potSum = result.pots.reduce((s, p) => s + p.amount, 0);
    expect(potSum + result.returned).toBe(result.totalContributed);
  };

  it('single pot when no one is all-in for less (flop bet + call)', () => {
    const seq = [
      { seat: 1, action: A.BET, street: 'flop', order: 1, amount: 10 },
      { seat: 2, action: A.CALL, street: 'flop', order: 2, amount: 10 },
    ];
    const r = calculateSidePots(seq, blinds);
    expect(r.pots).toEqual([{ amount: 20, eligibleSeats: [1, 2] }]);
    expect(r.returned).toBe(0);
    assertConserved(r);
  });

  it('main + side pot for a 3-way all-in with unequal stacks (47 / 120 / 120)', () => {
    const seq = [
      { seat: 1, action: A.BET, street: 'flop', order: 1, amount: 47, allIn: true },
      { seat: 2, action: A.RAISE, street: 'flop', order: 2, amount: 120, allIn: true },
      { seat: 3, action: A.CALL, street: 'flop', order: 3, amount: 120 },
    ];
    const r = calculateSidePots(seq, blinds);
    expect(r.pots).toEqual([
      { amount: 141, eligibleSeats: [1, 2, 3] }, // 47 × 3
      { amount: 146, eligibleSeats: [2, 3] },    // 73 × 2
    ]);
    expect(r.totalContributed).toBe(287);
    assertConserved(r);
  });

  it('returns an uncalled top bet to its seat (shove called for less)', () => {
    const seq = [
      { seat: 1, action: A.BET, street: 'flop', order: 1, amount: 100 },
      { seat: 2, action: A.CALL, street: 'flop', order: 2, amount: 40, allIn: true },
    ];
    const r = calculateSidePots(seq, blinds);
    expect(r.pots).toEqual([{ amount: 80, eligibleSeats: [1, 2] }]);
    expect(r.returned).toBe(60);
    expect(r.returnedSeat).toBe(1);
    assertConserved(r);
  });

  it('counts a folded seat\'s chips as dead money but excludes it from eligibility', () => {
    const seq = [
      { seat: 1, action: A.BET, street: 'flop', order: 1, amount: 30 },
      { seat: 2, action: A.CALL, street: 'flop', order: 2, amount: 30 },
      { seat: 3, action: A.RAISE, street: 'flop', order: 3, amount: 100, allIn: true },
      { seat: 1, action: A.FOLD, street: 'flop', order: 4 },
      { seat: 2, action: A.CALL, street: 'flop', order: 5, amount: 70 },
    ];
    const r = calculateSidePots(seq, blinds);
    // seat 1's 30 is dead money inside the single contested pot; only 2 & 3 win it.
    expect(r.pots).toEqual([{ amount: 230, eligibleSeats: [2, 3] }]);
    assertConserved(r);
  });

  it('layers two all-ins plus folded dead money into main + side', () => {
    const seq = [
      { seat: 4, action: A.BET, street: 'flop', order: 1, amount: 10 },
      { seat: 1, action: A.RAISE, street: 'flop', order: 2, amount: 20, allIn: true },
      { seat: 2, action: A.RAISE, street: 'flop', order: 3, amount: 50, allIn: true },
      { seat: 3, action: A.CALL, street: 'flop', order: 4, amount: 50 },
      { seat: 4, action: A.FOLD, street: 'flop', order: 5 },
    ];
    const r = calculateSidePots(seq, blinds);
    expect(r.pots).toEqual([
      { amount: 70, eligibleSeats: [1, 2, 3] }, // 10(dead) + 20 + 20 + 20
      { amount: 60, eligibleSeats: [2, 3] },    // 30 + 30
    ]);
    expect(r.totalContributed).toBe(130);
    assertConserved(r);
  });

  it('seeds preflop blinds as dead money when a blind seat folds', () => {
    const seq = [
      { seat: 3, action: A.RAISE, street: 'preflop', order: 1, amount: 30, allIn: true },
      { seat: 1, action: A.FOLD, street: 'preflop', order: 2 }, // SB folds, 1 dead
      { seat: 2, action: A.CALL, street: 'preflop', order: 3, amount: 28 }, // BB to 30
    ];
    const r = calculateSidePots(seq, blinds, { smallBlindSeat: 1, bigBlindSeat: 2 });
    expect(r.pots).toEqual([{ amount: 61, eligibleSeats: [2, 3] }]); // 1(SB dead) + 30 + 30
    assertConserved(r);
  });

  it('flags isEstimated when a bet/raise lacks an amount', () => {
    const seq = [
      { seat: 1, action: A.BET, street: 'flop', order: 1 }, // no amount
      { seat: 2, action: A.CALL, street: 'flop', order: 2 },
    ];
    expect(calculateSidePots(seq, blinds).isEstimated).toBe(true);
  });

  it('returns an empty pot list for an empty sequence', () => {
    const r = calculateSidePots([], blinds);
    expect(r.pots).toEqual([]);
    expect(r.totalContributed).toBe(0);
  });
});

describe('getTotalContributions', () => {
  const blinds = { sb: 1, bb: 2 };
  it('sums a seat\'s contributions across streets', () => {
    const seq = [
      { seat: 5, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 6 },
      { seat: 6, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2, amount: 6 },
      { seat: 5, action: PRIMITIVE_ACTIONS.BET, street: 'flop', order: 3, amount: 12 },
      { seat: 6, action: PRIMITIVE_ACTIONS.CALL, street: 'flop', order: 4, amount: 12 },
    ];
    const totals = getTotalContributions(seq, blinds);
    expect(totals[5]).toBe(18); // 6 + 12
    expect(totals[6]).toBe(18);
  });
});

describe('getCurrentBet', () => {
  it('returns 0 for no actions', () => {
    expect(getCurrentBet([], 'preflop')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(getCurrentBet(null, 'preflop')).toBe(0);
  });

  it('returns last bet/raise amount on street', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 5, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 2, amount: 24 },
    ];
    expect(getCurrentBet(seq, 'preflop')).toBe(24);
  });

  it('ignores actions on other streets', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 4, action: PRIMITIVE_ACTIONS.BET, street: 'flop', order: 2, amount: 10 },
    ];
    expect(getCurrentBet(seq, 'preflop')).toBe(8);
  });
});

describe('getSizingOptions', () => {
  const blinds = { sb: 1, bb: 2 };

  it('returns preflop open sizes (facing blinds only)', () => {
    const options = getSizingOptions('preflop', PRIMITIVE_ACTIONS.RAISE, blinds, 3, 2);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '2.5x', amount: 5 });
    expect(options[1]).toEqual({ label: '4x', amount: 8 });
  });

  it('returns preflop 3bet sizes (facing a raise)', () => {
    const options = getSizingOptions('preflop', PRIMITIVE_ACTIONS.RAISE, blinds, 11, 8);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '2x', amount: 16 });
    expect(options[1]).toEqual({ label: '3x', amount: 24 });
  });

  it('returns postflop bet sizes (pot-relative)', () => {
    const options = getSizingOptions('flop', PRIMITIVE_ACTIONS.BET, blinds, 20, 0);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '1/4', amount: 5 });
    expect(options[1]).toEqual({ label: '1/2', amount: 10 });
  });

  it('returns postflop raise sizes (bet-relative)', () => {
    const options = getSizingOptions('flop', PRIMITIVE_ACTIONS.RAISE, blinds, 30, 10);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '2x', amount: 20 });
    expect(options[1]).toEqual({ label: '3x', amount: 30 });
  });
});

// =============================================================================
// estimateRake
// =============================================================================

describe('estimateRake', () => {
  const rakeConfig = { pct: 0.10, cap: 8, noFlopNoDrop: true };

  it('returns 0 for null config', () => {
    expect(estimateRake(100, null, 'flop')).toBe(0);
  });

  it('returns 0 for undefined config', () => {
    expect(estimateRake(100, undefined, 'flop')).toBe(0);
  });

  it('returns 0 for zero pot', () => {
    expect(estimateRake(0, rakeConfig, 'flop')).toBe(0);
  });

  it('returns 0 for negative pot', () => {
    expect(estimateRake(-10, rakeConfig, 'flop')).toBe(0);
  });

  it('returns 0 on preflop with noFlopNoDrop', () => {
    expect(estimateRake(50, rakeConfig, 'preflop')).toBe(0);
  });

  it('takes rake on preflop when noFlopNoDrop is false', () => {
    const config = { pct: 0.10, cap: 8, noFlopNoDrop: false };
    expect(estimateRake(50, config, 'preflop')).toBe(5);
  });

  it('calculates percentage-based rake', () => {
    expect(estimateRake(50, rakeConfig, 'flop')).toBe(5);
  });

  it('caps rake at configured maximum', () => {
    expect(estimateRake(200, rakeConfig, 'turn')).toBe(8); // 10% of 200 = 20, capped at 8
  });

  it('handles small pots below cap', () => {
    expect(estimateRake(30, rakeConfig, 'river')).toBe(3); // 10% of 30 = 3, below cap
  });

  it('defaults street to flop', () => {
    expect(estimateRake(40, rakeConfig)).toBe(4);
  });
});

// =============================================================================
// calculateStartingPot
// =============================================================================

describe('calculateStartingPot', () => {
  it('calculates pot from blinds only (no ante)', () => {
    expect(calculateStartingPot({ sb: 1, bb: 2 })).toBe(3);
  });

  it('calculates pot with per-player ante', () => {
    const ante = { amount: 1, format: 'per-player', seatCount: 9 };
    expect(calculateStartingPot({ sb: 1, bb: 2 }, ante)).toBe(12); // 1 + 2 + 9
  });

  it('calculates pot with bb-ante', () => {
    const ante = { amount: 2, format: 'bb-ante', seatCount: 9 };
    expect(calculateStartingPot({ sb: 1, bb: 2 }, ante)).toBe(5); // 1 + 2 + 2
  });

  it('handles zero ante amount', () => {
    const ante = { amount: 0, format: 'per-player', seatCount: 9 };
    expect(calculateStartingPot({ sb: 1, bb: 2 }, ante)).toBe(3);
  });

  it('handles null ante config', () => {
    expect(calculateStartingPot({ sb: 5, bb: 10 }, null)).toBe(15);
  });

  it('handles null blinds', () => {
    expect(calculateStartingPot(null)).toBe(0);
  });

  it('defaults to per-player format when format not specified', () => {
    const ante = { amount: 1, seatCount: 6 };
    expect(calculateStartingPot({ sb: 1, bb: 2 }, ante)).toBe(9); // 1 + 2 + 6
  });

  it('defaults seatCount to 2 when not specified', () => {
    const ante = { amount: 5, format: 'per-player' };
    expect(calculateStartingPot({ sb: 1, bb: 2 }, ante)).toBe(13); // 1 + 2 + 10
  });
});

describe('calculatePotProgression', () => {
  const blinds = { sb: 1, bb: 2 };

  it('returns empty array for empty/null sequence', () => {
    expect(calculatePotProgression([], blinds)).toEqual([]);
    expect(calculatePotProgression(null, blinds)).toEqual([]);
  });

  it('reports pot BEFORE each action, aligned by index', () => {
    const seq = [
      { seat: 1, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', amount: 6 },
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop' }, // auto-call 6
      { seat: 1, action: PRIMITIVE_ACTIONS.BET, street: 'flop', amount: 8 },
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'flop' }, // auto-call 8
      { seat: 1, action: PRIMITIVE_ACTIONS.BET, street: 'turn', amount: 23 },
    ];
    expect(calculatePotProgression(seq, blinds)).toEqual([
      { potBefore: 3, estimated: false },  // sb + bb
      { potBefore: 9, estimated: false },  // after raise to 6
      { potBefore: 15, estimated: false }, // after auto-call 6
      { potBefore: 23, estimated: false }, // after flop bet 8
      { potBefore: 31, estimated: false }, // after auto-call 8
    ]);
  });

  it('matches calculatePot final total (same walk semantics)', () => {
    const seq = [
      { seat: 1, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', amount: 6 },
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop' },
      { seat: 4, action: PRIMITIVE_ACTIONS.BET, street: 'flop', amount: 9 },
      { seat: 1, action: PRIMITIVE_ACTIONS.RAISE, street: 'flop', amount: 27 },
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'flop' },
      { seat: 1, action: PRIMITIVE_ACTIONS.CHECK, street: 'turn' },
    ];
    const progression = calculatePotProgression(seq, blinds);
    const last = progression[progression.length - 1];
    // pot before the final check === calculatePot total of everything prior;
    // a check adds nothing, so it also equals the full-sequence total.
    expect(last.potBefore).toBe(calculatePot(seq, blinds).total);
  });

  it('flips estimated from the first amountless bet/raise onward', () => {
    const seq = [
      { seat: 1, action: PRIMITIVE_ACTIONS.BET, street: 'flop' }, // no amount
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'flop' },
      { seat: 1, action: PRIMITIVE_ACTIONS.BET, street: 'turn', amount: 10 },
    ];
    const progression = calculatePotProgression(seq, blinds);
    expect(progression[0].estimated).toBe(false); // pot before the bad entry is still good
    expect(progression[1].estimated).toBe(true);
    expect(progression[2].estimated).toBe(true);
  });

  it('skips null entries without losing alignment', () => {
    const seq = [
      { seat: 1, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', amount: 6 },
      null,
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop' },
    ];
    const progression = calculatePotProgression(seq, blinds);
    expect(progression).toHaveLength(3);
    expect(progression[2].potBefore).toBe(9);
  });
});
