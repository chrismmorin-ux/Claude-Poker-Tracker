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
    // WS-154 multiway potType split: default flopGameState has SRP preflop
    // (raise + call), so playersRemaining=3 routes to FLOP_MULTIWAY_SRP.
    ['FLOP_MULTIWAY_SRP', flopGameState({ playersRemaining: 3 })],
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

// ─── Multiway flop routing + role-partition null + descriptor (WS-154) ───

describe('buildHeroState — multiway flop (WS-154 / SPR-106)', () => {
  // Build a multiway game state that reuses the existing fixture machinery
  // but adds the multiway hero-role coordinates needed to assert each branch.
  const multiwayFlopGameState = (overrides = {}) => ({
    ...flopGameState({ playersRemaining: 3 }),
    heroSeat: 2, // hero is seat 2 by default
    ...overrides,
  });

  it('SRP multiway (hero called, no villain bet on flop) → FLOP_MULTIWAY_SRP + multiwayHeroRole=CALLER_PFR_BEHIND + vsRangeParts null', async () => {
    const gs = multiwayFlopGameState({
      // Hero is seat 2, called the preflop raise from seat 1; another caller seat 3.
      actionSequence: [
        { seat: 1, action: 'raise', street: 'preflop', amount: 2.5 },
        { seat: 2, action: 'call', street: 'preflop', amount: 2.5 },
        { seat: 3, action: 'call', street: 'preflop', amount: 2.5 },
      ],
      heroSeat: 2,
    });
    const result = await buildHeroState({
      gameState: gs,
      heroHand: HERO_HAND,
      villainRange: sampleVillainRange(),
      villainProfile: sampleVillainProfile(),
      options: {
        evaluateGameTree: mockEvaluateGameTree(),
      },
    });
    expect(result.archetypeId).toBe('FLOP_MULTIWAY_SRP');
    expect(result.archetypeFamily).toBe('FLOP_MULTIWAY');
    expect(result.situation.multiwayHeroRole).toBe('CALLER_PFR_BEHIND');
    expect(result.situation.potType).toBe('SRP');
    // Role partition is HU-defined; multiway gates upstream → vsRangeParts null.
    expect(result.equity.vsRangeParts).toBe(null);
    // gameTreeEvaluator still ran → overall + plan populated.
    expect(result.equity.overall).not.toBe(null);
    expect(result.plan.primary.action).toBe('BET');
  });

  it('SRP multiway (hero was PFR) → multiwayHeroRole=PFR_LEADING', async () => {
    const gs = multiwayFlopGameState({
      // Hero (seat 2) raised preflop; two callers behind.
      actionSequence: [
        { seat: 2, action: 'raise', street: 'preflop', amount: 2.5 },
        { seat: 3, action: 'call', street: 'preflop', amount: 2.5 },
        { seat: 4, action: 'call', street: 'preflop', amount: 2.5 },
      ],
      heroSeat: 2,
    });
    const result = await buildHeroState({
      gameState: gs,
      heroHand: HERO_HAND,
      villainRange: sampleVillainRange(),
      villainProfile: sampleVillainProfile(),
      options: { evaluateGameTree: mockEvaluateGameTree() },
    });
    expect(result.archetypeId).toBe('FLOP_MULTIWAY_SRP');
    expect(result.situation.multiwayHeroRole).toBe('PFR_LEADING');
  });

  it('SRP multiway (hero called, villain has bet flop) → multiwayHeroRole=CALLER_PFR_ACTED', async () => {
    const gs = multiwayFlopGameState({
      actionSequence: [
        { seat: 1, action: 'raise', street: 'preflop', amount: 2.5 },
        { seat: 2, action: 'call', street: 'preflop', amount: 2.5 },
        { seat: 3, action: 'call', street: 'preflop', amount: 2.5 },
        // Villain (seat 1, the PFR) cbets the flop.
        { seat: 1, action: 'bet', street: 'flop', amount: 3 },
      ],
      heroSeat: 2,
    });
    const result = await buildHeroState({
      gameState: gs,
      heroHand: HERO_HAND,
      villainRange: sampleVillainRange(),
      villainProfile: sampleVillainProfile(),
      options: { evaluateGameTree: mockEvaluateGameTree() },
    });
    expect(result.archetypeId).toBe('FLOP_MULTIWAY_SRP');
    expect(result.situation.multiwayHeroRole).toBe('CALLER_PFR_ACTED');
  });

  it('3BP multiway → FLOP_MULTIWAY_3BP', async () => {
    const gs = multiwayFlopGameState({
      actionSequence: [
        { seat: 1, action: 'raise', street: 'preflop', amount: 2.5 },
        { seat: 2, action: 'raise', street: 'preflop', amount: 8 },
        { seat: 1, action: 'call', street: 'preflop', amount: 8 },
        { seat: 3, action: 'call', street: 'preflop', amount: 8 },
      ],
      heroSeat: 2,
    });
    const result = await buildHeroState({
      gameState: gs,
      heroHand: HERO_HAND,
      villainRange: sampleVillainRange(),
      villainProfile: sampleVillainProfile(),
      options: { evaluateGameTree: mockEvaluateGameTree() },
    });
    expect(result.archetypeId).toBe('FLOP_MULTIWAY_3BP');
    expect(result.situation.potType).toBe('3BP');
    expect(result.situation.multiwayHeroRole).toBe('PFR_LEADING');
    expect(result.equity.vsRangeParts).toBe(null);
  });

  it('limped multiway → FLOP_MULTIWAY_LIMPED + multiwayHeroRole=LIMPER', async () => {
    const gs = multiwayFlopGameState({
      actionSequence: [
        { seat: 1, action: 'call', street: 'preflop', amount: 1 },
        { seat: 2, action: 'call', street: 'preflop', amount: 1 },
        { seat: 3, action: 'check', street: 'preflop' },
      ],
      heroSeat: 2,
    });
    const result = await buildHeroState({
      gameState: gs,
      heroHand: HERO_HAND,
      villainRange: sampleVillainRange(),
      villainProfile: sampleVillainProfile(),
      options: { evaluateGameTree: mockEvaluateGameTree() },
    });
    expect(result.archetypeId).toBe('FLOP_MULTIWAY_LIMPED');
    expect(result.situation.potType).toBe('LIMPED');
    expect(result.situation.multiwayHeroRole).toBe('LIMPER');
    expect(result.equity.vsRangeParts).toBe(null);
  });

  it('HU situation → multiwayHeroRole is null (descriptor not applicable)', async () => {
    // playersRemaining=2 → not multiway; descriptor must be null.
    const gs = flopGameState();
    const result = await buildHeroState({
      gameState: gs,
      heroHand: HERO_HAND,
    });
    expect(result.situation.playersRemaining).toBe(2);
    expect(result.situation.multiwayHeroRole).toBe(null);
  });
});

// ─── Turn/river orchestrator routing (WS-153 enabled v2 classifier) ──────

describe('buildHeroState — turn/river produce valid archetypes (v2)', () => {
  it('returns a TURN_* archetypeId when street === turn', async () => {
    const result = await buildHeroState({
      gameState: { ...flopGameState(), street: 'turn' },
      heroHand: HERO_HAND,
    });
    expect(result.archetypeId).toMatch(/^TURN_/);
    expect(result.archetypeFamily).toMatch(/^TURN_/);
  });

  it('returns a RIVER_* archetypeId when street === river', async () => {
    const result = await buildHeroState({
      gameState: { ...flopGameState(), street: 'river' },
      heroHand: HERO_HAND,
    });
    expect(result.archetypeId).toMatch(/^RIVER_/);
    expect(result.archetypeFamily).toMatch(/^RIVER_/);
  });

  it('passes sizingFraction through to the classifier for river block-bet routing', async () => {
    const result = await buildHeroState({
      gameState: {
        ...flopGameState(),
        street: 'river',
        inPosition: false,
        sizingFraction: 0.30,
        actionContext: 'BARREL',
      },
      heroHand: HERO_HAND,
    });
    expect(result.archetypeId).toBe('RIVER_BLOCK_BET');
    expect(result.situation.sizingFraction).toBe(0.30);
  });
});

// ─── WS-211: turn/river action-context precision via action history ─────
//
// These tests pin the v2 deriveActionContext precision — given heroSeat in
// gameState, the orchestrator reconstructs BARREL / VS_BARREL / PROBE /
// CBET (delayed) / VS_DONK from actionSequence without callers passing
// gameState.actionContext explicitly. Backward-compat: when heroSeat is
// omitted, the v1 heuristic still routes to a valid archetype.

describe('buildHeroState — turn/river action-context precision (WS-211)', () => {
  const HERO_SEAT = 2;
  const VILLAIN_SEAT = 1;

  // Preflop action prefixes for SRP (1 raise) and 3BP (2 raises) HU pots.
  const SRP_PREFLOP = [
    { seat: VILLAIN_SEAT, action: 'raise', street: 'preflop', amount: 2.5, order: 1 },
    { seat: HERO_SEAT, action: 'call', street: 'preflop', amount: 2.5, order: 2 },
  ];
  // SRP with hero as PFA (hero opens, villain calls).
  const SRP_PREFLOP_HERO_PFA = [
    { seat: HERO_SEAT, action: 'raise', street: 'preflop', amount: 2.5, order: 1 },
    { seat: VILLAIN_SEAT, action: 'call', street: 'preflop', amount: 2.5, order: 2 },
  ];

  const turnGameState = (overrides = {}) => ({
    street: 'turn',
    board: [20, 13, 3, 36], // 7d 5c 2s + Td
    heroPosition: 'BTN',
    inPosition: true,
    playersRemaining: 2,
    pot: 8,
    effStack: 90,
    rake: null,
    heroSeat: HERO_SEAT,
    actionSequence: SRP_PREFLOP_HERO_PFA,
    ...overrides,
  });

  const riverGameState = (overrides = {}) => ({
    street: 'river',
    board: [20, 13, 3, 36, 47], // 7d 5c 2s + Td + Qs
    heroPosition: 'BTN',
    inPosition: true,
    playersRemaining: 2,
    pot: 16,
    effStack: 80,
    rake: null,
    heroSeat: HERO_SEAT,
    actionSequence: SRP_PREFLOP_HERO_PFA,
    ...overrides,
  });

  // ── Turn ────────────────────────────────────────────────────────────────

  it('TURN BARREL — hero PFA, bet flop, bets turn (current action) → TURN_SRP_BARREL_IP', async () => {
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', amount: 8, order: 5 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('BARREL');
    expect(result.archetypeId).toBe('TURN_SRP_BARREL_IP');
  });

  it('TURN BARREL spot — hero PFA, bet flop, hasn\'t acted on turn yet → TURN_SRP_BARREL_IP', async () => {
    // Decision-point scenario: hero is about to act on turn after cbetting flop.
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          // No turn actions yet — hero is to act.
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('BARREL');
    expect(result.archetypeId).toBe('TURN_SRP_BARREL_IP');
  });

  it('TURN VS_BARREL — hero non-PFA, called flop bet, faces turn bet → TURN_SRP_VS_BARREL_OOP', async () => {
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: false,
        actionSequence: [
          ...SRP_PREFLOP, // villain is PFA
          { seat: VILLAIN_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: HERO_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: VILLAIN_SEAT, action: 'bet', street: 'turn', amount: 8, order: 5 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('VS_BARREL');
    expect(result.archetypeId).toBe('TURN_SRP_VS_BARREL_OOP');
  });

  it('TURN PROBE — flop checked through, hero (non-PFA) leads turn OOP → TURN_PROBE', async () => {
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: false,
        actionSequence: [
          ...SRP_PREFLOP, // villain is PFA
          { seat: HERO_SEAT, action: 'check', street: 'flop', order: 3 },
          { seat: VILLAIN_SEAT, action: 'check', street: 'flop', order: 4 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', amount: 5, order: 5 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('PROBE');
    expect(result.archetypeId).toBe('TURN_PROBE');
  });

  it('TURN CBET (delayed) — hero PFA, checked back flop IP, bets turn → TURN_DELAYED_CBET', async () => {
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: VILLAIN_SEAT, action: 'check', street: 'flop', order: 3 },
          { seat: HERO_SEAT, action: 'check', street: 'flop', order: 4 },
          { seat: VILLAIN_SEAT, action: 'check', street: 'turn', order: 5 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', amount: 5, order: 6 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('CBET');
    expect(result.archetypeId).toBe('TURN_DELAYED_CBET');
  });

  it('TURN VS_DONK — hero PFA, checked back flop IP, villain donks turn → TURN_VS_DONK', async () => {
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: VILLAIN_SEAT, action: 'check', street: 'flop', order: 3 },
          { seat: HERO_SEAT, action: 'check', street: 'flop', order: 4 },
          { seat: VILLAIN_SEAT, action: 'bet', street: 'turn', amount: 5, order: 5 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('VS_DONK');
    expect(result.archetypeId).toBe('TURN_VS_DONK');
  });

  it('TURN VS_DONK — hero PFA, bet flop, villain called, villain donks turn → TURN_VS_DONK', async () => {
    // Lead-into-PFA-on-later-street pattern: villain becomes aggressor on turn
    // despite hero having bet flop. Convention treats this as a donk.
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: VILLAIN_SEAT, action: 'bet', street: 'turn', amount: 6, order: 5 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('VS_DONK');
    expect(result.archetypeId).toBe('TURN_VS_DONK');
  });

  // ── River ───────────────────────────────────────────────────────────────

  it('RIVER BARREL — hero PFA, bet turn, bets river → RIVER_SRP_BET_IP', async () => {
    const result = await buildHeroState({
      gameState: riverGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', amount: 8, order: 5 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'turn', amount: 8, order: 6 },
          { seat: HERO_SEAT, action: 'bet', street: 'river', amount: 16, order: 7 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('BARREL');
    expect(result.archetypeId).toBe('RIVER_SRP_BET_IP');
  });

  it('RIVER VS_BARREL — hero non-PFA, called turn bet, faces river bet → RIVER_SRP_VS_BET_OOP', async () => {
    const result = await buildHeroState({
      gameState: riverGameState({
        inPosition: false,
        actionSequence: [
          ...SRP_PREFLOP,
          { seat: VILLAIN_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: HERO_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: VILLAIN_SEAT, action: 'bet', street: 'turn', amount: 8, order: 5 },
          { seat: HERO_SEAT, action: 'call', street: 'turn', amount: 8, order: 6 },
          { seat: VILLAIN_SEAT, action: 'bet', street: 'river', amount: 16, order: 7 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('VS_BARREL');
    expect(result.archetypeId).toBe('RIVER_SRP_VS_BET_OOP');
  });

  it('RIVER PROBE — flop+turn checked through, hero (non-PFA) leads river OOP → RIVER_PROBE', async () => {
    const result = await buildHeroState({
      gameState: riverGameState({
        inPosition: false,
        actionSequence: [
          ...SRP_PREFLOP, // villain is PFA
          { seat: HERO_SEAT, action: 'check', street: 'flop', order: 3 },
          { seat: VILLAIN_SEAT, action: 'check', street: 'flop', order: 4 },
          { seat: HERO_SEAT, action: 'check', street: 'turn', order: 5 },
          { seat: VILLAIN_SEAT, action: 'check', street: 'turn', order: 6 },
          { seat: HERO_SEAT, action: 'bet', street: 'river', amount: 5, order: 7 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('PROBE');
    expect(result.archetypeId).toBe('RIVER_PROBE');
  });

  it('RIVER PROBE requires BOTH flop and turn checked through — turn-bet break ≠ probe', async () => {
    // Hero non-PFA, flop checked through, villain bet turn (so prior streets
    // are NOT all checked through). Even if hero bets river, this is NOT a
    // probe spot — it's facing earlier aggression that broke the cheked-line.
    // Closest match: hero leading after villain bet turn falls back to CBET
    // (hero non-PFA leading current street) → RIVER_SRP_BET_OOP.
    const result = await buildHeroState({
      gameState: riverGameState({
        inPosition: false,
        actionSequence: [
          ...SRP_PREFLOP,
          { seat: HERO_SEAT, action: 'check', street: 'flop', order: 3 },
          { seat: VILLAIN_SEAT, action: 'check', street: 'flop', order: 4 },
          { seat: VILLAIN_SEAT, action: 'bet', street: 'turn', amount: 5, order: 5 },
          { seat: HERO_SEAT, action: 'call', street: 'turn', amount: 5, order: 6 },
          { seat: HERO_SEAT, action: 'bet', street: 'river', amount: 10, order: 7 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).not.toBe('PROBE');
    expect(result.archetypeId).not.toBe('RIVER_PROBE');
  });

  it('RIVER CBET (delayed) — hero PFA, bet flop, checked back turn IP, bets river → RIVER_DELAYED_BET', async () => {
    const result = await buildHeroState({
      gameState: riverGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: VILLAIN_SEAT, action: 'check', street: 'turn', order: 5 },
          { seat: HERO_SEAT, action: 'check', street: 'turn', order: 6 },
          { seat: VILLAIN_SEAT, action: 'check', street: 'river', order: 7 },
          { seat: HERO_SEAT, action: 'bet', street: 'river', amount: 10, order: 8 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('CBET');
    expect(result.archetypeId).toBe('RIVER_DELAYED_BET');
  });

  it('RIVER VS_DONK — hero PFA, bet flop+turn, villain called both, villain donks river → RIVER_VS_DONK', async () => {
    // Lead-into-PFA on later street: hero PFA bet flop AND turn, villain
    // called both. On river villain leads — villain hasn't been aggressor
    // on immediately-prior street (turn). VS_DONK.
    const result = await buildHeroState({
      gameState: riverGameState({
        inPosition: true,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', amount: 8, order: 5 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'turn', amount: 8, order: 6 },
          { seat: VILLAIN_SEAT, action: 'bet', street: 'river', amount: 12, order: 7 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('VS_DONK');
    expect(result.archetypeId).toBe('RIVER_VS_DONK');
  });

  // ── sizingFraction derivation ───────────────────────────────────────────

  it('derives sizingFraction from pendingBetSize/pot when caller omits sizingFraction → RIVER_BLOCK_BET', async () => {
    // Hero PFA, bet flop+turn, on river bets a small block. Caller passes
    // pendingBetSize + pot but not sizingFraction. Orchestrator derives
    // 5/20 = 0.25 ≤ 0.40 → BLOCK_BET routing per design doc §4.5.1.
    const result = await buildHeroState({
      gameState: riverGameState({
        inPosition: false,
        pot: 20,
        pendingBetSize: 5,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', amount: 8, order: 5 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'turn', amount: 8, order: 6 },
          { seat: HERO_SEAT, action: 'bet', street: 'river', amount: 5, order: 7 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.sizingFraction).toBeCloseTo(0.25, 5);
    expect(result.archetypeId).toBe('RIVER_BLOCK_BET');
  });

  it('caller-supplied sizingFraction wins over derived (no overwrite)', async () => {
    const result = await buildHeroState({
      gameState: riverGameState({
        pot: 20,
        pendingBetSize: 5, // would derive 0.25
        sizingFraction: 0.75, // caller explicit — wins
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.sizingFraction).toBe(0.75);
  });

  it('does not derive sizingFraction when pot is 0 (avoid divide-by-zero)', async () => {
    const result = await buildHeroState({
      gameState: riverGameState({
        pot: 0,
        pendingBetSize: 5,
        // No explicit sizingFraction.
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.sizingFraction).toBeNull();
  });

  // ── Backward-compat ─────────────────────────────────────────────────────

  it('caller-supplied actionContext wins over derived (precision is opt-in for routing, but explicit always wins)', async () => {
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: true,
        actionContext: 'BARREL', // explicit
        actionSequence: [
          // Action history would otherwise route to CBET-delayed (PFA checked
          // back flop), but caller-supplied BARREL wins.
          ...SRP_PREFLOP_HERO_PFA,
          { seat: VILLAIN_SEAT, action: 'check', street: 'flop', order: 3 },
          { seat: HERO_SEAT, action: 'check', street: 'flop', order: 4 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('BARREL');
    expect(result.archetypeId).toBe('TURN_SRP_BARREL_IP');
  });

  it('without heroSeat, turn still produces a valid TURN_* archetype via v1 fallback (backward-compat)', async () => {
    // The existing reconstructGameStateAt caller does NOT pass heroSeat yet.
    // It must keep working without regression.
    const result = await buildHeroState({
      gameState: {
        ...turnGameState(),
        heroSeat: undefined,
        actionSequence: [
          ...SRP_PREFLOP_HERO_PFA,
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 4, order: 3 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 4, order: 4 },
        ],
      },
      heroHand: HERO_HAND,
    });
    // v1 heuristic: no bet on current (turn) → CBET → TURN_DELAYED_CBET.
    // Loses BARREL precision but contract holds.
    expect(result.archetypeId).toMatch(/^TURN_/);
    expect(result.situation.actionContext).toBe('CBET');
  });

  // ── 3BP routing ─────────────────────────────────────────────────────────

  it('TURN BARREL in 3BP — hero PFA via 3bet, bet flop, bets turn → TURN_3BP_BARREL_IP', async () => {
    const result = await buildHeroState({
      gameState: turnGameState({
        inPosition: true,
        actionSequence: [
          { seat: VILLAIN_SEAT, action: 'raise', street: 'preflop', amount: 2.5, order: 1 },
          { seat: HERO_SEAT, action: 'raise', street: 'preflop', amount: 8, order: 2 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'preflop', amount: 8, order: 3 },
          { seat: HERO_SEAT, action: 'bet', street: 'flop', amount: 10, order: 4 },
          { seat: VILLAIN_SEAT, action: 'call', street: 'flop', amount: 10, order: 5 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', amount: 20, order: 6 },
        ],
      }),
      heroHand: HERO_HAND,
    });
    expect(result.situation.actionContext).toBe('BARREL');
    expect(result.situation.potType).toBe('3BP');
    expect(result.archetypeId).toBe('TURN_3BP_BARREL_IP');
  });
});

// ─── WS-155 / SPR-105: composedDelta integration ────────────────────────

describe('buildHeroState — composedDelta integration (WS-155)', () => {
  const callingStationProfile = () => ({
    style: 'Fish',
    rangeShape: { capped: false, polarization: 0.2 },
    vulnerabilities: [
      {
        condition: 'calling station',
        label: 'Over-calls on the river',
        delta: { sizingMultiplier: 1.2, polarize: true, bluffFreq: 0.15 },
        rationale: 'Over-calls river with weak holdings — value-bet thicker; polarize; reduce bluffs.',
        severity: 0.7,
        confidence: 0.6,
      },
    ],
  });

  const stackedProfile = () => ({
    style: 'Fish',
    rangeShape: { capped: false, polarization: 0.4 },
    vulnerabilities: [
      {
        delta: { sizingMultiplier: 1.3, polarize: true },
        rationale: 'Overvalues medium hands',
        severity: 0.7,
        confidence: 0.6,
      },
      {
        delta: { sizingMultiplier: 1.3 },
        rationale: 'Calls light to showdown',
        severity: 0.6,
        confidence: 0.5,
      },
      {
        delta: { sizingMultiplier: 1.3 },
        rationale: 'C-bets dry boards wide',
        severity: 0.5,
        confidence: 0.5,
      },
    ],
  });

  it('exposes composedDelta on the HeroState (no villain data → identity shape)', async () => {
    const result = await buildHeroState({
      gameState: preflopGameState(),
      heroHand: HERO_HAND,
    });
    expect(result.composedDelta).toEqual({
      sizingMultiplier: 1.0,
      polarize: false,
      bluffFreq: null,
      actionOverride: null,
      clamped: false,
      contributingCount: 0,
    });
  });

  it('composes calling-station vulnerability into composedDelta (1.2 / true / 0.15)', async () => {
    const result = await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      villainProfile: callingStationProfile(),
      villainRange: sampleVillainRange(),
    });
    expect(result.composedDelta.sizingMultiplier).toBeCloseTo(1.2, 5);
    expect(result.composedDelta.polarize).toBe(true);
    expect(result.composedDelta.bluffFreq).toBe(0.15);
    expect(result.composedDelta.clamped).toBe(false);
    expect(result.composedDelta.contributingCount).toBe(1);
  });

  it('clamps stacked sizingMultiplier (1.3³ → 2.0 with clamped:true)', async () => {
    const result = await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      villainProfile: stackedProfile(),
      villainRange: sampleVillainRange(),
    });
    expect(result.composedDelta.sizingMultiplier).toBe(2.0);
    expect(result.composedDelta.clamped).toBe(true);
    expect(result.composedDelta.polarize).toBe(true);
    expect(result.composedDelta.contributingCount).toBe(3);
  });

  it('soft-degrades when villainProfile is missing (composedDelta still present + identity)', async () => {
    const result = await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      // no villainProfile
    });
    expect(result.composedDelta).toBeDefined();
    expect(result.composedDelta.sizingMultiplier).toBe(1.0);
    expect(result.composedDelta.polarize).toBe(false);
    expect(result.composedDelta.bluffFreq).toBeNull();
    expect(result.composedDelta.contributingCount).toBe(0);
  });

  it('preserves adjustments[] alongside composedDelta (consumers can read either)', async () => {
    const result = await buildHeroState({
      gameState: flopGameState(),
      heroHand: HERO_HAND,
      villainProfile: callingStationProfile(),
      villainRange: sampleVillainRange(),
    });
    // Pre-composition Adjustment[] still present with rationale.
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0].condition).toBe('calling station');
    expect(result.adjustments[0].rationale).toContain('Over-calls river');
    expect(result.adjustments[0].delta.sizingMultiplier).toBe(1.2);
    // Post-composition ComposedDelta also present.
    expect(result.composedDelta.sizingMultiplier).toBe(1.2);
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
