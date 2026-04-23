import { describe, it, expect } from 'vitest';
import { produceCitedDecision } from '../citedDecisionProducer';
import { produceAssumptions } from '../../assumptionEngine';

// ───────────────────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────────────────

const makeBaseline = ({ bestAction = 'bet', evs = { bet: 0.09, check: 0.01, fold: 0, call: 0.05 }, villainDist = { fold: 0.25, call: 0.65, raise: 0.10 }, betSize = 0.75 } = {}) => ({
  actionEVs: {
    bet: { ev: evs.bet, sizing: betSize },
    check: { ev: evs.check },
    fold: { ev: evs.fold },
    call: { ev: evs.call, sizing: null },
  },
  villainDistribution: villainDist,
  recommendedAction: { action: bestAction, ev: evs[bestAction], sizing: bestAction === 'bet' ? betSize : undefined },
});

const makeCanonicalFishTendency = () => ({
  villainId: 'v42',
  style: 'Fish',
  totalObservations: 54,
  adaptationObservations: 8,
  observedRates: {
    foldToRiverBet: { rate: 0.17, n: 52, lastUpdated: '2026-04-22T19:15:00Z' },
  },
});

const riverState = () => ({
  street: 'river',
  position: 'OOP',
  texture: 'any',
  spr: 4,
  heroIsAggressor: true,
  betSizePot: 0.75,
  nodeId: 'river-v-call',
});

// ───────────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────────

describe('produceCitedDecision — baseline absence (I-AE-6)', () => {
  it('returns { citation: null, reason: "insufficient-baseline" } when baseline missing', () => {
    const result = produceCitedDecision({ node: {}, assumptions: [], baseline: null });
    expect(result).toEqual({ citation: null, reason: 'insufficient-baseline' });
  });

  it('returns reason when baseline.actionEVs missing', () => {
    const result = produceCitedDecision({ node: {}, assumptions: [], baseline: {} });
    expect(result.citation).toBeNull();
    expect(result.reason).toBe('insufficient-baseline');
  });
});

describe('produceCitedDecision — honesty check (I-AE-3)', () => {
  it('no assumptions → recommendedAction === baselineAction, dividend 0', () => {
    const baseline = makeBaseline();
    const result = produceCitedDecision({
      node: riverState(),
      assumptions: [],
      baseline,
    });
    expect(result.recommendedAction.action).toBe(baseline.recommendedAction.action);
    expect(result.dividend).toBe(0);
    expect(result.citations).toEqual([]);
  });

  it('all dials at 0 → recommendedAction === baselineAction, dividend 0', () => {
    const baseline = makeBaseline();
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    // Zero out all dials
    for (const a of assumptions) a.operator.currentDial = 0;
    const result = produceCitedDecision({
      node: riverState(),
      assumptions,
      baseline,
    });
    expect(result.recommendedAction.action).toBe(baseline.recommendedAction.action);
    expect(result.dividend).toBe(0);
    expect(result.citations).toEqual([]);
  });

  it('non-zero dials → produces citations and recommendedAction may diverge', () => {
    const baseline = makeBaseline({ bestAction: 'bet', evs: { bet: 0.09, check: 0.27, fold: 0, call: 0.05 } });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    expect(assumptions.length).toBeGreaterThan(0);

    const result = produceCitedDecision({
      node: riverState(),
      assumptions,
      baseline,
      options: { surface: 'drill', villainStyle: 'Fish' },
    });
    expect(result.citations.length).toBeGreaterThan(0);
    // Bluff-prune recipe switches bet → check when baseline was bet.
    // Baseline has check EV 0.27 > bet EV 0.09, so recommending check yields positive dividend.
    expect(result.recommendedAction.action).toBe('check');
    expect(result.dividend).toBeGreaterThan(0);
  });
});

describe('produceCitedDecision — Canonical Example 1 end-to-end', () => {
  it('produces a complete CitedDecision from Fish tendency + baseline', () => {
    const baseline = makeBaseline({
      bestAction: 'bet',
      evs: { bet: 0.09, check: 0.27, fold: 0, call: 0.05 }, // check better post-prune
    });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({
      node: riverState(),
      assumptions,
      baseline,
      options: { surface: 'drill', villainStyle: 'Fish' },
    });

    expect(result).toBeDefined();
    expect(result.baselineAction.action).toBe('bet');
    expect(result.recommendedAction.action).toBe('check');
    expect(result.dividend).toBeCloseTo(0.18, 1);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].assumptionId).toMatch(/foldToRiverBet/);
    expect(result.citations[0].humanStatement).toMatch(/17%.*n=52/);
    expect(result.citations[0].contributionToDividend).toBeCloseTo(0.18, 1);
  });

  it('drill surface includes contestability alternateDials', () => {
    const baseline = makeBaseline({ evs: { bet: 0.09, check: 0.27, fold: 0, call: 0.05 } });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({
      node: riverState(),
      assumptions,
      baseline,
      options: { surface: 'drill' },
    });
    expect(result.contestability.alternateDials).toHaveLength(2);
    expect(result.contestability.alternateDials[0].description).toMatch(/balanced-baseline/);
    expect(result.contestability.alternateDials[1].description).toMatch(/full commitment/);
    // dial→0 resulting action should equal baseline
    expect(result.contestability.alternateDials[0].resultingAction.action).toBe(baseline.recommendedAction.action);
  });

  it('live surface omits alternateDials (CC-5)', () => {
    const baseline = makeBaseline({ evs: { bet: 0.09, check: 0.27, fold: 0, call: 0.05 } });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({
      node: riverState(),
      assumptions,
      baseline,
      options: { surface: 'live' },
    });
    expect(result.contestability.alternateDials).toEqual([]);
  });
});

describe('produceCitedDecision — surface filtering', () => {
  it('live surface excludes hero-side assumptions (I-AE-2)', () => {
    const heroSide = {
      id: 'hero-fear',
      operator: { target: 'hero', currentDial: 0.5, transform: { actionDistributionDelta: { fold: 0, call: 0, raise: 0 } } },
      quality: { actionableInDrill: true, actionableLive: false, composite: 0.7 },
      recognizability: { score: 0.6 },
      counterExploit: { resistanceScore: 0.7 },
      consequence: { deviationType: 'spot-skip', expectedDividend: { mean: 0.3, sd: 0.1, sharpe: 3 } },
      narrative: { humanStatement: 'you overfold when stuck' },
    };
    const baseline = makeBaseline();
    const result = produceCitedDecision({
      node: riverState(),
      assumptions: [heroSide],
      baseline,
      options: { surface: 'live' },
    });
    // Live surface filters hero-side; no citations emitted.
    expect(result.citations).toEqual([]);
    expect(result.recommendedAction.action).toBe(baseline.recommendedAction.action);
  });

  it('drill surface includes hero-side assumptions', () => {
    const heroSide = {
      id: 'hero-fear',
      operator: { target: 'hero', currentDial: 0.5, transform: { actionDistributionDelta: { fold: 0, call: 0, raise: 0 } } },
      quality: { actionableInDrill: true, actionableLive: false, composite: 0.7 },
      recognizability: { score: 0.6 },
      counterExploit: { resistanceScore: 0.7 },
      consequence: { deviationType: 'spot-skip', expectedDividend: { mean: 0.3, sd: 0.1, sharpe: 3 } },
      narrative: { humanStatement: 'you overfold when stuck' },
    };
    const baseline = makeBaseline();
    const result = produceCitedDecision({
      node: riverState(),
      assumptions: [heroSide],
      baseline,
      options: { surface: 'drill' },
    });
    // Drill surface accepts hero-side; citation present.
    expect(result.citations.length).toBeGreaterThan(0);
  });
});

describe('produceCitedDecision — output structure (schema §5)', () => {
  it('includes all required schema §5 fields', () => {
    const baseline = makeBaseline({ evs: { bet: 0.09, check: 0.27, fold: 0, call: 0.05 } });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({
      node: riverState(),
      assumptions,
      baseline,
      options: { surface: 'drill' },
    });

    expect(result).toHaveProperty('node');
    expect(result).toHaveProperty('baselineAction');
    expect(result).toHaveProperty('recommendedAction');
    expect(result).toHaveProperty('dividend');
    expect(result).toHaveProperty('citations');
    expect(result).toHaveProperty('dialPositions');
    expect(result).toHaveProperty('blend');
    expect(result).toHaveProperty('emotionalState');
    expect(result).toHaveProperty('contestability');
  });

  it('dialPositions contains one entry per applied assumption', () => {
    const baseline = makeBaseline({ evs: { bet: 0.09, check: 0.27, fold: 0, call: 0.05 } });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({ node: riverState(), assumptions, baseline, options: { surface: 'drill' } });
    expect(Object.keys(result.dialPositions).length).toBe(assumptions.length);
  });

  it('blend is in [0, 1]', () => {
    const baseline = makeBaseline();
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({ node: riverState(), assumptions, baseline });
    expect(result.blend).toBeGreaterThanOrEqual(0);
    expect(result.blend).toBeLessThanOrEqual(1);
  });

  it('emotionalState passes through when supplied', () => {
    const baseline = makeBaseline();
    const emotionalState = { fearIndex: 0.3, greedIndex: 0.2, joint: [0.3, 0.2], netTilt: -0.1, sources: [], computedAt: '2026-04-23T00:00:00Z', nodeId: 'x' };
    const result = produceCitedDecision({
      node: riverState(),
      assumptions: [],
      emotionalState,
      baseline,
    });
    expect(result.emotionalState).toBe(emotionalState);
  });
});

describe('produceCitedDecision — deviation-type action derivation', () => {
  it('bluff-prune: bet → check', () => {
    const baseline = makeBaseline({ bestAction: 'bet', evs: { bet: 0.1, check: 0.25, fold: 0, call: 0.05 } });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({ node: riverState(), assumptions, baseline });
    expect(result.recommendedAction.action).toBe('check');
  });

  it('no-op when baseline was already check and no value-expand recipe applicable', () => {
    const baseline = makeBaseline({ bestAction: 'check', evs: { bet: 0.05, check: 0.15, fold: 0, call: 0.02 } });
    // No assumptions applicable for check river
    const result = produceCitedDecision({ node: riverState(), assumptions: [], baseline });
    expect(result.recommendedAction.action).toBe('check');
    expect(result.dividend).toBe(0);
  });
});

describe('produceCitedDecision — robustness', () => {
  it('handles missing emotionalState', () => {
    const baseline = makeBaseline();
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({ node: riverState(), assumptions, baseline });
    expect(result.emotionalState).toBeNull();
  });

  it('handles no assumptions + honest-baseline passthrough', () => {
    const baseline = makeBaseline();
    const result = produceCitedDecision({ node: riverState(), assumptions: [], baseline });
    expect(result.recommendedAction.action).toBe(baseline.recommendedAction.action);
    expect(result.citations).toEqual([]);
    expect(result.dividend).toBe(0);
  });

  it('handles missing options defaults to drill', () => {
    const baseline = makeBaseline({ evs: { bet: 0.09, check: 0.27, fold: 0, call: 0.05 } });
    const assumptions = produceAssumptions(makeCanonicalFishTendency(), riverState());
    const result = produceCitedDecision({ node: riverState(), assumptions, baseline });
    // Default surface = drill → alternateDials present when citations non-empty
    expect(result.contestability.alternateDials.length).toBeGreaterThan(0);
  });
});
