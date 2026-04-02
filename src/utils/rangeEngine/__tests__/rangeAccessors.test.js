import { describe, it, expect } from 'vitest';
import { getVillainActionKey, getVillainRange } from '../rangeAccessors';

// ─── getVillainActionKey ───────────────────────────────────────────

describe('getVillainActionKey', () => {
  it('returns "open" for a raise action', () => {
    const seq = [
      { seat: 3, action: 'raise', street: 'preflop', amount: 6 },
    ];
    expect(getVillainActionKey(seq, 3)).toBe('open');
  });

  it('returns "open" for an "open" action', () => {
    const seq = [
      { seat: 5, action: 'open', street: 'preflop', amount: 8 },
    ];
    expect(getVillainActionKey(seq, 5)).toBe('open');
  });

  it('returns "threeBet" for a 3bet action', () => {
    const seq = [
      { seat: 2, action: 'raise', street: 'preflop', amount: 6 },
      { seat: 5, action: '3bet', street: 'preflop', amount: 18 },
    ];
    expect(getVillainActionKey(seq, 5)).toBe('threeBet');
  });

  it('returns "threeBet" for "threeBet" label', () => {
    const seq = [
      { seat: 2, action: 'raise', street: 'preflop', amount: 6 },
      { seat: 5, action: 'threeBet', street: 'preflop', amount: 18 },
    ];
    expect(getVillainActionKey(seq, 5)).toBe('threeBet');
  });

  it('returns "coldCall" for a call action', () => {
    const seq = [
      { seat: 2, action: 'raise', street: 'preflop', amount: 6 },
      { seat: 5, action: 'call', street: 'preflop', amount: 6 },
    ];
    expect(getVillainActionKey(seq, 5)).toBe('coldCall');
  });

  it('returns "coldCall" for "coldCall" label', () => {
    const seq = [
      { seat: 5, action: 'coldCall', street: 'preflop', amount: 6 },
    ];
    expect(getVillainActionKey(seq, 5)).toBe('coldCall');
  });

  it('returns null when villain has no preflop actions', () => {
    const seq = [
      { seat: 2, action: 'raise', street: 'preflop', amount: 6 },
    ];
    expect(getVillainActionKey(seq, 5)).toBe(null);
  });

  it('returns null for empty sequence', () => {
    expect(getVillainActionKey([], 3)).toBe(null);
  });

  it('returns null for null/undefined sequence', () => {
    expect(getVillainActionKey(null, 3)).toBe(null);
    expect(getVillainActionKey(undefined, 3)).toBe(null);
  });

  it('ignores postflop actions', () => {
    const seq = [
      { seat: 3, action: 'bet', street: 'flop', amount: 10 },
    ];
    expect(getVillainActionKey(seq, 3)).toBe(null);
  });
});

// ─── getVillainRange ───────────────────────────────────────────────

describe('getVillainRange', () => {
  const makeProfile = (overrides = {}) => {
    const base = {
      ranges: {
        LATE: {
          open: new Float64Array(169).fill(0.3),
          coldCall: new Float64Array(169).fill(0.1),
          threeBet: new Float64Array(169).fill(0.05),
          fold: new Float64Array(169).fill(0.55),
          limp: new Float64Array(169).fill(0),
        },
      },
    };
    return { ...base, ...overrides };
  };

  it('returns specific action grid when actionKey matches', () => {
    const profile = makeProfile();
    const result = getVillainRange(profile, 'LATE', 'open');
    expect(result).toBeInstanceOf(Float64Array);
    expect(result[0]).toBeCloseTo(0.3);
  });

  it('returns threeBet grid for threeBet key', () => {
    const profile = makeProfile();
    const result = getVillainRange(profile, 'LATE', 'threeBet');
    expect(result[0]).toBeCloseTo(0.05);
  });

  it('returns merged open+coldCall when actionKey is null', () => {
    const profile = makeProfile();
    const result = getVillainRange(profile, 'LATE', null);
    expect(result).toBeInstanceOf(Float64Array);
    expect(result.length).toBe(169);
    // (0.3 + 0.1) / 2 = 0.2
    expect(result[0]).toBeCloseTo(0.2);
  });

  it('returns coldCall alone when open is missing', () => {
    const profile = makeProfile({
      ranges: {
        EARLY: {
          coldCall: new Float64Array(169).fill(0.15),
        },
      },
    });
    const result = getVillainRange(profile, 'EARLY', null);
    expect(result[0]).toBeCloseTo(0.15);
  });

  it('returns open alone when coldCall is missing', () => {
    const profile = makeProfile({
      ranges: {
        EARLY: {
          open: new Float64Array(169).fill(0.25),
        },
      },
    });
    const result = getVillainRange(profile, 'EARLY', null);
    expect(result[0]).toBeCloseTo(0.25);
  });

  it('returns null when position does not exist in profile', () => {
    const profile = makeProfile();
    expect(getVillainRange(profile, 'SB', 'open')).toBe(null);
  });

  it('returns null when rangeProfile is null', () => {
    expect(getVillainRange(null, 'LATE', 'open')).toBe(null);
  });

  it('returns null when rangeProfile is undefined', () => {
    expect(getVillainRange(undefined, 'LATE', 'open')).toBe(null);
  });

  it('returns null when ranges property is missing', () => {
    expect(getVillainRange({}, 'LATE', 'open')).toBe(null);
  });

  it('returns null when position has no open or coldCall', () => {
    const profile = makeProfile({
      ranges: {
        BB: {
          fold: new Float64Array(169).fill(0.5),
          limp: new Float64Array(169).fill(0),
        },
      },
    });
    expect(getVillainRange(profile, 'BB', null)).toBe(null);
  });
});
