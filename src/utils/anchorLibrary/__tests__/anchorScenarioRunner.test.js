/**
 * anchorScenarioRunner.test.js — Tier-1 anchor scenario runner unit tests
 *
 * Covers:
 *   - Schema-integrity gate (bad anchor → early fail)
 *   - GTO baseline math verification (MDF formula)
 *   - Non-MDF method deferred verification
 *   - Predicate-scenario delegation (injected runner)
 *   - Missing gtoContext for MDF method → fail
 *   - Suite aggregation
 */

import { describe, it, expect, vi } from 'vitest';

import { runAnchorScenario, runAnchorScenarioSuite } from '../__sim__/anchorScenarioRunner';
import { ANCHOR_SCHEMA_VERSION } from '../validateAnchor';

// ───────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────────

const validAnchor = () => ({
  schemaVersion: ANCHOR_SCHEMA_VERSION,
  archetypeName: 'Test Anchor for Runner',
  polarity: 'overfold',
  tier: 2,
  lineSequence: [{ street: 'river' }],
  perceptionPrimitiveIds: ['PP-01'],
  gtoBaseline: {
    method: 'MDF',
    // For a pot-sized bet (bet/pot = 1.0): fold-rate-at-MDF = bet / (pot + bet) = 0.5
    referenceRate: 0.5,
    referenceEv: 0.0,
  },
  evDecomposition: { statAttributable: 0.35, perceptionAttributable: 0.65 },
  retirementCondition: { method: 'credible-interval-overlap', params: { level: 0.95 } },
  origin: { source: 'ai-authored', authoredAt: '2026-04-24T00:00:00Z' },
  // Consequence stub — the real predicate scenario would compute dividend;
  // the runner delegates to injected runPredicateScenario for this layer.
  consequence: {
    expectedDividend: { mean: 0.6, sd: 0.14, sharpe: 4.3, unit: 'bb per 100 trigger firings' },
  },
});

const makeFakePredicateRunner = (passed, honestyPassed = true) => vi.fn(() => ({
  scenarioName: 'fake-predicate',
  passed,
  reason: passed ? null : 'simulated fail',
  predictedDividend: 0.6,
  simulatedDividend: passed ? 0.6 : 0.4,
  relativeError: passed ? 0.0 : 0.33,
  honestyCheck: { passed: honestyPassed, predictedAtZeroDial: 0, simulated: 0 },
  firings: 10000,
}));

const fakeProduceAssumptions = vi.fn(() => [
  {
    id: 'a-1',
    claim: { predicate: 'foldToRiverBet' },
    consequence: { expectedDividend: { mean: 0.6 } },
    operator: { currentDial: 0.78 },
  },
]);

const baseScenario = (overrides = {}) => ({
  name: 'test-scenario',
  anchor: validAnchor(),
  villain: { styleLabel: 'Fish', seed: 42, actionAtNode: () => ({ fold: 0.17, call: 0.8, raise: 0.03 }) },
  villainTendency: { villainId: 'v-1', style: 'Fish' },
  gameState: { street: 'river', betSizePot: 1.0 },
  sessionContext: {},
  targetPredicate: 'foldToRiverBet',
  firings: 100,
  tolerance: 0.05,
  gtoContext: { potSize: 1.0, betSize: 1.0 }, // pot-sized bet → MDF fold rate = 0.5
  produceAssumptions: fakeProduceAssumptions,
  runPredicateScenario: makeFakePredicateRunner(true),
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// Schema-gate tests
// ───────────────────────────────────────────────────────────────────────────

describe('runAnchorScenario — schema gate', () => {
  it('fails fast on schema-invalid anchor', () => {
    const scenario = baseScenario({
      anchor: { ...validAnchor(), polarity: 'invalid-polarity' },
    });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(false);
    expect(result.schemaOk).toBe(false);
    expect(result.reason).toMatch(/schema invalid/i);
    expect(result.schemaErrors).toBeDefined();
    // Should NOT have reached predicate runner
    expect(scenario.runPredicateScenario).not.toHaveBeenCalled();
  });

  it('fails fast on I-EAL-5 violation (evDecomposition sum ≠ 1)', () => {
    const scenario = baseScenario({
      anchor: {
        ...validAnchor(),
        evDecomposition: { statAttributable: 0.5, perceptionAttributable: 0.3 },
      },
    });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(false);
    expect(result.schemaOk).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// GTO baseline verification
// ───────────────────────────────────────────────────────────────────────────

describe('runAnchorScenario — GTO baseline math', () => {
  it('passes when MDF-derived fold rate matches declared referenceRate', () => {
    // pot-sized bet: bet/(pot+bet) = 1/2 = 0.5 → referenceRate 0.5 ✓
    const result = runAnchorScenario(baseScenario());
    expect(result.passed).toBe(true);
    expect(result.gtoOk).toBe(true);
    expect(result.gto.method).toBe('MDF');
    expect(result.gto.expectedFoldRate).toBeCloseTo(0.5, 3);
  });

  it('passes for 1.2× pot (interpolation) within 2pt tolerance', () => {
    // 1.2× pot: bet/(pot+bet) = 1.2 / 2.2 ≈ 0.5455. Declared 0.54 → diff 0.0055 ≤ 0.02 ✓
    const scenario = baseScenario({
      anchor: {
        ...validAnchor(),
        gtoBaseline: { method: 'MDF', referenceRate: 0.54, referenceEv: 0.04 },
      },
      gtoContext: { potSize: 1.0, betSize: 1.2 },
    });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(true);
    expect(result.gtoOk).toBe(true);
  });

  it('fails when MDF-derived fold rate differs from declared by > 2pt', () => {
    // pot-sized bet (MDF → 0.5) but declared 0.7 — divergence 0.2 > 0.02 tolerance
    const scenario = baseScenario({
      anchor: {
        ...validAnchor(),
        gtoBaseline: { method: 'MDF', referenceRate: 0.7, referenceEv: 0 },
      },
      gtoContext: { potSize: 1.0, betSize: 1.0 },
    });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(false);
    expect(result.gtoOk).toBe(false);
    expect(result.reason).toMatch(/GTO baseline math mismatch/);
    expect(result.gto.diff).toBeGreaterThan(0.02);
  });

  it('fails when MDF anchor has no gtoContext', () => {
    const scenario = baseScenario({ gtoContext: undefined });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(false);
    expect(result.gtoOk).toBe(false);
    expect(result.reason).toMatch(/gtoContext/);
  });

  it('defers verification for non-MDF methods', () => {
    const scenario = baseScenario({
      anchor: {
        ...validAnchor(),
        gtoBaseline: { method: 'pot-odds-equilibrium', referenceRate: 0.5, referenceEv: 0 },
      },
      // No gtoContext needed for deferred methods
      gtoContext: undefined,
    });
    const result = runAnchorScenario(scenario);
    expect(result.gtoOk).toBe(true);
    expect(result.gto.deferred).toBe(true);
    // Should still reach predicate runner since GTO passes
    expect(scenario.runPredicateScenario).toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Predicate-scenario delegation
// ───────────────────────────────────────────────────────────────────────────

describe('runAnchorScenario — predicate delegation', () => {
  it('passes when delegated predicate scenario passes', () => {
    const runner = makeFakePredicateRunner(true);
    const scenario = baseScenario({ runPredicateScenario: runner });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(true);
    expect(runner).toHaveBeenCalledOnce();
    // Assert the runner received the correctly composed scenario
    const call = runner.mock.calls[0][0];
    expect(call.targetPredicate).toBe('foldToRiverBet');
    expect(call.firings).toBe(100);
    expect(call.produceAssumptions).toBe(fakeProduceAssumptions);
  });

  it('fails when delegated predicate scenario fails', () => {
    const scenario = baseScenario({ runPredicateScenario: makeFakePredicateRunner(false) });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(false);
    expect(result.predicate.passed).toBe(false);
    expect(result.schemaOk).toBe(true); // schema was fine
    expect(result.gtoOk).toBe(true);     // GTO was fine
  });

  it('fails when honesty check fails', () => {
    const scenario = baseScenario({
      runPredicateScenario: makeFakePredicateRunner(true, /* honestyPassed */ false),
    });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(false);
  });

  it('fails if runPredicateScenario is not injected', () => {
    const scenario = baseScenario({ runPredicateScenario: undefined });
    const result = runAnchorScenario(scenario);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/runPredicateScenario/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Suite aggregation
// ───────────────────────────────────────────────────────────────────────────

describe('runAnchorScenarioSuite', () => {
  it('aggregates multiple scenarios', () => {
    const scenarios = [
      baseScenario({ name: 's1', runPredicateScenario: makeFakePredicateRunner(true) }),
      baseScenario({ name: 's2', runPredicateScenario: makeFakePredicateRunner(true) }),
    ];
    const suite = runAnchorScenarioSuite(scenarios);
    expect(suite.allPassed).toBe(true);
    expect(suite.results).toHaveLength(2);
  });

  it('aggregates to allPassed=false when any scenario fails', () => {
    const scenarios = [
      baseScenario({ name: 's1', runPredicateScenario: makeFakePredicateRunner(true) }),
      baseScenario({ name: 's2', runPredicateScenario: makeFakePredicateRunner(false) }),
    ];
    const suite = runAnchorScenarioSuite(scenarios);
    expect(suite.allPassed).toBe(false);
    expect(suite.results[0].passed).toBe(true);
    expect(suite.results[1].passed).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Result shape
// ───────────────────────────────────────────────────────────────────────────

describe('AnchorScenarioResult shape', () => {
  it('includes scenarioName, passed, reason, schemaOk, gtoOk, predicate fields', () => {
    const result = runAnchorScenario(baseScenario());
    expect(result).toMatchObject({
      scenarioName: expect.any(String),
      passed: expect.any(Boolean),
      schemaOk: expect.any(Boolean),
    });
    expect(result.predicate).not.toBeNull();
    expect(result.gto).not.toBeNull();
  });
});
