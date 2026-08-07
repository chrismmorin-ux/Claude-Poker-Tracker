import { describe, test, expect } from 'vitest';
import { mulberry32, makeSeededEquityFn } from '../backtest/seededEquity.mjs';
import { createRange, rangeIndex } from '../../src/utils/pokerCore/rangeMatrix';
import { encodeCard } from '../../src/utils/pokerCore/cardParser';

// WS-433: the seeded equityFn the worker binds per evaluateGameTree call.
// Determinism here is what makes bit-identical parallel-vs-serial possible
// at refinementBudgetMs 0.

const RANK_VALUE = { A: 12, K: 11, Q: 10, J: 9, T: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 3: 1, 2: 0 };
const SUIT_VALUE = { s: 0, h: 1, d: 2, c: 3 };
const card = (s) => encodeCard(RANK_VALUE[s[0]], SUIT_VALUE[s[1]]);

const wideRange = () => {
  const r = createRange();
  // A handful of cells with spread weights — enough combos that sampling matters.
  r[rangeIndex(12, 12, false)] = 1.0;  // AA
  r[rangeIndex(11, 11, false)] = 0.8;  // KK
  r[rangeIndex(12, 11, true)] = 0.6;   // AKs
  r[rangeIndex(8, 7, true)] = 0.5;     // T9s
  r[rangeIndex(4, 4, false)] = 0.4;    // 66
  return r;
};

const stripElapsed = ({ elapsed, ...rest }) => rest;

describe('mulberry32', () => {
  test('golden vector — freezes the generator construction', () => {
    // If this changes, every stamped seed in every chunk artifact means
    // something different. The construction is load-bearing, not stylistic.
    const rng = mulberry32(42);
    const draws = [rng(), rng(), rng()];
    expect(draws).toEqual([
      0.6011037519201636,
      0.44829055899754167,
      0.8524657934904099,
    ]);
  });

  test('same seed ⇒ same stream; different seed ⇒ different stream', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const c = mulberry32(124);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    const seqC = [c(), c(), c(), c()];
    expect(seqB).toEqual(seqA);
    expect(seqC).not.toEqual(seqA);
  });
});

describe('makeSeededEquityFn', () => {
  const hero = [card('As'), card('Kd')];
  const board = [card('7c'), card('8d'), card('2h')];
  const opts = { trials: 2000, minTrials: 500, convergenceThreshold: 0.02 };

  test('same seed ⇒ identical equity result including trial count', async () => {
    const a = await makeSeededEquityFn(1337)(hero, wideRange(), board, { ...opts });
    const b = await makeSeededEquityFn(1337)(hero, wideRange(), board, { ...opts });
    expect(stripElapsed(b)).toEqual(stripElapsed(a));
  }, 30000);

  test('different seeds ⇒ different draws', async () => {
    const noConverge = { trials: 1000, minTrials: 1000, convergenceThreshold: 0 };
    const a = await makeSeededEquityFn(1)(hero, wideRange(), board, { ...noConverge });
    const b = await makeSeededEquityFn(2)(hero, wideRange(), board, { ...noConverge });
    expect([b.win, b.tie, b.lose]).not.toEqual([a.win, a.tie, a.lose]);
  }, 30000);

  test('refuses a caller-supplied rng — double-seeding is always a bug', async () => {
    const fn = makeSeededEquityFn(9);
    await expect(async () => fn(hero, wideRange(), board, { rng: Math.random }))
      .rejects.toThrow(/double-seed/);
  });
});
