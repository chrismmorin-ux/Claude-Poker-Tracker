import { describe, it, expect } from 'vitest';
import { computeShapleyContributions, attributionsSumToTotal } from '../attribution';

const makeAssumption = ({ id, solo = 0.5, dial = 0.7, statement = 'observed' } = {}) => ({
  id,
  operator: { currentDial: dial },
  consequence: { expectedDividend: { mean: solo, sd: 0.1, sharpe: 5 } },
  narrative: { humanStatement: statement },
});

describe('computeShapleyContributions — basic', () => {
  it('empty input returns empty array', () => {
    expect(computeShapleyContributions([], 0, 1)).toEqual([]);
    expect(computeShapleyContributions(null, 0, 1)).toEqual([]);
  });

  it('single assumption owns the entire dividend', () => {
    const a = makeAssumption({ id: 'a1', solo: 0.5 });
    const contribs = computeShapleyContributions([a], 0.7, 1.0);
    expect(contribs).toHaveLength(1);
    expect(contribs[0].assumptionId).toBe('a1');
    expect(contribs[0].contributionToDividend).toBeCloseTo(0.7, 4);
    expect(contribs[0].humanStatement).toBe('observed');
  });

  it('zero total dividend → all contributions zero', () => {
    const a = makeAssumption({ id: 'a1' });
    const b = makeAssumption({ id: 'a2' });
    const contribs = computeShapleyContributions([a, b], 0, 1);
    expect(contribs).toHaveLength(2);
    for (const c of contribs) expect(c.contributionToDividend).toBe(0);
  });

  it('blend=0 → all contributions zero (honesty propagation)', () => {
    const a = makeAssumption({ id: 'a1' });
    const contribs = computeShapleyContributions([a], 0.7, 0);
    expect(contribs[0].contributionToDividend).toBe(0);
  });
});

describe('computeShapleyContributions — multi-assumption proportional split', () => {
  it('two equal assumptions split dividend equally', () => {
    const a = makeAssumption({ id: 'a', solo: 0.5, dial: 0.7 });
    const b = makeAssumption({ id: 'b', solo: 0.5, dial: 0.7 });
    const contribs = computeShapleyContributions([a, b], 1.0, 1.0);
    expect(contribs[0].contributionToDividend).toBeCloseTo(0.5, 2);
    expect(contribs[1].contributionToDividend).toBeCloseTo(0.5, 2);
  });

  it('higher-weight assumption gets larger share', () => {
    const big = makeAssumption({ id: 'big', solo: 1.0, dial: 0.9 });
    const small = makeAssumption({ id: 'small', solo: 0.3, dial: 0.5 });
    const contribs = computeShapleyContributions([big, small], 1.0, 1.0);
    const bigContrib = contribs.find((c) => c.assumptionId === 'big').contributionToDividend;
    const smallContrib = contribs.find((c) => c.assumptionId === 'small').contributionToDividend;
    expect(bigContrib).toBeGreaterThan(smallContrib);
  });

  it('contributions sum approximately to total dividend', () => {
    const a = makeAssumption({ id: 'a', solo: 0.5, dial: 0.7 });
    const b = makeAssumption({ id: 'b', solo: 0.3, dial: 0.8 });
    const c = makeAssumption({ id: 'c', solo: 0.4, dial: 0.6 });
    const total = 1.2;
    const contribs = computeShapleyContributions([a, b, c], total, 1.0);
    expect(attributionsSumToTotal(contribs, total)).toBe(true);
  });

  it('all zero-dial assumptions produce zero contributions', () => {
    const a = makeAssumption({ id: 'a', solo: 0.5, dial: 0 });
    const b = makeAssumption({ id: 'b', solo: 0.5, dial: 0 });
    const contribs = computeShapleyContributions([a, b], 1.0, 1.0);
    for (const c of contribs) expect(c.contributionToDividend).toBe(0);
  });

  it('includes humanStatement from each assumption', () => {
    const a = makeAssumption({ id: 'a', statement: 'villain folds too much' });
    const b = makeAssumption({ id: 'b', statement: 'villain calls too wide' });
    const contribs = computeShapleyContributions([a, b], 1.0, 1.0);
    const stmts = contribs.map((c) => c.humanStatement);
    expect(stmts).toContain('villain folds too much');
    expect(stmts).toContain('villain calls too wide');
  });
});

describe('attributionsSumToTotal — diagnostic', () => {
  it('returns true when sum matches within tolerance', () => {
    const citations = [
      { contributionToDividend: 0.33 },
      { contributionToDividend: 0.34 },
      { contributionToDividend: 0.33 },
    ];
    expect(attributionsSumToTotal(citations, 1.0, 0.01)).toBe(true);
  });

  it('returns false when sum diverges', () => {
    const citations = [
      { contributionToDividend: 0.5 },
      { contributionToDividend: 0.5 },
    ];
    expect(attributionsSumToTotal(citations, 1.5)).toBe(false);
  });

  it('handles empty array', () => {
    expect(attributionsSumToTotal([], 0)).toBe(true);
    expect(attributionsSumToTotal([], 1.0)).toBe(false);
  });
});
