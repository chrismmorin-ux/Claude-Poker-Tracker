import { describe, it, expect } from 'vitest';
import { computeTrialCount } from '../useLiveActionAdvisor';

describe('computeTrialCount', () => {
  // -------------------------------------------------------------------------
  // Priority 1: river returns 500 regardless of other params
  // -------------------------------------------------------------------------

  it('returns 500 for river street', () => {
    expect(computeTrialCount({ street: 'river', spr: 10, activeOpponents: 1, sampleSize: 50 })).toBe(500);
  });

  it('river takes priority over multiway opponents', () => {
    expect(computeTrialCount({ street: 'river', activeOpponents: 3, spr: 10, sampleSize: 50 })).toBe(500);
  });

  it('river takes priority over low SPR', () => {
    expect(computeTrialCount({ street: 'river', spr: 1, sampleSize: 50 })).toBe(500);
  });

  it('river takes priority over low sample size', () => {
    expect(computeTrialCount({ street: 'river', sampleSize: 2 })).toBe(500);
  });

  // -------------------------------------------------------------------------
  // Priority 2: low SPR returns 500
  // -------------------------------------------------------------------------

  it('returns 500 when spr < 4', () => {
    expect(computeTrialCount({ spr: 3, street: 'flop', activeOpponents: 1, sampleSize: 50 })).toBe(500);
  });

  it('returns 500 when spr is exactly 0', () => {
    expect(computeTrialCount({ spr: 0, street: 'turn', activeOpponents: 1, sampleSize: 50 })).toBe(500);
  });

  it('returns 800 for MEDIUM SPR zone (spr=4)', () => {
    expect(computeTrialCount({ spr: 4, street: 'flop', activeOpponents: 1, sampleSize: 50 })).toBe(800);
  });

  it('low SPR takes priority over multiway opponents', () => {
    expect(computeTrialCount({ spr: 2, street: 'turn', activeOpponents: 4, sampleSize: 50 })).toBe(500);
  });

  it('low SPR takes priority over low sample size', () => {
    expect(computeTrialCount({ spr: 1, street: 'turn', sampleSize: 3 })).toBe(500);
  });

  it('skips SPR check when spr is null', () => {
    // null spr should not trigger the low-SPR branch
    expect(computeTrialCount({ spr: null, street: 'flop', activeOpponents: 1, sampleSize: 50 })).toBe(1000);
  });

  // -------------------------------------------------------------------------
  // Priority 3: low sample size returns 500
  // -------------------------------------------------------------------------

  it('returns 500 when sampleSize < 10', () => {
    expect(computeTrialCount({ sampleSize: 9, street: 'flop', spr: 10, activeOpponents: 1 })).toBe(500);
  });

  it('returns 500 when sampleSize is 0', () => {
    expect(computeTrialCount({ sampleSize: 0, street: 'flop', spr: 10, activeOpponents: 1 })).toBe(500);
  });

  it('does NOT return 500 when sampleSize is exactly 10', () => {
    expect(computeTrialCount({ sampleSize: 10, street: 'flop', spr: 10, activeOpponents: 1 })).toBe(1000);
  });

  it('low sample size takes priority over multiway opponents', () => {
    expect(computeTrialCount({ sampleSize: 5, street: 'flop', spr: 10, activeOpponents: 5 })).toBe(500);
  });

  it('skips sample size check when sampleSize is null', () => {
    // null sampleSize should not trigger the low-sample branch
    expect(computeTrialCount({ sampleSize: null, street: 'flop', spr: 10, activeOpponents: 1 })).toBe(1000);
  });

  // -------------------------------------------------------------------------
  // Priority 4: multiway (activeOpponents >= 3) returns 1500
  // -------------------------------------------------------------------------

  it('returns 1500 when activeOpponents >= 3', () => {
    expect(computeTrialCount({ activeOpponents: 3, street: 'flop', spr: 10, sampleSize: 50 })).toBe(1500);
  });

  it('returns 1500 when activeOpponents is 5', () => {
    expect(computeTrialCount({ activeOpponents: 5, street: 'turn', spr: 10, sampleSize: 50 })).toBe(1500);
  });

  it('does NOT return 1500 when activeOpponents is 2', () => {
    expect(computeTrialCount({ activeOpponents: 2, street: 'flop', spr: 10, sampleSize: 50 })).toBe(1000);
  });

  it('skips opponents check when activeOpponents is null', () => {
    expect(computeTrialCount({ activeOpponents: null, street: 'flop', spr: 10, sampleSize: 50 })).toBe(1000);
  });

  // -------------------------------------------------------------------------
  // Default: 1000
  // -------------------------------------------------------------------------

  it('returns 1000 for standard heads-up postflop scenario', () => {
    expect(computeTrialCount({ street: 'flop', spr: 8, activeOpponents: 1, sampleSize: 30 })).toBe(1000);
  });

  it('returns 800 for turn with MEDIUM SPR zone (spr=6)', () => {
    expect(computeTrialCount({ street: 'turn', spr: 6, activeOpponents: 2, sampleSize: 25 })).toBe(800);
  });

  it('returns 1000 when called with empty object', () => {
    expect(computeTrialCount({})).toBe(1000);
  });

  it('returns 1000 when called with no arguments', () => {
    expect(computeTrialCount()).toBe(1000);
  });
});
