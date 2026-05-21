import { describe, test, expect } from 'vitest';
import { handVsRange, handVsRangesMW, exactComboEquity } from '../monteCarloEquity';
import { encodeCard } from '../cardParser';

// Letter-notation card builder ("As", "Th", "2c") → encoded int.
// cardParser's parseAndEncode expects unicode suit glyphs; tests use letters.
const RANK_VALUE = { A: 12, K: 11, Q: 10, J: 9, T: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 3: 1, 2: 0 };
const SUIT_VALUE = { s: 0, h: 1, d: 2, c: 3 };
const card = (s) => encodeCard(RANK_VALUE[s[0]], SUIT_VALUE[s[1]]);
import { createRange, rangeIndex } from '../rangeMatrix';
import { parseHandClass, enumerateHandCombos } from '../preflopEquity';

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

describe('handVsRangesMW — HU-degenerate parity with handVsRange', () => {
  // Single-villain MW must produce equity within MC variance of single-villain
  // handVsRange. This is the load-bearing parity check: if the MW trial loop
  // diverges from the HU loop at N=1, downstream MW math is suspect.
  const cases = [
    ['AA', 'KK'],
    ['AKs', 'JJ'],
    ['77', 'AKo'],
    ['AKo', 'T9s'],
  ];

  for (const [hero, villain] of cases) {
    test(`${hero} vs single ${villain} range — MW (N=1) ≈ HU within combined CI`, async () => {
      const heroCards = canonicalCards(hero);
      const villainRange = buildSingleCellRange(villain);

      const huResult = await handVsRange(heroCards, villainRange, [], {
        trials: 20000,
        minTrials: 2000,
        convergenceThreshold: 0.005,
      });
      const mwResult = await handVsRangesMW(heroCards, [villainRange], [], {
        trials: 20000,
        minTrials: 2000,
        convergenceThreshold: 0.005,
      });

      // Combined 95% CI tolerance + small float-rounding margin.
      const tolerance = huResult.ciHalf + mwResult.ciHalf + 0.01;
      expect(Math.abs(huResult.equity - mwResult.equity)).toBeLessThanOrEqual(tolerance);
      expect(mwResult.perVillainBeatRate).toHaveLength(1);
      expect(mwResult.perVillainBeatRate[0].index).toBe(0);
    }, 30000);
  }
});

describe('handVsRangesMW — output shape', () => {
  test('perVillainBeatRate length matches villainRanges length', async () => {
    const heroCards = canonicalCards('AA');
    const v1 = buildSingleCellRange('KK');
    const v2 = buildSingleCellRange('QQ');

    const result = await handVsRangesMW(heroCards, [v1, v2], [], {
      trials: 2000,
      minTrials: 500,
    });

    expect(result.perVillainBeatRate).toHaveLength(2);
    expect(result.perVillainBeatRate[0]).toMatchObject({ index: 0 });
    expect(result.perVillainBeatRate[1]).toMatchObject({ index: 1 });
    expect(result.perVillainBeatRate[0].beatRate).toBeGreaterThanOrEqual(0);
    expect(result.perVillainBeatRate[0].beatRate).toBeLessThanOrEqual(1);
  }, 30000);

  test('returns CI fields and trials count', async () => {
    const heroCards = canonicalCards('AA');
    const v1 = buildSingleCellRange('KK');

    const result = await handVsRangesMW(heroCards, [v1], [], {
      trials: 1000,
      minTrials: 200,
    });

    expect(result).toMatchObject({
      equity: expect.any(Number),
      win: expect.any(Number),
      tie: expect.any(Number),
      lose: expect.any(Number),
      trials: expect.any(Number),
      ciLow: expect.any(Number),
      ciHigh: expect.any(Number),
    });
    expect(result.trials).toBeGreaterThan(0);
    expect(result.ciLow).toBeLessThanOrEqual(result.equity);
    expect(result.ciHigh).toBeGreaterThanOrEqual(result.equity);
  }, 30000);

  test('empty villainRanges array returns auto-win', async () => {
    const heroCards = canonicalCards('AA');
    const result = await handVsRangesMW(heroCards, [], [], { trials: 100 });
    expect(result.equity).toBe(1.0);
    expect(result.trials).toBe(0);
    expect(result.perVillainBeatRate).toHaveLength(0);
  });
});

describe('handVsRangesMW — multiway equity is below per-villain 1v1', () => {
  // Theoretical correctness check: hero's true 3-way equity vs (R1, R2) must
  // be ≤ min(equity(hero, R1), equity(hero, R2)), because adding a second
  // villain can only steal pots, never give equity back. This is the precise
  // dynamic per-villain 1v1 cannot model.
  test('AA vs (KK, QQ) — 3-way equity ≤ min(AA-vs-KK, AA-vs-QQ)', async () => {
    const heroCards = canonicalCards('AA');
    const kk = buildSingleCellRange('KK');
    const qq = buildSingleCellRange('QQ');

    const aaVsKk = await handVsRange(heroCards, kk, [], {
      trials: 30000,
      minTrials: 3000,
      convergenceThreshold: 0.003,
    });
    const aaVsQq = await handVsRange(heroCards, qq, [], {
      trials: 30000,
      minTrials: 3000,
      convergenceThreshold: 0.003,
    });
    const aaVs3way = await handVsRangesMW(heroCards, [kk, qq], [], {
      trials: 30000,
      minTrials: 3000,
      convergenceThreshold: 0.003,
    });

    // Allow combined CI as tolerance (the inequality holds in expectation).
    const tolerance = aaVsKk.ciHalf + aaVsQq.ciHalf + aaVs3way.ciHalf + 0.01;
    const minSingle = Math.min(aaVsKk.equity, aaVsQq.equity);
    expect(aaVs3way.equity).toBeLessThanOrEqual(minSingle + tolerance);
  }, 60000);
});

describe('handVsRangesMW — board scenarios', () => {
  test('runs on flop (3-card board) without error', async () => {
    const heroCards = [encodeCard(12, 0), encodeCard(12, 1)]; // AA
    const board = [encodeCard(7, 2), encodeCard(5, 1), encodeCard(2, 3)]; // 9c-7d-4s
    const v1 = buildSingleCellRange('KK');
    const v2 = buildSingleCellRange('QQ');

    const result = await handVsRangesMW(heroCards, [v1, v2], board, {
      trials: 1000,
      minTrials: 200,
    });

    expect(result.equity).toBeGreaterThan(0.5);
    expect(result.equity).toBeLessThan(1.0);
    expect(result.trials).toBeGreaterThan(0);
  }, 30000);

  test('runs on turn (4-card board)', async () => {
    const heroCards = [encodeCard(12, 0), encodeCard(12, 1)];
    const board = [encodeCard(7, 2), encodeCard(5, 1), encodeCard(2, 3), encodeCard(10, 0)];
    const v1 = buildSingleCellRange('KK');
    const v2 = buildSingleCellRange('QQ');

    const result = await handVsRangesMW(heroCards, [v1, v2], board, {
      trials: 500,
      minTrials: 100,
    });

    expect(result.trials).toBeGreaterThan(0);
    expect(result.equity).toBeGreaterThan(0);
  }, 15000);
});

describe('exactComboEquity — deterministic per-combo equity (WS-205)', () => {
  const cards = (str) => str.trim().split(/\s+/).map(card);

  test('river: made flush beats trips → hero equity 1.0', () => {
    const hero = cards('Qh Jh');
    const villain = cards('2h 2d'); // trip deuces
    const board = cards('Ah Kh 7h 2c 3d'); // hero has A-high heart flush
    expect(exactComboEquity(hero, villain, board)).toBe(1.0);
    expect(exactComboEquity(villain, hero, board)).toBe(0.0);
  });

  test('river: identical board hands chop → 0.5 each', () => {
    const hero = cards('Ac Kd');
    const villain = cards('Ah Ks');
    const board = cards('Qc Jd Th 5s 4c'); // both play the board's broadway straight? AKxQJT = AKQJT
    // Hero: A K Q J T = Broadway. Villain: A K Q J T = Broadway. Chop.
    expect(exactComboEquity(hero, villain, board)).toBe(0.5);
  });

  test('flop: AA dominates KK on a dry board', () => {
    const hero = cards('Ac Ad');
    const villain = cards('Ks Kh');
    const board = cards('2c 7d Th');
    const eq = exactComboEquity(hero, villain, board);
    expect(eq).toBeGreaterThan(0.75);
    expect(eq).toBeLessThan(0.95);
  });

  test('symmetry: hero equity + villain equity === 1 on every street', () => {
    const a = cards('Ac Ad');
    const b = cards('Ks Kh');
    for (const board of [cards('2c 7d Th'), cards('2c 7d Th 9s'), cards('2c 7d Th 9s 4d')]) {
      const eqAB = exactComboEquity(a, b, board);
      const eqBA = exactComboEquity(b, a, board);
      expect(eqAB + eqBA).toBeCloseTo(1, 10);
    }
  });

  test('determinism: identical inputs yield identical output (no RNG)', () => {
    const hero = cards('As Ks');
    const villain = cards('Qd Qc');
    const board = cards('Js Td 3c'); // flop — the expensive enumeration path
    const first = exactComboEquity(hero, villain, board);
    const second = exactComboEquity(hero, villain, board);
    expect(second).toBe(first);
  });

  test('illegal matchup (shared card) returns NaN', () => {
    const hero = cards('Ah Kh');
    const villain = cards('Ah Qd'); // shares Ah with hero
    const board = cards('2c 7d Th');
    expect(Number.isNaN(exactComboEquity(hero, villain, board))).toBe(true);
  });

  test('board collision returns NaN', () => {
    const hero = cards('Ah Kh');
    const villain = cards('2c Qd'); // 2c is on the board
    const board = cards('2c 7d Th');
    expect(Number.isNaN(exactComboEquity(hero, villain, board))).toBe(true);
  });

  test('rejects a board outside 3–5 cards', () => {
    const hero = cards('Ah Kh');
    const villain = cards('Qd Qc');
    expect(() => exactComboEquity(hero, villain, cards('2c 7d'))).toThrow(RangeError);
    expect(() => exactComboEquity(hero, villain, cards('2c 7d Th 9s 4d 5h'))).toThrow(RangeError);
  });
});
