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
  it('returns an 8-segment key in canonical order', () => {
    const key = buildHeroSituationKey({
      street: 'flop',
      texture: 'dry',
      posCategory: 'BUTTON',
      isAgg: 'def',
      isIP: 'ip',
      facingAction: 'bet',
      contextAction: 'vsBet',
      preflopAggressor: 'pfc',
    });
    expect(key).toBe('flop:dry:BUTTON:def:ip:bet:vsBet:pfc');
    expect(key.split(':').length).toBe(8);
  });

  it('defaults preflopAggressor to "na" on preflop and "pfc" on postflop when omitted', () => {
    const preflopKey = buildHeroSituationKey({
      street: 'preflop',
      texture: 'none',
      posCategory: 'BIG_BLIND',
      isAgg: 'def',
      isIP: 'oop',
      facingAction: 'raise',
      contextAction: 'vsopen',
    });
    expect(preflopKey).toBe('preflop:none:BIG_BLIND:def:oop:raise:vsopen:na');

    const flopKey = buildHeroSituationKey({
      street: 'flop',
      texture: 'dry',
      posCategory: 'BUTTON',
      isAgg: 'def',
      isIP: 'ip',
      facingAction: 'bet',
      contextAction: 'vsBet',
    });
    expect(flopKey).toBe('flop:dry:BUTTON:def:ip:bet:vsBet:pfc');
  });

  it('emits explicit "pfa" when caller passes it', () => {
    const key = buildHeroSituationKey({
      street: 'flop',
      texture: 'medium',
      posCategory: 'LATE',
      isAgg: 'def',
      isIP: 'ip',
      facingAction: 'bet',
      contextAction: 'vsBet',
      preflopAggressor: 'pfa',
    });
    expect(key).toBe('flop:medium:LATE:def:ip:bet:vsBet:pfa');
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

// ─── decisionBuckets — aggression-frequency (WS-146 SPR-108) ─────────────

describe('accumulateHeroDecisions — decisionBuckets (cbet frequency)', () => {
  // Hero (seat 1) raised preflop (PFA), then makes a first-in flop decision.
  // villainCount comes from how many opponents called preflop and stayed in.
  const buildCbetHand = ({ flopAction, callers }) => ({
    gameState: {
      dealerButtonSeat: BTN_SEAT,
      mySeat: HERO_SEAT,
      players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
      actionSequence: [
        { seat: HERO_SEAT, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
        ...callers.map((seat, i) => ({ seat, action: 'call', street: 'preflop', order: i + 1, amount: 2.5 })),
        { seat: HERO_SEAT, action: flopAction, street: 'flop', order: callers.length + 1, amount: flopAction === 'bet' ? 3 : 0 },
      ],
    },
    cardState: { communityCards: [20, 13, 3], heroCards: [51, 46] },
  });

  it('emits a multiway cbet decision bucket when hero (PFA) bets flop 3-way', () => {
    const hand = buildCbetHand({ flopAction: 'bet', callers: [2, 3] });
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    expect(result.decisionBuckets).toBeDefined();
    const mw = result.decisionBuckets['flop:cbet-decision:mw'];
    expect(mw).toBeDefined();
    expect(mw.aggressCount).toBe(1);
    expect(mw.passCount).toBe(0);
    expect(mw.sampleSize).toBe(1);
    expect(mw.aggressFrequency).toBe(1.0);
    expect(mw.playersRemaining).toBe('mw');
  });

  it('classifies a first-in flop check (PFA) as a pass', () => {
    const hand = buildCbetHand({ flopAction: 'check', callers: [2, 3] });
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    const mw = result.decisionBuckets['flop:cbet-decision:mw'];
    expect(mw.aggressCount).toBe(0);
    expect(mw.passCount).toBe(1);
    expect(mw.aggressFrequency).toBe(0);
  });

  it('buckets a heads-up cbet decision under :hu (not :mw)', () => {
    const hand = buildCbetHand({ flopAction: 'bet', callers: [2] }); // single caller → HU
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    expect(result.decisionBuckets['flop:cbet-decision:hu']).toBeDefined();
    expect(result.decisionBuckets['flop:cbet-decision:mw']).toBeUndefined();
  });

  it('does NOT emit a cbet decision when hero was a preflop caller (pfc)', () => {
    // Hero calls preflop (seat 4 opens), then leads flop — that is a donk/probe,
    // not a cbet decision. deriveCbetDecision returns null (hero is pfc).
    const hand = {
      gameState: {
        dealerButtonSeat: BTN_SEAT,
        mySeat: HERO_SEAT,
        players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
        actionSequence: [
          { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1, amount: 2.5 },
          { seat: 2, action: 'call', street: 'preflop', order: 2, amount: 2.5 },
          { seat: HERO_SEAT, action: 'bet', street: 'flop', order: 3, amount: 3 },
        ],
      },
      cardState: { communityCards: [20, 13, 3], heroCards: [51, 46] },
    };
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    expect(Object.keys(result.decisionBuckets)).toHaveLength(0);
    // ...but the action bucket still records the flop bet normally.
    expect(result.totalActions).toBe(2);
  });

  it('aggregates cbet frequency across multiple multiway hands + computes CI', () => {
    const hands = [
      ...Array.from({ length: 6 }, () => buildCbetHand({ flopAction: 'bet', callers: [2, 3] })),
      ...Array.from({ length: 4 }, () => buildCbetHand({ flopAction: 'check', callers: [2, 3] })),
    ];
    const result = accumulateHeroDecisions({ hands, heroSeat: HERO_SEAT });
    const mw = result.decisionBuckets['flop:cbet-decision:mw'];
    expect(mw.sampleSize).toBe(10);
    expect(mw.aggressCount).toBe(6);
    expect(mw.aggressFrequency).toBeCloseTo(0.6, 5);
    expect(mw.aggressFrequencyCI.mean).toBeCloseTo(0.6, 5);
    expect(mw.aggressFrequencyCI.lower).toBeLessThan(0.6);
    expect(mw.aggressFrequencyCI.upper).toBeGreaterThan(0.6);
  });

  it('decisionBuckets is present (empty) even when no cbet decisions occur', () => {
    const hand = buildHand({
      heroAction: 'fold',
      street: 'flop',
      priorActions: [
        { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
        { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1 },
        { seat: 4, action: 'bet', street: 'flop', order: 2, amount: 3 },
      ],
    });
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    expect(result.decisionBuckets).toBeDefined();
    expect(Object.keys(result.decisionBuckets)).toHaveLength(0);
  });
});
