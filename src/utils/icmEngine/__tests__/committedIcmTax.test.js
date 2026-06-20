import { describe, test, expect } from 'vitest';
import { computeCommittedIcmTax, computeRiskPremium } from '../riskPremium';

// Bubble: 4 left, 3 paid. Hero (idx 0) short, two big stacks behind.
const STACKS = [1500, 1500, 4000, 4000];
const PAYOUTS = [50, 30, 20];

describe('computeCommittedIcmTax', () => {
  test('returns 0 when ICM inputs are missing (cash-game / identity path)', () => {
    expect(computeCommittedIcmTax()).toBe(0);
    expect(computeCommittedIcmTax({ riskChips: 1500, pLose: 0.5 })).toBe(0);
    expect(computeCommittedIcmTax({ stacks: STACKS, payouts: PAYOUTS, heroIndex: 0, villainIndex: 1 })).toBe(0); // no risk/pLose
  });

  test('returns 0 for out-of-range hero/villain indices', () => {
    const base = { stacks: STACKS, payouts: PAYOUTS, riskChips: 1500, pLose: 0.5 };
    expect(computeCommittedIcmTax({ ...base, heroIndex: -1, villainIndex: 1 })).toBe(0);
    expect(computeCommittedIcmTax({ ...base, heroIndex: 0, villainIndex: 9 })).toBe(0);
  });

  test('returns 0 when riskChips or pLose is non-positive', () => {
    const base = { stacks: STACKS, payouts: PAYOUTS, heroIndex: 0, villainIndex: 1 };
    expect(computeCommittedIcmTax({ ...base, riskChips: 0, pLose: 0.5 })).toBe(0);
    expect(computeCommittedIcmTax({ ...base, riskChips: 1500, pLose: 0 })).toBe(0);
  });

  test('winner-take-all → β = 1 → tax 0 (chips are dollars, no ICM premium)', () => {
    // Single prize ⇒ $EV linear in chips ⇒ bubbleFactor exactly 1.
    const tax = computeCommittedIcmTax({
      stacks: STACKS, payouts: [100], heroIndex: 0, villainIndex: 1,
      riskChips: 1500, pLose: 0.5,
    });
    expect(tax).toBe(0);
  });

  test('real bubble → positive tax equal to (β−1)·pLose·riskChips', () => {
    const riskChips = 1500;
    const pLose = 0.5;
    const { bubbleFactor } = computeRiskPremium(STACKS, 0, PAYOUTS, {
      villainIndex: 1, riskChips, winChips: riskChips,
    });
    expect(bubbleFactor).toBeGreaterThan(1); // ICM tax exists on the bubble

    const tax = computeCommittedIcmTax({
      stacks: STACKS, payouts: PAYOUTS, heroIndex: 0, villainIndex: 1, riskChips, pLose,
    });
    expect(tax).toBeCloseTo((bubbleFactor - 1) * pLose * riskChips, 6);
    expect(tax).toBeGreaterThan(0);
  });

  test('tax scales linearly with pLose and riskChips', () => {
    const base = { stacks: STACKS, payouts: PAYOUTS, heroIndex: 0, villainIndex: 1 };
    const t1 = computeCommittedIcmTax({ ...base, riskChips: 1500, pLose: 0.25 });
    const t2 = computeCommittedIcmTax({ ...base, riskChips: 1500, pLose: 0.50 });
    expect(t2).toBeCloseTo(t1 * 2, 6);
  });

  test('the tax reproduces the exact ICM break-even for a symmetric all-in', () => {
    // Symmetric stack-off of size S: chipEV = (2e−1)·S, E[loss] = (1−e)·S.
    // Setting chipEV − tax((β−1)·(1−e)·S) = 0 must solve to e = requiredEquity.
    const S = 1500;
    const { bubbleFactor, requiredEquity } = computeRiskPremium(STACKS, 0, PAYOUTS, {
      villainIndex: 1, riskChips: S, winChips: S,
    });
    const e = requiredEquity; // at break-even equity, adjusted EV must be ~0
    const chipEV = (2 * e - 1) * S;
    const tax = computeCommittedIcmTax({
      stacks: STACKS, payouts: PAYOUTS, heroIndex: 0, villainIndex: 1,
      riskChips: S, pLose: 1 - e,
    });
    expect(chipEV - tax).toBeCloseTo(0, 4);
    // Sanity: requiredEquity = β/(1+β).
    expect(requiredEquity).toBeCloseTo(bubbleFactor / (1 + bubbleFactor), 6);
  });
});
