/**
 * induceSizing — the induction's SECOND target (WS-552).
 *
 * THE LOAD-BEARING CASE IS THE FIRST ONE BELOW, and it is written as a before/after pair on the
 * SAME rows: a villain who ALWAYS bets, but bets three-quarters pot in position and half pot out
 * of it. The action induction is action-pure at the root, so it stops before testing a single
 * feature and reports one rule with no conditions — a spot with a real, strong, hole-card-free
 * read looks like a spot with nothing in it. That is WS-552's premise stated as an executable
 * assertion rather than as prose, which is the only form that keeps working.
 *
 * The other four cases are the ways this could be built and be wrong:
 *   - action and size separating on DIFFERENT features (the factorisation must keep them apart)
 *   - a leaf spanning two SIZE REGIMES (street must not win by tautology)
 *   - a thin stratum (the floor must refuse rather than fit)
 *   - a NULL villain whose sizing genuinely does not separate (the search must not manufacture)
 */
import { describe, it, expect } from 'vitest';
import { induce, induceSizing, assertActionHomogeneous, MIN_RULE_DEFAULT } from '../villainArchetype/induceCore.mjs';
import {
  regimeForStreet, bandFor, sizingValue, SIZING_REGIMES,
} from '../villainArchetype/sizingBands.mjs';
import { emitConductCard } from '../villainArchetype/emitConductCard.mjs';
import { conductCardProblems } from '../../src/utils/standardOfRecord/conductCard.js';

/** Seeded, because a verdict that moved between identical runs would not be a record. */
const rng = (seed = 0x2545f491) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/**
 * The banding, injected the way `emitConductCard` injects it. `null` is the unsized row.
 */
const cellOf = (scheme = 'S2') => (d) => {
  if (!sizingValue({ sizeBb: d.myRaiseToBB ?? null, potBb: d.potBB ?? null, street: d.street })) return null;
  return {
    regime: regimeForStreet(d.street),
    band: bandFor(d.myRaiseToBB ?? null, d.potBB ?? null, d.street, scheme),
  };
};

/**
 * One decision. Only the fields a test wants to be conditionable are populated — every other
 * situation field resolves to '-' and is skipped by the feature map, so a test's split search
 * runs over a handful of named features instead of forty incidental ones.
 */
const dec = (i, o = {}) => ({
  handId: `h${i}`,
  street: 'flop',
  facing: 'no bet',
  action: 'bet',
  potBB: 10,
  myRaiseToBB: 5,
  handKnown: false,
  holeCards: ['As', 'Kd'],
  canRaise: true,
  seatsDealt: 6,
  inPosition: true,
  ...o,
});

/** 0.75x pot and 0.5x pot land in two different S2 postflop bands. That IS the read. */
const BIG = 7.5;   // 7.5 / 10 = 0.75 -> '0.72-0.95'
const SMALL = 5;   // 5.0 / 10 = 0.50 -> '0.45-0.60'

/**
 * THE SYNTHETIC VILLAIN THE TICKET DESCRIBES: he always bets, and the only thing that varies is
 * HOW BIG. `crossover` is the rate at which he uses the other size, so the split is a
 * statistical finding rather than a lookup table.
 */
const alwaysBetsDifferentSizes = ({ n = 240, crossover = 0.12, seed = 7 } = {}) => {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const inPos = i % 2 === 0;
    const big = inPos ? r() > crossover : r() < crossover;
    return dec(i, {
      inPosition: inPos,
      // A decoy that varies and explains nothing, so the Bonferroni denominator is not 1.
      seatsDealt: r() < 0.5 ? 6 : 9,
      myRaiseToBB: big ? BIG : SMALL,
    });
  });
};

describe('WS-552 premise: the action induction cannot see a sizing rule', () => {
  const rows = alwaysBetsDifferentSizes();

  it('reports ONE unconditioned rule where a strong sizing read exists', () => {
    const { rules } = induce(rows);
    expect(rules).toHaveLength(1);
    expect(rules[0].conds).toEqual([]);
    expect(rules[0].action).toBe('bet');
    expect(rules[0].pure).toBe(true);
    // The premise, stated as the thing that is actually wrong: the leaf is action-pure, so the
    // search stopped, and nothing on this rule mentions size at all.
    expect(rules[0].verdict).toBe('always');
  });

  it('the sizes really do separate — so the null above is the instrument, not the villain', () => {
    const big = rows.filter((d) => d.myRaiseToBB === BIG);
    const small = rows.filter((d) => d.myRaiseToBB === SMALL);
    expect(big.length).toBeGreaterThan(90);
    expect(small.length).toBeGreaterThan(90);
    expect(big.filter((d) => d.inPosition).length / big.length).toBeGreaterThan(0.8);
    expect(small.filter((d) => !d.inPosition).length / small.length).toBeGreaterThan(0.8);
  });
});

describe('WS-552: induceSizing finds the split the action search cannot', () => {
  const rows = alwaysBetsDifferentSizes();
  const { rules } = induce(rows);
  const out = induceSizing(rules, { cellOf: cellOf() });

  it('splits the single action-pure leaf on the feature that drives the size', () => {
    expect(out.summary.split).toBe(1);
    const st = out.strata.find((x) => x.outcome === 'split');
    expect(st.action).toBe('bet');
    expect(st.regime).toBe(SIZING_REGIMES.POSTFLOP_POT_FRACTION);
    expect(st.split.feature).toBe('in_pos');
    expect(st.split.pAdj).toBeLessThan(0.05);
  });

  it('each induced sizing rule names a modal band with its own k/n', () => {
    const st = out.strata.find((x) => x.outcome === 'split');
    expect(st.leaves.length).toBeGreaterThanOrEqual(2);
    const byCond = Object.fromEntries(st.leaves.map((l) => [l.conds[0].value, l]));
    expect(byCond['in pos = yes'].band).toBe('0.72-0.95');
    expect(byCond['in pos = no'].band).toBe('0.45-0.60');
    for (const l of st.leaves) {
      expect(l.k).toBeGreaterThan(l.n / 2);
      // The residue rides along, exactly as the action residue does. A modal label with the
      // rest discarded is what the Conduct Card form refuses one level up.
      expect(l.dist.reduce((s, [, k]) => s + k, 0)).toBe(l.n);
      expect(l.predicate[0]).toMatchObject({ feature: 'in_pos', op: 'eq' });
    }
  });

  it('every stratum it searched is action-homogeneous — the double-counting guard', () => {
    for (const st of out.strata) {
      expect(new Set(st.rows.map((d) => d.action)).size).toBe(1);
      expect(st.rows[0].action).toBe(st.action);
    }
    // And the guard is a real refusal, not a comment.
    expect(() => assertActionHomogeneous([{ action: 'bet' }, { action: 'raise' }], 'bet'))
      .toThrow(/CONDITIONAL on the action/);
  });
});

describe('WS-552: action and sizing separating on DIFFERENT features', () => {
  /**
   * `facing` drives WHICH (he bets into a checked pot, and calls or raises a bet). `in_pos`
   * drives HOW BIG among the bets and is independent of the action. If the two claims were
   * stacked rather than factorised, `in_pos` would show up on the action side too.
   */
  const r = rng(99);
  const rows = [];
  for (let i = 0; i < 240; i++) {
    const inPos = i % 2 === 0;
    rows.push(dec(i, {
      facing: 'no bet',
      action: 'bet',
      inPosition: inPos,
      myRaiseToBB: (inPos ? r() > 0.1 : r() < 0.1) ? BIG : SMALL,
    }));
  }
  for (let i = 0; i < 240; i++) {
    rows.push(dec(1000 + i, {
      facing: 'a bet',
      inPosition: i % 2 === 0,
      action: r() < 0.7 ? 'call' : 'raise',
      // A constant raise size, so the raise stratum has nothing to find.
      myRaiseToBB: 6,
      potBB: 10,
    }));
  }

  const { rules } = induce(rows);
  const out = induceSizing(rules, { cellOf: cellOf() });

  it('the ACTION search uses facing and never in_pos', () => {
    const features = new Set(rules.flatMap((x) => x.conds.map((c) => c.feature)));
    expect(features.has('facing')).toBe(true);
    expect(features.has('in_pos')).toBe(false);
  });

  it('the SIZING search uses in_pos, inside the leaf facing named', () => {
    const split = out.strata.filter((x) => x.outcome === 'split');
    expect(split).toHaveLength(1);
    expect(split[0].action).toBe('bet');
    expect(split[0].split.feature).toBe('in_pos');
    // The sizing rule is stated relative to the action leaf it lives in, so the two clauses
    // compose into one sentence rather than competing.
    expect(split[0].rule.conds.map((c) => c.feature)).toContain('facing');
  });

  it('the constant-size raise stratum yields no rule and says why', () => {
    const raise = out.strata.filter((x) => x.action === 'raise');
    expect(raise.length).toBeGreaterThan(0);
    for (const st of raise) {
      expect(st.outcome).toBe('single-band');
      expect(st.bandsOccupied).toBe(1);
      expect(st.leaves).toHaveLength(0);
    }
  });
});

describe('WS-552: a leaf spanning two SIZE REGIMES', () => {
  /**
   * The preflop bb lattice and the postflop pot fraction have disjoint band alphabets, so on a
   * pooled search `street` separates them perfectly — by tautology, not because he sizes by
   * street. Stratifying by regime is what stops that becoming a rule.
   */
  const r = rng(2026);
  const rows = [];
  for (let i = 0; i < 120; i++) {
    rows.push(dec(i, { street: 'preflop', action: 'raise', inPosition: null, myRaiseToBB: r() < 0.5 ? 3.5 : 4, potBB: 1.5 }));
  }
  for (let i = 0; i < 120; i++) {
    rows.push(dec(500 + i, { street: 'flop', action: 'raise', myRaiseToBB: r() < 0.5 ? SMALL : BIG, potBB: 10 }));
  }
  // One hand-made leaf holding both streets — the shape villain 2's real leaves take.
  const leaf = { conds: [], pool: rows };
  const out = induceSizing([leaf], { cellOf: cellOf() });

  it('searches one stratum per regime, never a pooled one', () => {
    expect(out.strata).toHaveLength(2);
    expect(new Set(out.strata.map((s) => s.regime)))
      .toEqual(new Set([SIZING_REGIMES.PREFLOP_BB, SIZING_REGIMES.POSTFLOP_POT_FRACTION]));
    expect(out.strata.map((s) => s.n)).toEqual([120, 120]);
  });

  it('does NOT manufacture a street rule out of two incommensurable axes', () => {
    expect(out.summary.split).toBe(0);
    expect(out.summary.features).toEqual({});
    for (const st of out.strata) expect(st.outcome).toBe('no-significant-split');
  });
});

describe('WS-552: thin strata refuse rather than fit', () => {
  const r = rng(11);
  const rows = Array.from({ length: 30 }, (_, i) => dec(i, {
    inPosition: i % 2 === 0,
    myRaiseToBB: r() < 0.5 ? BIG : SMALL,
  }));
  const out = induceSizing([{ conds: [], pool: rows }], { cellOf: cellOf() });

  it('reports below-floor with the count, and induces nothing', () => {
    expect(MIN_RULE_DEFAULT).toBe(25);
    expect(out.strata).toHaveLength(1);
    expect(out.strata[0].n).toBe(30);         // under minRule * 2
    expect(out.strata[0].outcome).toBe('below-floor');
    expect(out.summary.split).toBe(0);
    expect(out.summary.eligible).toBe(0);
  });

  it('the refusal is NAMED, so a blank cannot be read as "his sizing does not vary"', () => {
    expect(out.summary.byOutcome).toEqual({ 'below-floor': 1 });
    expect(out.search.correction).toMatch(/bonferroni/);
  });
});

describe('WS-552: the null villain — sizing that genuinely does not separate', () => {
  /** Size drawn independently of every populated feature. Nothing here is findable. */
  const r = rng(4242);
  const rows = Array.from({ length: 400 }, (_, i) => dec(i, {
    inPosition: i % 2 === 0,
    seatsDealt: i % 3 === 0 ? 9 : 6,
    street: ['flop', 'turn', 'river'][i % 3],
    myRaiseToBB: r() < 0.5 ? BIG : SMALL,
  }));
  const out = induceSizing([{ conds: [], pool: rows }], { cellOf: cellOf() });

  it('searches, finds nothing, and says so', () => {
    expect(out.summary.eligible).toBe(1);
    expect(out.summary.split).toBe(0);
    expect(out.summary.sizingRules).toBe(0);
    expect(out.strata[0].outcome).toBe('no-significant-split');
  });

  it('holds unsized rows out of the search rather than banding them', () => {
    const withUnsized = rows.map((d, i) => (i < 40 ? { ...d, myRaiseToBB: null } : d));
    const o2 = induceSizing([{ conds: [], pool: withUnsized }], { cellOf: cellOf() });
    expect(o2.strata[0].unsizedExcluded).toBe(40);
    expect(o2.strata[0].n).toBe(360);
    expect(o2.strata[0].actionK).toBe(400);
  });
});

describe('WS-552: the induced sizing rules reach the Conduct Card', () => {
  const r = rng(31337);
  const rows = [];
  for (let i = 0; i < 240; i++) {
    const inPos = i % 2 === 0;
    rows.push(dec(i, {
      facing: 'no bet',
      action: 'bet',
      inPosition: inPos,
      myRaiseToBB: (inPos ? r() > 0.12 : r() < 0.12) ? BIG : SMALL,
      handKnown: i < 12,
    }));
  }
  for (let i = 0; i < 240; i++) {
    rows.push(dec(1000 + i, {
      facing: 'a bet',
      inPosition: i % 2 === 0,
      action: r() < 0.6 ? 'call' : 'fold',
      myRaiseToBB: null,
    }));
  }

  const induction = { minRule: 25, maxDepth: 5, alpha: 0.05, requireSignificance: true };
  const build = async () => {
    const { rules, wilson } = { ...induce(rows), wilson: (await import('../villainArchetype/induceCore.mjs')).wilson };
    return emitConductCard({
      subjectId: 'synthetic-ws552',
      rules,
      decisions: rows,
      files: ['synthetic/ws552.phh'],
      gates: [{ name: 'synthetic-fixture', ok: true }],
      induction,
      wilson,
      population: 'synthetic — a fixture, not a player',
    });
  };

  it('emits a valid card carrying sizing sub-rules with their own k/n and interval', async () => {
    const card = await build();
    expect(conductCardProblems(card)).toEqual([]);

    const betAction = card.rules
      .flatMap((rule) => rule.actions.map((a) => ({ rule, a })))
      .find((x) => x.a.action === 'bet');
    expect(betAction).toBeTruthy();

    const strata = betAction.a.sizing.subRules;
    const split = strata.filter((s) => s.outcome === 'split');
    expect(split).toHaveLength(1);
    expect(split[0].split.feature).toBe('in_pos');
    expect(split[0].rules.length).toBeGreaterThanOrEqual(2);

    for (const sub of split[0].rules) {
      expect(sub.sizingRuleId).toMatch(/^s-[0-9a-f]{10}$/);
      expect(sub.n).toBeGreaterThan(0);
      expect(sub.k).toBeGreaterThan(0);
      expect(sub.ci).toHaveLength(2);
      expect(sub.ci[0]).toBeLessThanOrEqual(sub.k / sub.n);
      expect(sub.ci[1]).toBeGreaterThanOrEqual(sub.k / sub.n);
      // The residue constraint, one level down: a sub-rule's bands account for every SIZED
      // decision it covers. Unsized rows never enter a stratum, so nothing is absorbed.
      expect(sub.bands.reduce((s, b) => s + b.k, 0)).toBe(sub.n);
      // Reuses the WS-578 shrinkage rather than a parallel representation.
      for (const b of sub.bands) {
        expect(b.shrunk).toBe(true);
        expect(b.shrunkToward).toContain('bet under rule');
        expect(b.regime).toBe(SIZING_REGIMES.POSTFLOP_POT_FRACTION);
      }
    }
  });

  it('declares the sizing search on the card header, both arms and the delta', async () => {
    const card = await build();
    const ind = card.sizingBanding.induction;
    expect(ind.primary).toBe('S2');
    expect(Object.keys(ind.arms).sort()).toEqual(['S2', 'S3']);
    expect(ind.arms.S2.split).toBeGreaterThanOrEqual(1);
    expect(ind.arms.S2.search.strataFamily).toBeGreaterThanOrEqual(1);
    expect(typeof ind.delta.armsAgree).toBe('boolean');
    expect(ind.delta.sign).toMatch(/S3 finds MORE/);
  });

  it('a sizing rule id is a property of the SPOT — stable across re-derivations', async () => {
    const a = await build();
    const b = await build();
    const ids = (card) => card.rules
      .flatMap((rule) => rule.actions)
      .filter((x) => x.sizing)
      .flatMap((x) => x.sizing.subRules.flatMap((s) => s.rules.map((y) => y.sizingRuleId)))
      .sort();
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a).length).toBeGreaterThanOrEqual(2);
  });
});
