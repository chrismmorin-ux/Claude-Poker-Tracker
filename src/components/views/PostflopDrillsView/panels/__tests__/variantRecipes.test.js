/**
 * Tests for panels/variantRecipes.js — the I-DM-1 composition-ordering
 * constant + variant selection helper for the v2 bucket-ev-panel.
 */

import { describe, it, expect } from 'vitest';
import {
  VARIANT_RECIPES,
  selectVariant,
  primitivesForVariant,
} from '../variantRecipes';

describe('VARIANT_RECIPES', () => {
  it('is frozen and every recipe is a frozen array', () => {
    expect(Object.isFrozen(VARIANT_RECIPES)).toBe(true);
    for (const recipe of Object.values(VARIANT_RECIPES)) {
      expect(Object.isFrozen(recipe)).toBe(true);
      expect(Array.isArray(recipe)).toBe(true);
    }
  });

  it('covers V1–V6 (v1-ship scope per spec)', () => {
    for (const id of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']) {
      expect(VARIANT_RECIPES[id]).toBeDefined();
      expect(VARIANT_RECIPES[id].length).toBeGreaterThan(0);
    }
  });

  it('I-DM-1: P1 comes before P3 in every recipe (villain primary, hero context)', () => {
    for (const [id, recipe] of Object.entries(VARIANT_RECIPES)) {
      const p1Idx = recipe.indexOf('P1');
      const p3Idx = recipe.indexOf('P3');
      expect(p1Idx, `${id} missing P1`).toBeGreaterThanOrEqual(0);
      expect(p3Idx, `${id} missing P3`).toBeGreaterThanOrEqual(0);
      expect(p1Idx, `${id} has P3 (hero) before P1 (villain)`).toBeLessThan(p3Idx);
    }
  });

  it('I-DM-2: P2 (WeightedTotalTable) present in every variant', () => {
    for (const [id, recipe] of Object.entries(VARIANT_RECIPES)) {
      expect(recipe, `${id} missing P2`).toContain('P2');
    }
  });

  it('turn + river variants include P5 (street narrowing); flop variants do not', () => {
    // V1/V2 = flop; V3–V6 = turn/river
    expect(VARIANT_RECIPES.V1).not.toContain('P5');
    expect(VARIANT_RECIPES.V2).not.toContain('P5');
    expect(VARIANT_RECIPES.V3).toContain('P5');
    expect(VARIANT_RECIPES.V4).toContain('P5');
    expect(VARIANT_RECIPES.V5).toContain('P5');
    expect(VARIANT_RECIPES.V6).toContain('P5');
  });

  it('every variant includes P6b (glossary) — Gate-4 F01', () => {
    for (const [id, recipe] of Object.entries(VARIANT_RECIPES)) {
      expect(recipe, `${id} missing P6b`).toContain('P6b');
    }
  });

  it('every variant ends with P6 then P6b (confidence + glossary as bottom strip)', () => {
    for (const [id, recipe] of Object.entries(VARIANT_RECIPES)) {
      const lastTwo = recipe.slice(-2);
      expect(lastTwo, `${id} tail ordering`).toEqual(['P6', 'P6b']);
    }
  });
});

describe('selectVariant', () => {
  it('routes bluff-catch decisions to V5', () => {
    expect(selectVariant({ street: 'river', villainFirst: true, decisionKind: 'bluff-catch' })).toBe('V5');
    expect(selectVariant({ street: 'flop',  villainFirst: false, decisionKind: 'bluff-catch' })).toBe('V5');
  });

  it('routes thin-value decisions to V6', () => {
    expect(selectVariant({ street: 'river', villainFirst: false, decisionKind: 'thin-value' })).toBe('V6');
  });

  it('standard flop: villain-first → V1, hero-first → V2', () => {
    expect(selectVariant({ street: 'flop', villainFirst: true,  decisionKind: 'standard' })).toBe('V1');
    expect(selectVariant({ street: 'flop', villainFirst: false, decisionKind: 'standard' })).toBe('V2');
  });

  it('standard turn: villain-first → V3, hero-first → V4', () => {
    expect(selectVariant({ street: 'turn', villainFirst: true,  decisionKind: 'standard' })).toBe('V3');
    expect(selectVariant({ street: 'turn', villainFirst: false, decisionKind: 'standard' })).toBe('V4');
  });

  it('defaults decisionKind absence to standard behavior', () => {
    expect(selectVariant({ street: 'flop', villainFirst: true })).toBe('V1');
  });
});

describe('primitivesForVariant', () => {
  it('returns a fresh mutable copy of the recipe array', () => {
    const v1 = primitivesForVariant('V1');
    expect(v1).toEqual([...VARIANT_RECIPES.V1]);
    v1.push('BOGUS');
    expect(VARIANT_RECIPES.V1).not.toContain('BOGUS'); // original stays frozen
  });

  it('returns null on unknown variant id', () => {
    expect(primitivesForVariant('V99')).toBeNull();
    expect(primitivesForVariant(null)).toBeNull();
    expect(primitivesForVariant('')).toBeNull();
  });
});
