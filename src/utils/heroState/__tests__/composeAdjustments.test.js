/**
 * @file Tests for src/utils/heroState/composeAdjustments.js
 *
 * WS-155 / SPR-105 — per-axis composition of Adjustment[] → ComposedDelta.
 *
 * Coverage targets (per WS-155 accept_criteria):
 *   - Per-axis composers: sizingMultiplier (multiplicative + clamp),
 *     polarize (OR), bluffFreq (MIN), actionOverride (precedence + tiebreak)
 *   - Full composeAdjustments orchestration
 *   - Stacking / contradicting / clamp / all-firing adversarial cases
 *   - Degraded inputs: empty array, null delta, non-numeric fields
 */

import { describe, it, expect } from 'vitest';
import {
  composeAdjustments,
  composeSizingMultiplier,
  composePolarize,
  composeBluffFreq,
  composeActionOverride,
  SIZING_MULTIPLIER_FLOOR,
  SIZING_MULTIPLIER_CEILING,
} from '../composeAdjustments.js';

// ─── sizingMultiplier ────────────────────────────────────────────────────

describe('composeSizingMultiplier — multiplicative with clamp', () => {
  it('returns 1.0 (unclamped) when adjustments is empty', () => {
    expect(composeSizingMultiplier([])).toEqual({ value: 1.0, clamped: false });
  });

  it('returns 1.0 (unclamped) when adjustments is null/undefined', () => {
    expect(composeSizingMultiplier(null)).toEqual({ value: 1.0, clamped: false });
    expect(composeSizingMultiplier(undefined)).toEqual({ value: 1.0, clamped: false });
  });

  it('returns 1.0 (unclamped) when no adjustment carries sizingMultiplier', () => {
    expect(composeSizingMultiplier([
      { delta: {} },
      { delta: { polarize: true } },
      { delta: { bluffFreq: 0.3 } },
    ])).toEqual({ value: 1.0, clamped: false });
  });

  it('multiplies two firing tendencies (1.2 × 1.3 = 1.56)', () => {
    const result = composeSizingMultiplier([
      { delta: { sizingMultiplier: 1.2 } },
      { delta: { sizingMultiplier: 1.3 } },
    ]);
    expect(result.value).toBeCloseTo(1.56, 5);
    expect(result.clamped).toBe(false);
  });

  it('clamps to ceiling when product exceeds 2.0', () => {
    const result = composeSizingMultiplier([
      { delta: { sizingMultiplier: 1.3 } },
      { delta: { sizingMultiplier: 1.3 } },
      { delta: { sizingMultiplier: 1.3 } },
    ]);
    // 1.3³ ≈ 2.197 → clamps to 2.0
    expect(result.value).toBe(SIZING_MULTIPLIER_CEILING);
    expect(result.clamped).toBe(true);
  });

  it('clamps to floor when product is below 0.6', () => {
    const result = composeSizingMultiplier([
      { delta: { sizingMultiplier: 0.5 } },
      { delta: { sizingMultiplier: 0.9 } },
    ]);
    // 0.5 × 0.9 = 0.45 → clamps to 0.6
    expect(result.value).toBe(SIZING_MULTIPLIER_FLOOR);
    expect(result.clamped).toBe(true);
  });

  it('ignores non-numeric / non-positive / NaN sizingMultiplier values', () => {
    const result = composeSizingMultiplier([
      { delta: { sizingMultiplier: 1.3 } },
      { delta: { sizingMultiplier: 'big' } },
      { delta: { sizingMultiplier: -1 } },
      { delta: { sizingMultiplier: NaN } },
      { delta: { sizingMultiplier: Infinity } },
      { delta: { sizingMultiplier: 1.2 } },
    ]);
    // Only 1.3 + 1.2 should contribute → 1.56
    expect(result.value).toBeCloseTo(1.56, 5);
    expect(result.clamped).toBe(false);
  });
});

// ─── polarize ────────────────────────────────────────────────────────────

describe('composePolarize — OR (any-fires-wins)', () => {
  it('returns false when adjustments is empty / null', () => {
    expect(composePolarize([])).toBe(false);
    expect(composePolarize(null)).toBe(false);
  });

  it('returns false when no adjustment sets polarize true', () => {
    expect(composePolarize([
      { delta: { sizingMultiplier: 1.2 } },
      { delta: { polarize: false } },
      { delta: {} },
    ])).toBe(false);
  });

  it('returns true when any firing adjustment sets polarize true', () => {
    expect(composePolarize([
      { delta: {} },
      { delta: { polarize: true } },
      { delta: { polarize: false } },
    ])).toBe(true);
  });

  it('only counts strict true (not truthy values)', () => {
    expect(composePolarize([
      { delta: { polarize: 1 } },
      { delta: { polarize: 'yes' } },
      { delta: { polarize: {} } },
    ])).toBe(false);
  });
});

// ─── bluffFreq ───────────────────────────────────────────────────────────

describe('composeBluffFreq — MIN-wins (most-conservative)', () => {
  it('returns null when adjustments is empty / null', () => {
    expect(composeBluffFreq([])).toBeNull();
    expect(composeBluffFreq(null)).toBeNull();
  });

  it('returns null when no adjustment specifies bluffFreq', () => {
    expect(composeBluffFreq([
      { delta: { sizingMultiplier: 1.3 } },
      { delta: { polarize: true } },
    ])).toBeNull();
  });

  it('returns single value when only one fires', () => {
    expect(composeBluffFreq([
      { delta: { bluffFreq: 0.4 } },
      { delta: {} },
    ])).toBe(0.4);
  });

  it('returns MIN when multiple fire (0.15 vs 0.55 → 0.15 wins)', () => {
    // Calling-station signal (0.15) must dominate over-folder signal (0.55)
    // per minimax-regret rationale.
    expect(composeBluffFreq([
      { delta: { bluffFreq: 0.55 } },
      { delta: { bluffFreq: 0.15 } },
      { delta: { bluffFreq: 0.3 } },
    ])).toBe(0.15);
  });

  it('filters out NaN / out-of-range values', () => {
    expect(composeBluffFreq([
      { delta: { bluffFreq: NaN } },
      { delta: { bluffFreq: -0.1 } },
      { delta: { bluffFreq: 1.5 } },
      { delta: { bluffFreq: 0.4 } },
    ])).toBe(0.4);
  });

  it('accepts 0 as a valid bluffFreq', () => {
    // bluffFreq = 0 means "do not bluff" — a valid extreme signal.
    expect(composeBluffFreq([
      { delta: { bluffFreq: 0 } },
      { delta: { bluffFreq: 0.3 } },
    ])).toBe(0);
  });
});

// ─── actionOverride ──────────────────────────────────────────────────────

describe('composeActionOverride — precedence by severity, conservatism tiebreak', () => {
  it('returns null when adjustments is empty / null', () => {
    expect(composeActionOverride([])).toBeNull();
    expect(composeActionOverride(null)).toBeNull();
  });

  it('returns null when no adjustment specifies actionOverride', () => {
    expect(composeActionOverride([
      { delta: { sizingMultiplier: 1.3 }, severity: 0.5 },
      { delta: { polarize: true }, severity: 0.7 },
    ])).toBeNull();
  });

  it('returns the only override when one fires', () => {
    expect(composeActionOverride([
      { delta: { actionOverride: 'check' }, severity: 0.5 },
    ])).toBe('check');
  });

  it('picks higher-severity override when two fire', () => {
    expect(composeActionOverride([
      { delta: { actionOverride: 'check' }, severity: 0.4 },
      { delta: { actionOverride: 'raise' }, severity: 0.8 },
    ])).toBe('raise');
  });

  it('uses confidence as severity-fallback when severity field absent', () => {
    expect(composeActionOverride([
      { delta: { actionOverride: 'check' }, confidence: 0.4 },
      { delta: { actionOverride: 'raise' }, confidence: 0.9 },
    ])).toBe('raise');
  });

  it('tiebreaks by conservatism at equal severity (check beats bet)', () => {
    // Equal severity → less-aggressive action wins (minimax-regret).
    expect(composeActionOverride([
      { delta: { actionOverride: 'bet' }, severity: 0.5 },
      { delta: { actionOverride: 'check' }, severity: 0.5 },
    ])).toBe('check');
  });

  it('tiebreaks: fold < check < call < bet < raise', () => {
    expect(composeActionOverride([
      { delta: { actionOverride: 'raise' }, severity: 0.3 },
      { delta: { actionOverride: 'bet' }, severity: 0.3 },
      { delta: { actionOverride: 'fold' }, severity: 0.3 },
    ])).toBe('fold');
  });
});

// ─── Full composeAdjustments orchestration ───────────────────────────────

describe('composeAdjustments — full orchestration', () => {
  it('returns identity-shape when adjustments is empty', () => {
    expect(composeAdjustments([])).toEqual({
      sizingMultiplier: 1.0,
      polarize: false,
      bluffFreq: null,
      actionOverride: null,
      clamped: false,
      contributingCount: 0,
    });
  });

  it('returns identity-shape when adjustments is null/undefined', () => {
    expect(composeAdjustments(null)).toEqual({
      sizingMultiplier: 1.0,
      polarize: false,
      bluffFreq: null,
      actionOverride: null,
      clamped: false,
      contributingCount: 0,
    });
  });

  it('handles a single calling-station adjustment correctly', () => {
    const result = composeAdjustments([
      {
        condition: 'calling station',
        delta: { sizingMultiplier: 1.2, polarize: true, bluffFreq: 0.15 },
        severity: 0.7,
      },
    ]);
    expect(result.sizingMultiplier).toBeCloseTo(1.2, 5);
    expect(result.polarize).toBe(true);
    expect(result.bluffFreq).toBe(0.15);
    expect(result.actionOverride).toBeNull();
    expect(result.clamped).toBe(false);
    expect(result.contributingCount).toBe(1);
  });

  it('stacks calling-station + over-folder correctly (MIN-wins on bluffFreq)', () => {
    // Adversarial case: one tendency says "bluff less" (calling station,
    // 0.15) and another says "bluff more" (over-folder, 0.55). MIN-wins
    // means calling-station dominates — bluffing into the wrong target is
    // the worse failure mode.
    const result = composeAdjustments([
      { delta: { sizingMultiplier: 1.2, bluffFreq: 0.15 }, severity: 0.7 }, // calling station
      { delta: { bluffFreq: 0.55 }, severity: 0.6 },                       // over-folder
    ]);
    expect(result.bluffFreq).toBe(0.15);
    expect(result.sizingMultiplier).toBeCloseTo(1.2, 5);
    expect(result.contributingCount).toBe(2);
  });

  it('clamps when 3 tendencies stack multiplicatively past 2.0', () => {
    const result = composeAdjustments([
      { delta: { sizingMultiplier: 1.3, polarize: true }, severity: 0.7 },
      { delta: { sizingMultiplier: 1.3 }, severity: 0.6 },
      { delta: { sizingMultiplier: 1.3 }, severity: 0.5 },
    ]);
    expect(result.sizingMultiplier).toBe(SIZING_MULTIPLIER_CEILING);
    expect(result.clamped).toBe(true);
    expect(result.polarize).toBe(true);
    expect(result.contributingCount).toBe(3);
  });

  it('all-firing edge case — every axis populated, no exceptions/NaN', () => {
    const result = composeAdjustments([
      {
        delta: {
          sizingMultiplier: 1.3,
          polarize: true,
          bluffFreq: 0.2,
          actionOverride: 'check',
        },
        severity: 0.8,
      },
      {
        delta: {
          sizingMultiplier: 1.1,
          polarize: false,
          bluffFreq: 0.4,
          actionOverride: 'bet',
        },
        severity: 0.5,
      },
    ]);
    expect(result.sizingMultiplier).toBeCloseTo(1.43, 5);
    expect(result.polarize).toBe(true);
    expect(result.bluffFreq).toBe(0.2); // MIN of 0.2, 0.4
    expect(result.actionOverride).toBe('check'); // severity 0.8 > 0.5
    expect(result.clamped).toBe(false);
    expect(result.contributingCount).toBe(2);
    // Sanity — no NaN / Infinity leaked.
    expect(Number.isFinite(result.sizingMultiplier)).toBe(true);
    expect(Number.isFinite(result.bluffFreq)).toBe(true);
  });

  it('counts only contributing adjustments (those with ≥1 delta field)', () => {
    const result = composeAdjustments([
      { delta: { sizingMultiplier: 1.2 } },         // contributes
      { delta: {} },                                  // informational
      { delta: { polarize: false } },                 // does NOT contribute (false is default)
      { delta: { polarize: true } },                  // contributes
      { delta: { actionOverride: '' }, severity: 0.5 }, // empty string — does NOT contribute
      { delta: { bluffFreq: 0.3 } },                  // contributes
    ]);
    expect(result.contributingCount).toBe(3);
  });

  it('handles adjustment without delta field gracefully', () => {
    const result = composeAdjustments([
      { condition: 'no delta' },
      { condition: 'null delta', delta: null },
      { condition: 'wrong type', delta: 'oops' },
    ]);
    expect(result).toEqual({
      sizingMultiplier: 1.0,
      polarize: false,
      bluffFreq: null,
      actionOverride: null,
      clamped: false,
      contributingCount: 0,
    });
  });

  it('contradicting overrides resolve by severity then conservatism', () => {
    // Two tendencies want to override action; severity 0.8 > 0.6 → high-sev wins.
    const result = composeAdjustments([
      { delta: { actionOverride: 'raise' }, severity: 0.6 },
      { delta: { actionOverride: 'check' }, severity: 0.8 },
    ]);
    expect(result.actionOverride).toBe('check');
  });

  it('clamp floor: 0.5 × 0.5 = 0.25 → 0.6 with clamped:true', () => {
    const result = composeAdjustments([
      { delta: { sizingMultiplier: 0.5 } },
      { delta: { sizingMultiplier: 0.5 } },
    ]);
    expect(result.sizingMultiplier).toBe(SIZING_MULTIPLIER_FLOOR);
    expect(result.clamped).toBe(true);
  });
});
