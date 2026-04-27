/**
 * tagOverfoldFlopDonk.test.js — EAL-SEED-04 scenario test
 *
 * Critical: this anchor ships `status: 'candidate'` per S1 design as an
 * intentional failing-gate stress test. The SCHEMA must still validate.
 * The v1.1 quality-gate failure (posteriorConfidence 0.78 < 0.80) is a
 * SURFACE-LAYER concern, not a schema concern.
 */

import { describe, it, expect } from 'vitest';

import { runAnchorScenario } from '../__sim__/anchorScenarioRunner';
import { validateAnchor } from '../validateAnchor';
import {
  EAL_SEED_04_ANCHOR,
  tagOverfoldFlopDonkScenario,
} from '../__sim__/scenarios/tagOverfoldFlopDonk';

describe('EAL-SEED-04 anchor — schema integrity despite candidate status', () => {
  it('passes validateAnchor (schema valid even as candidate)', () => {
    const result = validateAnchor(EAL_SEED_04_ANCHOR);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('declares status: candidate per S1 design decision', () => {
    expect(EAL_SEED_04_ANCHOR.status).toBe('candidate');
  });

  it('references PP-04 (Gate 2 flagged as most-likely-to-invalidate)', () => {
    expect(EAL_SEED_04_ANCHOR.perceptionPrimitiveIds).toEqual(['PP-04']);
  });

  it('declares range-balance GTO method (third distinct method across 4 seeds)', () => {
    expect(EAL_SEED_04_ANCHOR.gtoBaseline.method).toBe('range-balance');
  });

  it('has posteriorConfidence intentionally below ≥0.80 v1.1 gate', () => {
    // This is a SURFACE-LAYER gate failure; schema validation still passes.
    expect(EAL_SEED_04_ANCHOR.evidence.posteriorConfidence).toBeLessThan(0.80);
    expect(EAL_SEED_04_ANCHOR.evidence.posteriorConfidence).toBeCloseTo(0.78, 2);
  });

  it('evDecomposition is 15/85 (almost entirely perception-driven)', () => {
    expect(EAL_SEED_04_ANCHOR.evDecomposition.statAttributable).toBeCloseTo(0.15, 2);
    expect(EAL_SEED_04_ANCHOR.evDecomposition.perceptionAttributable).toBeCloseTo(0.85, 2);
  });

  it('has 2-street preflop+flop line sequence (shortest of 4 anchors)', () => {
    expect(EAL_SEED_04_ANCHOR.lineSequence).toHaveLength(2);
    expect(EAL_SEED_04_ANCHOR.lineSequence.map((s) => s.street)).toEqual(['preflop', 'flop']);
  });
});

describe('tagOverfoldFlopDonkScenario config', () => {
  it('names EAL-SEED-04 with candidate flag', () => {
    expect(tagOverfoldFlopDonkScenario.name).toMatch(/EAL-SEED-04/);
    expect(tagOverfoldFlopDonkScenario.name).toMatch(/candidate/i);
  });

  it('targets foldVsFlopDonkWetConnected predicate', () => {
    expect(tagOverfoldFlopDonkScenario.targetPredicate).toBe('foldVsFlopDonkWetConnected');
  });

  it('gameState encodes hero-donk line on wet texture', () => {
    expect(tagOverfoldFlopDonkScenario.gameState.heroLineType).toBe('donk');
    expect(tagOverfoldFlopDonkScenario.gameState.texture).toBe('wet');
    expect(tagOverfoldFlopDonkScenario.gameState.street).toBe('flop');
  });

  it('villainTendency matches anchor pointEstimate (0.64)', () => {
    const rate = tagOverfoldFlopDonkScenario.villainTendency.observedRates
      .foldVsFlopDonkWetConnected.rate;
    expect(rate).toBeCloseTo(EAL_SEED_04_ANCHOR.evidence.pointEstimate, 2);
  });
});

describe('tagOverfoldFlopDonkScenario — Commit 2 runner integration', () => {
  const stubProduceAssumptions = () => [{
    id: 'a-4',
    claim: { predicate: 'foldVsFlopDonkWetConnected' },
    consequence: { expectedDividend: { mean: 0.58 } },
    operator: { currentDial: 0.55 },
  }];

  const stubPredicateRunner = () => ({
    scenarioName: 'stub',
    passed: true,
    predictedDividend: 0.58,
    simulatedDividend: 0.58,
    relativeError: 0.0,
    honestyCheck: { passed: true, predictedAtZeroDial: 0, simulated: 0 },
    firings: 10000,
  });

  it('runs successfully through the runner — schema + GTO gates pass even for candidate', () => {
    const result = runAnchorScenario({
      ...tagOverfoldFlopDonkScenario,
      produceAssumptions: stubProduceAssumptions,
      runPredicateScenario: stubPredicateRunner,
    });
    expect(result.schemaOk).toBe(true);
    expect(result.gtoOk).toBe(true);
    expect(result.gto.deferred).toBe(true);
    expect(result.gto.method).toBe('range-balance');
    // Scenario-level PASSES even though surface-layer v1.1 gate would fail on this anchor.
    // This is the correct separation: scenario tests math; surface tests actionability.
    expect(result.passed).toBe(true);
  });
});
