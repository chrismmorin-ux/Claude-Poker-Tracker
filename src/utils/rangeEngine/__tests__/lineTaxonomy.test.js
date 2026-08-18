import { describe, it, expect } from 'vitest';
import {
  derivePreflopDecisions,
  PARENT_ACTIONS,
  SUBCLASS_ACTIONS,
  SUBCLASS_PARENT,
  PARENT_SUBCLASSES,
  SCENARIOS,
  PRIOR_ROLES,
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

describe('facing a 3-bet — the third tree (WS-521 / WS-270)', () => {
  // This block previously asserted the RESIDUAL: 4-bets counted in the `threeBet`
  // parent with `subAction: null`, and calls of a 3-bet counted as `coldCall`.
  // POKER_THEORY §2.5.3 named that residual "WS-270's slice, left with the parent".
  // The third tree now claims it, so those two assertions are inverted here.

  it('a cold 4-bet is the fourBet parent, subclass cold4Bet', () => {
    const s = seq([[4, 'raise'], [6, 'raise'], [7, 'raise']]);
    const [d] = derivePreflopDecisions(s, 7);
    expect(d.parentAction).toBe(PARENT_ACTIONS.FOUR_BET);
    expect(d.subAction).toBe(SUBCLASS_ACTIONS.COLD_4BET);
    expect(d.scenario).toBe(SCENARIOS.FACED_3BET);
    expect(d.raisesFaced).toBe(2);
  });

  it('calling a 3-bet is call4, not coldCall', () => {
    const s = seq([[4, 'raise'], [6, 'raise'], [7, 'call']]);
    const [d] = derivePreflopDecisions(s, 7);
    expect(d.parentAction).toBe(PARENT_ACTIONS.CALL4);
    expect(d.scenario).toBe(SCENARIOS.FACED_3BET);
  });

  // ── The defect WS-521 was filed for ──────────────────────────────────────
  // Before the fix these three produced exactly ONE record (`open`), because the
  // second emission was guarded on `if (seatLimped)`. The opener's response to a
  // 3-bet was emitted nowhere and subActionExtractor has no notion of `open`.

  it('opener who 4-bets emits BOTH open and fourBet/fourBetAfterOpen', () => {
    const s = seq([[9, 'raise'], [4, 'raise'], [9, 'raise']]);
    expect(tags(s, 9)).toEqual([
      `${PARENT_ACTIONS.OPEN}/${SUBCLASS_ACTIONS.OPEN_FIRST_IN}`,
      `${PARENT_ACTIONS.FOUR_BET}/${SUBCLASS_ACTIONS.FOUR_BET_AFTER_OPEN}`,
    ]);
  });

  it('opener who folds to a 3-bet emits a second, fold decision', () => {
    const s = seq([[9, 'raise'], [4, 'raise'], [9, 'fold']]);
    const d = derivePreflopDecisions(s, 9);
    expect(d).toHaveLength(2);
    expect(d[0].parentAction).toBe(PARENT_ACTIONS.OPEN);
    expect(d[1].parentAction).toBe(PARENT_ACTIONS.FOLD);
    expect(d[1].scenario).toBe(SCENARIOS.FACED_3BET);
  });

  it('opener who calls a 3-bet emits open then call4', () => {
    const s = seq([[9, 'raise'], [4, 'raise'], [9, 'call']]);
    const d = derivePreflopDecisions(s, 9);
    expect(d.map(x => x.parentAction)).toEqual([
      PARENT_ACTIONS.OPEN,
      PARENT_ACTIONS.CALL4,
    ]);
  });

  it('a seat that limped then 4-bets is a documented residual — parent only', () => {
    // Prior investment but no prior aggression: neither cold nor after-open.
    const s = seq([[9, 'call'], [4, 'raise'], [6, 'raise'], [9, 'raise']]);
    const d = derivePreflopDecisions(s, 9);
    const last = d[d.length - 1];
    expect(last.parentAction).toBe(PARENT_ACTIONS.FOUR_BET);
    expect(last.subAction).toBeNull();
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

  // `wouldBeColdCall` is a street-generic AFFORDANCE predicate: "this seat has not
  // acted on this street and there is a bet level to call". It does not count raises
  // and cannot distinguish calling an open from calling a 3-bet. Parity therefore
  // holds only inside the one-raise tree; the two-raise case is asserted separately
  // below as a DELIBERATE divergence, not left as an untested gap.
  const coldCallCases = [
    { name: 'call facing a raise', pairs: [[4, 'raise'], [6, 'call']], hero: 6 },
    { name: 'call with no raise (limp)', pairs: [[6, 'call']], hero: 6 },
    { name: 'call behind a limper, no raise', pairs: [[4, 'call'], [6, 'call']], hero: 6 },
  ];

  it.each(coldCallCases)('coldCall derivation matches wouldBeColdCall — $name', ({ pairs, hero }) => {
    const full = seq(pairs);
    const before = truncateBefore(full, hero, 'call');

    const derived = derivePreflopDecisions(full, hero)
      .some(d => d.parentAction === PARENT_ACTIONS.COLD_CALL);

    expect(derived).toBe(wouldBeColdCall(before, String(hero), 'preflop'));
  });

  it('call facing a 3-bet DIVERGES from wouldBeColdCall — by design', () => {
    const full = seq([[4, 'raise'], [5, 'raise'], [6, 'call']]);
    const before = truncateBefore(full, 6, 'call');

    // The affordance predicate still says "yes, that is a cold call" …
    expect(wouldBeColdCall(before, '6', 'preflop')).toBe(true);

    // … but the taxonomy puts it in the third tree, because the price, the SPR and
    // the opposing range facing a 3-bet are a different decision from calling an
    // open. Lumping them is precisely what §2.5 exists to prevent.
    const d = derivePreflopDecisions(full, 6);
    expect(d.some(x => x.parentAction === PARENT_ACTIONS.COLD_CALL)).toBe(false);
    expect(d.some(x => x.parentAction === PARENT_ACTIONS.CALL4)).toBe(true);
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

// ---------------------------------------------------------------------------
// The conditioning set inside the third tree (WS-521 follow-up)
// ---------------------------------------------------------------------------

describe('priorRole — the conditioning set the measured prior actually describes', () => {
  /** The role attached to a seat's facing-3-bet decision, or undefined if it has none. */
  const roleAt = (sequence, seat) =>
    derivePreflopDecisions(sequence, seat)
      .filter(d => d.scenario === SCENARIOS.FACED_3BET)
      .map(d => d.priorRole)[0];

  it('the OPENER who faces a 3-bet is the role FOUR_BET_FREQUENCIES was measured on', () => {
    // 6 opens, 8 3-bets, 6 must now act facing two raises.
    const s = seq([[6, 'raise'], [8, 'raise'], [6, 'fold']]);
    expect(roleAt(s, 6)).toBe(PRIOR_ROLES.OPENER);
  });

  it('a seat entering COLD over an open and a 3-bet is a different population', () => {
    const s = seq([[6, 'raise'], [8, 'raise'], [9, 'fold']]);
    expect(roleAt(s, 9)).toBe(PRIOR_ROLES.COLD);
  });

  it('a seat that LIMPED then faces a 3-bet is neither — investment without aggression', () => {
    const s = seq([[6, 'call'], [8, 'raise'], [9, 'raise'], [6, 'fold']]);
    expect(roleAt(s, 6)).toBe(PRIOR_ROLES.PASSIVE);
  });

  it('a seat that COLD-CALLED then faces a 3-bet is passive, not cold', () => {
    const s = seq([[6, 'raise'], [7, 'call'], [9, 'raise'], [7, 'fold']]);
    expect(roleAt(s, 7)).toBe(PRIOR_ROLES.PASSIVE);
  });

  it('the role is carried by EVERY branch, not just the 4-bet one — the defect it closes', () => {
    // fold / call / raise from the same opener spot must all be conditioned.
    for (const act of ['fold', 'call', 'raise']) {
      const s = seq([[6, 'raise'], [8, 'raise'], [6, act]]);
      expect(roleAt(s, 6)).toBe(PRIOR_ROLES.OPENER);
    }
  });

  it('is NULL outside the third tree — the distinction does not exist there', () => {
    const s = seq([[6, 'raise'], [8, 'call']]);
    for (const d of derivePreflopDecisions(s, 8)) {
      expect(d.scenario).not.toBe(SCENARIOS.FACED_3BET);
      expect(d.priorRole).toBeNull();
    }
  });

  it('role and 4-bet SUBCLASS agree by construction — they read one fact', () => {
    const openerRaises = seq([[6, 'raise'], [8, 'raise'], [6, 'raise']]);
    const coldRaises = seq([[6, 'raise'], [8, 'raise'], [9, 'raise']]);

    const opener = derivePreflopDecisions(openerRaises, 6).find(d => d.parentAction === PARENT_ACTIONS.FOUR_BET);
    expect(opener.priorRole).toBe(PRIOR_ROLES.OPENER);
    expect(opener.subAction).toBe(SUBCLASS_ACTIONS.FOUR_BET_AFTER_OPEN);

    const cold = derivePreflopDecisions(coldRaises, 9).find(d => d.parentAction === PARENT_ACTIONS.FOUR_BET);
    expect(cold.priorRole).toBe(PRIOR_ROLES.COLD);
    expect(cold.subAction).toBe(SUBCLASS_ACTIONS.COLD_4BET);
  });
});
