/**
 * @file Tests for src/utils/heroState/classifyArchetype.js
 *
 * Coverage targets (per WS-141 + WS-153 accept_criteria):
 *   - Returns valid archetypeId for any preflop state (8 happy path + edge cases)
 *   - Returns valid archetypeId for any flop state (10 happy path + edge cases)
 *   - Returns valid archetypeId for any turn state (12 happy path + edge cases)
 *   - Returns valid archetypeId for any river state (14 happy path + edge cases)
 *   - Block-bet routing on river via sizingFraction axis (design doc §4.5.1)
 *   - All 47 ARCHETYPE_IDS reachable (smoke)
 *   - First-principles guard preserved: archetypeId is OUTPUT only.
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

// ─── Turn/river implemented (v2 — WS-153) ─────────────────────────────────

describe('classifyArchetype — turn/river implemented (v2 catalog)', () => {
  it('does NOT throw when street === turn', () => {
    expect(() => classifyArchetype(axes({ street: 'turn', actionContext: 'BARREL' }))).not.toThrow();
  });
  it('does NOT throw when street === river', () => {
    expect(() => classifyArchetype(axes({ street: 'river', actionContext: 'BARREL' }))).not.toThrow();
  });
  it('returns a TURN_* id for turn states', () => {
    const id = classifyArchetype(axes({ street: 'turn', actionContext: 'BARREL' }));
    expect(id).toMatch(/^TURN_/);
  });
  it('returns a RIVER_* id for river states', () => {
    const id = classifyArchetype(axes({ street: 'river', actionContext: 'BARREL' }));
    expect(id).toMatch(/^RIVER_/);
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
  it('CBET + 3 players + SRP → FLOP_MULTIWAY_SRP (WS-154 potType split)', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: 'SRP', playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY_SRP');
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
  it('multiway threshold: playersRemaining=2 → SRP archetype; =3 + SRP potType → FLOP_MULTIWAY_SRP', () => {
    const hu = classifyArchetype(axes({ playersRemaining: 2 }));
    const mw = classifyArchetype(axes({ playersRemaining: 3 }));
    expect(hu).toBe('FLOP_SRP_HU_IP_CBET');
    expect(mw).toBe('FLOP_MULTIWAY_SRP');
  });
  it('VS_DONK + 3 players + SRP → FLOP_MULTIWAY_SRP (multiway dominates VS_DONK; potType split routes)', () => {
    expect(classifyArchetype(axes({
      actionContext: 'VS_DONK', inPosition: false, playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY_SRP');
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

// ─── Flop multiway potType split (v3 — WS-154 / SPR-106) ──────────────────

describe('classifyArchetype — flop multiway potType split (WS-154)', () => {
  it('SRP + 3 players → FLOP_MULTIWAY_SRP', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: 'SRP', playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY_SRP');
  });
  it('SRP + 4 players → FLOP_MULTIWAY_SRP (4-way also routes SRP)', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: 'SRP', playersRemaining: 4,
    }))).toBe('FLOP_MULTIWAY_SRP');
  });
  it('3BP + 3 players → FLOP_MULTIWAY_3BP', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: '3BP', playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY_3BP');
  });
  it('4BP + 3 players → FLOP_MULTIWAY_3BP (4BP inherits 3BP per §4.3.1)', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: '4BP', playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY_3BP');
  });
  it('LIMPED + 3 players → FLOP_MULTIWAY_LIMPED', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: 'LIMPED', playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY_LIMPED');
  });
  it('multiway + null potType → FLOP_MULTIWAY catch-all', () => {
    expect(classifyArchetype(axes({
      actionContext: 'CBET', inPosition: true, potType: null, playersRemaining: 3,
    }))).toBe('FLOP_MULTIWAY');
  });
  it('turn multiway stays single archetype (v3_TODO not yet split)', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'BARREL', inPosition: true, potType: 'SRP', playersRemaining: 3,
    }))).toBe('TURN_MULTIWAY');
  });
  it('river multiway stays single archetype (v3_TODO not yet split)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: true, potType: 'SRP', playersRemaining: 3,
    }))).toBe('RIVER_MULTIWAY');
  });
});

// ─── Turn archetypes (12 happy path) ──────────────────────────────────────

describe('classifyArchetype — 12 turn archetypes', () => {
  it('SRP BARREL IP → TURN_SRP_BARREL_IP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'BARREL', inPosition: true, potType: 'SRP',
    }))).toBe('TURN_SRP_BARREL_IP');
  });
  it('SRP BARREL OOP → TURN_SRP_BARREL_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'BARREL', inPosition: false, potType: 'SRP',
    }))).toBe('TURN_SRP_BARREL_OOP');
  });
  it('SRP VS_BARREL IP → TURN_SRP_VS_BARREL_IP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'VS_BARREL', inPosition: true, potType: 'SRP',
    }))).toBe('TURN_SRP_VS_BARREL_IP');
  });
  it('SRP VS_BARREL OOP → TURN_SRP_VS_BARREL_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'VS_BARREL', inPosition: false, potType: 'SRP',
    }))).toBe('TURN_SRP_VS_BARREL_OOP');
  });
  it('3BP BARREL IP → TURN_3BP_BARREL_IP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'BARREL', inPosition: true, potType: '3BP',
    }))).toBe('TURN_3BP_BARREL_IP');
  });
  it('3BP BARREL OOP → TURN_3BP_BARREL_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'BARREL', inPosition: false, potType: '3BP',
    }))).toBe('TURN_3BP_BARREL_OOP');
  });
  it('3BP VS_BARREL IP → TURN_3BP_VS_BARREL_IP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'VS_BARREL', inPosition: true, potType: '3BP',
    }))).toBe('TURN_3BP_VS_BARREL_IP');
  });
  it('3BP VS_BARREL OOP → TURN_3BP_VS_BARREL_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'VS_BARREL', inPosition: false, potType: '3BP',
    }))).toBe('TURN_3BP_VS_BARREL_OOP');
  });
  it('PROBE on turn → TURN_PROBE', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'PROBE', inPosition: false, potType: 'SRP',
    }))).toBe('TURN_PROBE');
  });
  it('CBET on turn (delayed) → TURN_DELAYED_CBET', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'CBET', inPosition: true, potType: 'SRP',
    }))).toBe('TURN_DELAYED_CBET');
  });
  it('3 players on turn → TURN_MULTIWAY (multiway dominates)', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'BARREL', playersRemaining: 3,
    }))).toBe('TURN_MULTIWAY');
  });
  it('VS_DONK on turn → TURN_VS_DONK', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'VS_DONK', inPosition: false,
    }))).toBe('TURN_VS_DONK');
  });
});

// ─── Turn edge cases ──────────────────────────────────────────────────────

describe('classifyArchetype — turn edge cases', () => {
  it('4BP BARREL IP on turn → TURN_3BP_BARREL_IP (inherited 4BP→3BP fallback)', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'BARREL', inPosition: true, potType: '4BP',
    }))).toBe('TURN_3BP_BARREL_IP');
  });
  it('VS_CBET on turn → VS_BARREL family (callsite-vocab closest match)', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'VS_CBET', inPosition: false, potType: 'SRP',
    }))).toBe('TURN_SRP_VS_BARREL_OOP');
  });
  it('multiway dominates VS_DONK on turn', () => {
    expect(classifyArchetype(axes({
      street: 'turn', actionContext: 'VS_DONK', playersRemaining: 3,
    }))).toBe('TURN_MULTIWAY');
  });
});

// ─── River archetypes (14 happy path) ─────────────────────────────────────

describe('classifyArchetype — 14 river archetypes', () => {
  it('SRP BARREL IP on river → RIVER_SRP_BET_IP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: true, potType: 'SRP',
    }))).toBe('RIVER_SRP_BET_IP');
  });
  it('SRP BARREL OOP on river → RIVER_SRP_BET_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: false, potType: 'SRP',
    }))).toBe('RIVER_SRP_BET_OOP');
  });
  it('SRP VS_BARREL IP on river → RIVER_SRP_VS_BET_IP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_BARREL', inPosition: true, potType: 'SRP',
    }))).toBe('RIVER_SRP_VS_BET_IP');
  });
  it('SRP VS_BARREL OOP on river → RIVER_SRP_VS_BET_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_BARREL', inPosition: false, potType: 'SRP',
    }))).toBe('RIVER_SRP_VS_BET_OOP');
  });
  it('3BP BARREL IP on river → RIVER_3BP_BET_IP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: true, potType: '3BP',
    }))).toBe('RIVER_3BP_BET_IP');
  });
  it('3BP BARREL OOP on river → RIVER_3BP_BET_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: false, potType: '3BP',
    }))).toBe('RIVER_3BP_BET_OOP');
  });
  it('3BP VS_BARREL IP on river → RIVER_3BP_VS_BET_IP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_BARREL', inPosition: true, potType: '3BP',
    }))).toBe('RIVER_3BP_VS_BET_IP');
  });
  it('3BP VS_BARREL OOP on river → RIVER_3BP_VS_BET_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_BARREL', inPosition: false, potType: '3BP',
    }))).toBe('RIVER_3BP_VS_BET_OOP');
  });
  it('PROBE on river → RIVER_PROBE', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'PROBE', inPosition: false, potType: 'SRP',
    }))).toBe('RIVER_PROBE');
  });
  it('CBET on river (delayed) → RIVER_DELAYED_BET', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'CBET', inPosition: true, potType: 'SRP',
    }))).toBe('RIVER_DELAYED_BET');
  });
  it('3 players on river → RIVER_MULTIWAY (multiway dominates)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', playersRemaining: 3,
    }))).toBe('RIVER_MULTIWAY');
  });
  it('VS_DONK on river → RIVER_VS_DONK', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_DONK', inPosition: false,
    }))).toBe('RIVER_VS_DONK');
  });
  it('hero OOP small lead (sizingFraction=0.33) on river → RIVER_BLOCK_BET', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: false, potType: 'SRP',
      sizingFraction: 0.33,
    }))).toBe('RIVER_BLOCK_BET');
  });
  it('facing small bet (sizingFraction=0.30) on river → RIVER_VS_BLOCK_BET', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_BARREL', inPosition: true, potType: 'SRP',
      sizingFraction: 0.30,
    }))).toBe('RIVER_VS_BLOCK_BET');
  });
});

// ─── River edge cases ─────────────────────────────────────────────────────

describe('classifyArchetype — river edge cases', () => {
  it('4BP BARREL IP on river → RIVER_3BP_BET_IP (inherited 4BP→3BP fallback)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: true, potType: '4BP',
    }))).toBe('RIVER_3BP_BET_IP');
  });
  it('VS_CBET on river → VS_BET family (callsite-vocab closest match)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_CBET', inPosition: false, potType: 'SRP',
    }))).toBe('RIVER_SRP_VS_BET_OOP');
  });
  it('multiway dominates VS_DONK on river', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_DONK', playersRemaining: 3,
    }))).toBe('RIVER_MULTIWAY');
  });
  it('sizingFraction = 0.40 (boundary) on hero OOP bet → RIVER_BLOCK_BET (inclusive)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: false, potType: 'SRP',
      sizingFraction: 0.40,
    }))).toBe('RIVER_BLOCK_BET');
  });
  it('sizingFraction = 0.50 (above threshold) on hero OOP bet → standard RIVER_SRP_BET_OOP', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: false, potType: 'SRP',
      sizingFraction: 0.50,
    }))).toBe('RIVER_SRP_BET_OOP');
  });
  it('sizingFraction undefined → standard routing (no block-bet)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: false, potType: 'SRP',
    }))).toBe('RIVER_SRP_BET_OOP');
  });
  it('hero IP small bet (sizingFraction=0.30) → standard routing (block-bet is OOP by definition)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: true, potType: 'SRP',
      sizingFraction: 0.30,
    }))).toBe('RIVER_SRP_BET_IP');
  });
  it('multiway dominates sizingFraction routing', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'BARREL', inPosition: false, playersRemaining: 3,
      potType: 'SRP', sizingFraction: 0.30,
    }))).toBe('RIVER_MULTIWAY');
  });
  it('block-bet defending is position-agnostic (OOP also routes VS_BLOCK_BET)', () => {
    expect(classifyArchetype(axes({
      street: 'river', actionContext: 'VS_BARREL', inPosition: false, potType: 'SRP',
      sizingFraction: 0.30,
    }))).toBe('RIVER_VS_BLOCK_BET');
  });
});

// ─── Coverage smoke ───────────────────────────────────────────────────────

describe('classifyArchetype — full ARCHETYPE_IDS reachability', () => {
  it('all 47 ARCHETYPE_IDS are reachable via at least one input combination', () => {
    const reached = new Set();
    const cases = [
      // Preflop (8)
      { street: 'preflop', actionContext: 'OPEN',       positionClass: 'HJ',  inPosition: null, playersRemaining: 9, potType: null },
      { street: 'preflop', actionContext: 'VS_OPEN',    positionClass: 'BB',  inPosition: null, playersRemaining: 8, potType: null },
      { street: 'preflop', actionContext: 'VS_OPEN',    positionClass: 'SB',  inPosition: null, playersRemaining: 8, potType: null },
      { street: 'preflop', actionContext: 'VS_OPEN',    positionClass: 'BTN', inPosition: null, playersRemaining: 8, potType: null },
      { street: 'preflop', actionContext: '3BET',       positionClass: 'BTN', inPosition: null, playersRemaining: 7, potType: null },
      { street: 'preflop', actionContext: 'SQUEEZE',    positionClass: 'CO',  inPosition: null, playersRemaining: 6, potType: null },
      { street: 'preflop', actionContext: 'VS_3BET',    positionClass: 'HJ',  inPosition: null, playersRemaining: 7, potType: null },
      { street: 'preflop', actionContext: 'LIMP_NAV',   positionClass: 'BTN', inPosition: null, playersRemaining: 5, potType: null },
      // Flop (10)
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'flop', actionContext: 'VS_CBET',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      // Flop multiway potType split (WS-154) — 3 sub-archetypes + 1 catch-all
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 4, potType: 'SRP' },     // FLOP_MULTIWAY_SRP
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 3, potType: '3BP' },     // FLOP_MULTIWAY_3BP
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 3, potType: 'LIMPED' },  // FLOP_MULTIWAY_LIMPED
      { street: 'flop', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 3, potType: null },      // FLOP_MULTIWAY catch-all
      { street: 'flop', actionContext: 'VS_DONK',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      // Turn (12)
      { street: 'turn', actionContext: 'BARREL',        positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'turn', actionContext: 'BARREL',        positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'turn', actionContext: 'VS_BARREL',     positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'turn', actionContext: 'VS_BARREL',     positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'turn', actionContext: 'BARREL',        positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'turn', actionContext: 'BARREL',        positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      { street: 'turn', actionContext: 'VS_BARREL',     positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'turn', actionContext: 'VS_BARREL',     positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      { street: 'turn', actionContext: 'PROBE',         positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'turn', actionContext: 'CBET',          positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'turn', actionContext: 'BARREL',        positionClass: 'BTN', inPosition: true,  playersRemaining: 3, potType: 'SRP' },
      { street: 'turn', actionContext: 'VS_DONK',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      // River (14)
      { street: 'river', actionContext: 'BARREL',       positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'river', actionContext: 'BARREL',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'river', actionContext: 'VS_BARREL',    positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'river', actionContext: 'VS_BARREL',    positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'river', actionContext: 'BARREL',       positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'river', actionContext: 'BARREL',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      { street: 'river', actionContext: 'VS_BARREL',    positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: '3BP' },
      { street: 'river', actionContext: 'VS_BARREL',    positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: '3BP' },
      { street: 'river', actionContext: 'PROBE',        positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'river', actionContext: 'CBET',         positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP' },
      { street: 'river', actionContext: 'BARREL',       positionClass: 'BTN', inPosition: true,  playersRemaining: 3, potType: 'SRP' },
      { street: 'river', actionContext: 'VS_DONK',      positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP' },
      { street: 'river', actionContext: 'BARREL',       positionClass: 'BB',  inPosition: false, playersRemaining: 2, potType: 'SRP', sizingFraction: 0.30 },
      { street: 'river', actionContext: 'VS_BARREL',    positionClass: 'BTN', inPosition: true,  playersRemaining: 2, potType: 'SRP', sizingFraction: 0.30 },
    ];
    for (const c of cases) {
      reached.add(classifyArchetype(c));
    }
    for (const id of ARCHETYPE_IDS) {
      expect(reached, `archetype unreachable: ${id}`).toContain(id);
    }
    expect(reached.size).toBe(ARCHETYPE_IDS.length); // 47 (v3 catalog)
  });
});
