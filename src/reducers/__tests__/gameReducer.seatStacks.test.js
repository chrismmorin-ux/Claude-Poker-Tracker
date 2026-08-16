/**
 * gameReducer.seatStacks.test.js — the stack ledger's reducer surface.
 *
 * Ledger arithmetic is covered in utils/seatStacks. What is pinned HERE is the
 * wiring: that the reducer keeps provenance intact, that an assumption can never
 * displace an observation, and that the ledger survives the transitions
 * (NEXT_HAND, RESET_HAND) that clear everything else.
 */

import { describe, it, expect } from 'vitest';
import { gameReducer, GAME_ACTIONS, initialGameState } from '../gameReducer';
import { STACK_SOURCE, STALE_AFTER_HANDS } from '../../utils/seatStacks/stackLedger';

const base = () => ({ ...initialGameState, seatStacks: {}, handNumber: 0 });

describe('gameReducer — seat stack entry', () => {
  it('records an entered stack against the current hand number', () => {
    const state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK,
      payload: { seat: 4, amount: 340 },
    });
    expect(state.seatStacks[4]).toEqual({
      amount: 340,
      source: STACK_SOURCE.ENTERED,
      observedAtHand: 0,
    });
  });

  it('ignores an invalid seat rather than corrupting the ledger', () => {
    const start = base();
    expect(gameReducer(start, {
      type: GAME_ACTIONS.SET_SEAT_STACK,
      payload: { seat: 99, amount: 100 },
    })).toBe(start);
  });

  it('clears a seat when the player leaves', () => {
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 2, amount: 100 },
    });
    state = gameReducer(state, { type: GAME_ACTIONS.CLEAR_SEAT_STACK, payload: { seat: 2 } });
    expect(state.seatStacks[2]).toBeUndefined();
  });
});

describe('gameReducer — seeding', () => {
  it('seeds unknown seats from the session buy-in', () => {
    const state = gameReducer(base(), {
      type: GAME_ACTIONS.SEED_SEAT_STACKS,
      payload: { seats: [1, 2, 3], buyIn: 200 },
    });
    expect(state.seatStacks[1].source).toBe(STACK_SOURCE.BUYIN_DEFAULT);
    expect(state.seatStacks[3].amount).toBe(200);
  });

  it('an assumption NEVER displaces an observation', () => {
    // The founder typed 340 for seat 2. Seeding must not overwrite that with the
    // buy-in just because a later seed pass swept the table.
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 2, amount: 340 },
    });
    state = gameReducer(state, {
      type: GAME_ACTIONS.SEED_SEAT_STACKS, payload: { seats: [1, 2, 3], buyIn: 200 },
    });
    expect(state.seatStacks[2].amount).toBe(340);
    expect(state.seatStacks[2].source).toBe(STACK_SOURCE.ENTERED);
    expect(state.seatStacks[1].amount).toBe(200);
  });

  it('is a no-op without a usable buy-in', () => {
    const start = base();
    expect(gameReducer(start, {
      type: GAME_ACTIONS.SEED_SEAT_STACKS, payload: { seats: [1], buyIn: null },
    })).toBe(start);
  });
});

describe('gameReducer — reconciliation (observed beats derived)', () => {
  it('corrects the ledger when a seat commits more than it was credited with', () => {
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 3, amount: 80 },
    });
    state = gameReducer(state, {
      type: GAME_ACTIONS.RECONCILE_SEAT_STACKS,
      payload: { contributions: { 3: 340 } },
    });
    expect(state.seatStacks[3].amount).toBe(340);
    expect(state.seatStacks[3].source).toBe(STACK_SOURCE.ENTERED);
  });

  it('returns the SAME state object when nothing contradicts', () => {
    // Identity matters: this dispatch can fire on every recorded action, and a
    // fresh object each time would re-render the table for nothing.
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 3, amount: 500 },
    });
    const before = state;
    state = gameReducer(state, {
      type: GAME_ACTIONS.RECONCILE_SEAT_STACKS,
      payload: { contributions: { 3: 25 } },
    });
    expect(state).toBe(before);
  });
});

describe('gameReducer — NEXT_HAND carries the ledger', () => {
  it('applies the settlement and advances the hand number', () => {
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 1, amount: 200 },
    });
    state = gameReducer(state, {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 2, amount: 200 },
    });

    state = gameReducer(state, {
      type: GAME_ACTIONS.NEXT_HAND,
      payload: { contributions: { 1: 50, 2: 50 }, payouts: { 1: 100 }, estimated: false },
    });

    expect(state.seatStacks[1].amount).toBe(250);
    expect(state.seatStacks[2].amount).toBe(150);
    expect(state.handNumber).toBe(1);
    // Arithmetic is not observation.
    expect(state.seatStacks[1].source).toBe(STACK_SOURCE.CARRIED);
  });

  it('carries with zero movement when no settlement was supplied', () => {
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 1, amount: 200 },
    });
    state = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });
    expect(state.seatStacks[1].amount).toBe(200);
    expect(state.handNumber).toBe(1);
  });

  it('a stack goes stale after an orbit of hands without a fresh observation', () => {
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 1, amount: 200 },
    });
    for (let i = 0; i < STALE_AFTER_HANDS; i++) {
      state = gameReducer(state, { type: GAME_ACTIONS.NEXT_HAND });
    }
    // observedAtHand is preserved across every carry, so the age is real.
    expect(state.seatStacks[1].observedAtHand).toBe(0);
    expect(state.handNumber).toBe(STALE_AFTER_HANDS);
  });
});

describe('gameReducer — RESET_HAND', () => {
  it('keeps the ledger — undoing a misrecorded hand does not restack the table', () => {
    let state = gameReducer(base(), {
      type: GAME_ACTIONS.SET_SEAT_STACK, payload: { seat: 5, amount: 275 },
    });
    state = gameReducer(state, { type: GAME_ACTIONS.RESET_HAND });
    expect(state.seatStacks[5].amount).toBe(275);
    expect(state.handNumber).toBe(0);
  });
});
