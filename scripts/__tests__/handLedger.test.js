/**
 * handLedger.test.js — WS-428 Stage 0, the denominator and its anchor.
 *
 * WHY THESE PROPERTIES AND NOT OTHERS. A per-hand EV figure is a PRODUCT, and the
 * confidence interval lives on the other factor. So a denominator wrong by 2x moves the
 * founder's headline by 2x and every diagnostic on the card stays green. There is no
 * symptom. These are the properties that decide whether the ratio means anything.
 *
 *   1. THE DENOMINATOR IS HANDS DEALT, INCLUDING THE ONES THAT SCORED NOTHING. Hero folded
 *      preflop, or the hand ended preflop for everyone: the hand is real, the contribution
 *      is a real zero, and it belongs in a winrate's denominator. Counting only hands that
 *      produced a scoreable decision is the error that makes the field's own realized
 *      winrate read +83 bb/100 when it must be about minus the rake — a selection effect
 *      wearing the costume of a measurement.
 *   2. THE UNIT IS THE HERO-SEAT-HAND, NOT THE HAND. A corpus hand has no hero; the harness
 *      manufactures one per EVAL player seated in it, so one physical hand with three EVAL
 *      players is traversed three times and IS three hands dealt. Measured on this corpus:
 *      2.91 EVAL players per hand. A `Set` over hand ids — the pattern `evCost.mjs` uses
 *      correctly for a different question — would divide the denominator by that factor and
 *      multiply any rate built on it by the same amount.
 *   3. A HARNESS FAILURE MAY NOT SHRINK THE DENOMINATOR. Hero-had-no-decision is a fact
 *      about poker; the-harness-could-not-build-a-range is a fact about our instrument.
 *      Dropped windows stay counted as dealt AND are counted separately, so a reader can
 *      subtract them and see what the subtraction costs. If they were removed instead, the
 *      figure would rise when someone fixed a bug, with the strategy unchanged.
 *   4. AN EMPTY DENOMINATOR IS null — NOT 0, NOT NaN, NOT Infinity. `metrics` on a Result
 *      Card is an unguarded bag and `JSON.stringify(NaN)` emits `null`, so a genuine
 *      division error would ship byte-identical to "not measured".
 *   5. NOTHING IS SILENTLY ZEROED. An unresolvable outcome and a hand hero was not seated in
 *      are different failures with different meanings, and neither is a hand worth 0 bb.
 *      Both are counted by reason; adding them to the sum would drag the anchor toward zero
 *      and mask exactly the sign error the anchor exists to expose.
 *   6. THE ANCHOR CARRIES ITS OWN EXPECTED SIGN. The block states what it must look like, so
 *      a reader who has never read this file still knows a positive value is a failure.
 */

import { describe, it, expect } from 'vitest';
import {
  newHandLedger, countDealtWindow, markWindowDropped, sealHandLedger,
  seatOfPlayer, LEDGER_SKIP_REASONS,
} from '../backtest/handLedger.mjs';

// ── factories ────────────────────────────────────────────────────────────────────────
// Built in code rather than loaded from fixtures, per the house pattern: a fixture file is
// a second place for the shape to drift.

/** A hand seating `seats` = { seatNumber: playerId }. */
const hand = (id, seats) => ({ handId: id, seatPlayers: seats });

/** An `outcomeFor` that resolves every hand with the given per-seat nets. */
const outcomesFrom = (netsByHandId) => (h) => ({
  raked: netsByHandId[h.handId] === undefined
    ? { resolved: false, reason: 'no-ledger' }
    : { resolved: true, netBySeat: netsByHandId[h.handId] },
});

const seal = (ledger) => sealHandLedger(ledger);

describe('seatOfPlayer', () => {
  it('finds the seat regardless of whether ids are numbers or strings', () => {
    // The corpus adapter and the accumulator disagree about this on different paths, and a
    // strict === would silently return null — which reads as "hero was not dealt in" and
    // removes a real hand from the denominator.
    expect(seatOfPlayer(hand('h1', { 3: 'alice' }), 'alice')).toBe('3');
    expect(seatOfPlayer(hand('h1', { 3: 7 }), '7')).toBe('3');
    expect(seatOfPlayer(hand('h1', { 3: '7' }), 7)).toBe('3');
  });

  it('returns null rather than throwing on a hand with no seat map', () => {
    expect(seatOfPlayer({}, 'alice')).toBeNull();
    expect(seatOfPlayer(null, 'alice')).toBeNull();
  });
});

describe('Property 1 — the denominator is hands DEALT, including hands that scored nothing', () => {
  it('counts a window of preflop folds as hands dealt with a real zero contribution', () => {
    // Ten hands hero folded preflop: no postflop decision exists, so nothing is scoreable.
    // They are still ten hands hero was dealt, and each pays the blind it paid.
    const window = Array.from({ length: 10 }, (_, i) => hand(`f${i}`, { 2: 'hero' }));
    const nets = Object.fromEntries(window.map((h) => [h.handId, { 2: -1 }]));

    const ledger = newHandLedger();
    countDealtWindow(ledger, {
      playerId: 'hero', testHands: window, outcomeFor: outcomesFrom(nets),
    });

    const out = seal(ledger);
    expect(out.dealtHandsInWindows).toBe(10);
    expect(out.fieldNetResolvedHands).toBe(10);
    expect(out.fieldWinrateBB100).toBe(-100); // -1 bb per hand
  });

  it('produces a NEGATIVE field winrate on a field that pays rake — the anchor', () => {
    // The whole point. Averaged over seats the field's realized result is about minus the
    // rake. If a future change re-scopes the denominator onto hands-that-scored, this test
    // is what catches it, because that subset is selected on voluntarily reaching postflop
    // and its mean net is positive.
    const window = [
      hand('w', { 1: 'hero' }), hand('l1', { 1: 'hero' }),
      hand('l2', { 1: 'hero' }), hand('l3', { 1: 'hero' }),
    ];
    const nets = { w: { 1: 8.6 }, l1: { 1: -3 }, l2: { 1: -3 }, l3: { 1: -3 } };

    const ledger = newHandLedger();
    countDealtWindow(ledger, {
      playerId: 'hero', testHands: window, outcomeFor: outcomesFrom(nets),
    });

    const out = seal(ledger);
    expect(out.fieldWinrateBB100).toBeLessThan(0);
    expect(out.fieldWinrateBB100).toBeCloseTo(-10, 6); // (8.6 - 9) / 4 * 100
  });
});

describe('Property 2 — the unit is the hero-seat-hand, not the hand', () => {
  it('counts ONE physical hand seating three EVAL players as three hands dealt', () => {
    const shared = hand('shared', { 1: 'alice', 2: 'bob', 3: 'carol' });
    const nets = { shared: { 1: +6, 2: -3, 3: -3 } };
    const outcomeFor = outcomesFrom(nets);

    const ledger = newHandLedger();
    for (const pid of ['alice', 'bob', 'carol']) {
      countDealtWindow(ledger, { playerId: pid, testHands: [shared], outcomeFor });
    }

    const out = seal(ledger);
    expect(out.dealtHandsInWindows).toBe(3);
    expect(out.fieldNetResolvedHands).toBe(3);
    // Each hero's OWN seat net, not the hand's net counted once.
    expect(out.fieldNetSumBB).toBeCloseTo(0, 6);
  });

  it('does NOT deduplicate by hand id — the evCost handsRepresented pattern is wrong here', () => {
    // Named for the failure it guards. `evCost.mjs` builds a Set over handId, correctly, for
    // a question about hands-containing-a-node. Copying that here would report 1 instead of
    // 3 above and triple any rate built on it.
    const shared = hand('shared', { 1: 'alice', 2: 'bob' });
    const outcomeFor = outcomesFrom({ shared: { 1: +3, 2: -3 } });

    const ledger = newHandLedger();
    countDealtWindow(ledger, { playerId: 'alice', testHands: [shared], outcomeFor });
    countDealtWindow(ledger, { playerId: 'bob', testHands: [shared], outcomeFor });

    expect(seal(ledger).dealtHandsInWindows).toBe(2);
  });
});

describe('Property 3 — a harness failure may not shrink the denominator', () => {
  it('keeps a dropped window in dealtHands AND counts it separately', () => {
    const window = [hand('a', { 1: 'hero' }), hand('b', { 1: 'hero' })];
    const outcomeFor = outcomesFrom({ a: { 1: -1 }, b: { 1: -1 } });

    const ledger = newHandLedger();
    countDealtWindow(ledger, { playerId: 'hero', testHands: window, outcomeFor });
    markWindowDropped(ledger, window);

    const out = seal(ledger);
    expect(out.dealtHandsInWindows).toBe(2);          // still dealt
    expect(out.dealtHandsInDroppedWindows).toBe(2);   // and attributable to the instrument
    expect(out.fieldNetResolvedHands).toBe(2);        // the field's result is still known
  });

  it('the two counters are independent — dropping does not touch the field sum', () => {
    const window = [hand('a', { 1: 'hero' })];
    const outcomeFor = outcomesFrom({ a: { 1: -2.5 } });

    const withoutDrop = newHandLedger();
    countDealtWindow(withoutDrop, { playerId: 'hero', testHands: window, outcomeFor });

    const withDrop = newHandLedger();
    countDealtWindow(withDrop, { playerId: 'hero', testHands: window, outcomeFor });
    markWindowDropped(withDrop, window);

    expect(seal(withDrop).fieldWinrateBB100).toBe(seal(withoutDrop).fieldWinrateBB100);
  });
});

describe('Property 4 — an empty denominator is null, never 0 and never NaN', () => {
  it('reports null for a ledger that counted nothing', () => {
    const out = seal(newHandLedger());
    expect(out.fieldWinrateBB100).toBeNull();
    expect(out.dealtHandsInWindows).toBe(0);
  });

  it('reports null when every hand was dealt but none could be resolved', () => {
    const window = [hand('a', { 1: 'hero' }), hand('b', { 1: 'hero' })];
    const ledger = newHandLedger();
    countDealtWindow(ledger, {
      playerId: 'hero', testHands: window, outcomeFor: outcomesFrom({}),
    });

    const out = seal(ledger);
    expect(out.dealtHandsInWindows).toBe(2);      // they were dealt
    expect(out.fieldNetResolvedHands).toBe(0);    // and none of them are known
    expect(out.fieldWinrateBB100).toBeNull();     // so there is no rate, not a rate of zero
    expect(Number.isNaN(out.fieldWinrateBB100)).toBe(false);
  });
});

describe('Property 5 — nothing is silently zeroed', () => {
  it('counts an unresolvable outcome by reason instead of adding 0 to the sum', () => {
    const window = [hand('good', { 1: 'hero' }), hand('bad', { 1: 'hero' })];
    const outcomeFor = (h) => (h.handId === 'good'
      ? { raked: { resolved: true, netBySeat: { 1: -4 } } }
      : { raked: { resolved: false, reason: 'mucked-showdown' } });

    const ledger = newHandLedger();
    countDealtWindow(ledger, { playerId: 'hero', testHands: window, outcomeFor });

    const out = seal(ledger);
    expect(out.dealtHandsInWindows).toBe(2);
    expect(out.fieldNetResolvedHands).toBe(1);
    expect(out.fieldNetUnresolved).toEqual({ 'mucked-showdown': 1 });
    // Had the unresolved hand been counted as 0 bb, this would read -200.
    expect(out.fieldWinrateBB100).toBe(-400);
  });

  it('distinguishes hero-not-seated from hero-seat-not-in-outcome', () => {
    const window = [
      hand('notseated', { 1: 'someone-else' }),
      hand('noseatnet', { 1: 'hero' }),
    ];
    const outcomeFor = outcomesFrom({
      notseated: { 1: -1 },
      noseatnet: { 2: -1 }, // resolved, but hero's seat 1 has no entry
    });

    const ledger = newHandLedger();
    countDealtWindow(ledger, { playerId: 'hero', testHands: window, outcomeFor });

    const out = seal(ledger);
    expect(out.ledgerSkips[LEDGER_SKIP_REASONS.HERO_NOT_SEATED]).toBe(1);
    expect(out.ledgerSkips[LEDGER_SKIP_REASONS.HERO_SEAT_NOT_IN_OUTCOME]).toBe(1);
    expect(out.fieldNetResolvedHands).toBe(0);
  });
});

describe('Property 6 — the block states its own expected sign', () => {
  it('carries the unit and the expected sign so a reader needs no other file', () => {
    const out = seal(newHandLedger());
    expect(out.unit).toBe('hero-seat-hand');
    expect(out.expectedSign).toMatch(/negative/);
    expect(out.expectedSign).toMatch(/not dealt/);
    expect(out.rakeIsModelled).toBe(true);
  });
});
