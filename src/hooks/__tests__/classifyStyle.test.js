import { describe, it, expect } from 'vitest';
import { classifyStyle } from '../usePlayerTendencies';

const makePct = (vpip, pfr, af = null, sampleSize = 50) => ({
  vpip, pfr, af, sampleSize,
});

describe('classifyStyle', () => {
  it('returns null for insufficient sample', () => {
    expect(classifyStyle(makePct(30, 20, 1.5, 10))).toBeNull();
  });

  it('returns null for null vpip/pfr', () => {
    expect(classifyStyle({ vpip: null, pfr: null, af: null, sampleSize: 50 })).toBeNull();
  });

  it('classifies Fish (vpip > 40)', () => {
    expect(classifyStyle(makePct(45, 10))).toBe('Fish');
    expect(classifyStyle(makePct(55, 25))).toBe('Fish');
  });

  it('classifies LAG (vpip > 30, pfr > 20)', () => {
    expect(classifyStyle(makePct(35, 25))).toBe('LAG');
  });

  it('classifies LP (vpip > 30, pfr < 10)', () => {
    expect(classifyStyle(makePct(35, 5))).toBe('LP');
  });

  it('classifies Nit (vpip < 15, pfr < 10)', () => {
    expect(classifyStyle(makePct(10, 5))).toBe('Nit');
  });

  it('classifies Reg (vpip 20-30, pfr 15-25, af > 1.5)', () => {
    expect(classifyStyle(makePct(25, 20, 2.0))).toBe('Reg');
    expect(classifyStyle(makePct(22, 18, 1.8))).toBe('Reg');
  });

  it('classifies TAG (vpip 15-25, pfr > 15) when not Reg', () => {
    // No AF -> can't be Reg, falls to TAG
    expect(classifyStyle(makePct(20, 18, null))).toBe('TAG');
    // AF too low -> can't be Reg, falls to TAG
    expect(classifyStyle(makePct(20, 18, 1.2))).toBe('TAG');
  });

  it('classifies TAG for moderate raisers (vpip 15-30, pfr 10-15)', () => {
    expect(classifyStyle(makePct(20, 12))).toBe('TAG');
    expect(classifyStyle(makePct(28, 14))).toBe('TAG');
  });

  it('returns Unknown for unclassifiable profiles', () => {
    // vpip 15, pfr 8 — doesn't match any bucket
    expect(classifyStyle(makePct(15, 8))).toBe('Unknown');
  });

  it('vpip=30 boundary is not Fish or LAG (requires >30)', () => {
    // vpip=30 with pfr=20 — should be TAG (merged rule: vpip 15-30, pfr 10-25)
    expect(classifyStyle(makePct(30, 20, null))).toBe('TAG');
    // vpip=30 with pfr=5 — not LP (requires >30), not TAG (pfr < 10)
    expect(classifyStyle(makePct(30, 5))).toBe('Unknown');
  });

  it('merged TAG rule covers both old ranges', () => {
    // Old range 1: vpip 15-25, pfr > 15 (now pfr 10-25)
    expect(classifyStyle(makePct(20, 18, null))).toBe('TAG');
    // Old range 2: vpip 15-30, pfr 10-15
    expect(classifyStyle(makePct(25, 12))).toBe('TAG');
    // New merged coverage: vpip=28, pfr=22 (was gap between old rules)
    expect(classifyStyle(makePct(28, 22, null))).toBe('TAG');
    // Edge: vpip=15, pfr=10
    expect(classifyStyle(makePct(15, 10))).toBe('TAG');
    // Edge: vpip=30, pfr=25
    expect(classifyStyle(makePct(30, 25, null))).toBe('TAG');
  });
});
