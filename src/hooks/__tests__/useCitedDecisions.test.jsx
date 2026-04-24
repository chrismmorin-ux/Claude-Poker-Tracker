// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { useCitedDecisions } from '../useCitedDecisions';

// Mock the wrapper so we don't depend on the real gameTreeEvaluator.
vi.mock('../../utils/citedDecision', async () => {
  const actual = await vi.importActual('../../utils/citedDecision');
  return {
    ...actual,
    computeBaselineForAssumption: vi.fn(),
  };
});

import {
  computeBaselineForAssumption,
} from '../../utils/citedDecision';

const makeAssumption = (overrides = {}) => ({
  id: overrides.id ?? 'v42:foldToRiverBet@river',
  villainId: overrides.villainId ?? 'v42',
  schemaVersion: '1.1',
  status: 'active',
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
      activationFrequency: 0.04,
    },
  },
  evidence: { posteriorConfidence: 0.85, sampleSize: 52 },
  stability: {},
  recognizability: { triggerDescription: 'Hero barreled to river', score: 0.95 },
  consequence: {
    deviationType: 'bluff-prune',
    expectedDividend: { mean: 0.85, sd: 0.15, sharpe: 5.7 },
  },
  counterExploit: { resistanceScore: 0.5 },
  operator: {
    target: 'villain',
    transform: { actionDistributionDelta: { fold: 0, call: 0, raise: 0 } },
    currentDial: overrides.dial ?? 0.6,
  },
  narrative: {
    humanStatement: 'Villain folds to river bets only 17%',
    citationShort: 'fold-to-river 17%',
    citationLong: 'over 52 river decisions...',
  },
  quality: {
    composite: 0.85,
    actionableInDrill: true,
    actionableLive: false,
  },
  validation: {},
  _villainSnapshot: { villainId: 'v42', style: 'Fish' },
  ...overrides,
});

const successBaseline = (node) => ({
  baseline: {
    actionEVs: {
      bet: { ev: 1.5, sizing: 0.75 },
      check: { ev: 0.5, sizing: null },
    },
    villainDistribution: { fold: 0.25, call: 0.65, raise: 0.10 },
    recommendedAction: { action: 'bet', ev: 1.5, sizing: 0.75 },
  },
  node,
  source: 'synthesized',
});

const Harness = ({ assumptions, tendencies, onResult }) => {
  const result = useCitedDecisions(assumptions, tendencies);
  React.useEffect(() => { onResult?.(result); }, [result, onResult]);
  return null;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCitedDecisions — initial state', () => {
  it('returns loading sentinel for each assumption while baselines compute', async () => {
    let pendingResolve;
    computeBaselineForAssumption.mockReturnValueOnce(
      new Promise((res) => { pendingResolve = res; }),
    );

    const a = makeAssumption();
    const results = [];
    render(
      <Harness
        assumptions={[a]}
        tendencies={{ v42: { style: 'Fish' } }}
        onResult={(r) => results.push(r)}
      />,
    );

    // Initial render — baselineById has not yet been populated.
    expect(results[0].citedDecisionsById[a.id]).toEqual({ loading: true });
    expect(results[0].isAnyLoading).toBe(true);

    // Resolve.
    await act(async () => {
      pendingResolve(successBaseline({ display: { street: 'river', texture: 'wet', position: 'IP' } }));
    });

    await waitFor(() => {
      const last = results.at(-1);
      expect(last.citedDecisionsById[a.id]).toBeTruthy();
      expect(last.citedDecisionsById[a.id].loading).toBeUndefined();
    });
  });
});

describe('useCitedDecisions — success path', () => {
  it('produces a CitedDecision with baselineAction + recommendedAction once baseline resolves', async () => {
    const node = { display: { street: 'river', texture: 'wet', position: 'IP' } };
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline(node));

    const a = makeAssumption();
    const results = [];
    render(
      <Harness
        assumptions={[a]}
        tendencies={{ v42: { style: 'Fish' } }}
        onResult={(r) => results.push(r)}
      />,
    );

    await waitFor(() => {
      const cd = results.at(-1).citedDecisionsById[a.id];
      expect(cd).toBeTruthy();
      expect(cd.loading).toBeUndefined();
      expect(cd.baselineAction).toBeTruthy();
      expect(cd.recommendedAction).toBeTruthy();
      expect(cd.source).toBe('synthesized');
      expect(cd.node).toBe(node);
    });
  });
});

describe('useCitedDecisions — error path', () => {
  it('surfaces gameTree-error in the citedDecisionsById entry', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce({
      baseline: null,
      node: { display: { street: 'flop' } },
      source: 'synthesized',
      reason: 'gameTree-error',
      error: 'MC failed',
    });

    const a = makeAssumption();
    const results = [];
    render(
      <Harness
        assumptions={[a]}
        tendencies={{ v42: { style: 'Fish' } }}
        onResult={(r) => results.push(r)}
      />,
    );

    await waitFor(() => {
      const cd = results.at(-1).citedDecisionsById[a.id];
      expect(cd.error).toBe('gameTree-error');
    });
  });
});

describe('useCitedDecisions — honesty check (I-AE-3)', () => {
  it('dial=0 yields recommendedAction === baselineAction and dividend === 0', async () => {
    const node = { display: { street: 'river' } };
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline(node));

    const a = makeAssumption({ dial: 0 });
    const results = [];
    render(
      <Harness
        assumptions={[a]}
        tendencies={{ v42: { style: 'Fish' } }}
        onResult={(r) => results.push(r)}
      />,
    );

    await waitFor(() => {
      const cd = results.at(-1).citedDecisionsById[a.id];
      expect(cd).toBeTruthy();
      expect(cd.loading).toBeUndefined();
      // I-AE-3: dial=0 short-circuits to baseline-only.
      expect(cd.dividend).toBe(0);
      expect(cd.recommendedAction).toEqual(cd.baselineAction);
    });
  });
});

describe('useCitedDecisions — caching', () => {
  it('does not recompute baseline for unchanged assumption ids', async () => {
    computeBaselineForAssumption.mockResolvedValue(successBaseline({}));

    const a = makeAssumption();
    const { rerender } = render(
      <Harness assumptions={[a]} tendencies={{ v42: { style: 'Fish' } }} />,
    );

    await waitFor(() => {
      expect(computeBaselineForAssumption).toHaveBeenCalledTimes(1);
    });

    // Re-render with same assumption — no new compute should fire.
    rerender(<Harness assumptions={[a]} tendencies={{ v42: { style: 'Fish' } }} />);
    await new Promise((res) => setTimeout(res, 30));
    expect(computeBaselineForAssumption).toHaveBeenCalledTimes(1);
  });

  it('computes once per new assumption id', async () => {
    computeBaselineForAssumption.mockResolvedValue(successBaseline({}));

    const a1 = makeAssumption({ id: 'v1:foldToCbet@flop' });
    const a2 = makeAssumption({ id: 'v2:foldToRiverBet@river', villainId: 'v2' });

    render(
      <Harness assumptions={[a1, a2]} tendencies={{ v1: { style: 'Nit' }, v2: { style: 'Fish' } }} />,
    );

    await waitFor(() => {
      expect(computeBaselineForAssumption).toHaveBeenCalledTimes(2);
    });
  });
});
