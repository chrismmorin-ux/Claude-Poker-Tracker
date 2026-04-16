/**
 * lifecycle-soak.test.js — STP-1 Stage 4a.
 *
 * Multi-cycle soak that replays the production failure modes the previous
 * audit missed:
 *
 *   1. Probe-flake / table-grace cycles  — the scenario that produced
 *      213 R5 violations in 30 s in production. Each cycle: push active
 *      pipeline → push live context → push advice → push empty pipeline
 *      → advance 5s (grace expires) → re-push active pipeline with
 *      embedded live context. Asserts zero violations throughout.
 *
 *   2. Service-worker restart simulations — advice cached by the SW,
 *      then replayed without a companion live context. Matches the
 *      SW_REANIMATION_REPLAY failure mode the SRT-1 fix closed.
 *
 *   3. Stale-context timeouts — 120 s no-traffic, fresh context arrival,
 *      new hand.
 *
 *   4. Mid-hand table switches — same seat layout, different tableId.
 *
 * Assertion model: `violationCountLifetime === 0` at the end of EVERY
 * cycle. If any cycle arms any rule, this test fails with the rule text
 * available in `pipelineEvents`.
 *
 * Pre-STP-1 this test would have flagged R5 spam immediately on cycle 1.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HarnessRunner } from './message-harness.js';

const SEED_HAND = {
  heroSeat: 5,
  dealerSeat: 2,
  handNumber: 'H001',
  activeSeatNumbers: [3, 5, 7],
  foldedSeats: [],
};

function makeCtx(overrides = {}) {
  return {
    state: 'PREFLOP',
    currentStreet: 'preflop',
    ...SEED_HAND,
    ...overrides,
  };
}

function pushActiveTable(harness, tableId = 'table_abc', ctx = null) {
  harness.push({
    type: 'push_pipeline_status',
    tables: { abc: { state: 'PREFLOP', currentStreet: 'preflop', heroSeat: 5, actionCount: 0, completedHands: 0 } },
    liveContext: ctx,
    appConnected: false,
    tableCount: 1,
  });
}

function pushEmptyTable(harness) {
  harness.push({
    type: 'push_pipeline_status',
    tables: {},
    liveContext: null,
    appConnected: false,
    tableCount: 0,
  });
}

function violationCount(harness) {
  return harness.coord.get('violationCountLifetime') || 0;
}

function violationDetails(harness) {
  return (harness.coord.get('pipelineEvents') || [])
    .filter(e => e.event === 'INVARIANT_VIOLATION')
    .map(e => e.detail);
}

describe('STP-1 Stage 4a — lifecycle soak', () => {
  let harness;
  beforeEach(() => {
    vi.useFakeTimers();
    harness = new HarnessRunner();
  });
  afterEach(() => {
    harness.destroy();
    vi.useRealTimers();
  });

  it('10 probe-flake / grace-expiry cycles produce zero violations', () => {
    for (let cycle = 0; cycle < 10; cycle++) {
      const ctx = makeCtx({ handNumber: `H-${cycle}` });

      // Table active + context + advice
      pushActiveTable(harness, 'table_abc', ctx);
      harness.push({ type: 'push_live_context', context: ctx });
      harness.push({
        type: 'push_action_advice',
        advice: { currentStreet: 'preflop', villainSeat: 3, recommendations: [{ action: 'call' }] },
      });
      vi.advanceTimersByTime(100);
      harness.flush();

      // Probe flake — tables empty
      pushEmptyTable(harness);
      vi.advanceTimersByTime(100);
      harness.flush();

      // Grace expiry — clearForTableSwitch fires
      vi.advanceTimersByTime(5100);
      harness.flush();

      // Recovery: fresh pipeline status with embedded live context
      const nextCtx = makeCtx({ handNumber: `H-${cycle}-recovery` });
      pushActiveTable(harness, 'table_abc', nextCtx);
      vi.advanceTimersByTime(100);
      harness.flush();

      // Pin: zero violations at the end of this cycle.
      expect(
        violationCount(harness),
        `cycle ${cycle} armed invariant rules: ${violationDetails(harness).join(' | ')}`
      ).toBe(0);
    }
  });

  it('10 SW-restart / cached-advice-replay cycles produce zero violations', () => {
    // SW reanimation replays advice without a companion context. SRT-1
    // (RT-68/69) closed this by gating cached advice on fresh context and
    // force-clearing _pendingAdvice at hand boundaries.
    for (let cycle = 0; cycle < 10; cycle++) {
      const ctx = makeCtx({ handNumber: `SW-${cycle}` });
      pushActiveTable(harness, 'table_abc', ctx);
      harness.push({ type: 'push_live_context', context: ctx });
      vi.advanceTimersByTime(50);

      // SW "restart": replay advice with no companion context push.
      // The advice predates the current context in the real system,
      // but here we just inject one — the coordinator's hand-number
      // guard is what we're stressing.
      harness.push({
        type: 'push_action_advice',
        advice: { currentStreet: 'preflop', handNumber: `SW-${cycle}`, villainSeat: 3, recommendations: [{ action: 'call' }] },
      });
      vi.advanceTimersByTime(50);
      harness.flush();

      // New hand boundary — should force-clear _pendingAdvice per RT-69
      const nextCtx = makeCtx({ handNumber: `SW-${cycle}-next`, state: 'PREFLOP' });
      harness.push({ type: 'push_live_context', context: nextCtx });
      vi.advanceTimersByTime(100);
      harness.flush();

      expect(
        violationCount(harness),
        `SW cycle ${cycle} armed: ${violationDetails(harness).join(' | ')}`
      ).toBe(0);
    }
  });

  it('5 stale-context-timeout cycles produce zero violations', () => {
    // Simulates 120s idle that clears currentLiveContext + advicePendingForStreet,
    // then fresh context arriving on a new hand.
    for (let cycle = 0; cycle < 5; cycle++) {
      const ctx = makeCtx({ handNumber: `STALE-${cycle}` });
      pushActiveTable(harness, 'table_abc', ctx);
      harness.push({ type: 'push_live_context', context: ctx });
      vi.advanceTimersByTime(100);
      harness.flush();

      // Simulate 120s idle by directly calling the stale clear (harness
      // doesn't run the side-panel.js staleContext timer).
      harness.coord.set('currentLiveContext', null);
      harness.coord.set('advicePendingForStreet', null);
      harness.coord.set('staleContext', false);
      harness.flush();

      // Fresh context arrives — new hand
      const nextCtx = makeCtx({ handNumber: `STALE-${cycle}-fresh` });
      harness.push({ type: 'push_live_context', context: nextCtx });
      vi.advanceTimersByTime(100);
      harness.flush();

      expect(
        violationCount(harness),
        `stale cycle ${cycle} armed: ${violationDetails(harness).join(' | ')}`
      ).toBe(0);
    }
  });

  it('5 mid-hand table-switch cycles produce zero violations', () => {
    // Switch to a different tableId mid-hand. clearForTableSwitch should
    // reset per-table state cleanly.
    for (let cycle = 0; cycle < 5; cycle++) {
      const oldTable = `table_${cycle}_old`;
      const newTable = `table_${cycle}_new`;

      const ctx = makeCtx({ handNumber: `MID-${cycle}-old` });
      harness.push({
        type: 'push_pipeline_status',
        tables: { [`${cycle}_old`]: { state: 'FLOP', currentStreet: 'flop', heroSeat: 5, actionCount: 3, completedHands: 0 } },
        liveContext: ctx,
        tableCount: 1,
      });
      vi.advanceTimersByTime(50);
      harness.flush();

      // Mid-hand switch to new table
      const ctx2 = makeCtx({ handNumber: `MID-${cycle}-new`, state: 'PREFLOP', currentStreet: 'preflop' });
      harness.push({
        type: 'push_pipeline_status',
        tables: { [`${cycle}_new`]: { state: 'PREFLOP', currentStreet: 'preflop', heroSeat: 5, actionCount: 0, completedHands: 0 } },
        liveContext: ctx2,
        tableCount: 1,
      });
      vi.advanceTimersByTime(100);
      harness.flush();

      expect(
        violationCount(harness),
        `mid-hand cycle ${cycle} armed: ${violationDetails(harness).join(' | ')}`
      ).toBe(0);
    }
  });

  it('30-iteration mixed-sequence soak produces zero violations', () => {
    // Randomized-feeling but deterministic mix of all four lifecycle events
    // to catch compound failures that individual cycle tests might miss.
    const sequence = [
      'active', 'live', 'advice', 'empty', 'grace', 'active', 'live',
      'switch', 'live', 'active', 'empty', 'grace', 'active', 'live',
      'stale', 'active', 'live', 'advice', 'switch', 'live', 'active',
      'advice', 'empty', 'grace', 'active', 'live', 'stale', 'active',
      'live', 'advice',
    ];
    let handCounter = 0;
    let tableCounter = 0;
    for (const op of sequence) {
      handCounter++;
      if (op === 'active') {
        const ctx = makeCtx({ handNumber: `MIX-${handCounter}` });
        pushActiveTable(harness, `table_${tableCounter}`, ctx);
      } else if (op === 'live') {
        const ctx = makeCtx({ handNumber: `MIX-${handCounter}` });
        harness.push({ type: 'push_live_context', context: ctx });
      } else if (op === 'advice') {
        harness.push({
          type: 'push_action_advice',
          advice: {
            currentStreet: 'preflop',
            handNumber: `MIX-${handCounter}`,
            villainSeat: 3,
            recommendations: [{ action: 'call' }],
          },
        });
      } else if (op === 'empty') {
        pushEmptyTable(harness);
      } else if (op === 'grace') {
        vi.advanceTimersByTime(5100);
      } else if (op === 'switch') {
        tableCounter++;
      } else if (op === 'stale') {
        harness.coord.set('currentLiveContext', null);
        harness.coord.set('advicePendingForStreet', null);
      }
      vi.advanceTimersByTime(50);
      harness.flush();
    }
    expect(
      violationCount(harness),
      `mixed soak armed: ${violationDetails(harness).join(' | ')}`
    ).toBe(0);
  });
});
