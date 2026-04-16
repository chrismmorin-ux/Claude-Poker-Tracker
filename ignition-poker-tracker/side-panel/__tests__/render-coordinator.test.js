/**
 * render-coordinator.test.js — Integration tests for the unified render scheduler.
 *
 * Tests the RenderCoordinator class in isolation using fake timers and
 * injected dependencies. Covers: coalescing, priority bypass, snapshot
 * atomicity, stale advice rejection (RT-45), renderKey accuracy (RT-44),
 * message burst simulation, and visual continuity (RT-48).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderCoordinator, PRIORITY } from '../render-coordinator.js';

// =========================================================================
// HELPERS
// =========================================================================

/** Create a coordinator with fake timers and a render spy. */
function createCoordinator(opts = {}) {
  const renders = [];
  const coord = new RenderCoordinator({
    renderFn: (snap, reason) => renders.push({ snap: { ...snap }, reason, at: Date.now() }),
    getTimestamp: () => Date.now(),
    requestFrame: (cb) => setTimeout(cb, 0), // fake rAF via setTimeout(0)
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  }, { coalesceMs: opts.coalesceMs ?? 80 });
  return { coord, renders };
}

/** Build a minimal live context for testing. */
function liveCtx(overrides = {}) {
  return {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 1,
    pot: 20,
    foldedSeats: [],
    actionSequence: [],
    activeSeatNumbers: [1, 3, 5],
    ...overrides,
  };
}

/** Build a minimal advice object for testing. */
function advice(overrides = {}) {
  return {
    currentStreet: 'flop',
    villainSeat: 3,
    recommendations: [{ action: 'bet', ev: 5.2 }],
    ...overrides,
  };
}

// =========================================================================
// TESTS
// =========================================================================

describe('RenderCoordinator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // =====================================================================
  // BASIC SCHEDULING
  // =====================================================================

  describe('coalescing', () => {
    it('coalesces 3 rapid NORMAL renders into 1', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('exploits', PRIORITY.NORMAL);
      coord.scheduleRender('live_context', PRIORITY.NORMAL);
      coord.scheduleRender('pipeline_diag', PRIORITY.NORMAL);

      // Before coalesce window expires — no renders yet
      vi.advanceTimersByTime(50);
      expect(renders).toHaveLength(0);

      // After coalesce window + rAF
      vi.advanceTimersByTime(50); // 80ms coalesce fires, queues rAF
      vi.advanceTimersByTime(1);  // rAF fires
      expect(renders).toHaveLength(1);
      expect(renders[0].reason).toBe('pipeline_diag'); // last reason wins
    });

    it('IMMEDIATE priority bypasses coalesce timer', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('exploits', PRIORITY.NORMAL);

      // Immediate bypasses
      coord.scheduleRender('advice', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1); // rAF fires immediately
      expect(renders).toHaveLength(1);
      expect(renders[0].reason).toBe('advice');
    });

    it('skips render when renderKey is unchanged', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Same state, schedule again
      coord.scheduleRender('second', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      // Skipped — renderKey unchanged
      expect(renders).toHaveLength(1);
    });

    it('renders when state changes between schedules', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Change state
      coord.set('currentLiveContext', liveCtx({ pot: 50 }));
      coord.scheduleRender('second', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
      expect(renders[1].snap.currentLiveContext.pot).toBe(50);
    });
  });

  // =====================================================================
  // SNAPSHOT ATOMICITY
  // =====================================================================

  describe('snapshot atomicity', () => {
    it('snapshot reflects state at render time, not schedule time', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ pot: 10 }));
      coord.scheduleRender('test', PRIORITY.NORMAL);

      // Mutate state during coalesce window
      coord.set('currentLiveContext', liveCtx({ pot: 99 }));

      vi.advanceTimersByTime(100);
      expect(renders).toHaveLength(1);
      // Snapshot taken at render time (after coalesce), not at schedule time
      expect(renders[0].snap.currentLiveContext.pot).toBe(99);
    });

    it('focusedVillainSeat is computed in snapshot (not stale)', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ pfAggressor: 5 }));
      coord.set('lastGoodAdvice', advice({ villainSeat: 3 }));

      coord.scheduleRender('test', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      // focusedVillain should be advice.villainSeat (3), not pfAggressor (5)
      // because advice villain has higher priority than pfAggressor
      expect(renders[0].snap.focusedVillainSeat).toBe(3);

      // Now clear advice — villain should fall to pfAggressor
      coord.set('lastGoodAdvice', null);
      coord.resetRenderKey();
      coord.scheduleRender('test2', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders[1].snap.focusedVillainSeat).toBe(5);
    });
  });

  // =====================================================================
  // RT-44: RENDER KEY FIX
  // =====================================================================

  describe('RT-44: renderKey detects exploit/appSeatData changes', () => {
    it('different exploitPushCount triggers re-render', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.set('lastGoodExploits', { seats: [], appConnected: true });
      coord.set('exploitPushCount', 1);

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Increment exploit push count (new exploit data arrived)
      coord.set('exploitPushCount', 2);
      coord.scheduleRender('exploits', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
    });

    it('different appSeatDataVersion triggers re-render', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.set('appSeatDataVersion', 1);

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      coord.set('appSeatDataVersion', 2);
      coord.scheduleRender('exploits', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
    });

    it('pinned villain change detected in renderKey', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      coord.set('pinnedVillainSeat', 5);
      coord.scheduleRender('pin', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
      expect(renders[1].snap.pinnedVillainSeat).toBe(5);
    });
  });

  // =====================================================================
  // RT-45: STALE ADVICE GUARD
  // =====================================================================

  describe('RT-45: stale advice rejection when liveContext is null', () => {
    it('holds advice when currentLiveContext is null', () => {
      const { coord } = createCoordinator();
      // No live context (e.g., after SW restart)
      coord.set('currentLiveContext', null);

      const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(accepted).toBe(false);
      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.getPendingAdvice()).not.toBeNull();
    });

    it('accepts advice when currentLiveContext is present', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ currentStreet: 'flop' }));

      const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(accepted).toBe(true);
      expect(coord.get('lastGoodAdvice')).not.toBeNull();
      expect(coord.getPendingAdvice()).toBeNull();
    });

    it('promotes pending advice when live context arrives', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', null);

      // Advice arrives first (held)
      coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(coord.get('lastGoodAdvice')).toBeNull();

      // Live context arrives — promotes pending advice
      coord.handleLiveContext(liveCtx({ state: 'FLOP', currentStreet: 'flop' }));
      expect(coord.get('lastGoodAdvice')).not.toBeNull();
      expect(coord.get('lastGoodAdvice').currentStreet).toBe('flop');
      expect(coord.getPendingAdvice()).toBeNull();
    });

    it('rejects held advice from earlier street than live context', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', null);

      // Stale preflop advice held
      coord.handleAdvice(advice({ currentStreet: 'preflop' }));

      // Live context arrives at turn (later street)
      coord.handleLiveContext(liveCtx({ state: 'TURN', currentStreet: 'turn' }));

      // Stale advice should NOT be promoted (turn > preflop)
      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.getPendingAdvice()).toBeNull(); // cleared regardless
    });

    it('rejects advice from earlier street than live context', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ currentStreet: 'turn' }));

      const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(accepted).toBe(false);
      expect(coord.get('lastGoodAdvice')).toBeNull();
    });

    it('clears advicePendingForStreet when fresh advice accepted', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.set('advicePendingForStreet', 'flop');

      coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(coord.get('advicePendingForStreet')).toBeNull();
    });
  });

  // =====================================================================
  // LIVE CONTEXT: HAND BOUNDARY
  // =====================================================================

  describe('live context hand boundaries', () => {
    it('clears advice on DEALING state transition', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'RIVER', currentStreet: 'river' }));
      coord.set('lastGoodAdvice', advice());

      coord.handleLiveContext({ state: 'DEALING', currentStreet: 'preflop', heroSeat: 1 });

      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.get('advicePendingForStreet')).toBe('DEALING');
    });

    it('clears advice on PREFLOP state transition', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'COMPLETE' }));
      coord.set('lastGoodAdvice', advice());

      coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop', heroSeat: 1 });

      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.get('advicePendingForStreet')).toBe('PREFLOP');
    });

    it('does not clear advice on same-state update', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'FLOP' }));
      coord.set('lastGoodAdvice', advice());

      coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop', heroSeat: 1, pot: 30 });

      expect(coord.get('lastGoodAdvice')).not.toBeNull();
    });

    it('clears pending advice on new hand boundary', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', null);

      // Hold stale advice
      coord.handleAdvice(advice({ currentStreet: 'river' }));
      expect(coord.getPendingAdvice()).not.toBeNull();

      // New hand starts — clears pending advice (not from this hand)
      coord.handleLiveContext({ state: 'DEALING', currentStreet: 'preflop', heroSeat: 1 });
      expect(coord.getPendingAdvice()).toBeNull();
      expect(coord.get('lastGoodAdvice')).toBeNull();
    });
  });

  // =====================================================================
  // TABLE SWITCH
  // =====================================================================

  describe('table switch', () => {
    it('clears all per-table state', () => {
      const { coord } = createCoordinator();
      coord.set('pinnedVillainSeat', 5);
      coord.set('lastGoodAdvice', advice());
      coord.set('lastGoodTournament', { heroMRatio: 10 });
      coord.set('currentLiveContext', liveCtx());
      coord.set('userCollapsedSections', new Set(['range', 'model']));

      coord.clearForTableSwitch();

      expect(coord.get('pinnedVillainSeat')).toBeNull();
      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.get('lastGoodTournament')).toBeNull();
      expect(coord.get('currentLiveContext')).toBeNull();
      expect(coord.get('userCollapsedSections').size).toBe(0);
      expect(coord.getPendingAdvice()).toBeNull();
      expect(coord.getLastStreetCardHtml()).toBeNull();
    });
  });

  // =====================================================================
  // MESSAGE BURST SIMULATION
  // =====================================================================

  describe('message burst simulation', () => {
    it('50 identical live context pushes produce 1 render', () => {
      const { coord, renders } = createCoordinator();
      const ctx = liveCtx({ pot: 20 });

      for (let i = 0; i < 50; i++) {
        coord.handleLiveContext(ctx);
        coord.scheduleRender('live_context');
      }

      vi.advanceTimersByTime(200);
      // One render (coalesced) — renderKey same after first, so only 1 executes
      expect(renders).toHaveLength(1);
    });

    it('SW restart sequence: pipeline(null) + exploits + stale advice + live context', () => {
      const { coord, renders } = createCoordinator();

      // Step 1: push_pipeline_status with null liveContext (SW restart)
      coord.set('lastPipeline', { tables: {}, appConnected: true });
      coord.set('currentLiveContext', null);
      coord.scheduleRender('pipeline_status');

      // Step 2: push_exploits arrives
      coord.set('lastGoodExploits', { seats: [{ seat: 3 }], appConnected: true });
      coord.set('exploitPushCount', 1);
      coord.set('appSeatData', { 3: { style: 'LAG' } });
      coord.set('appSeatDataVersion', 1);
      coord.scheduleRender('exploits');

      // Step 3: push_action_advice with stale data (liveContext still null)
      const staleAccepted = coord.handleAdvice(advice({ currentStreet: 'preflop' }));
      expect(staleAccepted).toBe(false); // HELD, not accepted
      if (!staleAccepted) coord.scheduleRender('advice');

      // Coalesce fires — render WITHOUT stale advice
      vi.advanceTimersByTime(100);
      expect(renders).toHaveLength(1);
      expect(renders[0].snap.lastGoodAdvice).toBeNull(); // No stale advice shown

      // Step 4: push_live_context arrives (real data from capture script)
      coord.handleLiveContext(liveCtx({ state: 'PREFLOP', currentStreet: 'preflop' }));
      coord.scheduleRender('live_context', PRIORITY.IMMEDIATE);

      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
      // Pending advice was promoted (preflop matches preflop)
      expect(renders[1].snap.lastGoodAdvice).not.toBeNull();
    });

    it('hand start sequence: live_context(DEALING) + exploits + advice(immediate)', () => {
      const { coord, renders } = createCoordinator();
      // Start from previous hand state
      coord.set('currentLiveContext', liveCtx({ state: 'COMPLETE' }));
      coord.set('lastGoodAdvice', advice({ currentStreet: 'river' }));
      coord.set('lastHandCount', 5);

      // DEALING arrives — clears old advice
      coord.handleLiveContext({ state: 'DEALING', currentStreet: 'preflop', heroSeat: 1 });
      coord.scheduleRender('live_context');

      // Exploits arrive during coalesce window
      coord.set('exploitPushCount', 2);
      coord.set('appSeatDataVersion', 2);
      coord.scheduleRender('exploits');

      // Advice arrives with IMMEDIATE priority
      coord.set('currentLiveContext', liveCtx({ state: 'PREFLOP', currentStreet: 'preflop' }));
      coord.handleAdvice(advice({ currentStreet: 'preflop' }));
      coord.scheduleRender('advice', PRIORITY.IMMEDIATE);

      vi.advanceTimersByTime(1); // rAF fires
      // Should have 1 render (IMMEDIATE cancelled the coalesce timer)
      expect(renders).toHaveLength(1);
      expect(renders[0].snap.lastGoodAdvice).not.toBeNull();
      expect(renders[0].snap.lastGoodAdvice.currentStreet).toBe('preflop');
      // Advice pending cleared
      expect(renders[0].snap.advicePendingForStreet).toBeNull();
    });

    it('staleness timer during active play with unchanged state produces no render', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      // Initial render
      coord.scheduleRender('init', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Staleness timer fires (nothing changed)
      coord.scheduleRender('stale_timeout');
      vi.advanceTimersByTime(100);
      // No new render — renderKey unchanged
      expect(renders).toHaveLength(1);
    });
  });

  // =====================================================================
  // RT-48: VISUAL CONTINUITY
  // =====================================================================

  describe('RT-48: visual continuity', () => {
    it('snapshot includes lastStreetCardHtml for hold-previous logic', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.setLastStreetCardHtml('<div>previous advice content</div>');
      coord.set('advicePendingForStreet', 'flop');

      coord.scheduleRender('test', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      expect(renders[0].snap.lastStreetCardHtml).toBe('<div>previous advice content</div>');
      expect(renders[0].snap.advicePendingForStreet).toBe('flop');
    });
  });

  // =====================================================================
  // FLUSH (test utility)
  // =====================================================================

  describe('flush', () => {
    it('force-executes pending render immediately', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('test', PRIORITY.NORMAL);
      // No timers advanced — force flush
      coord.flush();
      expect(renders).toHaveLength(1);
    });

    it('no-op when nothing is pending', () => {
      const { coord, renders } = createCoordinator();
      coord.flush();
      expect(renders).toHaveLength(0);
    });
  });

  // =====================================================================
  // DESTROY
  // =====================================================================

  describe('destroy', () => {
    it('cancels pending timers', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('test', PRIORITY.NORMAL);
      coord.destroy();
      vi.advanceTimersByTime(200);
      expect(renders).toHaveLength(0);
    });
  });

  // =========================================================================
  // Fix 6c: Pipeline event log
  // =========================================================================

  describe('logPipelineEvent', () => {
    it('records events up to cap of 50', () => {
      const { coord } = createCoordinator();
      for (let i = 0; i < 55; i++) coord.logPipelineEvent('test', String(i));
      const events = coord.get('pipelineEvents');
      expect(events.length).toBe(50);
      expect(events[events.length - 1].detail).toBe('54');
    });

    it('pipelineEvents is NOT included in renderKey', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      const key1 = coord.buildRenderKey(coord.buildSnapshot());

      coord.logPipelineEvent('new_hand', 'PREFLOP');
      const key2 = coord.buildRenderKey(coord.buildSnapshot());
      expect(key1).toBe(key2);
    });

    it('logs hand boundary transitions from handleLiveContext', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'FLOP', currentStreet: 'flop' }));
      coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop' });
      const events = coord.get('pipelineEvents');
      expect(events.length).toBe(1);
      expect(events[0].event).toBe('new_hand');
    });

    it('logs advice acceptance from handleAdvice', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.handleAdvice(advice());
      const events = coord.get('pipelineEvents');
      expect(events.length).toBe(1);
      expect(events[0].event).toBe('advice_accepted');
      expect(events[0].detail).toBe('flop');
    });
  });
});

// =========================================================================
// TIMER REGISTRATION CONTRACT (RT-60)
// =========================================================================

describe('RT-60: timer registration contract', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function makeTimedCoord() {
    const renders = [];
    const coord = new RenderCoordinator({
      renderFn: (snap, reason) => renders.push({ reason }),
      getTimestamp: () => Date.now(),
      requestFrame: (cb) => setTimeout(cb, 0),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (id) => clearTimeout(id),
      clearInterval: (id) => clearInterval(id),
    });
    return { coord, renders };
  }

  it('registerTimer replaces the prior handle under the same key', () => {
    const { coord } = makeTimedCoord();
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    coord.registerTimer('k', setTimeout(callback1, 100), 'timeout');
    coord.registerTimer('k', setTimeout(callback2, 100), 'timeout');
    vi.advanceTimersByTime(200);
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('clearTimer cancels a specific key', () => {
    const { coord } = makeTimedCoord();
    const callback = vi.fn();
    coord.registerTimer('x', setTimeout(callback, 100), 'timeout');
    coord.clearTimer('x');
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });

  it('clearAllTimers cancels every registered timer across kinds', () => {
    const { coord } = makeTimedCoord();
    const timeoutCb = vi.fn();
    const intervalCb = vi.fn();
    coord.registerTimer('t1', setTimeout(timeoutCb, 50), 'timeout');
    coord.registerTimer('i1', setInterval(intervalCb, 50), 'interval');
    coord.clearAllTimers();
    vi.advanceTimersByTime(500);
    expect(timeoutCb).not.toHaveBeenCalled();
    expect(intervalCb).not.toHaveBeenCalled();
  });

  it('clearForTableSwitch cancels registered timers (prevents orphan-fire)', () => {
    const { coord } = makeTimedCoord();
    const callback = vi.fn();
    coord.registerTimer('planPanelAutoExpand', setTimeout(callback, 8000), 'timeout');
    coord.clearForTableSwitch();
    vi.advanceTimersByTime(10_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('destroy cancels every registered timer', () => {
    const { coord } = makeTimedCoord();
    const a = vi.fn();
    const b = vi.fn();
    coord.registerTimer('a', setTimeout(a, 100), 'timeout');
    coord.registerTimer('b', setInterval(b, 100), 'interval');
    coord.destroy();
    vi.advanceTimersByTime(500);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('clearForTableSwitch clears advicePendingForStreet (prevents R5 spam)', () => {
    // Regression: probe-flake → tableGrace → clearForTableSwitch used to
    // leave advicePendingForStreet set. Combined with the same-call clears
    // of currentLiveContext + lastGoodAdvice, this armed R5 on every render
    // until a new context arrived. Observed spamming the invariant counter
    // at ~30s cadence in the field.
    const { coord } = makeTimedCoord();
    coord.set('advicePendingForStreet', 'PREFLOP');
    coord.clearForTableSwitch();
    expect(coord.get('advicePendingForStreet')).toBeNull();
    expect(coord.get('currentLiveContext')).toBeNull();
    expect(coord.get('lastGoodAdvice')).toBeNull();
  });

  it('onTableSwitch hooks fire on clearForTableSwitch', () => {
    const { coord } = makeTimedCoord();
    const hook = vi.fn();
    coord.onTableSwitch(hook);
    coord.clearForTableSwitch();
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('a bad onTableSwitch hook does not break lifecycle', () => {
    const { coord } = makeTimedCoord();
    const goodHook = vi.fn();
    coord.onTableSwitch(() => { throw new Error('boom'); });
    coord.onTableSwitch(goodHook);
    expect(() => coord.clearForTableSwitch()).not.toThrow();
    expect(goodHook).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// RENDERKEY CONTENT COMPLETENESS (RT-43 / RT-44 / RT-54)
//
// Regression coverage for "sidebar shows wrong info for hand state": when
// fields the UI displays are absent from the fingerprint, renderAll skips
// the render and the DOM holds stale data. Each test changes one specific
// state field and asserts the key flips.
// =========================================================================

describe('buildRenderKey: state-drift invalidation coverage', () => {
  function emptySnap(overrides = {}) {
    return {
      currentLiveContext: null,
      lastGoodAdvice: null,
      lastGoodTournament: null,
      focusedVillainSeat: null,
      pinnedVillainSeat: null,
      lastHandCount: 0,
      exploitPushCount: 0,
      advicePushCount: 0,
      advicePendingForStreet: null,
      appSeatDataVersion: 0,
      cachedDiag: null,
      recoveryMessage: null,
      connState: { connected: true },
      staleContext: false,
      hasTableHands: false,
      ...overrides,
    };
  }

  const { coord } = createCoordinator();

  it('tournament blinds/M changes invalidate the key', () => {
    const base = emptySnap({
      lastGoodTournament: { heroMRatio: 12.0, currentLevelIndex: 3, levelEndTime: 100 },
    });
    const changed = emptySnap({
      lastGoodTournament: { heroMRatio: 6.5, currentLevelIndex: 4, levelEndTime: 100 },
    });
    expect(coord.buildRenderKey(base)).not.toBe(coord.buildRenderKey(changed));
  });

  it('tournament player count changes (bust) invalidate the key', () => {
    const a = emptySnap({ lastGoodTournament: { playersRemaining: 127 } });
    const b = emptySnap({ lastGoodTournament: { playersRemaining: 126 } });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('tournament ICM zone change (approaching bubble) invalidates the key', () => {
    const a = emptySnap({ lastGoodTournament: { icmPressure: { zone: 'standard' } } });
    const b = emptySnap({ lastGoodTournament: { icmPressure: { zone: 'bubble' } } });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('last-action amount change invalidates the key (raise-to-different-size)', () => {
    const base = emptySnap({
      currentLiveContext: {
        actionSequence: [{ seat: 3, action: 'raise', amount: 6 }],
      },
    });
    const resized = emptySnap({
      currentLiveContext: {
        actionSequence: [{ seat: 3, action: 'raise', amount: 20 }],
      },
    });
    expect(coord.buildRenderKey(base)).not.toBe(coord.buildRenderKey(resized));
  });

  it('advice sizing change invalidates the key (same action, different bet fraction)', () => {
    const a = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'bet', sizing: { betFraction: 0.5 } }] },
    });
    const b = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'bet', sizing: { betFraction: 0.75 } }] },
    });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('advice villainSeat change invalidates the key (pinned-villain override)', () => {
    const a = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'call' }], villainSeat: 3 },
    });
    const b = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'call' }], villainSeat: 5 },
    });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('moreAnalysisOpen toggle invalidates the key (SR-6.14, split from deepExpanderOpen)', () => {
    const a = emptySnap({ moreAnalysisOpen: false });
    const b = emptySnap({ moreAnalysisOpen: true });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('modelAuditOpen toggle invalidates the key (SR-6.14)', () => {
    const a = emptySnap({ modelAuditOpen: false });
    const b = emptySnap({ modelAuditOpen: true });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('planPanelOpen toggle invalidates the key (SR-6.4)', () => {
    const a = emptySnap({ planPanelOpen: false });
    const b = emptySnap({ planPanelOpen: true });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('tournamentCollapsed toggle invalidates the key (SR-6.4)', () => {
    const a = emptySnap({ tournamentCollapsed: false });
    const b = emptySnap({ tournamentCollapsed: true });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('lastGoodExploits clear invalidates the key (SR-6.4 — table switch)', () => {
    const a = emptySnap({ lastGoodExploits: { seats: [], appConnected: true } });
    const b = emptySnap({ lastGoodExploits: null });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('lastGoodExploits appConnected flip invalidates the key (SR-6.4)', () => {
    const a = emptySnap({ lastGoodExploits: { seats: [], appConnected: true } });
    const b = emptySnap({ lastGoodExploits: { seats: [], appConnected: false } });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  // RT-71: freshness, invariant violation, and pending-advice transitions
  // must force a re-render so stale-tint / "!" badge / "Stale — recomputing"
  // surface within the next frame without depending on an unrelated state
  // change to coincide.
  it('RT-71 — freshness timestamp change invalidates the key', () => {
    const a = emptySnap({
      freshness: { currentLiveContext: { timestamp: 1000, source: 'capture' }, currentLiveContextFields: {}, appSeatData: {} },
    });
    const b = emptySnap({
      freshness: { currentLiveContext: { timestamp: 2000, source: 'capture' }, currentLiveContextFields: {}, appSeatData: {} },
    });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('RT-71 — freshness new per-field entry invalidates the key', () => {
    const a = emptySnap({
      freshness: { currentLiveContext: null, currentLiveContextFields: {}, appSeatData: {} },
    });
    const b = emptySnap({
      freshness: { currentLiveContext: null, currentLiveContextFields: { pot: { timestamp: 1000, source: 'capture' } }, appSeatData: {} },
    });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('RT-71 — lastViolationAt stamp invalidates the key', () => {
    const a = emptySnap({ lastViolationAt: 0 });
    const b = emptySnap({ lastViolationAt: 1700000000000 });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('RT-71 — pendingAdvicePresent transition invalidates the key', () => {
    const a = emptySnap({ pendingAdvicePresent: 0 });
    const b = emptySnap({ pendingAdvicePresent: 1 });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('identical snapshots produce identical keys (skip redundant renders)', () => {
    const a = emptySnap({
      lastGoodTournament: { heroMRatio: 12.0, currentLevelIndex: 3 },
      currentLiveContext: { actionSequence: [{ seat: 3, action: 'bet', amount: 10 }] },
    });
    // Manually mirror instead of re-using object so shallow copies can't mask bugs.
    const b = emptySnap({
      lastGoodTournament: { heroMRatio: 12.0, currentLevelIndex: 3 },
      currentLiveContext: { actionSequence: [{ seat: 3, action: 'bet', amount: 10 }] },
    });
    expect(coord.buildRenderKey(a)).toBe(coord.buildRenderKey(b));
  });
});

// =========================================================================
// RT-70: PRE-DISPATCH INVARIANT GATE (R-7.2 enforcement)
// =========================================================================

describe('RT-70 — pre-dispatch invariant gate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stamps violations pre-dispatch and renders with violation in the same frame', () => {
    const { coord, renders } = createCoordinator();

    // Set up a state that violates Rule 3 (advice street behind context by >1)
    coord.set('currentLiveContext', liveCtx({ state: 'RIVER', currentStreet: 'river' }));
    coord.set('lastGoodAdvice', { currentStreet: 'preflop', recommendations: [] });
    coord.set('hasTableHands', true);

    coord.scheduleRender('test_violation');
    vi.advanceTimersByTime(100);

    // Render DID fire (with violation stamp in snapshot)
    expect(renders.length).toBe(1);
    // Violation SHOULD be stamped
    expect(coord.get('lastViolationAt')).toBeGreaterThan(0);
    expect(coord.get('violationCountLifetime')).toBeGreaterThan(0);
    // The snapshot passed to renderFn includes the violation stamp
    expect(renders[0].snap.lastViolationAt).toBeGreaterThan(0);
    // STP-1: rolling counter also exposes the violation for the badge
    expect(renders[0].snap.violationCount30s).toBeGreaterThan(0);
  });

  it('STP-1 — violationCount30s is a rolling window; lifetime is monotonic', () => {
    // Regression for the pre-STP-1 tooltip lie. Before the fix,
    // `lastViolationCount` was a lifetime accumulator that the badge tooltip
    // labelled "in the last 30s". This test pins that the rolling counter
    // actually drops old entries while lifetime continues to accumulate.
    const { coord, renders } = createCoordinator();

    // Arrange a persistent R3 violation (advice 2 streets behind context).
    coord.set('currentLiveContext', liveCtx({ state: 'RIVER', currentStreet: 'river' }));
    coord.set('lastGoodAdvice', { currentStreet: 'preflop', recommendations: [] });
    coord.set('hasTableHands', true);

    // Fire one violation.
    coord.scheduleRender('v1');
    vi.advanceTimersByTime(100);
    expect(coord.get('violationCountLifetime')).toBe(1);
    expect(renders.at(-1).snap.violationCount30s).toBe(1);

    // Wait 20s, fire another. Both should count in 30s window.
    vi.advanceTimersByTime(20_000);
    coord.set('advicePushCount', (coord.get('advicePushCount') || 0) + 1);
    coord.scheduleRender('v2');
    vi.advanceTimersByTime(100);
    expect(coord.get('violationCountLifetime')).toBe(2);
    expect(renders.at(-1).snap.violationCount30s).toBe(2);

    // Advance past the 30s window relative to the FIRST violation. Old entry
    // should be pruned; only the 20s-ago one remains in the window.
    vi.advanceTimersByTime(11_000); // 31s total since v1, 11s since v2
    coord.set('advicePushCount', (coord.get('advicePushCount') || 0) + 1);
    coord.scheduleRender('window_rollover');
    vi.advanceTimersByTime(100);
    // Lifetime unchanged this frame (no new violation arg, but the render
    // will still evaluate invariants against the violating state — so it
    // fires one more. Tally: lifetime=3, 30s window contains v2 + v3).
    expect(coord.get('violationCountLifetime')).toBe(3);
    expect(renders.at(-1).snap.violationCount30s).toBe(2);

    // Idle 40s past last violation. Snapshot-time pruning drops the window
    // to zero without requiring a new render to "clean up".
    vi.advanceTimersByTime(40_000);
    const snap = coord.buildSnapshot();
    expect(snap.violationCount30s).toBe(0);
    expect(snap.violationCountLifetime).toBe(3);
  });

  it('throwOnViolation mode still throws from pre-dispatch position', () => {
    const renders = [];
    const coord = new RenderCoordinator({
      renderFn: (snap, reason) => renders.push(reason),
      getTimestamp: () => Date.now(),
      requestFrame: (cb) => setTimeout(cb, 0),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (id) => clearTimeout(id),
    }, { throwOnViolation: true });

    coord.set('currentLiveContext', liveCtx({ state: 'RIVER', currentStreet: 'river' }));
    coord.set('lastGoodAdvice', { currentStreet: 'preflop', recommendations: [] });
    coord.set('hasTableHands', true);
    coord.scheduleRender('throw_test');

    expect(() => vi.advanceTimersByTime(100)).toThrow('Invariant violations');
    expect(renders.length).toBe(0);
  });
});

// =========================================================================
// SR-6.6: FRESHNESS RECORDS + R-4.3 PARTIAL-PAYLOAD RETENTION
// =========================================================================

describe('SR-6.6 — freshness + partial-payload retention', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('handleLiveContext field-level merge (R-4.3, S1 regression)', () => {
    it('mid-hand partial push retains prior fields absent from new payload', () => {
      const { coord } = createCoordinator();
      coord.handleLiveContext(liveCtx({ pot: 20, communityCards: ['As', 'Kd', '2h'] }));

      // Mid-hand partial push — only currentStreet changes
      coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop' });

      const snap = coord.buildSnapshot();
      expect(snap.currentLiveContext.pot).toBe(20);
      expect(snap.currentLiveContext.communityCards).toEqual(['As', 'Kd', '2h']);
    });

    it('new-hand boundary fully replaces (stale board cleared)', () => {
      const { coord } = createCoordinator();
      coord.handleLiveContext(liveCtx({
        state: 'RIVER', currentStreet: 'river',
        communityCards: ['As', 'Kd', '2h', '7c', 'Qs'],
      }));

      // New hand: PREFLOP boundary. Push omits communityCards.
      coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop', heroSeat: 1, pot: 3 });

      const snap = coord.buildSnapshot();
      expect(snap.currentLiveContext.communityCards).toBeUndefined();
      expect(snap.currentLiveContext.pot).toBe(3);
    });

    it('explicit null in new payload overrides prior (explicit replacement)', () => {
      const { coord } = createCoordinator();
      coord.handleLiveContext(liveCtx({ pot: 20 }));
      coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop', pot: null });

      const snap = coord.buildSnapshot();
      expect(snap.currentLiveContext.pot).toBeNull();
    });

    it('stamps per-field freshness timestamps for fields in the new payload', () => {
      const { coord } = createCoordinator();
      vi.setSystemTime(1000);
      coord.handleLiveContext(liveCtx({ pot: 20 }));
      vi.setSystemTime(2000);
      coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop' });

      const snap = coord.buildSnapshot();
      expect(snap.freshness.currentLiveContextFields.currentStreet.timestamp).toBe(2000);
      expect(snap.freshness.currentLiveContextFields.pot.timestamp).toBe(1000);
      expect(snap.freshness.currentLiveContext.source).toBe('push_live_context');
    });
  });

  describe('mergeAppSeatData (R-4.3, S5 regression)', () => {
    it('retains prior seats when new push covers only a subset', () => {
      const { coord } = createCoordinator();
      coord.mergeAppSeatData({
        3: { style: 'TAG', sampleSize: 50 },
        5: { style: 'LAG', sampleSize: 30 },
      });
      coord.mergeAppSeatData({ 3: { style: 'TAG', sampleSize: 60 } });

      const snap = coord.buildSnapshot();
      expect(snap.appSeatData[3].sampleSize).toBe(60);
      expect(snap.appSeatData[5]).toEqual({ style: 'LAG', sampleSize: 30 });
    });

    it('bumps appSeatDataVersion on every merge (renderKey invalidation)', () => {
      const { coord } = createCoordinator();
      const v0 = coord.get('appSeatDataVersion');
      coord.mergeAppSeatData({ 3: { style: 'TAG' } });
      coord.mergeAppSeatData({ 5: { style: 'LAG' } });
      expect(coord.get('appSeatDataVersion')).toBe(v0 + 2);
    });

    it('stamps per-seat freshness with timestamp + source', () => {
      const { coord } = createCoordinator();
      vi.setSystemTime(5000);
      coord.mergeAppSeatData({ 3: { style: 'TAG' } }, 'push_exploits');
      const snap = coord.buildSnapshot();
      expect(snap.freshness.appSeatData[3]).toEqual({ timestamp: 5000, source: 'push_exploits' });
    });

    it('ignores null / non-object payloads without throwing', () => {
      const { coord } = createCoordinator();
      expect(() => coord.mergeAppSeatData(null)).not.toThrow();
      expect(() => coord.mergeAppSeatData(undefined)).not.toThrow();
      expect(coord.get('appSeatDataVersion')).toBe(0);
    });
  });

  describe('clearForTableSwitch resets liveContext freshness', () => {
    it('clears currentLiveContext freshness but retains appSeatData freshness', () => {
      const { coord } = createCoordinator();
      coord.handleLiveContext(liveCtx({ pot: 20 }));
      coord.mergeAppSeatData({ 3: { style: 'TAG' } });

      coord.clearForTableSwitch();

      const snap = coord.buildSnapshot();
      expect(snap.freshness.currentLiveContext).toBeNull();
      expect(snap.freshness.currentLiveContextFields).toEqual({});
      // appSeatData freshness retained (matches appSeatData not being cleared)
      expect(snap.freshness.appSeatData[3]).toBeDefined();
    });
  });
});

// =========================================================================
// SR-6.7: R-7.3 STREET TOLERANCE REVOKED (S2 REGRESSION)
// =========================================================================

describe('SR-6.7 — exact-street match for advice acceptance', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('S2: flop advice is HELD (not accepted) while live context is preflop', () => {
    const { coord } = createCoordinator();
    coord.handleLiveContext(liveCtx({ state: 'PREFLOP', currentStreet: 'preflop' }));

    // Advice arrives one street ahead — previously accepted under tolerance.
    const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));

    expect(accepted).toBe(false);
    const snap = coord.buildSnapshot();
    expect(snap.lastGoodAdvice).toBeNull();
    // Held in pending buffer — promoted when live context catches up.
    expect(coord._pendingAdvice?.currentStreet).toBe('flop');
  });

  it('S2: preflop advice never surfaces once live context is on flop', () => {
    const { coord } = createCoordinator();
    // Hand 1 preflop: accept preflop advice.
    coord.handleLiveContext(liveCtx({ state: 'PREFLOP', currentStreet: 'preflop', handNumber: 1 }));
    coord.handleAdvice(advice({ currentStreet: 'preflop', handNumber: 1 }));
    expect(coord.buildSnapshot().lastGoodAdvice?.currentStreet).toBe('preflop');

    // Flop arrives. A straggling preflop advice push (earlier street) must
    // be rejected outright — the existing lastGoodAdvice remains visible,
    // but the renderer surfaces "Stale — recomputing" via street-mismatch.
    coord.handleLiveContext(liveCtx({ state: 'FLOP', currentStreet: 'flop', handNumber: 1 }));
    const accepted = coord.handleAdvice(advice({ currentStreet: 'preflop', handNumber: 1 }));
    expect(accepted).toBe(false);

    const snap = coord.buildSnapshot();
    // Stale preflop advice retained for stale-recomputing surfacing, but
    // snapshot street mismatch signals renderer to label it stale.
    expect(snap.lastGoodAdvice?.currentStreet).toBe('preflop');
    expect(snap.currentLiveContext.currentStreet).toBe('flop');
  });

  it('accepts advice with exact street match', () => {
    const { coord } = createCoordinator();
    coord.handleLiveContext(liveCtx({ state: 'FLOP', currentStreet: 'flop' }));
    const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));
    expect(accepted).toBe(true);
    expect(coord.buildSnapshot().lastGoodAdvice?.currentStreet).toBe('flop');
  });

  it('mid-hand reconnect: pending flop advice rejected on preflop context (tolerance revoked)', () => {
    const { coord } = createCoordinator();
    // Establish mid-hand preflop state first (so a subsequent preflop push
    // is NOT a new-hand boundary — we're testing the mid-hand promotion branch).
    coord.handleLiveContext(liveCtx({ state: 'PREFLOP', currentStreet: 'preflop' }));

    // SW reconnect: no context yet from coordinator's perspective of the next
    // push cycle. A flop advice buffers.
    coord.handleAdvice(advice({ currentStreet: 'flop' }));
    expect(coord._pendingAdvice?.currentStreet).toBe('flop');

    // A preflop re-push arrives (mid-hand, not a boundary). Under the old
    // 1-street tolerance, pending flop would promote. Revoked: exact match only.
    coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop' });
    expect(coord.buildSnapshot().lastGoodAdvice).toBeNull();
  });
});
