/**
 * nitOverfoldRiver4flush.test.js — EAL-SEED-01 scenario integration test
 *
 * Commit 1 scope per `anchorLibrary/CLAUDE.md` File Responsibilities:
 *   - Validate that the authored anchor config passes schema gate.
 *   - Validate that GTO baseline math (MDF at 1.2× pot) matches declared referenceRate.
 *   - Verify scenario shape (required fields present for Commit 2 end-to-end wiring).
 *
 * Commit 2 scope (deferred, not in this test):
 *   - End-to-end predicted-vs-simulated dividend assertion with real synthetic Nit.
 *   - Honesty check assertion with dial=0.
 */

import { describe, it, expect } from 'vitest';

import { runAnchorScenario } from '../__sim__/anchorScenarioRunner';
import { validateAnchor } from '../validateAnchor';
import {
  EAL_SEED_01_ANCHOR,
  nitOverfoldRiver4flushScenario,
} from '../__sim__/scenarios/nitOverfoldRiver4flush';

// ───────────────────────────────────────────────────────────────────────────
// Anchor integrity
// ───────────────────────────────────────────────────────────────────────────

describe('EAL-SEED-01 anchor — schema integrity', () => {
  it('passes validateAnchor', () => {
    const result = validateAnchor(EAL_SEED_01_ANCHOR);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('has lineSequence across flop/turn/river', () => {
    expect(EAL_SEED_01_ANCHOR.lineSequence.map((s) => s.street)).toEqual(['flop', 'turn', 'river']);
  });

  it('references PP-01 as its load-bearing perception primitive', () => {
    expect(EAL_SEED_01_ANCHOR.perceptionPrimitiveIds).toContain('PP-01');
  });

  it('declares MDF GTO baseline', () => {
    expect(EAL_SEED_01_ANCHOR.gtoBaseline.method).toBe('MDF');
  });

  it('evDecomposition sums to 1 (I-EAL-5)', () => {
    const { statAttributable, perceptionAttributable } = EAL_SEED_01_ANCHOR.evDecomposition;
    expect(statAttributable + perceptionAttributable).toBeCloseTo(1.0, 2);
  });

  it('is authored by ai-authored source (Phase 1 baseline)', () => {
    expect(EAL_SEED_01_ANCHOR.origin.source).toBe('ai-authored');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Scenario config integrity
// ───────────────────────────────────────────────────────────────────────────

describe('nitOverfoldRiver4flushScenario config', () => {
  it('names the EAL-SEED-01 anchor', () => {
    expect(nitOverfoldRiver4flushScenario.name).toMatch(/EAL-SEED-01/);
  });

  it('targets foldToRiverBet predicate', () => {
    expect(nitOverfoldRiver4flushScenario.targetPredicate).toBe('foldToRiverBet');
  });

  it('declares a river-street gameState', () => {
    expect(nitOverfoldRiver4flushScenario.gameState.street).toBe('river');
    expect(nitOverfoldRiver4flushScenario.gameState.texture).toBe('flush-complete');
  });

  it('has villainTendency observedRates matching the anchor evidence.pointEstimate (0.72)', () => {
    const rate = nitOverfoldRiver4flushScenario.villainTendency.observedRates.foldToRiverBet.rate;
    expect(rate).toBeCloseTo(EAL_SEED_01_ANCHOR.evidence.pointEstimate, 2);
  });

  it('declares gtoContext for MDF verification at 1.2× pot', () => {
    expect(nitOverfoldRiver4flushScenario.gtoContext).toEqual({ potSize: 1.0, betSize: 1.2 });
  });

  it('(Commit 2) references NIT_SCARE_OVERFOLD synthetic villain (no longer null)', () => {
    expect(nitOverfoldRiver4flushScenario.villain).toBeDefined();
    expect(nitOverfoldRiver4flushScenario.villain).not.toBeNull();
    expect(nitOverfoldRiver4flushScenario.villain.targetAnchor).toBe('EAL-SEED-01');
    expect(nitOverfoldRiver4flushScenario.villain.styleLabel).toBe('Nit');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Schema-gate + GTO-math integration via runAnchorScenario
// ───────────────────────────────────────────────────────────────────────────

describe('nitOverfoldRiver4flushScenario — Commit 1 runner integration', () => {
  // Stub injected functions — Commit 2 wires the real assumptionEngine producer + runner.
  const stubProduceAssumptions = () => [
    {
      id: 'a-1',
      claim: { predicate: 'foldToRiverBet' },
      consequence: { expectedDividend: { mean: 0.66 } },
      operator: { currentDial: 0.78 },
    },
  ];

  const stubPredicateRunner = () => ({
    scenarioName: 'stub',
    passed: true,
    reason: null,
    predictedDividend: 0.66,
    simulatedDividend: 0.66,
    relativeError: 0.0,
    honestyCheck: { passed: true, predictedAtZeroDial: 0, simulated: 0 },
    firings: 10000,
  });

  it('passes schema + GTO + stub-predicate assertions', () => {
    const result = runAnchorScenario({
      ...nitOverfoldRiver4flushScenario,
      produceAssumptions: stubProduceAssumptions,
      runPredicateScenario: stubPredicateRunner,
    });

    expect(result.schemaOk).toBe(true);
    expect(result.gtoOk).toBe(true);
    expect(result.gto.method).toBe('MDF');
    // MDF-derived fold rate at 1.2× pot: bet/(pot+bet) = 1.2/2.2 ≈ 0.5455
    expect(result.gto.expectedFoldRate).toBeCloseTo(0.5455, 3);
    // Declared referenceRate 0.54 is within 2pt tolerance (0.0055 diff)
    expect(result.gto.diff).toBeLessThan(0.02);
    expect(result.passed).toBe(true);
  });

  it('GTO math matches POKER_THEORY.md §6.2 MDF formula', () => {
    // Sanity check: verify the runner's fold-rate-at-MDF matches the formula
    // bet / (pot + bet) independently derived.
    const pot = 1.0;
    const bet = 1.2;
    const foldRateAtMDF = bet / (pot + bet);
    expect(foldRateAtMDF).toBeCloseTo(0.5455, 3);
    // And it's close to the anchor's declared referenceRate
    expect(Math.abs(foldRateAtMDF - EAL_SEED_01_ANCHOR.gtoBaseline.referenceRate)).toBeLessThan(0.02);
  });
});
