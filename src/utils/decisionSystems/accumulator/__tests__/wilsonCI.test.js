import { describe, it, expect } from 'vitest';
import { wilsonInterval } from '../wilsonCI';
import { Z_95 } from '../betaPosterior';

describe('wilsonInterval', () => {
  it('returns {lower:0, upper:0, mean:0} for trials=0', () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 0, mean: 0 });
  });

  it('returns {lower:0, upper:0, mean:0} for negative trials', () => {
    expect(wilsonInterval(0, -5)).toEqual({ lower: 0, upper: 0, mean: 0 });
  });

  it('handles 50/100 → mean = 0.5 + symmetric CI', () => {
    const ci = wilsonInterval(50, 100);
    expect(ci.mean).toBe(0.5);
    expect(ci.lower).toBeGreaterThan(0.4);
    expect(ci.upper).toBeLessThan(0.6);
    // Wilson interval is asymmetric in general; at p̂=0.5 it's symmetric.
    expect(ci.lower + ci.upper).toBeCloseTo(1, 5);
  });

  it('shrinks as n grows (more data → tighter interval)', () => {
    const ciSmall = wilsonInterval(15, 30);
    const ciBig = wilsonInterval(150, 300);
    const widthSmall = ciSmall.upper - ciSmall.lower;
    const widthBig = ciBig.upper - ciBig.lower;
    expect(widthBig).toBeLessThan(widthSmall);
  });

  it('clamps interval to [0, 1] at boundary p=0', () => {
    const ci = wilsonInterval(0, 30);
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
    expect(ci.mean).toBe(0);
  });

  it('clamps interval to [0, 1] at boundary p=1', () => {
    const ci = wilsonInterval(30, 30);
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
    expect(ci.mean).toBe(1);
  });

  it('clamps successes > trials down to trials (defense in depth)', () => {
    const ci = wilsonInterval(50, 30);
    expect(ci.mean).toBe(1);
  });

  it('clamps negative successes up to 0 (defense in depth)', () => {
    const ci = wilsonInterval(-5, 30);
    expect(ci.mean).toBe(0);
  });

  it('defaults to Z_95 when no z is provided', () => {
    const ciDefault = wilsonInterval(50, 100);
    const ciExplicit = wilsonInterval(50, 100, Z_95);
    expect(ciDefault).toEqual(ciExplicit);
  });

  it('respects custom z (1.96 produces wider interval than Z_95)', () => {
    // 1.96 > Z_95 (1.959963984540054), so 1.96 → SLIGHTLY wider interval.
    // The constants differ at the 5th decimal so the width difference is
    // small but the direction is reliable. Used to verify the canonical
    // Z_95 actually flows through to the math (not just inlined 1.96).
    const ciCanonical = wilsonInterval(50, 100, Z_95);
    const ciOld = wilsonInterval(50, 100, 1.96);
    const widthCanonical = ciCanonical.upper - ciCanonical.lower;
    const widthOld = ciOld.upper - ciOld.lower;
    expect(widthOld).toBeGreaterThan(widthCanonical);
  });

  it('matches existing skillAssessment shape: { lower, upper, mean }', () => {
    const ci = wilsonInterval(15, 30);
    expect(Object.keys(ci).sort()).toEqual(['lower', 'mean', 'upper']);
  });
});
