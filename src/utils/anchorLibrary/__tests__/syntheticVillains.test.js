/**
 * syntheticVillains.test.js — Verifies each policy produces the seed-anchor-declared
 * observed rate when given a trigger-matching node.
 *
 * These tests are the ground-truth contract: the synthetic policies must produce
 * rates matching what the seed-anchor markdown declares, or the Tier-1 scenarios
 * will fail spuriously in Commit 2.5 end-to-end wiring.
 */

import { describe, it, expect } from 'vitest';

import {
  NIT_SCARE_OVERFOLD,
  LAG_TURN_XX_OVERBLUFF,
  FISH_PAIRED_OVERCALL,
  TAG_OFFSCRIPT_VALUE_READ,
  ANCHOR_SEED_VILLAINS,
} from '../__sim__/syntheticVillains';

// ───────────────────────────────────────────────────────────────────────────
// NIT_SCARE_OVERFOLD
// ───────────────────────────────────────────────────────────────────────────

describe('NIT_SCARE_OVERFOLD', () => {
  it('folds 72% on scare-completing river to overbet (seed-01 trigger)', () => {
    const action = NIT_SCARE_OVERFOLD.actionAtNode(
      { street: 'river', texture: 'flush-complete', betSizePot: 1.2 },
      null,
    );
    expect(action.fold).toBeCloseTo(0.72, 2);
    expect(action.fold + action.call + action.raise).toBeCloseTo(1.0, 3);
  });

  it('also fires on straight-completing rivers', () => {
    const action = NIT_SCARE_OVERFOLD.actionAtNode(
      { street: 'river', texture: 'straight-complete', betSizePot: 1.0 },
      null,
    );
    expect(action.fold).toBeCloseTo(0.72, 2);
  });

  it('does NOT fire on non-scare rivers (uses 0.48 population baseline)', () => {
    const action = NIT_SCARE_OVERFOLD.actionAtNode(
      { street: 'river', texture: 'dry', betSizePot: 1.2 },
      null,
    );
    expect(action.fold).toBeCloseTo(0.48, 2);
  });

  it('does NOT fire on smaller bets even with scare', () => {
    const action = NIT_SCARE_OVERFOLD.actionAtNode(
      { street: 'river', texture: 'flush-complete', betSizePot: 0.75 },
      null,
    );
    expect(action.fold).toBeCloseTo(0.48, 2);
  });

  it('has deterministic seed + targetAnchor', () => {
    expect(NIT_SCARE_OVERFOLD.seed).toBe(101);
    expect(NIT_SCARE_OVERFOLD.targetAnchor).toBe('EAL-SEED-01');
    expect(NIT_SCARE_OVERFOLD.styleLabel).toBe('Nit');
  });

  it('declares expectedObservedRates matching seed-01 pointEstimate 0.72', () => {
    expect(NIT_SCARE_OVERFOLD.expectedObservedRates.foldToRiverBet.rate).toBeCloseTo(0.72, 2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LAG_TURN_XX_OVERBLUFF
// ───────────────────────────────────────────────────────────────────────────

describe('LAG_TURN_XX_OVERBLUFF', () => {
  it('fires on river probe after turn check-check with 0.66-0.80 pot bet', () => {
    const action = LAG_TURN_XX_OVERBLUFF.actionAtNode(
      {
        street: 'river',
        precedingStreetSequence: ['flop:villainBet', 'turn:checkCheck'],
        villainAction: 'bet',
        betSizePot: 0.75,
      },
      null,
    );
    expect(action._villainBetIsBluff).toBeCloseTo(0.62, 2);
    expect(action.bet).toBe(1.0);
  });

  it('does NOT fire without turn check-check history', () => {
    const action = LAG_TURN_XX_OVERBLUFF.actionAtNode(
      {
        street: 'river',
        precedingStreetSequence: ['flop:villainBet', 'turn:villainBet'],
        villainAction: 'bet',
        betSizePot: 0.75,
      },
      null,
    );
    expect(action._villainBetIsBluff).toBeCloseTo(0.50, 2);
  });

  it('does NOT fire on bet size outside range', () => {
    const action = LAG_TURN_XX_OVERBLUFF.actionAtNode(
      {
        street: 'river',
        precedingStreetSequence: ['turn:checkCheck'],
        villainAction: 'bet',
        betSizePot: 0.50, // below 0.66 range
      },
      null,
    );
    expect(action._villainBetIsBluff).toBeCloseTo(0.50, 2);
  });

  it('targets EAL-SEED-02 with deterministic seed', () => {
    expect(LAG_TURN_XX_OVERBLUFF.targetAnchor).toBe('EAL-SEED-02');
    expect(LAG_TURN_XX_OVERBLUFF.seed).toBe(102);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FISH_PAIRED_OVERCALL
// ───────────────────────────────────────────────────────────────────────────

describe('FISH_PAIRED_OVERCALL', () => {
  it('calls 76% on paired turn double-barrel (seed-03 trigger)', () => {
    const action = FISH_PAIRED_OVERCALL.actionAtNode(
      {
        street: 'turn',
        texture: 'paired',
        precedingStreetSequence: ['flop:villainCall'],
        heroIsAggressor: true,
        betSizePot: 0.70,
      },
      null,
    );
    expect(action.call).toBeCloseTo(0.76, 2);
    expect(action.fold).toBeCloseTo(0.20, 2);
    expect(action.fold + action.call + action.raise).toBeCloseTo(1.0, 3);
  });

  it('does NOT fire without preceding flop-villainCall', () => {
    const action = FISH_PAIRED_OVERCALL.actionAtNode(
      {
        street: 'turn',
        texture: 'paired',
        precedingStreetSequence: [],
        heroIsAggressor: true,
        betSizePot: 0.70,
      },
      null,
    );
    expect(action.call).toBeCloseTo(0.58, 2);
  });

  it('does NOT fire on non-paired turns', () => {
    const action = FISH_PAIRED_OVERCALL.actionAtNode(
      {
        street: 'turn',
        texture: 'dry',
        precedingStreetSequence: ['flop:villainCall'],
        heroIsAggressor: true,
        betSizePot: 0.70,
      },
      null,
    );
    expect(action.call).toBeCloseTo(0.58, 2);
  });

  it('targets EAL-SEED-03', () => {
    expect(FISH_PAIRED_OVERCALL.targetAnchor).toBe('EAL-SEED-03');
    expect(FISH_PAIRED_OVERCALL.seed).toBe(103);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// TAG_OFFSCRIPT_VALUE_READ
// ───────────────────────────────────────────────────────────────────────────

describe('TAG_OFFSCRIPT_VALUE_READ', () => {
  it('folds 64% to flop donk on wet connected (seed-04 trigger)', () => {
    const action = TAG_OFFSCRIPT_VALUE_READ.actionAtNode(
      {
        street: 'flop',
        texture: 'wet',
        position: 'PFA',
        heroLineType: 'donk',
        betSizePot: 0.40,
      },
      null,
    );
    expect(action.fold).toBeCloseTo(0.64, 2);
    expect(action.fold + action.call + action.raise).toBeCloseTo(1.0, 3);
  });

  it('does NOT fire on dry boards', () => {
    const action = TAG_OFFSCRIPT_VALUE_READ.actionAtNode(
      {
        street: 'flop',
        texture: 'dry',
        position: 'PFA',
        heroLineType: 'donk',
        betSizePot: 0.40,
      },
      null,
    );
    expect(action.fold).toBeCloseTo(0.48, 2);
  });

  it('targets EAL-SEED-04 as candidate non-firing stress test', () => {
    expect(TAG_OFFSCRIPT_VALUE_READ.targetAnchor).toBe('EAL-SEED-04');
    expect(TAG_OFFSCRIPT_VALUE_READ.seed).toBe(104);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Registry
// ───────────────────────────────────────────────────────────────────────────

describe('ANCHOR_SEED_VILLAINS registry', () => {
  it('contains all 4 seed-anchor-calibrated policies', () => {
    expect(Object.keys(ANCHOR_SEED_VILLAINS)).toEqual([
      'EAL-SEED-01',
      'EAL-SEED-02',
      'EAL-SEED-03',
      'EAL-SEED-04',
    ]);
  });

  it('each entry is a frozen policy object', () => {
    for (const [_key, policy] of Object.entries(ANCHOR_SEED_VILLAINS)) {
      expect(Object.isFrozen(policy)).toBe(true);
      expect(typeof policy.actionAtNode).toBe('function');
      expect(typeof policy.seed).toBe('number');
      expect(typeof policy.styleLabel).toBe('string');
    }
  });

  it('seeds are all distinct (deterministic per-anchor)', () => {
    const seeds = Object.values(ANCHOR_SEED_VILLAINS).map((p) => p.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});
