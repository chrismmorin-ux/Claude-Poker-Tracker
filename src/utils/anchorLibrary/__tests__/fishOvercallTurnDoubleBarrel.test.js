/**
 * fishOvercallTurnDoubleBarrel.test.js — EAL-SEED-03 scenario integration test
 */

import { describe, it, expect } from 'vitest';

import { runAnchorScenario } from '../__sim__/anchorScenarioRunner';
import { validateAnchor } from '../validateAnchor';
import {
  EAL_SEED_03_ANCHOR,
  fishOvercallTurnDoubleBarrelScenario,
} from '../__sim__/scenarios/fishOvercallTurnDoubleBarrel';

describe('EAL-SEED-03 anchor — schema integrity', () => {
  it('passes validateAnchor', () => {
    const result = validateAnchor(EAL_SEED_03_ANCHOR);
    expect(result.ok).toBe(true);
  });

  it('has overcall polarity', () => {
    expect(EAL_SEED_03_ANCHOR.polarity).toBe('overcall');
  });

  it('references PP-03 (indirect usage — Gate 2 flagged)', () => {
    expect(EAL_SEED_03_ANCHOR.perceptionPrimitiveIds).toEqual(['PP-03']);
  });

  it('declares pot-odds-equilibrium GTO method', () => {
    expect(EAL_SEED_03_ANCHOR.gtoBaseline.method).toBe('pot-odds-equilibrium');
  });

  it('has 2-street line sequence (flop cbet + turn double-barrel)', () => {
    expect(EAL_SEED_03_ANCHOR.lineSequence).toHaveLength(2);
    expect(EAL_SEED_03_ANCHOR.lineSequence.map((s) => s.street)).toEqual(['flop', 'turn']);
  });

  it('evDecomposition is 50/50 (dual-source)', () => {
    expect(EAL_SEED_03_ANCHOR.evDecomposition.statAttributable).toBeCloseTo(0.50, 2);
    expect(EAL_SEED_03_ANCHOR.evDecomposition.perceptionAttributable).toBeCloseTo(0.50, 2);
  });
});

describe('fishOvercallTurnDoubleBarrelScenario config', () => {
  it('villainTendency observedRate matches anchor (0.76)', () => {
    const rate = fishOvercallTurnDoubleBarrelScenario.villainTendency.observedRates
      .callVsTurnDoubleBarrelPaired.rate;
    expect(rate).toBeCloseTo(EAL_SEED_03_ANCHOR.evidence.pointEstimate, 2);
  });

  it('gameState encodes hero-cbet-flop + hero-aggressor + paired-texture', () => {
    expect(fishOvercallTurnDoubleBarrelScenario.gameState.texture).toBe('paired');
    expect(fishOvercallTurnDoubleBarrelScenario.gameState.heroIsAggressor).toBe(true);
    expect(fishOvercallTurnDoubleBarrelScenario.gameState.precedingStreetSequence).toContain(
      'flop:villainCall',
    );
  });

  it('targets callVsTurnDoubleBarrelPaired predicate', () => {
    expect(fishOvercallTurnDoubleBarrelScenario.targetPredicate).toBe(
      'callVsTurnDoubleBarrelPaired',
    );
  });
});

describe('fishOvercallTurnDoubleBarrelScenario — Commit 2 runner integration', () => {
  const stubProduceAssumptions = () => [{
    id: 'a-3',
    claim: { predicate: 'callVsTurnDoubleBarrelPaired' },
    consequence: { expectedDividend: { mean: 0.31 } },
    operator: { currentDial: 0.72 },
  }];

  const stubPredicateRunner = () => ({
    scenarioName: 'stub',
    passed: true,
    predictedDividend: 0.31,
    simulatedDividend: 0.31,
    relativeError: 0.0,
    honestyCheck: { passed: true, predictedAtZeroDial: 0, simulated: 0 },
    firings: 10000,
  });

  it('passes schema + GTO-deferred', () => {
    const result = runAnchorScenario({
      ...fishOvercallTurnDoubleBarrelScenario,
      produceAssumptions: stubProduceAssumptions,
      runPredicateScenario: stubPredicateRunner,
    });
    expect(result.schemaOk).toBe(true);
    expect(result.gtoOk).toBe(true);
    expect(result.gto.deferred).toBe(true);
    expect(result.passed).toBe(true);
  });
});
