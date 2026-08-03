/**
 * comparisonCensus.test.js — the contrasts nobody drew (founder directive 2026-08-03).
 *
 * The asymmetry under test: an unreached SITUATION leaves an empty row in the coverage
 * census. An undrawn COMPARISON leaves nothing at all. These tests assert the census makes
 * that absence nameable, and keeps "impossible" separate from "skipped".
 */

import { describe, it, expect } from 'vitest';
import {
  COMPARISON_AXES,
  BLOCK_REASONS,
  contrastKey,
  enumeratePossible,
  buildComparisonCensus,
  censusSummary,
} from '../comparisonCensus.js';

describe('contrast enumeration', () => {
  it('treats a contrast as unordered — comparing A to B is comparing B to A', () => {
    expect(contrastKey('a', 'b')).toBe(contrastKey('b', 'a'));
  });

  it('enumerates each pair exactly once, so the denominator does not lie', () => {
    expect(enumeratePossible(['a', 'b', 'c'])).toHaveLength(3);
    expect(enumeratePossible(['a'])).toHaveLength(0);
    expect(enumeratePossible([])).toHaveLength(0);
  });
});

describe('building the census', () => {
  const members = ['srf-A', 'srf-B', 'srf-C'];

  it('lists undrawn contrasts by NAME rather than as a count', () => {
    const c = buildComparisonCensus({
      axis: 'surface',
      members,
      drawn: [{ contrast: contrastKey('srf-A', 'srf-B'), resultCardId: 'rc-1' }],
    });
    expect(c.notDrawn.map((n) => n.contrast).sort()).toEqual([
      contrastKey('srf-A', 'srf-C'),
      contrastKey('srf-B', 'srf-C'),
    ].sort());
  });

  it('stores notDrawn rather than deriving it, so it survives summarisation', () => {
    const c = buildComparisonCensus({ axis: 'surface', members, drawn: [] });
    expect(Object.prototype.hasOwnProperty.call(c, 'notDrawn')).toBe(true);
    expect(c.notDrawn).toHaveLength(3);
  });

  it('defaults an unexplained gap to NOT_ATTEMPTED — the case the directive is about', () => {
    const c = buildComparisonCensus({ axis: 'surface', members, drawn: [] });
    expect(c.notDrawn.every((n) => n.reason === BLOCK_REASONS.NOT_ATTEMPTED)).toBe(true);
    expect(c.notDrawn.every((n) => n.blocked === false)).toBe(true);
  });

  it('separates BLOCKED from NOT ATTEMPTED — they have opposite implications', () => {
    const c = buildComparisonCensus({
      axis: 'generation',
      members,
      drawn: [],
      blockedReasons: {
        [contrastKey('srf-A', 'srf-B')]: BLOCK_REASONS.GENERATIONS_NOT_REBASED,
      },
    });
    const blocked = c.notDrawn.filter((n) => n.blocked);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].contrast).toBe(contrastKey('srf-A', 'srf-B'));
  });

  it('REFUSES a drawn contrast with no Result Card behind it', () => {
    expect(() => buildComparisonCensus({
      axis: 'surface', members, drawn: [{ contrast: contrastKey('srf-A', 'srf-B') }],
    })).toThrow(/names no resultCardId/);
  });

  it('refuses a drawn contrast that is not among the possible ones', () => {
    expect(() => buildComparisonCensus({
      axis: 'surface', members, drawn: [{ contrast: 'srf-A vs srf-Z', resultCardId: 'rc-9' }],
    })).toThrow(/denominator and the numerator disagree/);
  });

  it('refuses an unknown axis, so two censuses never silently union', () => {
    expect(() => buildComparisonCensus({ axis: 'vibes', members })).toThrow(/axis must be one of/);
    expect(COMPARISON_AXES).toContain('layer');
  });
});

describe('the summary', () => {
  const members = ['a', 'b', 'c', 'd']; // 6 possible contrasts

  it('reports notAttempted on its own rather than folded into a coverage number', () => {
    const s = censusSummary(buildComparisonCensus({
      axis: 'surface',
      members,
      drawn: [{ contrast: contrastKey('a', 'b'), resultCardId: 'rc-1' }],
      blockedReasons: { [contrastKey('c', 'd')]: BLOCK_REASONS.NO_SHARED_DEAL_BOOK },
    }));
    expect(s.possible).toBe(6);
    expect(s.drawn).toBe(1);
    expect(s.blocked).toBe(1);
    expect(s.notAttempted).toBe(4);
    expect(s.notAttemptedContrasts).toHaveLength(4);
  });

  it('excludes blocked contrasts from the coverage denominator', () => {
    const s = censusSummary(buildComparisonCensus({
      axis: 'surface',
      members: ['a', 'b', 'c'], // 3 possible
      drawn: [{ contrast: contrastKey('a', 'b'), resultCardId: 'rc-1' }],
      blockedReasons: { [contrastKey('a', 'c')]: BLOCK_REASONS.NO_GROUND_TRUTH },
    }));
    // 1 drawn of 2 drawable, not 1 of 3 — a gap in the artifacts is not negligence.
    expect(s.drawableCoverage).toBeCloseTo(0.5);
  });

  it('returns null coverage rather than dividing by zero when nothing was drawable', () => {
    const s = censusSummary(buildComparisonCensus({
      axis: 'surface',
      members: ['a', 'b'],
      drawn: [],
      blockedReasons: { [contrastKey('a', 'b')]: BLOCK_REASONS.NO_SHARED_DEAL_BOOK },
    }));
    expect(s.drawableCoverage).toBeNull();
  });
});
