/**
 * @file Tests for heroDecisionAccumulator.js — generic hero-side bucketer.
 */

import { describe, it, expect } from 'vitest';
import {
  accumulateHeroDecisions,
  buildHeroSituationKey,
  wilsonCI,
} from '../heroDecisionAccumulator.js';

const HERO_SEAT = 1;
const BTN_SEAT = 6;

const buildHand = ({ heroAction, street = 'flop', communityCards = [20, 13, 3], priorActions = [] }) => ({
  gameState: {
    dealerButtonSeat: BTN_SEAT,
    mySeat: HERO_SEAT,
    players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
    actionSequence: [
      ...priorActions,
      { seat: HERO_SEAT, action: heroAction, street, order: priorActions.length, amount: 0 },
    ],
  },
  cardState: { communityCards, heroCards: [51, 46] },
});

// ─── buildHeroSituationKey ───────────────────────────────────────────────

describe('buildHeroSituationKey', () => {
  it('returns a 7-segment key in canonical order', () => {
    const key = buildHeroSituationKey({
      street: 'flop',
      texture: 'dry',
      posCategory: 'BUTTON',
      isAgg: 'def',
      isIP: 'ip',
      facingAction: 'bet',
      contextAction: 'vsBet',
    });
    expect(key).toBe('flop:dry:BUTTON:def:ip:bet:vsBet');
    expect(key.split(':').length).toBe(7);
  });
});

// ─── wilsonCI ────────────────────────────────────────────────────────────

describe('wilsonCI', () => {
  it('returns zero CI when trials = 0', () => {
    expect(wilsonCI(0, 0)).toEqual({ lower: 0, upper: 0, mean: 0 });
  });

  it('returns symmetric CI around 0.5 at large n', () => {
    const ci = wilsonCI(50, 100);
    expect(ci.mean).toBeCloseTo(0.5, 2);
    expect(ci.lower).toBeLessThan(0.5);
    expect(ci.upper).toBeGreaterThan(0.5);
  });

  it('returns wider CI at smaller n', () => {
    const ciSmall = wilsonCI(15, 30);
    const ciBig = wilsonCI(150, 300);
    const widthSmall = ciSmall.upper - ciSmall.lower;
    const widthBig = ciBig.upper - ciBig.lower;
    expect(widthSmall).toBeGreaterThan(widthBig);
  });

  it('clamps at [0, 1] for extreme proportions', () => {
    const ciLow = wilsonCI(0, 30);
    const ciHigh = wilsonCI(30, 30);
    expect(ciLow.lower).toBe(0);
    expect(ciHigh.upper).toBe(1);
  });
});

// ─── accumulateHeroDecisions ─────────────────────────────────────────────

describe('accumulateHeroDecisions — guards', () => {
  it('returns empty result for null hands', () => {
    const result = accumulateHeroDecisions({ hands: null, heroSeat: HERO_SEAT });
    expect(result.totalActions).toBe(0);
    expect(result.totalBucketCount).toBe(0);
  });

  it('returns empty result for missing heroSeat', () => {
    const result = accumulateHeroDecisions({ hands: [], heroSeat: null });
    expect(result.totalActions).toBe(0);
  });

  it('skips hands without actionSequence', () => {
    const result = accumulateHeroDecisions({
      hands: [{ gameState: {} }, { gameState: { actionSequence: null } }],
      heroSeat: HERO_SEAT,
    });
    expect(result.totalActions).toBe(0);
  });
});

describe('accumulateHeroDecisions — bucketing', () => {
  it('counts a single hero fold to flop cbet IP', () => {
    const hand = buildHand({
      heroAction: 'fold',
      street: 'flop',
      priorActions: [
        { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
        { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1, amount: 2.5 },
        { seat: 4, action: 'bet', street: 'flop', order: 2, amount: 3 },
      ],
    });
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    // Hero made 2 actions: preflop call + flop fold.
    expect(result.totalActions).toBe(2);
    expect(result.totalBucketCount).toBe(2);
    // Find the flop bucket.
    const flopBucket = Object.values(result.buckets).find((b) => b.situationKey.startsWith('flop:'));
    expect(flopBucket).toBeDefined();
    expect(flopBucket.foldCount).toBe(1);
    expect(flopBucket.sampleSize).toBe(1);
    expect(flopBucket.foldRate).toBe(1.0);
  });

  it('aggregates multiple hands into the same bucket', () => {
    const hands = [
      buildHand({
        heroAction: 'fold',
        street: 'flop',
        priorActions: [
          { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1 },
          { seat: 4, action: 'bet', street: 'flop', order: 2, amount: 3 },
        ],
      }),
      buildHand({
        heroAction: 'call',
        street: 'flop',
        priorActions: [
          { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1 },
          { seat: 4, action: 'bet', street: 'flop', order: 2, amount: 3 },
        ],
      }),
    ];
    const result = accumulateHeroDecisions({ hands, heroSeat: HERO_SEAT });
    const flopBucket = Object.values(result.buckets).find((b) => b.situationKey.startsWith('flop:'));
    expect(flopBucket.sampleSize).toBe(2);
    expect(flopBucket.foldCount).toBe(1);
    expect(flopBucket.callCount).toBe(1);
    expect(flopBucket.foldRate).toBeCloseTo(0.5, 5);
  });

  it('flags sparse buckets when sampleSize < 30', () => {
    const hand = buildHand({
      heroAction: 'fold',
      street: 'flop',
      priorActions: [{ seat: 4, action: 'bet', street: 'flop', order: 0 }],
    });
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    expect(result.sparseBucketCount).toBeGreaterThan(0);
  });

  it('computes Wilson CI on foldRate per bucket', () => {
    // Build 30 fold actions in same situation
    const hands = Array.from({ length: 30 }, () =>
      buildHand({
        heroAction: 'fold',
        street: 'flop',
        priorActions: [
          { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1 },
          { seat: 4, action: 'bet', street: 'flop', order: 2, amount: 3 },
        ],
      }),
    );
    const result = accumulateHeroDecisions({ hands, heroSeat: HERO_SEAT });
    const flopBucket = Object.values(result.buckets).find((b) => b.situationKey.startsWith('flop:'));
    expect(flopBucket.sampleSize).toBe(30);
    expect(flopBucket.foldRateCI.mean).toBeCloseTo(1.0, 5);
    expect(flopBucket.foldRateCI.lower).toBeGreaterThan(0.85);
  });
});
