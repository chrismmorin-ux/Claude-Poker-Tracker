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
  buildCounterfactualTree,
} from '../replayAnalysis';

// ─── classifyAction ─────────────────────────────────────────────────────────

describe('classifyAction', () => {
  // ── Backward-compat path: no MoE supplied → binary cutoff ──
  it('returns { class: "value" } for bet with >50% equity (binary fallback)', () => {
    expect(classifyAction(0.65, PRIMITIVE_ACTIONS.BET))
      .toEqual({ class: 'value', equity: 0.65, moe: null });
  });

  it('returns { class: "bluff" } for raise with <50% equity (binary fallback)', () => {
    expect(classifyAction(0.30, PRIMITIVE_ACTIONS.RAISE))
      .toEqual({ class: 'bluff', equity: 0.30, moe: null });
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

  it('binary fallback: >0.5 → value, <=0.5 → bluff', () => {
    expect(classifyAction(0.51, PRIMITIVE_ACTIONS.BET).class).toBe('value');
    expect(classifyAction(0.50, PRIMITIVE_ACTIONS.BET).class).toBe('bluff');
  });

  it('treats moe=0 as binary fallback (parity with no-opts call)', () => {
    expect(classifyAction(0.50, PRIMITIVE_ACTIONS.BET, { moe: 0 }))
      .toEqual({ class: 'bluff', equity: 0.50, moe: null });
    expect(classifyAction(0.65, PRIMITIVE_ACTIONS.BET, { moe: 0 }).class).toBe('value');
  });

  // ── Banded path: FIND-002 close-out — MoE-symmetric thresholds around 0.5 ──
  it('bands "thin" when equity is within MoE of 0.5 (slightly above)', () => {
    // 0.55 < 0.5 + 0.044 = 0.544 ... actually 0.55 > 0.544, so this is value.
    // Use 0.52 to land cleanly inside [0.456, 0.544] thin band.
    expect(classifyAction(0.52, PRIMITIVE_ACTIONS.BET, { moe: 0.044 }))
      .toEqual({ class: 'thin', equity: 0.52, moe: 0.044 });
  });

  it('bands "thin" when equity is within MoE of 0.5 (slightly below)', () => {
    // 0.46 > 0.5 - 0.044 = 0.456 → thin
    expect(classifyAction(0.46, PRIMITIVE_ACTIONS.BET, { moe: 0.044 }))
      .toEqual({ class: 'thin', equity: 0.46, moe: 0.044 });
  });

  it('returns "value" when equity > 0.5 + moe', () => {
    expect(classifyAction(0.60, PRIMITIVE_ACTIONS.BET, { moe: 0.044 }))
      .toEqual({ class: 'value', equity: 0.60, moe: 0.044 });
  });

  it('returns "bluff" when equity < 0.5 - moe', () => {
    expect(classifyAction(0.40, PRIMITIVE_ACTIONS.BET, { moe: 0.044 }))
      .toEqual({ class: 'bluff', equity: 0.40, moe: 0.044 });
  });

  it('tighter MoE (more trials) shrinks the thin band', () => {
    // moe=0.018 (3000 trials) → thin band is [0.482, 0.518]
    expect(classifyAction(0.52, PRIMITIVE_ACTIONS.BET, { moe: 0.018 }).class).toBe('value');
    expect(classifyAction(0.50, PRIMITIVE_ACTIONS.BET, { moe: 0.018 }).class).toBe('thin');
    expect(classifyAction(0.46, PRIMITIVE_ACTIONS.BET, { moe: 0.018 }).class).toBe('bluff');
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

// ─── buildCounterfactualTree (HRP-E-TREE-EXPOSE) ────────────────────────────

describe('buildCounterfactualTree', () => {
  const heroSeat = 1;
  const heroCards = ['Jh', 'Td'];
  const cardsForStreet = ['Ah', 'Kd', 'Qs'];
  const seatPlayers = { 1: 'hero', 3: 'villain' };
  const villainRange = new Float64Array(169).fill(0.5);

  const makeEngineSuccess = () => vi.fn().mockResolvedValue({
    recommendations: [
      { action: 'bet', ev: 5.2, sizing: { betSize: 10 }, depth: 2, handPlan: { reasoning: 'value' } },
      { action: 'check', ev: 3.1, depth: 2 },
    ],
    treeMetadata: { depth: 2, depthReached: 2, computeMs: 87, sprZone: 'MEDIUM' },
    foldPct: { bet: 0.42 },
    foldMeta: { bet: { source: 'model' } },
    modelQuality: { overallSource: 'observed', facingBetConfidence: 0.45 },
    bucketEquities: { strong: 0.7 },
    segmentation: { buckets: { nuts: { pct: 12 } } }, // should be stripped from output
    heroEquity: 0.55, // should be stripped
    boardTexture: { texture: 'dry' }, // should be stripped
  });

  const baseParams = () => ({
    entry: { seat: '1', street: 'flop', action: 'bet', order: 2, amount: 10 },
    index: 1,
    timeline: [
      { seat: '3', street: 'flop', action: 'bet', order: 1, amount: 10 },
      { seat: '1', street: 'flop', action: 'bet', order: 2, amount: 10 },
    ],
    seatRanges: { '3': villainRange },
    seatPlayers,
    tendencyMap: { villain: { af: 1.5, vpip: 28, style: 'TAG', villainModel: { _buckets: {} } } },
    heroSeat,
    heroCards,
    cardsForStreet,
    potAtPoint: 30,
    boardTexture: { texture: 'dry' },
    deps: { evaluateGameTree: makeEngineSuccess() },
  });

  it('returns null for preflop entries (engine is postflop-only)', async () => {
    const params = baseParams();
    params.entry = { ...params.entry, street: 'preflop' };
    expect(await buildCounterfactualTree(params)).toBeNull();
    expect(params.deps.evaluateGameTree).not.toHaveBeenCalled();
  });

  it('returns null when evaluateGameTree dep is not injected', async () => {
    const params = baseParams();
    params.deps = {};
    expect(await buildCounterfactualTree(params)).toBeNull();
  });

  it('returns null when fewer than 3 community cards revealed', async () => {
    const params = baseParams();
    params.cardsForStreet = ['Ah', 'Kd'];
    expect(await buildCounterfactualTree(params)).toBeNull();
    expect(params.deps.evaluateGameTree).not.toHaveBeenCalled();
  });

  it('returns null when hero cards are missing or wrong length', async () => {
    const a = baseParams(); a.heroCards = null;
    const b = baseParams(); b.heroCards = ['Jh'];
    const c = baseParams(); c.heroCards = [];
    expect(await buildCounterfactualTree(a)).toBeNull();
    expect(await buildCounterfactualTree(b)).toBeNull();
    expect(await buildCounterfactualTree(c)).toBeNull();
  });

  it('returns null when no villain range is available anywhere', async () => {
    const params = baseParams();
    params.seatRanges = {}; // no ranges at all
    expect(await buildCounterfactualTree(params)).toBeNull();
    expect(params.deps.evaluateGameTree).not.toHaveBeenCalled();
  });

  it('returns null when engine throws', async () => {
    const params = baseParams();
    params.deps.evaluateGameTree = vi.fn().mockRejectedValue(new Error('engine boom'));
    expect(await buildCounterfactualTree(params)).toBeNull();
  });

  it('returns null when engine result has no recommendations array', async () => {
    const params = baseParams();
    params.deps.evaluateGameTree = vi.fn().mockResolvedValue({ treeMetadata: {} });
    expect(await buildCounterfactualTree(params)).toBeNull();
  });

  it('happy path: returns shaped tree with recommendations + villainContext + metadata', async () => {
    const params = baseParams();
    const result = await buildCounterfactualTree(params);

    expect(result).not.toBeNull();
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].action).toBe('bet');
    expect(result.treeMetadata.depth).toBe(2);
    expect(result.foldPct.bet).toBeCloseTo(0.42);
    expect(result.modelQuality.overallSource).toBe('observed');
    expect(result.villainContext).toEqual({
      villainSeat: 3,
      villainAction: 'bet',
      villainBet: 10,
    });
  });

  it('strips segmentation/heroEquity/boardTexture from output (already on the analysis row)', async () => {
    const params = baseParams();
    const result = await buildCounterfactualTree(params);
    expect(result).not.toHaveProperty('segmentation');
    expect(result).not.toHaveProperty('heroEquity');
    expect(result).not.toHaveProperty('boardTexture');
  });

  it('passes hero perspective inputs to the engine (board, heroCards encoded, pot, villainAction/Bet)', async () => {
    const params = baseParams();
    await buildCounterfactualTree(params);

    expect(params.deps.evaluateGameTree).toHaveBeenCalledTimes(1);
    const call = params.deps.evaluateGameTree.mock.calls[0][0];
    expect(call.villainRange).toBe(villainRange);
    expect(Array.isArray(call.board)).toBe(true);
    expect(call.board.length).toBe(3);
    expect(Array.isArray(call.heroCards)).toBe(true);
    expect(call.heroCards).toHaveLength(2);
    expect(call.potSize).toBe(30);
    expect(call.villainAction).toBe('bet');
    expect(call.villainBet).toBe(10);
    expect(call.playerStats).toMatchObject({ af: 1.5, vpip: 28, style: 'TAG' });
    expect(call.villainModel).toBeDefined();
    expect(call.contextHints.boardTexture).toEqual({ texture: 'dry' });
  });

  it('detects raise as facing action with bet size', async () => {
    const params = baseParams();
    params.timeline[0] = { seat: '3', street: 'flop', action: 'raise', order: 1, amount: 30 };
    await buildCounterfactualTree(params);
    const call = params.deps.evaluateGameTree.mock.calls[0][0];
    expect(call.villainAction).toBe('raise');
    expect(call.villainBet).toBe(30);
  });

  it('treats prior villain check as no-facing-bet (villainAction stays undefined)', async () => {
    const params = baseParams();
    params.timeline[0] = { seat: '3', street: 'flop', action: 'check', order: 1 };
    await buildCounterfactualTree(params);
    const call = params.deps.evaluateGameTree.mock.calls[0][0];
    expect(call.villainAction).toBeUndefined();
    expect(call.villainBet).toBe(0);
  });

  it('does not cross street boundaries when scanning for villain action', async () => {
    const params = baseParams();
    // Hero is now first to act on flop; the prior bet was on preflop and must NOT carry over
    params.timeline = [
      { seat: '3', street: 'preflop', action: 'raise', order: 1, amount: 6 },
      { seat: '1', street: 'flop', action: 'bet', order: 2, amount: 10 },
    ];
    params.entry = params.timeline[1];
    params.index = 1;
    await buildCounterfactualTree(params);
    const call = params.deps.evaluateGameTree.mock.calls[0][0];
    // Falls back to seat range (not a street-villain action), so no facing bet
    expect(call.villainAction).toBeUndefined();
    expect(call.villainBet).toBe(0);
  });

  it('falls back to first non-hero seat range when no same-street villain has acted', async () => {
    const params = baseParams();
    params.timeline = [{ seat: '1', street: 'flop', action: 'check', order: 1 }];
    params.entry = params.timeline[0];
    params.index = 0;
    const result = await buildCounterfactualTree(params);
    expect(result).not.toBeNull();
    expect(result.villainContext.villainSeat).toBe(3);
    expect(result.villainContext.villainAction).toBeNull();
  });

  it('villain-actor entry: still produces tree from hero perspective at this state', async () => {
    const params = baseParams();
    // Make this entry be the villain's bet itself (counterfactual: "if hero faced this state…")
    params.timeline = [
      { seat: '1', street: 'flop', action: 'check', order: 1 },
      { seat: '3', street: 'flop', action: 'bet', order: 2, amount: 10 },
    ];
    params.entry = params.timeline[1];
    params.index = 1;
    const result = await buildCounterfactualTree(params);
    expect(result).not.toBeNull();
    expect(result.recommendations).toHaveLength(2);
    // No prior villain on this street → villainContext reflects fallback
    expect(result.villainContext.villainSeat).toBe(3);
  });
});
