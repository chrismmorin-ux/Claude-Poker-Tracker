/**
 * @file Tests for heroDecisionAccumulator.js — generic hero-side bucketer.
 */

import { describe, it, expect } from 'vitest';
import {
  accumulateHeroDecisions,
  buildHeroSituationKey,
  wilsonCI,
} from '../heroDecisionAccumulator.js';
import {
  deriveTurnBarrelDecision,
  deriveRfiDecision,
} from '../deriveSituationKey.js';

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

// ─── deriveTurnBarrelDecision (WS-146 SPR-109) ───────────────────────────

describe('deriveTurnBarrelDecision', () => {
  // Hero (seat 1) raised pf (PFA), bet the flop, got called, now acts on the turn.
  const buildBarrelHand = ({ turnAction, callers = [2], flopHeroAction = 'bet' }) => ({
    gameState: {
      dealerButtonSeat: BTN_SEAT,
      mySeat: HERO_SEAT,
      players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
      actionSequence: [
        { seat: HERO_SEAT, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
        ...callers.map((seat, i) => ({ seat, action: 'call', street: 'preflop', order: i + 1, amount: 2.5 })),
        { seat: HERO_SEAT, action: flopHeroAction, street: 'flop', order: callers.length + 1, amount: flopHeroAction === 'bet' ? 3 : 0 },
        ...callers.map((seat, i) => ({ seat, action: 'call', street: 'flop', order: callers.length + 2 + i, amount: 3 })),
        { seat: HERO_SEAT, action: turnAction, street: 'turn', order: callers.length * 2 + 2, amount: turnAction === 'bet' ? 6 : 0 },
      ],
    },
    cardState: { communityCards: [20, 13, 3, 44], heroCards: [51, 46] },
  });

  const turnEntry = (hand) => hand.gameState.actionSequence.find((a) => a.street === 'turn');

  it('classifies a first-in turn bet (HU, PFA, bet flop) as an aggress barrel', () => {
    const hand = buildBarrelHand({ turnAction: 'bet', callers: [2] });
    const d = deriveTurnBarrelDecision({ hand, actionEntry: turnEntry(hand), heroSeat: HERO_SEAT, buttonSeat: BTN_SEAT });
    expect(d).not.toBeNull();
    expect(d.decisionKey).toBe('turn:barrel-decision:hu');
    expect(d.decisionClass).toBe('aggress');
  });

  it('classifies a first-in turn check as a pass', () => {
    const hand = buildBarrelHand({ turnAction: 'check', callers: [2] });
    const d = deriveTurnBarrelDecision({ hand, actionEntry: turnEntry(hand), heroSeat: HERO_SEAT, buttonSeat: BTN_SEAT });
    expect(d.decisionClass).toBe('pass');
  });

  it('emits :mw when 2+ villains remain on the turn', () => {
    const hand = buildBarrelHand({ turnAction: 'bet', callers: [2, 3] });
    const d = deriveTurnBarrelDecision({ hand, actionEntry: turnEntry(hand), heroSeat: HERO_SEAT, buttonSeat: BTN_SEAT });
    expect(d.decisionKey).toBe('turn:barrel-decision:mw');
  });

  it('returns null when hero was NOT the preflop aggressor (pfc)', () => {
    // seat 4 opens, hero calls preflop, hero leads flop + turn = probe, not a barrel
    const hand = {
      gameState: {
        dealerButtonSeat: BTN_SEAT,
        mySeat: HERO_SEAT,
        players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
        actionSequence: [
          { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: HERO_SEAT, action: 'call', street: 'preflop', order: 1, amount: 2.5 },
          { seat: HERO_SEAT, action: 'bet', street: 'flop', order: 2, amount: 3 },
          { seat: 4, action: 'call', street: 'flop', order: 3, amount: 3 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', order: 4, amount: 6 },
        ],
      },
      cardState: { communityCards: [20, 13, 3, 44], heroCards: [51, 46] },
    };
    const d = deriveTurnBarrelDecision({ hand, actionEntry: hand.gameState.actionSequence[4], heroSeat: HERO_SEAT, buttonSeat: BTN_SEAT });
    expect(d).toBeNull();
  });

  it('returns null when hero did NOT bet the flop (delayed cbet, not a barrel)', () => {
    const hand = buildBarrelHand({ turnAction: 'bet', callers: [2], flopHeroAction: 'check' });
    const d = deriveTurnBarrelDecision({ hand, actionEntry: turnEntry(hand), heroSeat: HERO_SEAT, buttonSeat: BTN_SEAT });
    expect(d).toBeNull();
  });

  it('returns null when hero faces a turn bet (not first-in)', () => {
    const hand = {
      gameState: {
        dealerButtonSeat: BTN_SEAT,
        mySeat: HERO_SEAT,
        players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
        actionSequence: [
          { seat: HERO_SEAT, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: 2, action: 'call', street: 'preflop', order: 1, amount: 2.5 },
          { seat: HERO_SEAT, action: 'bet', street: 'flop', order: 2, amount: 3 },
          { seat: 2, action: 'call', street: 'flop', order: 3, amount: 3 },
          { seat: 2, action: 'bet', street: 'turn', order: 4, amount: 6 }, // villain donks turn
          { seat: HERO_SEAT, action: 'call', street: 'turn', order: 5, amount: 6 },
        ],
      },
      cardState: { communityCards: [20, 13, 3, 44], heroCards: [51, 46] },
    };
    const d = deriveTurnBarrelDecision({ hand, actionEntry: hand.gameState.actionSequence[5], heroSeat: HERO_SEAT, buttonSeat: BTN_SEAT });
    expect(d).toBeNull();
  });

  it('returns null for a flop action (street guard)', () => {
    const hand = buildBarrelHand({ turnAction: 'bet', callers: [2] });
    const flopEntry = hand.gameState.actionSequence.find((a) => a.street === 'flop' && a.seat === HERO_SEAT);
    expect(deriveTurnBarrelDecision({ hand, actionEntry: flopEntry, heroSeat: HERO_SEAT, buttonSeat: BTN_SEAT })).toBeNull();
  });
});

// ─── deriveRfiDecision (WS-146 SPR-109) ──────────────────────────────────

describe('deriveRfiDecision', () => {
  // buttonSeat 6; hero seat controls position. Folded-to-hero = first-in.
  const buildRfiHand = ({ heroSeat, heroAction, priorActions = [] }) => ({
    gameState: {
      dealerButtonSeat: BTN_SEAT,
      mySeat: heroSeat,
      players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
      actionSequence: [
        ...priorActions,
        { seat: heroSeat, action: heroAction, street: 'preflop', order: priorActions.length, amount: heroAction === 'raise' ? 2.5 : 0 },
      ],
    },
    cardState: { communityCards: [], heroCards: [51, 46] },
  });
  const heroEntry = (hand) => hand.gameState.actionSequence[hand.gameState.actionSequence.length - 1];

  it('classifies a first-in open-raise from the BUTTON as aggress', () => {
    // hero seat 6 == button → BUTTON; all prior seats folded → first-in
    const hand = buildRfiHand({
      heroSeat: 6,
      heroAction: 'raise',
      priorActions: [
        { seat: 2, action: 'fold', street: 'preflop', order: 0 },
        { seat: 3, action: 'fold', street: 'preflop', order: 1 },
        { seat: 4, action: 'fold', street: 'preflop', order: 2 },
        { seat: 5, action: 'fold', street: 'preflop', order: 3 },
      ],
    });
    const d = deriveRfiDecision({ hand, actionEntry: heroEntry(hand), heroSeat: 6, buttonSeat: BTN_SEAT });
    expect(d).not.toBeNull();
    expect(d.decisionKey).toBe('preflop:rfi-decision:BUTTON');
    expect(d.decisionClass).toBe('aggress');
  });

  it('classifies a first-in open-fold as pass (and resolves EARLY position)', () => {
    // hero seat 3, button 6 → offset 3 → EARLY; first to act, folds
    const hand = buildRfiHand({ heroSeat: 3, heroAction: 'fold', priorActions: [] });
    const d = deriveRfiDecision({ hand, actionEntry: heroEntry(hand), heroSeat: 3, buttonSeat: BTN_SEAT });
    expect(d.decisionKey).toBe('preflop:rfi-decision:EARLY');
    expect(d.decisionClass).toBe('pass');
  });

  it('resolves LATE (cutoff) position', () => {
    // hero seat 5, button 6 → offset 5 (6max) → LATE
    const hand = buildRfiHand({
      heroSeat: 5,
      heroAction: 'raise',
      priorActions: [
        { seat: 2, action: 'fold', street: 'preflop', order: 0 },
        { seat: 3, action: 'fold', street: 'preflop', order: 1 },
        { seat: 4, action: 'fold', street: 'preflop', order: 2 },
      ],
    });
    const d = deriveRfiDecision({ hand, actionEntry: heroEntry(hand), heroSeat: 5, buttonSeat: BTN_SEAT });
    expect(d.decisionKey).toBe('preflop:rfi-decision:LATE');
  });

  it('returns null when a player limped (called) before hero — not RFI (limp excluded v1)', () => {
    const hand = buildRfiHand({
      heroSeat: 6,
      heroAction: 'raise',
      priorActions: [
        { seat: 4, action: 'call', street: 'preflop', order: 0, amount: 1 }, // limp
        { seat: 5, action: 'fold', street: 'preflop', order: 1 },
      ],
    });
    expect(deriveRfiDecision({ hand, actionEntry: heroEntry(hand), heroSeat: 6, buttonSeat: BTN_SEAT })).toBeNull();
  });

  it('returns null when a player raised before hero — not RFI', () => {
    const hand = buildRfiHand({
      heroSeat: 6,
      heroAction: 'fold',
      priorActions: [
        { seat: 4, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
        { seat: 5, action: 'fold', street: 'preflop', order: 1 },
      ],
    });
    expect(deriveRfiDecision({ hand, actionEntry: heroEntry(hand), heroSeat: 6, buttonSeat: BTN_SEAT })).toBeNull();
  });

  it('returns null from the blinds (SB/BB excluded v1)', () => {
    // hero seat 1, button 6 → offset 1 → SMALL_BLIND
    const hand = buildRfiHand({
      heroSeat: 1,
      heroAction: 'raise',
      priorActions: [
        { seat: 2, action: 'fold', street: 'preflop', order: 0 },
        { seat: 3, action: 'fold', street: 'preflop', order: 1 },
        { seat: 4, action: 'fold', street: 'preflop', order: 2 },
        { seat: 5, action: 'fold', street: 'preflop', order: 3 },
      ],
    });
    expect(deriveRfiDecision({ hand, actionEntry: heroEntry(hand), heroSeat: 1, buttonSeat: BTN_SEAT })).toBeNull();
  });

  it('returns null when hero limps first-in (call excluded from RFI decision v1)', () => {
    const hand = buildRfiHand({
      heroSeat: 5,
      heroAction: 'call',
      priorActions: [
        { seat: 2, action: 'fold', street: 'preflop', order: 0 },
        { seat: 3, action: 'fold', street: 'preflop', order: 1 },
        { seat: 4, action: 'fold', street: 'preflop', order: 2 },
      ],
    });
    expect(deriveRfiDecision({ hand, actionEntry: heroEntry(hand), heroSeat: 5, buttonSeat: BTN_SEAT })).toBeNull();
  });

  it('returns null for a postflop action (street guard)', () => {
    const hand = buildRfiHand({ heroSeat: 6, heroAction: 'raise', priorActions: [] });
    const flopEntry = { seat: 6, action: 'bet', street: 'flop', order: 5, amount: 3 };
    expect(deriveRfiDecision({ hand, actionEntry: flopEntry, heroSeat: 6, buttonSeat: BTN_SEAT })).toBeNull();
  });
});

// ─── accumulator integration: multiple decision-bucket types coexist ─────

describe('accumulateHeroDecisions — multiple decision-bucket types (SPR-109)', () => {
  it('records both a flop cbet decision AND a turn barrel decision in one hand', () => {
    const hand = {
      gameState: {
        dealerButtonSeat: BTN_SEAT,
        mySeat: HERO_SEAT,
        players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
        actionSequence: [
          { seat: HERO_SEAT, action: 'raise', street: 'preflop', order: 0, amount: 2.5 },
          { seat: 2, action: 'call', street: 'preflop', order: 1, amount: 2.5 },
          { seat: HERO_SEAT, action: 'bet', street: 'flop', order: 2, amount: 3 },
          { seat: 2, action: 'call', street: 'flop', order: 3, amount: 3 },
          { seat: HERO_SEAT, action: 'bet', street: 'turn', order: 4, amount: 6 },
        ],
      },
      cardState: { communityCards: [20, 13, 3, 44], heroCards: [51, 46] },
    };
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: HERO_SEAT });
    expect(result.decisionBuckets['flop:cbet-decision:hu']).toBeDefined();
    expect(result.decisionBuckets['flop:cbet-decision:hu'].aggressCount).toBe(1);
    expect(result.decisionBuckets['turn:barrel-decision:hu']).toBeDefined();
    expect(result.decisionBuckets['turn:barrel-decision:hu'].aggressCount).toBe(1);
  });

  it('records an RFI decision bucket from a first-in open-raise', () => {
    const hand = {
      gameState: {
        dealerButtonSeat: BTN_SEAT,
        mySeat: 6,
        players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
        actionSequence: [
          { seat: 2, action: 'fold', street: 'preflop', order: 0 },
          { seat: 3, action: 'fold', street: 'preflop', order: 1 },
          { seat: 4, action: 'fold', street: 'preflop', order: 2 },
          { seat: 5, action: 'fold', street: 'preflop', order: 3 },
          { seat: 6, action: 'raise', street: 'preflop', order: 4, amount: 2.5 },
        ],
      },
      cardState: { communityCards: [], heroCards: [51, 46] },
    };
    const result = accumulateHeroDecisions({ hands: [hand], heroSeat: 6 });
    const rfi = result.decisionBuckets['preflop:rfi-decision:BUTTON'];
    expect(rfi).toBeDefined();
    expect(rfi.aggressCount).toBe(1);
    expect(rfi.aggressFrequency).toBe(1.0);
  });
});
