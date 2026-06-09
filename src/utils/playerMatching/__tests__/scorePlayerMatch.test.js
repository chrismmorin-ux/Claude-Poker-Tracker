/**
 * @file Tests for scorePlayerMatch.js — §PIO-G4-PVA weighted recognition score
 * + §PIO-G4-DISAMB confidence band. WS-164 / SPR-110.
 */

import { describe, it, expect } from 'vitest';
import {
  scorePlayerMatch,
  bandConfidence,
  RECOGNITION_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
} from '../scorePlayerMatch.js';

const player = (overrides = {}) => ({
  playerId: 1,
  name: 'Michael',
  nickname: 'Mike',
  ageDecade: '30s',
  skinTone: 'tan',
  ethnicityTags: ['hispanic'],
  hairColor: 'brown',
  jewelry: ['gold-chain'],
  wardrobe: ['dark-casual'],
  headwear: 'cap',
  logo: ['sports-team'],
  ...overrides,
});

// ─── weight vector ───────────────────────────────────────────────────────

describe('RECOGNITION_WEIGHTS (§PIO-G4-PVA)', () => {
  it('uses the audit per-dim weights verbatim (sum 0.95 — the audit text says "=1.00" but its listed values total 0.95; renormalization over active dims makes the absolute sum irrelevant to scores)', () => {
    const sum = Object.values(RECOGNITION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0.95, 5);
  });
  it('name is the dominant dim at 0.35', () => {
    expect(RECOGNITION_WEIGHTS.name).toBe(0.35);
  });
});

// ─── confidence bands (§PIO-G4-DISAMB) ────────────────────────────────────

describe('bandConfidence', () => {
  it('bands ≥0.7 strong / 0.4–0.7 partial / <0.4 weak', () => {
    expect(bandConfidence(0.85)).toBe('strong');
    expect(bandConfidence(CONFIDENCE_THRESHOLDS.strong)).toBe('strong');
    expect(bandConfidence(0.55)).toBe('partial');
    expect(bandConfidence(CONFIDENCE_THRESHOLDS.partial)).toBe('partial');
    expect(bandConfidence(0.3)).toBe('weak');
    expect(bandConfidence(0)).toBe('weak');
  });
});

// ─── name dim ──────────────────────────────────────────────────────────────

describe('name dim', () => {
  it('exact name-prefix query → score 1.0, strong (renormalized over single active dim)', () => {
    const r = scorePlayerMatch(player(), { nameQuery: 'Mich' });
    expect(r.score).toBeCloseTo(1.0, 5);
    expect(r.confidence).toBe('strong');
  });
  it('matches nickname prefix too', () => {
    const r = scorePlayerMatch(player(), { nameQuery: 'Mi' });
    expect(r.score).toBeCloseTo(1.0, 5);
  });
  it('no name match → score 0, weak', () => {
    const r = scorePlayerMatch(player(), { nameQuery: 'xyz' });
    expect(r.score).toBe(0);
    expect(r.confidence).toBe('weak');
  });
});

// ─── scalar dims (exact / adjacent / miss) ────────────────────────────────

describe('scalar dim matching (age, range-adjacent)', () => {
  it('exact age → full contribution', () => {
    const r = scorePlayerMatch(player({ ageDecade: '30s' }), { ageDecade: '30s' });
    expect(r.perDim.age.match).toBe(1.0);
    expect(r.score).toBeCloseTo(1.0, 5); // single active dim
  });
  it('adjacent age (range neighbor) → 0.5 partial credit', () => {
    const r = scorePlayerMatch(player({ ageDecade: '40s' }), { ageDecade: '30s' });
    expect(r.perDim.age.match).toBe(0.5);
  });
  it('far age → 0', () => {
    const r = scorePlayerMatch(player({ ageDecade: '60s+' }), { ageDecade: '30s' });
    expect(r.perDim.age.match).toBe(0);
  });
  it('headwear is exact-only (no range axis)', () => {
    expect(scorePlayerMatch(player({ headwear: 'cap' }), { headwear: 'cap' }).perDim.hat.match).toBe(1.0);
    expect(scorePlayerMatch(player({ headwear: 'beanie' }), { headwear: 'cap' }).perDim.hat.match).toBe(0);
  });
});

// ─── array dims (set overlap) ─────────────────────────────────────────────

describe('array dim matching (ethnicity overlap)', () => {
  it('full overlap → 1.0', () => {
    const r = scorePlayerMatch(player({ ethnicityTags: ['hispanic'] }), { ethnicityTags: ['hispanic'] });
    expect(r.perDim.ethnicity.match).toBe(1.0);
  });
  it('player superset of single-tag query → 1.0 (|∩|/|query|)', () => {
    const r = scorePlayerMatch(player({ ethnicityTags: ['hispanic', 'black'] }), { ethnicityTags: ['hispanic'] });
    expect(r.perDim.ethnicity.match).toBe(1.0);
  });
  it('half overlap → 0.5', () => {
    const r = scorePlayerMatch(player({ ethnicityTags: ['hispanic'] }), { ethnicityTags: ['hispanic', 'black'] });
    expect(r.perDim.ethnicity.match).toBe(0.5);
  });
  it('no overlap → 0', () => {
    const r = scorePlayerMatch(player({ ethnicityTags: ['caucasian'] }), { ethnicityTags: ['hispanic'] });
    expect(r.perDim.ethnicity.match).toBe(0);
  });
});

// ─── active-dim renormalization ───────────────────────────────────────────

describe('active-dim renormalization', () => {
  it('name + matching age → score 1.0 (not capped at name weight)', () => {
    const r = scorePlayerMatch(player({ ageDecade: '30s' }), { nameQuery: 'Mich', ageDecade: '30s' });
    expect(r.score).toBeCloseTo(1.0, 5);
  });
  it('name match + age miss → weighted average over the two active dims', () => {
    // numerator = 0.35·1 + 0.10·0 = 0.35 ; denominator = 0.45 ; score ≈ 0.778
    const r = scorePlayerMatch(player({ ageDecade: '60s+' }), { nameQuery: 'Mich', ageDecade: '30s' });
    expect(r.score).toBeCloseTo(0.35 / 0.45, 4);
    expect(r.confidence).toBe('strong');
  });
  it('inactive dims do not penalize the score', () => {
    // ethnicity mismatch is NOT queried → must not lower a perfect name score
    const r = scorePlayerMatch(player({ ethnicityTags: ['caucasian'] }), { nameQuery: 'Mich' });
    expect(r.score).toBeCloseTo(1.0, 5);
    expect(r.perDim.ethnicity).toBeUndefined();
  });
});

// ─── stability scaling ─────────────────────────────────────────────────────

describe('stability scaling (computeStability via options.sightings)', () => {
  it('a varying attribute scales its contribution DOWN vs no-sightings full weight', () => {
    const p = player({ wardrobe: ['dark-casual'] });
    const query = { wardrobe: ['dark-casual'] };
    const noSightings = scorePlayerMatch(p, query).score; // stability = 1.0
    // 5 sightings, wardrobe varies (only the most-recent matches) → low posterior
    const sightings = [
      { capturedAt: 5, attributes: { wardrobe: ['dark-casual'] } },
      { capturedAt: 4, attributes: { wardrobe: ['formal'] } },
      { capturedAt: 3, attributes: { wardrobe: ['bright'] } },
      { capturedAt: 2, attributes: { wardrobe: ['light'] } },
      { capturedAt: 1, attributes: { wardrobe: ['jersey'] } },
    ];
    const withSightings = scorePlayerMatch(p, query, { sightings }).score;
    expect(withSightings).toBeLessThan(noSightings);
    expect(noSightings).toBeCloseTo(1.0, 5);
  });
  it('name dim is never stability-scaled', () => {
    const sightings = [{ capturedAt: 1, attributes: {} }];
    const r = scorePlayerMatch(player(), { nameQuery: 'Mich' }, { sightings });
    expect(r.perDim.name.stability).toBe(1);
    expect(r.score).toBeCloseTo(1.0, 5);
  });
});

// ─── clamp + edge cases ────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty query → score 0, weak', () => {
    const r = scorePlayerMatch(player(), {});
    expect(r.score).toBe(0);
    expect(r.confidence).toBe('weak');
  });
  it('score is always within [0,1]', () => {
    const r = scorePlayerMatch(player(), {
      nameQuery: 'Mich', ageDecade: '30s', ethnicityTags: ['hispanic'], hairColor: 'brown',
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
  it('handles a player missing the queried attribute (→ 0 for that dim)', () => {
    const r = scorePlayerMatch(player({ ageDecade: undefined }), { ageDecade: '30s' });
    expect(r.perDim.age.match).toBe(0);
  });
  it('preserves highlight metadata (additive contract)', () => {
    const r = scorePlayerMatch(player(), { nameQuery: 'Mich' });
    expect(r.nameMatchStart).toBe(0);
    expect(r.nameMatchEnd).toBe(4);
    expect(r.passesFilters).toBe(true);
    expect(r.matchedFeatures instanceof Set).toBe(true);
  });
});
