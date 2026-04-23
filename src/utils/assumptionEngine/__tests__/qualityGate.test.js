import { describe, it, expect } from 'vitest';
import {
  gateAssumption,
  computeComposite,
  determineActionability,
} from '../qualityGate';
import { canonicalAssumption } from './fixtures';

describe('gateAssumption — villain-side drill surface', () => {
  it('canonical fixture passes drill gate', () => {
    const result = gateAssumption(canonicalAssumption(), 'drill');
    expect(result.passed).toBe(true);
  });

  it('confidence below 0.80 fails', () => {
    const a = canonicalAssumption();
    a.evidence.posteriorConfidence = 0.75;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('confidence-below-threshold');
  });

  it('stability below 0.70 fails', () => {
    const a = canonicalAssumption();
    a.stability.compositeScore = 0.65;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('stability-below-threshold');
  });

  it('stability compositeScore null fails with insufficient-stability-coverage', () => {
    const a = canonicalAssumption();
    a.stability.compositeScore = null;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('insufficient-stability-coverage');
  });

  it('drill surface allows recognizability=0.40', () => {
    const a = canonicalAssumption();
    a.recognizability.score = 0.40;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(true);
  });

  it('drill surface rejects recognizability=0.39', () => {
    const a = canonicalAssumption();
    a.recognizability.score = 0.39;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('recognizability-below-threshold');
  });

  it('asymmetricPayoff below 0.30 fails', () => {
    const a = canonicalAssumption();
    a.counterExploit.asymmetricPayoff = 0.25;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('asymmetric-payoff-below-threshold');
  });

  it('Sharpe below 1.0 fails with low-sharpe reason', () => {
    const a = canonicalAssumption();
    a.consequence.expectedDividend.sharpe = 0.9;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('low-sharpe');
  });
});

describe('gateAssumption — villain-side live surface', () => {
  it('canonical fixture passes live gate', () => {
    const result = gateAssumption(canonicalAssumption(), 'live');
    expect(result.passed).toBe(true);
  });

  it('live surface rejects recognizability=0.59 (drill would accept)', () => {
    const a = canonicalAssumption();
    a.recognizability.score = 0.59;
    expect(gateAssumption(a, 'drill').passed).toBe(true);
    expect(gateAssumption(a, 'live').passed).toBe(false);
  });

  it('live surface accepts recognizability=0.60', () => {
    const a = canonicalAssumption();
    a.recognizability.score = 0.60;
    expect(gateAssumption(a, 'live').passed).toBe(true);
  });
});

describe('gateAssumption — hero-side (I-AE-2)', () => {
  const heroSide = () => {
    const a = canonicalAssumption();
    a.operator.target = 'hero';
    a.villainId = '_hero';
    return a;
  };

  it('hero-side NEVER passes live gate (I-AE-2)', () => {
    const a = heroSide();
    // Even with all villain-side gates passing, live must refuse.
    const result = gateAssumption(a, 'live');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('hero-side-live-rendering-forbidden');
  });

  it('hero-side drill uses relaxed thresholds', () => {
    const a = heroSide();
    a.evidence.posteriorConfidence = 0.72; // between hero 0.70 and villain 0.80
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(true);
  });

  it('hero-side drill rejects below 0.70 confidence', () => {
    const a = heroSide();
    a.evidence.posteriorConfidence = 0.69;
    const result = gateAssumption(a, 'drill');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('confidence-below-threshold');
  });

  it('hero-side drill allows recognizability=0.50', () => {
    const a = heroSide();
    a.recognizability.score = 0.50;
    expect(gateAssumption(a, 'drill').passed).toBe(true);
  });

  it('hero-side drill rejects recognizability=0.49', () => {
    const a = heroSide();
    a.recognizability.score = 0.49;
    expect(gateAssumption(a, 'drill').passed).toBe(false);
  });
});

describe('gateAssumption — edge cases', () => {
  it('rejects missing assumption', () => {
    expect(gateAssumption(null, 'drill').passed).toBe(false);
    expect(gateAssumption(undefined, 'drill').reason).toBe('assumption-missing');
  });

  it('rejects invalid surface', () => {
    const result = gateAssumption(canonicalAssumption(), 'sidebar');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('invalid-surface');
  });
});

describe('computeComposite', () => {
  it('returns 0 for null input', () => {
    expect(computeComposite(null)).toBe(0);
  });

  it('returns value in [0, 1]', () => {
    const composite = computeComposite({
      confidence: 0.9,
      stability: 0.8,
      recognizability: 0.7,
      asymmetricPayoff: 0.45,
      sharpe: 1.5,
    });
    expect(composite).toBeGreaterThanOrEqual(0);
    expect(composite).toBeLessThanOrEqual(1);
  });

  it('monotonic in confidence (all else held)', () => {
    const base = { stability: 0.8, recognizability: 0.7, asymmetricPayoff: 0.4, sharpe: 1.2 };
    const low = computeComposite({ ...base, confidence: 0.5 });
    const high = computeComposite({ ...base, confidence: 0.95 });
    expect(high).toBeGreaterThan(low);
  });

  it('monotonic in payoff (all else held)', () => {
    const base = { confidence: 0.85, stability: 0.8, recognizability: 0.7, sharpe: 1.2 };
    const low = computeComposite({ ...base, asymmetricPayoff: 0.1 });
    const high = computeComposite({ ...base, asymmetricPayoff: 2.0 });
    expect(high).toBeGreaterThan(low);
  });

  it('returns 0 when any dimension is 0 — but tiny floor lets near-zero contribute', () => {
    const composite = computeComposite({
      confidence: 0,
      stability: 0.8,
      recognizability: 0.7,
      asymmetricPayoff: 0.4,
      sharpe: 1.2,
    });
    // With the small floor, confidence=0 doesn't collapse to 0 — but composite still low.
    expect(composite).toBeLessThan(0.2);
  });
});

describe('determineActionability — full pipeline', () => {
  it('canonical fixture is actionable for both surfaces', () => {
    const result = determineActionability(canonicalAssumption());
    expect(result.actionableInDrill).toBe(true);
    expect(result.actionableLive).toBe(true);
    expect(result.actionable).toBe(true);
    expect(result.composite).toBeGreaterThan(0.5);
  });

  it('hero-side has actionableLive=false always', () => {
    const a = canonicalAssumption();
    a.operator.target = 'hero';
    const result = determineActionability(a);
    expect(result.actionableLive).toBe(false);
    // Drill may still pass with relaxed hero-side thresholds
  });

  it('borderline recognizability (0.50) is drill-actionable only', () => {
    const a = canonicalAssumption();
    a.recognizability.score = 0.50;
    const result = determineActionability(a);
    expect(result.actionableInDrill).toBe(true);
    expect(result.actionableLive).toBe(false);
  });

  it('returns reason for failed gates', () => {
    const a = canonicalAssumption();
    a.evidence.posteriorConfidence = 0.5;
    const result = determineActionability(a);
    expect(result.reason).toBeDefined();
    expect(result.actionableInDrill).toBe(false);
  });
});
