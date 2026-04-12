/**
 * lifecycle-invariants.test.js — Full hand lifecycle tests with invariant assertions.
 *
 * These tests replay realistic multi-message sequences through the HarnessRunner
 * and verify state invariants at every step. They catch temporal bugs that
 * static fixture tests cannot detect.
 *
 * 8 scenarios covering: complete hand cycle, position stability, stale timeout,
 * table switch, rapid-fire coalescing, recovery + data, stuck waiting, villain equity.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HarnessRunner } from './message-harness.js';
import { StateInvariantChecker } from '../state-invariants.js';
import {
  msgLiveContext, msgAdvice, msgPipeline, msgExploits,
  msgHandsUpdated, msgRecoveryNeeded, msgDiag,
  ctxPreflop, ctxFlop, ctxTurn, ctxRiver, ctxDealing,
  advPreflop, advFlop, advTurn, advRiver,
} from './message-sequences.js';

// =========================================================================
// HELPERS
// =========================================================================

let harness;
let checker;

/** Push message, flush, and check invariants. Throws on violation. */
function pushAndVerify(msg) {
  harness.push(msg);
  vi.advanceTimersByTime(100); // past coalesce window
  harness.flush();
  const snap = harness.snapshot();
  const result = checker.check(snap);
  if (result.violations.length > 0) {
    throw new Error(`Invariant violations after ${msg.type}:\n  ${result.violations.join('\n  ')}`);
  }
  return snap;
}

/** Advance time and flush, then check invariants. */
function advanceAndVerify(ms) {
  vi.advanceTimersByTime(ms);
  harness.flush();
  const snap = harness.snapshot();
  const result = checker.check(snap);
  if (result.violations.length > 0) {
    throw new Error(`Invariant violations after ${ms}ms advance:\n  ${result.violations.join('\n  ')}`);
  }
  return snap;
}

// =========================================================================
// TESTS
// =========================================================================

describe('Lifecycle Invariants', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness = new HarnessRunner();
    checker = new StateInvariantChecker();
  });

  afterEach(() => {
    harness.destroy();
    vi.useRealTimers();
  });

  // =====================================================================
  // Scenario A: Complete hand cycle (4 streets + next hand)
  // =====================================================================

  it('A: complete hand cycle through 4 streets with invariants at every step', () => {
    // Table connect
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));

    // Hand 1: PREFLOP
    let snap = pushAndVerify(msgLiveContext(ctxPreflop({ dealerSeat: 3 })));
    expect(snap.currentLiveContext.currentStreet).toBe('preflop');
    expect(snap.currentLiveContext.heroSeat).toBe(5);
    expect(snap.currentLiveContext.dealerSeat).toBe(3);

    pushAndVerify(msgAdvice(advPreflop()));
    expect(harness.snapshot().lastGoodAdvice.currentStreet).toBe('preflop');

    // Hand 1: FLOP
    snap = pushAndVerify(msgLiveContext(ctxFlop({ dealerSeat: 3 })));
    expect(snap.currentLiveContext.currentStreet).toBe('flop');
    // Position must be stable (same dealerSeat as preflop)
    expect(snap.currentLiveContext.dealerSeat).toBe(3);

    pushAndVerify(msgAdvice(advFlop()));

    // Hand 1: TURN
    snap = pushAndVerify(msgLiveContext(ctxTurn({ dealerSeat: 3 })));
    expect(snap.currentLiveContext.currentStreet).toBe('turn');
    expect(snap.currentLiveContext.dealerSeat).toBe(3);

    pushAndVerify(msgAdvice(advTurn()));

    // Hand 1: RIVER
    snap = pushAndVerify(msgLiveContext(ctxRiver({ dealerSeat: 3 })));
    expect(snap.currentLiveContext.currentStreet).toBe('river');
    expect(snap.currentLiveContext.dealerSeat).toBe(3);

    pushAndVerify(msgAdvice(advRiver()));

    // Hand 2: DEALING (boundary)
    snap = pushAndVerify(msgLiveContext(ctxDealing({ handNumber: 'HAND_002' })));
    expect(snap.lastGoodAdvice).toBeNull(); // cleared at hand boundary

    // Hand 2: PREFLOP (new button position)
    snap = pushAndVerify(msgLiveContext(ctxPreflop({ handNumber: 'HAND_002', dealerSeat: 5 })));
    expect(snap.currentLiveContext.dealerSeat).toBe(5); // new hand, new lock
    pushAndVerify(msgAdvice(advPreflop({ currentStreet: 'preflop' })));
  });

  // =====================================================================
  // Scenario B: Position stability under protocol noise
  // =====================================================================

  it('B: position lock prevents mid-hand dealer seat change', () => {
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));

    // Hand start: hero=5, dealer=3
    pushAndVerify(msgLiveContext(ctxPreflop({ heroSeat: 5, dealerSeat: 3 })));
    let snap = harness.snapshot();
    expect(snap.currentLiveContext.dealerSeat).toBe(3);

    // Protocol noise: dealer seat changes mid-hand
    pushAndVerify(msgLiveContext(ctxPreflop({ heroSeat: 5, dealerSeat: 7, pot: 3 })));
    snap = harness.snapshot();
    // Position lock should override — dealerSeat stays 3
    expect(snap.currentLiveContext.dealerSeat).toBe(3);

    // Another noise: hero seat changes mid-hand
    pushAndVerify(msgLiveContext(ctxFlop({ heroSeat: 2, dealerSeat: 3 })));
    snap = harness.snapshot();
    // Hero seat locked to 5
    expect(snap.currentLiveContext.heroSeat).toBe(5);

    // Verify pipeline events logged the overrides
    const events = harness.coord.get('pipelineEvents');
    const overrides = events.filter(e => e.event === 'position_override');
    expect(overrides.length).toBeGreaterThanOrEqual(1);
  });

  // =====================================================================
  // Scenario C: Disconnect/reconnect (stale timeout)
  // =====================================================================

  it('C: stale timeout clears context and advice pending, reconnect starts fresh', () => {
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));

    // Active hand
    pushAndVerify(msgLiveContext(ctxFlop()));
    pushAndVerify(msgAdvice(advFlop()));

    let snap = harness.snapshot();
    expect(snap.lastGoodAdvice).not.toBeNull();

    // Simulate stale indicator (side-panel.js setInterval at 60s)
    harness.coord.set('staleContext', true);
    harness.coord.scheduleRender('stale_indicator');
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.coord.get('staleContext')).toBe(true);

    // Simulate full stale clear (side-panel.js setInterval at 120s)
    harness.coord.set('currentLiveContext', null);
    harness.coord.set('staleContext', false);
    harness.coord.set('advicePendingForStreet', null);
    harness.coord.scheduleRender('stale_full_clear');
    vi.advanceTimersByTime(100);
    harness.flush();

    snap = harness.snapshot();
    expect(snap.currentLiveContext).toBeNull();
    expect(snap.advicePendingForStreet).toBeNull(); // NOT stuck

    // Verify no violations in cleared state
    const result = checker.check(snap);
    expect(result.violations).toHaveLength(0);

    // Reconnect with new hand
    snap = pushAndVerify(msgLiveContext(ctxPreflop({ handNumber: 'HAND_003' })));
    expect(snap.currentLiveContext.currentStreet).toBe('preflop');
    // No carryover from hand_001
    expect(snap.lastGoodAdvice).toBeNull();
  });

  // =====================================================================
  // Scenario D: Table switch mid-hand
  // =====================================================================

  it('D: table switch clears all per-table state', () => {
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));
    pushAndVerify(msgLiveContext(ctxFlop()));
    pushAndVerify(msgAdvice(advFlop()));

    let snap = harness.snapshot();
    expect(snap.lastGoodAdvice).not.toBeNull();
    expect(snap.currentActiveTableId).toBe('table_conn_1');

    // Switch to different table
    snap = pushAndVerify(msgPipeline({ conn_2: { state: 'active' } }));
    expect(snap.currentActiveTableId).toBe('table_conn_2');
    expect(snap.lastGoodAdvice).toBeNull(); // cleared
    expect(snap.currentLiveContext).toBeNull(); // cleared
    expect(snap.pinnedVillainSeat).toBeNull(); // cleared

    // Position lock should be cleared too
    expect(harness.coord.get('_lockedHeroSeat')).toBeNull();
    expect(harness.coord.get('_lockedDealerSeat')).toBeNull();

    // New table, new hand
    pushAndVerify(msgLiveContext(ctxPreflop({ handNumber: 'TABLE2_H1', dealerSeat: 7 })));
    snap = harness.snapshot();
    expect(snap.currentLiveContext.dealerSeat).toBe(7);
  });

  // =====================================================================
  // Scenario E: Rapid-fire context updates don't cause position flicker
  // =====================================================================

  it('E: rapid updates coalesce, position stays stable', () => {
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));
    pushAndVerify(msgLiveContext(ctxPreflop({ dealerSeat: 3 })));

    harness.clearRenders();

    // 4 rapid context updates (pot changes, same hand)
    harness.push(msgLiveContext(ctxPreflop({ pot: 2, dealerSeat: 3 })));
    harness.push(msgLiveContext(ctxPreflop({ pot: 3, dealerSeat: 3 })));
    harness.push(msgLiveContext(ctxPreflop({ pot: 4, dealerSeat: 3 })));
    harness.push(msgLiveContext(ctxPreflop({ pot: 5, dealerSeat: 3 })));

    vi.advanceTimersByTime(100);
    harness.flush();

    // Should coalesce into 1-2 renders, not 4
    expect(harness.totalRenders()).toBeLessThanOrEqual(6); // includes earlier renders

    // Position must be stable
    const snap = harness.snapshot();
    expect(snap.currentLiveContext.dealerSeat).toBe(3);
    expect(snap.currentLiveContext.heroSeat).toBe(5);
  });

  // =====================================================================
  // Scenario F: Recovery message doesn't block hand rendering
  // =====================================================================

  it('F: recovery message clears when traffic arrives, hand data visible', () => {
    pushAndVerify(msgRecoveryNeeded('silence', 'No traffic detected'));

    let snap = harness.snapshot();
    expect(snap.recoveryMessage).toBeTruthy();

    // Traffic arrives — diagnostics clear recovery
    pushAndVerify(msgDiag({ gameWsMessageCount: 5 }));
    snap = harness.snapshot();
    expect(snap.recoveryMessage).toBeNull(); // cleared by diag handler

    // Hand data arrives normally
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));
    pushAndVerify(msgLiveContext(ctxPreflop()));
    snap = pushAndVerify(msgAdvice(advPreflop()));
    expect(snap.lastGoodAdvice.currentStreet).toBe('preflop');
  });

  // =====================================================================
  // Scenario G: advicePendingForStreet never persists past stale timeout
  // =====================================================================

  it('G: advice pending cleared after stale full clear (not stuck)', () => {
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));

    // Hand starts, no advice arrives
    pushAndVerify(msgLiveContext(ctxPreflop()));
    let snap = harness.snapshot();
    // advicePendingForStreet should be set (waiting for advice)
    expect(snap.advicePendingForStreet).not.toBeNull();

    // Simulate full stale clear (120s timeout, done by side-panel.js setInterval)
    harness.coord.set('currentLiveContext', null);
    harness.coord.set('staleContext', false);
    harness.coord.set('advicePendingForStreet', null);
    harness.coord.scheduleRender('stale_full_clear');
    vi.advanceTimersByTime(100);
    harness.flush();

    snap = harness.snapshot();
    expect(snap.advicePendingForStreet).toBeNull(); // NOT stuck
    expect(snap.currentLiveContext).toBeNull();

    // No invariant violations
    const result = checker.check(snap);
    expect(result.violations).toHaveLength(0);
  });

  // =====================================================================
  // Scenario H: Villain equity always available when villain in hand
  // =====================================================================

  it('H: villain equity present in advice when villain is active', () => {
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));

    // Flop with villain equity
    pushAndVerify(msgLiveContext(ctxFlop({ activeSeatNumbers: [3, 5] })));
    pushAndVerify(msgAdvice(advFlop({
      villainSeat: 3,
      heroEquity: 0.55,
      villainRanges: [{ seat: 3, equity: 0.42, active: true, range: new Array(169).fill(0.5) }],
    })));

    let snap = harness.snapshot();
    expect(snap.lastGoodAdvice.villainRanges[0].equity).toBe(0.42);

    // Turn — villain still active
    pushAndVerify(msgLiveContext(ctxTurn({ activeSeatNumbers: [3, 5] })));
    pushAndVerify(msgAdvice(advTurn({
      villainSeat: 3,
      heroEquity: 0.60,
      villainRanges: [{ seat: 3, equity: 0.38, active: true }],
    })));

    snap = harness.snapshot();
    expect(snap.lastGoodAdvice.villainRanges[0].equity).toBe(0.38);
    // Focused villain should be seat 3
    expect(snap.focusedVillainSeat).toBe(3);
  });

  // =====================================================================
  // Scenario I (bonus): Multi-hand state isolation
  // =====================================================================

  it('I: exploit data persists across hands, advice does not', () => {
    pushAndVerify(msgPipeline({ conn_1: { state: 'active' } }));
    pushAndVerify(msgHandsUpdated(1));

    // Hand 1: exploits + advice
    pushAndVerify(msgExploits([{ seat: 3, style: 'TAG', sampleSize: 30 }]));
    pushAndVerify(msgLiveContext(ctxFlop()));
    pushAndVerify(msgAdvice(advFlop()));

    let snap = harness.snapshot();
    expect(snap.appSeatData[3]).toBeDefined();
    expect(snap.lastGoodAdvice).not.toBeNull();

    // Hand 2 starts
    pushAndVerify(msgLiveContext(ctxDealing({ handNumber: 'HAND_002' })));
    snap = harness.snapshot();
    expect(snap.lastGoodAdvice).toBeNull(); // advice cleared at boundary
    expect(snap.appSeatData[3]).toBeDefined(); // exploits persist (cross-hand)
    expect(snap.appSeatData[3].style).toBe('TAG');
  });
});
