/**
 * @file Tests for solverBaselines.js — extensible lookup table.
 */

import { describe, it, expect } from 'vitest';
import {
  getSolverBaseline,
  listCoveredSituationKeys,
  baselineCoverageByPrefix,
} from '../solverBaselines.js';

describe('getSolverBaseline', () => {
  it('returns the baseline entry for a known IP cbet defense key', () => {
    const baseline = getSolverBaseline('flop:medium:LATE:def:ip:bet:vsBet');
    expect(baseline).not.toBeNull();
    expect(baseline.baseline).toBe(0.38);
    expect(baseline.source).toBe('hardcoded');
    expect(baseline.confidence).toBeGreaterThan(0);
  });

  it('returns null for an unknown situation key', () => {
    expect(getSolverBaseline('turn:wet:EARLY:agg:oop:none:cbet')).toBeNull();
  });

  it('all 6 v1 IP cbet defense keys are present', () => {
    const expectedKeys = [
      'flop:dry:LATE:def:ip:bet:vsBet',
      'flop:medium:LATE:def:ip:bet:vsBet',
      'flop:wet:LATE:def:ip:bet:vsBet',
      'flop:dry:BUTTON:def:ip:bet:vsBet',
      'flop:medium:BUTTON:def:ip:bet:vsBet',
      'flop:wet:BUTTON:def:ip:bet:vsBet',
    ];
    for (const key of expectedKeys) {
      const entry = getSolverBaseline(key);
      expect(entry, `missing ${key}`).not.toBeNull();
      expect(entry.baseline).toBeGreaterThan(0);
      expect(entry.baseline).toBeLessThan(1);
    }
  });

  it('all entries have the required schema fields', () => {
    for (const key of listCoveredSituationKeys()) {
      const entry = getSolverBaseline(key);
      expect(entry.baseline).toBeTypeOf('number');
      expect(entry.source).toBeTypeOf('string');
      expect(entry.confidence).toBeTypeOf('number');
      expect(entry.lastValidatedAt).toBeTypeOf('string');
    }
  });

  it('wet boards have higher baseline fold rate than dry (texture-conditioning sanity check)', () => {
    const dry = getSolverBaseline('flop:dry:LATE:def:ip:bet:vsBet');
    const wet = getSolverBaseline('flop:wet:LATE:def:ip:bet:vsBet');
    expect(wet.baseline).toBeGreaterThan(dry.baseline);
  });
});

describe('listCoveredSituationKeys', () => {
  it('returns sorted list of all baseline keys', () => {
    const keys = listCoveredSituationKeys();
    expect(keys.length).toBeGreaterThanOrEqual(6);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

describe('baselineCoverageByPrefix', () => {
  it('groups by street:texture:posCategory prefix', () => {
    const coverage = baselineCoverageByPrefix();
    expect(coverage['flop:medium:LATE']).toBeGreaterThanOrEqual(1);
    expect(coverage['flop:dry:BUTTON']).toBeGreaterThanOrEqual(1);
  });
});
