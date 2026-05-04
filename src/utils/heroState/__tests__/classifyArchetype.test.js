/**
 * @file Tests for src/utils/heroState/classifyArchetype.js
 *
 * Coverage targets (per WS-141 accept_criteria):
 *   - Returns valid archetypeId for any preflop state (8 happy path + edge cases)
 *   - Returns valid archetypeId for any flop state (10 happy path + edge cases)
 *   - Throws for turn/river
 *   - Boundary cases (each pot type / each position / multiway)
 *   - All 18 ARCHETYPE_IDS reachable (smoke)
 */

import { describe, it, expect } from 'vitest';
import { classifyArchetype } from '../classifyArchetype.js';
import { ARCHETYPE_IDS } from '../types.js';

// Minimal fixture builder.
const axes = (overrides = {}) => ({
  street: 'flop',
  actionContext: 'CBET',
  positionClass: 'BTN',
  inPosition: true,
  playersRemaining: 2,
  potType: 'SRP',
  ...overrides,
});

// ─── Throws turn/river ────────────────────────────────────────────────────

describe('classifyArchetype — turn/river deferred to v2', () => {
  it('throws Error containing "turn" when street === turn', () => {
    expect(() => classifyArchetype(axes({ street: 'turn' }))).toThrow(/turn/);
  });
  it('throws Error containing "river" when street === river', () => {
    expect(() => classifyArchetype(axes({ street: 'river' }))).toThrow(/river/);
  });
});

// ─── Preflop archetypes (8 happy path) ────────────────────────────────────

describe('classifyArchetype — 8 preflop archetypes', () => {
  it('OPEN + position=HJ → PF_OPEN_RFI', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'OPEN', positionClass: 'HJ',
      inPosition: null, potType: null,
    }))).toBe('PF_OPEN_RFI');
  });
  it('VS_OPEN + position=BB → PF_VS_OPEN_BB', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'VS_OPEN', positionClass: 'BB',
      inPosition: null, potType: null,
    }))).toBe('PF_VS_OPEN_BB');
  });
  it('VS_OPEN + position=SB → PF_VS_OPEN_SB', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'VS_OPEN', positionClass: 'SB',
      inPosition: null, potType: null,
    }))).toBe('PF_VS_OPEN_SB');
  });
  it('VS_OPEN + position=BTN → PF_VS_OPEN_IP', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'VS_OPEN', positionClass: 'BTN',
      inPosition: null, potType: null,
    }))).toBe('PF_VS_OPEN_IP');
  });
  it('3BET + position=BTN → PF_3BET', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: '3BET', positionClass: 'BTN',
      inPosition: null, potType: null,
    }))).toBe('PF_3BET');
  });
  it('SQUEEZE + position=CO → PF_SQUEEZE', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'SQUEEZE', positionClass: 'CO',
      inPosition: null, potType: null,
    }))).toBe('PF_SQUEEZE');
  });
  it('VS_3BET + position=HJ → PF_VS_3BET', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'VS_3BET', positionClass: 'HJ',
      inPosition: null, potType: null,
    }))).toBe('PF_VS_3BET');
  });
  it('LIMP_NAV + position=BTN → PF_LIMP_NAV', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'LIMP_NAV', positionClass: 'BTN',
      inPosition: null, potType: null,
    }))).toBe('PF_LIMP_NAV');
  });
});

// ─── Preflop edge cases ───────────────────────────────────────────────────

describe('classifyArchetype — preflop edge cases', () => {
  it('VS_OPEN + position=CO (IP cold-call) → PF_VS_OPEN_IP', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'VS_OPEN', positionClass: 'CO',
      inPosition: null, potType: null,
    }))).toBe('PF_VS_OPEN_IP');
  });
  it('VS_SQUEEZE + position=HJ → PF_VS_3BET (closest-match fallback)', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'VS_SQUEEZE', positionClass: 'HJ',
      inPosition: null, potType: null,
    }))).toBe('PF_VS_3BET');
  });
  it('OPEN + position=SB (rare) → PF_OPEN_RFI (documented fallback)', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'OPEN', positionClass: 'SB',
      inPosition: null, potType: null,
    }))).toBe('PF_OPEN_RFI');
  });
  it('OPEN + position=BB (defensive) → PF_OPEN_RFI', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'OPEN', positionClass: 'BB',
      inPosition: null, potType: null,
    }))).toBe('PF_OPEN_RFI');
  });
  it('postflop actionContext on preflop (callsite bug) → PF_OPEN_RFI fallback', () => {
    expect(classifyArchetype(axes({
      street: 'preflop', actionContext: 'CBET', positionClass: 'BTN',
      inPosition: null, potType: null,
    }))).toBe('PF_OPEN_RFI');
  });
});

// ─── Flop archetypes (10 happy path) ──────────────────────────────────────

describe('classifyArchetype — 10 flop archetypes', () => {
  it('CBET + IP + SRP + 2 players → FLOP_SRP_HU_IP_CBET', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: 'SRP', playersRemaining: 2,
    }))).toBe('FLOP_SRP_HU_IP_CBET');
  });
  it('CBET + OOP + SRP + 2 players → FLOP_SRP_HU_OOP_CBET', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: false, potType: 'SRP', playersRemaining: 2,
    }))).toBe('FLOP_SRP_HU_OOP_CBET');
  });
  it('VS_CBET + IP + SRP + 2 players → FLOP_SRP_HU_IP_VS_CBET', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_CBET', inPosition: true, potType: 'SRP', playersRemaining: 2,
    }))).toBe('FLOP_SRP_HU_IP_VS_CBET');
  });
  it('VS_CBET + OOP + SRP + 2 players → FLOP_SRP_HU_OOP_VS_CBET', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_CBET', inPosition: false, potType: 'SRP', playersRemaining: 2,
    }))).toBe('FLOP_SRP_HU_OOP_VS_CBET');
  });
  it('CBET + IP + 3BP + 2 players → FLOP_3BP_HU_IP_CBET', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: '3BP', playersRemaining: 2,
    }))).toBe('FLOP_3BP_HU_IP_CBET');
  });
  it('CBET + OOP + 3BP + 2 players → FLOP_3BP_HU_OOP_CBET', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: false, potType: '3BP', playersRemaining: 2,
    }))).toBe('FLOP_3BP_HU_OOP_CBET');
  });
  it('VS_CBET + IP + 3BP + 2 players → FLOP_3BP_VS_CBET_IP', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_CBET', inPosition: true, potType: '3BP', playersRemaining: 2,
    }))).toBe('FLOP_3BP_VS_CBET_IP');
  });
  it('VS_CBET + OOP + 3BP + 2 players → FLOP_3BP_VS_CBET_OOP', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_CBET', inPosition: false, potType: '3BP', playersRemaining: 2,
    }))).toBe('FLOP_3BP_VS_CBET_OOP');
  });
  it('CBET + 3 players → FLOP_MULTIWAY (multiway dominates)', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: 'SRP', playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY');
  });
  it('VS_DONK + 2 players → FLOP_VS_DONK', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_DONK', inPosition: false, potType: 'SRP', playersRemaining: 2,
    }))).toBe('FLOP_VS_DONK');
  });
});

// ─── Flop edge cases ──────────────────────────────────────────────────────

describe('classifyArchetype — flop edge cases', () => {
  it('4BP CBET IP → FLOP_3BP_HU_IP_CBET (Q2 resolution)', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: '4BP', playersRemaining: 2,
    }))).toBe('FLOP_3BP_HU_IP_CBET');
  });
  it('4BP VS_CBET OOP → FLOP_3BP_VS_CBET_OOP', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_CBET', inPosition: false, potType: '4BP', playersRemaining: 2,
    }))).toBe('FLOP_3BP_VS_CBET_OOP');
  });
  it('multiway threshold: playersRemaining=2 → SRP archetype; =3 → FLOP_MULTIWAY', () => {
    const hu = classifyArchetype(axes({ playersRemaining: 2 }));
    const mw = classifyArchetype(axes({ playersRemaining: 3 }));
    expect(hu).toBe('FLOP_SRP_HU_IP_CBET');
    expect(mw).toBe('FLOP_MULTIWAY');
  });
  it('VS_DONK + 3 players → FLOP_MULTIWAY (multiway dominates VS_DONK)', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_DONK', inPosition: false, playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY');
  });
  it('BARREL on flop (anomalous) → CBET-equivalent SRP archetype', () => {
    expect(classifyArchetype(axes({
      actionContext: 'BARREL', inPosition: true, potType: 'SRP', playersRemaining: 2,
    }))).toBe('FLOP_SRP_HU_IP_CBET');
  });
  it('BARREL on flop + 3BP + OOP → 3BP CBET-equivalent', () => {
    expect(classifyArchetype(axes({
      actionContext: 'BARREL', inPosition: false, potType: '3BP', playersRemaining: 2,
    }))).toBe('FLOP_3BP_HU_OOP_CBET');
  });
});

// ─── Coverage smoke ───────────────────────────────────────────────────────

describe('classifyArchetype — full ARCHETYPE_IDS reachability', () => {
  it('all 18 ARCHETYPE_IDS are reachable via at least one input combination', () => {
    const reached = new Set();
    const cases = [
      // Preflop
      { street: 'preflop', actionContext: 'OPEN',       positionClass: 'HJ', inPosition: null, playersRemaining: 9, potType: null },
      { street: 'preflop', actionContext: 'VS_OPEN',    positionClass: 'BB', inPosition: null, playersRemaining: 8, potType: null },
      { street: 'preflop', actionContext: 'VS_OPEN',    positionClass: 'SB', inPosition: null, playersRemaining: 8, potType: null },
      { street: 'preflop', actionContext: 'VS_OPEN',    positionClass: 'BTN', inPosition: null, playersRemaining: 8, potType: null },
      { street: 'preflop', actionContext: '3BET',       positionClass: 'BTN', inPosition: null, playersRemaining: 7, potType: null },
      { street: 'preflop', actionContext: 'SQUEEZE',    positionClass: 'CO',  inPosition: null, playersRemaining: 6, potType: null },
      { street: 'preflop', actionContext: 'VS_3BET',    positionClass: 'HJ',  inPosition: null, playersRemaining: 7, potType: null },
      { street: 'preflop', actionContext: 'LIMP_NAV',   positionClass: 'BTN', inPosition: null, playersRemaining: 5, potType: null },
      // Flop
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 4, potType: 'SRP' },
      { street: 'flop', actionContext: 'VS_DONK',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
    ];
    for (const c of cases) {
      reached.add(classifyArchetype(c));
    }
    for (const id of ARCHETYPE_IDS) {
      expect(reached).toContain(id);
    }
    expect(reached.size).toBe(ARCHETYPE_IDS.length); // 18
  });
});
