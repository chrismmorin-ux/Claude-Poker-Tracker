/**
 * conductCard.test.js — the refusals, which are the whole value of the form.
 *
 * A validator that accepts a malformed card is worse than none: it puts a tick beside an
 * object nobody then re-checks. So most of what is asserted here is that specific bad cards
 * are REJECTED, and each rejection traces to a failure that actually happened on 2026-08-18.
 */
import { describe, it, expect } from 'vitest';

import {
  MIX_VERDICTS,
  VERDICT_SPEC_ANALOGUE,
  isMixVerdict,
  buildMix,
  buildConductCard,
  conductCardProblems,
  isValidConductCard,
  conductCaveat,
  SIZING_REGIMES,
  SIZING_UNSIZED_BAND,
  HELD_OUT_SCORE_KIND,
  HELD_OUT_REFUSAL_REASONS,
  HELD_OUT_VERDICTS,
  HELD_OUT_SPLIT_BASES,
  isHeldOutRefusal,
} from '../conductCard.js';
import { SOR_SCHEMA_VERSIONS } from '../schemas.js';
/**
 * The BOUNDARIES come from the producer, deliberately: `src/` must not depend on `scripts/`,
 * so the record form owns the vocabulary and the induction owns the lattice. Importing the
 * real module here rather than re-typing boundaries is the point — a test that restates the
 * numbers it checks is two representations that never have to agree, which is the defect this
 * directory has been bitten by twice.
 */
import {
  SIZING_SCHEME_VERSIONS,
  SIZING_PRIOR_WEIGHT,
  bandFor,
  bandNamesOf,
  bandingDeclaration,
  assertBandingCompatible,
  shrinkBands,
  cellKey,
} from '../../../../scripts/villainArchetype/sizingBands.mjs';
/**
 * Same argument, one directory over: the SCORER owns the bootstrap seed, the fold cuts and the
 * floors, and this file must not re-type them. A test that hard-codes `20260551` still passes on
 * the day the producer changes the seed — and then the manifest clause it is supposed to be
 * guarding (the seed on the figure must appear in `manifest.seeds`) is being checked against a
 * number nothing emits any more.
 */
import { BOOTSTRAP, FOLD_CUTS, FLOORS } from '../../../../scripts/villainArchetype/scoreHeldOut.mjs';

const mix = (over = {}) => buildMix({
  ruleId: 'r01',
  when: 'someone has raised and players are still to act behind me',
  n: 100,
  actions: [
    { action: 'fold', k: 90, ci: [0.82, 0.94] },
    { action: 'call', k: 10, ci: [0.05, 0.17] },
  ],
  verdict: MIX_VERDICTS.MIX,
  ...over,
});

const card = (over = {}) => ({
  cardId: 'CC-test',
  schemaVersion: SOR_SCHEMA_VERSIONS.conductCard,
  subjectId: 'subject-1',
  surfaceKind: 'Read',
  dealBook: { dealBookHash: 'sha256:abc', files: 1, hands: 90, decisions: 100 },
  evidence: { decisions: 100, revealedDecisions: 6, revealedShare: 0.06, shownHands: 4, voluntarilyEnteredShown: 3 },
  rules: [mix()],
  residual: { ruleId: 'r01', kind: 'partition-is-total' },
  coverage: 1,
  unresolved: [],
  separatorSearch: { arity: 1, correction: 'bonferroni', alpha: 0.05, combinationsSearched: false },
  induction: { minRule: 25, maxDepth: 5, alpha: 0.05, requireSignificance: true },
  gates: [{ name: 'a gate', ok: true, detail: 'passed' }],
  occupancy: { unit: 'decision', total: 100 },
  manifest: { engineCommit: 'deadbeef', engineDirty: false, dealBookHash: 'sha256:abc', seeds: {} },
  disclaimerRegisterVersion: 'FR-1+0123456789ab',
  contentHash: null,
  population: 'online-50NL-2009',
  // NULL, not absent — the positive declaration that this card records no sizing. A v2 card
  // that simply could not is a different fact, and v3 requires the two stay distinguishable.
  sizingBanding: null,
  ...over,
});

// ── WS-578 sizing fixtures ───────────────────────────────────────────────────────────────

const PREFLOP = SIZING_REGIMES.PREFLOP_BB;

/** The card header, built from the REAL declaration so the boundaries are never re-typed. */
const banding = (over = {}) => ({
  primary: 'S2',
  arms: [
    { ...bandingDeclaration('S2'), resolution: {} },
    { ...bandingDeclaration('S3'), resolution: {} },
  ],
  delta: { metric: 'band-mean reconstruction error', arms: {}, delta: {} },
  shrinkage: { operation: 'shrink-toward-parent', priorWeight: SIZING_PRIOR_WEIGHT },
  conventions: { [PREFLOP]: 'raise-to, cumulative, in big blinds' },
  unsizedBand: SIZING_UNSIZED_BAND,
  ...over,
});

/**
 * Every band of a regime under a scheme, with the named counts filled in and the rest at zero.
 * The zeros are emitted on purpose — they are the holes, and a band list that omitted them
 * could not be checked for summing to k.
 */
const bandsFrom = (regime, scheme, counts, n) => bandNamesOf(regime, scheme).map((name) => {
  const k = counts[name] || 0;
  return {
    regime,
    band: name,
    k,
    n,
    pRaw: n ? k / n : 0,
    // Stand-in for the posterior mean; the shrinkage ESTIMATOR itself is exercised against
    // `shrinkBands` directly further down rather than re-implemented here.
    p: n ? (k + 1) / (n + 2) : 0,
    ci: [0, 1],
    shrunk: true,
    shift: 0,
    thin: n < SIZING_PRIOR_WEIGHT,
    shrunkToward: 'raise@card',
    priorWeight: SIZING_PRIOR_WEIGHT,
  };
});

const sizingBlock = (over = {}) => ({
  regimes: [PREFLOP],
  scheme: 'S2',
  schemeVersion: SIZING_SCHEME_VERSIONS.S2,
  altScheme: 'S3',
  altSchemeVersion: SIZING_SCHEME_VERSIONS.S3,
  k: 40,
  sizedK: 40,
  unsizedK: 0,
  shrunk: true,
  thin: false,
  parent: 'raise@card',
  classNote: 'decision input',
  bands: bandsFrom(PREFLOP, 'S2', { '3.5': 30, '4-4.5': 10 }, 40),
  altBands: bandsFrom(PREFLOP, 'S3', { '3-4.5': 40 }, 40),
  ...over,
});

const sizedMix = (over = {}) => buildMix({
  ruleId: 'r-sized',
  when: 'preflop, nobody has entered the pot',
  n: 100,
  actions: [
    // AC2: an action with no size says so POSITIVELY. Absent would mean "not recorded".
    { action: 'fold', k: 60, ci: [0.5, 0.7], sizing: null },
    { action: 'raise', k: 40, ci: [0.3, 0.5], sizing: sizingBlock() },
  ],
  verdict: MIX_VERDICTS.MIX,
  ...over,
});

const sizedCard = (over = {}) => card({
  rules: [sizedMix()],
  residual: { ruleId: 'r-sized', kind: 'partition-is-total' },
  sizingBanding: banding(),
  ...over,
});

describe('mix verdicts', () => {
  it('is a closed list', () => {
    expect(isMixVerdict('mix')).toBe(true);
    expect(isMixVerdict('nothing-separates-this')).toBe(false);
  });

  it('maps every verdict onto the spec vocabulary so the two registers cannot drift', () => {
    for (const v of Object.values(MIX_VERDICTS)) {
      expect(VERDICT_SPEC_ANALOGUE).toHaveProperty(v);
    }
    expect(VERDICT_SPEC_ANALOGUE.mix).toBe('resolved-noise');
    expect(VERDICT_SPEC_ANALOGUE['hidden-cond']).toBe('resolved-subrule');
    expect(VERDICT_SPEC_ANALOGUE['needs-cards']).toBe('unresolvable-here');
  });
});

describe('buildMix — the residue is never rounded away', () => {
  it('refuses a distribution that does not account for every decision in the leaf', () => {
    // The founder's standing rule 5: a rule's residue IS his range in that spot. A rule that
    // reports 90% fold and drops the other 10 decisions has discarded the informative half.
    expect(() => buildMix({
      ruleId: 'r', when: 'x', n: 100,
      actions: [{ action: 'fold', k: 90, ci: [0.8, 0.95] }],
      verdict: MIX_VERDICTS.MIX,
    })).toThrow(/account for every decision/);
  });

  it('computes each rate from the leaf denominator', () => {
    const m = mix();
    expect(m.actions[0].rate).toBeCloseTo(0.9, 10);
    expect(m.actions[1].rate).toBeCloseTo(0.1, 10);
  });

  it('refuses a verdict off the closed list', () => {
    expect(() => mix({ verdict: 'probably-random' })).toThrow(/closed list/);
  });
});

describe('conductCardProblems', () => {
  it('accepts a well-formed card', () => {
    expect(conductCardProblems(card())).toEqual([]);
    expect(isValidConductCard(card())).toBe(true);
  });

  it('REQUIRES the separator search — the refutation of 2026-08-18 is why', () => {
    // A card that cannot say how hard it looked lets "no separator found" read as "no
    // separator exists". An independent search over 113,704 OR-combinations refuted exactly
    // such a verdict at corrected p = 0.024.
    const problems = conductCardProblems(card({ separatorSearch: undefined }));
    expect(problems.join(' ')).toMatch(/separatorSearch/);
  });

  it('refuses a coverage that is not exactly 1', () => {
    // Coverage is 1 BY CONSTRUCTION. Any other value means the ruleset is not enclosed.
    expect(conductCardProblems(card({ coverage: 0.97 })).join(' ')).toMatch(/coverage must be exactly 1/);
  });

  it('refuses "always" when the exception set is not empty', () => {
    // "Never" and "always" are claims about the exception set, not shorthand for a high rate.
    const problems = conductCardProblems(card({
      rules: [mix({ verdict: MIX_VERDICTS.ALWAYS })],
    }));
    expect(problems.join(' ')).toMatch(/requires an EMPTY exception set/);
  });

  it('refuses a hidden-condition verdict that does not name its feature', () => {
    const problems = conductCardProblems(card({
      rules: [mix({ verdict: MIX_VERDICTS.HIDDEN_CONDITION, separators: [] })],
      unresolved: [{ ruleId: 'r01', verdict: 'hidden-cond', resolvedBy: 'sample' }],
    }));
    expect(problems.join(' ')).toMatch(/must name the separating feature/);
  });

  it('refuses an unresolved rule that is missing from the unresolved list', () => {
    const problems = conductCardProblems(card({
      rules: [mix({ verdict: MIX_VERDICTS.NEEDS_CARDS })],
      unresolved: [],
    }));
    expect(problems.join(' ')).toMatch(/missing from the unresolved list/);
  });

  it('refuses an unresolved row that does not say what would resolve it', () => {
    // An unresolved row without a route is a caveat; with one it is a work item.
    const problems = conductCardProblems(card({
      rules: [mix({ verdict: MIX_VERDICTS.NEEDS_CARDS })],
      unresolved: [{ ruleId: 'r01', verdict: 'needs-cards' }],
    }));
    expect(problems.join(' ')).toMatch(/what WOULD resolve it/);
  });

  it('refuses a card whose instrument gates failed', () => {
    const problems = conductCardProblems(card({
      gates: [{ name: 'paired boards are detected', ok: false, detail: '0 paired' }],
    }));
    expect(problems.join(' ')).toMatch(/gate\(s\) failed/);
  });

  it('refuses a card with no gates at all', () => {
    expect(conductCardProblems(card({ gates: [] })).join(' ')).toMatch(/gates is empty/);
  });

  it('requires the count of shown hands he VOLUNTARILY entered', () => {
    // Nine of villain 1's 27 face-up hands were free big-blind showdowns. Those reveal what he
    // was dealt, never what he selects, so a composition claim resting on them rests on noise.
    const ev = { decisions: 100, revealedDecisions: 6, revealedShare: 0.06, shownHands: 4 };
    expect(conductCardProblems(card({ evidence: ev })).join(' '))
      .toMatch(/voluntarilyEnteredShown/);
  });

  it('refuses more revealed decisions than decisions', () => {
    expect(conductCardProblems(card({
      evidence: { decisions: 10, revealedDecisions: 11, revealedShare: 1, shownHands: 4, voluntarilyEnteredShown: 1 },
    })).join(' ')).toMatch(/exceeds/);
  });

  it('refuses a register stamp that cannot be joined back to a register version', () => {
    // Shape, not presence: 'unknown' passes a truthiness check while delivering none of what
    // the stamp is for. An un-awaited async call stamping a Promise is the same failure, and
    // it happened on the first live run.
    expect(conductCardProblems(card({ disclaimerRegisterVersion: 'unknown' })).join(' '))
      .toMatch(/not the shape registerVersion\(\) mints/);
    expect(conductCardProblems(card({ disclaimerRegisterVersion: 'FR-1+0123456789ab' }))).toEqual([]);
  });

  it('requires the population, because a rate quoted about another game is transferred', () => {
    expect(conductCardProblems(card({ population: '' })).join(' ')).toMatch(/population is required/);
  });

  it('refuses a card with no rules', () => {
    expect(conductCardProblems(card({ rules: [] })).join(' ')).toMatch(/describes nothing/);
  });
});

describe('buildConductCard', () => {
  it('throws rather than returning a partial card', () => {
    expect(() => buildConductCard({ cardId: 'CC-x' })).toThrow(/not valid/);
  });

  it('stamps coverage as 1 and surfaceKind as Read without being asked', () => {
    const built = buildConductCard({
      ...card(),
      // deliberately omitted from the input; the builder supplies them
      coverage: undefined,
      surfaceKind: undefined,
    });
    expect(built.coverage).toBe(1);
    expect(built.surfaceKind).toBe('Read');
  });
});

describe('conductCaveat', () => {
  it('states the arity, because a mix means "not found at this arity"', () => {
    expect(conductCaveat(card())).toMatch(/NO SINGLE FEATURE/);
    expect(conductCaveat(card())).toMatch(/provisional/);
  });

  it('states the population as transferred', () => {
    expect(conductCaveat(card())).toMatch(/TRANSFERRED, not measured/);
  });

  it('reports the card budget including the voluntary share', () => {
    expect(conductCaveat(card())).toMatch(/6\/100/);
    expect(conductCaveat(card())).toMatch(/voluntarily entered/);
  });
});

/**
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * WS-578 — SIZING ON THE ACTION.
 *
 * `my_raise_to_bb` is populated on 1,676 of 1,676 aggressive actions and reached the card on
 * ZERO rules, because `emitConductCard` built the action distribution from a tally keyed on
 * the action NAME alone. A raise to 3.5bb and a raise to 12bb were the same row — and they
 * produce different pots, different SPRs and different continuing ranges, so their average
 * describes a player who does not exist. A simulator's transition function is undefined
 * without `(action, amount)`, which is why WS-580 and WS-582 both stalled here.
 * ───────────────────────────────────────────────────────────────────────────────────────────
 */
describe('sizing bands — the classifier (WS-578)', () => {
  it('bands preflop on the bb LATTICE, with the 3.5bb point mass in its own cell', () => {
    // 675 of villain 2's 1,106 preflop raises are exactly 3.5bb, and 99.5% sit on the 0.5bb
    // lattice. A fixed-width banding would merge the one value that matters with its neighbours.
    expect(bandFor(3.5, null, 'preflop', 'S2')).toBe('3.5');
    expect(bandFor(3.0, null, 'preflop', 'S2')).toBe('<3.25');
    expect(bandFor(4.0, null, 'preflop', 'S2')).toBe('4-4.5');
    expect(bandFor(4.5, null, 'preflop', 'S2')).toBe('4-4.5');
    expect(bandFor(6.0, null, 'preflop', 'S2')).toBe('5-8');
  });

  it('S2 v2: the 12bb MODAL 3-BET gets its own band, and the jam tail sits above it', () => {
    // v1 pooled everything at or above 8bb. That band carried 8,325,235 of 8,327,391 preflop
    // sum-of-squares — essentially ALL the reconstruction error — and 121 of its 191
    // observations were the single value 12.0. It also conflated the modal 3-bet with the jam
    // tail, which are different ACTIONS rather than different sizes of one action.
    expect(bandFor(9.5, null, 'preflop', 'S2')).toBe('8-11.75');
    expect(bandFor(11, null, 'preflop', 'S2')).toBe('8-11.75');
    // The point band: +-0.25, half the 0.5bb lattice step, the same convention 3.5bb got. The
    // nearest observed neighbours are 11 and 13, so it captures the 121 and nothing else.
    expect(bandFor(12.0, null, 'preflop', 'S2')).toBe('12');
    expect(bandFor(11.7, null, 'preflop', 'S2')).toBe('8-11.75');
    expect(bandFor(12.3, null, 'preflop', 'S2')).toBe('12.25-79');
    expect(bandFor(35, null, 'preflop', 'S2')).toBe('12.25-79');
    expect(bandFor(58, null, 'preflop', 'S2')).toBe('12.25-79');
    // The jam edge sits in the LARGEST GAP in the distribution — 58 to 100, a 42bb hole where
    // the next largest gap is 9bb. An edge in an empty region is not fitted to the 9 shoves
    // above it: anywhere inside (58, 100) yields identical counts.
    expect(bandFor(100, null, 'preflop', 'S2')).toBe('>=79');
    expect(bandFor(118.9, null, 'preflop', 'S2')).toBe('>=79');
  });

  it('bands postflop on the POT FRACTION, never on bb', () => {
    // The three profiled villains sit at medians 0.746 / 0.483 / 0.667 — three different cells.
    // In bb the same three sizes are not comparable across pots at all.
    expect(bandFor(7.46, 10, 'flop', 'S2')).toBe('0.72-0.95');
    expect(bandFor(4.83, 10, 'turn', 'S2')).toBe('0.45-0.60');
    expect(bandFor(6.67, 10, 'river', 'S2')).toBe('0.60-0.72');
    expect(bandFor(15, 10, 'river', 'S2')).toBe('>=0.95');
    // Same NUMBER of big blinds, different pot — and therefore a different band. That is the
    // whole reason the two regimes are separate.
    expect(bandFor(7.46, 30, 'flop', 'S2')).toBe('<0.45');
  });

  it('names the unsized cell rather than dropping the row', () => {
    // A silently discarded row is how a sample stops being representative without anyone
    // noticing — the same reason `openSizeAxis` names and counts its two tails.
    expect(bandFor(null, 10, 'flop', 'S2')).toBe(SIZING_UNSIZED_BAND);
    expect(bandFor(5, 0, 'flop', 'S2')).toBe(SIZING_UNSIZED_BAND);
    expect(bandFor(5, null, 'turn', 'S2')).toBe(SIZING_UNSIZED_BAND);
  });

  it('THE TWO ARMS BAND THE SAME INPUT DIFFERENTLY — which is what makes the delta a result', () => {
    // `.claude/rules/unmeasured-constants.md`: both arms are real arms and the DELTA between
    // them is reported, not buried. Two arms that agreed everywhere would make the delta
    // uninformative by construction.
    expect(bandFor(3.0, null, 'preflop', 'S2')).toBe('<3.25');
    expect(bandFor(3.0, null, 'preflop', 'S3')).toBe('3-4.5');
    expect(bandFor(3.5, null, 'preflop', 'S2')).toBe('3.5');
    expect(bandFor(3.5, null, 'preflop', 'S3')).toBe('3-4.5');
    // Postflop: S3 is the repo's OWN existing bet_x_pot table (induceCore.mjs), not a re-fit.
    expect(bandFor(4.2, 10, 'flop', 'S2')).toBe('<0.45');
    expect(bandFor(4.2, 10, 'flop', 'S3')).toBe('medium');
    expect(bandFor(10.2, 10, 'river', 'S2')).toBe('>=0.95');
    expect(bandFor(10.2, 10, 'river', 'S3')).toBe('large');
    // The S2 v2 tail split did NOT touch S3 — the fixed-convention arm has to stay fixed, or
    // the delta stops measuring the constant and starts measuring both arms moving together.
    expect(SIZING_SCHEME_VERSIONS.S3).toBe(1);
    expect(bandFor(12, null, 'preflop', 'S3')).toBe('>=8');
    expect(bandFor(118.9, null, 'preflop', 'S3')).toBe('>=8');
  });

  it('declares a TOTAL partition per regime, so no value can vanish between two bands', () => {
    for (const scheme of ['S2', 'S3']) {
      const d = bandingDeclaration(scheme);
      for (const bands of Object.values(d.regimes)) {
        expect(bands[0].lo).toBe(0);
        for (let i = 1; i < bands.length; i += 1) expect(bands[i].lo).toBe(bands[i - 1].hi);
        // The tail is open. A bounded top band is a size with nowhere to go.
        expect(bands[bands.length - 1].hi).toBeNull();
      }
    }
  });
});

describe('sizing shrinkage — SHRINK, not refuse (WS-578)', () => {
  /**
   * A sizing band is a DECISION INPUT: it feeds a simulator's transition function and is never
   * a displayed comparative claim. `.claude/rules/sparsity-refuse-or-shrink.md` therefore says
   * SHRINK TOWARD THE PARENT. Refusal belongs where a band reaches a human — a ranked spot
   * list, a Guide — and the flag is what carries the distinction, because class is set by
   * where the number ends up, not by where it was computed.
   */
  const cells = [{ regime: PREFLOP, band: '3.5' }, { regime: PREFLOP, band: '>=8' }];
  const run = (k35, kBig, n) => shrinkBands({
    cells,
    counts: new Map([[cellKey(PREFLOP, '3.5'), k35], [cellKey(PREFLOP, '>=8'), kBig]]),
    n,
    parentCounts: new Map([[cellKey(PREFLOP, '3.5'), 675], [cellKey(PREFLOP, '>=8'), 191]]),
    parentN: 866,
    popCounts: new Map([[cellKey(PREFLOP, '3.5'), 675], [cellKey(PREFLOP, '>=8'), 191]]),
    popN: 866,
    parentLabel: 'raise@card',
  });

  it('a THIN cell is shrunk toward the parent and flagged — it is not refused and not blanked', () => {
    const [big35, tail] = run(4, 0, 4);
    expect(big35.thin).toBe(true);
    expect(big35.shrunk).toBe(true);
    expect(big35.shrunkToward).toBe('raise@card');
    // The raw rate says he ALWAYS raises to 3.5 here, on four observations. The shrunk estimate
    // pulls it back toward what he does across the card, and the raw value is kept beside it.
    expect(big35.pRaw).toBe(1);
    expect(big35.p).toBeLessThan(1);
    expect(big35.p).toBeGreaterThan(0.5);
    // A ZERO band keeps a NON-ZERO estimate on purpose: a simulator must not assign probability
    // zero to a size he demonstrably uses elsewhere because one leaf never contained it.
    expect(tail.k).toBe(0);
    expect(tail.pRaw).toBe(0);
    expect(tail.p).toBeGreaterThan(0);
  });

  it('never edits a COUNT — only the estimate over it', () => {
    const [a, b] = run(4, 0, 4);
    expect(a.k).toBe(4);
    expect(b.k).toBe(0);
    expect(a.n).toBe(4);
  });

  it("marks thin against the repo's OWN minimum leaf size, not a new constant", () => {
    expect(SIZING_PRIOR_WEIGHT).toBe(25); // induceCore.mjs MIN_RULE_DEFAULT
    expect(run(20, 4, 24)[0].thin).toBe(true);
    expect(run(20, 6, 26)[0].thin).toBe(false);
  });

  it('applies the estimator UNIFORMLY, so there is no discontinuity at the threshold', () => {
    // A shrink that switched on at n = 25 would make a cell at 24 and a cell at 26 products of
    // different estimators, incomparable in a way nothing on the card would show.
    const at24 = run(12, 12, 24)[0];
    const at26 = run(13, 13, 26)[0];
    expect(at24.shrunk).toBe(true);
    expect(at26.shrunk).toBe(true);
    expect(Math.abs(at24.p - at26.p)).toBeLessThan(0.02);
  });

  it('a thick cell is barely moved — the data dominates its own prior', () => {
    const thick = run(600, 200, 800)[0];
    expect(thick.thin).toBe(false);
    expect(Math.abs(thick.shift)).toBeLessThan(0.01);
  });
});

describe('sizing on the card — the refusals (WS-578)', () => {
  it('accepts a well-formed sized card', () => {
    expect(conductCardProblems(sizedCard())).toEqual([]);
  });

  it("REFUSES bands that do not sum to the action's own k — at author time, by throwing", () => {
    // The same constraint `buildMix` already enforces on the action distribution against n.
    // WS-578 AC1: "a dropped residue here is a silently narrowed sizing policy".
    expect(() => buildMix({
      ruleId: 'r-bad',
      when: 'x',
      n: 100,
      actions: [
        { action: 'fold', k: 60, ci: [0.5, 0.7], sizing: null },
        {
          action: 'raise',
          k: 40,
          ci: [0.3, 0.5],
          sizing: sizingBlock({ bands: bandsFrom(PREFLOP, 'S2', { '3.5': 30 }, 40) }),
        },
      ],
      verdict: MIX_VERDICTS.MIX,
    })).toThrow(/account for every decision of this action/);
  });

  it('REFUSES an ALT arm that dropped rows — a lossy arm makes the delta measure the bug', () => {
    expect(() => buildMix({
      ruleId: 'r-bad2',
      when: 'x',
      n: 100,
      actions: [
        { action: 'fold', k: 60, ci: [0.5, 0.7], sizing: null },
        {
          action: 'raise',
          k: 40,
          ci: [0.3, 0.5],
          sizing: sizingBlock({ altBands: bandsFrom(PREFLOP, 'S3', { '3-4.5': 39 }, 40) }),
        },
      ],
      verdict: MIX_VERDICTS.MIX,
    })).toThrow(/sizing\.altBands must account for every decision/);
  });

  it('catches a dropped residue at READ time too, on a card that never went through buildMix', () => {
    // The check that only runs on the write path is the check that is not there when a card
    // arrives from disk.
    const bad = JSON.parse(JSON.stringify(sizedCard()));
    // bands[1] is the `3.5` cell carrying 30 of the 40; drop five of them on the floor.
    bad.rules[0].actions[1].sizing.bands[1].k = 25; // 25 + 10 != 40
    expect(conductCardProblems(bad).join(' ')).toMatch(/sums to 35 but the action's k is 40/);
  });

  it('REFUSES a band measured under a scheme version the card does not declare', () => {
    // Cells measured under one lattice are not cells of another. Quietly re-reading them is
    // WS-291's mechanism: a wrong number that never has to meet a right one.
    const bad = sizedCard({
      rules: [sizedMix({
        actions: [
          { action: 'fold', k: 60, ci: [0.5, 0.7], sizing: null },
          { action: 'raise', k: 40, ci: [0.3, 0.5], sizing: sizingBlock({ schemeVersion: 99 }) },
        ],
      })],
    });
    expect(conductCardProblems(bad).join(' ')).toMatch(/banded under S2 v99 but the card declares S2 v2/);
  });

  it('REFUSES a card schemaVersion this loader does not understand', () => {
    // Version-AGNOSTIC on purpose. This assertion used to hardcode `is not 3`, and it broke the
    // moment WS-551 added `score` and bumped conductCard to 4 - a passing loader failing its own
    // test because a SIBLING field landed. The refusal being tested is "the loader rejects a
    // version it does not understand", which is a property of the loader, not of any one number.
    const current = SOR_SCHEMA_VERSIONS.conductCard;
    const stale = current - 1;
    expect(conductCardProblems(sizedCard({ schemaVersion: stale })).join(' '))
      .toMatch(new RegExp(`schemaVersion ${stale} is not ${current}`));
    expect(current).toBeGreaterThanOrEqual(3);
  });

  it("REFUSES a band naming a band the card's own boundary table does not contain", () => {
    const bad = JSON.parse(JSON.stringify(sizedCard()));
    bad.rules[0].actions[1].sizing.bands[0].band = 'to3.5';
    expect(conductCardProblems(bad).join(' ')).toMatch(/is not in the S2 table the card declares/);
  });

  it('REFUSES a band that does not name its regime — a bb cell and a fraction cell never pool', () => {
    const bad = JSON.parse(JSON.stringify(sizedCard()));
    delete bad.rules[0].actions[1].sizing.bands[0].regime;
    expect(conductCardProblems(bad).join(' ')).toMatch(/does not name a regime on the closed list/);
  });

  it('REFUSES a band that does not carry the shrunk flag', () => {
    // A shrunk number is indistinguishable from a measured one to a downstream consumer unless
    // the distinction is carried as DATA. That indistinguishability is the WS-291 mechanism.
    const bad = JSON.parse(JSON.stringify(sizedCard()));
    bad.rules[0].actions[1].sizing.bands[0].shrunk = false;
    expect(conductCardProblems(bad).join(' ')).toMatch(/does not carry the shrunk flag/);
  });

  it('REFUSES a shrunk band that does not name its parent', () => {
    const bad = JSON.parse(JSON.stringify(sizedCard()));
    delete bad.rules[0].actions[1].sizing.bands[0].shrunkToward;
    expect(conductCardProblems(bad).join(' ')).toMatch(/marked shrunk but does not name its parent/);
  });

  it('REFUSES a raise whose sizing is null — the size is populated on every observed one', () => {
    const bad = sizedCard({
      rules: [sizedMix({
        actions: [
          { action: 'fold', k: 60, ci: [0.5, 0.7], sizing: null },
          { action: 'raise', k: 40, ci: [0.3, 0.5], sizing: null },
        ],
      })],
    });
    expect(conductCardProblems(bad).join(' ')).toMatch(/null here discards it/);
  });

  it('REFUSES an absent sizing key once the card declares a banding (AC2: absent != null)', () => {
    const bad = sizedCard({
      rules: [sizedMix({
        actions: [
          { action: 'fold', k: 60, ci: [0.5, 0.7] }, // key omitted entirely
          { action: 'raise', k: 40, ci: [0.3, 0.5], sizing: sizingBlock() },
        ],
      })],
    });
    expect(conductCardProblems(bad).join(' ')).toMatch(/every action must state its sizing/);
  });

  it('REFUSES a sizing block on a card that declares no banding', () => {
    const bad = card({
      rules: [sizedMix()],
      residual: { ruleId: 'r-sized', kind: 'partition-is-total' },
    });
    expect(conductCardProblems(bad).join(' '))
      .toMatch(/carries a sizing block but the card declares no sizingBanding/);
  });

  it('REQUIRES the sizingBanding key at all — null is a declaration, absent is an omission', () => {
    const bad = card();
    delete bad.sizingBanding;
    expect(conductCardProblems(bad).join(' ')).toMatch(/sizingBanding is required/);
  });

  it('REQUIRES both arms, the delta, the shrinkage note and the conventions on the header', () => {
    expect(conductCardProblems(sizedCard({ sizingBanding: banding({ delta: undefined }) })).join(' '))
      .toMatch(/sizingBanding.delta is required/);
    expect(conductCardProblems(sizedCard({ sizingBanding: banding({ shrinkage: undefined }) })).join(' '))
      .toMatch(/sizingBanding.shrinkage is required/);
    expect(conductCardProblems(sizedCard({ sizingBanding: banding({ conventions: undefined }) })).join(' '))
      .toMatch(/sizingBanding.conventions is required/);
    expect(conductCardProblems(sizedCard({ sizingBanding: banding({ primary: 'S9' }) })).join(' '))
      .toMatch(/must name one of the declared arms/);
  });

  it('REFUSES a boundary table with a gap — a value in the gap would be silently dropped', () => {
    const arms = banding().arms.map((a) => JSON.parse(JSON.stringify(a)));
    arms[0].regimes[PREFLOP][1].lo = 3.4; // was 3.25, leaving (3.25, 3.4) uncovered
    expect(conductCardProblems(sizedCard({ sizingBanding: banding({ arms }) })).join(' '))
      .toMatch(/is not a partition/);
  });

  it('carries the FULL boundary table on the card, so a later lattice change cannot re-base it', () => {
    // A card stamping only {scheme, version} still reads wrong under a build whose S2 means
    // something else, and its reader has no way to notice.
    const b = sizedCard().sizingBanding;
    const preflop = b.arms.find((a) => a.scheme === 'S2').regimes[PREFLOP];
    expect(preflop.map((x) => x.name))
      .toEqual(['<3.25', '3.5', '4-4.5', '5-8', '8-11.75', '12', '12.25-79', '>=79']);
    expect(preflop[1]).toMatchObject({ lo: 3.25, hi: 3.75 });
  });

  it('freezes the sizing block, like every other part of a built mix', () => {
    const m = sizedMix();
    expect(Object.isFrozen(m.actions[1].sizing)).toBe(true);
    expect(Object.isFrozen(m.actions[1].sizing.bands)).toBe(true);
    expect(Object.isFrozen(m.actions[1].sizing.bands[0])).toBe(true);
    expect(m.actions[0].sizing).toBeNull();
  });
});

describe('sizing — the subject who never bet or raised (WS-578)', () => {
  it('accepts a card with no banding whose every action carries an explicit null', () => {
    // The emitter declares `sizingBanding: null` when the subject has no aggressive decisions
    // at all, and still writes `sizing: null` on every action. That card is CORRECT, and an
    // earlier version of this check refused it — caught by walking the emitter's own null path
    // rather than by reasoning about it.
    const passive = buildMix({
      ruleId: 'r-passive',
      when: 'he folds or checks, always',
      n: 50,
      actions: [
        { action: 'fold', k: 30, ci: [0.45, 0.73], sizing: null },
        { action: 'check', k: 20, ci: [0.27, 0.55], sizing: null },
      ],
      verdict: MIX_VERDICTS.MIX,
    });
    const c = card({
      rules: [passive],
      residual: { ruleId: 'r-passive', kind: 'partition-is-total' },
      sizingBanding: null,
    });
    expect(conductCardProblems(c)).toEqual([]);
  });
});

describe('S2 v2 — a stored v1 card must REFUSE, not be re-read (WS-578)', () => {
  it('refuses a card banded under the retired S2 v1 lattice', () => {
    // This is the whole reason the scheme carries a version. Under v1, `>=8` meant [8, inf);
    // under v2 that interval is four bands. A reader that quietly accepted the v1 stamp would
    // be comparing cells from two different lattices while reporting one — WS-291's mechanism.
    expect(SIZING_SCHEME_VERSIONS.S2).toBe(2);
    const v1Card = sizedCard({
      rules: [sizedMix({
        actions: [
          { action: 'fold', k: 60, ci: [0.5, 0.7], sizing: null },
          { action: 'raise', k: 40, ci: [0.3, 0.5], sizing: sizingBlock({ schemeVersion: 1 }) },
        ],
      })],
    });
    expect(conductCardProblems(v1Card).join(' '))
      .toMatch(/banded under S2 v1 but the card declares S2 v2/);
  });

  it('assertBandingCompatible refuses a v1 declaration outright, rather than adapting', () => {
    // Producer-side twin of the check above: unreachable-or-mismatched is an ERROR, never a
    // fallback (.claude/rules/artifact-location.md).
    const live = bandingDeclaration('S2');
    expect(() => assertBandingCompatible({ ...live, version: 1 }, 'S2'))
      .toThrow(/version mismatch.*v1.*this build is v2/s);
    // A version that matches while the BOUNDARIES do not is the worse case — it means someone
    // moved an edge without bumping — and it is caught separately.
    const moved = JSON.parse(JSON.stringify(live));
    moved.regimes[PREFLOP][5].lo = 11.5;
    expect(() => assertBandingCompatible(moved, 'S2'))
      .toThrow(/version matched and the boundaries did not/);
    expect(assertBandingCompatible(live, 'S2')).toBe(true);
  });
});

describe('schema problems name the object they came from (WS-578)', () => {
  it('labels a missing required field `conductCard.`, not `object.`', () => {
    // PRE-EXISTING BUG, found while adding sizing. `checkAgainstSchema` destructures its third
    // argument (`{ label = 'object' } = {}`) and this validator passed the bare string
    // 'conductCard', so the destructure found no `label` and fell through to the default.
    // EVERY schema problem this validator has ever emitted read "object.<field> is required",
    // which identifies nothing. The messages looked plausible, which is why it survived.
    const bad = card();
    delete bad.population;
    const problems = conductCardProblems(bad);
    expect(problems.join(' ')).toMatch(/conductCard\.population is required/);
    expect(problems.join(' ')).not.toMatch(/\bobject\.population\b/);
  });

  it('labels a retyped field the same way', () => {
    const bad = card({ rules: 'not an array' });
    expect(conductCardProblems(bad).join(' ')).toMatch(/conductCard\.rules must be array/);
  });
});

// ── WS-551 held-out score fixtures ───────────────────────────────────────────────────────

/**
 * The baseline that actually WON on the first real run. Named once and used everywhere below, so
 * no test can accidentally check the card against a comparator no run ever produced.
 */
const BASELINE = 'legality-conditioned';

/**
 * THE FIRST REAL RUN'S NUMBERS, not invented ones.
 *
 * An 18-rule card scored 0.9302 bits/decision and was BEATEN by `legality-conditioned` at
 * 0.8651 — paired interval [-0.1099, -0.0209], ENTIRELY BELOW ZERO, coverage 100%. A validator
 * whose only fixture is a winning card has never been shown the one shape this field exists to
 * make reportable, and would pass while silently mangling it.
 *
 * The seed, the cuts and the floors come from the SCORER (imported above), never re-typed.
 */
const heldOutScore = (over = {}) => ({
  kind: HELD_OUT_SCORE_KIND,
  version: 1,
  scoringRule: 'negative log2-loss per decision (strictly proper over the action distribution)',
  unit: 'bits/decision',
  // Names `complete`. See the gaming argument on the rankingMetric test below.
  rankingMetric: 'bits.complete.card — lower is better',
  // NULL, not absent: the positive claim that the score RAN. Absent is a producer that forgot.
  refused: null,
  bits: {
    complete: { card: 0.9302, [BASELINE]: 0.8651 },
    covered: { card: 0.9302, [BASELINE]: 0.8651 },
  },
  lift: { [BASELINE]: 0.8651 - 0.9302 },
  liftInterval: {
    [BASELINE]: {
      diff: -0.0651, lo: -0.1099, hi: -0.0209,
      // BY HAND. A decision-resampled interval is narrower than the data supports, because one
      // holding drives a hand's flop, turn and river.
      unit: 'hand',
      resamples: BOOTSTRAP.resamples,
      seed: BOOTSTRAP.seed,
    },
  },
  verdict: { [BASELINE]: 'card-worse' },
  coverage: {
    evalDecisions: 812, covered: 812, offSupport: 0, share: 1,
    fallback: 'uniform over the legal actions',
  },
  split: { unit: 'hand', cuts: [...FOLD_CUTS], basis: HELD_OUT_SPLIT_BASES[0] },
  floors: FLOORS,
  seam: {
    scores: 'the inducer at this n, refit per fold',
    doesNotScore: 'the exact shipped ruleset — no held-out data exists that it has not seen',
  },
  ...over,
});

/**
 * A card carrying a score, with the manifest that score FORCES onto it.
 *
 * `emitConductCard` mints `seeds: {}` as the positive claim that the INDUCTION draws no
 * randomness — true, and incomplete the moment a bootstrap is stamped on. The producer's own
 * wiring extends both manifest blocks, and this fixture mirrors that rather than inventing a
 * shape the emitter would never write.
 */
const cardWithScore = (scoreOver = {}, cardOver = {}) => card({
  manifest: {
    engineCommit: 'deadbeef',
    engineDirty: false,
    dealBookHash: 'sha256:abc',
    seeds: { heldOutBootstrap: BOOTSTRAP.seed },
    constants: { heldOutFoldCuts: [...FOLD_CUTS] },
  },
  score: heldOutScore(scoreOver),
  ...cardOver,
});

describe('the held-out score (v4, WS-551) — the only figure on the card that could ever fall', () => {
  it('accepts a fully formed score', () => {
    expect(conductCardProblems(cardWithScore())).toEqual([]);
    expect(isValidConductCard(cardWithScore())).toBe(true);
  });

  it('still accepts a card with NO score at all — the field is optional and v3 cards predate it', () => {
    // The additive contract. A card written before the field existed must not start failing
    // because a later schema grew one, so `scoreProblems` gates on PRESENCE and the base
    // fixture — which carries no `score` key at all — has to stay green.
    expect('score' in card()).toBe(false);
    expect(conductCardProblems(card())).toEqual([]);
    // Explicit null is the OTHER accepted state: never scored, said positively.
    expect(conductCardProblems(card({ score: null }))).toEqual([]);
  });

  it('carries the run where THE CARD LOST, with the interval entirely below zero', () => {
    // THE MEASURED RESULT, and the reason `verdict` is three-valued rather than two. An 18-rule
    // card at 0.9302 bits/dec lost to `legality-conditioned` at 0.8651; the paired 95% interval
    // was [-0.1099, -0.0209], wholly below zero. A better/not-better label would have filed the
    // most consequential thing this instrument can say — THE BASELINE BEAT THE CARD — under
    // "no lift", and lost it.
    const c = cardWithScore();
    expect(conductCardProblems(c)).toEqual([]);

    const ci = c.score.liftInterval[BASELINE];
    expect(ci.hi).toBeLessThan(0);
    expect(c.score.verdict[BASELINE]).toBe('card-worse');
    // Lower bits is better, so the baseline scoring FEWER bits IS the card losing. The verdict
    // and the numbers behind it have to agree or the verdict is decorative.
    expect(c.score.bits.complete[BASELINE]).toBeLessThan(c.score.bits.complete.card);
    expect(HELD_OUT_VERDICTS).toEqual(['card-better', 'card-worse', 'inconclusive']);
  });

  it('accepts a NAMED refusal that carries no numbers', () => {
    // A held-out score RANKS CARDS, so it is a comparative claim, so per
    // `.claude/rules/sparsity-refuse-or-shrink.md` it REFUSES rather than shrinking. The refusal
    // is the CORRECT output at thin n — not a failure state — and it must validate.
    const refusal = card({
      score: {
        kind: HELD_OUT_SCORE_KIND,
        version: 1,
        refused: {
          reason: HELD_OUT_REFUSAL_REASONS.INSUFFICIENT_EVAL_HANDS,
          detail: `41 held-out hands, floor ${FLOORS.minEvalHands}`,
        },
      },
    });
    expect(conductCardProblems(refusal)).toEqual([]);
  });

  it('REFUSES a refusal that still ships figures — the number would travel as though measured', () => {
    // THE DEFECT, not a lenient version of one. `bits` under a non-null `refused` is a figure
    // produced at an n the instrument ITSELF declared unusable, and once it is on the card it is
    // indistinguishable from a measured one to every downstream reader. That is WS-291's
    // mechanism exactly: a wrong number that never has to meet a right one.
    const bad = cardWithScore({
      refused: {
        reason: HELD_OUT_REFUSAL_REASONS.COVERAGE_BELOW_FLOOR,
        detail: `coverage 31%, floor ${(100 * FLOORS.minCoverage).toFixed(0)}%`,
      },
    });
    const problems = conductCardProblems(bad).join(' ');
    expect(problems).toMatch(/refused is set but score\.bits carries numbers/);
    // And the same defect one level out: lift, interval and verdict are all COMPARISONS, and
    // nothing was scored, so nothing may be compared.
    expect(problems).toMatch(/score\.liftInterval carries entries/);
    expect(problems).toMatch(/score\.verdict carries entries/);
  });

  it('REFUSES an off-enum refusal reason — an unnamed refusal is the blank this field replaces', () => {
    // The enum lives in `src/` and the SCORER imports it, one direction only. An enum written
    // out in both places is two representations that never have to agree, and this directory
    // has been bitten by that twice.
    expect(isHeldOutRefusal('not-enough-data')).toBe(false);
    expect(isHeldOutRefusal(HELD_OUT_REFUSAL_REASONS.DEGENERATE_SPLIT)).toBe(true);
    const bad = card({
      score: {
        kind: HELD_OUT_SCORE_KIND,
        version: 1,
        refused: { reason: 'not-enough-data', detail: 'n was small' },
      },
    });
    expect(conductCardProblems(bad).join(' ')).toMatch(/is not on the closed list/);
  });

  it('REFUSES an ABSENT `refused` key, while accepting null', () => {
    // Absent vs null is load-bearing, and it is the whole reason the key is REQUIRED rather than
    // defaulted. `null` is the positive claim that the score ran to completion. An absent key is
    // indistinguishable from a producer that forgot to write one — and a reader that treats
    // missing-as-null converts a bug into a measurement.
    const s = heldOutScore();
    delete s.refused;
    expect(conductCardProblems(cardWithScore({}, { score: s })).join(' '))
      .toMatch(/score\.refused is required/);
    // The same object with the key restored to null is valid, so it is the KEY being checked
    // here and nothing else about the fixture.
    expect(conductCardProblems(cardWithScore())).toEqual([]);
  });

  it('REFUSES a verdict key with no matching liftInterval key, in both directions', () => {
    // A verdict with no interval behind it is an assertion wearing a measurement's clothes —
    // the same defect as the in-sample accuracy this whole field replaces, one level up.
    const extraVerdict = cardWithScore({
      verdict: { [BASELINE]: 'card-worse', 'uniform-legal': 'card-better' },
    });
    expect(conductCardProblems(extraVerdict).join(' '))
      .toMatch(/score\.verdict keys \[.*\] do not match score\.liftInterval keys/);

    // The mirror case, which is not symmetrical in consequence: an interval with no verdict
    // leaves the READING of it to whoever renders it, and the page and the run then disagree.
    const extraInterval = cardWithScore({
      liftInterval: {
        ...heldOutScore().liftInterval,
        'uniform-legal': {
          diff: 0.4, lo: 0.31, hi: 0.49, unit: 'hand',
          resamples: BOOTSTRAP.resamples, seed: BOOTSTRAP.seed,
        },
      },
    });
    expect(conductCardProblems(extraInterval).join(' '))
      .toMatch(/do not match score\.liftInterval keys/);
  });

  it('REFUSES a rankingMetric naming bits.covered instead of bits.complete', () => {
    // THE ANTI-GAMING CLAUSE, and the single most important line in this validator.
    //
    // `covered` scores only the rows the card CHOSE to govern. A card that refused everything it
    // was unsure of would govern nothing but its easiest spots and score beautifully on it —
    // ranking would then REWARD declining to answer, which is the exact opposite of what a
    // policy is for. `complete` scores EVERY held-out decision, off-support ones by the declared
    // fallback, so refusing a row cannot improve it: the row still gets scored, just worse.
    //
    // Both figures are carried on purpose (`covered` is the diagnostic), which is what makes
    // naming the wrong one a plausible mistake rather than an obvious one — it is not a missing
    // number, it is a pointer at the wrong existing number.
    expect(conductCardProblems(cardWithScore({ rankingMetric: 'bits.covered.card — lower is better' })).join(' '))
      .toMatch(/rankingMetric must name bits\.complete and never bits\.covered/);

    // A metric naming NEITHER is refused too. The clause is "must name complete", not merely
    // "must not name covered", so a vague label cannot slip past by being silent.
    expect(conductCardProblems(cardWithScore({ rankingMetric: 'log loss' })).join(' '))
      .toMatch(/rankingMetric must name bits\.complete/);

    // And BOTH figures must be present. Reporting one without the other loses the very
    // distinction that makes refusal unrewarding.
    const onlyComplete = heldOutScore();
    delete onlyComplete.bits.covered;
    expect(conductCardProblems(cardWithScore({}, { score: onlyComplete })).join(' '))
      .toMatch(/score\.bits must carry BOTH \{complete, covered\}/);
  });

  it('REFUSES a bits.complete.card that is negative or non-finite', () => {
    // Bits are a negative log2 of a probability averaged over decisions, so a negative mean is
    // arithmetically impossible. It says the scorer is broken, not that the card is excellent —
    // and a negative number here would sort to the top of a "lower is better" ranking.
    expect(conductCardProblems(cardWithScore({
      bits: { complete: { card: -0.2, [BASELINE]: 0.8651 }, covered: { card: -0.2 } },
    })).join(' ')).toMatch(/score\.bits\.complete\.card must be a finite number >= 0/);

    // An Infinity is the other end of the same clause and means something different and worse:
    // the model assigned probability ZERO to an action that then actually happened. A card that
    // can rule out what the villain did is not a card with a large score, it is falsified.
    expect(conductCardProblems(cardWithScore({
      bits: { complete: { card: Infinity, [BASELINE]: 0.8651 }, covered: { card: Infinity } },
    })).join(' ')).toMatch(/score\.bits\.complete\.card must be a finite number >= 0/);

    // NaN reaches the same clause because the check is `Number.isFinite` and not a bare `< 0`
    // comparison — `NaN < 0` is false, so a comparison alone would have waved it through.
    expect(conductCardProblems(cardWithScore({
      bits: { complete: { card: NaN, [BASELINE]: 0.8651 }, covered: { card: NaN } },
    })).join(' ')).toMatch(/score\.bits\.complete\.card must be a finite number >= 0/);
  });

  it('REFUSES a seed or a cut set absent from the manifest — ADR-009 replication clause', () => {
    // A figure that cannot be re-derived is not a slightly worse figure; it is one nobody can
    // ever tell is wrong. The bootstrap draws randomness and the fold cuts decide which rows
    // were fit and which were scored, so both are part of what a replication needs — and the
    // manifest is where a replication LOOKS. A seed living only on the figure it produced is
    // not in the manifest at all.
    const straySeed = cardWithScore({
      liftInterval: {
        [BASELINE]: { ...heldOutScore().liftInterval[BASELINE], seed: BOOTSTRAP.seed + 1 },
      },
    });
    expect(conductCardProblems(straySeed).join(' ')).toMatch(/does not appear in manifest\.seeds/);

    // A DIFFERENT CUT SET IS A DIFFERENT QUESTION. These cuts are well-formed — ascending and
    // inside (0, 1) — so the only thing wrong with them is that the manifest cannot say they
    // ran, which is precisely the clause under test.
    const strayCuts = cardWithScore({
      split: { unit: 'hand', cuts: [0.6, 0.75], basis: HELD_OUT_SPLIT_BASES[0] },
    });
    expect(conductCardProblems(strayCuts).join(' ')).toMatch(/do not appear in manifest\.constants/);

    // And the blocks must EXIST. The base fixture mints `seeds: {}` and no `constants` at all —
    // correct for an unscored card, insufficient the moment a score lands on it.
    const problems = conductCardProblems(card({ score: heldOutScore() })).join(' ');
    expect(problems).toMatch(/manifest\.constants is missing/);
    expect(problems).toMatch(/does not appear in manifest\.seeds/);
  });
});
