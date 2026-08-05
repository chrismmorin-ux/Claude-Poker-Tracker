/**
 * taxonomyInvariants.test.js — WS-256 accept-criteria guards.
 *
 * These are the assertions that keep the derived line taxonomy honest:
 * parent invariance, the sum invariant, hierarchical shrinkage behavior,
 * limp-reraise visibility, and persistence compat.
 */

import { describe, it, expect } from 'vitest';
import { buildRangeProfile } from '../index';
import {
  RANGE_POSITIONS,
  RANGE_PARENT_ACTIONS,
  RANGE_SUBCLASS_ACTIONS,
  serializeProfile,
  deserializeProfile,
} from '../rangeProfile';
import { PARENT_SUBCLASSES } from '../lineTaxonomy';
import { SUBCLASS_SPLIT, SUBCLASS_PRIOR_WEIGHT } from '../populationPriors';
import { rangeWidth, rangeIndex } from '../../pokerCore/rangeMatrix';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeHand = ({ playerId, playerSeat, dealerSeat = 1, actions, cards = null }) => {
  const actionSequence = actions.map((a, i) => ({
    order: i + 1,
    seat: String(a.seat),
    action: a.action,
    street: 'preflop',
  }));

  const hand = {
    handId: `t-${playerSeat}-${actionSequence.map(a => a.action).join('')}-${Math.random()}`,
    seatPlayers: { [String(playerSeat)]: String(playerId) },
    gameState: { dealerButtonSeat: dealerSeat, actionSequence },
    cardState: {},
  };
  if (cards) hand.cardState.allPlayerCards = { [String(playerSeat)]: cards };
  return hand;
};

/** Hero at seat 9 (LATE with dealer=1). Villain opener at seat 4. */
const HERO = { playerId: 1, playerSeat: 9 };

const openHand = () => makeHand({ ...HERO, actions: [{ seat: 9, action: 'raise' }] });
const isoHand = () => makeHand({ ...HERO, actions: [
  { seat: 4, action: 'call' }, { seat: 9, action: 'raise' },
]});
const cold3BetHand = () => makeHand({ ...HERO, actions: [
  { seat: 4, action: 'raise' }, { seat: 9, action: 'raise' },
]});
const squeezeHand = () => makeHand({ ...HERO, actions: [
  { seat: 4, action: 'raise' }, { seat: 5, action: 'call' }, { seat: 9, action: 'raise' },
]});
const limpReraiseHand = () => makeHand({ ...HERO, actions: [
  { seat: 9, action: 'call' }, { seat: 4, action: 'raise' }, { seat: 9, action: 'raise' },
]});
const coldCallHand = () => makeHand({ ...HERO, actions: [
  { seat: 4, action: 'raise' }, { seat: 9, action: 'call' },
]});
const foldHand = () => makeHand({ ...HERO, actions: [
  { seat: 4, action: 'raise' }, { seat: 9, action: 'fold' },
]});
const limpHand = () => makeHand({ ...HERO, actions: [{ seat: 9, action: 'call' }] });

const build = (hands) => buildRangeProfile(1, hands, 'user-1');

const repeat = (fn, n) => Array.from({ length: n }, fn);

/**
 * Independent reimplementation of the PRE-taxonomy classification rule:
 * classify the seat's FIRST preflop action only. Used as the control for
 * parent invariance — deliberately not sharing code with the implementation.
 */
const legacyClassify = (hand, seat) => {
  const seq = hand.gameState.actionSequence;
  const mine = seq.filter(e => e.seat === String(seat));
  if (mine.length === 0) return { action: 'fold', facedRaise: false };

  const first = mine[0];
  const facedRaise = seq.some(
    e => e.order < first.order && e.seat !== String(seat) && e.action === 'raise'
  );

  if (first.action === 'fold') return { action: 'fold', facedRaise };
  if (first.action === 'call') return { action: facedRaise ? 'coldCall' : 'limp', facedRaise };
  if (first.action === 'raise') return { action: facedRaise ? 'threeBet' : 'open', facedRaise };
  return null;
};

const legacyCounts = (hands, seat) => {
  const counts = {};
  for (const a of RANGE_PARENT_ACTIONS) counts[a] = 0;
  for (const hand of hands) {
    const c = legacyClassify(hand, seat);
    if (c) counts[c.action]++;
  }
  return counts;
};

// ---------------------------------------------------------------------------
// Parent invariance — the key regression guard
// ---------------------------------------------------------------------------

describe('parent invariance', () => {
  const noLimpReraise = [
    ...repeat(openHand, 3),
    ...repeat(isoHand, 2),
    ...repeat(cold3BetHand, 2),
    ...repeat(squeezeHand, 2),
    ...repeat(coldCallHand, 4),
    ...repeat(foldHand, 5),
    ...repeat(limpHand, 3),
  ];

  it('parent counts match the pre-taxonomy rule exactly when no hand has a limp-reraise', () => {
    const profile = build(noLimpReraise);
    const expected = legacyCounts(noLimpReraise, 9);

    // Hero is LATE (seat 9, dealer 1); all fixtures use that seat.
    const actual = profile.actionCounts.LATE;
    for (const parent of RANGE_PARENT_ACTIONS) {
      expect(actual[parent], `parent ${parent}`).toBe(expected[parent]);
    }
  });

  it('scenario opportunity totals are unchanged when no hand has a limp-reraise', () => {
    const profile = build(noLimpReraise);
    const opp = profile.opportunities.LATE;
    expect(opp.total).toBe(noLimpReraise.length);
    expect(opp.noRaiseFaced + opp.facedRaise).toBe(noLimpReraise.length);
  });

  it('a limp-reraise DOES add to the threeBet parent — the WS-256 fix, not a regression', () => {
    const withLR = [...noLimpReraise, limpReraiseHand()];
    const before = build(noLimpReraise).actionCounts.LATE;
    const after = build(withLR).actionCounts.LATE;

    // The previously invisible re-raise now lands in the parent...
    expect(after.threeBet).toBe(before.threeBet + 1);
    // ...and the limp is still counted (the hand was genuinely limped).
    expect(after.limp).toBe(before.limp + 1);
  });
});

// ---------------------------------------------------------------------------
// Sum invariant
// ---------------------------------------------------------------------------

describe('sum invariant', () => {
  const mixed = [
    ...repeat(openHand, 3),
    ...repeat(isoHand, 2),
    ...repeat(cold3BetHand, 3),
    ...repeat(squeezeHand, 2),
    ...repeat(limpReraiseHand, 2),
    ...repeat(coldCallHand, 3),
    ...repeat(foldHand, 4),
  ];

  it('subclass counts sum to their parent (no unclassified residual in these fixtures)', () => {
    const counts = build(mixed).actionCounts.LATE;

    for (const [parent, subs] of Object.entries(PARENT_SUBCLASSES)) {
      const sum = subs.reduce((t, s) => t + counts[s], 0);
      expect(sum, `${parent} = ${subs.join(' + ')}`).toBe(counts[parent]);
    }
  });

  it('subclass counts never exceed their parent, even with a 4-bet residual', () => {
    // Seat 9 cold-4bets: parent threeBet, subAction null (WS-270 residual).
    const fourBet = makeHand({ ...HERO, actions: [
      { seat: 4, action: 'raise' }, { seat: 5, action: 'raise' }, { seat: 9, action: 'raise' },
    ]});
    const counts = build([...mixed, fourBet]).actionCounts.LATE;

    for (const [parent, subs] of Object.entries(PARENT_SUBCLASSES)) {
      const sum = subs.reduce((t, s) => t + counts[s], 0);
      expect(sum).toBeLessThanOrEqual(counts[parent]);
    }
    // The residual is exactly the unmodelled 4-bet.
    const threeBetSubs = PARENT_SUBCLASSES.threeBet.reduce((t, s) => t + counts[s], 0);
    expect(counts.threeBet - threeBetSubs).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Hierarchical shrinkage (DEC-025 AS-2)
// ---------------------------------------------------------------------------

describe('hierarchical shrinkage', () => {
  /**
   * `rangeWidth` rounds to an integer percent, which floors small subclass
   * grids to 0 — too coarse to compare shares. Use raw combo-weighted mass.
   */
  const mass = (grid) => grid.reduce((a, b) => a + b, 0);

  /**
   * The subclass's width RELATIVE TO ITS PARENT — the quantity DEC-025 AS-2
   * constrains. It isolates the split from the parent's own growth, so a
   * subclass that merely tracks a widening parent registers no drift.
   */
  const shareOfParent = (ranges, sub) => mass(ranges[sub]) / mass(ranges.threeBet);

  /**
   * Independent reimplementation of the CONDITIONAL split posterior the engine
   * uses (POKER_THEORY §2.5.3). The denominator is the parent's own count —
   * a fold is not an opportunity to observe *which kind* of 3-bet occurred.
   */
  const expectedSplit = ({ nParent, nSub, pos = 'LATE', sub = 'squeeze' }) => {
    const fraction = SUBCLASS_SPLIT.threeBet[pos][sub];
    return {
      doctrine: fraction,
      posterior: (SUBCLASS_PRIOR_WEIGHT * fraction + nSub) / (SUBCLASS_PRIOR_WEIGHT + nParent),
      empirical: nParent > 0 ? nSub / nParent : 0,
    };
  };

  it('a zero-observation subclass still carries its parent-derived share', () => {
    // No squeezes at all — the squeeze grid must be the parent's share, not a
    // flat independent guess, and not zero.
    const profile = build([...repeat(cold3BetHand, 3), ...repeat(foldHand, 7)]);
    const share = shareOfParent(profile.ranges.LATE, 'squeeze');

    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });

  it('the split posterior lies between the doctrine split and the raw rate', () => {
    const cases = [
      { nParent: 1, nSub: 1 },
      { nParent: 2, nSub: 1 },
      { nParent: 5, nSub: 1 },
      { nParent: 13, nSub: 8 },
    ];
    for (const c of cases) {
      const { doctrine, posterior, empirical } = expectedSplit(c);
      const lo = Math.min(doctrine, empirical);
      const hi = Math.max(doctrine, empirical);
      expect(posterior, `nParent=${c.nParent} nSub=${c.nSub}`).toBeGreaterThan(lo);
      expect(posterior, `nParent=${c.nParent} nSub=${c.nSub}`).toBeLessThan(hi);
    }
  });

  it('is prior-dominated while the parent count <= SUBCLASS_PRIOR_WEIGHT', () => {
    for (const nParent of [2, 3, 5, 8]) {
      const { doctrine, posterior, empirical } = expectedSplit({ nParent, nSub: 1 });
      expect(Math.abs(posterior - doctrine), `nParent=${nParent} stays near doctrine`)
        .toBeLessThan(Math.abs(posterior - empirical));
    }

    // At exactly nParent = SUBCLASS_PRIOR_WEIGHT the blend is ~50/50.
    const { doctrine, posterior, empirical } = expectedSplit({
      nParent: SUBCLASS_PRIOR_WEIGHT, nSub: 1,
    });
    expect(Math.abs(posterior - doctrine)).toBeCloseTo(Math.abs(posterior - empirical), 6);
  });

  it('a single squeeze shifts the share under 25% — AS-2 threshold', () => {
    // AS-2's control: the same villain and position with the subclass unseen.
    const none = shareOfParent(build([...repeat(cold3BetHand, 4), ...repeat(foldHand, 36)]).ranges.LATE, 'squeeze');
    const one = shareOfParent(
      build([squeezeHand(), ...repeat(cold3BetHand, 4), ...repeat(foldHand, 35)]).ranges.LATE,
      'squeeze'
    );

    expect(none).toBeGreaterThan(0);
    expect(one).toBeGreaterThan(none); // evidence is real...
    // ...but bounded. The pre-fix implementation moved this ~300%.
    expect(Math.abs(one - none) / none).toBeLessThan(0.25);
  });

  it('accumulating evidence does pull the subclass away from the doctrine split', () => {
    const thin = build([squeezeHand(), ...repeat(cold3BetHand, 4), ...repeat(foldHand, 35)]);
    const heavy = build([...repeat(squeezeHand, 20), ...repeat(cold3BetHand, 4), ...repeat(foldHand, 16)]);

    expect(shareOfParent(heavy.ranges.LATE, 'squeeze'))
      .toBeGreaterThan(shareOfParent(thin.ranges.LATE, 'squeeze'));
    // Doctrine says ~34% of LATE 3-bets squeeze; heavy evidence overrides it.
    expect(shareOfParent(heavy.ranges.LATE, 'squeeze')).toBeGreaterThan(0.5);
  });

  it('BB limp-reraise is structurally impossible and keeps an empty grid', () => {
    // BB cannot limp (rangeEngine/CLAUDE.md §5), so its split share is 0.
    expect(SUBCLASS_SPLIT.threeBet.BB.limpReraise).toBe(0);
    const profile = build([...repeat(cold3BetHand, 2), ...repeat(foldHand, 3)]);
    expect(rangeWidth(profile.ranges.BB.limpReraise)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Grid containment — a child range can never exceed its parent
// ---------------------------------------------------------------------------

describe('grid containment', () => {
  /**
   * The invariant DEC-025 §1 ratifies: a parent means EXACTLY the union of its
   * subclasses, so per cell every child <= parent and Σ children <= parent.
   * The shortfall, when there is one, is the unmodelled 4-bet tree (WS-270).
   *
   * This guards the WS-256 implementation defect found in review: subclass
   * grids were originally built from independent priors and only the FREQUENCY
   * was shrunk, which let `limpReraise[QQ] = 1.00` stand against
   * `threeBet[QQ] = 0.58`, with Σ children > parent in 151/169 cells.
   */
  const expectContained = (profile) => {
    for (const pos of RANGE_POSITIONS) {
      for (const [parent, subs] of Object.entries(PARENT_SUBCLASSES)) {
        for (let i = 0; i < 169; i++) {
          const cap = profile.ranges[pos][parent][i];
          let sum = 0;
          for (const sub of subs) {
            const v = profile.ranges[pos][sub][i];
            expect(v, `${pos}.${sub}[${i}] <= ${parent}`).toBeLessThanOrEqual(cap + 1e-9);
            expect(v).toBeGreaterThanOrEqual(0);
            sum += v;
          }
          expect(sum, `${pos} Σ${parent} subclasses[${i}]`).toBeLessThanOrEqual(cap + 1e-9);
        }
      }
    }
  };

  it('holds for the pure prior, before any observation', () => {
    expectContained(build([]));
  });

  it('holds across a mixed history', () => {
    expectContained(build([
      ...repeat(openHand, 3), ...repeat(isoHand, 2),
      ...repeat(cold3BetHand, 3), ...repeat(squeezeHand, 2),
      ...repeat(limpReraiseHand, 2), ...repeat(coldCallHand, 3),
      ...repeat(foldHand, 4),
    ]));
  });

  it('holds when one subclass is heavily observed', () => {
    expectContained(build([...repeat(squeezeHand, 20), ...repeat(foldHand, 5)]));
  });

  it('holds when a showdown anchor pins a subclass cell', () => {
    const revealed = makeHand({
      ...HERO,
      actions: [
        { seat: 4, action: 'raise' }, { seat: 5, action: 'call' }, { seat: 9, action: 'raise' },
      ],
      cards: ['A♠', 'A♥'],
    });
    expectContained(build([revealed, ...repeat(foldHand, 3)]));
  });

  it('forces a child to zero wherever the parent is zero', () => {
    const r = build([...repeat(squeezeHand, 3), ...repeat(cold3BetHand, 5), ...repeat(foldHand, 10)]).ranges.LATE;
    for (let i = 0; i < 169; i++) {
      if (r.threeBet[i] === 0) {
        for (const sub of PARENT_SUBCLASSES.threeBet) expect(r[sub][i]).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Limp-reraise visibility
// ---------------------------------------------------------------------------

describe('limp-reraise visibility', () => {
  it('emits both decisions and keeps the limp range uncapped (§5.8)', () => {
    const profile = build([limpReraiseHand()]);
    const counts = profile.actionCounts.LATE;

    expect(counts.limp).toBe(1);
    expect(counts.threeBet).toBe(1);
    expect(counts.limpReraise).toBe(1);

    // The limp range must still carry the hand — dropping it would make the
    // range read as capped, inverting the trap doctrine.
    expect(rangeWidth(profile.ranges.LATE.limp)).toBeGreaterThan(0);
  });

  it('the limpReraise grid is uncapped — premiums sit at the top of it (§5.8)', () => {
    const profile = build([...repeat(limpReraiseHand, 3), ...repeat(foldHand, 5)]);
    const grid = profile.ranges.LATE.limpReraise;
    const AA = rangeIndex(12, 12, false);
    const _72o = rangeIndex(5, 0, false);

    // Containment bounds the ABSOLUTE weight by the parent (a limp-reraise IS a
    // 3-bet, so it cannot happen more often than one). "Uncapped" is therefore
    // a claim about SHAPE: the premium block leads the range.
    expect(grid[AA]).toBeGreaterThan(0);
    expect(grid[AA]).toBeGreaterThan(grid[_72o]);

    // The heaviest cells are premiums. WIDENED AT WS-304 from the three pocket
    // pairs to POKER_THEORY §2.3's actual premium set, {QQ+, AK}, because the
    // narrower list was an artifact of the ordering this grid used to be built
    // on: the old `handStrengthTier` rank sum scored AKo at 0.719 and put it
    // 157th of 169, so AK could not appear near the top of ANY 3-bet grid. On
    // the measured equity ordering AK ranks 6th-7th, and §2.3 names it a
    // premium in the same breath as QQ+ — so a limp-reraise grid led by AA and
    // AK is the doctrine holding, not a violation of it.
    const ranked = Array.from({ length: 169 }, (_, i) => i)
      .sort((a, b) => grid[b] - grid[a]);
    const premiums = new Set([
      rangeIndex(12, 12, false), rangeIndex(11, 11, false), rangeIndex(10, 10, false),
      rangeIndex(12, 11, true), rangeIndex(12, 11, false),
    ]);
    // AA leads outright — the strongest hand is the one a trapper most wants
    // the passive line for.
    expect(ranked[0]).toBe(AA);
    // …and the premium BLOCK leads, which is the claim §5.8 actually makes.
    // Asserted as a block mean rather than an exact top-3 membership: the
    // sibling priors fall off sharply just below JJ once `withEquitySupport`
    // has blended them, so individual cells in the AQ/88 band can outrank QQ
    // in the carve. That sharpness is a `softContinuationWeights` property,
    // not a taxonomy one, and pinning an exact ordering here would make this
    // test a tripwire for a parameter it does not own.
    const mean = (idxs) => idxs.reduce((s, i) => s + grid[i], 0) / idxs.length;
    const all = Array.from({ length: 169 }, (_, i) => i);
    expect(mean([...premiums])).toBeGreaterThan(mean(all.filter((i) => !premiums.has(i))));
  });

  it('limp-reraise claims more of the premium end than its siblings do', () => {
    // The doctrinal ordering: at the top of the range the trap line is the most
    // likely explanation of a raise-facing-raise, which is what "uncapped" buys.
    const profile = build([...repeat(limpReraiseHand, 3), ...repeat(foldHand, 5)]);
    const r = profile.ranges.LATE;
    const AA = rangeIndex(12, 12, false);

    const shareAt = (sub, i) => (r.threeBet[i] > 0 ? r[sub][i] / r.threeBet[i] : 0);
    expect(shareAt('limpReraise', AA)).toBeGreaterThan(0);
    expect(shareAt('limpReraise', AA)).toBeGreaterThan(shareAt('squeeze', AA));
  });

  it('counts one showdown per hand, not one per decision point', () => {
    const hand = makeHand({
      ...HERO,
      actions: [
        { seat: 9, action: 'call' }, { seat: 4, action: 'raise' }, { seat: 9, action: 'raise' },
      ],
      cards: ['A♠', 'A♥'],
    });
    const profile = build([hand]);
    expect(profile.opportunities.LATE.showdownsSeen).toBe(1);
    // ...but the reveal anchors BOTH ranges it legitimately belongs to.
    expect(profile.showdownAnchors.map(a => a.action)).toEqual(
      expect.arrayContaining(['limp', 'threeBet', 'limpReraise'])
    );
  });
});

// ---------------------------------------------------------------------------
// Persistence compat
// ---------------------------------------------------------------------------

describe('persistence compat', () => {
  it('round-trips every action grid', () => {
    const profile = build([...repeat(squeezeHand, 2), ...repeat(foldHand, 3)]);
    const restored = deserializeProfile(JSON.parse(JSON.stringify(serializeProfile(profile))));

    for (const pos of RANGE_POSITIONS) {
      for (const action of [...RANGE_PARENT_ACTIONS, ...RANGE_SUBCLASS_ACTIONS]) {
        expect(restored.ranges[pos][action].length).toBe(169);
        expect(Array.from(restored.ranges[pos][action]))
          .toEqual(Array.from(profile.ranges[pos][action]));
      }
    }
  });

  it('deserializes a v3 record (no subclass keys) without corrupt grid shapes', () => {
    const profile = build([...repeat(cold3BetHand, 2), ...repeat(foldHand, 2)]);
    const record = JSON.parse(JSON.stringify(serializeProfile(profile)));

    // Simulate a profile written before the taxonomy landed.
    record.profileVersion = 3;
    for (const pos of RANGE_POSITIONS) {
      for (const sub of RANGE_SUBCLASS_ACTIONS) delete record.ranges[pos][sub];
    }

    const restored = deserializeProfile(record);
    for (const pos of RANGE_POSITIONS) {
      for (const sub of RANGE_SUBCLASS_ACTIONS) {
        // The regression this guards: new Float64Array(undefined) silently
        // yields a LENGTH-0 array rather than throwing.
        expect(restored.ranges[pos][sub].length).toBe(169);
        expect(rangeWidth(restored.ranges[pos][sub])).toBe(0);
      }
      // Parents survive untouched.
      for (const parent of RANGE_PARENT_ACTIONS) {
        expect(restored.ranges[pos][parent].length).toBe(169);
      }
    }
  });

  it('tolerates a record missing an entire position block', () => {
    const profile = build([foldHand()]);
    const record = JSON.parse(JSON.stringify(serializeProfile(profile)));
    delete record.ranges.SB;

    const restored = deserializeProfile(record);
    expect(restored.ranges.SB.threeBet.length).toBe(169);
  });
});
