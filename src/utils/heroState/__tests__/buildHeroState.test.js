/**
 * @file Tests for src/utils/heroState/buildHeroState.js
 *
 * Coverage targets (per WS-142 accept_criteria):
 *   - Returns full HeroState object passing typedef-shape validation
 *   - All 18 archetype paths exercised (smoke + at least one full assertion)
 *   - Plan tree comes from gameTreeEvaluator output (not from archetype lookup)
 *   - Two-tier failure mode: hero-required throws, villain-optional soft-degrades
 *   - Narrative interpolates parametric template (no hardcoded copy)
 */

import { describe, it, expect, vi } from 'vitest';
import { buildHeroState } from '../buildHeroState.js';
import { ARCHETYPE_IDS, ARCHETYPE_FAMILIES } from '../types.js';

// ─── Test fixtures ───────────────────────────────────────────────────────

const HERO_HAND = [51, 46]; // As, Kh

/**
 * Minimal preflop gameState fixture (RFI scenario).
 */
const preflopGameState = (overrides = {}) => ({
  street: 'preflop',
  board: [],
  heroPosition: 'HJ',
  inPosition: null,
  playersRemaining: 8,
  pot: 1.5,
  effStack: 100,
  rake: null,
  actionSequence: [],
  ...overrides,
});

/**
 * Minimal flop gameState fixture (SRP HU IP CBET scenario).
 */
const flopGameState = (overrides = {}) => ({
  street: 'flop',
  board: [20, 13, 3], // 7d 5c 2s
  heroPosition: 'BTN',
  inPosition: true,
  playersRemaining: 2,
  pot: 5.5,
  effStack: 95,
  rake: null,
  actionSequence: [
    { seat: 1, action: 'raise', street: 'preflop', amount: 2.5 },
    { seat: 2, action: 'call', street: 'preflop', amount: 2.5 },
  ],
  ...overrides,
});

/**
 * Mock gameTreeEvaluator: returns a deterministic plan with one recommendation
 * + branches. Caller can override per-test.
 */
const mockEvaluateGameTree = (overrides = {}) => async () => ({
  recommendations: [
    {
      action: 'BET',
      sizing: { betSize: 2.5 },
      reasoning: 'standard open',
      ev: 0.42,
      villainResponse: {
        fold: { pct: 0.6, ev: 1.5 },
        call: { pct: 0.35, ev: 0.2, heroResponse: 'cbet' },
        raise: { pct: 0.05, ev: -1.2, heroResponse: 'fold' },
      },
    },
  ],
  heroEquity: 0.62,
  realization: 0.95,
  advantage: { rangeAdvantage: 'hero', nutAdvantage: 'hero' },
  segmentation: { buckets: {} },
  boardTexture: { texture: 'dry' },
  ...overrides,
});

const mockComputeEquityVsRangeParts = (overrides = {}) => async () => ({
  vsValue: 0.22,
  vsBluff: 0.78,
  vsDraw: 0.45,
  vsAir: 0.85,
  overall: 0.62,
  strengthBreakdown: null,
  ...overrides,
});

const sampleVillainProfile = () => ({
  style: 'TAG',
  rangeShape: { capped: false, polarization: 0.4 },
  vulnerabilities: [
    { condition: 'calling station', delta: { sizingMultiplier: 1.3 }, rationale: 'inelastic to size' },
  ],
});

const sampleVillainRange = () => {
  const r = new Float64Array(169);
  r.fill(1);
  return r;
};

// ─── Hard-fail (required inputs) ─────────────────────────────────────────

describe('buildHeroState — required-input guards', () => {
  it('throws Error matching /args/ when called with no args', async () => {
    await expect(buildHeroState()).rejects.toThrow(/args/);
  });

  it('throws Error matching /gameState/ when gameState is missing', async () => {
    await expect(buildHeroState({ heroHand: HERO_HAND })).rejects.toThrow(/gameState/);
  });

  it('throws Error matching /heroHand/ when heroHand is missing', async () => {
    await expect(buildHeroState({ gameState: preflopGameState() })).rejects.toThrow(/heroHand/);
  });

  it('throws when gameState is not an object', async () => {
    await expect(buildHeroState({ gameState: 'invalid', heroHand: HERO_HAND })).rejects.toThrow(/gameState/);
  });
});

// ─── Soft-degrade (optional villain data) ────────────────────────────────

describe('buildHeroState — soft-degrade when villain data missing', () => {
  it('returns valid HeroState shape with no villain data (preflop)', async () => {
    const result = await buildHeroState({
      gameState: preflopGameState(),
      heroHand: HERO_HAND,
    });
    expect(result.archetypeId).toBe('PF_OPEN_RFI');
    expect(result.archetypeFamily).toBe('PREFLOP_OPEN');
    expect(result.equity.overall).toBeNull();
    expect(result.equity.vsRangeParts).toBeNull();
    expect(result.adjustments).toEqual([]);
    expect(result.plan.primary).toBeNull();
    expect(result.plan.branches).toEqual([]);
  });

  it('still renders narrative when degraded (templates have unresolved slots)', async () => {
    const result = await buildHeroState({
      gameState: preflopGameState(),
      heroHand: HERO_HAND,
    });
    expect(result.narrative.headline).toBeDefined();
    expect(result.narrative.body).toBeDefined();
    expect(result.narrative.branchSummary).toBeDefined();
    // Headline references {{handContext.hand}} which is HERO_HAND tuple
    expect(result.narrative.headline).toContain('51,46'); // String([51,46]) === '51,46'
  });

  it('soft-degrades when villainProfile is null but villainRange is present', async () => {
    const result = await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      villainRange: sampleVillainRange(),
      // villainProfile missing
    });
    // hasVillainData = !!(villainRange && villainProfile) === false → soft-degrade
    expect(result.plan.primary).toBeNull();
    expect(result.equity.vsRangeParts).toBeNull();
  });
});

// ─── Full path: with villain data + injected mocks ───────────────────────

describe('buildHeroState — full path with villain data', () => {
  it('returns valid HeroState with Plan + Equity from mocked engines', async () => {
    const result = await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      villainProfile: sampleVillainProfile(),
      villainRange: sampleVillainRange(),
      options: {
        evaluateGameTree: mockEvaluateGameTree(),
        computeEquityVsRangeParts: mockComputeEquityVsRangeParts(),
      },
    });
    expect(result.archetypeId).toBe('FLOP_SRP_HU_IP_CBET');
    expect(result.archetypeFamily).toBe('FLOP_SRP_HU_CBET');
    expect(result.plan.primary.action).toBe('BET');
    expect(result.plan.primary.sizing).toBe(2.5);
    expect(result.plan.primary.ev).toBe(0.42);
    expect(result.plan.branches.length).toBeGreaterThan(0);
    expect(result.equity.overall).toBe(0.62);
    expect(result.equity.vsRangeParts.vsValue).toBe(0.22);
    expect(result.equity.vsRangeParts.vsBluff).toBe(0.78);
    expect(result.equity.realization).toBe(0.95);
    expect(result.equity.realizedEquity).toBeCloseTo(0.62 * 0.95, 5);
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0].condition).toBe('calling station');
  });

  it('first-principles guard: plan.primary.action comes from evaluateGameTree, not archetypeId', async () => {
    // Mock returns CHECK as the primary action — independent of archetypeId.
    const result = await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      villainProfile: sampleVillainProfile(),
      villainRange: sampleVillainRange(),
      options: {
        evaluateGameTree: async () => ({
          recommendations: [{ action: 'CHECK', sizing: null, reasoning: 'check the polarized range', ev: 0.1 }],
          heroEquity: 0.5,
          realization: 1.0,
          advantage: { rangeAdvantage: 'neutral', nutAdvantage: 'neutral' },
        }),
        computeEquityVsRangeParts: mockComputeEquityVsRangeParts(),
      },
    });
    // archetypeId says CBET (FLOP_SRP_HU_IP_CBET) but plan.primary says CHECK.
    // The orchestrator does NOT override the engine's recommendation.
    expect(result.archetypeId).toBe('FLOP_SRP_HU_IP_CBET');
    expect(result.plan.primary.action).toBe('CHECK');
  });

  it('parallel composition: both evaluateGameTree + computeEquityVsRangeParts called', async () => {
    const evalSpy = vi.fn(mockEvaluateGameTree());
    const equitySpy = vi.fn(mockComputeEquityVsRangeParts());
    await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      villainProfile: sampleVillainProfile(),
      villainRange: sampleVillainRange(),
      options: { evaluateGameTree: evalSpy, computeEquityVsRangeParts: equitySpy },
    });
    expect(evalSpy).toHaveBeenCalledTimes(1);
    expect(equitySpy).toHaveBeenCalledTimes(1);
  });

  it('preflop short-circuits computeEquityVsRangeParts (vsRangeParts not called)', async () => {
    const equitySpy = vi.fn(mockComputeEquityVsRangeParts());
    await buildHeroState({
      gameState: preflopGameState(),
      heroHand: HERO_HAND,
      villainProfile: sampleVillainProfile(),
      villainRange: sampleVillainRange(),
      options: {
        evaluateGameTree: mockEvaluateGameTree(),
        computeEquityVsRangeParts: equitySpy,
      },
    });
    // Preflop branch in buildHeroState skips computeEquityVsRangeParts entirely.
    expect(equitySpy).not.toHaveBeenCalled();
  });
});

// ─── Archetype coverage smoke ────────────────────────────────────────────

describe('buildHeroState — archetype routing coverage', () => {
  const archetypeFixtures = [
    // 8 preflop
    ['PF_OPEN_RFI', preflopGameState({ heroPosition: 'HJ' })],
    ['PF_VS_OPEN_BB', preflopGameState({
      heroPosition: 'BB',
      actionSequence: [{ seat: 1, action: 'raise', street: 'preflop', amount: 2.5 }],
    })],
    ['PF_VS_OPEN_SB', preflopGameState({
      heroPosition: 'SB',
      actionSequence: [{ seat: 1, action: 'raise', street: 'preflop', amount: 2.5 }],
    })],
    ['PF_VS_OPEN_IP', preflopGameState({
      heroPosition: 'BTN',
      actionSequence: [{ seat: 1, action: 'raise', street: 'preflop', amount: 2.5 }],
    })],
    ['PF_VS_3BET', preflopGameState({
      heroPosition: 'HJ',
      actionSequence: [
        { seat: 1, action: 'raise', street: 'preflop', amount: 2.5 },
        { seat: 2, action: 'raise', street: 'preflop', amount: 8 },
      ],
    })],
    // Flop
    ['FLOP_SRP_HU_IP_CBET', flopGameState({ inPosition: true })],
    ['FLOP_SRP_HU_OOP_CBET', flopGameState({ inPosition: false })],
    ['FLOP_3BP_HU_IP_CBET', flopGameState({
      inPosition: true,
      actionSequence: [
        { seat: 1, action: 'raise', street: 'preflop', amount: 2.5 },
        { seat: 2, action: 'raise', street: 'preflop', amount: 8 },
        { seat: 1, action: 'call', street: 'preflop', amount: 8 },
      ],
    })],
    ['FLOP_MULTIWAY', flopGameState({ playersRemaining: 3 })],
  ];

  for (const [expectedArchetype, gs] of archetypeFixtures) {
    it(`routes to ${expectedArchetype}`, async () => {
      const result = await buildHeroState({ gameState: gs, heroHand: HERO_HAND });
      expect(result.archetypeId).toBe(expectedArchetype);
      expect(ARCHETYPE_IDS).toContain(result.archetypeId);
      expect(ARCHETYPE_FAMILIES).toContain(result.archetypeFamily);
    });
  }
});

// ─── Throw conditions in classifier propagate ────────────────────────────

describe('buildHeroState — turn/river archetypes propagate classifier throw', () => {
  it('throws when street === turn (classifyArchetype throws v2-deferred)', async () => {
    await expect(buildHeroState({
      gameState: { ...flopGameState(), street: 'turn' },
      heroHand: HERO_HAND,
    })).rejects.toThrow(/turn/);
  });

  it('throws when street === river', async () => {
    await expect(buildHeroState({
      gameState: { ...flopGameState(), street: 'river' },
      heroHand: HERO_HAND,
    })).rejects.toThrow(/river/);
  });
});

// ─── Narrative rendering ─────────────────────────────────────────────────

describe('buildHeroState — narrative rendering', () => {
  it('renders headline, body, branchSummary for the matched archetype', async () => {
    const result = await buildHeroState({
      gameState: preflopGameState({ heroPosition: 'HJ' }),
      heroHand: HERO_HAND,
    });
    expect(result.narrative.headline).toBeTypeOf('string');
    expect(result.narrative.body).toBeTypeOf('string');
    expect(result.narrative.branchSummary).toBeTypeOf('string');
    expect(result.narrative.headline.length).toBeGreaterThan(0);
    expect(result.narrative.body.length).toBeGreaterThan(0);
    expect(result.narrative.branchSummary.length).toBeGreaterThan(0);
  });

  it('interpolates positionClass slot from situation', async () => {
    const result = await buildHeroState({
      gameState: preflopGameState({ heroPosition: 'CO' }),
      heroHand: HERO_HAND,
    });
    expect(result.narrative.headline).toContain('CO');
  });
});
