/**
 * stackLedger.test.js
 *
 * The property that matters most here is NOT arithmetic accuracy — it is
 * INV-STK-01: drift must produce ABSTENTION, never a false refutation. A ledger
 * that quietly goes wrong and then disproves a true founder claim is worse than
 * having no ledger at all, so the staleness and admissibility paths are pinned
 * harder than the sums.
 */

import { describe, it, expect } from 'vitest';
import {
  STACK_SOURCE,
  STALE_AFTER_HANDS,
  seedLedger,
  setSeatStack,
  clearSeatStack,
  reconcileWithContributions,
  advanceHand,
  readStack,
  resolveSource,
  isAdmissible,
  effectiveStackAt,
  sprFrom,
  toBigBlinds,
  buildStackBinding,
} from '../stackLedger';

describe('stackLedger — seeding and entry', () => {
  it('seeds seats from the session buy-in as never-observed assumptions', () => {
    const ledger = seedLedger({ seats: [1, 2, 3], buyIn: 200, atHand: 0 });
    expect(readStack(ledger, 1, 0)).toEqual({
      amount: 200,
      source: STACK_SOURCE.BUYIN_DEFAULT,
      admissible: false,
    });
  });

  it('a buy-in assumption is NOT admissible — it was never observed', () => {
    const ledger = seedLedger({ seats: [1], buyIn: 200, atHand: 0 });
    expect(isAdmissible(ledger[1], 0)).toBe(false);
  });

  it('seeds nothing without a usable buy-in rather than inventing a number', () => {
    expect(seedLedger({ seats: [1, 2], buyIn: null })).toEqual({});
    expect(seedLedger({ seats: [1, 2], buyIn: 0 })).toEqual({});
  });

  it('an entered value is the strongest source', () => {
    const ledger = setSeatStack({}, { seat: 4, amount: 340, atHand: 7 });
    expect(readStack(ledger, 4, 7)).toEqual({
      amount: 340,
      source: STACK_SOURCE.ENTERED,
      admissible: true,
    });
  });

  it('rejects a negative or non-numeric entry instead of coercing it', () => {
    expect(setSeatStack({}, { seat: 1, amount: -5 })).toEqual({});
    expect(setSeatStack({}, { seat: 1, amount: 'lots' })).toEqual({});
  });

  it('an unknown seat reads as null, never 0', () => {
    // 0 is a legitimate stack. Returning it for "no idea" is what made
    // deriveEffStackAt silently suppress the SPR zone on every cash hand.
    expect(readStack({}, 5, 0)).toEqual({
      amount: null,
      source: STACK_SOURCE.UNKNOWN,
      admissible: false,
    });
  });

  it('clears a seat outright when the player leaves', () => {
    const ledger = setSeatStack({}, { seat: 2, amount: 100, atHand: 0 });
    expect(readStack(clearSeatStack(ledger, 2), 2, 0).source).toBe(STACK_SOURCE.UNKNOWN);
  });
});

describe('stackLedger — provenance decay (C-1)', () => {
  it('an entered value becomes carried once the hand it was observed in passes', () => {
    const ledger = setSeatStack({}, { seat: 1, amount: 200, atHand: 10 });
    expect(resolveSource(ledger[1], 10)).toBe(STACK_SOURCE.ENTERED);
    expect(resolveSource(ledger[1], 11)).toBe(STACK_SOURCE.CARRIED);
  });

  it('goes stale after an orbit without a fresh observation', () => {
    const ledger = setSeatStack({}, { seat: 1, amount: 200, atHand: 0 });
    expect(resolveSource(ledger[1], STALE_AFTER_HANDS - 1)).toBe(STACK_SOURCE.CARRIED);
    expect(resolveSource(ledger[1], STALE_AFTER_HANDS)).toBe(STACK_SOURCE.STALE);
  });

  it('a buy-in assumption expires as soon as a hand has been played', () => {
    const ledger = seedLedger({ seats: [1], buyIn: 200, atHand: 0 });
    expect(resolveSource(ledger[1], 0)).toBe(STACK_SOURCE.BUYIN_DEFAULT);
    expect(resolveSource(ledger[1], 1)).toBe(STACK_SOURCE.STALE);
  });

  it('INV-STK-01: a stale value is NOT admissible', () => {
    const ledger = setSeatStack({}, { seat: 1, amount: 200, atHand: 0 });
    expect(isAdmissible(ledger[1], STALE_AFTER_HANDS)).toBe(false);
  });

  it('staleness measures distance from OBSERVATION, not from the last arithmetic', () => {
    // The bug this pins: if carry-forward refreshed the timestamp, a stack
    // nobody has looked at in fifty hands would read as freshly carried forever.
    let ledger = setSeatStack({}, { seat: 1, amount: 200, atHand: 0 });
    for (let hand = 1; hand <= STALE_AFTER_HANDS; hand++) {
      ledger = advanceHand(ledger, { contributions: {}, payouts: {} });
    }
    expect(resolveSource(ledger[1], STALE_AFTER_HANDS)).toBe(STACK_SOURCE.STALE);
  });
});

describe('stackLedger — carry-forward', () => {
  it('carries stack minus committed plus won', () => {
    const ledger = {
      1: { amount: 200, source: STACK_SOURCE.ENTERED, observedAtHand: 0 },
      2: { amount: 150, source: STACK_SOURCE.ENTERED, observedAtHand: 0 },
    };
    const next = advanceHand(ledger, {
      contributions: { 1: 50, 2: 50 },
      payouts: { 1: 100 },
    });
    expect(next[1].amount).toBe(250);   // 200 - 50 + 100
    expect(next[2].amount).toBe(100);   // 150 - 50
  });

  it('demotes an entered value to carried — arithmetic is not observation', () => {
    const ledger = setSeatStack({}, { seat: 1, amount: 200, atHand: 3 });
    const next = advanceHand(ledger, { contributions: {}, payouts: {} });
    expect(next[1].source).toBe(STACK_SOURCE.CARRIED);
    expect(next[1].observedAtHand).toBe(3);
  });

  it('never carries a stack below zero', () => {
    const ledger = { 1: { amount: 40, source: STACK_SOURCE.ENTERED, observedAtHand: 0 } };
    expect(advanceHand(ledger, { contributions: { 1: 100 }, payouts: {} })[1].amount).toBe(0);
  });

  it('a buy-in assumption stays an assumption when carried', () => {
    const ledger = seedLedger({ seats: [1], buyIn: 200, atHand: 0 });
    expect(advanceHand(ledger, { contributions: {}, payouts: {} })[1].source)
      .toBe(STACK_SOURCE.BUYIN_DEFAULT);
  });

  it('degrades to STALE rather than propagating an estimated hand', () => {
    // calculateSidePots flags `isEstimated` when a bet/raise lacked an amount.
    // Subtracting an unreliable figure would corrupt the stack by an unknown
    // amount and then present the result as trustworthy `carried`.
    const ledger = setSeatStack({}, { seat: 1, amount: 200, atHand: 0 });
    const next = advanceHand(ledger, { contributions: { 1: 50 }, payouts: {}, estimated: true });
    expect(next[1].source).toBe(STACK_SOURCE.STALE);
    expect(next[1].amount).toBe(200);   // untouched — better unchanged than wrong
    expect(isAdmissible(next[1], 0)).toBe(false);
  });

  it('conserves chips across a hand', () => {
    const ledger = {
      1: { amount: 200, source: STACK_SOURCE.ENTERED, observedAtHand: 0 },
      2: { amount: 200, source: STACK_SOURCE.ENTERED, observedAtHand: 0 },
      3: { amount: 200, source: STACK_SOURCE.ENTERED, observedAtHand: 0 },
    };
    const contributions = { 1: 60, 2: 60, 3: 20 };
    const potTotal = 140;
    const next = advanceHand(ledger, { contributions, payouts: { 2: potTotal } });
    const before = Object.values(ledger).reduce((s, e) => s + e.amount, 0);
    const after = Object.values(next).reduce((s, e) => s + e.amount, 0);
    expect(after).toBe(before);
  });
});

describe('stackLedger — observed beats derived (C-3)', () => {
  it('REGRESSION: a seat committing more than the ledger credits corrects it', () => {
    // The rebuy case. The ledger thinks seat 3 has $80; he shoves $340. The
    // ledger is now proved wrong by evidence.
    const ledger = { 3: { amount: 80, source: STACK_SOURCE.CARRIED, observedAtHand: 0 } };
    const { ledger: next, corrections } = reconcileWithContributions(ledger, {
      contributions: { 3: 340 },
      atHand: 5,
    });
    expect(next[3].amount).toBe(340);
    expect(next[3].source).toBe(STACK_SOURCE.ENTERED);
    expect(corrections).toEqual([{ seat: 3, from: 80, to: 340 }]);
  });

  it('promotes to entered — the figure is now evidence-grounded', () => {
    const ledger = { 3: { amount: 80, source: STACK_SOURCE.CARRIED, observedAtHand: 0 } };
    const { ledger: next } = reconcileWithContributions(ledger, {
      contributions: { 3: 340 },
      atHand: 5,
    });
    expect(isAdmissible(next[3], 5)).toBe(true);
  });

  it('establishes a stack for a seat that had none', () => {
    const { ledger: next } = reconcileWithContributions({}, {
      contributions: { 7: 55 },
      atHand: 2,
    });
    expect(readStack(next, 7, 2)).toEqual({
      amount: 55,
      source: STACK_SOURCE.ENTERED,
      admissible: true,
    });
  });

  it('never lowers a stack — betting less than you have proves nothing', () => {
    const ledger = { 3: { amount: 500, source: STACK_SOURCE.ENTERED, observedAtHand: 1 } };
    const { ledger: next, corrections } = reconcileWithContributions(ledger, {
      contributions: { 3: 25 },
      atHand: 1,
    });
    expect(next[3].amount).toBe(500);
    expect(corrections).toEqual([]);
  });

  it('does not treat estimated contributions as observations', () => {
    const ledger = { 3: { amount: 80, source: STACK_SOURCE.CARRIED, observedAtHand: 0 } };
    const { ledger: next, corrections } = reconcileWithContributions(ledger, {
      contributions: { 3: 340 },
      atHand: 5,
      estimated: true,
    });
    expect(next[3].amount).toBe(80);
    expect(corrections).toEqual([]);
  });
});

describe('stackLedger — effective stack', () => {
  const live = (amounts, atHand = 0) =>
    Object.fromEntries(
      Object.entries(amounts).map(([seat, amount]) => [
        seat,
        { amount, source: STACK_SOURCE.ENTERED, observedAtHand: atHand },
      ]),
    );

  it('heads-up: min(hero, villain)', () => {
    const ledger = live({ 1: 300, 2: 120 });
    expect(effectiveStackAt(ledger, { heroSeat: 1, liveSeats: [1, 2] }).amount).toBe(120);
  });

  it('is bounded by the DEEPEST opponent, not the shallowest', () => {
    // Hero can still play his whole stack against whoever covers him; a short
    // third player does not cap what is at stake against the deep one.
    const ledger = live({ 1: 300, 2: 40, 3: 500 });
    expect(effectiveStackAt(ledger, { heroSeat: 1, liveSeats: [1, 2, 3] }).amount).toBe(300);
  });

  it('abstains when hero is inadmissible rather than guessing', () => {
    const ledger = {
      1: { amount: 300, source: STACK_SOURCE.BUYIN_DEFAULT, observedAtHand: 0 },
      2: { amount: 120, source: STACK_SOURCE.ENTERED, observedAtHand: 5 },
    };
    const eff = effectiveStackAt(ledger, { heroSeat: 1, liveSeats: [1, 2], currentHand: 5 });
    expect(eff.amount).toBeNull();
    expect(eff.admissible).toBe(false);
  });

  it('abstains when every opponent is inadmissible', () => {
    const ledger = {
      1: { amount: 300, source: STACK_SOURCE.ENTERED, observedAtHand: 5 },
      2: { amount: 120, source: STACK_SOURCE.ENTERED, observedAtHand: 0 },  // stale by hand 5+
    };
    const eff = effectiveStackAt(ledger, {
      heroSeat: 1, liveSeats: [1, 2], currentHand: STALE_AFTER_HANDS,
    });
    expect(eff.amount).toBeNull();
  });

  it('reports the weakest input source, not the strongest', () => {
    const ledger = {
      1: { amount: 300, source: STACK_SOURCE.ENTERED, observedAtHand: 5 },
      2: { amount: 120, source: STACK_SOURCE.ENTERED, observedAtHand: 3 },  // carried by hand 5
    };
    const eff = effectiveStackAt(ledger, { heroSeat: 1, liveSeats: [1, 2], currentHand: 5 });
    expect(eff.source).toBe(STACK_SOURCE.CARRIED);
  });
});

describe('stackLedger — derived units', () => {
  it('SPR is null on a null or zero pot, never 0', () => {
    expect(sprFrom(200, 0)).toBeNull();
    expect(sprFrom(200, null)).toBeNull();
    expect(sprFrom(null, 50)).toBeNull();
    expect(sprFrom(200, 50)).toBe(4);
  });

  it('converts to big blinds — the unit stack-depth claims are made in', () => {
    expect(toBigBlinds(44, 2)).toBe(22);
    expect(toBigBlinds(44, 0)).toBeNull();
    expect(toBigBlinds(null, 2)).toBeNull();
  });
});

describe('stackLedger — snapshot binding', () => {
  it('every value travels with its provenance', () => {
    const ledger = {
      1: { amount: 300, source: STACK_SOURCE.ENTERED, observedAtHand: 4 },
      2: { amount: 120, source: STACK_SOURCE.ENTERED, observedAtHand: 4 },
    };
    const binding = buildStackBinding(ledger, {
      heroSeat: 1, liveSeats: [1, 2], currentHand: 4, pot: 60, bb: 2,
    });
    expect(binding.stacks).toEqual({ 1: 300, 2: 120 });
    expect(binding.stackSources).toEqual({ 1: STACK_SOURCE.ENTERED, 2: STACK_SOURCE.ENTERED });
    expect(binding.effStack).toBe(120);
    expect(binding.effStackBB).toBe(60);
    expect(binding.spr).toBe(2);
    expect(binding.stacksAdmissible).toBe(true);
  });

  it('binds nulls rather than guesses when nothing is known', () => {
    const binding = buildStackBinding({}, {
      heroSeat: 1, liveSeats: [1, 2], currentHand: 0, pot: 60, bb: 2,
    });
    expect(binding.effStack).toBeNull();
    expect(binding.spr).toBeNull();
    expect(binding.effStackBB).toBeNull();
    expect(binding.stacksAdmissible).toBe(false);
    expect(binding.stacks).toEqual({ 1: null, 2: null });
  });
});
