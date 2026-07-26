import { describe, it, expect } from 'vitest';
import {
  derivePreflopDecisions,
  PARENT_ACTIONS,
  SUBCLASS_ACTIONS,
  SUBCLASS_PARENT,
  PARENT_SUBCLASSES,
} from '../lineTaxonomy';
import { wouldBeSqueeze, wouldBeColdCall } from '../../sequenceUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a preflop action sequence. Seats are strings (timeline convention).
 * @param {Array<[seat, action]>} pairs
 */
const seq = (pairs) =>
  pairs.map(([seat, action], i) => ({
    order: i + 1,
    seat: String(seat),
    action,
    street: 'preflop',
  }));

/** All entries strictly before the hero seat's first entry with `action`. */
const truncateBefore = (sequence, seat, action) => {
  const idx = sequence.findIndex(e => e.seat === String(seat) && e.action === action);
  return idx === -1 ? sequence : sequence.slice(0, idx);
};

const tags = (sequence, seat) =>
  derivePreflopDecisions(sequence, seat).map(d => `${d.parentAction}/${d.subAction}`);

// ---------------------------------------------------------------------------
// Structural maps
// ---------------------------------------------------------------------------

describe('taxonomy structure', () => {
  it('every subclass maps to exactly one parent, and every parent lists it back', () => {
    for (const [sub, parent] of Object.entries(SUBCLASS_PARENT)) {
      expect(PARENT_SUBCLASSES[parent]).toContain(sub);
    }
    const listed = Object.values(PARENT_SUBCLASSES).flat();
    expect(listed.sort()).toEqual(Object.keys(SUBCLASS_PARENT).sort());
  });

  it('subclasses never collide with parent names', () => {
    const parents = new Set(Object.values(PARENT_ACTIONS));
    for (const sub of Object.values(SUBCLASS_ACTIONS)) {
      expect(parents.has(sub)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// No-raise tree
// ---------------------------------------------------------------------------

describe('no-raise tree', () => {
  it('first-in raise is openFirstIn under the open parent', () => {
    const s = seq([[4, 'raise']]);
    expect(tags(s, 4)).toEqual([`${PARENT_ACTIONS.OPEN}/${SUBCLASS_ACTIONS.OPEN_FIRST_IN}`]);
  });

  it('raise over a limper is isoRaise under the open parent', () => {
    const s = seq([[4, 'call'], [6, 'raise']]);
    expect(tags(s, 6)).toEqual([`${PARENT_ACTIONS.OPEN}/${SUBCLASS_ACTIONS.ISO_RAISE}`]);
  });

  it('raise over multiple limpers is still isoRaise', () => {
    const s = seq([[4, 'call'], [5, 'call'], [6, 'call'], [7, 'raise']]);
    expect(tags(s, 7)).toEqual([`${PARENT_ACTIONS.OPEN}/${SUBCLASS_ACTIONS.ISO_RAISE}`]);
  });

  it("a seat's own earlier call does not make its later raise an isoRaise", () => {
    // Seat 4 limps, seat 6 raises, seat 4 re-raises → limpReraise, not isoRaise.
    const s = seq([[4, 'call'], [6, 'raise'], [4, 'raise']]);
    expect(tags(s, 4)).toEqual([
      `${PARENT_ACTIONS.LIMP}/null`,
      `${PARENT_ACTIONS.THREE_BET}/${SUBCLASS_ACTIONS.LIMP_RERAISE}`,
    ]);
  });

  it('limp with no raise behind yields a single limp decision', () => {
    const s = seq([[4, 'call'], [5, 'call']]);
    expect(tags(s, 4)).toEqual([`${PARENT_ACTIONS.LIMP}/null`]);
  });

  it('fold with no raise faced is a fold in the no-raise tree', () => {
    const s = seq([[4, 'fold']]);
    const [d] = derivePreflopDecisions(s, 4);
    expect(d.parentAction).toBe(PARENT_ACTIONS.FOLD);
    expect(d.facedRaise).toBe(false);
  });

  it('a check is never a classifiable range action (BB forced option)', () => {
    const s = seq([[4, 'call'], [3, 'check']]);
    expect(derivePreflopDecisions(s, 3)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Facing-raise tree
// ---------------------------------------------------------------------------

describe('facing-raise tree', () => {
  it('re-raise with no callers between is cold3Bet', () => {
    const s = seq([[4, 'raise'], [6, 'raise']]);
    expect(tags(s, 6)).toEqual([`${PARENT_ACTIONS.THREE_BET}/${SUBCLASS_ACTIONS.COLD_3BET}`]);
  });

  it('re-raise with a caller between is squeeze', () => {
    const s = seq([[4, 'raise'], [5, 'call'], [6, 'raise']]);
    expect(tags(s, 6)).toEqual([`${PARENT_ACTIONS.THREE_BET}/${SUBCLASS_ACTIONS.SQUEEZE}`]);
  });

  it('a caller BEFORE the raise does not make it a squeeze', () => {
    // Seat 5 limps, seat 4 iso-raises, seat 6 re-raises with nobody in between.
    const s = seq([[5, 'call'], [4, 'raise'], [6, 'raise']]);
    expect(tags(s, 6)).toEqual([`${PARENT_ACTIONS.THREE_BET}/${SUBCLASS_ACTIONS.COLD_3BET}`]);
  });

  it('cold call facing a raise is coldCall with no subclass', () => {
    const s = seq([[4, 'raise'], [6, 'call']]);
    expect(tags(s, 6)).toEqual([`${PARENT_ACTIONS.COLD_CALL}/null`]);
  });

  it('SB/BB 3-bets classify as cold3Bet — the blind3Bet merge (DEC-025)', () => {
    // Position is NOT an input here; the position dimension carries the blind
    // effect downstream via per-position priors.
    const s = seq([[4, 'raise'], [2, 'raise']]);
    expect(tags(s, 2)).toEqual([`${PARENT_ACTIONS.THREE_BET}/${SUBCLASS_ACTIONS.COLD_3BET}`]);
  });
});

// ---------------------------------------------------------------------------
// Limp-reraise — the previously invisible line
// ---------------------------------------------------------------------------

describe('limp-reraise', () => {
  it('emits BOTH limp and limpReraise (POKER_THEORY §2.5.4)', () => {
    const s = seq([[4, 'call'], [6, 'raise'], [4, 'raise']]);
    const decisions = derivePreflopDecisions(s, 4);

    expect(decisions).toHaveLength(2);
    expect(decisions[0]).toMatchObject({
      parentAction: PARENT_ACTIONS.LIMP,
      subAction: null,
      facedRaise: false,
    });
    expect(decisions[1]).toMatchObject({
      parentAction: PARENT_ACTIONS.THREE_BET,
      subAction: SUBCLASS_ACTIONS.LIMP_RERAISE,
      facedRaise: true,
    });
  });

  it('keeps the hand in the limp range so it never reads as capped (§5.8)', () => {
    const s = seq([[4, 'call'], [6, 'raise'], [4, 'raise']]);
    const parents = derivePreflopDecisions(s, 4).map(d => d.parentAction);
    expect(parents).toContain(PARENT_ACTIONS.LIMP);
  });

  it('limpReraise wins over squeeze when callers are also between', () => {
    const s = seq([[4, 'call'], [6, 'raise'], [7, 'call'], [4, 'raise']]);
    const decisions = derivePreflopDecisions(s, 4);
    expect(decisions[1].subAction).toBe(SUBCLASS_ACTIONS.LIMP_RERAISE);
  });

  it('limp-call emits only the limp (limp-call lives in the sub-action tree)', () => {
    const s = seq([[4, 'call'], [6, 'raise'], [4, 'call']]);
    expect(tags(s, 4)).toEqual([`${PARENT_ACTIONS.LIMP}/null`]);
  });

  it('limp-fold emits only the limp', () => {
    const s = seq([[4, 'call'], [6, 'raise'], [4, 'fold']]);
    expect(tags(s, 4)).toEqual([`${PARENT_ACTIONS.LIMP}/null`]);
  });
});

// ---------------------------------------------------------------------------
// The unmodelled 4-bet tree (WS-270)
// ---------------------------------------------------------------------------

describe('facing a 3-bet (WS-270 residual)', () => {
  it('a 4-bet counts in the threeBet PARENT with no subclass', () => {
    // Seat 4 opens, seat 6 three-bets, seat 4... is a limp-free re-raiser.
    // Use a fresh seat 7 cold-4betting to isolate the parent-only path.
    const s = seq([[4, 'raise'], [6, 'raise'], [7, 'raise']]);
    const [d] = derivePreflopDecisions(s, 7);
    expect(d.parentAction).toBe(PARENT_ACTIONS.THREE_BET);
    expect(d.subAction).toBeNull();
  });

  it('calling a 3-bet still counts in the coldCall parent', () => {
    const s = seq([[4, 'raise'], [6, 'raise'], [7, 'call']]);
    const [d] = derivePreflopDecisions(s, 7);
    expect(d.parentAction).toBe(PARENT_ACTIONS.COLD_CALL);
  });
});

// ---------------------------------------------------------------------------
// Straddle handling
// ---------------------------------------------------------------------------

describe('straddle', () => {
  it('a posted straddle is not the straddler\'s first voluntary action', () => {
    const s = seq([[9, 'straddle'], [4, 'call'], [9, 'raise']]);
    // The straddler's voluntary action is the raise, over a limper → isoRaise.
    expect(tags(s, 9)).toEqual([`${PARENT_ACTIONS.OPEN}/${SUBCLASS_ACTIONS.ISO_RAISE}`]);
  });

  it('a posted straddle is not a raise faced by other seats', () => {
    const s = seq([[9, 'straddle'], [4, 'raise']]);
    const [d] = derivePreflopDecisions(s, 4);
    expect(d.facedRaise).toBe(false);
    expect(d.parentAction).toBe(PARENT_ACTIONS.OPEN);
  });
});

// ---------------------------------------------------------------------------
// Parity with the live sequenceUtils predicates (accept criteria)
// ---------------------------------------------------------------------------

describe('parity with sequenceUtils live predicates', () => {
  const squeezeCases = [
    { name: 'raise + one caller', pairs: [[4, 'raise'], [5, 'call'], [6, 'raise']], hero: 6 },
    { name: 'raise + two callers', pairs: [[4, 'raise'], [5, 'call'], [7, 'call'], [6, 'raise']], hero: 6 },
    { name: 'raise, no caller', pairs: [[4, 'raise'], [6, 'raise']], hero: 6 },
    { name: 'limp then raise, no caller', pairs: [[5, 'call'], [4, 'raise'], [6, 'raise']], hero: 6 },
    { name: 'two raises already (4-bet spot)', pairs: [[4, 'raise'], [5, 'raise'], [6, 'raise']], hero: 6 },
  ];

  it.each(squeezeCases)('squeeze derivation matches wouldBeSqueeze — $name', ({ pairs, hero }) => {
    const full = seq(pairs);
    const before = truncateBefore(full, hero, 'raise');

    const derived = derivePreflopDecisions(full, hero)
      .some(d => d.subAction === SUBCLASS_ACTIONS.SQUEEZE);

    expect(derived).toBe(wouldBeSqueeze(before, String(hero)));
  });

  const coldCallCases = [
    { name: 'call facing a raise', pairs: [[4, 'raise'], [6, 'call']], hero: 6 },
    { name: 'call with no raise (limp)', pairs: [[6, 'call']], hero: 6 },
    { name: 'call behind a limper, no raise', pairs: [[4, 'call'], [6, 'call']], hero: 6 },
    { name: 'call facing a 3-bet', pairs: [[4, 'raise'], [5, 'raise'], [6, 'call']], hero: 6 },
  ];

  it.each(coldCallCases)('coldCall derivation matches wouldBeColdCall — $name', ({ pairs, hero }) => {
    const full = seq(pairs);
    const before = truncateBefore(full, hero, 'call');

    const derived = derivePreflopDecisions(full, hero)
      .some(d => d.parentAction === PARENT_ACTIONS.COLD_CALL);

    expect(derived).toBe(wouldBeColdCall(before, String(hero), 'preflop'));
  });
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

describe('guards', () => {
  it('returns [] for an empty or missing sequence', () => {
    expect(derivePreflopDecisions([], 4)).toEqual([]);
    expect(derivePreflopDecisions(null, 4)).toEqual([]);
  });

  it('returns [] when the seat never acted', () => {
    expect(derivePreflopDecisions(seq([[4, 'raise']]), 9)).toEqual([]);
  });

  it('accepts numeric or string seats interchangeably', () => {
    const s = seq([[4, 'raise']]);
    expect(derivePreflopDecisions(s, 4)).toEqual(derivePreflopDecisions(s, '4'));
  });

  it('classifies from order, not array position', () => {
    const shuffled = [
      { order: 3, seat: '6', action: 'raise', street: 'preflop' },
      { order: 1, seat: '4', action: 'raise', street: 'preflop' },
      { order: 2, seat: '5', action: 'call', street: 'preflop' },
    ];
    expect(tags(shuffled, 6)).toEqual([`${PARENT_ACTIONS.THREE_BET}/${SUBCLASS_ACTIONS.SQUEEZE}`]);
  });
});
