/**
 * @file Tests for heroLeakDetectionPipeline.js — orchestrator integration.
 */

import { describe, it, expect, vi } from 'vitest';
import { runHeroLeakDetection, mostCommonHeroSeat } from '../heroLeakDetectionPipeline.js';

const HERO_SEAT = 1;
const BTN_SEAT = 6;

const buildHand = ({ heroAction, street = 'flop', communityCards = [20, 13, 3], priorActions = [], mySeat = HERO_SEAT }) => ({
  gameState: {
    dealerButtonSeat: BTN_SEAT,
    mySeat,
    players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
    actionSequence: [
      ...priorActions,
      { seat: mySeat, action: heroAction, street, order: priorActions.length, amount: 0 },
    ],
  },
  cardState: { communityCards, heroCards: [51, 46] },
});

describe('mostCommonHeroSeat', () => {
  it('returns null for empty input', () => {
    expect(mostCommonHeroSeat([])).toBeNull();
    expect(mostCommonHeroSeat(null)).toBeNull();
  });

  it('returns the only seat when all hands share one mySeat', () => {
    const hands = [buildHand({ heroAction: 'fold' }), buildHand({ heroAction: 'call' })];
    expect(mostCommonHeroSeat(hands)).toBe(HERO_SEAT);
  });

  it('returns the most-common seat when hero played from multiple seats', () => {
    const hands = [
      buildHand({ heroAction: 'fold', mySeat: 1 }),
      buildHand({ heroAction: 'fold', mySeat: 1 }),
      buildHand({ heroAction: 'fold', mySeat: 1 }),
      buildHand({ heroAction: 'fold', mySeat: 5 }),
    ];
    expect(mostCommonHeroSeat(hands)).toBe(1);
  });

  it('skips hands without mySeat', () => {
    const hands = [
      { gameState: {} }, // no mySeat
      buildHand({ heroAction: 'fold', mySeat: 3 }),
    ];
    expect(mostCommonHeroSeat(hands)).toBe(3);
  });
});

describe('runHeroLeakDetection', () => {
  it('returns empty result when no hands exist', async () => {
    const persistSpy = vi.fn(async () => {});
    const result = await runHeroLeakDetection('user-1', {
      loadHands: async () => [],
      persistLeaks: persistSpy,
    });
    expect(result.firedLeaks).toEqual([]);
    expect(result.totalActions).toBe(0);
    expect(result.heroSeat).toBeNull();
    expect(result.handCount).toBe(0);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('returns empty result when hands have no mySeat', async () => {
    const persistSpy = vi.fn(async () => {});
    const result = await runHeroLeakDetection('user-1', {
      loadHands: async () => [{ gameState: { actionSequence: [] } }],
      persistLeaks: persistSpy,
    });
    expect(result.firedLeaks).toEqual([]);
    expect(result.heroSeat).toBeNull();
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('runs accumulator + detector + persists leaks when overfold pattern present', async () => {
    // 50 hands of hero IP-defending vs flop cbet from BTN, folding 35/50 (70% — well above 38% baseline).
    // Position offset 0 from button = BUTTON. flop:medium:BUTTON:def:ip:bet:vsBet:pfc baseline = 36%
    // (8-axis key with :pfc since hero called preflop, then defends flop cbet).
    // 70% > 36% + 5pp threshold AND CI [0.56, 0.84] > 0.36 → rule fires.
    const folds = Array.from({ length: 35 }, () =>
      buildHand({
        heroAction: 'fold',
        street: 'flop',
        communityCards: [20, 13, 3], // 7d 5c 2s — dry-medium
        priorActions: [
          { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1 },
          { seat: 4, action: 'bet', street: 'flop', order: 2, amount: 3 },
        ],
      }),
    );
    const calls = Array.from({ length: 15 }, () =>
      buildHand({
        heroAction: 'call',
        street: 'flop',
        communityCards: [20, 13, 3],
        priorActions: [
          { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1 },
          { seat: 4, action: 'bet', street: 'flop', order: 2, amount: 3 },
        ],
      }),
    );
    const persistSpy = vi.fn(async () => {});
    const result = await runHeroLeakDetection('user-1', {
      loadHands: async () => [...folds, ...calls],
      persistLeaks: persistSpy,
    });
    expect(result.heroSeat).toBe(HERO_SEAT);
    expect(result.handCount).toBe(50);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith('user-1', expect.any(Array));
  });

  it('persists empty leaks array when no rule fires', async () => {
    // Below n=30 — rule cannot fire per AP-SCF-04.
    const hands = Array.from({ length: 10 }, () =>
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
    const persistSpy = vi.fn(async () => {});
    const result = await runHeroLeakDetection('user-1', {
      loadHands: async () => hands,
      persistLeaks: persistSpy,
    });
    expect(result.firedLeaks).toEqual([]);
    // Persist still called — to clear stale leaks if any.
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith('user-1', []);
  });

  it('passes through totalActions + totalBuckets stats', async () => {
    const hands = Array.from({ length: 5 }, () =>
      buildHand({ heroAction: 'fold', street: 'preflop' }),
    );
    const result = await runHeroLeakDetection('user-1', {
      loadHands: async () => hands,
      persistLeaks: async () => {},
    });
    expect(result.totalActions).toBeGreaterThan(0);
    expect(result.totalBuckets).toBeGreaterThan(0);
  });
});
