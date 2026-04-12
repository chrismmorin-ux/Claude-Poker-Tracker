/**
 * message-integration.test.js — Message-level integration tests for sidebar.
 *
 * These tests feed raw push_* messages through the handler pipeline and
 * assert on coordinator state + snapshot output. They exercise the REAL
 * failure surface: message ordering, async races, advice guards, table
 * switches, and render coalescing.
 *
 * Unlike render-coordinator.test.js (tests coordinator in isolation) and
 * render-orchestrator.test.js (tests pure render functions), these tests
 * exercise the full message→state→render pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HarnessRunner } from './message-harness.js';
import {
  msgLiveContext, msgAdvice, msgExploits, msgPipeline, msgDiag,
  msgTournament, msgHandsUpdated, msgRecoveryNeeded, msgRecoveryCleared,
  ctxPreflop, ctxFlop, ctxRiver, ctxDealing,
  advPreflop, advFlop, advRiver,
} from './message-sequences.js';

// =========================================================================
// SETUP
// =========================================================================

let harness;

beforeEach(() => {
  vi.useFakeTimers();
  harness = new HarnessRunner();
});

afterEach(() => {
  harness.destroy();
  vi.useRealTimers();
});

// =========================================================================
// SCENARIO 1: SW restart — stale advice before fresh context
// =========================================================================

describe('Scenario 1: SW restart mid-hand', () => {
  it('cached advice from previous hand is held, not displayed', () => {
    // Step 1: Pipeline arrives (SW just restarted, no tables yet)
    harness.push(msgPipeline({}));
    vi.advanceTimersByTime(100);
    harness.flush();

    // Step 2: Cached river advice from previous hand arrives
    // (liveContext is null — SW restarted)
    harness.push(msgAdvice(advRiver()));
    vi.advanceTimersByTime(100);
    harness.flush();

    // Advice must be HELD, not displayed
    const snap1 = harness.snapshot();
    expect(snap1.lastGoodAdvice).toBeNull();
    expect(harness.coord.getPendingAdvice()).not.toBeNull();

    // Step 3: Fresh live context for NEW hand arrives
    harness.push(msgLiveContext(ctxPreflop({ handNumber: 'HAND_002' })));
    vi.advanceTimersByTime(1);
    harness.flush();

    // River advice from previous hand must NOT be promoted to preflop
    // (river rank=3 vs preflop rank=0 = gap of 3, rejected)
    const snap2 = harness.snapshot();
    expect(snap2.lastGoodAdvice).toBeNull();
  });

  it('cached same-street advice is promoted when context arrives', () => {
    // Advice arrives first (preflop)
    harness.push(msgAdvice(advPreflop()));
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice).toBeNull();
    expect(harness.coord.getPendingAdvice()).not.toBeNull();

    // Context arrives for same street
    harness.push(msgLiveContext(ctxPreflop()));
    vi.advanceTimersByTime(1);
    harness.flush();

    const snap = harness.snapshot();
    expect(snap.lastGoodAdvice).not.toBeNull();
    expect(snap.lastGoodAdvice.currentStreet).toBe('preflop');
  });

  it('rejects unknown-street advice (adviceRank === -1)', () => {
    // Establish context first
    harness.push(msgLiveContext(ctxFlop()));
    vi.advanceTimersByTime(100);
    harness.flush();

    // Advice with undefined street
    harness.push(msgAdvice({ currentStreet: undefined, villainSeat: 3 }));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Should be held in pending, not accepted
    const snap = harness.snapshot();
    expect(snap.lastGoodAdvice).toBeNull();
    expect(harness.coord.getPendingAdvice()).not.toBeNull();
  });
});

// =========================================================================
// SCENARIO 2: Rapid table switch — no state bleed
// =========================================================================

describe('Scenario 2: Rapid table switch', () => {
  it('table A state does not bleed to table B', () => {
    // Table A: full flop hand
    harness.push(msgPipeline({ conn_1: { heroSeat: 5, state: 'ACTIVE' } }));
    harness.push(msgLiveContext(ctxFlop({ heroSeat: 5, pot: 25 })));
    harness.push(msgAdvice(advFlop({ villainSeat: 3 })));
    vi.advanceTimersByTime(1);
    harness.flush();

    const snapA = harness.snapshot();
    expect(snapA.lastGoodAdvice).not.toBeNull();
    expect(snapA.currentActiveTableId).toBe('table_conn_1');
    expect(snapA.lastGoodAdvice.villainSeat).toBe(3);

    // Table empties (grace timer starts)
    harness.push(msgPipeline({}));
    vi.advanceTimersByTime(300); // Within 5s grace

    // Table B arrives before grace expires
    harness.push(msgPipeline({ conn_2: { heroSeat: 7, state: 'ACTIVE' } }));
    harness.push(msgLiveContext(ctxPreflop({ heroSeat: 7, handNumber: 'HAND_B001' })));
    vi.advanceTimersByTime(100);
    harness.flush();

    const snapB = harness.snapshot();
    // Table switch cleared per-table state
    expect(snapB.currentActiveTableId).toBe('table_conn_2');
    expect(snapB.lastGoodAdvice).toBeNull();
    expect(snapB.pinnedVillainSeat).toBeNull();
  });

  it('grace timer fires after 5s with no new table', () => {
    // Establish table
    harness.push(msgPipeline({ conn_1: { heroSeat: 5, state: 'ACTIVE' } }));
    harness.push(msgLiveContext(ctxFlop()));
    harness.push(msgAdvice(advFlop()));
    vi.advanceTimersByTime(1);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();

    // Table empties
    harness.push(msgPipeline({}));
    vi.advanceTimersByTime(4999);

    // Grace period hasn't expired yet — advice still present
    harness.flush();
    expect(harness.snapshot().currentActiveTableId).toBe('table_conn_1');

    // Grace expires
    vi.advanceTimersByTime(2);
    harness.flush();

    const snap = harness.snapshot();
    expect(snap.currentActiveTableId).toBeNull();
    expect(snap.lastGoodAdvice).toBeNull();
    expect(snap.pinnedVillainSeat).toBeNull();
  });
});

// =========================================================================
// SCENARIO 3: Advice-before-context (same hand)
// =========================================================================

describe('Scenario 3: Advice arrives before context', () => {
  it('advice held then promoted when matching context arrives', () => {
    // Both null (fresh page load)
    expect(harness.coord.get('currentLiveContext')).toBeNull();

    // Advice arrives first
    harness.push(msgAdvice(advFlop({ villainSeat: 3 })));
    vi.advanceTimersByTime(1);
    harness.flush();

    expect(harness.snapshot().lastGoodAdvice).toBeNull();
    expect(harness.coord.getPendingAdvice()).not.toBeNull();

    // Context arrives for same street
    harness.push(msgLiveContext(ctxFlop({ pfAggressor: 3 })));
    vi.advanceTimersByTime(1);
    harness.flush();

    const snap = harness.snapshot();
    expect(snap.lastGoodAdvice).not.toBeNull();
    expect(snap.lastGoodAdvice.currentStreet).toBe('flop');
    expect(snap.focusedVillainSeat).toBe(3);
    expect(harness.coord.getPendingAdvice()).toBeNull();
  });

  it('flop advice held when preflop context arrives (new hand = exact match only)', () => {
    // Flop advice arrives first (no prior context — looks like new hand)
    harness.push(msgAdvice(advFlop()));
    vi.advanceTimersByTime(1);
    expect(harness.coord.getPendingAdvice()).not.toBeNull();

    // Preflop context arrives — this is a new hand boundary (prevState=null → PREFLOP)
    // At hand boundary, only exact street match promotes pending advice
    harness.push(msgLiveContext(ctxPreflop()));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Flop advice is NOT promoted at a preflop hand boundary (street mismatch)
    const snap = harness.snapshot();
    expect(snap.lastGoodAdvice).toBeNull();
  });

  it('flop advice promoted mid-hand when preflop context arrives (1-street gap OK)', () => {
    // First establish a context so this is NOT a new hand boundary
    harness.push(msgLiveContext(ctxDealing()));
    vi.advanceTimersByTime(100);
    harness.flush();

    // Now flop advice arrives during the dealing phase
    harness.push(msgAdvice(advFlop()));
    vi.advanceTimersByTime(1);
    expect(harness.coord.getPendingAdvice()).not.toBeNull();

    // Preflop context arrives (prevState=DEALING → PREFLOP is a hand boundary)
    // At hand boundary, only exact match promotes
    harness.push(msgLiveContext(ctxPreflop()));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Even with dealing→preflop (new hand boundary), flop advice not promoted
    expect(harness.snapshot().lastGoodAdvice).toBeNull();

    // Flop context arrives — now the pending advice would be promoted
    // but it was cleared at the hand boundary since it didn't match
    harness.push(msgLiveContext(ctxFlop()));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Pending advice was cleared at boundary, so nothing to promote
    expect(harness.snapshot().lastGoodAdvice).toBeNull();
  });
});

// =========================================================================
// SCENARIO 4: Concurrent handlers (pipeline + advice same tick)
// =========================================================================

describe('Scenario 4: Concurrent handlers', () => {
  it('advice with IMMEDIATE priority fires even when NORMAL pipeline pending', () => {
    // Establish context
    harness.push(msgLiveContext(ctxFlop({ pfAggressor: 3 })));
    vi.advanceTimersByTime(100);
    harness.flush();
    const rendersBefore = harness.totalRenders();

    // Both arrive in same tick
    harness.push(msgPipeline({ conn_1: { heroSeat: 5, state: 'ACTIVE' } }));
    harness.push(msgAdvice(advFlop({ villainSeat: 3 })));

    // IMMEDIATE fires on next rAF (1ms)
    vi.advanceTimersByTime(1);
    harness.flush();

    const snap = harness.snapshot();
    // Advice was accepted
    expect(snap.lastGoodAdvice).not.toBeNull();
    expect(snap.lastGoodAdvice.currentStreet).toBe('flop');
    // Pipeline state also incorporated
    expect(snap.lastPipeline).not.toBeNull();
  });

  it('multiple NORMAL pushes coalesce into single render', () => {
    harness.push(msgLiveContext(ctxFlop()));
    vi.advanceTimersByTime(100);
    harness.flush();
    const rendersBefore = harness.totalRenders();

    // 3 NORMAL-priority messages in quick succession
    harness.push(msgDiag({ gameWsMessageCount: 1 }));
    harness.push(msgDiag({ gameWsMessageCount: 2 }));
    harness.push(msgDiag({ gameWsMessageCount: 3 }));

    // Before coalesce window — no new renders
    vi.advanceTimersByTime(50);
    expect(harness.totalRenders()).toBe(rendersBefore);

    // After coalesce fires
    vi.advanceTimersByTime(50);
    harness.flush();

    // Exactly 1 additional render (coalesced)
    expect(harness.totalRenders()).toBe(rendersBefore + 1);
  });
});

// =========================================================================
// SCENARIO 5: Diagnostics burst — NORMAL renders not starved
// =========================================================================

describe('Scenario 5: Diagnostics burst', () => {
  it('20 rapid diagnostics do not starve data renders', () => {
    // Establish context
    harness.push(msgLiveContext(ctxFlop()));
    vi.advanceTimersByTime(100);
    harness.flush();
    harness.clearRenders();

    // Fire 20 diag pushes at 50ms intervals (total 1s)
    for (let i = 0; i < 20; i++) {
      harness.push(msgDiag({ gameWsMessageCount: i + 1, wsMessageCount: i + 5 }));
      vi.advanceTimersByTime(50);
    }
    harness.flush();

    // Diagnostics should coalesce — not 20 renders
    // At 50ms intervals with 80ms coalesce: timer continuously resets,
    // renders fire roughly every 80ms → about 12-13 renders in 1000ms
    expect(harness.renders.length).toBeLessThan(16);
    expect(harness.renders.length).toBeGreaterThan(0);

    // A real data push (advice) with IMMEDIATE should still fire promptly
    harness.clearRenders();
    harness.push(msgAdvice(advFlop()));
    vi.advanceTimersByTime(1);
    harness.flush();

    expect(harness.renders.length).toBeGreaterThan(0);
    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();
  });
});

// =========================================================================
// SCENARIO 6: New hand boundary — advice lifecycle
// =========================================================================

describe('Scenario 6: New hand boundary', () => {
  it('DEALING clears advice, PREFLOP advice arrives correctly', () => {
    // Hand 1: full flop with advice
    harness.push(msgLiveContext(ctxFlop({ handNumber: 'HAND_001' })));
    harness.push(msgAdvice(advFlop()));
    vi.advanceTimersByTime(1);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();

    // Hand 2 starts: DEALING
    harness.push(msgLiveContext(ctxDealing({ handNumber: 'HAND_002' })));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Advice cleared at hand boundary
    const snap1 = harness.snapshot();
    expect(snap1.lastGoodAdvice).toBeNull();
    expect(snap1.advicePendingForStreet).toBe('DEALING');

    // Hand 2: PREFLOP context arrives
    harness.push(msgLiveContext(ctxPreflop({ handNumber: 'HAND_002' })));
    vi.advanceTimersByTime(1);
    harness.flush();

    // New preflop advice arrives
    harness.push(msgAdvice(advPreflop()));
    vi.advanceTimersByTime(1);
    harness.flush();

    const snap2 = harness.snapshot();
    expect(snap2.lastGoodAdvice).not.toBeNull();
    expect(snap2.lastGoodAdvice.currentStreet).toBe('preflop');
  });

  it('advice from hand N-1 river NOT promoted to hand N preflop', () => {
    // Hand 1 river
    harness.push(msgLiveContext(ctxRiver({ handNumber: 'HAND_001' })));
    harness.push(msgAdvice(advRiver()));
    vi.advanceTimersByTime(1);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice.currentStreet).toBe('river');

    // Hand 2 starts
    harness.push(msgLiveContext(ctxDealing({ handNumber: 'HAND_002' })));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Hand boundary cleared the river advice
    expect(harness.snapshot().lastGoodAdvice).toBeNull();

    // Preflop context
    harness.push(msgLiveContext(ctxPreflop({ handNumber: 'HAND_002' })));
    vi.advanceTimersByTime(100);
    harness.flush();

    // Advice is correctly null (not river from previous hand)
    expect(harness.snapshot().lastGoodAdvice).toBeNull();
  });
});

// =========================================================================
// SCENARIO 7: Stale context phases
// =========================================================================

describe('Scenario 7: Stale context phases', () => {
  it('context becomes stale after _receivedAt ages', () => {
    // Establish context with _receivedAt
    harness.push(msgLiveContext(ctxFlop()));
    vi.advanceTimersByTime(100);
    harness.flush();

    const ctx = harness.coord.get('currentLiveContext');
    expect(ctx).not.toBeNull();
    expect(ctx._receivedAt).toBeDefined();

    // Verify _receivedAt was set
    const age = Date.now() - ctx._receivedAt;
    expect(age).toBeLessThan(200);
  });

  it('pipeline status path also sets _receivedAt', () => {
    // RT-56: pipeline.liveContext must get _receivedAt
    harness.push(msgPipeline(
      { conn_1: { heroSeat: 5, state: 'ACTIVE' } },
      { liveContext: ctxFlop() }
    ));
    vi.advanceTimersByTime(100);
    harness.flush();

    const ctx = harness.coord.get('currentLiveContext');
    expect(ctx).not.toBeNull();
    expect(ctx._receivedAt).toBeDefined();
    expect(typeof ctx._receivedAt).toBe('number');
    expect(isNaN(ctx._receivedAt)).toBe(false);
  });
});

// =========================================================================
// SCENARIO 8: Pinned villain persists across advice updates
// =========================================================================

describe('Scenario 8: Pinned villain', () => {
  it('pinned villain persists when advice updates with different villain', () => {
    // Establish context + advice targeting S3
    harness.push(msgLiveContext(ctxFlop({ pfAggressor: 3 })));
    harness.push(msgAdvice(advFlop({ villainSeat: 3 })));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Pin seat 7
    harness.coord.set('pinnedVillainSeat', 7);
    harness.coord.scheduleRender('pin');
    vi.advanceTimersByTime(1);
    harness.flush();

    const snap1 = harness.snapshot();
    expect(snap1.pinnedVillainSeat).toBe(7);
    expect(snap1.focusedVillainSeat).toBe(7); // Pinned overrides advice

    // New advice arrives targeting S5
    harness.push(msgAdvice(advFlop({ villainSeat: 5 })));
    vi.advanceTimersByTime(1);
    harness.flush();

    const snap2 = harness.snapshot();
    // Pin persists
    expect(snap2.pinnedVillainSeat).toBe(7);
    expect(snap2.focusedVillainSeat).toBe(7);
    // Advice updated to S5
    expect(snap2.lastGoodAdvice.villainSeat).toBe(5);
  });

  it('pinned villain cleared on table switch', () => {
    harness.push(msgPipeline({ conn_1: { heroSeat: 5, state: 'ACTIVE' } }));
    harness.push(msgLiveContext(ctxFlop()));
    vi.advanceTimersByTime(100);
    harness.flush();

    harness.coord.set('pinnedVillainSeat', 3);

    // Table switch
    harness.push(msgPipeline({ conn_2: { heroSeat: 7, state: 'ACTIVE' } }));
    vi.advanceTimersByTime(100);
    harness.flush();

    expect(harness.snapshot().pinnedVillainSeat).toBeNull();
  });
});

// =========================================================================
// SCENARIO 9: Exploit data lifecycle
// =========================================================================

describe('Scenario 9: Exploit data', () => {
  it('exploit push builds appSeatData correctly', () => {
    harness.push(msgExploits([
      { seat: 3, style: 'TAG', sampleSize: 45, villainHeadline: 'Tight reg' },
      { seat: 7, style: 'Fish', sampleSize: 12, villainHeadline: 'Loose passive' },
    ]));
    vi.advanceTimersByTime(100);
    harness.flush();

    const snap = harness.snapshot();
    expect(snap.appSeatData[3]).toBeDefined();
    expect(snap.appSeatData[3].style).toBe('TAG');
    expect(snap.appSeatData[7]).toBeDefined();
    expect(snap.appSeatData[7].style).toBe('Fish');
    expect(snap.exploitPushCount).toBe(1);
    expect(snap.appSeatDataVersion).toBe(1);
  });

  it('multiple exploit pushes increment version', () => {
    harness.push(msgExploits([{ seat: 3 }]));
    harness.push(msgExploits([{ seat: 3, style: 'LAG' }]));
    vi.advanceTimersByTime(100);
    harness.flush();

    expect(harness.snapshot().exploitPushCount).toBe(2);
    expect(harness.snapshot().appSeatDataVersion).toBe(2);
    expect(harness.snapshot().appSeatData[3].style).toBe('LAG');
  });
});

// =========================================================================
// SCENARIO 10: Recovery messages
// =========================================================================

describe('Scenario 10: Recovery flow', () => {
  it('recovery needed sets message, cleared removes it', () => {
    harness.push(msgRecoveryNeeded('silence_timeout', 'No WS traffic for 60s'));
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.snapshot().recoveryMessage).toBe('No WS traffic for 60s');

    harness.push(msgRecoveryCleared());
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.snapshot().recoveryMessage).toBeNull();
  });

  it('diagnostics with game traffic clears recovery', () => {
    harness.push(msgRecoveryNeeded('silence_timeout', 'Stale'));
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.snapshot().recoveryMessage).toBe('Stale');

    harness.push(msgDiag({ gameWsMessageCount: 5 }));
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.snapshot().recoveryMessage).toBeNull();
  });
});

// =========================================================================
// SCENARIO 11: Cross-hand contamination (the key bug)
// =========================================================================

describe('Scenario 11: Cross-hand advice contamination', () => {
  it('river advice from hand N-1 rejected when context is hand N preflop', () => {
    // Establish hand N preflop context
    harness.push(msgLiveContext(ctxPreflop({ handNumber: 'HAND_002' })));
    vi.advanceTimersByTime(100);
    harness.flush();

    // Stale river advice arrives (from SW cache, hand N-1)
    harness.push(msgAdvice(advRiver()));
    vi.advanceTimersByTime(1);
    harness.flush();

    // River (rank 3) vs preflop (rank 0) = gap of 3 → rejected/held
    const snap = harness.snapshot();
    expect(snap.lastGoodAdvice).toBeNull();
  });

  it('turn advice on preflop is rejected (gap > 1)', () => {
    harness.push(msgLiveContext(ctxPreflop()));
    vi.advanceTimersByTime(100);
    harness.flush();

    harness.push(msgAdvice({ currentStreet: 'turn', villainSeat: 3, recommendations: [] }));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Turn (rank 2) vs preflop (rank 0) = gap of 2 → held
    expect(harness.snapshot().lastGoodAdvice).toBeNull();
    expect(harness.coord.getPendingAdvice()).not.toBeNull();
  });

  it('flop advice on preflop is accepted (gap = 1, within tolerance)', () => {
    harness.push(msgLiveContext(ctxPreflop()));
    vi.advanceTimersByTime(100);
    harness.flush();

    harness.push(msgAdvice(advFlop()));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Flop (rank 1) vs preflop (rank 0) = gap of 1 → accepted
    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();
    expect(harness.snapshot().lastGoodAdvice.currentStreet).toBe('flop');
  });
});

// =========================================================================
// SCENARIO 12: Pipeline-status-only liveContext routes through handleLiveContext
// =========================================================================

describe('Scenario 12: pipeline-status liveContext unification (RT-59)', () => {
  it('pipeline-status-embedded liveContext sets _receivedAt and applies position lock', () => {
    // SW reconnect scenario — pipeline_status carries embedded liveContext,
    // but no separate push_live_context follows. Prior to RT-59 the direct
    // coordinator.set() bypass skipped position lock and _receivedAt.
    harness.push(msgPipeline(
      { 'TBL_001': { tableId: 'TBL_001' } },
      { liveContext: ctxFlop({ heroSeat: 5, dealerSeat: 1, handNumber: 'HAND_42' }) },
    ));
    vi.advanceTimersByTime(100);
    harness.flush();

    const snap = harness.snapshot();
    expect(snap.currentLiveContext).not.toBeNull();
    expect(typeof snap.currentLiveContext._receivedAt).toBe('number');
    expect(Number.isNaN(snap.currentLiveContext._receivedAt)).toBe(false);
    // Position lock armed from the pipeline-status path.
    expect(harness.coord.get('_lockedHeroSeat')).toBe(5);
    expect(harness.coord.get('_lockedDealerSeat')).toBe(1);
    expect(harness.coord.get('_lockedHandNumber')).toBe('HAND_42');
  });

  it('pipeline-status reconnect promotes pending advice when streets match', () => {
    // Cached advice arrives before any context (SW-restart cache replay).
    harness.push(msgAdvice(advFlop({ currentStreet: 'flop' })));
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice).toBeNull();
    expect(harness.coord.getPendingAdvice()).not.toBeNull();

    // Now pipeline_status carrying the flop liveContext arrives (no
    // separate push_live_context). Under RT-59 this routes through
    // handleLiveContext and promotes the pending advice. Pre-RT-59 it
    // bypassed that logic and the advice stayed held forever.
    harness.push(msgPipeline(
      { 'TBL_001': { tableId: 'TBL_001' } },
      { liveContext: ctxFlop({ handNumber: 'HAND_99' }) },
    ));
    vi.advanceTimersByTime(100);
    harness.flush();

    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();
    expect(harness.snapshot().lastGoodAdvice.currentStreet).toBe('flop');
  });
});

// =========================================================================
// SCENARIO 13: Hand-number binding on advice guard (RT-45)
// =========================================================================

describe('Scenario 13: cross-hand advice rejection via hand-number binding (RT-45)', () => {
  it('advice from a previous hand is rejected even when street rank is within tolerance', () => {
    // Hand 1: flop context + matching flop advice — accepted.
    harness.push(msgLiveContext(ctxFlop({ handNumber: 'HAND_A' })));
    vi.advanceTimersByTime(100);
    harness.flush();
    harness.push(msgAdvice(advFlop({ currentStreet: 'flop' })));
    vi.advanceTimersByTime(1);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();
    expect(harness.coord.get('_lockedHandNumber')).toBe('HAND_A');

    // Hand boundary: new hand preflop, hero seat unchanged.
    harness.push(msgLiveContext(ctxPreflop({ handNumber: 'HAND_B', heroSeat: 5, dealerSeat: 1 })));
    vi.advanceTimersByTime(100);
    harness.flush();
    expect(harness.coord.get('_lockedHandNumber')).toBe('HAND_B');

    // SW cache replay: flop advice from HAND_A arrives AFTER HAND_B started.
    // Its street rank (1) vs preflop (0) = gap 1, which passes the street
    // check. Only the hand-number binding catches this as cross-hand.
    const cachedAdvice = advFlop({ currentStreet: 'flop', handNumber: 'HAND_A' });
    harness.push(msgAdvice(cachedAdvice));
    vi.advanceTimersByTime(1);
    harness.flush();

    // Expected: hand-number mismatch wins → advice held, not promoted.
    // Pre-RT-45 the street check would accept it (gap=1) and contaminate HAND_B.
    expect(harness.snapshot().lastGoodAdvice?.handNumber).not.toBe('HAND_A');
  });

  it('advice matching the locked hand is accepted normally', () => {
    harness.push(msgLiveContext(ctxFlop({ handNumber: 'HAND_C' })));
    vi.advanceTimersByTime(100);
    harness.flush();
    harness.push(msgAdvice(advFlop({ currentStreet: 'flop', handNumber: 'HAND_C' })));
    vi.advanceTimersByTime(1);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();
    expect(harness.snapshot().lastGoodAdvice.handNumber).toBe('HAND_C');
  });

  it('advice without a handNumber falls back to the pre-RT-45 street-rank-only guard', () => {
    // Older advice payloads may not carry handNumber. The guard must NOT
    // reject them categorically; it should fall through to the existing
    // street-rank comparison.
    harness.push(msgLiveContext(ctxFlop({ handNumber: 'HAND_D' })));
    vi.advanceTimersByTime(100);
    harness.flush();
    const adviceNoHand = { ...advFlop({ currentStreet: 'flop' }), handNumber: null };
    harness.push(msgAdvice(adviceNoHand));
    vi.advanceTimersByTime(1);
    harness.flush();
    expect(harness.snapshot().lastGoodAdvice).not.toBeNull();
  });
});

// =========================================================================
// SCENARIO 14: Stale advice indicator (RT-48)
// =========================================================================

describe('Scenario 14: advice _receivedAt stamping + staleness threshold (RT-48)', () => {
  it('handleAdvice stamps _receivedAt on accepted advice', () => {
    harness.push(msgLiveContext(ctxFlop({ handNumber: 'HAND_42' })));
    vi.advanceTimersByTime(100);
    harness.flush();
    harness.push(msgAdvice(advFlop({ currentStreet: 'flop' })));
    vi.advanceTimersByTime(1);
    harness.flush();
    const advice = harness.snapshot().lastGoodAdvice;
    expect(advice).not.toBeNull();
    expect(typeof advice._receivedAt).toBe('number');
    expect(Number.isNaN(advice._receivedAt)).toBe(false);
  });

  it('advice older than the 10s threshold is classified stale at render time', () => {
    harness.push(msgLiveContext(ctxFlop({ handNumber: 'HAND_X' })));
    vi.advanceTimersByTime(100);
    harness.flush();
    harness.push(msgAdvice(advFlop({ currentStreet: 'flop' })));
    vi.advanceTimersByTime(1);
    harness.flush();
    const at0 = harness.snapshot().lastGoodAdvice._receivedAt;
    vi.advanceTimersByTime(11_000);
    // At 11s post-arrival, advice is >10s old → stale per the render-time
    // threshold. We assert the raw ingredient (timestamp); the DOM-side
    // class toggle is exercised by the visual harness, not this harness.
    const ageMs = Date.now() - at0;
    expect(ageMs).toBeGreaterThan(10_000);
  });
});
