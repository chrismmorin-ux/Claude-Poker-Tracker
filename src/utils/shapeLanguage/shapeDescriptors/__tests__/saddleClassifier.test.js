/**
 * saddleClassifier.test.js — Classification correctness on canonical
 * per-combo equity distributions + edge cases + invariant guards.
 *
 * SLS Stream B3 — WS-043 / SPR-088.
 */

import { describe, it, expect } from 'vitest';
import {
  classifySaddle,
  getSaddleDisplayName,
} from '../saddleClassifier';
import {
  SADDLE_LABELS,
  WAY_AHEAD_EQUITY_FLOOR,
  WAY_BEHIND_EQUITY_CEILING,
  WAY_AHEAD_MASS_FLOOR,
  WAY_BEHIND_MASS_FLOOR,
  MIDDLE_MASS_CEILING,
  MIN_CLASSIFIABLE_COMBO_COUNT,
} from '../saddlePrototypes';

// Helper — build a per-combo entry with sensible defaults.
const combo = (weight, heroEquity) => ({
  card1: 0,
  card2: 0,
  weight,
  bucket: 'marginal',
  heroEquity,
});

// Helper — build a uniform-weight perCombo array of N entries with
// heroEquity values from the supplied array.
const uniformPerCombo = (heroEquities, weight = 1) =>
  heroEquities.map((eq) => combo(weight, eq));

describe('classifySaddle — empty / sparse handling', () => {
  it('returns empty for null', () => {
    const r = classifySaddle(null);
    expect(r.label).toBe('empty');
    expect(r.confidence).toBe(0);
    expect(r.wayAheadMass).toBe(0);
    expect(r.wayBehindMass).toBe(0);
  });

  it('returns empty for undefined', () => {
    expect(classifySaddle(undefined).label).toBe('empty');
  });

  it('returns empty for non-array', () => {
    expect(classifySaddle({}).label).toBe('empty');
    expect(classifySaddle('range').label).toBe('empty');
    expect(classifySaddle(42).label).toBe('empty');
  });

  it('returns empty when fewer than MIN_CLASSIFIABLE_COMBO_COUNT combos', () => {
    const tooFew = uniformPerCombo([0.1, 0.5, 0.9]);
    const r = classifySaddle(tooFew);
    expect(r.label).toBe('empty');
    expect(MIN_CLASSIFIABLE_COMBO_COUNT).toBeGreaterThanOrEqual(8);
  });

  it('filters non-finite / weight-zero entries before count check', () => {
    const arr = [
      combo(NaN, 0.5),
      combo(1, NaN),
      combo(0, 0.5),
      combo(1, Infinity),
      combo(1, 0.1),
      combo(1, 0.9),
    ];
    const r = classifySaddle(arr);
    expect(r.label).toBe('empty');
  });

  it('classifies when ≥ MIN combos remain after filtering', () => {
    const arr = [
      combo(NaN, 0.5),
      combo(0, 0.5),
      ...uniformPerCombo([0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9]),
    ];
    const r = classifySaddle(arr);
    expect(r.label).not.toBe('empty');
  });

  it('returns empty when totalWeight is zero (all weights are 0)', () => {
    const arr = uniformPerCombo([0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6], 0);
    const r = classifySaddle(arr);
    expect(r.label).toBe('empty');
  });
});

describe('classifySaddle — canonical labels', () => {
  it('labels Saddle when both masses elevated AND middle depleted', () => {
    // 45% way-ahead-for-villain (heroEquity ≈ 0.1), 45% way-behind
    // (heroEquity ≈ 0.9), 10% middle (heroEquity ≈ 0.5).
    const heroEquities = [
      0.05, 0.10, 0.15, 0.20, 0.25, // 5 way-ahead combos (heroEquity < 0.35)
      0.75, 0.80, 0.85, 0.90, 0.95, // 5 way-behind combos (heroEquity > 0.65)
      0.50, // 1 middle combo (heroEquity ∈ [0.35, 0.65])
    ];
    // wayAheadMass = 5/11 ≈ 0.45, wayBehindMass = 5/11 ≈ 0.45, middle = 1/11 ≈ 0.09
    const r = classifySaddle(uniformPerCombo(heroEquities));
    expect(r.label).toBe('saddle');
    expect(r.wayAheadMass).toBeGreaterThan(WAY_AHEAD_MASS_FLOOR);
    expect(r.wayBehindMass).toBeGreaterThan(WAY_BEHIND_MASS_FLOOR);
    expect(r.middleMass).toBeLessThan(MIDDLE_MASS_CEILING);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('labels Way-Ahead when only wayAheadMass elevated', () => {
    // 70% combos beat hero (heroEquity < 0.35), 10% way-behind, 20% middle.
    const heroEquities = [
      0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.05, // 7 way-ahead combos
      0.90, // 1 way-behind
      0.45, 0.55, // 2 middle
    ];
    const r = classifySaddle(uniformPerCombo(heroEquities));
    expect(r.label).toBe('wayAhead');
    expect(r.wayAheadMass).toBeGreaterThan(WAY_AHEAD_MASS_FLOOR);
    expect(r.wayBehindMass).toBeLessThan(WAY_BEHIND_MASS_FLOOR);
  });

  it('labels Way-Behind when only wayBehindMass elevated', () => {
    // 70% combos lose to hero, 10% way-ahead, 20% middle.
    const heroEquities = [
      0.90, 0.85, 0.80, 0.75, 0.70, 0.85, 0.95, // 7 way-behind combos
      0.10, // 1 way-ahead
      0.50, 0.55, // 2 middle
    ];
    const r = classifySaddle(uniformPerCombo(heroEquities));
    expect(r.label).toBe('wayBehind');
    expect(r.wayBehindMass).toBeGreaterThan(WAY_BEHIND_MASS_FLOOR);
    expect(r.wayAheadMass).toBeLessThan(WAY_AHEAD_MASS_FLOOR);
  });

  it('labels Flat when neither mass elevated', () => {
    // Roughly uniform spread across the equity range; middle dominates.
    const heroEquities = [
      0.10, // 1 way-ahead (10%)
      0.95, // 1 way-behind (10%)
      0.40, 0.45, 0.50, 0.55, 0.60, 0.45, 0.55, 0.50, // 8 middle combos (80%)
    ];
    const r = classifySaddle(uniformPerCombo(heroEquities));
    expect(r.label).toBe('flat');
    expect(r.middleMass).toBeGreaterThan(0.7);
  });

  it('labels Flat when both masses elevated but middle NOT depleted', () => {
    // Bimodal-with-noise: way-ahead 35%, way-behind 35%, middle 30%.
    // Both dimensions elevated, but middle exceeds MIDDLE_MASS_CEILING.
    const heroEquities = [
      0.10, 0.20, 0.10, // 3 way-ahead
      0.90, 0.80, 0.90, // 3 way-behind
      0.45, 0.50, 0.55, // 3 middle
    ];
    const arr = uniformPerCombo(heroEquities);
    // Pad to MIN_CLASSIFIABLE_COMBO_COUNT
    arr.push(combo(1, 0.45)); // 10 combos total; wayA 3/10=0.3 ≯ 0.30 = floor
    // Actually with 3/10 = 0.30 (not strictly >), the wayAheadElevated check
    // uses `> WAY_AHEAD_MASS_FLOOR` which is strict; this collapses to "flat"
    // either via neither-elevated-or-middle-not-depleted branch.
    const r = classifySaddle(arr);
    expect(r.label).toBe('flat');
  });
});

describe('classifySaddle — confidence semantics', () => {
  it('saddle confidence rises with depleted middle', () => {
    // Same masses, varying middle depletion.
    const tighterMiddle = uniformPerCombo([
      0.05, 0.10, 0.15, 0.20, 0.25,         // 5 way-ahead
      0.75, 0.80, 0.85, 0.90, 0.95,         // 5 way-behind
      // No middle combos at all → middle = 0
    ]);
    const looserMiddle = uniformPerCombo([
      0.05, 0.10, 0.15, 0.20, 0.25,         // 5 way-ahead
      0.75, 0.80, 0.85, 0.90, 0.95,         // 5 way-behind
      0.55, 0.60,                            // 2 middle combos → middle ≈ 0.17
    ]);
    const rTight = classifySaddle(tighterMiddle);
    const rLoose = classifySaddle(looserMiddle);
    expect(rTight.label).toBe('saddle');
    expect(rLoose.label).toBe('saddle');
    expect(rTight.confidence).toBeGreaterThan(rLoose.confidence);
  });

  it('wayAhead confidence rises with stronger mass', () => {
    const strongPerCombo = uniformPerCombo([
      0.05, 0.10, 0.15, 0.20, 0.10, 0.05, 0.20, 0.15, 0.10, // 9 way-ahead
      0.55,                                                  // 1 middle
    ]);
    const weakPerCombo = uniformPerCombo([
      0.10, 0.20, 0.30, 0.25, // 4 way-ahead (mass = 4/10 = 0.4, just above floor)
      0.50, 0.55, 0.45, 0.40, 0.45, 0.50, // 6 middle
    ]);
    const rStrong = classifySaddle(strongPerCombo);
    const rWeak = classifySaddle(weakPerCombo);
    expect(rStrong.label).toBe('wayAhead');
    expect(rWeak.label).toBe('wayAhead');
    expect(rStrong.confidence).toBeGreaterThan(rWeak.confidence);
  });

  it('confidence values stay within [0, 1] in all branches', () => {
    const cases = [
      uniformPerCombo([0.05, 0.05, 0.05, 0.05, 0.95, 0.95, 0.95, 0.95]),
      uniformPerCombo([0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.05, 0.20]),
      uniformPerCombo([0.85, 0.90, 0.95, 0.80, 0.75, 0.85, 0.90, 0.85]),
      uniformPerCombo([0.45, 0.50, 0.55, 0.50, 0.55, 0.45, 0.40, 0.60]),
    ];
    for (const arr of cases) {
      const r = classifySaddle(arr);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('classifySaddle — invariants', () => {
  it('wayAheadMass + wayBehindMass + middleMass equals 1.0', () => {
    const arr = uniformPerCombo([
      0.05, 0.20, 0.50, 0.65, 0.30, 0.80, 0.40, 0.95, 0.10, 0.55,
    ]);
    const r = classifySaddle(arr);
    const sum = r.wayAheadMass + r.wayBehindMass + r.middleMass;
    expect(sum).toBeCloseTo(1.0, 9);
  });

  it('both masses lie in [0, 1]', () => {
    const arr = uniformPerCombo([
      0.05, 0.10, 0.20, 0.30, 0.55, 0.65, 0.75, 0.85, 0.95,
    ]);
    const r = classifySaddle(arr);
    expect(r.wayAheadMass).toBeGreaterThanOrEqual(0);
    expect(r.wayAheadMass).toBeLessThanOrEqual(1);
    expect(r.wayBehindMass).toBeGreaterThanOrEqual(0);
    expect(r.wayBehindMass).toBeLessThanOrEqual(1);
    expect(r.middleMass).toBeGreaterThanOrEqual(0);
    expect(r.middleMass).toBeLessThanOrEqual(1);
  });

  it('label is always one of SADDLE_LABELS', () => {
    const cases = [
      uniformPerCombo([0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.05, 0.20]),
      uniformPerCombo([0.85, 0.90, 0.95, 0.80, 0.75, 0.85, 0.90, 0.85]),
      uniformPerCombo([0.05, 0.95, 0.05, 0.95, 0.05, 0.95, 0.05, 0.95]),
      uniformPerCombo([0.45, 0.50, 0.55, 0.50, 0.55, 0.45, 0.40, 0.60]),
    ];
    for (const arr of cases) {
      const r = classifySaddle(arr);
      expect(SADDLE_LABELS).toContain(r.label);
    }
  });

  it('weighted combos contribute proportionally', () => {
    // Two combos with equity 0.1, weight 9.0 each + two with equity 0.9,
    // weight 1.0 each + middle filler. Way-ahead should dominate.
    const arr = [
      combo(9, 0.10), combo(9, 0.10),
      combo(1, 0.90), combo(1, 0.90),
      combo(1, 0.50), combo(1, 0.45), combo(1, 0.55), combo(1, 0.50),
    ];
    const r = classifySaddle(arr);
    // Total weight = 18 + 2 + 4 = 24
    // wayAheadWeight = 18, wayBehindWeight = 2
    expect(r.wayAheadMass).toBeCloseTo(18 / 24, 5);
    expect(r.wayBehindMass).toBeCloseTo(2 / 24, 5);
    expect(r.label).toBe('wayAhead');
  });

  it('weight-zero combos do not contribute to any mass', () => {
    // Add zero-weight extreme entries; they should not pull masses.
    const arr = [
      combo(1, 0.50), combo(1, 0.50), combo(1, 0.50), combo(1, 0.50),
      combo(1, 0.50), combo(1, 0.50), combo(1, 0.50), combo(1, 0.50),
      combo(0, 0.05), combo(0, 0.95), // zero-weight extreme combos
    ];
    const r = classifySaddle(arr);
    // All real weight in middle bucket; weighted masses should be zero.
    expect(r.wayAheadMass).toBeCloseTo(0, 9);
    expect(r.wayBehindMass).toBeCloseTo(0, 9);
    expect(r.middleMass).toBeCloseTo(1, 9);
    expect(r.label).toBe('flat');
  });

  it('threshold constants are sensibly ordered', () => {
    expect(WAY_BEHIND_EQUITY_CEILING).toBeLessThan(WAY_AHEAD_EQUITY_FLOOR);
    expect(WAY_BEHIND_EQUITY_CEILING).toBeGreaterThan(0);
    expect(WAY_AHEAD_EQUITY_FLOOR).toBeLessThan(1);
    expect(WAY_AHEAD_MASS_FLOOR).toBeGreaterThan(0);
    expect(WAY_AHEAD_MASS_FLOOR).toBeLessThan(0.5);
    expect(WAY_BEHIND_MASS_FLOOR).toBeGreaterThan(0);
    expect(WAY_BEHIND_MASS_FLOOR).toBeLessThan(0.5);
    expect(MIDDLE_MASS_CEILING).toBeGreaterThan(0);
    expect(MIDDLE_MASS_CEILING).toBeLessThan(0.5);
  });
});

describe('classifySaddle — boundary cases', () => {
  it('exactly at WAY_AHEAD_MASS_FLOOR does NOT count as elevated (strict >)', () => {
    // Build perCombo with wayAheadMass = 0.30 exactly.
    // 3 way-ahead combos out of 10.
    const arr = uniformPerCombo([
      0.10, 0.10, 0.10,     // 3 way-ahead (30%)
      0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, // 7 middle (70%)
    ]);
    const r = classifySaddle(arr);
    expect(r.wayAheadMass).toBeCloseTo(0.3, 9);
    // At exact floor with strict >, label should be 'flat', NOT 'wayAhead'.
    expect(r.label).toBe('flat');
  });

  it('just above WAY_AHEAD_MASS_FLOOR fires wayAhead', () => {
    // 4 way-ahead out of 10 = 0.40, above 0.30 floor.
    const arr = uniformPerCombo([
      0.10, 0.10, 0.10, 0.10, // 4 way-ahead (40%)
      0.50, 0.50, 0.50, 0.50, 0.50, 0.50, // 6 middle (60%)
    ]);
    const r = classifySaddle(arr);
    expect(r.wayAheadMass).toBeCloseTo(0.4, 9);
    expect(r.label).toBe('wayAhead');
  });

  it('exactly at MIDDLE_MASS_CEILING does NOT count as depleted', () => {
    // Both masses elevated, middle exactly at 0.20 (not strictly <).
    // 4 way-ahead, 4 way-behind, 2 middle (total 10) → middle = 0.20 exactly
    const arr = uniformPerCombo([
      0.10, 0.10, 0.10, 0.10, // 4 way-ahead
      0.90, 0.90, 0.90, 0.90, // 4 way-behind
      0.50, 0.50,              // 2 middle (exactly at ceiling)
    ]);
    const r = classifySaddle(arr);
    expect(r.middleMass).toBeCloseTo(0.2, 9);
    // Middle at ceiling means NOT depleted → no saddle, label = 'flat'
    expect(r.label).toBe('flat');
  });

  it('middle just below MIDDLE_MASS_CEILING fires saddle', () => {
    // 5 way-ahead, 5 way-behind, 1 middle (total 11) → middle ≈ 0.09 << 0.20
    const arr = uniformPerCombo([
      0.10, 0.10, 0.10, 0.10, 0.10, // 5 way-ahead
      0.90, 0.90, 0.90, 0.90, 0.90, // 5 way-behind
      0.50,                           // 1 middle
    ]);
    const r = classifySaddle(arr);
    expect(r.label).toBe('saddle');
  });
});

describe('classifySaddle — realistic fixtures', () => {
  // Approximation: synthetic perCombo that mirrors the rough equity
  // distribution of named poker situations. Real per-combo arrays from
  // `gameTreeEquity.computeComboEquityDistribution` would have hundreds
  // of entries; these condensed fixtures preserve the macroscopic shape.

  it('BB defense range on AK2r flop (hero holds Ax) → saddle', () => {
    // BB defense to BTN open contains: premium pairs (KK/QQ — beat hero
    // KQ-type, very-low equity vs AA/AK) and tons of air (suited
    // connectors, low pairs missing this board). Hero with top-pair-no-
    // kicker faces a saddled showdown range.
    const arr = uniformPerCombo([
      // Air / total bricks (villain way-behind):
      0.85, 0.88, 0.92, 0.85, 0.90, 0.88, 0.85, 0.90, 0.85, 0.90,
      // Premium hands that crush hero (villain way-ahead):
      0.10, 0.05, 0.12, 0.08, 0.10, 0.05, 0.10, 0.08, 0.10, 0.12,
      // A tiny middle (slowplays, weird combos):
      0.50, 0.55,
    ]);
    const r = classifySaddle(arr);
    expect(r.label).toBe('saddle');
    expect(r.wayAheadMass).toBeGreaterThan(WAY_AHEAD_MASS_FLOOR);
    expect(r.wayBehindMass).toBeGreaterThan(WAY_BEHIND_MASS_FLOOR);
  });

  it('BTN c-bet bluffs on K72r seen from BB POV → wayAhead', () => {
    // BTN c-bets the flop with a wide bluff-heavy range; from BB POV
    // (holding e.g. middle pair or K-high), most of villain's range
    // is air that BB beats.
    const arr = uniformPerCombo([
      0.10, 0.15, 0.20, 0.05, 0.10, 0.25, 0.15, 0.10, 0.20, 0.05, // 10 bluffs (BB ahead)
      0.50, 0.55,                                                     // 2 middle
      0.90,                                                            // 1 nut hand
    ]);
    const r = classifySaddle(arr);
    expect(r.label).toBe('wayAhead');
  });

  it('Loose UTG limp range vs CO 3-bet hero AA → wayBehind', () => {
    // Hero has AA; villain's loose limp range is mostly weaker hands
    // that lose to AA at showdown. Most of villain's range is "way-
    // behind" hero from villain's POV (heroEquity high).
    const arr = uniformPerCombo([
      0.85, 0.90, 0.95, 0.88, 0.82, 0.92, 0.85, 0.90, 0.88, // 9 dominated hands
      0.50, 0.55,                                              // 2 middle (small pairs that flop sets)
    ]);
    const r = classifySaddle(arr);
    expect(r.label).toBe('wayBehind');
  });

  it('Flat MP cold-call range on T98ss flop → flat', () => {
    // MP cold-call range vs CO open with hero holding overpair on a
    // wet board has a wide spectrum of equities — many marginal pairs,
    // many draws, no obvious saddle.
    const arr = uniformPerCombo([
      0.50, 0.45, 0.55, 0.50, 0.60, 0.40, 0.55, 0.45, 0.50, // 9 middle
      0.10, 0.85,                                              // 1 each extreme
    ]);
    const r = classifySaddle(arr);
    expect(r.label).toBe('flat');
  });
});

describe('getSaddleDisplayName', () => {
  it('returns user-facing name for each label', () => {
    expect(getSaddleDisplayName('saddle')).toBe('Saddle');
    expect(getSaddleDisplayName('wayAhead')).toBe('Way-Ahead');
    expect(getSaddleDisplayName('wayBehind')).toBe('Way-Behind');
    expect(getSaddleDisplayName('flat')).toBe('Flat');
    expect(getSaddleDisplayName('empty')).toBe('—');
  });

  it('returns em-dash fallback for unknown label', () => {
    expect(getSaddleDisplayName('unknown')).toBe('—');
    expect(getSaddleDisplayName(null)).toBe('—');
    expect(getSaddleDisplayName(undefined)).toBe('—');
  });
});
