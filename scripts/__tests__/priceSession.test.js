/**
 * priceSession.test.js — the session runner, and the two bugs that each produced a CLEAN ZERO.
 *
 * Both were found by running the thing on a real session and disbelieving the output, not by
 * a failing assertion. Both are the same shape, and it is the shape this repo keeps getting
 * hit by: a wrong lookup key does not throw, it returns nothing, and nothing formats as a
 * confident 0.00bb with no error anywhere.
 *
 *   1. HERO'S ID IS NOT STABLE. `seatPlayers` names hero's chair `'hero'` on hands he was
 *      dealt into and `'seat_2'` on hands he only observed. Taking the first non-null id at
 *      that seat picked up the OBSERVED hand's id, `accumulateDecisions` matched no hands, and
 *      the column priced 0 of 14 postflop decisions while reporting "EV left: 0.00bb".
 *   2. HOLE CARDS LIVE UNDER `gameState`. Read from the top level they are `undefined` on
 *      every hand, so every decision came back `cards-unknown` — indistinguishable from a
 *      session that genuinely reached no showdown.
 *
 * The third case here is the coverage denominator, which is not a crash but a flattery:
 * counting only what reached the pricer reported full coverage on a session where 62% of
 * hero's decisions were dropped upstream.
 */

import { describe, it, expect } from 'vitest';
import { knownCombo, priceSession, UNPRICED } from '../villainArchetype/priceSession.mjs';
import { heroContexts } from '../villainArchetype/runMoneyColumn.mjs';

// ─────────────────────────────────────────────────────────────────────────────────────────
// knownCombo — the cards-known arm's whole input
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('knownCombo', () => {
  it('encodes a real holding at weight 1 — not a sample from a range', () => {
    const c = knownCombo(['9♥', '9♦']);
    expect(c).not.toBeNull();
    expect(c.sampleWeight).toBe(1);
    expect(c.weight).toBe(1);
    expect(c.card1).toBeGreaterThanOrEqual(0);
    expect(c.card2).toBeGreaterThanOrEqual(0);
    expect(c.card1).not.toBe(c.card2);
  });

  it('refuses rather than guessing when a card will not parse', () => {
    // A combo built from a half-decoded hand yields an equity that looks exactly like a real
    // one, which is the failure mode worth refusing over.
    expect(knownCombo(['9♥', ''])).toBeNull();
    expect(knownCombo(['zz', '9♦'])).toBeNull();
  });

  it('refuses a duplicated card and a wrong-length holding', () => {
    expect(knownCombo(['9♥', '9♥'])).toBeNull();
    expect(knownCombo(['9♥'])).toBeNull();
    expect(knownCombo(null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// heroContexts — bug 1
// ─────────────────────────────────────────────────────────────────────────────────────────

const seatedHand = (handId, pid) => ({
  handId,
  seatPlayers: { 1: 'seat_1', 2: pid, 3: 'seat_3' },
  gameState: { mySeat: 2, actionSequence: [], dealerButtonSeat: 1, communityCards: [] },
});

const observedHand = (handId) => ({
  handId,
  seatPlayers: { 1: 'seat_1', 2: 'seat_2', 3: 'seat_3' },
  // mySeat null: hero was not in this hand, so seat 2 is just another player.
  gameState: { mySeat: null, actionSequence: [], dealerButtonSeat: 1, communityCards: [] },
});

describe('heroContexts — hero id resolution', () => {
  it('ignores the id an OBSERVED hand gives hero\'s seat', () => {
    // The June 19 session opens with an observed hand. Reading its `seat_2` and handing that
    // to accumulateDecisions matched nothing and produced a clean, wrong zero.
    const adapted = [
      { hand: observedHand('h0') },
      { hand: seatedHand('h1', 'hero') },
      { hand: seatedHand('h2', 'hero') },
    ];
    const r = heroContexts(adapted, 2);
    expect(r.heroPid).toBe('hero');
  });

  it('REFUSES when hero\'s seat carries two ids across hands he was seated for', () => {
    // Two ids at one chair in one sitting is a fact about the capture. Breaking the tie by
    // majority would price most of the session and silently drop the rest.
    const adapted = [
      { hand: seatedHand('h1', 'hero') },
      { hand: seatedHand('h2', 'someone_else') },
    ];
    const r = heroContexts(adapted, 2);
    expect(r.heroPid).toBeNull();
    expect(r.idAmbiguity.sort()).toEqual(['hero', 'someone_else']);
    expect(r.ctxs).toEqual([]);
  });

  it('refuses when hero was never seated rather than picking any id at that seat', () => {
    const r = heroContexts([{ hand: observedHand('h0') }], 2);
    expect(r.heroPid).toBeNull();
    expect(r.ctxs).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// priceSession — accounting
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('priceSession — every decision is accounted for', () => {
  const ctx = (over = {}) => ({
    handId: 'h1', order: 3, street: 'flop', board: ['5♦', 'T♠', '6♦'],
    facingAction: 'bet', action: 'call', playerSeat: '2', ...over,
  });

  it('counts a preflop decision as unpriced rather than dropping it', async () => {
    const r = await priceSession({
      ctxs: [ctx({ street: 'preflop', board: [] })],
      handFor: () => ({ handId: 'h1', gameState: {} }),
      holeCardsFor: () => ['9♥', '9♦'],
      policy: {},
    });
    expect(r.unpriced[UNPRICED.PREFLOP]).toBe(1);
    expect(r.coverage.decisionsPriced).toBe(0);
    expect(r.coverage.reconciles).toBe(true);
  });

  it('counts a cards-unknown decision distinctly from a preflop one', async () => {
    const r = await priceSession({
      ctxs: [ctx()],
      handFor: () => ({ handId: 'h1', gameState: {} }),
      holeCardsFor: () => null,
      policy: {},
    });
    expect(r.unpriced[UNPRICED.CARDS_UNKNOWN]).toBe(1);
    expect(r.unpriced[UNPRICED.PREFLOP]).toBeUndefined();
  });

  it('reconciles attempted against priced plus unpriced on a mixed batch', async () => {
    const r = await priceSession({
      ctxs: [ctx({ street: 'preflop', board: [] }), ctx(), ctx()],
      handFor: () => ({ handId: 'h1', gameState: {} }),
      holeCardsFor: () => null,
      policy: {},
    });
    expect(r.coverage.decisionsAttempted).toBe(3);
    expect(r.coverage.decisionsPriced + r.coverage.decisionsUnpriced).toBe(3);
    expect(r.coverage.reconciles).toBe(true);
  });

  it('carries the preflop hole as DATA on the scope, not as prose', async () => {
    const r = await priceSession({
      ctxs: [ctx({ street: 'preflop', board: [] })],
      handFor: () => ({ handId: 'h1', gameState: {} }),
      holeCardsFor: () => ['9♥', '9♦'],
      policy: {},
    });
    expect(r.scope.preflopUnpriced).toBe(1);
    expect(r.scope.removedBy).toContain('preflop equity path');
  });
});
