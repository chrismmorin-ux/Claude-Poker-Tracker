/**
 * Tests for planDerivation.js (LSW-P4 — engine-derived plan derivation).
 *
 * Covers:
 *  - derivePlanFromBucketEVs unit cases (synchronous transformer):
 *      bad input → null
 *      errorState input → plan with errorState propagated, empty perAction
 *      empty actionEVs → null
 *      happy path → perAction array shape
 *      best-action label + reason propagation
 *      caveats propagation (incl. v1-simplified-ev)
 *      nextStreetPlan stays null in v1 (P4 stub — D1 will populate)
 *      heroCombo passes through
 *      unsupported actions surface their flag
 *      EV CI fields propagate
 *      defensive defaults on missing fields
 *  - computeEnginePlan integration:
 *      end-to-end on a real K72r flop fixture mirroring drillModeEngineV2.test.js
 *      errorState input (null) returns plan with errorState
 *      decisionKind from input is forwarded to plan
 */

import { describe, it, expect } from 'vitest';
import {
  derivePlanFromBucketEVs,
  computeEnginePlan,
} from '../planDerivation';
import { archetypeRangeFor } from '../archetypeRanges';
import { parseBoard } from '../../pokerCore/cardParser';

const flop = (...cards) => parseBoard(cards);

// ----- Fixture: a successful computeBucketEVsV2 output ---------------------

const successFixture = () => ({
  decomposition: [
    { groupId: 'overpair',   groupLabel: 'Overpair',       weightPct: 25, heroEquity: 0.25, relation: 'dominated', comboCount: 8 },
    { groupId: 'overcardsAx',groupLabel: 'Overcards (Ax)', weightPct: 45, heroEquity: 0.78, relation: 'favored',   comboCount: 12 },
    { groupId: 'gutshot',    groupLabel: 'Gutshot',        weightPct: 20, heroEquity: 0.65, relation: 'favored',   comboCount: 6 },
    { groupId: 'set',        groupLabel: 'Set',            weightPct: 10, heroEquity: 0.10, relation: 'crushed',   comboCount: 2 },
  ],
  actionEVs: [
    {
      actionLabel: 'check',
      kind: 'check',
      betFraction: 0,
      perGroupContribution: [],
      totalEV: 12.0,
      totalEVCI: { low: 11.5, high: 12.5 },
      isBest: false,
    },
    {
      actionLabel: 'bet 75%',
      kind: 'bet',
      betFraction: 0.75,
      perGroupContribution: [],
      totalEV: 18.32,
      totalEVCI: { low: 17.82, high: 18.82 },
      isBest: true,
    },
    {
      actionLabel: 'call',
      kind: 'call',
      betFraction: 0,
      perGroupContribution: [],
      totalEV: 0,
      totalEVCI: { low: -0.5, high: 0.5 },
      isBest: false,
      unsupported: true,
    },
  ],
  recommendation: {
    actionLabel: 'bet 75%',
    templatedReason: 'Correct: bet 75% at +18.32bb — weighted across villain\'s decomposition, this is the highest-EV option.',
  },
  valueBeatRatio: null,
  streetNarrowing: null,
  confidence: {
    mcTrials: 500,
    populationPriorSource: 'GROUP_CALL_RATES + archetypeRangeBuilder',
    archetype: 'reg',
    caveats: ['synthetic-range', 'v1-simplified-ev'],
  },
  perVillainDecompositions: null,
  cascadingFoldProbability: null,
  errorState: null,
});

const errorFixture = () => ({
  decomposition: [],
  actionEVs: [],
  recommendation: { actionLabel: '', templatedReason: '' },
  valueBeatRatio: null,
  streetNarrowing: null,
  confidence: { mcTrials: 0, populationPriorSource: '', archetype: '', caveats: [] },
  perVillainDecompositions: null,
  cascadingFoldProbability: null,
  errorState: { kind: 'range-unavailable', userMessage: 'Villain range missing', diagnostic: 'test' },
});

// ----- derivePlanFromBucketEVs — bad input branches ------------------------

describe('derivePlanFromBucketEVs — defensive bad-input handling', () => {
  it('returns null for null input', () => {
    expect(derivePlanFromBucketEVs(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(derivePlanFromBucketEVs(undefined)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(derivePlanFromBucketEVs('not-an-object')).toBeNull();
    expect(derivePlanFromBucketEVs(42)).toBeNull();
  });

  it('returns null when actionEVs is missing', () => {
    expect(derivePlanFromBucketEVs({ decomposition: [], errorState: null })).toBeNull();
  });

  it('returns null when actionEVs is empty', () => {
    expect(derivePlanFromBucketEVs({ actionEVs: [], errorState: null })).toBeNull();
  });
});

// ----- derivePlanFromBucketEVs — errorState propagation -------------------

describe('derivePlanFromBucketEVs — errorState propagation', () => {
  it('returns plan with errorState populated and empty perAction', () => {
    const plan = derivePlanFromBucketEVs(errorFixture());
    expect(plan).not.toBeNull();
    expect(plan.errorState).toEqual({
      kind: 'range-unavailable',
      userMessage: 'Villain range missing',
      diagnostic: 'test',
    });
    expect(plan.perAction).toEqual([]);
    expect(plan.bestActionLabel).toBeNull();
    expect(plan.bestActionReason).toBeNull();
    expect(plan.caveats).toEqual([]);
    expect(plan.nextStreetPlan).toBeNull();
  });

  it('preserves heroCombo + decisionKind on error path', () => {
    const plan = derivePlanFromBucketEVs(errorFixture(), {
      heroCombo: 'J♥T♠',
      decisionKind: 'bluff-catch',
    });
    expect(plan.heroCombo).toBe('J♥T♠');
    expect(plan.decisionKind).toBe('bluff-catch');
  });
});

// ----- derivePlanFromBucketEVs — happy path ----------------------------

describe('derivePlanFromBucketEVs — happy path', () => {
  it('produces one perAction entry per actionEV', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    expect(plan.perAction.length).toBe(3);
  });

  it('marks the best action correctly', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    const best = plan.perAction.filter((a) => a.isBest);
    expect(best.length).toBe(1);
    expect(best[0].actionLabel).toBe('bet 75%');
    expect(best[0].ev).toBeCloseTo(18.32);
  });

  it('propagates bestActionLabel + bestActionReason from recommendation', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    expect(plan.bestActionLabel).toBe('bet 75%');
    expect(plan.bestActionReason).toMatch(/Correct: bet 75% at \+18\.32bb/);
  });

  it('propagates confidence caveats including v1-simplified-ev', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    expect(plan.caveats).toContain('synthetic-range');
    expect(plan.caveats).toContain('v1-simplified-ev');
  });

  it('produces an independent caveats array (not aliasing the input)', () => {
    const fixture = successFixture();
    const plan = derivePlanFromBucketEVs(fixture);
    plan.caveats.push('mutated');
    expect(fixture.confidence.caveats).not.toContain('mutated');
  });

  it('keeps nextStreetPlan null in v1 (LSW-D1 will populate)', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    expect(plan.nextStreetPlan).toBeNull();
  });

  it('passes heroCombo through verbatim', () => {
    const plan = derivePlanFromBucketEVs(successFixture(), { heroCombo: 'J♥T♠' });
    expect(plan.heroCombo).toBe('J♥T♠');
  });

  it('defaults heroCombo to null + decisionKind to standard', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    expect(plan.heroCombo).toBeNull();
    expect(plan.decisionKind).toBe('standard');
  });

  it('forwards decisionKind from options', () => {
    const plan = derivePlanFromBucketEVs(successFixture(), { decisionKind: 'thin-value' });
    expect(plan.decisionKind).toBe('thin-value');
  });

  it('surfaces unsupported actions with the flag', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    const callAction = plan.perAction.find((a) => a.actionKind === 'call');
    expect(callAction.unsupported).toBe(true);
    expect(callAction.isBest).toBe(false);
  });

  it('propagates EV CI bounds when present', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    const best = plan.perAction.find((a) => a.isBest);
    expect(best.evLow).toBeCloseTo(17.82);
    expect(best.evHigh).toBeCloseTo(18.82);
  });

  it('returns errorState=null on the success path', () => {
    const plan = derivePlanFromBucketEVs(successFixture());
    expect(plan.errorState).toBeNull();
  });
});

// ----- derivePlanFromBucketEVs — defensive defaults ------------------------

describe('derivePlanFromBucketEVs — defensive defaults', () => {
  it('handles missing actionLabel + kind on individual actions', () => {
    const fixture = successFixture();
    fixture.actionEVs[0] = {
      perGroupContribution: [],
      totalEV: 5,
      totalEVCI: { low: 4.5, high: 5.5 },
      isBest: false,
    };
    const plan = derivePlanFromBucketEVs(fixture);
    expect(plan.perAction[0].actionLabel).toBe('');
    expect(plan.perAction[0].actionKind).toBeNull();
  });

  it('handles non-finite EV (NaN, Infinity) by zeroing', () => {
    const fixture = successFixture();
    fixture.actionEVs[0].totalEV = NaN;
    const plan = derivePlanFromBucketEVs(fixture);
    expect(plan.perAction[0].ev).toBe(0);
  });

  it('handles missing totalEVCI', () => {
    const fixture = successFixture();
    fixture.actionEVs[0].totalEVCI = undefined;
    const plan = derivePlanFromBucketEVs(fixture);
    expect(plan.perAction[0].evLow).toBeNull();
    expect(plan.perAction[0].evHigh).toBeNull();
  });

  it('handles missing recommendation block by returning null labels', () => {
    const fixture = successFixture();
    fixture.recommendation = undefined;
    const plan = derivePlanFromBucketEVs(fixture);
    expect(plan.bestActionLabel).toBeNull();
    expect(plan.bestActionReason).toBeNull();
  });

  it('handles empty-string templatedReason by treating as null', () => {
    const fixture = successFixture();
    fixture.recommendation = { actionLabel: 'bet 75%', templatedReason: '' };
    const plan = derivePlanFromBucketEVs(fixture);
    expect(plan.bestActionLabel).toBe('bet 75%');
    expect(plan.bestActionReason).toBeNull();
  });

  it('handles missing confidence block by returning empty caveats', () => {
    const fixture = successFixture();
    fixture.confidence = undefined;
    const plan = derivePlanFromBucketEVs(fixture);
    expect(plan.caveats).toEqual([]);
  });
});

// ----- computeEnginePlan — integration with computeBucketEVsV2 ----------

describe('computeEnginePlan — end-to-end', () => {
  // Mirror the K72r happy-path fixture from drillModeEngineV2.test.js.
  const baseInput = {
    nodeId: 'test-node',
    lineId: 'test-line',
    street: 'flop',
    board: flop('K♠', '7♥', '2♦'),
    pot: 100,
    effStack: 100,
    villains: [{ position: 'BB', baseRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }) }],
    heroView: { kind: 'single-combo', combos: [{ card1: 51, card2: 50 }] },
    heroActions: [
      { label: 'check',    kind: 'check' },
      { label: 'bet 33%',  kind: 'bet', betFraction: 0.33 },
      { label: 'bet 75%',  kind: 'bet', betFraction: 0.75 },
    ],
    archetype: 'reg',
    decisionKind: 'standard',
  };

  it('returns a plan with non-empty perAction on the happy path', async () => {
    const plan = await computeEnginePlan(baseInput);
    expect(plan).not.toBeNull();
    expect(plan.errorState).toBeNull();
    expect(plan.perAction.length).toBe(3);
    for (const a of plan.perAction) {
      expect(typeof a.actionLabel).toBe('string');
      expect(Number.isFinite(a.ev)).toBe(true);
      expect(typeof a.isBest).toBe('boolean');
    }
  });

  it('marks exactly one best action across the plan', async () => {
    const plan = await computeEnginePlan(baseInput);
    const best = plan.perAction.filter((a) => a.isBest);
    expect(best.length).toBe(1);
  });

  it('forwards heroCombo display string', async () => {
    const plan = await computeEnginePlan(baseInput, 'J♥T♠');
    expect(plan.heroCombo).toBe('J♥T♠');
  });

  it('inherits v1-simplified-ev caveat (cleared once LSW-D1 ships)', async () => {
    const plan = await computeEnginePlan(baseInput);
    expect(plan.caveats).toContain('v1-simplified-ev');
  });

  it('forwards decisionKind from input to plan', async () => {
    const plan = await computeEnginePlan({ ...baseInput, decisionKind: 'bluff-catch' });
    expect(plan.decisionKind).toBe('bluff-catch');
  });

  it('returns plan with errorState on null input (graceful degradation)', async () => {
    const plan = await computeEnginePlan(null);
    expect(plan).not.toBeNull();
    expect(plan.errorState).not.toBeNull();
    expect(plan.errorState.kind).toBe('engine-internal');
    expect(plan.perAction).toEqual([]);
  });

  it('returns plan with errorState on multiway input (LSW-G6 deferred)', async () => {
    const plan = await computeEnginePlan({
      ...baseInput,
      villains: [
        { position: 'BB', baseRange: baseInput.villains[0].baseRange },
        { position: 'SB', baseRange: baseInput.villains[0].baseRange },
      ],
    });
    expect(plan.errorState).not.toBeNull();
    expect(plan.errorState.diagnostic).toMatch(/MW engine is LSW-G6/);
  });

  it('keeps nextStreetPlan null in v1 (D1 will populate)', async () => {
    const plan = await computeEnginePlan(baseInput);
    expect(plan.nextStreetPlan).toBeNull();
  });
});
