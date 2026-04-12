/**
 * state-invariants.test.js — Unit tests for the 10 state invariant rules.
 *
 * Each test constructs a snapshot that violates exactly one rule and verifies
 * the checker detects it. Also verifies that valid snapshots pass clean.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateInvariantChecker } from '../state-invariants.js';

// =========================================================================
// HELPERS
// =========================================================================

/** Build a minimal valid snapshot (no violations). */
function validSnapshot(overrides = {}) {
  return {
    lastHandCount: 5,
    hasTableHands: true,
    currentActiveTableId: 'table_123',
    currentLiveContext: {
      state: 'FLOP',
      currentStreet: 'flop',
      heroSeat: 5,
      dealerSeat: 3,
      activeSeatNumbers: [3, 5],
      foldedSeats: [1, 7, 9],
      handNumber: 'HAND_001',
    },
    lastGoodAdvice: {
      currentStreet: 'flop',
      villainSeat: 3,
      recommendations: [{ action: 'call' }],
    },
    focusedVillainSeat: 3,
    pinnedVillainSeat: null,
    advicePendingForStreet: null,
    appSeatDataVersion: 1,
    street: 'flop',
    pipelineEvents: [],
    ...overrides,
  };
}

// =========================================================================
// TESTS
// =========================================================================

describe('StateInvariantChecker', () => {
  let checker;

  beforeEach(() => {
    checker = new StateInvariantChecker();
  });

  it('valid snapshot produces no violations or warnings', () => {
    const result = checker.check(validSnapshot());
    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // R1: HUD visibility
  it('R1: detects hasTableHands=false when hands exist with active table', () => {
    const snap = validSnapshot({ hasTableHands: false });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R1:'))).toBe(true);
  });

  it('R1: no violation when hasTableHands=false and no hands', () => {
    const snap = validSnapshot({ hasTableHands: false, lastHandCount: 0 });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R1:'))).toBe(false);
  });

  // R2: Street non-null during live hand
  it('R2: detects null street during live FLOP state', () => {
    const snap = validSnapshot({ street: null });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R2:'))).toBe(true);
  });

  it('R2: no violation when state is DEALING (street can be null)', () => {
    const snap = validSnapshot({
      street: null,
      currentLiveContext: { ...validSnapshot().currentLiveContext, state: 'DEALING', currentStreet: null },
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R2:'))).toBe(false);
  });

  // R3: Advice street match
  it('R3: detects advice >1 behind context (preflop advice on turn)', () => {
    const snap = validSnapshot({
      street: 'turn',
      currentLiveContext: { ...validSnapshot().currentLiveContext, state: 'TURN', currentStreet: 'turn' },
      lastGoodAdvice: { currentStreet: 'preflop', villainSeat: 3 },
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R3:'))).toBe(true);
  });

  it('R3: warns (not violation) when advice is 1 behind context', () => {
    const snap = validSnapshot({
      lastGoodAdvice: { currentStreet: 'preflop', villainSeat: 3 },
      // context is flop — 1 behind is warning only
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R3:'))).toBe(false);
    expect(result.warnings.some(v => v.startsWith('R3:'))).toBe(true);
  });

  it('R3: detects advice >1 ahead (river advice on flop)', () => {
    const snap = validSnapshot({
      lastGoodAdvice: { currentStreet: 'river', villainSeat: 3 },
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R3:'))).toBe(true);
  });

  it('R3: allows advice 1 ahead (turn advice on flop)', () => {
    const snap = validSnapshot({
      lastGoodAdvice: { currentStreet: 'turn', villainSeat: 3 },
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R3:'))).toBe(false);
  });

  // R4: Focused villain in active seats
  it('R4: warns when focused villain not in active or folded seats', () => {
    const snap = validSnapshot({ focusedVillainSeat: 8 });
    const result = checker.check(snap);
    expect(result.warnings.some(v => v.startsWith('R4:'))).toBe(true);
  });

  it('R4: no warning when focused villain is in foldedSeats', () => {
    const snap = validSnapshot({ focusedVillainSeat: 1 }); // 1 is in foldedSeats
    const result = checker.check(snap);
    expect(result.warnings.some(v => v.startsWith('R4:'))).toBe(false);
  });

  // R5: Pending advice not stuck
  it('R5: detects stuck waiting state (pending + no context + no advice)', () => {
    const snap = validSnapshot({
      advicePendingForStreet: 'PREFLOP',
      currentLiveContext: null,
      lastGoodAdvice: null,
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R5:'))).toBe(true);
  });

  it('R5: no violation when pending + context exists', () => {
    const snap = validSnapshot({ advicePendingForStreet: 'FLOP' });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R5:'))).toBe(false);
  });

  // R6: Pinned not hero
  it('R6: detects pinned villain = hero seat', () => {
    const snap = validSnapshot({ pinnedVillainSeat: 5 }); // heroSeat is 5
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R6:'))).toBe(true);
  });

  // R7: Version monotonic
  it('R7: warns on version regression', () => {
    checker.check(validSnapshot({ appSeatDataVersion: 5 }));
    const result = checker.check(validSnapshot({ appSeatDataVersion: 3 }));
    expect(result.warnings.some(v => v.startsWith('R7:'))).toBe(true);
  });

  it('R7: no warning on version increase', () => {
    checker.check(validSnapshot({ appSeatDataVersion: 1 }));
    const result = checker.check(validSnapshot({ appSeatDataVersion: 2 }));
    expect(result.warnings.some(v => v.startsWith('R7:'))).toBe(false);
  });

  // R8: Hero seat valid
  it('R8: detects hero seat out of range', () => {
    const snap = validSnapshot({
      currentLiveContext: { ...validSnapshot().currentLiveContext, heroSeat: 0 },
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R8:'))).toBe(true);
  });

  it('R8: detects non-integer hero seat', () => {
    const snap = validSnapshot({
      currentLiveContext: { ...validSnapshot().currentLiveContext, heroSeat: 3.5 },
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R8:'))).toBe(true);
  });

  // R9: Advice not self
  it('R9: detects advice targeting hero seat', () => {
    const snap = validSnapshot({
      lastGoodAdvice: { currentStreet: 'flop', villainSeat: 5 }, // hero is 5
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R9:'))).toBe(true);
  });

  // R10: Pipeline events capped
  it('R10: detects unbounded pipeline events', () => {
    const snap = validSnapshot({
      pipelineEvents: new Array(51).fill({ ts: Date.now(), event: 'test' }),
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R10:'))).toBe(true);
  });

  it('R10: no violation at exactly 50', () => {
    const snap = validSnapshot({
      pipelineEvents: new Array(50).fill({ ts: Date.now(), event: 'test' }),
    });
    const result = checker.check(snap);
    expect(result.violations.some(v => v.startsWith('R10:'))).toBe(false);
  });

  // Reset
  it('reset clears stateful tracking', () => {
    checker.check(validSnapshot({ appSeatDataVersion: 10 }));
    checker.reset();
    // After reset, version 1 should not be a regression
    const result = checker.check(validSnapshot({ appSeatDataVersion: 1 }));
    expect(result.warnings.some(v => v.startsWith('R7:'))).toBe(false);
  });
});

// =========================================================================
// RULE 10: pipelineEvents capped (RT-66)
// =========================================================================

describe('RT-66: Rule 10 reads coordinator accessor when provided', () => {
  it('fires when the accessor reports > 50 events', () => {
    const events = Array.from({ length: 60 }, (_, i) => ({ ts: i, event: 'E', detail: '' }));
    const c = new StateInvariantChecker({ getPipelineEvents: () => events });
    const result = c.check(validSnapshot());
    const r10 = result.violations.find(v => v.startsWith('R10:'));
    expect(r10).toBeDefined();
    expect(r10).toMatch(/length=60/);
  });

  it('does not fire when the accessor reports <= 50 events', () => {
    const events = Array.from({ length: 40 }, (_, i) => ({ ts: i, event: 'E', detail: '' }));
    const c = new StateInvariantChecker({ getPipelineEvents: () => events });
    const result = c.check(validSnapshot());
    expect(result.violations.find(v => v.startsWith('R10:'))).toBeUndefined();
  });

  it('falls back to snap.pipelineEvents when no accessor is provided', () => {
    const c = new StateInvariantChecker();
    const events = Array.from({ length: 55 }, () => ({ ts: 0, event: 'E', detail: '' }));
    const snap = { ...validSnapshot(), pipelineEvents: events };
    const result = c.check(snap);
    expect(result.violations.find(v => v.startsWith('R10:'))).toBeDefined();
  });
});
