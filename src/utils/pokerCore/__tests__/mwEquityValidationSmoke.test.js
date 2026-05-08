/**
 * smoke.test.js — runtime verification for the MW-equity validation harness.
 *
 * NOT included in the regular smart-test-runner suite (path `src/__dev__/**`
 * is outside the unit/component/hooks projects in vite.config.js). Run via:
 *   npx vitest run --include 'src/__dev__/**\/*.test.js'
 *
 * Purpose: confirm the derivation math runs end-to-end on a tiny case
 * without throwing or producing NaN/Inf. Sanity-checks AA / 72o invariants.
 *
 * Trials are intentionally low (200) so the test completes in seconds;
 * MC noise is irrelevant for the invariants tested.
 */

import { describe, it, expect } from 'vitest';
import { JOINT_PROBABILITIES_BTN, evaluateBtnScenario, buildBtnVillainRanges } from '../../../__dev__/mwEquityValidation/scenarios/btnScenarios';
import { UTG_SCENARIO_PROBS, evaluateUtgScenarios, buildUtgVillainRanges } from '../../../__dev__/mwEquityValidation/scenarios/utgScenarios';
import { compareToReference } from '../../../__dev__/mwEquityValidation/comparator';
import { createCache } from '../../../__dev__/mwEquityValidation/cache';
import { rangeIndex, PREFLOP_CHARTS } from '../rangeMatrix';
import { handStrengthTier, heroResponseToThreeBet } from '../../../__dev__/mwEquityValidation/scenarios/heroResponse';

const TINY_OPTS = { openSize: 2.5, effStack: 100, mcTrials: 200, mcConvergenceThreshold: 0.05 };

const idxAA = rangeIndex(12, 12, false); // AA
const idx72o = rangeIndex(0, 5, false);   // 72o (rank 0=2, rank 5=7)
const idxKK = rangeIndex(11, 11, false);  // KK
const idxJJ = rangeIndex(9, 9, false);    // JJ
const idxAKs = rangeIndex(12, 11, true);  // AKs
const idxAKo = rangeIndex(12, 11, false); // AKo

describe('JOINT_PROBABILITIES_BTN', () => {
  it('cells sum to ~1.0', () => {
    let s = 0;
    for (const sb of Object.keys(JOINT_PROBABILITIES_BTN)) {
      for (const bb of Object.keys(JOINT_PROBABILITIES_BTN[sb])) {
        s += JOINT_PROBABILITIES_BTN[sb][bb];
      }
    }
    expect(Math.abs(s - 1.0)).toBeLessThan(0.01);
  });
});

describe('UTG_SCENARIO_PROBS', () => {
  it('cells sum to ~1.0', () => {
    let s = 0;
    for (const v of Object.values(UTG_SCENARIO_PROBS)) s += v;
    expect(Math.abs(s - 1.0)).toBeLessThan(0.01);
  });
});

describe('heroResponseToThreeBet — 3-tier strength bucket', () => {
  it('AA 4-bets', () => {
    expect(heroResponseToThreeBet(idxAA).fourBet).toBe(1.0);
  });
  it('JJ calls', () => {
    expect(heroResponseToThreeBet(idxJJ).call).toBe(1.0);
  });
  it('72o folds', () => {
    expect(heroResponseToThreeBet(idx72o).fold).toBe(1.0);
  });
});

describe('handStrengthTier ordering', () => {
  it('AA > KK > JJ > AKs > AKo > 72o', () => {
    const aa = handStrengthTier(idxAA);
    const kk = handStrengthTier(idxKK);
    const jj = handStrengthTier(idxJJ);
    const aks = handStrengthTier(idxAKs);
    const ako = handStrengthTier(idxAKo);
    const t72 = handStrengthTier(idx72o);
    expect(aa).toBeGreaterThan(kk);
    expect(kk).toBeGreaterThan(jj);
    expect(jj).toBeGreaterThan(aks);
    expect(aks).toBeGreaterThan(ako);
    expect(ako).toBeGreaterThan(t72);
  });
});

describe('BTN scenario evaluation — runtime smoke', () => {
  const cache = createCache();
  const ranges = buildBtnVillainRanges();

  it('all_fold (fold,fold) returns +1.5 BB', async () => {
    const ev = await evaluateBtnScenario(idxAA, 'fold', 'fold', ranges, TINY_OPTS, cache);
    expect(ev).toBe(1.5);
  });

  it('AA vs (fold, call) returns finite positive EV', async () => {
    const ev = await evaluateBtnScenario(idxAA, 'fold', 'call', ranges, TINY_OPTS, cache);
    expect(Number.isFinite(ev)).toBe(true);
    expect(ev).toBeGreaterThan(0);
  });

  it('AA vs (call, call) — 3-way — finite EV; positive (AA dominates)', async () => {
    const ev = await evaluateBtnScenario(idxAA, 'call', 'call', ranges, TINY_OPTS, cache);
    expect(Number.isFinite(ev)).toBe(true);
    expect(ev).toBeGreaterThan(0);
  });

  it('72o vs (call, call) — 3-way — finite EV; should be negative or near-zero', async () => {
    const ev = await evaluateBtnScenario(idx72o, 'call', 'call', ranges, TINY_OPTS, cache);
    expect(Number.isFinite(ev)).toBe(true);
    expect(ev).toBeLessThan(0); // 72o vs 3-way unlikely to clear hero open size
  }, 30000);

  it('AA vs (fold, threeBet) — hero 4-bets, finite EV', async () => {
    const ev = await evaluateBtnScenario(idxAA, 'fold', 'threeBet', ranges, TINY_OPTS, cache);
    expect(Number.isFinite(ev)).toBe(true);
    expect(ev).toBeGreaterThan(0); // AA is profitable as a 4-bet
  }, 30000);

  it('72o vs (fold, threeBet) — hero folds, EV = -2.5 (open lost)', async () => {
    const ev = await evaluateBtnScenario(idx72o, 'fold', 'threeBet', ranges, TINY_OPTS, cache);
    expect(ev).toBe(-2.5); // hero folds; loses the open
  });

  it('AA vs squeeze (call, threeBet) — hero 4-bets, finite EV', async () => {
    const ev = await evaluateBtnScenario(idxAA, 'call', 'threeBet', ranges, TINY_OPTS, cache);
    expect(Number.isFinite(ev)).toBe(true);
    expect(ev).toBeGreaterThan(0);
  }, 30000);
});

describe('UTG scenario evaluation — runtime smoke', () => {
  const cache = createCache();
  const ranges = buildUtgVillainRanges();

  it('AA scenarios all finite', async () => {
    const evs = await evaluateUtgScenarios(idxAA, ranges, TINY_OPTS, cache);
    for (const key of Object.keys(evs)) {
      expect(Number.isFinite(evs[key])).toBe(true);
    }
    expect(evs.allFold).toBe(1.5);
    expect(evs.oneCaller).toBeGreaterThan(0);
  }, 60000);

  it('72o scenarios all finite', async () => {
    const evs = await evaluateUtgScenarios(idx72o, ranges, TINY_OPTS, cache);
    for (const key of Object.keys(evs)) {
      expect(Number.isFinite(evs[key])).toBe(true);
    }
    expect(evs.allFold).toBe(1.5);
  }, 60000);
});

describe('comparator', () => {
  it('compares two ranges and produces TP/FP/FN counts', () => {
    const ref = PREFLOP_CHARTS.BTN;
    const derived = new Float64Array(169);
    // Synthetic derived: only AA is "in"
    derived[rangeIndex(12, 12, false)] = 5.0;
    const cmp = compareToReference(derived, ref);
    expect(cmp.confusion.tp).toBeGreaterThan(0); // AA in both
    expect(cmp.confusion.fn).toBeGreaterThan(0); // BTN ref has way more than AA
    expect(cmp.overlap).toBeGreaterThan(0);
    expect(cmp.overlap).toBeLessThan(1);
  });
});
