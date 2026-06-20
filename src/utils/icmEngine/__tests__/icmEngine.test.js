/**
 * icmEngine.test.js — ICM correctness against hand-computed textbook values.
 *
 * The {50,30,20} chips / {50,30,20} payout case is the classic Malmuth-Harville
 * worked example. Expected $EV computed by hand (see POKER_THEORY.md §10.2):
 *   A(50)=38.392857  B(30)=32.75  C(20)=28.857143   (Σ=100)
 * Note the ICM tax: leader 38.39 < 50 share; short stack 28.86 > 20 share.
 */

import { describe, it, expect } from 'vitest';
import {
  computeIcmEquity,
  proportionalEquity,
  buildIcmStacks,
  computeRiskPremium,
  computeHeroPressure,
} from '../index';

describe('computeIcmEquity — Malmuth-Harville', () => {
  it('matches the classic {50,30,20}/{50,30,20} worked example', () => {
    const eq = computeIcmEquity([50, 30, 20], [50, 30, 20]);
    expect(eq[0]).toBeCloseTo(38.392857, 4);
    expect(eq[1]).toBeCloseTo(32.75, 4);
    expect(eq[2]).toBeCloseTo(28.857143, 4);
  });

  it('conserves the prize pool (Σ $EV === Σ payouts) when paid places ≤ players', () => {
    const eq = computeIcmEquity([50, 30, 20], [50, 30, 20]);
    const sum = eq.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it('taxes the chip leader and rewards the short stack (the ICM signature)', () => {
    const stacks = [50, 30, 20];
    const payouts = [50, 30, 20];
    const pool = 100;
    const eq = computeIcmEquity(stacks, payouts);
    // leader's $EV below its chip share; short stack's above.
    expect(eq[0]).toBeLessThan((stacks[0] / 100) * pool);
    expect(eq[2]).toBeGreaterThan((stacks[2] / 100) * pool);
  });

  it('gives equal stacks equal $EV', () => {
    const eq = computeIcmEquity([100, 100, 100], [50, 30, 20]);
    expect(eq[0]).toBeCloseTo(100 / 3, 6);
    expect(eq[1]).toBeCloseTo(100 / 3, 6);
    expect(eq[2]).toBeCloseTo(100 / 3, 6);
  });

  it('heads-up: $EV = p(win)·1st + p(lose)·2nd', () => {
    // {60,40}/{70,30}: A=0.6·70+0.4·30=54, B=0.4·70+0.6·30=46
    const eq = computeIcmEquity([60, 40], [70, 30]);
    expect(eq[0]).toBeCloseTo(54, 6);
    expect(eq[1]).toBeCloseTo(46, 6);
  });

  it('winner-take-all collapses ICM to the proportional (chip-share) model', () => {
    const eq = computeIcmEquity([50, 30, 20], [100]);
    expect(eq[0]).toBeCloseTo(50, 6);
    expect(eq[1]).toBeCloseTo(30, 6);
    expect(eq[2]).toBeCloseTo(20, 6);
  });

  it('ignores unreachable payout slots (more paid places than players)', () => {
    const three = computeIcmEquity([50, 30, 20], [50, 30, 20]);
    const four = computeIcmEquity([50, 30, 20], [50, 30, 20, 10]);
    expect(four[0]).toBeCloseTo(three[0], 6);
    expect(four[2]).toBeCloseTo(three[2], 6);
  });

  it('degrades to proportional for an oversized field (never hangs)', () => {
    const stacks = Array.from({ length: 20 }, (_, i) => 1000 + i * 100);
    const payouts = [500, 300, 200];
    const eq = computeIcmEquity(stacks, payouts);
    const prop = proportionalEquity(stacks, payouts);
    expect(eq).toEqual(prop);
  });

  it('returns zeros for empty stacks or payouts', () => {
    expect(computeIcmEquity([], [50])).toEqual([]);
    expect(computeIcmEquity([50, 50], [])).toEqual([0, 0]);
  });
});

describe('buildIcmStacks', () => {
  it('models a final table exactly (all remaining players visible)', () => {
    const r = buildIcmStacks({
      chipStacks: { 1: 5000, 4: 3000, 7: 2000 },
      mySeat: 4,
      playersRemaining: 3,
    });
    expect(r.stacks).toEqual([5000, 3000, 2000]);
    expect(r.seats).toEqual([1, 4, 7]);
    expect(r.heroIndex).toBe(1);
    expect(r.isApproximate).toBe(false);
    expect(r.tooLarge).toBe(false);
  });

  it('buckets the unseen field at the average for a small multi-table spot (flagged)', () => {
    const r = buildIcmStacks({
      chipStacks: { 1: 5000, 2: 3000 },
      mySeat: 1,
      playersRemaining: 4,
      totalChips: 12000,
    });
    // unseen 2 players share 12000-8000=4000 → 2000 each
    expect(r.stacks).toEqual([5000, 3000, 2000, 2000]);
    expect(r.isApproximate).toBe(true);
    expect(r.tooLarge).toBe(false);
  });

  it('declines to fabricate precision for a large field (tooLarge)', () => {
    const r = buildIcmStacks({
      chipStacks: { 1: 5000, 2: 3000 },
      mySeat: 1,
      playersRemaining: 50,
    });
    expect(r.tooLarge).toBe(true);
    expect(r.isApproximate).toBe(true);
  });

  it('returns null with no usable stacks', () => {
    expect(buildIcmStacks({ chipStacks: {}, mySeat: 1, playersRemaining: 3 })).toBeNull();
  });
});

describe('riskPremium / bubbleFactor', () => {
  it('winner-take-all has no risk premium (bubble factor ≈ 1 — chips are dollars)', () => {
    // hero index 1 (30) vs leader index 0 (50), risk 30
    const r = computeRiskPremium([50, 30, 20], 1, [100], { villainIndex: 0, riskChips: 30 });
    expect(r.bubbleFactor).toBeCloseTo(1, 6);
  });

  it('a multi-pay bubble produces a real risk premium (bubble factor > 1)', () => {
    // 4 players, 2 paid → 3rd is the bubble. Short stack hero (index 3 = 10).
    const stacks = [40, 30, 20, 10];
    const payouts = [60, 40];
    const r = computeRiskPremium(stacks, 3, payouts, { villainIndex: 0, riskChips: 10 });
    expect(r.bubbleFactor).toBeGreaterThan(1);
    // ICM-required equity to call exceeds the chip-EV 50% for a symmetric all-in.
    expect(r.requiredEquity).toBeGreaterThan(0.5);
  });

  it('computeHeroPressure picks the chip leader and returns a premium near the bubble', () => {
    const stacks = [40, 30, 20, 10];
    const payouts = [60, 40];
    const p = computeHeroPressure(stacks, 3, payouts);
    expect(p.villainIndex).toBe(0); // chip leader
    expect(p.bubbleFactor).toBeGreaterThan(1);
  });

  // Regression for WS-242: a covered shove (hero stack > villain stack) risks and
  // wins only the EFFECTIVE amount min(hero, villain). Passing hero's FULL stack as
  // riskChips over-debits the ICM lose branch (busts hero to 0 when they should
  // retain hero−villain chips), inflating the risk premium.
  it('covered shove risks only the effective (min) stack, not hero full stack', () => {
    // hero index 0 = 100 (covers everyone); contested villain index 1 = 40 (shorter).
    const stacks = [100, 40, 30, 20];
    const payouts = [50, 30, 20];
    const effective = 40; // min(hero 100, villain 40)

    const correct = computeRiskPremium(stacks, 0, payouts, {
      villainIndex: 1, riskChips: effective, winChips: effective,
    });
    const buggyFullStack = computeRiskPremium(stacks, 0, payouts, {
      villainIndex: 1, riskChips: 100, winChips: effective,
    });

    // The effective-stack lose branch leaves hero with 100−40=60 chips, NOT 0,
    // so hero keeps strictly more $EV than the full-stack (bust) computation.
    expect(correct.heroLose).toBeGreaterThan(buggyFullStack.heroLose);
    // Sanity: the effective lose-stack $EV equals modeling hero at 60 chips directly.
    const heroAt60 = computeIcmEquity([60, 80, 30, 20], payouts)[0]; // 40 transferred to villain
    expect(correct.heroLose).toBeCloseTo(heroAt60, 6);
  });
});
