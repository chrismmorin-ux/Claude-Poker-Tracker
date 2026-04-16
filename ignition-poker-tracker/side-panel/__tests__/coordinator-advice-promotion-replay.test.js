/**
 * coordinator-advice-promotion-replay.test.js — deterministic replay of the
 * two pending-advice promotion paths in render-coordinator.handleLiveContext
 * (lines 593-627). Guards against RT-45-class regressions if the routing
 * between handleAdvice / handleLiveContext is refactored.
 *
 * Path A — new-hand exact-match (lines 609-616): advice arrives before live
 * context; first live context is a PREFLOP/DEALING boundary at the same street
 * rank as the held advice. Promote.
 *
 * Path B — mid-hand reconnect exact-match (lines 617-625): advice arrives
 * before live context; first live context is mid-hand (not PREFLOP/DEALING)
 * at the same street rank as the held advice. Promote via the non-boundary
 * branch.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RenderCoordinator } from '../render-coordinator.js';

function createCoordinator() {
  const renders = [];
  const coord = new RenderCoordinator({
    renderFn: (snap, reason) => renders.push({ reason }),
    getTimestamp: () => Date.now(),
    requestFrame: (cb) => setTimeout(cb, 0),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  });
  return { coord, renders };
}

describe('advice promotion replay (render-coordinator handleLiveContext)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('Path A — new-hand boundary promotes held pending advice at exact street match', () => {
    const { coord } = createCoordinator();

    // Step 1: advice arrives with no live context — buffered as _pendingAdvice.
    const accepted = coord.handleAdvice({
      currentStreet: 'preflop',
      villainSeat: 3,
      handNumber: 42,
    });
    expect(accepted).toBe(false);
    expect(coord.getPendingAdvice()).not.toBeNull();
    expect(coord.get('lastGoodAdvice')).toBeNull();

    // Step 2: first live context is a new-hand boundary (PREFLOP), same street rank.
    coord.handleLiveContext({
      state: 'PREFLOP',
      currentStreet: 'preflop',
      handNumber: 42,
      heroSeat: 5,
      dealerSeat: 3,
      activeSeatNumbers: [1, 3, 5],
      foldedSeats: [],
    });

    // Path A fired: promoted into lastGoodAdvice, pending cleared.
    expect(coord.get('lastGoodAdvice')).not.toBeNull();
    expect(coord.get('lastGoodAdvice').currentStreet).toBe('preflop');
    expect(coord.getPendingAdvice()).toBeNull();
    // advicePendingForStreet should NOT be set — hand-boundary clear was skipped
    // because promotedPending=true.
    expect(coord.get('advicePendingForStreet')).toBeNull();
  });

  it('Path B — mid-hand reconnect promotes held pending advice at exact street match', () => {
    const { coord } = createCoordinator();

    // Step 1: advice arrives with no live context — buffered as _pendingAdvice.
    // SW reconnect after a refresh: advice cached locally arrives before the
    // pipeline pushes a fresh context.
    const accepted = coord.handleAdvice({
      currentStreet: 'flop',
      villainSeat: 3,
      handNumber: 42,
    });
    expect(accepted).toBe(false);
    expect(coord.getPendingAdvice()).not.toBeNull();

    // Step 2: first live context is mid-hand (FLOP) — NOT a PREFLOP/DEALING
    // boundary. isNewHand=false, so Path B exact-match branch runs.
    coord.handleLiveContext({
      state: 'FLOP',
      currentStreet: 'flop',
      handNumber: 42,
      heroSeat: 5,
      dealerSeat: 3,
      communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
      activeSeatNumbers: [3, 5],
      foldedSeats: [],
    });

    expect(coord.get('lastGoodAdvice')).not.toBeNull();
    expect(coord.get('lastGoodAdvice').currentStreet).toBe('flop');
    expect(coord.getPendingAdvice()).toBeNull();
  });

  // RT-69 — new-hand boundary unconditionally nulls _pendingAdvice even if
  // pending advice was injected directly (e.g. SW reanimation buffered advice
  // that survived promotion logic). Belt-and-suspenders against cross-hand
  // leak into the next hand's render.
  it('RT-69 — _pendingAdvice is null after new-hand boundary processing', () => {
    const { coord } = createCoordinator();

    // Inject pending advice directly — simulates any failure mode where
    // pending survives the promotion attempt (line 627 already clears on
    // the promotion path, so this test pins the defensive clear at the
    // new-hand block itself).
    coord._pendingAdvice = { currentStreet: 'flop', villainSeat: 3, handNumber: 41 };

    coord.handleLiveContext({
      state: 'PREFLOP',
      currentStreet: 'preflop',
      handNumber: 42,
      heroSeat: 5,
      dealerSeat: 3,
      activeSeatNumbers: [1, 3, 5],
      foldedSeats: [],
    });

    expect(coord.getPendingAdvice()).toBeNull();
    expect(coord.get('lastGoodAdvice')).toBeNull();
  });

  it('Path A — stale-street pending advice is dropped at hand boundary, NOT promoted', () => {
    const { coord } = createCoordinator();

    // River advice arriving before a new-hand PREFLOP context is stale from
    // the previous hand. Must be dropped, not promoted (lines 610-615 guard).
    coord.handleAdvice({ currentStreet: 'river', handNumber: 41 });
    expect(coord.getPendingAdvice()).not.toBeNull();

    coord.handleLiveContext({
      state: 'PREFLOP',
      currentStreet: 'preflop',
      handNumber: 42,
      heroSeat: 5,
      dealerSeat: 3,
      activeSeatNumbers: [1, 3, 5],
      foldedSeats: [],
    });

    expect(coord.get('lastGoodAdvice')).toBeNull();
    expect(coord.getPendingAdvice()).toBeNull();
    // Hand-boundary clear ran because promotedPending=false.
    expect(coord.get('advicePendingForStreet')).toBe('PREFLOP');
  });
});
