/**
 * lagOverbluffRiverProbe.test.js — EAL-SEED-02 scenario integration test
 *
 * Commit 2 scope — schema gate + GTO-deferred + stub-predicate delegation.
 */

import { describe, it, expect } from 'vitest';

import { runAnchorScenario } from '../__sim__/anchorScenarioRunner';
import { validateAnchor } from '../validateAnchor';
import {
  EAL_SEED_02_ANCHOR,
  lagOverbluffRiverProbeScenario,
} from '../__sim__/scenarios/lagOverbluffRiverProbe';

describe('EAL-SEED-02 anchor — schema integrity', () => {
  it('passes validateAnchor', () => {
    const result = validateAnchor(EAL_SEED_02_ANCHOR);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('references PP-02 and PP-05 (dual primitive dependency)', () => {
    expect(EAL_SEED_02_ANCHOR.perceptionPrimitiveIds).toEqual(['PP-02', 'PP-05']);
  });

  it('declares pot-odds-equilibrium GTO method', () => {
    expect(EAL_SEED_02_ANCHOR.gtoBaseline.method).toBe('pot-odds-equilibrium');
  });

  it('has overbluff polarity (distinct from SEED-01 overfold)', () => {
    expect(EAL_SEED_02_ANCHOR.polarity).toBe('overbluff');
  });

  it('uses gap-threshold retirement (not CI-overlap) per seed-02 §7 reasoning', () => {
    expect(EAL_SEED_02_ANCHOR.retirementCondition.method).toBe('gap-threshold');
    expect(EAL_SEED_02_ANCHOR.retirementCondition.params.gap).toBe(0.05);
    expect(EAL_SEED_02_ANCHOR.retirementCondition.params.sessions).toBe(10);
  });

  it('evDecomposition is 75% perception (dual-primitive load-bearing)', () => {
    expect(EAL_SEED_02_ANCHOR.evDecomposition.perceptionAttributable).toBeCloseTo(0.75, 2);
    const sum = EAL_SEED_02_ANCHOR.evDecomposition.statAttributable
              + EAL_SEED_02_ANCHOR.evDecomposition.perceptionAttributable;
    expect(sum).toBeCloseTo(1.0, 2);
  });
});

describe('lagOverbluffRiverProbeScenario config', () => {
  it('names EAL-SEED-02', () => {
    expect(lagOverbluffRiverProbeScenario.name).toMatch(/EAL-SEED-02/);
  });

  it('targets riverProbeBluffFrequencyAfterTurnXX predicate', () => {
    expect(lagOverbluffRiverProbeScenario.targetPredicate).toBe(
      'riverProbeBluffFrequencyAfterTurnXX',
    );
  });

  it('encodes turn-check-check in precedingStreetSequence', () => {
    expect(lagOverbluffRiverProbeScenario.gameState.precedingStreetSequence).toContain(
      'turn:checkCheck',
    );
  });

  it('villainTendency observedRate matches anchor evidence.pointEstimate (0.62)', () => {
    const rate = lagOverbluffRiverProbeScenario.villainTendency.observedRates
      .riverProbeBluffFrequencyAfterTurnXX.rate;
    expect(rate).toBeCloseTo(EAL_SEED_02_ANCHOR.evidence.pointEstimate, 2);
  });
});

describe('lagOverbluffRiverProbeScenario — Commit 2 runner integration', () => {
  const stubProduceAssumptions = () => [
    {
      id: 'a-2',
      claim: { predicate: 'riverProbeBluffFrequencyAfterTurnXX' },
      consequence: { expectedDividend: { mean: 0.42 } },
      operator: { currentDial: 0.68 },
    },
  ];

  const stubPredicateRunner = () => ({
    scenarioName: 'stub',
    passed: true,
    predictedDividend: 0.42,
    simulatedDividend: 0.42,
    relativeError: 0.0,
    honestyCheck: { passed: true, predictedAtZeroDial: 0, simulated: 0 },
    firings: 10000,
  });

  it('passes schema + GTO-deferred (non-MDF method)', () => {
    const result = runAnchorScenario({
      ...lagOverbluffRiverProbeScenario,
      produceAssumptions: stubProduceAssumptions,
      runPredicateScenario: stubPredicateRunner,
    });
    expect(result.schemaOk).toBe(true);
    expect(result.gtoOk).toBe(true);
    expect(result.gto.deferred).toBe(true);
    expect(result.gto.method).toBe('pot-odds-equilibrium');
    expect(result.passed).toBe(true);
  });
});
