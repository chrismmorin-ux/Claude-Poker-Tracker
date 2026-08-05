import { describe, test, expect, beforeEach } from 'vitest';
import {
  parseHandClass,
  handClassToNotation,
  enumerateHandCombos,
  computeEquity,
  computeHandVsHand,
  clearEquityCache,
  getEquityCacheSize,
  NotImplementedError,
  evaluate7,
  enumerateHeroVsCombosExact,
} from '../preflopEquity';
import { bestFiveFromSeven } from '../handEvaluator';
import { encodeCard } from '../cardParser';
import { handVsRange } from '../monteCarloEquity';
import { createRange, rangeIndex, parseRangeString, decodeIndex } from '../rangeMatrix';
import { BUCKETS, clearRangePairCache } from '../equityDecomposition';
import { comboCountAfterRemoval } from '../combinatorics';

// --- evaluate7 correctness vs bestFiveFromSeven --- //
// evaluate7 is our dedicated 7-card fast path. It must produce IDENTICAL scores
// to bestFiveFromSeven on every input, since equity comparisons rely on both
// sides using compatible ranking.

describe('evaluate7 — equivalence with bestFiveFromSeven', () => {
  const rnd = (seed) => {
    // LCG for deterministic sampling
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state;
    };
  };

  const sample7CardHand = (rand) => {
    const hand = new Set();
    while (hand.size < 7) hand.add(rand() % 52);
    return [...hand];
  };

  test('matches on 10,000 randomly sampled 7-card hands', () => {
    const rand = rnd(42);
    let mismatches = 0;
    for (let i = 0; i < 10000; i++) {
      const cards = sample7CardHand(rand);
      const expected = bestFiveFromSeven(cards);
      const actual = evaluate7(cards);
      if (actual !== expected) {
        if (mismatches < 5) {
          // eslint-disable-next-line no-console
          console.error(`mismatch on hand ${cards}: evaluate7=${actual.toString(16)}, bestFive=${expected.toString(16)}`);
        }
        mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });

  test('correctly identifies all hand categories', () => {
    const mk = (...pairs) => pairs.map(([r, s]) => encodeCard(r, s));
    // Royal flush (straight flush A-high)
    const royal = mk([12, 0], [11, 0], [10, 0], [9, 0], [8, 0], [2, 1], [3, 2]);
    expect(evaluate7(royal) >> 20).toBe(8);
    // Quads: 4 Aces
    const quads = mk([12, 0], [12, 1], [12, 2], [12, 3], [5, 0], [3, 1], [7, 2]);
    expect(evaluate7(quads) >> 20).toBe(7);
    // Full house: trip + pair
    const fh = mk([12, 0], [12, 1], [12, 2], [5, 0], [5, 1], [3, 2], [7, 3]);
    expect(evaluate7(fh) >> 20).toBe(6);
    // Flush
    const flush = mk([12, 0], [10, 0], [7, 0], [5, 0], [2, 0], [3, 1], [6, 2]);
    expect(evaluate7(flush) >> 20).toBe(5);
    // Straight (regular, 9-high)
    const straight = mk([7, 0], [6, 1], [5, 2], [4, 3], [3, 0], [0, 1], [12, 2]);
    expect(evaluate7(straight) >> 20).toBe(4);
    // Wheel straight (A-2-3-4-5)
    const wheel = mk([12, 0], [0, 1], [1, 2], [2, 3], [3, 0], [7, 2], [10, 1]);
    expect(evaluate7(wheel) >> 20).toBe(4);
    // Trips
    const trips = mk([12, 0], [12, 1], [12, 2], [5, 0], [8, 1], [3, 2], [7, 3]);
    expect(evaluate7(trips) >> 20).toBe(3);
    // Two pair
    const twoPair = mk([12, 0], [12, 1], [5, 0], [5, 1], [8, 2], [3, 3], [7, 0]);
    expect(evaluate7(twoPair) >> 20).toBe(2);
    // Pair
    const pair = mk([12, 0], [12, 1], [5, 0], [8, 2], [3, 3], [7, 0], [10, 1]);
    expect(evaluate7(pair) >> 20).toBe(1);
    // High card
    const hc = mk([12, 0], [10, 1], [7, 2], [5, 3], [2, 0], [3, 1], [0, 2]);
    expect(evaluate7(hc) >> 20).toBe(0);
  });

  test('full house prefers higher kicker pair (KKK-QQ > KKK-22)', () => {
    const mk = (...pairs) => pairs.map(([r, s]) => encodeCard(r, s));
    // K K K Q Q 2 2 → full house K over Q (not over 2)
    const hand = mk([11, 0], [11, 1], [11, 2], [10, 0], [10, 1], [0, 2], [0, 3]);
    const score = evaluate7(hand);
    expect(score >> 20).toBe(6);         // full house
    expect((score >> 16) & 0xF).toBe(11); // trip K (rank 11)
    expect((score >> 12) & 0xF).toBe(10); // pair Q (rank 10), not 2
  });

  test('quads picks highest remaining kicker', () => {
    const mk = (...pairs) => pairs.map(([r, s]) => encodeCard(r, s));
    // A A A A K Q 2 → quads A + kicker K (not Q or 2)
    const hand = mk([12, 0], [12, 1], [12, 2], [12, 3], [11, 0], [10, 0], [0, 0]);
    const score = evaluate7(hand);
    expect(score >> 20).toBe(7);
    expect((score >> 12) & 0xF).toBe(11); // K kicker
  });
});

describe('preflopEquity — notation parsing', () => {
  test('parses pair notation', () => {
    expect(parseHandClass('AA')).toEqual({ rankHigh: 12, rankLow: 12, suited: false, pair: true });
    expect(parseHandClass('77')).toEqual({ rankHigh: 5, rankLow: 5, suited: false, pair: true });
    expect(parseHandClass('22')).toEqual({ rankHigh: 0, rankLow: 0, suited: false, pair: true });
  });

  test('parses suited hand notation', () => {
    expect(parseHandClass('AKs')).toEqual({ rankHigh: 12, rankLow: 11, suited: true, pair: false });
    expect(parseHandClass('JTs')).toEqual({ rankHigh: 9, rankLow: 8, suited: true, pair: false });
    expect(parseHandClass('72s')).toEqual({ rankHigh: 5, rankLow: 0, suited: true, pair: false });
  });

  test('parses offsuit hand notation', () => {
    expect(parseHandClass('AKo')).toEqual({ rankHigh: 12, rankLow: 11, suited: false, pair: false });
    expect(parseHandClass('Q9o')).toEqual({ rankHigh: 10, rankLow: 7, suited: false, pair: false });
  });

  test('normalizes rank order (low first → high first)', () => {
    expect(parseHandClass('KAs')).toEqual(parseHandClass('AKs'));
    expect(parseHandClass('TJo')).toEqual(parseHandClass('JTo'));
  });

  test('lowercase s/o suffixes are accepted', () => {
    expect(parseHandClass('aks')).toEqual(parseHandClass('AKs'));
    expect(parseHandClass('jto')).toEqual(parseHandClass('JTo'));
  });

  test('rejects ambiguous two-char without pair', () => {
    expect(() => parseHandClass('AK')).toThrow(/suffix/i);
  });

  test('rejects pair with suit suffix', () => {
    expect(() => parseHandClass('AAs')).toThrow();
  });

  test('rejects invalid suffix', () => {
    expect(() => parseHandClass('AKx')).toThrow(/suffix/i);
  });

  test('rejects invalid rank', () => {
    expect(() => parseHandClass('XKs')).toThrow();
    expect(() => parseHandClass('1Ks')).toThrow();
  });

  test('rejects empty/null/non-string', () => {
    expect(() => parseHandClass('')).toThrow();
    expect(() => parseHandClass(null)).toThrow();
    expect(() => parseHandClass(123)).toThrow();
  });

  test('round-trips notation via handClassToNotation', () => {
    for (const s of ['AA', 'KK', '22', 'AKs', 'AKo', 'JTs', '72o', '54s']) {
      expect(handClassToNotation(parseHandClass(s))).toBe(s);
    }
  });
});

describe('preflopEquity — combo enumeration', () => {
  test('pair expands to 6 combos', () => {
    const combos = enumerateHandCombos(parseHandClass('77'));
    expect(combos).toHaveLength(6);
    // All 6 combos are 7-7 with distinct suit pairs
    const suits = combos.map((c) => [c[0] & 3, c[1] & 3]);
    expect(new Set(suits.map((p) => p.sort().join(','))).size).toBe(6);
  });

  test('suited expands to 4 combos (same suit)', () => {
    const combos = enumerateHandCombos(parseHandClass('AKs'));
    expect(combos).toHaveLength(4);
    for (const [c1, c2] of combos) {
      expect(c1 & 3).toBe(c2 & 3);
    }
  });

  test('offsuit expands to 12 combos (different suits)', () => {
    const combos = enumerateHandCombos(parseHandClass('AKo'));
    expect(combos).toHaveLength(12);
    for (const [c1, c2] of combos) {
      expect(c1 & 3).not.toBe(c2 & 3);
    }
  });
});

describe('preflopEquity — invariants', () => {
  beforeEach(() => {
    clearEquityCache();
  });

  test('range targets no longer throw NotImplementedError (WS-305)', () => {
    const r = new Float64Array(169);
    r[rangeIndex(12, 12, false)] = 1.0; // AA
    expect(() => computeEquity(
      { type: 'range', range: r },
      { type: 'hand', notation: 'AA' },
    )).not.toThrow(NotImplementedError);
  }, 30000);

  test('an all-zero range is refused rather than silently treated as empty', () => {
    expect(() => computeEquity(
      { type: 'range', range: new Float64Array(169) },
      { type: 'hand', notation: 'AA' },
    )).toThrow(/no positive propensity/i);
  });

  test('throws on missing type', () => {
    expect(() => computeEquity({ notation: 'AA' }, { type: 'hand', notation: 'KK' })).toThrow();
  });

  test('cache returns identical result on second call', () => {
    const r1 = computeHandVsHand('AA', 'KK');
    const r2 = computeHandVsHand('AA', 'KK');
    expect(r1.equity).toBe(r2.equity);
    expect(r1.cached).toBeFalsy();
    expect(r2.cached).toBe(true);
  }, 30000);

  test('clearEquityCache empties cache', () => {
    computeHandVsHand('AA', 'KK');
    expect(getEquityCacheSize()).toBeGreaterThan(0);
    clearEquityCache();
    expect(getEquityCacheSize()).toBe(0);
  }, 30000);

  test('A vs B and B vs A are symmetric (sum + 2*tie = 1)', () => {
    const r1 = computeHandVsHand('AKs', 'JTs');
    const r2 = computeHandVsHand('JTs', 'AKs');
    // winA + loseA + tie = 1, and loseA = winB, tie shared
    expect(r1.winRate + r1.loseRate + r1.tieRate).toBeCloseTo(1, 6);
    expect(r1.winRate).toBeCloseTo(r2.loseRate, 6);
    expect(r1.loseRate).toBeCloseTo(r2.winRate, 6);
    expect(r1.tieRate).toBeCloseTo(r2.tieRate, 6);
    expect(r1.equity + r2.equity).toBeCloseTo(1, 6);
  }, 30000);

  test('exact equity is deterministic across runs', () => {
    clearEquityCache();
    const r1 = computeHandVsHand('QQ', 'AKo');
    clearEquityCache();
    const r2 = computeHandVsHand('QQ', 'AKo');
    expect(r1.equity).toBe(r2.equity);
    expect(r1.exact).toBe(true);
    expect(r2.exact).toBe(true);
  }, 60000);
});

/**
 * Ground-truth fixtures. The "expected" column is the exact all-suits-averaged
 * equity obtained from complete C(48,5) board enumeration over every valid
 * hand-B combo. Cross-validated against the well-known published values for
 * simple matchups (AA vs KK = 81.95%, AKs vs QQ ≈ 46.05%, JJ vs AKs ≈ 54.04%).
 *
 * The tolerance (±0.1%) is tighter than any reasonable published rounding and
 * gives room for future refactoring without breaking tests. Results should be
 * deterministic across runs.
 */
describe('preflopEquity — exact enumeration fixtures', () => {
  beforeEach(() => {
    clearEquityCache();
  });

  const cases = [
    // [handA, handB, expectedEquity, description]
    ['AA',  'KK',   0.81946, 'classic pair-over-pair (~4.5:1)'],
    ['AA',  '72o',  0.88200, 'AA dominates weakest unpaired hand'],
    ['AKs', 'QQ',   0.46049, 'overcards-suited vs pocket queens'],
    ['AKs', 'JTs',  0.62008, 'broadway vs middle suited connector (both flush-live)'],
    ['AKo', '54s',  0.58758, 'broadway vs low suited connector'],
    ['77',  'AKo',  0.54984, 'classic race — pair vs two overs'],
    ['JJ',  'AKs',  0.54039, 'middle pair vs two big overs'],
    ['T9s', 'AKo',  0.40524, 'middle suited connector vs two overs'],
  ];

  const TOLERANCE = 0.001;

  for (const [a, b, expected, desc] of cases) {
    test(`${a} vs ${b} = ${(expected * 100).toFixed(3)}% (${desc})`, () => {
      const r = computeHandVsHand(a, b);
      expect(r.exact).toBe(true);
      expect(Math.abs(r.equity - expected)).toBeLessThanOrEqual(TOLERANCE);
    }, 30000);
  }
});

/**
 * Cross-validation against the existing monteCarloEquity module. Exact
 * enumeration should agree with MC within MC's confidence interval. This is an
 * independent check that evaluate7 is correct: if there were a bug in our
 * fast 7-card evaluator, exact results would diverge from MC (which uses the
 * already-tested bestFiveFromSeven from handEvaluator.js).
 */
describe('preflopEquity — monte carlo cross-check', () => {
  beforeEach(() => {
    clearEquityCache();
  });

  const buildSingleCellRange = (notation) => {
    const r = createRange();
    const hc = parseHandClass(notation);
    const idx = rangeIndex(hc.rankHigh, hc.rankLow, hc.suited);
    r[idx] = 1.0;
    return r;
  };

  const canonicalCards = (notation) => {
    const combos = enumerateHandCombos(parseHandClass(notation));
    return combos[0];
  };

  const checkCases = [
    ['AKs', 'JTs'],
    ['77', 'AKo'],
    ['AA', '72o'],
    ['AKo', '54s'],
    ['T9s', 'AKo'],
  ];

  for (const [a, b] of checkCases) {
    test(`exact ${a} vs ${b} agrees with MC (±1% CI)`, async () => {
      const exactR = computeHandVsHand(a, b);
      const heroCards = canonicalCards(a);
      const villainRange = buildSingleCellRange(b);
      const mcR = await handVsRange(heroCards, villainRange, [], {
        trials: 50000,
        minTrials: 5000,
        convergenceThreshold: 0.005,
      });
      // Exact should be within MC's CI (±1.96σ ≈ ciHalf) plus a small margin.
      expect(Math.abs(exactR.equity - mcR.equity)).toBeLessThanOrEqual(mcR.ciHalf + 0.01);
    }, 30000);
  }
});

/**
 * WS-305 — hand/range-vs-range, DECOMPOSED.
 *
 * The correctness bar here is full enumeration, not agreement with another
 * estimator: preflop hand-vs-range equity has an exact answer, and
 * `enumerateHeroVsCombosExact` computes it per villain combo with nothing
 * averaged. Every assertion below is deterministic — no sampling anywhere on
 * this path, so there is no seed to record and no tolerance to negotiate.
 *
 * Test order matters for wall time, not for correctness: `rangePairCache` is
 * module state, so the tight range is enumerated once and every later test in
 * this block reads it back as arithmetic.
 */
describe('preflopEquity — range targets (WS-305)', () => {
  // 2.6% of hands. Tight enough that domination is the dominant effect, small
  // enough (4 classes) that a cold run is seconds rather than minutes.
  const TIGHT = 'QQ+,AKs';

  const rangeTarget = (str) => ({ type: 'range', range: parseRangeString(str) });
  const handTarget = (notation) => ({ type: 'hand', notation });

  /** Every specific 2-card combo a range covers, tagged with its class. */
  const rangeCombos = (str) => {
    const grid = parseRangeString(str);
    const out = [];
    for (let i = 0; i < 169; i++) {
      if (!(grid[i] > 0)) continue;
      const { rank1, rank2, suited, isPair } = decodeIndex(i);
      const handClass = { rankHigh: rank1, rankLow: rank2, suited: isPair ? false : suited, pair: isPair };
      const notation = handClassToNotation(handClass);
      for (const combo of enumerateHandCombos(handClass)) {
        out.push({ combo, notation, propensity: grid[i] });
      }
    }
    return out;
  };

  test('aggregate equity equals full per-combo enumeration', () => {
    const hero = 'AKo';
    const result = computeEquity(handTarget(hero), rangeTarget(TIGHT));

    // Ground truth: hero's actual cards against every villain combo separately.
    const heroCards = enumerateHandCombos(parseHandClass(hero))[0];
    const tagged = rangeCombos(TIGHT).filter(({ combo }) => (
      combo[0] !== heroCards[0] && combo[0] !== heroCards[1] &&
      combo[1] !== heroCards[0] && combo[1] !== heroCards[1]
    ));
    const rows = enumerateHeroVsCombosExact(heroCards, tagged.map((t) => t.combo));
    expect(rows).toHaveLength(tagged.length);

    let num = 0, den = 0;
    for (let i = 0; i < rows.length; i++) {
      num += tagged[i].propensity * rows[i].equity;
      den += tagged[i].propensity;
    }
    const referenceMean = num / den;

    // Exact, not approximate: agreement is at floating-point rounding.
    expect(Math.abs(result.equity - referenceMean)).toBeLessThan(1e-12);

    // Per-CLASS, the same: each element equals the mean of its own combos.
    const byClass = new Map();
    rows.forEach((row, i) => {
      const key = tagged[i].notation;
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key).push(row.equity);
    });
    let maxClassErr = 0;
    let maxComboSpread = 0;
    for (const el of result.decomposition.elements) {
      const eqs = byClass.get(el.notation);
      expect(eqs).toBeDefined();
      // Card removal, checked against enumeration rather than trusted.
      expect(el.comboCount).toBe(eqs.length);
      const mean = eqs.reduce((a, b) => a + b, 0) / eqs.length;
      maxClassErr = Math.max(maxClassErr, Math.abs(mean - el.equity));
      maxComboSpread = Math.max(maxComboSpread, Math.max(...eqs) - Math.min(...eqs));
    }
    // eslint-disable-next-line no-console
    console.log(
      `${hero} vs [${TIGHT}]: equity ${(result.equity * 100).toFixed(4)}% vs reference ` +
      `${(referenceMean * 100).toFixed(4)}% | max per-class err ${maxClassErr.toExponential(2)} | ` +
      `widest within-class per-combo spread ${(maxComboSpread * 100).toFixed(2)}pp`,
    );
    expect(maxClassErr).toBeLessThan(1e-12);
    // The spread is REAL — it is what a 169-grid cannot represent, and it is
    // exactly zero only if suit interaction does not exist. Assert it is not.
    expect(maxComboSpread).toBeGreaterThan(0);
  }, 120000);

  test('the mean is summed out of the decomposition, not computed beside it', () => {
    const r = computeEquity(handTarget('AKo'), rangeTarget(TIGHT));
    const fromBuckets = r.buckets.reduce((sum, b) => sum + b.equityShare, 0);
    expect(fromBuckets).toBe(r.equity);
    expect(r.winRate + r.tieRate + r.loseRate).toBeCloseTo(1, 12);
    // Element weights partition the whole; nothing is dropped.
    const shareSum = r.decomposition.elements.reduce((s, e) => s + e.weightShare, 0);
    expect(shareSum).toBeCloseTo(1, 12);
  }, 60000);

  test('deterministic across cleared caches — identical inputs, identical bits', () => {
    clearRangePairCache();
    const a = computeEquity(handTarget('AKo'), rangeTarget(TIGHT));
    clearRangePairCache();
    const b = computeEquity(handTarget('AKo'), rangeTarget(TIGHT));
    expect(b.equity).toBe(a.equity);
    expect(b.winRate).toBe(a.winRate);
    expect(b.tieRate).toBe(a.tieRate);
    for (let i = 0; i < a.buckets.length; i++) {
      expect(b.buckets[i].hitRate).toBe(a.buckets[i].hitRate);
      expect(b.buckets[i].winShare).toBe(a.buckets[i].winShare);
      expect(b.buckets[i].conditionalWin).toBe(a.buckets[i].conditionalWin);
    }
    // Cached and uncached paths must agree exactly, not merely closely.
    const uncached = computeEquity(handTarget('AKo'), rangeTarget(TIGHT), { useCache: false });
    expect(uncached.equity).toBe(a.equity);
  }, 180000);

  test('decomposition surfaces domination that the mean hides (KJo vs AQo)', () => {
    const kjo = computeEquity(handTarget('KJo'), rangeTarget(TIGHT));
    const aqo = computeEquity(handTarget('AQo'), rangeTarget(TIGHT));
    const kjoTP = kjo.buckets[BUCKETS.TOP_PAIR_OR_OVERPAIR];
    const aqoTP = aqo.buckets[BUCKETS.TOP_PAIR_OR_OVERPAIR];
    // eslint-disable-next-line no-console
    console.log(
      `vs [${TIGHT}] — KJo mean ${(kjo.equity * 100).toFixed(2)}% TP/OP conditionalWin ` +
      `${(kjoTP.conditionalWin * 100).toFixed(2)}% | AQo mean ${(aqo.equity * 100).toFixed(2)}% ` +
      `TP/OP conditionalWin ${(aqoTP.conditionalWin * 100).toFixed(2)}%`,
    );
    // The point of the ticket: when KJo makes top pair against a tight range it
    // is dominated far more often than AQo is, and a scalar equity cannot say so.
    expect(kjoTP.conditionalWin).toBeLessThan(aqoTP.conditionalWin - 0.03);
  }, 180000);

  test('card removal is applied per villain class, not assumed uniform', () => {
    // AKo holds one ace and one king, so it blocks AA, KK and AKs unevenly and
    // leaves QQ untouched. Those counts are the blocker effect.
    const r = computeEquity(handTarget('AKo'), rangeTarget(TIGHT));
    const byNotation = Object.fromEntries(r.decomposition.elements.map((e) => [e.notation, e]));
    expect(byNotation.QQ.comboCount).toBe(6);   // untouched
    expect(byNotation.KK.comboCount).toBe(3);   // one king gone -> C(3,2)
    expect(byNotation.AA.comboCount).toBe(3);   // one ace gone  -> C(3,2)
    expect(byNotation.AKs.comboCount).toBe(2);  // two of the four suits dead
    // Weight is comboCount x propensity — QQ carries twice AA's weight here
    // even though both sit at propensity 1. That asymmetry IS the blocker.
    expect(byNotation.QQ.weightShare).toBeCloseTo(2 * byNotation.AA.weightShare, 12);
  }, 60000);

  test('grid weights are propensities, never renormalised into a distribution', () => {
    const base = parseRangeString(TIGHT);
    const halved = parseRangeString(TIGHT);
    for (let i = 0; i < 169; i++) halved[i] *= 0.5;

    const a = computeEquity(handTarget('AKo'), { type: 'range', range: base });
    const b = computeEquity(handTarget('AKo'), { type: 'range', range: halved });
    // Uniform rescaling cannot move equity...
    expect(b.equity).toBe(a.equity);
    // ...but the raw mass is reported, not silently normalised away.
    expect(a.decomposition.villain.propensityMass).toBe(4);
    expect(b.decomposition.villain.propensityMass).toBe(2);

    // A NON-uniform change must move it: down-weighting AA raises hero's equity.
    const lessAces = parseRangeString(TIGHT);
    lessAces[rangeIndex(12, 12, false)] = 0.25;
    const c = computeEquity(handTarget('AKo'), { type: 'range', range: lessAces });
    expect(c.equity).toBeGreaterThan(a.equity);
  }, 60000);

  test('range-vs-hand mirrors hand-vs-range, and range-vs-range is closed', () => {
    const hvr = computeEquity(handTarget('AKo'), rangeTarget(TIGHT));
    const rvh = computeEquity(rangeTarget(TIGHT), handTarget('AKo'));
    expect(hvr.equity + rvh.equity).toBeCloseTo(1, 12);
    // The informative axis flips with the question being asked.
    expect(hvr.decomposition.axis).toBe('villain');
    expect(rvh.decomposition.axis).toBe('hero');
    expect(rvh.decomposition.elements).toHaveLength(4);

    const rvr = computeEquity(rangeTarget(TIGHT), rangeTarget('TT+,AQs+,AKo'));
    const flipped = computeEquity(rangeTarget('TT+,AQs+,AKo'), rangeTarget(TIGHT));
    expect(rvr.equity + flipped.equity).toBeCloseTo(1, 12);
    expect(rvr.decomposition.axis).toBe('hero');
  }, 300000);

  test('malformed range targets are refused, not coerced', () => {
    expect(() => computeEquity(handTarget('AA'), { type: 'range', range: new Float64Array(168) }))
      .toThrow(/169-element grid/);
    const negative = parseRangeString(TIGHT);
    negative[0] = -1;
    expect(() => computeEquity(handTarget('AA'), { type: 'range', range: negative }))
      .toThrow(/negative/);
    const nan = parseRangeString(TIGHT);
    nan[0] = NaN;
    expect(() => computeEquity(handTarget('AA'), { type: 'range', range: nan }))
      .toThrow(/not finite/);
  });
});

describe('combinatorics — comboCountAfterRemoval (WS-305)', () => {
  /** Brute-force count by enumerating combos and dropping any that use a dead card. */
  const bruteForce = (villainNotation, heroNotation) => {
    const heroCards = enumerateHandCombos(parseHandClass(heroNotation))[0];
    return enumerateHandCombos(parseHandClass(villainNotation)).filter((c) => (
      c[0] !== heroCards[0] && c[0] !== heroCards[1] &&
      c[1] !== heroCards[0] && c[1] !== heroCards[1]
    )).length;
  };

  const viaFormula = (villainNotation, heroNotation) => {
    const v = parseHandClass(villainNotation);
    const heroCards = enumerateHandCombos(parseHandClass(heroNotation))[0];
    const mask = (rank) => heroCards.reduce(
      (m, c) => ((c >> 2) === rank ? m | (1 << (c & 3)) : m), 0,
    );
    return comboCountAfterRemoval(v.pair, v.suited, mask(v.rankHigh), mask(v.rankLow));
  };

  test('unblocked counts are 6 / 4 / 12', () => {
    expect(comboCountAfterRemoval(true, false, 0, 0)).toBe(6);
    expect(comboCountAfterRemoval(false, true, 0, 0)).toBe(4);
    expect(comboCountAfterRemoval(false, false, 0, 0)).toBe(12);
  });

  test('matches brute-force enumeration across every blocking shape', () => {
    const villains = ['AA', 'KK', '77', 'AKs', 'AKo', 'A5s', 'QJs', 'QJo', '76s', '76o'];
    const heroes = ['AKs', 'AKo', 'AA', 'KK', '76s', '76o', 'QJo', 'T9s'];
    for (const v of villains) {
      for (const h of heroes) {
        expect(`${v}|${h}=${viaFormula(v, h)}`).toBe(`${v}|${h}=${bruteForce(v, h)}`);
      }
    }
  });

  test('is invariant to which suit representative does the blocking', () => {
    // The property that licenses class-level range weighting: the count depends
    // on which RANKS are dead, never on which suits they wore.
    const villain = parseHandClass('AKo');
    const suitedAce = comboCountAfterRemoval(villain.pair, villain.suited, 0b0001, 0b0010);
    const otherSuits = comboCountAfterRemoval(villain.pair, villain.suited, 0b0100, 0b1000);
    expect(suitedAce).toBe(otherSuits);
    expect(suitedAce).toBe(7);
  });
});

describe('preflopEquity — enumerateHeroVsCombosExact reference (WS-305)', () => {
  test('keeps every villain combo separate and drops impossible ones', () => {
    const heroCards = enumerateHandCombos(parseHandClass('AKs'))[0];
    const villainCombos = enumerateHandCombos(parseHandClass('AA'));
    const rows = enumerateHeroVsCombosExact(heroCards, villainCombos);
    // Hero holds one ace, so 3 of AA's 6 combos are impossible, not zero-weight.
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.boards).toBe(1712304); // C(48,5)
      expect(row.win + row.tie + row.lose).toBe(row.boards);
      expect(row.equity).toBeGreaterThan(0);
      expect(row.equity).toBeLessThan(0.25);
    }
    // Deterministic and order-preserving.
    const again = enumerateHeroVsCombosExact(heroCards, villainCombos);
    expect(again.map((r) => r.equity)).toEqual(rows.map((r) => r.equity));
  }, 60000);
});

describe('preflopEquity — performance', () => {
  beforeEach(() => {
    clearEquityCache();
  });

  test('single matchup completes under 10s on this machine', () => {
    const r = computeHandVsHand('AKo', 'JTo');
    // eslint-disable-next-line no-console
    console.log(`AKo vs JTo: ${(r.equity * 100).toFixed(2)}% — ${r.elapsedMs}ms — ${r.combosEvaluated} combo pairs`);
    expect(r.elapsedMs).toBeLessThan(10000);
  }, 15000);

  test('cache hit is sub-millisecond', () => {
    computeHandVsHand('AA', 'KK');
    const start = performance.now();
    const r = computeHandVsHand('AA', 'KK');
    const elapsed = performance.now() - start;
    expect(r.cached).toBe(true);
    expect(elapsed).toBeLessThan(5);
  }, 30000);
});
