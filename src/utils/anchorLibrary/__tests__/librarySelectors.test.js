/**
 * librarySelectors.test.js — filter selector + derivers coverage.
 *
 * EAL Phase 6 — Session 19 (S19).
 */

import { describe, it, expect } from 'vitest';
import {
  selectAnchorsFiltered,
  isFilterEmpty,
  EMPTY_FILTERS,
  deriveStyle,
  deriveStreet,
  deriveTierKey,
} from '../librarySelectors';

const make = (overrides = {}) => ({
  archetypeName: 'Fish Over-Call to Turn Double-Barrel',
  status: 'active',
  tier: 2,
  polarity: 'overcall',
  lineSequence: [{ street: 'flop' }, { street: 'turn' }],
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
describe('isFilterEmpty', () => {
  it('returns true for the EMPTY_FILTERS constant', () => {
    expect(isFilterEmpty(EMPTY_FILTERS)).toBe(true);
  });

  it('returns true for null/undefined', () => {
    expect(isFilterEmpty(null)).toBe(true);
    expect(isFilterEmpty(undefined)).toBe(true);
  });

  it('returns true when every group is an empty array', () => {
    expect(isFilterEmpty({ styles: [], streets: [], polarities: [], tiers: [], statuses: [] })).toBe(true);
  });

  it('returns false when any group has at least one entry', () => {
    expect(isFilterEmpty({ ...EMPTY_FILTERS, statuses: ['active'] })).toBe(false);
    expect(isFilterEmpty({ ...EMPTY_FILTERS, polarities: ['overfold'] })).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('deriveStyle', () => {
  it('reads anchor.style first (forward-compat)', () => {
    expect(deriveStyle({ style: 'Nit', archetypeName: 'TAG xyz' })).toBe('Nit');
  });

  it('falls back to first whitespace-token of archetypeName', () => {
    expect(deriveStyle({ archetypeName: 'Fish Over-Call to Turn' })).toBe('Fish');
    expect(deriveStyle({ archetypeName: 'TAG  Squeeze Light' })).toBe('TAG');
  });

  it('returns null for missing/blank input', () => {
    expect(deriveStyle({})).toBe(null);
    expect(deriveStyle({ archetypeName: '' })).toBe(null);
    expect(deriveStyle({ archetypeName: '   ' })).toBe(null);
    expect(deriveStyle(null)).toBe(null);
    expect(deriveStyle(undefined)).toBe(null);
  });
});

describe('deriveStreet', () => {
  it('returns the LAST entry of lineSequence (the spot street)', () => {
    expect(deriveStreet({ lineSequence: [{ street: 'flop' }, { street: 'turn' }, { street: 'river' }] })).toBe('river');
  });

  it('returns the only entry for a single-step lineSequence', () => {
    expect(deriveStreet({ lineSequence: [{ street: 'flop' }] })).toBe('flop');
  });

  it('returns null for empty / missing / non-array lineSequence', () => {
    expect(deriveStreet({ lineSequence: [] })).toBe(null);
    expect(deriveStreet({ lineSequence: null })).toBe(null);
    expect(deriveStreet({})).toBe(null);
  });
});

describe('deriveTierKey', () => {
  it('returns "tier-N" for numeric tiers', () => {
    expect(deriveTierKey({ tier: 0 })).toBe('tier-0');
    expect(deriveTierKey({ tier: 1 })).toBe('tier-1');
    expect(deriveTierKey({ tier: 2 })).toBe('tier-2');
  });

  it('returns the raw string when tier is a string label', () => {
    expect(deriveTierKey({ tier: 'Tier 1 candidate' })).toBe('Tier 1 candidate');
  });

  it('returns null for missing / non-tier values', () => {
    expect(deriveTierKey({})).toBe(null);
    expect(deriveTierKey({ tier: null })).toBe(null);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('selectAnchorsFiltered — empty filters short-circuit', () => {
  it('returns the input array unchanged when no filters applied', () => {
    const input = [make({ archetypeName: 'A' }), make({ archetypeName: 'B' })];
    const out = selectAnchorsFiltered(input, EMPTY_FILTERS);
    expect(out).toBe(input); // reference equality — short-circuit, no copy
  });

  it('returns [] for non-array input', () => {
    expect(selectAnchorsFiltered(null, EMPTY_FILTERS)).toEqual([]);
    expect(selectAnchorsFiltered(undefined, EMPTY_FILTERS)).toEqual([]);
  });
});

describe('selectAnchorsFiltered — single-group OR', () => {
  it('matches anchors via styles list', () => {
    const anchors = [
      make({ archetypeName: 'Fish Overcall', polarity: 'overcall' }),
      make({ archetypeName: 'Nit Overfold', polarity: 'overfold' }),
      make({ archetypeName: 'TAG Squeeze', polarity: 'over-raise' }),
    ];
    const out = selectAnchorsFiltered(anchors, { ...EMPTY_FILTERS, styles: ['Fish', 'TAG'] });
    expect(out.length).toBe(2);
    expect(out.map((x) => x.archetypeName)).toEqual(['Fish Overcall', 'TAG Squeeze']);
  });

  it('matches anchors via streets list (last lineSequence entry)', () => {
    const anchors = [
      make({ lineSequence: [{ street: 'flop' }] }),
      make({ lineSequence: [{ street: 'turn' }] }),
      make({ lineSequence: [{ street: 'flop' }, { street: 'river' }] }), // ends on river
    ];
    const out = selectAnchorsFiltered(anchors, { ...EMPTY_FILTERS, streets: ['flop'] });
    expect(out.length).toBe(1);
    expect(out[0].lineSequence).toEqual([{ street: 'flop' }]);
  });

  it('matches anchors via polarities list', () => {
    const anchors = [
      make({ polarity: 'overfold' }),
      make({ polarity: 'overcall' }),
      make({ polarity: 'overbluff' }),
    ];
    const out = selectAnchorsFiltered(anchors, { ...EMPTY_FILTERS, polarities: ['overfold', 'overbluff'] });
    expect(out.length).toBe(2);
  });

  it('matches anchors via tiers list (numeric or string)', () => {
    const anchors = [make({ tier: 1 }), make({ tier: 2 }), make({ tier: 0 })];
    const outNumeric = selectAnchorsFiltered(anchors, { ...EMPTY_FILTERS, tiers: ['2'] });
    expect(outNumeric.length).toBe(1);
    expect(outNumeric[0].tier).toBe(2);
  });

  it('matches anchors via statuses list (red line #6 — retired remains visible if requested)', () => {
    const anchors = [
      make({ status: 'active' }),
      make({ status: 'retired' }),
      make({ status: 'expiring' }),
    ];
    const out = selectAnchorsFiltered(anchors, { ...EMPTY_FILTERS, statuses: ['retired', 'expiring'] });
    expect(out.length).toBe(2);
  });
});

describe('selectAnchorsFiltered — across-group AND', () => {
  it('intersects two groups (style AND status)', () => {
    const anchors = [
      make({ archetypeName: 'Fish A', status: 'active' }),
      make({ archetypeName: 'Fish B', status: 'retired' }),
      make({ archetypeName: 'Nit A', status: 'active' }),
    ];
    const out = selectAnchorsFiltered(anchors, {
      ...EMPTY_FILTERS,
      styles: ['Fish'],
      statuses: ['active'],
    });
    expect(out.length).toBe(1);
    expect(out[0].archetypeName).toBe('Fish A');
  });

  it('returns [] when any group has no matches', () => {
    const anchors = [make({ archetypeName: 'Fish A', status: 'active' })];
    const out = selectAnchorsFiltered(anchors, {
      ...EMPTY_FILTERS,
      styles: ['Nit'], // no matches
      statuses: ['active'],
    });
    expect(out).toEqual([]);
  });
});

describe('selectAnchorsFiltered — defensive', () => {
  it('does not crash on anchors with missing fields', () => {
    const anchors = [{}, { archetypeName: 'Has Name' }, null];
    expect(() => selectAnchorsFiltered(anchors, { ...EMPTY_FILTERS, statuses: ['active'] })).not.toThrow();
  });

  it('does not match an anchor with the wrong-typed status', () => {
    const out = selectAnchorsFiltered([{ status: 42 }], { ...EMPTY_FILTERS, statuses: ['42'] });
    expect(out).toEqual([]);
  });
});
