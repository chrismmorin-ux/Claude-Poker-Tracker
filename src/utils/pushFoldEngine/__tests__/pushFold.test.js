/**
 * pushFold.test.js — push/fold verdict correctness.
 * Verdicts are computed from $EV/equity (POKER_THEORY §10.4), not charts/labels.
 */

import { describe, it, expect } from 'vitest';
import {
  effectiveStackBB,
  isPushFoldDepth,
  computeCallVerdict,
  computeShoveVerdict,
  assessPushFoldSetup,
} from '../index';

describe('effectiveStackBB', () => {
  it('uses min(hero, villain)/bb', () => {
    expect(effectiveStackBB(3000, 5000, 100)).toBe(30); // hero shorter
    expect(effectiveStackBB(8000, 2000, 100)).toBe(20); // villain shorter
  });
  it('falls back to hero stack when no villain', () => {
    expect(effectiveStackBB(1200, null, 100)).toBe(12);
  });
  it('returns null without usable chips/bb', () => {
    expect(effectiveStackBB(0, 5000, 100)).toBeNull();
    expect(effectiveStackBB(3000, 5000, 0)).toBeNull();
  });
  it('isPushFoldDepth gates at 15bb', () => {
    expect(isPushFoldDepth(10)).toBe(true);
    expect(isPushFoldDepth(15)).toBe(true);
    expect(isPushFoldDepth(25)).toBe(false);
    expect(isPushFoldDepth(null)).toBe(false);
  });
});

describe('computeCallVerdict (facing a shove)', () => {
  it('calls when equity clears chip-EV pot odds', () => {
    const r = computeCallVerdict({ heroEq: 0.5, callCost: 10, pot: 15 });
    expect(r.chipRequired).toBeCloseTo(0.4, 6); // 10/25
    expect(r.verdict).toBe('CALL');
    expect(r.icmAdjusted).toBe(false);
  });
  it('folds when equity is below the pot odds', () => {
    const r = computeCallVerdict({ heroEq: 0.35, callCost: 10, pot: 15 });
    expect(r.verdict).toBe('FOLD');
  });
  it('ICM tightens the calling requirement near the bubble', () => {
    // 4 players, 2 paid → bubble. Hero is the short stack (index 3).
    const icm = { stacks: [40, 30, 20, 10], heroIndex: 3, villainIndex: 0, payouts: [60, 40] };
    const r = computeCallVerdict({ heroEq: 0.45, callCost: 10, pot: 12, icm });
    expect(r.icmAdjusted).toBe(true);
    expect(r.requiredEquity).toBeGreaterThan(r.chipRequired); // ICM needs MORE equity
  });
  it('a marginal +chipEV call becomes a fold under ICM', () => {
    const icm = { stacks: [40, 30, 20, 10], heroIndex: 3, villainIndex: 0, payouts: [60, 40] };
    const chip = computeCallVerdict({ heroEq: 0.47, callCost: 10, pot: 12 });
    const withIcm = computeCallVerdict({ heroEq: 0.47, callCost: 10, pot: 12, icm });
    expect(chip.verdict).toBe('CALL');        // chip-EV says call
    expect(withIcm.verdict).toBe('FOLD');     // ICM says fold
  });
});

describe('computeShoveVerdict (first-in, chip-EV)', () => {
  it('shoves a premium hand', () => {
    const r = computeShoveVerdict({ heroEq: 0.6, foldEq: 0.5, effStackBB: 10, potBB: 1.5 });
    expect(r.verdict).toBe('SHOVE');
    expect(r.shoveEV).toBeGreaterThan(0);
  });
  it('folds trash with little fold equity', () => {
    const r = computeShoveVerdict({ heroEq: 0.3, foldEq: 0.25, effStackBB: 10, potBB: 1.5 });
    expect(r.verdict).toBe('FOLD');
  });
  it('high fold equity carries a marginal hand', () => {
    const r = computeShoveVerdict({ heroEq: 0.4, foldEq: 0.8, effStackBB: 10, potBB: 1.5 });
    expect(r.verdict).toBe('SHOVE');
  });
});

describe('computeShoveVerdict (ICM)', () => {
  const icm = {
    stacks: [40, 30, 20, 10], heroIndex: 3, villainIndex: 0, payouts: [60, 40],
    riskChips: 10, winChips: 10, potChips: 3,
  };
  it('jams with dominant fold equity even on the bubble', () => {
    const r = computeShoveVerdict({ heroEq: 0.35, foldEq: 0.9, effStackBB: 10, potBB: 3, icm });
    expect(r.icmAdjusted).toBe(true);
    expect(r.requiredEquity).not.toBeNull();
    expect(r.verdict).toBe('SHOVE');
  });
  it('folds a low-equity jam that gets called near the bubble', () => {
    const r = computeShoveVerdict({ heroEq: 0.3, foldEq: 0.2, effStackBB: 10, potBB: 3, icm });
    expect(r.verdict).toBe('FOLD');
  });
});

describe('assessPushFoldSetup (integration logic)', () => {
  const base = {
    chipStacks: { 1: 1000, 4: 8000, 7: 12000 }, // hero (seat 1) is short: 10bb
    mySeat: 1, actionSequence: [], bb: 100, dealerSeat: 7,
  };

  it('detects a short first-in spot and picks the biggest opponent', () => {
    const s = assessPushFoldSetup(base);
    expect(s).not.toBeNull();
    expect(s.facingShove).toBe(false);
    expect(s.effBB).toBe(10);            // 1000/100
    expect(s.villainSeat).toBe(7);       // chip leader
  });

  it('detects facing a shove from an all-in entry', () => {
    const s = assessPushFoldSetup({
      ...base,
      actionSequence: [{ seat: 4, action: 'raise', street: 'preflop', order: 1, amount: 8000, allIn: true }],
    });
    expect(s.facingShove).toBe(true);
    expect(s.villainSeat).toBe(4);
    expect(s.effBB).toBe(10); // min(1000, 8000)/100
  });

  it('returns null when hero is deep (not push/fold depth)', () => {
    const s = assessPushFoldSetup({ ...base, chipStacks: { 1: 5000, 7: 12000 } }); // 50bb
    expect(s).toBeNull();
  });

  it('assembles an ICM context at a final table when payouts exist', () => {
    const s = assessPushFoldSetup({
      ...base,
      payouts: [600, 400],
      playersRemaining: 3, // all 3 visible → final table, exact ICM
    });
    expect(s.icm).not.toBeNull();
    expect(s.icm.payouts).toEqual([600, 400]);
    expect(s.icm.heroIndex).toBe(0);     // seat 1 sorts first
    expect(s.icm.villainIndex).toBe(2);  // seat 7
    expect(s.icm.isApproximate).toBe(false);
  });

  it('no ICM context without payouts (chip-EV)', () => {
    expect(assessPushFoldSetup(base).icm).toBeNull();
  });
});
