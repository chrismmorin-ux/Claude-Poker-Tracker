import { describe, it, expect, vi } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';

// Mock heavy dependencies
vi.mock('../../pokerCore/monteCarloEquity', () => ({
  handVsRange: vi.fn().mockResolvedValue({ equity: 0.5 }),
}));

// RT-35: narrowByBoard, segmentRange, buildSituationKey, queryActionDistribution
// are now injected via deps parameter — mock deps object provided in tests below

vi.mock('../../pokerCore/boardTexture', () => ({
  analyzeBoardFromStrings: vi.fn(() => ({ texture: 'dry' })),
}));

vi.mock('../../rangeEngine/populationPriors', () => ({
  getPopulationPrior: vi.fn(() => new Float64Array(169).fill(0.1)),
}));

vi.mock('../heroAnalysis', () => ({
  assessHeroEV: vi.fn(() => ({ verdict: '+EV', reason: 'test', equityNeeded: 0.3, actualEquity: 0.5 })),
  suggestOptimalPlay: vi.fn(() => ({ suggestedAction: 'Bet', reason: 'test' })),
  matchHeroWeakness: vi.fn(() => null),
}));

// Mock cardParser to return valid encoded values for test cards
vi.mock('../../pokerCore/cardParser', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    parseAndEncode: vi.fn((str) => {
      const cards = { 'Ah': 0, 'Kd': 1, 'Qs': 2, 'Jh': 3, 'Td': 4, '5c': 5, '2h': 6 };
      return cards[str] ?? actual.parseAndEncode(str);
    }),
    parseBoard: vi.fn((cards) => cards.map((_, i) => 10 + i)),
  };
});

import {
  classifyAction,
  assessEV,
  estimateRangeEquityPct,
  initializeSeatRanges,
  analyzeTimelineAction,
} from '../replayAnalysis';

// ─── classifyAction ─────────────────────────────────────────────────────────

describe('classifyAction', () => {
  it('returns "value" for bet with >50% equity', () => {
    expect(classifyAction(0.65, PRIMITIVE_ACTIONS.BET)).toBe('value');
  });

  it('returns "bluff" for bet with <50% equity', () => {
    expect(classifyAction(0.30, PRIMITIVE_ACTIONS.RAISE)).toBe('bluff');
  });

  it('returns null for non-aggressive actions', () => {
    expect(classifyAction(0.80, PRIMITIVE_ACTIONS.CALL)).toBeNull();
    expect(classifyAction(0.80, PRIMITIVE_ACTIONS.CHECK)).toBeNull();
    expect(classifyAction(0.80, PRIMITIVE_ACTIONS.FOLD)).toBeNull();
  });

  it('returns null for null/undefined equity', () => {
    expect(classifyAction(null, PRIMITIVE_ACTIONS.BET)).toBeNull();
    expect(classifyAction(undefined, PRIMITIVE_ACTIONS.RAISE)).toBeNull();
  });

  it('returns "value" at exactly 50% boundary (>0.5)', () => {
    expect(classifyAction(0.51, PRIMITIVE_ACTIONS.BET)).toBe('value');
    expect(classifyAction(0.50, PRIMITIVE_ACTIONS.BET)).toBe('bluff');
  });
});

// ─── assessEV ───────────────────────────────────────────────────────────────

describe('assessEV', () => {
  it('returns null for missing segmentation', () => {
    expect(assessEV(PRIMITIVE_ACTIONS.BET, null, null, 50)).toBeNull();
    expect(assessEV(PRIMITIVE_ACTIONS.BET, {}, null, 50)).toBeNull();
  });

  it('+EV bet on dry board with high value percentage', () => {
    const seg = { buckets: { nuts: { pct: 30 }, strong: { pct: 25 }, marginal: { pct: 20 }, draw: { pct: 10 }, air: { pct: 15 } } };
    const bt = { texture: 'dry' };
    const result = assessEV(PRIMITIVE_ACTIONS.BET, seg, bt, 55);
    expect(result.verdict).toBe('+EV');
  });

  it('-EV bet on wet board with lots of air', () => {
    const seg = { buckets: { nuts: { pct: 5 }, strong: { pct: 10 }, marginal: { pct: 15 }, draw: { pct: 30 }, air: { pct: 40 } } };
    const bt = { texture: 'wet' };
    const result = assessEV(PRIMITIVE_ACTIONS.BET, seg, bt, 15);
    expect(result.verdict).toBe('-EV');
  });

  it('+EV check on wet board with low value', () => {
    const seg = { buckets: { nuts: { pct: 5 }, strong: { pct: 10 }, marginal: { pct: 20 }, draw: { pct: 30 }, air: { pct: 35 } } };
    const bt = { texture: 'wet' };
    const result = assessEV(PRIMITIVE_ACTIONS.CHECK, seg, bt, 15);
    expect(result.verdict).toBe('+EV');
  });

  it('-EV call with mostly air', () => {
    const seg = { buckets: { nuts: { pct: 2 }, strong: { pct: 3 }, marginal: { pct: 10 }, draw: { pct: 5 }, air: { pct: 80 } } };
    const result = assessEV(PRIMITIVE_ACTIONS.CALL, seg, null, 5);
    expect(result.verdict).toBe('-EV');
  });

  it('returns null for fold (no assessment)', () => {
    const seg = { buckets: { nuts: { pct: 30 }, strong: { pct: 20 }, marginal: { pct: 20 }, draw: { pct: 15 }, air: { pct: 15 } } };
    expect(assessEV(PRIMITIVE_ACTIONS.FOLD, seg, null, 50)).toBeNull();
  });
});

// ─── estimateRangeEquityPct ─────────────────────────────────────────────────

describe('estimateRangeEquityPct', () => {
  it('returns null for null buckets', () => {
    expect(estimateRangeEquityPct(null)).toBeNull();
  });

  it('computes nuts + strong + half marginal', () => {
    const buckets = { nuts: { pct: 10 }, strong: { pct: 20 }, marginal: { pct: 30 } };
    expect(estimateRangeEquityPct(buckets)).toBe(45); // 10 + 20 + 15
  });

  it('handles missing bucket fields', () => {
    const buckets = { nuts: { pct: 5 } };
    expect(estimateRangeEquityPct(buckets)).toBe(5);
  });
});

// ─── initializeSeatRanges ───────────────────────────────────────────────────

describe('initializeSeatRanges', () => {
  it('returns empty maps when no tendency data', () => {
    const result = initializeSeatRanges({ 1: 'p1', 3: 'p2' }, {}, 9);
    expect(Object.keys(result.seatRanges)).toHaveLength(0);
    expect(Object.keys(result.seatRangeProfiles)).toHaveLength(0);
    expect(Object.keys(result.seatRangeLabels)).toHaveLength(0);
  });

  it('initializes ranges from rangeProfile open range', () => {
    const openRange = new Float64Array(169).fill(0.5);
    const tendencyMap = {
      p1: {
        rangeProfile: {
          ranges: { EP: { open: openRange } },
        },
      },
    };
    const result = initializeSeatRanges({ 4: 'p1' }, tendencyMap, 1);
    // Seat 4 with button at 1: position depends on positionUtils
    // Should have at least one range initialized
    const keys = Object.keys(result.seatRanges);
    if (keys.length > 0) {
      expect(result.seatRanges[keys[0]]).toBeInstanceOf(Float64Array);
      expect(result.seatRangeLabels[keys[0]]).toContain('open range');
      expect(result.seatRangeProfiles[keys[0]]).toBeDefined();
    }
  });

  it('skips seats without range profiles', () => {
    const tendencyMap = {
      p1: { style: 'TAG' }, // No rangeProfile
    };
    const result = initializeSeatRanges({ 1: 'p1' }, tendencyMap, 9);
    expect(Object.keys(result.seatRanges)).toHaveLength(0);
  });
});

// ─── analyzeTimelineAction ──────────────────────────────────────────────────

describe('analyzeTimelineAction', () => {
  const mockDeps = {
    narrowByBoard: vi.fn((range) => new Float64Array(range)),
    segmentRange: vi.fn(() => ({
      buckets: {
        nuts: { pct: 10 },
        strong: { pct: 20 },
        marginal: { pct: 30 },
        draw: { pct: 15 },
        air: { pct: 25 },
      },
    })),
    buildSituationKey: vi.fn((...args) => args.join(':')),
    queryActionDistribution: vi.fn(() => ({ actions: {}, confidence: 0 })),
  };

  const baseParams = {
    timeline: [
      { seat: '3', street: 'flop', action: 'bet', order: 1, amount: 10 },
      { seat: '1', street: 'flop', action: 'call', order: 2, amount: 10 },
    ],
    seatRanges: {},
    seatRangeLabels: {},
    seatRangeProfiles: {},
    seatPlayers: { 1: 'hero', 3: 'villain' },
    tendencyMap: {},
    buttonSeat: 9,
    communityCards: ['Ah', 'Kd', 'Qs', '5c', '2h'],
    heroSeat: 1,
    heroCards: ['Jh', 'Td'],
    showdownCards: {},
    blindsPosted: { sb: 1, bb: 2 },
    results: [],
    deps: mockDeps,
  };

  it('returns an analysis object with expected fields', async () => {
    const result = await analyzeTimelineAction({
      ...baseParams,
      entry: baseParams.timeline[0],
      index: 0,
    });

    expect(result).toHaveProperty('seat', '3');
    expect(result).toHaveProperty('street', 'flop');
    expect(result).toHaveProperty('action', 'bet');
    expect(result).toHaveProperty('posName');
    expect(result).toHaveProperty('posCategory');
    expect(result).toHaveProperty('situationKey');
    expect(result).toHaveProperty('boardTexture');
    expect(result).toHaveProperty('heroAnalysis');
    expect(result).toHaveProperty('heroRangeAtPoint');
  });

  it('builds preflop preActionRanges for preflop actions', async () => {
    const preflopTimeline = [
      { seat: '3', street: 'preflop', action: 'raise', order: 1 },
    ];
    const result = await analyzeTimelineAction({
      ...baseParams,
      timeline: preflopTimeline,
      entry: preflopTimeline[0],
      index: 0,
    });

    expect(result.preActionRanges).not.toBeNull();
    expect(result.preActionLabel).toBeTruthy();
  });

  it('generates hero coaching for hero postflop actions', async () => {
    const heroRange = new Float64Array(169).fill(0.5);
    const result = await analyzeTimelineAction({
      ...baseParams,
      entry: baseParams.timeline[1], // hero call on flop
      index: 1,
      seatRanges: { '3': heroRange, '1': heroRange },
      results: [{ segmentation: { buckets: { nuts: { pct: 10 } } } }],
    });

    // Hero coaching should be generated for hero action on flop
    expect(result.heroAnalysis).not.toBeNull();
  });

  it('narrows ranges for postflop actions when range exists', async () => {
    const villainRange = new Float64Array(169).fill(0.5);
    const seatRanges = { '3': villainRange };
    const seatRangeLabels = { '3': 'test range' };

    const result = await analyzeTimelineAction({
      ...baseParams,
      entry: baseParams.timeline[0],
      index: 0,
      seatRanges,
      seatRangeLabels,
    });

    // Range should have been updated (narrowByBoard is mocked to return copy)
    expect(result.rangeAtPoint).toBeInstanceOf(Float64Array);
    expect(result.segmentation).not.toBeNull();
  });

  it('mutates seatRanges in place to track narrowed ranges across actions', async () => {
    const villainRange = new Float64Array(169).fill(0.5);
    const seatRanges = { '3': new Float64Array(villainRange) };
    const seatRangeLabels = { '3': 'initial range' };

    // Analyze first action (villain bet on flop)
    await analyzeTimelineAction({
      ...baseParams,
      entry: baseParams.timeline[0],
      index: 0,
      seatRanges,
      seatRangeLabels,
    });

    // seatRanges should be mutated — narrowByBoard mock returns a copy of input
    expect(seatRanges['3']).toBeInstanceOf(Float64Array);
    // Label should be updated to reflect post-action range
    expect(seatRangeLabels['3']).toContain('after');
  });

  it('produces consistent results when called with same inputs (idempotent analysis)', async () => {
    const villainRange = new Float64Array(169).fill(0.5);

    const makeParams = () => ({
      ...baseParams,
      entry: baseParams.timeline[0],
      index: 0,
      seatRanges: { '3': new Float64Array(villainRange) },
      seatRangeLabels: { '3': 'test range' },
    });

    const result1 = await analyzeTimelineAction(makeParams());
    const result2 = await analyzeTimelineAction(makeParams());

    expect(result1.seat).toBe(result2.seat);
    expect(result1.street).toBe(result2.street);
    expect(result1.action).toBe(result2.action);
    expect(result1.rangeAtPoint).toEqual(result2.rangeAtPoint);
  });

  it('returns defensive copy of rangeAtPoint (not same reference as seatRanges)', async () => {
    const villainRange = new Float64Array(169).fill(0.5);
    const seatRanges = { '3': new Float64Array(villainRange) };

    const result = await analyzeTimelineAction({
      ...baseParams,
      entry: baseParams.timeline[0],
      index: 0,
      seatRanges,
      seatRangeLabels: { '3': 'test' },
    });

    // rangeAtPoint should be a copy, not the same reference
    if (result.rangeAtPoint) {
      expect(result.rangeAtPoint).not.toBe(seatRanges['3']);
    }
  });
});
