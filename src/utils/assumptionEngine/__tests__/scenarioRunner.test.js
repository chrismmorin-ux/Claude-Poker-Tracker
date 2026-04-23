import { describe, it, expect } from 'vitest';
import { runScenario, runScenarioSuite } from '../__sim__/scenarioRunner';
import { riverBluffPruningScenario } from '../__sim__/scenarios/riverBluffPruning';
import { FISH_STATION, NIT_TIGHT, CANONICAL_VILLAINS, customPolicy } from '../__sim__/syntheticVillains';
import { produceAssumptions } from '../assumptionProducer';

describe('synthetic villains registry', () => {
  it('exports canonical villains', () => {
    expect(CANONICAL_VILLAINS.FISH_STATION).toBeDefined();
    expect(CANONICAL_VILLAINS.NIT_TIGHT).toBeDefined();
    expect(CANONICAL_VILLAINS.LAG_AGGRESSIVE).toBeDefined();
    expect(CANONICAL_VILLAINS.TAG_SOLID).toBeDefined();
    expect(CANONICAL_VILLAINS.FISH_SELECTIVE_FEAR).toBeDefined();
  });

  it('Fish station has expected fold rate 0.17', () => {
    const dist = FISH_STATION.actionAtNode({ street: 'river' }, null);
    expect(dist.fold).toBe(0.17);
    expect(dist.fold + dist.call + dist.raise).toBeCloseTo(1.0, 4);
  });

  it('Nit folds dry flops at 0.78 but less on other streets', () => {
    const dryFlop = NIT_TIGHT.actionAtNode({ street: 'flop', texture: 'dry' }, null);
    expect(dryFlop.fold).toBe(0.78);
    const turn = NIT_TIGHT.actionAtNode({ street: 'turn', texture: 'wet' }, null);
    expect(turn.fold).toBe(0.55);
  });

  it('Fish with selective fear folds more on flush-complete rivers', () => {
    const { FISH_SELECTIVE_FEAR } = CANONICAL_VILLAINS;
    const normalRiver = FISH_SELECTIVE_FEAR.actionAtNode({ street: 'river', texture: 'any', betSizePot: 0.5 }, null);
    const flushComplete = FISH_SELECTIVE_FEAR.actionAtNode({ street: 'river', texture: 'flush-complete', betSizePot: 1.0 }, null);
    expect(flushComplete.fold).toBeGreaterThan(normalRiver.fold);
  });

  it('customPolicy factory accepts overrides', () => {
    const policy = customPolicy({
      styleLabel: 'Custom',
      seed: 99,
      actionAtNode: () => ({ fold: 0.8, call: 0.15, raise: 0.05 }),
    });
    const dist = policy.actionAtNode({}, null);
    expect(dist.fold).toBe(0.8);
    expect(policy.styleLabel).toBe('Custom');
  });

  it('customPolicy with no actionAtNode returns default', () => {
    const policy = customPolicy({});
    const dist = policy.actionAtNode({}, null);
    expect(dist.fold + dist.call + dist.raise).toBeCloseTo(1.0, 4);
  });
});

describe('runScenario — Canonical Example 1', () => {
  it('produces a scenario result for river bluff pruning', () => {
    const result = runScenario({
      ...riverBluffPruningScenario,
      produceAssumptions,
    });
    expect(result.scenarioName).toBeDefined();
    expect(result.predictedDividend).not.toBeNull();
    expect(result.simulatedDividend).not.toBeNull();
    expect(result.firings).toBe(10000);
  });

  it('honesty check structure is present', () => {
    const result = runScenario({
      ...riverBluffPruningScenario,
      produceAssumptions,
    });
    expect(result.honestyCheck).toBeDefined();
    expect(typeof result.honestyCheck.passed).toBe('boolean');
    expect(result.honestyCheck.predictedAtZeroDial).toBe(0);
  });

  it('scenario identifies the target assumption by id', () => {
    const result = runScenario({
      ...riverBluffPruningScenario,
      produceAssumptions,
    });
    expect(result.targetAssumptionId).toMatch(/foldToRiverBet/);
  });
});

describe('runScenario — edge cases', () => {
  it('handles scenario where no assumption is produced', () => {
    const result = runScenario({
      name: 'empty-scenario',
      villain: FISH_STATION,
      villainTendency: {
        villainId: 'v0',
        style: 'Fish',
        totalObservations: 0,
        observedRates: {},
      },
      gameState: { street: 'river', heroIsAggressor: true },
      targetPredicate: 'foldToRiverBet',
      produceAssumptions,
      firings: 100,
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/no assumption produced/);
    expect(result.predictedDividend).toBeNull();
  });
});

describe('runScenarioSuite', () => {
  it('aggregates multiple scenario results', () => {
    const suite = runScenarioSuite([
      { ...riverBluffPruningScenario, produceAssumptions },
    ]);
    expect(Array.isArray(suite.results)).toBe(true);
    expect(suite.results).toHaveLength(1);
    expect(typeof suite.allPassed).toBe('boolean');
  });
});
