import { describe, it, expect, vi } from 'vitest';
import {
  computeBaselineForAssumption,
  __TEST_ONLY__,
} from '../computeBaselineForAssumption';

const { adaptResultToBaselineEvaluation, distributionFromVillainResponse } = __TEST_ONLY__;

// Mock evaluateGameTree so these tests don't depend on the actual engine.
vi.mock('../../exploitEngine/gameTreeEvaluator', () => ({
  evaluateGameTree: vi.fn(),
}));

import { evaluateGameTree } from '../../exploitEngine/gameTreeEvaluator';

const makeAssumption = (overrides = {}) => ({
  id: 'v42:foldToRiverBet@river',
  villainId: 'v42',
  claim: {
    predicate: 'foldToRiverBet',
    operator: '<=',
    threshold: 0.25,
    scope: {
      street: 'river',
      texture: 'wet',
      position: 'IP',
      sprRange: [2, 4],
      betSizeRange: [0.66, 1.0],
      playersToAct: 0,
    },
  },
  consequence: { deviationType: 'bluff-prune' },
  ...overrides,
});

const successResult = () => ({
  recommendations: [
    {
      action: 'bet',
      ev: 1.5,
      sizing: { betFraction: 0.75 },
      villainResponse: {
        fold: { pct: 0.25, ev: 10 },
        call: { pct: 0.65, ev: 2.0 },
        raise: { pct: 0.10, ev: -3.0 },
      },
    },
    {
      action: 'check',
      ev: 0.5,
      sizing: null,
      villainResponse: {
        bet: { pct: 0.5, ev: -1.0 },
        check: { pct: 0.5, ev: 1.0 },
      },
    },
  ],
  treeMetadata: { computeMs: 42, street: 'river', depth: 3 },
});

describe('computeBaselineForAssumption — success path', () => {
  it('returns baseline + node on successful gameTree evaluation', async () => {
    evaluateGameTree.mockResolvedValueOnce(successResult());
    const result = await computeBaselineForAssumption({
      assumption: makeAssumption(),
      villainTendency: { style: 'Fish' },
    });
    expect(result.baseline).toBeTruthy();
    expect(result.baseline.actionEVs).toEqual({
      bet: { ev: 1.5, sizing: 0.75 },
      check: { ev: 0.5, sizing: null },
    });
    expect(result.baseline.recommendedAction).toEqual({
      action: 'bet',
      ev: 1.5,
      sizing: 0.75,
    });
    expect(result.source).toBe('synthesized');
    expect(result.reason).toBeUndefined();
  });

  it('passes synthesized node through to evaluateGameTree', async () => {
    evaluateGameTree.mockResolvedValueOnce(successResult());
    await computeBaselineForAssumption({
      assumption: makeAssumption(),
      villainTendency: { style: 'Fish' },
    });
    const call = evaluateGameTree.mock.calls.at(-1)[0];
    expect(call.villainRange).toBeInstanceOf(Float64Array);
    expect(call.board).toHaveLength(5);
    expect(call.heroCards).toHaveLength(2);
    expect(Number.isFinite(call.potSize)).toBe(true);
  });

  it('picks argmax-EV as recommendedAction', async () => {
    evaluateGameTree.mockResolvedValueOnce({
      recommendations: [
        { action: 'bet', ev: 0.5, sizing: { betFraction: 0.66 }, villainResponse: {} },
        { action: 'check', ev: 2.0, sizing: null, villainResponse: {} },
        { action: 'fold', ev: -1.0, sizing: null, villainResponse: {} },
      ],
    });
    const result = await computeBaselineForAssumption({
      assumption: makeAssumption(),
      villainTendency: { style: 'Fish' },
    });
    expect(result.baseline.recommendedAction.action).toBe('check');
    expect(result.baseline.recommendedAction.ev).toBe(2.0);
  });
});

describe('computeBaselineForAssumption — failure paths', () => {
  it('returns gameTree-error when evaluateGameTree throws', async () => {
    evaluateGameTree.mockRejectedValueOnce(new Error('MC equity failed'));
    const result = await computeBaselineForAssumption({
      assumption: makeAssumption(),
      villainTendency: { style: 'Fish' },
    });
    expect(result.baseline).toBeNull();
    expect(result.reason).toBe('gameTree-error');
    expect(result.error).toContain('MC equity failed');
    expect(result.node).toBeTruthy();
  });

  it('returns gameTree-empty when recommendations array is empty', async () => {
    evaluateGameTree.mockResolvedValueOnce({ recommendations: [] });
    const result = await computeBaselineForAssumption({
      assumption: makeAssumption(),
      villainTendency: { style: 'Fish' },
    });
    expect(result.baseline).toBeNull();
    expect(result.reason).toBe('gameTree-empty');
  });

  it('returns gameTree-empty when result is missing recommendations', async () => {
    evaluateGameTree.mockResolvedValueOnce({});
    const result = await computeBaselineForAssumption({
      assumption: makeAssumption(),
      villainTendency: { style: 'Fish' },
    });
    expect(result.baseline).toBeNull();
    expect(result.reason).toBe('gameTree-empty');
  });

  it('returns missing-assumption when assumption is absent', async () => {
    const result = await computeBaselineForAssumption({});
    expect(result.baseline).toBeNull();
    expect(result.reason).toBe('missing-assumption');
  });
});

describe('computeBaselineForAssumption — pre-synthesized node override', () => {
  it('accepts an explicit node and does not re-synthesize', async () => {
    evaluateGameTree.mockResolvedValueOnce(successResult());
    const explicitNode = {
      heroCards: [0, 1],
      board: [2, 3, 4, 5, 6],
      villainRange: new Float64Array(169),
      potSize: 10,
      villainBet: 0,
      villainAction: 'check',
      isIP: true,
      effectiveStack: 100,
      street: 'river',
      numOpponents: 1,
      synthesized: false,
    };
    const result = await computeBaselineForAssumption({
      assumption: makeAssumption(),
      villainTendency: { style: 'Fish' },
      node: explicitNode,
    });
    expect(result.source).toBe('real');
    expect(result.node).toBe(explicitNode);
  });
});

describe('distributionFromVillainResponse', () => {
  it('normalizes fold/call/raise to sum ~1.0', () => {
    const d = distributionFromVillainResponse({
      fold: { pct: 0.4 },
      call: { pct: 0.5 },
      raise: { pct: 0.1 },
    });
    expect(d.fold + d.call + d.raise).toBeCloseTo(1.0, 5);
  });

  it('returns neutral fallback on null/empty input', () => {
    expect(distributionFromVillainResponse(null).fold).toBeGreaterThan(0);
    expect(distributionFromVillainResponse({}).fold).toBeGreaterThan(0);
  });

  it('returns neutral fallback when only check/bet branches present', () => {
    const d = distributionFromVillainResponse({
      check: { pct: 0.5 },
      bet: { pct: 0.5 },
    });
    expect(d.fold + d.call + d.raise).toBeCloseTo(1.0, 5);
  });

  it('renormalizes when pcts do not sum to 1', () => {
    const d = distributionFromVillainResponse({
      fold: { pct: 0.2 },
      call: { pct: 0.6 },
      raise: { pct: 0.2 },
    });
    expect(d.fold + d.call + d.raise).toBeCloseTo(1.0, 5);
    expect(d.fold).toBeCloseTo(0.2, 5);
  });
});

describe('adaptResultToBaselineEvaluation', () => {
  it('returns null on empty recommendations', () => {
    expect(adaptResultToBaselineEvaluation({ recommendations: [] })).toBeNull();
    expect(adaptResultToBaselineEvaluation({})).toBeNull();
  });

  it('builds actionEVs keyed by action', () => {
    const r = adaptResultToBaselineEvaluation(successResult());
    expect(r.actionEVs).toHaveProperty('bet');
    expect(r.actionEVs).toHaveProperty('check');
  });

  it('coerces non-finite EV to 0', () => {
    const r = adaptResultToBaselineEvaluation({
      recommendations: [
        { action: 'bet', ev: NaN, sizing: null, villainResponse: {} },
        { action: 'check', ev: 0.5, sizing: null, villainResponse: {} },
      ],
    });
    expect(r.actionEVs.bet.ev).toBe(0);
    expect(r.recommendedAction.action).toBe('check');
  });
});
