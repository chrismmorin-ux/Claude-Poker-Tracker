/**
 * holdingKnowledge.test.js — the guards that make WS-292's rules structural.
 *
 * These are not coverage tests. Each one pins a rule that, if it silently broke, would
 * produce plausible wrong numbers rather than a failure — the failure family this engine
 * has been bitten by repeatedly (WS-285's unmeasured ordering comment, WS-291's doc the
 * data refuted, WS-300's index list naming the wrong hands).
 *
 * Ranges are built from NAMED HANDS via the shared fixtures, never grid-index literals
 * (WS-300: index 0 is `22`, not `AA`).
 */

import { describe, test, expect } from 'vitest';

import {
  openHolding, narrowHolding, revealHolding,
  holdingBelief, holdingTruth, holdingKnowledge,
  scoreCoverage, BASIS,
} from '../index';
import { narrowByBoard } from '../../exploitEngine/postflopNarrower';
import { parseAndEncode } from '../../pokerCore/cardParser';
import { tightRange, topRange, fullRange } from '../../exploitEngine/__tests__/fixtures/ranges';

// Suits are the Unicode symbols from `constants/gameConstants.SUITS` (['♠','♥','♦','♣']) —
// `parseAndEncode('As')` returns -1, not the ace of spades. Asserted below rather than
// trusted, because a fixture whose cards silently decode to -1 still runs and still passes
// shape assertions: the WS-300 family, where a label claims something the values contradict.
const cards = (...strs) => strs.map(parseAndEncode);
const FLOP = cards('A♠', '7♥', '2♦');
const TURN = cards('A♠', '7♥', '2♦', '9♣');

// A hand inside the tight fixture (AA,KK,QQ,JJ,TT,AKs,AKo,AQs,AQo) and one far outside it.
const IN_RANGE = cards('A♣', 'A♥');     // AA
const OUT_OF_RANGE = cards('5♣', '4♥'); // 54o — not a member of the tight fixture

test('fixture guard: every card in this file encodes to a real card', () => {
  for (const [name, set] of Object.entries({ FLOP, TURN, IN_RANGE, OUT_OF_RANGE })) {
    for (const c of set) {
      expect(c, `${name} contains an unparseable card`).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(52);
    }
  }
  expect(new Set([...FLOP, ...IN_RANGE, ...OUT_OF_RANGE]).size).toBe(7); // no accidental dupes
});

describe('WS-292: truth never reaches belief', () => {
  test('attaching a revealed hand does not move one float of the range', () => {
    const h = narrowHolding(
      openHolding({ seed: tightRange(), seedSource: 'baseline' }),
      { action: 'bet', board: FLOP, basis: BASIS.OBSERVED },
    );

    const before = holdingBelief(h).range;
    const revealed = revealHolding(h, IN_RANGE, { street: 'flop', order: 3 });
    const after = holdingBelief(revealed).range;

    // Same reference, not merely equal values — the strongest form of the guarantee.
    expect(after).toBe(before);
    expect(Array.from(after)).toEqual(Array.from(before));
  });

  test('the range is bit-identical whether the seat showed a hand inside or outside it', () => {
    const base = narrowHolding(
      openHolding({ seed: tightRange() }),
      { action: 'call', board: FLOP, basis: BASIS.OBSERVED },
    );
    const shownIn = holdingBelief(revealHolding(base, IN_RANGE)).range;
    const shownOut = holdingBelief(revealHolding(base, OUT_OF_RANGE)).range;

    // If truth ever fed back, the out-of-range reveal is precisely the case that would
    // widen the range — so equality here is the assertion that carries the rule.
    expect(Array.from(shownOut)).toEqual(Array.from(shownIn));
  });

  test('holdingBelief never exposes the revealed cards', () => {
    const h = revealHolding(openHolding({ seed: tightRange() }), IN_RANGE);
    expect(holdingBelief(h)).not.toHaveProperty('revealed');
    expect(holdingBelief(h)).not.toHaveProperty('truth');
    expect(Object.keys(holdingBelief(h)).sort()).toEqual(['provenance', 'range']);
  });

  test('holdingKnowledge withholds truth unless explicitly asked', () => {
    const h = revealHolding(openHolding({ seed: tightRange() }), IN_RANGE);
    expect(holdingKnowledge(h, { board: FLOP }).revealed).toBeNull();
    expect(holdingKnowledge(h, { board: FLOP, includeTruth: true }).revealed).toEqual(IN_RANGE);
  });
});

describe('WS-292: narrowing is a pass-through', () => {
  test('narrowHolding returns exactly what a bare narrowByBoard would', () => {
    const seed = tightRange();
    const opts = { playerStats: { style: 'TAG' } };

    const direct = narrowByBoard(seed, 'bet', FLOP, [], opts);
    const viaHolding = holdingBelief(narrowHolding(
      openHolding({ seed }), { action: 'bet', board: FLOP, deadCards: [], basis: BASIS.OBSERVED, options: opts },
    )).range;

    expect(Array.from(viaHolding)).toEqual(Array.from(direct));
  });

  test('chained narrowings match the equivalent chained bare calls', () => {
    const seed = topRange(30);
    let bare = narrowByBoard(seed, 'call', FLOP, []);
    bare = narrowByBoard(bare, 'call', TURN, []);

    let h = openHolding({ seed });
    h = narrowHolding(h, { action: 'call', board: FLOP, basis: BASIS.HYPOTHESIZED });
    h = narrowHolding(h, { action: 'call', board: TURN, basis: BASIS.HYPOTHESIZED });

    expect(Array.from(holdingBelief(h).range)).toEqual(Array.from(bare));
  });

  test('the input range is never mutated', () => {
    const seed = tightRange();
    const snapshot = Array.from(seed);
    narrowHolding(openHolding({ seed }), { action: 'raise', board: FLOP, basis: BASIS.OBSERVED });
    expect(Array.from(seed)).toEqual(snapshot);
  });
});

describe('WS-292: provenance counts what actually happened', () => {
  test('narrowingCount and streetsNarrowed are distinct numbers', () => {
    // Two narrowings across two streets — the legitimate flop depth-3 shape.
    let h = openHolding({ seed: tightRange() });
    h = narrowHolding(h, { action: 'call', board: FLOP, basis: BASIS.HYPOTHESIZED });
    h = narrowHolding(h, { action: 'call', board: TURN, basis: BASIS.HYPOTHESIZED });
    expect(holdingBelief(h).provenance.narrowingCount).toBe(2);
    expect(holdingBelief(h).provenance.streetsNarrowed).toBe(2);

    // Three narrowings across those SAME two streets — the WS-303 defect's shape. The
    // pair of numbers is what makes it visible; either alone looks unremarkable.
    const extra = narrowHolding(h, { action: 'call', board: TURN, basis: BASIS.HYPOTHESIZED });
    expect(holdingBelief(extra).provenance.narrowingCount).toBe(3);
    expect(holdingBelief(extra).provenance.streetsNarrowed).toBe(2);
  });

  test('observed and hypothesized steps are tallied separately', () => {
    let h = openHolding({ seed: tightRange(), seat: 4, handId: 'h1', seedSource: 'rangeProfile' });
    h = narrowHolding(h, { action: 'bet', board: FLOP, basis: BASIS.OBSERVED });
    h = narrowHolding(h, { action: 'call', board: TURN, basis: BASIS.HYPOTHESIZED });

    const p = holdingBelief(h).provenance;
    expect(p.observedNarrowings).toBe(1);
    expect(p.hypothesizedNarrowings).toBe(1);
    expect(p.seat).toBe(4);
    expect(p.handId).toBe('h1');
    expect(p.seedSource).toBe('rangeProfile');
    expect(p.narrowedBy.map((s) => `${s.action}@${s.street}/${s.basis}`))
      .toEqual(['bet@flop/observed', 'call@turn/hypothesized']);
  });

  test('an unrecognised basis throws rather than defaulting', () => {
    const h = openHolding({ seed: tightRange() });
    expect(() => narrowHolding(h, { action: 'bet', board: FLOP, basis: 'maybe' }))
      .toThrow(/basis must be one of/);
    expect(() => narrowHolding(h, { action: 'bet', board: FLOP }))
      .toThrow(/basis must be one of/);
  });
});

describe('WS-292: holdingTruth refuses what it cannot honestly score', () => {
  test('refuses on a range narrowed through a hypothesized branch', () => {
    let h = openHolding({ seed: tightRange() });
    h = narrowHolding(h, { action: 'bet', board: FLOP, basis: BASIS.OBSERVED });
    h = narrowHolding(h, { action: 'call', board: FLOP, basis: BASIS.HYPOTHESIZED });
    h = revealHolding(h, IN_RANGE);

    const t = holdingTruth(h, { board: FLOP });
    expect(t.refused).toBe(true);
    expect(t.reason).toBe('hypothesized');
  });

  test('scores a purely observed range', () => {
    let h = openHolding({ seed: tightRange() });
    h = narrowHolding(h, { action: 'bet', board: FLOP, basis: BASIS.OBSERVED });
    h = revealHolding(h, IN_RANGE, { street: 'flop', order: 2 });

    const t = holdingTruth(h, { board: FLOP });
    expect(t.refused).toBe(false);
    expect(t.covered).toBe(true);
    expect(t.weightOfTruth).toBeGreaterThan(0);
    expect(t.revealedAt).toEqual({ street: 'flop', order: 2 });
  });

  test('returns null — not a refusal — when nothing was shown', () => {
    const h = narrowHolding(openHolding({ seed: tightRange() }),
      { action: 'bet', board: FLOP, basis: BASIS.OBSERVED });
    expect(holdingTruth(h, { board: FLOP })).toBeNull();
  });

  test('refuses with a distinct reason when the revealed cards collide with the board', () => {
    const h = revealHolding(
      narrowHolding(openHolding({ seed: tightRange() }),
        { action: 'bet', board: FLOP, basis: BASIS.OBSERVED }),
      cards('A♠', 'K♦'), // A♠ is on the board
    );
    const t = holdingTruth(h, { board: FLOP });
    expect(t.refused).toBe(true);
    expect(t.reason).toBe('unscoreable');
  });
});

describe('WS-292: coverage scoring', () => {
  test('a FLAT range scores exactly zero lift — width is priced by retainedFraction, not lift', () => {
    // The baseline `u` is uniform over the range's own LIVE combos, not over the whole
    // deck. So a flat range assigns the true hand exactly what uniform-over-itself would:
    // lift is 0 by construction, however narrow the range is. This is the right split —
    // being narrow is scored by `retainedFraction`, being SHAPED is scored by `logLift` —
    // and it is worth an explicit test because "narrow range therefore positive lift" is
    // the intuitive reading and it is wrong.
    const scored = scoreCoverage(tightRange(), FLOP, IN_RANGE);
    expect(scored.covered).toBe(true);
    expect(scored.logLift).toBe(0);
    expect(scored.retainedFraction).toBeLessThan(1);
  });

  test('lift goes positive once narrowing SHAPES the range toward the hand held', () => {
    // Narrowing by a bet reweights combos by equity, so the flat fixture stops being flat
    // and AA — the best hand on A♠7♥2♦ — must gain weight relative to uniform.
    const shaped = narrowByBoard(tightRange(), 'bet', FLOP, []);
    const scored = scoreCoverage(shaped, FLOP, IN_RANGE);
    expect(scored.logLift).toBeGreaterThan(0);
  });

  test('a hand the range excludes scores as uncovered, with the lift clamped not infinite', () => {
    // Scored against the RAW fixture, which is a hard-edged test range. (The shipped engine
    // never produces one: WS-291's floor means narrowByBoard output always covers. That is
    // exactly why `covered` is documented as degenerate in production and `logLift` is the
    // signal to build on.)
    const scored = scoreCoverage(tightRange(), FLOP, OUT_OF_RANGE);
    expect(scored.covered).toBe(false);
    expect(scored.weightOfTruth).toBe(0);
    expect(Number.isFinite(scored.logLift)).toBe(true);
  });

  test('narrowing preserves a zero the seed already had — coverage comes from the SEED', () => {
    // WS-291's floor keeps SURVIVING cells positive; it does not resurrect a cell the
    // incoming range had at zero. Corpus coverage is 100% because the WS-302 preflop priors
    // (PRIOR_SUPPORT_LAMBDA = 0.8) seed every cell, not because narrowing adds support.
    // Pinning it here so the distinction cannot quietly invert.
    const narrowed = narrowByBoard(tightRange(), 'bet', FLOP, []);
    expect(scoreCoverage(narrowed, FLOP, OUT_OF_RANGE).covered).toBe(false);

    // Seeded from a range WITH support everywhere, the same hand is covered.
    const supported = narrowByBoard(fullRange(), 'bet', FLOP, []);
    expect(scoreCoverage(supported, FLOP, OUT_OF_RANGE).covered).toBe(true);
  });

  test('returns null on inputs that cannot be scored at all', () => {
    expect(scoreCoverage(tightRange(), [], IN_RANGE)).toBeNull();
    expect(scoreCoverage(tightRange(), FLOP, [IN_RANGE[0]])).toBeNull();
    expect(scoreCoverage(null, FLOP, IN_RANGE)).toBeNull();
  });
});
