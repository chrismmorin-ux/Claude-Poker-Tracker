/**
 * coverageCensus.test.js — WS-328.
 *
 * The tests that matter here are the REFUSALS. A census that only counted what was observed
 * would pass every "does it count things" test ever written, and would still be unable to tell
 * "we looked and found none" from "we never looked" — which is the whole reason the object
 * exists. So the load-bearing assertions are that the builder throws without an examination
 * declaration, and that an unexamined cell is a POSITIVELY MARKED ROW rather than an absence.
 */

import { describe, it, expect } from 'vitest';

import {
  CELL_STATUSES,
  UNEXAMINED_REASONS,
  enumerateContexts,
  declareExamination,
  buildCoverageCensus,
  coverageCensusProblems,
  censusCoverage,
  neverLooked,
  observedZeros,
} from '../coverageCensus.js';
import { StandardOfRecordError } from '../schemas.js';

const AXES = [
  { name: 'street', levels: ['preflop', 'flop'] },
  { name: 'facingAction', levels: ['none', 'bet', 'raise'] },
];
const DOMAIN = { gameType: 'cash', seats: 9, stackDepthBB: [80, 200] };

describe('enumerateContexts', () => {
  it('emits the full cross product of the declared axes', () => {
    const contexts = enumerateContexts(AXES);
    expect(contexts).toHaveLength(6);
    expect(contexts.map((c) => c.contextKey)).toContain('flop|raise');
    expect(contexts[0].coords).toEqual({ street: 'preflop', facingAction: 'none' });
  });

  it('refuses a domain with no axes — "zero" would have nothing to be relative to', () => {
    expect(() => enumerateContexts([])).toThrow(StandardOfRecordError);
  });

  it('refuses an axis level containing the key separator, which would collide two contexts', () => {
    expect(() => enumerateContexts([{ name: 'x', levels: ['a|b'] }])).toThrow(/separator/);
  });
});

describe('the never-looked / observed-zero distinction', () => {
  it('REFUSES to build without an examination declaration', () => {
    // This is the test that fails against any implementation that infers examination from the
    // hit map. Such an implementation cannot produce `unexamined` at all.
    expect(() => buildCoverageCensus({
      domain: DOMAIN, axes: AXES, hits: { 'preflop|none': 12 },
    })).toThrow(/examination/);
  });

  it('marks a cell the run never examined as `unexamined` WITH a reason, not as a missing row', () => {
    const census = buildCoverageCensus({
      domain: DOMAIN,
      axes: AXES,
      hits: { 'preflop|none': 12, 'preflop|raise': 3 },
      examination: declareExamination({
        mode: 'enumerated',
        contexts: ['preflop|none', 'preflop|bet', 'preflop|raise'],
        unexaminedReason: UNEXAMINED_REASONS.OUT_OF_RUN_SCOPE,
        basis: 'the run streamed preflop decisions only',
      }),
    });

    // Every context in the domain has a row. Nothing is representable by its absence.
    expect(census.cells).toHaveLength(6);
    expect(census.totalContexts).toBe(6);

    const byKey = Object.fromEntries(census.cells.map((c) => [c.contextKey, c]));

    // Examined and empty. WE LOOKED AND FOUND NONE.
    expect(byKey['preflop|bet'].status).toBe(CELL_STATUSES.OBSERVED_ZERO);
    expect(byKey['preflop|bet'].hits).toBe(0);

    // Never examined. WE NEVER LOOKED. Same hit count, entirely different fact.
    expect(byKey['flop|bet'].status).toBe(CELL_STATUSES.UNEXAMINED);
    expect(byKey['flop|bet'].hits).toBe(0);
    expect(byKey['flop|bet'].reason).toBe(UNEXAMINED_REASONS.OUT_OF_RUN_SCOPE);

    // And they are distinguishable by status, which a hit-count-only census could not do.
    expect(byKey['preflop|bet'].status).not.toBe(byKey['flop|bet'].status);
  });

  it('separates "a bug dropped them" from both of the above', () => {
    const census = buildCoverageCensus({
      domain: DOMAIN,
      axes: AXES,
      hits: { 'preflop|none': 5, 'flop|raise': 400 },
      dropped: {
        'flop|bet': 'engine-threw-on-texture-derivation',
        'flop|raise': 'engine-threw-on-texture-derivation',
      },
      droppedCounts: { 'flop|bet': 12, 'flop|raise': 3 },
      examination: declareExamination({ mode: 'exhaustive' }),
    });
    const byKey = Object.fromEntries(census.cells.map((c) => [c.contextKey, c]));

    // Reached, and EVERYTHING discarded. A bug signature — emphatically not a zero.
    expect(byKey['flop|bet'].status).toBe(CELL_STATUSES.DROPPED);
    expect(byKey['flop|bet'].droppedCount).toBe(12);
    expect(byKey['flop|bet'].reason).toBe('engine-threw-on-texture-derivation');

    // PARTLY dropped: 400 scored, 3 lost. Still a hit, but the loss is visible — collapsing
    // this into `dropped` would throw away 400 observations, and collapsing it into a clean
    // `hit` would hide the 3.
    expect(byKey['flop|raise'].status).toBe(CELL_STATUSES.HIT);
    expect(byKey['flop|raise'].hits).toBe(400);
    expect(byKey['flop|raise'].droppedCount).toBe(3);
    expect(byKey['flop|raise'].reason).toMatch(/partially dropped/);

    expect(byKey['flop|none'].status).toBe(CELL_STATUSES.OBSERVED_ZERO);

    const cov = censusCoverage(census);
    expect(cov.droppedDecisions).toBe(15);
    expect(cov.partiallyDroppedCells).toBe(1);
  });

  it('refuses hits on a context that was never examined — a contradiction, not a rounding issue', () => {
    expect(() => buildCoverageCensus({
      domain: DOMAIN,
      axes: AXES,
      hits: { 'flop|raise': 7 },
      examination: declareExamination({
        mode: 'enumerated',
        contexts: ['preflop|none'],
        unexaminedReason: UNEXAMINED_REASONS.NEVER_ENUMERATED,
      }),
    })).toThrow(/cannot hit a context you never looked at/);
  });

  it('refuses hits on a context outside the declared domain', () => {
    expect(() => buildCoverageCensus({
      domain: DOMAIN,
      axes: AXES,
      hits: { 'river|shove': 1 },
      examination: declareExamination({ mode: 'exhaustive' }),
    })).toThrow(/numerator and the denominator disagree/);
  });

  it('requires a reason for the unexamined set — silence would mean nothing again', () => {
    expect(() => declareExamination({ mode: 'enumerated', contexts: [] }))
      .toThrow(/unexaminedReason is required/);
  });
});

describe('censusCoverage', () => {
  const census = buildCoverageCensus({
    domain: DOMAIN,
    axes: AXES,
    hits: { 'preflop|none': 12, 'preflop|raise': 3 },
    unreachable: { 'preflop|bet': 'no seat can face a bare bet preflop; the BB is a raise' },
    examination: declareExamination({
      mode: 'enumerated',
      contexts: ['preflop|none', 'preflop|raise'],
      unexaminedReason: UNEXAMINED_REASONS.RUN_INCOMPLETE,
    }),
  });

  it('reports every figure with the conditioning set it is conditional on', () => {
    const cov = censusCoverage(census);
    expect(cov.hitGivenExamined).toEqual(expect.objectContaining({ k: 2, n: 2, rate: 1 }));
    expect(cov.hitGivenExamined.conditional).toMatch(/examined/);
    // 3 unexamined of 5 reachable (6 contexts, 1 unreachable).
    expect(cov.neverLookedGivenReachable).toEqual(expect.objectContaining({ k: 3, n: 5 }));
    expect(cov.neverLookedGivenReachable.conditional).toMatch(/NEVER LOOKED/);
    expect(cov.unreachableGivenDomain.k).toBe(1);
  });

  it('names the never-looked cells rather than only counting them', () => {
    const gaps = neverLooked(census);
    expect(gaps.map((g) => g.contextKey).sort()).toEqual(['flop|bet', 'flop|none', 'flop|raise']);
    expect(gaps.every((g) => g.reason === UNEXAMINED_REASONS.RUN_INCOMPLETE)).toBe(true);
    expect(observedZeros(census)).toHaveLength(0);
  });

  it('passes its own external validator', () => {
    expect(coverageCensusProblems(census)).toEqual([]);
  });

  it('rejects a hand-built census whose unexamined cells carry no reason', () => {
    const broken = {
      ...census,
      cells: census.cells.map((c) => (c.status === CELL_STATUSES.UNEXAMINED
        ? { ...c, reason: null } : c)),
    };
    expect(coverageCensusProblems(broken).join(' ')).toMatch(/must say why/);
  });
});
