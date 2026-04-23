import { describe, it, expect } from 'vitest';
import {
  produceAssumptions,
  PRODUCTION_RECIPES,
  __testing__,
  finalizeStabilityComposite,
} from '../assumptionProducer';
import { validateAssumption } from '../validator';

// ───────────────────────────────────────────────────────────────────────────
// Test helpers — construct synthetic VillainTendencyInput
// ───────────────────────────────────────────────────────────────────────────

const makeFishTendency = (overrides = {}) => ({
  villainId: 'v42',
  style: 'Fish',
  totalObservations: 54,
  adaptationObservations: 8,
  observedRates: {
    foldToRiverBet: { rate: 0.17, n: 52, lastUpdated: '2026-04-22T19:15:00Z' },
    foldToCbet: { rate: 0.35, n: 45, lastUpdated: '2026-04-22T12:00:00Z' },
    callFrequencyVsSmallBet: { rate: 0.71, n: 48, lastUpdated: '2026-04-22T15:00:00Z' },
  },
  ...overrides,
});

const makeNitTendency = (overrides = {}) => ({
  villainId: 'v99',
  style: 'Nit',
  totalObservations: 71,
  adaptationObservations: 3,
  observedRates: {
    foldToCbet: { rate: 0.78, n: 71, lastUpdated: '2026-04-22T10:00:00Z' },
  },
  ...overrides,
});

const riverState = () => ({
  street: 'river',
  position: 'OOP',
  texture: 'any',
  spr: 4,
  heroIsAggressor: true,
  nodeId: 'river-v-call',
});

const dryFlopIPState = () => ({
  street: 'flop',
  position: 'IP',
  texture: 'dry',
  spr: 6,
  heroIsAggressor: true,
  nodeId: 'flop-cbet',
});

const pairedTurnState = () => ({
  street: 'turn',
  position: 'OOP',
  texture: 'paired',
  spr: 5,
  heroIsAggressor: true,
  nodeId: 'turn-bet',
});

// ───────────────────────────────────────────────────────────────────────────
// produceAssumptions — smoke
// ───────────────────────────────────────────────────────────────────────────

describe('produceAssumptions — smoke', () => {
  it('returns empty array for null tendency', () => {
    expect(produceAssumptions(null, riverState())).toEqual([]);
    expect(produceAssumptions(undefined, riverState())).toEqual([]);
  });

  it('returns empty array for null gameState', () => {
    expect(produceAssumptions(makeFishTendency(), null)).toEqual([]);
  });

  it('returns empty array when no recipe is applicable', () => {
    // Preflop street doesn't match any Commit-4 recipe
    const result = produceAssumptions(makeFishTendency(), { street: 'preflop', heroIsAggressor: true });
    expect(result).toEqual([]);
  });

  it('produces at least one assumption for applicable river state with fish tendency', () => {
    const result = produceAssumptions(makeFishTendency(), riverState());
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].claim.predicate).toBe('foldToRiverBet');
  });
});

describe('produceAssumptions — Canonical Example 1 (river bluff pruning)', () => {
  let assumption;

  it('emits a VillainAssumption for Fish river tendency', () => {
    const results = produceAssumptions(makeFishTendency(), riverState());
    expect(results.length).toBeGreaterThan(0);
    assumption = results.find((a) => a.claim.predicate === 'foldToRiverBet');
    expect(assumption).toBeDefined();
  });

  it('has schema v1.1 shape', () => {
    assumption = produceAssumptions(makeFishTendency(), riverState())
      .find((a) => a.claim.predicate === 'foldToRiverBet');
    expect(assumption.schemaVersion).toBe('1.1');
    expect(assumption.id).toMatch(/^v42:foldToRiverBet@/);
    expect(assumption.villainId).toBe('v42');
  });

  it('passes full schema validation', () => {
    assumption = produceAssumptions(makeFishTendency(), riverState())
      .find((a) => a.claim.predicate === 'foldToRiverBet');
    const result = validateAssumption(assumption);
    expect(result.ok).toBe(true);
    if (!result.ok) console.log('validation errors:', result.errors);
  });

  it('has bluff-prune deviation type', () => {
    assumption = produceAssumptions(makeFishTendency(), riverState())
      .find((a) => a.claim.predicate === 'foldToRiverBet');
    expect(assumption.consequence.deviationType).toBe('bluff-prune');
  });

  it('zero-dial operator produces no distribution shift (honesty check)', () => {
    assumption = produceAssumptions(makeFishTendency(), riverState())
      .find((a) => a.claim.predicate === 'foldToRiverBet');
    // Bluff-prune operator has zero deltas by design (range-level change, not action-level)
    const delta = assumption.operator.transform.actionDistributionDelta;
    expect(delta.fold).toBe(0);
    expect(delta.call).toBe(0);
    expect(delta.raise).toBe(0);
  });

  it('posteriorConfidence reflects evidence vs claim', () => {
    assumption = produceAssumptions(makeFishTendency(), riverState())
      .find((a) => a.claim.predicate === 'foldToRiverBet');
    // Fish with observed 17% fold rate + threshold 25% → posterior should favor claim
    expect(assumption.evidence.posteriorConfidence).toBeGreaterThan(0.5);
  });

  it('narrative cites observed rate and sample size', () => {
    assumption = produceAssumptions(makeFishTendency(), riverState())
      .find((a) => a.claim.predicate === 'foldToRiverBet');
    expect(assumption.narrative.humanStatement).toMatch(/17%/);
    expect(assumption.narrative.humanStatement).toMatch(/n=52/);
  });
});

describe('produceAssumptions — Canonical Example 3 (cbet range-bet vs Nit)', () => {
  it('emits for Nit on dry IP flop', () => {
    const results = produceAssumptions(makeNitTendency(), dryFlopIPState());
    const assumption = results.find((a) => a.claim.predicate === 'foldToCbet');
    expect(assumption).toBeDefined();
    expect(assumption.consequence.deviationType).toBe('range-bet');
  });

  it('passes schema validation', () => {
    const assumption = produceAssumptions(makeNitTendency(), dryFlopIPState())
      .find((a) => a.claim.predicate === 'foldToCbet');
    expect(validateAssumption(assumption).ok).toBe(true);
  });

  it('operator has non-zero deltas summing to 0 (schema §1.7)', () => {
    const assumption = produceAssumptions(makeNitTendency(), dryFlopIPState())
      .find((a) => a.claim.predicate === 'foldToCbet');
    const delta = assumption.operator.transform.actionDistributionDelta;
    const sum = (delta.fold ?? 0) + (delta.call ?? 0) + (delta.raise ?? 0);
    expect(Math.abs(sum)).toBeLessThan(0.001);
  });
});

describe('produceAssumptions — Canonical Example 2 (thin value vs station)', () => {
  it('emits for Fish on paired turn', () => {
    const results = produceAssumptions(makeFishTendency(), pairedTurnState());
    const assumption = results.find((a) => a.claim.predicate === 'thinValueFrequency');
    expect(assumption).toBeDefined();
    expect(assumption.consequence.deviationType).toBe('value-expand');
  });

  it('passes schema validation', () => {
    const assumption = produceAssumptions(makeFishTendency(), pairedTurnState())
      .find((a) => a.claim.predicate === 'thinValueFrequency');
    expect(validateAssumption(assumption).ok).toBe(true);
  });
});

describe('produceAssumptions — quality gate integration', () => {
  it('sorts results descending by composite', () => {
    const results = produceAssumptions(makeFishTendency(), riverState());
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].quality.composite).toBeGreaterThanOrEqual(results[i].quality.composite);
    }
  });

  it('filters out below-threshold by default', () => {
    const weakTendency = {
      ...makeFishTendency(),
      observedRates: {
        foldToRiverBet: { rate: 0.24, n: 10, lastUpdated: '2026-04-22T12:00:00Z' },
      },
    };
    const results = produceAssumptions(weakTendency, riverState());
    // With only 10 samples + rate right at threshold, posterior is uncertain
    // — we expect few-to-zero actionable outputs.
    for (const a of results) {
      expect(a.quality.actionableInDrill).toBe(true);
    }
  });

  it('includes below-threshold when includeBelowThreshold=true (research tier, schema §7.3)', () => {
    const weakTendency = {
      ...makeFishTendency(),
      observedRates: {
        foldToRiverBet: { rate: 0.24, n: 5, lastUpdated: '2026-04-22T12:00:00Z' },
      },
    };
    const withBelow = produceAssumptions(weakTendency, riverState(), {}, { includeBelowThreshold: true });
    expect(withBelow.length).toBeGreaterThan(0); // includes the low-n spot
  });

  it('computes currentDial from quality composite', () => {
    const assumption = produceAssumptions(makeFishTendency(), riverState())
      .find((a) => a.claim.predicate === 'foldToRiverBet');
    expect(assumption.operator.currentDial).toBeGreaterThan(0.3);
    expect(assumption.operator.currentDial).toBeLessThanOrEqual(0.9);
  });
});

describe('PRODUCTION_RECIPES registry', () => {
  it('ships three recipes in Commit 4', () => {
    expect(Object.keys(PRODUCTION_RECIPES)).toEqual(
      expect.arrayContaining(['foldToRiverBet', 'foldToCbet', 'thinValueFrequency']),
    );
  });

  it('is frozen', () => {
    expect(() => {
      PRODUCTION_RECIPES.foldToTurnBarrel = {};
    }).toThrow();
  });
});

describe('finalizeStabilityComposite', () => {
  it('computes geometric mean × coverage penalty', () => {
    const s = finalizeStabilityComposite({
      acrossSessions: 0.8,
      acrossTextures: 0.8,
      acrossStackDepths: 0.8,
      acrossStreetContext: 0.8,
    });
    // 4 non-null subscores → coverage = 1; geo mean = 0.8.
    expect(s.compositeScore).toBeCloseTo(0.8, 2);
    expect(s.nonNullSubscoreCount).toBe(4);
  });

  it('applies coverage penalty for fewer non-null subscores', () => {
    const s = finalizeStabilityComposite({
      acrossSessions: 0.8,
      acrossTextures: null,
      acrossStackDepths: null,
      acrossStreetContext: null,
    });
    // 1 non-null → coverage = √(1/4) = 0.5 → composite ≈ 0.4.
    expect(s.compositeScore).toBeCloseTo(0.4, 2);
    expect(s.nonNullSubscoreCount).toBe(1);
  });

  it('returns null composite when no subscores are non-null', () => {
    const s = finalizeStabilityComposite({
      acrossSessions: null,
      acrossTextures: null,
      acrossStackDepths: null,
      acrossStreetContext: null,
    });
    expect(s.compositeScore).toBeNull();
    expect(s.nonNullSubscoreCount).toBe(0);
  });
});

describe('__testing__ helpers — Bayesian math', () => {
  const { normalCDF, betaStandardDeviation, stylePriorForFoldRate } = __testing__;

  it('normalCDF(0) = 0.5', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it('normalCDF is monotonic', () => {
    expect(normalCDF(-2)).toBeLessThan(normalCDF(-1));
    expect(normalCDF(-1)).toBeLessThan(normalCDF(0));
    expect(normalCDF(0)).toBeLessThan(normalCDF(1));
    expect(normalCDF(1)).toBeLessThan(normalCDF(2));
  });

  it('normalCDF edge cases', () => {
    expect(normalCDF(10)).toBeCloseTo(1, 4);
    expect(normalCDF(-10)).toBeCloseTo(0, 4);
  });

  it('betaStandardDeviation for symmetric Beta(10, 10) ≈ 0.109', () => {
    const sd = betaStandardDeviation(10, 10);
    expect(sd).toBeCloseTo(0.109, 2);
  });

  it('stylePriorForFoldRate returns valid Beta for each style', () => {
    for (const style of ['Fish', 'Nit', 'LAG', 'TAG', 'Unknown']) {
      const prior = stylePriorForFoldRate(style, 'flop');
      expect(prior.alpha).toBeGreaterThan(0);
      expect(prior.beta).toBeGreaterThan(0);
      expect(['style', 'population']).toContain(prior.type);
    }
  });
});
