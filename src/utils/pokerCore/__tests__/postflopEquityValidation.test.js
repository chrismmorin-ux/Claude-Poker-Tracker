/**
 * postflopEquityValidation.test.js — WS-324 Phase 2, postflop ground truth.
 *
 * The gap this closes (docs/research/math-validation-2026-08-01.md §5 item 1):
 * postflop equity was only ever checked against OUR OWN second implementation —
 * `evaluate7` against `bestFiveFromSeven`, exact enumeration against Monte Carlo.
 * Both sides are ours, so a shared bug in the evaluator passes every one of those
 * checks silently.
 *
 * Three kinds of ground truth here, none of which is "another one of our
 * evaluators agreeing with itself":
 *
 *   1. ANALYTIC FIXTURES — spots where the exact equity is derived by counting
 *      outs over a known denominator. The expected value is arithmetic, not a
 *      program's output. Each case carries its derivation.
 *   2. ANALYTIC INVARIANTS — complementarity and suit-isomorphism. These are
 *      mathematically necessary for ANY correct equity function, and hold
 *      independently of how hands are ranked.
 *   3. AN INDEPENDENT NAIVE EVALUATOR — written from scratch with a deliberately
 *      different algorithm (enumerate all C(7,5) subsets, classify by plain
 *      counting; no bit tricks, no lookup tables, no shared imports). This is
 *      what breaks the shared-bug risk in the optimized path.
 */

import { describe, it, expect } from 'vitest';
import { exactComboEquity } from '../monteCarloEquity';
import { bestFiveFromSeven } from '../handEvaluator';
import { parseAndEncode } from '../cardParser';

// 'Ah' -> encoded int. Suits in gameConstants are unicode; map from letters.
const SUIT_CHAR = { s: '♠', h: '♥', d: '♦', c: '♣' };
const C = (s) => {
  const encoded = parseAndEncode(s[0] + SUIT_CHAR[s[1]]);
  if (encoded < 0) throw new Error(`bad card literal: ${s}`);
  return encoded;
};
const H = (...cards) => cards.map(C);

describe('postflop equity — analytic fixtures (expected values are arithmetic)', () => {
  // Each case states the denominator and the winning count. Nothing here is
  // copied from a program's output.
  const cases = [
    {
      name: 'turn, hero has a flush draw + gutshot vs an overpair: exactly 12/44',
      hero: H('Ah', 'Kh'),
      villain: H('Ac', 'Ad'),
      board: H('Qh', 'Jh', '2c', '3d'),
      expected: 12 / 44,
      derivation: [
        '44 unknown cards (52 - 2 hero - 2 villain - 4 board).',
        'Hearts: 13 total - Ah,Kh,Qh,Jh = 9 remaining. Each makes hero the',
        '  A-high flush. Villain holds no heart, and the only board cards that',
        '  could pair into a full house (Qh,Jh) are already dealt. All 9 win.',
        'Tens: Th is already counted above. Tc,Td,Ts = 3 more, each making',
        '  hero AKQJT. Villain still holds only a pair of aces. All 3 win.',
        'Nothing else wins: a K gives hero kings < aces; the case As gives',
        '  villain trip aces.',
        '=> 9 + 3 = 12 wins, 0 ties, 32 losses.',
      ],
    },
    {
      name: 'turn, hero has trips vs an overpair with exactly 2 outs: 42/44',
      hero: H('2c', '2d'),
      villain: H('Ac', 'Ad'),
      board: H('2h', '5c', '7d', '9s'),
      expected: 42 / 44,
      derivation: [
        '44 unknown cards. Hero holds trip deuces, villain a pair of aces.',
        'Villain wins only by making trip aces: Ah, As = 2 cards.',
        'Every board pair (5,7,9) fills hero up (222 + a pair) and only gives',
        '  villain two pair, so those all lose for villain. The case 2s gives',
        '  hero quads.',
        '=> hero wins 42 of 44.',
      ],
    },
    {
      name: 'river, hero is drawing dead against quads: exactly 0',
      hero: H('2c', '3d'),
      villain: H('Ah', 'As'),
      board: H('Ac', 'Ad', 'Kh', 'Kd', '7c'),
      expected: 0,
      derivation: [
        'Board complete, so equity is 0, 0.5 or 1 with no enumeration.',
        'Villain holds four aces; hero plays the board for two pair.',
      ],
    },
    {
      name: 'river, both players play identical two pair: exactly 0.5',
      hero: H('Ac', 'Kc'),
      villain: H('Ad', 'Kd'),
      board: H('Ah', 'Kh', '2s', '3s', '7d'),
      expected: 0.5,
      derivation: [
        'Both make aces and kings with a 7 kicker. No flush is available:',
        '  hero holds two clubs, villain two diamonds, the board is 2 hearts',
        '  + 2 spades + 1 diamond.',
        'A tie counts 0.5.',
      ],
    },
    {
      name: 'river, hero holds the stone nuts: exactly 1',
      hero: H('Ah', 'Kh'),
      villain: H('Ac', 'Ad'),
      board: H('Qh', 'Jh', 'Th', '2c', '3d'),
      expected: 1,
      derivation: ['Hero has a royal flush. Nothing ties or beats it.'],
    },
    {
      name: 'flop, hero drawing dead with two cards to come: exactly 0',
      hero: H('2c', '3d'),
      villain: H('Ah', 'Ad'),
      board: H('Ac', 'As', 'Kh'),
      expected: 0,
      derivation: [
        'Villain already holds four aces on the flop. 2c3d cannot make a',
        '  straight flush with two cards to come, so hero wins no runout.',
        'Exercises the two-card enumeration path, C(45,2) = 990 runouts.',
      ],
    },
  ];

  for (const { name, hero, villain, board, expected } of cases) {
    it(name, () => {
      expect(exactComboEquity(hero, villain, board)).toBeCloseTo(expected, 9);
    });
  }
});

describe('postflop equity — analytic invariants', () => {
  // Deterministic LCG. Tests must not depend on Math.random.
  const lcg = (seed) => {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  };

  const dealSpot = (rand, boardSize) => {
    const seen = new Set();
    const draw = () => {
      let c;
      do { c = Math.floor(rand() * 52); } while (seen.has(c));
      seen.add(c);
      return c;
    };
    const hero = [draw(), draw()];
    const villain = [draw(), draw()];
    const board = Array.from({ length: boardSize }, draw);
    return { hero, villain, board };
  };

  it('hero equity + villain equity === 1 across random spots (ties split)', () => {
    const rand = lcg(20260801);
    for (let t = 0; t < 120; t++) {
      const boardSize = 3 + (t % 3);
      const { hero, villain, board } = dealSpot(rand, boardSize);
      const a = exactComboEquity(hero, villain, board);
      const b = exactComboEquity(villain, hero, board);
      expect(a + b, `trial ${t} board=${boardSize}`).toBeCloseTo(1, 9);
    }
  });

  it('equity is invariant under a consistent relabelling of the suits', () => {
    // card = rank * 4 + suit. Permuting suits consistently across hero, villain
    // and board produces an isomorphic spot, so equity must be IDENTICAL — not
    // merely close. Catches suit-handling bugs without reference to any ranker.
    const rand = lcg(987654321);
    const perms = [
      [1, 0, 3, 2],
      [3, 2, 1, 0],
      [1, 2, 3, 0],
      [2, 3, 0, 1],
    ];
    const relabel = (cards, perm) => cards.map((c) => (c >> 2) * 4 + perm[c & 3]);

    for (let t = 0; t < 90; t++) {
      const boardSize = 3 + (t % 3);
      const { hero, villain, board } = dealSpot(rand, boardSize);
      const base = exactComboEquity(hero, villain, board);
      const perm = perms[t % perms.length];
      const permuted = exactComboEquity(
        relabel(hero, perm),
        relabel(villain, perm),
        relabel(board, perm)
      );
      expect(permuted, `trial ${t} perm=${perm}`).toBeCloseTo(base, 12);
    }
  });
});

/**
 * An independent 7-card evaluator. Deliberately naive and written from scratch:
 * enumerate all 21 five-card subsets, classify each by plain rank/suit counting,
 * take the best. It shares NO code with handEvaluator.js.
 *
 * Absolute scores are not comparable between the two implementations, so the
 * assertion is on the COMPARISON: for any two 7-card hands, both must agree on
 * which one wins (or that they tie).
 */
describe('handEvaluator — agreement with an independent naive evaluator', () => {
  const naiveEval5 = (cards) => {
    const ranks = cards.map((c) => c >> 2);
    const suits = cards.map((c) => c & 3);
    const isFlush = suits.every((s) => s === suits[0]);

    const counts = new Map();
    for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
    // Group by count desc, then rank desc — the standard tiebreak ordering.
    const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    const uniq = [...new Set(ranks)].sort((a, b) => b - a);
    let straightHigh = -1;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      // Wheel A5432: ranks 12,3,2,1,0 — the ace plays low, so the high card is 5.
      else if (uniq[0] === 12 && uniq[1] === 3 && uniq[2] === 2 && uniq[3] === 1 && uniq[4] === 0) {
        straightHigh = 3;
      }
    }

    let cat;
    if (isFlush && straightHigh >= 0) cat = 8;
    else if (groups[0][1] === 4) cat = 7;
    else if (groups[0][1] === 3 && groups[1][1] === 2) cat = 6;
    else if (isFlush) cat = 5;
    else if (straightHigh >= 0) cat = 4;
    else if (groups[0][1] === 3) cat = 3;
    else if (groups[0][1] === 2 && groups[1][1] === 2) cat = 2;
    else if (groups[0][1] === 2) cat = 1;
    else cat = 0;

    const tb = cat === 8 || cat === 4 ? [straightHigh] : groups.map((g) => g[0]);
    return [cat, ...tb];
  };

  const cmpVec = (a, b) => {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i] ?? -1;
      const y = b[i] ?? -1;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  };

  const naiveBest7 = (cards) => {
    let best = null;
    for (let a = 0; a < 7; a++)
      for (let b = a + 1; b < 7; b++)
        for (let c = b + 1; c < 7; c++)
          for (let d = c + 1; d < 7; d++)
            for (let e = d + 1; e < 7; e++) {
              const v = naiveEval5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
              if (!best || cmpVec(v, best) > 0) best = v;
            }
    return best;
  };

  const sign = (n) => (n === 0 ? 0 : n < 0 ? -1 : 1);

  it('agrees on the winner across 20,000 random 7-card matchups', () => {
    let s = 424242 >>> 0;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

    let compared = 0;
    for (let t = 0; t < 20000; t++) {
      // Two players sharing a 5-card board — the shape that actually occurs.
      const seen = new Set();
      const draw = () => {
        let c;
        do { c = Math.floor(rand() * 52); } while (seen.has(c));
        seen.add(c);
        return c;
      };
      const board = [draw(), draw(), draw(), draw(), draw()];
      const a = [draw(), draw(), ...board];
      const b = [draw(), draw(), ...board];

      const mine = sign(bestFiveFromSeven(a) - bestFiveFromSeven(b));
      const naive = sign(cmpVec(naiveBest7(a), naiveBest7(b)));
      if (mine !== naive) {
        throw new Error(
          `disagreement on trial ${t}: production=${mine} naive=${naive}\n` +
          `  a=${a} b=${b}`
        );
      }
      compared++;
    }
    expect(compared).toBe(20000);
  });

  it('agrees on hand ordering for constructed category boundaries', () => {
    // Cases chosen where a naive and an optimized ranker can plausibly diverge.
    const pairs = [
      ['wheel straight vs six-high straight', H('Ah', '2c', '3d', '4s', '5h', 'Kc', 'Qd'), H('2h', '3c', '4d', '5s', '6h', 'Kc', 'Qd')],
      ['flush vs straight',                    H('Ah', 'Kh', 'Qh', '2h', '7h', '3c', '4d'), H('9c', 'Td', 'Jh', 'Qs', 'Kc', '2h', '3d')],
      ['full house vs flush',                  H('Ah', 'Ac', 'Ad', 'Kh', 'Kc', '2d', '3s'), H('Ah', 'Kh', 'Qh', '2h', '7h', '3c', '4d')],
      ['quads vs full house',                  H('Ah', 'Ac', 'Ad', 'As', 'Kc', '2d', '3s'), H('Ah', 'Ac', 'Ad', 'Kh', 'Kc', '2d', '3s')],
      ['straight flush vs quads',              H('9h', 'Th', 'Jh', 'Qh', 'Kh', '2c', '3d'), H('Ah', 'Ac', 'Ad', 'As', 'Kc', '2d', '3s')],
      ['two pair kicker battle',               H('Ah', 'Ac', 'Kd', 'Ks', 'Qc', '2d', '3s'), H('Ah', 'Ac', 'Kd', 'Ks', 'Jc', '2d', '3s')],
      ['wheel straight vs a pair of aces',     H('Ah', '2c', '3d', '4s', '5h', 'Kc', 'Qd'), H('Ah', 'Ac', 'Kd', '9s', '7c', '2d', '3s')],
      ['identical boards, split',              H('Ah', 'Kh', 'Qd', 'Js', 'Tc', '2d', '3s'), H('Ah', 'Kh', 'Qd', 'Js', 'Tc', '2d', '3s')],
    ];

    for (const [name, a, b] of pairs) {
      const mine = sign(bestFiveFromSeven(a) - bestFiveFromSeven(b));
      const naive = sign(cmpVec(naiveBest7(a), naiveBest7(b)));
      expect(mine, name).toBe(naive);
    }
  });
});
