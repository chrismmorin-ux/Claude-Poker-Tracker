import { describe, it, expect } from 'vitest';
import {
  SPR_ZONES,
  getSPRZone,
  ARCHETYPE_FAMILIES,
  ARCHETYPE_IDS,
  ACTION_CONTEXTS,
  POSITION_CLASSES,
  STREETS,
  HAND_CLASSES,
  HAND_STRENGTHS,
  BOARD_TEXTURES,
  ADVANTAGE_VALUES,
  PLAN_ACTIONS,
  MULTIWAY_HERO_ROLES,
} from '../types.js';
import { SPR_ZONES as SPR_ZONES_SOURCE } from '../../exploitEngine/gameTreeConstants.js';

describe('heroState/types', () => {
  it('re-exports SPR_ZONES from gameTreeConstants without duplicating', () => {
    expect(SPR_ZONES).toBe(SPR_ZONES_SOURCE);
    expect(SPR_ZONES.MICRO).toBe('micro');
    expect(SPR_ZONES.DEEP).toBe('deep');
  });

  it('re-exports getSPRZone helper', () => {
    expect(typeof getSPRZone).toBe('function');
    expect(getSPRZone(1)).toBe(SPR_ZONES.MICRO);
    expect(getSPRZone(15)).toBe(SPR_ZONES.DEEP);
    expect(getSPRZone(null)).toBe(null);
  });

  it('exports ARCHETYPE_FAMILIES as a const array covering preflop + flop families', () => {
    expect(Array.isArray(ARCHETYPE_FAMILIES)).toBe(true);
    expect(ARCHETYPE_FAMILIES).toContain('PREFLOP_OPEN');
    expect(ARCHETYPE_FAMILIES).toContain('FLOP_SRP_HU_CBET');
    expect(ARCHETYPE_FAMILIES).toContain('FLOP_MULTIWAY');
    expect(ARCHETYPE_FAMILIES.length).toBeGreaterThanOrEqual(11);
  });

  it('exports ACTION_CONTEXTS covering preflop + postflop decision structures', () => {
    expect(ACTION_CONTEXTS).toContain('OPEN');
    expect(ACTION_CONTEXTS).toContain('VS_OPEN');
    expect(ACTION_CONTEXTS).toContain('3BET');
    expect(ACTION_CONTEXTS).toContain('CBET');
    expect(ACTION_CONTEXTS).toContain('VS_DONK');
    expect(ACTION_CONTEXTS).toContain('LIMP_NAV');
    expect(ACTION_CONTEXTS).toContain('MULTIWAY');
  });

  it('exports POSITION_CLASSES in dealing order EP→BB', () => {
    expect(POSITION_CLASSES).toEqual(['EP', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });

  it('exports STREETS in chronological order', () => {
    expect(STREETS).toEqual(['preflop', 'flop', 'turn', 'river']);
  });

  it('exports HAND_CLASSES range-position descriptors', () => {
    expect(HAND_CLASSES).toContain('TOP_OF_RANGE');
    expect(HAND_CLASSES).toContain('AIR');
    expect(HAND_CLASSES).toContain('BLOCKER');
  });

  it('exports HAND_STRENGTHS fine-grained absolute strength', () => {
    expect(HAND_STRENGTHS).toContain('PREMIUM');
    expect(HAND_STRENGTHS).toContain('OVERPAIR');
    expect(HAND_STRENGTHS).toContain('TPTK');
    expect(HAND_STRENGTHS).toContain('AIR');
  });

  it('exports BOARD_TEXTURES with both shape and high-card axes', () => {
    expect(BOARD_TEXTURES).toContain('DRY');
    expect(BOARD_TEXTURES).toContain('PAIRED');
    expect(BOARD_TEXTURES).toContain('MONOTONE');
    expect(BOARD_TEXTURES).toContain('ACE_HIGH');
  });

  it('exports ADVANTAGE_VALUES as the canonical {hero, villain, neutral} triple', () => {
    expect(ADVANTAGE_VALUES).toEqual(['hero', 'villain', 'neutral']);
  });

  it('exports PLAN_ACTIONS covering all standard hero choices', () => {
    expect(PLAN_ACTIONS).toEqual(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE']);
  });

  // v3 catalog assertions (WS-154 / SPR-106 2026-06-04) — flop grew by 3
  // multiway sub-archetypes (FLOP_MULTIWAY_SRP / _3BP / _LIMPED).
  it('ARCHETYPE_IDS v3 catalog has 47 entries (8 PF + 13 flop + 12 turn + 14 river)', () => {
    expect(ARCHETYPE_IDS.length).toBe(47);
  });

  it('ARCHETYPE_IDS contains the WS-154 multiway sub-archetypes', () => {
    expect(ARCHETYPE_IDS).toContain('FLOP_MULTIWAY');
    expect(ARCHETYPE_IDS).toContain('FLOP_MULTIWAY_SRP');
    expect(ARCHETYPE_IDS).toContain('FLOP_MULTIWAY_3BP');
    expect(ARCHETYPE_IDS).toContain('FLOP_MULTIWAY_LIMPED');
  });

  it('exports MULTIWAY_HERO_ROLES descriptor enum (WS-154)', () => {
    expect(MULTIWAY_HERO_ROLES).toEqual([
      'PFR_LEADING',
      'CALLER_PFR_BEHIND',
      'CALLER_PFR_ACTED',
      'LIMPER',
    ]);
  });
});
