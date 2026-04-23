/**
 * Tests for villainRanges.js — alias layer over archetypeRanges.js.
 *
 * LSW-G4-IMPL Commit 2.5. Verifies:
 *  - VILLAIN_RANGE_ALIASES is frozen + has the v1-ship seed aliases.
 *  - isKnownBaseRangeId predicate works correctly.
 *  - villainRangeFor delegates to archetypeRangeFor.
 *  - Unknown + malformed inputs throw with distinct, diagnostic messages.
 *  - listBaseRangeAliases returns a stable shape.
 */

import { describe, it, expect } from 'vitest';
import {
  VILLAIN_RANGE_ALIASES,
  isKnownBaseRangeId,
  villainRangeFor,
  listBaseRangeAliases,
} from '../villainRanges';
import { archetypeRangeFor } from '../archetypeRanges';

describe('VILLAIN_RANGE_ALIASES', () => {
  it('is frozen (both the outer map and each tuple)', () => {
    expect(Object.isFrozen(VILLAIN_RANGE_ALIASES)).toBe(true);
    for (const tuple of Object.values(VILLAIN_RANGE_ALIASES)) {
      expect(Object.isFrozen(tuple)).toBe(true);
    }
  });

  it('seeds the 3 v1-ship HU aliases: JT6 + Q72r + K77', () => {
    expect(VILLAIN_RANGE_ALIASES.btn_vs_bb_3bp_bb_range).toMatchObject({
      position: 'BB', action: 'threeBet', vs: 'BTN',
    });
    expect(VILLAIN_RANGE_ALIASES.btn_vs_bb_srp_bb_flat).toMatchObject({
      position: 'BB', action: 'call', vs: 'BTN',
    });
    expect(VILLAIN_RANGE_ALIASES.co_vs_bb_srp_bb_flat).toMatchObject({
      position: 'BB', action: 'call', vs: 'CO',
    });
  });

  it('every alias tuple has position + action fields (vs optional)', () => {
    for (const [key, tuple] of Object.entries(VILLAIN_RANGE_ALIASES)) {
      expect(typeof tuple.position).toBe('string');
      expect(typeof tuple.action).toBe('string');
      expect(tuple.position.length).toBeGreaterThan(0);
      expect(tuple.action.length).toBeGreaterThan(0);
      // vs may be undefined for self-contained actions (e.g., open), but
      // every current alias IS opposed — guard against that changing silently.
      if (tuple.action !== 'open' && tuple.action !== 'limp') {
        expect(typeof tuple.vs).toBe('string');
        expect(tuple.vs.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('isKnownBaseRangeId', () => {
  it('returns true for seeded aliases', () => {
    expect(isKnownBaseRangeId('btn_vs_bb_3bp_bb_range')).toBe(true);
    expect(isKnownBaseRangeId('btn_vs_bb_srp_bb_flat')).toBe(true);
    expect(isKnownBaseRangeId('co_vs_bb_srp_bb_flat')).toBe(true);
  });

  it('returns false for unknown aliases + non-string inputs', () => {
    expect(isKnownBaseRangeId('nonexistent_alias')).toBe(false);
    expect(isKnownBaseRangeId('')).toBe(false);
    expect(isKnownBaseRangeId(null)).toBe(false);
    expect(isKnownBaseRangeId(undefined)).toBe(false);
    expect(isKnownBaseRangeId(42)).toBe(false);
    expect(isKnownBaseRangeId({})).toBe(false);
  });
});

describe('villainRangeFor', () => {
  it('delegates to archetypeRangeFor and returns the same range for known aliases', () => {
    // JT6 alias → archetypeRangeFor({BB, threeBet, BTN})
    const expected = archetypeRangeFor({ position: 'BB', action: 'threeBet', vs: 'BTN' });
    const actual = villainRangeFor('btn_vs_bb_3bp_bb_range');
    expect(actual.length).toBe(expected.length);
    // Float64Array equality via sum + sample element check
    let deltaSum = 0;
    for (let i = 0; i < actual.length; i++) deltaSum += Math.abs(actual[i] - expected[i]);
    expect(deltaSum).toBeCloseTo(0, 10);
  });

  it('resolves the Q72r alias (BB flat vs BTN open)', () => {
    const range = villainRangeFor('btn_vs_bb_srp_bb_flat');
    expect(range).toBeInstanceOf(Float64Array);
    expect(range.length).toBe(169);
    // BB-vs-BTN-flat range should be non-trivial — check it has some weight.
    let total = 0;
    for (let i = 0; i < range.length; i++) total += range[i];
    expect(total).toBeGreaterThan(0);
  });

  it('resolves the K77 alias (BB flat vs CO open)', () => {
    const range = villainRangeFor('co_vs_bb_srp_bb_flat');
    expect(range).toBeInstanceOf(Float64Array);
    let total = 0;
    for (let i = 0; i < range.length; i++) total += range[i];
    expect(total).toBeGreaterThan(0);
  });

  it('throws on empty-string baseRangeId', () => {
    expect(() => villainRangeFor('')).toThrow(/non-empty string/);
  });

  it('throws on non-string baseRangeId with a clear message', () => {
    expect(() => villainRangeFor(null)).toThrow(/non-empty string/);
    expect(() => villainRangeFor(42)).toThrow(/non-empty string/);
    expect(() => villainRangeFor({ baseRangeId: 'foo' })).toThrow(/non-empty string/);
  });

  it('throws on unknown alias with a message that names the missing key', () => {
    expect(() => villainRangeFor('totally_made_up')).toThrow(/unknown baseRangeId 'totally_made_up'/);
  });
});

describe('listBaseRangeAliases', () => {
  it('returns one entry per registered alias', () => {
    const entries = listBaseRangeAliases();
    expect(entries.length).toBe(Object.keys(VILLAIN_RANGE_ALIASES).length);
    for (const e of entries) {
      expect(typeof e.baseRangeId).toBe('string');
      expect(typeof e.tuple.position).toBe('string');
      expect(typeof e.tuple.action).toBe('string');
    }
  });

  it('tuple is a shallow copy (mutation does not affect VILLAIN_RANGE_ALIASES)', () => {
    const entries = listBaseRangeAliases();
    // tuple in listBaseRangeAliases output is a fresh object — safe to mutate
    entries[0].tuple.position = 'HACKED';
    expect(VILLAIN_RANGE_ALIASES.btn_vs_bb_3bp_bb_range.position).toBe('BB');
  });
});
