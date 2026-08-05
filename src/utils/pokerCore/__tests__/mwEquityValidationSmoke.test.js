/**
 * mwEquityValidationSmoke.test.js — runtime verification for the MW-equity validation
 * harness that lives under `src/__dev__/mwEquityValidation/`.
 *
 * THIS FILE IS IN THE MAIN SUITE. Its path matches the `unit` project's
 * `src/utils/**\/__tests__/**\/*.test.js` include in vite.config.js, so
 * `smart-test-runner.sh` runs it on every commit. Its header used to claim the opposite
 * ("NOT included in the regular suite ... path `src/__dev__/**`"), left over from when the
 * file lived under `__dev__`. That stale claim is how a `__dev__` model came to be pinned in
 * place by the production suite for the life of WS-304 (WS-367).
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
import { getPopulationPrior } from '../../rangeEngine/populationPriors';
import { strengthPercentile, HERO_EQUITY_KEY } from '../../../__dev__/mwEquityValidation/strengthPercentile';
import {
  heroResponseToThreeBet,
  heroResponseToSqueeze,
  heroResponseToFiveBetJam,
} from '../../../__dev__/mwEquityValidation/scenarios/heroResponse';

const TINY_OPTS = { openSize: 2.5, effStack: 100, mcTrials: 200, mcConvergenceThreshold: 0.05 };

const idxAA = rangeIndex(12, 12, false); // AA
const idx72o = rangeIndex(0, 5, false);   // 72o (rank 0=2, rank 5=7)
const idxKK = rangeIndex(11, 11, false);  // KK
const idxQQ = rangeIndex(10, 10, false);  // QQ
const idxJJ = rangeIndex(9, 9, false);    // JJ
const idxTT = rangeIndex(8, 8, false);    // TT
const idx99 = rangeIndex(7, 7, false);    // 99
const idx22 = rangeIndex(0, 0, false);    // 22
const idxAKs = rangeIndex(12, 11, true);  // AKs
const idxAKo = rangeIndex(12, 11, false); // AKo
const idxAQs = rangeIndex(12, 10, true);  // AQs
const idxAJs = rangeIndex(12, 9, true);   // AJs
const idxK3o = rangeIndex(11, 1, false);  // K3o

const UTG = HERO_EQUITY_KEY.UTG; // EARLY
const BTN = HERO_EQUITY_KEY.BTN; // LATE

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
    expect(heroResponseToThreeBet(idxAA, UTG).fourBet).toBe(1.0);
  });
  it('JJ calls or better', () => {
    // JJ is inside the 4-bet tier on the corrected axis at both hero positions; the
    // load-bearing claim is that it continues, not which way.
    expect(heroResponseToThreeBet(idxJJ, UTG).fold).toBe(0.0);
  });
  it('72o folds', () => {
    expect(heroResponseToThreeBet(idx72o, UTG).fold).toBe(1.0);
  });
});

/**
 * WS-367. These assertions replace a `handStrengthTier ordering` block that pinned
 * `AA > KK > JJ > AKs > AKo > 72o` produced by the RETIRED rank sum
 * `(rank1 + rank2 + 8·isPair + 2·suited) / 32`. That formula was removed from the engine in
 * WS-304 and a second copy survived here; the test was asserting a model nothing else used.
 *
 * `JJ > AKs` SURVIVES THE CORRECTION, and it matters that it survives for a different
 * reason. Under the rank sum it held by arithmetic accident — JJ's +8 pair bonus against
 * AKs's +2 suited bonus, a comparison with no poker content. Under the corrected score it is
 * a MEASUREMENT: all-in versus an EARLY opening range JJ has 65.50% equity and AKs 62.20%
 * (`EQUITY_VS_OPEN`), which is simply true of those two hands all-in preflop. What the old
 * formula got wrong was never JJ vs AKs; it was AKo, which it scored 0.719 — below the 0.78
 * EARLY 3-bet foot — so the engine's 3-bet prior held AK at the support floor alongside 72o.
 *
 * The caveat, from WS-304 and restated in `strengthPercentile.js`: all-in equity does not
 * encode equity REALIZATION, so this axis ranks AK below the middle pairs where doctrine
 * ranks it above. `JJ > AKs` is therefore true of the model and NOT a doctrine claim about
 * which hand plays better against a 3-bettor. Do not read it as one.
 */
describe('strengthPercentile ordering (WS-367 — replaces the retired rank sum)', () => {
  it('UTG: AA > KK > QQ > JJ > AKs > TT > AKo, and everything above 72o', () => {
    const p = (i) => strengthPercentile(i, UTG);
    expect(p(idxAA)).toBeGreaterThan(p(idxKK));
    expect(p(idxKK)).toBeGreaterThan(p(idxQQ));
    expect(p(idxQQ)).toBeGreaterThan(p(idxJJ));
    expect(p(idxJJ)).toBeGreaterThan(p(idxAKs));
    expect(p(idxAKs)).toBeGreaterThan(p(idxTT));
    expect(p(idxTT)).toBeGreaterThan(p(idxAKo));
    expect(p(idxAKo)).toBeGreaterThan(p(idx72o));
  });

  it('BTN: AKs falls below TT and 99 — the ordering is position-conditioned', () => {
    // Against a LATE opener's range the middle pairs gain on AKs. This is the realization
    // caveat visible in the numbers, and it is why the score takes a position argument.
    const p = (i) => strengthPercentile(i, BTN);
    expect(p(idxTT)).toBeGreaterThan(p(idxAKs));
    expect(p(idx99)).toBeGreaterThan(p(idxAKs));
    expect(strengthPercentile(idxAKs, UTG)).toBeGreaterThan(strengthPercentile(idxTT, UTG));
  });

  it('22 outranks K3o — the rank sum had this backwards (0.250 vs 0.375)', () => {
    // Directly falsifies the retired formula: a pair's +8 bonus was worth less than one
    // rank step at the top of the deck, so 22 scored below K3o everywhere the score was used.
    expect(strengthPercentile(idx22, UTG)).toBeGreaterThan(strengthPercentile(idxK3o, UTG));
    expect(strengthPercentile(idx22, BTN)).toBeGreaterThan(strengthPercentile(idxK3o, BTN));
  });

  it('AK is not at the field floor — the failure WS-304 measured', () => {
    // The rank sum put AKo below the EARLY 3-bet foot; on the corrected axis it sits in the
    // top ~4% of the field at both hero positions.
    expect(strengthPercentile(idxAKo, UTG)).toBeGreaterThan(0.96);
    expect(strengthPercentile(idxAKo, BTN)).toBeGreaterThan(0.96);
  });

  it('reproduces the ordering the ENGINE\'s own 3-bet prior exhibits', () => {
    // The harness re-derives the engine's private strength score (see strengthPercentile.js
    // for why it is not imported). This pins the duplicate: if either side's strength model
    // moves, the two orderings stop agreeing and this test names the file to fix.
    const hands = [idxAA, idxKK, idxQQ, idxJJ, idxTT, idx99, idxAKs, idxAKo, idxAQs, idxAJs];
    for (const position of [UTG, BTN]) {
      const prior = getPopulationPrior(position, 'threeBet');
      const byPrior = [...hands].sort((a, b) => prior[b] - prior[a]);
      const byStrength = [...hands].sort(
        (a, b) => strengthPercentile(b, position) - strengthPercentile(a, position)
      );
      expect(byPrior).toEqual(byStrength);
    }
  });
});

/**
 * WS-367 — the docblock's named tiers, asserted rather than asserted-in-prose.
 * `heroResponse.js` names which hands sit in which tier; under the retired rank sum AKs and
 * 99 did not land where it said (AKs called instead of 4-betting, 99 folded instead of
 * calling), and nothing checked. These are the checks.
 */
describe('heroResponse tier membership matches its docblock (WS-367)', () => {
  for (const [name, position] of [['UTG', UTG], ['BTN', BTN]]) {
    it(`${name}: the named 4-bet set {AA,KK,QQ,AKs} 4-bets a single 3-bet`, () => {
      for (const idx of [idxAA, idxKK, idxQQ, idxAKs]) {
        expect(heroResponseToThreeBet(idx, position).fourBet).toBe(1.0);
      }
    });
    it(`${name}: the named call set {JJ,TT,99,AKo,AQs,AJs} continues`, () => {
      for (const idx of [idxJJ, idxTT, idx99, idxAKo, idxAQs, idxAJs]) {
        expect(heroResponseToThreeBet(idx, position).fold).toBe(0.0);
      }
    });
    it(`${name}: 72o and K3o fold every branch`, () => {
      for (const idx of [idx72o, idxK3o]) {
        expect(heroResponseToThreeBet(idx, position).fold).toBe(1.0);
        expect(heroResponseToSqueeze(idx, position).fold).toBe(1.0);
        expect(heroResponseToFiveBetJam(idx, position).fold).toBe(1.0);
      }
    });
    it(`${name}: squeeze is strictly tighter than a single 3-bet`, () => {
      // AQs continues vs a single 3-bet and folds to a squeeze at both hero positions.
      expect(heroResponseToThreeBet(idxAQs, position).fold).toBe(0.0);
      expect(heroResponseToSqueeze(idxAQs, position).fold).toBe(1.0);
    });
    it(`${name}: 5-bet jam — AA/KK snap, QQ mixes, JJ folds`, () => {
      expect(heroResponseToFiveBetJam(idxAA, position).call).toBe(1.0);
      expect(heroResponseToFiveBetJam(idxKK, position).call).toBe(1.0);
      expect(heroResponseToFiveBetJam(idxQQ, position).call).toBe(0.5);
      expect(heroResponseToFiveBetJam(idxJJ, position).fold).toBe(1.0);
    });
  }
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
    const cmp = compareToReference(derived, ref, BTN);
    expect(cmp.confusion.tp).toBeGreaterThan(0); // AA in both
    expect(cmp.confusion.fn).toBeGreaterThan(0); // BTN ref has way more than AA
    expect(cmp.overlap).toBeGreaterThan(0);
    expect(cmp.overlap).toBeLessThan(1);
  });
});
