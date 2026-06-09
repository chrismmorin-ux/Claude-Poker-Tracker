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
  it('returns the baseline entry for a known IP cbet defense key (8-axis pfc)', () => {
    const baseline = getSolverBaseline('flop:medium:LATE:def:ip:bet:vsBet:pfc');
    expect(baseline).not.toBeNull();
    expect(baseline.baseline).toBe(0.38);
    expect(baseline.source).toBe('hardcoded');
    expect(baseline.confidence).toBeGreaterThan(0);
  });

  it('returns null for an unknown situation key', () => {
    expect(getSolverBaseline('turn:wet:EARLY:agg:oop:none:cbet:pfa')).toBeNull();
  });

  it('returns null for a 7-axis (pre-SPR-040) key — migration completeness check', () => {
    expect(getSolverBaseline('flop:medium:LATE:def:ip:bet:vsBet')).toBeNull();
  });

  it('all 6 v1 IP cbet defense keys are present (8-axis pfc)', () => {
    const expectedKeys = [
      'flop:dry:LATE:def:ip:bet:vsBet:pfc',
      'flop:medium:LATE:def:ip:bet:vsBet:pfc',
      'flop:wet:LATE:def:ip:bet:vsBet:pfc',
      'flop:dry:BUTTON:def:ip:bet:vsBet:pfc',
      'flop:medium:BUTTON:def:ip:bet:vsBet:pfc',
      'flop:wet:BUTTON:def:ip:bet:vsBet:pfc',
    ];
    for (const key of expectedKeys) {
      const entry = getSolverBaseline(key);
      expect(entry, `missing ${key}`).not.toBeNull();
      expect(entry.baseline).toBeGreaterThan(0);
      expect(entry.baseline).toBeLessThan(1);
    }
  });

  it('all 6 OOP cbet defense keys present (SPR-040 / WS-146 second claim)', () => {
    const expectedKeys = [
      'flop:dry:SMALL_BLIND:def:oop:bet:vsBet:pfc',
      'flop:medium:SMALL_BLIND:def:oop:bet:vsBet:pfc',
      'flop:wet:SMALL_BLIND:def:oop:bet:vsBet:pfc',
      'flop:dry:BIG_BLIND:def:oop:bet:vsBet:pfc',
      'flop:medium:BIG_BLIND:def:oop:bet:vsBet:pfc',
      'flop:wet:BIG_BLIND:def:oop:bet:vsBet:pfc',
    ];
    for (const key of expectedKeys) {
      const entry = getSolverBaseline(key);
      expect(entry, `missing ${key}`).not.toBeNull();
      expect(entry.baseline).toBeGreaterThanOrEqual(0.45);
      expect(entry.baseline).toBeLessThanOrEqual(0.55);
    }
  });

  it('all 6 donk-defense keys present (SPR-040 / WS-146 second claim)', () => {
    const expectedKeys = [
      'flop:dry:LATE:def:ip:bet:vsBet:pfa',
      'flop:medium:LATE:def:ip:bet:vsBet:pfa',
      'flop:wet:LATE:def:ip:bet:vsBet:pfa',
      'flop:dry:BUTTON:def:ip:bet:vsBet:pfa',
      'flop:medium:BUTTON:def:ip:bet:vsBet:pfa',
      'flop:wet:BUTTON:def:ip:bet:vsBet:pfa',
    ];
    for (const key of expectedKeys) {
      const entry = getSolverBaseline(key);
      expect(entry, `missing ${key}`).not.toBeNull();
      expect(entry.confidence).toBe(0.75); // donk baselines hedge to 0.75
    }
  });

  it('OOP cbet baseline is higher than IP cbet baseline at same texture (equity-realization sanity check)', () => {
    const ipDry = getSolverBaseline('flop:dry:LATE:def:ip:bet:vsBet:pfc');
    const oopDryBB = getSolverBaseline('flop:dry:BIG_BLIND:def:oop:bet:vsBet:pfc');
    expect(oopDryBB.baseline).toBeGreaterThan(ipDry.baseline);
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
    const dry = getSolverBaseline('flop:dry:LATE:def:ip:bet:vsBet:pfc');
    const wet = getSolverBaseline('flop:wet:LATE:def:ip:bet:vsBet:pfc');
    expect(wet.baseline).toBeGreaterThan(dry.baseline);
  });

  // ─── SPR-109 / WS-146 sixth claim — decision-bucket baselines ──────────
  it('turn-barrel decision baseline present (~50% HU, SPR-109)', () => {
    const entry = getSolverBaseline('turn:barrel-decision:hu');
    expect(entry).not.toBeNull();
    expect(entry.baseline).toBeCloseTo(0.50, 5);
    expect(entry.confidence).toBeGreaterThan(0);
  });

  it('all 4 RFI per-position decision baselines present + monotonic by position (SPR-109)', () => {
    const early = getSolverBaseline('preflop:rfi-decision:EARLY');
    const middle = getSolverBaseline('preflop:rfi-decision:MIDDLE');
    const late = getSolverBaseline('preflop:rfi-decision:LATE');
    const button = getSolverBaseline('preflop:rfi-decision:BUTTON');
    for (const entry of [early, middle, late, button]) {
      expect(entry).not.toBeNull();
      expect(entry.baseline).toBeGreaterThan(0);
      expect(entry.baseline).toBeLessThan(1);
    }
    // RFI range widens toward the button.
    expect(middle.baseline).toBeGreaterThan(early.baseline);
    expect(late.baseline).toBeGreaterThan(middle.baseline);
    expect(button.baseline).toBeGreaterThan(late.baseline);
  });
});

describe('listCoveredSituationKeys', () => {
  it('returns sorted list of all baseline keys', () => {
    const keys = listCoveredSituationKeys();
    // 6 IP cbet + 1 BB defense + 6 OOP cbet + 6 donk + 4 PF 3bet (per-position;
    // isIP normalized) + 2 OOP 3bet underfold = 25 keys post-SPR-046; + 1
    // multiway cbet-frequency decision-bucket baseline = 26 post-SPR-108; + 1
    // turn-barrel decision baseline + 4 RFI per-position decision baselines = 31
    // post-SPR-109.
    expect(keys.length).toBe(31);
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
