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

describe('produceAssumptions — foldToTurnBarrel (double-barrel extension)', () => {
  const makeTurnBarrelTendency = (overrides = {}) => ({
    villainId: 'v-nit',
    style: 'Nit',
    totalObservations: 78,
    adaptationObservations: 4,
    observedRates: {
      foldToTurnBarrel: { rate: 0.74, n: 62, lastUpdated: '2026-04-23T10:00:00Z' },
    },
    ...overrides,
  });

  const turnState = () => ({
    street: 'turn',
    position: 'IP',
    texture: 'any',
    spr: 4,
    heroIsAggressor: true,
    nodeId: 'turn-barrel-spot',
  });

  it('emits for over-folder on turn barrel spot', () => {
    const results = produceAssumptions(makeTurnBarrelTendency(), turnState());
    const assumption = results.find((a) => a.claim.predicate === 'foldToTurnBarrel');
    expect(assumption).toBeDefined();
    expect(assumption.consequence.deviationType).toBe('line-change');
  });

  it('passes schema validation', () => {
    const assumption = produceAssumptions(makeTurnBarrelTendency(), turnState())
      .find((a) => a.claim.predicate === 'foldToTurnBarrel');
    expect(validateAssumption(assumption).ok).toBe(true);
  });

  it('not applicable when hero is not aggressor', () => {
    const results = produceAssumptions(makeTurnBarrelTendency(), { ...turnState(), heroIsAggressor: false });
    expect(results.find((a) => a.claim.predicate === 'foldToTurnBarrel')).toBeUndefined();
  });

  it('not applicable on flop', () => {
    const results = produceAssumptions(makeTurnBarrelTendency(), { ...turnState(), street: 'flop' });
    expect(results.find((a) => a.claim.predicate === 'foldToTurnBarrel')).toBeUndefined();
  });

  it('operator deltas shift fold up when villain over-folds', () => {
    const assumption = produceAssumptions(makeTurnBarrelTendency(), turnState())
      .find((a) => a.claim.predicate === 'foldToTurnBarrel');
    const delta = assumption.operator.transform.actionDistributionDelta;
    expect(delta.fold).toBeGreaterThan(0);
    const sum = (delta.fold ?? 0) + (delta.call ?? 0) + (delta.raise ?? 0);
    expect(Math.abs(sum)).toBeLessThan(0.001);
  });

  it('narrative cites observed rate and sample size', () => {
    const assumption = produceAssumptions(makeTurnBarrelTendency(), turnState())
      .find((a) => a.claim.predicate === 'foldToTurnBarrel');
    expect(assumption.narrative.humanStatement).toMatch(/74%/);
    expect(assumption.narrative.humanStatement).toMatch(/n=62/);
  });

  it('dividend magnitude increases with over-fold extent', () => {
    // Use includeBelowThreshold so we get outputs across the range of observed
    // rates regardless of whether each crosses the quality gate.
    const low = produceAssumptions(
      makeTurnBarrelTendency({
        observedRates: { foldToTurnBarrel: { rate: 0.62, n: 62, lastUpdated: '2026-04-23T10:00:00Z' } },
      }),
      turnState(),
      {},
      { includeBelowThreshold: true },
    ).find((a) => a.claim.predicate === 'foldToTurnBarrel');
    const high = produceAssumptions(
      makeTurnBarrelTendency({
        observedRates: { foldToTurnBarrel: { rate: 0.82, n: 62, lastUpdated: '2026-04-23T10:00:00Z' } },
      }),
      turnState(),
      {},
      { includeBelowThreshold: true },
    ).find((a) => a.claim.predicate === 'foldToTurnBarrel');
    expect(high.consequence.expectedDividend.mean)
      .toBeGreaterThan(low.consequence.expectedDividend.mean);
  });
});

describe('produceAssumptions — cbetFrequency (float vs range-bettor)', () => {
  const makeRangeBettorTendency = (overrides = {}) => ({
    villainId: 'v-lag',
    style: 'LAG',
    totalObservations: 92,
    adaptationObservations: 6,
    observedRates: {
      cbetFrequency: { rate: 0.91, n: 88, lastUpdated: '2026-04-23T10:00:00Z' },
    },
    ...overrides,
  });

  const defenderState = () => ({
    street: 'flop',
    position: 'IP',
    texture: 'any',
    spr: 8,
    heroIsAggressor: false,
    villainIsAggressor: true,
    nodeId: 'flop-defender-spot',
  });

  it('emits for range-bettor on flop defender spot', () => {
    const results = produceAssumptions(makeRangeBettorTendency(), defenderState());
    const assumption = results.find((a) => a.claim.predicate === 'cbetFrequency');
    expect(assumption).toBeDefined();
    expect(assumption.consequence.deviationType).toBe('line-change');
  });

  it('passes schema validation', () => {
    const assumption = produceAssumptions(makeRangeBettorTendency(), defenderState())
      .find((a) => a.claim.predicate === 'cbetFrequency');
    expect(validateAssumption(assumption).ok).toBe(true);
  });

  it('not applicable when hero is aggressor', () => {
    const results = produceAssumptions(makeRangeBettorTendency(), {
      ...defenderState(),
      heroIsAggressor: true,
      villainIsAggressor: false,
    });
    expect(results.find((a) => a.claim.predicate === 'cbetFrequency')).toBeUndefined();
  });

  it('not applicable postflop off-flop', () => {
    const results = produceAssumptions(makeRangeBettorTendency(), { ...defenderState(), street: 'turn' });
    expect(results.find((a) => a.claim.predicate === 'cbetFrequency')).toBeUndefined();
  });

  it('narrative calls villain a range-bettor', () => {
    const assumption = produceAssumptions(makeRangeBettorTendency(), defenderState())
      .find((a) => a.claim.predicate === 'cbetFrequency');
    expect(assumption.narrative.humanStatement).toMatch(/range-bettor/i);
    expect(assumption.narrative.humanStatement).toMatch(/91%/);
  });

  it('LAG style prior boosts confidence for range-cbets', () => {
    const assumption = produceAssumptions(makeRangeBettorTendency(), defenderState())
      .find((a) => a.claim.predicate === 'cbetFrequency');
    expect(assumption.evidence.prior.type).toBe('style');
    // LAG prior is Beta(8, 3) → alpha + beta = 11 (PRIOR_WEIGHT ≈ 10)
    expect(assumption.evidence.prior.alpha + assumption.evidence.prior.beta).toBeCloseTo(11, 0);
  });

  it('Nit style prior lowers expected cbet frequency', () => {
    const nitTendency = {
      ...makeRangeBettorTendency(),
      style: 'Nit',
      observedRates: {
        cbetFrequency: { rate: 0.45, n: 22, lastUpdated: '2026-04-23T10:00:00Z' },
      },
    };
    const results = produceAssumptions(nitTendency, defenderState(), {}, { includeBelowThreshold: true });
    const a = results.find((x) => x.claim.predicate === 'cbetFrequency');
    // Nit + observed 45% cbet → well below the 85% threshold → low confidence
    expect(a.evidence.posteriorConfidence).toBeLessThan(0.2);
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
  it('ships Commit 4 recipes + Session 18 additions', () => {
    expect(Object.keys(PRODUCTION_RECIPES)).toEqual(
      expect.arrayContaining([
        'foldToRiverBet',
        'foldToCbet',
        'thinValueFrequency',
        'foldToTurnBarrel',
        'cbetFrequency',
      ]),
    );
  });

  it('is frozen', () => {
    expect(() => {
      PRODUCTION_RECIPES.somethingNew = {};
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
