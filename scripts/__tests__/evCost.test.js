/**
 * evCost.test.js — WS-273 fold-vs-bet EV bridge.
 *
 * This is the only place a prediction error is turned into money, so the
 * assertions below are against hand-computed poker arithmetic rather than
 * against the implementation. §6.3: a pure bluff of B into a pot of P breaks
 * even at foldPct = B / (P + B).
 */

import { describe, it, expect } from 'vitest';
import { foldEstimateRegretBB, priceFoldVsBet } from '../backtest/evCost.mjs';

// Bet 10bb into a 20bb pot → breakeven fold frequency = 10 / 30 = 33.3%.
const POT = 20;
const BET = 10;
const BREAKEVEN = BET / (POT + BET);

describe('foldEstimateRegretBB', () => {
  it('charges nothing when the estimate is exactly right', () => {
    expect(foldEstimateRegretBB({
      potBB: POT, betBB: BET, predictedFold: 0.5, actualFold: 0.5,
    })).toBeCloseTo(0, 10);
  });

  it('charges nothing for an error that does not flip the decision', () => {
    // Both 0.55 and 0.50 are above breakeven, so hero bluffs either way and the
    // realised EV is identical. An error is only expensive when it changes what
    // you do — this is the whole reason the metric is regret, not error.
    const regret = foldEstimateRegretBB({
      potBB: POT, betBB: BET, predictedFold: 0.55, actualFold: 0.50,
    });
    expect(regret).toBeCloseTo(0, 10);
  });

  it('charges the full lost EV when overconfidence causes a losing bluff', () => {
    // Model says they fold 60% (bluff looks good); they actually fold 20%,
    // below the 33.3% breakeven. Hero bluffs and loses.
    // EV at 0.20 = 20(0.20) - 10(0.80) = 4 - 8 = -4bb. Optimal is 0 (don't bluff).
    const regret = foldEstimateRegretBB({
      potBB: POT, betBB: BET, predictedFold: 0.60, actualFold: 0.20,
    });
    expect(regret).toBeCloseTo(4, 10);
  });

  it('charges the forgone profit when underconfidence skips a winning bluff', () => {
    // Model says 10% (skip); they actually fold 60%.
    // EV at 0.60 = 20(0.60) - 10(0.40) = 12 - 4 = +8bb, all of it forgone.
    const regret = foldEstimateRegretBB({
      potBB: POT, betBB: BET, predictedFold: 0.10, actualFold: 0.60,
    });
    expect(regret).toBeCloseTo(8, 10);
  });

  it('is never negative — regret against an oracle cannot be a gain', () => {
    for (const predicted of [0, 0.1, 0.33, 0.5, 0.9, 1]) {
      for (const actual of [0, 0.2, BREAKEVEN, 0.7, 1]) {
        const r = foldEstimateRegretBB({
          potBB: POT, betBB: BET, predictedFold: predicted, actualFold: actual,
        });
        expect(r).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('scales with the pot it was wrong about', () => {
    const small = foldEstimateRegretBB({ potBB: 10, betBB: 5, predictedFold: 0.1, actualFold: 0.9 });
    const big = foldEstimateRegretBB({ potBB: 100, betBB: 50, predictedFold: 0.1, actualFold: 0.9 });
    expect(big).toBeGreaterThan(small * 9);
  });

  it('returns null rather than NaN on unusable inputs', () => {
    // The bridge previously multiplied an object by a number and produced NaN
    // silently; nulls must be explicit so they can be excluded from means.
    expect(foldEstimateRegretBB({ potBB: 0, betBB: 10, predictedFold: 0.5, actualFold: 0.5 })).toBeNull();
    expect(foldEstimateRegretBB({ potBB: 20, betBB: 0, predictedFold: 0.5, actualFold: 0.5 })).toBeNull();
    expect(foldEstimateRegretBB({ potBB: 20, betBB: 10, predictedFold: undefined, actualFold: 0.5 })).toBeNull();
  });
});

describe('priceFoldVsBet', () => {
  // BET/POT = 10/20 = 0.5 → the '33-66' size bucket, which is the default
  // grouping key (breakeven is a function of bet-to-pot, so that is the only
  // grouping under which a group-average fold rate is comparable to breakeven).
  const record = (facing, actual, predictedFold, extra = {}) => ({
    predicted: { fold: predictedFold, call: 1 - predictedFold - 0.05, raise: 0.05 },
    actual,
    slices: {
      facingAction: facing,
      sprZone: extra.sprZone ?? 'medium',
      sizeBucket: extra.sizeBucket ?? '33-66',
    },
    _meta: { potBB: POT, facingBetBB: BET },
  });

  it('ignores decision classes that do not convert cheaply', () => {
    // facing 'none' is a check/bet node — no fold to price.
    const out = priceFoldVsBet([record('none', 'check', 0.5), record('none', 'bet', 0.5)]);
    expect(out.applicable).toBe(0);
    expect(out.bbPer100Decisions).toBeNull();
  });

  it('ignores records lacking pot context', () => {
    const noPot = { ...record('bet', 'fold', 0.5), _meta: {} };
    expect(priceFoldVsBet([noPot]).applicable).toBe(0);
  });

  it('produces a finite bb/100 for a populated group', () => {
    const records = Array.from({ length: 40 }, (_, i) => record('bet', i < 8 ? 'fold' : 'call', 0.6));
    const out = priceFoldVsBet(records, { minGroupN: 10 });
    expect(out.applicable).toBe(40);
    expect(Number.isFinite(out.bbPer100Decisions)).toBe(true);
    expect(out.bbPer100Decisions).toBeGreaterThan(0);
  });

  it('reports ~zero cost when the model matches reality', () => {
    // 50% actual fold, model predicts 50%. Both sides of breakeven agree.
    const records = Array.from({ length: 40 }, (_, i) => record('bet', i < 20 ? 'fold' : 'call', 0.5));
    const out = priceFoldVsBet(records, { minGroupN: 10 });
    expect(out.bbPer100Decisions).toBeCloseTo(0, 6);
  });

  it('computes the empirical fold rate per group, not per record', () => {
    // A single record is a 0 or a 1; judging a probability against a coin flip
    // measures variance, not calibration.
    const records = [
      ...Array.from({ length: 30 }, (_, i) => record('bet', i < 15 ? 'fold' : 'call', 0.5, { sprZone: 'low' })),
      ...Array.from({ length: 30 }, () => record('bet', 'fold', 0.5, { sprZone: 'deep' })),
    ];
    const out = priceFoldVsBet(records, { minGroupN: 10, groupBy: 'sprZone' });
    const low = out.groups.find(g => g.group.endsWith('|low'));
    const deep = out.groups.find(g => g.group.endsWith('|deep'));
    expect(low.actualFold).toBeCloseTo(0.5, 10);
    expect(deep.actualFold).toBeCloseTo(1.0, 10);
  });

  it('flags thin groups and excludes them from the headline', () => {
    const records = [
      ...Array.from({ length: 40 }, (_, i) => record('bet', i < 8 ? 'fold' : 'call', 0.6, { sprZone: 'medium' })),
      ...Array.from({ length: 3 }, () => record('bet', 'fold', 0.1, { sprZone: 'micro' })),
    ];
    const out = priceFoldVsBet(records, { minGroupN: 20, groupBy: 'sprZone' });
    expect(out.groups.find(g => g.group.endsWith('|micro')).thin).toBe(true);
    expect(out.groups.find(g => g.group.endsWith('|medium')).thin).toBe(false);
  });

  it('excludes facing-a-raise, which is a different decision', () => {
    // Facing a raise has different pot geometry; pricing it with the pure-bluff
    // formula produced per-decision numbers driven by pot size rather than model
    // error, and it is outside the approved fold-vs-BET scope.
    const raises = Array.from({ length: 30 }, () => record('raise', 'fold', 0.5));
    expect(priceFoldVsBet(raises).applicable).toBe(0);
  });

  it('reports a winrate-comparable per-hand figure alongside the per-decision one', () => {
    // Quoting only per-100-decisions overstates the cost by how often the spot
    // occurs — facing a bet is not a once-per-hand event.
    const records = Array.from({ length: 40 }, (_, i) => ({
      ...record('bet', i < 8 ? 'fold' : 'call', 0.6),
      _meta: { potBB: POT, facingBetBB: BET, handId: Math.floor(i / 2) },
    }));
    const out = priceFoldVsBet(records, { minGroupN: 10 });
    expect(out.handsRepresented).toBe(20);
    // Two applicable decisions per hand → per-hand cost is twice per-decision.
    expect(out.bbPer100Hands).toBeCloseTo(out.bbPer100Decisions * 2, 6);
  });

  it('carries its own scope caveat', () => {
    const out = priceFoldVsBet([]);
    expect(out.note).toMatch(/LOWER BOUND/);
    expect(out.note).toMatch(/Fold-vs-BET class only/);
  });
});
