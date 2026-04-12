/**
 * Tests for multiway pot odds (RT-64) and Mode A fold-reflection semantics
 * (RT-63 verification).
 */
import { describe, it, expect } from 'vitest';
import {
  findFacedBet,
  buildContextStripHTML,
  classifyBetweenHandsMode,
} from '../render-orchestrator.js';

describe('findFacedBet (RT-64)', () => {
  it('returns null for empty or missing sequence', () => {
    expect(findFacedBet(null, 1, 'flop')).toBeNull();
    expect(findFacedBet([], 1, 'flop')).toBeNull();
  });

  it('walks back past calls to find the bet hero faces in multiway', () => {
    const seq = [
      { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 2 },
      { seat: 1, action: 'call', amount: 6, street: 'preflop', order: 3 }, // hero
      { seat: 3, action: 'bet', amount: 30, street: 'flop', order: 4 },
      { seat: 5, action: 'call', amount: 30, street: 'flop', order: 5 },
    ];
    const faced = findFacedBet(seq, /*heroSeat*/ 1, 'flop');
    expect(faced).toEqual({ amount: 30, seat: 3, action: 'bet' });
  });

  it('ignores actions on other streets', () => {
    const seq = [
      { seat: 3, action: 'raise', amount: 100, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 100, street: 'preflop', order: 2 },
    ];
    expect(findFacedBet(seq, 1, 'flop')).toBeNull();
  });

  it('ignores the hero\'s own bets', () => {
    const seq = [
      { seat: 1, action: 'bet', amount: 50, street: 'flop', order: 1 }, // hero bet
    ];
    expect(findFacedBet(seq, 1, 'flop')).toBeNull();
  });

  it('picks the raise when villain donks then gets raised by another villain', () => {
    const seq = [
      { seat: 3, action: 'donk', amount: 10, street: 'flop', order: 1 },
      { seat: 5, action: 'raise', amount: 35, street: 'flop', order: 2 },
    ];
    const faced = findFacedBet(seq, 1, 'flop');
    expect(faced.amount).toBe(35);
    expect(faced.action).toBe('raise');
  });

  it('skips zero-amount entries (defensive)', () => {
    const seq = [
      { seat: 3, action: 'bet', amount: 0, street: 'flop', order: 1 },
      { seat: 5, action: 'bet', amount: 25, street: 'flop', order: 2 },
    ];
    expect(findFacedBet(seq, 1, 'flop').amount).toBe(25);
  });
});

describe('buildContextStripHTML pot odds against the faced bet (RT-64)', () => {
  const advice = {
    recommendations: [{ action: 'call', villainResponse: null }],
    situation: 'facing_bet',
    potSize: 100,
    heroEquity: 0.42,
  };

  it('uses villain1 bet amount in a multiway flop, not villain2 call', () => {
    const liveContext = {
      state: 'flop',
      heroSeat: 1,
      actionSequence: [
        { seat: 3, action: 'bet', amount: 30, street: 'flop', order: 1 },
        { seat: 5, action: 'call', amount: 30, street: 'flop', order: 2 },
      ],
    };
    const { html } = buildContextStripHTML(advice, liveContext);
    // 30 / (100 + 30) = 23%
    expect(html).toContain('23%');
    expect(html).toContain('Pot odds');
  });

  it('hides pot odds when there is no faced bet (limped pot)', () => {
    const liveContext = {
      state: 'flop',
      heroSeat: 1,
      actionSequence: [
        { seat: 3, action: 'check', amount: 0, street: 'flop', order: 1 },
      ],
    };
    const { html } = buildContextStripHTML(advice, liveContext);
    expect(html).not.toContain('Pot odds');
  });
});

describe('Mode A reflection coaching semantics (RT-63 verification)', () => {
  // Current convention: fold EV is implicit at 0. The engine only emits a
  // recommendation in `recs` when that action beats fold. So the existing
  // `ev > 0` check inside _hasProfitableAlternative is equivalent to
  // `ev > fold.ev` under this convention. These tests lock in the behavior.

  const liveContext = { state: 'FLOP', foldedSeats: [1], pot: 50 };
  const heroSeat = 1;

  it('fires REFLECTION when hero folded and a non-fold primary was recommended', () => {
    const lastGoodAdvice = {
      recommendations: [{ action: 'call', ev: 0.1 }],
    };
    expect(classifyBetweenHandsMode(liveContext, heroSeat, lastGoodAdvice, false)).toBe('REFLECTION');
  });

  it('falls through to OBSERVING when hero folded and the engine emitted no positive alternative', () => {
    // An engine that considered fold correct emits either no recs, or a
    // primary fold with no better alternative. In either case Mode A should
    // NOT fire.
    expect(classifyBetweenHandsMode(liveContext, heroSeat, { recommendations: [] }, false)).toBe('OBSERVING');
    expect(classifyBetweenHandsMode(
      liveContext,
      heroSeat,
      { recommendations: [{ action: 'fold', ev: 0 }] },
      false,
    )).toBe('OBSERVING');
    expect(classifyBetweenHandsMode(
      liveContext,
      heroSeat,
      { recommendations: [{ action: 'fold', ev: 0 }, { action: 'call', ev: -0.3 }] },
      false,
    )).toBe('OBSERVING');
  });

  it('returns OBSERVING after Mode A timer expires even if alternatives existed', () => {
    const lastGoodAdvice = { recommendations: [{ action: 'call', ev: 0.1 }] };
    expect(classifyBetweenHandsMode(liveContext, heroSeat, lastGoodAdvice, /*modeAExpired*/ true)).toBe('OBSERVING');
  });

  it('does not fire REFLECTION when hero is still active in the hand', () => {
    const activeCtx = { state: 'FLOP', foldedSeats: [] };
    const lastGoodAdvice = { recommendations: [{ action: 'call', ev: 0.1 }] };
    expect(classifyBetweenHandsMode(activeCtx, heroSeat, lastGoodAdvice, false)).toBeNull();
  });
});
