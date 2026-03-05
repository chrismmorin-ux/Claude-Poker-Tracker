import { describe, it, expect } from 'vitest';
import { classifyHand, computePips, computeAllPips, formatPips } from '../pipCalculator';
import { createEmptyProfile, RANGE_POSITIONS } from '../rangeProfile';
import { rangeIndex, createRange, PREFLOP_CHARTS } from '../../exploitEngine/rangeMatrix';

describe('classifyHand', () => {
  it('classifies pocket pairs', () => {
    const aa = classifyHand(rangeIndex(12, 12, false));
    expect(aa).toEqual({ category: 'pocketPairs', tier: 12 });

    const twos = classifyHand(rangeIndex(0, 0, false));
    expect(twos).toEqual({ category: 'pocketPairs', tier: 0 });
  });

  it('classifies suited aces', () => {
    const aks = classifyHand(rangeIndex(12, 11, true));
    expect(aks).toEqual({ category: 'suitedAces', tier: 11 });

    const a2s = classifyHand(rangeIndex(12, 0, true));
    expect(a2s).toEqual({ category: 'suitedAces', tier: 0 });
  });

  it('classifies suited broadways (non-ace)', () => {
    const kqs = classifyHand(rangeIndex(11, 10, true));
    expect(kqs.category).toBe('suitedBroadways');
  });

  it('classifies suited connectors', () => {
    const t9s = classifyHand(rangeIndex(8, 7, true));
    expect(t9s.category).toBe('suitedConnectors');

    const _54s = classifyHand(rangeIndex(3, 2, true));
    expect(_54s).toEqual({ category: 'suitedConnectors', tier: 2 });
  });

  it('classifies suited gappers', () => {
    const t8s = classifyHand(rangeIndex(8, 6, true));
    expect(t8s.category).toBe('suitedGappers');
  });

  it('classifies offsuit broadways', () => {
    const aqo = classifyHand(rangeIndex(12, 10, false));
    expect(aqo.category).toBe('offsuitBroadways');
  });

  it('returns null for uncategorized hands', () => {
    // 72o = rank1=5(7), rank2=0(2), offsuit, not broadway
    const result = classifyHand(rangeIndex(5, 0, false));
    expect(result).toBeNull();
  });
});

describe('computePips', () => {
  it('returns zero deltas when ranges are identical', () => {
    const range = PREFLOP_CHARTS.UTG;
    const pips = computePips(range, range);
    for (const delta of Object.values(pips)) {
      expect(delta).toBe(0);
    }
  });

  it('returns positive delta when player opens wider', () => {
    // Player plays all 13 pair tiers, GTO UTG plays ~8
    const playerRange = createRange();
    for (let r = 0; r <= 12; r++) {
      playerRange[rangeIndex(r, r, false)] = 1.0;
    }
    // Also add everything from GTO
    const gtoRange = PREFLOP_CHARTS.UTG;
    for (let i = 0; i < 169; i++) {
      if (gtoRange[i] > 0) playerRange[i] = gtoRange[i];
    }

    const pips = computePips(playerRange, gtoRange);
    expect(pips.pocketPairs).toBeGreaterThan(0);
  });

  it('returns negative delta when player is tighter', () => {
    // Player only plays AA, KK
    const playerRange = createRange();
    playerRange[rangeIndex(12, 12, false)] = 1.0;
    playerRange[rangeIndex(11, 11, false)] = 1.0;

    const gtoRange = PREFLOP_CHARTS.BTN;
    const pips = computePips(playerRange, gtoRange);
    expect(pips.pocketPairs).toBeLessThan(0);
  });
});

describe('computeAllPips', () => {
  it('returns null for empty profile', () => {
    expect(computeAllPips(null)).toBeNull();
    expect(computeAllPips({})).toBeNull();
  });

  it('computes pips for all positions', () => {
    const profile = createEmptyProfile('test', 'user');
    // Set some open ranges wider than GTO
    for (const pos of RANGE_POSITIONS) {
      for (let i = 0; i < 169; i++) {
        profile.ranges[pos].open[i] = 0.5; // everything at 0.5 = very wide
      }
    }
    const pips = computeAllPips(profile);
    expect(pips).not.toBeNull();
    expect(Object.keys(pips)).toEqual(expect.arrayContaining(['EARLY', 'LATE']));
    // Should show positive deviations since player is wider than GTO
    expect(pips.EARLY.pocketPairs).toBeGreaterThanOrEqual(0);
  });
});

describe('formatPips', () => {
  it('returns empty array for null', () => {
    expect(formatPips(null)).toEqual([]);
  });

  it('formats deviations as human-readable strings', () => {
    const pips = {
      LATE: { pocketPairs: 5, suitedAces: 0, suitedBroadways: -2, suitedConnectors: 1, suitedGappers: 0, offsuitBroadways: 0 },
    };
    const result = formatPips(pips);
    expect(result).toHaveLength(1);
    expect(result[0].position).toBe('LATE');
    expect(result[0].deviations).toContain('+5 Pairs');
    expect(result[0].deviations).toContain('-2 Suited Broadways');
    expect(result[0].deviations).toContain('+1 Suited Connectors');
    // Zero deviations should not appear
    expect(result[0].deviations).not.toContain(expect.stringContaining('Suited Aces'));
  });
});
